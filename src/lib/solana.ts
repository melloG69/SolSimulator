
import { Connection, PublicKey, Transaction, VersionedTransaction, Cluster } from "@solana/web3.js";

// API Keys
export const HELIUS_API_KEY = "31befc63-acf8-4929-b0c6-21f5177679aa";

// RPC Endpoints
const RPC_ENDPOINTS = {
  mainnet: `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`,
  devnet: "https://api.devnet.solana.com",
  testnet: "https://api.testnet.solana.com",
  localnet: "http://localhost:8899"
};

// Determine which network to use - default to devnet for development
// In a production app, you might want to read this from an environment variable
const SOLANA_CLUSTER: Cluster = 
  (import.meta.env.VITE_SOLANA_CLUSTER as Cluster) || 
  (process.env.NODE_ENV === 'production' ? 'mainnet' : 'devnet');

console.log(`Using Solana ${SOLANA_CLUSTER} network`);

// Get the appropriate RPC endpoint
const getRpcEndpoint = (cluster: Cluster): string => {
  return RPC_ENDPOINTS[cluster as keyof typeof RPC_ENDPOINTS] || RPC_ENDPOINTS.devnet;
};

const rpcEndpoint = getRpcEndpoint(SOLANA_CLUSTER);

// Initialize connection with appropriate configuration
export const connection = new Connection(rpcEndpoint, {
  commitment: "confirmed",
  confirmTransactionInitialTimeout: 120000, // 120 second timeout
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
