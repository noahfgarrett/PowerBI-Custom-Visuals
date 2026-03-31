/**
 * Radial Gauge Pro -- Power BI IVisual implementation.
 * Bridges PBI data/lifecycle with the D3 rendering engine.
 */

import powerbi from 'powerbi-visuals-api';
import * as d3 from 'd3';
import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel';
import { RadialGaugeSettings } from './settings';
import {
  formatNumber,
  formatWithSettings,
  countUp,
  sweepArc,
  fadeSlideIn,
  applyCardStyle,
  type CardStyleMode,
  withOpacity,
  renderChartTitle,
  applyDataLabelFormatting,
  resolveConditionalColor,
  buildConditionalConfig,
  resolveDropdown,
  applyChartAria,
  ensureFocusRingStyles,
  renderLegend,
  type LegendItem,
  getDateFilterIndices,
  isDateColumn,
  type DateFilterConfig,
  resolveColorTheme,
  getHostChartColor,
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
  private handleBackgroundClick: () => void;

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new RadialGaugeSettings();
    this.formattingSettingsService = new FormattingSettingsService();
    this.container.classList.add('radial-gauge-container');

    this.handleBackgroundClick = (): void => {
      void this.selectionManager.clear();
    };
    this.container.addEventListener('click', this.handleBackgroundClick);
  }

  public update(options: VisualUpdateOptions): void {
    // Cancel any running animations from previous render
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];

    // Parse settings from dataView
    const dataView = options.dataViews?.[0];
    if (dataView) {
      this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
        RadialGaugeSettings,
        dataView
      );
    }

    // Migrate legacy enableGlass -> cardStyleMode (backward compat)
    const legacyCardObj = dataView?.metadata?.objects?.['cardSettings'];
    if (legacyCardObj) {
      const legacyGlass = legacyCardObj['enableGlass'];
      if (legacyGlass === false) {
        this.settings.cardSettings.cardStyleMode.value = { value: 'none', displayName: 'None' };
      }
    }

    // Date filter: hide start/end when disabled
    this.settings.dateFilterFormattingCard.startDate.visible = this.settings.dateFilterFormattingCard.enableDateFilter.value;
    this.settings.dateFilterFormattingCard.endAtCurrentDate.visible = this.settings.dateFilterFormattingCard.enableDateFilter.value;
    this.settings.dateFilterFormattingCard.endDate.visible = this.settings.dateFilterFormattingCard.enableDateFilter.value && !this.settings.dateFilterFormattingCard.endAtCurrentDate.value;

    this.settings.dataLabelFormattingCard.showDataLabels.visible = false;
    this.settings.dataLabelFormattingCard.dataLabelPosition.visible = false;

    // Conditional visibility: hide needle sub-settings when showNeedle is off
    this.settings.needleSettings.color.visible = this.settings.needleSettings.show.value;
    this.settings.needleSettings.width.visible = this.settings.needleSettings.show.value;
    this.settings.needleSettings.showHub.visible = this.settings.needleSettings.show.value;
    this.settings.needleSettings.hubRadius.visible = this.settings.needleSettings.show.value;

    // Conditional visibility: hide segment count when LED segments is off
    this.settings.arcSettings.segmentCount.visible = this.settings.arcSettings.segmented.value;

    // Card Style — hide sub-settings when mode is 'none'
    const cardMode = (resolveDropdown(this.settings.cardSettings.cardStyleMode) ?? 'glass') as CardStyleMode;
    this.settings.cardSettings.backgroundOpacity.visible = cardMode !== 'none';
    this.settings.cardSettings.backgroundColor.visible = cardMode !== 'none';

    // Conditional visibility: hide delta/sparkline are independent toggles (no sub-settings to hide)
    // But we can hide target color when showTarget is off
    this.settings.targetSettings.color.visible = this.settings.targetSettings.show.value;
    this.settings.targetSettings.lineWidth.visible = this.settings.targetSettings.show.value;

    // Extract data
    const data = this.extractData(dataView);
    this.currentData = data;

    this.render(data, options.viewport);
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

    for (const col of values) {
      const role = col.source.roles;
      if (!role) continue;

      if (role['value'] && col.values.length > 0) {
        const lastVal = col.values[col.values.length - 1];
        result.value = typeof lastVal === 'number' ? lastVal : null;
        // Collect all value rows for trend sparkline
        result.trend = col.values
          .filter((v, i): v is number => typeof v === 'number' && (!dateIndices || dateIndices.has(i)));

        // Build a selectionId from the measure column
        result.selectionId = this.host.createSelectionIdBuilder()
          .withMeasure(col.source.queryName ?? '')
          .createSelectionId();

        // Cross-highlight: check if the value measure has highlight data
        const hlRaw = (col as unknown as { highlights?: unknown }).highlights as unknown[] | undefined;
        if (hlRaw) {
          const hasAnyHighlight = hlRaw.some(h => h !== null && h !== undefined);
          if (hasAnyHighlight) {
            result.hasHighlights = true;
            const lastHl = hlRaw[hlRaw.length - 1];
            result.highlighted = lastHl !== null && lastHl !== undefined;
          }
        }
      }

      if (role['target'] && col.values.length > 0) {
        const lastVal = col.values[col.values.length - 1];
        result.target = typeof lastVal === 'number' ? lastVal : null;
      }

      if (role['minValue'] && col.values.length > 0) {
        const lastVal = col.values[col.values.length - 1];
        if (typeof lastVal === 'number') result.min = lastVal;
      }

      if (role['maxValue'] && col.values.length > 0) {
        const lastVal = col.values[col.values.length - 1];
        if (typeof lastVal === 'number') result.max = lastVal;
      }
    }

    // Ensure min < max
    if (result.min >= result.max) {
      result.min = 0;
      result.max = 100;
    }

    return result;
  }

  private render(data: RadialGaugeData, viewport: powerbi.IViewport): void {
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

    // Empty state: no value provided
    if (data.value === null) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'radial-gauge-empty';
      emptyEl.textContent = '--';
      this.container.appendChild(emptyEl);
      this.previousValue = null;
      return;
    }

    // ── Dimensions ──────────────────────────────────────────────
    const width = viewport.width;
    const height = viewport.height;
    const size = Math.min(width, height);
    const cx = width / 2;
    const cy = height / 2;
    const outerRadius = size * 0.42;

    const thicknessKey = s.arcSettings.thickness.value?.value ?? 'medium';
    const thicknessFraction = THICKNESS_MAP[thicknessKey] ?? THICKNESS_MAP['medium'];
    const arcWidth = outerRadius * thicknessFraction;
    const innerRadius = outerRadius - arcWidth;

    // Arc range: preset dropdown sets a quick base (half=180, full=360).
    // If the user has manually changed arcRange from its default (270), that
    // takes precedence as a fine-tuning override.
    const arcPreset = resolveDropdown(s.arcSettings.startAngle);
    const arcRangeDefault = 270;
    const presetRange = arcPreset === 'full' ? 360 : 180;
    const rawArcRange = s.arcSettings.arcRange.value;
    const effectiveRange = rawArcRange !== arcRangeDefault ? rawArcRange : presetRange;
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

    const zone1Pct = Math.max(0, Math.min(100, s.zoneSettings.zone1Threshold.value)) / 100;
    const zone2Pct = Math.max(0, Math.min(100, s.zoneSettings.zone2Threshold.value)) / 100;

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
        .attr('fill', valueColor)
        .attr('stroke', 'none');
      // Hover: brightness boost + inner glow
      valueArcPath
        .style('transition', 'filter 0.2s ease')
        .style('cursor', 'pointer')
        .on('mouseenter', (event: MouseEvent) => {
          valueArcPath.style('filter', `brightness(1.18) drop-shadow(0 0 4px ${valueColor})`);
          this.showGaugeTooltip(data, event);
        })
        .on('mousemove', (event: MouseEvent) => {
          this.moveTooltip(event);
        })
        .on('mouseleave', () => {
          valueArcPath.style('filter', 'none');
          this.hideTooltip();
        })
        .on('click', (event: MouseEvent) => {
          event.stopPropagation();
          if (data.selectionId) {
            void this.selectionManager.select(data.selectionId, event.ctrlKey || event.metaKey);
          }
        })
        .on('contextmenu', (event: MouseEvent) => {
          event.preventDefault();
          if (data.selectionId) {
            void this.selectionManager.showContextMenu(data.selectionId, {
              x: event.clientX,
              y: event.clientY,
            });
          }
        });

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
    const fmt = (v: number | null | undefined): string => {
      return formatWithSettings(v as number, this.settings.numberFormattingCard);
    };

    const fontSize = s.valueSettings.fontSize.value;
    const fontColor = s.valueSettings.fontColor.value?.value || '#333333';

    // Offset the text upward for half-circle mode so it sits inside the arc
    const textOffsetY = rangeKey === 'half' ? -outerRadius * 0.15 : outerRadius * 0.05;

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

    if (s.animationSettings.enabled.value) {
      const from = this.previousValue ?? min;
      valueText.text(fmt(from));

      const cancelCount = countUp(
        from,
        data.value,
        s.animationSettings.duration.value,
        (v) => { valueText.text(fmt(v)); }
      );
      this.cancelAnimations.push(cancelCount);
      this.previousValue = data.value;
    } else {
      valueText.text(fmt(data.value));
      this.previousValue = data.value;
    }

    // ── Scale Ticks ──────────────────────────────────────────────
    if (s.gaugeScaleSettings.showTicks.value) {
      const majorCount = Math.max(2, s.gaugeScaleSettings.majorTicks.value);
      const minorPerMajor = Math.max(0, s.gaugeScaleSettings.minorTicks.value);

      for (let i = 0; i <= majorCount; i++) {
        const pct = i / majorCount;
        const angle = startAngleRad + totalSweep * pct;
        const cosA = Math.cos(angle - Math.PI / 2);
        const sinA = Math.sin(angle - Math.PI / 2);

        // Major tick
        g.append('line')
          .attr('x1', (outerRadius + 3) * cosA)
          .attr('y1', (outerRadius + 3) * sinA)
          .attr('x2', (outerRadius + 8) * cosA)
          .attr('y2', (outerRadius + 8) * sinA)
          .attr('stroke', s.gaugeScaleSettings.majorTickColor.value?.value ?? '#64748B')
          .attr('stroke-width', 1.5);

        // Scale label
        if (s.gaugeScaleSettings.showLabels.value) {
          const labelVal = min + totalRange * pct;
          g.append('text')
            .attr('x', (outerRadius + 14) * cosA)
            .attr('y', (outerRadius + 14) * sinA)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'central')
            .attr('font-size', `${s.dataLabelFormattingCard.dataLabelFontSize.value}px`)
            .attr('fill', s.dataLabelFormattingCard.dataLabelFontColor.value?.value || '#64748B')
            .text(formatWithSettings(labelVal, this.settings.numberFormattingCard));
        }

        // Minor ticks between major ticks
        if (i < majorCount && minorPerMajor > 0) {
          for (let j = 1; j <= minorPerMajor; j++) {
            const minorPct = pct + (j / (majorCount * (minorPerMajor + 1)));
            if (minorPct > 1) break;
            const minorAngle = startAngleRad + totalSweep * minorPct;
            const minorCos = Math.cos(minorAngle - Math.PI / 2);
            const minorSin = Math.sin(minorAngle - Math.PI / 2);

            g.append('line')
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
    }

    // ── Entrance Animation ──────────────────────────────────────
    if (s.animationSettings.enabled.value) {
      const svgNode = svg.node();
      if (svgNode instanceof HTMLElement) {
        const cancelFade = fadeSlideIn(svgNode, 'up', s.animationSettings.duration.value, 50);
        this.cancelAnimations.push(cancelFade);
      }
    }

    // Apply shared formatting settings
    applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.radial-gauge-value-text');

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

    // Apply cross-highlight dimming
    this.applyCrossHighlight();
  }

  // ── Cross-Highlight ──────────────────────────────────────────────

  private applyCrossHighlight(): void {
    const data = this.currentData;
    if (!data || !data.hasHighlights) return;

    // Dim the value arc and segments if the gauge is not highlighted
    const dimOpacity = data.highlighted ? '' : '0.3';
    const arcs = this.container.querySelectorAll<SVGPathElement>('.radial-gauge-zone, .radial-gauge-segment');
    for (const el of Array.from(arcs)) {
      el.style.opacity = dimOpacity;
    }
  }

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  private showGaugeTooltip(data: RadialGaugeData, event: MouseEvent): void {
    const locale = this.getHostLocale();
    const numberSettings = this.settings.numberFormattingCard;
    const tooltipData: VisualTooltipDataItem[] = [
      { displayName: 'Value', value: formatWithSettings(data.value as number, numberSettings) },
    ];
    if (data.target !== null) {
      tooltipData.push({ displayName: 'Target', value: formatWithSettings(data.target, numberSettings) });
    }

    this.host.tooltipService.show({
      dataItems: tooltipData,
      identities: [],
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

  private getHostLocale(): string | undefined {
    const locale = (this.host as unknown as { locale?: unknown }).locale;
    return typeof locale === 'string' && locale.length > 0 ? locale : undefined;
  }

  // Render lifecycle notifications removed — Power BI's eventService.renderingStarted()
  // requires VisualUpdateOptions with updateId, and calling without args crashes the visual.

  public destroy(): void {
    this.hideTooltip();
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];
    this.container.removeEventListener('click', this.handleBackgroundClick);
  }
}
