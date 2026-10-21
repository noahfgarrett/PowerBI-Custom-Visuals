import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve(__dirname),
  server: { host: '127.0.0.1', port: 5196, strictPort: true },
});
