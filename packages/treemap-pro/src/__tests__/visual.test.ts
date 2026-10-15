import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TreemapProVisual } from '../visual';
import { TreemapProSettings } from '../settings';
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

let visual: TreemapProVisual;
let constructorOpts: ReturnType<typeof createConstructorOptions>;

beforeEach(() => {
  constructorOpts = createConstructorOptions();
  visual = new TreemapProVisual(constructorOpts as never);
});

afterEach(() => {
  visual.destroy();
  constructorOpts.element.remove();
});

describe('TreemapProVisual', () => {
  it('constructs without error', () => {
    expect(visual).toBeDefined();
  });

  it('handles empty data', () => {
    const dv = DataViewBuilder.empty();
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('renders sample data', () => {
    const dv = new DataViewBuilder().withCategory('Group', ['A','A','B'], 'level1').withCategory('Item', ['X','Y','Z'], 'level2').withValues('Value', [100,200,150], 'measure').build();
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('returns formatting model', () => {
    const dv = new DataViewBuilder().withCategory('Group', ['A','A','B'], 'level1').withCategory('Item', ['X','Y','Z'], 'level2').withValues('Value', [100,200,150], 'measure').build();
    visual.update(createUpdateOptions([dv]) as never);
    const model = visual.getFormattingModel();
    expect(model).toBeDefined();
  });

  it('re-renders without error', () => {
    const dv = new DataViewBuilder().withCategory('Group', ['A','A','B'], 'level1').withCategory('Item', ['X','Y','Z'], 'level2').withValues('Value', [100,200,150], 'measure').build();
    visual.update(createUpdateOptions([dv]) as never);
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('keeps content padding available when card style is None', () => {
    const settings = new TreemapProSettings();
    settings.cardSettings.cardStyleMode.value = { value: 'none', displayName: 'None' };
    settings.cardSettings.borderRadius.value = 20;
    settings.animationSettings.enabled.value = false;
    settingsRef.current = settings;
    const dv = new DataViewBuilder().withCategory('Group', ['A'], 'level1').withValues('Value', [100], 'measure').build();
    visual.update(createUpdateOptions([dv]) as never);

    expect(settings.cardSettings.backgroundColor.visible).toBe(false);
    expect(settings.cardSettings.backgroundOpacity.visible).toBe(false);
    expect(settings.cardSettings.borderRadius.visible).toBe(false);
    expect(settings.cardSettings.contentPadding.visible).not.toBe(false);
    expect(constructorOpts.element.style.borderRadius).toBe('');
  });

  it('reports rendering lifecycle completion', () => {
    const eventService = constructorOpts.host.eventService as {
      renderingStarted: (...args: unknown[]) => void;
      renderingFinished: (...args: unknown[]) => void;
    };
    const started = vi.spyOn(eventService, 'renderingStarted');
    const finished = vi.spyOn(eventService, 'renderingFinished');
    const updateOptions = createUpdateOptions([
      new DataViewBuilder()
        .withCategory('Group', ['A'], 'level1')
        .withValues('Value', [100], 'measure')
        .build(),
    ]);

    visual.update(updateOptions as never);

    expect(started).toHaveBeenCalledWith(updateOptions);
    expect(finished).toHaveBeenCalledWith(updateOptions);
  });

  it('makes tiles focusable and keyboard-readable when keyboard navigation is enabled', () => {
    const selectionManager = (constructorOpts.host as Record<string, unknown>).__selectionManager as {
      select: (...args: unknown[]) => unknown;
    };
    const select = vi.spyOn(selectionManager, 'select');
    const dv = new DataViewBuilder()
      .withCategory('Group', ['A','B'], 'level1')
      .withValues('Value', [100,200], 'measure')
      .build();
    visual.update(createUpdateOptions([dv]) as never);
    const cells = Array.from(constructorOpts.element.querySelectorAll<SVGGElement>('.treemap-cell'));

    expect(cells).toHaveLength(2);
    expect(cells.every((cell) => cell.getAttribute('tabindex') === '0')).toBe(true);
    expect(cells.every((cell) => cell.getAttribute('role') === 'listitem')).toBe(true);
    expect(cells.every((cell) => (cell.getAttribute('aria-label') ?? '').includes('Item'))).toBe(true);
    cells[0]?.focus();
    cells[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(select).toHaveBeenCalledOnce();
  });

  it('applies and clears tile selection dimming immediately', async () => {
    const dv = new DataViewBuilder()
      .withCategory('Group', ['A','B'], 'level1')
      .withValues('Value', [100,200], 'measure')
      .build();
    visual.update(createUpdateOptions([dv]) as never);
    const cells = Array.from(constructorOpts.element.querySelectorAll<SVGGElement>('.treemap-cell'));

    cells[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
    expect(cells[1]?.style.opacity).toBe('0.3');

    constructorOpts.element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
    expect(cells.every((cell) => cell.style.opacity === '')).toBe(true);
  });

  it('uses content padding once when sizing the chart canvas', () => {
    const settings = new TreemapProSettings();
    settings.cardSettings.contentPadding.value = 10;
    settings.treemapSettings.chartPadding.value = 0;
    settings.animationSettings.enabled.value = false;
    settingsRef.current = settings;
    const dv = new DataViewBuilder()
      .withCategory('Group', ['A'], 'level1')
      .withValues('Value', [100], 'measure')
      .build();

    visual.update(createUpdateOptions([dv], { width: 200, height: 100 }) as never);

    const svg = constructorOpts.element.querySelector<SVGSVGElement>('.treemap-svg');
    expect(svg?.getAttribute('width')).toBe('180');
    expect(svg?.getAttribute('height')).toBe('80');
    expect(getComputedStyle(constructorOpts.element).padding).toBe('0px');
  });

  it('honors disabled host interactions for tile selection', () => {
    (constructorOpts.host.hostCapabilities as { allowInteractions: boolean }).allowInteractions = false;
    const selectionManager = (constructorOpts.host as Record<string, unknown>).__selectionManager as {
      select: (...args: unknown[]) => unknown;
    };
    const select = vi.spyOn(selectionManager, 'select');
    const dv = new DataViewBuilder()
      .withCategory('Group', ['A'], 'level1')
      .withValues('Value', [100], 'measure')
      .build();
    visual.update(createUpdateOptions([dv]) as never);

    constructorOpts.element.querySelector<SVGGElement>('.treemap-cell')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(select).not.toHaveBeenCalled();
  });
});
