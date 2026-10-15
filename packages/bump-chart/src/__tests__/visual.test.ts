import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BumpChartVisual } from '../visual';
import { BumpChartSettings } from '../settings';
import {
  createConstructorOptions,
  createUpdateOptions,
  DataViewBuilder,
} from '../../../core/src/__test-utils__';

vi.mock('../../style/visual.less', () => ({}));

const settingsRef: { current: BumpChartSettings | undefined } = { current: undefined };

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

let visual: BumpChartVisual;
let constructorOpts: ReturnType<typeof createConstructorOptions>;

function getSelectionManager() {
  return (constructorOpts.host as Record<string, unknown>).__selectionManager as {
    getSelectionIds: () => unknown[];
  };
}

function selectionDataView() {
  return new DataViewBuilder()
    .withCategory('Item', ['A', 'B', 'A', 'B'], 'item')
    .withCategory('Time', ['T1', 'T1', 'T2', 'T2'], 'timeAxis')
    .withValues('Rank', [10, 5, 8, 12], 'measure')
    .build();
}

beforeEach(() => {
  constructorOpts = createConstructorOptions();
  visual = new BumpChartVisual(constructorOpts as never);
});

afterEach(() => {
  visual.destroy();
  constructorOpts.element.remove();
});

describe('BumpChartVisual', () => {
  it('constructs without error', () => {
    expect(visual).toBeDefined();
  });

  it('handles empty data', () => {
    const dv = DataViewBuilder.empty();
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('renders sample data', () => {
    const dv = new DataViewBuilder().withCategory('Item', ['A','B'], 'item').withCategory('Time', ['T1','T2'], 'timeAxis').withValues('Rank', [1,2], 'measure').build();
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('opens the empty-space context menu', () => {
    const dv = new DataViewBuilder().withCategory('Item', ['A','B'], 'item').withCategory('Time', ['T1','T2'], 'timeAxis').withValues('Rank', [1,2], 'measure').build();
    visual.update(createUpdateOptions([dv]) as never);
    const selectionManager = (constructorOpts.host as Record<string, unknown>).__selectionManager as {
      showContextMenu: (...args: unknown[]) => unknown;
    };
    const spy = vi.spyOn(selectionManager as any, 'showContextMenu');
    constructorOpts.element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 12, clientY: 34 }));
    expect(spy).toHaveBeenCalledWith({}, { x: 12, y: 34 });
  });

  it('returns formatting model', () => {
    const dv = new DataViewBuilder().withCategory('Item', ['A','B'], 'item').withCategory('Time', ['T1','T2'], 'timeAxis').withValues('Rank', [1,2], 'measure').build();
    visual.update(createUpdateOptions([dv]) as never);
    const model = visual.getFormattingModel();
    expect(model).toBeDefined();
  });

  it('re-renders without error', () => {
    const dv = new DataViewBuilder().withCategory('Item', ['A','B'], 'item').withCategory('Time', ['T1','T2'], 'timeAxis').withValues('Rank', [1,2], 'measure').build();
    visual.update(createUpdateOptions([dv]) as never);
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('selects a series from the widened line hit area', () => {
    visual.update(createUpdateOptions([selectionDataView()]) as never);

    const hitArea = constructorOpts.element.querySelector<SVGPathElement>('.bump-line-hit-area');
    expect(hitArea).not.toBeNull();

    hitArea!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(getSelectionManager().getSelectionIds()).toHaveLength(1);
  });

  it('uses global line width and allows period comparison independently', () => {
    const settings = new BumpChartSettings();
    settings.animationSettings.enabled.value = false;
    settings.bumpSettings.showArea.value = true;
    settings.lineStrokeFormattingCard.lineWidth.value = 7;
    settings.bumpRankChangeSettings.show.value = false;
    settings.bumpRankChangeSettings.showComparison.value = true;
    settingsRef.current = settings;

    visual.update(createUpdateOptions([selectionDataView()]) as never);

    expect(constructorOpts.element.querySelector('.bump-line')?.getAttribute('stroke-width')).toBe('7');
    expect(constructorOpts.element.querySelector('.bump-comparison-badge')).not.toBeNull();
  });

  it('preserves persisted series opacity across selection styling and enables keyboard focus', () => {
    const settings = new BumpChartSettings();
    settings.animationSettings.enabled.value = false;
    settings.bumpSettings.showArea.value = true;
    settingsRef.current = settings;

    const dv = selectionDataView() as {
      categorical?: {
        categories?: Array<{
          objects?: Array<Record<string, Record<string, unknown>> | undefined>;
        }>;
      };
    };
    dv.categorical!.categories![0].objects = [
      { seriesFormatting: { seriesOpacity: 40 } },
      { seriesFormatting: { seriesOpacity: 80 } },
      undefined,
      undefined,
    ];

    visual.update(createUpdateOptions([dv]) as never);

    const lines = Array.from(
      constructorOpts.element.querySelectorAll<SVGPathElement>('.bump-line'),
    );
    expect(lines.map((line) => line.style.opacity)).toEqual(['0.4', '0.8']);
    expect(lines.every((line) => line.getAttribute('tabindex') === '0')).toBe(true);
    expect(constructorOpts.element.querySelector('.bump-area')?.getAttribute('data-selection-key'))
      .toBeTruthy();
  });

  it('does not select a series when host interactions are disabled', () => {
    ((constructorOpts.host as Record<string, unknown>).hostCapabilities as {
      allowInteractions: boolean;
    }).allowInteractions = false;
    visual.update(createUpdateOptions([selectionDataView()]) as never);

    constructorOpts.element.querySelector<SVGPathElement>('.bump-line-hit-area')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(getSelectionManager().getSelectionIds()).toHaveLength(0);
  });
});
