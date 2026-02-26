/**
 * Chord Diagram and Network Graph renderers.
 */
import * as d3 from 'd3';
import { chord as d3chord, ribbon } from 'd3-chord';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force';
import {
  sweepArc, popIn, fadeSlideIn, DURATION,
  getChartColor, getTheme, type ColorMode,
} from '@pbi/core';
import type { ChordLink } from '../mock-data';

const activeAnims = new Map<string, Array<() => void>>();
function cleanup(id: string) { activeAnims.get(id)?.forEach(c => c()); activeAnims.delete(id); }
function track(id: string, c: () => void) { const l = activeAnims.get(id) ?? []; l.push(c); activeAnims.set(id, l); }

// ── Chord Diagram ───────────────────────────────────────────

export function renderChord(id: string, links: ChordLink[], mode: ColorMode): void {
  cleanup(id);
  const el = document.getElementById(id);
  if (!el) return;
  const theme = getTheme(mode);
  el.innerHTML = '';

  // Build matrix from links
  const names = [...new Set(links.flatMap(l => [l.source, l.target]))];
  const n = names.length;
  const nameIndex = new Map(names.map((name, i) => [name, i]));
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0) as number[]);

  links.forEach(l => {
    const si = nameIndex.get(l.source)!;
    const ti = nameIndex.get(l.target)!;
    matrix[si][ti] += l.value;
  });

  const size = 240;
  const outerR = size / 2 - 20;
  const innerR = outerR - 12;

  const svg = d3.select(el).append('svg').attr('width', size).attr('height', size);
  const g = svg.append('g').attr('transform', `translate(${size / 2},${size / 2})`);

  const chordGen = d3chord().padAngle(0.05);
  const chords = chordGen(matrix);

  const ribbonGen = ribbon<d3.Chord, d3.ChordSubgroup>().radius(innerR);

  const arc = d3.arc<d3.ChordGroup>()
    .innerRadius(innerR).outerRadius(outerR);

  // Outer arcs
  chords.groups.forEach((group, i) => {
    const arcPath = g.append('path')
      .attr('d', arc(group) as string)
      .attr('fill', getChartColor(i))
      .attr('stroke', '#fff').attr('stroke-width', 1);

    const an = arcPath.node();
    if (an) track(id, fadeSlideIn(an as unknown as HTMLElement, 'up', DURATION.normal, i * 60));

    // Label
    const midAngle = (group.startAngle + group.endAngle) / 2;
    const labelR = outerR + 10;
    g.append('text')
      .attr('x', labelR * Math.sin(midAngle))
      .attr('y', -labelR * Math.cos(midAngle))
      .attr('text-anchor', 'middle').attr('dy', '0.35em')
      .attr('font-size', '8px').attr('fill', theme.text.secondary)
      .text(names[i]);
  });

  // Ribbons
  chords.forEach((c, i) => {
    const ribbonPath = g.append('path')
      .attr('d', (ribbonGen(c) as unknown as string))
      .attr('fill', getChartColor(c.source.index))
      .attr('opacity', 0.4)
      .attr('stroke', 'none');

    const rn = ribbonPath.node();
    if (rn) track(id, fadeSlideIn(rn as unknown as HTMLElement, 'up', DURATION.normal, 200 + i * 40));
  });
}

// ── Network / Force Graph ───────────────────────────────────

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  value: number;
}

export function renderNetwork(id: string, links: ChordLink[], mode: ColorMode): void {
  cleanup(id);
  const el = document.getElementById(id);
  if (!el) return;
  const theme = getTheme(mode);
  el.innerHTML = '';

  const names = [...new Set(links.flatMap(l => [l.source, l.target]))];
  const nodes: SimNode[] = names.map(name => ({ id: name }));
  const simLinks: SimLink[] = links.map(l => ({
    source: l.source,
    target: l.target,
    value: l.value,
  }));

  const w = 320, h = 220;
  const svg = d3.select(el).append('svg').attr('width', w).attr('height', h);

  const linkEls = svg.append('g').selectAll('line').data(simLinks).enter()
    .append('line')
    .attr('stroke', mode === 'light' ? '#CBD5E1' : '#475569')
    .attr('stroke-width', d => Math.max(1, d.value * 0.5))
    .attr('opacity', 0.6);

  const nodeEls = svg.append('g').selectAll('circle').data(nodes).enter()
    .append('circle')
    .attr('r', 10).attr('fill', (_, i) => getChartColor(i))
    .attr('stroke', '#fff').attr('stroke-width', 2);

  const labelEls = svg.append('g').selectAll('text').data(nodes).enter()
    .append('text')
    .attr('text-anchor', 'middle').attr('dy', '-14px')
    .attr('font-size', '8px').attr('fill', theme.text.secondary)
    .text(d => d.id);

  nodeEls.each(function (_, i) {
    const node = this as unknown as HTMLElement;
    track(id, popIn(node, i * 60, DURATION.fast));
  });

  const sim = forceSimulation(nodes)
    .force('link', forceLink<SimNode, SimLink>(simLinks).id(d => d.id).distance(60))
    .force('charge', forceManyBody().strength(-120))
    .force('center', forceCenter(w / 2, h / 2))
    .force('collide', forceCollide(20));

  sim.on('tick', () => {
    linkEls
      .attr('x1', d => (d.source as SimNode).x ?? 0)
      .attr('y1', d => (d.source as SimNode).y ?? 0)
      .attr('x2', d => (d.target as SimNode).x ?? 0)
      .attr('y2', d => (d.target as SimNode).y ?? 0);

    nodeEls
      .attr('cx', d => d.x ?? 0)
      .attr('cy', d => d.y ?? 0);

    labelEls
      .attr('x', d => d.x ?? 0)
      .attr('y', d => d.y ?? 0);
  });

  // Stop simulation after settling
  const cancelSim = () => { sim.stop(); };
  track(id, cancelSim);
  setTimeout(() => { sim.alpha(0).stop(); }, 3000);
}
