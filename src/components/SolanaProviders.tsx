
import { FC, ReactNode, useEffect, useState } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { connection } from '@/lib/solana';
import { SolanaErrorBoundary } from './SolanaErrorBoundary';
import { toast } from "sonner";
import { lighthouseService } from "@/services/lighthouseService";
import { Transaction } from '@solana/web3.js';

interface SolanaProvidersProps {
  children: ReactNode;
}

export const SolanaProviders: FC<SolanaProvidersProps> = ({ children }) => {
  const [isReady, setIsReady] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<{
    solana: boolean;
    lighthouse: boolean;
    network: string;
  }>({ solana: false, lighthouse: false, network: 'unknown' });
  
  const wallets = [new PhantomWalletAdapter()];

  useEffect(() => {
    const checkDependencies = async () => {
      try {
        if (typeof window === 'undefined' || !window.Buffer || !window.process) {
          throw new Error('Required browser dependencies not found');
        }

        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Connection timeout')), 15000);
        });

        // Check Solana connection
        try {
          const versionPromise = connection.getVersion();
          const version = await Promise.race([versionPromise, timeoutPromise]);
          console.log('Successfully connected to Solana network:', version);
          
          // Determine network from RPC URL
          let networkName = 'mainnet';
          if (connection.rpcEndpoint.includes('devnet')) {
            networkName = 'devnet';
          } else if (connection.rpcEndpoint.includes('testnet')) {
            networkName = 'testnet';
          } else if (connection.rpcEndpoint.includes('localhost') || connection.rpcEndpoint.includes('127.0.0.1')) {
            networkName = 'localnet';
          }
          
          setNetworkStatus(prev => ({ ...prev, solana: true, network: networkName }));
        } catch (error) {
          setNetworkStatus(prev => ({ ...prev, solana: false }));
          console.error('Solana connection failed:', error);
          if (error instanceof Error && error.message === 'Connection timeout') {
            toast.error('Connection to Solana network timed out. Please check your internet connection and refresh.');
          } else {
            toast.error(`Failed to connect to Solana network. Please refresh the page.`);
          }
          // Continue initialization despite Solana connection errors
        }
        
        // Check Lighthouse program availability
        try {
          // Use an empty transaction for the check
          const lighthouseResult = await lighthouseService.buildAssertions(new Transaction());
          
          setNetworkStatus(prev => ({ 
            ...prev, 
            lighthouse: lighthouseResult.isProgramAvailable || false
          }));
          
          if (!lighthouseResult.isProgramAvailable) {
            // We'll only show a warning for mainnet, not for development networks
            if (networkStatus.network === 'mainnet') {
              console.warn("Lighthouse program not available on mainnet");
              toast.warning("Lighthouse protection is limited on mainnet. Transaction security may be reduced.");
            } else {
              console.log(`Using development mode for Lighthouse on ${networkStatus.network}`);
            }
          } else {
            console.log(`Lighthouse program verified on ${networkStatus.network}`);
            toast.success("Lighthouse protection active");
          }
        } catch (error) {
          setNetworkStatus(prev => ({ ...prev, lighthouse: false }));
          console.warn("Failed to initialize Lighthouse service:", error);
          // Don't block app initialization for Lighthouse issues
        }
        
        // Set ready state even if some services failed
        setIsReady(true);
      } catch (error) {
        console.error('Failed to initialize Solana providers:', error);
        
        if (error instanceof Error) {
          if (error.message === 'Required browser dependencies not found') {
            toast.error('Browser compatibility issue detected. Please use a modern browser.');
          } else {
            toast.error(`Initialization error: ${error.message}. Please refresh the page.`);
          }
        } else {
          toast.error('An unexpected error occurred while initializing the application.');
        }
      }
    };

    checkDependencies();

    return () => {
      setIsReady(false);
    };
  }, []);

  // Show more detailed loading state
  if (!isReady) {
    return (
      <div className="p-4">
        <div className="flex flex-col space-y-2">
          <div className="flex items-center space-x-2">
            <div className="animate-pulse bg-muted rounded-md h-8 w-48"></div>
            <div className="text-sm text-muted-foreground">Initializing Solana connection...</div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="animate-pulse bg-muted rounded-md h-8 w-48"></div>
            <div className="text-sm text-muted-foreground">Checking Lighthouse availability...</div>
          </div>
        </div>
      </div>
    );
  }

  // Show service status indicators when app is ready
  const StatusIndicator = () => (
    <div className="fixed bottom-4 right-4 bg-black/80 rounded-lg p-2 text-xs flex flex-col gap-1 z-50">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${networkStatus.solana ? 'bg-green-500' : 'bg-red-500'}`}></div>
        <span className="text-white/80">Solana {networkStatus.network}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${
          networkStatus.lighthouse 
            ? 'bg-green-500' 
            : (networkStatus.network !== 'mainnet' ? 'bg-blue-500' : 'bg-yellow-500')
        }`}></div>
        <span className="text-white/80">
          Lighthouse {
            networkStatus.lighthouse 
              ? 'Active' 
              : (networkStatus.network !== 'mainnet' 
                  ? 'Development Mode' 
                  : 'Limited')
          }
        </span>
      </div>
    </div>
  );

  return (
    <SolanaErrorBoundary>
      <ConnectionProvider endpoint={connection.rpcEndpoint}>
        <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>
            {children}
            <StatusIndicator />
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </SolanaErrorBoundary>
  );
};
