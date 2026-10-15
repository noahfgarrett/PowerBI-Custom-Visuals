import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BoxPlotVisual } from '../visual';
import { BoxPlotSettings } from '../settings';
import {
  createConstructorOptions,
  createUpdateOptions,
  DataViewBuilder,
} from '../../../core/src/__test-utils__';

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
      SortFormattingCard: class {
        sortBy = {
          name: 'sortBy',
          displayName: 'Sort By',
          value: { value: 'dataOrder', displayName: 'Data Order' },
          items: [
            { value: 'dataOrder', displayName: 'Data Order' },
            { value: 'valueAsc', displayName: 'Value (Ascending)' },
            { value: 'valueDesc', displayName: 'Value (Descending)' },
            { value: 'nameAsc', displayName: 'Name (A-Z)' },
            { value: 'nameDesc', displayName: 'Name (Z-A)' },
          ],
        };
        name = 'sortFormatting';
        displayName = 'Sort Order';
        slices = [this.sortBy];
      },
    },
    FormattingSettingsService: class {
      populateFormattingSettingsModel(ModelClass: new () => unknown, _dv: unknown) { return new ModelClass(); }
      buildFormattingModel(settings: { cards: unknown[] }) { return { cards: settings.cards?.map((c: unknown) => ({ displayName: (c as Record<string, unknown>)['displayName'], name: (c as Record<string, unknown>)['name'] })) ?? [] }; }
    },
  };
});

let visual: BoxPlotVisual;
let constructorOpts: ReturnType<typeof createConstructorOptions>;

beforeEach(() => {
  constructorOpts = createConstructorOptions();
  visual = new BoxPlotVisual(constructorOpts as never);
});

afterEach(() => {
  visual.destroy();
  constructorOpts.element.remove();
});

describe('BoxPlotVisual', () => {
  it('constructs without error', () => {
    expect(visual).toBeDefined();
  });

  it('handles empty data', () => {
    const dv = DataViewBuilder.empty();
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('renders sample data', () => {
    const dv = DataViewBuilder.singleCategoryMeasure(['A','B','C'], [10,20,30], { categoryRole: 'category', valueRole: 'values' });
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('opens the empty-space context menu', () => {
    const dv = DataViewBuilder.singleCategoryMeasure(['A','B','C'], [10,20,30], { categoryRole: 'category', valueRole: 'values' });
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

  it('reports rendering lifecycle events', () => {
    const eventService = constructorOpts.host.eventService as {
      renderingStarted: (...args: unknown[]) => unknown;
      renderingFinished: (...args: unknown[]) => unknown;
      renderingFailed: (...args: unknown[]) => unknown;
    };
    const startedSpy = vi.spyOn(eventService, 'renderingStarted');
    const finishedSpy = vi.spyOn(eventService, 'renderingFinished');
    const failedSpy = vi.spyOn(eventService, 'renderingFailed');
    const dv = DataViewBuilder.singleCategoryMeasure(['A','B'], [10,20], { categoryRole: 'category', valueRole: 'values' });
    const updateOptions = createUpdateOptions([dv]) as never;

    visual.update(updateOptions);

    expect(startedSpy).toHaveBeenCalledWith(updateOptions);
    expect(finishedSpy).toHaveBeenCalledWith(updateOptions);
    expect(failedSpy).not.toHaveBeenCalled();
  });

  it('makes each box keyboard focusable and activates category selection', () => {
    const dv = DataViewBuilder.singleCategoryMeasure(['A','B'], [10,20], { categoryRole: 'category', valueRole: 'values' });
    visual.update(createUpdateOptions([dv]) as never);

    const box = constructorOpts.element.querySelector<SVGRectElement>('.box-plot-box');
    expect(box?.getAttribute('tabindex')).toBe('0');
    expect(box?.getAttribute('role')).toBe('listitem');
    expect(box?.getAttribute('aria-label')).toContain('Median 10');

    const manager = constructorOpts.host.__selectionManager as { getSelectionIds: () => unknown[] };
    const activeElementSpy = vi.spyOn(document, 'activeElement', 'get').mockReturnValue(box!);
    box?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    activeElementSpy.mockRestore();
    expect(manager.getSelectionIds()).toHaveLength(1);
  });

  it('dims every glyph in non-selected categories', () => {
    const dv = DataViewBuilder.singleCategoryMeasure(['A','B'], [10,20], { categoryRole: 'category', valueRole: 'values' });
    visual.update(createUpdateOptions([dv]) as never);

    const boxes = Array.from(constructorOpts.element.querySelectorAll<SVGRectElement>('.box-plot-box'));
    const groups = Array.from(constructorOpts.element.querySelectorAll<SVGGElement>('.box-plot-category'));
    boxes[0].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(groups[0].style.opacity).toBe('');
    expect(groups[1].style.opacity).toBe('0.3');
    expect(groups[1].querySelector('.box-plot-whisker')).not.toBeNull();
  });

  it('restores persisted per-category styles into dynamic formatting groups', () => {
    const dv = DataViewBuilder.singleCategoryMeasure(['A','B'], [10,20], { categoryRole: 'category', valueRole: 'values' }) as {
      categorical?: {
        categories?: Array<{ objects?: Array<Record<string, Record<string, unknown>>> }>;
      };
    };
    const category = dv.categorical?.categories?.[0];
    if (category) {
      category.objects = [
        {
          seriesFormatting: {
            seriesColor: { solid: { color: '#123456' } },
            seriesOpacity: 45,
            showDataLabels: false,
          },
        },
        {},
      ];
    }

    visual.update(createUpdateOptions([dv as never]) as never);

    const settings = (visual as unknown as {
      settings: {
        seriesFormattingCard: {
          groups: Array<{
            seriesColor: { value: { value: string } };
            seriesOpacity: { value: number };
            showDataLabels: { value: boolean };
            slices: Array<{ selector?: unknown }>;
          }>;
        };
      };
    }).settings;
    const firstGroup = settings.seriesFormattingCard.groups[0];
    expect(firstGroup.seriesColor.value.value).toBe('#123456');
    expect(firstGroup.seriesOpacity.value).toBe(45);
    expect(firstGroup.showDataLabels.value).toBe(false);
    expect(firstGroup.slices.every((slice) => slice.selector !== undefined)).toBe(true);
  });

  it('respects allowInteractions=false for marks and empty space', () => {
    (constructorOpts.host.hostCapabilities as { allowInteractions: boolean }).allowInteractions = false;
    const dv = DataViewBuilder.singleCategoryMeasure(['A','B'], [10,20], { categoryRole: 'category', valueRole: 'values' });
    visual.update(createUpdateOptions([dv]) as never);

    const manager = constructorOpts.host.__selectionManager as {
      select: (...args: unknown[]) => unknown;
      clear: (...args: unknown[]) => unknown;
      showContextMenu: (...args: unknown[]) => unknown;
    };
    const selectSpy = vi.spyOn(manager, 'select');
    const clearSpy = vi.spyOn(manager, 'clear');
    const contextSpy = vi.spyOn(manager, 'showContextMenu');
    const box = constructorOpts.element.querySelector<SVGRectElement>('.box-plot-box');
    expect(box?.style.cursor).toBe('default');

    box?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    box?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    constructorOpts.element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    constructorOpts.element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));

    expect(selectSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
    expect(contextSpy).not.toHaveBeenCalled();
  });

  it('uses host high-contrast colors for boxes and text', () => {
    const palette = constructorOpts.host.colorPalette as {
      isHighContrast: boolean;
      foreground: { value: string };
      background: { value: string };
    };
    palette.isHighContrast = true;
    palette.foreground = { value: '#111111' };
    palette.background = { value: '#fefefe' };
    const dv = DataViewBuilder.singleCategoryMeasure(['A','B'], [10,20], { categoryRole: 'category', valueRole: 'values' });

    visual.update(createUpdateOptions([dv]) as never);

    const box = constructorOpts.element.querySelector<SVGRectElement>('.box-plot-box');
    expect(box?.getAttribute('fill')).toBe('#fefefe');
    expect(box?.getAttribute('stroke')).toBe('#111111');
    expect(constructorOpts.element.querySelector('.box-plot-axis text')?.getAttribute('fill')).toBe('#111111');
  });

  it('sorts categories by configured sort order', () => {
    const dv = DataViewBuilder.singleCategoryMeasure(['C','A','B'], [30,10,20], { categoryRole: 'category', valueRole: 'values' });
    const settings = new BoxPlotSettings();
    settings.sortFormattingCard.sortBy.value = { value: 'nameAsc', displayName: 'Name (A-Z)' };
    (visual as unknown as { formattingSettingsService: { populateFormattingSettingsModel: () => BoxPlotSettings } }).formattingSettingsService.populateFormattingSettingsModel = () => settings;

    visual.update(createUpdateOptions([dv]) as never);

    const tickLabels = Array.from(constructorOpts.element.querySelectorAll('.box-plot-axis-x .tick text'))
      .map((node) => node.textContent?.trim())
      .filter((label): label is string => Boolean(label));

    expect(tickLabels).toEqual(['A', 'B', 'C']);
  });

  it('returns formatting model', () => {
    const dv = DataViewBuilder.singleCategoryMeasure(['A','B','C'], [10,20,30], { categoryRole: 'category', valueRole: 'values' });
    visual.update(createUpdateOptions([dv]) as never);
    const model = visual.getFormattingModel();
    expect(model).toBeDefined();
  });

  it('re-renders without error', () => {
    const dv = DataViewBuilder.singleCategoryMeasure(['A','B','C'], [10,20,30], { categoryRole: 'category', valueRole: 'values' });
    visual.update(createUpdateOptions([dv]) as never);
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });
});
