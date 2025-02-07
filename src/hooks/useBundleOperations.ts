
import { Transaction } from "@solana/web3.js";
import { jitoService } from "@/services/jitoService";
import { useToast } from "@/hooks/use-toast";
import { setWalletContext, createBundle, updateBundleStatus } from "@/utils/supabaseUtils";
import { connection } from "@/lib/solana";

export const useBundleOperations = () => {
  const { toast } = useToast();

  const synchronizeTransactions = async (transactions: Transaction[]) => {
    try {
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      
      return transactions.map(tx => {
        tx.recentBlockhash = blockhash;
        tx.lastValidBlockHeight = lastValidBlockHeight;
        return tx;
      });
    } catch (error) {
      console.error("Error synchronizing transactions:", error);
      throw error;
    }
  };

  const simulateBundle = async (
    transactions: Transaction[],
    publicKey: string,
    setLoading: (loading: boolean) => void,
    setSimulationStatus: (status: 'idle' | 'success' | 'failed') => void
  ) => {
    if (transactions.length === 0) {
      toast({
        title: "Error",
        description: "No transactions to simulate",
        variant: "destructive",
      });
      return;
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

      // Synchronize all transactions with the same blockhash
      const synchronizedTransactions = await synchronizeTransactions(transactions);
      console.log('Transactions synchronized with same blockhash');

      const isValid = await jitoService.validateTransactions(synchronizedTransactions);
      
      if (!isValid) {
        setSimulationStatus('failed');
        await updateBundleStatus(bundleId, 'failed', { error: 'Bundle validation failed' });

        toast({
          title: "Simulation Failed",
          description: "Malicious activity detected in the bundle",
          variant: "destructive",
        });
        return;
      }

      setSimulationStatus('success');
      await updateBundleStatus(bundleId, 'simulated', { success: true });

      toast({
        title: "Simulation Complete",
        description: "Bundle has been successfully simulated",
      });
    } catch (error) {
      console.error("Simulation error:", error);
      setSimulationStatus('failed');
      toast({
        title: "Simulation Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
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
  ) => {
    if (!signTransaction) {
      toast({
        title: "Error",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    if (transactions.length === 0) {
      toast({
        title: "Error",
        description: "No transactions to execute",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setExecutionStatus('idle');
    
    try {
      await setWalletContext(publicKey);
      
      // Synchronize all transactions before signing
      const synchronizedTransactions = await synchronizeTransactions(transactions);
      
      console.log("Signing transactions...");
      const signedTransactions = await Promise.all(
        synchronizedTransactions.map(tx => signTransaction(tx))
      );

      console.log("Submitting bundle to Jito...");
      await jitoService.submitBundle(
        signedTransactions.map(tx => Transaction.from(tx.serialize()))
      );

      setExecutionStatus('success');
      toast({
        title: "Success",
        description: "Bundle executed successfully via Jito",
      });
    } catch (error) {
      console.error("Execution error:", error);
      setExecutionStatus('failed');
      toast({
        title: "Execution Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    simulateBundle,
    executeBundle
  };
};
