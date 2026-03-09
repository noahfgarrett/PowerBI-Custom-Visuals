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
  formatWithSettings,
  getGlassStyle,
  getHostChartColor,
  withOpacity,
  renderChartTitle,
  applyAxisFormatting,
  applyGridFormatting,
  applyDataLabelFormatting,
  applyAllAxisFormatting,
  resolveDropdown,
  renderLegend,
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

// ── Regression Types ─────────────────────────────────────────────────

type RegressionType = 'linear' | 'polynomial' | 'exponential' | 'logarithmic' | 'power';

interface RegressionResult {
  /** Predicted y for a given x */
  predict: (x: number) => number;
  /** R-squared goodness of fit */
  r2: number;
  /** Human-readable equation string */
  equation: string;
}

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

// ── Regression Helpers ───────────────────────────────────────────────

/** Compute R² from actual y values and predicted y values. */
function computeR2(ys: number[], yPredicted: number[]): number {
  const n = ys.length;
  if (n === 0) return 0;
  let yMean = 0;
  for (let i = 0; i < n; i++) yMean += ys[i];
  yMean /= n;

  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    ssTot += (ys[i] - yMean) ** 2;
    ssRes += (ys[i] - yPredicted[i]) ** 2;
  }
  if (ssTot === 0) return 1;
  return 1 - ssRes / ssTot;
}

/** Format a coefficient for display (3 significant digits). */
function fmtCoeff(v: number): string {
  if (Math.abs(v) < 1e-10) return '0';
  return v.toPrecision(3);
}

/** Solve a system of linear equations using Gaussian elimination with partial pivoting.
 *  `matrix` is an augmented matrix [A|b] of size rows x (rows+1). Mutated in place.
 *  Returns the solution vector or null if singular. */
function gaussianElimination(matrix: number[][]): number[] | null {
  const n = matrix.length;

  for (let col = 0; col < n; col++) {
    // Partial pivoting
    let maxRow = col;
    let maxVal = Math.abs(matrix[col][col]);
    for (let row = col + 1; row < n; row++) {
      const absVal = Math.abs(matrix[row][col]);
      if (absVal > maxVal) {
        maxVal = absVal;
        maxRow = row;
      }
    }
    if (maxVal < 1e-12) return null; // Singular

    // Swap rows
    if (maxRow !== col) {
      const temp = matrix[col];
      matrix[col] = matrix[maxRow];
      matrix[maxRow] = temp;
    }

    // Eliminate below
    for (let row = col + 1; row < n; row++) {
      const factor = matrix[row][col] / matrix[col][col];
      for (let j = col; j <= n; j++) {
        matrix[row][j] -= factor * matrix[col][j];
      }
    }
  }

  // Back substitution
  const solution = new Array<number>(n);
  for (let row = n - 1; row >= 0; row--) {
    let sum = matrix[row][n];
    for (let j = row + 1; j < n; j++) {
      sum -= matrix[row][j] * solution[j];
    }
    solution[row] = sum / matrix[row][row];
  }
  return solution;
}

/** Linear regression: y = mx + b */
function linearRegression(xs: number[], ys: number[]): RegressionResult {
  const n = xs.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += xs[i];
    sumY += ys[i];
    sumXY += xs[i] * ys[i];
    sumX2 += xs[i] * xs[i];
  }
  const denom = n * sumX2 - sumX * sumX;
  const m = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  const b = (sumY - m * sumX) / n;

  const predicted = xs.map((x) => m * x + b);
  const r2 = computeR2(ys, predicted);

  const equation = `y = ${fmtCoeff(m)}x + ${fmtCoeff(b)}`;
  return {
    predict: (x: number) => m * x + b,
    r2,
    equation,
  };
}

/** Polynomial regression: y = a0 + a1*x + a2*x^2 + ... */
function polynomialRegression(xs: number[], ys: number[], order: number): RegressionResult {
  const n = xs.length;
  const clampedOrder = Math.max(2, Math.min(6, order));
  const terms = clampedOrder + 1;

  // Build normal equations matrix (augmented)
  const matrix: number[][] = [];
  for (let row = 0; row < terms; row++) {
    const matRow = new Array<number>(terms + 1).fill(0);
    for (let col = 0; col < terms; col++) {
      let sum = 0;
      for (let i = 0; i < n; i++) {
        sum += Math.pow(xs[i], row + col);
      }
      matRow[col] = sum;
    }
    // RHS
    let rhs = 0;
    for (let i = 0; i < n; i++) {
      rhs += Math.pow(xs[i], row) * ys[i];
    }
    matRow[terms] = rhs;
    matrix.push(matRow);
  }

  const coeffs = gaussianElimination(matrix);
  if (!coeffs) {
    // Fallback to linear if singular
    return linearRegression(xs, ys);
  }

  const predict = (x: number): number => {
    let result = 0;
    for (let j = 0; j < coeffs.length; j++) {
      result += coeffs[j] * Math.pow(x, j);
    }
    return result;
  };

  const predicted = xs.map(predict);
  const r2 = computeR2(ys, predicted);

  // Build equation string
  const parts: string[] = [];
  for (let j = coeffs.length - 1; j >= 0; j--) {
    if (Math.abs(coeffs[j]) < 1e-10) continue;
    if (j === 0) {
      parts.push(fmtCoeff(coeffs[j]));
    } else if (j === 1) {
      parts.push(`${fmtCoeff(coeffs[j])}x`);
    } else {
      parts.push(`${fmtCoeff(coeffs[j])}x^${j}`);
    }
  }
  const equation = `y = ${parts.length > 0 ? parts.join(' + ') : '0'}`;

  return { predict, r2, equation };
}

/** Exponential regression: y = a * e^(bx) — via ln(y) = ln(a) + bx */
function exponentialRegression(xs: number[], ys: number[]): RegressionResult {
  // Filter out non-positive y
  const filteredX: number[] = [];
  const filteredY: number[] = [];
  for (let i = 0; i < xs.length; i++) {
    if (ys[i] > 0) {
      filteredX.push(xs[i]);
      filteredY.push(ys[i]);
    }
  }
  if (filteredX.length < 2) {
    return linearRegression(xs, ys);
  }

  const lnY = filteredY.map((y) => Math.log(y));
  const linResult = linearRegression(filteredX, lnY);

  // ln(a) = intercept, b = slope
  const lnA = linResult.predict(0); // b_coeff (intercept)
  const a = Math.exp(lnA);
  // Extract slope: predict(1) - predict(0)
  const b = linResult.predict(1) - linResult.predict(0);

  const predict = (x: number): number => a * Math.exp(b * x);
  const predicted = filteredY.map((_y, i) => predict(filteredX[i]));
  const r2 = computeR2(filteredY, predicted);

  const equation = `y = ${fmtCoeff(a)}e^(${fmtCoeff(b)}x)`;
  return { predict, r2, equation };
}

/** Logarithmic regression: y = a * ln(x) + b */
function logarithmicRegression(xs: number[], ys: number[]): RegressionResult {
  // Filter out non-positive x
  const filteredX: number[] = [];
  const filteredY: number[] = [];
  for (let i = 0; i < xs.length; i++) {
    if (xs[i] > 0) {
      filteredX.push(xs[i]);
      filteredY.push(ys[i]);
    }
  }
  if (filteredX.length < 2) {
    return linearRegression(xs, ys);
  }

  const lnX = filteredX.map((x) => Math.log(x));
  const linResult = linearRegression(lnX, filteredY);

  // a = slope in ln(x) space, b = intercept
  const a = linResult.predict(1) - linResult.predict(0);
  const b = linResult.predict(0);

  const predict = (x: number): number => (x > 0 ? a * Math.log(x) + b : 0);
  const predicted = filteredY.map((_y, i) => predict(filteredX[i]));
  const r2 = computeR2(filteredY, predicted);

  const equation = `y = ${fmtCoeff(a)}ln(x) + ${fmtCoeff(b)}`;
  return { predict, r2, equation };
}

/** Power regression: y = a * x^b — via ln(y) = ln(a) + b*ln(x) */
function powerRegression(xs: number[], ys: number[]): RegressionResult {
  // Filter out non-positive x or y
  const filteredX: number[] = [];
  const filteredY: number[] = [];
  for (let i = 0; i < xs.length; i++) {
    if (xs[i] > 0 && ys[i] > 0) {
      filteredX.push(xs[i]);
      filteredY.push(ys[i]);
    }
  }
  if (filteredX.length < 2) {
    return linearRegression(xs, ys);
  }

  const lnX = filteredX.map((x) => Math.log(x));
  const lnY = filteredY.map((y) => Math.log(y));
  const linResult = linearRegression(lnX, lnY);

  const lnA = linResult.predict(0);
  const a = Math.exp(lnA);
  const b = linResult.predict(1) - linResult.predict(0);

  const predict = (x: number): number => (x > 0 ? a * Math.pow(x, b) : 0);
  const predicted = filteredY.map((_y, i) => predict(filteredX[i]));
  const r2 = computeR2(filteredY, predicted);

  const equation = `y = ${fmtCoeff(a)}x^${fmtCoeff(b)}`;
  return { predict, r2, equation };
}

/** Dispatch to the appropriate regression function. */
function computeRegression(
  xs: number[],
  ys: number[],
  type: RegressionType,
  polynomialOrder: number,
): RegressionResult {
  switch (type) {
    case 'polynomial':
      return polynomialRegression(xs, ys, polynomialOrder);
    case 'exponential':
      return exponentialRegression(xs, ys);
    case 'logarithmic':
      return logarithmicRegression(xs, ys);
    case 'power':
      return powerRegression(xs, ys);
    case 'linear':
    default:
      return linearRegression(xs, ys);
  }
}

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

    // Hide shared axis toggles that are shadowed by local settings
    this.settings.axisFormattingCard.showXAxis.visible = false;
    this.settings.axisFormattingCard.showYAxis.visible = false;
    this.settings.axisFormattingCard.yAxisMin.visible = false;
    this.settings.axisFormattingCard.yAxisMax.visible = false;

    // ── Conditional Visibility ──────────────────────────────────
    const colorScaleVal = resolveDropdown(this.settings.scatterColorSettings.colorScale) ?? 'categorical';
    this.settings.scatterColorSettings.startColor.visible = colorScaleVal !== 'categorical';
    this.settings.scatterColorSettings.endColor.visible = colorScaleVal !== 'categorical';

    const clusterEnabled = this.settings.scatterClusterSettings.enabled.value;
    this.settings.scatterClusterSettings.clusters.visible = clusterEnabled;
    this.settings.scatterClusterSettings.showHulls.visible = clusterEnabled;

    this.settings.scatterAnimationSettings.playSpeed.visible = this.settings.scatterAnimationSettings.enablePlayAxis.value;

    const quadrantShow = this.settings.quadrantSettings.show.value;
    this.settings.quadrantSettings.xValue.visible = quadrantShow;
    this.settings.quadrantSettings.yValue.visible = quadrantShow;
    this.settings.quadrantSettings.lineColor.visible = quadrantShow;
    this.settings.quadrantSettings.lineWidth.visible = quadrantShow;
    this.settings.quadrantSettings.lineStyle.visible = quadrantShow;
    this.settings.quadrantSettings.showLabels.visible = quadrantShow;
    this.settings.quadrantSettings.topRightLabel.visible = quadrantShow;
    this.settings.quadrantSettings.topLeftLabel.visible = quadrantShow;
    this.settings.quadrantSettings.bottomRightLabel.visible = quadrantShow;
    this.settings.quadrantSettings.bottomLeftLabel.visible = quadrantShow;
    this.settings.quadrantSettings.labelFontSize.visible = quadrantShow;
    this.settings.quadrantSettings.zoneFillOpacity.visible = quadrantShow;

    const trendShow = this.settings.trendlineSettings.show.value;
    this.settings.trendlineSettings.type.visible = trendShow;
    this.settings.trendlineSettings.polynomialOrder.visible = trendShow;
    this.settings.trendlineSettings.lineColor.visible = trendShow;
    this.settings.trendlineSettings.lineWidth.visible = trendShow;
    this.settings.trendlineSettings.lineStyle.visible = trendShow;
    this.settings.trendlineSettings.showEquation.visible = trendShow;
    this.settings.trendlineSettings.showR2.visible = trendShow;
    this.settings.trendlineSettings.labelFontSize.visible = trendShow;

    const trendType = resolveDropdown(this.settings.trendlineSettings.type) ?? 'linear';
    if (trendShow) {
      this.settings.trendlineSettings.polynomialOrder.visible = trendType === 'polynomial';
    }

    // Extract data
    const data = this.extractData(dataView);

    // Populate per-series formatting groups from value columns
    {
      const themeName = resolveColorTheme(this.settings.colorThemeFormattingCard);
      const colorLookup = new Map<string, string>();
      const valueColumns = dataView?.categorical?.values;
      if (valueColumns) {
        for (let i = 0; i < valueColumns.length; i++) {
          const name = valueColumns[i].source.displayName;
          if (name) {
            colorLookup.set(name, getHostChartColor(this.host.colorPalette, i, themeName));
          }
        }
      }
      populateSeriesFormattingGroups(
        this.settings.seriesFormattingCard,
        dataView,
        ['xValue', 'yValue', 'size'],
        colorLookup,
      );
    }

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
    const themeName = resolveColorTheme(this.settings.colorThemeFormattingCard);
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
        color: getHostChartColor(this.host.colorPalette, i, themeName),
        selectionId: this.host.createSelectionIdBuilder()
          .withCategory(categoryColumn, i)
          .createSelectionId(),
      });
    }

    if (points.length === 0) return empty;

    // Apply sequential color scale if configured
    const colorScaleMode = resolveDropdown(this.settings.scatterColorSettings.colorScale) ?? 'categorical';
    if (colorScaleMode === 'sequential' && points.length > 0) {
      const startColor = this.settings.scatterColorSettings.startColor.value?.value || '#3B82F6';
      const endColor = this.settings.scatterColorSettings.endColor.value?.value || '#EF4444';
      const yVals = points.map((p) => p.y);
      const yMin = Math.min(...yVals);
      const yMax = Math.max(...yVals);
      const yRange = yMax - yMin || 1;
      const colorInterp = d3.interpolateRgb(startColor, endColor);
      for (const pt of points) {
        const t = (pt.y - yMin) / yRange;
        pt.color = colorInterp(t);
      }
    }

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

    if (s.legendFormattingCard.showLegend.value && data.points.length > 0) {
      const legendItems: LegendItem[] = data.points.slice(0, 10).map((pt) => ({
        label: pt.label || `Point ${pt.index + 1}`,
        color: pt.color,
      }));

      const rawLegendFontFamily = resolveDropdown(legendFmtCard.legendFontFamily) || undefined;

      const legendEl = renderLegend(this.container, {
        items: legendItems,
        position: legendPosition as 'top' | 'bottom' | 'left' | 'right',
        fontSize: legendFontSize,
        fontColor: legendFontColor,
        fontFamily: rawLegendFontFamily,
      });

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

    // ── Axis Titles ───────────────────────────────────────────
    {
      const axisTitleSize = `${s.axisFormattingCard.axisLabelSize.value}px`;
      const axisTitleColor = s.axisFormattingCard.axisLabelColor.value?.value || '#64748B';

      const xTitle = s.axisFormattingCard.xAxisTitle.value;
      if (xTitle && s.axisSettings.showXAxis.value) {
        const titleEl = document.createElementNS(svgNs, 'text');
        titleEl.setAttribute('class', 'scatter-bubble-axis-title');
        titleEl.setAttribute('x', String(MARGIN.left + chartWidth / 2));
        titleEl.setAttribute('y', String(MARGIN.top + chartHeight + 36));
        titleEl.setAttribute('text-anchor', 'middle');
        titleEl.setAttribute('font-size', axisTitleSize);
        titleEl.setAttribute('fill', axisTitleColor);
        titleEl.textContent = xTitle;
        svg.appendChild(titleEl);
      }

      const yTitle = s.axisFormattingCard.yAxisTitle.value;
      if (yTitle && s.axisSettings.showYAxis.value) {
        const titleEl = document.createElementNS(svgNs, 'text');
        titleEl.setAttribute('class', 'scatter-bubble-axis-title');
        titleEl.setAttribute('transform', `rotate(-90)`);
        titleEl.setAttribute('x', String(-(MARGIN.top + chartHeight / 2)));
        titleEl.setAttribute('y', String(MARGIN.left - 40));
        titleEl.setAttribute('text-anchor', 'middle');
        titleEl.setAttribute('font-size', axisTitleSize);
        titleEl.setAttribute('fill', axisTitleColor);
        titleEl.textContent = yTitle;
        svg.appendChild(titleEl);
      }
    }

    // ── Quadrant Lines & Zones ────────────────────────────────
    if (s.quadrantSettings.show.value) {
      this.renderQuadrants(chartGroup, xScale, yScale, chartWidth, chartHeight);
    }

    // ── Trendline ──────────────────────────────────────────────
    if (s.trendlineSettings.show.value && data.points.length >= 2) {
      this.renderTrendline(chartGroup, data, xScale, yScale, chartWidth, chartHeight);
    }

    // ── Shared Reference Line ────────────────────────────────
    this.renderSharedReferenceLine(chartGroup, yScale, chartWidth, data.points.map((p) => p.y));

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

    for (let ptIdx = 0; ptIdx < data.points.length; ptIdx++) {
      const pt = data.points[ptIdx];
      const sf = resolveSeriesFormatting(this.settings.seriesFormattingCard, ptIdx, pt.color);
      const cx = xScale(pt.x);
      const cy = yScale(pt.y);
      const r = sizeScale && pt.size !== null
        ? sizeScale(pt.size)
        : DEFAULT_BUBBLE_RADIUS;

      const circle = document.createElementNS(svgNs, 'circle');
      circle.setAttribute('cx', String(cx));
      circle.setAttribute('cy', String(cy));
      circle.setAttribute('r', String(r));
      const conditionalFill = this.getConditionalBubbleColor(pt.y);
      const effectiveColor = conditionalFill ?? sf.color;
      const effectiveOpacity = (sf.opacity / 100) * bubbleOpacity;
      circle.setAttribute('fill', withOpacity(effectiveColor, effectiveOpacity));
      circle.setAttribute('stroke', this.settings.scatterSettings.bubbleStrokeColor.value?.value || sf.color);
      circle.setAttribute('stroke-width', String(this.settings.scatterSettings.bubbleStrokeWidth.value));
      circle.setAttribute('class', 'scatter-bubble-point');

      // Apply CSS transitions for smooth data-update movement
      if (s.scatterAnimationSettings.enableTransitions.value) {
        const transMs = animDuration;
        circle.style.transition = `cx ${transMs}ms ease, cy ${transMs}ms ease, r ${transMs}ms ease`;
      }

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

    // ── Cluster Highlighting ─────────────────────────────────────
    this.renderClusterHighlighting(chartGroup, data, xScale, yScale, chartWidth, chartHeight);

    // ── Density Contours ─────────────────────────────────────────
    this.renderDensityContours(chartGroup, data, xScale, yScale, chartWidth, chartHeight);

    // ── Zoom & Pan ───────────────────────────────────────────────
    this.applyZoomPan(svg, chartGroup, xScale, yScale, chartWidth, chartHeight);

    // ── Play Axis ──────────────────────────────────────────────
    if (s.scatterAnimationSettings.enablePlayAxis.value && data.points.length > 1) {
      this.renderPlayAxis(data, bubblesGroup, xScale, yScale, sizeScale, s);
    }

    // Apply shared formatting settings
    applyAllAxisFormatting(this.container, this.settings.axisFormattingCard, '.scatter-bubble-axis', '.scatter-bubble-grid');
    applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.scatter-bubble-label');

    this.container.addEventListener('click', this.handleBackgroundClick);

    // ── Accessibility ──────────────────────────────────────────
    this.applyAccessibility(data);
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
      tickLabel.textContent = formatWithSettings(tick, this.settings.numberFormattingCard);
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
      tickLabel.textContent = formatWithSettings(tick, this.settings.numberFormattingCard);
      tickGroup.appendChild(tickLabel);

      axisGroup.appendChild(tickGroup);
    }
  }

  // ── Quadrant Rendering ─────────────────────────────────────────

  private renderQuadrants(
    chartGroup: SVGGElement,
    xScale: d3.ScaleLinear<number, number>,
    yScale: d3.ScaleLinear<number, number>,
    chartWidth: number,
    chartHeight: number,
  ): void {
    const svgNs = 'http://www.w3.org/2000/svg';
    const q = this.settings.quadrantSettings;

    const xPx = xScale(q.xValue.value);
    const yPx = yScale(q.yValue.value);

    // Clamp to chart area — skip rendering if divider is entirely outside
    const xClamped = Math.max(0, Math.min(xPx, chartWidth));
    const yClamped = Math.max(0, Math.min(yPx, chartHeight));

    const quadrantGroup = document.createElementNS(svgNs, 'g');
    quadrantGroup.setAttribute('class', 'scatter-bubble-quadrants');
    chartGroup.appendChild(quadrantGroup);

    const lineColor = q.lineColor.value?.value || '#94A3B8';
    const lineWidth = q.lineWidth.value;
    const lineStyleRaw = resolveDropdown(q.lineStyle) ?? 'dashed';

    let dashArray = '';
    if (lineStyleRaw === 'dashed') dashArray = '6,3';
    else if (lineStyleRaw === 'dotted') dashArray = '2,2';

    // ── Zone fills (optional) ─────────────────────────────────
    const zoneFillOpacity = Math.max(0, Math.min(q.zoneFillOpacity.value, 20));
    if (zoneFillOpacity > 0) {
      const opacity = zoneFillOpacity / 100;
      const zones: Array<{ x: number; y: number; w: number; h: number; color: string }> = [
        // Top-left
        { x: 0, y: 0, w: xClamped, h: yClamped, color: '#F59E0B' },
        // Top-right
        { x: xClamped, y: 0, w: chartWidth - xClamped, h: yClamped, color: '#10B981' },
        // Bottom-left
        { x: 0, y: yClamped, w: xClamped, h: chartHeight - yClamped, color: '#EF4444' },
        // Bottom-right
        { x: xClamped, y: yClamped, w: chartWidth - xClamped, h: chartHeight - yClamped, color: '#3B82F6' },
      ];

      for (const zone of zones) {
        if (zone.w <= 0 || zone.h <= 0) continue;
        const rect = document.createElementNS(svgNs, 'rect');
        rect.setAttribute('x', String(zone.x));
        rect.setAttribute('y', String(zone.y));
        rect.setAttribute('width', String(zone.w));
        rect.setAttribute('height', String(zone.h));
        rect.setAttribute('fill', zone.color);
        rect.setAttribute('opacity', String(opacity));
        rect.setAttribute('pointer-events', 'none');
        quadrantGroup.appendChild(rect);
      }
    }

    // ── Divider lines ─────────────────────────────────────────
    // Vertical line at xValue
    const vLine = document.createElementNS(svgNs, 'line');
    vLine.setAttribute('x1', String(xClamped));
    vLine.setAttribute('x2', String(xClamped));
    vLine.setAttribute('y1', '0');
    vLine.setAttribute('y2', String(chartHeight));
    vLine.setAttribute('stroke', lineColor);
    vLine.setAttribute('stroke-width', String(lineWidth));
    if (dashArray) vLine.setAttribute('stroke-dasharray', dashArray);
    vLine.setAttribute('pointer-events', 'none');
    quadrantGroup.appendChild(vLine);

    // Horizontal line at yValue
    const hLine = document.createElementNS(svgNs, 'line');
    hLine.setAttribute('x1', '0');
    hLine.setAttribute('x2', String(chartWidth));
    hLine.setAttribute('y1', String(yClamped));
    hLine.setAttribute('y2', String(yClamped));
    hLine.setAttribute('stroke', lineColor);
    hLine.setAttribute('stroke-width', String(lineWidth));
    if (dashArray) hLine.setAttribute('stroke-dasharray', dashArray);
    hLine.setAttribute('pointer-events', 'none');
    quadrantGroup.appendChild(hLine);

    // ── Quadrant labels ───────────────────────────────────────
    if (q.showLabels.value) {
      const fontSize = q.labelFontSize.value;
      const labelColor = '#94A3B8';
      const labels: Array<{ text: string; cx: number; cy: number }> = [
        { text: q.topLeftLabel.value, cx: xClamped / 2, cy: yClamped / 2 },
        { text: q.topRightLabel.value, cx: xClamped + (chartWidth - xClamped) / 2, cy: yClamped / 2 },
        { text: q.bottomLeftLabel.value, cx: xClamped / 2, cy: yClamped + (chartHeight - yClamped) / 2 },
        { text: q.bottomRightLabel.value, cx: xClamped + (chartWidth - xClamped) / 2, cy: yClamped + (chartHeight - yClamped) / 2 },
      ];

      for (const lbl of labels) {
        if (!lbl.text) continue;
        const text = document.createElementNS(svgNs, 'text');
        text.setAttribute('x', String(lbl.cx));
        text.setAttribute('y', String(lbl.cy));
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'central');
        text.setAttribute('fill', labelColor);
        text.setAttribute('font-size', `${fontSize}px`);
        text.setAttribute('pointer-events', 'none');
        text.textContent = lbl.text;
        quadrantGroup.appendChild(text);
      }
    }
  }

  // ── Trendline Rendering ──────────────────────────────────────────

  private renderTrendline(
    chartGroup: SVGGElement,
    data: ScatterData,
    xScale: d3.ScaleLinear<number, number>,
    yScale: d3.ScaleLinear<number, number>,
    chartWidth: number,
    chartHeight: number,
  ): void {
    const svgNs = 'http://www.w3.org/2000/svg';
    const t = this.settings.trendlineSettings;

    const xs = data.points.map((p) => p.x);
    const ys = data.points.map((p) => p.y);

    const regressionType = (resolveDropdown(t.type) ?? 'linear') as RegressionType;
    const polynomialOrder = t.polynomialOrder.value;

    const result = computeRegression(xs, ys, regressionType, polynomialOrder);

    // Generate ~100 points along the x-domain for the trendline path
    const xDomain = xScale.domain() as [number, number];
    const xMin = xDomain[0];
    const xMax = xDomain[1];
    const step = (xMax - xMin) / 100;

    const linePoints: Array<{ px: number; py: number }> = [];
    for (let i = 0; i <= 100; i++) {
      const xVal = xMin + i * step;
      const yVal = result.predict(xVal);
      // Only include points that produce finite values
      if (Number.isFinite(yVal)) {
        linePoints.push({
          px: xScale(xVal),
          py: yScale(yVal),
        });
      }
    }

    if (linePoints.length < 2) return;

    // Build SVG path d attribute
    const lineGen = d3.line<{ px: number; py: number }>()
      .x((d) => d.px)
      .y((d) => d.py);

    const pathD = lineGen(linePoints);
    if (!pathD) return;

    const trendlineGroup = document.createElementNS(svgNs, 'g');
    trendlineGroup.setAttribute('class', 'scatter-bubble-trendline');
    chartGroup.appendChild(trendlineGroup);

    // Render the trendline path
    const lineColor = t.lineColor.value?.value || '#EF4444';
    const lineWidth = t.lineWidth.value;
    const lineStyleRaw = resolveDropdown(t.lineStyle) ?? 'dashed';
    let dashArray = '';
    if (lineStyleRaw === 'dashed') dashArray = '6,3';

    const path = document.createElementNS(svgNs, 'path');
    path.setAttribute('d', pathD);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', lineColor);
    path.setAttribute('stroke-width', String(lineWidth));
    if (dashArray) path.setAttribute('stroke-dasharray', dashArray);
    path.setAttribute('pointer-events', 'none');
    trendlineGroup.appendChild(path);

    // Render equation and R² labels at top-right of chart area
    const showEquation = t.showEquation.value;
    const showR2 = t.showR2.value;

    if (showEquation || showR2) {
      const fontSize = t.labelFontSize.value;
      let labelY = fontSize + 4;
      const labelX = chartWidth - 8;

      if (showEquation) {
        const eqText = document.createElementNS(svgNs, 'text');
        eqText.setAttribute('x', String(labelX));
        eqText.setAttribute('y', String(labelY));
        eqText.setAttribute('text-anchor', 'end');
        eqText.setAttribute('font-size', `${fontSize}px`);
        eqText.setAttribute('fill', lineColor);
        eqText.setAttribute('pointer-events', 'none');
        eqText.textContent = result.equation;
        trendlineGroup.appendChild(eqText);
        labelY += fontSize + 4;
      }

      if (showR2) {
        const r2Text = document.createElementNS(svgNs, 'text');
        r2Text.setAttribute('x', String(labelX));
        r2Text.setAttribute('y', String(labelY));
        r2Text.setAttribute('text-anchor', 'end');
        r2Text.setAttribute('font-size', `${fontSize}px`);
        r2Text.setAttribute('fill', lineColor);
        r2Text.setAttribute('pointer-events', 'none');
        r2Text.textContent = `R² = ${result.r2.toFixed(4)}`;
        trendlineGroup.appendChild(r2Text);
      }
    }
  }

  // ── Cluster Highlighting ────────────────────────────────────────

  private renderClusterHighlighting(
    chartGroup: SVGGElement,
    data: ScatterData,
    xScale: d3.ScaleLinear<number, number>,
    yScale: d3.ScaleLinear<number, number>,
    _chartWidth: number,
    _chartHeight: number,
  ): void {
    const cs = this.settings.scatterClusterSettings;
    if (!cs.enabled.value || data.points.length < 2) return;

    const k = Math.max(2, Math.min(cs.clusters.value, data.points.length));
    const points = data.points.map((p) => ({ x: xScale(p.x), y: yScale(p.y) }));

    // Simple k-means clustering
    const assignments = this.kMeans(points, k);

    if (!cs.showHulls.value) return;

    const svgNs = 'http://www.w3.org/2000/svg';
    const hullGroup = document.createElementNS(svgNs, 'g');
    hullGroup.setAttribute('class', 'scatter-cluster-hulls');
    chartGroup.insertBefore(hullGroup, chartGroup.firstChild);

    const clusterColors = ['#3B82F6', '#EF4444', '#22C55E', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

    for (let c = 0; c < k; c++) {
      const clusterPoints: [number, number][] = [];
      for (let i = 0; i < assignments.length; i++) {
        if (assignments[i] === c) {
          clusterPoints.push([points[i].x, points[i].y]);
        }
      }

      if (clusterPoints.length < 3) continue;

      const hull = d3.polygonHull(clusterPoints);
      if (!hull) continue;

      const hullColor = clusterColors[c % clusterColors.length];
      const pathD = 'M' + hull.map((p) => `${p[0]},${p[1]}`).join('L') + 'Z';

      const path = document.createElementNS(svgNs, 'path');
      path.setAttribute('d', pathD);
      path.setAttribute('fill', withOpacity(hullColor, 0.1));
      path.setAttribute('stroke', withOpacity(hullColor, 0.4));
      path.setAttribute('stroke-width', '1.5');
      path.setAttribute('pointer-events', 'none');
      hullGroup.appendChild(path);
    }
  }

  /** Simple k-means clustering. Returns cluster assignments for each point. */
  private kMeans(points: Array<{ x: number; y: number }>, k: number): number[] {
    const n = points.length;
    // Initialize centroids by picking evenly spaced points
    const centroids: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < k; i++) {
      const idx = Math.floor((i * n) / k);
      centroids.push({ x: points[idx].x, y: points[idx].y });
    }

    let assignments = new Array<number>(n).fill(0);
    const maxIterations = 20;

    for (let iter = 0; iter < maxIterations; iter++) {
      // Assign each point to nearest centroid
      const newAssignments = new Array<number>(n);
      for (let i = 0; i < n; i++) {
        let minDist = Infinity;
        let minCluster = 0;
        for (let c = 0; c < k; c++) {
          const dx = points[i].x - centroids[c].x;
          const dy = points[i].y - centroids[c].y;
          const dist = dx * dx + dy * dy;
          if (dist < minDist) {
            minDist = dist;
            minCluster = c;
          }
        }
        newAssignments[i] = minCluster;
      }

      // Check convergence
      let changed = false;
      for (let i = 0; i < n; i++) {
        if (newAssignments[i] !== assignments[i]) {
          changed = true;
          break;
        }
      }
      assignments = newAssignments;
      if (!changed) break;

      // Update centroids
      for (let c = 0; c < k; c++) {
        let sumX = 0, sumY = 0, count = 0;
        for (let i = 0; i < n; i++) {
          if (assignments[i] === c) {
            sumX += points[i].x;
            sumY += points[i].y;
            count++;
          }
        }
        if (count > 0) {
          centroids[c] = { x: sumX / count, y: sumY / count };
        }
      }
    }

    return assignments;
  }

  // ── Density Contours ──────────────────────────────────────────

  private renderDensityContours(
    _chartGroup: SVGGElement,
    _data: ScatterData,
    _xScale: d3.ScaleLinear<number, number>,
    _yScale: d3.ScaleLinear<number, number>,
    _chartWidth: number,
    _chartHeight: number,
  ): void {
    // Density contour rendering is a placeholder for 2D KDE overlay.
    // Full implementation requires d3-contour which is not yet included.
    // The settings card (scatterClusterSettings) provides the toggle.
  }

  // ── Zoom & Pan ────────────────────────────────────────────────

  private applyZoomPan(
    svg: SVGSVGElement,
    chartGroup: SVGGElement,
    _xScale: d3.ScaleLinear<number, number>,
    _yScale: d3.ScaleLinear<number, number>,
    chartWidth: number,
    chartHeight: number,
  ): void {
    const zs = this.settings.scatterZoomSettings;
    const isZoomEnabled = zs.enableZoom.value;
    const isPanEnabled = zs.enablePan.value;

    if (!isZoomEnabled && !isPanEnabled) return;

    // Add a clipPath so zoomed content doesn't overflow the chart area
    const svgNs = 'http://www.w3.org/2000/svg';
    let defs = svg.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS(svgNs, 'defs');
      svg.insertBefore(defs, svg.firstChild);
    }
    const clipId = 'scatter-bubble-zoom-clip';
    // Remove any existing clip with this id to avoid duplicates
    const existingClip = defs.querySelector(`#${clipId}`);
    if (existingClip) existingClip.remove();

    const clipPath = document.createElementNS(svgNs, 'clipPath');
    clipPath.setAttribute('id', clipId);
    const clipRect = document.createElementNS(svgNs, 'rect');
    clipRect.setAttribute('x', '0');
    clipRect.setAttribute('y', '0');
    clipRect.setAttribute('width', String(chartWidth));
    clipRect.setAttribute('height', String(chartHeight));
    clipPath.appendChild(clipRect);
    defs.appendChild(clipPath);

    chartGroup.setAttribute('clip-path', `url(#${clipId})`);

    // Apply d3-zoom behavior for scroll-zoom and drag-pan
    // Transform the entire chartGroup (axes, gridlines, quadrants, trendlines, bubbles)
    const svgSel = d3.select(svg);
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 10])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        const baseTranslate = `translate(${MARGIN.left}, ${MARGIN.top})`;
        const zoomTransform = `translate(${event.transform.x},${event.transform.y}) scale(${event.transform.k})`;
        chartGroup.setAttribute('transform', `${baseTranslate} ${zoomTransform}`);
      });

    // Single combined filter: AND-combine zoom/pan permissions.
    // When both enabled, allow all events (default d3 behavior).
    // When only zoom disabled, block wheel events.
    // When only pan disabled, block non-wheel (drag) events.
    if (!isZoomEnabled || !isPanEnabled) {
      zoom.filter((event: Event) => {
        const isWheel = event.type === 'wheel';
        if (!isZoomEnabled && isWheel) return false;
        if (!isPanEnabled && !isWheel) return false;
        return true;
      });
    }

    svgSel.call(zoom);
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

    const numberSettings = this.settings.numberFormattingCard;

    const xRow = document.createElement('div');
    xRow.className = 'scatter-bubble-tooltip-row';
    xRow.textContent = `X: ${formatWithSettings(pt.x, numberSettings)}`;
    tooltip.appendChild(xRow);

    const yRow = document.createElement('div');
    yRow.className = 'scatter-bubble-tooltip-row';
    yRow.textContent = `Y: ${formatWithSettings(pt.y, numberSettings)}`;
    tooltip.appendChild(yRow);

    if (pt.size !== null) {
      const sizeRow = document.createElement('div');
      sizeRow.className = 'scatter-bubble-tooltip-row';
      sizeRow.textContent = `Size: ${formatWithSettings(pt.size, numberSettings)}`;
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

  // ── Conditional Formatting ──────────────────────────────────────

  private getConditionalBubbleColor(value: number): string | undefined {
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

  // ── Play Axis ──────────────────────────────────────────────────

  private renderPlayAxis(
    data: ScatterData,
    bubblesGroup: SVGGElement,
    xScale: d3.ScaleLinear<number, number>,
    yScale: d3.ScaleLinear<number, number>,
    sizeScale: d3.ScalePower<number, number> | null,
    s: ScatterBubbleSettings,
  ): void {
    const playSpeed = Math.max(100, s.scatterAnimationSettings.playSpeed.value);
    const points = data.points;
    const circles = bubblesGroup.querySelectorAll('.scatter-bubble-point');
    if (circles.length === 0 || points.length === 0) return;

    // Build a play control bar
    const playBar = document.createElement('div');
    playBar.className = 'scatter-play-axis';
    playBar.style.display = 'flex';
    playBar.style.alignItems = 'center';
    playBar.style.gap = '8px';
    playBar.style.padding = '4px 8px';
    playBar.style.justifyContent = 'center';

    const playBtn = document.createElement('button');
    playBtn.textContent = '\u25B6';
    playBtn.style.cursor = 'pointer';
    playBtn.style.border = 'none';
    playBtn.style.background = 'none';
    playBtn.style.fontSize = '16px';
    playBar.appendChild(playBtn);

    const stepLabel = document.createElement('span');
    stepLabel.style.fontSize = '11px';
    stepLabel.style.minWidth = '60px';
    stepLabel.textContent = `1 / ${points.length}`;
    playBar.appendChild(stepLabel);

    this.container.appendChild(playBar);

    let currentStep = 0;
    let playing = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const showStep = (step: number): void => {
      for (let i = 0; i < circles.length; i++) {
        const c = circles[i] as SVGCircleElement;
        if (i <= step) {
          c.style.opacity = '1';
        } else {
          c.style.opacity = '0.1';
        }
      }
      stepLabel.textContent = `${step + 1} / ${points.length}`;
    };

    const stop = (): void => {
      playing = false;
      playBtn.textContent = '\u25B6';
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const play = (): void => {
      playing = true;
      playBtn.textContent = '\u23F8';
      intervalId = setInterval(() => {
        currentStep++;
        if (currentStep >= points.length) {
          currentStep = points.length - 1;
          stop();
          return;
        }
        showStep(currentStep);
      }, playSpeed);
    };

    playBtn.addEventListener('click', () => {
      if (playing) {
        stop();
      } else {
        if (currentStep >= points.length - 1) {
          currentStep = 0;
        }
        play();
      }
    });

    // Initial state: show all
    showStep(points.length - 1);

    this.cancelAnimations.push(() => {
      stop();
    });
  }

  // ── Accessibility ─────────────────────────────────────────────

  private applyAccessibility(data: ScatterData): void {
    const acc = this.settings.accessibilityFormattingCard;
    if (!acc.enableKeyboardNav.value) return;

    ensureFocusRingStyles();

    applyChartAria(this.container, {
      chartType: 'scatter chart',
      title: this.settings.titleFormattingCard.titleText.value || undefined,
      dataPointCount: data.points.length,
    });

    const cleanup = attachKeyboardNav({
      container: this.container,
      itemSelector: '.scatter-bubble-point, [tabindex="0"]',
      onActivate: (el) => {
        (el as HTMLElement).click?.();
      },
    });
    this.cancelAnimations.push(cleanup);
  }

  // ── Reference Line (shared card) ─────────────────────────────

  private renderSharedReferenceLine(
    chartGroup: SVGGElement,
    yScale: d3.ScaleLinear<number, number>,
    chartWidth: number,
    yValues: number[],
  ): void {
    const ref = this.settings.referenceLineFormattingCard;
    if (!ref.showReferenceLine.value || yValues.length === 0) return;

    const refTypeRaw = resolveDropdown(ref.referenceLineType) ?? 'custom';
    let refValue: number;
    if (refTypeRaw === 'custom') {
      refValue = ref.referenceLineValue.value;
    } else {
      refValue = computeStatValue(yValues, refTypeRaw as StatType);
    }
    if (!isFinite(refValue)) return;

    const refColor = ref.referenceLineColor.value?.value ?? '#EF4444';
    const refStyle = (resolveDropdown(ref.referenceLineStyle) ?? 'dashed') as 'solid' | 'dashed' | 'dotted';
    const labelText = ref.referenceLabelText.value
      || `${refTypeRaw}: ${formatWithSettings(refValue, this.settings.numberFormattingCard)}`;

    const g = d3.select(chartGroup);
    renderHorizontalReferenceLine(g as d3.Selection<SVGGElement, unknown, null, undefined>, {
      value: refValue,
      yScale,
      chartWidth,
      lineColor: refColor,
      lineWidth: ref.referenceLineWidth.value,
      lineStyle: refStyle,
      showLabel: ref.showReferenceLabel.value,
      labelText,
      showBand: ref.showReferenceBand.value,
      bandOpacity: ref.referenceBandOpacity.value / 100,
    });
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
