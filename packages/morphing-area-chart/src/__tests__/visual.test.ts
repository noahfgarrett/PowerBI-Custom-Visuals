import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MorphingAreaChartVisual } from '../visual';
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

let visual: MorphingAreaChartVisual;
let constructorOpts: ReturnType<typeof createConstructorOptions>;

beforeEach(() => {
  constructorOpts = createConstructorOptions();
  visual = new MorphingAreaChartVisual(constructorOpts as never);
});

afterEach(() => {
  visual.destroy();
  constructorOpts.element.remove();
});

// ── Helpers ──────────────────────────────────────────────────────────

function singleSeriesDV() {
  return DataViewBuilder.singleCategoryMeasure(
    ['Jan', 'Feb', 'Mar', 'Apr'],
    [10, 25, 15, 30],
    { categoryRole: 'category', valueRole: 'measure' },
  );
}

function multiSeriesDV() {
  return DataViewBuilder.multiSeries(
    ['Jan', 'Feb', 'Mar'],
    [
      { name: 'Revenue', values: [100, 200, 300], role: 'measure' },
      { name: 'Cost', values: [80, 150, 250], role: 'measure' },
    ],
    { categoryRole: 'category' },
  );
}

function singlePointDV() {
  return DataViewBuilder.singleCategoryMeasure(
    ['X'],
    [42],
    { categoryRole: 'category', valueRole: 'measure' },
  );
}

function nullGapsDV() {
  return DataViewBuilder.singleCategoryMeasure(
    ['A', 'B', 'C', 'D', 'E'],
    [10, null, 30, null, 50],
    { categoryRole: 'category', valueRole: 'measure' },
  );
}

// ── Construction ──────────────────────────────────────────────────────

describe('MorphingAreaChartVisual', () => {
  describe('construction', () => {
    it('initializes without errors', () => {
      expect(visual).toBeDefined();
    });

    it('adds area-chart-container class to element', () => {
      expect(constructorOpts.element.classList.contains('area-chart-container')).toBe(true);
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

    it('handles empty DataView', () => {
      const dv = DataViewBuilder.empty();
      expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
    });

    it('handles DataView with no values', () => {
      const dv = new DataViewBuilder().withCategory('Cat', ['A'], 'category').build();
      expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
    });

    it('shows empty message for empty data', () => {
      const dv = DataViewBuilder.empty();
      visual.update(createUpdateOptions([dv]) as never);
      const emptyEl = constructorOpts.element.querySelector('.area-chart-empty');
      expect(emptyEl).not.toBeNull();
    });
  });

  // ── Single Series ────────────────────────────────────────────────

  describe('single series', () => {
    it('renders without error', () => {
      const dv = singleSeriesDV();
      expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
    });

    it('creates SVG element', () => {
      const dv = singleSeriesDV();
      visual.update(createUpdateOptions([dv]) as never);
      expect(constructorOpts.element.querySelector('svg')).not.toBeNull();
    });

    it('creates path elements for line/area', () => {
      const dv = singleSeriesDV();
      visual.update(createUpdateOptions([dv]) as never);
      const paths = constructorOpts.element.querySelectorAll('path');
      expect(paths.length).toBeGreaterThan(0);
    });
  });

  // ── Multi-Series ──────────────────────────────────────────────────

  describe('multi-series', () => {
    it('renders multiple series without error', () => {
      const dv = multiSeriesDV();
      expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
    });

    it('creates multiple path elements', () => {
      const dv = multiSeriesDV();
      visual.update(createUpdateOptions([dv]) as never);
      const paths = constructorOpts.element.querySelectorAll('path');
      expect(paths.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── Per-Series Formatting ─────────────────────────────────────────

  describe('per-series formatting', () => {
    it('populates series groups for multi-series data', () => {
      const dv = multiSeriesDV();
      expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
    });
  });

  // ── Edge Cases ────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles null values (gaps)', () => {
      const dv = nullGapsDV();
      expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
    });

    it('handles all zeros', () => {
      const dv = DataViewBuilder.singleCategoryMeasure(
        ['A', 'B', 'C'],
        [0, 0, 0],
        { categoryRole: 'category', valueRole: 'measure' },
      );
      expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
    });

    it('handles single point', () => {
      const dv = singlePointDV();
      expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
    });

    it('handles tiny viewport', () => {
      const dv = singleSeriesDV();
      expect(() => visual.update(createUpdateOptions([dv], { width: 10, height: 10 }) as never)).not.toThrow();
    });

    it('handles zero viewport', () => {
      const dv = singleSeriesDV();
      expect(() => visual.update(createUpdateOptions([dv], { width: 0, height: 0 }) as never)).not.toThrow();
    });

    it('handles large dataset', () => {
      const cats = Array.from({ length: 200 }, (_, i) => `Cat${i}`);
      const vals = Array.from({ length: 200 }, (_, i) => Math.sin(i) * 100);
      const dv = DataViewBuilder.singleCategoryMeasure(cats, vals, { categoryRole: 'category', valueRole: 'measure' });
      expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
    });

    it('handles all null values', () => {
      const dv = DataViewBuilder.singleCategoryMeasure(
        ['A', 'B', 'C'],
        [null, null, null],
        { categoryRole: 'category', valueRole: 'measure' },
      );
      expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
    });

    it('handles negative values', () => {
      const dv = DataViewBuilder.singleCategoryMeasure(
        ['A', 'B', 'C'],
        [-10, -20, 5],
        { categoryRole: 'category', valueRole: 'measure' },
      );
      expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
    });
  });

  // ── getFormattingModel ────────────────────────────────────────────

  describe('getFormattingModel', () => {
    it('returns a valid formatting model', () => {
      const dv = singleSeriesDV();
      visual.update(createUpdateOptions([dv]) as never);
      const model = visual.getFormattingModel();
      expect(model).toBeDefined();
      expect(model.cards).toBeDefined();
    });

    it('contains card entries', () => {
      const dv = singleSeriesDV();
      visual.update(createUpdateOptions([dv]) as never);
      const model = visual.getFormattingModel();
      expect(model.cards.length).toBeGreaterThan(0);
    });
  });

  // ── DOM Output ────────────────────────────────────────────────────

  describe('DOM output', () => {
    it('creates SVG in container', () => {
      const dv = singleSeriesDV();
      visual.update(createUpdateOptions([dv]) as never);
      expect(constructorOpts.element.querySelector('svg')).not.toBeNull();
    });

    it('cleans up DOM on re-render', () => {
      const dv = singleSeriesDV();
      visual.update(createUpdateOptions([dv]) as never);
      const firstSvgCount = constructorOpts.element.querySelectorAll('svg').length;
      visual.update(createUpdateOptions([dv]) as never);
      const secondSvgCount = constructorOpts.element.querySelectorAll('svg').length;
      expect(secondSvgCount).toBeLessThanOrEqual(firstSvgCount);
    });

    it('transitions from data to empty', () => {
      const dv = singleSeriesDV();
      visual.update(createUpdateOptions([dv]) as never);
      visual.update(createUpdateOptions([DataViewBuilder.empty()]) as never);
      const emptyEl = constructorOpts.element.querySelector('.area-chart-empty');
      expect(emptyEl).not.toBeNull();
    });

    it('transitions from empty to data', () => {
      visual.update(createUpdateOptions([DataViewBuilder.empty()]) as never);
      const dv = singleSeriesDV();
      visual.update(createUpdateOptions([dv]) as never);
      expect(constructorOpts.element.querySelector('svg')).not.toBeNull();
    });
  });

  // ── Re-render & lifecycle ─────────────────────────────────────────

  describe('re-render lifecycle', () => {
    it('can be updated multiple times', () => {
      const dv1 = singleSeriesDV();
      const dv2 = multiSeriesDV();
      expect(() => {
        visual.update(createUpdateOptions([dv1]) as never);
        visual.update(createUpdateOptions([dv2]) as never);
        visual.update(createUpdateOptions([dv1]) as never);
      }).not.toThrow();
    });

    it('destroy cleans up container', () => {
      const dv = singleSeriesDV();
      visual.update(createUpdateOptions([dv]) as never);
      visual.destroy();
      expect(constructorOpts.element.children.length).toBe(0);
    });

    it('can render after destroy + re-create', () => {
      visual.destroy();
      visual = new MorphingAreaChartVisual(constructorOpts as never);
      const dv = singleSeriesDV();
      expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
    });
  });

  // ── Viewport handling ─────────────────────────────────────────────

  describe('viewport handling', () => {
    it('renders at standard viewport', () => {
      const dv = singleSeriesDV();
      expect(() => visual.update(createUpdateOptions([dv], { width: 800, height: 600 }) as never)).not.toThrow();
    });

    it('renders at small viewport', () => {
      const dv = singleSeriesDV();
      expect(() => visual.update(createUpdateOptions([dv], { width: 100, height: 80 }) as never)).not.toThrow();
    });

    it('renders at large viewport', () => {
      const dv = singleSeriesDV();
      expect(() => visual.update(createUpdateOptions([dv], { width: 1920, height: 1080 }) as never)).not.toThrow();
    });
  });
});
