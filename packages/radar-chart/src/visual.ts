/**
 * Radar Chart — Power BI IVisual implementation.
 * Spider/radar chart with animated polygon series and concentric web grid.
 */

import powerbi from 'powerbi-visuals-api';
import * as d3 from 'd3';
import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel';
import { RadarChartSettings } from './settings';
import {
  animate,
  cubicOut,
  popIn,
  fadeSlideIn,
  DURATION,
  applyCardStyle,
  type CardStyleMode,
  getHostChartColor,
  getChartColor,
  withOpacity,
  formatWithSettings,
  renderChartTitle,
  applyDataLabelFormatting,
  resolveDropdown,
  applyChartAria,
  applyDataPointAria,
  attachKeyboardNav,
  ensureFocusRingStyles,
  createHoverDim,
  resolveColorTheme,
  buildConditionalConfig,
  resolveConditionalColor,
  resolveSeriesFormatting,
  populateSeriesFormattingGroups,
  lineStyleToDashArray,
  getDateFilterIndices,
  isDateColumn,
  type DateFilterConfig,
  syncLegendFormattingVisibility,
  syncTitleFormattingVisibility,
  attachEmptySpaceContextMenu,
  allowInteractions,
  getHostHighContrastColors,
  applyBasicHighContrastStyles,
  notifyRenderingStarted,
  notifyRenderingFinished,
  notifyRenderingFailed,
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

// ── Types ────────────────────────────────────────────────────────────

interface RadarSeries {
  name: string;
  values: number[];
  color: string;
  /** Per-axis highlight flags (true = this axis/value is cross-highlighted). */
  highlights: boolean[];
}

/** Top-level radar chart data container. */
interface RadarChartData {
  categories: string[];
  categorySelectionIds: ISelectionId[];
  series: RadarSeries[];
  /** Whether cross-highlight data is present from another visual/slicer. */
  hasHighlights: boolean;
}

type RadarAxisLabelCollisionMode = 'auto' | 'hide' | 'none';

interface RadarAxisLabelPlacement {
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
  visible: boolean;
}

// ── Visual ───────────────────────────────────────────────────────────

export class RadarChartVisual implements IVisual {
  private host: IVisualHost;
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private container: HTMLElement;
  private settings: RadarChartSettings;
  private formattingSettingsService: FormattingSettingsService;
  private cancelAnimations: Array<() => void> = [];
  private currentData: RadarChartData | null = null;
  private emptyStateMode: 'unconfigured' | 'noData' = 'unconfigured';
  private hasRequiredFields = false;
  private removeEmptySpaceContextMenu: (() => void) | null = null;

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new RadarChartSettings();
    this.formattingSettingsService = new FormattingSettingsService(options.host.createLocalizationManager());
    this.container.classList.add('radar-container');
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
    const hasCategoryField = metadataColumns.some((column) => column.roles?.['category']);
    const hasMeasureField = metadataColumns.some((column) => column.roles?.['measure']);
    this.hasRequiredFields = hasCategoryField && hasMeasureField;
    if (dataView) {
      this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
        RadarChartSettings,
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

    // Migrate legacy appearance properties that originally lived in radarSettings.
    const legacyRadarObj = dataView?.metadata?.objects?.['radarSettings'];
    const appearanceObj = dataView?.metadata?.objects?.['radarAppearance'];
    if (legacyRadarObj) {
      if (appearanceObj?.['dotRadius'] === undefined && typeof legacyRadarObj['dotRadius'] === 'number') {
        this.settings.radarAppearance.dotRadius.value = legacyRadarObj['dotRadius'];
      }
      if (appearanceObj?.['areaOpacity'] === undefined && typeof legacyRadarObj['areaOpacity'] === 'number') {
        this.settings.radarAppearance.areaOpacity.value = legacyRadarObj['areaOpacity'];
      }
    }

    syncTitleFormattingVisibility(this.settings.titleFormattingCard);
    syncLegendFormattingVisibility(this.settings.legendFormattingCard);

    // Hide inapplicable shared axis properties — radar-chart doesn't use titles/rotation/min/max

    // Date filter: hide start/end when disabled
    this.settings.dateFilterFormattingCard.startDate.visible = this.settings.dateFilterFormattingCard.enableDateFilter.value;
    this.settings.dateFilterFormattingCard.endAtCurrentDate.visible = this.settings.dateFilterFormattingCard.enableDateFilter.value;
    this.settings.dateFilterFormattingCard.endDate.visible = this.settings.dateFilterFormattingCard.enableDateFilter.value && !this.settings.dateFilterFormattingCard.endAtCurrentDate.value;
    this.settings.axisFormattingCard.showXAxis.visible = false;
    this.settings.axisFormattingCard.showYAxis.visible = false;
    this.settings.axisFormattingCard.xAxisTitle.visible = false;
    this.settings.axisFormattingCard.yAxisTitle.visible = false;
    this.settings.axisFormattingCard.axisLabelRotation.visible = false;
    this.settings.axisFormattingCard.yAxisMin.visible = false;
    this.settings.axisFormattingCard.yAxisMax.visible = false;
    this.settings.axisFormattingCard.showGridLines.visible = false;
    this.settings.axisFormattingCard.gridLineWidth.visible = false;
    this.settings.axisFormattingCard.gridLineOpacity.visible = false;
    this.settings.axisFormattingCard.integerTicks.visible = false;

    // Card style: hide opacity when style is 'none'
    const cardMode = (resolveDropdown(this.settings.cardSettings.cardStyleMode) ?? 'glass') as CardStyleMode;
    this.settings.cardSettings.backgroundOpacity.visible = cardMode !== 'none';
    this.settings.cardSettings.backgroundColor.visible = cardMode !== 'none';
    this.settings.cardSettings.borderRadius.visible = cardMode !== 'none';

    // Hide data label position — position is determined by chart geometry
    this.settings.dataLabelFormattingCard.dataLabelPosition.visible = false;

    const showGrid = this.settings.radarSettings.showGrid.value;
    const showAxisValues = this.settings.radarSettings.showAxisValues.value;
    this.settings.radarSettings.gridLevels.visible = showGrid || showAxisValues;
    this.settings.radarSettings.gridShape.visible = showGrid;
    this.settings.radarSettings.webStrokeColor.visible = showGrid;
    this.settings.radarSettings.webStrokeWidth.visible = showGrid;
    this.settings.radarSettings.webFillOpacity.visible = showGrid;
    this.settings.axisFormattingCard.gridLineColor.visible = showGrid;
    this.settings.axisFormattingCard.gridLineStyle.visible = showGrid;

    const showAxisLabels = this.settings.radarSettings.showAxisLabels.value;
    const showAnyAxisText = showAxisLabels || showAxisValues;
    this.settings.axisFormattingCard.axisLabelColor.visible = showAnyAxisText;
    this.settings.axisFormattingCard.axisLabelSize.visible = showAnyAxisText;
    this.settings.axisFormattingCard.axisLabelFontFamily.visible = showAnyAxisText;
    this.settings.axisFormattingCard.axisLabelFontWeight.visible = showAnyAxisText;
    this.settings.radarSettings.axisLabelCollisionHandling.visible = showAxisLabels;

    const showDataLabels = this.settings.dataLabelFormattingCard.showDataLabels.value;
    this.settings.dataLabelFormattingCard.dataLabelFontSize.visible = showDataLabels;
    this.settings.dataLabelFormattingCard.dataLabelFontColor.visible = showDataLabels;
    this.settings.dataLabelFormattingCard.dataLabelFontWeight.visible = showDataLabels;
    this.settings.dataLabelFormattingCard.dataLabelFontFamily.visible = showDataLabels;

    // Conditional visibility: hide dot sub-settings when showDots is off
    const dotsVisible = this.settings.radarAppearance.showDots.value;
    this.settings.radarAppearance.dotRadius.visible = dotsVisible;
    this.settings.radarAppearance.dotBorderColor.visible = dotsVisible;
    this.settings.radarAppearance.dotBorderWidth.visible = dotsVisible;

    // Conditional visibility: hide benchmark sub-settings when showBenchmark is off
    const benchVisible = this.settings.radarBenchmarkSettings.show.value;
    this.settings.radarBenchmarkSettings.dashPattern.visible = benchVisible;
    this.settings.radarBenchmarkSettings.color.visible = benchVisible;
    this.settings.radarBenchmarkSettings.lineWidth.visible = benchVisible;

    this.settings.animationSettings.duration.visible = this.settings.animationSettings.enabled.value;

    const conditionalEnabled = this.settings.conditionalFormattingCard.enableConditional.value;
    this.settings.conditionalFormattingCard.conditionalDirection.visible = conditionalEnabled;
    this.settings.conditionalFormattingCard.threshold1.visible = conditionalEnabled;
    this.settings.conditionalFormattingCard.threshold2.visible = conditionalEnabled;
    this.settings.conditionalFormattingCard.conditionalColor1.visible = conditionalEnabled;
    this.settings.conditionalFormattingCard.conditionalColor2.visible = conditionalEnabled;
    this.settings.conditionalFormattingCard.conditionalColor3.visible = conditionalEnabled;

    const categoryIndices = this.extractCategoryIndices(dataView);
    const categories = this.extractCategories(dataView, categoryIndices);
    const categorySelectionIds = this.extractCategorySelectionIds(dataView, categoryIndices);
    const series = this.extractSeries(dataView, categoryIndices);

    const showLegend = this.settings.legendFormattingCard.showLegend.value;
    const hasMultipleSeries = series.length > 1;
    this.settings.legendFormattingCard.visible = hasMultipleSeries;
    this.settings.legendFormattingCard.legendAliases.visible = showLegend && hasMultipleSeries;
    this.settings.legendFormattingCard.showInlineLabels.visible = false;
    this.settings.legendFormattingCard.inlineLabelFontSize.visible = false;
    this.settings.legendFormattingCard.inlineLabelOffset.visible = false;

    // Compute cross-highlight state
    const hasHighlights = series.some(s => s.highlights.some(h => h));
    this.currentData = { categories, categorySelectionIds, series, hasHighlights };

    // Populate per-series formatting groups
    {
      const colorLookup = new Map<string, string>();
      for (const ser of series) {
        colorLookup.set(ser.name, ser.color);
      }
      populateSeriesFormattingGroups(
        this.settings.seriesFormattingCard,
        dataView,
        ['measure'],
        colorLookup,
      );
    }

    if (categories.length === 0 || series.length === 0) {
      this.renderEmpty();
    } else if (categories.length < 3) {
      this.renderInsufficientCategories(categories.length);
    } else {
      this.render(categories, categorySelectionIds, series, options.viewport);
    }

    // Apply card styling AFTER render — render clears the container, which would destroy the glass backdrop div.
    this.applyCardStyling();
    this.applyHighContrastStyles();
    notifyRenderingFinished(this.host, options);
    } catch (error) {
      notifyRenderingFailed(this.host, options, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  // ── Data Extraction ──────────────────────────────────────────────

  private extractCategoryIndices(dataView: DataView | undefined): number[] {
    const catCol = dataView?.categorical?.categories?.[0];
    if (!catCol) return [];
    const dateConfig: DateFilterConfig = {
      enabled: this.settings.dateFilterFormattingCard.enableDateFilter.value,
      startDate: this.normalizeDateBoundary(
        this.settings.dateFilterFormattingCard.startDate.value,
        false,
      ),
      endAtCurrentDate: this.settings.dateFilterFormattingCard.endAtCurrentDate.value,
      endDate: this.normalizeDateBoundary(
        this.settings.dateFilterFormattingCard.endDate.value,
        true,
      ),
    };
    const dateIndices = isDateColumn(catCol.source) ? getDateFilterIndices(catCol.values, dateConfig) : null;
    return catCol.values
      .map((_, index) => index)
      .filter((index) => !dateIndices || dateIndices.has(index));
  }

  private extractCategories(dataView: DataView | undefined, indices: number[]): string[] {
    const catCol = dataView?.categorical?.categories?.[0];
    if (!catCol) return [];
    return indices.map((index) => {
      const value = catCol.values[index];
      return value !== null && value !== undefined ? String(value) : '';
    });
  }

  private extractSeries(dataView: DataView | undefined, filteredIndices: number[]): RadarSeries[] {
    const themeName = resolveColorTheme(this.settings.colorThemeFormattingCard);
    if (!dataView?.categorical?.values || filteredIndices.length === 0) return [];

    const result: RadarSeries[] = [];
    const valueColumns = dataView.categorical.values;
    const useChartPalette = this.settings.radarAppearance.useChartPalette.value;

    for (let si = 0; si < valueColumns.length; si++) {
      const col = valueColumns[si];
      const name = col.source.displayName ?? `Series ${si + 1}`;
      const values: number[] = [];
      const highlights: boolean[] = [];

      // Cross-highlight: read highlight values
      const hlRaw = (col as unknown as { highlights?: unknown }).highlights as unknown[] | undefined;

      for (const i of filteredIndices) {
        const raw = col.values[i];
        values.push(typeof raw === 'number' && Number.isFinite(raw) ? Math.max(0, raw) : 0);
        highlights.push(hlRaw ? hlRaw[i] !== null && hlRaw[i] !== undefined : false);
      }

      result.push({
        name,
        values,
        highlights,
        color: useChartPalette
          ? getHostChartColor(this.host.colorPalette, si, themeName)
          : getChartColor(si, themeName),
      });
    }

    return result;
  }

  private extractCategorySelectionIds(dataView: DataView | undefined, indices: number[]): ISelectionId[] {
    const categoryColumn = dataView?.categorical?.categories?.[0];
    if (!categoryColumn) return [];

    const selectionIds: ISelectionId[] = [];
    for (const index of indices) {
      selectionIds.push(this.host.createSelectionIdBuilder()
        .withCategory(categoryColumn, index)
        .createSelectionId());
    }
    return selectionIds;
  }

  private normalizeDateBoundary(value: string, endOfDay: boolean): string {
    const trimmed = value.trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
      ? `${trimmed}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`
      : value;
  }

  // ── Card Style ─────────────────────────────────────────────────

  private applyCardStyling(): void {
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
    const el = document.createElement('div');
    el.className = 'radar-empty';
    el.textContent = this.hasRequiredFields && this.emptyStateMode === 'noData'
      ? getLocalizedString(this.host, 'RadarChart_NoDataState', 'No data for the current selection.')
      : getLocalizedString(this.host, 'RadarChart_EmptyState', 'Add at least 3 categories and a measure.');
    this.container.appendChild(el);
    applyChartAria(this.container, {
      chartType: 'radar chart',
      dataPointCount: 0,
    });
  }

  private renderInsufficientCategories(categoryCount: number): void {
    this.clearContainer();
    const el = document.createElement('div');
    el.className = 'radar-empty';
    const message = getLocalizedString(
      this.host,
      'RadarChart_InsufficientCategories',
      'Radar charts need at least 3 categories; the current selection has {0}.',
    );
    el.textContent = message.replace('{0}', String(categoryCount));
    this.container.appendChild(el);
    applyChartAria(this.container, {
      chartType: 'radar chart',
      dataPointCount: categoryCount,
    });
  }

  private renderTooSmall(): void {
    this.clearContainer();
    const el = document.createElement('div');
    el.className = 'radar-empty';
    el.textContent = getLocalizedString(
      this.host,
      'RadarChart_ViewportTooSmall',
      'Increase the visual size to display the radar chart.',
    );
    this.container.appendChild(el);
    applyChartAria(this.container, {
      chartType: 'radar chart',
      dataPointCount: 0,
    });
  }

  // ── Main Render ────────────────────────────────────────────────

  private render(
    categories: string[],
    categorySelectionIds: ISelectionId[],
    series: RadarSeries[],
    viewport: powerbi.IViewport,
  ): void {
    this.clearContainer();
    renderChartTitle(this.container, this.settings.titleFormattingCard);

    const s = this.settings;
    const showGrid = s.radarSettings.showGrid.value;
    const gridLevels = Math.max(1, s.radarSettings.gridLevels.value);
    const fillOpacity = Math.max(0, Math.min(100, s.radarAppearance.fillOpacity.value)) / 100;
    const showDots = s.radarAppearance.showDots.value;
    const dotRadius = Math.max(1, s.radarAppearance.dotRadius.value);
    const gridShape = resolveDropdown(s.radarSettings.gridShape) ?? 'polygon';
    const webStrokeColor = s.radarSettings.webStrokeColor.value?.value || '#CBD5E1';
    const webStrokeWidth = Math.max(0.5, s.radarSettings.webStrokeWidth.value);
    const webFillOpacity = Math.max(0, Math.min(100, s.radarSettings.webFillOpacity.value)) / 100;
    const globalSeriesOpacity = Math.max(0, Math.min(100, s.radarAppearance.areaOpacity.value)) / 100;
    const showLegend = s.legendFormattingCard.showLegend.value && series.length > 1;
    const animEnabled = s.animationSettings.enabled.value && !this.currentData?.hasHighlights;
    const animDuration = s.animationSettings.duration.value;

    // Axis formatting
    const axisColor = s.axisFormattingCard.axisLabelColor.value?.value || '#1E293B';
    const axisLabelSize = Math.max(4, s.axisFormattingCard.axisLabelSize.value);
    const axisLabelFontFamily = resolveDropdown(s.axisFormattingCard.axisLabelFontFamily) || undefined;
    const axisLabelFontWeight = resolveDropdown(s.axisFormattingCard.axisLabelFontWeight) || undefined;
    const axisLineColor = s.axisFormattingCard.axisLineColor.value?.value || '#CBD5E1';
    const axisLineWidth = Math.max(0.5, s.axisFormattingCard.axisLineWidth.value);
    const gridLineColor = s.axisFormattingCard.gridLineColor.value?.value || '#E2E8F0';
    const gridLineStyle = resolveDropdown(s.axisFormattingCard.gridLineStyle) ?? 'dashed';
    const gridDashArray = lineStyleToDashArray(gridLineStyle);
    const showAxisLabels = s.radarSettings.showAxisLabels.value;
    const axisLabelCollisionMode = (resolveDropdown(s.radarSettings.axisLabelCollisionHandling) ?? 'auto') as RadarAxisLabelCollisionMode;

    // Legend formatting
    const legendFontColor = s.legendFormattingCard.legendFontColor.value?.value || '#1E293B';
    const legendFontSize = s.legendFormattingCard.legendFontSize.value;
    const legendFontFamily = resolveDropdown(s.legendFormattingCard.legendFontFamily) || undefined;
    const legendFontWeight = resolveDropdown(s.legendFormattingCard.legendFontWeight) || undefined;
    const legendPos = resolveDropdown(s.legendFormattingCard.legendPosition) ?? 'bottom';

    // Series appearance
    const globalLineWidth = s.radarAppearance.lineWidth.value;
    const dotBorderColor = s.radarAppearance.dotBorderColor.value?.value || '#FFFFFF';
    const dotBorderWidth = s.radarAppearance.dotBorderWidth.value;

    // Data label formatting
    const showDataLabels = s.dataLabelFormattingCard.showDataLabels.value;

    const numAxes = categories.length;
    const angleSlice = (2 * Math.PI) / numAxes;

    // User-configurable start angle offset (degrees -> radians)
    const startAngleOffset = (s.radarSettings.startAngle.value * Math.PI) / 180;

    // Independent axis scales: when enabled, each axis gets its own max
    const useIndependentScales = s.radarSettings.independentScales.value;

    // Compute global max value across all series
    let maxVal = 0;
    for (const ser of series) {
      for (const v of ser.values) {
        if (v > maxVal) maxVal = v;
      }
    }
    if (maxVal === 0) maxVal = 1;

    // Per-axis max values (only used when independentScales is on)
    const axisMaxValues: number[] = [];
    if (useIndependentScales) {
      for (let i = 0; i < numAxes; i++) {
        let axisMax = 0;
        for (const ser of series) {
          if (ser.values[i] > axisMax) axisMax = ser.values[i];
        }
        axisMaxValues.push(axisMax > 0 ? axisMax : 1);
      }
    }

    /** Get the max value for a given axis index. */
    const getAxisMax = (axisIndex: number): number =>
      useIndependentScales ? axisMaxValues[axisIndex] : maxVal;

    const contentPadding = Math.max(0, s.cardSettings.contentPadding.value);
    this.container.style.padding = `${contentPadding}px`;
    this.container.style.boxSizing = 'border-box';
    this.container.style.justifyContent = 'flex-start';
    const titleHeight = (s.titleFormattingCard.showTitle.value && s.titleFormattingCard.titleText.value
      ? s.titleFormattingCard.titleFontSize.value * 1.3 + 4
      : 0)
      + (s.titleFormattingCard.subtitleText.value
        ? s.titleFormattingCard.subtitleFontSize.value * 1.3 + 4
        : 0);
    const availableWidth = Math.max(1, viewport.width - contentPadding * 2);
    const availableHeight = Math.max(1, viewport.height - contentPadding * 2 - titleHeight);
    const isLegendHorizontal = legendPos === 'top' || legendPos === 'bottom';
    const isLegendSide = legendPos === 'left' || legendPos === 'right';
    const legendAliases = s.legendFormattingCard.legendAliases.value
      ? s.legendFormattingCard.legendAliases.value.split(',').map((alias) => alias.trim())
      : [];
    const legendLabels = series.map((item, index) => legendAliases[index] || item.name);
    const longestLegendLabel = Math.max(...legendLabels.map((label) => label.length), 0);
    const desiredLegendWidth = Math.ceil(longestLegendLabel * legendFontSize * 0.58 + 30);
    const legendHeight = showLegend && isLegendHorizontal
      ? Math.max(26, Math.ceil(legendFontSize * 1.5 + 8))
      : 0;
    const legendWidth = showLegend && isLegendSide
      ? Math.min(Math.max(72, desiredLegendWidth), Math.max(72, availableWidth * 0.35))
      : 0;
    const svgWidth = Math.max(1, availableWidth - legendWidth);
    const svgHeight = Math.max(1, availableHeight - legendHeight);
    const maxAxisLabelChars = Math.max(
      4,
      Math.floor(Math.max(32, Math.min(svgWidth, svgHeight) * 0.28) / (axisLabelSize * 0.58)),
    );
    const displayCategories = categories.map((category) =>
      category.length > maxAxisLabelChars
        ? `${category.slice(0, Math.max(1, maxAxisLabelChars - 3))}...`
        : category,
    );
    const longestAxisLabel = showAxisLabels
      ? Math.max(...displayCategories.map((category) => category.length), 0) * axisLabelSize * 0.58
      : 0;
    const axisLabelReserve = showAxisLabels
      ? Math.ceil(Math.max(axisLabelSize * 1.4, longestAxisLabel) + Math.max(4, axisLabelSize))
      : 0;
    const radius = Math.min(svgWidth, svgHeight) / 2 - Math.max(8, axisLabelReserve);
    const cx = svgWidth / 2;
    const cy = svgHeight / 2;

    if (radius < 12) {
      this.renderTooSmall();
      return;
    }

    const chartBody = document.createElement('div');
    chartBody.className = 'radar-chart-body';
    chartBody.style.display = 'flex';
    chartBody.style.flexDirection = isLegendHorizontal ? 'column' : 'row';
    chartBody.style.alignItems = 'center';
    chartBody.style.justifyContent = 'center';
    chartBody.style.width = `${availableWidth}px`;
    chartBody.style.height = `${availableHeight}px`;
    chartBody.style.minWidth = '0';
    chartBody.style.minHeight = '0';
    this.container.appendChild(chartBody);

    const svg = d3.select(chartBody)
      .append('svg')
      .attr('width', svgWidth)
      .attr('height', svgHeight);

    const g = svg.append('g')
      .attr('transform', `translate(${cx},${cy})`);
    const chartGroupNode = g.node();

    // ── Grid ──

    if (showGrid) {
      for (let level = 1; level <= gridLevels; level++) {
        const r = (radius / gridLevels) * level;
        if (gridShape === 'circle') {
          g.append('circle')
            .attr('class', 'radar-grid-line')
            .attr('cx', 0)
            .attr('cy', 0)
            .attr('r', r)
            .attr('stroke', gridLineColor)
            .attr('stroke-width', webStrokeWidth)
            .attr('stroke-dasharray', gridDashArray)
            .attr('fill', withOpacity(webStrokeColor, webFillOpacity));
        } else {
          const points = this.buildPolygonPoints(numAxes, angleSlice, r, startAngleOffset);
          g.append('polygon')
            .attr('class', 'radar-grid-line')
            .attr('points', points)
            .attr('stroke', gridLineColor)
            .attr('stroke-width', webStrokeWidth)
            .attr('stroke-dasharray', gridDashArray)
            .attr('fill', withOpacity(webStrokeColor, webFillOpacity));
        }
      }
    }

    // ── Axis lines + labels ──

    const axisLabelPlacements = this.computeAxisLabelPlacements(
      displayCategories,
      radius,
      angleSlice,
      startAngleOffset,
      axisLabelSize,
      axisLabelCollisionMode,
      svgWidth,
      svgHeight,
    );

    for (let i = 0; i < numAxes; i++) {
      const angle = angleSlice * i - Math.PI / 2 + startAngleOffset;
      const x = radius * Math.cos(angle);
      const y = radius * Math.sin(angle);
      const selectionId = categorySelectionIds[i];

      g.append('line')
        .attr('class', 'radar-axis-line')
        .attr('x1', 0).attr('y1', 0)
        .attr('x2', x).attr('y2', y)
        .attr('stroke', axisLineColor)
        .attr('stroke-width', axisLineWidth);

      const placement = axisLabelPlacements[i];
      if (showAxisLabels && placement?.visible) {
        const { x: lx, y: ly, anchor } = placement;

        const labelEl = g.append('text')
          .attr('class', 'radar-axis-label')
          .attr('data-selection-key', selectionId?.getKey() ?? '')
          .attr('x', lx)
          .attr('y', ly)
          .attr('dy', '0.35em')
          .attr('text-anchor', anchor)
          .attr('fill', axisColor)
          .style('font-size', `${axisLabelSize}px`);
        if (axisLabelFontFamily) labelEl.style('font-family', axisLabelFontFamily);
        if (axisLabelFontWeight) labelEl.style('font-weight', axisLabelFontWeight);
        labelEl.text(displayCategories[i]);
        labelEl.attr('aria-label', categories[i]);
        if (selectionId) {
          labelEl
            .style('cursor', allowInteractions(this.host) ? 'pointer' : 'default')
            .on('click', (event: MouseEvent) => {
              event.stopPropagation();
              this.selectCategory(selectionId, event.ctrlKey || event.metaKey);
            })
            .on('contextmenu', (event: MouseEvent) => {
              event.preventDefault();
              event.stopPropagation();
              if (!allowInteractions(this.host)) return;
              void this.selectionManager.showContextMenu(selectionId, {
                x: event.clientX,
                y: event.clientY,
              });
            });
        }
      }
    }

    const axisHitArc = d3.arc<{ startAngle: number; endAngle: number; innerRadius: number; outerRadius: number }>()
      .innerRadius((datum) => datum.innerRadius)
      .outerRadius((datum) => datum.outerRadius);
    const axisHitAreas = g.append('g')
      .attr('class', 'radar-axis-hit-areas');
    for (let i = 0; i < numAxes; i++) {
      const selectionId = categorySelectionIds[i];
      if (!selectionId) continue;

      // d3.arc uses 0=top, clockwise — same convention as our axis layout
      // (axis i is centered at angle `i*angleSlice + startAngleOffset` from top).
      // The previous `- Math.PI / 2` rotated every wedge a quarter-turn CCW,
      // so each click was selecting the category one slot clockwise of where
      // the user actually clicked.
      const hitArea = axisHitAreas.append('path')
        .attr('class', 'radar-axis-hit-area')
        .attr('data-selection-key', selectionId.getKey())
        .attr('d', axisHitArc({
          startAngle: angleSlice * i - angleSlice / 2 + startAngleOffset,
          endAngle: angleSlice * i + angleSlice / 2 + startAngleOffset,
          innerRadius: radius + 2,
          outerRadius: Math.min(Math.min(svgWidth, svgHeight) / 2 - 1, radius + 30),
        }) ?? '')
        .attr('fill', 'transparent')
        .style('cursor', allowInteractions(this.host) ? 'pointer' : 'default')
        .on('click', (event: MouseEvent) => {
          event.stopPropagation();
          this.selectCategory(selectionId, event.ctrlKey || event.metaKey);
        })
        .on('contextmenu', (event: MouseEvent) => {
          event.preventDefault();
          event.stopPropagation();
          if (!allowInteractions(this.host)) return;
          void this.selectionManager.showContextMenu(selectionId, {
            x: event.clientX,
            y: event.clientY,
          });
        })
        .on('mouseenter', (event: MouseEvent) => {
          this.showAxisTooltip(categories[i], i, series, selectionId, event);
        })
        .on('mousemove', (event: MouseEvent) => {
          this.moveTooltip(event);
        })
        .on('mouseleave', () => {
          this.hideTooltip();
        });
      const hitAreaNode = hitArea.node();
      if (hitAreaNode && s.accessibilityFormattingCard.enableKeyboardNav.value) {
        const ariaValue = series
          .map((item) => `${item.name} ${formatWithSettings(item.values[i], s.numberFormattingCard)}`)
          .join(', ');
        applyDataPointAria(hitAreaNode, categories[i], ariaValue, i, numAxes);
      }
    }

    // ── Benchmark overlay (behind series, in front of grid) ──
    this.renderBenchmarkOverlay(g, series, numAxes, angleSlice, radius, maxVal, startAngleOffset, getAxisMax);

    // ── Series polygons ──

    for (let si = 0; si < series.length; si++) {
      const ser = series[si];
      const sf = resolveSeriesFormatting(this.settings.seriesFormattingCard, si, ser.color);
      const seriesColor = sf.color;
      const seriesOpacity = (sf.opacity / 100) * globalSeriesOpacity;
      const seriesLineStyle = lineStyleToDashArray(sf.lineStyle);
      const seriesLineWidth = sf.lineWidth > 0 && sf.lineWidth !== 2
        ? sf.lineWidth
        : globalLineWidth;
      const points: Array<[number, number]> = [];

      for (let i = 0; i < numAxes; i++) {
        const angle = angleSlice * i - Math.PI / 2 + startAngleOffset;
        const r = (ser.values[i] / getAxisMax(i)) * radius;
        points.push([r * Math.cos(angle), r * Math.sin(angle)]);
      }

      // Polygon fill
      const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ') + ' Z';

      const polygon = g.append('path')
        .attr('class', 'radar-polygon')
        .attr('data-series-index', si)
        .attr('d', pathData)
        .attr('fill', seriesColor)
        .attr('fill-opacity', fillOpacity * seriesOpacity)
        .attr('stroke', seriesColor)
        .attr('stroke-opacity', seriesOpacity)
        .attr('stroke-width', seriesLineWidth)
        .attr('stroke-dasharray', seriesLineStyle);

      // Hover: brightness boost + soft glow
      polygon
        .style('transition', 'filter 0.2s ease, opacity 0.15s ease')
        .style('cursor', allowInteractions(this.host) ? 'pointer' : 'default')
        .on('mouseenter', (event: MouseEvent) => {
          polygon.style('filter', `brightness(1.2) drop-shadow(0 0 6px ${seriesColor})`);
          this.showSeriesTooltip(ser, event);
        })
        .on('mousemove', (event: MouseEvent) => {
          this.moveTooltip(event);
        })
        .on('mouseleave', () => {
          polygon.style('filter', 'none');
          this.hideTooltip();
        })
        .on('click', (event: MouseEvent) => {
          if (!chartGroupNode) return;
          const selectionId = this.getCategorySelectionIdFromPointer(
            event,
            chartGroupNode,
            angleSlice,
            startAngleOffset,
            categorySelectionIds,
          );
          if (!selectionId) return;
          event.stopPropagation();
          this.selectCategory(selectionId, event.ctrlKey || event.metaKey);
        })
        .on('contextmenu', (event: MouseEvent) => {
          if (!allowInteractions(this.host)) return;
          if (!chartGroupNode) return;
          const selectionId = this.getCategorySelectionIdFromPointer(
            event,
            chartGroupNode,
            angleSlice,
            startAngleOffset,
            categorySelectionIds,
          );
          if (!selectionId) return;
          event.preventDefault();
          event.stopPropagation();
          void this.selectionManager.showContextMenu(selectionId, {
            x: event.clientX,
            y: event.clientY,
          });
        });

      // Animation: morph from center
      if (animEnabled && animDuration > 0) {
        const zeroPoints = new Array(numAxes).fill('0,0');
        const zeroPath = 'M' + zeroPoints.join(' L') + ' Z';
        const finalPath = pathData;

        polygon.attr('d', zeroPath);

        const delay = si * DURATION.stagger * 2;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        let cancelAnim: (() => void) | null = null;

        timeoutId = setTimeout(() => {
          cancelAnim = animate(animDuration, cubicOut, (progress) => {
            const interp: string[] = [];
            for (let i = 0; i < numAxes; i++) {
              const x = points[i][0] * progress;
              const y = points[i][1] * progress;
              interp.push(`${i === 0 ? 'M' : 'L'}${x},${y}`);
            }
            polygon.attr('d', interp.join(' ') + ' Z');
          }, () => {
            polygon.attr('d', finalPath);
          });
        }, delay);

        this.cancelAnimations.push(() => {
          if (timeoutId !== null) clearTimeout(timeoutId);
          cancelAnim?.();
        });
      }

      // Dots
      if (showDots) {
        for (let i = 0; i < numAxes; i++) {
          const dotConditionalFill = this.getConditionalColor(ser.values[i]);
          const dot = g.append('circle')
            .attr('class', 'radar-dot')
            .attr('cx', points[i][0])
            .attr('cy', points[i][1])
            .attr('r', dotRadius)
            .attr('fill', dotConditionalFill ?? seriesColor)
            .attr('fill-opacity', seriesOpacity)
            .attr('stroke', dotBorderColor)
            .attr('stroke-opacity', seriesOpacity)
            .attr('stroke-width', dotBorderWidth)
            .attr('data-selection-key', categorySelectionIds[i]?.getKey() ?? '')
            .attr('data-axis-index', i)
            .style('cursor', allowInteractions(this.host) ? 'pointer' : 'default');

          const pointCategory = categories[i];
          const pointValue = ser.values[i];
          dot
            .on('mouseenter', (event: MouseEvent) => {
              this.showPointTooltip(pointCategory, ser.name, pointValue, categorySelectionIds[i], event);
            })
            .on('mousemove', (event: MouseEvent) => {
              this.moveTooltip(event);
            })
            .on('mouseleave', () => {
              this.hideTooltip();
            });

          const selectionId = categorySelectionIds[i];
          if (selectionId) {
            dot
              .on('click', (event: MouseEvent) => {
                event.stopPropagation();
                this.selectCategory(selectionId, event.ctrlKey || event.metaKey);
              })
              .on('contextmenu', (event: MouseEvent) => {
                event.preventDefault();
                event.stopPropagation();
                if (!allowInteractions(this.host)) return;
                void this.selectionManager.showContextMenu(selectionId, {
                  x: event.clientX,
                  y: event.clientY,
                });
              });
          }

          if (animEnabled) {
            const dotNode = dot.node();
            if (dotNode) {
              const delay = si * DURATION.stagger * 2 + animDuration * 0.5 + i * 30;
              const cancel = popIn(dotNode, delay, 400);
              this.cancelAnimations.push(cancel);
            }
          }
        }
      }

      // Data labels
      if (showDataLabels && sf.showLabels) {
        for (let i = 0; i < numAxes; i++) {
          const angle = angleSlice * i - Math.PI / 2 + startAngleOffset;
          const labelR = (ser.values[i] / getAxisMax(i)) * radius + dotRadius + 6;
          const lx = labelR * Math.cos(angle);
          const ly = labelR * Math.sin(angle);
          const dataLabel = g.append('text')
            .attr('class', 'radar-data-label')
            .attr('data-selection-key', categorySelectionIds[i]?.getKey() ?? '')
            .attr('x', lx)
            .attr('y', ly)
            .attr('dy', '0.35em')
            .attr('text-anchor', 'middle')
            .text(formatWithSettings(ser.values[i], this.settings.numberFormattingCard));

          if (animEnabled) {
            dataLabel.attr('opacity', 0);
            const labelDelay = si * DURATION.stagger * 2 + animDuration * 0.8 + i * 30;
            let labelTimeoutId: ReturnType<typeof setTimeout> | null = null;
            let cancelLabelAnim: (() => void) | null = null;

            labelTimeoutId = setTimeout(() => {
              cancelLabelAnim = animate(DURATION.fast, cubicOut, (progress) => {
                dataLabel.attr('opacity', progress);
              });
            }, labelDelay);

            this.cancelAnimations.push(() => {
              if (labelTimeoutId !== null) clearTimeout(labelTimeoutId);
              cancelLabelAnim?.();
            });
          }
        }
      }
    }

    // ── Legend ──

    if (showLegend && series.length > 1) {
      const legend = document.createElement('div');
      legend.className = 'radar-legend';
      legend.style.display = 'flex';
      legend.style.justifyContent = 'center';
      legend.style.gap = '12px';
      legend.style.padding = `${Math.max(2, Math.round(contentPadding / 10))}px`;
      legend.style.boxSizing = 'border-box';
      legend.style.minWidth = '0';
      if (legendPos === 'left' || legendPos === 'right') {
        legend.style.flexDirection = 'column';
        legend.style.alignItems = 'flex-start';
        legend.style.width = `${legendWidth}px`;
        legend.style.maxHeight = `${availableHeight}px`;
        legend.style.overflowY = 'auto';
      } else {
        legend.style.width = `${availableWidth}px`;
        legend.style.height = `${legendHeight}px`;
        legend.style.overflowX = 'auto';
        legend.style.flexShrink = '0';
      }

      for (let li = 0; li < series.length; li++) {
        const ser = series[li];
        const legendSf = resolveSeriesFormatting(this.settings.seriesFormattingCard, li, ser.color);
        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.gap = '4px';
        item.style.minWidth = '0';
        item.style.flexShrink = '0';

        const swatch = document.createElement('div');
        swatch.style.width = '10px';
        swatch.style.height = '10px';
        swatch.style.borderRadius = '2px';
        swatch.style.backgroundColor = legendSf.color;

        const label = document.createElement('span');
        label.style.fontSize = `${legendFontSize}px`;
        label.style.color = legendFontColor;
        if (legendFontFamily) label.style.fontFamily = legendFontFamily;
        if (legendFontWeight) label.style.fontWeight = legendFontWeight;
        label.style.overflow = 'hidden';
        label.style.textOverflow = 'ellipsis';
        label.style.whiteSpace = 'nowrap';
        label.style.maxWidth = legendPos === 'left' || legendPos === 'right'
          ? `${Math.max(24, legendWidth - 22)}px`
          : `${Math.max(48, availableWidth * 0.3)}px`;
        label.textContent = legendLabels[li];
        label.title = legendLabels[li];

        item.appendChild(swatch);
        item.appendChild(label);
        legend.appendChild(item);
      }

      if (legendPos === 'top' || legendPos === 'left') {
        chartBody.insertBefore(legend, svg.node());
      } else {
        chartBody.appendChild(legend);
      }

      if (animEnabled) {
        const cancel = fadeSlideIn(legend, 'up', DURATION.fast, animDuration * 0.5);
        this.cancelAnimations.push(cancel);
      }
    }

    // Apply shared data label formatting
    applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.radar-data-label');

    // Axis values, hover behavior
    this.renderAxisValues(g, gridLevels, radius, maxVal, axisLineColor, axisLabelSize, startAngleOffset, numAxes, angleSlice, getAxisMax);
    this.applyHoverDimBehavior();
    this.applyCrossHighlight();
    this.applyAccessibility();
    this.container.addEventListener('click', this.handleBackgroundClick);
  }

  // ── Helpers ──────────────────────────────────────────────────────

  private computeAxisLabelPlacements(
    categories: string[],
    radius: number,
    angleSlice: number,
    startAngleOffset: number,
    axisLabelSize: number,
    collisionMode: RadarAxisLabelCollisionMode,
    svgWidth: number,
    svgHeight: number,
  ): RadarAxisLabelPlacement[] {
    const placedBoxes: Array<{ left: number; right: number; top: number; bottom: number }> = [];
    const labelGap = 4;
    const useStagger = collisionMode === 'auto' && categories.length > 10;
    const fontSize = Math.max(4, axisLabelSize);
    const labelPadding = Math.max(4, fontSize);
    const halfWidth = svgWidth / 2;
    const halfHeight = svgHeight / 2;

    return categories.map((label, index) => {
      const angle = angleSlice * index - Math.PI / 2 + startAngleOffset;
      const labelR = radius + labelPadding + (useStagger ? (index % 2) * Math.max(8, fontSize * 1.25) : 0);
      let x = labelR * Math.cos(angle);
      let y = labelR * Math.sin(angle);
      const anchor: 'start' | 'middle' | 'end' = Math.abs(x) < 1 ? 'middle' : x > 0 ? 'start' : 'end';

      if (collisionMode === 'none') {
        return { x, y, anchor, visible: true };
      }

      const width = Math.max(fontSize, String(label).length * fontSize * 0.58);
      const height = fontSize * 1.2;
      const getBox = () => {
        const left = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x;
        const right = left + width;
        const top = y - height / 2;
        const bottom = y + height / 2;
        return { left, right, top, bottom };
      };

      let rawBox = getBox();
      if (rawBox.left < -halfWidth) x += -halfWidth - rawBox.left;
      if (rawBox.right > halfWidth) x -= rawBox.right - halfWidth;
      rawBox = getBox();
      if (rawBox.top < -halfHeight) y += -halfHeight - rawBox.top;
      if (rawBox.bottom > halfHeight) y -= rawBox.bottom - halfHeight;
      rawBox = getBox();

      const box = {
        left: rawBox.left - labelGap,
        right: rawBox.right + labelGap,
        top: rawBox.top - labelGap,
        bottom: rawBox.bottom + labelGap,
      };
      const overlaps = placedBoxes.some((placed) =>
        box.left < placed.right &&
        box.right > placed.left &&
        box.top < placed.bottom &&
        box.bottom > placed.top,
      );
      if (!overlaps) placedBoxes.push(box);

      return { x, y, anchor, visible: !overlaps };
    });
  }

  private buildPolygonPoints(numAxes: number, angleSlice: number, radius: number, angleOffset: number = 0): string {
    const pts: string[] = [];
    for (let i = 0; i < numAxes; i++) {
      const angle = angleSlice * i - Math.PI / 2 + angleOffset;
      pts.push(`${radius * Math.cos(angle)},${radius * Math.sin(angle)}`);
    }
    return pts.join(' ');
  }

  // ── Formatting Model ───────────────────────────────────────────

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  // ── Utilities ──────────────────────────────────────────────────

  private clearContainer(): void {
    this.hideTooltip();
    this.container.removeEventListener('click', this.handleBackgroundClick);
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    // Reset layout state before calculating the next viewport.
    this.container.style.flexDirection = 'column';
    this.container.style.padding = '';
    this.container.style.justifyContent = 'center';
  }

  private cancelAllAnimations(): void {
    for (const cancel of this.cancelAnimations) cancel();
    this.cancelAnimations = [];
  }

  private applyHighContrastStyles(): void {
    const colors = getHostHighContrastColors(this.host);
    applyBasicHighContrastStyles(this.container, colors, {
      textSelectors: [
        'svg text',
        '.radar-empty',
        '.radar-legend span',
        '.chart-title',
        '.chart-subtitle',
      ],
      lineSelectors: ['.radar-axis-line'],
      strokeSelectors: ['.radar-grid-line', '.radar-benchmark'],
    });
    if (!colors.enabled) {
      this.applyCardStyling();
      return;
    }

    this.container.querySelectorAll<SVGPathElement>('.radar-polygon').forEach((polygon) => {
      polygon.setAttribute('fill', colors.foregroundSelected);
      polygon.setAttribute('fill-opacity', '0.2');
      polygon.setAttribute('stroke', colors.foregroundSelected);
    });
    this.container.querySelectorAll<SVGCircleElement>('.radar-dot').forEach((dot) => {
      dot.setAttribute('fill', colors.foregroundSelected);
      dot.setAttribute('stroke', colors.background);
    });
    this.container.querySelectorAll<HTMLElement>('.radar-legend div > div:first-child').forEach((swatch) => {
      swatch.style.backgroundColor = colors.foregroundSelected;
      swatch.style.border = `1px solid ${colors.foreground}`;
    });
  }

  // ── Cross-Highlight ──────────────────────────────────────────────

  private applyCrossHighlight(): void {
    const data = this.currentData;
    if (!data) return;

    const hasHighlights = data.hasHighlights;
    const hasSelection = this.selectionManager.hasSelection();
    const selectedIds = this.selectionManager.getSelectionIds() as ISelectionId[];
    const selectedKeys = new Set(selectedIds.map((id) => id.getKey()));

    // Build set of highlighted axis indices from cross-highlight data
    const highlightedAxisIndices = new Set<number>();
    if (hasHighlights) {
      for (const ser of data.series) {
        ser.highlights.forEach((h, i) => { if (h) highlightedAxisIndices.add(i); });
      }
    }
    const highlightedKeys = new Set<string>();
    for (const idx of highlightedAxisIndices) {
      if (data.categorySelectionIds[idx]) {
        highlightedKeys.add(data.categorySelectionIds[idx].getKey());
      }
    }

    const shouldDim = hasSelection || hasHighlights;

    // Polygons span every category, so category selection should not make the
    // entire shape fade. Cross-highlighting may still dim a series that has no
    // highlighted points at all.
    const polygons = this.container.querySelectorAll<SVGPathElement>('.radar-polygon');
    for (const el of Array.from(polygons)) {
      if (hasHighlights) {
        const seriesIdx = parseInt(el.getAttribute('data-series-index') ?? '-1', 10);
        const ser = data.series[seriesIdx];
        const seriesHasHighlight = ser ? ser.highlights.some(h => h) : false;
        el.style.opacity = seriesHasHighlight ? '' : '0.3';
      } else {
        el.style.opacity = '';
      }
    }

    const categoryElements = this.container.querySelectorAll<SVGElement>(
      '.radar-dot[data-selection-key], '
      + '.radar-axis-label[data-selection-key], '
      + '.radar-axis-hit-area[data-selection-key], '
      + '.radar-data-label[data-selection-key]',
    );
    for (const el of Array.from(categoryElements)) {
      if (shouldDim) {
        const elKey = el.getAttribute('data-selection-key');
        const isSelected = hasSelection && elKey !== null && selectedKeys.has(elKey);
        const isHighlighted = hasHighlights && elKey !== null && highlightedKeys.has(elKey);
        const dimOpacity = el.classList.contains('radar-axis-label') ? '0.45' : '0.3';
        el.style.opacity = (isSelected || isHighlighted) ? '' : dimOpacity;
      } else {
        el.style.opacity = '';
      }
    }
  }

  private selectCategory(selectionId: ISelectionId, multiSelect: boolean): void {
    if (!allowInteractions(this.host)) return;
    void this.selectionManager.select(selectionId, multiSelect).then(() => {
      this.applyCrossHighlight();
    });
  }

  private getCategorySelectionIdFromPointer(
    event: MouseEvent,
    chartGroupNode: SVGGElement,
    angleSlice: number,
    startAngleOffset: number,
    categorySelectionIds: ISelectionId[],
  ): ISelectionId | undefined {
    let x: number;
    let y: number;

    if (typeof chartGroupNode.getScreenCTM === 'function') {
      [x, y] = d3.pointer(event, chartGroupNode);
    } else {
      const svg = chartGroupNode.ownerSVGElement;
      const svgWidth = Number(svg?.getAttribute('width') ?? 0);
      const svgHeight = Number(svg?.getAttribute('height') ?? 0);
      x = event.clientX - (svgWidth / 2);
      y = event.clientY - (svgHeight / 2);
    }

    if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;

    const normalizedAngle = ((Math.atan2(y, x) + Math.PI / 2 - startAngleOffset) % (2 * Math.PI) + (2 * Math.PI)) % (2 * Math.PI);
    const index = Math.floor((normalizedAngle + angleSlice / 2) / angleSlice) % categorySelectionIds.length;
    return categorySelectionIds[index];
  }

  private handleBackgroundClick = (): void => {
    if (!allowInteractions(this.host)) return;
    void this.selectionManager.clear().then(() => {
      this.applyCrossHighlight();
    });
  };

  private showSeriesTooltip(ser: RadarSeries, event: MouseEvent): void {
    const tooltipData: VisualTooltipDataItem[] = [
      { displayName: 'Series', value: ser.name },
    ];

    this.host.tooltipService.show({
      dataItems: tooltipData,
      identities: [],
      coordinates: [event.clientX, event.clientY],
      isTouchEvent: false,
    });
  }

  private showAxisTooltip(
    category: string,
    axisIndex: number,
    series: RadarSeries[],
    selectionId: ISelectionId,
    event: MouseEvent,
  ): void {
    const tooltipData: VisualTooltipDataItem[] = [
      { displayName: 'Category', value: category },
      ...series.map((item) => ({
        displayName: item.name,
        value: formatWithSettings(item.values[axisIndex], this.settings.numberFormattingCard),
      })),
    ];
    this.host.tooltipService.show({
      dataItems: tooltipData,
      identities: [selectionId],
      coordinates: [event.clientX, event.clientY],
      isTouchEvent: false,
    });
  }

  private showPointTooltip(
    category: string,
    seriesName: string,
    value: number,
    selectionId: ISelectionId | undefined,
    event: MouseEvent,
  ): void {
    const tooltipData: VisualTooltipDataItem[] = [
      { displayName: 'Category', value: category },
      { displayName: 'Series', value: seriesName },
      { displayName: 'Value', value: formatWithSettings(value, this.settings.numberFormattingCard) },
    ];

    this.host.tooltipService.show({
      dataItems: tooltipData,
      identities: selectionId ? [selectionId] : [],
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

  // Render lifecycle notifications removed — Power BI's eventService.renderingStarted()
  // requires VisualUpdateOptions with updateId, and calling without args crashes the visual.

  // ── Conditional Formatting ───────────────────────────────────

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

  // -- Benchmark Overlay -------------------------------------------------------

  /**
   * Renders a benchmark polygon at the average value across all series per axis.
   * Styled with the user-configured color and dash pattern from benchmark settings.
   * Drawn behind data series but in front of the grid (inserted before series polygons).
   */
  private renderBenchmarkOverlay(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    series: RadarSeries[],
    numAxes: number,
    angleSlice: number,
    radius: number,
    _maxVal: number,
    startAngleOffset: number = 0,
    getAxisMax: (i: number) => number = () => _maxVal,
  ): void {
    const benchmarkSettings = this.settings.radarBenchmarkSettings;
    if (!benchmarkSettings.show.value || series.length === 0 || numAxes < 3) return;

    // Compute the average value per axis across all series
    const avgValues: number[] = [];
    for (let i = 0; i < numAxes; i++) {
      let sum = 0;
      for (const ser of series) {
        sum += ser.values[i];
      }
      avgValues.push(sum / series.length);
    }

    const color = benchmarkSettings.color.value?.value ?? '#94A3B8';
    const dashStyle = resolveDropdown(benchmarkSettings.dashPattern) ?? 'dashed';
    const dashArray = lineStyleToDashArray(dashStyle);
    const benchLineWidth = benchmarkSettings.lineWidth.value;

    const points: Array<[number, number]> = [];
    for (let i = 0; i < numAxes; i++) {
      const angle = angleSlice * i - Math.PI / 2 + startAngleOffset;
      const r = (avgValues[i] / getAxisMax(i)) * radius;
      points.push([r * Math.cos(angle), r * Math.sin(angle)]);
    }

    const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ') + ' Z';

    g.append('path')
      .attr('class', 'radar-benchmark')
      .attr('d', pathData)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', benchLineWidth)
      .attr('stroke-dasharray', dashArray);
  }

  // -- Axis Value Labels ------------------------------------------------------

  private renderAxisValues(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    gridLevels: number,
    radius: number,
    maxVal: number,
    axisColor: string,
    axisLabelSize: number,
    startAngleOffset: number = 0,
    numAxes: number = 0,
    angleSlice: number = 0,
    getAxisMax: (i: number) => number = () => maxVal,
  ): void {
    const displaySettings = this.settings.radarSettings;
    if (!displaySettings.showAxisValues.value) return;

    const useIndependentScales = displaySettings.independentScales.value;
    const fontSize = `${Math.max(4, axisLabelSize - 2)}px`;

    if (useIndependentScales && numAxes > 0) {
      // Show per-axis max labels at the tip of each axis
      for (let i = 0; i < numAxes; i++) {
        const angle = angleSlice * i - Math.PI / 2 + startAngleOffset;
        const axisMax = getAxisMax(i);
        for (let level = 1; level <= gridLevels; level++) {
          const r = (radius / gridLevels) * level;
          const value = (axisMax / gridLevels) * level;
          g.append('text')
            .attr('class', 'radar-axis-value')
            .attr('x', r * Math.cos(angle) + 4)
            .attr('y', r * Math.sin(angle))
            .attr('fill', axisColor)
            .style('font-size', fontSize)
            .text(formatWithSettings(value, this.settings.numberFormattingCard));
        }
      }
    } else {
      // Uniform scale: show values along the first axis
      const baseAngle = -Math.PI / 2 + startAngleOffset;
      for (let level = 1; level <= gridLevels; level++) {
        const r = (radius / gridLevels) * level;
        const value = (maxVal / gridLevels) * level;
        g.append('text')
          .attr('class', 'radar-axis-value')
          .attr('x', r * Math.cos(baseAngle) + 4)
          .attr('y', r * Math.sin(baseAngle))
          .attr('fill', axisColor)
          .style('font-size', fontSize)
          .text(formatWithSettings(value, this.settings.numberFormattingCard));
      }
    }
  }

  // -- Hover Dim/Isolate ------------------------------------------------------

  private applyHoverDimBehavior(): void {
    const interactionSettings = this.settings.radarInteractionSettings;
    if (!interactionSettings.hoverDim.value) return;

    const polygons = this.container.querySelectorAll('.radar-polygon');
    if (polygons.length > 0) {
      createHoverDim({
        elements: polygons,
        dimOpacity: 0.15,
      });
    }
  }

  // -- Accessibility ----------------------------------------------------------

  private applyAccessibility(): void {
    const a11y = this.settings.accessibilityFormattingCard;
    if (a11y.enableKeyboardNav.value) {
      ensureFocusRingStyles();
      const cleanup = attachKeyboardNav({
        container: this.container,
        itemSelector: '.radar-axis-hit-area[tabindex="0"]',
        onActivate: (el: Element) => {
          el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        },
      });
      this.cancelAnimations.push(cleanup);
    }
    applyChartAria(this.container, {
      chartType: 'radar chart',
      dataPointCount: this.container.querySelectorAll('.radar-axis-hit-area').length,
    });
  }

  public destroy(): void {
    this.removeEmptySpaceContextMenu?.();
    this.removeEmptySpaceContextMenu = null;
    this.cancelAllAnimations();
    this.clearContainer();
  }
}
