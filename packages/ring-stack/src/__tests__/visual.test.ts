import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RingStackVisual } from '../visual';
import { RingStackSettings } from '../settings';
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

let visual: RingStackVisual;
let constructorOpts: ReturnType<typeof createConstructorOptions>;

beforeEach(() => {
  constructorOpts = createConstructorOptions();
  visual = new RingStackVisual(constructorOpts as never);
});

afterEach(() => {
  visual.destroy();
  constructorOpts.element.remove();
});

describe('RingStackVisual', () => {
  it('constructs without error', () => {
    expect(visual).toBeDefined();
  });

  it('handles empty data', () => {
    const dv = DataViewBuilder.empty();
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
    expect(constructorOpts.element.querySelector('.ring-stack-empty')?.textContent)
      .toContain('Add at least one measure');
  });

  it('distinguishes bound no-data from initial setup', () => {
    const dv = DataViewBuilder.measuresOnly([{ name: 'Ring 1', values: [null], role: 'measure1' }]);

    visual.update(createUpdateOptions([dv]) as never);

    expect(constructorOpts.element.querySelector('.ring-stack-empty')?.textContent)
      .toContain('No data for the current selection');
  });

  it('renders sample data', () => {
    const dv = DataViewBuilder.measuresOnly([{name:'Ring1',values:[80],role:'measure1'},{name:'Ring2',values:[60],role:'measure2'},{name:'Ring3',values:[40],role:'measure3'}]);
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
    expect(constructorOpts.element.querySelectorAll('.ring-stack-arc')).toHaveLength(3);
  });

  it('returns formatting model', () => {
    const dv = DataViewBuilder.measuresOnly([{name:'Ring1',values:[80],role:'measure1'},{name:'Ring2',values:[60],role:'measure2'},{name:'Ring3',values:[40],role:'measure3'}]);
    visual.update(createUpdateOptions([dv]) as never);
    const model = visual.getFormattingModel();
    expect(model).toBeDefined();
  });

  it('re-renders without error', () => {
    const dv = DataViewBuilder.measuresOnly([{name:'Ring1',values:[80],role:'measure1'},{name:'Ring2',values:[60],role:'measure2'},{name:'Ring3',values:[40],role:'measure3'}]);
    visual.update(createUpdateOptions([dv]) as never);
    expect(() => visual.update(createUpdateOptions([dv]) as never)).not.toThrow();
  });

  it('exposes only relevant center, side-label, animation, and card controls', () => {
    const settings = new RingStackSettings();
    settings.centerContentSettings.show.value = false;
    settings.ringSettings.showLabels.value = false;
    settings.animationSettings.enabled.value = false;
    settings.cardSettings.cardStyleMode.value = { value: 'none', displayName: 'None' };
    settingsRef.current = settings;
    const dv = DataViewBuilder.measuresOnly([{name:'Ring1',values:[80],role:'measure1'}]);
    visual.update(createUpdateOptions([dv]) as never);
    expect(settings.centerContentSettings.contentPadding.visible).toBe(false);
    expect(settings.sideLabelSettings.labelPadding.visible).toBe(false);
    expect(settings.animationSettings.duration.visible).toBe(false);
    expect(settings.cardSettings.borderRadius.visible).toBe(false);
    expect(settings.cardSettings.contentPadding.visible).not.toBe(false);
    expect(settings.dateFilterFormattingCard.visible).toBe(false);
    expect(settings.legendFormattingCard.showInlineLabels.visible).toBe(false);
    expect(settings.colorSettings.ring1Color.visible).toBe(true);
    expect(settings.colorSettings.ring2Color.visible).toBe(false);
    expect(settings.sortFormattingCard.visible).toBe(false);
  });

  it('does not let legacy glass override a persisted modern card style', () => {
    const settings = new RingStackSettings();
    settings.cardSettings.cardStyleMode.value = { value: 'floating', displayName: 'Floating' };
    settingsRef.current = settings;
    const dv = new DataViewBuilder().withValues('Ring 1', [80], 'measure1')
      .withMetadataObjects({ cardSettings: { enableGlass: false, cardStyleMode: 'floating' } }).build();
    visual.update(createUpdateOptions([dv]) as never);
    expect(settings.cardSettings.cardStyleMode.value.value).toBe('floating');
  });

  it('keeps all six rings visible in a small viewport', () => {
    const settings = new RingStackSettings();
    settings.animationSettings.enabled.value = false;
    settings.ringSettings.showLabels.value = false;
    settingsRef.current = settings;
    const dv = DataViewBuilder.measuresOnly([
      { name: 'Ring 1', values: [90], role: 'measure1' },
      { name: 'Ring 2', values: [80], role: 'measure2' },
      { name: 'Ring 3', values: [70], role: 'measure3' },
      { name: 'Ring 4', values: [60], role: 'measure4' },
      { name: 'Ring 5', values: [50], role: 'measure5' },
      { name: 'Ring 6', values: [40], role: 'measure6' },
    ]);

    visual.update(createUpdateOptions([dv], { width: 80, height: 80 }) as never);

    expect(constructorOpts.element.querySelectorAll('.ring-stack-arc')).toHaveLength(6);
    expect(Array.from(constructorOpts.element.querySelectorAll('.ring-stack-arc'))
      .every((arc) => Boolean(arc.getAttribute('d')))).toBe(true);
  });

  it('keeps the title outside the responsive chart body', () => {
    const settings = new RingStackSettings();
    settings.animationSettings.enabled.value = false;
    settings.titleFormattingCard.showTitle.value = true;
    settings.titleFormattingCard.titleText.value = 'Delivery Health';
    settingsRef.current = settings;
    const dv = DataViewBuilder.measuresOnly([{ name: 'Ring 1', values: [80], role: 'measure1' }]);

    visual.update(createUpdateOptions([dv]) as never);

    const title = constructorOpts.element.querySelector('.chart-title');
    const body = constructorOpts.element.querySelector('.ring-stack-body');
    expect(title?.parentElement).toBe(constructorOpts.element);
    expect(body?.querySelector('.ring-stack-svg')).toBeTruthy();
    expect(body?.contains(title ?? null)).toBe(false);
  });

  it('applies side-label typography to both names and values', () => {
    const settings = new RingStackSettings();
    settings.animationSettings.enabled.value = false;
    settings.sideLabelSettings.fontSize.value = 15;
    settings.sideLabelSettings.fontColor.value = { value: '#123456' };
    settings.sideLabelSettings.fontFamily.value = { value: 'Arial', displayName: 'Arial' };
    settings.sideLabelSettings.fontWeight.value = { value: 'bold', displayName: 'Bold' };
    settingsRef.current = settings;
    const dv = DataViewBuilder.measuresOnly([{ name: 'Delivery', values: [80], role: 'measure1' }]);

    visual.update(createUpdateOptions([dv]) as never);

    const row = constructorOpts.element.querySelector<HTMLElement>('.ring-label')!;
    expect(row.style.fontSize).toBe('15px');
    expect(row.style.color).toBe('rgb(18, 52, 86)');
    expect(row.style.fontFamily).toBe('Arial');
    expect(row.style.fontWeight).toBe('bold');
    expect(row.querySelector('.ring-label-name')?.textContent).toBe('Delivery');
  });

  it('supports keyboard selection and resets dimming after background clear', async () => {
    const settings = new RingStackSettings();
    settings.animationSettings.enabled.value = false;
    settingsRef.current = settings;
    const dv = DataViewBuilder.measuresOnly([
      { name: 'Ring 1', values: [80], role: 'measure1' },
      { name: 'Ring 2', values: [60], role: 'measure2' },
    ]);

    visual.update(createUpdateOptions([dv]) as never);
    const arcs = Array.from(constructorOpts.element.querySelectorAll<SVGPathElement>('.ring-stack-arc'));
    expect(arcs.map((arc) => arc.getAttribute('role'))).toEqual(['listitem', 'listitem']);
    expect(arcs.map((arc) => arc.getAttribute('tabindex'))).toEqual(['0', '0']);

    arcs[1].focus();
    arcs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await Promise.resolve();
    expect(arcs[0].style.opacity).toBe('0.3');
    expect(arcs[1].style.opacity).toBe('');

    constructorOpts.element.click();
    await Promise.resolve();
    expect(arcs[0].style.opacity).toBe('');
    expect(arcs[1].style.opacity).toBe('');
  });

  it('honors disabled interactions and host high-contrast colors', () => {
    const host = constructorOpts.host as Record<string, unknown>;
    (host.hostCapabilities as { allowInteractions: boolean }).allowInteractions = false;
    const palette = host.colorPalette as Record<string, unknown>;
    palette.isHighContrast = true;
    palette.foreground = { value: '#FFFFFF' };
    palette.foregroundSelected = { value: '#FFFF00' };
    palette.background = { value: '#000000' };
    palette.hyperlink = { value: '#00FFFF' };
    const settings = new RingStackSettings();
    settings.animationSettings.enabled.value = false;
    settingsRef.current = settings;
    const dv = DataViewBuilder.measuresOnly([{ name: 'Ring 1', values: [80], role: 'measure1' }]);

    visual.update(createUpdateOptions([dv]) as never);

    const arc = constructorOpts.element.querySelector<SVGPathElement>('.ring-stack-arc')!;
    expect(arc.getAttribute('tabindex')).toBeNull();
    expect(arc.getAttribute('fill')).toBe('#FFFF00');
    expect(arc.getAttribute('stroke')).toBe('#FFFFFF');
    arc.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const manager = host.__selectionManager as { __selectionState: () => unknown[] };
    expect(manager.__selectionState()).toHaveLength(0);
  });

  it('dims unmatched rings when Power BI supplies all-null highlights', () => {
    const settings = new RingStackSettings();
    settings.animationSettings.enabled.value = false;
    settingsRef.current = settings;
    const dv = DataViewBuilder.measuresOnly([{ name: 'Ring 1', values: [80], role: 'measure1' }]);
    (dv.categorical!.values![0] as unknown as { highlights: Array<number | null> }).highlights = [null];

    visual.update(createUpdateOptions([dv]) as never);

    expect(constructorOpts.element.querySelector<SVGPathElement>('.ring-stack-arc')?.style.opacity)
      .toBe('0.3');
  });

  it('provides selection identity for enhanced tooltips', () => {
    const tooltipService = constructorOpts.host.tooltipService as Record<string, ReturnType<typeof vi.fn>>;
    tooltipService.show = vi.fn();
    const settings = new RingStackSettings();
    settings.animationSettings.enabled.value = false;
    settingsRef.current = settings;
    const dv = DataViewBuilder.measuresOnly([{ name: 'Ring 1', values: [80], role: 'measure1' }]);

    visual.update(createUpdateOptions([dv]) as never);
    constructorOpts.element.querySelector<SVGPathElement>('.ring-stack-arc')!
      .dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, clientX: 20, clientY: 30 }));

    expect(tooltipService.show).toHaveBeenCalledOnce();
    expect(tooltipService.show.mock.calls[0][0].identities).toHaveLength(1);
  });
});
