
import { 
  Transaction, 
  PublicKey, 
  SystemProgram,
  TransactionInstruction,
  Connection
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAccount as getTokenAccount } from "@solana/spl-token";
import { connection } from "@/lib/solana";
import { 
  AccountState, 
  TokenAccountState, 
  SystemAccountState, 
  AssertionStrategy,
  LighthouseAssertion,
  AssertionResult
} from "@/types/lighthouse";
import * as crypto from 'crypto';

class LighthouseService {
  private connection: Connection;
  
  constructor() {
    this.connection = connection;
  }

  private async getAccountState(pubkey: PublicKey): Promise<AccountState | null> {
    try {
      const accountInfo = await this.connection.getAccountInfo(pubkey);
      if (!accountInfo) return null;

      return {
        pubkey,
        balance: accountInfo.lamports,
        owner: accountInfo.owner,
        data: Buffer.from(accountInfo.data)
      };
    } catch (error) {
      console.error("Error fetching account state:", error);
      return null;
    }
  }

  private async resolveTokenAccount(accountState: AccountState): Promise<TokenAccountState | null> {
    try {
      if (!accountState.owner.equals(TOKEN_PROGRAM_ID)) return null;

      const tokenAccountInfo = await getTokenAccount(this.connection, accountState.pubkey);
      
      return {
        ...accountState,
        mint: tokenAccountInfo.mint,
        amount: tokenAccountInfo.amount,
        delegate: tokenAccountInfo.delegate || null,
        delegatedAmount: tokenAccountInfo.delegatedAmount
      };
    } catch {
      return null;
    }
  }

  private async resolveSystemAccount(accountState: AccountState): Promise<SystemAccountState | null> {
    try {
      if (!accountState.owner.equals(SystemProgram.programId)) return null;

      const accountInfo = await this.connection.getAccountInfo(accountState.pubkey);
      
      return {
        ...accountState,
        executable: accountInfo?.executable || false
      };
    } catch {
      return null;
    }
  }

  private createBalanceAssertion(
    account: AccountState,
    strategy: AssertionStrategy
  ): LighthouseAssertion {
    const tolerance = account.balance * (strategy.balanceTolerance / 100);
    const minBalance = account.balance - tolerance;

    return {
      accountPubkey: account.pubkey,
      expectedBalance: minBalance,
      type: 'system'
    };
  }

  private createTokenAssertion(
    account: TokenAccountState,
    strategy: AssertionStrategy
  ): LighthouseAssertion {
    return {
      accountPubkey: account.pubkey,
      expectedOwner: strategy.requireOwnerMatch ? account.owner : undefined,
      expectedDelegate: strategy.requireDelegateMatch ? account.delegate : undefined,
      type: 'token'
    };
  }

  private createDataHashAssertion(
    account: AccountState,
    strategy: AssertionStrategy
  ): LighthouseAssertion | null {
    if (!strategy.requireDataMatch) return null;

    const dataHash = crypto
      .createHash('sha256')
      .update(account.data)
      .digest('hex');

    return {
      accountPubkey: account.pubkey,
      expectedDataHash: dataHash,
      type: 'unknown'
    };
  }

  async buildAssertions(
    transaction: Transaction,
    strategy: AssertionStrategy
  ): Promise<AssertionResult> {
    try {
      console.log("Building assertions for transaction");
      
      // Get all writable accounts from transaction
      const writableAccounts = transaction.instructions
        .flatMap(ix => ix.keys.filter(key => key.isWritable))
        .map(key => key.pubkey);

      // Get current state for all accounts
      const accountStates = await Promise.all(
        writableAccounts.map(pubkey => this.getAccountState(pubkey))
      );

      const assertions: LighthouseAssertion[] = [];

      // Process each account
      for (const state of accountStates) {
        if (!state) continue;

        // Try to resolve as token account
        const tokenAccount = await this.resolveTokenAccount(state);
        if (tokenAccount) {
          assertions.push(this.createTokenAssertion(tokenAccount, strategy));
          continue;
        }

        // Try to resolve as system account
        const systemAccount = await this.resolveSystemAccount(state);
        if (systemAccount) {
          assertions.push(this.createBalanceAssertion(systemAccount, strategy));
          continue;
        }

        // Handle as unknown account
        const dataAssertion = this.createDataHashAssertion(state, strategy);
        if (dataAssertion) {
          assertions.push(dataAssertion);
        }
      }

      // Create assertion transaction
      const assertionTransaction = new Transaction();
      assertionTransaction.add(
        new TransactionInstruction({
          programId: new PublicKey("LHi8mAU9LVi8Rv1tkHxE5vKg1cdPwkQFBG7dT4SdPvR"), // Lighthouse program ID
          keys: assertions.map(assertion => ({
            pubkey: assertion.accountPubkey,
            isWritable: false,
            isSigner: false
          })),
          data: Buffer.from(JSON.stringify(assertions))
        })
      );

      console.log("Assertions built successfully:", assertions);

      return {
        success: true,
        assertionTransaction
      };
    } catch (error) {
      console.error("Error building assertions:", error);
      return {
        success: false,
        failureReason: error instanceof Error ? error.message : "Unknown error building assertions"
      };
    }
  }
}

export const lighthouseService = new LighthouseService();
