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

    // Hide shared axis toggles that are shadowed by local settings
    this.settings.axisFormattingCard.showXAxis.visible = false;
    this.settings.axisFormattingCard.showYAxis.visible = false;

    // Extract data and apply user-configured sort order to series
    const data = this.sortStreamSeries(this.extractData(dataView));

    // Populate per-series formatting groups from value columns
    if (data) {
      const themeName = resolveColorTheme(this.settings.colorThemeFormattingCard);
      const useChartPal = this.settings.colorSettings.useChartPalette.value;
      const defaultScheme = d3.scaleOrdinal(d3.schemeCategory10);
      const colorLookup = new Map<string, string>();
      data.seriesNames.forEach((name, i) => {
        colorLookup.set(name, useChartPal
          ? getHostChartColor(this.host.colorPalette, i, themeName)
          : defaultScheme(String(i)));
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

  /** Sort stream series by total value across all rows, respecting layer sort order. */
  private sortStreamSeries(data: StreamData | null): StreamData | null {
    if (!data || data.seriesNames.length <= 1) return data;

    // Compute total value per series across all rows
    const seriesTotals = data.seriesNames.map((seriesName) => {
      let total = 0;
      let peak = 0;
      for (const row of data.rows) {
        const val = row[seriesName];
        if (typeof val === 'number') {
          total += val;
          if (val > peak) peak = val;
        }
      }
      return { name: seriesName, value: total, peak };
    });

    // Apply stream-specific sort order if set
    const streamSortOrder = resolveDropdown(this.settings.streamSortSettings.sortOrder) ?? 'inside-out';

    if (streamSortOrder === 'by-peak') {
      // Sort by peak value (largest peak first for visual prominence)
      seriesTotals.sort((a, b) => b.peak - a.peak);
      return { ...data, seriesNames: seriesTotals.map((s) => s.name) };
    } else if (streamSortOrder === 'appearance') {
      // Keep original data order (no sorting)
      return data;
    }

    // Default 'inside-out': use the shared sort order utility
    const sorted = applySortOrder(seriesTotals, this.settings.sortFormattingCard);

    return {
      ...data,
      seriesNames: sorted.map((s) => s.name),
    };
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

    // Apply glass card style
    if (s.cardSettings.enableGlass.value) {
      const glass = getGlassStyle({
        mode: 'light',
        opacity: s.cardSettings.backgroundOpacity.value / 100,
        backgroundColor: s.cardSettings.backgroundColor.value?.value,
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
    const showXAxis = s.axisVisibilitySettings.showXAxis.value;
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
      this.renderStreamLegend(data, wrapper, legendPos);
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
    const useChartPalette = s.colorSettings.useChartPalette.value;
    const defaultColorScale = d3.scaleOrdinal(d3.schemeCategory10);
    const useGradient = s.streamSettings.useGradient.value;
    const gradientDefs = svg.append('defs');

    // Create gradient definitions if gradient fill is enabled
    if (useGradient) {
      stackedData.forEach((layer, i) => {
        const baseColor = useChartPalette
          ? getHostChartColor(this.host.colorPalette, i, themeName)
          : defaultColorScale(String(i));
        const sf = resolveSeriesFormatting(this.settings.seriesFormattingCard, i, baseColor);

        const gradientId = `stream-grad-${i}`;
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
          .attr('stop-color', sf.color)
          .attr('stop-opacity', streamOpacity * 0.4);

        gradient.append('stop')
          .attr('offset', '50%')
          .attr('stop-color', sf.color)
          .attr('stop-opacity', streamOpacity);

        gradient.append('stop')
          .attr('offset', '100%')
          .attr('stop-color', sf.color)
          .attr('stop-opacity', streamOpacity * 0.4);
      });
    }

    const layers = layerGroup.selectAll<SVGPathElement, d3.Series<StreamRow, string>>('.stream-layer')
      .data(stackedData)
      .join('path')
      .attr('class', 'stream-layer')
      .attr('data-series', (_d, i) => String(i))
      .attr('fill', (_d, i) => {
        if (useGradient) {
          return `url(#stream-grad-${i})`;
        }
        const baseColor = useChartPalette
          ? getHostChartColor(this.host.colorPalette, i, themeName)
          : defaultColorScale(String(i));
        const condColor = this.getConditionalColor(seriesTotals[i]);
        const sf = resolveSeriesFormatting(this.settings.seriesFormattingCard, i, baseColor);
        const effectiveOpacity = sf.opacity < 100 ? sf.opacity / 100 : streamOpacity;
        if (condColor) return withOpacity(condColor, effectiveOpacity);
        return withOpacity(sf.color, effectiveOpacity);
      })
      .attr('stroke', effectiveStrokeColor)
      .attr('stroke-width', effectiveStrokeWidth)
      .attr('stroke-dasharray', effectiveStrokeColor !== 'none' ? strokeDash : 'none')
      .attr('d', (d) => areaGenerator(d) ?? '')
      .style('transition', 'opacity 0.15s ease');

    // Tooltips — include percentage when showPercentages is enabled
    const showPercentages = s.streamDisplaySettings.showPercentages.value;
    if (showPercentages) {
      // Compute grand total across all series for percentage calculation
      const grandTotal = seriesTotals.reduce((sum, t) => sum + t, 0);
      layers.append('title')
        .text((d, i) => {
          const pct = grandTotal > 0 ? ((seriesTotals[i] / grandTotal) * 100).toFixed(1) : '0.0';
          return `${d.key}: ${pct}%`;
        });
    } else {
      layers.append('title')
        .text((d) => d.key);
    }

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
          .style('transition', 'opacity 0.15s ease')
          .text(String(Math.round(layerTotal)));
      });

      applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.stream-value-label');
    }

    // Y-axis (when enabled via streamDisplaySettings)
    const showYAxis = s.streamDisplaySettings.showYAxis.value;
    if (showYAxis) {
      const yAxisGroup = g.append('g')
        .attr('class', 'stream-axis stream-axis-y');

      yAxisGroup.call(
        d3.axisLeft(yScale)
          .ticks(6)
          .tickSize(0)
          .tickFormat((d) => String(Math.round(d as number))),
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
        // Build series data for crosshair: mid-Y of stacked layers per category
        const crosshairSeries = stackedData.map((layer, layerIdx) => ({
          name: layer.key,
          values: layer.map((point) => (point[0] + point[1]) / 2),
          color: getHostChartColor(this.host.colorPalette, layerIdx, themeName),
        }));
        const crosshairCleanup = attachCrosshair(buildCrosshairConfig({
          svg: svgEl2,
          chartGroup: chartGroupNode,
          marginLeft: MARGIN.left,
          marginTop: MARGIN.top,
          chartWidth: innerWidth,
          chartHeight: innerHeight,
          categories: data.categoryLabels,
          series: crosshairSeries,
          yScale,
          lineColor: s.crosshairFormattingCard.crosshairLineColor.value?.value || '#94A3B8',
          lineWidth: s.crosshairFormattingCard.crosshairLineWidth.value,
          lineStyle: chStyleVal,
          showValues: s.crosshairFormattingCard.showCrosshairValues.value,
          formatValue: (val: number) => String(Math.round(val * 100) / 100),
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
      this.renderStreamLegend(data, wrapper, legendPos);
    }

    // ── Accessibility (shared core) ─────────────────────────
    this.applyAccessibility(data.rows.length * data.seriesNames.length);

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

    const items: LegendItem[] = data.seriesNames.map((name, i) => ({
      label: name,
      color: getHostChartColor(this.host.colorPalette, i, themeName),
    }));
    const legendEl = renderLegend(parent, {
      items,
      position,
      fontSize: legendFmtCard.legendFontSize.value,
      fontColor,
    });

    // Animate legend entrance
    if (this.settings.animationSettings.enabled.value) {
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
    if (!acc.enableKeyboardNav.value) return;
    ensureFocusRingStyles();
    applyChartAria(this.container, {
      chartType: 'stream graph',
      title: this.settings.titleFormattingCard?.titleText?.value || undefined,
      dataPointCount,
    });
    const cleanup = attachKeyboardNav({
      container: this.container,
      itemSelector: '.stream-layer, [tabindex="0"]',
      onActivate: (el) => { (el as HTMLElement).click?.(); },
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
