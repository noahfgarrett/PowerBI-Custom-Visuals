import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HealthBarVisual } from '../visual';
import { HealthBarSettings } from '../settings';
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

let visual: HealthBarVisual;
let constructorOpts: ReturnType<typeof createConstructorOptions>;

function getSelectionManager() {
  return (constructorOpts.host as Record<string, unknown>).__selectionManager as {
    getSelectionIds: () => unknown[];
  };
}

function createMetricToggleSettings(position: 'topLeft' | 'topRight' = 'topRight'): HealthBarSettings {
  const settings = new HealthBarSettings();
  settings.animationSettings.enabled.value = false;
  settings.dataLabelFormattingCard.showDataLabels.value = true;
  settings.valueLabelsSettings.showPercent.value = false;
  settings.numberFormattingCard.displayUnits.value = { value: 'none', displayName: 'None' };
  settings.numberFormattingCard.decimalPlaces.value = 0;

  const metricSettings = settings as HealthBarSettings & {
    metricToggleSettings?: {
      show: { value: boolean };
      position: { value: { value: 'topLeft' | 'topRight'; displayName: string } };
    };
  };
  if (metricSettings.metricToggleSettings) {
    metricSettings.metricToggleSettings.show.value = true;
    metricSettings.metricToggleSettings.position.value = {
      value: position,
      displayName: position === 'topLeft' ? 'Top Left' : 'Top Right',
    };
  }

  return settings;
}

function updateWithSettings(settings: HealthBarSettings, dv: unknown, viewport?: { width: number; height: number }): void {
  settingsRef.current = settings;
  visual.update(createUpdateOptions([dv], viewport) as never);
}

beforeEach(() => {
  constructorOpts = createConstructorOptions();
  visual = new HealthBarVisual(constructorOpts as never);
});

afterEach(() => {
  visual.destroy();
  constructorOpts.element.remove();
});

describe('HealthBarVisual', () => {
  it('constructs without error', () => {
    expect(visual).toBeDefined();
  });

  it('handles empty data', () => {
    const dv = DataViewBuilder.empty();
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('renders sample data', () => {
    const dv = new DataViewBuilder().withCategory('Item', ['A','B'], 'category').withValues('Value', [80,60], 'measure').withValues('Target', [100,100], 'target').build();
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('returns formatting model', () => {
    const dv = new DataViewBuilder().withCategory('Item', ['A','B'], 'category').withValues('Value', [80,60], 'measure').withValues('Target', [100,100], 'target').build();
    visual.update(createUpdateOptions([dv]) as never);
    const model = visual.getFormattingModel();
    expect(model).toBeDefined();
  });

  it('re-renders without error', () => {
    const dv = new DataViewBuilder().withCategory('Item', ['A','B'], 'category').withValues('Value', [80,60], 'measure').withValues('Target', [100,100], 'target').build();
    visual.update(createUpdateOptions([dv]) as never);
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('uses the local value-label controls and hides their inactive children', () => {
    const settings = new HealthBarSettings();
    settings.animationSettings.enabled.value = false;
    const dv = new DataViewBuilder().withCategory('Item', ['A'], 'category').withValues('Value', [80], 'measure').build();
    updateWithSettings(settings, dv);
    expect(constructorOpts.element.querySelector('.health-bar-value')).not.toBeNull();

    settings.valueLabelsSettings.showValue.value = false;
    settings.categoryLabelSettings.show.value = false;
    settings.healthBarZone.show.value = false;
    updateWithSettings(settings, dv);
    expect(settings.valueLabelsSettings.fontSize.visible).toBe(false);
    expect(settings.categoryLabelSettings.fontSize.visible).toBe(false);
    expect(settings.healthBarZone.zoneColors.visible).toBe(false);
    expect(settings.targetSettings.visible).toBe(false);
    expect(settings.referenceLineFormattingCard.referenceLineType.visible).toBe(false);
    expect(settings.trendLineFormattingCard.trendLineType.visible).toBe(false);
    expect(settings.annotationFormattingCard.annotation1Category.visible).toBe(false);
  });

  it('migrates legacy glass only when no modern card style is persisted', () => {
    const settings = new HealthBarSettings();
    const dv = new DataViewBuilder().withCategory('Item', ['A'], 'category').withValues('Value', [80], 'measure')
      .withMetadataObjects({ cardSettings: { enableGlass: false } }).build();
    updateWithSettings(settings, dv);
    expect(settings.cardSettings.cardStyleMode.value.value).toBe('none');

    const modern = new HealthBarSettings();
    modern.cardSettings.cardStyleMode.value = { value: 'elevated', displayName: 'Elevated' };
    const modernDv = new DataViewBuilder().withCategory('Item', ['A'], 'category').withValues('Value', [80], 'measure')
      .withMetadataObjects({ cardSettings: { enableGlass: false, cardStyleMode: 'elevated' } }).build();
    updateWithSettings(modern, modernDv);
    expect(modern.cardSettings.cardStyleMode.value.value).toBe('elevated');
  });


  it('selects a bar when the full bar hit area is clicked', () => {
    const dv = new DataViewBuilder().withCategory('Item', ['A','B'], 'category').withValues('Value', [80,60], 'measure').withValues('Target', [100,100], 'target').build();
    visual.update(createUpdateOptions([dv]) as never);

    const hitArea = constructorOpts.element.querySelector<SVGRectElement>('.health-bar-hit-area');
    expect(hitArea).not.toBeNull();

    hitArea!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(getSelectionManager().getSelectionIds()).toHaveLength(1);
  });

  it('renders the KPI toggle outside scrollable chart content and keeps bar selection when clicked', () => {
    const settings = createMetricToggleSettings('topLeft');
    settings.scrollFormattingCard.minCategoryWidth.value = 80;
    const dv = new DataViewBuilder()
      .withCategory('Item', ['A','B','C','D','E'], 'category')
      .withValues('Value', [10,20,30,40,50], 'measure')
      .build();

    updateWithSettings(settings, dv, { width: 220, height: 220 });

    const scrollWrapper = constructorOpts.element.querySelector('.pbi-scroll-wrapper');
    expect(scrollWrapper).not.toBeNull();

    const button = constructorOpts.element.querySelector<HTMLButtonElement>('.health-bar-kpi-toggle');
    expect(button).not.toBeNull();
    expect(button!.closest('svg')).toBeNull();
    expect(button!.closest('.pbi-scroll-wrapper')).toBeNull();
    expect(button!.classList.contains('health-bar-kpi-toggle--top-left')).toBe(true);
    expect(button!.getAttribute('aria-label')).toContain('Click to show Mean');
    expect(button!.title).toContain('Click to show Mean');

    const hitArea = constructorOpts.element.querySelector<SVGRectElement>('.health-bar-hit-area');
    hitArea!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(getSelectionManager().getSelectionIds()).toHaveLength(1);

    button!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(getSelectionManager().getSelectionIds()).toHaveLength(1);
  });

  it('cycles Bars, Mean, and Median using raw unclamped values', () => {
    const settings = createMetricToggleSettings();
    settings.scaleRangeSettings.maxValue.value = 100;
    const dv = new DataViewBuilder()
      .withCategory('Item', ['A','B','C','D'], 'category')
      .withValues('Value', [0,200,400,1000], 'measure')
      .build();

    updateWithSettings(settings, dv);

    const button = () => constructorOpts.element.querySelector<HTMLButtonElement>('.health-bar-kpi-toggle')!;
    const valueText = () => constructorOpts.element.querySelector<SVGTextElement>('.health-bar-value')?.textContent;
    const categoryText = () => constructorOpts.element.querySelector<SVGTextElement>('.health-bar-label')?.textContent;

    button().dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(button().textContent).toBe('Mean');
    expect(categoryText()).toBe('Mean');
    expect(valueText()).toBe('400');

    button().dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(button().textContent).toBe('Median');
    expect(categoryText()).toBe('Median');
    expect(valueText()).toBe('300');

    button().dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(button().textContent).toBe('Bars');
    expect(constructorOpts.element.querySelectorAll('.health-bar-hit-area')).toHaveLength(4);
  });

  it('uses raw values for mean and median reference lines before scale clamping', () => {
    const settings = createMetricToggleSettings();
    settings.scaleRangeSettings.maxValue.value = 100;
    settings.referenceLineFormattingCard.showReferenceLine.value = true;
    settings.referenceLineFormattingCard.referenceLineType.value = { value: 'median', displayName: 'Median' };
    const dv = new DataViewBuilder()
      .withCategory('Item', ['A','B','C'], 'category')
      .withValues('Value', [0,200,300], 'measure')
      .build();

    updateWithSettings(settings, dv);

    const referenceLine = constructorOpts.element.querySelector<SVGLineElement>('.reference-line');
    expect(referenceLine).not.toBeNull();
    expect(Number(referenceLine!.getAttribute('y1'))).toBeLessThan(0);
  });

  it('preserves all bars and dims only non-highlighted categories', () => {
    const settings = new HealthBarSettings();
    settings.animationSettings.enabled.value = false;
    const dv = new DataViewBuilder()
      .withCategory('Item', ['A', 'B', 'C'], 'category')
      .withValues('Value', [80, 50, 20], 'measure')
      .build();
    (dv.categorical!.values![0] as unknown as { highlights: Array<number | null> }).highlights = [80, null, 20];

    updateWithSettings(settings, dv);

    const fills = constructorOpts.element.querySelectorAll<SVGRectElement>('.health-bar-fill');
    expect(fills).toHaveLength(3);
    expect(fills[0].style.opacity).not.toBe('0.3');
    expect(fills[1].style.opacity).toBe('0.3');
    expect(fills[2].style.opacity).not.toBe('0.3');
  });

  it('supports keyboard selection and exposes disabled interaction state', async () => {
    const settings = new HealthBarSettings();
    settings.animationSettings.enabled.value = false;
    const dv = new DataViewBuilder()
      .withCategory('Item', ['A'], 'category')
      .withValues('Value', [80], 'measure')
      .build();
    updateWithSettings(settings, dv);

    let hitArea = constructorOpts.element.querySelector<SVGRectElement>('.health-bar-hit-area')!;
    expect(hitArea.getAttribute('tabindex')).toBe('0');
    expect(hitArea.getAttribute('role')).toBe('listitem');
    hitArea.focus();
    hitArea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await Promise.resolve();
    expect(getSelectionManager().getSelectionIds()).toHaveLength(1);

    const selectionManager = getSelectionManager() as unknown as {
      clear: () => Promise<void>;
      getSelectionIds: () => unknown[];
    };
    await selectionManager.clear();
    const hostCapabilities = (constructorOpts.host as Record<string, unknown>).hostCapabilities as {
      allowInteractions: boolean;
    };
    hostCapabilities.allowInteractions = false;
    updateWithSettings(settings, dv);
    hitArea = constructorOpts.element.querySelector<SVGRectElement>('.health-bar-hit-area')!;
    expect(hitArea.getAttribute('aria-disabled')).toBe('true');
    hitArea.focus();
    hitArea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await Promise.resolve();
    expect(selectionManager.getSelectionIds()).toHaveLength(0);
  });
});
