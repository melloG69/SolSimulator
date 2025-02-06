
import { Transaction } from "@solana/web3.js";
import { CheckCircle, XCircle } from "lucide-react";
import { ExecutionStatus } from "@/hooks/useBundleState";

interface TransactionListProps {
  transactions: Transaction[];
  executionStatus: ExecutionStatus;
}

export const TransactionList = ({ transactions, executionStatus }: TransactionListProps) => {
  return (
    <div className="space-y-2">
      {transactions.map((tx, index) => (
        <div key={index} className="bg-black/30 p-2 rounded flex items-center justify-between">
          <code className="text-xs text-white/70">Transaction {index + 1}</code>
          {executionStatus !== 'idle' && (
            executionStatus === 'success' 
              ? <CheckCircle className="h-4 w-4 text-green-500" />
              : <XCircle className="h-4 w-4 text-red-500" />
          )}
        </div>
      ))}
    </div>
  );
};
