import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [react(), cloudflare()],
  server: {
    port: 5173,
    // Proxy /search and /health to your Bun indexer so you don't hit CORS in dev
    proxy: {
      '/search': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
    },
  },
});