
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
import { Terminal, AlertTriangle, Info, Lightbulb, Shield, CheckCircle, XCircle } from "lucide-react";
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
  const [showExecutableStatus, setShowExecutableStatus] = useState(false);
  const [isExecutable, setIsExecutable] = useState(false);

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

  // Determine if bundle is executable based on simulation results
  useEffect(() => {
    if (simulationStatus === 'idle') {
      setShowExecutableStatus(false);
      return;
    }
    
    // Show status after simulation
    setShowExecutableStatus(true);
    
    // Bundle is executable if all transactions succeeded
    const canExecute = simulationResults.length > 0 && 
      simulationResults.every(result => result.success);
    
    setIsExecutable(canExecute);
    
    console.log('Bundle executable status:', canExecute ? 'Executable' : 'Not Executable');
  }, [simulationResults, simulationStatus]);

  // Reset status when transactions change
  useEffect(() => {
    setShowExecutableStatus(false);
  }, [transactions]);

  const handleAddTransaction = useCallback(async () => {
    const newTransaction = await addTransaction();
    if (newTransaction) {
      setTransactions(prev => [...prev, newTransaction]);
      setSimulationResults([]);
      setSimulationStatus('idle');
      setSimulationDetails(null);
      setShowExecutableStatus(false);
    }
  }, [addTransaction, setTransactions, setSimulationResults, setSimulationStatus]);

  const handleAddMaliciousTransaction = useCallback(async () => {
    const newTransaction = await addMaliciousTransaction();
    if (newTransaction) {
      setTransactions(prev => [...prev, newTransaction]);
      setSimulationResults([]);
      setSimulationStatus('idle');
      setSimulationDetails(null);
      setShowExecutableStatus(false);
    }
  }, [addMaliciousTransaction, setTransactions, setSimulationResults, setSimulationStatus]);

  const handleSimulate = useCallback(async () => {
    if (!publicKey) return;
    
    setShowExecutableStatus(false);
    
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
              <h1 className="text-2xl font-mono text-primary">Solana Transaction Simulator</h1>
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
        
        {lighthouseStatus === true && (
          <Alert className="mb-4 bg-green-950/20 border-green-900">
            <Shield className="h-4 w-4 text-green-500" />
            <AlertTitle className="text-green-400">Lighthouse Protection Active</AlertTitle>
            <AlertDescription className="text-green-300/70">
              Transactions in this bundle will be protected by Lighthouse assertions.
            </AlertDescription>
          </Alert>
        )}
        
        <Alert className="mb-4 bg-gray-800">
          <Lightbulb className="h-4 w-4" />
          <AlertTitle>About Transaction Simulation</AlertTitle>
          <AlertDescription>
            <p>Build and simulate transaction bundles with Lighthouse protection. Add transactions to create a bundle, then simulate to analyze their effects and check for malicious activity - all without spending SOL.</p>
            <p className="mt-2 text-xs text-gray-400">
              Powered by Jito, Helius, and Lighthouse for accurate simulations. Maximum bundle size: 5 transactions.
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

          {/* Executable Status Alert - Inline implementation with prominent styling */}
          {showExecutableStatus && simulationStatus !== 'idle' && (
            <div className="border p-4 rounded-lg mb-4 shadow-lg bg-gradient-to-r from-black to-gray-900 animate-pulse">
              <div className={`border p-4 rounded-lg ${isExecutable ? "bg-green-950/30 border-green-800" : "bg-red-950/30 border-red-800"}`}>
                <div className="flex items-center gap-2 mb-2">
                  {isExecutable ? (
                    <CheckCircle className="h-6 w-6 text-green-500" />
                  ) : (
                    <XCircle className="h-6 w-6 text-red-500" />
                  )}
                  <h3 className={`text-lg font-bold ${isExecutable ? "text-green-400" : "text-red-400"}`}>
                    {isExecutable ? "Bundle is Executable" : "Bundle is Not Executable"}
                  </h3>
                </div>
                <p className={`text-sm ${isExecutable ? "text-green-300/70" : "text-red-300/70"}`}>
                  {isExecutable 
                    ? "All transactions in this bundle have passed simulation and can be executed." 
                    : "One or more transactions in this bundle have failed simulation and cannot be executed."}
                </p>
              </div>
            </div>
          )}

          <div className="bg-black/50 p-4 rounded-md">
            <h2 className="text-secondary font-mono mb-2">Transaction Bundle</h2>
            {transactions.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p>No transactions added yet. Use the buttons below to create a bundle.</p>
              </div>
            ) : (
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400">Bundle Size: {transactions.length}</span>
                {transactions.length > 5 && (
                  <Badge variant="outline" className="bg-amber-900/20 text-amber-400 border-amber-800">
                    Bundle exceeds Jito limit of 5
                  </Badge>
                )}
              </div>
            )}
            <div className="space-y-2">
              <TransactionList 
                transactions={transactions}
                simulationResults={simulationResults}
                lighthouseStatus={lighthouseStatus}
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
                    <p className="font-mono flex items-center">
                      {lighthouseStatus ? (
                        <>
                          <Badge className="mr-2 bg-green-900/20 text-green-400 border-green-800">
                            Protected
                          </Badge>
                          <span>Lighthouse Enhanced</span>
                        </>
                      ) : (
                        'Basic'
                      )}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xs text-white/50 mb-1">Estimated Fees</h3>
                    <p className="font-mono">{simulationDetails.estimatedFees || '0.000'} SOL</p>
                  </div>
                  <div>
                    <h3 className="text-xs text-white/50 mb-1">Compute Units</h3>
                    <p className="font-mono">{simulationDetails.computeUnits || 0} units</p>
                  </div>
                  <div>
                    <h3 className="text-xs text-white/50 mb-1">Executable Status</h3>
                    <p className="font-mono flex items-center">
                      {isExecutable ? (
                        <Badge className="bg-green-900/20 text-green-400 border-green-800">
                          Executable
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          Not Executable
                        </Badge>
                      )}
                    </p>
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
