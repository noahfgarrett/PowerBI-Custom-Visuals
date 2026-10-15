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
  applyCardStyle,
  type CardStyleMode,
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
  getDateFilterIndices,
  isDateColumn,
  type DateFilterConfig,
  renderInlineLabels,
  type InlineLabelItem,
  buildHighlightedCategoryKeys,
  applyLinkedState,
  buildCategoryBands,
  syncLegendFormattingVisibility,
  syncTitleFormattingVisibility,
  syncCardStyleVisibility,
  type CategoryBand,
  attachEmptySpaceContextMenu,
  getLocalizedString,
  getVisualEmptyStateMode,
  allowInteractions,
  getHostHighContrastColors,
  applyBasicHighContrastStyles,
  notifyRenderingStarted,
  notifyRenderingFinished,
  notifyRenderingFailed,
  prefersReducedMotion,
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
type AreaLabelSide = 'above' | 'below';

interface SeriesData {
  name: string;
  values: (number | null)[];
  highlights: (number | null)[];
  color: string;
}

interface ChartData {
  categories: string[];
  categorySelectionIds: ISelectionId[];
  series: SeriesData[];
  isEmpty: boolean;
  /** Whether cross-highlight data is present from another visual/slicer. */
  hasHighlights: boolean;
}

interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface RenderPoint {
  catIdx: number;
  x: number;
  y: number;
  y0?: number;
  val: number;
  cat: string;
  displayValue: number;
  selectionId: ISelectionId;
}

type AreaLabelAnchor = 'start' | 'middle' | 'end';

interface AreaDataLabel {
  className: string;
  seriesIdx: number;
  selectionKey: string;
  catIdx: number;
  pointX: number;
  pointY: number;
  text: string;
  fill?: string;
}

interface AreaDataLabelPlacement extends AreaDataLabel {
  x: number;
  y: number;
  anchor: AreaLabelAnchor;
  fontSize: number;
  side: AreaLabelSide;
}

interface AreaTextBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface AreaDataLabelBounds {
  top: number;
  bottom: number;
}

interface GapIndicatorDatum {
  catIdx: number;
  seriesAIdx: number;
  seriesBIdx: number;
  x: number;
  yTop: number;
  yBottom: number;
  midY: number;
  color: string;
  lineWidth: number;
  showValue: boolean;
  fontSize: number;
  labelText: string;
}

// ── Constants ───────────────────────────────────────────────────────

const MARGIN_DEFAULT: Margin = { top: 20, right: 20, bottom: 40, left: 50 };
const DOT_HOVER_EXTRA = 2;
const LEGEND_HEIGHT = 28;
const LEGEND_SIDE_WIDTH = 90;
const DATA_LABEL_GAP = 4;
const GAP_LABEL_VERTICAL_PADDING = 6;
const GAP_VALUE_LABEL_OFFSET = 8;
let morphingAreaInstanceCounter = 0;

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
  /** Last extracted data for selection/highlight styling. */
  private currentData: ChartData | null = null;
  private emptyStateMode: 'unconfigured' | 'noData' = 'unconfigured';
  private readonly instanceId = ++morphingAreaInstanceCounter;
  private readonly detachEmptySpaceContextMenu: () => void;

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new MorphingAreaChartSettings();
    this.formattingSettingsService = new FormattingSettingsService(options.host.createLocalizationManager());
    this.container.classList.add('area-chart-container');
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
      this.updateVisual(options);
      this.applyHighContrast();
      notifyRenderingFinished(this.host, options);
    } catch (error) {
      notifyRenderingFailed(this.host, options, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private updateVisual(options: VisualUpdateOptions): void {
    // Cancel running animations before re-render
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];

    // Parse settings from dataView
    const dataView = options.dataViews?.[0];
    this.emptyStateMode = getVisualEmptyStateMode(dataView);
    if (dataView) {
      this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
        MorphingAreaChartSettings,
        dataView,
      );
    }

    // Migrate legacy enableGlass -> cardStyleMode (backward compat)
    const legacyCardObj = dataView?.metadata?.objects?.['cardSettings'];
    if (legacyCardObj) {
      const legacyGlass = legacyCardObj['enableGlass'];
      if (legacyGlass === false && legacyCardObj['cardStyleMode'] == null) {
        this.settings.cardSettings.cardStyleMode.value = { value: 'none', displayName: 'None' };
      }
    }

    // Hide shared properties that are shadowed by local settings

    // Date filter: hide start/end when disabled
    this.settings.dateFilterFormattingCard.startDate.visible = this.settings.dateFilterFormattingCard.enableDateFilter.value;
    this.settings.dateFilterFormattingCard.endAtCurrentDate.visible = this.settings.dateFilterFormattingCard.enableDateFilter.value;
    this.settings.dateFilterFormattingCard.endDate.visible = this.settings.dateFilterFormattingCard.enableDateFilter.value && !this.settings.dateFilterFormattingCard.endAtCurrentDate.value;

    syncTitleFormattingVisibility(this.settings.titleFormattingCard);
    syncLegendFormattingVisibility(this.settings.legendFormattingCard);

    // Card Style — hide sub-settings when mode is 'none'
    syncCardStyleVisibility(this.settings.cardSettings);

    this.settings.lineStrokeFormattingCard.lineWidth.visible = false;
    this.settings.axisFormattingCard.showXAxis.visible = false;
    this.settings.axisFormattingCard.showYAxis.visible = false;
    this.settings.axisFormattingCard.showGridLines.visible = false;
    this.settings.axisFormattingCard.integerTicks.visible = false;
    this.settings.axisFormattingCard.xAxisTitle.visible = this.settings.axisSettings.showXAxis.value;
    this.settings.axisFormattingCard.yAxisTitle.visible = this.settings.axisSettings.showYAxis.value;
    this.settings.axisFormattingCard.axisLabelFontFamily.visible = false;
    this.settings.axisFormattingCard.axisLabelRotation.visible = this.settings.axisSettings.showXAxis.value;
    this.settings.axisFormattingCard.yAxisMin.visible = false;
    this.settings.axisFormattingCard.yAxisMax.visible = false;
    this.settings.axisFormattingCard.gridLineWidth.visible = false;
    this.settings.axisFormattingCard.gridLineOpacity.visible = false;
    this.settings.axisFormattingCard.gridLineColor.visible = this.settings.axisSettings.gridLines.value;
    this.settings.axisFormattingCard.gridLineStyle.visible = this.settings.axisSettings.gridLines.value;

    // Hide dual-axis-only properties (no combo/dual-axis support)
    this.settings.referenceLineFormattingCard.referenceLineAxis.visible = false;
    this.settings.referenceLineFormattingCard.referenceBandWidth.visible = this.settings.referenceLineFormattingCard.showReferenceBand.value;
    this.settings.trendLineFormattingCard.trendLineAxis.visible = false;

    // Conditional visibility: hide child settings when parent toggle is off
    this.settings.areaForecastSettings.periods.visible = this.settings.areaForecastSettings.show.value;
    this.settings.areaForecastSettings.opacity.visible = this.settings.areaForecastSettings.show.value;
    this.settings.areaFillSettings.forecastLineOpacity.visible = this.settings.areaForecastSettings.show.value;
    this.settings.areaFillSettings.forecastBandOpacity.visible = this.settings.areaForecastSettings.show.value;
    this.settings.areaFillSettings.mode.visible = this.settings.areaFillSettings.showArea.value;
    this.settings.interactionSettings.contextHeight.visible = this.settings.interactionSettings.brushEnabled.value;
    this.settings.interactionSettings.brushColor.visible = this.settings.interactionSettings.brushEnabled.value;
    this.settings.interactionSettings.brushOpacity.visible = this.settings.interactionSettings.brushEnabled.value;
    this.settings.areaFillSettings.threshold.visible = this.settings.areaFillSettings.showThreshold.value;
    this.settings.areaFillSettings.aboveColor.visible = this.settings.areaFillSettings.showThreshold.value;
    this.settings.areaFillSettings.belowColor.visible = this.settings.areaFillSettings.showThreshold.value;
    this.settings.areaFillSettings.thresholdLineColor.visible = this.settings.areaFillSettings.showThreshold.value;
    this.settings.areaFillSettings.thresholdLineWidth.visible = this.settings.areaFillSettings.showThreshold.value;
    this.settings.areaFillSettings.thresholdLineOpacity.visible = this.settings.areaFillSettings.showThreshold.value;
    this.settings.areaFillSettings.fillOpacity.visible = this.settings.areaFillSettings.showArea.value;
    this.settings.areaFillSettings.useGradient.visible = this.settings.areaFillSettings.showArea.value;
    this.settings.lineSettings.dotRadius.visible = this.settings.lineSettings.showDots.value;
    this.settings.lineSettings.dotStrokeColor.visible = this.settings.lineSettings.showDots.value;
    this.settings.lineSettings.dotStrokeWidth.visible = this.settings.lineSettings.showDots.value;
    this.settings.axisSettings.xAxisLabelPadding.visible = this.settings.axisSettings.showXAxis.value;
    this.settings.animationSettings.duration.visible = this.settings.animationSettings.enabled.value;
    this.settings.gapIndicatorSettings.gapFontSize.visible = this.settings.gapIndicatorSettings.showGapIndicator.value
      && this.settings.gapIndicatorSettings.showGapValue.value;

    // Vertical band: hide sub-settings when disabled
    this.settings.verticalBandSettings.startValue.visible = this.settings.verticalBandSettings.show.value;
    this.settings.verticalBandSettings.endValue.visible = this.settings.verticalBandSettings.show.value;
    this.settings.verticalBandSettings.bandColor.visible = this.settings.verticalBandSettings.show.value;
    this.settings.verticalBandSettings.bandOpacity.visible = this.settings.verticalBandSettings.show.value;
    this.settings.verticalBandSettings.bandLabel.visible = this.settings.verticalBandSettings.show.value;

    // Extract data
    const data = this.extractData(dataView);
    this.currentData = data;

    const gapAvailable = data.series.length >= 2;
    const gapOn = gapAvailable && this.settings.gapIndicatorSettings.showGapIndicator.value;
    this.settings.gapIndicatorSettings.showGapIndicator.visible = gapAvailable;
    this.settings.gapIndicatorSettings.gapSeriesA.visible = gapOn;
    this.settings.gapIndicatorSettings.gapSeriesB.visible = gapOn;
    this.settings.gapIndicatorSettings.gapInterval.visible = gapOn;
    this.settings.gapIndicatorSettings.gapColor.visible = gapOn;
    this.settings.gapIndicatorSettings.gapLineWidth.visible = gapOn;
    this.settings.gapIndicatorSettings.showGapValue.visible = gapOn;
    this.settings.gapIndicatorSettings.gapFontSize.visible =
      gapOn && this.settings.gapIndicatorSettings.showGapValue.value;

    // Populate per-series formatting groups and cache resolved formats
    this.populateSeriesFormattingGroups(dataView, data);
    this.cachedSeriesFormats = data.series.map((s, i) => resolveSeriesFormatting(this.settings.seriesFormattingCard, i, s.color));

    // Render
    if (data.isEmpty) {
      this.renderEmpty();
    } else {
      this.render(data, options.viewport);
      this.applySelectionHighlight();
    }

    // Apply card styling AFTER render — render clears the container, which would destroy the glass backdrop div.
    this.applyCardStyle();
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

    const includedIndices = categoryColumn.values
      .map((_, index) => index)
      .filter((index) => !dateIndices || dateIndices.has(index));

    // Keep the x-axis and each series aligned to the same filtered rows.
    const categories = includedIndices.map((index) => {
      const value = categoryColumn.values[index];
      return value !== null && value !== undefined ? String(value) : '';
    });
    const categorySelectionIds = includedIndices.map((index) =>
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
        const vals = includedIndices.map((index) => {
          const value = col.values[index];
          return typeof value === 'number' ? value : null;
        });
        const hlRaw = col.highlights as unknown[] | undefined;
        const highlights = hlRaw
          ? includedIndices.map((index) => {
            const value = hlRaw[index];
            return typeof value === 'number' ? value : null;
          })
          : vals.map(() => null);
        series.push({
          name: col.source.displayName ?? `Series ${series.length + 1}`,
          values: vals,
          highlights,
          color: getHostChartColor(this.host.colorPalette, colorIdx, themeName),
        });
        colorIdx++;
      }
    }

    const hasValues = series.some(s => s.values.some(v => v !== null));
    const hasHighlights = series.some(s => s.highlights.some(h => h !== null));

    return {
      categories,
      categorySelectionIds,
      series,
      isEmpty: series.length === 0 || !hasValues,
      hasHighlights,
    };
  }

  // ── Card Style ────────────────────────────────────────────────────

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

  // ── Empty State ───────────────────────────────────────────────────

  private renderEmpty(): void {
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    this.container.removeAttribute('role');
    this.container.removeAttribute('aria-label');
    const emptyEl = document.createElement('div');
    emptyEl.className = 'area-chart-empty';
    emptyEl.setAttribute('role', 'status');
    emptyEl.setAttribute('aria-live', 'polite');
    emptyEl.textContent = this.emptyStateMode === 'noData'
      ? getLocalizedString(this.host, 'MorphingAreaChart_NoDataState', 'No data for the current selection.')
      : getLocalizedString(this.host, 'MorphingAreaChart_EmptyState', 'Add a Category and at least one Measure to get started.');
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
    const contentPadding = Math.max(0, s.cardSettings.contentPadding.value);
    this.container.style.padding = `${contentPadding}px`;

    // Legend dimensions
    const showLegend = s.legendFormattingCard.showLegend.value;
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
    const xAxisLabelPadding = Math.max(0, s.axisSettings.xAxisLabelPadding.value);
    if (xAxisTitle && s.axisSettings.showXAxis.value) margin.bottom += 20;
    if (yAxisTitle && s.axisSettings.showYAxis.value) margin.left += 18;

    // Reserve extra space for x-axis labels (bottom + left/right overhang).
    // The leftmost and rightmost labels can extend past the chart area depending
    // on rotation: unrotated (text-anchor: middle) overhangs both sides by
    // labelWidth/2; negative rotation (text-anchor: end) overhangs left by
    // labelWidth*cos(angle); positive rotation (text-anchor: start) overhangs
    // right by the same. Without accounting for this, the leftmost category
    // label clips off the SVG's left edge.
    const labelRotation = s.axisFormattingCard.axisLabelRotation.value;
    if (s.axisSettings.showXAxis.value && data.categories.length > 0) {
      const maxLabelLen = Math.max(...data.categories.map((c) => c.length), 0);
      const avgCharWidth = (s.axisFormattingCard.axisLabelSize.value ?? 11) * 0.6;
      const labelWidth = maxLabelLen * avgCharWidth;
      const absAngleRad = Math.abs(labelRotation) * (Math.PI / 180);

      if (labelRotation !== 0) {
        // Rotated labels extend downward; reserve bottom space too.
        margin.bottom += Math.ceil(labelWidth * Math.sin(absAngleRad));
      }
      margin.bottom += Math.max(0, xAxisLabelPadding + 4);

      let leftOverhang = 0;
      let rightOverhang = 0;
      if (labelRotation === 0) {
        leftOverhang = labelWidth / 2;
        rightOverhang = labelWidth / 2;
      } else if (labelRotation < 0) {
        leftOverhang = labelWidth * Math.cos(absAngleRad);
      } else {
        rightOverhang = labelWidth * Math.cos(absAngleRad);
      }
      margin.left = Math.max(margin.left, Math.ceil(leftOverhang) + 4);
      margin.right = Math.max(margin.right, Math.ceil(rightOverhang) + 4);
    }

    // Reserve right margin for inline end-of-line labels
    if (s.legendFormattingCard.showInlineLabels.value) {
      const inlineFontSize = Math.max(1, s.legendFormattingCard.inlineLabelFontSize.value || 11);
      const inlineOffset = Math.max(0, s.legendFormattingCard.inlineLabelOffset.value || 0);
      const maxSeriesNameLength = Math.max(...data.series.map((series) => series.name.length), 0);
      const estimatedInlineWidth = maxSeriesNameLength * inlineFontSize * 0.58 + inlineFontSize + 12;
      const estimatedSvgWidth = Math.max(1, viewport.width - contentPadding * 2 - legendReserveH);
      const builtInRightPointInset = estimatedSvgWidth / Math.max(2, data.categories.length * 2);
      margin.right += Math.ceil(Math.max(48, inlineOffset + estimatedInlineWidth - builtInRightPointInset + 8));
    }

    const dataLabelFontSize = Math.max(1, s.dataLabelFormattingCard.dataLabelFontSize.value || 11);
    const dataLabelOverflow = s.dataLabelFormattingCard.showDataLabels.value
      ? Math.ceil(dataLabelFontSize + 10)
      : 0;

    // Compute chart dimensions
    const padding = contentPadding;
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
      wrapper.style.position = 'relative';
      wrapper.style.flexDirection = legendPos === 'left' ? 'row' : 'row-reverse';
      wrapper.style.width = '100%';
      wrapper.style.height = '100%';
    } else {
      wrapper.style.display = 'flex';
      wrapper.style.position = 'relative';
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
    const dataLabelBounds: AreaDataLabelBounds = {
      top: -Math.min(dataLabelOverflow, Math.max(0, margin.top - 2)),
      bottom: chartHeight,
    };

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
    const stackMode = resolveDropdown(s.areaFillSettings.mode) ?? 'normal';
    const isStacked = stackMode === 'stacked' || stackMode === 'stacked100' || stackMode === 'stream';
    const isStream = stackMode === 'stream';

    const buildStackGeometry = (source: 'values' | 'highlights'): { baselines: number[][]; tops: number[][] } => {
      const baselines: number[][] = [];
      const tops: number[][] = [];

      if (!isStacked) {
        return { baselines, tops };
      }

      if (isStream) {
        const seriesKeys = data.series.map((_, i) => String(i));
        const tabularData = data.categories.map((_, ci) => {
          const row: Record<string, number> = {};
          for (let si = 0; si < data.series.length; si++) {
            const sourceValues = source === 'highlights' ? data.series[si].highlights : data.series[si].values;
            row[String(si)] = sourceValues[ci] ?? 0;
          }
          return row;
        });

        const stackGen = d3.stack<Record<string, number>>()
          .keys(seriesKeys)
          .offset(d3.stackOffsetWiggle)
          .order(d3.stackOrderInsideOut);

        const stackResult = stackGen(tabularData);
        for (let si = 0; si < data.series.length; si++) {
          baselines.push([]);
          tops.push([]);
        }
        for (const layer of stackResult) {
          const si = Number(layer.key);
          for (let ci = 0; ci < data.categories.length; ci++) {
            baselines[si].push(layer[ci][0]);
            tops[si].push(layer[ci][1]);
          }
        }
        return { baselines, tops };
      }

      const catCount = data.categories.length;
      const runningTotals = new Array<number>(catCount).fill(0);
      const catTotals = stackMode === 'stacked100'
        ? data.categories.map((_, ci) =>
            data.series.reduce((sum, ser) => {
              const sourceValues = source === 'highlights' ? ser.highlights : ser.values;
              return sum + Math.abs(sourceValues[ci] ?? 0);
            }, 0) || 1)
        : null;

      for (let si = 0; si < data.series.length; si++) {
        const seriesSourceValues = source === 'highlights' ? data.series[si].highlights : data.series[si].values;
        const seriesBaselines: number[] = [];
        const seriesTops: number[] = [];
        for (let ci = 0; ci < catCount; ci++) {
          let val = seriesSourceValues[ci] ?? 0;
          if (catTotals) val = (val / catTotals[ci]) * 100;
          seriesBaselines.push(runningTotals[ci]);
          runningTotals[ci] += val;
          seriesTops.push(runningTotals[ci]);
        }
        baselines.push(seriesBaselines);
        tops.push(seriesTops);
      }

      return { baselines, tops };
    };

    const { baselines: stackBaselines, tops: stackTops } = buildStackGeometry('values');
    const { baselines: highlightStackBaselines, tops: highlightStackTops } = data.hasHighlights
      ? buildStackGeometry('highlights')
      : { baselines: [], tops: [] };

    const allValues = isStream
      ? [...stackBaselines.flat(), ...stackTops.flat()]
      : isStacked
        ? (stackMode === 'stacked100'
            ? [0, 100]
            : [0, d3.max(stackTops[stackTops.length - 1] ?? [0]) ?? 0])
        : data.series.flatMap((ser) =>
            ser.values.filter((v): v is number => v !== null));
    const yMax = d3.max(allValues) ?? 0;
    const yMin = d3.min(allValues) ?? 0;
    const domainMin = (isStacked && !isStream) ? 0 : Math.min(0, yMin);
    const y = d3.scaleLinear()
      .domain([domainMin, ((isStacked && !isStream) ? yMax : yMax * 1.1) || 1])
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
        .call(d3.axisBottom(x).tickSize(0).tickPadding(xAxisLabelPadding));

      xAxisGroup.select('.domain').remove();

      // Apply label rotation from the axis formatting card
      if (labelRotation !== 0) {
        xAxisGroup.selectAll('text')
          .attr('transform', `rotate(${labelRotation})`)
          .style('text-anchor', labelRotation < 0 ? 'end' : 'start')
          .attr('dx', labelRotation < 0 ? '-0.5em' : '0.5em')
          .attr('dy', '0.25em');
      } else {
        // No rotation — center labels directly under data points
        xAxisGroup.selectAll('text')
          .style('text-anchor', 'middle');
      }
    }

    if (s.axisSettings.showYAxis.value && !isStream) {
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

    // Vertical reference band
    this.renderVerticalBand(chartGroup, x, chartHeight);

    // Curve function
    const curveFn = this.getCurveFunction();

    // Animation settings
    const animEnabled = s.animationSettings.enabled.value && !prefersReducedMotion();
    const animDuration = s.animationSettings.duration.value;
    const showArea = s.areaFillSettings.showArea.value;
    const showDots = s.lineSettings.showDots.value;
    const dotRadius = this.settings.lineSettings.dotRadius.value;
    const lineWidth = s.lineSettings.lineWidth.value;
    const fillOpacity = s.areaFillSettings.fillOpacity.value / 100;
    const useGradient = s.areaFillSettings.useGradient.value;
    const showDataLabels = s.dataLabelFormattingCard.showDataLabels.value;
    const pendingDataLabels: AreaDataLabel[] = [];

    const chartGroupNode = chartGroup.node();
    const categoryBands = buildCategoryBands(
      data.categories.map((cat) => x(cat) ?? 0),
      chartWidth,
    );

    const renderSeriesLayer = (opts: {
      series: SeriesData;
      seriesIdx: number;
      validPoints: RenderPoint[];
      opacityFactor: number;
      classNamePrefix?: 'highlight';
      enableAnimation?: boolean;
      useGradientFill?: boolean;
      fillOpacityFactor?: number;
    }): void => {
      const {
        series,
        seriesIdx,
        validPoints,
        opacityFactor,
        classNamePrefix,
        enableAnimation = animEnabled,
        useGradientFill = useGradient,
        fillOpacityFactor = fillOpacity,
      } = opts;
      if (validPoints.length === 0) return;

      const sf = this.cachedSeriesFormats[seriesIdx] ?? resolveSeriesFormatting(this.settings.seriesFormattingCard, seriesIdx, series.color);
      const seriesDelay = seriesIdx * 150;
      const fillClass = classNamePrefix ? 'area-fill area-highlight-fill' : 'area-fill';
      const lineClass = classNamePrefix ? 'area-line area-highlight-line' : 'area-line';
      const dotClass = classNamePrefix ? 'area-dot area-highlight-dot' : 'area-dot';
      const labelClass = classNamePrefix ? 'area-data-label area-highlight-data-label' : 'area-data-label';

      if (showArea && validPoints.length >= 2) {
        const gradientId = `area-grad-${this.instanceId}-${this.renderGeneration}-${classNamePrefix ?? 'base'}-${seriesIdx}`;
        const effectiveFillOpacity = fillOpacityFactor * opacityFactor;

        if (useGradientFill) {
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

        const areaGen = d3.area<RenderPoint>()
          .x((d) => d.x)
          .y0((d) => d.y0 !== undefined ? d.y0 : chartHeight)
          .y1((d) => d.y)
          .curve(curveFn);

        const areaPath = chartGroup.append('path')
          .datum(validPoints)
          .attr('class', fillClass)
          .attr('data-series', String(seriesIdx))
          .attr('d', areaGen as unknown as d3.ValueFn<SVGPathElement, RenderPoint[], string | null>)
          .attr('fill', useGradientFill ? `url(#${gradientId})` : withOpacity(sf.color, effectiveFillOpacity))
          .style('transition', 'opacity 0.15s ease');

        if (chartGroupNode) {
          this.bindCategorySelection(areaPath, chartGroupNode, x, data);
        }

        if (enableAnimation) {
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

      if (validPoints.length >= 2) {
        const lineGen = d3.line<RenderPoint>()
          .x((d) => d.x)
          .y((d) => d.y)
          .curve(curveFn);
        const effectiveLineStyle = sf.lineStyle !== 'solid' ? sf.lineStyle
          : ((this.settings.lineStrokeFormattingCard.lineStyle.value as
            { value?: string } | undefined)?.value ?? 'solid');
        const strokeDash = lineStyleToDashArray(effectiveLineStyle);

        const linePath = chartGroup.append('path')
          .datum(validPoints)
          .attr('class', lineClass)
          .attr('data-series', String(seriesIdx))
          .attr('d', lineGen)
          .attr('stroke', sf.color)
          .attr('stroke-width', sf.lineWidth)
          .attr('stroke-dasharray', strokeDash)
          .attr('opacity', opacityFactor)
          .style('transition', 'opacity 0.15s ease');

        if (chartGroupNode) {
          this.bindCategorySelection(linePath, chartGroupNode, x, data);
        }

        if (enableAnimation) {
          const lineNode = linePath.node();
          if (lineNode) {
            const cancel = drawPath(lineNode, animDuration, seriesDelay);
            this.cancelAnimations.push(cancel);
          }
        }
      }

      if (showDots) {
        validPoints.forEach((pt, ptIdx) => {
          const conditionalDotColor = this.getConditionalColor(pt.val);
          const dot = chartGroup.append('circle')
            .attr('class', dotClass)
            .attr('data-series', String(seriesIdx))
            .attr('data-selection-key', pt.selectionId.getKey())
            .attr('data-category', pt.cat)
            .attr('data-value', String(pt.val))
            .attr('cx', pt.x)
            .attr('cy', pt.y)
            .attr('r', dotRadius)
            .attr('fill', conditionalDotColor ?? sf.color)
            .attr('opacity', opacityFactor)
            .attr('stroke', this.settings.lineSettings.dotStrokeColor.value?.value || '#FFFFFF')
            .attr('stroke-width', this.settings.lineSettings.dotStrokeWidth.value)
            .style('transition', 'opacity 0.15s ease');

          this.attachDotTooltip(dot, pt.cat, series.name, pt.val, pt.selectionId);

          const dotHoverRadius = dotRadius + DOT_HOVER_EXTRA;
          dot.on('mouseenter', function () {
            d3.select(this).attr('r', dotHoverRadius);
          });
          dot.on('mouseleave', function () {
            d3.select(this).attr('r', dotRadius);
          });
          dot
            .style('cursor', allowInteractions(this.host) ? 'pointer' : 'default')
            .on('click', (event: MouseEvent) => {
              event.stopPropagation();
              if (!allowInteractions(this.host)) return;
              void this.selectionManager.select(pt.selectionId, event.ctrlKey || event.metaKey).then(() => {
                this.applySelectionHighlight();
              });
            })
            .on('contextmenu', (event: MouseEvent) => {
              event.preventDefault();
              event.stopPropagation();
              if (!allowInteractions(this.host)) return;
              void this.selectionManager.showContextMenu(pt.selectionId, {
                x: event.clientX,
                y: event.clientY,
              });
            });

          if (enableAnimation) {
            const dotNode = dot.node();
            if (dotNode) {
              const dotDelay = seriesDelay + ptIdx * 40;
              const cancel = popIn(dotNode, dotDelay, 400);
              this.cancelAnimations.push(cancel);
            }
          }
        });
      }

      if (showDataLabels && sf.showLabels) {
        validPoints.forEach((pt) => {
          const conditionalLabelColor = this.getConditionalColor(pt.val);
          pendingDataLabels.push({
            className: labelClass,
            seriesIdx,
            selectionKey: pt.selectionId.getKey(),
            catIdx: pt.catIdx,
            pointX: pt.x,
            pointY: pt.y,
            text: formatWithSettings(pt.val, this.settings.numberFormattingCard),
            fill: conditionalLabelColor,
          });
        });
      }
    };

    data.series.forEach((series, seriesIdx) => {
      const sf = this.cachedSeriesFormats[seriesIdx] ?? resolveSeriesFormatting(this.settings.seriesFormattingCard, seriesIdx, series.color);
      const validPoints = this.buildRenderPoints(
        data,
        series,
        seriesIdx,
        x,
        y,
        stackMode,
        stackBaselines,
        stackTops,
      );
      renderSeriesLayer({
        series,
        seriesIdx,
        validPoints,
        opacityFactor: data.hasHighlights ? Math.max(0.12, (sf.opacity / 100) * 0.18) : sf.opacity / 100,
      });
    });

    if (data.hasHighlights) {
      data.series.forEach((series, seriesIdx) => {
        const sf = this.cachedSeriesFormats[seriesIdx] ?? resolveSeriesFormatting(this.settings.seriesFormattingCard, seriesIdx, series.color);
        const highlightSeries: SeriesData = {
          ...series,
          values: series.highlights,
        };
        const highlightPoints = this.buildRenderPoints(
          data,
          highlightSeries,
          seriesIdx,
          x,
          y,
          stackMode,
          highlightStackBaselines,
          highlightStackTops,
        );
        renderSeriesLayer({
          series,
          seriesIdx,
          validPoints: highlightPoints,
          opacityFactor: sf.opacity / 100,
          classNamePrefix: 'highlight',
          enableAnimation: false,
          useGradientFill: false,
          fillOpacityFactor: Math.max(fillOpacity, 0.24),
        });
      });
    }

    this.renderLinkedBands(chartGroup, categoryBands, chartHeight, data.categorySelectionIds);

    // ── Inline end-of-line labels ──────────────────────────────────
    if (s.legendFormattingCard.showInlineLabels.value && data.series.length > 0) {
      const inlineItems: InlineLabelItem[] = [];
      data.series.forEach((series, seriesIdx) => {
        const sf = this.cachedSeriesFormats[seriesIdx] ?? resolveSeriesFormatting(this.settings.seriesFormattingCard, seriesIdx, series.color);
        // Find last non-null value
        for (let i = data.categories.length - 1; i >= 0; i--) {
          const val = series.values[i];
          if (val !== null) {
            const px = x(data.categories[i]);
            if (px !== undefined) {
              const stackedTop = isStacked ? stackTops[seriesIdx][i] : val;
              inlineItems.push({
                label: series.name,
                x: px,
                y: y(stackedTop),
                color: sf.color,
              });
            }
            break;
          }
        }
      });

      const chartGroupNode = chartGroup.node();
      if (chartGroupNode && inlineItems.length > 0) {
        renderInlineLabels(chartGroupNode, {
          items: inlineItems,
          fontSize: s.legendFormattingCard.inlineLabelFontSize.value,
          offset: s.legendFormattingCard.inlineLabelOffset.value,
        });
      }
    }

    // ── Gap / Distance Indicators + collision-aware labels ──────────
    const gapIndicators = this.buildGapIndicators(data, x, y, stackMode, stackTops);
    this.renderGapIndicatorLines(chartGroup, gapIndicators);
    this.renderAreaDataLabels(chartGroup, pendingDataLabels, gapIndicators, stackMode, chartHeight, dotRadius, dataLabelBounds);
    this.renderGapIndicatorValues(chartGroup, gapIndicators);

    // ── Forecast Projection ────────────────────────────────────
    if (s.areaForecastSettings.show.value && data.series.length > 0) {
      const forecastPeriods = s.areaForecastSettings.periods.value;
      const forecastOpacity = s.areaForecastSettings.opacity.value / 100;

      if (forecastPeriods > 0) {
        // Create a clip path to constrain forecast within chart bounds
        const forecastClipId = `forecast-clip-${this.instanceId}-${this.renderGeneration}`;
        const forecastClip = defs.append('clipPath').attr('id', forecastClipId);
        forecastClip.append('rect')
          .attr('x', 0)
          .attr('y', 0)
          .attr('width', chartWidth)
          .attr('height', chartHeight);

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
            .attr('opacity', s.areaFillSettings.forecastLineOpacity.value / 100)
            .attr('clip-path', `url(#${forecastClipId})`);

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
            .attr('opacity', s.areaFillSettings.forecastBandOpacity.value / 100)
            .attr('clip-path', `url(#${forecastClipId})`);
        });
      }
    }

    // ── Threshold Zone ─────────────────────────────────────────
    if (s.areaFillSettings.showThreshold.value && data.series.length > 0) {
      const thresholdVal = s.areaFillSettings.threshold.value;
      const aboveColor = s.areaFillSettings.aboveColor.value?.value ?? '#22C55E';
      const belowColor = s.areaFillSettings.belowColor.value?.value ?? '#EF4444';
      const thresholdY = y(thresholdVal);

      // Draw a threshold reference line
      const thresholdLineColor = s.areaFillSettings.thresholdLineColor.value?.value ?? '#94A3B8';
      const thresholdLineWidth = s.areaFillSettings.thresholdLineWidth.value;
      chartGroup.append('line')
        .attr('class', 'area-threshold-line')
        .attr('x1', 0)
        .attr('x2', chartWidth)
        .attr('y1', thresholdY)
        .attr('y2', thresholdY)
        .attr('stroke', thresholdLineColor)
        .attr('stroke-width', thresholdLineWidth)
        .attr('stroke-dasharray', '4 3')
        .attr('opacity', s.areaFillSettings.thresholdLineOpacity.value / 100);

      // Render colored overlay areas for above/below threshold per series
      const thresholdDefs = svg.select('defs');
      data.series.forEach((series, seriesIdx) => {
        const sf = this.cachedSeriesFormats[seriesIdx] ?? resolveSeriesFormatting(this.settings.seriesFormattingCard, seriesIdx, series.color);
        const pts = series.values
          .map((val, i) => val !== null ? { x: x(data.categories[i]) ?? 0, y: y(val), val } : null)
          .filter((p): p is { x: number; y: number; val: number } => p !== null);

        if (pts.length < 2) return;

        // Clip path for above threshold
        const aboveClipId = `thresh-above-${this.instanceId}-${this.renderGeneration}-${seriesIdx}`;
        const aboveClip = thresholdDefs.append('clipPath').attr('id', aboveClipId);
        aboveClip.append('rect')
          .attr('x', 0)
          .attr('y', 0)
          .attr('width', chartWidth)
          .attr('height', thresholdY);

        // Clip path for below threshold
        const belowClipId = `thresh-below-${this.instanceId}-${this.renderGeneration}-${seriesIdx}`;
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
    if (s.interactionSettings.brushEnabled.value) {
      this.renderBrushContext({
        svg,
        defs,
        mainChartGroup: chartGroup,
        data,
        stackMode,
        stackBaselines,
        stackTops,
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
        const xPositions = data.categories.map((cat) => x(cat) ?? 0);
        const crosshairCleanup = attachCrosshair(buildCrosshairConfig({
          svg: svgEl2,
          chartGroup: chartGroupNode,
          marginLeft: margin.left,
          marginTop: margin.top,
          chartWidth,
          chartHeight,
          categories: data.categories,
          xPositions,
          series: data.series.map((ser, seriesIdx) => {
            const activeValues = (data.hasHighlights ? ser.highlights : ser.values).map((value) => value ?? NaN);
            const markerValues = activeValues.map((value, catIdx) => {
              if (!Number.isFinite(value)) return NaN;
              if (!isStacked) return value;
              const tops = data.hasHighlights ? highlightStackTops : stackTops;
              return tops[seriesIdx]?.[catIdx] ?? value;
            });
            return {
              name: ser.name,
              values: activeValues,
              displayValues: activeValues,
              markerValues,
              color: (this.cachedSeriesFormats[seriesIdx]?.color ?? ser.color),
            };
          }),
          yScale: y,
          lineColor: s.crosshairFormattingCard.crosshairLineColor.value?.value || '#94A3B8',
          lineWidth: s.crosshairFormattingCard.crosshairLineWidth.value,
          lineStyle: chStyleVal,
          lineOpacity: Math.max(0, Math.min(100, s.crosshairFormattingCard.crosshairOpacity.value)) / 100,
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
          this.applySelectionHighlight();
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
    stackMode: string;
    stackBaselines: number[][];
    stackTops: number[][];
    xScale: d3.ScalePoint<string>;
    yScale: d3.ScaleLinear<number, number>;
    chartWidth: number;
    chartHeight: number;
    margin: Margin;
    curveFn: d3.CurveFactory;
  }): void {
    const { svg, defs, mainChartGroup, data, stackMode, stackBaselines, stackTops, xScale, yScale, chartWidth, chartHeight, margin, curveFn } = opts;
    const bs = this.settings.interactionSettings;
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
        const isStacked = stackMode === 'stacked' || stackMode === 'stacked100' || stackMode === 'stream';
        const isStream = stackMode === 'stream';
        data.series.forEach((series, seriesIdx) => {
          data.categories.forEach((cat, i) => {
            if (!catSet.has(cat) || series.values[i] === null) return;
            if (isStacked) {
              if (isStream) {
                visibleValues.push(stackBaselines[seriesIdx]?.[i] ?? 0);
              }
              visibleValues.push(stackTops[seriesIdx]?.[i] ?? 0);
              return;
            }
            visibleValues.push(series.values[i] as number);
          });
        });
        const newYMax = d3.max(visibleValues) ?? 0;
        const newYMin = d3.min(visibleValues) ?? 0;
        const newDomainMin = (isStacked && !isStream) ? 0 : Math.min(0, newYMin);
        yScale.domain([newDomainMin, ((isStacked && !isStream) ? newYMax : newYMax * 1.1) || 1]).nice();

        // Re-render main chart paths
        this.updateMainChartPaths(
          mainChartGroup,
          defs,
          data,
          stackMode,
          stackBaselines,
          stackTops,
          xScale,
          yScale,
          curveFn,
          chartWidth,
          chartHeight,
        );
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
    defs: d3.Selection<SVGDefsElement, unknown, null, undefined>,
    data: ChartData,
    stackMode: string,
    stackBaselines: number[][],
    stackTops: number[][],
    xScale: d3.ScalePoint<string>,
    yScale: d3.ScaleLinear<number, number>,
    curveFn: d3.CurveFactory,
    chartWidth: number,
    chartHeight: number,
  ): void {
    // Remove existing paths, dots, and data labels in the main chart
    chartGroup.selectAll('.area-fill, .area-line, .area-dot, .area-data-label, .area-highlight-fill, .area-highlight-line, .area-highlight-dot, .area-highlight-data-label, .area-linked-bands').remove();

    // Remove and redraw axes
    chartGroup.selectAll('.area-axis').remove();
    chartGroup.selectAll('.area-grid').remove();

    // Clear old gradient defs and bump generation for brush updates
    defs.selectAll('linearGradient[id^="area-grad-"]').remove();
    this.renderGeneration++;

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
      const xAxisLabelPadding = Math.max(0, s.axisSettings.xAxisLabelPadding.value);
      const xAxisGroup = chartGroup.append('g')
        .attr('class', 'area-axis area-axis-x')
        .attr('transform', `translate(0,${chartHeight})`)
        .call(d3.axisBottom(xScale).tickSize(0).tickPadding(xAxisLabelPadding));
      xAxisGroup.select('.domain').remove();

      // Apply label rotation from the axis formatting card
      const brushLabelRotation = s.axisFormattingCard.axisLabelRotation.value;
      if (brushLabelRotation !== 0) {
        xAxisGroup.selectAll('text')
          .attr('transform', `rotate(${brushLabelRotation})`)
          .style('text-anchor', brushLabelRotation < 0 ? 'end' : 'start')
          .attr('dx', brushLabelRotation < 0 ? '-0.5em' : '0.5em')
          .attr('dy', '0.25em');
      } else {
        xAxisGroup.selectAll('text')
          .style('text-anchor', 'middle');
      }
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

    const showArea = s.areaFillSettings.showArea.value;
    const fillOpacity = s.areaFillSettings.fillOpacity.value / 100;
    const useGradient = s.areaFillSettings.useGradient.value;
    const domainCats = new Set(xScale.domain());
    const chartGroupNode = chartGroup.node();

    data.series.forEach((series, seriesIdx) => {
      const sf = this.cachedSeriesFormats[seriesIdx] ?? resolveSeriesFormatting(this.settings.seriesFormattingCard, seriesIdx, series.color);
      const seriesOpacityFactor = sf.opacity / 100;

      const validPoints = this.buildRenderPoints(
        data,
        series,
        seriesIdx,
        xScale,
        yScale,
        stackMode,
        stackBaselines,
        stackTops,
        domainCats,
      );

      if (validPoints.length < 2) return;

      const effectiveFillOpacity = fillOpacity * seriesOpacityFactor;

      // Area fill
      if (showArea) {
        const gradientId = `area-grad-${this.instanceId}-${this.renderGeneration}-${seriesIdx}`;

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

        const areaGen = d3.area<RenderPoint>()
          .x((d) => d.x)
          .y0((d) => d.y0 !== undefined ? d.y0 : chartHeight)
          .y1((d) => d.y)
          .curve(curveFn);

        const areaPath = chartGroup.append('path')
          .datum(validPoints)
          .attr('class', 'area-fill')
          .attr('data-series', String(seriesIdx))
          .attr('d', areaGen)
          .attr('fill', useGradient ? `url(#${gradientId})` : withOpacity(sf.color, effectiveFillOpacity));

        if (chartGroupNode) {
          this.bindCategorySelection(areaPath, chartGroupNode, xScale, data);
        }
      }

      // Line path
      const lineGen = d3.line<RenderPoint>()
        .x((d) => d.x)
        .y((d) => d.y)
        .curve(curveFn);

      const linePath = chartGroup.append('path')
        .datum(validPoints)
        .attr('class', 'area-line')
        .attr('data-series', String(seriesIdx))
        .attr('d', lineGen)
        .attr('stroke', sf.color)
        .attr('stroke-width', sf.lineWidth)
        .attr('opacity', seriesOpacityFactor);

      if (chartGroupNode) {
        this.bindCategorySelection(linePath, chartGroupNode, xScale, data);
      }
    });

    this.renderLinkedBands(
      chartGroup,
      buildCategoryBands(xScale.domain().map((cat) => xScale(cat) ?? 0), chartWidth),
      chartHeight,
      data.categorySelectionIds.filter((_id, index) => domainCats.has(data.categories[index])),
    );
    this.applySelectionHighlight();

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

    const bandWidthPct = ref.referenceBandWidth.value / 100;
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
      bandUpperValue: refValue * (1 + bandWidthPct),
      bandLowerValue: refValue * (1 - bandWidthPct),
      bandOpacity: ref.referenceBandOpacity.value / 100,
    });
  }

  // ── Vertical Reference Band ──────────────────────────────────────────

  /**
   * Renders a semi-transparent vertical band between two x-axis categories.
   * Optionally renders a label at the top of the band.
   */
  private renderVerticalBand(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    xScale: d3.ScalePoint<string>,
    chartHeight: number,
  ): void {
    const vb = this.settings.verticalBandSettings;
    if (!vb.show.value) return;

    const startCat = vb.startValue.value;
    const endCat = vb.endValue.value;
    if (!startCat || !endCat) return;

    const x1 = xScale(startCat);
    const x2 = xScale(endCat);
    if (x1 === undefined || x2 === undefined) return;

    const bandLeft = Math.min(x1, x2);
    const bandRight = Math.max(x1, x2);
    const bandWidth = bandRight - bandLeft;

    if (bandWidth <= 0) return;

    const bandColor = vb.bandColor.value?.value ?? '#3B82F6';
    const bandOpacity = vb.bandOpacity.value / 100;
    const bandLabel = vb.bandLabel.value;

    // Render the band rectangle
    g.append('rect')
      .attr('class', 'area-vertical-band')
      .attr('x', bandLeft)
      .attr('y', 0)
      .attr('width', bandWidth)
      .attr('height', chartHeight)
      .attr('fill', bandColor)
      .attr('opacity', bandOpacity)
      .attr('pointer-events', 'none');

    // Render the label at the top center of the band
    if (bandLabel) {
      g.append('text')
        .attr('class', 'area-vertical-band-label')
        .attr('x', bandLeft + bandWidth / 2)
        .attr('y', 12)
        .attr('text-anchor', 'middle')
        .attr('fill', bandColor)
        .attr('font-size', '11px')
        .attr('font-weight', 'bold')
        .attr('pointer-events', 'none')
        .text(bandLabel);
      }
  }

  private buildGapIndicators(
    data: ChartData,
    xScale: d3.ScalePoint<string>,
    yScale: d3.ScaleLinear<number, number>,
    stackMode: string,
    stackTops: number[][],
  ): GapIndicatorDatum[] {
    const gapSettings = this.settings.gapIndicatorSettings;
    if (!gapSettings.showGapIndicator.value || data.series.length < 2) return [];

    const seriesAIdx = Math.max(0, Math.floor(gapSettings.gapSeriesA.value) - 1);
    const seriesBIdx = Math.max(0, Math.floor(gapSettings.gapSeriesB.value) - 1);
    if (seriesAIdx >= data.series.length || seriesBIdx >= data.series.length) return [];

    const seriesA = data.series[seriesAIdx];
    const seriesB = data.series[seriesBIdx];
    const interval = Math.max(1, Math.floor(gapSettings.gapInterval.value));
    const color = gapSettings.gapColor.value?.value ?? '#94A3B8';
    const lineWidth = gapSettings.gapLineWidth.value;
    const showValue = gapSettings.showGapValue.value;
    const fontSize = gapSettings.gapFontSize.value;
    const isStacked = stackMode === 'stacked' || stackMode === 'stacked100' || stackMode === 'stream';
    const indicators: GapIndicatorDatum[] = [];

    data.categories.forEach((cat, catIdx) => {
      if (catIdx % interval !== 0) return;
      const valA = seriesA.values[catIdx];
      const valB = seriesB.values[catIdx];
      if (valA === null || valB === null) return;

      const x = xScale(cat);
      if (x === undefined) return;

      const renderValueA = isStacked ? stackTops[seriesAIdx]?.[catIdx] : valA;
      const renderValueB = isStacked ? stackTops[seriesBIdx]?.[catIdx] : valB;
      if (renderValueA === undefined || renderValueB === undefined) return;

      const yA = yScale(renderValueA);
      const yB = yScale(renderValueB);
      if (!Number.isFinite(yA) || !Number.isFinite(yB)) return;

      const yTop = Math.min(yA, yB);
      const yBottom = Math.max(yA, yB);
      indicators.push({
        catIdx,
        seriesAIdx,
        seriesBIdx,
        x,
        yTop,
        yBottom,
        midY: (yTop + yBottom) / 2,
        color,
        lineWidth,
        showValue,
        fontSize,
        labelText: formatWithSettings(Math.abs(valA - valB), this.settings.numberFormattingCard),
      });
    });

    return indicators;
  }

  private renderGapIndicatorLines(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    gapIndicators: GapIndicatorDatum[],
  ): void {
    gapIndicators.forEach((gap) => {
      g.append('line')
        .attr('class', 'gap-indicator-line')
        .attr('x1', gap.x)
        .attr('x2', gap.x)
        .attr('y1', gap.yTop)
        .attr('y2', gap.yBottom)
        .attr('stroke', gap.color)
        .attr('stroke-width', gap.lineWidth)
        .attr('stroke-dasharray', '3 2')
        .attr('pointer-events', 'none');
    });
  }

  private renderGapIndicatorValues(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    gapIndicators: GapIndicatorDatum[],
  ): void {
    gapIndicators
      .filter((gap) => gap.showValue)
      .forEach((gap) => {
        g.append('text')
          .attr('class', 'gap-indicator-value')
          .attr('x', this.getGapIndicatorLabelX(gap))
          .attr('y', gap.midY)
          .attr('dominant-baseline', 'middle')
          .attr('font-size', `${gap.fontSize}px`)
          .attr('fill', gap.color)
          .attr('pointer-events', 'none')
          .text(gap.labelText);
      });
  }

  private getGapIndicatorLabelX(gap: GapIndicatorDatum): number {
    if (!this.settings.dataLabelFormattingCard.showDataLabels.value) return gap.x + 4;
    return gap.x + GAP_VALUE_LABEL_OFFSET;
  }

  private renderAreaDataLabels(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    labels: AreaDataLabel[],
    gapIndicators: GapIndicatorDatum[],
    stackMode: string,
    chartHeight: number,
    dotRadius: number,
    labelBounds: AreaDataLabelBounds,
  ): void {
    if (labels.length === 0) return;

    const placements = this.layoutAreaDataLabels(
      labels,
      gapIndicators,
      stackMode,
      chartHeight,
      dotRadius,
      labelBounds,
    );

    placements.forEach((placement) => {
      const label = g.append('text')
        .attr('class', placement.className)
        .attr('data-series', String(placement.seriesIdx))
        .attr('data-selection-key', placement.selectionKey)
        .attr('x', placement.x)
        .attr('y', placement.y)
        .attr('text-anchor', placement.anchor)
        .style('transition', 'opacity 0.15s ease')
        .text(placement.text);

      if (placement.fill) {
        label.attr('fill', placement.fill);
      }
    });
  }

  private layoutAreaDataLabels(
    labels: AreaDataLabel[],
    gapIndicators: GapIndicatorDatum[],
    stackMode: string,
    chartHeight: number,
    dotRadius: number,
    labelBounds: AreaDataLabelBounds,
  ): AreaDataLabelPlacement[] {
    const fontSize = Math.max(1, this.settings.dataLabelFormattingCard.dataLabelFontSize.value || 11);
    const labelPosition = resolveDropdown(this.settings.dataLabelFormattingCard.dataLabelPosition) ?? 'auto';
    const isNormalMode = stackMode === 'normal';
    const gapsByCategory = new Map<number, GapIndicatorDatum[]>();

    gapIndicators.forEach((gap) => {
      const categoryGaps = gapsByCategory.get(gap.catIdx) ?? [];
      categoryGaps.push(gap);
      gapsByCategory.set(gap.catIdx, categoryGaps);
    });

    const autoSides = this.resolveAutoAreaLabelSides(labels, isNormalMode && labelPosition === 'auto');
    const placements = labels.map((label): AreaDataLabelPlacement => {
      let x = label.pointX;
      let side = this.resolveAreaDataLabelSide(label, labelPosition, autoSides);
      let y = this.getDefaultAreaDataLabelY(label.pointY, dotRadius, fontSize, side, chartHeight, labelBounds);
      let anchor: AreaLabelAnchor = 'middle';
      const matchingGap = isNormalMode
        ? (gapsByCategory.get(label.catIdx) ?? []).find((gap) =>
            label.seriesIdx === gap.seriesAIdx || label.seriesIdx === gap.seriesBIdx)
        : undefined;

      if (matchingGap && labelPosition === 'auto') {
        const isTopPoint = Math.abs(label.pointY - matchingGap.yTop) <= Math.abs(label.pointY - matchingGap.yBottom);
        side = isTopPoint ? 'above' : 'below';
        y = isTopPoint
          ? matchingGap.yTop - dotRadius - GAP_LABEL_VERTICAL_PADDING
          : matchingGap.yBottom + dotRadius + fontSize + GAP_LABEL_VERTICAL_PADDING;

        if (matchingGap.showValue) {
          const gapLabelBox = this.getAreaTextBox(
            this.getGapIndicatorLabelX(matchingGap),
            matchingGap.midY,
            matchingGap.labelText,
            matchingGap.fontSize,
            'start',
            'middle',
          );
          y = isTopPoint
            ? Math.min(y, gapLabelBox.top - DATA_LABEL_GAP - 3)
            : Math.max(y, gapLabelBox.bottom + DATA_LABEL_GAP + fontSize);
        }
      }

      const placement: AreaDataLabelPlacement = {
        ...label,
        x,
        y: this.clampAreaDataLabelY(y, fontSize, chartHeight, labelBounds),
        anchor,
        fontSize,
        side,
      };
      this.clampAreaDataLabelToSide(placement, chartHeight, labelBounds);
      return placement;
    });

    const gapValueObstacles = gapIndicators
      .filter((gap) => gap.showValue)
      .map((gap) => ({
        catIdx: gap.catIdx,
        box: this.getAreaTextBox(this.getGapIndicatorLabelX(gap), gap.midY, gap.labelText, gap.fontSize, 'start', 'middle'),
      }));

    const placementsByCategory = new Map<number, AreaDataLabelPlacement[]>();
    placements.forEach((placement) => {
      const categoryLabels = placementsByCategory.get(placement.catIdx) ?? [];
      categoryLabels.push(placement);
      placementsByCategory.set(placement.catIdx, categoryLabels);
    });

    placementsByCategory.forEach((categoryLabels, catIdx) => {
      const obstacles = gapValueObstacles
        .filter((obstacle) => obstacle.catIdx === catIdx)
        .map((obstacle) => obstacle.box);
      this.nudgeAreaLabelsAwayFromObstacles(categoryLabels, obstacles, chartHeight, labelBounds);
      this.clampAreaDataLabelsToSides(categoryLabels, chartHeight, labelBounds);
      this.separateAreaDataLabels(categoryLabels, chartHeight, labelBounds);
      this.clampAreaDataLabelsToSides(categoryLabels, chartHeight, labelBounds);
      this.nudgeAreaLabelsAwayFromObstacles(categoryLabels, obstacles, chartHeight, labelBounds);
      this.clampAreaDataLabelsToSides(categoryLabels, chartHeight, labelBounds);
      this.separateAreaDataLabels(categoryLabels, chartHeight, labelBounds);
      this.clampAreaDataLabelsToSides(categoryLabels, chartHeight, labelBounds);
    });

    return placements;
  }

  private resolveAutoAreaLabelSides(
    labels: AreaDataLabel[],
    useVerticalSplit: boolean,
  ): Map<string, AreaLabelSide> {
    const sides = new Map<string, AreaLabelSide>();
    if (!useVerticalSplit) return sides;

    const labelsByCategory = new Map<number, AreaDataLabel[]>();
    labels.forEach((label) => {
      const categoryLabels = labelsByCategory.get(label.catIdx) ?? [];
      categoryLabels.push(label);
      labelsByCategory.set(label.catIdx, categoryLabels);
    });

    labelsByCategory.forEach((categoryLabels) => {
      const sorted = [...categoryLabels].sort((a, b) =>
        (a.pointY - b.pointY) || (a.seriesIdx - b.seriesIdx));
      const aboveCount = Math.ceil(sorted.length / 2);
      sorted.forEach((label, index) => {
        sides.set(this.getAreaDataLabelKey(label), index < aboveCount ? 'above' : 'below');
      });
    });

    return sides;
  }

  private resolveAreaDataLabelSide(
    label: AreaDataLabel,
    labelPosition: string,
    autoSides: Map<string, AreaLabelSide>,
  ): AreaLabelSide {
    if (labelPosition === 'below' || labelPosition === 'inside') return 'below';
    if (labelPosition === 'above') return 'above';
    return autoSides.get(this.getAreaDataLabelKey(label)) ?? 'above';
  }

  private getAreaDataLabelKey(label: AreaDataLabel): string {
    return `${label.catIdx}|${label.seriesIdx}|${label.selectionKey}`;
  }

  private getDefaultAreaDataLabelY(
    pointY: number,
    dotRadius: number,
    fontSize: number,
    side: AreaLabelSide,
    chartHeight: number,
    labelBounds: AreaDataLabelBounds,
  ): number {
    const belowY = pointY + dotRadius + fontSize + DATA_LABEL_GAP;
    const aboveY = pointY - dotRadius - DATA_LABEL_GAP;
    const y = side === 'below' ? belowY : aboveY;
    return this.clampAreaDataLabelY(y, fontSize, chartHeight, labelBounds);
  }

  private nudgeAreaLabelsAwayFromObstacles(
    labels: AreaDataLabelPlacement[],
    obstacles: AreaTextBox[],
    chartHeight: number,
    labelBounds: AreaDataLabelBounds,
  ): void {
    if (obstacles.length === 0) return;

    labels.forEach((label) => {
      for (let attempt = 0; attempt < 4; attempt++) {
        const box = this.getAreaTextBox(label.x, label.y, label.text, label.fontSize, label.anchor);
        const obstacle = obstacles.find((candidate) => this.areaTextBoxesOverlap(box, candidate));
        if (!obstacle) return;

        label.y = label.side === 'above'
          ? Math.min(label.y, obstacle.top - DATA_LABEL_GAP - 3)
          : Math.max(label.y, obstacle.bottom + DATA_LABEL_GAP + label.fontSize);
        label.y = this.clampAreaDataLabelY(label.y, label.fontSize, chartHeight, labelBounds);
        this.clampAreaDataLabelToSide(label, chartHeight, labelBounds);
      }
    });
  }

  private separateAreaDataLabels(
    labels: AreaDataLabelPlacement[],
    chartHeight: number,
    labelBounds: AreaDataLabelBounds,
  ): void {
    if (labels.length < 2) return;

    labels.sort((a, b) => a.y - b.y);
    const minGap = Math.max(DATA_LABEL_GAP, Math.ceil(labels[0].fontSize * 0.25));

    for (let i = 1; i < labels.length; i++) {
      const previous = labels[i - 1];
      const current = labels[i];
      const previousBox = this.getAreaTextBox(previous.x, previous.y, previous.text, previous.fontSize, previous.anchor);
      const currentBox = this.getAreaTextBox(current.x, current.y, current.text, current.fontSize, current.anchor);
      if (!this.areaTextBoxesOverlapHorizontally(previousBox, currentBox)) continue;

      const overlap = previousBox.bottom + minGap - currentBox.top;
      if (overlap > 0) {
        if (current.side === 'below') {
          current.y = this.clampAreaDataLabelY(current.y + overlap, current.fontSize, chartHeight, labelBounds);
          this.clampAreaDataLabelToSide(current, chartHeight, labelBounds);
        } else if (previous.side === 'above') {
          previous.y = this.clampAreaDataLabelY(previous.y - overlap, previous.fontSize, chartHeight, labelBounds);
          this.clampAreaDataLabelToSide(previous, chartHeight, labelBounds);
        } else {
          current.y = this.clampAreaDataLabelY(current.y + overlap, current.fontSize, chartHeight, labelBounds);
          this.clampAreaDataLabelToSide(current, chartHeight, labelBounds);
        }
      }
    }

    const boxes = labels.map((label) =>
      this.getAreaTextBox(label.x, label.y, label.text, label.fontSize, label.anchor));
    const bottomOverflow = Math.max(...boxes.map((box) => box.bottom), labelBounds.bottom) - labelBounds.bottom;
    if (bottomOverflow > 0) {
      labels.forEach((label) => {
        label.y = this.clampAreaDataLabelY(label.y - bottomOverflow, label.fontSize, chartHeight, labelBounds);
        this.clampAreaDataLabelToSide(label, chartHeight, labelBounds);
      });
    }

    const topOverflow = Math.min(...labels.map((label) =>
      this.getAreaTextBox(label.x, label.y, label.text, label.fontSize, label.anchor).top), labelBounds.top) - labelBounds.top;
    if (topOverflow < 0) {
      labels.forEach((label) => {
        label.y = this.clampAreaDataLabelY(label.y - topOverflow, label.fontSize, chartHeight, labelBounds);
        this.clampAreaDataLabelToSide(label, chartHeight, labelBounds);
      });
    }
  }

  private clampAreaDataLabelsToSides(
    labels: AreaDataLabelPlacement[],
    chartHeight: number,
    labelBounds: AreaDataLabelBounds,
  ): void {
    labels.forEach((label) => this.clampAreaDataLabelToSide(label, chartHeight, labelBounds));
  }

  private clampAreaDataLabelToSide(
    label: AreaDataLabelPlacement,
    chartHeight: number,
    labelBounds: AreaDataLabelBounds,
  ): void {
    if (label.side === 'above') {
      const maxY = label.pointY - DATA_LABEL_GAP - 3;
      label.y = Math.min(label.y, maxY);
    } else {
      const minY = label.pointY + DATA_LABEL_GAP + label.fontSize;
      label.y = Math.max(label.y, minY);
    }
    label.y = this.clampAreaDataLabelY(label.y, label.fontSize, chartHeight, labelBounds);
  }

  private clampAreaDataLabelY(
    y: number,
    fontSize: number,
    chartHeight: number,
    labelBounds?: AreaDataLabelBounds,
  ): number {
    const bounds = labelBounds ?? { top: 0, bottom: chartHeight };
    const minY = bounds.top + fontSize + 2;
    const maxY = Math.max(minY, bounds.bottom - 3);
    return Math.max(minY, Math.min(maxY, y));
  }

  private getAreaTextBox(
    x: number,
    y: number,
    text: string,
    fontSize: number,
    anchor: AreaLabelAnchor,
    baseline: 'alphabetic' | 'middle' = 'alphabetic',
  ): AreaTextBox {
    const width = Math.max(fontSize, text.length * fontSize * 0.58 + 4);
    const height = fontSize + 4;
    let left = x - width / 2;
    if (anchor === 'start') left = x;
    if (anchor === 'end') left = x - width;

    const top = baseline === 'middle' ? y - height / 2 : y - fontSize;
    const bottom = baseline === 'middle' ? y + height / 2 : y + 3;
    return {
      left,
      right: left + width,
      top,
      bottom,
    };
  }

  private areaTextBoxesOverlap(a: AreaTextBox, b: AreaTextBox): boolean {
    return this.areaTextBoxesOverlapHorizontally(a, b) && a.top < b.bottom && a.bottom > b.top;
  }

  private areaTextBoxesOverlapHorizontally(a: AreaTextBox, b: AreaTextBox): boolean {
    return a.left < b.right && a.right > b.left;
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
      fontWeight: resolveDropdown(legendFmtCard.legendFontWeight) || 'normal',
      aliases: legendFmtCard.legendAliases.value,
    });

    // Animate legend entrance
    const animEnabled = this.settings.animationSettings.enabled.value && !prefersReducedMotion();
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
    if (!acc.enableKeyboardNav.value) {
      this.container.removeAttribute('role');
      this.container.removeAttribute('aria-label');
      return;
    }

    ensureFocusRingStyles();
    applyChartAria(this.container, {
      chartType: 'area chart',
      title: this.settings.titleFormattingCard?.titleText?.value || undefined,
      dataPointCount,
    });

    const dots = this.container.querySelectorAll<SVGCircleElement>(
      '.area-dot:not(.area-highlight-dot)',
    );
    dots.forEach((dot, index) => {
      const seriesIndex = Number(dot.getAttribute('data-series'));
      const seriesName = this.currentData?.series[seriesIndex]?.name ?? `Series ${seriesIndex + 1}`;
      const category = dot.getAttribute('data-category') ?? '';
      const rawValue = Number(dot.getAttribute('data-value'));
      dot.setAttribute('role', 'listitem');
      dot.setAttribute('tabindex', '0');
      dot.setAttribute(
        'aria-label',
        `${seriesName}, ${category}, ${formatWithSettings(rawValue, this.settings.numberFormattingCard)}. Point ${index + 1} of ${dots.length}.`,
      );
    });

    const cleanup = attachKeyboardNav({
      container: this.container,
      itemSelector: '.area-dot:not(.area-highlight-dot)[tabindex="0"]',
      onActivate: (el) => {
        if (allowInteractions(this.host)) (el as HTMLElement).click?.();
      },
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
      {
        fontFamily: resolveDropdown(ann.annotationFontFamily) || undefined,
        fontWeight: resolveDropdown(ann.annotationFontWeight) || '500',
        offset: ann.annotationOffset.value,
        padding: ann.annotationPadding.value,
        backgroundColor: ann.annotationBackgroundColor.value?.value || '#FFFFFF',
        backgroundOpacity: ann.annotationBackgroundOpacity.value / 100,
        cornerRadius: ann.annotationCornerRadius.value,
      },
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
    selectionId: ISelectionId,
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
        identities: [selectionId],
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

  private buildRenderPoints(
    data: ChartData,
    series: SeriesData,
    seriesIdx: number,
    xScale: d3.ScalePoint<string>,
    yScale: d3.ScaleLinear<number, number>,
    stackMode: string,
    stackBaselines: number[][],
    stackTops: number[][],
    domainCats?: Set<string>,
  ): RenderPoint[] {
    const isStacked = stackMode === 'stacked' || stackMode === 'stacked100' || stackMode === 'stream';
    const nullHandling = resolveDropdown(this.settings.dataHandlingSettings.nullHandling) ?? 'skip';
    const points: RenderPoint[] = [];

    data.categories.forEach((cat, index) => {
      if (domainCats && !domainCats.has(cat)) return;

      let value = series.values[index];
      if (value === null) {
        if (nullHandling === 'interpolate') {
          let prevVal: number | null = null;
          let nextVal: number | null = null;
          let prevIdx = -1;
          let nextIdx = -1;
          for (let scan = index - 1; scan >= 0; scan--) {
            if (series.values[scan] !== null) {
              prevVal = series.values[scan];
              prevIdx = scan;
              break;
            }
          }
          for (let scan = index + 1; scan < series.values.length; scan++) {
            if (series.values[scan] !== null) {
              nextVal = series.values[scan];
              nextIdx = scan;
              break;
            }
          }
          if (prevVal !== null && nextVal !== null) {
            const t = (index - prevIdx) / (nextIdx - prevIdx);
            value = prevVal + (nextVal - prevVal) * t;
          } else if (prevVal !== null) {
            value = prevVal;
          } else if (nextVal !== null) {
            value = nextVal;
          } else {
            return;
          }
        } else if (nullHandling === 'connect') {
          return;
        } else {
          return;
        }
      }

      const x = xScale(cat);
      if (x === undefined) return;

      const displayValue = isStacked ? stackTops[seriesIdx][index] : value;
      const baselineValue = isStacked ? stackBaselines[seriesIdx][index] : undefined;

      points.push({
        catIdx: index,
        x,
        y: yScale(displayValue),
        y0: baselineValue !== undefined ? yScale(baselineValue) : undefined,
        val: value,
        cat,
        displayValue,
        selectionId: data.categorySelectionIds[index],
      });
    });

    return points;
  }

  private renderLinkedBands(
    group: d3.Selection<SVGGElement, unknown, null, undefined>,
    categoryBands: CategoryBand[],
    chartHeight: number,
    selectionIds: ISelectionId[],
  ): void {
    const linkedBands = group.append('g')
      .attr('class', 'area-linked-bands')
      .style('pointer-events', 'none');

    categoryBands.forEach((band) => {
      linkedBands.append('rect')
        .attr('class', 'area-linked-band')
        .attr('data-selection-key', selectionIds[band.index]?.getKey() ?? '')
        .attr('x', band.x)
        .attr('y', 0)
        .attr('width', band.width)
        .attr('height', chartHeight)
        .attr('fill', '#0F172A')
        .style('opacity', '0');
    });
  }

  private getNearestCategorySelectionId(
    event: MouseEvent,
    chartGroupNode: SVGGElement,
    xScale: d3.ScalePoint<string>,
    data: ChartData,
  ): ISelectionId | null {
    const [mouseX] = d3.pointer(event, chartGroupNode);
    let bestIndex = -1;
    let bestDistance = Infinity;

    data.categories.forEach((category, index) => {
      const x = xScale(category);
      if (x === undefined) return;
      const distance = Math.abs(mouseX - x);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });

    return bestIndex >= 0 ? data.categorySelectionIds[bestIndex] ?? null : null;
  }

  private bindCategorySelection<E extends SVGElement, D>(
    node: d3.Selection<E, D, null, undefined>,
    chartGroupNode: SVGGElement,
    xScale: d3.ScalePoint<string>,
    data: ChartData,
  ): void {
    node
      .style('cursor', allowInteractions(this.host) ? 'pointer' : 'default')
      .on('click.selection', (event: MouseEvent) => {
        event.stopPropagation();
        if (!allowInteractions(this.host)) return;
        const selectionId = this.getNearestCategorySelectionId(event, chartGroupNode, xScale, data);
        if (!selectionId) return;
        void this.selectionManager.select(selectionId, event.ctrlKey || event.metaKey).then(() => {
          this.applySelectionHighlight();
        });
      })
      .on('contextmenu.selection', (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        if (!allowInteractions(this.host)) return;
        const selectionId = this.getNearestCategorySelectionId(event, chartGroupNode, xScale, data);
        if (!selectionId) return;
        void this.selectionManager.showContextMenu(selectionId, {
          x: event.clientX,
          y: event.clientY,
        });
      });
  }

  private applySelectionHighlight(): void {
    const data = this.currentData;
    if (!data) return;

    const selectedKeys = new Set(
      (this.selectionManager.getSelectionIds() as ISelectionId[]).map((id) => id.getKey()),
    );
    const highlightedKeys = buildHighlightedCategoryKeys(data.categorySelectionIds, data.series);
    const hasSelection = selectedKeys.size > 0;
    const hasHighlights = highlightedKeys.size > 0;

    applyLinkedState({
      root: this.container,
      selector: '.area-dot:not(.area-highlight-dot)[data-selection-key], .area-data-label:not(.area-highlight-data-label)[data-selection-key]',
      selectedKeys,
      highlightedKeys,
      dimOpacity: hasHighlights ? '0.18' : '0.2',
    });
    applyLinkedState({
      root: this.container,
      selector: '.area-highlight-dot[data-selection-key], .area-highlight-data-label[data-selection-key]',
      selectedKeys,
      highlightedKeys,
      dimOpacity: hasSelection ? '0.2' : '',
    });
    applyLinkedState({
      root: this.container,
      selector: '.area-linked-band[data-selection-key]',
      selectedKeys,
      highlightedKeys,
      dimOpacity: '0.18',
      activeOpacity: '0',
      clearOpacity: '0',
    });

    const baseLayers = this.container.querySelectorAll<SVGElement>('.area-fill:not(.area-highlight-fill), .area-line:not(.area-highlight-line)');
    const highlightLayers = this.container.querySelectorAll<SVGElement>('.area-highlight-fill, .area-highlight-line');

    if (hasHighlights) {
      baseLayers.forEach((el) => { el.style.opacity = '0.18'; });
      highlightLayers.forEach((el) => { el.style.opacity = ''; });
      return;
    }

    if (hasSelection) {
      baseLayers.forEach((el) => { el.style.opacity = '0.22'; });
      highlightLayers.forEach((el) => { el.style.opacity = '0.22'; });
      return;
    }

    [...baseLayers, ...highlightLayers].forEach((el) => {
      el.style.opacity = '';
    });
  }

  // ── Formatting Model ──────────────────────────────────────────────

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  private handleBackgroundClick = (): void => {
    if (!allowInteractions(this.host)) return;
    void this.selectionManager.clear().then(() => {
      this.applySelectionHighlight();
    });
  };

  private applyHighContrast(): void {
    applyBasicHighContrastStyles(this.container, getHostHighContrastColors(this.host), {
      textSelectors: [
        '.area-chart-empty',
        '.chart-title',
        '.chart-subtitle',
        '.area-axis text',
        '.area-axis-title',
        '.area-data-label',
        '.gap-indicator-value',
        '.pbi-shared-legend span',
        '.crosshair-label',
        '.annotation-label',
      ],
      lineSelectors: [
        '.area-axis line',
        '.area-axis path',
        '.area-grid line',
        '.gap-indicator-line',
        '.reference-line',
        '.trend-line',
        '.annotation-connector',
      ],
      fillSelectors: [],
      strokeSelectors: [],
    });
  }

  // ── Cleanup ───────────────────────────────────────────────────────

  public destroy(): void {
    this.detachEmptySpaceContextMenu();
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
  }
}
