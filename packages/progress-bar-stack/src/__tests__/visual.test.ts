import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProgressBarStackVisual } from '../visual';
import { ProgressBarStackSettings } from '../settings';
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

let visual: ProgressBarStackVisual;
let constructorOpts: ReturnType<typeof createConstructorOptions>;

beforeEach(() => {
  constructorOpts = createConstructorOptions();
  visual = new ProgressBarStackVisual(constructorOpts as never);
});

afterEach(() => {
  visual.destroy();
  constructorOpts.element.remove();
});

describe('ProgressBarStackVisual', () => {
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
    expect(constructorOpts.element.querySelector('.progress-row')).toBeNull();
  });

  it('renders sample data', () => {
    const dv = new DataViewBuilder().withCategory('Item', ['A','B'], 'category').withValues('Value', [70,45], 'measure').withValues('Target', [100,100], 'target').build();
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('renders one row per measure when category is omitted', () => {
    const dv = DataViewBuilder.measuresOnly([
      { name: 'Revenue', values: [70], role: 'measure' },
      { name: 'Cost', values: [45], role: 'measure' },
      { name: 'Shared Target', values: [100], role: 'target' },
    ]);
    visual.update(createUpdateOptions([dv]) as never);
    expect(constructorOpts.element.querySelectorAll('.progress-row').length).toBe(2);
  });

  it('returns formatting model', () => {
    const dv = new DataViewBuilder().withCategory('Item', ['A','B'], 'category').withValues('Value', [70,45], 'measure').withValues('Target', [100,100], 'target').build();
    visual.update(createUpdateOptions([dv]) as never);
    const model = visual.getFormattingModel();
    expect(model).toBeDefined();
  });

  it('re-renders without error', () => {
    const dv = new DataViewBuilder().withCategory('Item', ['A','B'], 'category').withValues('Value', [70,45], 'measure').withValues('Target', [100,100], 'target').build();
    visual.update(createUpdateOptions([dv]) as never);
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('hides dependent and card-surface controls without hiding content padding', () => {
    const settings = new ProgressBarStackSettings();
    settings.animationSettings.enabled.value = false;
    settings.barSettings.showLabels.value = false;
    settings.cardSettings.cardStyleMode.value = { value: 'none', displayName: 'None' };
    settingsRef.current = settings;
    const dv = new DataViewBuilder().withCategory('Item', ['A'], 'category').withValues('Value', [70], 'measure').withValues('Target', [100], 'target').build();
    visual.update(createUpdateOptions([dv]) as never);
    expect(settings.animationSettings.duration.visible).toBe(false);
    expect(settings.barSettings.labelPosition.visible).toBe(false);
    expect(settings.cardSettings.backgroundColor.visible).toBe(false);
    expect(settings.cardSettings.backgroundOpacity.visible).toBe(false);
    expect(settings.cardSettings.borderRadius.visible).toBe(false);
    expect(settings.cardSettings.contentPadding.visible).not.toBe(false);
    expect(settings.referenceLineFormattingCard.referenceLineType.visible).toBe(false);
    expect(settings.trendLineFormattingCard.trendLineType.visible).toBe(false);
    expect(settings.annotationFormattingCard.annotation1Category.visible).toBe(false);
  });

  it('does not let legacy glass override a persisted modern card style', () => {
    const settings = new ProgressBarStackSettings();
    settings.cardSettings.cardStyleMode.value = { value: 'outlined', displayName: 'Outlined' };
    settingsRef.current = settings;
    const dv = new DataViewBuilder().withCategory('Item', ['A'], 'category').withValues('Value', [70], 'measure')
      .withMetadataObjects({ cardSettings: { enableGlass: false, cardStyleMode: 'outlined' } }).build();
    visual.update(createUpdateOptions([dv]) as never);
    expect(settings.cardSettings.cardStyleMode.value.value).toBe('outlined');
  });


  it('supports inline label/value layout inside the track', () => {
    const settings = new ProgressBarStackSettings();
    settings.animationSettings.enabled.value = false;
    settings.barSettings.labelPosition.value = { value: 'inline', displayName: 'Inline' };
    settingsRef.current = settings;
    const dv = new DataViewBuilder().withCategory('Item', ['A'], 'category').withValues('Value', [70], 'measure').withValues('Target', [100], 'target').build();
    visual.update(createUpdateOptions([dv]) as never);
    expect(constructorOpts.element.querySelector('.progress-label-inline')).toBeTruthy();
    expect(constructorOpts.element.querySelector('.progress-value-inline')).toBeTruthy();
  });

  it('keeps percentages above 100 while clamping only the rendered fill', () => {
    const settings = new ProgressBarStackSettings();
    settings.animationSettings.enabled.value = false;
    settings.barSettings.showValue.value = false;
    settings.barSettings.showPercent.value = true;
    settingsRef.current = settings;
    const dv = new DataViewBuilder()
      .withCategory('Item', ['A'], 'category')
      .withValues('Value', [150], 'measure')
      .withValues('Target', [100], 'target')
      .build();

    visual.update(createUpdateOptions([dv]) as never);

    expect(constructorOpts.element.querySelector('.progress-value')?.textContent).toBe('150%');
    expect((constructorOpts.element.querySelector('.progress-fill') as HTMLElement).style.width).toBe('100%');
  });

  it('anchors inside-end labels to the fill and omits target UI when no target is bound', () => {
    const settings = new ProgressBarStackSettings();
    settings.animationSettings.enabled.value = false;
    settings.barSettings.labelPosition.value = { value: 'insideEnd', displayName: 'Inside End' };
    settingsRef.current = settings;
    const dv = DataViewBuilder.measuresOnly([
      { name: 'Revenue', values: [70], role: 'measure' },
    ]);

    visual.update(createUpdateOptions([dv]) as never);

    const label = constructorOpts.element.querySelector<HTMLElement>('.progress-label-inline');
    expect(label?.parentElement?.classList.contains('progress-fill')).toBe(true);
    expect(label?.style.right).toBe('10px');
    expect(constructorOpts.element.querySelector('.progress-target-marker')).toBeNull();
    expect(constructorOpts.element.querySelector('.progress-row')?.getAttribute('aria-label'))
      .toContain('displayed scale');
  });

  it('keeps every row visible and dims only non-highlighted progress rows', () => {
    const settings = new ProgressBarStackSettings();
    settings.animationSettings.enabled.value = false;
    settingsRef.current = settings;
    const dv = new DataViewBuilder()
      .withCategory('Item', ['A', 'B', 'C'], 'category')
      .withValues('Value', [80, 50, 20], 'measure')
      .withValues('Target', [100, 100, 100], 'target')
      .build();
    (dv.categorical!.values![0] as unknown as { highlights: Array<number | null> }).highlights = [80, null, 20];

    visual.update(createUpdateOptions([dv]) as never);

    const rows = constructorOpts.element.querySelectorAll<HTMLElement>('.progress-row');
    expect(rows).toHaveLength(3);
    expect(rows[0].style.opacity).not.toBe('0.3');
    expect(rows[1].style.opacity).toBe('0.3');
    expect(rows[2].style.opacity).not.toBe('0.3');
  });
});
