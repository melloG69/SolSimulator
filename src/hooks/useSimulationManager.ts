import { Transaction, ComputeBudgetProgram } from "@solana/web3.js";
import { jitoService } from "@/services/jitoService";
import { useToast } from "@/hooks/use-toast";
import { connection } from "@/lib/solana";
import { SimulationResult } from "./useBundleState";
import { lighthouseService } from "@/services/lighthouseService";
import { setWalletContext, createBundle, updateBundleStatus } from "@/utils/bundleStorage";

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
      
      // Create a unique bundle ID
      const bundleId = crypto.randomUUID();
      
      // Store wallet context and bundle information locally
      await setWalletContext(publicKey);
      await createBundle(bundleId, publicKey);
      console.log('Bundle created with ID:', bundleId);

      // Synchronize transactions with latest blockhash and check for malicious ones
      const synchronizedResults = await synchronizeTransactions(transactions);
      
      // Track which transactions are malicious
      const maliciousFlags = synchronizedResults.map(result => result.malicious);
      const hasMaliciousTransactions = maliciousFlags.some(flag => flag === true);
      
      // Create a mapping of errors for each transaction
      const transactionErrors = synchronizedResults.reduce((acc, result) => {
        if (result.error) {
          acc[result.index] = result.error;
        }
        return acc;
      }, {} as Record<number, string>);
      
      // Prepare two sets of transactions:
      // 1. All transactions for display purposes
      // 2. Only valid transactions for simulation
      
      // Flatten transactions for simulation, ignoring malicious ones
      const flattenedTransactions = synchronizedResults
        .filter(result => !result.malicious)
        .flatMap(result => result.transactions);
      
      // Prepare simulation results for each transaction based on its individual status
      const simulationResults: SimulationResult[] = transactions.map((_, index) => {
        // If this specific transaction was flagged as malicious, mark it as failed
        if (maliciousFlags[index]) {
          return { 
            success: false, 
            message: transactionErrors[index] || "Malicious transaction detected", 
            bundleId 
          };
        }
        
        // Otherwise, consider it valid for individual evaluation
        return { 
          success: true, 
          bundleId 
        };
      });
      
      // Calculate details for logging/UI
      const computeUnits = calculateComputeUnits(transactions);
      const estimatedFees = estimateTransactionFees(transactions);
      const hasLighthouseProtection = flattenedTransactions.length > 
        synchronizedResults.filter(r => !r.malicious).length;
      
      const simulationDetails = {
        bundleId,
        bundleSize: transactions.length,
        withProtection: hasLighthouseProtection,
        computeUnits,
        estimatedFees: estimatedFees.toFixed(6),
        timestamp: new Date().toISOString(),
        hasMaliciousTransactions,
        transactionErrors
      };
      
      if (hasMaliciousTransactions) {
        console.log('Bundle contains malicious transactions:', transactionErrors);
        
        // If some transactions are malicious, we'll still simulate the valid ones
        // but mark the overall bundle as failed
        if (flattenedTransactions.length > 0) {
          // Run simulation on just the valid transactions
          const validSimulationResult = await jitoService.simulateTransactions(
            flattenedTransactions, 
            { skipSanityChecks: true }
          );
          
          // Update the simulation results for valid transactions
          synchronizedResults.forEach((result, idx) => {
            if (!result.malicious) {
              simulationResults[result.index].success = true;
            }
          });
        }
        
        setSimulationStatus('failed');
        
        await updateBundleStatus(bundleId, 'failed', { 
          error: "Bundle contains malicious transactions", 
          details: simulationDetails,
          normalErrors: false
        });
        
        toast({
          title: "Simulation Detected Issues",
          description: "Some transactions in this bundle would be rejected by Lighthouse",
          variant: "destructive",
        });
        
        return {
          results: simulationResults,
          details: {
            ...simulationDetails,
            error: "Bundle contains malicious transactions"
          }
        };
      }
      
      // If we reach here, there are no malicious transactions in the bundle
      // Run the full bundle simulation
      console.log('Simulating full bundle with valid transactions:', flattenedTransactions.length);
      const simulationResult = await jitoService.simulateTransactions(flattenedTransactions, {skipSanityChecks: true});
      
      // Update details with simulation results
      simulationDetails.error = simulationResult.error || null;
      simulationDetails.normalErrors = simulationResult.normalErrors || false;
      
      // If simulation was successful, show success message
      if (simulationResult.isValid || simulationResult.normalErrors) {
        setSimulationStatus('success');
        
        await updateBundleStatus(bundleId, 'simulated', { 
          success: true,
          details: simulationDetails
        });
        
        toast({
          title: "Simulation Successful",
          description: "Bundle has been successfully simulated",
        });

        return {
          results: simulationResults,
          details: simulationDetails
        };
      } else {
        // This is actual malicious activity or other issues - show the error
        console.error('Simulation detected issues:', simulationResult.error);
        setSimulationStatus('failed');
        
        await updateBundleStatus(bundleId, 'failed', { 
          error: simulationResult.error || 'Simulation detected issues', 
          details: simulationResult.details,
          normalErrors: simulationResult.normalErrors || false
        });
        
        toast({
          title: "Simulation Failed",
          description: simulationResult.error || "Issues detected in the bundle",
          variant: "destructive",
        });
        
        // Update all transaction results to failed
        simulationResults.forEach(result => {
          result.success = false;
          result.message = simulationResult.error || "Simulation failed";
        });
        
        return {
          results: simulationResults,
          details: simulationDetails
        };
      }
    } catch (error) {
      console.error("Simulation error:", error);
      setSimulationStatus('failed');
      toast({
        title: "Simulation Failed",
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
