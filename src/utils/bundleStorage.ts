
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

// Helpers for wallet context storage
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
