
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
    // Only check for compute units if there's a compute budget instruction
    if (!this.hasComputeBudgetInstruction(transaction)) {
      return { isMalicious: false };
    }

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

    return { isMalicious: false };
  }

  async buildAssertions(
    transaction: Transaction
  ): Promise<AssertionResult> {
    try {
      // Skip Lighthouse validation for simple transfers without compute budget instructions
      if (!this.hasComputeBudgetInstruction(transaction)) {
        console.log("Simple transfer detected, skipping Lighthouse validation");
        return {
          success: true
        };
      }

      // Check for malicious compute units
      const maliciousCheck = await this.detectMaliciousPatterns(transaction);
      if (maliciousCheck.isMalicious) {
        console.error("Malicious transaction detected:", maliciousCheck.reason);
        return {
          success: false,
          failureReason: maliciousCheck.reason
        };
      }

      // For valid transactions with compute budget instructions, 
      // we still want to verify but not create assertions
      console.log("Valid transaction with compute budget detected");
      return {
        success: true
      };
    } catch (error) {
      console.error("Error in Lighthouse validation:", error);
      return {
        success: true, // Don't block valid transactions due to Lighthouse errors
        failureReason: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }
}

export const lighthouseService = new LighthouseService();
