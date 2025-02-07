
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

  private async validateAccount(pubkey: PublicKey): Promise<boolean> {
    try {
      const accountInfo = await this.connection.getAccountInfo(pubkey);
      return accountInfo !== null;
    } catch (error) {
      console.error("Error validating account:", error);
      return false;
    }
  }

  private async validateProgramAccount(programId: PublicKey): Promise<boolean> {
    try {
      const accountInfo = await this.connection.getAccountInfo(programId);
      return accountInfo !== null && accountInfo.executable;
    } catch (error) {
      console.error("Error validating program account:", error);
      return false;
    }
  }

  private async detectMaliciousPatterns(transaction: Transaction): Promise<{ isMalicious: boolean; reason?: string }> {
    // Check for excessive compute units
    const computeIx = transaction.instructions.find(ix => 
      ix.programId.equals(ComputeBudgetProgram.programId)
    );
    
    if (computeIx) {
      const dataView = Buffer.from(computeIx.data);
      const units = dataView.readUInt32LE(1);
      if (units > this.MAX_COMPUTE_UNITS) {
        return { 
          isMalicious: true, 
          reason: `Excessive compute units detected: ${units} > ${this.MAX_COMPUTE_UNITS}` 
        };
      }
    }

    // Check for potential balance drain attacks
    const systemTransfers = transaction.instructions.filter(ix => 
      ix.programId.equals(SystemProgram.programId)
    );

    for (const transfer of systemTransfers) {
      const fromAccount = transfer.keys.find(key => key.isWritable && key.isSigner);
      if (fromAccount) {
        const accountInfo = await this.connection.getAccountInfo(fromAccount.pubkey);
        if (accountInfo) {
          const dataView = Buffer.from(transfer.data);
          const transferAmount = dataView.readBigUInt64LE(1);
          if (transferAmount > BigInt(accountInfo.lamports)) {
            return {
              isMalicious: true,
              reason: "Balance drain attack detected: Transfer amount exceeds account balance"
            };
          }
        }
      }
    }

    // Check for ownership changes
    const ownershipChanges = transaction.instructions.filter(ix =>
      ix.data[0] === 0x01 // Ownership change instruction
    );

    if (ownershipChanges.length > 0) {
      return {
        isMalicious: true,
        reason: "Unauthorized ownership change detected"
      };
    }

    return { isMalicious: false };
  }

  private getValidationStrategy(transaction: Transaction): AssertionStrategy {
    return {
      balanceTolerance: 1,
      requireOwnerMatch: true,
      requireDelegateMatch: true,
      requireDataMatch: true
    };
  }

  async buildAssertions(
    transaction: Transaction,
    providedStrategy?: AssertionStrategy
  ): Promise<AssertionResult> {
    try {
      // First check for malicious patterns
      const maliciousCheck = await this.detectMaliciousPatterns(transaction);
      if (maliciousCheck.isMalicious) {
        console.error("Malicious transaction detected:", maliciousCheck.reason);
        return {
          success: false,
          failureReason: maliciousCheck.reason
        };
      }

      const strategy = providedStrategy || this.getValidationStrategy(transaction);
      
      const assertionTransaction = new Transaction();
      
      // Get all writable accounts including the fee payer
      const writableAccounts = [
        transaction.feePayer!,
        ...transaction.instructions
          .flatMap(ix => ix.keys.filter(key => key.isWritable))
          .map(key => key.pubkey)
      ];

      // Filter out duplicates
      const uniqueWritableAccounts = Array.from(new Set(writableAccounts.map(acc => acc.toBase58())))
        .map(addr => new PublicKey(addr));

      console.log("Writable accounts for assertions:", uniqueWritableAccounts.map(acc => acc.toBase58()));

      // Validate all accounts and programs exist before proceeding
      const [accountValidations, programValidations] = await Promise.all([
        Promise.all(uniqueWritableAccounts.map(pubkey => this.validateAccount(pubkey))),
        Promise.all(transaction.instructions.map(ix => this.validateProgramAccount(ix.programId)))
      ]);

      if (!programValidations.every(Boolean)) {
        console.error("One or more program accounts not found");
        return {
          success: false,
          failureReason: "Program account not found"
        };
      }

      const validAccounts = uniqueWritableAccounts.filter((_, index) => accountValidations[index]);

      if (validAccounts.length === 0) {
        console.error("No valid accounts found for assertions");
        return {
          success: false,
          failureReason: "No valid accounts found for assertions"
        };
      }

      // Get pre-execution state
      const accountInfos = await Promise.all(
        validAccounts.map(pubkey => this.connection.getAccountInfo(pubkey))
      );

      // Build assertion data
      const assertionData = Buffer.alloc(1024);
      let offset = 0;

      assertionData.writeUInt8(0x1, offset);
      offset += 1;

      for (let i = 0; i < validAccounts.length; i++) {
        const accountInfo = accountInfos[i];
        if (!accountInfo) continue;

        validAccounts[i].toBuffer().copy(assertionData, offset);
        offset += 32;

        assertionData.writeBigUInt64LE(BigInt(accountInfo.lamports), offset);
        offset += 8;

        accountInfo.owner.toBuffer().copy(assertionData, offset);
        offset += 32;

        const dataHash = Buffer.from(accountInfo.data);
        assertionData.writeUInt32LE(dataHash.length, offset);
        offset += 4;
        dataHash.copy(assertionData, offset);
        offset += dataHash.length;
      }

      const assertionInstruction = new TransactionInstruction({
        programId: LIGHTHOUSE_PROGRAM_ID,
        keys: [
          ...validAccounts.map(pubkey => ({
            pubkey,
            isSigner: false,
            isWritable: false
          })),
          {
            pubkey: SYSVAR_CLOCK_PUBKEY,
            isSigner: false,
            isWritable: false
          }
        ],
        data: assertionData.slice(0, offset)
      });

      assertionTransaction.add(assertionInstruction);

      return {
        success: true,
        assertionTransaction
      };
    } catch (error) {
      console.error("Error building Lighthouse assertions:", error);
      return {
        success: false,
        failureReason: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }
}

export const lighthouseService = new LighthouseService();
