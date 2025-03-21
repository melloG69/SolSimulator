
import { Button } from "@/components/ui/button";
import { Loader2, Play } from "lucide-react";
import { SimulationStatus } from "@/hooks/useBundleState";

interface SimulationActionsProps {
  onSimulate: () => void;
  loading: boolean;
  disabled: boolean;
  simulationStatus: SimulationStatus;
}

export const SimulationActions = ({
  onSimulate,
  loading,
  disabled,
  simulationStatus
}: SimulationActionsProps) => {
  return (
    <div className="flex space-x-4">
      <Button
        onClick={onSimulate}
        disabled={loading || disabled}
        className="flex-1"
        variant="default"
      >
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Play className="mr-2 h-4 w-4" />
        )}
        Simulate Bundle
      </Button>
    </div>
  );
};
