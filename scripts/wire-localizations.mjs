#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const packagesRoot = path.join(repoRoot, 'packages');
const sharedSettingsFile = path.join(packagesRoot, 'core', 'src', 'shared-settings.ts');

const COMMON_RUNTIME_VALUES = {
  Common_BreadcrumbAll: 'All',
};

const RUNTIME_REPLACEMENTS = {
  'animated-donut-pro': {
    'src/visual.ts': [
      runtimeLiteralReplacement(
        'AnimatedDonutPro_NoDataState',
        "getLocalizedString(this.host, 'AnimatedDonutPro_NoDataState', 'No data for the current selection.')",
        "getLocalizedString(this.host, 'AnimatedDonutPro_NoDataState', 'No data for the current selection.')",
        'No data for the current selection.',
      ),
      runtimeLiteralReplacement(
        'AnimatedDonutPro_EmptyState',
        "getLocalizedString(this.host, 'AnimatedDonutPro_EmptyState', 'Add a Value measure to get started. Bind a Category for per-category slices, or add multiple Values for one slice per measure.')",
        "getLocalizedString(this.host, 'AnimatedDonutPro_EmptyState', 'Add a Value measure to get started. Bind a Category for per-category slices, or add multiple Values for one slice per measure.')",
        'Add a Value measure to get started. Bind a Category for per-category slices, or add multiple Values for one slice per measure.',
      ),
    ],
  },
  'animated-waterfall': {
    'src/visual.ts': [
      runtimeStatementReplacement('AnimatedWaterfall_BreadcrumbAll', "allSpan.textContent = 'All';", "allSpan.textContent = getLocalizedString(this.host, 'Common_BreadcrumbAll', 'All');", 'All'),
      runtimeLiteralReplacement('AnimatedWaterfall_LandingTitle', "title: 'Add data to build a waterfall chart',", "title: getLocalizedString(this.host, 'AnimatedWaterfall_LandingTitle', 'Add data to build a waterfall chart'),", 'Add data to build a waterfall chart'),
      runtimeLiteralReplacement('AnimatedWaterfall_LandingDescription', "description: 'Animated Waterfall needs a category and a measure to show cumulative change.',", "description: getLocalizedString(this.host, 'AnimatedWaterfall_LandingDescription', 'Animated Waterfall needs a category and a measure to show cumulative change.'),", 'Animated Waterfall needs a category and a measure to show cumulative change.'),
      runtimeLiteralReplacement('AnimatedWaterfall_LandingStepAxis', "'Put a category on the axis.',", "getLocalizedString(this.host, 'AnimatedWaterfall_LandingStepAxis', 'Put a category on the axis.'),", 'Put a category on the axis.'),
      runtimeLiteralReplacement('AnimatedWaterfall_LandingStepMeasure', "'Add a measure for the change value.',", "getLocalizedString(this.host, 'AnimatedWaterfall_LandingStepMeasure', 'Add a measure for the change value.'),", 'Add a measure for the change value.'),
      runtimeLiteralReplacement('AnimatedWaterfall_LandingStepOptional', "'Optional total and subtotal fields enable richer waterfalls.',", "getLocalizedString(this.host, 'AnimatedWaterfall_LandingStepOptional', 'Optional total and subtotal fields enable richer waterfalls.'),", 'Optional total and subtotal fields enable richer waterfalls.'),
    ],
  },
  'bar-chart-pro': {
    'src/visual.ts': [
      runtimeStatementReplacement('BarChartPro_BreadcrumbAll', "allSpan.textContent = 'All';", "allSpan.textContent = getLocalizedString(this.host, 'Common_BreadcrumbAll', 'All');", 'All'),
      runtimeLiteralReplacement('BarChartPro_LandingTitle', "title: 'Add data to build a bar chart',", "title: getLocalizedString(this.host, 'BarChartPro_LandingTitle', 'Add data to build a bar chart'),", 'Add data to build a bar chart'),
      runtimeLiteralReplacement('BarChartPro_LandingDescription', "description: 'Bar Chart Pro needs a category and at least one value to render.',", "description: getLocalizedString(this.host, 'BarChartPro_LandingDescription', 'Bar Chart Pro needs a category and at least one value to render.'),", 'Bar Chart Pro needs a category and at least one value to render.'),
      runtimeLiteralReplacement('BarChartPro_LandingStepCategory', "'Put a field on the category axis.',", "getLocalizedString(this.host, 'BarChartPro_LandingStepCategory', 'Put a field on the category axis.'),", 'Put a field on the category axis.'),
      runtimeLiteralReplacement('BarChartPro_LandingStepMeasure', "'Add a numeric measure.',", "getLocalizedString(this.host, 'BarChartPro_LandingStepMeasure', 'Add a numeric measure.'),", 'Add a numeric measure.'),
      runtimeLiteralReplacement('BarChartPro_LandingStepOptional', "'Optional line, target, or drill-down fields unlock richer behavior.',", "getLocalizedString(this.host, 'BarChartPro_LandingStepOptional', 'Optional line, target, or drill-down fields unlock richer behavior.'),", 'Optional line, target, or drill-down fields unlock richer behavior.'),
    ],
  },
  'bar-race': {
    'src/visual.ts': [
      runtimeTextReplacement('BarRace_EmptyState', 'Add a Category, Time Axis, and Measure to get started.'),
    ],
  },
  'box-plot': {
    'src/visual.ts': [
      runtimeTextReplacement('BoxPlot_EmptyState', 'Add a Category and at least one Value to get started.'),
    ],
  },
  'bullet-chart-pro': {
    'src/visual.ts': [
      runtimeLiteralReplacement('BulletChartPro_LandingTitle', "title: 'Add data to build a bullet chart',", "title: getLocalizedString(this.host, 'BulletChartPro_LandingTitle', 'Add data to build a bullet chart'),", 'Add data to build a bullet chart'),
      runtimeLiteralReplacement('BulletChartPro_LandingDescription', "description: 'Bullet Chart Pro needs one category and one measure to render the actual bar.',", "description: getLocalizedString(this.host, 'BulletChartPro_LandingDescription', 'Bullet Chart Pro needs one category and one measure to render the actual bar.'),", 'Bullet Chart Pro needs one category and one measure to render the actual bar.'),
      runtimeLiteralReplacement('BulletChartPro_LandingStepAxis', "'Put a category on the axis.',", "getLocalizedString(this.host, 'BulletChartPro_LandingStepAxis', 'Put a category on the axis.'),", 'Put a category on the axis.'),
      runtimeLiteralReplacement('BulletChartPro_LandingStepMeasure', "'Add a measure for the main value.',", "getLocalizedString(this.host, 'BulletChartPro_LandingStepMeasure', 'Add a measure for the main value.'),", 'Add a measure for the main value.'),
      runtimeLiteralReplacement('BulletChartPro_LandingStepOptional', "'Optionally add target and range measures for richer context.',", "getLocalizedString(this.host, 'BulletChartPro_LandingStepOptional', 'Optionally add target and range measures for richer context.'),", 'Optionally add target and range measures for richer context.'),
      runtimeLiteralReplacement('BulletChartPro_LandingHint', "hint: 'This landing page appears until the visual has enough fields.',", "hint: getLocalizedString(this.host, 'BulletChartPro_LandingHint', 'This landing page appears until the visual has enough fields.'),", 'This landing page appears until the visual has enough fields.'),
    ],
  },
  'dumbbell-chart': {
    'src/visual.ts': [
      runtimeLiteralReplacement('DumbbellChart_LandingTitle', "title: 'No data to display',", "title: getLocalizedString(this.host, 'DumbbellChart_LandingTitle', 'No data to display'),", 'No data to display'),
      runtimeLiteralReplacement('DumbbellChart_LandingDescription', "description: 'Add a category plus Start Value and End Value fields to build the dumbbell comparison.',", "description: getLocalizedString(this.host, 'DumbbellChart_LandingDescription', 'Add a category plus Start Value and End Value fields to build the dumbbell comparison.'),", 'Add a category plus Start Value and End Value fields to build the dumbbell comparison.'),
      runtimeLiteralReplacement('DumbbellChart_LandingStepCategory', "'Bind one category field to define each row.',", "getLocalizedString(this.host, 'DumbbellChart_LandingStepCategory', 'Bind one category field to define each row.'),", 'Bind one category field to define each row.'),
      runtimeLiteralReplacement('DumbbellChart_LandingStepMeasures', "'Bind two numeric measures for Start Value and End Value.',", "getLocalizedString(this.host, 'DumbbellChart_LandingStepMeasures', 'Bind two numeric measures for Start Value and End Value.'),", 'Bind two numeric measures for Start Value and End Value.'),
      runtimeLiteralReplacement('DumbbellChart_LandingHint', "hint: 'Once data is present, the chart will support selection, drill-through context menus, and sorting where applicable.',", "hint: getLocalizedString(this.host, 'DumbbellChart_LandingHint', 'Once data is present, the chart will support selection, drill-through context menus, and sorting where applicable.'),", 'Once data is present, the chart will support selection, drill-through context menus, and sorting where applicable.'),
    ],
  },
  'funnel-pro': {
    'src/visual.ts': [
      runtimeLiteralReplacement('FunnelPro_LandingTitle', "title: 'No data to display',", "title: getLocalizedString(this.host, 'FunnelPro_LandingTitle', 'No data to display'),", 'No data to display'),
      runtimeLiteralReplacement('FunnelPro_LandingDescription', "description: 'Add one stage field and one numeric value field to build the funnel.',", "description: getLocalizedString(this.host, 'FunnelPro_LandingDescription', 'Add one stage field and one numeric value field to build the funnel.'),", 'Add one stage field and one numeric value field to build the funnel.'),
      runtimeLiteralReplacement('FunnelPro_LandingStepCategory', "'Bind a category field for the funnel stages.',", "getLocalizedString(this.host, 'FunnelPro_LandingStepCategory', 'Bind a category field for the funnel stages.'),", 'Bind a category field for the funnel stages.'),
      runtimeLiteralReplacement('FunnelPro_LandingStepMeasure', "'Bind a numeric measure for stage values.',", "getLocalizedString(this.host, 'FunnelPro_LandingStepMeasure', 'Bind a numeric measure for stage values.'),", 'Bind a numeric measure for stage values.'),
      runtimeLiteralReplacement('FunnelPro_LandingHint', "hint: 'When data is present, the funnel supports selection and empty-space context menus like native charts.',", "hint: getLocalizedString(this.host, 'FunnelPro_LandingHint', 'When data is present, the funnel supports selection and empty-space context menus like native charts.'),", 'When data is present, the funnel supports selection and empty-space context menus like native charts.'),
    ],
  },
  'gantt-chart-pro': {
    'src/visual.ts': [
      runtimeTextReplacement('GanttChartPro_EmptyMissingFields', 'Add Task Name, Start Date, and End Date fields'),
      runtimeTextReplacement('GanttChartPro_EmptyNoValidRanges', 'No valid date ranges found'),
    ],
  },
  'gauge-cluster': {
    'src/visual.ts': [
      runtimeTextReplacement('GaugeCluster_EmptyState', 'Add a category and measure to populate gauges'),
    ],
  },
  'health-bar': {
    'src/visual.ts': [
      runtimeLiteralReplacement('HealthBar_LandingTitle', "title: 'Add data to build health bars',", "title: getLocalizedString(this.host, 'HealthBar_LandingTitle', 'Add data to build health bars'),", 'Add data to build health bars'),
      runtimeLiteralReplacement('HealthBar_LandingDescription', "description: 'Bind a category and a measure to render the vertical health meter.',", "description: getLocalizedString(this.host, 'HealthBar_LandingDescription', 'Bind a category and a measure to render the vertical health meter.'),", 'Bind a category and a measure to render the vertical health meter.'),
      runtimeLiteralReplacement('HealthBar_LandingSteps', "steps: ['Category', 'Measure', 'Optional target'],", "steps: [getLocalizedString(this.host, 'HealthBar_LandingStepCategory', 'Category'), getLocalizedString(this.host, 'HealthBar_LandingStepMeasure', 'Measure'), getLocalizedString(this.host, 'HealthBar_LandingStepOptional', 'Optional target')],", 'Optional target', {
        HealthBar_LandingStepCategory: 'Category',
        HealthBar_LandingStepMeasure: 'Measure',
        HealthBar_LandingStepOptional: 'Optional target',
      }),
    ],
  },
  'heatmap-calendar': {
    'src/visual.ts': [
      runtimeTextReplacement('HeatmapCalendar_EmptyState', 'Add a Date and Measure to get started.'),
    ],
  },
  'kpi-card': {
    'src/visual.ts': [
      runtimeTextReplacement('KpiCard_NoData', 'No data'),
      runtimeTextReplacement('KpiCard_EmptyState', 'Add a measure to the Value field to see KPI data.'),
    ],
  },
  'morphing-area-chart': {
    'src/visual.ts': [
      runtimeTextReplacement('MorphingAreaChart_EmptyState', 'Add a Category and at least one Measure to get started.'),
    ],
  },
  'polar-chart': {
    'src/visual.ts': [
      runtimeTextReplacement('PolarChart_EmptyState', 'Add a category and measure'),
    ],
  },
  'progress-bar-stack': {
    'src/visual.ts': [
      runtimeLiteralReplacement('ProgressBarStack_LandingTitle', "title: 'Add data to build progress bars',", "title: getLocalizedString(this.host, 'ProgressBarStack_LandingTitle', 'Add data to build progress bars'),", 'Add data to build progress bars'),
      runtimeLiteralReplacement('ProgressBarStack_LandingDescription', "description: 'Bind a category and a measure to render each progress row.',", "description: getLocalizedString(this.host, 'ProgressBarStack_LandingDescription', 'Bind a category and a measure to render each progress row.'),", 'Bind a category and a measure to render each progress row.'),
      runtimeLiteralReplacement('ProgressBarStack_LandingSteps', "steps: ['Category', 'Measure', 'Optional target'],", "steps: [getLocalizedString(this.host, 'ProgressBarStack_LandingStepCategory', 'Category'), getLocalizedString(this.host, 'ProgressBarStack_LandingStepMeasure', 'Measure'), getLocalizedString(this.host, 'ProgressBarStack_LandingStepOptional', 'Optional target')],", 'Optional target', {
        ProgressBarStack_LandingStepCategory: 'Category',
        ProgressBarStack_LandingStepMeasure: 'Measure',
        ProgressBarStack_LandingStepOptional: 'Optional target',
      }),
    ],
  },
  'radar-chart': {
    'src/visual.ts': [
      runtimeTextReplacement('RadarChart_EmptyState', 'Add at least 3 categories and a measure.'),
    ],
  },
  'ring-stack': {
    'src/visual.ts': [
      runtimeTextReplacement('RingStack_EmptyState', 'Drop measures here'),
    ],
  },
  'scatter-bubble': {
    'src/visual.ts': [
      runtimeTextReplacement('ScatterBubble_LandingTitle', 'Add data to build a scatter plot'),
      runtimeTextReplacement('ScatterBubble_LandingDescription', 'Compare two measures on X and Y, then optionally size bubbles with a third measure.'),
      runtimeTextReplacement('ScatterBubble_LandingHint', 'Use quadrants, trend lines, clustering, or playback when the data calls for them.'),
    ],
  },
  'status-indicator': {
    'src/visual.ts': [
      runtimeLiteralReplacement('StatusIndicator_LandingTitle', "title: 'Add data to build status cards',", "title: getLocalizedString(this.host, 'StatusIndicator_LandingTitle', 'Add data to build status cards'),", 'Add data to build status cards'),
      runtimeLiteralReplacement('StatusIndicator_LandingDescription', "description: 'Bind a category and a measure to render each status indicator.',", "description: getLocalizedString(this.host, 'StatusIndicator_LandingDescription', 'Bind a category and a measure to render each status indicator.'),", 'Bind a category and a measure to render each status indicator.'),
      runtimeLiteralReplacement('StatusIndicator_LandingSteps', "steps: ['Category', 'Measure', 'Optional thresholds or status text'],", "steps: [getLocalizedString(this.host, 'StatusIndicator_LandingStepCategory', 'Category'), getLocalizedString(this.host, 'StatusIndicator_LandingStepMeasure', 'Measure'), getLocalizedString(this.host, 'StatusIndicator_LandingStepOptional', 'Optional thresholds or status text')],", 'Optional thresholds or status text', {
        StatusIndicator_LandingStepCategory: 'Category',
        StatusIndicator_LandingStepMeasure: 'Measure',
        StatusIndicator_LandingStepOptional: 'Optional thresholds or status text',
      }),
    ],
  },
  'sunburst-chart': {
    'src/visual.ts': [
      runtimeTextReplacement('SunburstChart_EmptyState', 'Add hierarchy levels and a measure'),
      runtimeTextReplacement('SunburstChart_NonPositiveEmptyState', 'All measure values are zero or negative — sunburst requires positive values.'),
      runtimeStatementReplacement('SunburstChart_BreadcrumbAll', "allSpan.textContent = 'All';", "allSpan.textContent = getLocalizedString(this.host, 'Common_BreadcrumbAll', 'All');", 'All'),
    ],
  },
  'timeline-milestone': {
    'src/visual.ts': [
      runtimeTextReplacement('TimelineMilestone_EmptyState', 'Add Date and Label fields'),
    ],
  },
  'treemap-pro': {
    'src/visual.ts': [
      runtimeTextReplacement('TreemapPro_EmptyState', 'Add at least one grouping level and a measure to get started.'),
      runtimeStatementReplacement('TreemapPro_BreadcrumbAll', "allSpan.textContent = 'All';", "allSpan.textContent = getLocalizedString(this.host, 'Common_BreadcrumbAll', 'All');", 'All'),
    ],
  },
};

async function main() {
  const packageNames = await getPackageNames();
  const sharedResources = await processSettingsFile(sharedSettingsFile, 'SharedSettings');

  for (const packageName of packageNames) {
    const packageDir = path.join(packagesRoot, packageName);
    const packageResources = {};

    Object.assign(packageResources, COMMON_RUNTIME_VALUES);
    const settingsFile = path.join(packageDir, 'src', 'settings.ts');
    Object.assign(packageResources, await processSettingsFile(settingsFile, `${toPascalCase(packageName)}Settings`));

    const capabilitiesFile = path.join(packageDir, 'capabilities.json');
    Object.assign(packageResources, await processCapabilitiesFile(capabilitiesFile, `${toPascalCase(packageName)}Capabilities`));

    await processPbivizFile(path.join(packageDir, 'pbiviz.json'));
    await processVisualFile(packageDir, packageName, packageResources);
    await writeStringResources(packageDir, {
      ...sharedResources,
      ...packageResources,
    });
  }
}

async function getPackageNames() {
  const entries = await fs.readdir(packagesRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && entry.name !== 'core')
    .map((entry) => entry.name)
    .sort();
}

async function processSettingsFile(filePath, keyPrefix) {
  let text = await fs.readFile(filePath, 'utf8');
  const resources = {};
  const counters = { displayName: 0, description: 0, placeholder: 0 };

  collectExistingSettingsResources(text, resources);
  seedSettingsCounters(resources, keyPrefix, counters);

  text = text.replace(
    /^(\s*)(displayName|description|placeholder)\s*=\s*(['"])(.*?)\3\s*;(?!\r?\n\s*(?:displayNameKey|descriptionKey|placeholderKey)\s*=)/gm,
    (match, indent, property, quote, value) => {
      const key = nextGeneratedKey(keyPrefix, property, counters);
      resources[key] = value;
      return `${match}\n${indent}${property}Key = '${key}';`;
    },
  );

  text = text.replace(
    /(displayName|description|placeholder)\s*:\s*(["'])(.*?)\2(?=\s*[,}])/g,
    (match, property, quote, value, offset, source) => {
      const keyName = `${property}Key`;
      const followingText = source.slice(offset + match.length);
      if (new RegExp(`^\\s*,\\s*${keyName}\\s*:`).test(followingText)) {
        return match;
      }

      const key = nextGeneratedKey(keyPrefix, property, counters);
      resources[key] = value;
      return `${match}, ${keyName}: '${key}'`;
    },
  );

  await fs.writeFile(filePath, text);

  return resources;
}

async function processCapabilitiesFile(filePath, keyPrefix) {
  const text = await fs.readFile(filePath, 'utf8');
  const json = JSON.parse(text);
  const resources = {};
  const counters = { displayName: 0, description: 0, placeHolderText: 0 };

  walkObject(json, (node) => {
    collectCapabilityResource(node, 'displayName', 'displayNameKey', resources);
    collectCapabilityResource(node, 'description', 'descriptionKey', resources);
    collectCapabilityResource(node, 'placeHolderText', 'placeHolderTextKey', resources);
    maybeInjectCapabilityKey(node, 'displayName', 'displayNameKey', keyPrefix, counters, resources);
    maybeInjectCapabilityKey(node, 'description', 'descriptionKey', keyPrefix, counters, resources);
    maybeInjectCapabilityKey(node, 'placeHolderText', 'placeHolderTextKey', keyPrefix, counters, resources);
  });

  await fs.writeFile(filePath, `${JSON.stringify(json, null, 2)}\n`);
  return resources;
}

async function processPbivizFile(filePath) {
  const text = await fs.readFile(filePath, 'utf8');
  const json = JSON.parse(text);
  const desired = ['stringResources/en-US/resources.resjson'];
  if (!Array.isArray(json.stringResources) || json.stringResources.length === 0) {
    json.stringResources = desired;
  } else {
    json.stringResources = Array.from(new Set([...json.stringResources, ...desired]));
  }
  await fs.writeFile(filePath, `${JSON.stringify(json, null, 2)}\n`);
}

async function processVisualFile(packageDir, packageName, packageResources) {
  const visualFile = path.join(packageDir, 'src', 'visual.ts');
  let text = await fs.readFile(visualFile, 'utf8');

  text = text.replaceAll(
    'new FormattingSettingsService();',
    'new FormattingSettingsService(options.host.createLocalizationManager());',
  );

  const runtimeConfig = RUNTIME_REPLACEMENTS[packageName];
  const runtimeResourceValues = {};
  const coreImports = new Set();

  if (runtimeConfig) {
    coreImports.add('getLocalizedString');
    for (const [relativeFile, replacements] of Object.entries(runtimeConfig)) {
      if (path.join(packageDir, relativeFile) !== visualFile) continue;
      for (const replacement of replacements) {
        if (text.includes(replacement.find)) {
          text = text.replace(replacement.find, replacement.replace);
          Object.assign(runtimeResourceValues, replacement.values);
        } else if (text.includes(replacement.replace)) {
          Object.assign(runtimeResourceValues, replacement.values);
        }
      }
    }
  }

  // Keep runtime resources in sync when a visual updates an already-localized
  // sentence without requiring a matching entry in RUNTIME_REPLACEMENTS.
  for (const match of text.matchAll(/getLocalizedString\(\s*this\.host,\s*'([^']+)'\s*,\s*'((?:\\'|[^'])*)'\s*,?\s*\)/g)) {
    runtimeResourceValues[match[1]] = match[2].replaceAll("\\'", "'");
  }

  if (text.includes('createLocalizationManager(') || text.includes('new FormattingSettingsService(options.host.createLocalizationManager());')) {
    // direct constructor replacement already embeds host localization access
  }

  if (runtimeConfig) {
    text = ensureCoreImport(text, 'getLocalizedString');
  }

  await fs.writeFile(visualFile, text);
  Object.assign(packageResources, runtimeResourceValues);
}

async function writeStringResources(packageDir, values) {
  const resourceDir = path.join(packageDir, 'stringResources', 'en-US');
  await fs.mkdir(resourceDir, { recursive: true });
  const resourceFile = path.join(resourceDir, 'resources.resjson');
  await fs.writeFile(resourceFile, `${JSON.stringify({
    locale: 'en-US',
    values,
  }, null, 2)}\n`);
}

function maybeInjectCapabilityKey(node, propertyName, keyName, keyPrefix, counters, resources) {
  if (typeof node[propertyName] !== 'string' || node[keyName]) return;
  const key = nextGeneratedKey(keyPrefix, propertyName, counters);
  node[keyName] = key;
  resources[key] = node[propertyName];
}

function collectCapabilityResource(node, propertyName, keyName, resources) {
  if (typeof node[propertyName] !== 'string' || typeof node[keyName] !== 'string') return;
  resources[node[keyName]] = node[propertyName];
}

function walkObject(value, visitor) {
  if (Array.isArray(value)) {
    for (const item of value) walkObject(item, visitor);
    return;
  }
  if (!value || typeof value !== 'object') return;
  visitor(value);
  for (const child of Object.values(value)) {
    walkObject(child, visitor);
  }
}

function ensureCoreImport(text, symbol) {
  const importPattern = /import\s*{([\s\S]*?)}\s*from '\.\.\/\.\.\/core\/src';/;
  const match = importPattern.exec(text);
  if (!match) return text;
  if (match[1].includes(symbol)) return text;
  const body = match[1].replace(/\s*$/, '');
  const updated = `import {${body}\n  ${symbol},\n} from '../../core/src';`;
  return text.replace(importPattern, updated);
}

function nextGeneratedKey(prefix, property, counters) {
  const keyPrefix = property === 'placeHolderText' ? 'Placeholder' : toPascalCase(property);
  counters[property] += 1;
  return `${prefix}_${keyPrefix}_${String(counters[property]).padStart(4, '0')}`;
}

function toPascalCase(value) {
  return value
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('');
}

function runtimeTextReplacement(key, fallback) {
  return runtimeStatementReplacement(key, `textContent = '${fallback}';`, `textContent = getLocalizedString(this.host, '${key}', '${fallback}');`, fallback);
}

function runtimeLiteralReplacement(key, find, replace, value, values = { [key]: value }) {
  return { key, find, replace, value, values };
}

function runtimeStatementReplacement(key, find, replace, value) {
  return { key, find, replace, value, values: { [key]: value } };
}

function collectExistingSettingsResources(text, resources) {
  const classFieldPattern = /(?:displayName|description|placeholder)\s*=\s*['"](.*?)['"];\s*(?:\r?\n\s*)(displayNameKey|descriptionKey|placeholderKey)\s*=\s*['"](.*?)['"]/g;
  for (const match of text.matchAll(classFieldPattern)) {
    resources[match[3]] = match[1];
  }

  const objectPattern = /(?:displayName|description|placeholder)\s*:\s*['"](.*?)['"]\s*,\s*(displayNameKey|descriptionKey|placeholderKey)\s*:\s*['"](.*?)['"]/g;
  for (const match of text.matchAll(objectPattern)) {
    resources[match[3]] = match[1];
  }
}

function seedSettingsCounters(resources, keyPrefix, counters) {
  const keyPattern = new RegExp(
    `^${escapeRegExp(keyPrefix)}_(DisplayName|Description|Placeholder)_(\\d+)$`,
  );

  for (const key of Object.keys(resources)) {
    const match = keyPattern.exec(key);
    if (!match) continue;
    const property = match[1] === 'DisplayName'
      ? 'displayName'
      : match[1] === 'Description'
        ? 'description'
        : 'placeholder';
    counters[property] = Math.max(counters[property], Number(match[2]));
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
