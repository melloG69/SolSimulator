import { useState, useCallback } from "react";
import { connection } from "@/lib/solana";
import { Transaction, PublicKey, ComputeBudgetProgram, VersionedTransaction } from "@solana/web3.js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

const BundleBuilder = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { publicKey, signTransaction, connected } = useWallet();

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
      const bundleId = crypto.randomUUID();
      
      const { error: insertError } = await supabase.from('transaction_bundles').insert({
        id: bundleId,
        wallet_address: publicKey.toString(),
        status: 'pending'
      });

      if (insertError) {
        throw new Error(`Failed to insert bundle: ${insertError.message}`);
      }

      for (const tx of transactions) {
        const simulation = await connection.simulateTransaction(tx);
        
        const serializedSimulation = {
          err: simulation.value.err,
          logs: simulation.value.logs,
          unitsConsumed: simulation.value.unitsConsumed,
          accounts: simulation.value.accounts?.map(acc => acc?.toString()),
        };
        
        const { error: updateError } = await supabase.from('transaction_bundles').update({
          simulation_result: serializedSimulation,
          status: 'simulated'
        }).eq('id', bundleId);

        if (updateError) {
          throw new Error(`Failed to update simulation result: ${updateError.message}`);
        }
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
      const signedTransactions = await Promise.all(
        transactions.map(async (tx) => {
          const signed = await signTransaction(tx);
          return VersionedTransaction.deserialize(signed.serialize());
        })
      );

      console.log("Executing bundle...");
      
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
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-mono text-primary">Jito Bundle Guardrail</h1>
          <WalletMultiButton />
        </div>
        
        <div className="space-y-4">
          {connected && publicKey && (
            <div className="bg-black/50 p-4 rounded-md">
              <h2 className="text-secondary font-mono mb-2">Connected Wallet</h2>
              <p className="font-mono text-sm text-white/70">{publicKey.toString()}</p>
            </div>
          )}

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
                disabled={loading || !connected}
              >
                Add Transaction
              </Button>
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
              disabled={loading || transactions.length === 0 || !connected}
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