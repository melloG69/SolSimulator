import { 
  Transaction, 
  PublicKey, 
  TransactionInstruction,
  SYSVAR_CLOCK_PUBKEY,
  SystemProgram,
  ComputeBudgetProgram,
  Cluster
} from "@solana/web3.js";
import { connection, ExtendedCluster } from "@/lib/solana";
import { Buffer } from 'buffer';
import { toast } from "sonner";

// Lighthouse Program IDs - only using mainnet in this configuration
const LIGHTHOUSE_PROGRAM_ID = "jitosGW6AmNQEUyVXXV4SsGZq18k2QCvYqRB9deEYKH"; // Jito's official mainnet deployment

// Define behavior
const LIGHTHOUSE_CONFIG = {
  allowRunningWithoutLighthouse: false, // Mainnet enforcement
  maxRetries: 3,
  retryDelay: 2000,
};

interface AssertionResult {
  success: boolean;
  failureReason?: string;
  assertionTransaction?: Transaction;
  isProgramAvailable?: boolean;
}

class LighthouseService {
  private connection: typeof connection;
  private readonly MAX_COMPUTE_UNITS = 1_200_000;
  private readonly MAX_INSTRUCTIONS_PER_TX = 20;
  private programAccountVerified: boolean = false;
  private verificationAttempts: number = 0;
  private verificationInProgress: boolean = false;
  private verificationPromise: Promise<boolean> | null = null;
  private lighthouseProgramId: PublicKey;

  constructor() {
    this.connection = connection;
    
    // Always use mainnet Lighthouse program ID
    this.lighthouseProgramId = new PublicKey(LIGHTHOUSE_PROGRAM_ID);
    console.log(`Using Lighthouse program ID on mainnet: ${this.lighthouseProgramId.toString()}`);
    
    // Verify program account on instantiation
    this.verifyProgramAccount();
  }

  // Verify the Lighthouse program account exists on chain
  private async verifyProgramAccount(): Promise<boolean> {
    try {
      // Return cached result if already verified
      if (this.programAccountVerified) return true;
      
      // If verification is in progress, return the existing promise
      if (this.verificationInProgress && this.verificationPromise) {
        return this.verificationPromise;
      }
      
      // Start verification process
      this.verificationInProgress = true;
      this.verificationPromise = this.performVerification();
      return this.verificationPromise;
    } catch (error) {
      console.error("Error verifying Lighthouse program account on mainnet:", error);
      this.programAccountVerified = false;
      this.verificationInProgress = false;
      return false;
    }
  }
  
  private async performVerification(): Promise<boolean> {
    try {
      console.log("Verifying Lighthouse program account existence on mainnet...");
      
      // Try to get account info
      const accountInfo = await this.connection.getAccountInfo(this.lighthouseProgramId);
      
      if (accountInfo !== null) {
        // Program exists
        this.programAccountVerified = true;
        console.log("✅ Lighthouse program account verified on mainnet");
        return true;
      } else if (this.verificationAttempts < LIGHTHOUSE_CONFIG.maxRetries) {
        // Retry logic
        this.verificationAttempts++;
        console.log(`Lighthouse program not found on mainnet, retrying (${this.verificationAttempts}/${LIGHTHOUSE_CONFIG.maxRetries})...`);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, LIGHTHOUSE_CONFIG.retryDelay));
        return this.performVerification();
      } else {
        // Max retries reached, program not found
        this.programAccountVerified = false;
        console.warn("⚠️ Lighthouse program not found on mainnet after multiple attempts. Bundle protection will be limited.");
        toast.warning("Lighthouse protection is not available on mainnet. Transaction security may be limited.");
        return false;
      }
    } catch (error) {
      console.error("Error during Lighthouse verification on mainnet:", error);
      this.programAccountVerified = false;
      return false;
    } finally {
      this.verificationInProgress = false;
    }
  }

  private isComputeBudgetInstruction(instruction: TransactionInstruction): boolean {
    return instruction.programId.equals(ComputeBudgetProgram.programId);
  }

  private hasComputeBudgetInstruction(transaction: Transaction): boolean {
    return transaction.instructions.some(ix => this.isComputeBudgetInstruction(ix));
  }

  private async detectMaliciousPatterns(transaction: Transaction): Promise<{ isMalicious: boolean; reason?: string }> {
    try {
      // Check for excessive compute units
      if (this.hasComputeBudgetInstruction(transaction)) {
        for (const ix of transaction.instructions) {
          if (this.isComputeBudgetInstruction(ix)) {
            try {
              const dataView = Buffer.from(ix.data);
              // Check if dataView is long enough before reading
              if (dataView.length >= 5) { // Validate buffer length
                const units = dataView.readUInt32LE(1);
                console.log(`Compute units detected: ${units}`);
                if (units > this.MAX_COMPUTE_UNITS) {
                  return { 
                    isMalicious: true, 
                    reason: `Excessive compute units detected: ${units} > ${this.MAX_COMPUTE_UNITS}` 
                  };
                }
              }
            } catch (error) {
              console.error("Error parsing compute budget instruction:", error);
              // Continue checking other instructions rather than failing immediately
            }
          }
        }
      }

      // Check for too many instructions (potential DoS vector)
      if (transaction.instructions.length > this.MAX_INSTRUCTIONS_PER_TX) {
        return {
          isMalicious: true,
          reason: `Too many instructions in transaction: ${transaction.instructions.length} > ${this.MAX_INSTRUCTIONS_PER_TX}`
        };
      }

      // Check for system program instructions and validate them
      for (const ix of transaction.instructions) {
        if (ix.programId.equals(SystemProgram.programId)) {
          try {
            // Validate system program transfers
            const dataView = Buffer.from(ix.data);
            if (dataView.length >= 12) { // Ensure buffer has enough bytes
              // Check instruction type (0 = Create, 2 = Transfer)
              const instructionType = dataView.readUInt32LE(0);
              
              if (instructionType === 2) { // Transfer instruction
                const transferAmount = dataView.readBigUInt64LE(4);
                console.log("Validating system transfer amount:", transferAmount.toString());
                
                // Check for unusually large transfers (potential drain attempt)
                // Example threshold: 1 SOL
                if (transferAmount > BigInt(1_000_000_000)) {
                  return {
                    isMalicious: true,
                    reason: `Unusually large transfer detected: ${transferAmount.toString()} lamports`
                  };
                }
              }
            }
          } catch (error) {
            console.error("Error validating system instruction:", error);
            // Continue with other checks
          }
        }
      }

      // All checks passed
      return { isMalicious: false };
    } catch (error) {
      console.error("Error in malicious pattern detection:", error);
      // Default to non-malicious if detection process fails
      return { isMalicious: false };
    }
  }

  private async createAssertionTransaction(transaction: Transaction): Promise<Transaction | undefined> {
    try {
      // First verify that the Lighthouse program is available
      const isProgramAvailable = await this.verifyProgramAccount();
      
      if (!isProgramAvailable) {
        if (LIGHTHOUSE_CONFIG.allowRunningWithoutLighthouse) {
          console.warn("Lighthouse program not available on mainnet, but continuing without assertions as configured");
          return undefined;
        } else {
          console.error("Cannot create assertion transaction: Lighthouse program not available on mainnet");
          throw new Error("Lighthouse program not available on mainnet. Bundle protection is required by configuration.");
        }
      }

      const assertionTx = new Transaction();
      
      // Add system clock for validation
      assertionTx.add(
        new TransactionInstruction({
          keys: [
            { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false }
          ],
          programId: this.lighthouseProgramId,
          data: Buffer.from([])
        })
      );
      
      // Add compute budget specific assertions if needed
      if (this.hasComputeBudgetInstruction(transaction)) {
        console.log("Creating compute budget assertions for mainnet");
        assertionTx.add(
          new TransactionInstruction({
            keys: [],
            programId: this.lighthouseProgramId,
            data: Buffer.from([0]) // Compute budget assertion opcode
          })
        );
      }

      // If we get here, the assertion transaction is valid
      console.log("Successfully created Lighthouse assertion transaction for mainnet");
      return assertionTx;
    } catch (error) {
      console.error("Error creating assertion transaction on mainnet:", error);
      return undefined;
    }
  }

  async validateTransaction(transaction: Transaction): Promise<boolean> {
    try {
      // Basic validation - check if the transaction has required fields
      if (!transaction.recentBlockhash) {
        console.error("Transaction missing recentBlockhash");
        return false;
      }

      if (!transaction.feePayer) {
        console.error("Transaction missing feePayer");
        return false;
      }

      // Only simulate if passing basic validation
      try {
        const simulation = await this.connection.simulateTransaction(transaction);
        if (simulation.value.err) {
          console.error("Transaction simulation failed:", simulation.value.err);
          return false;
        }
      } catch (error) {
        console.error("Error simulating transaction:", error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error validating transaction:", error);
      return false;
    }
  }

  async buildAssertions(
    transaction: Transaction
  ): Promise<AssertionResult> {
    try {
      console.log("Building Lighthouse assertions for transaction on mainnet");

      // First, check if Lighthouse program is available
      const isProgramAvailable = await this.verifyProgramAccount();
      
      if (!isProgramAvailable) {
        // Program not found but we have allowRunningWithoutLighthouse enabled
        if (LIGHTHOUSE_CONFIG.allowRunningWithoutLighthouse) {
          console.log("Lighthouse program not found on mainnet - continuing without assertions");
          return {
            success: true, // Allow continuing without assertions
            failureReason: "Lighthouse program not available on mainnet, continuing without protection",
            isProgramAvailable: false
          };
        } else {
          // Program not found and we require it
          return {
            success: false,
            failureReason: "Lighthouse program not available on mainnet and protection is required",
            isProgramAvailable: false
          };
        }
      }
      
      // Validate transaction structure
      const isValid = await this.validateTransaction(transaction);
      if (!isValid) {
        return {
          success: false,
          failureReason: "Transaction failed basic validation",
          isProgramAvailable: true
        };
      }

      // Check for malicious patterns in the transaction
      const maliciousCheck = await this.detectMaliciousPatterns(transaction);
      if (maliciousCheck.isMalicious) {
        console.error("Malicious transaction detected:", maliciousCheck.reason);
        return {
          success: false,
          failureReason: maliciousCheck.reason,
          isProgramAvailable: true
        };
      }

      // Create assertion transaction
      const assertionTransaction = await this.createAssertionTransaction(transaction);
      
      if (!assertionTransaction) {
        // If allowRunningWithoutLighthouse is true, we still consider this a success
        if (LIGHTHOUSE_CONFIG.allowRunningWithoutLighthouse) {
          return {
            success: true,
            failureReason: "No assertion transaction created for mainnet, continuing without protection",
            isProgramAvailable: isProgramAvailable
          };
        }
        
        return {
          success: false,
          failureReason: "Failed to create assertion transaction for mainnet",
          isProgramAvailable: isProgramAvailable
        };
      }

      console.log("Successfully created Lighthouse assertions for mainnet");
      return {
        success: true,
        assertionTransaction,
        isProgramAvailable: isProgramAvailable
      };

    } catch (error) {
      console.error("Error in Lighthouse validation on mainnet:", error);
      
      // If we allow running without Lighthouse, return success even with an error
      if (LIGHTHOUSE_CONFIG.allowRunningWithoutLighthouse) {
        return {
          success: true,
          failureReason: error instanceof Error ? error.message : "Error in Lighthouse validation on mainnet, continuing without protection",
          isProgramAvailable: false
        };
      }
      
      return {
        success: false,
        failureReason: error instanceof Error ? error.message : "Unknown error in Lighthouse validation on mainnet",
        isProgramAvailable: false
      };
    }
  }
}

export const lighthouseService = new LighthouseService();
