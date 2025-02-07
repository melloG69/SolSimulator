
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

type Region = 'global' | 'amsterdam' | 'frankfurt' | 'ny' | 'tokyo' | 'slc';

class JitoService {
  private connection: typeof connection;
  private readonly MAX_TRANSACTIONS = 5; // Updated to Jito's max limit
  private readonly REQUEST_TIMEOUT = 30000;
  private readonly API_VERSION = 'v1';
  private readonly REGIONS: Record<Region, string> = {
    global: 'https://mainnet.block-engine.jito.wtf',
    amsterdam: 'https://amsterdam.mainnet.block-engine.jito.wtf',
    frankfurt: 'https://frankfurt.mainnet.block-engine.jito.wtf',
    ny: 'https://ny.mainnet.block-engine.jito.wtf',
    tokyo: 'https://tokyo.mainnet.block-engine.jito.wtf',
    slc: 'https://slc.mainnet.block-engine.jito.wtf'
  };
  private currentRegion: Region = 'global';

  constructor() {
    this.connection = connection;
  }

  private getApiUrl(endpoint: 'bundles' | 'transactions'): string {
    return `${this.REGIONS[this.currentRegion]}/api/${this.API_VERSION}/${endpoint}`;
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
        throw new Error(`HTTP error: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout for region ${this.currentRegion}`);
      }
      throw error;
    }
  }

  private async tryWithRegionFailover<T>(operation: () => Promise<T>): Promise<T> {
    const regions: Region[] = ['global', 'ny', 'frankfurt', 'amsterdam', 'tokyo', 'slc'];
    let lastError: Error | null = null;

    for (const region of regions) {
      try {
        this.currentRegion = region;
        console.log(`Attempting operation with ${region} region`);
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`Failed with region ${region}:`, error);
        continue;
      }
    }

    throw lastError || new Error('All regions failed');
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

  private async checkJitoApiHealth(): Promise<boolean> {
    try {
      const response = await this.makeRequest(
        this.getApiUrl('bundles'),
        'getHealth',
        []
      );
      return !response.error;
    } catch (error) {
      console.error("Jito API health check failed:", error);
      return false;
    }
  }

  async submitBundle(transactions: Transaction[]): Promise<any> {
    return this.tryWithRegionFailover(async () => {
      const bundleValidation = this.validateBundleConstraints(transactions);
      if (!bundleValidation.isValid) {
        throw new Error(bundleValidation.error);
      }

      console.log("Checking Jito API health...");
      const isHealthy = await this.checkJitoApiHealth();
      if (!isHealthy) {
        throw new Error("Jito API is currently unavailable");
      }

      console.log("Preparing transactions for bundle submission");
      
      const bundleWithAssertions: Transaction[] = [];
      
      for (const tx of transactions) {
        const assertionResult = await lighthouseService.buildAssertions(tx);
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

      console.log(`Submitting bundle to Jito API (${this.currentRegion} region)`);
      
      const response = await this.makeRequest(
        this.getApiUrl('bundles'),
        'sendBundle',
        [{
          transactions: serializedTxs,
          encoding: "base64",
        }]
      );

      if (response.error) {
        console.error("Jito API returned error:", response.error);
        toast.error(`Jito API error: ${response.error.message}`);
        throw new Error(`Jito API error: ${response.error.message}`);
      }

      console.log("Bundle submitted successfully:", response);
      toast.success(`Bundle submitted successfully to Jito (${this.currentRegion} region)`);
      return response.result;
    });
  }
}

export const jitoService = new JitoService();
