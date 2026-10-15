/**
 * Sankey Diagram Pro — Power BI IVisual implementation.
 * Bridges PBI data/lifecycle with D3 + d3-sankey rendering.
 */

import powerbi from 'powerbi-visuals-api';
import * as d3 from 'd3';
import {
  sankey,
  sankeyLinkHorizontal,
  sankeyLeft,
  sankeyRight,
  sankeyCenter,
  sankeyJustify,
  SankeyNode,
  SankeyLink,
} from 'd3-sankey';
import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel';
import { SankeyDiagramSettings } from './settings';
import {
  formatPercent,
  formatWithSettings,
  animate,
  cubicOut,
  DURATION,
  getTheme,
  getHostChartColor,
  generateColorVariations,
  applyCardStyle,
  type CardStyleMode,
  renderChartTitle,
  ensureScrollStyles,
  applyChartAria,
  applyDataPointAria,
  attachKeyboardNav,
  ensureFocusRingStyles,
  attachEmptySpaceContextMenu,
  resolveColorTheme,
  buildConditionalConfig,
  resolveConditionalColor,
  resolveDropdown,
  renderLegend,
  type LegendItem,
  type ColorThemeName,
  getDateFilterIndices,
  isDateColumn,
  type DateFilterConfig,
  syncLegendFormattingVisibility,
  syncTitleFormattingVisibility,
  syncDateFilterFormattingVisibility,
  syncCardStyleVisibility,
  getVisualEmptyStateMode,
  getLocalizedString,
  allowInteractions,
  getHostHighContrastColors,
  applyBasicHighContrastStyles,
  notifyRenderingStarted,
  notifyRenderingFinished,
  notifyRenderingFailed,
  truncateText,
} from '../../core/src';

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataView = powerbi.DataView;
import ISelectionId = powerbi.visuals.ISelectionId;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

import '../style/visual.less';

// ── Internal Types ───────────────────────────────────────────────

/** Minimal node datum for the sankey layout. */
interface SankeyNodeDatum {
  name: string;
  index: number;
  selectionId: ISelectionId;
  /** Whether this node is cross-highlighted from another visual. */
  highlighted: boolean;
}

/** Minimal link datum for the sankey layout. */
interface SankeyLinkDatum {
  source: number;
  target: number;
  value: number;
  selectionId: ISelectionId;
  /** Whether this link is cross-highlighted from another visual. */
  highlighted: boolean;
}

/** Fully laid-out node (after sankey computation). */
type LayoutNode = SankeyNode<SankeyNodeDatum, SankeyLinkDatum>;

/** Fully laid-out link (after sankey computation). */
type LayoutLink = SankeyLink<SankeyNodeDatum, SankeyLinkDatum>;

/** Extracted data from the PBI dataView. */
interface SankeyData {
  nodes: SankeyNodeDatum[];
  links: SankeyLinkDatum[];
  /** Number of active layers (e.g. 2 for Source+Target, 3 for Source+Step2+Target, etc.) */
  layerCount: number;
  /** Whether cross-highlight data is present from another visual/slicer. */
  hasHighlights: boolean;
}

type LinkColorMode = 'source' | 'target' | 'gradient' | 'custom';

// ── Constants ────────────────────────────────────────────────────

const BASE_MARGIN = { top: 8, right: 8, bottom: 8, left: 8 };
const EMPTY_STATE_TEXT =
  'Add Source and Target fields to build the Sankey diagram. Optionally add Weight for sized flows, and Step 2–5 for multi-level paths.';

// ── Visual ───────────────────────────────────────────────────────

export class SankeyDiagramVisual implements IVisual {
  private host: IVisualHost;
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private container: HTMLElement;
  private settings: SankeyDiagramSettings;
  private formattingSettingsService: FormattingSettingsService;
  private cancelAnimations: Array<() => void> = [];
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
  private filteredNodeIndex: number | null = null;
  private currentData: SankeyData | null = null;
  private emptyStateMode: 'unconfigured' | 'noData' = 'unconfigured';
  private resolveNodeColor: (d: { depth?: number; index?: number }) => string = () => '#64748B';
  private currentViewport: powerbi.IViewport = { width: 0, height: 0 };
  private interactionsEnabled = true;
  private keyboardNavCleanup: (() => void) | null = null;
  private instanceId = (typeof crypto !== 'undefined' && crypto.getRandomValues
    ? Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => b.toString(36)).join('')
    : Date.now().toString(36));

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new SankeyDiagramSettings();
    this.formattingSettingsService = new FormattingSettingsService(options.host.createLocalizationManager());
    this.container.classList.add('sankey-container');
    attachEmptySpaceContextMenu(this.container, this.selectionManager, () =>
      this.host.createSelectionIdBuilder().createSelectionId(),
      () => this.interactionsEnabled,
    );
  }

  public update(options: VisualUpdateOptions): void {
    notifyRenderingStarted(this.host, options);
    try {
      this.updateVisual(options);
      notifyRenderingFinished(this.host, options);
    } catch (error) {
      notifyRenderingFailed(
        this.host,
        options,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  private updateVisual(options: VisualUpdateOptions): void {
    // Cancel running animations
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];
    this.interactionsEnabled = allowInteractions(this.host);

    // Parse settings from dataView
    const dataView = options.dataViews?.[0];
    this.emptyStateMode = getVisualEmptyStateMode(dataView);
    if (dataView) {
      this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
        SankeyDiagramSettings,
        dataView
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

    syncDateFilterFormattingVisibility(this.settings.dateFilterFormattingCard);
    const sourceColumn = dataView?.categorical?.categories?.find((column) => column.source.roles?.['source']);
    this.settings.dateFilterFormattingCard.visible = Boolean(sourceColumn && isDateColumn(sourceColumn.source));

    // ── Conditional Visibility ──────────────────────────────────
    const linkColorMode = resolveDropdown(this.settings.linkSettings.colorMode) ?? 'gradient';
    this.settings.linkSettings.customColor.visible = linkColorMode === 'custom';

    // Hover highlighting always uses the dim opacity.
    this.settings.linkSettings.dimOpacity.visible = true;

    // totalFontSize/totalFontColor visible when any totals feature is on
    const showNodeValues = this.settings.totalSettings.showNodeValues.value;
    const showLayerTotals = this.settings.totalSettings.showLayerTotals.value;
    const anyTotalsVisible = showNodeValues || showLayerTotals;
    this.settings.totalSettings.totalFontSize.visible = anyTotalsVisible;
    this.settings.totalSettings.totalFontColor.visible = anyTotalsVisible;
    this.settings.totalSettings.nodeValueFormat.visible = showNodeValues;
    this.settings.totalSettings.layerTotalPosition.visible = showLayerTotals;
    const showTotals = showNodeValues || showLayerTotals;
    this.settings.totalSettings.totalFontFamily.visible = showTotals;
    this.settings.totalSettings.totalFontWeight.visible = showTotals;

    // Link label sub-settings hidden when showLinkLabels is off
    const showLinkLabels = this.settings.linkLabelSettings.showLinkLabels.value;
    const showFlowLabels = this.settings.linkLabelSettings.showFlowLabels.value;
    const showAnyLinkLabels = showLinkLabels || showFlowLabels;
    this.settings.linkLabelSettings.linkLabelFontSize.visible = showAnyLinkLabels;
    this.settings.linkLabelSettings.linkLabelFontColor.visible = showAnyLinkLabels;
    this.settings.linkLabelSettings.linkLabelFontFamily.visible = showAnyLinkLabels;
    this.settings.linkLabelSettings.linkLabelFontWeight.visible = showAnyLinkLabels;
    this.settings.linkLabelSettings.linkLabelFormat.visible = showLinkLabels;

    // Animation duration hidden when animations are disabled
    this.settings.animationSettings.duration.visible = this.settings.animationSettings.enabled.value;

    const showTooltips = this.settings.tooltipSettings.showTooltips.value;
    this.settings.tooltipSettings.showPercentage.visible = showTooltips;
    this.settings.tooltipSettings.valueFormat.visible = showTooltips;

    // Scroll sub-settings
    this.settings.scrollFormattingCard.minCategoryWidth.visible = this.settings.scrollFormattingCard.enableScroll.value;

    // Legend/title sub-settings
    syncLegendFormattingVisibility(this.settings.legendFormattingCard);
    syncTitleFormattingVisibility(this.settings.titleFormattingCard);

    // Conditional formatting sub-settings
    const showCond = this.settings.conditionalFormattingCard.enableConditional.value;
    this.settings.conditionalFormattingCard.conditionalDirection.visible = showCond;
    this.settings.conditionalFormattingCard.threshold1.visible = showCond;
    this.settings.conditionalFormattingCard.threshold2.visible = showCond;
    this.settings.conditionalFormattingCard.conditionalColor1.visible = showCond;
    this.settings.conditionalFormattingCard.conditionalColor2.visible = showCond;
    this.settings.conditionalFormattingCard.conditionalColor3.visible = showCond;

    // Card style sub-settings
    syncCardStyleVisibility(this.settings.cardSettings);

    // Extract data
    const data = this.extractData(dataView);

    // Node color visibility — show per-layer pickers only in 'byLayer' mode
    const nodeColorMode = resolveDropdown(this.settings.nodeColorSettings.colorMode) ?? 'auto';
    const isByLayer = nodeColorMode === 'byLayer';
    const layerCount = data?.layerCount ?? 2;
    this.settings.nodeColorSettings.sourceColor.visible = isByLayer;
    this.settings.nodeColorSettings.step2Color.visible = isByLayer && layerCount > 2;
    this.settings.nodeColorSettings.step3Color.visible = isByLayer && layerCount > 3;
    this.settings.nodeColorSettings.step4Color.visible = isByLayer && layerCount > 4;
    this.settings.nodeColorSettings.step5Color.visible = isByLayer && layerCount > 5;
    this.settings.nodeColorSettings.targetColor.visible = isByLayer;

    // Per-layer label color visibility — show only for active layers
    this.settings.nodeLabelSettings.sourceLabelColor.visible = true; // always visible (Source is always present)
    this.settings.nodeLabelSettings.step2LabelColor.visible = layerCount > 2;
    this.settings.nodeLabelSettings.step3LabelColor.visible = layerCount > 3;
    this.settings.nodeLabelSettings.step4LabelColor.visible = layerCount > 4;
    this.settings.nodeLabelSettings.step5LabelColor.visible = layerCount > 5;
    this.settings.nodeLabelSettings.targetLabelColor.visible = true; // always visible (Target is always present)

    // Render
    this.render(data, options.viewport);
  }

  // ── Data Extraction (Multi-Level) ─────────────────────────────

  private extractData(dataView: DataView | undefined): SankeyData | null {
    if (!dataView?.categorical) return null;

    const categorical = dataView.categorical;
    const categories = categorical.categories;
    const values = categorical.values;

    if (!categories || categories.length < 2) return null;

    // Discover columns by role
    let sourceColumn: powerbi.DataViewCategoryColumn | undefined;
    let step2Column: powerbi.DataViewCategoryColumn | undefined;
    let step3Column: powerbi.DataViewCategoryColumn | undefined;
    let step4Column: powerbi.DataViewCategoryColumn | undefined;
    let step5Column: powerbi.DataViewCategoryColumn | undefined;
    let targetColumn: powerbi.DataViewCategoryColumn | undefined;
    let weightColumn: powerbi.DataViewValueColumn | undefined;

    for (const cat of categories) {
      const roles = cat.source.roles;
      if (!roles) continue;
      if (roles['source']) sourceColumn = cat;
      if (roles['step2']) step2Column = cat;
      if (roles['step3']) step3Column = cat;
      if (roles['step4']) step4Column = cat;
      if (roles['step5']) step5Column = cat;
      if (roles['target']) targetColumn = cat;
    }

    if (values) {
      for (const val of values) {
        const roles = val.source.roles;
        if (!roles) continue;
        if (roles['weight']) weightColumn = val;
      }
    }

    if (!sourceColumn || !targetColumn) return null;

    const rowCount = sourceColumn.values.length;
    if (rowCount === 0) return null;

    // Compute target level dynamically based on active intermediate columns
    let targetLevel = 1;
    if (step2Column) targetLevel++;
    if (step3Column) targetLevel++;
    if (step4Column) targetLevel++;
    if (step5Column) targetLevel++;

    // Build unique node list — suffix names with level to avoid collisions across levels
    const nodeMap = new Map<string, number>();
    const nodes: SankeyNodeDatum[] = [];

    const getOrCreateNode = (name: string, level: number, selectionId: ISelectionId, highlighted: boolean): number => {
      const key = `${level}:${name}`;
      const existing = nodeMap.get(key);
      if (existing !== undefined) {
        // If any row for this node is highlighted, mark it as highlighted
        if (highlighted) nodes[existing].highlighted = true;
        return existing;
      }
      const idx = nodes.length;
      nodes.push({ name, index: idx, selectionId, highlighted });
      nodeMap.set(key, idx);
      return idx;
    };

    // Build links with deduplication
    const linkMap = new Map<string, SankeyLinkDatum>();

    // Cross-highlight: read highlight values from weight column (or source category)
    const weightHlRaw = weightColumn
      ? (weightColumn as unknown as { highlights?: unknown }).highlights as unknown[] | undefined
      : undefined;
    // If no weight column, try source category highlights
    const sourceHlRaw = !weightHlRaw
      ? (sourceColumn as unknown as { highlights?: unknown }).highlights as unknown[] | undefined
      : undefined;
    let hasHighlights = false;

    const dateConfig: DateFilterConfig = {
      enabled: this.settings.dateFilterFormattingCard.enableDateFilter.value,
      startDate: this.settings.dateFilterFormattingCard.startDate.value,
      endAtCurrentDate: this.settings.dateFilterFormattingCard.endAtCurrentDate.value,
      endDate: this.settings.dateFilterFormattingCard.endDate.value,
    };
    const dateIndices = isDateColumn(sourceColumn.source) ? getDateFilterIndices(sourceColumn.values, dateConfig) : null;

    for (let i = 0; i < rowCount; i++) {
      if (dateIndices && !dateIndices.has(i)) continue;

      const sourceVal = sourceColumn.values[i];
      const targetVal = targetColumn.values[i];

      // Validate: source and target must be present
      if (sourceVal == null || targetVal == null) continue;

      // Weight: use bound measure if available, otherwise count each row as 1
      let weight = 1;
      if (weightColumn) {
        const weightVal = weightColumn.values[i];
        if (weightVal == null) continue;
        weight = typeof weightVal === 'number' ? weightVal : Number(weightVal);
        if (!Number.isFinite(weight) || weight <= 0) continue;
      }

      // Determine if this row is cross-highlighted
      const rowHighlighted = weightHlRaw
        ? (weightHlRaw[i] !== null && weightHlRaw[i] !== undefined)
        : (sourceHlRaw ? (sourceHlRaw[i] !== null && sourceHlRaw[i] !== undefined) : false);
      if (rowHighlighted) hasHighlights = true;

      // Build the chain: [source, step2?, step3?, step4?, step5?, target]
      const chain: Array<{ name: string; level: number }> = [];
      chain.push({ name: String(sourceVal), level: 0 });

      if (step2Column) {
        const s2 = step2Column.values[i];
        if (s2 != null && String(s2).trim() !== '') {
          chain.push({ name: String(s2), level: 1 });
        }
      }

      if (step3Column) {
        const s3 = step3Column.values[i];
        if (s3 != null && String(s3).trim() !== '') {
          chain.push({ name: String(s3), level: 2 });
        }
      }

      if (step4Column) {
        const s4 = step4Column.values[i];
        if (s4 != null && String(s4).trim() !== '') {
          chain.push({ name: String(s4), level: 3 });
        }
      }

      if (step5Column) {
        const s5 = step5Column.values[i];
        if (s5 != null && String(s5).trim() !== '') {
          chain.push({ name: String(s5), level: 4 });
        }
      }

      chain.push({ name: String(targetVal), level: targetLevel });

      // Create a selection ID for this row
      const rowSelectionId = this.host.createSelectionIdBuilder()
        .withCategory(sourceColumn, i)
        .createSelectionId();

      // Create links for consecutive pairs in the chain
      for (let j = 0; j < chain.length - 1; j++) {
        const src = chain[j];
        const tgt = chain[j + 1];

        // Create nodes first — same name at different levels produces distinct nodes
        const srcIdx = getOrCreateNode(src.name, src.level, rowSelectionId, rowHighlighted);
        const tgtIdx = getOrCreateNode(tgt.name, tgt.level, rowSelectionId, rowHighlighted);

        // Skip true self-loops (same node), not same-name cross-level nodes
        if (srcIdx === tgtIdx) continue;

        // Deduplicate: sum weights for identical source→target pairs
        const linkKey = `${srcIdx}:${tgtIdx}`;
        const existing = linkMap.get(linkKey);
        if (existing) {
          existing.value += weight;
          if (rowHighlighted) existing.highlighted = true;
        } else {
          linkMap.set(linkKey, {
            source: srcIdx,
            target: tgtIdx,
            value: weight,
            selectionId: rowSelectionId,
            highlighted: rowHighlighted,
          });
        }
      }
    }

    if (nodes.length === 0 || linkMap.size === 0) return null;

    return { nodes, links: Array.from(linkMap.values()), layerCount: targetLevel + 1, hasHighlights };
  }

  // ── Rendering ────────────────────────────────────────────────

  private render(data: SankeyData | null, viewport: powerbi.IViewport): void {
    this.keyboardNavCleanup?.();
    this.keyboardNavCleanup = null;
    this.currentData = data;
    this.currentViewport = viewport;
    this.host.tooltipService.hide({ immediately: true, isTouchEvent: false });
    const themeName = resolveColorTheme(this.settings.colorThemeFormattingCard);
    const dimOpacity = this.settings.linkSettings.dimOpacity.value / 100;
    this.container.removeEventListener('click', this.handleBackgroundClick);
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    renderChartTitle(this.container, this.settings.titleFormattingCard);
    this.svg = null;

    const s = this.settings;

    // Apply card style
    const cardMode = (resolveDropdown(s.cardSettings.cardStyleMode) ?? 'glass') as CardStyleMode;
    applyCardStyle(this.container, {
      mode: cardMode,
      opacity: s.cardSettings.backgroundOpacity.value / 100,
      backgroundColor: s.cardSettings.backgroundColor?.value?.value,
      borderRadius: s.cardSettings.borderRadius.value,
    });
    const contentPadding = Math.max(0, s.cardSettings.contentPadding.value);
    this.container.style.boxSizing = 'border-box';
    this.container.style.padding = `${contentPadding}px`;
    // Handle empty/null data
    if (!data) {
      this.renderEmptyState();
      this.applyHighContrast();
      return;
    }

    const renderData = this.getCrossHighlightMode() === 'focus'
      ? (this.getFocusedHighlightData(data) ?? data)
      : data;

    // Dynamic margins based on label position and layer totals
    const labelPos = resolveDropdown(s.nodeLabelSettings.labelPosition) ?? 'beside';
    const labelFontSizeVal = s.nodeLabelSettings.labelFontSize.value;
    const baseWidth = Math.max(0, viewport.width - (contentPadding * 2));
    const baseHeight = Math.max(0, viewport.height - (contentPadding * 2));
    // Extra bottom margin so bottom node labels aren't clipped
    const extraBottom = labelPos === 'below'
      ? labelFontSizeVal + 4
      : labelPos === 'none' ? 0 : Math.ceil(labelFontSizeVal / 2) + 2;
    const estimatedLabelWidth = Math.max(
      0,
      ...renderData.nodes.map((node) => (node.name?.length ?? 0) * labelFontSizeVal * 0.55),
    );
    const besidePad = Math.max(
      16,
      Math.min(estimatedLabelWidth + 10, Math.max(16, baseWidth * 0.24)),
    );
    const MARGIN = {
      top: s.totalSettings.showLayerTotals.value ? BASE_MARGIN.top + 20 : BASE_MARGIN.top,
      right: labelPos === 'beside' ? besidePad : BASE_MARGIN.right,
      bottom: BASE_MARGIN.bottom + extraBottom,
      left: labelPos === 'beside' ? besidePad : BASE_MARGIN.left,
    };

    const baseInnerWidth = baseWidth - MARGIN.left - MARGIN.right;
    const baseInnerHeight = baseHeight - MARGIN.top - MARGIN.bottom;

    if (baseInnerWidth <= 0 || baseInnerHeight <= 0) return;

    const scrollEnabled = s.scrollFormattingCard.enableScroll.value;
    const minNodeSize = s.scrollFormattingCard.minCategoryWidth.value;

    // Build a configured sankey layout factory
    const alignFn = this.getAlignmentFunction();
    const sortOrder = resolveDropdown(s.layoutSettings.sortOrder) ?? 'auto';

    const buildLayout = (w: number, h: number) => {
      const layout = sankey<SankeyNodeDatum, SankeyLinkDatum>()
        .nodeWidth(s.nodeSettings.width.value)
        .nodePadding(s.nodeSettings.padding.value)
        .nodeAlign(alignFn)
        .iterations(s.layoutSettings.iterations.value)
        .extent([[0, 0], [w, h]]);

      if (sortOrder === 'ascending') {
        layout.nodeSort((a, b) => (a.value ?? 0) - (b.value ?? 0));
      } else if (sortOrder === 'descending') {
        layout.nodeSort((a, b) => (b.value ?? 0) - (a.value ?? 0));
      } else if (sortOrder === 'none') {
        layout.nodeSort(null);
      }

      return layout({
        nodes: renderData.nodes.map((d) => ({ ...d })),
        links: renderData.links.map((d) => ({ ...d })),
      });
    };

    // Probe: run layout at base dimensions, check if any node is too small
    const probe = buildLayout(baseInnerWidth, baseInnerHeight);
    const smallestNodeHeight = Math.min(
      ...probe.nodes.map((n) => (n.y1 ?? 0) - (n.y0 ?? 0)),
    );

    const needsScroll = scrollEnabled && smallestNodeHeight > 0 && smallestNodeHeight < minNodeSize;

    let svgParent: HTMLElement = this.container;
    let innerWidth = baseInnerWidth;
    let innerHeight = baseInnerHeight;
    let svgWidth = baseWidth;
    let svgHeight = baseHeight;

    if (needsScroll) {
      // Scale so the smallest node gets exactly minNodeSize pixels
      const scale = minNodeSize / smallestNodeHeight;
      const expandedInnerHeight = Math.ceil(baseInnerHeight * scale);

      ensureScrollStyles();

      const wrapper = document.createElement('div');
      wrapper.className = 'pbi-scroll-wrapper';
      wrapper.style.overflowX = 'hidden';
      wrapper.style.overflowY = 'auto';
      wrapper.style.width = `${baseWidth}px`;
      wrapper.style.height = '100%';
      this.container.appendChild(wrapper);

      svgParent = wrapper;
      innerHeight = expandedInnerHeight;
      svgHeight = expandedInnerHeight + MARGIN.top + MARGIN.bottom;
    }

    // Final layout at the (possibly expanded) dimensions
    const graph = needsScroll
      ? buildLayout(innerWidth, innerHeight)
      : probe;

    const layoutNodes = graph.nodes;
    const layoutLinks = graph.links;

    // Create SVG
    const svg = d3.select(svgParent)
      .append('svg')
      .attr('width', svgWidth)
      .attr('height', svgHeight);

    this.svg = svg;

    const g = svg.append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Compute total weight for percentage calculations
    const totalWeight = renderData.links.reduce((sum, l) => sum + l.value, 0);

    // Gradient definitions for links
    const defs = svg.append('defs');
    const colorMode = this.getLinkColorMode();
    if (colorMode === 'gradient') {
      layoutLinks.forEach((link) => {
        const sourceNode = link.source as LayoutNode;
        const targetNode = link.target as LayoutNode;
        const gradId = `${sourceNode.index ?? 0}-${targetNode.index ?? 0}`;
        const sourceColor = this.resolveNodeColor(sourceNode);
        const targetColor = this.resolveNodeColor(targetNode);

        const grad = defs.append('linearGradient')
          .attr('id', `sankey-grad-${this.instanceId}-${gradId}`)
          .attr('gradientUnits', 'userSpaceOnUse')
          .attr('x1', sourceNode.x1 ?? 0)
          .attr('x2', targetNode.x0 ?? 0);

        grad.append('stop')
          .attr('offset', '0%')
          .attr('stop-color', sourceColor);
        grad.append('stop')
          .attr('offset', '100%')
          .attr('stop-color', targetColor);
      });
    }

    // Render links
    const linkOpacity = s.linkSettings.opacity.value / 100;
    const hoverOpacity = s.linkSettings.hoverOpacity.value / 100;
    const curvature = s.linkSettings.curvature.value;
    const opacityByValue = s.linkSettings.opacityByValue.value;
    const maxLinkValue = Math.max(1, ...layoutLinks.map((l) => l.value));

    // Flow filtering: if a node is filtered, only show connected flows
    const hasFilteredNode = this.filteredNodeIndex != null
      && layoutNodes.some((node) => (node.index ?? -1) === this.filteredNodeIndex);
    if (!hasFilteredNode) {
      this.filteredNodeIndex = null;
    }

    const filteredLinks = this.filteredNodeIndex != null
      ? layoutLinks.filter((l) => {
          const src = l.source as LayoutNode;
          const tgt = l.target as LayoutNode;
          return src.index === this.filteredNodeIndex || tgt.index === this.filteredNodeIndex;
        })
      : layoutLinks;

    const linkGroup = g.append('g').attr('class', 'sankey-links');

    const linkPathGenerator = curvature !== 50
      ? this.createCustomLinkPath(curvature)
      : sankeyLinkHorizontal();

    const linkPaths = linkGroup.selectAll<SVGPathElement, LayoutLink>('.sankey-link')
      .data(filteredLinks)
      .join('path')
      .attr('class', 'sankey-link')
      .attr('data-link-highlighted', (d) => d.highlighted ? 'true' : 'false')
      .attr('data-selection-key', (d) => d.selectionId ? d.selectionId.getKey() : '')
      .attr('d', linkPathGenerator as unknown as (d: LayoutLink) => string | null)
      .attr('fill', 'none')
      .attr('stroke-width', (d) => Math.max(1, d.width ?? 0))
      .attr('stroke', (d, i) => this.getLinkStroke(d, i, colorMode))
      .attr('stroke-opacity', (d) =>
        opacityByValue ? Math.max(0.15, (d.value / maxLinkValue) * linkOpacity) : linkOpacity
      )
      .style('cursor', 'pointer')
      .on('click', (event: MouseEvent, d) => {
        if (!this.interactionsEnabled) return;
        event.stopPropagation();
        if (d.selectionId) {
          void this.selectionManager
            .select(d.selectionId, event.ctrlKey || event.metaKey)
            .then(() => this.applyCrossHighlight());
        }
      })
      .on('contextmenu', (event: MouseEvent, d) => {
        if (!this.interactionsEnabled) return;
        event.preventDefault();
        event.stopPropagation();
        if (d.selectionId) {
          void this.selectionManager.showContextMenu(d.selectionId, {
            x: event.clientX,
            y: event.clientY,
          });
        }
      });

    // Apply conditional formatting to links
    linkPaths.each((d, i, elements) => {
      const condColor = this.getConditionalColor(d.value);
      if (condColor) {
        d3.select(elements[i]).attr('stroke', condColor);
      }
    });

    // Render nodes
    const nodeGroup = g.append('g').attr('class', 'sankey-nodes');
    const nodeCornerRadius = s.nodeSettings.cornerRadius.value;
    const nodeOpacity = s.nodeSettings.opacity.value / 100;
    const borderColor = s.nodeSettings.nodeBorderColor.value?.value || 'none';
    const borderWidth = s.nodeSettings.nodeBorderWidth.value;
    const nodeMinHeight = s.nodeSettings.minHeight.value;

    // Filter visible nodes when filtering is active
    const filteredNodeIndices = this.filteredNodeIndex != null
      ? new Set<number>(
          [this.filteredNodeIndex,
           ...filteredLinks.map((l) => (l.source as LayoutNode).index ?? -1),
           ...filteredLinks.map((l) => (l.target as LayoutNode).index ?? -1)]
        )
      : null;

    const visibleNodes = filteredNodeIndices
      ? layoutNodes.filter((n) => filteredNodeIndices.has(n.index ?? -1))
      : layoutNodes;

    const nodeGroups = nodeGroup.selectAll<SVGGElement, LayoutNode>('.sankey-node')
      .data(visibleNodes)
      .join('g')
      .attr('class', 'sankey-node')
      .attr('data-node-highlighted', (d) => d.highlighted ? 'true' : 'false')
      .attr('data-selection-key', (d) => d.selectionId ? d.selectionId.getKey() : '')
      .style('cursor', 'pointer')
      .on('click', (event: MouseEvent, d) => {
        if (!this.interactionsEnabled) return;
        event.stopPropagation();
        if (s.sankeyInteractionSettings.enableFiltering.value) {
          // Toggle filtering on this node
          if (this.filteredNodeIndex === (d.index ?? -1)) {
            this.filteredNodeIndex = null;
          } else {
            this.filteredNodeIndex = d.index ?? -1;
          }
          this.render(this.currentData, viewport);
          return;
        }
        if (d.selectionId) {
          void this.selectionManager
            .select(d.selectionId, event.ctrlKey || event.metaKey)
            .then(() => this.applyCrossHighlight());
        }
      })
      .on('contextmenu', (event: MouseEvent, d) => {
        if (!this.interactionsEnabled) return;
        event.preventDefault();
        event.stopPropagation();
        if (d.selectionId) {
          void this.selectionManager.showContextMenu(d.selectionId, {
            x: event.clientX,
            y: event.clientY,
          });
        }
      });

    // Build per-layer node color resolver
    const ncMode = resolveDropdown(s.nodeColorSettings.colorMode) ?? 'auto';
    const ncMaxDepth = data.layerCount - 1;
    const layerColorPickers = [
      s.nodeColorSettings.sourceColor.value?.value,
      s.nodeColorSettings.step2Color.value?.value,
      s.nodeColorSettings.step3Color.value?.value,
      s.nodeColorSettings.step4Color.value?.value,
      s.nodeColorSettings.step5Color.value?.value,
    ];

    // Pre-build variation palettes per layer: Map<depth, Map<nodeIndex, color>>
    const nodeColorMap = new Map<number, string>();
    if (ncMode === 'byLayer') {
      // Group visible nodes by depth
      const depthGroups = new Map<number, number[]>();
      for (const node of visibleNodes) {
        const depth = node.depth ?? 0;
        const group = depthGroups.get(depth);
        if (group) {
          group.push(node.index ?? 0);
        } else {
          depthGroups.set(depth, [node.index ?? 0]);
        }
      }
      // Generate variations for each layer
      for (const [depth, indices] of depthGroups) {
        const baseColor = depth === ncMaxDepth
          ? (s.nodeColorSettings.targetColor.value?.value ?? '#EF4444')
          : (layerColorPickers[depth] ?? '#3B82F6');
        const variations = generateColorVariations(baseColor, indices.length);
        for (let i = 0; i < indices.length; i++) {
          nodeColorMap.set(indices[i], variations[i]);
        }
      }
    }

    this.resolveNodeColor = (d: { depth?: number; index?: number }): string => {
      if (ncMode === 'byLayer') {
        return nodeColorMap.get(d.index ?? 0) ?? '#3B82F6';
      }
      return getHostChartColor(this.host.colorPalette, d.index ?? 0, themeName);
    };

    nodeGroups.append('rect')
      .attr('x', (d) => d.x0 ?? 0)
      .attr('y', (d) => d.y0 ?? 0)
      .attr('width', (d) => (d.x1 ?? 0) - (d.x0 ?? 0))
      .attr('height', (d) => Math.max(nodeMinHeight, (d.y1 ?? 0) - (d.y0 ?? 0)))
      .attr('rx', nodeCornerRadius)
      .attr('ry', nodeCornerRadius)
      .attr('fill', (d) => this.resolveNodeColor(d))
      .attr('fill-opacity', nodeOpacity)
      .attr('stroke', borderColor !== 'none' ? borderColor : null)
      .attr('stroke-width', borderWidth > 0 ? borderWidth : null);

    // Node labels (labelPos already computed above for dynamic margins)
    const labelsHidden = labelPos === 'none';
    // When 'none', use 'beside' positioning but start hidden (revealed on hover)
    const effectiveLabelPos = labelsHidden ? 'beside' : labelPos;
    const labelFontSize = s.nodeLabelSettings.labelFontSize.value;
    const globalLabelColor = s.nodeLabelSettings.labelColor.value?.value || undefined;
    const labelFontFamily = resolveDropdown(s.nodeLabelSettings.labelFontFamily) ?? 'Segoe UI';
    const labelFontWeight = resolveDropdown(s.nodeLabelSettings.labelFontWeight) ?? 'normal';
    const labelFontStyle = resolveDropdown(s.nodeLabelSettings.labelFontStyle) ?? 'normal';
    const theme = getTheme('light');

    // Per-layer label colors: depth → color (empty string = use global/theme fallback)
    const layerCount = data.layerCount;
    const maxDepth = layerCount - 1; // target layer depth
    const perLayerColors: Array<string | undefined> = [];
    // Layer color settings indexed by layer position: [source, step2, step3, step4, step5, target]
    const layerColorSettings = [
      s.nodeLabelSettings.sourceLabelColor.value?.value,
      s.nodeLabelSettings.step2LabelColor.value?.value,
      s.nodeLabelSettings.step3LabelColor.value?.value,
      s.nodeLabelSettings.step4LabelColor.value?.value,
      s.nodeLabelSettings.step5LabelColor.value?.value,
    ];
    // Map each depth to the correct layer color
    for (let depth = 0; depth < layerCount; depth++) {
      if (depth === maxDepth) {
        // Target layer — always the last
        const tc = s.nodeLabelSettings.targetLabelColor.value?.value;
        perLayerColors.push(tc && tc.length > 0 ? tc : undefined);
      } else {
        // Source (depth 0) or intermediate step
        const lc = layerColorSettings[depth];
        perLayerColors.push(lc && lc.length > 0 ? lc : undefined);
      }
    }

    /** Resolve the fill color for a node label based on its depth. */
    const resolveLabelColor = (depth: number): string => {
      const layerColor = perLayerColors[depth];
      if (layerColor) return layerColor;
      if (globalLabelColor) return globalLabelColor;
      return theme.text.primary;
    };

    nodeGroups.append('text')
      .attr('class', 'sankey-node-label')
      .attr('x', (d) => {
        if (effectiveLabelPos === 'inside' || effectiveLabelPos === 'above' || effectiveLabelPos === 'below') {
          return ((d.x0 ?? 0) + (d.x1 ?? 0)) / 2;
        }
        // Beside: left-aligned nodes get label on right, right-aligned on left
        const midX = innerWidth / 2;
        const nodeCenter = ((d.x0 ?? 0) + (d.x1 ?? 0)) / 2;
        return nodeCenter < midX
          ? (d.x1 ?? 0) + 6
          : (d.x0 ?? 0) - 6;
      })
      .attr('y', (d) => {
        if (effectiveLabelPos === 'above') return (d.y0 ?? 0) - 4;
        if (effectiveLabelPos === 'below') return (d.y1 ?? 0) + labelFontSize + 2;
        return ((d.y0 ?? 0) + (d.y1 ?? 0)) / 2;
      })
      .attr('dy', (effectiveLabelPos === 'above' || effectiveLabelPos === 'below') ? '0' : '0.35em')
      .attr('text-anchor', (d) => {
        if (effectiveLabelPos === 'inside' || effectiveLabelPos === 'above' || effectiveLabelPos === 'below') return 'middle';
        const midX = innerWidth / 2;
        const nodeCenter = ((d.x0 ?? 0) + (d.x1 ?? 0)) / 2;
        return nodeCenter < midX ? 'start' : 'end';
      })
      .attr('font-size', labelFontSize)
      .attr('font-family', labelFontFamily)
      .attr('font-weight', labelFontWeight)
      .attr('font-style', labelFontStyle)
      .attr('fill', (d) => resolveLabelColor(d.depth ?? 0))
      .text((d) => {
        const fullLabel = d.name ?? '';
        return effectiveLabelPos === 'beside'
          ? truncateText(fullLabel, Math.max(12, besidePad - 10), labelFontSize)
          : fullLabel;
      })
      .each(function (d) {
        const fullLabel = d.name ?? '';
        if (d3.select(this).text() !== fullLabel) {
          d3.select(this).append('title').text(fullLabel);
        }
      });

    // When labels are hidden, start them invisible with a fade transition
    if (labelsHidden) {
      nodeGroups.selectAll('.sankey-node-label')
        .style('opacity', '0')
        .style('transition', 'opacity 0.2s ease')
        .style('pointer-events', 'none');
    }

    // Node drag repositioning (vertical only)
    if (s.sankeyInteractionSettings.enableDrag.value && this.interactionsEnabled) {
      const dragBehavior = d3.drag<SVGGElement, LayoutNode>()
        .on('drag', (event: d3.D3DragEvent<SVGGElement, LayoutNode, LayoutNode>, d) => {
          const dy = event.dy;
          const newY0 = (d.y0 ?? 0) + dy;
          const newY1 = (d.y1 ?? 0) + dy;
          if (newY0 >= 0 && newY1 <= innerHeight) {
            d.y0 = newY0;
            d.y1 = newY1;
            // Update the dragged node group
            const draggedGroup = d3.select(event.sourceEvent.currentTarget as SVGGElement);
            draggedGroup.select('rect').attr('y', d.y0);
            draggedGroup.select('.sankey-node-label').attr('y', (d.y0 + d.y1) / 2);
            // Re-draw links using the path generator
            linkPaths.attr('d', linkPathGenerator as unknown as (link: LayoutLink) => string | null);
          }
        });
      nodeGroups.call(dragBehavior);
    }

    // Node value labels (controlled by totalSettings.showNodeValues)
    if (s.totalSettings.showNodeValues.value) {
      this.renderNodeValues(nodeGroups, totalWeight);
    }

    // Layer column totals
    if (s.totalSettings.showLayerTotals.value) {
      this.renderLayerTotals(g, layoutNodes, innerWidth, innerHeight, totalWeight);
    }

    // Link labels (new)
    if (s.linkLabelSettings.showLinkLabels.value) {
      this.renderLinkLabels(g, filteredLinks, totalWeight);
    }

    // Link & node tooltips via PBI tooltipService
    if (s.tooltipSettings.showTooltips.value) {
      const valueFormat = resolveDropdown(s.tooltipSettings.valueFormat) ?? 'auto';
      const showPct = s.tooltipSettings.showPercentage.value;

      linkPaths
        .on('mouseenter.tooltip', (event: MouseEvent, d: LayoutLink) => {
          const src = (d.source as LayoutNode).name ?? '';
          const tgt = (d.target as LayoutNode).name ?? '';
          const tooltipItems: VisualTooltipDataItem[] = [
            { displayName: 'Source', value: src },
            { displayName: 'Target', value: tgt },
            { displayName: 'Value', value: this.formatTooltipValue(d.value, valueFormat) },
          ];
          if (showPct && totalWeight > 0) {
            tooltipItems.push({ displayName: '% of Total', value: formatPercent(d.value / totalWeight) });
          }
          this.host.tooltipService.show({
            dataItems: tooltipItems,
            identities: d.selectionId ? [d.selectionId] : [],
            coordinates: [event.clientX, event.clientY],
            isTouchEvent: false,
          });
        })
        .on('mousemove.tooltip', (event: MouseEvent) => {
          this.host.tooltipService.move({
            dataItems: [],
            identities: [],
            coordinates: [event.clientX, event.clientY],
            isTouchEvent: false,
          });
        })
        .on('mouseleave.tooltip', () => {
          this.host.tooltipService.hide({ immediately: true, isTouchEvent: false });
        });

      // Node tooltips
      nodeGroups
        .on('mouseenter.tooltip', (event: MouseEvent, d: LayoutNode) => {
          const nodeValue = d.value ?? 0;
          const tooltipItems: VisualTooltipDataItem[] = [
            { displayName: 'Node', value: d.name },
            { displayName: 'Value', value: this.formatTooltipValue(nodeValue, valueFormat) },
          ];
          if (showPct && totalWeight > 0) {
            tooltipItems.push({ displayName: '% of Total', value: formatPercent(nodeValue / totalWeight) });
          }
          this.host.tooltipService.show({
            dataItems: tooltipItems,
            identities: d.selectionId ? [d.selectionId] : [],
            coordinates: [event.clientX, event.clientY],
            isTouchEvent: false,
          });
        })
        .on('mousemove.tooltip', (event: MouseEvent) => {
          this.host.tooltipService.move({
            dataItems: [],
            identities: [],
            coordinates: [event.clientX, event.clientY],
            isTouchEvent: false,
          });
        })
        .on('mouseleave.tooltip', () => {
          this.host.tooltipService.hide({ immediately: true, isTouchEvent: false });
        });
    }

    // Flow value labels on hover (show value at link midpoint on hover)
    if (s.linkLabelSettings.showFlowLabels.value) {
      const flowLabelGroup = g.append('g').attr('class', 'sankey-flow-labels');
      linkPaths
        .on('mouseenter.flowlabel', (_event: MouseEvent, d: LayoutLink) => {
          const src = d.source as LayoutNode;
          const tgt = d.target as LayoutNode;
          const midX = ((src.x1 ?? 0) + (tgt.x0 ?? 0)) / 2;
          const midY = ((d.y0 ?? 0) + (d.y1 ?? 0)) / 2 + (d.width ?? 0) / 2;
          flowLabelGroup.selectAll('*').remove();
          const flowFontSize = s.linkLabelSettings.linkLabelFontSize.value;
          const flowFontColor = s.linkLabelSettings.linkLabelFontColor.value?.value || theme.text.primary;
          const flowFontFamily = resolveDropdown(s.linkLabelSettings.linkLabelFontFamily);
          const flowFontWeight = resolveDropdown(s.linkLabelSettings.linkLabelFontWeight) ?? 'normal';
          const flowLabel = flowLabelGroup.append('text')
            .attr('x', midX)
            .attr('y', midY)
            .attr('dy', '-0.5em')
            .attr('text-anchor', 'middle')
            .attr('font-size', flowFontSize)
            .attr('font-weight', flowFontWeight)
            .attr('fill', flowFontColor)
            .attr('pointer-events', 'none')
            .text(formatWithSettings(d.value, this.settings.numberFormattingCard));
          if (flowFontFamily) {
            flowLabel.attr('font-family', flowFontFamily);
          }
        })
        .on('mouseleave.flowlabel', () => {
          flowLabelGroup.selectAll('*').remove();
        });
    }

    // Hover interactions (with flow path highlighting)
    const highlightFlows = s.sankeyInteractionSettings.highlightFlows.value;
    this.attachHoverBehavior(nodeGroups, linkPaths, filteredLinks, linkOpacity, hoverOpacity, dimOpacity, labelsHidden, highlightFlows, opacityByValue, maxLinkValue);

    // Entrance animations
    if (s.animationSettings.enabled.value) {
      this.animateEntrance(nodeGroups, linkPaths, s.animationSettings.duration.value);
    }

    // Accessibility
    if (s.accessibilityFormattingCard.enableKeyboardNav.value) {
      ensureFocusRingStyles();
      const nodeEls = this.container.querySelectorAll('.sankey-node rect');
      applyChartAria(this.container, {
        chartType: 'sankey-diagram',
        dataPointCount: visibleNodes.length,
      });
      nodeEls.forEach((el, i) => {
        const node = visibleNodes[i];
        if (node) {
          applyDataPointAria(
            el,
            node.name,
            formatWithSettings(node.value ?? 0, this.settings.numberFormattingCard),
            i,
            visibleNodes.length,
          );
        }
      });
      this.keyboardNavCleanup = attachKeyboardNav({
        container: this.container,
        itemSelector: '.sankey-node rect',
        onActivate: (el) => {
          el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        },
      });
    }

    // Legend
    this.renderSankeyLegend(visibleNodes, themeName);

    // Cross-highlight dimming
    this.applyCrossHighlight();
    this.applyHighContrast();

    this.container.addEventListener('click', this.handleBackgroundClick);
  }

  // ── Legend ──────────────────────────────────────────────────────

  private renderSankeyLegend(nodes: LayoutNode[], themeName: ColorThemeName): void {
    const legendFmtCard = this.settings.legendFormattingCard;
    if (!legendFmtCard.showLegend.value) return;

    const rawFontColor = legendFmtCard.legendFontColor.value?.value;
    const legendFontColor = rawFontColor != null && rawFontColor.length > 0 ? rawFontColor : '#475569';
    const legendFontSize = legendFmtCard.legendFontSize.value;
    const resolvedPos = resolveDropdown(legendFmtCard.legendPosition) ?? 'bottom';
    const legendPos = resolvedPos === 'top' || resolvedPos === 'bottom' || resolvedPos === 'left' || resolvedPos === 'right'
      ? resolvedPos
      : 'bottom';

    // Deduplicate nodes by name to build legend items
    const seen = new Set<string>();
    const items: LegendItem[] = [];
    for (const node of nodes) {
      const name = node.name ?? '';
      if (seen.has(name)) continue;
      seen.add(name);
      items.push({
        label: name,
        color: this.resolveNodeColor(node),
      });
    }

    const rawLegendFontFamily = resolveDropdown(legendFmtCard.legendFontFamily) || undefined;

    renderLegend(this.container, {
      items,
      position: legendPos,
      fontSize: legendFontSize,
      fontColor: legendFontColor,
      fontFamily: rawLegendFontFamily,
      fontWeight: resolveDropdown(legendFmtCard.legendFontWeight) || 'normal',
      aliases: legendFmtCard.legendAliases.value,
    });
  }

  private renderLinkLabels(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    layoutLinks: LayoutLink[],
    totalWeight: number,
  ): void {
    const s = this.settings.linkLabelSettings;
    const fontSize = s.linkLabelFontSize.value;
    const fontColor = s.linkLabelFontColor.value?.value || '#333333';
    const fontFamily = resolveDropdown(s.linkLabelFontFamily) || '';
    const fontWeight = resolveDropdown(s.linkLabelFontWeight) ?? 'normal';
    const labelFormat = resolveDropdown(s.linkLabelFormat) ?? 'value';

    const labelGroup = g.append('g').attr('class', 'sankey-link-labels');

    const linkLabelSelection = labelGroup.selectAll<SVGTextElement, LayoutLink>('.sankey-link-label')
      .data(layoutLinks)
      .join('text')
      .attr('class', 'sankey-link-label')
      .attr('x', (d) => {
        const src = d.source as LayoutNode;
        const tgt = d.target as LayoutNode;
        return ((src.x1 ?? 0) + (tgt.x0 ?? 0)) / 2;
      })
      .attr('y', (d) => {
        return ((d.y0 ?? 0) + (d.y1 ?? 0)) / 2 + (d.width ?? 0) / 2;
      })
      .attr('dy', '0.35em')
      .attr('text-anchor', 'middle')
      .attr('font-size', fontSize)
      .attr('font-weight', fontWeight)
      .attr('fill', fontColor);

    if (fontFamily) {
      linkLabelSelection.attr('font-family', fontFamily);
    }

    linkLabelSelection
      .text((d) => {
        const val = formatWithSettings(d.value, this.settings.numberFormattingCard);
        if (labelFormat === 'percent' && totalWeight > 0) {
          return formatPercent(d.value / totalWeight);
        }
        if (labelFormat === 'both' && totalWeight > 0) {
          return `${val} (${formatPercent(d.value / totalWeight)})`;
        }
        return val;
      });
  }

  // ── Node Values ──────────────────────────────────────────────

  /**
   * Appends a value label below each node's name label.
   */
  private renderNodeValues(
    nodeGroups: d3.Selection<SVGGElement, LayoutNode, SVGGElement, unknown>,
    totalWeight: number,
  ): void {
    const ts = this.settings.totalSettings;
    const fontSize = ts.totalFontSize.value;
    const fontColor = ts.totalFontColor.value?.value || '';
    const nodeFontFamily = resolveDropdown(ts.totalFontFamily) || '';
    const nodeFontWeight = resolveDropdown(ts.totalFontWeight) || '600';
    const valueFormat = resolveDropdown(ts.nodeValueFormat) ?? 'value';
    const theme = getTheme('light');
    const numFmt = this.settings.numberFormattingCard;

    nodeGroups.each(function (d) {
      const group = d3.select(this);
      const label = group.select<SVGTextElement>('.sankey-node-label');
      if (label.empty()) return;

      const nodeValue = d.value ?? 0;
      let text: string;
      if (valueFormat === 'percent' && totalWeight > 0) {
        text = formatPercent(nodeValue / totalWeight);
      } else if (valueFormat === 'both' && totalWeight > 0) {
        text = `${formatWithSettings(nodeValue, numFmt)} (${formatPercent(nodeValue / totalWeight)})`;
      } else {
        text = formatWithSettings(nodeValue, numFmt);
      }

      const valueLabel = group.append('text')
        .attr('class', 'sankey-node-value')
        .attr('x', label.attr('x'))
        .attr('y', Number(label.attr('y')) + fontSize + 2)
        .attr('dy', label.attr('dy'))
        .attr('text-anchor', label.attr('text-anchor'))
        .attr('font-size', fontSize)
        .attr('font-weight', nodeFontWeight)
        .attr('fill', fontColor || theme.text.secondary)
        .text(text);

      if (nodeFontFamily) {
        valueLabel.attr('font-family', nodeFontFamily);
      }
    });
  }

  // ── Layer Totals ────────────────────────────────────────────

  /**
   * Renders a total value above or below each layer (column) in the Sankey.
   */
  private renderLayerTotals(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    layoutNodes: LayoutNode[],
    innerWidth: number,
    innerHeight: number,
    totalWeight: number,
  ): void {
    const ts = this.settings.totalSettings;
    const fontSize = ts.totalFontSize.value;
    const fontColor = ts.totalFontColor.value?.value || '';
    const position = resolveDropdown(ts.layerTotalPosition) ?? 'top';
    const theme = getTheme('light');

    // Group nodes by layer (depth)
    const layerMap = new Map<number, LayoutNode[]>();
    for (const node of layoutNodes) {
      const depth = node.depth ?? 0;
      const group = layerMap.get(depth);
      if (group) {
        group.push(node);
      } else {
        layerMap.set(depth, [node]);
      }
    }

    const totalFontFamily = resolveDropdown(ts.totalFontFamily) || '';
    const totalFontWeight = resolveDropdown(ts.totalFontWeight) || '600';
    const totalGroup = g.append('g').attr('class', 'sankey-layer-totals');
    const resolvedColor = fontColor || theme.text.secondary;

    for (const [, nodes] of layerMap) {
      // Sum values for this layer — use node.value (total flow through node)
      const layerTotal = nodes.reduce((sum, n) => sum + (n.value ?? 0), 0);

      // X position: center of the layer's nodes
      const xMin = Math.min(...nodes.map((n) => n.x0 ?? 0));
      const xMax = Math.max(...nodes.map((n) => n.x1 ?? 0));
      const x = (xMin + xMax) / 2;

      // Y position: above or below the chart area
      const y = position === 'top' ? -6 : innerHeight + fontSize + 4;

      const text = formatWithSettings(layerTotal, this.settings.numberFormattingCard);

      const totalLabel = totalGroup.append('text')
        .attr('class', 'sankey-layer-total')
        .attr('x', x)
        .attr('y', y)
        .attr('text-anchor', 'middle')
        .attr('font-size', fontSize)
        .attr('font-weight', totalFontWeight)
        .attr('fill', resolvedColor)
        .text(text);

      if (totalFontFamily) {
        totalLabel.attr('font-family', totalFontFamily);
      }
    }
  }

  // ── Empty State ──────────────────────────────────────────────

  private renderEmptyState(): void {
    const empty = document.createElement('div');
    empty.className = 'sankey-empty-state';
    empty.textContent = this.emptyStateMode === 'noData'
      ? getLocalizedString(this.host, 'SankeyDiagram_NoDataState', 'No data for the current selection.')
      : EMPTY_STATE_TEXT;
    this.container.appendChild(empty);
  }

  // ── Layout Alignment ──────────────────────────────────────────

  private getAlignmentFunction(): (node: SankeyNode<SankeyNodeDatum, SankeyLinkDatum>, n: number) => number {
    const align = resolveDropdown(this.settings.layoutSettings.nodeAlign) ?? 'justify';
    type AlignFn = (node: SankeyNode<SankeyNodeDatum, SankeyLinkDatum>, n: number) => number;
    switch (align) {
      case 'left': return sankeyLeft as AlignFn;
      case 'right': return sankeyRight as AlignFn;
      case 'center': return sankeyCenter as AlignFn;
      case 'justify':
      default: return sankeyJustify as AlignFn;
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

  // ── Link Color Helpers ───────────────────────────────────────

  private getLinkColorMode(): LinkColorMode {
    const raw = resolveDropdown(this.settings.linkSettings.colorMode);
    if (raw === 'source' || raw === 'target' || raw === 'gradient' || raw === 'custom') return raw;
    return 'gradient';
  }

  private getLinkStroke(link: LayoutLink, _index: number, mode: LinkColorMode): string {
    switch (mode) {
      case 'source': {
        const sourceNode = link.source as LayoutNode;
        return this.resolveNodeColor(sourceNode);
      }
      case 'target': {
        const targetNode = link.target as LayoutNode;
        return this.resolveNodeColor(targetNode);
      }
      case 'gradient': {
        const src = link.source as LayoutNode;
        const tgt = link.target as LayoutNode;
        return `url(#sankey-grad-${this.instanceId}-${src.index ?? 0}-${tgt.index ?? 0})`;
      }
      case 'custom':
        return this.settings.linkSettings.customColor.value?.value ?? '#64748B';
    }
  }

  // ── Custom Link Path (Curvature) ──────────────────────────────

  private createCustomLinkPath(curvatureSetting: number): (d: LayoutLink) => string {
    // Map 0-100 to 0.0-1.0 control point offset
    const t = Math.max(0, Math.min(100, curvatureSetting)) / 100;

    return (d: LayoutLink) => {
      const sourceNode = d.source as LayoutNode;
      const targetNode = d.target as LayoutNode;
      const x0 = sourceNode.x1 ?? 0;
      const x1 = targetNode.x0 ?? 0;
      const y0 = d.y0 ?? 0;
      const y1 = d.y1 ?? 0;

      // Control point x offset based on curvature
      const cpOffset = (x1 - x0) * t;
      const cp1x = x0 + cpOffset;
      const cp2x = x1 - cpOffset;

      return `M${x0},${y0}C${cp1x},${y0} ${cp2x},${y1} ${x1},${y1}`;
    };
  }

  // ── Tooltip Formatting ────────────────────────────────────────

  private formatTooltipValue(value: number, format: string): string {
    if (format === 'full') {
      return value.toLocaleString();
    }
    if (format === 'abbreviated') {
      return formatWithSettings(value, this.settings.numberFormattingCard);
    }
    // 'auto' — use numberFormattingCard
    return formatWithSettings(value, this.settings.numberFormattingCard);
  }

  // ── Hover Behavior ───────────────────────────────────────────

  private attachHoverBehavior(
    nodeGroups: d3.Selection<SVGGElement, LayoutNode, SVGGElement, unknown>,
    linkPaths: d3.Selection<SVGPathElement, LayoutLink, SVGGElement, unknown>,
    layoutLinks: LayoutLink[],
    baseOpacity: number,
    hoverOpacity: number,
    dimOpacity: number,
    labelsHidden: boolean,
    highlightFlowPath: boolean,
    opacityByValue: boolean,
    maxLinkValue: number,
  ): void {
    /** Trace upstream/downstream from a node to find the full flow path. */
    const traceFlowPath = (startIndex: number): { nodeIndices: Set<number>; linkIndices: Set<number> } => {
      const nodeIndices = new Set<number>();
      const linkIndices = new Set<number>();
      nodeIndices.add(startIndex);

      // BFS downstream
      const downstream = [startIndex];
      while (downstream.length > 0) {
        const current = downstream.pop()!;
        layoutLinks.forEach((link, i) => {
          const src = link.source as LayoutNode;
          const tgt = link.target as LayoutNode;
          if ((src.index ?? -1) === current && !nodeIndices.has(tgt.index ?? -1)) {
            nodeIndices.add(tgt.index ?? -1);
            linkIndices.add(i);
            downstream.push(tgt.index ?? -1);
          }
        });
      }

      // BFS upstream
      const upstream = [startIndex];
      while (upstream.length > 0) {
        const current = upstream.pop()!;
        layoutLinks.forEach((link, i) => {
          const src = link.source as LayoutNode;
          const tgt = link.target as LayoutNode;
          if ((tgt.index ?? -1) === current && !nodeIndices.has(src.index ?? -1)) {
            nodeIndices.add(src.index ?? -1);
            linkIndices.add(i);
            upstream.push(src.index ?? -1);
          }
        });
      }

      return { nodeIndices, linkIndices };
    };

    const resolveBaseOpacity = (d: LayoutLink): number =>
      opacityByValue ? Math.max(0.15, (d.value / maxLinkValue) * baseOpacity) : baseOpacity;

    // Node hover: highlight connected links and nodes, dim everything else
    nodeGroups
      .on('mouseenter', (_event: MouseEvent, hoveredNode: LayoutNode) => {
        const hoveredIndex = hoveredNode.index ?? -1;

        let connectedNodeIndices: Set<number>;
        let connectedLinkIndices: Set<number>;

        if (highlightFlowPath) {
          const trace = traceFlowPath(hoveredIndex);
          connectedNodeIndices = trace.nodeIndices;
          connectedLinkIndices = trace.linkIndices;
        } else {
          connectedNodeIndices = new Set<number>();
          connectedNodeIndices.add(hoveredIndex);
          connectedLinkIndices = new Set<number>();
          layoutLinks.forEach((link, i) => {
            const src = link.source as LayoutNode;
            const tgt = link.target as LayoutNode;
            if (src.index === hoveredIndex || tgt.index === hoveredIndex) {
              connectedLinkIndices.add(i);
              connectedNodeIndices.add(src.index ?? -1);
              connectedNodeIndices.add(tgt.index ?? -1);
            }
          });
        }

        nodeGroups.attr('opacity', (d) =>
          connectedNodeIndices.has(d.index ?? -1) ? 1 : dimOpacity
        );

        linkPaths.attr('stroke-opacity', (_d, i) =>
          connectedLinkIndices.has(i) ? hoverOpacity : dimOpacity
        );

        // Reveal labels for connected nodes when labels are hidden
        if (labelsHidden) {
          nodeGroups.select<SVGTextElement>('.sankey-node-label')
            .style('opacity', (d) =>
              connectedNodeIndices.has(d.index ?? -1) ? 1 : 0
            );
        }
      })
      .on('mouseleave', () => {
        nodeGroups.attr('opacity', 1);
        linkPaths.attr('stroke-opacity', (_d) => resolveBaseOpacity(_d));

        if (labelsHidden) {
          nodeGroups.select('.sankey-node-label').style('opacity', 0);
        }
      });

    // Link hover: highlight the link and its source/target nodes
    linkPaths
      .on('mouseenter.highlight', (_event: MouseEvent, hoveredLink: LayoutLink) => {
        const src = hoveredLink.source as LayoutNode;
        const tgt = hoveredLink.target as LayoutNode;
        const connectedIndices = new Set([src.index ?? -1, tgt.index ?? -1]);

        nodeGroups.attr('opacity', (d) =>
          connectedIndices.has(d.index ?? -1) ? 1 : dimOpacity
        );

        linkPaths.attr('stroke-opacity', (d) =>
          d === hoveredLink ? hoverOpacity : dimOpacity
        );

        // Reveal labels for source and target nodes when labels are hidden
        if (labelsHidden) {
          nodeGroups.select<SVGTextElement>('.sankey-node-label')
            .style('opacity', (d) =>
              connectedIndices.has(d.index ?? -1) ? 1 : 0
            );
        }
      })
      .on('mouseleave.highlight', () => {
        nodeGroups.attr('opacity', 1);
        linkPaths.attr('stroke-opacity', (_d) => resolveBaseOpacity(_d));

        if (labelsHidden) {
          nodeGroups.select('.sankey-node-label').style('opacity', 0);
        }
      });
  }

  // ── Entrance Animation ───────────────────────────────────────

  private animateEntrance(
    nodeGroups: d3.Selection<SVGGElement, LayoutNode, SVGGElement, unknown>,
    linkPaths: d3.Selection<SVGPathElement, LayoutLink, SVGGElement, unknown>,
    duration: number,
  ): void {
    const stagger = DURATION.stagger;

    // Staggered fade-in for nodes
    nodeGroups.each((_d, i, elements) => {
      const el = elements[i];
      if (!el) return;

      el.style.opacity = '0';
      const delay = i * stagger;

      const cancel = animate(
        duration,
        cubicOut,
        (progress) => {
          el.style.opacity = `${progress}`;
        },
      );

      // Wrap with delay
      const originalCancel = cancel;

      // Reset opacity first, then start delayed animation
      el.style.opacity = '0';
      let animCancel: (() => void) | null = null;

      // Cancel the immediate animation that started above
      originalCancel();

      const timeoutId = setTimeout(() => {
        animCancel = animate(
          duration,
          cubicOut,
          (progress) => {
            el.style.opacity = `${progress}`;
          },
        );
      }, delay);

      this.cancelAnimations.push(() => {
        clearTimeout(timeoutId);
        animCancel?.();
        el.style.opacity = '';
      });
    });

    // Staggered fade-in for links (start after a base delay)
    const linkBaseDelay = (nodeGroups.size() * stagger) / 2;

    linkPaths.each((_d, i, elements) => {
      const el = elements[i];
      if (!el) return;

      const currentOpacity = el.getAttribute('stroke-opacity') ?? '0.4';
      const targetOpacity = parseFloat(currentOpacity);
      el.setAttribute('stroke-opacity', '0');

      const delay = linkBaseDelay + i * (stagger / 2);
      let animCancel: (() => void) | null = null;

      const timeoutId = setTimeout(() => {
        animCancel = animate(
          duration,
          cubicOut,
          (progress) => {
            el.setAttribute('stroke-opacity', `${targetOpacity * progress}`);
          },
        );
      }, delay);

      this.cancelAnimations.push(() => {
        clearTimeout(timeoutId);
        animCancel?.();
        el.setAttribute('stroke-opacity', `${targetOpacity}`);
      });
    });
  }

  // ── Formatting Pane ──────────────────────────────────────────

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  // ── Cross-Highlight ──────────────────────────────────────────────

  private applyCrossHighlight(): void {
    const data = this.currentData;
    if (!data) return;

    const hasSelection = this.selectionManager.hasSelection();
    const useHighlightDimming = data.hasHighlights && this.getCrossHighlightMode() === 'dim';
    if (!hasSelection && !useHighlightDimming) {
      this.container.querySelectorAll<SVGElement>('.sankey-link, .sankey-node').forEach((element) => {
        element.style.opacity = '';
      });
      return;
    }
    const selectedIds = this.selectionManager.getSelectionIds() as ISelectionId[];
    const selectedKeys = new Set(selectedIds.map((id) => id.getKey()));

    // Dim links
    const links = this.container.querySelectorAll<SVGPathElement>('.sankey-link');
    for (const el of Array.from(links)) {
      const isHighlighted = useHighlightDimming && el.getAttribute('data-link-highlighted') === 'true';
      const elKey = el.getAttribute('data-selection-key');
      const isSelected = hasSelection && elKey !== null && selectedKeys.has(elKey);
      el.style.opacity = (isHighlighted || isSelected) ? '' : '0.3';
    }

    // Dim node groups (rect + labels together)
    const nodeGroups = this.container.querySelectorAll<SVGGElement>('.sankey-node');
    for (const group of Array.from(nodeGroups)) {
      const isHighlighted = useHighlightDimming && group.getAttribute('data-node-highlighted') === 'true';
      const nodeKey = group.getAttribute('data-selection-key');
      const isSelected = hasSelection && nodeKey !== null && selectedKeys.has(nodeKey);
      (group as SVGGElement).style.opacity = (isHighlighted || isSelected) ? '' : '0.3';
    }
  }

  private handleBackgroundClick = (): void => {
    if (!this.interactionsEnabled) return;
    const wasFiltered = this.filteredNodeIndex != null;
    this.filteredNodeIndex = null;
    const clearPromise = this.selectionManager.clear();
    if (wasFiltered) {
      this.render(this.currentData, this.currentViewport);
    }
    void clearPromise.then(() => this.applyCrossHighlight());
  };

  private applyHighContrast(): void {
    const colors = getHostHighContrastColors(this.host);
    applyBasicHighContrastStyles(this.container, colors, {
      textSelectors: ['svg text', '.chart-title', '.chart-subtitle', '.pbi-shared-legend span', '.sankey-empty-state'],
      fillSelectors: ['.sankey-node rect'],
      strokeSelectors: ['.sankey-link'],
    });
    if (!colors.enabled) return;
    this.container.style.background = colors.background;
    this.container.style.boxShadow = 'none';
  }

  // ── Lifecycle ────────────────────────────────────────────────

  public destroy(): void {
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.keyboardNavCleanup?.();
    this.keyboardNavCleanup = null;
    this.host.tooltipService.hide({ immediately: true, isTouchEvent: false });
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];
    this.svg = null;
  }

  private getCrossHighlightMode(): 'focus' | 'dim' {
    return resolveDropdown(this.settings.sankeyInteractionSettings.crossHighlightMode) === 'dim' ? 'dim' : 'focus';
  }

  private getFocusedHighlightData(data: SankeyData): SankeyData | null {
    if (!data.hasHighlights) return data;

    const highlightedLinks = data.links.filter((link) => link.highlighted);
    const highlightedNodeIndices = new Set<number>();
    for (const link of highlightedLinks) {
      highlightedNodeIndices.add(Number(link.source));
      highlightedNodeIndices.add(Number(link.target));
    }
    for (const node of data.nodes) {
      if (node.highlighted) {
        highlightedNodeIndices.add(node.index);
      }
    }

    if (highlightedNodeIndices.size === 0) {
      return data;
    }

    const nodeIndexMap = new Map<number, number>();
    const nodes = data.nodes
      .filter((node) => highlightedNodeIndices.has(node.index))
      .map((node, index) => {
        nodeIndexMap.set(node.index, index);
        return { ...node, index };
      });

    const links = highlightedLinks
      .map((link) => {
        const sourceIndex = nodeIndexMap.get(Number(link.source));
        const targetIndex = nodeIndexMap.get(Number(link.target));
        if (sourceIndex == null || targetIndex == null) {
          return null;
        }

        return {
          ...link,
          source: sourceIndex,
          target: targetIndex,
        };
      })
      .filter((link): link is SankeyLinkDatum => link !== null);

    return {
      nodes,
      links,
      layerCount: data.layerCount,
      hasHighlights: data.hasHighlights,
    };
  }
}
