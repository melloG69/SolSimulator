
import { Buffer } from 'buffer';
import stream from 'stream-browserify';
import process from 'process';
import util from 'util';
import EventEmitter from 'events';

// First, set up Buffer globally
globalThis.Buffer = Buffer;

// Then set up process
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.process = process;
  // @ts-ignore
  window.global = window;
}

// Ensure Buffer is available on window
if (typeof window !== 'undefined') {
  window.Buffer = Buffer;
}

// Set up stream and related utilities
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.Stream = stream.Stream;
  // @ts-ignore
  window.util = util;
  // @ts-ignore
  window.EventEmitter = EventEmitter;
}

export { Buffer };
