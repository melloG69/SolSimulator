
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: true,
    },
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
      supported: {
        bigint: true,
      },
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
    rollupOptions: {
      // Ensure external packages are correctly handled
      output: {
        manualChunks: {
          vendor: [
            '@solana/web3.js',
            '@solana/wallet-adapter-react',
            '@solana/wallet-adapter-wallets',
          ],
          ui: [
            'react',
            'react-dom',
            'react-router-dom',
          ],
        },
      },
    },
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
      transformMixedEsModules: true,
    },
    sourcemap: true,
  },
}));
