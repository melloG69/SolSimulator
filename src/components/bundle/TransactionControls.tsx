
import { Button } from "@/components/ui/button";

interface TransactionControlsProps {
  onAddTransaction: () => void;
  onAddMaliciousTransaction: () => void;
  disabled: boolean;
}

export const TransactionControls = ({
  onAddTransaction,
  onAddMaliciousTransaction,
  disabled
}: TransactionControlsProps) => {
  return (
    <div className="flex gap-2">
      <Button
        onClick={onAddTransaction}
        variant="outline"
        className="flex-1"
        disabled={disabled}
      >
        Add Valid Transaction
      </Button>
      <Button
        variant="outline"
        className="flex-1"
        disabled={disabled}
        onClick={onAddMaliciousTransaction}
      >
        Add High Compute Attack
      </Button>
    </div>
  );
};
