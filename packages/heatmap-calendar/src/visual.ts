/**
 * Heatmap Calendar — Power BI IVisual implementation.
 * GitHub-style calendar heatmap with rippleFill wave animation.
 */

import powerbi from 'powerbi-visuals-api';
import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel';
import { HeatmapCalendarSettings } from './settings';
import {
  rippleFill,
  fadeSlideIn,
  DURATION,
  formatNumber,
  formatWithSettings,
  applyCardStyle,
  type CardStyleMode,
  renderChartTitle,
  applyDataLabelFormatting,
  resolveDropdown,
  applyChartAria,
  attachKeyboardNav,
  ensureFocusRingStyles,
  buildConditionalConfig,
  resolveConditionalColor,
  getDateFilterIndices,
  isDateColumn,
  type DateFilterConfig,
  resolveColorTheme,
  getHostChartColor,
} from '../../core/src';

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataView = powerbi.DataView;
import ISelectionId = powerbi.visuals.ISelectionId;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

import '../style/visual.less';

// ── Types ────────────────────────────────────────────────────────────

interface CalendarDatum {
  date: Date;
  value: number;
  highlighted: boolean;
  selectionId: ISelectionId;
}

/** Whether cross-highlight data is present from another visual/slicer. */
interface CalendarData {
  items: CalendarDatum[];
  hasHighlights: boolean;
}

// ── Constants ────────────────────────────────────────────────────────

const DAY_LABELS_MONDAY = ['Mon', '', 'Wed', '', 'Fri', '', ''];
const DAY_LABELS_SUNDAY = ['Sun', '', 'Tue', '', 'Thu', '', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ── Visual ───────────────────────────────────────────────────────────

export class HeatmapCalendarVisual implements IVisual {
  private host: IVisualHost;
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private container: HTMLElement;
  private settings: HeatmapCalendarSettings;
  private formattingSettingsService: FormattingSettingsService;
  private cancelAnimations: Array<() => void> = [];

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new HeatmapCalendarSettings();
    this.formattingSettingsService = new FormattingSettingsService();
    this.container.classList.add('heatmap-container');
  }

  public update(options: VisualUpdateOptions): void {
    this.cancelAllAnimations();

    const dataView = options.dataViews?.[0];
    if (dataView) {
      this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
        HeatmapCalendarSettings,
        dataView,
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

    // Hide inapplicable shared axis properties — heatmap-calendar only uses axisLabelColor and axisLabelSize

    // Date filter: hide start/end when disabled
    this.settings.dateFilterFormattingCard.startDate.visible = this.settings.dateFilterFormattingCard.enableDateFilter.value;
    this.settings.dateFilterFormattingCard.endAtCurrentDate.visible = this.settings.dateFilterFormattingCard.enableDateFilter.value;
    this.settings.dateFilterFormattingCard.endDate.visible = this.settings.dateFilterFormattingCard.enableDateFilter.value && !this.settings.dateFilterFormattingCard.endAtCurrentDate.value;
    this.settings.axisFormattingCard.showXAxis.visible = false;
    this.settings.axisFormattingCard.showYAxis.visible = false;
    this.settings.axisFormattingCard.xAxisTitle.visible = false;
    this.settings.axisFormattingCard.yAxisTitle.visible = false;
    this.settings.axisFormattingCard.axisLabelFontFamily.visible = false;
    this.settings.axisFormattingCard.axisLabelRotation.visible = false;
    this.settings.axisFormattingCard.yAxisMin.visible = false;
    this.settings.axisFormattingCard.yAxisMax.visible = false;
    this.settings.axisFormattingCard.axisLineColor.visible = false;
    this.settings.axisFormattingCard.axisLineWidth.visible = false;
    this.settings.axisFormattingCard.showGridLines.visible = false;
    this.settings.axisFormattingCard.gridLineColor.visible = false;
    this.settings.axisFormattingCard.gridLineStyle.visible = false;
    this.settings.axisFormattingCard.gridLineWidth.visible = false;
    this.settings.axisFormattingCard.gridLineOpacity.visible = false;
    this.settings.axisFormattingCard.axisLabelFontWeight.visible = false;

    // Hide legacy labelColor — axisFormattingCard.axisLabelColor is the single source of truth
    this.settings._legacyCalendarSettings.labelColor.visible = false;

    // Conditional visibility: hide child settings when parent toggle is off
    const colorMode = (this.settings.colorScaleSettings.colorMode.value as unknown as { value?: string })?.value ?? 'continuous';
    this.settings.colorScaleSettings.midColor.visible = this.settings.colorScaleSettings.showMidColor.value;
    this.settings.colorScaleSettings.midPoint.visible = this.settings.colorScaleSettings.showMidColor.value;
    this.settings.colorScaleSettings.bins.visible = colorMode !== 'continuous';
    this.settings.calendarStreakSettings.threshold.visible = this.settings.calendarStreakSettings.show.value;
    this.settings.calendarStreakSettings.streakOutlineColor.visible = this.settings.calendarStreakSettings.show.value;
    this.settings.legendSettings.legendPosition.visible = this.settings.legendSettings.showLegend.value;

    const calendarData = this.extractData(dataView);

    if (calendarData.items.length === 0) {
      this.renderEmpty();
    } else {
      this.render(calendarData.items, calendarData.hasHighlights);
    }

    // Apply card styling AFTER render — render clears the container, which would destroy the glass backdrop div.
    this.applyCardStyle();
  }

  // ── Data Extraction ──────────────────────────────────────────────

  private extractData(dataView: DataView | undefined): CalendarData {
    if (!dataView?.categorical) return { items: [], hasHighlights: false };

    const categorical = dataView.categorical;
    const categoryColumn = categorical.categories?.[0];
    const valuesColumn = categorical.values?.[0];

    if (!categoryColumn || !valuesColumn) return { items: [], hasHighlights: false };

    const result: CalendarDatum[] = [];

    // Read cross-highlight data from the values column
    const valueHighlights = valuesColumn.highlights as unknown[] | undefined;

    const dateConfig: DateFilterConfig = {
      enabled: this.settings.dateFilterFormattingCard.enableDateFilter.value,
      startDate: this.settings.dateFilterFormattingCard.startDate.value,
      endAtCurrentDate: this.settings.dateFilterFormattingCard.endAtCurrentDate.value,
      endDate: this.settings.dateFilterFormattingCard.endDate.value,
    };
    const dateIndices = isDateColumn(categoryColumn.source) ? getDateFilterIndices(categoryColumn.values, dateConfig) : null;

    let hasHighlights = false;

    for (let i = 0; i < categoryColumn.values.length; i++) {
      if (dateIndices && !dateIndices.has(i)) continue;

      const rawDate = categoryColumn.values[i];
      const rawVal = valuesColumn.values[i];

      const date = this.parseDate(rawDate);
      if (!date) continue;

      const value = typeof rawVal === 'number' && Number.isFinite(rawVal) ? rawVal : 0;
      const highlighted = valueHighlights ? valueHighlights[i] !== null : false;
      if (highlighted) hasHighlights = true;

      const selectionId = this.host.createSelectionIdBuilder()
        .withCategory(categoryColumn, i)
        .createSelectionId();
      result.push({ date, value, highlighted, selectionId });
    }

    return { items: result, hasHighlights };
  }

  private parseDate(raw: unknown): Date | null {
    if (raw instanceof Date) {
      return Number.isNaN(raw.getTime()) ? null : raw;
    }
    if (typeof raw === 'string' || typeof raw === 'number') {
      const d = new Date(raw);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  // ── Card Style ─────────────────────────────────────────────────

  private applyCardStyle(): void {
    const s = this.settings.cardSettings;
    const mode = (resolveDropdown(s.cardStyleMode) ?? 'glass') as CardStyleMode;
    applyCardStyle(
      this.container,
      {
        mode,
        opacity: s.backgroundOpacity.value / 100,
        backgroundColor: s.backgroundColor.value?.value,
        borderRadius: s.borderRadius.value,
      },
    );
    if (mode === 'none') {
      this.container.style.borderRadius = `${s.borderRadius.value}px`;
    }
  }

  // ── Empty State ────────────────────────────────────────────────

  private renderEmpty(): void {
    this.clearContainer();
    const el = document.createElement('div');
    el.className = 'heatmap-empty';
    el.textContent = 'Add a Date and Measure to get started.';
    this.container.appendChild(el);
  }

  // ── Main Render ────────────────────────────────────────────────

  private render(data: CalendarDatum[], hasHighlights?: boolean): void {
    this.clearContainer();
    renderChartTitle(this.container, this.settings.titleFormattingCard);
    this.container.removeEventListener('click', this.handleBackgroundClick);

    const s = this.settings;
    const cellSize = Math.max(4, s.calendarLayoutSettings.cellSize.value);
    const cellGap = Math.max(0, s.calendarLayoutSettings.cellGap.value);
    const showMonthLabels = s.calendarLayoutSettings.showMonthLabels.value;
    const showDayLabels = s.calendarLayoutSettings.showDayLabels.value;
    const enableScrolling = s.calendarLayoutSettings.enableScrolling.value;
    const themeName = resolveColorTheme(s.colorThemeFormattingCard);
    const lowColor = themeName !== 'default'
      ? getHostChartColor(this.host.colorPalette, 0, themeName)
      : (s.colorScaleSettings.lowColor.value?.value ?? '#E2E8F0');
    const highColor = themeName !== 'default'
      ? getHostChartColor(this.host.colorPalette, 1, themeName)
      : (s.colorScaleSettings.highColor.value?.value ?? '#3B82F6');
    const showMidColor = s.colorScaleSettings.showMidColor.value;
    const midColor = themeName !== 'default'
      ? getHostChartColor(this.host.colorPalette, 2, themeName)
      : (s.colorScaleSettings.midColor.value?.value ?? '#FBBF24');
    const midPointPct = Math.max(0, Math.min(100, s.colorScaleSettings.midPoint.value));
    const emptyColor = s.colorScaleSettings.emptyColor.value?.value ?? '#F1F5F9';
    const showLegend = s.legendSettings.showLegend.value;
    const legendPosition = resolveDropdown(s.legendSettings.legendPosition) ?? 'bottom';
    const cellStrokeColor = s.cellStyleSettings.cellStrokeColor.value?.value || '';
    const cellStrokeWidth = s.cellStyleSettings.cellStrokeWidth.value;
    const cellCornerRadius = s.cellStyleSettings.cellCornerRadius.value;
    const labelColor = s._legacyCalendarSettings.labelColor.value?.value || '';
    const animEnabled = s.animationSettings.enabled.value;
    const animDuration = s.animationSettings.duration.value;
    const showDataLabels = s.dataLabelFormattingCard.showDataLabels.value;

    // Granularity & scale settings (now from merged cards)
    const granularity = resolveDropdown(s.calendarLayoutSettings.granularity) ?? 'day';
    const colorMode = resolveDropdown(s.colorScaleSettings.colorMode) ?? 'continuous';
    const discreteBins = Math.max(2, s.colorScaleSettings.bins.value);
    const weekStart = resolveDropdown(s.calendarLayoutSettings.weekStart) ?? 'monday';

    // Build date→value map and highlight lookup
    const dateMap = new Map<string, number>();
    const selectionMap = new Map<string, ISelectionId>();
    const highlightedDateKeys = new Set<string>();
    let minVal = Infinity;
    let maxVal = -Infinity;

    for (const d of data) {
      const key = this.dateKey(d.date);
      const existing = dateMap.get(key);
      const val = existing !== undefined ? existing + d.value : d.value;
      dateMap.set(key, val);
      if (!selectionMap.has(key)) {
        selectionMap.set(key, d.selectionId);
      }
      if (d.highlighted) highlightedDateKeys.add(key);
      if (val < minVal) minVal = val;
      if (val > maxVal) maxVal = val;
    }

    // Aggregate by granularity (weekly or monthly)
    if (granularity === 'week') {
      const weekMap = new Map<string, number>();
      for (const [key, val] of dateMap) {
        const [y, m, d] = key.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        // Get the start of the week
        const dow = date.getDay();
        const offset = weekStart === 'sunday' ? dow : (dow === 0 ? 6 : dow - 1);
        const weekStartDate = new Date(date.getTime() - offset * 86400000);
        const wKey = this.dateKey(weekStartDate);
        weekMap.set(wKey, (weekMap.get(wKey) ?? 0) + val);
      }
      dateMap.clear();
      minVal = Infinity;
      maxVal = -Infinity;
      for (const [key, val] of weekMap) {
        dateMap.set(key, val);
        if (val < minVal) minVal = val;
        if (val > maxVal) maxVal = val;
      }
    } else if (granularity === 'month') {
      const monthMap = new Map<string, number>();
      for (const [key, val] of dateMap) {
        const [y, m] = key.split('-').map(Number);
        const mKey = `${y}-${String(m).padStart(2, '0')}-01`;
        monthMap.set(mKey, (monthMap.get(mKey) ?? 0) + val);
      }
      dateMap.clear();
      minVal = Infinity;
      maxVal = -Infinity;
      for (const [key, val] of monthMap) {
        dateMap.set(key, val);
        if (val < minVal) minVal = val;
        if (val > maxVal) maxVal = val;
      }
    }

    if (minVal === maxVal) {
      minVal = 0;
      if (maxVal === 0) maxVal = 1;
    }

    // Find year range
    const years = new Set<number>();
    for (const d of data) {
      years.add(d.date.getFullYear());
    }
    const sortedYears = Array.from(years).sort((a, b) => a - b);

    // Build multi-stop color interpolation function
    const interpolateColor = this.buildColorInterpolator(
      lowColor, highColor, showMidColor, midColor, midPointPct,
    );

    const allCells: HTMLElement[] = [];

    for (const year of sortedYears) {
      // Year label
      const yearLabel = document.createElement('div');
      yearLabel.className = 'heatmap-year-label';
      yearLabel.textContent = String(year);
      this.container.appendChild(yearLabel);

      const gridWrapper = document.createElement('div');
      gridWrapper.className = 'heatmap-grid-wrapper';
      if (enableScrolling) {
        gridWrapper.style.flexShrink = '0';
        gridWrapper.style.width = 'fit-content';
      }

      // Day-of-week labels
      if (showDayLabels) {
        const dayCol = document.createElement('div');
        dayCol.className = 'heatmap-day-labels';
        const dayLabels = weekStart === 'sunday' ? DAY_LABELS_SUNDAY : DAY_LABELS_MONDAY;
        for (const label of dayLabels) {
          const dayEl = document.createElement('div');
          dayEl.style.height = `${cellSize}px`;
          dayEl.style.lineHeight = `${cellSize}px`;
          dayEl.style.marginBottom = `${cellGap}px`;
          dayEl.textContent = label;
          dayCol.appendChild(dayEl);
        }
        gridWrapper.appendChild(dayCol);
      }

      // Build week columns
      const weeksContainer = document.createElement('div');
      weeksContainer.style.display = 'flex';
      weeksContainer.style.gap = `${cellGap}px`;
      weeksContainer.style.position = 'relative';
      if (enableScrolling) {
        weeksContainer.style.flexShrink = '0';
        weeksContainer.style.width = 'fit-content';
      }

      // Month labels row
      const monthLabelRow = showMonthLabels ? document.createElement('div') : null;
      if (monthLabelRow) {
        monthLabelRow.style.display = 'flex';
        monthLabelRow.style.gap = `${cellGap}px`;
        monthLabelRow.style.marginBottom = '2px';
        if (enableScrolling) {
          monthLabelRow.style.flexShrink = '0';
        }
      }

      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31);

      // Move start to the configured week-start day containing Jan 1
      const startDay = startDate.getDay();
      const weekStartDay = weekStart === 'sunday' ? 0 : 1;
      let dayOffset: number;
      if (weekStartDay === 1) {
        // Monday start
        dayOffset = startDay === 0 ? -6 : 1 - startDay;
      } else {
        // Sunday start
        dayOffset = -startDay;
      }
      const gridStart = new Date(year, 0, 1 + dayOffset);

      let currentDate = new Date(gridStart);
      let lastMonthLabel = -1;

      while (currentDate <= endDate || currentDate.getDay() !== weekStartDay) {
        // Build one week column (7 cells)
        const weekCol = document.createElement('div');
        weekCol.style.display = 'flex';
        weekCol.style.flexDirection = 'column';
        weekCol.style.gap = `${cellGap}px`;
        if (enableScrolling) {
          weekCol.style.flexShrink = '0';
        }

        // Month label for this week
        if (monthLabelRow) {
          const monthLabel = document.createElement('div');
          monthLabel.className = 'heatmap-month-label';
          monthLabel.style.width = `${cellSize}px`;
          monthLabel.style.textAlign = 'center';

          const weekMonth = currentDate.getMonth();
          if (currentDate.getFullYear() === year && weekMonth !== lastMonthLabel && currentDate.getDate() <= 7) {
            monthLabel.textContent = MONTH_NAMES[weekMonth];
            lastMonthLabel = weekMonth;
          }
          monthLabelRow.appendChild(monthLabel);
        }

        for (let dow = 0; dow < 7; dow++) {
          const cell = document.createElement('div');
          cell.className = 'heatmap-cell';
          if (enableScrolling) {
            cell.style.flexShrink = '0';
          }
          cell.style.width = `${cellSize}px`;
          cell.style.height = `${cellSize}px`;
          if (cellCornerRadius > 0) {
            cell.style.borderRadius = `${cellCornerRadius}px`;
          }
          if (cellStrokeColor) {
            cell.style.border = `${cellStrokeWidth}px solid ${cellStrokeColor}`;
          }

          if (currentDate.getFullYear() === year) {
            let key: string;
            if (granularity === 'week') {
              const dow = currentDate.getDay();
              const offset = weekStart === 'sunday' ? dow : (dow === 0 ? 6 : dow - 1);
              const weekStartDate = new Date(currentDate.getTime() - offset * 86400000);
              key = this.dateKey(weekStartDate);
            } else if (granularity === 'month') {
              key = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-01`;
            } else {
              key = this.dateKey(currentDate);
            }
            const val = dateMap.get(key);

            if (val !== undefined) {
              const t = maxVal !== minVal ? (val - minVal) / (maxVal - minVal) : 0.5;
              const conditionalColor = this.getConditionalColor(val);
              const baseColor = colorMode === 'discrete'
                ? this.discretizeColor(t, discreteBins, interpolateColor)
                : interpolateColor(t);
              cell.style.backgroundColor = conditionalColor ?? baseColor;
              cell.dataset.dateKey = key;
              // Tooltip via tooltipService
              const tooltipDateStr = this.formatDateStr(currentDate);
              const tooltipValStr = formatWithSettings(val, this.settings.numberFormattingCard);
              const tooltipHost = this.host;
              cell.addEventListener('mouseover', (event: MouseEvent) => {
                const tooltipItems: VisualTooltipDataItem[] = [
                  { displayName: 'Date', value: tooltipDateStr },
                  { displayName: 'Value', value: tooltipValStr },
                ];
                tooltipHost.tooltipService.show({
                  dataItems: tooltipItems,
                  identities: [],
                  coordinates: [event.clientX, event.clientY],
                  isTouchEvent: false,
                });
              });
              cell.addEventListener('mousemove', (event: MouseEvent) => {
                tooltipHost.tooltipService.move({
                  dataItems: [],
                  identities: [],
                  coordinates: [event.clientX, event.clientY],
                  isTouchEvent: false,
                });
              });
              cell.addEventListener('mouseout', () => {
                tooltipHost.tooltipService.hide({ immediately: true, isTouchEvent: false });
              });
              if (showDataLabels) {
                const labelSpan = document.createElement('span');
                labelSpan.className = 'heatmap-data-label';
                labelSpan.textContent = formatWithSettings(val, this.settings.numberFormattingCard);
                cell.appendChild(labelSpan);
              }
              const selectionId = selectionMap.get(key);
              if (selectionId) {
                cell.style.cursor = 'pointer';
                cell.addEventListener('click', (event) => {
                  event.stopPropagation();
                  void this.selectionManager.select(selectionId, event.ctrlKey || event.metaKey);
                });
                cell.addEventListener('contextmenu', (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void this.selectionManager.showContextMenu(selectionId, {
                    x: event.clientX,
                    y: event.clientY,
                  });
                });
              }
            } else {
              cell.style.backgroundColor = emptyColor;
            }
          } else {
            cell.style.backgroundColor = 'transparent';
          }

          weekCol.appendChild(cell);
          allCells.push(cell);

          currentDate = new Date(currentDate.getTime() + 86400000);
        }

        weeksContainer.appendChild(weekCol);

        // Break if we've passed the year
        if (currentDate.getFullYear() > year && currentDate.getDay() === weekStartDay) break;
      }

      // Wrap month labels + weeks in a vertical column inside gridWrapper
      // so they align with (and are offset by) the day-of-week labels
      const weeksCol = document.createElement('div');
      weeksCol.style.display = 'flex';
      weeksCol.style.flexDirection = 'column';
      if (monthLabelRow) {
        weeksCol.appendChild(monthLabelRow);
      }
      weeksCol.appendChild(weeksContainer);
      gridWrapper.appendChild(weeksCol);
      this.container.appendChild(gridWrapper);
    }

    // Color legend
    if (showLegend) {
      this.renderColorLegend(
        lowColor, highColor, showMidColor, midColor, midPointPct,
        minVal, maxVal, legendPosition,
      );
    }

    // Animation
    if (animEnabled && allCells.length > 0) {
      // Use rippleFill with 7 columns (days per week) — but our grid is week-based columns
      // We'll use a simple stagger based on column index
      const cols = Math.ceil(allCells.length / 7);
      const cancel = rippleFill(allCells, cols > 0 ? cols : 1, animDuration, 15, 'top-left');
      this.cancelAnimations.push(cancel);
    }
    // ── Streak Highlighting ────────────────────────────────────────
    if (s.calendarStreakSettings.show.value) {
      this.applyStreakHighlighting(dateMap, selectionMap);
    }

    this.applyAxisLabelFormatting();
    applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.heatmap-data-label');
    if (labelColor) {
      const labelSelectors = '.heatmap-day-labels, .heatmap-month-label, .heatmap-year-label';
      const labelElements = this.container.querySelectorAll(labelSelectors);
      for (const el of labelElements) {
        if (el instanceof HTMLElement) {
          el.style.color = labelColor;
        }
      }
    }

    // Cross-highlight dimming: dim non-highlighted cells
    if (hasHighlights) {
      const cells = this.container.querySelectorAll<HTMLElement>('.heatmap-cell[data-date-key]');
      for (const cell of cells) {
        const key = cell.dataset.dateKey;
        if (key !== undefined && !highlightedDateKeys.has(key)) {
          cell.style.opacity = '0.3';
        }
      }
    }

    this.applyAccessibility();
    this.container.addEventListener('click', this.handleBackgroundClick);
  }

  // ── Axis Label Formatting ─────────────────────────────────────────

  /**
   * Applies axis formatting card settings (label color + font size)
   * to all day-of-week, month, and year label elements.
   * These are HTML elements, not SVG, so we set style.color / style.fontSize directly.
   */
  private applyAxisLabelFormatting(): void {
    const axis = this.settings.axisFormattingCard;
    const rawColor = axis.axisLabelColor.value?.value;
    const color = rawColor && rawColor.length > 0 ? rawColor : '#64748B';
    const size = axis.axisLabelSize.value;
    const labelFontFamily = resolveDropdown(this.settings.calendarLayoutSettings.labelFontFamily);
    const labelFontWeight = resolveDropdown(this.settings.calendarLayoutSettings.labelFontWeight);

    const selectors = '.heatmap-day-labels, .heatmap-month-label, .heatmap-year-label';
    const elements = this.container.querySelectorAll(selectors);
    for (const el of elements) {
      if (el instanceof HTMLElement) {
        el.style.color = color;
        el.style.fontSize = `${size}px`;
        if (labelFontFamily) el.style.fontFamily = labelFontFamily;
        el.style.fontWeight = labelFontWeight || 'normal';
      }
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────

  private dateKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private formatDateStr(d: Date): string {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const clean = hex.replace('#', '');
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
    };
  }

  /**
   * Build a color interpolator that maps t in [0, 1] to an RGB color string.
   * Supports 2-stop (low -> high) and 3-stop (low -> mid -> high) gradients.
   */
  private buildColorInterpolator(
    lowColor: string,
    highColor: string,
    useMid: boolean,
    midColor: string,
    midPointPct: number,
  ): (t: number) => string {
    const lowRgb = this.hexToRgb(lowColor);
    const highRgb = this.hexToRgb(highColor);

    if (!useMid) {
      return (t: number): string => {
        const clamped = Math.max(0, Math.min(1, t));
        const r = Math.round(lowRgb.r + (highRgb.r - lowRgb.r) * clamped);
        const g = Math.round(lowRgb.g + (highRgb.g - lowRgb.g) * clamped);
        const b = Math.round(lowRgb.b + (highRgb.b - lowRgb.b) * clamped);
        return `rgb(${r},${g},${b})`;
      };
    }

    const midRgb = this.hexToRgb(midColor);
    const midT = midPointPct / 100;

    return (t: number): string => {
      const clamped = Math.max(0, Math.min(1, t));
      let fromRgb: { r: number; g: number; b: number };
      let toRgb: { r: number; g: number; b: number };
      let segmentT: number;

      if (clamped <= midT) {
        fromRgb = lowRgb;
        toRgb = midRgb;
        segmentT = midT > 0 ? clamped / midT : 0;
      } else {
        fromRgb = midRgb;
        toRgb = highRgb;
        segmentT = midT < 1 ? (clamped - midT) / (1 - midT) : 1;
      }

      const r = Math.round(fromRgb.r + (toRgb.r - fromRgb.r) * segmentT);
      const g = Math.round(fromRgb.g + (toRgb.g - fromRgb.g) * segmentT);
      const b = Math.round(fromRgb.b + (toRgb.b - fromRgb.b) * segmentT);
      return `rgb(${r},${g},${b})`;
    };
  }

  // ── Color Legend ──────────────────────────────────────────────────

  /**
   * Renders a gradient color legend showing the color scale and value range.
   */
  private renderColorLegend(
    lowColor: string,
    highColor: string,
    useMid: boolean,
    midColor: string,
    midPointPct: number,
    minVal: number,
    maxVal: number,
    position: string,
  ): void {
    const isVertical = position === 'right';

    // Build CSS gradient string
    let gradientStops: string;
    if (useMid) {
      const direction = isVertical ? 'to top' : 'to right';
      gradientStops = `linear-gradient(${direction}, ${lowColor} 0%, ${midColor} ${midPointPct}%, ${highColor} 100%)`;
    } else {
      const direction = isVertical ? 'to top' : 'to right';
      gradientStops = `linear-gradient(${direction}, ${lowColor}, ${highColor})`;
    }

    // Container
    const legendContainer = document.createElement('div');
    legendContainer.className = 'heatmap-legend';

    if (isVertical) {
      legendContainer.style.display = 'flex';
      legendContainer.style.flexDirection = 'row';
      legendContainer.style.alignItems = 'stretch';
      legendContainer.style.marginLeft = '12px';
      legendContainer.style.position = 'absolute';
      legendContainer.style.right = '8px';
      legendContainer.style.top = '0';
      legendContainer.style.bottom = '0';
    } else {
      legendContainer.style.display = 'flex';
      legendContainer.style.flexDirection = 'column';
      legendContainer.style.alignItems = 'center';
      legendContainer.style.marginTop = '8px';
      legendContainer.style.width = '100%';
    }

    // Gradient bar
    const gradientBar = document.createElement('div');
    gradientBar.className = 'heatmap-legend-bar';
    gradientBar.style.background = gradientStops;
    gradientBar.style.borderRadius = '3px';

    if (isVertical) {
      gradientBar.style.width = '12px';
      gradientBar.style.height = '100%';
      gradientBar.style.minHeight = '60px';
    } else {
      gradientBar.style.width = '200px';
      gradientBar.style.height = '12px';
    }

    // Labels container
    const labelsContainer = document.createElement('div');
    labelsContainer.className = 'heatmap-legend-labels';

    const legendLabelColor = this.settings.axisFormattingCard.axisLabelColor.value?.value || '#64748B';
    const legendLabelSize = `${this.settings.axisFormattingCard.axisLabelSize.value}px`;

    if (isVertical) {
      labelsContainer.style.display = 'flex';
      labelsContainer.style.flexDirection = 'column';
      labelsContainer.style.justifyContent = useMid ? 'space-between' : 'space-between';
      labelsContainer.style.marginLeft = '4px';
      labelsContainer.style.fontSize = legendLabelSize;
      labelsContainer.style.color = legendLabelColor;
    } else {
      labelsContainer.style.display = 'flex';
      labelsContainer.style.justifyContent = 'space-between';
      labelsContainer.style.width = '200px';
      labelsContainer.style.marginTop = '2px';
      labelsContainer.style.fontSize = legendLabelSize;
      labelsContainer.style.color = legendLabelColor;
    }

    // Create label elements
    const minLabel = document.createElement('span');
    minLabel.textContent = formatWithSettings(minVal, this.settings.numberFormattingCard);

    const maxLabel = document.createElement('span');
    maxLabel.textContent = formatWithSettings(maxVal, this.settings.numberFormattingCard);

    if (isVertical) {
      // Vertical: top = max, bottom = min
      labelsContainer.appendChild(maxLabel);
      if (useMid) {
        const midLabel = document.createElement('span');
        const midVal = minVal + (maxVal - minVal) * (midPointPct / 100);
        midLabel.textContent = formatWithSettings(midVal, this.settings.numberFormattingCard);
        labelsContainer.appendChild(midLabel);
      }
      labelsContainer.appendChild(minLabel);
    } else {
      // Horizontal: left = min, right = max
      labelsContainer.appendChild(minLabel);
      if (useMid) {
        const midLabel = document.createElement('span');
        const midVal = minVal + (maxVal - minVal) * (midPointPct / 100);
        midLabel.textContent = formatWithSettings(midVal, this.settings.numberFormattingCard);
        labelsContainer.appendChild(midLabel);
      }
      labelsContainer.appendChild(maxLabel);
    }

    if (isVertical) {
      legendContainer.appendChild(gradientBar);
      legendContainer.appendChild(labelsContainer);
    } else {
      legendContainer.appendChild(gradientBar);
      legendContainer.appendChild(labelsContainer);
    }

    // Insert based on position
    if (position === 'top') {
      // Insert after the title (if present) but before the grid
      const firstGrid = this.container.querySelector('.heatmap-year-label');
      if (firstGrid) {
        this.container.insertBefore(legendContainer, firstGrid);
      } else {
        this.container.appendChild(legendContainer);
      }
    } else {
      // 'bottom' or 'right' — append at end
      this.container.appendChild(legendContainer);
    }

    // For 'right' position, set the container to relative so legend can position absolutely
    if (isVertical) {
      this.container.style.position = 'relative';
      this.container.style.paddingRight = '40px';
    }
  }

  // ── Formatting Model ───────────────────────────────────────────

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    const s = this.settings;
    const cardMode = (resolveDropdown(s.cardSettings.cardStyleMode) ?? 'glass') as CardStyleMode;
    s.cardSettings.backgroundOpacity.visible = cardMode !== 'none';
    s.cardSettings.backgroundColor.visible = cardMode !== 'none';
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  private handleBackgroundClick = (): void => {
    void this.selectionManager.clear();
  };

  // ── Utilities ──────────────────────────────────────────────────

  private clearContainer(): void {
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
  }

  private cancelAllAnimations(): void {
    for (const cancel of this.cancelAnimations) {
      cancel();
    }
    this.cancelAnimations = [];
  }

  // -- Streak Highlighting -----------------------------------------------------

  /**
   * Identifies runs of consecutive days where the value meets or exceeds the
   * streak threshold (minimum 2 consecutive days) and applies a visual outline
   * to those cells.
   */
  private applyStreakHighlighting(
    dateMap: Map<string, number>,
    _selectionMap: Map<string, ISelectionId>,
  ): void {
    const streakSettings = this.settings.calendarStreakSettings;
    if (!streakSettings.show.value) return;

    const threshold = streakSettings.threshold.value;
    const ONE_DAY_MS = 86400000;

    // 1. Sort all date keys chronologically
    const sortedKeys = Array.from(dateMap.keys()).sort();

    // 2. Find runs of consecutive days where value >= threshold
    const streakDateKeys = new Set<string>();
    let currentRun: string[] = [];

    const flushRun = (): void => {
      if (currentRun.length >= 2) {
        for (const k of currentRun) {
          streakDateKeys.add(k);
        }
      }
      currentRun = [];
    };

    let prevDate: Date | null = null;

    for (const key of sortedKeys) {
      const val = dateMap.get(key);
      if (val === undefined || val < threshold) {
        flushRun();
        prevDate = null;
        continue;
      }

      const [y, m, d] = key.split('-').map(Number);
      const date = new Date(y, m - 1, d);

      if (prevDate !== null) {
        const diff = date.getTime() - prevDate.getTime();
        if (diff === ONE_DAY_MS) {
          // Consecutive day — extend the run
          currentRun.push(key);
        } else {
          // Gap — flush and start new run
          flushRun();
          currentRun.push(key);
        }
      } else {
        currentRun.push(key);
      }

      prevDate = date;
    }
    flushRun();

    // 3. Nothing to highlight
    if (streakDateKeys.size === 0) return;

    // 4. Apply outline styling to cells whose data-date-key is in the streak set
    const cells = this.container.querySelectorAll<HTMLElement>('.heatmap-cell[data-date-key]');
    for (const cell of cells) {
      const key = cell.dataset.dateKey;
      if (key !== undefined && streakDateKeys.has(key)) {
        const streakColor = this.settings.calendarStreakSettings.streakOutlineColor.value?.value ?? '#F59E0B';
        cell.style.outline = `2px solid ${streakColor}`;
        cell.style.outlineOffset = '-1px';
        cell.style.zIndex = '1';
      }
    }
  }

  // -- Discrete Color Bins ----------------------------------------------------

  private discretizeColor(
    t: number,
    bins: number,
    interpolateColor: (t: number) => string,
  ): string {
    if (bins <= 1) return interpolateColor(t);
    const binIndex = Math.min(bins - 1, Math.floor(t * bins));
    const binT = binIndex / (bins - 1);
    return interpolateColor(binT);
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

  // -- Accessibility ----------------------------------------------------------

  private applyAccessibility(): void {
    const a11y = this.settings.accessibilityFormattingCard;
    if (a11y.enableKeyboardNav.value) {
      ensureFocusRingStyles();
      const kbCleanup = attachKeyboardNav({
        container: this.container,
        itemSelector: '.heatmap-cell',
        onActivate: (el: Element) => {
          (el as HTMLElement).click();
        },
      });
      this.cancelAnimations.push(kbCleanup);
    }
    applyChartAria(this.container, {
      chartType: 'heatmap calendar',
      dataPointCount: this.container.querySelectorAll('.heatmap-cell').length,
    });
  }

  public destroy(): void {
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.cancelAllAnimations();
    this.clearContainer();
  }
}
