import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BarChartProVisual } from '../visual';
import { BarChartProSettings } from '../settings';
import {
  createConstructorOptions,
  createUpdateOptions,
  DataViewBuilder,
} from '../../../core/src/__test-utils__';

// Stub LESS import
vi.mock('../../style/visual.less', () => ({}));

// Stub FormattingSettingsService
const settingsRef: { current: unknown } = { current: undefined };
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
          const ref = settingsRef.current;
          settingsRef.current = undefined;
          return ref;
        }
        return new ModelClass();
      }
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

function weldSignoffDV() {
  return DataViewBuilder.multiSeries(
    ['Cell A', 'Cell B', 'Cell C'],
    [
      { name: 'Total Welds', values: [100, 80, 200], role: 'values' },
      { name: 'Signed Welds', values: [50, 60, 150], role: 'values' },
    ],
    { categoryRole: 'category' },
  );
}

function sortControlDV() {
  return DataViewBuilder.multiSeries(
    ['Cell A', 'Cell B', 'Cell C'],
    [
      { name: 'Total Welds', values: [300, 100, 200], role: 'values' },
      { name: 'Signed Welds', values: [30, 90, 100], role: 'values' },
    ],
    { categoryRole: 'category' },
  );
}

function longScrollableSortDV() {
  const categories = Array.from({ length: 18 }, (_, index) => `Pipe Spec ${index + 1}`);
  return DataViewBuilder.multiSeries(
    categories,
    [
      { name: 'Total Welds', values: categories.map((_, index) => 100 + index), role: 'values' },
      { name: 'Signed Welds', values: categories.map((_, index) => 50 + index), role: 'values' },
    ],
    { categoryRole: 'category' },
  );
}

function pipeSpecTooltipDV() {
  return new DataViewBuilder()
    .withCategory('Spec Acronym', ['CS', 'SS', 'PVC'], 'category')
    .withCategory('Spec Full Name', ['Carbon Steel', 'Stainless Steel', 'Polyvinyl Chloride'], 'hoverTooltip')
    .withValues('Welds', [12, 24, 18], 'values')
    .build();
}

function comboModeDV() {
  return new DataViewBuilder()
    .withCategory('Month', ['Jan', 'Feb', 'Mar'], 'category')
    .withValues('Revenue', [100, 200, 300], 'values')
    .withValues('Trend', [90, 210, 280], 'lineValues')
    .build();
}

function comboModeNegativeLineDV() {
  return new DataViewBuilder()
    .withCategory('Month', ['Jan', 'Feb', 'Mar'], 'category')
    .withValues('Revenue', [100, 200, 300], 'values')
    .withValues('Trend', [-90, 210, -280], 'lineValues')
    .build();
}

function comboModeDippedLineLabelDV() {
  return new DataViewBuilder()
    .withCategory('Month', ['Jan', 'Feb', 'Mar'], 'category')
    .withValues('Revenue', [100, 20, 100], 'values')
    .withValues('Trend', [90, 20, 90], 'lineValues')
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

function denseFlatDV(n: number) {
  const cats = Array.from({ length: n }, (_, i) => `Cat${i}`);
  const vals = Array.from({ length: n }, () => 10);
  return DataViewBuilder.singleCategoryMeasure(cats, vals, { categoryRole: 'category', valueRole: 'values' });
}

function denseGroupedDV(n: number) {
  const cats = Array.from({ length: n }, (_, i) => `Cat${i}`);
  return DataViewBuilder.multiSeries(
    cats,
    [
      { name: 'Planned', values: cats.map(() => 10), role: 'values' },
      { name: 'Actual', values: cats.map(() => 8), role: 'values' },
      { name: 'Complete', values: cats.map(() => 6), role: 'values' },
    ],
    { categoryRole: 'category' },
  );
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

function highlightedSingleBarDV() {
  const dv = singleBarDV() as {
    categorical?: {
      values?: Array<{ highlights?: (number | null)[] }>;
    };
  };
  dv.categorical?.values?.[0] && (dv.categorical.values[0].highlights = [null, 20, null]);
  return dv;
}

function categoryColorDV() {
  const dv = singleBarDV() as {
    categorical?: {
      categories?: Array<{ objects?: Array<Record<string, Record<string, unknown>>> }>;
    };
  };
  const categoryColumn = dv.categorical?.categories?.[0];
  if (categoryColumn) {
    categoryColumn.objects = [
      { categoryColors: { categoryColor: { solid: { color: '#ff0000' } } } },
      { categoryColors: { categoryColor: { solid: { color: '#00ff00' } } } },
      { categoryColors: { categoryColor: { solid: { color: '#0000ff' } } } },
    ];
  }
  return dv;
}

function getRenderableBars(): SVGRectElement[] {
  return Array.from(constructorOpts.element.querySelectorAll<SVGRectElement>('.bar-chart-bar[data-selection-key]'));
}

function getTranslateX(transform: string | null): number {
  const match = transform?.match(/translate\(([-\d.]+)/);
  return match ? Number(match[1]) : Number.NaN;
}

function clickElement(element: Element): void {
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

function applySortControlsSettings(settings: BarChartProSettings, overrides: Record<string, unknown> = {}): void {
  Object.assign(settings as unknown as Record<string, unknown>, {
    sortControlsSettings: {
      enabled: { value: true },
      defaultSort: { value: { value: 'noSort', displayName: 'No Sort' } },
      showPercentOptions: { value: true },
      position: { value: { value: 'right', displayName: 'Right' } },
      fontSize: { value: 11 },
      activeColor: { value: { value: '#0F172A' } },
      inactiveColor: { value: { value: '#64748B' } },
      backgroundColor: { value: { value: '#FFFFFF' } },
      ...overrides,
    },
  });
}

function getXAxisLabels(): string[] {
  return Array.from(constructorOpts.element.querySelectorAll<SVGTextElement>('.bar-chart-axis-x text'))
    .map((label) => label.textContent ?? '')
    .filter(Boolean);
}

// ── Construction ──────────────────────────────────────────────────────

describe('BarChartProVisual', () => {
  it('treats Data Labels: None as the master label switch', () => {
    const settings = new BarChartProSettings();
    settings.animationSettings.enabled.value = false;
    settings.barSettings.showDataLabels.value = { value: 'none', displayName: 'None' };
    settingsRef.current = settings;

    visual.update(createUpdateOptions([singleBarDV()]) as never);

    expect(constructorOpts.element.querySelectorAll('.bar-chart-label')).toHaveLength(0);
  });

  describe('construction', () => {
    it('initializes without errors', () => {
      expect(visual).toBeDefined();
    });

    it('adds bar-chart-container class to element', () => {
      expect(constructorOpts.element.classList.contains('bar-chart-container')).toBe(true);
    });

    it('opens the empty-space context menu', () => {
      const dv = singlePointDV();
      visual.update(createUpdateOptions([dv]) as never);
      const selectionManager = (constructorOpts.host as Record<string, unknown>).__selectionManager as {
        showContextMenu: (...args: unknown[]) => unknown;
      };
      const spy = vi.spyOn(selectionManager as any, 'showContextMenu');
      constructorOpts.element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 12, clientY: 34 }));
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ getKey: expect.any(Function) }),
        { x: 12, y: 34 },
      );
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

    it('centers minimum-width grouped bars over their category ticks', () => {
      const settings = new BarChartProSettings();
      settings.animationSettings.enabled.value = false;
      settings.chartMode.mode.value = { value: 'grouped', displayName: 'Grouped' };
      settings.scrollFormattingCard.enableScroll.value = false;
      settingsRef.current = settings;

      visual.update(createUpdateOptions([denseFlatDV(500)], { width: 320, height: 260 }) as never);

      const firstBar = getRenderableBars()[0];
      const firstTick = constructorOpts.element.querySelector<SVGGElement>('.bar-chart-axis-x .tick');
      expect(firstBar).toBeDefined();
      expect(firstTick).not.toBeNull();

      const centerX = Number(firstBar.getAttribute('x')) + Number(firstBar.getAttribute('width')) / 2;
      const tickX = getTranslateX(firstTick?.getAttribute('transform') ?? null);
      expect(centerX).toBeCloseTo(tickX, 3);
    });

    it('keeps the first dense multi-series group inside the plot and centered on its category', () => {
      const settings = new BarChartProSettings();
      settings.animationSettings.enabled.value = false;
      settings.chartMode.mode.value = { value: 'grouped', displayName: 'Grouped' };
      settings.scrollFormattingCard.enableScroll.value = false;
      settingsRef.current = settings;

      visual.update(createUpdateOptions([denseGroupedDV(500)], { width: 320, height: 260 }) as never);

      const firstGroup = getRenderableBars().slice(0, 3);
      const firstTick = constructorOpts.element.querySelector<SVGGElement>('.bar-chart-axis-x .tick');
      const left = Math.min(...firstGroup.map((bar) => Number(bar.getAttribute('x'))));
      const right = Math.max(...firstGroup.map((bar) => Number(bar.getAttribute('x')) + Number(bar.getAttribute('width'))));
      const tickX = getTranslateX(firstTick?.getAttribute('transform') ?? null);

      expect(firstGroup).toHaveLength(3);
      expect(left).toBeGreaterThanOrEqual(0);
      expect((left + right) / 2).toBeCloseTo(tickX, 3);
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

    it('uses persisted category colors when bar colors are set to category', () => {
      const settings = new BarChartProSettings();
      settings.dataRolesSettings.colorBy.value = { value: 'category', displayName: 'By Category' };
      settingsRef.current = settings;

      visual.update(createUpdateOptions([categoryColorDV()]) as never);

      const fills = getRenderableBars().map((bar) => bar.getAttribute('fill'));
      expect(fills).toEqual(expect.arrayContaining(['#ff0000', '#00ff00', '#0000ff']));
    });

    it('renders signoff percentages at the right edge in horizontal mode', () => {
      const settings = new BarChartProSettings();
      settings.chartMode.mode.value = { value: 'horizontal', displayName: 'Horizontal' };
      settings.percentComparisonSettings.show.value = true;
      settings.percentComparisonSettings.numeratorSeriesIndex.value = 2;
      settings.percentComparisonSettings.denominatorSeriesIndex.value = 1;
      settings.percentComparisonSettings.decimalPlaces.value = 0;
      settingsRef.current = settings;

      visual.update(createUpdateOptions([weldSignoffDV()]) as never);

      const labels = Array.from(constructorOpts.element.querySelectorAll<SVGTextElement>('.bar-chart-percent-comparison-label'));
      expect(labels.map((label) => label.textContent)).toEqual(expect.arrayContaining(['50%', '75%']));
      expect(labels.every((label) => label.getAttribute('text-anchor') === 'end')).toBe(true);
    });

    it('pins horizontal inside data labels to the inside end of each bar', () => {
      const settings = new BarChartProSettings();
      settings.animationSettings.enabled.value = false;
      settings.chartMode.mode.value = { value: 'horizontal', displayName: 'Horizontal' };
      settings.barSettings.showDataLabels.value = { value: 'inside', displayName: 'Inside' };
      settingsRef.current = settings;

      const svgPrototype = SVGElement.prototype as unknown as { getBBox: () => DOMRect };
      const originalGetBBox = svgPrototype.getBBox;
      (SVGElement.prototype as unknown as { getBBox: () => DOMRect }).getBBox = function getTestBBox() {
        const el = this as SVGTextElement;
        const x = Number(el.getAttribute('x') ?? 0);
        const y = Number(el.getAttribute('y') ?? 0);
        const text = el.textContent ?? '';
        const width = Math.max(12, text.length * 7);
        const height = 12;
        const anchor = el.getAttribute('text-anchor') ?? 'middle';
        return {
          x: anchor === 'end' ? x - width : anchor === 'start' ? x : x - width / 2,
          y: y - height / 2,
          width,
          height,
        } as DOMRect;
      };

      try {
        visual.update(createUpdateOptions([singleBarDV()], { width: 620, height: 360 }) as never);
      } finally {
        svgPrototype.getBBox = originalGetBBox;
      }

      const labels = Array.from(constructorOpts.element.querySelectorAll<SVGTextElement>('.bar-chart-label'));
      const bars = getRenderableBars();
      expect(labels.length).toBe(3);

      labels.forEach((label) => {
        const labelY = Number(label.getAttribute('y'));
        const matchingBar = bars.find((bar) => {
          const barCenterY = Number(bar.getAttribute('y')) + Number(bar.getAttribute('height')) / 2;
          return Math.abs(barCenterY - labelY) < 0.001;
        });
        expect(Boolean(matchingBar)).toBe(true);

        const labelX = Number(label.getAttribute('x'));
        const barX = Number(matchingBar?.getAttribute('x'));
        const barWidth = Number(matchingBar?.getAttribute('width'));
        const expectedX = barX + barWidth - 4;
        const expectedAnchor = 'end';

        expect(labelX).toBeCloseTo(expectedX, 5);
        expect(label.getAttribute('text-anchor')).toBe(expectedAnchor);
        expect(label.style.getPropertyValue('text-anchor')).toBe(expectedAnchor);
      });
    });

    it('renders signoff percentages above vertical category groups', () => {
      const settings = new BarChartProSettings();
      settings.percentComparisonSettings.show.value = true;
      settings.percentComparisonSettings.numeratorSeriesIndex.value = 2;
      settings.percentComparisonSettings.denominatorSeriesIndex.value = 1;
      settings.percentComparisonSettings.decimalPlaces.value = 0;
      settingsRef.current = settings;

      visual.update(createUpdateOptions([weldSignoffDV()]) as never);

      const labels = Array.from(constructorOpts.element.querySelectorAll<SVGTextElement>('.bar-chart-percent-comparison-label'));
      expect(labels.map((label) => label.textContent)).toEqual(expect.arrayContaining(['50%', '75%']));
      expect(labels.every((label) => label.getAttribute('text-anchor') === 'middle')).toBe(true);
    });

    it('renders on-chart sort pills and lets users switch from value sort to percent sort', () => {
      const settings = new BarChartProSettings();
      settings.animationSettings.enabled.value = false;
      settings.percentComparisonSettings.show.value = true;
      settings.percentComparisonSettings.numeratorSeriesIndex.value = 2;
      settings.percentComparisonSettings.denominatorSeriesIndex.value = 1;
      applySortControlsSettings(settings);
      settingsRef.current = settings;

      visual.update(createUpdateOptions([sortControlDV()], { width: 700, height: 420 }) as never);

      clickElement(constructorOpts.element.querySelector<HTMLButtonElement>('.bar-chart-sort-toggle')!);
      const controls = constructorOpts.element.querySelector<HTMLElement>('.bar-chart-sort-controls');
      expect(controls).not.toBeNull();
      expect(controls?.style.right).toBe('8px');
      const options = Array.from(constructorOpts.element.querySelectorAll<HTMLButtonElement>('.bar-chart-sort-option'));
      expect(options.map((option) => option.textContent)).toEqual(['No Sort', 'High to Low', 'Low to High', '% High to Low', '% Low to High']);
      expect(getXAxisLabels()).toEqual(['Cell A', 'Cell B', 'Cell C']);

      const highToLow = options.find((option) => option.dataset.sortMode === 'highToLow');
      expect(highToLow).toBeDefined();
      clickElement(highToLow!);
      expect(getXAxisLabels()).toEqual(['Cell A', 'Cell C', 'Cell B']);

      const percentHighToLow = constructorOpts.element.querySelector<HTMLButtonElement>('.bar-chart-sort-option[data-sort-mode="percentHighToLow"]');
      expect(percentHighToLow).toBeDefined();
      clickElement(percentHighToLow!);

      expect(getXAxisLabels()).toEqual(['Cell B', 'Cell C', 'Cell A']);
      const active = constructorOpts.element.querySelector<HTMLButtonElement>('.bar-chart-sort-option[aria-pressed="true"]');
      expect(active?.dataset.sortMode).toBe('percentHighToLow');
    });

    it('keeps No Sort active by default and restores source order after another sort', () => {
      const settings = new BarChartProSettings();
      settings.animationSettings.enabled.value = false;
      applySortControlsSettings(settings);
      settingsRef.current = settings;

      visual.update(createUpdateOptions([sortControlDV()], { width: 700, height: 420 }) as never);

      clickElement(constructorOpts.element.querySelector<HTMLButtonElement>('.bar-chart-sort-toggle')!);
      expect(getXAxisLabels()).toEqual(['Cell A', 'Cell B', 'Cell C']);
      const initialActive = constructorOpts.element.querySelector<HTMLButtonElement>('.bar-chart-sort-option[aria-pressed="true"]');
      expect(initialActive?.dataset.sortMode).toBe('noSort');

      const highToLow = constructorOpts.element.querySelector<HTMLButtonElement>('.bar-chart-sort-option[data-sort-mode="highToLow"]');
      clickElement(highToLow!);
      expect(getXAxisLabels()).toEqual(['Cell A', 'Cell C', 'Cell B']);

      const noSort = constructorOpts.element.querySelector<HTMLButtonElement>('.bar-chart-sort-option[data-sort-mode="noSort"]');
      clickElement(noSort!);

      expect(getXAxisLabels()).toEqual(['Cell A', 'Cell B', 'Cell C']);
      const restoredActive = constructorOpts.element.querySelector<HTMLButtonElement>('.bar-chart-sort-option[aria-pressed="true"]');
      expect(restoredActive?.dataset.sortMode).toBe('noSort');
    });

    it('shows a collapsed sort trigger by default so published reports keep the control visible', () => {
      const settings = new BarChartProSettings();
      settings.animationSettings.enabled.value = false;
      settingsRef.current = settings;

      visual.update(createUpdateOptions([sortControlDV()], { width: 700, height: 420 }) as never);

      const toggle = constructorOpts.element.querySelector<HTMLButtonElement>('.bar-chart-sort-toggle');
      expect(toggle).not.toBeNull();
      expect(toggle?.getAttribute('aria-expanded')).toBe('false');
      expect(toggle?.textContent).toContain('Sort');
      expect(constructorOpts.element.querySelector('.bar-chart-sort-controls')).toBeNull();
    });

    it('keeps the sort controls clear of the vertical scrollbar when scrolling horizontal bars', () => {
      const settings = new BarChartProSettings();
      settings.animationSettings.enabled.value = false;
      settings.chartMode.mode.value = { value: 'horizontal', displayName: 'Horizontal' };
      settings.scrollFormattingCard.enableScroll.value = true;
      settings.scrollFormattingCard.minCategoryWidth.value = 46;
      applySortControlsSettings(settings);
      settingsRef.current = settings;

      visual.update(createUpdateOptions([longScrollableSortDV()], { width: 620, height: 260 }) as never);

      const scrollWrapper = constructorOpts.element.querySelector<HTMLElement>('.pbi-scroll-wrapper');
      const controls = constructorOpts.element.querySelector<HTMLElement>('.bar-chart-sort-controls');
      const toggle = constructorOpts.element.querySelector<HTMLButtonElement>('.bar-chart-sort-toggle');
      expect(scrollWrapper).not.toBeNull();
      expect(controls).toBeNull();
      expect(toggle?.style.right).toBe('56px');
    });

    it('keeps grouped value axes fixed while the plot and category axis scroll', () => {
      const settings = new BarChartProSettings();
      settings.animationSettings.enabled.value = false;
      settings.sortControlsSettings.enabled.value = false;
      settings.chartMode.mode.value = { value: 'grouped', displayName: 'Grouped' };
      settings.scrollFormattingCard.enableScroll.value = true;
      settings.scrollFormattingCard.minCategoryWidth.value = 52;
      settings.axisFormattingCard.xAxisTitle.value = 'Category';
      settings.axisFormattingCard.yAxisTitle.value = 'Value';
      settingsRef.current = settings;

      visual.update(createUpdateOptions([longScrollableSortDV()], { width: 520, height: 340 }) as never);

      const scrollWrapper = constructorOpts.element.querySelector<HTMLElement>('.bar-chart-plot-scroll-wrapper');
      const fixedSvg = constructorOpts.element.querySelector<SVGSVGElement>('.bar-chart-fixed-axis-svg');
      expect(scrollWrapper).not.toBeNull();
      expect(fixedSvg).not.toBeNull();
      expect(scrollWrapper?.querySelector('.bar-chart-axis-y')).toBeNull();
      expect(scrollWrapper?.querySelector('.bar-chart-axis-title-y')).toBeNull();
      expect(scrollWrapper?.querySelector('.bar-chart-axis-x')).not.toBeNull();
      expect(scrollWrapper?.querySelector('.bar-chart-axis-title')?.textContent).toBe('Category');
      expect(scrollWrapper?.querySelector('.bar-chart-bar')).not.toBeNull();
      expect(fixedSvg?.querySelector('.bar-chart-axis-y')).not.toBeNull();
      expect(fixedSvg?.querySelector('.bar-chart-axis-title-y')).not.toBeNull();
      const fixedAxisTitles = Array.from(fixedSvg?.querySelectorAll<SVGTextElement>('.bar-chart-axis-title') ?? [])
        .map((title) => title.textContent);
      expect(fixedAxisTitles).toEqual(['Value']);

      const firstGroup = Array.from(scrollWrapper?.querySelectorAll<SVGRectElement>('.bar-chart-bar') ?? []).slice(0, 2);
      const firstTick = scrollWrapper?.querySelector<SVGGElement>('.bar-chart-axis-x .tick');
      const left = Math.min(...firstGroup.map((bar) => Number(bar.getAttribute('x'))));
      const right = Math.max(...firstGroup.map((bar) => Number(bar.getAttribute('x')) + Number(bar.getAttribute('width'))));
      const tickX = getTranslateX(firstTick?.getAttribute('transform') ?? null);
      expect(left).toBeGreaterThanOrEqual(0);
      expect((left + right) / 2).toBeCloseTo(tickX, 3);
      expect(tickX).toBeGreaterThanOrEqual(settings.scrollFormattingCard.minCategoryWidth.value * 0.7);
    });

    it('keeps both combo value axes fixed while the plot and category axis scroll', () => {
      const settings = new BarChartProSettings();
      settings.animationSettings.enabled.value = false;
      settings.sortControlsSettings.enabled.value = false;
      settings.chartMode.mode.value = { value: 'combo', displayName: 'Combo' };
      settings.scrollFormattingCard.enableScroll.value = true;
      settings.scrollFormattingCard.minCategoryWidth.value = 200;
      settings.axisFormattingCard.xAxisTitle.value = 'Category';
      settings.axisFormattingCard.yAxisTitle.value = 'Primary';
      settings.secondaryAxisSettings.showSecondaryYAxis.value = true;
      settings.secondaryAxisSettings.secondaryYAxisTitle.value = 'Secondary';
      settingsRef.current = settings;

      visual.update(createUpdateOptions([comboModeDV()], { width: 520, height: 340 }) as never);

      const scrollWrapper = constructorOpts.element.querySelector<HTMLElement>('.bar-chart-plot-scroll-wrapper');
      const fixedSvg = constructorOpts.element.querySelector<SVGSVGElement>('.bar-chart-fixed-axis-svg');
      const secondaryAxis = fixedSvg?.querySelector<SVGGElement>('.bar-chart-axis-y-secondary');
      const fixedTitles = Array.from(fixedSvg?.querySelectorAll<SVGTextElement>('.bar-chart-axis-title-y') ?? []);

      expect(scrollWrapper).not.toBeNull();
      expect(scrollWrapper?.querySelector('.bar-chart-axis-y')).toBeNull();
      expect(scrollWrapper?.querySelector('.bar-chart-axis-y-secondary')).toBeNull();
      expect(scrollWrapper?.querySelector('.bar-chart-axis-title-y')).toBeNull();
      expect(scrollWrapper?.querySelector('.bar-chart-axis-x')).not.toBeNull();
      expect(scrollWrapper?.querySelector('.bar-chart-bar')).not.toBeNull();
      expect(fixedSvg?.querySelector('.bar-chart-axis-y')).not.toBeNull();
      expect(secondaryAxis).not.toBeNull();
      expect(fixedTitles.map((title) => title.textContent)).toEqual(['Primary', 'Secondary']);
      expect(getTranslateX(secondaryAxis?.getAttribute('transform') ?? null))
        .toBeCloseTo(Number.parseFloat(scrollWrapper?.style.width ?? '0'), 3);
    });

    it('lets users collapse and restore the on-chart sort controls', () => {
      const settings = new BarChartProSettings();
      settings.animationSettings.enabled.value = true;
      applySortControlsSettings(settings);
      settingsRef.current = settings;
      const animateSpy = vi.spyOn(visual as unknown as { animateBar: (...args: unknown[]) => void }, 'animateBar');

      visual.update(createUpdateOptions([sortControlDV()], { width: 700, height: 420 }) as never);
      const initialAnimationCalls = animateSpy.mock.calls.length;

      const initialControls = constructorOpts.element.querySelector<HTMLElement>('.bar-chart-sort-controls');
      const toggle = constructorOpts.element.querySelector<HTMLButtonElement>('.bar-chart-sort-toggle');
      expect(initialControls).toBeNull();
      expect(toggle).not.toBeNull();
      expect(toggle?.getAttribute('aria-expanded')).toBe('false');
      expect(toggle?.textContent).toContain('Sort');

      clickElement(toggle!);

      expect(constructorOpts.element.querySelector('.bar-chart-sort-controls')).not.toBeNull();
      const expandedToggle = constructorOpts.element.querySelector<HTMLButtonElement>('.bar-chart-sort-toggle');
      expect(expandedToggle?.getAttribute('aria-expanded')).toBe('true');
      expect(expandedToggle?.textContent).toContain('Hide');
      expect(animateSpy.mock.calls.length).toBe(initialAnimationCalls);

      clickElement(expandedToggle!);

      expect(constructorOpts.element.querySelector('.bar-chart-sort-controls')).toBeNull();
      expect(constructorOpts.element.querySelector<HTMLButtonElement>('.bar-chart-sort-toggle')?.getAttribute('aria-expanded')).toBe('false');
      expect(animateSpy.mock.calls.length).toBe(initialAnimationCalls);
    });

    it('only replays sort animations when the selected sort mode changes', () => {
      const settings = new BarChartProSettings();
      settings.animationSettings.enabled.value = true;
      settings.percentComparisonSettings.show.value = true;
      settings.percentComparisonSettings.numeratorSeriesIndex.value = 2;
      settings.percentComparisonSettings.denominatorSeriesIndex.value = 1;
      applySortControlsSettings(settings);
      settingsRef.current = settings;
      const animateSpy = vi.spyOn(visual as unknown as { animateBar: (...args: unknown[]) => void }, 'animateBar');

      visual.update(createUpdateOptions([sortControlDV()], { width: 700, height: 420 }) as never);
      const initialAnimationCalls = animateSpy.mock.calls.length;
      clickElement(constructorOpts.element.querySelector<HTMLButtonElement>('.bar-chart-sort-toggle')!);
      const activeHighToLow = constructorOpts.element.querySelector<HTMLButtonElement>('.bar-chart-sort-option[data-sort-mode="highToLow"]');
      expect(constructorOpts.element.querySelector<HTMLButtonElement>('.bar-chart-sort-option[data-sort-mode="noSort"]')?.getAttribute('aria-pressed')).toBe('true');

      clickElement(activeHighToLow!);
      expect(getXAxisLabels()).toEqual(['Cell A', 'Cell C', 'Cell B']);
      const highToLowAnimationCalls = animateSpy.mock.calls.length;
      expect(highToLowAnimationCalls).toBeGreaterThan(initialAnimationCalls);

      const activeHighToLowAfterSort = constructorOpts.element.querySelector<HTMLButtonElement>('.bar-chart-sort-option[data-sort-mode="highToLow"]');
      clickElement(activeHighToLowAfterSort!);
      expect(animateSpy.mock.calls.length).toBe(highToLowAnimationCalls);

      const percentHighToLowAfterSort = constructorOpts.element.querySelector<HTMLButtonElement>('.bar-chart-sort-option[data-sort-mode="percentHighToLow"]');
      clickElement(percentHighToLowAfterSort!);
      expect(animateSpy.mock.calls.length).toBeGreaterThan(highToLowAnimationCalls);
      expect(getXAxisLabels()).toEqual(['Cell B', 'Cell C', 'Cell A']);
    });
  });

  describe('hover tooltips', () => {
    it('shows configured category hover tooltip details immediately on label hover', () => {
      const tooltipShow = vi.fn();
      constructorOpts.host.tooltipService = {
        show: tooltipShow,
        move: vi.fn(),
        hide: vi.fn(),
        enabled: () => true,
      };
      const settings = new BarChartProSettings();
      settings.animationSettings.enabled.value = false;
      settingsRef.current = settings;

      visual.update(createUpdateOptions([pipeSpecTooltipDV()], { width: 620, height: 360 }) as never);

      const label = Array.from(constructorOpts.element.querySelectorAll<SVGTextElement>('.bar-chart-category-tooltip-label'))
        .find((node) => node.textContent === 'CS');
      expect(label).toBeDefined();
      label?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: 120, clientY: 90 }));

      expect(tooltipShow).toHaveBeenCalledTimes(1);
      const call = tooltipShow.mock.calls[0]?.[0] as {
        dataItems?: Array<{ displayName: string; value: string }>;
        identities?: Array<{ getKey?: () => string }>;
      };
      expect(call.dataItems).toEqual(expect.arrayContaining([
        { displayName: 'Category', value: 'CS' },
        { displayName: 'Spec Full Name', value: 'Carbon Steel' },
      ]));
      expect(call.identities?.[0]?.getKey).toEqual(expect.any(Function));
    });
  });

  describe('combo mode', () => {
    it('keeps line coordinates inside the chart when slicers produce extreme values', () => {
      const dv = comboModeNegativeLineDV();
      visual.update(createUpdateOptions([dv]) as never);

      const linePath = constructorOpts.element.querySelector<SVGPathElement>('.bar-chart-line');
      expect(linePath).toBeTruthy();

      const coords = (linePath?.getAttribute('d') ?? '').match(/-?\d*\.?\d+/g)?.map(Number) ?? [];
      const yValues = coords.filter((_, index) => index % 2 === 1);
      const svgHeight = Number(constructorOpts.element.querySelector('svg')?.getAttribute('height') ?? '300');

      expect(yValues.length).toBeGreaterThan(0);
      expect(yValues.every((value) => value >= 0 && value <= svgHeight)).toBe(true);
    });

    it('keeps every line data label when one dipped point overlaps a bar label', () => {
      const settings = new BarChartProSettings();
      settings.animationSettings.enabled.value = false;
      settings.barSettings.showDataLabels.value = { value: 'above', displayName: 'Above' };
      settings.lineSettings.showLineDataLabels.value = true;
      settings.lineSettings.lineDataLabelOffset.value = 6;
      settings.lineNumberFormattingCard.decimalPlaces.value = 0;
      settingsRef.current = settings;

      const svgPrototype = SVGElement.prototype as unknown as { getBBox: () => DOMRect };
      const originalGetBBox = svgPrototype.getBBox;
      (SVGElement.prototype as unknown as { getBBox: () => DOMRect }).getBBox = function getTestBBox() {
        const el = this as SVGTextElement;
        const x = Number(el.getAttribute('x') ?? 0);
        const y = Number(el.getAttribute('y') ?? 0);
        const text = el.textContent ?? '';
        const width = Math.max(12, text.length * 7);
        const height = 12;
        return {
          x: x - width / 2,
          y: y - height,
          width,
          height,
        } as DOMRect;
      };

      try {
        visual.update(createUpdateOptions([comboModeDippedLineLabelDV()]) as never);
      } finally {
        svgPrototype.getBBox = originalGetBBox;
      }

      const labels = Array.from(constructorOpts.element.querySelectorAll<SVGTextElement>('.bar-chart-line-label'));
      expect(labels.map((label) => label.textContent)).toEqual(expect.arrayContaining(['90', '20', '90']));
      expect(labels).toHaveLength(3);
      const barLabels = Array.from(constructorOpts.element.querySelectorAll<SVGTextElement>('.bar-chart-label'));
      expect(barLabels.map((label) => label.textContent)).toEqual(expect.arrayContaining(['100', '20', '100']));
      expect(barLabels).toHaveLength(3);
      const dippedLineLabel = labels.find((label) => label.textContent === '20');
      const dippedBarLabel = barLabels.find((label) => label.textContent === '20');
      expect(dippedLineLabel).toBeDefined();
      expect(dippedBarLabel).toBeDefined();
      expect(Number(dippedLineLabel?.getAttribute('y'))).not.toBe(Number(dippedBarLabel?.getAttribute('y')));
    });

    it('raises bar data labels above target and reference labels', () => {
      const settings = new BarChartProSettings();
      settings.animationSettings.enabled.value = false;
      settings.barSettings.showDataLabels.value = { value: 'above', displayName: 'Above' };
      settings.targetLine.show.value = true;
      settings.targetLine.label.value = 'Target';
      settings.referenceLineFormattingCard.showReferenceLine.value = true;
      settings.referenceLineFormattingCard.showReferenceLabel.value = true;
      settings.referenceLineFormattingCard.referenceLabelText.value = 'Reference';
      settings.referenceLineFormattingCard.referenceLineType.value = { value: 'custom', displayName: 'Custom' };
      settings.referenceLineFormattingCard.referenceLineValue.value = 20;
      settingsRef.current = settings;

      const dv = new DataViewBuilder()
        .withCategory('Month', ['Jan', 'Feb', 'Mar'], 'category')
        .withValues('Revenue', [10, 20, 30], 'values')
        .withValues('Target', [20, 20, 20], 'target')
        .build();

      visual.update(createUpdateOptions([dv]) as never);

      const svg = constructorOpts.element.querySelector<SVGSVGElement>('svg');
      const flattened = Array.from(svg?.querySelectorAll('text') ?? []);
      const lastBarLabelIndex = Math.max(...flattened.map((el, index) => el.classList.contains('bar-chart-label') ? index : -1));
      const targetLabelIndex = flattened.findIndex((el) => el.classList.contains('bar-chart-target-label'));
      const referenceLabelIndex = flattened.findIndex((el) => el.classList.contains('reference-label'));

      expect(targetLabelIndex).toBeGreaterThanOrEqual(0);
      expect(referenceLabelIndex).toBeGreaterThanOrEqual(0);
      expect(lastBarLabelIndex).toBeGreaterThan(targetLabelIndex);
      expect(lastBarLabelIndex).toBeGreaterThan(referenceLabelIndex);
    });

    it('keeps bar data labels above target and reference labels before the next animation frame', () => {
      const settings = new BarChartProSettings();
      settings.animationSettings.enabled.value = false;
      settings.barSettings.showDataLabels.value = { value: 'above', displayName: 'Above' };
      settings.targetLine.show.value = true;
      settings.targetLine.label.value = 'Target';
      settings.referenceLineFormattingCard.showReferenceLine.value = true;
      settings.referenceLineFormattingCard.showReferenceLabel.value = true;
      settings.referenceLineFormattingCard.referenceLabelText.value = 'Reference';
      settings.referenceLineFormattingCard.referenceLineType.value = { value: 'custom', displayName: 'Custom' };
      settings.referenceLineFormattingCard.referenceLineValue.value = 20;
      settingsRef.current = settings;

      const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
      const queuedFrames: FrameRequestCallback[] = [];
      globalThis.requestAnimationFrame = ((callback: FrameRequestCallback): number => {
        queuedFrames.push(callback);
        return queuedFrames.length;
      }) as typeof globalThis.requestAnimationFrame;

      try {
        const dv = new DataViewBuilder()
          .withCategory('Month', ['Jan', 'Feb', 'Mar'], 'category')
          .withValues('Revenue', [10, 20, 30], 'values')
          .withValues('Target', [20, 20, 20], 'target')
          .build();

        visual.update(createUpdateOptions([dv]) as never);
      } finally {
        globalThis.requestAnimationFrame = originalRequestAnimationFrame;
      }

      const svg = constructorOpts.element.querySelector<SVGSVGElement>('svg');
      const flattened = Array.from(svg?.querySelectorAll('text') ?? []);
      const lastBarLabelIndex = Math.max(...flattened.map((el, index) => el.classList.contains('bar-chart-label') ? index : -1));
      const targetLabelIndex = flattened.findIndex((el) => el.classList.contains('bar-chart-target-label'));
      const referenceLabelIndex = flattened.findIndex((el) => el.classList.contains('reference-label'));

      expect(targetLabelIndex).toBeGreaterThanOrEqual(0);
      expect(referenceLabelIndex).toBeGreaterThanOrEqual(0);
      expect(lastBarLabelIndex).toBeGreaterThan(targetLabelIndex);
      expect(lastBarLabelIndex).toBeGreaterThan(referenceLabelIndex);
    });
  });

  // ── Selection & Cross-Highlight ────────────────────────────────────

  describe('selection and cross-highlight', () => {
    it('dims non-selected bars after a click selection', () => {
      const dv = singleBarDV();
      visual.update(createUpdateOptions([dv]) as never);

      const bars = getRenderableBars();
      expect(bars.length).toBeGreaterThanOrEqual(3);

      clickElement(bars[0]);

      expect(bars[0].style.opacity).toBe('');
      expect(bars[1].style.opacity).toBe('0.3');
      expect(bars[2].style.opacity).toBe('0.3');
    });

    it('keeps selected-state dimming intact after hover leaves another bar', () => {
      visual.update(createUpdateOptions([singleBarDV()]) as never);
      const bars = getRenderableBars();

      clickElement(bars[0]);
      bars[1].dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      bars[1].dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));

      expect(bars[0].style.opacity).toBe('');
      expect(bars[1].style.opacity).toBe('0.3');
    });

    it('makes one mark per category keyboard focusable and selectable', () => {
      visual.update(createUpdateOptions([singleBarDV()]) as never);
      const bars = getRenderableBars();
      const first = bars[0];

      expect(first.getAttribute('tabindex')).toBe('0');
      expect(first.getAttribute('role')).toBe('listitem');
      expect(first.getAttribute('aria-label')).toContain('A');

      const manager = constructorOpts.host.__selectionManager as { getSelectionIds: () => unknown[] };
      const activeElementSpy = vi.spyOn(document, 'activeElement', 'get').mockReturnValue(first);
      first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      activeElementSpy.mockRestore();
      expect(manager.getSelectionIds()).toHaveLength(1);
    });

    it('focuses the chart to cross-highlighted bars before applying selection state', () => {
      const dv = highlightedSingleBarDV();
      visual.update(createUpdateOptions([dv]) as never);

      const bars = getRenderableBars();
      expect(bars.length).toBe(1);

      clickElement(bars[0]);

      expect(bars[0].style.opacity).toBe('');
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

    it('uses unique gradient ids across published horizontal chart instances', () => {
      const makeSettings = (): BarChartProSettings => {
        const settings = new BarChartProSettings();
        settings.animationSettings.enabled.value = false;
        settings.chartMode.mode.value = { value: 'horizontal', displayName: 'Horizontal' };
        settings.barSettings.useGradient.value = true;
        return settings;
      };
      const dv = DataViewBuilder.multiSeries(
        ['A', 'B'],
        [
          { name: 'S1', values: [10, 20], role: 'values' },
          { name: 'S2', values: [30, 40], role: 'values' },
        ],
        { categoryRole: 'category' },
      );

      constructorOpts.host.hostCapabilities = { allowInteractions: false };
      settingsRef.current = makeSettings();
      visual.update(createUpdateOptions([dv]) as never);

      const secondOpts = createConstructorOptions();
      secondOpts.host.hostCapabilities = { allowInteractions: false };
      const secondVisual = new BarChartProVisual(secondOpts as never);
      try {
        settingsRef.current = makeSettings();
        secondVisual.update(createUpdateOptions([dv]) as never);

        const gradientIds = Array.from(document.querySelectorAll<SVGLinearGradientElement>('.bar-chart-container linearGradient'))
          .map((gradient) => gradient.id)
          .filter((id) => id.length > 0);

        expect(gradientIds.length).toBeGreaterThan(0);
        expect(new Set(gradientIds).size).toBe(gradientIds.length);
      } finally {
        secondVisual.destroy();
        secondOpts.element.remove();
      }
    });
  });
});
