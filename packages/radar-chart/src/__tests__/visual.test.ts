import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RadarChartVisual } from '../visual';
import { RadarChartSettings } from '../settings';
import {
  createConstructorOptions,
  createUpdateOptions,
  DataViewBuilder,
} from '../../../core/src/__test-utils__';

const settingsRef: { current: unknown } = { current: undefined };

vi.mock('../../style/visual.less', () => ({}));

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

let visual: RadarChartVisual;
let constructorOpts: ReturnType<typeof createConstructorOptions>;

function getSelectionManager() {
  return (constructorOpts.host as Record<string, unknown>).__selectionManager as {
    getSelectionIds: () => unknown[];
  };
}

beforeEach(() => {
  settingsRef.current = undefined;
  constructorOpts = createConstructorOptions();
  visual = new RadarChartVisual(constructorOpts as never);
});

afterEach(() => {
  visual.destroy();
  constructorOpts.element.remove();
});

describe('RadarChartVisual', () => {
  it('constructs without error', () => {
    expect(visual).toBeDefined();
  });

  it('handles empty data', () => {
    const dv = DataViewBuilder.empty();
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('renders sample data', () => {
    const dv = DataViewBuilder.singleCategoryMeasure(['A','B','C','D','E'], [80,65,90,70,85], { categoryRole: 'category', valueRole: 'measure' });
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('distinguishes filtered-empty data from an incomplete field setup', () => {
    const dv = new DataViewBuilder()
      .withCategory('Category', [], 'category')
      .withValues('Measure', [], 'measure')
      .build();

    visual.update(createUpdateOptions([dv]) as never);

    expect(constructorOpts.element.querySelector('.radar-empty')?.textContent)
      .toBe('No data for the current selection.');
  });

  it('explains when the selection has too few categories for radar geometry', () => {
    const dv = DataViewBuilder.singleCategoryMeasure(
      ['A', 'B'],
      [10, 20],
      { categoryRole: 'category', valueRole: 'measure' },
    );

    visual.update(createUpdateOptions([dv]) as never);

    expect(constructorOpts.element.querySelector('.radar-empty')?.textContent)
      .toContain('at least 3 categories');
  });

  it('clamps negative values to the chart center', () => {
    const dv = DataViewBuilder.singleCategoryMeasure(
      ['A', 'B', 'C'],
      [-10, 20, 30],
      { categoryRole: 'category', valueRole: 'measure' },
    );

    visual.update(createUpdateOptions([dv]) as never);

    const data = (visual as unknown as {
      currentData: { series: Array<{ values: number[] }> };
    }).currentData;
    expect(data.series[0].values).toEqual([0, 20, 30]);
  });

  it('keeps original row identities after date filtering', () => {
    const host = constructorOpts.host as Record<string, unknown>;
    host.createSelectionIdBuilder = () => {
      let rowIndex = -1;
      const builder: Record<string, unknown> = {};
      builder.withCategory = (_column: unknown, index: number) => {
        rowIndex = index;
        return builder;
      };
      builder.createSelectionId = () => ({
        equals: () => false,
        includes: () => false,
        getKey: () => `row-${rowIndex}`,
        getSelector: () => ({}),
        getSelectorsByColumn: () => ({}),
        hasIdentity: () => true,
      });
      return builder;
    };
    const settings = new RadarChartSettings();
    settings.animationSettings.enabled.value = false;
    settings.dateFilterFormattingCard.enableDateFilter.value = true;
    settings.dateFilterFormattingCard.startDate.value = '2024-01-02';
    settings.dateFilterFormattingCard.endAtCurrentDate.value = false;
    settings.dateFilterFormattingCard.endDate.value = '2024-01-04';
    settingsRef.current = settings;
    const dv = new DataViewBuilder()
      .withCategory('Date', [
        new Date(2024, 0, 1),
        new Date(2024, 0, 2),
        new Date(2024, 0, 3),
        new Date(2024, 0, 4),
        new Date(2024, 0, 5),
      ], 'category')
      .withValues('Measure', [1, 2, 3, 4, 5], 'measure')
      .build();
    (dv.categorical!.categories![0].source.type as Record<string, boolean>).dateTime = true;

    visual.update(createUpdateOptions([dv]) as never);

    const data = (visual as unknown as {
      currentData: { categorySelectionIds: Array<{ getKey: () => string }> };
    }).currentData;
    expect(data.categorySelectionIds.map((selectionId) => selectionId.getKey()))
      .toEqual(['row-1', 'row-2', 'row-3']);
  });

  it('uses axis wedges as accessible focus targets even when dots are hidden', () => {
    const settings = new RadarChartSettings();
    settings.animationSettings.enabled.value = false;
    settings.radarAppearance.showDots.value = false;
    settingsRef.current = settings;
    const dv = DataViewBuilder.singleCategoryMeasure(
      ['A', 'B', 'C'],
      [10, 20, 30],
      { categoryRole: 'category', valueRole: 'measure' },
    );

    visual.update(createUpdateOptions([dv]) as never);

    expect(constructorOpts.element.querySelectorAll('.radar-dot')).toHaveLength(0);
    const focusTargets = constructorOpts.element.querySelectorAll<SVGPathElement>(
      '.radar-axis-hit-area[tabindex="0"]',
    );
    expect(focusTargets).toHaveLength(3);
    expect(focusTargets[0].getAttribute('aria-label')).toContain('A');
  });

  it('does not select categories when host interactions are disabled', () => {
    (constructorOpts.host.hostCapabilities as { allowInteractions: boolean }).allowInteractions = false;
    const selectionManager = constructorOpts.host.__selectionManager as Record<string, unknown>;
    const select = vi.fn(() => Promise.resolve([]));
    selectionManager.select = select;
    const dv = DataViewBuilder.singleCategoryMeasure(
      ['A', 'B', 'C'],
      [10, 20, 30],
      { categoryRole: 'category', valueRole: 'measure' },
    );

    visual.update(createUpdateOptions([dv]) as never);
    const hitArea = constructorOpts.element.querySelector<SVGPathElement>('.radar-axis-hit-area');
    hitArea?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(select).not.toHaveBeenCalled();
    expect(hitArea?.style.cursor).toBe('default');
  });

  it('does not reserve or expose legend controls for a single series', () => {
    const dv = DataViewBuilder.singleCategoryMeasure(
      ['A', 'B', 'C'],
      [10, 20, 30],
      { categoryRole: 'category', valueRole: 'measure' },
    );

    visual.update(createUpdateOptions([dv]) as never);

    const settings = (visual as unknown as { settings: RadarChartSettings }).settings;
    expect(settings.legendFormattingCard.visible).toBe(false);
    expect(constructorOpts.element.querySelector('.radar-legend')).toBeNull();
  });

  it('leaves card radius unset when card style is None', () => {
    const settings = new RadarChartSettings();
    settings.animationSettings.enabled.value = false;
    settings.cardSettings.cardStyleMode.value = { value: 'none', displayName: 'None' };
    settings.cardSettings.borderRadius.value = 24;
    settingsRef.current = settings;
    const dv = DataViewBuilder.singleCategoryMeasure(
      ['A', 'B', 'C'],
      [10, 20, 30],
      { categoryRole: 'category', valueRole: 'measure' },
    );

    visual.update(createUpdateOptions([dv]) as never);

    expect(constructorOpts.element.style.borderRadius).toBe('');
  });

  it('uses host high-contrast colors for labels and series geometry', () => {
    const palette = constructorOpts.host.colorPalette as {
      isHighContrast: boolean;
      foreground: { value: string };
      foregroundSelected: { value: string };
      background: { value: string };
    };
    palette.isHighContrast = true;
    palette.foreground = { value: '#FFFF00' };
    palette.foregroundSelected = { value: '#00FFFF' };
    palette.background = { value: '#000000' };
    const dv = DataViewBuilder.singleCategoryMeasure(
      ['A', 'B', 'C'],
      [10, 20, 30],
      { categoryRole: 'category', valueRole: 'measure' },
    );

    visual.update(createUpdateOptions([dv]) as never);

    expect(constructorOpts.element.querySelector('.radar-axis-label')?.getAttribute('fill')).toBe('#FFFF00');
    expect(constructorOpts.element.querySelector('.radar-polygon')?.getAttribute('fill')).toBe('#00FFFF');
  });

  it('returns formatting model', () => {
    const dv = DataViewBuilder.singleCategoryMeasure(['A','B','C','D','E'], [80,65,90,70,85], { categoryRole: 'category', valueRole: 'measure' });
    visual.update(createUpdateOptions([dv]) as never);
    const model = visual.getFormattingModel();
    expect(model).toBeDefined();
  });

  it('re-renders without error', () => {
    const dv = DataViewBuilder.singleCategoryMeasure(['A','B','C','D','E'], [80,65,90,70,85], { categoryRole: 'category', valueRole: 'measure' });
    visual.update(createUpdateOptions([dv]) as never);
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('migrates legacy radar appearance properties when new values are absent', () => {
    const settings = new RadarChartSettings();
    settingsRef.current = settings;
    const dv = new DataViewBuilder()
      .withCategory('Category', ['A', 'B', 'C'], 'category')
      .withValues('Measure', [10, 20, 30], 'measure')
      .withMetadataObjects({ radarSettings: { dotRadius: 9, areaOpacity: 62 } })
      .build();

    visual.update(createUpdateOptions([dv]) as never);

    expect(settings.radarAppearance.dotRadius.value).toBe(9);
    expect(settings.radarAppearance.areaOpacity.value).toBe(62);
  });

  it('keeps new radar appearance values ahead of legacy properties', () => {
    const settings = new RadarChartSettings();
    settings.radarAppearance.dotRadius.value = 7;
    settings.radarAppearance.areaOpacity.value = 80;
    settingsRef.current = settings;
    const dv = new DataViewBuilder()
      .withCategory('Category', ['A', 'B', 'C'], 'category')
      .withValues('Measure', [10, 20, 30], 'measure')
      .withMetadataObjects({
        radarSettings: { dotRadius: 9, areaOpacity: 62 },
        radarAppearance: { dotRadius: 7, areaOpacity: 80 },
      })
      .build();

    visual.update(createUpdateOptions([dv]) as never);

    expect(settings.radarAppearance.dotRadius.value).toBe(7);
    expect(settings.radarAppearance.areaOpacity.value).toBe(80);
  });

  it('hides only card surface controls when card styling is disabled', () => {
    const settings = new RadarChartSettings();
    settings.cardSettings.cardStyleMode.value = { value: 'none', displayName: 'None' };
    settingsRef.current = settings;
    const dv = DataViewBuilder.singleCategoryMeasure(
      ['A', 'B', 'C'],
      [10, 20, 30],
      { categoryRole: 'category', valueRole: 'measure' },
    );

    visual.update(createUpdateOptions([dv]) as never);

    expect(settings.cardSettings.backgroundColor.visible).toBe(false);
    expect(settings.cardSettings.backgroundOpacity.visible).toBe(false);
    expect(settings.cardSettings.borderRadius.visible).toBe(false);
    expect(settings.cardSettings.contentPadding.visible).not.toBe(false);
  });

  it('selects a category when a polygon is clicked', () => {
    const dv = DataViewBuilder.singleCategoryMeasure(['A','B','C','D','E'], [80,65,90,70,85], { categoryRole: 'category', valueRole: 'measure' });
    visual.update(createUpdateOptions([dv]) as never);

    const polygon = constructorOpts.element.querySelector<SVGPathElement>('.radar-polygon');
    expect(polygon).not.toBeNull();

    polygon!.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX: 100,
      clientY: 20,
    }));

    expect(getSelectionManager().getSelectionIds()).toHaveLength(1);
  });

  it('selects a category when an axis label is clicked', () => {
    const dv = DataViewBuilder.singleCategoryMeasure(['A','B','C','D','E'], [80,65,90,70,85], { categoryRole: 'category', valueRole: 'measure' });
    visual.update(createUpdateOptions([dv]) as never);

    const axisLabel = constructorOpts.element.querySelector<SVGTextElement>('.radar-axis-label');
    expect(axisLabel).not.toBeNull();

    axisLabel!.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    }));

    expect(getSelectionManager().getSelectionIds()).toHaveLength(1);
  });

  it('automatically removes overlapping axis labels for crowded category sets', () => {
    const categories = Array.from({ length: 28 }, (_, index) => `Long Category ${index + 1}`);
    const values = categories.map((_, index) => 40 + index);
    const dv = DataViewBuilder.singleCategoryMeasure(categories, values, { categoryRole: 'category', valueRole: 'measure' });

    visual.update(createUpdateOptions([dv], { width: 420, height: 420 }) as never);

    const labels = Array.from(constructorOpts.element.querySelectorAll<SVGTextElement>('.radar-axis-label'));
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.length).toBeLessThan(categories.length);

    const boxes = labels.map((label) => {
      const x = Number(label.getAttribute('x') ?? 0);
      const y = Number(label.getAttribute('y') ?? 0);
      const anchor = label.getAttribute('text-anchor') ?? 'start';
      const fontSize = Number.parseFloat(label.style.fontSize || '11') || 11;
      const width = Math.max(fontSize, (label.textContent ?? '').length * fontSize * 0.58);
      const height = fontSize * 1.2;
      const left = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x;
      return {
        left: left - 4,
        right: left + width + 4,
        top: y - height / 2 - 4,
        bottom: y + height / 2 + 4,
      };
    });

    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const overlaps = boxes[i].left < boxes[j].right &&
          boxes[i].right > boxes[j].left &&
          boxes[i].top < boxes[j].bottom &&
          boxes[i].bottom > boxes[j].top;
        expect(overlaps).toBe(false);
      }
    }
  });

  it('keeps every compact axis label visible in a small viewport', () => {
    const categories = Array.from({ length: 28 }, (_, index) => `C${index + 1}`);
    const values = categories.map((_, index) => 50 + index);
    const settings = new RadarChartSettings();
    settings.animationSettings.enabled.value = false;
    settings.cardSettings.contentPadding.value = 8;
    settings.axisFormattingCard.axisLabelSize.value = 5;
    settings.radarSettings.axisLabelCollisionHandling.value = { value: 'auto', displayName: 'Auto' };
    settingsRef.current = settings;

    visual.update(createUpdateOptions([
      DataViewBuilder.singleCategoryMeasure(categories, values, { categoryRole: 'category', valueRole: 'measure' }),
    ], { width: 220, height: 220 }) as never);

    const labels = Array.from(constructorOpts.element.querySelectorAll<SVGTextElement>('.radar-axis-label'));
    expect(labels).toHaveLength(categories.length);
    expect(labels.every((label) => label.style.fontSize === '5px')).toBe(true);
    for (const label of labels) {
      const x = 110 + Number(label.getAttribute('x'));
      const y = 110 + Number(label.getAttribute('y'));
      const anchor = label.getAttribute('text-anchor') ?? 'middle';
      const width = Math.max(5, (label.textContent ?? '').length * 5 * 0.58);
      const height = 5 * 1.2;
      const left = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x;
      expect(left).toBeGreaterThanOrEqual(0);
      expect(left + width).toBeLessThanOrEqual(220);
      expect(y - height / 2).toBeGreaterThanOrEqual(0);
      expect(y + height / 2).toBeLessThanOrEqual(220);
    }
  });
});
