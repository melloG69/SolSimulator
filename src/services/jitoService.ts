
import { Transaction, TransactionInstruction, ComputeBudgetProgram, SystemProgram } from "@solana/web3.js";
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
  private readonly JITO_API_URL = "https://jito-api.mainnet.solana.com";
  private readonly MAX_TRANSACTIONS = 3;
  private readonly MAX_COMPUTE_UNITS = 1_200_000;

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
          console.error("Excessive compute unit limit detected:", units);
          return false;
        }
      }
      return true;
    } catch (error) {
      console.error("Error validating compute units:", error);
      return false;
    }
  }

  private isSimpleTransaction(transaction: Transaction): boolean {
    return transaction.instructions.every(ix => 
      ix.programId.equals(SystemProgram.programId) ||
      ix.programId.equals(ComputeBudgetProgram.programId)
    );
  }

  private validateBundleConstraints(transactions: Transaction[]): { isValid: boolean; error?: string } {
    if (transactions.length > this.MAX_TRANSACTIONS) {
      return {
        isValid: false,
        error: `Bundle exceeds maximum transaction count (${this.MAX_TRANSACTIONS})`
      };
    }

    if (transactions.length === 0) {
      return {
        isValid: false,
        error: "Bundle cannot be empty"
      };
    }

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
      const transactionsWithAssertions: Transaction[] = [];
      
      const bundleValidation = this.validateBundleConstraints(transactions);
      if (!bundleValidation.isValid) {
        console.error("Bundle validation failed:", bundleValidation.error);
        return false;
      }

      for (const tx of transactions) {
        // Skip compute unit validation for simple transactions
        if (!this.isSimpleTransaction(tx)) {
          for (const instruction of tx.instructions) {
            if (!this.validateComputeUnits(instruction)) {
              console.error("Transaction contains excessive compute unit settings");
              return false;
            }
          }
        }

        // Get appropriate strategy based on transaction type
        const strategy = {
          balanceTolerance: this.isSimpleTransaction(tx) ? 10 : 1,
          requireOwnerMatch: !this.isSimpleTransaction(tx),
          requireDelegateMatch: !this.isSimpleTransaction(tx),
          requireDataMatch: !this.isSimpleTransaction(tx)
        };

        console.log("Building Lighthouse assertions for transaction");
        const assertionResult = await lighthouseService.buildAssertions(tx, strategy);
        
        if (!assertionResult.success) {
          console.error("Failed to build Lighthouse assertions:", assertionResult.failureReason);
          return false;
        }

        transactionsWithAssertions.push(tx);
        if (assertionResult.assertionTransaction) {
          assertionResult.assertionTransaction.feePayer = tx.feePayer;
          transactionsWithAssertions.push(assertionResult.assertionTransaction);
        }
      }

      // Simulate transactions
      for (const tx of transactionsWithAssertions) {
        console.log("Simulating transaction");
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
      
      const bundleWithAssertions: Transaction[] = [];
      
      for (const tx of transactions) {
        const strategy = {
          balanceTolerance: this.isSimpleTransaction(tx) ? 10 : 1,
          requireOwnerMatch: !this.isSimpleTransaction(tx),
          requireDelegateMatch: !this.isSimpleTransaction(tx),
          requireDataMatch: !this.isSimpleTransaction(tx)
        };

        const assertionResult = await lighthouseService.buildAssertions(tx, strategy);
        if (!assertionResult.success) {
          throw new Error(`Failed to build assertions: ${assertionResult.failureReason}`);
        }
        
        bundleWithAssertions.push(tx);
        if (assertionResult.assertionTransaction) {
          assertionResult.assertionTransaction.feePayer = tx.feePayer;
          bundleWithAssertions.push(assertionResult.assertionTransaction);
        }
      }

      const serializedTxs = bundleWithAssertions.map(tx => {
        if (!tx.feePayer) {
          throw new Error("Transaction fee payer required");
        }
        const serialized = tx.serialize();
        return Buffer.from(serialized).toString('base64');
      });

      const requestId = this.generateRequestId();
      
      console.log("Submitting bundle to Jito API");
      
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

      if (!response.ok) {
        throw new Error(`Failed to submit bundle: ${await response.text()} (${response.status})`);
      }

      const result: JitoResponse = await response.json();

      if (result.error) {
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
