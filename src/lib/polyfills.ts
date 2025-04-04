
import { Buffer } from 'buffer/';
import stream from 'stream-browserify';
import process from 'process';
import util from 'util';
import EventEmitter from 'events';

// First, set up Buffer globally with proper type assertion
if (typeof window !== 'undefined') {
  (window as any).Buffer = Buffer;
  (window as any).process = process;
  (window as any).global = window;
  
  // Ensure critical dependencies are available
  (window as any).process.env = (window as any).process.env || {};
}

// Set up stream and related utilities
if (typeof window !== 'undefined') {
  (window as any).Stream = stream.Stream;
  (window as any).util = util;
  (window as any).EventEmitter = EventEmitter;
}

export { Buffer };
