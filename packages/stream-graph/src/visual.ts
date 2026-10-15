/**
 * Stream Graph — Power BI IVisual implementation.
 * Stacked area layers flowing around a central baseline using d3.stack offsets.
 */

import powerbi from 'powerbi-visuals-api';
import * as d3 from 'd3';
import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel';
import { StreamGraphSettings } from './settings';
import {
  animate,
  fadeSlideIn,
  cubicOut,
  DURATION,
  applyCardStyle,
  type CardStyleMode,
  getHostChartColor,
  withOpacity,
  renderChartTitle,
  applyAxisFormatting,
  applyGridFormatting,
  applyAllAxisFormatting,
  applyDataLabelFormatting,
  resolveDropdown,
  renderLegend,
  attachCrosshair,
  buildCrosshairConfig,
  type LegendItem,
  resolveColorTheme,
  buildConditionalConfig,
  resolveConditionalColor,
  applyChartAria,
  attachKeyboardNav,
  ensureFocusRingStyles,
  renderHorizontalReferenceLine,
  computeStatValue,
  type StatType,
  renderTrendLine,
  computeRegression,
  type TrendType,
  renderAnnotations,
  buildAnnotationConfig,
  resolveSeriesFormatting,
  populateSeriesFormattingGroups,
  getDateFilterIndices,
  isDateColumn,
  type DateFilterConfig,
  formatWithSettings,
  buildHighlightedCategoryKeys,
  applyLinkedState,
  buildCategoryBands,
  syncLegendFormattingVisibility,
  syncTitleFormattingVisibility,
  syncCardStyleVisibility,
  attachEmptySpaceContextMenu,
  getVisualEmptyStateMode,
  getLocalizedString,
  allowInteractions,
  getHostHighContrastColors,
  applyBasicHighContrastStyles,
  notifyRenderingStarted,
  notifyRenderingFinished,
  notifyRenderingFailed,
  prefersReducedMotion,
} from '../../core/src';

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataView = powerbi.DataView;
import ISelectionId = powerbi.visuals.ISelectionId;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

import '../style/visual.less';

// ── Internal Types ───────────────────────────────────────────────

/** One row of the data matrix: category label + series values keyed by name. */
interface StreamRow {
  categoryIndex: number;
  categoryLabel: string;
  [seriesName: string]: string | number;
}

/** Parsed data ready for d3.stack. */
interface StreamData {
  rows: StreamRow[];
  seriesNames: string[];
  /** Original measure-column index for each current series position. */
  seriesSourceIndices: number[];
  categoryLabels: string[];
  categorySelectionIds: ISelectionId[];
  /** Whether cross-highlight data is present from another visual/slicer */
  hasHighlights: boolean;
  /** Per-series: true if any highlight is non-null for that series */
  seriesHighlighted: boolean[];
  /** Per-series highlight arrays aligned with rows. */
  seriesHighlights: Array<(number | null)[]>;
}

type OffsetType = 'wiggle' | 'silhouette' | 'expand' | 'none';
type CurveType = 'basis' | 'monotoneX' | 'cardinal';
type LegendPosition = 'top' | 'bottom' | 'left' | 'right';

// ── Constants ────────────────────────────────────────────────────

const MARGIN = { top: 10, right: 10, bottom: 30, left: 10 };
const LEGEND_HEIGHT = 28;
const LEGEND_SIDE_WIDTH = 90;
const EMPTY_STATE_TEXT = 'Add a Category field and at least one Measure to build the stream graph.';
let streamGraphInstanceCounter = 0;

// ── Offset & Curve Maps ─────────────────────────────────────────

const OFFSET_MAP = {
  wiggle: d3.stackOffsetWiggle,
  silhouette: d3.stackOffsetSilhouette,
  expand: d3.stackOffsetExpand,
  none: d3.stackOffsetNone,
} as const;

const CURVE_MAP: Record<CurveType, d3.CurveFactory> = {
  basis: d3.curveBasis,
  monotoneX: d3.curveMonotoneX,
  cardinal: d3.curveCardinal,
};

// ── Visual ───────────────────────────────────────────────────────

export class StreamGraphVisual implements IVisual {
  private host: IVisualHost;
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private container: HTMLElement;
  private settings: StreamGraphSettings;
  private formattingSettingsService: FormattingSettingsService;
  private cancelAnimations: Array<() => void> = [];
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
  private currentData: StreamData | null = null;
  private emptyStateMode: 'unconfigured' | 'noData' = 'unconfigured';
  private readonly instanceId = ++streamGraphInstanceCounter;
  private readonly detachEmptySpaceContextMenu: () => void;

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new StreamGraphSettings();
    this.formattingSettingsService = new FormattingSettingsService(options.host.createLocalizationManager());
    this.container.classList.add('stream-container');
    this.detachEmptySpaceContextMenu = attachEmptySpaceContextMenu(
      this.container,
      this.selectionManager,
      () => this.host.createSelectionIdBuilder().createSelectionId(),
      () => allowInteractions(this.host),
    );
  }

  public update(options: VisualUpdateOptions): void {
    notifyRenderingStarted(this.host, options);
    try {
      this.updateVisual(options);
      this.applyHighContrast();
      notifyRenderingFinished(this.host, options);
    } catch (error) {
      notifyRenderingFailed(this.host, options, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private updateVisual(options: VisualUpdateOptions): void {
    // Cancel running animations
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];

    // Parse settings from dataView
    const dataView = options.dataViews?.[0];
    this.emptyStateMode = getVisualEmptyStateMode(dataView);
    if (dataView) {
      this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
        StreamGraphSettings,
        dataView,
      );
    }

    // Migrate legacy enableGlass -> cardStyleMode (backward compat)
    const legacyCardObj = dataView?.metadata?.objects?.['cardSettings'];
    if (legacyCardObj) {
      const legacyGlass = legacyCardObj['enableGlass'];
      if (legacyGlass === false && legacyCardObj['cardStyleMode'] == null) {
        this.settings.cardSettings.cardStyleMode.value = { value: 'none', displayName: 'None' };
      }
    }

    // Hide shared axis toggles that are shadowed by local settings

    // Date filter: hide start/end when disabled
    this.settings.dateFilterFormattingCard.startDate.visible = this.settings.dateFilterFormattingCard.enableDateFilter.value;
    this.settings.dateFilterFormattingCard.endAtCurrentDate.visible = this.settings.dateFilterFormattingCard.enableDateFilter.value;
    this.settings.dateFilterFormattingCard.endDate.visible = this.settings.dateFilterFormattingCard.enableDateFilter.value && !this.settings.dateFilterFormattingCard.endAtCurrentDate.value;

    syncTitleFormattingVisibility(this.settings.titleFormattingCard);
    syncLegendFormattingVisibility(this.settings.legendFormattingCard);
    syncCardStyleVisibility(this.settings.cardSettings);

    this.settings.axisFormattingCard.showXAxis.visible = false;
    this.settings.axisFormattingCard.showYAxis.visible = false;
    this.settings.axisFormattingCard.showGridLines.visible = false;
    this.settings.axisFormattingCard.yAxisMin.visible = false;
    this.settings.axisFormattingCard.yAxisMax.visible = false;
    this.settings.axisFormattingCard.integerTicks.visible = false;
    this.settings.axisFormattingCard.xAxisTitle.visible = this.settings.streamDisplaySettings.showXAxis.value;
    this.settings.axisFormattingCard.axisLabelRotation.visible = this.settings.streamDisplaySettings.showXAxis.value;
    this.settings.axisFormattingCard.yAxisTitle.visible = this.settings.streamDisplaySettings.showYAxis.value;
    this.settings.axisFormattingCard.gridLineColor.visible = false;
    this.settings.axisFormattingCard.gridLineStyle.visible = false;
    this.settings.axisFormattingCard.gridLineWidth.visible = false;
    this.settings.axisFormattingCard.gridLineOpacity.visible = false;
    this.settings.lineStrokeFormattingCard.lineWidth.visible = false;

    // Hide dual-axis-only properties (no combo/dual-axis support)
    this.settings.referenceLineFormattingCard.referenceLineAxis.visible = false;
    this.settings.referenceLineFormattingCard.referenceBandWidth.visible = false;
    this.settings.trendLineFormattingCard.trendLineAxis.visible = false;

    // Conditional visibility: hide annotation sub-settings when annotations are off
    const annVisible = this.settings.annotationFormattingCard.showAnnotations.value;
    this.settings.annotationFormattingCard.annotation1Category.visible = annVisible;
    this.settings.annotationFormattingCard.annotation1Text.visible = annVisible;
    this.settings.annotationFormattingCard.annotation1Position.visible = annVisible;
    this.settings.annotationFormattingCard.annotation2Category.visible = annVisible;
    this.settings.annotationFormattingCard.annotation2Text.visible = annVisible;
    this.settings.annotationFormattingCard.annotation2Position.visible = annVisible;
    this.settings.annotationFormattingCard.annotation3Category.visible = annVisible;
    this.settings.annotationFormattingCard.annotation3Text.visible = annVisible;
    this.settings.annotationFormattingCard.annotation3Position.visible = annVisible;
    this.settings.annotationFormattingCard.annotationFontSize.visible = annVisible;
    this.settings.annotationFormattingCard.annotationFontColor.visible = annVisible;
    this.settings.annotationFormattingCard.annotationFontFamily.visible = annVisible;
    this.settings.annotationFormattingCard.annotationFontWeight.visible = annVisible;
    this.settings.annotationFormattingCard.annotationConnectorColor.visible = annVisible;
    this.settings.annotationFormattingCard.annotationOffset.visible = annVisible;
    this.settings.annotationFormattingCard.annotationPadding.visible = annVisible;
    this.settings.annotationFormattingCard.annotationBackgroundColor.visible = annVisible;
    this.settings.annotationFormattingCard.annotationBackgroundOpacity.visible = annVisible;
    this.settings.annotationFormattingCard.annotationCornerRadius.visible = annVisible;

    // The stream legend only supports the shared legend surface, not inline label controls.
    this.settings.legendFormattingCard.showInlineLabels.visible = false;
    this.settings.legendFormattingCard.inlineLabelFontSize.visible = false;
    this.settings.legendFormattingCard.inlineLabelOffset.visible = false;

    // Hide animation duration when animations are disabled
    this.settings.animationSettings.duration.visible = this.settings.animationSettings.enabled.value;

    const crosshair = this.settings.crosshairFormattingCard;
    const crosshairOn = crosshair.showCrosshair.value;
    crosshair.crosshairLineColor.visible = crosshairOn;
    crosshair.crosshairLineWidth.visible = crosshairOn;
    crosshair.crosshairLineStyle.visible = crosshairOn;
    crosshair.crosshairOpacity.visible = crosshairOn;
    crosshair.showCrosshairValues.visible = crosshairOn;

    const conditional = this.settings.conditionalFormattingCard;
    const conditionalOn = conditional.enableConditional.value;
    conditional.conditionalDirection.visible = conditionalOn;
    conditional.threshold1.visible = conditionalOn;
    conditional.threshold2.visible = conditionalOn;
    conditional.conditionalColor1.visible = conditionalOn;
    conditional.conditionalColor2.visible = conditionalOn;
    conditional.conditionalColor3.visible = conditionalOn;

    const reference = this.settings.referenceLineFormattingCard;
    const referenceOn = reference.showReferenceLine.value;
    const referenceType = resolveDropdown(reference.referenceLineType) ?? 'custom';
    reference.referenceLineType.visible = referenceOn;
    reference.referenceLineValue.visible = referenceOn && referenceType === 'custom';
    reference.referenceLineColor.visible = referenceOn;
    reference.referenceLineWidth.visible = referenceOn;
    reference.referenceLineStyle.visible = referenceOn;
    reference.showReferenceLabel.visible = referenceOn;
    reference.referenceLabelText.visible = referenceOn && reference.showReferenceLabel.value;
    reference.showReferenceBand.visible = referenceOn;
    reference.referenceBandOpacity.visible = referenceOn && reference.showReferenceBand.value;

    const trend = this.settings.trendLineFormattingCard;
    const trendOn = trend.showTrendLine.value;
    const trendType = resolveDropdown(trend.trendLineType) ?? 'linear';
    trend.trendLineType.visible = trendOn;
    trend.polynomialOrder.visible = trendOn && trendType === 'polynomial';
    trend.trendLineColor.visible = trendOn;
    trend.trendLineWidth.visible = trendOn;
    trend.showEquation.visible = trendOn;
    trend.showR2.visible = trendOn;

    // Extract data and apply user-configured sort order to series
    const data = this.sortStreamSeries(this.extractData(dataView));
    this.currentData = data;

    // Populate per-series formatting groups from value columns
    if (data) {
      const themeName = resolveColorTheme(this.settings.colorThemeFormattingCard);
      const useChartPal = this.settings.streamSettings.useChartPalette.value;
      const defaultScheme = d3.scaleOrdinal(d3.schemeCategory10);
      const colorLookup = new Map<string, string>();
      data.seriesNames.forEach((name, i) => {
        const sourceIndex = data.seriesSourceIndices[i] ?? i;
        colorLookup.set(name, useChartPal
          ? getHostChartColor(this.host.colorPalette, sourceIndex, themeName)
          : defaultScheme(String(sourceIndex)));
      });
      populateSeriesFormattingGroups(
        this.settings.seriesFormattingCard,
        dataView,
        ['measure'],
        colorLookup,
      );
    }

    // Render
    this.render(data, options.viewport);
  }

  // ── Data Extraction ──────────────────────────────────────────

  private extractData(dataView: DataView | undefined): StreamData | null {
    if (!dataView?.categorical) return null;

    const categorical = dataView.categorical;
    const categories = categorical.categories;
    const values = categorical.values;

    if (!categories || categories.length < 1 || !values || values.length < 1) return null;

    // Find category column
    let categoryColumn: powerbi.DataViewCategoryColumn | undefined;
    for (const cat of categories) {
      const roles = cat.source.roles;
      if (!roles) continue;
      if (roles['category']) categoryColumn = cat;
    }

    if (!categoryColumn) return null;

    const rowCount = categoryColumn.values.length;
    if (rowCount === 0) return null;
    const categorySelectionIds: ISelectionId[] = [];

    // Find measure columns
    const measureColumns: powerbi.DataViewValueColumn[] = [];
    for (const val of values) {
      const roles = val.source.roles;
      if (!roles) continue;
      if (roles['measure']) measureColumns.push(val);
    }

    if (measureColumns.length === 0) return null;

    // Build series names from measure display names
    const seriesNames = measureColumns.map((col) => col.source.displayName ?? 'Unknown');
    const seriesSourceIndices = measureColumns.map((_col, index) => index);
    const seriesHighlights = measureColumns.map(() => [] as (number | null)[]);

    // Build rows: one per category, with each measure as a named property
    const rows: StreamRow[] = [];
    const categoryLabels: string[] = [];


    const dateConfig: DateFilterConfig = {
      enabled: this.settings.dateFilterFormattingCard.enableDateFilter.value,
      startDate: this.settings.dateFilterFormattingCard.startDate.value,
      endAtCurrentDate: this.settings.dateFilterFormattingCard.endAtCurrentDate.value,
      endDate: this.settings.dateFilterFormattingCard.endDate.value,
    };
    const dateIndices = isDateColumn(categoryColumn.source) ? getDateFilterIndices(categoryColumn.values, dateConfig) : null;

    for (let i = 0; i < rowCount; i++) {
      if (dateIndices && !dateIndices.has(i)) continue;

      const label = String(categoryColumn.values[i] ?? '');
      categoryLabels.push(label);
      categorySelectionIds.push(this.host.createSelectionIdBuilder()
        .withCategory(categoryColumn, i)
        .createSelectionId());

      const row: StreamRow = {
        categoryIndex: i,
        categoryLabel: label,
      };

      for (let m = 0; m < measureColumns.length; m++) {
        const rawVal = measureColumns[m].values[i];
        const numVal = typeof rawVal === 'number' ? rawVal : Number(rawVal);
        row[seriesNames[m]] = Number.isFinite(numVal) ? numVal : 0;

        const rawHighlight = measureColumns[m].highlights?.[i];
        seriesHighlights[m].push(typeof rawHighlight === 'number' ? rawHighlight : null);
      }

      rows.push(row);
    }

    // Determine cross-highlight state per series
    const seriesHighlighted: boolean[] = seriesHighlights.map((highlights) =>
      highlights.some((value) => value !== null),
    );
    const hasHighlights = seriesHighlighted.some((h) => h);
    if (rows.length === 0) return null;

    return {
      rows,
      seriesNames,
      seriesSourceIndices,
      categoryLabels,
      categorySelectionIds,
      hasHighlights,
      seriesHighlighted,
      seriesHighlights,
    };
  }

  // ── Sort Series ──────────────────────────────────────────────

  /** Sort stream series by total value across all rows, respecting layer sort order. */
  private sortStreamSeries(data: StreamData | null): StreamData | null {
    if (!data || data.seriesNames.length <= 1) return data;

    // Compute total value per series across all rows
    const seriesTotals = data.seriesNames.map((seriesName, idx) => {
      let total = 0;
      let peak = 0;
      for (const row of data.rows) {
        const val = row[seriesName];
        if (typeof val === 'number') {
          total += val;
          if (val > peak) peak = val;
        }
      }
      return { name: seriesName, value: total, peak, origIndex: idx };
    });

    // Apply stream-specific sort order if set
    const streamSortOrder = resolveDropdown(this.settings.streamDisplaySettings.sortOrder) ?? 'inside-out';

    if (streamSortOrder === 'by-peak') {
      // Sort by peak value (largest peak first for visual prominence)
      seriesTotals.sort((a, b) => b.peak - a.peak);
      return {
        ...data,
        seriesNames: seriesTotals.map((s) => s.name),
        seriesSourceIndices: seriesTotals.map((s) => data.seriesSourceIndices[s.origIndex]),
        seriesHighlighted: seriesTotals.map((s) => data.seriesHighlighted[s.origIndex]),
        seriesHighlights: seriesTotals.map((s) => data.seriesHighlights[s.origIndex]),
      };
    } else if (streamSortOrder === 'appearance') {
      // Keep original data order (no sorting)
      return data;
    }

    // D3's inside-out stack order uses the shape across categories, not just
    // a total-value sort. Preserve source order here and let the stack own it.
    return data;
  }

  // ── Rendering ────────────────────────────────────────────────

  private render(data: StreamData | null, viewport: powerbi.IViewport): void {
    const themeName = resolveColorTheme(this.settings.colorThemeFormattingCard);
    // Clear container
    this.container.removeEventListener('click', this.handleBackgroundClick);
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    renderChartTitle(this.container, this.settings.titleFormattingCard);
    this.svg = null;

    const s = this.settings;

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

    const contentPadding = Math.max(0, s.cardSettings.contentPadding.value);
    this.container.style.padding = `${contentPadding}px`;

    // Handle empty/null data
    if (!data) {
      this.renderEmptyState();
      return;
    }

    // Legend dimensions
    const showLegend = s.legendFormattingCard.showLegend.value;
    const legendPos = this.getLegendPosition();
    const legendReserveV = showLegend && (legendPos === 'top' || legendPos === 'bottom') ? LEGEND_HEIGHT : 0;
    const legendReserveH = showLegend && (legendPos === 'left' || legendPos === 'right') ? LEGEND_SIDE_WIDTH : 0;

    const width = viewport.width;
    const height = viewport.height;
    const showXAxis = s.streamDisplaySettings.showXAxis.value;
    const showYAxis = s.streamDisplaySettings.showYAxis.value;
    const xAxisTitleText = s.axisFormattingCard.xAxisTitle.value;
    const yAxisTitleText = s.axisFormattingCard.yAxisTitle.value;
    const hasXTitle = showXAxis && xAxisTitleText.length > 0;
    const hasYTitle = showYAxis && yAxisTitleText.length > 0;

    // Dynamic margins: expand when axes/titles are visible
    const leftMargin = showYAxis ? (hasYTitle ? 70 : 55) : MARGIN.left;
    const bottomMargin = showXAxis
      ? (hasXTitle ? MARGIN.bottom + 20 : MARGIN.bottom)
      : MARGIN.top;

    // Wrapper for horizontal legend layout (left/right)
    const wrapper = document.createElement('div');
    wrapper.className = 'stream-wrapper';
    if (showLegend && (legendPos === 'left' || legendPos === 'right')) {
      wrapper.style.display = 'flex';
      wrapper.style.position = 'relative';
      wrapper.style.flexDirection = legendPos === 'left' ? 'row' : 'row-reverse';
      wrapper.style.width = '100%';
      wrapper.style.height = '100%';
    } else {
      wrapper.style.display = 'flex';
      wrapper.style.position = 'relative';
      wrapper.style.flexDirection = 'column';
      wrapper.style.width = '100%';
      wrapper.style.height = '100%';
    }
    this.container.appendChild(wrapper);

    // Legend (top or left)
    if (showLegend && (legendPos === 'top' || legendPos === 'left')) {
      this.renderStreamLegend(data, wrapper, legendPos);
    }

    // SVG container
    const svgContainer = document.createElement('div');
    svgContainer.style.flex = '1';
    svgContainer.style.minWidth = '0';
    svgContainer.style.minHeight = '0';
    wrapper.appendChild(svgContainer);

    const svgWidth = width - legendReserveH - contentPadding * 2;
    const svgHeight = height - legendReserveV - contentPadding * 2;
    const innerWidth = svgWidth - leftMargin - MARGIN.right;
    const innerHeight = svgHeight - MARGIN.top - bottomMargin;

    if (innerWidth <= 0 || innerHeight <= 0) return;

    // Resolve offset and curve
    const offsetKey = this.getOffsetType();
    const curveKey = this.getCurveType();
    const offsetFn = OFFSET_MAP[offsetKey];
    const curveFn = CURVE_MAP[curveKey];

    // Create SVG
    const svg = d3.select(svgContainer)
      .append('svg')
      .attr('width', svgWidth)
      .attr('height', svgHeight);

    this.svg = svg;

    const g = svg.append('g')
      .attr('transform', `translate(${leftMargin},${MARGIN.top})`);

    // Build stacked data
    const stack = d3.stack<StreamRow>()
      .keys(data.seriesNames)
      .offset(offsetFn)
      .order(
        (resolveDropdown(s.streamDisplaySettings.sortOrder) ?? 'inside-out') === 'inside-out'
          ? d3.stackOrderInsideOut
          : d3.stackOrderNone,
      );

    const stackedData = stack(data.rows);

    // Warn if negative values are present with the 'expand' offset (normalize to 0–1 breaks)
    if (offsetKey === 'expand') {
      const hasNegatives = data.rows.some((row) =>
        data.seriesNames.some((name) => {
          const v = row[name];
          return typeof v === 'number' && v < 0;
        }),
      );
      if (hasNegatives) {
        console.warn(
          '[StreamGraph] Negative values detected with "expand" (normalize) offset. ' +
          'The expand offset normalises layers to 0–1 and may produce unexpected results ' +
          'with negative data. Consider using "wiggle" or "silhouette" offset instead.',
        );
      }
    }

    // Scales
    const xScale = d3.scaleLinear()
      .domain([0, data.rows.length - 1])
      .range([0, innerWidth]);

    // Compute Y extent from all stacked layers
    let yMin = Infinity;
    let yMax = -Infinity;
    for (const layer of stackedData) {
      for (const point of layer) {
        if (point[0] < yMin) yMin = point[0];
        if (point[1] > yMax) yMax = point[1];
      }
    }

    // Handle edge case: flat data
    if (!Number.isFinite(yMin) || !Number.isFinite(yMax) || yMin === yMax) {
      yMin = -1;
      yMax = 1;
    }

    const yScale = d3.scaleLinear()
      .domain([yMin, yMax])
      .range([innerHeight, 0]);

    // Area generator
    const areaGenerator = d3.area<d3.SeriesPoint<StreamRow>>()
      .x((_d, i) => xScale(i))
      .y0((d) => yScale(d[0]))
      .y1((d) => yScale(d[1]))
      .curve(curveFn);

    // Flat area generator (for animation start: y0 = y1 = center)
    const centerY = (yMin + yMax) / 2;
    const flatAreaGenerator = d3.area<d3.SeriesPoint<StreamRow>>()
      .x((_d, i) => xScale(i))
      .y0(() => yScale(centerY))
      .y1(() => yScale(centerY))
      .curve(curveFn);

    // Render layers
    const layerGroup = g.append('g').attr('class', 'stream-layers');

    // Stream style settings
    const streamOpacity = s.streamSettings.streamOpacity.value / 100;
    const streamStrokeColor = s.streamSettings.streamStrokeColor.value?.value;
    const streamStrokeWidth = s.streamSettings.streamStrokeWidth.value;

    // Resolve line stroke style from the shared lineStrokeFormattingCard
    const strokeStyleVal = (s.lineStrokeFormattingCard.lineStyle.value as
      { value?: string } | undefined)?.value;
    const strokeDash = strokeStyleVal === 'dashed'
      ? '6 3'
      : strokeStyleVal === 'dotted'
        ? '2 2'
        : 'none';
    const lineStrokeWidth = s.lineStrokeFormattingCard.lineWidth.value;

    // Determine effective stroke: prefer streamStrokeColor if set, fall back to lineStroke card
    const effectiveStrokeColor = streamStrokeColor && streamStrokeColor.length > 0
      ? streamStrokeColor
      : 'none';
    const effectiveStrokeWidth = effectiveStrokeColor !== 'none'
      ? (streamStrokeWidth > 0 ? streamStrokeWidth : lineStrokeWidth)
      : 0;

    // Compute per-series totals for conditional formatting
    const seriesTotals = data.seriesNames.map((seriesName) => {
      let total = 0;
      for (const row of data.rows) {
        const val = row[seriesName];
        if (typeof val === 'number') total += val;
      }
      return total;
    });

    // useChartPalette: when true, use host palette with theme; when false, use d3 default scheme
    const useChartPalette = s.streamSettings.useChartPalette.value;
    const defaultColorScale = d3.scaleOrdinal(d3.schemeCategory10);
    const useGradient = s.streamSettings.useGradient.value;
    const gradientDefs = svg.append('defs');
    const seriesFormats = data.seriesNames.map((_name, index) => {
      const sourceIndex = data.seriesSourceIndices[index] ?? index;
      const baseColor = useChartPalette
        ? getHostChartColor(this.host.colorPalette, sourceIndex, themeName)
        : defaultColorScale(String(sourceIndex));
      return resolveSeriesFormatting(this.settings.seriesFormattingCard, sourceIndex, baseColor);
    });
    const seriesFillColors = seriesFormats.map((format, index) =>
      this.getConditionalColor(seriesTotals[index]) ?? format.color
    );
    const seriesOpacities = seriesFormats.map((format) =>
      streamOpacity * Math.max(0, Math.min(100, format.opacity)) / 100
    );

    // Create gradient definitions if gradient fill is enabled
    if (useGradient) {
      stackedData.forEach((layer, i) => {
        const gradientId = `stream-grad-${this.instanceId}-${i}`;
        const gradient = gradientDefs.append('linearGradient')
          .attr('id', gradientId)
          .attr('gradientUnits', 'userSpaceOnUse')
          .attr('x1', 0)
          .attr('y1', yScale(yMax))
          .attr('x2', 0)
          .attr('y2', yScale(yMin));

        // Full color at center (edges), lighter at extremes
        gradient.append('stop')
          .attr('offset', '0%')
          .attr('stop-color', seriesFillColors[i])
          .attr('stop-opacity', seriesOpacities[i] * 0.4);

        gradient.append('stop')
          .attr('offset', '50%')
          .attr('stop-color', seriesFillColors[i])
          .attr('stop-opacity', seriesOpacities[i]);

        gradient.append('stop')
          .attr('offset', '100%')
          .attr('stop-color', seriesFillColors[i])
          .attr('stop-opacity', seriesOpacities[i] * 0.4);
      });
    }

    const layers = layerGroup.selectAll<SVGPathElement, d3.Series<StreamRow, string>>('.stream-layer')
      .data(stackedData)
      .join('path')
      .attr('class', 'stream-layer')
      .attr('data-series', (_d, i) => String(i))
      .attr('fill', (_d, i) => {
        if (useGradient) {
          return `url(#stream-grad-${this.instanceId}-${i})`;
        }
        return withOpacity(seriesFillColors[i], seriesOpacities[i]);
      })
      .attr('stroke', effectiveStrokeColor)
      .attr('stroke-width', effectiveStrokeWidth)
      .attr('stroke-dasharray', effectiveStrokeColor !== 'none' ? strokeDash : 'none')
      .attr('d', (d) => areaGenerator(d) ?? '')
      .style('transition', 'opacity 0.15s ease');

    const linkedBands = g.append('g')
      .attr('class', 'stream-linked-bands')
      .style('pointer-events', 'none');
    buildCategoryBands(
      data.rows.map((_row, index) => xScale(index)),
      innerWidth,
    ).forEach((band) => {
      linkedBands.append('rect')
        .attr('class', 'stream-linked-band')
        .attr('data-selection-key', data.categorySelectionIds[band.index]?.getKey() ?? '')
        .attr('x', band.x)
        .attr('y', 0)
        .attr('width', band.width)
        .attr('height', innerHeight)
        .attr('fill', '#0F172A')
        .style('opacity', '0');
    });

    // Tooltips via tooltipService
    const showPercentages = s.streamDisplaySettings.showPercentages.value;
    const streamHost = this.host;
    const streamNumberSettings = this.settings.numberFormattingCard;
    const gNode = g.node();
    layers.on('mouseover', (event: MouseEvent, d) => {
      const tooltipItems: VisualTooltipDataItem[] = [
        { displayName: 'Series', value: d.key },
      ];
      let categoryIndex = 0;
      let pointValue = 0;
      // Resolve the category index from the pointer position to show the actual value
      if (gNode) {
        const [mx] = d3.pointer(event, gNode);
        const rawIdx = Math.round(xScale.invert(mx));
        categoryIndex = Math.max(0, Math.min(data.rows.length - 1, rawIdx));
        const row = data.rows[categoryIndex];
        if (row) {
          const rawPointValue = row[d.key];
          if (typeof rawPointValue === 'number') {
            pointValue = rawPointValue;
            tooltipItems.push({ displayName: 'Value', value: formatWithSettings(rawPointValue, streamNumberSettings) });
          }
          if (data.categoryLabels[categoryIndex]) {
            tooltipItems.push({ displayName: 'Category', value: data.categoryLabels[categoryIndex] });
          }
        }
      }
      if (showPercentages) {
        const row = data.rows[categoryIndex];
        const categoryTotal = row
          ? data.seriesNames.reduce((sum, name) => {
            const value = row[name];
            return sum + (typeof value === 'number' ? value : 0);
          }, 0)
          : 0;
        if (categoryTotal !== 0) {
          const pct = ((pointValue / categoryTotal) * 100).toFixed(1);
          tooltipItems.push({ displayName: '% of Category', value: `${pct}%` });
        }
      }
      streamHost.tooltipService.show({
        dataItems: tooltipItems,
        identities: data.categorySelectionIds[categoryIndex]
          ? [data.categorySelectionIds[categoryIndex]]
          : [],
        coordinates: [event.clientX, event.clientY],
        isTouchEvent: false,
      });
    });
    layers.on('mousemove', (event: MouseEvent) => {
      streamHost.tooltipService.move({
        dataItems: [],
        identities: [],
        coordinates: [event.clientX, event.clientY],
        isTouchEvent: false,
      });
    });
    layers.on('mouseout', () => {
      streamHost.tooltipService.hide({ immediately: true, isTouchEvent: false });
    });

    const chartGroupNode = g.node();
    if (chartGroupNode) {
      layers
        .style('cursor', allowInteractions(this.host) ? 'pointer' : 'default')
        .on('click', (event: MouseEvent) => {
          event.stopPropagation();
          if (!allowInteractions(this.host)) return;
          const selectionId = this.getSelectionIdFromPointer(
            event,
            chartGroupNode,
            xScale,
            data.categorySelectionIds,
          );
          if (selectionId) {
            void this.selectionManager.select(selectionId, event.ctrlKey || event.metaKey).then(() => {
              this.applyLinkedHighlight();
            });
          }
        })
        .on('contextmenu', (event: MouseEvent) => {
          event.preventDefault();
          event.stopPropagation();
          if (!allowInteractions(this.host)) return;
          const selectionId = this.getSelectionIdFromPointer(
            event,
            chartGroupNode,
            xScale,
            data.categorySelectionIds,
          );
          if (selectionId) {
            void this.selectionManager.showContextMenu(selectionId, {
              x: event.clientX,
              y: event.clientY,
            });
          }
        });
    }

    // Stream value labels (when showValues is enabled)
    const showValues = s.streamDisplaySettings.showValues.value;
    if (showValues) {
      const valueLabelGroup = g.append('g').attr('class', 'stream-value-labels');

      stackedData.forEach((layer, layerIdx) => {
        // Compute layer total value
        let layerTotal = 0;
        for (const row of data.rows) {
          const val = row[layer.key];
          if (typeof val === 'number') layerTotal += val;
        }

        // Find the centroid of the layer area (midpoint index, midpoint Y)
        const midIdx = Math.floor(layer.length / 2);
        const midPoint = layer[midIdx];
        if (!midPoint) return;

        const midX = xScale(midIdx);
        const midY = yScale((midPoint[0] + midPoint[1]) / 2);

        // Only render if the band is thick enough to show a label
        const bandHeight = Math.abs(yScale(midPoint[0]) - yScale(midPoint[1]));
        if (bandHeight < 14) return;

        valueLabelGroup.append('text')
          .attr('class', 'stream-value-label')
          .attr('data-series', String(layerIdx))
          .attr('x', midX)
          .attr('y', midY)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'central')
          .style('opacity', '0')
          .style('pointer-events', 'none')
          .style('transition', 'opacity 0.15s ease')
          .text(formatWithSettings(layerTotal, this.settings.numberFormattingCard));
      });

      applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.stream-value-label');
    }

    // Axis title styling (shared axisFormattingCard)
    const axisTitleSize = `${s.axisFormattingCard.axisLabelSize.value}px`;
    const axisTitleColor = s.axisFormattingCard.axisLabelColor.value?.value || '#64748B';

    // Y-axis (when enabled via streamDisplaySettings)
    if (showYAxis) {
      const yAxisGroup = g.append('g')
        .attr('class', 'stream-axis stream-axis-y');

      yAxisGroup.call(
        d3.axisLeft(yScale)
          .ticks(6)
          .tickSize(0)
          .tickFormat((d) => formatWithSettings(d as number, this.settings.numberFormattingCard)),
      );
      yAxisGroup.select('.domain').remove();
    }

    // X-axis labels
    if (showXAxis && data.categoryLabels.length > 0) {
      const axisGroup = g.append('g')
        .attr('class', 'stream-axis')
        .attr('transform', `translate(0,${innerHeight})`);

      // Determine tick spacing — show at most ~10 labels
      const labelCount = data.categoryLabels.length;
      const maxLabels = Math.max(2, Math.floor(innerWidth / 60));
      const step = Math.max(1, Math.ceil(labelCount / maxLabels));

      for (let i = 0; i < labelCount; i += step) {
        axisGroup.append('text')
          .attr('x', xScale(i))
          .attr('y', 16)
          .attr('text-anchor', 'middle')
          .text(data.categoryLabels[i]);
      }
    }

    // Axis titles
    if (hasXTitle) {
      g.append('text')
        .attr('class', 'stream-axis-title')
        .attr('x', innerWidth / 2)
        .attr('y', innerHeight + bottomMargin - 4)
        .attr('text-anchor', 'middle')
        .attr('font-size', axisTitleSize)
        .attr('fill', axisTitleColor)
        .text(xAxisTitleText);
    }
    if (hasYTitle) {
      g.append('text')
        .attr('class', 'stream-axis-title')
        .attr('transform', 'rotate(-90)')
        .attr('x', -innerHeight / 2)
        .attr('y', -leftMargin + 14)
        .attr('text-anchor', 'middle')
        .attr('font-size', axisTitleSize)
        .attr('fill', axisTitleColor)
        .text(yAxisTitleText);
    }

    // Data labels — render series name centered on each layer
    if (s.dataLabelFormattingCard.showDataLabels.value) {
      const labelGroup = g.append('g').attr('class', 'stream-data-labels');

      stackedData.forEach((layer, layerIdx) => {
        // Find the midpoint index of the layer
        const midIdx = Math.floor(layer.length / 2);
        const midPoint = layer[midIdx];
        if (!midPoint) return;

        const midX = xScale(midIdx);
        const midY = yScale((midPoint[0] + midPoint[1]) / 2);

        // Compute the band height at the midpoint to avoid labels on thin layers
        const bandHeight = Math.abs(yScale(midPoint[0]) - yScale(midPoint[1]));
        if (bandHeight < 14) return;

        labelGroup.append('text')
          .attr('class', 'stream-data-label')
          .attr('data-series', String(layerIdx))
          .attr('x', midX)
          .attr('y', midY)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'central')
          .style('transition', 'opacity 0.15s ease')
          .text(layer.key);
      });
    }

    // ── Crosshair (shared core) ──────────────────────────────

    const crosshairEnabled = s.crosshairFormattingCard.showCrosshair.value;
    if (crosshairEnabled) {
      const svgEl2 = svg.node();
      const chartGroupNode = g.node();
      if (svgEl2 && chartGroupNode) {
        const chStyleVal = resolveDropdown(s.crosshairFormattingCard.crosshairLineStyle) ?? 'dashed';
        // Use rendered layer midpoints for marker placement, but keep labels on raw series values.
        const crosshairSeries = stackedData.map((layer, layerIdx) => ({
          name: layer.key,
          values: data.rows.map((row) => {
            const rawValue = row[layer.key];
            return typeof rawValue === 'number' ? rawValue : NaN;
          }),
          markerValues: layer.map((point) => (point[0] + point[1]) / 2),
          displayValues: data.rows.map((row) => {
            const rawValue = row[layer.key];
            return typeof rawValue === 'number' ? rawValue : NaN;
          }),
          color: seriesFillColors[layerIdx],
        }));
        const crosshairCleanup = attachCrosshair(buildCrosshairConfig({
          svg: svgEl2,
          chartGroup: chartGroupNode,
          marginLeft: leftMargin,
          marginTop: MARGIN.top,
          chartWidth: innerWidth,
          chartHeight: innerHeight,
          categories: data.categoryLabels,
          xPositions: data.categoryLabels.map((_label, index) => xScale(index)),
          series: crosshairSeries,
          yScale,
          lineColor: s.crosshairFormattingCard.crosshairLineColor.value?.value || '#94A3B8',
          lineWidth: s.crosshairFormattingCard.crosshairLineWidth.value,
          lineStyle: chStyleVal,
          lineOpacity: Math.max(0, Math.min(100, s.crosshairFormattingCard.crosshairOpacity.value)) / 100,
          showValues: s.crosshairFormattingCard.showCrosshairValues.value,
          formatValue: (val: number) => formatWithSettings(val, this.settings.numberFormattingCard),
        }));
        this.cancelAnimations.push(crosshairCleanup);
      }
    }

    // ── Reference Line (shared core) ──────────────────────────
    this.applyReferenceLine(g, seriesTotals, yScale, innerWidth);

    // ── Trend Line (shared core) ────────────────────────────
    // Compute total values per category (sum across all series)
    const categoryTotals = data.rows.map((row) => {
      let sum = 0;
      for (const name of data.seriesNames) {
        const val = row[name];
        if (typeof val === 'number') sum += val;
      }
      return sum;
    });
    this.applyTrendLine(g, categoryTotals, xScale, yScale);

    // ── Annotations (shared core) ───────────────────────────
    this.applyAnnotations(g, data, stackedData, xScale, yScale);

    // ── Series Hover Highlight/Dim ──────────────────────────────

    const svgNode = svg.node();
    if (svgNode) {
      const layerElements = svgNode.querySelectorAll('.stream-layer[data-series]');
      const allSeriesElements = svgNode.querySelectorAll('[data-series]');
      const valueLabelElements = svgNode.querySelectorAll('.stream-value-label[data-series]');

      layerElements.forEach((el) => {
        el.addEventListener('mouseenter', () => {
          const seriesIdx = el.getAttribute('data-series');
          allSeriesElements.forEach((other) => {
            const isMatch = other.getAttribute('data-series') === seriesIdx;
            const isValueLabel = other.classList.contains('stream-value-label');
            if (isValueLabel) {
              // Value labels: show only the matching series label on hover
              (other as SVGElement).style.opacity = isMatch ? '1' : '0';
            } else {
              // Layers and data labels: dim non-matching, full opacity for match
              (other as SVGElement).style.opacity = isMatch ? '1' : '0.2';
            }
          });
        });
        el.addEventListener('mouseleave', () => {
          allSeriesElements.forEach((other) => {
            const isValueLabel = other.classList.contains('stream-value-label');
            // Restore: value labels hidden, everything else full opacity
            (other as SVGElement).style.opacity = isValueLabel ? '0' : '1';
          });
          this.applyLinkedHighlight();
        });
      });
    }

    // Entrance animations
    if (s.animationSettings.enabled.value && !prefersReducedMotion()) {
      this.animateEntrance(layers, stackedData, areaGenerator, flatAreaGenerator, s.animationSettings.duration.value);
    }

    // Apply shared formatting settings
    applyAllAxisFormatting(this.container, this.settings.axisFormattingCard, '.stream-axis');
    applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.stream-data-label');

    // Legend (bottom or right)
    if (showLegend && (legendPos === 'bottom' || legendPos === 'right')) {
      this.renderStreamLegend(data, wrapper, legendPos);
    }

    // ── Accessibility (shared core) ─────────────────────────
    this.applyAccessibility(data.rows.length * data.seriesNames.length);

    this.container.addEventListener('click', this.handleBackgroundClick);

    // ── Linked Selection / Cross-Highlight ───────────────────
    this.applyLinkedHighlight();
  }

  // ── Empty State ──────────────────────────────────────────────

  private renderEmptyState(): void {
    this.container.removeAttribute('role');
    this.container.removeAttribute('aria-label');
    const empty = document.createElement('div');
    empty.className = 'stream-empty-state';
    empty.setAttribute('role', 'status');
    empty.setAttribute('aria-live', 'polite');
    empty.textContent = this.emptyStateMode === 'noData'
      ? getLocalizedString(this.host, 'StreamGraph_NoDataState', 'No data for the current selection.')
      : EMPTY_STATE_TEXT;
    this.container.appendChild(empty);

    if (!prefersReducedMotion()) {
      this.cancelAnimations.push(
        fadeSlideIn(empty as unknown as HTMLElement, 'up', DURATION.normal, 0),
      );
    }
  }

  // ── Legend (shared core) ────────────────────────────────────

  private renderStreamLegend(
    data: StreamData,
    parent: HTMLElement,
    position: LegendPosition,
  ): void {
    const themeName = resolveColorTheme(this.settings.colorThemeFormattingCard);
    const legendFmtCard = this.settings.legendFormattingCard;
    const rawFontColor = legendFmtCard.legendFontColor.value?.value;
    const fontColor = rawFontColor != null && rawFontColor.length > 0 ? rawFontColor : '#64748B';

    const useChartPalette = this.settings.streamSettings.useChartPalette.value;
    const defaultColorScale = d3.scaleOrdinal(d3.schemeCategory10);
    const items: LegendItem[] = data.seriesNames.map((name, i) => {
      const sourceIndex = data.seriesSourceIndices[i] ?? i;
      const baseColor = useChartPalette
        ? getHostChartColor(this.host.colorPalette, sourceIndex, themeName)
        : defaultColorScale(String(sourceIndex));
      const seriesFormatting = resolveSeriesFormatting(
        this.settings.seriesFormattingCard,
        sourceIndex,
        baseColor,
      );
      const total = data.rows.reduce((sum, row) => {
        const value = row[name];
        return sum + (typeof value === 'number' ? value : 0);
      }, 0);
      return {
        label: name,
        color: this.getConditionalColor(total) ?? seriesFormatting.color,
      };
    });
    const rawLegendFontFamily = resolveDropdown(legendFmtCard.legendFontFamily) || undefined;

    const legendEl = renderLegend(parent, {
      items,
      position,
      fontSize: legendFmtCard.legendFontSize.value,
      fontColor,
      fontFamily: rawLegendFontFamily,
      fontWeight: resolveDropdown(legendFmtCard.legendFontWeight) || 'normal',
      aliases: legendFmtCard.legendAliases.value,
    });

    // Animate legend entrance
    if (this.settings.animationSettings.enabled.value && !prefersReducedMotion()) {
      const cancel = fadeSlideIn(
        legendEl,
        position === 'top' || position === 'left' ? 'down' : 'up',
        DURATION.normal,
        300,
      );
      this.cancelAnimations.push(cancel);
    }
  }

  // ── Setting Helpers ──────────────────────────────────────────

  private getLegendPosition(): LegendPosition {
    const val = (this.settings.legendFormattingCard.legendPosition.value as
      { value?: string } | undefined)?.value;
    const valid: LegendPosition[] = ['top', 'bottom', 'left', 'right'];
    if (typeof val === 'string' && valid.includes(val as LegendPosition)) {
      return val as LegendPosition;
    }
    return 'bottom';
  }

  private getOffsetType(): OffsetType {
    const raw = this.settings.streamSettings.offset.value?.value;
    if (raw === 'wiggle' || raw === 'silhouette' || raw === 'expand' || raw === 'none') return raw;
    return 'wiggle';
  }

  private getCurveType(): CurveType {
    const raw = this.settings.streamSettings.curve.value?.value;
    if (raw === 'basis' || raw === 'monotoneX' || raw === 'cardinal') return raw;
    return 'basis';
  }

  // ── Conditional Formatting ──────────────────────────────────────

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

  // ── Accessibility ─────────────────────────────────────────────

  private applyAccessibility(dataPointCount: number): void {
    const acc = this.settings.accessibilityFormattingCard;
    if (!acc.enableKeyboardNav.value) {
      this.container.removeAttribute('role');
      this.container.removeAttribute('aria-label');
      return;
    }
    ensureFocusRingStyles();
    applyChartAria(this.container, {
      chartType: 'stream graph',
      title: this.settings.titleFormattingCard?.titleText?.value || undefined,
      dataPointCount,
    });
    const bands = this.container.querySelectorAll<SVGRectElement>('.stream-linked-band');
    bands.forEach((band, index) => {
      band.setAttribute('role', 'listitem');
      band.setAttribute('tabindex', '0');
      band.setAttribute(
        'aria-label',
        this.currentData?.categoryLabels[index] ?? `Category ${index + 1}`,
      );
    });

    const cleanup = attachKeyboardNav({
      container: this.container,
      itemSelector: '.stream-linked-band[tabindex="0"]',
      onActivate: (_el, index) => {
        if (!allowInteractions(this.host)) return;
        const selectionId = this.currentData?.categorySelectionIds[index];
        if (selectionId) {
          void this.selectionManager.select(selectionId, false).then(() => {
            this.applyLinkedHighlight();
          });
        }
      },
    });
    this.cancelAnimations.push(cleanup);
  }

  // ── Reference Line ────────────────────────────────────────────

  private applyReferenceLine(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    allValues: number[],
    yScale: d3.ScaleLinear<number, number>,
    chartWidth: number,
  ): void {
    const rl = this.settings.referenceLineFormattingCard;
    if (!rl.showReferenceLine.value) return;

    const lineType = resolveDropdown(rl.referenceLineType) || 'custom';
    let value: number;

    if (lineType === 'custom') {
      value = rl.referenceLineValue.value;
    } else {
      value = computeStatValue(allValues, lineType as StatType);
    }

    if (!isFinite(value)) return;

    const lineStyle = resolveDropdown(rl.referenceLineStyle) || 'dashed';
    const labelText = rl.referenceLabelText.value || `${lineType}: ${Math.round(value * 100) / 100}`;

    renderHorizontalReferenceLine(g, {
      value,
      yScale,
      chartWidth,
      lineColor: rl.referenceLineColor.value?.value || '#EF4444',
      lineWidth: rl.referenceLineWidth.value,
      lineStyle: lineStyle as 'solid' | 'dashed' | 'dotted',
      showLabel: rl.showReferenceLabel.value,
      labelText,
      showBand: rl.showReferenceBand.value,
      bandOpacity: rl.referenceBandOpacity.value / 100,
    });
  }

  // ── Trend Line ────────────────────────────────────────────────

  private applyTrendLine(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    totalValues: number[],
    xScale: d3.ScaleLinear<number, number>,
    yScale: d3.ScaleLinear<number, number>,
  ): void {
    const tl = this.settings.trendLineFormattingCard;
    if (!tl.showTrendLine.value) return;
    if (totalValues.length < 2) return;

    const trendType = (resolveDropdown(tl.trendLineType) || 'linear') as TrendType;
    const regression = computeRegression(totalValues, trendType, tl.polynomialOrder.value);

    renderTrendLine(g, {
      predicted: regression.predicted,
      xScale: (i: number) => xScale(i),
      yScale,
      lineColor: tl.trendLineColor.value?.value || '#6366F1',
      lineWidth: tl.trendLineWidth.value,
      showEquation: tl.showEquation.value,
      showR2: tl.showR2.value,
      equation: regression.equation,
      r2: regression.r2,
    });
  }

  // ── Annotations ───────────────────────────────────────────────

  private applyAnnotations(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    data: StreamData,
    stackedData: d3.Series<StreamRow, string>[],
    xScale: d3.ScaleLinear<number, number>,
    yScale: d3.ScaleLinear<number, number>,
  ): void {
    const ann = this.settings.annotationFormattingCard;
    if (!ann.showAnnotations.value) return;

    const slots = [
      { category: ann.annotation1Category.value, text: ann.annotation1Text.value, position: resolveDropdown(ann.annotation1Position) || 'above' },
      { category: ann.annotation2Category.value, text: ann.annotation2Text.value, position: resolveDropdown(ann.annotation2Position) || 'above' },
      { category: ann.annotation3Category.value, text: ann.annotation3Text.value, position: resolveDropdown(ann.annotation3Position) || 'above' },
    ];

    const resolvePosition = (category: string): { x: number; y: number } | null => {
      const catIndex = data.categoryLabels.indexOf(category);
      if (catIndex < 0) return null;

      // Use the midpoint of all stacked layers at this category index
      let sumY = 0;
      let count = 0;
      for (const layer of stackedData) {
        const point = layer[catIndex];
        if (point) {
          sumY += (point[0] + point[1]) / 2;
          count++;
        }
      }
      if (count === 0) return null;

      return {
        x: xScale(catIndex),
        y: yScale(sumY / count),
      };
    };

    const config = buildAnnotationConfig(
      true,
      slots,
      ann.annotationFontSize.value,
      ann.annotationFontColor.value?.value || '#475569',
      ann.annotationConnectorColor.value?.value || '#94A3B8',
      resolvePosition,
      {
        fontFamily: resolveDropdown(ann.annotationFontFamily) || undefined,
        fontWeight: resolveDropdown(ann.annotationFontWeight) || '500',
        offset: ann.annotationOffset.value,
        padding: ann.annotationPadding.value,
        backgroundColor: ann.annotationBackgroundColor.value?.value || '#FFFFFF',
        backgroundOpacity: ann.annotationBackgroundOpacity.value / 100,
        cornerRadius: ann.annotationCornerRadius.value,
      },
    );

    if (config) {
      renderAnnotations(g, config);
    }
  }

  private getSelectionIdFromPointer(
    event: MouseEvent,
    chartGroupNode: SVGGElement,
    xScale: d3.ScaleLinear<number, number>,
    categorySelectionIds: ISelectionId[],
  ): ISelectionId | null {
    if (categorySelectionIds.length === 0) return null;

    const [rangeStart, rangeEnd] = xScale.range();
    const minRange = Math.min(rangeStart, rangeEnd);
    const maxRange = Math.max(rangeStart, rangeEnd);
    const [x] = d3.pointer(event, chartGroupNode);
    const clampedX = Math.max(minRange, Math.min(maxRange, x));
    const rawIndex = Math.round(xScale.invert(clampedX));
    const index = Math.max(0, Math.min(categorySelectionIds.length - 1, rawIndex));

    return categorySelectionIds[index] ?? null;
  }

  // ── Entrance Animation ───────────────────────────────────────

  private animateEntrance(
    layers: d3.Selection<SVGPathElement, d3.Series<StreamRow, string>, SVGGElement, unknown>,
    stackedData: d3.Series<StreamRow, string>[],
    areaGenerator: d3.Area<d3.SeriesPoint<StreamRow>>,
    flatAreaGenerator: d3.Area<d3.SeriesPoint<StreamRow>>,
    duration: number,
  ): void {
    const stagger = DURATION.stagger;

    layers.each((_d, layerIndex, elements) => {
      const el = elements[layerIndex];
      if (!el) return;

      const layerData = stackedData[layerIndex];
      if (!layerData) return;

      // Start from flat shape
      const flatPath = flatAreaGenerator(layerData) ?? '';
      const finalPath = areaGenerator(layerData) ?? '';
      el.setAttribute('d', flatPath);

      const delay = layerIndex * stagger;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      let animCancel: (() => void) | null = null;

      timeoutId = setTimeout(() => {
        // Parse numeric values from both paths for interpolation
        const flatNums = parsePathNumbers(flatPath);
        const finalNums = parsePathNumbers(finalPath);
        const template = buildPathTemplate(flatPath);

        // If path structures match, morph smoothly; otherwise snap
        if (flatNums.length === finalNums.length && flatNums.length > 0) {
          animCancel = animate(
            duration,
            cubicOut,
            (progress) => {
              const interpolated = flatNums.map((fromVal, i) => {
                const toVal = finalNums[i];
                return fromVal + (toVal - fromVal) * progress;
              });
              el.setAttribute('d', fillPathTemplate(template, interpolated));
            },
            () => {
              el.setAttribute('d', finalPath);
            },
          );
        } else {
          el.setAttribute('d', finalPath);
        }
      }, delay);

      this.cancelAnimations.push(() => {
        if (timeoutId !== null) clearTimeout(timeoutId);
        animCancel?.();
        el.setAttribute('d', finalPath);
      });
    });
  }

  // ── Formatting Pane ──────────────────────────────────────────

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    syncCardStyleVisibility(this.settings.cardSettings);
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  private handleBackgroundClick = (): void => {
    if (!allowInteractions(this.host)) return;
    void this.selectionManager.clear().then(() => {
      this.applyLinkedHighlight();
    });
  };

  // ── Linked Selection / Cross-Highlight ───────────────────────

  private applyLinkedHighlight(): void {
    const data = this.currentData;
    const svgNode = this.svg?.node();
    if (!data || !svgNode) return;

    const selectedKeys = new Set(
      (this.selectionManager.getSelectionIds() as ISelectionId[]).map((id) => id.getKey()),
    );
    const highlightedKeys = buildHighlightedCategoryKeys(
      data.categorySelectionIds,
      data.seriesHighlights.map((highlights) => ({ highlights })),
    );

    applyLinkedState({
      root: svgNode,
      selector: '.stream-linked-band[data-selection-key]',
      selectedKeys,
      highlightedKeys,
      dimOpacity: '0.18',
      activeOpacity: '0',
      clearOpacity: '0',
    });
  }

  private applyHighContrast(): void {
    applyBasicHighContrastStyles(this.container, getHostHighContrastColors(this.host), {
      textSelectors: [
        '.stream-empty-state',
        '.chart-title',
        '.chart-subtitle',
        '.stream-axis text',
        '.stream-axis-title',
        '.stream-data-label',
        '.stream-value-label',
        '.pbi-shared-legend span',
        '.crosshair-label',
        '.annotation-label',
      ],
      lineSelectors: [
        '.stream-axis line',
        '.stream-axis path',
        '.reference-line',
        '.trend-line',
        '.annotation-connector',
      ],
      fillSelectors: [],
      strokeSelectors: [],
    });
  }

  // ── Lifecycle ────────────────────────────────────────────────

  public destroy(): void {
    this.detachEmptySpaceContextMenu();
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];
    this.svg = null;
  }
}

// ── Path Interpolation Helpers ─────────────────────────────────

/** Extract all numeric values from an SVG path `d` string. */
function parsePathNumbers(d: string): number[] {
  const matches = d.match(/-?\d+\.?\d*(e[+-]?\d+)?/gi);
  return matches ? matches.map(Number) : [];
}

/** Replace numbers in path with placeholders for interpolation. */
function buildPathTemplate(d: string): string {
  return d.replace(/-?\d+\.?\d*(e[+-]?\d+)?/gi, '@@');
}

/** Fill placeholders with interpolated values. */
function fillPathTemplate(template: string, values: number[]): string {
  let i = 0;
  return template.replace(/@@/g, () => {
    const val = values[i++];
    return val !== undefined ? val.toFixed(2) : '0';
  });
}
