import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MorphingAreaChartVisual } from '../visual';
import { MorphingAreaChartSettings } from '../settings';
import {
  createConstructorOptions,
  createUpdateOptions,
  DataViewBuilder,
} from '../../../core/src/__test-utils__';

const settingsRef: { current: unknown } = { current: undefined };

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
      populateFormattingSettingsModel(ModelClass: new () => unknown, _dv: unknown) {
        if (settingsRef.current) {
          const settings = settingsRef.current;
          settingsRef.current = undefined;
          return settings;
        }
        return new ModelClass();
      }
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

function closeVarianceDV() {
  return DataViewBuilder.multiSeries(
    ['A', 'B'],
    [
      { name: 'Actual', values: [100, 110], role: 'measure' },
      { name: 'Target', values: [99, 109], role: 'measure' },
    ],
    { categoryRole: 'category' },
  );
}

function rightEdgeCloseVarianceDV() {
  return DataViewBuilder.multiSeries(
    ['A', 'B', 'C'],
    [
      { name: 'Actual', values: [80, 100, 120], role: 'measure' },
      { name: 'Target', values: [78, 98, 119], role: 'measure' },
    ],
    { categoryRole: 'category' },
  );
}

function cumulativeOpenedClosedDV() {
  return DataViewBuilder.multiSeries(
    ['Dec-25', 'Jan-26', 'Feb-26', 'Mar-26', 'Apr-26', 'May-26', 'Jun-26'],
    [
      { name: 'Cumulative Opened', values: [7, 8, 10, 21, 31, 36, 36], role: 'measure' },
      { name: 'Cumulative Closed', values: [5, 6, 7, 10, 14, 24, 24], role: 'measure' },
    ],
    { categoryRole: 'category' },
  );
}

function highlightedMultiSeriesDV() {
  const dv = DataViewBuilder.multiSeries(
    ['Jan', 'Feb', 'Mar'],
    [
      { name: 'Revenue', values: [100, 200, 300], role: 'measure' },
      { name: 'Cost', values: [80, 150, 250], role: 'measure' },
    ],
    { categoryRole: 'category' },
  ) as unknown as Record<string, unknown>;

  const categorical = (dv as { categorical?: { values?: Array<Record<string, unknown>> } }).categorical;
  const values = categorical?.values;
  if (values) {
    values[0].highlights = [null, 200, null];
    values[1].highlights = [null, null, null];
  }

  return dv;
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

function createSettings(
  mode: 'normal' | 'stacked' | 'stacked100' | 'stream' = 'normal',
  legendPosition: 'top' | 'bottom' | 'left' | 'right' = 'bottom',
  showTitle = true,
) {
  const settings = new MorphingAreaChartSettings() as unknown as Record<string, unknown> & {
    areaFillSettings: { mode: { value: { value: string; displayName: string } } };
    axisSettings: {
      xAxisLabelPadding?: { value: number };
    };
    titleFormattingCard: {
      showTitle: { value: boolean };
      titleText: { visible?: boolean };
      titleFontSize: { visible?: boolean };
      subtitleText: { visible?: boolean };
      subtitleFontWeight: { visible?: boolean };
    };
    legendFormattingCard: {
      showLegend: { value: boolean };
      legendPosition: { value: { value: string; displayName: string } };
      showInlineLabels: { value: boolean };
      inlineLabelOffset: { value: number };
    };
    animationSettings: {
      enabled: { value: boolean };
    };
    dataLabelFormattingCard: {
      showDataLabels: { value: boolean };
      dataLabelFontSize: { value: number };
      dataLabelPosition: { value: { value: string; displayName: string } };
    };
    gapIndicatorSettings: {
      showGapIndicator: { value: boolean };
      showGapValue: { value: boolean };
      gapFontSize: { value: number };
    };
    crosshairFormattingCard: {
      showCrosshair: { value: boolean };
      showCrosshairValues: { value: boolean };
    };
  };
  settings.areaFillSettings.mode.value = {
    value: mode,
    displayName: mode,
  };
  settings.titleFormattingCard.showTitle.value = showTitle;
  settings.legendFormattingCard.showLegend.value = true;
  settings.legendFormattingCard.legendPosition.value = {
    value: legendPosition,
    displayName: legendPosition.charAt(0).toUpperCase() + legendPosition.slice(1),
  };
  settings.crosshairFormattingCard.showCrosshair.value = false;
  settings.crosshairFormattingCard.showCrosshairValues.value = true;
  return settings;
}

function setSvgRect(svg: SVGSVGElement, width: number, height: number): void {
  Object.defineProperty(svg, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      left: 0,
      top: 0,
      right: width,
      bottom: height,
      width,
      height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  });
}

function svgTextBox(
  text: SVGTextElement,
  fontSize: number,
  anchor: string,
  baseline: 'alphabetic' | 'middle' = 'alphabetic',
) {
  const x = Number(text.getAttribute('x'));
  const y = Number(text.getAttribute('y'));
  const width = (text.textContent?.length ?? 0) * fontSize * 0.6 + 4;
  const height = fontSize + 4;
  let left = x - width / 2;
  if (anchor === 'start') left = x;
  if (anchor === 'end') left = x - width;
  const top = baseline === 'middle' ? y - height / 2 : y - fontSize;
  return {
    left,
    right: left + width,
    top,
    bottom: top + height,
  };
}

function boxesOverlap(a: ReturnType<typeof svgTextBox>, b: ReturnType<typeof svgTextBox>): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function getSelectionManager(): {
  getSelectionIds: () => unknown[];
  __selectionState: () => unknown[];
} {
  return (constructorOpts.host as Record<string, unknown>).__selectionManager as {
    getSelectionIds: () => unknown[];
    __selectionState: () => unknown[];
  };
}

function renderWithMode(dv: unknown, mode: 'normal' | 'stacked' | 'stacked100' | 'stream') {
  settingsRef.current = createSettings(mode);
  visual.update(createUpdateOptions([dv]) as never);
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

    it('dims non-highlighted category slices when highlight data is present', () => {
      const dv = highlightedMultiSeriesDV();
      visual.update(createUpdateOptions([dv]) as never);

      const bands = Array.from(constructorOpts.element.querySelectorAll<SVGRectElement>('.area-linked-band[data-selection-key]'));
      expect(bands).toHaveLength(3);
      expect(bands[0].style.opacity).toBe('0.18');
      expect(bands[1].style.opacity).toBe('0');
      expect(bands[2].style.opacity).toBe('0.18');
    });

    it('anchors the legend on the left when requested', () => {
      settingsRef.current = createSettings('normal', 'left');
      visual.update(createUpdateOptions([multiSeriesDV()]) as never);

      const wrapper = constructorOpts.element.querySelector<HTMLElement>('.area-chart-wrapper');
      const legend = constructorOpts.element.querySelector<HTMLElement>('.pbi-shared-legend');
      const svg = constructorOpts.element.querySelector('svg');

      expect(wrapper).not.toBeNull();
      expect(legend).not.toBeNull();
      expect(svg).not.toBeNull();
      expect(wrapper!.style.position).toBe('relative');
      expect(wrapper!.firstElementChild).toBe(legend);
      expect(legend!.style.position).toBe('absolute');
      expect(legend!.style.left).toBe('0px');
    });

    it('hides title pane controls when title is off', () => {
      const settings = createSettings('normal', 'bottom', false);
      settingsRef.current = settings;
      visual.update(createUpdateOptions([multiSeriesDV()]) as never);

      expect(settings.titleFormattingCard.titleText.visible).toBe(false);
      expect(settings.titleFormattingCard.titleFontSize.visible).toBe(false);
      expect(settings.titleFormattingCard.subtitleText.visible).toBe(false);
      expect(settings.titleFormattingCard.subtitleFontWeight.visible).toBe(false);
    });

    it('hides disabled card appearance controls and dependent forecast settings', () => {
      const settings = new MorphingAreaChartSettings();
      settings.cardSettings.cardStyleMode.value = { value: 'none', displayName: 'None' };
      settings.cardSettings.borderRadius.value = 24;
      settings.areaForecastSettings.show.value = false;
      settings.areaFillSettings.showThreshold.value = false;
      settings.animationSettings.enabled.value = false;
      settingsRef.current = settings;
      visual.update(createUpdateOptions([multiSeriesDV()]) as never);

      expect(settings.cardSettings.backgroundColor.visible).toBe(false);
      expect(settings.cardSettings.backgroundOpacity.visible).toBe(false);
      expect(settings.cardSettings.borderRadius.visible).toBe(false);
      expect(settings.cardSettings.contentPadding.visible).not.toBe(false);
      expect(settings.areaFillSettings.forecastLineOpacity.visible).toBe(false);
      expect(settings.areaFillSettings.forecastBandOpacity.visible).toBe(false);
      expect(settings.areaFillSettings.thresholdLineOpacity.visible).toBe(false);
      expect(settings.animationSettings.duration.visible).toBe(false);
      expect(constructorOpts.element.style.borderRadius).toBe('');
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
      visual.update(createUpdateOptions([dv]) as never);

      const emptyState = constructorOpts.element.querySelector('.area-chart-empty');
      expect(emptyState?.textContent).toContain('No data');
      expect(constructorOpts.element.querySelector('.area-chart-svg')).toBeNull();
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

  describe('interaction behavior', () => {
    it('selects a clicked point and clears on background click', () => {
      const dv = singleSeriesDV();
      visual.update(createUpdateOptions([dv]) as never);

      const dot = constructorOpts.element.querySelector<SVGCircleElement>('.area-dot');
      expect(dot).not.toBeNull();
      dot!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

      const selectionManager = getSelectionManager();
      expect(selectionManager.getSelectionIds()).toHaveLength(1);

      constructorOpts.element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      expect(selectionManager.getSelectionIds()).toHaveLength(0);
    });

    it('recomputes dot positions when switching chart styles', () => {
      const dv = multiSeriesDV();

      renderWithMode(dv, 'normal');
      const normalDots = Array.from(constructorOpts.element.querySelectorAll<SVGCircleElement>('.area-dot'))
        .map((dot) => dot.getAttribute('cy'));

      renderWithMode(dv, 'stacked');
      const stackedDots = Array.from(constructorOpts.element.querySelectorAll<SVGCircleElement>('.area-dot'))
        .map((dot) => dot.getAttribute('cy'));

      renderWithMode(dv, 'stream');
      const streamDots = Array.from(constructorOpts.element.querySelectorAll<SVGCircleElement>('.area-dot'))
        .map((dot) => dot.getAttribute('cy'));

      expect(stackedDots).toHaveLength(normalDots.length);
      expect(streamDots).toHaveLength(normalDots.length);
      expect(stackedDots.some((cy, idx) => cy !== normalDots[idx])).toBe(true);
      expect(streamDots.some((cy, idx) => cy !== normalDots[idx])).toBe(true);
    });

    it('keeps crosshair markers aligned with rendered dots in stream mode', () => {
      const dv = multiSeriesDV();
      const settings = createSettings('stream');
      settings.crosshairFormattingCard.showCrosshair.value = true;
      settingsRef.current = settings;
      visual.update(createUpdateOptions([dv]) as never);

      const svg = constructorOpts.element.querySelector<SVGSVGElement>('svg');
      const chartGroup = constructorOpts.element.querySelector<SVGGElement>('svg g');
      expect(svg).not.toBeNull();
      expect(chartGroup).not.toBeNull();

      setSvgRect(svg!, 600, 400);

      const firstDot = constructorOpts.element.querySelector<SVGCircleElement>('.area-dot');
      expect(firstDot).not.toBeNull();

      const targetCx = Number(firstDot!.getAttribute('cx'));
      const dotYs = Array.from(
        constructorOpts.element.querySelectorAll<SVGCircleElement>('.area-dot'),
      )
        .filter((dot) => Number(dot.getAttribute('cx')) === targetCx)
        .map((dot) => Number(Number(dot.getAttribute('cy')).toFixed(3)))
        .sort((a, b) => a - b);
      expect(dotYs.length).toBeGreaterThan(1);

      const transform = chartGroup!.getAttribute('transform') ?? '';
      const match = /translate\(([-\d.]+),([-\d.]+)\)/.exec(transform);
      const marginLeft = Number(match?.[1] ?? 0);

      svg!.dispatchEvent(new MouseEvent('mousemove', {
        bubbles: true,
        clientX: marginLeft + targetCx,
        clientY: 40,
      }));

      const markerYs = Array.from(
        constructorOpts.element.querySelectorAll<SVGCircleElement>('.crosshair-markers circle'),
      )
        .map((marker) => Number(Number(marker.getAttribute('cy')).toFixed(3)))
        .sort((a, b) => a - b);

      expect(markerYs).toEqual(dotYs);
    });

    it('keeps far-right normal-mode data labels centered away from inline labels', () => {
      const settings = createSettings('normal', 'bottom', false);
      settings.legendFormattingCard.showLegend.value = true;
      settings.legendFormattingCard.showInlineLabels.value = true;
      settings.legendFormattingCard.inlineLabelOffset.value = 18;
      settings.animationSettings.enabled.value = false;
      settings.dataLabelFormattingCard.showDataLabels.value = true;
      settings.dataLabelFormattingCard.dataLabelFontSize.value = 12;
      settings.gapIndicatorSettings.showGapIndicator.value = true;
      settings.gapIndicatorSettings.showGapValue.value = true;
      settings.gapIndicatorSettings.gapFontSize.value = 11;
      settingsRef.current = settings;

      visual.update(createUpdateOptions([rightEdgeCloseVarianceDV()], { width: 640, height: 420 }) as never);

      const dots = Array.from(constructorOpts.element.querySelectorAll<SVGCircleElement>('.area-dot'));
      const rightmostX = Math.max(...dots.map((dot) => Number(dot.getAttribute('cx'))));
      const rightmostKey = dots.find((dot) => Number(dot.getAttribute('cx')) === rightmostX)?.getAttribute('data-selection-key');
      const labels = Array.from(constructorOpts.element.querySelectorAll<SVGTextElement>('.area-data-label'))
        .filter((label) => label.getAttribute('data-selection-key') === rightmostKey);
      const inlineLabels = Array.from(constructorOpts.element.querySelectorAll<SVGTextElement>('.pbi-inline-label'));

      expect(labels).toHaveLength(2);
      expect(inlineLabels.length).toBeGreaterThan(0);
      expect(labels.every((label) => label.getAttribute('text-anchor') === 'middle')).toBe(true);
      expect(labels.every((label) => Number(label.getAttribute('x')) === rightmostX)).toBe(true);

      const firstInlineX = Math.min(...inlineLabels.map((label) => Number(label.getAttribute('x'))));
      for (const label of labels) {
        expect(svgTextBox(label, 12, 'middle').right).toBeLessThan(firstInlineX);
      }
    });

    it('moves x-axis labels down with custom padding', () => {
      const settings = createSettings('normal', 'bottom', false);
      settings.axisSettings.xAxisLabelPadding = { value: 18 };
      settings.animationSettings.enabled.value = false;
      settingsRef.current = settings;

      visual.update(createUpdateOptions([singleSeriesDV()], { width: 640, height: 420 }) as never);

      const tickLabel = constructorOpts.element.querySelector<SVGTextElement>('.area-axis-x .tick text');
      expect(tickLabel).not.toBeNull();
      expect(Number(tickLabel!.getAttribute('y'))).toBeGreaterThanOrEqual(18);
    });

    it('splits close normal-mode data labels away from the gap value', () => {
      const settings = createSettings('normal', 'bottom', false);
      settings.legendFormattingCard.showLegend.value = false;
      settings.animationSettings.enabled.value = false;
      settings.dataLabelFormattingCard.showDataLabels.value = true;
      settings.dataLabelFormattingCard.dataLabelFontSize.value = 12;
      settings.gapIndicatorSettings.showGapIndicator.value = true;
      settings.gapIndicatorSettings.showGapValue.value = true;
      settings.gapIndicatorSettings.gapFontSize.value = 11;
      settingsRef.current = settings;

      visual.update(createUpdateOptions([closeVarianceDV()], { width: 640, height: 420 }) as never);

      const labels = Array.from(constructorOpts.element.querySelectorAll<SVGTextElement>('.area-data-label'))
        .filter((label) => label.getAttribute('data-selection-key') === constructorOpts.element.querySelector<SVGCircleElement>('.area-dot')?.getAttribute('data-selection-key'));
      const gapValue = constructorOpts.element.querySelector<SVGTextElement>('.gap-indicator-value');

      expect(labels).toHaveLength(2);
      expect(gapValue).not.toBeNull();

      const labelYs = labels.map((label) => Number(label.getAttribute('y')));
      expect(Math.abs(labelYs[0] - labelYs[1])).toBeGreaterThanOrEqual(16);

      const gapBox = svgTextBox(gapValue!, 11, 'start', 'middle');
      for (const label of labels) {
        expect(boxesOverlap(svgTextBox(label, 12, label.getAttribute('text-anchor') ?? 'middle'), gapBox)).toBe(false);
      }
    });

    it('keeps the gap value close to the gap line when data labels are enabled', () => {
      const settings = createSettings('normal', 'bottom', false);
      settings.legendFormattingCard.showLegend.value = false;
      settings.animationSettings.enabled.value = false;
      settings.dataLabelFormattingCard.showDataLabels.value = true;
      settings.dataLabelFormattingCard.dataLabelFontSize.value = 12;
      settings.gapIndicatorSettings.showGapIndicator.value = true;
      settings.gapIndicatorSettings.showGapValue.value = true;
      settings.gapIndicatorSettings.gapFontSize.value = 11;
      settingsRef.current = settings;

      visual.update(createUpdateOptions([closeVarianceDV()], { width: 640, height: 420 }) as never);

      const gapLine = constructorOpts.element.querySelector<SVGLineElement>('.gap-indicator-line');
      const gapValue = constructorOpts.element.querySelector<SVGTextElement>('.gap-indicator-value');
      expect(gapLine).not.toBeNull();
      expect(gapValue).not.toBeNull();

      const lineX = Number(gapLine!.getAttribute('x1'));
      const labelX = Number(gapValue!.getAttribute('x'));
      expect(labelX - lineX).toBe(8);
    });

    it('keeps auto labels above the upper line and below the lower line in normal mode', () => {
      const settings = createSettings('normal', 'bottom', false);
      settings.legendFormattingCard.showLegend.value = false;
      settings.animationSettings.enabled.value = false;
      settings.dataLabelFormattingCard.showDataLabels.value = true;
      settings.dataLabelFormattingCard.dataLabelFontSize.value = 12;
      settings.dataLabelFormattingCard.dataLabelPosition.value = { value: 'auto', displayName: 'Auto' };
      settings.gapIndicatorSettings.showGapIndicator.value = false;
      settingsRef.current = settings;

      visual.update(createUpdateOptions([closeVarianceDV()], { width: 640, height: 420 }) as never);

      const dots = Array.from(constructorOpts.element.querySelectorAll<SVGCircleElement>('.area-dot:not(.area-highlight-dot)'))
        .filter((dot) => dot.getAttribute('data-selection-key'));
      const labels = Array.from(constructorOpts.element.querySelectorAll<SVGTextElement>('.area-data-label:not(.area-highlight-data-label)'));
      expect(dots.length).toBeGreaterThanOrEqual(2);
      expect(labels.length).toBeGreaterThanOrEqual(2);

      const byCategory = new Map<string, Array<{ dot: SVGCircleElement; label: SVGTextElement; cy: number; labelBox: ReturnType<typeof svgTextBox> }>>();
      for (const dot of dots) {
        const key = dot.getAttribute('data-selection-key') ?? '';
        const seriesIdx = dot.getAttribute('data-series') ?? '';
        const label = labels.find((candidate) =>
          candidate.getAttribute('data-selection-key') === key
            && candidate.getAttribute('data-series') === seriesIdx);
        if (!label) continue;
        const cx = dot.getAttribute('cx') ?? '';
        const items = byCategory.get(cx) ?? [];
        items.push({
          dot,
          label,
          cy: Number(dot.getAttribute('cy')),
          labelBox: svgTextBox(label, 12, label.getAttribute('text-anchor') ?? 'middle'),
        });
        byCategory.set(cx, items);
      }

      const pairedCategory = Array.from(byCategory.values()).find((items) => items.length === 2);
      expect(pairedCategory).toBeDefined();
      const sorted = pairedCategory!.sort((a, b) => a.cy - b.cy);
      const upper = sorted[0];
      const lower = sorted[1];

      expect(upper.labelBox.bottom).toBeLessThanOrEqual(upper.cy - 1);
      expect(lower.labelBox.top).toBeGreaterThanOrEqual(lower.cy + 1);
      expect(boxesOverlap(upper.labelBox, lower.labelBox)).toBe(false);
    });

    it('uses reserved margins so auto labels do not get clamped back into a cramped cumulative chart', () => {
      const settings = createSettings('normal', 'bottom', false);
      settings.legendFormattingCard.showLegend.value = true;
      settings.legendFormattingCard.showInlineLabels.value = true;
      settings.legendFormattingCard.inlineLabelOffset.value = 18;
      settings.animationSettings.enabled.value = false;
      settings.dataLabelFormattingCard.showDataLabels.value = true;
      settings.dataLabelFormattingCard.dataLabelFontSize.value = 12;
      settings.dataLabelFormattingCard.dataLabelPosition.value = { value: 'auto', displayName: 'Auto' };
      settings.gapIndicatorSettings.showGapIndicator.value = true;
      settings.gapIndicatorSettings.showGapValue.value = true;
      settings.gapIndicatorSettings.gapFontSize.value = 11;
      settingsRef.current = settings;

      visual.update(createUpdateOptions([cumulativeOpenedClosedDV()], { width: 640, height: 260 }) as never);

      const labels = Array.from(constructorOpts.element.querySelectorAll<SVGTextElement>('.area-data-label:not(.area-highlight-data-label)'));
      const dots = Array.from(constructorOpts.element.querySelectorAll<SVGCircleElement>('.area-dot:not(.area-highlight-dot)'));
      const gapLabels = Array.from(constructorOpts.element.querySelectorAll<SVGTextElement>('.gap-indicator-value'));
      expect(labels.length).toBeGreaterThan(0);
      expect(gapLabels.length).toBeGreaterThan(0);

      for (const label of labels) {
        const seriesIdx = label.getAttribute('data-series') ?? '';
        const key = label.getAttribute('data-selection-key') ?? '';
        const dot = dots.find((candidate) =>
          candidate.getAttribute('data-series') === seriesIdx
            && candidate.getAttribute('data-selection-key') === key
            && candidate.getAttribute('cx') === label.getAttribute('x'));
        expect(dot).toBeDefined();
        const cy = Number(dot!.getAttribute('cy'));
        const box = svgTextBox(label, 12, label.getAttribute('text-anchor') ?? 'middle');

        if (seriesIdx === '0') {
          expect(box.bottom).toBeLessThanOrEqual(cy - 1);
        } else {
          expect(box.top).toBeGreaterThanOrEqual(cy + 1);
        }

        const sameCategoryGapLabels = gapLabels.filter((gapLabel) =>
          Math.abs(Number(gapLabel.getAttribute('x')) - Number(label.getAttribute('x'))) <= 28);
        for (const gapLabel of sameCategoryGapLabels) {
          expect(boxesOverlap(box, svgTextBox(gapLabel, 11, 'start', 'middle'))).toBe(false);
        }
      }
    });

    it('keeps the cumulative chart roomy while leaving compact axis and inline-label gutters', () => {
      const settings = createSettings('normal', 'bottom', false);
      settings.legendFormattingCard.showLegend.value = true;
      settings.legendFormattingCard.showInlineLabels.value = true;
      settings.legendFormattingCard.inlineLabelOffset.value = 18;
      settings.animationSettings.enabled.value = false;
      settings.dataLabelFormattingCard.showDataLabels.value = true;
      settings.dataLabelFormattingCard.dataLabelFontSize.value = 12;
      settings.dataLabelFormattingCard.dataLabelPosition.value = { value: 'auto', displayName: 'Auto' };
      settings.gapIndicatorSettings.showGapIndicator.value = true;
      settings.gapIndicatorSettings.showGapValue.value = true;
      settings.gapIndicatorSettings.gapFontSize.value = 11;
      settingsRef.current = settings;

      visual.update(createUpdateOptions([cumulativeOpenedClosedDV()], { width: 640, height: 260 }) as never);

      const svg = constructorOpts.element.querySelector<SVGSVGElement>('svg');
      const chartGroup = constructorOpts.element.querySelector<SVGGElement>('svg > g');
      const axis = constructorOpts.element.querySelector<SVGGElement>('.area-axis-x');
      const firstGapLine = constructorOpts.element.querySelector<SVGLineElement>('.gap-indicator-line');
      const inlineLabels = Array.from(constructorOpts.element.querySelectorAll<SVGTextElement>('.pbi-inline-label'));
      const tickLabels = Array.from(constructorOpts.element.querySelectorAll<SVGTextElement>('.area-axis-x .tick text'));
      expect(svg).not.toBeNull();
      expect(chartGroup).not.toBeNull();
      expect(axis).not.toBeNull();
      expect(firstGapLine).not.toBeNull();
      expect(inlineLabels.length).toBeGreaterThan(0);
      expect(tickLabels.length).toBeGreaterThan(0);

      const gapPixels = Math.abs(Number(firstGapLine!.getAttribute('y2')) - Number(firstGapLine!.getAttribute('y1')));
      expect(gapPixels).toBeGreaterThanOrEqual(6);

      const marginLeft = Number(chartGroup!.getAttribute('transform')?.match(/translate\(([-\d.]+),([-\d.]+)\)/)?.[1] ?? 0);
      const marginTop = Number(chartGroup!.getAttribute('transform')?.match(/translate\(([-\d.]+),([-\d.]+)\)/)?.[2] ?? 0);
      const chartHeight = Number(axis!.getAttribute('transform')?.match(/translate\(0,([-\d.]+)\)/)?.[1] ?? 0);
      const svgWidth = Number(svg!.getAttribute('width'));
      const svgHeight = Number(svg!.getAttribute('height'));
      const lowestTickBottom = Math.max(...tickLabels.map((label) =>
        marginTop + chartHeight + svgTextBox(label, 11, label.getAttribute('text-anchor') ?? 'middle').bottom));
      const rightmostInline = Math.max(...inlineLabels.map((label) =>
        marginLeft + svgTextBox(label, 11, 'start').right));

      expect(svgHeight - lowestTickBottom).toBeLessThanOrEqual(48);
      expect(svgWidth - rightmostInline).toBeLessThanOrEqual(56);
    });
  });

  describe('host filtering and accessibility', () => {
    it('removes date-filtered categories from the rendered domain', () => {
      const settings = new MorphingAreaChartSettings();
      settings.animationSettings.enabled.value = false;
      settings.dateFilterFormattingCard.enableDateFilter.value = true;
      settings.dateFilterFormattingCard.startDate.value = '2024-02-01';
      settings.dateFilterFormattingCard.endAtCurrentDate.value = false;
      settings.dateFilterFormattingCard.endDate.value = '2024-02-01';
      settingsRef.current = settings;

      const dv = DataViewBuilder.singleCategoryMeasure(
        ['2024-01-01', '2024-02-01', '2024-03-01'],
        [10, 20, 30],
        { categoryRole: 'category', valueRole: 'measure' },
      ) as {
        metadata: { columns: Array<{ type: Record<string, boolean> }> };
        categorical?: {
          categories?: Array<{
            source: { type: Record<string, boolean> };
          }>;
        };
      };
      dv.metadata.columns[0].type = { dateTime: true };
      dv.categorical!.categories![0].source.type = { dateTime: true };

      visual.update(createUpdateOptions([dv], { width: 700, height: 400 }) as never);

      const extracted = (visual as unknown as {
        currentData: {
          categories: string[];
          series: Array<{ values: Array<number | null> }>;
        };
      }).currentData;
      expect(extracted.categories).toEqual(['2024-02-01']);
      expect(extracted.series[0].values).toEqual([20]);
      expect(
        constructorOpts.element.querySelectorAll('.area-dot:not(.area-highlight-dot)'),
      ).toHaveLength(1);
    });

    it('makes rendered points focusable and hides the gap card for one series', () => {
      const settings = new MorphingAreaChartSettings();
      settings.animationSettings.enabled.value = false;
      settingsRef.current = settings;
      visual.update(createUpdateOptions([singleSeriesDV()]) as never);

      const dots = Array.from(
        constructorOpts.element.querySelectorAll<SVGCircleElement>(
          '.area-dot:not(.area-highlight-dot)',
        ),
      );
      expect(dots.length).toBeGreaterThan(0);
      expect(dots.every((dot) => dot.getAttribute('tabindex') === '0')).toBe(true);
      expect(settings.gapIndicatorSettings.showGapIndicator.visible).toBe(false);
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
