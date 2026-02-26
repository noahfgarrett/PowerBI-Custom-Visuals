#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..');
const packagesRoot = path.join(workspaceRoot, 'packages');
const reportPath = path.join(workspaceRoot, 'Business_Package', 'review-report.json');

const placeholderSupportUrls = new Set([
  '',
  'https://github.com',
  'http://github.com',
]);

function isHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function readText(filePath) {
  return fs.readFile(filePath, 'utf8');
}

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
      // Not a visual package (e.g. core).
    }
  }

  return visuals.sort();
}

function pushIssue(issues, severity, code, message, file) {
  issues.push({ severity, code, message, file });
}

function hasObjectProperty(capabilities, objectName, propertyName) {
  const objectDef = capabilities?.objects?.[objectName];
  if (!objectDef) return false;
  return Boolean(objectDef.properties?.[propertyName]);
}

async function reviewPackage(packageDir) {
  const packageName = path.basename(packageDir);
  const pbivizPath = path.join(packageDir, 'pbiviz.json');
  const capabilitiesPath = path.join(packageDir, 'capabilities.json');
  const visualTsPath = path.join(packageDir, 'src', 'visual.ts');
  const settingsTsPath = path.join(packageDir, 'src', 'settings.ts');

  const issues = [];

  const [pbiviz, capabilities, visualTs, settingsTs] = await Promise.all([
    readJson(pbivizPath),
    readJson(capabilitiesPath),
    readText(visualTsPath),
    readText(settingsTsPath),
  ]);
  const hasGroupingRole = Array.isArray(capabilities?.dataRoles)
    && capabilities.dataRoles.some((role) => role?.kind === 'Grouping');

  const supportUrl = pbiviz?.visual?.supportUrl ?? '';
  const gitHubUrl = pbiviz?.visual?.gitHubUrl ?? '';

  if (placeholderSupportUrls.has(supportUrl)) {
    pushIssue(
      issues,
      'warning',
      'metadata.supportUrl',
      'supportUrl is a placeholder and should point to real docs/support.',
      pbivizPath
    );
  } else if (!isHttpsUrl(supportUrl)) {
    pushIssue(
      issues,
      'warning',
      'metadata.supportUrlFormat',
      'supportUrl should be a valid HTTPS URL.',
      pbivizPath
    );
  }

  if (!gitHubUrl) {
    pushIssue(
      issues,
      'warning',
      'metadata.gitHubUrl',
      'gitHubUrl is empty; set it for source transparency.',
      pbivizPath
    );
  } else if (!isHttpsUrl(gitHubUrl)) {
    pushIssue(
      issues,
      'warning',
      'metadata.gitHubUrlFormat',
      'gitHubUrl should be a valid HTTPS URL.',
      pbivizPath
    );
  }

  const hasCardSettings = Boolean(capabilities?.objects?.cardSettings);
  if (!hasCardSettings) {
    pushIssue(
      issues,
      'warning',
      'capabilities.cardSettings',
      'cardSettings object is missing from capabilities.',
      capabilitiesPath
    );
  }

  const hasAnimationSettings = Boolean(capabilities?.objects?.animationSettings);
  if (!hasAnimationSettings) {
    pushIssue(
      issues,
      'warning',
      'capabilities.animationSettings',
      'animationSettings object is missing from capabilities.',
      capabilitiesPath
    );
  }

  const hasCardSettingsModel = /class\s+CardStyleSettings/.test(settingsTs);
  if (!hasCardSettingsModel) {
    pushIssue(
      issues,
      'warning',
      'settings.cardSettingsModel',
      'CardStyleSettings class is missing in settings.ts.',
      settingsTsPath
    );
  }

  const hasAnimationSettingsModel = /animationSettings\s*=/.test(settingsTs);
  if (!hasAnimationSettingsModel) {
    pushIssue(
      issues,
      'warning',
      'settings.animationSettingsModel',
      'animationSettings model binding is missing in settings.ts.',
      settingsTsPath
    );
  }

  const hasSelectionManager = /createSelectionManager|selectionManager/.test(visualTs);
  if (hasGroupingRole && !hasSelectionManager) {
    pushIssue(
      issues,
      'warning',
      'interaction.selection',
      'No selection manager detected; cross-filter interactions may be limited.',
      visualTsPath
    );
  }

  const hasTooltipPattern = /tooltipService|className\s*=\s*['"][^'"]*tooltip|title\s*=|append\(\s*['"]title['"]\s*\)|createElementNS?\([^)]*['"]title['"]/.test(visualTs);
  if (!hasTooltipPattern) {
    pushIssue(
      issues,
      'warning',
      'interaction.tooltip',
      'No tooltip behavior detected in visual.ts.',
      visualTsPath
    );
  }

  const hasDataReduction = JSON.stringify(capabilities).includes('"dataReductionAlgorithm"');
  if (hasGroupingRole && !hasDataReduction) {
    pushIssue(
      issues,
      'warning',
      'capabilities.dataReduction',
      'No dataReductionAlgorithm detected; large datasets may degrade performance.',
      capabilitiesPath
    );
  }

  const hasBackgroundColor =
    hasObjectProperty(capabilities, 'cardSettings', 'backgroundColor') ||
    hasObjectProperty(capabilities, 'cardSettings', 'bgColor');

  if (!hasBackgroundColor) {
    pushIssue(
      issues,
      'warning',
      'capabilities.cardBackgroundColor',
      'No card background color property found in cardSettings.',
      capabilitiesPath
    );
  }

  return {
    package: packageName,
    files: {
      pbiviz: path.relative(workspaceRoot, pbivizPath),
      capabilities: path.relative(workspaceRoot, capabilitiesPath),
      visual: path.relative(workspaceRoot, visualTsPath),
      settings: path.relative(workspaceRoot, settingsTsPath),
    },
    issueCount: issues.length,
    issues: issues.map((issue) => ({
      ...issue,
      file: path.relative(workspaceRoot, issue.file),
    })),
  };
}

async function main() {
  const visualDirs = await getVisualPackageDirs();
  const results = [];

  for (const dir of visualDirs) {
    results.push(await reviewPackage(dir));
  }

  const warningCount = results.reduce(
    (sum, result) => sum + result.issues.filter((issue) => issue.severity === 'warning').length,
    0
  );
  const errorCount = results.reduce(
    (sum, result) => sum + result.issues.filter((issue) => issue.severity === 'error').length,
    0
  );

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      packageCount: results.length,
      warningCount,
      errorCount,
    },
    packages: results,
  };

  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');

  console.log(`[review] Checked ${results.length} visual packages.`);
  console.log(`[review] warnings=${warningCount}, errors=${errorCount}`);
  console.log(`[review] Wrote ${path.relative(workspaceRoot, reportPath)}`);

  const topFindings = results
    .filter((result) => result.issueCount > 0)
    .sort((a, b) => b.issueCount - a.issueCount)
    .slice(0, 10);

  for (const finding of topFindings) {
    console.log(`[review] ${finding.package}: ${finding.issueCount} issue(s)`);
  }

  if (errorCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[review] Failed:', error);
  process.exitCode = 1;
});
