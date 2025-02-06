
import { supabase } from "@/integrations/supabase/client";

export const setWalletContext = async (walletAddress: string) => {
  try {
    console.log('Setting wallet context for:', walletAddress);
    const { error } = await supabase.rpc('set_wallet_context', { wallet: walletAddress });
    if (error) {
      console.error("Error setting wallet context:", error);
      throw error;
    }
    console.log('Wallet context set successfully');
  } catch (error) {
    console.error("Error in setWalletContext:", error);
    throw error;
  }
};

export const createBundle = async (bundleId: string, walletAddress: string) => {
  const { error } = await supabase.from('transaction_bundles').insert({
    id: bundleId,
    wallet_address: walletAddress,
    status: 'pending'
  });

  if (error) {
    console.error("Insert error:", error);
    throw new Error(`Failed to insert bundle: ${error.message}`);
  }
};

export const updateBundleStatus = async (
  bundleId: string, 
  status: 'failed' | 'simulated', 
  simulationResult: object
) => {
  await supabase.from('transaction_bundles').update({
    status,
    simulation_result: simulationResult
  }).eq('id', bundleId);
};
