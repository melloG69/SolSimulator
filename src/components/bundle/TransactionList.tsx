
import { Transaction } from "@solana/web3.js";
import { CheckCircle, XCircle, Info, AlertTriangle, Shield } from "lucide-react";
import { SimulationResult } from "@/hooks/useBundleState";
import { Badge } from "@/components/ui/badge";

interface TransactionListProps {
  transactions: Transaction[];
  simulationResults?: Array<{ success: boolean; message?: string; bundleId?: string }>;
  lighthouseStatus?: boolean;
}

export const TransactionList = ({ 
  transactions, 
  simulationResults = [],
  lighthouseStatus
}: TransactionListProps) => {
  return (
    <div className="space-y-2">
      {transactions.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-sm">
          Add transactions to your bundle to begin simulation
        </div>
      ) : (
        transactions.map((tx, index) => {
          const result = simulationResults[index];
          const isHighComputeError = result?.message && result.message.includes("Excessive compute units");
          const isLighthouseProtected = lighthouseStatus && !isHighComputeError;
          
          return (
            <div key={index} className="bg-black/30 p-4 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-white/70">Transaction {index + 1}</code>
                    {tx.instructions.length > 0 && tx.instructions[0].programId && (
                      <Badge variant="outline" className="text-[10px] h-5">
                        {tx.instructions[0].programId.toString().slice(0, 4)}...{tx.instructions[0].programId.toString().slice(-4)}
                      </Badge>
                    )}
                    
                    {/* Show high compute badge for malicious transactions */}
                    {isHighComputeError && (
                      <Badge variant="destructive" className="text-[10px] h-5">
                        High Compute
                      </Badge>
                    )}
                    
                    {/* Show Lighthouse protection badge */}
                    {isLighthouseProtected && (
                      <Badge className="text-[10px] h-5 bg-green-900/20 text-green-400 border-green-800">
                        <Shield className="h-3 w-3 mr-1" />
                        Protected
                      </Badge>
                    )}
                  </div>
                  {result?.bundleId && (
                    <div className="text-xs text-white/50">
                      Bundle ID: {result.bundleId}
                    </div>
                  )}
                </div>
                {result && (
                  result.success 
                    ? <CheckCircle className="h-4 w-4 text-green-500" />
                    : isHighComputeError 
                      ? <AlertTriangle className="h-4 w-4 text-red-500" />
                      : <XCircle className="h-4 w-4 text-red-500" />
                )}
              </div>
              
              {result && (
                <div className="mt-2">
                  <div className="flex items-center space-x-2">
                    <div className="text-xs">
                      <span className={result.success ? "text-green-400" : "text-red-400"}>
                        {result.success 
                          ? "Simulation successful" 
                          : isHighComputeError
                            ? "High compute units detected"
                            : result.message || "Simulation failed"
                        }
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};
