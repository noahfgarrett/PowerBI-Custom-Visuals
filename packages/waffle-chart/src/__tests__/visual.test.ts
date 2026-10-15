import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WaffleChartVisual } from '../visual';
import { WaffleChartSettings } from '../settings';
import {
  createConstructorOptions,
  createUpdateOptions,
  DataViewBuilder,
} from '../../../core/src/__test-utils__';

vi.mock('../../style/visual.less', () => ({}));

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

let visual: WaffleChartVisual;
let constructorOpts: ReturnType<typeof createConstructorOptions>;

beforeEach(() => {
  constructorOpts = createConstructorOptions();
  visual = new WaffleChartVisual(constructorOpts as never);
});

afterEach(() => {
  visual.destroy();
  constructorOpts.element.remove();
});

describe('WaffleChartVisual', () => {
  it('constructs without error', () => {
    expect(visual).toBeDefined();
  });

  it('handles empty data', () => {
    const dv = DataViewBuilder.empty();
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
    expect(constructorOpts.element.querySelector('.waffle-empty')?.textContent)
      .toContain('Add a value');
  });

  it('distinguishes bound no-data from the initial landing state', () => {
    const dv = DataViewBuilder.measuresOnly([{ name: 'Value', values: [null], role: 'measure' }]);

    visual.update(createUpdateOptions([dv]) as never);

    expect(constructorOpts.element.querySelector('.waffle-empty')?.textContent)
      .toContain('No data for the current selection');
  });

  it('renders sample data', () => {
    const dv = DataViewBuilder.measuresOnly([{name:'Value',values:[75],role:'measure'}]);
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('returns formatting model', () => {
    const dv = DataViewBuilder.measuresOnly([{name:'Value',values:[75],role:'measure'}]);
    visual.update(createUpdateOptions([dv]) as never);
    const model = visual.getFormattingModel();
    expect(model).toBeDefined();
  });

  it('re-renders without error', () => {
    const dv = DataViewBuilder.measuresOnly([{name:'Value',values:[75],role:'measure'}]);
    visual.update(createUpdateOptions([dv]) as never);
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('applies value spacing and hides irrelevant grid and card controls', () => {
    const settings = new WaffleChartSettings();
    settings.animationSettings.enabled.value = false;
    settings.valueSettings.valueSpacing.value = 14;
    settings.gridSettings.autoFitCells.value = true;
    settings.pictogramSettings.enabled.value = true;
    settings.cardSettings.cardStyleMode.value = { value: 'none', displayName: 'None' };
    settingsRef.current = settings;
    const dv = DataViewBuilder.measuresOnly([{name:'Value',values:[75],role:'measure'}]);
    visual.update(createUpdateOptions([dv]) as never);
    const wrapper = constructorOpts.element.querySelector<HTMLElement>('.waffle-grid')?.parentElement;
    expect(wrapper?.style.gap).toBe('14px');
    expect(settings.gridSettings.rows.visible).toBe(false);
    expect(settings.gridSettings.shape.visible).toBe(false);
    expect(settings.colorSettings.cellStrokeColor.visible).toBe(false);
    expect(settings.cardSettings.borderRadius.visible).toBe(false);
    expect(settings.cardSettings.contentPadding.visible).not.toBe(false);
  });

  it('does not let legacy glass override a persisted modern card style', () => {
    const settings = new WaffleChartSettings();
    settings.cardSettings.cardStyleMode.value = { value: 'elevated', displayName: 'Elevated' };
    settingsRef.current = settings;
    const dv = new DataViewBuilder().withValues('Value', [75], 'measure')
      .withMetadataObjects({ cardSettings: { enableGlass: false, cardStyleMode: 'elevated' } }).build();
    visual.update(createUpdateOptions([dv]) as never);
    expect(settings.cardSettings.cardStyleMode.value.value).toBe('elevated');
  });

  it('renders zero as valid data and supports value display modes', () => {
    const zeroSettings = new WaffleChartSettings();
    zeroSettings.animationSettings.enabled.value = false;
    zeroSettings.valueSettings.displayMode.value = { value: 'value', displayName: 'Actual Value' };
    settingsRef.current = zeroSettings;
    const zeroView = DataViewBuilder.measuresOnly([
      { name: 'Value', values: [0], role: 'measure' },
      { name: 'Maximum', values: [100], role: 'maxValue' },
    ]);

    visual.update(createUpdateOptions([zeroView]) as never);

    expect(constructorOpts.element.querySelector('.waffle-empty')).toBeNull();
    expect(constructorOpts.element.querySelector('.waffle-value')?.textContent).toBe('0');
    expect(constructorOpts.element.querySelectorAll('.waffle-cell')).toHaveLength(100);

    const maxSettings = new WaffleChartSettings();
    maxSettings.animationSettings.enabled.value = false;
    maxSettings.valueSettings.displayMode.value = { value: 'valueAndMax', displayName: 'Value and Maximum' };
    settingsRef.current = maxSettings;
    const valueView = DataViewBuilder.measuresOnly([
      { name: 'Value', values: [75], role: 'measure' },
      { name: 'Maximum', values: [150], role: 'maxValue' },
    ]);
    visual.update(createUpdateOptions([valueView]) as never);

    expect(constructorOpts.element.querySelector('.waffle-value')?.textContent).toBe('75 / 150');
  });

  it('renders a one-cell radial grid and clamps oversized grids', () => {
    const oneCellSettings = new WaffleChartSettings();
    oneCellSettings.animationSettings.enabled.value = false;
    oneCellSettings.gridSettings.autoFitCells.value = false;
    oneCellSettings.gridSettings.rows.value = 1;
    oneCellSettings.gridSettings.cols.value = 1;
    oneCellSettings.gridSettings.fillDirection.value = { value: 'radial', displayName: 'Radial' };
    settingsRef.current = oneCellSettings;
    const dv = DataViewBuilder.measuresOnly([{ name: 'Value', values: [50], role: 'measure' }]);

    expect(() => visual.update(createUpdateOptions([dv], { width: 40, height: 40 }) as never)).not.toThrow();
    expect(constructorOpts.element.querySelectorAll('.waffle-cell')).toHaveLength(1);

    const largeSettings = new WaffleChartSettings();
    largeSettings.animationSettings.enabled.value = false;
    largeSettings.gridSettings.autoFitCells.value = false;
    largeSettings.gridSettings.rows.value = 500;
    largeSettings.gridSettings.cols.value = 500;
    settingsRef.current = largeSettings;
    visual.update(createUpdateOptions([dv], { width: 40, height: 40 }) as never);

    expect(constructorOpts.element.querySelectorAll('.waffle-cell')).toHaveLength(2500);
    expect(constructorOpts.element.querySelector<HTMLElement>('.waffle-cell')?.style.width).toBe('1px');
  });

  it('exposes one semantic keyboard target and activates selection', async () => {
    const settings = new WaffleChartSettings();
    settings.animationSettings.enabled.value = false;
    settingsRef.current = settings;
    const dv = DataViewBuilder.measuresOnly([{ name: 'Value', values: [75], role: 'measure' }]);

    visual.update(createUpdateOptions([dv]) as never);
    const grid = constructorOpts.element.querySelector<HTMLElement>('.waffle-grid')!;
    expect(grid.getAttribute('role')).toBe('button');
    expect(grid.tabIndex).toBe(0);
    expect(constructorOpts.element.querySelectorAll('[tabindex="0"]')).toHaveLength(1);

    grid.focus();
    grid.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await Promise.resolve();

    const manager = constructorOpts.host.__selectionManager as {
      __selectionState: () => unknown[];
    };
    expect(manager.__selectionState()).toHaveLength(1);
  });

  it('honors disabled interactions and host high-contrast colors', () => {
    const host = constructorOpts.host as Record<string, unknown>;
    (host.hostCapabilities as { allowInteractions: boolean }).allowInteractions = false;
    const palette = host.colorPalette as Record<string, unknown>;
    palette.isHighContrast = true;
    palette.foreground = { value: '#FFFFFF' };
    palette.foregroundSelected = { value: '#FFFF00' };
    palette.background = { value: '#000000' };
    const settings = new WaffleChartSettings();
    settings.animationSettings.enabled.value = false;
    settingsRef.current = settings;
    const dv = DataViewBuilder.measuresOnly([{ name: 'Value', values: [75], role: 'measure' }]);

    visual.update(createUpdateOptions([dv]) as never);

    const grid = constructorOpts.element.querySelector<HTMLElement>('.waffle-grid')!;
    const cells = Array.from(constructorOpts.element.querySelectorAll<HTMLElement>('.waffle-cell'));
    const firstCell = cells[0];
    expect(grid.getAttribute('role')).toBe('group');
    expect(grid.tabIndex).toBe(-1);
    expect(cells.some((cell) => cell.style.backgroundColor === 'rgb(255, 255, 0)')).toBe(true);
    firstCell.click();
    const manager = host.__selectionManager as { __selectionState: () => unknown[] };
    expect(manager.__selectionState()).toHaveLength(0);
  });

  it('dims unmatched data when Power BI supplies all-null highlights', () => {
    const settings = new WaffleChartSettings();
    settings.animationSettings.enabled.value = false;
    settingsRef.current = settings;
    const dv = DataViewBuilder.measuresOnly([{ name: 'Value', values: [75], role: 'measure' }]);
    (dv.categorical!.values![0] as unknown as { highlights: Array<number | null> }).highlights = [null];

    visual.update(createUpdateOptions([dv]) as never);

    const dimmed = Array.from(constructorOpts.element.querySelectorAll<HTMLElement>('.waffle-cell'))
      .filter((cell) => cell.style.opacity === '0.3');
    expect(dimmed).toHaveLength(75);
  });

  it('provides selection identity for enhanced tooltips', () => {
    const tooltipService = constructorOpts.host.tooltipService as Record<string, ReturnType<typeof vi.fn>>;
    tooltipService.show = vi.fn();
    const settings = new WaffleChartSettings();
    settings.animationSettings.enabled.value = false;
    settingsRef.current = settings;
    const dv = DataViewBuilder.measuresOnly([{ name: 'Value', values: [75], role: 'measure' }]);

    visual.update(createUpdateOptions([dv]) as never);
    constructorOpts.element.querySelector<HTMLElement>('.waffle-grid')!
      .dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, clientX: 20, clientY: 30 }));

    expect(tooltipService.show).toHaveBeenCalledOnce();
    expect(tooltipService.show.mock.calls[0][0].identities).toHaveLength(1);
  });
});
