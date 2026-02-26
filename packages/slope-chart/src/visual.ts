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
  formatNumber,
  getGlassStyle,
  withOpacity,
  renderChartTitle,
  applyDataLabelFormatting,
} from '../../core/src';

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataView = powerbi.DataView;
import ISelectionId = powerbi.visuals.ISelectionId;

import '../style/visual.less';

// ── Internal Types ───────────────────────────────────────────────

interface SlopeItem {
  category: string;
  startValue: number;
  endValue: number;
  selectionId: ISelectionId;
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

    // Extract data
    const data = this.extractData(dataView);

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

    const items: SlopeItem[] = [];
    for (let i = 0; i < rowCount; i++) {
      const catVal = categoryColumn.values[i];
      const startVal = startColumn.values[i];
      const endVal = endColumn.values[i];

      if (catVal == null || startVal == null || endVal == null) continue;

      const startNum = typeof startVal === 'number' ? startVal : Number(startVal);
      const endNum = typeof endVal === 'number' ? endVal : Number(endVal);

      if (!Number.isFinite(startNum) || !Number.isFinite(endNum)) continue;

      items.push({
        category: String(catVal),
        startValue: startNum,
        endValue: endNum,
        selectionId: this.host.createSelectionIdBuilder()
          .withCategory(categoryColumn, i)
          .createSelectionId(),
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

    // Apply glass card style
    if (s.cardSettings.enableGlass.value) {
      const glass = getGlassStyle({
        mode: 'light',
        opacity: s.cardSettings.backgroundOpacity.value / 100,
        backgroundColor: ((s.cardSettings as any).backgroundColor?.value?.value ?? (s.cardSettings as any).bgColor?.value?.value),
        borderRadius: s.cardSettings.borderRadius.value,
      });
      Object.assign(this.container.style, glass);
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
    const colorByDirection = s.slopeSettings.colorByDirection.value;
    const positiveColor = s.slopeSettings.positiveColor.value.value;
    const negativeColor = s.slopeSettings.negativeColor.value.value;
    const neutralColor = s.slopeSettings.neutralColor.value.value;
    const leftLabel = s.columnSettings.leftLabel.value;
    const rightLabel = s.columnSettings.rightLabel.value;
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
    const labelColorValue = s.slopeSettings.labelColor.value?.value;
    const labelColor = labelColorValue && labelColorValue.length > 0 ? labelColorValue : axisLabelColor;
    // Value tspan uses a lighter variant; derive from label color with reduced opacity
    const valueLabelColor = s.axisFormattingCard.axisLabelColor.value?.value || '#94A3B8';

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

    // ── Slope Lines ─────────────────────────────────────────────

    const lineGroup = g.append('g').attr('class', 'slope-lines');

    const getLineColor = (item: SlopeItem): string => {
      if (!colorByDirection) return neutralColor;
      const delta = item.endValue - item.startValue;
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
        const color = getLineColor(item);

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
          .attr('points', polygonPoints)
          .attr('fill', `url(#${gradientId})`)
          .attr('stroke', 'none');
      });
    }

    const paths: SVGPathElement[] = [];

    data.forEach((item, i) => {
      const y1 = yScale(item.startValue);
      const y2 = yScale(item.endValue);
      const color = getLineColor(item);

      const path = lineGroup.append('path')
        .attr('class', 'slope-line')
        .attr('d', `M ${leftX} ${y1} L ${rightX} ${y2}`)
        .attr('stroke', color)
        .attr('stroke-width', lineWidth)
        .attr('fill', 'none')
        .attr('stroke-linecap', 'round');

      // Apply line style from lineStrokeFormattingCard
      if (lineStyle === 'dashed') {
        path.attr('stroke-dasharray', '6,3');
      } else if (lineStyle === 'dotted') {
        path.attr('stroke-dasharray', '2,2');
      }

      // Add tooltip
      path.append('title')
        .text(`${item.category}: ${formatNumber(item.startValue)} -> ${formatNumber(item.endValue)}`);
      this.attachSelection(path, item.selectionId);

      const pathNode = path.node();
      if (pathNode) {
        paths.push(pathNode);
      }
    });

    // ── Dots ────────────────────────────────────────────────────

    const dotGroup = g.append('g').attr('class', 'slope-dots');
    const dots: SVGElement[] = [];

    data.forEach((item) => {
      const y1 = yScale(item.startValue);
      const y2 = yScale(item.endValue);
      const color = getLineColor(item);

      // Start dot
      const startDot = dotGroup.append('circle')
        .attr('class', 'slope-dot')
        .attr('cx', leftX)
        .attr('cy', y1)
        .attr('r', dotRadius)
        .attr('fill', color)
        .attr('stroke', dotStrokeColor)
        .attr('stroke-width', 1.5);
      this.attachSelection(startDot, item.selectionId);

      const startDotNode = startDot.node();
      if (startDotNode) dots.push(startDotNode);

      // End dot
      const endDot = dotGroup.append('circle')
        .attr('class', 'slope-dot')
        .attr('cx', rightX)
        .attr('cy', y2)
        .attr('r', dotRadius)
        .attr('fill', color)
        .attr('stroke', dotStrokeColor)
        .attr('stroke-width', 1.5);
      this.attachSelection(endDot, item.selectionId);

      const endDotNode = endDot.node();
      if (endDotNode) dots.push(endDotNode);
    });

    // ── Labels ──────────────────────────────────────────────────

    const labelGroup = g.append('g').attr('class', 'slope-labels');
    const labels: SVGElement[] = [];

    data.forEach((item) => {
      const y1 = yScale(item.startValue);
      const y2 = yScale(item.endValue);

      // Start label (left side, right-aligned before the axis)
      const startLabel = labelGroup.append('text')
        .attr('class', 'slope-label')
        .attr('x', leftX - dotRadius - 6)
        .attr('y', y1)
        .attr('dy', '0.35em')
        .attr('text-anchor', 'end')
        .attr('font-size', axisLabelSize)
        .attr('fill', labelColor);

      startLabel.append('tspan')
        .attr('font-weight', '500')
        .text(item.category);

      startLabel.append('tspan')
        .attr('dx', '4')
        .attr('fill', valueLabelColor)
        .text(formatNumber(item.startValue));
      this.attachSelection(startLabel, item.selectionId);

      const startLabelNode = startLabel.node();
      if (startLabelNode) labels.push(startLabelNode);

      // End label (right side, left-aligned after the axis)
      const endLabel = labelGroup.append('text')
        .attr('class', 'slope-label')
        .attr('x', rightX + dotRadius + 6)
        .attr('y', y2)
        .attr('dy', '0.35em')
        .attr('text-anchor', 'start')
        .attr('font-size', axisLabelSize)
        .attr('fill', labelColor);

      endLabel.append('tspan')
        .attr('font-weight', '500')
        .text(item.category);

      endLabel.append('tspan')
        .attr('dx', '4')
        .attr('fill', valueLabelColor)
        .text(formatNumber(item.endValue));
      this.attachSelection(endLabel, item.selectionId);

      const endLabelNode = endLabel.node();
      if (endLabelNode) labels.push(endLabelNode);
    });

    // ── Entrance Animations ─────────────────────────────────────

    if (animEnabled) {
      this.animateEntrance(paths, dots, labels, animDuration);
    }
    // Apply shared formatting settings
    applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.slope-label');

    this.container.addEventListener('click', this.handleBackgroundClick);
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

  // ── Lifecycle ────────────────────────────────────────────────

  public destroy(): void {
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];
    this.svg = null;
  }
}
