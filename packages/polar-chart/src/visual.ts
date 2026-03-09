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
  getGlassStyle,
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
  populateSeriesFormattingGroups,
  applyChartAria,
  attachKeyboardNav,
  ensureFocusRingStyles,
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
}

// ── Visual Class ─────────────────────────────────────────────────────

export class PolarChartVisual implements IVisual {
  private host: IVisualHost;
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private container: HTMLElement;
  private settings: PolarChartSettings;
  private formattingSettingsService: FormattingSettingsService;
  private cancelAnimations: Array<() => void> = [];

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new PolarChartSettings();
    this.formattingSettingsService = new FormattingSettingsService();
    this.container.classList.add('polar-container');
  }

  public update(options: VisualUpdateOptions): void {
    // Cancel any running animations from previous render
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];

    // Parse settings from dataView
    const dataView = options.dataViews?.[0];
    if (dataView) {
      this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
        PolarChartSettings,
        dataView
      );
    }

    // Hide inapplicable shared axis properties — polar-chart doesn't use titles/rotation/min/max
    this.settings.axisFormattingCard.showXAxis.visible = false;
    this.settings.axisFormattingCard.showYAxis.visible = false;
    this.settings.axisFormattingCard.xAxisTitle.visible = false;
    this.settings.axisFormattingCard.yAxisTitle.visible = false;
    this.settings.axisFormattingCard.axisLabelRotation.visible = false;
    this.settings.axisFormattingCard.yAxisMin.visible = false;
    this.settings.axisFormattingCard.yAxisMax.visible = false;

    // Extract data and apply user-configured sort order
    const data = applySortOrder(
      this.extractData(dataView).map((d) => ({ ...d, name: d.label })),
      this.settings.sortFormattingCard,
    );

    // Populate per-series formatting groups from data
    const defaultColors = new Map<string, string>();
    data.forEach((d) => defaultColors.set(d.label, d.color));
    populateSeriesFormattingGroups(
      this.settings.seriesFormattingCard,
      dataView,
      ['measure'],
      defaultColors,
    );

    this.notifyRenderStarted();
    try {
      this.render(data, options.viewport);
      this.notifyRenderFinished();
    } catch (error) {
      this.notifyRenderFailed(error);
      throw error;
    }
  }

  private extractData(dataView: DataView | undefined): PetalDatum[] {
    const themeName = resolveColorTheme(this.settings.colorThemeFormattingCard);
    const result: PetalDatum[] = [];

    if (!dataView?.categorical) return result;

    const categories = dataView.categorical.categories;
    const values = dataView.categorical.values;

    if (!categories || categories.length === 0 || !values || values.length === 0) return result;

    const categoryColumn = categories[0];
    const measureColumn = values[0];

    if (!categoryColumn || !measureColumn) return result;

    const count = Math.min(categoryColumn.values.length, measureColumn.values.length);
    const baseColor = this.settings.colorSettings.baseColor.value?.value;
    const useBaseColor = typeof baseColor === 'string' && baseColor.length > 0;

    for (let i = 0; i < count; i++) {
      const label = categoryColumn.values[i];
      const value = measureColumn.values[i];

      // Skip null / non-numeric entries
      if (label == null || value == null || typeof value !== 'number' || Number.isNaN(value)) {
        continue;
      }

      const color = useBaseColor
        ? this.lightenColor(baseColor, count > 1 ? (i / (count - 1)) * 0.45 : 0)
        : getHostChartColor(this.host.colorPalette, i, themeName);

      result.push({
        label: String(label),
        value: Math.max(0, value), // clamp negative values to 0
        color,
        selectionId: this.host.createSelectionIdBuilder()
          .withCategory(categoryColumn, i)
          .createSelectionId(),
      });
    }

    return result;
  }

  private render(data: PetalDatum[], viewport: powerbi.IViewport): void {
    this.hideTooltip();

    // Clear container (no innerHTML)
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    renderChartTitle(this.container, this.settings.titleFormattingCard);
    this.container.removeEventListener('click', this.handleBackgroundClick);

    const s = this.settings;

    // Apply glass card background
    if (s.cardSettings.enableGlass.value) {
      const glass = getGlassStyle({
        mode: 'light',
        opacity: s.cardSettings.backgroundOpacity.value / 100,
        backgroundColor: s.cardSettings.backgroundColor.value?.value || undefined,
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

    // Empty state: no data
    if (data.length === 0) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'polar-empty';
      emptyEl.textContent = 'Add a category and measure';
      this.container.appendChild(emptyEl);
      return;
    }

    // ── Dimensions ──────────────────────────────────────────────
    const width = viewport.width;
    const height = viewport.height;
    const size = Math.min(width, height);
    const cx = width / 2;
    const cy = height / 2;
    const padding = 24;
    const maxOuterRadius = (size / 2) - padding;
    const innerRadius = Math.max(0, Math.min(s.polarSettings.innerRadius.value, maxOuterRadius * 0.6));

    // ── Value calculations ──────────────────────────────────────
    const maxValue = d3.max(data, (d) => d.value) ?? 1;
    const petalCount = data.length;
    const segmentPaddingDeg = Math.max(0, s.polarDisplaySettings.segmentPadding.value);
    const endAngleRad = (Math.max(1, Math.min(360, s.polarDisplaySettings.endAngle.value)) / 360) * 2 * Math.PI;
    const angleStep = endAngleRad / petalCount;
    const startAngleOffset = s.polarSettings.startAngle.value * DEG_TO_RAD;
    const showRadialLabels = s.polarDisplaySettings.showRadialLabels.value;
    const showInnerLabels = s.polarDisplaySettings.showInnerLabels.value;

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

    // ── Gradient Defs (if enabled) ──────────────────────────────
    const gradientEnabled = s.polarGradientSettings.enabled.value;
    if (gradientEnabled) {
      const defs = svg.append('defs');
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
      .padAngle(segmentPaddingDeg * DEG_TO_RAD)
      .cornerRadius(3);

    // ── Grid circles (concentric) ─────────────────────────────
    if (s.axisFormattingCard.showGridLines.value) {
      const gridColor = s.axisFormattingCard.gridLineColor.value?.value || '#E2E8F0';
      const gridStyleValue = s.axisFormattingCard.gridLineStyle.value;
      const gridStyle = typeof gridStyleValue === 'string'
        ? gridStyleValue
        : (gridStyleValue as { value?: string } | undefined)?.value ?? 'dashed';
      const gridDash = gridStyle === 'dashed' ? '4 3' : 'none';
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
          .attr('stroke-dasharray', gridDash)
          .attr('stroke-opacity', 0.6);
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
      const petalStartAngle = startAngleOffset + i * angleStep;
      const petalEndAngle = startAngleOffset + (i + 1) * angleStep;
      const targetOuterRadius = innerRadius + ((datum.value / maxValue) * (maxOuterRadius - innerRadius));

      const petalGroup = g.append('g').attr('class', 'polar-petal-group');

      const fmt = resolveSeriesFormatting(this.settings.seriesFormattingCard, i, datum.color);
      const conditionalFill = this.getConditionalColor(datum.value);
      const petalFill = conditionalFill ?? (gradientEnabled ? `url(#polar-grad-${i})` : fmt.color);
      const petalPath = petalGroup.append('path')
        .attr('class', 'polar-petal')
        .attr('fill', petalFill)
        .attr('fill-opacity', fmt.opacity / 100)
        .attr('stroke', s.polarSettings.segmentStrokeColor.value?.value || withOpacity(datum.color, 0.6))
        .attr('stroke-width', s.polarSettings.segmentStrokeWidth.value)
        .style('cursor', 'pointer')
        .on('click', (event: MouseEvent) => {
          event.stopPropagation();
          void this.selectionManager.select(datum.selectionId, event.ctrlKey || event.metaKey);
        })
        .on('contextmenu', (event: MouseEvent) => {
          event.preventDefault();
          event.stopPropagation();
          void this.selectionManager.showContextMenu(datum.selectionId, {
            x: event.clientX,
            y: event.clientY,
          });
        });

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

      // ── Hover: springScale bloom ────────────────────────────
      const petalNode = petalPath.node();
      if (petalNode) {
        let hoverCancel: (() => void) | null = null;

        petalNode.addEventListener('mouseenter', (event: MouseEvent) => {
          hoverCancel?.();
          hoverCancel = springScale(petalNode, 0, 300, 1, 1.06);
          petalPath.attr('fill-opacity', 1);
          this.showPetalTooltip(datum, event);
        });

        petalNode.addEventListener('mousemove', (event: MouseEvent) => {
          this.moveTooltip(event);
        });

        petalNode.addEventListener('mouseleave', () => {
          hoverCancel?.();
          hoverCancel = springScale(petalNode, 0, 300, 1.06, 1);
          petalPath.attr('fill-opacity', fmt.opacity / 100);
          this.hideTooltip();
        });

        // Ensure hover animations are cleaned up on destroy
        this.cancelAnimations.push(() => {
          hoverCancel?.();
        });
      }

      // ── Inner Labels (inside petals) ────────────────────────────
      if (showInnerLabels || s.polarSettings.showLabels.value) {
        const midAngle = (petalStartAngle + petalEndAngle) / 2;
        const labelRadius = innerRadius + (targetOuterRadius - innerRadius) * 0.65;
        const labelX = labelRadius * Math.sin(midAngle);
        const labelY = -labelRadius * Math.cos(midAngle);

        // Only show labels if petal is large enough
        if (targetOuterRadius - innerRadius > 20) {
          const labelEl = petalGroup.append('text')
            .attr('class', 'polar-label')
            .attr('x', labelX)
            .attr('y', labelY)
            .attr('dy', '0.35em')
            .attr('fill', s.polarSettings.labelColor.value?.value || '#FFFFFF')
            .text(datum.label);

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
      if (showRadialLabels) {
        const midAngle = (petalStartAngle + petalEndAngle) / 2;
        const radialLabelRadius = targetOuterRadius + 16;
        const rlX = radialLabelRadius * Math.sin(midAngle);
        const rlY = -radialLabelRadius * Math.cos(midAngle);

        // Determine text-anchor based on angle position
        const angleDeg = ((midAngle * 180) / Math.PI + 360) % 360;
        let textAnchor = 'middle';
        if (angleDeg > 30 && angleDeg < 150) textAnchor = 'start';
        else if (angleDeg > 210 && angleDeg < 330) textAnchor = 'end';

        const radialLabel = petalGroup.append('text')
          .attr('class', 'polar-radial-label')
          .attr('x', rlX)
          .attr('y', rlY)
          .attr('dy', '0.35em')
          .attr('text-anchor', textAnchor)
          .attr('font-size', '11px')
          .attr('fill', s.polarSettings.labelColor.value?.value || '#475569')
          .text(datum.label);

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
      const axisColor = s.axisFormattingCard.axisLabelColor.value?.value || '#475569';
      const axisLabelSize = s.axisFormattingCard.axisLabelSize.value;

      data.forEach((datum, i) => {
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
            .attr('font-size', `${axisLabelSize}px`)
            .attr('font-weight', '600')
            .attr('fill', axisColor)
            .text(formatNumber(datum.value));

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

    renderLegend(this.container, {
      items,
      position,
      fontSize: legendFontSize,
      fontColor: legendFontColor,
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

  private handleBackgroundClick = (): void => {
    void this.selectionManager.clear();
  };

  private showPetalTooltip(datum: PetalDatum, event: MouseEvent): void {
    const locale = this.getHostLocale();
    const tooltipData: VisualTooltipDataItem[] = [
      { displayName: 'Category', value: datum.label },
      { displayName: 'Value', value: formatNumber(datum.value, { abbreviate: false, locale }) },
    ];

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

  private getHostLocale(): string | undefined {
    const locale = (this.host as unknown as { locale?: unknown }).locale;
    return typeof locale === 'string' && locale.length > 0 ? locale : undefined;
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
    const cleanup = attachKeyboardNav({
      container: this.container,
      itemSelector: '.polar-petal',
      onActivate: (el) => (el as HTMLElement).click?.(),
    });
    this.cancelAnimations.push(cleanup);
  }

  public destroy(): void {
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.hideTooltip();
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];
  }
}
