import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FilterPaneProVisual } from '../visual';
import { FilterPaneProSettings } from '../settings';
import { buildBasicFilter, createAdvancedRule, extractFilterFields } from '../filter-model';
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
  class SliceBase {
    constructor(init?: Record<string, unknown>) { if (init) Object.assign(this, init); }
  }
  return {
    formattingSettings: {
      Model: FakeModel,
      SimpleCard: class { slices: unknown[] = []; },
      CompositeCard: class { groups: unknown[] = []; },
      Group: class { slices: unknown[] = []; constructor(init?: Record<string, unknown>) { if (init) Object.assign(this, init); } },
      ToggleSwitch: SliceBase,
      NumUpDown: SliceBase,
      ColorPicker: SliceBase,
      TextInput: SliceBase,
      ItemDropdown: SliceBase,
    },
    FormattingSettingsService: class {
      populateFormattingSettingsModel(ModelClass: new () => unknown) {
        if (settingsRef.current) {
          const settings = settingsRef.current;
          settingsRef.current = undefined;
          return settings;
        }
        return new ModelClass();
      }
      buildFormattingModel(settings: { cards: unknown[] }) { return { cards: settings.cards ?? [] }; }
    },
  };
});

let visual: FilterPaneProVisual;
let constructorOpts: ReturnType<typeof createConstructorOptions>;

function buildFilterDataView() {
  const dataView = new DataViewBuilder()
    .withCategory('Region', ['North', 'South', 'North', 'West'], 'filterCategory')
    .withCategory('Status', ['Open', 'Closed', 'Open', 'Review'], 'filterCategory')
    .withCategory('Issue Count', [1, 5, 2, 8], 'filterCategory')
    .withValues('Measure Only', [10, 20, 30, 40], 'filterMeasure')
    .build();
  dataView.categorical!.categories![2].source.type = { numeric: true };
  return dataView;
}

function getAppliedJsonFilters() {
  return (constructorOpts.host as Record<string, unknown>).__jsonFilters as Array<{
    filter: unknown;
    objectName: string;
    propertyName: string;
    action: number;
  }>;
}

function click(selector: string): void {
  const element = constructorOpts.element.querySelector<HTMLElement>(selector);
  expect(element).toBeTruthy();
  element!.click();
}

function expandField(fieldId: string): void {
  click(`[data-field-toggle="${fieldId}"]`);
}

function setInputValue(selector: string, value: string): void {
  const input = constructorOpts.element.querySelector<HTMLInputElement>(selector);
  expect(input).toBeTruthy();
  input!.value = value;
  input!.dispatchEvent(new Event('input', { bubbles: true }));
}

function useSettings(configure: (settings: FilterPaneProSettings) => void): void {
  const settings = new FilterPaneProSettings();
  configure(settings);
  settingsRef.current = settings;
}

beforeEach(() => {
  constructorOpts = createConstructorOptions();
  visual = new FilterPaneProVisual(constructorOpts as never);
});

afterEach(() => {
  visual.destroy();
  constructorOpts.element.remove();
});

describe('FilterPaneProVisual', () => {
  it('records JSON filter calls through the mock host', () => {
    visual.update(createUpdateOptions([buildFilterDataView()]) as never);
    const applyJsonFilter = (constructorOpts.host as Record<string, unknown>).applyJsonFilter as (
      filter: unknown,
      objectName: string,
      propertyName: string,
      action: number,
    ) => void;
    applyJsonFilter({ test: true }, 'general', 'filter', 0);
    expect(getAppliedJsonFilters()).toEqual([
      { filter: { test: true }, objectName: 'general', propertyName: 'filter', action: 0 },
    ]);
  });

  it('renders a centered SVG filter button and opens on the Basic tab', () => {
    visual.update(createUpdateOptions([buildFilterDataView()]) as never);

    expect(constructorOpts.element.querySelector('.filter-pane-trigger svg.filter-pane-trigger-icon')).toBeTruthy();
    expect(constructorOpts.element.querySelector('.filter-pane-shell')?.getAttribute('data-pointer-mode')).toBe('button-only');
    expect(constructorOpts.element.querySelector('.filter-pane-shell')?.getAttribute('data-overlay-state')).toBe('closed');
    expect(constructorOpts.element.querySelector('.filter-pane-backdrop')).toBeNull();
    click('.filter-pane-trigger');

    expect(constructorOpts.element.querySelector('.filter-pane-backdrop')).toBeTruthy();
    expect(constructorOpts.element.querySelector('.filter-pane-shell')?.getAttribute('data-pointer-mode')).toBe('pane-open');
    expect(constructorOpts.element.querySelector('.filter-pane-shell')?.getAttribute('data-overlay-state')).toBe('open');
    expect(constructorOpts.element.querySelector('.filter-pane-panel')).toBeTruthy();
    expect(constructorOpts.element.querySelector('[data-tab="basic"]')?.getAttribute('aria-selected')).toBe('true');
    expect(constructorOpts.element.textContent).toContain('Region');
  });

  it('uses the configured starting tab when no active tab has been saved', () => {
    useSettings((settings) => {
      settings.behaviorSettings.defaultTab.value = { value: 'advanced', displayName: 'Advanced' };
    });
    visual.update(createUpdateOptions([buildFilterDataView()]) as never);
    click('.filter-pane-trigger');

    expect(constructorOpts.element.querySelector('[data-tab="advanced"]')?.getAttribute('aria-selected')).toBe('true');
  });

  it('hides internal state and dependent formatting controls', () => {
    const settings = new FilterPaneProSettings();
    settings.behaviorSettings.bookmarkOverlayMode.value = true;
    settings.animationSettings.enabled.value = false;
    settingsRef.current = settings;
    visual.update(createUpdateOptions([buildFilterDataView()]) as never);

    expect(settings.behaviorSettings.activeTab.visible).toBe(false);
    expect(settings.iconSettings.position.visible).toBe(false);
    expect(settings.iconSettings.glassColor.visible).toBe(false);
    expect(settings.paneSettings.defaultOpen.visible).toBe(false);
    expect(settings.animationSettings.duration.visible).toBe(false);
  });

  it('omits the redundant Apply button in immediate mode', () => {
    useSettings((settings) => {
      settings.paneSettings.defaultOpen.value = true;
      settings.behaviorSettings.applyMode.value = { value: 'immediate', displayName: 'Immediately' };
    });
    visual.update(createUpdateOptions([buildFilterDataView()]) as never);

    expect(constructorOpts.element.querySelector('.filter-pane-apply')).toBeNull();
  });

  it('renders bookmark overlay mode as always-open content without the minimized bubble', () => {
    useSettings((settings) => {
      settings.behaviorSettings.bookmarkOverlayMode.value = true;
    });
    visual.update(createUpdateOptions([buildFilterDataView()]) as never);

    const shell = constructorOpts.element.querySelector<HTMLElement>('.filter-pane-shell');
    expect(shell?.dataset.bookmarkOverlayMode).toBe('true');
    expect(shell?.dataset.pointerMode).toBe('pane-open');
    expect(shell?.dataset.overlayState).toBe('open');
    expect(constructorOpts.element.querySelector('.filter-pane-trigger')).toBeNull();
    expect(constructorOpts.element.querySelector('.filter-pane-backdrop')).toBeTruthy();
    expect(constructorOpts.element.querySelector('.filter-pane-panel')).toBeTruthy();
    expect(constructorOpts.element.querySelector('.filter-pane-close')).toBeNull();

    click('.filter-pane-backdrop');
    constructorOpts.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(constructorOpts.element.querySelector('.filter-pane-panel')).toBeTruthy();
  });

  it('renders each field as a dropdown in an auto-width column grid', () => {
    visual.update(createUpdateOptions([buildFilterDataView()]) as never);
    click('.filter-pane-trigger');

    const grid = constructorOpts.element.querySelector<HTMLElement>('.filter-basic-grid');
    const shell = constructorOpts.element.querySelector<HTMLElement>('.filter-pane-shell');

    expect(grid?.dataset.columns).toBe('2');
    expect(shell?.style.getPropertyValue('--filter-pane-width')).toBe('620px');
    expect(constructorOpts.element.querySelectorAll('.filter-field-dropdown')).toHaveLength(3);
    const regionDropdown = constructorOpts.element.querySelector<HTMLElement>('[data-field-dropdown="Region.Region"]');
    const statusDropdown = constructorOpts.element.querySelector<HTMLElement>('[data-field-dropdown="Status.Status"]');
    const issueCountDropdown = constructorOpts.element.querySelector<HTMLElement>('[data-field-dropdown="Issue Count.Issue Count"]');
    expect(regionDropdown).toBeTruthy();
    expect(statusDropdown).toBeTruthy();
    expect(issueCountDropdown).toBeTruthy();
    expect(regionDropdown?.getAttribute('aria-expanded')).toBe('false');
    expect(statusDropdown?.getAttribute('aria-expanded')).toBe('false');
    expect(issueCountDropdown?.getAttribute('aria-expanded')).toBe('false');
    expect(constructorOpts.element.querySelector('[data-field-body="Region.Region"]')).toBeNull();
    expect(constructorOpts.element.querySelector('[data-option-key="North"]')).toBeNull();
  });

  it('expands and collapses basic field dropdowns independently', () => {
    visual.update(createUpdateOptions([buildFilterDataView()]) as never);
    click('.filter-pane-trigger');

    expandField('Region.Region');
    expect(constructorOpts.element.querySelector<HTMLElement>('[data-field-dropdown="Region.Region"]')?.getAttribute('aria-expanded')).toBe('true');
    expect(constructorOpts.element.querySelector('[data-field-body="Region.Region"]')).toBeTruthy();
    expect(constructorOpts.element.querySelector('[data-option-key="North"]')).toBeTruthy();
    expect(constructorOpts.element.querySelector('[data-field-body="Status.Status"]')).toBeNull();

    expandField('Region.Region');
    expect(constructorOpts.element.querySelector<HTMLElement>('[data-field-dropdown="Region.Region"]')?.getAttribute('aria-expanded')).toBe('false');
    expect(constructorOpts.element.querySelector('[data-field-body="Region.Region"]')).toBeNull();
  });

  it('searches the available basic filter fields before expanding them', () => {
    visual.update(createUpdateOptions([buildFilterDataView()]) as never);
    click('.filter-pane-trigger');

    setInputValue('[data-field-list-search]', 'status');
    expect(constructorOpts.element.querySelector('[data-field-dropdown="Status.Status"]')).toBeTruthy();
    expect(constructorOpts.element.querySelector('[data-field-dropdown="Region.Region"]')).toBeNull();
    expect(constructorOpts.element.querySelector('[data-field-dropdown="Issue Count.Issue Count"]')).toBeNull();

    setInputValue('[data-field-list-search]', '');
    expect(constructorOpts.element.querySelectorAll('.filter-field-dropdown')).toHaveLength(3);
  });

  it('keeps focus in the basic field search while typing', () => {
    visual.update(createUpdateOptions([buildFilterDataView()]) as never);
    click('.filter-pane-trigger');

    const firstInput = constructorOpts.element.querySelector<HTMLInputElement>('[data-field-list-search]')!;
    firstInput.focus();
    firstInput.value = 's';
    firstInput.dispatchEvent(new Event('input', { bubbles: true }));

    const secondInput = constructorOpts.element.querySelector<HTMLInputElement>('[data-field-list-search]')!;
    expect(document.activeElement).toBe(secondInput);
    secondInput.value = 'st';
    secondInput.dispatchEvent(new Event('input', { bubbles: true }));

    const finalInput = constructorOpts.element.querySelector<HTMLInputElement>('[data-field-list-search]')!;
    expect(document.activeElement).toBe(finalInput);
    expect(finalInput.value).toBe('st');
  });

  it('expands and collapses all visible basic fields from the toolbar', () => {
    visual.update(createUpdateOptions([buildFilterDataView()]) as never);
    click('.filter-pane-trigger');
    setInputValue('[data-field-list-search]', 's');

    click('[data-expand-fields]');
    expect(constructorOpts.element.querySelector('[data-field-body="Status.Status"]')).toBeTruthy();
    expect(constructorOpts.element.querySelector('[data-field-body="Issue Count.Issue Count"]')).toBeTruthy();
    expect(constructorOpts.element.querySelector('[data-field-body="Region.Region"]')).toBeNull();

    click('[data-collapse-fields]');
    expect(constructorOpts.element.querySelector('[data-field-body="Status.Status"]')).toBeNull();
    expect(constructorOpts.element.querySelector('[data-field-body="Issue Count.Issue Count"]')).toBeNull();
  });

  it('keeps expanded basic fields when switching tabs while the pane stays open', () => {
    visual.update(createUpdateOptions([buildFilterDataView()]) as never);
    click('.filter-pane-trigger');
    expandField('Region.Region');

    click('[data-tab="advanced"]');
    click('[data-tab="basic"]');

    expect(constructorOpts.element.querySelector('[data-field-body="Region.Region"]')).toBeTruthy();
  });

  it('switches to Advanced with readable operator labels', () => {
    visual.update(createUpdateOptions([buildFilterDataView()]) as never);
    click('.filter-pane-trigger');
    click('[data-tab="advanced"]');

    const operatorLabels = Array.from(constructorOpts.element.querySelectorAll('.filter-advanced-operator option'))
      .map((option) => option.textContent);
    expect(operatorLabels).toContain('Equals');
    expect(operatorLabels).toContain('Does not equal');
    expect(operatorLabels).toContain('Greater than');
    expect(operatorLabels).not.toContain('!=');
  });

  it('offers measure fields in Advanced and applies a measure-target filter', () => {
    visual.update(createUpdateOptions([buildFilterDataView()]) as never);
    click('.filter-pane-trigger');
    click('[data-tab="advanced"]');

    const fieldSelect = constructorOpts.element.querySelector<HTMLSelectElement>('.filter-advanced-field')!;
    expect(Array.from(fieldSelect.options).map((option) => option.textContent))
      .toContain('Measure Only (Measure)');
    fieldSelect.value = 'Measure Only.Measure Only';
    fieldSelect.dispatchEvent(new Event('change', { bubbles: true }));

    const operatorSelect = constructorOpts.element.querySelector<HTMLSelectElement>('.filter-advanced-operator')!;
    operatorSelect.value = 'GreaterThanOrEqual';
    operatorSelect.dispatchEvent(new Event('change', { bubbles: true }));
    setInputValue('.filter-advanced-value', '5.25');
    click('.filter-advanced-add');
    click('.filter-pane-apply');

    const appliedFilters = getAppliedJsonFilters();
    expect(appliedFilters[appliedFilters.length - 1]?.filter).toMatchObject([
      {
        target: {
          // Power BI's documented measure-target schema uses HTTP.
          // eslint-disable-next-line powerbi-visuals/no-http-string
          $schema: 'http://powerbi.com/product/schema#measure',
          table: 'Measure Only',
          measure: 'Measure Only',
        },
        conditions: [{ operator: 'GreaterThanOrEqual', value: 5.25 }],
      },
    ]);
  });

  it('supports value-free blank rules and enforces the two-condition limit', () => {
    visual.update(createUpdateOptions([buildFilterDataView()]) as never);
    click('.filter-pane-trigger');
    click('[data-tab="advanced"]');

    const fieldSelect = constructorOpts.element.querySelector<HTMLSelectElement>('.filter-advanced-field')!;
    fieldSelect.value = 'Issue Count.Issue Count';
    fieldSelect.dispatchEvent(new Event('change', { bubbles: true }));
    const operatorSelect = constructorOpts.element.querySelector<HTMLSelectElement>('.filter-advanced-operator')!;
    operatorSelect.value = 'Between';
    operatorSelect.dispatchEvent(new Event('change', { bubbles: true }));
    setInputValue('.filter-advanced-value', '2');
    setInputValue('.filter-advanced-value-to', '8');
    click('.filter-advanced-add');

    expect(constructorOpts.element.querySelector('.filter-advanced-hint')?.textContent)
      .toContain('two supported advanced conditions');
    expect(constructorOpts.element.querySelector<HTMLButtonElement>('.filter-advanced-add')?.disabled).toBe(true);

    click('[data-advanced-chip-rule]');
    const operatorAfterRemove = constructorOpts.element.querySelector<HTMLSelectElement>('.filter-advanced-operator')!;
    operatorAfterRemove.value = 'IsBlank';
    operatorAfterRemove.dispatchEvent(new Event('change', { bubbles: true }));
    expect(constructorOpts.element.querySelector('.filter-advanced-value')).toBeNull();
    expect(constructorOpts.element.querySelector<HTMLButtonElement>('.filter-advanced-add')?.disabled).toBe(false);
  });

  it('applies selected basic values through general.filter and updates the badge', () => {
    visual.update(createUpdateOptions([buildFilterDataView()]) as never);
    click('.filter-pane-trigger');
    expandField('Region.Region');
    click('[data-option-key="North"]');
    click('.filter-pane-apply');

    expect(getAppliedJsonFilters()).toHaveLength(1);
    expect(getAppliedJsonFilters()[0]).toMatchObject({
      objectName: 'general',
      propertyName: 'filter',
      action: 0,
    });
    expect(getAppliedJsonFilters()[0].filter).toMatchObject([
      {
        target: { table: 'Region', column: 'Region' },
        operator: 'In',
        values: ['North'],
      },
    ]);
    expect(constructorOpts.element.querySelector('.filter-pane-badge')?.textContent).toBe('1');
    expect(constructorOpts.element.querySelector('.filter-pane-trigger')?.getAttribute('aria-label')).toContain('1 active filter');
    expect(constructorOpts.element.querySelector('.filter-pane-live-region')?.textContent)
      .toBe('1 filter applied.');
  });

  it('searches and clears values within a basic field card', () => {
    visual.update(createUpdateOptions([buildFilterDataView()]) as never);
    click('.filter-pane-trigger');
    expandField('Region.Region');

    expect(constructorOpts.element.querySelector('[data-field-clear="Region.Region"]')).toBeNull();
    setInputValue('[data-field-search="Region.Region"]', 'Sou');
    expect(constructorOpts.element.querySelector('[data-option-key="South"]')).toBeTruthy();
    expect(constructorOpts.element.querySelector('[data-option-key="North"]')).toBeNull();

    click('[data-option-key="South"]');
    expect(constructorOpts.element.querySelector('[data-selected-count="Region.Region"]')?.textContent).toBe('1 selected');
    expect(constructorOpts.element.querySelector('[data-field-clear="Region.Region"]')).toBeTruthy();
    click('[data-field-clear="Region.Region"]');
    expect(constructorOpts.element.querySelector('[data-selected-count="Region.Region"]')?.textContent).toBe('All');
    expect(constructorOpts.element.querySelector('[data-field-clear="Region.Region"]')).toBeNull();
  });

  it('keeps focus in an individual value search while typing', () => {
    visual.update(createUpdateOptions([buildFilterDataView()]) as never);
    click('.filter-pane-trigger');
    expandField('Region.Region');

    const firstSearch = constructorOpts.element.querySelector<HTMLInputElement>('[data-field-search="Region.Region"]')!;
    firstSearch.focus();
    firstSearch.value = 's';
    firstSearch.dispatchEvent(new Event('input', { bubbles: true }));

    const secondSearch = constructorOpts.element.querySelector<HTMLInputElement>('[data-field-search="Region.Region"]')!;
    expect(document.activeElement).toBe(secondSearch);
    secondSearch.value = 'so';
    secondSearch.dispatchEvent(new Event('input', { bubbles: true }));

    const finalSearch = constructorOpts.element.querySelector<HTMLInputElement>('[data-field-search="Region.Region"]')!;
    expect(document.activeElement).toBe(finalSearch);
    expect(finalSearch.value).toBe('so');
    expect(constructorOpts.element.querySelector('[data-option-key="South"]')).toBeTruthy();
  });

  it('shows a no-results message inside a basic field search', () => {
    visual.update(createUpdateOptions([buildFilterDataView()]) as never);
    click('.filter-pane-trigger');
    expandField('Region.Region');

    setInputValue('[data-field-search="Region.Region"]', 'zzz');

    expect(constructorOpts.element.querySelector('.filter-value-empty')?.textContent).toContain('No values found');
    expect(constructorOpts.element.querySelector('[data-option-key="North"]')).toBeNull();
  });

  it('shows active filter chips and clears an individual chip', () => {
    visual.update(createUpdateOptions([buildFilterDataView()]) as never);
    click('.filter-pane-trigger');
    expandField('Region.Region');

    click('[data-option-key="North"]');

    expect(constructorOpts.element.querySelector('[data-active-summary]')?.textContent).toContain('1 filter active');
    expect(constructorOpts.element.querySelector('[data-filter-chip="basic:Region.Region"]')?.textContent).toContain('Region: North');

    click('[data-basic-chip-field="Region.Region"]');

    expect(constructorOpts.element.querySelector('[data-active-summary]')).toBeNull();
    expect(constructorOpts.element.querySelector('[data-selected-count="Region.Region"]')?.textContent).toBe('All');
  });

  it('keeps the filter pane scroll position when selecting options', () => {
    visual.update(createUpdateOptions([buildFilterDataView()]) as never);
    click('.filter-pane-trigger');
    expandField('Region.Region');

    const content = constructorOpts.element.querySelector<HTMLElement>('.filter-pane-content')!;
    content.scrollTop = 140;
    click('[data-option-key="North"]');

    expect(constructorOpts.element.querySelector<HTMLElement>('.filter-pane-content')?.scrollTop).toBe(140);
  });

  it('treats selecting all loaded values as clearing the field filter', () => {
    visual.update(createUpdateOptions([buildFilterDataView()]) as never);
    click('.filter-pane-trigger');
    expandField('Region.Region');
    click('[data-select-all-field="Region.Region"]');
    click('.filter-pane-apply');

    expect(getAppliedJsonFilters()[0]).toMatchObject({
      filter: null,
      objectName: 'general',
      propertyName: 'filter',
      action: 1,
    });
  });

  it('clears applied filters with a remove action and resets the badge', () => {
    visual.update(createUpdateOptions([buildFilterDataView()]) as never);
    click('.filter-pane-trigger');
    expandField('Region.Region');
    click('[data-option-key="North"]');
    click('.filter-pane-apply');
    click('.filter-pane-clear');

    const appliedFilters = getAppliedJsonFilters();
    expect(appliedFilters[appliedFilters.length - 1]).toMatchObject({
      filter: null,
      objectName: 'general',
      propertyName: 'filter',
      action: 1,
    });
    expect(constructorOpts.element.querySelector('.filter-pane-badge')).toBeNull();
  });

  it('adds and applies an advanced decimal rule', () => {
    visual.update(createUpdateOptions([buildFilterDataView()]) as never);
    click('.filter-pane-trigger');
    click('[data-tab="advanced"]');

    const regionField = constructorOpts.element.querySelector<HTMLSelectElement>('.filter-advanced-field')!;
    regionField.value = 'Region.Region';
    regionField.dispatchEvent(new Event('change', { bubbles: true }));
    const textOperatorLabels = Array.from(constructorOpts.element.querySelectorAll('.filter-advanced-operator option'))
      .map((option) => option.textContent);
    expect(textOperatorLabels).toContain('Contains');
    expect(textOperatorLabels).not.toContain('Greater than');

    const fieldSelect = constructorOpts.element.querySelector<HTMLSelectElement>('.filter-advanced-field')!;
    fieldSelect.value = 'Issue Count.Issue Count';
    fieldSelect.dispatchEvent(new Event('change', { bubbles: true }));
    const operatorSelect = constructorOpts.element.querySelector<HTMLSelectElement>('.filter-advanced-operator')!;
    operatorSelect.value = 'GreaterThanOrEqual';
    operatorSelect.dispatchEvent(new Event('change', { bubbles: true }));
    const input = constructorOpts.element.querySelector<HTMLInputElement>('.filter-advanced-value')!;
    input.value = '5.5';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    click('.filter-advanced-add');
    click('.filter-pane-apply');

    const appliedFilters = getAppliedJsonFilters();
    expect(appliedFilters[appliedFilters.length - 1]?.filter).toMatchObject([
      {
        target: { table: 'Issue Count', column: 'Issue Count' },
        conditions: [{ operator: 'GreaterThanOrEqual', value: 5.5 }],
      },
    ]);
  });

  it('keeps unapplied advanced rules when Power BI refreshes after switching tabs', () => {
    const dataView = buildFilterDataView();
    visual.update(createUpdateOptions([dataView]) as never);
    click('.filter-pane-trigger');
    click('[data-tab="advanced"]');

    const fieldSelect = constructorOpts.element.querySelector<HTMLSelectElement>('.filter-advanced-field')!;
    fieldSelect.value = 'Issue Count.Issue Count';
    fieldSelect.dispatchEvent(new Event('change', { bubbles: true }));
    const operatorSelect = constructorOpts.element.querySelector<HTMLSelectElement>('.filter-advanced-operator')!;
    operatorSelect.value = 'GreaterThanOrEqual';
    operatorSelect.dispatchEvent(new Event('change', { bubbles: true }));
    setInputValue('.filter-advanced-value', '5.5');
    click('.filter-advanced-add');
    expect(constructorOpts.element.textContent).toContain('Issue Count Greater than or equal to 5.5');

    click('[data-tab="basic"]');
    const refreshedOptions = createUpdateOptions([dataView]) as never as { jsonFilters?: unknown[] };
    refreshedOptions.jsonFilters = [];
    visual.update(refreshedOptions as never);
    click('[data-tab="advanced"]');

    expect(constructorOpts.element.textContent).toContain('Issue Count Greater than or equal to 5.5');
    expect(getAppliedJsonFilters()).toHaveLength(0);
  });

  it('restores state from bookmark JSON filters', () => {
    const dataView = buildFilterDataView();
    const fields = extractFilterFields(dataView as never);
    const options = createUpdateOptions([dataView]) as never as { jsonFilters?: unknown[] };
    options.jsonFilters = [
      buildBasicFilter(fields[0], ['South']),
      buildBasicFilter(fields[1], ['Open']),
    ];

    visual.update(options as never);
    click('.filter-pane-trigger');
    expandField('Region.Region');
    expandField('Status.Status');

    expect(constructorOpts.element.querySelector<HTMLInputElement>('[data-option-key="South"]')?.checked).toBe(true);
    expect(constructorOpts.element.querySelector<HTMLInputElement>('[data-option-key="Open"]')?.checked).toBe(true);
    expect(constructorOpts.element.querySelector('.filter-pane-badge')?.textContent).toBe('2');
  });

  it('follows bookmark filters while open when there are no pending edits', () => {
    const dataView = buildFilterDataView();
    visual.update(createUpdateOptions([dataView]) as never);
    click('.filter-pane-trigger');

    const fields = extractFilterFields(dataView as never);
    const refreshedOptions = createUpdateOptions([dataView]) as never as { jsonFilters?: unknown[] };
    refreshedOptions.jsonFilters = [buildBasicFilter(fields[0], ['South'])!];
    visual.update(refreshedOptions as never);
    expandField('Region.Region');

    expect(constructorOpts.element.querySelector<HTMLInputElement>('[data-option-key="South"]')?.checked).toBe(true);
    expect(constructorOpts.element.querySelector('.filter-pane-badge')?.textContent).toBe('1');
  });

  it('honors disabled host interactions and high-contrast colors', () => {
    const host = constructorOpts.host as Record<string, unknown>;
    (host.hostCapabilities as { allowInteractions: boolean }).allowInteractions = false;
    const palette = host.colorPalette as Record<string, unknown>;
    palette.isHighContrast = true;
    palette.foreground = { value: '#FFFFFF' };
    palette.foregroundSelected = { value: '#FFFF00' };
    palette.background = { value: '#000000' };

    visual.update(createUpdateOptions([buildFilterDataView()]) as never);

    const shell = constructorOpts.element.querySelector<HTMLElement>('.filter-pane-shell');
    const trigger = constructorOpts.element.querySelector<HTMLButtonElement>('.filter-pane-trigger');
    expect(shell?.dataset.highContrast).toBe('true');
    expect(shell?.dataset.interactionsEnabled).toBe('false');
    expect(shell?.style.getPropertyValue('--filter-pane-accent')).toBe('#FFFF00');
    expect(trigger?.disabled).toBe(true);
    trigger?.click();
    expect(constructorOpts.element.querySelector('.filter-pane-panel')).toBeNull();
  });

  it('renders its empty setup state and reports a complete render lifecycle', () => {
    const eventService = constructorOpts.host.eventService as Record<string, ReturnType<typeof vi.fn>>;
    eventService.renderingStarted = vi.fn();
    eventService.renderingFinished = vi.fn();
    eventService.renderingFailed = vi.fn();
    useSettings((settings) => {
      settings.paneSettings.defaultOpen.value = true;
    });

    visual.update(createUpdateOptions([DataViewBuilder.empty()]) as never);

    expect(constructorOpts.element.querySelector('.filter-empty')?.textContent).toContain('Add categories');
    expect(eventService.renderingStarted).toHaveBeenCalledOnce();
    expect(eventService.renderingFinished).toHaveBeenCalledOnce();
    expect(eventService.renderingFailed).not.toHaveBeenCalled();
  });

  it('distinguishes a bound no-data state from initial setup', () => {
    const noData = buildFilterDataView() as ReturnType<typeof buildFilterDataView> & {
      categorical?: unknown;
    };
    noData.categorical = undefined;

    visual.update(createUpdateOptions([noData]) as never);

    expect(constructorOpts.element.querySelector('.filter-pane-setup-state')?.textContent)
      .toContain('No filter values');
    expect(constructorOpts.element.querySelector('.filter-pane-trigger')).toBeNull();
  });

  it('closes the pane on Escape', () => {
    visual.update(createUpdateOptions([buildFilterDataView()]) as never);
    click('.filter-pane-trigger');

    constructorOpts.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(constructorOpts.element.querySelector('.filter-pane-panel')).toBeNull();
  });

  it('supports keyboard expand and collapse for basic field dropdowns', () => {
    visual.update(createUpdateOptions([buildFilterDataView()]) as never);
    click('.filter-pane-trigger');

    const toggle = constructorOpts.element.querySelector<HTMLElement>('[data-field-toggle="Region.Region"]')!;
    toggle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(constructorOpts.element.querySelector('[data-field-body="Region.Region"]')).toBeTruthy();

    const search = constructorOpts.element.querySelector<HTMLElement>('[data-field-search="Region.Region"]')!;
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(constructorOpts.element.querySelector('[data-field-body="Region.Region"]')).toBeNull();
    expect(constructorOpts.element.querySelector('.filter-pane-panel')).toBeTruthy();

    constructorOpts.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(constructorOpts.element.querySelector('.filter-pane-panel')).toBeNull();
  });

  it('returns a formatting model with the expected cards', () => {
    visual.update(createUpdateOptions([buildFilterDataView()]) as never);
    const model = visual.getFormattingModel();

    expect((model.cards as Array<{ name?: string }>).map((card) => card.name)).toEqual([
      'iconSettings',
      'paneSettings',
      'behaviorSettings',
      'overlaySettings',
      'cardSettings',
      'animationSettings',
      'accessibilitySettings',
    ]);
  });
});
