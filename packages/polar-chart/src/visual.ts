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
  populateSeriesFormattingGroups,
  applyChartAria,
  attachKeyboardNav,
  ensureFocusRingStyles,
  getDateFilterIndices,
  isDateColumn,
  type DateFilterConfig,
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

    // Migrate legacy enableGlass -> cardStyleMode (backward compat)
    const legacyCardObj = dataView?.metadata?.objects?.['cardSettings'];
    if (legacyCardObj) {
      const legacyGlass = legacyCardObj['enableGlass'];
      if (legacyGlass === false) {
        this.settings.cardSettings.cardStyleMode.value = { value: 'none', displayName: 'None' };
      }
    }

    // Hide inapplicable shared axis properties — polar-chart doesn't use titles/rotation/min/max

    // Date filter: hide start/end when disabled
    this.settings.dateFilterFormattingCard.startDate.visible = this.settings.dateFilterFormattingCard.enableDateFilter.value;
    this.settings.dateFilterFormattingCard.endAtCurrentDate.visible = this.settings.dateFilterFormattingCard.enableDateFilter.value;
    this.settings.dateFilterFormattingCard.endDate.visible = this.settings.dateFilterFormattingCard.enableDateFilter.value && !this.settings.dateFilterFormattingCard.endAtCurrentDate.value;
    // Card Style — hide sub-settings when mode is 'none'
    const cardStyleMode = (resolveDropdown(this.settings.cardSettings.cardStyleMode) ?? 'glass') as CardStyleMode;
    this.settings.cardSettings.backgroundOpacity.visible = cardStyleMode !== 'none';
    this.settings.cardSettings.backgroundColor.visible = cardStyleMode !== 'none';

    this.settings.axisFormattingCard.showXAxis.visible = false;
    this.settings.axisFormattingCard.showYAxis.visible = false;
    this.settings.axisFormattingCard.xAxisTitle.visible = false;
    this.settings.axisFormattingCard.yAxisTitle.visible = false;
    this.settings.axisFormattingCard.axisLabelFontFamily.visible = false;
    this.settings.axisFormattingCard.axisLabelRotation.visible = false;
    this.settings.axisFormattingCard.yAxisMin.visible = false;
    this.settings.axisFormattingCard.yAxisMax.visible = false;
    this.settings.axisFormattingCard.gridLineWidth.visible = false;
    this.settings.axisFormattingCard.gridLineOpacity.visible = false;
    this.settings.axisFormattingCard.axisLabelFontWeight.visible = false;

    // Hide shared showDataLabels — local labelSettings.showLabels handles label visibility
    this.settings.dataLabelFormattingCard.showDataLabels.visible = false;
    // Hide data label position — position is determined by chart geometry
    this.settings.dataLabelFormattingCard.dataLabelPosition.visible = false;

    // Extract data and apply user-configured sort order
    const extracted = this.extractData(dataView);
    const data = applySortOrder(
      extracted.petals.map((d) => ({ ...d, name: d.label })),
      this.settings.sortFormattingCard,
    );

    // Store data for cross-highlight usage
    this.currentData = { petals: data, hasHighlights: extracted.hasHighlights };

    // Populate per-series formatting groups from data
    const defaultColors = new Map<string, string>();
    data.forEach((d) => defaultColors.set(d.label, d.color));
    populateSeriesFormattingGroups(
      this.settings.seriesFormattingCard,
      dataView,
      ['measure'],
      defaultColors,
    );

    this.render(data, options.viewport);
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
      });
    }

    return { petals: result, hasHighlights };
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

    // Apply card style
    const cardMode = (resolveDropdown(s.cardSettings.cardStyleMode) ?? 'glass') as CardStyleMode;
    applyCardStyle(this.container, {
      mode: cardMode,
      opacity: s.cardSettings.backgroundOpacity.value / 100,
      backgroundColor: s.cardSettings.backgroundColor.value?.value || undefined,
      borderRadius: s.cardSettings.borderRadius.value,
    });
    if (cardMode === 'none') {
      this.container.style.borderRadius = `${s.cardSettings.borderRadius.value}px`;
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
    const innerRadius = Math.max(0, Math.min(s.segmentSettings.innerRadius.value, maxOuterRadius * 0.6));

    // ── Value calculations ──────────────────────────────────────
    const totalValue = data.reduce((sum, d) => sum + d.value, 0);
    const maxValue = d3.max(data, (d) => d.value) ?? 1;
    const petalCount = data.length;
    const segmentPaddingDeg = Math.max(0, s.segmentSettings.segmentPadding.value);
    const endAngleRad = (Math.max(1, Math.min(360, s.segmentSettings.endAngle.value)) / 360) * 2 * Math.PI;
    const angleStep = endAngleRad / petalCount;
    const startAngleOffset = s.segmentSettings.startAngle.value * DEG_TO_RAD;
    const showRadialLabels = s.labelSettings.showRadialLabels.value;
    const showInnerLabels = s.labelSettings.showInnerLabels.value;

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
        .attr('data-selection-key', datum.selectionId.getKey())
        .attr('fill', petalFill)
        .attr('fill-opacity', fmt.opacity / 100)
        .attr('stroke', s.segmentSettings.segmentStrokeColor.value?.value || withOpacity(datum.color, 0.6))
        .attr('stroke-width', s.segmentSettings.segmentStrokeWidth.value)
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
      if (showInnerLabels || s.labelSettings.showLabels.value) {
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
            .attr('fill', s.dataLabelFormattingCard.dataLabelFontColor.value?.value || s.labelSettings.labelColor.value?.value || '#FFFFFF')
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
          .attr('font-size', `${s.axisFormattingCard.axisLabelSize.value}px`)
          .attr('fill', s.dataLabelFormattingCard.dataLabelFontColor.value?.value || s.labelSettings.labelColor.value?.value || '#475569')
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
    void this.selectionManager.clear();
    this.applyCrossHighlight();
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
