import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AnimatedDonutProVisual } from '../visual';
import { AnimatedDonutProSettings } from '../settings';
import {
  createConstructorOptions,
  createUpdateOptions,
  DataViewBuilder,
} from '../../../core/src/__test-utils__';

const settingsRef: { current: AnimatedDonutProSettings | undefined } = { current: undefined };

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

let visual: AnimatedDonutProVisual;
let constructorOpts: ReturnType<typeof createConstructorOptions>;

beforeEach(() => {
  constructorOpts = createConstructorOptions();
  visual = new AnimatedDonutProVisual(constructorOpts as never);
});

afterEach(() => {
  visual.destroy();
  constructorOpts.element.remove();
});

describe('AnimatedDonutProVisual', () => {
  it('constructs without error', () => {
    expect(visual).toBeDefined();
  });

  it('handles empty data', () => {
    const dv = DataViewBuilder.empty();
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('renders sample data', () => {
    const dv = DataViewBuilder.singleCategoryMeasure(['A','B','C'], [10,20,30], { categoryRole: 'category', valueRole: 'measure' });
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('renders one slice per measure when category is omitted', () => {
    const dv = DataViewBuilder.measuresOnly([
      { name: 'Revenue', values: [120], role: 'measure' },
      { name: 'Cost', values: [80], role: 'measure' },
      { name: 'Margin', values: [40], role: 'measure' },
    ]);
    visual.update(createUpdateOptions([dv]) as never);
    expect(constructorOpts.element.querySelectorAll('.donut-segment').length).toBe(3);
  });

  it('updates the center value when a slice is selected', async () => {
    const settings = new AnimatedDonutProSettings();
    settings.animationSettings.enabled.value = false;
    settings.valueSettings.displayMode.value = { value: 'selectedOrTotal', displayName: 'Selected Slice or Total' };
    settingsRef.current = settings;

    const dv = DataViewBuilder.singleCategoryMeasure(['A','B','C'], [10,20,30], { categoryRole: 'category', valueRole: 'measure' });
    visual.update(createUpdateOptions([dv]) as never);

    const centerValue = () => constructorOpts.element.querySelector<SVGTextElement>('.donut-center-value')?.textContent;
    expect(centerValue()).toBe('60');

    const secondSlice = constructorOpts.element.querySelectorAll<SVGPathElement>('.donut-segment')[1];
    secondSlice?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();

    expect(centerValue()).toBe('20');
  });

  it('renders custom center text and caption', () => {
    const settings = new AnimatedDonutProSettings();
    settings.animationSettings.enabled.value = false;
    settings.valueSettings.displayMode.value = { value: 'customText', displayName: 'Custom Text' };
    settings.valueSettings.customText.value = 'North America';
    settings.valueSettings.captionMode.value = { value: 'custom', displayName: 'Custom' };
    settings.valueSettings.customCaption.value = 'Region';
    settingsRef.current = settings;

    const dv = DataViewBuilder.singleCategoryMeasure(['A','B','C'], [10,20,30], { categoryRole: 'category', valueRole: 'measure' });
    visual.update(createUpdateOptions([dv]) as never);

    expect(constructorOpts.element.querySelector('.donut-center-value')?.textContent).toBe('North America');
    expect(constructorOpts.element.querySelector('.donut-center-caption')?.textContent).toBe('Region');
  });

  it('renders an inner ring from the detail data role', () => {
    const settings = new AnimatedDonutProSettings();
    settings.animationSettings.enabled.value = false;
    settings.donutNestedSettings.enabled.value = true;
    settingsRef.current = settings;

    const dv = new DataViewBuilder()
      .withCategory('Category', ['A', 'A', 'B', 'B'], 'category')
      .withCategory('Detail', ['A1', 'A2', 'B1', 'B2'], 'detail')
      .withValues('Value', [10, 20, 15, 5], 'measure')
      .build();
    visual.update(createUpdateOptions([dv]) as never);

    expect(constructorOpts.element.querySelectorAll('.donut-segment')).toHaveLength(2);
    expect(constructorOpts.element.querySelectorAll('.donut-inner-segment')).toHaveLength(4);
  });

  it('keeps every slice during cross-highlight and exposes keyboard-focusable marks', () => {
    const settings = new AnimatedDonutProSettings();
    settings.animationSettings.enabled.value = false;
    settingsRef.current = settings;

    const dv = DataViewBuilder.singleCategoryMeasure(
      ['A', 'B', 'C'],
      [10, 20, 30],
      { categoryRole: 'category', valueRole: 'measure' },
    ) as {
      categorical?: { values?: Array<{ highlights?: Array<number | null> }> };
    };
    dv.categorical!.values![0].highlights = [null, 20, null];

    const events = (constructorOpts.host as Record<string, unknown>).eventService as {
      renderingStarted: (...args: unknown[]) => void;
      renderingFinished: (...args: unknown[]) => void;
    };
    const started = vi.spyOn(events, 'renderingStarted');
    const finished = vi.spyOn(events, 'renderingFinished');

    visual.update(createUpdateOptions([dv]) as never);

    const slices = Array.from(
      constructorOpts.element.querySelectorAll<SVGPathElement>('.donut-segment'),
    );
    expect(slices).toHaveLength(3);
    expect(slices.map((slice) => slice.style.opacity)).toEqual(['0.3', '', '0.3']);
    expect(slices.every((slice) => slice.getAttribute('tabindex') === '0')).toBe(true);
    expect(started).toHaveBeenCalledOnce();
    expect(finished).toHaveBeenCalledOnce();
  });

  it('opens the empty-space context menu', () => {
    const dv = DataViewBuilder.singleCategoryMeasure(['A','B','C'], [10,20,30], { categoryRole: 'category', valueRole: 'measure' });
    visual.update(createUpdateOptions([dv]) as never);
    const selectionManager = (constructorOpts.host as Record<string, unknown>).__selectionManager as {
      showContextMenu: (...args: unknown[]) => unknown;
    };
    const spy = vi.spyOn(selectionManager as any, 'showContextMenu');
    constructorOpts.element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 12, clientY: 34 }));
    expect(spy).toHaveBeenCalledWith({}, { x: 12, y: 34 });
  });

  it('returns formatting model', () => {
    const dv = DataViewBuilder.singleCategoryMeasure(['A','B','C'], [10,20,30], { categoryRole: 'category', valueRole: 'measure' });
    visual.update(createUpdateOptions([dv]) as never);
    const model = visual.getFormattingModel();
    expect(model).toBeDefined();
  });

  it('re-renders without error', () => {
    const dv = DataViewBuilder.singleCategoryMeasure(['A','B','C'], [10,20,30], { categoryRole: 'category', valueRole: 'measure' });
    visual.update(createUpdateOptions([dv]) as never);
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });
});
