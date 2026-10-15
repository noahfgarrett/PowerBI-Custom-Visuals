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
  applyCardStyle,
  type CardStyleMode,
  getHostChartColor,
  withOpacity,
  renderChartTitle,
  applyAxisFormatting,
  applyGridFormatting,
  applyDataLabelFormatting,
  applySortOrder,
  createScrollableChart,
  resolveDropdown,
  renderLegend,
  renderHorizontalReferenceLine,
  renderVerticalReferenceLine,
  type LegendItem,
  type ReferenceLineConfig,
  resolveColorTheme,
  buildConditionalConfig,
  resolveConditionalColor,
  applyChartAria,
  attachKeyboardNav,
  ensureFocusRingStyles,
  attachEmptySpaceContextMenu,
  allowInteractions,
  applyBasicHighContrastStyles,
  getHostHighContrastColors,
  notifyRenderingStarted,
  notifyRenderingFinished,
  notifyRenderingFailed,
  renderLandingPage,
  renderNoDataState,
  syncLegendFormattingVisibility,
  syncTitleFormattingVisibility,
  syncCardStyleVisibility,
  syncDateFilterFormattingVisibility,
  hideInlineLegendFormatting,
  computeStatValue,
  computeRegression,
  renderTrendLine,
  type StatType,
  type TrendType,
  resolveSeriesFormatting,
  SeriesFormattingGroup,
  getDateFilterIndices,
  isDateColumn,
  type DateFilterConfig,
  getLocalizedString,
  getVisualEmptyStateMode,
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
  highlighted: boolean;
  formattingObjects?: powerbi.DataViewObjects;
}

interface BoxPlotData {
  boxes: BoxStats[];
  globalMin: number;
  globalMax: number;
  isEmpty: boolean;
  /** Whether cross-highlight data is present from another visual/slicer */
  hasHighlights: boolean;
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
const LEGEND_HEIGHT = 28;

// -- Statistics -----------------------------------------------------------

type WhiskerCalcMethod = 'iqr' | 'minmax' | 'percentile' | 'stddev';

function computeStats(
  category: string,
  values: number[],
  whiskerCalc: WhiskerCalcMethod = 'iqr',
): Omit<BoxStats, 'selectionId' | 'highlighted' | 'formattingObjects'> | null {
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

  /** Cached data for cross-highlight support. */
  private currentData: BoxPlotData | null = null;
  private emptyStateMode: 'unconfigured' | 'noData' = 'unconfigured';
  private detachEmptySpaceContextMenu: (() => void) | null = null;

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new BoxPlotSettings();
    this.formattingSettingsService = new FormattingSettingsService(options.host.createLocalizationManager());
    this.container.classList.add('box-plot-container');
    this.detachEmptySpaceContextMenu = attachEmptySpaceContextMenu(
      this.container,
      this.selectionManager,
      () => this.host.createSelectionIdBuilder().createSelectionId(),
      () => allowInteractions(this.host),
    );
  }

  public update(options: VisualUpdateOptions): void {
    notifyRenderingStarted(this.host, options);
    try {
      // Cancel running animations before re-render
      this.cancelAnimations.forEach((cancel) => cancel());
      this.cancelAnimations = [];

      // Parse settings from dataView
      const dataView = options.dataViews?.[0];
      this.emptyStateMode = getVisualEmptyStateMode(dataView);
      if (dataView) {
        this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
          BoxPlotSettings,
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
      syncTitleFormattingVisibility(this.settings.titleFormattingCard);
      syncLegendFormattingVisibility(this.settings.legendFormattingCard);

    // Migrate the retired local axis card to the shared axis card.
    const legacyAxisObj = dataView?.metadata?.objects?.['axisSettings'];
    const axisObj = dataView?.metadata?.objects?.['axisFormatting'];
    if (legacyAxisObj) {
      if (axisObj?.['showXAxis'] === undefined && typeof legacyAxisObj['showXAxis'] === 'boolean') {
        this.settings.axisFormattingCard.showXAxis.value = legacyAxisObj['showXAxis'];
      }
      if (axisObj?.['showYAxis'] === undefined && typeof legacyAxisObj['showYAxis'] === 'boolean') {
        this.settings.axisFormattingCard.showYAxis.value = legacyAxisObj['showYAxis'];
      }
      if (axisObj?.['showGridLines'] === undefined && typeof legacyAxisObj['gridLines'] === 'boolean') {
        this.settings.axisFormattingCard.showGridLines.value = legacyAxisObj['gridLines'];
      }
    }

      syncDateFilterFormattingVisibility(this.settings.dateFilterFormattingCard);
      this.settings.layoutSettings.labelPadding.visible = this.settings.dataLabelFormattingCard.showDataLabels.value;

      syncCardStyleVisibility(this.settings.cardSettings);

    // Hide dual-axis-only properties (no combo/dual-axis support)
    this.settings.referenceLineFormattingCard.referenceLineAxis.visible = false;
    this.settings.trendLineFormattingCard.trendLineAxis.visible = false;
    this.settings.axisFormattingCard.integerTicks.visible = false;
      hideInlineLegendFormatting(this.settings.legendFormattingCard);

    // ── Conditional visibility ──────────────────────────────────────
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
    const isHorizontal = (resolveDropdown(this.settings.boxPlotDisplaySettings.orientation) ?? 'vertical') === 'horizontal';
    this.settings.axisFormattingCard.axisLabelRotation.visible = !isHorizontal && this.settings.axisFormattingCard.showXAxis.value;
    this.settings.axisFormattingCard.yAxisMin.visible = !isHorizontal;
    this.settings.axisFormattingCard.yAxisMax.visible = !isHorizontal;

    // Mean marker sub-settings: hide when showMean off
    const meanOn = this.settings.meanMarkerSettings.show.value;
    this.settings.meanMarkerSettings.shape.visible = meanOn;
    this.settings.meanMarkerSettings.color.visible = meanOn;
    this.settings.meanMarkerSettings.size.visible = meanOn;
    this.settings.meanMarkerSettings.strokeWidth.visible = meanOn;

    // Jitter (data points) sub-settings: hide when showDataPoints off
    const jitterOn = this.settings.jitterSettings.show.value;
    this.settings.jitterSettings.opacity.visible = jitterOn;
    this.settings.jitterSettings.radius.visible = jitterOn;
    this.settings.jitterSettings.color.visible = jitterOn;

    // Outlier radius: hide when showOutliers off
    this.settings.boxSettings.outlierRadius.visible = this.settings.boxSettings.showOutliers.value;

    const showMedian = this.settings.boxSettings.showMedianLine.value;
    this.settings.boxSettings.medianColor.visible = showMedian;
    this.settings.boxSettings.medianLineWidth.visible = showMedian;

    const animationEnabled = this.settings.animationSettings.enabled.value;
    this.settings.animationSettings.duration.visible = animationEnabled;
    this.settings.animationSettings.staggerDelay.visible = animationEnabled;

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

    const showTrendLine = this.settings.trendLineFormattingCard.showTrendLine.value;
    const trendType = resolveDropdown(this.settings.trendLineFormattingCard.trendLineType) ?? 'linear';
    this.settings.trendLineFormattingCard.showTrendLine.visible = !isHorizontal;
    this.settings.trendLineFormattingCard.trendLineType.visible = !isHorizontal && showTrendLine;
    this.settings.trendLineFormattingCard.polynomialOrder.visible = !isHorizontal && showTrendLine && trendType === 'polynomial';
    this.settings.trendLineFormattingCard.trendLineColor.visible = !isHorizontal && showTrendLine;
    this.settings.trendLineFormattingCard.trendLineWidth.visible = !isHorizontal && showTrendLine;
    this.settings.trendLineFormattingCard.showEquation.visible = !isHorizontal && showTrendLine;
    this.settings.trendLineFormattingCard.showR2.visible = !isHorizontal && showTrendLine;

    const conditionalEnabled = this.settings.conditionalFormattingCard.enableConditional.value;
    this.settings.conditionalFormattingCard.conditionalDirection.visible = conditionalEnabled;
    this.settings.conditionalFormattingCard.threshold1.visible = conditionalEnabled;
    this.settings.conditionalFormattingCard.threshold2.visible = conditionalEnabled;
    this.settings.conditionalFormattingCard.conditionalColor1.visible = conditionalEnabled;
    this.settings.conditionalFormattingCard.conditionalColor2.visible = conditionalEnabled;
    this.settings.conditionalFormattingCard.conditionalColor3.visible = conditionalEnabled;

    // Violin settings: hide when showViolin off (no sub-settings beyond the toggle itself)
    // Notch settings: hide when showNotches off (no sub-settings beyond the toggle itself)
    // Note: showViolin and showNotches are simple toggles without child properties in boxPlotDisplaySettings

      // Extract data
      const data = this.extractData(dataView);
      this.currentData = data;

      // Populate per-series formatting groups
      this.populateSeriesGroups(data);

      // Render
      if (data.isEmpty) {
        this.renderEmpty();
      } else {
        this.render(data, options.viewport);
      }

      // Apply cross-highlight dimming after render
      this.applySelectionHighlight();

      // Apply card styling AFTER render — render clears the container, which would destroy the glass backdrop div.
      this.applyCardStyle();
      applyBasicHighContrastStyles(this.container, getHostHighContrastColors(this.host), {
        textSelectors: [
          '.box-plot-container svg text',
          '.pbi-landing-page-title',
          '.pbi-landing-page-description',
          '.pbi-landing-page-hint',
          '.pbi-no-data-state',
        ],
        lineSelectors: [
          '.box-plot-whisker',
          '.box-plot-whisker-cap',
          '.box-plot-median',
          '.box-plot-axis path',
          '.box-plot-axis line',
          '.box-plot-grid line',
        ],
        fillSelectors: [
          '.box-plot-box',
          '.box-plot-outlier',
          '.box-plot-jitter-point',
          '.box-plot-mean-marker',
        ],
        strokeSelectors: ['.box-plot-box', '.box-plot-outlier'],
      });
      notifyRenderingFinished(this.host, options);
    } catch (error) {
      notifyRenderingFailed(this.host, options, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  // -- Series Formatting ----------------------------------------------------

  private populateSeriesGroups(data: BoxPlotData): void {
    const themeName = resolveColorTheme(this.settings.colorThemeFormattingCard);
    const card = this.settings.seriesFormattingCard;
    card.groups = [];
    if (data.isEmpty) return;
    const boxColor = this.settings.colorSettings.boxColor.value?.value ?? '#3B82F6';
    const perCategory = this.settings.colorSettings.perCategoryColors.value;
    for (let i = 0; i < data.boxes.length; i++) {
      const group = new SeriesFormattingGroup({
        name: `series_${i}`,
        displayName: data.boxes[i].category,
      });
      group.seriesColor.value = {
        value: perCategory ? getHostChartColor(this.host.colorPalette, i, themeName) : boxColor,
      };
      group.lineStyle.visible = false;
      group.lineWidth.visible = false;
      const selector = data.boxes[i].selectionId.getSelector();
      for (const slice of group.slices) {
        slice.selector = selector;
      }
      const objects = data.boxes[i].formattingObjects?.['seriesFormatting'];
      if (objects) {
        const color = objects['seriesColor'] as { solid?: { color?: string } } | undefined;
        if (color?.solid?.color) group.seriesColor.value = { value: color.solid.color };
        if (typeof objects['seriesOpacity'] === 'number') group.seriesOpacity.value = objects['seriesOpacity'];
        if (typeof objects['showDataLabels'] === 'boolean') {
          group.showDataLabels.value = objects['showDataLabels'];
        }
      }
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
      hasHighlights: false,
    };

    if (!dataView?.categorical) return empty;

    const categorical = dataView.categorical;
    const categoryColumn = categorical.categories?.[0];
    const valuesColumns = categorical.values;

    if (!categoryColumn || !valuesColumns || valuesColumns.length === 0) return empty;

    const dateConfig: DateFilterConfig = {
      enabled: this.settings.dateFilterFormattingCard.enableDateFilter.value,
      startDate: this.settings.dateFilterFormattingCard.startDate.value,
      endAtCurrentDate: this.settings.dateFilterFormattingCard.endAtCurrentDate.value,
      endDate: this.settings.dateFilterFormattingCard.endDate.value,
    };
    const dateIndices = isDateColumn(categoryColumn.source) ? getDateFilterIndices(categoryColumn.values, dateConfig) : null;

    // Group raw values by category
    const categoryLabels = categoryColumn.values;
    const groupMap = new Map<string, {
      values: number[];
      selectionId: ISelectionId;
      hasHighlight: boolean;
      formattingObjects?: powerbi.DataViewObjects;
    }>();

    // Collect values per category across all value columns
    for (let rowIdx = 0; rowIdx < categoryLabels.length; rowIdx++) {
      if (dateIndices && !dateIndices.has(rowIdx)) continue;
      const catLabel = categoryLabels[rowIdx];
      const key = catLabel !== null && catLabel !== undefined ? String(catLabel) : '';

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          values: [],
          selectionId: this.host.createSelectionIdBuilder()
            .withCategory(categoryColumn, rowIdx)
            .createSelectionId(),
          hasHighlight: false,
          formattingObjects: categoryColumn.objects?.[rowIdx],
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

        const hlRaw = (col as unknown as { highlights?: unknown[] }).highlights as unknown[] | undefined;
        if (hlRaw && hlRaw[rowIdx] !== null && hlRaw[rowIdx] !== undefined) {
          group.hasHighlight = true;
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
          highlighted: group.hasHighlight,
          formattingObjects: group.formattingObjects,
        });
      }
    }

    if (boxes.length === 0) return empty;

    const sortedBoxes = applySortOrder(
      boxes.map((box) => ({ ...box, name: box.category, value: box.median })),
      this.settings.sortFormattingCard,
    ).map(({ name: _name, value: _value, ...box }) => box as BoxStats);

    // Global min/max including outliers and raw values for y-scale
    let globalMin = Infinity;
    let globalMax = -Infinity;
    for (const box of sortedBoxes) {
      globalMin = Math.min(globalMin, box.min, ...box.outliers, ...box.rawValues);
      globalMax = Math.max(globalMax, box.max, ...box.outliers, ...box.rawValues);
    }

    // Handle edge case: all values identical
    if (globalMin === globalMax) {
      globalMin -= 1;
      globalMax += 1;
    }

    const hasHighlights = boxes.some((b) => b.highlighted);
    return {
      boxes: sortedBoxes,
      globalMin,
      globalMax,
      isEmpty: false,
      hasHighlights,
    };
  }

  // -- Card Style ---------------------------------------------------------

  private applyCardStyle(): void {
    const s = this.settings.cardSettings;
    const mode = (resolveDropdown(s.cardStyleMode) ?? 'glass') as CardStyleMode;
    applyCardStyle(
      this.container,
      {
        mode,
        opacity: s.backgroundOpacity.value / 100,
        backgroundColor: s.backgroundColor.value?.value,
        borderRadius: s.borderRadius.value,
      },
    );
  }

  // -- Empty State --------------------------------------------------------

  private renderEmpty(): void {
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.container.addEventListener('click', this.handleBackgroundClick);
    const colors = getHostHighContrastColors(this.host);
    if (this.emptyStateMode === 'noData') {
      renderNoDataState(
        this.container,
        getLocalizedString(this.host, 'BoxPlot_NoDataState', 'No data for the current selection.'),
        colors,
      );
      return;
    }
    renderLandingPage(this.container, {
      title: getLocalizedString(this.host, 'BoxPlot_LandingTitle', 'Add data to build a box plot'),
      description: getLocalizedString(
        this.host,
        'BoxPlot_LandingDescription',
        'Add a category and at least one numeric value to compare distributions.',
      ),
      steps: [
        getLocalizedString(this.host, 'BoxPlot_LandingStepCategory', 'Add a category to define each distribution.'),
        getLocalizedString(this.host, 'BoxPlot_LandingStepValues', 'Add numeric values to calculate quartiles and outliers.'),
      ],
      hint: getLocalizedString(
        this.host,
        'BoxPlot_LandingHint',
        'Add multiple rows per category to reveal a meaningful distribution.',
      ),
    }, colors);
  }

  // -- Main Render --------------------------------------------------------

  private render(data: BoxPlotData, viewport: powerbi.IViewport): void {
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    renderChartTitle(this.container, this.settings.titleFormattingCard);
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.container.addEventListener('click', this.handleBackgroundClick);

    const s = this.settings;
    const isHorizontal = (resolveDropdown(s.boxPlotDisplaySettings.orientation) ?? 'vertical') === 'horizontal';

    // Legend
    const showLegend = s.legendFormattingCard.showLegend.value;
    const legendPos = this.getLegendPosition();
    const legendReserve = showLegend ? LEGEND_HEIGHT : 0;
    const containerPadding = Math.max(0, s.layoutSettings.containerPadding.value + s.cardSettings.contentPadding.value);
    const categoryPaddingInner = Math.max(0, s.layoutSettings.categoryPaddingInner.value);
    const categoryPaddingOuter = Math.max(0, s.layoutSettings.categoryPaddingOuter.value);

    const margin: Margin = {
      top: MARGIN_DEFAULT.top + containerPadding,
      right: MARGIN_DEFAULT.right + containerPadding,
      bottom: MARGIN_DEFAULT.bottom + containerPadding,
      left: MARGIN_DEFAULT.left + containerPadding,
    };
    if (isHorizontal) {
      // Horizontal: categories on Y-axis, values on X-axis
      if (!s.axisFormattingCard.showXAxis.value) margin.bottom = 8;
      if (!s.axisFormattingCard.showYAxis.value) margin.left = 8;
      else margin.left = 80; // more room for category labels on Y-axis
    } else {
      if (!s.axisFormattingCard.showXAxis.value) margin.bottom = 8;
      if (!s.axisFormattingCard.showYAxis.value) margin.left = 8;
    }
    if (legendPos === 'top') margin.top += legendReserve;
    if (legendPos === 'right') margin.right += 80;

    const baseSvgWidth = viewport.width - containerPadding * 2;
    const baseSvgHeight = viewport.height - containerPadding * 2 - (legendPos === 'bottom' || legendPos === 'top' ? legendReserve : 0);
    const baseChartWidth = Math.max(0, baseSvgWidth - margin.left - margin.right);
    const baseChartHeight = Math.max(0, baseSvgHeight - margin.top - margin.bottom);

    if (baseChartWidth <= 0 || baseChartHeight <= 0) {
      renderNoDataState(
        this.container,
        getLocalizedString(this.host, 'BoxPlot_SizeState', 'Increase the visual size to display the box plot.'),
        getHostHighContrastColors(this.host),
      );
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
      .paddingInner(categoryPaddingInner)
      .paddingOuter(categoryPaddingOuter);

    const configuredMin = !isHorizontal && Number.isFinite(s.axisFormattingCard.yAxisMin.value)
      ? s.axisFormattingCard.yAxisMin.value
      : data.globalMin - valPad;
    const configuredMax = !isHorizontal && Number.isFinite(s.axisFormattingCard.yAxisMax.value)
      ? s.axisFormattingCard.yAxisMax.value
      : data.globalMax + valPad;
    const domainMin = configuredMin < configuredMax ? configuredMin : data.globalMin - valPad;
    const domainMax = configuredMin < configuredMax ? configuredMax : data.globalMax + valPad;
    const valScale = d3.scaleLinear()
      .domain([domainMin, domainMax])
      .nice()
      .range(isHorizontal ? [0, chartWidth] : [chartHeight, 0]);

    // Aliases for backward-compat in vertical mode
    const xScale = isHorizontal ? catScale : catScale;
    const yScale = valScale;

    // Grid lines
    if (s.axisFormattingCard.showGridLines.value) {
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
      if (s.axisFormattingCard.showYAxis.value) {
        chartGroup.append('g')
          .attr('class', 'box-plot-axis box-plot-axis-x')
          .call(d3.axisLeft(catScale).tickSize(0))
          .select('.domain').remove();
      }
      if (s.axisFormattingCard.showXAxis.value) {
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
      if (s.axisFormattingCard.showXAxis.value) {
        chartGroup.append('g')
          .attr('class', 'box-plot-axis box-plot-axis-x')
          .attr('transform', `translate(0,${chartHeight})`)
          .call(d3.axisBottom(catScale).tickSize(0))
          .select('.domain').remove();
      }
      if (s.axisFormattingCard.showYAxis.value) {
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
      this.renderSharedReferenceLine(chartGroup, yScale, chartHeight, data.boxes.map((box) => box.median), true);
    } else {
      this.renderSharedReferenceLine(chartGroup, yScale, chartWidth, data.boxes.map((box) => box.median), false);
    }

    // Trend line through median values
    if (!isHorizontal) {
      this.renderSharedTrendLine(chartGroup, data, xScale, yScale);
    }

    // Settings
    const boxColor = s.colorSettings.boxColor.value?.value ?? '#3B82F6';
    const whiskerColor = s.colorSettings.whiskerColor.value?.value ?? '#64748B';
    const medianColor = s.boxSettings.medianColor.value?.value ?? '#6366F1';
    const medianLineWidth = s.boxSettings.medianLineWidth.value;
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
    const labelPadding = Math.max(0, s.layoutSettings.labelPadding.value);

    // Mean marker settings
    const showMeanMarker = s.meanMarkerSettings.show.value;
    const meanShape = s.meanMarkerSettings.shape.value?.value ?? 'diamond';
    const meanColor = s.meanMarkerSettings.color.value?.value ?? '#F59E0B';
    const meanSize = s.meanMarkerSettings.size.value;
    const meanStrokeWidth = s.meanMarkerSettings.strokeWidth.value;

    // Jitter settings
    const showJitter = s.jitterSettings.show.value;
    const jitterOpacity = Math.max(0, Math.min(100, s.jitterSettings.opacity.value)) / 100;
    const jitterRadius = s.jitterSettings.radius.value;
    const jitterColorRaw = s.jitterSettings.color.value?.value ?? '';
    const jitterColor = jitterColorRaw.length > 0 ? jitterColorRaw : boxColor;

    // Render each box
    data.boxes.forEach((box, idx) => {
      const categoryGroup = chartGroup.append('g')
        .attr('class', 'box-plot-category')
        .attr('data-selection-key', box.selectionId.getKey())
        .style('transition', 'opacity 0.15s ease');
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

          const dot = categoryGroup.append('circle')
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
      const lowerWhiskerPath = categoryGroup.append('path')
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
      const upperWhiskerPath = categoryGroup.append('path')
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
        categoryGroup.append('line')
          .attr('class', 'box-plot-whisker-cap')
          .attr('x1', vMin).attr('x2', vMin)
          .attr('y1', bandCenter - capHalf).attr('y2', bandCenter + capHalf)
          .attr('stroke', whiskerColor).attr('stroke-width', whiskerWidth);
      } else {
        categoryGroup.append('line')
          .attr('class', 'box-plot-whisker-cap')
          .attr('x1', bandCenter - capHalf).attr('x2', bandCenter + capHalf)
          .attr('y1', vMin).attr('y2', vMin)
          .attr('stroke', whiskerColor).attr('stroke-width', whiskerWidth);
      }

      // -- Upper whisker cap ---------------------------------------------
      if (isHorizontal) {
        categoryGroup.append('line')
          .attr('class', 'box-plot-whisker-cap')
          .attr('x1', vMax).attr('x2', vMax)
          .attr('y1', bandCenter - capHalf).attr('y2', bandCenter + capHalf)
          .attr('stroke', whiskerColor).attr('stroke-width', whiskerWidth);
      } else {
        categoryGroup.append('line')
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

      const boxRect = categoryGroup.append('rect')
        .attr('class', 'box-plot-box')
        .attr('data-selection-key', box.selectionId.getKey())
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
      this.attachSelection(boxRect, box.selectionId);

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
          ? categoryGroup.append('line')
              .attr('class', 'box-plot-median')
              .attr('x1', vMedian).attr('x2', vMedian)
              .attr('y1', bandCenter - halfBox).attr('y2', bandCenter + halfBox)
              .attr('stroke', medianColor)
              .attr('stroke-width', medianLineWidth)
              .attr('stroke-linecap', 'round')
          : categoryGroup.append('line')
              .attr('class', 'box-plot-median')
              .attr('x1', bandCenter - halfBox).attr('x2', bandCenter + halfBox)
              .attr('y1', vMedian).attr('y2', vMedian)
              .attr('stroke', medianColor)
              .attr('stroke-width', medianLineWidth)
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
          const marker = categoryGroup.append('path')
            .attr('class', 'box-plot-mean-marker')
            .attr('d', diamondPath)
            .attr('fill', meanColor)
            .attr('stroke', meanColor)
            .attr('stroke-width', meanStrokeWidth);

          if (animEnabled) {
            const markerNode = marker.node();
            if (markerNode) {
              const cancel = popIn(markerNode, delay + 150, DURATION.fast);
              this.cancelAnimations.push(cancel);
            }
          }
        } else if (meanShape === 'cross') {
          const half = meanSize / 2;
          const crossGroup = categoryGroup.append('g')
            .attr('class', 'box-plot-mean-marker');

          crossGroup.append('line')
            .attr('x1', meanCx - half).attr('x2', meanCx + half)
            .attr('y1', meanCy).attr('y2', meanCy)
            .attr('stroke', meanColor).attr('stroke-width', meanStrokeWidth);

          crossGroup.append('line')
            .attr('x1', meanCx).attr('x2', meanCx)
            .attr('y1', meanCy - half).attr('y2', meanCy + half)
            .attr('stroke', meanColor).attr('stroke-width', meanStrokeWidth);

          if (animEnabled) {
            const groupNode = crossGroup.node();
            if (groupNode) {
              const cancel = popIn(groupNode, delay + 150, DURATION.fast);
              this.cancelAnimations.push(cancel);
            }
          }
        } else {
          // Circle
          const marker = categoryGroup.append('circle')
            .attr('class', 'box-plot-mean-marker')
            .attr('cx', meanCx)
            .attr('cy', meanCy)
            .attr('r', meanSize / 2)
            .attr('fill', meanColor)
            .attr('stroke', meanColor)
            .attr('stroke-width', meanStrokeWidth);

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
          const outlierDot = categoryGroup.append('circle')
            .attr('class', 'box-plot-outlier')
            .attr('cx', outlierCx)
            .attr('cy', outlierCy)
            .attr('r', outlierRadius)
            .attr('fill', withOpacity(boxColor, 0.7))
            .attr('stroke', boxStrokeColor)
            .attr('stroke-width', boxStrokeWidth);

          // Tooltip on outlier
          this.attachOutlierTooltip(outlierDot, box, outlierVal);
          this.attachSelection(outlierDot, box.selectionId);

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
      if (showDataLabels && sf.showLabels) {
        const labelX = isHorizontal ? vMedian + labelPadding : bandCenter;
        const labelY = isHorizontal ? bandCenter : vMedian - labelPadding;
        const dataLabel = categoryGroup.append('text')
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

    this.renderAxisTitles(chartGroup, chartWidth, chartHeight);
    if (!isHorizontal) {
      const rotation = s.axisFormattingCard.axisLabelRotation.value;
      if (rotation !== 0) {
        chartGroup.selectAll<SVGTextElement, unknown>('.box-plot-axis-x .tick text')
          .attr('transform', `rotate(${rotation})`)
          .attr('text-anchor', rotation > 0 ? 'start' : 'end');
      }
    }

    // Legend (bottom or right)
    if (showLegend && (legendPos === 'bottom' || legendPos === 'right')) {
      this.renderSharedLegend(data);
    }

    // Render violin overlay if enabled
    this.renderViolinOverlay(data, chartGroup, catScale, valScale, isHorizontal);

    // Render notches if enabled
    this.renderNotches(data, chartGroup, catScale, valScale, isHorizontal);

    // Accessibility (keyboard nav + ARIA)
    this.applyAccessibility(data.boxes);
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
        identities: [box.selectionId],
        coordinates: [event.clientX, event.clientY],
        isTouchEvent: false,
      });
    });

    rect.on('mousemove', (event: MouseEvent) => {
      host.tooltipService.move({
        dataItems: [],
        identities: [box.selectionId],
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
    box: BoxStats,
    value: number,
  ): void {
    const host = this.host;

    circle.on('mouseover', (event: MouseEvent) => {
      const tooltipData: VisualTooltipDataItem[] = [
        { displayName: 'Category', value: box.category },
        { displayName: 'Outlier Value', value: formatWithSettings(value, this.settings.numberFormattingCard) },
      ];

      host.tooltipService.show({
        dataItems: tooltipData,
        identities: [box.selectionId],
        coordinates: [event.clientX, event.clientY],
        isTouchEvent: false,
      });
    });

    circle.on('mousemove', (event: MouseEvent) => {
      host.tooltipService.move({
        dataItems: [],
        identities: [box.selectionId],
        coordinates: [event.clientX, event.clientY],
        isTouchEvent: false,
      });
    });

    circle.on('mouseout', () => {
      host.tooltipService.hide({ immediately: true, isTouchEvent: false });
    });
  }

  private renderAxisTitles(
    chartGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
    chartWidth: number,
    chartHeight: number,
  ): void {
    const axis = this.settings.axisFormattingCard;
    const color = axis.axisLabelColor.value?.value || '#475569';
    const fontSize = axis.axisLabelSize.value;
    const fontFamily = resolveDropdown(axis.axisLabelFontFamily) || undefined;
    const fontWeight = resolveDropdown(axis.axisLabelFontWeight) || 'normal';

    const styleTitle = (title: d3.Selection<SVGTextElement, unknown, null, undefined>) => {
      title.attr('fill', color).attr('font-size', `${fontSize}px`).attr('font-weight', fontWeight);
      if (fontFamily) title.attr('font-family', fontFamily);
    };

    if (axis.showXAxis.value && axis.xAxisTitle.value) {
      const title = chartGroup.append('text')
        .attr('class', 'box-plot-axis-title box-plot-x-axis-title')
        .attr('x', chartWidth / 2)
        .attr('y', chartHeight + 34)
        .attr('text-anchor', 'middle')
        .text(axis.xAxisTitle.value);
      styleTitle(title);
    }

    if (axis.showYAxis.value && axis.yAxisTitle.value) {
      const title = chartGroup.append('text')
        .attr('class', 'box-plot-axis-title box-plot-y-axis-title')
        .attr('transform', 'rotate(-90)')
        .attr('x', -chartHeight / 2)
        .attr('y', -42)
        .attr('text-anchor', 'middle')
        .text(axis.yAxisTitle.value);
      styleTitle(title);
    }
  }

  // -- Reference Line (shared) ---------------------------------------------

  private renderSharedReferenceLine(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    yScale: d3.ScaleLinear<number, number>,
    width: number,
    values: number[],
    isHorizontal: boolean,
  ): void {
    const ref = this.settings.referenceLineFormattingCard;
    if (!ref.showReferenceLine.value) return;

    const refType = resolveDropdown(ref.referenceLineType) ?? 'custom';
    const refValue = refType === 'custom'
      ? ref.referenceLineValue.value
      : computeStatValue(values, refType as StatType);
    if (!Number.isFinite(refValue)) return;

    const refColor = ref.referenceLineColor.value?.value ?? '#EF4444';
    const refStyleVal = resolveDropdown(ref.referenceLineStyle) ?? 'dashed';
    const labelText = ref.referenceLabelText.value.length > 0
      ? ref.referenceLabelText.value
      : formatWithSettings(refValue, this.settings.numberFormattingCard);
    const valueRange = values.length > 0 ? Math.max(...values) - Math.min(...values) : 0;
    const bandHalfWidth = (valueRange || Math.abs(refValue) || 1) * Math.max(0, ref.referenceBandWidth.value) / 200;

    if (isHorizontal) {
      if (ref.showReferenceBand.value && bandHalfWidth > 0) {
        const x1 = yScale(refValue - bandHalfWidth);
        const x2 = yScale(refValue + bandHalfWidth);
        g.append('rect')
          .attr('class', 'reference-band')
          .attr('x', Math.min(x1, x2))
          .attr('y', 0)
          .attr('width', Math.abs(x2 - x1))
          .attr('height', width)
          .attr('fill', refColor)
          .attr('opacity', Math.max(0, Math.min(100, ref.referenceBandOpacity.value)) / 100);
      }
      renderVerticalReferenceLine(g, {
        xPosition: yScale(refValue),
        yStart: 0,
        yEnd: width,
        lineColor: refColor,
        lineWidth: ref.referenceLineWidth.value,
        lineStyle: refStyleVal as 'solid' | 'dashed' | 'dotted',
        showLabel: ref.showReferenceLabel.value,
        labelText,
      });
      return;
    }

    const config: ReferenceLineConfig = {
      value: refValue,
      yScale,
      chartWidth: width,
      lineColor: refColor,
      lineWidth: ref.referenceLineWidth.value,
      lineStyle: refStyleVal as 'solid' | 'dashed' | 'dotted',
      showLabel: ref.showReferenceLabel.value,
      labelText,
      showBand: ref.showReferenceBand.value,
      bandLowerValue: refValue - bandHalfWidth,
      bandUpperValue: refValue + bandHalfWidth,
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
    const perCategory = this.settings.colorSettings.perCategoryColors.value;

    const items: LegendItem[] = data.boxes.map((box, idx) => ({
      label: box.category,
      color: resolveSeriesFormatting(
        this.settings.seriesFormattingCard,
        idx,
        perCategory ? getHostChartColor(this.host.colorPalette, idx, themeName) : boxColor,
      ).color,
    }));

    const rawLegendFontFamily = resolveDropdown(legendFmtCard.legendFontFamily) || undefined;

    renderLegend(this.container, {
      items,
      position: this.getLegendPosition(),
      fontSize: legendFontSize,
      fontColor: legendFontColor,
      fontFamily: rawLegendFontFamily,
      fontWeight: resolveDropdown(legendFmtCard.legendFontWeight) || 'normal',
      aliases: legendFmtCard.legendAliases.value,
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
        .attr('data-selection-key', box.selectionId.getKey())
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
          .attr('data-selection-key', box.selectionId.getKey())
          .attr('d', `M${vNotchLower},${bandCenter - halfBox} L${vMedian},${bandCenter - halfBox + notchIndent} L${vNotchUpper},${bandCenter - halfBox}`)
          .attr('stroke', medianColor).attr('stroke-width', 1.5).attr('fill', 'none')
          .style('pointer-events', 'none');
        chartGroup.append('path')
          .attr('class', 'box-plot-notch')
          .attr('data-selection-key', box.selectionId.getKey())
          .attr('d', `M${vNotchLower},${bandCenter + halfBox} L${vMedian},${bandCenter + halfBox - notchIndent} L${vNotchUpper},${bandCenter + halfBox}`)
          .attr('stroke', medianColor).attr('stroke-width', 1.5).attr('fill', 'none')
          .style('pointer-events', 'none');
      } else {
        // Vertical: notches indent horizontally from box edges
        chartGroup.append('path')
          .attr('class', 'box-plot-notch')
          .attr('data-selection-key', box.selectionId.getKey())
          .attr('d', `M${bandCenter - halfBox},${vNotchLower} L${bandCenter - halfBox + notchIndent},${vMedian} L${bandCenter - halfBox},${vNotchUpper}`)
          .attr('stroke', medianColor).attr('stroke-width', 1.5).attr('fill', 'none')
          .style('pointer-events', 'none');
        chartGroup.append('path')
          .attr('class', 'box-plot-notch')
          .attr('data-selection-key', box.selectionId.getKey())
          .attr('d', `M${bandCenter + halfBox},${vNotchLower} L${bandCenter + halfBox - notchIndent},${vMedian} L${bandCenter + halfBox},${vNotchUpper}`)
          .attr('stroke', medianColor).attr('stroke-width', 1.5).attr('fill', 'none')
          .style('pointer-events', 'none');
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

  private applyAccessibility(boxes: BoxStats[]): void {
    const acc = this.settings.accessibilityFormattingCard;
    if (!acc.enableKeyboardNav.value) {
      this.container.removeAttribute('role');
      this.container.removeAttribute('aria-label');
      return;
    }
    ensureFocusRingStyles();
    applyChartAria(this.container, {
      chartType: 'box plot',
      title: this.settings.titleFormattingCard?.titleText?.value || undefined,
      dataPointCount: boxes.length,
    });
    const boxElements = Array.from(this.container.querySelectorAll<SVGRectElement>('.box-plot-box'));
    boxElements.forEach((element, index) => {
      const box = boxes[index];
      if (!box) return;
      element.setAttribute('role', 'listitem');
      element.setAttribute('tabindex', '0');
      element.setAttribute(
        'aria-label',
        `${box.category}. Minimum ${formatWithSettings(box.min, this.settings.numberFormattingCard)}. `
          + `First quartile ${formatWithSettings(box.q1, this.settings.numberFormattingCard)}. `
          + `Median ${formatWithSettings(box.median, this.settings.numberFormattingCard)}. `
          + `Third quartile ${formatWithSettings(box.q3, this.settings.numberFormattingCard)}. `
          + `Maximum ${formatWithSettings(box.max, this.settings.numberFormattingCard)}. `
          + `Item ${index + 1} of ${boxes.length}.`,
      );
    });
    const cleanup = attachKeyboardNav({
      container: this.container,
      itemSelector: '.box-plot-box[tabindex="0"]',
      onActivate: (el) => {
        if (allowInteractions(this.host)) {
          el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        }
      },
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

  private attachSelection<E extends SVGElement>(
    node: d3.Selection<E, unknown, null, undefined>,
    selectionId: ISelectionId,
  ): void {
    node.style('cursor', allowInteractions(this.host) ? 'pointer' : 'default');
    node.on('click.selection', (event: MouseEvent) => {
      if (!allowInteractions(this.host)) return;
      event.stopPropagation();
      const selectionPromise = this.selectionManager.select(selectionId, event.ctrlKey || event.metaKey);
      this.applySelectionHighlight();
      void selectionPromise.then(() => this.applySelectionHighlight());
    });
    node.on('contextmenu.selection', (event: MouseEvent) => {
      if (!allowInteractions(this.host)) return;
      event.preventDefault();
      event.stopPropagation();
      void this.selectionManager.showContextMenu(selectionId, {
        x: event.clientX,
        y: event.clientY,
      });
    });
  }

  private handleBackgroundClick = (): void => {
    if (!allowInteractions(this.host)) return;
    const clearPromise = this.selectionManager.clear();
    this.applySelectionHighlight();
    void clearPromise.then(() => this.applySelectionHighlight());
  };

  // -- Selection & Cross-Highlight ------------------------------------------

  private applySelectionHighlight(): void {
    const hasSelection = this.selectionManager.hasSelection();
    const selectedIds = this.selectionManager.getSelectionIds() as ISelectionId[];
    const selectedKeys = new Set(selectedIds.map((id) => id.getKey()));

    const data = this.currentData;
    const hasHighlights = data?.hasHighlights ?? false;
    const highlightedKeys = new Set<string>();
    if (hasHighlights && data) {
      for (const box of data.boxes) {
        if (box.highlighted) {
          highlightedKeys.add(box.selectionId.getKey());
        }
      }
    }

    const boxes = this.container.querySelectorAll<SVGElement>(
      '.box-plot-category, .box-plot-violin, .box-plot-notch',
    );
    const shouldDim = hasSelection || hasHighlights;

    for (const el of boxes) {
      if (shouldDim) {
        const elKey = el.getAttribute('data-selection-key');
        const isSelected = hasSelection && elKey !== null && selectedKeys.has(elKey);
        const isHighlighted = hasHighlights && elKey !== null && highlightedKeys.has(elKey);
        el.style.opacity = (isSelected || isHighlighted) ? '' : '0.3';
      } else {
        el.style.opacity = '';
      }
    }
  }

  // -- Cleanup ------------------------------------------------------------

  public destroy(): void {
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.detachEmptySpaceContextMenu?.();
    this.detachEmptySpaceContextMenu = null;
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
  }
}
