/**
 * Scatter Bubble Plot — Power BI IVisual implementation.
 * X/Y scatter with optional bubble size dimension, spring pop-in animation,
 * and glassmorphic styling.
 */

import powerbi from 'powerbi-visuals-api';
import * as d3 from 'd3';
import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel';
import { ScatterBubbleSettings } from './settings';
import {
  popIn,
  fadeSlideIn,
  animate,
  cubicOut,
  springEase,
  DURATION,
  formatNumber,
  getGlassStyle,
  getHostChartColor,
  withOpacity,
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

// ── Types ────────────────────────────────────────────────────────────

interface ScatterPoint {
  label: string;
  x: number;
  y: number;
  size: number | null;
  index: number;
  color: string;
  selectionId: ISelectionId;
}

interface ScatterData {
  points: ScatterPoint[];
  xExtent: [number, number];
  yExtent: [number, number];
  sizeExtent: [number, number] | null;
  isEmpty: boolean;
}

interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// ── Constants ────────────────────────────────────────────────────────

const MARGIN: Margin = { top: 20, right: 20, bottom: 40, left: 50 };
const DEFAULT_BUBBLE_RADIUS = 6;
const TOOLTIP_OFFSET = 12;

// ── Visual ───────────────────────────────────────────────────────────

export class ScatterBubbleVisual implements IVisual {
  private host: IVisualHost;
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private container: HTMLElement;
  private settings: ScatterBubbleSettings;
  private formattingSettingsService: FormattingSettingsService;
  private cancelAnimations: Array<() => void> = [];

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new ScatterBubbleSettings();
    this.formattingSettingsService = new FormattingSettingsService();
    this.container.classList.add('scatter-bubble-container');
  }

  public update(options: VisualUpdateOptions): void {
    // Cancel running animations before re-render
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];

    // Parse settings from dataView
    const dataView = options.dataViews?.[0];
    if (dataView) {
      this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
        ScatterBubbleSettings,
        dataView,
      );
    }

    // Extract data
    const data = this.extractData(dataView);

    // Apply glass effect
    this.applyCardStyle();

    // Render
    if (data.isEmpty) {
      this.renderEmpty();
    } else {
      this.render(data, options.viewport);
    }
  }

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  // ── Data Extraction ──────────────────────────────────────────────

  private extractData(dataView: DataView | undefined): ScatterData {
    const empty: ScatterData = {
      points: [],
      xExtent: [0, 1],
      yExtent: [0, 1],
      sizeExtent: null,
      isEmpty: true,
    };

    if (!dataView?.categorical) return empty;

    const categorical = dataView.categorical;
    const categoryColumn = categorical.categories?.[0];
    const valuesColumns = categorical.values;

    if (!categoryColumn || !valuesColumns || valuesColumns.length === 0) return empty;

    // Find columns by role
    let xCol: powerbi.DataViewValueColumn | undefined;
    let yCol: powerbi.DataViewValueColumn | undefined;
    let sizeCol: powerbi.DataViewValueColumn | undefined;

    for (const col of valuesColumns) {
      const role = col.source.roles;
      if (!role) continue;
      if (role['xValue']) xCol = col;
      if (role['yValue']) yCol = col;
      if (role['size']) sizeCol = col;
    }

    if (!xCol || !yCol) return empty;

    const points: ScatterPoint[] = [];
    const count = categoryColumn.values.length;

    for (let i = 0; i < count; i++) {
      const xRaw = xCol.values[i];
      const yRaw = yCol.values[i];

      if (typeof xRaw !== 'number' || typeof yRaw !== 'number') continue;
      if (Number.isNaN(xRaw) || Number.isNaN(yRaw)) continue;

      const sizeRaw = sizeCol ? sizeCol.values[i] : null;
      const sizeVal = typeof sizeRaw === 'number' && !Number.isNaN(sizeRaw) ? sizeRaw : null;

      const label = categoryColumn.values[i] !== null && categoryColumn.values[i] !== undefined
        ? String(categoryColumn.values[i])
        : '';

      points.push({
        label,
        x: xRaw,
        y: yRaw,
        size: sizeVal,
        index: i,
        color: getHostChartColor(this.host.colorPalette, i),
        selectionId: this.host.createSelectionIdBuilder()
          .withCategory(categoryColumn, i)
          .createSelectionId(),
      });
    }

    if (points.length === 0) return empty;

    // Compute extents with padding
    const xValues = points.map((p) => p.x);
    const yValues = points.map((p) => p.y);
    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);
    const yMin = Math.min(...yValues);
    const yMax = Math.max(...yValues);

    // Add 5% padding to axes
    const xPad = (xMax - xMin) * 0.05 || 1;
    const yPad = (yMax - yMin) * 0.05 || 1;
    const xExtent: [number, number] = [xMin - xPad, xMax + xPad];
    const yExtent: [number, number] = [yMin - yPad, yMax + yPad];

    // Size extent (only if size dimension is present)
    let sizeExtent: [number, number] | null = null;
    if (sizeCol) {
      const sizeValues = points.map((p) => p.size).filter((v): v is number => v !== null);
      if (sizeValues.length > 0) {
        sizeExtent = [Math.min(...sizeValues), Math.max(...sizeValues)];
      }
    }

    return { points, xExtent, yExtent, sizeExtent, isEmpty: false };
  }

  // ── Card Style ─────────────────────────────────────────────────

  private applyCardStyle(): void {
    const s = this.settings.cardSettings;
    if (s.enableGlass.value) {
      const glass = getGlassStyle({
        mode: 'light',
        opacity: s.bgOpacity.value / 100,
        backgroundColor: ((s as any).backgroundColor?.value?.value ?? (s as any).bgColor?.value?.value),
        borderRadius: s.borderRadius.value,
      });
      Object.assign(this.container.style, glass);
    } else {
      this.container.style.background = '';
      this.container.style.backdropFilter = '';
      (this.container.style as unknown as Record<string, string>)['WebkitBackdropFilter'] = '';
      this.container.style.border = '';
      this.container.style.boxShadow = '';
      this.container.style.borderRadius = `${s.borderRadius.value}px`;
    }
  }

  // ── Empty State ────────────────────────────────────────────────

  private renderEmpty(): void {
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    const emptyEl = document.createElement('div');
    emptyEl.className = 'scatter-bubble-empty';
    emptyEl.textContent = 'Add a Category, X Value, and Y Value to get started.';
    this.container.appendChild(emptyEl);
  }

  // ── Main Render ────────────────────────────────────────────────

  private render(data: ScatterData, viewport: powerbi.IViewport): void {
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    renderChartTitle(this.container, this.settings.titleFormattingCard);
    this.container.removeEventListener('click', this.handleBackgroundClick);

    const s = this.settings;
    const width = viewport.width;
    const height = viewport.height;
    const chartWidth = width - MARGIN.left - MARGIN.right;
    const chartHeight = height - MARGIN.top - MARGIN.bottom;

    if (chartWidth <= 0 || chartHeight <= 0) return;

    // ── Legend ──────────────────────────────────────────────────
    const legendFmtCard = s.legendFormattingCard;
    const legendFontColor = legendFmtCard.legendFontColor.value?.value || '#1E293B';
    const legendFontSize = legendFmtCard.legendFontSize.value;
    const legendPositionValue = legendFmtCard.legendPosition.value;
    const legendPosition = typeof legendPositionValue === 'string'
      ? legendPositionValue
      : (legendPositionValue as { value?: string } | undefined)?.value ?? 'bottom';

    if (s.legendSettings.show.value && data.points.length > 0) {
      const legendEl = document.createElement('div');
      legendEl.className = 'scatter-bubble-legend';

      // Apply legend position
      if (legendPosition === 'top') {
        legendEl.style.order = '-1';
      } else if (legendPosition === 'left' || legendPosition === 'right') {
        legendEl.style.flexDirection = 'column';
      }

      // Show unique labels (limit to first 10 to avoid overflow)
      const legendItems = data.points.slice(0, 10);
      for (const pt of legendItems) {
        const item = document.createElement('span');
        item.className = 'scatter-bubble-legend-item';

        const swatch = document.createElement('span');
        swatch.className = 'scatter-bubble-legend-swatch';
        (swatch.style as unknown as Record<string, string>)['backgroundColor'] = pt.color;

        const label = document.createElement('span');
        label.textContent = pt.label || `Point ${pt.index + 1}`;
        label.style.color = legendFontColor;
        label.style.fontSize = `${legendFontSize}px`;

        item.appendChild(swatch);
        item.appendChild(label);
        legendEl.appendChild(item);
      }

      if (data.points.length > 10) {
        const more = document.createElement('span');
        more.className = 'scatter-bubble-legend-item';
        more.textContent = `+${data.points.length - 10} more`;
        more.style.color = legendFontColor;
        more.style.fontSize = `${legendFontSize}px`;
        legendEl.appendChild(more);
      }

      this.container.appendChild(legendEl);

      if (s.animationSettings.enabled.value) {
        const cancel = fadeSlideIn(legendEl, 'up', DURATION.normal, 0);
        this.cancelAnimations.push(cancel);
      }
    }

    // ── SVG ────────────────────────────────────────────────────
    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('class', 'scatter-bubble-svg');
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    this.container.appendChild(svg);

    const chartGroup = document.createElementNS(svgNs, 'g');
    chartGroup.setAttribute('transform', `translate(${MARGIN.left}, ${MARGIN.top})`);
    svg.appendChild(chartGroup);

    // ── Scales ─────────────────────────────────────────────────
    const xScale = d3.scaleLinear()
      .domain(data.xExtent)
      .range([0, chartWidth]);

    const yScale = d3.scaleLinear()
      .domain(data.yExtent)
      .range([chartHeight, 0]);

    const minRadius = s.scatterSettings.minRadius.value;
    const maxRadius = s.scatterSettings.maxRadius.value;

    const sizeScale = data.sizeExtent
      ? d3.scaleSqrt()
          .domain(data.sizeExtent)
          .range([minRadius, maxRadius])
      : null;

    const bubbleOpacity = s.scatterSettings.opacity.value / 100;

    // ── Grid lines ─────────────────────────────────────────────
    if (s.axisSettings.gridLines.value) {
      const gridGroup = document.createElementNS(svgNs, 'g');
      gridGroup.setAttribute('class', 'scatter-bubble-grid');
      chartGroup.appendChild(gridGroup);

      // Horizontal grid lines (Y-axis ticks)
      const yTicks = yScale.ticks(5);
      for (const tick of yTicks) {
        const line = document.createElementNS(svgNs, 'line');
        line.setAttribute('x1', '0');
        line.setAttribute('x2', String(chartWidth));
        line.setAttribute('y1', String(yScale(tick)));
        line.setAttribute('y2', String(yScale(tick)));
        gridGroup.appendChild(line);
      }

      // Vertical grid lines (X-axis ticks)
      const xTicks = xScale.ticks(5);
      for (const tick of xTicks) {
        const line = document.createElementNS(svgNs, 'line');
        line.setAttribute('x1', String(xScale(tick)));
        line.setAttribute('x2', String(xScale(tick)));
        line.setAttribute('y1', '0');
        line.setAttribute('y2', String(chartHeight));
        gridGroup.appendChild(line);
      }
    }

    // ── Axes ───────────────────────────────────────────────────
    if (s.axisSettings.showXAxis.value) {
      this.renderXAxis(svg, xScale, chartWidth, chartHeight);
    }

    if (s.axisSettings.showYAxis.value) {
      this.renderYAxis(svg, yScale, chartHeight);
    }

    // ── Bubbles ────────────────────────────────────────────────
    const bubblesGroup = document.createElementNS(svgNs, 'g');
    bubblesGroup.setAttribute('class', 'scatter-bubble-points');
    chartGroup.appendChild(bubblesGroup);

    // Calculate center of the chart for radial stagger
    const centerX = chartWidth / 2;
    const centerY = chartHeight / 2;

    // Find max distance from center for normalization
    let maxDist = 0;
    for (const pt of data.points) {
      const px = xScale(pt.x);
      const py = yScale(pt.y);
      const dist = Math.sqrt((px - centerX) ** 2 + (py - centerY) ** 2);
      if (dist > maxDist) maxDist = dist;
    }
    if (maxDist === 0) maxDist = 1;

    const animEnabled = s.animationSettings.enabled.value;
    const animDuration = s.animationSettings.duration.value;

    for (const pt of data.points) {
      const cx = xScale(pt.x);
      const cy = yScale(pt.y);
      const r = sizeScale && pt.size !== null
        ? sizeScale(pt.size)
        : DEFAULT_BUBBLE_RADIUS;

      const circle = document.createElementNS(svgNs, 'circle');
      circle.setAttribute('cx', String(cx));
      circle.setAttribute('cy', String(cy));
      circle.setAttribute('r', String(r));
      circle.setAttribute('fill', withOpacity(pt.color, bubbleOpacity));
      circle.setAttribute('stroke', this.settings.scatterSettings.bubbleStrokeColor.value?.value || pt.color);
      circle.setAttribute('stroke-width', String(this.settings.scatterSettings.bubbleStrokeWidth.value));
      circle.setAttribute('class', 'scatter-bubble-point');

      bubblesGroup.appendChild(circle);

      // Animate with radial stagger from center
      if (animEnabled) {
        const dist = Math.sqrt((cx - centerX) ** 2 + (cy - centerY) ** 2);
        const normalizedDist = dist / maxDist;
        const staggerDelay = normalizedDist * DURATION.stagger * data.points.length * 0.5;

        const cancel = popIn(circle, staggerDelay, animDuration);
        this.cancelAnimations.push(cancel);
      }

      // Tooltip on hover
      circle.addEventListener('mouseenter', (e: MouseEvent) => {
        this.showTooltip(pt, e);
      });
      circle.addEventListener('mouseleave', () => {
        this.hideTooltip();
      });
      circle.style.cursor = 'pointer';
      circle.addEventListener('click', (event: MouseEvent) => {
        event.stopPropagation();
        void this.selectionManager.select(pt.selectionId, event.ctrlKey || event.metaKey);
      });
      circle.addEventListener('contextmenu', (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        void this.selectionManager.showContextMenu(pt.selectionId, {
          x: event.clientX,
          y: event.clientY,
        });
      });
    }

    // ── Data Labels ─────────────────────────────────────────────
    if (s.dataLabelFormattingCard.showDataLabels.value) {
      const labelsGroup = document.createElementNS(svgNs, 'g');
      labelsGroup.setAttribute('class', 'scatter-bubble-labels');
      chartGroup.appendChild(labelsGroup);

      for (const pt of data.points) {
        const cx = xScale(pt.x);
        const cy = yScale(pt.y);
        const r = sizeScale && pt.size !== null
          ? sizeScale(pt.size)
          : DEFAULT_BUBBLE_RADIUS;

        const label = document.createElementNS(svgNs, 'text');
        label.setAttribute('class', 'scatter-bubble-label');
        label.setAttribute('x', String(cx));
        label.setAttribute('y', String(cy - r - 4));
        label.setAttribute('text-anchor', 'middle');
        label.textContent = pt.label || `Point ${pt.index + 1}`;
        labelsGroup.appendChild(label);
      }
    }

    // Apply shared formatting settings
    applyAllAxisFormatting(this.container, this.settings.axisFormattingCard, '.scatter-bubble-axis', '.scatter-bubble-grid');
    applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.scatter-bubble-label');

    this.container.addEventListener('click', this.handleBackgroundClick);
  }

  // ── Axes Rendering ─────────────────────────────────────────────

  private renderXAxis(
    svg: SVGSVGElement,
    xScale: d3.ScaleLinear<number, number>,
    chartWidth: number,
    chartHeight: number,
  ): void {
    const svgNs = 'http://www.w3.org/2000/svg';
    const axisGroup = document.createElementNS(svgNs, 'g');
    axisGroup.setAttribute('class', 'scatter-bubble-axis scatter-bubble-axis-x');
    axisGroup.setAttribute(
      'transform',
      `translate(${MARGIN.left}, ${MARGIN.top + chartHeight})`,
    );
    svg.appendChild(axisGroup);

    const ticks = xScale.ticks(Math.max(2, Math.floor(chartWidth / 80)));

    // Axis line
    const axisLine = document.createElementNS(svgNs, 'line');
    axisLine.setAttribute('class', 'domain');
    axisLine.setAttribute('x1', '0');
    axisLine.setAttribute('x2', String(chartWidth));
    axisLine.setAttribute('y1', '0');
    axisLine.setAttribute('y2', '0');
    axisGroup.appendChild(axisLine);

    for (const tick of ticks) {
      const x = xScale(tick);
      const tickGroup = document.createElementNS(svgNs, 'g');
      tickGroup.setAttribute('class', 'tick');
      tickGroup.setAttribute('transform', `translate(${x}, 0)`);

      const tickLine = document.createElementNS(svgNs, 'line');
      tickLine.setAttribute('y2', '6');
      tickGroup.appendChild(tickLine);

      const tickLabel = document.createElementNS(svgNs, 'text');
      tickLabel.setAttribute('y', '20');
      tickLabel.setAttribute('text-anchor', 'middle');
      tickLabel.textContent = formatNumber(tick, { abbreviate: true, decimals: 1 });
      tickGroup.appendChild(tickLabel);

      axisGroup.appendChild(tickGroup);
    }
  }

  private renderYAxis(
    svg: SVGSVGElement,
    yScale: d3.ScaleLinear<number, number>,
    chartHeight: number,
  ): void {
    const svgNs = 'http://www.w3.org/2000/svg';
    const axisGroup = document.createElementNS(svgNs, 'g');
    axisGroup.setAttribute('class', 'scatter-bubble-axis scatter-bubble-axis-y');
    axisGroup.setAttribute('transform', `translate(${MARGIN.left}, ${MARGIN.top})`);
    svg.appendChild(axisGroup);

    const ticks = yScale.ticks(Math.max(2, Math.floor(chartHeight / 50)));

    // Axis line
    const axisLine = document.createElementNS(svgNs, 'line');
    axisLine.setAttribute('class', 'domain');
    axisLine.setAttribute('x1', '0');
    axisLine.setAttribute('x2', '0');
    axisLine.setAttribute('y1', '0');
    axisLine.setAttribute('y2', String(chartHeight));
    axisGroup.appendChild(axisLine);

    for (const tick of ticks) {
      const y = yScale(tick);
      const tickGroup = document.createElementNS(svgNs, 'g');
      tickGroup.setAttribute('class', 'tick');
      tickGroup.setAttribute('transform', `translate(0, ${y})`);

      const tickLine = document.createElementNS(svgNs, 'line');
      tickLine.setAttribute('x2', '-6');
      tickGroup.appendChild(tickLine);

      const tickLabel = document.createElementNS(svgNs, 'text');
      tickLabel.setAttribute('x', '-10');
      tickLabel.setAttribute('dy', '0.32em');
      tickLabel.setAttribute('text-anchor', 'end');
      tickLabel.textContent = formatNumber(tick, { abbreviate: true, decimals: 1 });
      tickGroup.appendChild(tickLabel);

      axisGroup.appendChild(tickGroup);
    }
  }

  // ── Tooltip ────────────────────────────────────────────────────

  private showTooltip(pt: ScatterPoint, event: MouseEvent): void {
    this.hideTooltip();

    const tooltip = document.createElement('div');
    tooltip.className = 'scatter-bubble-tooltip';

    const titleEl = document.createElement('div');
    titleEl.className = 'scatter-bubble-tooltip-title';
    titleEl.textContent = pt.label || `Point ${pt.index + 1}`;
    tooltip.appendChild(titleEl);

    const xRow = document.createElement('div');
    xRow.className = 'scatter-bubble-tooltip-row';
    xRow.textContent = `X: ${formatNumber(pt.x, { abbreviate: false, decimals: 2 })}`;
    tooltip.appendChild(xRow);

    const yRow = document.createElement('div');
    yRow.className = 'scatter-bubble-tooltip-row';
    yRow.textContent = `Y: ${formatNumber(pt.y, { abbreviate: false, decimals: 2 })}`;
    tooltip.appendChild(yRow);

    if (pt.size !== null) {
      const sizeRow = document.createElement('div');
      sizeRow.className = 'scatter-bubble-tooltip-row';
      sizeRow.textContent = `Size: ${formatNumber(pt.size, { abbreviate: true })}`;
      tooltip.appendChild(sizeRow);
    }

    this.container.appendChild(tooltip);

    // Position tooltip near the cursor
    const containerRect = this.container.getBoundingClientRect();
    const left = event.clientX - containerRect.left + TOOLTIP_OFFSET;
    const top = event.clientY - containerRect.top + TOOLTIP_OFFSET;
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;

    // Clamp to container bounds
    requestAnimationFrame(() => {
      const tooltipRect = tooltip.getBoundingClientRect();
      const maxLeft = containerRect.width - tooltipRect.width - 4;
      const maxTop = containerRect.height - tooltipRect.height - 4;
      if (left > maxLeft) tooltip.style.left = `${Math.max(0, maxLeft)}px`;
      if (top > maxTop) tooltip.style.top = `${Math.max(0, maxTop)}px`;
    });
  }

  private hideTooltip(): void {
    const existing = this.container.querySelector('.scatter-bubble-tooltip');
    if (existing) {
      this.container.removeChild(existing);
    }
  }

  private handleBackgroundClick = (): void => {
    void this.selectionManager.clear();
  };

  public destroy(): void {
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];
    this.hideTooltip();
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
  }
}
