/**
 * Scatter, Box Plot, Waterfall renderers.
 */
import * as d3 from 'd3';
import {
  popIn, growBar, fallIn, fadeSlideIn, DURATION,
  getChartColor, getTheme, type ColorMode,
} from '@pbi/core';
import type { ScatterPoint, BoxPlotItem, WaterfallItem } from '../mock-data';

const activeAnims = new Map<string, Array<() => void>>();
function cleanup(id: string) { activeAnims.get(id)?.forEach(c => c()); activeAnims.delete(id); }
function track(id: string, c: () => void) { const l = activeAnims.get(id) ?? []; l.push(c); activeAnims.set(id, l); }

// ── Scatter Bubble ──────────────────────────────────────────

export function renderScatter(id: string, data: ScatterPoint[], mode: ColorMode): void {
  cleanup(id);
  const el = document.getElementById(id);
  if (!el) return;
  const theme = getTheme(mode);
  el.innerHTML = '';

  const w = 320, h = 200, pad = { top: 10, right: 10, bottom: 30, left: 35 };
  const svg = d3.select(el).append('svg').attr('width', w).attr('height', h);

  const xExtent = d3.extent(data, d => d.x) as [number, number];
  const yExtent = d3.extent(data, d => d.y) as [number, number];
  const x = d3.scaleLinear().domain([xExtent[0] - 5, xExtent[1] + 5]).range([pad.left, w - pad.right]);
  const y = d3.scaleLinear().domain([yExtent[0] - 5, yExtent[1] + 5]).range([h - pad.bottom, pad.top]);
  const r = d3.scaleSqrt().domain([0, d3.max(data, d => d.size) ?? 1]).range([4, 25]);

  // Axes
  svg.append('g').attr('transform', `translate(0,${h - pad.bottom})`)
    .call(d3.axisBottom(x).ticks(5).tickSize(0)).select('.domain').remove();
  svg.append('g').attr('transform', `translate(${pad.left},0)`)
    .call(d3.axisLeft(y).ticks(4).tickSize(-w + pad.left + pad.right)).select('.domain').remove();
  svg.selectAll('.tick line').attr('stroke', mode === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)');
  svg.selectAll('.tick text').attr('font-size', '9px').attr('fill', theme.text.muted);

  data.forEach((pt, i) => {
    const bubble = svg.append('circle')
      .attr('cx', x(pt.x)).attr('cy', y(pt.y)).attr('r', r(pt.size))
      .attr('fill', pt.color ?? getChartColor(i)).attr('opacity', 0.7)
      .attr('stroke', '#fff').attr('stroke-width', 1);

    const node = bubble.node();
    if (node) track(id, popIn(node as unknown as HTMLElement, i * 60, DURATION.normal));

    svg.append('text')
      .attr('x', x(pt.x)).attr('y', y(pt.y) - r(pt.size) - 4)
      .attr('text-anchor', 'middle').attr('font-size', '8px').attr('fill', theme.text.secondary)
      .text(pt.label);
  });
}

// ── Box Plot ────────────────────────────────────────────────

export function renderBoxPlot(id: string, data: BoxPlotItem[], mode: ColorMode): void {
  cleanup(id);
  const el = document.getElementById(id);
  if (!el) return;
  const theme = getTheme(mode);
  el.innerHTML = '';

  const w = 320, h = 200, pad = { top: 10, right: 10, bottom: 30, left: 35 };
  const svg = d3.select(el).append('svg').attr('width', w).attr('height', h);

  const allVals = data.flatMap(d => [d.min, d.max, ...(d.outliers ?? [])]);
  const x = d3.scaleBand().domain(data.map(d => d.label)).range([pad.left, w - pad.right]).padding(0.3);
  const y = d3.scaleLinear().domain([0, Math.max(...allVals) * 1.1]).range([h - pad.bottom, pad.top]);

  svg.append('g').attr('transform', `translate(0,${h - pad.bottom})`)
    .call(d3.axisBottom(x).tickSize(0)).select('.domain').remove();
  svg.selectAll('.tick text').attr('font-size', '9px').attr('fill', theme.text.muted);

  svg.append('g').attr('transform', `translate(${pad.left},0)`)
    .call(d3.axisLeft(y).ticks(4).tickSize(-w + pad.left + pad.right)).select('.domain').remove();
  svg.selectAll('.tick line').attr('stroke', mode === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)');

  data.forEach((item, i) => {
    const cx = (x(item.label) ?? 0) + x.bandwidth() / 2;
    const bw = x.bandwidth();
    const color = getChartColor(i);

    // Whisker line
    svg.append('line').attr('x1', cx).attr('x2', cx)
      .attr('y1', y(item.min)).attr('y2', y(item.max))
      .attr('stroke', color).attr('stroke-width', 1);

    // Box (IQR)
    const box = svg.append('rect')
      .attr('x', (x(item.label) ?? 0)).attr('y', y(item.q3))
      .attr('width', bw).attr('height', y(item.q1) - y(item.q3))
      .attr('fill', color).attr('opacity', 0.3).attr('stroke', color).attr('stroke-width', 1.5)
      .attr('rx', 2);

    const bn = box.node();
    if (bn) track(id, growBar(bn as unknown as HTMLElement, i * 80, DURATION.normal));

    // Median line
    svg.append('line').attr('x1', x(item.label) ?? 0).attr('x2', (x(item.label) ?? 0) + bw)
      .attr('y1', y(item.median)).attr('y2', y(item.median))
      .attr('stroke', color).attr('stroke-width', 2);

    // Whisker caps
    const capW = bw * 0.4;
    svg.append('line').attr('x1', cx - capW / 2).attr('x2', cx + capW / 2)
      .attr('y1', y(item.min)).attr('y2', y(item.min)).attr('stroke', color).attr('stroke-width', 1);
    svg.append('line').attr('x1', cx - capW / 2).attr('x2', cx + capW / 2)
      .attr('y1', y(item.max)).attr('y2', y(item.max)).attr('stroke', color).attr('stroke-width', 1);

    // Outliers
    item.outliers?.forEach(ov => {
      const dot = svg.append('circle').attr('cx', cx).attr('cy', y(ov)).attr('r', 3)
        .attr('fill', 'none').attr('stroke', color).attr('stroke-width', 1.5);
      const dn = dot.node();
      if (dn) track(id, popIn(dn as unknown as HTMLElement, i * 80 + 200, DURATION.fast));
    });
  });
}

// ── Waterfall ───────────────────────────────────────────────

export function renderWaterfall(id: string, data: WaterfallItem[], mode: ColorMode): void {
  cleanup(id);
  const el = document.getElementById(id);
  if (!el) return;
  const theme = getTheme(mode);
  el.innerHTML = '';

  const w = 320, h = 200, pad = { top: 10, right: 10, bottom: 30, left: 35 };
  const svg = d3.select(el).append('svg').attr('width', w).attr('height', h);

  // Compute running totals
  let running = 0;
  const items = data.map(d => {
    if (d.type === 'total') {
      running = d.value;
      return { ...d, start: 0, end: d.value };
    }
    const start = running;
    running += d.value;
    return { ...d, start, end: running };
  });

  const maxVal = Math.max(...items.map(i => Math.max(i.start, i.end))) * 1.1;
  const x = d3.scaleBand().domain(items.map(i => i.label)).range([pad.left, w - pad.right]).padding(0.2);
  const y = d3.scaleLinear().domain([0, maxVal]).range([h - pad.bottom, pad.top]);

  svg.append('g').attr('transform', `translate(0,${h - pad.bottom})`)
    .call(d3.axisBottom(x).tickSize(0)).select('.domain').remove();
  svg.selectAll('.tick text').attr('font-size', '8px').attr('fill', theme.text.muted);

  svg.append('g').attr('transform', `translate(${pad.left},0)`)
    .call(d3.axisLeft(y).ticks(4).tickSize(0)).select('.domain').remove();
  svg.selectAll('.tick text').attr('font-size', '9px').attr('fill', theme.text.muted);

  items.forEach((item, i) => {
    const barX = x(item.label) ?? 0;
    const barW = x.bandwidth();
    const top = Math.min(y(item.start), y(item.end));
    const barH = Math.abs(y(item.start) - y(item.end));

    let color = '#64748B'; // total
    if (item.type === 'increase') color = '#34D399';
    if (item.type === 'decrease') color = '#F87171';

    const bar = svg.append('rect')
      .attr('x', barX).attr('y', top).attr('width', barW).attr('height', barH)
      .attr('fill', color).attr('rx', 2);

    const bn = bar.node();
    if (bn) track(id, fallIn(bn as unknown as HTMLElement, i * 60, DURATION.normal));

    // Connector line to next bar
    if (i < items.length - 1) {
      const nextX = x(items[i + 1].label) ?? 0;
      svg.append('line')
        .attr('x1', barX + barW).attr('x2', nextX)
        .attr('y1', y(item.end)).attr('y2', y(item.end))
        .attr('stroke', mode === 'light' ? '#CBD5E1' : '#475569')
        .attr('stroke-width', 1).attr('stroke-dasharray', '2,2');
    }
  });
}
