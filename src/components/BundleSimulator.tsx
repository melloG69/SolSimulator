
import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useBundleState } from "@/hooks/useBundleState";
import { useTransactionManager } from "@/hooks/useTransactionManager";
import { useSimulationManager } from "@/hooks/useSimulationManager";
import { TransactionList } from "./bundle/TransactionList";
import { StatusAlerts } from "./bundle/StatusAlerts";
import { TransactionControls } from "./bundle/TransactionControls";
import { SimulationActions } from "./bundle/SimulationActions";
import { lighthouseService } from "@/services/lighthouseService";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, AlertTriangle, Info, Lightbulb } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const BundleSimulator = () => {
  const {
    transactions,
    setTransactions,
    simulationResults,
    setSimulationResults,
    loading,
    setLoading,
    simulationStatus,
    setSimulationStatus,
  } = useBundleState();

  const { publicKey, connected } = useWallet();
  const { addTransaction, addMaliciousTransaction } = useTransactionManager(publicKey);
  const { simulateBundle } = useSimulationManager();
  const [lighthouseStatus, setLighthouseStatus] = useState<boolean | null>(null);
  const [simulationDetails, setSimulationDetails] = useState<any>(null);

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
    
    const { results, details } = await simulateBundle(
      transactions,
      publicKey.toString(),
      setLoading,
      setSimulationStatus
    );
    
    if (results) {
      setSimulationResults(results);
      setSimulationDetails(details);
    }
  }, [transactions, publicKey, setLoading, setSimulationStatus, simulateBundle, setSimulationResults]);

  return (
    <div className="container mx-auto p-4">
      <div className="bg-card rounded-lg p-6 shadow-lg">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-mono text-primary">Solana Bundle Simulator</h1>
              <Badge variant="outline" className="font-mono">BETA</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Test transaction bundles with Lighthouse protection</p>
          </div>
          <WalletMultiButton />
        </div>
        
        {lighthouseStatus === false && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Limited Protection</AlertTitle>
            <AlertDescription>
              Lighthouse program is not available on this network. Simulation security will be limited.
            </AlertDescription>
          </Alert>
        )}
        
        <Alert className="mb-4 bg-gray-800">
          <Lightbulb className="h-4 w-4" />
          <AlertTitle>About Bundle Simulation</AlertTitle>
          <AlertDescription>
            <p>Build and simulate transaction bundles with Lighthouse protection. Add transactions to create a bundle, then simulate to analyze their effects and check for malicious activity - all without spending SOL.</p>
            <p className="mt-2 text-xs text-gray-400">
              Powered by Jito, Helius, and Lighthouse for accurate simulations.
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

          <StatusAlerts 
            simulationStatus={simulationStatus} 
            details={simulationDetails}
          />

          <div className="bg-black/50 p-4 rounded-md">
            <h2 className="text-secondary font-mono mb-2">Transaction Bundle</h2>
            <div className="space-y-2">
              <TransactionList 
                transactions={transactions}
                simulationResults={simulationResults}
              />
              <TransactionControls
                onAddTransaction={handleAddTransaction}
                onAddMaliciousTransaction={handleAddMaliciousTransaction}
                disabled={loading || !connected}
              />
            </div>
          </div>

          <SimulationActions
            onSimulate={handleSimulate}
            loading={loading}
            disabled={transactions.length === 0 || !connected}
            simulationStatus={simulationStatus}
          />
          
          {simulationStatus === 'success' && simulationDetails && (
            <div className="bg-black/50 p-4 rounded-md mt-4">
              <h2 className="text-secondary font-mono mb-2">Simulation Insights</h2>
              <div className="space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-xs text-white/50 mb-1">Bundle Size</h3>
                    <p className="font-mono">{simulationDetails.bundleSize || 0} transactions</p>
                  </div>
                  <div>
                    <h3 className="text-xs text-white/50 mb-1">Protection Level</h3>
                    <p className="font-mono">{lighthouseStatus ? 'Lighthouse Enhanced' : 'Basic'}</p>
                  </div>
                  <div>
                    <h3 className="text-xs text-white/50 mb-1">Estimated Fees</h3>
                    <p className="font-mono">{simulationDetails.estimatedFees || '0.000'} SOL</p>
                  </div>
                  <div>
                    <h3 className="text-xs text-white/50 mb-1">Compute Units</h3>
                    <p className="font-mono">{simulationDetails.computeUnits || 0} units</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BundleSimulator;
