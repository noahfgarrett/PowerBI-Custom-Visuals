import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as d3 from 'd3';
import { StreamGraphVisual } from '../visual';
import { StreamGraphSettings } from '../settings';
import {
  createConstructorOptions,
  createUpdateOptions,
  DataViewBuilder,
} from '../../../core/src/__test-utils__';

const settingsRef: { current: unknown } = { current: undefined };

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

let visual: StreamGraphVisual;
let constructorOpts: ReturnType<typeof createConstructorOptions>;

beforeEach(() => {
  constructorOpts = createConstructorOptions();
  visual = new StreamGraphVisual(constructorOpts as never);
});

afterEach(() => {
  visual.destroy();
  constructorOpts.element.remove();
});

function multiSeriesDV() {
  return DataViewBuilder.multiSeries(
    ['A', 'B', 'C', 'D'],
    [
      { name: 'Revenue', values: [10, 20, 15, 25], role: 'measure' },
      { name: 'Cost', values: [8, 16, 12, 20], role: 'measure' },
    ],
    { categoryRole: 'category' },
  );
}

function highlightedMultiSeriesDV() {
  const dv = multiSeriesDV() as {
    categorical?: {
      values?: Array<{ highlights?: (number | null)[] }>;
    };
  };

  if (dv.categorical?.values) {
    dv.categorical.values[0].highlights = [null, 20, null, null];
    dv.categorical.values[1].highlights = [null, 16, null, null];
  }

  return dv;
}

function createSettings(
  legendPosition: 'top' | 'bottom' | 'left' | 'right' = 'bottom',
  showTitle = true,
) {
  const settings = new StreamGraphSettings();
  settings.titleFormattingCard.showTitle.value = showTitle;
  settings.legendFormattingCard.showLegend.value = true;
  settings.legendFormattingCard.legendPosition.value = {
    value: legendPosition,
    displayName: legendPosition.charAt(0).toUpperCase() + legendPosition.slice(1),
  };
  settings.crosshairFormattingCard.showCrosshair.value = true;
  settings.crosshairFormattingCard.showCrosshairValues.value = true;
  return settings;
}

function setSvgRect(svg: SVGSVGElement, width: number, height: number): void {
  Object.defineProperty(svg, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      left: 0,
      top: 0,
      right: width,
      bottom: height,
      width,
      height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  });
}

describe('StreamGraphVisual', () => {
  it('constructs without error', () => {
    expect(visual).toBeDefined();
  });

  it('handles empty data', () => {
    const dv = DataViewBuilder.empty();
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('renders sample data', () => {
    const dv = DataViewBuilder.singleCategoryMeasure(['A','B','C','D'], [10,20,15,25], { categoryRole: 'category', valueRole: 'measure' });
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('returns formatting model', () => {
    const dv = DataViewBuilder.singleCategoryMeasure(['A','B','C','D'], [10,20,15,25], { categoryRole: 'category', valueRole: 'measure' });
    visual.update(createUpdateOptions([dv]) as never);
    const model = visual.getFormattingModel();
    expect(model).toBeDefined();
  });

  it('re-renders without error', () => {
    const dv = DataViewBuilder.singleCategoryMeasure(['A','B','C','D'], [10,20,15,25], { categoryRole: 'category', valueRole: 'measure' });
    visual.update(createUpdateOptions([dv]) as never);
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('dims non-highlighted category slices when highlight data is present', () => {
    const dv = highlightedMultiSeriesDV();
    visual.update(createUpdateOptions([dv]) as never);

    const bands = Array.from(constructorOpts.element.querySelectorAll<SVGRectElement>('.stream-linked-band[data-selection-key]'));
    expect(bands).toHaveLength(4);
    expect(bands[0].style.opacity).toBe('0.18');
    expect(bands[1].style.opacity).toBe('0');
    expect(bands[2].style.opacity).toBe('0.18');
    expect(bands[3].style.opacity).toBe('0.18');
  });

  it('keeps crosshair markers inside the rendered stream layers', () => {
    settingsRef.current = createSettings();
    visual.update(createUpdateOptions([multiSeriesDV()]) as never);

    const svg = constructorOpts.element.querySelector<SVGSVGElement>('svg');
    const chartGroup = constructorOpts.element.querySelector<SVGGElement>('svg g');
    expect(svg).not.toBeNull();
    expect(chartGroup).not.toBeNull();

    setSvgRect(svg!, 600, 400);

    const transform = chartGroup!.getAttribute('transform') ?? '';
    const match = /translate\(([-\d.]+),([-\d.]+)\)/.exec(transform);
    const marginLeft = Number(match?.[1] ?? 0);
    const crosshairLine = constructorOpts.element.querySelector<SVGLineElement>('.crosshair-line');
    expect(crosshairLine).not.toBeNull();

    const rows = [
      { Revenue: 10, Cost: 8 },
      { Revenue: 20, Cost: 16 },
      { Revenue: 15, Cost: 12 },
      { Revenue: 25, Cost: 20 },
    ];
    const stacked = d3.stack<{ Revenue: number; Cost: number }>()
      .keys(['Revenue', 'Cost'])
      .offset(d3.stackOffsetWiggle)
      .order(d3.stackOrderNone)(rows);
    let yMin = Infinity;
    let yMax = -Infinity;
    stacked.forEach((layer) => {
      layer.forEach((point) => {
        yMin = Math.min(yMin, point[0]);
        yMax = Math.max(yMax, point[1]);
      });
    });
    const renderedInnerHeight = Number(crosshairLine!.getAttribute('y2'));
    const yScale = d3.scaleLinear()
      .domain([yMin, yMax])
      .range([renderedInnerHeight, 0]);
    const expectedMarkerYs = stacked
      .map((layer) => Number(yScale((layer[0][0] + layer[0][1]) / 2).toFixed(3)))
      .sort((a, b) => a - b);

    svg!.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true,
      clientX: marginLeft + 20,
      clientY: 40,
    }));

    const markers = Array.from(
      constructorOpts.element.querySelectorAll<SVGCircleElement>('.crosshair-markers circle'),
    )
      .map((marker) => Number(Number(marker.getAttribute('cy')).toFixed(3)))
      .sort((a, b) => a - b);
    expect(markers).toEqual(expectedMarkerYs);
  });

  it('anchors the legend on the left when requested', () => {
    settingsRef.current = createSettings('left');
    visual.update(createUpdateOptions([multiSeriesDV()]) as never);

    const wrapper = constructorOpts.element.querySelector<HTMLElement>('.stream-wrapper');
    const legend = constructorOpts.element.querySelector<HTMLElement>('.pbi-shared-legend');
    const svg = constructorOpts.element.querySelector('svg');

    expect(wrapper).not.toBeNull();
    expect(legend).not.toBeNull();
    expect(svg).not.toBeNull();
    expect(wrapper!.style.position).toBe('relative');
    expect(wrapper!.firstElementChild).toBe(legend);
    expect(legend!.style.position).toBe('absolute');
    expect(legend!.style.left).toBe('0px');
  });

  it('hides title pane controls when title is off', () => {
    const settings = createSettings('bottom', false);
    settingsRef.current = settings;
    visual.update(createUpdateOptions([multiSeriesDV()]) as never);

    expect(settings.titleFormattingCard.titleText.visible).toBe(false);
    expect(settings.titleFormattingCard.titleFontSize.visible).toBe(false);
    expect(settings.titleFormattingCard.subtitleText.visible).toBe(false);
    expect(settings.titleFormattingCard.subtitleFontWeight.visible).toBe(false);
  });

  it('removes card radius and hides appearance controls when card style is None', () => {
    const settings = createSettings();
    settings.cardSettings.cardStyleMode.value = { value: 'none', displayName: 'None' };
    settings.cardSettings.borderRadius.value = 24;
    settingsRef.current = settings;
    visual.update(createUpdateOptions([multiSeriesDV()]) as never);

    expect(settings.cardSettings.backgroundColor.visible).toBe(false);
    expect(settings.cardSettings.backgroundOpacity.visible).toBe(false);
    expect(settings.cardSettings.borderRadius.visible).toBe(false);
    expect(settings.cardSettings.contentPadding.visible).not.toBe(false);
    expect(constructorOpts.element.style.borderRadius).toBe('');
  });

  it('combines global and persisted series opacity in gradient fills', () => {
    const settings = createSettings();
    settings.animationSettings.enabled.value = false;
    settings.streamSettings.useGradient.value = true;
    settings.streamSettings.streamOpacity.value = 50;
    settings.streamDisplaySettings.sortOrder.value = {
      value: 'appearance',
      displayName: 'Source Order',
    };
    settingsRef.current = settings;

    const dv = multiSeriesDV() as {
      categorical?: {
        values?: Array<{
          source: {
            objects?: Record<string, Record<string, unknown>>;
          };
        }>;
      };
    };
    dv.categorical!.values![0].source.objects = {
      seriesFormatting: {
        seriesColor: { solid: { color: '#FF0000' } },
        seriesOpacity: 50,
      },
    };

    visual.update(createUpdateOptions([dv]) as never);

    const middleStop = constructorOpts.element.querySelector<SVGStopElement>(
      'linearGradient stop[offset="50%"]',
    );
    expect(middleStop?.getAttribute('stop-color')).toBe('#FF0000');
    expect(middleStop?.getAttribute('stop-opacity')).toBe('0.25');
  });

  it('uses category-relative percentages and focusable category bands', () => {
    const settings = createSettings();
    settings.animationSettings.enabled.value = false;
    settings.streamDisplaySettings.showPercentages.value = true;
    settingsRef.current = settings;
    const tooltipService = (constructorOpts.host as Record<string, unknown>).tooltipService as {
      show: (...args: unknown[]) => void;
    };
    const tooltipSpy = vi.spyOn(tooltipService, 'show');

    const dv = DataViewBuilder.multiSeries(
      ['A', 'B'],
      [
        { name: 'Revenue', values: [90, 10], role: 'measure' },
        { name: 'Cost', values: [10, 90], role: 'measure' },
      ],
      { categoryRole: 'category' },
    );
    visual.update(createUpdateOptions([dv]) as never);

    const bands = Array.from(
      constructorOpts.element.querySelectorAll<SVGRectElement>('.stream-linked-band'),
    );
    expect(bands).toHaveLength(2);
    expect(bands.every((band) => band.getAttribute('tabindex') === '0')).toBe(true);

    const chartGroup = constructorOpts.element.querySelector<SVGGElement>('svg > g');
    Object.defineProperty(chartGroup, 'getScreenCTM', {
      configurable: true,
      value: () => ({ inverse: () => ({}) }),
    });
    constructorOpts.element.querySelector<SVGPathElement>('.stream-layer')
      ?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: 0, clientY: 0 }));
    const tooltipCalls = tooltipSpy.mock.calls;
    const tooltipCall = tooltipCalls[tooltipCalls.length - 1]?.[0] as {
      dataItems?: Array<{ displayName: string; value: string }>;
    };
    expect(tooltipCall.dataItems).toContainEqual({
      displayName: '% of Category',
      value: '90.0%',
    });
  });

  it('does not select a category when host interactions are disabled', () => {
    ((constructorOpts.host as Record<string, unknown>).hostCapabilities as {
      allowInteractions: boolean;
    }).allowInteractions = false;
    visual.update(createUpdateOptions([multiSeriesDV()]) as never);

    constructorOpts.element.querySelector<SVGPathElement>('.stream-layer')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 10 }));
    const selectionManager = (constructorOpts.host as Record<string, unknown>).__selectionManager as {
      getSelectionIds: () => unknown[];
    };
    expect(selectionManager.getSelectionIds()).toHaveLength(0);
  });
});
