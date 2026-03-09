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
  applySortOrder,
  renderLegend,
  getHostChartColor,
  resolveColorTheme,
  buildConditionalConfig,
  resolveConditionalColor,
  resolveDropdown,
  applyChartAria,
  attachKeyboardNav,
  ensureFocusRingStyles,
  type LegendItem,
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
  /** Max value used for this ring (may differ per ring when per-ring scale is enabled). */
  ringMax: number;
}

/**
 * Parse a comma-separated string of numbers into an array.
 * Non-numeric or empty entries are treated as NaN (caller should fall back).
 */
function parseMaxValues(raw: string): number[] {
  if (raw.trim().length === 0) return [];
  return raw.split(',').map((s) => {
    const trimmed = s.trim();
    if (trimmed.length === 0) return NaN;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : NaN;
  });
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

    this.settings.dataLabelFormattingCard.showDataLabels.visible = false;

    // Extract ring data and apply user-configured sort order
    const rings = applySortOrder(
      this.extractData(dataView),
      this.settings.sortFormattingCard,
    );

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
    const globalMax = Math.max(1, s.ringSettings.maxValue.value);

    // Per-ring max support
    const perRingEnabled = s.perRingMaxSettings.enabled.value;
    const parsedMaxValues = perRingEnabled
      ? parseMaxValues(s.perRingMaxSettings.maxValues.value)
      : [];

    // Color array from settings, indexed by measure slot
    // User-set color overrides theme; empty = use theme/palette color
    const themeName = resolveColorTheme(s.colorThemeFormattingCard);
    const ringColorPickers = [
      s.colorSettings.ring1Color,
      s.colorSettings.ring2Color,
      s.colorSettings.ring3Color,
      s.colorSettings.ring4Color,
      s.colorSettings.ring5Color,
      s.colorSettings.ring6Color,
    ];
    const colors = ringColorPickers.map((picker, i) => {
      const userColor = picker.value?.value;
      return (userColor && userColor.length > 0)
        ? userColor
        : getHostChartColor(this.host.colorPalette, i, themeName);
    });

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

      // Determine the max for this ring: use per-ring value if valid, otherwise global max
      const perRingVal = parsedMaxValues[ringIndex];
      const ringMax = perRingEnabled && Number.isFinite(perRingVal) && perRingVal > 0
        ? perRingVal
        : globalMax;

      const percentage = Math.max(0, Math.min(1, numVal / ringMax));
      const endAngle = START_ANGLE + TWO_PI * percentage;

      rings.push({
        value: numVal,
        percentage,
        endAngle,
        color: colors[slotIndex],
        index: ringIndex,
        name: col.source.displayName ?? `Ring ${ringIndex + 1}`,
        ringMax,
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
        backgroundColor: s.cardSettings.backgroundColor.value?.value,
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

    // ── Gradient Defs (if enabled) ──────────────────────────────
    const gradientEnabled = s.ringGradientSettings.enabled.value;
    if (gradientEnabled) {
      const defs = svg.append('defs');
      rings.forEach((ring, i) => {
        const grad = defs.append('linearGradient')
          .attr('id', `ring-grad-${i}`)
          .attr('x1', '0%').attr('y1', '0%')
          .attr('x2', '100%').attr('y2', '0%');
        grad.append('stop')
          .attr('offset', '0%')
          .attr('stop-color', ring.color)
          .attr('stop-opacity', 1);
        grad.append('stop')
          .attr('offset', '100%')
          .attr('stop-color', ring.color)
          .attr('stop-opacity', 0.5);
      });
    }

    // ── Render Each Ring ────────────────────────────────────────
    const animEnabled = s.animationSettings.enabled.value;
    const animDuration = s.animationSettings.duration.value;
    const staggerDelay = 80;

    rings.forEach((ring, i) => {
      const ringOuter = outerRadius - i * ringSpan;
      const ringInner = ringOuter - thickness;

      // Guard against negative radii
      if (ringInner < 0 || ringOuter < 0) return;

      // Arc generator (optionally with rounded ends)
      const arcGen = d3.arc<{ startAngle: number; endAngle: number }>()
        .innerRadius(ringInner)
        .outerRadius(ringOuter)
        .cornerRadius(s.ringSettings.roundedCaps.value ? thickness / 2 : 0);

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

      // Filled arc — apply conditional color override if enabled
      const conditionalColor = this.getConditionalColor(ring.value);
      const arcFillColor = conditionalColor ?? (gradientEnabled ? `url(#ring-grad-${i})` : ring.color);
      const ringStrokeColor = s.ringSettings.ringStrokeColor.value?.value;
      const arcPath = g.append('path')
        .attr('class', 'ring-stack-arc')
        .attr('fill', arcFillColor);
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

      // ── Arc Labels (textPath) ─────────────────────────────────
      if (s.ringDisplaySettings.showArcLabels.value) {
        const midRadius = (ringInner + ringOuter) / 2;
        // Create an arc path for the text to follow (half-circle at midRadius)
        const arcId = `ring-arc-label-${i}`;
        const textArcGen = d3.arc<{ startAngle: number; endAngle: number }>()
          .innerRadius(midRadius)
          .outerRadius(midRadius);
        const textArcD = textArcGen({
          startAngle: START_ANGLE,
          endAngle: START_ANGLE + Math.PI,
        });
        if (textArcD) {
          const defPath = g.append('path')
            .attr('id', arcId)
            .attr('d', textArcD)
            .attr('fill', 'none')
            .attr('stroke', 'none');

          g.append('text')
            .attr('class', 'ring-stack-arc-label')
            .attr('dy', '0.35em')
            .style('font-size', `${Math.max(8, thickness * 0.6)}px`)
            .style('fill', arcFillColor)
            .append('textPath')
            .attr('href', `#${arcId}`)
            .attr('startOffset', '2%')
            .text(ring.name);
        }
      }

      // ── Overflow Indicator (>100%) ────────────────────────────
      if (s.ringDisplaySettings.showOverflow.value && ring.value > ring.ringMax) {
        const overflowPct = (ring.value - ring.ringMax) / ring.ringMax;
        const overflowAngle = START_ANGLE + TWO_PI * Math.min(overflowPct, 1);
        const overflowArcGen = d3.arc<{ startAngle: number; endAngle: number }>()
          .innerRadius(ringInner)
          .outerRadius(ringOuter)
          .cornerRadius(s.ringSettings.roundedCaps.value ? thickness / 2 : 0);

        g.append('path')
          .attr('class', 'ring-stack-overflow')
          .attr('d', overflowArcGen({
            startAngle: START_ANGLE,
            endAngle: overflowAngle,
          }))
          .attr('fill', withOpacity(arcFillColor, 0.4))
          .attr('stroke', arcFillColor)
          .attr('stroke-width', 0.5)
          .attr('stroke-dasharray', '3,2');
      }
    });

    // ── Center Content (total/KPI display) ────────────────────────
    const cc = s.centerContentSettings;
    if (cc.show.value && rings.length > 0) {
      const modeRaw = cc.displayMode.value;
      const mode: string = (typeof modeRaw === 'string' ? modeRaw : (modeRaw as { value?: string })?.value) ?? 'total';

      const total = rings.reduce((sum, r) => sum + r.value, 0);
      const count = rings.length;
      const average = count > 0 ? total / count : 0;

      const ccFontColor = cc.fontColor.value?.value || '';

      if (mode === 'custom') {
        // Custom mode: show customText as the main text, no label below
        const centerText = g.append('text')
          .attr('class', 'ring-stack-center-value')
          .attr('x', 0)
          .attr('y', 0)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'central')
          .attr('font-size', `${cc.fontSize.value}px`)
          .attr('font-weight', '600')
          .attr('pointer-events', 'none')
          .text(cc.customText.value || '');
        if (ccFontColor) {
          centerText.attr('fill', ccFontColor);
        }
      } else {
        let displayValue: number;
        let labelText: string;
        if (mode === 'count') {
          displayValue = count;
          labelText = 'Count';
        } else if (mode === 'average') {
          displayValue = average;
          labelText = 'Average';
        } else {
          displayValue = total;
          labelText = 'Total';
        }

        const locale = this.getHostLocale();
        const formattedValue = formatNumber(displayValue, { abbreviate: true, locale });

        // Value text (slightly above center when label is shown)
        const valueY = cc.showLabel.value ? -cc.labelFontSize.value * 0.6 : 0;
        const valueText = g.append('text')
          .attr('class', 'ring-stack-center-value')
          .attr('x', 0)
          .attr('y', valueY)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'central')
          .attr('font-size', `${cc.fontSize.value}px`)
          .attr('font-weight', '600')
          .attr('pointer-events', 'none')
          .text(formattedValue);
        if (ccFontColor) {
          valueText.attr('fill', ccFontColor);
        }

        // Label text below value
        if (cc.showLabel.value) {
          const labelY = valueY + cc.fontSize.value * 0.6 + cc.labelFontSize.value * 0.6;
          const labelEl = g.append('text')
            .attr('class', 'ring-stack-center-label')
            .attr('x', 0)
            .attr('y', labelY)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'central')
            .attr('font-size', `${cc.labelFontSize.value}px`)
            .attr('font-weight', '400')
            .attr('opacity', 0.7)
            .attr('pointer-events', 'none')
            .text(labelText);
          if (ccFontColor) {
            labelEl.attr('fill', ccFontColor);
          }
        }
      }
    }

    // ── Center / Side Labels ────────────────────────────────────
    if (showLabels) {
      const labelContainer = document.createElement('div');
      labelContainer.className = 'ring-stack-labels';

      // Determine whether labels should show percentage or raw value
      const perRingEnabled = s.perRingMaxSettings.enabled.value;
      const showPct = !perRingEnabled || s.perRingMaxSettings.showPercentage.value;

      rings.forEach((ring, i) => {
        const labelRow = document.createElement('div');
        labelRow.className = 'ring-label';

        // Color dot
        const dot = document.createElement('span');
        dot.className = 'ring-label-dot';
        dot.style.backgroundColor = ring.color;
        labelRow.appendChild(dot);

        // Label value text (percentage or raw value)
        const pctSpan = document.createElement('span');
        pctSpan.className = 'ring-label-pct';
        pctSpan.style.color = ring.color;
        labelRow.appendChild(pctSpan);

        labelContainer.appendChild(labelRow);

        if (showPct) {
          // Show percentage
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
        } else {
          // Show raw value (per-ring scale enabled, showPercentage off)
          const locale = this.getHostLocale();
          if (animEnabled) {
            const delay = i * staggerDelay;
            let timeoutId: ReturnType<typeof setTimeout> | null = null;
            let cancelCount: (() => void) | null = null;

            pctSpan.textContent = '0';

            timeoutId = setTimeout(() => {
              cancelCount = countUp(
                0,
                ring.value,
                animDuration,
                (v) => {
                  pctSpan.textContent = formatNumber(v, {
                    abbreviate: true,
                    locale,
                  });
                }
              );
            }, delay);

            this.cancelAnimations.push(() => {
              if (timeoutId !== null) clearTimeout(timeoutId);
              cancelCount?.();
            });
          } else {
            pctSpan.textContent = formatNumber(ring.value, {
              abbreviate: true,
              locale,
            });
          }
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

    // Apply shared data label styling when local showLabels is on
    if (showLabels) {
      applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.ring-label-pct');
    }

    // Legend
    const showLegend = s.legendFormattingCard.showLegend.value;
    if (showLegend && rings.length > 0) {
      this.renderSharedLegend(rings);
    }

    // Accessibility
    this.applyAccessibility(rings.length);
  }

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

  private applyAccessibility(dataPointCount: number): void {
    const acc = this.settings.accessibilityFormattingCard;
    if (!acc.enableKeyboardNav.value) return;
    ensureFocusRingStyles();
    applyChartAria(this.container, {
      chartType: 'ring chart',
      title: this.settings.titleFormattingCard?.titleText?.value || undefined,
      dataPointCount,
    });
    const cleanup = attachKeyboardNav({
      container: this.container,
      itemSelector: '.ring-stack-arc',
      onActivate: (el) => (el as HTMLElement).click?.(),
    });
    this.cancelAnimations.push(cleanup);
  }

  private renderSharedLegend(rings: RingDatum[]): void {
    const legendFmtCard = this.settings.legendFormattingCard;
    const rawFontColor = legendFmtCard.legendFontColor.value?.value;
    const legendFontColor = rawFontColor != null && rawFontColor.length > 0 ? rawFontColor : '';
    const legendFontSize = legendFmtCard.legendFontSize.value;
    const legendPosRaw = legendFmtCard.legendPosition.value;
    const legendPosStr = (typeof legendPosRaw === 'string'
      ? legendPosRaw
      : (legendPosRaw as { value?: string })?.value) ?? 'bottom';
    const validPositions = ['top', 'bottom', 'left', 'right'] as const;
    const legendPosition: 'top' | 'bottom' | 'left' | 'right' =
      (validPositions as readonly string[]).includes(legendPosStr)
        ? (legendPosStr as 'top' | 'bottom' | 'left' | 'right')
        : 'bottom';

    const items: LegendItem[] = rings.map((ring) => ({
      label: ring.name,
      color: ring.color,
    }));

    const rawLegendFontFamily = resolveDropdown(legendFmtCard.legendFontFamily) || undefined;

    const legendEl = renderLegend(this.container, {
      items,
      position: legendPosition,
      fontSize: legendFontSize,
      fontColor: legendFontColor,
      fontFamily: rawLegendFontFamily,
    });

    // Entrance fade for legend
    if (this.settings.animationSettings.enabled.value) {
      const cancel = fadeSlideIn(legendEl, 'up', DURATION.fast, rings.length * 80);
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

    // Show the per-ring max in the tooltip when per-ring scale is active
    const perRingEnabled = this.settings.perRingMaxSettings.enabled.value;
    if (perRingEnabled) {
      tooltipData.push({
        displayName: 'Max',
        value: formatNumber(ring.ringMax, { abbreviate: false, locale }),
      });
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
