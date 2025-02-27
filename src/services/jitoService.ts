
import { Transaction, TransactionInstruction, ComputeBudgetProgram, SystemProgram } from "@solana/web3.js";
import { connection } from "@/lib/solana";
import { Buffer } from 'buffer';
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

interface SimulationOptions {
  skipLighthouseCheck?: boolean;
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

  private validateBundleConstraints(transactions: Transaction[], requireSignatures: boolean = false): { isValid: boolean; error?: string } {
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

    const firstTxBlockhash = transactions[0].recentBlockhash;
    const validBlockhash = transactions.every(tx => 
      tx.recentBlockhash === firstTxBlockhash
    );

    if (!validBlockhash) {
      return {
        isValid: false,
        error: "All transactions must have the same recentBlockhash"
      };
    }

    const hasFeePayers = transactions.every(tx => tx.feePayer);
    if (!hasFeePayers) {
      return {
        isValid: false,
        error: "All transactions must have fee payers set"
      };
    }

    // Only check signatures if explicitly required (during submission, not simulation)
    if (requireSignatures) {
      const hasSignatures = transactions.every(tx => {
        if (!tx.feePayer) return false;
        return tx.signatures.some(sig => 
          sig.publicKey.equals(tx.feePayer!) && sig.signature !== null
        );
      });
      
      if (!hasSignatures) {
        return {
          isValid: false,
          error: "All transactions must be signed by their fee payer"
        };
      }
    }

    return { isValid: true };
  }

  private async makeRequest(endpoint: string, method: string, params: any[]): Promise<JitoResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT);

    try {
      console.log(`Making request to ${endpoint} with method ${method}`);
      console.log('Request params:', JSON.stringify(params, null, 2));
      
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

  private classifySimulationError(error: any): { 
    isNormalError: boolean; 
    isMaliciousActivity: boolean; 
    message: string; 
  } {
    // Convert error to string for easier parsing
    const errorString = typeof error === 'string' 
      ? error 
      : error instanceof Error 
        ? error.message 
        : JSON.stringify(error);
    
    // Common error patterns and their classifications
    const knownNormalErrors = [
      'insufficient funds',
      'insufficient lamports',
      'not enough SOL',
      'account has no balance',
      'Account doesn\'t exist',
      'Invalid blockhash',
      'blockhash not found',
      'ProgramAccountNotFound',
      'Connection error',
      'timeout',
      'fetch failed'
    ];
    
    const maliciousPatterns = [
      'excessive compute',
      'compute budget exceeded',
      'abnormal state change',
      'unexpected state change',
      'malicious activity',
      'validation constraint violated'
    ];
    
    // Check if this is a known normal error
    for (const pattern of knownNormalErrors) {
      if (errorString.toLowerCase().includes(pattern.toLowerCase())) {
        return {
          isNormalError: true,
          isMaliciousActivity: false,
          message: `Normal error: ${errorString}`
        };
      }
    }
    
    // Check if this is a potential malicious pattern
    for (const pattern of maliciousPatterns) {
      if (errorString.toLowerCase().includes(pattern.toLowerCase())) {
        return {
          isNormalError: false,
          isMaliciousActivity: true,
          message: `Potential malicious activity: ${errorString}`
        };
      }
    }
    
    // If we can't classify it, treat as a normal error but with a clear message
    return {
      isNormalError: true,
      isMaliciousActivity: false,
      message: `Unclassified error: ${errorString}`
    };
  }

  async simulateTransactions(
    transactions: Transaction[], 
    options: SimulationOptions = {}
  ): Promise<{
    isValid: boolean;
    error?: string;
    details?: any;
    normalErrors?: boolean;
  }> {
    if (!transactions || transactions.length === 0) {
      console.log("No transactions to simulate");
      return { isValid: false, error: "No transactions to simulate" };
    }

    try {
      // Check basic bundle constraints but don't require signatures for simulation
      const bundleValidation = this.validateBundleConstraints(transactions, false);
      if (!bundleValidation.isValid) {
        console.error("Bundle constraint validation failed:", bundleValidation.error);
        return { 
          isValid: false, 
          error: bundleValidation.error,
          normalErrors: true // Bundle constraints are normal errors
        };
      }

      // Simulate each transaction to check for errors
      const simulationResults = await Promise.all(
        transactions.map(async (tx) => {
          if (!tx.recentBlockhash) {
            return { 
              success: false, 
              error: "Transaction missing recentBlockhash",
              isNormalError: true,
              isMaliciousActivity: false
            };
          }

          try {
            const simulation = await this.connection.simulateTransaction(tx);
            if (simulation.value.err) {
              // Classify the error
              const errorClassification = this.classifySimulationError(simulation.value.err);
              
              return { 
                success: false, 
                error: errorClassification.message,
                isNormalError: errorClassification.isNormalError,
                isMaliciousActivity: errorClassification.isMaliciousActivity,
                details: simulation.value 
              };
            }
            return { success: true, details: simulation.value };
          } catch (error) {
            // Classify caught errors too
            const errorClassification = this.classifySimulationError(error);
            
            return { 
              success: false,
              error: errorClassification.message,
              isNormalError: errorClassification.isNormalError,
              isMaliciousActivity: errorClassification.isMaliciousActivity,
              details: error
            };
          }
        })
      );

      // Check for malicious activity by analyzing simulation results
      // Only look for actual malicious activity, not normal errors
      const maliciousActivity = simulationResults.some(result => 
        !result.success && result.isMaliciousActivity === true
      );
      
      // If there are only normal errors (not malicious), we may allow the bundle
      const hasOnlyNormalErrors = simulationResults.some(result => 
        !result.success && result.isNormalError === true
      );

      if (maliciousActivity) {
        // Get only the malicious results
        const maliciousResults = simulationResults.filter(r => 
          !r.success && r.isMaliciousActivity === true
        );
        const errorMessages = maliciousResults.map(r => r.error).join('; ');
        console.error("Malicious activity detected in transactions:", errorMessages);
        
        return { 
          isValid: false, 
          error: "Potential malicious activity detected in bundle",
          details: simulationResults,
          normalErrors: false
        };
      } else if (hasOnlyNormalErrors && !options.skipLighthouseCheck) {
        // If there are normal errors but not malicious ones
        const failedResults = simulationResults.filter(r => !r.success);
        const errorMessages = failedResults.map(r => r.error).join('; ');
        console.log("Bundle has normal errors (not malicious activity):", errorMessages);
        
        return { 
          isValid: false, 
          error: "Bundle contains errors that need to be fixed",
          details: simulationResults,
          normalErrors: true
        };
      }
      
      console.log("All transactions simulated successfully");
      return { isValid: true, details: simulationResults };
    } catch (error) {
      console.error("Error during transaction simulation:", error);
      // Classify the overall error
      const errorClassification = this.classifySimulationError(error);
      
      return { 
        isValid: false, 
        error: errorClassification.message,
        normalErrors: errorClassification.isNormalError 
      };
    }
  }

  async submitBundle(transactions: Transaction[]): Promise<any> {
    try {
      console.log("Starting bundle submission process");
      
      // For submission, we validate with signature requirement
      const bundleValidation = this.validateBundleConstraints(transactions, true);
      if (!bundleValidation.isValid) {
        const error = `Bundle validation failed: ${bundleValidation.error}`;
        console.error(error);
        toast.error(error);
        throw new Error(error);
      }
      
      console.log("Preparing transactions for bundle submission");
      
      // Debug log signature information
      for (const tx of transactions) {
        console.log('Transaction signatures:', tx.signatures.map(sig => ({
          pubkey: sig.publicKey.toBase58(),
          signature: sig.signature?.toString('base64') || 'null'
        })));
      }

      // Properly serialize transactions for Jito API format
      const encodedTransactions = transactions.map(tx => {
        const serialized = tx.serialize();
        console.log(`Serialized transaction (${serialized.length} bytes)`);
        return Buffer.from(serialized).toString('base64');
      });

      // Format directly according to Jito API requirements
      // This is the correct format per Jito documentation
      const bundleParams = {
        transactions: encodedTransactions
      };

      console.log("Submitting bundle to Jito API with format:", JSON.stringify(bundleParams, null, 2));
      
      // Send the correctly formatted bundle parameters
      const response = await this.makeRequest(
        this.getApiUrl('bundles'),
        'sendBundle',
        [bundleParams]
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
