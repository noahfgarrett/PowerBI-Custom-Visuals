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
  getGlassStyle,
  withOpacity,
  renderChartTitle,
  applyDataLabelFormatting,
} from '../../core/src';

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataView = powerbi.DataView;
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

/** Arc sweep configurations in degrees. */
const ARC_RANGE: Record<string, { start: number; end: number }> = {
  half: { start: -90, end: 90 },    // 180-degree sweep (top half)
  full: { start: -135, end: 135 },   // 270-degree sweep (3/4 circle)
};

// ── Data Interface ───────────────────────────────────────────────────

interface RadialGaugeData {
  value: number | null;
  target: number | null;
  min: number;
  max: number;
}

// ── Visual Class ─────────────────────────────────────────────────────

export class RadialGaugeVisual implements IVisual {
  private host: IVisualHost;
  private container: HTMLElement;
  private settings: RadialGaugeSettings;
  private formattingSettingsService: FormattingSettingsService;
  private previousValue: number | null = null;
  private cancelAnimations: Array<() => void> = [];

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.container = options.element;
    this.settings = new RadialGaugeSettings();
    this.formattingSettingsService = new FormattingSettingsService();
    this.container.classList.add('radial-gauge-container');
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

    // Extract data
    const data = this.extractData(dataView);

    this.notifyRenderStarted();
    try {
      this.render(data, options.viewport);
      this.notifyRenderFinished();
    } catch (error) {
      this.notifyRenderFailed(error);
      throw error;
    }
  }

  private extractData(dataView: DataView | undefined): RadialGaugeData {
    const result: RadialGaugeData = {
      value: null,
      target: null,
      min: 0,
      max: 100,
    };

    if (!dataView?.categorical) return result;

    const values = dataView.categorical.values;
    if (!values) return result;

    for (const col of values) {
      const role = col.source.roles;
      if (!role) continue;

      if (role['value'] && col.values.length > 0) {
        const lastVal = col.values[col.values.length - 1];
        result.value = typeof lastVal === 'number' ? lastVal : null;
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

    // Apply glass card background
    if (s.cardSettings.enableGlass.value) {
      const glass = getGlassStyle({
        mode: 'light',
        opacity: s.cardSettings.backgroundOpacity.value / 100,
        backgroundColor: ((s.cardSettings as any).backgroundColor?.value?.value ?? (s.cardSettings as any).bgColor?.value?.value),
        borderRadius: s.cardSettings.borderRadius.value,
      });
      Object.assign(this.container.style, glass);
    } else {
      // Reset glass styles when disabled
      this.container.style.background = '';
      this.container.style.backdropFilter = '';
      (this.container.style as unknown as Record<string, unknown>)['WebkitBackdropFilter'] = '';
      this.container.style.border = '';
      this.container.style.boxShadow = '';
      this.container.style.borderRadius = '';
    }

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

    const rangeKey = s.arcSettings.startAngle.value?.value ?? 'full';
    const range = ARC_RANGE[rangeKey] ?? ARC_RANGE['full'];
    const startAngleRad = range.start * DEG_TO_RAD;
    const endAngleRad = range.end * DEG_TO_RAD;

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
      .attr('fill', '#94A3B8')
      .attr('opacity', this.settings.arcSettings.trackOpacity.value / 100);

    // ── Color Zones ─────────────────────────────────────────────
    const { min, max } = data;
    const totalRange = max - min;
    const clampedValue = Math.max(min, Math.min(max, data.value));
    const normalizedValue = (clampedValue - min) / totalRange; // 0..1

    const zone1Pct = Math.max(0, Math.min(100, s.zoneSettings.zone1Threshold.value)) / 100;
    const zone2Pct = Math.max(0, Math.min(100, s.zoneSettings.zone2Threshold.value)) / 100;

    const zone1Color = s.zoneSettings.zone1Color.value?.value ?? '#F87171';
    const zone2Color = s.zoneSettings.zone2Color.value?.value ?? '#FBBF24';
    const zone3Color = s.zoneSettings.zone3Color.value?.value ?? '#34D399';

    // Determine which color the current value falls into
    const valueColor = normalizedValue <= zone1Pct
      ? zone1Color
      : normalizedValue <= zone2Pct
        ? zone2Color
        : zone3Color;

    // Value arc angle
    const totalSweep = endAngleRad - startAngleRad;
    const valueEndAngle = startAngleRad + totalSweep * normalizedValue;

    // Render value arc (with or without animation)
    const valueArcPath = g.append('path')
      .attr('class', 'radial-gauge-zone')
      .attr('fill', valueColor)
      .attr('stroke', 'none');
    valueArcPath
      .on('mouseenter', (event: MouseEvent) => {
        this.showGaugeTooltip(data, event);
      })
      .on('mousemove', (event: MouseEvent) => {
        this.moveTooltip(event);
      })
      .on('mouseleave', () => {
        this.hideTooltip();
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
        .attr('stroke', withOpacity(color, this.settings.arcSettings.zoneBorderOpacity.value / 100))
        .attr('stroke-width', this.settings.arcSettings.zoneBorderWidth.value);
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
        .attr('stroke-width', 3);
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
      const startAngleDeg = range.start;
      const valueAngleDeg = startAngleDeg + (normalizedValue * (range.end - range.start));

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

    const valueText = g.append('text')
      .attr('class', 'radial-gauge-value-text')
      .attr('x', 0)
      .attr('y', textOffsetY)
      .attr('font-size', `${fontSize}px`)
      .attr('fill', fontColor);

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

  private notifyRenderStarted(): void {
    const eventService = (this.host as unknown as {
      eventService?: { renderingStarted?: () => void };
    }).eventService;
    eventService?.renderingStarted?.();
  }

  private notifyRenderFinished(): void {
    const eventService = (this.host as unknown as {
      eventService?: { renderingFinished?: () => void };
    }).eventService;
    eventService?.renderingFinished?.();
  }

  private notifyRenderFailed(error: unknown): void {
    const eventService = (this.host as unknown as {
      eventService?: { renderingFailed?: (reason: string) => void };
    }).eventService;
    const reason = error instanceof Error ? error.message : 'render failure';
    eventService?.renderingFailed?.(reason);
  }

  public destroy(): void {
    this.hideTooltip();
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];
  }
}
