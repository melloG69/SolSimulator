
// Initialize polyfills before anything else
import './lib/polyfills';

import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { toast } from "sonner";

// Add global error handler for debugging
const handleGlobalError = (error: any) => {
  console.error("Global error:", error);
  if (error instanceof Error) {
    console.error(`${error.name}: ${error.message}`);
    console.error(error.stack);
  }
};

// Set global error handlers
window.onerror = (message, source, lineno, colno, error) => {
  handleGlobalError(error || message);
  toast.error("An unexpected error occurred. Please refresh the page.");
  return true; // Prevent default error handling
};

window.addEventListener('unhandledrejection', (event) => {
  handleGlobalError(event.reason);
  toast.error("An unexpected promise rejection occurred. Please refresh the page.");
});

// Wrap root creation in a try-catch for better error reporting
try {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error("Root element not found");
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
    </div>
  `;
}
