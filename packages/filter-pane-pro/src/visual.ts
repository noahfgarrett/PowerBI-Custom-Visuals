import powerbi from 'powerbi-visuals-api';
import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel';
import { FilterPaneProSettings } from './settings';
import {
  buildFiltersFromState,
  createAdvancedRule,
  createInitialState,
  ensureFieldState,
  extractFilterFields,
  getActiveFilterCount,
  getAdvancedConditionCost,
  getAdvancedOperatorLabel,
  MAX_ADVANCED_CONDITIONS_PER_FIELD,
  restoreStateFromFilters,
  type AdvancedOperator,
  type FilterField,
  type FilterPaneState,
  type FilterPaneTab,
} from './filter-model';
import {
  allowInteractions,
  getLocalizedString,
  getHostHighContrastColors,
  getVisualEmptyStateMode,
  notifyRenderingFailed,
  notifyRenderingFinished,
  notifyRenderingStarted,
} from '../../core/src';

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;

import '../style/visual.less';

interface FocusSnapshot {
  selector: string;
  selectionStart: number | null;
  selectionEnd: number | null;
}

export class FilterPaneProVisual implements IVisual {
  private readonly host: IVisualHost;
  private readonly selectionManager: powerbi.extensibility.ISelectionManager;
  private readonly container: HTMLElement;
  private readonly formattingSettingsService: FormattingSettingsService;
  private readonly keydownHandler: (event: KeyboardEvent) => void;
  private readonly instanceKey: string;
  private settings: FilterPaneProSettings;
  private state: FilterPaneState = createInitialState();
  private lastFields: FilterField[] = [];
  private fieldSearch: Record<string, string> = {};
  private fieldListSearch = '';
  private expandedFields = new Set<string>();
  private initializedTab = false;
  private hasPendingChanges = false;
  private emptyStateMode: 'unconfigured' | 'noData' = 'unconfigured';
  private liveAnnouncement = '';
  private pendingAdvanced: {
    fieldId: string;
    operator: AdvancedOperator;
    value: string;
    valueTo: string;
  } = {
    fieldId: '',
    operator: 'Equals',
    value: '',
    valueTo: '',
  };

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.formattingSettingsService = new FormattingSettingsService(options.host.createLocalizationManager());
    this.settings = new FilterPaneProSettings();
    this.instanceKey = String((options.host as unknown as { instanceId?: string }).instanceId ?? 'filter-pane')
      .replace(/[^a-zA-Z0-9_-]/g, '-');
    this.container.classList.add('filter-pane-pro');
    this.keydownHandler = (event: KeyboardEvent) => {
      this.handleKeydown(event);
    };
    this.container.addEventListener('keydown', this.keydownHandler);
  }

  public update(options: VisualUpdateOptions): void {
    notifyRenderingStarted(this.host, options);
    try {
      const dataView = options.dataViews?.[0];
      this.emptyStateMode = getVisualEmptyStateMode(dataView);
      if (dataView) {
        this.settings = this.formattingSettingsService.populateFormattingSettingsModel(FilterPaneProSettings, dataView);
      }
      this.syncFormattingVisibility();
      const fields = extractFilterFields(dataView);
      this.lastFields = fields;
      const isInitialUpdate = !this.initializedTab;

      if (!this.initializedTab) {
        this.state = {
          ...this.state,
          activeTab: this.getConfiguredActiveTab(),
          isOpen: Boolean(this.settings.paneSettings.defaultOpen.value),
        };
        this.initializedTab = true;
      }

      this.state = ensureFieldState(this.state, fields);
      const fieldIds = new Set(fields.map((field) => field.id));
      for (const expandedField of Array.from(this.expandedFields)) {
        if (!fieldIds.has(expandedField)) this.expandedFields.delete(expandedField);
      }
      for (const searchedField of Object.keys(this.fieldSearch)) {
        if (!fieldIds.has(searchedField)) delete this.fieldSearch[searchedField];
      }
      const jsonFilters = (options as unknown as { jsonFilters?: powerbi.IFilter[] }).jsonFilters;
      if (this.getPersistenceMode() === 'bookmark'
        && jsonFilters !== undefined
        && (!this.isPaneVisible() || isInitialUpdate || !this.hasPendingChanges)) {
        this.state = restoreStateFromFilters(fields, jsonFilters, this.state);
        this.hasPendingChanges = false;
      }
      this.ensurePendingAdvanced(fields);
      this.render(fields);
      notifyRenderingFinished(this.host, options);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      notifyRenderingFailed(this.host, options, reason);
      clearElement(this.container);
      const message = document.createElement('div');
      message.className = 'filter-empty filter-render-error';
      message.textContent = getLocalizedString(
        this.host,
        'FilterPanePro_RenderError',
        'Unable to render filters.',
      );
      this.container.appendChild(message);
    }
  }

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  public destroy(): void {
    this.container.removeEventListener('keydown', this.keydownHandler);
    clearElement(this.container);
  }

  private render(fields: FilterField[], preserveScroll = false): void {
    const previousScrollTop = preserveScroll
      ? this.container.querySelector<HTMLElement>('.filter-pane-content')?.scrollTop ?? 0
      : 0;
    const focusSnapshot = this.captureFocusSnapshot();
    clearElement(this.container);
    const shell = document.createElement('div');
    shell.className = 'filter-pane-shell';
    this.applyShellSettings(shell, fields);
    if (fields.length === 0) {
      shell.appendChild(this.renderEmptyState());
      this.appendLiveRegion(shell);
      this.container.appendChild(shell);
      return;
    }
    const bookmarkOverlayMode = this.isBookmarkOverlayMode();
    const paneVisible = this.isPaneVisible();
    if (!bookmarkOverlayMode) shell.appendChild(this.renderTrigger(fields));

    if (paneVisible) {
      const backdrop = document.createElement('div');
      backdrop.className = 'filter-pane-backdrop';
      if (!bookmarkOverlayMode) {
        backdrop.addEventListener('click', () => this.setPaneOpen(false, fields));
      }
      shell.appendChild(backdrop);
      shell.appendChild(this.renderOpenPane(fields));
    }

    this.appendLiveRegion(shell);
    this.container.appendChild(shell);
    if (preserveScroll) {
      const content = this.container.querySelector<HTMLElement>('.filter-pane-content');
      if (content) content.scrollTop = previousScrollTop;
    }
    this.restoreFocusSnapshot(focusSnapshot);
  }

  private renderTrigger(fields: FilterField[]): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    const activeCount = getActiveFilterCount(this.state);
    const hasFields = fields.length > 0;
    button.className = `filter-pane-trigger filter-pane-trigger--${this.getIconStyle()} filter-pane-trigger--${this.getIconPosition()}`;
    button.setAttribute('aria-controls', `${this.instanceKey}-panel`);
    button.setAttribute(
      'aria-label',
      activeCount > 0
        ? `Open ${this.getPaneAriaLabel()}, ${activeCount} active filter${activeCount === 1 ? '' : 's'}`
        : hasFields ? `Open ${this.getPaneAriaLabel()}` : `Open ${this.getPaneAriaLabel()}, no fields configured`,
    );
    button.setAttribute('aria-pressed', String(this.state.isOpen));
    button.disabled = !allowInteractions(this.host);
    button.appendChild(createFilterIcon());
    if (activeCount > 0) {
      const badge = document.createElement('span');
      badge.className = 'filter-pane-badge';
      badge.textContent = String(activeCount);
      button.appendChild(badge);
    }
    button.addEventListener('click', () => this.setPaneOpen(!this.state.isOpen, fields));
    return button;
  }

  private renderOpenPane(fields: FilterField[]): HTMLElement {
    const panel = document.createElement('section');
    panel.className = `filter-pane-panel filter-pane-panel--${this.getPaneSide()}`;
    panel.id = `${this.instanceKey}-panel`;
    panel.setAttribute('aria-label', this.getPaneAriaLabel());
    panel.setAttribute('role', this.isBookmarkOverlayMode() ? 'region' : 'dialog');
    if (!this.isBookmarkOverlayMode()) panel.setAttribute('aria-modal', 'true');
    panel.tabIndex = -1;

    const header = document.createElement('header');
    header.className = 'filter-pane-header';
    const title = document.createElement('div');
    title.className = 'filter-pane-title';
    title.textContent = 'Filters';
    header.appendChild(title);
    if (!this.isBookmarkOverlayMode()) {
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'filter-pane-close';
      close.setAttribute('aria-label', 'Close filters');
      close.textContent = 'Close';
      close.addEventListener('click', () => this.setPaneOpen(false, fields));
      header.appendChild(close);
    }

    const tabs = this.renderTabs(fields);
    const activeSummary = this.renderActiveSummary(fields);
    const content = document.createElement('div');
    content.className = 'filter-pane-content';
    content.id = `${this.instanceKey}-${this.state.activeTab}-tabpanel`;
    content.setAttribute('role', 'tabpanel');
    content.setAttribute('aria-labelledby', `${this.instanceKey}-${this.state.activeTab}-tab`);
    content.appendChild(this.state.activeTab === 'basic'
      ? this.renderBasicTab(fields)
      : this.renderAdvancedTab(fields));

    panel.append(header, tabs);
    if (activeSummary) panel.appendChild(activeSummary);
    panel.append(content, this.renderFooter(fields));
    if (!allowInteractions(this.host)) {
      panel.setAttribute('aria-disabled', 'true');
      for (const control of Array.from(panel.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement>('button, input, select'))) {
        control.disabled = true;
      }
    }
    return panel;
  }

  private renderTabs(fields: FilterField[]): HTMLElement {
    const tabs = document.createElement('div');
    tabs.className = 'filter-pane-tabs';
    tabs.setAttribute('role', 'tablist');
    for (const tab of ['basic', 'advanced'] as const) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'filter-pane-tab';
      button.dataset.tab = tab;
      button.id = `${this.instanceKey}-${tab}-tab`;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', String(this.state.activeTab === tab));
      button.setAttribute('aria-controls', `${this.instanceKey}-${tab}-tabpanel`);
      button.tabIndex = this.state.activeTab === tab ? 0 : -1;
      button.textContent = tab === 'basic' ? 'Basic' : 'Advanced';
      button.addEventListener('click', () => this.setActiveTab(tab, fields));
      button.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        this.setActiveTab(tab === 'basic' ? 'advanced' : 'basic', fields);
        this.container.querySelector<HTMLElement>(`[data-tab="${tab === 'basic' ? 'advanced' : 'basic'}"]`)?.focus();
      });
      tabs.appendChild(button);
    }
    return tabs;
  }

  private renderBasicTab(fields: FilterField[]): HTMLElement {
    const fragment = document.createElement('div');
    fragment.className = 'filter-basic-tab';
    const basicFields = fields.filter((field) => field.target.kind === 'column');

    if (basicFields.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'filter-empty';
      empty.textContent = fields.length === 0
        ? 'Add fields to filter.'
        : 'Add category fields for basic filtering.';
      fragment.appendChild(empty);
      return fragment;
    }

    const normalizedFieldQuery = this.fieldListSearch.trim().toLocaleLowerCase();
    const visibleFields = normalizedFieldQuery.length > 0
      ? basicFields.filter((field) => field.displayName.toLocaleLowerCase().includes(normalizedFieldQuery))
      : basicFields;

    const toolbar = document.createElement('div');
    toolbar.className = 'filter-basic-toolbar';
    const fieldSearch = document.createElement('input');
    fieldSearch.className = 'filter-field-list-search';
    fieldSearch.type = 'search';
    fieldSearch.placeholder = 'Search filters';
    fieldSearch.setAttribute('aria-label', 'Search filter fields');
    fieldSearch.dataset.fieldListSearch = 'true';
    fieldSearch.value = this.fieldListSearch;
    fieldSearch.addEventListener('input', () => {
      this.fieldListSearch = fieldSearch.value;
      this.render(fields, true);
    });
    const toolbarActions = document.createElement('div');
    toolbarActions.className = 'filter-basic-toolbar__actions';
    const expandAll = document.createElement('button');
    expandAll.type = 'button';
    expandAll.className = 'filter-pane-button filter-pane-button--subtle';
    expandAll.dataset.expandFields = 'true';
    expandAll.textContent = 'Expand all';
    expandAll.addEventListener('click', () => {
      for (const field of visibleFields) this.expandedFields.add(field.id);
      this.render(fields, true);
    });
    const collapseAll = document.createElement('button');
    collapseAll.type = 'button';
    collapseAll.className = 'filter-pane-button filter-pane-button--subtle';
    collapseAll.dataset.collapseFields = 'true';
    collapseAll.textContent = 'Collapse all';
    collapseAll.addEventListener('click', () => {
      for (const field of visibleFields) this.expandedFields.delete(field.id);
      this.render(fields, true);
    });
    toolbarActions.append(expandAll, collapseAll);
    toolbar.append(fieldSearch, toolbarActions);
    fragment.appendChild(toolbar);

    if (visibleFields.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'filter-empty filter-field-list-empty';
      empty.textContent = 'No filters found.';
      fragment.appendChild(empty);
      return fragment;
    }

    const grid = document.createElement('div');
    const columnCount = this.getBasicColumnCount(basicFields.length);
    grid.className = 'filter-basic-grid';
    grid.dataset.columns = String(columnCount);

    for (const field of visibleFields) {
      const selected = new Set(this.state.fieldFilters[field.id]?.selectedValues ?? []);
      const isExpanded = this.expandedFields.has(field.id);
      const card = document.createElement('section');
      card.className = 'filter-basic-card filter-field-dropdown';
      card.dataset.fieldDropdown = field.id;
      card.setAttribute('aria-expanded', String(isExpanded));

      const head = document.createElement('div');
      head.className = 'filter-basic-card__head';
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'filter-field-toggle';
      toggle.dataset.fieldToggle = field.id;
      toggle.title = field.displayName;
      toggle.setAttribute('aria-expanded', String(isExpanded));
      const toggleText = document.createElement('span');
      toggleText.className = 'filter-field-toggle__label';
      toggleText.textContent = field.displayName;
      toggle.appendChild(toggleText);
      toggle.addEventListener('click', () => this.toggleField(field.id, fields));
      toggle.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          this.toggleField(field.id, fields);
        }
      });
      const count = document.createElement('span');
      count.className = 'filter-selected-count';
      count.dataset.selectedCount = field.id;
      count.textContent = selected.size > 0 ? `${selected.size} selected` : 'All';
      head.append(toggle, count);
      card.appendChild(head);

      if (!isExpanded) {
        grid.appendChild(card);
        continue;
      }

      const body = document.createElement('div');
      body.className = 'filter-field-body';
      body.dataset.fieldBody = field.id;

      const actions = document.createElement('div');
      actions.className = 'filter-basic-card__actions';
      if (selected.size > 0) {
        const clearField = document.createElement('button');
        clearField.type = 'button';
        clearField.className = 'filter-pane-button filter-pane-button--subtle';
        clearField.dataset.fieldClear = field.id;
        clearField.textContent = 'Reset';
        clearField.addEventListener('click', () => {
          this.state.fieldFilters[field.id].selectedValues = [];
          this.afterFilterStateChanged(fields);
        });
        actions.appendChild(clearField);
      }
      const selectAllLabel = document.createElement('label');
      selectAllLabel.className = 'filter-value-row';
      const selectAll = document.createElement('input');
      selectAll.type = 'checkbox';
      selectAll.dataset.selectAllField = field.id;
      selectAll.checked = selected.size === 0;
      selectAll.addEventListener('change', () => {
        this.state.fieldFilters[field.id].selectedValues = [];
        this.afterFilterStateChanged(fields);
      });
      const selectAllText = document.createElement('span');
      selectAllText.textContent = 'All';
      selectAllLabel.append(selectAll, selectAllText);
      actions.appendChild(selectAllLabel);
      body.appendChild(actions);

      const search = document.createElement('input');
      search.className = 'filter-field-search';
      search.type = 'search';
      search.placeholder = 'Search';
      search.setAttribute('aria-label', `Search ${field.displayName}`);
      search.dataset.fieldSearch = field.id;
      search.value = this.fieldSearch[field.id] ?? '';
      search.addEventListener('input', () => {
        this.fieldSearch[field.id] = search.value;
        this.render(fields, true);
      });
      body.appendChild(search);

      const query = (this.fieldSearch[field.id] ?? '').trim().toLocaleLowerCase();
      const visibleOptions = query.length > 0
        ? field.options.filter((option) => option.label.toLocaleLowerCase().includes(query))
        : field.options;

      if (visibleOptions.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'filter-value-empty';
        empty.textContent = 'No values found.';
        body.appendChild(empty);
      }

      for (const option of visibleOptions) {
        const label = document.createElement('label');
        label.className = 'filter-value-row';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.dataset.fieldId = field.id;
        checkbox.dataset.optionKey = option.key;
        checkbox.checked = selected.has(option.key);
        checkbox.addEventListener('change', () => {
          const current = new Set(this.state.fieldFilters[field.id]?.selectedValues ?? []);
          if (checkbox.checked) {
            current.add(option.key);
          } else {
            current.delete(option.key);
          }
          this.state.fieldFilters[field.id].selectedValues =
            current.size === field.options.length ? [] : Array.from(current);
          this.afterFilterStateChanged(fields);
        });
        const text = document.createElement('span');
        text.title = `${option.label} (${option.count})`;
        text.textContent = `${option.label} (${option.count})`;
        label.append(checkbox, text);
        body.appendChild(label);
      }

      card.appendChild(body);
      grid.appendChild(card);
    }

    fragment.appendChild(grid);
    return fragment;
  }

  private renderActiveSummary(fields: FilterField[]): HTMLElement | null {
    const chips: HTMLButtonElement[] = [];
    for (const field of fields) {
      const selectedKeys = this.state.fieldFilters[field.id]?.selectedValues ?? [];
      if (selectedKeys.length === 0) continue;
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'filter-active-chip';
      chip.dataset.filterChip = `basic:${field.id}`;
      chip.dataset.basicChipField = field.id;
      const selectedLabels = selectedKeys
        .map((key) => field.options.find((option) => option.key === key)?.label ?? key)
        .filter((label) => label.length > 0);
      chip.textContent = `${field.displayName}: ${selectedLabels.length > 2 ? `${selectedLabels.length} selected` : selectedLabels.join(', ')} x`;
      chip.addEventListener('click', () => {
        this.state.fieldFilters[field.id].selectedValues = [];
        this.afterFilterStateChanged(fields);
      });
      chips.push(chip);
    }

    for (const rule of this.state.advancedRules.filter((candidate) => candidate.isValid)) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'filter-active-chip';
      chip.dataset.filterChip = `advanced:${rule.id}`;
      chip.dataset.advancedChipRule = rule.id;
      chip.textContent = `${rule.display} x`;
      chip.addEventListener('click', () => {
        this.state.advancedRules = this.state.advancedRules.filter((candidate) => candidate.id !== rule.id);
        this.afterFilterStateChanged(fields);
      });
      chips.push(chip);
    }

    if (chips.length === 0) return null;

    const summary = document.createElement('section');
    summary.className = 'filter-active-summary';
    summary.dataset.activeSummary = 'true';
    const label = document.createElement('span');
    label.className = 'filter-active-summary__label';
    label.textContent = `${chips.length} filter${chips.length === 1 ? '' : 's'} active`;
    const chipList = document.createElement('div');
    chipList.className = 'filter-active-summary__chips';
    chipList.append(...chips);
    summary.append(label, chipList);
    return summary;
  }

  private renderAdvancedTab(fields: FilterField[]): HTMLElement {
    const fragment = document.createElement('div');
    fragment.className = 'filter-advanced-tab';

    if (fields.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'filter-empty';
      empty.textContent = 'Add fields to filter.';
      fragment.appendChild(empty);
      return fragment;
    }

    this.ensurePendingAdvanced(fields);
    const composer = document.createElement('section');
    composer.className = 'filter-advanced-composer';

    const grid = document.createElement('div');
    grid.className = 'filter-advanced-grid';

    const fieldSelect = document.createElement('select');
    fieldSelect.className = 'filter-advanced-field';
    fieldSelect.setAttribute('aria-label', 'Advanced filter field');
    for (const field of fields) {
      const option = document.createElement('option');
      option.value = field.id;
      option.textContent = field.target.kind === 'measure'
        ? `${field.displayName} (Measure)`
        : field.displayName;
      fieldSelect.appendChild(option);
    }
    fieldSelect.value = this.pendingAdvanced.fieldId;
    fieldSelect.addEventListener('change', () => {
      this.pendingAdvanced.fieldId = fieldSelect.value;
      const selectedField = fields.find((field) => field.id === this.pendingAdvanced.fieldId);
      const validOperators = getOperatorsForField(selectedField);
      if (!validOperators.includes(this.pendingAdvanced.operator)) {
        this.pendingAdvanced.operator = validOperators[0] ?? 'Equals';
      }
      this.render(fields);
    });

    const operatorSelect = document.createElement('select');
    operatorSelect.className = 'filter-advanced-operator';
    operatorSelect.setAttribute('aria-label', 'Advanced filter operator');
    const selectedField = fields.find((field) => field.id === this.pendingAdvanced.fieldId);
    const selectedFieldConditionCount = this.state.advancedRules
      .filter((rule) => rule.fieldId === selectedField?.id)
      .reduce((total, rule) => total + getAdvancedConditionCost(rule.operator), 0);
    const isValueFree = this.pendingAdvanced.operator === 'IsBlank'
      || this.pendingAdvanced.operator === 'IsNotBlank';
    let addButton: HTMLButtonElement | null = null;
    const syncAddDisabled = (): void => {
      if (!addButton) return;
      const pendingRule = createAdvancedRule(
        selectedField,
        this.pendingAdvanced.operator,
        this.pendingAdvanced.value,
        this.pendingAdvanced.valueTo,
      );
      addButton.disabled = !pendingRule.isValid
        || selectedFieldConditionCount + getAdvancedConditionCost(this.pendingAdvanced.operator)
          > MAX_ADVANCED_CONDITIONS_PER_FIELD;
    };
    for (const operator of getOperatorsForField(selectedField)) {
      const option = document.createElement('option');
      option.value = operator;
      option.textContent = getAdvancedOperatorLabel(operator);
      operatorSelect.appendChild(option);
    }
    operatorSelect.value = this.pendingAdvanced.operator;
    operatorSelect.addEventListener('change', () => {
      this.pendingAdvanced.operator = operatorSelect.value as AdvancedOperator;
      if (this.pendingAdvanced.operator !== 'Between') this.pendingAdvanced.valueTo = '';
      this.render(fields);
    });

    grid.append(fieldSelect, operatorSelect);

    const addPendingRule = (): void => {
      if (addButton?.disabled) return;
      this.addAdvancedRule(fields);
    };
    const configureValueInput = (input: HTMLInputElement): void => {
      if (selectedField?.fieldType === 'numeric') {
        input.type = 'number';
        input.step = 'any';
      } else if (selectedField?.fieldType === 'date') {
        input.type = 'date';
      } else {
        input.type = 'text';
      }
      input.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        addPendingRule();
      });
    };

    if (!isValueFree) {
      const valueInput = document.createElement('input');
      valueInput.className = 'filter-advanced-value';
      configureValueInput(valueInput);
      valueInput.value = this.pendingAdvanced.value;
      valueInput.placeholder = this.pendingAdvanced.operator === 'Between' ? 'From' : 'Value';
      valueInput.setAttribute('aria-label', 'Advanced filter value');
      valueInput.addEventListener('input', () => {
        this.pendingAdvanced.value = valueInput.value;
        syncAddDisabled();
      });
      grid.appendChild(valueInput);
    }

    if (this.pendingAdvanced.operator === 'Between') {
      const valueToInput = document.createElement('input');
      valueToInput.className = 'filter-advanced-value-to';
      configureValueInput(valueToInput);
      valueToInput.value = this.pendingAdvanced.valueTo;
      valueToInput.placeholder = 'To';
      valueToInput.setAttribute('aria-label', 'Advanced filter end value');
      valueToInput.addEventListener('input', () => {
        this.pendingAdvanced.valueTo = valueToInput.value;
        syncAddDisabled();
      });
      grid.appendChild(valueToInput);
    }

    const add = document.createElement('button');
    addButton = add;
    add.type = 'button';
    add.className = 'filter-pane-button filter-pane-primary filter-advanced-add';
    add.textContent = 'Add';
    syncAddDisabled();
    add.addEventListener('click', addPendingRule);

    composer.append(grid, add);
    if (selectedFieldConditionCount >= MAX_ADVANCED_CONDITIONS_PER_FIELD) {
      const limit = document.createElement('div');
      limit.className = 'filter-advanced-hint';
      limit.textContent = 'This field already uses the two supported advanced conditions.';
      composer.appendChild(limit);
    }
    fragment.appendChild(composer);

    for (const rule of this.state.advancedRules) {
      const row = document.createElement('div');
      row.className = 'filter-rule-row';
      const text = document.createElement('span');
      text.className = 'filter-rule-text';
      text.title = rule.display;
      text.textContent = rule.display;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'filter-pane-button';
      remove.textContent = 'Remove';
      remove.addEventListener('click', () => {
        this.state.advancedRules = this.state.advancedRules.filter((candidate) => candidate.id !== rule.id);
        this.afterFilterStateChanged(fields);
      });
      row.append(text, remove);
      fragment.appendChild(row);
    }

    return fragment;
  }

  private renderFooter(fields: FilterField[]): HTMLElement {
    const footer = document.createElement('footer');
    footer.className = 'filter-pane-footer';

    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'filter-pane-button filter-pane-clear';
    clear.textContent = 'Clear';
    clear.disabled = getActiveFilterCount(this.state) === 0;
    clear.addEventListener('click', () => this.clearFilters(fields));

    const apply = document.createElement('button');
    apply.type = 'button';
    apply.className = 'filter-pane-button filter-pane-primary filter-pane-apply';
    apply.textContent = 'Apply';
    apply.disabled = !this.hasPendingChanges;
    apply.addEventListener('click', () => this.applyFilters(fields));

    footer.appendChild(clear);
    if (this.getApplyMode() === 'manual') footer.appendChild(apply);
    return footer;
  }

  private setPaneOpen(isOpen: boolean, fields: FilterField[]): void {
    if (this.isBookmarkOverlayMode() && !isOpen) {
      this.render(fields);
      return;
    }
    if (isOpen && !this.state.isOpen) {
      this.expandedFields.clear();
      this.fieldListSearch = '';
    }
    this.state = { ...this.state, isOpen };
    this.render(fields);
    if (isOpen && this.settings.accessibilitySettings.focusPaneOnOpen.value) {
      this.container.querySelector<HTMLElement>('.filter-pane-panel')?.focus();
    } else {
      this.container.querySelector<HTMLElement>('.filter-pane-trigger')?.focus();
    }
  }

  private setActiveTab(activeTab: FilterPaneTab, fields: FilterField[]): void {
    if (!allowInteractions(this.host)) return;
    this.state = { ...this.state, activeTab };
    this.settings.behaviorSettings.activeTab.value = activeTab;
    if (this.getPersistenceMode() === 'bookmark') {
      this.host.persistProperties({
        merge: [{
          objectName: 'behaviorSettings',
          selector: null,
          properties: { activeTab },
        }],
      } as never);
    }
    this.render(fields);
  }

  private afterFilterStateChanged(fields: FilterField[]): void {
    if (this.getApplyMode() === 'immediate') {
      this.applyFilters(fields);
    } else {
      this.hasPendingChanges = true;
      this.render(fields, true);
    }
  }

  private toggleField(fieldId: string, fields: FilterField[]): void {
    if (this.expandedFields.has(fieldId)) {
      this.expandedFields.delete(fieldId);
    } else {
      this.expandedFields.add(fieldId);
    }
    this.render(fields, true);
  }

  private handleKeydown(event: KeyboardEvent): void {
    if (!this.isPaneVisible()) return;
    if (event.key === 'Tab' && !this.isBookmarkOverlayMode()) {
      const panel = this.container.querySelector<HTMLElement>('.filter-pane-panel');
      const focusable = panel
        ? Array.from(panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ))
        : [];
      if (panel && focusable.length > 0) {
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = this.container.ownerDocument.activeElement;
        if (event.shiftKey && (active === first || active === panel)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
      return;
    }
    if (event.key !== 'Escape') return;
    const target = event.target as HTMLElement | null;
    const expandedDropdown = target?.closest?.('.filter-field-dropdown[aria-expanded="true"]') as HTMLElement | null;
    const expandedFieldId = expandedDropdown?.dataset.fieldDropdown;
    if (expandedFieldId) {
      event.preventDefault();
      event.stopPropagation();
      this.expandedFields.delete(expandedFieldId);
      this.render(this.lastFields, true);
      return;
    }

    if (this.isBookmarkOverlayMode()) return;

    this.state = { ...this.state, isOpen: false };
    this.render(this.lastFields);
  }

  private captureFocusSnapshot(): FocusSnapshot | null {
    const active = this.container.ownerDocument.activeElement as HTMLElement | null;
    if (!active || !this.container.contains(active)) return null;
    const selector = getRestorableFocusSelector(active);
    if (!selector) return null;

    let selectionStart: number | null = null;
    let selectionEnd: number | null = null;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
      try {
        selectionStart = active.selectionStart;
        selectionEnd = active.selectionEnd;
      } catch {
        selectionStart = null;
        selectionEnd = null;
      }
    }

    return { selector, selectionStart, selectionEnd };
  }

  private restoreFocusSnapshot(snapshot: FocusSnapshot | null): void {
    if (!snapshot) return;
    const target = this.container.querySelector<HTMLElement>(snapshot.selector);
    if (!target) return;
    target.focus();
    if ((target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)
      && snapshot.selectionStart !== null
      && snapshot.selectionEnd !== null) {
      try {
        target.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd);
      } catch {
        // Some input types do not support selection ranges.
      }
    }
  }

  private addAdvancedRule(fields: FilterField[]): void {
    const field = fields.find((candidate) => candidate.id === this.pendingAdvanced.fieldId);
    const conditionCount = this.state.advancedRules
      .filter((rule) => rule.fieldId === field?.id)
      .reduce((total, rule) => total + getAdvancedConditionCost(rule.operator), 0);
    if (conditionCount + getAdvancedConditionCost(this.pendingAdvanced.operator)
      > MAX_ADVANCED_CONDITIONS_PER_FIELD) return;
    const rule = createAdvancedRule(
      field,
      this.pendingAdvanced.operator,
      this.pendingAdvanced.value,
      this.pendingAdvanced.valueTo,
    );
    if (!rule.isValid) return;
    this.state = {
      ...this.state,
      advancedRules: [...this.state.advancedRules, { ...rule, id: `${rule.id}-${this.state.advancedRules.length}` }],
    };
    this.pendingAdvanced.value = '';
    this.pendingAdvanced.valueTo = '';
    this.afterFilterStateChanged(fields);
  }

  private applyFilters(fields: FilterField[]): void {
    if (!allowInteractions(this.host)) return;
    this.state = ensureFieldState(this.state, fields);
    const filters = buildFiltersFromState(fields, this.state);
    const action = filters.length > 0 ? FILTER_ACTION_MERGE : FILTER_ACTION_REMOVE;
    this.host.applyJsonFilter(
      filters.length > 0 ? filters as powerbi.IFilter[] : null as unknown as powerbi.IFilter,
      'general',
      'filter',
      action,
    );
    this.hasPendingChanges = false;
    const activeCount = getActiveFilterCount(this.state);
    this.liveAnnouncement = `${activeCount} filter${activeCount === 1 ? '' : 's'} applied.`;
    this.render(fields, true);
  }

  private clearFilters(fields: FilterField[]): void {
    if (!allowInteractions(this.host)) return;
    this.state = ensureFieldState(createInitialState(this.state.activeTab, this.state.isOpen), fields);
    this.host.applyJsonFilter(null as unknown as powerbi.IFilter, 'general', 'filter', FILTER_ACTION_REMOVE);
    this.hasPendingChanges = false;
    this.liveAnnouncement = getLocalizedString(
      this.host,
      'FilterPanePro_FiltersCleared',
      'Filters cleared.',
    );
    this.render(fields, true);
  }

  private ensurePendingAdvanced(fields: FilterField[]): void {
    if (fields.some((field) => field.id === this.pendingAdvanced.fieldId)) return;
    const preferred = fields.find((field) => field.fieldType === 'numeric') ?? fields[0];
    this.pendingAdvanced.fieldId = preferred?.id ?? '';
    const operators = getOperatorsForField(preferred);
    if (!operators.includes(this.pendingAdvanced.operator)) {
      this.pendingAdvanced.operator = operators[0] ?? 'Equals';
    }
  }

  private applyShellSettings(shell: HTMLElement, fields: FilterField[]): void {
    const basicFieldCount = fields.filter((field) => field.target.kind === 'column').length;
    const basicColumnCount = this.getBasicColumnCount(basicFieldCount);
    const paneVisible = this.isPaneVisible();
    const highContrast = getHostHighContrastColors(this.host);
    const configuredWidth = clampNumber(this.settings.paneSettings.width.value, 260, 720);
    const autoWidth = basicColumnCount === 3
      ? Math.max(configuredWidth, 820)
      : basicColumnCount === 2
        ? Math.max(configuredWidth, 620)
        : configuredWidth;
    shell.dataset.defaultTab = this.getDefaultTab();
    shell.dataset.applyMode = this.getApplyMode();
    shell.dataset.persistenceMode = this.getPersistenceMode();
    shell.dataset.bookmarkOverlayMode = String(this.isBookmarkOverlayMode());
    shell.dataset.defaultOpen = String(this.settings.paneSettings.defaultOpen.value);
    shell.dataset.iconStyle = this.getIconStyle();
    shell.dataset.paneSide = this.getPaneSide();
    shell.dataset.pointerMode = paneVisible ? 'pane-open' : 'button-only';
    shell.dataset.overlayState = paneVisible ? 'open' : 'closed';
    shell.dataset.basicColumns = String(basicColumnCount);
    shell.dataset.settingActiveTab = String(this.settings.behaviorSettings.activeTab.value ?? '');
    shell.dataset.stateActiveTab = this.state.activeTab;
    shell.style.setProperty('--filter-pane-icon-size', `${clampNumber(this.settings.iconSettings.size.value, 28, 72)}px`);
    shell.style.setProperty('--filter-pane-icon-color', colorValue(this.settings.iconSettings.iconColor.value, '#172033'));
    shell.style.setProperty('--filter-pane-icon-glass', colorValue(this.settings.iconSettings.glassColor.value, '#FFFFFF'));
    shell.style.setProperty('--filter-pane-icon-opacity', `${clampNumber(this.settings.iconSettings.glassOpacity.value, 0, 100)}%`);
    shell.style.setProperty('--filter-pane-width', `${autoWidth}px`);
    shell.style.setProperty('--filter-pane-max-height', `${clampNumber(this.settings.paneSettings.maxHeight.value, 240, 900)}px`);
    shell.style.setProperty('--filter-pane-accent', colorValue(this.settings.paneSettings.accentColor.value, '#2F6FED'));
    shell.style.setProperty('--filter-pane-text', colorValue(this.settings.paneSettings.textColor.value, '#172033'));
    shell.style.setProperty('--filter-pane-font-size', `${clampNumber(this.settings.paneSettings.fontSize.value, 9, 18)}px`);
    shell.style.setProperty('--filter-pane-overlay-color', colorValue(this.settings.overlaySettings.overlayColor.value, '#111827'));
    shell.style.setProperty('--filter-pane-overlay-opacity', `${clampNumber(this.settings.overlaySettings.overlayOpacity.value, 0, 90)}%`);
    shell.style.setProperty('--filter-pane-overlay-blur', `${clampNumber(this.settings.overlaySettings.blurRadius.value, 0, 24)}px`);
    shell.style.setProperty('--filter-pane-card-background', colorValue(this.settings.cardSettings.backgroundColor.value, '#FFFFFF'));
    shell.style.setProperty('--filter-pane-card-opacity', `${clampNumber(this.settings.cardSettings.backgroundOpacity.value, 0, 100)}%`);
    shell.dataset.cardRadiusSetting = String(this.settings.cardSettings.borderRadius.value);
    shell.style.setProperty('--filter-pane-card-radius', `${clampNumber(this.settings.cardSettings.borderRadius.value, 0, 8)}px`);
    shell.style.setProperty('--filter-pane-card-padding', `${clampNumber(this.settings.cardSettings.contentPadding.value, 6, 24)}px`);
    shell.dataset.animationEnabled = String(this.settings.animationSettings.enabled.value);
    shell.dataset.focusPaneOnOpen = String(this.settings.accessibilitySettings.focusPaneOnOpen.value);
    shell.dataset.announceFilterChanges = String(this.settings.accessibilitySettings.announceFilterChanges.value);
    shell.dataset.paneAriaLabel = this.getPaneAriaLabel();
    shell.dataset.highContrast = String(highContrast.enabled);
    shell.dataset.interactionsEnabled = String(allowInteractions(this.host));
    if (highContrast.enabled) {
      shell.style.setProperty('--filter-pane-accent', highContrast.foregroundSelected);
      shell.style.setProperty('--filter-pane-text', highContrast.foreground);
      shell.style.setProperty('--filter-pane-card-background', highContrast.background);
      shell.style.setProperty('--filter-pane-icon-color', highContrast.foreground);
      shell.style.setProperty('--filter-pane-icon-glass', highContrast.background);
      shell.style.setProperty('--filter-pane-overlay-color', highContrast.background);
      shell.style.setProperty('--filter-pane-overlay-opacity', '0%');
      shell.style.setProperty('--filter-pane-overlay-blur', '0px');
    }
    shell.style.setProperty(
      '--filter-pane-animation-duration',
      this.settings.animationSettings.enabled.value
        ? `${clampNumber(this.settings.animationSettings.duration.value, 0, 1200)}ms`
        : '0ms',
    );
    void this.selectionManager;
  }

  private getIconPosition(): string {
    return dropdownValue(this.settings.iconSettings.position.value, 'topRight');
  }

  private getPaneAriaLabel(): string {
    return this.settings.accessibilitySettings.paneAriaLabel.value.trim() || 'Filter Pane Pro';
  }

  private renderEmptyState(): HTMLElement {
    const state = document.createElement('section');
    state.className = 'filter-empty filter-pane-setup-state';
    state.setAttribute('role', 'status');
    const icon = createFilterIcon();
    icon.setAttribute('aria-hidden', 'true');
    const message = document.createElement('span');
    message.textContent = this.emptyStateMode === 'noData'
      ? getLocalizedString(
        this.host,
        'FilterPanePro_NoDataState',
        'No filter values are available for the current selection.',
      )
      : getLocalizedString(
        this.host,
        'FilterPanePro_EmptyState',
        'Add categories or measures to configure filters.',
      );
    state.append(icon, message);
    return state;
  }

  private appendLiveRegion(shell: HTMLElement): void {
    if (!this.settings.accessibilitySettings.announceFilterChanges.value) return;
    const region = document.createElement('div');
    region.className = 'filter-pane-live-region';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-atomic', 'true');
    region.textContent = this.liveAnnouncement;
    shell.appendChild(region);
  }

  private syncFormattingVisibility(): void {
    const showButton = !this.isBookmarkOverlayMode();
    const buttonStyle = this.getIconStyle();
    const glassButton = showButton && buttonStyle === 'glass';
    const buttonHasBackground = showButton && (buttonStyle === 'glass' || buttonStyle === 'solid');
    this.settings.iconSettings.position.visible = showButton;
    this.settings.iconSettings.style.visible = showButton;
    this.settings.iconSettings.size.visible = showButton;
    this.settings.iconSettings.iconColor.visible = showButton;
    this.settings.iconSettings.glassColor.visible = buttonHasBackground;
    this.settings.iconSettings.glassOpacity.visible = glassButton;
    this.settings.paneSettings.defaultOpen.visible = showButton;
    this.settings.animationSettings.duration.visible = this.settings.animationSettings.enabled.value;
    this.settings.behaviorSettings.activeTab.visible = false;
  }

  private getIconStyle(): string {
    return dropdownValue(this.settings.iconSettings.style.value, 'glass');
  }

  private getPaneSide(): string {
    return dropdownValue(this.settings.paneSettings.side.value, 'right');
  }

  private getBasicColumnCount(fieldCount: number): number {
    const configured = dropdownValue(this.settings.paneSettings.columnCount.value, 'auto');
    if (configured === '1' || configured === '2' || configured === '3') return Number(configured);
    if (fieldCount >= 4) return 3;
    if (fieldCount >= 2) return 2;
    return 1;
  }

  private getDefaultTab(): FilterPaneTab {
    return asTab(dropdownValue(this.settings.behaviorSettings.defaultTab.value, 'basic'));
  }

  private getConfiguredActiveTab(): FilterPaneTab {
    const activeTab = String(this.settings.behaviorSettings.activeTab.value || '');
    return asTab(activeTab || this.getDefaultTab());
  }

  private getApplyMode(): string {
    return dropdownValue(this.settings.behaviorSettings.applyMode.value, 'manual');
  }

  private getPersistenceMode(): string {
    return dropdownValue(this.settings.behaviorSettings.persistenceMode.value, 'bookmark');
  }

  private isBookmarkOverlayMode(): boolean {
    return booleanValue(this.settings.behaviorSettings.bookmarkOverlayMode.value, false);
  }

  private isPaneVisible(): boolean {
    return this.state.isOpen || this.isBookmarkOverlayMode();
  }
}

const TEXT_ADVANCED_OPERATORS: AdvancedOperator[] = [
  'Equals',
  'DoesNotEqual',
  'Contains',
  'DoesNotContain',
  'StartsWith',
  'IsBlank',
  'IsNotBlank',
];

const NUMERIC_ADVANCED_OPERATORS: AdvancedOperator[] = [
  'Equals',
  'DoesNotEqual',
  'GreaterThan',
  'GreaterThanOrEqual',
  'LessThan',
  'LessThanOrEqual',
  'Between',
  'IsBlank',
  'IsNotBlank',
];

const DATE_ADVANCED_OPERATORS: AdvancedOperator[] = [
  'On',
  'Before',
  'After',
  'Between',
  'IsBlank',
  'IsNotBlank',
];

const FILTER_ACTION_MERGE = 0 as powerbi.FilterAction;
const FILTER_ACTION_REMOVE = 1 as powerbi.FilterAction;

function dropdownValue(value: unknown, fallback: string): string {
  if (value && typeof value === 'object' && 'value' in value) {
    const inner = (value as { value?: unknown }).value;
    return inner === undefined || inner === null ? fallback : String(inner);
  }
  return value === undefined || value === null ? fallback : String(value);
}

function colorValue(value: unknown, fallback: string): string {
  if (value && typeof value === 'object' && 'value' in value) {
    const inner = (value as { value?: unknown }).value;
    return typeof inner === 'string' && inner.length > 0 ? inner : fallback;
  }
  return fallback;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  if (value && typeof value === 'object' && 'value' in value) {
    const inner = (value as { value?: unknown }).value;
    return typeof inner === 'boolean' ? inner : fallback;
  }
  return typeof value === 'boolean' ? value : fallback;
}

function clampNumber(value: unknown, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.max(min, Math.min(max, parsed));
}

function asTab(value: string): FilterPaneTab {
  return value === 'advanced' ? 'advanced' : 'basic';
}

function getOperatorsForField(field: FilterField | undefined): AdvancedOperator[] {
  if (!field) return TEXT_ADVANCED_OPERATORS;
  if (field.fieldType === 'date') return DATE_ADVANCED_OPERATORS;
  if (field.fieldType === 'numeric') return NUMERIC_ADVANCED_OPERATORS;
  return TEXT_ADVANCED_OPERATORS;
}

function clearElement(element: HTMLElement): void {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

function getRestorableFocusSelector(element: HTMLElement): string | null {
  if (element instanceof HTMLInputElement) {
    if (element.dataset.fieldListSearch !== undefined) return '[data-field-list-search]';
    if (element.dataset.fieldSearch) return `[data-field-search="${escapeAttributeValue(element.dataset.fieldSearch)}"]`;
    if (element.classList.contains('filter-advanced-value')) return '.filter-advanced-value';
    if (element.classList.contains('filter-advanced-value-to')) return '.filter-advanced-value-to';
    if (element.dataset.fieldId && element.dataset.optionKey) {
      return `[data-field-id="${escapeAttributeValue(element.dataset.fieldId)}"][data-option-key="${escapeAttributeValue(element.dataset.optionKey)}"]`;
    }
    if (element.dataset.selectAllField) return `[data-select-all-field="${escapeAttributeValue(element.dataset.selectAllField)}"]`;
  }

  if (element instanceof HTMLSelectElement) {
    if (element.classList.contains('filter-advanced-field')) return '.filter-advanced-field';
    if (element.classList.contains('filter-advanced-operator')) return '.filter-advanced-operator';
  }

  if (element instanceof HTMLButtonElement) {
    if (element.dataset.fieldToggle) return `[data-field-toggle="${escapeAttributeValue(element.dataset.fieldToggle)}"]`;
    if (element.dataset.fieldClear) return `[data-field-clear="${escapeAttributeValue(element.dataset.fieldClear)}"]`;
    if (element.dataset.tab) return `[data-tab="${escapeAttributeValue(element.dataset.tab)}"]`;
    if (element.dataset.basicChipField) return `[data-basic-chip-field="${escapeAttributeValue(element.dataset.basicChipField)}"]`;
    if (element.dataset.advancedChipRule) return `[data-advanced-chip-rule="${escapeAttributeValue(element.dataset.advancedChipRule)}"]`;
  }

  return null;
}

function escapeAttributeValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function createFilterIcon(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'filter-pane-trigger-icon');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute(
    'd',
    'M4 5.5C4 4.67 4.67 4 5.5 4h13c.83 0 1.5.67 1.5 1.5 0 .35-.12.69-.34.96L14 13.55V18c0 .42-.26.79-.65.94l-3 1.13A1 1 0 0 1 9 19.13v-5.58L4.34 6.46A1.5 1.5 0 0 1 4 5.5Zm2.06.5 4.77 7.25c.11.16.17.36.17.55v3.88l1-.38v-3.5c0-.19.06-.39.17-.55L17.94 6H6.06Z',
  );
  path.setAttribute('fill', 'currentColor');
  svg.appendChild(path);
  return svg;
}
