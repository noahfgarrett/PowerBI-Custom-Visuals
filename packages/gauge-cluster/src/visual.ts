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

    // Migrate legacy enableGlass -> cardStyleMode (backward compat)
    const legacyCardObj = dataView?.metadata?.objects?.['cardSettings'];
    if (legacyCardObj) {
      const legacyGlass = legacyCardObj['enableGlass'];
      if (legacyGlass === false) {
        this.settings.cardSettings.cardStyleMode.value = { value: 'none', displayName: 'None' };
      }
    }

    // Conditional visibility: hide child settings when parent toggle is off
    const s = this.settings;
    s.labelsSettings.subtitleField.visible = s.labelsSettings.showSubtitle.value;
    s.animationSettings.duration.visible = s.animationSettings.enabled.value;
    s.targetSettings.color.visible = s.targetSettings.show.value;
    s.targetSettings.lineWidth.visible = s.targetSettings.show.value;

    // Card Style — hide sub-settings when mode is 'none'
    const cardMode = (resolveDropdown(s.cardSettings.cardStyleMode) ?? 'glass') as CardStyleMode;
    s.cardSettings.backgroundOpacity.visible = cardMode !== 'none';
    s.cardSettings.backgroundColor.visible = cardMode !== 'none';

    // Extract data

    // Date filter: hide start/end when disabled
    this.settings.dateFilterFormattingCard.startDate.visible = this.settings.dateFilterFormattingCard.enableDateFilter.value;
    this.settings.dateFilterFormattingCard.endAtCurrentDate.visible = this.settings.dateFilterFormattingCard.enableDateFilter.value;
    this.settings.dateFilterFormattingCard.endDate.visible = this.settings.dateFilterFormattingCard.enableDateFilter.value && !this.settings.dateFilterFormattingCard.endAtCurrentDate.value;
    const data = this.extractData(dataView);

    this.render(data, options.viewport);
  }

  private extractData(dataView: DataView | undefined): GaugeData {
    const items: GaugeItem[] = [];

    if (!dataView?.categorical) return { items, hasHighlights: false };

    const categorical = dataView.categorical;
    const categories = categorical.categories;
    const values = categorical.values;

    if (!categories || categories.length === 0) return { items, hasHighlights: false };

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

    // Read cross-highlight data from the measure column
    const measureHighlights = measureColumn
      ? (measureColumn.highlights as unknown[] | undefined)
      : undefined;

    // Build gauge items from each category row
    const count = Math.min(categoryValues.length, 8);

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

      const highlighted = measureHighlights ? measureHighlights[i] !== null : false;
      if (highlighted) hasHighlights = true;

      const selectionId = this.host.createSelectionIdBuilder()
        .withCategory(categoryColumn, i)
        .createSelectionId();

      items.push({ label, value, target, highlighted, selectionId });
    }

    return { items, hasHighlights };
  }

  private render(data: GaugeData, viewport: powerbi.IViewport): void {
    const items = data.items;
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
    if (cardMode === 'none') {
      this.container.style.borderRadius = `${s.cardSettings.borderRadius.value}px`;
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
    const gaugesPerRow = Math.max(1, Math.min(8, s.gridLayoutSettings.gaugesPerRow.value));
    const grid = document.createElement('div');
    grid.className = 'gauge-grid';
    grid.style.gridTemplateColumns = `repeat(${gaugesPerRow}, 1fr)`;
    this.container.appendChild(grid);

    // ── Settings ─────────────────────────────────────────────────
    const arcRangeDeg = Math.max(60, Math.min(350, s.arcAppearanceSettings.arcRange.value));
    const minVal = s.valueRangeSettings.minValue.value;
    const maxVal = s.valueRangeSettings.maxValue.value;
    const totalRange = maxVal > minVal ? maxVal - minVal : 100;
    const showLabels = s.labelsSettings.showLabels.value;
    const showValues = s.labelsSettings.showValues.value && s.dataLabelFormattingCard.showDataLabels.value;

    // Zone thresholds (as fraction 0..1)
    const lowThresholdPct = Math.max(0, Math.min(100, s.zoneSettings.lowThreshold.value)) / 100;
    const highThresholdPct = Math.max(0, Math.min(100, s.zoneSettings.highThreshold.value)) / 100;
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
      if (showLabels) {
        // Position label below the arc
        const labelY = outerRadius + 6;

        const labelEl = g.append('text')
          .attr('class', 'gauge-label')
          .attr('x', 0)
          .attr('y', labelY)
          .text(item.label);

        const labelFontSize = s.labelsSettings.labelFontSize.value;
        if (labelFontSize) labelEl.attr('font-size', `${labelFontSize}px`);
        const labelFontColor = s.labelsSettings.labelFontColor.value?.value;
        if (labelFontColor) labelEl.attr('fill', labelFontColor);
        const labelFontFamily = resolveDropdown(s.labelsSettings.labelFontFamily);
        if (labelFontFamily) labelEl.attr('font-family', labelFontFamily);
        const labelFontWeight = resolveDropdown(s.labelsSettings.labelFontWeight);
        if (labelFontWeight) labelEl.attr('font-weight', labelFontWeight);
      }

      // ── Subtitle ────────────────────────────────────────────
      if (s.labelsSettings.showSubtitle.value) {
        const subtitleText = s.labelsSettings.subtitleField.value || '';
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
      if (s.labelsSettings.showSparklines.value) {
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

    // Cross-highlight dimming: dim non-highlighted gauges
    if (data.hasHighlights) {
      const cells = this.container.querySelectorAll<HTMLElement>('.gauge-cell');
      cells.forEach((cell, i) => {
        if (i < sortedItems.length && !sortedItems[i].highlighted) {
          cell.style.opacity = '0.3';
        }
      });
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

  // Render lifecycle notifications removed — Power BI's eventService.renderingStarted()
  // requires VisualUpdateOptions with updateId, and calling without args crashes the visual.

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
