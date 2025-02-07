
import { Transaction, TransactionInstruction, ComputeBudgetProgram, SystemProgram } from "@solana/web3.js";
import { connection } from "@/lib/solana";
import { Buffer } from 'buffer';
import { lighthouseService } from "./lighthouseService";
import { toast } from "sonner";

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
  private readonly MAX_TRANSACTIONS = 5;
  private readonly REQUEST_TIMEOUT = 30000;
  private readonly API_VERSION = 'v1';
  private readonly BASE_URL = 'https://mainnet.block-engine.jito.wtf';

  constructor() {
    this.connection = connection;
  }

  private getApiUrl(endpoint: 'bundles' | 'transactions'): string {
    return `${this.BASE_URL}/api/${this.API_VERSION}/${endpoint}`;
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

  private async makeRequest(endpoint: string, method: string, params: any[]): Promise<JitoResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);

    try {
      console.log(`Making request to ${endpoint} with method ${method}`);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method,
          params,
          id: `jito-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`HTTP error: ${response.status}`, errorText);
        throw new Error(`HTTP error: ${response.status} - ${errorText}`);
      }

      const jsonResponse = await response.json();
      console.log('Jito API Response:', jsonResponse);
      return jsonResponse;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.error('Request timeout to Jito API');
          throw new Error('Request to Jito API timed out');
        }
        console.error('Error making request to Jito API:', error);
        throw error;
      }
      throw error;
    }
  }

  async validateTransactions(transactions: Transaction[]): Promise<boolean> {
    if (!transactions || transactions.length === 0) {
      console.log("No transactions to validate");
      return false;
    }

    try {
      const bundleValidation = this.validateBundleConstraints(transactions);
      if (!bundleValidation.isValid) {
        console.error("Bundle validation failed:", bundleValidation.error);
        return false;
      }

      for (const tx of transactions) {
        console.log("Building Lighthouse assertions for transaction");
        const assertionResult = await lighthouseService.buildAssertions(tx);
        
        if (!assertionResult.success) {
          console.error("Failed to build Lighthouse assertions:", assertionResult.failureReason);
          return false;
        }

        const simulation = await this.connection.simulateTransaction(tx);
        
        if (simulation.value.err) {
          console.error("Transaction validation failed:", simulation.value.err);
          return false;
        }

        if (assertionResult.assertionTransaction) {
          assertionResult.assertionTransaction.feePayer = tx.feePayer;
          const assertionSimulation = await this.connection.simulateTransaction(
            assertionResult.assertionTransaction
          );
          
          if (assertionSimulation.value.err) {
            console.error("Assertion validation failed:", assertionSimulation.value.err);
            return false;
          }
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
    try {
      console.log("Starting bundle submission process");
      const bundleValidation = this.validateBundleConstraints(transactions);
      if (!bundleValidation.isValid) {
        console.error("Bundle validation failed:", bundleValidation.error);
        toast.error(bundleValidation.error);
        throw new Error(bundleValidation.error);
      }

      console.log("Preparing transactions for bundle submission");
      
      const bundleWithAssertions: Transaction[] = [];
      
      for (const tx of transactions) {
        if (!tx.recentBlockhash) {
          const errorMessage = "Transaction missing recentBlockhash";
          console.error(errorMessage);
          toast.error(errorMessage);
          throw new Error(errorMessage);
        }

        const assertionResult = await lighthouseService.buildAssertions(tx);
        if (!assertionResult.success) {
          const errorMessage = `Failed to build assertions: ${assertionResult.failureReason}`;
          console.error(errorMessage);
          toast.error(errorMessage);
          throw new Error(errorMessage);
        }
        
        bundleWithAssertions.push(tx);
        if (assertionResult.assertionTransaction) {
          assertionResult.assertionTransaction.feePayer = tx.feePayer;
          bundleWithAssertions.push(assertionResult.assertionTransaction);
        }
      }

      const serializedTxs = bundleWithAssertions.map(tx => {
        if (!tx.feePayer) {
          const errorMessage = "Transaction fee payer required";
          console.error(errorMessage);
          toast.error(errorMessage);
          throw new Error(errorMessage);
        }
        return Buffer.from(tx.serialize()).toString('base64');
      });

      console.log("Submitting bundle to Jito API");
      
      const response = await this.makeRequest(
        this.getApiUrl('bundles'),
        'sendBundle',
        [{
          transactions: serializedTxs,
          encoding: "base64",
        }]
      );

      if (response.error) {
        const errorMessage = `Jito API error: ${response.error.message}`;
        console.error(errorMessage, response.error);
        toast.error(errorMessage);
        throw new Error(errorMessage);
      }

      console.log("Bundle submitted successfully:", response);
      toast.success("Bundle submitted successfully to Jito");
      return response.result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      console.error("Error submitting bundle:", error);
      toast.error(`Failed to submit bundle: ${errorMessage}`);
      throw error;
    }
  }
}

export const jitoService = new JitoService();
