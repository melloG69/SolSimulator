
import { Transaction, TransactionInstruction, ComputeBudgetProgram } from "@solana/web3.js";
import { connection } from "@/lib/solana";
import { Buffer } from 'buffer';
import { lighthouseService } from "./lighthouseService";

class JitoService {
  private connection: typeof connection;
  private readonly JITO_API_URL = "https://api.devnet.jito.network";
  private readonly MAX_COMPUTE_UNITS = 1_400_000;

  constructor() {
    this.connection = connection;
  }

  private validateComputeUnits(instruction: TransactionInstruction): boolean {
    try {
      // Check if this is a ComputeBudget instruction
      const programId = instruction.programId.toBase58();
      if (programId === ComputeBudgetProgram.programId.toBase58()) {
        // Decode the instruction data
        const dataView = Buffer.from(instruction.data);
        
        // First byte is instruction type, second byte starts the units
        // Skip instruction type byte (first byte)
        const units = dataView.readUInt32LE(1);
        
        console.log("Validating compute units:", units);
        
        // Check if units exceed maximum allowed
        if (units > this.MAX_COMPUTE_UNITS) {
          console.error("Malicious compute unit limit detected:", units);
          return false;
        }
      }
      return true;
    } catch (error) {
      console.error("Error validating compute units:", error);
      return false;
    }
  }

  async validateTransactions(transactions: Transaction[]): Promise<boolean> {
    if (!transactions || transactions.length === 0) {
      console.log("No transactions to validate");
      return false;
    }

    try {
      // Default assertion strategy
      const strategy = {
        balanceTolerance: 2, // 2% tolerance for balance changes
        requireOwnerMatch: true,
        requireDelegateMatch: true,
        requireDataMatch: true
      };

      for (const tx of transactions) {
        // First check compute units in all instructions
        for (const instruction of tx.instructions) {
          if (!this.validateComputeUnits(instruction)) {
            console.error("Transaction contains malicious compute unit settings");
            return false;
          }
        }

        // Build Lighthouse assertions
        console.log("Building Lighthouse assertions for transaction");
        const assertionResult = await lighthouseService.buildAssertions(tx, strategy);
        
        if (!assertionResult.success || !assertionResult.assertionTransaction) {
          console.error("Failed to build Lighthouse assertions:", assertionResult.failureReason);
          return false;
        }

        // Add assertion transaction to bundle
        transactions.push(assertionResult.assertionTransaction);

        // Simulate the transaction with assertions
        console.log("Simulating transaction with assertions:", tx);
        const simulation = await this.connection.simulateTransaction(tx);
        
        if (simulation.value.err) {
          console.error("Transaction validation failed:", simulation.value.err);
          return false;
        }
      }
      
      console.log("All transactions validated successfully with Lighthouse assertions");
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

      const bundleEndpoint = `${this.JITO_API_URL}/bundle`;
      console.log("Submitting bundle to Jito API:", bundleEndpoint);
      
      const response = await fetch(bundleEndpoint, {
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
        console.error("Bundle submission failed with status:", response.status);
        console.error("Error response:", errorText);
        throw new Error(`Failed to submit bundle: ${response.statusText} (${response.status})`);
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
