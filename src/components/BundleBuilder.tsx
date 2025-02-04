import { useState, useCallback } from "react";
import { connection } from "@/lib/solana";
import { Transaction, PublicKey, ComputeBudgetProgram, VersionedTransaction } from "@solana/web3.js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, XCircle, AlertTriangle, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

const BundleBuilder = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [simulationStatus, setSimulationStatus] = useState<'idle' | 'success' | 'failed'>('idle');
  const [executionStatus, setExecutionStatus] = useState<'idle' | 'success' | 'failed'>('idle');
  const { toast } = useToast();
  const { publicKey, signTransaction, connected } = useWallet();

  const setWalletContext = async (walletAddress: string) => {
    await supabase.rpc('set_wallet_context', { wallet: walletAddress });
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
      await setWalletContext(publicKey.toString());
      const bundleId = crypto.randomUUID();
      
      const { error: insertError } = await supabase.from('transaction_bundles').insert({
        id: bundleId,
        wallet_address: publicKey.toString(),
        status: 'pending'
      });

      if (insertError) {
        throw new Error(`Failed to insert bundle: ${insertError.message}`);
      }

      let hasFailedSimulation = false;
      for (const tx of transactions) {
        const simulation = await connection.simulateTransaction(tx);
        
        if (simulation.value.err) {
          hasFailedSimulation = true;
        }
        
        const serializedSimulation = {
          err: simulation.value.err,
          logs: simulation.value.logs,
          unitsConsumed: simulation.value.unitsConsumed,
          accounts: simulation.value.accounts?.map(acc => acc?.toString()),
        };
        
        const { error: updateError } = await supabase.from('transaction_bundles').update({
          simulation_result: serializedSimulation,
          status: simulation.value.err ? 'failed' : 'simulated'
        }).eq('id', bundleId);

        if (updateError) {
          throw new Error(`Failed to update simulation result: ${updateError.message}`);
        }
      }

      setSimulationStatus(hasFailedSimulation ? 'failed' : 'success');
      toast({
        title: hasFailedSimulation ? "Simulation Failed" : "Simulation Complete",
        description: hasFailedSimulation 
          ? "Malicious activity detected in the bundle" 
          : "Bundle has been successfully simulated",
        variant: hasFailedSimulation ? "destructive" : "default",
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
      const signedTransactions = await Promise.all(
        transactions.map(async (tx) => {
          const signed = await signTransaction(tx);
          return VersionedTransaction.deserialize(signed.serialize());
        })
      );

      console.log("Executing bundle...");
      
      let hasFailedExecution = false;
      for (const tx of signedTransactions) {
        try {
          const signature = await connection.sendTransaction(tx);
          console.log("Transaction signature:", signature);
        } catch (error) {
          hasFailedExecution = true;
          console.error("Transaction execution failed:", error);
        }
      }

      setExecutionStatus(hasFailedExecution ? 'failed' : 'success');
      toast({
        title: hasFailedExecution ? "Execution Failed" : "Success",
        description: hasFailedExecution 
          ? "Some transactions in the bundle failed" 
          : "Bundle executed successfully",
        variant: hasFailedExecution ? "destructive" : "default",
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