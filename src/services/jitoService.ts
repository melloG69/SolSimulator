import { Transaction, VersionedTransaction } from "@solana/web3.js";
import { connection } from "@/lib/solana";

class JitoService {
  private connection: typeof connection;
  private readonly JITO_API_URL = "https://api.devnet.jito.wtf";

  constructor() {
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

  async submitBundle(transactions: Transaction[]): Promise<any> {
    try {
      // Convert transactions to base64 strings
      const serializedTxs = transactions.map(tx => 
        Buffer.from(tx.serialize()).toString('base64')
      );

      // Submit bundle using HTTP API
      const response = await fetch(`${this.JITO_API_URL}/bundle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactions: serializedTxs,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to submit bundle: ${response.statusText}`);
      }

      const result = await response.json();
      console.log("Bundle submitted successfully:", result);
      return result;
    } catch (error) {
      console.error("Error submitting bundle:", error);
      return null;
    }
  }

  async getTipAccount(): Promise<string | null> {
    try {
      // Get tip account using HTTP API
      const response = await fetch(`${this.JITO_API_URL}/tip-accounts`);
      
      if (!response.ok) {
        throw new Error(`Failed to get tip account: ${response.statusText}`);
      }

      const { tipAccounts } = await response.json();
      return tipAccounts[0] || null;
    } catch (error) {
      console.error("Error getting tip account:", error);
      return null;
    }
  }
}

export const jitoService = new JitoService();