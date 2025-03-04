
import { FC, ReactNode, useEffect, useState } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { connection } from '@/lib/solana';
import { SolanaErrorBoundary } from './SolanaErrorBoundary';
import { toast } from "sonner";
import { lighthouseService } from "@/services/lighthouseService";

interface SolanaProvidersProps {
  children: ReactNode;
}

export const SolanaProviders: FC<SolanaProvidersProps> = ({ children }) => {
  const [isReady, setIsReady] = useState(false);
  const wallets = [new PhantomWalletAdapter()];

  useEffect(() => {
    const checkDependencies = async () => {
      try {
        // Check if required globals are available
        if (typeof window === 'undefined' || !window.Buffer || !window.process) {
          throw new Error('Required browser dependencies not found');
        }

        // Add timeout for connection check
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Connection timeout')), 15000);
        });

        // Try to get version with timeout
        const versionPromise = connection.getVersion();
        const version = await Promise.race([versionPromise, timeoutPromise]);

        console.log('Successfully connected to Solana network:', version);
        
        // Pre-verify Lighthouse program availability (but don't block on it)
        lighthouseService.buildAssertions(new Transaction())
          .catch(error => {
            console.warn("Failed to initialize Lighthouse service:", error);
            // We don't fail the app initialization for this
          });
        
        setIsReady(true);
      } catch (error) {
        console.error('Failed to initialize Solana providers:', error);
        
        // Show more specific error messages based on error type
        if (error instanceof Error) {
          if (error.message === 'Connection timeout') {
            toast.error('Connection to Solana network timed out. Please check your internet connection and refresh.');
          } else if (error.message === 'Required browser dependencies not found') {
            toast.error('Browser compatibility issue detected. Please use a modern browser.');
          } else {
            toast.error(`Failed to connect to Solana network: ${error.message}. Please refresh the page.`);
          }
        } else {
          toast.error('An unexpected error occurred while connecting to Solana network.');
        }
      }
    };

    checkDependencies();

    // Cleanup function
    return () => {
      setIsReady(false);
    };
  }, []);

  if (!isReady) {
    return (
      <div className="p-4">
        <div className="flex items-center space-x-2">
          <div className="animate-pulse bg-muted rounded-md h-8 w-48"></div>
          <div className="text-sm text-muted-foreground">Initializing Solana connection...</div>
        </div>
      </div>
    );
  }

  return (
    <SolanaErrorBoundary>
      <ConnectionProvider endpoint={connection.rpcEndpoint}>
        <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>
            {children}
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </SolanaErrorBoundary>
  );
};
