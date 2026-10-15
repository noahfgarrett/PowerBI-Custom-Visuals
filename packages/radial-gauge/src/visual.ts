/**
 * Radial Gauge Pro -- Power BI IVisual implementation.
 * Bridges PBI data/lifecycle with the D3 rendering engine.
 */

import powerbi from 'powerbi-visuals-api';
import * as d3 from 'd3';
import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel';
import { RadialGaugeSettings } from './settings';
import {
  formatWithSettings,
  countUp,
  sweepArc,
  fadeSlideIn,
  applyCardStyle,
  type CardStyleMode,
  withOpacity,
  renderChartTitle,
  resolveConditionalColor,
  buildConditionalConfig,
  resolveDropdown,
  applyChartAria,
  applyDataPointAria,
  attachKeyboardNav,
  ensureFocusRingStyles,
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
  hideInlineLegendFormatting,
  attachEmptySpaceContextMenu,
  allowInteractions,
  notifyRenderingStarted,
  notifyRenderingFinished,
  notifyRenderingFailed,
  getVisualEmptyStateMode,
  getLocalizedString,
  renderLandingPage,
  renderNoDataState,
  getHostHighContrastColors,
  applyBasicHighContrastStyles,
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

/** Arc thickness presets in px (fraction of radius). */
const THICKNESS_MAP: Record<string, number> = {
  thin: 0.10,
  medium: 0.18,
  thick: 0.28,
};

// ── Data Interface ───────────────────────────────────────────────────

interface RadialGaugeData {
  value: number | null;
  target: number | null;
  min: number;
  max: number;
  trend: number[];
  selectionId: ISelectionId | null;
  /** Whether the value measure is cross-highlighted from another visual. */
  highlighted: boolean;
  /** Whether cross-highlight data is present from another visual/slicer. */
  hasHighlights: boolean;
}

// ── Visual Class ─────────────────────────────────────────────────────

export class RadialGaugeVisual implements IVisual {
  private host: IVisualHost;
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private container: HTMLElement;
  private settings: RadialGaugeSettings;
  private formattingSettingsService: FormattingSettingsService;
  private previousValue: number | null = null;
  private cancelAnimations: Array<() => void> = [];
  private currentData: RadialGaugeData | null = null;
  private emptyStateMode: 'unconfigured' | 'noData' = 'unconfigured';
  private handleBackgroundClick: () => void;
  private previousCenterMetric: number | null = null;

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new RadialGaugeSettings();
    this.formattingSettingsService = new FormattingSettingsService(options.host.createLocalizationManager());
    this.container.classList.add('radial-gauge-container');
    attachEmptySpaceContextMenu(this.container, this.selectionManager, () =>
      this.host.createSelectionIdBuilder().createSelectionId(),
      () => allowInteractions(this.host),
    );

    this.handleBackgroundClick = (): void => {
      if (!allowInteractions(this.host)) return;
      void this.selectionManager.clear().then(() => {
        this.applySelectionHighlight();
      });
    };
    this.container.addEventListener('click', this.handleBackgroundClick);
  }

  public update(options: VisualUpdateOptions): void {
    notifyRenderingStarted(this.host, options);
    try {
      // Cancel any running animations from previous render
      this.cancelAnimations.forEach((cancel) => cancel());
      this.cancelAnimations = [];

      // Parse settings from dataView
      const dataView = options.dataViews?.[0];
      const hasValueRole = dataView?.metadata?.columns?.some((column) => column.roles?.['value']) ?? false;
      this.emptyStateMode = hasValueRole ? getVisualEmptyStateMode(dataView) : 'unconfigured';
      if (dataView) {
        this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
          RadialGaugeSettings,
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

      const categoryColumn = dataView?.categorical?.categories?.[0];
      const hasTrendAxis = Boolean(categoryColumn);
      const hasDateAxis = Boolean(categoryColumn && isDateColumn(categoryColumn.source));
      const hasTargetRole = dataView?.metadata?.columns?.some((column) => column.roles?.['target']) ?? false;
      this.settings.dateFilterFormattingCard.visible = hasDateAxis;
      syncDateFilterFormattingVisibility(this.settings.dateFilterFormattingCard);
      if (!hasDateAxis) {
        this.settings.dateFilterFormattingCard.startDate.visible = false;
        this.settings.dateFilterFormattingCard.endAtCurrentDate.visible = false;
        this.settings.dateFilterFormattingCard.endDate.visible = false;
      }

      // Conditional visibility: hide needle sub-settings when showNeedle is off
      this.settings.needleSettings.color.visible = this.settings.needleSettings.show.value;
      this.settings.needleSettings.width.visible = this.settings.needleSettings.show.value;
      this.settings.needleSettings.showHub.visible = this.settings.needleSettings.show.value;
      this.settings.needleSettings.hubRadius.visible = this.settings.needleSettings.show.value
        && this.settings.needleSettings.showHub.value;

      // Conditional visibility: hide segment count when LED segments is off
      this.settings.arcSettings.segmentCount.visible = this.settings.arcSettings.segmented.value;
      this.settings.arcSettings.arcRange.visible = (resolveDropdown(this.settings.arcSettings.startAngle) ?? 'custom') === 'custom';
      this.settings.valueSettings.customText.visible = (resolveDropdown(this.settings.valueSettings.displayMode) ?? 'value') === 'custom';
      this.settings.valueSettings.customCaption.visible = (resolveDropdown(this.settings.valueSettings.captionMode) ?? 'auto') === 'custom';
      this.settings.valueSettings.captionFontSize.visible = (resolveDropdown(this.settings.valueSettings.captionMode) ?? 'auto') !== 'none';
      this.settings.valueSettings.captionFontColor.visible = (resolveDropdown(this.settings.valueSettings.captionMode) ?? 'auto') !== 'none';

      syncCardStyleVisibility(this.settings.cardSettings);

      this.settings.targetSettings.visible = hasTargetRole;
      this.settings.targetSettings.color.visible = this.settings.targetSettings.show.value;
      this.settings.targetSettings.lineWidth.visible = this.settings.targetSettings.show.value;
      this.settings.gaugeScaleSettings.majorTicks.visible = this.settings.gaugeScaleSettings.showTicks.value
        || this.settings.gaugeScaleSettings.showLabels.value;
      this.settings.gaugeScaleSettings.minorTicks.visible = this.settings.gaugeScaleSettings.showTicks.value;
      this.settings.gaugeScaleSettings.majorTickColor.visible = this.settings.gaugeScaleSettings.showTicks.value;
      this.settings.gaugeScaleSettings.minorTickColor.visible = this.settings.gaugeScaleSettings.showTicks.value;
      this.settings.gaugeScaleSettings.labelFontSize.visible = this.settings.gaugeScaleSettings.showLabels.value;
      this.settings.gaugeScaleSettings.labelFontColor.visible = this.settings.gaugeScaleSettings.showLabels.value;
      this.settings.gaugeScaleSettings.labelFontFamily.visible = this.settings.gaugeScaleSettings.showLabels.value;
      this.settings.gaugeScaleSettings.labelFontWeight.visible = this.settings.gaugeScaleSettings.showLabels.value;
      this.settings.gaugeScaleSettings.labelOffset.visible = this.settings.gaugeScaleSettings.showLabels.value;
      this.settings.gaugeComparisonSettings.visible = hasTargetRole || hasTrendAxis;
      this.settings.gaugeComparisonSettings.showDelta.visible = hasTargetRole;
      this.settings.gaugeComparisonSettings.showSparkline.visible = hasTrendAxis;
      this.settings.gaugeComparisonSettings.deltaPositiveColor.visible = hasTargetRole
        && this.settings.gaugeComparisonSettings.showDelta.value;
      this.settings.gaugeComparisonSettings.deltaNegativeColor.visible = hasTargetRole
        && this.settings.gaugeComparisonSettings.showDelta.value;
      this.settings.animationSettings.duration.visible = this.settings.animationSettings.enabled.value;
      const conditionalEnabled = this.settings.conditionalFormattingCard.enableConditional.value;
      this.settings.conditionalFormattingCard.conditionalDirection.visible = conditionalEnabled;
      this.settings.conditionalFormattingCard.threshold1.visible = conditionalEnabled;
      this.settings.conditionalFormattingCard.threshold2.visible = conditionalEnabled;
      this.settings.conditionalFormattingCard.conditionalColor1.visible = conditionalEnabled;
      this.settings.conditionalFormattingCard.conditionalColor2.visible = conditionalEnabled;
      this.settings.conditionalFormattingCard.conditionalColor3.visible = conditionalEnabled;

      // Extract data
      const data = this.extractData(dataView);
      this.currentData = data;

      const highContrast = getHostHighContrastColors(this.host);
      this.render(data, options.viewport, highContrast);
      applyBasicHighContrastStyles(this.container, highContrast, {
        textSelectors: ['svg text', '.radial-gauge-empty', '.pbi-landing-page-title', '.pbi-landing-page-description', '.pbi-landing-page-hint', '.pbi-landing-page li'],
        fillSelectors: ['.radial-gauge-track', '.pbi-landing-page'],
        strokeSelectors: ['.radial-gauge-target-tick', '.radial-gauge-needle'],
      });
      if (highContrast.enabled) {
        this.container.querySelectorAll<SVGPathElement>('.radial-gauge-zone, .radial-gauge-segment').forEach((element) => {
          element.setAttribute('fill', highContrast.foregroundSelected);
        });
      }
      notifyRenderingFinished(this.host, options);
    } catch (error) {
      notifyRenderingFailed(this.host, options, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private extractData(dataView: DataView | undefined): RadialGaugeData {
    const result: RadialGaugeData = {
      value: null,
      target: null,
      min: 0,
      max: 100,
      trend: [],
      selectionId: null,
      highlighted: false,
      hasHighlights: false,
    };

    if (!dataView?.categorical) return result;

    const categoryColumn = dataView.categorical.categories?.[0];
    const dateConfig: DateFilterConfig = {
      enabled: this.settings.dateFilterFormattingCard.enableDateFilter.value,
      startDate: this.settings.dateFilterFormattingCard.startDate.value,
      endAtCurrentDate: this.settings.dateFilterFormattingCard.endAtCurrentDate.value,
      endDate: this.settings.dateFilterFormattingCard.endDate.value,
    };
    const dateIndices = categoryColumn && isDateColumn(categoryColumn.source) ? getDateFilterIndices(categoryColumn.values, dateConfig) : null;

    const values = dataView.categorical.values;
    if (!values) return result;

    const findLastIncludedNumber = (columnValues: ReadonlyArray<unknown>): { value: number; index: number } | null => {
      for (let i = columnValues.length - 1; i >= 0; i--) {
        if (dateIndices && !dateIndices.has(i)) continue;
        const value = columnValues[i];
        if (typeof value === 'number' && Number.isFinite(value)) {
          return { value, index: i };
        }
      }
      return null;
    };

    let valueQueryName = '';
    let currentValueIndex: number | null = null;

    for (const col of values) {
      const role = col.source.roles;
      if (!role) continue;

      if (role['value'] && col.values.length > 0) {
        const current = findLastIncludedNumber(col.values);
        result.value = current?.value ?? null;
        currentValueIndex = current?.index ?? null;
        valueQueryName = col.source.queryName ?? '';
        // Collect all value rows for trend sparkline
        result.trend = col.values
          .filter((v, i): v is number => typeof v === 'number'
            && Number.isFinite(v)
            && (!dateIndices || dateIndices.has(i)));

        // Cross-highlight: check if the value measure has highlight data
        const hlRaw = (col as unknown as { highlights?: unknown }).highlights as unknown[] | undefined;
        if (hlRaw) {
          const hasAnyHighlight = hlRaw.some((h, i) =>
            (!dateIndices || dateIndices.has(i)) && h !== null && h !== undefined,
          );
          if (hasAnyHighlight) {
            result.hasHighlights = true;
            const currentHighlight = current ? hlRaw[current.index] : undefined;
            result.highlighted = currentHighlight !== null && currentHighlight !== undefined;
          }
        }
      }

      if (role['target'] && col.values.length > 0) {
        result.target = findLastIncludedNumber(col.values)?.value ?? null;
      }

      if (role['minValue'] && col.values.length > 0) {
        const current = findLastIncludedNumber(col.values);
        if (current) result.min = current.value;
      }

      if (role['maxValue'] && col.values.length > 0) {
        const current = findLastIncludedNumber(col.values);
        if (current) result.max = current.value;
      }
    }

    if (categoryColumn && currentValueIndex !== null) {
      result.selectionId = this.host.createSelectionIdBuilder()
        .withCategory(categoryColumn, currentValueIndex)
        .createSelectionId();
    } else if (valueQueryName) {
      result.selectionId = this.host.createSelectionIdBuilder()
        .withMeasure(valueQueryName)
        .createSelectionId();
    }

    // Ensure min < max
    if (result.min >= result.max) {
      result.min = 0;
      result.max = 100;
    }

    return result;
  }

  private render(
    data: RadialGaugeData,
    viewport: powerbi.IViewport,
    highContrast: ReturnType<typeof getHostHighContrastColors>,
  ): void {
    this.hideTooltip();

    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    renderChartTitle(this.container, this.settings.titleFormattingCard);

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

    // Empty state: no value provided
    if (data.value === null) {
      if (this.emptyStateMode === 'noData') {
        renderNoDataState(
          this.container,
          getLocalizedString(this.host, 'RadialGauge_NoDataState', 'No data for the current selection.'),
          highContrast,
        );
      } else {
        renderLandingPage(this.container, {
          title: getLocalizedString(this.host, 'RadialGauge_LandingTitle', 'Add a value to build a radial gauge'),
          description: getLocalizedString(this.host, 'RadialGauge_LandingDescription', 'Bind a value measure, then optionally add a target, range, or trend axis.'),
          steps: [
            getLocalizedString(this.host, 'RadialGauge_LandingStepValue', 'Value'),
            getLocalizedString(this.host, 'RadialGauge_LandingStepTarget', 'Optional target'),
            getLocalizedString(this.host, 'RadialGauge_LandingStepTrend', 'Optional trend axis'),
          ],
        }, highContrast);
      }
      this.previousValue = null;
      this.previousCenterMetric = null;
      return;
    }

    // ── Dimensions ──────────────────────────────────────────────
    const width = Math.max(0, viewport.width - (contentPadding * 2));
    const height = Math.max(0, viewport.height - (contentPadding * 2));
    const size = Math.min(width, height);
    const cx = width / 2;
    const cy = height / 2;
    const outerRadius = size * 0.42;

    const thicknessKey = s.arcSettings.thickness.value?.value ?? 'medium';
    const thicknessFraction = THICKNESS_MAP[thicknessKey] ?? THICKNESS_MAP['medium'];
    const arcWidth = outerRadius * thicknessFraction;
    const innerRadius = outerRadius - arcWidth;

    const arcPreset = resolveDropdown(s.arcSettings.startAngle) ?? 'custom';
    const effectiveRange = arcPreset === 'half'
      ? 180
      : arcPreset === 'full'
        ? 360
        : s.arcSettings.arcRange.value;
    const customArcRange = Math.max(30, Math.min(360, effectiveRange));
    const halfSweep = customArcRange / 2;
    const startAngleRad = -halfSweep * DEG_TO_RAD;
    const endAngleRad = halfSweep * DEG_TO_RAD;
    // Keep rangeKey for text positioning heuristic
    const rangeKey = customArcRange <= 180 ? 'half' : 'full';

    // ── SVG Setup ───────────────────────────────────────────────
    const svg = d3.select(this.container)
      .append('svg')
      .attr('class', 'radial-gauge-svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    const g = svg.append('g')
      .attr('transform', `translate(${cx}, ${cy})`);

    // ── D3 Arc Generator (optionally with rounded ends) ─────────
    const arcGen = d3.arc<{ startAngle: number; endAngle: number }>()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius)
      .cornerRadius(s.arcSettings.roundedCaps.value ? arcWidth / 2 : 0);

    // ── Background Track ────────────────────────────────────────
    g.append('path')
      .attr('class', 'radial-gauge-track')
      .attr('d', arcGen({
        startAngle: startAngleRad,
        endAngle: endAngleRad,
      }))
      .attr('fill', s.arcColorSettings.trackColor.value?.value ?? '#94A3B8')
      .attr('opacity', this.settings.arcColorSettings.trackOpacity.value / 100);

    // ── Color Zones ─────────────────────────────────────────────
    const { min, max } = data;
    const totalRange = max - min;
    const clampedValue = Math.max(min, Math.min(max, data.value));
    const normalizedValue = (clampedValue - min) / totalRange; // 0..1

    const firstZonePct = Math.max(0, Math.min(100, s.zoneSettings.zone1Threshold.value)) / 100;
    const secondZonePct = Math.max(0, Math.min(100, s.zoneSettings.zone2Threshold.value)) / 100;
    const zone1Pct = Math.min(firstZonePct, secondZonePct);
    const zone2Pct = Math.max(firstZonePct, secondZonePct);

    const themeName = resolveColorTheme(s.colorThemeFormattingCard);
    const zone1Color = themeName !== 'default'
      ? getHostChartColor(this.host.colorPalette, 0, themeName)
      : (s.zoneSettings.zone1Color.value?.value ?? '#F87171');
    const zone2Color = themeName !== 'default'
      ? getHostChartColor(this.host.colorPalette, 1, themeName)
      : (s.zoneSettings.zone2Color.value?.value ?? '#FBBF24');
    const zone3Color = themeName !== 'default'
      ? getHostChartColor(this.host.colorPalette, 2, themeName)
      : (s.zoneSettings.zone3Color.value?.value ?? '#34D399');

    // Determine which color the current value falls into
    const zoneColor = normalizedValue <= zone1Pct
      ? zone1Color
      : normalizedValue <= zone2Pct
        ? zone2Color
        : zone3Color;

    // Conditional formatting overrides zone colors if enabled
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
    const valueColor = resolveConditionalColor(data.value, conditionalConfig) ?? zoneColor;

    // Value arc angle
    const totalSweep = endAngleRad - startAngleRad;
    const valueEndAngle = startAngleRad + totalSweep * normalizedValue;

    // Render value arc — optionally as LED-style segments
    const isSegmented = s.arcSettings.segmented.value;
    const segmentCount = Math.max(2, Math.min(100, s.arcSettings.segmentCount.value));

    if (isSegmented) {
      // LED-style segmented arc: draw individual segment arcs
      const segGap = 0.008; // radians gap between segments
      const segSweep = (totalSweep - segGap * segmentCount) / segmentCount;
      const litSegments = Math.round(normalizedValue * segmentCount);

      // Non-rounded arc generator for segments
      const segArcGen = d3.arc<{ startAngle: number; endAngle: number }>()
        .innerRadius(innerRadius)
        .outerRadius(outerRadius)
        .cornerRadius(0);

      for (let i = 0; i < segmentCount; i++) {
        const segStart = startAngleRad + i * (segSweep + segGap);
        const segEnd = segStart + segSweep;
        const isLit = i < litSegments;

        g.append('path')
          .attr('class', 'radial-gauge-segment')
          .attr('d', segArcGen({ startAngle: segStart, endAngle: segEnd }))
          .attr('fill', isLit ? valueColor : (s.arcColorSettings.trackColor.value?.value ?? '#94A3B8'))
          .attr('opacity', isLit ? 1 : (s.arcColorSettings.trackOpacity.value / 100));
      }
    } else {
      // Continuous value arc
      const valueArcPath = g.append('path')
        .attr('class', 'radial-gauge-zone')
        .attr('data-selection-key', data.selectionId?.getKey() ?? '')
        .attr('fill', valueColor)
        .attr('stroke', 'none');
      valueArcPath.style('transition', 'filter 0.2s ease');

      if (s.animationSettings.enabled.value) {
        // Start from no sweep, animate to target angle
        valueArcPath.attr('d', arcGen({
          startAngle: startAngleRad,
          endAngle: startAngleRad,
        }));

        const cancelSweep = sweepArc(
          startAngleRad,
          valueEndAngle,
          s.animationSettings.duration.value,
          (currentAngle) => {
            valueArcPath.attr('d', arcGen({
              startAngle: startAngleRad,
              endAngle: currentAngle,
            }));
          }
        );
        this.cancelAnimations.push(cancelSweep);
      } else {
        valueArcPath.attr('d', arcGen({
          startAngle: startAngleRad,
          endAngle: valueEndAngle,
        }));
      }
    }

    // A full-arc hit target keeps segmented gauges and zero values interactive.
    const hitArea = g.append('path')
      .attr('class', 'radial-gauge-hit-area')
      .attr('d', arcGen({ startAngle: startAngleRad, endAngle: endAngleRad }))
      .attr('fill', 'transparent')
      .attr('data-selection-key', data.selectionId?.getKey() ?? '')
      .style('pointer-events', 'all')
      .style('cursor', allowInteractions(this.host) ? 'pointer' : 'default');

    hitArea
      .on('mouseenter', (event: MouseEvent) => {
        g.selectAll<SVGPathElement, unknown>('.radial-gauge-zone, .radial-gauge-segment')
          .style('filter', `brightness(1.18) drop-shadow(0 0 4px ${valueColor})`);
        this.showGaugeTooltip(data, event);
      })
      .on('mousemove', (event: MouseEvent) => this.moveTooltip(event))
      .on('mouseleave', () => {
        this.hideTooltip();
        this.applySelectionHighlight();
      })
      .on('click', (event: MouseEvent) => {
        if (!allowInteractions(this.host) || !data.selectionId) return;
        event.stopPropagation();
        void this.selectionManager.select(data.selectionId, event.ctrlKey || event.metaKey).then(() => {
          this.applySelectionHighlight();
        });
      })
      .on('contextmenu', (event: MouseEvent) => {
        if (!allowInteractions(this.host) || !data.selectionId) return;
        event.preventDefault();
        event.stopPropagation();
        void this.selectionManager.showContextMenu(data.selectionId, {
          x: event.clientX,
          y: event.clientY,
        });
      });

    // ── Zone boundary ticks (subtle marks at zone thresholds) ───
    const drawZoneBoundary = (pct: number, color: string): void => {
      if (pct <= 0 || pct >= 1) return;
      const angle = startAngleRad + totalSweep * pct;
      const tickInner = innerRadius - 2;
      const tickOuter = outerRadius + 2;

      g.append('line')
        .attr('x1', tickInner * Math.cos(angle - Math.PI / 2))
        .attr('y1', tickInner * Math.sin(angle - Math.PI / 2))
        .attr('x2', tickOuter * Math.cos(angle - Math.PI / 2))
        .attr('y2', tickOuter * Math.sin(angle - Math.PI / 2))
        .attr('stroke', withOpacity(color, this.settings.arcColorSettings.zoneBorderOpacity.value / 100))
        .attr('stroke-width', this.settings.arcColorSettings.zoneBorderWidth.value);
    };

    drawZoneBoundary(zone1Pct, zone1Color);
    drawZoneBoundary(zone2Pct, zone2Color);

    // ── Target Tick ─────────────────────────────────────────────
    if (s.targetSettings.show.value && data.target !== null) {
      const clampedTarget = Math.max(min, Math.min(max, data.target));
      const normalizedTarget = (clampedTarget - min) / totalRange;
      const targetAngle = startAngleRad + totalSweep * normalizedTarget;

      const tickLength = arcWidth * 0.6;
      const midRadius = (innerRadius + outerRadius) / 2;
      const targetColor = s.targetSettings.color.value?.value ?? '#333333';

      // Rotate by -90 degrees since d3.arc uses 12-o'clock origin
      const cosA = Math.cos(targetAngle - Math.PI / 2);
      const sinA = Math.sin(targetAngle - Math.PI / 2);

      g.append('line')
        .attr('class', 'radial-gauge-target-tick')
        .attr('x1', (midRadius - tickLength) * cosA)
        .attr('y1', (midRadius - tickLength) * sinA)
        .attr('x2', (midRadius + tickLength) * cosA)
        .attr('y2', (midRadius + tickLength) * sinA)
        .attr('stroke', targetColor)
        .attr('stroke-width', s.targetSettings.lineWidth.value);
    }

    // ── Needle ───────────────────────────────────────────────────
    if (s.needleSettings.show.value) {
      const needleColor = s.needleSettings.color.value?.value ?? '#0F172A';
      const needleWidth = s.needleSettings.width.value;
      const needleLength = outerRadius * 0.85;

      // Needle group centered at gauge origin
      const needleGroup = g.append('g')
        .attr('class', 'radial-gauge-needle');

      // Draw tapered needle as a triangle path:
      // base at center (half-width each side, perpendicular), tip at needleLength
      const halfBase = needleWidth * 1.5;
      needleGroup.append('path')
        .attr('d', `M ${-halfBase},0 L 0,${-needleLength} L ${halfBase},0 Z`)
        .attr('fill', needleColor);

      // Optional hub circle at the center
      if (s.needleSettings.showHub.value) {
        const hubRadius = s.needleSettings.hubRadius.value;
        needleGroup.append('circle')
          .attr('cx', 0)
          .attr('cy', 0)
          .attr('r', hubRadius)
          .attr('fill', needleColor);
      }

      // Needle angle: d3.arc uses 12-o'clock origin (0 = up), so rotation
      // in degrees is just the angle in degrees (no -90 offset needed since
      // we drew the needle pointing up along -Y axis).
      const startAngleDeg = -halfSweep;
      const valueAngleDeg = startAngleDeg + (normalizedValue * customArcRange);

      if (s.animationSettings.enabled.value) {
        // Start at the arc's start angle, animate to the value angle
        needleGroup.attr('transform', `rotate(${startAngleDeg})`);

        const cancelNeedle = sweepArc(
          startAngleDeg,
          valueAngleDeg,
          s.animationSettings.duration.value,
          (currentDeg) => {
            needleGroup.attr('transform', `rotate(${currentDeg})`);
          }
        );
        this.cancelAnimations.push(cancelNeedle);
      } else {
        needleGroup.attr('transform', `rotate(${valueAngleDeg})`);
      }
    }

    // ── Center Value Text ───────────────────────────────────────
    const fmt = (v: number | null | undefined): string => formatWithSettings(v as number, this.settings.numberFormattingCard);
    const centerContent = this.resolveCenterContent(data);

    const fontSize = s.valueSettings.fontSize.value;
    const fontColor = s.valueSettings.fontColor.value?.value || '#333333';

    // Offset the text upward for half-circle mode so it sits inside the arc
    const hasCaption = centerContent.captionText.length > 0;
    const textOffsetY = (rangeKey === 'half' ? -outerRadius * 0.15 : outerRadius * 0.05) - (hasCaption ? 6 : 0);

    const valueFontFamily = resolveDropdown(s.valueSettings.fontFamily);
    const valueFontWeight = resolveDropdown(s.valueSettings.fontWeight);

    const valueText = g.append('text')
      .attr('class', 'radial-gauge-value-text')
      .attr('x', 0)
      .attr('y', textOffsetY)
      .attr('font-size', `${fontSize}px`)
      .attr('fill', fontColor);

    if (valueFontFamily) valueText.attr('font-family', valueFontFamily);
    if (valueFontWeight) valueText.attr('font-weight', valueFontWeight);

    if (centerContent.isNumeric && s.animationSettings.enabled.value) {
      const from = this.previousCenterMetric ?? centerContent.numericValue;
      valueText.text(fmt(from));

      const cancelCount = countUp(
        from,
        centerContent.numericValue,
        s.animationSettings.duration.value,
        (v) => { valueText.text(fmt(v)); }
      );
      this.cancelAnimations.push(cancelCount);
    } else {
      valueText.text(centerContent.primaryText);
    }
    this.previousValue = data.value;
    this.previousCenterMetric = centerContent.isNumeric ? centerContent.numericValue : null;

    if (hasCaption) {
      g.append('text')
        .attr('class', 'radial-gauge-value-caption')
        .attr('x', 0)
        .attr('y', textOffsetY + fontSize * 0.72)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .attr('font-size', `${Math.max(9, s.valueSettings.captionFontSize.value)}px`)
        .attr('fill', s.valueSettings.captionFontColor.value?.value || '#64748B')
        .text(centerContent.captionText);
    }

    // ── Scale Ticks ──────────────────────────────────────────────
    const showScaleTicks = s.gaugeScaleSettings.showTicks.value;
    const showScaleLabels = s.gaugeScaleSettings.showLabels.value;
    if (showScaleTicks || showScaleLabels) {
      const majorCount = Math.max(2, s.gaugeScaleSettings.majorTicks.value);
      const minorPerMajor = Math.max(0, s.gaugeScaleSettings.minorTicks.value);
      const scaleLabelFontFamily = resolveDropdown(s.gaugeScaleSettings.labelFontFamily);
      const scaleLabelFontWeight = resolveDropdown(s.gaugeScaleSettings.labelFontWeight) ?? 'normal';
      const scaleLabelOffset = Math.max(10, s.gaugeScaleSettings.labelOffset.value);

      for (let i = 0; i < majorCount; i++) {
        const pct = i / (majorCount - 1);
        const angle = startAngleRad + totalSweep * pct;
        const cosA = Math.cos(angle - Math.PI / 2);
        const sinA = Math.sin(angle - Math.PI / 2);

        // Major tick
        if (showScaleTicks) {
          g.append('line')
            .attr('class', 'radial-gauge-major-tick')
            .attr('x1', (outerRadius + 3) * cosA)
            .attr('y1', (outerRadius + 3) * sinA)
            .attr('x2', (outerRadius + 8) * cosA)
            .attr('y2', (outerRadius + 8) * sinA)
            .attr('stroke', s.gaugeScaleSettings.majorTickColor.value?.value ?? '#64748B')
            .attr('stroke-width', 1.5);
        }

        // Scale label
        if (showScaleLabels) {
          const labelVal = min + totalRange * pct;
          const scaleLabel = g.append('text')
            .attr('class', 'radial-gauge-scale-label')
            .attr('x', (outerRadius + scaleLabelOffset) * cosA)
            .attr('y', (outerRadius + scaleLabelOffset) * sinA)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'central')
            .attr('font-size', `${Math.max(8, s.gaugeScaleSettings.labelFontSize.value)}px`)
            .attr('fill', s.gaugeScaleSettings.labelFontColor.value?.value || '#64748B')
            .text(formatWithSettings(labelVal, this.settings.numberFormattingCard));
          if (scaleLabelFontFamily) scaleLabel.attr('font-family', scaleLabelFontFamily);
          scaleLabel.attr('font-weight', scaleLabelFontWeight);
        }

        // Minor ticks between major ticks
        if (showScaleTicks && i < majorCount - 1 && minorPerMajor > 0) {
          for (let j = 1; j <= minorPerMajor; j++) {
            const minorPct = pct + (j / ((majorCount - 1) * (minorPerMajor + 1)));
            if (minorPct > 1) break;
            const minorAngle = startAngleRad + totalSweep * minorPct;
            const minorCos = Math.cos(minorAngle - Math.PI / 2);
            const minorSin = Math.sin(minorAngle - Math.PI / 2);

            g.append('line')
              .attr('class', 'radial-gauge-minor-tick')
              .attr('x1', (outerRadius + 3) * minorCos)
              .attr('y1', (outerRadius + 3) * minorSin)
              .attr('x2', (outerRadius + 5) * minorCos)
              .attr('y2', (outerRadius + 5) * minorSin)
              .attr('stroke', s.gaugeScaleSettings.minorTickColor.value?.value ?? '#94A3B8')
              .attr('stroke-width', 0.75);
          }
        }
      }
    }

    // ── Comparison: Delta Indicator ─────────────────────────────────
    if (s.gaugeComparisonSettings.showDelta.value && data.value !== null && data.target !== null) {
      const delta = data.value - data.target;
      const sign = delta >= 0 ? '+' : '';
      const deltaText = g.append('text')
        .attr('class', 'radial-gauge-delta')
        .attr('x', 0)
        .attr('y', textOffsetY + fontSize * 0.9)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .attr('font-size', `${Math.max(10, fontSize * 0.45)}px`)
        .attr('fill', delta >= 0 ? (s.gaugeComparisonSettings.deltaPositiveColor.value?.value ?? '#22C55E') : (s.gaugeComparisonSettings.deltaNegativeColor.value?.value ?? '#EF4444'));
      deltaText.text(`${sign}${formatWithSettings(delta, this.settings.numberFormattingCard)}`);
    }

    // ── Comparison: Mini Sparkline ───────────────────────────────
    if (s.gaugeComparisonSettings.showSparkline.value && data.trend.length > 1) {
      const sparkWidth = outerRadius * 1.2;
      const sparkHeight = outerRadius * 0.22;
      const sparkY = cy + outerRadius * 0.55;
      const sparkX = cx - sparkWidth / 2;

      const sparkG = svg.append('g')
        .attr('transform', `translate(${sparkX}, ${sparkY})`);

      const xScale = d3.scaleLinear()
        .domain([0, data.trend.length - 1])
        .range([0, sparkWidth]);

      const trendMin = d3.min(data.trend) ?? 0;
      const trendMax = d3.max(data.trend) ?? 1;
      const trendPad = (trendMax - trendMin) * 0.1 || 1;
      const yScaleSpark = d3.scaleLinear()
        .domain([trendMin - trendPad, trendMax + trendPad])
        .range([sparkHeight, 0]);

      const sparkLine = d3.line<number>()
        .x((_, i) => xScale(i))
        .y((dVal) => yScaleSpark(dVal))
        .curve(d3.curveMonotoneX);

      sparkG.append('path')
        .datum(data.trend)
        .attr('d', sparkLine)
        .attr('fill', 'none')
        .attr('stroke', valueColor)
        .attr('stroke-width', 1.5)
        .attr('stroke-linecap', 'round')
        .attr('opacity', 0.7);

      // End dot
      const lastTrendIdx = data.trend.length - 1;
      sparkG.append('circle')
        .attr('cx', xScale(lastTrendIdx))
        .attr('cy', yScaleSpark(data.trend[lastTrendIdx]))
        .attr('r', 2)
        .attr('fill', valueColor);
    }

    // ── Accessibility ─────────────────────────────────────────────
    if (s.accessibilityFormattingCard.enableKeyboardNav.value) {
      ensureFocusRingStyles();
      applyChartAria(this.container, {
        chartType: 'radial gauge',
        title: s.titleFormattingCard.titleText.value || undefined,
        dataPointCount: 1,
        summary: data.value !== null
          ? `Value: ${formatWithSettings(data.value, this.settings.numberFormattingCard)}, Range: ${min} to ${max}`
          : undefined,
      });
      const hitNode = hitArea.node();
      if (hitNode) {
        applyDataPointAria(
          hitNode,
          'Gauge',
          formatWithSettings(data.value, this.settings.numberFormattingCard),
          0,
          1,
        );
        hitNode.setAttribute('tabindex', '0');
        hitNode.setAttribute('aria-keyshortcuts', 'Enter Space');
        hitNode.setAttribute('aria-disabled', allowInteractions(this.host) ? 'false' : 'true');
        const cleanup = attachKeyboardNav({
          container: this.container,
          itemSelector: '.radial-gauge-hit-area',
          onActivate: (element) => {
            if (allowInteractions(this.host)) {
              (element as SVGPathElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
            }
          },
        });
        this.cancelAnimations.push(cleanup);
      }
    }

    // ── Entrance Animation ──────────────────────────────────────
    if (s.animationSettings.enabled.value) {
      const svgNode = svg.node();
      if (svgNode) {
        const cancelFade = fadeSlideIn(
          svgNode as unknown as HTMLElement,
          'up',
          s.animationSettings.duration.value,
          50,
        );
        this.cancelAnimations.push(cancelFade);
      }
    }

    // Legend — zone colors
    const legendCard = this.settings.legendFormattingCard;
    if (legendCard.showLegend.value) {
      const legendPos = resolveDropdown(legendCard.legendPosition) ?? 'bottom';
      const rawFontColor = legendCard.legendFontColor.value?.value;
      const legendItems: LegendItem[] = [
        { label: 'Zone 1', color: zone1Color },
        { label: 'Zone 2', color: zone2Color },
        { label: 'Zone 3', color: zone3Color },
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

    // Apply selection/cross-highlight dimming
    this.applySelectionHighlight();
  }

  // ── Cross-Highlight ──────────────────────────────────────────────

  private applySelectionHighlight(): void {
    const data = this.currentData;
    if (!data) return;

    const selectedKeys = new Set(
      (this.selectionManager.getSelectionIds() as ISelectionId[]).map((id) => id.getKey()),
    );
    const isSelected = data.selectionId !== null && selectedKeys.has(data.selectionId.getKey());
    const shouldDim = selectedKeys.size > 0 || data.hasHighlights;
    const dimOpacity = shouldDim && !isSelected && !data.highlighted ? '0.3' : '';
    const arcs = this.container.querySelectorAll<SVGPathElement>('.radial-gauge-zone, .radial-gauge-segment');
    for (const el of Array.from(arcs)) {
      el.style.opacity = dimOpacity;
    }

    const valueArc = this.container.querySelector<SVGPathElement>('.radial-gauge-zone[data-selection-key]');
    if (valueArc) {
      valueArc.style.filter = isSelected ? 'drop-shadow(0 0 6px rgba(15, 23, 42, 0.28))' : '';
    }
  }

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  private showGaugeTooltip(data: RadialGaugeData, event: MouseEvent): void {
    const numberSettings = this.settings.numberFormattingCard;
    const tooltipData: VisualTooltipDataItem[] = [
      { displayName: 'Value', value: formatWithSettings(data.value as number, numberSettings) },
    ];
    if (data.target !== null) {
      tooltipData.push({ displayName: 'Target', value: formatWithSettings(data.target, numberSettings) });
    }

    this.host.tooltipService.show({
      dataItems: tooltipData,
      identities: data.selectionId ? [data.selectionId] : [],
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

  private resolveCenterContent(data: RadialGaugeData): { primaryText: string; captionText: string; isNumeric: boolean; numericValue: number } {
    const mode = resolveDropdown(this.settings.valueSettings.displayMode) ?? 'value';
    const captionMode = resolveDropdown(this.settings.valueSettings.captionMode) ?? 'auto';
    let primaryText = '';
    let captionText = '';
    let numericValue = data.value ?? 0;
    let isNumeric = true;

    switch (mode) {
      case 'target':
        if (data.target === null) {
          primaryText = '\u2014';
          numericValue = 0;
          isNumeric = false;
        } else {
          numericValue = data.target;
          primaryText = formatWithSettings(numericValue, this.settings.numberFormattingCard);
        }
        captionText = 'Target';
        break;
      case 'delta':
        if (data.target === null) {
          primaryText = '\u2014';
          numericValue = 0;
          isNumeric = false;
        } else {
          numericValue = (data.value ?? 0) - data.target;
          primaryText = formatWithSettings(numericValue, this.settings.numberFormattingCard);
        }
        captionText = 'Delta vs Target';
        break;
      case 'custom':
        primaryText = this.settings.valueSettings.customText.value || 'Summary';
        numericValue = 0;
        isNumeric = false;
        break;
      case 'value':
      default:
        numericValue = data.value ?? 0;
        primaryText = formatWithSettings(numericValue, this.settings.numberFormattingCard);
        captionText = 'Value';
        break;
    }

    if (captionMode === 'none') {
      captionText = '';
    } else if (captionMode === 'custom') {
      captionText = this.settings.valueSettings.customCaption.value || captionText;
    }

    return { primaryText, captionText, isNumeric, numericValue };
  }

  public destroy(): void {
    this.hideTooltip();
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];
    this.container.removeEventListener('click', this.handleBackgroundClick);
  }
}
