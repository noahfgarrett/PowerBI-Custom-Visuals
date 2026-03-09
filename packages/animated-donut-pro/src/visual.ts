/**
 * Animated Donut Pro — Power BI IVisual implementation.
 * Donut chart with sweeping arc entrance animation, center value count-up,
 * spring-explode hover, and glassmorphic card styling.
 */

import powerbi from 'powerbi-visuals-api';
import * as d3 from 'd3';
import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel';
import { AnimatedDonutProSettings } from './settings';
import {
  sweepArc,
  countUp,
  springScale,
  fadeSlideIn,
  cubicOut,
  DURATION,
  formatNumber,
  getGlassStyle,
  getHostChartColor,
  withOpacity,
  renderChartTitle,
  applyDataLabelFormatting,
  resolveDropdown,
  renderLegend,
  type LegendItem,
  resolveColorTheme,
  buildConditionalConfig,
  resolveConditionalColor,
  applyChartAria,
  attachKeyboardNav,
  ensureFocusRingStyles,
} from '../../core/src';

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataView = powerbi.DataView;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;
import ISelectionId = powerbi.visuals.ISelectionId;

import '../style/visual.less';

// ── Types ───────────────────────────────────────────────────────────

interface DonutSegment {
  label: string;
  value: number;
  color: string;
  selectionId: ISelectionId | null;
}

/** Segment for the nested inner ring */
interface InnerRingSegment {
  label: string;
  value: number;
  color: string;
  parentLabel: string;
}

interface SegmentArc {
  startAngle: number;
  endAngle: number;
  segment: DonutSegment;
}

// ── Constants ───────────────────────────────────────────────────────

/** Stagger delay (ms) between each segment's sweep animation start. */
const SEGMENT_STAGGER_MS = 80;

/** Minimum inner radius percentage to prevent degenerate rendering. */
const MIN_INNER_RADIUS_PCT = 0;

/** Maximum inner radius percentage. */
const MAX_INNER_RADIUS_PCT = 90;

// ── Visual ──────────────────────────────────────────────────────────

export class AnimatedDonutProVisual implements IVisual {
  private host: IVisualHost;
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private container: HTMLElement;
  private settings: AnimatedDonutProSettings;
  private formattingSettingsService: FormattingSettingsService;
  private cancelAnimations: Array<() => void> = [];

  /** Refs to path elements for hover interactions. */
  private segmentPaths: SVGPathElement[] = [];

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new AnimatedDonutProSettings();
    this.formattingSettingsService = new FormattingSettingsService();
    this.container.classList.add('donut-container');
  }

  public update(options: VisualUpdateOptions): void {
    // Cancel running animations before re-render
    this.cancelAllAnimations();

    // Parse settings from dataView
    const dataView = options.dataViews?.[0];
    if (dataView) {
      this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
        AnimatedDonutProSettings,
        dataView,
      );
    }

    // ── Conditional visibility ──────────────────────────────────────
    const s = this.settings;

    // Center value sub-settings: hide when showCenter is off
    const showCenter = s.donutSettings.showCenter.value;
    s.valueSettings.fontSize.visible = showCenter;
    s.valueSettings.fontColor.visible = showCenter;
    s.valueSettings.prefix.visible = showCenter;
    s.valueSettings.suffix.visible = showCenter;
    s.valueSettings.decimalPlaces.visible = showCenter;

    // Top N sub-settings: hide when Top N is disabled
    const topNEnabled = s.topNSettings.enabled.value;
    s.topNSettings.topN.visible = topNEnabled;
    s.topNSettings.othersLabel.visible = topNEnabled;
    s.topNSettings.othersColor.visible = topNEnabled;
    s.topNSettings.sortBy.visible = topNEnabled;

    // Explode distance: hide when explode is off
    s.donutExplodeSettings.distance.visible = s.donutExplodeSettings.enabled.value;

    // Label format & connector settings: hide when showLabels is off
    const showLabels = s.donutSettings.showLabels.value;
    s.donutLabelSettings.format.visible = showLabels;
    s.donutLabelSettings.connectorLines.visible = showLabels;

    // Nested ring sub-settings: hide when nested rings are off
    s.donutNestedSettings.innerRingField.visible = s.donutNestedSettings.enabled.value;

    // Extract data
    const rawSegments = this.extractData(dataView);
    const segments = this.applyTopN(rawSegments);

    // Apply glass effect
    this.applyCardStyle();

    // Render
    if (segments.length === 0) {
      this.renderEmpty();
    } else {
      this.render(segments, options.viewport, dataView);
    }
  }

  // ── Data Extraction ─────────────────────────────────────────────

  private extractData(dataView: DataView | undefined): DonutSegment[] {
    const themeName = resolveColorTheme(this.settings.colorThemeFormattingCard);
    if (!dataView?.categorical) return [];

    const categorical = dataView.categorical;
    const categoryColumn = categorical.categories?.[0];
    const valuesColumn = categorical.values?.[0];

    if (!categoryColumn || !valuesColumn) return [];

    const categories = categoryColumn.values;
    const values = valuesColumn.values;

    if (!categories || !values || categories.length === 0) return [];

    const segments: DonutSegment[] = [];

    for (let i = 0; i < categories.length; i++) {
      const label = categories[i] !== null && categories[i] !== undefined
        ? String(categories[i])
        : '';
      const rawVal = values[i];
      const value = typeof rawVal === 'number' && !Number.isNaN(rawVal) ? rawVal : 0;

      // Skip zero/negative values for donut chart
      if (value <= 0) continue;

      segments.push({
        label,
        value,
        color: getHostChartColor(this.host.colorPalette, i, themeName),
        selectionId: this.host.createSelectionIdBuilder()
          .withCategory(categoryColumn, i)
          .createSelectionId(),
      });
    }

    return segments;
  }

  // ── Top N Grouping ──────────────────────────────────────────

  private applyTopN(segments: DonutSegment[]): DonutSegment[] {
    const topNSettings = this.settings.topNSettings;
    if (!topNSettings.enabled.value || segments.length === 0) return segments;

    const n = Math.max(1, topNSettings.topN.value);
    if (segments.length <= n) return segments;

    const sortBy = resolveDropdown(topNSettings.sortBy) ?? 'value';

    // Sort a copy to determine the top N
    const sorted = [...segments].sort((a, b) => {
      if (sortBy === 'name') {
        return a.label.localeCompare(b.label);
      }
      return b.value - a.value;
    });

    const topSegments = sorted.slice(0, n);
    const remaining = sorted.slice(n);

    if (remaining.length === 0) return topSegments;

    const othersValue = remaining.reduce((sum, seg) => sum + seg.value, 0);
    const othersLabel = topNSettings.othersLabel.value || 'Others';
    const othersColor = topNSettings.othersColor.value?.value ?? '#94A3B8';

    const othersSegment: DonutSegment = {
      label: othersLabel,
      value: othersValue,
      color: othersColor,
      selectionId: null,
    };

    return [...topSegments, othersSegment];
  }

  // ── Card Style ────────────────────────────────────────────────

  private applyCardStyle(): void {
    const s = this.settings.cardSettings;
    if (s.enableGlass.value) {
      const glass = getGlassStyle({
        mode: 'light',
        opacity: s.backgroundOpacity.value / 100,
        backgroundColor: s.backgroundColor.value?.value,
        borderRadius: s.borderRadius.value,
      });
      Object.assign(this.container.style, glass);
    } else {
      // Reset glass styles
      this.container.style.background = '';
      this.container.style.backdropFilter = '';
      (this.container.style as unknown as Record<string, string>)['WebkitBackdropFilter'] = '';
      this.container.style.border = '';
      this.container.style.boxShadow = '';
      this.container.style.borderRadius = `${s.borderRadius.value}px`;
    }
  }

  // ── Empty State ───────────────────────────────────────────────

  private renderEmpty(): void {
    this.clearContainer();
    const emptyEl = document.createElement('div');
    emptyEl.className = 'donut-empty';
    emptyEl.textContent = 'Add a Category and a Value to get started.';
    this.container.appendChild(emptyEl);
  }

  // ── Main Render ───────────────────────────────────────────────

  private render(segments: DonutSegment[], viewport: powerbi.IViewport, dataView?: DataView): void {
    this.clearContainer();
    this.container.style.flexDirection = 'column';
    renderChartTitle(this.container, this.settings.titleFormattingCard);
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.segmentPaths = [];

    const s = this.settings;
    const padding = 8; // CSS padding on container

    // Legend config
    const showLegend = s.legendFormattingCard.showLegend.value;
    const legendPosRaw = s.legendFormattingCard.legendPosition.value;
    const legendPos: string = (typeof legendPosRaw === 'string'
      ? legendPosRaw
      : (legendPosRaw as { value?: string } | undefined)?.value) ?? 'bottom';
    const isLegendVertical = legendPos === 'left' || legendPos === 'right';
    const legendHeight = showLegend && !isLegendVertical ? 30 : 0;
    const legendWidth = showLegend && isLegendVertical ? 80 : 0;

    // Render legend at top or left position (before SVG)
    if (showLegend && (legendPos === 'top' || legendPos === 'left')) {
      this.renderSharedLegend(segments);
    }

    const svgWidth = viewport.width - padding * 2 - legendWidth;
    const svgHeight = viewport.height - padding * 2 - legendHeight;

    if (svgWidth <= 0 || svgHeight <= 0) {
      this.renderEmpty();
      return;
    }

    // Create SVG
    const svg = d3.select(this.container)
      .append('svg')
      .attr('width', svgWidth)
      .attr('height', svgHeight);

    const cx = svgWidth / 2;
    const cy = svgHeight / 2;
    const maxRadius = Math.min(cx, cy) - 4; // 4px margin for hover overshoot

    if (maxRadius <= 0) {
      this.renderEmpty();
      return;
    }

    // Clamp inner radius percentage
    const innerRadiusPct = Math.max(
      MIN_INNER_RADIUS_PCT,
      Math.min(MAX_INNER_RADIUS_PCT, s.donutSettings.innerRadius.value),
    );
    const innerRadius = maxRadius * (innerRadiusPct / 100);
    const outerRadius = maxRadius;

    // Compute total for percentages and center value
    const total = segments.reduce((sum, seg) => sum + seg.value, 0);

    if (total <= 0) {
      this.renderEmpty();
      return;
    }

    // Resolve arc shape setting
    const arcShapeRaw = s.donutSettings.arcShape.value;
    const arcShape: string = (typeof arcShapeRaw === 'string'
      ? arcShapeRaw
      : (arcShapeRaw as { value?: string } | undefined)?.value) ?? 'full';

    // Determine arc angular range based on shape
    let layoutStartAngle: number;
    let layoutEndAngle: number;

    switch (arcShape) {
      case 'semi':
        layoutStartAngle = -Math.PI / 2;
        layoutEndAngle = Math.PI / 2;
        break;
      case 'threeQuarter':
        layoutStartAngle = -3 * Math.PI / 4;
        layoutEndAngle = 3 * Math.PI / 4;
        break;
      default: // 'full'
        layoutStartAngle = -Math.PI / 2;
        layoutEndAngle = 3 * Math.PI / 2;
        break;
    }

    // Build arc layout: compute start/end angles for each segment
    const arcs = this.computeArcs(segments, total, layoutStartAngle, layoutEndAngle);

    // D3 arc generator
    const arcGen = d3.arc<SegmentArc>()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius)
      .startAngle((d) => d.startAngle)
      .endAngle((d) => d.endAngle);

    // Adjust vertical center offset for partial arcs so the visible arc
    // is centered in the viewport. For a semi circle (top half), the arc
    // spans from -R (top) to 0 (center), so shift down by R/2.
    // For three-quarter, the arc extends from the top and wraps past the
    // bottom by R*sin(3PI/4), leaving a gap at the bottom; shift down a
    // small amount to visually balance.
    let cyOffset = 0;
    if (arcShape === 'semi') {
      cyOffset = outerRadius * 0.35;
    } else if (arcShape === 'threeQuarter') {
      cyOffset = outerRadius * 0.15;
    }

    // Chart group centered
    const g = svg.append('g')
      .attr('transform', `translate(${cx},${cy + cyOffset})`);

    // Animation config
    const animEnabled = s.animationSettings.enabled.value;
    const animDuration = animEnabled ? s.animationSettings.duration.value : 0;

    // Explode settings
    const explodeEnabled = s.donutExplodeSettings.enabled.value;
    const explodeDistance = s.donutExplodeSettings.distance.value;

    // Draw each segment
    arcs.forEach((arc, index) => {
      const conditionalFill = this.getConditionalColor(arc.segment.value);

      // Calculate explode offset if enabled
      let explodeTransform = '';
      if (explodeEnabled && explodeDistance > 0) {
        const midAngle = (arc.startAngle + arc.endAngle) / 2;
        const dx = Math.cos(midAngle) * explodeDistance;
        const dy = Math.sin(midAngle) * explodeDistance;
        explodeTransform = `translate(${dx},${dy})`;
      }

      const path = g.append('path')
        .attr('class', 'donut-segment')
        .attr('fill', conditionalFill ?? arc.segment.color)
        .attr('stroke', this.settings.donutSettings.segmentStrokeColor.value?.value || '#FFFFFF')
        .attr('stroke-width', this.settings.donutSettings.segmentStrokeWidth.value);

      if (explodeTransform) {
        path.attr('transform', explodeTransform);
      }

      const pathNode = path.node();
      if (!pathNode) return;

      this.segmentPaths.push(pathNode);

      if (animEnabled && animDuration > 0) {
        // Sweep animation: start with zero-length arc, grow to full
        path.attr('d', arcGen({
          startAngle: arc.startAngle,
          endAngle: arc.startAngle,
          segment: arc.segment,
        }));

        const delay = index * SEGMENT_STAGGER_MS;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        timeoutId = setTimeout(() => {
          const cancel = sweepArc(
            arc.startAngle,
            arc.endAngle,
            animDuration,
            (currentAngle) => {
              path.attr('d', arcGen({
                startAngle: arc.startAngle,
                endAngle: currentAngle,
                segment: arc.segment,
              }));
            },
          );
          this.cancelAnimations.push(cancel);
        }, delay);

        this.cancelAnimations.push(() => {
          if (timeoutId !== null) clearTimeout(timeoutId);
        });
      } else {
        // No animation — draw immediately
        path.attr('d', arcGen(arc));
      }

      // Tooltip
      this.attachSegmentTooltip(path, arc.segment, total);

      // Hover: spring-scale explode
      this.attachHoverEffect(pathNode, index);

      if (arc.segment.selectionId) {
        const selId = arc.segment.selectionId;
        path
          .style('cursor', 'pointer')
          .on('click', (event: MouseEvent) => {
            event.stopPropagation();
            void this.selectionManager.select(selId, event.ctrlKey || event.metaKey);
          })
          .on('contextmenu', (event: MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();
            void this.selectionManager.showContextMenu(selId, {
              x: event.clientX,
              y: event.clientY,
            });
          });
      }
    });

    // Labels at arc centroids (gated by local showLabels toggle)
    if (s.donutSettings.showLabels.value) {
      this.renderLabels(g, arcs, innerRadius, outerRadius, animEnabled, animDuration, total);

      // Apply shared data label formatting (font color, size, weight)
      applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.donut-label');
    }

    // Center value
    if (s.donutSettings.showCenter.value) {
      this.renderCenterValue(g, total, animEnabled, animDuration);
    }

    // Nested inner ring
    if (s.donutNestedSettings.enabled.value) {
      const innerRingFieldName = s.donutNestedSettings.innerRingField.value.trim();
      if (innerRingFieldName.length > 0) {
        this.renderNestedRing(
          g, segments, innerRadius, total,
          layoutStartAngle, layoutEndAngle,
          innerRingFieldName, dataView, animEnabled, animDuration,
        );
      }
    }

    // Render legend at bottom or right position
    if (showLegend && legendPos !== 'top' && legendPos !== 'left') {
      this.renderSharedLegend(segments);
    }

    this.applyAccessibility(arcs.length);
    this.container.addEventListener('click', this.handleBackgroundClick);
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
      chartType: 'donut chart',
      title: this.settings.titleFormattingCard?.titleText?.value || undefined,
      dataPointCount,
    });
    const cleanup = attachKeyboardNav({
      container: this.container,
      itemSelector: '.donut-segment',
      onActivate: (el) => (el as HTMLElement).click?.(),
    });
    this.cancelAnimations.push(cleanup);
  }

  // ── Arc Computation ───────────────────────────────────────────

  private computeArcs(
    segments: DonutSegment[],
    total: number,
    layoutStartAngle: number,
    layoutEndAngle: number,
  ): SegmentArc[] {
    const arcs: SegmentArc[] = [];
    const totalArcSpan = layoutEndAngle - layoutStartAngle;
    let currentAngle = layoutStartAngle;

    for (const segment of segments) {
      const fraction = segment.value / total;
      const arcAngle = fraction * totalArcSpan;
      const endAngle = currentAngle + arcAngle;

      arcs.push({
        startAngle: currentAngle,
        endAngle,
        segment,
      });

      currentAngle = endAngle;
    }

    return arcs;
  }

  // ── Labels ────────────────────────────────────────────────────

  private renderLabels(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    arcs: SegmentArc[],
    innerRadius: number,
    outerRadius: number,
    animEnabled: boolean,
    animDuration: number,
    total: number,
  ): void {
    const showConnectors = this.settings.donutLabelSettings.connectorLines.value;
    const labelFormatRaw = resolveDropdown(this.settings.donutLabelSettings.format) ?? 'category';

    // When connector lines are on, place labels outside the donut
    const labelRadius = showConnectors
      ? outerRadius + 20
      : (innerRadius + outerRadius) / 2;

    arcs.forEach((arc, index) => {
      const midAngle = (arc.startAngle + arc.endAngle) / 2;
      const lx = Math.cos(midAngle) * labelRadius;
      const ly = Math.sin(midAngle) * labelRadius;

      // Resolve label text based on format setting
      const pct = total > 0 ? ((arc.segment.value / total) * 100).toFixed(1) : '0.0';
      const formattedValue = formatNumber(arc.segment.value, { abbreviate: true });
      let labelText: string;
      switch (labelFormatRaw) {
        case 'value':
          labelText = formattedValue;
          break;
        case 'percent':
          labelText = `${pct}%`;
          break;
        case 'both':
          labelText = `${arc.segment.label}: ${formattedValue}`;
          break;
        default: // 'category'
          labelText = arc.segment.label;
          break;
      }

      // Draw connector line from arc centroid to label position
      if (showConnectors) {
        const arcCentroidRadius = (innerRadius + outerRadius) / 2;
        const cx = Math.cos(midAngle) * arcCentroidRadius;
        const cy = Math.sin(midAngle) * arcCentroidRadius;
        const elbowRadius = outerRadius + 10;
        const ex = Math.cos(midAngle) * elbowRadius;
        const ey = Math.sin(midAngle) * elbowRadius;

        g.append('polyline')
          .attr('class', 'donut-connector')
          .attr('points', `${cx},${cy} ${ex},${ey} ${lx},${ly}`)
          .attr('fill', 'none')
          .attr('stroke', this.settings.donutSettings.labelColor.value?.value || '#94A3B8')
          .attr('stroke-width', 1);
      }

      const text = g.append('text')
        .attr('class', 'donut-label')
        .attr('x', lx)
        .attr('y', ly)
        .attr('fill', this.settings.donutSettings.labelColor.value?.value || '#475569')
        .attr('font-size', `${this.settings.donutSettings.labelFontSize.value}px`)
        .text(labelText);

      // When labels are outside with connectors, align text based on side
      if (showConnectors) {
        text.attr('text-anchor', lx >= 0 ? 'start' : 'end');
      }

      if (animEnabled) {
        const textNode = text.node();
        if (textNode) {
          const totalDelay = (arcs.length * SEGMENT_STAGGER_MS) + (index * 40);
          // Cast SVGTextElement to HTMLElement — both share .style.opacity/.transform at runtime
          const cancel = fadeSlideIn(textNode as unknown as HTMLElement, 'up', animDuration * 0.5, totalDelay);
          this.cancelAnimations.push(cancel);
        }
      }
    });
  }

  // ── Nested Inner Ring ────────────────────────────────────────

  private renderNestedRing(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    outerSegments: DonutSegment[],
    innerRadius: number,
    total: number,
    layoutStartAngle: number,
    layoutEndAngle: number,
    fieldName: string,
    dataView: DataView | undefined,
    animEnabled: boolean,
    animDuration: number,
  ): void {
    if (!dataView?.categorical) return;

    const categorical = dataView.categorical;
    const categories = categorical.categories;
    if (!categories || categories.length < 2) return;

    // Find the column whose displayName matches the innerRingField setting
    let innerColumn: powerbi.DataViewCategoryColumn | undefined;
    for (let ci = 1; ci < categories.length; ci++) {
      const colName = categories[ci].source.displayName ?? '';
      if (colName.toLowerCase() === fieldName.toLowerCase()) {
        innerColumn = categories[ci];
        break;
      }
    }
    if (!innerColumn) return;

    const valuesColumn = categorical.values?.[0];
    if (!valuesColumn) return;

    // Build inner ring segments grouped by outer category
    const innerSegments: InnerRingSegment[] = [];
    const outerCategory = categories[0];

    for (let i = 0; i < innerColumn.values.length; i++) {
      const parentLabel = outerCategory.values[i] != null ? String(outerCategory.values[i]) : '';
      const label = innerColumn.values[i] != null ? String(innerColumn.values[i]) : '';
      const rawVal = valuesColumn.values[i];
      const value = typeof rawVal === 'number' && !Number.isNaN(rawVal) ? rawVal : 0;
      if (value <= 0) continue;

      innerSegments.push({ label, value, color: '', parentLabel });
    }

    if (innerSegments.length === 0) return;

    // Assign colors: derive from parent's color with slight lightening
    const parentColorMap = new Map<string, string>();
    for (const seg of outerSegments) {
      parentColorMap.set(seg.label, seg.color);
    }

    let colorIndex = 0;
    for (const seg of innerSegments) {
      const parentColor = parentColorMap.get(seg.parentLabel) ?? '#94A3B8';
      seg.color = withOpacity(parentColor, 0.6 + (colorIndex % 3) * 0.15);
      colorIndex++;
    }

    // Inner ring radii: from 60% of innerRadius to innerRadius - 2px gap
    const nestedOuterR = Math.max(0, innerRadius - 2);
    const nestedInnerR = nestedOuterR * 0.5;
    if (nestedOuterR <= nestedInnerR || nestedOuterR <= 0) return;

    const innerTotal = innerSegments.reduce((sum, s) => sum + s.value, 0);
    if (innerTotal <= 0) return;

    const totalArcSpan = layoutEndAngle - layoutStartAngle;
    let currentAngle = layoutStartAngle;

    const arcGen = d3.arc<{ startAngle: number; endAngle: number }>()
      .innerRadius(nestedInnerR)
      .outerRadius(nestedOuterR)
      .startAngle((d) => d.startAngle)
      .endAngle((d) => d.endAngle);

    for (const seg of innerSegments) {
      const fraction = seg.value / innerTotal;
      const arcAngle = fraction * totalArcSpan;
      const endAngle = currentAngle + arcAngle;

      const arcData = { startAngle: currentAngle, endAngle };

      const path = g.append('path')
        .attr('class', 'donut-inner-segment')
        .attr('fill', seg.color)
        .attr('stroke', '#FFFFFF')
        .attr('stroke-width', 0.5);

      if (animEnabled && animDuration > 0) {
        path.attr('d', arcGen({ startAngle: currentAngle, endAngle: currentAngle }));
        const delay = animDuration * 0.3;
        const startA = currentAngle;
        const endA = endAngle;
        const tid = setTimeout(() => {
          const cancel = sweepArc(startA, endA, animDuration, (cur) => {
            path.attr('d', arcGen({ startAngle: startA, endAngle: cur }));
          });
          this.cancelAnimations.push(cancel);
        }, delay);
        this.cancelAnimations.push(() => clearTimeout(tid));
      } else {
        path.attr('d', arcGen(arcData));
      }

      currentAngle = endAngle;
    }
  }

  // ── Center Value ──────────────────────────────────────────────

  private renderCenterValue(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    total: number,
    animEnabled: boolean,
    animDuration: number,
  ): void {
    const vs = this.settings.valueSettings;
    const fontSize = vs.fontSize.value;
    const fontColor = vs.fontColor.value?.value || '#333333';
    const prefix = vs.prefix.value || '';
    const suffix = vs.suffix.value || '';
    const decimals = vs.decimalPlaces.value;

    const centerText = g.append('text')
      .attr('class', 'donut-center-value')
      .attr('x', 0)
      .attr('y', 0)
      .attr('font-size', `${fontSize}px`)
      .attr('fill', fontColor);

    if (animEnabled && animDuration > 0) {
      // Count-up animation
      centerText.text(`${prefix}0${suffix}`);

      const totalDelay = Math.min(
        this.segmentPaths.length * SEGMENT_STAGGER_MS,
        animDuration * 0.5,
      );
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      timeoutId = setTimeout(() => {
        const cancel = countUp(0, total, animDuration, (currentValue) => {
          const formatted = formatNumber(currentValue, {
            decimals,
            prefix,
            suffix,
            abbreviate: false,
          });
          centerText.text(formatted);
        }, () => {
          // Final value — ensure precision
          const formatted = formatNumber(total, {
            decimals,
            prefix,
            suffix,
            abbreviate: false,
          });
          centerText.text(formatted);
        });
        this.cancelAnimations.push(cancel);
      }, totalDelay);

      this.cancelAnimations.push(() => {
        if (timeoutId !== null) clearTimeout(timeoutId);
      });
    } else {
      // No animation — show final value immediately
      const formatted = formatNumber(total, {
        decimals,
        prefix,
        suffix,
        abbreviate: false,
      });
      centerText.text(formatted);
    }
  }

  // ── Legend ──────────────────────────────────────────────────

  private renderSharedLegend(segments: DonutSegment[]): void {
    const legendFmtCard = this.settings.legendFormattingCard;
    const rawFontColor = legendFmtCard.legendFontColor.value?.value;
    const legendFontColor = rawFontColor != null && rawFontColor.length > 0 ? rawFontColor : '#475569';
    const legendFontSize = legendFmtCard.legendFontSize.value;
    const legendPosRaw = legendFmtCard.legendPosition.value;
    const position = (typeof legendPosRaw === 'string'
      ? legendPosRaw
      : (legendPosRaw as { value?: string } | undefined)?.value) ?? 'bottom';
    const validPositions = ['top', 'bottom', 'left', 'right'] as const;
    const legendPos: 'top' | 'bottom' | 'left' | 'right' =
      (validPositions as readonly string[]).includes(position)
        ? (position as 'top' | 'bottom' | 'left' | 'right')
        : 'bottom';

    const items: LegendItem[] = segments.map((seg) => ({
      label: seg.label,
      color: seg.color,
    }));

    const rawLegendFontFamily = resolveDropdown(legendFmtCard.legendFontFamily) || undefined;

    const legendEl = renderLegend(this.container, {
      items,
      position: legendPos,
      fontSize: legendFontSize,
      fontColor: legendFontColor,
      fontFamily: rawLegendFontFamily,
    });

    const animEnabled = this.settings.animationSettings.enabled.value;
    const animDuration = animEnabled ? this.settings.animationSettings.duration.value : 0;

    if (animEnabled && animDuration > 0) {
      const cancel = fadeSlideIn(legendEl, 'up', animDuration * 0.5, animDuration * 0.5);
      this.cancelAnimations.push(cancel);
    }
  }

  // ── Hover Effect ──────────────────────────────────────────────

  private attachHoverEffect(pathNode: SVGPathElement, _index: number): void {
    let hoverCancel: (() => void) | null = null;

    pathNode.addEventListener('mouseenter', () => {
      // Cancel any existing hover animation on this element
      if (hoverCancel) {
        hoverCancel();
        hoverCancel = null;
      }
      hoverCancel = springScale(pathNode, 0, 300, 1, 1.08);
    });

    pathNode.addEventListener('mouseleave', () => {
      if (hoverCancel) {
        hoverCancel();
        hoverCancel = null;
      }
      hoverCancel = springScale(pathNode, 0, 300, 1.08, 1);
    });

    // Track for cleanup
    this.cancelAnimations.push(() => {
      if (hoverCancel) {
        hoverCancel();
        hoverCancel = null;
      }
      pathNode.style.transform = '';
    });
  }

  // ── Tooltips ──────────────────────────────────────────────────

  private attachSegmentTooltip(
    path: d3.Selection<SVGPathElement, unknown, null, undefined>,
    segment: DonutSegment,
    total: number,
  ): void {
    const host = this.host;
    const pct = total > 0 ? ((segment.value / total) * 100).toFixed(1) : '0.0';

    path.on('mouseover', (event: MouseEvent) => {
      const tooltipData: VisualTooltipDataItem[] = [
        { displayName: segment.label, value: formatNumber(segment.value, { abbreviate: false }) },
        { displayName: 'Percentage', value: `${pct}%` },
      ];

      host.tooltipService.show({
        dataItems: tooltipData,
        identities: [],
        coordinates: [event.clientX, event.clientY],
        isTouchEvent: false,
      });
    });

    path.on('mousemove', (event: MouseEvent) => {
      host.tooltipService.move({
        dataItems: [],
        identities: [],
        coordinates: [event.clientX, event.clientY],
        isTouchEvent: false,
      });
    });

    path.on('mouseout', () => {
      host.tooltipService.hide({ immediately: true, isTouchEvent: false });
    });
  }

  // ── Formatting Model ──────────────────────────────────────────

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  // ── Utilities ─────────────────────────────────────────────────

  private clearContainer(): void {
    this.container.removeEventListener('click', this.handleBackgroundClick);
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
  }

  private handleBackgroundClick = (): void => {
    void this.selectionManager.clear();
  };

  private cancelAllAnimations(): void {
    for (const cancel of this.cancelAnimations) {
      cancel();
    }
    this.cancelAnimations = [];
    this.segmentPaths = [];
  }

  // ── Cleanup ───────────────────────────────────────────────────

  public destroy(): void {
    this.cancelAllAnimations();
    this.clearContainer();
  }
}
