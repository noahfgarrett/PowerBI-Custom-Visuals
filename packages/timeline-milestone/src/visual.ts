/**
 * Timeline Milestone — Power BI IVisual implementation.
 * Horizontal or vertical timeline spine with milestone markers,
 * alternating up/down labels, and animated entrance.
 */

import powerbi from 'powerbi-visuals-api';
import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel';
import { TimelineMilestoneSettings } from './settings';
import * as d3 from 'd3';
import {
  popIn,
  fadeSlideIn,
  applyCardStyle,
  type CardStyleMode,
  getHostChartColor,
  DURATION,
  renderChartTitle,
  applyDataLabelFormatting,
  applyChartAria,
  applyDataPointAria,
  ensureFocusRingStyles,
  resolveColorTheme,
  resolveDropdown,
  buildConditionalConfig,
  resolveConditionalColor,
  attachKeyboardNav,
  attachEmptySpaceContextMenu,
  allowInteractions,
  notifyRenderingStarted,
  notifyRenderingFinished,
  notifyRenderingFailed,
  renderLegend,
  type LegendItem,
  getDateFilterIndices,
  isDateColumn,
  type DateFilterConfig,
  syncCardStyleVisibility,
  syncDateFilterFormattingVisibility,
  syncLegendFormattingVisibility,
  syncTitleFormattingVisibility,
  focusHighlightedData,
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

interface Milestone {
  date: Date | null;
  dateStr: string;
  label: string;
  category: string;
  selectionId: ISelectionId;
  highlighted: boolean;
}

interface TimelineData {
  milestones: Milestone[];
  hasHighlights: boolean;
}

// ── Date formatting helpers ─────────────────────────────────────────

function formatDate(date: Date | null, format: string, locale?: string): string {
  if (!date || isNaN(date.getTime())) return '';
  const resolvedLocale = locale && locale.trim().length > 0 ? locale : undefined;
  if (format === 'short') {
    return new Intl.DateTimeFormat(resolvedLocale, { month: 'numeric', day: 'numeric' }).format(date);
  }
  if (format === 'long') {
    return new Intl.DateTimeFormat(resolvedLocale, { month: 'long', day: 'numeric', year: 'numeric' }).format(date);
  }
  return new Intl.DateTimeFormat(resolvedLocale, { month: 'short', day: 'numeric' }).format(date);
}

function parseTimelineDate(raw: unknown): Date | null {
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;
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
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof raw === 'number') {
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function normalizeDateFilterBoundary(value: string, endOfDay: boolean): string {
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? `${trimmed}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`
    : value;
}

// ── Visual class ────────────────────────────────────────────────────

export class TimelineMilestoneVisual implements IVisual {
  private host: IVisualHost;
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private container: HTMLElement;
  private settings: TimelineMilestoneSettings;
  private formattingSettingsService: FormattingSettingsService;
  private cancelAnimations: Array<() => void> = [];
  private emptyStateMode: 'unconfigured' | 'noData' = 'unconfigured';
  private currentTimelineData: TimelineData | null = null;
  private currentVisibleMilestones: Milestone[] = [];
  private hasCategoryRole = false;
  private hasDateRole = false;
  private removeEmptySpaceContextMenu: (() => void) | null = null;

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new TimelineMilestoneSettings();
    this.formattingSettingsService = new FormattingSettingsService(options.host.createLocalizationManager());
    this.container.classList.add('timeline-container');
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
    // Cancel running animations
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];

    // Parse settings
    const dataView = options.dataViews?.[0];
    this.emptyStateMode = getVisualEmptyStateMode(dataView);
    if (dataView) {
      this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
        TimelineMilestoneSettings,
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
    this.hasCategoryRole = Boolean(dataView?.categorical?.categories?.some((column) => column.source.roles?.['category']));
    this.hasDateRole = Boolean(dataView?.categorical?.categories?.some((column) => column.source.roles?.['date']));
    this.syncFormattingVisibility();

    // Extract data
    const extractedData = this.extractData(dataView);
    const timelineData: TimelineData = {
      milestones: focusHighlightedData(extractedData.milestones, extractedData.hasHighlights),
      hasHighlights: extractedData.hasHighlights,
    };
    this.currentTimelineData = timelineData;
    this.syncFormattingVisibility();

    this.render(timelineData.milestones, options.viewport);
    notifyRenderingFinished(this.host, options);
    } catch (error) {
      notifyRenderingFailed(this.host, options, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private extractData(dataView: DataView | undefined): TimelineData {
    const emptyResult: TimelineData = { milestones: [], hasHighlights: false };
    if (!dataView?.categorical) return emptyResult;

    const result: Milestone[] = [];

    const categorical = dataView.categorical;
    const allCategories = categorical.categories;
    if (!allCategories || allCategories.length === 0) return emptyResult;

    // Find date, label, and category columns from categories
    let dateCol: powerbi.DataViewCategoryColumn | undefined;
    let labelCol: powerbi.DataViewCategoryColumn | undefined;
    let catCol: powerbi.DataViewCategoryColumn | undefined;

    for (const col of allCategories) {
      const role = col.source.roles;
      if (!role) continue;
      if (role['date']) dateCol = col;
      if (role['label']) labelCol = col;
      if (role['category']) catCol = col;
    }

    const categories = dateCol ?? allCategories[0];
    const count = categories.values.length;

    // Cross-highlight detection: check value columns for highlights
    const valuesGroup = categorical.values;
    const highlightedIndices = new Set<number>();
    let hasHighlights = false;
    if (valuesGroup) {
      for (const col of valuesGroup) {
        const hlRaw = col.highlights as unknown[] | undefined;
        if (hlRaw) {
          hlRaw.forEach((h, i) => {
            if (h !== null && h !== undefined) {
              highlightedIndices.add(i);
              hasHighlights = true;
            }
          });
        }
      }
    }

    const dateConfig: DateFilterConfig = {
      enabled: this.settings.dateFilterFormattingCard.enableDateFilter.value,
      startDate: normalizeDateFilterBoundary(this.settings.dateFilterFormattingCard.startDate.value, false),
      endAtCurrentDate: this.settings.dateFilterFormattingCard.endAtCurrentDate.value,
      endDate: normalizeDateFilterBoundary(this.settings.dateFilterFormattingCard.endDate.value, true),
    };
    const dateIndices = isDateColumn(categories.source) ? getDateFilterIndices(categories.values, dateConfig) : null;

    for (let i = 0; i < count; i++) {
      if (dateIndices && !dateIndices.has(i)) continue;

      const rawDate = categories.values[i];
      let date: Date | null = null;
      let dateStr = '';

      date = parseTimelineDate(rawDate);
      dateStr = rawDate instanceof Date ? rawDate.toISOString() : String(rawDate ?? '');

      // A timeline cannot position an invalid date meaningfully; leave it out
      // instead of stacking it at an arbitrary end position.
      if (!date) continue;

      const label = labelCol && i < labelCol.values.length
        ? String(labelCol.values[i] ?? '')
        : dateStr;
      const category = catCol && i < catCol.values.length
        ? String(catCol.values[i] ?? '')
        : '';
      const selectionId = this.host.createSelectionIdBuilder()
        .withCategory(categories, i)
        .createSelectionId();

      const highlighted = hasHighlights ? highlightedIndices.has(i) : false;

      result.push({ date, dateStr, label, category, selectionId, highlighted });
    }

    // Sort by date
    result.sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date.getTime() - b.date.getTime();
    });

    // Cluster nearby events if enabled
    const clusterNearby = this.settings.timelineMarkerSettings.clusterNearby.value;
    const clusterDays = this.settings.timelineMarkerSettings.clusterThresholdDays.value;
    if (clusterNearby && clusterDays > 0 && result.length > 1) {
      const msThreshold = clusterDays * 24 * 60 * 60 * 1000;
      const clustered: Milestone[] = [];
      let i = 0;
      while (i < result.length) {
        const group: Milestone[] = [result[i]];
        let j = i + 1;
        while (j < result.length && result[i].date && result[j].date &&
               (result[j].date!.getTime() - result[i].date!.getTime()) <= msThreshold) {
          group.push(result[j]);
          j++;
        }
        if (group.length > 1) {
          // Merge into a cluster milestone: combine labels, keep earliest date
          const labels = group.map((m) => m.label).join(', ');
          const clusterHighlighted = group.some((m) => m.highlighted);
          clustered.push({
            date: group[0].date,
            dateStr: group[0].dateStr,
            label: `[${group.length}] ${labels}`,
            category: group[0].category,
            selectionId: group[0].selectionId,
            highlighted: clusterHighlighted,
          });
        } else {
          clustered.push(group[0]);
        }
        i = j;
      }
      return { milestones: clustered, hasHighlights };
    }

    return { milestones: result, hasHighlights };
  }

  private render(milestones: Milestone[], viewport: powerbi.IViewport): void {
    const themeName = resolveColorTheme(this.settings.colorThemeFormattingCard);
    this.currentVisibleMilestones = [];
    this.hideTooltip();

    // Clear container
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    renderChartTitle(this.container, this.settings.titleFormattingCard);
    this.container.removeEventListener('click', this.handleBackgroundClick);

    const s = this.settings;
    const contentPadding = Math.max(0, s.cardSettings.contentPadding.value);
    this.container.style.padding = `${contentPadding}px`;
    const orientation = String(s.timelineSettings.orientation.value?.value ?? 'horizontal');
    const showDates = s.timelineSettings.showDates.value;
    const dateFormatVal = String(s.timelineSettings.dateFormat.value?.value ?? 'medium');
    const markerShape = String(s.markerSettings.shape.value?.value ?? 'circle');
    const markerSize = Math.max(4, s.markerSettings.size.value);
    const colorByCat = s.markerSettings.colorByCategory.value;
    const animEnabled = s.animationSettings.enabled.value;
    const animDuration = s.animationSettings.duration.value;
    const timelineLineWidth = s.spineAndConnectorsSettings.lineWidth.value;
    const markerStrokeColorValue = s.markerSettings.markerStrokeColor.value?.value;
    const markerStrokeWidth = Math.max(0, s.markerSettings.markerStrokeWidth.value);
    const configuredMarkerStroke = markerStrokeColorValue && markerStrokeColorValue.length > 0
      ? markerStrokeColorValue
      : '#fff';
    const lineColorValue = s.spineAndConnectorsSettings.lineColor.value?.value;
    const labelColorValue = s.spineAndConnectorsSettings.labelColor.value?.value;
    const isHorizontal = orientation === 'horizontal';

    // Layout setting: alternating, top, bottom, staggered
    const layoutModeRaw = s.timelineSettings.layout.value;
    const layoutMode: string = (typeof layoutModeRaw === 'string'
      ? layoutModeRaw
      : (layoutModeRaw as { value?: string } | undefined)?.value) ?? 'alternating';

    const showSwimlanes = s.spineAndConnectorsSettings.showSwimlanes.value;
    const showDurationBars = s.spineAndConnectorsSettings.showDurationBars.value;
    const showConnectors = s.spineAndConnectorsSettings.showConnectors.value;

    const locale = this.getHostLocale();
    const highContrast = this.getHighContrastColors();
    const markerStroke = highContrast.enabled ? highContrast.background : configuredMarkerStroke;
    const connectorColor = highContrast.enabled
      ? highContrast.foreground
      : (lineColorValue && lineColorValue.length > 0 ? lineColorValue : '#CBD5E1');
    const spineWidth = timelineLineWidth;
    const primaryTextColor = highContrast.enabled
      ? highContrast.foreground
      : (labelColorValue && labelColorValue.length > 0 ? labelColorValue : '#1E293B');
    const secondaryTextColor = highContrast.enabled
      ? highContrast.foreground
      : (labelColorValue && labelColorValue.length > 0 ? labelColorValue : '#64748B');
    const labelFontSize = `${Math.max(6, s.axisFormattingCard.axisLabelSize.value)}px`;
    const showGridLines = s.axisFormattingCard.showGridLines.value;
    const gridLineColor = highContrast.enabled
      ? highContrast.foreground
      : (s.axisFormattingCard.gridLineColor.value?.value || '#E2E8F0');
    const gridLineStyleValue = s.axisFormattingCard.gridLineStyle.value;
    const gridLineStyle = typeof gridLineStyleValue === 'string'
      ? gridLineStyleValue
      : (gridLineStyleValue as { value?: string } | undefined)?.value ?? 'dashed';
    const gridDash = gridLineStyle === 'dashed' ? '4 3' : gridLineStyle === 'dotted' ? '2 2' : 'none';
    const labelFontFamily = resolveDropdown(s.axisFormattingCard.axisLabelFontFamily) || 'inherit';
    const laneLabelFontWeight = resolveDropdown(s.axisFormattingCard.axisLabelFontWeight) || 'normal';
    const showDataLabels = s.dataLabelFormattingCard.showDataLabels.value;

    // Hide axis properties that don't apply to a timeline visual
    s.axisFormattingCard.showXAxis.visible = false;
    s.axisFormattingCard.showYAxis.visible = false;
    s.axisFormattingCard.xAxisTitle.visible = false;
    s.axisFormattingCard.yAxisTitle.visible = false;
    s.axisFormattingCard.axisLabelRotation.visible = false;
    s.axisFormattingCard.yAxisMin.visible = false;
    s.axisFormattingCard.yAxisMax.visible = false;
    s.axisFormattingCard.gridLineWidth.visible = false;
    s.axisFormattingCard.gridLineOpacity.visible = false;

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
    if (highContrast.enabled) {
      this.container.style.backgroundColor = highContrast.background;
      this.container.style.color = highContrast.foreground;
    } else {
      this.container.style.backgroundColor = '';
      this.container.style.color = '';
    }

    // Empty state
    if (milestones.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'timeline-empty';
      empty.textContent = this.hasDateRole && this.emptyStateMode === 'noData'
        ? getLocalizedString(this.host, 'TimelineMilestone_NoDataState', 'No data for the current selection.')
        : getLocalizedString(this.host, 'TimelineMilestone_EmptyState', 'Add a Date field; Label is optional.');
      this.container.appendChild(empty);
      applyChartAria(this.container, {
        chartType: 'timeline',
        dataPointCount: 0,
      });
      return;
    }

    const maxVisible = Math.max(0, Math.floor(s.timelineSettings.maxVisible.value));
    const requestedOffset = Math.max(0, Math.floor(s.timelineSettings.windowOffset.value));
    const clampedOffset = maxVisible > 0
      ? Math.min(requestedOffset, Math.max(0, milestones.length - maxVisible))
      : 0;
    const visibleMilestones = maxVisible > 0
      ? milestones.slice(clampedOffset, clampedOffset + maxVisible)
      : milestones;
    this.currentVisibleMilestones = visibleMilestones;
    const labelDensity = resolveDropdown(s.timelineSettings.labelDensity) ?? 'full';
    const labelCharLimit = labelDensity === 'minimal' ? 8 : labelDensity === 'compact' ? 10 : 16;
    const shouldShowDateForIndex = (index: number, total: number): boolean => {
      if (!showDates) return false;
      if (labelDensity === 'minimal') return total <= 6 || index === 0 || index === total - 1;
      if (labelDensity === 'compact') return total <= 8 || index % 2 === 0;
      return true;
    };
    const shouldShowLabelForIndex = (index: number, total: number): boolean => {
      if (labelDensity === 'minimal') return total <= 6 || index === 0 || index === total - 1;
      if (labelDensity === 'compact') return total <= 10 || index % 2 === 0;
      return true;
    };

    // Build category color map
    const uniqueCategories = [...new Set(visibleMilestones.map((m) => m.category).filter(Boolean))];
    const catColorMap = new Map<string, string>();
    uniqueCategories.forEach((cat, i) => {
      catColorMap.set(
        cat,
        highContrast.enabled
          ? highContrast.foregroundSelected
          : getHostChartColor(this.host.colorPalette, i, themeName),
      );
    });
    const categoryIndex = new Map(uniqueCategories.map((category, index) => [category, index]));
    const useSwimlanes = showSwimlanes && uniqueCategories.length > 1;
    const defaultColor = highContrast.enabled ? highContrast.foregroundSelected : '#3B82F6';

    // SVG setup
    const chartPadding = Math.max(0, s.timelineSettings.chartPadding.value);
    const labelSpacing = Math.max(0, s.timelineSettings.labelSpacing.value);
    const svgWidth = Math.max(1, viewport.width - contentPadding * 2);
    const svgHeight = Math.max(1, viewport.height - contentPadding * 2);

    const svg = d3.select(this.container)
      .append('svg')
      .attr('width', svgWidth)
      .attr('height', svgHeight)
      .attr('data-layout-mode', layoutMode)
      .attr('data-chart-padding', String(chartPadding))
      .attr('data-label-spacing', String(labelSpacing));

    const n = visibleMilestones.length;
    const visibleTimes = visibleMilestones.map((milestone) => milestone.date?.getTime() ?? NaN);
    const minVisibleTime = Math.min(...visibleTimes);
    const maxVisibleTime = Math.max(...visibleTimes);
    const hasDateRange = Number.isFinite(minVisibleTime)
      && Number.isFinite(maxVisibleTime)
      && maxVisibleTime > minVisibleTime;
    const positionFraction = (milestone: Milestone, index: number): number => {
      if (hasDateRange && milestone.date) {
        return (milestone.date.getTime() - minVisibleTime) / (maxVisibleTime - minVisibleTime);
      }
      return n > 1 ? index / (n - 1) : 0.5;
    };

    if (isHorizontal) {
      const xStart = chartPadding;
      const xEnd = svgWidth - chartPadding;
      const cy = svgHeight / 2;

      if (!useSwimlanes) {
        svg.append('line')
          .attr('x1', xStart).attr('y1', cy)
          .attr('x2', xEnd).attr('y2', cy)
          .attr('stroke', connectorColor).attr('stroke-width', spineWidth);
      }

      // Grid lines (vertical tick marks at each milestone position)
      if (showGridLines && n > 1) {
        const gridGroup = svg.append('g').attr('class', 'timeline-grid');
        for (let gi = 0; gi < n; gi++) {
          const gx = xStart + positionFraction(visibleMilestones[gi], gi) * (xEnd - xStart);
          gridGroup.append('line')
            .attr('x1', gx).attr('y1', 0)
            .attr('x2', gx).attr('y2', svgHeight)
            .attr('stroke', gridLineColor)
            .attr('stroke-dasharray', gridDash)
            .attr('stroke-opacity', 0.4)
            .attr('stroke-width', 1);
        }
      }

      // Swimlane backgrounds (horizontal)
      if (useSwimlanes) {
        const laneHeight = svgHeight / uniqueCategories.length;
        uniqueCategories.forEach((cat, idx) => {
          const laneColor = catColorMap.get(cat) ?? defaultColor;
          const laneCenter = idx * laneHeight + laneHeight / 2;
          svg.append('rect')
            .attr('x', xStart)
            .attr('y', idx * laneHeight)
            .attr('width', xEnd - xStart)
            .attr('height', laneHeight)
            .attr('fill', laneColor)
            .attr('fill-opacity', 0.05)
            .attr('stroke', laneColor)
            .attr('stroke-opacity', 0.15)
            .attr('stroke-width', 0.5);
          svg.append('line')
            .attr('class', 'timeline-lane-spine')
            .attr('x1', xStart).attr('y1', laneCenter)
            .attr('x2', xEnd).attr('y2', laneCenter)
            .attr('stroke', connectorColor).attr('stroke-width', spineWidth);
          svg.append('text')
            .attr('class', 'timeline-lane-label')
            .attr('x', xStart - 4)
            .attr('y', laneCenter)
            .attr('text-anchor', 'end')
            .attr('font-size', labelFontSize)
            .attr('font-family', labelFontFamily)
            .attr('font-weight', laneLabelFontWeight)
            .attr('fill', secondaryTextColor)
            .attr('dominant-baseline', 'middle')
            .text(cat);
        });
      }

      visibleMilestones.forEach((ms, i) => {
        const cx = xStart + positionFraction(ms, i) * (xEnd - xStart);
        const laneIndex = categoryIndex.get(ms.category);
        const markerCy = useSwimlanes && laneIndex !== undefined
          ? (laneIndex + 0.5) * (svgHeight / uniqueCategories.length)
          : cy;
        // Determine above/below based on layout mode
        let isAbove: boolean;
        let staggerLevel = 0; // 0 = normal offset, 1/2 = progressively further
        if (layoutMode === 'top') {
          isAbove = true;
        } else if (layoutMode === 'bottom') {
          isAbove = false;
        } else if (layoutMode === 'staggered') {
          // 3-level stagger: above-near, below, above-far
          const level = i % 3;
          isAbove = level !== 1; // levels 0 and 2 are above, level 1 is below
          staggerLevel = level;
        } else {
          // 'alternating'
          isAbove = i % 2 === 0;
        }
        if (markerCy < labelSpacing + 24) isAbove = false;
        if (markerCy > svgHeight - labelSpacing - 24) isAbove = true;
        const baseColor = colorByCat && ms.category
          ? (catColorMap.get(ms.category) ?? defaultColor)
          : (highContrast.enabled ? defaultColor : getHostChartColor(this.host.colorPalette, i, themeName));
        const conditionalValue = ms.date ? ms.date.getTime() : i;
        const color = this.getConditionalColor(conditionalValue) ?? baseColor;

        // Connector line from spine to label area — staggered uses varying lengths
        const staggerMultiplier = layoutMode === 'staggered' ? (staggerLevel === 2 ? 1.6 : staggerLevel === 1 ? 1.0 : 0.6) : 1.0;
        const connectorLen = Math.max(0, (labelSpacing - markerSize) * staggerMultiplier);
        const y1 = isAbove ? markerCy - markerSize / 2 : markerCy + markerSize / 2;
        const y2 = isAbove ? markerCy - connectorLen : markerCy + connectorLen;

        if (showConnectors) {
          svg.append('line')
            .attr('x1', cx).attr('y1', y1)
            .attr('x2', cx).attr('y2', y2)
            .attr('stroke', connectorColor).attr('stroke-width', 1)
            .attr('stroke-dasharray', '2,2');
        }

        // Marker
        const marker = this.createSvgMarker(svg, cx, markerCy, markerSize, markerShape, color, markerStroke, markerStrokeWidth);
        if (marker) {
          marker
            .attr('data-milestone-idx', String(i))
            .attr('data-selection-key', ms.selectionId.getKey());
        }

        // Label text
        const labelY = isAbove ? y2 - 4 : y2 + 12;
        const labelAnchor = cx < Math.max(64, chartPadding + 24)
          ? 'start'
          : cx > svgWidth - Math.max(64, chartPadding + 24)
            ? 'end'
            : 'middle';
        const labelGroup = svg.append('g')
          .attr('data-milestone-idx', String(i))
          .attr('data-selection-key', ms.selectionId.getKey());

        if (showDataLabels && shouldShowLabelForIndex(i, n)) {
          labelGroup.append('text')
            .attr('class', 'timeline-data-label')
            .attr('x', cx).attr('y', labelY)
            .attr('text-anchor', labelAnchor)
            .attr('font-size', labelFontSize)
            .attr('font-family', labelFontFamily)
            .attr('font-weight', '600')
            .attr('fill', primaryTextColor)
            .text(ms.label.length > labelCharLimit ? ms.label.slice(0, Math.max(4, labelCharLimit - 2)) + '...' : ms.label);

          if (shouldShowDateForIndex(i, n) && ms.date) {
            const dateY = isAbove ? labelY - 14 : labelY + 14;
            labelGroup.append('text')
              .attr('class', 'timeline-data-label')
              .attr('x', cx).attr('y', dateY)
              .attr('text-anchor', labelAnchor)
              .attr('font-size', labelFontSize)
              .attr('font-family', labelFontFamily)
              .attr('fill', secondaryTextColor)
              .text(formatDate(ms.date, dateFormatVal, locale));
          }
        }
        this.attachSelection(marker, labelGroup, ms, dateFormatVal, locale, i, n);

        // Animations
        // Skip animation when cross-highlighting is active to avoid overwriting dimmed opacity
        if (animEnabled && marker && !this.currentTimelineData?.hasHighlights) {
          const markerNode = marker.node();
          if (markerNode) {
            const cancel = popIn(markerNode as unknown as HTMLElement, i * 80, animDuration);
            this.cancelAnimations.push(cancel);
          }
        }

        if (animEnabled && showDataLabels && !this.currentTimelineData?.hasHighlights) {
          const labelNode = labelGroup.node();
          if (labelNode) {
            const dir = isAbove ? 'down' as const : 'up' as const;
            const cancel = fadeSlideIn(labelNode as unknown as HTMLElement, dir, animDuration, i * 80 + 100);
            this.cancelAnimations.push(cancel);
          }
        }
      });
    } else {
      // Vertical orientation
      const yStart = chartPadding;
      const yEnd = svgHeight - chartPadding;
      const cx = svgWidth / 2;

      if (!useSwimlanes) {
        svg.append('line')
          .attr('x1', cx).attr('y1', yStart)
          .attr('x2', cx).attr('y2', yEnd)
          .attr('stroke', connectorColor).attr('stroke-width', spineWidth);
      }

      // Grid lines (horizontal tick marks at each milestone position)
      if (showGridLines && n > 1) {
        const gridGroup = svg.append('g').attr('class', 'timeline-grid');
        for (let gi = 0; gi < n; gi++) {
          const gy = yStart + positionFraction(visibleMilestones[gi], gi) * (yEnd - yStart);
          gridGroup.append('line')
            .attr('x1', 0).attr('y1', gy)
            .attr('x2', svgWidth).attr('y2', gy)
            .attr('stroke', gridLineColor)
            .attr('stroke-dasharray', gridDash)
            .attr('stroke-opacity', 0.4)
            .attr('stroke-width', 1);
        }
      }

      // Swimlane backgrounds (vertical)
      if (useSwimlanes) {
        const laneWidth = svgWidth / uniqueCategories.length;
        uniqueCategories.forEach((cat, idx) => {
          const laneColor = catColorMap.get(cat) ?? defaultColor;
          const laneCenter = idx * laneWidth + laneWidth / 2;
          svg.append('rect')
            .attr('x', idx * laneWidth)
            .attr('y', yStart)
            .attr('width', laneWidth)
            .attr('height', yEnd - yStart)
            .attr('fill', laneColor)
            .attr('fill-opacity', 0.05)
            .attr('stroke', laneColor)
            .attr('stroke-opacity', 0.15)
            .attr('stroke-width', 0.5);
          svg.append('line')
            .attr('class', 'timeline-lane-spine')
            .attr('x1', laneCenter).attr('y1', yStart)
            .attr('x2', laneCenter).attr('y2', yEnd)
            .attr('stroke', connectorColor).attr('stroke-width', spineWidth);
          svg.append('text')
            .attr('class', 'timeline-lane-label')
            .attr('x', laneCenter)
            .attr('y', Math.max(10, yStart - 6))
            .attr('text-anchor', 'middle')
            .attr('font-size', labelFontSize)
            .attr('font-family', labelFontFamily)
            .attr('font-weight', laneLabelFontWeight)
            .attr('fill', secondaryTextColor)
            .text(cat);
        });
      }

      visibleMilestones.forEach((ms, i) => {
        const my = yStart + positionFraction(ms, i) * (yEnd - yStart);
        const laneIndex = categoryIndex.get(ms.category);
        const markerCx = useSwimlanes && laneIndex !== undefined
          ? (laneIndex + 0.5) * (svgWidth / uniqueCategories.length)
          : cx;
        // Determine left/right based on layout mode
        let isLeft: boolean;
        let staggerLevel = 0;
        if (layoutMode === 'top') {
          isLeft = true;
        } else if (layoutMode === 'bottom') {
          isLeft = false;
        } else if (layoutMode === 'staggered') {
          const level = i % 3;
          isLeft = level !== 1;
          staggerLevel = level;
        } else {
          isLeft = i % 2 === 0;
        }
        if (markerCx < labelSpacing + 24) isLeft = false;
        if (markerCx > svgWidth - labelSpacing - 24) isLeft = true;
        const baseColor = colorByCat && ms.category
          ? (catColorMap.get(ms.category) ?? defaultColor)
          : (highContrast.enabled ? defaultColor : getHostChartColor(this.host.colorPalette, i, themeName));
        const conditionalValue = ms.date ? ms.date.getTime() : i;
        const color = this.getConditionalColor(conditionalValue) ?? baseColor;

        // Connector — staggered uses varying lengths
        const staggerMultiplier = layoutMode === 'staggered' ? (staggerLevel === 2 ? 1.6 : staggerLevel === 1 ? 1.0 : 0.6) : 1.0;
        const connectorLen = labelSpacing * staggerMultiplier;
        const x1 = isLeft ? markerCx - markerSize / 2 : markerCx + markerSize / 2;
        const x2 = isLeft ? markerCx - connectorLen : markerCx + connectorLen;

        if (showConnectors) {
          svg.append('line')
            .attr('x1', x1).attr('y1', my)
            .attr('x2', x2).attr('y2', my)
            .attr('stroke', connectorColor).attr('stroke-width', 1)
            .attr('stroke-dasharray', '2,2');
        }

        // Marker
        const marker = this.createSvgMarker(svg, markerCx, my, markerSize, markerShape, color, markerStroke, markerStrokeWidth);
        if (marker) {
          marker
            .attr('data-milestone-idx', String(i))
            .attr('data-selection-key', ms.selectionId.getKey());
        }

        // Label text
        const labelX = isLeft ? x2 - 4 : x2 + 4;
        const anchor = isLeft ? 'end' : 'start';
        const labelGroup = svg.append('g')
          .attr('data-milestone-idx', String(i))
          .attr('data-selection-key', ms.selectionId.getKey());

        if (showDataLabels && shouldShowLabelForIndex(i, n)) {
          labelGroup.append('text')
            .attr('class', 'timeline-data-label')
            .attr('x', labelX).attr('y', my + 4)
            .attr('text-anchor', anchor)
            .attr('font-size', labelFontSize)
            .attr('font-family', labelFontFamily)
            .attr('font-weight', '600')
            .attr('fill', primaryTextColor)
            .text(ms.label.length > labelCharLimit ? ms.label.slice(0, Math.max(4, labelCharLimit - 2)) + '...' : ms.label);

          if (shouldShowDateForIndex(i, n) && ms.date) {
            labelGroup.append('text')
              .attr('class', 'timeline-data-label')
              .attr('x', labelX).attr('y', my + 18)
              .attr('text-anchor', anchor)
              .attr('font-size', labelFontSize)
              .attr('font-family', labelFontFamily)
              .attr('fill', secondaryTextColor)
              .text(formatDate(ms.date, dateFormatVal, locale));
          }
        }
        this.attachSelection(marker, labelGroup, ms, dateFormatVal, locale, i, n);

        // Animations
        // Skip animation when cross-highlighting is active to avoid overwriting dimmed opacity
        if (animEnabled && marker && !this.currentTimelineData?.hasHighlights) {
          const markerNode = marker.node();
          if (markerNode) {
            const cancel = popIn(markerNode as unknown as HTMLElement, i * 80, animDuration);
            this.cancelAnimations.push(cancel);
          }
        }

        if (animEnabled && showDataLabels && !this.currentTimelineData?.hasHighlights) {
          const labelNode = labelGroup.node();
          if (labelNode) {
            const dir = isLeft ? 'right' as const : 'left' as const;
            const cancel = fadeSlideIn(labelNode as unknown as HTMLElement, dir, animDuration, i * 80 + 100);
            this.cancelAnimations.push(cancel);
          }
        }
      });
    }
    // Apply shared formatting settings
    applyDataLabelFormatting(this.container, s.dataLabelFormattingCard, '.timeline-data-label');
    if (highContrast.enabled) {
      this.container.querySelectorAll<SVGTextElement>('.timeline-data-label, .timeline-lane-label').forEach((label) => {
        label.setAttribute('fill', highContrast.foreground);
      });
    } else if (labelColorValue) {
      this.container.querySelectorAll<SVGTextElement>('.timeline-lane-label').forEach((label) => {
        label.setAttribute('fill', labelColorValue);
      });
    }

    // Duration bars between consecutive milestones
    if (showDurationBars && visibleMilestones.length > 1) {
      const durationGroup = svg.append('g').attr('class', 'timeline-duration-bars');
      for (let i = 0; i < visibleMilestones.length - 1; i++) {
        if (!visibleMilestones[i].date || !visibleMilestones[i + 1].date) continue;
        if (useSwimlanes && visibleMilestones[i].category !== visibleMilestones[i + 1].category) continue;
        const barColor = catColorMap.get(visibleMilestones[i].category) ?? defaultColor;
        if (isHorizontal) {
          const xStart2 = chartPadding + positionFraction(visibleMilestones[i], i) * (svgWidth - chartPadding * 2);
          const xEnd2 = chartPadding + positionFraction(visibleMilestones[i + 1], i + 1) * (svgWidth - chartPadding * 2);
          const laneIndex = categoryIndex.get(visibleMilestones[i].category);
          const laneCenter = useSwimlanes && laneIndex !== undefined
            ? (laneIndex + 0.5) * (svgHeight / uniqueCategories.length)
            : svgHeight / 2;
          const barY = laneCenter + markerSize + 2;
          const durBarHeight = s.spineAndConnectorsSettings.durationBarHeight.value;
          const durBarOpacity = s.spineAndConnectorsSettings.durationBarOpacity.value / 100;
          durationGroup.append('rect')
            .attr('x', xStart2)
            .attr('y', barY)
            .attr('width', Math.max(0, xEnd2 - xStart2))
            .attr('height', durBarHeight)
            .attr('rx', 2)
            .attr('fill', barColor)
            .attr('fill-opacity', durBarOpacity);
        } else {
          const yStart2 = chartPadding + positionFraction(visibleMilestones[i], i) * (svgHeight - chartPadding * 2);
          const yEnd2 = chartPadding + positionFraction(visibleMilestones[i + 1], i + 1) * (svgHeight - chartPadding * 2);
          const laneIndex = categoryIndex.get(visibleMilestones[i].category);
          const laneCenter = useSwimlanes && laneIndex !== undefined
            ? (laneIndex + 0.5) * (svgWidth / uniqueCategories.length)
            : svgWidth / 2;
          const barX = laneCenter + markerSize + 2;
          const durBarHeight = s.spineAndConnectorsSettings.durationBarHeight.value;
          const durBarOpacity = s.spineAndConnectorsSettings.durationBarOpacity.value / 100;
          durationGroup.append('rect')
            .attr('x', barX)
            .attr('y', yStart2)
            .attr('width', durBarHeight)
            .attr('height', Math.max(0, yEnd2 - yStart2))
            .attr('rx', 2)
            .attr('fill', barColor)
            .attr('fill-opacity', durBarOpacity);
        }
      }
    }

    // Today line
    this.renderTodayLine(svg, visibleMilestones, svgWidth, svgHeight, isHorizontal, chartPadding);

    // Legend — milestone category colors
    const legendCard = this.settings.legendFormattingCard;
    if (legendCard.showLegend.value && colorByCat && catColorMap.size > 0) {
      const legendPos = resolveDropdown(legendCard.legendPosition) ?? 'bottom';
      const rawFontColor = legendCard.legendFontColor.value?.value;
      const legendItems: LegendItem[] = Array.from(catColorMap.entries()).map(([cat, color]) => ({
        label: cat,
        color,
      }));
      renderLegend(this.container, {
        items: legendItems,
        position: legendPos as 'top' | 'bottom' | 'left' | 'right',
        fontSize: legendCard.legendFontSize.value,
        fontColor: rawFontColor && rawFontColor.length > 0 ? rawFontColor : '#64748B',
        fontFamily: resolveDropdown(legendCard.legendFontFamily) || undefined,
        fontWeight: resolveDropdown(legendCard.legendFontWeight) || 'normal',
        aliases: legendCard.legendAliases.value,
      });
    }

    // Apply cross-highlight dimming
    this.applyCrossHighlight(visibleMilestones);

    this.applyAccessibility();
    this.container.addEventListener('click', this.handleBackgroundClick);
  }

  // ── Cross-Highlight Dimming ─────────────────────────────────────

  private applyCrossHighlight(milestones: Milestone[]): void {
    const data = this.currentTimelineData;
    if (!data) return;

    const selectedIds = this.selectionManager.getSelectionIds() as ISelectionId[];
    const selectedKeys = new Set(selectedIds.map((selectionId) => selectionId.getKey()));
    const hasSelection = selectedKeys.size > 0;
    const highlightedKeys = new Set(
      milestones
        .filter((milestone) => milestone.highlighted)
        .map((milestone) => milestone.selectionId.getKey()),
    );
    const shouldDim = hasSelection || data.hasHighlights;

    const elements = this.container.querySelectorAll<SVGElement>('[data-milestone-idx]');
    for (const el of elements) {
      const selectionKey = el.getAttribute('data-selection-key');
      const selected = Boolean(selectionKey && selectedKeys.has(selectionKey));
      const highlighted = Boolean(selectionKey && highlightedKeys.has(selectionKey));
      el.style.opacity = shouldDim && !selected && !highlighted ? '0.3' : '';
    }
  }

  private createSvgMarker(
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    cx: number,
    cy: number,
    size: number,
    shape: string,
    color: string,
    strokeColor: string,
    strokeWidth: number = 2,
  ): d3.Selection<SVGElement, unknown, null, undefined> | null {
    const half = size / 2;

    if (shape === 'circle') {
      return svg.append('circle')
        .attr('class', 'timeline-marker')
        .attr('cx', cx).attr('cy', cy)
        .attr('r', half)
        .attr('fill', color)
        .attr('stroke', strokeColor).attr('stroke-width', strokeWidth) as unknown as d3.Selection<SVGElement, unknown, null, undefined>;
    }

    if (shape === 'square') {
      return svg.append('rect')
        .attr('class', 'timeline-marker')
        .attr('x', cx - half).attr('y', cy - half)
        .attr('width', size).attr('height', size)
        .attr('rx', 2)
        .attr('fill', color)
        .attr('stroke', strokeColor).attr('stroke-width', strokeWidth) as unknown as d3.Selection<SVGElement, unknown, null, undefined>;
    }

    if (shape === 'diamond') {
      const pts = `${cx},${cy - half} ${cx + half},${cy} ${cx},${cy + half} ${cx - half},${cy}`;
      return svg.append('polygon')
        .attr('class', 'timeline-marker')
        .attr('points', pts)
        .attr('fill', color)
        .attr('stroke', strokeColor).attr('stroke-width', strokeWidth) as unknown as d3.Selection<SVGElement, unknown, null, undefined>;
    }

    return null;
  }

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    this.syncFormattingVisibility();
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  private migrateLegacyFormatting(dataView: DataView | undefined): void {
    const objects = dataView?.metadata?.objects;
    const legacy = objects?.['timelineSettings'] as Record<string, unknown> | undefined;
    if (!legacy) return;

    const spine = objects?.['spineAndConnectorsSettings'] as Record<string, unknown> | undefined;
    const markers = objects?.['markerSettings'] as Record<string, unknown> | undefined;
    const migrateSpineNumber = (name: 'lineWidth'): void => {
      const value = legacy[name];
      if (!(spine && Object.prototype.hasOwnProperty.call(spine, name)) && typeof value === 'number') {
        this.settings.spineAndConnectorsSettings[name].value = value;
      }
    };
    const migrateSpineColor = (name: 'lineColor' | 'labelColor'): void => {
      const value = this.readFormattingColor(legacy[name]);
      if (!(spine && Object.prototype.hasOwnProperty.call(spine, name)) && value) {
        this.settings.spineAndConnectorsSettings[name].value = { value };
      }
    };

    migrateSpineColor('lineColor');
    migrateSpineNumber('lineWidth');
    migrateSpineColor('labelColor');

    const markerStroke = this.readFormattingColor(legacy['markerStrokeColor']);
    if (!(markers && Object.prototype.hasOwnProperty.call(markers, 'markerStrokeColor')) && markerStroke) {
      this.settings.markerSettings.markerStrokeColor.value = { value: markerStroke };
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
    syncLegendFormattingVisibility(s.legendFormattingCard);
    syncDateFilterFormattingVisibility(s.dateFilterFormattingCard);
    syncCardStyleVisibility(s.cardSettings);
    s.cardSettings.borderRadius.visible = resolveDropdown(s.cardSettings.cardStyleMode) !== 'none';

    const showDataLabels = s.dataLabelFormattingCard.showDataLabels.value;
    s.dataLabelFormattingCard.dataLabelFontSize.visible = showDataLabels;
    s.dataLabelFormattingCard.dataLabelFontColor.visible = showDataLabels;
    s.dataLabelFormattingCard.dataLabelFontWeight.visible = showDataLabels;
    s.dataLabelFormattingCard.dataLabelFontFamily.visible = showDataLabels;
    s.dataLabelFormattingCard.dataLabelPosition.visible = false;
    s.timelineSettings.showDates.visible = showDataLabels;
    s.timelineSettings.dateFormat.visible = showDataLabels && s.timelineSettings.showDates.value;
    const maxVisible = Math.max(0, Math.floor(s.timelineSettings.maxVisible.value));
    s.timelineSettings.windowOffset.visible = maxVisible > 0
      && (this.currentTimelineData?.milestones.length ?? 0) > maxVisible;

    s.markerSettings.colorByCategory.visible = this.hasCategoryRole;
    s.legendFormattingCard.visible = this.hasCategoryRole && s.markerSettings.colorByCategory.value;
    s.legendFormattingCard.showInlineLabels.visible = false;
    s.legendFormattingCard.inlineLabelFontSize.visible = false;
    s.legendFormattingCard.inlineLabelOffset.visible = false;

    const orientation = resolveDropdown(s.timelineSettings.orientation) ?? 'horizontal';
    s.spineAndConnectorsSettings.showSwimlanes.visible = this.hasCategoryRole;
    const showLaneLabels = this.hasCategoryRole
      && s.spineAndConnectorsSettings.showSwimlanes.value;
    s.spineAndConnectorsSettings.labelColor.visible = showLaneLabels;
    const showDurationBars = s.spineAndConnectorsSettings.showDurationBars.value;
    s.spineAndConnectorsSettings.durationBarOpacity.visible = showDurationBars;
    s.spineAndConnectorsSettings.durationBarHeight.visible = showDurationBars;

    const showTodayLine = s.timelineMarkerSettings.showTodayLine.value;
    s.timelineMarkerSettings.todayLineColor.visible = showTodayLine;
    s.timelineMarkerSettings.todayLineWidth.visible = showTodayLine;
    s.timelineMarkerSettings.todayLineOpacity.visible = showTodayLine;
    s.timelineMarkerSettings.clusterThresholdDays.visible = s.timelineMarkerSettings.clusterNearby.value;
    s.animationSettings.duration.visible = s.animationSettings.enabled.value;

    s.axisFormattingCard.showXAxis.visible = false;
    s.axisFormattingCard.showYAxis.visible = false;
    s.axisFormattingCard.xAxisTitle.visible = false;
    s.axisFormattingCard.yAxisTitle.visible = false;
    s.axisFormattingCard.axisLabelColor.visible = false;
    s.axisFormattingCard.axisLabelSize.visible = showLaneLabels;
    s.axisFormattingCard.axisLabelFontFamily.visible = showLaneLabels;
    s.axisFormattingCard.axisLabelFontWeight.visible = showLaneLabels;
    s.axisFormattingCard.axisLabelRotation.visible = false;
    s.axisFormattingCard.yAxisMin.visible = false;
    s.axisFormattingCard.yAxisMax.visible = false;
    s.axisFormattingCard.axisLineColor.visible = false;
    s.axisFormattingCard.axisLineWidth.visible = false;
    s.axisFormattingCard.integerTicks.visible = false;
    s.axisFormattingCard.gridLineWidth.visible = false;
    s.axisFormattingCard.gridLineOpacity.visible = false;
    const showGridLines = s.axisFormattingCard.showGridLines.value;
    s.axisFormattingCard.gridLineColor.visible = showGridLines;
    s.axisFormattingCard.gridLineStyle.visible = showGridLines;

    const conditionalEnabled = s.conditionalFormattingCard.enableConditional.value;
    s.conditionalFormattingCard.conditionalDirection.visible = conditionalEnabled;
    s.conditionalFormattingCard.threshold1.visible = conditionalEnabled;
    s.conditionalFormattingCard.threshold2.visible = conditionalEnabled;
    s.conditionalFormattingCard.conditionalColor1.visible = conditionalEnabled;
    s.conditionalFormattingCard.conditionalColor2.visible = conditionalEnabled;
    s.conditionalFormattingCard.conditionalColor3.visible = conditionalEnabled;
  }

  private attachSelection(
    marker: d3.Selection<SVGElement, unknown, null, undefined> | null,
    labelGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
    milestone: Milestone,
    dateFormatVal: string,
    locale: string | undefined,
    index: number,
    total: number,
  ): void {
    const onClick = (event: MouseEvent): void => {
      event.stopPropagation();
      if (!allowInteractions(this.host)) return;
      void this.selectionManager.select(milestone.selectionId, event.ctrlKey || event.metaKey).then(() => {
        this.applyCrossHighlight(this.currentVisibleMilestones);
      });
    };
    const onContextMenu = (event: MouseEvent): void => {
      event.preventDefault();
      event.stopPropagation();
      if (!allowInteractions(this.host)) return;
      void this.selectionManager.showContextMenu(milestone.selectionId, {
        x: event.clientX,
        y: event.clientY,
      });
    };
    const onMouseEnter = (event: MouseEvent): void => {
      this.showMilestoneTooltip(milestone, dateFormatVal, locale, event);
    };
    const onMouseMove = (event: MouseEvent): void => {
      this.moveTooltip(event);
    };
    const onMouseLeave = (): void => {
      this.hideTooltip();
    };

    if (marker) {
      marker.style('cursor', allowInteractions(this.host) ? 'pointer' : 'default');
      marker.on('click.selection', onClick);
      marker.on('contextmenu.selection', onContextMenu);
      marker.on('mouseenter.tooltip', onMouseEnter);
      marker.on('mousemove.tooltip', onMouseMove);
      marker.on('mouseleave.tooltip', onMouseLeave);
      const markerNode = marker.node();
      if (markerNode && this.settings.accessibilityFormattingCard.enableKeyboardNav.value) {
        applyDataPointAria(
          markerNode,
          milestone.label,
          [formatDate(milestone.date, dateFormatVal, locale), milestone.category].filter(Boolean).join(', '),
          index,
          total,
        );
      }
    }

    labelGroup.style('cursor', allowInteractions(this.host) ? 'pointer' : 'default');
    labelGroup.on('click.selection', onClick);
    labelGroup.on('contextmenu.selection', onContextMenu);
    labelGroup.on('mouseenter.tooltip', onMouseEnter);
    labelGroup.on('mousemove.tooltip', onMouseMove);
    labelGroup.on('mouseleave.tooltip', onMouseLeave);
  }

  private showMilestoneTooltip(milestone: Milestone, dateFormatVal: string, locale: string | undefined, event: MouseEvent): void {
    const tooltipData: VisualTooltipDataItem[] = [
      { displayName: 'Label', value: milestone.label },
    ];
    if (milestone.date) {
      tooltipData.push({ displayName: 'Date', value: formatDate(milestone.date, dateFormatVal, locale) });
    }
    if (milestone.category) {
      tooltipData.push({ displayName: 'Category', value: milestone.category });
    }

    this.host.tooltipService.show({
      dataItems: tooltipData,
      identities: [milestone.selectionId],
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

  private getHighContrastColors(): {
    enabled: boolean;
    foreground: string;
    background: string;
    foregroundSelected: string;
  } {
    const palette = (this.host as unknown as {
      colorPalette?: {
        isHighContrast?: boolean;
        foreground?: unknown;
        background?: unknown;
        foregroundSelected?: unknown;
      };
    }).colorPalette;

    const colorValue = (value: unknown, fallback: string): string => {
      if (typeof value === 'string' && value.length > 0) return value;
      if (typeof value === 'object' && value !== null && 'value' in value) {
        const nested = (value as { value?: unknown }).value;
        if (typeof nested === 'string' && nested.length > 0) return nested;
      }
      return fallback;
    };

    return {
      enabled: Boolean(palette?.isHighContrast),
      foreground: colorValue(palette?.foreground, '#000000'),
      background: colorValue(palette?.background, '#FFFFFF'),
      foregroundSelected: colorValue(palette?.foregroundSelected, '#000000'),
    };
  }

  // Render lifecycle notifications removed — Power BI's eventService.renderingStarted()
  // requires VisualUpdateOptions with updateId, and calling without args crashes the visual.

  private handleBackgroundClick = (): void => {
    if (!allowInteractions(this.host)) return;
    void this.selectionManager.clear().then(() => {
      this.applyCrossHighlight(this.currentVisibleMilestones);
    });
  };

  // -- Today Line Rendering ---------------------------------------------------

  private renderTodayLine(
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    milestones: Milestone[],
    chartWidth: number,
    chartHeight: number,
    isHorizontal: boolean,
    chartPadding: number,
  ): void {
    const markerSettings = this.settings.timelineMarkerSettings;
    if (!markerSettings.showTodayLine.value) return;

    const datesWithTime = milestones
      .filter((m) => m.date !== null)
      .map((m) => m.date!.getTime());
    if (datesWithTime.length < 2) return;

    const minTime = Math.min(...datesWithTime);
    const maxTime = Math.max(...datesWithTime);
    const now = Date.now();
    if (now < minTime || now > maxTime) return;

    const frac = (now - minTime) / (maxTime - minTime);
    const highContrast = this.getHighContrastColors();
    const color = highContrast.enabled
      ? highContrast.foregroundSelected
      : (markerSettings.todayLineColor.value?.value ?? '#EF4444');
    const todayWidth = markerSettings.todayLineWidth.value;
    const todayOpacity = markerSettings.todayLineOpacity.value / 100;

    if (isHorizontal) {
      const xStart = chartPadding;
      const xEnd = chartWidth - chartPadding;
      const x = xStart + frac * (xEnd - xStart);
      svg.append('line')
        .attr('x1', x).attr('y1', 0)
        .attr('x2', x).attr('y2', chartHeight)
        .attr('stroke', color)
        .attr('stroke-width', todayWidth)
        .attr('stroke-dasharray', '4,3')
        .attr('opacity', todayOpacity);
    } else {
      const yStart = chartPadding;
      const yEnd = chartHeight - chartPadding;
      const y = yStart + frac * (yEnd - yStart);
      svg.append('line')
        .attr('x1', 0).attr('y1', y)
        .attr('x2', chartWidth).attr('y2', y)
        .attr('stroke', color)
        .attr('stroke-width', todayWidth)
        .attr('stroke-dasharray', '4,3')
        .attr('opacity', todayOpacity);
    }
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
      const cleanup = attachKeyboardNav({
        container: this.container,
        itemSelector: '.timeline-marker[tabindex="0"]',
        onActivate: (el: Element) => {
          el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        },
      });
      this.cancelAnimations.push(cleanup);
    }
    applyChartAria(this.container, {
      chartType: 'timeline',
      dataPointCount: this.container.querySelectorAll('.timeline-marker').length,
    });
  }

  public destroy(): void {
    this.removeEmptySpaceContextMenu?.();
    this.removeEmptySpaceContextMenu = null;
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.hideTooltip();
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];
  }
}
