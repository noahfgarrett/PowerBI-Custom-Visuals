/**
 * Sankey Diagram renderer.
 * D3-sankey layout with gradient links and hover highlighting.
 */

import * as d3 from 'd3';
import {
  sankey as d3Sankey,
  sankeyLinkHorizontal,
  type SankeyNode,
  type SankeyLink,
} from 'd3-sankey';
import {
  formatNumber,
  animate,
  cubicOut,
  fadeSlideIn,
  DURATION,
  getTheme,
  getChartColor,
  withOpacity,
  type ColorMode,
} from '@pbi/core';
import type { SankeyData } from '../mock-data';

const activeAnimations = new Map<string, Array<() => void>>();

function cleanup(containerId: string): void {
  const cancellers = activeAnimations.get(containerId);
  if (cancellers) {
    cancellers.forEach((c) => c());
    activeAnimations.delete(containerId);
  }
}

function track(containerId: string, cancel: () => void): void {
  const list = activeAnimations.get(containerId) ?? [];
  list.push(cancel);
  activeAnimations.set(containerId, list);
}

interface SNode {
  name: string;
}

interface SLink {
  source: string | number;
  target: string | number;
  value: number;
}

export function renderSankey(
  containerId: string,
  data: SankeyData,
  mode: ColorMode
): void {
  cleanup(containerId);

  const container = document.getElementById(containerId);
  if (!container) return;

  const theme = getTheme(mode);
  container.innerHTML = '';

  // Title
  const titleEl = document.createElement('div');
  titleEl.textContent = data.title;
  titleEl.style.cssText = `
    font-size: 12px;
    font-weight: 600;
    color: ${theme.text.primary};
    font-family: ${theme.fontFamily};
    margin-bottom: 8px;
    letter-spacing: -0.01em;
  `;
  container.appendChild(titleEl);

  // Chart container
  const chartDiv = document.createElement('div');
  chartDiv.style.cssText = `flex: 1; min-height: 0;`;
  container.appendChild(chartDiv);

  // ── Data Preparation ────────────────────────────────────

  // Extract unique node names
  const nodeNames = Array.from(
    new Set(data.links.flatMap((l) => [l.source, l.target]))
  );

  const nodes: SNode[] = nodeNames.map((name) => ({ name }));
  const nodeIndex = new Map(nodeNames.map((n, i) => [n, i]));

  const links: SLink[] = data.links.map((l) => ({
    source: nodeIndex.get(l.source) ?? 0,
    target: nodeIndex.get(l.target) ?? 0,
    value: l.value,
  }));

  // ── Layout ──────────────────────────────────────────────

  const margin = { top: 8, right: 8, bottom: 8, left: 8 };
  const rect = chartDiv.getBoundingClientRect();
  const width = Math.max(rect.width || 500, 300);
  const height = Math.max(rect.height || 200, 140);

  const svg = d3
    .select(chartDiv)
    .append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  const g = svg
    .append('g')
    .attr('transform', `translate(${margin.left}, ${margin.top})`);

  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  // D3 sankey layout — use index-based node IDs
  const sankeyLayout = d3Sankey<SNode, SLink>()
    .nodeWidth(14)
    .nodePadding(12)
    .extent([
      [0, 0],
      [innerW, innerH],
    ]);

  const graph = sankeyLayout({
    nodes: nodes.map((d) => ({ ...d })),
    links: links.map((d) => ({ ...d })),
  });

  type ResolvedNode = SankeyNode<SNode, SLink>;
  type ResolvedLink = SankeyLink<SNode, SLink>;

  const resolvedNodes = graph.nodes as ResolvedNode[];
  const resolvedLinks = graph.links as ResolvedLink[];

  // Assign colors to nodes
  const nodeColorMap = new Map<number, string>();
  resolvedNodes.forEach((_node, i) => {
    nodeColorMap.set(i, getChartColor(i));
  });

  // ── Gradient Defs ───────────────────────────────────────

  const defs = svg.append('defs');

  resolvedLinks.forEach((link, i) => {
    const sourceNode = link.source as ResolvedNode;
    const targetNode = link.target as ResolvedNode;
    const sourceIdx = resolvedNodes.indexOf(sourceNode);
    const targetIdx = resolvedNodes.indexOf(targetNode);

    const gradient = defs
      .append('linearGradient')
      .attr('id', `link-grad-${containerId}-${i}`)
      .attr('gradientUnits', 'userSpaceOnUse')
      .attr('x1', sourceNode.x1 ?? 0)
      .attr('y1', 0)
      .attr('x2', targetNode.x0 ?? 0)
      .attr('y2', 0);

    gradient
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', nodeColorMap.get(sourceIdx) ?? '#94A3B8')
      .attr('stop-opacity', 0.5);

    gradient
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', nodeColorMap.get(targetIdx) ?? '#94A3B8')
      .attr('stop-opacity', 0.5);
  });

  // ── Links ───────────────────────────────────────────────

  const linkPath = sankeyLinkHorizontal();

  const linkElements = g
    .append('g')
    .selectAll('path')
    .data(resolvedLinks)
    .join('path')
    .attr('d', linkPath as unknown as string)
    .attr('fill', 'none')
    .attr('stroke', (_, i) => `url(#link-grad-${containerId}-${i})`)
    .attr('stroke-width', (d) => Math.max(1, d.width ?? 1))
    .attr('stroke-opacity', 0)
    .style('cursor', 'pointer');

  // Hover: highlight connected links
  linkElements
    .on('mouseenter', function (_event, d) {
      linkElements.attr('stroke-opacity', (ld) =>
        ld === d ? 0.7 : 0.08
      );
    })
    .on('mouseleave', function () {
      linkElements.attr('stroke-opacity', 0.45);
    });

  // Entrance animation: fade in links with stagger
  (resolvedLinks).forEach((_, i) => {
    const delay = i * 40;
    const tid = setTimeout(() => {
      const cancelAnim = animate(DURATION.normal, cubicOut, (progress) => {
        d3.select(linkElements.nodes()[i]).attr(
          'stroke-opacity',
          0.45 * progress
        );
      });
      track(containerId, cancelAnim);
    }, delay);
    track(containerId, () => clearTimeout(tid));
  });

  // ── Nodes ───────────────────────────────────────────────

  const nodeElements = g
    .append('g')
    .selectAll('rect')
    .data(resolvedNodes)
    .join('rect')
    .attr('x', (d) => d.x0 ?? 0)
    .attr('y', (d) => d.y0 ?? 0)
    .attr('width', (d) => (d.x1 ?? 0) - (d.x0 ?? 0))
    .attr('height', (d) => Math.max(1, (d.y1 ?? 0) - (d.y0 ?? 0)))
    .attr('fill', (_, i) => nodeColorMap.get(i) ?? '#94A3B8')
    .attr('rx', 3)
    .attr('opacity', 0)
    .style('cursor', 'pointer');

  // Hover: highlight node + connected links
  nodeElements
    .on('mouseenter', function (_event, d) {
      nodeElements.attr('opacity', (nd) => (nd === d ? 1 : 0.3));
      linkElements.attr('stroke-opacity', (ld) => {
        const src = ld.source as ResolvedNode;
        const tgt = ld.target as ResolvedNode;
        return src === d || tgt === d ? 0.7 : 0.08;
      });
    })
    .on('mouseleave', function () {
      nodeElements.attr('opacity', 0.9);
      linkElements.attr('stroke-opacity', 0.45);
    });

  // Animate nodes in
  (resolvedNodes).forEach((_, i) => {
    const delay = i * 30;
    const tid = setTimeout(() => {
      const cancelAnim = animate(DURATION.fast, cubicOut, (progress) => {
        d3.select(nodeElements.nodes()[i]).attr('opacity', 0.9 * progress);
      });
      track(containerId, cancelAnim);
    }, delay);
    track(containerId, () => clearTimeout(tid));
  });

  // ── Node Labels ─────────────────────────────────────────

  g.append('g')
    .selectAll('text')
    .data(resolvedNodes)
    .join('text')
    .attr('x', (d) => {
      const x0 = d.x0 ?? 0;
      const x1 = d.x1 ?? 0;
      // Left-side nodes: label on right; right-side nodes: label on left
      return x0 < innerW / 2 ? x1 + 6 : x0 - 6;
    })
    .attr('y', (d) => ((d.y0 ?? 0) + (d.y1 ?? 0)) / 2)
    .attr('dy', '0.35em')
    .attr('text-anchor', (d) => ((d.x0 ?? 0) < innerW / 2 ? 'start' : 'end'))
    .attr('font-size', '10px')
    .attr('font-family', theme.fontFamily)
    .attr('font-weight', 500)
    .attr('fill', theme.text.secondary)
    .text((d) => d.name ?? '');
}
