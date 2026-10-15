/**
 * Dumbbell Chart — Power BI IVisual implementation.
 * Horizontal chart showing two dots connected by a line per category
 * (start vs end comparison) with glassmorphic styling and staggered animations.
 */

import powerbi from 'powerbi-visuals-api';
import * as d3 from 'd3';
import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel';
import { DumbbellChartSettings } from './settings';
import {
  popIn,
  drawPath,
  fadeSlideIn,
  animate,
  cubicOut,
  DURATION,
  formatNumber,
  formatWithSettings,
  getDeltaColor,
  applyCardStyle,
  type CardStyleMode,
  withOpacity,
  renderChartTitle,
  applyAxisFormatting,
  applyGridFormatting,
  applyDataLabelFormatting,
  createScrollableChart,
  applySortOrder,
  renderLegend,
  renderVerticalReferenceLine,
  attachEmptySpaceContextMenu,
  resolveDropdown,
  allowInteractions,
  notifyRenderingStarted,
  notifyRenderingFinished,
  notifyRenderingFailed,
  renderLandingPage,
  getHostHighContrastColors,
  applyBasicHighContrastStyles,
  getHostChartColor,
  resolveColorTheme,
  buildConditionalConfig,
  resolveConditionalColor,
  applyChartAria,
  attachKeyboardNav,
  ensureFocusRingStyles,
  syncTitleFormattingVisibility,
  syncLegendFormattingVisibility,
  syncCardStyleVisibility,
  syncDateFilterFormattingVisibility,
  hideInlineLegendFormatting,
  computeStatValue,
  type StatType,
  renderTrendLine,
  computeRegression,
  type TrendType,
  type LegendItem,
  type VerticalReferenceLineConfig,
  resolveSeriesFormatting,
  SeriesFormattingGroup,
  lineStyleToDashArray,
  getDateFilterIndices,
  isDateColumn,
  type DateFilterConfig,
  getLocalizedString,
  getVisualEmptyStateMode,
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

// -- Types --------------------------------------------------------------------

interface DumbbellRow {
  key: string;
  sourceIndex: number;
  label: string;
  start: number;
  end: number;
  selectionId: ISelectionId;
  highlighted: boolean;
}

interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

// -- Constants ----------------------------------------------------------------

const MARGIN_DEFAULT: Margin = { top: 20, right: 30, bottom: 40, left: 100 };
const LEGEND_HEIGHT = 28;
const STAGGER_DELAY = DURATION.stagger;

// -- Visual -------------------------------------------------------------------

export class DumbbellChartVisual implements IVisual {
  private host: IVisualHost;
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private container: HTMLElement;
  private settings: DumbbellChartSettings;
  private formattingSettingsService: FormattingSettingsService;
  private cancelAnimations: Array<() => void> = [];
  private emptyStateMode: 'unconfigured' | 'noData' = 'unconfigured';
  private currentRows: DumbbellRow[] = [];
  private hasHighlights = false;
  private removeEmptySpaceContextMenu: (() => void) | null = null;

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new DumbbellChartSettings();
    this.formattingSettingsService = new FormattingSettingsService(options.host.createLocalizationManager());
    this.container.classList.add('dumbbell-container');
    this.removeEmptySpaceContextMenu = attachEmptySpaceContextMenu(
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
          DumbbellChartSettings,
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
      hideInlineLegendFormatting(this.settings.legendFormattingCard);
      syncDateFilterFormattingVisibility(this.settings.dateFilterFormattingCard);
      syncCardStyleVisibility(this.settings.cardSettings);
      const cardMode = (resolveDropdown(this.settings.cardSettings.cardStyleMode) ?? 'glass') as CardStyleMode;
      this.settings.cardSettings.borderRadius.visible = cardMode !== 'none';

      this.settings.axisFormattingCard.yAxisMin.visible = false;
      this.settings.axisFormattingCard.yAxisMax.visible = false;
      this.settings.axisFormattingCard.axisLabelRotation.visible = false;
      this.settings.axisFormattingCard.xAxisTitle.visible = false;
      this.settings.axisFormattingCard.yAxisTitle.visible = false;
      this.settings.axisFormattingCard.axisLineColor.visible = false;
      this.settings.axisFormattingCard.axisLineWidth.visible = false;

      // Hide dual-axis-only properties (no combo/dual-axis support)
      this.settings.referenceLineFormattingCard.referenceLineAxis.visible = false;
      this.settings.referenceLineFormattingCard.referenceBandWidth.visible = false;
      this.settings.trendLineFormattingCard.trendLineAxis.visible = false;
      this.settings.axisFormattingCard.integerTicks.visible = false;

      // Conditional visibility: hide child settings when parent toggle is off
      // Display: hide autoDirectionalColor when showArrow is false
      this.settings.dumbbellConnectorSettings.autoDirectionalColor.visible = this.settings.dumbbellConnectorSettings.showArrow.value;
      // Display: hide separator settings when grouping is disabled
      const groupingOn = this.settings.dumbbellDisplaySettings.enableGrouping.value;
      this.settings.dumbbellDisplaySettings.separatorColor.visible = groupingOn;
      this.settings.dumbbellDisplaySettings.separatorWidth.visible = groupingOn;
      // Delta labels: hide sub-settings when show is false
      const deltaShow = this.settings.deltaLabelSettings.show.value;
      this.settings.deltaLabelSettings.fontSize.visible = deltaShow;
      this.settings.deltaLabelSettings.fontColor.visible = deltaShow;
      this.settings.deltaLabelSettings.fontFamily.visible = deltaShow;
      this.settings.deltaLabelSettings.fontWeight.visible = deltaShow;
      this.settings.deltaLabelSettings.format.visible = deltaShow;
      this.settings.deltaLabelSettings.position.visible = deltaShow;

      const dataLabelsOn = this.settings.dataLabelFormattingCard.showDataLabels.value;
      this.settings.dataLabelFormattingCard.dataLabelFontSize.visible = dataLabelsOn;
      this.settings.dataLabelFormattingCard.dataLabelFontColor.visible = dataLabelsOn;
      this.settings.dataLabelFormattingCard.dataLabelFontFamily.visible = dataLabelsOn;
      this.settings.dataLabelFormattingCard.dataLabelFontWeight.visible = dataLabelsOn;
      this.settings.dataLabelFormattingCard.dataLabelPosition.visible = dataLabelsOn;

      const showRef = this.settings.referenceLineFormattingCard.showReferenceLine.value;
      const refType = resolveDropdown(this.settings.referenceLineFormattingCard.referenceLineType) ?? 'custom';
      this.settings.referenceLineFormattingCard.referenceLineType.visible = showRef;
      this.settings.referenceLineFormattingCard.referenceLineValue.visible = showRef && refType === 'custom';
      this.settings.referenceLineFormattingCard.referenceLineColor.visible = showRef;
      this.settings.referenceLineFormattingCard.referenceLineWidth.visible = showRef;
      this.settings.referenceLineFormattingCard.referenceLineStyle.visible = showRef;
      this.settings.referenceLineFormattingCard.showReferenceLabel.visible = showRef;
      this.settings.referenceLineFormattingCard.referenceLabelText.visible = showRef && this.settings.referenceLineFormattingCard.showReferenceLabel.value;
      this.settings.referenceLineFormattingCard.showReferenceBand.visible = false;
      this.settings.referenceLineFormattingCard.referenceBandOpacity.visible = false;

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
      this.settings.animationSettings.duration.visible = this.settings.animationSettings.enabled.value;

      // Extract data and apply user-configured sort order (sort by end value)
      const rows = applySortOrder(
        this.extractData(dataView).map((d) => ({ ...d, name: d.label, value: d.end })),
        this.settings.sortFormattingCard,
      );

      // Populate per-series formatting groups from data
      this.populateCategoryFormattingGroups(dataView, rows);

      // Store rows for cross-highlight
      this.currentRows = rows;

      // Render
      if (rows.length === 0) {
        this.renderEmpty();
      } else {
        this.render(rows, options.viewport);
      }

      // Apply card styling AFTER render — render clears the container, which would destroy the glass backdrop div.
      this.applyCardStyle();

      // Apply cross-highlight dimming after render
      this.applySelectionHighlight();

      applyBasicHighContrastStyles(this.container, getHostHighContrastColors(this.host), {
        textSelectors: [
          '.dumbbell-axis text',
          '.dumbbell-data-label',
          '.dumbbell-delta-label',
          '.dumbbell-group-header',
          '.dumbbell-ranking',
          '.dumbbell-empty',
          '.pbi-landing-page-title',
          '.pbi-landing-page-description',
          '.pbi-landing-page-hint',
        ],
        lineSelectors: [
          '.dumbbell-grid line',
          '.dumbbell-axis line',
          '.dumbbell-group-separator',
          '.dumbbell-line',
          '.dumbbell-arrow',
        ],
        fillSelectors: [
          '.dumbbell-dot',
          '.dumbbell-empty',
        ],
        strokeSelectors: [
          '.dumbbell-dot',
          '.dumbbell-line',
          '.dumbbell-arrow',
        ],
      });

      notifyRenderingFinished(this.host, options);
    } catch (error) {
      notifyRenderingFailed(this.host, options, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  // -- Data Extraction --------------------------------------------------------

  private extractData(dataView: DataView | undefined): DumbbellRow[] {
    if (!dataView?.categorical) return [];

    const categorical = dataView.categorical;
    const categoryColumn = categorical.categories?.[0];
    const valuesColumns = categorical.values;

    if (!categoryColumn || !valuesColumns || valuesColumns.length === 0) return [];

    // Find start and end value columns by role
    let startCol: powerbi.DataViewValueColumn | undefined;
    let endCol: powerbi.DataViewValueColumn | undefined;
    const numericColumns = valuesColumns.filter((col) =>
      col.values.some((v) => typeof v === 'number'),
    );

    for (const col of valuesColumns) {
      const role = col.source.roles;
      if (!role) continue;
      if (role['startValue']) startCol = col;
      if (role['endValue']) endCol = col;
    }

    if (!startCol || !endCol) {
      if (!startCol) startCol = numericColumns[0];
      if (!endCol) endCol = numericColumns[1];
    }
    if (!startCol || !endCol) return [];

    // Cross-highlight support: read highlights from value columns
    const startHlRaw = (startCol as unknown as { highlights?: unknown[] }).highlights as unknown[] | undefined;
    const endHlRaw = (endCol as unknown as { highlights?: unknown[] }).highlights as unknown[] | undefined;
    let anyHighlight = false;

    const rows: DumbbellRow[] = [];

    const dateConfig: DateFilterConfig = {
      enabled: this.settings.dateFilterFormattingCard.enableDateFilter.value,
      startDate: this.settings.dateFilterFormattingCard.startDate.value,
      endAtCurrentDate: this.settings.dateFilterFormattingCard.endAtCurrentDate.value,
      endDate: this.settings.dateFilterFormattingCard.endDate.value,
    };
    const dateIndices = isDateColumn(categoryColumn.source) ? getDateFilterIndices(categoryColumn.values, dateConfig) : null;

    for (let i = 0; i < categoryColumn.values.length; i++) {
      if (dateIndices && !dateIndices.has(i)) continue;

      const label = categoryColumn.values[i];
      const startVal = startCol.values[i];
      const endVal = endCol.values[i];

      if (
        label === null || label === undefined ||
        typeof startVal !== 'number' ||
        typeof endVal !== 'number'
      ) {
        continue;
      }

      const isHighlighted = (startHlRaw != null && startHlRaw[i] != null) ||
        (endHlRaw != null && endHlRaw[i] != null);
      if (isHighlighted) anyHighlight = true;

      rows.push({
        key: `${i}::${String(label)}`,
        sourceIndex: i,
        label: String(label),
        start: startVal,
        end: endVal,
        selectionId: this.host.createSelectionIdBuilder()
          .withCategory(categoryColumn, i)
          .createSelectionId(),
        highlighted: isHighlighted,
      });
    }

    this.hasHighlights = anyHighlight;
    return rows;
  }

  private populateCategoryFormattingGroups(dataView: DataView | undefined, rows: DumbbellRow[]): void {
    const categoryColumn = dataView?.categorical?.categories?.find((column) => column.source.roles?.['category']);
    const baseLineWidth = Math.max(0, this.settings.dumbbellConnectorSettings.lineWidth.value);

    this.settings.seriesFormattingCard.groups = rows.map((row, index) => {
      const group = new SeriesFormattingGroup({
        name: `category_${index}`,
        displayName: row.label,
      });
      group.lineWidth.value = baseLineWidth;

      const selector = (row.selectionId as ISelectionId & { getSelector?: () => unknown }).getSelector?.();
      for (const slice of group.slices) {
        slice.selector = selector;
      }

      const objects = categoryColumn?.objects?.[row.sourceIndex]?.['seriesFormatting'];
      if (objects) {
        const color = objects['seriesColor'] as { solid?: { color?: string } } | undefined;
        if (color?.solid?.color) group.seriesColor.value = { value: color.solid.color };
        if (typeof objects['seriesOpacity'] === 'number') group.seriesOpacity.value = objects['seriesOpacity'];
        if (typeof objects['showDataLabels'] === 'boolean') group.showDataLabels.value = objects['showDataLabels'];
        const lineStyle = objects['lineStyle'];
        const lineStyleValue = typeof lineStyle === 'string'
          ? lineStyle
          : (lineStyle as { value?: string } | undefined)?.value;
        if (lineStyleValue) group.lineStyle.value = { value: lineStyleValue, displayName: lineStyleValue };
        if (typeof objects['lineWidth'] === 'number') group.lineWidth.value = objects['lineWidth'];
      }

      return group;
    });
  }

  // -- Card Style -------------------------------------------------------------

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

  // -- Empty State ------------------------------------------------------------

  private renderEmpty(): void {
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    const colors = getHostHighContrastColors(this.host);
    if (this.emptyStateMode === 'noData') {
      renderNoDataState(
        this.container,
        getLocalizedString(this.host, 'DumbbellChart_NoDataState', 'No data for the current selection.'),
        colors,
      );
      return;
    }
    renderLandingPage(this.container, {
      title: getLocalizedString(this.host, 'DumbbellChart_LandingTitle', 'No data to display'),
      description: getLocalizedString(this.host, 'DumbbellChart_LandingDescription', 'Add a category plus Start Value and End Value fields to build the dumbbell comparison.'),
      steps: [
        getLocalizedString(this.host, 'DumbbellChart_LandingStepCategory', 'Bind one category field to define each row.'),
        getLocalizedString(this.host, 'DumbbellChart_LandingStepMeasures', 'Bind two numeric measures for Start Value and End Value.'),
      ],
      hint: getLocalizedString(this.host, 'DumbbellChart_LandingHint', 'Once data is present, the chart will support selection, drill-through context menus, and sorting where applicable.'),
    }, colors);
  }

  // -- Main Render ------------------------------------------------------------

  private render(rows: DumbbellRow[], viewport: powerbi.IViewport): void {
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    renderChartTitle(this.container, this.settings.titleFormattingCard);
    this.container.removeEventListener('click', this.handleBackgroundClick);

    const s = this.settings;
    const margin = { ...MARGIN_DEFAULT };

    if (!s.axisFormattingCard.showXAxis.value) margin.bottom = 8;
    if (!s.axisFormattingCard.showYAxis.value) margin.left = 8;

    // Legend
    const showLegend = s.legendFormattingCard.showLegend.value;
    const legendPosRaw = s.legendFormattingCard.legendPosition.value;
    const legendPos = (typeof legendPosRaw === 'string'
      ? legendPosRaw
      : (legendPosRaw as { value?: string })?.value) ?? 'bottom';
    const isLegendVertical = legendPos === 'left' || legendPos === 'right';
    const legendReserve = showLegend && !isLegendVertical ? LEGEND_HEIGHT : 0;
    const containerPadding = Math.max(0, s.layoutSettings.containerPadding.value + s.cardSettings.contentPadding.value);
    const categoryPaddingInner = Math.max(0, Math.min(0.95, s.layoutSettings.categoryPaddingInner.value));
    const categoryPaddingOuter = Math.max(0, Math.min(0.95, s.layoutSettings.categoryPaddingOuter.value));
    this.container.style.padding = `${containerPadding}px`;

    // Adjust margin for left/right legend positioning
    if (showLegend && legendPos === 'left') margin.left += 80;
    if (showLegend && legendPos === 'right') margin.right += 80;

    // Compute chart dimensions
    const baseSvgWidth = viewport.width - containerPadding * 2;
    const baseSvgHeight = viewport.height - containerPadding * 2 - legendReserve;
    const baseChartWidth = Math.max(0, baseSvgWidth - margin.left - margin.right);
    const baseChartHeight = Math.max(0, baseSvgHeight - margin.top - margin.bottom);

    if (baseChartWidth <= 0 || baseChartHeight <= 0) {
      this.renderEmpty();
      return;
    }

    // Scroll support (vertical — categories on Y-axis)
    const scroll = createScrollableChart({
      container: this.container,
      viewportWidth: baseSvgWidth,
      viewportHeight: baseSvgHeight,
      categoryCount: rows.length,
      scrollSettings: s.scrollFormattingCard,
      availableChartWidth: baseChartWidth,
      availableChartHeight: baseChartHeight,
      direction: 'vertical',
    });
    const svgWidth = scroll.svgWidth;
    const svgHeight = scroll.svgHeight;
    const chartWidth = scroll.chartWidth;
    const chartHeight = scroll.chartHeight;

    // Settings values
    const dotRadius = s.dumbbellSettings.dotRadius.value;
    const lineWidth = s.dumbbellConnectorSettings.lineWidth.value;
    const themeName = resolveColorTheme(s.colorThemeFormattingCard);
    const userStartColor = s.dumbbellSettings.startColor.value?.value;
    const userEndColor = s.dumbbellSettings.endColor.value?.value;
    const startColor = (userStartColor && userStartColor.length > 0) ? userStartColor : getHostChartColor(this.host.colorPalette, 0, themeName);
    const endColor = (userEndColor && userEndColor.length > 0) ? userEndColor : getHostChartColor(this.host.colorPalette, 1, themeName);
    const animEnabled = s.animationSettings.enabled.value;
    const animDuration = s.animationSettings.duration.value;

    // Legend (top)
    if (showLegend && legendPos === 'top') {
      this.renderSharedLegend(startColor, endColor);
    }

    // SVG
    const svg = d3.select(scroll.svgParent)
      .append('svg')
      .attr('class', 'dumbbell-svg')
      .attr('width', svgWidth)
      .attr('height', svgHeight);

    const chartGroup = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Data labels
    const showDataLabels = s.dataLabelFormattingCard.showDataLabels.value;

    // Delta label settings
    const showDeltaLabels = s.deltaLabelSettings.show.value;
    const deltaFontSize = s.deltaLabelSettings.fontSize.value;
    const deltaFontColorRaw = s.deltaLabelSettings.fontColor.value?.value;
    const deltaFontColor = deltaFontColorRaw && deltaFontColorRaw.length > 0 ? deltaFontColorRaw : '';
    const deltaFontFamily = resolveDropdown(s.deltaLabelSettings.fontFamily) || '';
    const deltaFontWeight = resolveDropdown(s.deltaLabelSettings.fontWeight) || 'normal';
    const deltaFormatRaw = s.deltaLabelSettings.format.value;
    const deltaFormat = (typeof deltaFormatRaw === 'string'
      ? deltaFormatRaw
      : (deltaFormatRaw as { value?: string })?.value) ?? 'absolute';
    const deltaPositionRaw = s.deltaLabelSettings.position.value;
    const deltaPosition = (typeof deltaPositionRaw === 'string'
      ? deltaPositionRaw
      : (deltaPositionRaw as { value?: string })?.value) ?? 'above';

    // Dumbbell-specific settings — apply if set, otherwise use fallback
    const lineColorValue = s.dumbbellConnectorSettings.lineColor.value?.value;
    const resolvedLineColor = lineColorValue && lineColorValue.length > 0 ? lineColorValue : withOpacity(endColor, 0.35);
    const dotStrokeColorValue = s.dumbbellSettings.dotStrokeColor.value?.value;
    const dotStrokeColor = dotStrokeColorValue && dotStrokeColorValue.length > 0 ? dotStrokeColorValue : '#FFFFFF';
    const dotStrokeWidth = s.dumbbellSettings.dotStrokeWidth.value;

    const labelByKey = new Map(rows.map((r) => [r.key, r.label]));

    // Y-axis: scaleBand for categories (rows)
    const yScale = d3.scaleBand()
      .domain(rows.map((r) => r.key))
      .range([0, chartHeight])
      .paddingInner(categoryPaddingInner)
      .paddingOuter(categoryPaddingOuter);

    // X-axis: scaleLinear from min to max of all values
    const allValues = rows.flatMap((r) => [r.start, r.end]);
    const dataMin = d3.min(allValues) ?? 0;
    const dataMax = d3.max(allValues) ?? 0;
    const valuePadding = (dataMax - dataMin) * 0.08 || 1;

    const xScale = d3.scaleLinear()
      .domain([dataMin - valuePadding, dataMax + valuePadding])
      .nice()
      .range([0, chartWidth]);

    // Grid lines (vertical)
    chartGroup.append('g')
      .attr('class', 'dumbbell-grid')
      .call(
        d3.axisBottom(xScale)
          .ticks(6)
          .tickSize(chartHeight)
          .tickFormat(() => ''),
      )
      .attr('transform', 'translate(0,0)');

    // Axes
    if (s.axisFormattingCard.showYAxis.value) {
      chartGroup.append('g')
        .attr('class', 'dumbbell-axis dumbbell-axis-y')
        .call(
          d3.axisLeft(yScale)
            .tickSize(0)
            .tickFormat((d) => labelByKey.get(String(d)) ?? String(d)),
        )
        .select('.domain').remove();
    }

    if (s.axisFormattingCard.showXAxis.value) {
      chartGroup.append('g')
        .attr('class', 'dumbbell-axis dumbbell-axis-x')
        .attr('transform', `translate(0,${chartHeight})`)
        .call(
          d3.axisBottom(xScale)
            .ticks(6)
            .tickFormat((d) => formatWithSettings(d as number, this.settings.numberFormattingCard)),
        )
        .select('.domain').remove();
    }

    // Render group sub-headers when grouping is enabled
    const enableGrouping = s.dumbbellDisplaySettings.enableGrouping.value;
    if (enableGrouping) {
      let lastGroup = '';
      rows.forEach((row) => {
        const groupKey = row.label.charAt(0).toUpperCase();
        if (groupKey !== lastGroup) {
          lastGroup = groupKey;
          const cy = (yScale(row.key) ?? 0) - 2;
          chartGroup.append('text')
            .attr('class', 'dumbbell-group-header')
            .attr('x', -8)
            .attr('y', cy)
            .attr('text-anchor', 'end')
            .attr('dominant-baseline', 'auto')
            .attr('font-size', `${s.axisFormattingCard.axisLabelSize.value}px`)
            .attr('font-weight', '700')
            .attr('fill', s.axisFormattingCard.axisLabelColor.value?.value || '#64748B')
            .attr('letter-spacing', '0.05em')
            .text(groupKey);

          // Draw a subtle separator line
          const sepColor = s.dumbbellDisplaySettings.separatorColor.value?.value || '#E2E8F0';
          const sepWidth = s.dumbbellDisplaySettings.separatorWidth.value;
          chartGroup.append('line')
            .attr('class', 'dumbbell-group-separator')
            .attr('x1', 0)
            .attr('y1', cy + 2)
            .attr('x2', chartWidth)
            .attr('y2', cy + 2)
            .attr('stroke', sepColor)
            .attr('stroke-width', sepWidth)
            .attr('stroke-dasharray', '3 2');
        }
      });
    }

    // Render dumbbell rows
    const bandMiddle = yScale.bandwidth() / 2;

    rows.forEach((row, rowIdx) => {
      const cy = (yScale(row.key) ?? 0) + bandMiddle;
      const x1 = xScale(row.start);
      const x2 = xScale(row.end);
      const delay = rowIdx * STAGGER_DELAY;
      const seriesIdx = String(rowIdx);

      // Conditional color based on gap/difference value
      const gapValue = row.end - row.start;
      const conditionalColor = this.getConditionalColor(gapValue);
      const fmt = resolveSeriesFormatting(this.settings.seriesFormattingCard, rowIdx, resolvedLineColor);
      const rowOpacity = Math.max(0, Math.min(100, fmt.opacity)) / 100;

      // Connecting line (rendered as SVG path for drawPath animation)
      const minX = Math.min(x1, x2);
      const maxX = Math.max(x1, x2);

      const pathEl = chartGroup.append('path')
        .attr('class', 'dumbbell-line')
        .attr('data-series', seriesIdx)
        .attr('data-selection-key', row.selectionId.getKey())
        .attr('d', `M${minX},${cy} L${maxX},${cy}`)
        .attr('stroke', conditionalColor ?? fmt.color)
        .attr('stroke-width', Math.max(0, fmt.lineWidth))
        .attr('stroke-dasharray', lineStyleToDashArray(fmt.lineStyle))
        .attr('fill', 'none')
        .attr('opacity', rowOpacity)
        .attr('data-base-opacity', String(rowOpacity))
        .style('transition', 'opacity 0.15s ease');
      pathEl.style('pointer-events', 'none');

      const lineHitArea = chartGroup.append('path')
        .attr('class', 'dumbbell-line-hit-area')
        .attr('data-series', seriesIdx)
        .attr('data-base-opacity', '1')
        .attr('d', `M${minX},${cy} L${maxX},${cy}`)
        .attr('stroke', 'transparent')
        .attr('stroke-width', Math.max(fmt.lineWidth, lineWidth, 14))
        .attr('stroke-linecap', 'round')
        .attr('fill', 'none')
        .style('cursor', allowInteractions(this.host) ? 'pointer' : 'default');
      this.attachSelection(lineHitArea, row.selectionId);

      if (animEnabled) {
        const pathNode = pathEl.node();
        if (pathNode) {
          const cancelDraw = drawPath(pathNode, animDuration, delay);
          this.cancelAnimations.push(cancelDraw);

          // Fade in the line opacity alongside the draw animation
          pathNode.style.opacity = '0';
          const cancelFade = animate(animDuration, cubicOut, (progress) => {
            pathNode.style.opacity = `${progress * rowOpacity}`;
          });
          this.cancelAnimations.push(cancelFade);
        }
      }

      // Start dot
      const startFmt = resolveSeriesFormatting(this.settings.seriesFormattingCard, rowIdx, startColor);
      const startDot = chartGroup.append('circle')
        .attr('class', 'dumbbell-dot dumbbell-dot-start')
        .attr('data-series', seriesIdx)
        .attr('data-selection-key', row.selectionId.getKey())
        .attr('cx', x1)
        .attr('cy', cy)
        .attr('r', dotRadius)
        .attr('fill', conditionalColor ?? startFmt.color)
        .attr('stroke', dotStrokeColor)
        .attr('stroke-width', dotStrokeWidth)
        .attr('opacity', startFmt.opacity / 100)
        .attr('data-base-opacity', String(startFmt.opacity / 100))
        .style('transition', 'opacity 0.15s ease');
      this.attachSelection(startDot, row.selectionId);

      this.attachDotTooltip(startDot, row.label, 'Start', row.start, row.selectionId);

      // End dot
      const endFmt = resolveSeriesFormatting(this.settings.seriesFormattingCard, rowIdx, endColor);
      const endDot = chartGroup.append('circle')
        .attr('class', 'dumbbell-dot dumbbell-dot-end')
        .attr('data-series', seriesIdx)
        .attr('data-selection-key', row.selectionId.getKey())
        .attr('cx', x2)
        .attr('cy', cy)
        .attr('r', dotRadius)
        .attr('fill', conditionalColor ?? endFmt.color)
        .attr('stroke', dotStrokeColor)
        .attr('stroke-width', dotStrokeWidth)
        .attr('opacity', endFmt.opacity / 100)
        .attr('data-base-opacity', String(endFmt.opacity / 100))
        .style('transition', 'opacity 0.15s ease');
      this.attachSelection(endDot, row.selectionId);

      this.attachDotTooltip(endDot, row.label, 'End', row.end, row.selectionId);

      // Data labels
      if (showDataLabels && fmt.showLabels) {
        const labelOffset = dotRadius + 4;

        chartGroup.append('text')
          .attr('class', 'dumbbell-data-label')
          .attr('data-series', seriesIdx)
          .attr('x', x1)
          .attr('y', cy - labelOffset)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'auto')
          .style('transition', 'opacity 0.15s ease')
          .text(formatWithSettings(row.start, this.settings.numberFormattingCard));

        chartGroup.append('text')
          .attr('class', 'dumbbell-data-label')
          .attr('data-series', seriesIdx)
          .attr('x', x2)
          .attr('y', cy - labelOffset)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'auto')
          .style('transition', 'opacity 0.15s ease')
          .text(formatWithSettings(row.end, this.settings.numberFormattingCard));
      }

      // Delta labels
      if (showDeltaLabels) {
        const delta = row.end - row.start;
        const centerX = (x1 + x2) / 2;

        // Build display text based on format setting
        const absPart = formatNumber(delta, { abbreviate: true, showSign: true });
        let displayText: string;

        if (row.start === 0) {
          // Edge case: start is zero — skip percentage, show absolute only
          displayText = absPart;
        } else {
          const pctChange = ((row.end - row.start) / Math.abs(row.start)) * 100;
          const pctPart = formatNumber(pctChange, {
            abbreviate: false,
            showSign: true,
            decimals: 1,
            suffix: '%',
          });

          switch (deltaFormat) {
            case 'percent':
              displayText = pctPart;
              break;
            case 'both':
              displayText = `${absPart} (${pctPart})`;
              break;
            default: // 'absolute'
              displayText = absPart;
              break;
          }
        }

        // Vertical offset based on position setting
        let deltaY: number;
        const deltaOffset = dotRadius + 6;
        switch (deltaPosition) {
          case 'below':
            deltaY = cy + deltaOffset + deltaFontSize;
            break;
          case 'center':
            deltaY = cy;
            break;
          default: // 'above'
            deltaY = cy - deltaOffset;
            break;
        }

        // Color: use user fontColor if set, otherwise green/red by sign
        const deltaColor = deltaFontColor.length > 0
          ? deltaFontColor
          : getDeltaColor(delta);

        const deltaLabel = chartGroup.append('text')
          .attr('class', 'dumbbell-delta-label')
          .attr('data-series', seriesIdx)
          .attr('x', centerX)
          .attr('y', deltaY)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', deltaPosition === 'center' ? 'central' : 'auto')
          .attr('font-size', `${deltaFontSize}px`)
          .attr('font-weight', deltaFontWeight)
          .attr('fill', deltaColor)
          .style('transition', 'opacity 0.15s ease');

        if (deltaFontFamily) {
          deltaLabel.attr('font-family', deltaFontFamily);
        }

        deltaLabel.text(displayText);
      }

      // Animate dots
      if (animEnabled) {
        const startNode = startDot.node();
        if (startNode) {
          const cancel = popIn(startNode, delay + animDuration * 0.3);
          this.cancelAnimations.push(cancel);
        }

        const endNode = endDot.node();
        if (endNode) {
          const cancel = popIn(endNode, delay + animDuration * 0.5);
          this.cancelAnimations.push(cancel);
        }
      }
    });

    // ── Series Hover Highlight/Dim ──────────────────────────────

    const svgNode = svg.node();
    if (svgNode) {
      const seriesElements = svgNode.querySelectorAll('[data-series]');
      seriesElements.forEach((el) => {
        el.addEventListener('mouseenter', () => {
          if (this.selectionManager.hasSelection() || this.hasHighlights) return;
          const seriesIdx = el.getAttribute('data-series');
          seriesElements.forEach((other) => {
            (other as SVGElement).style.opacity = other.getAttribute('data-series') === seriesIdx ? '1' : '0.2';
          });
        });
        el.addEventListener('mouseleave', () => {
          this.applySelectionHighlight();
        });
      });
    }

    // Apply axis and grid formatting from settings
    const svgEl = this.container.querySelector('svg');
    if (svgEl) {
      svgEl.querySelectorAll('[class*="dumbbell-axis"]').forEach((el) => {
        applyAxisFormatting(el as SVGGElement, this.settings.axisFormattingCard);
      });
      svgEl.querySelectorAll('[class*="dumbbell-grid"]').forEach((el) => {
        applyGridFormatting(el as SVGGElement, this.settings.axisFormattingCard);
      });
    }

    // Apply data label formatting from settings
    if (showDataLabels) {
      applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.dumbbell-data-label');
    }

    // Render ranking indicators if enabled
    this.renderRankingIndicators(rows, chartGroup, xScale, yScale, bandMiddle);

    // Render connector arrows if enabled
    this.renderConnectorArrows(rows, chartGroup, xScale, yScale, bandMiddle, endColor);

    // Render reference line if enabled (vertical — along X value axis)
    this.renderSharedReferenceLine(chartGroup, xScale, chartHeight, allValues);

    // Render trend line overlay
    const endValues = rows.map((r) => r.end);
    this.renderTrendLineOverlay(
      chartGroup,
      endValues,
      (i) => (yScale(rows[i]?.key ?? '') ?? 0) + bandMiddle,
      xScale,
    );

    // Legend (bottom)
    if (showLegend && legendPos !== 'top') {
      this.renderSharedLegend(startColor, endColor);
    }

    // Apply accessibility (ARIA labels, keyboard nav, focus ring)
    this.applyAccessibility(rows);

    this.container.addEventListener('click', this.handleBackgroundClick);

    // Animate the Y-axis labels with fadeSlideIn
    if (animEnabled && s.axisFormattingCard.showYAxis.value) {
      const yAxisTexts = this.container.querySelectorAll('.dumbbell-axis-y .tick text');
      yAxisTexts.forEach((textEl, idx) => {
        const cancel = fadeSlideIn(
          textEl as unknown as HTMLElement,
          'left',
          animDuration,
          idx * STAGGER_DELAY,
        );
        this.cancelAnimations.push(cancel);
      });
    }
  }

  // -- Tooltips ---------------------------------------------------------------

  private attachDotTooltip(
    circle: d3.Selection<SVGCircleElement, unknown, null, undefined>,
    category: string,
    seriesName: string,
    value: number,
    selectionId: ISelectionId,
  ): void {
    const host = this.host;

    circle.on('mouseover', (event: MouseEvent) => {
      const tooltipData: VisualTooltipDataItem[] = [
        { displayName: 'Category', value: category },
        { displayName: seriesName, value: formatWithSettings(value, this.settings.numberFormattingCard) },
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
        identities: [selectionId],
        coordinates: [event.clientX, event.clientY],
        isTouchEvent: false,
      });
    });

    circle.on('mouseout', () => {
      host.tooltipService.hide({ immediately: true, isTouchEvent: false });
    });
  }

  private attachSelection<E extends SVGElement>(
    node: d3.Selection<E, unknown, null, undefined>,
    selectionId: ISelectionId,
  ): void {
    node.attr('data-selection-key', selectionId.getKey());
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

  // -- Legend (shared) --------------------------------------------------------

  private renderSharedLegend(startColor: string, endColor: string): void {
    const legendFmtCard = this.settings.legendFormattingCard;
    const rawFontColor = legendFmtCard.legendFontColor.value?.value;
    const legendFontColor = rawFontColor != null && rawFontColor.length > 0 ? rawFontColor : '#1E293B';
    const legendFontSize = legendFmtCard.legendFontSize.value;
    const legendPosRaw = legendFmtCard.legendPosition.value;
    const legendPos = (typeof legendPosRaw === 'string'
      ? legendPosRaw
      : (legendPosRaw as { value?: string })?.value) ?? 'bottom';

    const items: LegendItem[] = [
      { label: 'Start', color: startColor },
      { label: 'End', color: endColor },
    ];

    const rawLegendFontFamily = resolveDropdown(legendFmtCard.legendFontFamily) || undefined;

    renderLegend(this.container, {
      items,
      position: legendPos as 'top' | 'bottom' | 'left' | 'right',
      fontSize: legendFontSize,
      fontColor: legendFontColor,
      fontFamily: rawLegendFontFamily,
      aliases: legendFmtCard.legendAliases.value,
    });
  }

  // -- Ranking Indicators ---------------------------------------------------

  private renderRankingIndicators(
    rows: DumbbellRow[],
    chartGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
    xScale: d3.ScaleLinear<number, number>,
    yScale: d3.ScaleBand<string>,
    bandMiddle: number,
  ): void {
    if (!this.settings.dumbbellDisplaySettings.showRanking.value) return;

    // Rank by gap size (descending)
    const ranked = rows.map((r, i) => ({ row: r, gap: Math.abs(r.end - r.start), idx: i }))
      .sort((a, b) => b.gap - a.gap);

    ranked.forEach((entry, rank) => {
      const row = entry.row;
      const cy = (yScale(row.key) ?? 0) + bandMiddle;
      const x2 = xScale(row.end);

      chartGroup.append('text')
        .attr('class', 'dumbbell-ranking')
        .attr('x', x2 + 16)
        .attr('y', cy)
        .attr('text-anchor', 'start')
        .attr('dominant-baseline', 'central')
        .attr('font-size', `${this.settings.axisFormattingCard.axisLabelSize.value}px`)
        .attr('fill', this.settings.axisFormattingCard.axisLabelColor.value?.value || '#94A3B8')
        .attr('font-weight', '600')
        .style('pointer-events', 'none')
        .text(`#${rank + 1}`);
    });
  }

  // -- Connector Arrows -----------------------------------------------------

  private renderConnectorArrows(
    rows: DumbbellRow[],
    chartGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
    xScale: d3.ScaleLinear<number, number>,
    yScale: d3.ScaleBand<string>,
    bandMiddle: number,
    defaultEndColor: string,
  ): void {
    if (!this.settings.dumbbellConnectorSettings.showArrow.value) return;

    const dotRadius = this.settings.dumbbellSettings.dotRadius.value;

    rows.forEach((row, rowIndex) => {
      const cy = (yScale(row.key) ?? 0) + bandMiddle;
      const x1 = xScale(row.start);
      const x2 = xScale(row.end);
      const direction = x2 > x1 ? 1 : -1;

      // Arrow tip at end dot edge
      const arrowX = x2 - direction * (dotRadius + 2);
      const arrowSize = 4;

      const arrowPath = `M${arrowX},${cy} L${arrowX - direction * arrowSize},${cy - arrowSize} L${arrowX - direction * arrowSize},${cy + arrowSize} Z`;

      const arrowColor = this.settings.dumbbellConnectorSettings.autoDirectionalColor.value
        ? getDeltaColor(row.end - row.start)
        : resolveSeriesFormatting(this.settings.seriesFormattingCard, rowIndex, defaultEndColor).color;

      chartGroup.append('path')
        .attr('class', 'dumbbell-arrow')
        .attr('d', arrowPath)
        .attr('fill', arrowColor)
        .style('pointer-events', 'none');
    });
  }

  // -- Reference Line (shared) ----------------------------------------------

  private renderSharedReferenceLine(
    chartGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
    xScale: d3.ScaleLinear<number, number>,
    chartHeight: number,
    allValues: number[],
  ): void {
    const ref = this.settings.referenceLineFormattingCard;
    if (!ref.showReferenceLine.value) return;

    // Determine the reference value — use stat computation when type is not 'custom'
    const refType = resolveDropdown(ref.referenceLineType) ?? 'custom';
    let refValue = ref.referenceLineValue.value;
    if (refType !== 'custom' && allValues.length > 0) {
      refValue = computeStatValue(allValues, refType as StatType);
    }

    const refColor = ref.referenceLineColor.value?.value ?? '#EF4444';
    const refStyleVal = resolveDropdown(ref.referenceLineStyle) ?? 'dashed';
    const xPos = xScale(refValue);

    if (!isFinite(xPos)) return;

    const config: VerticalReferenceLineConfig = {
      xPosition: xPos,
      yStart: 0,
      yEnd: chartHeight,
      lineColor: refColor,
      lineWidth: ref.referenceLineWidth.value,
      lineStyle: refStyleVal as 'solid' | 'dashed' | 'dotted',
      showLabel: ref.showReferenceLabel.value,
      labelText: ref.referenceLabelText.value.length > 0
        ? ref.referenceLabelText.value
        : formatWithSettings(refValue, this.settings.numberFormattingCard),
    };

    renderVerticalReferenceLine(chartGroup, config);
  }

  // -- Conditional Formatting ------------------------------------------------

  /**
   * Resolves a conditional color for a dumbbell row based on its gap/difference value.
   * Returns undefined when conditional formatting is disabled.
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

  // -- Accessibility --------------------------------------------------------

  /**
   * Applies ARIA labels, focus ring styles, and keyboard navigation to the chart.
   */
  private applyAccessibility(rows: DumbbellRow[]): void {
    const acc = this.settings.accessibilityFormattingCard;
    if (!acc.enableKeyboardNav.value) {
      this.container.removeAttribute('role');
      this.container.removeAttribute('aria-label');
      return;
    }

    ensureFocusRingStyles();

    applyChartAria(this.container, {
      chartType: 'dumbbell chart',
      title: this.settings.titleFormattingCard.titleText.value || undefined,
      dataPointCount: rows.length,
    });

    const hitAreas = Array.from(this.container.querySelectorAll<SVGPathElement>('.dumbbell-line-hit-area'));
    hitAreas.forEach((hitArea, index) => {
      const row = rows[index];
      if (!row) return;
      const delta = row.end - row.start;
      hitArea.setAttribute('role', 'listitem');
      hitArea.setAttribute('tabindex', '0');
      hitArea.setAttribute(
        'aria-label',
        `${row.label}: start ${formatWithSettings(row.start, this.settings.numberFormattingCard)}, end ${formatWithSettings(row.end, this.settings.numberFormattingCard)}, change ${formatWithSettings(delta, this.settings.numberFormattingCard)}. Item ${index + 1} of ${rows.length}.`,
      );
    });

    const cleanup = attachKeyboardNav({
      container: this.container,
      itemSelector: '.dumbbell-line-hit-area[tabindex="0"]',
      onActivate: (el) => {
        if (!allowInteractions(this.host)) return;
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      },
    });
    this.cancelAnimations.push(cleanup);
  }


  // -- Trend Line ----------------------------------------------------------

  /**
   * Renders a regression trend line overlay on the chart.
   */
  private renderTrendLineOverlay(
    chartGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
    values: number[],
    xPositionFn: (index: number) => number,
    yScale: d3.ScaleLinear<number, number>,
  ): void {
    const tl = this.settings.trendLineFormattingCard;
    if (!tl.showTrendLine.value || values.length < 2) return;

    const trendType = (resolveDropdown(tl.trendLineType) ?? 'linear') as TrendType;
    const result = computeRegression(values, trendType, tl.polynomialOrder.value);
    const trendColor = tl.trendLineColor.value?.value ?? '#6366F1';

    renderTrendLine(chartGroup, {
      predicted: result.predicted,
      xScale: xPositionFn,
      yScale,
      lineColor: trendColor,
      lineWidth: tl.trendLineWidth.value,
      showEquation: tl.showEquation.value,
      showR2: tl.showR2.value,
      equation: result.equation,
      r2: result.r2,
    });
  }

  // -- Formatting Model -------------------------------------------------------

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  // -- Selection & Cross-Highlight --------------------------------------------

  private applySelectionHighlight(): void {
    const hasSelection = this.selectionManager.hasSelection();
    const selectedIds = this.selectionManager.getSelectionIds() as ISelectionId[];
    const selectedKeys = new Set(selectedIds.map((id) => id.getKey()));

    // Build set of highlighted keys from cross-highlight data
    const highlightedKeys = new Set<string>();
    if (this.hasHighlights) {
      for (const row of this.currentRows) {
        if (row.highlighted) {
          highlightedKeys.add(row.selectionId.getKey());
        }
      }
    }

    const shouldDim = hasSelection || this.hasHighlights;
    const allElements = this.container.querySelectorAll<SVGElement>('[data-series]');
    for (const el of allElements) {
      if (shouldDim) {
        const seriesIndex = Number(el.getAttribute('data-series'));
        const row = Number.isInteger(seriesIndex) ? this.currentRows[seriesIndex] : undefined;
        const rowKey = row?.selectionId.getKey();
        const isSelected = hasSelection && rowKey !== undefined && selectedKeys.has(rowKey);
        const isHighlighted = this.hasHighlights && rowKey !== undefined && highlightedKeys.has(rowKey);
        el.style.opacity = (isSelected || isHighlighted) ? '' : '0.3';
      } else {
        el.style.opacity = '';
      }
    }
  }

  private handleBackgroundClick = (): void => {
    if (!allowInteractions(this.host)) return;
    const clearPromise = this.selectionManager.clear();
    this.applySelectionHighlight();
    void clearPromise.then(() => this.applySelectionHighlight());
  };

  // -- Cleanup ----------------------------------------------------------------

  public destroy(): void {
    this.removeEmptySpaceContextMenu?.();
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
  }
}
