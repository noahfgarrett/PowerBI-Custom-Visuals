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
  getGlassStyle,
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
  selectionId: ISelectionId;
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

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new GaugeClusterSettings();
    this.formattingSettingsService = new FormattingSettingsService();
    this.container.classList.add('gauge-cluster-container');
  }

  public update(options: VisualUpdateOptions): void {
    // Cancel any running animations from previous render
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];

    // Parse settings from dataView
    const dataView = options.dataViews?.[0];
    if (dataView) {
      this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
        GaugeClusterSettings,
        dataView
      );
    }

    // Conditional visibility: hide child settings when parent toggle is off
    const s = this.settings;
    s.clusterLabelSettings.subtitleField.visible = s.clusterLabelSettings.showSubtitle.value;
    s.animationSettings.duration.visible = s.animationSettings.enabled.value;
    s.targetSettings.color.visible = s.targetSettings.show.value;
    s.targetSettings.lineWidth.visible = s.targetSettings.show.value;

    // Extract data
    const items = this.extractData(dataView);

    this.notifyRenderStarted();
    try {
      this.render(items, options.viewport);
      this.notifyRenderFinished();
    } catch (error) {
      this.notifyRenderFailed(error);
      throw error;
    }
  }

  private extractData(dataView: DataView | undefined): GaugeItem[] {
    const items: GaugeItem[] = [];

    if (!dataView?.categorical) return items;

    const categorical = dataView.categorical;
    const categories = categorical.categories;
    const values = categorical.values;

    if (!categories || categories.length === 0) return items;

    const categoryColumn = categories[0];
    const categoryValues = categoryColumn.values;

    // Find measure and target columns by role
    let measureColumn: powerbi.DataViewValueColumn | null = null;
    let targetColumn: powerbi.DataViewValueColumn | null = null;

    if (values) {
      for (const col of values) {
        const role = col.source.roles;
        if (!role) continue;
        if (role['measure']) measureColumn = col;
        if (role['target']) targetColumn = col;
      }
    }

    // Build gauge items from each category row
    const count = Math.min(categoryValues.length, 8);
    for (let i = 0; i < count; i++) {
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

      const selectionId = this.host.createSelectionIdBuilder()
        .withCategory(categoryColumn, i)
        .createSelectionId();

      items.push({ label, value, target, selectionId });
    }

    return items;
  }

  private render(items: GaugeItem[], viewport: powerbi.IViewport): void {
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

    // Empty state: no data
    if (items.length === 0) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'gauge-cluster-empty';
      emptyEl.textContent = 'Add a category and measure to populate gauges';
      this.container.appendChild(emptyEl);
      return;
    }

    // ── Grid Layout ──────────────────────────────────────────────
    const gaugesPerRow = Math.max(1, Math.min(8, s.clusterSettings.gaugesPerRow.value));
    const grid = document.createElement('div');
    grid.className = 'gauge-grid';
    grid.style.gridTemplateColumns = `repeat(${gaugesPerRow}, 1fr)`;
    this.container.appendChild(grid);

    // ── Settings ─────────────────────────────────────────────────
    const arcRangeDeg = Math.max(60, Math.min(350, s.clusterSettings.arcRange.value));
    const minVal = s.clusterSettings.minValue.value;
    const maxVal = s.clusterSettings.maxValue.value;
    const totalRange = maxVal > minVal ? maxVal - minVal : 100;
    const showLabels = s.clusterSettings.showLabels.value;
    const showValues = s.clusterSettings.showValues.value && s.dataLabelFormattingCard.showDataLabels.value;

    // Zone thresholds (as fraction 0..1)
    const lowThresholdPct = Math.max(0, Math.min(100, s.zoneSettings.lowThreshold.value)) / 100;
    const highThresholdPct = Math.max(0, Math.min(100, s.zoneSettings.highThreshold.value)) / 100;
    const lowColor = s.zoneSettings.lowColor.value?.value ?? '#F87171';
    const midColor = s.zoneSettings.midColor.value?.value ?? '#FBBF24';
    const highColor = s.zoneSettings.highColor.value?.value ?? '#34D399';

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
    const arcWidth = outerRadius * ARC_THICKNESS;
    const innerRadius = outerRadius - arcWidth;

    // D3 arc generator (optionally with rounded ends)
    const arcGen = d3.arc<{ startAngle: number; endAngle: number }>()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius)
      .cornerRadius(s.clusterSettings.roundedCaps.value ? arcWidth / 2 : 0);

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
    const sortedItems = s.clusterDisplaySettings.sortByValue.value
      ? [...items].sort((a, b) => b.value - a.value)
      : items;

    // ── Render Each Gauge ────────────────────────────────────────
    const newValues = new Map<string, number>();

    sortedItems.forEach((item, index) => {
      const cell = document.createElement('div');
      cell.className = 'gauge-cell';
      cell.style.cursor = 'pointer';
      cell.addEventListener('mouseenter', (event) => this.showGaugeTooltip(item, event));
      cell.addEventListener('mousemove', (event) => this.moveTooltip(event));
      cell.addEventListener('mouseleave', () => this.hideTooltip());
      cell.addEventListener('click', (event) => {
        event.stopPropagation();
        void this.selectionManager.select(item.selectionId, event.ctrlKey || event.metaKey);
      });
      cell.addEventListener('contextmenu', (event) => {
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
      g.append('path')
        .attr('class', 'gauge-track')
        .attr('d', arcGen({
          startAngle: startAngleRad,
          endAngle: endAngleRad,
        }))
        .attr('fill', '#94A3B8')
        .attr('opacity', s.clusterSettings.trackOpacity.value / 100);

      // ── Value Computation ────────────────────────────────────
      const clampedValue = Math.max(minVal, Math.min(maxVal, item.value));
      const normalizedValue = (clampedValue - minVal) / totalRange; // 0..1
      newValues.set(item.label, item.value);

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
          const prevVal = this.previousValues.get(item.label) ?? minVal;
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
      if (s.clusterDisplaySettings.showNeedle.value) {
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
      if (showLabels) {
        // Position label below the arc
        const labelY = outerRadius + 6;

        const labelEl = g.append('text')
          .attr('class', 'gauge-label')
          .attr('x', 0)
          .attr('y', labelY)
          .text(item.label);

        const labelFontSize = s.clusterSettings.labelFontSize.value;
        if (labelFontSize) labelEl.attr('font-size', `${labelFontSize}px`);
        const labelFontColor = s.clusterSettings.labelFontColor.value?.value;
        if (labelFontColor) labelEl.attr('fill', labelFontColor);
        const labelFontFamily = resolveDropdown(s.clusterSettings.labelFontFamily);
        if (labelFontFamily) labelEl.attr('font-family', labelFontFamily);
        const labelFontWeight = resolveDropdown(s.clusterSettings.labelFontWeight);
        if (labelFontWeight) labelEl.attr('font-weight', labelFontWeight);
      }

      // ── Subtitle ────────────────────────────────────────────
      if (s.clusterLabelSettings.showSubtitle.value) {
        const subtitleText = s.clusterLabelSettings.subtitleField.value || '';
        if (subtitleText.length > 0) {
          const subtitleY = outerRadius + (showLabels ? 16 : 6);
          g.append('text')
            .attr('class', 'gauge-subtitle')
            .attr('x', 0)
            .attr('y', subtitleY)
            .attr('text-anchor', 'middle')
            .attr('font-size', `${s.dataLabelFormattingCard.dataLabelFontSize.value}px`)
            .attr('fill', s.dataLabelFormattingCard.dataLabelFontColor.value?.value || '#64748B')
            .attr('opacity', 0.8)
            .text(subtitleText);
        }
      }

      // ── Sparkline ───────────────────────────────────────────
      if (s.clusterDisplaySettings.showSparklines.value) {
        // Track history for sparkline (keep up to 20 points)
        const history = this.sparklineHistory.get(item.label) ?? [];
        history.push(item.value);
        if (history.length > 20) history.shift();
        this.sparklineHistory.set(item.label, history);

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
      if (animEnabled) {
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

    this.container.addEventListener('click', this.handleBackgroundClick);
  }

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  private showGaugeTooltip(item: GaugeItem, event: MouseEvent): void {
    const locale = this.getHostLocale();
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

  private handleBackgroundClick = (): void => {
    void this.selectionManager.clear();
  };

  public destroy(): void {
    this.hideTooltip();
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];
    this.previousValues.clear();
  }
}
