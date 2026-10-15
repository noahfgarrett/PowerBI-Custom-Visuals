/**
 * Polar Nightingale Chart -- Power BI IVisual implementation.
 * Rose chart with sweeping petal animations, bloom hover effect,
 * and glassmorphic card styling.
 */

import powerbi from 'powerbi-visuals-api';
import * as d3 from 'd3';
import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel';
import { PolarChartSettings } from './settings';
import {
  sweepArc,
  springScale,
  fadeSlideIn,
  cubicOut,
  animate,
  DURATION,
  formatNumber,
  formatWithSettings,
  applyCardStyle,
  type CardStyleMode,
  getHostChartColor,
  withOpacity,
  renderChartTitle,
  applyDataLabelFormatting,
  applySortOrder,
  renderLegend,
  type LegendItem,
  resolveColorTheme,
  resolveDropdown,
  buildConditionalConfig,
  resolveConditionalColor,
  resolveSeriesFormatting,
  SeriesFormattingGroup,
  lineStyleToDashArray,
  applyChartAria,
  applyDataPointAria,
  attachKeyboardNav,
  ensureFocusRingStyles,
  getDateFilterIndices,
  isDateColumn,
  type DateFilterConfig,
  syncLegendFormattingVisibility,
  syncTitleFormattingVisibility,
  attachEmptySpaceContextMenu,
  getLocalizedString,
  getVisualEmptyStateMode,
  syncCardStyleVisibility,
  allowInteractions,
  getHostHighContrastColors,
  applyBasicHighContrastStyles,
  notifyRenderingStarted,
  notifyRenderingFinished,
  notifyRenderingFailed,
  truncateText,
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

// ── Data Interface ───────────────────────────────────────────────────

interface PetalDatum {
  label: string;
  value: number;
  color: string;
  selectionId: ISelectionId;
  /** Whether this data point is cross-highlighted from another visual. */
  highlighted: boolean;
  formattingObjects?: powerbi.DataViewObjects;
}

interface PolarChartData {
  petals: PetalDatum[];
  /** Whether cross-highlight data is present from another visual/slicer. */
  hasHighlights: boolean;
}

// ── Visual Class ─────────────────────────────────────────────────────

export class PolarChartVisual implements IVisual {
  private host: IVisualHost;
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private container: HTMLElement;
  private settings: PolarChartSettings;
  private formattingSettingsService: FormattingSettingsService;
  private cancelAnimations: Array<() => void> = [];
  private currentData: PolarChartData | null = null;
  private emptyStateMode: 'unconfigured' | 'noData' = 'unconfigured';
  private interactionsEnabled = true;
  private keyboardNavCleanup: (() => void) | null = null;

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new PolarChartSettings();
    this.formattingSettingsService = new FormattingSettingsService(options.host.createLocalizationManager());
    this.container.classList.add('polar-container');
    attachEmptySpaceContextMenu(this.container, this.selectionManager, () =>
      this.host.createSelectionIdBuilder().createSelectionId(),
      () => this.interactionsEnabled,
    );
  }

  public update(options: VisualUpdateOptions): void {
    notifyRenderingStarted(this.host, options);
    try {
      this.updateVisual(options);
      notifyRenderingFinished(this.host, options);
    } catch (error) {
      notifyRenderingFailed(
        this.host,
        options,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  private updateVisual(options: VisualUpdateOptions): void {
    // Cancel any running animations from previous render
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];
    this.interactionsEnabled = allowInteractions(this.host);

    // Parse settings from dataView
    const dataView = options.dataViews?.[0];
    this.emptyStateMode = getVisualEmptyStateMode(dataView);
    if (dataView) {
      this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
        PolarChartSettings,
        dataView
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

    syncTitleFormattingVisibility(this.settings.titleFormattingCard);
    syncLegendFormattingVisibility(this.settings.legendFormattingCard);

    // Hide inapplicable shared axis properties — polar-chart doesn't use titles/rotation/min/max

    // Date filter: hide start/end when disabled
    this.settings.dateFilterFormattingCard.startDate.visible = this.settings.dateFilterFormattingCard.enableDateFilter.value;
    this.settings.dateFilterFormattingCard.endAtCurrentDate.visible = this.settings.dateFilterFormattingCard.enableDateFilter.value;
    this.settings.dateFilterFormattingCard.endDate.visible = this.settings.dateFilterFormattingCard.enableDateFilter.value && !this.settings.dateFilterFormattingCard.endAtCurrentDate.value;
    const categoryColumn = dataView?.categorical?.categories?.find((column) => column.source.roles?.['category']);
    this.settings.dateFilterFormattingCard.visible = Boolean(categoryColumn && isDateColumn(categoryColumn.source));
    syncCardStyleVisibility(this.settings.cardSettings);

    this.settings.axisFormattingCard.showXAxis.visible = false;
    this.settings.axisFormattingCard.showYAxis.visible = false;
    this.settings.axisFormattingCard.xAxisTitle.visible = false;
    this.settings.axisFormattingCard.yAxisTitle.visible = false;
    this.settings.axisFormattingCard.axisLabelFontFamily.visible = false;
    this.settings.axisFormattingCard.axisLabelColor.visible = false;
    this.settings.axisFormattingCard.axisLabelSize.visible = false;
    this.settings.axisFormattingCard.axisLabelRotation.visible = false;
    this.settings.axisFormattingCard.yAxisMin.visible = false;
    this.settings.axisFormattingCard.yAxisMax.visible = false;
    this.settings.axisFormattingCard.axisLabelFontWeight.visible = false;
    this.settings.axisFormattingCard.integerTicks.visible = false;

    // Hide data label position — position is determined by chart geometry
    this.settings.dataLabelFormattingCard.dataLabelPosition.visible = false;
    // Shared inline legend labels are not rendered in this visual.
    this.settings.legendFormattingCard.showInlineLabels.visible = false;
    this.settings.legendFormattingCard.inlineLabelFontSize.visible = false;
    this.settings.legendFormattingCard.inlineLabelOffset.visible = false;
    const showLabels = this.settings.labelSettings.showLabels.value;
    this.settings.labelSettings.showRadialLabels.visible = showLabels;
    this.settings.labelSettings.showInnerLabels.visible = showLabels;
    const categoryLabelStylesVisible = showLabels
      && (this.settings.labelSettings.showRadialLabels.value || this.settings.labelSettings.showInnerLabels.value);
    this.settings.labelSettings.labelColor.visible = categoryLabelStylesVisible;
    this.settings.labelSettings.fontSize.visible = categoryLabelStylesVisible;
    this.settings.labelSettings.fontFamily.visible = categoryLabelStylesVisible;
    this.settings.labelSettings.fontWeight.visible = categoryLabelStylesVisible;

    const showValueLabels = this.settings.dataLabelFormattingCard.showDataLabels.value;
    this.settings.dataLabelFormattingCard.dataLabelFontSize.visible = showValueLabels;
    this.settings.dataLabelFormattingCard.dataLabelFontColor.visible = showValueLabels;
    this.settings.dataLabelFormattingCard.dataLabelFontWeight.visible = showValueLabels;
    this.settings.dataLabelFormattingCard.dataLabelFontFamily.visible = showValueLabels;

    const showGridLines = this.settings.axisFormattingCard.showGridLines.value;
    this.settings.axisFormattingCard.gridLineColor.visible = showGridLines;
    this.settings.axisFormattingCard.gridLineStyle.visible = showGridLines;
    this.settings.axisFormattingCard.gridLineWidth.visible = showGridLines;
    this.settings.axisFormattingCard.gridLineOpacity.visible = showGridLines;

    this.settings.animationSettings.duration.visible = this.settings.animationSettings.enabled.value;

    const conditionalEnabled = this.settings.conditionalFormattingCard.enableConditional.value;
    this.settings.conditionalFormattingCard.conditionalDirection.visible = conditionalEnabled;
    this.settings.conditionalFormattingCard.threshold1.visible = conditionalEnabled;
    this.settings.conditionalFormattingCard.threshold2.visible = conditionalEnabled;
    this.settings.conditionalFormattingCard.conditionalColor1.visible = conditionalEnabled;
    this.settings.conditionalFormattingCard.conditionalColor2.visible = conditionalEnabled;
    this.settings.conditionalFormattingCard.conditionalColor3.visible = conditionalEnabled;

    // Extract data and apply user-configured sort order
    const extracted = this.extractData(dataView);
    const data = applySortOrder(
      extracted.petals.map((d) => ({ ...d, name: d.label })),
      this.settings.sortFormattingCard,
    );

    // Store data for cross-highlight usage
    this.currentData = { petals: data, hasHighlights: extracted.hasHighlights };

    this.populatePetalFormattingGroups(data);

    this.render(data, options.viewport);
  }

  private populatePetalFormattingGroups(data: PetalDatum[]): void {
    const card = this.settings.seriesFormattingCard;
    card.groups = [];
    for (let i = 0; i < data.length; i++) {
      const group = new SeriesFormattingGroup({
        name: `series_${i}`,
        displayName: data[i].label,
      });
      group.seriesColor.value = { value: data[i].color };
      group.lineStyle.visible = false;
      group.lineWidth.visible = false;
      const selector = data[i].selectionId.getSelector();
      for (const slice of group.slices) {
        (slice as { selector?: unknown }).selector = selector;
      }
      const objects = data[i].formattingObjects?.['seriesFormatting'];
      if (objects) {
        const color = objects['seriesColor'] as { solid?: { color?: string } } | undefined;
        if (color?.solid?.color) group.seriesColor.value = { value: color.solid.color };
        if (typeof objects['seriesOpacity'] === 'number') group.seriesOpacity.value = objects['seriesOpacity'];
        if (typeof objects['showDataLabels'] === 'boolean') group.showDataLabels.value = objects['showDataLabels'];
      }
      card.groups.push(group);
    }
  }

  private extractData(dataView: DataView | undefined): PolarChartData {
    const themeName = resolveColorTheme(this.settings.colorThemeFormattingCard);
    const empty: PolarChartData = { petals: [], hasHighlights: false };

    if (!dataView?.categorical) return empty;

    const categories = dataView.categorical.categories;
    const values = dataView.categorical.values;

    if (!categories || categories.length === 0 || !values || values.length === 0) return empty;

    const categoryColumn = categories[0];
    const measureColumn = values[0];

    if (!categoryColumn || !measureColumn) return empty;

    const count = Math.min(categoryColumn.values.length, measureColumn.values.length);
    const baseColor = this.settings.colorsAndFillSettings.baseColor.value?.value;
    const useBaseColor = typeof baseColor === 'string' && baseColor.length > 0;

    // Cross-highlight: read highlight values from the measure column
    const hlRaw = (measureColumn as unknown as { highlights?: unknown }).highlights as unknown[] | undefined;

    const dateConfig: DateFilterConfig = {
      enabled: this.settings.dateFilterFormattingCard.enableDateFilter.value,
      startDate: this.settings.dateFilterFormattingCard.startDate.value,
      endAtCurrentDate: this.settings.dateFilterFormattingCard.endAtCurrentDate.value,
      endDate: this.settings.dateFilterFormattingCard.endDate.value,
    };
    const dateIndices = isDateColumn(categoryColumn.source) ? getDateFilterIndices(categoryColumn.values, dateConfig) : null;

    const result: PetalDatum[] = [];
    let hasHighlights = false;

    for (let i = 0; i < count; i++) {
      if (dateIndices && !dateIndices.has(i)) continue;

      const label = categoryColumn.values[i];
      const value = measureColumn.values[i];

      // Skip null / non-numeric entries
      if (label == null || value == null || typeof value !== 'number' || Number.isNaN(value)) {
        continue;
      }

      const color = useBaseColor
        ? this.lightenColor(baseColor, count > 1 ? (i / (count - 1)) * 0.45 : 0)
        : getHostChartColor(this.host.colorPalette, i, themeName);

      const isHighlighted = hlRaw ? hlRaw[i] !== null && hlRaw[i] !== undefined : false;
      if (isHighlighted) hasHighlights = true;

      result.push({
        label: String(label),
        value: Math.max(0, value), // clamp negative values to 0
        color,
        selectionId: this.host.createSelectionIdBuilder()
          .withCategory(categoryColumn, i)
          .createSelectionId(),
        highlighted: isHighlighted,
        formattingObjects: categoryColumn.objects?.[i],
      });
    }

    return { petals: result, hasHighlights };
  }

  private render(data: PetalDatum[], viewport: powerbi.IViewport): void {
    this.keyboardNavCleanup?.();
    this.keyboardNavCleanup = null;
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
    applyCardStyle(this.container, {
      mode: cardMode,
      opacity: s.cardSettings.backgroundOpacity.value / 100,
      backgroundColor: s.cardSettings.backgroundColor.value?.value || undefined,
      borderRadius: s.cardSettings.borderRadius.value,
    });
    const contentPadding = Math.max(0, s.cardSettings.contentPadding.value);
    this.container.style.padding = `${contentPadding}px`;

    // Empty state: no data
    if (data.length === 0) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'polar-empty';
      emptyEl.textContent = this.emptyStateMode === 'noData'
        ? getLocalizedString(this.host, 'PolarChart_NoDataState', 'No data for the current selection.')
        : getLocalizedString(this.host, 'PolarChart_EmptyState', 'Add a category and measure');
      this.container.appendChild(emptyEl);
      this.applyHighContrast();
      return;
    }

    // ── Dimensions ──────────────────────────────────────────────
    const width = Math.max(0, viewport.width - (contentPadding * 2));
    const height = Math.max(0, viewport.height - (contentPadding * 2));
    if (width <= 0 || height <= 0) return;
    const size = Math.min(width, height);
    const cx = width / 2;
    const cy = height / 2;
    const showLabels = s.labelSettings.showLabels.value;
    const showRadialLabels = showLabels && s.labelSettings.showRadialLabels.value;
    const showInnerLabels = showLabels && s.labelSettings.showInnerLabels.value;
    const categoryLabelFontSize = Math.max(1, s.labelSettings.fontSize.value);
    const valueLabelFontSize = Math.max(1, s.dataLabelFormattingCard.dataLabelFontSize.value);
    const estimatedCategoryWidth = Math.max(
      0,
      ...data.map((datum) => datum.label.length * categoryLabelFontSize * 0.55),
    );
    const estimatedValueWidth = Math.max(
      0,
      ...data.map((datum) =>
        formatWithSettings(datum.value, s.numberFormattingCard).length * valueLabelFontSize * 0.55
      ),
    );
    const radialLabelReserve = showRadialLabels
      ? Math.min(estimatedCategoryWidth + 20, Math.max(16, size * 0.28))
      : 0;
    const valueLabelReserve = s.dataLabelFormattingCard.showDataLabels.value
      ? Math.min(14 + (estimatedValueWidth / 2), Math.max(12, size * 0.2))
      : 0;
    const outsideLabelReserve = Math.max(radialLabelReserve, valueLabelReserve);
    const maxOuterRadius = Math.max(1, (size / 2) - outsideLabelReserve);
    const innerRadius = Math.max(0, Math.min(s.segmentSettings.innerRadius.value, maxOuterRadius * 0.6));

    // ── Value calculations ──────────────────────────────────────
    const totalValue = data.reduce((sum, d) => sum + d.value, 0);
    const maxValue = Math.max(1, d3.max(data, (d) => d.value) ?? 0);
    const petalCount = data.length;
    const segmentPaddingDeg = Math.max(0, s.segmentSettings.segmentPadding.value);
    const startAngleDegrees = s.segmentSettings.startAngle.value;
    const configuredSpan = s.segmentSettings.endAngle.value - startAngleDegrees;
    const normalizedSpan = ((configuredSpan % 360) + 360) % 360;
    const angularSpanDegrees = normalizedSpan === 0 ? 360 : normalizedSpan;
    const angleStep = angularSpanDegrees * DEG_TO_RAD / petalCount;
    const startAngleOffset = startAngleDegrees * DEG_TO_RAD;

    // ── SVG Setup ───────────────────────────────────────────────
    const svg = d3.select(this.container)
      .append('svg')
      .attr('class', 'polar-svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    const g = svg.append('g')
      .attr('transform', `translate(${cx}, ${cy})`);

    // ── Glow filter for petal hover ─────────────────────────────
    const defs = svg.append('defs');
    const glowFilter = defs.append('filter')
      .attr('id', 'petal-inner-glow')
      .attr('x', '-20%')
      .attr('y', '-20%')
      .attr('width', '140%')
      .attr('height', '140%');
    glowFilter.append('feGaussianBlur')
      .attr('in', 'SourceAlpha')
      .attr('stdDeviation', '3')
      .attr('result', 'blur');
    glowFilter.append('feFlood')
      .attr('flood-color', '#ffffff')
      .attr('flood-opacity', '0.3')
      .attr('result', 'glowColor');
    glowFilter.append('feComposite')
      .attr('in', 'glowColor')
      .attr('in2', 'blur')
      .attr('operator', 'in')
      .attr('result', 'innerGlow');
    const glowMerge = glowFilter.append('feMerge');
    glowMerge.append('feMergeNode').attr('in', 'innerGlow');
    glowMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // ── Gradient Defs (if enabled) ──────────────────────────────
    const gradientEnabled = s.colorsAndFillSettings.enableGradientFill.value;
    if (gradientEnabled) {
      data.forEach((datum, i) => {
        const fmt = resolveSeriesFormatting(this.settings.seriesFormattingCard, i, datum.color);
        const grad = defs.append('radialGradient')
          .attr('id', `polar-grad-${i}`)
          .attr('cx', '50%').attr('cy', '50%')
          .attr('r', '50%');
        grad.append('stop')
          .attr('offset', '0%')
          .attr('stop-color', fmt.color)
          .attr('stop-opacity', 1);
        grad.append('stop')
          .attr('offset', '100%')
          .attr('stop-color', fmt.color)
          .attr('stop-opacity', 0);
      });
    }

    // ── D3 Arc Generator ────────────────────────────────────────
    const arcGen = d3.arc<{ startAngle: number; endAngle: number; innerRadius: number; outerRadius: number }>()
      .innerRadius((d) => d.innerRadius)
      .outerRadius((d) => d.outerRadius)
      .cornerRadius(3);

    // ── Grid circles (concentric) ─────────────────────────────
    if (s.axisFormattingCard.showGridLines.value) {
      const gridColor = s.axisFormattingCard.gridLineColor.value?.value || '#E2E8F0';
      const gridStyleValue = s.axisFormattingCard.gridLineStyle.value;
      const gridStyle = typeof gridStyleValue === 'string'
        ? gridStyleValue
        : (gridStyleValue as { value?: string } | undefined)?.value ?? 'dashed';
      const gridDash = lineStyleToDashArray(gridStyle);
      const gridWidth = Math.max(0, s.axisFormattingCard.gridLineWidth.value);
      const gridOpacity = Math.max(0, Math.min(100, s.axisFormattingCard.gridLineOpacity.value)) / 100;
      const gridGroup = g.append('g').attr('class', 'polar-grid');
      const gridCount = 4;
      for (let gi = 1; gi <= gridCount; gi++) {
        const r = innerRadius + ((gi / gridCount) * (maxOuterRadius - innerRadius));
        gridGroup.append('circle')
          .attr('cx', 0)
          .attr('cy', 0)
          .attr('r', r)
          .attr('fill', 'none')
          .attr('stroke', gridColor)
          .attr('stroke-width', gridWidth)
          .attr('stroke-dasharray', gridDash)
          .attr('stroke-opacity', gridOpacity);
      }
    }

    // ── Radial axis lines (petal dividers) ──────────────────────
    const axisLineColor = s.axisFormattingCard.axisLineColor.value?.value || '#CBD5E1';
    const axisLineWidth = s.axisFormattingCard.axisLineWidth.value;

    if (axisLineWidth > 0) {
      const axisLineGroup = g.append('g').attr('class', 'polar-axis-lines');
      data.forEach((_datum, i) => {
        const angle = startAngleOffset + i * angleStep;
        const x1 = innerRadius * Math.sin(angle);
        const y1 = -innerRadius * Math.cos(angle);
        const x2 = maxOuterRadius * Math.sin(angle);
        const y2 = -maxOuterRadius * Math.cos(angle);
        axisLineGroup.append('line')
          .attr('x1', x1)
          .attr('y1', y1)
          .attr('x2', x2)
          .attr('y2', y2)
          .attr('stroke', axisLineColor)
          .attr('stroke-width', axisLineWidth)
          .attr('stroke-opacity', 0.5);
      });
    }

    // ── Render petals ───────────────────────────────────────────
    const animEnabled = s.animationSettings.enabled.value;
    const animDuration = s.animationSettings.duration.value;

    data.forEach((datum, i) => {
      const rawPetalStartAngle = startAngleOffset + i * angleStep;
      const rawPetalEndAngle = startAngleOffset + (i + 1) * angleStep;
      const padAngle = Math.min(segmentPaddingDeg * DEG_TO_RAD, Math.max(0, angleStep - 0.02));
      const petalStartAngle = rawPetalStartAngle + (padAngle / 2);
      const petalEndAngle = rawPetalEndAngle - (padAngle / 2);
      const targetOuterRadius = innerRadius + ((datum.value / maxValue) * (maxOuterRadius - innerRadius));

      const petalGroup = g.append('g').attr('class', 'polar-petal-group');

      const fmt = resolveSeriesFormatting(this.settings.seriesFormattingCard, i, datum.color);
      const conditionalFill = this.getConditionalColor(datum.value);
      const petalFill = conditionalFill ?? (gradientEnabled ? `url(#polar-grad-${i})` : fmt.color);
      const petalPath = petalGroup.append('path')
        .attr('class', 'polar-petal')
        .attr('data-selection-key', datum.selectionId.getKey())
        .attr('fill', petalFill)
        .attr('fill-opacity', fmt.opacity / 100)
        .attr('stroke', s.segmentSettings.segmentStrokeColor.value?.value || withOpacity(datum.color, 0.6))
        .attr('stroke-width', s.segmentSettings.segmentStrokeWidth.value)
        .style('cursor', 'pointer')
        .on('click', (event: MouseEvent) => {
          if (!this.interactionsEnabled) return;
          event.stopPropagation();
          void this.selectionManager
            .select(datum.selectionId, event.ctrlKey || event.metaKey)
            .then(() => this.applyCrossHighlight());
        })
        .on('contextmenu', (event: MouseEvent) => {
          if (!this.interactionsEnabled) return;
          event.preventDefault();
          event.stopPropagation();
          void this.selectionManager.showContextMenu(datum.selectionId, {
            x: event.clientX,
            y: event.clientY,
          });
        });
      const accessiblePetalNode = petalPath.node();
      if (accessiblePetalNode && s.accessibilityFormattingCard.enableKeyboardNav.value) {
        applyDataPointAria(
          accessiblePetalNode,
          datum.label,
          formatWithSettings(datum.value, this.settings.numberFormattingCard),
          i,
          data.length,
        );
      }

      if (animEnabled) {
        // Initial state: arc at innerRadius (no visible petal)
        petalPath.attr('d', arcGen({
          startAngle: petalStartAngle,
          endAngle: petalStartAngle,
          innerRadius: innerRadius,
          outerRadius: innerRadius,
        }));

        // Animate: sweep from startAngle to endAngle while growing radius
        const delay = i * 60;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        let cancelAnim: (() => void) | null = null;

        timeoutId = setTimeout(() => {
          cancelAnim = animate(animDuration, cubicOut, (progress) => {
            const currentEndAngle = petalStartAngle + (petalEndAngle - petalStartAngle) * progress;
            const currentOuterRadius = innerRadius + (targetOuterRadius - innerRadius) * progress;
            petalPath.attr('d', arcGen({
              startAngle: petalStartAngle,
              endAngle: currentEndAngle,
              innerRadius: innerRadius,
              outerRadius: currentOuterRadius,
            }));
          }, () => {
            // Ensure final state is exact
            petalPath.attr('d', arcGen({
              startAngle: petalStartAngle,
              endAngle: petalEndAngle,
              innerRadius: innerRadius,
              outerRadius: targetOuterRadius,
            }));
          });
        }, delay);

        this.cancelAnimations.push(() => {
          if (timeoutId !== null) clearTimeout(timeoutId);
          cancelAnim?.();
        });
      } else {
        // No animation: render final state directly
        petalPath.attr('d', arcGen({
          startAngle: petalStartAngle,
          endAngle: petalEndAngle,
          innerRadius: innerRadius,
          outerRadius: targetOuterRadius,
        }));
      }

      // ── Hover: springScale bloom + inner glow ─────────────────
      const petalNode = petalPath.node();
      if (petalNode) {
        let hoverCancel: (() => void) | null = null;

        petalNode.addEventListener('mouseenter', (event: MouseEvent) => {
          hoverCancel?.();
          hoverCancel = springScale(petalNode, 0, 300, 1, 1.06);
          petalPath.attr('fill-opacity', 1);
          petalPath.style('filter', 'url(#petal-inner-glow) brightness(1.15)');
          this.showPetalTooltip(datum, totalValue, event);
        });

        petalNode.addEventListener('mousemove', (event: MouseEvent) => {
          this.moveTooltip(event);
        });

        petalNode.addEventListener('mouseleave', () => {
          hoverCancel?.();
          hoverCancel = springScale(petalNode, 0, 300, 1.06, 1);
          petalPath.attr('fill-opacity', fmt.opacity / 100);
          petalPath.style('filter', null);
          this.hideTooltip();
        });

        // Ensure hover animations are cleaned up on destroy
        this.cancelAnimations.push(() => {
          hoverCancel?.();
        });
      }

      // ── Inner Labels (inside petals) ────────────────────────────
      if (showInnerLabels && fmt.showLabels) {
        const midAngle = (petalStartAngle + petalEndAngle) / 2;
        const labelRadius = innerRadius + (targetOuterRadius - innerRadius) * 0.65;
        const labelX = labelRadius * Math.sin(midAngle);
        const labelY = -labelRadius * Math.cos(midAngle);

        // Only show labels if petal is large enough
        if (targetOuterRadius - innerRadius > 20) {
          const polarLabelFontSize = s.labelSettings.fontSize.value;
          const polarLabelFontFamily = resolveDropdown(s.labelSettings.fontFamily);
          const polarLabelFontWeight = resolveDropdown(s.labelSettings.fontWeight);
          const labelEl = petalGroup.append('text')
            .attr('class', 'polar-label')
            .attr('x', labelX)
            .attr('y', labelY)
            .attr('dy', '0.35em')
            .attr('fill', s.labelSettings.labelColor.value?.value || '#FFFFFF')
            .attr('font-size', `${polarLabelFontSize}px`)
            .text(datum.label);
          if (polarLabelFontFamily) labelEl.attr('font-family', polarLabelFontFamily);
          if (polarLabelFontWeight) labelEl.attr('font-weight', polarLabelFontWeight);

          if (animEnabled) {
            labelEl.attr('opacity', 0);
            const labelDelay = (i * 60) + animDuration * 0.6;
            let labelTimeoutId: ReturnType<typeof setTimeout> | null = null;
            let cancelLabelAnim: (() => void) | null = null;

            labelTimeoutId = setTimeout(() => {
              cancelLabelAnim = animate(DURATION.fast, cubicOut, (progress) => {
                labelEl.attr('opacity', progress * 0.8);
              });
            }, labelDelay);

            this.cancelAnimations.push(() => {
              if (labelTimeoutId !== null) clearTimeout(labelTimeoutId);
              cancelLabelAnim?.();
            });
          }
        }
      }

      // ── Radial Labels (outside petals at outer edge) ─────────
      if (showRadialLabels && fmt.showLabels) {
        const midAngle = (petalStartAngle + petalEndAngle) / 2;
        const radialLabelRadius = targetOuterRadius + 16;
        const rlX = radialLabelRadius * Math.sin(midAngle);
        const rlY = -radialLabelRadius * Math.cos(midAngle);

        // Determine text-anchor based on angle position
        const angleDeg = ((midAngle * 180) / Math.PI + 360) % 360;
        let textAnchor = 'middle';
        if (angleDeg > 30 && angleDeg < 150) textAnchor = 'start';
        else if (angleDeg > 210 && angleDeg < 330) textAnchor = 'end';
        const absoluteX = cx + rlX;
        const availableWidth = textAnchor === 'start'
          ? width - absoluteX - 4
          : textAnchor === 'end'
            ? absoluteX - 4
            : Math.min(absoluteX - 4, width - absoluteX - 4) * 2;
        const visibleLabel = truncateText(
          datum.label,
          Math.max(12, availableWidth),
          categoryLabelFontSize,
        );

        const radialLabel = petalGroup.append('text')
          .attr('class', 'polar-radial-label')
          .attr('x', rlX)
          .attr('y', rlY)
          .attr('dy', '0.35em')
          .attr('text-anchor', textAnchor)
          .attr('font-size', `${categoryLabelFontSize}px`)
          .attr('fill', s.labelSettings.labelColor.value?.value || '#475569')
          .text(visibleLabel);
        if (visibleLabel !== datum.label) {
          radialLabel.append('title').text(datum.label);
        }
        const radialFontFamily = resolveDropdown(s.labelSettings.fontFamily);
        const radialFontWeight = resolveDropdown(s.labelSettings.fontWeight);
        if (radialFontFamily) radialLabel.attr('font-family', radialFontFamily);
        if (radialFontWeight) radialLabel.attr('font-weight', radialFontWeight);

        if (animEnabled) {
          radialLabel.attr('opacity', 0);
          const rlDelay = (i * 60) + animDuration * 0.7;
          let rlTimeoutId: ReturnType<typeof setTimeout> | null = null;
          let cancelRlAnim: (() => void) | null = null;

          rlTimeoutId = setTimeout(() => {
            cancelRlAnim = animate(DURATION.fast, cubicOut, (progress) => {
              radialLabel.attr('opacity', progress);
            });
          }, rlDelay);

          this.cancelAnimations.push(() => {
            if (rlTimeoutId !== null) clearTimeout(rlTimeoutId);
            cancelRlAnim?.();
          });
        }
      }
    });

    // ── Value labels outside petals ────────────────────────────
    if (s.dataLabelFormattingCard.showDataLabels.value) {
      const valueLabelColor = s.dataLabelFormattingCard.dataLabelFontColor.value?.value || '#475569';
      const valueLabelSize = s.dataLabelFormattingCard.dataLabelFontSize.value;

      data.forEach((datum, i) => {
        const fmt = resolveSeriesFormatting(this.settings.seriesFormattingCard, i, datum.color);
        if (!fmt.showLabels) return;
        const petalStartAngle = startAngleOffset + i * angleStep;
        const petalEndAngle = startAngleOffset + (i + 1) * angleStep;
        const targetOuterRadius = innerRadius + ((datum.value / maxValue) * (maxOuterRadius - innerRadius));
        const midAngle = (petalStartAngle + petalEndAngle) / 2;
        const tooltipRadius = targetOuterRadius + 14;
        const tooltipX = tooltipRadius * Math.sin(midAngle);
        const tooltipY = -tooltipRadius * Math.cos(midAngle);

        // Value label outside the petal
        if (targetOuterRadius - innerRadius > 15) {
          const valLabel = g.append('text')
            .attr('class', 'polar-value-label')
            .attr('x', tooltipX)
            .attr('y', tooltipY)
            .attr('dy', '0.35em')
            .attr('text-anchor', 'middle')
            .attr('font-size', `${valueLabelSize}px`)
            .attr('font-weight', '600')
            .attr('fill', valueLabelColor)
            .text(formatWithSettings(datum.value, this.settings.numberFormattingCard));

          if (animEnabled) {
            valLabel.attr('opacity', 0);
            const valDelay = (i * 60) + s.animationSettings.duration.value * 0.8;
            let valTimeoutId: ReturnType<typeof setTimeout> | null = null;
            let cancelValAnim: (() => void) | null = null;

            valTimeoutId = setTimeout(() => {
              cancelValAnim = animate(DURATION.fast, cubicOut, (progress) => {
                valLabel.attr('opacity', progress);
              });
            }, valDelay);

            this.cancelAnimations.push(() => {
              if (valTimeoutId !== null) clearTimeout(valTimeoutId);
              cancelValAnim?.();
            });
          }
        }
      });
    }

    // ── Center dot decoration ───────────────────────────────────
    if (innerRadius > 5) {
      g.append('circle')
        .attr('cx', 0)
        .attr('cy', 0)
        .attr('r', innerRadius * 0.3)
        .attr('fill', '#94A3B8')
        .attr('fill-opacity', 0.15);
    }

    // ── Entrance Animation (overall fade) ───────────────────────
    if (animEnabled) {
      const svgNode = svg.node();
      if (svgNode instanceof HTMLElement) {
        const cancelFade = fadeSlideIn(svgNode, 'up', DURATION.fast, 50);
        this.cancelAnimations.push(cancelFade);
      }
    }

    // Apply shared formatting settings
    applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.polar-value-label');

    // ── Legend ────────────────────────────────────────────────────
    if (s.legendFormattingCard.showLegend.value) {
      this.renderSharedLegend(data);
    }

    this.applyAccessibility(data.length);
    this.applyCrossHighlight();
    this.applyHighContrast();
    this.container.addEventListener('click', this.handleBackgroundClick);
  }

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  // ── Legend Rendering ────────────────────────────────────────

  private renderSharedLegend(data: PetalDatum[]): void {
    const legendFmtCard = this.settings.legendFormattingCard;
    const rawFontColor = legendFmtCard.legendFontColor.value?.value;
    const legendFontColor = rawFontColor != null && rawFontColor.length > 0 ? rawFontColor : '';
    const legendFontSize = legendFmtCard.legendFontSize.value;
    const position = this.getLegendPosition();

    const items: LegendItem[] = data.map((d, i) => {
      const sf = resolveSeriesFormatting(this.settings.seriesFormattingCard, i, d.color);
      return { label: d.label, color: sf.color };
    });

    const rawLegendFontFamily = resolveDropdown(legendFmtCard.legendFontFamily) || undefined;

    renderLegend(this.container, {
      items,
      position,
      fontSize: legendFontSize,
      fontColor: legendFontColor,
      fontFamily: rawLegendFontFamily,
      fontWeight: resolveDropdown(legendFmtCard.legendFontWeight) || 'normal',
      aliases: legendFmtCard.legendAliases.value,
    });
  }

  private getLegendPosition(): 'top' | 'bottom' | 'left' | 'right' {
    const val = this.settings.legendFormattingCard.legendPosition.value?.value;
    const validPositions = ['bottom', 'top', 'left', 'right'] as const;
    if (typeof val === 'string' && (validPositions as readonly string[]).includes(val)) {
      return val as 'top' | 'bottom' | 'left' | 'right';
    }
    return 'bottom';
  }

  // ── Cross-Highlight ──────────────────────────────────────────────

  private applyCrossHighlight(): void {
    const data = this.currentData;
    if (!data) return;

    const hasHighlights = data.hasHighlights;
    const hasSelection = this.selectionManager.hasSelection();
    const selectedIds = this.selectionManager.getSelectionIds() as ISelectionId[];
    const selectedKeys = new Set(selectedIds.map((id) => id.getKey()));

    const highlightedKeys = new Set<string>();
    if (hasHighlights) {
      for (const petal of data.petals) {
        if (petal.highlighted) {
          highlightedKeys.add(petal.selectionId.getKey());
        }
      }
    }

    const petals = this.container.querySelectorAll<SVGPathElement>('.polar-petal');
    const shouldDim = hasSelection || hasHighlights;

    for (const el of Array.from(petals)) {
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

  private handleBackgroundClick = (): void => {
    if (!this.interactionsEnabled) return;
    void this.selectionManager.clear().then(() => this.applyCrossHighlight());
  };

  private showPetalTooltip(datum: PetalDatum, totalValue: number, event: MouseEvent): void {
    const tooltipData: VisualTooltipDataItem[] = [
      { displayName: 'Category', value: datum.label },
      { displayName: 'Value', value: formatWithSettings(datum.value, this.settings.numberFormattingCard) },
    ];

    if (totalValue > 0) {
      const pctOfTotal = (datum.value / totalValue) * 100;
      tooltipData.push({ displayName: '% of Total', value: `${pctOfTotal.toFixed(1)}%` });
    }

    this.host.tooltipService.show({
      dataItems: tooltipData,
      identities: [datum.selectionId],
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

  /**
   * Lightens a hex color by a given amount (0 = no change, 1 = white).
   */
  private lightenColor(hex: string, amount: number): string {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);

    const lr = Math.round(r + (255 - r) * amount);
    const lg = Math.round(g + (255 - g) * amount);
    const lb = Math.round(b + (255 - b) * amount);

    return `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`;
  }

  // ── Conditional Formatting ───────────────────────────────────

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

  // ── Accessibility ──────────────────────────────────────────────

  private applyAccessibility(dataPointCount: number): void {
    const acc = this.settings.accessibilityFormattingCard;
    if (!acc.enableKeyboardNav.value) return;
    ensureFocusRingStyles();
    applyChartAria(this.container, {
      chartType: 'polar chart',
      title: this.settings.titleFormattingCard?.titleText?.value || undefined,
      dataPointCount,
    });
    this.keyboardNavCleanup = attachKeyboardNav({
      container: this.container,
      itemSelector: '.polar-petal',
      onActivate: (el) => {
        el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      },
    });
  }

  private applyHighContrast(): void {
    const colors = getHostHighContrastColors(this.host);
    applyBasicHighContrastStyles(this.container, colors, {
      textSelectors: ['svg text', '.chart-title', '.chart-subtitle', '.pbi-shared-legend span', '.polar-empty'],
      fillSelectors: ['.polar-petal'],
      strokeSelectors: ['.polar-grid circle', '.polar-axis-lines line'],
    });
    if (!colors.enabled) return;
    this.container.style.background = colors.background;
    this.container.style.boxShadow = 'none';
  }

  public destroy(): void {
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.keyboardNavCleanup?.();
    this.keyboardNavCleanup = null;
    this.hideTooltip();
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];
  }
}
