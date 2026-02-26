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
        backgroundColor: ((s.cardSettings as any).backgroundColor?.value?.value ?? (s.cardSettings as any).bgColor?.value?.value),
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

    // Create link elements
    const linkGroup = g.append('g').attr('class', 'network-links');
    const linkOpacity = s.linkSettings.opacity.value / 100;

    const resolvedLinkColor = s.linkSettings.linkColor.value?.value || '#94A3B8';
    const resolvedLinkWidth = s.linkSettings.linkWidth.value;

    const linkElements = linkGroup.selectAll<SVGLineElement, GraphLink>('.network-link')
      .data(simLinks)
      .join('line')
      .attr('class', 'network-link')
      .attr('stroke', resolvedLinkColor)
      .attr('stroke-opacity', linkOpacity)
      .attr('stroke-width', (d) => Math.max(1, (d.weight / maxWeight) * resolvedLinkWidth * 4));

    if (s.linkSettings.showArrows.value) {
      linkElements.attr('marker-end', 'url(#network-arrowhead)');
    }

    // Create node elements
    const nodeRadius = s.nodeSettings.nodeRadius.value;
    const usePalette = s.colorSettings.useChartPalette.value;
    const nodeGroup = g.append('g').attr('class', 'network-nodes');

    const nodeElements = nodeGroup.selectAll<SVGCircleElement, GraphNode>('.network-node')
      .data(simNodes)
      .join('circle')
      .attr('class', 'network-node')
      .attr('r', nodeRadius)
      .attr('fill', (_d, i) => usePalette
        ? getHostChartColor(this.host.colorPalette, i)
        : getChartColor(i))
      .attr('stroke', s.nodeSettings.nodeBorderColor.value?.value || '#ffffff')
      .attr('stroke-width', s.nodeSettings.nodeBorderWidth.value)
      .style('cursor', 'pointer')
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
        .attr('dx', nodeRadius + LABEL_OFFSET)
        .attr('dy', '0.35em')
        .text((d) => d.id);
    }

    // Set up d3-force simulation
    const simulation = d3.forceSimulation<GraphNode>(simNodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(simLinks)
        .id((d) => d.id)
        .distance(s.forceSettings.linkDistance.value)
      )
      .force('charge', d3.forceManyBody<GraphNode>()
        .strength(s.forceSettings.chargeStrength.value)
      )
      .force('center', d3.forceCenter<GraphNode>(centerX, centerY))
      .force('collide', d3.forceCollide<GraphNode>(nodeRadius + 2));

    this.simulation = simulation;

    // Tick handler: update SVG positions
    simulation.on('tick', () => {
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

      nodeElements
        .attr('cx', (d) => d.x ?? 0)
        .attr('cy', (d) => d.y ?? 0);

      if (labelElements) {
        labelElements
          .attr('x', (d) => d.x ?? 0)
          .attr('y', (d) => d.y ?? 0);
      }
    });

    // Drag behavior
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

    // Entrance animations
    if (s.animationSettings.enabled.value) {
      this.animateEntrance(nodeElements, linkElements, labelElements, s.animationSettings.duration.value);
    }

    // Apply shared formatting settings
    applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.network-label');

    this.container.addEventListener('click', this.handleBackgroundClick);
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
    linkElements: d3.Selection<SVGLineElement, GraphLink, SVGGElement, unknown>,
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
