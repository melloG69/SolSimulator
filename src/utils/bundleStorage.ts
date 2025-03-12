
// In-memory storage as fallback if localStorage is not available
let memoryStorage: Record<string, any> = {};

// Check if localStorage is available
const isLocalStorageAvailable = () => {
  try {
    const testKey = "__test__";
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
};

// Helpers for bundle storage
const BUNDLE_STORAGE_KEY = "solana_bundles";
const WALLET_CONTEXT_KEY = "current_wallet";

export const setWalletContext = async (walletAddress: string) => {
  try {
    if (isLocalStorageAvailable()) {
      localStorage.setItem(WALLET_CONTEXT_KEY, walletAddress);
    } else {
      memoryStorage[WALLET_CONTEXT_KEY] = walletAddress;
    }
    console.log('Wallet context set successfully:', walletAddress);
    return { success: true };
  } catch (error) {
    console.error("Error setting wallet context:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
};

export const getWalletContext = (): string | null => {
  try {
    if (isLocalStorageAvailable()) {
      return localStorage.getItem(WALLET_CONTEXT_KEY);
    } else {
      return memoryStorage[WALLET_CONTEXT_KEY] || null;
    }
  } catch (error) {
    console.error("Error getting wallet context:", error);
    return null;
  }
};

export const createBundle = async (bundleId: string, walletAddress: string) => {
  try {
    const bundleData = {
      id: bundleId,
      wallet_address: walletAddress,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Get existing bundles
    const existingBundlesStr = isLocalStorageAvailable() 
      ? localStorage.getItem(BUNDLE_STORAGE_KEY) 
      : memoryStorage[BUNDLE_STORAGE_KEY];
    
    const existingBundles = existingBundlesStr ? JSON.parse(existingBundlesStr) : [];
    
    // Add new bundle
    const updatedBundles = [...existingBundles, bundleData];
    
    // Save back to storage
    if (isLocalStorageAvailable()) {
      localStorage.setItem(BUNDLE_STORAGE_KEY, JSON.stringify(updatedBundles));
    } else {
      memoryStorage[BUNDLE_STORAGE_KEY] = JSON.stringify(updatedBundles);
    }
    
    console.log('Bundle created with ID:', bundleId);
    return { success: true };
  } catch (error) {
    console.error("Error creating bundle:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
};

export const updateBundleStatus = async (
  bundleId: string, 
  status: 'failed' | 'simulated' | 'executed', 
  simulationResult: any
) => {
  try {
    // Get existing bundles
    const existingBundlesStr = isLocalStorageAvailable() 
      ? localStorage.getItem(BUNDLE_STORAGE_KEY) 
      : memoryStorage[BUNDLE_STORAGE_KEY];
    
    const existingBundles = existingBundlesStr ? JSON.parse(existingBundlesStr) : [];
    
    // Find and update bundle
    const updatedBundles = existingBundles.map((bundle: any) => {
      if (bundle.id === bundleId) {
        return {
          ...bundle,
          status,
          simulation_result: simulationResult,
          updated_at: new Date().toISOString()
        };
      }
      return bundle;
    });
    
    // Save back to storage
    if (isLocalStorageAvailable()) {
      localStorage.setItem(BUNDLE_STORAGE_KEY, JSON.stringify(updatedBundles));
    } else {
      memoryStorage[BUNDLE_STORAGE_KEY] = JSON.stringify(updatedBundles);
    }
    
    console.log(`Bundle ${bundleId} status updated to ${status}`);
    return { success: true };
  } catch (error) {
    console.error("Error updating bundle status:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
};

export const getBundleById = (bundleId: string) => {
  try {
    // Get existing bundles
    const existingBundlesStr = isLocalStorageAvailable() 
      ? localStorage.getItem(BUNDLE_STORAGE_KEY) 
      : memoryStorage[BUNDLE_STORAGE_KEY];
    
    const existingBundles = existingBundlesStr ? JSON.parse(existingBundlesStr) : [];
    
    // Find bundle
    return existingBundles.find((bundle: any) => bundle.id === bundleId) || null;
  } catch (error) {
    console.error("Error getting bundle:", error);
    return null;
  }
};
