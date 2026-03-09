/**
 * Shared reference line, trend line, and target line utilities.
 * Used by bar-chart-pro, morphing-area-chart, box-plot, and others.
 */

import * as d3 from 'd3';

// ── Statistical Computations ─────────────────────────────────────────

export type StatType = 'mean' | 'median' | 'min' | 'max' | 'percentile';

export type TrendType = 'linear' | 'polynomial' | 'exponential' | 'logarithmic' | 'power';

export interface RegressionResult {
  /** Predicted y values at each x index. */
  predicted: number[];
  /** Equation string for display (e.g. "y = 2.3x + 5.1"). */
  equation: string;
  /** R² goodness-of-fit value. */
  r2: number;
}

/**
 * Computes a statistical value from an array of numbers.
 * Returns NaN if data is empty.
 */
export function computeStatValue(
  data: number[],
  type: StatType,
  percentile = 50,
): number {
  if (data.length === 0) return NaN;

  const sorted = [...data].sort((a, b) => a - b);

  switch (type) {
    case 'mean':
      return data.reduce((s, v) => s + v, 0) / data.length;
    case 'median':
      return computePercentile(sorted, 50);
    case 'min':
      return sorted[0];
    case 'max':
      return sorted[sorted.length - 1];
    case 'percentile':
      return computePercentile(sorted, percentile);
  }
}

function computePercentile(sorted: number[], p: number): number {
  const clamped = Math.max(0, Math.min(100, p));
  const idx = (clamped / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * Computes a regression/trend line through (index, value) pairs.
 */
export function computeRegression(
  values: number[],
  type: TrendType = 'linear',
  polynomialOrder = 2,
): RegressionResult {
  const n = values.length;
  if (n === 0) return { predicted: [], equation: '', r2: 0 };

  const xs = values.map((_, i) => i);

  switch (type) {
    case 'linear':
      return linearRegression(xs, values);
    case 'polynomial':
      return polynomialRegression(xs, values, Math.min(polynomialOrder, Math.max(1, n - 1)));
    case 'exponential':
      return exponentialRegression(xs, values);
    case 'logarithmic':
      return logarithmicRegression(xs, values);
    case 'power':
      return powerRegression(xs, values);
  }
}

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
  const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  const intercept = (sumY - slope * sumX) / n;
  const predicted = xs.map((x) => slope * x + intercept);
  const r2 = computeR2(ys, predicted);
  const equation = `y = ${fmtCoeff(slope)}x + ${fmtCoeff(intercept)}`;
  return { predicted, equation, r2 };
}

function polynomialRegression(xs: number[], ys: number[], order: number): RegressionResult {
  // Vandermonde matrix approach
  const n = xs.length;
  const deg = Math.min(order, n - 1);

  // Build normal equations: (X^T X) a = X^T y
  const cols = deg + 1;
  const XTX: number[][] = Array.from({ length: cols }, () => new Array(cols).fill(0));
  const XTy: number[] = new Array(cols).fill(0);

  for (let i = 0; i < n; i++) {
    let xpow = 1;
    for (let j = 0; j < cols; j++) {
      XTy[j] += xpow * ys[i];
      let xpow2 = 1;
      for (let k = 0; k < cols; k++) {
        XTX[j][k] += xpow * xpow2;
        xpow2 *= xs[i];
      }
      xpow *= xs[i];
    }
  }

  // Solve via Gaussian elimination
  const coeffs = solveLinearSystem(XTX, XTy);
  const predicted = xs.map((x) => {
    let val = 0, xpow = 1;
    for (const c of coeffs) {
      val += c * xpow;
      xpow *= x;
    }
    return val;
  });

  const r2 = computeR2(ys, predicted);
  const terms = coeffs.map((c, i) =>
    i === 0 ? fmtCoeff(c) : `${fmtCoeff(c)}x${i > 1 ? `^${i}` : ''}`,
  );
  const equation = `y = ${terms.join(' + ')}`;
  return { predicted, equation, r2 };
}

function exponentialRegression(xs: number[], ys: number[]): RegressionResult {
  // ln(y) = ln(a) + bx → linear regression on log(y)
  const positiveYs = ys.map((y) => (y > 0 ? y : 0.001));
  const logYs = positiveYs.map((y) => Math.log(y));
  const lin = linearRegression(xs, logYs);
  const a = Math.exp(lin.predicted[0] - lin.predicted[0] + (lin.predicted[0])); // a = exp(intercept)
  const intercept = logYs.reduce((s, v) => s + v, 0) / logYs.length -
    (lin.predicted[lin.predicted.length - 1] - lin.predicted[0]) /
      (xs[xs.length - 1] - xs[0] || 1) *
      (xs.reduce((s, v) => s + v, 0) / xs.length);
  const b = xs.length > 1 ? (lin.predicted[1] - lin.predicted[0]) : 0;
  const aVal = Math.exp(intercept);
  const predicted = xs.map((x) => aVal * Math.exp(b * x));
  const r2 = computeR2(ys, predicted);
  const equation = `y = ${fmtCoeff(aVal)}e^(${fmtCoeff(b)}x)`;
  return { predicted, equation, r2 };
}

function logarithmicRegression(xs: number[], ys: number[]): RegressionResult {
  // y = a + b*ln(x)
  const logXs = xs.map((x) => Math.log(Math.max(x, 0.001)));
  const lin = linearRegression(logXs, ys);
  const predicted = xs.map((x) => {
    const lx = Math.log(Math.max(x, 0.001));
    return lin.predicted[0] + (lin.predicted.length > 1 ? (lin.predicted[1] - lin.predicted[0]) * (lx - logXs[0]) / ((logXs[1] || 1) - logXs[0] || 1) : 0);
  });
  // Recompute properly
  const n = xs.length;
  let sumLnX = 0, sumY = 0, sumLnXY = 0, sumLnX2 = 0;
  for (let i = 0; i < n; i++) {
    const lx = Math.log(Math.max(xs[i], 0.001));
    sumLnX += lx;
    sumY += ys[i];
    sumLnXY += lx * ys[i];
    sumLnX2 += lx * lx;
  }
  const denom = n * sumLnX2 - sumLnX * sumLnX;
  const b = denom !== 0 ? (n * sumLnXY - sumLnX * sumY) / denom : 0;
  const a = (sumY - b * sumLnX) / n;
  const pred = xs.map((x) => a + b * Math.log(Math.max(x, 0.001)));
  const r2 = computeR2(ys, pred);
  const equation = `y = ${fmtCoeff(a)} + ${fmtCoeff(b)}ln(x)`;
  return { predicted: pred, equation, r2 };
}

function powerRegression(xs: number[], ys: number[]): RegressionResult {
  // ln(y) = ln(a) + b*ln(x)
  const posXs = xs.map((x) => Math.max(x, 0.001));
  const posYs = ys.map((y) => Math.max(y, 0.001));
  const logXs = posXs.map((x) => Math.log(x));
  const logYs = posYs.map((y) => Math.log(y));
  const lin = linearRegression(logXs, logYs);

  const n = xs.length;
  let sumLnX = 0, sumLnY = 0, sumLnXLnY = 0, sumLnX2 = 0;
  for (let i = 0; i < n; i++) {
    sumLnX += logXs[i];
    sumLnY += logYs[i];
    sumLnXLnY += logXs[i] * logYs[i];
    sumLnX2 += logXs[i] * logXs[i];
  }
  const denom = n * sumLnX2 - sumLnX * sumLnX;
  const b = denom !== 0 ? (n * sumLnXLnY - sumLnX * sumLnY) / denom : 0;
  const a = Math.exp((sumLnY - b * sumLnX) / n);

  const predicted = posXs.map((x) => a * Math.pow(x, b));
  const r2 = computeR2(ys, predicted);
  const equation = `y = ${fmtCoeff(a)}x^${fmtCoeff(b)}`;
  return { predicted, equation, r2 };
}

function computeR2(actual: number[], predicted: number[]): number {
  const n = actual.length;
  if (n === 0) return 0;
  const mean = actual.reduce((s, v) => s + v, 0) / n;
  let ssTot = 0, ssRes = 0;
  for (let i = 0; i < n; i++) {
    ssTot += (actual[i] - mean) ** 2;
    ssRes += (actual[i] - predicted[i]) ** 2;
  }
  return ssTot > 0 ? 1 - ssRes / ssTot : 0;
}

function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = A.length;
  const aug = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    // Partial pivoting
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-12) continue;

    for (let j = col; j <= n; j++) aug[col][j] /= pivot;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = aug[row][col];
      for (let j = col; j <= n; j++) aug[row][j] -= factor * aug[col][j];
    }
  }

  return aug.map((row) => row[n]);
}

function fmtCoeff(v: number): string {
  return Math.abs(v) < 0.01 ? '0' : v.toFixed(2);
}

// ── SVG Rendering ────────────────────────────────────────────────────

export interface ReferenceLineConfig {
  value: number;
  yScale: d3.ScaleLinear<number, number>;
  chartWidth: number;
  lineColor: string;
  lineWidth: number;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  showLabel: boolean;
  labelText: string;
  labelFontSize?: number;
  showBand?: boolean;
  bandUpperValue?: number;
  bandOpacity?: number;
}

export interface VerticalReferenceLineConfig {
  xPosition: number;
  yStart: number;
  yEnd: number;
  lineColor: string;
  lineWidth: number;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  showLabel: boolean;
  labelText: string;
  labelFontSize?: number;
}

export interface TrendLineConfig {
  predicted: number[];
  xScale: (index: number) => number;
  yScale: d3.ScaleLinear<number, number>;
  lineColor: string;
  lineWidth: number;
  showEquation: boolean;
  showR2: boolean;
  equation: string;
  r2: number;
}

export interface TargetLineConfig {
  value: number;
  yScale: d3.ScaleLinear<number, number>;
  chartWidth: number;
  label: string;
  lineColor: string;
  lineWidth: number;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  showLabel: boolean;
  showBand?: boolean;
  bandHalfWidth?: number;
  bandOpacity?: number;
}

function toDashArray(style: string): string {
  switch (style) {
    case 'dashed': return '6 4';
    case 'dotted': return '2 3';
    default: return 'none';
  }
}

/**
 * Renders a horizontal reference line on an SVG chart group.
 * Optionally renders a shaded band and label.
 */
export function renderHorizontalReferenceLine(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  config: ReferenceLineConfig,
): void {
  const y = config.yScale(config.value);
  if (!isFinite(y)) return;

  const group = g.append('g').attr('class', 'reference-line-group');

  // Band
  if (config.showBand && config.bandUpperValue != null) {
    const yUpper = config.yScale(config.bandUpperValue);
    if (isFinite(yUpper)) {
      const yTop = Math.min(y, yUpper);
      const h = Math.abs(yUpper - y);
      group
        .append('rect')
        .attr('class', 'reference-band')
        .attr('x', 0)
        .attr('y', yTop)
        .attr('width', config.chartWidth)
        .attr('height', h)
        .attr('fill', config.lineColor)
        .attr('opacity', config.bandOpacity ?? 0.1);
    }
  }

  // Line
  group
    .append('line')
    .attr('class', 'reference-line')
    .attr('x1', 0)
    .attr('y1', y)
    .attr('x2', config.chartWidth)
    .attr('y2', y)
    .attr('stroke', config.lineColor)
    .attr('stroke-width', config.lineWidth)
    .attr('stroke-dasharray', toDashArray(config.lineStyle));

  // Label
  if (config.showLabel && config.labelText) {
    group
      .append('text')
      .attr('class', 'reference-label')
      .attr('x', config.chartWidth - 4)
      .attr('y', y - 4)
      .attr('text-anchor', 'end')
      .attr('font-size', `${config.labelFontSize ?? 10}px`)
      .attr('fill', config.lineColor)
      .text(config.labelText);
  }
}

/**
 * Renders a vertical reference line on an SVG chart group.
 */
export function renderVerticalReferenceLine(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  config: VerticalReferenceLineConfig,
): void {
  const group = g.append('g').attr('class', 'vertical-reference-line-group');

  group
    .append('line')
    .attr('class', 'vertical-reference-line')
    .attr('x1', config.xPosition)
    .attr('y1', config.yStart)
    .attr('x2', config.xPosition)
    .attr('y2', config.yEnd)
    .attr('stroke', config.lineColor)
    .attr('stroke-width', config.lineWidth)
    .attr('stroke-dasharray', toDashArray(config.lineStyle));

  if (config.showLabel && config.labelText) {
    group
      .append('text')
      .attr('class', 'vertical-reference-label')
      .attr('x', config.xPosition + 4)
      .attr('y', config.yStart + (config.labelFontSize ?? 10) + 2)
      .attr('font-size', `${config.labelFontSize ?? 10}px`)
      .attr('fill', config.lineColor)
      .text(config.labelText);
  }
}

/**
 * Renders a trend/regression line on an SVG chart group.
 */
export function renderTrendLine(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  config: TrendLineConfig,
): void {
  if (config.predicted.length < 2) return;

  const group = g.append('g').attr('class', 'trend-line-group');

  const lineGen = d3
    .line<number>()
    .x((_, i) => config.xScale(i))
    .y((d) => config.yScale(d))
    .curve(d3.curveMonotoneX);

  group
    .append('path')
    .attr('class', 'trend-line')
    .attr('d', lineGen(config.predicted) ?? '')
    .attr('fill', 'none')
    .attr('stroke', config.lineColor)
    .attr('stroke-width', config.lineWidth)
    .attr('stroke-dasharray', '6 3');

  // Equation & R² labels
  const labelY = config.yScale(config.predicted[config.predicted.length - 1]);
  let labelOffset = 0;

  if (config.showEquation && config.equation) {
    group
      .append('text')
      .attr('class', 'trend-equation')
      .attr('x', config.xScale(config.predicted.length - 1))
      .attr('y', labelY - 14)
      .attr('text-anchor', 'end')
      .attr('font-size', '9px')
      .attr('fill', config.lineColor)
      .text(config.equation);
    labelOffset = 12;
  }

  if (config.showR2) {
    group
      .append('text')
      .attr('class', 'trend-r2')
      .attr('x', config.xScale(config.predicted.length - 1))
      .attr('y', labelY - 14 + labelOffset)
      .attr('text-anchor', 'end')
      .attr('font-size', '9px')
      .attr('fill', config.lineColor)
      .text(`R² = ${config.r2.toFixed(4)}`);
  }
}

/**
 * Renders a target line (similar to reference but with target-specific semantics).
 */
export function renderTargetLine(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  config: TargetLineConfig,
): void {
  const y = config.yScale(config.value);
  if (!isFinite(y)) return;

  const group = g.append('g').attr('class', 'target-line-group');

  // Band
  if (config.showBand && config.bandHalfWidth != null) {
    const yTop = config.yScale(config.value + config.bandHalfWidth);
    const yBot = config.yScale(config.value - config.bandHalfWidth);
    if (isFinite(yTop) && isFinite(yBot)) {
      group
        .append('rect')
        .attr('class', 'target-band')
        .attr('x', 0)
        .attr('y', Math.min(yTop, yBot))
        .attr('width', config.chartWidth)
        .attr('height', Math.abs(yBot - yTop))
        .attr('fill', config.lineColor)
        .attr('opacity', config.bandOpacity ?? 0.08);
    }
  }

  // Line
  group
    .append('line')
    .attr('class', 'target-line')
    .attr('x1', 0)
    .attr('y1', y)
    .attr('x2', config.chartWidth)
    .attr('y2', y)
    .attr('stroke', config.lineColor)
    .attr('stroke-width', config.lineWidth)
    .attr('stroke-dasharray', toDashArray(config.lineStyle));

  // Label
  if (config.showLabel && config.label) {
    group
      .append('text')
      .attr('class', 'target-label')
      .attr('x', 4)
      .attr('y', y - 4)
      .attr('font-size', '10px')
      .attr('font-weight', '600')
      .attr('fill', config.lineColor)
      .text(config.label);
  }
}
