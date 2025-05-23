
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      stream: 'stream-browserify',
      crypto: 'crypto-browserify',
      buffer: 'buffer/',
      process: 'process',
      util: 'util',
      events: 'events',
    },
  },
  define: {
    'process.env': {},
    global: 'globalThis',
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext',
    },
    include: [
      'buffer',
      '@solana/web3.js',
      '@solana/spl-token',
      'bs58',
      'stream-browserify',
      'crypto-browserify',
      'events',
      'util',
      'process',
      'readable-stream',
    ],
  },
  build: {
    target: 'esnext',
    commonjsOptions: {
      include: [
        /node_modules/,
        /@solana\/web3\.js/,
        /@solana\/spl-token/,
        /readable-stream/,
        /browserify-sign/,
        /crypto-browserify/,
        /stream-browserify/,
      ],
    },
  },
}));
