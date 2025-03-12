
import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useBundleState } from "@/hooks/useBundleState";
import { useTransactionManager } from "@/hooks/useTransactionManager";
import { useBundleOperations } from "@/hooks/useBundleOperations";
import { TransactionList } from "./bundle/TransactionList";
import { StatusAlerts } from "./bundle/StatusAlerts";
import { TransactionControls } from "./bundle/TransactionControls";
import { BundleActions } from "./bundle/BundleActions";
import { lighthouseService } from "@/services/lighthouseService";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, AlertTriangle, Info } from "lucide-react";

const BundleBuilder = () => {
  const {
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
  } = useBundleState();

  const { publicKey, signTransaction, connected } = useWallet();
  const { addTransaction, addMaliciousTransaction } = useTransactionManager(publicKey);
  const { simulateBundle, executeBundle } = useBundleOperations();
  const [lighthouseStatus, setLighthouseStatus] = useState<boolean | null>(null);

  useEffect(() => {
    const checkLighthouse = async () => {
      try {
        const result = await lighthouseService.buildAssertions({} as any);
        setLighthouseStatus(result.isProgramAvailable ?? false);
      } catch (error) {
        console.error("Error checking Lighthouse availability:", error);
        setLighthouseStatus(false);
      }
    };
    
    checkLighthouse();
  }, []);

  const handleAddTransaction = useCallback(async () => {
    const newTransaction = await addTransaction();
    if (newTransaction) {
      setTransactions(prev => [...prev, newTransaction]);
    }
  }, [addTransaction, setTransactions]);

  const handleAddMaliciousTransaction = useCallback(async () => {
    const newTransaction = await addMaliciousTransaction();
    if (newTransaction) {
      setTransactions(prev => [...prev, newTransaction]);
    }
  }, [addMaliciousTransaction, setTransactions]);

  const handleSimulate = useCallback(async () => {
    if (!publicKey) return;
    const results = await simulateBundle(
      transactions,
      publicKey.toString(),
      setLoading,
      setSimulationStatus
    );
    if (results) {
      setSimulationResults(results);
    }
  }, [transactions, publicKey, setLoading, setSimulationStatus, simulateBundle, setSimulationResults]);

  const handleExecute = useCallback(async () => {
    if (!publicKey) return;
    const sigs = await executeBundle(
      transactions,
      publicKey.toString(),
      signTransaction,
      setLoading,
      setExecutionStatus
    );
    if (sigs) {
      setSignatures(sigs);
    }
  }, [transactions, publicKey, signTransaction, setLoading, setExecutionStatus, executeBundle, setSignatures]);

  return (
    <div className="container mx-auto p-4">
      <div className="bg-card rounded-lg p-6 shadow-lg">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-mono text-primary">Jito Bundle Guardrail</h1>
            <p className="text-sm text-muted-foreground mt-1">Demo Version with Transaction Validation</p>
          </div>
          <WalletMultiButton />
        </div>
        
        {lighthouseStatus === false && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Limited Protection</AlertTitle>
            <AlertDescription>
              Lighthouse program is not available on this network. Transaction security will be limited.
            </AlertDescription>
          </Alert>
        )}
        
        <Alert className="mb-4 bg-gray-800">
          <Info className="h-4 w-4" />
          <AlertTitle>Demo Mode</AlertTitle>
          <AlertDescription>
            <p>This demo allows testing of transaction bundles with Lighthouse protection. Add transactions to create a bundle, then simulate to check for malicious activity.</p>
            <p className="mt-2 text-xs text-gray-400">
              Note: Some services may have limited functionality depending on network availability.
            </p>
          </AlertDescription>
        </Alert>
        
        <div className="space-y-4">
          {connected && publicKey && (
            <div className="bg-black/50 p-4 rounded-md">
              <h2 className="text-secondary font-mono mb-2">Connected Wallet</h2>
              <p className="font-mono text-sm text-white/70">{publicKey.toString()}</p>
            </div>
          )}

          <StatusAlerts simulationStatus={simulationStatus} />

          <div className="bg-black/50 p-4 rounded-md">
            <h2 className="text-secondary font-mono mb-2">Transaction Bundle</h2>
            <div className="space-y-2">
              <TransactionList 
                transactions={transactions}
                executionStatus={executionStatus}
                signatures={signatures}
                simulationResults={simulationResults}
              />
              <TransactionControls
                onAddTransaction={handleAddTransaction}
                onAddMaliciousTransaction={handleAddMaliciousTransaction}
                disabled={loading || !connected}
              />
            </div>
          </div>

          <BundleActions
            onSimulate={handleSimulate}
            onExecute={handleExecute}
            loading={loading}
            disabled={transactions.length === 0 || !connected}
            simulationStatus={simulationStatus}
          />
        </div>
      </div>
    </div>
  );
};

export default BundleBuilder;
