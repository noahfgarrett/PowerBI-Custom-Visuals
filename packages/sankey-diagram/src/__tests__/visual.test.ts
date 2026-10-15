import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SankeyDiagramVisual } from '../visual';
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

let visual: SankeyDiagramVisual;
let constructorOpts: ReturnType<typeof createConstructorOptions>;

beforeEach(() => {
  constructorOpts = createConstructorOptions();
  visual = new SankeyDiagramVisual(constructorOpts as never);
});

afterEach(() => {
  visual.destroy();
  constructorOpts.element.remove();
});

describe('SankeyDiagramVisual', () => {
  it('constructs without error', () => {
    expect(visual).toBeDefined();
  });

  it('handles empty data', () => {
    const dv = DataViewBuilder.empty();
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('renders sample data', () => {
    const dv = new DataViewBuilder().withCategory('Source', ['A','A','B'], 'source').withCategory('Target', ['B','C','C'], 'target').withValues('Weight', [10,5,15], 'weight').build();
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('returns formatting model', () => {
    const dv = new DataViewBuilder().withCategory('Source', ['A','A','B'], 'source').withCategory('Target', ['B','C','C'], 'target').withValues('Weight', [10,5,15], 'weight').build();
    visual.update(createUpdateOptions([dv]) as never);
    const model = visual.getFormattingModel();
    expect(model).toBeDefined();
  });

  it('re-renders without error', () => {
    const dv = new DataViewBuilder().withCategory('Source', ['A','A','B'], 'source').withCategory('Target', ['B','C','C'], 'target').withValues('Weight', [10,5,15], 'weight').build();
    visual.update(createUpdateOptions([dv]) as never);
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
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
        .withCategory('Source', ['A'], 'source')
        .withCategory('Target', ['B'], 'target')
        .withValues('Weight', [10], 'weight')
        .build(),
    ]);

    visual.update(updateOptions as never);

    expect(started).toHaveBeenCalledWith(updateOptions);
    expect(finished).toHaveBeenCalledWith(updateOptions);
  });

  it('exposes focusable, labelled nodes to keyboard users', () => {
    const selectionManager = (constructorOpts.host as Record<string, unknown>).__selectionManager as {
      select: (...args: unknown[]) => unknown;
    };
    const select = vi.spyOn(selectionManager, 'select');
    const dv = new DataViewBuilder()
      .withCategory('Source', ['A'], 'source')
      .withCategory('Target', ['B'], 'target')
      .withValues('Weight', [10], 'weight')
      .build();

    visual.update(createUpdateOptions([dv]) as never);

    const nodes = Array.from(constructorOpts.element.querySelectorAll<SVGRectElement>('.sankey-node rect'));
    expect(nodes).toHaveLength(2);
    expect(nodes.every((node) => node.getAttribute('tabindex') === '0')).toBe(true);
    expect(nodes.every((node) => node.getAttribute('role') === 'listitem')).toBe(true);
    expect(nodes.every((node) => (node.getAttribute('aria-label') ?? '').includes('Item'))).toBe(true);
    nodes[0]?.focus();
    nodes[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(select).toHaveBeenCalledOnce();
  });

  it('gives long beside labels a bounded responsive width with the full text available', () => {
    const fullLabel = 'A very long source category name';
    const dv = new DataViewBuilder()
      .withCategory('Source', [fullLabel], 'source')
      .withCategory('Target', ['B'], 'target')
      .withValues('Weight', [10], 'weight')
      .build();

    visual.update(createUpdateOptions([dv], { width: 240, height: 180 }) as never);

    const label = Array.from(constructorOpts.element.querySelectorAll<SVGTextElement>('.sankey-node-label'))
      .find((element) => element.querySelector('title')?.textContent === fullLabel);
    expect(label?.textContent).toContain('…');
    expect(label?.querySelector('title')?.textContent).toBe(fullLabel);
  });

  it('applies and clears selection dimming without waiting for a host update', async () => {
    const dv = new DataViewBuilder()
      .withCategory('Source', ['A','A','B'], 'source')
      .withCategory('Target', ['B','C','C'], 'target')
      .withValues('Weight', [10,5,15], 'weight')
      .build();
    visual.update(createUpdateOptions([dv]) as never);
    const firstNode = constructorOpts.element.querySelector<SVGGElement>('.sankey-node');

    firstNode?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
    const nodes = Array.from(constructorOpts.element.querySelectorAll<SVGGElement>('.sankey-node'));
    expect(nodes.some((node) => node.style.opacity === '0.3')).toBe(true);

    constructorOpts.element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
    expect(nodes.every((node) => node.style.opacity === '')).toBe(true);
  });

  it('does not select or open context menus when host interactions are disabled', () => {
    (constructorOpts.host.hostCapabilities as { allowInteractions: boolean }).allowInteractions = false;
    const selectionManager = (constructorOpts.host as Record<string, unknown>).__selectionManager as {
      select: (...args: unknown[]) => unknown;
      showContextMenu: (...args: unknown[]) => unknown;
    };
    const select = vi.spyOn(selectionManager, 'select');
    const contextMenu = vi.spyOn(selectionManager, 'showContextMenu');
    const dv = new DataViewBuilder()
      .withCategory('Source', ['A'], 'source')
      .withCategory('Target', ['B'], 'target')
      .withValues('Weight', [10], 'weight')
      .build();
    visual.update(createUpdateOptions([dv]) as never);
    const node = constructorOpts.element.querySelector<SVGGElement>('.sankey-node');

    node?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    node?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));

    expect(select).not.toHaveBeenCalled();
    expect(contextMenu).not.toHaveBeenCalled();
  });
});
