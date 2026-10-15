import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BarRaceVisual } from '../visual';
import { BarRaceSettings } from '../settings';
import {
  createConstructorOptions,
  createUpdateOptions,
  DataViewBuilder,
} from '../../../core/src/__test-utils__';

vi.mock('../../style/visual.less', () => ({}));

const settingsRef: { current: BarRaceSettings | undefined } = { current: undefined };

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

let visual: BarRaceVisual;
let constructorOpts: ReturnType<typeof createConstructorOptions>;

beforeEach(() => {
  constructorOpts = createConstructorOptions();
  visual = new BarRaceVisual(constructorOpts as never);
});

afterEach(() => {
  visual.destroy();
  constructorOpts.element.remove();
});

describe('BarRaceVisual', () => {
  it('constructs without error', () => {
    expect(visual).toBeDefined();
  });

  it('handles empty data', () => {
    const dv = DataViewBuilder.empty();
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('renders sample data', () => {
    const dv = new DataViewBuilder().withCategory('Item', ['A','B','C'], 'category').withCategory('Time', ['2020','2020','2020'], 'timeAxis').withValues('Value', [10,20,30], 'measure').build();
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('opens the empty-space context menu', () => {
    const dv = new DataViewBuilder().withCategory('Item', ['A','B','C'], 'category').withCategory('Time', ['2020','2020','2020'], 'timeAxis').withValues('Value', [10,20,30], 'measure').build();
    visual.update(createUpdateOptions([dv]) as never);
    const selectionManager = (constructorOpts.host as Record<string, unknown>).__selectionManager as {
      showContextMenu: (...args: unknown[]) => unknown;
    };
    const spy = vi.spyOn(selectionManager as any, 'showContextMenu');
    constructorOpts.element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 12, clientY: 34 }));
    expect(spy).toHaveBeenCalledWith({}, { x: 12, y: 34 });
  });

  it('returns formatting model', () => {
    const dv = new DataViewBuilder().withCategory('Item', ['A','B','C'], 'category').withCategory('Time', ['2020','2020','2020'], 'timeAxis').withValues('Value', [10,20,30], 'measure').build();
    visual.update(createUpdateOptions([dv]) as never);
    const model = visual.getFormattingModel();
    expect(model).toBeDefined();
  });

  it('re-renders without error', () => {
    const dv = new DataViewBuilder().withCategory('Item', ['A','B','C'], 'category').withCategory('Time', ['2020','2020','2020'], 'timeAxis').withValues('Value', [10,20,30], 'measure').build();
    visual.update(createUpdateOptions([dv]) as never);
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('preserves host time order and configured opacity after the highlight pass', () => {
    const settings = new BarRaceSettings();
    settings.animationSettings.enabled.value = false;
    settings.playbackSettings.autoPlay.value = false;
    settings.raceSettings.barOpacity.value = 40;
    settingsRef.current = settings;

    const dv = new DataViewBuilder()
      .withCategory('Item', ['A', 'B', 'A', 'B', 'A', 'B'], 'category')
      .withCategory('Time', ['2', '2', '10', '10', '1', '1'], 'timeAxis')
      .withValues('Value', [10, 20, 30, 40, 50, 60], 'measure')
      .build();
    visual.update(createUpdateOptions([dv]) as never);

    expect(constructorOpts.element.querySelector('.bar-race-time')?.textContent).toBe('2');
    const visibleBars = Array.from(
      constructorOpts.element.querySelectorAll<HTMLElement>('.bar-race-bar[data-visible="true"]'),
    );
    expect(visibleBars).toHaveLength(2);
    expect(visibleBars.every((bar) => bar.style.opacity === '0.4')).toBe(true);
    expect(visibleBars.every((bar) => bar.getAttribute('tabindex') === '0')).toBe(true);
  });

  it('does not select bars when the host disables interactions', () => {
    ((constructorOpts.host as Record<string, unknown>).hostCapabilities as {
      allowInteractions: boolean;
    }).allowInteractions = false;

    const dv = new DataViewBuilder()
      .withCategory('Item', ['A', 'B'], 'category')
      .withCategory('Time', ['2020', '2020'], 'timeAxis')
      .withValues('Value', [10, 20], 'measure')
      .build();
    visual.update(createUpdateOptions([dv]) as never);

    constructorOpts.element.querySelector<HTMLElement>('.bar-race-bar')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const selectionManager = (constructorOpts.host as Record<string, unknown>).__selectionManager as {
      getSelectionIds: () => unknown[];
    };
    expect(selectionManager.getSelectionIds()).toHaveLength(0);
  });
});
