import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FunnelProVisual } from '../visual';
import { FunnelProSettings } from '../settings';
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

let visual: FunnelProVisual;
let constructorOpts: ReturnType<typeof createConstructorOptions>;

beforeEach(() => {
  constructorOpts = createConstructorOptions();
  visual = new FunnelProVisual(constructorOpts as never);
});

afterEach(() => {
  visual.destroy();
  constructorOpts.element.remove();
});

describe('FunnelProVisual', () => {
  it('constructs without error', () => {
    expect(visual).toBeDefined();
  });

  it('handles empty data', () => {
    const dv = DataViewBuilder.empty();
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('shows setup guidance when only the optional stage field is bound', () => {
    const dv = new DataViewBuilder()
      .withCategory('Stage', ['Lead', 'Won'], 'category')
      .build();

    visual.update(createUpdateOptions([dv]) as never);

    expect(constructorOpts.element.querySelector('.pbi-landing-page')).not.toBeNull();
    expect(constructorOpts.element.querySelector('.pbi-no-data-state')).toBeNull();
  });

  it('shows no data when the required measure is bound but filtered empty', () => {
    const dv = new DataViewBuilder()
      .withCategory('Stage', [], 'category')
      .withValues('Value', [], 'measure')
      .build();

    visual.update(createUpdateOptions([dv]) as never);

    expect(constructorOpts.element.querySelector('.pbi-no-data-state')?.textContent)
      .toContain('No data for the current selection.');
  });

  it('renders sample data', () => {
    const dv = DataViewBuilder.singleCategoryMeasure(['Step1','Step2','Step3'], [100,60,30], { categoryRole: 'category', valueRole: 'measure' });
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('renders one stage per measure when category is omitted', () => {
    const dv = DataViewBuilder.measuresOnly([
      { name: 'Leads', values: [100], role: 'measure' },
      { name: 'Qualified', values: [60], role: 'measure' },
      { name: 'Won', values: [30], role: 'measure' },
    ]);
    visual.update(createUpdateOptions([dv]) as never);
    expect(constructorOpts.element.querySelectorAll('.funnel-stage').length).toBe(3);
  });

  it('keeps zero-value stages visible and keyboard focusable', () => {
    const dv = DataViewBuilder.singleCategoryMeasure(
      ['Leads', 'Qualified', 'Won'],
      [100, 40, 0],
      { categoryRole: 'category', valueRole: 'measure' },
    );

    visual.update(createUpdateOptions([dv]) as never);

    const stages = constructorOpts.element.querySelectorAll<SVGPathElement>('.funnel-stage');
    expect(stages).toHaveLength(3);
    expect(stages[2].getAttribute('tabindex')).toBe('0');
    expect(stages[2].getAttribute('aria-label')).toContain('Won: 0');
  });

  it('does not select stages when host interactions are disabled', () => {
    (constructorOpts.host.hostCapabilities as { allowInteractions: boolean }).allowInteractions = false;
    const dv = DataViewBuilder.singleCategoryMeasure(
      ['Leads', 'Won'],
      [100, 25],
      { categoryRole: 'category', valueRole: 'measure' },
    );
    visual.update(createUpdateOptions([dv]) as never);

    constructorOpts.element.querySelector<SVGPathElement>('.funnel-stage')?.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );

    const selectionManager = constructorOpts.host.__selectionManager as {
      __selectionState: () => unknown[];
    };
    expect(selectionManager.__selectionState()).toHaveLength(0);
  });

  it('returns formatting model', () => {
    const dv = DataViewBuilder.singleCategoryMeasure(['Step1','Step2','Step3'], [100,60,30], { categoryRole: 'category', valueRole: 'measure' });
    visual.update(createUpdateOptions([dv]) as never);
    const model = visual.getFormattingModel();
    expect(model).toBeDefined();
  });

  it('re-renders without error', () => {
    const dv = DataViewBuilder.singleCategoryMeasure(['Step1','Step2','Step3'], [100,60,30], { categoryRole: 'category', valueRole: 'measure' });
    visual.update(createUpdateOptions([dv]) as never);
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('hides inactive card appearance controls but keeps content padding available', () => {
    visual.update(createUpdateOptions([DataViewBuilder.empty()]) as never);
    const settings = (visual as unknown as { settings: FunnelProSettings }).settings;
    settings.cardSettings.cardStyleMode.value = { value: 'none', displayName: 'None' };

    visual.getFormattingModel();

    expect(settings.cardSettings.backgroundColor.visible).toBe(false);
    expect(settings.cardSettings.backgroundOpacity.visible).toBe(false);
    expect(settings.cardSettings.borderRadius.visible).toBe(false);
    expect(settings.cardSettings.contentPadding.visible).not.toBe(false);
  });

  it('migrates legacy stage appearance properties', () => {
    const dv = DataViewBuilder.empty();
    dv.metadata.objects = {
      funnelSettings: {
        segmentStrokeColor: { solid: { color: '#123456' } },
        segmentStrokeWidth: 4,
        labelColor: { solid: { color: '#654321' } },
      },
    } as never;

    visual.update(createUpdateOptions([dv]) as never);
    const settings = (visual as unknown as { settings: FunnelProSettings }).settings;

    expect(settings.stageAppearanceSettings.segmentStrokeColor.value.value).toBe('#123456');
    expect(settings.stageAppearanceSettings.segmentStrokeWidth.value).toBe(4);
    expect(settings.stageAppearanceSettings.labelColor.value.value).toBe('#654321');
  });
});
