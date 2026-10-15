import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GaugeClusterVisual } from '../visual';
import { GaugeClusterSettings } from '../settings';
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

let visual: GaugeClusterVisual;
let constructorOpts: ReturnType<typeof createConstructorOptions>;

beforeEach(() => {
  constructorOpts = createConstructorOptions();
  visual = new GaugeClusterVisual(constructorOpts as never);
});

afterEach(() => {
  visual.destroy();
  constructorOpts.element.remove();
});

describe('GaugeClusterVisual', () => {
  it('constructs without error', () => {
    expect(visual).toBeDefined();
  });

  it('handles empty data', () => {
    const dv = DataViewBuilder.empty();
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('distinguishes an unconfigured landing page from a bound empty measure', () => {
    visual.update(createUpdateOptions([DataViewBuilder.empty()]) as never);
    expect(constructorOpts.element.querySelector('.pbi-landing-page')).not.toBeNull();

    const boundEmpty = DataViewBuilder.measuresOnly([
      { name: 'Value', values: [], role: 'measure' },
    ]);
    visual.update(createUpdateOptions([boundEmpty]) as never);
    expect(constructorOpts.element.querySelector('.pbi-no-data-state')).not.toBeNull();
    expect(constructorOpts.element.querySelector('.gauge-cell')).toBeNull();
  });

  it('renders sample data', () => {
    const dv = new DataViewBuilder().withCategory('Gauge', ['G1','G2'], 'category').withValues('Value', [75,45], 'measure').withValues('Target', [100,80], 'target').build();
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('shows gauge values from the Labels toggle without requiring the shared label toggle', () => {
    const settings = new GaugeClusterSettings();
    settings.animationSettings.enabled.value = false;
    expect(settings.dataLabelFormattingCard.showDataLabels.value).toBe(false);
    settingsRef.current = settings;
    const dv = new DataViewBuilder().withCategory('Gauge', ['G1'], 'category').withValues('Value', [75], 'measure').build();

    visual.update(createUpdateOptions([dv]) as never);

    expect(constructorOpts.element.querySelector('.gauge-value')?.textContent).toContain('75');
  });

  it('hides formatting controls that are not meaningful for the selected options', () => {
    const settings = new GaugeClusterSettings();
    settings.animationSettings.enabled.value = false;
    settings.labelsSettings.showLabels.value = false;
    settings.labelsSettings.showValues.value = false;
    settings.summarySettings.captionMode.value = { value: 'none', displayName: 'None' };
    settings.cardSettings.cardStyleMode.value = { value: 'none', displayName: 'None' };
    settingsRef.current = settings;
    const dv = new DataViewBuilder().withCategory('Gauge', ['G1'], 'category').withValues('Value', [75], 'measure').build();

    visual.update(createUpdateOptions([dv]) as never);

    expect(settings.labelsSettings.labelFontSize.visible).toBe(false);
    expect(settings.dataLabelFormattingCard.dataLabelFontSize.visible).toBe(false);
    expect(settings.summarySettings.captionFontSize.visible).toBe(false);
    expect(settings.cardSettings.borderRadius.visible).toBe(false);
    expect(settings.cardSettings.contentPadding.visible).not.toBe(false);
  });

  it('renders one gauge per measure when category is omitted', () => {
    const dv = DataViewBuilder.measuresOnly([
      { name: 'Revenue', values: [70], role: 'measure' },
      { name: 'Cost', values: [45], role: 'measure' },
      { name: 'Shared Target', values: [100], role: 'target' },
    ]);
    visual.update(createUpdateOptions([dv]) as never);
    expect(constructorOpts.element.querySelectorAll('.gauge-cell').length).toBe(2);
  });

  it('returns formatting model', () => {
    const dv = new DataViewBuilder().withCategory('Gauge', ['G1','G2'], 'category').withValues('Value', [75,45], 'measure').withValues('Target', [100,80], 'target').build();
    visual.update(createUpdateOptions([dv]) as never);
    const model = visual.getFormattingModel();
    expect(model).toBeDefined();
  });

  it('re-renders without error', () => {
    const dv = new DataViewBuilder().withCategory('Gauge', ['G1','G2'], 'category').withValues('Value', [75,45], 'measure').withValues('Target', [100,80], 'target').build();
    visual.update(createUpdateOptions([dv]) as never);
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('renders a summary block above the grid', () => {
    const dv = new DataViewBuilder().withCategory('Gauge', ['G1','G2'], 'category').withValues('Value', [75,45], 'measure').withValues('Target', [100,80], 'target').build();
    visual.update(createUpdateOptions([dv]) as never);
    expect(constructorOpts.element.querySelector('.gauge-cluster-summary-value')?.textContent).toBeTruthy();
  });

  it('supports alternate label positions', () => {
    const settings = new GaugeClusterSettings();
    settings.animationSettings.enabled.value = false;
    settings.labelsSettings.labelPosition.value = { value: 'aboveArc', displayName: 'Above Arc' };
    settingsRef.current = settings;
    const dv = new DataViewBuilder().withCategory('Gauge', ['G1'], 'category').withValues('Value', [75], 'measure').withValues('Target', [100], 'target').build();
    visual.update(createUpdateOptions([dv]) as never);
    const label = constructorOpts.element.querySelector('.gauge-label');
    expect(label?.getAttribute('y')?.startsWith('-')).toBe(true);
  });

  it('keeps every category visible and dims only non-highlighted gauges', () => {
    const settings = new GaugeClusterSettings();
    settings.animationSettings.enabled.value = false;
    settingsRef.current = settings;
    const dv = new DataViewBuilder()
      .withCategory('Gauge', ['G1', 'G2', 'G3'], 'category')
      .withValues('Value', [75, 45, 65], 'measure')
      .build();
    (dv.categorical!.values![0] as unknown as { highlights: Array<number | null> }).highlights = [75, null, 65];

    visual.update(createUpdateOptions([dv]) as never);

    const cells = constructorOpts.element.querySelectorAll<HTMLElement>('.gauge-cell');
    expect(cells).toHaveLength(3);
    expect(cells[0].style.opacity).not.toBe('0.3');
    expect(cells[1].style.opacity).toBe('0.3');
    expect(cells[2].style.opacity).not.toBe('0.3');
  });

  it('supports keyboard selection and gates activation when interactions are disabled', async () => {
    const settings = new GaugeClusterSettings();
    settings.animationSettings.enabled.value = false;
    settingsRef.current = settings;
    const dv = new DataViewBuilder()
      .withCategory('Gauge', ['G1'], 'category')
      .withValues('Value', [75], 'measure')
      .build();
    visual.update(createUpdateOptions([dv]) as never);

    let cell = constructorOpts.element.querySelector<HTMLElement>('.gauge-cell')!;
    expect(cell.getAttribute('tabindex')).toBe('0');
    expect(cell.getAttribute('role')).toBe('listitem');
    expect(cell.getAttribute('aria-disabled')).toBe('false');
    cell.focus();
    cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
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
    cell = constructorOpts.element.querySelector<HTMLElement>('.gauge-cell')!;
    expect(cell.getAttribute('aria-disabled')).toBe('true');
    cell.focus();
    cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await Promise.resolve();
    expect(selectionManager.getSelectionIds()).toHaveLength(0);
  });

  it('uses host high-contrast colors for gauge marks and text', () => {
    const palette = (constructorOpts.host as Record<string, unknown>).colorPalette as {
      isHighContrast: boolean;
      foreground: { value: string };
      foregroundSelected: { value: string };
      background: { value: string };
    };
    palette.isHighContrast = true;
    palette.foreground.value = '#101010';
    palette.foregroundSelected.value = '#FF00FF';
    palette.background.value = '#FFFFFF';
    const settings = new GaugeClusterSettings();
    settings.animationSettings.enabled.value = false;
    settingsRef.current = settings;
    const dv = new DataViewBuilder()
      .withCategory('Gauge', ['G1'], 'category')
      .withValues('Value', [75], 'measure')
      .build();

    visual.update(createUpdateOptions([dv]) as never);

    expect(constructorOpts.element.querySelector('.gauge-fill')?.getAttribute('fill')).toBe('#FF00FF');
    expect(constructorOpts.element.querySelector('.gauge-value')?.getAttribute('fill')).toBe('#101010');
  });
});
