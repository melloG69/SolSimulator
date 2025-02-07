
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MaliciousType } from "@/hooks/useTransactionManager";

interface TransactionControlsProps {
  onAddTransaction: () => void;
  onAddMaliciousTransaction: (type: MaliciousType) => void;
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
        onClick={() => onAddMaliciousTransaction('compute')}
      >
        Add High Compute Attack
      </Button>
    </div>
  );
};
