
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
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

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
              toPubkey: PublicKey.default,
              lamports: balance * 2,
            })
          );
          break;

        case 'ownership':
          console.log("Creating ownership attack transaction");
          maliciousTransaction.add(
            new TransactionInstruction({
              keys: [
                { pubkey: publicKey, isSigner: true, isWritable: true },
                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: true },
              ],
              programId: SystemProgram.programId,
              data: Buffer.from([2]),
            })
          );
          break;

        case 'data':
          console.log("Creating data manipulation attack transaction");
          maliciousTransaction.add(
            new TransactionInstruction({
              keys: [
                { pubkey: publicKey, isSigner: true, isWritable: true },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: true }
              ],
              programId: SystemProgram.programId,
              data: Buffer.from([1, 2, 3, 4]),
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
