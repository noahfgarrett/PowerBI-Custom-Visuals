/**
 * Box Plot — Power BI IVisual implementation.
 * Shows statistical distribution (min, Q1, median, Q3, max) per category
 * with optional outlier dots, glassmorphic styling, and entrance animations.
 */

import powerbi from 'powerbi-visuals-api';
import * as d3 from 'd3';
import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel';
import { BoxPlotSettings } from './settings';
import {
  popIn,
  fadeSlideIn,
  drawPath,
  animate,
  cubicOut,
  DURATION,
  formatNumber,
  formatWithSettings,
  getGlassStyle,
  getHostChartColor,
  withOpacity,
  renderChartTitle,
  applyAxisFormatting,
  applyGridFormatting,
  applyDataLabelFormatting,
  createScrollableChart,
  resolveDropdown,
  renderLegend,
  renderHorizontalReferenceLine,
  type LegendItem,
  type ReferenceLineConfig,
  resolveColorTheme,
  buildConditionalConfig,
  resolveConditionalColor,
  applyChartAria,
  attachKeyboardNav,
  ensureFocusRingStyles,
  computeStatValue,
  computeRegression,
  renderTrendLine,
  type StatType,
  type TrendType,
  resolveSeriesFormatting,
  SeriesFormattingGroup,
} from '../../core/src';

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataView = powerbi.DataView;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;
import ISelectionId = powerbi.visuals.ISelectionId;

import '../style/visual.less';

// -- Types ----------------------------------------------------------------

interface BoxStats {
  category: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  mean: number;
  outliers: number[];
  rawValues: number[];
  selectionId: ISelectionId;
}

interface BoxPlotData {
  boxes: BoxStats[];
  globalMin: number;
  globalMax: number;
  isEmpty: boolean;
}

interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

type LegendPosition = 'bottom' | 'top' | 'left' | 'right';

// -- Seeded random --------------------------------------------------------

/** Simple seeded PRNG (mulberry32) for consistent jitter positioning. */
function seededRandom(seed: number): number {
  let t = (seed + 0x6D2B79F5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// -- Constants ------------------------------------------------------------

const MARGIN_DEFAULT: Margin = { top: 12, right: 16, bottom: 36, left: 48 };
const WHISKER_CAP_WIDTH = 0.4; // fraction of box width
const MEDIAN_STROKE_WIDTH = 2.5;
const LEGEND_HEIGHT = 28;

// -- Statistics -----------------------------------------------------------

type WhiskerCalcMethod = 'iqr' | 'minmax' | 'percentile' | 'stddev';

function computeStats(
  category: string,
  values: number[],
  whiskerCalc: WhiskerCalcMethod = 'iqr',
): Omit<BoxStats, 'selectionId'> | null {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const q1 = d3.quantile(sorted, 0.25) ?? sorted[0];
  const median = d3.quantile(sorted, 0.5) ?? sorted[0];
  const q3 = d3.quantile(sorted, 0.75) ?? sorted[0];
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;

  let whiskerMin: number;
  let whiskerMax: number;
  let outliers: number[];

  switch (whiskerCalc) {
    case 'minmax': {
      // Full range — no outliers
      whiskerMin = sorted[0];
      whiskerMax = sorted[sorted.length - 1];
      outliers = [];
      break;
    }
    case 'percentile': {
      // 5th/95th percentile whiskers
      const p5 = d3.quantile(sorted, 0.05) ?? sorted[0];
      const p95 = d3.quantile(sorted, 0.95) ?? sorted[sorted.length - 1];
      whiskerMin = Math.max(sorted[0], p5);
      whiskerMax = Math.min(sorted[sorted.length - 1], p95);
      outliers = sorted.filter((v) => v < p5 || v > p95);
      break;
    }
    case 'stddev': {
      // Mean +/- 1 standard deviation
      const stddev = Math.sqrt(
        values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length,
      );
      const lower = mean - stddev;
      const upper = mean + stddev;
      whiskerMin = Math.max(sorted[0], lower);
      whiskerMax = Math.min(sorted[sorted.length - 1], upper);
      outliers = sorted.filter((v) => v < lower || v > upper);
      break;
    }
    case 'iqr':
    default: {
      // 1.5x IQR (Tukey)
      const iqr = q3 - q1;
      const lowerFence = q1 - 1.5 * iqr;
      const upperFence = q3 + 1.5 * iqr;
      whiskerMin = Math.max(sorted[0], lowerFence);
      whiskerMax = Math.min(sorted[sorted.length - 1], upperFence);
      outliers = sorted.filter((v) => v < lowerFence || v > upperFence);
      break;
    }
  }

  return {
    category,
    min: whiskerMin,
    q1,
    median,
    q3,
    max: whiskerMax,
    mean,
    outliers,
    rawValues: values,
  };
}

// -- Visual ---------------------------------------------------------------

export class BoxPlotVisual implements IVisual {
  private host: IVisualHost;
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private container: HTMLElement;
  private settings: BoxPlotSettings;
  private formattingSettingsService: FormattingSettingsService;
  private cancelAnimations: Array<() => void> = [];

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new BoxPlotSettings();
    this.formattingSettingsService = new FormattingSettingsService();
    this.container.classList.add('box-plot-container');
  }

  public update(options: VisualUpdateOptions): void {
    // Cancel running animations before re-render
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];

    // Parse settings from dataView
    const dataView = options.dataViews?.[0];
    if (dataView) {
      this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
        BoxPlotSettings,
        dataView,
      );
    }

    // Hide shared axis toggles that are shadowed by local settings
    this.settings.axisFormattingCard.showXAxis.visible = false;
    this.settings.axisFormattingCard.showYAxis.visible = false;
    this.settings.axisFormattingCard.xAxisTitle.visible = false;
    this.settings.axisFormattingCard.yAxisTitle.visible = false;
    this.settings.axisFormattingCard.yAxisMin.visible = false;
    this.settings.axisFormattingCard.yAxisMax.visible = false;

    // Extract data
    const data = this.extractData(dataView);

    // Populate per-series formatting groups
    this.populateSeriesGroups(data);

    // Apply glass effect
    this.applyCardStyle();

    // Render
    if (data.isEmpty) {
      this.renderEmpty();
    } else {
      this.render(data, options.viewport);
    }
  }

  // -- Series Formatting ----------------------------------------------------

  private populateSeriesGroups(data: BoxPlotData): void {
    const themeName = resolveColorTheme(this.settings.colorThemeFormattingCard);
    const card = this.settings.seriesFormattingCard;
    card.groups = [];
    if (data.isEmpty) return;
    const boxColor = this.settings.colorSettings.boxColor.value?.value ?? '#3B82F6';
    const perCategory = this.settings.boxPlotColorSettings.perCategoryColors.value;
    for (let i = 0; i < data.boxes.length; i++) {
      const group = new SeriesFormattingGroup({
        name: `series_${i}`,
        displayName: data.boxes[i].category,
      });
      group.seriesColor.value = {
        value: perCategory ? getHostChartColor(this.host.colorPalette, i, themeName) : boxColor,
      };
      card.groups.push(group);
    }
  }

  // -- Data Extraction ----------------------------------------------------

  private extractData(dataView: DataView | undefined): BoxPlotData {
    const empty: BoxPlotData = {
      boxes: [],
      globalMin: 0,
      globalMax: 0,
      isEmpty: true,
    };

    if (!dataView?.categorical) return empty;

    const categorical = dataView.categorical;
    const categoryColumn = categorical.categories?.[0];
    const valuesColumns = categorical.values;

    if (!categoryColumn || !valuesColumns || valuesColumns.length === 0) return empty;

    // Group raw values by category
    const categoryLabels = categoryColumn.values;
    const groupMap = new Map<string, { values: number[]; selectionId: ISelectionId }>();

    // Collect values per category across all value columns
    for (let rowIdx = 0; rowIdx < categoryLabels.length; rowIdx++) {
      const catLabel = categoryLabels[rowIdx];
      const key = catLabel !== null && catLabel !== undefined ? String(catLabel) : '';

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          values: [],
          selectionId: this.host.createSelectionIdBuilder()
            .withCategory(categoryColumn, rowIdx)
            .createSelectionId(),
        });
      }
      const group = groupMap.get(key)!;

      for (const col of valuesColumns) {
        const role = col.source.roles;
        if (!role || !role['values']) continue;

        const v = col.values[rowIdx];
        if (typeof v === 'number' && !Number.isNaN(v)) {
          group.values.push(v);
        }
      }
    }

    // Compute box stats for each category
    const whiskerCalc = (resolveDropdown(this.settings.boxPlotDisplaySettings.whiskerCalc) ?? 'iqr') as WhiskerCalcMethod;
    const boxes: BoxStats[] = [];
    for (const [cat, group] of groupMap) {
      const stats = computeStats(cat, group.values, whiskerCalc);
      if (stats !== null) {
        boxes.push({
          ...stats,
          selectionId: group.selectionId,
        });
      }
    }

    if (boxes.length === 0) return empty;

    // Global min/max including outliers and raw values for y-scale
    let globalMin = Infinity;
    let globalMax = -Infinity;
    for (const box of boxes) {
      globalMin = Math.min(globalMin, box.min, ...box.outliers, ...box.rawValues);
      globalMax = Math.max(globalMax, box.max, ...box.outliers, ...box.rawValues);
    }

    // Handle edge case: all values identical
    if (globalMin === globalMax) {
      globalMin -= 1;
      globalMax += 1;
    }

    return {
      boxes,
      globalMin,
      globalMax,
      isEmpty: false,
    };
  }

  // -- Card Style ---------------------------------------------------------

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

  // -- Empty State --------------------------------------------------------

  private renderEmpty(): void {
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    const emptyEl = document.createElement('div');
    emptyEl.className = 'box-plot-empty';
    emptyEl.textContent = 'Add a Category and at least one Value to get started.';
    this.container.appendChild(emptyEl);
  }

  // -- Main Render --------------------------------------------------------

  private render(data: BoxPlotData, viewport: powerbi.IViewport): void {
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    renderChartTitle(this.container, this.settings.titleFormattingCard);
    this.container.removeEventListener('click', this.handleBackgroundClick);

    const s = this.settings;
    const isHorizontal = (resolveDropdown(s.boxPlotDisplaySettings.orientation) ?? 'vertical') === 'horizontal';

    // Legend
    const showLegend = s.legendFormattingCard.showLegend.value;
    const legendPos = this.getLegendPosition();
    const legendReserve = showLegend ? LEGEND_HEIGHT : 0;

    const margin: Margin = { ...MARGIN_DEFAULT };
    if (isHorizontal) {
      // Horizontal: categories on Y-axis, values on X-axis
      if (!s.axisSettings.showXAxis.value) margin.bottom = 8;
      if (!s.axisSettings.showYAxis.value) margin.left = 8;
      else margin.left = 80; // more room for category labels on Y-axis
    } else {
      if (!s.axisSettings.showXAxis.value) margin.bottom = 8;
      if (!s.axisSettings.showYAxis.value) margin.left = 8;
    }
    if (legendPos === 'top') margin.top += legendReserve;
    if (legendPos === 'right') margin.right += 80;

    const padding = 12;
    const baseSvgWidth = viewport.width - padding * 2;
    const baseSvgHeight = viewport.height - padding * 2 - (legendPos === 'bottom' || legendPos === 'top' ? legendReserve : 0);
    const baseChartWidth = Math.max(0, baseSvgWidth - margin.left - margin.right);
    const baseChartHeight = Math.max(0, baseSvgHeight - margin.top - margin.bottom);

    if (baseChartWidth <= 0 || baseChartHeight <= 0) {
      this.renderEmpty();
      return;
    }

    // Scroll support
    const scroll = createScrollableChart({
      container: this.container,
      viewportWidth: baseSvgWidth,
      viewportHeight: baseSvgHeight,
      categoryCount: data.boxes.length,
      scrollSettings: s.scrollFormattingCard,
      availableChartWidth: baseChartWidth,
      availableChartHeight: baseChartHeight,
      direction: isHorizontal ? 'vertical' : 'horizontal',
    });
    const svgWidth = scroll.svgWidth;
    const svgHeight = scroll.svgHeight;
    const chartWidth = scroll.chartWidth;
    const chartHeight = scroll.chartHeight;

    // Legend (top)
    if (showLegend && legendPos === 'top') {
      this.renderSharedLegend(data);
    }

    // SVG
    const svg = d3.select(scroll.svgParent)
      .append('svg')
      .attr('class', 'box-plot-svg')
      .attr('width', svgWidth)
      .attr('height', svgHeight);

    const chartGroup = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales — depend on orientation
    const categories = data.boxes.map((b) => b.category);
    const valPad = (data.globalMax - data.globalMin) * 0.1;

    // Category band scale and value linear scale
    const catScale = d3.scaleBand()
      .domain(categories)
      .range(isHorizontal ? [0, chartHeight] : [0, chartWidth])
      .paddingInner(0.2)
      .paddingOuter(0.1);

    const valScale = d3.scaleLinear()
      .domain([data.globalMin - valPad, data.globalMax + valPad])
      .nice()
      .range(isHorizontal ? [0, chartWidth] : [chartHeight, 0]);

    // Aliases for backward-compat in vertical mode
    const xScale = isHorizontal ? catScale : catScale;
    const yScale = valScale;

    // Grid lines
    if (s.axisSettings.gridLines.value) {
      if (isHorizontal) {
        chartGroup.append('g')
          .attr('class', 'box-plot-grid')
          .call(
            d3.axisBottom(valScale as d3.ScaleLinear<number, number>)
              .ticks(6)
              .tickSize(chartHeight)
              .tickFormat(() => ''),
          );
      } else {
        chartGroup.append('g')
          .attr('class', 'box-plot-grid')
          .call(
            d3.axisLeft(valScale)
              .ticks(6)
              .tickSize(-chartWidth)
              .tickFormat(() => ''),
          );
      }
    }

    // Axes
    if (isHorizontal) {
      // Horizontal: categories on left Y-axis, values on bottom X-axis
      if (s.axisSettings.showYAxis.value) {
        chartGroup.append('g')
          .attr('class', 'box-plot-axis box-plot-axis-x')
          .call(d3.axisLeft(catScale).tickSize(0))
          .select('.domain').remove();
      }
      if (s.axisSettings.showXAxis.value) {
        chartGroup.append('g')
          .attr('class', 'box-plot-axis')
          .attr('transform', `translate(0,${chartHeight})`)
          .call(
            d3.axisBottom(valScale as d3.ScaleLinear<number, number>)
              .ticks(6)
              .tickFormat((d) => formatWithSettings(d as number, this.settings.numberFormattingCard)),
          )
          .select('.domain').remove();
      }
    } else {
      // Vertical: categories on bottom X-axis, values on left Y-axis
      if (s.axisSettings.showXAxis.value) {
        chartGroup.append('g')
          .attr('class', 'box-plot-axis box-plot-axis-x')
          .attr('transform', `translate(0,${chartHeight})`)
          .call(d3.axisBottom(catScale).tickSize(0))
          .select('.domain').remove();
      }
      if (s.axisSettings.showYAxis.value) {
        chartGroup.append('g')
          .attr('class', 'box-plot-axis')
          .call(
            d3.axisLeft(valScale)
              .ticks(6)
              .tickFormat((d) => formatWithSettings(d as number, this.settings.numberFormattingCard)),
          )
          .select('.domain').remove();
      }
    }

    // Reference line (rendered after axes/grid but before data elements)
    if (isHorizontal) {
      // For horizontal orientation, reference line is vertical
      this.renderSharedReferenceLine(chartGroup, yScale, chartHeight);
    } else {
      this.renderSharedReferenceLine(chartGroup, yScale, chartWidth);
    }

    // Trend line through median values
    this.renderSharedTrendLine(chartGroup, data, xScale, yScale);

    // Settings
    const boxColor = s.colorSettings.boxColor.value?.value ?? '#3B82F6';
    const whiskerColor = s.colorSettings.whiskerColor.value?.value ?? '#64748B';
    const medianColor = s.boxSettings.medianColor.value?.value ?? '#6366F1';
    const showOutliers = s.boxSettings.showOutliers.value;
    const showMedianLine = s.boxSettings.showMedianLine.value;
    const showDataLabels = s.dataLabelFormattingCard.showDataLabels.value;
    const userBoxWidth = s.boxSettings.boxWidth.value;
    const boxStrokeColor = s.boxSettings.boxStrokeColor.value?.value || boxColor;
    const boxStrokeWidth = s.boxSettings.boxStrokeWidth.value;
    const whiskerWidth = s.boxSettings.whiskerWidth.value;
    const outlierRadius = s.boxSettings.outlierRadius.value;
    const animEnabled = s.animationSettings.enabled.value;
    const animDuration = s.animationSettings.duration.value;
    const staggerDelay = s.animationSettings.staggerDelay.value;

    // Mean marker settings
    const showMeanMarker = s.meanMarkerSettings.show.value;
    const meanShape = s.meanMarkerSettings.shape.value?.value ?? 'diamond';
    const meanColor = s.meanMarkerSettings.color.value?.value ?? '#F59E0B';
    const meanSize = s.meanMarkerSettings.size.value;

    // Jitter settings
    const showJitter = s.jitterSettings.show.value;
    const jitterOpacity = Math.max(0, Math.min(100, s.jitterSettings.opacity.value)) / 100;
    const jitterRadius = s.jitterSettings.radius.value;
    const jitterColorRaw = s.jitterSettings.color.value?.value ?? '';
    const jitterColor = jitterColorRaw.length > 0 ? jitterColorRaw : boxColor;

    // Render each box
    data.boxes.forEach((box, idx) => {
      const bandCenter = (catScale(box.category) ?? 0) + catScale.bandwidth() / 2;
      const effectiveBoxWidth = Math.min(userBoxWidth, catScale.bandwidth() * 0.8);
      const halfBox = effectiveBoxWidth / 2;

      // Map statistical values through the value scale
      const vMin = valScale(box.min);
      const vQ1 = valScale(box.q1);
      const vMedian = valScale(box.median);
      const vQ3 = valScale(box.q3);
      const vMax = valScale(box.max);

      const capHalf = (effectiveBoxWidth * WHISKER_CAP_WIDTH) / 2;
      const delay = idx * staggerDelay;

      // -- Jittered data points (rendered first so they appear behind) ----
      if (showJitter && box.rawValues.length > 0) {
        box.rawValues.forEach((val, pIdx) => {
          const seed = Math.round(val * 1000) + pIdx * 7919 + idx * 104729;
          const jitterOffset = (seededRandom(seed) - 0.5) * effectiveBoxWidth * 0.6;
          let cx: number;
          let cy: number;
          if (isHorizontal) {
            cx = valScale(val);
            cy = bandCenter + jitterOffset;
          } else {
            cx = bandCenter + jitterOffset;
            cy = valScale(val);
          }

          const dot = chartGroup.append('circle')
            .attr('class', 'box-plot-jitter-point')
            .attr('cx', cx)
            .attr('cy', cy)
            .attr('r', jitterRadius)
            .attr('fill', jitterColor)
            .attr('fill-opacity', jitterOpacity)
            .attr('stroke', 'none');

          if (animEnabled) {
            const dotNode = dot.node();
            if (dotNode) {
              const jitterDelay = delay + 50 + pIdx * 10;
              const cancel = popIn(dotNode, jitterDelay, DURATION.fast);
              this.cancelAnimations.push(cancel);
            }
          }
        });
      }

      // -- Lower whisker line (min to Q1) --------------------------------
      const lowerWhiskerPath = chartGroup.append('path')
        .attr('class', 'box-plot-whisker')
        .attr('d', isHorizontal
          ? `M${vMin},${bandCenter} L${vQ1},${bandCenter}`
          : `M${bandCenter},${vMin} L${bandCenter},${vQ1}`)
        .attr('stroke', whiskerColor)
        .attr('stroke-width', whiskerWidth)
        .attr('fill', 'none');

      if (animEnabled) {
        const node = lowerWhiskerPath.node();
        if (node) {
          const cancel = drawPath(node, animDuration, delay);
          this.cancelAnimations.push(cancel);
        }
      }

      // -- Upper whisker line (Q3 to max) --------------------------------
      const upperWhiskerPath = chartGroup.append('path')
        .attr('class', 'box-plot-whisker')
        .attr('d', isHorizontal
          ? `M${vQ3},${bandCenter} L${vMax},${bandCenter}`
          : `M${bandCenter},${vQ3} L${bandCenter},${vMax}`)
        .attr('stroke', whiskerColor)
        .attr('stroke-width', whiskerWidth)
        .attr('fill', 'none');

      if (animEnabled) {
        const node = upperWhiskerPath.node();
        if (node) {
          const cancel = drawPath(node, animDuration, delay);
          this.cancelAnimations.push(cancel);
        }
      }

      // -- Lower whisker cap ---------------------------------------------
      if (isHorizontal) {
        chartGroup.append('line')
          .attr('class', 'box-plot-whisker-cap')
          .attr('x1', vMin).attr('x2', vMin)
          .attr('y1', bandCenter - capHalf).attr('y2', bandCenter + capHalf)
          .attr('stroke', whiskerColor).attr('stroke-width', whiskerWidth);
      } else {
        chartGroup.append('line')
          .attr('class', 'box-plot-whisker-cap')
          .attr('x1', bandCenter - capHalf).attr('x2', bandCenter + capHalf)
          .attr('y1', vMin).attr('y2', vMin)
          .attr('stroke', whiskerColor).attr('stroke-width', whiskerWidth);
      }

      // -- Upper whisker cap ---------------------------------------------
      if (isHorizontal) {
        chartGroup.append('line')
          .attr('class', 'box-plot-whisker-cap')
          .attr('x1', vMax).attr('x2', vMax)
          .attr('y1', bandCenter - capHalf).attr('y2', bandCenter + capHalf)
          .attr('stroke', whiskerColor).attr('stroke-width', whiskerWidth);
      } else {
        chartGroup.append('line')
          .attr('class', 'box-plot-whisker-cap')
          .attr('x1', bandCenter - capHalf).attr('x2', bandCenter + capHalf)
          .attr('y1', vMax).attr('y2', vMax)
          .attr('stroke', whiskerColor).attr('stroke-width', whiskerWidth);
      }

      // -- Box rect (Q1 to Q3) -------------------------------------------
      let boxX: number;
      let boxY: number;
      let boxW: number;
      let boxH: number;
      if (isHorizontal) {
        // Horizontal: box spans Q1→Q3 along x, centered on bandCenter along y
        const left = Math.min(vQ1, vQ3);
        boxX = left;
        boxY = bandCenter - halfBox;
        boxW = Math.max(0, Math.abs(vQ3 - vQ1));
        boxH = effectiveBoxWidth;
      } else {
        boxX = bandCenter - halfBox;
        boxY = vQ3; // Q3 is higher value -> lower y coordinate
        boxW = effectiveBoxWidth;
        boxH = Math.max(0, vQ1 - vQ3);
      }

      const sf = resolveSeriesFormatting(this.settings.seriesFormattingCard, idx, boxColor);
      const condColor = this.getConditionalColor(box.median);
      const resolvedBoxFill = condColor ?? withOpacity(sf.color, sf.opacity / 100 * 0.6);

      const boxRect = chartGroup.append('rect')
        .attr('class', 'box-plot-box')
        .attr('x', boxX)
        .attr('y', boxY)
        .attr('width', boxW)
        .attr('height', boxH)
        .attr('rx', 2)
        .attr('ry', 2)
        .attr('fill', resolvedBoxFill)
        .attr('stroke', boxStrokeColor)
        .attr('stroke-width', boxStrokeWidth);

      // Tooltip on box
      this.attachBoxTooltip(boxRect, box);
      boxRect
        .style('cursor', 'pointer')
        .on('click', (event: MouseEvent) => {
          event.stopPropagation();
          void this.selectionManager.select(box.selectionId, event.ctrlKey || event.metaKey);
        })
        .on('contextmenu', (event: MouseEvent) => {
          event.preventDefault();
          event.stopPropagation();
          void this.selectionManager.showContextMenu(box.selectionId, {
            x: event.clientX,
            y: event.clientY,
          });
        });

      // Animate box growing from median outward
      if (animEnabled) {
        const rectNode = boxRect.node();
        if (rectNode) {
          if (isHorizontal) {
            const medianX = vMedian;
            const targetX = boxX;
            const targetW = boxW;
            rectNode.setAttribute('x', String(medianX));
            rectNode.setAttribute('width', '0');
            let animCancel: (() => void) | null = null;
            const tid = setTimeout(() => {
              animCancel = animate(animDuration, cubicOut, (progress) => {
                const currentX = medianX + (targetX - medianX) * progress;
                const currentW = targetW * progress;
                rectNode.setAttribute('x', String(currentX));
                rectNode.setAttribute('width', String(Math.max(0, currentW)));
              });
            }, delay);
            this.cancelAnimations.push(() => {
              clearTimeout(tid);
              animCancel?.();
              rectNode.setAttribute('x', String(targetX));
              rectNode.setAttribute('width', String(targetW));
            });
          } else {
            const medianY = vMedian;
            const targetY = boxY;
            const targetH = boxH;
            rectNode.setAttribute('y', String(medianY));
            rectNode.setAttribute('height', '0');
            let animCancel: (() => void) | null = null;
            const tid = setTimeout(() => {
              animCancel = animate(animDuration, cubicOut, (progress) => {
                const currentY = medianY + (targetY - medianY) * progress;
                const currentH = targetH * progress;
                rectNode.setAttribute('y', String(currentY));
                rectNode.setAttribute('height', String(Math.max(0, currentH)));
              });
            }, delay);
            this.cancelAnimations.push(() => {
              clearTimeout(tid);
              animCancel?.();
              rectNode.setAttribute('y', String(targetY));
              rectNode.setAttribute('height', String(targetH));
            });
          }
        }
      }

      // -- Median line ---------------------------------------------------
      if (showMedianLine) {
        const medianLine = isHorizontal
          ? chartGroup.append('line')
              .attr('class', 'box-plot-median')
              .attr('x1', vMedian).attr('x2', vMedian)
              .attr('y1', bandCenter - halfBox).attr('y2', bandCenter + halfBox)
              .attr('stroke', medianColor)
              .attr('stroke-width', MEDIAN_STROKE_WIDTH)
              .attr('stroke-linecap', 'round')
          : chartGroup.append('line')
              .attr('class', 'box-plot-median')
              .attr('x1', bandCenter - halfBox).attr('x2', bandCenter + halfBox)
              .attr('y1', vMedian).attr('y2', vMedian)
              .attr('stroke', medianColor)
              .attr('stroke-width', MEDIAN_STROKE_WIDTH)
              .attr('stroke-linecap', 'round');

        if (animEnabled) {
          const lineNode = medianLine.node();
          if (lineNode) {
            const svgEl = lineNode as unknown as HTMLElement;
            const cancel = fadeSlideIn(svgEl, 'left', animDuration, delay + 100);
            this.cancelAnimations.push(cancel);
          }
        }
      }

      // -- Mean marker ---------------------------------------------------
      if (showMeanMarker) {
        const meanValPos = valScale(box.mean);
        // Compute center coordinates depending on orientation
        const meanCx = isHorizontal ? meanValPos : bandCenter;
        const meanCy = isHorizontal ? bandCenter : meanValPos;

        if (meanShape === 'diamond') {
          const half = meanSize / 2;
          const diamondPath = `M${meanCx},${meanCy - half}`
            + ` L${meanCx + half},${meanCy}`
            + ` L${meanCx},${meanCy + half}`
            + ` L${meanCx - half},${meanCy}`
            + ' Z';
          const marker = chartGroup.append('path')
            .attr('class', 'box-plot-mean-marker')
            .attr('d', diamondPath)
            .attr('fill', meanColor)
            .attr('stroke', 'none');

          if (animEnabled) {
            const markerNode = marker.node();
            if (markerNode) {
              const cancel = popIn(markerNode, delay + 150, DURATION.fast);
              this.cancelAnimations.push(cancel);
            }
          }
        } else if (meanShape === 'cross') {
          const half = meanSize / 2;
          const crossGroup = chartGroup.append('g')
            .attr('class', 'box-plot-mean-marker');

          crossGroup.append('line')
            .attr('x1', meanCx - half).attr('x2', meanCx + half)
            .attr('y1', meanCy).attr('y2', meanCy)
            .attr('stroke', meanColor).attr('stroke-width', 2);

          crossGroup.append('line')
            .attr('x1', meanCx).attr('x2', meanCx)
            .attr('y1', meanCy - half).attr('y2', meanCy + half)
            .attr('stroke', meanColor).attr('stroke-width', 2);

          if (animEnabled) {
            const groupNode = crossGroup.node();
            if (groupNode) {
              const cancel = popIn(groupNode, delay + 150, DURATION.fast);
              this.cancelAnimations.push(cancel);
            }
          }
        } else {
          // Circle
          const marker = chartGroup.append('circle')
            .attr('class', 'box-plot-mean-marker')
            .attr('cx', meanCx)
            .attr('cy', meanCy)
            .attr('r', meanSize / 2)
            .attr('fill', meanColor)
            .attr('stroke', 'none');

          if (animEnabled) {
            const markerNode = marker.node();
            if (markerNode) {
              const cancel = popIn(markerNode, delay + 150, DURATION.fast);
              this.cancelAnimations.push(cancel);
            }
          }
        }
      }

      // -- Outlier dots --------------------------------------------------
      if (showOutliers && box.outliers.length > 0) {
        box.outliers.forEach((outlierVal, oIdx) => {
          const outlierValPos = valScale(outlierVal);
          const outlierCx = isHorizontal ? outlierValPos : bandCenter;
          const outlierCy = isHorizontal ? bandCenter : outlierValPos;
          const outlierDot = chartGroup.append('circle')
            .attr('class', 'box-plot-outlier')
            .attr('cx', outlierCx)
            .attr('cy', outlierCy)
            .attr('r', outlierRadius)
            .attr('fill', withOpacity(boxColor, 0.7))
            .attr('stroke', boxStrokeColor)
            .attr('stroke-width', boxStrokeWidth);

          // Tooltip on outlier
          this.attachOutlierTooltip(outlierDot, box.category, outlierVal);
          outlierDot
            .style('cursor', 'pointer')
            .on('click', (event: MouseEvent) => {
              event.stopPropagation();
              void this.selectionManager.select(box.selectionId, event.ctrlKey || event.metaKey);
            })
            .on('contextmenu', (event: MouseEvent) => {
              event.preventDefault();
              event.stopPropagation();
              void this.selectionManager.showContextMenu(box.selectionId, {
                x: event.clientX,
                y: event.clientY,
              });
            });

          if (animEnabled) {
            const dotNode = outlierDot.node();
            if (dotNode) {
              const outlierDelay = delay + 200 + oIdx * 40;
              const cancel = popIn(dotNode, outlierDelay, DURATION.fast);
              this.cancelAnimations.push(cancel);
            }
          }
        });
      }

      // -- Data label (median value) ------------------------------------
      if (showDataLabels) {
        const labelX = isHorizontal ? vMedian + 6 : bandCenter;
        const labelY = isHorizontal ? bandCenter : vMedian - 6;
        const dataLabel = chartGroup.append('text')
          .attr('class', 'box-plot-label')
          .attr('x', labelX)
          .attr('y', labelY)
          .text(formatWithSettings(box.median, this.settings.numberFormattingCard));

        if (animEnabled) {
          const labelNode = dataLabel.node();
          if (labelNode) {
            const cancel = fadeSlideIn(labelNode as unknown as HTMLElement, 'left', animDuration, delay + 150);
            this.cancelAnimations.push(cancel);
          }
        }
      }
    });

    // Apply axis and grid formatting from settings
    const svgEl = this.container.querySelector('svg');
    if (svgEl) {
      svgEl.querySelectorAll('[class*="box-plot-axis"]').forEach((el) => {
        applyAxisFormatting(el as SVGGElement, this.settings.axisFormattingCard);
      });
      svgEl.querySelectorAll('[class*="box-plot-grid"]').forEach((el) => {
        applyGridFormatting(el as SVGGElement, this.settings.axisFormattingCard);
      });
    }

    // Apply data label formatting from shared settings
    applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.box-plot-label');

    // Legend (bottom or right)
    if (showLegend && (legendPos === 'bottom' || legendPos === 'right')) {
      this.renderSharedLegend(data);
    }

    // Render violin overlay if enabled
    this.renderViolinOverlay(data, chartGroup, catScale, valScale, isHorizontal);

    // Render notches if enabled
    this.renderNotches(data, chartGroup, catScale, valScale, isHorizontal);

    // Render per-category colors if enabled
    this.applyPerCategoryColors(chartGroup, data);

    this.container.addEventListener('click', this.handleBackgroundClick);

    // Accessibility (keyboard nav + ARIA)
    this.applyAccessibility(data.boxes.length);
  }

  // -- Tooltips -----------------------------------------------------------

  private attachBoxTooltip(
    rect: d3.Selection<SVGRectElement, unknown, null, undefined>,
    box: BoxStats,
  ): void {
    const host = this.host;

    rect.on('mouseover', (event: MouseEvent) => {
      const numberSettings = this.settings.numberFormattingCard;
      const tooltipData: VisualTooltipDataItem[] = [
        { displayName: 'Category', value: box.category },
        { displayName: 'Max', value: formatWithSettings(box.max, numberSettings) },
        { displayName: 'Q3', value: formatWithSettings(box.q3, numberSettings) },
        { displayName: 'Median', value: formatWithSettings(box.median, numberSettings) },
        { displayName: 'Q1', value: formatWithSettings(box.q1, numberSettings) },
        { displayName: 'Min', value: formatWithSettings(box.min, numberSettings) },
      ];

      if (box.outliers.length > 0) {
        tooltipData.push({
          displayName: 'Outliers',
          value: String(box.outliers.length),
        });
      }

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

  private attachOutlierTooltip(
    circle: d3.Selection<SVGCircleElement, unknown, null, undefined>,
    category: string,
    value: number,
  ): void {
    const host = this.host;

    circle.on('mouseover', (event: MouseEvent) => {
      const tooltipData: VisualTooltipDataItem[] = [
        { displayName: 'Category', value: category },
        { displayName: 'Outlier Value', value: formatWithSettings(value, this.settings.numberFormattingCard) },
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

  // -- Reference Line (shared) ---------------------------------------------

  private renderSharedReferenceLine(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    yScale: d3.ScaleLinear<number, number>,
    width: number,
  ): void {
    const ref = this.settings.referenceLineFormattingCard;
    if (!ref.showReferenceLine.value) return;

    const refColor = ref.referenceLineColor.value?.value ?? '#EF4444';
    const refStyleVal = resolveDropdown(ref.referenceLineStyle) ?? 'dashed';

    const config: ReferenceLineConfig = {
      value: ref.referenceLineValue.value,
      yScale,
      chartWidth: width,
      lineColor: refColor,
      lineWidth: ref.referenceLineWidth.value,
      lineStyle: refStyleVal as 'solid' | 'dashed' | 'dotted',
      showLabel: ref.showReferenceLabel.value,
      labelText: ref.referenceLabelText.value.length > 0
        ? ref.referenceLabelText.value
        : formatWithSettings(ref.referenceLineValue.value, this.settings.numberFormattingCard),
      showBand: ref.showReferenceBand.value,
      bandOpacity: Math.max(0, Math.min(100, ref.referenceBandOpacity.value)) / 100,
    };

    renderHorizontalReferenceLine(g, config);
  }

  // -- Legend (shared) ----------------------------------------------------

  private renderSharedLegend(data: BoxPlotData): void {
    const themeName = resolveColorTheme(this.settings.colorThemeFormattingCard);
    const legendFmtCard = this.settings.legendFormattingCard;
    const rawFontColor = legendFmtCard.legendFontColor.value?.value;
    const legendFontColor = rawFontColor != null && rawFontColor.length > 0 ? rawFontColor : '#1E293B';
    const legendFontSize = legendFmtCard.legendFontSize.value;

    const boxColor = this.settings.colorSettings.boxColor.value?.value ?? '#3B82F6';
    const perCategory = this.settings.boxPlotColorSettings.perCategoryColors.value;

    const items: LegendItem[] = data.boxes.map((box, idx) => ({
      label: box.category,
      color: perCategory ? getHostChartColor(this.host.colorPalette, idx, themeName) : boxColor,
    }));

    const rawLegendFontFamily = resolveDropdown(legendFmtCard.legendFontFamily) || undefined;

    renderLegend(this.container, {
      items,
      position: this.getLegendPosition(),
      fontSize: legendFontSize,
      fontColor: legendFontColor,
      fontFamily: rawLegendFontFamily,
    });
  }

  private getLegendPosition(): LegendPosition {
    const val = this.settings.legendFormattingCard.legendPosition.value?.value;
    const validPositions: LegendPosition[] = ['bottom', 'top', 'left', 'right'];
    if (typeof val === 'string' && validPositions.includes(val as LegendPosition)) {
      return val as LegendPosition;
    }
    return 'bottom';
  }

  // -- Violin Overlay -----------------------------------------------------

  private renderViolinOverlay(
    data: BoxPlotData,
    chartGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
    catScale: d3.ScaleBand<string>,
    valScale: d3.ScaleLinear<number, number>,
    isHorizontal: boolean,
  ): void {
    if (!this.settings.boxPlotDisplaySettings.showViolin.value) return;

    const boxColor = this.settings.colorSettings.boxColor.value?.value ?? '#3B82F6';

    for (const box of data.boxes) {
      if (box.rawValues.length < 4) continue;

      const bandCenter = (catScale(box.category) ?? 0) + catScale.bandwidth() / 2;
      const halfWidth = Math.min(this.settings.boxSettings.boxWidth.value, catScale.bandwidth() * 0.8) / 2;

      // Simple KDE approximation using histogram bins
      const sorted = [...box.rawValues].sort((a, b) => a - b);
      const minVal = sorted[0];
      const maxVal = sorted[sorted.length - 1];
      const range = maxVal - minVal;
      if (range === 0) continue;

      const binCount = Math.min(20, Math.max(5, Math.floor(sorted.length / 3)));
      const binWidth = range / binCount;
      const bins = new Array<number>(binCount).fill(0);

      for (const val of sorted) {
        const idx = Math.min(binCount - 1, Math.floor((val - minVal) / binWidth));
        bins[idx]++;
      }

      const maxBin = Math.max(...bins);
      if (maxBin === 0) continue;

      // Build symmetric violin path
      const points: Array<{ x: number; y: number }> = [];
      const pointsReverse: Array<{ x: number; y: number }> = [];

      for (let i = 0; i < binCount; i++) {
        const binCenter = minVal + (i + 0.5) * binWidth;
        const density = bins[i] / maxBin;
        const offset = density * halfWidth;
        const valPos = valScale(binCenter);

        if (isHorizontal) {
          points.push({ x: valPos, y: bandCenter - offset });
          pointsReverse.unshift({ x: valPos, y: bandCenter + offset });
        } else {
          points.push({ x: bandCenter - offset, y: valPos });
          pointsReverse.unshift({ x: bandCenter + offset, y: valPos });
        }
      }

      const allPoints = [...points, ...pointsReverse];
      const pathData = allPoints.map((p, i) =>
        i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`,
      ).join(' ') + ' Z';

      chartGroup.append('path')
        .attr('class', 'box-plot-violin')
        .attr('d', pathData)
        .attr('fill', withOpacity(boxColor, 0.15))
        .attr('stroke', withOpacity(boxColor, 0.3))
        .attr('stroke-width', 1)
        .style('pointer-events', 'none');
    }
  }

  // -- Notched Box Plot ---------------------------------------------------

  private renderNotches(
    data: BoxPlotData,
    chartGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
    catScale: d3.ScaleBand<string>,
    valScale: d3.ScaleLinear<number, number>,
    isHorizontal: boolean,
  ): void {
    if (!this.settings.boxPlotDisplaySettings.showNotches.value) return;

    const medianColor = this.settings.boxSettings.medianColor.value?.value ?? '#F28C38';

    for (const box of data.boxes) {
      if (box.rawValues.length < 2) continue;

      const bandCenter = (catScale(box.category) ?? 0) + catScale.bandwidth() / 2;
      const effectiveBoxWidth = Math.min(this.settings.boxSettings.boxWidth.value, catScale.bandwidth() * 0.8);
      const halfBox = effectiveBoxWidth / 2;

      // 95% CI for median: median +/- 1.57 * IQR / sqrt(n)
      const iqr = box.q3 - box.q1;
      const n = box.rawValues.length;
      const notchHalf = 1.57 * iqr / Math.sqrt(n);
      const notchLower = box.median - notchHalf;
      const notchUpper = box.median + notchHalf;
      const notchIndent = halfBox * 0.3;

      const vMedian = valScale(box.median);
      const vNotchLower = valScale(notchLower);
      const vNotchUpper = valScale(notchUpper);

      if (isHorizontal) {
        // Horizontal: notches indent vertically from box edges
        chartGroup.append('path')
          .attr('class', 'box-plot-notch')
          .attr('d', `M${vNotchLower},${bandCenter - halfBox} L${vMedian},${bandCenter - halfBox + notchIndent} L${vNotchUpper},${bandCenter - halfBox}`)
          .attr('stroke', medianColor).attr('stroke-width', 1.5).attr('fill', 'none')
          .style('pointer-events', 'none');
        chartGroup.append('path')
          .attr('class', 'box-plot-notch')
          .attr('d', `M${vNotchLower},${bandCenter + halfBox} L${vMedian},${bandCenter + halfBox - notchIndent} L${vNotchUpper},${bandCenter + halfBox}`)
          .attr('stroke', medianColor).attr('stroke-width', 1.5).attr('fill', 'none')
          .style('pointer-events', 'none');
      } else {
        // Vertical: notches indent horizontally from box edges
        chartGroup.append('path')
          .attr('class', 'box-plot-notch')
          .attr('d', `M${bandCenter - halfBox},${vNotchLower} L${bandCenter - halfBox + notchIndent},${vMedian} L${bandCenter - halfBox},${vNotchUpper}`)
          .attr('stroke', medianColor).attr('stroke-width', 1.5).attr('fill', 'none')
          .style('pointer-events', 'none');
        chartGroup.append('path')
          .attr('class', 'box-plot-notch')
          .attr('d', `M${bandCenter + halfBox},${vNotchLower} L${bandCenter + halfBox - notchIndent},${vMedian} L${bandCenter + halfBox},${vNotchUpper}`)
          .attr('stroke', medianColor).attr('stroke-width', 1.5).attr('fill', 'none')
          .style('pointer-events', 'none');
      }
    }
  }

  // -- Per-Category Colors ------------------------------------------------

  private applyPerCategoryColors(
    chartGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
    data: BoxPlotData,
  ): void {
    const themeName = resolveColorTheme(this.settings.colorThemeFormattingCard);
    if (!this.settings.boxPlotColorSettings.perCategoryColors.value) return;

    const boxNodes = chartGroup.selectAll<SVGRectElement, unknown>('.box-plot-box').nodes();
    for (let i = 0; i < boxNodes.length; i++) {
      if (i < data.boxes.length) {
        const color = getHostChartColor(this.host.colorPalette, i, themeName);
        boxNodes[i].setAttribute('fill', withOpacity(color, 0.6));
      }
    }
  }

  // -- Conditional Formatting ---------------------------------------------

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

  // -- Accessibility ------------------------------------------------------

  private applyAccessibility(dataPointCount: number): void {
    const acc = this.settings.accessibilityFormattingCard;
    if (!acc.enableKeyboardNav.value) return;
    ensureFocusRingStyles();
    applyChartAria(this.container, {
      chartType: 'box plot',
      title: this.settings.titleFormattingCard?.titleText?.value || undefined,
      dataPointCount,
    });
    const cleanup = attachKeyboardNav({
      container: this.container,
      itemSelector: '.box-group, [tabindex="0"]',
      onActivate: (el) => (el as HTMLElement).click?.(),
    });
    this.cancelAnimations.push(cleanup);
  }

  // -- Trend Line ---------------------------------------------------------

  private renderSharedTrendLine(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    data: BoxPlotData,
    xScale: d3.ScaleBand<string>,
    yScale: d3.ScaleLinear<number, number>,
  ): void {
    const tl = this.settings.trendLineFormattingCard;
    if (!tl.showTrendLine.value) return;
    const medians = data.boxes.map((b) => b.median);
    if (medians.length < 2) return;
    const trendType = (resolveDropdown(tl.trendLineType) ?? 'linear') as TrendType;
    const result = computeRegression(medians, trendType, tl.polynomialOrder.value);
    renderTrendLine(g, {
      predicted: result.predicted,
      xScale: (i: number) => (xScale(data.boxes[i]?.category ?? '') ?? 0) + xScale.bandwidth() / 2,
      yScale,
      lineColor: tl.trendLineColor.value?.value ?? '#6366F1',
      lineWidth: tl.trendLineWidth.value,
      showEquation: tl.showEquation.value,
      showR2: tl.showR2.value,
      equation: result.equation,
      r2: result.r2,
    });
  }

  // -- Formatting Model ---------------------------------------------------

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  private handleBackgroundClick = (): void => {
    void this.selectionManager.clear();
  };

  // -- Cleanup ------------------------------------------------------------

  public destroy(): void {
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
  }
}
