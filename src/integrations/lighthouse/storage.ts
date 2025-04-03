
import { setWalletContext, createBundle, updateBundleStatus } from "@/utils/bundleStorage";

/**
 * Lighthouse integration storage utilities
 * 
 * This module handles the persistence of Lighthouse-related data
 * including protection status, assertion transactions, and bundle information.
 */

// Storage keys
const LIGHTHOUSE_STATUS_KEY = "lighthouse_status";
const LIGHTHOUSE_ASSERTIONS_KEY = "lighthouse_assertions";

// Store Lighthouse program availability status
export const setLighthouseStatus = (isAvailable: boolean): void => {
  try {
    localStorage.setItem(LIGHTHOUSE_STATUS_KEY, JSON.stringify({ 
      isAvailable, 
      timestamp: new Date().toISOString() 
    }));
  } catch (error) {
    console.error("Error storing Lighthouse status:", error);
  }
};

// Get Lighthouse program availability status
export const getLighthouseStatus = (): { isAvailable: boolean, timestamp: string } | null => {
  try {
    const status = localStorage.getItem(LIGHTHOUSE_STATUS_KEY);
    return status ? JSON.parse(status) : null;
  } catch (error) {
    console.error("Error retrieving Lighthouse status:", error);
    return null;
  }
};

// Store Lighthouse assertion information for a bundle
export const storeAssertionInfo = (bundleId: string, info: any): void => {
  try {
    const key = `${LIGHTHOUSE_ASSERTIONS_KEY}_${bundleId}`;
    localStorage.setItem(key, JSON.stringify({
      ...info,
      timestamp: new Date().toISOString()
    }));
  } catch (error) {
    console.error("Error storing assertion info:", error);
  }
};

// Create a new bundle with Lighthouse protection information
export const createLighthouseBundle = async (
  walletAddress: string,
  protectionEnabled: boolean
) => {
  try {
    // Generate bundle ID
    const bundleId = crypto.randomUUID();
    
    // Store wallet context
    await setWalletContext(walletAddress);
    
    // Create bundle with Lighthouse information
    await createBundle(bundleId, walletAddress);
    
    // Store Lighthouse-specific metadata
    storeAssertionInfo(bundleId, {
      protectionEnabled,
      status: 'pending'
    });
    
    return { 
      success: true, 
      bundleId 
    };
  } catch (error) {
    console.error("Error creating Lighthouse bundle:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
};

// Update bundle status with Lighthouse-specific information
export const updateLighthouseBundleStatus = async (
  bundleId: string,
  status: 'failed' | 'simulated' | 'executed',
  result: any,
  lighthouseInfo: {
    protectionEnabled: boolean;
    assertionCount: number;
    issues?: Record<string, any>;
  }
) => {
  try {
    // Update general bundle status
    await updateBundleStatus(bundleId, status, {
      ...result,
      lighthouse: lighthouseInfo
    });
    
    // Update Lighthouse-specific metadata
    storeAssertionInfo(bundleId, {
      ...lighthouseInfo,
      status
    });
    
    return { success: true };
  } catch (error) {
    console.error("Error updating Lighthouse bundle status:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
};
