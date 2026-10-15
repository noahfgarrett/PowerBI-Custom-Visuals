/**
 * Health Bar — Vertical bar chart with red-to-green gradient showing health %.
 */

import powerbi from 'powerbi-visuals-api';
import IVisual = powerbi.extensibility.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import DataView = powerbi.DataView;
import ISelectionId = powerbi.visuals.ISelectionId;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel';
import * as d3 from 'd3';

import {
  applyCardStyle,
  allowInteractions,
  type CardStyleMode,
  formatPercent,
  formatWithSettings,
  growBar,
  fadeSlideIn,
  DURATION,
  renderChartTitle,
  applyAxisFormatting,
  applyGridFormatting,
  createScrollableChart,
  applySortOrder,
  resolveDropdown,
  buildConditionalConfig,
  resolveConditionalColor,
  applyChartAria,
  applyDataPointAria,
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
  renderLegend,
  type LegendItem,
  getDateFilterIndices,
  isDateColumn,
  type DateFilterConfig,
  resolveColorTheme,
  getHostChartColor,
  syncCardStyleVisibility,
  syncDateFilterFormattingVisibility,
  syncLegendFormattingVisibility,
  syncTitleFormattingVisibility,
  attachEmptySpaceContextMenu,
  notifyRenderingStarted,
  notifyRenderingFinished,
  notifyRenderingFailed,
  renderLandingPage,
  renderNoDataState,
  getHostHighContrastColors,
  applyBasicHighContrastStyles,
  getLocalizedString,
  getVisualEmptyStateMode,
} from '../../core/src';

import { HealthBarSettings } from './settings';

// ── Constants ────────────────────────────────────────────────────────

const SVG_NS = 'http://www.w3.org/2000/svg';
const Y_AXIS_WIDTH = 40;
const Y_TICKS = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
const METRIC_MODES = ['normal', 'mean', 'median'] as const;

// ── Types ────────────────────────────────────────────────────────────

type MetricMode = typeof METRIC_MODES[number];

interface HealthBarItem {
  label: string;
  value: number;
  rawValue: number;
  pct: number; // clamped 0-1
  target: number | null;
  highlighted: boolean;
  selectionId: ISelectionId;
}

/** Whether cross-highlight data is present from another visual/slicer. */
interface HealthBarData {
  items: HealthBarItem[];
  hasHighlights: boolean;
}

// ── Visual ───────────────────────────────────────────────────────────

export class HealthBarVisual implements IVisual {
  private host: IVisualHost;
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private container: HTMLElement;
  private settings!: HealthBarSettings;
  private formattingSettingsService: FormattingSettingsService;
  private cancelAnimations: Array<() => void> = [];
  private emptyStateMode: 'unconfigured' | 'noData' = 'unconfigured';
  private metricMode: MetricMode = 'normal';
  private currentItems: HealthBarItem[] = [];
  private currentHasHighlights = false;

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = this.host.createSelectionManager();
    this.formattingSettingsService = new FormattingSettingsService(options.host.createLocalizationManager());

    this.container = document.createElement('div');
    this.container.className = 'health-bar-container';
    options.element.appendChild(this.container);
    attachEmptySpaceContextMenu(this.container, this.selectionManager, () =>
      this.host.createSelectionIdBuilder().createSelectionId(),
      () => allowInteractions(this.host),
    );
  }

  // ── Update ──────────────────────────────────────────────────────────

  public update(options: VisualUpdateOptions): void {
    notifyRenderingStarted(this.host, options);
    try {
      // Cancel running animations
      this.cancelAnimations.forEach((cancel) => cancel());
      this.cancelAnimations = [];

      const dataView = options.dataViews?.[0];
      const hasCategoryRole = dataView?.metadata?.columns?.some((column) => column.roles?.['category']) ?? false;
      const hasMeasureRole = dataView?.metadata?.columns?.some((column) => column.roles?.['measure']) ?? false;
      this.emptyStateMode = hasCategoryRole && hasMeasureRole
        ? getVisualEmptyStateMode(dataView)
        : 'unconfigured';
      this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
        HealthBarSettings,
        dataView,
      );
      syncTitleFormattingVisibility(this.settings.titleFormattingCard);

      // Migrate legacy enableGlass -> cardStyleMode (backward compat)
      const legacyCardObj = dataView?.metadata?.objects?.['cardSettings'];
      const legacyGlass = legacyCardObj?.['enableGlass'];
      if (legacyCardObj?.['cardStyleMode'] === undefined && legacyGlass === false) {
        this.settings.cardSettings.cardStyleMode.value = { value: 'none', displayName: 'None' };
      }

      // Hide inapplicable shared axis properties — health-bar only uses axisLabelColor and axisLabelSize

      const categoryColumn = dataView?.categorical?.categories?.[0];
      const hasDateAxis = Boolean(categoryColumn && isDateColumn(categoryColumn.source));
      const hasTargetRole = dataView?.metadata?.columns?.some((column) => column.roles?.['target']) ?? false;
      this.settings.dateFilterFormattingCard.visible = hasDateAxis;
      syncDateFilterFormattingVisibility(this.settings.dateFilterFormattingCard);
      if (!hasDateAxis) {
        this.settings.dateFilterFormattingCard.startDate.visible = false;
        this.settings.dateFilterFormattingCard.endAtCurrentDate.visible = false;
        this.settings.dateFilterFormattingCard.endDate.visible = false;
      }
      this.settings.axisFormattingCard.showXAxis.visible = false;
      this.settings.axisFormattingCard.showYAxis.visible = false;
      this.settings.axisFormattingCard.xAxisTitle.visible = false;
      this.settings.axisFormattingCard.axisLabelFontFamily.visible = false;
      this.settings.axisFormattingCard.axisLabelRotation.visible = false;
      this.settings.axisFormattingCard.yAxisMin.visible = false;
      this.settings.axisFormattingCard.yAxisMax.visible = false;

      const referenceSettings = this.settings.referenceLineFormattingCard;
      const showReferenceLine = referenceSettings.showReferenceLine.value;
      const referenceType = resolveDropdown(referenceSettings.referenceLineType) ?? 'custom';
      referenceSettings.referenceLineType.visible = showReferenceLine;
      referenceSettings.referenceLineValue.visible = showReferenceLine && referenceType === 'custom';
      referenceSettings.referenceLineColor.visible = showReferenceLine;
      referenceSettings.referenceLineWidth.visible = showReferenceLine;
      referenceSettings.referenceLineStyle.visible = showReferenceLine;
      referenceSettings.showReferenceLabel.visible = showReferenceLine;
      referenceSettings.referenceLabelText.visible = showReferenceLine
        && referenceSettings.showReferenceLabel.value;
      referenceSettings.showReferenceBand.visible = showReferenceLine;
      referenceSettings.referenceBandOpacity.visible = showReferenceLine
        && referenceSettings.showReferenceBand.value;
      referenceSettings.referenceBandWidth.visible = showReferenceLine
        && referenceSettings.showReferenceBand.value;
      referenceSettings.referenceLineAxis.visible = false;

      const trendSettings = this.settings.trendLineFormattingCard;
      const showTrendLine = trendSettings.showTrendLine.value;
      const trendType = resolveDropdown(trendSettings.trendLineType) ?? 'linear';
      trendSettings.trendLineType.visible = showTrendLine;
      trendSettings.trendLineColor.visible = showTrendLine;
      trendSettings.trendLineWidth.visible = showTrendLine;
      trendSettings.polynomialOrder.visible = showTrendLine && trendType === 'polynomial';
      trendSettings.showEquation.visible = showTrendLine;
      trendSettings.showR2.visible = showTrendLine;
      trendSettings.trendLineAxis.visible = false;

      const annotationSettings = this.settings.annotationFormattingCard;
      const showAnnotations = annotationSettings.showAnnotations.value;
      [
        annotationSettings.annotation1Category,
        annotationSettings.annotation1Text,
        annotationSettings.annotation1Position,
        annotationSettings.annotation2Category,
        annotationSettings.annotation2Text,
        annotationSettings.annotation2Position,
        annotationSettings.annotation3Category,
        annotationSettings.annotation3Text,
        annotationSettings.annotation3Position,
        annotationSettings.annotationFontSize,
        annotationSettings.annotationFontColor,
        annotationSettings.annotationFontFamily,
        annotationSettings.annotationFontWeight,
        annotationSettings.annotationConnectorColor,
        annotationSettings.annotationOffset,
        annotationSettings.annotationPadding,
        annotationSettings.annotationBackgroundColor,
        annotationSettings.annotationBackgroundOpacity,
        annotationSettings.annotationCornerRadius,
      ].forEach((slice) => {
        slice.visible = showAnnotations;
      });

      // Value Labels is authoritative for this visual; the shared card would
      // otherwise duplicate and override the same typography controls.
      this.settings.dataLabelFormattingCard.visible = false;

      // Conditional visibility: hide child settings when parent toggle is off
      this.settings.animationSettings.duration.visible = this.settings.animationSettings.enabled.value;
      this.settings.animationSettings.staggerDelay.visible = this.settings.animationSettings.enabled.value;
      this.settings.targetSettings.visible = hasTargetRole;
      this.settings.targetSettings.color.visible = this.settings.targetSettings.show.value;
      this.settings.targetSettings.lineWidth.visible = this.settings.targetSettings.show.value;
      this.settings.targetSettings.markerStyle.visible = this.settings.targetSettings.show.value;
      const showValues = this.settings.valueLabelsSettings.showValue.value;
      this.settings.valueLabelsSettings.showPercent.visible = showValues;
      this.settings.valueLabelsSettings.position.visible = showValues;
      this.settings.valueLabelsSettings.fontSize.visible = showValues;
      this.settings.valueLabelsSettings.fontColor.visible = showValues;
      this.settings.valueLabelsSettings.fontFamily.visible = showValues;
      this.settings.valueLabelsSettings.fontWeight.visible = showValues;

      const showCategories = this.settings.categoryLabelSettings.show.value;
      this.settings.categoryLabelSettings.fontSize.visible = showCategories;
      this.settings.categoryLabelSettings.fontColor.visible = showCategories;
      this.settings.categoryLabelSettings.fontFamily.visible = showCategories;
      this.settings.categoryLabelSettings.fontWeight.visible = showCategories;

      const showZones = this.settings.healthBarZone.show.value;
      this.settings.healthBarZone.zoneColors.visible = showZones;
      this.settings.legendFormattingCard.visible = showZones;
      syncLegendFormattingVisibility(this.settings.legendFormattingCard);

      this.settings.metricToggleSettings.position.visible = this.settings.metricToggleSettings.show.value;
      if (!this.settings.metricToggleSettings.show.value) {
        this.metricMode = 'normal';
      }
      syncCardStyleVisibility(this.settings.cardSettings);
      const conditionalEnabled = this.settings.conditionalFormattingCard.enableConditional.value;
      this.settings.conditionalFormattingCard.conditionalDirection.visible = conditionalEnabled;
      this.settings.conditionalFormattingCard.threshold1.visible = conditionalEnabled;
      this.settings.conditionalFormattingCard.threshold2.visible = conditionalEnabled;
      this.settings.conditionalFormattingCard.conditionalColor1.visible = conditionalEnabled;
      this.settings.conditionalFormattingCard.conditionalColor2.visible = conditionalEnabled;
      this.settings.conditionalFormattingCard.conditionalColor3.visible = conditionalEnabled;

      // Extract data and apply user-configured sort order
      const extracted = this.extractData(dataView);
      const items = applySortOrder(
        extracted.items.map((d) => ({ ...d, name: d.label })),
        this.settings.sortFormattingCard,
      );

      const highContrast = getHostHighContrastColors(this.host);
      this.render(items, options.viewport, extracted.hasHighlights, highContrast);
      applyBasicHighContrastStyles(this.container, highContrast, {
        textSelectors: ['svg text', '.health-bar-value', '.health-bar-label', '.health-bar-empty', '.pbi-landing-page-title', '.pbi-landing-page-description', '.pbi-landing-page-hint', '.pbi-landing-page li'],
        fillSelectors: ['.health-bar-fill', '.health-bar-track', '.health-bar-zone', '.health-bar-target', '.pbi-landing-page'],
        strokeSelectors: ['.health-bar-grid line'],
      });
      notifyRenderingFinished(this.host, options);
    } catch (error) {
      notifyRenderingFailed(this.host, options, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  // ── Data Extraction ─────────────────────────────────────────────────

  private extractData(dataView: DataView | undefined): HealthBarData {
    if (!dataView?.categorical?.categories?.[0] || !dataView.categorical.values) {
      return { items: [], hasHighlights: false };
    }

    const categories = dataView.categorical.categories[0];
    const allValues = dataView.categorical.values;
    const configuredMax = this.settings.scaleRangeSettings.maxValue.value ?? 100;
    const configuredMin = this.settings.scaleRangeSettings.minValue.value ?? 0;
    const minVal = Math.min(configuredMin, configuredMax);
    const maxVal = configuredMin === configuredMax
      ? configuredMin + 1
      : Math.max(configuredMin, configuredMax);
    const scaleRange = maxVal - minVal;
    const items: HealthBarItem[] = [];

    // Find measure and target columns by role
    let measureColumn: powerbi.DataViewValueColumn | null = null;
    let targetColumn: powerbi.DataViewValueColumn | null = null;

    for (const col of allValues) {
      const role = col.source.roles;
      if (!role) continue;
      if (role['measure']) measureColumn = col;
      if (role['target']) targetColumn = col;
    }

    if (!measureColumn) return { items, hasHighlights: false };

    // Read cross-highlight data from the measure column
    const measureHighlights = measureColumn.highlights as unknown[] | undefined;

    const dateConfig: DateFilterConfig = {
      enabled: this.settings.dateFilterFormattingCard.enableDateFilter.value,
      startDate: this.settings.dateFilterFormattingCard.startDate.value,
      endAtCurrentDate: this.settings.dateFilterFormattingCard.endAtCurrentDate.value,
      endDate: this.settings.dateFilterFormattingCard.endDate.value,
    };
    const dateIndices = isDateColumn(categories.source) ? getDateFilterIndices(categories.values, dateConfig) : null;

    let hasHighlights = false;

    for (let i = 0; i < categories.values.length; i++) {
      if (dateIndices && !dateIndices.has(i)) continue;

      const label = String(categories.values[i] ?? '');
      const rawValue = Number(measureColumn.values[i] ?? 0);

      if (!Number.isFinite(rawValue)) continue;

      const clamped = Math.max(minVal, Math.min(rawValue, maxVal));
      const pct = scaleRange > 0 ? (clamped - minVal) / scaleRange : 0;

      let target: number | null = null;
      if (targetColumn && i < targetColumn.values.length) {
        const raw = targetColumn.values[i];
        target = typeof raw === 'number' ? raw : null;
      }

      const highlighted = measureHighlights
        ? measureHighlights[i] !== null && measureHighlights[i] !== undefined
        : false;
      if (highlighted) hasHighlights = true;

      const selectionId = this.host
        .createSelectionIdBuilder()
        .withCategory(categories, i)
        .createSelectionId();

      items.push({ label, value: clamped, rawValue, pct, target, highlighted, selectionId });
    }

    return { items, hasHighlights };
  }

  // ── Metric Toggle ──────────────────────────────────────────────────

  private getScaledValue(rawValue: number): { value: number; pct: number } {
    const configuredMax = this.settings.scaleRangeSettings.maxValue.value ?? 100;
    const configuredMin = this.settings.scaleRangeSettings.minValue.value ?? 0;
    const minVal = Math.min(configuredMin, configuredMax);
    const maxVal = configuredMin === configuredMax
      ? configuredMin + 1
      : Math.max(configuredMin, configuredMax);
    const scaleRange = maxVal - minVal;
    const value = Math.max(minVal, Math.min(rawValue, maxVal));
    const pct = scaleRange > 0 ? (value - minVal) / scaleRange : 0;

    return { value, pct };
  }

  private getMetricDisplayItems(items: HealthBarItem[]): HealthBarItem[] {
    if (!this.settings.metricToggleSettings.show.value || this.metricMode === 'normal') {
      return items;
    }

    const rawValues = items.map((item) => item.rawValue).filter(Number.isFinite);
    if (rawValues.length === 0) return [];

    const statValue = computeStatValue(rawValues, this.metricMode as StatType);
    if (!Number.isFinite(statValue)) return [];

    const scaled = this.getScaledValue(statValue);
    const label = this.getMetricModeLabel(this.metricMode);

    return [{
      label,
      value: statValue,
      rawValue: statValue,
      pct: scaled.pct,
      target: null,
      highlighted: false,
      selectionId: this.host.createSelectionIdBuilder().createSelectionId(),
    }];
  }

  private getMetricModeLabel(mode: MetricMode): string {
    switch (mode) {
      case 'mean':
        return 'Mean';
      case 'median':
        return 'Median';
      case 'normal':
        return 'Bars';
    }
  }

  private getNextMetricMode(): MetricMode {
    const currentIndex = METRIC_MODES.indexOf(this.metricMode);
    return METRIC_MODES[(currentIndex + 1) % METRIC_MODES.length];
  }

  private renderMetricToggleButton(
    baseItems: HealthBarItem[],
    viewport: powerbi.IViewport,
    hasHighlights: boolean | undefined,
    highContrast: ReturnType<typeof getHostHighContrastColors>,
  ): void {
    if (!this.settings.metricToggleSettings.show.value) return;

    const position = (resolveDropdown(this.settings.metricToggleSettings.position) ?? 'topRight') as 'topLeft' | 'topRight';
    const positionClass = position === 'topLeft' ? 'top-left' : 'top-right';
    const currentLabel = this.getMetricModeLabel(this.metricMode);
    const nextLabel = this.getMetricModeLabel(this.getNextMetricMode());

    const button = document.createElement('button');
    button.type = 'button';
    button.className = `health-bar-kpi-toggle health-bar-kpi-toggle--${positionClass}`;
    button.textContent = currentLabel;
    button.setAttribute('aria-label', `Metric view: ${currentLabel}. Click to show ${nextLabel}.`);
    button.title = `Metric view: ${currentLabel}. Click to show ${nextLabel}.`;
    const interactionsAllowed = allowInteractions(this.host);
    button.disabled = !interactionsAllowed;
    button.style.cursor = interactionsAllowed ? 'pointer' : 'default';

    const stopPropagation = (event: Event): void => {
      event.stopPropagation();
    };
    button.addEventListener('mousedown', stopPropagation);
    button.addEventListener('mouseup', stopPropagation);
    button.addEventListener('pointerdown', stopPropagation);
    button.addEventListener('pointerup', stopPropagation);
    button.addEventListener('contextmenu', (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
    });
    button.addEventListener('click', (event: MouseEvent) => {
      if (!allowInteractions(this.host)) return;
      event.preventDefault();
      event.stopPropagation();
      this.metricMode = this.getNextMetricMode();
      this.cancelAnimations.forEach((cancel) => cancel());
      this.cancelAnimations = [];
      this.render(baseItems, viewport, hasHighlights, highContrast);
    });

    this.container.appendChild(button);
  }

  // ── Render ──────────────────────────────────────────────────────────

  private render(items: HealthBarItem[], viewport: powerbi.IViewport, hasHighlights: boolean | undefined, highContrast: ReturnType<typeof getHostHighContrastColors>): void {
    // Clear
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }

    const s = this.settings;

    // Card style
    const cardMode = (resolveDropdown(s.cardSettings.cardStyleMode) ?? 'glass') as CardStyleMode;
    applyCardStyle(this.container, {
      mode: cardMode,
      opacity: s.cardSettings.backgroundOpacity.value / 100,
      backgroundColor: s.cardSettings.backgroundColor?.value?.value,
      borderRadius: s.cardSettings.borderRadius.value,
    });
    const contentPadding = Math.max(0, s.cardSettings.contentPadding.value);
    this.container.style.padding = `${contentPadding}px`;

    // Title
    renderChartTitle(this.container, s.titleFormattingCard);

    // Empty state
    if (items.length === 0) {
      this.currentItems = [];
      this.currentHasHighlights = false;
      this.renderEmpty(highContrast);
      return;
    }
    this.renderMetricToggleButton(items, viewport, hasHighlights, highContrast);
    const renderItems = this.getMetricDisplayItems(items);
    const renderHasHighlights = this.metricMode === 'normal' && Boolean(hasHighlights);
    this.currentItems = renderItems;
    this.currentHasHighlights = renderHasHighlights;

    // Dimensions
    const titleHeight = Array.from(
      this.container.querySelectorAll<HTMLElement>('.chart-title, .chart-subtitle'),
    ).reduce((height, element) => height + element.offsetHeight + 4, 0);
    const toggleButton = this.container.querySelector<HTMLElement>('.health-bar-kpi-toggle');
    if (toggleButton) {
      toggleButton.style.top = `${Math.max(6, contentPadding + titleHeight)}px`;
    }
    const svgWidth = viewport.width - 2 * contentPadding;
    const svgHeight = viewport.height - titleHeight - 2 * contentPadding;

    if (svgWidth <= 0 || svgHeight <= 0) {
      this.renderEmpty(highContrast);
      return;
    }

    const showCategoryLabels = s.categoryLabelSettings.show.value;
    const chartPaddingTop = Math.max(0, s.barShapeSettings.chartPaddingTop.value);
    const chartPaddingBottom = Math.max(0, s.barShapeSettings.chartPaddingBottom.value);
    const bottomMargin = showCategoryLabels ? chartPaddingBottom : Math.min(chartPaddingBottom, 6);
    const chartHeight = svgHeight - chartPaddingTop - bottomMargin;
    if (chartHeight <= 0) return;

    // Y-axis
    const showYAxis = s.scaleRangeSettings.showYAxis.value;
    const leftMargin = showYAxis ? Y_AXIS_WIDTH : 0;
    const barAreaWidth = svgWidth - leftMargin;

    // Bar layout
    const gap = s.barShapeSettings.gap.value;
    const maxBarWidth = s.barShapeSettings.barWidth.value;
    const barCount = renderItems.length;
    const totalGap = Math.max(0, barCount - 1) * gap;
    const availWidth = barAreaWidth - totalGap;

    // Scroll support — expand chart if bars would be too compressed
    const scroll = createScrollableChart({
      container: this.container,
      viewportWidth: svgWidth,
      viewportHeight: svgHeight,
      categoryCount: barCount,
      scrollSettings: s.scrollFormattingCard,
      availableChartWidth: barAreaWidth,
      availableChartHeight: chartHeight,
      direction: 'horizontal',
      categoryPadding: gap,
    });

    const effectiveBarAreaWidth = scroll.isScrolling ? scroll.chartWidth : barAreaWidth;
    const effectiveAvailWidth = effectiveBarAreaWidth - totalGap;
    const barWidth = Math.max(4, Math.min(maxBarWidth, effectiveAvailWidth / barCount));
    const totalBarsWidth = barCount * barWidth + totalGap;
    const effectiveSvgWidth = scroll.isScrolling ? scroll.svgWidth : svgWidth;
    const offsetX = leftMargin + (effectiveBarAreaWidth - totalBarsWidth) / 2;

    // Settings
    const cornerRadius = s.barShapeSettings.barCornerRadius.value;
    const showValue = s.valueLabelsSettings.showValue.value;
    const showPercent = s.valueLabelsSettings.showPercent.value;
    const animEnabled = s.animationSettings.enabled.value;
    const animDuration = s.animationSettings.duration.value;
    const staggerDelay = s.animationSettings.staggerDelay.value;

    // Colors — theme overrides when non-default
    const themeName = resolveColorTheme(s.colorThemeFormattingCard);
    const lowColor = themeName !== 'default'
      ? getHostChartColor(this.host.colorPalette, 0, themeName)
      : (s.colorSettings.lowColor.value?.value || '#EF4444');
    const midColor = themeName !== 'default'
      ? getHostChartColor(this.host.colorPalette, 1, themeName)
      : (s.colorSettings.midColor.value?.value || '#F59E0B');
    const highColor = themeName !== 'default'
      ? getHostChartColor(this.host.colorPalette, 2, themeName)
      : (s.colorSettings.highColor.value?.value || '#22C55E');
    const trackColor = s.colorSettings.trackColor.value?.value || '#E2E8F0';
    const trackOpacity = s.colorSettings.trackOpacity.value / 100;

    // Fill mode
    const fillModeVal = (s.barShapeSettings.fillMode?.value as unknown as { value?: string })?.value;
    const useGradient = fillModeVal !== 'solid';

    // Create SVG
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'health-bar-svg');
    svg.setAttribute('width', String(effectiveSvgWidth));
    svg.setAttribute('height', String(svgHeight));
    scroll.svgParent.appendChild(svg);

    // Chart group
    const chartGroup = document.createElementNS(SVG_NS, 'g');
    chartGroup.setAttribute('transform', `translate(0, ${chartPaddingTop})`);
    svg.appendChild(chartGroup);

    // Gradient definition (only in gradient mode)
    if (useGradient) {
      const defs = document.createElementNS(SVG_NS, 'defs');
      const gradient = document.createElementNS(SVG_NS, 'linearGradient');
      gradient.setAttribute('id', 'health-gradient');
      gradient.setAttribute('gradientUnits', 'userSpaceOnUse');
      gradient.setAttribute('x1', '0');
      gradient.setAttribute('y1', String(chartHeight)); // bottom
      gradient.setAttribute('x2', '0');
      gradient.setAttribute('y2', '0'); // top

      const stop0 = document.createElementNS(SVG_NS, 'stop');
      stop0.setAttribute('offset', '0%');
      stop0.setAttribute('stop-color', lowColor);
      gradient.appendChild(stop0);

      const stop50 = document.createElementNS(SVG_NS, 'stop');
      stop50.setAttribute('offset', '50%');
      stop50.setAttribute('stop-color', midColor);
      gradient.appendChild(stop50);

      const stop100 = document.createElementNS(SVG_NS, 'stop');
      stop100.setAttribute('offset', '100%');
      stop100.setAttribute('stop-color', highColor);
      gradient.appendChild(stop100);

      defs.appendChild(gradient);
      svg.insertBefore(defs, svg.firstChild);
    }

    // ── Zone Background ─────────────────────────────────────────
    if (s.healthBarZone.show.value) {
      const zoneColorsRaw = s.healthBarZone.zoneColors.value || '';
      const zoneColors = zoneColorsRaw
        .split(',')
        .map((c: string) => c.trim())
        .filter((c: string) => c.length > 0);

      if (zoneColors.length > 0) {
        const zoneCount = zoneColors.length;
        const zoneHeight = chartHeight / zoneCount;

        for (let z = 0; z < zoneCount; z++) {
          // Zones go from top (highest value) to bottom (lowest value)
          const zoneRect = document.createElementNS(SVG_NS, 'rect');
          zoneRect.setAttribute('class', 'health-bar-zone');
          zoneRect.setAttribute('x', String(offsetX));
          zoneRect.setAttribute('y', String(z * zoneHeight));
          zoneRect.setAttribute('width', String(totalBarsWidth));
          zoneRect.setAttribute('height', String(zoneHeight));
          // Reverse order: first color = high (top), last color = low (bottom)
          zoneRect.setAttribute('fill', zoneColors[z]);
          zoneRect.setAttribute('opacity', '0.12');
          chartGroup.appendChild(zoneRect);
        }
      }
    }

    // Grid lines (rendered independently of Y-axis labels)
    const barsLeft = offsetX;
    const barsRight = offsetX + totalBarsWidth;

    const gridGroup = document.createElementNS(SVG_NS, 'g');
    gridGroup.setAttribute('class', 'health-bar-grid');

    for (const tick of Y_TICKS) {
      const y = chartHeight * (1 - tick);

      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', String(barsLeft));
      line.setAttribute('y1', String(y));
      line.setAttribute('x2', String(barsRight));
      line.setAttribute('y2', String(y));
      gridGroup.appendChild(line);
    }

    chartGroup.appendChild(gridGroup);
    applyGridFormatting(gridGroup as unknown as SVGGElement, s.axisFormattingCard);

    // Y-axis ticks
    if (showYAxis) {
      const yAxisGroup = document.createElementNS(SVG_NS, 'g');
      yAxisGroup.setAttribute('class', 'health-bar-y-axis');

      for (const tick of Y_TICKS) {
        const y = chartHeight * (1 - tick);

        const label = document.createElementNS(SVG_NS, 'text');
        label.setAttribute('x', String(leftMargin - 6));
        label.setAttribute('y', String(y + 4));
        label.setAttribute('text-anchor', 'end');
        label.textContent = `${Math.round(tick * 100)}%`;
        yAxisGroup.appendChild(label);
      }

      chartGroup.appendChild(yAxisGroup);
      applyAxisFormatting(yAxisGroup as unknown as SVGGElement, s.axisFormattingCard);
    }

    // Render bars
    for (let i = 0; i < renderItems.length; i++) {
      const item = renderItems[i];
      const barX = offsetX + i * (barWidth + gap);
      const fillHeight = Math.max(0, chartHeight * item.pct);
      const fillY = chartHeight - fillHeight;

      // Track (background)
      const track = document.createElementNS(SVG_NS, 'rect');
      track.setAttribute('class', 'health-bar-track');
      track.setAttribute('x', String(barX));
      track.setAttribute('y', '0');
      track.setAttribute('width', String(barWidth));
      track.setAttribute('height', String(chartHeight));
      track.setAttribute('rx', String(cornerRadius));
      track.setAttribute('ry', String(cornerRadius));
      track.style.setProperty('fill', trackColor);
      track.style.setProperty('opacity', String(trackOpacity));
      chartGroup.appendChild(track);

      // Fill bar
      const fill = document.createElementNS(SVG_NS, 'rect');
      fill.setAttribute('class', 'health-bar-fill');
      fill.setAttribute('data-selection-key', item.selectionId.getKey());
      fill.setAttribute('x', String(barX));
      fill.setAttribute('y', String(fillY));
      fill.setAttribute('width', String(barWidth));
      fill.setAttribute('height', String(fillHeight));
      fill.setAttribute('rx', String(cornerRadius));
      fill.setAttribute('ry', String(cornerRadius));

      // Determine fill color: conditional formatting overrides gradient/solid
      const conditionalOverride = this.resolveConditionalBarColor(item.value);
      if (conditionalOverride) {
        fill.style.setProperty('fill', conditionalOverride);
      } else if (useGradient) {
        fill.setAttribute('fill', 'url(#health-gradient)');
      } else {
        const solidColor = this.interpolateHealthColor(item.pct, lowColor, midColor, highColor);
        fill.style.setProperty('fill', solidColor);
      }

      chartGroup.appendChild(fill);

      // Tooltip
      const host = this.host;
      const tooltipItems: VisualTooltipDataItem[] = [
        { displayName: 'Category', value: item.label },
        { displayName: 'Value', value: formatWithSettings(item.rawValue, this.settings.numberFormattingCard) },
        { displayName: '% Complete', value: `${Math.round(item.pct * 100)}%` },
      ];
      if (item.target !== null) {
        tooltipItems.push({ displayName: 'Target', value: formatWithSettings(item.target, this.settings.numberFormattingCard) });
      }

      const hitArea = document.createElementNS(SVG_NS, 'rect');
      hitArea.setAttribute('class', 'health-bar-hit-area');
      hitArea.setAttribute('x', String(barX));
      hitArea.setAttribute('y', '0');
      hitArea.setAttribute('width', String(barWidth));
      hitArea.setAttribute('height', String(chartHeight));
      hitArea.setAttribute('rx', String(cornerRadius));
      hitArea.setAttribute('ry', String(cornerRadius));
      hitArea.setAttribute('fill', 'transparent');
      hitArea.setAttribute('data-selection-key', item.selectionId.getKey());
      hitArea.style.cursor = allowInteractions(this.host) ? 'pointer' : 'default';
      chartGroup.appendChild(hitArea);

      hitArea.addEventListener('click', (event: MouseEvent) => {
        if (!allowInteractions(this.host)) return;
        event.stopPropagation();
        void this.selectionManager.select(item.selectionId, event.ctrlKey || event.metaKey).then(() => {
          this.applySelectionHighlight(renderItems, renderHasHighlights);
        });
      });
      hitArea.addEventListener('contextmenu', (event: MouseEvent) => {
        if (!allowInteractions(this.host)) return;
        event.preventDefault();
        event.stopPropagation();
        void this.selectionManager.showContextMenu(item.selectionId, {
          x: event.clientX,
          y: event.clientY,
        });
      });
      hitArea.addEventListener('mouseover', (event: MouseEvent) => {
        host.tooltipService.show({
          dataItems: tooltipItems,
          identities: [item.selectionId],
          coordinates: [event.clientX, event.clientY],
          isTouchEvent: false,
        });
      });
      hitArea.addEventListener('mousemove', (event: MouseEvent) => {
        host.tooltipService.move({
          dataItems: [],
          identities: [],
          coordinates: [event.clientX, event.clientY],
          isTouchEvent: false,
        });
      });
      hitArea.addEventListener('mouseout', () => {
        host.tooltipService.hide({ immediately: true, isTouchEvent: false });
      });

      // Animate fill bar
      if (animEnabled) {
        const delay = i * staggerDelay;
        const cancel = growBar(fill, delay, animDuration, 'vertical');
        this.cancelAnimations.push(cancel);
      }

      // ── Target Marker ─────────────────────────────────────────
      if (s.targetSettings.show.value && item.target !== null) {
        const maxValue = s.scaleRangeSettings.maxValue.value ?? 100;
        const minValue = s.scaleRangeSettings.minValue.value ?? 0;
        const range = maxValue - minValue;
        const clampedTarget = Math.max(minValue, Math.min(item.target, maxValue));
        const targetPct = range > 0 ? (clampedTarget - minValue) / range : 0;
        const targetY = chartHeight - chartHeight * targetPct;
        const targetColor = s.targetSettings.color.value?.value ?? '#0F172A';
        const targetLineWidth = s.targetSettings.lineWidth.value;
        const markerStyle = resolveDropdown(s.targetSettings.markerStyle) ?? 'line';

        if (markerStyle === 'line') {
          const line = document.createElementNS(SVG_NS, 'line');
          line.setAttribute('class', 'health-bar-target');
          line.setAttribute('x1', String(barX - 2));
          line.setAttribute('y1', String(targetY));
          line.setAttribute('x2', String(barX + barWidth + 2));
          line.setAttribute('y2', String(targetY));
          line.setAttribute('stroke', targetColor);
          line.setAttribute('stroke-width', String(targetLineWidth));
          line.setAttribute('stroke-linecap', 'round');
          chartGroup.appendChild(line);
        } else if (markerStyle === 'triangle') {
          const markerSize = barWidth * 0.15;
          const triX = barX - markerSize - 1;
          const triangle = document.createElementNS(SVG_NS, 'polygon');
          triangle.setAttribute('class', 'health-bar-target');
          triangle.setAttribute('points',
            `${triX + markerSize},${targetY} ${triX},${targetY - markerSize / 2} ${triX},${targetY + markerSize / 2}`
          );
          triangle.setAttribute('fill', targetColor);
          chartGroup.appendChild(triangle);
        } else if (markerStyle === 'diamond') {
          const markerSize = barWidth * 0.12;
          const diaX = barX + barWidth / 2;
          const diamond = document.createElementNS(SVG_NS, 'polygon');
          diamond.setAttribute('class', 'health-bar-target');
          diamond.setAttribute('points',
            `${diaX},${targetY - markerSize} ${diaX + markerSize},${targetY} ${diaX},${targetY + markerSize} ${diaX - markerSize},${targetY}`
          );
          diamond.setAttribute('fill', targetColor);
          chartGroup.appendChild(diamond);
        }
      }

      // Value label
      if (showValue) {
        const pctText = showPercent
          ? formatPercent(item.pct, { decimals: 0 })
          : formatWithSettings(item.rawValue, this.settings.numberFormattingCard);

        const valuePosition = resolveDropdown(s.valueLabelsSettings.position) ?? 'above';

        const text = document.createElementNS(SVG_NS, 'text');
        text.setAttribute('class', 'health-bar-value');

        if (valuePosition === 'inside') {
          text.setAttribute('x', String(barX + barWidth / 2));
          text.setAttribute('y', String(fillY + fillHeight / 2 + 4));
          text.setAttribute('text-anchor', 'middle');
          text.setAttribute('fill', '#FFFFFF');
        } else if (valuePosition === 'right' || valuePosition === 'end') {
          text.setAttribute('x', String(barX + barWidth + 4));
          text.setAttribute('y', String(fillY + 4));
          text.setAttribute('text-anchor', 'start');
        } else {
          // 'above' (default)
          const labelY = fillY - 6;
          text.setAttribute('x', String(barX + barWidth / 2));
          text.setAttribute('y', String(Math.max(12, labelY)));
          text.setAttribute('text-anchor', 'middle');
        }

        text.textContent = pctText;
        chartGroup.appendChild(text);

        // Animate value label
        if (animEnabled) {
          const labelDelay = i * staggerDelay + animDuration * 0.4;
          const cancel = fadeSlideIn(
            text as unknown as HTMLElement,
            'up',
            DURATION.fast,
            labelDelay,
          );
          this.cancelAnimations.push(cancel);
        }
      }

      // Category label (below bar)
      if (showCategoryLabels) {
        const catLabel = document.createElementNS(SVG_NS, 'text');
        catLabel.setAttribute('class', 'health-bar-label');
        catLabel.setAttribute('x', String(barX + barWidth / 2));
        catLabel.setAttribute('y', String(chartHeight + 16));
        catLabel.setAttribute('text-anchor', 'middle');

        // Truncate long text to fit bar width + gap
        const maxTextWidth = this.metricMode === 'normal'
          ? barWidth + gap * 0.6
          : Math.max(barWidth + gap * 0.6, effectiveBarAreaWidth);
        catLabel.textContent = item.label;
        chartGroup.appendChild(catLabel);

        // Measure and truncate if needed (after appending to get dimensions)
        const textLen = catLabel.getComputedTextLength?.() ?? 0;
        if (textLen > maxTextWidth && item.label.length > 2) {
          let truncated = item.label;
          while (truncated.length > 1) {
            truncated = truncated.slice(0, -1);
            catLabel.textContent = truncated + '\u2026';
            if ((catLabel.getComputedTextLength?.() ?? 0) <= maxTextWidth) break;
          }
        }
      }
    }

    // Apply value label font overrides
    if (showValue) {
      const vlFontSize = s.valueLabelsSettings.fontSize.value;
      const vlFontColor = s.valueLabelsSettings.fontColor.value?.value;
      const vlFontFamily = resolveDropdown(s.valueLabelsSettings.fontFamily);
      const vlFontWeight = resolveDropdown(s.valueLabelsSettings.fontWeight);
      const valueLabels = this.container.querySelectorAll('.health-bar-value');
      for (const el of valueLabels) {
        if (el instanceof SVGElement) {
          el.style.setProperty('font-size', `${vlFontSize}px`);
          if (vlFontColor && vlFontColor.length > 0) el.style.setProperty('fill', vlFontColor);
          if (vlFontFamily) el.style.setProperty('font-family', vlFontFamily);
          if (vlFontWeight) el.style.setProperty('font-weight', vlFontWeight);
        }
      }
    }

    // Apply category label formatting
    if (showCategoryLabels) {
      const catColor = s.categoryLabelSettings.fontColor.value?.value || '#64748B';
      const catSize = s.categoryLabelSettings.fontSize.value;
      const catFontFamily = resolveDropdown(s.categoryLabelSettings.fontFamily);
      const catFontWeight = resolveDropdown(s.categoryLabelSettings.fontWeight);
      const catLabels = this.container.querySelectorAll('.health-bar-label');
      for (const el of catLabels) {
        if (el instanceof SVGElement) {
          el.style.setProperty('fill', catColor);
          el.style.setProperty('font-size', `${catSize}px`);
          if (catFontFamily) el.style.setProperty('font-family', catFontFamily);
          if (catFontWeight) el.style.setProperty('font-weight', catFontWeight);
        }
      }
    }

    // d3 selection for shared overlay helpers
    const d3ChartGroup = d3.select(chartGroup as unknown as SVGGElement);

    // Build y scale for reference / trend overlays (value → pixel)
    const maxVal = s.scaleRangeSettings.maxValue.value ?? 100;
    const minVal = s.scaleRangeSettings.minValue.value ?? 0;
    const yScale = d3.scaleLinear().domain([minVal, maxVal]).range([chartHeight, 0]);
    const statValues = renderItems.map((d) => d.rawValue);
    const trendValues = renderItems.map((d) => d.value);

    // Reference line
    this.renderReferenceLine(d3ChartGroup, yScale, totalBarsWidth, statValues, barsLeft);

    // Trend line
    this.renderTrendLineOverlay(
      d3ChartGroup,
      trendValues,
      (idx: number) => offsetX + idx * (barWidth + gap) + barWidth / 2,
      yScale,
    );

    // Annotations
    this.renderAnnotationOverlay(d3ChartGroup, (category: string) => {
      const idx = renderItems.findIndex((d) => d.label === category);
      if (idx < 0) return null;
      const x = offsetX + idx * (barWidth + gap) + barWidth / 2;
      const y = yScale(renderItems[idx].value);
      return { x, y };
    });

    // Legend — show zone colors if zones are enabled
    const legendCard = this.settings.legendFormattingCard;
    if (legendCard.showLegend.value && s.healthBarZone.show.value) {
      const legendPos = resolveDropdown(legendCard.legendPosition) ?? 'bottom';
      const rawFontColor = legendCard.legendFontColor.value?.value;
      const zoneColorsRaw = s.healthBarZone.zoneColors.value || '';
      const zoneLegendColors = zoneColorsRaw.split(',').map((c: string) => c.trim()).filter((c: string) => c.length > 0);
      const zoneLabels = ['High', 'Mid', 'Low'];
      const legendItems: LegendItem[] = zoneLegendColors.map((color: string, idx: number) => ({
        label: idx < zoneLabels.length ? zoneLabels[idx] : `Zone ${idx + 1}`,
        color,
      }));
      if (legendItems.length > 0) {
        renderLegend(this.container, {
          items: legendItems,
          position: legendPos as 'top' | 'bottom' | 'left' | 'right',
          fontSize: legendCard.legendFontSize.value,
          fontColor: rawFontColor && rawFontColor.length > 0 ? rawFontColor : '#64748B',
          fontFamily: resolveDropdown(legendCard.legendFontFamily) || undefined,
          fontWeight: resolveDropdown(legendCard.legendFontWeight) || 'normal',
          aliases: legendCard.legendAliases.value,
        });
      }
    }

    // Cross-highlight dimming: dim non-highlighted bars
    this.applySelectionHighlight(renderItems, renderHasHighlights);

    // Accessibility
    this.applyAccessibility(renderItems);

    // Background click clears selection
    this.container.removeEventListener('click', this.handleBackgroundClick);
    if (allowInteractions(this.host)) {
      this.container.addEventListener('click', this.handleBackgroundClick);
    }
  }

  // ── Color Interpolation ─────────────────────────────────────────────

  private interpolateHealthColor(
    pct: number,
    low: string,
    mid: string,
    high: string,
  ): string {
    if (pct <= 0.5) {
      return d3.interpolateRgb(low, mid)(pct * 2);
    }
    return d3.interpolateRgb(mid, high)((pct - 0.5) * 2);
  }

  // ── Empty State ─────────────────────────────────────────────────────

  private renderEmpty(highContrast: ReturnType<typeof getHostHighContrastColors>): void {
    if (this.emptyStateMode === 'noData') {
      renderNoDataState(
        this.container,
        getLocalizedString(this.host, 'HealthBar_NoDataState', 'No data for the current selection.'),
        highContrast,
      );
      return;
    }
    renderLandingPage(this.container, {
      title: getLocalizedString(this.host, 'HealthBar_LandingTitle', 'Add data to build health bars'),
      description: getLocalizedString(this.host, 'HealthBar_LandingDescription', 'Bind a category and a measure to render the vertical health meter.'),
      steps: [getLocalizedString(this.host, 'HealthBar_LandingStepCategory', 'Category'), getLocalizedString(this.host, 'HealthBar_LandingStepMeasure', 'Measure'), getLocalizedString(this.host, 'HealthBar_LandingStepOptional', 'Optional target')],
    }, highContrast);
  }

  // ── Background Click ────────────────────────────────────────────────

  private handleBackgroundClick = (): void => {
    if (!allowInteractions(this.host)) return;
    void this.selectionManager.clear().then(() => {
      this.applySelectionHighlight(this.currentItems, this.currentHasHighlights);
    });
  };

  private applySelectionHighlight(items: HealthBarItem[], hasHighlights: boolean): void {
    const selectedKeys = this.metricMode === 'normal'
      ? new Set((this.selectionManager.getSelectionIds() as ISelectionId[]).map((id) => id.getKey()))
      : new Set<string>();
    const shouldDim = hasHighlights || selectedKeys.size > 0;
    const fills = this.container.querySelectorAll<SVGRectElement>('.health-bar-fill');
    fills.forEach((element, index) => {
      const item = items[index];
      if (!item) return;
      element.setAttribute('data-highlighted', String(item.highlighted));
      const isSelected = selectedKeys.has(item.selectionId.getKey());
      element.style.opacity = shouldDim && !item.highlighted && !isSelected ? '0.3' : '';
      element.style.filter = isSelected ? 'drop-shadow(0 0 4px rgba(37, 99, 235, 0.55))' : '';
    });
  }

  // ── Conditional Formatting ──────────────────────────────────────────

  private resolveConditionalBarColor(value: number): string | undefined {
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

  // ── Reference Line ────────────────────────────────────────────────

  private renderReferenceLine(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    yScale: d3.ScaleLinear<number, number>,
    chartWidth: number,
    allValues: number[],
    xOffset: number,
  ): void {
    const ref = this.settings.referenceLineFormattingCard;
    if (!ref.showReferenceLine.value) return;

    const refType = resolveDropdown(ref.referenceLineType) ?? 'custom';
    let refValue = ref.referenceLineValue.value;

    if (refType !== 'custom' && allValues.length > 0) {
      refValue = computeStatValue(allValues, refType as StatType);
    }

    const refColor = ref.referenceLineColor.value?.value ?? '#EF4444';
    const refStyle = resolveDropdown(ref.referenceLineStyle) ?? 'dashed';
    const labelText = ref.referenceLabelText.value.length > 0
      ? ref.referenceLabelText.value
      : formatWithSettings(refValue, this.settings.numberFormattingCard);

    const refGroup = g.append('g').attr('transform', `translate(${xOffset}, 0)`);
    const [domainStart, domainEnd] = yScale.domain();
    const bandDelta = Math.abs(domainEnd - domainStart)
      * (Math.max(0, ref.referenceBandWidth.value) / 100);
    renderHorizontalReferenceLine(refGroup, {
      value: refValue,
      yScale,
      chartWidth,
      lineColor: refColor,
      lineWidth: ref.referenceLineWidth.value,
      lineStyle: refStyle as 'solid' | 'dashed' | 'dotted',
      showLabel: ref.showReferenceLabel.value,
      labelText,
      showBand: ref.showReferenceBand.value,
      bandUpperValue: refValue + bandDelta,
      bandOpacity: ref.referenceBandOpacity.value / 100,
    });
  }

  // ── Trend Line ────────────────────────────────────────────────────

  private renderTrendLineOverlay(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    values: number[],
    xScale: (index: number) => number,
    yScale: d3.ScaleLinear<number, number>,
  ): void {
    const tl = this.settings.trendLineFormattingCard;
    if (!tl.showTrendLine.value || values.length < 2) return;

    const trendType = (resolveDropdown(tl.trendLineType) ?? 'linear') as TrendType;
    const result = computeRegression(values, trendType, tl.polynomialOrder.value);
    const trendColor = tl.trendLineColor.value?.value ?? '#6366F1';

    renderTrendLine(g, {
      predicted: result.predicted,
      xScale,
      yScale,
      lineColor: trendColor,
      lineWidth: tl.trendLineWidth.value,
      showEquation: tl.showEquation.value,
      showR2: tl.showR2.value,
      equation: result.equation,
      r2: result.r2,
    });
  }

  // ── Annotations ───────────────────────────────────────────────────

  private renderAnnotationOverlay(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    resolvePosition: (category: string) => { x: number; y: number } | null,
  ): void {
    const ann = this.settings.annotationFormattingCard;
    if (!ann.showAnnotations.value) return;

    const slots = [
      { category: ann.annotation1Category.value, text: ann.annotation1Text.value, position: resolveDropdown(ann.annotation1Position) ?? 'above' },
      { category: ann.annotation2Category.value, text: ann.annotation2Text.value, position: resolveDropdown(ann.annotation2Position) ?? 'above' },
      { category: ann.annotation3Category.value, text: ann.annotation3Text.value, position: resolveDropdown(ann.annotation3Position) ?? 'above' },
    ];

    const config = buildAnnotationConfig(
      true,
      slots,
      ann.annotationFontSize.value,
      ann.annotationFontColor.value?.value || '#475569',
      ann.annotationConnectorColor.value?.value || '#94A3B8',
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
    if (config) renderAnnotations(g, config);
  }

  // ── Accessibility ─────────────────────────────────────────────────

  private applyAccessibility(items: HealthBarItem[]): void {
    const acc = this.settings.accessibilityFormattingCard;
    if (!acc.enableKeyboardNav.value) return;

    ensureFocusRingStyles();

    applyChartAria(this.container, {
      chartType: 'health bar chart',
      title: this.settings.titleFormattingCard.titleText.value || undefined,
      dataPointCount: items.length,
    });

    const hitAreas = this.container.querySelectorAll<SVGRectElement>('.health-bar-hit-area');
    hitAreas.forEach((hitArea, index) => {
      const item = items[index];
      if (!item) return;
      applyDataPointAria(
        hitArea,
        item.label,
        formatWithSettings(item.rawValue, this.settings.numberFormattingCard),
        index,
        items.length,
      );
      hitArea.setAttribute('tabindex', '0');
      hitArea.setAttribute('aria-keyshortcuts', 'Enter Space ArrowLeft ArrowRight Home End');
      hitArea.setAttribute('aria-disabled', allowInteractions(this.host) ? 'false' : 'true');
    });

    const cleanup = attachKeyboardNav({
      container: this.container,
      itemSelector: '.health-bar-hit-area',
      onActivate: (el) => {
        el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      },
    });
    this.cancelAnimations.push(cleanup);
  }

  // ── Formatting Model ────────────────────────────────────────────────

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  // ── Cleanup ─────────────────────────────────────────────────────────

  public destroy(): void {
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
  }
}
