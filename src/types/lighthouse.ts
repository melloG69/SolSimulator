
import { PublicKey, Transaction } from "@solana/web3.js";

export interface AccountState {
  pubkey: PublicKey;
  balance: number;
  owner: PublicKey;
  data: Buffer;
}

export interface TokenAccountState extends AccountState {
  mint: PublicKey;
  amount: bigint;
  delegate: PublicKey | null;
  delegatedAmount: bigint;
}

export interface SystemAccountState extends AccountState {
  executable: boolean;
}

export type AccountType = 'token' | 'system' | 'unknown';

export interface AssertionStrategy {
  balanceTolerance: number; // Percentage of balance that can change
  requireOwnerMatch: boolean;
  requireDelegateMatch: boolean;
  requireDataMatch: boolean;
}

export interface AssertionResult {
  success: boolean;
  failureReason?: string;
  assertionTransaction?: Transaction;
}

export interface LighthouseAssertion {
  accountPubkey: PublicKey;
  expectedBalance?: number;
  expectedOwner?: PublicKey;
  expectedDelegate?: PublicKey;
  expectedDataHash?: string;
  type: AccountType;
}
