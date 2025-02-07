
import { Transaction, TransactionInstruction, ComputeBudgetProgram } from "@solana/web3.js";
import { connection } from "@/lib/solana";
import { Buffer } from 'buffer';
import { lighthouseService } from "./lighthouseService";

interface JitoResponse {
  jsonrpc: "2.0";
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  id: string | number;
}

class JitoService {
  private connection: typeof connection;
  private readonly JITO_API_URL = "https://jito-api.devnet.solana.com";
  private readonly MAX_TRANSACTIONS = 5;
  private readonly MAX_COMPUTE_UNITS = 1_400_000;

  constructor() {
    this.connection = connection;
  }

  private validateComputeUnits(instruction: TransactionInstruction): boolean {
    try {
      const programId = instruction.programId.toBase58();
      if (programId === ComputeBudgetProgram.programId.toBase58()) {
        const dataView = Buffer.from(instruction.data);
        const units = dataView.readUInt32LE(1);
        
        console.log("Validating compute units:", units);
        
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

  private validateBundleConstraints(transactions: Transaction[]): { isValid: boolean; error?: string } {
    // Check transaction count
    if (transactions.length > this.MAX_TRANSACTIONS) {
      return {
        isValid: false,
        error: `Bundle exceeds maximum transaction count (${this.MAX_TRANSACTIONS})`
      };
    }

    // Check for empty bundle
    if (transactions.length === 0) {
      return {
        isValid: false,
        error: "Bundle cannot be empty"
      };
    }

    // Validate slot boundaries
    const firstTxSlot = transactions[0].lastValidBlockHeight;
    const validSlot = transactions.every(tx => 
      tx.lastValidBlockHeight === firstTxSlot
    );

    if (!validSlot) {
      return {
        isValid: false,
        error: "All transactions must be within the same slot boundary"
      };
    }

    // Check if all transactions have fee payers
    const hasFeePayers = transactions.every(tx => tx.feePayer);
    if (!hasFeePayers) {
      return {
        isValid: false,
        error: "All transactions must have fee payers set"
      };
    }

    return { isValid: true };
  }

  async validateTransactions(transactions: Transaction[]): Promise<boolean> {
    if (!transactions || transactions.length === 0) {
      console.log("No transactions to validate");
      return false;
    }

    try {
      // Create a new array for transactions with assertions
      const transactionsWithAssertions: Transaction[] = [];
      
      // Validate bundle constraints first
      const bundleValidation = this.validateBundleConstraints(transactions);
      if (!bundleValidation.isValid) {
        console.error("Bundle validation failed:", bundleValidation.error);
        return false;
      }

      // Default assertion strategy
      const strategy = {
        balanceTolerance: 2,
        requireOwnerMatch: true,
        requireDelegateMatch: true,
        requireDataMatch: true
      };

      // Process each transaction and build assertions
      for (const tx of transactions) {
        // Check compute units in all instructions
        for (const instruction of tx.instructions) {
          if (!this.validateComputeUnits(instruction)) {
            console.error("Transaction contains malicious compute unit settings");
            return false;
          }
        }

        console.log("Building Lighthouse assertions for transaction");
        const assertionResult = await lighthouseService.buildAssertions(tx, strategy);
        
        if (!assertionResult.success || !assertionResult.assertionTransaction) {
          console.error("Failed to build Lighthouse assertions:", assertionResult.failureReason);
          return false;
        }

        // Add both the original transaction and its assertion
        transactionsWithAssertions.push(tx);
        assertionResult.assertionTransaction.feePayer = tx.feePayer;
        transactionsWithAssertions.push(assertionResult.assertionTransaction);
      }

      // Simulate the entire bundle with assertions
      for (const tx of transactionsWithAssertions) {
        console.log("Simulating transaction:", tx);
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

  private generateRequestId(): string {
    return `jito-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async submitBundle(transactions: Transaction[]): Promise<any> {
    const bundleValidation = this.validateBundleConstraints(transactions);
    if (!bundleValidation.isValid) {
      throw new Error(bundleValidation.error);
    }

    try {
      console.log("Preparing transactions for bundle submission");
      
      // Build assertions for each transaction
      const strategy = {
        balanceTolerance: 2,
        requireOwnerMatch: true,
        requireDelegateMatch: true,
        requireDataMatch: true
      };

      const bundleWithAssertions: Transaction[] = [];
      
      // Add assertions for each transaction
      for (const tx of transactions) {
        const assertionResult = await lighthouseService.buildAssertions(tx, strategy);
        if (!assertionResult.success || !assertionResult.assertionTransaction) {
          throw new Error(`Failed to build assertions: ${assertionResult.failureReason}`);
        }
        
        // Add transaction followed by its assertion
        bundleWithAssertions.push(tx);
        assertionResult.assertionTransaction.feePayer = tx.feePayer;
        bundleWithAssertions.push(assertionResult.assertionTransaction);
      }

      const serializedTxs = bundleWithAssertions.map(tx => {
        if (!tx.feePayer) {
          throw new Error("Transaction fee payer required");
        }
        const serialized = tx.serialize();
        return Buffer.from(serialized).toString('base64');
      });

      const requestId = this.generateRequestId();
      
      console.log("Submitting bundle to Jito API:", this.JITO_API_URL);
      
      const requestBody = {
        jsonrpc: "2.0",
        method: "sendBundle",
        params: [{
          transactions: serializedTxs,
          encoding: "base64",
        }],
        id: requestId
      };

      console.log("Request payload:", JSON.stringify(requestBody, null, 2));
      
      const response = await fetch(this.JITO_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const responseText = await response.text();
      console.log("Raw response:", responseText);

      if (!response.ok) {
        console.error("Bundle submission failed with status:", response.status);
        console.error("Error response:", responseText);
        throw new Error(`Failed to submit bundle: ${responseText} (${response.status})`);
      }

      let result: JitoResponse;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        console.error("Failed to parse JSON response:", e);
        throw new Error("Invalid JSON response from Jito API");
      }

      if (result.error) {
        console.error("Jito API returned error:", result.error);
        throw new Error(`Jito API error: ${result.error.message}`);
      }

      console.log("Bundle submitted successfully:", result);
      
      return result.result;
    } catch (error) {
      console.error("Error submitting bundle:", error);
      throw error;
    }
  }
}

export const jitoService = new JitoService();
