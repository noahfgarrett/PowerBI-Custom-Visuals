/**
 * Arc-based visual renderers: Donut, Polar, Ring Stack, Gauge Cluster.
 */
import * as d3 from 'd3';
import {
  sweepArc, countUp, springScale, fadeSlideIn, DURATION,
  getChartColor, getTheme, type ColorMode,
} from '@pbi/core';
import type { CategoryValue, RingData, MiniGauge } from '../mock-data';

const activeAnims = new Map<string, Array<() => void>>();
function cleanup(id: string) { activeAnims.get(id)?.forEach(c => c()); activeAnims.delete(id); }
function track(id: string, c: () => void) { const l = activeAnims.get(id) ?? []; l.push(c); activeAnims.set(id, l); }

// ── Donut ───────────────────────────────────────────────────

export function renderDonut(id: string, data: CategoryValue[], mode: ColorMode): void {
  cleanup(id);
  const el = document.getElementById(id);
  if (!el) return;
  const theme = getTheme(mode);
  el.innerHTML = '';

  const size = 220;
  const svg = d3.select(el).append('svg').attr('width', size).attr('height', size);
  const g = svg.append('g').attr('transform', `translate(${size / 2},${size / 2})`);
  const pie = d3.pie<CategoryValue>().value(d => d.value).sort(null);
  const arc = d3.arc<d3.PieArcDatum<CategoryValue>>().innerRadius(55).outerRadius(90).cornerRadius(3);

  const arcs = g.selectAll('.arc').data(pie(data)).enter().append('path')
    .attr('d', arc)
    .attr('fill', (d, i) => d.data.color ?? getChartColor(i))
    .attr('opacity', 0);

  arcs.each(function (d, i) {
    const node = this as unknown as HTMLElement;
    track(id, sweepArc(d.startAngle, d.endAngle, DURATION.normal, () => {}));
    track(id, fadeSlideIn(node, 'up', DURATION.normal, i * 80));
  });

  // Center label
  const total = data.reduce((s, d) => s + d.value, 0);
  const center = g.append('text').attr('text-anchor', 'middle').attr('dy', '0.35em')
    .attr('font-size', '24px').attr('font-weight', '700').attr('fill', theme.text.primary)
    .text('0');
  track(id, countUp(0, total, DURATION.normal, v => center.text(Math.round(v).toString())));
}

// ── Polar / Nightingale ─────────────────────────────────────

export function renderPolar(id: string, data: CategoryValue[], mode: ColorMode): void {
  cleanup(id);
  const el = document.getElementById(id);
  if (!el) return;
  const theme = getTheme(mode);
  el.innerHTML = '';

  const size = 220;
  const svg = d3.select(el).append('svg').attr('width', size).attr('height', size);
  const g = svg.append('g').attr('transform', `translate(${size / 2},${size / 2})`);

  const maxVal = Math.max(...data.map(d => d.value));
  const angleStep = (2 * Math.PI) / data.length;
  const rScale = d3.scaleLinear().domain([0, maxVal]).range([20, 90]);

  data.forEach((d, i) => {
    const arcGen = d3.arc<unknown>().innerRadius(0)
      .outerRadius(rScale(d.value))
      .startAngle(i * angleStep)
      .endAngle((i + 1) * angleStep - 0.02)
      .cornerRadius(2);

    const petal = g.append('path').attr('d', arcGen({}) as string)
      .attr('fill', getChartColor(i)).attr('opacity', 0.8);

    const node = petal.node();
    if (node) track(id, springScale(node as unknown as HTMLElement, i * 60, DURATION.normal));

    // Label
    const midAngle = i * angleStep + angleStep / 2 - Math.PI / 2;
    const labelR = rScale(d.value) + 12;
    g.append('text')
      .attr('x', labelR * Math.cos(midAngle))
      .attr('y', labelR * Math.sin(midAngle))
      .attr('text-anchor', 'middle').attr('font-size', '9px').attr('fill', theme.text.secondary)
      .text(d.label);
  });
}

// ── Ring Stack ──────────────────────────────────────────────

export function renderRingStack(id: string, data: RingData[], mode: ColorMode): void {
  cleanup(id);
  const el = document.getElementById(id);
  if (!el) return;
  const theme = getTheme(mode);
  el.innerHTML = '';

  const size = 220;
  const svg = d3.select(el).append('svg').attr('width', size).attr('height', size);
  const g = svg.append('g').attr('transform', `translate(${size / 2},${size / 2})`);

  const thickness = 14;
  const gap = 4;

  data.forEach((ring, i) => {
    const outer = 90 - i * (thickness + gap);
    const inner = outer - thickness;
    const pct = Math.min(1, ring.value / ring.max);
    const endAngle = pct * 2 * Math.PI;

    // Background track
    const bgArc = d3.arc<unknown>().innerRadius(inner).outerRadius(outer).startAngle(0).endAngle(2 * Math.PI);
    g.append('path').attr('d', bgArc({}) as string).attr('fill', mode === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)');

    // Value arc
    const valArcGen = d3.arc<unknown>().innerRadius(inner).outerRadius(outer).startAngle(0).cornerRadius(thickness / 2);
    const valPath = g.append('path').attr('fill', ring.color).attr('d', valArcGen.endAngle(0)({}) as string);
    track(id, sweepArc(0, endAngle, DURATION.normal, angle => {
      valPath.attr('d', valArcGen.endAngle(angle)({}) as string);
    }));

    // Percentage label
    const labelAngle = endAngle - Math.PI / 2;
    const labelR = (inner + outer) / 2;
    const lbl = g.append('text')
      .attr('x', labelR * Math.cos(Math.max(0, endAngle) - Math.PI / 2))
      .attr('y', labelR * Math.sin(Math.max(0, endAngle) - Math.PI / 2))
      .attr('text-anchor', 'middle').attr('dy', '0.35em')
      .attr('font-size', '9px').attr('font-weight', '600').attr('fill', theme.text.primary)
      .text(`${Math.round(pct * 100)}%`);
  });
}

// ── Gauge Cluster ───────────────────────────────────────────

export function renderGaugeCluster(id: string, data: MiniGauge[], mode: ColorMode): void {
  cleanup(id);
  const el = document.getElementById(id);
  if (!el) return;
  const theme = getTheme(mode);
  el.innerHTML = '';

  const cols = Math.min(4, data.length);
  const wrapper = document.createElement('div');
  wrapper.style.cssText = `display:grid;grid-template-columns:repeat(${cols},1fr);gap:8px;width:100%;height:100%;align-items:center;justify-items:center;`;

  const gaugeSize = 80;

  data.forEach((g_data, i) => {
    const cell = document.createElement('div');
    cell.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px;';

    const svg = d3.select(cell).append('svg').attr('width', gaugeSize).attr('height', gaugeSize * 0.7);
    const gg = svg.append('g').attr('transform', `translate(${gaugeSize / 2},${gaugeSize * 0.55})`);

    const startAngle = (-3 * Math.PI) / 4;
    const endAngle = (3 * Math.PI) / 4;
    const pct = Math.min(1, g_data.value / g_data.max);
    const targetAngle = startAngle + pct * (endAngle - startAngle);

    // BG
    const bgArc = d3.arc<unknown>().innerRadius(22).outerRadius(30).startAngle(startAngle).endAngle(endAngle).cornerRadius(2);
    gg.append('path').attr('d', bgArc({}) as string).attr('fill', mode === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)');

    // Value arc
    const valArc = d3.arc<unknown>().innerRadius(22).outerRadius(30).startAngle(startAngle).cornerRadius(2);
    const valPath = gg.append('path').attr('fill', g_data.color).attr('d', valArc.endAngle(startAngle)({}) as string);
    track(id, sweepArc(startAngle, targetAngle, DURATION.normal, a => {
      valPath.attr('d', valArc.endAngle(a)({}) as string);
    }));

    // Value text
    const valText = gg.append('text').attr('text-anchor', 'middle').attr('dy', '-0.1em')
      .attr('font-size', '12px').attr('font-weight', '700').attr('fill', theme.text.primary).text('0');
    track(id, countUp(0, g_data.value, DURATION.normal, v => valText.text(Math.round(v).toString())));

    // Label
    const label = document.createElement('div');
    label.style.cssText = `font-size:9px;font-weight:500;color:${theme.text.muted};text-align:center;`;
    label.textContent = g_data.label;
    cell.appendChild(label);

    wrapper.appendChild(cell);
    track(id, fadeSlideIn(cell, 'up', DURATION.fast, i * 80));
  });

  el.appendChild(wrapper);
}
