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
  withOpacity,
  renderChartTitle,
  applyAxisFormatting,
  applyGridFormatting,
  applyDataLabelFormatting,
  createScrollableChart,
  resolveDropdown,
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

function computeStats(category: string, values: number[]): Omit<BoxStats, 'selectionId'> | null {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const q1 = d3.quantile(sorted, 0.25) ?? sorted[0];
  const median = d3.quantile(sorted, 0.5) ?? sorted[0];
  const q3 = d3.quantile(sorted, 0.75) ?? sorted[0];
  const iqr = q3 - q1;

  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;

  // Whisker min/max: the most extreme data points within the fences
  const whiskerMin = Math.max(sorted[0], lowerFence);
  const whiskerMax = Math.min(sorted[sorted.length - 1], upperFence);

  const outliers = sorted.filter((v) => v < lowerFence || v > upperFence);

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;

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
    const boxes: BoxStats[] = [];
    for (const [cat, group] of groupMap) {
      const stats = computeStats(cat, group.values);
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

    // Legend
    const showLegend = s.legendFormattingCard.showLegend.value;
    const legendPos = this.getLegendPosition();
    const legendReserve = showLegend ? LEGEND_HEIGHT : 0;

    const margin: Margin = { ...MARGIN_DEFAULT };

    if (!s.axisSettings.showXAxis.value) margin.bottom = 8;
    if (!s.axisSettings.showYAxis.value) margin.left = 8;
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
      direction: 'horizontal',
    });
    const svgWidth = scroll.svgWidth;
    const svgHeight = scroll.svgHeight;
    const chartWidth = scroll.chartWidth;
    const chartHeight = scroll.chartHeight;

    // Legend (top)
    if (showLegend && legendPos === 'top') {
      this.renderLegend(data);
    }

    // SVG
    const svg = d3.select(scroll.svgParent)
      .append('svg')
      .attr('class', 'box-plot-svg')
      .attr('width', svgWidth)
      .attr('height', svgHeight);

    const chartGroup = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const categories = data.boxes.map((b) => b.category);
    const xScale = d3.scaleBand()
      .domain(categories)
      .range([0, chartWidth])
      .paddingInner(0.2)
      .paddingOuter(0.1);

    // Add 10% padding to y range
    const yPad = (data.globalMax - data.globalMin) * 0.1;
    const yScale = d3.scaleLinear()
      .domain([data.globalMin - yPad, data.globalMax + yPad])
      .nice()
      .range([chartHeight, 0]);

    // Grid lines
    if (s.axisSettings.gridLines.value) {
      chartGroup.append('g')
        .attr('class', 'box-plot-grid')
        .call(
          d3.axisLeft(yScale)
            .ticks(6)
            .tickSize(-chartWidth)
            .tickFormat(() => ''),
        );
    }

    // Axes
    if (s.axisSettings.showXAxis.value) {
      chartGroup.append('g')
        .attr('class', 'box-plot-axis box-plot-axis-x')
        .attr('transform', `translate(0,${chartHeight})`)
        .call(d3.axisBottom(xScale).tickSize(0))
        .select('.domain').remove();
    }

    if (s.axisSettings.showYAxis.value) {
      chartGroup.append('g')
        .attr('class', 'box-plot-axis')
        .call(
          d3.axisLeft(yScale)
            .ticks(6)
            .tickFormat((d) => formatWithSettings(d as number, this.settings.numberFormattingCard)),
        )
        .select('.domain').remove();
    }

    // Reference line (rendered after axes/grid but before data elements)
    this.renderReferenceLine(chartGroup, yScale, chartWidth);

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
      const bandCenter = (xScale(box.category) ?? 0) + xScale.bandwidth() / 2;
      const effectiveBoxWidth = Math.min(userBoxWidth, xScale.bandwidth() * 0.8);
      const halfBox = effectiveBoxWidth / 2;

      const yMin = yScale(box.min);
      const yQ1 = yScale(box.q1);
      const yMedian = yScale(box.median);
      const yQ3 = yScale(box.q3);
      const yMax = yScale(box.max);

      const capHalf = (effectiveBoxWidth * WHISKER_CAP_WIDTH) / 2;
      const delay = idx * staggerDelay;

      // -- Jittered data points (rendered first so they appear behind) ----
      if (showJitter && box.rawValues.length > 0) {
        box.rawValues.forEach((val, pIdx) => {
          // Seeded random based on value + index for consistent positioning
          const seed = Math.round(val * 1000) + pIdx * 7919 + idx * 104729;
          const jitterOffset = (seededRandom(seed) - 0.5) * effectiveBoxWidth * 0.6;
          const cx = bandCenter + jitterOffset;
          const cy = yScale(val);

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
        .attr('d', `M${bandCenter},${yMin} L${bandCenter},${yQ1}`)
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
        .attr('d', `M${bandCenter},${yQ3} L${bandCenter},${yMax}`)
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
      chartGroup.append('line')
        .attr('class', 'box-plot-whisker-cap')
        .attr('x1', bandCenter - capHalf)
        .attr('x2', bandCenter + capHalf)
        .attr('y1', yMin)
        .attr('y2', yMin)
        .attr('stroke', whiskerColor)
        .attr('stroke-width', whiskerWidth);

      // -- Upper whisker cap ---------------------------------------------
      chartGroup.append('line')
        .attr('class', 'box-plot-whisker-cap')
        .attr('x1', bandCenter - capHalf)
        .attr('x2', bandCenter + capHalf)
        .attr('y1', yMax)
        .attr('y2', yMax)
        .attr('stroke', whiskerColor)
        .attr('stroke-width', whiskerWidth);

      // -- Box rect (Q1 to Q3) -------------------------------------------
      const boxX = bandCenter - halfBox;
      const boxY = yQ3; // Q3 is higher value -> lower y coordinate
      const boxH = Math.max(0, yQ1 - yQ3);

      const boxRect = chartGroup.append('rect')
        .attr('class', 'box-plot-box')
        .attr('x', boxX)
        .attr('y', boxY)
        .attr('width', effectiveBoxWidth)
        .attr('height', boxH)
        .attr('rx', 2)
        .attr('ry', 2)
        .attr('fill', withOpacity(boxColor, 0.6))
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
          const medianY = yMedian;
          const targetY = boxY;
          const targetH = boxH;

          // Start at median line (zero height)
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

      // -- Median line ---------------------------------------------------
      if (showMedianLine) {
        const medianLine = chartGroup.append('line')
          .attr('class', 'box-plot-median')
          .attr('x1', bandCenter - halfBox)
          .attr('x2', bandCenter + halfBox)
          .attr('y1', yMedian)
          .attr('y2', yMedian)
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
        const yMean = yScale(box.mean);

        if (meanShape === 'diamond') {
          // Diamond: rotated square (4-point path)
          const half = meanSize / 2;
          const diamondPath = `M${bandCenter},${yMean - half}`
            + ` L${bandCenter + half},${yMean}`
            + ` L${bandCenter},${yMean + half}`
            + ` L${bandCenter - half},${yMean}`
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
          // Cross: two crossing lines (horizontal + vertical)
          const half = meanSize / 2;
          const crossGroup = chartGroup.append('g')
            .attr('class', 'box-plot-mean-marker');

          crossGroup.append('line')
            .attr('x1', bandCenter - half)
            .attr('x2', bandCenter + half)
            .attr('y1', yMean)
            .attr('y2', yMean)
            .attr('stroke', meanColor)
            .attr('stroke-width', 2);

          crossGroup.append('line')
            .attr('x1', bandCenter)
            .attr('x2', bandCenter)
            .attr('y1', yMean - half)
            .attr('y2', yMean + half)
            .attr('stroke', meanColor)
            .attr('stroke-width', 2);

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
            .attr('cx', bandCenter)
            .attr('cy', yMean)
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
          const cy = yScale(outlierVal);
          const outlierDot = chartGroup.append('circle')
            .attr('class', 'box-plot-outlier')
            .attr('cx', bandCenter)
            .attr('cy', cy)
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
        const labelY = yMedian - 6;
        const dataLabel = chartGroup.append('text')
          .attr('class', 'box-plot-label')
          .attr('x', bandCenter)
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
      this.renderLegend(data);
    }

    this.container.addEventListener('click', this.handleBackgroundClick);
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

  // -- Reference Line -----------------------------------------------------

  /**
   * Renders a user-configured reference line (and optional band) on the chart.
   */
  private renderReferenceLine(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    yScale: d3.ScaleLinear<number, number>,
    width: number,
  ): void {
    const ref = this.settings.referenceLineSettings;
    if (!ref.show.value) return;

    const refValue = ref.value.value;
    const refY = yScale(refValue);
    const refColor = ref.lineColor.value?.value ?? '#EF4444';
    const refWidth = ref.lineWidth.value;
    const refStyleVal = resolveDropdown(ref.lineStyle) ?? 'dashed';
    const refDash = refStyleVal === 'dashed' ? '6 3' : refStyleVal === 'dotted' ? '2 2' : 'none';

    // Band (rendered first so the line draws on top)
    if (ref.showBand.value) {
      const bandUpperY = yScale(ref.bandUpperValue.value);
      const bandTop = Math.min(refY, bandUpperY);
      const bandHeight = Math.abs(bandUpperY - refY);
      const bandOp = Math.max(0, Math.min(100, ref.bandOpacity.value)) / 100;

      g.append('rect')
        .attr('class', 'box-plot-ref-band')
        .attr('x', 0)
        .attr('y', bandTop)
        .attr('width', width)
        .attr('height', bandHeight)
        .attr('fill', refColor)
        .attr('fill-opacity', bandOp)
        .style('pointer-events', 'none');
    }

    // Line
    g.append('line')
      .attr('class', 'box-plot-ref-line')
      .attr('x1', 0)
      .attr('x2', width)
      .attr('y1', refY)
      .attr('y2', refY)
      .attr('stroke', refColor)
      .attr('stroke-width', refWidth)
      .attr('stroke-dasharray', refDash)
      .style('pointer-events', 'none');

    // Label
    if (ref.showLabel.value) {
      const labelText = ref.labelText.value.length > 0
        ? ref.labelText.value
        : formatWithSettings(refValue, this.settings.numberFormattingCard);

      g.append('text')
        .attr('class', 'box-plot-ref-label')
        .attr('x', width - 4)
        .attr('y', refY - 6)
        .attr('text-anchor', 'end')
        .attr('fill', refColor)
        .attr('font-size', '11px')
        .attr('font-weight', '600')
        .style('pointer-events', 'none')
        .text(labelText);
    }
  }

  // -- Legend -------------------------------------------------------------

  private renderLegend(data: BoxPlotData): void {
    const legendDiv = document.createElement('div');
    legendDiv.className = 'box-plot-legend';

    // Resolve legend font styling from the shared legendFormattingCard
    const legendFmtCard = this.settings.legendFormattingCard;
    const rawFontColor = legendFmtCard.legendFontColor.value?.value;
    const legendFontColor = rawFontColor != null && rawFontColor.length > 0 ? rawFontColor : '';
    const legendFontSize = legendFmtCard.legendFontSize.value;

    const boxColor = this.settings.colorSettings.boxColor.value?.value ?? '#3B82F6';

    for (const box of data.boxes) {
      const item = document.createElement('div');
      item.className = 'box-plot-legend-item';

      const swatch = document.createElement('div');
      swatch.className = 'box-plot-legend-swatch';
      swatch.style.backgroundColor = boxColor;
      item.appendChild(swatch);

      const label = document.createElement('span');
      label.textContent = box.category;
      if (legendFontColor.length > 0) label.style.color = legendFontColor;
      if (legendFontSize !== 11) label.style.fontSize = `${legendFontSize}px`;
      item.appendChild(label);

      legendDiv.appendChild(item);
    }

    this.container.appendChild(legendDiv);
  }

  private getLegendPosition(): LegendPosition {
    const val = this.settings.legendFormattingCard.legendPosition.value?.value;
    const validPositions: LegendPosition[] = ['bottom', 'top', 'left', 'right'];
    if (typeof val === 'string' && validPositions.includes(val as LegendPosition)) {
      return val as LegendPosition;
    }
    return 'bottom';
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
