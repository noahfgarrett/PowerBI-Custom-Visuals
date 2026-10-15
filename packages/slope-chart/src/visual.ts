/**
 * Slope Chart — Power BI IVisual implementation.
 * Two vertical columns (before/after) with lines connecting corresponding values,
 * colored green/red by direction.
 */

import powerbi from 'powerbi-visuals-api';
import * as d3 from 'd3';
import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel';
import { SlopeChartSettings } from './settings';
import {
  drawPath,
  popIn,
  fadeSlideIn,
  animate,
  cubicOut,
  DURATION,
  formatWithSettings,
  applyCardStyle,
  type CardStyleMode,
  withOpacity,
  renderChartTitle,
  applyDataLabelFormatting,
  resolveDropdown,
  buildConditionalConfig,
  resolveConditionalColor,
  applyChartAria,
  attachKeyboardNav,
  ensureFocusRingStyles,
  attachEmptySpaceContextMenu,
  allowInteractions,
  applyBasicHighContrastStyles,
  getHostHighContrastColors,
  notifyRenderingStarted,
  notifyRenderingFinished,
  notifyRenderingFailed,
  renderLandingPage,
  renderNoDataState,
  attachCrosshair,
  buildCrosshairConfig,
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
  renderLegend,
  type LegendItem,
  getDateFilterIndices,
  isDateColumn,
  type DateFilterConfig,
  resolveColorTheme,
  getHostChartColor,
  getVisualEmptyStateMode,
  getLocalizedString,
  syncTitleFormattingVisibility,
  syncLegendFormattingVisibility,
  syncCardStyleVisibility,
  syncDateFilterFormattingVisibility,
  hideInlineLegendFormatting,
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

interface SlopeItem {
  sourceIndex: number;
  category: string;
  startValue: number;
  endValue: number;
  selectionId: ISelectionId;
  highlighted: boolean;
}

// ── Constants ────────────────────────────────────────────────────

const MARGIN = { top: 40, right: 100, bottom: 16, left: 100 };
const EMPTY_STATE_TEXT = 'Add Category, Start Value, and End Value fields to build the Slope Chart.';
const MIN_INNER_SIZE = 20;

// ── Visual ───────────────────────────────────────────────────────

export class SlopeChartVisual implements IVisual {
  private host: IVisualHost;
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private container: HTMLElement;
  private settings: SlopeChartSettings;
  private formattingSettingsService: FormattingSettingsService;
  private cancelAnimations: Array<() => void> = [];
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
  private currentHasHighlights = false;
  private currentData: SlopeItem[] = [];
  private detachEmptySpaceContextMenu: (() => void) | null = null;
  private emptyStateMode: 'unconfigured' | 'noData' = 'unconfigured';

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new SlopeChartSettings();
    this.formattingSettingsService = new FormattingSettingsService(options.host.createLocalizationManager());
    this.container.classList.add('slope-container');
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
      // Cancel running animations
      this.cancelAnimations.forEach((cancel) => cancel());
      this.cancelAnimations = [];

    // Parse settings from dataView
      const dataView = options.dataViews?.[0];
      this.emptyStateMode = getVisualEmptyStateMode(dataView);
      if (dataView) {
        this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
          SlopeChartSettings,
          dataView
        );
      }

    // Migrate legacy enableGlass -> cardStyleMode (backward compat)
      const legacyCardObj = dataView?.metadata?.objects?.['cardSettings'];
      if (legacyCardObj) {
        const legacyGlass = legacyCardObj['enableGlass'];
        const modernCardStyle = legacyCardObj['cardStyleMode'];
        if (modernCardStyle === undefined && legacyGlass === false) {
          this.settings.cardSettings.cardStyleMode.value = { value: 'none', displayName: 'None' };
        }
      }

    const legacySlopeObj = dataView?.metadata?.objects?.['slopeSettings'];
    const lineStrokeObj = dataView?.metadata?.objects?.['lineStrokeFormatting'];
    if (typeof legacySlopeObj?.['lineWidth'] === 'number' && typeof lineStrokeObj?.['lineWidth'] !== 'number') {
      this.settings.lineStrokeFormattingCard.lineWidth.value = legacySlopeObj['lineWidth'];
    }

    syncDateFilterFormattingVisibility(this.settings.dateFilterFormattingCard);
    syncTitleFormattingVisibility(this.settings.titleFormattingCard);
    syncCardStyleVisibility(this.settings.cardSettings);
    const cardStyleMode = (resolveDropdown(this.settings.cardSettings.cardStyleMode) ?? 'glass') as CardStyleMode;
    this.settings.cardSettings.borderRadius.visible = cardStyleMode !== 'none';

    this.settings.dataLabelFormattingCard.showDataLabels.visible = false;

    // Hide dead axis/grid properties — slope-chart has its own axis rendering
    this.settings.axisFormattingCard.xAxisTitle.visible = false;
    this.settings.axisFormattingCard.yAxisTitle.visible = false;
    this.settings.axisFormattingCard.showXAxis.visible = false;
    this.settings.axisFormattingCard.showYAxis.visible = false;
    this.settings.axisFormattingCard.yAxisMin.visible = false;
    this.settings.axisFormattingCard.yAxisMax.visible = false;
    this.settings.axisFormattingCard.axisLabelRotation.visible = false;
    this.settings.axisFormattingCard.integerTicks.visible = false;

    // Hide dual-axis-only properties (no combo/dual-axis support)
    this.settings.referenceLineFormattingCard.referenceLineAxis.visible = false;
    this.settings.trendLineFormattingCard.trendLineAxis.visible = false;

    // ── Conditional Visibility ──────────────────────────────────
    this.settings.slopeSettings.fillOpacity.visible = this.settings.slopeSettings.showArea.value;
    this.settings.slopeSettings.dotRadius.visible = this.settings.slopeSettings.showDots.value;
    this.settings.slopeSettings.dotStrokeColor.visible = this.settings.slopeSettings.showDots.value;

    const colorByDir = this.settings.directionColorSettings.colorByDirection.value;
    this.settings.directionColorSettings.positiveColor.visible = colorByDir;
    this.settings.directionColorSettings.negativeColor.visible = colorByDir;
    this.settings.directionColorSettings.neutralColor.visible = true;
    this.settings.legendFormattingCard.visible = colorByDir;
    syncLegendFormattingVisibility(this.settings.legendFormattingCard);
    hideInlineLegendFormatting(this.settings.legendFormattingCard);

    const thresholdShow = this.settings.slopeThresholdSettings.show.value;
    this.settings.slopeThresholdSettings.threshold.visible = thresholdShow;
    this.settings.slopeThresholdSettings.glowColor.visible = thresholdShow;

    const changeLabelShow = this.settings.changeLabelSettings.show.value;
    this.settings.changeLabelSettings.fontSize.visible = changeLabelShow;
    this.settings.changeLabelSettings.fontColor.visible = changeLabelShow;
    this.settings.changeLabelSettings.fontFamily.visible = changeLabelShow;
    this.settings.changeLabelSettings.fontWeight.visible = changeLabelShow;
    this.settings.changeLabelSettings.format.visible = changeLabelShow;
    this.settings.changeLabelSettings.position.visible = changeLabelShow;
    this.settings.changeLabelSettings.labelOffset.visible = changeLabelShow;

    const showGrid = this.settings.axisFormattingCard.showGridLines.value;
    this.settings.axisFormattingCard.gridLineColor.visible = showGrid;
    this.settings.axisFormattingCard.gridLineStyle.visible = showGrid;
    this.settings.axisFormattingCard.gridLineWidth.visible = showGrid;
    this.settings.axisFormattingCard.gridLineOpacity.visible = showGrid;

    const showRef = this.settings.referenceLineFormattingCard.showReferenceLine.value;
    const refType = resolveDropdown(this.settings.referenceLineFormattingCard.referenceLineType) ?? 'custom';
    const showRefBand = showRef && this.settings.referenceLineFormattingCard.showReferenceBand.value;
    this.settings.referenceLineFormattingCard.referenceLineType.visible = showRef;
    this.settings.referenceLineFormattingCard.referenceLineValue.visible = showRef && refType === 'custom';
    this.settings.referenceLineFormattingCard.referenceLineColor.visible = showRef;
    this.settings.referenceLineFormattingCard.referenceLineWidth.visible = showRef;
    this.settings.referenceLineFormattingCard.referenceLineStyle.visible = showRef;
    this.settings.referenceLineFormattingCard.showReferenceLabel.visible = showRef;
    this.settings.referenceLineFormattingCard.referenceLabelText.visible = showRef && this.settings.referenceLineFormattingCard.showReferenceLabel.value;
    this.settings.referenceLineFormattingCard.showReferenceBand.visible = showRef;
    this.settings.referenceLineFormattingCard.referenceBandOpacity.visible = showRefBand;
    this.settings.referenceLineFormattingCard.referenceBandWidth.visible = showRefBand;

    const showTrend = this.settings.trendLineFormattingCard.showTrendLine.value;
    const trendType = resolveDropdown(this.settings.trendLineFormattingCard.trendLineType) ?? 'linear';
    this.settings.trendLineFormattingCard.trendLineType.visible = showTrend;
    this.settings.trendLineFormattingCard.polynomialOrder.visible = showTrend && trendType === 'polynomial';
    this.settings.trendLineFormattingCard.trendLineColor.visible = showTrend;
    this.settings.trendLineFormattingCard.trendLineWidth.visible = showTrend;
    this.settings.trendLineFormattingCard.showEquation.visible = showTrend;
    this.settings.trendLineFormattingCard.showR2.visible = showTrend;

    const showConditional = this.settings.conditionalFormattingCard.enableConditional.value;
    this.settings.conditionalFormattingCard.conditionalDirection.visible = showConditional;
    this.settings.conditionalFormattingCard.threshold1.visible = showConditional;
    this.settings.conditionalFormattingCard.threshold2.visible = showConditional;
    this.settings.conditionalFormattingCard.conditionalColor1.visible = showConditional;
    this.settings.conditionalFormattingCard.conditionalColor2.visible = showConditional;
    this.settings.conditionalFormattingCard.conditionalColor3.visible = showConditional;

    const showCrosshair = this.settings.crosshairFormattingCard.showCrosshair.value;
    this.settings.crosshairFormattingCard.crosshairLineColor.visible = showCrosshair;
    this.settings.crosshairFormattingCard.crosshairLineWidth.visible = showCrosshair;
    this.settings.crosshairFormattingCard.crosshairLineStyle.visible = showCrosshair;
    this.settings.crosshairFormattingCard.crosshairOpacity.visible = showCrosshair;
    this.settings.crosshairFormattingCard.showCrosshairValues.visible = showCrosshair;

    const showAnnotations = this.settings.annotationFormattingCard.showAnnotations.value;
    for (const slice of this.settings.annotationFormattingCard.slices) {
      if (slice !== this.settings.annotationFormattingCard.showAnnotations) slice.visible = showAnnotations;
    }
    this.settings.animationSettings.duration.visible = this.settings.animationSettings.enabled.value;

    // Extract data
      let data = this.extractData(dataView);

    // Track cross-highlight state
      this.currentHasHighlights = data !== null && data.some((d) => d.highlighted);

    // Sort by magnitude of change if enabled
      if (data && this.settings.slopeDisplaySettings.sortByMagnitude.value) {
        data = [...data].sort((a, b) =>
          Math.abs(b.endValue - b.startValue) - Math.abs(a.endValue - a.startValue)
        );
      }

      this.currentData = data ?? [];
      this.populateCategoryFormattingGroups(dataView, this.currentData);

      // Render
      this.render(data, options.viewport);
      applyBasicHighContrastStyles(this.container, getHostHighContrastColors(this.host), {
        textSelectors: [
          '.slope-container svg text',
          '.pbi-landing-page-title',
          '.pbi-landing-page-description',
          '.pbi-landing-page-hint',
          '.pbi-no-data-state',
        ],
        lineSelectors: ['.slope-axis-line', '.slope-grid-line'],
        fillSelectors: ['.slope-dot'],
        strokeSelectors: ['.slope-line', '.slope-dot', '.slope-axis-line', '.slope-grid-line'],
      });
      notifyRenderingFinished(this.host, options);
    } catch (error) {
      notifyRenderingFailed(this.host, options, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  // ── Data Extraction ──────────────────────────────────────────

  private extractData(dataView: DataView | undefined): SlopeItem[] | null {
    if (!dataView?.categorical) return null;

    const categorical = dataView.categorical;
    const categories = categorical.categories;
    const values = categorical.values;

    if (!categories || categories.length < 1 || !values || values.length < 2) return null;

    // Find columns by role
    let categoryColumn: powerbi.DataViewCategoryColumn | undefined;
    let startColumn: powerbi.DataViewValueColumn | undefined;
    let endColumn: powerbi.DataViewValueColumn | undefined;

    for (const cat of categories) {
      const roles = cat.source.roles;
      if (!roles) continue;
      if (roles['category']) categoryColumn = cat;
    }

    for (const val of values) {
      const roles = val.source.roles;
      if (!roles) continue;
      if (roles['startMeasure']) startColumn = val;
      if (roles['endMeasure']) endColumn = val;
    }

    if (!categoryColumn || !startColumn || !endColumn) return null;

    const rowCount = categoryColumn.values.length;
    if (rowCount === 0) return null;

    // Read cross-highlight data
    const startHighlights = startColumn.highlights as unknown[] | undefined;
    const endHighlights = endColumn.highlights as unknown[] | undefined;

    const items: SlopeItem[] = [];

    const dateConfig: DateFilterConfig = {
      enabled: this.settings.dateFilterFormattingCard.enableDateFilter.value,
      startDate: this.settings.dateFilterFormattingCard.startDate.value,
      endAtCurrentDate: this.settings.dateFilterFormattingCard.endAtCurrentDate.value,
      endDate: this.settings.dateFilterFormattingCard.endDate.value,
    };
    const dateIndices = isDateColumn(categoryColumn.source) ? getDateFilterIndices(categoryColumn.values, dateConfig) : null;

    for (let i = 0; i < rowCount; i++) {
      if (dateIndices && !dateIndices.has(i)) continue;

      const catVal = categoryColumn.values[i];
      const startVal = startColumn.values[i];
      const endVal = endColumn.values[i];

      if (catVal == null || startVal == null || endVal == null) continue;

      const startNum = typeof startVal === 'number' ? startVal : Number(startVal);
      const endNum = typeof endVal === 'number' ? endVal : Number(endVal);

      if (!Number.isFinite(startNum) || !Number.isFinite(endNum)) continue;

      // A point is highlighted if its highlight value is non-null in either column
      const startHl = startHighlights ? startHighlights[i] : undefined;
      const endHl = endHighlights ? endHighlights[i] : undefined;
      const isHighlighted = startHl != null || endHl != null;

      items.push({
        sourceIndex: i,
        category: String(catVal),
        startValue: startNum,
        endValue: endNum,
        selectionId: this.host.createSelectionIdBuilder()
          .withCategory(categoryColumn, i)
          .createSelectionId(),
        highlighted: isHighlighted,
      });
    }

    if (items.length === 0) return null;
    return items;
  }

  private populateCategoryFormattingGroups(dataView: DataView | undefined, items: SlopeItem[]): void {
    const categoryColumn = dataView?.categorical?.categories?.find((column) => column.source.roles?.['category']);
    const baseLineWidth = Math.max(0, this.settings.lineStrokeFormattingCard.lineWidth.value);
    const baseLineStyle = resolveDropdown(this.settings.lineStrokeFormattingCard.lineStyle) ?? 'solid';

    this.settings.seriesFormattingCard.groups = items.map((item, index) => {
      const group = new SeriesFormattingGroup({
        name: `category_${index}`,
        displayName: item.category,
      });
      group.lineWidth.value = baseLineWidth;
      group.lineStyle.value = { value: baseLineStyle, displayName: baseLineStyle };

      const selector = (item.selectionId as ISelectionId & { getSelector?: () => unknown }).getSelector?.();
      for (const slice of group.slices) {
        slice.selector = selector;
      }

      const objects = categoryColumn?.objects?.[item.sourceIndex]?.['seriesFormatting'];
      if (objects) {
        const color = objects['seriesColor'] as { solid?: { color?: string } } | undefined;
        if (color?.solid?.color) group.seriesColor.value = { value: color.solid.color };
        if (typeof objects['seriesOpacity'] === 'number') group.seriesOpacity.value = objects['seriesOpacity'];
        if (typeof objects['showDataLabels'] === 'boolean') group.showDataLabels.value = objects['showDataLabels'];
        const lineStyle = objects['lineStyle'];
        const lineStyleValue = typeof lineStyle === 'string'
          ? lineStyle
          : (lineStyle as { value?: string } | undefined)?.value;
        if (lineStyleValue) group.lineStyle.value = { value: lineStyleValue, displayName: lineStyleValue };
        if (typeof objects['lineWidth'] === 'number') group.lineWidth.value = objects['lineWidth'];
      }

      return group;
    });
  }

  // ── Rendering ────────────────────────────────────────────────

  private render(data: SlopeItem[] | null, viewport: powerbi.IViewport): void {
    // Clear previous content
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    renderChartTitle(this.container, this.settings.titleFormattingCard);
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.svg = null;

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

    const width = Math.max(0, viewport.width - contentPadding * 2);
    const height = Math.max(0, viewport.height - contentPadding * 2);
    const horizontalMargin = Math.min(
      MARGIN.left,
      Math.max(36, (width - MIN_INNER_SIZE) / 2),
    );
    const margin = {
      top: Math.min(MARGIN.top, Math.max(24, height * 0.15)),
      right: horizontalMargin,
      bottom: Math.min(MARGIN.bottom, Math.max(8, height * 0.08)),
      left: horizontalMargin,
    };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    if (innerWidth < MIN_INNER_SIZE || innerHeight < MIN_INNER_SIZE) {
      renderNoDataState(
        this.container,
        getLocalizedString(this.host, 'SlopeChart_SizeState', 'Increase the visual size to display the slope chart.'),
        getHostHighContrastColors(this.host),
      );
      return;
    }

    // Create SVG
    const svg = d3.select(this.container)
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    this.svg = svg;

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Positions for left and right columns
    const leftX = 0;
    const rightX = innerWidth;

    // Y-scale: shared domain across all start and end values
    const allValues = data.flatMap((d) => [d.startValue, d.endValue]);
    const minVal = d3.min(allValues) ?? 0;
    const maxVal = d3.max(allValues) ?? 0;
    const padding = (maxVal - minVal) * 0.1 || 1;

    const yScale = d3.scaleLinear()
      .domain([minVal - padding, maxVal + padding])
      .range([innerHeight, 0]);

    // Settings
    const dotRadius = s.slopeSettings.dotRadius.value;
    const colorByDirection = s.directionColorSettings.colorByDirection.value;
    const themeName = resolveColorTheme(s.colorThemeFormattingCard);
    const positiveColor = themeName !== 'default'
      ? getHostChartColor(this.host.colorPalette, 0, themeName)
      : (s.directionColorSettings.positiveColor.value?.value || '#34D399');
    const negativeColor = themeName !== 'default'
      ? getHostChartColor(this.host.colorPalette, 1, themeName)
      : (s.directionColorSettings.negativeColor.value?.value || '#F87171');
    const neutralColor = themeName !== 'default'
      ? getHostChartColor(this.host.colorPalette, 2, themeName)
      : (s.directionColorSettings.neutralColor.value?.value || '#94A3B8');
    const leftLabel = s.changeLabelSettings.leftLabel.value;
    const rightLabel = s.changeLabelSettings.rightLabel.value;
    const animEnabled = s.animationSettings.enabled.value;
    const animDuration = s.animationSettings.duration.value;

    // Dot stroke color — apply setting if set, otherwise fall back to white
    const dotStrokeColorValue = s.slopeSettings.dotStrokeColor.value?.value;
    const dotStrokeColor = dotStrokeColorValue && dotStrokeColorValue.length > 0 ? dotStrokeColorValue : '#FFFFFF';

    // Axis formatting — resolve user picks with sensible defaults
    const axisLabelColor = s.axisFormattingCard.axisLabelColor.value?.value || '#64748B';
    const axisLabelSize = s.axisFormattingCard.axisLabelSize.value;
    const axisLabelFontFamily = resolveDropdown(s.axisFormattingCard.axisLabelFontFamily) || undefined;
    const axisLabelFontWeight = resolveDropdown(s.axisFormattingCard.axisLabelFontWeight) || 'normal';
    const axisLineColor = s.axisFormattingCard.axisLineColor.value?.value || '#CBD5E1';
    const axisLineWidth = s.axisFormattingCard.axisLineWidth.value;

    // Grid formatting
    const showGridLines = s.axisFormattingCard.showGridLines.value;
    const gridLineColor = s.axisFormattingCard.gridLineColor.value?.value || '#E2E8F0';
    const gridLineStyleValue = s.axisFormattingCard.gridLineStyle.value;
    const gridLineStyle = typeof gridLineStyleValue === 'string'
      ? gridLineStyleValue
      : (gridLineStyleValue as { value?: string } | undefined)?.value ?? 'dashed';
    const gridDash = gridLineStyle === 'dashed' ? '4 3' : gridLineStyle === 'dotted' ? '2 2' : 'none';
    const gridLineWidth = s.axisFormattingCard.gridLineWidth.value;
    const gridLineOpacity = Math.max(0, Math.min(100, s.axisFormattingCard.gridLineOpacity.value)) / 100;

    // Label color — apply setting if set, otherwise fall back to axisLabelColor
    const labelColorValue = s.changeLabelSettings.labelColor.value?.value;
    const labelColor = labelColorValue && labelColorValue.length > 0 ? labelColorValue : axisLabelColor;
    // Value tspan uses the resolved axis label color (respects user setting)
    const valueLabelColor = axisLabelColor;

    // ── Column Headers ──────────────────────────────────────────

    const headerGroup = g.append('g').attr('class', 'slope-headers');

    headerGroup.append('text')
      .attr('class', 'slope-header')
      .attr('x', leftX)
      .attr('y', -12)
      .attr('text-anchor', 'middle')
      .attr('font-size', axisLabelSize + 2)
      .attr('font-family', axisLabelFontFamily || null)
      .attr('font-weight', axisLabelFontWeight)
      .attr('fill', axisLabelColor)
      .text(leftLabel);

    headerGroup.append('text')
      .attr('class', 'slope-header')
      .attr('x', rightX)
      .attr('y', -12)
      .attr('text-anchor', 'middle')
      .attr('font-size', axisLabelSize + 2)
      .attr('font-family', axisLabelFontFamily || null)
      .attr('font-weight', axisLabelFontWeight)
      .attr('fill', axisLabelColor)
      .text(rightLabel);

    // ── Column Axes (vertical lines) ────────────────────────────

    const axisGroup = g.append('g').attr('class', 'slope-axes');

    axisGroup.append('line')
      .attr('class', 'slope-axis-line')
      .attr('x1', leftX)
      .attr('y1', 0)
      .attr('x2', leftX)
      .attr('y2', innerHeight)
      .attr('stroke', axisLineColor)
      .attr('stroke-width', axisLineWidth);

    axisGroup.append('line')
      .attr('class', 'slope-axis-line')
      .attr('x1', rightX)
      .attr('y1', 0)
      .attr('x2', rightX)
      .attr('y2', innerHeight)
      .attr('stroke', axisLineColor)
      .attr('stroke-width', axisLineWidth);

    // ── Grid Lines (horizontal) ─────────────────────────────────

    if (showGridLines) {
      const gridGroup = g.append('g').attr('class', 'slope-grid');
      const ticks = yScale.ticks(6);
      ticks.forEach((tick) => {
        const y = yScale(tick);
        gridGroup.append('line')
          .attr('class', 'slope-grid-line')
          .attr('x1', leftX)
          .attr('y1', y)
          .attr('x2', rightX)
          .attr('y2', y)
          .attr('stroke', gridLineColor)
          .attr('stroke-width', gridLineWidth)
          .attr('stroke-dasharray', gridDash)
          .attr('stroke-opacity', gridLineOpacity)
          .attr('fill', 'none');
      });
    }

    // ── Reference Line ────────────────────────────────────────────

    this.renderReferenceLine(g, yScale, innerWidth, allValues);

    // ── Slope Lines ─────────────────────────────────────────────

    const lineGroup = g.append('g').attr('class', 'slope-lines');

    const getLineColor = (item: SlopeItem): string => {
      // Conditional formatting takes precedence when enabled
      const delta = item.endValue - item.startValue;
      const condColor = this.getConditionalColor(delta);
      if (condColor) return condColor;

      if (!colorByDirection) return neutralColor;
      if (delta > 0) return positiveColor;
      if (delta < 0) return negativeColor;
      return neutralColor;
    };

    // ── Area Fill (gradient polygons beneath slope lines) ────
    const showArea = s.slopeSettings.showArea.value;
    const fillOpacity = Math.max(0, Math.min(100, s.slopeSettings.fillOpacity.value)) / 100;

    if (showArea) {
      const defs = svg.append('defs');
      const areaGroup = g.append('g').attr('class', 'slope-areas');

      data.forEach((item, i) => {
        const y1 = yScale(item.startValue);
        const y2 = yScale(item.endValue);
        const baseColor = getLineColor(item);
        const areaFmt = resolveSeriesFormatting(this.settings.seriesFormattingCard, i, baseColor);
        const color = areaFmt.color;

        // Define a left-to-right linear gradient for this slope line
        const gradientId = `slope-area-gradient-${i}`;
        const gradient = defs.append('linearGradient')
          .attr('id', gradientId)
          .attr('x1', '0%')
          .attr('y1', '0%')
          .attr('x2', '100%')
          .attr('y2', '0%');

        gradient.append('stop')
          .attr('offset', '0%')
          .attr('stop-color', color)
          .attr('stop-opacity', fillOpacity * (areaFmt.opacity / 100));

        gradient.append('stop')
          .attr('offset', '100%')
          .attr('stop-color', color)
          .attr('stop-opacity', fillOpacity * 0.3 * (areaFmt.opacity / 100));

        // Build a polygon: top-left endpoint -> top-right endpoint -> bottom-right -> bottom-left
        const polygonPoints = [
          `${leftX},${y1}`,
          `${rightX},${y2}`,
          `${rightX},${innerHeight}`,
          `${leftX},${innerHeight}`,
        ].join(' ');

        areaGroup.append('polygon')
          .attr('class', 'slope-area')
          .attr('data-series', String(i))
          .attr('points', polygonPoints)
          .attr('fill', `url(#${gradientId})`)
          .attr('stroke', 'none')
          .style('transition', 'opacity 0.15s ease');
      });
    }

    const paths: SVGPathElement[] = [];

    data.forEach((item, i) => {
      const y1 = yScale(item.startValue);
      const y2 = yScale(item.endValue);
      const color = getLineColor(item);
      const fmt = resolveSeriesFormatting(this.settings.seriesFormattingCard, i, color);
      const tooltipItems: VisualTooltipDataItem[] = [
        { displayName: 'Category', value: item.category },
        { displayName: 'Start', value: formatWithSettings(item.startValue, this.settings.numberFormattingCard) },
        { displayName: 'End', value: formatWithSettings(item.endValue, this.settings.numberFormattingCard) },
        { displayName: 'Change', value: `${item.endValue - item.startValue >= 0 ? '+' : ''}${formatWithSettings(item.endValue - item.startValue, this.settings.numberFormattingCard)}` },
      ];

      const path = lineGroup.append('path')
        .attr('class', 'slope-line')
        .attr('data-series', String(i))
        .attr('d', `M ${leftX} ${y1} L ${rightX} ${y2}`)
        .attr('stroke', fmt.color)
        .attr('stroke-width', fmt.lineWidth)
        .attr('fill', 'none')
        .attr('stroke-linecap', 'round')
        .attr('opacity', fmt.opacity / 100)
        .style('transition', 'opacity 0.15s ease');

      const dashArray = lineStyleToDashArray(fmt.lineStyle);
      if (dashArray !== 'none') {
        path.attr('stroke-dasharray', dashArray);
      }

      const showSlopeTooltip = (event: MouseEvent): void => {
        this.host.tooltipService.show({
          dataItems: tooltipItems,
          identities: [item.selectionId],
          coordinates: [event.clientX, event.clientY],
          isTouchEvent: false,
        });
      };

      path.style('pointer-events', 'none');
      path.on('mouseover', showSlopeTooltip);
      path.on('mousemove', showSlopeTooltip);
      path.on('mouseout', () => {
        this.host.tooltipService.hide({ immediately: true, isTouchEvent: false });
      });
      this.attachSelection(path, item.selectionId);

      const lineHitArea = lineGroup.append('path')
        .attr('class', 'slope-line-hit-area')
        .attr('data-series', String(i))
        .attr('d', `M ${leftX} ${y1} L ${rightX} ${y2}`)
        .attr('stroke', 'transparent')
        .attr('stroke-width', Math.max(fmt.lineWidth, 14))
        .attr('stroke-linecap', 'round')
        .attr('fill', 'none')
        .style('cursor', 'pointer');
      lineHitArea.on('mouseover', showSlopeTooltip);
      lineHitArea.on('mousemove', showSlopeTooltip);
      lineHitArea.on('mouseout', () => {
        this.host.tooltipService.hide({ immediately: true, isTouchEvent: false });
      });
      this.attachSelection(lineHitArea, item.selectionId);

      const pathNode = path.node();
      if (pathNode) {
        paths.push(pathNode);
      }
    });

    // ── Dots ────────────────────────────────────────────────────

    const dotGroup = g.append('g').attr('class', 'slope-dots');
    const dots: SVGElement[] = [];
    const showDotsToggle = s.slopeSettings.showDots.value;

    data.forEach((item, i) => {
      const y1 = yScale(item.startValue);
      const y2 = yScale(item.endValue);
      const color = getLineColor(item);
      const fmt = resolveSeriesFormatting(this.settings.seriesFormattingCard, i, color);

      if (showDotsToggle) {
        // Start dot
        const startDot = dotGroup.append('circle')
          .attr('class', 'slope-dot')
          .attr('data-series', String(i))
          .attr('cx', leftX)
          .attr('cy', y1)
          .attr('r', dotRadius)
          .attr('fill', fmt.color)
          .attr('stroke', dotStrokeColor)
          .attr('stroke-width', 1.5)
          .attr('opacity', fmt.opacity / 100)
          .style('transition', 'opacity 0.15s ease');
        this.attachSelection(startDot, item.selectionId);

        const startDotNode = startDot.node();
        if (startDotNode) dots.push(startDotNode);

        // End dot
        const endDot = dotGroup.append('circle')
          .attr('class', 'slope-dot')
          .attr('data-series', String(i))
          .attr('cx', rightX)
          .attr('cy', y2)
          .attr('r', dotRadius)
          .attr('fill', fmt.color)
          .attr('stroke', dotStrokeColor)
          .attr('stroke-width', 1.5)
          .attr('opacity', fmt.opacity / 100)
          .style('transition', 'opacity 0.15s ease');
        this.attachSelection(endDot, item.selectionId);

        const endDotNode = endDot.node();
        if (endDotNode) dots.push(endDotNode);
      }
    });

    // ── Labels ──────────────────────────────────────────────────

    const labelGroup = g.append('g').attr('class', 'slope-labels');
    const labels: SVGElement[] = [];

    data.forEach((item, i) => {
      const y1 = yScale(item.startValue);
      const y2 = yScale(item.endValue);
      const fmt = resolveSeriesFormatting(this.settings.seriesFormattingCard, i, getLineColor(item));
      if (!fmt.showLabels) return;

      // Start label (left side, right-aligned before the axis)
      const startLabel = labelGroup.append('text')
        .attr('class', 'slope-label')
        .attr('data-series', String(i))
        .attr('x', leftX - dotRadius - 6)
        .attr('y', y1)
        .attr('dy', '0.35em')
        .attr('text-anchor', 'end')
        .attr('font-size', axisLabelSize)
        .attr('font-family', axisLabelFontFamily || null)
        .attr('fill', labelColor)
        .style('transition', 'opacity 0.15s ease');

      startLabel.append('tspan')
        .attr('font-weight', axisLabelFontWeight)
        .text(item.category);

      startLabel.append('tspan')
        .attr('dx', '4')
        .attr('fill', valueLabelColor)
        .text(formatWithSettings(item.startValue, this.settings.numberFormattingCard));
      this.attachSelection(startLabel, item.selectionId);

      const startLabelNode = startLabel.node();
      if (startLabelNode) labels.push(startLabelNode);

      // End label (right side, left-aligned after the axis)
      const endLabel = labelGroup.append('text')
        .attr('class', 'slope-label')
        .attr('data-series', String(i))
        .attr('x', rightX + dotRadius + 6)
        .attr('y', y2)
        .attr('dy', '0.35em')
        .attr('text-anchor', 'start')
        .attr('font-size', axisLabelSize)
        .attr('font-family', axisLabelFontFamily || null)
        .attr('fill', labelColor)
        .style('transition', 'opacity 0.15s ease');

      endLabel.append('tspan')
        .attr('font-weight', axisLabelFontWeight)
        .text(item.category);

      endLabel.append('tspan')
        .attr('dx', '4')
        .attr('fill', valueLabelColor)
        .text(formatWithSettings(item.endValue, this.settings.numberFormattingCard));
      this.attachSelection(endLabel, item.selectionId);

      const endLabelNode = endLabel.node();
      if (endLabelNode) labels.push(endLabelNode);
    });

    // ── Percent Change Labels (at right end) ──────────────────────

    if (s.changeLabelSettings.showPercentChange.value) {
      const pctGroup = g.append('g').attr('class', 'slope-pct-change-labels');
      data.forEach((item, i) => {
        const y2 = yScale(item.endValue);
        const pct = item.startValue !== 0
          ? ((item.endValue - item.startValue) / Math.abs(item.startValue)) * 100
          : 0;
        const pctSign = pct >= 0 ? '+' : '';
        const pctText = item.startValue !== 0 ? `${pctSign}${pct.toFixed(1)}%` : 'N/A';
        const delta = item.endValue - item.startValue;
        const pctColor = delta > 0 ? positiveColor : delta < 0 ? negativeColor : neutralColor;

        const pctLabel = pctGroup.append('text')
          .attr('class', 'slope-pct-label')
          .attr('data-series', String(i))
          .attr('x', rightX + dotRadius + 6)
          .attr('y', y2 + axisLabelSize + 4)
          .attr('dy', '0.35em')
          .attr('text-anchor', 'start')
          .attr('font-size', Math.max(8, axisLabelSize - 2))
          .attr('font-weight', '500')
          .attr('fill', pctColor)
          .style('transition', 'opacity 0.15s ease')
          .text(pctText);

        this.attachSelection(pctLabel, item.selectionId);
      });
    }

    // ── Confidence Interval Bands ───────────────────────────────

    if (s.slopeDisplaySettings.showConfidenceInterval.value) {
      const ciGroup = g.append('g').attr('class', 'slope-confidence-intervals');
      const allDeltas = data.map((d) => d.endValue - d.startValue);
      const mean = allDeltas.reduce((sum, v) => sum + v, 0) / allDeltas.length;
      const variance = allDeltas.reduce((sum, v) => sum + (v - mean) ** 2, 0) / Math.max(1, allDeltas.length - 1);
      const stdErr = Math.sqrt(variance / allDeltas.length);
      const ci95 = stdErr * 1.96;

      data.forEach((item, i) => {
        const y1 = yScale(item.startValue);
        const y2 = yScale(item.endValue);
        const y1Upper = yScale(item.startValue + ci95);
        const y1Lower = yScale(item.startValue - ci95);
        const y2Upper = yScale(item.endValue + ci95);
        const y2Lower = yScale(item.endValue - ci95);
        const color = getLineColor(item);
        const bandPoints = [
          `${leftX},${y1Upper}`,
          `${rightX},${y2Upper}`,
          `${rightX},${y2Lower}`,
          `${leftX},${y1Lower}`,
        ].join(' ');

        ciGroup.append('polygon')
          .attr('class', 'slope-ci-band')
          .attr('data-series', String(i))
          .attr('points', bandPoints)
          .attr('fill', color)
          .attr('fill-opacity', 0.1)
          .attr('stroke', 'none');
      });
    }

    // ── Threshold Glow Highlight ────────────────────────────────

    if (s.slopeThresholdSettings.show.value) {
      const thresholdVal = s.slopeThresholdSettings.threshold.value;
      const glowColor = s.slopeThresholdSettings.glowColor.value?.value || '#F59E0B';

      data.forEach((item, i) => {
        const delta = Math.abs(item.endValue - item.startValue);
        if (delta >= thresholdVal) {
          // Apply glow filter to the matching slope line
          const lineEl = lineGroup.select(`.slope-line[data-series="${i}"]`);
          if (!lineEl.empty()) {
            // Create a glow filter if not yet created
            let defs = svg.select<SVGDefsElement>('defs');
            if (defs.empty()) {
              defs = svg.append('defs');
            }
            const filterId = 'slope-threshold-glow';
            if (defs.select(`#${filterId}`).empty()) {
              const filter = defs.append('filter')
                .attr('id', filterId)
                .attr('x', '-50%').attr('y', '-50%')
                .attr('width', '200%').attr('height', '200%');
              filter.append('feGaussianBlur')
                .attr('in', 'SourceGraphic')
                .attr('stdDeviation', '4')
                .attr('result', 'blur');
              filter.append('feFlood')
                .attr('flood-color', glowColor)
                .attr('flood-opacity', '0.6')
                .attr('result', 'glowColor');
              filter.append('feComposite')
                .attr('in', 'glowColor')
                .attr('in2', 'blur')
                .attr('operator', 'in')
                .attr('result', 'coloredBlur');
              const feMerge = filter.append('feMerge');
              feMerge.append('feMergeNode').attr('in', 'coloredBlur');
              feMerge.append('feMergeNode').attr('in', 'SourceGraphic');
            }
            lineEl.attr('filter', `url(#${filterId})`);
          }
        }
      });
    }

    // ── Change Labels (percentage / absolute change on each line) ──

    const changeLabelElements: SVGElement[] = [];

    if (s.changeLabelSettings.show.value) {
      const changeLabelGroup = g.append('g').attr('class', 'slope-change-labels');
      const clFontSize = s.changeLabelSettings.fontSize.value;
      const clFontColorValue = s.changeLabelSettings.fontColor.value?.value;
      const clHasCustomColor = clFontColorValue != null && clFontColorValue.length > 0;
      const clFontFamily = resolveDropdown(s.changeLabelSettings.fontFamily) || '';
      const clFontWeight = resolveDropdown(s.changeLabelSettings.fontWeight) || '600';
      const clOffset = s.changeLabelSettings.labelOffset.value;

      const clFormatValue = s.changeLabelSettings.format.value;
      const clFormat: string = typeof clFormatValue === 'string'
        ? clFormatValue
        : (clFormatValue as { value?: string } | undefined)?.value ?? 'percent';

      const clPositionValue = s.changeLabelSettings.position.value;
      const clPosition: string = typeof clPositionValue === 'string'
        ? clPositionValue
        : (clPositionValue as { value?: string } | undefined)?.value ?? 'center';

      data.forEach((item, i) => {
        const y1 = yScale(item.startValue);
        const y2 = yScale(item.endValue);
        const midX = (leftX + rightX) / 2;
        const midY = (y1 + y2) / 2;

        // Position offset based on setting
        const posOffset = clPosition === 'above' ? -clOffset : clPosition === 'below' ? clOffset : 0;

        const startVal = item.startValue;
        const endVal = item.endValue;
        const absDelta = endVal - startVal;

        // Build the label text based on format
        let labelText: string;

        if (startVal === 0) {
          // Edge case: start is zero, percent change is undefined
          if (clFormat === 'percent') {
            labelText = 'N/A';
          } else if (clFormat === 'absolute') {
            const sign = absDelta >= 0 ? '+' : '';
            labelText = `${sign}${formatWithSettings(absDelta, this.settings.numberFormattingCard)}`;
          } else {
            // 'both'
            const sign = absDelta >= 0 ? '+' : '';
            labelText = `${sign}${formatWithSettings(absDelta, this.settings.numberFormattingCard)} (N/A)`;
          }
        } else if (absDelta === 0) {
          // Edge case: identical values
          if (clFormat === 'percent') {
            labelText = '0%';
          } else if (clFormat === 'absolute') {
            labelText = '+0';
          } else {
            labelText = '+0 (0%)';
          }
        } else {
          const pctChange = ((endVal - startVal) / Math.abs(startVal)) * 100;
          const pctSign = pctChange >= 0 ? '+' : '';
          const pctStr = `${pctSign}${pctChange.toFixed(1)}%`;
          const absSign = absDelta >= 0 ? '+' : '';
          const absStr = `${absSign}${formatWithSettings(absDelta, this.settings.numberFormattingCard)}`;

          if (clFormat === 'percent') {
            labelText = pctStr;
          } else if (clFormat === 'absolute') {
            labelText = absStr;
          } else {
            // 'both'
            labelText = `${absStr} (${pctStr})`;
          }
        }

        // Determine color: custom > direction-based (green/red)
        let textColor: string;
        if (clHasCustomColor) {
          textColor = clFontColorValue;
        } else if (absDelta > 0) {
          textColor = positiveColor;
        } else if (absDelta < 0) {
          textColor = negativeColor;
        } else {
          textColor = neutralColor;
        }

        const changeLabel = changeLabelGroup.append('text')
          .attr('class', 'slope-change-label')
          .attr('data-series', String(i))
          .attr('x', midX)
          .attr('y', midY + posOffset)
          .attr('dy', '0.35em')
          .attr('text-anchor', 'middle')
          .attr('font-size', clFontSize)
          .attr('font-weight', clFontWeight)
          .attr('fill', textColor)
          .style('transition', 'opacity 0.15s ease');

        if (clFontFamily) {
          changeLabel.attr('font-family', clFontFamily);
        }

        changeLabel.text(labelText);

        this.attachSelection(changeLabel, item.selectionId);

        const changeLabelNode = changeLabel.node();
        if (changeLabelNode) changeLabelElements.push(changeLabelNode);
      });
    }

    // ── Trend Line ──────────────────────────────────────────────

    // Use end values as the trend series (one value per category)
    const trendValues = data.map((d) => d.endValue);
    const trendXScale = (index: number): number => {
      // Interpolate between leftX and rightX based on item index
      if (data.length <= 1) return (leftX + rightX) / 2;
      return leftX + (rightX - leftX) * (index / (data.length - 1));
    };
    this.renderTrendLineOverlay(g, trendValues, trendXScale, yScale);

    // ── Annotations ─────────────────────────────────────────────

    const resolveAnnotationPosition = (category: string): { x: number; y: number } | null => {
      const item = data.find((d) => d.category === category);
      if (!item) return null;
      // Place annotation at the midpoint of the slope line
      const midX = (leftX + rightX) / 2;
      const midY = (yScale(item.startValue) + yScale(item.endValue)) / 2;
      return { x: midX, y: midY };
    };
    this.renderAnnotationOverlay(g, resolveAnnotationPosition);

    // ── Crosshair (shared core) ──────────────────────────────

    const crosshairEnabled = s.crosshairFormattingCard.showCrosshair.value;
    if (crosshairEnabled) {
      const svgEl2 = svg.node();
      const chartGroupNode = g.node();
      if (svgEl2 && chartGroupNode) {
        const chStyleVal = resolveDropdown(s.crosshairFormattingCard.crosshairLineStyle) ?? 'dashed';
        // Build series data for crosshair: each slope item as a series with start/end values
        const crosshairCategories = [leftLabel, rightLabel];
        const crosshairSeries = data.map((item) => ({
          name: item.category,
          values: [item.startValue, item.endValue],
          color: getLineColor(item),
        }));
        const crosshairCleanup = attachCrosshair(buildCrosshairConfig({
          svg: svgEl2,
          chartGroup: chartGroupNode,
          marginLeft: margin.left,
          marginTop: margin.top,
          chartWidth: innerWidth,
          chartHeight: innerHeight,
          categories: crosshairCategories,
          xPositions: [leftX, rightX],
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

    // ── Series Hover Highlight/Dim ──────────────────────────────

    const svgNode = svg.node();
    if (svgNode) {
      const seriesElements = svgNode.querySelectorAll('[data-series]');
      seriesElements.forEach((el) => {
        el.addEventListener('mouseenter', () => {
          if (this.selectionManager.hasSelection() || this.currentHasHighlights) return;
          const seriesIdx = el.getAttribute('data-series');
          seriesElements.forEach((other) => {
            (other as SVGElement).style.opacity = other.getAttribute('data-series') === seriesIdx ? '1' : '0.2';
          });
        });
        el.addEventListener('mouseleave', () => {
          this.applySelectionHighlight();
        });
      });
    }

    // ── Entrance Animations ─────────────────────────────────────
    // Skip animation when cross-highlighting is active to avoid overwriting dimmed opacity
    if (animEnabled && !this.currentHasHighlights) {
      this.animateEntrance(paths, dots, labels, animDuration, changeLabelElements);
    }
    // Apply shared formatting settings
    applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.slope-label');

    // Legend
    const legendCard = this.settings.legendFormattingCard;
    if (colorByDirection && legendCard.showLegend.value) {
      const legendPos = resolveDropdown(legendCard.legendPosition) ?? 'bottom';
      const rawFontColor = legendCard.legendFontColor.value?.value;
      const legendItems: LegendItem[] = [
        { label: 'Increase', color: positiveColor },
        { label: 'Decrease', color: negativeColor },
      ];
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

    // ── Accessibility ─────────────────────────────────────────────

    this.applyAccessibility(data);

    this.container.addEventListener('click', this.handleBackgroundClick);

    // Apply selection and cross-highlight dimming
    this.applySelectionHighlight();
  }

  // ── Empty State ──────────────────────────────────────────────

  private renderEmptyState(): void {
    const colors = getHostHighContrastColors(this.host);
    if (this.emptyStateMode === 'noData') {
      renderNoDataState(
        this.container,
        getLocalizedString(this.host, 'SlopeChart_NoDataState', 'No data for the current selection.'),
        colors,
      );
      return;
    }
    renderLandingPage(this.container, {
      title: getLocalizedString(this.host, 'SlopeChart_LandingTitle', 'Add data to build a slope chart'),
      description: getLocalizedString(this.host, 'SlopeChart_LandingDescription', EMPTY_STATE_TEXT),
      steps: [
        getLocalizedString(this.host, 'SlopeChart_LandingStepCategory', 'Add a category to define each line.'),
        getLocalizedString(this.host, 'SlopeChart_LandingStepValues', 'Add start and end measures to compare change.'),
      ],
      hint: getLocalizedString(this.host, 'SlopeChart_LandingHint', 'Use category styles or direction colors to emphasize the changes that matter.'),
    }, colors);
  }

  // ── Entrance Animation ───────────────────────────────────────

  private animateEntrance(
    paths: SVGPathElement[],
    dots: SVGElement[],
    labels: SVGElement[],
    duration: number,
    changeLabels: SVGElement[] = [],
  ): void {
    const stagger = DURATION.stagger;

    // Lines via drawPath with stagger
    paths.forEach((pathEl, i) => {
      const delay = i * stagger;
      const cancel = drawPath(pathEl, duration, delay);
      this.cancelAnimations.push(cancel);
    });

    // Dots via popIn with stagger (start after lines begin)
    const dotBaseDelay = stagger * 2;
    dots.forEach((dotEl, i) => {
      const delay = dotBaseDelay + i * (stagger / 2);
      const cancel = popIn(dotEl, delay, duration);
      this.cancelAnimations.push(cancel);
    });

    // Labels via fadeSlideIn with stagger
    const labelBaseDelay = dotBaseDelay + stagger;
    labels.forEach((labelEl, i) => {
      const delay = labelBaseDelay + i * (stagger / 2);
      // SVG elements need cast for fadeSlideIn
      const direction: 'left' | 'right' = i % 2 === 0 ? 'right' : 'left';
      const cancel = fadeSlideIn(labelEl as unknown as HTMLElement, direction, duration, delay);
      this.cancelAnimations.push(cancel);
    });

    // Change labels via popIn with stagger (after regular labels)
    const changeLabelBaseDelay = labelBaseDelay + stagger;
    changeLabels.forEach((el, i) => {
      const delay = changeLabelBaseDelay + i * (stagger / 2);
      const cancel = popIn(el, delay, duration);
      this.cancelAnimations.push(cancel);
    });
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

  private applyAccessibility(data: SlopeItem[]): void {
    const acc = this.settings.accessibilityFormattingCard;
    if (!acc.enableKeyboardNav.value) {
      this.container.removeAttribute('role');
      this.container.removeAttribute('aria-label');
      return;
    }
    ensureFocusRingStyles();
    applyChartAria(this.container, {
      chartType: 'slope chart',
      title: this.settings.titleFormattingCard?.titleText?.value || undefined,
      dataPointCount: data.length,
    });

    const hitAreas = Array.from(this.container.querySelectorAll<SVGPathElement>('.slope-line-hit-area'));
    hitAreas.forEach((element, index) => {
      const item = data[index];
      if (!item) return;
      const change = item.endValue - item.startValue;
      element.setAttribute('role', 'listitem');
      element.setAttribute('tabindex', '0');
      element.setAttribute(
        'aria-label',
        `${item.category}. Start ${formatWithSettings(item.startValue, this.settings.numberFormattingCard)}. `
          + `End ${formatWithSettings(item.endValue, this.settings.numberFormattingCard)}. `
          + `Change ${change >= 0 ? '+' : ''}${formatWithSettings(change, this.settings.numberFormattingCard)}. `
          + `Item ${index + 1} of ${data.length}.`,
      );
    });

    const cleanup = attachKeyboardNav({
      container: this.container,
      itemSelector: '.slope-line-hit-area[tabindex="0"]',
      onActivate: (el) => {
        if (allowInteractions(this.host)) {
          el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        }
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
    const bandHalfWidth = Math.abs(refValue) * Math.max(0, ref.referenceBandWidth.value) / 100;
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
      bandUpperValue: refValue + bandHalfWidth,
      bandLowerValue: refValue - bandHalfWidth,
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
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  private attachSelection<E extends SVGElement>(
    node: d3.Selection<E, unknown, null, undefined>,
    selectionId: ISelectionId,
  ): void {
    node
      .attr('data-selection-key', selectionId.getKey())
      .style('cursor', allowInteractions(this.host) ? 'pointer' : 'default');
    node.on('click.selection', (event: MouseEvent) => {
      if (!allowInteractions(this.host)) return;
      event.stopPropagation();
      const selectionPromise = this.selectionManager.select(selectionId, event.ctrlKey || event.metaKey);
      this.applySelectionHighlight();
      void selectionPromise.then(() => this.applySelectionHighlight());
    });
    node.on('contextmenu.selection', (event: MouseEvent) => {
      if (!allowInteractions(this.host)) return;
      event.preventDefault();
      event.stopPropagation();
      void this.selectionManager.showContextMenu(selectionId, {
        x: event.clientX,
        y: event.clientY,
      });
    });
  }

  private handleBackgroundClick = (): void => {
    if (!allowInteractions(this.host)) return;
    const clearPromise = this.selectionManager.clear();
    this.applySelectionHighlight();
    void clearPromise.then(() => this.applySelectionHighlight());
  };

  // ── Selection and Cross-Highlight ─────────────────────────────

  private applySelectionHighlight(): void {
    const selectedKeys = new Set(
      (this.selectionManager.getSelectionIds() as ISelectionId[]).map((id) => id.getKey()),
    );
    const selectedSeries = new Set<string>();
    const highlightedSeries = new Set<string>();
    this.currentData.forEach((item, i) => {
      if (selectedKeys.has(item.selectionId.getKey())) selectedSeries.add(String(i));
      if (item.highlighted) highlightedSeries.add(String(i));
    });

    const svgNode = this.svg?.node();
    if (!svgNode) return;

    const hasSelection = selectedSeries.size > 0;
    const hasHighlights = highlightedSeries.size > 0;
    const seriesElements = svgNode.querySelectorAll('[data-series]');
    for (const el of Array.from(seriesElements)) {
      const seriesIdx = el.getAttribute('data-series');
      if (seriesIdx === null) continue;
      const isActive = (hasSelection && selectedSeries.has(seriesIdx))
        || (hasHighlights && highlightedSeries.has(seriesIdx));
      (el as SVGElement).style.opacity = hasSelection || hasHighlights
        ? (isActive ? '' : '0.3')
        : '';
    }
  }

  // ── Lifecycle ────────────────────────────────────────────────

  public destroy(): void {
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.detachEmptySpaceContextMenu?.();
    this.detachEmptySpaceContextMenu = null;
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];
    this.svg = null;
  }
}
