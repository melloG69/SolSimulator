
import { useCallback } from "react";
import { Transaction, ComputeBudgetProgram, PublicKey } from "@solana/web3.js";
import { connection } from "@/lib/solana";
import { useToast } from "@/hooks/use-toast";

export const useTransactionManager = (publicKey: PublicKey | null) => {
  const { toast } = useToast();

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
      const newTransaction = new Transaction().add(
        ComputeBudgetProgram.setComputeUnitLimit({
          units: 999999999,
        })
      );
      
      newTransaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      newTransaction.feePayer = publicKey;
      
      toast({
        title: "Malicious Transaction Added",
        description: "Added a transaction that will fail simulation",
        variant: "destructive",
      });

      return newTransaction;
    } catch (error) {
      console.error("Error adding malicious transaction:", error);
      toast({
        title: "Error",
        description: "Failed to add malicious transaction",
        variant: "destructive",
      });
      return null;
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
      
      toast({
        title: "Transaction Added",
        description: "New transaction has been added to the bundle",
      });

      return newTransaction;
    } catch (error) {
      console.error("Error adding transaction:", error);
      toast({
        title: "Error",
        description: "Failed to add transaction",
        variant: "destructive",
      });
      return null;
    }
  }, [toast, publicKey]);

  return {
    addTransaction,
    addMaliciousTransaction
  };
};
