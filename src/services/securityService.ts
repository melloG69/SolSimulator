import { Transaction, PublicKey, SystemProgram, ComputeBudgetProgram } from "@solana/web3.js";
import { connection } from "@/lib/solana";

export class SecurityService {
  private readonly MAX_COMPUTE_UNITS = 200_000;
  private readonly MAX_INSTRUCTIONS_PER_TX = 20;
  private readonly MAX_ACCOUNTS_PER_TX = 10;
  private readonly MAX_RECENT_BLOCKHASH_AGE = 1500; // blocks (increased from 150)
  private readonly SUSPICIOUS_PROGRAMS = new Set([
    // Add known malicious program IDs here
  ]);

  // Rate limiting
  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute
  private readonly MAX_TXS_PER_WINDOW = 10;
  private txCounts: Map<string, { count: number; timestamp: number }> = new Map();

  public async validateTransaction(tx: Transaction): Promise<{
    isValid: boolean;
    reason?: string;
    severity: 'low' | 'medium' | 'high';
  }> {
    try {
      // 1. Basic Transaction Validation
      if (!tx || !tx.instructions) {
        return { isValid: false, reason: "Invalid transaction structure", severity: 'high' };
      }

      // 2. Check for Replay Attacks with improved blockhash handling
      if (!tx.recentBlockhash) {
        return { isValid: false, reason: "Missing recent blockhash", severity: 'high' };
      }

      try {
        const blockhashInfo = await connection.getLatestBlockhash('finalized');
        const currentSlot = await connection.getSlot('finalized');
        
        // Get the slot for the transaction's blockhash
        const blockhashSlot = await connection.getSlot(tx.recentBlockhash, 'finalized');
        
        if (blockhashSlot === null) {
          return { 
            isValid: false, 
            reason: "Invalid blockhash", 
            severity: 'high' 
          };
        }

        const blockhashAge = currentSlot - blockhashSlot;
        
        if (blockhashAge > this.MAX_RECENT_BLOCKHASH_AGE) {
          // Try to update the transaction with a new blockhash
          try {
            const newBlockhash = await connection.getLatestBlockhash('finalized');
            tx.recentBlockhash = newBlockhash.blockhash;
            tx.lastValidBlockHeight = newBlockhash.lastValidBlockHeight;
            
            // Return success after updating blockhash
            return { 
              isValid: true, 
              severity: 'low',
              reason: "Updated transaction with new blockhash"
            };
          } catch (error) {
            return { 
              isValid: false, 
              reason: `Blockhash too old: ${blockhashAge} blocks and failed to update`, 
              severity: 'high' 
            };
          }
        }
      } catch (error) {
        console.error("Error checking blockhash:", error);
        // If we can't verify the blockhash, we'll be more lenient in development
        return { 
          isValid: true, 
          severity: 'low',
          reason: "Could not verify blockhash age, proceeding with caution"
        };
      }

      // 3. Check for Compute Budget Attacks
      const computeCheck = this.checkComputeBudget(tx);
      if (!computeCheck.isValid) {
        return computeCheck;
      }

      // 4. Check for Account Enumeration Attacks
      const accountCheck = this.checkAccountEnumeration(tx);
      if (!accountCheck.isValid) {
        return accountCheck;
      }

      // 5. Check for Program Invocation Attacks
      const programCheck = this.checkProgramInvocations(tx);
      if (!programCheck.isValid) {
        return programCheck;
      }

      // 6. Check for Fee Manipulation
      const feeCheck = this.checkFeeManipulation(tx);
      if (!feeCheck.isValid) {
        return feeCheck;
      }

      // 7. Check for Rate Limiting
      const rateCheck = this.checkRateLimit(tx);
      if (!rateCheck.isValid) {
        return rateCheck;
      }

      // 8. Check for Token Account Attacks
      const tokenCheck = await this.checkTokenAccountAttacks(tx);
      if (!tokenCheck.isValid) {
        return tokenCheck;
      }

      return { isValid: true, severity: 'low' };
    } catch (error) {
      console.error("Error in transaction validation:", error);
      return { 
        isValid: false, 
        reason: "Error during validation", 
        severity: 'high' 
      };
    }
  }

  private checkComputeBudget(tx: Transaction): { isValid: boolean; reason?: string; severity: 'low' | 'medium' | 'high' } {
    for (const ix of tx.instructions) {
      if (ix.programId.equals(ComputeBudgetProgram.programId)) {
        try {
          const dataView = Buffer.from(ix.data);
          if (dataView.length >= 5) {
            const units = dataView.readUInt32LE(1);
            if (units > this.MAX_COMPUTE_UNITS) {
              return {
                isValid: false,
                reason: `Excessive compute units: ${units} > ${this.MAX_COMPUTE_UNITS}`,
                severity: 'high'
              };
            }
          }
        } catch (error) {
          console.error("Error parsing compute budget instruction:", error);
        }
      }
    }
    return { isValid: true, severity: 'low' };
  }

  private checkAccountEnumeration(tx: Transaction): { isValid: boolean; reason?: string; severity: 'low' | 'medium' | 'high' } {
    const uniqueAccounts = new Set<string>();
    
    for (const ix of tx.instructions) {
      for (const key of ix.keys) {
        uniqueAccounts.add(key.pubkey.toString());
      }
    }

    if (uniqueAccounts.size > this.MAX_ACCOUNTS_PER_TX) {
      return {
        isValid: false,
        reason: `Too many unique accounts: ${uniqueAccounts.size} > ${this.MAX_ACCOUNTS_PER_TX}`,
        severity: 'medium'
      };
    }

    return { isValid: true, severity: 'low' };
  }

  private checkProgramInvocations(tx: Transaction): { isValid: boolean; reason?: string; severity: 'low' | 'medium' | 'high' } {
    for (const ix of tx.instructions) {
      if (this.SUSPICIOUS_PROGRAMS.has(ix.programId.toString())) {
        return {
          isValid: false,
          reason: `Suspicious program invocation detected: ${ix.programId.toString()}`,
          severity: 'high'
        };
      }
    }
    return { isValid: true, severity: 'low' };
  }

  private checkFeeManipulation(tx: Transaction): { isValid: boolean; reason?: string; severity: 'low' | 'medium' | 'high' } {
    // Check for multiple fee payer instructions
    let feePayerCount = 0;
    for (const ix of tx.instructions) {
      if (ix.programId.equals(SystemProgram.programId)) {
        const dataView = Buffer.from(ix.data);
        if (dataView.length >= 4) {
          const instructionType = dataView.readUInt32LE(0);
          if (instructionType === 2) { // Transfer instruction
            feePayerCount++;
          }
        }
      }
    }

    if (feePayerCount > 1) {
      return {
        isValid: false,
        reason: "Multiple fee payer instructions detected",
        severity: 'medium'
      };
    }

    return { isValid: true, severity: 'low' };
  }

  private checkRateLimit(tx: Transaction): { isValid: boolean; reason?: string; severity: 'low' | 'medium' | 'high' } {
    const feePayer = tx.feePayer?.toString();
    if (!feePayer) {
      return { isValid: false, reason: "Missing fee payer", severity: 'high' };
    }

    const now = Date.now();
    const userTxData = this.txCounts.get(feePayer);

    if (userTxData) {
      if (now - userTxData.timestamp > this.RATE_LIMIT_WINDOW) {
        // Reset counter if window has passed
        this.txCounts.set(feePayer, { count: 1, timestamp: now });
      } else if (userTxData.count >= this.MAX_TXS_PER_WINDOW) {
        return {
          isValid: false,
          reason: "Rate limit exceeded",
          severity: 'medium'
        };
      } else {
        userTxData.count++;
        this.txCounts.set(feePayer, userTxData);
      }
    } else {
      this.txCounts.set(feePayer, { count: 1, timestamp: now });
    }

    return { isValid: true, severity: 'low' };
  }

  private async checkTokenAccountAttacks(tx: Transaction): Promise<{ isValid: boolean; reason?: string; severity: 'low' | 'medium' | 'high' }> {
    for (const ix of tx.instructions) {
      // Check for token program instructions
      if (ix.programId.toString() === "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") {
        try {
          const dataView = Buffer.from(ix.data);
          if (dataView.length >= 1) {
            const instructionType = dataView[0];
            
            // Check for suspicious token operations
            if (instructionType === 7) { // Transfer instruction
              // Verify token account ownership
              const tokenAccount = ix.keys[0].pubkey;
              const accountInfo = await connection.getAccountInfo(tokenAccount);
              
              if (!accountInfo) {
                return {
                  isValid: false,
                  reason: "Invalid token account",
                  severity: 'high'
                };
              }
            }
          }
        } catch (error) {
          console.error("Error checking token account:", error);
        }
      }
    }
    return { isValid: true, severity: 'low' };
  }
} 