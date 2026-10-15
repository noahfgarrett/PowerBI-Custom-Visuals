/**
 * Bump Chart — Power BI IVisual implementation.
 * Shows rank changes over time with animated curved lines and dots.
 * Each item gets a colored line moving up/down between time periods based on rank.
 */

import powerbi from 'powerbi-visuals-api';
import * as d3 from 'd3';
import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel';
import { BumpChartSettings } from './settings';
import {
  drawPath,
  popIn,
  fadeSlideIn,
  cubicOut,
  animate,
  DURATION,
  applyCardStyle,
  type CardStyleMode,
  getChartColor,
  getHostChartColor,
  renderChartTitle,
  applyAxisFormatting,
  applyGridFormatting,
  applyDataLabelFormatting,
  applyAllAxisFormatting,
  createScrollableChart,
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
  SeriesFormattingGroup,
  lineStyleToDashArray,
  formatWithSettings,
  getDateFilterIndices,
  isDateColumn,
  type DateFilterConfig,
  hideInlineLegendFormatting,
  syncCardStyleVisibility,
  syncDateFilterFormattingVisibility,
  syncLegendFormattingVisibility,
  syncTitleFormattingVisibility,
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

interface RankPoint {
  time: string;
  rank: number;
  value: number;
}

interface BumpItem {
  name: string;
  color: string;
  points: RankPoint[];
  selectionId: ISelectionId;
  highlighted: boolean;
  formattingObjects?: Record<string, unknown>;
}

// ── Constants ────────────────────────────────────────────────────

const MARGIN = { top: 24, right: 120, bottom: 40, left: 24 };
const MARGIN_LEGEND_BOTTOM = { top: 24, right: 24, bottom: 72, left: 24 };
const EMPTY_STATE_TEXT = 'Add Item, Time Axis, and Measure fields to build the Bump Chart.';
const LEGEND_ITEM_HEIGHT = 18;
const LEGEND_SWATCH_SIZE = 10;
const LEGEND_GAP = 6;
const LEGEND_RIGHT_WIDTH = 100;
const MIN_INNER_SIZE = 40;
let bumpVisualInstanceCounter = 0;

// ── Visual ───────────────────────────────────────────────────────

export class BumpChartVisual implements IVisual {
  private host: IVisualHost;
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private container: HTMLElement;
  private settings: BumpChartSettings;
  private formattingSettingsService: FormattingSettingsService;
  private cancelAnimations: Array<() => void> = [];
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
  private currentData: BumpItem[] | null = null;
  private hasHighlights = false;
  private emptyStateMode: 'unconfigured' | 'noData' = 'unconfigured';
  private readonly instanceId = ++bumpVisualInstanceCounter;

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new BumpChartSettings();
    this.formattingSettingsService = new FormattingSettingsService(options.host.createLocalizationManager());
    this.container.classList.add('bump-container');
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
        BumpChartSettings,
        dataView
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

    syncDateFilterFormattingVisibility(this.settings.dateFilterFormattingCard);
    syncTitleFormattingVisibility(this.settings.titleFormattingCard);
    syncLegendFormattingVisibility(this.settings.legendFormattingCard);
    syncCardStyleVisibility(this.settings.cardSettings);

    this.settings.axisFormattingCard.showXAxis.visible = false;
    this.settings.axisFormattingCard.showYAxis.visible = false;
    this.settings.axisFormattingCard.xAxisTitle.visible = false;
    this.settings.axisFormattingCard.yAxisTitle.visible = false;
    this.settings.axisFormattingCard.yAxisMin.visible = false;
    this.settings.axisFormattingCard.yAxisMax.visible = false;
    this.settings.axisFormattingCard.integerTicks.visible = false;
    this.settings.dataLabelFormattingCard.showDataLabels.visible = false;

    // Hide dead grid properties — bump-chart has no grid lines
    this.settings.axisFormattingCard.showGridLines.visible = false;
    this.settings.axisFormattingCard.gridLineColor.visible = false;
    this.settings.axisFormattingCard.gridLineStyle.visible = false;
    this.settings.axisFormattingCard.gridLineWidth.visible = false;
    this.settings.axisFormattingCard.gridLineOpacity.visible = false;
    this.settings.axisFormattingCard.axisLabelRotation.visible = false;
    this.settings.axisFormattingCard.axisLineColor.visible = false;
    this.settings.axisFormattingCard.axisLineWidth.visible = false;

    // Hide dual-axis-only properties (no combo/dual-axis support)
    this.settings.referenceLineFormattingCard.referenceLineAxis.visible = false;
    this.settings.referenceLineFormattingCard.referenceBandWidth.visible = false;
    this.settings.trendLineFormattingCard.trendLineAxis.visible = false;
    hideInlineLegendFormatting(this.settings.legendFormattingCard);

    // Conditional visibility: hide child settings when parent toggle is off
    // Top N highlight: hide topN/showOthers when enabled is false
    this.settings.bumpHighlightSettings.topN.visible = this.settings.bumpHighlightSettings.enabled.value;
    this.settings.bumpHighlightSettings.showOthers.visible = this.settings.bumpHighlightSettings.enabled.value;
    // Area fill: hide areaOpacity when showArea is false
    this.settings.bumpSettings.areaOpacity.visible = this.settings.bumpSettings.showArea.value;
    // Rank change: hide sub-settings when show is false
    const rcShow = this.settings.bumpRankChangeSettings.show.value;
    const comparisonShow = this.settings.bumpRankChangeSettings.showComparison.value;
    this.settings.bumpRankChangeSettings.fontSize.visible = rcShow;
    this.settings.bumpRankChangeSettings.fontColor.visible = rcShow;
    this.settings.bumpRankChangeSettings.fontFamily.visible = rcShow;
    this.settings.bumpRankChangeSettings.fontWeight.visible = rcShow;
    this.settings.bumpRankChangeSettings.positiveColor.visible = rcShow || comparisonShow;
    this.settings.bumpRankChangeSettings.negativeColor.visible = rcShow || comparisonShow;
    this.settings.bumpRankChangeSettings.offset.visible = rcShow || comparisonShow;
    this.settings.bumpRankChangeSettings.showComparison.visible = true;

    const rankLabelsOn = this.settings.bumpSettings.showRankNumbers.value;
    this.settings.dataLabelFormattingCard.dataLabelFontSize.visible = rankLabelsOn;
    this.settings.dataLabelFormattingCard.dataLabelFontColor.visible = rankLabelsOn;
    this.settings.dataLabelFormattingCard.dataLabelFontWeight.visible = rankLabelsOn;
    this.settings.dataLabelFormattingCard.dataLabelFontFamily.visible = rankLabelsOn;
    this.settings.dataLabelFormattingCard.dataLabelPosition.visible = false;

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

    const annotations = this.settings.annotationFormattingCard;
    for (const slice of annotations.slices.slice(1)) slice.visible = annotations.showAnnotations.value;

    // Extract data
    const data = this.extractData(dataView);
    this.currentData = data;

    // Populate per-series formatting groups
    this.populateSeriesGroups(data);

    // Render
    this.render(data, options.viewport);

    // Apply cross-highlight dimming after render
    this.applySelectionHighlight();
  }

  // ── Series Formatting ────────────────────────────────────────

  private populateSeriesGroups(data: BumpItem[] | null): void {
    const card = this.settings.seriesFormattingCard;
    card.groups = [];
    if (!data) return;
    for (let i = 0; i < data.length; i++) {
      const group = new SeriesFormattingGroup({
        name: `series_${i}`,
        displayName: data[i].name,
      });
      group.seriesColor.value = { value: data[i].color };
      group.lineWidth.value = this.settings.lineStrokeFormattingCard.lineWidth.value;
      const globalLineStyle = resolveDropdown(this.settings.lineStrokeFormattingCard.lineStyle) ?? 'solid';
      group.lineStyle.value = { value: globalLineStyle, displayName: globalLineStyle };

      const selector = data[i].selectionId.getSelector();
      for (const slice of group.slices) (slice as { selector?: unknown }).selector = selector;

      const persisted = data[i].formattingObjects;
      const color = persisted?.['seriesColor'] as { solid?: { color?: string } } | undefined;
      if (color?.solid?.color) group.seriesColor.value = { value: color.solid.color };
      if (typeof persisted?.['seriesOpacity'] === 'number') group.seriesOpacity.value = persisted['seriesOpacity'];
      if (typeof persisted?.['showDataLabels'] === 'boolean') group.showDataLabels.value = persisted['showDataLabels'];
      if (typeof persisted?.['lineWidth'] === 'number') group.lineWidth.value = persisted['lineWidth'];
      const persistedStyle = persisted?.['lineStyle'];
      const styleValue = typeof persistedStyle === 'string'
        ? persistedStyle
        : (persistedStyle as { value?: string } | undefined)?.value;
      if (styleValue) group.lineStyle.value = { value: styleValue, displayName: styleValue };
      card.groups.push(group);
    }
  }

  // ── Data Extraction ──────────────────────────────────────────

  private extractData(dataView: DataView | undefined): BumpItem[] | null {
    const themeName = resolveColorTheme(this.settings.colorThemeFormattingCard);
    if (!dataView?.categorical) return null;

    const categorical = dataView.categorical;
    const categories = categorical.categories;
    const values = categorical.values;

    if (!categories || categories.length < 2 || !values || values.length < 1) return null;

    // Find columns by role
    let itemColumn: powerbi.DataViewCategoryColumn | undefined;
    let timeColumn: powerbi.DataViewCategoryColumn | undefined;
    let measureColumn: powerbi.DataViewValueColumn | undefined;

    for (const cat of categories) {
      const roles = cat.source.roles;
      if (!roles) continue;
      if (roles['item']) itemColumn = cat;
      if (roles['timeAxis']) timeColumn = cat;
    }

    for (const val of values) {
      const roles = val.source.roles;
      if (!roles) continue;
      if (roles['measure']) measureColumn = val;
    }

    if (!itemColumn || !timeColumn || !measureColumn) return null;

    const rowCount = itemColumn.values.length;
    if (rowCount === 0) return null;

    const dateConfig: DateFilterConfig = {
      enabled: this.settings.dateFilterFormattingCard.enableDateFilter.value,
      startDate: this.settings.dateFilterFormattingCard.startDate.value,
      endAtCurrentDate: this.settings.dateFilterFormattingCard.endAtCurrentDate.value,
      endDate: this.settings.dateFilterFormattingCard.endDate.value,
    };
    const dateIndices = isDateColumn(timeColumn.source) ? getDateFilterIndices(timeColumn.values, dateConfig) : null;

    // Build a pivot: Map<itemName, Map<timePeriod, value>>
    const pivot = new Map<string, Map<string, number>>();
    const itemFirstRowIndex = new Map<string, number>();
    const timePeriodsSet = new Set<string>();

    // Cross-highlight support: read highlights from measure column
    const hlRaw = (measureColumn as unknown as { highlights?: unknown[] }).highlights as unknown[] | undefined;
    const itemHighlightedRows = new Map<string, boolean>();
    let anyHighlight = false;

    for (let i = 0; i < rowCount; i++) {
      if (dateIndices && !dateIndices.has(i)) continue;
      const itemVal = itemColumn.values[i];
      const timeVal = timeColumn.values[i];
      const measureVal = measureColumn.values[i];

      if (itemVal == null || timeVal == null || measureVal == null) continue;

      const itemName = String(itemVal);
      const timeName = String(timeVal);
      const numVal = typeof measureVal === 'number' ? measureVal : Number(measureVal);

      if (!Number.isFinite(numVal)) continue;

      timePeriodsSet.add(timeName);

      let itemMap = pivot.get(itemName);
      if (!itemMap) {
        itemMap = new Map<string, number>();
        pivot.set(itemName, itemMap);
        itemFirstRowIndex.set(itemName, i);
      }
      itemMap.set(timeName, numVal);

      // Track highlight status per item
      if (hlRaw && hlRaw[i] != null) {
        itemHighlightedRows.set(itemName, true);
        anyHighlight = true;
      }
    }

    if (pivot.size === 0) return null;

    // Ordered time periods (preserve order from data)
    const timePeriods: string[] = [];
    for (let i = 0; i < rowCount; i++) {
      if (dateIndices && !dateIndices.has(i)) continue;
      const timeVal = timeColumn.values[i];
      if (timeVal == null) continue;
      const timeName = String(timeVal);
      if (!timePeriods.includes(timeName)) {
        timePeriods.push(timeName);
      }
    }

    if (timePeriods.length === 0) return null;

    // For each time period, rank items by value (highest = rank 1)
    const itemNames = Array.from(pivot.keys());
    const rankMap = new Map<string, Map<string, number>>(); // Map<itemName, Map<timePeriod, rank>>

    for (const itemName of itemNames) {
      rankMap.set(itemName, new Map<string, number>());
    }

    for (const time of timePeriods) {
      // Collect items with values for this time period
      const itemsWithValues: Array<{ name: string; value: number }> = [];
      for (const itemName of itemNames) {
        const itemMap = pivot.get(itemName);
        if (!itemMap) continue;
        const val = itemMap.get(time);
        if (val !== undefined) {
          itemsWithValues.push({ name: itemName, value: val });
        }
      }

      // Sort descending by value (highest = rank 1)
      itemsWithValues.sort((a, b) => b.value - a.value);

      // Assign ranks
      for (let r = 0; r < itemsWithValues.length; r++) {
        const entry = itemsWithValues[r];
        const itemRankMap = rankMap.get(entry.name);
        if (itemRankMap) {
          itemRankMap.set(time, r + 1);
        }
      }
    }

    // Build BumpItem array
    const useChartPalette = this.settings.bumpSettings.useChartPalette.value;
    const categoryObjects = (itemColumn as unknown as {
      objects?: Array<Record<string, Record<string, unknown>> | undefined>;
    }).objects;
    const items: BumpItem[] = [];
    let colorIndex = 0;

    for (const itemName of itemNames) {
      const itemRankMap = rankMap.get(itemName);
      const itemValueMap = pivot.get(itemName);
      if (!itemRankMap || !itemValueMap) continue;

      const points: RankPoint[] = [];
      for (const time of timePeriods) {
        const rank = itemRankMap.get(time);
        const value = itemValueMap.get(time);
        if (rank !== undefined && value !== undefined) {
          points.push({ time, rank, value });
        }
      }

      if (points.length === 0) continue;

      const color = useChartPalette ? getHostChartColor(this.host.colorPalette, colorIndex, themeName) : getChartColor(colorIndex, themeName);
      const selectionIndex = itemFirstRowIndex.get(itemName) ?? 0;
      items.push({
        name: itemName,
        color,
        points,
        selectionId: this.host.createSelectionIdBuilder()
          .withCategory(itemColumn, selectionIndex)
          .createSelectionId(),
        highlighted: itemHighlightedRows.get(itemName) ?? false,
        formattingObjects: categoryObjects?.[selectionIndex]?.['seriesFormatting'],
      });
      colorIndex++;
    }

    if (items.length === 0) return null;
    this.hasHighlights = anyHighlight;
    return items;
  }

  // ── Rendering ────────────────────────────────────────────────

  private render(data: BumpItem[] | null, viewport: powerbi.IViewport): void {
    // Clear previous content
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.container.removeEventListener('contextmenu', this.handleBackgroundContextMenu);
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    renderChartTitle(this.container, this.settings.titleFormattingCard);
    this.svg = null;
    this.container.addEventListener('click', this.handleBackgroundClick);
    this.container.addEventListener('contextmenu', this.handleBackgroundContextMenu);

    const s = this.settings;

    // Apply card style
    const cardMode = (resolveDropdown(s.cardSettings.cardStyleMode) ?? 'glass') as CardStyleMode;
    applyCardStyle(this.container, {
      mode: cardMode,
      opacity: s.cardSettings.backgroundOpacity.value / 100,
      backgroundColor: s.cardSettings.backgroundColor.value?.value,
      borderRadius: s.cardSettings.borderRadius.value,
    });
    const contentPadding = Math.max(0, s.cardSettings.contentPadding.value);
    this.container.style.padding = `${contentPadding}px`;

    // Handle empty/null data
    if (!data) {
      this.renderEmptyState();
      return;
    }

    const legendPosition = (s.legendFormattingCard.legendPosition.value as { value?: string } | undefined)?.value ?? 'bottom';
    const showLegend = s.legendFormattingCard.showLegend.value;
    const isLegendBottom = legendPosition === 'bottom';

    // Choose margins based on legend position
    const margin = showLegend && isLegendBottom
      ? { ...MARGIN_LEGEND_BOTTOM }
      : { ...MARGIN };

    // If legend is on the right, ensure right margin has room
    if (showLegend && legendPosition === 'right') {
      margin.right = Math.max(margin.right, LEGEND_RIGHT_WIDTH + 40);
    }
    // If legend is on the left, ensure left margin has room
    if (showLegend && legendPosition === 'left') {
      margin.left += 80;
    }

    const width = Math.max(0, viewport.width - contentPadding * 2);
    const height = Math.max(0, viewport.height - contentPadding * 2);
    const baseInnerWidth = width - margin.left - margin.right;
    const baseInnerHeight = height - margin.top - margin.bottom;

    if (baseInnerWidth < MIN_INNER_SIZE || baseInnerHeight < MIN_INNER_SIZE) return;

    // Collect unique time periods (from the first item's points — all should share them)
    const timePeriods = data[0].points.map((p) => p.time);
    const maxRank = data.length;

    // Scroll support
    const scroll = createScrollableChart({
      container: this.container,
      viewportWidth: width,
      viewportHeight: height,
      categoryCount: timePeriods.length,
      scrollSettings: s.scrollFormattingCard,
      availableChartWidth: baseInnerWidth,
      availableChartHeight: baseInnerHeight,
      direction: 'horizontal',
    });
    const innerWidth = scroll.chartWidth;
    const innerHeight = scroll.chartHeight;

    // Create SVG
    const svg = d3.select(scroll.svgParent)
      .append('svg')
      .attr('width', scroll.svgWidth)
      .attr('height', scroll.svgHeight);

    this.svg = svg;

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // ── Scales ──────────────────────────────────────────────────

    const xScale = d3.scalePoint<string>()
      .domain(timePeriods)
      .range([0, innerWidth])
      .padding(0.1);

    const yScale = d3.scaleLinear()
      .domain([1, maxRank])
      .range([0, innerHeight]);

    // ── X-Axis ──────────────────────────────────────────────────

    const showXAxis = s.bumpSettings.showXAxis.value;

    if (showXAxis) {
      const axisGroup = g.append('g')
        .attr('class', 'bump-axis')
        .attr('transform', `translate(0,${innerHeight + 12})`);

      timePeriods.forEach((time) => {
        const x = xScale(time);
        if (x === undefined) return;

        axisGroup.append('text')
          .attr('x', x)
          .attr('y', 0)
          .attr('text-anchor', 'middle')
          .attr('font-size', s.axisFormattingCard.axisLabelSize.value)
          .attr('fill', s.axisFormattingCard.axisLabelColor.value?.value || '#64748B')
          .text(time);
      });
    }

    // ── Top-N Highlight Filtering ──────────────────────────────

    const highlightEnabled = s.bumpHighlightSettings.enabled.value;
    const topN = s.bumpHighlightSettings.topN.value;
    const showOthers = s.bumpHighlightSettings.showOthers.value;

    // Determine which items are "top N" based on their best (lowest) rank across all time periods
    let topNSet: Set<number> | null = null;
    if (highlightEnabled && topN > 0 && topN < data.length) {
      const bestRanks = data.map((item, idx) => ({
        idx,
        bestRank: Math.min(...item.points.map((p) => p.rank)),
      }));
      bestRanks.sort((a, b) => a.bestRank - b.bestRank);
      topNSet = new Set(bestRanks.slice(0, topN).map((r) => r.idx));
    }

    // If highlighting is on and showOthers is off, filter data to only top-N items
    let renderData = data;
    if (topNSet && !showOthers) {
      renderData = data.filter((_, idx) => topNSet!.has(idx));
    }

    // ── Settings ────────────────────────────────────────────────

    const lineWidth = s.lineStrokeFormattingCard.lineWidth.value;
    const dotRadius = s.bumpSettings.dotRadius.value;
    const showRankNumbers = s.bumpSettings.showRankNumbers.value;
    const animEnabled = s.animationSettings.enabled.value && !prefersReducedMotion();
    const animDuration = s.animationSettings.duration.value;

    // Line stroke formatting card
    const lineStyleValue = s.lineStrokeFormattingCard.lineStyle.value;
    const lineStyle = typeof lineStyleValue === 'string'
      ? lineStyleValue
      : (lineStyleValue as { value?: string } | undefined)?.value ?? 'solid';

    // ── Area Fill (gradient under lines) ──────────────────────

    const showAreaFill = s.bumpSettings.showArea.value;
    const areaOpacity = s.bumpSettings.areaOpacity.value / 100;
    const defs = svg.append('defs');

    if (showAreaFill) {
      const areaGroup = g.append('g').attr('class', 'bump-areas');

      const areaGenerator = d3.area<RankPoint>()
        .x((d) => xScale(d.time) ?? 0)
        .y0(innerHeight)
        .y1((d) => yScale(d.rank))
        .curve(d3.curveMonotoneX);

      renderData.forEach((item, itemIdx) => {
        const origIdx = data.indexOf(item);
        const sf = resolveSeriesFormatting(this.settings.seriesFormattingCard, origIdx, item.color);
        const isDimmed = topNSet != null && !topNSet.has(origIdx);

        const gradientId = `bump-area-grad-${this.instanceId}-${itemIdx}`;
        const gradient = defs.append('linearGradient')
          .attr('id', gradientId)
          .attr('gradientUnits', 'userSpaceOnUse')
          .attr('x1', 0)
          .attr('y1', 0)
          .attr('x2', 0)
          .attr('y2', innerHeight);

        const effectiveOpacity = areaOpacity * (sf.opacity / 100) * (isDimmed ? 0.3 : 1);

        gradient.append('stop')
          .attr('offset', '0%')
          .attr('stop-color', sf.color)
          .attr('stop-opacity', effectiveOpacity);

        gradient.append('stop')
          .attr('offset', '100%')
          .attr('stop-color', sf.color)
          .attr('stop-opacity', 0);

        const areaD = areaGenerator(item.points);
        if (!areaD) return;

        areaGroup.append('path')
          .attr('class', 'bump-area')
          .attr('data-series', String(origIdx))
          .attr('data-selection-key', item.selectionId.getKey())
          .attr('data-base-opacity', '1')
          .attr('d', areaD)
          .attr('fill', `url(#${gradientId})`)
          .style('transition', 'opacity 0.15s ease');
      });
    }

    // ── Lines ───────────────────────────────────────────────────

    const lineGroup = g.append('g').attr('class', 'bump-lines');
    const paths: SVGPathElement[] = [];

    const lineGenerator = d3.line<RankPoint>()
      .x((d) => xScale(d.time) ?? 0)
      .y((d) => yScale(d.rank))
      .curve(d3.curveMonotoneX);

    renderData.forEach((item) => {
      const origIdx = data.indexOf(item);
      const pathD = lineGenerator(item.points);
      if (!pathD) return;

      // Resolve per-series formatting
      const sf = resolveSeriesFormatting(this.settings.seriesFormattingCard, origIdx, item.color);
      const isDimmed = topNSet != null && !topNSet.has(origIdx);

      // Determine conditional color from average value of this series
      const avgValue = item.points.reduce((sum, p) => sum + p.value, 0) / item.points.length;
      const condColor = this.getConditionalColor(avgValue);

      const path = lineGroup.append('path')
        .attr('class', 'bump-line')
        .attr('data-series', String(origIdx))
        .attr('data-selection-key', item.selectionId.getKey())
        .attr('data-base-opacity', String((sf.opacity / 100) * (isDimmed ? 0.25 : 1)))
        .attr('d', pathD)
        .attr('stroke', condColor || sf.color)
        .attr('stroke-width', sf.lineWidth || lineWidth)
        .attr('fill', 'none')
        .attr('stroke-linecap', 'round')
        .style('opacity', String((sf.opacity / 100) * (isDimmed ? 0.25 : 1)))
        .style('transition', 'opacity 0.15s ease');

      // Groups inherit the global style, while persisted per-series values override it.
      const effectiveLineStyle = sf.lineStyle || lineStyle;
      const dashArray = lineStyleToDashArray(effectiveLineStyle);
      if (dashArray !== '') {
        path.attr('stroke-dasharray', dashArray);
      }

      const showLineTooltip = (event: MouseEvent): void => {
        const tooltipItems: VisualTooltipDataItem[] = [
          { displayName: 'Series', value: pathItem.name },
        ];
        if (tooltipAnchor) {
          const [mx] = d3.pointer(event, tooltipAnchor);
          let nearest = pathItem.points[0];
          let minDist = Infinity;
          for (const pt of pathItem.points) {
            const px = xScale(pt.time) ?? 0;
            const dist = Math.abs(px - mx);
            if (dist < minDist) {
              minDist = dist;
              nearest = pt;
            }
          }
          if (nearest) {
            tooltipItems.push({ displayName: 'Time', value: nearest.time });
            tooltipItems.push({ displayName: 'Rank', value: String(nearest.rank) });
            tooltipItems.push({ displayName: 'Value', value: formatWithSettings(nearest.value, this.settings.numberFormattingCard) });
          }
        }
        pathHost.tooltipService.show({
          dataItems: tooltipItems,
          identities: [pathItem.selectionId],
          coordinates: [event.clientX, event.clientY],
          isTouchEvent: false,
        });
      };

      const handleLineClick = (event: MouseEvent): void => {
        event.stopPropagation();
        if (!allowInteractions(this.host)) return;
        void this.selectionManager.select(
          item.selectionId,
          event.ctrlKey || event.metaKey,
        ).then(() => this.applySelectionHighlight());
      };

      const handleLineContextMenu = (event: MouseEvent): void => {
        event.preventDefault();
        event.stopPropagation();
        if (!allowInteractions(this.host)) return;
        void this.selectionManager.showContextMenu(item.selectionId, {
          x: event.clientX,
          y: event.clientY,
        });
      };

      path.style('cursor', allowInteractions(this.host) ? 'pointer' : 'default')
        .style('pointer-events', 'none')
        .on('click', (event: MouseEvent) => {
          handleLineClick(event);
        })
        .on('contextmenu', (event: MouseEvent) => {
          handleLineContextMenu(event);
        });

      // Tooltip via tooltipService — show nearest point's rank and value
      const pathHost = this.host;
      const pathItem = item;
      const tooltipAnchor = path.node()?.closest('g') ?? path.node();
      path.on('mouseover', showLineTooltip);
      path.on('mousemove', showLineTooltip);
      path.on('mouseout', () => {
        pathHost.tooltipService.hide({ immediately: true, isTouchEvent: false });
      });

      lineGroup.append('path')
        .attr('class', 'bump-line-hit-area')
        .attr('d', pathD)
        .attr('fill', 'none')
        .attr('stroke', 'transparent')
        .attr('stroke-width', Math.max(sf.lineWidth || lineWidth, 14))
        .attr('stroke-linecap', 'round')
        .style('cursor', allowInteractions(this.host) ? 'pointer' : 'default')
        .on('click', handleLineClick)
        .on('contextmenu', handleLineContextMenu)
        .on('mouseover', showLineTooltip)
        .on('mousemove', showLineTooltip)
        .on('mouseout', () => {
          pathHost.tooltipService.hide({ immediately: true, isTouchEvent: false });
        });

      const pathNode = path.node();
      if (pathNode) {
        paths.push(pathNode);
      }
    });

    // ── Dots ────────────────────────────────────────────────────

    const dotGroup = g.append('g').attr('class', 'bump-dots');
    const dots: SVGElement[] = [];

    renderData.forEach((item) => {
      const origIdx = data.indexOf(item);
      const dotSf = resolveSeriesFormatting(this.settings.seriesFormattingCard, origIdx, item.color);
      const isDimmed = topNSet != null && !topNSet.has(origIdx);
      item.points.forEach((point) => {
        const cx = xScale(point.time);
        if (cx === undefined) return;
        const cy = yScale(point.rank);

        const dotCondColor = this.getConditionalColor(point.value);

        const dot = dotGroup.append('circle')
          .attr('class', 'bump-dot')
          .attr('data-series', String(origIdx))
          .attr('data-selection-key', item.selectionId.getKey())
          .attr('data-base-opacity', String((dotSf.opacity / 100) * (isDimmed ? 0.25 : 1)))
          .attr('data-time', point.time)
          .attr('data-rank', String(point.rank))
          .attr('data-value', String(point.value))
          .attr('cx', cx)
          .attr('cy', cy)
          .attr('r', dotRadius)
          .attr('fill', dotCondColor || dotSf.color)
          .attr('stroke', s.bumpSettings.dotStrokeColor.value?.value || '#FFFFFF')
          .attr('stroke-width', 2)
          .style('opacity', String((dotSf.opacity / 100) * (isDimmed ? 0.25 : 1)))
          .style('transition', 'opacity 0.15s ease')
          .style('cursor', allowInteractions(this.host) ? 'pointer' : 'default')
          .on('click', (event: MouseEvent) => {
            event.stopPropagation();
            if (!allowInteractions(this.host)) return;
            void this.selectionManager.select(
              item.selectionId,
              event.ctrlKey || event.metaKey,
            ).then(() => this.applySelectionHighlight());
          })
          .on('contextmenu', (event: MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();
            if (!allowInteractions(this.host)) return;
            void this.selectionManager.showContextMenu(item.selectionId, {
              x: event.clientX,
              y: event.clientY,
            });
          });

        // Tooltip via tooltipService
        const dotHost = this.host;
        const dotItemName = item.name;
        const dotPointTime = point.time;
        const dotPointRank = point.rank;
        const dotPointValue = point.value;
        dot.on('mouseover', (event: MouseEvent) => {
          const tooltipItems: VisualTooltipDataItem[] = [
            { displayName: 'Series', value: dotItemName },
            { displayName: 'Time', value: dotPointTime },
            { displayName: 'Rank', value: String(dotPointRank) },
            { displayName: 'Value', value: formatWithSettings(dotPointValue, this.settings.numberFormattingCard) },
          ];
          dotHost.tooltipService.show({
            dataItems: tooltipItems,
            identities: [item.selectionId],
            coordinates: [event.clientX, event.clientY],
            isTouchEvent: false,
          });
        });
        dot.on('mousemove', (event: MouseEvent) => {
          dotHost.tooltipService.move({
            dataItems: [],
            identities: [],
            coordinates: [event.clientX, event.clientY],
            isTouchEvent: false,
          });
        });
        dot.on('mouseout', () => {
          dotHost.tooltipService.hide({ immediately: true, isTouchEvent: false });
        });

        const dotNode = dot.node();
        if (dotNode) dots.push(dotNode);
      });
    });

    // ── Rank Labels ─────────────────────────────────────────────

    const labelElements: SVGElement[] = [];

    if (showRankNumbers) {
      const labelGroup = g.append('g').attr('class', 'bump-rank-labels');

      renderData.forEach((item) => {
        const origIdx = data.indexOf(item);
        const labelFormatting = resolveSeriesFormatting(this.settings.seriesFormattingCard, origIdx, item.color);
        if (!labelFormatting.showLabels) return;
        const isDimmed = topNSet != null && !topNSet.has(origIdx);
        item.points.forEach((point) => {
          const cx = xScale(point.time);
          if (cx === undefined) return;
          const cy = yScale(point.rank);

          const label = labelGroup.append('text')
            .attr('class', 'bump-rank-label')
            .attr('data-series', String(origIdx))
            .attr('data-selection-key', item.selectionId.getKey())
            .attr('data-base-opacity', String((labelFormatting.opacity / 100) * (isDimmed ? 0.25 : 1)))
            .attr('x', cx)
            .attr('y', cy)
            .style('opacity', String((labelFormatting.opacity / 100) * (isDimmed ? 0.25 : 1)))
            .style('transition', 'opacity 0.15s ease')
            .text(point.rank);

          const labelNode = label.node();
          if (labelNode) labelElements.push(labelNode);
        });
      });
    }

    // ── Rank Change Indicators ──────────────────────────────────

    if (s.bumpRankChangeSettings.show.value) {
      const rcGroup = g.append('g').attr('class', 'bump-rank-change-labels');
      const rcFontSize = s.bumpRankChangeSettings.fontSize.value;
      const rcFontColorRaw = s.bumpRankChangeSettings.fontColor.value?.value;
      const rcHasCustomColor = rcFontColorRaw != null && rcFontColorRaw.length > 0;
      const rcPositiveColor = s.bumpRankChangeSettings.positiveColor.value?.value ?? '#22C55E';
      const rcNegativeColor = s.bumpRankChangeSettings.negativeColor.value?.value ?? '#EF4444';
      const rcFontFamily = resolveDropdown(s.bumpRankChangeSettings.fontFamily) || '';
      const rcFontWeight = resolveDropdown(s.bumpRankChangeSettings.fontWeight) || 'bold';
      const rcOffset = s.bumpRankChangeSettings.offset.value;

      renderData.forEach((item) => {
        const origIdx = data.indexOf(item);
        const isDimmed = topNSet != null && !topNSet.has(origIdx);
        for (let pi = 1; pi < item.points.length; pi++) {
          const prev = item.points[pi - 1];
          const curr = item.points[pi];
          const delta = curr.rank - prev.rank;
          if (delta === 0) continue;

          const cx = xScale(curr.time);
          if (cx === undefined) continue;
          const cy = yScale(curr.rank);

          // Negative delta = moved up in rank = improvement (green)
          const color = rcHasCustomColor ? rcFontColorRaw : (delta < 0 ? rcPositiveColor : rcNegativeColor);
          const label = delta > 0 ? `+${delta}` : String(delta);

          const text = rcGroup.append('text')
            .attr('class', 'rank-change-label')
            .attr('data-series', String(origIdx))
            .attr('data-selection-key', item.selectionId.getKey())
            .attr('data-base-opacity', String(isDimmed ? 0.25 : 1))
            .attr('x', cx + dotRadius + rcOffset)
            .attr('y', cy - dotRadius - 2 - Math.max(0, Math.floor(rcOffset / 2)))
            .attr('font-size', `${rcFontSize}px`)
            .attr('fill', color)
            .attr('font-weight', rcFontWeight);

          if (rcFontFamily) {
            text.attr('font-family', rcFontFamily);
          }

          text.text(label);

          if (isDimmed) {
            text.style('opacity', '0.25');
          }
        }
      });
    }

    // ── Period Comparison Badges ─────────────────────────────────

    if (s.bumpRankChangeSettings.showComparison.value) {
      const compGroup = g.append('g').attr('class', 'bump-comparison-labels');

      renderData.forEach((item) => {
        const origIdx = data.indexOf(item);
        const isDimmed = topNSet != null && !topNSet.has(origIdx);
        if (item.points.length < 2) return;

        const firstRank = item.points[0].rank;
        const lastRank = item.points[item.points.length - 1].rank;
        const delta = lastRank - firstRank;

        const lastPoint = item.points[item.points.length - 1];
        const cx = xScale(lastPoint.time);
        if (cx === undefined) return;
        const cy = yScale(lastPoint.rank);

        const compPositiveColor = s.bumpRankChangeSettings.positiveColor.value?.value ?? '#22C55E';
        const compNegativeColor = s.bumpRankChangeSettings.negativeColor.value?.value ?? '#EF4444';
        const compOffset = s.bumpRankChangeSettings.offset.value;
        const color = delta < 0 ? compPositiveColor : delta > 0 ? compNegativeColor : (s.axisFormattingCard.axisLabelColor.value?.value || '#64748B');
        const label = delta === 0 ? '=' : delta > 0 ? `+${delta}` : String(delta);

          const badge = compGroup.append('text')
            .attr('class', 'bump-comparison-badge')
            .attr('data-series', String(origIdx))
            .attr('data-selection-key', item.selectionId.getKey())
            .attr('data-base-opacity', String(isDimmed ? 0.25 : 1))
          .attr('x', cx + dotRadius + compOffset)
          .attr('y', cy + 4 + Math.max(0, Math.floor(compOffset / 2)))
          .attr('font-size', `${s.axisFormattingCard.axisLabelSize.value}px`)
          .attr('fill', color)
          .attr('font-weight', 'bold')
          .text(`[${label}]`);

        if (isDimmed) {
          badge.style('opacity', '0.25');
        }
      });
    }

    // ── Reference Line ─────────────────────────────────────────

    const allRankValues = data.flatMap((item) => item.points.map((p) => p.rank));
    this.renderReferenceLine(g, yScale, innerWidth, allRankValues);

    // ── Trend Line ──────────────────────────────────────────────

    // For trend line, use average rank per time period as the series values
    const avgRanksPerTime = timePeriods.map((time) => {
      const ranks = data.map((item) => {
        const pt = item.points.find((p) => p.time === time);
        return pt ? pt.rank : NaN;
      }).filter((r) => isFinite(r));
      return ranks.length > 0 ? ranks.reduce((a, b) => a + b, 0) / ranks.length : NaN;
    }).filter((v) => isFinite(v));

    const trendXScale = (index: number): number => {
      const tp = timePeriods[index];
      return tp !== undefined ? (xScale(tp) ?? 0) : 0;
    };
    this.renderTrendLineOverlay(g, avgRanksPerTime, trendXScale, yScale);

    // ── Annotations ─────────────────────────────────────────────

    const resolveAnnotationPosition = (category: string): { x: number; y: number } | null => {
      for (const item of data) {
        const pt = item.points.find((p) => p.time === category);
        if (pt) {
          const x = xScale(pt.time);
          if (x !== undefined) {
            return { x, y: yScale(pt.rank) };
          }
        }
      }
      return null;
    };
    this.renderAnnotationOverlay(g, resolveAnnotationPosition);

    // ── Legend ───────────────────────────────────────────────────

    if (showLegend) {
      this.renderBumpLegend(data, legendPosition);
    }

    // ── Crosshair (shared core) ──────────────────────────────

    const crosshairEnabled = s.crosshairFormattingCard.showCrosshair.value;
    if (crosshairEnabled) {
      const svgEl2 = svg.node();
      const chartGroupNode = g.node();
      if (svgEl2 && chartGroupNode) {
        const chStyleVal = resolveDropdown(s.crosshairFormattingCard.crosshairLineStyle) ?? 'dashed';
        // Build series data for crosshair: rank values per time period
        const crosshairSeries = data.map((item) => ({
          name: item.name,
          values: timePeriods.map((time) => {
            const point = item.points.find((p) => p.time === time);
            return point ? point.rank : NaN;
          }),
          color: item.color,
        }));
        const crosshairCleanup = attachCrosshair(buildCrosshairConfig({
          svg: svgEl2,
          chartGroup: chartGroupNode,
          marginLeft: margin.left,
          marginTop: margin.top,
          chartWidth: innerWidth,
          chartHeight: innerHeight,
          categories: timePeriods,
          xPositions: timePeriods.map((time) => xScale(time) ?? 0),
          series: crosshairSeries,
          yScale,
          lineColor: s.crosshairFormattingCard.crosshairLineColor.value?.value || '#94A3B8',
          lineWidth: s.crosshairFormattingCard.crosshairLineWidth.value,
          lineStyle: chStyleVal,
          lineOpacity: Math.max(0, Math.min(100, s.crosshairFormattingCard.crosshairOpacity.value)) / 100,
          showValues: s.crosshairFormattingCard.showCrosshairValues.value,
          formatValue: (val: number) => `#${Math.round(val)}`,
        }));
        this.cancelAnimations.push(crosshairCleanup);
      }
    }

    // ── Series Hover Highlight/Dim ──────────────────────────────

    const svgNode = svg.node();
    if (svgNode) {
      const seriesElements = svgNode.querySelectorAll<SVGElement>(
        '[data-series][data-base-opacity]',
      );
      seriesElements.forEach((el) => {
        el.addEventListener('mouseenter', () => {
          const seriesIdx = el.getAttribute('data-series');
          seriesElements.forEach((other) => {
            const baseOpacity = Number(other.dataset['baseOpacity'] ?? '1');
            other.style.opacity = String(
              other.getAttribute('data-series') === seriesIdx
                ? baseOpacity
                : baseOpacity * 0.2,
            );
          });
        });
        el.addEventListener('mouseleave', () => {
          this.applySelectionHighlight();
        });
      });
    }

    // ── Entrance Animations ─────────────────────────────────────

    if (animEnabled) {
      this.animateEntrance(paths, dots, labelElements, animDuration);
    }

    // Apply shared formatting settings
    applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.bump-rank-label');
    applyAllAxisFormatting(this.container, this.settings.axisFormattingCard, '.bump-axis');

    // ── Accessibility ─────────────────────────────────────────────

    const totalDataPoints = data.reduce((sum, item) => sum + item.points.length, 0);
    this.applyAccessibility(totalDataPoints);

  }

  // ── Legend Rendering (shared core) ──────────────────────────

  private renderBumpLegend(
    data: BumpItem[],
    legendPosition: string,
  ): void {
    const legendFmtCard = this.settings.legendFormattingCard;
    const rawFontColor = legendFmtCard.legendFontColor.value?.value;
    const fontColor = rawFontColor != null && rawFontColor.length > 0 ? rawFontColor : '#64748B';
    const validPositions = ['top', 'bottom', 'left', 'right'] as const;
    const position: 'top' | 'bottom' | 'left' | 'right' =
      (validPositions as readonly string[]).includes(legendPosition)
        ? (legendPosition as 'top' | 'bottom' | 'left' | 'right')
        : 'bottom';

    const items: LegendItem[] = data.map((item, index) => {
      const seriesFormatting = resolveSeriesFormatting(
        this.settings.seriesFormattingCard,
        index,
        item.color,
      );
      const averageValue = item.points.reduce((sum, point) => sum + point.value, 0)
        / item.points.length;
      return {
        label: item.name,
        color: this.getConditionalColor(averageValue) ?? seriesFormatting.color,
      };
    });
    const rawLegendFontFamily = resolveDropdown(legendFmtCard.legendFontFamily) || undefined;

    renderLegend(this.container, {
      items,
      position,
      fontSize: legendFmtCard.legendFontSize.value,
      fontColor,
      fontFamily: rawLegendFontFamily,
      fontWeight: resolveDropdown(legendFmtCard.legendFontWeight) || 'normal',
      aliases: legendFmtCard.legendAliases.value,
    });
  }

  // ── Empty State ──────────────────────────────────────────────

  private renderEmptyState(): void {
    this.container.removeAttribute('role');
    this.container.removeAttribute('aria-label');
    const empty = document.createElement('div');
    empty.className = 'bump-empty';
    empty.setAttribute('role', 'status');
    empty.setAttribute('aria-live', 'polite');
    empty.textContent = this.emptyStateMode === 'noData'
      ? getLocalizedString(this.host, 'BumpChart_NoDataState', 'No data for the current selection.')
      : EMPTY_STATE_TEXT;
    this.container.appendChild(empty);
  }

  // ── Entrance Animation ───────────────────────────────────────

  private animateEntrance(
    paths: SVGPathElement[],
    dots: SVGElement[],
    labels: SVGElement[],
    duration: number,
  ): void {
    const stagger = DURATION.stagger;

    // Lines via drawPath with stagger by item index
    paths.forEach((pathEl, i) => {
      const delay = i * stagger;
      const cancel = drawPath(pathEl, duration, delay);
      this.cancelAnimations.push(cancel);
    });

    // Dots via popIn — start after lines begin drawing
    const dotBaseDelay = stagger * 2;
    dots.forEach((dotEl, i) => {
      const delay = dotBaseDelay + i * (stagger / 2);
      const cancel = popIn(dotEl, delay, duration);
      this.cancelAnimations.push(cancel);
    });

    // Rank labels fade in after dots
    if (labels.length > 0) {
      const labelBaseDelay = dotBaseDelay + dots.length * (stagger / 2);
      labels.forEach((labelEl, i) => {
        const delay = labelBaseDelay + i * (stagger / 3);
        const cancel = fadeSlideIn(labelEl as unknown as HTMLElement, 'up', duration * 0.5, delay);
        this.cancelAnimations.push(cancel);
      });
    }
  }

  // ── Conditional Formatting ────────────────────────────────────

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

  // ── Accessibility ───────────────────────────────────────────────

  private applyAccessibility(dataPointCount: number): void {
    const acc = this.settings.accessibilityFormattingCard;
    if (!acc.enableKeyboardNav.value) {
      this.container.removeAttribute('role');
      this.container.removeAttribute('aria-label');
      return;
    }
    ensureFocusRingStyles();
    applyChartAria(this.container, {
      chartType: 'bump chart',
      title: this.settings.titleFormattingCard?.titleText?.value || undefined,
      dataPointCount,
    });
    const focusableMarks = this.container.querySelectorAll<SVGElement>(
      '.bump-line, .bump-dot',
    );
    focusableMarks.forEach((mark, index) => {
      const seriesIndex = Number(mark.getAttribute('data-series'));
      const item = this.currentData?.[seriesIndex];
      const time = mark.getAttribute('data-time');
      const rank = mark.getAttribute('data-rank');
      const value = mark.getAttribute('data-value');
      const detail = time && rank && value
        ? `${time}, rank ${rank}, value ${formatWithSettings(Number(value), this.settings.numberFormattingCard)}`
        : 'rank trend';
      mark.setAttribute('role', 'listitem');
      mark.setAttribute('tabindex', '0');
      mark.setAttribute(
        'aria-label',
        item ? `${item.name}, ${detail}` : `Bump chart item ${index + 1}`,
      );
    });
    const cleanup = attachKeyboardNav({
      container: this.container,
      itemSelector: '.bump-line[tabindex="0"], .bump-dot[tabindex="0"]',
      onActivate: (el) => {
        if (allowInteractions(this.host)) (el as HTMLElement).click?.();
      },
    });
    this.cancelAnimations.push(cleanup);
  }

  // ── Reference Line ──────────────────────────────────────────────

  private renderReferenceLine(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    yScale: d3.ScaleLinear<number, number>,
    width: number,
    allValues: number[],
  ): void {
    const ref = this.settings.referenceLineFormattingCard;
    if (!ref.showReferenceLine.value) return;
    const refType = resolveDropdown(ref.referenceLineType) ?? 'custom';
    let refValue = ref.referenceLineValue.value;
    if (refType !== 'custom' && allValues.length > 0) {
      refValue = computeStatValue(allValues, refType as StatType);
    }
    renderHorizontalReferenceLine(g, {
      value: refValue,
      yScale,
      chartWidth: width,
      lineColor: ref.referenceLineColor.value?.value ?? '#EF4444',
      lineWidth: ref.referenceLineWidth.value,
      lineStyle: (resolveDropdown(ref.referenceLineStyle) ?? 'dashed') as 'solid' | 'dashed' | 'dotted',
      showLabel: ref.showReferenceLabel.value,
      labelText: ref.referenceLabelText.value || String(refValue),
      showBand: ref.showReferenceBand.value,
      bandUpperValue: refValue * 1.1,
      bandOpacity: ref.referenceBandOpacity.value / 100,
    });
  }

  // ── Trend Line ──────────────────────────────────────────────────

  private renderTrendLineOverlay(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    values: number[],
    xScale: (index: number) => number,
    yScale: d3.ScaleLinear<number, number>,
  ): void {
    const tl = this.settings.trendLineFormattingCard;
    if (!tl.showTrendLine.value || values.length < 2) return;
    const trendType = (resolveDropdown(tl.trendLineType) ?? 'linear') as TrendType;
    const result = computeRegression(values, trendType, tl.polynomialOrder.value);
    renderTrendLine(g, {
      predicted: result.predicted,
      xScale,
      yScale,
      lineColor: tl.trendLineColor.value?.value ?? '#6366F1',
      lineWidth: tl.trendLineWidth.value,
      showEquation: tl.showEquation.value,
      showR2: tl.showR2.value,
      equation: result.equation,
      r2: result.r2,
    });
  }

  // ── Annotations ─────────────────────────────────────────────────

  private renderAnnotationOverlay(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    resolvePosition: (category: string) => { x: number; y: number } | null,
  ): void {
    const ann = this.settings.annotationFormattingCard;
    if (!ann.showAnnotations.value) return;
    const slots = [
      { category: ann.annotation1Category.value, text: ann.annotation1Text.value, position: resolveDropdown(ann.annotation1Position) ?? 'above' },
      { category: ann.annotation2Category.value, text: ann.annotation2Text.value, position: resolveDropdown(ann.annotation2Position) ?? 'above' },
      { category: ann.annotation3Category.value, text: ann.annotation3Text.value, position: resolveDropdown(ann.annotation3Position) ?? 'above' },
    ];
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
    if (config) renderAnnotations(g, config);
  }

  // ── Formatting Pane ──────────────────────────────────────────

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    syncCardStyleVisibility(this.settings.cardSettings);
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  // ── Selection & Cross-Highlight ─────────────────────────────────

  private applySelectionHighlight(): void {
    const hasSelection = this.selectionManager.hasSelection();
    const selectedIds = this.selectionManager.getSelectionIds() as ISelectionId[];
    const selectedKeys = new Set(selectedIds.map((id) => id.getKey()));

    // Build set of highlighted keys from cross-highlight data
    const data = this.currentData;
    const highlightedKeys = new Set<string>();
    if (this.hasHighlights && data) {
      for (const item of data) {
        if (item.highlighted) {
          highlightedKeys.add(item.selectionId.getKey());
        }
      }
    }

    const shouldDim = hasSelection || this.hasHighlights;
    const allElements = this.container.querySelectorAll<SVGElement>(
      '[data-selection-key][data-base-opacity]',
    );
    for (const el of allElements) {
      const baseOpacity = Number(el.dataset['baseOpacity'] ?? '1');
      if (shouldDim) {
        const elKey = el.getAttribute('data-selection-key');
        const isSelected = hasSelection && elKey && selectedKeys.has(elKey);
        const isHighlighted = this.hasHighlights && elKey && highlightedKeys.has(elKey);
        el.style.opacity = String(
          (isSelected || isHighlighted) ? baseOpacity : baseOpacity * 0.3,
        );
      } else {
        el.style.opacity = String(baseOpacity);
      }
    }
  }

  private handleBackgroundClick = (): void => {
    if (!allowInteractions(this.host)) return;
    void this.selectionManager.clear();
    this.applySelectionHighlight();
  };

  private handleBackgroundContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    if (!allowInteractions(this.host)) return;
    void this.selectionManager.showContextMenu({} as powerbi.visuals.ISelectionId, {
      x: event.clientX,
      y: event.clientY,
    });
  };

  private applyHighContrast(): void {
    applyBasicHighContrastStyles(this.container, getHostHighContrastColors(this.host), {
      textSelectors: [
        '.bump-empty',
        '.chart-title',
        '.chart-subtitle',
        '.bump-axis text',
        '.bump-rank-label',
        '.rank-change-label',
        '.bump-comparison-badge',
        '.pbi-shared-legend span',
        '.crosshair-label',
      ],
      lineSelectors: [
        '.bump-axis line',
        '.bump-axis path',
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
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.container.removeEventListener('contextmenu', this.handleBackgroundContextMenu);
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];
    this.svg = null;
  }
}
