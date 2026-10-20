import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:18097', ws: true },
    },
  },
  build: {
    chunkSizeWarningLimit: 2000,
  },
});
