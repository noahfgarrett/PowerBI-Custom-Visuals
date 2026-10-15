import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StatusIndicatorVisual } from '../visual';
import { StatusIndicatorSettings } from '../settings';
import {
  createConstructorOptions,
  createUpdateOptions,
  DataViewBuilder,
} from '../../../core/src/__test-utils__';

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

let visual: StatusIndicatorVisual;
let constructorOpts: ReturnType<typeof createConstructorOptions>;

beforeEach(() => {
  constructorOpts = createConstructorOptions();
  visual = new StatusIndicatorVisual(constructorOpts as never);
});

afterEach(() => {
  visual.destroy();
  constructorOpts.element.remove();
});

describe('StatusIndicatorVisual', () => {
  it('constructs without error', () => {
    expect(visual).toBeDefined();
  });

  it('handles empty data', () => {
    const dv = DataViewBuilder.empty();
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('renders sample data', () => {
    const dv = new DataViewBuilder().withCategory('Item', ['A','B','C'], 'category').withValues('Value', [80,50,20], 'measure').build();
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('returns formatting model', () => {
    const dv = new DataViewBuilder().withCategory('Item', ['A','B','C'], 'category').withValues('Value', [80,50,20], 'measure').build();
    visual.update(createUpdateOptions([dv]) as never);
    const model = visual.getFormattingModel();
    expect(model).toBeDefined();
  });

  it('re-renders without error', () => {
    const dv = new DataViewBuilder().withCategory('Item', ['A','B','C'], 'category').withValues('Value', [80,50,20], 'measure').build();
    visual.update(createUpdateOptions([dv]) as never);
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('hides threshold, animation, and card-style controls when they are not meaningful', () => {
    const settings = new StatusIndicatorSettings();
    settings.thresholdSettings.useCustomThresholds.value = false;
    settings.animationSettings.enabled.value = false;
    settings.cardSettings.cardStyleMode.value = { value: 'none', displayName: 'None' };
    settingsRef.current = settings;
    const dv = new DataViewBuilder().withCategory('Item', ['A'], 'category').withValues('Value', [80], 'measure').build();

    visual.update(createUpdateOptions([dv]) as never);

    expect(settings.thresholdSettings.levelCount.visible).toBe(false);
    expect(settings.thresholdSettings.threshold3.visible).toBe(false);
    expect(settings.thresholdSettings.threshold4.visible).toBe(false);
    expect(settings.thresholdSettings.level4Color.visible).toBe(false);
    expect(settings.animationSettings.duration.visible).toBe(false);
    expect(settings.animationSettings.enablePulse.visible).toBe(false);
    expect(settings.cardSettings.borderRadius.visible).toBe(false);
    expect(settings.cardSettings.contentPadding.visible).not.toBe(false);
  });

  it('includes configured fourth and fifth levels in the legend', () => {
    const settings = new StatusIndicatorSettings();
    settings.animationSettings.enabled.value = false;
    settings.thresholdSettings.useCustomThresholds.value = true;
    settings.thresholdSettings.levelCount.value = { value: '5', displayName: '5' };
    settingsRef.current = settings;
    const dv = new DataViewBuilder().withCategory('Item', ['A'], 'category').withValues('Value', [80], 'measure').build();

    visual.update(createUpdateOptions([dv]) as never);

    const legendText = constructorOpts.element.querySelector('.pbi-legend')?.textContent ?? constructorOpts.element.textContent;
    expect(legendText).toContain('Level 4');
    expect(legendText).toContain('Level 5');
  });

  it('uses explicit fourth and fifth thresholds instead of derived breakpoints', () => {
    const settings = new StatusIndicatorSettings();
    settings.animationSettings.enabled.value = false;
    settings.valueDisplaySettings.showStatusText.value = true;
    settings.thresholdSettings.useCustomThresholds.value = true;
    settings.thresholdSettings.levelCount.value = { value: '5', displayName: '5' };
    settings.thresholdSettings.threshold1.value = 10;
    settings.thresholdSettings.threshold2.value = 20;
    settings.thresholdSettings.threshold3.value = 30;
    settings.thresholdSettings.threshold4.value = 40;
    settingsRef.current = settings;
    const dv = new DataViewBuilder()
      .withCategory('Item', ['A', 'B', 'C', 'D', 'E'], 'category')
      .withValues('Value', [5, 15, 25, 35, 45], 'measure')
      .build();

    visual.update(createUpdateOptions([dv]) as never);

    const statuses = Array.from(constructorOpts.element.querySelectorAll('.status-text'))
      .map((element) => element.textContent);
    expect(statuses).toEqual(['Critical', 'At Risk', 'On Track', 'Level 4', 'Level 5']);
  });

  it('renders null values as a neutral no-data status', () => {
    const settings = new StatusIndicatorSettings();
    settings.animationSettings.enabled.value = false;
    settings.valueDisplaySettings.showStatusText.value = true;
    settingsRef.current = settings;
    const dv = new DataViewBuilder()
      .withCategory('Item', ['A'], 'category')
      .withValues('Value', [null], 'measure')
      .build();

    visual.update(createUpdateOptions([dv]) as never);

    expect(constructorOpts.element.querySelector('.status-text')?.textContent).toBe('No Data');
    expect(constructorOpts.element.querySelector('.status-row')?.getAttribute('aria-label')).toContain('No data');
  });

  it('keeps every row visible and dims only non-highlighted statuses', () => {
    const settings = new StatusIndicatorSettings();
    settings.animationSettings.enabled.value = false;
    settingsRef.current = settings;
    const dv = new DataViewBuilder()
      .withCategory('Item', ['A', 'B', 'C'], 'category')
      .withValues('Value', [80, 50, 20], 'measure')
      .build();
    (dv.categorical!.values![0] as unknown as { highlights: Array<number | null> }).highlights = [80, null, 20];

    visual.update(createUpdateOptions([dv]) as never);

    const rows = constructorOpts.element.querySelectorAll<HTMLElement>('.status-row');
    expect(rows).toHaveLength(3);
    expect(rows[0].style.opacity).not.toBe('0.3');
    expect(rows[1].style.opacity).toBe('0.3');
    expect(rows[2].style.opacity).not.toBe('0.3');
  });

  it('supports keyboard selection and marks blocked interaction state', async () => {
    const settings = new StatusIndicatorSettings();
    settings.animationSettings.enabled.value = false;
    settingsRef.current = settings;
    const dv = new DataViewBuilder()
      .withCategory('Item', ['A'], 'category')
      .withValues('Value', [80], 'measure')
      .build();
    visual.update(createUpdateOptions([dv]) as never);

    let row = constructorOpts.element.querySelector<HTMLElement>('.status-row')!;
    expect(row.getAttribute('tabindex')).toBe('0');
    expect(row.getAttribute('role')).toBe('listitem');
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
    settingsRef.current = settings;
    visual.update(createUpdateOptions([dv]) as never);
    row = constructorOpts.element.querySelector<HTMLElement>('.status-row')!;
    expect(row.getAttribute('aria-disabled')).toBe('true');
    row.focus();
    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await Promise.resolve();
    expect(selectionManager.getSelectionIds()).toHaveLength(0);
  });

  it('keeps SVG status icons visible in host high-contrast mode', () => {
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
    const settings = new StatusIndicatorSettings();
    settings.animationSettings.enabled.value = false;
    settings.indicatorSettings.iconSet.value = { value: 'star', displayName: 'Star' };
    settingsRef.current = settings;
    const dv = new DataViewBuilder()
      .withCategory('Item', ['A'], 'category')
      .withValues('Value', [80], 'measure')
      .build();

    visual.update(createUpdateOptions([dv]) as never);

    expect(constructorOpts.element.querySelector('.status-shape path')?.getAttribute('fill')).toBe('#00AAFF');
    expect((constructorOpts.element.querySelector('.status-shape') as HTMLElement).style.borderColor)
      .toBeTruthy();
  });
});
