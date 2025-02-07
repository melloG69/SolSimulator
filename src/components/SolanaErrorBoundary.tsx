
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { toast } from "sonner";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class SolanaErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Solana provider error:', error, errorInfo);
    toast.error("Failed to initialize Solana connection. Please refresh the page.");
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-destructive/10 text-destructive rounded-md">
          <h2 className="font-semibold mb-2">Something went wrong with Solana initialization</h2>
          <p className="text-sm">Please refresh the page or check your wallet connection.</p>
          {this.state.error && (
            <pre className="mt-2 text-xs bg-black/5 p-2 rounded overflow-auto">
              {this.state.error.message}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
