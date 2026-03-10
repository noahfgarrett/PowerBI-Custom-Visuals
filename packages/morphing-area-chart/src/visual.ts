/**
 * Morphing Area Chart — Power BI IVisual implementation.
 * Line chart with gradient fill beneath, animated path drawing,
 * dot pop-in, and optional multi-series support.
 */

import powerbi from 'powerbi-visuals-api';
import * as d3 from 'd3';
import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel';
import { MorphingAreaChartSettings } from './settings';
import {
  formatNumber,
  formatWithSettings,
  animate,
  drawPath,
  popIn,
  fadeSlideIn,
  cubicOut,
  getHostChartColor,
  withOpacity,
  getGlassStyle,
  renderChartTitle,
  applyAxisFormatting,
  applyGridFormatting,
  applyDataLabelFormatting,
  createScrollableChart,
  resolveDropdown,
  renderLegend,
  attachCrosshair,
  buildCrosshairConfig,
  computeStatValue,
  renderHorizontalReferenceLine,
  type LegendItem,
  type StatType,
  type SeriesFormatting,
  type LineStyleType,
  resolveSeriesFormatting,
  populateSeriesFormattingGroups,
  lineStyleToDashArray,
  resolveColorTheme,
  buildConditionalConfig,
  resolveConditionalColor,
  applyChartAria,
  attachKeyboardNav,
  ensureFocusRingStyles,
  computeRegression,
  renderTrendLine,
  type TrendType,
  renderAnnotations,
  buildAnnotationConfig,
} from '../../core/src';

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataView = powerbi.DataView;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;
import ISelectionId = powerbi.visuals.ISelectionId;

import '../style/visual.less';

// ── Types ───────────────────────────────────────────────────────────

type CurveType = 'monotoneX' | 'linear' | 'step';
type LegendPosition = 'top' | 'bottom' | 'left' | 'right';

interface SeriesData {
  name: string;
  values: (number | null)[];
  color: string;
}

interface ChartData {
  categories: string[];
  categorySelectionIds: ISelectionId[];
  series: SeriesData[];
  isEmpty: boolean;
}

interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// ── Constants ───────────────────────────────────────────────────────

const MARGIN_DEFAULT: Margin = { top: 20, right: 20, bottom: 40, left: 50 };
const DOT_HOVER_EXTRA = 2;
const LEGEND_HEIGHT = 28;
const LEGEND_SIDE_WIDTH = 90;

// ── Visual ──────────────────────────────────────────────────────────

export class MorphingAreaChartVisual implements IVisual {
  private host: IVisualHost;
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private container: HTMLElement;
  private settings: MorphingAreaChartSettings;
  private formattingSettingsService: FormattingSettingsService;
  private cancelAnimations: Array<() => void> = [];
  /** Monotonically increasing ID to namespace SVG gradient defs per render. */
  private renderGeneration = 0;
  /** Cached resolved per-series formats for the current render cycle */
  private cachedSeriesFormats: SeriesFormatting[] = [];

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new MorphingAreaChartSettings();
    this.formattingSettingsService = new FormattingSettingsService();
    this.container.classList.add('area-chart-container');
  }

  public update(options: VisualUpdateOptions): void {
    // Cancel running animations before re-render
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];

    // Parse settings from dataView
    const dataView = options.dataViews?.[0];
    if (dataView) {
      this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
        MorphingAreaChartSettings,
        dataView,
      );
    }

    // Hide shared properties that are shadowed by local settings
    this.settings.lineStrokeFormattingCard.lineWidth.visible = false;
    this.settings.axisFormattingCard.showXAxis.visible = false;
    this.settings.axisFormattingCard.showYAxis.visible = false;
    this.settings.axisFormattingCard.showGridLines.visible = false;
    // xAxisTitle and yAxisTitle are kept visible so users can set axis titles
    this.settings.axisFormattingCard.axisLabelFontFamily.visible = false;
    this.settings.axisFormattingCard.axisLabelRotation.visible = false;
    this.settings.axisFormattingCard.yAxisMin.visible = false;
    this.settings.axisFormattingCard.yAxisMax.visible = false;
    this.settings.axisFormattingCard.gridLineWidth.visible = false;
    this.settings.axisFormattingCard.gridLineOpacity.visible = false;

    // Conditional visibility: hide child settings when parent toggle is off
    this.settings.areaForecastSettings.periods.visible = this.settings.areaForecastSettings.show.value;
    this.settings.areaForecastSettings.opacity.visible = this.settings.areaForecastSettings.show.value;
    this.settings.brushSettings.contextHeight.visible = this.settings.brushSettings.enabled.value;
    this.settings.brushSettings.brushColor.visible = this.settings.brushSettings.enabled.value;
    this.settings.brushSettings.brushOpacity.visible = this.settings.brushSettings.enabled.value;
    this.settings.areaThresholdSettings.threshold.visible = this.settings.areaThresholdSettings.show.value;
    this.settings.areaThresholdSettings.aboveColor.visible = this.settings.areaThresholdSettings.show.value;
    this.settings.areaThresholdSettings.belowColor.visible = this.settings.areaThresholdSettings.show.value;
    this.settings.areaSettings.fillOpacity.visible = this.settings.lineSettings.showArea.value;
    this.settings.areaSettings.useGradient.visible = this.settings.lineSettings.showArea.value;
    this.settings.lineSettings.dotRadius.visible = this.settings.lineSettings.showDots.value;
    this.settings.lineSettings.dotStrokeColor.visible = this.settings.lineSettings.showDots.value;
    this.settings.lineSettings.dotStrokeWidth.visible = this.settings.lineSettings.showDots.value;

    // Extract data
    const data = this.extractData(dataView);

    // Populate per-series formatting groups and cache resolved formats
    this.populateSeriesFormattingGroups(dataView, data);
    this.cachedSeriesFormats = data.series.map((s, i) => resolveSeriesFormatting(this.settings.seriesFormattingCard, i, s.color));

    // Apply glass effect
    this.applyCardStyle();

    // Render
    if (data.isEmpty) {
      this.renderEmpty();
    } else {
      this.render(data, options.viewport);
    }
  }

  // ── Per-Series Formatting ─────────────────────────────────────────

  private populateSeriesFormattingGroups(dataView: DataView | undefined, data: ChartData): void {
    const colorLookup = new Map<string, string>();
    for (const s of data.series) colorLookup.set(s.name, s.color);

    populateSeriesFormattingGroups(
      this.settings.seriesFormattingCard,
      dataView,
      ['measure'],
      colorLookup,
    );
  }

  // ── Data Extraction ─────────────────────────────────────────────

  private extractData(dataView: DataView | undefined): ChartData {
    const themeName = resolveColorTheme(this.settings.colorThemeFormattingCard);
    const empty: ChartData = {
      categories: [],
      categorySelectionIds: [],
      series: [],
      isEmpty: true,
    };

    if (!dataView?.categorical) return empty;

    const categorical = dataView.categorical;
    const categoryColumn = categorical.categories?.[0];
    const valuesColumns = categorical.values;

    if (!categoryColumn || !valuesColumns || valuesColumns.length === 0) return empty;

    // Extract category labels
    const categories = categoryColumn.values.map((v) =>
      v !== null && v !== undefined ? String(v) : '',
    );
    const categorySelectionIds = categoryColumn.values.map((_, index) =>
      this.host.createSelectionIdBuilder()
        .withCategory(categoryColumn, index)
        .createSelectionId(),
    );

    if (categories.length === 0) return empty;

    const series: SeriesData[] = [];
    let colorIdx = 0;

    for (const col of valuesColumns) {
      const role = col.source.roles;
      if (!role) continue;

      if (role['measure']) {
        const vals = col.values.map((v) => (typeof v === 'number' ? v : null));
        series.push({
          name: col.source.displayName ?? `Series ${series.length + 1}`,
          values: vals,
          color: getHostChartColor(this.host.colorPalette, colorIdx, themeName),
        });
        colorIdx++;
      }
    }

    return {
      categories,
      categorySelectionIds,
      series,
      isEmpty: series.length === 0,
    };
  }

  // ── Card Style ────────────────────────────────────────────────────

  private applyCardStyle(): void {
    const s = this.settings.cardSettings;
    if (s.enableGlass.value) {
      const glass = getGlassStyle({
        mode: 'light',
        opacity: s.backgroundOpacity.value / 100,
        backgroundColor: s.backgroundColor.value?.value,
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

  // ── Empty State ───────────────────────────────────────────────────

  private renderEmpty(): void {
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    const emptyEl = document.createElement('div');
    emptyEl.className = 'area-chart-empty';
    emptyEl.textContent = 'Add a Category and at least one Measure to get started.';
    this.container.appendChild(emptyEl);
  }

  // ── Main Render ───────────────────────────────────────────────────

  private render(data: ChartData, viewport: powerbi.IViewport): void {
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    renderChartTitle(this.container, this.settings.titleFormattingCard);
    this.container.removeEventListener('click', this.handleBackgroundClick);

    this.renderGeneration++;
    const s = this.settings;

    // Legend dimensions
    const showLegend = s.legendFormattingCard.showLegend.value && data.series.length > 1;
    const legendPos = this.getLegendPosition();
    const legendReserveV = showLegend && (legendPos === 'top' || legendPos === 'bottom') ? LEGEND_HEIGHT : 0;
    const legendReserveH = showLegend && (legendPos === 'left' || legendPos === 'right') ? LEGEND_SIDE_WIDTH : 0;

    // Margins
    const margin: Margin = { ...MARGIN_DEFAULT };
    if (!s.axisSettings.showXAxis.value) margin.bottom = 8;
    if (!s.axisSettings.showYAxis.value) margin.left = 8;
    if (legendPos === 'top') margin.top += legendReserveV;

    // Reserve space for axis titles when present
    const xAxisTitle = s.axisFormattingCard.xAxisTitle.value;
    const yAxisTitle = s.axisFormattingCard.yAxisTitle.value;
    if (xAxisTitle && s.axisSettings.showXAxis.value) margin.bottom += 20;
    if (yAxisTitle && s.axisSettings.showYAxis.value) margin.left += 18;

    // Compute chart dimensions
    const padding = 8;
    const baseSvgWidth = viewport.width - padding * 2 - legendReserveH;
    const baseSvgHeight = viewport.height - padding * 2 - legendReserveV;
    const baseChartWidth = Math.max(0, baseSvgWidth - margin.left - margin.right);
    const baseChartHeight = Math.max(0, baseSvgHeight - margin.top - margin.bottom);

    if (baseChartWidth <= 0 || baseChartHeight <= 0) {
      this.renderEmpty();
      return;
    }

    // Wrapper for horizontal legend layout (left/right)
    const wrapper = document.createElement('div');
    wrapper.className = 'area-chart-wrapper';
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
      this.renderAreaLegend(data, wrapper, legendPos);
    }

    // SVG container with scroll support
    const svgContainer = document.createElement('div');
    svgContainer.style.flex = '1';
    svgContainer.style.minWidth = '0';
    svgContainer.style.minHeight = '0';
    wrapper.appendChild(svgContainer);

    const scroll = createScrollableChart({
      container: svgContainer,
      viewportWidth: baseSvgWidth,
      viewportHeight: baseSvgHeight,
      categoryCount: data.categories.length,
      scrollSettings: s.scrollFormattingCard,
      availableChartWidth: baseChartWidth,
      availableChartHeight: baseChartHeight,
      direction: 'horizontal',
    });
    const svgWidth = scroll.svgWidth;
    const svgHeight = scroll.svgHeight;
    const chartWidth = scroll.chartWidth;
    const chartHeight = scroll.chartHeight;

    const svg = d3.select(scroll.svgParent)
      .append('svg')
      .attr('class', 'area-chart-svg')
      .attr('width', svgWidth)
      .attr('height', svgHeight);

    // Defs for gradients
    const defs = svg.append('defs');

    const chartGroup = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const x = d3.scalePoint<string>()
      .domain(data.categories)
      .range([0, chartWidth])
      .padding(0.5);

    // ── Stacking mode ────────────────────────────────────────────
    const stackMode = resolveDropdown(s.areaStackSettings.mode) ?? 'normal';
    const isStacked = stackMode === 'stacked' || stackMode === 'stacked100';

    // Precompute stacked baselines: stackBaselines[seriesIdx][catIdx] = y0 value
    // stackTops[seriesIdx][catIdx] = y1 value
    const stackBaselines: number[][] = [];
    const stackTops: number[][] = [];
    if (isStacked) {
      const catCount = data.categories.length;
      const runningTotals = new Array<number>(catCount).fill(0);
      const catTotals = stackMode === 'stacked100'
        ? data.categories.map((_, ci) =>
            data.series.reduce((sum, ser) => sum + Math.abs(ser.values[ci] ?? 0), 0) || 1)
        : null;

      for (let si = 0; si < data.series.length; si++) {
        const baselines: number[] = [];
        const tops: number[] = [];
        for (let ci = 0; ci < catCount; ci++) {
          let val = data.series[si].values[ci] ?? 0;
          if (catTotals) val = (val / catTotals[ci]) * 100;
          baselines.push(runningTotals[ci]);
          runningTotals[ci] += val;
          tops.push(runningTotals[ci]);
        }
        stackBaselines.push(baselines);
        stackTops.push(tops);
      }
    }

    const allValues = isStacked
      ? (stackMode === 'stacked100'
          ? [0, 100]
          : [0, d3.max(stackTops[stackTops.length - 1] ?? [0]) ?? 0])
      : data.series.flatMap((ser) =>
          ser.values.filter((v): v is number => v !== null));
    const yMax = d3.max(allValues) ?? 0;
    const yMin = d3.min(allValues) ?? 0;
    const domainMin = isStacked ? 0 : Math.min(0, yMin);
    const y = d3.scaleLinear()
      .domain([domainMin, (isStacked ? yMax : yMax * 1.1) || 1])
      .nice()
      .range([chartHeight, 0]);

    // Grid lines
    if (s.axisSettings.gridLines.value) {
      chartGroup.append('g')
        .attr('class', 'area-grid')
        .call(
          d3.axisLeft(y)
            .ticks(6)
            .tickSize(-chartWidth)
            .tickFormat(() => ''),
        )
        .select('.domain').remove();
    }

    // Axes
    if (s.axisSettings.showXAxis.value) {
      const xAxisGroup = chartGroup.append('g')
        .attr('class', 'area-axis area-axis-x')
        .attr('transform', `translate(0,${chartHeight})`)
        .call(d3.axisBottom(x).tickSize(0));

      xAxisGroup.select('.domain').remove();

      // Rotate labels if there are many categories
      if (data.categories.length > 12) {
        xAxisGroup.selectAll('text')
          .attr('transform', 'rotate(-45)')
          .style('text-anchor', 'end')
          .attr('dx', '-0.5em')
          .attr('dy', '0.25em');
      }
    }

    if (s.axisSettings.showYAxis.value) {
      chartGroup.append('g')
        .attr('class', 'area-axis')
        .call(
          d3.axisLeft(y)
            .ticks(6)
            .tickFormat((d) => formatWithSettings(d as number, this.settings.numberFormattingCard)),
        )
        .select('.domain').remove();
    }

    // ── Axis titles ──────────────────────────────────────────────
    const axisTitleFontSize = s.axisFormattingCard.axisLabelSize.value;
    const axisTitleColor = s.axisFormattingCard.axisLabelColor.value?.value || '#888888';

    if (xAxisTitle && s.axisSettings.showXAxis.value) {
      chartGroup.append('text')
        .attr('class', 'area-axis-title area-axis-title-x')
        .attr('x', chartWidth / 2)
        .attr('y', chartHeight + margin.bottom - 4)
        .attr('text-anchor', 'middle')
        .attr('fill', axisTitleColor)
        .attr('font-size', `${axisTitleFontSize}px`)
        .text(xAxisTitle);
    }

    if (yAxisTitle && s.axisSettings.showYAxis.value) {
      chartGroup.append('text')
        .attr('class', 'area-axis-title area-axis-title-y')
        .attr('x', -(chartHeight / 2))
        .attr('y', -margin.left + 14)
        .attr('transform', 'rotate(-90)')
        .attr('text-anchor', 'middle')
        .attr('fill', axisTitleColor)
        .attr('font-size', `${axisTitleFontSize}px`)
        .text(yAxisTitle);
    }

    // Reference line (shared core — rendered after axes/grid but before data series)
    this.renderReferenceLine(chartGroup, y, chartWidth, allValues);

    // Curve function
    const curveFn = this.getCurveFunction();

    // Animation settings
    const animEnabled = s.animationSettings.enabled.value;
    const animDuration = s.animationSettings.duration.value;
    const showArea = s.lineSettings.showArea.value;
    const showDots = s.lineSettings.showDots.value;
    const dotRadius = this.settings.lineSettings.dotRadius.value;
    const lineWidth = s.lineSettings.lineWidth.value;
    const fillOpacity = s.areaSettings.fillOpacity.value / 100;
    const useGradient = s.areaSettings.useGradient.value;
    const showDataLabels = s.dataLabelFormattingCard.showDataLabels.value;

    // Render each series
    data.series.forEach((series, seriesIdx) => {
      const sf = this.cachedSeriesFormats[seriesIdx] ?? resolveSeriesFormatting(this.settings.seriesFormattingCard, seriesIdx, series.color);
      const seriesDelay = seriesIdx * 150;

      // Build valid data points respecting null handling strategy
      const nullHandling = resolveDropdown(s.areaGapSettings.nullHandling) ?? 'skip';
      const validPoints: Array<{
        catIdx: number;
        x: number;
        y: number;
        y0?: number;
        val: number;
        cat: string;
        selectionId: ISelectionId;
      }> = [];
      data.categories.forEach((cat, i) => {
        let val = series.values[i];

        if (val === null) {
          if (nullHandling === 'interpolate') {
            // Interpolate: find previous and next non-null values and lerp
            let prevVal: number | null = null;
            let nextVal: number | null = null;
            let prevIdx = -1;
            let nextIdx = -1;
            for (let j = i - 1; j >= 0; j--) {
              if (series.values[j] !== null) { prevVal = series.values[j]; prevIdx = j; break; }
            }
            for (let j = i + 1; j < series.values.length; j++) {
              if (series.values[j] !== null) { nextVal = series.values[j]; nextIdx = j; break; }
            }
            if (prevVal !== null && nextVal !== null) {
              const t = (i - prevIdx) / (nextIdx - prevIdx);
              val = prevVal + (nextVal - prevVal) * t;
            } else if (prevVal !== null) {
              val = prevVal;
            } else if (nextVal !== null) {
              val = nextVal;
            } else {
              return; // all null, skip
            }
          } else if (nullHandling === 'connect') {
            // Connect adjacent: skip the null point, line will connect neighbors
            return;
          } else {
            // 'skip' — leave gap (break the line)
            return;
          }
        }

        const px = x(cat);
        if (px !== undefined) {
          const stackedTop = isStacked ? stackTops[seriesIdx][i] : val;
          const stackedBase = isStacked ? stackBaselines[seriesIdx][i] : undefined;
          validPoints.push({
            catIdx: i,
            x: px,
            y: y(stackedTop),
            y0: stackedBase !== undefined ? y(stackedBase) : undefined,
            val,
            cat,
            selectionId: data.categorySelectionIds[i],
          });
        }
      });

      if (validPoints.length === 0) return;

      const seriesOpacityFactor = sf.opacity / 100;

      // ── Area fill ──────────────────────────────────────────────
      if (showArea && validPoints.length >= 2) {
        const gradientId = `area-grad-${this.renderGeneration}-${seriesIdx}`;
        const effectiveFillOpacity = fillOpacity * seriesOpacityFactor;

        if (useGradient) {
          const seriesMinY = d3.min(validPoints, (pt) => pt.y) ?? 0;

          const gradient = defs.append('linearGradient')
            .attr('id', gradientId)
            .attr('gradientUnits', 'userSpaceOnUse')
            .attr('x1', 0)
            .attr('y1', seriesMinY)
            .attr('x2', 0)
            .attr('y2', chartHeight);

          gradient.append('stop')
            .attr('offset', '0%')
            .attr('stop-color', sf.color)
            .attr('stop-opacity', effectiveFillOpacity);

          gradient.append('stop')
            .attr('offset', '60%')
            .attr('stop-color', sf.color)
            .attr('stop-opacity', effectiveFillOpacity * 0.35);

          gradient.append('stop')
            .attr('offset', '100%')
            .attr('stop-color', sf.color)
            .attr('stop-opacity', 0);
        }

        const areaGen = d3.area<{ x: number; y: number; y0?: number }>()
          .x((d) => d.x)
          .y0((d) => d.y0 !== undefined ? d.y0 : chartHeight)
          .y1((d) => d.y)
          .curve(curveFn);

        const areaPath = chartGroup.append('path')
          .datum(validPoints)
          .attr('class', 'area-fill')
          .attr('data-series', String(seriesIdx))
          .attr('d', areaGen as unknown as d3.ValueFn<SVGPathElement, typeof validPoints, string | null>)
          .attr('fill', useGradient ? `url(#${gradientId})` : withOpacity(sf.color, effectiveFillOpacity))
          .style('transition', 'opacity 0.15s ease');

        // Animate area fade-in
        if (animEnabled) {
          const areaNode = areaPath.node();
          if (areaNode) {
            areaNode.style.opacity = '0';
            const timeoutId = setTimeout(() => {
              const cancelAnim = animate(animDuration, cubicOut, (progress) => {
                areaNode.style.opacity = `${progress}`;
              }, () => {
                areaNode.style.opacity = '1';
              });
              this.cancelAnimations.push(cancelAnim);
            }, seriesDelay + 100);
            this.cancelAnimations.push(() => clearTimeout(timeoutId));
          }
        }
      }

      // ── Line path ──────────────────────────────────────────────
      if (validPoints.length >= 2) {
        const lineGen = d3.line<{ x: number; y: number }>()
          .x((d) => d.x)
          .y((d) => d.y)
          .curve(curveFn);

        // Per-series line style takes priority, fall back to global lineStrokeFormattingCard
        const effectiveLineStyle = sf.lineStyle !== 'solid' ? sf.lineStyle
          : ((this.settings.lineStrokeFormattingCard.lineStyle.value as
            { value?: string } | undefined)?.value ?? 'solid');
        const strokeDash = lineStyleToDashArray(effectiveLineStyle);

        const linePath = chartGroup.append('path')
          .datum(validPoints)
          .attr('class', 'area-line')
          .attr('data-series', String(seriesIdx))
          .attr('d', lineGen)
          .attr('stroke', sf.color)
          .attr('stroke-width', sf.lineWidth)
          .attr('stroke-dasharray', strokeDash)
          .attr('opacity', seriesOpacityFactor)
          .style('transition', 'opacity 0.15s ease');

        // Animate line draw
        if (animEnabled) {
          const lineNode = linePath.node();
          if (lineNode) {
            const cancel = drawPath(lineNode, animDuration, seriesDelay);
            this.cancelAnimations.push(cancel);
          }
        }
      } else if (validPoints.length === 1) {
        // Single point: just draw a dot (no line possible)
      }

      // ── Dots ───────────────────────────────────────────────────
      if (showDots) {
        validPoints.forEach((pt, ptIdx) => {
          const conditionalDotColor = this.getConditionalColor(pt.val);
          const dot = chartGroup.append('circle')
            .attr('class', 'area-dot')
            .attr('data-series', String(seriesIdx))
            .attr('cx', pt.x)
            .attr('cy', pt.y)
            .attr('r', dotRadius)
            .attr('fill', conditionalDotColor ?? sf.color)
            .attr('opacity', seriesOpacityFactor)
            .attr('stroke', this.settings.lineSettings.dotStrokeColor.value?.value || '#FFFFFF')
            .attr('stroke-width', this.settings.lineSettings.dotStrokeWidth.value)
            .style('transition', 'opacity 0.15s ease');

          // Tooltip
          this.attachDotTooltip(dot, pt.cat, series.name, pt.val);

          // Hover enlargement
          const dotHoverRadius = dotRadius + DOT_HOVER_EXTRA;
          dot.on('mouseenter', function () {
            d3.select(this).attr('r', dotHoverRadius);
          });
          dot.on('mouseleave', function () {
            d3.select(this).attr('r', dotRadius);
          });
          dot
            .style('cursor', 'pointer')
            .on('click', (event: MouseEvent) => {
              event.stopPropagation();
              void this.selectionManager.select(pt.selectionId, event.ctrlKey || event.metaKey);
            })
            .on('contextmenu', (event: MouseEvent) => {
              event.preventDefault();
              event.stopPropagation();
              void this.selectionManager.showContextMenu(pt.selectionId, {
                x: event.clientX,
                y: event.clientY,
              });
            });

          // Animate dot pop-in
          if (animEnabled) {
            const dotNode = dot.node();
            if (dotNode) {
              const dotDelay = seriesDelay + ptIdx * 40;
              const cancel = popIn(dotNode, dotDelay, 400);
              this.cancelAnimations.push(cancel);
            }
          }
        });
      }

      // ── Data Labels ─────────────────────────────────────────────
      if (showDataLabels && sf.showLabels) {
        validPoints.forEach((pt) => {
          const conditionalLabelColor = this.getConditionalColor(pt.val);
          const label = chartGroup.append('text')
            .attr('class', 'area-data-label')
            .attr('data-series', String(seriesIdx))
            .attr('x', pt.x)
            .attr('y', pt.y - dotRadius - 4)
            .attr('text-anchor', 'middle')
            .style('transition', 'opacity 0.15s ease')
            .text(formatWithSettings(pt.val, this.settings.numberFormattingCard));
          if (conditionalLabelColor) {
            label.attr('fill', conditionalLabelColor);
          }
        });
      }
    });

    // ── Forecast Projection ────────────────────────────────────
    if (s.areaForecastSettings.show.value && data.series.length > 0) {
      const forecastPeriods = s.areaForecastSettings.periods.value;
      const forecastOpacity = s.areaForecastSettings.opacity.value / 100;

      if (forecastPeriods > 0) {
        data.series.forEach((series, seriesIdx) => {
          const sf = this.cachedSeriesFormats[seriesIdx] ?? resolveSeriesFormatting(this.settings.seriesFormattingCard, seriesIdx, series.color);
          const numericValues = series.values.filter((v): v is number => v !== null);
          if (numericValues.length < 2) return;

          // Simple linear regression for forecasting
          const n = numericValues.length;
          let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
          for (let i = 0; i < n; i++) {
            sumX += i;
            sumY += numericValues[i];
            sumXY += i * numericValues[i];
            sumX2 += i * i;
          }
          const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
          const intercept = (sumY - slope * sumX) / n;

          // Generate forecast points extending beyond the last category
          const lastCatX = x(data.categories[data.categories.length - 1]) ?? chartWidth;
          const catSpacing = data.categories.length > 1
            ? ((x(data.categories[1]) ?? 0) - (x(data.categories[0]) ?? 0))
            : chartWidth / Math.max(1, data.categories.length);

          const lastVal = numericValues[n - 1];
          const forecastPoints: Array<{ x: number; y: number }> = [
            { x: lastCatX, y: y(lastVal) },
          ];

          for (let f = 1; f <= forecastPeriods; f++) {
            const projectedVal = intercept + slope * (n - 1 + f);
            forecastPoints.push({
              x: lastCatX + catSpacing * f,
              y: y(projectedVal),
            });
          }

          // Render forecast line (dashed)
          const forecastLineGen = d3.line<{ x: number; y: number }>()
            .x((d) => d.x)
            .y((d) => d.y)
            .curve(curveFn);

          chartGroup.append('path')
            .datum(forecastPoints)
            .attr('class', 'area-forecast-line')
            .attr('d', forecastLineGen)
            .attr('stroke', sf.color)
            .attr('stroke-width', lineWidth)
            .attr('stroke-dasharray', '6 4')
            .attr('fill', 'none')
            .attr('opacity', 0.6);

          // Render forecast confidence band
          const forecastAreaGen = d3.area<{ x: number; y: number }>()
            .x((d) => d.x)
            .y0(chartHeight)
            .y1((d) => d.y)
            .curve(curveFn);

          chartGroup.append('path')
            .datum(forecastPoints)
            .attr('class', 'area-forecast-band')
            .attr('d', forecastAreaGen)
            .attr('fill', withOpacity(sf.color, forecastOpacity))
            .attr('opacity', 0.5);
        });
      }
    }

    // ── Threshold Zone ─────────────────────────────────────────
    if (s.areaThresholdSettings.show.value && data.series.length > 0) {
      const thresholdVal = s.areaThresholdSettings.threshold.value;
      const aboveColor = s.areaThresholdSettings.aboveColor.value?.value ?? '#22C55E';
      const belowColor = s.areaThresholdSettings.belowColor.value?.value ?? '#EF4444';
      const thresholdY = y(thresholdVal);

      // Draw a threshold reference line
      chartGroup.append('line')
        .attr('class', 'area-threshold-line')
        .attr('x1', 0)
        .attr('x2', chartWidth)
        .attr('y1', thresholdY)
        .attr('y2', thresholdY)
        .attr('stroke', '#94A3B8')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '4 3')
        .attr('opacity', 0.7);

      // Render colored overlay areas for above/below threshold per series
      const thresholdDefs = svg.select('defs');
      data.series.forEach((series, seriesIdx) => {
        const sf = this.cachedSeriesFormats[seriesIdx] ?? resolveSeriesFormatting(this.settings.seriesFormattingCard, seriesIdx, series.color);
        const pts = series.values
          .map((val, i) => val !== null ? { x: x(data.categories[i]) ?? 0, y: y(val), val } : null)
          .filter((p): p is { x: number; y: number; val: number } => p !== null);

        if (pts.length < 2) return;

        // Clip path for above threshold
        const aboveClipId = `thresh-above-${this.renderGeneration}-${seriesIdx}`;
        const aboveClip = thresholdDefs.append('clipPath').attr('id', aboveClipId);
        aboveClip.append('rect')
          .attr('x', 0)
          .attr('y', 0)
          .attr('width', chartWidth)
          .attr('height', thresholdY);

        // Clip path for below threshold
        const belowClipId = `thresh-below-${this.renderGeneration}-${seriesIdx}`;
        const belowClip = thresholdDefs.append('clipPath').attr('id', belowClipId);
        belowClip.append('rect')
          .attr('x', 0)
          .attr('y', thresholdY)
          .attr('width', chartWidth)
          .attr('height', chartHeight - thresholdY);

        const threshAreaGen = d3.area<{ x: number; y: number }>()
          .x((d) => d.x)
          .y0(thresholdY)
          .y1((d) => d.y)
          .curve(this.getCurveFunction());

        // Above threshold area
        chartGroup.append('path')
          .datum(pts)
          .attr('d', threshAreaGen)
          .attr('fill', withOpacity(aboveColor, 0.25))
          .attr('clip-path', `url(#${aboveClipId})`);

        // Below threshold area
        chartGroup.append('path')
          .datum(pts)
          .attr('d', threshAreaGen)
          .attr('fill', withOpacity(belowColor, 0.25))
          .attr('clip-path', `url(#${belowClipId})`);
      });
    }

    // ── Trend Line (shared core) ─────────────────────────────
    this.renderTrendLineOverlay(chartGroup, data, x, y);

    // ── Annotations (shared core) ──────────────────────────
    this.renderAnnotationOverlay(chartGroup, data, x, y);

    // ── Brush / Zoom Context ─────────────────────────────────
    if (s.brushSettings.enabled.value) {
      this.renderBrushContext({
        svg,
        defs,
        mainChartGroup: chartGroup,
        data,
        xScale: x,
        yScale: y,
        chartWidth,
        chartHeight,
        margin,
        curveFn,
      });
    }

    // ── Crosshair (shared core) ──────────────────────────────

    const crosshairEnabled = s.crosshairFormattingCard.showCrosshair.value;
    if (crosshairEnabled) {
      const svgEl2 = svg.node();
      const chartGroupNode = chartGroup.node();
      if (svgEl2 && chartGroupNode) {
        const chStyleVal = resolveDropdown(s.crosshairFormattingCard.crosshairLineStyle) ?? 'dashed';
        const crosshairCleanup = attachCrosshair(buildCrosshairConfig({
          svg: svgEl2,
          chartGroup: chartGroupNode,
          marginLeft: margin.left,
          marginTop: margin.top,
          chartWidth,
          chartHeight,
          categories: data.categories,
          series: data.series.map((ser) => ({
            name: ser.name,
            values: ser.values.map((v) => v ?? NaN),
            color: ser.color,
          })),
          yScale: y,
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

    // Apply data label formatting from settings
    applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.area-data-label');

    // Apply axis and grid formatting from settings
    const svgEl = this.container.querySelector('svg');
    if (svgEl) {
      svgEl.querySelectorAll('[class*="area-axis"]').forEach((el) => {
        applyAxisFormatting(el as SVGGElement, this.settings.axisFormattingCard);
      });
      svgEl.querySelectorAll('[class*="area-grid"]').forEach((el) => {
        applyGridFormatting(el as SVGGElement, this.settings.axisFormattingCard);
      });
    }

    // Legend (bottom or right)
    if (showLegend && (legendPos === 'bottom' || legendPos === 'right')) {
      this.renderAreaLegend(data, wrapper, legendPos);
    }

    // ── Accessibility (shared core) ──────────────────────────
    const totalDataPoints = data.series.reduce(
      (sum, ser) => sum + ser.values.filter((v) => v !== null).length,
      0,
    );
    this.applyAccessibility(totalDataPoints);

    this.container.addEventListener('click', this.handleBackgroundClick);
  }

  // ── Brush / Zoom Context (D3 brushX) ──────────────────────────────────

  /**
   * Renders a miniature context chart below the main chart with a d3.brushX()
   * interaction that zooms the main chart's x-domain to the brushed range.
   */
  private renderBrushContext(opts: {
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    defs: d3.Selection<SVGDefsElement, unknown, null, undefined>;
    mainChartGroup: d3.Selection<SVGGElement, unknown, null, undefined>;
    data: ChartData;
    xScale: d3.ScalePoint<string>;
    yScale: d3.ScaleLinear<number, number>;
    chartWidth: number;
    chartHeight: number;
    margin: Margin;
    curveFn: d3.CurveFactory;
  }): void {
    const { svg, mainChartGroup, data, xScale, yScale, chartWidth, chartHeight, margin, curveFn } = opts;
    const bs = this.settings.brushSettings;
    const contextHeight = Math.max(20, Math.min(bs.contextHeight.value, 200));
    const brushColor = bs.brushColor.value?.value ?? '#3B82F6';
    const brushOpacity = bs.brushOpacity.value / 100;
    const contextPadding = 8;

    // Expand the SVG to accommodate the context area below the main chart
    const currentSvgHeight = Number(svg.attr('height'));
    const newSvgHeight = currentSvgHeight + contextHeight + contextPadding;
    svg.attr('height', newSvgHeight);

    // Also expand the parent scroll container if present
    const svgNode = svg.node();
    if (svgNode?.parentElement) {
      svgNode.parentElement.style.minHeight = `${newSvgHeight}px`;
    }

    const contextTop = margin.top + chartHeight + margin.bottom + contextPadding;

    const contextG = svg.append('g')
      .attr('class', 'brush-context')
      .attr('transform', `translate(${margin.left}, ${contextTop})`);

    // Context scales — full domain, compressed height
    const contextXScale = xScale.copy();
    const contextYScale = yScale.copy().range([contextHeight, 0]);

    // Draw mini area paths for each series
    data.series.forEach((series, seriesIdx) => {
      const sf = this.cachedSeriesFormats[seriesIdx] ?? resolveSeriesFormatting(this.settings.seriesFormattingCard, seriesIdx, series.color);
      const validPoints: Array<{ x: number; y: number }> = [];
      data.categories.forEach((cat, i) => {
        const val = series.values[i];
        if (val === null) return;
        const px = contextXScale(cat);
        if (px !== undefined) {
          validPoints.push({ x: px, y: contextYScale(val) });
        }
      });

      if (validPoints.length < 2) return;

      const contextAreaGen = d3.area<{ x: number; y: number }>()
        .x((d) => d.x)
        .y0(contextHeight)
        .y1((d) => d.y)
        .curve(curveFn);

      contextG.append('path')
        .datum(validPoints)
        .attr('d', contextAreaGen)
        .attr('fill', withOpacity(sf.color, 0.3))
        .attr('stroke', sf.color)
        .attr('stroke-width', 1);
    });

    // Context x-axis (minimal)
    contextG.append('g')
      .attr('class', 'brush-context-axis')
      .attr('transform', `translate(0, ${contextHeight})`)
      .call(d3.axisBottom(contextXScale).tickSize(0).tickPadding(4))
      .select('.domain').remove();

    // Brush interaction
    const brush = d3.brushX()
      .extent([[0, 0], [chartWidth, contextHeight]])
      .on('brush end', (event: d3.D3BrushEvent<unknown>) => {
        const selection = event.selection as [number, number] | null;

        // Build a mapping from pixel position to category index
        const categoryPositions = data.categories.map((cat) => contextXScale(cat) ?? 0);

        let filteredCategories: string[];
        if (!selection) {
          // No brush — show all categories
          filteredCategories = data.categories;
        } else {
          const [x0, x1] = selection;
          // Find categories within the brushed pixel range
          filteredCategories = data.categories.filter((_cat, i) => {
            const pos = categoryPositions[i];
            return pos >= x0 && pos <= x1;
          });
          // Fall back to full domain if brush is too narrow
          if (filteredCategories.length < 2) {
            filteredCategories = data.categories;
          }
        }

        // Update the main chart's x-scale domain
        xScale.domain(filteredCategories);
        xScale.range([0, chartWidth]);

        // Recompute y domain for visible data
        const visibleValues: number[] = [];
        const catSet = new Set(filteredCategories);
        data.series.forEach((series) => {
          data.categories.forEach((cat, i) => {
            if (catSet.has(cat) && series.values[i] !== null) {
              visibleValues.push(series.values[i] as number);
            }
          });
        });
        const newYMax = d3.max(visibleValues) ?? 0;
        const newYMin = d3.min(visibleValues) ?? 0;
        const newDomainMin = Math.min(0, newYMin);
        yScale.domain([newDomainMin, newYMax * 1.1 || 1]).nice();

        // Re-render main chart paths
        this.updateMainChartPaths(mainChartGroup, data, xScale, yScale, curveFn, chartWidth, chartHeight);
      });

    const brushGroup = contextG.append('g')
      .attr('class', 'brush-overlay')
      .call(brush);

    // Style the brush selection rectangle
    brushGroup.select('.selection')
      .attr('fill', brushColor)
      .attr('fill-opacity', brushOpacity)
      .attr('stroke', brushColor)
      .attr('stroke-width', 1);
  }

  /**
   * Re-renders main chart area/line paths when the brush selection changes.
   * Removes old paths and redraws with the current xScale/yScale domains.
   */
  private updateMainChartPaths(
    chartGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
    data: ChartData,
    xScale: d3.ScalePoint<string>,
    yScale: d3.ScaleLinear<number, number>,
    curveFn: d3.CurveFactory,
    chartWidth: number,
    chartHeight: number,
  ): void {
    // Remove existing paths, dots, and data labels in the main chart
    chartGroup.selectAll('.area-fill, .area-line, .area-dot, .area-data-label').remove();

    // Remove and redraw axes
    chartGroup.selectAll('.area-axis').remove();
    chartGroup.selectAll('.area-grid').remove();

    const s = this.settings;

    // Grid lines
    if (s.axisSettings.gridLines.value) {
      chartGroup.append('g')
        .attr('class', 'area-grid')
        .call(
          d3.axisLeft(yScale)
            .ticks(6)
            .tickSize(-chartWidth)
            .tickFormat(() => ''),
        )
        .select('.domain').remove();
    }

    // Axes
    if (s.axisSettings.showXAxis.value) {
      const xAxisGroup = chartGroup.append('g')
        .attr('class', 'area-axis area-axis-x')
        .attr('transform', `translate(0,${chartHeight})`)
        .call(d3.axisBottom(xScale).tickSize(0));
      xAxisGroup.select('.domain').remove();
    }

    if (s.axisSettings.showYAxis.value) {
      chartGroup.append('g')
        .attr('class', 'area-axis')
        .call(
          d3.axisLeft(yScale)
            .ticks(6)
            .tickFormat((d) => formatWithSettings(d as number, this.settings.numberFormattingCard)),
        )
        .select('.domain').remove();
    }

    const showArea = s.lineSettings.showArea.value;
    const fillOpacity = s.areaSettings.fillOpacity.value / 100;
    const domainCats = new Set(xScale.domain());

    data.series.forEach((series, seriesIdx) => {
      const sf = this.cachedSeriesFormats[seriesIdx] ?? resolveSeriesFormatting(this.settings.seriesFormattingCard, seriesIdx, series.color);
      const seriesOpacityFactor = sf.opacity / 100;

      const validPoints: Array<{ x: number; y: number }> = [];
      data.categories.forEach((cat, i) => {
        if (!domainCats.has(cat)) return;
        const val = series.values[i];
        if (val === null) return;
        const px = xScale(cat);
        if (px !== undefined) {
          validPoints.push({ x: px, y: yScale(val) });
        }
      });

      if (validPoints.length < 2) return;

      // Area fill
      if (showArea) {
        const areaGen = d3.area<{ x: number; y: number }>()
          .x((d) => d.x)
          .y0(chartHeight)
          .y1((d) => d.y)
          .curve(curveFn);

        chartGroup.append('path')
          .datum(validPoints)
          .attr('class', 'area-fill')
          .attr('data-series', String(seriesIdx))
          .attr('d', areaGen)
          .attr('fill', withOpacity(sf.color, fillOpacity * seriesOpacityFactor));
      }

      // Line path
      const lineGen = d3.line<{ x: number; y: number }>()
        .x((d) => d.x)
        .y((d) => d.y)
        .curve(curveFn);

      chartGroup.append('path')
        .datum(validPoints)
        .attr('class', 'area-line')
        .attr('data-series', String(seriesIdx))
        .attr('d', lineGen)
        .attr('stroke', sf.color)
        .attr('stroke-width', sf.lineWidth)
        .attr('opacity', seriesOpacityFactor);
    });

    // Re-apply formatting
    const svgEl = chartGroup.node()?.closest('svg');
    if (svgEl) {
      svgEl.querySelectorAll('[class*="area-axis"]').forEach((el) => {
        applyAxisFormatting(el as SVGGElement, this.settings.axisFormattingCard);
      });
      svgEl.querySelectorAll('[class*="area-grid"]').forEach((el) => {
        applyGridFormatting(el as SVGGElement, this.settings.axisFormattingCard);
      });
    }
  }

  // ── Reference Line (shared core) ────────────────────────────────────

  /**
   * Renders a user-configured reference line (and optional band) on the chart.
   * Uses shared renderHorizontalReferenceLine from @pbi/core.
   */
  private renderReferenceLine(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    yScale: d3.ScaleLinear<number, number>,
    width: number,
    allValues?: number[],
  ): void {
    const ref = this.settings.referenceLineFormattingCard;
    if (!ref.showReferenceLine.value) return;

    const refType = resolveDropdown(ref.referenceLineType) ?? 'custom';
    let refValue = ref.referenceLineValue.value;

    // Compute statistical value if needed
    if (refType !== 'custom' && allValues && allValues.length > 0) {
      refValue = computeStatValue(allValues, refType as StatType);
    }

    const refColor = ref.referenceLineColor.value?.value ?? '#EF4444';
    const refStyle = resolveDropdown(ref.referenceLineStyle) ?? 'dashed';
    const labelText = ref.referenceLabelText.value.length > 0
      ? ref.referenceLabelText.value
      : formatWithSettings(refValue, this.settings.numberFormattingCard);

    renderHorizontalReferenceLine(g, {
      value: refValue,
      yScale,
      chartWidth: width,
      lineColor: refColor,
      lineWidth: ref.referenceLineWidth.value,
      lineStyle: refStyle as LineStyleType,
      showLabel: ref.showReferenceLabel.value,
      labelText,
      showBand: ref.showReferenceBand.value,
      bandUpperValue: refValue * 1.1,
      bandOpacity: ref.referenceBandOpacity.value / 100,
    });
  }

  // ── Legend (shared core) ─────────────────────────────────────────────

  private renderAreaLegend(
    data: ChartData,
    parent: HTMLElement,
    position: LegendPosition,
  ): void {
    const legendFmtCard = this.settings.legendFormattingCard;
    const rawFontColor = legendFmtCard.legendFontColor.value?.value;
    const fontColor = rawFontColor != null && rawFontColor.length > 0 ? rawFontColor : '#64748B';

    const items: LegendItem[] = data.series.map((ser, i) => {
      const sf = this.cachedSeriesFormats[i];
      return { label: ser.name, color: sf?.color ?? ser.color };
    });
    const rawLegendFontFamily = resolveDropdown(legendFmtCard.legendFontFamily) || undefined;

    const legendEl = renderLegend(parent, {
      items,
      position,
      fontSize: legendFmtCard.legendFontSize.value,
      fontColor,
      fontFamily: rawLegendFontFamily,
    });

    // Animate legend entrance
    const animEnabled = this.settings.animationSettings.enabled.value;
    const animDuration = this.settings.animationSettings.duration.value;
    if (animEnabled) {
      const cancel = fadeSlideIn(
        legendEl,
        position === 'top' || position === 'left' ? 'down' : 'up',
        animDuration,
        300,
      );
      this.cancelAnimations.push(cancel);
    }
  }

  // ── Conditional Formatting ──────────────────────────────────────────

  /**
   * Returns a conditional color override for a given value, or undefined if
   * conditional formatting is disabled or the value doesn't match a threshold.
   */
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

  // ── Accessibility ─────────────────────────────────────────────────

  /**
   * Applies ARIA labels and keyboard navigation to the chart container.
   * Pushes a cleanup function to cancelAnimations for listener removal.
   */
  private applyAccessibility(dataPointCount: number): void {
    const acc = this.settings.accessibilityFormattingCard;
    if (!acc.enableKeyboardNav.value) return;

    ensureFocusRingStyles();
    applyChartAria(this.container, {
      chartType: 'area chart',
      title: this.settings.titleFormattingCard?.titleText?.value || undefined,
      dataPointCount,
    });

    const cleanup = attachKeyboardNav({
      container: this.container,
      itemSelector: '.area-path, .area-dot, [tabindex="0"]',
      onActivate: (el) => (el as HTMLElement).click?.(),
    });
    this.cancelAnimations.push(cleanup);
  }

  // ── Trend Line ────────────────────────────────────────────────────

  /**
   * Renders a regression/trend overlay on the chart using the first series' values.
   */
  private renderTrendLineOverlay(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    data: ChartData,
    xScale: d3.ScalePoint<string>,
    yScale: d3.ScaleLinear<number, number>,
  ): void {
    const tl = this.settings.trendLineFormattingCard;
    if (!tl.showTrendLine.value) return;

    // Use the first series for the trend line computation
    const firstSeries = data.series[0];
    if (!firstSeries) return;

    const numericValues = firstSeries.values.filter((v): v is number => v !== null);
    if (numericValues.length < 2) return;

    const trendType = (resolveDropdown(tl.trendLineType) ?? 'linear') as TrendType;
    const regression = computeRegression(numericValues, trendType, tl.polynomialOrder.value);

    if (regression.predicted.length < 2) return;

    renderTrendLine(g, {
      predicted: regression.predicted,
      xScale: (i: number) => xScale(data.categories[i]) ?? 0,
      yScale,
      lineColor: tl.trendLineColor.value?.value ?? '#6366F1',
      lineWidth: tl.trendLineWidth.value,
      showEquation: tl.showEquation.value,
      showR2: tl.showR2.value,
      equation: regression.equation,
      r2: regression.r2,
    });
  }

  // ── Annotations ───────────────────────────────────────────────────

  /**
   * Renders labeled callout annotations on the chart targeting specific categories.
   */
  private renderAnnotationOverlay(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    data: ChartData,
    xScale: d3.ScalePoint<string>,
    yScale: d3.ScaleLinear<number, number>,
  ): void {
    const ann = this.settings.annotationFormattingCard;
    if (!ann.showAnnotations.value) return;

    const slots = [
      {
        category: ann.annotation1Category.value,
        text: ann.annotation1Text.value,
        position: resolveDropdown(ann.annotation1Position) ?? 'above',
      },
      {
        category: ann.annotation2Category.value,
        text: ann.annotation2Text.value,
        position: resolveDropdown(ann.annotation2Position) ?? 'above',
      },
      {
        category: ann.annotation3Category.value,
        text: ann.annotation3Text.value,
        position: resolveDropdown(ann.annotation3Position) ?? 'above',
      },
    ];

    const resolvePosition = (category: string): { x: number; y: number } | null => {
      const catIdx = data.categories.indexOf(category);
      if (catIdx < 0) return null;

      const px = xScale(category);
      if (px === undefined) return null;

      // Find the first series value at this category for the y position
      for (const series of data.series) {
        const val = series.values[catIdx];
        if (val !== null) {
          return { x: px, y: yScale(val) };
        }
      }
      return null;
    };

    const config = buildAnnotationConfig(
      true,
      slots,
      ann.annotationFontSize.value,
      ann.annotationFontColor.value?.value ?? '#475569',
      ann.annotationConnectorColor.value?.value ?? '#94A3B8',
      resolvePosition,
    );

    if (config) {
      renderAnnotations(g, config);
    }
  }

  // ── Curve Mapping ─────────────────────────────────────────────────

  private getCurveFunction(): d3.CurveFactory {
    const curveType = this.getCurveType();
    switch (curveType) {
      case 'linear':
        return d3.curveLinear;
      case 'step':
        return d3.curveStep;
      case 'monotoneX':
      default:
        return d3.curveMonotoneX;
    }
  }

  // ── Tooltips ──────────────────────────────────────────────────────

  private attachDotTooltip(
    circle: d3.Selection<SVGCircleElement, unknown, null, undefined>,
    category: string,
    seriesName: string,
    value: number,
  ): void {
    const host = this.host;
    const numberSettings = this.settings.numberFormattingCard;

    circle.on('mouseover', (event: MouseEvent) => {
      const tooltipData: VisualTooltipDataItem[] = [
        { displayName: 'Category', value: category },
        { displayName: seriesName, value: formatWithSettings(value, numberSettings) },
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

  // ── Setting Accessors ─────────────────────────────────────────────

  private getCurveType(): CurveType {
    const val = this.settings.lineSettings.curve.value?.value;
    const valid: CurveType[] = ['monotoneX', 'linear', 'step'];
    if (typeof val === 'string' && valid.includes(val as CurveType)) {
      return val as CurveType;
    }
    return 'monotoneX';
  }

  private getLegendPosition(): LegendPosition {
    const val = (this.settings.legendFormattingCard.legendPosition.value as
      { value?: string } | undefined)?.value;
    const valid: LegendPosition[] = ['top', 'bottom', 'left', 'right'];
    if (typeof val === 'string' && valid.includes(val as LegendPosition)) {
      return val as LegendPosition;
    }
    return 'top';
  }

  // ── Formatting Model ──────────────────────────────────────────────

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  private handleBackgroundClick = (): void => {
    void this.selectionManager.clear();
  };

  // ── Cleanup ───────────────────────────────────────────────────────

  public destroy(): void {
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
  }
}
