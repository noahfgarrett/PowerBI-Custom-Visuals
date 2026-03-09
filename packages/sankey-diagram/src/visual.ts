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
  ensureScrollStyles,
  applyChartAria,
  applyDataPointAria,
  attachKeyboardNav,
  ensureFocusRingStyles,
  resolveColorTheme,
  buildConditionalConfig,
  resolveConditionalColor,
  resolveDropdown,
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
  'Add Source, Target, and Weight fields to build the Sankey diagram. Optionally add Step 2, Step 3, Step 4, and Step 5 for multi-level flows.';

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

    for (const val of values) {
      const roles = val.source.roles;
      if (!roles) continue;
      if (roles['weight']) weightColumn = val;
    }

    if (!sourceColumn || !targetColumn || !weightColumn) return null;

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
        const srcIdx = getOrCreateNode(src.name, src.level, rowSelectionId);
        const tgtIdx = getOrCreateNode(tgt.name, tgt.level, rowSelectionId);

        // Skip true self-loops (same node), not same-name cross-level nodes
        if (srcIdx === tgtIdx) continue;

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
    const themeName = resolveColorTheme(this.settings.colorThemeFormattingCard);
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

    const scrollEnabled = s.scrollFormattingCard.enableScroll.value;
    const minNodeSize = s.scrollFormattingCard.minCategoryWidth.value;

    // Build a configured sankey layout factory
    const alignFn = this.getAlignmentFunction();
    const sortOrder = s.layoutSettings.sortOrder.value?.value ?? 'auto';

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
        nodes: data.nodes.map((d) => ({ ...d })),
        links: data.links.map((d) => ({ ...d })),
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
    const totalWeight = data.links.reduce((sum, l) => sum + l.value, 0);

    // Gradient definitions for links
    const defs = svg.append('defs');
    const colorMode = this.getLinkColorMode();
    const useGradientLinks = s.sankeyLinkSettings.gradientLinks.value;

    if (colorMode === 'gradient' || useGradientLinks) {
      layoutLinks.forEach((link, i) => {
        const sourceNode = link.source as LayoutNode;
        const targetNode = link.target as LayoutNode;
        const sourceColor = getHostChartColor(this.host.colorPalette, sourceNode.index ?? 0, themeName);
        const targetColor = getHostChartColor(this.host.colorPalette, targetNode.index ?? 0, themeName);

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
    const opacityByValue = s.sankeyLinkSettings.opacityByValue.value;
    const maxLinkValue = Math.max(1, ...layoutLinks.map((l) => l.value));

    // Flow filtering: if a node is filtered, only show connected flows
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
      .attr('d', linkPathGenerator as unknown as (d: LayoutLink) => string | null)
      .attr('stroke-width', (d) => Math.max(1, d.width ?? 0))
      .attr('stroke', (d, i) => this.getLinkStroke(d, i, useGradientLinks ? 'gradient' : colorMode))
      .attr('stroke-opacity', (d) =>
        opacityByValue ? Math.max(0.15, (d.value / maxLinkValue) * linkOpacity) : linkOpacity
      )
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
      .style('cursor', 'pointer')
      .on('click', (event: MouseEvent, d) => {
        event.stopPropagation();
        if (s.sankeyInteractionSettings.enableFiltering.value) {
          // Toggle filtering on this node
          if (this.filteredNodeIndex === (d.index ?? -1)) {
            this.filteredNodeIndex = null;
          } else {
            this.filteredNodeIndex = d.index ?? -1;
          }
          this.render(data, viewport);
          return;
        }
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
      .attr('fill', (d) => getHostChartColor(this.host.colorPalette, d.index ?? 0, themeName))
      .attr('fill-opacity', nodeOpacity)
      .attr('stroke', borderColor !== 'none' ? borderColor : null)
      .attr('stroke-width', borderWidth > 0 ? borderWidth : null);

    // Node labels
    const labelPos = s.nodeSettings.labelPosition.value?.value ?? 'beside';
    const labelsHidden = labelPos === 'none';
    // When 'none', use 'beside' positioning but start hidden (revealed on hover)
    const effectiveLabelPos = labelsHidden ? 'beside' : labelPos;
    const labelFontSize = s.nodeSettings.labelFontSize.value;
    const labelColor = s.nodeSettings.labelColor.value?.value || undefined;
    const labelFontFamily = s.nodeSettings.labelFontFamily.value?.value ?? 'Segoe UI';
    const labelFontWeight = s.nodeSettings.labelFontWeight.value?.value ?? 'normal';
    const labelFontStyle = s.nodeSettings.labelFontStyle.value?.value ?? 'normal';
    const theme = getTheme('light');

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
      .attr('fill', labelColor ?? theme.text.primary)
      .text((d) => d.name ?? '');

    // When labels are hidden, start them invisible with a fade transition
    if (labelsHidden) {
      nodeGroups.selectAll('.sankey-node-label')
        .style('opacity', '0')
        .style('transition', 'opacity 0.2s ease')
        .style('pointer-events', 'none');
    }

    // Node drag repositioning (vertical only)
    if (s.sankeyInteractionSettings.enableDrag.value) {
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

    // Sankey node feature: show node value labels with custom font size
    if (s.sankeyNodeSettings.showNodeValues.value) {
      const nfs = s.sankeyNodeSettings.nodeLabelFontSize.value;
      nodeGroups.each(function (d) {
        const group = d3.select(this);
        const nodeValue = d.value ?? 0;
        const label = group.select<SVGTextElement>('.sankey-node-label');
        if (label.empty()) return;

        group.append('text')
          .attr('class', 'sankey-feature-value')
          .attr('x', label.attr('x'))
          .attr('y', Number(label.attr('y')) + nfs + 2)
          .attr('dy', label.attr('dy'))
          .attr('text-anchor', label.attr('text-anchor'))
          .attr('font-size', nfs)
          .attr('fill', theme.text.secondary)
          .text(formatNumber(nodeValue, { abbreviate: true }));
      });
    }

    // Node value labels (e.g., "Marketing: 1,250")
    if (s.totalSettings.showNodeValues.value) {
      this.renderNodeValues(nodeGroups, totalWeight);
    }

    // Layer column totals
    if (s.totalSettings.showLayerTotals.value) {
      this.renderLayerTotals(g, layoutNodes, innerWidth, innerHeight, totalWeight);
    }

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

    // Flow value labels on hover (show value at link midpoint on hover)
    if (s.sankeyLinkSettings.showFlowLabels.value) {
      const flowLabelGroup = g.append('g').attr('class', 'sankey-flow-labels');
      linkPaths
        .on('mouseenter.flowlabel', (_event: MouseEvent, d: LayoutLink) => {
          const src = d.source as LayoutNode;
          const tgt = d.target as LayoutNode;
          const midX = ((src.x1 ?? 0) + (tgt.x0 ?? 0)) / 2;
          const midY = ((d.y0 ?? 0) + (d.y1 ?? 0)) / 2;
          flowLabelGroup.selectAll('*').remove();
          flowLabelGroup.append('text')
            .attr('x', midX)
            .attr('y', midY)
            .attr('dy', '-0.5em')
            .attr('text-anchor', 'middle')
            .attr('font-size', 11)
            .attr('fill', theme.text.primary)
            .attr('pointer-events', 'none')
            .text(formatNumber(d.value, { abbreviate: true }));
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

    // Apply shared formatting settings
    applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.sankey-node-label');

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
            formatNumber(node.value ?? 0, { abbreviate: true }),
            i,
            visibleNodes.length,
          );
        }
      });
      attachKeyboardNav({
        container: this.container,
        itemSelector: '.sankey-node rect',
        onActivate: (el) => {
          (el as HTMLElement).click();
        },
      });
    }

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
    const valueFormat = ts.nodeValueFormat.value?.value ?? 'value';
    const theme = getTheme('light');

    nodeGroups.each(function (d) {
      const group = d3.select(this);
      const label = group.select<SVGTextElement>('.sankey-node-label');
      if (label.empty()) return;

      const nodeValue = d.value ?? 0;
      let text: string;
      if (valueFormat === 'percent' && totalWeight > 0) {
        text = formatPercent(nodeValue / totalWeight);
      } else if (valueFormat === 'both' && totalWeight > 0) {
        text = `${formatNumber(nodeValue, { abbreviate: true })} (${formatPercent(nodeValue / totalWeight)})`;
      } else {
        text = formatNumber(nodeValue, { abbreviate: true });
      }

      group.append('text')
        .attr('class', 'sankey-node-value')
        .attr('x', label.attr('x'))
        .attr('y', Number(label.attr('y')) + fontSize + 2)
        .attr('dy', label.attr('dy'))
        .attr('text-anchor', label.attr('text-anchor'))
        .attr('font-size', fontSize)
        .attr('fill', fontColor || theme.text.secondary)
        .text(text);
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
    const position = ts.layerTotalPosition.value?.value ?? 'top';
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

      const text = formatNumber(layerTotal, { abbreviate: true });

      totalGroup.append('text')
        .attr('class', 'sankey-layer-total')
        .attr('x', x)
        .attr('y', y)
        .attr('text-anchor', 'middle')
        .attr('font-size', fontSize)
        .attr('font-weight', '600')
        .attr('fill', resolvedColor)
        .text(text);
    }
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
    const raw = this.settings.linkSettings.colorMode.value?.value;
    if (raw === 'source' || raw === 'target' || raw === 'gradient' || raw === 'custom') return raw;
    return 'gradient';
  }

  private getLinkStroke(link: LayoutLink, index: number, mode: LinkColorMode): string {
    const themeName = resolveColorTheme(this.settings.colorThemeFormattingCard);
    switch (mode) {
      case 'source': {
        const sourceNode = link.source as LayoutNode;
        return getHostChartColor(this.host.colorPalette, sourceNode.index ?? 0, themeName);
      }
      case 'target': {
        const targetNode = link.target as LayoutNode;
        return getHostChartColor(this.host.colorPalette, targetNode.index ?? 0, themeName);
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

  private handleBackgroundClick = (): void => {
    if (this.filteredNodeIndex != null) {
      this.filteredNodeIndex = null;
    }
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
