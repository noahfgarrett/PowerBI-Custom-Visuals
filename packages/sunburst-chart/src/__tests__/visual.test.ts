import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SunburstChartVisual } from '../visual';
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

let visual: SunburstChartVisual;
let constructorOpts: ReturnType<typeof createConstructorOptions>;

beforeEach(() => {
  constructorOpts = createConstructorOptions();
  visual = new SunburstChartVisual(constructorOpts as never);
});

afterEach(() => {
  visual.destroy();
  constructorOpts.element.remove();
});

describe('SunburstChartVisual', () => {
  it('constructs without error', () => {
    expect(visual).toBeDefined();
  });

  it('handles empty data', () => {
    const dv = DataViewBuilder.empty();
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('renders sample data', () => {
    const dv = new DataViewBuilder().withCategory('Level1', ['A','A','B'], 'level1').withCategory('Level2', ['X','Y','Z'], 'level2').withValues('Value', [10,20,30], 'measure').build();
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('returns formatting model', () => {
    const dv = new DataViewBuilder().withCategory('Level1', ['A','A','B'], 'level1').withCategory('Level2', ['X','Y','Z'], 'level2').withValues('Value', [10,20,30], 'measure').build();
    visual.update(createUpdateOptions([dv]) as never);
    const model = visual.getFormattingModel();
    expect(model).toBeDefined();
  });

  it('re-renders without error', () => {
    const dv = new DataViewBuilder().withCategory('Level1', ['A','A','B'], 'level1').withCategory('Level2', ['X','Y','Z'], 'level2').withValues('Value', [10,20,30], 'measure').build();
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
        .withCategory('Level1', ['A'], 'level1')
        .withValues('Value', [10], 'measure')
        .build(),
    ]);

    visual.update(updateOptions as never);

    expect(started).toHaveBeenCalledWith(updateOptions);
    expect(finished).toHaveBeenCalledWith(updateOptions);
  });

  it('exposes focusable, labelled segments to keyboard users', () => {
    const selectionManager = (constructorOpts.host as Record<string, unknown>).__selectionManager as {
      select: (...args: unknown[]) => unknown;
    };
    const select = vi.spyOn(selectionManager, 'select');
    const dv = new DataViewBuilder()
      .withCategory('Level1', ['A','B'], 'level1')
      .withValues('Value', [10,20], 'measure')
      .build();

    visual.update(createUpdateOptions([dv]) as never);

    const segments = Array.from(constructorOpts.element.querySelectorAll<SVGGElement>('.sunburst-segment'));
    expect(segments).toHaveLength(2);
    expect(segments.every((segment) => segment.getAttribute('tabindex') === '0')).toBe(true);
    expect(segments.every((segment) => segment.getAttribute('role') === 'listitem')).toBe(true);
    expect(segments.every((segment) => (segment.getAttribute('aria-label') ?? '').includes('Item'))).toBe(true);
    segments[0]?.focus();
    segments[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(select).toHaveBeenCalledOnce();
  });

  it('truncates labels to their radial band and preserves the full text', () => {
    const fullLabel = 'A very long hierarchy category name';
    const dv = new DataViewBuilder()
      .withCategory('Level1', [fullLabel, 'B'], 'level1')
      .withValues('Value', [10,20], 'measure')
      .build();

    visual.update(createUpdateOptions([dv], { width: 200, height: 200 }) as never);

    const label = Array.from(constructorOpts.element.querySelectorAll<SVGTextElement>('.sunburst-label'))
      .find((element) => element.querySelector('title')?.textContent === fullLabel);
    expect(label?.textContent).toContain('…');
    expect(label?.querySelector('title')?.textContent).toBe(fullLabel);
  });

  it('selects leaf segments and clears their dimming immediately', async () => {
    const dv = new DataViewBuilder()
      .withCategory('Level1', ['A','A','B'], 'level1')
      .withCategory('Level2', ['X','Y','Z'], 'level2')
      .withValues('Value', [10,20,30], 'measure')
      .build();
    visual.update(createUpdateOptions([dv]) as never);
    const segments = Array.from(constructorOpts.element.querySelectorAll<SVGGElement>('.sunburst-segment'));
    const leaf = segments[segments.length - 1];

    leaf?.querySelector('path')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
    expect(segments.some((segment) => segment.style.opacity === '0.3')).toBe(true);

    constructorOpts.element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
    expect(segments.every((segment) => segment.style.opacity === '')).toBe(true);
  });

  it('preserves a valid drill path across host updates', () => {
    const dv = new DataViewBuilder()
      .withCategory('Level1', ['A','A','B'], 'level1')
      .withCategory('Level2', ['X','Y','Z'], 'level2')
      .withValues('Value', [10,20,30], 'measure')
      .build();
    visual.update(createUpdateOptions([dv]) as never);
    constructorOpts.element.querySelector<SVGGElement>('.sunburst-segment')
      ?.querySelector('path')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(constructorOpts.element.querySelector('.sunburst-breadcrumb')).not.toBeNull();

    visual.update(createUpdateOptions([dv], { width: 500, height: 350 }) as never);

    expect(constructorOpts.element.querySelector('.sunburst-breadcrumb')).not.toBeNull();
  });

  it('honors disabled host interactions for selection and drill actions', () => {
    (constructorOpts.host.hostCapabilities as { allowInteractions: boolean }).allowInteractions = false;
    const selectionManager = (constructorOpts.host as Record<string, unknown>).__selectionManager as {
      select: (...args: unknown[]) => unknown;
    };
    const select = vi.spyOn(selectionManager, 'select');
    const dv = new DataViewBuilder()
      .withCategory('Level1', ['A','A'], 'level1')
      .withCategory('Level2', ['X','Y'], 'level2')
      .withValues('Value', [10,20], 'measure')
      .build();
    visual.update(createUpdateOptions([dv]) as never);

    constructorOpts.element.querySelector<SVGGElement>('.sunburst-segment')
      ?.querySelector('path')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(select).not.toHaveBeenCalled();
    expect(constructorOpts.element.querySelector('.sunburst-breadcrumb')).toBeNull();
  });
});
