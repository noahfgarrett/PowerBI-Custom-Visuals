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
  getGlassStyle,
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
} from '../../core/src';

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataView = powerbi.DataView;
import ISelectionId = powerbi.visuals.ISelectionId;

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

// ── Visual ───────────────────────────────────────────────────────

export class BumpChartVisual implements IVisual {
  private host: IVisualHost;
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private container: HTMLElement;
  private settings: BumpChartSettings;
  private formattingSettingsService: FormattingSettingsService;
  private cancelAnimations: Array<() => void> = [];
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new BumpChartSettings();
    this.formattingSettingsService = new FormattingSettingsService();
    this.container.classList.add('bump-container');
  }

  public update(options: VisualUpdateOptions): void {
    // Cancel running animations
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];

    // Parse settings from dataView
    const dataView = options.dataViews?.[0];
    if (dataView) {
      this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
        BumpChartSettings,
        dataView
      );
    }

    // Hide shared axis toggles that are shadowed by local settings
    this.settings.axisFormattingCard.showXAxis.visible = false;
    this.settings.axisFormattingCard.showYAxis.visible = false;
    this.settings.axisFormattingCard.xAxisTitle.visible = false;
    this.settings.axisFormattingCard.yAxisTitle.visible = false;
    this.settings.axisFormattingCard.yAxisMin.visible = false;
    this.settings.axisFormattingCard.yAxisMax.visible = false;
    this.settings.dataLabelFormattingCard.showDataLabels.visible = false;

    // Conditional visibility: hide child settings when parent toggle is off
    // Top N highlight: hide topN/showOthers when enabled is false
    this.settings.bumpHighlightSettings.topN.visible = this.settings.bumpHighlightSettings.enabled.value;
    this.settings.bumpHighlightSettings.showOthers.visible = this.settings.bumpHighlightSettings.enabled.value;
    // Area fill: hide areaOpacity when showArea is false
    this.settings.bumpSettings.areaOpacity.visible = this.settings.bumpSettings.showArea.value;
    // Rank change: hide fontSize when show is false
    this.settings.bumpRankChangeSettings.fontSize.visible = this.settings.bumpRankChangeSettings.show.value;

    // Extract data
    const data = this.extractData(dataView);

    // Populate per-series formatting groups
    this.populateSeriesGroups(data);

    // Render
    this.render(data, options.viewport);
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

    // Build a pivot: Map<itemName, Map<timePeriod, value>>
    const pivot = new Map<string, Map<string, number>>();
    const itemFirstRowIndex = new Map<string, number>();
    const timePeriodsSet = new Set<string>();

    for (let i = 0; i < rowCount; i++) {
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
    }

    if (pivot.size === 0) return null;

    // Ordered time periods (preserve order from data)
    const timePeriods: string[] = [];
    for (let i = 0; i < rowCount; i++) {
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
    const useChartPalette = this.settings.colorSettings.useChartPalette.value;
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
      });
      colorIndex++;
    }

    if (items.length === 0) return null;
    return items;
  }

  // ── Rendering ────────────────────────────────────────────────

  private render(data: BumpItem[] | null, viewport: powerbi.IViewport): void {
    // Clear previous content
    this.container.removeEventListener('click', this.handleBackgroundClick);
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    renderChartTitle(this.container, this.settings.titleFormattingCard);
    this.svg = null;

    const s = this.settings;

    // Apply glass card style
    if (s.cardSettings.enableGlass.value) {
      const glass = getGlassStyle({
        mode: 'light',
        opacity: s.cardSettings.backgroundOpacity.value / 100,
        backgroundColor: s.cardSettings.backgroundColor.value?.value,
        borderRadius: s.cardSettings.borderRadius.value,
      });
      this.container.style.background = glass.background;
      this.container.style.backdropFilter = glass.backdropFilter;
      (this.container.style as unknown as Record<string, string>)['WebkitBackdropFilter'] = glass.WebkitBackdropFilter;
      this.container.style.border = glass.border;
      this.container.style.boxShadow = glass.boxShadow;
      this.container.style.borderRadius = glass.borderRadius;
    } else {
      this.container.style.background = '';
      this.container.style.backdropFilter = '';
      (this.container.style as unknown as Record<string, string>)['WebkitBackdropFilter'] = '';
      this.container.style.border = '';
      this.container.style.boxShadow = '';
      this.container.style.borderRadius = '';
    }

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

    const width = viewport.width;
    const height = viewport.height;
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

    const showXAxis = s.axisVisibilitySettings.showXAxis.value;

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

    const lineWidth = s.bumpSettings.lineWidth.value;
    const dotRadius = s.bumpSettings.dotRadius.value;
    const showRankNumbers = s.bumpSettings.showRankNumbers.value;
    const animEnabled = s.animationSettings.enabled.value;
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

        const gradientId = `bump-area-grad-${itemIdx}`;
        const gradient = defs.append('linearGradient')
          .attr('id', gradientId)
          .attr('gradientUnits', 'userSpaceOnUse')
          .attr('x1', 0)
          .attr('y1', 0)
          .attr('x2', 0)
          .attr('y2', innerHeight);

        const effectiveOpacity = isDimmed ? areaOpacity * 0.3 : areaOpacity;

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
        .attr('d', pathD)
        .attr('stroke', condColor || sf.color)
        .attr('stroke-width', sf.lineWidth || lineWidth)
        .attr('fill', 'none')
        .attr('stroke-linecap', 'round')
        .style('transition', 'opacity 0.15s ease');

      if (isDimmed) {
        path.style('opacity', '0.25');
      }

      // Apply line style: per-series override takes precedence over global
      const effectiveLineStyle = sf.lineStyle !== 'solid' ? sf.lineStyle : lineStyle;
      const dashArray = lineStyleToDashArray(effectiveLineStyle);
      if (dashArray !== '') {
        path.attr('stroke-dasharray', dashArray);
      }

      path.style('cursor', 'pointer')
        .on('click', (event: MouseEvent) => {
          event.stopPropagation();
          void this.selectionManager.select(item.selectionId, event.ctrlKey || event.metaKey);
        })
        .on('contextmenu', (event: MouseEvent) => {
          event.preventDefault();
          event.stopPropagation();
          void this.selectionManager.showContextMenu(item.selectionId, {
            x: event.clientX,
            y: event.clientY,
          });
        });

      // Tooltip
      path.append('title')
        .text(item.name);

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
          .attr('cx', cx)
          .attr('cy', cy)
          .attr('r', dotRadius)
          .attr('fill', dotCondColor || dotSf.color)
          .attr('stroke', s.bumpSettings.dotStrokeColor.value?.value || '#FFFFFF')
          .attr('stroke-width', 2)
          .style('transition', 'opacity 0.15s ease')
          .style('cursor', 'pointer')
          .on('click', (event: MouseEvent) => {
            event.stopPropagation();
            void this.selectionManager.select(item.selectionId, event.ctrlKey || event.metaKey);
          })
          .on('contextmenu', (event: MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();
            void this.selectionManager.showContextMenu(item.selectionId, {
              x: event.clientX,
              y: event.clientY,
            });
          });

        if (isDimmed) {
          dot.style('opacity', '0.25');
        }

        dot.append('title')
          .text(`${item.name} — ${point.time}: Rank ${point.rank}`);

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
        const isDimmed = topNSet != null && !topNSet.has(origIdx);
        item.points.forEach((point) => {
          const cx = xScale(point.time);
          if (cx === undefined) return;
          const cy = yScale(point.rank);

          const label = labelGroup.append('text')
            .attr('class', 'bump-rank-label')
            .attr('data-series', String(origIdx))
            .attr('x', cx)
            .attr('y', cy)
            .style('transition', 'opacity 0.15s ease')
            .text(point.rank);

          if (isDimmed) {
            label.style('opacity', '0.25');
          }

          const labelNode = label.node();
          if (labelNode) labelElements.push(labelNode);
        });
      });
    }

    // ── Rank Change Indicators ──────────────────────────────────

    if (s.bumpRankChangeSettings.show.value) {
      const rcGroup = g.append('g').attr('class', 'bump-rank-change-labels');
      const rcFontSize = s.bumpRankChangeSettings.fontSize.value;

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
          const color = delta < 0 ? '#22C55E' : '#EF4444';
          const label = delta > 0 ? `+${delta}` : String(delta);

          const text = rcGroup.append('text')
            .attr('class', 'rank-change-label')
            .attr('data-series', String(origIdx))
            .attr('x', cx + dotRadius + 4)
            .attr('y', cy - dotRadius - 2)
            .attr('font-size', `${rcFontSize}px`)
            .attr('fill', color)
            .attr('font-weight', 'bold')
            .text(label);

          if (isDimmed) {
            text.style('opacity', '0.25');
          }
        }
      });
    }

    // ── Period Comparison Badges ─────────────────────────────────

    if (s.bumpComparisonSettings.show.value) {
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

        const color = delta < 0 ? '#22C55E' : delta > 0 ? '#EF4444' : (s.axisFormattingCard.axisLabelColor.value?.value || '#64748B');
        const label = delta === 0 ? '=' : delta > 0 ? `+${delta}` : String(delta);

        const badge = compGroup.append('text')
          .attr('class', 'bump-comparison-badge')
          .attr('data-series', String(origIdx))
          .attr('x', cx + dotRadius + 8)
          .attr('y', cy + 4)
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
          series: crosshairSeries,
          yScale,
          lineColor: s.crosshairFormattingCard.crosshairLineColor.value?.value || '#94A3B8',
          lineWidth: s.crosshairFormattingCard.crosshairLineWidth.value,
          lineStyle: chStyleVal,
          showValues: s.crosshairFormattingCard.showCrosshairValues.value,
          formatValue: (val: number) => `#${Math.round(val)}`,
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
            const otherIdx = Number(other.getAttribute('data-series'));
            const isDimmed = topNSet != null && !topNSet.has(otherIdx);
            (other as SVGElement).style.opacity = isDimmed ? '0.25' : '1';
          });
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

    this.container.addEventListener('click', this.handleBackgroundClick);
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

    const items: LegendItem[] = data.map((item) => ({
      label: item.name,
      color: item.color,
    }));
    const rawLegendFontFamily = resolveDropdown(legendFmtCard.legendFontFamily) || undefined;

    renderLegend(this.container, {
      items,
      position,
      fontSize: legendFmtCard.legendFontSize.value,
      fontColor,
      fontFamily: rawLegendFontFamily,
    });
  }

  // ── Empty State ──────────────────────────────────────────────

  private renderEmptyState(): void {
    const empty = document.createElement('div');
    empty.className = 'bump-empty';
    empty.textContent = EMPTY_STATE_TEXT;
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
    if (!acc.enableKeyboardNav.value) return;
    ensureFocusRingStyles();
    applyChartAria(this.container, {
      chartType: 'bump chart',
      title: this.settings.titleFormattingCard?.titleText?.value || undefined,
      dataPointCount,
    });
    const cleanup = attachKeyboardNav({
      container: this.container,
      itemSelector: '[tabindex="0"], .bump-line, .bump-dot',
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

  private handleBackgroundClick = (): void => {
    void this.selectionManager.clear();
  };

  // ── Lifecycle ────────────────────────────────────────────────

  public destroy(): void {
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];
    this.svg = null;
  }
}
