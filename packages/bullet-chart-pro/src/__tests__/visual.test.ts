import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BulletChartProVisual } from '../visual';
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

let visual: BulletChartProVisual;
let constructorOpts: ReturnType<typeof createConstructorOptions>;

beforeEach(() => {
  constructorOpts = createConstructorOptions();
  visual = new BulletChartProVisual(constructorOpts as never);
});

afterEach(() => {
  visual.destroy();
  constructorOpts.element.remove();
});

describe('BulletChartProVisual', () => {
  it('constructs without error', () => {
    expect(visual).toBeDefined();
  });

  it('handles empty data', () => {
    const dv = DataViewBuilder.empty();
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('renders sample data', () => {
    const dv = new DataViewBuilder().withCategory('Category', ['Sales','Profit'], 'category').withValues('Measure', [80, 60], 'measure').withValues('Target', [100, 75], 'target').build();
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('exposes focusable, descriptive bars and activates selection from the keyboard', () => {
    const dv = new DataViewBuilder().withCategory('Category', ['Sales','Profit'], 'category').withValues('Measure', [80, 60], 'measure').withValues('Target', [100, 75], 'target').build();
    visual.update(createUpdateOptions([dv]) as never);

    const bar = constructorOpts.element.querySelector<SVGRectElement>('.bullet-value-bar');
    expect(bar?.getAttribute('tabindex')).toBe('0');
    expect(bar?.getAttribute('role')).toBe('listitem');
    expect(bar?.getAttribute('aria-label')).toContain('Sales');

    const selectionManager = constructorOpts.host.__selectionManager as {
      getSelectionIds: () => unknown[];
    };
    const activeElementSpy = vi.spyOn(document, 'activeElement', 'get').mockReturnValue(bar!);
    bar?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    activeElementSpy.mockRestore();
    expect(selectionManager.getSelectionIds()).toHaveLength(1);
  });

  it('does not select or open context menus when host interactions are disabled', () => {
    (constructorOpts.host.hostCapabilities as { allowInteractions: boolean }).allowInteractions = false;
    const dv = new DataViewBuilder().withCategory('Category', ['Sales','Profit'], 'category').withValues('Measure', [80, 60], 'measure').withValues('Target', [100, 75], 'target').build();
    visual.update(createUpdateOptions([dv]) as never);

    const selectionManager = constructorOpts.host.__selectionManager as {
      select: (...args: unknown[]) => unknown;
      showContextMenu: (...args: unknown[]) => unknown;
    };
    const selectSpy = vi.spyOn(selectionManager, 'select');
    const contextSpy = vi.spyOn(selectionManager, 'showContextMenu');
    const bar = constructorOpts.element.querySelector<SVGRectElement>('.bullet-value-bar');
    expect(bar?.style.cursor).toBe('default');

    bar?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    bar?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));

    expect(selectSpy).not.toHaveBeenCalled();
    expect(contextSpy).not.toHaveBeenCalled();
  });

  it('opens the empty-space context menu', () => {
    const dv = new DataViewBuilder().withCategory('Category', ['Sales','Profit'], 'category').withValues('Measure', [80, 60], 'measure').withValues('Target', [100, 75], 'target').build();
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
    const dv = new DataViewBuilder().withCategory('Category', ['Sales','Profit'], 'category').withValues('Measure', [80, 60], 'measure').withValues('Target', [100, 75], 'target').build();
    visual.update(createUpdateOptions([dv]) as never);
    const model = visual.getFormattingModel();
    expect(model).toBeDefined();
  });

  it('re-renders without error', () => {
    const dv = new DataViewBuilder().withCategory('Category', ['Sales','Profit'], 'category').withValues('Measure', [80, 60], 'measure').withValues('Target', [100, 75], 'target').build();
    visual.update(createUpdateOptions([dv]) as never);
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });
});
