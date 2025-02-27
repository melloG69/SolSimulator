
import { useCallback } from "react";
import { 
  Transaction, 
  ComputeBudgetProgram, 
  PublicKey, 
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { useToast } from "@/hooks/use-toast";
import { connection } from "@/lib/solana";

// Use a well-known address (Solana Foundation) as a default recipient
// This ensures the account exists and avoids "ProgramAccountNotFound" errors
const DEFAULT_RECIPIENT = new PublicKey("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

export const useTransactionManager = (publicKey: PublicKey | null) => {
  const { toast } = useToast();

  // Helper function to verify an account exists
  const verifyAccountExists = useCallback(async (address: PublicKey): Promise<boolean> => {
    try {
      const accountInfo = await connection.getAccountInfo(address);
      return accountInfo !== null;
    } catch (error) {
      console.error("Error checking account existence:", error);
      return false;
    }
  }, []);

  // Helper to get minimum amount for a valid transfer
  const getMinimumTransferAmount = useCallback(async (): Promise<number> => {
    // Minimum amount for rent exemption (enough to avoid account closure)
    try {
      const rentExemptBalance = await connection.getMinimumBalanceForRentExemption(0);
      // Use a small amount that won't risk depleting the account
      return Math.min(rentExemptBalance / 10, 5000);
    } catch (error) {
      console.error("Error getting minimum balance:", error);
      return 5000; // Default small amount in lamports
    }
  }, []);

  const addMaliciousTransaction = useCallback(async () => {
    if (!publicKey) {
      toast({
        title: "Error",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return null;
    }

    try {
      // Verify the wallet account exists before proceeding
      const accountExists = await verifyAccountExists(publicKey);
      if (!accountExists) {
        toast({
          title: "Account Error",
          description: "Your wallet account doesn't exist on-chain or has no SOL balance",
          variant: "destructive",
        });
        return null;
      }

      const minimumAmount = await getMinimumTransferAmount();
      const maliciousTransaction = new Transaction();
      
      // Add a system transfer to a known recipient
      maliciousTransaction.add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: DEFAULT_RECIPIENT, // Use a valid recipient that exists
          lamports: minimumAmount,
        })
      );

      // Add high compute units instruction (this is what makes it "malicious")
      maliciousTransaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({
          units: 1_400_000, // Excessively high compute units
        })
      );
      
      maliciousTransaction.feePayer = publicKey;
      
      toast({
        title: "High Compute Attack Added",
        description: "Added a transaction that will be caught by Lighthouse",
        variant: "destructive",
      });

      console.log("Created malicious transaction with high compute units");
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
  }, [toast, publicKey, verifyAccountExists, getMinimumTransferAmount]);

  const addTransaction = useCallback(async () => {
    if (!publicKey) {
      toast({
        title: "Error",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return null;
    }

    try {
      // Verify the wallet account exists before proceeding
      const accountExists = await verifyAccountExists(publicKey);
      if (!accountExists) {
        toast({
          title: "Account Error",
          description: "Your wallet account doesn't exist on-chain or has no SOL balance",
          variant: "destructive",
        });
        return null;
      }

      const minimumAmount = await getMinimumTransferAmount();
      const newTransaction = new Transaction();
      
      // Add a minimal SOL transfer to a known recipient
      newTransaction.add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: DEFAULT_RECIPIENT, // Use a valid recipient that exists
          lamports: minimumAmount,
        })
      );
      
      // Add a reasonable compute budget to ensure transaction passes validation
      newTransaction.add(
        ComputeBudgetProgram.setComputeUnitLimit({
          units: 200_000, // Reasonable compute units
        })
      );
      
      newTransaction.feePayer = publicKey;
      
      toast({
        title: "Transaction Added",
        description: "New transaction has been added to the bundle",
      });

      console.log("Created valid transaction with reasonable compute units");
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
  }, [toast, publicKey, verifyAccountExists, getMinimumTransferAmount]);

  return {
    addTransaction,
    addMaliciousTransaction
  };
};
