/**
 * Funnel Pro — Power BI IVisual implementation.
 * Symmetric funnel chart with trapezoid segments, growBar entrance animation,
 * conversion rate labels, and glassmorphic card styling.
 */

import powerbi from 'powerbi-visuals-api';
import * as d3 from 'd3';
import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel';
import { FunnelProSettings } from './settings';
import {
  growBar,
  fadeSlideIn,
  countUp,
  animate,
  cubicOut,
  DURATION,
  formatNumber,
  getGlassStyle,
  getHostChartColor,
  withOpacity,
  renderChartTitle,
  applyDataLabelFormatting,
  resolveColorTheme,
  resolveDropdown,
  buildConditionalConfig,
  resolveConditionalColor,
  applyChartAria,
  attachKeyboardNav,
  ensureFocusRingStyles,
  renderHorizontalReferenceLine,
  computeStatValue,
  type StatType,
  renderTrendLine,
  computeRegression,
  type TrendType,
} from '../../core/src';

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataView = powerbi.DataView;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;
import ISelectionId = powerbi.visuals.ISelectionId;

import '../style/visual.less';

// ── Types ────────────────────────────────────────────────────────────

interface FunnelStage {
  label: string;
  value: number;
  selectionId: ISelectionId;
}

// ── Constants ────────────────────────────────────────────────────────

/** Stagger delay (ms) between each trapezoid's entrance animation. */
const SEGMENT_STAGGER_MS = 80;

/** Minimum width ratio for the narrowest segment (prevents invisible stages). */
const MIN_WIDTH_RATIO = 0.20;

/** Padding inside the SVG viewport (px). */
const SVG_PADDING = 12;

/** Height reserved for conversion rate labels between segments. */
const CONVERSION_LABEL_HEIGHT = 16;

// ── Visual ───────────────────────────────────────────────────────────

export class FunnelProVisual implements IVisual {
  private host: IVisualHost;
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private container: HTMLElement;
  private settings: FunnelProSettings;
  private formattingSettingsService: FormattingSettingsService;
  private cancelAnimations: Array<() => void> = [];

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new FunnelProSettings();
    this.formattingSettingsService = new FormattingSettingsService();
    this.container.classList.add('funnel-container');
  }

  public update(options: VisualUpdateOptions): void {
    // Cancel running animations before re-render
    this.cancelAllAnimations();

    // Parse settings from dataView
    const dataView = options.dataViews?.[0];
    if (dataView) {
      this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
        FunnelProSettings,
        dataView,
      );
    }

    // Hide inapplicable shared axis properties — funnel-pro doesn't use titles/rotation/min/max/fontFamily/gridLineWidth/gridLineOpacity
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

    // Extract data
    const stages = this.extractData(dataView);

    // Apply glass effect
    this.applyCardStyle();

    // Render
    if (stages.length === 0) {
      this.renderEmpty();
    } else {
      this.render(stages, options.viewport);
    }
  }

  // ── Data Extraction ──────────────────────────────────────────────

  private extractData(dataView: DataView | undefined): FunnelStage[] {
    if (!dataView?.categorical) return [];

    const categorical = dataView.categorical;
    const categoryColumn = categorical.categories?.[0];
    const valuesColumn = categorical.values?.[0];

    if (!categoryColumn || !valuesColumn) return [];

    const categories = categoryColumn.values;
    const values = valuesColumn.values;

    if (!categories || !values || categories.length === 0) return [];

    const stages: FunnelStage[] = [];

    for (let i = 0; i < categories.length; i++) {
      const label = categories[i] !== null && categories[i] !== undefined
        ? String(categories[i])
        : '';
      const rawVal = values[i];
      const value = typeof rawVal === 'number' && !Number.isNaN(rawVal) ? rawVal : 0;

      // Skip zero/negative values
      if (value <= 0) continue;

      stages.push({
        label,
        value,
        selectionId: this.host.createSelectionIdBuilder()
          .withCategory(categoryColumn, i)
          .createSelectionId(),
      });
    }

    // Funnel order is data order — do NOT sort by value
    return stages;
  }

  // ── Card Style ─────────────────────────────────────────────────

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
      this.container.style.background = '';
      this.container.style.backdropFilter = '';
      (this.container.style as unknown as Record<string, string>)['WebkitBackdropFilter'] = '';
      this.container.style.border = '';
      this.container.style.boxShadow = '';
      this.container.style.borderRadius = `${s.borderRadius.value}px`;
    }
  }

  // ── Empty State ────────────────────────────────────────────────

  private renderEmpty(): void {
    this.clearContainer();
    const emptyEl = document.createElement('div');
    emptyEl.className = 'funnel-empty';
    emptyEl.textContent = 'Add a Stage and a Value to get started.';
    this.container.appendChild(emptyEl);
  }

  // ── Main Render ────────────────────────────────────────────────

  private render(stages: FunnelStage[], viewport: powerbi.IViewport): void {
    this.clearContainer();
    renderChartTitle(this.container, this.settings.titleFormattingCard);
    this.container.removeEventListener('click', this.handleBackgroundClick);

    const s = this.settings;
    const funnelStyle = String(s.funnelSettings.style.value?.value ?? 'symmetric');
    const showConversion = s.funnelSettings.showConversionRate.value;
    const pyramidMode = s.funnelSettings.pyramidMode.value;
    const gap = Math.max(0, s.funnelSettings.gap.value);
    const showValues = s.funnelSettings.showValues.value;
    const useGradient = s.colorSettings.useGradient.value;
    const baseColor = s.colorSettings.baseColor.value?.value || '#3B82F6';
    const animEnabled = s.animationSettings.enabled.value;
    const animDuration = animEnabled ? s.animationSettings.duration.value : 0;
    const axisColor = s.axisFormattingCard.axisLabelColor.value?.value || '#64748B';
    const axisLabelSize = s.axisFormattingCard.axisLabelSize.value;
    const axisLineColor = s.axisFormattingCard.axisLineColor.value?.value || '#CBD5E1';
    const axisLineWidth = s.axisFormattingCard.axisLineWidth.value;
    const showGridLines = s.axisFormattingCard.showGridLines.value;
    const gridLineColor = s.axisFormattingCard.gridLineColor.value?.value || '#E2E8F0';
    const gridLineStyleValue = s.axisFormattingCard.gridLineStyle.value;
    const gridLineStyle = typeof gridLineStyleValue === 'string'
      ? gridLineStyleValue
      : (gridLineStyleValue as { value?: string } | undefined)?.value ?? 'dashed';
    const gridDash = gridLineStyle === 'dashed' ? '4 3' : 'none';
    const svgWidth = viewport.width - SVG_PADDING * 2;
    const svgHeight = viewport.height - SVG_PADDING * 2;

    if (svgWidth <= 0 || svgHeight <= 0) {
      this.renderEmpty();
      return;
    }

    // Create SVG
    const svg = d3.select(this.container)
      .append('svg')
      .attr('width', svgWidth)
      .attr('height', svgHeight);

    const stageCount = stages.length;
    const firstValue = stages[0].value;

    // Layout settings
    const neckWidthPct = Math.max(5, Math.min(100, s.funnelLayoutSettings.neckWidth.value)) / 100;
    const neckHeightPct = Math.max(0, Math.min(80, s.funnelLayoutSettings.neckHeight.value)) / 100;
    const dynamicHeight = s.funnelLayoutSettings.dynamicHeight.value;

    // Calculate total gaps and conversion label space
    const totalGaps = gap * (stageCount - 1);
    const conversionRows = showConversion ? stageCount - 1 : 0;
    const totalConversionHeight = conversionRows * CONVERSION_LABEL_HEIGHT;
    const availableHeight = svgHeight - totalGaps - totalConversionHeight;

    // Compute per-stage heights: when dynamicHeight is enabled, heights vary by value
    let segmentHeights: number[];
    if (dynamicHeight && stageCount > 0) {
      const totalValue = stages.reduce((sum, st) => sum + st.value, 0);
      if (totalValue > 0) {
        segmentHeights = stages.map((st) =>
          Math.max(1, (st.value / totalValue) * availableHeight),
        );
      } else {
        segmentHeights = stages.map(() => Math.max(1, availableHeight / stageCount));
      }
    } else {
      const uniformHeight = Math.max(1, availableHeight / stageCount);
      segmentHeights = stages.map(() => uniformHeight);
    }
    // Alias for uniform fallback used elsewhere
    const segmentHeight = Math.max(1, availableHeight / stageCount);

    // Max funnel width — leave some horizontal margin for labels
    const maxFunnelWidth = svgWidth * 0.85;
    const centerX = svgWidth / 2;

    // Neck width: the minimum width at the bottom of the funnel
    const neckMinWidth = neckWidthPct * maxFunnelWidth;

    // Determine which stages are in the "neck" region
    // neckHeight determines the bottom percentage of stages that form the neck
    const neckStageCount = Math.max(1, Math.round(neckHeightPct * stageCount));
    const neckStartIndex = stageCount - neckStageCount;

    // Compute widths: proportional to value relative to first stage value, with neck constraints
    const widths = stages.map((stage, index) => {
      const ratio = firstValue > 0 ? stage.value / firstValue : 1;
      const clampedRatio = Math.max(MIN_WIDTH_RATIO, Math.min(1, ratio));
      let width = clampedRatio * maxFunnelWidth;

      // Apply neck width constraint: stages in the neck region use the neck width
      if (index >= neckStartIndex) {
        width = Math.min(width, neckMinWidth);
      }

      return width;
    });

    // Pyramid mode: reverse the width mapping so widest segment is at the bottom
    if (pyramidMode) {
      widths.reverse();
      segmentHeights.reverse();
    }

    // ── Grid lines (horizontal reference lines at stage boundaries) ───
    if (showGridLines) {
      const gridGroup = svg.append('g').attr('class', 'funnel-grid');
      let gridY = 0;
      for (let gi = 0; gi <= stageCount; gi++) {
        gridGroup.append('line')
          .attr('x1', 0)
          .attr('y1', gridY)
          .attr('x2', svgWidth)
          .attr('y2', gridY)
          .attr('stroke', gridLineColor)
          .attr('stroke-dasharray', gridDash)
          .attr('stroke-opacity', 0.6);
        if (gi < stageCount) {
          gridY += segmentHeights[gi];
          if (showConversion && gi < stageCount - 1) {
            gridY += gap + CONVERSION_LABEL_HEIGHT;
          } else if (gi < stageCount - 1) {
            gridY += gap;
          }
        }
      }
    }

    // ── Axis separator lines (between segments in the gap area) ─────
    if (axisLineWidth > 0 && stageCount > 1) {
      const axisGroup = svg.append('g').attr('class', 'funnel-axis-lines');
      let sepY = segmentHeights[0];
      for (let si = 0; si < stageCount - 1; si++) {
        const sepLineY = sepY + gap / 2;
        axisGroup.append('line')
          .attr('x1', 0)
          .attr('y1', sepLineY)
          .attr('x2', svgWidth)
          .attr('y2', sepLineY)
          .attr('stroke', axisLineColor)
          .attr('stroke-width', axisLineWidth)
          .attr('stroke-opacity', 0.5);
        sepY += segmentHeights[si + 1] + gap;
        if (showConversion) {
          sepY += CONVERSION_LABEL_HEIGHT;
        }
      }
    }

    // Draw each trapezoid stage
    let currentY = 0;

    stages.forEach((stage, index) => {
      const stageH = segmentHeights[index];
      const topWidth = widths[index];
      const bottomWidth = index < stageCount - 1 ? widths[index + 1] : topWidth;

      // Compute path with rounded corners
      const borderRadius = Math.max(0, s.funnelLayoutSettings.borderRadius.value);
      const pathD = this.computeTrapezoidPath(
        funnelStyle,
        centerX,
        maxFunnelWidth,
        currentY,
        stageH,
        topWidth,
        bottomWidth,
        borderRadius,
      );

      // Determine color (conditional formatting overrides base color)
      const baseSegColor = this.getStageColor(index, stageCount, useGradient, baseColor);
      const color = this.getConditionalSegmentColor(stage.value) ?? baseSegColor;

      // Draw path (trapezoid with optional rounded corners)
      const segStrokeColor = s.funnelSettings.segmentStrokeColor.value?.value;
      const polygon = svg.append('path')
        .attr('class', 'funnel-stage')
        .attr('d', pathD)
        .attr('fill', color)
        .attr('stroke', segStrokeColor || withOpacity(color, 0.3))
        .attr('stroke-width', s.funnelSettings.segmentStrokeWidth.value);

      // Hover tooltip
      this.attachStageTooltip(polygon, stage, stages, index);
      polygon
        .style('cursor', 'pointer')
        .on('click', (event: MouseEvent) => {
          event.stopPropagation();
          void this.selectionManager.select(stage.selectionId, event.ctrlKey || event.metaKey);
        })
        .on('contextmenu', (event: MouseEvent) => {
          event.preventDefault();
          event.stopPropagation();
          void this.selectionManager.showContextMenu(stage.selectionId, {
            x: event.clientX,
            y: event.clientY,
          });
        });

      // Animation: growBar entrance from top
      if (animEnabled && animDuration > 0) {
        const polygonNode = polygon.node();
        if (polygonNode) {
          const delay = index * SEGMENT_STAGGER_MS;
          const cancel = growBar(polygonNode, delay, animDuration, 'vertical');
          this.cancelAnimations.push(cancel);
        }
      }

      // Stage label (centered within trapezoid)
      const labelY = currentY + stageH / 2;
      const labelX = funnelStyle === 'symmetric' ? centerX : topWidth / 2;

      const stageLabelColor = s.funnelSettings.labelColor.value?.value;
      const labelText = svg.append('text')
        .attr('class', 'funnel-stage-label')
        .attr('x', labelX)
        .attr('y', labelY)
        .text(stage.label);

      if (stageLabelColor) {
        labelText.attr('fill', stageLabelColor);
      }

      // Value label below stage label — local showValues controls visibility,
      // shared DataLabelFormattingCard controls styling (font size, color, weight)
      if (showValues) {
        const valueText = svg.append('text')
          .attr('class', 'funnel-value-label')
          .attr('x', labelX)
          .attr('y', labelY + 14)
          .text(formatNumber(stage.value));

        if (animEnabled && animDuration > 0) {
          const valueNode = valueText.node();
          if (valueNode) {
            const delay = index * SEGMENT_STAGGER_MS + animDuration * 0.3;
            const cancel = fadeSlideIn(valueNode as unknown as HTMLElement, 'up', 300, delay);
            this.cancelAnimations.push(cancel);
          }
        }
      }

      // Animate label fade-in
      if (animEnabled && animDuration > 0) {
        const labelNode = labelText.node();
        if (labelNode) {
          const delay = index * SEGMENT_STAGGER_MS + animDuration * 0.2;
          const cancel = fadeSlideIn(labelNode as unknown as HTMLElement, 'up', 300, delay);
          this.cancelAnimations.push(cancel);
        }
      }

      // Move Y cursor past this segment
      currentY += stageH;

      // Conversion rate label between stages
      if (showConversion && index < stageCount - 1) {
        const nextStage = stages[index + 1];
        const conversionPct = stage.value > 0
          ? ((nextStage.value / stage.value) * 100).toFixed(1)
          : '0.0';

        const convLabelY = currentY + gap / 2 + CONVERSION_LABEL_HEIGHT / 2;

        const convText = svg.append('text')
          .attr('class', 'funnel-conversion')
          .attr('x', funnelStyle === 'symmetric' ? centerX : maxFunnelWidth / 2)
          .attr('y', convLabelY)
          .attr('fill', axisColor)
          .attr('font-size', `${axisLabelSize}px`)
          .text(`\u2192 ${conversionPct}%`);

        if (animEnabled && animDuration > 0) {
          const convNode = convText.node();
          if (convNode) {
            const delay = (index + 1) * SEGMENT_STAGGER_MS + animDuration * 0.5;
            const cancel = fadeSlideIn(convNode as unknown as HTMLElement, 'up', 300, delay);
            this.cancelAnimations.push(cancel);
          }
        }

        currentY += gap + CONVERSION_LABEL_HEIGHT;
      } else if (index < stageCount - 1) {
        // Gap only, no conversion label
        currentY += gap;
      }
    });
    // Render drop-off highlighting between stages
    this.renderDropOffHighlighting(svg, stages, widths, segmentHeights, gap, showConversion, funnelStyle, centerX);

    // ── Stage Annotations (conversion rates next to segments) ──────
    if (s.funnelAnnotationSettings.show.value && stages.length >= 2) {
      const annotGroup = svg.append('g').attr('class', 'funnel-annotations');
      let annotY = 0;

      for (let ai = 0; ai < stages.length; ai++) {
        const stageH = segmentHeights[ai];

        if (ai > 0) {
          const prevVal = stages[ai - 1].value;
          const convPct = prevVal > 0
            ? ((stages[ai].value / prevVal) * 100).toFixed(1)
            : '0.0';

          const annotLabelY = annotY + stageH / 2;
          const annotLabelX = funnelStyle === 'symmetric'
            ? centerX + widths[ai] / 2 + 10
            : widths[ai] + 10;

          annotGroup.append('text')
            .attr('class', 'funnel-annotation-label')
            .attr('x', annotLabelX)
            .attr('y', annotLabelY)
            .attr('fill', '#64748B')
            .attr('font-size', '10px')
            .attr('dominant-baseline', 'middle')
            .text(`${convPct}% conversion`);
        }

        annotY += stageH;
        if (showConversion && ai < stages.length - 1) {
          annotY += gap + CONVERSION_LABEL_HEIGHT;
        } else if (ai < stages.length - 1) {
          annotY += gap;
        }
      }
    }

    // Apply shared formatting settings
    applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.funnel-value-label');

    // ── Reference Line & Trend Line overlays ──────────────────────
    const allValues = stages.map((st) => st.value);
    const maxVal = Math.max(...allValues);
    const yScale = d3.scaleLinear().domain([0, maxVal]).range([svgHeight, 0]);
    const overlayG = svg.append('g').attr('class', 'funnel-overlay');

    this.renderReferenceLine(overlayG, yScale, svgWidth, allValues);
    this.renderTrendLineOverlay(overlayG, allValues, (i) => {
      // Map stage index to vertical center of segment
      let cy = 0;
      for (let k = 0; k < i; k++) {
        cy += segmentHeights[k];
        if (showConversion && k < stageCount - 1) cy += gap + CONVERSION_LABEL_HEIGHT;
        else if (k < stageCount - 1) cy += gap;
      }
      return cy + segmentHeights[i] / 2;
    }, yScale);

    // ── Accessibility ─────────────────────────────────────────────
    this.applyAccessibility(stages);

    this.container.addEventListener('click', this.handleBackgroundClick);
  }

  // ── Drop-Off Highlighting ─────────────────────────────────────

  private renderDropOffHighlighting(
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    stages: FunnelStage[],
    widths: number[],
    segmentHeights: number[],
    gap: number,
    showConversion: boolean,
    funnelStyle: string,
    centerX: number,
  ): void {
    const compSettings = this.settings.funnelComparisonSettings;
    if (!compSettings.enabled.value || !compSettings.showDropOff.value || stages.length < 2) return;

    const dropOffColor = compSettings.dropOffColor.value?.value ?? '#EF4444';

    let currentY = 0;

    for (let i = 0; i < stages.length - 1; i++) {
      const currentWidth = widths[i];
      const nextWidth = widths[i + 1];

      if (currentWidth <= nextWidth) {
        // No drop-off when next stage is wider
        currentY += segmentHeights[i];
        if (showConversion) currentY += gap + CONVERSION_LABEL_HEIGHT;
        else currentY += gap;
        continue;
      }

      // Draw drop-off indicator at the bottom of the current segment
      const y = currentY + segmentHeights[i];
      const dropWidth = currentWidth - nextWidth;

      if (funnelStyle === 'symmetric') {
        // Left side drop-off
        svg.append('rect')
          .attr('class', 'funnel-dropoff')
          .attr('x', centerX - currentWidth / 2)
          .attr('y', y)
          .attr('width', dropWidth / 2)
          .attr('height', gap > 0 ? gap : 3)
          .attr('fill', withOpacity(dropOffColor, 0.3))
          .style('pointer-events', 'none');

        // Right side drop-off
        svg.append('rect')
          .attr('class', 'funnel-dropoff')
          .attr('x', centerX + nextWidth / 2)
          .attr('y', y)
          .attr('width', dropWidth / 2)
          .attr('height', gap > 0 ? gap : 3)
          .attr('fill', withOpacity(dropOffColor, 0.3))
          .style('pointer-events', 'none');
      } else {
        // Left-aligned: drop-off on the right side
        svg.append('rect')
          .attr('class', 'funnel-dropoff')
          .attr('x', nextWidth)
          .attr('y', y)
          .attr('width', dropWidth)
          .attr('height', gap > 0 ? gap : 3)
          .attr('fill', withOpacity(dropOffColor, 0.3))
          .style('pointer-events', 'none');
      }

      currentY += segmentHeights[i];
      if (showConversion) currentY += gap + CONVERSION_LABEL_HEIGHT;
      else currentY += gap;
    }
  }

  // ── Trapezoid Geometry ─────────────────────────────────────────

  /**
   * Builds an SVG `<path>` d-attribute for a trapezoid with rounded corners.
   * When `r` is 0 the result is a sharp-cornered trapezoid.
   */
  private computeTrapezoidPath(
    style: string,
    centerX: number,
    _maxWidth: number,
    y: number,
    height: number,
    topWidth: number,
    bottomWidth: number,
    r: number,
  ): string {
    let x1: number, y1: number, x2: number, y2: number;
    let x3: number, y3: number, x4: number, y4: number;

    if (style === 'leftAligned') {
      // TL, TR, BR, BL
      x1 = 0;       y1 = y;
      x2 = topWidth; y2 = y;
      x3 = bottomWidth; y3 = y + height;
      x4 = 0;            y4 = y + height;
    } else {
      // Symmetric
      x1 = centerX - topWidth / 2;    y1 = y;
      x2 = centerX + topWidth / 2;    y2 = y;
      x3 = centerX + bottomWidth / 2; y3 = y + height;
      x4 = centerX - bottomWidth / 2; y4 = y + height;
    }

    // Clamp radius so it doesn't exceed half the shortest edge
    const topEdge = Math.abs(x2 - x1);
    const bottomEdge = Math.abs(x3 - x4);
    const leftEdge = Math.hypot(x4 - x1, y4 - y1);
    const rightEdge = Math.hypot(x3 - x2, y3 - y2);
    const minHalf = Math.min(topEdge, bottomEdge, leftEdge, rightEdge) / 2;
    const radius = Math.max(0, Math.min(r, minHalf));

    if (radius <= 0) {
      return `M${x1},${y1} L${x2},${y2} L${x3},${y3} L${x4},${y4} Z`;
    }

    // Use quadratic Bezier curves at each corner for rounding
    return [
      `M${x1 + radius},${y1}`,
      `L${x2 - radius},${y2}`,
      `Q${x2},${y2} ${x2},${y2 + radius}`,
      `L${x3},${y3 - radius}`,
      `Q${x3},${y3} ${x3 - radius},${y3}`,
      `L${x4 + radius},${y4}`,
      `Q${x4},${y4} ${x4},${y4 - radius}`,
      `L${x1},${y1 + radius}`,
      `Q${x1},${y1} ${x1 + radius},${y1}`,
      'Z',
    ].join(' ');
  }

  // ── Stage Coloring ─────────────────────────────────────────────

  private getStageColor(
    index: number,
    total: number,
    useGradient: boolean,
    baseColor: string,
  ): string {
    const themeName = resolveColorTheme(this.settings.colorThemeFormattingCard);
    if (!useGradient) {
      return getHostChartColor(this.host.colorPalette, index, themeName);
    }

    // Generate progressively lighter shades from the base color
    // First stage = full color, last = lighter
    const lightnessFactor = total > 1 ? index / (total - 1) : 0;
    return this.lightenColor(baseColor, lightnessFactor * 0.45);
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

  // ── Tooltips ───────────────────────────────────────────────────

  private attachStageTooltip(
    polygon: d3.Selection<SVGPathElement, unknown, null, undefined>,
    stage: FunnelStage,
    allStages: FunnelStage[],
    index: number,
  ): void {
    const host = this.host;

    polygon.on('mouseover', (event: MouseEvent) => {
      const tooltipData: VisualTooltipDataItem[] = [
        { displayName: stage.label, value: formatNumber(stage.value, { abbreviate: false }) },
      ];

      // Add conversion from previous stage if applicable
      if (index > 0) {
        const prevValue = allStages[index - 1].value;
        const convPct = prevValue > 0
          ? ((stage.value / prevValue) * 100).toFixed(1)
          : '0.0';
        tooltipData.push({
          displayName: 'Conversion from previous',
          value: `${convPct}%`,
        });
      }

      // Add overall funnel conversion (from first stage)
      if (index > 0) {
        const firstValue = allStages[0].value;
        const overallPct = firstValue > 0
          ? ((stage.value / firstValue) * 100).toFixed(1)
          : '0.0';
        tooltipData.push({
          displayName: 'Overall conversion',
          value: `${overallPct}%`,
        });
      }

      host.tooltipService.show({
        dataItems: tooltipData,
        identities: [],
        coordinates: [event.clientX, event.clientY],
        isTouchEvent: false,
      });
    });

    polygon.on('mousemove', (event: MouseEvent) => {
      host.tooltipService.move({
        dataItems: [],
        identities: [],
        coordinates: [event.clientX, event.clientY],
        isTouchEvent: false,
      });
    });

    polygon.on('mouseout', () => {
      host.tooltipService.hide({ immediately: true, isTouchEvent: false });
    });
  }

  // ── Conditional Formatting ──────────────────────────────────────

  /**
   * Resolves conditional color for a funnel segment value, or returns undefined if not enabled.
   */
  private getConditionalSegmentColor(value: number): string | undefined {
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

  // ── Reference Line ────────────────────────────────────────────

  /**
   * Renders a horizontal reference line on the funnel overlay group.
   */
  private renderReferenceLine(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    yScale: d3.ScaleLinear<number, number>,
    chartWidth: number,
    allValues: number[],
  ): void {
    const ref = this.settings.referenceLineFormattingCard;
    if (!ref.showReferenceLine.value) return;

    const refType = resolveDropdown(ref.referenceLineType) ?? 'custom';
    let refValue = ref.referenceLineValue.value;

    if (refType !== 'custom' && allValues.length > 0) {
      refValue = computeStatValue(allValues, refType as StatType);
    }

    const refColor = ref.referenceLineColor.value?.value ?? '#EF4444';
    const refStyle = (resolveDropdown(ref.referenceLineStyle) ?? 'dashed') as 'solid' | 'dashed' | 'dotted';
    const labelText = ref.referenceLabelText.value || formatNumber(refValue);

    renderHorizontalReferenceLine(g, {
      value: refValue,
      yScale,
      chartWidth,
      lineColor: refColor,
      lineWidth: ref.referenceLineWidth.value,
      lineStyle: refStyle,
      showLabel: ref.showReferenceLabel.value,
      labelText,
      showBand: ref.showReferenceBand.value,
      bandOpacity: ref.referenceBandOpacity.value / 100,
    });
  }

  // ── Trend Line ────────────────────────────────────────────────

  /**
   * Renders a trend/regression line through the funnel stage values.
   */
  private renderTrendLineOverlay(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    values: number[],
    xScale: (index: number) => number,
    yScale: d3.ScaleLinear<number, number>,
  ): void {
    const tl = this.settings.trendLineFormattingCard;
    if (!tl.showTrendLine.value || values.length < 2) return;

    const trendType = (resolveDropdown(tl.trendLineType) ?? 'linear') as TrendType;
    const result = computeRegression(values, trendType, tl.polynomialOrder.value);
    const trendColor = tl.trendLineColor.value?.value ?? '#6366F1';

    renderTrendLine(g, {
      predicted: result.predicted,
      xScale,
      yScale,
      lineColor: trendColor,
      lineWidth: tl.trendLineWidth.value,
      showEquation: tl.showEquation.value,
      showR2: tl.showR2.value,
      equation: result.equation,
      r2: result.r2,
    });
  }

  // ── Accessibility ─────────────────────────────────────────────

  /**
   * Applies ARIA labels, keyboard navigation, and focus ring styles.
   */
  private applyAccessibility(stages: FunnelStage[]): void {
    const acc = this.settings.accessibilityFormattingCard;
    if (!acc.enableKeyboardNav.value) return;

    ensureFocusRingStyles();

    applyChartAria(this.container, {
      chartType: 'funnel chart',
      title: this.settings.titleFormattingCard.titleText.value || undefined,
      dataPointCount: stages.length,
    });

    const cleanup = attachKeyboardNav({
      container: this.container,
      itemSelector: '.funnel-stage, [tabindex="0"]',
      onActivate: (el) => {
        (el as HTMLElement).click?.();
      },
    });
    this.cancelAnimations.push(cleanup);
  }

  // ── Formatting Model ───────────────────────────────────────────

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  // ── Utilities ──────────────────────────────────────────────────

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
  }

  // ── Cleanup ────────────────────────────────────────────────────

  public destroy(): void {
    this.cancelAllAnimations();
    this.clearContainer();
  }
}
