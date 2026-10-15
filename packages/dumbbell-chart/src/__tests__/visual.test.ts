import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DumbbellChartVisual } from '../visual';
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

let visual: DumbbellChartVisual;
let constructorOpts: ReturnType<typeof createConstructorOptions>;

function getSelectionManager() {
  return (constructorOpts.host as Record<string, unknown>).__selectionManager as {
    getSelectionIds: () => unknown[];
  };
}

beforeEach(() => {
  constructorOpts = createConstructorOptions();
  visual = new DumbbellChartVisual(constructorOpts as never);
});

afterEach(() => {
  visual.destroy();
  constructorOpts.element.remove();
});

describe('DumbbellChartVisual', () => {
  it('constructs without error', () => {
    expect(visual).toBeDefined();
  });

  it('handles empty data', () => {
    const dv = DataViewBuilder.empty();
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('renders sample data', () => {
    const dv = new DataViewBuilder().withCategory('Category', ['A','B','C'], 'category').withValues('Start', [10,20,30], 'startValue').withValues('End', [30,40,50], 'endValue').build();
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('creates one persisted formatting group per category', () => {
    const dv = new DataViewBuilder().withCategory('Category', ['A','B','C'], 'category').withValues('Start', [10,20,30], 'startValue').withValues('End', [30,40,50], 'endValue').build();
    visual.update(createUpdateOptions([dv]) as never);

    const settings = (visual as unknown as { settings: { seriesFormattingCard: { groups: Array<{ displayName: string; lineWidth: { value: number } }> } } }).settings;
    expect(settings.seriesFormattingCard.groups.map((group) => group.displayName)).toEqual(['A', 'B', 'C']);
    expect(settings.seriesFormattingCard.groups.every((group) => group.lineWidth.value === 2)).toBe(true);
  });

  it('returns formatting model', () => {
    const dv = new DataViewBuilder().withCategory('Category', ['A','B','C'], 'category').withValues('Start', [10,20,30], 'startValue').withValues('End', [30,40,50], 'endValue').build();
    visual.update(createUpdateOptions([dv]) as never);
    const model = visual.getFormattingModel();
    expect(model).toBeDefined();
  });

  it('re-renders without error', () => {
    const dv = new DataViewBuilder().withCategory('Category', ['A','B','C'], 'category').withValues('Start', [10,20,30], 'startValue').withValues('End', [30,40,50], 'endValue').build();
    visual.update(createUpdateOptions([dv]) as never);
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('selects a row from the widened line hit area', () => {
    const dv = new DataViewBuilder().withCategory('Category', ['A','B','C'], 'category').withValues('Start', [10,20,30], 'startValue').withValues('End', [30,40,50], 'endValue').build();
    visual.update(createUpdateOptions([dv]) as never);

    const hitArea = constructorOpts.element.querySelector<SVGPathElement>('.dumbbell-line-hit-area');
    expect(hitArea).not.toBeNull();

    hitArea!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(getSelectionManager().getSelectionIds()).toHaveLength(1);
  });

  it('makes each row keyboard focusable with a useful comparison label', () => {
    const dv = new DataViewBuilder().withCategory('Category', ['A','B','C'], 'category').withValues('Start', [10,20,30], 'startValue').withValues('End', [30,40,50], 'endValue').build();
    visual.update(createUpdateOptions([dv]) as never);

    const hitArea = constructorOpts.element.querySelector<SVGPathElement>('.dumbbell-line-hit-area');
    expect(hitArea?.getAttribute('tabindex')).toBe('0');
    expect(hitArea?.getAttribute('role')).toBe('listitem');
    expect(hitArea?.getAttribute('aria-label')).toContain('start 10');

    const activeElementSpy = vi.spyOn(document, 'activeElement', 'get').mockReturnValue(hitArea!);
    hitArea?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    activeElementSpy.mockRestore();
    expect(getSelectionManager().getSelectionIds()).toHaveLength(1);
  });

  it('preserves selected-row dimming after hover leaves another row', () => {
    const dv = new DataViewBuilder().withCategory('Category', ['A','B','C'], 'category').withValues('Start', [10,20,30], 'startValue').withValues('End', [30,40,50], 'endValue').build();
    visual.update(createUpdateOptions([dv]) as never);

    const hitAreas = Array.from(constructorOpts.element.querySelectorAll<SVGPathElement>('.dumbbell-line-hit-area'));
    hitAreas[0].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    hitAreas[1].dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    hitAreas[1].dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));

    expect(hitAreas[0].style.opacity).toBe('');
    expect(hitAreas[1].style.opacity).toBe('0.3');
  });

  it('respects allowInteractions=false for row actions', () => {
    (constructorOpts.host.hostCapabilities as { allowInteractions: boolean }).allowInteractions = false;
    const dv = new DataViewBuilder().withCategory('Category', ['A','B'], 'category').withValues('Start', [10,20], 'startValue').withValues('End', [30,40], 'endValue').build();
    visual.update(createUpdateOptions([dv]) as never);

    const manager = constructorOpts.host.__selectionManager as {
      select: (...args: unknown[]) => unknown;
      showContextMenu: (...args: unknown[]) => unknown;
    };
    const selectSpy = vi.spyOn(manager, 'select');
    const contextSpy = vi.spyOn(manager, 'showContextMenu');
    const hitArea = constructorOpts.element.querySelector<SVGPathElement>('.dumbbell-line-hit-area');
    expect(hitArea?.style.cursor).toBe('default');

    hitArea?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    hitArea?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    expect(selectSpy).not.toHaveBeenCalled();
    expect(contextSpy).not.toHaveBeenCalled();
  });
});
