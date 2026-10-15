import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PolarChartVisual } from '../visual';
import { PolarChartSettings } from '../settings';
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

let visual: PolarChartVisual;
let constructorOpts: ReturnType<typeof createConstructorOptions>;

beforeEach(() => {
  constructorOpts = createConstructorOptions();
  visual = new PolarChartVisual(constructorOpts as never);
});

afterEach(() => {
  visual.destroy();
  constructorOpts.element.remove();
});

describe('PolarChartVisual', () => {
  it('constructs without error', () => {
    expect(visual).toBeDefined();
  });

  it('handles empty data', () => {
    const dv = DataViewBuilder.empty();
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('renders sample data', () => {
    const dv = DataViewBuilder.singleCategoryMeasure(['N','E','S','W'], [10,20,15,25], { categoryRole: 'category', valueRole: 'measure' });
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('returns formatting model', () => {
    const dv = DataViewBuilder.singleCategoryMeasure(['N','E','S','W'], [10,20,15,25], { categoryRole: 'category', valueRole: 'measure' });
    visual.update(createUpdateOptions([dv]) as never);
    const model = visual.getFormattingModel();
    expect(model).toBeDefined();
  });

  it('re-renders without error', () => {
    const dv = DataViewBuilder.singleCategoryMeasure(['N','E','S','W'], [10,20,15,25], { categoryRole: 'category', valueRole: 'measure' });
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
      DataViewBuilder.singleCategoryMeasure(['N'], [10], { categoryRole: 'category', valueRole: 'measure' }),
    ]);

    visual.update(updateOptions as never);

    expect(started).toHaveBeenCalledWith(updateOptions);
    expect(finished).toHaveBeenCalledWith(updateOptions);
  });

  it('renders all-zero data without NaN geometry', () => {
    const settings = new PolarChartSettings();
    settings.animationSettings.enabled.value = false;
    settingsRef.current = settings;
    const dv = DataViewBuilder.singleCategoryMeasure(
      ['N','E','S','W'],
      [0,0,0,0],
      { categoryRole: 'category', valueRole: 'measure' },
    );

    visual.update(createUpdateOptions([dv]) as never);

    const petals = Array.from(constructorOpts.element.querySelectorAll<SVGPathElement>('.polar-petal'));
    expect(petals).toHaveLength(4);
    expect(petals.every((petal) => !(petal.getAttribute('d') ?? '').includes('NaN'))).toBe(true);
  });

  it('uses content padding once and keeps the SVG inside the viewport', () => {
    const settings = new PolarChartSettings();
    settings.cardSettings.contentPadding.value = 10;
    settings.animationSettings.enabled.value = false;
    settingsRef.current = settings;
    const dv = DataViewBuilder.singleCategoryMeasure(
      ['N','S'],
      [10,20],
      { categoryRole: 'category', valueRole: 'measure' },
    );

    visual.update(createUpdateOptions([dv], { width: 200, height: 120 }) as never);

    const svg = constructorOpts.element.querySelector<SVGSVGElement>('.polar-svg');
    expect(svg?.getAttribute('width')).toBe('180');
    expect(svg?.getAttribute('height')).toBe('100');
    expect(constructorOpts.element.style.padding).toBe('10px');
  });

  it('makes petals focusable and applies selection dimming immediately', async () => {
    const selectionManager = (constructorOpts.host as Record<string, unknown>).__selectionManager as {
      select: (...args: unknown[]) => unknown;
      clear: () => Promise<void>;
    };
    const select = vi.spyOn(selectionManager, 'select');
    const settings = new PolarChartSettings();
    settings.animationSettings.enabled.value = false;
    settingsRef.current = settings;
    const dv = DataViewBuilder.singleCategoryMeasure(
      ['N','E','S'],
      [10,20,30],
      { categoryRole: 'category', valueRole: 'measure' },
    );
    visual.update(createUpdateOptions([dv]) as never);
    const petals = Array.from(constructorOpts.element.querySelectorAll<SVGPathElement>('.polar-petal'));

    expect(petals.every((petal) => petal.getAttribute('tabindex') === '0')).toBe(true);
    expect(petals.every((petal) => petal.getAttribute('role') === 'listitem')).toBe(true);
    expect(petals.every((petal) => (petal.getAttribute('aria-label') ?? '').includes('Item'))).toBe(true);
    petals[0]?.focus();
    petals[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(select).toHaveBeenCalledOnce();
    await Promise.resolve();
    await selectionManager.clear();
    petals[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
    expect(petals[1]?.style.opacity).toBe('0.3');

    constructorOpts.element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
    expect(petals.every((petal) => petal.style.opacity === '')).toBe(true);
  });

  it('keeps radial labels inside the viewport and preserves their full text', () => {
    const settings = new PolarChartSettings();
    settings.animationSettings.enabled.value = false;
    settings.labelSettings.showRadialLabels.value = true;
    settings.labelSettings.showInnerLabels.value = false;
    settings.dataLabelFormattingCard.showDataLabels.value = false;
    settingsRef.current = settings;
    const fullLabel = 'A very long polar category name';
    const dv = DataViewBuilder.singleCategoryMeasure(
      [fullLabel, 'East', 'South', 'West'],
      [10,20,15,25],
      { categoryRole: 'category', valueRole: 'measure' },
    );

    visual.update(createUpdateOptions([dv], { width: 220, height: 220 }) as never);

    const label = Array.from(constructorOpts.element.querySelectorAll<SVGTextElement>('.polar-radial-label'))
      .find((element) => element.querySelector('title')?.textContent === fullLabel);
    expect(label?.textContent).toContain('…');
    expect(label?.querySelector('title')?.textContent).toBe(fullLabel);
  });

  it('honors disabled host interactions for petal selection', () => {
    (constructorOpts.host.hostCapabilities as { allowInteractions: boolean }).allowInteractions = false;
    const selectionManager = (constructorOpts.host as Record<string, unknown>).__selectionManager as {
      select: (...args: unknown[]) => unknown;
    };
    const select = vi.spyOn(selectionManager, 'select');
    const dv = DataViewBuilder.singleCategoryMeasure(
      ['N'],
      [10],
      { categoryRole: 'category', valueRole: 'measure' },
    );
    visual.update(createUpdateOptions([dv]) as never);

    constructorOpts.element.querySelector<SVGPathElement>('.polar-petal')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(select).not.toHaveBeenCalled();
  });
});
