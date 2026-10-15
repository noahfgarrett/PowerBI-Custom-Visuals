import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HeatmapCalendarVisual } from '../visual';
import { HeatmapCalendarSettings } from '../settings';
import {
  createConstructorOptions,
  createUpdateOptions,
  DataViewBuilder,
} from '../../../core/src/__test-utils__';

const settingsRef: { current: HeatmapCalendarSettings | undefined } = { current: undefined };

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

let visual: HeatmapCalendarVisual;
let constructorOpts: ReturnType<typeof createConstructorOptions>;

beforeEach(() => {
  settingsRef.current = undefined;
  constructorOpts = createConstructorOptions();
  visual = new HeatmapCalendarVisual(constructorOpts as never);
});

afterEach(() => {
  visual.destroy();
  constructorOpts.element.remove();
});

describe('HeatmapCalendarVisual', () => {
  it('constructs without error', () => {
    expect(visual).toBeDefined();
  });

  it('handles empty data', () => {
    const dv = DataViewBuilder.empty();
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('renders sample data', () => {
    const dv = new DataViewBuilder().withCategory('Date', ['2024-01-01','2024-01-02','2024-01-03'], 'date').withValues('Count', [5,10,3], 'measure').build();
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('renders a distinct no-data message when fields are bound but filtered empty', () => {
    const dv = new DataViewBuilder()
      .withCategory('Date', [], 'date')
      .withValues('Count', [], 'measure')
      .build();

    visual.update(createUpdateOptions([dv]) as never);

    expect(constructorOpts.element.querySelector('.heatmap-empty')?.textContent)
      .toBe('No data for the current selection.');
  });

  it('shows setup guidance when only the date field is bound', () => {
    const dv = new DataViewBuilder()
      .withCategory('Date', ['2024-01-01'], 'date')
      .build();

    visual.update(createUpdateOptions([dv]) as never);

    expect(constructorOpts.element.querySelector('.heatmap-empty')?.textContent)
      .toBe('Add a Date and Measure to get started.');
  });

  it('aggregates a week into one cell while retaining every contributing identity', async () => {
    const settings = new HeatmapCalendarSettings();
    settings.animationSettings.enabled.value = false;
    settings.calendarLayoutSettings.granularity.value = { value: 'week', displayName: 'Week' };
    settings.legendSettings.showLegend.value = false;
    settingsRef.current = settings;
    const tooltipShow = vi.fn();
    (constructorOpts.host.tooltipService as Record<string, unknown>).show = tooltipShow;
    const dv = new DataViewBuilder()
      .withCategory('Date', ['2024-01-01', '2024-01-02', '2024-01-03'], 'date')
      .withValues('Count', [1, 2, 3], 'measure')
      .build();

    visual.update(createUpdateOptions([dv]) as never);

    const dataCells = constructorOpts.element.querySelectorAll<HTMLElement>('.heatmap-cell[data-date-key]');
    expect(dataCells).toHaveLength(1);
    dataCells[0].dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect((tooltipShow.mock.calls[0][0] as { identities: unknown[] }).identities).toHaveLength(3);

    dataCells[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
    const selectionState = (constructorOpts.host.__selectionManager as {
      __selectionState: () => unknown[];
    }).__selectionState();
    expect(selectionState).toHaveLength(3);
  });

  it('fits cells to the available width when scrolling is disabled', () => {
    const settings = new HeatmapCalendarSettings();
    settings.animationSettings.enabled.value = false;
    settings.calendarLayoutSettings.cellSize.value = 20;
    settings.calendarLayoutSettings.enableScrolling.value = false;
    settings.legendSettings.showLegend.value = false;
    settingsRef.current = settings;
    const dv = new DataViewBuilder()
      .withCategory('Date', ['2024-01-01'], 'date')
      .withValues('Count', [1], 'measure')
      .build();

    visual.update(createUpdateOptions([dv], { width: 240, height: 300 }) as never);

    const cell = constructorOpts.element.querySelector<HTMLElement>('.heatmap-cell');
    expect(Number.parseFloat(cell?.style.width ?? '0')).toBeLessThan(20);
    expect(constructorOpts.element.style.overflowX).toBe('hidden');
  });

  it('keeps only real data cells in the keyboard tab order', () => {
    const dv = new DataViewBuilder()
      .withCategory('Date', ['2024-01-01', '2024-01-02'], 'date')
      .withValues('Count', [1, 2], 'measure')
      .build();

    visual.update(createUpdateOptions([dv]) as never);

    expect(constructorOpts.element.querySelectorAll('.heatmap-cell[data-date-key]')).toHaveLength(2);
    expect(constructorOpts.element.querySelectorAll('.heatmap-cell[tabindex="0"]')).toHaveLength(2);
    expect(constructorOpts.element.querySelector('.heatmap-cell[tabindex="0"]')?.getAttribute('aria-label'))
      .toContain('2024');
  });

  it('does not select cells when host interactions are disabled', () => {
    (constructorOpts.host.hostCapabilities as { allowInteractions: boolean }).allowInteractions = false;
    const selectionManager = constructorOpts.host.__selectionManager as Record<string, unknown>;
    const select = vi.fn(() => Promise.resolve([]));
    selectionManager.select = select;
    const dv = new DataViewBuilder()
      .withCategory('Date', ['2024-01-01'], 'date')
      .withValues('Count', [1], 'measure')
      .build();

    visual.update(createUpdateOptions([dv]) as never);
    const dataCell = constructorOpts.element.querySelector<HTMLElement>('.heatmap-cell[data-date-key]');
    dataCell?.click();

    expect(select).not.toHaveBeenCalled();
    expect(dataCell?.style.cursor).toBe('default');
  });

  it('uses host high-contrast colors for cells and labels', () => {
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
    const dv = new DataViewBuilder()
      .withCategory('Date', ['2024-01-01'], 'date')
      .withValues('Count', [1], 'measure')
      .build();

    visual.update(createUpdateOptions([dv]) as never);

    expect(constructorOpts.element.style.backgroundColor).toBe('rgb(0, 0, 0)');
    expect(constructorOpts.element.querySelector<HTMLElement>('.heatmap-cell[data-date-key]')?.style.backgroundColor)
      .toBe('rgb(0, 255, 255)');
    expect(constructorOpts.element.querySelector<HTMLElement>('.heatmap-year-label')?.style.color)
      .toBe('rgb(255, 255, 0)');
  });

  it('returns formatting model', () => {
    const dv = new DataViewBuilder().withCategory('Date', ['2024-01-01','2024-01-02','2024-01-03'], 'date').withValues('Count', [5,10,3], 'measure').build();
    visual.update(createUpdateOptions([dv]) as never);
    const model = visual.getFormattingModel();
    expect(model).toBeDefined();
  });

  it('re-renders without error', () => {
    const dv = new DataViewBuilder().withCategory('Date', ['2024-01-01','2024-01-02','2024-01-03'], 'date').withValues('Count', [5,10,3], 'measure').build();
    visual.update(createUpdateOptions([dv]) as never);
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('hides inactive card appearance controls but keeps content padding available', () => {
    visual.update(createUpdateOptions([DataViewBuilder.empty()]) as never);
    const settings = (visual as unknown as { settings: HeatmapCalendarSettings }).settings;
    settings.cardSettings.cardStyleMode.value = { value: 'none', displayName: 'None' };

    visual.getFormattingModel();

    expect(settings.cardSettings.backgroundColor.visible).toBe(false);
    expect(settings.cardSettings.backgroundOpacity.visible).toBe(false);
    expect(settings.cardSettings.borderRadius.visible).toBe(false);
    expect(settings.cardSettings.contentPadding.visible).not.toBe(false);
  });

  it('migrates legacy calendar appearance properties', () => {
    const dv = DataViewBuilder.empty();
    dv.metadata.objects = {
      calendarSettings: {
        cellStrokeColor: { solid: { color: '#123456' } },
        cellStrokeWidth: 3,
        cellCornerRadius: 6,
        labelColor: { solid: { color: '#654321' } },
      },
    } as never;

    visual.update(createUpdateOptions([dv]) as never);
    const settings = (visual as unknown as { settings: HeatmapCalendarSettings }).settings;

    expect(settings.cellStyleSettings.cellStrokeColor.value.value).toBe('#123456');
    expect(settings.cellStyleSettings.cellStrokeWidth.value).toBe(3);
    expect(settings.cellStyleSettings.cellCornerRadius.value).toBe(6);
    expect(settings.axisFormattingCard.axisLabelColor.value.value).toBe('#654321');
  });
});
