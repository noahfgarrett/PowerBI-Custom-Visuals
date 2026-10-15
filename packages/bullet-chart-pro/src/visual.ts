/**
 * Bullet Chart Pro — Power BI IVisual implementation.
 * Horizontal bullet charts with qualitative ranges (poor / satisfactory / good),
 * an actual-value bar, a target marker, and entrance animations.
 */

import powerbi from 'powerbi-visuals-api';
import * as d3 from 'd3';
import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel';
import { BulletChartProSettings } from './settings';
import {
  allowInteractions,
  attachEmptySpaceContextMenu,
  applyBasicHighContrastStyles,
  formatNumber,
  formatWithSettings,
  DURATION,
  growBar,
  fadeSlideIn,
  withOpacity,
  applyCardStyle,
  type CardStyleMode,
  renderChartTitle,
  applyDataLabelFormatting,
  createScrollableChart,
  resolveDropdown,
  applySortOrder,
  buildConditionalConfig,
  resolveConditionalColor,
  applyChartAria,
  attachKeyboardNav,
  ensureFocusRingStyles,
  syncLegendFormattingVisibility,
  syncTitleFormattingVisibility,
  syncCardStyleVisibility,
  syncDateFilterFormattingVisibility,
  hideInlineLegendFormatting,
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
  getHostHighContrastColors,
  notifyRenderingStarted,
  notifyRenderingFinished,
  notifyRenderingFailed,
  renderLandingPage,
  renderNoDataState,
  getVisualEmptyStateMode,
  focusHighlightedData,
  getLocalizedString,
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

interface BulletItem {
  label: string;
  value: number;
  target: number | null;
  poor: number;
  satisfactory: number;
  good: number;
  selectionId: ISelectionId;
  highlighted: boolean;
}

interface BulletData {
  items: BulletItem[];
  isEmpty: boolean;
  /** Whether cross-highlight data is present from another visual/slicer */
  hasHighlights: boolean;
}

// ── Constants ───────────────────────────────────────────────────────

/** Minimum width reserved for category labels on the left */
const MIN_LABEL_WIDTH = 60;
/** Maximum width reserved for category labels on the left */
const MAX_LABEL_WIDTH = 120;
/** Padding to the right for value labels */
const VALUE_LABEL_WIDTH = 50;

// ── Visual ──────────────────────────────────────────────────────────

export class BulletChartProVisual implements IVisual {
  private host: IVisualHost;
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private container: HTMLElement;
  private settings: BulletChartProSettings;
  private formattingSettingsService: FormattingSettingsService;
  private cancelAnimations: Array<() => void> = [];
  private detachEmptySpaceContextMenu: (() => void) | null = null;
  private emptyStateMode: 'unconfigured' | 'noData' = 'unconfigured';

  /** Cached data for cross-highlight support. */
  private currentData: BulletData | null = null;

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new BulletChartProSettings();
    this.formattingSettingsService = new FormattingSettingsService(options.host.createLocalizationManager());
    this.container.classList.add('bullet-container');
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
        BulletChartProSettings,
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
    syncDateFilterFormattingVisibility(this.settings.dateFilterFormattingCard);
    syncCardStyleVisibility(this.settings.cardSettings);
    const cardMode = (resolveDropdown(this.settings.cardSettings.cardStyleMode) ?? 'glass') as CardStyleMode;
    this.settings.cardSettings.borderRadius.visible = cardMode !== 'none';

    const isVertical = (resolveDropdown(this.settings.bulletSettings.orientation) ?? 'horizontal') === 'vertical';
    this.settings.legendFormattingCard.visible = !isVertical;
    syncLegendFormattingVisibility(this.settings.legendFormattingCard);
    hideInlineLegendFormatting(this.settings.legendFormattingCard);

    this.settings.dataLabelFormattingCard.visible = this.settings.bulletSettings.showLabels.value;
    this.settings.dataLabelFormattingCard.showDataLabels.visible = false;
    // Value labels have chart-specific placement: above columns in vertical mode
    // and in the reserved value gutter in horizontal mode.
    this.settings.dataLabelFormattingCard.dataLabelPosition.visible = false;

    // Hide dead axis/grid properties — bullet-chart-pro has its own minimal axis
    this.settings.axisFormattingCard.xAxisTitle.visible = false;
    this.settings.axisFormattingCard.yAxisTitle.visible = false;
    this.settings.axisFormattingCard.yAxisMin.visible = false;
    this.settings.axisFormattingCard.yAxisMax.visible = false;
    this.settings.axisFormattingCard.axisLabelRotation.visible = false;
    this.settings.axisFormattingCard.showXAxis.visible = false;
    this.settings.axisFormattingCard.showYAxis.visible = false;
    this.settings.axisFormattingCard.axisLineColor.visible = false;
    this.settings.axisFormattingCard.axisLineWidth.visible = false;
    this.settings.axisFormattingCard.showGridLines.visible = false;
    this.settings.axisFormattingCard.gridLineColor.visible = false;
    this.settings.axisFormattingCard.gridLineStyle.visible = false;
    this.settings.axisFormattingCard.gridLineWidth.visible = false;
    this.settings.axisFormattingCard.gridLineOpacity.visible = false;

    // Hide dual-axis-only properties (no combo/dual-axis support)
    this.settings.referenceLineFormattingCard.referenceLineAxis.visible = false;
    this.settings.trendLineFormattingCard.trendLineAxis.visible = false;
    this.settings.axisFormattingCard.integerTicks.visible = false;
    this.settings.layoutSettings.valueLabelPadding.visible = this.settings.bulletSettings.showLabels.value;

    // ── Conditional visibility ──────────────────────────────────────
    // Forecast sub-settings: hide when show off
    const forecastOn = this.settings.bulletMarkers.showForecast.value;
    this.settings.bulletMarkers.forecastValue.visible = forecastOn;
    this.settings.bulletMarkers.bandWidth.visible = forecastOn;
    this.settings.bulletMarkers.forecastColor.visible = forecastOn;
    this.settings.bulletSettings.labelPadding.visible = this.settings.bulletSettings.showLabels.value;
    this.settings.bulletMarkers.targetMarkerWidth.visible = this.settings.bulletSettings.showTarget.value;

    const showRef = this.settings.referenceLineFormattingCard.showReferenceLine.value;
    const refType = resolveDropdown(this.settings.referenceLineFormattingCard.referenceLineType) ?? 'custom';
    const showRefLabel = showRef && this.settings.referenceLineFormattingCard.showReferenceLabel.value;
    const showRefBand = showRef && !isVertical && this.settings.referenceLineFormattingCard.showReferenceBand.value;
    this.settings.referenceLineFormattingCard.referenceLineType.visible = showRef;
    this.settings.referenceLineFormattingCard.referenceLineValue.visible = showRef && refType === 'custom';
    this.settings.referenceLineFormattingCard.referenceLineColor.visible = showRef;
    this.settings.referenceLineFormattingCard.referenceLineWidth.visible = showRef;
    this.settings.referenceLineFormattingCard.referenceLineStyle.visible = showRef;
    this.settings.referenceLineFormattingCard.showReferenceLabel.visible = showRef;
    this.settings.referenceLineFormattingCard.referenceLabelText.visible = showRefLabel;
    this.settings.referenceLineFormattingCard.showReferenceBand.visible = showRef && !isVertical;
    this.settings.referenceLineFormattingCard.referenceBandOpacity.visible = showRefBand;
    this.settings.referenceLineFormattingCard.referenceBandWidth.visible = false;

    const showTrend = this.settings.trendLineFormattingCard.showTrendLine.value;
    const trendType = resolveDropdown(this.settings.trendLineFormattingCard.trendLineType) ?? 'linear';
    this.settings.trendLineFormattingCard.trendLineType.visible = showTrend;
    this.settings.trendLineFormattingCard.polynomialOrder.visible = showTrend && trendType === 'polynomial';
    this.settings.trendLineFormattingCard.trendLineColor.visible = showTrend;
    this.settings.trendLineFormattingCard.trendLineWidth.visible = showTrend;
    this.settings.trendLineFormattingCard.showEquation.visible = showTrend;
    this.settings.trendLineFormattingCard.showR2.visible = showTrend;

    const showConditional = this.settings.conditionalFormattingCard.enableConditional.value;
    this.settings.conditionalFormattingCard.conditionalDirection.visible = showConditional;
    this.settings.conditionalFormattingCard.threshold1.visible = showConditional;
    this.settings.conditionalFormattingCard.threshold2.visible = showConditional;
    this.settings.conditionalFormattingCard.conditionalColor1.visible = showConditional;
    this.settings.conditionalFormattingCard.conditionalColor2.visible = showConditional;
    this.settings.conditionalFormattingCard.conditionalColor3.visible = showConditional;

    const showAnnotations = this.settings.annotationFormattingCard.showAnnotations.value;
    for (const slice of this.settings.annotationFormattingCard.slices) {
      if (slice !== this.settings.annotationFormattingCard.showAnnotations) {
        slice.visible = showAnnotations;
      }
    }
    this.settings.animationSettings.duration.visible = this.settings.animationSettings.enabled.value;

    // Extract data
    const extractedData = this.extractData(dataView);
    const focusedItems = focusHighlightedData(extractedData.items, extractedData.hasHighlights);
    const data: BulletData = {
      ...extractedData,
      items: focusedItems,
      isEmpty: focusedItems.length === 0,
    };
    this.currentData = data;

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
      const highContrastColors = getHostHighContrastColors(this.host);
      if (highContrastColors.enabled) {
        applyBasicHighContrastStyles(this.container, highContrastColors, {
          textSelectors: ['.bullet-empty', '.bullet-label', '.bullet-value-label', '.bullet-target', '.bullet-forecast'],
          fillSelectors: ['.bullet-range', '.bullet-value-bar'],
          strokeSelectors: ['.bullet-target', '.bullet-forecast', '.bullet-svg line'],
        });
      }
      notifyRenderingFinished(this.host, options);
    } catch (error) {
      notifyRenderingFailed(this.host, options, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  // ── Data Extraction ─────────────────────────────────────────────

  private extractData(dataView: DataView | undefined): BulletData {
    const empty: BulletData = { items: [], isEmpty: true, hasHighlights: false };

    if (!dataView?.categorical) return empty;

    const categorical = dataView.categorical;
    const categoryColumn = categorical.categories?.[0];
    const valuesColumns = categorical.values;

    if (!categoryColumn || !valuesColumns || valuesColumns.length === 0) return empty;

    const categories = categoryColumn.values.map((v) =>
      v !== null && v !== undefined ? String(v) : '',
    );

    if (categories.length === 0) return empty;

    // Find columns by role
    let measureCol: powerbi.DataViewValueColumn | undefined;
    let targetCol: powerbi.DataViewValueColumn | undefined;
    let poorCol: powerbi.DataViewValueColumn | undefined;
    let satisfactoryCol: powerbi.DataViewValueColumn | undefined;
    let goodCol: powerbi.DataViewValueColumn | undefined;

    for (const col of valuesColumns) {
      const role = col.source.roles;
      if (!role) continue;
      if (role['measure']) measureCol = col;
      if (role['target']) targetCol = col;
      if (role['poor']) poorCol = col;
      if (role['satisfactory']) satisfactoryCol = col;
      if (role['good']) goodCol = col;
    }

    if (!measureCol) return empty;

    const hlRaw = (measureCol as unknown as { highlights?: unknown[] }).highlights as unknown[] | undefined;

    const items: BulletItem[] = [];


    const dateConfig: DateFilterConfig = {
      enabled: this.settings.dateFilterFormattingCard.enableDateFilter.value,
      startDate: this.settings.dateFilterFormattingCard.startDate.value,
      endAtCurrentDate: this.settings.dateFilterFormattingCard.endAtCurrentDate.value,
      endDate: this.settings.dateFilterFormattingCard.endDate.value,
    };
    const dateIndices = isDateColumn(categoryColumn.source) ? getDateFilterIndices(categoryColumn.values, dateConfig) : null;

    for (let i = 0; i < categories.length; i++) {
      if (dateIndices && !dateIndices.has(i)) continue;

      const value = typeof measureCol.values[i] === 'number'
        ? (measureCol.values[i] as number)
        : 0;

      const target = targetCol && typeof targetCol.values[i] === 'number'
        ? (targetCol.values[i] as number)
        : null;

      const poor = poorCol && typeof poorCol.values[i] === 'number'
        ? (poorCol.values[i] as number)
        : value * 0.5;

      const satisfactory = satisfactoryCol && typeof satisfactoryCol.values[i] === 'number'
        ? (satisfactoryCol.values[i] as number)
        : value * 0.75;

      const good = goodCol && typeof goodCol.values[i] === 'number'
        ? (goodCol.values[i] as number)
        : value * 1.2;

      const highlighted = hlRaw ? hlRaw[i] !== null && hlRaw[i] !== undefined : false;

      items.push({
        label: categories[i],
        value,
        target,
        poor,
        satisfactory,
        good,
        selectionId: this.host.createSelectionIdBuilder()
          .withCategory(categoryColumn, i)
          .createSelectionId(),
        highlighted,
      });
    }

    const sortedItems = applySortOrder(
      items.map((item) => ({ ...item, name: item.label })),
      this.settings.sortFormattingCard,
    ).map(({ name: _name, ...item }) => item);

    const hasHighlights = sortedItems.some((item) => item.highlighted);
    return { items: sortedItems, isEmpty: sortedItems.length === 0, hasHighlights };
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
    if (this.emptyStateMode === 'noData') {
      renderNoDataState(
        this.container,
        getLocalizedString(this.host, 'BulletChartPro_NoDataState', 'No data for the current selection.'),
        getHostHighContrastColors(this.host),
      );
      return;
    }
    renderLandingPage(this.container, {
      title: getLocalizedString(this.host, 'BulletChartPro_LandingTitle', 'Add data to build a bullet chart'),
      description: getLocalizedString(this.host, 'BulletChartPro_LandingDescription', 'Bullet Chart Pro needs one category and one measure to render the actual bar.'),
      steps: [
        getLocalizedString(this.host, 'BulletChartPro_LandingStepAxis', 'Put a category on the axis.'),
        getLocalizedString(this.host, 'BulletChartPro_LandingStepMeasure', 'Add a measure for the main value.'),
        getLocalizedString(this.host, 'BulletChartPro_LandingStepOptional', 'Optionally add target and range measures for richer context.'),
      ],
      hint: getLocalizedString(this.host, 'BulletChartPro_LandingHint', 'This landing page appears until the visual has enough fields.'),
    }, getHostHighContrastColors(this.host));
  }

  // ── Main Render ───────────────────────────────────────────────────

  private render(data: BulletData, viewport: powerbi.IViewport): void {
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    renderChartTitle(this.container, this.settings.titleFormattingCard);
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.container.addEventListener('click', this.handleBackgroundClick);

    const s = this.settings;
    const barHeight = Math.max(8, s.bulletSettings.barHeight.value);
    const showTarget = s.bulletSettings.showTarget.value;
    const showLabels = s.bulletSettings.showLabels.value;
    const labelPadding = Math.max(0, s.bulletSettings.labelPadding.value);
    const containerPadding = Math.max(0, s.layoutSettings.containerPadding.value + s.cardSettings.contentPadding.value);
    const rowGap = Math.max(0, s.layoutSettings.rowGap.value);
    const valueLabelPadding = Math.max(0, s.layoutSettings.valueLabelPadding.value);
    const isVertical = (resolveDropdown(s.bulletSettings.orientation) ?? 'horizontal') === 'vertical';
    this.container.style.padding = `${containerPadding}px`;

    // Colors — theme overrides when non-default
    const themeName = resolveColorTheme(s.colorThemeFormattingCard);
    const poorColor = themeName !== 'default'
      ? getHostChartColor(this.host.colorPalette, 0, themeName)
      : (s.rangeSettings.poorColor.value?.value ?? '#FCA5A5');
    const satColor = themeName !== 'default'
      ? getHostChartColor(this.host.colorPalette, 1, themeName)
      : (s.rangeSettings.satisfactoryColor.value?.value ?? '#FDE68A');
    const goodColor = themeName !== 'default'
      ? getHostChartColor(this.host.colorPalette, 2, themeName)
      : (s.rangeSettings.goodColor.value?.value ?? '#BBF7D0');
    const barColor = themeName !== 'default'
      ? getHostChartColor(this.host.colorPalette, 3, themeName)
      : (s.rangeSettings.barColor.value?.value ?? '#1E293B');

    // Bullet settings
    const rangeOpacity = s.bulletSettings.rangeOpacity.value / 100;
    const barCornerRadius = s.bulletSettings.barCornerRadius.value;

    // Animation
    const animEnabled = s.animationSettings.enabled.value;
    const animDuration = s.animationSettings.duration.value;

    // Forecast settings
    const showForecast = s.bulletMarkers.showForecast.value;
    const forecastValue = s.bulletMarkers.forecastValue.value;
    const forecastBandWidth = s.bulletMarkers.bandWidth.value;

    // Forecast color
    const forecastColor = s.bulletMarkers.forecastColor.value?.value ?? '#6366F1';

    // Marker stroke width
    const targetMarkerWidth = s.bulletMarkers.targetMarkerWidth.value;

    // Layout calculations
    const svgWidth = viewport.width - containerPadding * 2;
    const totalRows = data.items.length;

    if (isVertical) {
      // ── Vertical layout: columns side by side ─────────────────
      const colWidth = barHeight + rowGap;
      const labelReserve = showLabels ? 20 + labelPadding : 0; // bottom labels
      const valueLabelReserve = showLabels ? 20 + valueLabelPadding : 0; // top value labels
      const svgHeight = viewport.height - containerPadding * 2;
      const chartTop = valueLabelReserve;
      const chartBottom = svgHeight - labelReserve;
      const chartHeight = Math.max(0, chartBottom - chartTop);
      if (chartHeight <= 0) { this.renderEmpty(); return; }

      const globalMax = d3.max(data.items, (d) =>
        Math.max(d.good, d.value, d.target ?? 0, showForecast ? forecastValue : 0),
      ) ?? 100;

      const yScale = d3.scaleLinear()
        .domain([0, globalMax])
        .range([chartBottom, chartTop])
        .nice();

      const scroll = createScrollableChart({
        container: this.container,
        viewportWidth: svgWidth,
        viewportHeight: svgHeight,
        categoryCount: totalRows,
        scrollSettings: s.scrollFormattingCard,
        availableChartWidth: svgWidth,
        availableChartHeight: chartHeight,
        direction: 'horizontal',
        categoryPadding: rowGap,
      });

      const svg = d3.select(scroll.svgParent)
        .append('svg')
        .attr('class', 'bullet-svg')
        .attr('width', scroll.svgWidth)
        .attr('height', svgHeight);

      data.items.forEach((item, colIdx) => {
        const colX = colIdx * colWidth + colWidth / 2;
        const colGroup = svg.append('g')
          .attr('transform', `translate(${colX},0)`);

        // Category label (bottom)
        if (showLabels) {
          colGroup.append('text')
            .attr('class', 'bullet-label')
            .attr('x', 0)
            .attr('y', chartBottom + 12 + labelPadding)
            .attr('text-anchor', 'middle')
            .text(this.truncateLabel(item.label, colWidth - 4));
        }

        // Qualitative range rectangles (vertical)
        const halfBar = barHeight / 2;
        const poorY1 = yScale(item.poor);
        const poorH = Math.max(0, yScale(0) - poorY1);
        colGroup.append('rect')
          .attr('class', 'bullet-range bullet-range-poor')
          .attr('x', -halfBar).attr('y', poorY1)
          .attr('width', barHeight).attr('height', poorH)
          .attr('fill', withOpacity(poorColor, rangeOpacity))
          .attr('rx', barCornerRadius).attr('ry', barCornerRadius);

        const satY1 = yScale(item.satisfactory);
        const satH = Math.max(0, yScale(item.poor) - satY1);
        colGroup.append('rect')
          .attr('class', 'bullet-range bullet-range-satisfactory')
          .attr('x', -halfBar).attr('y', satY1)
          .attr('width', barHeight).attr('height', satH)
          .attr('fill', withOpacity(satColor, rangeOpacity))
          .attr('rx', barCornerRadius).attr('ry', barCornerRadius);

        const goodY1 = yScale(item.good);
        const goodH = Math.max(0, yScale(item.satisfactory) - goodY1);
        colGroup.append('rect')
          .attr('class', 'bullet-range bullet-range-good')
          .attr('x', -halfBar).attr('y', goodY1)
          .attr('width', barHeight).attr('height', goodH)
          .attr('fill', withOpacity(goodColor, rangeOpacity))
          .attr('rx', barCornerRadius).attr('ry', barCornerRadius);

        // Actual value bar (vertical — thin bar from bottom up)
        const valBarWidth = barHeight * 0.4;
        const valBarX = -valBarWidth / 2;
        const valBarTop = yScale(item.value);
        const valBarH = Math.max(0, yScale(0) - valBarTop);

        const valueRect = colGroup.append('rect')
          .attr('class', 'bullet-value-bar')
          .attr('data-selection-key', item.selectionId.getKey())
          .attr('x', valBarX).attr('y', valBarTop)
          .attr('width', valBarWidth).attr('height', valBarH)
          .attr('fill', barColor)
          .attr('rx', barCornerRadius).attr('ry', barCornerRadius);

        this.attachTooltip(valueRect, item);
      valueRect.style('cursor', allowInteractions(this.host) ? 'pointer' : 'default')
        .on('click', (event: MouseEvent) => {
          if (!allowInteractions(this.host)) return;
          event.stopPropagation();
          const selectionPromise = this.selectionManager.select(
            item.selectionId,
            event.ctrlKey || event.metaKey,
          );
          this.applySelectionHighlight();
          void selectionPromise.then(() => this.applySelectionHighlight());
        })
        .on('contextmenu', (event: MouseEvent) => {
          if (!allowInteractions(this.host)) return;
          event.preventDefault(); event.stopPropagation();
          void this.selectionManager.showContextMenu(item.selectionId, { x: event.clientX, y: event.clientY });
        });

        if (animEnabled) {
          const valueNode = valueRect.node();
          if (valueNode) {
            const delay = colIdx * DURATION.stagger;
            const cancel = growBar(valueNode, delay, animDuration, 'vertical');
            this.cancelAnimations.push(cancel);
          }
        }

        // Target marker (horizontal line)
        if (showTarget && item.target !== null) {
          const targetY = yScale(item.target);
          const markerGroup = colGroup.append('g').attr('class', 'bullet-target-group');
          markerGroup.append('line')
            .attr('class', 'bullet-target')
            .attr('x1', -halfBar).attr('x2', halfBar)
            .attr('y1', targetY).attr('y2', targetY)
            .attr('stroke', barColor).attr('stroke-width', targetMarkerWidth);
          if (animEnabled) {
            const markerNode = markerGroup.node();
            if (markerNode) {
              const delay = colIdx * DURATION.stagger + 200;
              const cancel = fadeSlideIn(markerNode as unknown as HTMLElement, 'left', 300, delay);
              this.cancelAnimations.push(cancel);
            }
          }
        }

        // Forecast marker
        if (showForecast && forecastValue > 0) {
          const fcY = yScale(forecastValue);
          const bandHalf = forecastBandWidth / 2;
          colGroup.append('rect')
            .attr('class', 'bullet-forecast-band')
            .attr('x', -halfBar).attr('y', fcY - bandHalf)
            .attr('width', barHeight).attr('height', forecastBandWidth)
            .attr('fill', withOpacity(forecastColor, 0.2))
            .style('pointer-events', 'none');
          colGroup.append('line')
            .attr('class', 'bullet-forecast')
            .attr('x1', -halfBar).attr('x2', halfBar)
            .attr('y1', fcY).attr('y2', fcY)
            .attr('stroke', forecastColor).attr('stroke-width', 2)
            .attr('stroke-dasharray', '4,3');
        }

        // Conditional color override
        const conditionalOverride = this.resolveConditionalBarColor(item.value);
        if (conditionalOverride) { valueRect.attr('fill', conditionalOverride); }

        // Value label (top)
        if (showLabels) {
          colGroup.append('text')
            .attr('class', 'bullet-value-label')
            .attr('x', 0).attr('y', valBarTop - Math.max(4, valueLabelPadding))
            .attr('text-anchor', 'middle')
            .text(formatWithSettings(item.value, this.settings.numberFormattingCard));
        }
      });

      // Shared formatting
      applyDataLabelFormatting(this.container, s.dataLabelFormattingCard, '.bullet-value-label');
      const axisSettings = s.axisFormattingCard;
      const axisLabelColor = axisSettings.axisLabelColor.value?.value || '#64748B';
      const axisLabelSize = axisSettings.axisLabelSize.value;
      const axisLabelFontFamily = resolveDropdown(axisSettings.axisLabelFontFamily);
      const axisLabelFontWeight = resolveDropdown(axisSettings.axisLabelFontWeight) ?? 'normal';
      const labelEls = this.container.querySelectorAll<SVGTextElement>('.bullet-label');
      for (const el of labelEls) {
        el.style.setProperty('fill', axisLabelColor);
        el.style.setProperty('font-size', `${axisLabelSize}px`);
        el.style.setProperty('font-weight', axisLabelFontWeight);
        if (axisLabelFontFamily) {
          el.style.setProperty('font-family', axisLabelFontFamily);
        }
      }

      const svgGroup = svg.append('g').attr('class', 'bullet-overlays');
      const allValues = data.items.map((d) => d.value);
      const xOverlayScale = d3.scaleLinear().domain([0, globalMax]).range([0, svgWidth]);
      this.renderReferenceLine(svgGroup, yScale, svgWidth, allValues);
      this.renderTrendLineOverlay(svgGroup, allValues, (idx: number) => {
        return idx * colWidth + colWidth / 2;
      }, yScale);
      this.renderAnnotationOverlay(svgGroup, (category: string) => {
        const idx = data.items.findIndex((d) => d.label === category);
        if (idx < 0) return null;
        const item = data.items[idx];
        return { x: idx * colWidth + colWidth / 2, y: yScale(item.value) };
      });
      this.applyAccessibility(data);
      return;
    }

    // ── Horizontal layout (original) ────────────────────────────────
    const rowHeight = barHeight + rowGap;
    const baseSvgHeight = Math.max(totalRows * rowHeight, barHeight);

    // Compute label width: measure text or use default
    const labelWidth = showLabels
      ? Math.min(MAX_LABEL_WIDTH, Math.max(MIN_LABEL_WIDTH, svgWidth * 0.2))
      : 0;
    const valueLabelSpace = showLabels ? VALUE_LABEL_WIDTH + valueLabelPadding : 0;
    const chartLeft = labelWidth + labelPadding;
    const chartRight = svgWidth - valueLabelSpace - labelPadding;
    const chartWidth = Math.max(0, chartRight - chartLeft);

    if (chartWidth <= 0) {
      this.renderEmpty();
      return;
    }

    // Scroll support (vertical — stacked bullet rows)
    const scroll = createScrollableChart({
      container: this.container,
      viewportWidth: svgWidth,
      viewportHeight: viewport.height - containerPadding * 2,
      categoryCount: totalRows,
      scrollSettings: s.scrollFormattingCard,
      availableChartWidth: chartWidth,
      availableChartHeight: viewport.height - containerPadding * 2,
      direction: 'vertical',
      categoryPadding: rowGap,
    });
    const svgHeight = scroll.isScrolling
      ? Math.max(totalRows * rowHeight, barHeight)
      : baseSvgHeight;

    // Find the global max across all "good" values for consistent scale
    const globalMax = d3.max(data.items, (d) =>
      Math.max(d.good, d.value, d.target ?? 0, showForecast ? forecastValue : 0),
    ) ?? 100;

    // xScale: maps data values to chart pixel coordinates
    const xScale = d3.scaleLinear()
      .domain([0, globalMax])
      .range([chartLeft, chartRight])
      .nice();

    // Create SVG
    const svg = d3.select(scroll.svgParent)
      .append('svg')
      .attr('class', 'bullet-svg')
      .attr('width', svgWidth)
      .attr('height', svgHeight);

    // Render each bullet row
    data.items.forEach((item, rowIdx) => {
      const rowY = rowIdx * rowHeight;
      const rowGroup = svg.append('g')
        .attr('transform', `translate(0,${rowY})`);

      // ── Category label (left) ───────────────────────────────────
      if (showLabels) {
        rowGroup.append('text')
          .attr('class', 'bullet-label')
          .attr('x', Math.max(0, labelWidth - labelPadding))
          .attr('y', barHeight / 2)
          .attr('dy', '0.35em')
          .attr('text-anchor', 'end')
          .text(this.truncateLabel(item.label, Math.max(8, labelWidth - Math.max(8, labelPadding * 2))));
      }

      // ── Qualitative range rectangles ────────────────────────────
      // Poor range: 0 → poor
      const poorX = xScale(0);
      const poorW = Math.max(0, xScale(item.poor) - poorX);
      rowGroup.append('rect')
        .attr('class', 'bullet-range bullet-range-poor')
        .attr('x', poorX)
        .attr('y', 0)
        .attr('width', poorW)
        .attr('height', barHeight)
        .attr('fill', withOpacity(poorColor, rangeOpacity))
        .attr('rx', barCornerRadius)
        .attr('ry', barCornerRadius);

      // Satisfactory range: poor → satisfactory
      const satX = xScale(item.poor);
      const satW = Math.max(0, xScale(item.satisfactory) - satX);
      rowGroup.append('rect')
        .attr('class', 'bullet-range bullet-range-satisfactory')
        .attr('x', satX)
        .attr('y', 0)
        .attr('width', satW)
        .attr('height', barHeight)
        .attr('fill', withOpacity(satColor, rangeOpacity))
        .attr('rx', barCornerRadius)
        .attr('ry', barCornerRadius);

      // Good range: satisfactory → good
      const goodX = xScale(item.satisfactory);
      const goodW = Math.max(0, xScale(item.good) - goodX);
      const goodRect = rowGroup.append('rect')
        .attr('class', 'bullet-range bullet-range-good')
        .attr('x', goodX)
        .attr('y', 0)
        .attr('width', goodW)
        .attr('height', barHeight)
        .attr('fill', withOpacity(goodColor, rangeOpacity));

      // Round right corners on the last range rect
      goodRect.attr('rx', barCornerRadius).attr('ry', barCornerRadius);

      // ── Actual value bar ────────────────────────────────────────
      const valueBarHeight = barHeight * 0.4;
      const valueBarY = (barHeight - valueBarHeight) / 2;
      const valueBarX = xScale(0);
      const valueBarW = Math.max(0, xScale(item.value) - valueBarX);

      const valueRect = rowGroup.append('rect')
        .attr('class', 'bullet-value-bar')
        .attr('data-selection-key', item.selectionId.getKey())
        .attr('x', valueBarX)
        .attr('y', valueBarY)
        .attr('width', valueBarW)
        .attr('height', valueBarHeight)
        .attr('fill', barColor)
        .attr('rx', barCornerRadius)
        .attr('ry', barCornerRadius);

      // Tooltip on value bar
      this.attachTooltip(valueRect, item);
      valueRect
        .style('cursor', allowInteractions(this.host) ? 'pointer' : 'default')
        .on('click', (event: MouseEvent) => {
          if (!allowInteractions(this.host)) return;
          event.stopPropagation();
          const selectionPromise = this.selectionManager.select(
            item.selectionId,
            event.ctrlKey || event.metaKey,
          );
          this.applySelectionHighlight();
          void selectionPromise.then(() => this.applySelectionHighlight());
        })
        .on('contextmenu', (event: MouseEvent) => {
          if (!allowInteractions(this.host)) return;
          event.preventDefault();
          event.stopPropagation();
          void this.selectionManager.showContextMenu(item.selectionId, {
            x: event.clientX,
            y: event.clientY,
          });
        });

      // Animate value bar with growBar (horizontal slide-in)
      if (animEnabled) {
        const valueNode = valueRect.node();
        if (valueNode) {
          const delay = rowIdx * DURATION.stagger;
          const cancel = growBar(valueNode, delay, animDuration, 'horizontal');
          this.cancelAnimations.push(cancel);
        }
      }

      // ── Target marker ───────────────────────────────────────────
      if (showTarget && item.target !== null) {
        const targetX = xScale(item.target);
        const markerGroup = rowGroup.append('g')
          .attr('class', 'bullet-target-group');

        markerGroup.append('line')
          .attr('class', 'bullet-target')
          .attr('x1', targetX)
          .attr('x2', targetX)
          .attr('y1', 0)
          .attr('y2', barHeight)
          .attr('stroke', barColor)
          .attr('stroke-width', targetMarkerWidth);

        // Animate target marker with fadeSlideIn
        if (animEnabled) {
          const markerNode = markerGroup.node();
          if (markerNode) {
            const delay = rowIdx * DURATION.stagger + 200;
            const cancel = fadeSlideIn(
              markerNode as unknown as HTMLElement,
              'left',
              300,
              delay,
            );
            this.cancelAnimations.push(cancel);
          }
        }
      }

      // ── Forecast marker + band ──────────────────────────────────
      if (showForecast && forecastValue > 0) {
        const fcX = xScale(forecastValue);
        const bandHalf = forecastBandWidth / 2;
        // Band rectangle
        rowGroup.append('rect')
          .attr('class', 'bullet-forecast-band')
          .attr('x', fcX - bandHalf)
          .attr('y', 0)
          .attr('width', forecastBandWidth)
          .attr('height', barHeight)
          .attr('fill', withOpacity(forecastColor, 0.2))
          .style('pointer-events', 'none');
        // Forecast line
        rowGroup.append('line')
          .attr('class', 'bullet-forecast')
          .attr('x1', fcX)
          .attr('x2', fcX)
          .attr('y1', 0)
          .attr('y2', barHeight)
          .attr('stroke', forecastColor)
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', '4,3');
      }

      // ── Conditional color override ───────────────────────────────
      const conditionalOverride = this.resolveConditionalBarColor(item.value);
      if (conditionalOverride) {
        valueRect.attr('fill', conditionalOverride);
      }

      // ── Value label (right) ─────────────────────────────────────
      if (showLabels) {
        rowGroup.append('text')
          .attr('class', 'bullet-value-label')
          .attr('x', chartRight + labelPadding)
          .attr('y', barHeight / 2)
          .attr('dy', '0.35em')
          .attr('text-anchor', 'start')
          .text(formatWithSettings(item.value, this.settings.numberFormattingCard));
      }
    });

    // Apply shared formatting settings
    applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.bullet-value-label');

    // Apply axis formatting to category labels
    const axisSettings = this.settings.axisFormattingCard;
    const axisLabelColor = axisSettings.axisLabelColor.value?.value || '#64748B';
    const axisLabelSize = axisSettings.axisLabelSize.value;
    const axisLabelFontFamily = resolveDropdown(axisSettings.axisLabelFontFamily);
    const axisLabelFontWeight = resolveDropdown(axisSettings.axisLabelFontWeight) ?? 'normal';
    const labelEls = this.container.querySelectorAll<SVGTextElement>('.bullet-label');
    for (const el of labelEls) {
      el.style.setProperty('fill', axisLabelColor);
      el.style.setProperty('font-size', `${axisLabelSize}px`);
      el.style.setProperty('font-weight', axisLabelFontWeight);
      if (axisLabelFontFamily) {
        el.style.setProperty('font-family', axisLabelFontFamily);
      }
    }

    // d3 selection for the SVG root group (shared overlay helpers)
    const svgGroup = svg.append('g').attr('class', 'bullet-overlays');
    const allValues = data.items.map((d) => d.value);

    // Build a yScale for reference/trend overlays: maps data values → vertical pixel positions
    const yScale = d3.scaleLinear().domain([0, globalMax]).range([svgHeight, 0]);

    // Reference line
    this.renderReferenceLine(svgGroup, yScale, svgWidth, allValues);

    // Trend line
    this.renderTrendLineOverlay(
      svgGroup,
      allValues,
      (idx: number) => {
        const item = data.items[idx];
        return item ? xScale(item.value) : 0;
      },
      yScale,
    );

    // Annotations
    this.renderAnnotationOverlay(svgGroup, (category: string) => {
      const idx = data.items.findIndex((d) => d.label === category);
      if (idx < 0) return null;
      const item = data.items[idx];
      const x = xScale(item.value);
      const y = idx * rowHeight + barHeight / 2;
      return { x, y };
    });

    // Legend
    const legendCard = this.settings.legendFormattingCard;
    if (legendCard.showLegend.value) {
      const legendPos = resolveDropdown(legendCard.legendPosition) ?? 'bottom';
      const rawFontColor = legendCard.legendFontColor.value?.value;
      const legendItems: LegendItem[] = [
        { label: 'Poor', color: poorColor },
        { label: 'Satisfactory', color: satColor },
        { label: 'Good', color: goodColor },
      ];
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

    // Accessibility
    this.applyAccessibility(data);
  }

  // ── Tooltip ───────────────────────────────────────────────────────

  private attachTooltip(
    rect: d3.Selection<SVGRectElement, unknown, null, undefined>,
    item: BulletItem,
  ): void {
    const host = this.host;

    rect.on('mouseover', (event: MouseEvent) => {
      const tooltipData: VisualTooltipDataItem[] = [
        { displayName: 'Category', value: item.label },
        { displayName: 'Value', value: formatWithSettings(item.value, this.settings.numberFormattingCard) },
      ];

      if (item.target !== null) {
        tooltipData.push({
          displayName: 'Target',
          value: formatWithSettings(item.target, this.settings.numberFormattingCard),
        });
      }

      tooltipData.push(
        { displayName: 'Poor', value: formatWithSettings(item.poor, this.settings.numberFormattingCard) },
        { displayName: 'Satisfactory', value: formatWithSettings(item.satisfactory, this.settings.numberFormattingCard) },
        { displayName: 'Good', value: formatWithSettings(item.good, this.settings.numberFormattingCard) },
      );

      host.tooltipService.show({
        dataItems: tooltipData,
        identities: [item.selectionId],
        coordinates: [event.clientX, event.clientY],
        isTouchEvent: false,
      });
    });

    rect.on('mousemove', (event: MouseEvent) => {
      host.tooltipService.move({
        dataItems: [],
        identities: [item.selectionId],
        coordinates: [event.clientX, event.clientY],
        isTouchEvent: false,
      });
    });

    rect.on('mouseout', () => {
      host.tooltipService.hide({ immediately: true, isTouchEvent: false });
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────

  /**
   * Truncates a label to fit within the specified pixel width.
   * Approximates at ~6.5px per character for 11px Segoe UI.
   */
  private truncateLabel(text: string, maxWidth: number): string {
    const charWidth = 6.5;
    const maxChars = Math.max(2, Math.floor(maxWidth / charWidth));
    if (text.length <= maxChars) return text;
    return text.substring(0, maxChars - 1) + '\u2026';
  }

  private handleBackgroundClick = (): void => {
    if (!allowInteractions(this.host)) return;
    const clearPromise = this.selectionManager.clear();
    this.applySelectionHighlight();
    void clearPromise.then(() => this.applySelectionHighlight());
  };

  // ── Selection & Cross-Highlight ─────────────────────────────────

  private applySelectionHighlight(): void {
    const hasSelection = this.selectionManager.hasSelection();
    const selectedIds = this.selectionManager.getSelectionIds() as ISelectionId[];
    const selectedKeys = new Set(selectedIds.map((id) => id.getKey()));

    const data = this.currentData;
    const hasHighlights = data?.hasHighlights ?? false;
    const highlightedKeys = new Set<string>();
    if (hasHighlights && data) {
      for (const item of data.items) {
        if (item.highlighted) {
          highlightedKeys.add(item.selectionId.getKey());
        }
      }
    }

    const bars = this.container.querySelectorAll<SVGRectElement>('.bullet-value-bar');
    const shouldDim = hasSelection || hasHighlights;

    for (const el of bars) {
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

  // ── Conditional Formatting ────────────────────────────────────────

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

  // ── Reference Line ──────────────────────────────────────────────

  private renderReferenceLine(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    yScale: d3.ScaleLinear<number, number>,
    chartWidth: number,
    allValues: number[],
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

    renderHorizontalReferenceLine(g, {
      value: refValue,
      yScale,
      chartWidth,
      lineColor: refColor,
      lineWidth: ref.referenceLineWidth.value,
      lineStyle: refStyle as 'solid' | 'dashed' | 'dotted',
      showLabel: ref.showReferenceLabel.value,
      labelText,
      showBand: ref.showReferenceBand.value,
      bandUpperValue: refValue * 1.1,
      bandOpacity: ref.referenceBandOpacity.value / 100,
    });
  }

  // ── Trend Line ──────────────────────────────────────────────────

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

  // ── Annotations ─────────────────────────────────────────────────

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

  // ── Accessibility ───────────────────────────────────────────────

  private applyAccessibility(data: BulletData): void {
    const acc = this.settings.accessibilityFormattingCard;
    if (!acc.enableKeyboardNav.value) {
      this.container.removeAttribute('role');
      this.container.removeAttribute('aria-label');
      return;
    }

    ensureFocusRingStyles();

    applyChartAria(this.container, {
      chartType: 'bullet chart',
      title: this.settings.titleFormattingCard.titleText.value || undefined,
      dataPointCount: data.items.length,
    });

    const bars = Array.from(this.container.querySelectorAll<SVGRectElement>('.bullet-value-bar'));
    bars.forEach((bar, index) => {
      const item = data.items[index];
      if (!item) return;
      const target = item.target === null
        ? ''
        : `, target ${formatWithSettings(item.target, this.settings.numberFormattingCard)}`;
      bar.setAttribute('role', 'listitem');
      bar.setAttribute('tabindex', '0');
      bar.setAttribute(
        'aria-label',
        `${item.label}: ${formatWithSettings(item.value, this.settings.numberFormattingCard)}${target}. Item ${index + 1} of ${data.items.length}.`,
      );
    });

    const cleanup = attachKeyboardNav({
      container: this.container,
      itemSelector: '.bullet-value-bar[tabindex="0"]',
      onActivate: (el) => {
        if (!allowInteractions(this.host)) return;
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      },
    });
    this.cancelAnimations.push(cleanup);
  }

  // ── Formatting Model ──────────────────────────────────────────────

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  // ── Cleanup ───────────────────────────────────────────────────────

  public destroy(): void {
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.detachEmptySpaceContextMenu?.();
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
  }
}
