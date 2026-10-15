#!/usr/bin/env node
// Copies built .pbiviz files into LotusWorks_Package/

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..');
const businessRoot = path.join(workspaceRoot, 'Business_Package');
const lotusRoot = path.join(workspaceRoot, 'LotusWorks_Package');

async function clearExistingLotusPackage() {
  await fs.mkdir(lotusRoot, { recursive: true });
  const entries = await fs.readdir(lotusRoot, { withFileTypes: true });
  const removals = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.pbiviz'))
    .map((entry) => fs.rm(path.join(lotusRoot, entry.name)));
  await Promise.all(removals);
}

const files = await fs.readdir(businessRoot);
const pbivizFiles = files.filter((f) => f.endsWith('.pbiviz'));

await clearExistingLotusPackage();

for (const file of pbivizFiles) {
  await fs.copyFile(path.join(businessRoot, file), path.join(lotusRoot, file));
}

console.log(`[sync] Copied ${pbivizFiles.length} .pbiviz files into LotusWorks_Package`);
