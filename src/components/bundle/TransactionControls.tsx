
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="flex-1"
            disabled={disabled}
          >
            Add Malicious Transaction
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => onAddMaliciousTransaction('compute')}>
            High Compute Units Attack
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAddMaliciousTransaction('balance')}>
            Balance Drain Attack
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAddMaliciousTransaction('ownership')}>
            Ownership Attack
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAddMaliciousTransaction('data')}>
            Data Manipulation Attack
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
