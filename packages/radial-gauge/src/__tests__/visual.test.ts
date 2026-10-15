import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RadialGaugeVisual } from '../visual';
import { RadialGaugeSettings } from '../settings';
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

let visual: RadialGaugeVisual;
let constructorOpts: ReturnType<typeof createConstructorOptions>;

beforeEach(() => {
  constructorOpts = createConstructorOptions();
  visual = new RadialGaugeVisual(constructorOpts as never);
});

afterEach(() => {
  visual.destroy();
  constructorOpts.element.remove();
});

describe('RadialGaugeVisual', () => {
  it('constructs without error', () => {
    expect(visual).toBeDefined();
  });

  it('handles empty data', () => {
    const dv = DataViewBuilder.empty();
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('renders sample data', () => {
    const dv = DataViewBuilder.measuresOnly([{name:'Value',values:[75],role:'value'},{name:'Target',values:[100],role:'target'}]);
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('returns formatting model', () => {
    const dv = DataViewBuilder.measuresOnly([{name:'Value',values:[75],role:'value'},{name:'Target',values:[100],role:'target'}]);
    visual.update(createUpdateOptions([dv]) as never);
    const model = visual.getFormattingModel();
    expect(model).toBeDefined();
  });

  it('re-renders without error', () => {
    const dv = DataViewBuilder.measuresOnly([{name:'Value',values:[75],role:'value'},{name:'Target',values:[100],role:'target'}]);
    visual.update(createUpdateOptions([dv]) as never);
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('supports center caption customization', () => {
    const settings = new RadialGaugeSettings();
    settings.animationSettings.enabled.value = false;
    settings.valueSettings.displayMode.value = { value: 'target', displayName: 'Target' };
    settings.valueSettings.captionMode.value = { value: 'custom', displayName: 'Custom' };
    settings.valueSettings.customCaption.value = 'Goal';
    settingsRef.current = settings;
    const dv = DataViewBuilder.measuresOnly([{name:'Value',values:[75],role:'value'},{name:'Target',values:[100],role:'target'}]);
    visual.update(createUpdateOptions([dv]) as never);
    expect(constructorOpts.element.querySelector('.radial-gauge-value-caption')?.textContent).toBe('Goal');
  });

  it('hides dependent arc, needle, comparison, and card-style controls', () => {
    const settings = new RadialGaugeSettings();
    settings.animationSettings.enabled.value = false;
    settings.arcSettings.startAngle.value = { value: 'half', displayName: 'Half Circle' };
    settings.needleSettings.show.value = true;
    settings.needleSettings.showHub.value = false;
    settings.gaugeComparisonSettings.showDelta.value = false;
    settings.cardSettings.cardStyleMode.value = { value: 'none', displayName: 'None' };
    settingsRef.current = settings;
    const dv = DataViewBuilder.measuresOnly([{name:'Value',values:[75],role:'value'}]);

    visual.update(createUpdateOptions([dv]) as never);

    expect(settings.arcSettings.arcRange.visible).toBe(false);
    expect(settings.needleSettings.hubRadius.visible).toBe(false);
    expect(settings.gaugeComparisonSettings.deltaPositiveColor.visible).toBe(false);
    expect(settings.cardSettings.borderRadius.visible).toBe(false);
    expect(settings.cardSettings.contentPadding.visible).not.toBe(false);
  });

  it('renders the configured number of major tick marks', () => {
    const settings = new RadialGaugeSettings();
    settings.animationSettings.enabled.value = false;
    settings.gaugeScaleSettings.showTicks.value = true;
    settings.gaugeScaleSettings.majorTicks.value = 5;
    settingsRef.current = settings;
    const dv = DataViewBuilder.measuresOnly([{name:'Value',values:[75],role:'value'}]);

    visual.update(createUpdateOptions([dv]) as never);

    expect(constructorOpts.element.querySelectorAll('.radial-gauge-major-tick')).toHaveLength(5);
  });

  it('uses the last date-filtered value as the current gauge value', () => {
    const settings = new RadialGaugeSettings();
    settings.animationSettings.enabled.value = false;
    settings.dateFilterFormattingCard.enableDateFilter.value = true;
    settings.dateFilterFormattingCard.startDate.value = '2024-01-01';
    settings.dateFilterFormattingCard.endAtCurrentDate.value = false;
    settings.dateFilterFormattingCard.endDate.value = '2024-01-31';
    settingsRef.current = settings;
    const dv = new DataViewBuilder()
      .withCategory('Date', [new Date('2024-01-01'), new Date('2024-01-15'), new Date('2024-02-01')], 'trendAxis')
      .withValues('Value', [10, 20, 90], 'value')
      .build();
    dv.categorical!.categories![0].source.type = { dateTime: true };

    visual.update(createUpdateOptions([dv]) as never);

    expect(constructorOpts.element.querySelector('.radial-gauge-value-text')?.textContent).toContain('20');
  });

  it('keeps segmented gauges keyboard-operable and respects interaction gating', async () => {
    const settings = new RadialGaugeSettings();
    settings.animationSettings.enabled.value = false;
    settings.arcSettings.segmented.value = true;
    settingsRef.current = settings;
    const dv = DataViewBuilder.measuresOnly([{ name: 'Value', values: [75], role: 'value' }]);
    visual.update(createUpdateOptions([dv]) as never);

    let hitArea = constructorOpts.element.querySelector<SVGPathElement>('.radial-gauge-hit-area')!;
    expect(hitArea.getAttribute('tabindex')).toBe('0');
    expect(hitArea.getAttribute('role')).toBe('listitem');
    expect(hitArea.getAttribute('aria-disabled')).toBe('false');
    hitArea.focus();
    hitArea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
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
    settingsRef.current = settings;
    visual.update(createUpdateOptions([dv]) as never);
    hitArea = constructorOpts.element.querySelector<SVGPathElement>('.radial-gauge-hit-area')!;
    expect(hitArea.getAttribute('aria-disabled')).toBe('true');
    hitArea.focus();
    hitArea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await Promise.resolve();
    expect(selectionManager.getSelectionIds()).toHaveLength(0);
  });

  it('uses host high-contrast colors for the value arc and text', () => {
    const palette = (constructorOpts.host as Record<string, unknown>).colorPalette as {
      isHighContrast: boolean;
      foreground: { value: string };
      foregroundSelected: { value: string };
      background: { value: string };
    };
    palette.isHighContrast = true;
    palette.foreground.value = '#101010';
    palette.foregroundSelected.value = '#00AAFF';
    palette.background.value = '#FFFFFF';
    const settings = new RadialGaugeSettings();
    settings.animationSettings.enabled.value = false;
    settingsRef.current = settings;
    const dv = DataViewBuilder.measuresOnly([{ name: 'Value', values: [75], role: 'value' }]);

    visual.update(createUpdateOptions([dv]) as never);

    expect(constructorOpts.element.querySelector('.radial-gauge-zone')?.getAttribute('fill')).toBe('#00AAFF');
    expect(constructorOpts.element.querySelector('.radial-gauge-value-text')?.getAttribute('fill')).toBe('#101010');
  });
});
