import { 
  Bundle, 
  BundleResult, 
  SearcherClient, 
  TipAccountVersion 
} from "@jito-foundation/sdk";
import { Connection, Transaction, VersionedTransaction } from "@solana/web3.js";
import { connection } from "@/lib/solana";

class JitoService {
  private searcherClient: SearcherClient;
  private connection: Connection;

  constructor() {
    // Initialize with Jito devnet endpoint for testing
    this.searcherClient = new SearcherClient("https://api.devnet.jito.wtf");
    this.connection = connection;
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

  async submitBundle(transactions: Transaction[]): Promise<BundleResult | null> {
    try {
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
      const tipAccount = await this.searcherClient.getTipAccount(TipAccountVersion.V1);
      return tipAccount.toBase58();
    } catch (error) {
      console.error("Error getting tip account:", error);
      return null;
    }
  }
}

export const jitoService = new JitoService();