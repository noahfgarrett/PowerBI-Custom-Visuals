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
  getGlassStyle,
  getHostChartColor,
  DURATION,
  renderChartTitle,
  applyDataLabelFormatting,
  formatPercent,
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
  startDate: Date | null;
  endDate: Date | null;
  progress: number; // 0-100
  category: string;
  selectionId: ISelectionId;
}

// ── Helpers ─────────────────────────────────────────────────────────

function parseDate(raw: unknown): Date | null {
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;
  if (typeof raw === 'string' || typeof raw === 'number') {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function formatShortDate(d: Date, locale?: string): string {
  const resolvedLocale = locale && locale.trim().length > 0 ? locale : undefined;
  return new Intl.DateTimeFormat(resolvedLocale, { month: 'short', day: 'numeric' }).format(d);
}

// ── Visual class ────────────────────────────────────────────────────

export class GanttChartProVisual implements IVisual {
  private host: IVisualHost;
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private container: HTMLElement;
  private settings: GanttChartProSettings;
  private formattingSettingsService: FormattingSettingsService;
  private cancelAnimations: Array<() => void> = [];

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new GanttChartProSettings();
    this.formattingSettingsService = new FormattingSettingsService();
    this.container.classList.add('gantt-container');
  }

  public update(options: VisualUpdateOptions): void {
    // Cancel running animations
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];

    // Parse settings
    const dataView = options.dataViews?.[0];
    if (dataView) {
      this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
        GanttChartProSettings,
        dataView
      );
    }

    // Extract data
    const tasks = this.extractData(dataView);

    this.notifyRenderStarted();
    try {
      this.render(tasks, options.viewport);
      this.notifyRenderFinished();
    } catch (error) {
      this.notifyRenderFailed(error);
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

    if (values) {
      for (const col of values) {
        const role = col.source.roles;
        if (!role) continue;
        if (role['startDate']) startCol = col;
        if (role['endDate']) endCol = col;
        if (role['progress']) progressCol = col;
        if (role['category']) catCol = col;
      }
    }

    for (let i = 0; i < count; i++) {
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
      const selectionId = this.host.createSelectionIdBuilder()
        .withCategory(categories, i)
        .createSelectionId();

      tasks.push({ name, startDate, endDate, progress, category, selectionId });
    }

    // Sort by start date
    tasks.sort((a, b) => {
      if (!a.startDate && !b.startDate) return 0;
      if (!a.startDate) return 1;
      if (!b.startDate) return -1;
      return a.startDate.getTime() - b.startDate.getTime();
    });

    return tasks;
  }

  private render(tasks: GanttTask[], viewport: powerbi.IViewport): void {
    // Clear container
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    renderChartTitle(this.container, this.settings.titleFormattingCard);
    this.container.removeEventListener('click', this.handleBackgroundClick);

    const s = this.settings;
    const barHeight = Math.max(8, s.ganttSettings.barHeight.value);
    const showProgress = s.ganttSettings.showProgress.value;
    const showToday = s.ganttSettings.showToday.value;
    const showLabels = s.ganttSettings.showLabels.value;
    const barColor = s.colorSettings.barColor.value?.value ?? '#3B82F6';
    const progressColor = s.colorSettings.progressColor.value?.value ?? '#10B981';
    const todayColor = s.colorSettings.todayColor.value?.value ?? '#EF4444';
    const animEnabled = s.animationSettings.enabled.value;
    const animDuration = s.animationSettings.duration.value;
    const showDataLabels = s.dataLabelFormattingCard.showDataLabels.value;

    // Apply glass style
    if (s.cardSettings.enableGlass.value) {
      const glass = getGlassStyle({
        mode: 'light',
        opacity: s.cardSettings.backgroundOpacity.value / 100,
        backgroundColor: ((s.cardSettings as any).backgroundColor?.value?.value ?? (s.cardSettings as any).bgColor?.value?.value),
        borderRadius: s.cardSettings.borderRadius.value,
      });
      Object.assign(this.container.style, glass);
    } else {
      this.container.style.background = '';
      this.container.style.backdropFilter = '';
      (this.container.style as unknown as Record<string, string>)['WebkitBackdropFilter'] = '';
      this.container.style.border = '';
      this.container.style.boxShadow = '';
      this.container.style.borderRadius = '';
    }

    // Empty state
    if (tasks.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'gantt-empty';
      empty.textContent = 'Add Task Name, Start Date, and End Date fields';
      this.container.appendChild(empty);
      return;
    }

    // Compute date range
    const validTasks = tasks.filter((t) => t.startDate && t.endDate);
    if (validTasks.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'gantt-empty';
      empty.textContent = 'No valid date ranges found';
      this.container.appendChild(empty);
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
      catColorMap.set(cat, getHostChartColor(this.host.colorPalette, i));
    });

    // Layout
    const labelWidth = showLabels ? this.settings.ganttSettings.labelWidth.value : 0;
    const padding = 8;
    const chartWidth = viewport.width - labelWidth - padding * 2;
    const rowGap = this.settings.ganttSettings.rowGap.value;
    const rowHeight = barHeight + rowGap;

    // Wrapper
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.width = '100%';
    wrapper.style.overflow = 'auto';

    // Header with date ticks
    const header = document.createElement('div');
    header.className = 'gantt-header-row';
    header.style.paddingLeft = `${labelWidth}px`;
    header.style.position = 'relative';
    header.style.width = `${labelWidth + chartWidth}px`;

    const tickCount = Math.min(6, Math.max(2, Math.floor(chartWidth / 80)));
    for (let t = 0; t <= tickCount; t++) {
      const frac = t / tickCount;
      const tickDate = new Date(minTime + frac * range);
      const tick = document.createElement('span');
      tick.className = 'gantt-tick-label';
      tick.style.position = 'absolute';
      tick.style.left = `${labelWidth + frac * chartWidth}px`;
      tick.style.transform = 'translateX(-50%)';
      tick.textContent = formatShortDate(tickDate);
      header.appendChild(tick);
    }
    wrapper.appendChild(header);

    // Task rows
    const rowsContainer = document.createElement('div');
    rowsContainer.style.position = 'relative';
    rowsContainer.style.width = `${labelWidth + chartWidth}px`;

    validTasks.forEach((task, idx) => {
      const row = document.createElement('div');
      row.className = 'gantt-task-row';
      row.style.height = `${rowHeight}px`;
      row.style.cursor = 'pointer';
      row.addEventListener('mouseenter', (event) => this.showTaskTooltip(task, event));
      row.addEventListener('mousemove', (event) => this.moveTooltip(event));
      row.addEventListener('mouseleave', () => this.hideTooltip());
      row.addEventListener('click', (event) => {
        event.stopPropagation();
        void this.selectionManager.select(task.selectionId, event.ctrlKey || event.metaKey);
      });
      row.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        event.stopPropagation();
        void this.selectionManager.showContextMenu(task.selectionId, {
          x: event.clientX,
          y: event.clientY,
        });
      });

      // Label
      if (showLabels) {
        const label = document.createElement('div');
        label.className = 'gantt-task-label';
        label.style.width = `${labelWidth}px`;
        label.textContent = task.name;
        row.appendChild(label);
      }

      // Bar track
      const track = document.createElement('div');
      track.className = 'gantt-bar-track';
      track.style.width = `${chartWidth}px`;
      track.style.height = `${barHeight}px`;

      // Calculate bar position
      const startFrac = (task.startDate!.getTime() - minTime) / range;
      const endFrac = (task.endDate!.getTime() - minTime) / range;
      const barLeft = startFrac * chartWidth;
      const barWidth = Math.max(2, (endFrac - startFrac) * chartWidth);

      const color = task.category && catColorMap.has(task.category)
        ? catColorMap.get(task.category)!
        : barColor;

      // Bar element
      const bar = document.createElement('div');
      bar.className = 'gantt-bar';
      bar.style.left = `${barLeft}px`;
      bar.style.width = `${barWidth}px`;
      bar.style.height = `${barHeight}px`;
      bar.style.backgroundColor = color;
      bar.style.opacity = String(this.settings.ganttSettings.barOpacity.value / 100);
      bar.style.borderRadius = `${s.ganttSettings.barCornerRadius.value}px`;

      track.appendChild(bar);

      // Progress overlay
      if (showProgress && task.progress > 0) {
        const prog = document.createElement('div');
        prog.className = 'gantt-bar-progress';
        prog.style.left = `${barLeft}px`;
        prog.style.width = `${barWidth * (task.progress / 100)}px`;
        prog.style.height = `${barHeight}px`;
        prog.style.backgroundColor = progressColor;
        prog.style.borderRadius = `${s.ganttSettings.barCornerRadius.value}px`;

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
        todayLine.style.left = `${labelWidth + todayFrac * chartWidth}px`;
        todayLine.style.width = `${s.ganttSettings.todayLineWidth.value}px`;

        const todayStyleValue = s.ganttSettings.todayLineStyle.value;
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

    wrapper.appendChild(rowsContainer);
    this.container.appendChild(wrapper);

    // ── Apply data label formatting ──────────────────────────────────
    if (showDataLabels) {
      applyDataLabelFormatting(this.container, s.dataLabelFormattingCard, '.gantt-data-label');
    }

    // ── Apply axis formatting ────────────────────────────────────────
    this.applyAxisCardFormatting(header, rowsContainer, validTasks.length, rowHeight, labelWidth, chartWidth, tickCount);

    this.container.addEventListener('click', this.handleBackgroundClick);
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
    labelWidth: number,
    chartWidth: number,
    tickCount: number,
  ): void {
    const axisCard = this.settings.axisFormattingCard;

    const labelColor = this.resolveColorValue(axisCard.axisLabelColor, '#64748B');
    const labelSize = axisCard.axisLabelSize.value;
    const lineColor = this.resolveColorValue(axisCard.axisLineColor, '#CBD5E1');
    const lineWidth = axisCard.axisLineWidth.value;

    // Style date tick labels
    const tickLabels = this.container.querySelectorAll<HTMLElement>('.gantt-tick-label');
    for (const tick of tickLabels) {
      tick.style.color = labelColor;
      tick.style.fontSize = `${labelSize}px`;
    }

    // Style task labels
    const taskLabels = this.container.querySelectorAll<HTMLElement>('.gantt-task-label');
    for (const label of taskLabels) {
      label.style.color = labelColor;
      label.style.fontSize = `${labelSize}px`;
    }

    // Style header bottom border (axis line)
    header.style.borderBottomColor = lineColor;
    header.style.borderBottomWidth = `${lineWidth}px`;
    header.style.borderBottomStyle = 'solid';

    // Grid lines
    if (axisCard.showGridLines.value) {
      const gridColor = this.resolveColorValue(axisCard.gridLineColor, '#E2E8F0');
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
        gridLine.style.left = `${labelWidth + frac * chartWidth}px`;
        gridLine.style.top = '0';
        gridLine.style.height = `${totalHeight}px`;
        gridLine.style.width = `${lineWidth}px`;
        gridLine.style.backgroundColor = gridStyle === 'solid' ? gridColor : 'transparent';
        gridLine.style.pointerEvents = 'none';
        gridLine.style.opacity = '0.6';
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
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  private showTaskTooltip(task: GanttTask, event: MouseEvent): void {
    const locale = this.getHostLocale();
    const tooltipData: VisualTooltipDataItem[] = [
      { displayName: 'Task', value: task.name },
      {
        displayName: 'Range',
        value: `${formatShortDate(task.startDate!, locale)} - ${formatShortDate(task.endDate!, locale)}`,
      },
      { displayName: 'Progress', value: `${Math.round(task.progress)}%` },
    ];

    this.host.tooltipService.show({
      dataItems: tooltipData,
      identities: [],
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

  private notifyRenderStarted(): void {
    const eventService = (this.host as unknown as {
      eventService?: { renderingStarted?: () => void };
    }).eventService;
    eventService?.renderingStarted?.();
  }

  private notifyRenderFinished(): void {
    const eventService = (this.host as unknown as {
      eventService?: { renderingFinished?: () => void };
    }).eventService;
    eventService?.renderingFinished?.();
  }

  private notifyRenderFailed(error: unknown): void {
    const eventService = (this.host as unknown as {
      eventService?: { renderingFailed?: (reason: string) => void };
    }).eventService;
    const reason = error instanceof Error ? error.message : 'render failure';
    eventService?.renderingFailed?.(reason);
  }

  private handleBackgroundClick = (): void => {
    void this.selectionManager.clear();
  };

  public destroy(): void {
    this.hideTooltip();
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];
  }
}
