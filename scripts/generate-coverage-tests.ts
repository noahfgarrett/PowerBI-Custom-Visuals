/**
 * Generates formatting-coverage.test.ts for all visual packages.
 * Run with: npx tsx scripts/generate-coverage-tests.ts
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, basename } from 'path';
import { readdirSync } from 'fs';

const PACKAGES_DIR = join(__dirname, '..', 'packages');

// DataView factories per package, extracted from existing visual.test.ts
const DATA_FACTORIES: Record<string, string> = {
  'animated-donut-pro': `DataViewBuilder.singleCategoryMeasure(['A','B','C'], [10,20,30], { categoryRole: 'category', valueRole: 'measure' })`,
  'animated-waterfall': `new DataViewBuilder().withCategory('Category', ['A','B','C'], 'category').withValues('Value', [10, -5, 15], 'measure').build()`,
  'bar-race': `new DataViewBuilder().withCategory('Item', ['A','B','C'], 'category').withCategory('Time', ['2020','2020','2020'], 'timeAxis').withValues('Value', [10,20,30], 'measure').build()`,
  'box-plot': `DataViewBuilder.singleCategoryMeasure(['A','B','C'], [10,20,30], { categoryRole: 'category', valueRole: 'values' })`,
  'bullet-chart-pro': `new DataViewBuilder().withCategory('Category', ['Sales','Profit'], 'category').withValues('Measure', [80, 60], 'measure').withValues('Target', [100, 75], 'target').build()`,
  'bump-chart': `new DataViewBuilder().withCategory('Item', ['A','B'], 'item').withCategory('Time', ['T1','T2'], 'timeAxis').withValues('Rank', [1,2], 'measure').build()`,
  'chord-diagram': `DataViewBuilder.relational([{source:'A',target:'B',weight:10},{source:'B',target:'C',weight:20},{source:'A',target:'C',weight:15}])`,
  'dumbbell-chart': `new DataViewBuilder().withCategory('Category', ['A','B','C'], 'category').withValues('Start', [10,20,30], 'startValue').withValues('End', [30,40,50], 'endValue').build()`,
  'funnel-pro': `DataViewBuilder.singleCategoryMeasure(['Step1','Step2','Step3'], [100,60,30], { categoryRole: 'category', valueRole: 'measure' })`,
  'gantt-chart-pro': `new DataViewBuilder().withCategory('Task', ['Task A','Task B'], 'taskName').withValues('Start', [1,3], 'startDate').withValues('End', [3,6], 'endDate').build()`,
  'gauge-cluster': `new DataViewBuilder().withCategory('Gauge', ['G1','G2'], 'category').withValues('Value', [75,45], 'measure').withValues('Target', [100,80], 'target').build()`,
  'health-bar': `new DataViewBuilder().withCategory('Item', ['A','B'], 'category').withValues('Value', [80,60], 'measure').withValues('Target', [100,100], 'target').build()`,
  'heatmap-calendar': `new DataViewBuilder().withCategory('Date', ['2024-01-01','2024-01-02','2024-01-03'], 'date').withValues('Count', [5,10,3], 'measure').build()`,
  'morphing-area-chart': `DataViewBuilder.singleCategoryMeasure(['Jan','Feb','Mar','Apr'], [10,25,15,30], { categoryRole: 'category', valueRole: 'measure' })`,
  'network-graph': `DataViewBuilder.relational([{source:'A',target:'B',weight:5},{source:'B',target:'C',weight:10}])`,
  'polar-chart': `DataViewBuilder.singleCategoryMeasure(['N','E','S','W'], [10,20,15,25], { categoryRole: 'category', valueRole: 'measure' })`,
  'progress-bar-stack': `new DataViewBuilder().withCategory('Item', ['A','B'], 'category').withValues('Value', [70,45], 'measure').withValues('Target', [100,100], 'target').build()`,
  'radar-chart': `DataViewBuilder.singleCategoryMeasure(['A','B','C','D','E'], [80,65,90,70,85], { categoryRole: 'category', valueRole: 'measure' })`,
  'radial-gauge': `DataViewBuilder.measuresOnly([{name:'Value',values:[75],role:'value'},{name:'Target',values:[100],role:'target'}])`,
  'ring-stack': `DataViewBuilder.measuresOnly([{name:'Ring1',values:[80],role:'measure'},{name:'Ring2',values:[60],role:'measure'},{name:'Ring3',values:[40],role:'measure'}])`,
  'scatter-bubble': `new DataViewBuilder().withCategory('Item', ['A','B','C'], 'category').withValues('X', [10,20,30], 'xValue').withValues('Y', [5,15,25], 'yValue').withValues('Size', [100,200,150], 'size').build()`,
  'slope-chart': `new DataViewBuilder().withCategory('Item', ['A','B','C'], 'category').withValues('Start', [10,20,30], 'startMeasure').withValues('End', [15,18,35], 'endMeasure').build()`,
  'status-indicator': `new DataViewBuilder().withCategory('Item', ['A','B','C'], 'category').withValues('Value', [80,50,20], 'measure').build()`,
  'stream-graph': `DataViewBuilder.singleCategoryMeasure(['A','B','C','D'], [10,20,15,25], { categoryRole: 'category', valueRole: 'measure' })`,
  'sunburst-chart': `new DataViewBuilder().withCategory('Level1', ['A','A','B'], 'level1').withCategory('Level2', ['X','Y','Z'], 'level2').withValues('Value', [10,20,30], 'measure').build()`,
  'timeline-milestone': `new DataViewBuilder().withCategory('Date', ['2024-01-01','2024-06-01','2024-12-01'], 'date').withCategory('Label', ['Start','Mid','End'], 'label').build()`,
  'treemap-pro': `new DataViewBuilder().withCategory('Group', ['A','A','B'], 'level1').withCategory('Item', ['X','Y','Z'], 'level2').withValues('Value', [100,200,150], 'measure').build()`,
  'waffle-chart': `DataViewBuilder.measuresOnly([{name:'Value',values:[75],role:'measure'}])`,
};

// Common expected phantoms that apply to almost every visual
const COMMON_PHANTOMS = [
  'animationSettings.duration',
  'animationSettings.staggerDelay',
  'accessibilityFormatting.enableKeyboardNav',
  'cardSettings.enableGlass',
  'cardSettings.backgroundColor',
  'cardSettings.backgroundOpacity',
  'cardSettings.borderRadius',
  'numberFormatting.displayUnits',
  'numberFormatting.decimalPlaces',
  'scrollFormatting.enableScroll',
  'scrollFormatting.minCategoryWidth',
];

// Skip already-created packages
const SKIP = new Set(['bar-chart-pro', 'sankey-diagram', 'kpi-card', 'core']);

function getVisualClassName(pkg: string): string | null {
  const visualPath = join(PACKAGES_DIR, pkg, 'src', 'visual.ts');
  if (!existsSync(visualPath)) return null;
  const content = readFileSync(visualPath, 'utf-8');
  const match = content.match(/export class (\w+Visual)\s+implements/);
  return match?.[1] ?? null;
}

function getSettingsClassName(pkg: string): string | null {
  const settingsPath = join(PACKAGES_DIR, pkg, 'src', 'settings.ts');
  if (!existsSync(settingsPath)) return null;
  const content = readFileSync(settingsPath, 'utf-8');
  const match = content.match(/export class (\w+Settings)\s+extends/);
  return match?.[1] ?? null;
}

function hasCard(pkg: string, cardName: string): boolean {
  const settingsPath = join(PACKAGES_DIR, pkg, 'src', 'settings.ts');
  if (!existsSync(settingsPath)) return false;
  const content = readFileSync(settingsPath, 'utf-8');
  return content.includes(`name = '${cardName}'`);
}

function getSharedCards(pkg: string): string[] {
  const settingsPath = join(PACKAGES_DIR, pkg, 'src', 'settings.ts');
  if (!existsSync(settingsPath)) return [];
  const content = readFileSync(settingsPath, 'utf-8');
  const cards: string[] = [];
  if (content.includes('TitleFormattingCard')) cards.push('titleFormatting');
  if (content.includes('LegendFormattingCard')) cards.push('legendFormatting');
  if (content.includes('DataLabelFormattingCard')) cards.push('dataLabelFormatting');
  if (content.includes('AxisFormattingCard')) cards.push('axisFormatting');
  if (content.includes('ScrollFormattingCard')) cards.push('scrollFormatting');
  if (content.includes('NumberFormattingCard')) cards.push('numberFormatting');
  if (content.includes('ReferenceLineFormattingCard')) cards.push('referenceLineFormatting');
  if (content.includes('TrendLineFormattingCard')) cards.push('trendLineFormatting');
  if (content.includes('ConditionalFormattingCard')) cards.push('conditionalFormatting');
  if (content.includes('AnnotationFormattingCard')) cards.push('annotationFormatting');
  if (content.includes('AccessibilityFormattingCard')) cards.push('accessibilityFormatting');
  if (content.includes('SeriesFormattingCard')) cards.push('seriesFormatting');
  if (content.includes('ColorThemeFormattingCard')) cards.push('colorThemeFormatting');
  if (content.includes('CrosshairFormattingCard')) cards.push('crosshairFormatting');
  if (content.includes('TargetFormattingCard')) cards.push('targetFormatting');
  if (content.includes('SortFormattingCard')) cards.push('sortFormatting');
  if (content.includes('LineStrokeFormattingCard')) cards.push('lineStrokeFormatting');
  return cards;
}

function buildDeps(pkg: string, sharedCards: string[]): string {
  const lines: string[] = [];
  lines.push('function makeDeps(): Record<string, Record<string, unknown>> {');
  lines.push('  const deps: Record<string, Record<string, unknown>> = {};');

  if (sharedCards.includes('titleFormatting')) {
    lines.push(`  deps['titleFormatting.showTitle'] = { 'titleFormatting.titleText': 'Test Title' };`);
    lines.push(`  for (const s of ['titleText','titleFontSize','titleFontColor','titleFontFamily','titleFontWeight','titleAlignment','subtitleText']) {`);
    lines.push(`    deps[\`titleFormatting.\${s}\`] = { 'titleFormatting.showTitle': true, 'titleFormatting.titleText': 'Test Title' };`);
    lines.push(`  }`);
    lines.push(`  for (const s of ['subtitleFontSize','subtitleFontColor','subtitleFontFamily','subtitleFontWeight']) {`);
    lines.push(`    deps[\`titleFormatting.\${s}\`] = { 'titleFormatting.showTitle': true, 'titleFormatting.titleText': 'Test', 'titleFormatting.subtitleText': 'Sub' };`);
    lines.push(`  }`);
  }

  if (sharedCards.includes('legendFormatting')) {
    lines.push(`  for (const s of ['legendPosition','legendFontSize','legendFontColor','legendFontWeight']) {`);
    lines.push(`    deps[\`legendFormatting.\${s}\`] = { 'legendFormatting.showLegend': true };`);
    lines.push(`  }`);
  }

  if (sharedCards.includes('dataLabelFormatting')) {
    lines.push(`  for (const s of ['dataLabelFontSize','dataLabelFontColor','dataLabelFontWeight','dataLabelFontFamily','dataLabelPosition']) {`);
    lines.push(`    deps[\`dataLabelFormatting.\${s}\`] = { 'dataLabelFormatting.showDataLabels': true };`);
    lines.push(`  }`);
  }

  if (sharedCards.includes('scrollFormatting')) {
    lines.push(`  deps['scrollFormatting.minCategoryWidth'] = { 'scrollFormatting.enableScroll': true };`);
  }

  if (sharedCards.includes('referenceLineFormatting')) {
    lines.push(`  deps['referenceLineFormatting.referenceLineType'] = { 'referenceLineFormatting.showReferenceLine': true };`);
    lines.push(`  for (const s of ['referenceLineValue','referenceLineColor','referenceLineWidth','referenceLineStyle','showReferenceLabel','referenceLabelText','showReferenceBand','referenceBandOpacity','referenceBandWidth','referenceLineAxis']) {`);
    lines.push(`    deps[\`referenceLineFormatting.\${s}\`] = { 'referenceLineFormatting.showReferenceLine': true, 'referenceLineFormatting.referenceLineType': { value: 'mean', displayName: 'Mean' } };`);
    lines.push(`  }`);
  }

  if (sharedCards.includes('trendLineFormatting')) {
    lines.push(`  deps['trendLineFormatting.trendLineType'] = { 'trendLineFormatting.showTrendLine': true };`);
    lines.push(`  for (const s of ['polynomialOrder','trendLineColor','trendLineWidth','showEquation','showR2','trendLineAxis']) {`);
    lines.push(`    deps[\`trendLineFormatting.\${s}\`] = { 'trendLineFormatting.showTrendLine': true, 'trendLineFormatting.trendLineType': { value: 'linear', displayName: 'Linear' } };`);
    lines.push(`  }`);
  }

  if (sharedCards.includes('conditionalFormatting')) {
    lines.push(`  deps['conditionalFormatting.enableConditional'] = {};`);
    lines.push(`  for (const s of ['conditionalDirection','threshold1','threshold2','conditionalColor1','conditionalColor2','conditionalColor3']) {`);
    lines.push(`    deps[\`conditionalFormatting.\${s}\`] = { 'conditionalFormatting.enableConditional': true };`);
    lines.push(`  }`);
  }

  if (sharedCards.includes('annotationFormatting')) {
    lines.push(`  deps['annotationFormatting.showAnnotations'] = { 'annotationFormatting.annotation1Category': 'A', 'annotationFormatting.annotation1Text': 'Note' };`);
    lines.push(`  for (const s of ['annotation1Category','annotation1Text','annotation1Position','annotationFontSize','annotationFontColor','annotationConnectorColor']) {`);
    lines.push(`    deps[\`annotationFormatting.\${s}\`] = { 'annotationFormatting.showAnnotations': true, 'annotationFormatting.annotation1Category': 'A', 'annotationFormatting.annotation1Text': 'Note' };`);
    lines.push(`  }`);
  }

  if (sharedCards.includes('axisFormatting')) {
    lines.push(`  for (const s of ['xAxisTitle','yAxisTitle','axisFontSize','axisFontColor','axisFontFamily','axisLabelFontWeight','yAxisMin','yAxisMax','showGridLines','gridLineColor','gridLineOpacity','gridLineStyle']) {`);
    lines.push(`    deps[\`axisFormatting.\${s}\`] = { 'axisFormatting.showXAxis': true, 'axisFormatting.showYAxis': true };`);
    lines.push(`  }`);
  }

  lines.push('  return deps;');
  lines.push('}');
  return lines.join('\n');
}

function buildExpectedPhantoms(pkg: string, sharedCards: string[]): string[] {
  const phantoms: string[] = [];

  // Animation
  if (hasCard(pkg, 'animationSettings')) {
    phantoms.push('animationSettings.duration');
    if (hasCardSlice(pkg, 'staggerDelay')) phantoms.push('animationSettings.staggerDelay');
  }

  // Card style
  phantoms.push('cardSettings.enableGlass', 'cardSettings.backgroundColor', 'cardSettings.backgroundOpacity', 'cardSettings.borderRadius');

  // Accessibility
  if (sharedCards.includes('accessibilityFormatting')) {
    phantoms.push('accessibilityFormatting.enableKeyboardNav');
  }

  // Number format
  if (sharedCards.includes('numberFormatting')) {
    phantoms.push('numberFormatting.displayUnits', 'numberFormatting.decimalPlaces');
  }

  // Scroll
  if (sharedCards.includes('scrollFormatting')) {
    phantoms.push('scrollFormatting.enableScroll', 'scrollFormatting.minCategoryWidth');
  }

  // Reference line (many sub-settings are data/mode dependent)
  if (sharedCards.includes('referenceLineFormatting')) {
    phantoms.push(
      'referenceLineFormatting.referenceLineValue',
      'referenceLineFormatting.referenceBandOpacity',
      'referenceLineFormatting.referenceBandWidth',
      'referenceLineFormatting.referenceLineAxis',
    );
  }

  // Trend line
  if (sharedCards.includes('trendLineFormatting')) {
    phantoms.push('trendLineFormatting.polynomialOrder', 'trendLineFormatting.trendLineAxis');
  }

  // Conditional formatting (data-dependent)
  if (sharedCards.includes('conditionalFormatting')) {
    phantoms.push('conditionalFormatting.threshold1', 'conditionalFormatting.conditionalColor1', 'conditionalFormatting.conditionalColor2');
  }

  return phantoms;
}

function hasCardSlice(pkg: string, sliceName: string): boolean {
  const settingsPath = join(PACKAGES_DIR, pkg, 'src', 'settings.ts');
  if (!existsSync(settingsPath)) return false;
  return readFileSync(settingsPath, 'utf-8').includes(`name: '${sliceName}'`);
}

function generateTest(pkg: string): string | null {
  const visualClass = getVisualClassName(pkg);
  const settingsClass = getSettingsClassName(pkg);
  const dataFactory = DATA_FACTORIES[pkg];

  if (!visualClass || !settingsClass || !dataFactory) return null;

  const sharedCards = getSharedCards(pkg);
  const deps = buildDeps(pkg, sharedCards);
  const expectedPhantoms = buildExpectedPhantoms(pkg, sharedCards);

  const skipCards: string[] = [];
  if (sharedCards.includes('seriesFormatting')) skipCards.push('seriesFormatting');

  return `/**
 * ${pkg} — Formatting settings coverage test.
 * Auto-generated by scripts/generate-coverage-tests.ts
 */
import { describe, it, expect, vi } from 'vitest';

const settingsRef: { current: unknown } = { current: undefined };

vi.mock('../../style/visual.less', () => ({}));

vi.mock('powerbi-visuals-utils-formattingmodel', () => {
  class SliceBase {
    constructor(init?: Record<string, unknown>) { if (init) Object.assign(this, init); }
  }
  return {
    formattingSettings: {
      Model: class { cards: unknown[] = []; },
      SimpleCard: class { slices: unknown[] = []; },
      CompositeCard: class { groups: unknown[] = []; },
      Group: class { slices: unknown[] = []; constructor(init?: Record<string, unknown>) { if (init) Object.assign(this, init); } },
      ToggleSwitch: SliceBase,
      NumUpDown: SliceBase,
      ColorPicker: SliceBase,
      TextInput: SliceBase,
      ItemDropdown: SliceBase,
      FontPicker: SliceBase,
      Slider: SliceBase,
      ReadOnlyText: SliceBase,
      AutoDropdown: SliceBase,
    },
    FormattingSettingsService: class {
      populateFormattingSettingsModel(ModelClass: new () => unknown, _dv: unknown) {
        if (settingsRef.current) {
          const ref = settingsRef.current;
          settingsRef.current = undefined;
          return ref;
        }
        return new ModelClass();
      }
      buildFormattingModel(settings: { cards: unknown[] }) { return { cards: settings.cards ?? [] }; }
    },
  };
});

import { ${visualClass} } from '../visual';
import { ${settingsClass} } from '../settings';
import {
  createConstructorOptions,
  DataViewBuilder,
  runFormattingCoverage,
  getSettingPaths,
  type HarnessConfig,
} from '../../../core/src/__test-utils__';

const testDV = ${dataFactory};

function createVisual() {
  const opts = createConstructorOptions();
  const settings = new ${settingsClass}();
  settingsRef.current = settings;
  const visual = new ${visualClass}(opts as never);
  return {
    visual,
    settings: settings as unknown as Record<string, unknown> & { cards: Array<Record<string, unknown>> },
    element: opts.element,
  };
}

${deps}

const harnessConfig: HarnessConfig = {
  createVisual,
  dataView: testDV,
  deps: makeDeps(),
  skipCards: ${JSON.stringify(skipCards)},
  expectedPhantoms: ${JSON.stringify(expectedPhantoms, null, 4)},
};

describe('${pkg} formatting coverage', () => {
  it('detects settings from the model', () => {
    const settings = new ${settingsClass}();
    const paths = getSettingPaths(
      settings as unknown as { cards: Array<Record<string, unknown>> },
      harnessConfig.skipCards,
    );
    expect(paths.length).toBeGreaterThan(0);
  });

  it('every setting affects DOM output', () => {
    const results = runFormattingCoverage(harnessConfig);

    const expectedSet = new Set(harnessConfig.expectedPhantoms ?? []);
    const phantoms = results.filter((r) => r.isPhantom);
    const unexpectedPhantoms = phantoms.filter(
      (p) => !expectedSet.has(\`\${p.cardName}.\${p.sliceName}\`),
    );
    const passed = results.filter((r) => !r.isPhantom);

    console.log(\`\\n  Settings tested: \${results.length}\`);
    console.log(\`  DOM-affecting:   \${passed.length}\`);
    console.log(\`  Phantom:         \${phantoms.length} (\${phantoms.length - unexpectedPhantoms.length} expected)\`);

    if (unexpectedPhantoms.length > 0) {
      console.log('\\n  UNEXPECTED PHANTOM SETTINGS:');
      for (const p of unexpectedPhantoms) {
        console.log(\`    - \${p.cardDisplayName} > \${p.sliceName} (\${p.sliceType})\`);
      }
    }

    expect(unexpectedPhantoms.map((p) => \`\${p.cardName}.\${p.sliceName}\`)).toEqual([]);
  });
});
`;
}

// Main
const packages = readdirSync(PACKAGES_DIR).filter((d) => !SKIP.has(d));
let generated = 0;

for (const pkg of packages) {
  const visualPath = join(PACKAGES_DIR, pkg, 'src', 'visual.ts');
  if (!existsSync(visualPath)) continue;

  const test = generateTest(pkg);
  if (!test) {
    console.log(`SKIP ${pkg}: missing data factory or class names`);
    continue;
  }

  const testDir = join(PACKAGES_DIR, pkg, 'src', '__tests__');
  if (!existsSync(testDir)) mkdirSync(testDir, { recursive: true });

  const testPath = join(testDir, 'formatting-coverage.test.ts');
  writeFileSync(testPath, test);
  console.log(`WROTE ${pkg}`);
  generated++;
}

console.log(`\nGenerated ${generated} test files.`);
