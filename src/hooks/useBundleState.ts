
import { useState, useEffect } from "react";
import { Transaction } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";

export type SimulationStatus = 'idle' | 'success' | 'failed';
export type ExecutionStatus = 'idle' | 'success' | 'failed';

export const useBundleState = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [simulationStatus, setSimulationStatus] = useState<SimulationStatus>('idle');
  const [executionStatus, setExecutionStatus] = useState<ExecutionStatus>('idle');
  const { connected, connecting } = useWallet();

  // Reset states when wallet disconnects
  useEffect(() => {
    if (!connected && !connecting) {
      setTransactions([]);
      setSimulationStatus('idle');
      setExecutionStatus('idle');
      toast.info('Wallet disconnected. Please connect your wallet to continue.');
    }
  }, [connected, connecting]);

  // Show connecting state
  useEffect(() => {
    if (connecting) {
      toast.info('Connecting to wallet...');
    }
  }, [connecting]);

  return {
    transactions,
    setTransactions,
    loading,
    setLoading,
    simulationStatus,
    setSimulationStatus,
    executionStatus,
    setExecutionStatus
  };
};
