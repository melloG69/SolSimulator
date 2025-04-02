
import { Connection, PublicKey, Transaction, VersionedTransaction, Cluster } from "@solana/web3.js";

// Create an extended type for Cluster that includes our custom values
export type ExtendedCluster = Cluster | "mainnet" | "localnet";

// API Keys
export const HELIUS_API_KEY = "31befc63-acf8-4929-b0c6-21f5177679aa";

// RPC Endpoints with fallbacks to ensure wallet connectivity
const RPC_ENDPOINTS: Record<ExtendedCluster, string> = {
  "mainnet-beta": `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`,
  mainnet: `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`,
  devnet: "https://api.devnet.solana.com",
  testnet: "https://api.testnet.solana.com",
  localnet: "http://localhost:8899"
};

// Public RPC endpoints as fallbacks (more likely to work with wallets)
const PUBLIC_FALLBACK_ENDPOINTS = [
  "https://api.mainnet-beta.solana.com",
  "https://solana-mainnet.g.alchemy.com/v2/demo",
  "https://rpc.ankr.com/solana"
];

// Force use of mainnet-beta regardless of environment
const SOLANA_CLUSTER: ExtendedCluster = 'mainnet-beta';

console.log(`Using Solana ${SOLANA_CLUSTER} network (Mainnet-only mode)`);

// Get the appropriate RPC endpoint
const getRpcEndpoint = (cluster: ExtendedCluster): string => {
  // For wallet compatibility, prefer Helius but allow fallback to public RPCs
  return RPC_ENDPOINTS[cluster]; 
};

export const rpcEndpoint = getRpcEndpoint(SOLANA_CLUSTER);

// Initialize connection with appropriate configuration
export const connection = new Connection(rpcEndpoint, {
  commitment: "confirmed",
  confirmTransactionInitialTimeout: 120000, // 120 second timeout
});

// Fallback function to get an alternative connection if primary fails
export const getFallbackConnection = (): Connection => {
  // Use a random public endpoint for fallback
  const randomFallback = PUBLIC_FALLBACK_ENDPOINTS[
    Math.floor(Math.random() * PUBLIC_FALLBACK_ENDPOINTS.length)
  ];
  
  return new Connection(randomFallback, {
    commitment: "confirmed",
    confirmTransactionInitialTimeout: 120000
  });
};

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
