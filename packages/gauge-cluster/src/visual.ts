/**
 * Gauge Cluster -- Power BI IVisual implementation.
 * Renders a grid of animated mini gauges with sweep arcs, count-up values,
 * and color zones. Glassmorphic container styling.
 */

import powerbi from 'powerbi-visuals-api';
import * as d3 from 'd3';
import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel';
import { GaugeClusterSettings } from './settings';
import {
  sweepArc,
  countUp,
  fadeSlideIn,
  formatNumber,
  formatWithSettings,
  applyCardStyle,
  type CardStyleMode,
  renderChartTitle,
  applyDataLabelFormatting,
  resolveConditionalColor,
  buildConditionalConfig,
  resolveDropdown,
  applyChartAria,
  applyDataPointAria,
  attachKeyboardNav,
  ensureFocusRingStyles,
  renderSparkline,
  renderLegend,
  type LegendItem,
  getDateFilterIndices,
  isDateColumn,
  type DateFilterConfig,
  resolveColorTheme,
  getHostChartColor,
  syncLegendFormattingVisibility,
  syncTitleFormattingVisibility,
  syncCardStyleVisibility,
  hideInlineLegendFormatting,
  attachEmptySpaceContextMenu,
  allowInteractions,
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

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataView = powerbi.DataView;
import ISelectionId = powerbi.visuals.ISelectionId;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

import '../style/visual.less';

// ── Constants ────────────────────────────────────────────────────────

/** Degrees-to-radians multiplier. */
const DEG_TO_RAD = Math.PI / 180;

/** Arc thickness as fraction of radius. */
const ARC_THICKNESS = 0.20;

/** Stagger delay between gauges (ms). */
const STAGGER_DELAY = 100;

// ── Data Interface ───────────────────────────────────────────────────

interface GaugeItem {
  label: string;
  value: number;
  target: number | null;
  highlighted: boolean;
  selectionId: ISelectionId;
}

/** Whether cross-highlight data is present from another visual/slicer. */
interface GaugeData {
  items: GaugeItem[];
  hasHighlights: boolean;
}

// ── Visual Class ─────────────────────────────────────────────────────

export class GaugeClusterVisual implements IVisual {
  private host: IVisualHost;
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private container: HTMLElement;
  private settings: GaugeClusterSettings;
  private formattingSettingsService: FormattingSettingsService;
  private previousValues: Map<string, number> = new Map();
  private sparklineHistory: Map<string, number[]> = new Map();
  private cancelAnimations: Array<() => void> = [];
  private currentData: GaugeData | null = null;
  private emptyStateMode: 'unconfigured' | 'noData' = 'unconfigured';
  private summaryValueElement: HTMLElement | null = null;
  private summaryCaptionElement: HTMLElement | null = null;

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new GaugeClusterSettings();
    this.formattingSettingsService = new FormattingSettingsService(options.host.createLocalizationManager());
    this.container.classList.add('gauge-cluster-container');
    attachEmptySpaceContextMenu(this.container, this.selectionManager, () =>
      this.host.createSelectionIdBuilder().createSelectionId(),
      () => allowInteractions(this.host),
    );
  }

  public update(options: VisualUpdateOptions): void {
    notifyRenderingStarted(this.host, options);
    try {
      // Cancel any running animations from previous render
      this.cancelAnimations.forEach((cancel) => cancel());
      this.cancelAnimations = [];

      // Parse settings from dataView
      const dataView = options.dataViews?.[0];
      const hasMeasureRole = dataView?.metadata?.columns?.some((column) => column.roles?.['measure']) ?? false;
      this.emptyStateMode = hasMeasureRole ? getVisualEmptyStateMode(dataView) : 'unconfigured';
      if (dataView) {
        this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
          GaugeClusterSettings,
          dataView
        );
      }
      syncTitleFormattingVisibility(this.settings.titleFormattingCard);
      syncLegendFormattingVisibility(this.settings.legendFormattingCard);
      hideInlineLegendFormatting(this.settings.legendFormattingCard);

      // Migrate legacy enableGlass -> cardStyleMode (backward compat)
      const legacyCardObj = dataView?.metadata?.objects?.['cardSettings'];
      if (legacyCardObj?.['cardStyleMode'] === undefined && legacyCardObj?.['enableGlass'] === false) {
        this.settings.cardSettings.cardStyleMode.value = { value: 'none', displayName: 'None' };
      }

      // Preserve reports that used the older shared data-label visibility toggle.
      const labelsObject = dataView?.metadata?.objects?.['labelsSettings'];
      const dataLabelsObject = dataView?.metadata?.objects?.['dataLabelFormatting'];
      if (labelsObject?.['showValues'] === undefined && typeof dataLabelsObject?.['showDataLabels'] === 'boolean') {
        this.settings.labelsSettings.showValues.value = dataLabelsObject['showDataLabels'];
      }

      // Conditional visibility: hide child settings when parent toggle is off
      const s = this.settings;
      s.labelsSettings.subtitleField.visible = s.labelsSettings.showSubtitle.value;
      s.labelsSettings.labelFontSize.visible = s.labelsSettings.showLabels.value;
      s.labelsSettings.labelFontColor.visible = s.labelsSettings.showLabels.value;
      s.labelsSettings.labelFontFamily.visible = s.labelsSettings.showLabels.value;
      s.labelsSettings.labelFontWeight.visible = s.labelsSettings.showLabels.value;
      s.labelsSettings.labelPaddingTop.visible = s.labelsSettings.showLabels.value;
      s.labelsSettings.subtitleFontSize.visible = s.labelsSettings.showSubtitle.value;
      s.labelsSettings.subtitleFontColor.visible = s.labelsSettings.showSubtitle.value;
      s.labelsSettings.subtitleFontFamily.visible = s.labelsSettings.showSubtitle.value;
      s.labelsSettings.subtitleFontWeight.visible = s.labelsSettings.showSubtitle.value;
      s.labelsSettings.subtitlePaddingTop.visible = s.labelsSettings.showSubtitle.value;
      s.labelsSettings.labelPosition.visible = s.labelsSettings.showLabels.value;
      s.dataLabelFormattingCard.showDataLabels.visible = false;
      s.dataLabelFormattingCard.dataLabelFontSize.visible = s.labelsSettings.showValues.value;
      s.dataLabelFormattingCard.dataLabelFontColor.visible = s.labelsSettings.showValues.value;
      s.dataLabelFormattingCard.dataLabelFontWeight.visible = s.labelsSettings.showValues.value;
      s.dataLabelFormattingCard.dataLabelFontFamily.visible = s.labelsSettings.showValues.value;
      s.dataLabelFormattingCard.dataLabelPosition.visible = s.labelsSettings.showValues.value;
      s.animationSettings.duration.visible = s.animationSettings.enabled.value;
      const hasTargetRole = dataView?.metadata?.columns?.some((column) => column.roles?.['target']) ?? false;
      s.targetSettings.visible = hasTargetRole;
      s.targetSettings.color.visible = s.targetSettings.show.value;
      s.targetSettings.lineWidth.visible = s.targetSettings.show.value;
      s.summarySettings.displayMode.visible = s.summarySettings.show.value;
      s.summarySettings.customText.visible = s.summarySettings.show.value
        && (resolveDropdown(s.summarySettings.displayMode) ?? 'selectedOrAverage') === 'custom';
      s.summarySettings.captionMode.visible = s.summarySettings.show.value;
      s.summarySettings.customCaption.visible = s.summarySettings.show.value
        && (resolveDropdown(s.summarySettings.captionMode) ?? 'auto') === 'custom';
      s.summarySettings.fontSize.visible = s.summarySettings.show.value;
      s.summarySettings.fontColor.visible = s.summarySettings.show.value;
      s.summarySettings.fontFamily.visible = s.summarySettings.show.value;
      s.summarySettings.fontWeight.visible = s.summarySettings.show.value;
      const showSummaryCaption = s.summarySettings.show.value
        && (resolveDropdown(s.summarySettings.captionMode) ?? 'auto') !== 'none';
      s.summarySettings.captionFontSize.visible = showSummaryCaption;
      s.summarySettings.captionFontColor.visible = showSummaryCaption;

      const conditionalEnabled = s.conditionalFormattingCard.enableConditional.value;
      s.conditionalFormattingCard.conditionalDirection.visible = conditionalEnabled;
      s.conditionalFormattingCard.threshold1.visible = conditionalEnabled;
      s.conditionalFormattingCard.threshold2.visible = conditionalEnabled;
      s.conditionalFormattingCard.conditionalColor1.visible = conditionalEnabled;
      s.conditionalFormattingCard.conditionalColor2.visible = conditionalEnabled;
      s.conditionalFormattingCard.conditionalColor3.visible = conditionalEnabled;
      syncCardStyleVisibility(s.cardSettings);

      const categoryColumn = dataView?.categorical?.categories?.[0];
      s.dateFilterFormattingCard.visible = Boolean(categoryColumn && isDateColumn(categoryColumn.source));
      s.dateFilterFormattingCard.startDate.visible = s.dateFilterFormattingCard.visible
        && s.dateFilterFormattingCard.enableDateFilter.value;
      s.dateFilterFormattingCard.endAtCurrentDate.visible = s.dateFilterFormattingCard.visible
        && s.dateFilterFormattingCard.enableDateFilter.value;
      s.dateFilterFormattingCard.endDate.visible = s.dateFilterFormattingCard.visible
        && s.dateFilterFormattingCard.enableDateFilter.value
        && !s.dateFilterFormattingCard.endAtCurrentDate.value;

      const data = this.extractData(dataView);
      this.currentData = data;

      const highContrast = getHostHighContrastColors(this.host);
      this.render(data, options.viewport, highContrast);
      applyBasicHighContrastStyles(this.container, highContrast, {
        textSelectors: ['.gauge-value', '.gauge-label', '.gauge-subtitle', '.gauge-cluster-summary-value', '.gauge-cluster-summary-caption', '.pbi-landing-page-title', '.pbi-landing-page-description', '.pbi-landing-page-hint', '.pbi-landing-page li'],
        fillSelectors: ['.gauge-track', '.pbi-landing-page'],
        strokeSelectors: ['.gauge-target-tick', '.gauge-needle'],
      });
      if (highContrast.enabled) {
        this.container.querySelectorAll<SVGPathElement>('.gauge-fill').forEach((element) => {
          element.setAttribute('fill', highContrast.foregroundSelected);
        });
      }
      notifyRenderingFinished(this.host, options);
    } catch (error) {
      notifyRenderingFailed(this.host, options, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private extractData(dataView: DataView | undefined): GaugeData {
    const items: GaugeItem[] = [];

    if (!dataView?.categorical) return { items, hasHighlights: false };

    const categorical = dataView.categorical;
    const values = categorical.values;
    const categoryColumn = categorical.categories?.[0];

    const measureColumns = values
      ? values.filter((col) => col.source.roles?.['measure'])
      : [];
    const targetColumns = values
      ? values.filter((col) => col.source.roles?.['target'])
      : [];

    if (measureColumns.length === 0) return { items, hasHighlights: false };

    if (!categoryColumn) {
      const populatedMeasureColumns = measureColumns
        .map((column, measureIndex) => ({ column, measureIndex }))
        .filter(({ column }) => column.values.length > 0);
      const count = Math.min(populatedMeasureColumns.length, 8);
      let hasHighlights = false;

      for (let i = 0; i < count; i++) {
        const { column: measureColumn, measureIndex } = populatedMeasureColumns[i];
        const rawValue = measureColumn.values?.[0];
        const value = typeof rawValue === 'number' ? rawValue : 0;

        const targetColumn = targetColumns.length <= 1 ? targetColumns[0] : targetColumns[measureIndex];
        const rawTarget = targetColumn?.values?.[0];
        const target = typeof rawTarget === 'number' ? rawTarget : null;

        const highlighted = measureColumn.highlights?.[0] !== null && measureColumn.highlights?.[0] !== undefined;
        if (highlighted) hasHighlights = true;

        const builder = this.host.createSelectionIdBuilder();
        const queryName = measureColumn.source.queryName;
        const selectionId = queryName
          ? builder.withMeasure(queryName).createSelectionId()
          : builder.createSelectionId();

        items.push({
          label: measureColumn.source.displayName ?? `Gauge ${i + 1}`,
          value,
          target,
          highlighted,
          selectionId,
        });
      }

      return { items, hasHighlights };
    }

    const categoryValues = categoryColumn.values;
    const measureColumn = measureColumns[0] ?? null;
    const targetColumn = targetColumns[0] ?? null;

    // Read cross-highlight data from the measure column
    const measureHighlights = measureColumn
      ? (measureColumn.highlights as unknown[] | undefined)
      : undefined;

    // Build gauge items from each category row
    const count = categoryValues.length;

    const dateConfig: DateFilterConfig = {
      enabled: this.settings.dateFilterFormattingCard.enableDateFilter.value,
      startDate: this.settings.dateFilterFormattingCard.startDate.value,
      endAtCurrentDate: this.settings.dateFilterFormattingCard.endAtCurrentDate.value,
      endDate: this.settings.dateFilterFormattingCard.endDate.value,
    };
    const dateIndices = isDateColumn(categoryColumn.source) ? getDateFilterIndices(categoryValues, dateConfig) : null;

    let hasHighlights = false;

    for (let i = 0; i < count; i++) {
      if (dateIndices && !dateIndices.has(i)) continue;

      const label = categoryValues[i] != null ? String(categoryValues[i]) : `Gauge ${i + 1}`;

      let value = 0;
      if (measureColumn && i < measureColumn.values.length) {
        const raw = measureColumn.values[i];
        value = typeof raw === 'number' ? raw : 0;
      }

      let target: number | null = null;
      if (targetColumn && i < targetColumn.values.length) {
        const raw = targetColumn.values[i];
        target = typeof raw === 'number' ? raw : null;
      }

      const highlighted = measureHighlights
        ? measureHighlights[i] !== null && measureHighlights[i] !== undefined
        : false;
      if (highlighted) hasHighlights = true;

      const selectionId = this.host.createSelectionIdBuilder()
        .withCategory(categoryColumn, i)
        .createSelectionId();

      items.push({ label, value, target, highlighted, selectionId });
    }

    return { items, hasHighlights };
  }

  private render(
    data: GaugeData,
    viewport: powerbi.IViewport,
    highContrast: ReturnType<typeof getHostHighContrastColors>,
  ): void {
    const items = data.items;
    this.hideTooltip();
    // Clear container (no innerHTML)
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    renderChartTitle(this.container, this.settings.titleFormattingCard);
    this.container.removeEventListener('click', this.handleBackgroundClick);

    const s = this.settings;

    // Apply card style
    const cardMode = (resolveDropdown(s.cardSettings.cardStyleMode) ?? 'glass') as CardStyleMode;
    applyCardStyle(
      this.container,
      {
        mode: cardMode,
        opacity: s.cardSettings.backgroundOpacity.value / 100,
        backgroundColor: s.cardSettings.backgroundColor.value?.value,
        borderRadius: s.cardSettings.borderRadius.value,
      },
    );
    const contentPadding = Math.max(0, s.cardSettings.contentPadding.value);
    this.container.style.padding = `${contentPadding}px`;
    this.container.style.boxSizing = 'border-box';

    // Empty state: no data
    if (items.length === 0) {
      this.summaryValueElement = null;
      this.summaryCaptionElement = null;
      if (this.emptyStateMode === 'noData') {
        renderNoDataState(
          this.container,
          getLocalizedString(this.host, 'GaugeCluster_NoDataState', 'No data for the current selection.'),
          highContrast,
        );
      } else {
        renderLandingPage(this.container, {
          title: getLocalizedString(this.host, 'GaugeCluster_LandingTitle', 'Add data to build a gauge cluster'),
          description: getLocalizedString(this.host, 'GaugeCluster_EmptyState', 'Bind a category and value for row-based gauges, or add multiple value measures for one gauge per measure.'),
          steps: [
            getLocalizedString(this.host, 'GaugeCluster_LandingStepValue', 'Value'),
            getLocalizedString(this.host, 'GaugeCluster_LandingStepCategory', 'Optional category'),
            getLocalizedString(this.host, 'GaugeCluster_LandingStepTarget', 'Optional target'),
          ],
        }, highContrast);
      }
      return;
    }

    this.summaryValueElement = null;
    this.summaryCaptionElement = null;
    if (s.summarySettings.show.value) {
      const summaryEl = document.createElement('div');
      summaryEl.className = 'gauge-cluster-summary';
      summaryEl.style.display = 'flex';
      summaryEl.style.flexDirection = 'column';
      summaryEl.style.alignItems = 'center';
      summaryEl.style.justifyContent = 'center';
      summaryEl.style.gap = '2px';
      summaryEl.style.marginBottom = `${Math.max(8, contentPadding * 0.75)}px`;

      const summaryValueEl = document.createElement('div');
      summaryValueEl.className = 'gauge-cluster-summary-value';
      summaryValueEl.style.lineHeight = '1.1';

      const summaryCaptionEl = document.createElement('div');
      summaryCaptionEl.className = 'gauge-cluster-summary-caption';
      summaryCaptionEl.style.lineHeight = '1.2';
      summaryCaptionEl.style.opacity = '0.75';

      summaryEl.appendChild(summaryValueEl);
      summaryEl.appendChild(summaryCaptionEl);
      this.container.appendChild(summaryEl);
      this.summaryValueElement = summaryValueEl;
      this.summaryCaptionElement = summaryCaptionEl;
      this.updateSummaryDisplay();
    }

    // ── Grid Layout ──────────────────────────────────────────────
    const gaugesPerRow = Math.max(1, Math.min(8, s.gridLayoutSettings.gaugesPerRow.value));
    const availableWidth = Math.max(0, viewport.width - (contentPadding * 2));
    const responsiveColumns = Math.max(1, Math.floor(availableWidth / 96));
    const columnCount = Math.max(1, Math.min(gaugesPerRow, responsiveColumns, items.length));
    const gridShell = document.createElement('div');
    gridShell.className = 'gauge-grid-shell';
    const grid = document.createElement('div');
    grid.className = 'gauge-grid';
    grid.style.gridTemplateColumns = `repeat(${columnCount}, minmax(0, 1fr))`;
    gridShell.appendChild(grid);
    this.container.appendChild(gridShell);

    // ── Settings ─────────────────────────────────────────────────
    const arcRangeDeg = Math.max(60, Math.min(350, s.arcAppearanceSettings.arcRange.value));
    const configuredMin = s.valueRangeSettings.minValue.value;
    const configuredMax = s.valueRangeSettings.maxValue.value;
    const minVal = Math.min(configuredMin, configuredMax);
    const maxVal = configuredMin === configuredMax
      ? configuredMin + 1
      : Math.max(configuredMin, configuredMax);
    const totalRange = maxVal - minVal;
    const showLabels = s.labelsSettings.showLabels.value;
    const showValues = s.labelsSettings.showValues.value;

    // Zone thresholds (as fraction 0..1)
    const firstThresholdPct = Math.max(0, Math.min(100, s.zoneSettings.lowThreshold.value)) / 100;
    const secondThresholdPct = Math.max(0, Math.min(100, s.zoneSettings.highThreshold.value)) / 100;
    const lowThresholdPct = Math.min(firstThresholdPct, secondThresholdPct);
    const highThresholdPct = Math.max(firstThresholdPct, secondThresholdPct);
    const themeName = resolveColorTheme(s.colorThemeFormattingCard);
    const lowColor = themeName !== 'default'
      ? getHostChartColor(this.host.colorPalette, 0, themeName)
      : (s.zoneSettings.lowColor.value?.value ?? '#F87171');
    const midColor = themeName !== 'default'
      ? getHostChartColor(this.host.colorPalette, 1, themeName)
      : (s.zoneSettings.midColor.value?.value ?? '#FBBF24');
    const highColor = themeName !== 'default'
      ? getHostChartColor(this.host.colorPalette, 2, themeName)
      : (s.zoneSettings.highColor.value?.value ?? '#34D399');

    const animEnabled = s.animationSettings.enabled.value;
    const animDuration = s.animationSettings.duration.value;

    // ── Arc Math ─────────────────────────────────────────────────
    // Arc centered at bottom: start at -(arcRange/2) from 6 o'clock, end at +(arcRange/2)
    // In d3.arc convention, 0 = 12 o'clock (top), so 6 o'clock = PI.
    // startAngle = PI - (arcRange/2 in rad), endAngle = PI + (arcRange/2 in rad)
    const halfRangeRad = (arcRangeDeg / 2) * DEG_TO_RAD;
    const startAngleRad = Math.PI - halfRangeRad;
    const endAngleRad = Math.PI + halfRangeRad;
    const totalSweepRad = endAngleRad - startAngleRad;

    // SVG viewBox dimensions per mini gauge
    const svgSize = 100;
    const cx = svgSize / 2;
    const cy = svgSize / 2;
    const outerRadius = svgSize * 0.40;
    const arcThicknessPct = Math.max(5, Math.min(50, s.arcAppearanceSettings.arcThickness.value)) / 100;
    const arcWidth = outerRadius * arcThicknessPct;
    const innerRadius = outerRadius - arcWidth;

    // D3 arc generator (optionally with rounded ends)
    const arcGen = d3.arc<{ startAngle: number; endAngle: number }>()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius)
      .cornerRadius(s.arcAppearanceSettings.roundedCaps.value ? arcWidth / 2 : 0);

    // ── Conditional Formatting Config ───────────────────────────
    const cc = s.conditionalFormattingCard;
    const conditionalConfig = buildConditionalConfig(
      cc.enableConditional.value,
      resolveDropdown(cc.conditionalDirection),
      cc.threshold1.value,
      cc.threshold2.value,
      cc.conditionalColor1.value?.value,
      cc.conditionalColor2.value?.value,
      cc.conditionalColor3.value?.value,
    );

    // ── Sort by value if enabled ─────────────────────────────────
    const sortedItems = s.gridLayoutSettings.sortByValue.value
      ? [...items].sort((a, b) => b.value - a.value)
      : items;

    // ── Render Each Gauge ────────────────────────────────────────
    const newValues = new Map<string, number>();

    sortedItems.forEach((item, index) => {
      const cell = document.createElement('div');
      cell.className = 'gauge-cell';
      const selectionKey = item.selectionId.getKey();
      cell.setAttribute('data-selection-key', selectionKey);
      cell.style.cursor = allowInteractions(this.host) ? 'pointer' : 'default';
      cell.addEventListener('mouseenter', (event) => this.showGaugeTooltip(item, event));
      cell.addEventListener('mousemove', (event) => this.moveTooltip(event));
      cell.addEventListener('mouseleave', () => this.hideTooltip());
      cell.addEventListener('click', (event) => {
        if (!allowInteractions(this.host)) return;
        event.stopPropagation();
        void this.selectionManager.select(item.selectionId, event.ctrlKey || event.metaKey).then(() => {
          this.applySelectionHighlight();
        });
      });
      cell.addEventListener('contextmenu', (event) => {
        if (!allowInteractions(this.host)) return;
        event.preventDefault();
        event.stopPropagation();
        void this.selectionManager.showContextMenu(item.selectionId, {
          x: event.clientX,
          y: event.clientY,
        });
      });
      grid.appendChild(cell);

      // Create SVG via d3 (creates proper SVG namespace elements)
      const svg = d3.select(cell)
        .append('svg')
        .attr('class', 'gauge-svg')
        .attr('viewBox', `0 0 ${svgSize} ${svgSize}`)
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .attr('width', '100%');

      const g = svg.append('g')
        .attr('transform', `translate(${cx}, ${cy})`);

      // ── Background Track ─────────────────────────────────────
      const trackColor = s.arcAppearanceSettings.trackColor.value?.value || '#94A3B8';
      g.append('path')
        .attr('class', 'gauge-track')
        .attr('d', arcGen({
          startAngle: startAngleRad,
          endAngle: endAngleRad,
        }))
        .attr('fill', trackColor)
        .attr('opacity', s.arcAppearanceSettings.trackOpacity.value / 100);

      // ── Value Computation ────────────────────────────────────
      const clampedValue = Math.max(minVal, Math.min(maxVal, item.value));
      const normalizedValue = (clampedValue - minVal) / totalRange; // 0..1
      newValues.set(selectionKey, item.value);

      // Color by zone (conditional formatting overrides zone colors if enabled)
      const zoneColor = normalizedValue < lowThresholdPct
        ? lowColor
        : normalizedValue < highThresholdPct
          ? midColor
          : highColor;
      const valueColor = resolveConditionalColor(item.value, conditionalConfig) ?? zoneColor;

      // Fill arc end angle proportional to value
      const valueEndAngle = startAngleRad + totalSweepRad * normalizedValue;

      // ── Filled Arc ───────────────────────────────────────────
      const valueArcPath = g.append('path')
        .attr('class', 'gauge-fill')
        .attr('fill', valueColor)
        .attr('stroke', 'none');

      if (animEnabled) {
        // Start from no sweep, animate to target
        valueArcPath.attr('d', arcGen({
          startAngle: startAngleRad,
          endAngle: startAngleRad,
        }));

        const staggerMs = index * STAGGER_DELAY;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        let cancelSweep: (() => void) | null = null;

        timeoutId = setTimeout(() => {
          cancelSweep = sweepArc(
            startAngleRad,
            valueEndAngle,
            animDuration,
            (currentAngle) => {
              valueArcPath.attr('d', arcGen({
                startAngle: startAngleRad,
                endAngle: currentAngle,
              }));
            }
          );
          this.cancelAnimations.push(cancelSweep);
        }, staggerMs);

        this.cancelAnimations.push(() => {
          if (timeoutId !== null) clearTimeout(timeoutId);
          cancelSweep?.();
        });
      } else {
        valueArcPath.attr('d', arcGen({
          startAngle: startAngleRad,
          endAngle: valueEndAngle,
        }));
      }

      // ── Target Marker ────────────────────────────────────────
      if (s.targetSettings.show.value && item.target !== null) {
        const clampedTarget = Math.max(minVal, Math.min(maxVal, item.target));
        const normalizedTarget = (clampedTarget - minVal) / totalRange;
        const targetAngle = startAngleRad + totalSweepRad * normalizedTarget;

        const tickLength = arcWidth * 0.8;
        const midRadius = (innerRadius + outerRadius) / 2;
        const targetColor = s.targetSettings.color.value?.value ?? '#0F172A';
        const targetLineWidth = s.targetSettings.lineWidth.value;

        // d3.arc uses 12-o'clock origin, rotate by -PI/2 for Math.cos/sin
        const cosA = Math.cos(targetAngle - Math.PI / 2);
        const sinA = Math.sin(targetAngle - Math.PI / 2);

        g.append('line')
          .attr('class', 'gauge-target-tick')
          .attr('x1', (midRadius - tickLength) * cosA)
          .attr('y1', (midRadius - tickLength) * sinA)
          .attr('x2', (midRadius + tickLength) * cosA)
          .attr('y2', (midRadius + tickLength) * sinA)
          .attr('stroke', targetColor)
          .attr('stroke-width', targetLineWidth)
          .attr('stroke-linecap', 'round');
      }

      // ── Value Text (center) ──────────────────────────────────
      if (showValues) {
        // Offset value text slightly above center for gauges with bottom-centered arcs
        const textY = cy * 0.05;

        const valueText = g.append('text')
          .attr('class', 'gauge-value')
          .attr('x', 0)
          .attr('y', textY);

        const fmt = (v: number): string => formatWithSettings(v, this.settings.numberFormattingCard);

        if (animEnabled) {
          const prevVal = this.previousValues.get(selectionKey) ?? minVal;
          valueText.text(fmt(prevVal));

          const staggerMs = index * STAGGER_DELAY;
          let timeoutId: ReturnType<typeof setTimeout> | null = null;
          let cancelCount: (() => void) | null = null;

          timeoutId = setTimeout(() => {
            cancelCount = countUp(
              prevVal,
              item.value,
              animDuration,
              (v) => { valueText.text(fmt(v)); }
            );
            this.cancelAnimations.push(cancelCount);
          }, staggerMs);

          this.cancelAnimations.push(() => {
            if (timeoutId !== null) clearTimeout(timeoutId);
            cancelCount?.();
          });
        } else {
          valueText.text(fmt(item.value));
        }
      }

      // ── Needle / Pointer ────────────────────────────────────
      if (s.arcAppearanceSettings.showNeedle.value) {
        const needleAngle = startAngleRad + totalSweepRad * normalizedValue;
        const needleLength = outerRadius - 4;
        // d3.arc uses 12-o'clock origin; rotate by -PI/2 for Math.cos/sin
        const cosN = Math.cos(needleAngle - Math.PI / 2);
        const sinN = Math.sin(needleAngle - Math.PI / 2);

        g.append('line')
          .attr('class', 'gauge-needle')
          .attr('x1', 0)
          .attr('y1', 0)
          .attr('x2', needleLength * cosN)
          .attr('y2', needleLength * sinN)
          .attr('stroke', valueColor)
          .attr('stroke-width', 2)
          .attr('stroke-linecap', 'round');

        // Center dot
        g.append('circle')
          .attr('class', 'gauge-needle-center')
          .attr('cx', 0)
          .attr('cy', 0)
          .attr('r', 3)
          .attr('fill', valueColor);
      }

      // ── Label Text (below arc) ───────────────────────────────
      const labelFontSize = s.labelsSettings.labelFontSize.value;
      const labelPaddingTop = Math.max(0, s.labelsSettings.labelPaddingTop.value);
      const labelPosition = resolveDropdown(s.labelsSettings.labelPosition) ?? 'belowArc';
      if (showLabels) {
        let labelY = outerRadius + labelPaddingTop;
        if (labelPosition === 'aboveArc') {
          labelY = -(outerRadius + Math.max(8, labelPaddingTop));
        } else if (labelPosition === 'insideGauge') {
          labelY = outerRadius * 0.55;
        }

        if (labelPosition !== 'hidden') {
          const labelEl = g.append('text')
            .attr('class', 'gauge-label')
            .attr('x', 0)
            .attr('y', labelY)
            .text(item.label);

          if (labelFontSize) labelEl.attr('font-size', `${labelFontSize}px`);
          const labelFontColor = s.labelsSettings.labelFontColor.value?.value;
          if (labelFontColor) labelEl.attr('fill', labelFontColor);
          const labelFontFamily = resolveDropdown(s.labelsSettings.labelFontFamily);
          if (labelFontFamily) labelEl.attr('font-family', labelFontFamily);
          const labelFontWeight = resolveDropdown(s.labelsSettings.labelFontWeight);
          if (labelFontWeight) labelEl.attr('font-weight', labelFontWeight);
        }
      }

      // ── Subtitle ────────────────────────────────────────────
      if (s.labelsSettings.showSubtitle.value) {
        const subtitleText = s.labelsSettings.subtitleField.value || '';
        if (subtitleText.length > 0) {
          const subtitleFontSize = s.labelsSettings.subtitleFontSize.value || Math.max(10, labelFontSize - 1);
          const subtitlePaddingTop = Math.max(0, s.labelsSettings.subtitlePaddingTop.value);
          const subtitleFontFamily = resolveDropdown(s.labelsSettings.subtitleFontFamily)
            || resolveDropdown(s.labelsSettings.labelFontFamily);
          const subtitleFontWeight = resolveDropdown(s.labelsSettings.subtitleFontWeight) ?? 'normal';
          const subtitleColor = s.labelsSettings.subtitleFontColor.value?.value
            || s.dataLabelFormattingCard.dataLabelFontColor.value?.value
            || '#64748B';
          let subtitleY = outerRadius
            + (showLabels ? labelPaddingTop + labelFontSize + subtitlePaddingTop : subtitlePaddingTop + 6);
          if (labelPosition === 'aboveArc' && showLabels) {
            subtitleY = -(outerRadius + labelPaddingTop + labelFontSize + subtitlePaddingTop);
          } else if (labelPosition === 'insideGauge' && showLabels) {
            subtitleY = outerRadius * 0.72;
          }
          const subtitleEl = g.append('text')
            .attr('class', 'gauge-subtitle')
            .attr('x', 0)
            .attr('y', subtitleY)
            .attr('text-anchor', 'middle')
            .attr('font-size', `${subtitleFontSize}px`)
            .attr('fill', subtitleColor)
            .attr('opacity', 0.8)
            .text(subtitleText);
          if (subtitleFontFamily) subtitleEl.attr('font-family', subtitleFontFamily);
          subtitleEl.attr('font-weight', subtitleFontWeight);
        }
      }

      // ── Sparkline ───────────────────────────────────────────
      if (s.labelsSettings.showSparklines.value) {
        // Track history for sparkline (keep up to 20 points)
        const history = this.sparklineHistory.get(selectionKey) ?? [];
        history.push(item.value);
        if (history.length > 20) history.shift();
        this.sparklineHistory.set(selectionKey, history);

        if (history.length >= 2) {
          const sparkW = outerRadius * 1.6;
          const sparkH = outerRadius * 0.4;
          const sparkSvg = renderSparkline({
            values: history,
            width: sparkW,
            height: sparkH,
            lineColor: valueColor,
            lineWidth: 1,
            showEndDot: true,
          });
          sparkSvg.style.display = 'block';
          sparkSvg.style.margin = '2px auto 0';
          cell.appendChild(sparkSvg);
        }
      }

      // ── Cell Entrance Animation ──────────────────────────────
      // Skip animation for cells that will be dimmed by cross-highlighting
      const shouldDimCell = data.hasHighlights && !item.highlighted;
      if (animEnabled && !shouldDimCell) {
        const cellEl = cell as HTMLElement;
        cellEl.style.opacity = '0';
        cellEl.style.transform = 'translateY(10px)';

        const staggerMs = index * STAGGER_DELAY;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        let cancelFade: (() => void) | null = null;

        timeoutId = setTimeout(() => {
          cancelFade = fadeSlideIn(cellEl, 'up', animDuration, 0);
          this.cancelAnimations.push(cancelFade);
        }, staggerMs);

        this.cancelAnimations.push(() => {
          if (timeoutId !== null) clearTimeout(timeoutId);
          cancelFade?.();
        });
      }
    });

    // Store current values for next render's count-up animation
    this.previousValues = newValues;
    // Apply shared formatting settings
    applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.gauge-value');

    // ── Accessibility ─────────────────────────────────────────────
    if (s.accessibilityFormattingCard.enableKeyboardNav.value) {
      ensureFocusRingStyles();

      applyChartAria(this.container, {
        chartType: 'gauge cluster',
        title: s.titleFormattingCard.titleText.value || undefined,
        dataPointCount: sortedItems.length,
      });

      // Make each gauge cell keyboard-focusable
      const cells = this.container.querySelectorAll('.gauge-cell');
      cells.forEach((cell, i) => {
        if (i < sortedItems.length) {
          const item = sortedItems[i];
          const fmtVal = formatWithSettings(item.value, this.settings.numberFormattingCard);
          applyDataPointAria(cell, item.label, fmtVal, i, sortedItems.length);
          cell.setAttribute('tabindex', '0');
          cell.setAttribute('aria-keyshortcuts', 'Enter Space ArrowLeft ArrowRight ArrowUp ArrowDown Home End');
          cell.setAttribute('aria-disabled', allowInteractions(this.host) ? 'false' : 'true');
        }
      });

      const cleanup = attachKeyboardNav({
        container: this.container,
        itemSelector: '.gauge-cell',
        onActivate: (el) => {
          (el as HTMLElement).click?.();
        },
      });
      this.cancelAnimations.push(cleanup);
    }

    // Legend
    const legendCard = this.settings.legendFormattingCard;
    if (legendCard.showLegend.value) {
      const legendPos = resolveDropdown(legendCard.legendPosition) ?? 'bottom';
      const rawFontColor = legendCard.legendFontColor.value?.value;
      const legendItems: LegendItem[] = [
        { label: 'Low', color: lowColor },
        { label: 'Mid', color: midColor },
        { label: 'High', color: highColor },
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

    this.applySelectionHighlight();
    this.container.addEventListener('click', this.handleBackgroundClick);
  }

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  private showGaugeTooltip(item: GaugeItem, event: MouseEvent): void {
    const numberSettings = this.settings.numberFormattingCard;
    const tooltipData: VisualTooltipDataItem[] = [
      { displayName: 'Label', value: item.label },
      { displayName: 'Value', value: formatWithSettings(item.value, numberSettings) },
    ];
    if (item.target !== null) {
      tooltipData.push({
        displayName: 'Target',
        value: formatWithSettings(item.target, numberSettings),
      });
    }

    this.host.tooltipService.show({
      dataItems: tooltipData,
      identities: [item.selectionId],
      coordinates: [event.clientX, event.clientY],
      isTouchEvent: false,
    });
  }

  private moveTooltip(event: MouseEvent): void {
    this.host.tooltipService.move({
      dataItems: [],
      identities: [],
      coordinates: [event.clientX, event.clientY],
      isTouchEvent: false,
    });
  }

  private hideTooltip(): void {
    this.host.tooltipService.hide({ immediately: true, isTouchEvent: false });
  }

  private handleBackgroundClick = (): void => {
    if (!allowInteractions(this.host)) return;
    void this.selectionManager.clear().then(() => {
      this.applySelectionHighlight();
    });
  };

  private applySelectionHighlight(): void {
    const data = this.currentData;
    if (!data) return;

    const selectedKeys = new Set(
      (this.selectionManager.getSelectionIds() as ISelectionId[]).map((id) => id.getKey()),
    );
    const hasSelection = selectedKeys.size > 0;
    const shouldDim = hasSelection || data.hasHighlights;
    const highlightedKeys = new Set(
      data.items.filter((item) => item.highlighted).map((item) => item.selectionId.getKey()),
    );

    const cells = this.container.querySelectorAll<HTMLElement>('.gauge-cell[data-selection-key]');
    cells.forEach((cell) => {
      if (!shouldDim) {
        cell.style.opacity = '';
        cell.style.boxShadow = '';
        return;
      }

      const key = cell.getAttribute('data-selection-key');
      const isSelected = key !== null && selectedKeys.has(key);
      const isHighlighted = key !== null && highlightedKeys.has(key);
      cell.style.opacity = (isSelected || isHighlighted) ? '' : '0.3';
      cell.style.boxShadow = isSelected
        ? '0 0 0 2px rgba(59, 130, 246, 0.35)'
        : isHighlighted
          ? '0 0 0 1px rgba(59, 130, 246, 0.18)'
          : '';
    });

    this.updateSummaryDisplay();
  }

  private updateSummaryDisplay(): void {
    if (!this.summaryValueElement || !this.summaryCaptionElement) return;

    const summary = this.resolveSummaryContent();
    const summarySettings = this.settings.summarySettings;
    this.summaryValueElement.textContent = summary.primaryText;
    this.summaryCaptionElement.textContent = summary.captionText;
    this.summaryCaptionElement.style.display = summary.captionText ? '' : 'none';

    this.summaryValueElement.style.fontSize = `${Math.max(12, summarySettings.fontSize.value)}px`;
    this.summaryValueElement.style.color = summarySettings.fontColor.value?.value || '#0F172A';
    const fontFamily = resolveDropdown(summarySettings.fontFamily);
    if (fontFamily) this.summaryValueElement.style.fontFamily = fontFamily;
    this.summaryValueElement.style.fontWeight = resolveDropdown(summarySettings.fontWeight) || '600';

    this.summaryCaptionElement.style.fontSize = `${Math.max(9, summarySettings.captionFontSize.value)}px`;
    this.summaryCaptionElement.style.color = summarySettings.captionFontColor.value?.value || '#64748B';
  }

  private resolveSummaryContent(): { primaryText: string; captionText: string } {
    const data = this.currentData;
    if (!data || data.items.length === 0) {
      return { primaryText: '', captionText: '' };
    }

    const summarySettings = this.settings.summarySettings;
    const mode = resolveDropdown(summarySettings.displayMode) ?? 'selectedOrAverage';
    const captionMode = resolveDropdown(summarySettings.captionMode) ?? 'auto';
    const selectedItem = this.getSelectedGaugeItem(data);
    const total = data.items.reduce((sum, item) => sum + item.value, 0);
    const average = total / data.items.length;

    let primaryText = '';
    let captionText = '';

    switch (mode) {
      case 'selectedOrAverage':
        primaryText = formatWithSettings(selectedItem ? selectedItem.value : average, this.settings.numberFormattingCard);
        captionText = selectedItem ? selectedItem.label : 'Average';
        break;
      case 'average':
        primaryText = formatWithSettings(average, this.settings.numberFormattingCard);
        captionText = 'Average';
        break;
      case 'total':
        primaryText = formatWithSettings(total, this.settings.numberFormattingCard);
        captionText = 'Total';
        break;
      case 'count':
        primaryText = formatWithSettings(data.items.length, this.settings.numberFormattingCard);
        captionText = 'Gauge Count';
        break;
      case 'custom':
        primaryText = summarySettings.customText.value || 'Summary';
        break;
      default:
        primaryText = formatWithSettings(average, this.settings.numberFormattingCard);
        captionText = 'Average';
        break;
    }

    if (captionMode === 'none') {
      captionText = '';
    } else if (captionMode === 'custom') {
      captionText = summarySettings.customCaption.value || captionText;
    }

    return { primaryText, captionText };
  }

  private getSelectedGaugeItem(data: GaugeData): GaugeItem | null {
    const selectedKeys = new Set(
      (this.selectionManager.getSelectionIds() as ISelectionId[]).map((id) => id.getKey()),
    );
    if (selectedKeys.size === 0) return null;
    return data.items.find((item) => selectedKeys.has(item.selectionId.getKey())) ?? null;
  }

  public destroy(): void {
    this.hideTooltip();
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];
    this.previousValues.clear();
  }
}
