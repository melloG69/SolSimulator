
import { supabase } from "@/integrations/supabase/client";
import { Json } from "@/integrations/supabase/types";
import { toast } from "sonner";

// Timeout for Supabase operations
const SUPABASE_TIMEOUT = 5000; // 5 seconds

// Helper to add timeout to Supabase operations
const withTimeout = (promise: Promise<any>, ms: number) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms)
    )
  ]);
};

export const setWalletContext = async (walletAddress: string) => {
  try {
    console.log('Setting wallet context for:', walletAddress);
    const { error } = await withTimeout(
      supabase.rpc('set_wallet_context', { wallet: walletAddress }),
      SUPABASE_TIMEOUT
    );
    
    if (error) {
      console.error("Error setting wallet context:", error);
      throw error;
    }
    console.log('Wallet context set successfully');
  } catch (error) {
    console.error("Error in setWalletContext:", error);
    
    // Make this a non-blocking error
    if (error instanceof Error) {
      // Only show a toast for timeout errors
      if (error.message.includes('timed out')) {
        toast(`Supabase connection timed out. Some features may be limited.`);
      }
    }
    
    throw error;
  }
};

export const createBundle = async (bundleId: string, walletAddress: string) => {
  try {
    const { error } = await withTimeout(
      supabase.from('transaction_bundles').insert({
        id: bundleId,
        wallet_address: walletAddress,
        status: 'pending'
      }),
      SUPABASE_TIMEOUT
    );

    if (error) {
      console.error("Insert error:", error);
      throw new Error(`Failed to insert bundle: ${error.message}`);
    }
  } catch (error) {
    console.error("Error creating bundle:", error);
    // Make this a non-blocking error - just for logging
    throw error;
  }
};

export const updateBundleStatus = async (
  bundleId: string, 
  status: 'failed' | 'simulated', 
  simulationResult: Json
) => {
  try {
    await withTimeout(
      supabase.from('transaction_bundles').update({
        status,
        simulation_result: simulationResult
      }).eq('id', bundleId),
      SUPABASE_TIMEOUT
    );
  } catch (error) {
    console.error("Error updating bundle status:", error);
    // Make this a non-blocking error - just for logging
    // We don't throw here because this should never block the UI
  }
};
