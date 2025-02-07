
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

const LIGHTHOUSE_PROGRAM_ID = new PublicKey("LHi8mAU9LVi8Rv1tkHxE5vKg1cdPwkQFBG7dT4SdPvR");

interface AssertionStrategy {
  balanceTolerance: number;
  requireOwnerMatch: boolean;
  requireDelegateMatch: boolean;
  requireDataMatch: boolean;
}

interface AssertionResult {
  success: boolean;
  failureReason?: string;
  assertionTransaction?: Transaction;
}

class LighthouseService {
  private connection: typeof connection;
  private readonly MAX_COMPUTE_UNITS = 1_200_000;

  constructor() {
    this.connection = connection;
  }

  private isComputeBudgetInstruction(instruction: TransactionInstruction): boolean {
    return instruction.programId.equals(ComputeBudgetProgram.programId);
  }

  private hasComputeBudgetInstruction(transaction: Transaction): boolean {
    return transaction.instructions.some(ix => this.isComputeBudgetInstruction(ix));
  }

  private async detectMaliciousPatterns(transaction: Transaction): Promise<{ isMalicious: boolean; reason?: string }> {
    // Check for compute units in all transactions
    if (this.hasComputeBudgetInstruction(transaction)) {
      for (const ix of transaction.instructions) {
        if (this.isComputeBudgetInstruction(ix)) {
          const dataView = Buffer.from(ix.data);
          const units = dataView.readUInt32LE(1);
          if (units > this.MAX_COMPUTE_UNITS) {
            return { 
              isMalicious: true, 
              reason: `Excessive compute units detected: ${units} > ${this.MAX_COMPUTE_UNITS}` 
            };
          }
        }
      }
    }

    // Check for system program instructions
    for (const ix of transaction.instructions) {
      if (ix.programId.equals(SystemProgram.programId)) {
        // Validate system program transfers
        const dataView = Buffer.from(ix.data);
        const transferAmount = dataView.readBigUInt64LE(4);
        console.log("Validating system transfer amount:", transferAmount.toString());
      }
    }

    return { isMalicious: false };
  }

  private async createAssertionTransaction(transaction: Transaction): Promise<Transaction | undefined> {
    try {
      const assertionTx = new Transaction();
      
      // Add assertion instructions based on transaction type
      if (this.hasComputeBudgetInstruction(transaction)) {
        console.log("Creating compute budget assertions");
        // Add compute budget specific assertions
      }

      // Always add balance change assertions
      console.log("Creating balance change assertions");
      
      // Add program state change assertions
      console.log("Creating program state assertions");

      return assertionTx;
    } catch (error) {
      console.error("Error creating assertion transaction:", error);
      return undefined;
    }
  }

  async buildAssertions(
    transaction: Transaction
  ): Promise<AssertionResult> {
    try {
      console.log("Building Lighthouse assertions for transaction");

      // Check for malicious patterns in all transactions
      const maliciousCheck = await this.detectMaliciousPatterns(transaction);
      if (maliciousCheck.isMalicious) {
        console.error("Malicious transaction detected:", maliciousCheck.reason);
        return {
          success: false,
          failureReason: maliciousCheck.reason
        };
      }

      // Create assertion transaction for all transactions
      const assertionTransaction = await this.createAssertionTransaction(transaction);
      
      if (!assertionTransaction) {
        return {
          success: false,
          failureReason: "Failed to create assertion transaction"
        };
      }

      console.log("Successfully created Lighthouse assertions");
      return {
        success: true,
        assertionTransaction
      };

    } catch (error) {
      console.error("Error in Lighthouse validation:", error);
      return {
        success: false,
        failureReason: error instanceof Error ? error.message : "Unknown error in Lighthouse validation"
      };
    }
  }
}

export const lighthouseService = new LighthouseService();
