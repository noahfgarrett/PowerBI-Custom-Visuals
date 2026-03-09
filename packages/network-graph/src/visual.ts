/**
 * Network Graph — Power BI IVisual implementation.
 * Force-directed network graph using d3-force simulation with spring
 * animations, drag interaction, and glassmorphic styling.
 */

import powerbi from 'powerbi-visuals-api';
import * as d3 from 'd3';
import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel';
import { NetworkGraphSettings } from './settings';
import {
  popIn,
  fadeSlideIn,
  animate,
  cubicOut,
  DURATION,
  getGlassStyle,
  getHostChartColor,
  getChartColor,
  withOpacity,
  renderChartTitle,
  applyDataLabelFormatting,
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

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  group: number;
  selectionId: ISelectionId;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  weight: number;
}

/** Extracted data from the PBI dataView. */
interface NetworkData {
  nodes: GraphNode[];
  links: GraphLink[];
}

// ── Constants ────────────────────────────────────────────────────

const MARGIN = { top: 8, right: 8, bottom: 8, left: 8 };
const EMPTY_STATE_TEXT = 'Add Source and Target fields to build the network graph.';
const LABEL_OFFSET = 4;
const ARROW_SIZE = 8;

// ── Visual ───────────────────────────────────────────────────────

export class NetworkGraphVisual implements IVisual {
  private host: IVisualHost;
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private container: HTMLElement;
  private settings: NetworkGraphSettings;
  private formattingSettingsService: FormattingSettingsService;
  private cancelAnimations: Array<() => void> = [];
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
  private simulation: d3.Simulation<GraphNode, GraphLink> | null = null;

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new NetworkGraphSettings();
    this.formattingSettingsService = new FormattingSettingsService();
    this.container.classList.add('network-container');
  }

  public update(options: VisualUpdateOptions): void {
    // Cancel running animations
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];

    // Stop previous simulation
    if (this.simulation) {
      this.simulation.stop();
      this.simulation = null;
    }

    // Parse settings from dataView
    const dataView = options.dataViews?.[0];
    if (dataView) {
      this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
        NetworkGraphSettings,
        dataView
      );
    }

    this.settings.dataLabelFormattingCard.showDataLabels.visible = false;

    // Conditional visibility: hide link min/max width when widthByWeight is off
    this.settings.networkLinkSettings.minWidth.visible = this.settings.networkLinkSettings.widthByWeight.value;
    this.settings.networkLinkSettings.maxWidth.visible = this.settings.networkLinkSettings.widthByWeight.value;

    // Extract data
    const data = this.extractData(dataView);

    // Render
    this.render(data, options.viewport);
  }

  // ── Data Extraction ──────────────────────────────────────────

  private extractData(dataView: DataView | undefined): NetworkData | null {
    if (!dataView?.categorical) return null;

    const categorical = dataView.categorical;
    const categories = categorical.categories;

    if (!categories || categories.length < 2) return null;

    // Find source and target columns by role
    let sourceColumn: powerbi.DataViewCategoryColumn | undefined;
    let targetColumn: powerbi.DataViewCategoryColumn | undefined;
    let weightColumn: powerbi.DataViewValueColumn | undefined;

    for (const cat of categories) {
      const roles = cat.source.roles;
      if (!roles) continue;
      if (roles['source']) sourceColumn = cat;
      if (roles['target']) targetColumn = cat;
    }

    // Weight is optional
    const values = categorical.values;
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

    // Build unique node list and assign groups
    const nodeMap = new Map<string, number>();
    const nodes: GraphNode[] = [];
    let groupCounter = 0;

    const getOrCreateNode = (name: string, selectionId: ISelectionId): void => {
      if (nodeMap.has(name)) return;
      const group = groupCounter++;
      nodeMap.set(name, group);
      nodes.push({ id: name, group, selectionId });
    };

    // Build links
    const links: GraphLink[] = [];
    for (let i = 0; i < rowCount; i++) {
      const sourceVal = sourceColumn.values[i];
      const targetVal = targetColumn.values[i];

      if (sourceVal == null || targetVal == null) continue;

      const sourceName = String(sourceVal);
      const targetName = String(targetVal);

      // Skip self-loops
      if (sourceName === targetName) continue;

      const sourceSelectionId = this.host.createSelectionIdBuilder()
        .withCategory(sourceColumn, i)
        .createSelectionId();
      const targetSelectionId = this.host.createSelectionIdBuilder()
        .withCategory(targetColumn, i)
        .createSelectionId();

      getOrCreateNode(sourceName, sourceSelectionId);
      getOrCreateNode(targetName, targetSelectionId);

      // Weight defaults to 1 when not provided
      let weight = 1;
      if (weightColumn) {
        const weightVal = weightColumn.values[i];
        if (weightVal != null) {
          const parsed = typeof weightVal === 'number' ? weightVal : Number(weightVal);
          if (Number.isFinite(parsed) && parsed > 0) {
            weight = parsed;
          }
        }
      }

      links.push({ source: sourceName, target: targetName, weight });
    }

    if (nodes.length === 0) return null;

    return { nodes, links };
  }

  // ── Rendering ────────────────────────────────────────────────

  private render(data: NetworkData | null, viewport: powerbi.IViewport): void {
    const themeName = resolveColorTheme(this.settings.colorThemeFormattingCard);
    // Clear previous content
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
        backgroundColor: s.cardSettings.backgroundColor.value?.value,
        borderRadius: s.cardSettings.borderRadius.value,
      });
      this.container.style.background = glass.background;
      this.container.style.backdropFilter = glass.backdropFilter;
      (this.container.style as unknown as Record<string, string>)['WebkitBackdropFilter'] = glass.WebkitBackdropFilter;
      this.container.style.border = glass.border;
      this.container.style.boxShadow = glass.boxShadow;
      this.container.style.borderRadius = glass.borderRadius;
    } else {
      this.container.style.background = '';
      this.container.style.backdropFilter = '';
      (this.container.style as unknown as Record<string, string>)['WebkitBackdropFilter'] = '';
      this.container.style.border = '';
      this.container.style.boxShadow = '';
      this.container.style.borderRadius = '';
    }

    // Handle empty/null data
    if (!data) {
      this.renderEmptyState();
      return;
    }

    // Search input for filtering/highlighting nodes
    if (s.networkInteractionSettings.enableSearch.value) {
      this.renderSearchInput(data);
    }

    const width = viewport.width;
    const height = viewport.height;
    const innerWidth = width - MARGIN.left - MARGIN.right;
    const innerHeight = height - MARGIN.top - MARGIN.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) return;

    // Create SVG
    const svg = d3.select(this.container)
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    this.svg = svg;

    // Arrow marker definition for directed links
    const resolvedArrowColor = s.linkSettings.linkColor.value?.value || '#94A3B8';
    if (s.linkSettings.showArrows.value) {
      const defs = svg.append('defs');
      defs.append('marker')
        .attr('id', 'network-arrowhead')
        .attr('viewBox', `0 0 ${ARROW_SIZE} ${ARROW_SIZE}`)
        .attr('refX', ARROW_SIZE)
        .attr('refY', ARROW_SIZE / 2)
        .attr('markerWidth', ARROW_SIZE)
        .attr('markerHeight', ARROW_SIZE)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', `M0,0 L${ARROW_SIZE},${ARROW_SIZE / 2} L0,${ARROW_SIZE} Z`)
        .attr('fill', resolvedArrowColor);
    }

    const g = svg.append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    const centerX = innerWidth / 2;
    const centerY = innerHeight / 2;

    // Deep-copy nodes and links for simulation (d3 mutates them)
    const simNodes: GraphNode[] = data.nodes.map((n) => ({ ...n }));
    const simLinks: GraphLink[] = data.links.map((l) => ({
      source: l.source,
      target: l.target,
      weight: l.weight,
    }));

    // Compute max weight for link width scaling
    const maxWeight = Math.max(1, ...simLinks.map((l) => l.weight));

    // Compute degree (number of connections) per node for size-by-degree
    const degreeMap = new Map<string, number>();
    for (const link of simLinks) {
      const srcId = typeof link.source === 'string' ? link.source : (link.source as GraphNode).id;
      const tgtId = typeof link.target === 'string' ? link.target : (link.target as GraphNode).id;
      degreeMap.set(srcId, (degreeMap.get(srcId) ?? 0) + 1);
      degreeMap.set(tgtId, (degreeMap.get(tgtId) ?? 0) + 1);
    }
    const maxDegree = Math.max(1, ...Array.from(degreeMap.values()));

    // Cluster detection: simple label propagation
    const clusterMap = new Map<string, number>();
    if (s.networkLayoutSettings.enableClustering.value) {
      // Initialize each node as its own cluster
      simNodes.forEach((n, i) => clusterMap.set(n.id, i));

      // Build adjacency for clustering
      const clusterAdj = new Map<string, string[]>();
      for (const link of simLinks) {
        const srcId = typeof link.source === 'string' ? link.source : (link.source as GraphNode).id;
        const tgtId = typeof link.target === 'string' ? link.target : (link.target as GraphNode).id;
        if (!clusterAdj.has(srcId)) clusterAdj.set(srcId, []);
        if (!clusterAdj.has(tgtId)) clusterAdj.set(tgtId, []);
        clusterAdj.get(srcId)!.push(tgtId);
        clusterAdj.get(tgtId)!.push(srcId);
      }

      // Run label propagation for a few iterations
      for (let iter = 0; iter < 10; iter++) {
        let changed = false;
        for (const node of simNodes) {
          const neighbors = clusterAdj.get(node.id) ?? [];
          if (neighbors.length === 0) continue;
          // Find most common cluster among neighbors
          const freq = new Map<number, number>();
          for (const nbr of neighbors) {
            const c = clusterMap.get(nbr) ?? 0;
            freq.set(c, (freq.get(c) ?? 0) + 1);
          }
          let bestCluster = clusterMap.get(node.id) ?? 0;
          let bestCount = 0;
          for (const [c, count] of freq) {
            if (count > bestCount) {
              bestCount = count;
              bestCluster = c;
            }
          }
          if (bestCluster !== clusterMap.get(node.id)) {
            clusterMap.set(node.id, bestCluster);
            changed = true;
          }
        }
        if (!changed) break;
      }
    }

    // Create link elements
    const linkGroup = g.append('g').attr('class', 'network-links');
    const linkOpacity = s.linkSettings.opacity.value / 100;

    const resolvedLinkColor = s.linkSettings.linkColor.value?.value || '#94A3B8';
    const resolvedLinkWidth = s.linkSettings.linkWidth.value;

    // Link width by weight feature
    const widthByWeight = s.networkLinkSettings.widthByWeight.value;
    const linkMinWidth = s.networkLinkSettings.minWidth.value;
    const linkMaxWidth = s.networkLinkSettings.maxWidth.value;

    const edgeBundling = s.networkLayoutSettings.edgeBundling.value;

    const getLinkWidth = (d: GraphLink): number => {
      if (widthByWeight) {
        const normalized = d.weight / maxWeight;
        return linkMinWidth + normalized * (linkMaxWidth - linkMinWidth);
      }
      return Math.max(1, (d.weight / maxWeight) * resolvedLinkWidth * 4);
    };

    // When edge bundling is enabled, use <path> elements with curved lines;
    // otherwise use straight <line> elements.
    let linkElements: d3.Selection<SVGLineElement, GraphLink, SVGGElement, unknown>;
    let bundledLinkElements: d3.Selection<SVGPathElement, GraphLink, SVGGElement, unknown> | null = null;

    if (edgeBundling) {
      bundledLinkElements = linkGroup.selectAll<SVGPathElement, GraphLink>('.network-link')
        .data(simLinks)
        .join('path')
        .attr('class', 'network-link')
        .attr('data-source', (d) => String(typeof d.source === 'string' ? d.source : (d.source as GraphNode).id))
        .attr('data-target', (d) => String(typeof d.target === 'string' ? d.target : (d.target as GraphNode).id))
        .attr('stroke', resolvedLinkColor)
        .attr('stroke-opacity', linkOpacity)
        .attr('stroke-width', (d) => getLinkWidth(d))
        .attr('fill', 'none')
        .style('transition', 'opacity 0.15s ease');

      if (s.linkSettings.showArrows.value) {
        bundledLinkElements.attr('marker-end', 'url(#network-arrowhead)');
      }

      // Create a dummy line selection for type compatibility (empty)
      linkElements = linkGroup.selectAll<SVGLineElement, GraphLink>('.network-link-dummy')
        .data([] as GraphLink[])
        .join('line');
    } else {
      linkElements = linkGroup.selectAll<SVGLineElement, GraphLink>('.network-link')
        .data(simLinks)
        .join('line')
        .attr('class', 'network-link')
        .attr('data-source', (d) => String(typeof d.source === 'string' ? d.source : (d.source as GraphNode).id))
        .attr('data-target', (d) => String(typeof d.target === 'string' ? d.target : (d.target as GraphNode).id))
        .attr('stroke', resolvedLinkColor)
        .attr('stroke-opacity', linkOpacity)
        .attr('stroke-width', (d) => getLinkWidth(d))
        .style('transition', 'opacity 0.15s ease');

      if (s.linkSettings.showArrows.value) {
        linkElements.attr('marker-end', 'url(#network-arrowhead)');
      }
    }

    // Unified reference for all link elements (for hover/animation/conditional)
    const allLinkElements = edgeBundling ? bundledLinkElements! : linkElements;

    // Apply conditional formatting to links
    allLinkElements.each((d: GraphLink, i: number, elements: ArrayLike<SVGElement>) => {
      const condColor = this.getConditionalColor(d.weight);
      if (condColor) {
        d3.select(elements[i]).attr('stroke', condColor);
      }
    });

    // Create node elements
    const nodeRadius = s.nodeSettings.radius.value;
    const usePalette = s.colorSettings.useChartPalette.value;
    const sizeByDegree = s.networkLayoutSettings.sizeByDegree.value;
    const enableClustering = s.networkLayoutSettings.enableClustering.value;
    const nodeGroup = g.append('g').attr('class', 'network-nodes');

    const getNodeRadius = (d: GraphNode): number => {
      if (sizeByDegree) {
        const degree = degreeMap.get(d.id) ?? 1;
        const minR = nodeRadius * 0.5;
        const maxR = nodeRadius * 2.5;
        return minR + (degree / maxDegree) * (maxR - minR);
      }
      return nodeRadius;
    };

    const getNodeColor = (d: GraphNode, i: number): string => {
      if (enableClustering) {
        const cluster = clusterMap.get(d.id) ?? 0;
        return usePalette
          ? getHostChartColor(this.host.colorPalette, cluster, themeName)
          : getChartColor(cluster, themeName);
      }
      return usePalette
        ? getHostChartColor(this.host.colorPalette, i, themeName)
        : getChartColor(i, themeName);
    };

    const nodeElements = nodeGroup.selectAll<SVGCircleElement, GraphNode>('.network-node')
      .data(simNodes)
      .join('circle')
      .attr('class', 'network-node')
      .attr('data-node', (d) => d.id)
      .attr('r', (d) => getNodeRadius(d))
      .attr('fill', (d, i) => getNodeColor(d, i))
      .attr('stroke', s.nodeSettings.nodeBorderColor.value?.value || '#ffffff')
      .attr('stroke-width', s.nodeSettings.nodeBorderWidth.value)
      .style('cursor', 'pointer')
      .style('transition', 'opacity 0.15s ease')
      .on('click', (event: MouseEvent, d) => {
        event.stopPropagation();
        void this.selectionManager.select(d.selectionId, event.ctrlKey || event.metaKey);
      })
      .on('contextmenu', (event: MouseEvent, d) => {
        event.preventDefault();
        event.stopPropagation();
        void this.selectionManager.showContextMenu(d.selectionId, {
          x: event.clientX,
          y: event.clientY,
        });
      });

    // Node tooltips
    nodeElements.each(function (_d) {
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = _d.id;
      this.appendChild(title);
    });

    // Create label elements
    let labelElements: d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown> | null = null;
    if (s.nodeSettings.showLabels.value) {
      const labelGroup = g.append('g').attr('class', 'network-labels');
      labelElements = labelGroup.selectAll<SVGTextElement, GraphNode>('.network-label')
        .data(simNodes)
        .join('text')
        .attr('class', 'network-label')
        .attr('data-node', (d) => d.id)
        .attr('dx', nodeRadius + LABEL_OFFSET)
        .attr('dy', '0.35em')
        .style('transition', 'opacity 0.15s ease')
        .text((d) => d.id);
    }

    // Set up d3-force simulation
    const simulation = d3.forceSimulation<GraphNode>(simNodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(simLinks)
        .id((d) => d.id)
        .distance(s.forceSettings.linkDistance.value)
        .strength(s.forceSettings.strength.value)
      )
      .force('charge', d3.forceManyBody<GraphNode>()
        .strength(s.forceSettings.chargeStrength.value)
      )
      .force('center', d3.forceCenter<GraphNode>(centerX, centerY));

    // Collision prevention (configurable)
    if (s.networkLayoutSettings.enableCollision.value) {
      simulation.force('collide', d3.forceCollide<GraphNode>((d) => getNodeRadius(d) + 2));
    }

    this.simulation = simulation;

    // Tick handler: update SVG positions
    simulation.on('tick', () => {
      if (edgeBundling && bundledLinkElements) {
        // Edge bundling: route edges through curved paths bending toward center
        bundledLinkElements.attr('d', (d) => {
          const src = d.source as GraphNode;
          const tgt = d.target as GraphNode;
          const sx = src.x ?? 0;
          const sy = src.y ?? 0;
          const tx = tgt.x ?? 0;
          const ty = tgt.y ?? 0;
          // Control point: midpoint between the two nodes pulled toward center
          const mx = (sx + tx) / 2;
          const my = (sy + ty) / 2;
          const bundleFactor = 0.3; // How strongly to pull toward center
          const cx = mx + (centerX - mx) * bundleFactor;
          const cy = my + (centerY - my) * bundleFactor;
          return `M${sx},${sy} Q${cx},${cy} ${tx},${ty}`;
        });
      } else {
        linkElements
          .attr('x1', (d) => {
            const src = d.source as GraphNode;
            return src.x ?? 0;
          })
          .attr('y1', (d) => {
            const src = d.source as GraphNode;
            return src.y ?? 0;
          })
          .attr('x2', (d) => {
            const tgt = d.target as GraphNode;
            return tgt.x ?? 0;
          })
          .attr('y2', (d) => {
            const tgt = d.target as GraphNode;
            return tgt.y ?? 0;
          });
      }

      nodeElements
        .attr('cx', (d) => d.x ?? 0)
        .attr('cy', (d) => d.y ?? 0);

      if (labelElements) {
        labelElements
          .attr('x', (d) => d.x ?? 0)
          .attr('y', (d) => d.y ?? 0);
      }
    });

    // Drag behavior (configurable)
    if (s.networkInteractionSettings.enableDrag.value) {
      const dragBehavior = d3.drag<SVGCircleElement, GraphNode>()
        .on('start', (event: d3.D3DragEvent<SVGCircleElement, GraphNode, GraphNode>, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event: d3.D3DragEvent<SVGCircleElement, GraphNode, GraphNode>, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event: d3.D3DragEvent<SVGCircleElement, GraphNode, GraphNode>, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        });

      nodeElements.call(dragBehavior);
    }

    // ── Zoom & Pan ───────────────────────────────────────────────

    if (s.zoomSettings.enabled.value) {
      const minZoom = s.zoomSettings.minZoom.value;
      const maxZoom = s.zoomSettings.maxZoom.value;

      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([minZoom, maxZoom])
        .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
          g.attr('transform', event.transform.toString());
        });

      svg.call(zoom);

      // Disable default double-click zoom, add custom reset behavior
      svg.on('dblclick.zoom', null);
      svg.on('dblclick', () => {
        svg.transition()
          .duration(300)
          .call(zoom.transform, d3.zoomIdentity);
      });
    }

    // ── Node Hover Highlight/Dim ─────────────────────────────────

    if (!s.networkInteractionSettings.highlightNeighbors.value) {
      // Skip neighbor highlighting when disabled
      // Entrance animations
      if (s.animationSettings.enabled.value) {
        this.animateEntrance(nodeElements, allLinkElements as unknown as d3.Selection<SVGElement, GraphLink, SVGGElement, unknown>, labelElements, s.animationSettings.duration.value);
      }

      // Apply shared formatting settings
      applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.network-label');

      // Accessibility
      if (s.accessibilityFormattingCard.enableKeyboardNav.value) {
        ensureFocusRingStyles();
        applyChartAria(this.container, {
          chartType: 'network-graph',
          dataPointCount: simNodes.length,
        });
        nodeElements.each(function (d, i) {
          applyDataPointAria(
            this,
            d.id,
            String(degreeMap.get(d.id) ?? 0),
            i,
            simNodes.length,
          );
        });
        attachKeyboardNav({
          container: this.container,
          itemSelector: '.network-node',
          onActivate: (el) => {
            (el as HTMLElement).click();
          },
        });
      }

      this.container.addEventListener('click', this.handleBackgroundClick);
      return;
    }

    // Build adjacency set for fast lookup: nodeId -> Set of connected nodeIds
    const adjacency = new Map<string, Set<string>>();
    for (const link of simLinks) {
      const srcId = typeof link.source === 'string' ? link.source : (link.source as GraphNode).id;
      const tgtId = typeof link.target === 'string' ? link.target : (link.target as GraphNode).id;
      if (!adjacency.has(srcId)) adjacency.set(srcId, new Set());
      if (!adjacency.has(tgtId)) adjacency.set(tgtId, new Set());
      adjacency.get(srcId)!.add(tgtId);
      adjacency.get(tgtId)!.add(srcId);
    }

    const svgNode = svg.node();
    if (svgNode) {
      const allNodes = svgNode.querySelectorAll('[data-node]');
      const allLinks = svgNode.querySelectorAll('.network-link');

      allNodes.forEach((el) => {
        el.addEventListener('mouseenter', () => {
          const hoveredId = el.getAttribute('data-node');
          if (!hoveredId) return;
          const neighbors = adjacency.get(hoveredId) ?? new Set<string>();

          // Dim/highlight nodes and labels
          allNodes.forEach((other) => {
            const otherId = other.getAttribute('data-node');
            const isHighlighted = otherId === hoveredId || neighbors.has(otherId ?? '');
            (other as SVGElement).style.opacity = isHighlighted ? '1' : '0.2';
          });

          // Dim/highlight links
          allLinks.forEach((link) => {
            const srcId = link.getAttribute('data-source');
            const tgtId = link.getAttribute('data-target');
            const isConnected = srcId === hoveredId || tgtId === hoveredId;
            (link as SVGElement).style.opacity = isConnected ? '1' : '0.2';
          });
        });

        el.addEventListener('mouseleave', () => {
          allNodes.forEach((other) => {
            (other as SVGElement).style.opacity = '1';
          });
          allLinks.forEach((link) => {
            (link as SVGElement).style.opacity = '1';
          });
        });
      });
    }

    // Entrance animations
    if (s.animationSettings.enabled.value) {
      this.animateEntrance(nodeElements, allLinkElements as unknown as d3.Selection<SVGElement, GraphLink, SVGGElement, unknown>, labelElements, s.animationSettings.duration.value);
    }

    // Apply shared formatting settings
    applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.network-label');

    // Accessibility
    if (s.accessibilityFormattingCard.enableKeyboardNav.value) {
      ensureFocusRingStyles();
      applyChartAria(this.container, {
        chartType: 'network-graph',
        dataPointCount: simNodes.length,
      });
      nodeElements.each(function (d, i) {
        applyDataPointAria(
          this,
          d.id,
          String(degreeMap.get(d.id) ?? 0),
          i,
          simNodes.length,
        );
      });
      attachKeyboardNav({
        container: this.container,
        itemSelector: '.network-node',
        onActivate: (el) => {
          (el as HTMLElement).click();
        },
      });
    }

    this.container.addEventListener('click', this.handleBackgroundClick);
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

  // ── Search Input ────────────────────────────────────────────

  private renderSearchInput(data: NetworkData): void {
    const wrapper = document.createElement('div');
    wrapper.style.padding = '4px 8px';
    wrapper.style.display = 'flex';
    wrapper.style.gap = '4px';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Search nodes...';
    input.style.flex = '1';
    input.style.padding = '4px 8px';
    input.style.border = '1px solid #CBD5E1';
    input.style.borderRadius = '4px';
    input.style.fontSize = '12px';
    input.style.outline = 'none';
    input.style.fontFamily = "'Segoe UI', sans-serif";

    input.addEventListener('input', () => {
      const query = input.value.toLowerCase().trim();
      const svgEl = this.container.querySelector('svg');
      if (!svgEl) return;

      const allNodes = svgEl.querySelectorAll('.network-node');
      const allLabels = svgEl.querySelectorAll('.network-label');
      const allLinks = svgEl.querySelectorAll('.network-link');

      if (query.length === 0) {
        allNodes.forEach((el) => { (el as SVGElement).style.opacity = '1'; });
        allLabels.forEach((el) => { (el as SVGElement).style.opacity = '1'; });
        allLinks.forEach((el) => { (el as SVGElement).style.opacity = '1'; });
        return;
      }

      const matchedIds = new Set<string>();
      for (const node of data.nodes) {
        if (node.id.toLowerCase().includes(query)) {
          matchedIds.add(node.id);
        }
      }

      allNodes.forEach((el) => {
        const nodeId = el.getAttribute('data-node') ?? '';
        (el as SVGElement).style.opacity = matchedIds.has(nodeId) ? '1' : '0.15';
      });

      allLabels.forEach((el) => {
        const nodeId = el.getAttribute('data-node') ?? '';
        (el as SVGElement).style.opacity = matchedIds.has(nodeId) ? '1' : '0.15';
      });

      allLinks.forEach((el) => {
        const srcId = el.getAttribute('data-source') ?? '';
        const tgtId = el.getAttribute('data-target') ?? '';
        const connected = matchedIds.has(srcId) || matchedIds.has(tgtId);
        (el as SVGElement).style.opacity = connected ? '1' : '0.08';
      });
    });

    wrapper.appendChild(input);
    this.container.appendChild(wrapper);
  }

  // ── Empty State ──────────────────────────────────────────────

  private renderEmptyState(): void {
    const empty = document.createElement('div');
    empty.className = 'network-empty';
    empty.textContent = EMPTY_STATE_TEXT;
    this.container.appendChild(empty);
  }

  // ── Entrance Animation ───────────────────────────────────────

  private animateEntrance(
    nodeElements: d3.Selection<SVGCircleElement, GraphNode, SVGGElement, unknown>,
    linkElements: d3.Selection<SVGElement, GraphLink, SVGGElement, unknown>,
    labelElements: d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown> | null,
    duration: number,
  ): void {
    const stagger = DURATION.stagger;

    // Nodes: pop in with stagger
    nodeElements.each((_d, i, elements) => {
      const el = elements[i];
      if (!el) return;
      const cancel = popIn(el, i * stagger, duration);
      this.cancelAnimations.push(cancel);
    });

    // Links: fade in after nodes start appearing
    const linkBaseDelay = (nodeElements.size() * stagger) / 2;

    linkElements.each((_d, i, elements) => {
      const el = elements[i];
      if (!el) return;

      const currentOpacity = el.getAttribute('stroke-opacity') ?? '0.4';
      const targetOpacity = parseFloat(currentOpacity);
      el.setAttribute('stroke-opacity', '0');

      const delay = linkBaseDelay + i * (stagger / 2);
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      let animCancel: (() => void) | null = null;

      timeoutId = setTimeout(() => {
        animCancel = animate(
          duration,
          cubicOut,
          (progress) => {
            el.setAttribute('stroke-opacity', `${targetOpacity * progress}`);
          },
        );
      }, delay);

      this.cancelAnimations.push(() => {
        if (timeoutId !== null) clearTimeout(timeoutId);
        animCancel?.();
        el.setAttribute('stroke-opacity', `${targetOpacity}`);
      });
    });

    // Labels: fade in alongside their nodes
    if (labelElements) {
      labelElements.each((_d, i, elements) => {
        const el = elements[i] as unknown as HTMLElement;
        if (!el) return;
        const cancel = fadeSlideIn(el, 'up', duration, i * stagger);
        this.cancelAnimations.push(cancel);
      });
    }
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

    if (this.simulation) {
      this.simulation.stop();
      this.simulation = null;
    }

    this.svg = null;
  }
}
