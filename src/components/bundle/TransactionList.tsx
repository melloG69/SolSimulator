
import { Transaction } from "@solana/web3.js";
import { CheckCircle, XCircle, ExternalLink, Copy } from "lucide-react";
import { ExecutionStatus } from "@/hooks/useBundleState";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";

interface TransactionListProps {
  transactions: Transaction[];
  executionStatus: ExecutionStatus;
  signatures?: string[];
  simulationResults?: Array<{ success: boolean; message?: string }>;
}

export const TransactionList = ({ 
  transactions, 
  executionStatus,
  signatures = [],
  simulationResults = []
}: TransactionListProps) => {
  const { toast } = useToast();

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Transaction signature copied to clipboard",
    });
  };

  const getExplorerUrl = (signature: string) => {
    return `https://explorer.solana.com/tx/${signature}?cluster=mainnet`;
  };

  return (
    <div className="space-y-2">
      {transactions.map((tx, index) => (
        <div key={index} className="bg-black/30 p-4 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <code className="text-xs text-white/70">Transaction {index + 1}</code>
            {executionStatus !== 'idle' && (
              executionStatus === 'success' 
                ? <CheckCircle className="h-4 w-4 text-green-500" />
                : <XCircle className="h-4 w-4 text-red-500" />
            )}
          </div>
          
          {signatures[index] && (
            <div className="mt-2 space-y-2">
              <div className="flex items-center space-x-2">
                <code className="text-xs text-white/70 truncate flex-1">
                  {signatures[index]}
                </code>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => copyToClipboard(signatures[index])}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Copy signature</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => window.open(getExplorerUrl(signatures[index]), '_blank')}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>View on Solana Explorer</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              {simulationResults[index] && (
                <div className="text-xs">
                  <span className={simulationResults[index].success ? "text-green-400" : "text-red-400"}>
                    {simulationResults[index].success ? "Simulation successful" : simulationResults[index].message || "Simulation failed"}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
