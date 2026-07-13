import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@shared': resolve(root, '../shared/src') },
  },
  server: {
    port: 5173,
    // Allow importing the shared package from outside the client root.
    fs: { allow: ['..'] },
    // Proxy API calls to the Node server during local dev.
    proxy: { '/api': 'http://localhost:4000' },
  },
});
