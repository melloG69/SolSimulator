
import { Shield, AlertTriangle, Info, AlertCircle } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { SimulationStatus } from "@/hooks/useBundleState";
import { Badge } from "@/components/ui/badge";

interface StatusAlertsProps {
  simulationStatus: SimulationStatus;
  details?: any;
}

export const StatusAlerts = ({ simulationStatus, details }: StatusAlertsProps) => {
  if (simulationStatus === 'idle') return null;

  // Helper function to determine if transaction has high compute units
  const hasHighComputeUnits = () => {
    if (!details || !details.error) return false;
    return details.error.includes("Excessive compute units");
  };

  // For the simulation success case
  if (simulationStatus === 'success') {
    return (
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertTitle>Simulation Successful</AlertTitle>
        <AlertDescription>
          <div className="flex flex-col space-y-1">
            <p>All transactions in the bundle would execute successfully.</p>
            {details?.withProtection && (
              <div className="flex items-center mt-1">
                <Badge variant="outline" className="bg-green-900/20 text-green-400 border-green-800 mr-2">
                  Protected
                </Badge>
                <span className="text-xs text-muted-foreground">Lighthouse protection is active</span>
              </div>
            )}
          </div>
        </AlertDescription>
      </Alert>
    );
  }
  
  // Check if bundle contains malicious transactions
  if (details?.hasMaliciousTransactions) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle className="flex items-center">
          Malicious Transactions Detected
          <Badge variant="outline" className="ml-2 bg-red-900/20 text-red-400 border-red-800">
            High Compute
          </Badge>
        </AlertTitle>
        <AlertDescription>
          <p>The bundle contains transactions that would be rejected by Lighthouse protection.</p>
          <p className="mt-2 text-xs">The problematic transactions are marked below. Valid transactions are still shown separately.</p>
        </AlertDescription>
      </Alert>
    );
  }
  
  // For other simulation failure cases
  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Simulation Detected Issues</AlertTitle>
      <AlertDescription>
        {details?.error ? (
          <span>{details.error}</span>
        ) : (
          <span>The bundle simulation detected potentially harmful transactions. Please review the transaction details below.</span>
        )}
      </AlertDescription>
    </Alert>
  );
};
