#!/usr/bin/env node
// Copies built .pbiviz files and the FFU layout script into LotusWorks_Package/

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..');
const businessRoot = path.join(workspaceRoot, 'Business_Package');
const lotusRoot = path.join(workspaceRoot, 'LotusWorks_Package');
const ffuLayoutSource = path.join(workspaceRoot, 'scripts', 'ffu-layout');
// The FFU Map setup guide's step 1 runs this script from the package. Code and docs only: no drawing data.
const FFU_LAYOUT_FILES = ['extract_ffu_layout.py', 'README.md'];

async function clearExistingLotusPackage() {
  await fs.mkdir(lotusRoot, { recursive: true });
  const entries = await fs.readdir(lotusRoot, { withFileTypes: true });
  const removals = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.pbiviz'))
    .map((entry) => fs.rm(path.join(lotusRoot, entry.name)));
  await Promise.all(removals);
}

async function copyFfuLayoutScript() {
  const target = path.join(lotusRoot, 'ffu-layout');
  await fs.mkdir(target, { recursive: true });
  for (const file of FFU_LAYOUT_FILES) {
    await fs.copyFile(path.join(ffuLayoutSource, file), path.join(target, file));
  }
}

const files = await fs.readdir(businessRoot);
const pbivizFiles = files.filter((f) => f.endsWith('.pbiviz'));

await clearExistingLotusPackage();

for (const file of pbivizFiles) {
  await fs.copyFile(path.join(businessRoot, file), path.join(lotusRoot, file));
}

await copyFfuLayoutScript();

console.log(
  `[sync] Copied ${pbivizFiles.length} .pbiviz files and ffu-layout/ (${FFU_LAYOUT_FILES.length} files) into LotusWorks_Package`
);
