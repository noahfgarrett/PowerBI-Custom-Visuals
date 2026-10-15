import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ScatterBubbleVisual } from '../visual';
import { ScatterBubbleSettings } from '../settings';
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

let visual: ScatterBubbleVisual;
let constructorOpts: ReturnType<typeof createConstructorOptions>;

beforeEach(() => {
  constructorOpts = createConstructorOptions();
  visual = new ScatterBubbleVisual(constructorOpts as never);
});

afterEach(() => {
  visual.destroy();
  constructorOpts.element.remove();
});

describe('ScatterBubbleVisual', () => {
  it('constructs without error', () => {
    expect(visual).toBeDefined();
  });

  it('handles empty data', () => {
    const dv = DataViewBuilder.empty();
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('renders a landing page when no data is bound', () => {
    const dv = DataViewBuilder.empty();
    visual.update(createUpdateOptions([dv]) as never);

    expect(constructorOpts.element.querySelector('.pbi-landing-page-title')?.textContent).toBe('Add data to build a scatter plot');
    expect(constructorOpts.element.querySelector('.pbi-landing-page-description')?.textContent).toContain('Compare two measures on X and Y');
    expect(constructorOpts.element.querySelectorAll('.pbi-landing-page-steps li')).toHaveLength(3);
  });

  it('renders sample data', () => {
    const dv = new DataViewBuilder().withCategory('Item', ['A','B','C'], 'category').withValues('X', [10,20,30], 'xValue').withValues('Y', [5,15,25], 'yValue').withValues('Size', [100,200,150], 'size').build();
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('returns formatting model', () => {
    const dv = new DataViewBuilder().withCategory('Item', ['A','B','C'], 'category').withValues('X', [10,20,30], 'xValue').withValues('Y', [5,15,25], 'yValue').withValues('Size', [100,200,150], 'size').build();
    visual.update(createUpdateOptions([dv]) as never);
    const model = visual.getFormattingModel();
    expect(model).toBeDefined();
  });

  it('re-renders without error', () => {
    const dv = new DataViewBuilder().withCategory('Item', ['A','B','C'], 'category').withValues('X', [10,20,30], 'xValue').withValues('Y', [5,15,25], 'yValue').withValues('Size', [100,200,150], 'size').build();
    visual.update(createUpdateOptions([dv]) as never);
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('reports rendering lifecycle events to the host', () => {
    const eventService = constructorOpts.host.eventService as {
      renderingStarted: ReturnType<typeof vi.fn>;
      renderingFinished: ReturnType<typeof vi.fn>;
      renderingFailed: ReturnType<typeof vi.fn>;
    };
    const startedSpy = vi.spyOn(eventService, 'renderingStarted');
    const finishedSpy = vi.spyOn(eventService, 'renderingFinished');
    const failedSpy = vi.spyOn(eventService, 'renderingFailed');

    const dv = new DataViewBuilder()
      .withCategory('Item', ['A', 'B', 'C'], 'category')
      .withValues('X', [10, 20, 30], 'xValue')
      .withValues('Y', [5, 15, 25], 'yValue')
      .withValues('Size', [100, 200, 150], 'size')
      .build();
    const updateOptions = createUpdateOptions([dv]) as never;

    visual.update(updateOptions);

    expect(startedSpy).toHaveBeenCalledWith(updateOptions);
    expect(finishedSpy).toHaveBeenCalledWith(updateOptions);
    expect(failedSpy).not.toHaveBeenCalled();
  });

  it('uses the host tooltip service for bubble hover interactions', () => {
    const dv = new DataViewBuilder()
      .withCategory('Item', ['A', 'B', 'C'], 'category')
      .withValues('X', [10, 20, 30], 'xValue')
      .withValues('Y', [5, 15, 25], 'yValue')
      .withValues('Size', [100, 200, 150], 'size')
      .build();

    visual.update(createUpdateOptions([dv]) as never);

    const tooltipService = constructorOpts.host.tooltipService as {
      show: ReturnType<typeof vi.fn>;
      move: ReturnType<typeof vi.fn>;
      hide: ReturnType<typeof vi.fn>;
    };
    const showSpy = vi.spyOn(tooltipService, 'show');
    const moveSpy = vi.spyOn(tooltipService, 'move');
    const hideSpy = vi.spyOn(tooltipService, 'hide');

    const point = constructorOpts.element.querySelector('.scatter-bubble-point') as SVGCircleElement | null;
    expect(point).not.toBeNull();

    point?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, clientX: 120, clientY: 140 }));
    point?.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 132, clientY: 152 }));
    point?.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));

    expect(showSpy).toHaveBeenCalledTimes(1);
    expect(showSpy).toHaveBeenCalledWith(expect.objectContaining({
      coordinates: [120, 140],
      isTouchEvent: false,
      identities: [expect.objectContaining({ getKey: expect.any(Function) })],
      dataItems: expect.arrayContaining([
        expect.objectContaining({ displayName: 'Point', value: 'A' }),
        expect.objectContaining({ displayName: 'X', value: expect.any(String) }),
        expect.objectContaining({ displayName: 'Y', value: expect.any(String) }),
      ]),
    }));
    expect(moveSpy).toHaveBeenCalledWith(expect.objectContaining({
      coordinates: [132, 152],
      isTouchEvent: false,
    }));
    expect(hideSpy).toHaveBeenCalledWith({ immediately: true, isTouchEvent: false });
    expect(constructorOpts.element.querySelector('.scatter-bubble-tooltip')).toBeNull();
  });

  it('exposes focusable points with coordinates and supports keyboard selection', () => {
    const dv = new DataViewBuilder()
      .withCategory('Item', ['A', 'B'], 'category')
      .withValues('X', [10, 20], 'xValue')
      .withValues('Y', [5, 15], 'yValue')
      .build();
    visual.update(createUpdateOptions([dv]) as never);

    const point = constructorOpts.element.querySelector<SVGCircleElement>('.scatter-bubble-point');
    expect(point?.getAttribute('tabindex')).toBe('0');
    expect(point?.getAttribute('role')).toBe('listitem');
    expect(point?.getAttribute('aria-label')).toContain('X 10');

    const manager = constructorOpts.host.__selectionManager as { getSelectionIds: () => unknown[] };
    const activeElementSpy = vi.spyOn(document, 'activeElement', 'get').mockReturnValue(point!);
    point?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    activeElementSpy.mockRestore();
    expect(manager.getSelectionIds()).toHaveLength(1);
  });

  it('uses minimum radius as the fixed bubble size and dims matching labels with selection', () => {
    const settings = new ScatterBubbleSettings();
    settings.animationSettings.enabled.value = false;
    settings.scatterSettings.minRadius.value = 11;
    settings.dataLabelFormattingCard.showDataLabels.value = true;
    (visual as unknown as {
      formattingSettingsService: {
        populateFormattingSettingsModel: () => ScatterBubbleSettings;
      };
    }).formattingSettingsService.populateFormattingSettingsModel = () => settings;

    const dv = new DataViewBuilder()
      .withCategory('Item', ['A', 'B'], 'category')
      .withValues('X', [10, 20], 'xValue')
      .withValues('Y', [5, 15], 'yValue')
      .build();
    visual.update(createUpdateOptions([dv]) as never);

    const points = Array.from(constructorOpts.element.querySelectorAll<SVGCircleElement>('.scatter-bubble-point'));
    const labels = Array.from(constructorOpts.element.querySelectorAll<SVGTextElement>('.scatter-bubble-label'));
    expect(points[0].getAttribute('r')).toBe('11');
    expect(settings.scatterSettings.maxRadius.visible).toBe(false);

    points[0].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(points[1].style.opacity).toBe('0.3');
    expect(labels[1].style.opacity).toBe('0.3');
  });

  it('migrates legacy trend-line metadata without overriding modern settings', () => {
    const dv = new DataViewBuilder()
      .withCategory('Item', ['A', 'B'], 'category')
      .withValues('X', [10, 20], 'xValue')
      .withValues('Y', [5, 15], 'yValue')
      .build() as {
        metadata: {
          objects?: Record<string, Record<string, unknown>>;
        };
      };
    dv.metadata.objects = {
      trendLineFormatting: {
        showTrendLine: true,
        trendLineType: 'polynomial',
        polynomialOrder: 3,
        trendLineWidth: 4,
        showEquation: true,
      },
    };

    visual.update(createUpdateOptions([dv as never]) as never);

    const settings = (visual as unknown as { settings: ScatterBubbleSettings }).settings;
    expect(settings.trendlineSettings.show.value).toBe(true);
    expect(settings.trendlineSettings.type.value.value).toBe('polynomial');
    expect(settings.trendlineSettings.polynomialOrder.value).toBe(3);
    expect(settings.trendlineSettings.lineWidth.value).toBe(4);
    expect(settings.trendlineSettings.showEquation.value).toBe(true);
  });

  it('respects host allowInteractions=false for point and background actions', () => {
    (constructorOpts.host.hostCapabilities as { allowInteractions: boolean }).allowInteractions = false;

    const dv = new DataViewBuilder()
      .withCategory('Item', ['A', 'B', 'C'], 'category')
      .withValues('X', [10, 20, 30], 'xValue')
      .withValues('Y', [5, 15, 25], 'yValue')
      .withValues('Size', [100, 200, 150], 'size')
      .build();

    visual.update(createUpdateOptions([dv]) as never);

    const selectionManager = constructorOpts.host.__selectionManager as {
      select: ReturnType<typeof vi.fn>;
      clear: ReturnType<typeof vi.fn>;
      showContextMenu: ReturnType<typeof vi.fn>;
    };
    const selectSpy = vi.spyOn(selectionManager, 'select');
    const clearSpy = vi.spyOn(selectionManager, 'clear');
    const contextSpy = vi.spyOn(selectionManager, 'showContextMenu');

    const point = constructorOpts.element.querySelector('.scatter-bubble-point') as SVGCircleElement | null;
    expect(point).not.toBeNull();

    point?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    point?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 60 }));
    constructorOpts.element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    constructorOpts.element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 20 }));

    expect(selectSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
    expect(contextSpy).not.toHaveBeenCalled();
  });

  it('renders bubbles with host high-contrast colors', () => {
    const palette = constructorOpts.host.colorPalette as {
      isHighContrast: boolean;
      foreground: { value: string };
      background: { value: string };
      foregroundSelected: { value: string };
      hyperlink: { value: string };
    };
    palette.isHighContrast = true;
    palette.foreground = { value: '#111111' };
    palette.background = { value: '#fefefe' };
    palette.foregroundSelected = { value: '#ff8800' };
    palette.hyperlink = { value: '#0066ff' };

    const dv = new DataViewBuilder()
      .withCategory('Item', ['A', 'B', 'C'], 'category')
      .withValues('X', [10, 20, 30], 'xValue')
      .withValues('Y', [5, 15, 25], 'yValue')
      .withValues('Size', [100, 200, 150], 'size')
      .build();

    visual.update(createUpdateOptions([dv]) as never);

    const point = constructorOpts.element.querySelector('.scatter-bubble-point') as SVGCircleElement | null;
    expect(point?.getAttribute('fill')).toBe('#fefefe');
    expect(point?.getAttribute('stroke')).toBe('#111111');
    expect(point?.getAttribute('stroke-width')).toBe('2');
    expect(constructorOpts.element.style.backgroundColor).toBe('rgb(254, 254, 254)');
  });
});
