
import { FC, ReactNode, useEffect, useState } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter, BraveWalletAdapter, CoinbaseWalletAdapter } from '@solana/wallet-adapter-wallets';
import { connection } from '@/lib/solana';
import { SolanaErrorBoundary } from './SolanaErrorBoundary';
import { toast } from "sonner";
import { lighthouseService } from "@/services/lighthouseService";
import { Transaction, PublicKey, SystemProgram } from '@solana/web3.js';

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

interface SolanaProvidersProps {
  children: ReactNode;
}

export const SolanaProviders: FC<SolanaProvidersProps> = ({ children }) => {
  const [isReady, setIsReady] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<{
    solana: boolean;
    lighthouse: boolean;
    network: string;
  }>({ solana: false, lighthouse: false, network: 'mainnet' });
  
  // Create properly configured wallet adapters
  const wallets = [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
    new BraveWalletAdapter(),
    new CoinbaseWalletAdapter()
  ];

  useEffect(() => {
    const checkDependencies = async () => {
      try {
        if (typeof window === 'undefined') {
          console.warn('Running in server environment, skipping dependency check');
          return;
        }

        // Check for required polyfills
        if (!window.Buffer) {
          console.warn('Buffer not found in window object');
          // We'll continue since polyfills might be loaded asynchronously
        }

        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Connection timeout')), 15000);
        });

        // Check Solana connection
        try {
          const versionPromise = connection.getVersion();
          const version = await Promise.race([versionPromise, timeoutPromise]);
          console.log('Successfully connected to Solana mainnet:', version);
          
          // In mainnet-only mode, we always set network to mainnet
          setNetworkStatus(prev => ({ ...prev, solana: true, network: 'mainnet' }));
        } catch (error) {
          setNetworkStatus(prev => ({ ...prev, solana: false }));
          console.error('Solana mainnet connection failed:', error);
          if (error instanceof Error && error.message === 'Connection timeout') {
            toast.error('Connection to Solana mainnet timed out. Please check your internet connection and refresh.');
          } else {
            toast.error(`Failed to connect to Solana mainnet. Please refresh the page.`);
          }
          // Continue initialization despite Solana connection errors
        }
        
        // Check Lighthouse program availability on mainnet with a proper mock transaction
        try {
          // Create a proper mock transaction with a valid instruction for testing
          const mockTx = new Transaction();
          const mockPayer = new PublicKey('11111111111111111111111111111111');
          const mockReceiver = new PublicKey('11111111111111111111111111111111');
          
          // Add a valid instruction (0 SOL transfer just for validation)
          mockTx.add(
            SystemProgram.transfer({
              fromPubkey: mockPayer,
              toPubkey: mockReceiver,
              lamports: 0
            })
          );
          
          // Set properties to avoid validation errors
          mockTx.feePayer = mockPayer;
          mockTx.recentBlockhash = "4NfTBsiUGv2FHXuXJgMsHNZWVQHLdKxL5mKiGJNPAkgq"; // Mock blockhash
          
          // Now check if Lighthouse is available
          const lighthouseResult = await lighthouseService.buildAssertions(mockTx);
          
          setNetworkStatus(prev => ({ 
            ...prev, 
            lighthouse: lighthouseResult.isProgramAvailable || false
          }));
          
          if (!lighthouseResult.isProgramAvailable) {
            console.warn("Lighthouse program availability check on mainnet failed");
            toast.warning("Lighthouse protection may be limited on mainnet. Transaction security could be affected.");
          } else {
            console.log("Lighthouse program verified on mainnet");
            toast.success("Lighthouse protection active on mainnet");
          }
        } catch (error) {
          setNetworkStatus(prev => ({ ...prev, lighthouse: false }));
          console.warn("Failed to initialize Lighthouse service on mainnet:", error);
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
            <div className="text-sm text-muted-foreground">Initializing Solana mainnet connection...</div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="animate-pulse bg-muted rounded-md h-8 w-48"></div>
            <div className="text-sm text-muted-foreground">Checking Lighthouse availability on mainnet...</div>
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
        <span className="text-white/80">Solana mainnet</span>
      </div>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${
          networkStatus.lighthouse 
            ? 'bg-green-500' 
            : 'bg-yellow-500'
        }`}></div>
        <span className="text-white/80">
          Lighthouse {networkStatus.lighthouse ? 'Active' : 'Limited'}
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

export default SolanaProviders;
