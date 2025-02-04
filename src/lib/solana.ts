import { Connection, PublicKey, Keypair, Transaction, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";

// Initialize connection with commitment level
export const HELIUS_RPC = "https://devnet.helius-rpc.com/?api-key=31befc63-acf8-4929-b0c6-21f5177679aa";
export const connection = new Connection(HELIUS_RPC, "confirmed");

// Initialize wallet from private key
const privateKeyBytes = bs58.decode("593S1M6FJ5ZFXwKThzmSu1rR5xkjkDqZwULWbUg5ruesVWMAvVSfStzXAd8GYE5XXmPkseKdAPP96stZr45vU1Wp");
export const wallet = Keypair.fromSecretKey(privateKeyBytes);

// Export utility functions
export const signAndSendTransaction = async (transaction: Transaction | VersionedTransaction) => {
  try {
    if (transaction instanceof Transaction) {
      transaction.sign(wallet);
      const serializedMessage = transaction.serialize();
      const versionedTx = VersionedTransaction.deserialize(serializedMessage);
      return await connection.sendTransaction(versionedTx);
    } else {
      return await connection.sendTransaction(transaction);
    }
  } catch (error) {
    console.error("Error sending transaction:", error);
    throw error;
  }
};