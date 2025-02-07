
import { useState, useEffect } from "react";
import { Transaction } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";

export type SimulationStatus = 'idle' | 'success' | 'failed';
export type ExecutionStatus = 'idle' | 'success' | 'failed';

export interface SimulationResult {
  success: boolean;
  message?: string;
  bundleId?: string;
}

export const useBundleState = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [signatures, setSignatures] = useState<string[]>([]);
  const [simulationResults, setSimulationResults] = useState<SimulationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [simulationStatus, setSimulationStatus] = useState<SimulationStatus>('idle');
  const [executionStatus, setExecutionStatus] = useState<ExecutionStatus>('idle');
  const { connected, connecting } = useWallet();

  useEffect(() => {
    if (!connected && !connecting) {
      setTransactions([]);
      setSignatures([]);
      setSimulationResults([]);
      setSimulationStatus('idle');
      setExecutionStatus('idle');
      toast.info('Wallet disconnected. Please connect your wallet to continue.');
    }
  }, [connected, connecting]);

  useEffect(() => {
    if (connecting) {
      toast.info('Connecting to wallet...');
    }
  }, [connecting]);

  return {
    transactions,
    setTransactions,
    signatures,
    setSignatures,
    simulationResults,
    setSimulationResults,
    loading,
    setLoading,
    simulationStatus,
    setSimulationStatus,
    executionStatus,
    setExecutionStatus
  };
};
