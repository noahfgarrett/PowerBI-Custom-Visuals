import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TimelineMilestoneVisual } from '../visual';
import { TimelineMilestoneSettings } from '../settings';
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
          const ref = settingsRef.current;
          settingsRef.current = undefined;
          return ref;
        }
        return new ModelClass();
      }
      buildFormattingModel(settings: { cards: unknown[] }) { return { cards: settings.cards?.map((c: unknown) => ({ displayName: (c as Record<string, unknown>)['displayName'], name: (c as Record<string, unknown>)['name'] })) ?? [] }; }
    },
  };
});

let visual: TimelineMilestoneVisual;
let constructorOpts: ReturnType<typeof createConstructorOptions>;

beforeEach(() => {
  constructorOpts = createConstructorOptions();
  visual = new TimelineMilestoneVisual(constructorOpts as never);
});

afterEach(() => {
  visual.destroy();
  constructorOpts.element.remove();
});

describe('TimelineMilestoneVisual', () => {
  it('constructs without error', () => {
    expect(visual).toBeDefined();
  });

  it('handles empty data', () => {
    const dv = DataViewBuilder.empty();
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('asks for the required date when only an optional label is bound', () => {
    const dv = new DataViewBuilder()
      .withCategory('Label', ['Plan'], 'label')
      .build();

    visual.update(createUpdateOptions([dv]) as never);

    expect(constructorOpts.element.querySelector('.timeline-empty')?.textContent)
      .toBe('Add a Date field; Label is optional.');
  });

  it('shows no data when the date field is bound but filtered empty', () => {
    const dv = new DataViewBuilder()
      .withCategory('Date', [], 'date')
      .build();

    visual.update(createUpdateOptions([dv]) as never);

    expect(constructorOpts.element.querySelector('.timeline-empty')?.textContent)
      .toBe('No data for the current selection.');
  });

  it('renders sample data', () => {
    const dv = new DataViewBuilder().withCategory('Date', ['2024-01-01','2024-06-01','2024-12-01'], 'date').withCategory('Label', ['Start','Mid','End'], 'label').build();
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
    const spine = constructorOpts.element.querySelector('svg line') as SVGLineElement | null;
    expect(spine?.getAttribute('x1')).toBe('40');
  });

  it('positions milestones proportionally to their dates', () => {
    const settings = new TimelineMilestoneSettings();
    settings.animationSettings.enabled.value = false;
    settingsRef.current = settings;
    const dv = new DataViewBuilder()
      .withCategory('Date', ['2024-01-01', '2024-01-02', '2024-01-11'], 'date')
      .withCategory('Label', ['Start', 'Early', 'End'], 'label')
      .build();

    visual.update(createUpdateOptions([dv]) as never);

    const positions = Array.from(constructorOpts.element.querySelectorAll<SVGCircleElement>('.timeline-marker'))
      .map((marker) => Number(marker.getAttribute('cx')));
    expect(positions).toHaveLength(3);
    expect((positions[1] - positions[0]) / (positions[2] - positions[0])).toBeCloseTo(0.1, 4);
  });

  it('excludes invalid dates instead of stacking them at an arbitrary position', () => {
    const dv = new DataViewBuilder()
      .withCategory('Date', ['not-a-date', '2024-01-02'], 'date')
      .withCategory('Label', ['Invalid', 'Valid'], 'label')
      .build();

    visual.update(createUpdateOptions([dv]) as never);

    expect(constructorOpts.element.querySelectorAll('.timeline-marker')).toHaveLength(1);
  });

  it('provides one keyboard focus target and accessible label per milestone', () => {
    const dv = new DataViewBuilder()
      .withCategory('Date', ['2024-01-01', '2024-01-02'], 'date')
      .withCategory('Label', ['Start', 'End'], 'label')
      .build();

    visual.update(createUpdateOptions([dv]) as never);

    const markers = constructorOpts.element.querySelectorAll<SVGElement>('.timeline-marker');
    expect(markers).toHaveLength(2);
    expect(markers[0].getAttribute('tabindex')).toBe('0');
    expect(markers[0].getAttribute('aria-label')).toContain('Start');
    expect(constructorOpts.element.querySelectorAll('[tabindex="0"]')).toHaveLength(2);
  });

  it('does not select milestones when host interactions are disabled', () => {
    (constructorOpts.host.hostCapabilities as { allowInteractions: boolean }).allowInteractions = false;
    const selectionManager = constructorOpts.host.__selectionManager as Record<string, unknown>;
    const select = vi.fn(() => Promise.resolve([]));
    selectionManager.select = select;
    const dv = new DataViewBuilder()
      .withCategory('Date', ['2024-01-01'], 'date')
      .withCategory('Label', ['Start'], 'label')
      .build();

    visual.update(createUpdateOptions([dv]) as never);
    constructorOpts.element.querySelector<SVGElement>('.timeline-marker')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(select).not.toHaveBeenCalled();
    expect((constructorOpts.element.querySelector('.timeline-marker') as SVGElement).style.cursor).toBe('default');
  });

  it('keeps selection dimming in sync after a milestone is selected', async () => {
    const settings = new TimelineMilestoneSettings();
    settings.animationSettings.enabled.value = false;
    settingsRef.current = settings;
    const dv = new DataViewBuilder()
      .withCategory('Date', ['2024-01-01', '2024-01-02'], 'date')
      .withCategory('Label', ['Start', 'End'], 'label')
      .build();

    visual.update(createUpdateOptions([dv]) as never);
    const markers = constructorOpts.element.querySelectorAll<SVGElement>('.timeline-marker');
    markers[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();

    expect(markers[0].style.opacity).toBe('');
    expect(markers[1].style.opacity).toBe('0.3');
  });

  it('places categorized milestones on distinct swimlanes', () => {
    const settings = new TimelineMilestoneSettings();
    settings.animationSettings.enabled.value = false;
    settings.spineAndConnectorsSettings.showSwimlanes.value = true;
    settingsRef.current = settings;
    const dv = new DataViewBuilder()
      .withCategory('Date', ['2024-01-01', '2024-01-02'], 'date')
      .withCategory('Label', ['Start', 'End'], 'label')
      .withCategory('Category', ['Planning', 'Delivery'], 'category')
      .build();

    visual.update(createUpdateOptions([dv]) as never);

    const markers = constructorOpts.element.querySelectorAll<SVGCircleElement>('.timeline-marker');
    expect(markers[0].getAttribute('cy')).not.toBe(markers[1].getAttribute('cy'));
    expect(constructorOpts.element.querySelectorAll('.timeline-lane-spine')).toHaveLength(2);
  });

  it('returns formatting model', () => {
    const dv = new DataViewBuilder().withCategory('Date', ['2024-01-01','2024-06-01','2024-12-01'], 'date').withCategory('Label', ['Start','Mid','End'], 'label').build();
    visual.update(createUpdateOptions([dv]) as never);
    const model = visual.getFormattingModel();
    expect(model).toBeDefined();
  });

  it('re-renders without error', () => {
    const dv = new DataViewBuilder().withCategory('Date', ['2024-01-01','2024-06-01','2024-12-01'], 'date').withCategory('Label', ['Start','Mid','End'], 'label').build();
    visual.update(createUpdateOptions([dv]) as never);
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('supports milestone windowing for dense timelines', () => {
    const settings = new TimelineMilestoneSettings();
    settings.animationSettings.enabled.value = false;
    settings.timelineSettings.maxVisible.value = 2;
    settingsRef.current = settings;
    const dv = new DataViewBuilder()
      .withCategory('Date', ['2024-01-01','2024-03-01','2024-06-01','2024-12-01'], 'date')
      .withCategory('Label', ['Start','Plan','Mid','End'], 'label')
      .build();
    visual.update(createUpdateOptions([dv]) as never);
    expect(constructorOpts.element.querySelectorAll('svg circle').length).toBe(2);
  });

  it('hides inactive card appearance controls but keeps content padding available', () => {
    visual.update(createUpdateOptions([DataViewBuilder.empty()]) as never);
    const settings = (visual as unknown as { settings: TimelineMilestoneSettings }).settings;
    settings.cardSettings.cardStyleMode.value = { value: 'none', displayName: 'None' };

    visual.getFormattingModel();

    expect(settings.cardSettings.backgroundColor.visible).toBe(false);
    expect(settings.cardSettings.backgroundOpacity.visible).toBe(false);
    expect(settings.cardSettings.borderRadius.visible).toBe(false);
    expect(settings.cardSettings.contentPadding.visible).not.toBe(false);
  });

  it('migrates legacy timeline appearance properties', () => {
    const dv = DataViewBuilder.empty();
    dv.metadata.objects = {
      timelineSettings: {
        lineColor: { solid: { color: '#123456' } },
        lineWidth: 5,
        markerStrokeColor: { solid: { color: '#ABCDEF' } },
        labelColor: { solid: { color: '#654321' } },
      },
    } as never;

    visual.update(createUpdateOptions([dv]) as never);
    const settings = (visual as unknown as { settings: TimelineMilestoneSettings }).settings;

    expect(settings.spineAndConnectorsSettings.lineColor.value.value).toBe('#123456');
    expect(settings.spineAndConnectorsSettings.lineWidth.value).toBe(5);
    expect(settings.markerSettings.markerStrokeColor.value.value).toBe('#ABCDEF');
    expect(settings.spineAndConnectorsSettings.labelColor.value.value).toBe('#654321');
  });
});
