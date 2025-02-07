
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
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

export type MaliciousType = 'compute' | 'balance' | 'ownership' | 'data';

export const useTransactionManager = (publicKey: PublicKey | null) => {
  const { toast } = useToast();

  const findExistingTokenAccount = async (wallet: PublicKey) => {
    try {
      // First try USDC as it's common
      const usdcMint = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
      const usdcAccount = await getAssociatedTokenAddress(usdcMint, wallet);
      const accountInfo = await connection.getAccountInfo(usdcAccount);
      
      if (accountInfo) {
        return usdcAccount;
      }

      // If no USDC account, look for any token accounts
      const tokenAccounts = await connection.getTokenAccountsByOwner(wallet, {
        programId: TOKEN_PROGRAM_ID,
      });

      if (tokenAccounts.value.length > 0) {
        return tokenAccounts.value[0].pubkey;
      }

      // Try TOKEN_2022 accounts as fallback
      const token2022Accounts = await connection.getTokenAccountsByOwner(wallet, {
        programId: TOKEN_2022_PROGRAM_ID,
      });

      if (token2022Accounts.value.length > 0) {
        return token2022Accounts.value[0].pubkey;
      }

      return null;
    } catch (error) {
      console.error("Error finding token account:", error);
      return null;
    }
  };

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
          // Add a system transfer to ensure there's a writable account
          maliciousTransaction.add(
            SystemProgram.transfer({
              fromPubkey: publicKey,
              toPubkey: publicKey,
              lamports: 1000,
            })
          );
          maliciousTransaction.add(
            ComputeBudgetProgram.setComputeUnitLimit({
              units: 1_400_000,
            })
          );
          break;

        case 'balance':
          console.log("Creating balance drain attack transaction");
          const balance = await connection.getBalance(publicKey);
          maliciousTransaction.add(
            SystemProgram.transfer({
              fromPubkey: publicKey,
              toPubkey: SystemProgram.programId,
              lamports: balance * 2,
            })
          );
          break;

        case 'ownership':
          console.log("Creating ownership attack transaction");
          const tokenAccount = await findExistingTokenAccount(publicKey);
          
          if (!tokenAccount) {
            console.log("No token accounts found, falling back to SOL account attack");
            maliciousTransaction.add(
              SystemProgram.assign({
                accountPubkey: publicKey,
                programId: new PublicKey('11111111111111111111111111111111'),
              })
            );
          } else {
            console.log("Found token account, creating token-based attack");
            maliciousTransaction.add(
              new TransactionInstruction({
                keys: [
                  { pubkey: publicKey, isSigner: true, isWritable: true },
                  { pubkey: tokenAccount, isSigner: false, isWritable: true },
                  { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                ],
                programId: TOKEN_PROGRAM_ID,
                data: Buffer.from([3]), // Close account instruction
              })
            );
          }
          break;

        case 'data':
          console.log("Creating data manipulation attack transaction");
          maliciousTransaction.add(
            SystemProgram.assign({
              accountPubkey: publicKey,
              programId: SystemProgram.programId,
            })
          );
          break;
      }
      
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
      
      // Add a minimal SOL transfer to ensure there's a writable account
      newTransaction.add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: publicKey,
          lamports: 1000,
        })
      );
      
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

