
// Initialize polyfills before anything else
import './lib/polyfills';

import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { toast } from "sonner";

// Wrap root creation in a try-catch for better error reporting
try {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error("Root element not found");
  }
  
  // Add window error handling
  window.onerror = (message, source, lineno, colno, error) => {
    console.error("Global error:", { message, source, lineno, colno, error });
    toast.error("An unexpected error occurred. Please refresh the page.");
  };

  // Add unhandled promise rejection handler
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    toast.error("An operation failed. Please try again.");
  });

  // Check polyfill initialization
  if (!window.Buffer) {
    console.warn("Buffer polyfill not detected - this may cause issues with Solana operations");
  }

  const root = createRoot(rootElement);
  root.render(<App />);
} catch (error) {
  console.error("Failed to initialize app:", error);
  // Show a user-friendly error message
  document.body.innerHTML = `
    <div style="padding: 20px; text-align: center;">
      <h2>Failed to load application</h2>
      <p>Please refresh the page or try again later.</p>
      <p style="color: #666; font-size: 12px;">Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>
    </div>
  `;
}
