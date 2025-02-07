
import { useCallback } from "react";
import { 
  Transaction, 
  ComputeBudgetProgram, 
  PublicKey, 
  SystemProgram,
  LAMPORTS_PER_SOL,
  TransactionInstruction
} from "@solana/web3.js";
import { connection } from "@/lib/solana";
import { useToast } from "@/hooks/use-toast";
import { TOKEN_PROGRAM_ID, createInitializeAccountInstruction } from "@solana/spl-token";

export type MaliciousType = 'compute' | 'balance' | 'ownership' | 'data';

export const useTransactionManager = (publicKey: PublicKey | null) => {
  const { toast } = useToast();

  const addMaliciousTransaction = useCallback(async (type: MaliciousType = 'compute') => {
    if (!publicKey) {
      toast({
        title: "Error",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    try {
      let maliciousTransaction = new Transaction();
      
      switch (type) {
        case 'compute':
          console.log("Creating high compute units attack transaction");
          maliciousTransaction.add(
            ComputeBudgetProgram.setComputeUnitLimit({
              units: 1_400_000, // Mainnet compute unit limit
            })
          );
          break;

        case 'balance':
          console.log("Creating balance drain attack transaction");
          const balance = await connection.getBalance(publicKey);
          maliciousTransaction.add(
            SystemProgram.transfer({
              fromPubkey: publicKey,
              toPubkey: new PublicKey('11111111111111111111111111111111'),
              lamports: balance * 2, // Attempting to transfer more than available
            })
          );
          break;

        case 'ownership':
          console.log("Creating ownership attack transaction");
          // Create a malicious ownership attack by attempting to initialize
          // a token account with incorrect owner
          const maliciousOwner = new PublicKey('11111111111111111111111111111111');
          maliciousTransaction.add(
            new TransactionInstruction({
              keys: [
                { pubkey: publicKey, isSigner: true, isWritable: true },
                { pubkey: maliciousOwner, isSigner: false, isWritable: false },
                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
              ],
              programId: TOKEN_PROGRAM_ID,
              // Attempting to create invalid token instruction
              data: Buffer.from([1]), 
            })
          );
          break;

        case 'data':
          console.log("Creating data manipulation attack transaction");
          // Attempt to manipulate system program data (which should fail)
          maliciousTransaction.add(
            new TransactionInstruction({
              keys: [
                { pubkey: publicKey, isSigner: true, isWritable: true },
                { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: true },
              ],
              programId: SystemProgram.programId,
              // Invalid system program instruction
              data: Buffer.from([255, 255, 255, 255]), 
            })
          );
          break;
      }
      
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      maliciousTransaction.recentBlockhash = blockhash;
      maliciousTransaction.lastValidBlockHeight = lastValidBlockHeight;
      maliciousTransaction.feePayer = publicKey;
      
      toast({
        title: "Malicious Transaction Added",
        description: `Added a ${type} attack transaction that will be caught by Lighthouse`,
        variant: "destructive",
      });

      return maliciousTransaction;
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
          units: 200_000, // Safe compute unit limit for mainnet
        })
      );
      
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      newTransaction.recentBlockhash = blockhash;
      newTransaction.lastValidBlockHeight = lastValidBlockHeight;
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
