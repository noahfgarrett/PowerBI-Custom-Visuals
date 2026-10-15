/**
 * Gantt Chart Pro — Power BI IVisual implementation.
 * Horizontal task bars with progress fill, today marker,
 * animated growBar entrance, and glassmorphic styling.
 */

import powerbi from 'powerbi-visuals-api';
import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel';
import { GanttChartProSettings } from './settings';
import {
  growBar,
  fadeSlideIn,
  applyCardStyle,
  type CardStyleMode,
  getHostChartColor,
  DURATION,
  renderChartTitle,
  applyDataLabelFormatting,
  formatPercent,
  formatWithSettings,
  applyChartAria,
  applyDataPointAria,
  attachKeyboardNav,
  ensureFocusRingStyles,
  resolveDropdown,
  resolveColorTheme,
  buildConditionalConfig,
  resolveConditionalColor,
  renderLegend,
  type LegendItem,
  getDateFilterIndices,
  isDateColumn,
  type DateFilterConfig,
  attachEmptySpaceContextMenu,
  allowInteractions,
  notifyRenderingStarted,
  notifyRenderingFinished,
  notifyRenderingFailed,
  getHostHighContrastColors,
  applyBasicHighContrastStyles,
  syncCardStyleVisibility,
  syncDateFilterFormattingVisibility,
  syncLegendFormattingVisibility,
  syncTitleFormattingVisibility,
  getLocalizedString,
  getVisualEmptyStateMode,
} from '../../core/src';

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataView = powerbi.DataView;
import ISelectionId = powerbi.visuals.ISelectionId;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

import '../style/visual.less';

// ── Data types ──────────────────────────────────────────────────────

interface GanttTask {
  name: string;
  taskId: string;
  dependencyId: string | null;
  parentId: string | null;
  depth: number;
  isCollapsed: boolean;
  hasChildren: boolean;
  startDate: Date | null;
  endDate: Date | null;
  progress: number; // 0-100
  category: string;
  selectionId: ISelectionId;
  highlighted: boolean;
}

// ── Helpers ─────────────────────────────────────────────────────────

function parseDate(raw: unknown): Date | null {
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;
  if (typeof raw === 'string') {
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
    if (dateOnly) {
      const year = Number(dateOnly[1]);
      const month = Number(dateOnly[2]);
      const day = Number(dateOnly[3]);
      const localDate = new Date(year, month - 1, day);
      return localDate.getFullYear() === year
        && localDate.getMonth() === month - 1
        && localDate.getDate() === day
        ? localDate
        : null;
    }
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof raw === 'number') {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function normalizeDateFilterBoundary(value: string, endOfDay: boolean): string {
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? `${trimmed}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`
    : value;
}

function formatShortDate(d: Date, locale?: string): string {
  const resolvedLocale = locale && locale.trim().length > 0 ? locale : undefined;
  return new Intl.DateTimeFormat(resolvedLocale, { month: 'short', day: 'numeric' }).format(d);
}

function makeKeyboardButton(element: HTMLElement, label: string, expanded?: boolean): void {
  element.setAttribute('role', 'button');
  element.setAttribute('aria-label', label);
  element.tabIndex = 0;
  if (expanded !== undefined) element.setAttribute('aria-expanded', String(expanded));
  element.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    element.click();
  });
}

// ── Visual class ────────────────────────────────────────────────────

export class GanttChartProVisual implements IVisual {
  private host: IVisualHost;
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private container: HTMLElement;
  private settings: GanttChartProSettings;
  private formattingSettingsService: FormattingSettingsService;
  private cancelAnimations: Array<() => void> = [];
  private collapsedTasks: Set<string> = new Set();
  private collapsedGroups: Set<string> = new Set();
  private drillPath: string[] = [];
  private collapseDefaultApplied = false;
  private lastUpdateOptions: VisualUpdateOptions | null = null;
  private currentTasks: GanttTask[] = [];
  private hasHighlights = false;
  private emptyStateMode: 'unconfigured' | 'noData' = 'unconfigured';
  private hasCategoryRole = false;
  private hasDependencyRole = false;
  private hasParentRole = false;
  private hasProgressRole = false;
  private hasRequiredFields = false;
  private removeEmptySpaceContextMenu: (() => void) | null = null;

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new GanttChartProSettings();
    this.formattingSettingsService = new FormattingSettingsService(options.host.createLocalizationManager());
    this.container.classList.add('gantt-container');
    this.removeEmptySpaceContextMenu = attachEmptySpaceContextMenu(
      this.container,
      this.selectionManager,
      () => this.host.createSelectionIdBuilder().createSelectionId(),
      () => allowInteractions(this.host),
    );
  }

  public update(options: VisualUpdateOptions): void {
    notifyRenderingStarted(this.host, options);
    try {
    this.lastUpdateOptions = options;

    // Cancel running animations
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];

    // Parse settings
    const dataView = options.dataViews?.[0];
    this.emptyStateMode = getVisualEmptyStateMode(dataView);
    if (dataView) {
      this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
        GanttChartProSettings,
        dataView
      );
    }
    // Migrate legacy enableGlass -> cardStyleMode (backward compat)
    const legacyCardObj = dataView?.metadata?.objects?.['cardSettings'];
    if (legacyCardObj) {
      const legacyGlass = legacyCardObj['enableGlass'];
      if (legacyGlass === false) {
        this.settings.cardSettings.cardStyleMode.value = { value: 'none', displayName: 'None' };
      }
    }
    this.migrateLegacyFormatting(dataView);
    this.updateRoleAvailability(dataView);
    this.syncFormattingVisibility();

    // Extract data
    this.hasHighlights = false;
    const allTasks = this.extractData(dataView);
    this.currentTasks = allTasks;
    this.syncFormattingVisibility();

    const { scopedTasks, drillRoot } = this.resolveDrillContext(allTasks);

    // Build visible task list: skip tasks whose any ancestor is collapsed
    const visibleTasks = this.filterVisibleTasks(scopedTasks);

    this.render(visibleTasks, options.viewport, drillRoot);

    // Apply cross-highlight dimming after render
    this.applySelectionHighlight();
    this.applyHighContrast();
    notifyRenderingFinished(this.host, options);
    } catch (error) {
      notifyRenderingFailed(this.host, options, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private extractData(dataView: DataView | undefined): GanttTask[] {
    const tasks: GanttTask[] = [];
    if (!dataView?.categorical) return tasks;

    const categorical = dataView.categorical;
    const categories = categorical.categories?.[0];
    const values = categorical.values;
    if (!categories) return tasks;

    const count = categories.values.length;

    // Find value columns by role
    let startCol: powerbi.DataViewValueColumn | undefined;
    let endCol: powerbi.DataViewValueColumn | undefined;
    let progressCol: powerbi.DataViewValueColumn | undefined;
    let catCol: powerbi.DataViewValueColumn | undefined;
    let depCol: powerbi.DataViewValueColumn | undefined;
    let parentCol: powerbi.DataViewValueColumn | undefined;

    // Cross-highlight support: track highlights from any value column
    let hlRaw: unknown[] | undefined;
    let anyHighlight = false;

    if (values) {
      for (const col of values) {
        const role = col.source.roles;
        if (!role) continue;
        if (role['startDate']) startCol = col;
        if (role['endDate']) endCol = col;
        if (role['progress']) progressCol = col;
        if (role['category']) catCol = col;
        if (role['dependency']) depCol = col;
        if (role['parentTask']) parentCol = col;
      }
      // Read highlights from the first value column that has them
      for (const col of values) {
        const colHl = (col as unknown as { highlights?: unknown[] }).highlights as unknown[] | undefined;
        if (colHl) {
          hlRaw = colHl;
          break;
        }
      }
    }


    const dateConfig: DateFilterConfig = {
      enabled: this.settings.dateFilterFormattingCard.enableDateFilter.value,
      startDate: normalizeDateFilterBoundary(this.settings.dateFilterFormattingCard.startDate.value, false),
      endAtCurrentDate: this.settings.dateFilterFormattingCard.endAtCurrentDate.value,
      endDate: normalizeDateFilterBoundary(this.settings.dateFilterFormattingCard.endDate.value, true),
    };
    const dateIndices = startCol && isDateColumn(startCol.source)
      ? getDateFilterIndices(startCol.values, dateConfig)
      : null;

    for (let i = 0; i < count; i++) {
      if (dateIndices && !dateIndices.has(i)) continue;

      const name = String(categories.values[i] ?? '');
      const startDate = startCol ? parseDate(startCol.values[i]) : null;
      const endDate = endCol ? parseDate(endCol.values[i]) : null;

      let progress = 0;
      if (progressCol && typeof progressCol.values[i] === 'number') {
        progress = Math.max(0, Math.min(100, progressCol.values[i] as number));
      }

      const category = catCol && i < catCol.values.length
        ? String(catCol.values[i] ?? '')
        : '';

      const dependencyRaw = depCol && i < depCol.values.length ? depCol.values[i] : null;
      const dependencyId = dependencyRaw != null ? String(dependencyRaw) : null;

      const parentRaw = parentCol && i < parentCol.values.length ? parentCol.values[i] : null;
      const parentId = parentRaw != null && String(parentRaw).trim().length > 0
        ? String(parentRaw)
        : null;

      const selectionId = this.host.createSelectionIdBuilder()
        .withCategory(categories, i)
        .createSelectionId();

      // Use name as the task ID; if a category column exists, concatenate for uniqueness
      const taskId = category ? `${category}::${name}` : name;

      const isHighlighted = hlRaw != null && hlRaw[i] != null;
      if (isHighlighted) anyHighlight = true;

      tasks.push({
        name, taskId, dependencyId, parentId,
        depth: 0, isCollapsed: false, hasChildren: false,
        startDate, endDate, progress, category, selectionId,
        highlighted: isHighlighted,
      });
    }

    this.hasHighlights = anyHighlight;

    // Sort by start date
    tasks.sort((a, b) => {
      if (!a.startDate && !b.startDate) return 0;
      if (!a.startDate) return 1;
      if (!b.startDate) return -1;
      return a.startDate.getTime() - b.startDate.getTime();
    });

    // Compute hierarchy: depth, hasChildren, isCollapsed
    // Build lookup from task name to task (for parent resolution)
    const taskByName = new Map<string, GanttTask>();
    for (const t of tasks) {
      if (!taskByName.has(t.name)) {
        taskByName.set(t.name, t);
      }
    }

    // Mark hasChildren
    for (const t of tasks) {
      if (t.parentId != null) {
        const parent = taskByName.get(t.parentId);
        if (parent) {
          parent.hasChildren = true;
        }
      }
    }

    // Compute depth by walking up the parent chain (with cycle guard)
    const depthCache = new Map<string, number>();
    const computeDepth = (task: GanttTask): number => {
      const cached = depthCache.get(task.name);
      if (cached !== undefined) return cached;

      if (task.parentId == null) {
        depthCache.set(task.name, 0);
        return 0;
      }

      const parent = taskByName.get(task.parentId);
      if (!parent || parent.name === task.name) {
        // No parent found or self-reference — treat as root
        depthCache.set(task.name, 0);
        return 0;
      }

      // Cycle guard: temporarily mark with -1
      depthCache.set(task.name, -1);
      const parentDepth = computeDepth(parent);
      if (parentDepth < 0) {
        // Cycle detected — treat as root
        depthCache.set(task.name, 0);
        return 0;
      }

      const depth = parentDepth + 1;
      depthCache.set(task.name, depth);
      return depth;
    };

    for (const t of tasks) {
      t.depth = computeDepth(t);
    }

    // Apply collapse-by-default on first render (or when setting changes)
    const collapseByDefault = this.settings.hierarchyGroupingSettings.collapseByDefault.value;
    if (collapseByDefault && !this.collapseDefaultApplied) {
      this.collapseDefaultApplied = true;
      for (const t of tasks) {
        if (t.hasChildren) {
          this.collapsedTasks.add(t.name);
        }
      }
    } else if (!collapseByDefault && this.collapseDefaultApplied) {
      // Setting turned off — clear defaults (user toggles are preserved only if they re-toggle)
      this.collapseDefaultApplied = false;
      this.collapsedTasks.clear();
    }

    // Set isCollapsed from the persisted set
    for (const t of tasks) {
      t.isCollapsed = this.collapsedTasks.has(t.name);
    }

    // Re-order tasks: children grouped under their parent (hierarchical sort)
    // Build children map
    const childrenMap = new Map<string, GanttTask[]>();
    const roots: GanttTask[] = [];
    for (const t of tasks) {
      if (t.parentId != null && taskByName.has(t.parentId) && t.parentId !== t.name) {
        const siblings = childrenMap.get(t.parentId);
        if (siblings) {
          siblings.push(t);
        } else {
          childrenMap.set(t.parentId, [t]);
        }
      } else {
        roots.push(t);
      }
    }

    // Flatten tree in DFS order
    const ordered: GanttTask[] = [];
    const visit = (node: GanttTask): void => {
      ordered.push(node);
      const children = childrenMap.get(node.name);
      if (children) {
        for (const child of children) {
          visit(child);
        }
      }
    };
    for (const root of roots) {
      visit(root);
    }

    return ordered;
  }

  /**
   * Filter out tasks whose any ancestor is collapsed.
   * The task list is already in DFS order from extractData.
   */
  private filterVisibleTasks(allTasks: GanttTask[]): GanttTask[] {
    // Build a lookup from name to task for ancestor walking
    const taskByName = new Map<string, GanttTask>();
    for (const t of allTasks) {
      if (!taskByName.has(t.name)) {
        taskByName.set(t.name, t);
      }
    }

    return allTasks.filter((task) => {
      // Walk up the parent chain; if any ancestor is collapsed, hide this task
      let current = task;
      const visited = new Set<string>();
      while (current.parentId != null) {
        if (visited.has(current.name)) break; // cycle guard
        visited.add(current.name);

        const parent = taskByName.get(current.parentId);
        if (!parent) break;
        if (this.collapsedTasks.has(parent.name)) return false;
        current = parent;
      }
      return true;
    });
  }

  private resolveDrillContext(allTasks: GanttTask[]): { scopedTasks: GanttTask[]; drillRoot: GanttTask | null } {
    if (!this.settings.drillDownSettings.enabled.value || this.drillPath.length === 0) {
      return { scopedTasks: allTasks, drillRoot: null };
    }

    const taskByName = new Map<string, GanttTask>();
    const childrenMap = new Map<string, GanttTask[]>();
    for (const task of allTasks) {
      if (!taskByName.has(task.name)) {
        taskByName.set(task.name, task);
      }
      if (task.parentId != null) {
        const siblings = childrenMap.get(task.parentId);
        if (siblings) {
          siblings.push(task);
        } else {
          childrenMap.set(task.parentId, [task]);
        }
      }
    }

    let drillRoot: GanttTask | null = null;
    for (const segment of this.drillPath) {
      drillRoot = taskByName.get(segment) ?? null;
      if (!drillRoot) {
        this.drillPath = [];
        return { scopedTasks: allTasks, drillRoot: null };
      }
    }

    if (!drillRoot || !drillRoot.hasChildren) {
      this.drillPath = [];
      return { scopedTasks: allTasks, drillRoot: null };
    }

    const scopedTasks: GanttTask[] = [];
    const visit = (parentName: string): void => {
      const children = childrenMap.get(parentName);
      if (!children) return;
      for (const child of children) {
        scopedTasks.push(child);
        visit(child.name);
      }
    };

    visit(drillRoot.name);

    if (scopedTasks.length === 0) {
      this.drillPath = [];
      return { scopedTasks: allTasks, drillRoot: null };
    }

    return { scopedTasks, drillRoot };
  }

  private render(tasks: GanttTask[], viewport: powerbi.IViewport, drillRoot?: GanttTask | null): void {
    const themeName = resolveColorTheme(this.settings.colorThemeFormattingCard);
    // Clear container
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    renderChartTitle(this.container, this.settings.titleFormattingCard);
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.renderBreadcrumbTrail();

    const s = this.settings;
    const barHeight = Math.max(8, s.taskBarSettings.barHeight.value);
    const showProgress = s.taskBarSettings.showProgress.value;
    const showToday = s.ganttTodaySettings.showTodayLine.value;
    const showLabels = s.taskBarSettings.showLabels.value;
    const barColor = s.colorSettings.barColor.value?.value ?? '#3B82F6';
    const progressColor = s.colorSettings.progressColor.value?.value ?? '#10B981';
    const todayColor = s.ganttTodaySettings.lineColor.value?.value || '#EF4444';
    const animEnabled = s.animationSettings.enabled.value;
    const animDuration = s.animationSettings.duration.value;
    const showDataLabels = s.dataLabelFormattingCard.showDataLabels.value;
    const indentWidth = s.hierarchyGroupingSettings.indentWidth.value;
    const showToggle = s.hierarchyGroupingSettings.showToggle.value;
    const drillEnabled = s.drillDownSettings.enabled.value;
    const drillDepthOffset = drillRoot ? drillRoot.depth + 1 : 0;

    // Apply card style
    const cardMode = (resolveDropdown(s.cardSettings.cardStyleMode) ?? 'glass') as CardStyleMode;
    applyCardStyle(
      this.container,
      {
        mode: cardMode,
        opacity: s.cardSettings.backgroundOpacity.value / 100,
        backgroundColor: s.cardSettings.backgroundColor.value?.value,
        borderRadius: s.cardSettings.borderRadius.value,
      },
    );

    // Empty state
    if (!this.hasRequiredFields || tasks.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'gantt-empty';
      empty.textContent = this.hasRequiredFields && this.emptyStateMode === 'noData'
        ? getLocalizedString(this.host, 'GanttChartPro_NoDataState', 'No data for the current selection.')
        : getLocalizedString(this.host, 'GanttChartPro_EmptyMissingFields', 'Add Task Name, Start Date, and End Date fields');
      this.container.appendChild(empty);
      applyChartAria(this.container, { chartType: 'gantt chart', dataPointCount: 0 });
      return;
    }

    // Compute date range
    const validTasks = tasks.filter((t) =>
      t.startDate && t.endDate && t.endDate.getTime() >= t.startDate.getTime(),
    );
    if (validTasks.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'gantt-empty';
      empty.textContent = getLocalizedString(this.host, 'GanttChartPro_EmptyNoValidRanges', 'No valid date ranges found');
      this.container.appendChild(empty);
      applyChartAria(this.container, { chartType: 'gantt chart', dataPointCount: 0 });
      return;
    }

    let minTime = Infinity;
    let maxTime = -Infinity;
    for (const t of validTasks) {
      const st = t.startDate!.getTime();
      const et = t.endDate!.getTime();
      if (st < minTime) minTime = st;
      if (et > maxTime) maxTime = et;
    }

    const totalRange = maxTime - minTime;
    if (totalRange <= 0) {
      // All tasks same instant — give 1 day range
      maxTime = minTime + 86400000;
    }
    const range = maxTime - minTime;

    // Category color map
    const uniqueCats = [...new Set(validTasks.map((t) => t.category).filter(Boolean))];
    const catColorMap = new Map<string, string>();
    uniqueCats.forEach((cat, i) => {
      catColorMap.set(cat, getHostChartColor(this.host.colorPalette, i, themeName));
    });

    // Layout
    const contentPadding = Math.max(0, this.settings.cardSettings.contentPadding.value);
    this.container.style.padding = `${contentPadding}px`;
    const labelWidth = showLabels ? Math.max(0, this.settings.taskBarSettings.labelWidth.value) : 0;
    const labelGap = showLabels ? 8 : 0;
    const availableWidth = Math.max(0, viewport.width - contentPadding * 2);
    const chartSpanWidth = Math.max(0, availableWidth - labelWidth - labelGap);
    const chartWidth = chartSpanWidth;
    const chartLeft = labelWidth + labelGap;
    const totalWidth = availableWidth;
    const rowGap = this.settings.taskBarSettings.rowGap.value;
    const rowHeight = barHeight + rowGap;

    // Wrapper
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.width = '100%';
    wrapper.style.overflow = 'auto';

    // Header with date ticks
    const header = document.createElement('div');
    header.className = 'gantt-header-row';
    header.style.paddingLeft = '0';
    header.style.position = 'relative';
    header.style.width = `${totalWidth}px`;

    const tickCount = Math.min(6, Math.max(2, Math.floor(chartWidth / 80)));
    for (let t = 0; t <= tickCount; t++) {
      const frac = t / tickCount;
      const tickDate = new Date(minTime + frac * range);
      const tick = document.createElement('span');
      tick.className = 'gantt-tick-label';
      tick.style.position = 'absolute';
      tick.style.left = `${chartLeft + frac * chartWidth}px`;
      tick.style.transform = 'translateX(-50%)';
      tick.textContent = formatShortDate(tickDate);
      header.appendChild(tick);
    }
    wrapper.appendChild(header);

    // Task rows
    const rowsContainer = document.createElement('div');
    rowsContainer.style.position = 'relative';
    rowsContainer.style.width = `${totalWidth}px`;

    // ── Grouping ──────────────────────────────────────────────────
    const enableGrouping = s.hierarchyGroupingSettings.enableGrouping.value;
    const collapsibleGroups = s.hierarchyGroupingSettings.collapsibleGroups.value;

    // Build grouped task list when grouping is enabled
    let displayTasks = validTasks;
    if (enableGrouping) {
      // Group tasks by category
      const groupOrder: string[] = [];
      const groupMap = new Map<string, GanttTask[]>();
      for (const t of validTasks) {
        const groupKey = t.category || '(Ungrouped)';
        if (!groupMap.has(groupKey)) {
          groupMap.set(groupKey, []);
          groupOrder.push(groupKey);
        }
        groupMap.get(groupKey)!.push(t);
      }

      // Render group headers and filter collapsed groups
      displayTasks = [];
      for (const groupName of groupOrder) {
        const isCollapsed = collapsibleGroups && this.collapsedGroups.has(groupName);

        // Group header row
        const groupHeader = document.createElement('div');
        groupHeader.className = 'gantt-group-header';
        groupHeader.style.height = `${rowHeight}px`;
        groupHeader.style.lineHeight = `${barHeight}px`;
        groupHeader.style.paddingLeft = `${contentPadding}px`;
        groupHeader.style.fontWeight = '600';
        groupHeader.style.display = 'flex';
        groupHeader.style.alignItems = 'center';
        groupHeader.style.gap = '6px';
        groupHeader.style.borderBottom = '1px solid #E2E8F0';
        groupHeader.style.userSelect = 'none';

        if (collapsibleGroups) {
          groupHeader.style.cursor = 'pointer';
          makeKeyboardButton(
            groupHeader,
            `${isCollapsed ? 'Expand' : 'Collapse'} ${groupName} group`,
            !isCollapsed,
          );
          const toggleIcon = document.createElement('span');
          toggleIcon.style.fontSize = '10px';
          toggleIcon.textContent = isCollapsed ? '\u25B6' : '\u25BC';
          groupHeader.appendChild(toggleIcon);

          groupHeader.addEventListener('click', () => {
            if (this.collapsedGroups.has(groupName)) {
              this.collapsedGroups.delete(groupName);
            } else {
              this.collapsedGroups.add(groupName);
            }
            if (this.lastUpdateOptions) {
              this.update(this.lastUpdateOptions);
            }
          });
        }

        const groupLabel = document.createElement('span');
        groupLabel.textContent = groupName;
        groupHeader.appendChild(groupLabel);

        const groupCount = document.createElement('span');
        groupCount.style.opacity = '0.6';
        groupCount.style.fontSize = '0.85em';
        groupCount.textContent = `(${groupMap.get(groupName)!.length})`;
        groupHeader.appendChild(groupCount);

        rowsContainer.appendChild(groupHeader);

        if (!isCollapsed) {
          displayTasks.push(...groupMap.get(groupName)!);
        }
      }
    }

    displayTasks.forEach((task, idx) => {
      const row = document.createElement('div');
      row.className = 'gantt-task-row';
      row.dataset.selectionKey = task.selectionId.getKey();
      row.style.height = `${rowHeight}px`;
      row.style.cursor = allowInteractions(this.host) ? 'pointer' : 'default';
      row.addEventListener('mouseenter', (event) => this.showTaskTooltip(task, event));
      row.addEventListener('mousemove', (event) => this.moveTooltip(event));
      row.addEventListener('mouseleave', () => this.hideTooltip());
      row.addEventListener('click', (event) => {
        event.stopPropagation();
        if (!allowInteractions(this.host)) return;
        void this.selectionManager.select(task.selectionId, event.ctrlKey || event.metaKey).then(() => {
          this.applySelectionHighlight();
        });
      });
      row.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!allowInteractions(this.host)) return;
        void this.selectionManager.showContextMenu(task.selectionId, {
          x: event.clientX,
          y: event.clientY,
        });
      });

      // Label with hierarchy indentation
      if (showLabels) {
        const label = document.createElement('div');
        label.className = 'gantt-task-label';
        label.style.width = `${labelWidth}px`;
        label.style.display = 'flex';
        label.style.alignItems = 'center';
        label.style.overflow = 'hidden';

        // Indent spacer based on depth
        const indent = Math.max(0, task.depth - drillDepthOffset) * indentWidth;
        if (indent > 0) {
          const spacer = document.createElement('span');
          spacer.style.display = 'inline-block';
          spacer.style.flexShrink = '0';
          spacer.style.width = `${indent}px`;
          label.appendChild(spacer);
        }

        // Toggle icon for parent tasks
        if (showToggle && task.hasChildren) {
          const toggle = document.createElement('span');
          toggle.className = 'gantt-hierarchy-toggle';
          toggle.style.cursor = 'pointer';
          toggle.style.flexShrink = '0';
          toggle.style.width = '16px';
          toggle.style.textAlign = 'center';
          toggle.style.userSelect = 'none';
          toggle.style.fontSize = '10px';
          toggle.style.lineHeight = `${barHeight}px`;
          toggle.textContent = task.isCollapsed ? '\u25B6' : '\u25BC';
          makeKeyboardButton(
            toggle,
            `${task.isCollapsed ? 'Expand' : 'Collapse'} ${task.name}`,
            !task.isCollapsed,
          );
          toggle.addEventListener('click', (event) => {
            event.stopPropagation();
            this.toggleCollapse(task.name);
          });
          label.appendChild(toggle);
        } else if (showToggle) {
          // Placeholder to keep alignment consistent
          const placeholder = document.createElement('span');
          placeholder.style.display = 'inline-block';
          placeholder.style.flexShrink = '0';
          placeholder.style.width = '16px';
          label.appendChild(placeholder);
        }

        if (drillEnabled && task.hasChildren) {
          const drillToggle = document.createElement('span');
          drillToggle.className = 'gantt-drill-toggle';
          drillToggle.title = `Drill into ${task.name}`;
          drillToggle.style.cursor = 'pointer';
          drillToggle.style.flexShrink = '0';
          drillToggle.style.width = '16px';
          drillToggle.style.textAlign = 'center';
          drillToggle.style.userSelect = 'none';
          drillToggle.style.fontSize = '10px';
          drillToggle.style.lineHeight = `${barHeight}px`;
          drillToggle.textContent = '\u21B3';
          makeKeyboardButton(drillToggle, `Drill into ${task.name}`);
          drillToggle.addEventListener('click', (event) => {
            event.stopPropagation();
            this.drillPath.push(task.name);
            if (this.lastUpdateOptions) {
              this.update(this.lastUpdateOptions);
            }
          });
          label.appendChild(drillToggle);
        } else if (drillEnabled) {
          const placeholder = document.createElement('span');
          placeholder.style.display = 'inline-block';
          placeholder.style.flexShrink = '0';
          placeholder.style.width = '16px';
          label.appendChild(placeholder);
        }

        const nameSpan = document.createElement('span');
        nameSpan.style.overflow = 'hidden';
        nameSpan.style.textOverflow = 'ellipsis';
        nameSpan.style.whiteSpace = 'nowrap';
        nameSpan.textContent = task.name;
        label.appendChild(nameSpan);

        row.appendChild(label);
      }

      // Bar track
      const track = document.createElement('div');
      track.className = 'gantt-bar-track';
      track.style.width = `${chartSpanWidth}px`;
      track.style.height = `${barHeight}px`;

      // Calculate bar position
      const startFrac = (task.startDate!.getTime() - minTime) / range;
      const endFrac = (task.endDate!.getTime() - minTime) / range;
      const barLeft = startFrac * chartWidth;
      const barWidth = Math.max(2, (endFrac - startFrac) * chartWidth);

      const baseColor = task.category && catColorMap.has(task.category)
        ? catColorMap.get(task.category)!
        : barColor;
      const color = this.getConditionalColor(task.progress) ?? baseColor;

      // Bar element
      const bar = document.createElement('div');
      bar.className = 'gantt-bar';
      bar.style.left = `${barLeft}px`;
      bar.style.width = `${barWidth}px`;
      bar.style.height = `${barHeight}px`;
      bar.style.backgroundColor = color;
      bar.style.opacity = String(this.settings.taskBarSettings.barOpacity.value / 100);
      bar.style.borderRadius = `${s.taskBarSettings.barCornerRadius.value}px`;

      // Task bar border stroke
      const taskBorderWidth = s.taskBarSettings.taskBorderWidth.value;
      if (taskBorderWidth > 0) {
        const taskBorderColor = s.taskBarSettings.taskBorderColor.value?.value || '#000000';
        bar.style.border = `${taskBorderWidth}px solid ${taskBorderColor}`;
        bar.style.boxSizing = 'border-box';
      }

      track.appendChild(bar);

      // Progress overlay
      if (showProgress && task.progress > 0) {
        const prog = document.createElement('div');
        prog.className = 'gantt-bar-progress';
        prog.style.left = `${barLeft}px`;
        prog.style.width = `${barWidth * (task.progress / 100)}px`;
        prog.style.height = `${barHeight}px`;
        prog.style.backgroundColor = progressColor;
        prog.style.borderRadius = `${s.taskBarSettings.barCornerRadius.value}px`;

        track.appendChild(prog);
      }

      // Data label (progress %)
      if (showDataLabels) {
        const dataLabel = document.createElement('div');
        dataLabel.className = 'gantt-data-label';
        dataLabel.style.position = 'absolute';
        dataLabel.style.left = `${barLeft + barWidth + 4}px`;
        dataLabel.style.top = '0';
        dataLabel.style.height = `${barHeight}px`;
        dataLabel.style.lineHeight = `${barHeight}px`;
        dataLabel.style.whiteSpace = 'nowrap';
        dataLabel.style.pointerEvents = 'none';
        dataLabel.textContent = formatPercent(task.progress, { decimals: 0 });
        track.appendChild(dataLabel);
      }

      row.appendChild(track);
      rowsContainer.appendChild(row);

      // Animation — growBar on the bar element
      if (animEnabled) {
        const cancel = growBar(bar, idx * 60, animDuration, 'horizontal');
        this.cancelAnimations.push(cancel);

        if (showProgress && task.progress > 0) {
          const progEl = track.querySelector('.gantt-bar-progress') as HTMLElement | null;
          if (progEl) {
            const cancelProg = growBar(progEl, idx * 60 + 100, animDuration, 'horizontal');
            this.cancelAnimations.push(cancelProg);
          }
        }

        if (showLabels) {
          const labelEl = row.querySelector('.gantt-task-label') as HTMLElement | null;
          if (labelEl) {
            const cancelLabel = fadeSlideIn(labelEl, 'right', DURATION.fast, idx * 60);
            this.cancelAnimations.push(cancelLabel);
          }
        }

        if (showDataLabels) {
          const dataLabelEl = row.querySelector('.gantt-data-label') as HTMLElement | null;
          if (dataLabelEl) {
            const cancelDataLabel = fadeSlideIn(dataLabelEl, 'left', DURATION.fast, idx * 60 + 100);
            this.cancelAnimations.push(cancelDataLabel);
          }
        }
      }
    });

    // Today line
    if (showToday) {
      const now = Date.now();
      if (now >= minTime && now <= maxTime) {
        const todayFrac = (now - minTime) / range;
        const todayLine = document.createElement('div');
        todayLine.className = 'gantt-today-line';
        todayLine.style.left = `${chartLeft + todayFrac * chartWidth}px`;
        todayLine.style.width = `${s.ganttTodaySettings.todayLineWidth.value}px`;

        const todayStyleValue = s.ganttTodaySettings.todayLineStyle.value;
        const todayStyle = typeof todayStyleValue === 'string'
          ? todayStyleValue
          : (todayStyleValue as { value?: string } | undefined)?.value ?? 'dashed';

        if (todayStyle === 'dashed') {
          todayLine.style.backgroundImage = `repeating-linear-gradient(to bottom, ${todayColor} 0, ${todayColor} 4px, transparent 4px, transparent 7px)`;
          todayLine.style.backgroundColor = 'transparent';
        } else {
          todayLine.style.backgroundColor = todayColor;
        }

        rowsContainer.appendChild(todayLine);
      }
    }

    // Dependency arrows
    if (this.settings.dependencySettings.show.value) {
      this.renderDependencyArrows(
        rowsContainer, displayTasks, labelWidth, chartLeft, chartWidth, barHeight, rowHeight, range, minTime,
      );
    }

    wrapper.appendChild(rowsContainer);
    this.container.appendChild(wrapper);

    // ── Apply data label formatting ──────────────────────────────────
    if (showDataLabels) {
      applyDataLabelFormatting(this.container, s.dataLabelFormattingCard, '.gantt-data-label');
    }

    // ── Apply axis formatting ────────────────────────────────────────
    this.applyAxisCardFormatting(header, rowsContainer, displayTasks.length, rowHeight, chartLeft, chartWidth, tickCount);

    // ── Milestones, baselines, critical path, accessibility ──────────
    this.renderMilestoneMarkers(rowsContainer, displayTasks, labelWidth, chartLeft, chartWidth, barHeight, rowHeight, range, minTime);
    this.renderBaselineBars(rowsContainer, displayTasks, labelWidth, chartLeft, chartWidth, barHeight, rowHeight, range, minTime);
    this.applyCriticalPathHighlighting(displayTasks);
    this.renderLegendFromCategories(catColorMap);
    this.applyAccessibility(displayTasks);

    this.container.addEventListener('click', this.handleBackgroundClick);
  }

  private applyHighContrast(): void {
    const highContrast = getHostHighContrastColors(this.host);
    applyBasicHighContrastStyles(this.container, highContrast, {
      textSelectors: [
        '.gantt-task-label',
        '.gantt-tick-label',
        '.gantt-data-label',
        '.gantt-group-header',
        '.gantt-breadcrumb',
        '.gantt-empty',
      ],
      lineSelectors: ['.gantt-grid-line', '.gantt-today-line'],
      fillSelectors: ['.gantt-bar', '.gantt-bar-progress', '.gantt-milestone-marker'],
      strokeSelectors: ['.gantt-bar'],
    });
    if (!highContrast.enabled) {
      const card = this.settings.cardSettings;
      applyCardStyle(this.container, {
        mode: (resolveDropdown(card.cardStyleMode) ?? 'glass') as CardStyleMode,
        opacity: card.backgroundOpacity.value / 100,
        backgroundColor: card.backgroundColor.value?.value,
        borderRadius: card.borderRadius.value,
      });
    }
  }

  /** Toggle the collapsed state of a parent task and re-render. */
  private toggleCollapse(taskName: string): void {
    if (this.collapsedTasks.has(taskName)) {
      this.collapsedTasks.delete(taskName);
    } else {
      this.collapsedTasks.add(taskName);
    }
    // Re-render using the last update options
    if (this.lastUpdateOptions) {
      this.update(this.lastUpdateOptions);
    }
  }

  private renderBreadcrumbTrail(): void {
    const ds = this.settings.drillDownSettings;
    if (!ds.enabled.value || !ds.showBreadcrumb.value || this.drillPath.length === 0) return;

    const fontSize = ds.breadcrumbFontSize.value;
    const color = ds.breadcrumbColor.value?.value || '#64748B';
    const fontFamily = resolveDropdown(ds.breadcrumbFontFamily);
    const fontWeight = resolveDropdown(ds.breadcrumbFontWeight) ?? 'normal';
    const padding = Math.max(0, ds.breadcrumbPadding.value);

    const breadcrumb = document.createElement('div');
    breadcrumb.className = 'gantt-breadcrumb';
    breadcrumb.style.display = 'flex';
    breadcrumb.style.alignItems = 'center';
    breadcrumb.style.gap = '4px';
    breadcrumb.style.padding = `${Math.max(2, Math.round(padding / 2))}px ${padding}px`;
    breadcrumb.style.fontSize = `${fontSize}px`;
    breadcrumb.style.color = color;
    breadcrumb.style.flexWrap = 'wrap';
    breadcrumb.style.fontWeight = fontWeight;
    if (fontFamily) breadcrumb.style.fontFamily = fontFamily;

    const appendClickable = (label: string, onClick: () => void, isFinal = false): void => {
      const item = document.createElement('span');
      item.textContent = label;
      item.style.color = color;
      if (isFinal) {
        item.style.fontWeight = '600';
      } else {
        item.style.cursor = 'pointer';
        item.style.textDecoration = 'underline';
        makeKeyboardButton(item, `Return to ${label}`);
        item.addEventListener('click', (event: MouseEvent) => {
          event.stopPropagation();
          onClick();
        });
      }
      breadcrumb.appendChild(item);
    };

    appendClickable('All', () => {
      this.drillPath = [];
      if (this.lastUpdateOptions) {
        this.update(this.lastUpdateOptions);
      }
    });

    for (let i = 0; i < this.drillPath.length; i++) {
      const sep = document.createElement('span');
      sep.textContent = ' > ';
      sep.style.color = color;
      breadcrumb.appendChild(sep);

      const isFinal = i === this.drillPath.length - 1;
      appendClickable(
        this.drillPath[i],
        () => {
          this.drillPath = this.drillPath.slice(0, i + 1);
          if (this.lastUpdateOptions) {
            this.update(this.lastUpdateOptions);
          }
        },
        isFinal,
      );
    }

    this.container.appendChild(breadcrumb);
    if (this.settings.animationSettings.enabled.value) {
      const cancel = fadeSlideIn(breadcrumb, 'left', DURATION.fast);
      this.cancelAnimations.push(cancel);
    }
  }

  /**
   * Render finish-to-start dependency arrows between Gantt bars as an SVG overlay.
   */
  private renderDependencyArrows(
    rowsContainer: HTMLElement,
    tasks: GanttTask[],
    labelWidth: number,
    chartLeft: number,
    chartWidth: number,
    barHeight: number,
    rowHeight: number,
    range: number,
    minTime: number,
  ): void {
    const depSettings = this.settings.dependencySettings;
    const lineColor = this.resolveColorValue(depSettings.lineColor, '#94A3B8');
    const lineWidth = depSettings.lineWidth.value;
    const arrowSize = depSettings.arrowSize.value;
    const lineStyleValue = depSettings.lineStyle.value;
    const lineStyle = typeof lineStyleValue === 'string'
      ? lineStyleValue
      : (lineStyleValue as { value?: string } | undefined)?.value ?? 'solid';

    // Build a lookup from taskId to row index
    const taskIndexMap = new Map<string, number>();
    for (let i = 0; i < tasks.length; i++) {
      taskIndexMap.set(tasks[i].taskId, i);
    }

    // Also build a lookup by task name alone (for when dependency values reference just the name)
    const taskNameIndexMap = new Map<string, number>();
    for (let i = 0; i < tasks.length; i++) {
      // Only store the first occurrence to avoid ambiguity
      if (!taskNameIndexMap.has(tasks[i].name)) {
        taskNameIndexMap.set(tasks[i].name, i);
      }
    }

    // Collect dependency edges: { fromIdx, toIdx }
    interface DepEdge { fromIdx: number; toIdx: number }
    const edges: DepEdge[] = [];

    for (let i = 0; i < tasks.length; i++) {
      const depId = tasks[i].dependencyId;
      if (depId == null) continue;

      // Look up predecessor by taskId first, then by name
      let predIdx = taskIndexMap.get(depId);
      if (predIdx === undefined) {
        predIdx = taskNameIndexMap.get(depId);
      }
      if (predIdx === undefined) continue; // predecessor not found — skip
      if (predIdx === i) continue; // self-dependency — skip

      edges.push({ fromIdx: predIdx, toIdx: i });
    }

    if (edges.length === 0) return;

    // Create SVG overlay
    const svgNS = 'http://www.w3.org/2000/svg';
    const totalHeight = tasks.length * rowHeight;
    const totalWidth = chartLeft + chartWidth;

    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', String(totalWidth));
    svg.setAttribute('height', String(totalHeight));
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.pointerEvents = 'none';
    svg.style.overflow = 'visible';

    // Define arrowhead marker
    const defs = document.createElementNS(svgNS, 'defs');
    const marker = document.createElementNS(svgNS, 'marker');
    marker.setAttribute('id', 'gantt-dep-arrowhead');
    marker.setAttribute('markerWidth', String(arrowSize));
    marker.setAttribute('markerHeight', String(arrowSize));
    marker.setAttribute('refX', String(arrowSize));
    marker.setAttribute('refY', String(arrowSize / 2));
    marker.setAttribute('orient', 'auto');
    marker.setAttribute('markerUnits', 'userSpaceOnUse');

    const arrowPath = document.createElementNS(svgNS, 'path');
    arrowPath.setAttribute('d', `M0,0 L${arrowSize},${arrowSize / 2} L0,${arrowSize} Z`);
    arrowPath.setAttribute('fill', lineColor);
    marker.appendChild(arrowPath);
    defs.appendChild(marker);
    svg.appendChild(defs);

    // Horizontal offset for routing (gap between bar end and connector start)
    const hGap = 8;
    const cornerRadius = 4;

    for (const edge of edges) {
      const fromTask = tasks[edge.fromIdx];
      const toTask = tasks[edge.toIdx];

      // Both tasks must have valid dates to compute bar positions
      if (!fromTask.startDate || !fromTask.endDate || !toTask.startDate || !toTask.endDate) continue;

      // From bar: right edge
      const fromEndFrac = (fromTask.endDate.getTime() - minTime) / range;
      const fromBarRight = chartLeft + fromEndFrac * chartWidth;
      const fromRowCenterY = edge.fromIdx * rowHeight + barHeight / 2;

      // To bar: left edge
      const toStartFrac = (toTask.startDate.getTime() - minTime) / range;
      const toBarLeft = chartLeft + toStartFrac * chartWidth;
      const toRowCenterY = edge.toIdx * rowHeight + barHeight / 2;

      // Build a right-angle path with rounded corners:
      // From right edge of predecessor → horizontal gap → vertical to target row → horizontal to target left edge
      const midX = fromBarRight + hGap;
      const goingDown = toRowCenterY > fromRowCenterY;
      const goingUp = toRowCenterY < fromRowCenterY;
      const r = Math.min(cornerRadius, Math.abs(toRowCenterY - fromRowCenterY) / 2, hGap);

      let d: string;
      if (!goingDown && !goingUp) {
        // Same row — straight horizontal line
        d = `M${fromBarRight},${fromRowCenterY} L${toBarLeft - arrowSize},${toRowCenterY}`;
      } else {
        const vertDir = goingDown ? 1 : -1;
        // Start: horizontal from predecessor right edge
        // Corner 1: turn from horizontal to vertical
        const c1x = midX - r;
        const c1y = fromRowCenterY;
        const c1ex = midX;
        const c1ey = fromRowCenterY + vertDir * r;

        // Corner 2: turn from vertical to horizontal (towards target)
        const c2x = midX;
        const c2y = toRowCenterY - vertDir * r;
        const c2ex = midX + r;
        const c2ey = toRowCenterY;

        const endX = toBarLeft - arrowSize;

        d = [
          `M${fromBarRight},${fromRowCenterY}`,
          `L${c1x},${c1y}`,
          `Q${midX},${fromRowCenterY} ${c1ex},${c1ey}`,
          `L${c2x},${c2y}`,
          `Q${midX},${toRowCenterY} ${c2ex},${c2ey}`,
          `L${endX},${toRowCenterY}`,
        ].join(' ');
      }

      const pathEl = document.createElementNS(svgNS, 'path');
      pathEl.setAttribute('d', d);
      pathEl.setAttribute('fill', 'none');
      pathEl.setAttribute('stroke', lineColor);
      pathEl.setAttribute('stroke-width', String(lineWidth));
      pathEl.setAttribute('marker-end', 'url(#gantt-dep-arrowhead)');

      if (lineStyle === 'dashed') {
        pathEl.setAttribute('stroke-dasharray', '6 3');
      }

      svg.appendChild(pathEl);
    }

    rowsContainer.appendChild(svg);
  }

  /**
   * Apply AxisFormattingCard settings to the HTML-based gantt header + rows.
   * - Date tick labels + task labels: color, font-size
   * - Header border (axis line): color, width
   * - Vertical grid lines: visibility, color, style
   */
  private applyAxisCardFormatting(
    header: HTMLElement,
    rowsContainer: HTMLElement,
    taskCount: number,
    rowHeight: number,
    chartLeft: number,
    chartWidth: number,
    tickCount: number,
  ): void {
    const axisCard = this.settings.axisFormattingCard;

    const labelColor = this.resolveColorValue(axisCard.axisLabelColor, '#64748B');
    const labelSize = axisCard.axisLabelSize.value;
    const labelFontFamily = resolveDropdown(axisCard.axisLabelFontFamily);
    const labelFontWeight = resolveDropdown(axisCard.axisLabelFontWeight) ?? 'normal';
    const lineColor = this.resolveColorValue(axisCard.axisLineColor, '#CBD5E1');
    const lineWidth = axisCard.axisLineWidth.value;

    // Style date tick labels
    const tickLabels = this.container.querySelectorAll<HTMLElement>('.gantt-tick-label');
    for (const tick of tickLabels) {
      tick.style.color = labelColor;
      tick.style.fontSize = `${labelSize}px`;
      if (labelFontFamily) tick.style.fontFamily = labelFontFamily;
      tick.style.fontWeight = labelFontWeight;
    }

    // Style task labels — use dedicated task label font settings when available
    const taskLabelFontSize = this.settings.taskBarSettings.labelFontSize.value;
    const taskLabelFontColor = this.settings.taskBarSettings.labelFontColor.value?.value;
    const taskLabelFontFamily = resolveDropdown(this.settings.taskBarSettings.labelFontFamily);
    const taskLabelFontWeight = resolveDropdown(this.settings.taskBarSettings.labelFontWeight);
    const taskLabels = this.container.querySelectorAll<HTMLElement>('.gantt-task-label');
    for (const label of taskLabels) {
      label.style.color = (taskLabelFontColor && taskLabelFontColor.length > 0) ? taskLabelFontColor : labelColor;
      label.style.fontSize = `${taskLabelFontSize}px`;
      if (taskLabelFontFamily) label.style.fontFamily = taskLabelFontFamily;
      label.style.fontWeight = taskLabelFontWeight || 'normal';
    }

    // Style header bottom border (axis line)
    header.style.borderBottomColor = lineColor;
    header.style.borderBottomWidth = `${lineWidth}px`;
    header.style.borderBottomStyle = 'solid';

    // Grid lines
    if (axisCard.showGridLines.value) {
      const gridColor = this.resolveColorValue(axisCard.gridLineColor, '#E2E8F0');
      const gridWidth = Math.max(0, axisCard.gridLineWidth.value);
      const gridOpacity = Math.max(0, Math.min(100, axisCard.gridLineOpacity.value)) / 100;
      const gridStyleValue = axisCard.gridLineStyle.value;
      const gridStyle = typeof gridStyleValue === 'string'
        ? gridStyleValue
        : (gridStyleValue as { value?: string } | undefined)?.value ?? 'dashed';
      const totalHeight = taskCount * rowHeight;

      for (let t = 1; t < tickCount; t++) {
        const frac = t / tickCount;
        const gridLine = document.createElement('div');
        gridLine.className = 'gantt-grid-line';
        gridLine.style.position = 'absolute';
        gridLine.style.left = `${chartLeft + frac * chartWidth}px`;
        gridLine.style.top = '0';
        gridLine.style.height = `${totalHeight}px`;
        gridLine.style.width = `${gridWidth}px`;
        gridLine.style.backgroundColor = gridStyle === 'solid' ? gridColor : 'transparent';
        gridLine.style.pointerEvents = 'none';
        gridLine.style.opacity = String(gridOpacity);
        gridLine.style.zIndex = '0';

        if (gridStyle === 'dashed') {
          gridLine.style.backgroundImage = `repeating-linear-gradient(to bottom, ${gridColor} 0, ${gridColor} 4px, transparent 4px, transparent 7px)`;
          gridLine.style.backgroundColor = 'transparent';
        }

        rowsContainer.appendChild(gridLine);
      }
    }
  }

  /** Resolve a ColorPicker value, returning fallback when empty. */
  private resolveColorValue(
    picker: { value?: { value?: string } },
    fallback: string,
  ): string {
    const v = picker?.value?.value;
    return v && v.length > 0 ? v : fallback;
  }

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    this.syncFormattingVisibility();
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  private migrateLegacyFormatting(dataView: DataView | undefined): void {
    const objects = dataView?.metadata?.objects;
    const legacy = objects?.['ganttSettings'] as Record<string, unknown> | undefined;
    if (!legacy) return;

    const taskBars = objects?.['taskBarSettings'] as Record<string, unknown> | undefined;
    const today = objects?.['ganttTodaySettings'] as Record<string, unknown> | undefined;
    const migrateTaskNumber = (name: 'barOpacity' | 'barCornerRadius' | 'rowGap' | 'labelWidth'): void => {
      const value = legacy[name];
      if (!(taskBars && Object.prototype.hasOwnProperty.call(taskBars, name)) && typeof value === 'number') {
        this.settings.taskBarSettings[name].value = value;
      }
    };

    migrateTaskNumber('barOpacity');
    migrateTaskNumber('barCornerRadius');
    migrateTaskNumber('rowGap');
    migrateTaskNumber('labelWidth');

    const legacyWidth = legacy['todayLineWidth'];
    if (!(today && Object.prototype.hasOwnProperty.call(today, 'todayLineWidth')) && typeof legacyWidth === 'number') {
      this.settings.ganttTodaySettings.todayLineWidth.value = legacyWidth;
    }
    const legacyStyle = legacy['todayLineStyle'];
    if (!(today && Object.prototype.hasOwnProperty.call(today, 'todayLineStyle')) && (legacyStyle === 'solid' || legacyStyle === 'dashed')) {
      this.settings.ganttTodaySettings.todayLineStyle.value = {
        value: legacyStyle,
        displayName: legacyStyle === 'solid' ? 'Solid' : 'Dashed',
      };
    }
  }

  private updateRoleAvailability(dataView: DataView | undefined): void {
    const categorical = dataView?.categorical;
    const columns = [
      ...(categorical?.categories ?? []),
      ...Array.from(categorical?.values ?? []),
    ];
    const hasRole = (role: string): boolean => columns.some((column) => Boolean(column.source.roles?.[role]));
    this.hasCategoryRole = hasRole('category');
    this.hasDependencyRole = hasRole('dependency');
    this.hasParentRole = hasRole('parentTask');
    this.hasProgressRole = hasRole('progress');
    this.hasRequiredFields = hasRole('taskName') && hasRole('startDate') && hasRole('endDate');
  }

  private syncFormattingVisibility(): void {
    const s = this.settings;
    syncTitleFormattingVisibility(s.titleFormattingCard);
    syncLegendFormattingVisibility(s.legendFormattingCard);
    syncDateFilterFormattingVisibility(s.dateFilterFormattingCard);
    syncCardStyleVisibility(s.cardSettings);
    s.cardSettings.borderRadius.visible = resolveDropdown(s.cardSettings.cardStyleMode) !== 'none';

    s.legendFormattingCard.visible = this.hasCategoryRole;
    s.legendFormattingCard.showInlineLabels.visible = false;
    s.legendFormattingCard.inlineLabelFontSize.visible = false;
    s.legendFormattingCard.inlineLabelOffset.visible = false;
    s.colorThemeFormattingCard.visible = this.hasCategoryRole;

    s.axisFormattingCard.showXAxis.visible = false;
    s.axisFormattingCard.showYAxis.visible = false;
    s.axisFormattingCard.xAxisTitle.visible = false;
    s.axisFormattingCard.yAxisTitle.visible = false;
    s.axisFormattingCard.axisLabelRotation.visible = false;
    s.axisFormattingCard.yAxisMin.visible = false;
    s.axisFormattingCard.yAxisMax.visible = false;
    s.axisFormattingCard.integerTicks.visible = false;
    const showGridLines = s.axisFormattingCard.showGridLines.value;
    s.axisFormattingCard.gridLineColor.visible = showGridLines;
    s.axisFormattingCard.gridLineStyle.visible = showGridLines;
    s.axisFormattingCard.gridLineWidth.visible = showGridLines;
    s.axisFormattingCard.gridLineOpacity.visible = showGridLines;

    const showTaskLabels = s.taskBarSettings.showLabels.value;
    s.taskBarSettings.labelWidth.visible = showTaskLabels;
    s.taskBarSettings.labelFontSize.visible = showTaskLabels;
    s.taskBarSettings.labelFontColor.visible = showTaskLabels;
    s.taskBarSettings.labelFontFamily.visible = showTaskLabels;
    s.taskBarSettings.labelFontWeight.visible = showTaskLabels;
    s.taskBarSettings.taskBorderColor.visible = s.taskBarSettings.taskBorderWidth.value > 0;
    s.taskBarSettings.showProgress.visible = this.hasProgressRole;
    s.colorSettings.progressColor.visible = s.taskBarSettings.showProgress.value && this.hasProgressRole;

    s.dataLabelFormattingCard.visible = this.hasProgressRole;
    s.numberFormattingCard.visible = this.hasProgressRole;
    const showDataLabels = this.hasProgressRole && s.dataLabelFormattingCard.showDataLabels.value;
    s.dataLabelFormattingCard.dataLabelFontSize.visible = showDataLabels;
    s.dataLabelFormattingCard.dataLabelFontColor.visible = showDataLabels;
    s.dataLabelFormattingCard.dataLabelFontWeight.visible = showDataLabels;
    s.dataLabelFormattingCard.dataLabelFontFamily.visible = showDataLabels;
    s.dataLabelFormattingCard.dataLabelPosition.visible = false;

    const showTodayLine = s.ganttTodaySettings.showTodayLine.value;
    s.ganttTodaySettings.lineColor.visible = showTodayLine;
    s.ganttTodaySettings.todayLineWidth.visible = showTodayLine;
    s.ganttTodaySettings.todayLineStyle.visible = showTodayLine;

    s.dependencySettings.visible = this.hasDependencyRole;
    const showDependencies = this.hasDependencyRole && s.dependencySettings.show.value;
    s.dependencySettings.lineColor.visible = showDependencies;
    s.dependencySettings.lineWidth.visible = showDependencies;
    s.dependencySettings.arrowSize.visible = showDependencies;
    s.dependencySettings.lineStyle.visible = showDependencies;

    s.ganttMilestoneSettings.shape.visible = s.ganttMilestoneSettings.show.value;
    s.ganttMilestoneSettings.color.visible = s.ganttMilestoneSettings.show.value;
    s.ganttCriticalPathSettings.visible = this.hasDependencyRole;
    const showCriticalPath = this.hasDependencyRole && s.ganttCriticalPathSettings.show.value;
    s.ganttCriticalPathSettings.color.visible = showCriticalPath;
    s.ganttCriticalPathSettings.lineWidth.visible = showCriticalPath;
    s.ganttBaselineSettings.color.visible = s.ganttBaselineSettings.show.value;
    s.ganttBaselineSettings.opacity.visible = s.ganttBaselineSettings.show.value;

    s.hierarchyGroupingSettings.visible = this.hasCategoryRole || this.hasParentRole;
    s.hierarchyGroupingSettings.enableGrouping.visible = this.hasCategoryRole;
    s.hierarchyGroupingSettings.collapsibleGroups.visible = this.hasCategoryRole && s.hierarchyGroupingSettings.enableGrouping.value;
    s.hierarchyGroupingSettings.indentWidth.visible = this.hasParentRole && showTaskLabels;
    s.hierarchyGroupingSettings.showToggle.visible = this.hasParentRole && showTaskLabels;
    s.hierarchyGroupingSettings.collapseByDefault.visible = this.hasParentRole;

    s.drillDownSettings.visible = this.hasParentRole;
    const drillEnabled = this.hasParentRole && s.drillDownSettings.enabled.value;
    s.drillDownSettings.showBreadcrumb.visible = drillEnabled;
    const showBreadcrumb = drillEnabled && s.drillDownSettings.showBreadcrumb.value;
    s.drillDownSettings.breadcrumbFontSize.visible = showBreadcrumb;
    s.drillDownSettings.breadcrumbColor.visible = showBreadcrumb;
    s.drillDownSettings.breadcrumbFontFamily.visible = showBreadcrumb;
    s.drillDownSettings.breadcrumbFontWeight.visible = showBreadcrumb;
    s.drillDownSettings.breadcrumbPadding.visible = showBreadcrumb;

    s.animationSettings.duration.visible = s.animationSettings.enabled.value;
    s.conditionalFormattingCard.visible = this.hasProgressRole;
    const conditionalEnabled = this.hasProgressRole && s.conditionalFormattingCard.enableConditional.value;
    s.conditionalFormattingCard.conditionalDirection.visible = conditionalEnabled;
    s.conditionalFormattingCard.threshold1.visible = conditionalEnabled;
    s.conditionalFormattingCard.threshold2.visible = conditionalEnabled;
    s.conditionalFormattingCard.conditionalColor1.visible = conditionalEnabled;
    s.conditionalFormattingCard.conditionalColor2.visible = conditionalEnabled;
    s.conditionalFormattingCard.conditionalColor3.visible = conditionalEnabled;
  }

  private showTaskTooltip(task: GanttTask, event: MouseEvent): void {
    const locale = this.getHostLocale();
    const tooltipData: VisualTooltipDataItem[] = [
      { displayName: 'Task', value: task.name },
    ];

    if (task.startDate) {
      tooltipData.push({ displayName: 'Start', value: formatShortDate(task.startDate, locale) });
    }
    if (task.endDate) {
      tooltipData.push({ displayName: 'End', value: formatShortDate(task.endDate, locale) });
    }
    if (task.startDate && task.endDate) {
      const diffMs = task.endDate.getTime() - task.startDate.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      tooltipData.push({ displayName: 'Duration', value: `${diffDays} day${diffDays !== 1 ? 's' : ''}` });
    }

    tooltipData.push({ displayName: 'Progress', value: formatWithSettings(task.progress, this.settings.numberFormattingCard) + '%' });

    this.host.tooltipService.show({
      dataItems: tooltipData,
      identities: [task.selectionId],
      coordinates: [event.clientX, event.clientY],
      isTouchEvent: false,
    });
  }

  private moveTooltip(event: MouseEvent): void {
    this.host.tooltipService.move({
      dataItems: [],
      identities: [],
      coordinates: [event.clientX, event.clientY],
      isTouchEvent: false,
    });
  }

  private hideTooltip(): void {
    this.host.tooltipService.hide({ immediately: true, isTouchEvent: false });
  }

  private getHostLocale(): string | undefined {
    const locale = (this.host as unknown as { locale?: unknown }).locale;
    return typeof locale === 'string' && locale.length > 0 ? locale : undefined;
  }

  // Render lifecycle notifications removed — Power BI's eventService.renderingStarted()
  // requires VisualUpdateOptions with updateId, and calling without args crashes the visual.

  // -- Selection & Cross-Highlight --------------------------------------------

  private applySelectionHighlight(): void {
    const hasSelection = this.selectionManager.hasSelection();
    const selectedIds = this.selectionManager.getSelectionIds() as ISelectionId[];
    const selectedKeys = new Set(selectedIds.map((id) => id.getKey()));

    // Build set of highlighted keys from cross-highlight data
    const highlightedKeys = new Set<string>();
    if (this.hasHighlights) {
      for (const task of this.currentTasks) {
        if (task.highlighted) {
          highlightedKeys.add(task.selectionId.getKey());
        }
      }
    }

    const rows = this.container.querySelectorAll<HTMLElement>('.gantt-task-row');

    const shouldDim = hasSelection || this.hasHighlights;
    for (const el of Array.from(rows)) {
      if (shouldDim) {
        const elKey = el.dataset.selectionKey;
        const isSelected = hasSelection && elKey && selectedKeys.has(elKey);
        const isHighlighted = this.hasHighlights && elKey && highlightedKeys.has(elKey);
        el.style.opacity = (isSelected || isHighlighted) ? '' : '0.3';
      } else {
        el.style.opacity = '';
      }
    }
  }

  private handleBackgroundClick = (): void => {
    if (!allowInteractions(this.host)) return;
    void this.selectionManager.clear().then(() => {
      this.applySelectionHighlight();
    });
  };

  // -- Milestone Markers -------------------------------------------------------

  /**
   * Renders milestone markers (diamond/circle/triangle) for zero-duration tasks.
   */
  private renderMilestoneMarkers(
    rowsContainer: HTMLElement,
    tasks: GanttTask[],
    labelWidth: number,
    chartLeft: number,
    chartWidth: number,
    barHeight: number,
    rowHeight: number,
    range: number,
    minTime: number,
  ): void {
    const milestoneSettings = this.settings.ganttMilestoneSettings;
    if (!milestoneSettings.show.value) return;

    const shape = resolveDropdown(milestoneSettings.shape) ?? 'diamond';
    const color = milestoneSettings.color.value?.value ?? '#F59E0B';
    const markerSize = barHeight * 0.7;

    tasks.forEach((task, idx) => {
      if (!task.startDate || !task.endDate) return;
      // Zero-duration check: same day or start == end
      const duration = task.endDate.getTime() - task.startDate.getTime();
      if (duration > 86400000) return; // Only for zero-duration (within 1 day)

      const frac = (task.startDate.getTime() - minTime) / range;
      const x = chartLeft + frac * chartWidth;
      const y = idx * rowHeight + barHeight / 2;

      const marker = document.createElement('div');
      marker.className = 'gantt-milestone-marker';
      marker.style.position = 'absolute';
      marker.style.left = `${x - markerSize / 2}px`;
      marker.style.top = `${y - markerSize / 2}px`;
      marker.style.width = `${markerSize}px`;
      marker.style.height = `${markerSize}px`;
      marker.style.backgroundColor = color;
      marker.style.pointerEvents = 'none';
      marker.style.zIndex = '2';

      if (shape === 'diamond') {
        marker.style.transform = 'rotate(45deg)';
      } else if (shape === 'circle') {
        marker.style.borderRadius = '50%';
      } else if (shape === 'triangle') {
        marker.style.backgroundColor = 'transparent';
        marker.style.width = '0';
        marker.style.height = '0';
        marker.style.borderLeft = `${markerSize / 2}px solid transparent`;
        marker.style.borderRight = `${markerSize / 2}px solid transparent`;
        marker.style.borderBottom = `${markerSize}px solid ${color}`;
      }

      rowsContainer.appendChild(marker);
    });
  }

  // -- Critical Path Highlighting ---------------------------------------------

  /**
   * Highlights bars on the critical path by adding a bold border.
   * Simple heuristic: tasks with no slack (start immediately after predecessor ends).
   */
  private applyCriticalPathHighlighting(tasks: GanttTask[]): void {
    const cpSettings = this.settings.ganttCriticalPathSettings;
    if (!cpSettings.show.value) return;

    const color = cpSettings.color.value?.value ?? '#EF4444';
    const lineWidth = cpSettings.lineWidth.value;

    // Simple heuristic: highlight tasks that have dependencies
    const bars = this.container.querySelectorAll('.gantt-bar');
    tasks.forEach((task, idx) => {
      if (task.dependencyId && idx < bars.length) {
        const bar = bars[idx] as HTMLElement;
        bar.style.border = `${lineWidth}px solid ${color}`;
        bar.style.boxSizing = 'border-box';
      }
    });
  }

  // -- Baseline Comparison ----------------------------------------------------

  private renderBaselineBars(
    rowsContainer: HTMLElement,
    tasks: GanttTask[],
    labelWidth: number,
    chartLeft: number,
    chartWidth: number,
    barHeight: number,
    rowHeight: number,
    range: number,
    minTime: number,
  ): void {
    const baselineSettings = this.settings.ganttBaselineSettings;
    if (!baselineSettings.show.value) return;

    const color = baselineSettings.color.value?.value ?? '#94A3B8';
    const opacity = (baselineSettings.opacity.value ?? 40) / 100;

    // Baseline bars are rendered as ghost bars offset slightly below the main bar
    tasks.forEach((task, idx) => {
      if (!task.startDate || !task.endDate) return;

      const startFrac = (task.startDate.getTime() - minTime) / range;
      const endFrac = (task.endDate.getTime() - minTime) / range;
      const barLeft = chartLeft + startFrac * chartWidth;
      const barWidth = Math.max(2, (endFrac - startFrac) * chartWidth);
      const y = idx * rowHeight + barHeight + 2;

      const baselineBar = document.createElement('div');
      baselineBar.className = 'gantt-baseline-bar';
      baselineBar.style.position = 'absolute';
      baselineBar.style.left = `${barLeft}px`;
      baselineBar.style.top = `${y}px`;
      baselineBar.style.width = `${barWidth}px`;
      baselineBar.style.height = `${Math.max(3, barHeight * 0.3)}px`;
      baselineBar.style.backgroundColor = color;
      baselineBar.style.opacity = String(opacity);
      baselineBar.style.borderRadius = '2px';
      baselineBar.style.pointerEvents = 'none';

      rowsContainer.appendChild(baselineBar);
    });
  }

  // -- Conditional Formatting -------------------------------------------------

  private getConditionalColor(value: number): string | undefined {
    const cc = this.settings.conditionalFormattingCard;
    if (!cc.enableConditional.value) return undefined;
    const config = buildConditionalConfig(
      true,
      resolveDropdown(cc.conditionalDirection),
      cc.threshold1.value,
      cc.threshold2.value,
      cc.conditionalColor1.value?.value,
      cc.conditionalColor2.value?.value,
      cc.conditionalColor3.value?.value,
    );
    return resolveConditionalColor(value, config);
  }

  // -- Legend ----------------------------------------------------------------

  private renderLegendFromCategories(catColorMap: Map<string, string>): void {
    const legendFmtCard = this.settings.legendFormattingCard;
    if (!legendFmtCard.showLegend.value) return;
    if (catColorMap.size === 0) return;

    const rawFontColor = legendFmtCard.legendFontColor.value?.value;
    const legendFontColor =
      rawFontColor != null && rawFontColor.length > 0 ? rawFontColor : '#475569';
    const legendFontSize = legendFmtCard.legendFontSize.value;
    const legendPosRaw = legendFmtCard.legendPosition.value;
    const position =
      (typeof legendPosRaw === 'string'
        ? legendPosRaw
        : (legendPosRaw as { value?: string } | undefined)?.value) ?? 'bottom';
    const validPositions = ['top', 'bottom', 'left', 'right'] as const;
    const legendPos: 'top' | 'bottom' | 'left' | 'right' =
      (validPositions as readonly string[]).includes(position)
        ? (position as 'top' | 'bottom' | 'left' | 'right')
        : 'bottom';

    const items: LegendItem[] = [...catColorMap.entries()].map(
      ([label, color]) => ({ label, color }),
    );

    const rawLegendFontFamily =
      resolveDropdown(legendFmtCard.legendFontFamily) || undefined;

    renderLegend(this.container, {
      items,
      position: legendPos,
      fontSize: legendFontSize,
      fontColor: legendFontColor,
      fontFamily: rawLegendFontFamily,
      aliases: legendFmtCard.legendAliases.value,
    });
  }

  // -- Accessibility ----------------------------------------------------------

  private applyAccessibility(tasks: GanttTask[]): void {
    const a11y = this.settings.accessibilityFormattingCard;
    if (a11y.enableKeyboardNav.value) {
      ensureFocusRingStyles();
      const rows = this.container.querySelectorAll<HTMLElement>('.gantt-task-row');
      rows.forEach((row, index) => {
        const task = tasks[index];
        if (!task) return;
        const dateRange = task.startDate && task.endDate
          ? `${formatShortDate(task.startDate, this.getHostLocale())} to ${formatShortDate(task.endDate, this.getHostLocale())}`
          : 'No valid date range';
        applyDataPointAria(
          row,
          task.name,
          `${dateRange}, ${formatPercent(task.progress, { decimals: 0 })} complete`,
          index,
          tasks.length,
        );
      });
      const cleanup = attachKeyboardNav({
        container: this.container,
        itemSelector: '.gantt-task-row[tabindex="0"]',
        onActivate: (el: Element) => {
          (el as HTMLElement).click();
        },
      });
      this.cancelAnimations.push(cleanup);
    }
    applyChartAria(this.container, {
      chartType: 'gantt chart',
      dataPointCount: this.container.querySelectorAll('.gantt-task-row').length,
    });
  }

  public destroy(): void {
    this.hideTooltip();
    this.removeEmptySpaceContextMenu?.();
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];
  }
}
