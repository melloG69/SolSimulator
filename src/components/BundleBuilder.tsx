import { useState, useCallback } from "react";
import { connection } from "@/lib/solana";
import { Transaction, PublicKey, ComputeBudgetProgram } from "@solana/web3.js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, XCircle, AlertTriangle, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { jitoService } from "@/services/jitoService";

const BundleBuilder = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [simulationStatus, setSimulationStatus] = useState<'idle' | 'success' | 'failed'>('idle');
  const [executionStatus, setExecutionStatus] = useState<'idle' | 'success' | 'failed'>('idle');
  const { toast } = useToast();
  const { publicKey, signTransaction, connected } = useWallet();

  const setWalletContext = async (walletAddress: string) => {
    try {
      console.log('Setting wallet context for:', walletAddress);
      const { error } = await supabase.rpc('set_wallet_context', { wallet: walletAddress });
      if (error) {
        console.error("Error setting wallet context:", error);
        throw error;
      }
      console.log('Wallet context set successfully');
    } catch (error) {
      console.error("Error in setWalletContext:", error);
      throw error;
    }
  };

  // Demo function to simulate malicious transaction
  const addMaliciousTransaction = useCallback(async () => {
    if (!publicKey) {
      toast({
        title: "Error",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    try {
      // Creating an invalid transaction for demo purposes
      const newTransaction = new Transaction().add(
        ComputeBudgetProgram.setComputeUnitLimit({
          units: 999999999, // Intentionally high for demo
        })
      );
      
      newTransaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      newTransaction.feePayer = publicKey;
      
      setTransactions(prev => [...prev, newTransaction]);
      
      toast({
        title: "Malicious Transaction Added",
        description: "Added a transaction that will fail simulation",
        variant: "destructive",
      });
    } catch (error) {
      console.error("Error adding malicious transaction:", error);
      toast({
        title: "Error",
        description: "Failed to add malicious transaction",
        variant: "destructive",
      });
    }
  }, [toast, publicKey]);

  const addTransaction = useCallback(async () => {
    if (!publicKey) {
      toast({
        title: "Error",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    try {
      const newTransaction = new Transaction().add(
        ComputeBudgetProgram.setComputeUnitLimit({
          units: 200_000,
        })
      );
      
      newTransaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      newTransaction.feePayer = publicKey;
      
      setTransactions(prev => [...prev, newTransaction]);
      
      toast({
        title: "Transaction Added",
        description: "New transaction has been added to the bundle",
      });
    } catch (error) {
      console.error("Error adding transaction:", error);
      toast({
        title: "Error",
        description: "Failed to add transaction",
        variant: "destructive",
      });
    }
  }, [toast, publicKey]);

  const simulateBundle = async () => {
    if (!publicKey) {
      toast({
        title: "Error",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      console.log('Starting bundle simulation for wallet:', publicKey.toString());
      
      // Set wallet context before any database operations
      await setWalletContext(publicKey.toString());
      console.log('Wallet context set, proceeding with bundle creation');
      
      const bundleId = crypto.randomUUID();
      
      const { error: insertError } = await supabase.from('transaction_bundles').insert({
        id: bundleId,
        wallet_address: publicKey.toString(),
        status: 'pending'
      });

      if (insertError) {
        console.error("Insert error:", insertError);
        throw new Error(`Failed to insert bundle: ${insertError.message}`);
      }

      console.log('Bundle created successfully, proceeding with validation');

      // Use Jito service to validate transactions
      const isValid = await jitoService.validateTransactions(transactions);
      
      if (!isValid) {
        setSimulationStatus('failed');
        const { error: updateError } = await supabase.from('transaction_bundles').update({
          status: 'failed',
          simulation_result: { error: 'Bundle validation failed' }
        }).eq('id', bundleId);

        if (updateError) {
          console.error("Update error:", updateError);
          throw new Error(`Failed to update simulation result: ${updateError.message}`);
        }

        toast({
          title: "Simulation Failed",
          description: "Malicious activity detected in the bundle",
          variant: "destructive",
        });
        return;
      }

      setSimulationStatus('success');
      const { error: updateError } = await supabase.from('transaction_bundles').update({
        status: 'simulated',
        simulation_result: { success: true }
      }).eq('id', bundleId);

      if (updateError) {
        console.error("Update error:", updateError);
        throw new Error(`Failed to update simulation result: ${updateError.message}`);
      }

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
    }
    setLoading(false);
  };

  const executeBundle = async () => {
    if (!publicKey || !signTransaction) {
      toast({
        title: "Error",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await setWalletContext(publicKey.toString());
      
      // Sign all transactions
      const signedTransactions = await Promise.all(
        transactions.map(tx => signTransaction(tx))
      );

      // Submit bundle using Jito service
      const bundleResult = await jitoService.submitBundle(
        signedTransactions.map(tx => Transaction.from(tx.serialize()))
      );

      if (!bundleResult) {
        throw new Error("Failed to submit bundle to Jito");
      }

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
    }
    setLoading(false);
  };

  return (
    <div className="container mx-auto p-4">
      <div className="bg-card rounded-lg p-6 shadow-lg">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-mono text-primary">Jito Bundle Guardrail</h1>
            <p className="text-sm text-muted-foreground mt-1">Demo Version with Transaction Validation</p>
          </div>
          <WalletMultiButton />
        </div>
        
        <div className="space-y-4">
          {connected && publicKey && (
            <div className="bg-black/50 p-4 rounded-md">
              <h2 className="text-secondary font-mono mb-2">Connected Wallet</h2>
              <p className="font-mono text-sm text-white/70">{publicKey.toString()}</p>
            </div>
          )}

          {simulationStatus === 'failed' && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Malicious Activity Detected</AlertTitle>
              <AlertDescription>
                The bundle simulation detected potentially harmful transactions.
              </AlertDescription>
            </Alert>
          )}

          {simulationStatus === 'success' && (
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertTitle>Bundle Validated</AlertTitle>
              <AlertDescription>
                All transactions in the bundle passed security checks.
              </AlertDescription>
            </Alert>
          )}

          <div className="bg-black/50 p-4 rounded-md">
            <h2 className="text-secondary font-mono mb-2">Transaction Bundle</h2>
            <div className="space-y-2">
              {transactions.map((tx, index) => (
                <div key={index} className="bg-black/30 p-2 rounded flex items-center justify-between">
                  <code className="text-xs text-white/70">Transaction {index + 1}</code>
                  {executionStatus !== 'idle' && (
                    executionStatus === 'success' 
                      ? <CheckCircle className="h-4 w-4 text-green-500" />
                      : <XCircle className="h-4 w-4 text-red-500" />
                  )}
                </div>
              ))}
              <div className="flex gap-2">
                <Button
                  onClick={addTransaction}
                  variant="outline"
                  className="flex-1"
                  disabled={loading || !connected}
                >
                  Add Valid Transaction
                </Button>
                <Button
                  onClick={addMaliciousTransaction}
                  variant="outline"
                  className="flex-1"
                  disabled={loading || !connected}
                >
                  Add Malicious Transaction
                </Button>
              </div>
            </div>
          </div>

          <div className="flex space-x-4">
            <Button
              onClick={simulateBundle}
              disabled={loading || transactions.length === 0 || !connected}
              className="flex-1"
              variant="secondary"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Simulate Bundle
            </Button>
            <Button
              onClick={executeBundle}
              disabled={loading || transactions.length === 0 || !connected || simulationStatus === 'failed'}
              className="flex-1"
              variant="default"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Execute Bundle
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BundleBuilder;