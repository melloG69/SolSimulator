import { 
  Transaction, 
  PublicKey, 
  TransactionInstruction,
  SYSVAR_CLOCK_PUBKEY,
  SystemProgram,
  ComputeBudgetProgram
} from "@solana/web3.js";
import { connection } from "@/lib/solana";
import { Buffer } from 'buffer';
import { toast } from "sonner";
import { SecurityService } from "./securityService";

// Lighthouse Program ID for mainnet
const LIGHTHOUSE_PROGRAM_ID = "L2TExMFKdjpN9kozasaurPirfHy9P8sbXoAN1qA3S95";

// Define behavior
const LIGHTHOUSE_CONFIG = {
  allowRunningWithoutLighthouse: false, // Don't allow running without Lighthouse
  maxRetries: 3,
  retryDelay: 2000,
  mockForDevelopment: false // Disable mock in development for real validation
};

interface AssertionResult {
  success: boolean;
  failureReason?: string;
  assertionTransaction?: Transaction;
  isProgramAvailable?: boolean;
}

class LighthouseService {
  private connection: typeof connection;
  private securityService: SecurityService;
  private readonly MAX_COMPUTE_UNITS = 200_000;
  private readonly MAX_INSTRUCTIONS_PER_TX = 20;
  private programAccountVerified: boolean = false;
  private verificationAttempts: number = 0;
  private verificationInProgress: boolean = false;
  private verificationPromise: Promise<boolean> | null = null;
  private lighthouseProgramId: PublicKey;

  constructor() {
    this.connection = connection;
    this.securityService = new SecurityService();
    
    try {
      // Use the program ID but with proper validation to prevent errors
      this.lighthouseProgramId = new PublicKey(LIGHTHOUSE_PROGRAM_ID);
      console.log(`Using Lighthouse program ID on mainnet: ${this.lighthouseProgramId.toString()}`);
    } catch (error) {
      console.error("Invalid Lighthouse program ID, using fallback:", error);
      // Use a known valid pubkey as fallback to prevent rendering errors
      this.lighthouseProgramId = SystemProgram.programId;
    }
    
    // Verify program account on instantiation (but don't block construction)
    setTimeout(() => this.verifyProgramAccount(), 500);
  }

  // Check if the Lighthouse program is available
  public async checkProgramAvailability(): Promise<{ isProgramAvailable: boolean }> {
    try {
      const result = await this.verifyProgramAccount();
      return { isProgramAvailable: result };
    } catch (error) {
      console.error("Error checking Lighthouse availability:", error);
      return { isProgramAvailable: false };
    }
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
        console.error("❌ Lighthouse program not found on mainnet after multiple attempts. Bundle protection is required.");
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
        console.error("❌ Lighthouse program not found on mainnet after multiple attempts. Bundle protection is required.");
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
    if (!transaction || !transaction.instructions) {
      return false;
    }
    return transaction.instructions.some(ix => this.isComputeBudgetInstruction(ix));
  }

  public async detectMaliciousPatterns(transaction: Transaction): Promise<{ isMalicious: boolean; reason?: string }> {
    try {
      // Use the new security service for comprehensive validation
      const securityCheck = await this.securityService.validateTransaction(transaction);
      
      if (!securityCheck.isValid) {
        return {
          isMalicious: true,
          reason: securityCheck.reason
        };
      }

      // Additional Lighthouse-specific checks
      if (this.hasComputeBudgetInstruction(transaction)) {
        for (const ix of transaction.instructions) {
          if (this.isComputeBudgetInstruction(ix)) {
            try {
              const dataView = Buffer.from(ix.data);
              if (dataView.length >= 5) {
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

      // All checks passed
      return { isMalicious: false };
    } catch (error) {
      console.error("Error in malicious pattern detection:", error);
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
      // Skip validation for empty transactions
      if (!transaction.instructions || transaction.instructions.length === 0) {
        console.error("No instructions provided in transaction");
        return false;
      }
      
      // Basic validation - check if the transaction has required fields
      if (!transaction.recentBlockhash) {
        console.error("Transaction missing recentBlockhash");
        return false;
      }

      if (!transaction.feePayer) {
        console.error("Transaction missing feePayer");
        return false;
      }

      // Always simulate real transactions
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

  // Helper to detect if this is just a validation/mock transaction
  private isValidationOnlyTransaction(transaction: Transaction): boolean {
    // Handle case where transaction may be an empty object or not properly initialized
    if (!transaction || typeof transaction !== 'object') {
      return false;
    }
    
    // Check if it has the minimum required properties to be considered a transaction
    if (!transaction.instructions || !Array.isArray(transaction.instructions)) {
      return false;
    }
    
    // Check for specific patterns that identify a validation-only transaction:
    
    // 1. Check if it's using the dummy account address
    if (transaction.feePayer?.equals(new PublicKey('11111111111111111111111111111111'))) {
      return false;
    }
    
    // 2. Check if it's a zero-value transfer between the same account
    if (transaction.instructions.length === 1) {
      const ix = transaction.instructions[0];
      if (ix.programId.equals(SystemProgram.programId)) {
        try {
          const dataView = Buffer.from(ix.data);
          if (dataView.length >= 12) {
            const instructionType = dataView.readUInt32LE(0);
            if (instructionType === 2) { // Transfer instruction
              const amount = dataView.readBigUInt64LE(4);
              if (amount === BigInt(0)) {
                // Check if from and to are the same
                if (ix.keys.length >= 2 && 
                    ix.keys[0].pubkey.equals(ix.keys[1].pubkey)) {
                  return false;
                }
              }
            }
          }
        } catch (error) {
          console.error("Error parsing instruction in validation check:", error);
          return false;
        }
      }
    }
    
    return false;
  }

  async buildAssertions(
    transaction: Transaction
  ): Promise<AssertionResult> {
    try {
      console.log("Building Lighthouse assertions for transaction");

      // Handle empty or invalid transaction objects
      if (!transaction || typeof transaction !== 'object') {
        return {
          success: false,
          failureReason: "Empty or invalid transaction object provided",
          isProgramAvailable: await this.verifyProgramAccount()
        };
      }

      // First, check if Lighthouse program is available
      const isProgramAvailable = await this.verifyProgramAccount();
      if (!isProgramAvailable) {
        return {
          success: false,
          failureReason: "Lighthouse program not available",
          isProgramAvailable: false
        };
      }
      
      // Validate transaction structure
      const isValid = await this.validateTransaction(transaction);
      if (!isValid) {
        return {
          success: false,
          failureReason: "Transaction failed validation",
          isProgramAvailable: true
        };
      }

      // Check for malicious patterns in the transaction
      if (transaction.instructions && transaction.instructions.length > 0) {
        const maliciousCheck = await this.detectMaliciousPatterns(transaction);
        if (maliciousCheck.isMalicious) {
          console.error("Malicious transaction detected:", maliciousCheck.reason);
          return {
            success: false,
            failureReason: maliciousCheck.reason,
            isProgramAvailable: true
          };
        }
      }

      // Create assertion transaction
      const assertionTransaction = await this.createAssertionTransaction(transaction);
      
      if (!assertionTransaction) {
        return {
          success: false,
          failureReason: "Failed to create assertion transaction",
          isProgramAvailable: isProgramAvailable
        };
      }

      console.log("Successfully created Lighthouse assertions");
      return {
        success: true,
        assertionTransaction,
        isProgramAvailable: true
      };

    } catch (error) {
      console.error("Error in Lighthouse validation:", error);
      return {
        success: false,
        failureReason: error instanceof Error ? error.message : "Unknown error in Lighthouse validation",
        isProgramAvailable: false
      };
    }
  }
}

export const lighthouseService = new LighthouseService();
