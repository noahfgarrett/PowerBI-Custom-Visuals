#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..');
const packagesRoot = path.join(workspaceRoot, 'packages');
const businessPackageRoot = path.join(workspaceRoot, 'Business_Package');

async function getVisualPackageDirs() {
  const entries = await fs.readdir(packagesRoot, { withFileTypes: true });
  const dirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(packagesRoot, entry.name));

  const visuals = [];
  for (const dir of dirs) {
    const pbivizPath = path.join(dir, 'pbiviz.json');
    try {
      await fs.access(pbivizPath);
      visuals.push(dir);
    } catch {
      // Non-visual package.
    }
  }

  return visuals.sort();
}

async function getBuiltPbivizFile(packageDir) {
  const distDir = path.join(packageDir, 'dist');
  const entries = await fs.readdir(distDir, { withFileTypes: true });
  const pbivizFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.pbiviz'))
    .map((entry) => path.join(distDir, entry.name));

  if (pbivizFiles.length !== 1) {
    throw new Error(
      `${path.relative(workspaceRoot, packageDir)} expected 1 .pbiviz in dist/, found ${pbivizFiles.length}`
    );
  }

  return pbivizFiles[0];
}

async function clearExistingBusinessPackage() {
  await fs.mkdir(businessPackageRoot, { recursive: true });
  const entries = await fs.readdir(businessPackageRoot, { withFileTypes: true });
  const removals = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.pbiviz'))
    .map((entry) => fs.rm(path.join(businessPackageRoot, entry.name)));
  await Promise.all(removals);
}

async function main() {
  const visualDirs = await getVisualPackageDirs();
  const builtFiles = [];

  for (const packageDir of visualDirs) {
    builtFiles.push(await getBuiltPbivizFile(packageDir));
  }

  await clearExistingBusinessPackage();

  for (const sourceFile of builtFiles) {
    const targetFile = path.join(businessPackageRoot, path.basename(sourceFile));
    await fs.copyFile(sourceFile, targetFile);
  }

  console.log(
    `[sync] Copied ${builtFiles.length} .pbiviz files into ${path.relative(workspaceRoot, businessPackageRoot)}`
  );
}

main().catch((error) => {
  console.error('[sync] Failed:', error.message);
  process.exitCode = 1;
});
