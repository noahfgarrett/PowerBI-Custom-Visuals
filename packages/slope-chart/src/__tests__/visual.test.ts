import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SlopeChartVisual } from '../visual';
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
    },
    FormattingSettingsService: class {
      populateFormattingSettingsModel(ModelClass: new () => unknown, _dv: unknown) { return new ModelClass(); }
      buildFormattingModel(settings: { cards: unknown[] }) { return { cards: settings.cards?.map((c: unknown) => ({ displayName: (c as Record<string, unknown>)['displayName'], name: (c as Record<string, unknown>)['name'] })) ?? [] }; }
    },
  };
});

let visual: SlopeChartVisual;
let constructorOpts: ReturnType<typeof createConstructorOptions>;

function getSelectionManager() {
  return (constructorOpts.host as Record<string, unknown>).__selectionManager as {
    getSelectionIds: () => unknown[];
  };
}

beforeEach(() => {
  constructorOpts = createConstructorOptions();
  visual = new SlopeChartVisual(constructorOpts as never);
});

afterEach(() => {
  visual.destroy();
  constructorOpts.element.remove();
});

describe('SlopeChartVisual', () => {
  it('constructs without error', () => {
    expect(visual).toBeDefined();
  });

  it('handles empty data', () => {
    const dv = DataViewBuilder.empty();
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('renders sample data', () => {
    const dv = new DataViewBuilder().withCategory('Item', ['A','B','C'], 'category').withValues('Start', [10,20,30], 'startMeasure').withValues('End', [15,18,35], 'endMeasure').build();
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('creates one persisted formatting group per category', () => {
    const dv = new DataViewBuilder().withCategory('Item', ['A','B','C'], 'category').withValues('Start', [10,20,30], 'startMeasure').withValues('End', [15,18,35], 'endMeasure').build();
    visual.update(createUpdateOptions([dv]) as never);

    const settings = (visual as unknown as { settings: { seriesFormattingCard: { groups: Array<{ displayName: string; lineWidth: { value: number } }> } } }).settings;
    expect(settings.seriesFormattingCard.groups.map((group) => group.displayName)).toEqual(['A', 'B', 'C']);
    expect(settings.seriesFormattingCard.groups.every((group) => group.lineWidth.value === 2)).toBe(true);
  });

  it('returns formatting model', () => {
    const dv = new DataViewBuilder().withCategory('Item', ['A','B','C'], 'category').withValues('Start', [10,20,30], 'startMeasure').withValues('End', [15,18,35], 'endMeasure').build();
    visual.update(createUpdateOptions([dv]) as never);
    const model = visual.getFormattingModel();
    expect(model).toBeDefined();
  });

  it('re-renders without error', () => {
    const dv = new DataViewBuilder().withCategory('Item', ['A','B','C'], 'category').withValues('Start', [10,20,30], 'startMeasure').withValues('End', [15,18,35], 'endMeasure').build();
    visual.update(createUpdateOptions([dv]) as never);
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('selects a series from the widened line hit area', () => {
    const dv = new DataViewBuilder().withCategory('Item', ['A','B','C'], 'category').withValues('Start', [10,20,30], 'startMeasure').withValues('End', [15,18,35], 'endMeasure').build();
    visual.update(createUpdateOptions([dv]) as never);

    const hitArea = constructorOpts.element.querySelector<SVGPathElement>('.slope-line-hit-area');
    expect(hitArea).not.toBeNull();

    hitArea!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(getSelectionManager().getSelectionIds()).toHaveLength(1);
  });

  it('keeps both selected and cross-highlighted series emphasized', () => {
    const dv = new DataViewBuilder().withCategory('Item', ['A','B','C'], 'category').withValues('Start', [10,20,30], 'startMeasure').withValues('End', [15,18,35], 'endMeasure').build();
    const values = dv.categorical?.values as unknown as Array<{ highlights?: Array<number | null> }>;
    values[0].highlights = [null, 20, null];
    visual.update(createUpdateOptions([dv]) as never);

    const selectedHitArea = constructorOpts.element.querySelector<SVGPathElement>('.slope-line-hit-area[data-series="0"]');
    selectedHitArea?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    const selectedSeries = constructorOpts.element.querySelectorAll<SVGElement>('[data-series="0"]');
    const highlightedSeries = constructorOpts.element.querySelectorAll<SVGElement>('[data-series="1"]');
    const dimmedSeries = constructorOpts.element.querySelectorAll<SVGElement>('[data-series="2"]');
    expect(Array.from(selectedSeries).every((element) => element.style.opacity === '')).toBe(true);
    expect(Array.from(highlightedSeries).every((element) => element.style.opacity === '')).toBe(true);
    expect(Array.from(dimmedSeries).every((element) => element.style.opacity === '0.3')).toBe(true);
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
    const dv = new DataViewBuilder().withCategory('Item', ['A','B'], 'category').withValues('Start', [10,20], 'startMeasure').withValues('End', [15,18], 'endMeasure').build();
    const updateOptions = createUpdateOptions([dv]) as never;

    visual.update(updateOptions);

    expect(startedSpy).toHaveBeenCalledWith(updateOptions);
    expect(finishedSpy).toHaveBeenCalledWith(updateOptions);
    expect(failedSpy).not.toHaveBeenCalled();
  });

  it('provides focusable, descriptive line hit areas with keyboard activation', () => {
    const dv = new DataViewBuilder().withCategory('Item', ['A','B'], 'category').withValues('Start', [10,20], 'startMeasure').withValues('End', [15,18], 'endMeasure').build();
    visual.update(createUpdateOptions([dv]) as never);

    const hitArea = constructorOpts.element.querySelector<SVGPathElement>('.slope-line-hit-area');
    expect(hitArea?.getAttribute('tabindex')).toBe('0');
    expect(hitArea?.getAttribute('role')).toBe('listitem');
    expect(hitArea?.getAttribute('aria-label')).toContain('Start 10');

    const activeElementSpy = vi.spyOn(document, 'activeElement', 'get').mockReturnValue(hitArea!);
    hitArea?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    activeElementSpy.mockRestore();
    expect(getSelectionManager().getSelectionIds()).toHaveLength(1);
  });

  it('respects allowInteractions=false for line and empty-space actions', () => {
    (constructorOpts.host.hostCapabilities as { allowInteractions: boolean }).allowInteractions = false;
    const dv = new DataViewBuilder().withCategory('Item', ['A','B'], 'category').withValues('Start', [10,20], 'startMeasure').withValues('End', [15,18], 'endMeasure').build();
    visual.update(createUpdateOptions([dv]) as never);

    const manager = constructorOpts.host.__selectionManager as {
      select: (...args: unknown[]) => unknown;
      clear: (...args: unknown[]) => unknown;
      showContextMenu: (...args: unknown[]) => unknown;
    };
    const selectSpy = vi.spyOn(manager, 'select');
    const clearSpy = vi.spyOn(manager, 'clear');
    const contextSpy = vi.spyOn(manager, 'showContextMenu');
    const hitArea = constructorOpts.element.querySelector<SVGPathElement>('.slope-line-hit-area');
    expect(hitArea?.style.cursor).toBe('default');

    hitArea?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    hitArea?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    constructorOpts.element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    constructorOpts.element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));

    expect(selectSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
    expect(contextSpy).not.toHaveBeenCalled();
  });

  it('uses host high-contrast colors for chart text and marks', () => {
    const palette = constructorOpts.host.colorPalette as {
      isHighContrast: boolean;
      foreground: { value: string };
      background: { value: string };
    };
    palette.isHighContrast = true;
    palette.foreground = { value: '#111111' };
    palette.background = { value: '#fefefe' };
    const dv = new DataViewBuilder().withCategory('Item', ['A','B'], 'category').withValues('Start', [10,20], 'startMeasure').withValues('End', [15,18], 'endMeasure').build();

    visual.update(createUpdateOptions([dv]) as never);

    expect(constructorOpts.element.querySelector('.slope-header')?.getAttribute('fill')).toBe('#111111');
    expect(constructorOpts.element.querySelector('.slope-line')?.getAttribute('stroke')).toBe('#111111');
    expect(constructorOpts.element.style.backgroundColor).toBe('rgb(254, 254, 254)');
  });
});
