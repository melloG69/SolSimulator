
import { PublicKey, Transaction } from "@solana/web3.js";
import { lighthouseService } from "@/services/lighthouseService";
import { connection } from "@/lib/solana";

/**
 * Lighthouse integration for Solana transaction protection
 * 
 * This module handles creating guardrails for transaction bundles using Lighthouse assertions.
 * When properly integrated, Lighthouse will protect transactions by validating state changes
 * and preventing malicious transactions from being executed.
 */

/**
 * Creates Lighthouse protection for a transaction bundle
 * 
 * @param transactions Array of transactions to protect
 * @param feePayer PublicKey that will pay for the assertion transaction
 * @returns Object containing the original transactions and any assertion transactions
 */
export const createLighthouseGuardrail = async (
  transactions: Transaction[],
  feePayer: PublicKey
): Promise<{
  success: boolean;
  protectedTransactions: Transaction[];
  assertionCount: number;
  error?: string;
}> => {
  try {
    // Check if Lighthouse program is available
    const programCheck = await lighthouseService.checkProgramAvailability();
    
    if (!programCheck.isProgramAvailable) {
      console.warn("Lighthouse program not available on this network");
      return {
        success: true,
        protectedTransactions: [...transactions], // Return original transactions without protection
        assertionCount: 0,
        error: "Lighthouse program not available on this network"
      };
    }

    // Get latest blockhash for all transactions
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash({
      commitment: 'confirmed'
    });
    
    // Initialize protected transactions array
    const protectedTransactions: Transaction[] = [];
    let assertionCount = 0;
    
    // Process each transaction with Lighthouse protection
    for (const tx of transactions) {
      // Add the original transaction
      tx.recentBlockhash = blockhash;
      tx.lastValidBlockHeight = lastValidBlockHeight;
      protectedTransactions.push(tx);
      
      // Build assertion transaction for this tx
      const assertionResult = await lighthouseService.buildAssertions(tx);
      
      if (assertionResult.success && assertionResult.assertionTransaction) {
        // Set the blockhash and fee payer for the assertion transaction
        assertionResult.assertionTransaction.recentBlockhash = blockhash;
        assertionResult.assertionTransaction.lastValidBlockHeight = lastValidBlockHeight;
        assertionResult.assertionTransaction.feePayer = feePayer;
        
        // Add the assertion transaction to the bundle
        protectedTransactions.push(assertionResult.assertionTransaction);
        assertionCount++;
      }
    }
    
    return {
      success: true,
      protectedTransactions,
      assertionCount
    };
  } catch (error) {
    console.error("Error creating Lighthouse guardrail:", error);
    return {
      success: false,
      protectedTransactions: [...transactions], // Return original transactions without protection
      assertionCount: 0,
      error: error instanceof Error ? error.message : "Unknown error creating Lighthouse guardrail"
    };
  }
};

/**
 * Analyzes transactions to detect potentially malicious patterns
 * 
 * @param transactions Array of transactions to analyze
 * @returns Object containing analysis results
 */
export const analyzeBundleSecurity = async (
  transactions: Transaction[]
): Promise<{
  isSafe: boolean;
  maliciousTransactions: number[];
  issues: Record<number, string>;
}> => {
  const maliciousTransactions: number[] = [];
  const issues: Record<number, string> = {};
  
  // Analyze each transaction in the bundle
  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    const securityCheck = await lighthouseService.detectMaliciousPatterns(tx);
    
    if (securityCheck.isMalicious) {
      maliciousTransactions.push(i);
      issues[i] = securityCheck.reason || "Unknown malicious pattern detected";
    }
  }
  
  return {
    isSafe: maliciousTransactions.length === 0,
    maliciousTransactions,
    issues
  };
};
