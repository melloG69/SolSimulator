
import { useCallback } from "react";
import { 
  Transaction, 
  ComputeBudgetProgram, 
  PublicKey, 
  SystemProgram,
} from "@solana/web3.js";
import { connection } from "@/lib/solana";
import { useToast } from "@/hooks/use-toast";

export type MaliciousType = 'compute';

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
      const maliciousTransaction = new Transaction();
      
      // Add a system transfer to ensure there's a writable account
      maliciousTransaction.add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: publicKey,
          lamports: 1000,
        })
      );

      // Add high compute units instruction
      maliciousTransaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({
          units: 1_400_000,
        })
      );
      
      maliciousTransaction.feePayer = publicKey;
      
      toast({
        title: "High Compute Attack Added",
        description: "Added a transaction that will be caught by Lighthouse",
        variant: "destructive",
      });

      return maliciousTransaction;
    } catch (error) {
      console.error("Error adding malicious transaction:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add malicious transaction",
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
      const newTransaction = new Transaction();
      
      // Add a minimal SOL transfer
      newTransaction.add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: publicKey,
          lamports: 1000,
        })
      );
      
      // Add reasonable compute units
      newTransaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({
          units: 200_000,
        })
      );
      
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
