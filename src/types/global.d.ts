
declare global {
  interface Window {
    Buffer: typeof Buffer;
    process: any;
    global: any;
    Stream: any;
    util: any;
    EventEmitter: any;
  }

  var process: any;
  var Buffer: typeof Buffer;
}

export {};
