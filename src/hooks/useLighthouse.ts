
import { useState, useEffect, useCallback } from 'react';
import { Transaction, PublicKey } from '@solana/web3.js';
import { lighthouseService } from '@/services/lighthouseService';
import { createLighthouseGuardrail, analyzeBundleSecurity } from '@/integrations/lighthouse';
import { getLighthouseStatus, setLighthouseStatus } from '@/integrations/lighthouse/storage';

export const useLighthouse = () => {
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Check if Lighthouse is available on the current network
  useEffect(() => {
    const checkAvailability = async () => {
      try {
        // Try to get cached status first
        const cachedStatus = getLighthouseStatus();
        
        if (cachedStatus) {
          setIsAvailable(cachedStatus.isAvailable);
          
          // If cache is older than 1 hour, refresh in the background
          const cacheTime = new Date(cachedStatus.timestamp).getTime();
          const oneHour = 60 * 60 * 1000;
          
          if (Date.now() - cacheTime > oneHour) {
            refreshAvailability();
          }
        } else {
          // No cached status, check immediately
          await refreshAvailability();
        }
      } catch (error) {
        console.error("Error in useLighthouse hook:", error);
        setIsAvailable(false);
      }
    };
    
    checkAvailability();
  }, []);
  
  // Refresh Lighthouse availability status
  const refreshAvailability = async () => {
    try {
      setIsLoading(true);
      const result = await lighthouseService.checkProgramAvailability();
      setIsAvailable(result.isProgramAvailable);
      setLighthouseStatus(result.isProgramAvailable);
    } catch (error) {
      console.error("Error checking Lighthouse availability:", error);
      setIsAvailable(false);
      setLighthouseStatus(false);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Protect a bundle of transactions with Lighthouse assertions
  const protectBundle = useCallback(async (
    transactions: Transaction[], 
    feePayer: PublicKey
  ) => {
    if (!isAvailable) {
      console.warn("Lighthouse not available, returning original transactions");
      return {
        success: true,
        protectedTransactions: transactions,
        assertionCount: 0,
        error: "Lighthouse not available on this network"
      };
    }
    
    return await createLighthouseGuardrail(transactions, feePayer);
  }, [isAvailable]);
  
  // Analyze a bundle for security issues
  const analyzeBundle = useCallback(async (transactions: Transaction[]) => {
    return await analyzeBundleSecurity(transactions);
  }, []);

  return {
    isAvailable,
    isLoading,
    protectBundle,
    analyzeBundle,
    refreshAvailability
  };
};
