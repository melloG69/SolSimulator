
import { Shield, AlertTriangle, Info } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { SimulationStatus } from "@/hooks/useBundleState";

interface StatusAlertsProps {
  simulationStatus: SimulationStatus;
  details?: any;
}

export const StatusAlerts = ({ simulationStatus, details }: StatusAlertsProps) => {
  if (simulationStatus === 'idle') return null;

  return simulationStatus === 'failed' ? (
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
  ) : (
    <Alert>
      <Shield className="h-4 w-4" />
      <AlertTitle>Simulation Successful</AlertTitle>
      <AlertDescription>
        All transactions in the bundle would execute successfully. {details?.withProtection ? "Lighthouse protection is active." : ""}
      </AlertDescription>
    </Alert>
  );
};
