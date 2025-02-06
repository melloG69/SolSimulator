
import { Buffer } from 'buffer';
import stream from 'stream-browserify';
import process from 'process';
import util from 'util';
import EventEmitter from 'events';

// Ensure Buffer is available globally
globalThis.Buffer = Buffer;

// Add other necessary polyfills
if (typeof window !== 'undefined') {
  window.Buffer = Buffer;
  // @ts-ignore
  window.process = process;
  // @ts-ignore
  window.global = window;
  // @ts-ignore
  window.Stream = stream.Stream;
  // @ts-ignore
  window.util = util;
  // @ts-ignore
  window.EventEmitter = EventEmitter;
}

export { Buffer };
