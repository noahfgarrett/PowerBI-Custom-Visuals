import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
    root: resolve(__dirname),
    publicDir: resolve(__dirname, '../.tmp/drop'),
    resolve: { alias: { '@pbi/core': resolve(__dirname, '../../core/src') } },
    server: { host: '127.0.0.1', port: 5186, strictPort: true },
});
