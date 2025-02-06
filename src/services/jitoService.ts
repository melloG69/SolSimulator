
import { Transaction } from "@solana/web3.js";
import { connection } from "@/lib/solana";
import { Buffer } from 'buffer';

class JitoService {
  private connection: typeof connection;
  private readonly JITO_API_URL = "https://api.jito.wtf";  // Updated to correct Jito devnet endpoint

  constructor() {
    this.connection = connection;
  }

  async validateTransactions(transactions: Transaction[]): Promise<boolean> {
    if (!transactions || transactions.length === 0) {
      console.log("No transactions to validate");
      return false;
    }

    try {
      for (const tx of transactions) {
        console.log("Simulating transaction:", tx);
        const simulation = await this.connection.simulateTransaction(tx);
        if (simulation.value.err) {
          console.error("Transaction validation failed:", simulation.value.err);
          return false;
        }
      }
      console.log("All transactions validated successfully");
      return true;
    } catch (error) {
      console.error("Error validating transactions:", error);
      return false;
    }
  }

  async submitBundle(transactions: Transaction[]): Promise<any> {
    if (!transactions || transactions.length === 0) {
      throw new Error("No transactions provided for bundle submission");
    }

    try {
      console.log("Preparing transactions for bundle submission");
      const serializedTxs = transactions.map(tx => {
        const serialized = tx.serialize();
        return Buffer.from(serialized).toString('base64');
      });

      console.log("Submitting bundle to Jito API:", `${this.JITO_API_URL}/bundle`);
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
        const errorText = await response.text();
        console.error("Bundle submission failed:", errorText);
        throw new Error(`Failed to submit bundle: ${response.statusText}`);
      }

      const result = await response.json();
      console.log("Bundle submitted successfully:", result);
      return result;
    } catch (error) {
      console.error("Error submitting bundle:", error);
      throw error;
    }
  }
}

export const jitoService = new JitoService();
