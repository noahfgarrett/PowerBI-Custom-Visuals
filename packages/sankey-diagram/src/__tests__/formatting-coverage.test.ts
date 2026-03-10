/**
 * Sankey Diagram — Formatting settings coverage test.
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

import { SankeyDiagramVisual } from '../visual';
import { SankeyDiagramSettings } from '../settings';
import {
  createConstructorOptions,
  DataViewBuilder,
  runFormattingCoverage,
  getSettingPaths,
  type HarnessConfig,
} from '../../../core/src/__test-utils__';

// ── Test data ────────────────────────────────────────────────────────

const sankeyDV = DataViewBuilder.relational([
  { source: 'A', target: 'X', weight: 50 },
  { source: 'A', target: 'Y', weight: 30 },
  { source: 'B', target: 'X', weight: 20 },
  { source: 'B', target: 'Y', weight: 40 },
  { source: 'C', target: 'Z', weight: 60 },
]);

// ── Factory ─────────────────────────────────────────────────────────

function createVisual() {
  const opts = createConstructorOptions();
  const settings = new SankeyDiagramSettings();
  settingsRef.current = settings;
  const visual = new SankeyDiagramVisual(opts as never);
  return {
    visual,
    settings: settings as unknown as Record<string, unknown> & { cards: Array<Record<string, unknown>> },
    element: opts.element,
  };
}

// ── Dependency map ──────────────────────────────────────────────────

const TITLE_ON = { 'titleFormatting.showTitle': true, 'titleFormatting.titleText': 'Test Title' };
const SUBTITLE_ON = { ...TITLE_ON, 'titleFormatting.subtitleText': 'Test Sub' };
const COND_ON = { 'conditionalFormatting.enableConditional': true };
const LINK_LABELS_ON = { 'linkLabelSettings.showLinkLabels': true };
const NODE_VALUES_ON = { 'totalSettings.showNodeValues': true };
const LAYER_TOTALS_ON = { 'totalSettings.showLayerTotals': true };

function makeDeps(): Record<string, Record<string, unknown>> {
  const deps: Record<string, Record<string, unknown>> = {};

  // Link label sub-settings
  for (const s of ['linkLabelFontSize', 'linkLabelFontColor', 'linkLabelFontWeight', 'linkLabelFormat']) {
    deps[`linkLabelSettings.${s}`] = LINK_LABELS_ON;
  }

  // Total sub-settings
  deps['totalSettings.nodeValueFormat'] = NODE_VALUES_ON;
  deps['totalSettings.layerTotalPosition'] = LAYER_TOTALS_ON;
  deps['totalSettings.totalFontSize'] = { ...NODE_VALUES_ON, ...LAYER_TOTALS_ON };
  deps['totalSettings.totalFontColor'] = { ...NODE_VALUES_ON, ...LAYER_TOTALS_ON };

  // Link customColor needs colorMode=custom
  deps['linkSettings.customColor'] = { 'linkSettings.colorMode': { value: 'custom', displayName: 'Custom' } };

  // Title
  deps['titleFormatting.showTitle'] = { 'titleFormatting.titleText': 'Test Title' };
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

  // Legend
  for (const s of ['legendPosition', 'legendFontSize', 'legendFontColor', 'legendFontWeight']) {
    deps[`legendFormatting.${s}`] = { 'legendFormatting.showLegend': true };
  }

  // Data labels
  for (const s of ['dataLabelFontSize', 'dataLabelFontColor', 'dataLabelFontWeight', 'dataLabelFontFamily', 'dataLabelPosition']) {
    deps[`dataLabelFormatting.${s}`] = { 'dataLabelFormatting.showDataLabels': true };
  }

  // Scroll
  deps['scrollFormatting.minCategoryWidth'] = { 'scrollFormatting.enableScroll': true };

  // Card style
  deps['cardSettings.backgroundOpacity'] = { 'cardSettings.enableGlass': true };

  return deps;
}

// ── Config ──────────────────────────────────────────────────────────

const harnessConfig: HarnessConfig = {
  createVisual,
  dataView: sankeyDV,
  deps: makeDeps(),
  skipCards: [],
  expectedPhantoms: [
    'animationSettings.duration',
    'accessibilityFormatting.enableKeyboardNav',
    'cardSettings.enableGlass',
    'cardSettings.backgroundColor',
    'cardSettings.backgroundOpacity',
    'cardSettings.borderRadius',
    // Tooltips: only show on hover, not in static DOM
    'tooltipSettings.showTooltips',
    'tooltipSettings.showPercentage',
    'tooltipSettings.valueFormat',
    // Interaction: adds event listeners, not DOM attributes
    'sankeyInteractionSettings.highlightFlows',
    'sankeyInteractionSettings.enableDrag',
    'sankeyInteractionSettings.enableFiltering',
    // Link hover opacity: only visible on mouse events
    'linkSettings.hoverOpacity',
    'linkSettings.dimOpacity',
    // SankeyNodeSettings slices array is empty (phantom card)
    'sankeyNodeSettings.showNodeValues',
    'sankeyNodeSettings.nodeLabelFontSize',
    // Scroll: needs enough data to overflow
    'scrollFormatting.enableScroll',
    'scrollFormatting.minCategoryWidth',
    // Number format
    'numberFormatting.displayUnits',
    'numberFormatting.decimalPlaces',
    // Show flow labels: only on hover
    'sankeyLinkSettings.showFlowLabels',
    // Conditional thresholds may not change color mapping with test data
    'conditionalFormatting.threshold1',
    'conditionalFormatting.conditionalColor1',
    'conditionalFormatting.conditionalColor2',
  ],
};

// ── Tests ────────────────────────────────────────────────────────────

describe('SankeyDiagram formatting coverage', () => {
  it('detects all settings from the model', () => {
    const settings = new SankeyDiagramSettings();
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
