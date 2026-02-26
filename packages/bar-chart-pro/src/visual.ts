/**
 * Bar Chart Pro — Power BI IVisual implementation.
 * Supports grouped, stacked, combo, horizontal, and diverging chart modes
 * with glassmorphic styling, staggered entrance animations, and line overlays.
 */

import powerbi from 'powerbi-visuals-api';
import * as d3 from 'd3';
import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel';
import { BarChartProSettings } from './settings';
import {
  formatNumber,
  animate,
  drawPath,
  cubicOut,
  DURATION,
  getTheme,
  getHostChartColor,
  withOpacity,
  getGlassStyle,
  growBar,
  renderChartTitle,
  applyAxisFormatting,
  applyGridFormatting,
  applyDataLabelFormatting,
} from '../../core/src';

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataView = powerbi.DataView;
import ISelectionId = powerbi.visuals.ISelectionId;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

import '../style/visual.less';

// ── Types ───────────────────────────────────────────────────────────

type ChartMode = 'grouped' | 'stacked' | 'combo' | 'horizontal' | 'diverging';
type DataLabelMode = 'none' | 'above' | 'inside';
type LegendPosition = 'bottom' | 'top' | 'right';
type LineStyle = 'solid' | 'dashed';

interface BarSeries {
  name: string;
  values: (number | null)[];
  color: string;
}

interface LineSeries {
  name: string;
  values: (number | null)[];
  color: string;
}

interface ChartData {
  categories: string[];
  categoryLabelsByKey: Record<string, string>;
  categorySelectionIds: ISelectionId[];
  barSeries: BarSeries[];
  lineSeries: LineSeries[];
  targetValue: number | null;
  isEmpty: boolean;
}

/** Margin around the SVG chart area */
interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// ── Constants ───────────────────────────────────────────────────────

const MARGIN_DEFAULT: Margin = { top: 8, right: 12, bottom: 36, left: 44 };
const MARGIN_SECONDARY_Y: Margin = { top: 8, right: 44, bottom: 36, left: 44 };
const LEGEND_HEIGHT = 28;
const MIN_BAR_WIDTH = 2;
const LINE_DOT_RADIUS = 4;

// ── Visual ──────────────────────────────────────────────────────────

export class BarChartProVisual implements IVisual {
  private host: IVisualHost;
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private container: HTMLElement;
  private settings: BarChartProSettings;
  private formattingSettingsService: FormattingSettingsService;
  private cancelAnimations: Array<() => void> = [];
  private gradientIdCounter = 0;

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new BarChartProSettings();
    this.formattingSettingsService = new FormattingSettingsService();
    this.container.classList.add('bar-chart-container');
  }

  public update(options: VisualUpdateOptions): void {
    // Cancel running animations before re-render
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];

    // Parse settings from dataView
    const dataView = options.dataViews?.[0];
    if (dataView) {
      this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
        BarChartProSettings,
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

  // ── Data Extraction ─────────────────────────────────────────────

  private extractData(dataView: DataView | undefined): ChartData {
    const empty: ChartData = {
      categories: [],
      categoryLabelsByKey: {},
      categorySelectionIds: [],
      barSeries: [],
      lineSeries: [],
      targetValue: null,
      isEmpty: true,
    };

    if (!dataView?.categorical) return empty;

    const categorical = dataView.categorical;
    const categoryColumn = categorical.categories?.[0];
    const valuesColumns = categorical.values;

    if (!categoryColumn || !valuesColumns || valuesColumns.length === 0) return empty;

    // Extract category labels and stable unique keys.
    const categoryLabels = categoryColumn.values.map((v) =>
      v !== null && v !== undefined ? String(v) : '',
    );
    const categories = categoryLabels.map((label, idx) => `${idx}::${label}`);
    const categoryLabelsByKey: Record<string, string> = {};
    categories.forEach((key, idx) => {
      categoryLabelsByKey[key] = categoryLabels[idx];
    });

    const categorySelectionIds = categories.map((_, idx) =>
      this.host.createSelectionIdBuilder()
        .withCategory(categoryColumn, idx)
        .createSelectionId(),
    );

    if (categories.length === 0) return empty;

    const barSeries: BarSeries[] = [];
    const lineSeries: LineSeries[] = [];
    let targetValue: number | null = null;
    let colorIdx = 0;

    for (const col of valuesColumns) {
      const role = col.source.roles;
      if (!role) continue;

      if (role['values']) {
        const vals = col.values.map((v) => (typeof v === 'number' ? v : null));
        barSeries.push({
          name: col.source.displayName ?? `Series ${barSeries.length + 1}`,
          values: vals,
          color: getHostChartColor(this.host.colorPalette, colorIdx),
        });
        colorIdx++;
      }

      if (role['lineValues']) {
        const vals = col.values.map((v) => (typeof v === 'number' ? v : null));
        lineSeries.push({
          name: col.source.displayName ?? `Line ${lineSeries.length + 1}`,
          values: vals,
          color: getHostChartColor(this.host.colorPalette, colorIdx),
        });
        colorIdx++;
      }

      if (role['target'] && col.values.length > 0) {
        // Use the first non-null target value (it's a constant measure)
        for (const v of col.values) {
          if (typeof v === 'number') {
            targetValue = v;
            break;
          }
        }
      }
    }

    return {
      categories,
      categoryLabelsByKey,
      categorySelectionIds,
      barSeries,
      lineSeries,
      targetValue,
      isEmpty: barSeries.length === 0,
    };
  }

  // ── Card Style ──────────────────────────────────────────────────

  private applyCardStyle(): void {
    const s = this.settings.cardSettings;
    if (s.enableGlass.value) {
      const glass = getGlassStyle({
        mode: 'light',
        opacity: s.backgroundOpacity.value / 100,
        backgroundColor: ((s as any).backgroundColor?.value?.value ?? (s as any).bgColor?.value?.value),
        borderRadius: s.borderRadius.value,
      });
      Object.assign(this.container.style, glass);
    } else {
      // Reset glass styles
      this.container.style.background = '';
      this.container.style.backdropFilter = '';
      (this.container.style as unknown as Record<string, string>)['WebkitBackdropFilter'] = '';
      this.container.style.border = '';
      this.container.style.boxShadow = '';
      this.container.style.borderRadius = `${s.borderRadius.value}px`;
    }
  }

  // ── Empty State ─────────────────────────────────────────────────

  private renderEmpty(): void {
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    const emptyEl = document.createElement('div');
    emptyEl.className = 'bar-chart-empty';
    emptyEl.textContent = 'Add a Category and at least one Value to get started.';
    this.container.appendChild(emptyEl);
  }

  // ── Main Render ─────────────────────────────────────────────────

  private render(data: ChartData, viewport: powerbi.IViewport): void {
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    renderChartTitle(this.container, this.settings.titleFormattingCard);
    // Apply shared formatting settings
    applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.bar-chart-label');

    this.container.addEventListener('click', this.handleBackgroundClick);

    const mode = this.getChartMode();
    const s = this.settings;

    // Legend
    const showLegend = s.legendSettings.show.value && (data.barSeries.length > 1 || data.lineSeries.length > 0);
    const legendPos = this.getLegendPosition();
    const legendReserve = showLegend ? LEGEND_HEIGHT : 0;

    // Margins
    const hasSecondaryY = mode === 'combo' && s.axisSettings.showSecondaryYAxis.value && data.lineSeries.length > 0;
    const margin: Margin = hasSecondaryY ? { ...MARGIN_SECONDARY_Y } : { ...MARGIN_DEFAULT };

    if (!s.axisSettings.showXAxis.value) margin.bottom = 8;
    if (!s.axisSettings.showYAxis.value) margin.left = 8;
    if (legendPos === 'top') margin.top += legendReserve;
    if (legendPos === 'right') margin.right += 80;

    // Compute chart dimensions
    const padding = 12; // CSS padding on container
    const svgWidth = viewport.width - padding * 2;
    const svgHeight = viewport.height - padding * 2 - (legendPos === 'bottom' || legendPos === 'top' ? legendReserve : 0);
    const chartWidth = Math.max(0, svgWidth - margin.left - margin.right);
    const chartHeight = Math.max(0, svgHeight - margin.top - margin.bottom);

    if (chartWidth <= 0 || chartHeight <= 0) {
      this.renderEmpty();
      return;
    }

    // Legend (top)
    if (showLegend && legendPos === 'top') {
      this.renderLegend(data);
    }

    // SVG
    const svg = d3.select(this.container)
      .append('svg')
      .attr('class', 'bar-chart-svg')
      .attr('width', svgWidth)
      .attr('height', svgHeight);

    // Gradient defs (created once per render, shared by all bars)
    this.gradientIdCounter = 0;
    const useGradient = s.barSettings.useGradient.value;
    const defs = useGradient ? svg.append('defs') : null;

    const chartGroup = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Dispatch to mode-specific renderer
    switch (mode) {
      case 'horizontal':
        this.renderHorizontal(chartGroup, data, chartWidth, chartHeight, defs);
        break;
      case 'stacked':
        this.renderStacked(chartGroup, data, chartWidth, chartHeight, defs);
        break;
      case 'diverging':
        this.renderDiverging(chartGroup, data, chartWidth, chartHeight, defs);
        break;
      case 'combo':
        this.renderCombo(chartGroup, data, chartWidth, chartHeight, hasSecondaryY, defs);
        break;
      case 'grouped':
      default:
        this.renderGrouped(chartGroup, data, chartWidth, chartHeight, defs);
        break;
    }

    // Legend (bottom or right)
    if (showLegend && (legendPos === 'bottom' || legendPos === 'right')) {
      this.renderLegend(data);
    }

  // Apply axis and grid formatting from settings
  const svgEl = this.container.querySelector('svg');
  if (svgEl) {
    svgEl.querySelectorAll('[class*="bar-chart-axis"]').forEach((el) => {
      applyAxisFormatting(el as SVGGElement, this.settings.axisFormattingCard);
    });
    svgEl.querySelectorAll('[class*="bar-chart-grid"]').forEach((el) => {
      applyGridFormatting(el as SVGGElement, this.settings.axisFormattingCard);
    });
  }
}

  // ── Grouped Mode ────────────────────────────────────────────────

  private renderGrouped(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    data: ChartData,
    width: number,
    height: number,
    defs: d3.Selection<SVGDefsElement, unknown, null, undefined> | null = null,
  ): void {
    const s = this.settings;
    const spacing = s.barSettings.barSpacing.value;
    const cornerRadius = s.barSettings.cornerRadius.value;

    // Scales
    const x0 = d3.scaleBand()
      .domain(data.categories)
      .range([0, width])
      .paddingInner(0.1 + spacing * 0.02)
      .paddingOuter(0.05);

    const seriesKeys = data.barSeries.map((_, i) => String(i));
    const x1 = d3.scaleBand()
      .domain(seriesKeys)
      .range([0, x0.bandwidth()])
      .padding(0.05);

    const allValues = data.barSeries.flatMap((ser) => ser.values.filter((v): v is number => v !== null));
    const yMax = d3.max(allValues) ?? 0;
    const y = d3.scaleLinear()
      .domain([0, yMax * 1.1])
      .nice()
      .range([height, 0]);

    // Grid + axes
    this.renderGrid(g, y, width, height);
    this.renderAxes(g, x0, y, width, height, null, data.categoryLabelsByKey);

    // Bars
    data.categories.forEach((cat, catIdx) => {
      data.barSeries.forEach((series, serIdx) => {
        const val = series.values[catIdx];
        if (val === null || val === undefined) return;

        const barX = (x0(cat) ?? 0) + (x1(String(serIdx)) ?? 0);
        const barW = Math.max(MIN_BAR_WIDTH, x1.bandwidth());
        const barY = y(val);
        const barH = height - barY;

        const rect = g.append('rect')
          .attr('class', 'bar-chart-bar')
          .attr('x', barX)
          .attr('y', barY)
          .attr('width', barW)
          .attr('height', barH)
          .attr('rx', Math.min(cornerRadius, barW / 2))
          .attr('ry', Math.min(cornerRadius, barW / 2))
          .attr('fill', this.getBarFill(defs, series.color, 'vertical'))
          .attr('stroke', this.settings.barSettings.barBorderColor.value?.value || 'none')
          .attr('stroke-width', this.settings.barSettings.barBorderWidth.value)
          .attr('opacity', this.settings.barSettings.barOpacity.value / 100);

        this.attachSelection(rect, data.categorySelectionIds[catIdx]);
        this.attachBarTooltip(rect, this.getCategoryLabel(cat, data), series.name, val);
        this.animateBar(rect, barH, catIdx, 'vertical');
        this.renderDataLabel(g, barX + barW / 2, barY, barH, val, height);
      });
    });

    // Target line
    this.renderTargetLine(g, data.targetValue, y, width);
  }

  // ── Stacked Mode ────────────────────────────────────────────────

  private renderStacked(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    data: ChartData,
    width: number,
    height: number,
    defs: d3.Selection<SVGDefsElement, unknown, null, undefined> | null = null,
  ): void {
    const s = this.settings;
    const spacing = s.barSettings.barSpacing.value;
    const cornerRadius = s.barSettings.cornerRadius.value;

    const x = d3.scaleBand()
      .domain(data.categories)
      .range([0, width])
      .paddingInner(0.1 + spacing * 0.02)
      .paddingOuter(0.05);

    // Compute stacked totals per category
    const stackedMax = data.categories.map((_, catIdx) => {
      let total = 0;
      for (const series of data.barSeries) {
        const v = series.values[catIdx];
        if (v !== null && v > 0) total += v;
      }
      return total;
    });

    const yMax = d3.max(stackedMax) ?? 0;
    const y = d3.scaleLinear()
      .domain([0, yMax * 1.1])
      .nice()
      .range([height, 0]);

    this.renderGrid(g, y, width, height);
    this.renderAxes(g, x, y, width, height, null, data.categoryLabelsByKey);

    data.categories.forEach((cat, catIdx) => {
      let cumulative = 0;
      const barW = Math.max(MIN_BAR_WIDTH, x.bandwidth());

      data.barSeries.forEach((series, serIdx) => {
        const val = series.values[catIdx];
        if (val === null || val === undefined || val <= 0) return;

        const barX = x(cat) ?? 0;
        const barY = y(cumulative + val);
        const barH = y(cumulative) - y(cumulative + val);

        // Only round the top segment
        const isTopSegment = serIdx === data.barSeries.length - 1 ||
          data.barSeries.slice(serIdx + 1).every((s) => {
            const sv = s.values[catIdx];
            return sv === null || sv === undefined || sv <= 0;
          });

        const rx = isTopSegment ? Math.min(cornerRadius, barW / 2) : 0;
        const ry = isTopSegment ? Math.min(cornerRadius, barW / 2) : 0;

        const rect = g.append('rect')
          .attr('class', 'bar-chart-bar')
          .attr('x', barX)
          .attr('y', barY)
          .attr('width', barW)
          .attr('height', Math.max(0, barH))
          .attr('rx', rx)
          .attr('ry', ry)
          .attr('fill', this.getBarFill(defs, series.color, 'vertical'))
          .attr('stroke', this.settings.barSettings.barBorderColor.value?.value || 'none')
          .attr('stroke-width', this.settings.barSettings.barBorderWidth.value)
          .attr('opacity', this.settings.barSettings.barOpacity.value / 100);

        this.attachSelection(rect, data.categorySelectionIds[catIdx]);
        this.attachBarTooltip(rect, this.getCategoryLabel(cat, data), series.name, val);
        this.animateBar(rect, barH, catIdx, 'vertical');

        cumulative += val;
      });

      // Data label on top of the full stack
      if (cumulative > 0) {
        this.renderDataLabel(g, (x(cat) ?? 0) + barW / 2, y(cumulative), height - y(cumulative), cumulative, height);
      }
    });

    this.renderTargetLine(g, data.targetValue, y, width);
  }

  // ── Combo Mode (Bars + Lines) ───────────────────────────────────

  private renderCombo(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    data: ChartData,
    width: number,
    height: number,
    hasSecondaryY: boolean,
    defs: d3.Selection<SVGDefsElement, unknown, null, undefined> | null = null,
  ): void {
    const s = this.settings;
    const spacing = s.barSettings.barSpacing.value;
    const cornerRadius = s.barSettings.cornerRadius.value;

    // X scale
    const x = d3.scaleBand()
      .domain(data.categories)
      .range([0, width])
      .paddingInner(0.15 + spacing * 0.02)
      .paddingOuter(0.05);

    // Y scale (bars)
    const barValues = data.barSeries.flatMap((ser) => ser.values.filter((v): v is number => v !== null));
    const yBarMax = d3.max(barValues) ?? 0;
    const yBar = d3.scaleLinear()
      .domain([0, yBarMax * 1.1])
      .nice()
      .range([height, 0]);

    // Y scale (lines — uses secondary axis if enabled)
    const lineValues = data.lineSeries.flatMap((ser) => ser.values.filter((v): v is number => v !== null));
    const yLineMax = d3.max(lineValues) ?? yBarMax;
    const yLine = hasSecondaryY
      ? d3.scaleLinear().domain([0, yLineMax * 1.1]).nice().range([height, 0])
      : yBar;

    this.renderGrid(g, yBar, width, height);
    this.renderAxes(g, x, yBar, width, height, hasSecondaryY ? yLine : null, data.categoryLabelsByKey);

    // Bars (grouped within combo)
    const seriesKeys = data.barSeries.map((_, i) => String(i));
    const x1 = d3.scaleBand()
      .domain(seriesKeys)
      .range([0, x.bandwidth()])
      .padding(0.05);

    data.categories.forEach((cat, catIdx) => {
      data.barSeries.forEach((series, serIdx) => {
        const val = series.values[catIdx];
        if (val === null) return;

        const barX = (x(cat) ?? 0) + (x1(String(serIdx)) ?? 0);
        const barW = Math.max(MIN_BAR_WIDTH, x1.bandwidth());
        const barY = yBar(val);
        const barH = height - barY;

        const rect = g.append('rect')
          .attr('class', 'bar-chart-bar')
          .attr('x', barX)
          .attr('y', barY)
          .attr('width', barW)
          .attr('height', barH)
          .attr('rx', Math.min(cornerRadius, barW / 2))
          .attr('ry', Math.min(cornerRadius, barW / 2))
          .attr('fill', this.getBarFill(defs, series.color, 'vertical'))
          .attr('stroke', this.settings.barSettings.barBorderColor.value?.value || 'none')
          .attr('stroke-width', this.settings.barSettings.barBorderWidth.value)
          .attr('opacity', this.settings.barSettings.barOpacity.value / 100);

        this.attachSelection(rect, data.categorySelectionIds[catIdx]);
        this.attachBarTooltip(rect, this.getCategoryLabel(cat, data), series.name, val);
        this.animateBar(rect, barH, catIdx, 'vertical');
        this.renderDataLabel(g, barX + barW / 2, barY, barH, val, height);
      });
    });

    // Lines
    const lineWidth = s.lineSettings.lineWidth.value;
    const showDots = s.lineSettings.showDots.value;
    const lineStyle = this.getLineStyle();
    const animEnabled = s.animationSettings.enabled.value;
    const animDuration = s.animationSettings.duration.value;

    for (const series of data.lineSeries) {
      const lineData: Array<{ x: number; y: number; val: number; cat: string; catIdx: number }> = [];

      data.categories.forEach((cat, i) => {
        const val = series.values[i];
        if (val !== null) {
          lineData.push({
            x: (x(cat) ?? 0) + x.bandwidth() / 2,
            y: yLine(val),
            val,
              cat: this.getCategoryLabel(cat, data),
              catIdx: i,
          });
        }
      });

      if (lineData.length < 2) continue;

      const lineFn = d3.line<{ x: number; y: number }>()
        .x((d) => d.x)
        .y((d) => d.y)
        .curve(d3.curveMonotoneX);

      const pathEl = g.append('path')
        .datum(lineData)
        .attr('class', 'bar-chart-line')
        .attr('d', lineFn)
        .attr('stroke', series.color)
        .attr('stroke-width', lineWidth)
        .attr('stroke-dasharray', lineStyle === 'dashed' ? '6 3' : 'none');

      if (animEnabled) {
        const node = pathEl.node();
        if (node) {
          const cancel = drawPath(node, animDuration, 200);
          this.cancelAnimations.push(cancel);
        }
      }

      if (showDots) {
        lineData.forEach((d) => {
          const dot = g.append('circle')
            .attr('class', 'bar-chart-line-dot')
            .attr('cx', d.x)
            .attr('cy', d.y)
            .attr('r', LINE_DOT_RADIUS)
            .attr('fill', series.color);

          this.attachSelection(dot, data.categorySelectionIds[d.catIdx]);
          this.attachDotTooltip(dot, d.cat, series.name, d.val);
        });
      }
    }

    this.renderTargetLine(g, data.targetValue, yBar, width);
  }

  // ── Horizontal Mode ─────────────────────────────────────────────

  private renderHorizontal(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    data: ChartData,
    width: number,
    height: number,
    defs: d3.Selection<SVGDefsElement, unknown, null, undefined> | null = null,
  ): void {
    const s = this.settings;
    const spacing = s.barSettings.barSpacing.value;
    const cornerRadius = s.barSettings.cornerRadius.value;

    // Y scale (categories on Y axis for horizontal)
    const y = d3.scaleBand()
      .domain(data.categories)
      .range([0, height])
      .paddingInner(0.1 + spacing * 0.02)
      .paddingOuter(0.05);

    const seriesKeys = data.barSeries.map((_, i) => String(i));
    const y1 = d3.scaleBand()
      .domain(seriesKeys)
      .range([0, y.bandwidth()])
      .padding(0.05);

    const allValues = data.barSeries.flatMap((ser) => ser.values.filter((v): v is number => v !== null));
    const xMax = d3.max(allValues) ?? 0;
    const x = d3.scaleLinear()
      .domain([0, xMax * 1.1])
      .nice()
      .range([0, width]);

    // Axes
    if (s.axisSettings.showYAxis.value) {
      g.append('g')
        .attr('class', 'bar-chart-axis')
        .call(
          d3.axisLeft(y)
            .tickSize(0)
            .tickFormat((d) => this.getCategoryLabel(String(d), data)),
        )
        .select('.domain').remove();
    }

    if (s.axisSettings.showXAxis.value) {
      g.append('g')
        .attr('class', 'bar-chart-axis')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(5).tickFormat((d) => formatNumber(d as number, { abbreviate: true })))
        .select('.domain').remove();
    }

    // Horizontal grid
    g.append('g')
      .attr('class', 'bar-chart-grid')
      .call(
        d3.axisBottom(x)
          .ticks(5)
          .tickSize(height)
          .tickFormat(() => ''),
      )
      .attr('transform', 'translate(0,0)');

    // Bars
    data.categories.forEach((cat, catIdx) => {
      data.barSeries.forEach((series, serIdx) => {
        const val = series.values[catIdx];
        if (val === null || val === undefined) return;

        const barY = (y(cat) ?? 0) + (y1(String(serIdx)) ?? 0);
        const barH = Math.max(MIN_BAR_WIDTH, y1.bandwidth());
        const barW = x(val);

        const rect = g.append('rect')
          .attr('class', 'bar-chart-bar')
          .attr('x', 0)
          .attr('y', barY)
          .attr('width', Math.max(0, barW))
          .attr('height', barH)
          .attr('rx', Math.min(cornerRadius, barH / 2))
          .attr('ry', Math.min(cornerRadius, barH / 2))
          .attr('fill', this.getBarFill(defs, series.color, 'horizontal'))
          .attr('stroke', this.settings.barSettings.barBorderColor.value?.value || 'none')
          .attr('stroke-width', this.settings.barSettings.barBorderWidth.value)
          .attr('opacity', this.settings.barSettings.barOpacity.value / 100);

        this.attachSelection(rect, data.categorySelectionIds[catIdx]);
        this.attachBarTooltip(rect, this.getCategoryLabel(cat, data), series.name, val);
        this.animateBar(rect, barW, catIdx, 'horizontal');
        this.renderHorizontalDataLabel(g, barW, barY + barH / 2, val, width);
      });
    });

    // Target line (vertical for horizontal mode)
    if (data.targetValue !== null && s.targetLine.show.value) {
      const tVal = data.targetValue;
      const tx = x(tVal);
      const targetColor = s.targetLine.color.value?.value ?? '#F87171';
      const tStyle = this.getTargetStyle();

      g.append('line')
        .attr('class', 'bar-chart-target')
        .attr('x1', tx)
        .attr('x2', tx)
        .attr('y1', 0)
        .attr('y2', height)
        .attr('stroke', targetColor)
        .attr('stroke-dasharray', tStyle === 'dashed' ? '6 3' : 'none');

      const labelText = s.targetLine.label.value || formatNumber(tVal, { abbreviate: true });
      g.append('text')
        .attr('class', 'bar-chart-target-label')
        .attr('x', tx + 4)
        .attr('y', 12)
        .attr('fill', targetColor)
        .text(labelText);
    }
  }

  // ── Diverging Mode ──────────────────────────────────────────────

  private renderDiverging(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    data: ChartData,
    width: number,
    height: number,
    defs: d3.Selection<SVGDefsElement, unknown, null, undefined> | null = null,
  ): void {
    const s = this.settings;
    const spacing = s.barSettings.barSpacing.value;
    const cornerRadius = s.barSettings.cornerRadius.value;

    // Uses only the first bar series for diverging
    const series = data.barSeries[0];
    if (!series) return;

    const x = d3.scaleBand()
      .domain(data.categories)
      .range([0, width])
      .paddingInner(0.1 + spacing * 0.02)
      .paddingOuter(0.05);

    const validValues = series.values.filter((v): v is number => v !== null);
    const absMax = d3.max(validValues.map(Math.abs)) ?? 0;
    const y = d3.scaleLinear()
      .domain([-absMax * 1.1, absMax * 1.1])
      .nice()
      .range([height, 0]);

    this.renderGrid(g, y, width, height);

    // X-axis at zero line
    const zeroY = y(0);
    if (s.axisSettings.showXAxis.value) {
      g.append('g')
        .attr('class', 'bar-chart-axis')
        .attr('transform', `translate(0,${zeroY})`)
        .call(
          d3.axisBottom(x)
            .tickSize(0)
            .tickFormat((d) => this.getCategoryLabel(String(d), data)),
        )
        .call((gSel) => {
          const rotation = s.axisSettings.xLabelRotation.value;
          if (rotation !== 0) {
            gSel.selectAll('text')
              .attr('transform', `rotate(${rotation})`)
              .style('text-anchor', rotation > 0 ? 'start' : 'end');
          }
        });
    }

    if (s.axisSettings.showYAxis.value) {
      g.append('g')
        .attr('class', 'bar-chart-axis')
        .call(d3.axisLeft(y).ticks(6).tickFormat((d) => formatNumber(d as number, { abbreviate: true })));
    }

    const theme = getTheme('light');

    data.categories.forEach((cat, catIdx) => {
      const val = series.values[catIdx];
      if (val === null || val === undefined) return;

      const barX = x(cat) ?? 0;
      const barW = Math.max(MIN_BAR_WIDTH, x.bandwidth());
      const isPositive = val >= 0;
      const barY = isPositive ? y(val) : zeroY;
      const barH = Math.abs(y(val) - zeroY);

      const color = isPositive ? theme.semantic.positive : theme.semantic.negative;

      const rect = g.append('rect')
        .attr('class', 'bar-chart-bar')
        .attr('x', barX)
        .attr('y', barY)
        .attr('width', barW)
        .attr('height', Math.max(0, barH))
        .attr('rx', Math.min(cornerRadius, barW / 2))
        .attr('ry', Math.min(cornerRadius, barW / 2))
        .attr('fill', this.getBarFill(defs, color, 'vertical'))
        .attr('stroke', this.settings.barSettings.barBorderColor.value?.value || 'none')
        .attr('stroke-width', this.settings.barSettings.barBorderWidth.value)
        .attr('opacity', this.settings.barSettings.barOpacity.value / 100);

      this.attachSelection(rect, data.categorySelectionIds[catIdx]);
      this.attachBarTooltip(rect, this.getCategoryLabel(cat, data), series.name, val);
      this.animateBar(rect, barH, catIdx, 'vertical');

      // Data label — position above positive bars and below negative bars
      this.renderDataLabel(g, barX + barW / 2, isPositive ? barY : barY + barH, barH, val, height);
    });

    this.renderTargetLine(g, data.targetValue, y, width);
  }

  // ── Shared Rendering Helpers ────────────────────────────────────

  private renderGrid(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    yScale: d3.ScaleLinear<number, number>,
    width: number,
    _height: number,
  ): void {
    g.append('g')
      .attr('class', 'bar-chart-grid')
      .call(
        d3.axisLeft(yScale)
          .ticks(6)
          .tickSize(-width)
          .tickFormat(() => ''),
      );
  }

  private renderAxes(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    xScale: d3.ScaleBand<string>,
    yScale: d3.ScaleLinear<number, number>,
    width: number,
    height: number,
    secondaryYScale: d3.ScaleLinear<number, number> | null,
    categoryLabelsByKey: Record<string, string>,
  ): void {
    const s = this.settings;

    if (s.axisSettings.showXAxis.value) {
      const xAxis = g.append('g')
        .attr('class', 'bar-chart-axis bar-chart-axis-x')
        .attr('transform', `translate(0,${height})`)
        .call(
          d3.axisBottom(xScale)
            .tickSize(0)
            .tickFormat((d) => categoryLabelsByKey[String(d)] ?? String(d)),
        );

      const rotation = s.axisSettings.xLabelRotation.value;
      if (rotation !== 0) {
        xAxis.selectAll('text')
          .attr('transform', `rotate(${rotation})`)
          .style('text-anchor', rotation > 0 ? 'start' : 'end')
          .attr('dx', rotation > 0 ? '0.5em' : '-0.5em')
          .attr('dy', '0.25em');
      }

      xAxis.select('.domain').remove();
    }

    if (s.axisSettings.showYAxis.value) {
      g.append('g')
        .attr('class', 'bar-chart-axis')
        .call(
          d3.axisLeft(yScale)
            .ticks(6)
            .tickFormat((d) => formatNumber(d as number, { abbreviate: true })),
        )
        .select('.domain').remove();
    }

    if (secondaryYScale && s.axisSettings.showSecondaryYAxis.value) {
      g.append('g')
        .attr('class', 'bar-chart-axis')
        .attr('transform', `translate(${width},0)`)
        .call(
          d3.axisRight(secondaryYScale)
            .ticks(6)
            .tickFormat((d) => formatNumber(d as number, { abbreviate: true })),
        )
        .select('.domain').remove();
    }
  }

  private renderTargetLine(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    targetValue: number | null,
    yScale: d3.ScaleLinear<number, number>,
    width: number,
  ): void {
    const s = this.settings;
    if (targetValue === null || !s.targetLine.show.value) return;

    const ty = yScale(targetValue);
    const targetColor = s.targetLine.color.value?.value ?? '#F87171';
    const tStyle = this.getTargetStyle();

    g.append('line')
      .attr('class', 'bar-chart-target')
      .attr('x1', 0)
      .attr('x2', width)
      .attr('y1', ty)
      .attr('y2', ty)
      .attr('stroke', targetColor)
      .attr('stroke-dasharray', tStyle === 'dashed' ? '6 3' : 'none');

    const labelText = s.targetLine.label.value || formatNumber(targetValue, { abbreviate: true });
    g.append('text')
      .attr('class', 'bar-chart-target-label')
      .attr('x', width - 4)
      .attr('y', ty - 6)
      .attr('text-anchor', 'end')
      .attr('fill', targetColor)
      .text(labelText);
  }

  private renderDataLabel(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    cx: number,
    barY: number,
    barH: number,
    value: number,
    chartHeight: number,
  ): void {
    const labelMode = this.getDataLabelMode();
    if (labelMode === 'none') return;

    const text = formatNumber(value, { abbreviate: true });
    const isInside = labelMode === 'inside';
    const yPos = isInside ? barY + Math.min(barH / 2 + 4, barH - 2) : barY - 6;

    // Skip if the label would be outside the chart
    if (yPos < 0 || yPos > chartHeight) return;

    g.append('text')
      .attr('class', isInside ? 'bar-chart-label bar-chart-label-inside' : 'bar-chart-label')
      .attr('x', cx)
      .attr('y', yPos)
      .text(text);
  }

  private renderHorizontalDataLabel(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    barW: number,
    cy: number,
    value: number,
    chartWidth: number,
  ): void {
    const labelMode = this.getDataLabelMode();
    if (labelMode === 'none') return;

    const text = formatNumber(value, { abbreviate: true });
    const isInside = labelMode === 'inside';
    const xPos = isInside ? Math.max(4, barW - 4) : barW + 6;

    // Skip if the label would be outside the chart
    if (xPos < 0 || xPos > chartWidth) return;

    g.append('text')
      .attr('class', isInside ? 'bar-chart-label bar-chart-label-inside' : 'bar-chart-label')
      .attr('x', xPos)
      .attr('y', cy)
      .attr('text-anchor', isInside ? 'end' : 'start')
      .attr('dominant-baseline', 'central')
      .text(text);
  }

  private getCategoryLabel(categoryKey: string, data: ChartData): string {
    return data.categoryLabelsByKey[categoryKey] ?? categoryKey;
  }

  private renderLegend(data: ChartData): void {
    const legendDiv = document.createElement('div');
    legendDiv.className = 'bar-chart-legend';

    // Resolve legend font styling from the shared legendFormattingCard
    const legendFmtCard = this.settings.legendFormattingCard;
    const rawFontColor = legendFmtCard.legendFontColor.value?.value;
    const legendFontColor = rawFontColor != null && rawFontColor.length > 0 ? rawFontColor : '';
    const legendFontSize = legendFmtCard.legendFontSize.value;

    // Bar series
    for (const series of data.barSeries) {
      const item = document.createElement('div');
      item.className = 'bar-chart-legend-item';

      const swatch = document.createElement('div');
      swatch.className = 'bar-chart-legend-swatch';
      swatch.style.backgroundColor = series.color;
      item.appendChild(swatch);

      const label = document.createElement('span');
      label.textContent = series.name;
      if (legendFontColor.length > 0) label.style.color = legendFontColor;
      if (legendFontSize !== 11) label.style.fontSize = `${legendFontSize}px`;
      item.appendChild(label);

      legendDiv.appendChild(item);
    }

    // Line series
    for (const series of data.lineSeries) {
      const item = document.createElement('div');
      item.className = 'bar-chart-legend-item';

      const swatch = document.createElement('div');
      swatch.className = 'bar-chart-legend-line-swatch';
      swatch.style.backgroundColor = series.color;
      item.appendChild(swatch);

      const label = document.createElement('span');
      label.textContent = series.name;
      if (legendFontColor.length > 0) label.style.color = legendFontColor;
      if (legendFontSize !== 11) label.style.fontSize = `${legendFontSize}px`;
      item.appendChild(label);

      legendDiv.appendChild(item);
    }

    this.container.appendChild(legendDiv);
  }

  // ── Animation ───────────────────────────────────────────────────

  private animateBar(
    rect: d3.Selection<SVGRectElement, unknown, null, undefined>,
    _size: number,
    index: number,
    direction: 'vertical' | 'horizontal',
  ): void {
    const s = this.settings;
    if (!s.animationSettings.enabled.value) return;

    const node = rect.node();
    if (!node) return;

    const delay = index * s.animationSettings.staggerDelay.value;
    const duration = s.animationSettings.duration.value;

    const cancel = growBar(node, delay, duration, direction);
    this.cancelAnimations.push(cancel);
  }

  // ── Tooltips ────────────────────────────────────────────────────

  private attachBarTooltip(
    rect: d3.Selection<SVGRectElement, unknown, null, undefined>,
    category: string,
    seriesName: string,
    value: number,
  ): void {
    const host = this.host;

    rect.on('mouseover', (event: MouseEvent) => {
      const tooltipData: VisualTooltipDataItem[] = [
        { displayName: 'Category', value: category },
        { displayName: seriesName, value: formatNumber(value, { abbreviate: false }) },
      ];

      host.tooltipService.show({
        dataItems: tooltipData,
        identities: [],
        coordinates: [event.clientX, event.clientY],
        isTouchEvent: false,
      });
    });

    rect.on('mousemove', (event: MouseEvent) => {
      host.tooltipService.move({
        dataItems: [],
        identities: [],
        coordinates: [event.clientX, event.clientY],
        isTouchEvent: false,
      });
    });

    rect.on('mouseout', () => {
      host.tooltipService.hide({ immediately: true, isTouchEvent: false });
    });
  }

  private attachDotTooltip(
    circle: d3.Selection<SVGCircleElement, unknown, null, undefined>,
    category: string,
    seriesName: string,
    value: number,
  ): void {
    const host = this.host;

    circle.on('mouseover', (event: MouseEvent) => {
      const tooltipData: VisualTooltipDataItem[] = [
        { displayName: 'Category', value: category },
        { displayName: seriesName, value: formatNumber(value, { abbreviate: false }) },
      ];

      host.tooltipService.show({
        dataItems: tooltipData,
        identities: [],
        coordinates: [event.clientX, event.clientY],
        isTouchEvent: false,
      });
    });

    circle.on('mousemove', (event: MouseEvent) => {
      host.tooltipService.move({
        dataItems: [],
        identities: [],
        coordinates: [event.clientX, event.clientY],
        isTouchEvent: false,
      });
    });

    circle.on('mouseout', () => {
      host.tooltipService.hide({ immediately: true, isTouchEvent: false });
    });
  }

  private attachSelection<
    E extends SVGRectElement | SVGCircleElement
  >(
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

  // ── Gradient Helpers ────────────────────────────────────────────

  /**
   * Creates an SVG linearGradient in the given `<defs>` container and returns
   * a `url(#id)` string suitable for the `fill` attribute.
   *
   * The gradient goes from a lighter tint of `color` to the full `color`.
   * - vertical mode: top (light) -> bottom (full)
   * - horizontal mode: left (light) -> right (full)
   */
  private createBarGradient(
    defs: d3.Selection<SVGDefsElement, unknown, null, undefined>,
    color: string,
    direction: 'vertical' | 'horizontal',
  ): string {
    const id = `bar-grad-${this.gradientIdCounter++}`;

    // Lighten the color by blending with white
    const parsed = d3.color(color);
    const lighterColor = parsed
      ? d3.interpolateRgb(color, '#ffffff')(0.45)
      : color;

    const grad = defs.append('linearGradient').attr('id', id);

    if (direction === 'vertical') {
      grad.attr('x1', '0').attr('y1', '0').attr('x2', '0').attr('y2', '1');
    } else {
      grad.attr('x1', '0').attr('y1', '0').attr('x2', '1').attr('y2', '0');
    }

    grad.append('stop').attr('offset', '0%').attr('stop-color', lighterColor);
    grad.append('stop').attr('offset', '100%').attr('stop-color', color);

    return `url(#${id})`;
  }

  /**
   * Returns the fill value for a bar: either a gradient URL or the flat color.
   */
  private getBarFill(
    defs: d3.Selection<SVGDefsElement, unknown, null, undefined> | null,
    color: string,
    direction: 'vertical' | 'horizontal',
  ): string {
    if (defs) {
      return this.createBarGradient(defs, color, direction);
    }
    return color;
  }

  // ── Setting Accessors ───────────────────────────────────────────

  private getChartMode(): ChartMode {
    const val = this.settings.chartMode.mode.value?.value;
    const validModes: ChartMode[] = ['grouped', 'stacked', 'combo', 'horizontal', 'diverging'];
    if (typeof val === 'string' && validModes.includes(val as ChartMode)) {
      return val as ChartMode;
    }
    return 'grouped';
  }

  private getDataLabelMode(): DataLabelMode {
    const val = this.settings.barSettings.showDataLabels.value?.value;
    const validModes: DataLabelMode[] = ['none', 'above', 'inside'];
    if (typeof val === 'string' && validModes.includes(val as DataLabelMode)) {
      return val as DataLabelMode;
    }
    return 'none';
  }

  private getLegendPosition(): LegendPosition {
    const val = this.settings.legendSettings.position.value?.value;
    const validPositions: LegendPosition[] = ['bottom', 'top', 'right'];
    if (typeof val === 'string' && validPositions.includes(val as LegendPosition)) {
      return val as LegendPosition;
    }
    return 'bottom';
  }

  private getLineStyle(): LineStyle {
    const val = this.settings.lineSettings.lineStyle.value?.value;
    if (val === 'solid' || val === 'dashed') return val;
    return 'solid';
  }

  private getTargetStyle(): LineStyle {
    const val = this.settings.targetLine.style.value?.value;
    if (val === 'solid' || val === 'dashed') return val;
    return 'dashed';
  }

  // ── Formatting Model ────────────────────────────────────────────

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  // ── Cleanup ─────────────────────────────────────────────────────

  public destroy(): void {
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
  }
}
