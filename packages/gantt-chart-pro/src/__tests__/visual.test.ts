import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GanttChartProVisual } from '../visual';
import { GanttChartProSettings } from '../settings';
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

let visual: GanttChartProVisual;
let constructorOpts: ReturnType<typeof createConstructorOptions>;

beforeEach(() => {
  constructorOpts = createConstructorOptions();
  visual = new GanttChartProVisual(constructorOpts as never);
});

afterEach(() => {
  visual.destroy();
  constructorOpts.element.remove();
});

describe('GanttChartProVisual', () => {
  it('constructs without error', () => {
    expect(visual).toBeDefined();
  });

  it('handles empty data', () => {
    const dv = DataViewBuilder.empty();
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('shows required-field guidance for a partial Gantt setup', () => {
    const dv = new DataViewBuilder()
      .withCategory('Task', ['Task A'], 'taskName')
      .build();

    visual.update(createUpdateOptions([dv]) as never);

    expect(constructorOpts.element.querySelector('.gantt-empty')?.textContent)
      .toContain('Add Task Name, Start Date, and End Date fields');
  });

  it('shows no data when all required fields are bound but filtered empty', () => {
    const dv = new DataViewBuilder()
      .withCategory('Task', [], 'taskName')
      .withValues('Start', [], 'startDate')
      .withValues('End', [], 'endDate')
      .build();

    visual.update(createUpdateOptions([dv]) as never);

    expect(constructorOpts.element.querySelector('.gantt-empty')?.textContent)
      .toBe('No data for the current selection.');
    expect(constructorOpts.element.getAttribute('aria-label')).toContain('0 data points');
  });

  it('renders sample data', () => {
    const dv = new DataViewBuilder().withCategory('Task', ['Task A','Task B'], 'taskName').withValues('Start', [1,3], 'startDate').withValues('End', [3,6], 'endDate').build();
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
    const firstTick = constructorOpts.element.querySelector('.gantt-tick-label') as HTMLElement | null;
    expect(firstTick?.style.left).toBe('128px');
    const firstBar = constructorOpts.element.querySelector('.gantt-bar') as HTMLElement | null;
    expect(firstBar?.style.left).toBe('0px');
  });

  it('excludes reversed date ranges instead of drawing misleading bars', () => {
    const dv = new DataViewBuilder()
      .withCategory('Task', ['Valid', 'Reversed'], 'taskName')
      .withValues('Start', [1, 8], 'startDate')
      .withValues('End', [4, 2], 'endDate')
      .build();

    visual.update(createUpdateOptions([dv]) as never);

    expect(constructorOpts.element.querySelectorAll('.gantt-task-row')).toHaveLength(1);
    expect(constructorOpts.element.textContent).toContain('Valid');
    expect(constructorOpts.element.textContent).not.toContain('Reversed');
  });

  it('makes task rows keyboard focusable with useful labels', () => {
    const dv = new DataViewBuilder()
      .withCategory('Task', ['Task A'], 'taskName')
      .withValues('Start', [1], 'startDate')
      .withValues('End', [3], 'endDate')
      .withValues('Progress', [50], 'progress')
      .build();

    visual.update(createUpdateOptions([dv]) as never);

    const row = constructorOpts.element.querySelector<HTMLElement>('.gantt-task-row');
    expect(row?.tabIndex).toBe(0);
    expect(row?.getAttribute('aria-label')).toContain('Task A');
    expect(row?.getAttribute('aria-label')).toContain('50% complete');
  });

  it('does not select tasks when host interactions are disabled', () => {
    (constructorOpts.host.hostCapabilities as { allowInteractions: boolean }).allowInteractions = false;
    const dv = new DataViewBuilder()
      .withCategory('Task', ['Task A'], 'taskName')
      .withValues('Start', [1], 'startDate')
      .withValues('End', [3], 'endDate')
      .build();
    visual.update(createUpdateOptions([dv]) as never);

    constructorOpts.element.querySelector<HTMLElement>('.gantt-task-row')?.click();

    const selectionManager = constructorOpts.host.__selectionManager as {
      __selectionState: () => unknown[];
    };
    expect(selectionManager.__selectionState()).toHaveLength(0);
  });

  it('uses host high-contrast colors for task bars and labels', () => {
    const palette = constructorOpts.host.colorPalette as {
      isHighContrast: boolean;
      foreground: { value: string };
      background: { value: string };
    };
    palette.isHighContrast = true;
    palette.foreground = { value: '#FFFF00' };
    palette.background = { value: '#000000' };
    const dv = new DataViewBuilder()
      .withCategory('Task', ['Task A'], 'taskName')
      .withValues('Start', [1], 'startDate')
      .withValues('End', [3], 'endDate')
      .build();

    visual.update(createUpdateOptions([dv]) as never);

    expect(constructorOpts.element.style.backgroundColor).toBe('rgb(0, 0, 0)');
    expect(constructorOpts.element.querySelector<HTMLElement>('.gantt-task-label')?.style.color)
      .toBe('rgb(255, 255, 0)');
    const bar = constructorOpts.element.querySelector<HTMLElement>('.gantt-bar');
    expect(bar?.style.backgroundColor).toBe('rgb(0, 0, 0)');
    expect(bar?.style.borderColor).toBe('rgb(255, 255, 0)');
  });

  it('returns formatting model', () => {
    const dv = new DataViewBuilder().withCategory('Task', ['Task A','Task B'], 'taskName').withValues('Start', [1,3], 'startDate').withValues('End', [3,6], 'endDate').build();
    visual.update(createUpdateOptions([dv]) as never);
    const model = visual.getFormattingModel();
    expect(model).toBeDefined();
  });

  it('re-renders without error', () => {
    const dv = new DataViewBuilder().withCategory('Task', ['Task A','Task B'], 'taskName').withValues('Start', [1,3], 'startDate').withValues('End', [3,6], 'endDate').build();
    visual.update(createUpdateOptions([dv]) as never);
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('drills into hierarchy and drills back up without selecting the drill control', () => {
    const dv = new DataViewBuilder()
      .withCategory('Task', ['Task A', 'Task B', 'Task C', 'Task D'], 'taskName')
      .withValues('Start', [1, 2, 3, 4], 'startDate')
      .withValues('End', [5, 6, 7, 8], 'endDate')
      .withValues('Parent Task', [null, 'Task A', 'Task A', null] as unknown as (number | null)[], 'parentTask')
      .build();

    visual.update(createUpdateOptions([dv]) as never);

    const selectionManager = (constructorOpts.host as Record<string, unknown>).__selectionManager as {
      __selectionState: () => unknown[];
    };

    const drillToggle = constructorOpts.element.querySelector('.gantt-drill-toggle') as HTMLElement | null;
    expect(drillToggle).toBeTruthy();
    expect(selectionManager.__selectionState()).toHaveLength(0);

    drillToggle?.click();

    expect(selectionManager.__selectionState()).toHaveLength(0);

    const drilledRows = constructorOpts.element.querySelectorAll('.gantt-task-row');
    expect(drilledRows).toHaveLength(2);

    const breadcrumb = constructorOpts.element.querySelector('.gantt-breadcrumb') as HTMLElement | null;
    expect(breadcrumb?.textContent).toContain('All');
    expect(breadcrumb?.textContent).toContain('Task A');

    const allCrumb = breadcrumb?.querySelector('span') as HTMLElement | null;
    allCrumb?.click();

    const resetRows = constructorOpts.element.querySelectorAll('.gantt-task-row');
    expect(resetRows).toHaveLength(4);
  });

  it('hides inactive card appearance controls but keeps content padding available', () => {
    visual.update(createUpdateOptions([DataViewBuilder.empty()]) as never);
    const settings = (visual as unknown as { settings: GanttChartProSettings }).settings;
    settings.cardSettings.cardStyleMode.value = { value: 'none', displayName: 'None' };

    visual.getFormattingModel();

    expect(settings.cardSettings.backgroundColor.visible).toBe(false);
    expect(settings.cardSettings.backgroundOpacity.visible).toBe(false);
    expect(settings.cardSettings.borderRadius.visible).toBe(false);
    expect(settings.cardSettings.contentPadding.visible).not.toBe(false);
  });

  it('migrates legacy task and today-line properties', () => {
    const dv = DataViewBuilder.empty();
    dv.metadata.objects = {
      ganttSettings: {
        barOpacity: 65,
        barCornerRadius: 5,
        rowGap: 7,
        labelWidth: 180,
        todayLineWidth: 4,
        todayLineStyle: 'dashed',
      },
    } as never;

    visual.update(createUpdateOptions([dv]) as never);
    const settings = (visual as unknown as { settings: GanttChartProSettings }).settings;

    expect(settings.taskBarSettings.barOpacity.value).toBe(65);
    expect(settings.taskBarSettings.barCornerRadius.value).toBe(5);
    expect(settings.taskBarSettings.rowGap.value).toBe(7);
    expect(settings.taskBarSettings.labelWidth.value).toBe(180);
    expect(settings.ganttTodaySettings.todayLineWidth.value).toBe(4);
    expect(settings.ganttTodaySettings.todayLineStyle.value.value).toBe('dashed');
  });
});
