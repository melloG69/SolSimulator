
import { Connection, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";

// Initialize connection with mainnet RPC URL
export const HELIUS_API_KEY = "31befc63-acf8-4929-b0c6-21f5177679aa";
export const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

// Initialize connection with robust configuration for mainnet
export const connection = new Connection(HELIUS_RPC, {
  commitment: "confirmed",
  confirmTransactionInitialTimeout: 120000, // 120 second timeout for mainnet
});

// Export utility functions for transaction handling
export const signAndSendTransaction = async (transaction: Transaction | VersionedTransaction) => {
  try {
    if (transaction instanceof Transaction) {
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
