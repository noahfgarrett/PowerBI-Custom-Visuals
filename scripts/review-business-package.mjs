#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..');
const packagesRoot = path.join(workspaceRoot, 'packages');
const reportPath = path.join(workspaceRoot, 'Business_Package', 'review-report.json');

// Checks a visual is exempt from, keyed by package dir, then by issue code, with the reason. An exempt check is
// recorded in the report as "exempt: <reason>" instead of a warning. Every entry needs a reason a reviewer can audit.
const FFU_MAP_NO_ANIMATION =
  'the map has no chart transitions to turn off (it redraws its canvas directly); an animation card would be a phantom setting';
const FFU_MAP_NO_ACCESSIBILITY_CARD =
  'the map has no screen reader chart summaries for an accessibility card to toggle; its ARIA labels and high-contrast drawing are always on';
const REVIEW_EXEMPTIONS = {
  'qaqc-ffu-map': {
    'capabilities.animationSettings': FFU_MAP_NO_ANIMATION,
    'settings.animationSettingsModel': FFU_MAP_NO_ANIMATION,
    'capabilities.accessibilityFormatting': FFU_MAP_NO_ACCESSIBILITY_CARD,
  },
};

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

function hasPattern(source, pattern) {
  return pattern.test(source);
}

function collectMissingLocalizationKeys(value, objectPath = [], missing = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectMissingLocalizationKeys(item, [...objectPath, String(index)], missing);
    });
    return missing;
  }
  if (!value || typeof value !== 'object') return missing;

  for (const [propertyName, keyName] of [
    ['displayName', 'displayNameKey'],
    ['description', 'descriptionKey'],
    ['placeHolderText', 'placeHolderTextKey'],
  ]) {
    if (
      typeof value[propertyName] === 'string'
      && value[propertyName].trim().length > 0
      && typeof value[keyName] !== 'string'
    ) {
      missing.push(`${objectPath.join('.') || '<root>'}.${propertyName}`);
    }
  }

  for (const [key, child] of Object.entries(value)) {
    collectMissingLocalizationKeys(child, [...objectPath, key], missing);
  }
  return missing;
}

async function reviewPackage(packageDir) {
  const packageName = path.basename(packageDir);
  const packageJsonPath = path.join(packageDir, 'package.json');
  const pbivizPath = path.join(packageDir, 'pbiviz.json');
  const capabilitiesPath = path.join(packageDir, 'capabilities.json');
  const visualTsPath = path.join(packageDir, 'src', 'visual.ts');
  const settingsTsPath = path.join(packageDir, 'src', 'settings.ts');
  const visualTestPath = path.join(packageDir, 'src', '__tests__', 'visual.test.ts');

  const issues = [];

  const [packageJson, pbiviz, capabilities, visualTs, settingsTs] = await Promise.all([
    readJson(packageJsonPath),
    readJson(pbivizPath),
    readJson(capabilitiesPath),
    readText(visualTsPath),
    readText(settingsTsPath),
  ]);
  const hasGroupingRole = Array.isArray(capabilities?.dataRoles)
    && capabilities.dataRoles.some((role) => role?.kind === 'Grouping');
  const hasMeasureRole = Array.isArray(capabilities?.dataRoles)
    && capabilities.dataRoles.some((role) => role?.kind === 'Measure');
  const isFilterVisual = Boolean(capabilities?.objects?.general?.properties?.filter);

  // Power BI imposes this semantic restriction beyond the capabilities JSON schema.
  // https://learn.microsoft.com/power-bi/developer/visuals/dataview-mappings#conditions
  for (const [mappingIndex, mapping] of (capabilities?.dataViewMappings ?? []).entries()) {
    for (const [conditionIndex, condition] of (mapping.conditions ?? []).entries()) {
      const requiredRoles = Object.entries(condition).filter(([, range]) => range?.min >= 1).map(([role]) => role);
      if (requiredRoles.length > 1) pushIssue(issues, 'error', 'capabilities.mappingRequiredRoles',
        `Mapping ${mappingIndex}, condition ${conditionIndex} requires multiple roles (${requiredRoles.join(', ')}). Power BI supports at most one role with min >= 1 per condition.`, capabilitiesPath);
    }
  }

  const supportUrl = pbiviz?.visual?.supportUrl ?? '';
  const gitHubUrl = pbiviz?.visual?.gitHubUrl ?? '';
  const expectedVisualVersion = `${packageJson?.version}.0`;

  if (pbiviz?.visual?.version !== expectedVisualVersion) {
    pushIssue(
      issues,
      'error',
      'metadata.version',
      `package.json version ${packageJson?.version} does not match visual.version ${pbiviz?.visual?.version}.`,
      pbivizPath
    );
  }

  if (
    !Array.isArray(pbiviz?.stringResources)
    || !pbiviz.stringResources.includes('stringResources/en-US/resources.resjson')
  ) {
    pushIssue(
      issues,
      'warning',
      'metadata.stringResources',
      'The en-US string resource bundle is not registered in pbiviz.json.',
      pbivizPath
    );
  }

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

  const hasCardSettingsModel = /class\s+CardStyleSettings/.test(settingsTs)
    || /cardSettings\s*=\s*new\s+[A-Za-z0-9_]+Settings\s*\(/.test(settingsTs);
  if (!hasCardSettingsModel) {
    pushIssue(
      issues,
      'warning',
      'settings.cardSettingsModel',
      'A cardSettings formatting model is missing in settings.ts.',
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

  if (
    hasGroupingRole
    && hasSelectionManager
    && !hasPattern(visualTs, /allowInteractions/)
  ) {
    pushIssue(
      issues,
      'warning',
      'interaction.allowInteractions',
      'Selection behavior does not appear to honor the host allowInteractions gate.',
      visualTsPath
    );
  }

  if (
    hasGroupingRole
    && hasSelectionManager
    && !isFilterVisual
    && !hasPattern(visualTs, /showContextMenu/)
  ) {
    pushIssue(
      issues,
      'warning',
      'interaction.contextMenu',
      'No host context-menu behavior detected for selectable data marks.',
      visualTsPath
    );
  }

  if (
    hasGroupingRole
    && hasSelectionManager
    && !hasPattern(visualTs, /keydown|onkeydown|tabIndex|tabindex|attachKeyboardNav/)
  ) {
    pushIssue(
      issues,
      'warning',
      'accessibility.keyboard',
      'Selectable data marks do not appear to expose keyboard interaction.',
      visualTsPath
    );
  }

  if (
    !hasPattern(
      visualTs,
      /aria-label|ariaLabel|setAttribute\(\s*['"]role['"]|applyDataPointAria|attachKeyboardNav/
    )
  ) {
    pushIssue(
      issues,
      'warning',
      'accessibility.semantics',
      'No ARIA label or semantic role detected in the rendered visual.',
      visualTsPath
    );
  }

  if (
    !hasPattern(
      visualTs,
      /getHostHighContrastColors|applyBasicHighContrastStyles|isHighContrast|foregroundSelected/
    )
  ) {
    pushIssue(
      issues,
      'warning',
      'accessibility.highContrast',
      'No host high-contrast handling detected.',
      visualTsPath
    );
  }

  if (!hasPattern(visualTs, /notifyRenderingStarted/)) {
    pushIssue(
      issues,
      'warning',
      'lifecycle.renderingStarted',
      'The visual does not notify the host when rendering starts.',
      visualTsPath
    );
  }

  if (!hasPattern(visualTs, /notifyRenderingFinished/)) {
    pushIssue(
      issues,
      'warning',
      'lifecycle.renderingFinished',
      'The visual does not notify the host when rendering finishes.',
      visualTsPath
    );
  }

  if (!hasPattern(visualTs, /notifyRenderingFailed/)) {
    pushIssue(
      issues,
      'warning',
      'lifecycle.renderingFailed',
      'The visual does not report render failures to the host.',
      visualTsPath
    );
  }

  const noDataStatePattern =
    /renderNoDataState|renderEmptyState|pbi-no-data-state|filter-pane-setup-state|No data for the current selection|No data available/;
  if (!hasPattern(visualTs, noDataStatePattern)) {
    pushIssue(
      issues,
      'warning',
      'ux.noDataState',
      'No dedicated empty-selection state detected.',
      visualTsPath
    );
  }

  const rendersLandingPage = hasPattern(visualTs, /renderLandingPage|pbi-landing-page/);
  if (rendersLandingPage && capabilities?.supportsLandingPage !== true) {
    pushIssue(
      issues,
      'warning',
      'capabilities.supportsLandingPage',
      'A landing page is rendered, but supportsLandingPage is not enabled.',
      capabilitiesPath
    );
  }

  const rendersNoDataState = hasPattern(visualTs, noDataStatePattern);
  if (rendersNoDataState && capabilities?.supportsEmptyDataView !== true) {
    pushIssue(
      issues,
      'warning',
      'capabilities.supportsEmptyDataView',
      'A no-data view is rendered, but supportsEmptyDataView is not enabled.',
      capabilitiesPath
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

  if (
    hasPattern(visualTs, /tooltipService/)
    && capabilities?.tooltips?.supportEnhancedTooltips !== true
  ) {
    pushIssue(
      issues,
      'warning',
      'capabilities.enhancedTooltips',
      'The host tooltip service is used, but enhanced tooltips are not enabled.',
      capabilitiesPath
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

  // Highlights only exist for categorical and matrix mappings; a table mapping never receives them, so asking a
  // table-only visual to enable supportsHighlight would just switch off its cross-filtering.
  const mappings = Array.isArray(capabilities?.dataViewMappings) ? capabilities.dataViewMappings : [];
  const canReceiveHighlights = mappings.some((mapping) => mapping?.categorical || mapping?.matrix);
  if (hasMeasureRole && !isFilterVisual && canReceiveHighlights && capabilities?.supportsHighlight !== true) {
    pushIssue(
      issues,
      'warning',
      'capabilities.supportsHighlight',
      'supportsHighlight is not enabled for a visual with measure roles.',
      capabilitiesPath
    );
  }

  const hasAccessibilityFormatting = Object.keys(capabilities?.objects ?? {})
    .some((objectName) => objectName.toLowerCase().includes('accessibility'));
  if (!hasAccessibilityFormatting) {
    pushIssue(
      issues,
      'warning',
      'capabilities.accessibilityFormatting',
      'No accessibility formatting card is exposed.',
      capabilitiesPath
    );
  }

  const unnamedObjects = Object.entries(capabilities?.objects ?? {})
    .filter(([, object]) => !object?.displayName && !object?.displayNameKey)
    .map(([objectName]) => objectName);
  if (unnamedObjects.length > 0) {
    pushIssue(
      issues,
      'warning',
      'capabilities.objectLabels',
      `Formatting objects have no user-facing name: ${unnamedObjects.join(', ')}.`,
      capabilitiesPath
    );
  }

  const unnamedProperties = Object.entries(capabilities?.objects ?? {})
    .flatMap(([objectName, object]) =>
      Object.entries(object?.properties ?? {})
        .filter(([propertyName, property]) =>
          !(objectName === 'general' && propertyName === 'filter')
          && !property?.displayName
          && !property?.displayNameKey
        )
        .map(([propertyName]) => `${objectName}.${propertyName}`)
    );
  if (unnamedProperties.length > 0) {
    pushIssue(
      issues,
      'warning',
      'capabilities.propertyLabels',
      `Formatting properties have no user-facing name: ${unnamedProperties.join(', ')}.`,
      capabilitiesPath
    );
  }

  const missingLocalizationKeys = collectMissingLocalizationKeys(capabilities);
  if (missingLocalizationKeys.length > 0) {
    const preview = missingLocalizationKeys.slice(0, 12).join(', ');
    const suffix = missingLocalizationKeys.length > 12
      ? `, and ${missingLocalizationKeys.length - 12} more`
      : '';
    pushIssue(
      issues,
      'warning',
      'capabilities.localization',
      `User-facing capability labels are missing localization keys: ${preview}${suffix}.`,
      capabilitiesPath
    );
  }

  try {
    await fs.access(visualTestPath);
  } catch {
    pushIssue(
      issues,
      'warning',
      'tests.visual',
      'No focused visual.test.ts regression suite was found.',
      packageDir
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

  const exemptReasons = REVIEW_EXEMPTIONS[packageName] ?? {};
  const isExempt = (issue) => issue.severity === 'warning' && typeof exemptReasons[issue.code] === 'string';
  const activeIssues = issues.filter((issue) => !isExempt(issue));
  const exemptions = issues.filter(isExempt).map((issue) => ({
    code: issue.code,
    note: `exempt: ${exemptReasons[issue.code]}`,
    file: path.relative(workspaceRoot, issue.file),
  }));

  return {
    package: packageName,
    files: {
      package: path.relative(workspaceRoot, packageJsonPath),
      pbiviz: path.relative(workspaceRoot, pbivizPath),
      capabilities: path.relative(workspaceRoot, capabilitiesPath),
      visual: path.relative(workspaceRoot, visualTsPath),
      settings: path.relative(workspaceRoot, settingsTsPath),
    },
    issueCount: activeIssues.length,
    issues: activeIssues.map((issue) => ({
      ...issue,
      file: path.relative(workspaceRoot, issue.file),
    })),
    exemptions,
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
  const exemptCount = results.reduce((sum, result) => sum + result.exemptions.length, 0);

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      packageCount: results.length,
      warningCount,
      errorCount,
      exemptCount,
    },
    packages: results,
  };

  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  const reportJson = JSON.stringify(report, null, 2) + '\n';
  await fs.writeFile(reportPath, reportJson, 'utf8');

  console.log(`[review] Checked ${results.length} visual packages.`);
  console.log(`[review] warnings=${warningCount}, errors=${errorCount}, exempt=${exemptCount}`);
  console.log(`[review] Wrote ${path.relative(workspaceRoot, reportPath)}`);

  const topFindings = results
    .filter((result) => result.issueCount > 0)
    .sort((a, b) => b.issueCount - a.issueCount)
    .slice(0, 10);

  for (const finding of topFindings) {
    console.log(`[review] ${finding.package}: ${finding.issueCount} issue(s)`);
  }

  for (const result of results) {
    for (const exemption of result.exemptions) {
      console.log(`[review] ${result.package}: ${exemption.code} ${exemption.note}`);
    }
  }

  if (errorCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[review] Failed:', error);
  process.exitCode = 1;
});
