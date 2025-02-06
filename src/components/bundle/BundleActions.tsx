
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { SimulationStatus } from "@/hooks/useBundleState";

interface BundleActionsProps {
  onSimulate: () => void;
  onExecute: () => void;
  loading: boolean;
  disabled: boolean;
  simulationStatus: SimulationStatus;
}

export const BundleActions = ({
  onSimulate,
  onExecute,
  loading,
  disabled,
  simulationStatus
}: BundleActionsProps) => {
  return (
    <div className="flex space-x-4">
      <Button
        onClick={onSimulate}
        disabled={loading || disabled}
        className="flex-1"
        variant="secondary"
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Simulate Bundle
      </Button>
      <Button
        onClick={onExecute}
        disabled={loading || disabled || simulationStatus !== 'success'}
        className="flex-1"
        variant="default"
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Execute Bundle
      </Button>
    </div>
  );
};
