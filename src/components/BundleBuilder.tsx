import { useState, useCallback } from "react";
import { connection, wallet } from "@/lib/solana";
import { Transaction, TransactionInstruction, PublicKey, ComputeBudgetProgram, VersionedTransaction } from "@solana/web3.js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const BundleBuilder = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const addTransaction = useCallback(async () => {
    try {
      // Create a simple transfer transaction as an example
      const newTransaction = new Transaction().add(
        ComputeBudgetProgram.setComputeUnitLimit({
          units: 200_000,
        })
      );
      
      // Add required recent blockhash
      newTransaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      newTransaction.feePayer = wallet.publicKey;
      
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
  }, [toast]);

  const simulateBundle = async () => {
    setLoading(true);
    try {
      const bundleId = crypto.randomUUID();
      
      // Create bundle entry in Supabase
      await supabase.from('transaction_bundles').insert({
        id: bundleId,
        wallet_address: wallet.publicKey.toString(),
        status: 'pending'
      });

      // Simulate each transaction in the bundle
      for (const tx of transactions) {
        const simulation = await connection.simulateTransaction(tx);
        console.log("Simulation result:", simulation);
        
        // Serialize the simulation result before storing
        const serializedSimulation = {
          err: simulation.value.err,
          logs: simulation.value.logs,
          unitsConsumed: simulation.value.unitsConsumed,
          accounts: simulation.value.accounts?.map(acc => acc?.toString()),
        };
        
        // Update simulation results in Supabase
        await supabase.from('transaction_bundles').update({
          simulation_result: serializedSimulation,
          status: 'simulated'
        }).eq('id', bundleId);
      }

      toast({
        title: "Simulation Complete",
        description: "Bundle has been successfully simulated",
      });
    } catch (error) {
      console.error("Simulation error:", error);
      toast({
        title: "Simulation Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const executeBundle = async () => {
    setLoading(true);
    try {
      // Sign and convert to versioned transactions
      const signedTransactions = await Promise.all(
        transactions.map(async (tx) => {
          tx.sign(wallet);
          const serializedMessage = tx.serialize();
          return VersionedTransaction.deserialize(serializedMessage);
        })
      );

      // Execute bundle
      console.log("Executing bundle...");
      
      // Here we would integrate with Jito's bundle service
      // For now, we'll execute transactions sequentially
      for (const tx of signedTransactions) {
        const signature = await connection.sendTransaction(tx);
        console.log("Transaction signature:", signature);
      }

      toast({
        title: "Success",
        description: "Bundle executed successfully",
      });
    } catch (error) {
      console.error("Execution error:", error);
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
        <h1 className="text-2xl font-mono text-primary mb-6">Jito Bundle Guardrail</h1>
        
        <div className="space-y-4">
          <div className="bg-black/50 p-4 rounded-md">
            <h2 className="text-secondary font-mono mb-2">Connected Wallet</h2>
            <p className="font-mono text-sm text-white/70">{wallet.publicKey.toString()}</p>
          </div>

          <div className="bg-black/50 p-4 rounded-md">
            <h2 className="text-secondary font-mono mb-2">Transaction Bundle</h2>
            <div className="space-y-2">
              {transactions.map((tx, index) => (
                <div key={index} className="bg-black/30 p-2 rounded">
                  <code className="text-xs text-white/70">Transaction {index + 1}</code>
                </div>
              ))}
              <Button
                onClick={addTransaction}
                variant="outline"
                className="w-full mt-2"
                disabled={loading}
              >
                Add Transaction
              </Button>
            </div>
          </div>

          <div className="flex space-x-4">
            <Button
              onClick={simulateBundle}
              disabled={loading || transactions.length === 0}
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
              disabled={loading || transactions.length === 0}
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