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
  formatNumber,
  formatPercent,
  animate,
  cubicOut,
  DURATION,
  getTheme,
  getHostChartColor,
  getGlassStyle,
  renderChartTitle,
  applyDataLabelFormatting,
  createScrollableChart,
} from '../../core/src';

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataView = powerbi.DataView;
import ISelectionId = powerbi.visuals.ISelectionId;

import '../style/visual.less';

// ── Internal Types ───────────────────────────────────────────────

/** Minimal node datum for the sankey layout. */
interface SankeyNodeDatum {
  name: string;
  index: number;
  selectionId: ISelectionId;
}

/** Minimal link datum for the sankey layout. */
interface SankeyLinkDatum {
  source: number;
  target: number;
  value: number;
  selectionId: ISelectionId;
}

/** Fully laid-out node (after sankey computation). */
type LayoutNode = SankeyNode<SankeyNodeDatum, SankeyLinkDatum>;

/** Fully laid-out link (after sankey computation). */
type LayoutLink = SankeyLink<SankeyNodeDatum, SankeyLinkDatum>;

/** Extracted data from the PBI dataView. */
interface SankeyData {
  nodes: SankeyNodeDatum[];
  links: SankeyLinkDatum[];
}

type LinkColorMode = 'source' | 'target' | 'gradient' | 'custom';

// ── Constants ────────────────────────────────────────────────────

const MARGIN = { top: 8, right: 8, bottom: 8, left: 8 };
const EMPTY_STATE_TEXT =
  'Add Source, Target, and Weight fields to build the Sankey diagram. Optionally add Step 2 and Step 3 for multi-level flows.';

// ── Visual ───────────────────────────────────────────────────────

export class SankeyDiagramVisual implements IVisual {
  private host: IVisualHost;
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private container: HTMLElement;
  private settings: SankeyDiagramSettings;
  private formattingSettingsService: FormattingSettingsService;
  private cancelAnimations: Array<() => void> = [];
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new SankeyDiagramSettings();
    this.formattingSettingsService = new FormattingSettingsService();
    this.container.classList.add('sankey-container');
  }

  public update(options: VisualUpdateOptions): void {
    // Cancel running animations
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];

    // Parse settings from dataView
    const dataView = options.dataViews?.[0];
    if (dataView) {
      this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
        SankeyDiagramSettings,
        dataView
      );
    }

    // Extract data
    const data = this.extractData(dataView);

    // Render
    this.render(data, options.viewport);
  }

  // ── Data Extraction (Multi-Level) ─────────────────────────────

  private extractData(dataView: DataView | undefined): SankeyData | null {
    if (!dataView?.categorical) return null;

    const categorical = dataView.categorical;
    const categories = categorical.categories;
    const values = categorical.values;

    if (!categories || categories.length < 2 || !values || values.length < 1) return null;

    // Discover columns by role
    let sourceColumn: powerbi.DataViewCategoryColumn | undefined;
    let step2Column: powerbi.DataViewCategoryColumn | undefined;
    let step3Column: powerbi.DataViewCategoryColumn | undefined;
    let targetColumn: powerbi.DataViewCategoryColumn | undefined;
    let weightColumn: powerbi.DataViewValueColumn | undefined;

    for (const cat of categories) {
      const roles = cat.source.roles;
      if (!roles) continue;
      if (roles['source']) sourceColumn = cat;
      if (roles['step2']) step2Column = cat;
      if (roles['step3']) step3Column = cat;
      if (roles['target']) targetColumn = cat;
    }

    for (const val of values) {
      const roles = val.source.roles;
      if (!roles) continue;
      if (roles['weight']) weightColumn = val;
    }

    if (!sourceColumn || !targetColumn || !weightColumn) return null;

    const rowCount = sourceColumn.values.length;
    if (rowCount === 0) return null;

    // Build unique node list — suffix names with level to avoid collisions across levels
    const nodeMap = new Map<string, number>();
    const nodes: SankeyNodeDatum[] = [];

    const getOrCreateNode = (name: string, level: number, selectionId: ISelectionId): number => {
      const key = `${level}:${name}`;
      const existing = nodeMap.get(key);
      if (existing !== undefined) return existing;
      const idx = nodes.length;
      nodes.push({ name, index: idx, selectionId });
      nodeMap.set(key, idx);
      return idx;
    };

    // Build links with deduplication
    const linkMap = new Map<string, SankeyLinkDatum>();

    for (let i = 0; i < rowCount; i++) {
      const sourceVal = sourceColumn.values[i];
      const targetVal = targetColumn.values[i];
      const weightVal = weightColumn.values[i];

      // Validate: source, target, and weight must be present; weight must be positive
      if (sourceVal == null || targetVal == null || weightVal == null) continue;
      const weight = typeof weightVal === 'number' ? weightVal : Number(weightVal);
      if (!Number.isFinite(weight) || weight <= 0) continue;

      // Build the chain: [source, step2?, step3?, target]
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

      chain.push({ name: String(targetVal), level: 3 });

      // Create a selection ID for this row
      const rowSelectionId = this.host.createSelectionIdBuilder()
        .withCategory(sourceColumn, i)
        .createSelectionId();

      // Create links for consecutive pairs in the chain
      for (let j = 0; j < chain.length - 1; j++) {
        const src = chain[j];
        const tgt = chain[j + 1];

        // Skip self-loops
        if (src.name === tgt.name) continue;

        const srcIdx = getOrCreateNode(src.name, src.level, rowSelectionId);
        const tgtIdx = getOrCreateNode(tgt.name, tgt.level, rowSelectionId);

        // Deduplicate: sum weights for identical source→target pairs
        const linkKey = `${srcIdx}:${tgtIdx}`;
        const existing = linkMap.get(linkKey);
        if (existing) {
          existing.value += weight;
        } else {
          linkMap.set(linkKey, {
            source: srcIdx,
            target: tgtIdx,
            value: weight,
            selectionId: rowSelectionId,
          });
        }
      }
    }

    if (nodes.length === 0 || linkMap.size === 0) return null;

    return { nodes, links: Array.from(linkMap.values()) };
  }

  // ── Rendering ────────────────────────────────────────────────

  private render(data: SankeyData | null, viewport: powerbi.IViewport): void {
    const dimOpacity = this.settings.linkSettings.dimOpacity.value / 100;
    this.container.removeEventListener('click', this.handleBackgroundClick);
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    renderChartTitle(this.container, this.settings.titleFormattingCard);
    this.svg = null;

    const s = this.settings;

    // Apply glass card style
    if (s.cardSettings.enableGlass.value) {
      const glass = getGlassStyle({
        mode: 'light',
        opacity: s.cardSettings.backgroundOpacity.value / 100,
        backgroundColor: ((s.cardSettings as unknown as Record<string, { value?: { value?: string } }>).backgroundColor)?.value?.value
          ?? ((s.cardSettings as unknown as Record<string, { value?: { value?: string } }>).bgColor)?.value?.value,
        borderRadius: s.cardSettings.borderRadius.value,
      });
      Object.assign(this.container.style, glass);
    }

    // Handle empty/null data
    if (!data) {
      this.renderEmptyState();
      return;
    }

    const baseWidth = viewport.width;
    const baseHeight = viewport.height;
    const baseInnerWidth = baseWidth - MARGIN.left - MARGIN.right;
    const baseInnerHeight = baseHeight - MARGIN.top - MARGIN.bottom;

    if (baseInnerWidth <= 0 || baseInnerHeight <= 0) return;

    // Compute unique node count for scroll density check
    const nodeCount = data.nodes.length;

    // Scroll support — vertical because sankey flows left-to-right and nodes stack vertically
    const scroll = createScrollableChart({
      container: this.container,
      viewportWidth: baseWidth,
      viewportHeight: baseHeight,
      categoryCount: nodeCount,
      scrollSettings: s.scrollFormattingCard,
      availableChartWidth: baseInnerWidth,
      availableChartHeight: baseInnerHeight,
      direction: 'vertical',
    });

    const width = scroll.svgWidth;
    const height = scroll.svgHeight;
    const innerWidth = scroll.chartWidth;
    const innerHeight = scroll.chartHeight;

    // Create SVG inside the scroll wrapper (or container if no scrolling)
    const svg = d3.select(scroll.svgParent)
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    this.svg = svg;

    const g = svg.append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // Resolve layout alignment function
    const alignFn = this.getAlignmentFunction();

    // Build sankey layout
    const sankeyLayout = sankey<SankeyNodeDatum, SankeyLinkDatum>()
      .nodeWidth(s.nodeSettings.width.value)
      .nodePadding(s.nodeSettings.padding.value)
      .nodeAlign(alignFn)
      .iterations(s.layoutSettings.iterations.value)
      .extent([[0, 0], [innerWidth, innerHeight]]);

    // Apply node sort
    const sortOrder = s.layoutSettings.sortOrder.value?.value ?? 'auto';
    if (sortOrder === 'ascending') {
      sankeyLayout.nodeSort((a, b) => (a.value ?? 0) - (b.value ?? 0));
    } else if (sortOrder === 'descending') {
      sankeyLayout.nodeSort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    } else if (sortOrder === 'none') {
      sankeyLayout.nodeSort(null);
    }
    // 'auto' uses the default d3-sankey sort (undefined)

    const graph = sankeyLayout({
      nodes: data.nodes.map((d) => ({ ...d })),
      links: data.links.map((d) => ({ ...d })),
    });

    const layoutNodes = graph.nodes;
    const layoutLinks = graph.links;

    // Compute total weight for percentage calculations
    const totalWeight = data.links.reduce((sum, l) => sum + l.value, 0);

    // Gradient definitions for links
    const defs = svg.append('defs');
    const colorMode = this.getLinkColorMode();

    if (colorMode === 'gradient') {
      layoutLinks.forEach((link, i) => {
        const sourceNode = link.source as LayoutNode;
        const targetNode = link.target as LayoutNode;
        const sourceColor = getHostChartColor(this.host.colorPalette, sourceNode.index ?? 0);
        const targetColor = getHostChartColor(this.host.colorPalette, targetNode.index ?? 0);

        const grad = defs.append('linearGradient')
          .attr('id', `sankey-grad-${i}`)
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

    const linkGroup = g.append('g').attr('class', 'sankey-links');

    const linkPathGenerator = curvature !== 50
      ? this.createCustomLinkPath(curvature)
      : sankeyLinkHorizontal();

    const linkPaths = linkGroup.selectAll<SVGPathElement, LayoutLink>('.sankey-link')
      .data(layoutLinks)
      .join('path')
      .attr('class', 'sankey-link')
      .attr('d', linkPathGenerator as unknown as (d: LayoutLink) => string | null)
      .attr('stroke-width', (d) => Math.max(1, d.width ?? 0))
      .attr('stroke', (d, i) => this.getLinkStroke(d, i, colorMode))
      .attr('stroke-opacity', linkOpacity)
      .style('cursor', 'pointer')
      .on('click', (event: MouseEvent, d) => {
        event.stopPropagation();
        if (d.selectionId) {
          void this.selectionManager.select(d.selectionId, event.ctrlKey || event.metaKey);
        }
      })
      .on('contextmenu', (event: MouseEvent, d) => {
        event.preventDefault();
        event.stopPropagation();
        if (d.selectionId) {
          void this.selectionManager.showContextMenu(d.selectionId, {
            x: event.clientX,
            y: event.clientY,
          });
        }
      });

    // Render nodes
    const nodeGroup = g.append('g').attr('class', 'sankey-nodes');
    const nodeCornerRadius = s.nodeSettings.cornerRadius.value;
    const nodeOpacity = s.nodeSettings.opacity.value / 100;
    const borderColor = s.nodeSettings.nodeBorderColor.value?.value || 'none';
    const borderWidth = s.nodeSettings.nodeBorderWidth.value;
    const nodeMinHeight = s.nodeSettings.minHeight.value;

    const nodeGroups = nodeGroup.selectAll<SVGGElement, LayoutNode>('.sankey-node')
      .data(layoutNodes)
      .join('g')
      .attr('class', 'sankey-node')
      .style('cursor', 'pointer')
      .on('click', (event: MouseEvent, d) => {
        event.stopPropagation();
        if (d.selectionId) {
          void this.selectionManager.select(d.selectionId, event.ctrlKey || event.metaKey);
        }
      })
      .on('contextmenu', (event: MouseEvent, d) => {
        event.preventDefault();
        event.stopPropagation();
        if (d.selectionId) {
          void this.selectionManager.showContextMenu(d.selectionId, {
            x: event.clientX,
            y: event.clientY,
          });
        }
      });

    nodeGroups.append('rect')
      .attr('x', (d) => d.x0 ?? 0)
      .attr('y', (d) => d.y0 ?? 0)
      .attr('width', (d) => (d.x1 ?? 0) - (d.x0 ?? 0))
      .attr('height', (d) => Math.max(nodeMinHeight, (d.y1 ?? 0) - (d.y0 ?? 0)))
      .attr('rx', nodeCornerRadius)
      .attr('ry', nodeCornerRadius)
      .attr('fill', (d) => getHostChartColor(this.host.colorPalette, d.index ?? 0))
      .attr('fill-opacity', nodeOpacity)
      .attr('stroke', borderColor !== 'none' ? borderColor : null)
      .attr('stroke-width', borderWidth > 0 ? borderWidth : null);

    // Node labels
    const labelPos = s.nodeSettings.labelPosition.value?.value ?? 'beside';
    const labelFontSize = s.nodeSettings.labelFontSize.value;
    const labelColor = s.nodeSettings.labelColor.value?.value || undefined;
    const labelFontFamily = s.nodeSettings.labelFontFamily.value?.value ?? 'Segoe UI';
    const labelFontWeight = s.nodeSettings.labelFontWeight.value?.value ?? 'normal';
    const labelFontStyle = s.nodeSettings.labelFontStyle.value?.value ?? 'normal';
    const theme = getTheme('light');

    nodeGroups.append('text')
      .attr('class', 'sankey-node-label')
      .attr('x', (d) => {
        if (labelPos === 'inside' || labelPos === 'above' || labelPos === 'below') {
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
        if (labelPos === 'above') return (d.y0 ?? 0) - 4;
        if (labelPos === 'below') return (d.y1 ?? 0) + labelFontSize + 2;
        return ((d.y0 ?? 0) + (d.y1 ?? 0)) / 2;
      })
      .attr('dy', (labelPos === 'above' || labelPos === 'below') ? '0' : '0.35em')
      .attr('text-anchor', (d) => {
        if (labelPos === 'inside' || labelPos === 'above' || labelPos === 'below') return 'middle';
        const midX = innerWidth / 2;
        const nodeCenter = ((d.x0 ?? 0) + (d.x1 ?? 0)) / 2;
        return nodeCenter < midX ? 'start' : 'end';
      })
      .attr('font-size', labelFontSize)
      .attr('font-family', labelFontFamily)
      .attr('font-weight', labelFontWeight)
      .attr('font-style', labelFontStyle)
      .attr('fill', labelColor ?? theme.text.primary)
      .text((d) => d.name ?? '');

    // Link labels (new)
    if (s.linkLabelSettings.showLinkLabels.value) {
      this.renderLinkLabels(g, layoutLinks, totalWeight);
    }

    // Link tooltips (title elements)
    if (s.tooltipSettings.showTooltips.value) {
      const valueFormat = String(s.tooltipSettings.valueFormat.value?.value ?? 'auto');
      const showPct = s.tooltipSettings.showPercentage.value;

      linkPaths.append('title')
        .text((d) => {
          const src = (d.source as LayoutNode).name ?? '';
          const tgt = (d.target as LayoutNode).name ?? '';
          const val = this.formatTooltipValue(d.value, valueFormat);
          let text = `${src} \u2192 ${tgt}: ${val}`;
          if (showPct && totalWeight > 0) {
            text += ` (${formatPercent(d.value / totalWeight)})`;
          }
          return text;
        });

      // Node tooltips
      nodeGroups.append('title')
        .text((d) => {
          const total = d.value ?? 0;
          const val = this.formatTooltipValue(total, valueFormat);
          let text = `${d.name}: ${val}`;
          if (showPct && totalWeight > 0) {
            text += ` (${formatPercent(total / totalWeight)})`;
          }
          return text;
        });
    }

    // Hover interactions
    this.attachHoverBehavior(nodeGroups, linkPaths, layoutLinks, linkOpacity, hoverOpacity, dimOpacity);

    // Entrance animations
    if (s.animationSettings.enabled.value) {
      this.animateEntrance(nodeGroups, linkPaths, s.animationSettings.duration.value);
    }

    // Apply shared formatting settings
    applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.sankey-node-label');

    this.container.addEventListener('click', this.handleBackgroundClick);
  }

  // ── Link Labels ────────────────────────────────────────────────

  private renderLinkLabels(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    layoutLinks: LayoutLink[],
    totalWeight: number,
  ): void {
    const s = this.settings.linkLabelSettings;
    const fontSize = s.linkLabelFontSize.value;
    const fontColor = s.linkLabelFontColor.value?.value || '#333333';
    const fontWeight = s.linkLabelFontWeight.value?.value ?? 'normal';
    const labelFormat = s.linkLabelFormat.value?.value ?? 'value';

    const labelGroup = g.append('g').attr('class', 'sankey-link-labels');

    labelGroup.selectAll<SVGTextElement, LayoutLink>('.sankey-link-label')
      .data(layoutLinks)
      .join('text')
      .attr('class', 'sankey-link-label')
      .attr('x', (d) => {
        const src = d.source as LayoutNode;
        const tgt = d.target as LayoutNode;
        return ((src.x1 ?? 0) + (tgt.x0 ?? 0)) / 2;
      })
      .attr('y', (d) => {
        return ((d.y0 ?? 0) + (d.y1 ?? 0)) / 2;
      })
      .attr('dy', '0.35em')
      .attr('text-anchor', 'middle')
      .attr('font-size', fontSize)
      .attr('font-weight', fontWeight)
      .attr('fill', fontColor)
      .text((d) => {
        const val = formatNumber(d.value, { abbreviate: true });
        if (labelFormat === 'percent' && totalWeight > 0) {
          return formatPercent(d.value / totalWeight);
        }
        if (labelFormat === 'both' && totalWeight > 0) {
          return `${val} (${formatPercent(d.value / totalWeight)})`;
        }
        return val;
      });
  }

  // ── Empty State ──────────────────────────────────────────────

  private renderEmptyState(): void {
    const empty = document.createElement('div');
    empty.className = 'sankey-empty-state';
    empty.textContent = EMPTY_STATE_TEXT;
    this.container.appendChild(empty);
  }

  // ── Layout Alignment ──────────────────────────────────────────

  private getAlignmentFunction(): (node: SankeyNode<SankeyNodeDatum, SankeyLinkDatum>, n: number) => number {
    const align = this.settings.layoutSettings.nodeAlign.value?.value ?? 'justify';
    type AlignFn = (node: SankeyNode<SankeyNodeDatum, SankeyLinkDatum>, n: number) => number;
    switch (align) {
      case 'left': return sankeyLeft as AlignFn;
      case 'right': return sankeyRight as AlignFn;
      case 'center': return sankeyCenter as AlignFn;
      case 'justify':
      default: return sankeyJustify as AlignFn;
    }
  }

  // ── Link Color Helpers ───────────────────────────────────────

  private getLinkColorMode(): LinkColorMode {
    const raw = this.settings.linkSettings.colorMode.value?.value;
    if (raw === 'source' || raw === 'target' || raw === 'gradient' || raw === 'custom') return raw;
    return 'gradient';
  }

  private getLinkStroke(link: LayoutLink, index: number, mode: LinkColorMode): string {
    switch (mode) {
      case 'source': {
        const sourceNode = link.source as LayoutNode;
        return getHostChartColor(this.host.colorPalette, sourceNode.index ?? 0);
      }
      case 'target': {
        const targetNode = link.target as LayoutNode;
        return getHostChartColor(this.host.colorPalette, targetNode.index ?? 0);
      }
      case 'gradient':
        return `url(#sankey-grad-${index})`;
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
    switch (format) {
      case 'full':
        return formatNumber(value, { abbreviate: false });
      case 'abbreviated':
        return formatNumber(value, { abbreviate: true });
      case 'auto':
      default:
        return formatNumber(value, { abbreviate: value >= 10000 });
    }
  }

  // ── Hover Behavior ───────────────────────────────────────────

  private attachHoverBehavior(
    nodeGroups: d3.Selection<SVGGElement, LayoutNode, SVGGElement, unknown>,
    linkPaths: d3.Selection<SVGPathElement, LayoutLink, SVGGElement, unknown>,
    layoutLinks: LayoutLink[],
    baseOpacity: number,
    hoverOpacity: number,
    dimOpacity: number,
  ): void {
    // Node hover: highlight connected links and nodes, dim everything else
    nodeGroups
      .on('mouseenter', (_event: MouseEvent, hoveredNode: LayoutNode) => {
        const connectedNodeIndices = new Set<number>();
        connectedNodeIndices.add(hoveredNode.index ?? -1);

        const connectedLinkIndices = new Set<number>();
        layoutLinks.forEach((link, i) => {
          const src = link.source as LayoutNode;
          const tgt = link.target as LayoutNode;
          if (src.index === hoveredNode.index || tgt.index === hoveredNode.index) {
            connectedLinkIndices.add(i);
            connectedNodeIndices.add(src.index ?? -1);
            connectedNodeIndices.add(tgt.index ?? -1);
          }
        });

        nodeGroups.attr('opacity', (d) =>
          connectedNodeIndices.has(d.index ?? -1) ? 1 : dimOpacity
        );

        linkPaths.attr('stroke-opacity', (_d, i) =>
          connectedLinkIndices.has(i) ? hoverOpacity : dimOpacity
        );
      })
      .on('mouseleave', () => {
        nodeGroups.attr('opacity', 1);
        linkPaths.attr('stroke-opacity', baseOpacity);
      });

    // Link hover: highlight the link and its source/target nodes
    linkPaths
      .on('mouseenter', (_event: MouseEvent, hoveredLink: LayoutLink) => {
        const src = hoveredLink.source as LayoutNode;
        const tgt = hoveredLink.target as LayoutNode;
        const connectedIndices = new Set([src.index ?? -1, tgt.index ?? -1]);

        nodeGroups.attr('opacity', (d) =>
          connectedIndices.has(d.index ?? -1) ? 1 : dimOpacity
        );

        linkPaths.attr('stroke-opacity', (d) =>
          d === hoveredLink ? hoverOpacity : dimOpacity
        );
      })
      .on('mouseleave', () => {
        nodeGroups.attr('opacity', 1);
        linkPaths.attr('stroke-opacity', baseOpacity);
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

  private handleBackgroundClick = (): void => {
    void this.selectionManager.clear();
  };

  // ── Lifecycle ────────────────────────────────────────────────

  public destroy(): void {
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];
    this.svg = null;
  }
}
