
import { 
  Transaction, 
  PublicKey, 
  TransactionInstruction,
  SYSVAR_CLOCK_PUBKEY,
  SystemProgram
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

  async buildAssertions(
    transaction: Transaction,
    strategy: AssertionStrategy
  ): Promise<AssertionResult> {
    try {
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

      // Validate all accounts exist before proceeding
      const accountValidations = await Promise.all(
        uniqueWritableAccounts.map(pubkey => this.validateAccount(pubkey))
      );

      const validAccounts = uniqueWritableAccounts.filter((_, index) => accountValidations[index]);

      if (validAccounts.length === 0) {
        console.error("No valid accounts found. Writable accounts:", uniqueWritableAccounts.map(acc => acc.toBase58()));
        return {
          success: false,
          failureReason: "No valid accounts found for assertions"
        };
      }

      // Get pre-execution state for valid accounts only
      const accountInfos = await Promise.all(
        validAccounts.map(pubkey => this.connection.getAccountInfo(pubkey))
      );

      // Build assertion data
      const assertionData = Buffer.alloc(1024);
      let offset = 0;

      // Write header
      assertionData.writeUInt8(0x1, offset);
      offset += 1;

      // Write account assertions only for valid accounts
      for (let i = 0; i < validAccounts.length; i++) {
        const accountInfo = accountInfos[i];
        if (!accountInfo) continue;

        validAccounts[i].toBuffer().copy(assertionData, offset);
        offset += 32;

        if (strategy.balanceTolerance > 0) {
          assertionData.writeBigUInt64LE(BigInt(accountInfo.lamports), offset);
          offset += 8;
        }

        if (strategy.requireOwnerMatch) {
          accountInfo.owner.toBuffer().copy(assertionData, offset);
          offset += 32;
        }

        if (strategy.requireDataMatch) {
          const dataHash = Buffer.from(accountInfo.data);
          assertionData.writeUInt32LE(dataHash.length, offset);
          offset += 4;
          dataHash.copy(assertionData, offset);
          offset += dataHash.length;
        }
      }

      // Create assertion instruction
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

