
import React from 'react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle, XCircle } from "lucide-react";

interface ExecutableStatusProps {
  isExecutable: boolean;
  show: boolean;
}

export const ExecutableStatus = ({ isExecutable, show }: ExecutableStatusProps) => {
  if (!show) return null;

  return (
    <Alert 
      variant={isExecutable ? "default" : "destructive"} 
      className={`mb-4 ${isExecutable ? "bg-green-950/20 border-green-900" : ""}`}
    >
      {isExecutable ? 
        <CheckCircle className="h-4 w-4 text-green-500" /> : 
        <XCircle className="h-4 w-4" />
      }
      <AlertTitle className={isExecutable ? "text-green-400" : ""}>
        {isExecutable ? "Bundle is Executable" : "Bundle is Not Executable"}
      </AlertTitle>
      <AlertDescription className={isExecutable ? "text-green-300/70" : ""}>
        {isExecutable ? 
          "All transactions in this bundle have passed simulation and can be executed." : 
          "One or more transactions in this bundle have failed simulation and cannot be executed."
        }
      </AlertDescription>
    </Alert>
  );
};
