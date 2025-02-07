
import { FC, ReactNode, useEffect, useState } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { connection } from '@/lib/solana';
import { SolanaErrorBoundary } from './SolanaErrorBoundary';
import { toast } from "sonner";

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
        if (typeof window !== 'undefined' && window.Buffer && window.process) {
          // Verify connection to Solana network
          const version = await connection.getVersion();
          console.log('Connected to Solana network:', version);
          setIsReady(true);
        } else {
          throw new Error('Required dependencies not found');
        }
      } catch (error) {
        console.error('Failed to initialize Solana providers:', error);
        toast.error('Failed to connect to Solana network. Please refresh the page.');
      }
    };

    checkDependencies();
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
