
import { useState, useEffect } from "react";
import { Transaction } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";

export type SimulationStatus = 'idle' | 'success' | 'failed';
export type ExecutionStatus = 'idle' | 'success' | 'failed';

export const useBundleState = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [simulationStatus, setSimulationStatus] = useState<SimulationStatus>('idle');
  const [executionStatus, setExecutionStatus] = useState<ExecutionStatus>('idle');
  const { connected } = useWallet();

  // Reset states when wallet disconnects
  useEffect(() => {
    if (!connected) {
      setTransactions([]);
      setSimulationStatus('idle');
      setExecutionStatus('idle');
    }
  }, [connected]);

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
