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
  applyCardStyle,
  type CardStyleMode,
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
  attachEmptySpaceContextMenu,
  renderHorizontalReferenceLine,
  computeStatValue,
  type StatType,
  resolveSeriesFormatting,
  SeriesFormattingGroup,
  getDateFilterIndices,
  isDateColumn,
  type DateFilterConfig,
  syncLegendFormattingVisibility,
  syncTitleFormattingVisibility,
  syncCardStyleVisibility,
  syncDateFilterFormattingVisibility,
  hideInlineLegendFormatting,
  getLocalizedString,
  getVisualEmptyStateMode,
  renderLandingPage,
  renderNoDataState,
} from '../../core/src';

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataView = powerbi.DataView;
import ISelectionId = powerbi.visuals.ISelectionId;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

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
  highlighted: boolean;
  formattingObjects?: powerbi.DataViewObjects;
}

interface ScatterData {
  points: ScatterPoint[];
  xExtent: [number, number];
  yExtent: [number, number];
  sizeExtent: [number, number] | null;
  isEmpty: boolean;
  hasHighlights: boolean;
}

interface HostHighContrastColors {
  enabled: boolean;
  foreground: string;
  background: string;
  foregroundSelected: string;
  hyperlink: string;
}

interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// ── Constants ────────────────────────────────────────────────────────

const MARGIN: Margin = { top: 20, right: 20, bottom: 40, left: 50 };

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
  private currentData: ScatterData | null = null;
  private emptyStateMode: 'unconfigured' | 'noData' = 'unconfigured';
  private detachEmptySpaceContextMenu: (() => void) | null = null;

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new ScatterBubbleSettings();
    this.formattingSettingsService = new FormattingSettingsService(options.host.createLocalizationManager());
    this.container.classList.add('scatter-bubble-container');
    this.detachEmptySpaceContextMenu = attachEmptySpaceContextMenu(
      this.container,
      this.selectionManager,
      () => this.host.createSelectionIdBuilder().createSelectionId(),
      () => this.allowInteractions(),
    );
  }

  public update(options: VisualUpdateOptions): void {
    this.notifyRenderingStarted(options);
    try {
      // Cancel running animations before re-render
      this.cancelAnimations.forEach((cancel) => cancel());
      this.cancelAnimations = [];

      // Parse settings from dataView
      const dataView = options.dataViews?.[0];
      this.emptyStateMode = getVisualEmptyStateMode(dataView);
      if (dataView) {
        this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
          ScatterBubbleSettings,
          dataView,
        );
      }

      // Migrate legacy enableGlass -> cardStyleMode (backward compat)
      const legacyCardObj = dataView?.metadata?.objects?.['cardSettings'];
      if (legacyCardObj) {
        const legacyGlass = legacyCardObj['enableGlass'];
        const modernCardStyle = legacyCardObj['cardStyleMode'];
        if (modernCardStyle === undefined && legacyGlass === false) {
          this.settings.cardSettings.cardStyleMode.value = { value: 'none', displayName: 'None' };
        }
      }

      // Keep the retired shared trendLineFormatting object as a metadata-only
      // compatibility alias for reports created before the chart-specific card.
      const legacyTrendObj = dataView?.metadata?.objects?.['trendLineFormatting'];
      const modernTrendObj = dataView?.metadata?.objects?.['trendlineSettings'];
      if (legacyTrendObj) {
        if (modernTrendObj?.['show'] === undefined && typeof legacyTrendObj['showTrendLine'] === 'boolean') {
          this.settings.trendlineSettings.show.value = legacyTrendObj['showTrendLine'];
        }
        if (modernTrendObj?.['type'] === undefined) {
          const legacyType = legacyTrendObj['trendLineType'];
          const typeValue = typeof legacyType === 'string'
            ? legacyType
            : (legacyType as { value?: string } | undefined)?.value;
          if (typeValue) {
            this.settings.trendlineSettings.type.value = { value: typeValue, displayName: typeValue };
          }
        }
        if (
          modernTrendObj?.['polynomialOrder'] === undefined
          && typeof legacyTrendObj['polynomialOrder'] === 'number'
        ) {
          this.settings.trendlineSettings.polynomialOrder.value = legacyTrendObj['polynomialOrder'];
        }
        if (modernTrendObj?.['lineColor'] === undefined) {
          const legacyColor = legacyTrendObj['trendLineColor'] as { solid?: { color?: string } } | undefined;
          if (legacyColor?.solid?.color) {
            this.settings.trendlineSettings.lineColor.value = { value: legacyColor.solid.color };
          }
        }
        if (
          modernTrendObj?.['lineWidth'] === undefined
          && typeof legacyTrendObj['trendLineWidth'] === 'number'
        ) {
          this.settings.trendlineSettings.lineWidth.value = legacyTrendObj['trendLineWidth'];
        }
        if (modernTrendObj?.['showEquation'] === undefined && typeof legacyTrendObj['showEquation'] === 'boolean') {
          this.settings.trendlineSettings.showEquation.value = legacyTrendObj['showEquation'];
        }
        if (modernTrendObj?.['showR2'] === undefined && typeof legacyTrendObj['showR2'] === 'boolean') {
          this.settings.trendlineSettings.showR2.value = legacyTrendObj['showR2'];
        }
      }

      syncTitleFormattingVisibility(this.settings.titleFormattingCard);
      syncLegendFormattingVisibility(this.settings.legendFormattingCard);

      // Hide shared axis toggles that are shadowed by local settings

      syncDateFilterFormattingVisibility(this.settings.dateFilterFormattingCard);
      syncCardStyleVisibility(this.settings.cardSettings);

      this.settings.axisFormattingCard.yAxisMin.visible = false;
      this.settings.axisFormattingCard.yAxisMax.visible = false;
      this.settings.axisFormattingCard.integerTicks.visible = false;

      hideInlineLegendFormatting(this.settings.legendFormattingCard);

      // Hide dual-axis-only properties (no combo/dual-axis support)
      this.settings.referenceLineFormattingCard.referenceLineAxis.visible = false;

      // ── Conditional Visibility ──────────────────────────────────
      const showDataLabels = this.settings.dataLabelFormattingCard.showDataLabels.value;
      this.settings.dataLabelFormattingCard.dataLabelFontSize.visible = showDataLabels;
      this.settings.dataLabelFormattingCard.dataLabelFontColor.visible = showDataLabels;
      this.settings.dataLabelFormattingCard.dataLabelFontWeight.visible = showDataLabels;
      this.settings.dataLabelFormattingCard.dataLabelFontFamily.visible = showDataLabels;
      this.settings.dataLabelFormattingCard.dataLabelPosition.visible = showDataLabels;

      const showGridLines = this.settings.axisFormattingCard.showGridLines.value;
      this.settings.axisFormattingCard.xAxisTitle.visible = this.settings.axisFormattingCard.showXAxis.value;
      this.settings.axisFormattingCard.yAxisTitle.visible = this.settings.axisFormattingCard.showYAxis.value;
      this.settings.axisFormattingCard.gridLineColor.visible = showGridLines;
      this.settings.axisFormattingCard.gridLineStyle.visible = showGridLines;
      this.settings.axisFormattingCard.gridLineWidth.visible = showGridLines;
      this.settings.axisFormattingCard.gridLineOpacity.visible = showGridLines;

      const colorScaleVal = resolveDropdown(this.settings.scatterColorSettings.colorScale) ?? 'categorical';
      this.settings.scatterColorSettings.startColor.visible = colorScaleVal !== 'categorical';
      this.settings.scatterColorSettings.endColor.visible = colorScaleVal !== 'categorical';

      const clusterEnabled = this.settings.scatterClusterSettings.enabled.value;
      this.settings.scatterClusterSettings.clusters.visible = clusterEnabled;
      this.settings.scatterClusterSettings.showHulls.visible = clusterEnabled;

      this.settings.animationSettings.duration.visible = this.settings.animationSettings.enabled.value
        || this.settings.animationSettings.enableTransitions.value;
      this.settings.animationSettings.playSpeed.visible = this.settings.animationSettings.enablePlayAxis.value;

      const quadrantShow = this.settings.quadrantSettings.show.value;
      this.settings.quadrantSettings.xValue.visible = quadrantShow;
      this.settings.quadrantSettings.yValue.visible = quadrantShow;
      this.settings.quadrantSettings.lineColor.visible = quadrantShow;
      this.settings.quadrantSettings.lineWidth.visible = quadrantShow;
      this.settings.quadrantSettings.lineStyle.visible = quadrantShow;
      this.settings.quadrantSettings.showLabels.visible = quadrantShow;
      const quadrantLabelsVisible = quadrantShow && this.settings.quadrantSettings.showLabels.value;
      this.settings.quadrantSettings.topRightLabel.visible = quadrantLabelsVisible;
      this.settings.quadrantSettings.topLeftLabel.visible = quadrantLabelsVisible;
      this.settings.quadrantSettings.bottomRightLabel.visible = quadrantLabelsVisible;
      this.settings.quadrantSettings.bottomLeftLabel.visible = quadrantLabelsVisible;
      this.settings.quadrantSettings.labelFontSize.visible = quadrantLabelsVisible;
      this.settings.quadrantSettings.labelFontColor.visible = quadrantLabelsVisible;
      this.settings.quadrantSettings.labelFontFamily.visible = quadrantLabelsVisible;
      this.settings.quadrantSettings.labelFontWeight.visible = quadrantLabelsVisible;
      this.settings.quadrantSettings.zoneFillOpacity.visible = quadrantShow;
      const quadrantFillsVisible = quadrantShow && this.settings.quadrantSettings.zoneFillOpacity.value > 0;
      this.settings.quadrantSettings.zone1Color.visible = quadrantFillsVisible;
      this.settings.quadrantSettings.zone2Color.visible = quadrantFillsVisible;
      this.settings.quadrantSettings.zone3Color.visible = quadrantFillsVisible;
      this.settings.quadrantSettings.zone4Color.visible = quadrantFillsVisible;

      const trendShow = this.settings.trendlineSettings.show.value;
      this.settings.trendlineSettings.type.visible = trendShow;
      this.settings.trendlineSettings.polynomialOrder.visible = trendShow;
      this.settings.trendlineSettings.lineColor.visible = trendShow;
      this.settings.trendlineSettings.lineWidth.visible = trendShow;
      this.settings.trendlineSettings.lineStyle.visible = trendShow;
      this.settings.trendlineSettings.showEquation.visible = trendShow;
      this.settings.trendlineSettings.showR2.visible = trendShow;
      this.settings.trendlineSettings.labelFontSize.visible = trendShow
        && (this.settings.trendlineSettings.showEquation.value || this.settings.trendlineSettings.showR2.value);

      const trendType = resolveDropdown(this.settings.trendlineSettings.type) ?? 'linear';
      if (trendShow) {
        this.settings.trendlineSettings.polynomialOrder.visible = trendType === 'polynomial';
      }

      const showReferenceLine = this.settings.referenceLineFormattingCard.showReferenceLine.value;
      const referenceType = resolveDropdown(this.settings.referenceLineFormattingCard.referenceLineType) ?? 'custom';
      this.settings.referenceLineFormattingCard.referenceLineType.visible = showReferenceLine;
      this.settings.referenceLineFormattingCard.referenceLineValue.visible = showReferenceLine && referenceType === 'custom';
      this.settings.referenceLineFormattingCard.referenceLineColor.visible = showReferenceLine;
      this.settings.referenceLineFormattingCard.referenceLineWidth.visible = showReferenceLine;
      this.settings.referenceLineFormattingCard.referenceLineStyle.visible = showReferenceLine;
      this.settings.referenceLineFormattingCard.showReferenceLabel.visible = showReferenceLine;
      this.settings.referenceLineFormattingCard.referenceLabelText.visible = showReferenceLine && this.settings.referenceLineFormattingCard.showReferenceLabel.value;
      this.settings.referenceLineFormattingCard.showReferenceBand.visible = showReferenceLine;
      const showReferenceBand = showReferenceLine && this.settings.referenceLineFormattingCard.showReferenceBand.value;
      this.settings.referenceLineFormattingCard.referenceBandOpacity.visible = showReferenceBand;
      this.settings.referenceLineFormattingCard.referenceBandWidth.visible = showReferenceBand;

      const conditionalEnabled = this.settings.conditionalFormattingCard.enableConditional.value;
      this.settings.conditionalFormattingCard.conditionalDirection.visible = conditionalEnabled;
      this.settings.conditionalFormattingCard.threshold1.visible = conditionalEnabled;
      this.settings.conditionalFormattingCard.threshold2.visible = conditionalEnabled;
      this.settings.conditionalFormattingCard.conditionalColor1.visible = conditionalEnabled;
      this.settings.conditionalFormattingCard.conditionalColor2.visible = conditionalEnabled;
      this.settings.conditionalFormattingCard.conditionalColor3.visible = conditionalEnabled;

      // Extract data
      const data = this.extractData(dataView);
      this.settings.scatterSettings.maxRadius.visible = data.sizeExtent !== null;

      this.populatePointFormattingGroups(data);

      // Store data for cross-highlight logic
      this.currentData = data;

      // Render
      if (data.isEmpty) {
        this.renderEmpty();
      } else {
        this.render(data, options.viewport);
      }

      // Apply card styling AFTER render — render clears the container, which would destroy the glass backdrop div.
      this.applyCardStyle();

      // Apply cross-highlight dimming after render
      this.applySelectionHighlight();
      this.applyHighContrastStyling(data.isEmpty ? null : data);
      this.notifyRenderingFinished(options);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.notifyRenderingFailed(options, reason);
      throw error;
    }
  }

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  private populatePointFormattingGroups(data: ScatterData): void {
    const card = this.settings.seriesFormattingCard;
    card.groups = [];
    for (let i = 0; i < data.points.length; i++) {
      const point = data.points[i];
      const group = new SeriesFormattingGroup({
        name: `series_${i}`,
        displayName: point.label || `Point ${point.index + 1}`,
      });
      group.seriesColor.value = { value: point.color };
      group.lineStyle.visible = false;
      group.lineWidth.visible = false;
      const selector = point.selectionId.getSelector();
      for (const slice of group.slices) {
        (slice as { selector?: unknown }).selector = selector;
      }
      const objects = point.formattingObjects?.['seriesFormatting'];
      if (objects) {
        const color = objects['seriesColor'] as { solid?: { color?: string } } | undefined;
        if (color?.solid?.color) group.seriesColor.value = { value: color.solid.color };
        if (typeof objects['seriesOpacity'] === 'number') group.seriesOpacity.value = objects['seriesOpacity'];
        if (typeof objects['showDataLabels'] === 'boolean') group.showDataLabels.value = objects['showDataLabels'];
      }
      card.groups.push(group);
    }
  }

  // ── Data Extraction ──────────────────────────────────────────────

  private extractData(dataView: DataView | undefined): ScatterData {
    const themeName = resolveColorTheme(this.settings.colorThemeFormattingCard);
    const highContrast = this.getHighContrastColors();
    const empty: ScatterData = {
      points: [],
      xExtent: [0, 1],
      yExtent: [0, 1],
      sizeExtent: null,
      isEmpty: true,
      hasHighlights: false,
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

    // Read cross-highlight data from value columns
    const xHighlights = xCol.highlights as unknown[] | undefined;
    const yHighlights = yCol.highlights as unknown[] | undefined;

    const dateConfig: DateFilterConfig = {
      enabled: this.settings.dateFilterFormattingCard.enableDateFilter.value,
      startDate: this.settings.dateFilterFormattingCard.startDate.value,
      endAtCurrentDate: this.settings.dateFilterFormattingCard.endAtCurrentDate.value,
      endDate: this.settings.dateFilterFormattingCard.endDate.value,
    };
    const dateIndices = isDateColumn(categoryColumn.source) ? getDateFilterIndices(categoryColumn.values, dateConfig) : null;

    const points: ScatterPoint[] = [];
    const count = categoryColumn.values.length;

    for (let i = 0; i < count; i++) {
      if (dateIndices && !dateIndices.has(i)) continue;
      const xRaw = xCol.values[i];
      const yRaw = yCol.values[i];

      if (typeof xRaw !== 'number' || typeof yRaw !== 'number') continue;
      if (Number.isNaN(xRaw) || Number.isNaN(yRaw)) continue;

      const sizeRaw = sizeCol ? sizeCol.values[i] : null;
      const sizeVal = typeof sizeRaw === 'number' && !Number.isNaN(sizeRaw) ? sizeRaw : null;

      const label = categoryColumn.values[i] !== null && categoryColumn.values[i] !== undefined
        ? String(categoryColumn.values[i])
        : '';

      // A point is highlighted if its highlight value is non-null in any value column
      const xHl = xHighlights ? xHighlights[i] : undefined;
      const yHl = yHighlights ? yHighlights[i] : undefined;
      const isHighlighted = xHl != null || yHl != null;

      points.push({
        label,
        x: xRaw,
        y: yRaw,
        size: sizeVal,
        index: i,
        color: highContrast.enabled
          ? highContrast.foreground
          : getHostChartColor(this.host.colorPalette, i, themeName),
        selectionId: this.host.createSelectionIdBuilder()
          .withCategory(categoryColumn, i)
          .createSelectionId(),
        highlighted: isHighlighted,
        formattingObjects: categoryColumn.objects?.[i],
      });
    }

    if (points.length === 0) return empty;

    // Apply sequential color scale if configured
    const colorScaleMode = resolveDropdown(this.settings.scatterColorSettings.colorScale) ?? 'categorical';
    if (!highContrast.enabled && colorScaleMode === 'sequential' && points.length > 0) {
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

    const hasHighlights = points.some((p) => p.highlighted);
    return { points, xExtent, yExtent, sizeExtent, isEmpty: false, hasHighlights };
  }

  // ── Card Style ─────────────────────────────────────────────────

  private applyCardStyle(): void {
    const s = this.settings.cardSettings;
    const mode = (resolveDropdown(s.cardStyleMode) ?? 'glass') as CardStyleMode;
    applyCardStyle(this.container, {
      mode,
      opacity: s.backgroundOpacity.value / 100,
      backgroundColor: s.backgroundColor.value?.value,
      borderRadius: s.borderRadius.value,
    });
    const contentPadding = Math.max(0, s.contentPadding.value);
    this.container.style.boxSizing = 'border-box';
    this.container.style.padding = `${contentPadding}px`;
    this.container.style.color = '';
  }

  // ── Empty State ────────────────────────────────────────────────

  private renderEmpty(): void {
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    if (this.emptyStateMode === 'noData') {
      renderNoDataState(
        this.container,
        getLocalizedString(this.host, 'ScatterBubble_NoDataState', 'No data for the current selection.'),
        this.getHighContrastColors(),
      );
      return;
    }
    renderLandingPage(this.container, {
      title: getLocalizedString(this.host, 'ScatterBubble_LandingTitle', 'Add data to build a scatter plot'),
      description: getLocalizedString(
        this.host,
        'ScatterBubble_LandingDescription',
        'Compare two measures on X and Y, then optionally size bubbles with a third measure.',
      ),
      steps: [
        getLocalizedString(this.host, 'ScatterBubble_LandingStepCategory', 'Add a category to label each point.'),
        getLocalizedString(this.host, 'ScatterBubble_LandingStepValues', 'Add X and Y measures to position the points.'),
        getLocalizedString(this.host, 'ScatterBubble_LandingStepSize', 'Optionally add Size to scale bubble area.'),
      ],
      hint: getLocalizedString(
        this.host,
        'ScatterBubble_LandingHint',
        'Use quadrants, trend lines, clustering, or playback when the data calls for them.',
      ),
    }, this.getHighContrastColors());
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
    const highContrast = this.getHighContrastColors();
    const interactionsEnabled = this.allowInteractions();
    const contentPadding = Math.max(0, s.cardSettings.contentPadding.value);
    const chartWidth = width - MARGIN.left - MARGIN.right - (contentPadding * 2);
    const chartHeight = height - MARGIN.top - MARGIN.bottom - (contentPadding * 2);

    if (chartWidth <= 0 || chartHeight <= 0) return;

    // ── Legend ──────────────────────────────────────────────────
    const legendFmtCard = s.legendFormattingCard;
    const legendFontColor = highContrast.enabled
      ? highContrast.foreground
      : (legendFmtCard.legendFontColor.value?.value || '#1E293B');
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
        fontWeight: resolveDropdown(legendFmtCard.legendFontWeight) || 'normal',
        aliases: legendFmtCard.legendAliases.value,
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
    chartGroup.setAttribute('transform', `translate(${MARGIN.left + contentPadding}, ${MARGIN.top + contentPadding})`);
    svg.appendChild(chartGroup);

    // ── Scales ─────────────────────────────────────────────────
    const xScale = d3.scaleLinear()
      .domain(data.xExtent)
      .range([0, chartWidth]);

    const yScale = d3.scaleLinear()
      .domain(data.yExtent)
      .range([chartHeight, 0]);

    const minRadius = Math.max(0, Math.min(s.scatterSettings.minRadius.value, s.scatterSettings.maxRadius.value));
    const maxRadius = Math.max(minRadius, s.scatterSettings.maxRadius.value);

    const sizeScale = data.sizeExtent
      ? d3.scaleSqrt()
          .domain(data.sizeExtent)
          .range([minRadius, maxRadius])
      : null;

    const bubbleOpacity = s.scatterSettings.opacity.value / 100;

    // ── Grid lines ─────────────────────────────────────────────
    if (s.axisFormattingCard.showGridLines.value) {
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
    if (s.axisFormattingCard.showXAxis.value) {
      this.renderXAxis(svg, xScale, chartWidth, chartHeight, contentPadding);
    }

    if (s.axisFormattingCard.showYAxis.value) {
      this.renderYAxis(svg, yScale, chartHeight, contentPadding);
    }

    // ── Axis Titles ───────────────────────────────────────────
    {
      const axisTitleSize = `${s.axisFormattingCard.axisLabelSize.value}px`;
      const axisTitleColor = highContrast.enabled
        ? highContrast.foreground
        : (s.axisFormattingCard.axisLabelColor.value?.value || '#64748B');

      const xTitle = s.axisFormattingCard.xAxisTitle.value;
      if (xTitle && s.axisFormattingCard.showXAxis.value) {
        const titleEl = document.createElementNS(svgNs, 'text');
        titleEl.setAttribute('class', 'scatter-bubble-axis-title');
        titleEl.setAttribute('x', String(MARGIN.left + contentPadding + chartWidth / 2));
        titleEl.setAttribute('y', String(MARGIN.top + contentPadding + chartHeight + 36));
        titleEl.setAttribute('text-anchor', 'middle');
        titleEl.setAttribute('font-size', axisTitleSize);
        titleEl.setAttribute('fill', axisTitleColor);
        const titleFont = resolveDropdown(s.axisFormattingCard.axisLabelFontFamily);
        const titleWeight = resolveDropdown(s.axisFormattingCard.axisLabelFontWeight);
        if (titleFont) titleEl.setAttribute('font-family', titleFont);
        if (titleWeight) titleEl.setAttribute('font-weight', titleWeight);
        titleEl.textContent = xTitle;
        svg.appendChild(titleEl);
      }

      const yTitle = s.axisFormattingCard.yAxisTitle.value;
      if (yTitle && s.axisFormattingCard.showYAxis.value) {
        const titleEl = document.createElementNS(svgNs, 'text');
        titleEl.setAttribute('class', 'scatter-bubble-axis-title');
        titleEl.setAttribute('transform', `rotate(-90)`);
        titleEl.setAttribute('x', String(-(MARGIN.top + contentPadding + chartHeight / 2)));
        titleEl.setAttribute('y', String(MARGIN.left + contentPadding - 40));
        titleEl.setAttribute('text-anchor', 'middle');
        titleEl.setAttribute('font-size', axisTitleSize);
        titleEl.setAttribute('fill', axisTitleColor);
        const titleFont = resolveDropdown(s.axisFormattingCard.axisLabelFontFamily);
        const titleWeight = resolveDropdown(s.axisFormattingCard.axisLabelFontWeight);
        if (titleFont) titleEl.setAttribute('font-family', titleFont);
        if (titleWeight) titleEl.setAttribute('font-weight', titleWeight);
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
        : minRadius;

      const circle = document.createElementNS(svgNs, 'circle');
      circle.setAttribute('cx', String(cx));
      circle.setAttribute('cy', String(cy));
      circle.setAttribute('r', String(r));
      const conditionalFill = this.getConditionalBubbleColor(pt.y);
      const effectiveColor = conditionalFill ?? sf.color;
      const effectiveOpacity = (sf.opacity / 100) * bubbleOpacity;
      const defaultStroke = this.settings.scatterSettings.bubbleStrokeColor.value?.value || sf.color;
      const highContrastStroke = pt.highlighted ? highContrast.foregroundSelected : highContrast.foreground;
      const highContrastFill = pt.highlighted ? highContrast.foregroundSelected : highContrast.background;
      circle.setAttribute(
        'fill',
        highContrast.enabled ? highContrastFill : withOpacity(effectiveColor, effectiveOpacity),
      );
      circle.setAttribute('stroke', highContrast.enabled ? highContrastStroke : defaultStroke);
      circle.setAttribute(
        'stroke-width',
        String(highContrast.enabled ? Math.max(2, this.settings.scatterSettings.bubbleStrokeWidth.value) : this.settings.scatterSettings.bubbleStrokeWidth.value),
      );
      circle.setAttribute('class', 'scatter-bubble-point');
      circle.setAttribute('data-point-index', String(ptIdx));
      circle.setAttribute('data-selection-key', pt.selectionId.getKey());

      // Apply CSS transitions for smooth data-update movement
      if (s.animationSettings.enableTransitions.value) {
        const transMs = animDuration;
        circle.style.transition = `cx ${transMs}ms ease, cy ${transMs}ms ease, r ${transMs}ms ease`;
      }

      bubblesGroup.appendChild(circle);

      // Animate with radial stagger from center
      // Skip animation when cross-highlighting is active to avoid overwriting dimmed opacity
      if (animEnabled && !data.hasHighlights) {
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
      circle.addEventListener('mousemove', (event: MouseEvent) => {
        this.moveTooltip(pt, event);
      });
      circle.addEventListener('mouseleave', () => {
        this.hideTooltip();
      });
      circle.style.cursor = interactionsEnabled ? 'pointer' : 'default';
      circle.addEventListener('click', (event: MouseEvent) => {
        if (!this.allowInteractions()) return;
        event.stopPropagation();
        const selectionPromise = this.selectionManager.select(
          pt.selectionId,
          event.ctrlKey || event.metaKey,
        );
        this.applySelectionHighlight();
        void selectionPromise.then(() => this.applySelectionHighlight());
      });
      circle.addEventListener('contextmenu', (event: MouseEvent) => {
        if (!this.allowInteractions()) return;
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

      for (let ptIdx = 0; ptIdx < data.points.length; ptIdx++) {
        const pt = data.points[ptIdx];
        const sf = resolveSeriesFormatting(this.settings.seriesFormattingCard, ptIdx, pt.color);
        if (!sf.showLabels) continue;
        const cx = xScale(pt.x);
        const cy = yScale(pt.y);
        const r = sizeScale && pt.size !== null
          ? sizeScale(pt.size)
          : minRadius;

        const label = document.createElementNS(svgNs, 'text');
        label.setAttribute('class', 'scatter-bubble-label');
        label.setAttribute('data-point-index', String(ptIdx));
        label.setAttribute('x', String(cx));
        label.setAttribute('y', String(cy - r - 4));
        label.setAttribute('text-anchor', 'middle');
        label.textContent = pt.label || `Point ${pt.index + 1}`;
        labelsGroup.appendChild(label);
      }
    }

    // ── Cluster Highlighting ─────────────────────────────────────
    this.renderClusterHighlighting(chartGroup, data, xScale, yScale, chartWidth, chartHeight);

    // ── Zoom & Pan ───────────────────────────────────────────────
    this.applyZoomPan(svg, chartGroup, xScale, yScale, chartWidth, chartHeight);

    // ── Play Axis ──────────────────────────────────────────────
    if (interactionsEnabled && s.animationSettings.enablePlayAxis.value && data.points.length > 1) {
      this.renderPlayAxis(data, bubblesGroup, xScale, yScale, sizeScale, s);
    }

    // Apply shared formatting settings
    applyAllAxisFormatting(this.container, this.settings.axisFormattingCard, '.scatter-bubble-axis', '.scatter-bubble-grid');
    applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.scatter-bubble-label');

    if (interactionsEnabled) {
      this.container.addEventListener('click', this.handleBackgroundClick);
    }

    // ── Accessibility ──────────────────────────────────────────
    this.applyAccessibility(data);
  }

  // ── Axes Rendering ─────────────────────────────────────────────

  private renderXAxis(
    svg: SVGSVGElement,
    xScale: d3.ScaleLinear<number, number>,
    chartWidth: number,
    chartHeight: number,
    contentPadding: number,
  ): void {
    const svgNs = 'http://www.w3.org/2000/svg';
    const axisGroup = document.createElementNS(svgNs, 'g');
    axisGroup.setAttribute('class', 'scatter-bubble-axis scatter-bubble-axis-x');
    axisGroup.setAttribute(
      'transform',
      `translate(${MARGIN.left + contentPadding}, ${MARGIN.top + contentPadding + chartHeight})`,
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
      const rotation = this.settings.axisFormattingCard.axisLabelRotation.value;
      tickLabel.setAttribute('text-anchor', rotation > 0 ? 'start' : rotation < 0 ? 'end' : 'middle');
      if (rotation !== 0) tickLabel.setAttribute('transform', `rotate(${rotation})`);
      tickLabel.textContent = formatWithSettings(tick, this.settings.numberFormattingCard);
      tickGroup.appendChild(tickLabel);

      axisGroup.appendChild(tickGroup);
    }
  }

  private renderYAxis(
    svg: SVGSVGElement,
    yScale: d3.ScaleLinear<number, number>,
    chartHeight: number,
    contentPadding: number,
  ): void {
    const svgNs = 'http://www.w3.org/2000/svg';
    const axisGroup = document.createElementNS(svgNs, 'g');
    axisGroup.setAttribute('class', 'scatter-bubble-axis scatter-bubble-axis-y');
    axisGroup.setAttribute('transform', `translate(${MARGIN.left + contentPadding}, ${MARGIN.top + contentPadding})`);
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
    const zoneFillOpacity = Math.max(0, Math.min(q.zoneFillOpacity.value, 100));
    if (zoneFillOpacity > 0) {
      const opacity = zoneFillOpacity / 100;
      const z1Color = q.zone1Color.value?.value ?? '#F59E0B';
      const z2Color = q.zone2Color.value?.value ?? '#10B981';
      const z3Color = q.zone3Color.value?.value ?? '#EF4444';
      const z4Color = q.zone4Color.value?.value ?? '#3B82F6';
      const zones: Array<{ x: number; y: number; w: number; h: number; color: string }> = [
        // Top-left
        { x: 0, y: 0, w: xClamped, h: yClamped, color: z1Color },
        // Top-right
        { x: xClamped, y: 0, w: chartWidth - xClamped, h: yClamped, color: z2Color },
        // Bottom-left
        { x: 0, y: yClamped, w: xClamped, h: chartHeight - yClamped, color: z3Color },
        // Bottom-right
        { x: xClamped, y: yClamped, w: chartWidth - xClamped, h: chartHeight - yClamped, color: z4Color },
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
      const labelFontColorRaw = q.labelFontColor.value?.value;
      const labelColor = labelFontColorRaw && labelFontColorRaw.length > 0 ? labelFontColorRaw : '#94A3B8';
      const labelFontFamily = resolveDropdown(q.labelFontFamily) || '';
      const labelFontWeight = resolveDropdown(q.labelFontWeight) || 'normal';
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
        text.setAttribute('font-weight', labelFontWeight);
        if (labelFontFamily) {
          text.setAttribute('font-family', labelFontFamily);
        }
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

  // ── Zoom & Pan ────────────────────────────────────────────────

  private applyZoomPan(
    svg: SVGSVGElement,
    chartGroup: SVGGElement,
    _xScale: d3.ScaleLinear<number, number>,
    _yScale: d3.ScaleLinear<number, number>,
    chartWidth: number,
    chartHeight: number,
  ): void {
    if (!this.allowInteractions()) return;
    const zs = this.settings.scatterClusterSettings;
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
    const numberSettings = this.settings.numberFormattingCard;
    const tooltipData: VisualTooltipDataItem[] = [
      { displayName: 'Point', value: pt.label || `Point ${pt.index + 1}` },
      { displayName: 'X', value: formatWithSettings(pt.x, numberSettings) },
      { displayName: 'Y', value: formatWithSettings(pt.y, numberSettings) },
    ];

    if (pt.size !== null) {
      tooltipData.push({
        displayName: 'Size',
        value: formatWithSettings(pt.size, numberSettings),
      });
    }

    this.host.tooltipService.show({
      dataItems: tooltipData,
      coordinates: [event.clientX, event.clientY],
      identities: [pt.selectionId],
      isTouchEvent: false,
    });
  }

  private moveTooltip(pt: ScatterPoint, event: MouseEvent): void {
    this.host.tooltipService.move({
      coordinates: [event.clientX, event.clientY],
      identities: [pt.selectionId],
      isTouchEvent: false,
    });
  }

  private hideTooltip(): void {
    this.host.tooltipService.hide({ immediately: true, isTouchEvent: false });
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
    const playSpeed = Math.max(100, s.animationSettings.playSpeed.value);
    const points = data.points;
    const circles = bubblesGroup.querySelectorAll('.scatter-bubble-point');
    if (circles.length === 0 || points.length === 0) return;

    // Build a play control bar
    const playBar = document.createElement('div');
    playBar.className = 'scatter-play-axis';
    playBar.style.display = 'flex';
    playBar.style.alignItems = 'center';
    playBar.style.gap = '8px';
    playBar.style.padding = `${Math.max(4, this.settings.cardSettings.contentPadding.value)}px ${Math.max(8, this.settings.cardSettings.contentPadding.value)}px`;
    playBar.style.justifyContent = 'center';

    const playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.textContent = '\u25B6';
    playBtn.setAttribute('aria-label', 'Play scatter sequence');
    playBtn.title = 'Play scatter sequence';
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
      playBtn.setAttribute('aria-label', 'Play scatter sequence');
      playBtn.title = 'Play scatter sequence';
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const play = (): void => {
      playing = true;
      playBtn.textContent = '\u23F8';
      playBtn.setAttribute('aria-label', 'Pause scatter sequence');
      playBtn.title = 'Pause scatter sequence';
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
    if (!acc.enableKeyboardNav.value) {
      this.container.removeAttribute('role');
      this.container.removeAttribute('aria-label');
      return;
    }

    ensureFocusRingStyles();

    applyChartAria(this.container, {
      chartType: 'scatter chart',
      title: this.settings.titleFormattingCard.titleText.value || undefined,
      dataPointCount: data.points.length,
    });

    const points = Array.from(this.container.querySelectorAll<SVGCircleElement>('.scatter-bubble-point'));
    points.forEach((element, index) => {
      const point = data.points[index];
      if (!point) return;
      const parts = [
        point.label || `Point ${index + 1}`,
        `X ${formatWithSettings(point.x, this.settings.numberFormattingCard)}`,
        `Y ${formatWithSettings(point.y, this.settings.numberFormattingCard)}`,
      ];
      if (point.size !== null) {
        parts.push(`Size ${formatWithSettings(point.size, this.settings.numberFormattingCard)}`);
      }
      parts.push(`Item ${index + 1} of ${data.points.length}`);
      element.setAttribute('role', 'listitem');
      element.setAttribute('tabindex', '0');
      element.setAttribute('aria-label', `${parts.join('. ')}.`);
    });

    const cleanup = attachKeyboardNav({
      container: this.container,
      itemSelector: '.scatter-bubble-point[tabindex="0"]',
      onActivate: (el) => {
        if (!this.allowInteractions()) return;
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
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
    const valueRange = Math.max(...yValues) - Math.min(...yValues);
    const bandHalfWidth = (valueRange || Math.abs(refValue) || 1)
      * Math.max(0, ref.referenceBandWidth.value) / 200;

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
      bandLowerValue: refValue - bandHalfWidth,
      bandUpperValue: refValue + bandHalfWidth,
      bandOpacity: ref.referenceBandOpacity.value / 100,
    });
  }

  private handleBackgroundClick = (): void => {
    if (!this.allowInteractions()) return;
    const clearPromise = this.selectionManager.clear();
    this.applySelectionHighlight();
    void clearPromise.then(() => this.applySelectionHighlight());
  };

  private notifyRenderingStarted(options: VisualUpdateOptions): void {
    this.host.eventService?.renderingStarted?.(options);
  }

  private notifyRenderingFinished(options: VisualUpdateOptions): void {
    this.host.eventService?.renderingFinished?.(options);
  }

  private notifyRenderingFailed(options: VisualUpdateOptions, reason?: string): void {
    this.host.eventService?.renderingFailed?.(options, reason);
  }

  // ── Selection and Cross-Highlight ────────────────────────────────

  private applySelectionHighlight(): void {
    const data = this.currentData;
    if (!data) return;

    const selectedKeys = new Set(
      (this.selectionManager.getSelectionIds() as ISelectionId[]).map((id) => id.getKey()),
    );
    const hasSelection = selectedKeys.size > 0;
    const shouldDim = hasSelection || data.hasHighlights;
    const pointElements = this.container.querySelectorAll<SVGElement>('[data-point-index]');
    for (const element of Array.from(pointElements)) {
      const idxStr = element.getAttribute('data-point-index');
      if (idxStr === null) continue;
      const idx = parseInt(idxStr, 10);
      const pt = data.points[idx];
      if (!pt) continue;
      const isSelected = hasSelection && selectedKeys.has(pt.selectionId.getKey());
      const isHighlighted = data.hasHighlights && pt.highlighted;
      element.style.opacity = shouldDim && !isSelected && !isHighlighted ? '0.3' : '';
    }
  }

  private allowInteractions(): boolean {
    const hostWithCapabilities = this.host as unknown as {
      hostCapabilities?: { allowInteractions?: boolean };
    };
    return hostWithCapabilities.hostCapabilities?.allowInteractions !== false;
  }

  private getHighContrastColors(): HostHighContrastColors {
    const palette = (this.host as unknown as {
      colorPalette?: {
        isHighContrast?: boolean;
        foreground?: unknown;
        background?: unknown;
        foregroundSelected?: unknown;
        hyperlink?: unknown;
      };
    }).colorPalette;

    const colorValue = (value: unknown, fallback: string): string => {
      if (typeof value === 'string' && value.length > 0) return value;
      if (typeof value === 'object' && value !== null && 'value' in value) {
        const nested = (value as { value?: unknown }).value;
        if (typeof nested === 'string' && nested.length > 0) return nested;
      }
      return fallback;
    };

    return {
      enabled: Boolean(palette?.isHighContrast),
      foreground: colorValue(palette?.foreground, '#000000'),
      background: colorValue(palette?.background, '#FFFFFF'),
      foregroundSelected: colorValue(palette?.foregroundSelected, '#000000'),
      hyperlink: colorValue(palette?.hyperlink, '#0000FF'),
    };
  }

  private applyHighContrastStyling(data: ScatterData | null): void {
    const highContrast = this.getHighContrastColors();
    if (!highContrast.enabled) return;

    this.container.style.backgroundColor = highContrast.background;
    this.container.style.color = highContrast.foreground;

    const emptyState = this.container.querySelector<HTMLElement>('.scatter-bubble-empty');
    if (emptyState) {
      emptyState.style.color = highContrast.foreground;
      return;
    }

    this.container.querySelectorAll<HTMLElement>('.chart-title, .chart-subtitle').forEach((el) => {
      el.style.color = highContrast.foreground;
    });

    this.container.querySelectorAll<HTMLElement>('.pbi-shared-legend .pbi-legend-item span').forEach((el, index) => {
      el.style.color = highContrast.foreground;
      if (index % 2 === 0) {
        el.style.backgroundColor = highContrast.foreground;
        el.style.border = `1px solid ${highContrast.foreground}`;
      }
    });

    this.container.querySelectorAll<HTMLElement>('.scatter-play-axis, .scatter-play-axis span, .scatter-play-axis button').forEach((el) => {
      el.style.color = highContrast.foreground;
      if (el.tagName === 'BUTTON') {
        el.style.border = `1px solid ${highContrast.foreground}`;
      }
    });

    this.container.querySelectorAll<SVGTextElement>('svg text').forEach((el) => {
      el.setAttribute('fill', highContrast.foreground);
    });
    this.container.querySelectorAll<SVGLineElement>('.scatter-bubble-axis line, .scatter-bubble-axis .domain').forEach((el) => {
      el.setAttribute('stroke', highContrast.foreground);
    });
    this.container.querySelectorAll<SVGLineElement>('.scatter-bubble-grid line').forEach((el) => {
      el.setAttribute('stroke', highContrast.foreground);
      el.setAttribute('stroke-opacity', '0.4');
    });
    this.container.querySelectorAll<SVGLineElement>('.scatter-bubble-quadrants line, .reference-line').forEach((el) => {
      el.setAttribute('stroke', highContrast.foreground);
    });
    this.container.querySelectorAll<SVGPathElement>('.scatter-bubble-trendline path, .trend-line, .reference-line').forEach((el) => {
      el.setAttribute('stroke', highContrast.foreground);
    });
    this.container.querySelectorAll<SVGRectElement>('.scatter-bubble-quadrants rect, .reference-band').forEach((el) => {
      el.setAttribute('fill', highContrast.foreground);
      el.setAttribute('fill-opacity', '0.08');
    });
    this.container.querySelectorAll<SVGPathElement>('.scatter-cluster-hulls path').forEach((el) => {
      el.setAttribute('fill', highContrast.background);
      el.setAttribute('fill-opacity', '1');
      el.setAttribute('stroke', highContrast.foreground);
      el.setAttribute('stroke-width', '2');
      el.setAttribute('stroke-opacity', '1');
    });

    if (!data) return;

    const circles = this.container.querySelectorAll<SVGCircleElement>('.scatter-bubble-point');
    circles.forEach((circle, index) => {
      const point = data.points[index];
      const bubbleColor = point?.highlighted ? highContrast.foregroundSelected : highContrast.foreground;
      const fillColor = point?.highlighted ? highContrast.foregroundSelected : highContrast.background;
      circle.setAttribute('fill', fillColor);
      circle.setAttribute('stroke', bubbleColor);
      circle.setAttribute('stroke-width', String(Math.max(2, Number(circle.getAttribute('stroke-width') ?? '2'))));
    });
  }

  public destroy(): void {
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.detachEmptySpaceContextMenu?.();
    this.detachEmptySpaceContextMenu = null;
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];
    this.hideTooltip();
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
  }
}
