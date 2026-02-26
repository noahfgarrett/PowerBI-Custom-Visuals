/**
 * Line/area-based renderers: Area Chart, Stream Graph, Dumbbell, Slope, Bump.
 */
import * as d3 from 'd3';
import {
  drawPath, popIn, fadeSlideIn, DURATION,
  getChartColor, getTheme, type ColorMode,
} from '@pbi/core';
import type { MultiSeriesData, DumbbellItem, BumpSeriesData } from '../mock-data';

const activeAnims = new Map<string, Array<() => void>>();
function cleanup(id: string) { activeAnims.get(id)?.forEach(c => c()); activeAnims.delete(id); }
function track(id: string, c: () => void) { const l = activeAnims.get(id) ?? []; l.push(c); activeAnims.set(id, l); }

// ── Area Chart ──────────────────────────────────────────────

export function renderArea(id: string, data: MultiSeriesData, mode: ColorMode): void {
  cleanup(id);
  const el = document.getElementById(id);
  if (!el) return;
  const theme = getTheme(mode);
  el.innerHTML = '';

  const w = 320, h = 180, pad = { top: 20, right: 10, bottom: 30, left: 35 };
  const svg = d3.select(el).append('svg').attr('width', w).attr('height', h);

  const x = d3.scalePoint().domain(data.categories).range([pad.left, w - pad.right]);
  const maxVal = Math.max(...data.series.flatMap(s => s.values));
  const y = d3.scaleLinear().domain([0, maxVal * 1.1]).range([h - pad.bottom, pad.top]);

  // X axis
  svg.append('g').attr('transform', `translate(0,${h - pad.bottom})`)
    .call(d3.axisBottom(x).tickSize(0)).select('.domain').remove();
  svg.selectAll('.tick text').attr('font-size', '9px').attr('fill', theme.text.muted);

  // Y axis
  svg.append('g').attr('transform', `translate(${pad.left},0)`)
    .call(d3.axisLeft(y).ticks(4).tickSize(-w + pad.left + pad.right)).select('.domain').remove();
  svg.selectAll('.tick line').attr('stroke', mode === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)');
  svg.selectAll('.tick text').attr('font-size', '9px').attr('fill', theme.text.muted);

  data.series.forEach((series, si) => {
    const area = d3.area<number>()
      .x((_, i) => x(data.categories[i]) ?? 0)
      .y0(h - pad.bottom)
      .y1(d => y(d))
      .curve(d3.curveMonotoneX);

    svg.append('path').datum(series.values)
      .attr('d', area).attr('fill', series.color).attr('opacity', 0.2);

    const line = d3.line<number>()
      .x((_, i) => x(data.categories[i]) ?? 0)
      .y(d => y(d))
      .curve(d3.curveMonotoneX);

    const path = svg.append('path').datum(series.values)
      .attr('d', line).attr('fill', 'none').attr('stroke', series.color).attr('stroke-width', 2);

    const node = path.node();
    if (node) track(id, drawPath(node as unknown as SVGPathElement, DURATION.normal, si * 100));

    // Dots
    series.values.forEach((v, i) => {
      const dot = svg.append('circle')
        .attr('cx', x(data.categories[i]) ?? 0).attr('cy', y(v))
        .attr('r', 3).attr('fill', series.color);
      const dn = dot.node();
      if (dn) track(id, popIn(dn as unknown as HTMLElement, si * 100 + i * 40, DURATION.fast));
    });
  });
}

// ── Stream Graph ────────────────────────────────────────────

export function renderStream(id: string, data: MultiSeriesData, mode: ColorMode): void {
  cleanup(id);
  const el = document.getElementById(id);
  if (!el) return;
  const theme = getTheme(mode);
  el.innerHTML = '';

  const w = 320, h = 180, pad = { top: 10, right: 10, bottom: 30, left: 10 };
  const svg = d3.select(el).append('svg').attr('width', w).attr('height', h);

  const x = d3.scalePoint().domain(data.categories).range([pad.left, w - pad.right]);
  const stackData = data.categories.map((_, ci) => {
    const obj: Record<string, number> = {};
    data.series.forEach(s => { obj[s.name] = s.values[ci]; });
    return obj;
  });

  const keys = data.series.map(s => s.name);
  const stack = d3.stack().keys(keys).offset(d3.stackOffsetWiggle);
  const stacked = stack(stackData as Iterable<{ [key: string]: number }>);

  const yMin = d3.min(stacked, s => d3.min(s, d => d[0])) ?? 0;
  const yMax = d3.max(stacked, s => d3.max(s, d => d[1])) ?? 0;
  const y = d3.scaleLinear().domain([yMin, yMax]).range([h - pad.bottom, pad.top]);

  const area = d3.area<[number, number]>()
    .x((_, i) => x(data.categories[i]) ?? 0)
    .y0(d => y(d[0]))
    .y1(d => y(d[1]))
    .curve(d3.curveBasis);

  stacked.forEach((layer, i) => {
    const path = svg.append('path')
      .datum(layer)
      .attr('d', area as unknown as string)
      .attr('fill', data.series[i].color)
      .attr('opacity', 0);

    const node = path.node();
    if (node) track(id, fadeSlideIn(node as unknown as HTMLElement, 'up', DURATION.normal, i * 80));
  });

  // X labels
  svg.append('g').attr('transform', `translate(0,${h - pad.bottom})`)
    .call(d3.axisBottom(x).tickSize(0)).select('.domain').remove();
  svg.selectAll('.tick text').attr('font-size', '9px').attr('fill', theme.text.muted);
}

// ── Dumbbell Chart ──────────────────────────────────────────

export function renderDumbbell(id: string, data: DumbbellItem[], mode: ColorMode): void {
  cleanup(id);
  const el = document.getElementById(id);
  if (!el) return;
  const theme = getTheme(mode);
  el.innerHTML = '';

  const w = 320, h = 180, pad = { top: 10, right: 20, bottom: 10, left: 70 };
  const svg = d3.select(el).append('svg').attr('width', w).attr('height', h);

  const allVals = data.flatMap(d => [d.start, d.end]);
  const x = d3.scaleLinear().domain([Math.min(...allVals) - 5, Math.max(...allVals) + 5]).range([pad.left, w - pad.right]);
  const y = d3.scaleBand().domain(data.map(d => d.label)).range([pad.top, h - pad.bottom]).padding(0.4);

  data.forEach((item, i) => {
    const cy = (y(item.label) ?? 0) + y.bandwidth() / 2;

    // Connecting line
    svg.append('line')
      .attr('x1', x(item.start)).attr('x2', x(item.end))
      .attr('y1', cy).attr('y2', cy)
      .attr('stroke', mode === 'light' ? '#CBD5E1' : '#475569').attr('stroke-width', 2);

    // Start dot
    const startDot = svg.append('circle').attr('cx', x(item.start)).attr('cy', cy).attr('r', 5).attr('fill', '#94A3B8');
    const sn = startDot.node();
    if (sn) track(id, popIn(sn as unknown as HTMLElement, i * 60, DURATION.fast));

    // End dot
    const endColor = item.end > item.start ? '#34D399' : '#F87171';
    const endDot = svg.append('circle').attr('cx', x(item.end)).attr('cy', cy).attr('r', 5).attr('fill', endColor);
    const en = endDot.node();
    if (en) track(id, popIn(en as unknown as HTMLElement, i * 60 + 40, DURATION.fast));

    // Label
    svg.append('text').attr('x', pad.left - 4).attr('y', cy).attr('dy', '0.35em')
      .attr('text-anchor', 'end').attr('font-size', '10px').attr('fill', theme.text.secondary)
      .text(item.label);
  });
}

// ── Slope Chart ─────────────────────────────────────────────

export function renderSlope(id: string, data: DumbbellItem[], mode: ColorMode): void {
  cleanup(id);
  const el = document.getElementById(id);
  if (!el) return;
  const theme = getTheme(mode);
  el.innerHTML = '';

  const w = 280, h = 200, pad = { top: 20, right: 50, bottom: 20, left: 50 };
  const svg = d3.select(el).append('svg').attr('width', w).attr('height', h);

  const allVals = data.flatMap(d => [d.start, d.end]);
  const y = d3.scaleLinear().domain([Math.min(...allVals) - 5, Math.max(...allVals) + 5]).range([h - pad.bottom, pad.top]);

  // Column labels
  svg.append('text').attr('x', pad.left).attr('y', 12).attr('text-anchor', 'middle')
    .attr('font-size', '10px').attr('font-weight', '600').attr('fill', theme.text.muted).text('Before');
  svg.append('text').attr('x', w - pad.right).attr('y', 12).attr('text-anchor', 'middle')
    .attr('font-size', '10px').attr('font-weight', '600').attr('fill', theme.text.muted).text('After');

  data.forEach((item, i) => {
    const color = item.end >= item.start ? '#34D399' : '#F87171';
    const line = svg.append('line')
      .attr('x1', pad.left).attr('y1', y(item.start))
      .attr('x2', w - pad.right).attr('y2', y(item.end))
      .attr('stroke', color).attr('stroke-width', 2).attr('opacity', 0.8);

    // Dots
    svg.append('circle').attr('cx', pad.left).attr('cy', y(item.start)).attr('r', 4).attr('fill', color);
    svg.append('circle').attr('cx', w - pad.right).attr('cy', y(item.end)).attr('r', 4).attr('fill', color);

    // Labels
    svg.append('text').attr('x', pad.left - 6).attr('y', y(item.start)).attr('dy', '0.35em')
      .attr('text-anchor', 'end').attr('font-size', '9px').attr('fill', theme.text.secondary).text(`${item.start}`);
    svg.append('text').attr('x', w - pad.right + 6).attr('y', y(item.end)).attr('dy', '0.35em')
      .attr('text-anchor', 'start').attr('font-size', '9px').attr('fill', theme.text.secondary)
      .text(`${item.end} ${item.label}`);

    const lineNode = line.node();
    if (lineNode) track(id, fadeSlideIn(lineNode as unknown as HTMLElement, 'right', DURATION.normal, i * 80));
  });
}

// ── Bump Chart ──────────────────────────────────────────────

export function renderBump(id: string, data: BumpSeriesData, mode: ColorMode): void {
  cleanup(id);
  const el = document.getElementById(id);
  if (!el) return;
  const theme = getTheme(mode);
  el.innerHTML = '';

  const w = 320, h = 180, pad = { top: 20, right: 60, bottom: 30, left: 30 };
  const svg = d3.select(el).append('svg').attr('width', w).attr('height', h);

  const x = d3.scalePoint().domain(data.periods).range([pad.left, w - pad.right]).padding(0.1);
  const y = d3.scaleLinear().domain([0.5, data.items.length + 0.5]).range([pad.top, h - pad.bottom]);

  // X axis
  svg.append('g').attr('transform', `translate(0,${h - pad.bottom})`)
    .call(d3.axisBottom(x).tickSize(0)).select('.domain').remove();
  svg.selectAll('.tick text').attr('font-size', '9px').attr('fill', theme.text.muted);

  data.items.forEach((item, itemIdx) => {
    const ranks = data.ranks[itemIdx];
    const color = getChartColor(itemIdx);

    const line = d3.line<number>()
      .x((_, i) => x(data.periods[i]) ?? 0)
      .y(d => y(d))
      .curve(d3.curveMonotoneX);

    const path = svg.append('path').datum(ranks)
      .attr('d', line).attr('fill', 'none').attr('stroke', color).attr('stroke-width', 2.5);

    const pn = path.node();
    if (pn) track(id, drawPath(pn as unknown as SVGPathElement, DURATION.normal, itemIdx * 80));

    // Dots + rank numbers
    ranks.forEach((rank, pi) => {
      const cx = x(data.periods[pi]) ?? 0;
      const cy = y(rank);
      const dot = svg.append('circle').attr('cx', cx).attr('cy', cy).attr('r', 8).attr('fill', color);
      svg.append('text').attr('x', cx).attr('y', cy).attr('dy', '0.35em')
        .attr('text-anchor', 'middle').attr('font-size', '8px').attr('font-weight', '700').attr('fill', '#fff')
        .text(rank.toString());

      const dn = dot.node();
      if (dn) track(id, popIn(dn as unknown as HTMLElement, itemIdx * 80 + pi * 40, DURATION.fast));
    });

    // End label
    const lastRank = ranks[ranks.length - 1];
    svg.append('text')
      .attr('x', (x(data.periods[data.periods.length - 1]) ?? 0) + 14)
      .attr('y', y(lastRank)).attr('dy', '0.35em')
      .attr('font-size', '9px').attr('fill', color).attr('font-weight', '500')
      .text(item);
  });
}
