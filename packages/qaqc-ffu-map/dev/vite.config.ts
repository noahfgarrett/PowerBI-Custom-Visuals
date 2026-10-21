import { createReadStream, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/** The URL the harness fetches for `?file=1`. */
const LAYOUT_URL = '/__ffu-layout.csv';

/**
 * Dev only: serves the layout CSV named by the FFU_LAYOUT_CSV environment variable at LAYOUT_URL, so a local visual
 * check can use a real layout without the file or its path ever entering the repo or a bundle.
 */
function layoutCsv(): Plugin {
  return {
    name: 'ffu-layout-csv',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(LAYOUT_URL, (_request, response) => {
        const path = process.env.FFU_LAYOUT_CSV ?? '';
        if (path === '' || !existsSync(path)) {
          response.statusCode = 404;
          response.end('Set FFU_LAYOUT_CSV to the absolute path of a layout CSV.');
          return;
        }
        response.setHeader('Content-Type', 'text/csv; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        createReadStream(path).pipe(response);
      });
    },
  };
}

export default defineConfig({
  root: resolve(__dirname),
  plugins: [layoutCsv()],
  server: { host: '127.0.0.1', port: 5196, strictPort: true },
});
