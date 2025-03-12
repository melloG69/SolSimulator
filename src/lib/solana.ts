import { Connection, PublicKey, Transaction, VersionedTransaction, Cluster } from "@solana/web3.js";

// Create an extended type for Cluster that includes our custom values
export type ExtendedCluster = Cluster | "mainnet" | "localnet";

// API Keys
export const HELIUS_API_KEY = "31befc63-acf8-4929-b0c6-21f5177679aa";

// RPC Endpoints
const RPC_ENDPOINTS: Record<ExtendedCluster, string> = {
  "mainnet-beta": `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`,
  mainnet: `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`,
  devnet: "https://api.devnet.solana.com",
  testnet: "https://api.testnet.solana.com",
  localnet: "http://localhost:8899"
};

// Determine which network to use - default to mainnet-beta for production
const SOLANA_CLUSTER: ExtendedCluster = 
  (import.meta.env.VITE_SOLANA_CLUSTER as ExtendedCluster) || 
  (process.env.NODE_ENV === 'production' ? 'mainnet-beta' : 'devnet');

console.log(`Using Solana ${SOLANA_CLUSTER} network`);

// Get the appropriate RPC endpoint
const getRpcEndpoint = (cluster: ExtendedCluster): string => {
  // If cluster is 'mainnet', use 'mainnet-beta' endpoint
  if (cluster === 'mainnet') {
    return RPC_ENDPOINTS['mainnet-beta'];
  }
  return RPC_ENDPOINTS[cluster] || RPC_ENDPOINTS['mainnet-beta'];
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
