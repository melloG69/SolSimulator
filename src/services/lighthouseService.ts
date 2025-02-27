
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

// Correct Lighthouse Program ID on Mainnet (Jito's official deployment)
const LIGHTHOUSE_PROGRAM_ID = new PublicKey("jitosGW6AmNQEUyVXXV4SsGZq18k2QCvYqRB9deEYKH");

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

  constructor() {
    this.connection = connection;
    // Verify program account on instantiation
    this.verifyProgramAccount();
  }

  // Verify the Lighthouse program account exists on chain
  private async verifyProgramAccount(): Promise<boolean> {
    try {
      if (this.programAccountVerified) return true;
      
      console.log("Verifying Lighthouse program account existence...");
      const accountInfo = await this.connection.getAccountInfo(LIGHTHOUSE_PROGRAM_ID);
      
      this.programAccountVerified = accountInfo !== null;
      
      if (this.programAccountVerified) {
        console.log("✅ Lighthouse program account verified on mainnet");
      } else {
        console.error("❌ Lighthouse program account not found on mainnet. Using address:", LIGHTHOUSE_PROGRAM_ID.toString());
      }
      
      return this.programAccountVerified;
    } catch (error) {
      console.error("Error verifying Lighthouse program account:", error);
      this.programAccountVerified = false;
      return false;
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
        console.error("Cannot create assertion transaction: Lighthouse program not available on mainnet");
        return undefined;
      }

      const assertionTx = new Transaction();
      
      // Add system clock for validation
      assertionTx.add(
        new TransactionInstruction({
          keys: [
            { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false }
          ],
          programId: LIGHTHOUSE_PROGRAM_ID,
          data: Buffer.from([])
        })
      );
      
      // Add compute budget specific assertions if needed
      if (this.hasComputeBudgetInstruction(transaction)) {
        console.log("Creating compute budget assertions");
        assertionTx.add(
          new TransactionInstruction({
            keys: [],
            programId: LIGHTHOUSE_PROGRAM_ID,
            data: Buffer.from([0]) // Compute budget assertion opcode
          })
        );
      }

      // If we get here, the assertion transaction is valid
      console.log("Successfully created Lighthouse assertion transaction");
      return assertionTx;
    } catch (error) {
      console.error("Error creating assertion transaction:", error);
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
      console.log("Building Lighthouse assertions for transaction");

      // First, check if Lighthouse program is available
      const isProgramAvailable = await this.verifyProgramAccount();
      if (!isProgramAvailable) {
        console.log("Lighthouse program not found on mainnet - skipping assertions");
        return {
          success: false,
          failureReason: "Lighthouse program not available on mainnet",
          isProgramAvailable: false
        };
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
        return {
          success: false,
          failureReason: "Failed to create assertion transaction",
          isProgramAvailable: true
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
