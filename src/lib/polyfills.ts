
/**
 * Essential polyfills for Solana and Lighthouse compatibility
 */
import { Buffer } from 'buffer/';
import process from 'process';
import util from 'util';
import EventEmitter from 'events';
import stream from 'stream-browserify';

// Setup global polyfills with proper type checking
if (typeof window !== 'undefined') {
  // Critical polyfills for Solana ecosystem
  (window as any).Buffer = Buffer;
  (window as any).process = process;
  (window as any).global = window;

  // Stream and utility polyfills needed by various dependencies
  (window as any).Stream = stream.Stream;
  (window as any).util = util;
  (window as any).EventEmitter = EventEmitter;
  
  console.log('Polyfills initialized successfully');
}

// Export for direct imports where needed
export { Buffer };
