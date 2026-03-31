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
  populateSeriesFormattingGroups,
  lineStyleToDashArray,
  renderLegend,
  type LegendItem,
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

// ── Internal Types ───────────────────────────────────────────────

interface SlopeItem {
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

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new SlopeChartSettings();
    this.formattingSettingsService = new FormattingSettingsService();
    this.container.classList.add('slope-container');
  }

  public update(options: VisualUpdateOptions): void {
    // Cancel running animations
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];

    // Parse settings from dataView
    const dataView = options.dataViews?.[0];
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
      if (legacyGlass === false) {
        this.settings.cardSettings.cardStyleMode.value = { value: 'none', displayName: 'None' };
      }
    }

    // Date filter: hide start/end when disabled
    this.settings.dateFilterFormattingCard.startDate.visible = this.settings.dateFilterFormattingCard.enableDateFilter.value;
    this.settings.dateFilterFormattingCard.endAtCurrentDate.visible = this.settings.dateFilterFormattingCard.enableDateFilter.value;
    this.settings.dateFilterFormattingCard.endDate.visible = this.settings.dateFilterFormattingCard.enableDateFilter.value && !this.settings.dateFilterFormattingCard.endAtCurrentDate.value;

    // Card Style — hide sub-settings when mode is 'none'
    const cardStyleMode = (resolveDropdown(this.settings.cardSettings.cardStyleMode) ?? 'glass') as CardStyleMode;
    this.settings.cardSettings.backgroundOpacity.visible = cardStyleMode !== 'none';
    this.settings.cardSettings.backgroundColor.visible = cardStyleMode !== 'none';

    this.settings.dataLabelFormattingCard.showDataLabels.visible = false;

    // Hide dead axis/grid properties — slope-chart has its own axis rendering
    this.settings.axisFormattingCard.xAxisTitle.visible = false;
    this.settings.axisFormattingCard.yAxisMin.visible = false;
    this.settings.axisFormattingCard.yAxisMax.visible = false;
    this.settings.axisFormattingCard.axisLabelFontFamily.visible = false;
    this.settings.axisFormattingCard.axisLabelRotation.visible = false;
    this.settings.axisFormattingCard.axisLineColor.visible = false;
    this.settings.axisFormattingCard.axisLineWidth.visible = false;
    this.settings.axisFormattingCard.showGridLines.visible = false;
    this.settings.axisFormattingCard.gridLineColor.visible = false;
    this.settings.axisFormattingCard.gridLineWidth.visible = false;
    this.settings.axisFormattingCard.gridLineOpacity.visible = false;

    // Hide dual-axis-only properties (no combo/dual-axis support)
    this.settings.referenceLineFormattingCard.referenceLineAxis.visible = false;
    this.settings.referenceLineFormattingCard.referenceBandWidth.visible = false;
    this.settings.trendLineFormattingCard.trendLineAxis.visible = false;

    // ── Conditional Visibility ──────────────────────────────────
    this.settings.slopeSettings.fillOpacity.visible = this.settings.slopeSettings.showArea.value;

    const colorByDir = this.settings.directionColorSettings.colorByDirection.value;
    this.settings.directionColorSettings.positiveColor.visible = colorByDir;
    this.settings.directionColorSettings.negativeColor.visible = colorByDir;
    this.settings.directionColorSettings.neutralColor.visible = colorByDir;

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

    // Populate per-series formatting groups from data
    const defaultColors = new Map<string, string>();
    if (data) {
      data.forEach((d) => defaultColors.set(d.category, ''));
    }
    populateSeriesFormattingGroups(
      this.settings.seriesFormattingCard,
      dataView,
      ['startMeasure', 'endMeasure'],
      defaultColors,
    );

    // Render
    this.render(data, options.viewport);
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
    if (cardMode === 'none') {
      this.container.style.borderRadius = `${s.cardSettings.borderRadius.value}px`;
    }

    // Handle empty/null data
    if (!data) {
      this.renderEmptyState();
      return;
    }

    const width = viewport.width;
    const height = viewport.height;
    const innerWidth = width - MARGIN.left - MARGIN.right;
    const innerHeight = height - MARGIN.top - MARGIN.bottom;

    if (innerWidth < MIN_INNER_SIZE || innerHeight < MIN_INNER_SIZE) return;

    // Create SVG
    const svg = d3.select(this.container)
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    this.svg = svg;

    const g = svg.append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

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
    const lineWidth = s.slopeSettings.lineWidth.value;
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

    // Line stroke formatting card
    const lineStyleValue = s.lineStrokeFormattingCard.lineStyle.value;
    const lineStyle = typeof lineStyleValue === 'string'
      ? lineStyleValue
      : (lineStyleValue as { value?: string } | undefined)?.value ?? 'solid';

    // Axis formatting — resolve user picks with sensible defaults
    const axisLabelColor = s.axisFormattingCard.axisLabelColor.value?.value || '#64748B';
    const axisLabelSize = s.axisFormattingCard.axisLabelSize.value;
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
      .attr('font-weight', '600')
      .attr('fill', axisLabelColor)
      .text(leftLabel);

    headerGroup.append('text')
      .attr('class', 'slope-header')
      .attr('x', rightX)
      .attr('y', -12)
      .attr('text-anchor', 'middle')
      .attr('font-size', axisLabelSize + 2)
      .attr('font-weight', '600')
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
          .attr('stroke-dasharray', gridDash)
          .attr('stroke-opacity', 0.6)
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
          .attr('stop-opacity', fillOpacity);

        gradient.append('stop')
          .attr('offset', '100%')
          .attr('stop-color', color)
          .attr('stop-opacity', fillOpacity * 0.3);

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

      // Apply line style: per-series override takes precedence, then lineStrokeFormattingCard
      const effectiveLineStyle = fmt.lineStyle !== 'solid' ? fmt.lineStyle : lineStyle;
      const dashArray = lineStyleToDashArray(effectiveLineStyle);
      if (dashArray !== 'none') {
        path.attr('stroke-dasharray', dashArray);
      }

      // Tooltip via tooltipService
      const slopeHost = this.host;
      const slopeCategory = item.category;
      const slopeStartStr = formatWithSettings(item.startValue, this.settings.numberFormattingCard);
      const slopeEndStr = formatWithSettings(item.endValue, this.settings.numberFormattingCard);
      const slopeDelta = item.endValue - item.startValue;
      const slopeDeltaStr = (slopeDelta >= 0 ? '+' : '') + formatWithSettings(slopeDelta, this.settings.numberFormattingCard);
      path.on('mouseover', (event: MouseEvent) => {
        const tooltipItems: VisualTooltipDataItem[] = [
          { displayName: 'Category', value: slopeCategory },
          { displayName: 'Start', value: slopeStartStr },
          { displayName: 'End', value: slopeEndStr },
          { displayName: 'Change', value: slopeDeltaStr },
        ];
        slopeHost.tooltipService.show({
          dataItems: tooltipItems,
          identities: [],
          coordinates: [event.clientX, event.clientY],
          isTouchEvent: false,
        });
      });
      path.on('mousemove', (event: MouseEvent) => {
        slopeHost.tooltipService.move({
          dataItems: [],
          identities: [],
          coordinates: [event.clientX, event.clientY],
          isTouchEvent: false,
        });
      });
      path.on('mouseout', () => {
        slopeHost.tooltipService.hide({ immediately: true, isTouchEvent: false });
      });
      this.attachSelection(path, item.selectionId);

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

      // Start label (left side, right-aligned before the axis)
      const startLabel = labelGroup.append('text')
        .attr('class', 'slope-label')
        .attr('data-series', String(i))
        .attr('x', leftX - dotRadius - 6)
        .attr('y', y1)
        .attr('dy', '0.35em')
        .attr('text-anchor', 'end')
        .attr('font-size', axisLabelSize)
        .attr('fill', labelColor)
        .style('transition', 'opacity 0.15s ease');

      startLabel.append('tspan')
        .attr('font-weight', '500')
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
        .attr('fill', labelColor)
        .style('transition', 'opacity 0.15s ease');

      endLabel.append('tspan')
        .attr('font-weight', '500')
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
        const posOffset = clPosition === 'above' ? -10 : clPosition === 'below' ? 14 : 0;

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
          marginLeft: MARGIN.left,
          marginTop: MARGIN.top,
          chartWidth: innerWidth,
          chartHeight: innerHeight,
          categories: crosshairCategories,
          series: crosshairSeries,
          yScale,
          lineColor: s.crosshairFormattingCard.crosshairLineColor.value?.value || '#94A3B8',
          lineWidth: s.crosshairFormattingCard.crosshairLineWidth.value,
          lineStyle: chStyleVal,
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
          const seriesIdx = el.getAttribute('data-series');
          seriesElements.forEach((other) => {
            (other as SVGElement).style.opacity = other.getAttribute('data-series') === seriesIdx ? '1' : '0.2';
          });
        });
        el.addEventListener('mouseleave', () => {
          seriesElements.forEach((other) => {
            (other as SVGElement).style.opacity = '1';
          });
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
    if (legendCard.showLegend.value) {
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

    this.applyAccessibility(data.length);

    this.container.addEventListener('click', this.handleBackgroundClick);

    // Apply cross-highlight dimming
    this.applyCrossHighlight(data);
  }

  // ── Empty State ──────────────────────────────────────────────

  private renderEmptyState(): void {
    const empty = document.createElement('div');
    empty.className = 'slope-empty-state';
    empty.textContent = EMPTY_STATE_TEXT;
    this.container.appendChild(empty);
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

  private applyAccessibility(dataPointCount: number): void {
    const acc = this.settings.accessibilityFormattingCard;
    if (!acc.enableKeyboardNav.value) return;
    ensureFocusRingStyles();
    applyChartAria(this.container, {
      chartType: 'slope chart',
      title: this.settings.titleFormattingCard?.titleText?.value || undefined,
      dataPointCount,
    });
    const cleanup = attachKeyboardNav({
      container: this.container,
      itemSelector: '.slope-line, [tabindex="0"]',
      onActivate: (el) => { (el as HTMLElement).click?.(); },
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
    node.style('cursor', 'pointer');
    node.on('click.selection', (event: MouseEvent) => {
      event.stopPropagation();
      void this.selectionManager.select(selectionId, event.ctrlKey || event.metaKey);
    });
    node.on('contextmenu.selection', (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      void this.selectionManager.showContextMenu(selectionId, {
        x: event.clientX,
        y: event.clientY,
      });
    });
  }

  private handleBackgroundClick = (): void => {
    void this.selectionManager.clear();
  };

  // ── Cross-Highlight ───────────────────────────────────────────

  private applyCrossHighlight(data: SlopeItem[]): void {
    if (!this.currentHasHighlights) return;

    // Build a set of highlighted series indices
    const highlightedSeries = new Set<string>();
    data.forEach((item, i) => {
      if (item.highlighted) highlightedSeries.add(String(i));
    });

    // Dim non-highlighted elements (lines, dots, labels, areas, etc.)
    const svgNode = this.svg?.node();
    if (!svgNode) return;

    const seriesElements = svgNode.querySelectorAll('[data-series]');
    for (const el of Array.from(seriesElements)) {
      const seriesIdx = el.getAttribute('data-series');
      if (seriesIdx !== null) {
        (el as SVGElement).style.opacity = highlightedSeries.has(seriesIdx) ? '' : '0.3';
      }
    }
  }

  // ── Lifecycle ────────────────────────────────────────────────

  public destroy(): void {
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];
    this.svg = null;
  }
}
