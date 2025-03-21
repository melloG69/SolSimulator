
import { Transaction } from "@solana/web3.js";
import { CheckCircle, XCircle, Info } from "lucide-react";
import { SimulationResult } from "@/hooks/useBundleState";
import { Badge } from "@/components/ui/badge";

interface TransactionListProps {
  transactions: Transaction[];
  simulationResults?: Array<{ success: boolean; message?: string; bundleId?: string }>;
}

export const TransactionList = ({ 
  transactions, 
  simulationResults = []
}: TransactionListProps) => {
  return (
    <div className="space-y-2">
      {transactions.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-sm">
          Add transactions to your bundle to begin simulation
        </div>
      ) : (
        transactions.map((tx, index) => (
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
                </div>
                {simulationResults[index]?.bundleId && (
                  <div className="text-xs text-white/50">
                    Bundle ID: {simulationResults[index].bundleId}
                  </div>
                )}
              </div>
              {simulationResults[index] && (
                simulationResults[index].success 
                  ? <CheckCircle className="h-4 w-4 text-green-500" />
                  : <XCircle className="h-4 w-4 text-red-500" />
              )}
            </div>
            
            {simulationResults[index] && (
              <div className="mt-2">
                <div className="flex items-center space-x-2">
                  <div className="text-xs">
                    <span className={simulationResults[index].success ? "text-green-400" : "text-red-400"}>
                      {simulationResults[index].success ? "Simulation successful" : simulationResults[index].message || "Simulation failed"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};
