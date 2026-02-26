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
  getGlassStyle,
  getHostChartColor,
  withOpacity,
  renderChartTitle,
  applyAxisFormatting,
  applyGridFormatting,
  applyAllAxisFormatting,
  applyDataLabelFormatting,
  applySortOrder,
} from '../../core/src';

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataView = powerbi.DataView;
import ISelectionId = powerbi.visuals.ISelectionId;

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
  categoryLabels: string[];
  categorySelectionIds: ISelectionId[];
}

type OffsetType = 'wiggle' | 'silhouette' | 'expand' | 'none';
type CurveType = 'basis' | 'monotoneX' | 'cardinal';
type LegendPosition = 'top' | 'bottom' | 'left' | 'right';

// ── Constants ────────────────────────────────────────────────────

const MARGIN = { top: 10, right: 10, bottom: 30, left: 10 };
const LEGEND_HEIGHT = 28;
const LEGEND_SIDE_WIDTH = 90;
const EMPTY_STATE_TEXT = 'Add a Category field and at least one Measure to build the stream graph.';

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

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new StreamGraphSettings();
    this.formattingSettingsService = new FormattingSettingsService();
    this.container.classList.add('stream-container');
  }

  public update(options: VisualUpdateOptions): void {
    // Cancel running animations
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];

    // Parse settings from dataView
    const dataView = options.dataViews?.[0];
    if (dataView) {
      this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
        StreamGraphSettings,
        dataView,
      );
    }

    // Extract data and apply user-configured sort order to series
    const data = this.sortStreamSeries(this.extractData(dataView));

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

    // Build rows: one per category, with each measure as a named property
    const rows: StreamRow[] = [];
    const categoryLabels: string[] = [];

    for (let i = 0; i < rowCount; i++) {
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
        row[seriesNames[m]] = Number.isFinite(numVal) ? Math.max(0, numVal) : 0;
      }

      rows.push(row);
    }

    return { rows, seriesNames, categoryLabels, categorySelectionIds };
  }

  // ── Sort Series ──────────────────────────────────────────────

  /** Sort stream series by total value across all rows. */
  private sortStreamSeries(data: StreamData | null): StreamData | null {
    if (!data || data.seriesNames.length <= 1) return data;

    // Compute total value per series across all rows
    const seriesTotals = data.seriesNames.map((seriesName) => {
      let total = 0;
      for (const row of data.rows) {
        const val = row[seriesName];
        if (typeof val === 'number') total += val;
      }
      return { name: seriesName, value: total };
    });

    const sorted = applySortOrder(seriesTotals, this.settings.sortFormattingCard);

    return {
      ...data,
      seriesNames: sorted.map((s) => s.name),
    };
  }

  // ── Rendering ────────────────────────────────────────────────

  private render(data: StreamData | null, viewport: powerbi.IViewport): void {
    // Clear container
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
      const styleRecord = this.container.style as unknown as Record<string, string>;
      styleRecord['background'] = glass.background;
      styleRecord['backdropFilter'] = glass.backdropFilter;
      styleRecord['WebkitBackdropFilter'] = glass.WebkitBackdropFilter;
      styleRecord['border'] = glass.border;
      styleRecord['boxShadow'] = glass.boxShadow;
      styleRecord['borderRadius'] = glass.borderRadius;
    }

    // Handle empty/null data
    if (!data) {
      this.renderEmptyState();
      return;
    }

    // Legend dimensions
    const showLegend = s.legendFormattingCard.showLegend.value && data.seriesNames.length > 1;
    const legendPos = this.getLegendPosition();
    const legendReserveV = showLegend && (legendPos === 'top' || legendPos === 'bottom') ? LEGEND_HEIGHT : 0;
    const legendReserveH = showLegend && (legendPos === 'left' || legendPos === 'right') ? LEGEND_SIDE_WIDTH : 0;

    const width = viewport.width;
    const height = viewport.height;
    const showXAxis = s.axisSettings.showXAxis.value;
    const bottomMargin = showXAxis ? MARGIN.bottom : MARGIN.top;

    // Wrapper for horizontal legend layout (left/right)
    const wrapper = document.createElement('div');
    wrapper.className = 'stream-wrapper';
    if (showLegend && (legendPos === 'left' || legendPos === 'right')) {
      wrapper.style.display = 'flex';
      wrapper.style.flexDirection = legendPos === 'left' ? 'row' : 'row-reverse';
      wrapper.style.width = '100%';
      wrapper.style.height = '100%';
    } else {
      wrapper.style.display = 'flex';
      wrapper.style.flexDirection = 'column';
      wrapper.style.width = '100%';
      wrapper.style.height = '100%';
    }
    this.container.appendChild(wrapper);

    // Legend (top or left)
    if (showLegend && (legendPos === 'top' || legendPos === 'left')) {
      this.renderLegend(data, wrapper, legendPos);
    }

    // SVG container
    const svgContainer = document.createElement('div');
    svgContainer.style.flex = '1';
    svgContainer.style.minWidth = '0';
    svgContainer.style.minHeight = '0';
    wrapper.appendChild(svgContainer);

    const svgWidth = width - legendReserveH;
    const svgHeight = height - legendReserveV;
    const innerWidth = svgWidth - MARGIN.left - MARGIN.right;
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
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Build stacked data
    const stack = d3.stack<StreamRow>()
      .keys(data.seriesNames)
      .offset(offsetFn)
      .order(d3.stackOrderNone);

    const stackedData = stack(data.rows);

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

    const layers = layerGroup.selectAll<SVGPathElement, d3.Series<StreamRow, string>>('.stream-layer')
      .data(stackedData)
      .join('path')
      .attr('class', 'stream-layer')
      .attr('data-series', (_d, i) => String(i))
      .attr('fill', (_d, i) => withOpacity(getHostChartColor(this.host.colorPalette, i), streamOpacity))
      .attr('stroke', effectiveStrokeColor)
      .attr('stroke-width', effectiveStrokeWidth)
      .attr('stroke-dasharray', effectiveStrokeColor !== 'none' ? strokeDash : 'none')
      .attr('d', (d) => areaGenerator(d) ?? '')
      .style('transition', 'opacity 0.15s ease');

    // Tooltips
    layers.append('title')
      .text((d) => d.key);

    const chartGroupNode = g.node();
    if (chartGroupNode) {
      layers
        .style('cursor', 'pointer')
        .on('click', (event: MouseEvent) => {
          event.stopPropagation();
          const selectionId = this.getSelectionIdFromPointer(
            event,
            chartGroupNode,
            xScale,
            data.categorySelectionIds,
          );
          if (selectionId) {
            void this.selectionManager.select(selectionId, event.ctrlKey || event.metaKey);
          }
        })
        .on('contextmenu', (event: MouseEvent) => {
          event.preventDefault();
          event.stopPropagation();
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

    // ── Crosshair ──────────────────────────────────────────────

    const crosshairEnabled = s.crosshairSettings.show.value;
    if (crosshairEnabled) {
      const chColor = s.crosshairSettings.lineColor.value?.value || '#94A3B8';
      const chWidth = s.crosshairSettings.lineWidth.value;
      const chStyleVal = (s.crosshairSettings.lineStyle.value as { value?: string } | undefined)?.value;
      const chDash = chStyleVal === 'dashed' ? '6 4' : 'none';
      const chShowValues = s.crosshairSettings.showValues.value;

      const crosshairGroup = g.append('g')
        .attr('class', 'crosshair-group')
        .style('display', 'none')
        .style('pointer-events', 'none');

      crosshairGroup.append('line')
        .attr('class', 'crosshair-line')
        .attr('y1', 0)
        .attr('y2', innerHeight)
        .attr('stroke', chColor)
        .attr('stroke-width', chWidth)
        .attr('stroke-dasharray', chDash);

      const rowCount = data.rows.length;

      const svgEl2 = svg.node();
      if (svgEl2) {
        svgEl2.addEventListener('mousemove', (event: MouseEvent) => {
          const [mouseX] = d3.pointer(event, g.node());

          if (mouseX < 0 || mouseX > innerWidth) {
            crosshairGroup.style('display', 'none');
            return;
          }

          crosshairGroup.style('display', null);

          // Find nearest data index
          const rawIdx = xScale.invert(mouseX);
          const nearestIdx = Math.max(0, Math.min(rowCount - 1, Math.round(rawIdx)));
          const snapX = xScale(nearestIdx);

          crosshairGroup.select('.crosshair-line')
            .attr('x1', snapX)
            .attr('x2', snapX);

          // Remove previous markers and labels
          crosshairGroup.selectAll('.crosshair-marker').remove();
          crosshairGroup.selectAll('.crosshair-label').remove();

          if (chShowValues) {
            stackedData.forEach((layer, layerIdx) => {
              const point = layer[nearestIdx];
              if (!point) return;

              const val = (point.data[layer.key] as number) ?? 0;
              const midY = yScale((point[0] + point[1]) / 2);
              const color = getHostChartColor(this.host.colorPalette, layerIdx);

              crosshairGroup.append('circle')
                .attr('class', 'crosshair-marker')
                .attr('cx', snapX)
                .attr('cy', midY)
                .attr('r', 4)
                .attr('fill', color)
                .attr('stroke', '#fff')
                .attr('stroke-width', 1.5);

              crosshairGroup.append('text')
                .attr('class', 'crosshair-label')
                .attr('x', snapX + 8)
                .attr('y', midY - 4)
                .attr('font-size', '11px')
                .attr('fill', color)
                .attr('font-weight', '600')
                .text(String(Math.round(val * 100) / 100));
            });
          }
        });

        svgEl2.addEventListener('mouseleave', () => {
          crosshairGroup.style('display', 'none');
        });
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

    // Entrance animations
    if (s.animationSettings.enabled.value) {
      this.animateEntrance(layers, stackedData, areaGenerator, flatAreaGenerator, s.animationSettings.duration.value);
    }

    // Apply shared formatting settings
    applyAllAxisFormatting(this.container, this.settings.axisFormattingCard, '.stream-axis');
    applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.stream-data-label');

    // Legend (bottom or right)
    if (showLegend && (legendPos === 'bottom' || legendPos === 'right')) {
      this.renderLegend(data, wrapper, legendPos);
    }

    this.container.addEventListener('click', this.handleBackgroundClick);
  }

  // ── Empty State ──────────────────────────────────────────────

  private renderEmptyState(): void {
    const empty = document.createElement('div');
    empty.className = 'stream-empty-state';
    empty.textContent = EMPTY_STATE_TEXT;
    this.container.appendChild(empty);

    fadeSlideIn(empty as unknown as HTMLElement, 'up', DURATION.normal, 0);
  }

  // ── Legend ──────────────────────────────────────────────────

  private renderLegend(
    data: StreamData,
    parent: HTMLElement,
    position: LegendPosition,
  ): void {
    const legendDiv = document.createElement('div');
    legendDiv.className = 'stream-legend';

    if (position === 'left' || position === 'right') {
      legendDiv.style.display = 'flex';
      legendDiv.style.flexDirection = 'column';
      legendDiv.style.gap = '6px';
      legendDiv.style.padding = '8px';
      legendDiv.style.width = `${LEGEND_SIDE_WIDTH}px`;
      legendDiv.style.flexShrink = '0';
    }

    // Resolve legend font styling from the shared legendFormattingCard
    const legendFmtCard = this.settings.legendFormattingCard;
    const rawFontColor = legendFmtCard.legendFontColor.value?.value;
    const legendFontColor = rawFontColor != null && rawFontColor.length > 0 ? rawFontColor : '';
    const legendFontSize = legendFmtCard.legendFontSize.value;

    for (let i = 0; i < data.seriesNames.length; i++) {
      const item = document.createElement('div');
      item.className = 'stream-legend-item';

      const swatch = document.createElement('div');
      swatch.className = 'stream-legend-swatch';
      swatch.style.backgroundColor = getHostChartColor(this.host.colorPalette, i);
      item.appendChild(swatch);

      const label = document.createElement('span');
      label.textContent = data.seriesNames[i];
      if (legendFontColor.length > 0) label.style.color = legendFontColor;
      if (legendFontSize !== 11) label.style.fontSize = `${legendFontSize}px`;
      item.appendChild(label);

      legendDiv.appendChild(item);
    }

    // Animate legend entrance
    if (this.settings.animationSettings.enabled.value) {
      const cancel = fadeSlideIn(
        legendDiv as unknown as HTMLElement,
        position === 'top' || position === 'left' ? 'down' : 'up',
        DURATION.normal,
        300,
      );
      this.cancelAnimations.push(cancel);
    }

    parent.appendChild(legendDiv);
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
