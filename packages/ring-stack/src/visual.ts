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
  formatWithSettings,
  applyCardStyle,
  type CardStyleMode,
  withOpacity,
  renderChartTitle,
  applySortOrder,
  renderLegend,
  getHostChartColor,
  resolveColorTheme,
  buildConditionalConfig,
  resolveConditionalColor,
  resolveDropdown,
  applyChartAria,
  applyDataPointAria,
  attachKeyboardNav,
  ensureFocusRingStyles,
  attachEmptySpaceContextMenu,
  allowInteractions,
  applyBasicHighContrastStyles,
  getHostHighContrastColors,
  notifyRenderingFailed,
  notifyRenderingFinished,
  notifyRenderingStarted,
  syncCardStyleVisibility,
  syncLegendFormattingVisibility,
  syncTitleFormattingVisibility,
  type LegendItem,
  getLocalizedString,
  getVisualEmptyStateMode,
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
  /** Selection id for cross-filtering. */
  selectionId: powerbi.visuals.ISelectionId;
  /** Whether this ring is cross-highlighted from another visual. */
  highlighted: boolean;
  /** Whether Power BI supplied cross-highlight data for this measure. */
  hasHighlightData: boolean;
}

/** Top-level ring stack data container. */
interface RingStackData {
  rings: RingDatum[];
  /** Whether cross-highlight data is present from another visual/slicer. */
  hasHighlights: boolean;
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
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private currentData: RingStackData | null = null;
  private emptyStateMode: 'unconfigured' | 'noData' = 'unconfigured';
  private handleBackgroundClick: () => void;
  private detachContextMenu: () => void;
  private readonly instanceKey: string;

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.container = options.element;
    this.settings = new RingStackSettings();
    this.formattingSettingsService = new FormattingSettingsService(options.host.createLocalizationManager());
    this.selectionManager = options.host.createSelectionManager();
    this.container.classList.add('ring-stack-container');
    this.instanceKey = String((options.host as unknown as { instanceId?: string }).instanceId ?? 'ring-stack')
      .replace(/[^a-zA-Z0-9_-]/g, '-');
    this.detachContextMenu = attachEmptySpaceContextMenu(
      this.container,
      this.selectionManager,
      () => this.host.createSelectionIdBuilder().createSelectionId(),
      () => allowInteractions(this.host),
    );

    this.handleBackgroundClick = (): void => {
      if (!allowInteractions(this.host)) return;
      void this.selectionManager.clear().then(() => this.applyCrossHighlight());
    };
    this.container.addEventListener('click', this.handleBackgroundClick);
  }

  public update(options: VisualUpdateOptions): void {
    notifyRenderingStarted(this.host, options);
    try {
    // Cancel running animations from previous render
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];

    // Parse settings from dataView
    const dataView = options.dataViews?.[0];
    this.emptyStateMode = getVisualEmptyStateMode(dataView);
    if (dataView) {
      this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
        RingStackSettings,
        dataView
      );
    }

    // Migrate legacy enableGlass -> cardStyleMode (backward compat)
    const legacyCardObj = dataView?.metadata?.objects?.['cardSettings'];
    const legacyGlass = legacyCardObj?.['enableGlass'];
    if (legacyCardObj?.['cardStyleMode'] === undefined && legacyGlass === false) {
      this.settings.cardSettings.cardStyleMode.value = { value: 'none', displayName: 'None' };
    }
    syncTitleFormattingVisibility(this.settings.titleFormattingCard);
    syncLegendFormattingVisibility(this.settings.legendFormattingCard);

    this.settings.dataLabelFormattingCard.visible = false;
    this.settings.dateFilterFormattingCard.visible = false;
    this.settings.legendFormattingCard.showInlineLabels.visible = false;
    this.settings.legendFormattingCard.inlineLabelFontSize.visible = false;
    this.settings.legendFormattingCard.inlineLabelOffset.visible = false;

    const conditionalEnabled = this.settings.conditionalFormattingCard.enableConditional.value;
    this.settings.conditionalFormattingCard.conditionalDirection.visible = conditionalEnabled;
    this.settings.conditionalFormattingCard.threshold1.visible = conditionalEnabled;
    this.settings.conditionalFormattingCard.threshold2.visible = conditionalEnabled;
    this.settings.conditionalFormattingCard.conditionalColor1.visible = conditionalEnabled;
    this.settings.conditionalFormattingCard.conditionalColor2.visible = conditionalEnabled;
    this.settings.conditionalFormattingCard.conditionalColor3.visible = conditionalEnabled;

    // ── Conditional Visibility ──────────────────────────────────
    const displayModeVal = (typeof this.settings.centerContentSettings.displayMode.value === 'string'
      ? this.settings.centerContentSettings.displayMode.value
      : (this.settings.centerContentSettings.displayMode.value as { value?: string })?.value) ?? 'total';
    const showCenterContent = this.settings.centerContentSettings.show.value;
    const showCenterLabel = showCenterContent && displayModeVal !== 'custom';
    this.settings.centerContentSettings.displayMode.visible = showCenterContent;
    this.settings.centerContentSettings.customText.visible = showCenterContent && displayModeVal === 'custom';
    this.settings.centerContentSettings.fontSize.visible = showCenterContent;
    this.settings.centerContentSettings.fontColor.visible = showCenterContent;
    this.settings.centerContentSettings.fontFamily.visible = showCenterContent;
    this.settings.centerContentSettings.fontWeight.visible = showCenterContent;
    this.settings.centerContentSettings.contentPadding.visible = showCenterContent;
    this.settings.centerContentSettings.showLabel.visible = showCenterLabel;
    this.settings.centerContentSettings.labelFontSize.visible = showCenterLabel && this.settings.centerContentSettings.showLabel.value;

    this.settings.perRingMaxSettings.maxValues.visible = this.settings.perRingMaxSettings.enabled.value;
    this.settings.perRingMaxSettings.showPercentage.visible = this.settings.perRingMaxSettings.enabled.value;

    // Side label font controls — only visible when showLabels is on
    const showSideLabels = this.settings.ringSettings.showLabels.value;
    this.settings.sideLabelSettings.visible = showSideLabels;
    this.settings.sideLabelSettings.fontSize.visible = showSideLabels;
    this.settings.sideLabelSettings.fontColor.visible = showSideLabels;
    this.settings.sideLabelSettings.fontFamily.visible = showSideLabels;
    this.settings.sideLabelSettings.fontWeight.visible = showSideLabels;
    this.settings.sideLabelSettings.labelPadding.visible = showSideLabels;
    this.settings.animationSettings.duration.visible = this.settings.animationSettings.enabled.value;

    syncCardStyleVisibility(this.settings.cardSettings);
    this.syncRoleDependentVisibility(dataView);

    // Extract ring data and apply user-configured sort order
    const rings = applySortOrder(
      this.extractData(dataView),
      this.settings.sortFormattingCard,
    );

    // Compute cross-highlight state
    const hasHighlights = rings.some(r => r.hasHighlightData);
    this.currentData = { rings, hasHighlights };

    this.render(rings, options.viewport);
    notifyRenderingFinished(this.host, options);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      notifyRenderingFailed(this.host, options, reason);
      while (this.container.firstChild) this.container.removeChild(this.container.firstChild);
      const message = document.createElement('div');
      message.className = 'ring-stack-empty';
      message.textContent = getLocalizedString(this.host, 'RingStack_RenderError', 'Unable to render the ring chart.');
      this.container.appendChild(message);
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
    const highContrast = getHostHighContrastColors(this.host);
    const highContrastColors = [
      highContrast.foregroundSelected,
      highContrast.hyperlink,
      highContrast.foreground,
    ];
    const colors = ringColorPickers.map((picker, i) => {
      if (highContrast.enabled) return highContrastColors[i % highContrastColors.length];
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

      // Cross-highlight: check if this measure column has highlight data
      const hlRaw = (col as unknown as { highlights?: unknown }).highlights as unknown[] | undefined;
      const lastHl = hlRaw ? hlRaw[hlRaw.length - 1] : undefined;
      const isHighlighted = lastHl !== null && lastHl !== undefined;

      rings.push({
        value: numVal,
        percentage,
        endAngle,
        color: colors[slotIndex],
        index: ringIndex,
        name: col.source.displayName ?? `Ring ${ringIndex + 1}`,
        ringMax,
        selectionId: this.host.createSelectionIdBuilder()
          .withMeasure(col.source.queryName ?? '')
          .createSelectionId(),
        highlighted: isHighlighted,
        hasHighlightData: hlRaw !== undefined,
      });

      ringIndex++;
    }

    return rings;
  }

  private syncRoleDependentVisibility(dataView: DataView | undefined): void {
    const boundSlots = new Set<number>();
    const roleSources = [
      ...Array.from(dataView?.categorical?.values ?? []).map((column) => column.source),
      ...Array.from(dataView?.metadata?.columns ?? []),
    ];
    for (const source of roleSources) {
      const roles = source.roles;
      if (!roles) continue;
      for (let index = 0; index < MEASURE_ROLES.length; index++) {
        if (roles[MEASURE_ROLES[index]]) boundSlots.add(index);
      }
    }

    const colorPickers = [
      this.settings.colorSettings.ring1Color,
      this.settings.colorSettings.ring2Color,
      this.settings.colorSettings.ring3Color,
      this.settings.colorSettings.ring4Color,
      this.settings.colorSettings.ring5Color,
      this.settings.colorSettings.ring6Color,
    ];
    colorPickers.forEach((picker, index) => {
      picker.visible = boundSlots.has(index);
    });
    this.settings.colorSettings.visible = boundSlots.size > 0;
    this.settings.sortFormattingCard.visible = boundSlots.size > 1;
  }

  private render(rings: RingDatum[], viewport: powerbi.IViewport): void {
    this.hideTooltip();

    // Clear container (no innerHTML)
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    renderChartTitle(this.container, this.settings.titleFormattingCard);

    const s = this.settings;
    const highContrast = getHostHighContrastColors(this.host);
    const interactionsEnabled = allowInteractions(this.host);

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
    const contentPadding = Math.max(0, s.cardSettings.contentPadding.value);
    this.container.style.padding = `${contentPadding}px`;
    this.container.style.boxSizing = 'border-box';
    this.container.style.position = 'relative';
    if (highContrast.enabled) {
      this.container.style.background = highContrast.background;
      this.container.style.boxShadow = 'none';
      this.container.style.border = `1px solid ${highContrast.foreground}`;
      this.container.style.color = highContrast.foreground;
    }

    // Empty state: no measures bound
    if (rings.length === 0) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'ring-stack-empty';
      emptyEl.setAttribute('role', 'status');
      emptyEl.textContent = this.emptyStateMode === 'noData'
        ? getLocalizedString(this.host, 'RingStack_NoDataState', 'No data for the current selection.')
        : getLocalizedString(this.host, 'RingStack_EmptyState', 'Add at least one measure to build a ring chart.');
      this.container.appendChild(emptyEl);
      applyBasicHighContrastStyles(this.container, highContrast);
      return;
    }

    // ── Layout Calculations ─────────────────────────────────────
    const width = Math.max(0, viewport.width - contentPadding * 2);
    const headingHeight = Array.from(this.container.querySelectorAll<HTMLElement>('.chart-title, .chart-subtitle'))
      .reduce((total, element) => total + element.offsetHeight, 0);
    const showLegend = s.legendFormattingCard.showLegend.value;
    const legendPosition = this.getLegendPosition();
    const legendHeight = showLegend && (legendPosition === 'top' || legendPosition === 'bottom')
      ? Math.max(20, s.legendFormattingCard.legendFontSize.value + 12)
      : 0;
    const legendWidth = showLegend && (legendPosition === 'left' || legendPosition === 'right')
      ? Math.min(140, Math.max(0, width * 0.32))
      : 0;
    const height = Math.max(0, viewport.height - contentPadding * 2 - headingHeight - legendHeight);
    const showLabels = s.ringSettings.showLabels.value;
    const requestedThickness = Math.max(1, s.ringSettings.thickness.value);
    const requestedGap = Math.max(0, s.ringSettings.gap.value);

    const body = document.createElement('div');
    body.className = 'ring-stack-body';
    body.style.boxSizing = 'border-box';
    if (legendPosition === 'left') body.style.paddingLeft = `${legendWidth}px`;
    if (legendPosition === 'right') body.style.paddingRight = `${legendWidth}px`;
    this.container.appendChild(body);

    // Reserve space for labels on the right side
    const chartBodyWidth = Math.max(0, width - legendWidth);
    const labelAreaWidth = showLabels ? Math.min(chartBodyWidth * 0.4, 160) : 0;
    const svgWidth = Math.max(0, chartBodyWidth - labelAreaWidth);
    const svgHeight = height;

    // Calculate ring radii: outermost ring first, working inward
    const padding = Math.max(0, s.ringSettings.chartPadding.value);
    const maxRadius = Math.max(0, Math.min(svgWidth, svgHeight) / 2 - padding);
    const requestedSpan = rings.length * requestedThickness + (rings.length - 1) * requestedGap;
    const layoutScale = requestedSpan > maxRadius && requestedSpan > 0 ? maxRadius / requestedSpan : 1;
    const thickness = Math.max(0, requestedThickness * layoutScale);
    const gap = requestedGap * layoutScale;
    const ringSpan = thickness + gap;

    // The outer ring uses the available radius; inner rings scale down together when needed.
    const outerRadius = maxRadius;
    const centerX = svgWidth / 2;
    const centerY = svgHeight / 2;

    // ── SVG Setup ───────────────────────────────────────────────
    const svg = d3.select(body)
      .append('svg')
      .attr('class', 'ring-stack-svg')
      .attr('width', svgWidth)
      .attr('height', svgHeight)
      .attr('viewBox', `0 0 ${svgWidth} ${svgHeight}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    const g = svg.append('g')
      .attr('transform', `translate(${centerX}, ${centerY})`);

    // ── Gradient Defs (if enabled) ──────────────────────────────
    const gradientEnabled = s.ringSettings.gradientEnabled.value;
    if (gradientEnabled) {
      const defs = svg.append('defs');
      rings.forEach((ring, i) => {
        const grad = defs.append('linearGradient')
          .attr('id', `${this.instanceKey}-ring-grad-${i}`)
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
    const animEnabled = s.animationSettings.enabled.value && !prefersReducedMotion();
    const animDuration = Math.max(0, s.animationSettings.duration.value);
    const staggerDelay = 80;

    rings.forEach((ring, i) => {
      const ringOuter = Math.max(0, outerRadius - i * ringSpan);
      const ringInner = Math.max(0, ringOuter - thickness);

      // Guard against negative radii
      if (ringOuter <= 0 || thickness <= 0) return;

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
      const conditionalColor = highContrast.enabled ? undefined : this.getConditionalColor(ring.value);
      const arcFillColor = conditionalColor
        ?? (gradientEnabled && !highContrast.enabled
          ? `url(#${this.instanceKey}-ring-grad-${i})`
          : ring.color);
      const ringStrokeColor = highContrast.enabled
        ? highContrast.foreground
        : s.ringSettings.ringStrokeColor.value?.value;
      const arcPath = g.append('path')
        .attr('class', 'ring-stack-arc')
        .attr('data-ring-index', i)
        .attr('fill', arcFillColor);
      if (ringStrokeColor) {
        arcPath.attr('stroke', ringStrokeColor).attr('stroke-width', 1);
      }
      // Hover: brightness boost + pop-out (scale outward)
      arcPath
        .style('transition', 'filter 0.2s ease, transform 0.2s ease')
        .style('transform-origin', 'center')
        .style('cursor', interactionsEnabled ? 'pointer' : 'default')
        .style('pointer-events', 'all')
        .on('mouseenter', (event: MouseEvent) => {
          arcPath
            .style('filter', `brightness(1.18) drop-shadow(0 0 4px ${ring.color})`)
            .style('transform', 'scale(1.04)');
          this.showRingTooltip(ring, event);
        })
        .on('mousemove', (event: MouseEvent) => {
          this.moveTooltip(event);
        })
        .on('mouseleave', () => {
          arcPath
            .style('filter', 'none')
            .style('transform', 'scale(1)');
          this.hideTooltip();
        })
        .on('click', (event: MouseEvent) => {
          if (!interactionsEnabled) return;
          event.stopPropagation();
          void this.selectionManager.select(ring.selectionId, event.ctrlKey || event.metaKey)
            .then(() => this.applyCrossHighlight());
        })
        .on('contextmenu', (event: MouseEvent) => {
          if (!interactionsEnabled) return;
          event.preventDefault();
          event.stopPropagation();
          void this.selectionManager.showContextMenu(ring.selectionId, {
            x: event.clientX,
            y: event.clientY,
          });
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
      if (s.ringSettings.showArcLabels.value) {
        const midRadius = (ringInner + ringOuter) / 2;
        // Create an arc path for the text to follow (half-circle at midRadius)
        const arcId = `${this.instanceKey}-ring-arc-label-${i}`;
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
      if (s.ringSettings.showOverflow.value && ring.value > ring.ringMax) {
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
      const ccFontFamily = resolveDropdown(cc.fontFamily);
      const ccFontWeight = resolveDropdown(cc.fontWeight);
      const ccContentPadding = Math.max(0, cc.contentPadding.value);

      if (mode === 'custom') {
        // Custom mode: show customText as the main text, no label below
        const centerText = g.append('text')
          .attr('class', 'ring-stack-center-value')
          .attr('x', 0)
          .attr('y', 0)
          .attr('data-content-padding', String(ccContentPadding))
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'central')
          .attr('font-size', `${cc.fontSize.value}px`)
          .attr('font-weight', ccFontWeight || '600')
          .attr('pointer-events', 'none')
          .text(cc.customText.value || '');
        if (ccContentPadding > 0) {
          centerText.attr('y', String(-ccContentPadding / 4));
        }
        if (ccFontFamily) centerText.style('font-family', ccFontFamily);
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
        const formattedValue = formatWithSettings(displayValue, this.settings.numberFormattingCard);

        // Value text (slightly above center when label is shown)
        const valueY = cc.showLabel.value
          ? -cc.labelFontSize.value * 0.6 - (ccContentPadding / 2)
          : 0;
        const valueText = g.append('text')
          .attr('class', 'ring-stack-center-value')
          .attr('x', 0)
          .attr('y', valueY)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'central')
          .attr('font-size', `${cc.fontSize.value}px`)
          .attr('font-weight', ccFontWeight || '600')
          .attr('pointer-events', 'none')
          .text(formattedValue);
        if (ccFontFamily) valueText.style('font-family', ccFontFamily);
        if (ccFontColor) {
          valueText.attr('fill', ccFontColor);
        }

        // Label text below value
        if (cc.showLabel.value) {
          const labelY = valueY + cc.fontSize.value * 0.6 + cc.labelFontSize.value * 0.6 + ccContentPadding;
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
          if (ccFontFamily) labelEl.style('font-family', ccFontFamily);
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
        const labelPadding = Math.max(0, s.sideLabelSettings.labelPadding.value);
        labelRow.setAttribute('data-label-padding', String(labelPadding));
        labelRow.style.gap = `${labelPadding}px`;
        labelRow.style.padding = `${Math.max(0, Math.round(labelPadding / 2))}px 0`;
        const sl = s.sideLabelSettings;
        labelRow.style.fontSize = `${sl.fontSize.value}px`;
        const slFontColor = sl.fontColor.value?.value;
        if (slFontColor && slFontColor.length > 0) labelRow.style.color = slFontColor;
        const slFontFamily = resolveDropdown(sl.fontFamily);
        if (slFontFamily) labelRow.style.fontFamily = slFontFamily;
        const slFontWeight = resolveDropdown(sl.fontWeight);
        if (slFontWeight) labelRow.style.fontWeight = slFontWeight;

        // Color dot
        const dot = document.createElement('span');
        dot.className = 'ring-label-dot';
        dot.style.backgroundColor = ring.color;
        labelRow.appendChild(dot);

        const nameSpan = document.createElement('span');
        nameSpan.className = 'ring-label-name';
        nameSpan.textContent = ring.name;
        nameSpan.title = ring.name;
        labelRow.appendChild(nameSpan);

        // Label value text (percentage or raw value)
        const pctSpan = document.createElement('span');
        pctSpan.className = 'ring-label-pct';
        pctSpan.style.color = slFontColor && slFontColor.length > 0 ? slFontColor : ring.color;

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
                  pctSpan.textContent = formatWithSettings(v, this.settings.numberFormattingCard);
                }
              );
            }, delay);

            this.cancelAnimations.push(() => {
              if (timeoutId !== null) clearTimeout(timeoutId);
              cancelCount?.();
            });
          } else {
            pctSpan.textContent = formatWithSettings(ring.value, this.settings.numberFormattingCard);
          }
        }
      });

      body.appendChild(labelContainer);

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

    // Legend
    if (showLegend && rings.length > 0) {
      this.renderSharedLegend(rings, animEnabled, legendPosition, legendWidth, headingHeight);
    }

    // Accessibility
    this.applyAccessibility(rings);

    // Cross-highlight dimming
    this.applyCrossHighlight();

    applyBasicHighContrastStyles(this.container, highContrast, {
      textSelectors: [
        'svg text',
        '.chart-title',
        '.chart-subtitle',
        '.ring-label-name',
        '.ring-label-pct',
        '.pbi-shared-legend span',
      ],
      strokeSelectors: ['.ring-stack-arc'],
    });
  }

  // ── Cross-Highlight ──────────────────────────────────────────────

  private applyCrossHighlight(): void {
    const data = this.currentData;
    if (!data) return;

    const hasSelection = this.selectionManager.hasSelection();
    const shouldDim = hasSelection || data.hasHighlights;

    const selectedIds = this.selectionManager.getSelectionIds() as powerbi.visuals.ISelectionId[];
    const selectedKeys = new Set(selectedIds.map((id) => id.getKey()));

    const arcs = this.container.querySelectorAll<SVGPathElement>('.ring-stack-arc');
    for (const el of Array.from(arcs)) {
      if (!shouldDim) {
        el.style.opacity = '';
        continue;
      }
      const ringIdx = parseInt(el.getAttribute('data-ring-index') ?? '-1', 10);
      const ring = data.rings[ringIdx];
      const isHighlighted = ring ? ring.highlighted : false;
      const isSelected = hasSelection && ring
        ? selectedKeys.has(ring.selectionId.getKey())
        : false;
      el.style.opacity = (isHighlighted || isSelected) ? '' : '0.3';
    }
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

  private applyAccessibility(rings: RingDatum[]): void {
    const acc = this.settings.accessibilityFormattingCard;
    applyChartAria(this.container, {
      chartType: 'ring chart',
      title: this.settings.titleFormattingCard?.titleText?.value || undefined,
      dataPointCount: rings.length,
    });
    if (!acc.enableKeyboardNav.value || !allowInteractions(this.host)) return;

    ensureFocusRingStyles();
    this.container.setAttribute('role', 'list');
    const highContrast = getHostHighContrastColors(this.host);
    const arcs = Array.from(this.container.querySelectorAll<SVGPathElement>('.ring-stack-arc'));
    arcs.forEach((arc, index) => {
      const ring = rings[index];
      if (!ring) return;
      applyDataPointAria(
        arc,
        ring.name,
        formatWithSettings(ring.value, this.settings.numberFormattingCard),
        index,
        rings.length,
      );
      if (highContrast.enabled) arc.style.outlineColor = highContrast.foregroundSelected;
    });
    const cleanup = attachKeyboardNav({
      container: this.container,
      itemSelector: '.ring-stack-arc',
      onActivate: (_element, index) => {
        const ring = rings[index];
        if (!ring) return;
        void this.selectionManager.select(ring.selectionId, false)
          .then(() => this.applyCrossHighlight());
      },
    });
    this.cancelAnimations.push(cleanup);
  }

  private renderSharedLegend(
    rings: RingDatum[],
    animate: boolean,
    legendPosition: 'top' | 'bottom' | 'left' | 'right',
    reservedWidth: number,
    headingHeight: number,
  ): void {
    const legendFmtCard = this.settings.legendFormattingCard;
    const rawFontColor = legendFmtCard.legendFontColor.value?.value;
    const legendFontColor = rawFontColor != null && rawFontColor.length > 0 ? rawFontColor : '';
    const legendFontSize = legendFmtCard.legendFontSize.value;
    const items: LegendItem[] = rings.map((ring) => ({
      label: ring.name,
      color: ring.color,
    }));

    const rawLegendFontFamily = resolveDropdown(legendFmtCard.legendFontFamily) || undefined;
    const rawLegendFontWeight = resolveDropdown(legendFmtCard.legendFontWeight) || undefined;

    const legendEl = renderLegend(this.container, {
      items,
      position: legendPosition,
      fontSize: legendFontSize,
      fontColor: legendFontColor,
      fontFamily: rawLegendFontFamily,
      fontWeight: rawLegendFontWeight,
      aliases: legendFmtCard.legendAliases.value,
    });
    if (legendPosition === 'left' || legendPosition === 'right') {
      legendEl.style.width = `${reservedWidth}px`;
      legendEl.style.top = `${headingHeight}px`;
      legendEl.style.height = `calc(100% - ${headingHeight}px)`;
    }

    // Entrance fade for legend
    if (animate) {
      const cancel = fadeSlideIn(legendEl, 'up', DURATION.fast, rings.length * 80);
      this.cancelAnimations.push(cancel);
    }
  }

  private getLegendPosition(): 'top' | 'bottom' | 'left' | 'right' {
    const value = resolveDropdown(this.settings.legendFormattingCard.legendPosition) ?? 'bottom';
    return value === 'top' || value === 'left' || value === 'right' ? value : 'bottom';
  }

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  private showRingTooltip(ring: RingDatum, event: MouseEvent): void {
    const locale = this.getHostLocale();
    const tooltipData: VisualTooltipDataItem[] = [
      { displayName: 'Ring', value: ring.name },
      { displayName: 'Value', value: formatWithSettings(ring.value, this.settings.numberFormattingCard) },
      { displayName: 'Percent', value: formatNumber(ring.percentage * 100, { decimals: 0, suffix: '%', abbreviate: false, locale }) },
    ];

    // Show the per-ring max in the tooltip when per-ring scale is active
    const perRingEnabled = this.settings.perRingMaxSettings.enabled.value;
    if (perRingEnabled) {
      tooltipData.push({
        displayName: 'Max',
        value: formatWithSettings(ring.ringMax, this.settings.numberFormattingCard),
      });
    }

    this.host.tooltipService.show({
      dataItems: tooltipData,
      identities: [ring.selectionId],
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

  public destroy(): void {
    this.hideTooltip();
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];
    this.detachContextMenu();
    this.container.removeEventListener('click', this.handleBackgroundClick);
  }
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
