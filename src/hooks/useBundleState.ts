
import { useState, useEffect } from "react";
import { Transaction } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";

export type SimulationStatus = 'idle' | 'success' | 'failed';

export interface SimulationResult {
  success: boolean;
  message?: string;
}

export const useBundleState = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [simulationResults, setSimulationResults] = useState<SimulationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [simulationStatus, setSimulationStatus] = useState<SimulationStatus>('idle');
  const [isExecutable, setIsExecutable] = useState<boolean | null>(null);
  const { connected, connecting } = useWallet();

  useEffect(() => {
    if (!connected && !connecting) {
      setTransactions([]);
      setSimulationResults([]);
      setSimulationStatus('idle');
      setIsExecutable(null);
      toast.info('Wallet disconnected. Please connect your wallet to continue.');
    }
  }, [connected, connecting]);

  useEffect(() => {
    if (connecting) {
      toast.info('Connecting to wallet...');
    }
  }, [connecting]);

  // Reset executable status when transactions change
  useEffect(() => {
    setIsExecutable(null);
  }, [transactions]);

  // Update executable status whenever simulation results change
  useEffect(() => {
    if (simulationStatus === 'success' || simulationStatus === 'failed') {
      // Bundle is executable if all transactions succeeded
      const canExecute = simulationResults.length > 0 && 
        simulationResults.every(result => result.success);
      console.log('Setting isExecutable to:', canExecute, 'based on results:', simulationResults);
      setIsExecutable(canExecute);
    }
  }, [simulationResults, simulationStatus]);

  // Helper function to check if the bundle is executable
  const isBundleExecutable = (results: SimulationResult[]): boolean => {
    if (results.length === 0) return false;
    return results.every(result => result.success);
  };

  return {
    transactions,
    setTransactions,
    simulationResults,
    setSimulationResults,
    loading,
    setLoading,
    simulationStatus,
    setSimulationStatus,
    isExecutable,
    setIsExecutable,
    isBundleExecutable
  };
};
