import { Transaction, ComputeBudgetProgram } from "@solana/web3.js";
import { jitoService } from "@/services/jitoService";
import { useToast } from "@/hooks/use-toast";
import { connection } from "@/lib/solana";
import { SimulationResult } from "./useBundleState";
import { lighthouseService } from "@/services/lighthouseService";
import { setWalletContext } from "@/utils/bundleStorage";

export const useSimulationManager = () => {
  const { toast } = useToast();

  const synchronizeTransactions = async (transactions: Transaction[]) => {
    try {
      // Get latest blockhash for transaction validity
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash({
        commitment: 'confirmed'
      });
      console.log('Synchronizing transactions with blockhash:', blockhash);
      
      return Promise.all(transactions.map(async (tx, index) => {
        // Update original transaction with new blockhash
        tx.recentBlockhash = blockhash;
        tx.lastValidBlockHeight = lastValidBlockHeight;
        
        // Validate each transaction individually first
        const validationResult = await jitoService.simulateTransactions([tx], { skipLighthouseCheck: true });
        
        // Check for malicious patterns in this specific transaction
        const maliciousCheck = await lighthouseService.detectMaliciousPatterns(tx);
        
        if (maliciousCheck.isMalicious) {
          console.error(`Transaction ${index} flagged as malicious:`, maliciousCheck.reason);
          // Return the transaction by itself, marked as malicious
          return { 
            transactions: [tx], 
            index, 
            malicious: true, 
            error: maliciousCheck.reason 
          };
        }
        
        if (!validationResult.isValid && !validationResult.normalErrors) {
          console.error(`Transaction validation failed: ${validationResult.error}`);
          // Return the transaction by itself, without assertion if it's invalid
          return { 
            transactions: [tx], 
            index, 
            malicious: false, 
            error: validationResult.error 
          };
        }
        
        // Build assertions for valid transactions
        const assertionResult = await lighthouseService.buildAssertions(tx);
        
        // Check if Lighthouse program is available
        if (!assertionResult.isProgramAvailable) {
          console.log("Lighthouse program not found - continuing without assertions");
          return { 
            transactions: [tx], 
            index, 
            malicious: false 
          };
        }
        
        // If there's an assertion transaction, update it with the same blockhash
        if (assertionResult.success && assertionResult.assertionTransaction) {
          assertionResult.assertionTransaction.recentBlockhash = blockhash;
          assertionResult.assertionTransaction.lastValidBlockHeight = lastValidBlockHeight;
          if (tx.feePayer) {
            assertionResult.assertionTransaction.feePayer = tx.feePayer;
          }
          
          // Only include assertion transaction if it was successfully created
          return { 
            transactions: [tx, assertionResult.assertionTransaction], 
            index,
            malicious: false
          };
        }
        
        console.log('Transaction synchronized with blockhash:', blockhash);
        return { 
          transactions: [tx], 
          index, 
          malicious: false 
        };
      }));
    } catch (error) {
      console.error("Error synchronizing transactions:", error);
      throw error;
    }
  };

  const calculateComputeUnits = (transactions: Transaction[]): number => {
    // Default compute units per tx if not specified
    const DEFAULT_COMPUTE_UNITS = 200_000;
    
    let totalUnits = 0;
    
    transactions.forEach(tx => {
      let txUnits = DEFAULT_COMPUTE_UNITS;
      
      // Check for compute budget instructions
      for (const ix of tx.instructions) {
        if (ix.programId.toString() === ComputeBudgetProgram.programId.toString()) {
          try {
            // This is a simplified estimation - in a real app we would parse the instruction data
            txUnits = 400_000; // Assume a higher value was requested
          } catch (error) {
            console.error("Error parsing compute budget instruction:", error);
          }
        }
      }
      
      totalUnits += txUnits;
    });
    
    return totalUnits;
  };

  const estimateTransactionFees = (transactions: Transaction[]): number => {
    // Simplified fee estimation based on current Solana fee structure
    // Current base fee is approximately 0.000005 SOL per signature
    const BASE_FEE_PER_SIG = 0.000005;
    
    let totalFees = 0;
    
    transactions.forEach(tx => {
      // Count required signatures (simplified)
      const sigCount = tx.signatures.length || 1;
      totalFees += BASE_FEE_PER_SIG * sigCount;
    });
    
    return totalFees;
  };

  const simulateBundle = async (
    transactions: Transaction[],
    publicKey: string,
    setLoading: (loading: boolean) => void,
    setSimulationStatus: (status: 'idle' | 'success' | 'failed') => void
  ): Promise<{results: SimulationResult[], details: any}> => {
    if (transactions.length === 0) {
      toast({
        title: "Error",
        description: "No transactions to simulate",
        variant: "destructive",
      });
      return {results: [], details: null};
    }

    setLoading(true);
    setSimulationStatus('idle');
    
    try {
      console.log('Starting bundle simulation for wallet:', publicKey);
      
      // Store wallet context
      await setWalletContext(publicKey);

      // Check if bundle has too many transactions
      const MAX_JITO_TRANSACTIONS = 5;
      if (transactions.length > MAX_JITO_TRANSACTIONS) {
        console.error(`Bundle exceeds maximum transaction count (${MAX_JITO_TRANSACTIONS})`);
        setSimulationStatus('failed');
        
        // Calculate details for logging/UI
        const computeUnits = calculateComputeUnits(transactions);
        const estimatedFees = estimateTransactionFees(transactions);
        
        const simulationDetails = {
          bundleSize: transactions.length,
          withProtection: false,
          computeUnits,
          estimatedFees: estimatedFees.toFixed(6),
          timestamp: new Date().toISOString(),
          hasMaliciousTransactions: false,
          transactionErrors: {},
          isExecutable: false
        };
        
        toast({
          title: "Simulation Failed",
          description: `Jito bundles are limited to ${MAX_JITO_TRANSACTIONS} transactions. Your bundle has ${transactions.length}.`,
          variant: "destructive",
        });
        
        return {
          results: transactions.map(() => ({ 
            success: false, 
            message: `Bundle exceeds maximum size of ${MAX_JITO_TRANSACTIONS} transactions`
          })),
          details: simulationDetails
        };
      }

      // Validate each transaction before simulation
      for (const tx of transactions) {
        if (!tx.feePayer) {
          setSimulationStatus('failed');
          toast({
            title: "Invalid Transaction",
            description: "Transaction is missing fee payer",
            variant: "destructive",
          });
          return { 
            results: transactions.map(() => ({
            success: false, 
              message: "Transaction is missing fee payer"
            })),
            details: null
          };
        }

        if (!tx.instructions || tx.instructions.length === 0) {
          setSimulationStatus('failed');
          toast({
            title: "Invalid Transaction",
            description: "Transaction has no instructions",
            variant: "destructive",
          });
        return { 
            results: transactions.map(() => ({
              success: false,
              message: "Transaction has no instructions"
            })),
            details: null
          };
        }
      }

      // Synchronize transactions with latest blockhash
      const synchronizedResults = await synchronizeTransactions(transactions);
      
      // Check for malicious transactions
      const hasMaliciousTransactions = synchronizedResults.some(result => result.malicious);
      if (hasMaliciousTransactions) {
        setSimulationStatus('failed');
        const maliciousResults = synchronizedResults.filter(result => result.malicious);
        const errorMessages = maliciousResults.map(result => result.error).join('; ');
        
        toast({
          title: "Malicious Activity Detected",
          description: errorMessages,
          variant: "destructive", 
        });
        
        return {
          results: transactions.map(() => ({
            success: false,
            message: "Malicious activity detected in bundle"
          })),
          details: {
            hasMaliciousTransactions: true,
            maliciousDetails: maliciousResults
          }
        };
      }

      // Simulate the synchronized transactions
      const simulationResult = await jitoService.simulateTransactions(
        synchronizedResults.flatMap(result => result.transactions)
      );

      if (!simulationResult.isValid) {
        setSimulationStatus('failed');
        toast({
          title: "Simulation Failed",
          description: simulationResult.error || "Transaction simulation failed",
          variant: "destructive",
        });
        
        return {
          results: transactions.map(() => ({
            success: false,
            message: simulationResult.error || "Transaction simulation failed"
          })),
          details: simulationResult.details
        };
      }

      // Calculate simulation details
      const computeUnits = calculateComputeUnits(transactions);
      const estimatedFees = estimateTransactionFees(transactions);
      
      const simulationDetails = {
        bundleSize: transactions.length,
        withProtection: true,
        computeUnits,
        estimatedFees: estimatedFees.toFixed(6),
        timestamp: new Date().toISOString(),
        hasMaliciousTransactions: false,
        transactionErrors: {},
        isExecutable: true
      };

      setSimulationStatus('success');
      toast({
        title: "Simulation Successful",
        description: "Bundle is valid and ready for execution",
      });
      
      return {
        results: transactions.map(() => ({
          success: true,
          message: "Transaction simulated successfully"
        })),
        details: simulationDetails
      };
    } catch (error) {
      console.error("Error simulating bundle:", error);
      setSimulationStatus('failed');
      
      toast({
        title: "Simulation Error",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
      
      return {
        results: transactions.map(() => ({ 
          success: false, 
          message: error instanceof Error ? error.message : "Unknown error occurred" 
        })),
        details: null
      };
    } finally {
      setLoading(false);
    }
  };

  return {
    simulateBundle
  };
};
