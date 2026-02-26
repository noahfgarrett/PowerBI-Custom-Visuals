/**
 * Ring Stack -- Power BI IVisual implementation.
 * Apple Watch inspired concentric ring chart with sweep animations.
 */

import powerbi from 'powerbi-visuals-api';
import * as d3 from 'd3';
import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel';
import { RingStackSettings } from './settings';
import {
  sweepArc,
  countUp,
  fadeSlideIn,
  DURATION,
  formatNumber,
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

/** Full circle in radians. */
const TWO_PI = Math.PI * 2;

/** Start angle: 12 o'clock position (top). */
const START_ANGLE = -Math.PI / 2;

/** Data role names for the 6 measure slots. */
const MEASURE_ROLES = [
  'measure1',
  'measure2',
  'measure3',
  'measure4',
  'measure5',
  'measure6',
] as const;

// ── Data Interface ───────────────────────────────────────────────────

interface RingDatum {
  /** Raw value from the measure. */
  value: number;
  /** Percentage (value / maxValue), clamped to 0..1. */
  percentage: number;
  /** End angle in radians (from START_ANGLE, sweeping clockwise). */
  endAngle: number;
  /** Assigned color for this ring. */
  color: string;
  /** Index (0 = outermost ring). */
  index: number;
  /** Display name from the measure column. */
  name: string;
}

// ── Visual Class ─────────────────────────────────────────────────────

export class RingStackVisual implements IVisual {
  private host: IVisualHost;
  private container: HTMLElement;
  private settings: RingStackSettings;
  private formattingSettingsService: FormattingSettingsService;
  private cancelAnimations: Array<() => void> = [];

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.container = options.element;
    this.settings = new RingStackSettings();
    this.formattingSettingsService = new FormattingSettingsService();
    this.container.classList.add('ring-stack-container');
  }

  public update(options: VisualUpdateOptions): void {
    // Cancel running animations from previous render
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];

    // Parse settings from dataView
    const dataView = options.dataViews?.[0];
    if (dataView) {
      this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
        RingStackSettings,
        dataView
      );
    }

    // Extract ring data
    const rings = this.extractData(dataView);

    this.notifyRenderStarted();
    try {
      this.render(rings, options.viewport);
      this.notifyRenderFinished();
    } catch (error) {
      this.notifyRenderFailed(error);
      throw error;
    }
  }

  private extractData(dataView: DataView | undefined): RingDatum[] {
    const rings: RingDatum[] = [];

    if (!dataView?.categorical?.values) return rings;

    const values = dataView.categorical.values;
    const s = this.settings;
    const maxValue = Math.max(1, s.ringSettings.maxValue.value);

    // Color array from settings, indexed by measure slot
    const colors = [
      s.colorSettings.ring1Color.value?.value ?? '#6366F1',
      s.colorSettings.ring2Color.value?.value ?? '#3B82F6',
      s.colorSettings.ring3Color.value?.value ?? '#34D399',
      s.colorSettings.ring4Color.value?.value ?? '#F87171',
      s.colorSettings.ring5Color.value?.value ?? '#A78BFA',
      s.colorSettings.ring6Color.value?.value ?? '#FBBF24',
    ];

    // Map each bound measure column to a ring datum
    let ringIndex = 0;
    for (const col of values) {
      const role = col.source.roles;
      if (!role) continue;

      // Find which measure slot this column belongs to
      let slotIndex = -1;
      for (let i = 0; i < MEASURE_ROLES.length; i++) {
        if (role[MEASURE_ROLES[i]]) {
          slotIndex = i;
          break;
        }
      }

      if (slotIndex === -1) continue;
      if (col.values.length === 0) continue;

      // Get last value from the column
      const rawVal = col.values[col.values.length - 1];
      const numVal = typeof rawVal === 'number' ? rawVal : null;
      if (numVal === null || Number.isNaN(numVal)) continue;

      const percentage = Math.max(0, Math.min(1, numVal / maxValue));
      const endAngle = START_ANGLE + TWO_PI * percentage;

      rings.push({
        value: numVal,
        percentage,
        endAngle,
        color: colors[slotIndex],
        index: ringIndex,
        name: col.source.displayName ?? `Ring ${ringIndex + 1}`,
      });

      ringIndex++;
    }

    return rings;
  }

  private render(rings: RingDatum[], viewport: powerbi.IViewport): void {
    this.hideTooltip();

    // Clear container (no innerHTML)
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
      this.container.style.background = '';
      this.container.style.backdropFilter = '';
      (this.container.style as unknown as Record<string, unknown>)['WebkitBackdropFilter'] = '';
      this.container.style.border = '';
      this.container.style.boxShadow = '';
      this.container.style.borderRadius = '';
    }

    // Empty state: no measures bound
    if (rings.length === 0) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'ring-stack-empty';
      emptyEl.textContent = 'Drop measures here';
      this.container.appendChild(emptyEl);
      return;
    }

    // ── Layout Calculations ─────────────────────────────────────
    const width = viewport.width;
    const height = viewport.height;
    const showLabels = s.ringSettings.showLabels.value;
    const thickness = Math.max(4, s.ringSettings.thickness.value);
    const gap = Math.max(0, s.ringSettings.gap.value);

    // Reserve space for labels on the right side
    const labelAreaWidth = showLabels ? Math.min(width * 0.3, 100) : 0;
    const svgWidth = width - labelAreaWidth;
    const svgHeight = height;

    // Calculate ring radii: outermost ring first, working inward
    const padding = 8;
    const maxRadius = Math.min(svgWidth, svgHeight) / 2 - padding;
    const ringSpan = thickness + gap;
    const totalRingsSpan = rings.length * thickness + (rings.length - 1) * gap;

    // Outer radius: fit all rings within available space
    const outerRadius = Math.min(maxRadius, totalRingsSpan / 2 + maxRadius / 2);
    const centerX = svgWidth / 2;
    const centerY = svgHeight / 2;

    // ── SVG Setup ───────────────────────────────────────────────
    const svg = d3.select(this.container)
      .append('svg')
      .attr('class', 'ring-stack-svg')
      .attr('width', svgWidth)
      .attr('height', svgHeight)
      .attr('viewBox', `0 0 ${svgWidth} ${svgHeight}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    const g = svg.append('g')
      .attr('transform', `translate(${centerX}, ${centerY})`);

    // ── Render Each Ring ────────────────────────────────────────
    const animEnabled = s.animationSettings.enabled.value;
    const animDuration = s.animationSettings.duration.value;
    const staggerDelay = 80;

    rings.forEach((ring, i) => {
      const ringOuter = outerRadius - i * ringSpan;
      const ringInner = ringOuter - thickness;

      // Guard against negative radii
      if (ringInner < 0 || ringOuter < 0) return;

      // Arc generator with rounded ends
      const arcGen = d3.arc<{ startAngle: number; endAngle: number }>()
        .innerRadius(ringInner)
        .outerRadius(ringOuter)
        .cornerRadius(thickness / 2);

      // Background track: full circle at low opacity
      const trackColorSetting = s.ringSettings.trackColor.value?.value;
      const trackOpacity = s.ringSettings.trackOpacity.value / 100;
      const trackFill = trackColorSetting
        ? withOpacity(trackColorSetting, trackOpacity)
        : withOpacity(ring.color, trackOpacity);
      g.append('path')
        .attr('class', 'ring-stack-track')
        .attr('d', arcGen({
          startAngle: START_ANGLE,
          endAngle: START_ANGLE + TWO_PI,
        }))
        .attr('fill', trackFill);

      // Filled arc
      const ringStrokeColor = s.ringSettings.ringStrokeColor.value?.value;
      const arcPath = g.append('path')
        .attr('class', 'ring-stack-arc')
        .attr('fill', ring.color);
      if (ringStrokeColor) {
        arcPath.attr('stroke', ringStrokeColor).attr('stroke-width', 1);
      }
      arcPath
        .on('mouseenter', (event: MouseEvent) => {
          this.showRingTooltip(ring, event);
        })
        .on('mousemove', (event: MouseEvent) => {
          this.moveTooltip(event);
        })
        .on('mouseleave', () => {
          this.hideTooltip();
        });

      if (animEnabled) {
        // Start from no sweep
        arcPath.attr('d', arcGen({
          startAngle: START_ANGLE,
          endAngle: START_ANGLE,
        }));

        // Stagger each ring's animation
        const delay = i * staggerDelay;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        let cancelSweep: (() => void) | null = null;

        timeoutId = setTimeout(() => {
          cancelSweep = sweepArc(
            START_ANGLE,
            ring.endAngle,
            animDuration,
            (currentAngle) => {
              arcPath.attr('d', arcGen({
                startAngle: START_ANGLE,
                endAngle: currentAngle,
              }));
            }
          );
        }, delay);

        this.cancelAnimations.push(() => {
          if (timeoutId !== null) clearTimeout(timeoutId);
          cancelSweep?.();
        });
      } else {
        arcPath.attr('d', arcGen({
          startAngle: START_ANGLE,
          endAngle: ring.endAngle,
        }));
      }
    });

    // ── Center / Side Labels ────────────────────────────────────
    if (showLabels) {
      const labelContainer = document.createElement('div');
      labelContainer.className = 'ring-stack-labels';

      rings.forEach((ring, i) => {
        const labelRow = document.createElement('div');
        labelRow.className = 'ring-label';

        // Color dot
        const dot = document.createElement('span');
        dot.className = 'ring-label-dot';
        dot.style.backgroundColor = ring.color;
        labelRow.appendChild(dot);

        // Percentage text
        const pctSpan = document.createElement('span');
        pctSpan.className = 'ring-label-pct';
        pctSpan.style.color = ring.color;
        labelRow.appendChild(pctSpan);

        labelContainer.appendChild(labelRow);

        if (animEnabled) {
          const displayPct = ring.percentage * 100;
          const delay = i * staggerDelay;
          let timeoutId: ReturnType<typeof setTimeout> | null = null;
          let cancelCount: (() => void) | null = null;

          pctSpan.textContent = '0%';

          timeoutId = setTimeout(() => {
            cancelCount = countUp(
              0,
              displayPct,
              animDuration,
              (v) => {
                pctSpan.textContent = formatNumber(v, {
                  decimals: 0,
                  suffix: '%',
                  abbreviate: false,
                });
              }
            );
          }, delay);

          this.cancelAnimations.push(() => {
            if (timeoutId !== null) clearTimeout(timeoutId);
            cancelCount?.();
          });
        } else {
          pctSpan.textContent = formatNumber(ring.percentage * 100, {
            decimals: 0,
            suffix: '%',
            abbreviate: false,
          });
        }
      });

      this.container.appendChild(labelContainer);

      // Entrance fade for labels
      if (animEnabled) {
        const cancelFade = fadeSlideIn(
          labelContainer,
          'left',
          DURATION.fast,
          rings.length * staggerDelay
        );
        this.cancelAnimations.push(cancelFade);
      }
    }

    // Apply shared formatting settings
    if (s.dataLabelFormattingCard.showDataLabels.value) {
      applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.ring-label-pct');
    }

    // Legend
    const showLegend = s.legendFormattingCard.showLegend.value;
    if (showLegend && rings.length > 0) {
      this.renderLegend(rings);
    }

  }

  private renderLegend(rings: RingDatum[]): void {
    const legendFmtCard = this.settings.legendFormattingCard;
    const rawFontColor = legendFmtCard.legendFontColor.value?.value;
    const legendFontColor = rawFontColor != null && rawFontColor.length > 0 ? rawFontColor : '';
    const legendFontSize = legendFmtCard.legendFontSize.value;
    const legendPosRaw = legendFmtCard.legendPosition.value;
    const legendPosition = (typeof legendPosRaw === 'string'
      ? legendPosRaw
      : (legendPosRaw as { value?: string })?.value) ?? 'bottom';

    const legendDiv = document.createElement('div');
    legendDiv.className = 'ring-stack-legend';

    if (legendPosition === 'top' || legendPosition === 'bottom') {
      legendDiv.style.display = 'flex';
      legendDiv.style.justifyContent = 'center';
      legendDiv.style.gap = '16px';
      legendDiv.style.padding = '4px 0';
    } else {
      legendDiv.style.display = 'flex';
      legendDiv.style.flexDirection = 'column';
      legendDiv.style.gap = '6px';
      legendDiv.style.padding = '0 8px';
    }

    for (const ring of rings) {
      const item = document.createElement('div');
      item.style.display = 'flex';
      item.style.alignItems = 'center';
      item.style.gap = '4px';

      const swatch = document.createElement('div');
      swatch.style.width = '10px';
      swatch.style.height = '10px';
      swatch.style.borderRadius = '2px';
      swatch.style.backgroundColor = ring.color;
      swatch.style.flexShrink = '0';

      const label = document.createElement('span');
      label.textContent = ring.name;
      label.style.whiteSpace = 'nowrap';
      if (legendFontColor.length > 0) label.style.color = legendFontColor;
      if (legendFontSize !== 11) label.style.fontSize = `${legendFontSize}px`;

      item.appendChild(swatch);
      item.appendChild(label);
      legendDiv.appendChild(item);
    }

    if (legendPosition === 'top') {
      this.container.insertBefore(legendDiv, this.container.querySelector('.ring-stack-svg'));
    } else {
      this.container.appendChild(legendDiv);
    }

    // Entrance fade for legend
    if (this.settings.animationSettings.enabled.value) {
      const cancel = fadeSlideIn(legendDiv, 'up', DURATION.fast, rings.length * 80);
      this.cancelAnimations.push(cancel);
    }
  }

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  private showRingTooltip(ring: RingDatum, event: MouseEvent): void {
    const locale = this.getHostLocale();
    const tooltipData: VisualTooltipDataItem[] = [
      { displayName: 'Ring', value: ring.name },
      { displayName: 'Value', value: formatNumber(ring.value, { abbreviate: false, locale }) },
      { displayName: 'Percent', value: formatNumber(ring.percentage * 100, { decimals: 0, suffix: '%', abbreviate: false, locale }) },
    ];

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
