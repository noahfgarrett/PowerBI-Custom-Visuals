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
  formatNumber,
  formatWithSettings,
  applyCardStyle,
  type CardStyleMode,
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
  getDateFilterIndices,
  isDateColumn,
  type DateFilterConfig,
  hideInlineLegendFormatting,
  syncCardStyleVisibility,
  syncDateFilterFormattingVisibility,
  syncLegendFormattingVisibility,
  syncTitleFormattingVisibility,
  getLocalizedString,
  getVisualEmptyStateMode,
  allowInteractions,
  getHostHighContrastColors,
  applyBasicHighContrastStyles,
  notifyRenderingStarted,
  notifyRenderingFinished,
  notifyRenderingFailed,
  prefersReducedMotion,
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
  highlighted: boolean;
}

interface DonutData {
  segments: DonutSegment[];
  hasHighlights: boolean;
}

type CenterDisplayMode = 'selectedOrTotal' | 'total' | 'selectedOnly' | 'firstSlice' | 'customText';
type CenterCaptionMode = 'none' | 'auto' | 'custom';

interface CenterContent {
  primaryText: string;
  captionText: string;
  numericValue: number | null;
}

interface SegmentArc {
  startAngle: number;
  endAngle: number;
  segment: DonutSegment;
}

interface NestedAggregate {
  value: number;
  firstIndex: number;
  highlighted: boolean;
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

  /** Cached data for cross-highlight support. */
  private currentData: DonutData | null = null;
  private currentNestedSegments: DonutSegment[] = [];
  private emptyStateMode: 'unconfigured' | 'noData' = 'unconfigured';
  private centerValueElement: SVGTextElement | null = null;
  private centerCaptionElement: SVGTextElement | null = null;

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new AnimatedDonutProSettings();
    this.formattingSettingsService = new FormattingSettingsService(options.host.createLocalizationManager());
    this.container.classList.add('donut-container');
  }

  public update(options: VisualUpdateOptions): void {
    notifyRenderingStarted(this.host, options);
    try {
      this.updateVisual(options);
      this.applyHighContrast();
      notifyRenderingFinished(this.host, options);
    } catch (error) {
      notifyRenderingFailed(this.host, options, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private updateVisual(options: VisualUpdateOptions): void {
    // Cancel running animations before re-render
    this.cancelAllAnimations();

    // Parse settings from dataView
    const dataView = options.dataViews?.[0];
    this.emptyStateMode = getVisualEmptyStateMode(dataView);
    if (dataView) {
      this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
        AnimatedDonutProSettings,
        dataView,
      );
    }

    // Migrate legacy enableGlass -> cardStyleMode (backward compat)
    const legacyCardObj = dataView?.metadata?.objects?.['cardSettings'];
    if (legacyCardObj) {
      const legacyGlass = legacyCardObj['enableGlass'];
      if (legacyGlass === false && legacyCardObj['cardStyleMode'] == null) {
        this.settings.cardSettings.cardStyleMode.value = { value: 'none', displayName: 'None' };
      }
    }

    // ── Conditional visibility ──────────────────────────────────────
    const s = this.settings;

    syncTitleFormattingVisibility(s.titleFormattingCard);
    syncLegendFormattingVisibility(s.legendFormattingCard);

    // Center value sub-settings: hide when showCenter is off
    const showCenter = s.donutSettings.showCenter.value;
    const centerDisplayMode = (resolveDropdown(s.valueSettings.displayMode) ?? 'selectedOrTotal') as CenterDisplayMode;
    const centerCaptionMode = (resolveDropdown(s.valueSettings.captionMode) ?? 'none') as CenterCaptionMode;
    const centerUsesNumericValue = centerDisplayMode !== 'customText';
    s.valueSettings.fontSize.visible = showCenter;
    s.valueSettings.fontColor.visible = showCenter;
    s.valueSettings.fontFamily.visible = showCenter;
    s.valueSettings.fontWeight.visible = showCenter;
    s.valueSettings.verticalOffset.visible = showCenter;
    s.valueSettings.displayMode.visible = showCenter;
    s.valueSettings.prefix.visible = showCenter && centerUsesNumericValue;
    s.valueSettings.suffix.visible = showCenter && centerUsesNumericValue;
    s.valueSettings.decimalPlaces.visible = showCenter && centerUsesNumericValue;
    s.valueSettings.customText.visible = showCenter && centerDisplayMode === 'customText';
    s.valueSettings.noSelectionText.visible = showCenter && centerDisplayMode === 'selectedOnly';
    s.valueSettings.captionMode.visible = showCenter;
    s.valueSettings.customCaption.visible = showCenter && centerCaptionMode === 'custom';
    s.valueSettings.captionFontSize.visible = showCenter && centerCaptionMode !== 'none';
    s.valueSettings.captionColor.visible = showCenter && centerCaptionMode !== 'none';
    s.valueSettings.captionFontFamily.visible = showCenter && centerCaptionMode !== 'none';
    s.valueSettings.captionFontWeight.visible = showCenter && centerCaptionMode !== 'none';
    s.valueSettings.captionSpacing.visible = showCenter && centerCaptionMode !== 'none';

    // Top N sub-settings: hide when Top N is disabled
    const topNEnabled = s.topNSettings.enabled.value;
    s.topNSettings.topN.visible = topNEnabled;
    s.topNSettings.othersLabel.visible = topNEnabled;
    s.topNSettings.othersColor.visible = topNEnabled;
    s.topNSettings.sortBy.visible = topNEnabled;

    // Explode distance: hide when explode is off
    s.donutExplodeSettings.distance.visible = s.donutExplodeSettings.enabled.value;

    s.animationSettings.duration.visible = s.animationSettings.enabled.value;

    // Hide shared showDataLabels — local donutSettings.showLabels is the functional toggle
    s.dataLabelFormattingCard.showDataLabels.visible = false;
    // Shared inline legend labels are not rendered in this visual.
    hideInlineLegendFormatting(s.legendFormattingCard);

    // Label format & connector settings: hide when showLabels is off
    const showLabels = s.donutSettings.showLabels.value;
    s.donutLabelSettings.format.visible = showLabels;
    s.donutLabelSettings.connectorLines.visible = showLabels;
    s.donutLabelSettings.labelOffset.visible = showLabels;

    s.dataLabelFormattingCard.dataLabelFontSize.visible = showLabels;
    s.dataLabelFormattingCard.dataLabelFontColor.visible = showLabels;
    s.dataLabelFormattingCard.dataLabelFontWeight.visible = showLabels;
    s.dataLabelFormattingCard.dataLabelFontFamily.visible = showLabels;
    s.dataLabelFormattingCard.dataLabelPosition.visible = false;

    const hasInnerRingData = dataView?.categorical?.categories?.some(
      (column) => column.source.roles?.['detail'] === true,
    ) ?? false;
    s.donutNestedSettings.enabled.visible = hasInnerRingData;

    const conditionalOn = s.conditionalFormattingCard.enableConditional.value;
    s.conditionalFormattingCard.conditionalDirection.visible = conditionalOn;
    s.conditionalFormattingCard.threshold1.visible = conditionalOn;
    s.conditionalFormattingCard.threshold2.visible = conditionalOn;
    s.conditionalFormattingCard.conditionalColor1.visible = conditionalOn;
    s.conditionalFormattingCard.conditionalColor2.visible = conditionalOn;
    s.conditionalFormattingCard.conditionalColor3.visible = conditionalOn;

    // Extract data

    syncDateFilterFormattingVisibility(this.settings.dateFilterFormattingCard);
    const rawData = this.extractData(dataView);
    const topNSegments = this.applyTopN(rawData.segments);
    const data: DonutData = {
      segments: topNSegments,
      hasHighlights: rawData.hasHighlights,
    };
    this.currentData = data;

    // Card style conditional visibility
    syncCardStyleVisibility(s.cardSettings);

    // Render
    if (data.segments.length === 0) {
      this.renderEmpty();
    } else {
      this.render(data.segments, options.viewport, dataView);
    }

    // Apply cross-highlight dimming after render
    this.applySelectionHighlight(false);

    // Apply card styling AFTER render — render clears the container, which would destroy the glass backdrop div.
    this.applyCardStyling();
  }

  // ── Data Extraction ─────────────────────────────────────────────

  private extractData(dataView: DataView | undefined): DonutData {
    const emptyData: DonutData = { segments: [], hasHighlights: false };
    const themeName = resolveColorTheme(this.settings.colorThemeFormattingCard);
    if (!dataView?.categorical) return emptyData;

    const categorical = dataView.categorical;
    const categoryColumn = categorical.categories?.find((column) => column.source.roles?.['category'])
      ?? categorical.categories?.[0];
    const valueColumns = categorical.values;

    if (!valueColumns || valueColumns.length === 0) return emptyData;

    // Measures-only mode: no Category bound → one slice per measure,
    // each slice labeled by the measure's display name.
    if (!categoryColumn) {
      const segments: DonutSegment[] = [];
      for (let m = 0; m < valueColumns.length; m++) {
        const col = valueColumns[m];
        const rawVal = col.values?.[0];
        const value = typeof rawVal === 'number' && !Number.isNaN(rawVal) ? rawVal : 0;
        if (value <= 0) continue;

        const hlRaw = (col as unknown as { highlights?: unknown[] }).highlights;
        const highlighted = Array.isArray(hlRaw) && hlRaw[0] !== null && hlRaw[0] !== undefined;

        const queryName = col.source.queryName;
        const builder = this.host.createSelectionIdBuilder();
        const selectionId = queryName
          ? builder.withMeasure(queryName).createSelectionId()
          : builder.createSelectionId();

        segments.push({
          label: col.source.displayName ?? `Measure ${m + 1}`,
          value,
          color: getHostChartColor(this.host.colorPalette, m, themeName),
          selectionId,
          highlighted,
        });
      }
      return { segments, hasHighlights: segments.some((s) => s.highlighted) };
    }

    // Category mode: one slice per category, driven by the FIRST measure.
    // When multiple measures are bound alongside a category, the donut uses
    // the first; users wanting per-measure slices should remove the category.
    const valuesColumn = valueColumns[0];
    const categories = categoryColumn.values;
    const values = valuesColumn.values;

    if (!categories || !values || categories.length === 0) return emptyData;

    const hlRaw = (valuesColumn as unknown as { highlights?: unknown[] }).highlights as unknown[] | undefined;

    const dateConfig: DateFilterConfig = {
      enabled: this.settings.dateFilterFormattingCard.enableDateFilter.value,
      startDate: this.settings.dateFilterFormattingCard.startDate.value,
      endAtCurrentDate: this.settings.dateFilterFormattingCard.endAtCurrentDate.value,
      endDate: this.settings.dateFilterFormattingCard.endDate.value,
    };
    const dateIndices = isDateColumn(categoryColumn.source) ? getDateFilterIndices(categoryColumn.values, dateConfig) : null;

    const aggregates = new Map<string, {
      value: number;
      firstIndex: number;
      highlighted: boolean;
    }>();

    for (let i = 0; i < categories.length; i++) {
      if (dateIndices && !dateIndices.has(i)) continue;

      const label = categories[i] !== null && categories[i] !== undefined
        ? String(categories[i])
        : '';
      const rawVal = values[i];
      const value = typeof rawVal === 'number' && !Number.isNaN(rawVal) ? rawVal : 0;

      // Skip zero/negative values for donut chart
      if (value <= 0) continue;

      const highlighted = hlRaw ? hlRaw[i] !== null && hlRaw[i] !== undefined : false;

      const existing = aggregates.get(label);
      if (existing) {
        existing.value += value;
        existing.highlighted ||= highlighted;
      } else {
        aggregates.set(label, { value, firstIndex: i, highlighted });
      }
    }

    const segments = Array.from(aggregates, ([label, aggregate], colorIndex): DonutSegment => ({
      label,
      value: aggregate.value,
      color: getHostChartColor(this.host.colorPalette, colorIndex, themeName),
      selectionId: this.host.createSelectionIdBuilder()
        .withCategory(categoryColumn, aggregate.firstIndex)
        .createSelectionId(),
      highlighted: aggregate.highlighted,
    }));

    const hasHighlights = segments.some((s) => s.highlighted);
    return { segments, hasHighlights };
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
      highlighted: remaining.some((s) => s.highlighted),
    };

    return [...topSegments, othersSegment];
  }

  // ── Card Style ────────────────────────────────────────────────

  private applyCardStyling(): void {
    const s = this.settings.cardSettings;
    const cardMode = (resolveDropdown(s.cardStyleMode) ?? 'glass') as CardStyleMode;
    applyCardStyle(this.container, {
      mode: cardMode,
      opacity: s.backgroundOpacity.value / 100,
      backgroundColor: s.backgroundColor?.value?.value,
      borderRadius: s.borderRadius.value,
    });
  }

  // ── Empty State ───────────────────────────────────────────────

  private renderEmpty(): void {
    this.clearContainer();
    this.container.removeAttribute('role');
    this.container.removeAttribute('aria-label');
    const emptyEl = document.createElement('div');
    emptyEl.className = 'donut-empty';
    emptyEl.setAttribute('role', 'status');
    emptyEl.setAttribute('aria-live', 'polite');
    emptyEl.textContent = this.emptyStateMode === 'noData'
      ? getLocalizedString(this.host, 'AnimatedDonutPro_NoDataState', 'No data for the current selection.')
      : getLocalizedString(this.host, 'AnimatedDonutPro_EmptyState', 'Add a Value measure to get started. Bind a Category for per-category slices, or add multiple Values for one slice per measure.');
    this.container.appendChild(emptyEl);
  }

  // ── Main Render ───────────────────────────────────────────────

  private render(segments: DonutSegment[], viewport: powerbi.IViewport, dataView?: DataView): void {
    this.clearContainer();
    renderChartTitle(this.container, this.settings.titleFormattingCard);
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.segmentPaths = [];
    this.currentNestedSegments = [];

    const s = this.settings;
    const interactionsAllowed = allowInteractions(this.host);
    const padding = Math.max(0, s.donutSettings.outerPadding.value + s.cardSettings.contentPadding.value);

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
    const showOutsideLabels = s.donutSettings.showLabels.value
      && s.donutLabelSettings.connectorLines.value;
    const labelReserve = showOutsideLabels
      ? 20
        + Math.max(0, s.donutLabelSettings.labelOffset.value)
        + Math.max(8, s.dataLabelFormattingCard.dataLabelFontSize.value)
      : 0;
    const explodeReserve = s.donutExplodeSettings.enabled.value
      ? Math.max(0, s.donutExplodeSettings.distance.value) + 4
      : 0;
    const maxRadius = Math.min(cx, cy) - 4 - Math.max(labelReserve, explodeReserve);

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
    const animEnabled = s.animationSettings.enabled.value && !prefersReducedMotion();
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

      // Attach selection key for cross-highlight dimming
      if (arc.segment.selectionId) {
        path.attr('data-selection-key', arc.segment.selectionId.getKey());
      }
      // Mark highlighted state directly for segments without selectionId (e.g. "Others")
      if (arc.segment.highlighted) {
        path.attr('data-highlighted', 'true');
      }

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
          .style('cursor', interactionsAllowed ? 'pointer' : 'default')
          .on('click', (event: MouseEvent) => {
            event.stopPropagation();
            if (!interactionsAllowed) return;
            void this.selectionManager.select(selId, event.ctrlKey || event.metaKey).then(() => {
              this.applySelectionHighlight();
            });
          })
          .on('contextmenu', (event: MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();
            if (!interactionsAllowed) return;
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
      this.renderCenterValue(g, animEnabled, animDuration);
    }

    // Nested inner ring
    if (s.donutNestedSettings.enabled.value) {
      this.renderNestedRing(
        g, segments, innerRadius,
        layoutStartAngle, layoutEndAngle,
        dataView, animEnabled, animDuration,
      );
    }

    // Render legend at bottom or right position
    if (showLegend && legendPos !== 'top' && legendPos !== 'left') {
      this.renderSharedLegend(segments);
    }

    this.applyAccessibility(arcs.length);
    this.container.addEventListener('click', this.handleBackgroundClick);
    this.container.addEventListener('contextmenu', this.handleBackgroundContextMenu);
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
    if (!acc.enableKeyboardNav.value) {
      this.container.removeAttribute('role');
      this.container.removeAttribute('aria-label');
      return;
    }
    ensureFocusRingStyles();
    applyChartAria(this.container, {
      chartType: 'donut chart',
      title: this.settings.titleFormattingCard?.titleText?.value || undefined,
      dataPointCount,
    });
    const accessibleSegments = [
      ...(this.currentData?.segments ?? []),
      ...this.currentNestedSegments,
    ];
    this.container.querySelectorAll<SVGPathElement>(
      '.donut-segment, .donut-inner-segment',
    ).forEach((path, index) => {
      const segment = accessibleSegments[index];
      path.setAttribute('role', 'listitem');
      path.setAttribute('tabindex', '0');
      path.setAttribute(
        'aria-label',
        segment
          ? `${segment.label}, ${formatWithSettings(segment.value, this.settings.numberFormattingCard)}`
          : `Donut segment ${index + 1}`,
      );
    });
    const cleanup = attachKeyboardNav({
      container: this.container,
      itemSelector: '.donut-segment[tabindex="0"], .donut-inner-segment[tabindex="0"]',
      onActivate: (el) => {
        if (allowInteractions(this.host)) (el as HTMLElement).click?.();
      },
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
    const labelOffset = Math.max(0, this.settings.donutLabelSettings.labelOffset.value);
    const sharedLabelColor = this.settings.dataLabelFormattingCard.dataLabelFontColor.value?.value || '#475569';
    const sharedLabelSize = this.settings.dataLabelFormattingCard.dataLabelFontSize.value;

    // When connector lines are on, place labels outside the donut
    const labelRadius = showConnectors
      ? outerRadius + 20 + labelOffset
      : (innerRadius + outerRadius) / 2 + labelOffset;

    arcs.forEach((arc, index) => {
      const midAngle = (arc.startAngle + arc.endAngle) / 2;
      const lx = Math.cos(midAngle) * labelRadius;
      const ly = Math.sin(midAngle) * labelRadius;

      // Resolve label text based on format setting
      const pct = total > 0 ? ((arc.segment.value / total) * 100).toFixed(1) : '0.0';
      const formattedValue = formatWithSettings(arc.segment.value, this.settings.numberFormattingCard);
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
          .attr('stroke', sharedLabelColor)
          .attr('stroke-width', 1);
      }

      const text = g.append('text')
        .attr('class', 'donut-label')
        .attr('x', lx)
        .attr('y', ly)
        .attr('fill', sharedLabelColor)
        .attr('font-size', `${sharedLabelSize}px`)
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
    layoutStartAngle: number,
    layoutEndAngle: number,
    dataView: DataView | undefined,
    animEnabled: boolean,
    animDuration: number,
  ): void {
    if (!dataView?.categorical) return;

    const categorical = dataView.categorical;
    const categories = categorical.categories;
    const outerCategory = categories?.find((column) => column.source.roles?.['category'])
      ?? categories?.[0];
    const innerColumn = categories?.find((column) => column.source.roles?.['detail']);
    if (!outerCategory || !innerColumn) return;

    const valuesColumn = categorical.values?.[0];
    if (!valuesColumn) return;

    const visibleParents = new Set(
      outerSegments.filter((segment) => segment.selectionId !== null).map((segment) => segment.label),
    );
    const othersSegment = outerSegments.find((segment) => segment.selectionId === null);
    const groupedSegments = new Map<string, Map<string, NestedAggregate>>();
    const dateConfig: DateFilterConfig = {
      enabled: this.settings.dateFilterFormattingCard.enableDateFilter.value,
      startDate: this.settings.dateFilterFormattingCard.startDate.value,
      endAtCurrentDate: this.settings.dateFilterFormattingCard.endAtCurrentDate.value,
      endDate: this.settings.dateFilterFormattingCard.endDate.value,
    };
    const dateIndices = isDateColumn(outerCategory.source)
      ? getDateFilterIndices(outerCategory.values, dateConfig)
      : null;
    const highlights = (valuesColumn as unknown as { highlights?: unknown[] }).highlights;
    const interactionsAllowed = allowInteractions(this.host);

    for (let i = 0; i < innerColumn.values.length; i++) {
      if (dateIndices && !dateIndices.has(i)) continue;
      const rawParentLabel = outerCategory.values[i] != null ? String(outerCategory.values[i]) : '';
      const parentLabel = visibleParents.has(rawParentLabel)
        ? rawParentLabel
        : othersSegment?.label;
      if (!parentLabel) continue;
      const label = innerColumn.values[i] != null ? String(innerColumn.values[i]) : '';
      const rawVal = valuesColumn.values[i];
      const value = typeof rawVal === 'number' && !Number.isNaN(rawVal) ? rawVal : 0;
      if (value <= 0) continue;

      let childMap = groupedSegments.get(parentLabel);
      if (!childMap) {
        childMap = new Map<string, NestedAggregate>();
        groupedSegments.set(parentLabel, childMap);
      }
      const highlighted = Array.isArray(highlights)
        && highlights[i] !== null
        && highlights[i] !== undefined;
      const aggregate = childMap.get(label);
      if (aggregate) {
        aggregate.value += value;
        aggregate.highlighted ||= highlighted;
      } else {
        childMap.set(label, { value, firstIndex: i, highlighted });
      }
    }

    if (groupedSegments.size === 0) return;

    // Inner ring radii: from 60% of innerRadius to innerRadius - 2px gap
    const nestedOuterR = Math.max(0, innerRadius - 2);
    const nestedInnerR = nestedOuterR * 0.5;
    if (nestedOuterR <= nestedInnerR || nestedOuterR <= 0) return;

    const totalArcSpan = layoutEndAngle - layoutStartAngle;
    const outerTotal = outerSegments.reduce((sum, segment) => sum + segment.value, 0);
    if (outerTotal <= 0) return;
    let currentAngle = layoutStartAngle;

    const arcGen = d3.arc<{ startAngle: number; endAngle: number }>()
      .innerRadius(nestedInnerR)
      .outerRadius(nestedOuterR)
      .startAngle((d) => d.startAngle)
      .endAngle((d) => d.endAngle);

    for (const outerSegment of outerSegments) {
      const outerEndAngle = currentAngle + (outerSegment.value / outerTotal) * totalArcSpan;
      const childMap = groupedSegments.get(outerSegment.label);
      const children = childMap
        ? Array.from(childMap, ([label, aggregate]) => ({ label, ...aggregate }))
        : [];
      const childTotal = children.reduce((sum, child) => sum + child.value, 0);
      let childStartAngle = currentAngle;

      children.forEach((child, childIndex) => {
        const childEndAngle = childTotal > 0
          ? childStartAngle + (child.value / childTotal) * (outerEndAngle - currentAngle)
          : childStartAngle;
        const color = withOpacity(outerSegment.color, 0.6 + (childIndex % 3) * 0.15);
        const selectionId = outerSegment.selectionId
          ? this.host.createSelectionIdBuilder()
            .withCategory(outerCategory, child.firstIndex)
            .withCategory(innerColumn, child.firstIndex)
            .createSelectionId()
          : null;
        const childSegment: DonutSegment = {
          label: child.label,
          value: child.value,
          color,
          selectionId,
          highlighted: child.highlighted,
        };
        this.currentNestedSegments.push(childSegment);
        const path = g.append('path')
          .attr('class', 'donut-inner-segment')
          .attr('data-parent', outerSegment.label)
          .attr('data-label', child.label)
          .attr('fill', color)
          .attr('stroke', '#FFFFFF')
          .attr('stroke-width', 0.5);

        if (selectionId) path.attr('data-selection-key', selectionId.getKey());
        if (child.highlighted) path.attr('data-highlighted', 'true');

        if (animEnabled && animDuration > 0) {
          path.attr('d', arcGen({ startAngle: childStartAngle, endAngle: childStartAngle }));
          const delay = animDuration * 0.3;
          const startA = childStartAngle;
          const endA = childEndAngle;
          const tid = setTimeout(() => {
            const cancel = sweepArc(startA, endA, animDuration, (cur) => {
              path.attr('d', arcGen({ startAngle: startA, endAngle: cur }));
            });
            this.cancelAnimations.push(cancel);
          }, delay);
          this.cancelAnimations.push(() => clearTimeout(tid));
        } else {
          path.attr('d', arcGen({ startAngle: childStartAngle, endAngle: childEndAngle }));
        }

        this.attachSegmentTooltip(path, childSegment, childTotal);
        const pathNode = path.node();
        if (pathNode) this.attachHoverEffect(pathNode, childIndex);

        if (selectionId) {
          path
            .style('cursor', interactionsAllowed ? 'pointer' : 'default')
            .on('click', (event: MouseEvent) => {
              event.stopPropagation();
              if (!interactionsAllowed) return;
              void this.selectionManager.select(
                selectionId,
                event.ctrlKey || event.metaKey,
              ).then(() => this.applySelectionHighlight());
            })
            .on('contextmenu', (event: MouseEvent) => {
              event.preventDefault();
              event.stopPropagation();
              if (!interactionsAllowed) return;
              void this.selectionManager.showContextMenu(selectionId, {
                x: event.clientX,
                y: event.clientY,
              });
            });
        }

        childStartAngle = childEndAngle;
      });

      currentAngle = outerEndAngle;
    }
  }

  // ── Center Value ──────────────────────────────────────────────

  private renderCenterValue(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    animEnabled: boolean,
    animDuration: number,
  ): void {
    const vs = this.settings.valueSettings;
    const fontSize = vs.fontSize.value;
    const fontColor = vs.fontColor.value?.value || '#333333';
    const verticalOffset = vs.verticalOffset.value;

    const valueFontFamily = resolveDropdown(vs.fontFamily);
    const valueFontWeight = resolveDropdown(vs.fontWeight);
    const centerText = g.append('text')
      .attr('class', 'donut-center-value')
      .attr('x', 0)
      .attr('font-size', `${fontSize}px`)
      .attr('fill', fontColor);
    if (valueFontFamily) centerText.style('font-family', valueFontFamily);
    centerText.style('font-weight', valueFontWeight || 'normal');
    this.centerValueElement = centerText.node();

    const captionText = g.append('text')
      .attr('class', 'donut-center-caption')
      .attr('x', 0);
    this.centerCaptionElement = captionText.node();

    this.updateCenterDisplay(animEnabled, animDuration);
  }

  private updateCenterDisplay(
    animEnabled = false,
    animDuration = 0,
  ): void {
    if (!this.centerValueElement || !this.centerCaptionElement) return;

    const vs = this.settings.valueSettings;
    const fontSize = vs.fontSize.value;
    const fontColor = vs.fontColor.value?.value || '#333333';
    const verticalOffset = vs.verticalOffset.value;
    const valueFontFamily = resolveDropdown(vs.fontFamily);
    const valueFontWeight = resolveDropdown(vs.fontWeight);

    const centerContent = this.resolveCenterContent();
    const captionFontSize = Math.max(8, vs.captionFontSize.value);
    const captionColor = vs.captionColor.value?.value || '#64748B';
    const captionFontFamily = resolveDropdown(vs.captionFontFamily) || valueFontFamily;
    const captionFontWeight = resolveDropdown(vs.captionFontWeight) || 'normal';
    const captionSpacing = Math.max(0, vs.captionSpacing.value);
    const hasCaption = centerContent.captionText.trim().length > 0;
    const valueY = verticalOffset + (hasCaption ? -(captionFontSize * 0.55) : 0);
    const captionY = verticalOffset + Math.max(fontSize * 0.45, 12) + captionSpacing;

    this.centerValueElement.setAttribute('y', `${valueY}`);
    this.centerValueElement.setAttribute('font-size', `${fontSize}px`);
    this.centerValueElement.setAttribute('fill', fontColor);
    if (valueFontFamily) {
      this.centerValueElement.style.fontFamily = valueFontFamily;
    } else {
      this.centerValueElement.style.removeProperty('font-family');
    }
    this.centerValueElement.style.fontWeight = valueFontWeight || 'normal';

    this.centerCaptionElement.setAttribute('y', `${captionY}`);
    this.centerCaptionElement.setAttribute('font-size', `${captionFontSize}px`);
    this.centerCaptionElement.setAttribute('fill', captionColor);
    if (captionFontFamily) {
      this.centerCaptionElement.style.fontFamily = captionFontFamily;
    } else {
      this.centerCaptionElement.style.removeProperty('font-family');
    }
    this.centerCaptionElement.style.fontWeight = captionFontWeight;

    if (hasCaption) {
      this.centerCaptionElement.textContent = centerContent.captionText;
      this.centerCaptionElement.style.display = '';
    } else {
      this.centerCaptionElement.textContent = '';
      this.centerCaptionElement.style.display = 'none';
    }

    if (centerContent.numericValue !== null && animEnabled && animDuration > 0) {
      const totalDelay = Math.min(
        this.segmentPaths.length * SEGMENT_STAGGER_MS,
        animDuration * 0.5,
      );
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      timeoutId = setTimeout(() => {
        const cancel = countUp(0, centerContent.numericValue ?? 0, animDuration, (currentValue) => {
          this.centerValueElement!.textContent = this.formatCenterNumber(currentValue);
        }, () => {
          this.centerValueElement!.textContent = centerContent.primaryText;
        });
        this.cancelAnimations.push(cancel);
      }, totalDelay);

      this.cancelAnimations.push(() => {
        if (timeoutId !== null) clearTimeout(timeoutId);
      });
      this.centerValueElement.textContent = this.formatCenterNumber(0);
      return;
    }

    this.centerValueElement.textContent = centerContent.primaryText;
  }

  private resolveCenterContent(): CenterContent {
    const vs = this.settings.valueSettings;
    const displayMode = (resolveDropdown(vs.displayMode) ?? 'selectedOrTotal') as CenterDisplayMode;
    const captionMode = (resolveDropdown(vs.captionMode) ?? 'none') as CenterCaptionMode;
    const segments = this.currentData?.segments ?? [];
    const selectedSegments = this.getSelectedSegments();
    const totalValue = segments.reduce((sum, seg) => sum + seg.value, 0);

    let numericValue: number | null = null;
    let primaryText = '';
    let autoCaption = '';

    switch (displayMode) {
      case 'total':
        numericValue = totalValue;
        primaryText = this.formatCenterNumber(totalValue);
        autoCaption = 'Total';
        break;
      case 'selectedOnly':
        if (selectedSegments.length > 0) {
          const selectedValue = selectedSegments.reduce((sum, seg) => sum + seg.value, 0);
          numericValue = selectedValue;
          primaryText = this.formatCenterNumber(selectedValue);
          autoCaption = selectedSegments.length === 1
            ? selectedSegments[0].label
            : `${selectedSegments.length} selected`;
        } else {
          primaryText = vs.noSelectionText.value?.trim() || 'Select a slice';
        }
        break;
      case 'firstSlice': {
        const firstSegment = segments[0];
        if (firstSegment) {
          numericValue = firstSegment.value;
          primaryText = this.formatCenterNumber(firstSegment.value);
          autoCaption = firstSegment.label;
        } else {
          primaryText = this.formatCenterNumber(0);
        }
        break;
      }
      case 'customText':
        primaryText = vs.customText.value?.trim() || '';
        break;
      case 'selectedOrTotal':
      default:
        if (selectedSegments.length > 0) {
          const selectedValue = selectedSegments.reduce((sum, seg) => sum + seg.value, 0);
          numericValue = selectedValue;
          primaryText = this.formatCenterNumber(selectedValue);
          autoCaption = selectedSegments.length === 1
            ? selectedSegments[0].label
            : `${selectedSegments.length} selected`;
        } else {
          numericValue = totalValue;
          primaryText = this.formatCenterNumber(totalValue);
          autoCaption = 'Total';
        }
        break;
    }

    let captionText = '';
    if (captionMode === 'auto') {
      captionText = autoCaption;
    } else if (captionMode === 'custom') {
      captionText = vs.customCaption.value?.trim() || '';
    }

    return {
      primaryText,
      captionText,
      numericValue,
    };
  }

  private formatCenterNumber(value: number): string {
    const vs = this.settings.valueSettings;
    return formatNumber(value, {
      decimals: vs.decimalPlaces.value,
      prefix: vs.prefix.value || '',
      suffix: vs.suffix.value || '',
      abbreviate: false,
    });
  }

  private getSelectedSegments(): DonutSegment[] {
    const data = this.currentData;
    if (!data || !this.selectionManager.hasSelection()) return [];

    const selectedIds = this.selectionManager.getSelectionIds() as ISelectionId[];
    const selectedKeys = new Set(selectedIds.map((id) => id.getKey()));
    return [...data.segments, ...this.currentNestedSegments].filter((segment) => (
      segment.selectionId !== null && selectedKeys.has(segment.selectionId.getKey())
    ));
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
      color: this.getConditionalColor(seg.value) ?? seg.color,
    }));

    const rawLegendFontFamily = resolveDropdown(legendFmtCard.legendFontFamily) || undefined;

    const legendEl = renderLegend(this.container, {
      items,
      position: legendPos,
      fontSize: legendFontSize,
      fontColor: legendFontColor,
      fontFamily: rawLegendFontFamily,
      aliases: legendFmtCard.legendAliases.value,
    });

    const animEnabled = this.settings.animationSettings.enabled.value && !prefersReducedMotion();
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
        { displayName: segment.label, value: formatWithSettings(segment.value, this.settings.numberFormattingCard) },
        { displayName: 'Percentage', value: `${pct}%` },
      ];

      host.tooltipService.show({
        dataItems: tooltipData,
        identities: segment.selectionId ? [segment.selectionId] : [],
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
    syncCardStyleVisibility(this.settings.cardSettings);
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  // ── Utilities ─────────────────────────────────────────────────

  private clearContainer(): void {
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.container.removeEventListener('contextmenu', this.handleBackgroundContextMenu);
    this.centerValueElement = null;
    this.centerCaptionElement = null;
    this.currentNestedSegments = [];
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
  }

  private handleBackgroundContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    if (!allowInteractions(this.host)) return;
    void this.selectionManager.showContextMenu({} as powerbi.visuals.ISelectionId, {
      x: event.clientX,
      y: event.clientY,
    });
  };

  private handleBackgroundClick = (): void => {
    if (!allowInteractions(this.host)) return;
    void this.selectionManager.clear();
    this.applySelectionHighlight();
  };

  // ── Selection & Cross-Highlight ─────────────────────────────────

  private applySelectionHighlight(refreshCenter = true): void {
    const hasSelection = this.selectionManager.hasSelection();
    const selectedIds = this.selectionManager.getSelectionIds() as ISelectionId[];
    const selectedKeys = new Set(selectedIds.map((id) => id.getKey()));

    const data = this.currentData;
    const hasHighlights = data?.hasHighlights ?? false;
    const highlightedKeys = new Set<string>();
    if (hasHighlights && data) {
      for (const seg of [...data.segments, ...this.currentNestedSegments]) {
        if (seg.highlighted && seg.selectionId) {
          highlightedKeys.add(seg.selectionId.getKey());
        }
      }
    }

    const paths = this.container.querySelectorAll<SVGPathElement>(
      '.donut-segment, .donut-inner-segment',
    );
    const shouldDim = hasSelection || hasHighlights;

    for (const el of paths) {
      if (shouldDim) {
        const elKey = el.getAttribute('data-selection-key');
        const isSelected = hasSelection && elKey !== null && selectedKeys.has(elKey);
        const isHighlighted = hasHighlights && (
          (elKey !== null && highlightedKeys.has(elKey)) ||
          el.getAttribute('data-highlighted') === 'true'
        );
        el.style.opacity = (isSelected || isHighlighted) ? '' : '0.3';
      } else {
        el.style.opacity = '';
      }
    }

    if (refreshCenter) {
      this.updateCenterDisplay();
    }
  }

  private cancelAllAnimations(): void {
    for (const cancel of this.cancelAnimations) {
      cancel();
    }
    this.cancelAnimations = [];
    this.segmentPaths = [];
  }

  private applyHighContrast(): void {
    applyBasicHighContrastStyles(this.container, getHostHighContrastColors(this.host), {
      textSelectors: [
        'svg text',
        '.chart-title',
        '.chart-subtitle',
        '.pbi-shared-legend span',
        '.donut-empty',
      ],
      lineSelectors: [],
      fillSelectors: [],
      strokeSelectors: [],
    });
  }

  // ── Cleanup ───────────────────────────────────────────────────

  public destroy(): void {
    this.cancelAllAnimations();
    this.clearContainer();
  }
}
