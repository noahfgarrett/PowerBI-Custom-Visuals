/**
 * KPI Card — Formatting settings coverage test.
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

import { KpiCardVisual } from '../visual';
import { KpiCardSettings } from '../settings';
import {
  createConstructorOptions,
  DataViewBuilder,
  runFormattingCoverage,
  getSettingPaths,
  type HarnessConfig,
} from '../../../core/src/__test-utils__';

// ── Test data ────────────────────────────────────────────────────────

// KPI card uses table dataView format (not categorical)
const kpiDV = {
  metadata: {
    columns: [
      { displayName: 'Revenue', queryName: 'Revenue.Revenue', roles: { measure: true }, type: { numeric: true } },
      { displayName: 'Target', queryName: 'Target.Target', roles: { target: true }, type: { numeric: true } },
    ],
  },
  table: {
    columns: [
      { displayName: 'Revenue', queryName: 'Revenue.Revenue', roles: { measure: true } },
      { displayName: 'Target', queryName: 'Target.Target', roles: { target: true } },
    ],
    rows: [
      [100, 130],
      [120, 130],
      [110, 130],
      [150, 130],
    ],
  },
};

// ── Factory ─────────────────────────────────────────────────────────

function createVisual() {
  const opts = createConstructorOptions();
  const settings = new KpiCardSettings();
  settingsRef.current = settings;
  const visual = new KpiCardVisual(opts as never);
  return {
    visual,
    settings: settings as unknown as Record<string, unknown> & { cards: Array<Record<string, unknown>> },
    element: opts.element,
  };
}

// ── Dependency map ──────────────────────────────────────────────────

const TITLE_ON = { 'titleFormatting.showTitle': true, 'titleFormatting.titleText': 'KPI Title' };
const SUBTITLE_ON = { ...TITLE_ON, 'titleFormatting.subtitleText': 'Subtitle' };
const COND_ON = { 'conditionalFormatting.enableConditional': true };
const COMPARISON_ON = { 'kpiComparisonSettings.show': true };
const GOAL_ON = { 'kpiGoalSettings.show': true };
const TREND_ON = { 'trendSettings.show': true };
const SPARKLINE_ON = { 'sparklineSettings.show': true };
const LABEL_ON = { 'labelSettings.show': true };

function makeDeps(): Record<string, Record<string, unknown>> {
  const deps: Record<string, Record<string, unknown>> = {};

  // Label sub-settings
  for (const s of ['fontSize', 'fontColor', 'fontFamily', 'fontWeight', 'text']) {
    deps[`labelSettings.${s}`] = LABEL_ON;
  }

  // Trend sub-settings
  for (const s of ['fontSize', 'positiveColor', 'negativeColor', 'neutralColor']) {
    deps[`trendSettings.${s}`] = TREND_ON;
  }

  // Sparkline sub-settings
  for (const s of ['lineColor', 'fillOpacity', 'sparklineColor', 'sparklineWidth', 'dividerColor']) {
    deps[`sparklineSettings.${s}`] = SPARKLINE_ON;
  }

  // Comparison sub-settings
  for (const s of ['showPercentChange', 'fontSize', 'fontColor']) {
    deps[`kpiComparisonSettings.${s}`] = COMPARISON_ON;
  }

  // Goal sub-settings
  for (const s of ['goalValue', 'showProgressBar', 'metColor', 'unmetColor']) {
    deps[`kpiGoalSettings.${s}`] = GOAL_ON;
  }

  // Title
  deps['titleFormatting.showTitle'] = { 'titleFormatting.titleText': 'KPI Title' };
  for (const s of ['titleText', 'titleFontSize', 'titleFontColor', 'titleFontFamily', 'titleFontWeight', 'titleAlignment', 'subtitleText']) {
    deps[`titleFormatting.${s}`] = TITLE_ON;
  }
  for (const s of ['subtitleFontSize', 'subtitleFontColor', 'subtitleFontFamily', 'subtitleFontWeight']) {
    deps[`titleFormatting.${s}`] = SUBTITLE_ON;
  }

  // Conditional
  deps['conditionalFormatting.enableConditional'] = {};
  for (const s of ['conditionalDirection', 'threshold1', 'threshold2', 'conditionalColor1', 'conditionalColor2', 'conditionalColor3']) {
    deps[`conditionalFormatting.${s}`] = COND_ON;
  }

  // Card style
  deps['cardSettings.backgroundOpacity'] = { 'cardSettings.enableGlass': true };

  return deps;
}

// ── Config ──────────────────────────────────────────────────────────

const harnessConfig: HarnessConfig = {
  createVisual,
  dataView: kpiDV,
  deps: makeDeps(),
  skipCards: [],
  expectedPhantoms: [
    'animationSettings.duration',
    'accessibilityFormatting.enableKeyboardNav',
    'cardSettings.enableGlass',
    'cardSettings.backgroundColor',
    'cardSettings.backgroundOpacity',
    'cardSettings.borderRadius',
    // Number format: affects formatted text but may not be distinguishable in DOM
    'numberFormatting.displayUnits',
    'numberFormatting.decimalPlaces',
    // Conditional thresholds may produce same color for test data
    'conditionalFormatting.threshold1',
    'conditionalFormatting.threshold2',
    'conditionalFormatting.conditionalColor1',
    'conditionalFormatting.conditionalColor2',
    // Trend: test data has positive delta (150>110), so negative/neutral colors unused
    'trendSettings.negativeColor',
    'trendSettings.neutralColor',
    // Goal: test data value 150 > goal 100, so unmetColor never applied
    'kpiGoalSettings.unmetColor',
  ],
};

// ── Tests ────────────────────────────────────────────────────────────

describe('KpiCard formatting coverage', () => {
  it('detects all settings from the model', () => {
    const settings = new KpiCardSettings();
    const paths = getSettingPaths(
      settings as unknown as { cards: Array<Record<string, unknown>> },
      harnessConfig.skipCards,
    );
    expect(paths.length).toBeGreaterThan(20);
  });

  it('every setting affects DOM output', () => {
    const results = runFormattingCoverage(harnessConfig);

    const expectedSet = new Set(harnessConfig.expectedPhantoms ?? []);
    const phantoms = results.filter((r) => r.isPhantom);
    const unexpectedPhantoms = phantoms.filter(
      (p) => !expectedSet.has(`${p.cardName}.${p.sliceName}`),
    );
    const passed = results.filter((r) => !r.isPhantom);

    console.log(`\n  Settings tested: ${results.length}`);
    console.log(`  DOM-affecting:   ${passed.length}`);
    console.log(`  Phantom:         ${phantoms.length} (${phantoms.length - unexpectedPhantoms.length} expected)`);

    if (unexpectedPhantoms.length > 0) {
      console.log('\n  UNEXPECTED PHANTOM SETTINGS:');
      for (const p of unexpectedPhantoms) {
        console.log(`    - ${p.cardDisplayName} > ${p.sliceName} (${p.sliceType})`);
      }
    }

    expect(unexpectedPhantoms.map((p) => `${p.cardName}.${p.sliceName}`)).toEqual([]);
  });
});
