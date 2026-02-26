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
  getHostChartColor,
  renderChartTitle,
  applyAxisFormatting,
  applyGridFormatting,
  applyDataLabelFormatting,
  applyAllAxisFormatting,
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

    // Extract data
    const data = this.extractData(dataView);

    // Render
    this.render(data, options.viewport);
  }

  // ── Data Extraction ──────────────────────────────────────────

  private extractData(dataView: DataView | undefined): BumpItem[] | null {
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

      const color = useChartPalette ? getHostChartColor(this.host.colorPalette, colorIndex) : getHostChartColor(this.host.colorPalette, colorIndex);
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
        backgroundColor: ((s.cardSettings as any).backgroundColor?.value?.value ?? (s.cardSettings as any).bgColor?.value?.value),
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

    const legendPosition = s.legendSettings.position.value.value;
    const showLegend = s.legendSettings.show.value;
    const isLegendBottom = legendPosition === 'bottom';

    // Choose margins based on legend position
    const margin = showLegend && isLegendBottom
      ? { ...MARGIN_LEGEND_BOTTOM }
      : { ...MARGIN };

    // If legend is on the right, ensure right margin has room
    if (showLegend && !isLegendBottom) {
      margin.right = Math.max(margin.right, LEGEND_RIGHT_WIDTH + 40);
    }

    const width = viewport.width;
    const height = viewport.height;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    if (innerWidth < MIN_INNER_SIZE || innerHeight < MIN_INNER_SIZE) return;

    // Collect unique time periods (from the first item's points — all should share them)
    const timePeriods = data[0].points.map((p) => p.time);
    const maxRank = data.length;

    // Create SVG
    const svg = d3.select(this.container)
      .append('svg')
      .attr('width', width)
      .attr('height', height);

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

    const showXAxis = s.axisSettings.showXAxis.value;

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

    // Legend formatting
    const legendFontColor = s.legendFormattingCard.legendFontColor.value?.value || '#64748B';
    const legendFontSize = s.legendFormattingCard.legendFontSize.value;

    // ── Lines ───────────────────────────────────────────────────

    const lineGroup = g.append('g').attr('class', 'bump-lines');
    const paths: SVGPathElement[] = [];

    const lineGenerator = d3.line<RankPoint>()
      .x((d) => xScale(d.time) ?? 0)
      .y((d) => yScale(d.rank))
      .curve(d3.curveMonotoneX);

    data.forEach((item) => {
      const pathD = lineGenerator(item.points);
      if (!pathD) return;

      const path = lineGroup.append('path')
        .attr('class', 'bump-line')
        .attr('d', pathD)
        .attr('stroke', item.color)
        .attr('stroke-width', lineWidth)
        .attr('fill', 'none')
        .attr('stroke-linecap', 'round');

      // Apply line style from lineStrokeFormattingCard
      if (lineStyle === 'dashed') {
        path.attr('stroke-dasharray', '6,3');
      } else if (lineStyle === 'dotted') {
        path.attr('stroke-dasharray', '2,2');
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

    data.forEach((item) => {
      item.points.forEach((point) => {
        const cx = xScale(point.time);
        if (cx === undefined) return;
        const cy = yScale(point.rank);

        const dot = dotGroup.append('circle')
          .attr('class', 'bump-dot')
          .attr('cx', cx)
          .attr('cy', cy)
          .attr('r', dotRadius)
          .attr('fill', item.color)
          .attr('stroke', s.bumpSettings.dotStrokeColor.value?.value || '#FFFFFF')
          .attr('stroke-width', 2)
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

      data.forEach((item) => {
        item.points.forEach((point) => {
          const cx = xScale(point.time);
          if (cx === undefined) return;
          const cy = yScale(point.rank);

          const label = labelGroup.append('text')
            .attr('class', 'bump-rank-label')
            .attr('x', cx)
            .attr('y', cy)
            .text(point.rank);

          const labelNode = label.node();
          if (labelNode) labelElements.push(labelNode);
        });
      });
    }

    // ── Legend ───────────────────────────────────────────────────

    if (showLegend) {
      this.renderLegend(svg, data, isLegendBottom, width, height, margin, innerWidth, innerHeight, legendFontSize, legendFontColor);
    }

    // ── Entrance Animations ─────────────────────────────────────

    if (animEnabled) {
      this.animateEntrance(paths, dots, labelElements, animDuration);
    }

    // Apply shared formatting settings
    applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.bump-rank-label');
    applyAllAxisFormatting(this.container, this.settings.axisFormattingCard, '.bump-axis');

    this.container.addEventListener('click', this.handleBackgroundClick);
  }

  // ── Legend Rendering ────────────────────────────────────────

  private renderLegend(
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    data: BumpItem[],
    isBottom: boolean,
    width: number,
    height: number,
    margin: { top: number; right: number; bottom: number; left: number },
    innerWidth: number,
    _innerHeight: number,
    legendFontSize: number,
    legendFontColor: string,
  ): void {
    const legendGroup = svg.append('g').attr('class', 'bump-legend');

    if (isBottom) {
      // Bottom legend: horizontal layout
      const legendY = height - 28;
      let currentX = margin.left;

      data.forEach((item) => {
        const itemGroup = legendGroup.append('g')
          .attr('transform', `translate(${currentX},${legendY})`);

        itemGroup.append('rect')
          .attr('width', LEGEND_SWATCH_SIZE)
          .attr('height', LEGEND_SWATCH_SIZE)
          .attr('rx', 2)
          .attr('fill', item.color);

        itemGroup.append('text')
          .attr('class', 'bump-legend-item')
          .attr('x', LEGEND_SWATCH_SIZE + LEGEND_GAP)
          .attr('y', LEGEND_SWATCH_SIZE - 1)
          .attr('font-size', legendFontSize)
          .attr('fill', legendFontColor)
          .text(item.name);

        // Estimate text width for next item offset
        const estimatedTextWidth = item.name.length * 6;
        currentX += LEGEND_SWATCH_SIZE + LEGEND_GAP + estimatedTextWidth + 16;
      });
    } else {
      // Right legend: vertical layout
      const legendX = width - margin.right + 20;

      data.forEach((item, i) => {
        const legendY = margin.top + i * LEGEND_ITEM_HEIGHT;

        const itemGroup = legendGroup.append('g')
          .attr('transform', `translate(${legendX},${legendY})`);

        itemGroup.append('rect')
          .attr('width', LEGEND_SWATCH_SIZE)
          .attr('height', LEGEND_SWATCH_SIZE)
          .attr('rx', 2)
          .attr('fill', item.color);

        itemGroup.append('text')
          .attr('class', 'bump-legend-item')
          .attr('x', LEGEND_SWATCH_SIZE + LEGEND_GAP)
          .attr('y', LEGEND_SWATCH_SIZE - 1)
          .attr('font-size', legendFontSize)
          .attr('fill', legendFontColor)
          .text(item.name);
      });
    }
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
