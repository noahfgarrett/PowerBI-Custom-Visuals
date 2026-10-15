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
  applyDataPointAria,
  attachKeyboardNav,
  attachEmptySpaceContextMenu,
  ensureFocusRingStyles,
  allowInteractions,
  getHostHighContrastColors,
  applyBasicHighContrastStyles,
  notifyRenderingStarted,
  notifyRenderingFinished,
  notifyRenderingFailed,
  buildConditionalConfig,
  resolveConditionalColor,
  getDateFilterIndices,
  isDateColumn,
  type DateFilterConfig,
  resolveColorTheme,
  getHostChartColor,
  getLocalizedString,
  getVisualEmptyStateMode,
  syncCardStyleVisibility,
  syncDateFilterFormattingVisibility,
  syncTitleFormattingVisibility,
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

// ── Visual ───────────────────────────────────────────────────────────

export class HeatmapCalendarVisual implements IVisual {
  private host: IVisualHost;
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private container: HTMLElement;
  private settings: HeatmapCalendarSettings;
  private formattingSettingsService: FormattingSettingsService;
  private cancelAnimations: Array<() => void> = [];
  private emptyStateMode: 'unconfigured' | 'noData' = 'unconfigured';
  private currentSelectionMap = new Map<string, ISelectionId[]>();
  private currentHighlightedDateKeys = new Set<string>();
  private currentHasHighlights = false;
  private hasRequiredFields = false;
  private removeEmptySpaceContextMenu: (() => void) | null = null;

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new HeatmapCalendarSettings();
    this.formattingSettingsService = new FormattingSettingsService(options.host.createLocalizationManager());
    this.container.classList.add('heatmap-container');
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
      this.cancelAllAnimations();

      const dataView = options.dataViews?.[0];
      this.emptyStateMode = getVisualEmptyStateMode(dataView);
      const metadataColumns = dataView?.metadata?.columns ?? [];
      this.hasRequiredFields = metadataColumns.some((column) => column.roles?.['date'])
        && metadataColumns.some((column) => column.roles?.['measure']);
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

      this.migrateLegacyFormatting(dataView);
      this.syncFormattingVisibility();

      const calendarData = this.extractData(dataView);

      if (calendarData.items.length === 0) {
        this.renderEmpty();
      } else {
        this.render(calendarData.items, calendarData.hasHighlights, options.viewport);
      }

      // Apply card styling after render because rendering clears the container.
      this.applyCardStyle();
      this.applyHighContrastStyles();
      notifyRenderingFinished(this.host, options);
    } catch (error) {
      notifyRenderingFailed(this.host, options, error instanceof Error ? error.message : String(error));
      throw error;
    }
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
      startDate: this.normalizeDateBoundary(this.settings.dateFilterFormattingCard.startDate.value, false),
      endAtCurrentDate: this.settings.dateFilterFormattingCard.endAtCurrentDate.value,
      endDate: this.normalizeDateBoundary(this.settings.dateFilterFormattingCard.endDate.value, true),
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
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (typeof raw === 'number') {
      const d = new Date(raw);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  private normalizeDateBoundary(value: string, endOfDay: boolean): string {
    const trimmed = value.trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
      ? `${trimmed}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`
      : value;
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
  }

  // ── Empty State ────────────────────────────────────────────────

  private renderEmpty(): void {
    this.clearContainer();
    this.currentSelectionMap.clear();
    this.currentHighlightedDateKeys.clear();
    this.currentHasHighlights = false;
    const el = document.createElement('div');
    el.className = 'heatmap-empty';
    el.textContent = this.hasRequiredFields && this.emptyStateMode === 'noData'
      ? getLocalizedString(this.host, 'HeatmapCalendar_NoDataState', 'No data for the current selection.')
      : getLocalizedString(this.host, 'HeatmapCalendar_EmptyState', 'Add a Date and Measure to get started.');
    this.container.appendChild(el);
    applyChartAria(this.container, {
      chartType: 'heatmap calendar',
      dataPointCount: 0,
    });
  }

  // ── Main Render ────────────────────────────────────────────────

  private render(
    data: CalendarDatum[],
    hasHighlights: boolean,
    viewport: powerbi.IViewport,
  ): void {
    this.clearContainer();
    this.container.style.paddingRight = '';
    this.container.style.padding = '';
    this.container.style.position = '';
    renderChartTitle(this.container, this.settings.titleFormattingCard);
    this.container.removeEventListener('click', this.handleBackgroundClick);

    const s = this.settings;
    const highContrast = getHostHighContrastColors(this.host);
    const enableScrolling = s.calendarLayoutSettings.enableScrolling.value;
    const contentPadding = Math.max(0, s.cardSettings.contentPadding.value);
    const chartPadding = Math.max(0, s.calendarLayoutSettings.chartPadding.value);
    this.container.style.padding = `${contentPadding}px`;
    this.container.style.overflowX = enableScrolling ? 'auto' : 'hidden';
    this.container.style.overflowY = 'auto';

    const showLegend = s.legendSettings.showLegend.value;
    const legendPosition = resolveDropdown(s.legendSettings.legendPosition) ?? 'bottom';
    const legendBarThickness = Math.max(8, s.legendSettings.barThickness.value);
    const configuredLegendLength = Math.max(40, s.legendSettings.legendLength.value);
    const legendPadding = Math.max(0, s.legendSettings.legendPadding.value);
    const legendLabelGap = Math.max(0, s.legendSettings.labelGap.value);
    const legendAvailableLength = legendPosition === 'right'
      ? viewport.height - contentPadding * 2 - legendPadding * 2
      : viewport.width - contentPadding * 2 - legendPadding * 2;
    const legendLength = Math.max(40, Math.min(configuredLegendLength, legendAvailableLength));

    const requestedShowDayLabels = s.calendarLayoutSettings.showDayLabels.value;
    const showDayLabels = requestedShowDayLabels && (enableScrolling || viewport.width >= 240);
    const requestedCellSize = Math.max(2, s.calendarLayoutSettings.cellSize.value);
    const requestedCellGap = Math.max(0, s.calendarLayoutSettings.cellGap.value);
    const rightLegendReserve = showLegend && legendPosition === 'right'
      ? legendBarThickness + legendLabelGap + 48 + legendPadding * 2
      : 0;
    const dayLabelReserve = showDayLabels ? 32 : 0;
    const availableGridWidth = Math.max(
      1,
      viewport.width
        - contentPadding * 2
        - chartPadding * 2
        - rightLegendReserve
        - dayLabelReserve
        - 4,
    );
    const maximumWeekColumns = 54;
    let cellGap = requestedCellGap;
    let cellSize = requestedCellSize;
    if (!enableScrolling) {
      const maximumFittingGap = Math.max(
        0,
        Math.floor((availableGridWidth - maximumWeekColumns * 2) / (maximumWeekColumns - 1)),
      );
      cellGap = Math.min(requestedCellGap, maximumFittingGap);
      const fittingCellSize = Math.floor(
        (availableGridWidth - (maximumWeekColumns - 1) * cellGap) / maximumWeekColumns,
      );
      cellSize = Math.max(2, Math.min(requestedCellSize, fittingCellSize));
    }
    const showMonthLabels = s.calendarLayoutSettings.showMonthLabels.value
      && (enableScrolling || cellSize >= 5);

    const themeName = resolveColorTheme(s.colorThemeFormattingCard);
    const lowColor = highContrast.enabled
      ? highContrast.background
      : themeName !== 'default'
      ? getHostChartColor(this.host.colorPalette, 0, themeName)
      : (s.colorScaleSettings.lowColor.value?.value ?? '#E2E8F0');
    const highColor = highContrast.enabled
      ? highContrast.foregroundSelected
      : themeName !== 'default'
      ? getHostChartColor(this.host.colorPalette, 1, themeName)
      : (s.colorScaleSettings.highColor.value?.value ?? '#3B82F6');
    const showMidColor = s.colorScaleSettings.showMidColor.value;
    const midColor = highContrast.enabled
      ? highContrast.foreground
      : themeName !== 'default'
      ? getHostChartColor(this.host.colorPalette, 2, themeName)
      : (s.colorScaleSettings.midColor.value?.value ?? '#FBBF24');
    const midPointPct = Math.max(0, Math.min(100, s.colorScaleSettings.midPoint.value));
    const emptyColor = highContrast.enabled
      ? highContrast.background
      : (s.colorScaleSettings.emptyColor.value?.value ?? '#F1F5F9');
    const cellStrokeColor = highContrast.enabled
      ? highContrast.foreground
      : (s.cellStyleSettings.cellStrokeColor.value?.value || '');
    const cellStrokeWidth = s.cellStyleSettings.cellStrokeWidth.value;
    const cellCornerRadius = s.cellStyleSettings.cellCornerRadius.value;
    const labelColor = highContrast.enabled
      ? highContrast.foreground
      : (s._legacyCalendarSettings.labelColor.value?.value || '');
    const animEnabled = s.animationSettings.enabled.value;
    const animDuration = s.animationSettings.duration.value;
    const showDataLabels = s.dataLabelFormattingCard.showDataLabels.value && cellSize >= 10;

    // Granularity & scale settings (now from merged cards)
    const granularity = resolveDropdown(s.calendarLayoutSettings.granularity) ?? 'day';
    const colorMode = resolveDropdown(s.colorScaleSettings.colorMode) ?? 'continuous';
    const discreteBins = Math.max(2, s.colorScaleSettings.bins.value);
    const weekStart = resolveDropdown(s.calendarLayoutSettings.weekStart) ?? 'monday';

    // Build one aggregate per displayed period, preserving every contributing
    // identity so weekly/monthly cells still select the complete period.
    const dateMap = new Map<string, number>();
    const selectionMap = new Map<string, ISelectionId[]>();
    const anchorDateMap = new Map<string, string>();
    const highlightedDateKeys = new Set<string>();

    for (const d of data) {
      const key = this.periodKey(d.date, granularity, weekStart);
      dateMap.set(key, (dateMap.get(key) ?? 0) + d.value);
      const selections = selectionMap.get(key) ?? [];
      if (!selections.some((selectionId) => selectionId.getKey() === d.selectionId.getKey())) {
        selections.push(d.selectionId);
      }
      selectionMap.set(key, selections);
      const dateKey = this.dateKey(d.date);
      const currentAnchor = anchorDateMap.get(key);
      if (!currentAnchor || dateKey < currentAnchor) anchorDateMap.set(key, dateKey);
      if (d.highlighted) highlightedDateKeys.add(key);
    }

    this.currentSelectionMap = selectionMap;
    this.currentHighlightedDateKeys = highlightedDateKeys;
    this.currentHasHighlights = hasHighlights;

    let minVal = Math.min(...dateMap.values());
    let maxVal = Math.max(...dateMap.values());
    if (!Number.isFinite(minVal) || !Number.isFinite(maxVal)) {
      minVal = 0;
      maxVal = 1;
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
    const interpolateColor = highContrast.enabled
      ? (): string => highContrast.foregroundSelected
      : this.buildColorInterpolator(lowColor, highColor, showMidColor, midColor, midPointPct);

    const dataCells: HTMLElement[] = [];

    for (const year of sortedYears) {
      // Year label
      const yearLabel = document.createElement('div');
      yearLabel.className = 'heatmap-year-label';
      yearLabel.textContent = String(year);
      this.container.appendChild(yearLabel);

      const gridWrapper = document.createElement('div');
      gridWrapper.className = 'heatmap-grid-wrapper';
      gridWrapper.style.padding = `${chartPadding}px`;
      if (enableScrolling) {
        gridWrapper.style.flexShrink = '0';
        gridWrapper.style.width = 'fit-content';
      }

      // Day-of-week labels
      if (showDayLabels) {
        const dayCol = document.createElement('div');
        dayCol.className = 'heatmap-day-labels';
        const dayLabels = this.getDayLabels(weekStart);
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
            monthLabel.textContent = new Intl.DateTimeFormat(this.getHostLocale(), { month: 'short' })
              .format(new Date(year, weekMonth, 1));
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
            const currentDateKey = this.dateKey(currentDate);
            const key = this.periodKey(currentDate, granularity, weekStart);
            const isPeriodAnchor = anchorDateMap.get(key) === currentDateKey;
            const val = isPeriodAnchor ? dateMap.get(key) : undefined;

            if (val !== undefined) {
              const t = maxVal !== minVal ? (val - minVal) / (maxVal - minVal) : 0.5;
              const conditionalColor = highContrast.enabled ? undefined : this.getConditionalColor(val);
              const baseColor = colorMode === 'discrete'
                ? this.discretizeColor(t, discreteBins, interpolateColor)
                : interpolateColor(t);
              cell.style.backgroundColor = conditionalColor ?? baseColor;
              cell.dataset.dateKey = key;
              const selectionIds = selectionMap.get(key) ?? [];
              // Tooltip via tooltipService
              const tooltipPeriod = this.formatPeriod(key, granularity);
              const tooltipValStr = formatWithSettings(val, this.settings.numberFormattingCard);
              const tooltipHost = this.host;
              cell.addEventListener('mouseover', (event: MouseEvent) => {
                const tooltipItems: VisualTooltipDataItem[] = [
                  { displayName: tooltipPeriod.displayName, value: tooltipPeriod.value },
                  { displayName: 'Value', value: tooltipValStr },
                ];
                tooltipHost.tooltipService.show({
                  dataItems: tooltipItems,
                  identities: selectionIds,
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
                if (highContrast.enabled) labelSpan.style.color = highContrast.background;
                cell.appendChild(labelSpan);
              }
              if (selectionIds.length > 0) {
                cell.style.cursor = allowInteractions(this.host) ? 'pointer' : 'default';
                cell.addEventListener('click', (event) => {
                  event.stopPropagation();
                  if (!allowInteractions(this.host)) return;
                  void this.selectionManager.select(selectionIds, event.ctrlKey || event.metaKey).then(() => {
                    this.applySelectionHighlight();
                  });
                });
                cell.addEventListener('contextmenu', (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (!allowInteractions(this.host)) return;
                  void this.selectionManager.showContextMenu(selectionIds[0], {
                    x: event.clientX,
                    y: event.clientY,
                  });
                });
              }
              if (this.settings.accessibilityFormattingCard.enableKeyboardNav.value) {
                applyDataPointAria(
                  cell,
                  tooltipPeriod.value,
                  tooltipValStr,
                  dataCells.length,
                  dateMap.size,
                );
              }
              dataCells.push(cell);
            } else {
              cell.style.backgroundColor = emptyColor;
              cell.style.cursor = 'default';
            }
          } else {
            cell.style.backgroundColor = 'transparent';
            cell.style.cursor = 'default';
          }

          weekCol.appendChild(cell);

          currentDate = this.addDays(currentDate, 1);
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
        minVal, maxVal, legendPosition, legendBarThickness, legendLength, legendPadding, legendLabelGap, chartPadding,
      );
    }

    // Animation
    if (animEnabled && dataCells.length > 0 && !hasHighlights) {
      // Use rippleFill with 7 columns (days per week) — but our grid is week-based columns
      // We'll use a simple stagger based on column index
      const cols = Math.ceil(dataCells.length / 7);
      const cancel = rippleFill(dataCells, cols > 0 ? cols : 1, animDuration, 15, 'top-left');
      this.cancelAnimations.push(cancel);
    }
    // ── Streak Highlighting ────────────────────────────────────────
    if (granularity === 'day' && s.calendarStreakSettings.show.value) {
      this.applyStreakHighlighting(dateMap);
    }

    this.applyAxisLabelFormatting();
    applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.heatmap-data-label');
    if (highContrast.enabled) {
      this.container.querySelectorAll<HTMLElement>('.heatmap-data-label').forEach((label) => {
        label.style.color = highContrast.background;
      });
    }
    if (labelColor) {
      const labelSelectors = '.heatmap-day-labels, .heatmap-month-label, .heatmap-year-label';
      const labelElements = this.container.querySelectorAll(labelSelectors);
      for (const el of labelElements) {
        if (el instanceof HTMLElement) {
          el.style.color = labelColor;
        }
      }
    }

    this.applySelectionHighlight();
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

  private periodKey(date: Date, granularity: string, weekStart: string): string {
    if (granularity === 'month') {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
    }
    if (granularity === 'week') {
      const dayOfWeek = date.getDay();
      const offset = weekStart === 'sunday'
        ? dayOfWeek
        : (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
      return this.dateKey(this.addDays(date, -offset));
    }
    return this.dateKey(date);
  }

  private addDays(date: Date, days: number): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  }

  private dateFromKey(key: string): Date {
    const [year, month, day] = key.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private getHostLocale(): string | undefined {
    const locale = (this.host as unknown as { locale?: unknown }).locale;
    return typeof locale === 'string' && locale.length > 0 ? locale : undefined;
  }

  private getDayLabels(weekStart: string): string[] {
    const sunday = new Date(2024, 0, 7);
    const firstDayOffset = weekStart === 'sunday' ? 0 : 1;
    const formatter = new Intl.DateTimeFormat(this.getHostLocale(), { weekday: 'short' });
    return Array.from({ length: 7 }, (_, index) => {
      if (index % 2 !== 0) return '';
      return formatter.format(this.addDays(sunday, firstDayOffset + index));
    });
  }

  private formatDateStr(d: Date): string {
    return d.toLocaleDateString(this.getHostLocale(), { month: 'short', day: 'numeric', year: 'numeric' });
  }

  private formatPeriod(key: string, granularity: string): { displayName: string; value: string } {
    const date = this.dateFromKey(key);
    if (granularity === 'week') {
      return { displayName: 'Week', value: `Week of ${this.formatDateStr(date)}` };
    }
    if (granularity === 'month') {
      return {
        displayName: 'Month',
        value: date.toLocaleDateString(this.getHostLocale(), { month: 'long', year: 'numeric' }),
      };
    }
    return { displayName: 'Date', value: this.formatDateStr(date) };
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
    barThickness: number,
    legendLength: number,
    legendPadding: number,
    labelGap: number,
    chartPadding: number,
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
      legendContainer.style.marginLeft = `${legendPadding}px`;
      legendContainer.style.position = 'absolute';
      legendContainer.style.right = `${legendPadding}px`;
      legendContainer.style.top = `${legendPadding}px`;
      legendContainer.style.bottom = `${legendPadding}px`;
    } else {
      legendContainer.style.display = 'flex';
      legendContainer.style.flexDirection = 'column';
      legendContainer.style.alignItems = 'center';
      legendContainer.style.marginTop = `${legendPadding}px`;
      legendContainer.style.width = '100%';
    }

    // Gradient bar
    const gradientBar = document.createElement('div');
    gradientBar.className = 'heatmap-legend-bar';
    gradientBar.style.background = gradientStops;
    gradientBar.style.borderRadius = '3px';

    if (isVertical) {
      gradientBar.style.width = `${barThickness}px`;
      gradientBar.style.height = `${legendLength}px`;
      gradientBar.style.minHeight = `${legendLength}px`;
    } else {
      gradientBar.style.width = `${legendLength}px`;
      gradientBar.style.height = `${barThickness}px`;
    }

    // Labels container
    const labelsContainer = document.createElement('div');
    labelsContainer.className = 'heatmap-legend-labels';

    const legendLabelColor = this.settings.legendSettings.legendLabelColor.value?.value
      || this.settings.axisFormattingCard.axisLabelColor.value?.value
      || '#64748B';
    const legendLabelSize = `${this.settings.legendSettings.legendLabelFontSize.value}px`;
    const legendLabelFontFamily = resolveDropdown(this.settings.legendSettings.legendLabelFontFamily)
      || resolveDropdown(this.settings.calendarLayoutSettings.labelFontFamily);
    const legendLabelFontWeight = resolveDropdown(this.settings.legendSettings.legendLabelFontWeight)
      || resolveDropdown(this.settings.calendarLayoutSettings.labelFontWeight)
      || 'normal';

    if (isVertical) {
      labelsContainer.style.display = 'flex';
      labelsContainer.style.flexDirection = 'column';
      labelsContainer.style.justifyContent = useMid ? 'space-between' : 'space-between';
      labelsContainer.style.marginLeft = `${labelGap}px`;
      labelsContainer.style.fontSize = legendLabelSize;
      labelsContainer.style.color = legendLabelColor;
    } else {
      labelsContainer.style.display = 'flex';
      labelsContainer.style.justifyContent = 'space-between';
      labelsContainer.style.width = `${legendLength}px`;
      labelsContainer.style.marginTop = `${labelGap}px`;
      labelsContainer.style.fontSize = legendLabelSize;
      labelsContainer.style.color = legendLabelColor;
    }
    if (legendLabelFontFamily) labelsContainer.style.fontFamily = legendLabelFontFamily;
    labelsContainer.style.fontWeight = legendLabelFontWeight;

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
      this.container.style.paddingRight = `${chartPadding + barThickness + labelGap + 28 + legendPadding * 2}px`;
    }
  }

  // ── Formatting Model ───────────────────────────────────────────

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    this.syncFormattingVisibility();
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  private migrateLegacyFormatting(dataView: DataView | undefined): void {
    const objects = dataView?.metadata?.objects;
    const legacy = objects?.['calendarSettings'] as Record<string, unknown> | undefined;
    if (!legacy) return;

    const cellStyle = objects?.['cellStyleSettings'] as Record<string, unknown> | undefined;
    const axis = objects?.['axisFormatting'] as Record<string, unknown> | undefined;
    const migrateCellNumber = (name: 'cellStrokeWidth' | 'cellCornerRadius'): void => {
      const value = legacy[name];
      if (!(cellStyle && Object.prototype.hasOwnProperty.call(cellStyle, name)) && typeof value === 'number') {
        this.settings.cellStyleSettings[name].value = value;
      }
    };

    const strokeColor = this.readFormattingColor(legacy['cellStrokeColor']);
    if (!(cellStyle && Object.prototype.hasOwnProperty.call(cellStyle, 'cellStrokeColor')) && strokeColor) {
      this.settings.cellStyleSettings.cellStrokeColor.value = { value: strokeColor };
    }
    migrateCellNumber('cellStrokeWidth');
    migrateCellNumber('cellCornerRadius');

    const labelColor = this.readFormattingColor(legacy['labelColor']);
    if (!(axis && Object.prototype.hasOwnProperty.call(axis, 'axisLabelColor')) && labelColor) {
      this.settings.axisFormattingCard.axisLabelColor.value = { value: labelColor };
    }
  }

  private readFormattingColor(value: unknown): string | undefined {
    if (typeof value === 'string') return value;
    if (!value || typeof value !== 'object') return undefined;
    const candidate = value as { solid?: { color?: unknown }; value?: unknown };
    if (typeof candidate.solid?.color === 'string') return candidate.solid.color;
    return typeof candidate.value === 'string' ? candidate.value : undefined;
  }

  private syncFormattingVisibility(): void {
    const s = this.settings;
    syncTitleFormattingVisibility(s.titleFormattingCard);
    syncDateFilterFormattingVisibility(s.dateFilterFormattingCard);
    syncCardStyleVisibility(s.cardSettings);
    s.cardSettings.borderRadius.visible = resolveDropdown(s.cardSettings.cardStyleMode) !== 'none';
    s.animationSettings.duration.visible = s.animationSettings.enabled.value;

    s._legacyCalendarSettings.labelColor.visible = false;
    s.axisFormattingCard.showXAxis.visible = false;
    s.axisFormattingCard.showYAxis.visible = false;
    s.axisFormattingCard.xAxisTitle.visible = false;
    s.axisFormattingCard.yAxisTitle.visible = false;
    s.axisFormattingCard.axisLabelFontFamily.visible = false;
    s.axisFormattingCard.axisLabelRotation.visible = false;
    s.axisFormattingCard.yAxisMin.visible = false;
    s.axisFormattingCard.yAxisMax.visible = false;
    s.axisFormattingCard.axisLineColor.visible = false;
    s.axisFormattingCard.axisLineWidth.visible = false;
    s.axisFormattingCard.showGridLines.visible = false;
    s.axisFormattingCard.gridLineColor.visible = false;
    s.axisFormattingCard.gridLineStyle.visible = false;
    s.axisFormattingCard.gridLineWidth.visible = false;
    s.axisFormattingCard.gridLineOpacity.visible = false;
    s.axisFormattingCard.axisLabelFontWeight.visible = false;
    s.axisFormattingCard.integerTicks.visible = false;

    const showDataLabels = s.dataLabelFormattingCard.showDataLabels.value;
    s.dataLabelFormattingCard.dataLabelFontSize.visible = showDataLabels;
    s.dataLabelFormattingCard.dataLabelFontColor.visible = showDataLabels;
    s.dataLabelFormattingCard.dataLabelFontWeight.visible = showDataLabels;
    s.dataLabelFormattingCard.dataLabelFontFamily.visible = showDataLabels;
    s.dataLabelFormattingCard.dataLabelPosition.visible = false;

    const themeIsDefault = (resolveDropdown(s.colorThemeFormattingCard.colorTheme) ?? 'default') === 'default';
    const showMidColor = s.colorScaleSettings.showMidColor.value;
    s.colorScaleSettings.lowColor.visible = themeIsDefault;
    s.colorScaleSettings.highColor.visible = themeIsDefault;
    s.colorScaleSettings.midColor.visible = themeIsDefault && showMidColor;
    s.colorScaleSettings.midPoint.visible = showMidColor;
    s.colorScaleSettings.bins.visible = resolveDropdown(s.colorScaleSettings.colorMode) === 'discrete';
    s.cellStyleSettings.cellStrokeWidth.visible = Boolean(s.cellStyleSettings.cellStrokeColor.value?.value);

    const dailyGranularity = resolveDropdown(s.calendarLayoutSettings.granularity) === 'day';
    s.calendarStreakSettings.visible = dailyGranularity;
    const showStreaks = dailyGranularity && s.calendarStreakSettings.show.value;
    s.calendarStreakSettings.threshold.visible = showStreaks;
    s.calendarStreakSettings.streakOutlineColor.visible = showStreaks;

    const showLegend = s.legendSettings.showLegend.value;
    s.legendSettings.legendPosition.visible = showLegend;
    s.legendSettings.barThickness.visible = showLegend;
    s.legendSettings.legendLength.visible = showLegend;
    s.legendSettings.legendPadding.visible = showLegend;
    s.legendSettings.labelGap.visible = showLegend;
    s.legendSettings.legendLabelColor.visible = showLegend;
    s.legendSettings.legendLabelFontSize.visible = showLegend;
    s.legendSettings.legendLabelFontFamily.visible = showLegend;
    s.legendSettings.legendLabelFontWeight.visible = showLegend;

    const conditionalEnabled = s.conditionalFormattingCard.enableConditional.value;
    s.conditionalFormattingCard.conditionalDirection.visible = conditionalEnabled;
    s.conditionalFormattingCard.threshold1.visible = conditionalEnabled;
    s.conditionalFormattingCard.threshold2.visible = conditionalEnabled;
    s.conditionalFormattingCard.conditionalColor1.visible = conditionalEnabled;
    s.conditionalFormattingCard.conditionalColor2.visible = conditionalEnabled;
    s.conditionalFormattingCard.conditionalColor3.visible = conditionalEnabled;
  }

  private applySelectionHighlight(): void {
    const selectedIds = this.selectionManager.getSelectionIds() as ISelectionId[];
    const selectedKeys = new Set(selectedIds.map((selectionId) => selectionId.getKey()));
    const shouldDim = selectedKeys.size > 0 || this.currentHasHighlights;
    const cells = this.container.querySelectorAll<HTMLElement>('.heatmap-cell[data-date-key]');

    for (const cell of cells) {
      const key = cell.dataset.dateKey;
      const periodSelectionIds = key ? this.currentSelectionMap.get(key) ?? [] : [];
      const selected = periodSelectionIds.some((selectionId) => selectedKeys.has(selectionId.getKey()));
      const highlighted = Boolean(key && this.currentHighlightedDateKeys.has(key));
      cell.style.opacity = shouldDim && !selected && !highlighted ? '0.3' : '';
    }
  }

  private applyHighContrastStyles(): void {
    const colors = getHostHighContrastColors(this.host);
    applyBasicHighContrastStyles(this.container, colors, {
      textSelectors: [
        '.heatmap-empty',
        '.heatmap-year-label',
        '.heatmap-month-label',
        '.heatmap-day-labels',
        '.heatmap-legend-labels',
        '.chart-title',
        '.chart-subtitle',
      ],
      lineSelectors: [],
      strokeSelectors: ['.heatmap-cell', '.heatmap-legend-bar'],
    });
    if (!colors.enabled) {
      this.applyCardStyle();
      return;
    }

    this.container.querySelectorAll<HTMLElement>('.heatmap-cell').forEach((cell) => {
      cell.style.backgroundColor = cell.dataset.dateKey
        ? colors.foregroundSelected
        : colors.background;
      cell.style.borderColor = colors.foreground;
      cell.style.color = cell.dataset.dateKey ? colors.background : colors.foreground;
    });
    this.container.querySelectorAll<HTMLElement>('.heatmap-data-label').forEach((label) => {
      label.style.color = colors.background;
    });
    this.container.querySelectorAll<HTMLElement>('.heatmap-legend-bar').forEach((bar) => {
      bar.style.background = colors.foregroundSelected;
      bar.style.border = `1px solid ${colors.foreground}`;
    });
  }

  private handleBackgroundClick = (): void => {
    if (!allowInteractions(this.host)) return;
    void this.selectionManager.clear().then(() => {
      this.applySelectionHighlight();
    });
  };

  // ── Utilities ──────────────────────────────────────────────────

  private clearContainer(): void {
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.host.tooltipService.hide({ immediately: true, isTouchEvent: false });
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
        const diff = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
          - Date.UTC(prevDate.getFullYear(), prevDate.getMonth(), prevDate.getDate());
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
        itemSelector: '.heatmap-cell[data-date-key][tabindex="0"]',
        onActivate: (el: Element) => {
          (el as HTMLElement).click();
        },
      });
      this.cancelAnimations.push(kbCleanup);
    }
    applyChartAria(this.container, {
      chartType: 'heatmap calendar',
      dataPointCount: this.container.querySelectorAll('.heatmap-cell[data-date-key]').length,
    });
  }

  public destroy(): void {
    this.removeEmptySpaceContextMenu?.();
    this.removeEmptySpaceContextMenu = null;
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.cancelAllAnimations();
    this.clearContainer();
  }
}
