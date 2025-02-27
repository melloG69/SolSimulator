
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
      // Get latest blockhash for transaction validity
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash({
        commitment: 'confirmed'
      });
      console.log('Synchronizing transactions with blockhash:', blockhash);
      
      return Promise.all(transactions.map(async (tx) => {
        // Update original transaction with new blockhash
        tx.recentBlockhash = blockhash;
        tx.lastValidBlockHeight = lastValidBlockHeight;
        
        // First validate the original transaction
        const validationResult = await jitoService.simulateTransactions([tx], { skipLighthouseCheck: true });
        if (!validationResult.isValid && !validationResult.normalErrors) {
          console.error(`Transaction validation failed: ${validationResult.error}`);
          // Return the transaction by itself, without assertion if it's invalid
          return [tx];
        }
        
        // Build assertions for the transaction only if transaction is valid
        const assertionResult = await lighthouseService.buildAssertions(tx);
        
        // Check if Lighthouse program is available
        if (!assertionResult.isProgramAvailable) {
          console.log("Lighthouse program not found on mainnet - continuing without assertions");
          return [tx]; // Continue without assertion
        }
        
        // If there's an assertion transaction, update it with the same blockhash
        if (assertionResult.success && assertionResult.assertionTransaction) {
          assertionResult.assertionTransaction.recentBlockhash = blockhash;
          assertionResult.assertionTransaction.lastValidBlockHeight = lastValidBlockHeight;
          if (tx.feePayer) {
            assertionResult.assertionTransaction.feePayer = tx.feePayer;
          }
          
          // Only include assertion transaction if it was successfully created
          return [tx, assertionResult.assertionTransaction];
        }
        
        console.log('Transaction synchronized with blockhash:', blockhash);
        return [tx]; // If no assertion created, return only the original tx
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

  const verifyAccounts = async (transactions: Transaction[]) => {
    try {
      // Check if accounts referenced in transactions exist
      for (const tx of transactions) {
        // Check the fee payer account
        if (tx.feePayer) {
          const feePayerInfo = await connection.getAccountInfo(tx.feePayer);
          if (!feePayerInfo) {
            console.error(`Fee payer account ${tx.feePayer.toString()} does not exist`);
            return {
              valid: false,
              error: `Fee payer account ${tx.feePayer.toString()} not found or has no balance`
            };
          }
          
          // Check if fee payer has sufficient balance (minimum 0.01 SOL)
          if (feePayerInfo.lamports < 10_000_000) {
            console.error(`Fee payer account ${tx.feePayer.toString()} has insufficient balance`);
            return {
              valid: false,
              error: `Fee payer account has insufficient balance (needs at least 0.01 SOL)`
            };
          }
        }

        // We no longer need to check every account in instructions
        // This was causing false negatives for program accounts
        // Just check the fee payer is sufficient
      }
      
      return { valid: true };
    } catch (error) {
      console.error("Error verifying accounts:", error);
      return {
        valid: false,
        error: error instanceof Error ? error.message : "Error verifying transaction accounts"
      };
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
      
      // Create a unique bundle ID
      const bundleId = crypto.randomUUID();
      await createBundle(bundleId, publicKey);
      console.log('Bundle created with ID:', bundleId);

      // First, verify accounts exist before any synchronization
      const accountVerification = await verifyAccounts(transactions);
      if (!accountVerification.valid) {
        console.error('Account verification failed:', accountVerification.error);
        setSimulationStatus('failed');
        await updateBundleStatus(bundleId, 'failed', { 
          error: accountVerification.error || 'Account verification failed'
        });
        
        toast({
          title: "Account Error",
          description: accountVerification.error || "One or more required accounts not found",
          variant: "destructive",
        });
        
        return transactions.map(() => ({ 
          success: false, 
          message: accountVerification.error || "Account verification failed", 
          bundleId 
        }));
      }

      // Synchronize transactions with latest blockhash
      // This already includes validation, so we don't need a separate validation step
      const synchronizedTransactionGroups = await synchronizeTransactions(transactions);
      const flattenedTransactions = synchronizedTransactionGroups.flat();
      verifyBlockhash(flattenedTransactions);
      
      console.log('Simulating full bundle with assertions...');
      const simulationResult = await jitoService.simulateTransactions(flattenedTransactions);
      
      if (!simulationResult.isValid) {
        // Now we differentiate between normal errors and malicious activity
        if (simulationResult.normalErrors) {
          console.warn('Simulation has normal errors:', simulationResult.error);
          setSimulationStatus('failed');
          await updateBundleStatus(bundleId, 'failed', { 
            error: simulationResult.error || 'Simulation failed with normal errors', 
            details: simulationResult.details,
            normalErrors: true
          });
          
          toast({
            title: "Simulation Failed",
            description: simulationResult.error || "Transaction errors detected",
            variant: "destructive",
          });
        } else {
          // This is malicious activity
          console.error('Simulation detected malicious activity:', simulationResult.error);
          setSimulationStatus('failed');
          await updateBundleStatus(bundleId, 'failed', { 
            error: simulationResult.error || 'Malicious activity detected', 
            details: simulationResult.details,
            normalErrors: false
          });
          
          toast({
            title: "Malicious Activity Detected",
            description: simulationResult.error || "Potential malicious activity detected in the bundle",
            variant: "destructive",
          });
        }
        
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
      
      // First, verify accounts exist before any synchronization
      const accountVerification = await verifyAccounts(transactions);
      if (!accountVerification.valid) {
        throw new Error(accountVerification.error || 'Account verification failed');
      }
      
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

      // Check if bundle will be valid when submitted
      const simulationResult = await jitoService.simulateTransactions(signedTransactions);
      if (!simulationResult.isValid) {
        throw new Error(`Bundle simulation failed: ${simulationResult.error}`);
      }

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
