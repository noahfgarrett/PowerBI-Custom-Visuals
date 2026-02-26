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
        backgroundColor: ((s as any).backgroundColor?.value?.value ?? (s as any).bgColor?.value?.value),
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
    const showDataLabels = s.dataLabelFormattingCard.showDataLabels.value;

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

    // Calculate total gaps and conversion label space
    const totalGaps = gap * (stageCount - 1);
    const conversionRows = showConversion ? stageCount - 1 : 0;
    const totalConversionHeight = conversionRows * CONVERSION_LABEL_HEIGHT;
    const availableHeight = svgHeight - totalGaps - totalConversionHeight;
    const segmentHeight = Math.max(1, availableHeight / stageCount);

    // Max funnel width — leave some horizontal margin for labels
    const maxFunnelWidth = svgWidth * 0.85;
    const centerX = svgWidth / 2;

    // Compute widths: proportional to value relative to first stage value
    const widths = stages.map((stage) => {
      const ratio = firstValue > 0 ? stage.value / firstValue : 1;
      const clampedRatio = Math.max(MIN_WIDTH_RATIO, Math.min(1, ratio));
      return clampedRatio * maxFunnelWidth;
    });

    // Pyramid mode: reverse the width mapping so widest segment is at the bottom
    if (pyramidMode) {
      widths.reverse();
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
          gridY += segmentHeight;
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
      let sepY = segmentHeight;
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
        sepY += segmentHeight + gap;
        if (showConversion) {
          sepY += CONVERSION_LABEL_HEIGHT;
        }
      }
    }

    // Draw each trapezoid stage
    let currentY = 0;

    stages.forEach((stage, index) => {
      const topWidth = widths[index];
      const bottomWidth = index < stageCount - 1 ? widths[index + 1] : topWidth;

      // Compute polygon points based on style
      const points = this.computeTrapezoidPoints(
        funnelStyle,
        centerX,
        maxFunnelWidth,
        currentY,
        segmentHeight,
        topWidth,
        bottomWidth,
      );

      // Determine color
      const color = this.getStageColor(index, stageCount, useGradient, baseColor);

      // Draw polygon
      const segStrokeColor = s.funnelSettings.segmentStrokeColor.value?.value;
      const polygon = svg.append('polygon')
        .attr('class', 'funnel-stage')
        .attr('points', points)
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
      const labelY = currentY + segmentHeight / 2;
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

      // Value label below stage label
      if (showValues && showDataLabels) {
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
      currentY += segmentHeight;

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
    // Apply shared formatting settings
    applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.funnel-value-label');

    this.container.addEventListener('click', this.handleBackgroundClick);
  }

  // ── Trapezoid Geometry ─────────────────────────────────────────

  private computeTrapezoidPoints(
    style: string,
    centerX: number,
    _maxWidth: number,
    y: number,
    height: number,
    topWidth: number,
    bottomWidth: number,
  ): string {
    if (style === 'leftAligned') {
      // Left-aligned: all trapezoids start from left edge
      const topLeft = `0,${y}`;
      const topRight = `${topWidth},${y}`;
      const bottomRight = `${bottomWidth},${y + height}`;
      const bottomLeft = `0,${y + height}`;
      return `${topLeft} ${topRight} ${bottomRight} ${bottomLeft}`;
    }

    // Symmetric (default): centered horizontally
    const topLeft = `${centerX - topWidth / 2},${y}`;
    const topRight = `${centerX + topWidth / 2},${y}`;
    const bottomRight = `${centerX + bottomWidth / 2},${y + height}`;
    const bottomLeft = `${centerX - bottomWidth / 2},${y + height}`;
    return `${topLeft} ${topRight} ${bottomRight} ${bottomLeft}`;
  }

  // ── Stage Coloring ─────────────────────────────────────────────

  private getStageColor(
    index: number,
    total: number,
    useGradient: boolean,
    baseColor: string,
  ): string {
    if (!useGradient) {
      return getHostChartColor(this.host.colorPalette, index);
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
    polygon: d3.Selection<SVGPolygonElement, unknown, null, undefined>,
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
