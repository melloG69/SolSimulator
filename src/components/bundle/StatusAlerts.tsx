
import { Shield, AlertTriangle } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { SimulationStatus } from "@/hooks/useBundleState";

interface StatusAlertsProps {
  simulationStatus: SimulationStatus;
}

export const StatusAlerts = ({ simulationStatus }: StatusAlertsProps) => {
  if (simulationStatus === 'idle') return null;

  return simulationStatus === 'failed' ? (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Malicious Activity Detected</AlertTitle>
      <AlertDescription>
        The bundle simulation detected potentially harmful transactions.
      </AlertDescription>
    </Alert>
  ) : (
    <Alert>
      <Shield className="h-4 w-4" />
      <AlertTitle>Bundle Validated</AlertTitle>
      <AlertDescription>
        All transactions in the bundle passed security checks.
      </AlertDescription>
    </Alert>
  );
};
