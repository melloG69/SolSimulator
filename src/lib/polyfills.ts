
import { Buffer } from 'buffer';

// Ensure Buffer is available globally
globalThis.Buffer = Buffer;

// Add other necessary polyfills
if (typeof window !== 'undefined') {
  window.Buffer = Buffer;
}

export { Buffer };
