import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AnimatedWaterfallVisual } from '../visual';
import { AnimatedWaterfallSettings } from '../settings';
import {
  createConstructorOptions,
  createUpdateOptions,
  DataViewBuilder,
} from '../../../core/src/__test-utils__';

vi.mock('../../style/visual.less', () => ({}));

const settingsRef: { current: AnimatedWaterfallSettings | undefined } = { current: undefined };

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

let visual: AnimatedWaterfallVisual;
let constructorOpts: ReturnType<typeof createConstructorOptions>;

beforeEach(() => {
  constructorOpts = createConstructorOptions();
  visual = new AnimatedWaterfallVisual(constructorOpts as never);
});

afterEach(() => {
  visual.destroy();
  constructorOpts.element.remove();
});

describe('AnimatedWaterfallVisual', () => {
  it('constructs without error', () => {
    expect(visual).toBeDefined();
  });

  it('handles empty data', () => {
    const dv = DataViewBuilder.empty();
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('renders sample data', () => {
    const dv = new DataViewBuilder().withCategory('Category', ['A','B','C'], 'category').withValues('Value', [10, -5, 15], 'measure').build();
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('applies the dedicated value-label formatting', () => {
    const settings = new AnimatedWaterfallSettings();
    settings.animationSettings.enabled.value = false;
    settings.valueSettings.fontSize.value = 17;
    settings.valueSettings.fontColor.value = { value: '#123456' };
    settings.valueSettings.fontFamily.value = { value: 'Arial', displayName: 'Arial' };
    settingsRef.current = settings;

    const dv = new DataViewBuilder().withCategory('Category', ['A', 'B'], 'category').withValues('Value', [10, -5], 'measure').build();
    visual.update(createUpdateOptions([dv]) as never);

    const label = constructorOpts.element.querySelector<SVGTextElement>('.waterfall-value');
    expect(label?.style.fontSize).toBe('17px');
    expect(label?.getAttribute('fill')).toBe('#123456');
    expect(label?.style.fontFamily).toBe('Arial');
  });

  it('opens the empty-space context menu', () => {
    const dv = new DataViewBuilder().withCategory('Category', ['A','B','C'], 'category').withValues('Value', [10, -5, 15], 'measure').build();
    visual.update(createUpdateOptions([dv]) as never);
    const selectionManager = (constructorOpts.host as Record<string, unknown>).__selectionManager as {
      showContextMenu: (...args: unknown[]) => unknown;
    };
    const spy = vi.spyOn(selectionManager as any, 'showContextMenu');
    constructorOpts.element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 12, clientY: 34 }));
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ getKey: expect.any(Function) }),
      { x: 12, y: 34 },
    );
  });

  it('returns formatting model', () => {
    const dv = new DataViewBuilder().withCategory('Category', ['A','B','C'], 'category').withValues('Value', [10, -5, 15], 'measure').build();
    visual.update(createUpdateOptions([dv]) as never);
    const model = visual.getFormattingModel();
    expect(model).toBeDefined();
  });

  it('re-renders without error', () => {
    const dv = new DataViewBuilder().withCategory('Category', ['A','B','C'], 'category').withValues('Value', [10, -5, 15], 'measure').build();
    visual.update(createUpdateOptions([dv]) as never);
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('keeps modern card style settings ahead of the legacy glass flag', () => {
    const settings = new AnimatedWaterfallSettings();
    settings.animationSettings.enabled.value = false;
    settings.cardSettings.cardStyleMode.value = { value: 'solid', displayName: 'Solid' };
    settingsRef.current = settings;
    const dv = new DataViewBuilder()
      .withCategory('Category', ['A', 'B'], 'category')
      .withValues('Value', [10, -5], 'measure')
      .withMetadataObjects({
        cardSettings: {
          enableGlass: false,
          cardStyleMode: 'solid',
        },
      })
      .build();

    visual.update(createUpdateOptions([dv]) as never);

    expect(settings.cardSettings.cardStyleMode.value.value).toBe('solid');
    const bars = Array.from(
      constructorOpts.element.querySelectorAll<SVGRectElement>('.waterfall-bar'),
    );
    expect(bars.every((bar) => bar.getAttribute('tabindex') === '0')).toBe(true);
  });
});
