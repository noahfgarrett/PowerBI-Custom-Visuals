import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ChordDiagramVisual } from '../visual';
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

let visual: ChordDiagramVisual;
let constructorOpts: ReturnType<typeof createConstructorOptions>;

beforeEach(() => {
  constructorOpts = createConstructorOptions();
  visual = new ChordDiagramVisual(constructorOpts as never);
});

afterEach(() => {
  visual.destroy();
  constructorOpts.element.remove();
});

describe('ChordDiagramVisual', () => {
  it('constructs without error', () => {
    expect(visual).toBeDefined();
  });

  it('handles empty data', () => {
    const dv = DataViewBuilder.empty();
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('renders sample data', () => {
    const dv = DataViewBuilder.relational([{source:'A',target:'B',weight:10},{source:'B',target:'C',weight:20}], { weightRole: 'measure' });
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('opens the empty-space context menu', () => {
    const dv = DataViewBuilder.relational([{source:'A',target:'B',weight:10},{source:'B',target:'C',weight:20}], { weightRole: 'measure' });
    visual.update(createUpdateOptions([dv]) as never);
    const selectionManager = (constructorOpts.host as Record<string, unknown>).__selectionManager as {
      showContextMenu: (...args: unknown[]) => unknown;
    };
    const spy = vi.spyOn(selectionManager as any, 'showContextMenu');
    constructorOpts.element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 12, clientY: 34 }));
    expect(spy).toHaveBeenCalledWith({}, { x: 12, y: 34 });
  });

  it('returns formatting model', () => {
    const dv = DataViewBuilder.relational([{source:'A',target:'B',weight:10},{source:'B',target:'C',weight:20}], { weightRole: 'measure' });
    visual.update(createUpdateOptions([dv]) as never);
    const model = visual.getFormattingModel();
    expect(model).toBeDefined();
  });

  it('re-renders without error', () => {
    const dv = DataViewBuilder.relational([{source:'A',target:'B',weight:10},{source:'B',target:'C',weight:20}], { weightRole: 'measure' });
    visual.update(createUpdateOptions([dv]) as never);
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('reports a completed rendering lifecycle to the host', () => {
    const eventService = constructorOpts.host.eventService as {
      renderingStarted: (...args: unknown[]) => void;
      renderingFinished: (...args: unknown[]) => void;
    };
    const started = vi.spyOn(eventService, 'renderingStarted');
    const finished = vi.spyOn(eventService, 'renderingFinished');
    const updateOptions = createUpdateOptions([
      DataViewBuilder.relational([{source:'A',target:'B',weight:10}], { weightRole: 'measure' }),
    ]);

    visual.update(updateOptions as never);

    expect(started).toHaveBeenCalledWith(updateOptions);
    expect(finished).toHaveBeenCalledWith(updateOptions);
  });

  it('exposes focusable, labelled group arcs to keyboard users', () => {
    const selectionManager = (constructorOpts.host as Record<string, unknown>).__selectionManager as {
      select: (...args: unknown[]) => unknown;
    };
    const select = vi.spyOn(selectionManager, 'select');
    const dv = DataViewBuilder.relational([
      {source:'A',target:'B',weight:10},
      {source:'B',target:'C',weight:20},
    ], { weightRole: 'measure' });

    visual.update(createUpdateOptions([dv]) as never);

    const arcs = Array.from(constructorOpts.element.querySelectorAll<SVGPathElement>('.chord-group-arc'));
    expect(arcs).toHaveLength(3);
    expect(arcs.every((arc) => arc.getAttribute('tabindex') === '0')).toBe(true);
    expect(arcs.every((arc) => arc.getAttribute('role') === 'listitem')).toBe(true);
    expect(arcs.every((arc) => (arc.getAttribute('aria-label') ?? '').includes('Item'))).toBe(true);
    arcs[0]?.focus();
    arcs[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(select).toHaveBeenCalledOnce();
  });

  it('truncates long outside labels within a narrow viewport and preserves the full text', () => {
    const fullLabel = 'A very long source category name';
    const dv = DataViewBuilder.relational([
      {source:fullLabel,target:'B',weight:10},
    ], { weightRole: 'measure' });

    visual.update(createUpdateOptions([dv], { width: 180, height: 180 }) as never);

    const label = Array.from(constructorOpts.element.querySelectorAll<SVGTextElement>('.chord-label'))
      .find((element) => element.querySelector('title')?.textContent === fullLabel);
    expect(label?.textContent).toContain('…');
    expect(label?.querySelector('title')?.textContent).toBe(fullLabel);
  });

  it('dims immediately on selection and restores all arcs after clearing', async () => {
    const dv = DataViewBuilder.relational([
      {source:'A',target:'B',weight:10},
      {source:'B',target:'C',weight:20},
    ], { weightRole: 'measure' });
    visual.update(createUpdateOptions([dv]) as never);
    const arcs = Array.from(constructorOpts.element.querySelectorAll<SVGPathElement>('.chord-group-arc'));

    arcs[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
    expect(arcs.some((arc) => arc.style.opacity === '0.3')).toBe(true);

    constructorOpts.element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
    expect(arcs.every((arc) => arc.style.opacity === '')).toBe(true);
  });

  it('honors host interaction disabling for selection and context menus', () => {
    (constructorOpts.host.hostCapabilities as { allowInteractions: boolean }).allowInteractions = false;
    const selectionManager = (constructorOpts.host as Record<string, unknown>).__selectionManager as {
      select: (...args: unknown[]) => unknown;
      showContextMenu: (...args: unknown[]) => unknown;
    };
    const select = vi.spyOn(selectionManager, 'select');
    const contextMenu = vi.spyOn(selectionManager, 'showContextMenu');
    visual.update(createUpdateOptions([
      DataViewBuilder.relational([{source:'A',target:'B',weight:10}], { weightRole: 'measure' }),
    ]) as never);
    const arc = constructorOpts.element.querySelector<SVGPathElement>('.chord-group-arc');

    arc?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    arc?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    constructorOpts.element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));

    expect(select).not.toHaveBeenCalled();
    expect(contextMenu).not.toHaveBeenCalled();
  });
});
