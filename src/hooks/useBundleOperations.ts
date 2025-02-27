
import { Transaction } from "@solana/web3.js";
import { jitoService } from "@/services/jitoService";
import { useToast } from "@/hooks/use-toast";
import { setWalletContext, createBundle, updateBundleStatus } from "@/utils/supabaseUtils";
import { connection } from "@/lib/solana";
import { SimulationResult } from "./useBundleState";
import { lighthouseService } from "@/services/lighthouseService";

export const useBundleOperations = () => {
  const { toast } = useToast();

  const synchronizeTransactions = async (transactions: Transaction[]) => {
    try {
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      console.log('Synchronizing transactions with blockhash:', blockhash);
      
      return Promise.all(transactions.map(async (tx) => {
        // Update original transaction with new blockhash
        tx.recentBlockhash = blockhash;
        tx.lastValidBlockHeight = lastValidBlockHeight;
        
        // Build assertions for the transaction
        const assertionResult = await lighthouseService.buildAssertions(tx);
        
        // If there's an assertion transaction, update it with the same blockhash
        if (assertionResult.assertionTransaction) {
          assertionResult.assertionTransaction.recentBlockhash = blockhash;
          assertionResult.assertionTransaction.lastValidBlockHeight = lastValidBlockHeight;
          if (tx.feePayer) {
            assertionResult.assertionTransaction.feePayer = tx.feePayer;
          }
        }
        
        console.log('Transaction pair synchronized with blockhash:', blockhash);
        return [tx, assertionResult.assertionTransaction].filter(Boolean) as Transaction[];
      }));
    } catch (error) {
      console.error("Error synchronizing transactions:", error);
      throw error;
    }
  };

  const verifyBlockhash = (transactions: Transaction[]) => {
    for (const tx of transactions) {
      if (!tx.recentBlockhash) {
        throw new Error('Transaction missing recentBlockhash after synchronization');
      }
      console.log('Verified blockhash for transaction:', tx.recentBlockhash);
    }
  };

  const simulateBundle = async (
    transactions: Transaction[],
    publicKey: string,
    setLoading: (loading: boolean) => void,
    setSimulationStatus: (status: 'idle' | 'success' | 'failed') => void
  ): Promise<SimulationResult[]> => {
    if (transactions.length === 0) {
      toast({
        title: "Error",
        description: "No transactions to simulate",
        variant: "destructive",
      });
      return [];
    }

    setLoading(true);
    setSimulationStatus('idle');
    
    try {
      console.log('Starting bundle simulation for wallet:', publicKey);
      await setWalletContext(publicKey);
      
      const bundleId = crypto.randomUUID();
      await createBundle(bundleId, publicKey);
      console.log('Bundle created with ID:', bundleId);

      // Synchronize transactions with latest blockhash
      const synchronizedTransactionGroups = await synchronizeTransactions(transactions);
      const flattenedTransactions = synchronizedTransactionGroups.flat();
      verifyBlockhash(flattenedTransactions);
      
      console.log('Simulating transactions before validation...');
      const simulationResult = await jitoService.simulateTransactions(flattenedTransactions);
      
      if (!simulationResult.isValid) {
        console.error('Simulation failed:', simulationResult.error);
        setSimulationStatus('failed');
        await updateBundleStatus(bundleId, 'failed', { 
          error: simulationResult.error || 'Simulation failed', 
          details: simulationResult.details 
        });
        
        toast({
          title: "Simulation Failed",
          description: simulationResult.error || "Malicious activity detected in the bundle",
          variant: "destructive",
        });
        
        return transactions.map(() => ({ 
          success: false, 
          message: simulationResult.error || "Simulation failed", 
          bundleId 
        }));
      }

      setSimulationStatus('success');
      await updateBundleStatus(bundleId, 'simulated', { success: true });
      
      toast({
        title: "Simulation Complete",
        description: "Bundle has been successfully simulated",
      });

      return transactions.map(() => ({ success: true, bundleId }));
    } catch (error) {
      console.error("Simulation error:", error);
      setSimulationStatus('failed');
      toast({
        title: "Simulation Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
      return transactions.map(() => ({ 
        success: false, 
        message: error instanceof Error ? error.message : "Unknown error occurred" 
      }));
    } finally {
      setLoading(false);
    }
  };

  const executeBundle = async (
    transactions: Transaction[],
    publicKey: string,
    signTransaction: ((transaction: Transaction) => Promise<Transaction>) | undefined,
    setLoading: (loading: boolean) => void,
    setExecutionStatus: (status: 'idle' | 'success' | 'failed') => void
  ): Promise<string[]> => {
    if (!signTransaction) {
      toast({
        title: "Error",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return [];
    }

    if (transactions.length === 0) {
      toast({
        title: "Error",
        description: "No transactions to execute",
        variant: "destructive",
      });
      return [];
    }

    setLoading(true);
    setExecutionStatus('idle');
    
    try {
      await setWalletContext(publicKey);
      console.log('Starting bundle execution process');
      
      // Synchronize transactions with latest blockhash
      const synchronizedTransactionGroups = await synchronizeTransactions(transactions);
      const flattenedTransactions = synchronizedTransactionGroups.flat();
      verifyBlockhash(flattenedTransactions);
      console.log('Transactions synchronized and verified before signing');

      // Sign all transactions
      console.log("Signing all transactions...");
      const signedTransactions = await Promise.all(
        flattenedTransactions.map(async (tx) => {
          console.log('Signing transaction with feePayer:', tx.feePayer?.toBase58());
          const signedTx = await signTransaction(tx);
          console.log('Transaction signed, signatures:', 
            signedTx.signatures.map(sig => ({
              pubkey: sig.publicKey.toBase58(),
              signature: sig.signature?.toString('base64') || 'null'
            }))
          );
          return signedTx;
        })
      );

      // Verify all transactions are properly signed
      console.log("Verifying signatures for all transactions...");
      signedTransactions.forEach((tx, index) => {
        if (!tx.signatures.some(sig => sig.signature)) {
          throw new Error(`Transaction ${index} is missing signatures after signing`);
        }
      });

      console.log("All transactions signed and verified, submitting bundle to Jito...");
      const result = await jitoService.submitBundle(signedTransactions);
      const signatures = result.signatures || [];

      setExecutionStatus('success');
      toast({
        title: "Success",
        description: "Bundle executed successfully via Jito",
      });

      return signatures;
    } catch (error) {
      console.error("Execution error:", error);
      setExecutionStatus('failed');
      toast({
        title: "Execution Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  return {
    simulateBundle,
    executeBundle
  };
};
