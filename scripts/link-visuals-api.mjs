#!/usr/bin/env node
// pbiviz resolves powerbi-visuals-api from the visual's own node_modules, but npm workspaces hoist it to the root.
// Runs after npm install and links the hoisted copy into every visual package that doesn't already have one.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'node_modules', 'powerbi-visuals-api');
if (!fs.existsSync(source)) {
  console.warn('powerbi-visuals-api is not installed at the root; skipping the links.');
  process.exit(0);
}

const packagesDir = path.join(root, 'packages');
let linked = 0;
for (const name of fs.readdirSync(packagesDir)) {
  const visual = path.join(packagesDir, name);
  if (!fs.existsSync(path.join(visual, 'pbiviz.json'))) continue;
  const target = path.join(visual, 'node_modules', 'powerbi-visuals-api');
  if (fs.existsSync(target)) continue;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const isWindows = process.platform === 'win32';
  fs.symlinkSync(isWindows ? source : path.relative(path.dirname(target), source), target, isWindows ? 'junction' : 'dir');
  linked += 1;
}
console.log(`Linked powerbi-visuals-api into ${linked} visual package(s).`);
