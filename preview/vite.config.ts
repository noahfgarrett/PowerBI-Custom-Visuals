import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: resolve(__dirname),
  resolve: {
    alias: {
      '@pbi/core': resolve(__dirname, '../packages/core/src'),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
});
