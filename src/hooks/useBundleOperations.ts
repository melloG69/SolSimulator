
import { Transaction } from "@solana/web3.js";
import { jitoService } from "@/services/jitoService";
import { useToast } from "@/hooks/use-toast";
import { setWalletContext, createBundle, updateBundleStatus } from "@/utils/supabaseUtils";
import { connection } from "@/lib/solana";
import { SimulationResult } from "./useBundleState";

export const useBundleOperations = () => {
  const { toast } = useToast();

  const synchronizeTransactions = async (transactions: Transaction[]) => {
    try {
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      console.log('Synchronizing transactions with blockhash:', blockhash);
      
      return transactions.map(tx => {
        // Create a new transaction to avoid mutation
        const newTx = new Transaction();
        newTx.recentBlockhash = blockhash;
        newTx.lastValidBlockHeight = lastValidBlockHeight;
        tx.instructions.forEach(ix => newTx.add(ix));
        if (tx.feePayer) newTx.feePayer = tx.feePayer;
        
        console.log('Transaction updated with blockhash:', newTx.recentBlockhash);
        return newTx;
      });
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
      console.log('Wallet context set, proceeding with bundle creation');
      
      const bundleId = crypto.randomUUID();
      await createBundle(bundleId, publicKey);
      console.log('Bundle created successfully, proceeding with validation');

      const synchronizedTransactions = await synchronizeTransactions(transactions);
      verifyBlockhash(synchronizedTransactions);
      console.log('Transactions synchronized and verified with blockhash');

      const isValid = await jitoService.validateTransactions(synchronizedTransactions);
      
      if (!isValid) {
        setSimulationStatus('failed');
        await updateBundleStatus(bundleId, 'failed', { error: 'Bundle validation failed' });

        toast({
          title: "Simulation Failed",
          description: "Malicious activity detected in the bundle",
          variant: "destructive",
        });
        return transactions.map(() => ({ success: false, message: "Validation failed" }));
      }

      setSimulationStatus('success');
      await updateBundleStatus(bundleId, 'simulated', { success: true });

      toast({
        title: "Simulation Complete",
        description: "Bundle has been successfully simulated",
      });

      return transactions.map(() => ({ success: true }));
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
      
      // First synchronize the transactions
      const synchronizedTransactions = await synchronizeTransactions(transactions);
      verifyBlockhash(synchronizedTransactions);
      console.log('Transactions synchronized and verified before signing');
      
      // Sign the synchronized transactions
      console.log("Signing transactions...");
      const signedTransactions = await Promise.all(
        synchronizedTransactions.map(async tx => {
          const signedTx = await signTransaction(tx);
          // Verify blockhash persists after signing
          if (!signedTx.recentBlockhash) {
            throw new Error('Transaction lost blockhash during signing');
          }
          return signedTx;
        })
      );

      // Verify one final time before submission
      verifyBlockhash(signedTransactions);
      console.log("Signed transactions verified, submitting to Jito...");

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

