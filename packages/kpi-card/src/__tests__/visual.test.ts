import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const settingsRef = vi.hoisted(() => ({ current: undefined as unknown }));

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

import { KpiCardVisual } from '../visual';
import { KpiCardSettings } from '../settings';
import {
  createConstructorOptions,
  createUpdateOptions,
  DataViewBuilder,
} from '../../../core/src/__test-utils__';

let visual: KpiCardVisual;
let constructorOpts: ReturnType<typeof createConstructorOptions>;

beforeEach(() => {
  constructorOpts = createConstructorOptions();
  visual = new KpiCardVisual(constructorOpts as never);
});

afterEach(() => {
  visual.destroy();
  constructorOpts.element.remove();
});

function updateWithSettings(settings: KpiCardSettings, dataView: ReturnType<DataViewBuilder['build']>): void {
  settingsRef.current = settings;
  visual.update(createUpdateOptions([dataView]) as never);
}

function createGoalSettings(): KpiCardSettings {
  const settings = new KpiCardSettings();
  settings.animationSettings.enabled.value = false;
  settings.sparklineSettings.show.value = false;
  settings.trendSettings.show.value = false;
  settings.kpiGoalSettings.show.value = true;
  settings.kpiGoalSettings.showProgressBar.value = true;
  settings.kpiGoalSettings.showGoalText.value = true;
  settings.kpiGoalSettings.goalValue.value = 100;
  return settings;
}

describe('KpiCardVisual', () => {
  it('constructs without error', () => {
    expect(visual).toBeDefined();
  });

  it('handles empty data', () => {
    const dv = DataViewBuilder.empty();
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('renders sample data', () => {
    const dv = DataViewBuilder.measuresOnly([{name:'Value',values:[1234],role:'measure'},{name:'Target',values:[1500],role:'target'}]);
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('renders a literal zero KPI value', () => {
    const dv = DataViewBuilder.measuresOnly([
      { name: 'Value', values: [0], role: 'measure' },
    ]);

    visual.update(createUpdateOptions([dv]) as never);

    const valueEl = constructorOpts.element.querySelector('.kpi-value');
    expect(valueEl).not.toBeNull();
    expect(valueEl?.textContent).toContain('0');
    expect(constructorOpts.element.textContent).not.toContain('No data for the current selection');
  });

  it('renders zero when the selected KPI measure is blank', () => {
    const dv = new DataViewBuilder()
      .withCategory('Work Week', ['2026-W01'], 'trendAxis')
      .withValues('Issues Found', [null], 'measure')
      .build();

    visual.update(createUpdateOptions([dv]) as never);

    const valueEl = constructorOpts.element.querySelector('.kpi-value');
    expect(valueEl).not.toBeNull();
    expect(valueEl?.textContent).toContain('0');
    expect(constructorOpts.element.textContent).not.toContain('No data for the current selection');
  });

  it('returns formatting model', () => {
    const dv = DataViewBuilder.measuresOnly([{name:'Value',values:[1234],role:'measure'},{name:'Target',values:[1500],role:'target'}]);
    visual.update(createUpdateOptions([dv]) as never);
    const model = visual.getFormattingModel();
    expect(model).toBeDefined();
  });

  it('re-renders without error', () => {
    const dv = DataViewBuilder.measuresOnly([{name:'Value',values:[1234],role:'measure'},{name:'Target',values:[1500],role:'target'}]);
    visual.update(createUpdateOptions([dv]) as never);
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('renders a signed change indicator from the change measure role', () => {
    const dv = new DataViewBuilder()
      .withCategory('Week', ['W1', 'W2'], 'trendAxis')
      .withValues('Value', [100, 120], 'measure')
      .withValues('Target', [110, 110], 'target')
      .withValues('Week over Week', [5, 12], 'change')
      .build();

    visual.update(createUpdateOptions([dv]) as never);

    const indicator = constructorOpts.element.querySelector('.kpi-change-indicator');
    expect(indicator).toBeTruthy();
    expect(indicator?.textContent).toContain('+12');
    expect(indicator?.querySelector('svg')).toBeTruthy();
  });

  it('renders a negative change indicator with a minus sign', () => {
    const dv = new DataViewBuilder()
      .withCategory('Week', ['W1', 'W2'], 'trendAxis')
      .withValues('Value', [100, 120], 'measure')
      .withValues('Week over Week', [5, -7], 'change')
      .build();

    visual.update(createUpdateOptions([dv]) as never);

    const indicator = constructorOpts.element.querySelector('.kpi-change-indicator');
    expect(indicator?.textContent).toContain('-7');
  });

  it('exposes programmable three-color goal bar settings', () => {
    const settings = new KpiCardSettings();
    const goalSliceNames = settings.kpiGoalSettings.slices.map((slice: unknown) => (slice as { name?: string }).name);

    expect(goalSliceNames).toEqual(expect.arrayContaining([
      'goalWarningValue',
      'warningColor',
      'showGoalLegend',
      'invertLegendDirection',
      'goalBlockPaddingTop',
    ]));
  });

  it('uses manual goal and caution settings even when a target role is bound', () => {
    const settings = createGoalSettings();
    settings.kpiGoalSettings.goalValue.value = 20;
    settings.kpiGoalSettings.goalWarningValue.value = 5;
    const dv = DataViewBuilder.measuresOnly([
      { name: 'Value', values: [12], role: 'measure' },
      { name: 'Target', values: [15], role: 'target' },
    ]);

    updateWithSettings(settings, dv);

    const goalText = constructorOpts.element.querySelector('.kpi-goal-text');
    const legend = constructorOpts.element.querySelector('.kpi-goal-legend');
    const marker = constructorOpts.element.querySelector('.kpi-goal-marker');

    expect(goalText?.textContent).toContain('60% of Goal');
    expect(goalText?.textContent).toContain('Goal 20');
    expect(goalText?.textContent).toContain('Caution 5');
    expect(legend?.textContent).toContain('>= 20');
    expect(legend?.textContent).toContain('5 - 20');
    expect(legend?.textContent).toContain('< 5');
    expect(marker?.getAttribute('data-status')).toBe('warning');
  });

  it('renders a gradient goal bar when gradient color is enabled', () => {
    const settings = createGoalSettings();
    settings.kpiGoalSettings.goalValue.value = 20;
    settings.kpiGoalSettings.goalWarningValue.value = 10;
    settings.kpiGoalSettings.gradientProgress.value = true;
    settings.kpiGoalSettings.metColor.value = { value: '#00AA55' };
    settings.kpiGoalSettings.warningColor.value = { value: '#FFCC00' };
    settings.kpiGoalSettings.unmetColor.value = { value: '#CC0033' };
    const dv = DataViewBuilder.measuresOnly([
      { name: 'Value', values: [12], role: 'measure' },
    ]);

    updateWithSettings(settings, dv);

    const bar = constructorOpts.element.querySelector('.kpi-goal-bar-container') as HTMLElement | null;
    expect(bar).not.toBeNull();
    expect(bar?.innerHTML).toContain('linear-gradient');
    expect(bar?.querySelector('.kpi-goal-marker')?.getAttribute('data-gradient')).toBe('true');
  });

  it('uses a bound target by default when goal progress is enabled', () => {
    const settings = new KpiCardSettings();
    settings.animationSettings.enabled.value = false;
    settings.sparklineSettings.show.value = false;
    settings.trendSettings.show.value = false;
    settings.kpiGoalSettings.show.value = true;
    const dv = DataViewBuilder.measuresOnly([
      { name: 'Value', values: [50], role: 'measure' },
      { name: 'Target', values: [200], role: 'target' },
    ]);

    updateWithSettings(settings, dv);

    expect(settings.kpiGoalSettings.goalValue.value).toBe(0);
    expect(constructorOpts.element.querySelector('.kpi-goal-text')?.textContent).toContain('25% of Target');
  });

  it('does not apply a hidden cumulative setting when the sparkline is off', () => {
    const settings = new KpiCardSettings();
    settings.animationSettings.enabled.value = false;
    settings.sparklineSettings.show.value = false;
    settings.sparklineSettings.cumulative.value = true;
    const dv = new DataViewBuilder()
      .withCategory('Week', ['W1', 'W2'], 'trendAxis')
      .withValues('Value', [10, 20], 'measure')
      .build();

    updateWithSettings(settings, dv);

    expect(constructorOpts.element.querySelector('.kpi-value')?.textContent).toContain('20');
    expect(constructorOpts.element.querySelector('.kpi-value')?.textContent).not.toContain('30');
  });

  it('hides controls that do not apply to the selected sparkline and card styles', () => {
    const settings = new KpiCardSettings();
    settings.animationSettings.enabled.value = false;
    settings.sparklineSettings.sparklineType.value = { value: 'line', displayName: 'Line' };
    settings.cardSettings.cardStyleMode.value = { value: 'none', displayName: 'None' };
    settings.kpiGoalSettings.show.value = true;
    settings.kpiGoalSettings.showProgressBar.value = false;
    settings.kpiGoalSettings.showGoalText.value = true;
    const dv = DataViewBuilder.measuresOnly([{ name: 'Value', values: [50], role: 'measure' }]);

    updateWithSettings(settings, dv);

    expect(settings.sparklineSettings.lineColor.visible).toBe(false);
    expect(settings.sparklineSettings.sparklineColor.visible).toBe(true);
    expect(settings.kpiGoalSettings.goalWarningValue.visible).toBe(true);
    expect(settings.cardSettings.borderRadius.visible).toBe(false);
    expect(settings.cardSettings.contentPadding.visible).not.toBe(false);
  });

  it('can reverse goal legend direction and add space above the goal block', () => {
    const settings = createGoalSettings();
    const goalSettings = settings.kpiGoalSettings as typeof settings.kpiGoalSettings & {
      invertLegendDirection?: { value: boolean };
      goalBlockPaddingTop?: { value: number };
    };
    expect(goalSettings.invertLegendDirection).toBeDefined();
    expect(goalSettings.goalBlockPaddingTop).toBeDefined();
    settings.kpiGoalSettings.goalValue.value = 20;
    settings.kpiGoalSettings.goalWarningValue.value = 5;
    goalSettings.invertLegendDirection!.value = true;
    goalSettings.goalBlockPaddingTop!.value = 14;
    const dv = DataViewBuilder.measuresOnly([
      { name: 'Value', values: [12], role: 'measure' },
    ]);

    updateWithSettings(settings, dv);

    const legendItems = Array.from(constructorOpts.element.querySelectorAll('.kpi-goal-legend-item'))
      .map((el) => el.textContent);
    expect(legendItems).toEqual(['< 5', '5 - 20', '>= 20']);
    const goalBlock = constructorOpts.element.querySelector('.kpi-goal-block') as HTMLElement | null;
    expect(goalBlock?.style.marginTop).toBe('14px');
  });

  it('uses the manual goal value when no target role is bound', () => {
    const settings = createGoalSettings();
    settings.kpiGoalSettings.goalValue.value = 20;
    const dv = DataViewBuilder.measuresOnly([
      { name: 'Value', values: [12], role: 'measure' },
    ]);

    updateWithSettings(settings, dv);

    expect(constructorOpts.element.querySelector('.kpi-goal-text')?.textContent).toContain('60% of Goal');
  });

  it('still renders goal text when the visual progress bar is hidden', () => {
    const settings = createGoalSettings();
    settings.kpiGoalSettings.showProgressBar.value = false;
    settings.kpiGoalSettings.goalValue.value = 0;
    const dv = DataViewBuilder.measuresOnly([
      { name: 'Value', values: [50], role: 'measure' },
      { name: 'Target', values: [100], role: 'target' },
    ]);

    updateWithSettings(settings, dv);

    expect(constructorOpts.element.querySelector('.kpi-goal-bar-container')).toBeNull();
    expect(constructorOpts.element.querySelector('.kpi-goal-text')?.textContent).toContain('50% of Target');
  });

  it('uses the last date-filtered value and target as the current KPI', () => {
    const settings = createGoalSettings();
    settings.kpiGoalSettings.goalValue.value = 0;
    settings.dateFilterFormattingCard.enableDateFilter.value = true;
    settings.dateFilterFormattingCard.startDate.value = '2024-01-01';
    settings.dateFilterFormattingCard.endAtCurrentDate.value = false;
    settings.dateFilterFormattingCard.endDate.value = '2024-01-31';

    const dv = new DataViewBuilder()
      .withCategory('Date', [
        new Date('2024-01-01T00:00:00'),
        new Date('2024-01-15T00:00:00'),
        new Date('2024-02-01T00:00:00'),
      ], 'trendAxis')
      .withValues('Value', [10, 12, 200], 'measure')
      .withValues('Target', [15, 15, 250], 'target')
      .build();
    dv.categorical!.categories![0].source.type = { dateTime: true };

    updateWithSettings(settings, dv);

    expect(constructorOpts.element.querySelector('.kpi-goal-text')?.textContent).toContain('80% of Target');
    expect(constructorOpts.element.querySelector('.kpi-value')?.textContent).toContain('12');
  });

  it('uses matching target values for additional KPI slots when manual goal is not set', () => {
    const settings = createGoalSettings();
    settings.cardSettings.kpiCount.value = { value: '2', displayName: '2' };
    settings.kpiGoalSettings.goalValue.value = 0;
    const dv = new DataViewBuilder()
      .withCategory('Week', ['W1', 'W2'], 'trendAxis')
      .withValues('Value', [8, 18], 'measure')
      .withValues('Target', [10, 20], 'target')
      .build();

    updateWithSettings(settings, dv);

    const goalTexts = Array.from(constructorOpts.element.querySelectorAll('.kpi-goal-text'))
      .map((el) => el.textContent);
    expect(goalTexts.some((text) => text?.includes('90% of Target'))).toBe(true);
    expect(goalTexts.some((text) => text?.includes('80% of Target'))).toBe(true);
    expect(goalTexts.some((text) => text?.includes('40% of Target'))).toBe(false);
  });

  it('makes KPI rows keyboard-operable and respects allowInteractions', async () => {
    const settings = new KpiCardSettings();
    settings.animationSettings.enabled.value = false;
    settings.sparklineSettings.show.value = false;
    const dv = DataViewBuilder.measuresOnly([
      { name: 'Value', values: [42], role: 'measure' },
    ]);
    updateWithSettings(settings, dv);

    let row = constructorOpts.element.querySelector<HTMLElement>('.kpi-value-row')!;
    expect(row.getAttribute('tabindex')).toBe('0');
    expect(row.getAttribute('role')).toBe('listitem');
    expect(row.getAttribute('aria-disabled')).toBe('false');
    row.focus();
    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await Promise.resolve();

    const selectionManager = (constructorOpts.host as Record<string, unknown>).__selectionManager as {
      clear: () => Promise<void>;
      getSelectionIds: () => unknown[];
    };
    expect(selectionManager.getSelectionIds()).toHaveLength(1);

    await selectionManager.clear();
    const hostCapabilities = (constructorOpts.host as Record<string, unknown>).hostCapabilities as {
      allowInteractions: boolean;
    };
    hostCapabilities.allowInteractions = false;
    updateWithSettings(settings, dv);
    row = constructorOpts.element.querySelector<HTMLElement>('.kpi-value-row')!;
    expect(row.getAttribute('aria-disabled')).toBe('true');
    row.focus();
    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await Promise.resolve();
    expect(selectionManager.getSelectionIds()).toHaveLength(0);
  });

  it('applies host high-contrast colors to KPI text and goal ranges', () => {
    const palette = (constructorOpts.host as Record<string, unknown>).colorPalette as {
      isHighContrast: boolean;
      foreground: { value: string };
      foregroundSelected: { value: string };
      background: { value: string };
    };
    palette.isHighContrast = true;
    palette.foreground.value = '#101010';
    palette.foregroundSelected.value = '#101010';
    palette.background.value = '#FFFFFF';
    const settings = createGoalSettings();
    const dv = DataViewBuilder.measuresOnly([
      { name: 'Value', values: [42], role: 'measure' },
    ]);

    updateWithSettings(settings, dv);

    const value = constructorOpts.element.querySelector<HTMLElement>('.kpi-value');
    const range = constructorOpts.element.querySelector<HTMLElement>('.kpi-goal-range-segment');
    expect(value?.style.color).toBeTruthy();
    expect(range?.style.backgroundColor).toBeTruthy();
    expect(range?.style.borderColor).toBeTruthy();
  });
});
