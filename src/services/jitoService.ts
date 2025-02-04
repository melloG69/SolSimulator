import { Transaction, VersionedTransaction } from "@solana/web3.js";
import { connection } from "@/lib/solana";

// Dynamic import for Jito SDK to handle ESM/CJS compatibility
const getJitoSDK = async () => {
  try {
    const jitoSDK = await import('@jito-foundation/sdk');
    return {
      Bundle: jitoSDK.Bundle,
      SearcherClient: jitoSDK.SearcherClient,
      TipAccountVersion: jitoSDK.TipAccountVersion,
    };
  } catch (error) {
    console.error("Error importing Jito SDK:", error);
    throw error;
  }
};

class JitoService {
  private searcherClient: any;
  private connection: typeof connection;

  constructor() {
    this.connection = connection;
    this.initializeClient();
  }

  private async initializeClient() {
    try {
      const { SearcherClient } = await getJitoSDK();
      // Initialize with Jito devnet endpoint for testing
      this.searcherClient = new SearcherClient("https://api.devnet.jito.wtf");
    } catch (error) {
      console.error("Error initializing Jito client:", error);
    }
  }

  async validateTransactions(transactions: Transaction[]): Promise<boolean> {
    try {
      // Simulate each transaction using Jito's validation rules
      for (const tx of transactions) {
        const simulation = await this.connection.simulateTransaction(tx);
        if (simulation.value.err) {
          console.error("Transaction validation failed:", simulation.value.err);
          return false;
        }
      }
      return true;
    } catch (error) {
      console.error("Error validating transactions:", error);
      return false;
    }
  }

  async submitBundle(transactions: Transaction[]): Promise<any> {
    try {
      const { Bundle } = await getJitoSDK();
      
      // Convert transactions to VersionedTransaction format
      const versionedTxs = await Promise.all(
        transactions.map(async (tx) => {
          const serialized = tx.serialize();
          return VersionedTransaction.deserialize(serialized);
        })
      );

      // Create a new bundle
      const bundle = new Bundle(versionedTxs);

      // Submit the bundle to Jito
      const result = await this.searcherClient.sendBundle(bundle);
      console.log("Bundle submitted successfully:", result);
      return result;
    } catch (error) {
      console.error("Error submitting bundle:", error);
      return null;
    }
  }

  async getTipAccount(): Promise<string | null> {
    try {
      const { TipAccountVersion } = await getJitoSDK();
      const tipAccount = await this.searcherClient.getTipAccount(TipAccountVersion.V1);
      return tipAccount.toBase58();
    } catch (error) {
      console.error("Error getting tip account:", error);
      return null;
    }
  }
}

export const jitoService = new JitoService();