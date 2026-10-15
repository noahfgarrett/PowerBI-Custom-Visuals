// pbiviz 5.x resolves the API from the visual's own node_modules directory.
// npm workspaces hoist it, so provide the same local link used by the other visuals.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const target = path.join(root, 'node_modules', 'powerbi-visuals-api');
if (!fs.existsSync(target)) {
  const source = path.dirname(require.resolve('powerbi-visuals-api/package.json', { paths: [root] }));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.symlinkSync(process.platform === 'win32' ? source : path.relative(path.dirname(target), source), target, process.platform === 'win32' ? 'junction' : 'dir');
}
