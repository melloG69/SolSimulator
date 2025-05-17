import { Transaction, TransactionInstruction, ComputeBudgetProgram, SystemProgram } from "@solana/web3.js";
import { connection } from "@/lib/solana";
import { Buffer } from 'buffer';
import { toast } from "sonner";
import { env } from "@/config/env";

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
          'Authorization': `Bearer ${env.JITO_API_KEY}`
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
    const errorString = typeof error === 'string' 
      ? error 
      : error instanceof Error 
        ? error.message 
        : JSON.stringify(error);
    
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
    
    for (const pattern of knownNormalErrors) {
      if (errorString.toLowerCase().includes(pattern.toLowerCase())) {
        return {
          isNormalError: true,
          isMaliciousActivity: false,
          message: `Normal error: ${errorString}`
        };
      }
    }
    
    for (const pattern of maliciousPatterns) {
      if (errorString.toLowerCase().includes(pattern.toLowerCase())) {
        return {
          isNormalError: false,
          isMaliciousActivity: true,
          message: `Potential malicious activity: ${errorString}`
        };
      }
    }
    
    return {
      isNormalError: true,
      isMaliciousActivity: false,
      message: `Unclassified error: ${errorString}`
    };
  }

  private isMaliciousActivity(simulationValue: any): boolean {
    if (!simulationValue || !simulationValue.logs) return false;
    
    const maliciousPatterns = [
      'Program transfer:',
      'Program invoke:',
      'Program success:',
      'Program failed:',
      'Program log: Instruction: Transfer',
      'Program log: Instruction: TransferChecked',
      'Program log: Instruction: Approve',
      'Program log: Instruction: ApproveChecked'
    ];

    return simulationValue.logs.some((log: string) => 
      maliciousPatterns.some(pattern => log.includes(pattern))
    );
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
      // Always validate bundle constraints
      const bundleValidation = this.validateBundleConstraints(transactions, false);
      if (!bundleValidation.isValid) {
        console.error("Bundle constraint validation failed:", bundleValidation.error);
        return { 
          isValid: false, 
          error: bundleValidation.error,
          normalErrors: true
        };
      }

      // Validate each transaction before simulation
      for (const tx of transactions) {
        if (!(tx instanceof Transaction)) {
          console.error("Invalid transaction object:", tx);
          return {
            isValid: false,
            error: "Invalid transaction object passed to simulation",
            normalErrors: true
          };
        }
        if (!tx.feePayer) {
          console.error("Transaction missing fee payer:", tx);
          return {
            isValid: false,
            error: "Transaction missing fee payer",
            normalErrors: true
          };
        }
        if (!tx.instructions || tx.instructions.length === 0) {
          console.error("Transaction has no instructions:", tx);
          return {
            isValid: false,
            error: "Transaction has no instructions",
            normalErrors: true
          };
        }
        // Update transaction with latest blockhash if needed
        if (!tx.recentBlockhash) {
          const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('finalized');
          tx.recentBlockhash = blockhash;
          tx.lastValidBlockHeight = lastValidBlockHeight;
        }
        // Log transaction fields for debugging
        console.log("Simulating transaction:", {
          feePayer: tx.feePayer?.toBase58(),
          recentBlockhash: tx.recentBlockhash,
          instructions: tx.instructions.length,
          signatures: tx.signatures.length,
          isTransaction: tx instanceof Transaction
        });
      }

      // Get the user's wallet (Phantom)
      const provider = window?.solana;
      if (!provider) {
        throw new Error("Phantom wallet not found");
      }

      // Prepare all transactions for signing
      const transactionsToSign = transactions.map(tx => {
        // Ensure transaction is properly constructed
        if (!tx.feePayer) {
          throw new Error("Transaction missing fee payer");
        }

        // Create a new transaction with the same instructions
        const newTx = new Transaction();
        
        // Set required fields
        newTx.feePayer = tx.feePayer;
        newTx.recentBlockhash = tx.recentBlockhash;
        newTx.lastValidBlockHeight = tx.lastValidBlockHeight;
        
        // Add all instructions
        tx.instructions.forEach(ix => {
          newTx.add(ix);
        });

        // Ensure the transaction is properly constructed
        if (!newTx.recentBlockhash) {
          throw new Error("Transaction missing recent blockhash");
        }

        // Initialize the transaction message
        newTx.signatures = [];
        const message = newTx.compileMessage();
        if (!message) {
          throw new Error("Failed to compile transaction message");
        }

        // Add the fee payer's signature slot
        newTx.signatures.push({
          signature: null,
          publicKey: newTx.feePayer
        });

        return newTx;
      });

      // Sign all transactions at once
      const signedTransactions = await provider.signAllTransactions(transactionsToSign);

      // Simulate each signed transaction
      const simulationResults = await Promise.all(
        signedTransactions.map(async (signedTx) => {
          try {
            // Verify the transaction is properly signed
            if (!signedTx.signatures || signedTx.signatures.length === 0) {
              throw new Error("Transaction not properly signed");
            }

            // Ensure the transaction has a valid signature
            const hasValidSignature = signedTx.signatures.some(sig => 
              sig.publicKey.equals(signedTx.feePayer!) && sig.signature !== null
            );

            if (!hasValidSignature) {
              throw new Error("Transaction missing valid signature from fee payer");
            }

            // Verify the transaction message is properly constructed
            const message = signedTx.compileMessage();
            if (!message) {
              throw new Error("Failed to compile signed transaction message");
            }

            // Perform the actual simulation with strict validation
            const simulation = await this.connection.simulateTransaction(signedTx, {
              sigVerify: true, // Enable signature verification
              replaceRecentBlockhash: true,
              commitment: 'confirmed'
            });

            if (simulation.value.err) {
              const errorClassification = this.classifySimulationError(simulation.value.err);
              
              return { 
                success: false, 
                error: errorClassification.message,
                isNormalError: errorClassification.isNormalError,
                isMaliciousActivity: errorClassification.isMaliciousActivity,
                details: simulation.value 
              };
            }

            // Check for any warnings in the simulation logs
            const hasWarnings = simulation.value.logs?.some(log => 
              log.includes('Warning') || log.includes('Error')
            );

            if (hasWarnings) {
              console.warn("Simulation completed with warnings:", simulation.value.logs);
            }

            // Check if the simulation was successful
            const isSuccessful = simulation.value.err === null && 
                               !simulation.value.logs?.some(log => 
                                 log.includes('Error') || 
                                 log.includes('failed') || 
                                 log.includes('rejected')
                               );

            return { 
              success: isSuccessful, 
              details: simulation.value,
              isNormalError: !isSuccessful && !this.isMaliciousActivity(simulation.value),
              isMaliciousActivity: this.isMaliciousActivity(simulation.value)
            };
          } catch (error) {
            console.error("Error simulating transaction:", error);
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

      const maliciousActivity = simulationResults.some(result => 
        !result.success && result.isMaliciousActivity === true
      );
      
      const hasOnlyNormalErrors = simulationResults.some(result => 
        !result.success && result.isNormalError === true
      );

      if (maliciousActivity) {
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
      
      const bundleValidation = this.validateBundleConstraints(transactions, true);
      if (!bundleValidation.isValid) {
        const error = `Bundle validation failed: ${bundleValidation.error}`;
        console.error(error);
        toast.error(error);
        throw new Error(error);
      }
      
      console.log("Preparing transactions for bundle submission");
      
      for (const tx of transactions) {
        console.log('Transaction signatures:', tx.signatures.map(sig => ({
          pubkey: sig.publicKey.toBase58(),
          signature: sig.signature?.toString('base64') || 'null'
        })));
      }

      const encodedTransactions = transactions.map(tx => {
        const serialized = tx.serialize();
        console.log(`Serialized transaction (${serialized.length} bytes)`);
        return Buffer.from(serialized).toString('base64');
      });

      console.log("Submitting bundle to Jito API with corrected format");
      
      const response = await this.makeRequest(
        this.getApiUrl('bundles'),
        'sendBundle',
        [encodedTransactions]
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
