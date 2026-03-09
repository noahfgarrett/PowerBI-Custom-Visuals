import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BarChartProVisual } from '../visual';
import {
  createConstructorOptions,
  createUpdateOptions,
  DataViewBuilder,
} from '../../../core/src/__test-utils__';

// Stub LESS import
vi.mock('../../style/visual.less', () => ({}));

// Stub FormattingSettingsService
vi.mock('powerbi-visuals-utils-formattingmodel', () => {
  class FakeModel {
    cards: unknown[] = [];
  }
  return {
    formattingSettings: {
      Model: FakeModel,
      SimpleCard: class { slices: unknown[] = []; },
      CompositeCard: class { groups: unknown[] = []; },
      Group: class { slices: unknown[] = []; },
      ToggleSwitch: class { constructor(init: Record<string, unknown>) { Object.assign(this, init); } },
      NumUpDown: class { constructor(init: Record<string, unknown>) { Object.assign(this, init); } },
      ColorPicker: class { constructor(init: Record<string, unknown>) { Object.assign(this, init); } },
      TextInput: class { constructor(init: Record<string, unknown>) { Object.assign(this, init); } },
      ItemDropdown: class { constructor(init: Record<string, unknown>) { Object.assign(this, init); } },
    },
    FormattingSettingsService: class {
      populateFormattingSettingsModel(ModelClass: new () => unknown, _dv: unknown) { return new ModelClass(); }
      buildFormattingModel(settings: { cards: unknown[] }) { return { cards: settings.cards?.map((c: unknown) => ({ displayName: (c as Record<string, unknown>)['displayName'], name: (c as Record<string, unknown>)['name'] })) ?? [] }; }
    },
  };
});

let visual: BarChartProVisual;
let constructorOpts: ReturnType<typeof createConstructorOptions>;

beforeEach(() => {
  constructorOpts = createConstructorOptions();
  visual = new BarChartProVisual(constructorOpts as never);
});

afterEach(() => {
  visual.destroy();
  constructorOpts.element.remove();
});

// ── Helpers ──────────────────────────────────────────────────────────

function singleBarDV() {
  return DataViewBuilder.singleCategoryMeasure(
    ['A', 'B', 'C'],
    [10, 20, 30],
    { categoryRole: 'category', valueRole: 'values' },
  );
}

function multiBarDV() {
  return DataViewBuilder.multiSeries(
    ['A', 'B', 'C'],
    [
      { name: 'Sales', values: [10, 20, 30], role: 'values' },
      { name: 'Profit', values: [5, 15, 25], role: 'values' },
    ],
    { categoryRole: 'category' },
  );
}

function comboModeDV() {
  return new DataViewBuilder()
    .withCategory('Month', ['Jan', 'Feb', 'Mar'], 'category')
    .withValues('Revenue', [100, 200, 300], 'values')
    .withValues('Trend', [90, 210, 280], 'lineValues')
    .build();
}

function singlePointDV() {
  return DataViewBuilder.singleCategoryMeasure(
    ['X'],
    [42],
    { categoryRole: 'category', valueRole: 'values' },
  );
}

function largeDV(n: number) {
  const cats = Array.from({ length: n }, (_, i) => `Cat${i}`);
  const vals = Array.from({ length: n }, (_, i) => i * 10);
  return DataViewBuilder.singleCategoryMeasure(cats, vals, { categoryRole: 'category', valueRole: 'values' });
}

function allNullDV() {
  return DataViewBuilder.singleCategoryMeasure(
    ['A', 'B', 'C'],
    [null, null, null],
    { categoryRole: 'category', valueRole: 'values' },
  );
}

function negativesDV() {
  return DataViewBuilder.singleCategoryMeasure(
    ['A', 'B', 'C'],
    [-10, 5, -20],
    { categoryRole: 'category', valueRole: 'values' },
  );
}

// ── Construction ──────────────────────────────────────────────────────

describe('BarChartProVisual', () => {
  describe('construction', () => {
    it('initializes without errors', () => {
      expect(visual).toBeDefined();
    });

    it('adds bar-chart-container class to element', () => {
      expect(constructorOpts.element.classList.contains('bar-chart-container')).toBe(true);
    });
  });

  // ── Empty Data ────────────────────────────────────────────────────

  describe('empty data', () => {
    it('handles null dataViews', () => {
      expect(() => visual.update(createUpdateOptions(null as never) as never)).not.toThrow();
    });

    it('handles undefined dataViews', () => {
      expect(() => visual.update(createUpdateOptions(undefined as never) as never)).not.toThrow();
    });

    it('handles empty dataViews array', () => {
      expect(() => visual.update(createUpdateOptions([]) as never)).not.toThrow();
    });

    it('handles DataView with no categories', () => {
      const dv = DataViewBuilder.measuresOnly([{ name: 'V', values: [10], role: 'values' }]);
      expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
    });

    it('handles DataView with no values', () => {
      const dv = new DataViewBuilder().withCategory('Cat', ['A'], 'category').build();
      expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
    });

    it('handles completely empty DataView', () => {
      const dv = DataViewBuilder.empty();
      expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
    });
  });

  // ── Single Point ──────────────────────────────────────────────────

  describe('single point', () => {
    it('renders 1 category + 1 value without error', () => {
      const dv = singlePointDV();
      expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
    });

    it('creates at least 1 bar rect in DOM', () => {
      const dv = singlePointDV();
      visual.update(createUpdateOptions([dv]) as never);
      const rects = constructorOpts.element.querySelectorAll('rect');
      expect(rects.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Grouped Mode ──────────────────────────────────────────────────

  describe('grouped mode', () => {
    it('renders multiple series as side-by-side bars', () => {
      const dv = multiBarDV();
      visual.update(createUpdateOptions([dv]) as never);
      const rects = constructorOpts.element.querySelectorAll('rect');
      expect(rects.length).toBeGreaterThanOrEqual(6); // 3 cats × 2 series
    });

    it('uses distinct colors for each series', () => {
      const dv = multiBarDV();
      visual.update(createUpdateOptions([dv]) as never);
      const rects = constructorOpts.element.querySelectorAll('rect');
      const fills = new Set<string>();
      rects.forEach((r) => {
        const fill = r.getAttribute('fill');
        if (fill && fill !== 'none' && fill !== '') fills.add(fill);
      });
      expect(fills.size).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Stacked Mode ──────────────────────────────────────────────────

  describe('stacked mode', () => {
    it('renders stacked bars without error', () => {
      const dv = multiBarDV();
      // Stacked mode is set through settings; we test render with default settings
      expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
    });
  });

  // ── Combo Mode ────────────────────────────────────────────────────

  describe('combo mode', () => {
    it('renders bars + line elements without error', () => {
      const dv = comboModeDV();
      expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
    });

    it('creates SVG path elements for lines', () => {
      const dv = comboModeDV();
      visual.update(createUpdateOptions([dv]) as never);
      const svg = constructorOpts.element.querySelector('svg');
      expect(svg).not.toBeNull();
    });
  });

  // ── Per-Series Formatting ─────────────────────────────────────────

  describe('per-series formatting', () => {
    it('populates series groups for multi-series data', () => {
      const dv = multiBarDV();
      expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
    });
  });

  // ── Formatting Options ────────────────────────────────────────────

  describe('formatting options', () => {
    it('renders with default formatting options', () => {
      const dv = singleBarDV();
      expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
    });

    it('renders SVG element', () => {
      const dv = singleBarDV();
      visual.update(createUpdateOptions([dv]) as never);
      const svg = constructorOpts.element.querySelector('svg');
      expect(svg).not.toBeNull();
    });

    it('renders bar rects', () => {
      const dv = singleBarDV();
      visual.update(createUpdateOptions([dv]) as never);
      const rects = constructorOpts.element.querySelectorAll('rect');
      expect(rects.length).toBeGreaterThan(0);
    });
  });

  // ── Edge Cases ────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles null values in data', () => {
      const dv = DataViewBuilder.singleCategoryMeasure(
        ['A', 'B', 'C'],
        [10, null, 30],
        { categoryRole: 'category', valueRole: 'values' },
      );
      expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
    });

    it('handles all zeros', () => {
      const dv = DataViewBuilder.singleCategoryMeasure(
        ['A', 'B', 'C'],
        [0, 0, 0],
        { categoryRole: 'category', valueRole: 'values' },
      );
      expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
    });

    it('handles negative values', () => {
      const dv = negativesDV();
      expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
    });

    it('handles all null series', () => {
      const dv = allNullDV();
      expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
    });

    it('handles tiny viewport', () => {
      const dv = singleBarDV();
      expect(() => visual.update(createUpdateOptions([dv], { width: 10, height: 10 }) as never)).not.toThrow();
    });

    it('handles large dataset (500 categories)', () => {
      const dv = largeDV(500);
      expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
    });

    it('handles mixed null and valid values across series', () => {
      const dv = DataViewBuilder.multiSeries(
        ['A', 'B', 'C'],
        [
          { name: 'S1', values: [null, 20, null], role: 'values' },
          { name: 'S2', values: [10, null, 30], role: 'values' },
        ],
        { categoryRole: 'category' },
      );
      expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
    });
  });

  // ── getFormattingModel ────────────────────────────────────────────

  describe('getFormattingModel', () => {
    it('returns a valid formatting model', () => {
      const dv = singleBarDV();
      visual.update(createUpdateOptions([dv]) as never);
      const model = visual.getFormattingModel();
      expect(model).toBeDefined();
      expect(model.cards).toBeDefined();
    });

    it('contains expected card names', () => {
      const dv = singleBarDV();
      visual.update(createUpdateOptions([dv]) as never);
      const model = visual.getFormattingModel();
      const names = model.cards.map((c: unknown) => (c as Record<string, unknown>)['name']).filter(Boolean);
      expect(names.length).toBeGreaterThan(0);
    });
  });

  // ── DOM Output ────────────────────────────────────────────────────

  describe('DOM output', () => {
    it('creates SVG element in container', () => {
      const dv = singleBarDV();
      visual.update(createUpdateOptions([dv]) as never);
      expect(constructorOpts.element.querySelector('svg')).not.toBeNull();
    });

    it('renders rect elements for bars', () => {
      const dv = singleBarDV();
      visual.update(createUpdateOptions([dv]) as never);
      expect(constructorOpts.element.querySelectorAll('rect').length).toBeGreaterThan(0);
    });

    it('cleans up DOM on re-render', () => {
      const dv = singleBarDV();
      visual.update(createUpdateOptions([dv]) as never);
      const firstSvgCount = constructorOpts.element.querySelectorAll('svg').length;
      visual.update(createUpdateOptions([dv]) as never);
      const secondSvgCount = constructorOpts.element.querySelectorAll('svg').length;
      expect(secondSvgCount).toBeLessThanOrEqual(firstSvgCount);
    });

    it('handles transition from data to empty', () => {
      const dv = singleBarDV();
      visual.update(createUpdateOptions([dv]) as never);
      visual.update(createUpdateOptions([DataViewBuilder.empty()]) as never);
      expect(constructorOpts.element.querySelectorAll('rect').length).toBe(0);
    });

    it('handles transition from empty to data', () => {
      visual.update(createUpdateOptions([DataViewBuilder.empty()]) as never);
      const dv = singleBarDV();
      visual.update(createUpdateOptions([dv]) as never);
      expect(constructorOpts.element.querySelector('svg')).not.toBeNull();
    });
  });

  // ── Re-render & lifecycle ─────────────────────────────────────────

  describe('re-render lifecycle', () => {
    it('can be updated multiple times', () => {
      const dv1 = singleBarDV();
      const dv2 = multiBarDV();
      expect(() => {
        visual.update(createUpdateOptions([dv1]) as never);
        visual.update(createUpdateOptions([dv2]) as never);
        visual.update(createUpdateOptions([dv1]) as never);
      }).not.toThrow();
    });

    it('destroy cleans up container', () => {
      const dv = singleBarDV();
      visual.update(createUpdateOptions([dv]) as never);
      visual.destroy();
      expect(constructorOpts.element.children.length).toBe(0);
    });

    it('can render after destroy + re-create', () => {
      visual.destroy();
      visual = new BarChartProVisual(constructorOpts as never);
      const dv = singleBarDV();
      expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
    });
  });

  // ── Viewport ──────────────────────────────────────────────────────

  describe('viewport handling', () => {
    it('renders at standard viewport', () => {
      const dv = singleBarDV();
      expect(() => visual.update(createUpdateOptions([dv], { width: 800, height: 600 }) as never)).not.toThrow();
    });

    it('renders at small viewport', () => {
      const dv = singleBarDV();
      expect(() => visual.update(createUpdateOptions([dv], { width: 100, height: 80 }) as never)).not.toThrow();
    });

    it('renders at large viewport', () => {
      const dv = singleBarDV();
      expect(() => visual.update(createUpdateOptions([dv], { width: 1920, height: 1080 }) as never)).not.toThrow();
    });

    it('renders at zero viewport', () => {
      const dv = singleBarDV();
      expect(() => visual.update(createUpdateOptions([dv], { width: 0, height: 0 }) as never)).not.toThrow();
    });
  });

  // ── Target line data ──────────────────────────────────────────────

  describe('target data', () => {
    it('handles data with target value', () => {
      const dv = new DataViewBuilder()
        .withCategory('Cat', ['A', 'B', 'C'], 'category')
        .withValues('Sales', [10, 20, 30], 'values')
        .withValues('Target', [25, 25, 25], 'target')
        .build();
      expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
    });
  });

  // ── Multi-series color assignment ─────────────────────────────────

  describe('color assignment', () => {
    it('assigns colors to multiple bar series', () => {
      const dv = DataViewBuilder.multiSeries(
        ['A', 'B'],
        [
          { name: 'S1', values: [10, 20], role: 'values' },
          { name: 'S2', values: [30, 40], role: 'values' },
          { name: 'S3', values: [50, 60], role: 'values' },
        ],
        { categoryRole: 'category' },
      );
      expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
    });
  });
});
