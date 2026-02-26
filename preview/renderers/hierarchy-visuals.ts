/**
 * Hierarchy renderers: Sunburst, Treemap.
 */
import * as d3 from 'd3';
import { hierarchy, partition, treemap as d3treemap, treemapSquarify } from 'd3-hierarchy';
import {
  sweepArc, springScale, fadeSlideIn, DURATION,
  getChartColor, getTheme, type ColorMode,
} from '@pbi/core';
import type { HierarchyNode } from '../mock-data';

const activeAnims = new Map<string, Array<() => void>>();
function cleanup(id: string) { activeAnims.get(id)?.forEach(c => c()); activeAnims.delete(id); }
function track(id: string, c: () => void) { const l = activeAnims.get(id) ?? []; l.push(c); activeAnims.set(id, l); }

// ── Sunburst ────────────────────────────────────────────────

export function renderSunburst(id: string, data: HierarchyNode, mode: ColorMode): void {
  cleanup(id);
  const el = document.getElementById(id);
  if (!el) return;
  const theme = getTheme(mode);
  el.innerHTML = '';

  const size = 240;
  const radius = size / 2;
  const svg = d3.select(el).append('svg').attr('width', size).attr('height', size);
  const g = svg.append('g').attr('transform', `translate(${radius},${radius})`);

  const root = hierarchy(data)
    .sum(d => d.value ?? 0)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  const partitionLayout = partition<HierarchyNode>()
    .size([2 * Math.PI, radius]);

  partitionLayout(root);

  const arc = d3.arc<d3.HierarchyRectangularNode<HierarchyNode>>()
    .startAngle(d => d.x0)
    .endAngle(d => d.x1)
    .innerRadius(d => d.y0 * 0.8)
    .outerRadius(d => d.y1 * 0.8 - 1)
    .cornerRadius(2);

  let colorIdx = 0;
  const colorMap = new Map<string, string>();

  root.descendants().filter(d => d.depth > 0).forEach((d, i) => {
    // Color by parent (depth 1) or inherit from parent
    let color: string;
    if (d.depth === 1) {
      color = d.data.color ?? getChartColor(colorIdx++);
      colorMap.set(d.data.name, color);
    } else {
      const parentName = d.parent?.data.name ?? '';
      color = colorMap.get(parentName) ?? getChartColor(i);
    }

    const opacity = d.depth === 1 ? 0.85 : 0.55;
    const path = g.append('path')
      .attr('d', arc(d as d3.HierarchyRectangularNode<HierarchyNode>) as string)
      .attr('fill', color)
      .attr('opacity', opacity)
      .attr('stroke', mode === 'light' ? '#fff' : '#1E293B')
      .attr('stroke-width', 1);

    const node = path.node();
    if (node) track(id, springScale(node as unknown as HTMLElement, d.depth * 100 + i * 30, DURATION.normal));

    // Labels for depth 1 only
    if (d.depth === 1) {
      const dr = d as d3.HierarchyRectangularNode<HierarchyNode>;
      const midAngle = (dr.x0 + dr.x1) / 2 - Math.PI / 2;
      const labelR = (dr.y0 + dr.y1) / 2 * 0.8;
      g.append('text')
        .attr('x', labelR * Math.cos(midAngle))
        .attr('y', labelR * Math.sin(midAngle))
        .attr('text-anchor', 'middle').attr('dy', '0.35em')
        .attr('font-size', '8px').attr('font-weight', '600').attr('fill', '#fff')
        .text(d.data.name);
    }
  });

  // Center label
  g.append('text').attr('text-anchor', 'middle').attr('dy', '0.35em')
    .attr('font-size', '10px').attr('font-weight', '600').attr('fill', theme.text.primary)
    .text(data.name);
}

// ── Treemap ─────────────────────────────────────────────────

export function renderTreemap(id: string, data: HierarchyNode, mode: ColorMode): void {
  cleanup(id);
  const el = document.getElementById(id);
  if (!el) return;
  const theme = getTheme(mode);
  el.innerHTML = '';

  const w = 320, h = 200;
  const svg = d3.select(el).append('svg').attr('width', w).attr('height', h);

  const root = hierarchy(data)
    .sum(d => d.value ?? 0)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  d3treemap<HierarchyNode>()
    .size([w, h])
    .padding(2)
    .tile(treemapSquarify)
    (root);

  let colorIdx = 0;
  const parentColors = new Map<string, string>();

  root.leaves().forEach((leaf, i) => {
    const parentName = leaf.parent?.data.name ?? '';
    if (!parentColors.has(parentName)) {
      parentColors.set(parentName, leaf.parent?.data.color ?? getChartColor(colorIdx++));
    }
    const color = parentColors.get(parentName) ?? getChartColor(i);
    const node = leaf as d3.HierarchyRectangularNode<HierarchyNode>;

    const rect = svg.append('rect')
      .attr('x', node.x0).attr('y', node.y0)
      .attr('width', node.x1 - node.x0).attr('height', node.y1 - node.y0)
      .attr('fill', color).attr('opacity', 0.75)
      .attr('stroke', mode === 'light' ? '#fff' : '#1E293B').attr('stroke-width', 1)
      .attr('rx', 2);

    const rn = rect.node();
    if (rn) track(id, springScale(rn as unknown as HTMLElement, i * 40, DURATION.fast));

    // Label if cell is big enough
    const cellW = node.x1 - node.x0;
    const cellH = node.y1 - node.y0;
    if (cellW > 40 && cellH > 20) {
      svg.append('text')
        .attr('x', node.x0 + 4).attr('y', node.y0 + 14)
        .attr('font-size', '9px').attr('font-weight', '600').attr('fill', '#fff')
        .text(leaf.data.name);

      if (cellH > 32) {
        svg.append('text')
          .attr('x', node.x0 + 4).attr('y', node.y0 + 26)
          .attr('font-size', '8px').attr('fill', 'rgba(255,255,255,0.7)')
          .text(`${leaf.value}`);
      }
    }
  });
}
