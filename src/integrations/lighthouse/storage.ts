
import { setWalletContext } from "@/utils/bundleStorage";

/**
 * Lighthouse integration storage utilities
 * 
 * This module handles the persistence of Lighthouse-related data
 * including protection status and availability.
 */

// Storage keys
const LIGHTHOUSE_STATUS_KEY = "lighthouse_status";

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
