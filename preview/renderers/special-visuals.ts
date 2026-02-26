/**
 * Special visual renderers: Heatmap Calendar, Radar, Status Indicator, Timeline, Gantt.
 */
import * as d3 from 'd3';
import {
  rippleFill, drawPath, popIn, pulseGlow, growBar, fadeSlideIn, DURATION,
  getChartColor, getTheme, type ColorMode,
} from '@pbi/core';
import type { CalendarDay, RadarSeriesData, StatusItem, MilestoneItem, GanttTask } from '../mock-data';

const activeAnims = new Map<string, Array<() => void>>();
function cleanup(id: string) { activeAnims.get(id)?.forEach(c => c()); activeAnims.delete(id); }
function track(id: string, c: () => void) { const l = activeAnims.get(id) ?? []; l.push(c); activeAnims.set(id, l); }

// ── Heatmap Calendar ────────────────────────────────────────

export function renderHeatmap(id: string, data: CalendarDay[], mode: ColorMode): void {
  cleanup(id);
  const el = document.getElementById(id);
  if (!el) return;
  const theme = getTheme(mode);
  el.innerHTML = '';

  const cellSize = 12, gap = 2;
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px;';

  const maxVal = Math.max(...data.map(d => d.value), 1);
  const colorScale = d3.scaleLinear<string>().domain([0, maxVal]).range(['#E2E8F0', '#3B82F6']);

  // Group by week
  const grid = document.createElement('div');
  grid.style.cssText = `display:grid;grid-template-columns:repeat(13,${cellSize}px);gap:${gap}px;`;

  const allCells: HTMLElement[] = [];
  data.forEach((day) => {
    const cell = document.createElement('div');
    cell.style.cssText = `width:${cellSize}px;height:${cellSize}px;border-radius:2px;background:${colorScale(day.value)};`;
    cell.title = `${day.date}: ${day.value}`;
    grid.appendChild(cell);
    allCells.push(cell);
  });

  wrapper.appendChild(grid);

  const label = document.createElement('div');
  label.style.cssText = `font-size:10px;color:${theme.text.muted};`;
  label.textContent = 'Inspection Activity (last 90 days)';
  wrapper.appendChild(label);

  el.appendChild(wrapper);
  track(id, rippleFill(allCells, 13, DURATION.normal, 15, 'top-left'));
}

// ── Radar Chart ─────────────────────────────────────────────

export function renderRadar(id: string, data: RadarSeriesData, mode: ColorMode): void {
  cleanup(id);
  const el = document.getElementById(id);
  if (!el) return;
  const theme = getTheme(mode);
  el.innerHTML = '';

  const size = 240, cx = size / 2, cy = size / 2, radius = 90;
  const svg = d3.select(el).append('svg').attr('width', size).attr('height', size);
  const g = svg.append('g').attr('transform', `translate(${cx},${cy})`);

  const n = data.axes.length;
  const angleStep = (2 * Math.PI) / n;

  // Grid levels
  [0.25, 0.5, 0.75, 1].forEach(level => {
    const r = radius * level;
    const pts = data.axes.map((_, i) => {
      const a = i * angleStep - Math.PI / 2;
      return `${r * Math.cos(a)},${r * Math.sin(a)}`;
    }).join(' ');
    g.append('polygon').attr('points', pts)
      .attr('fill', 'none').attr('stroke', mode === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)');
  });

  // Axis lines + labels
  data.axes.forEach((axis, i) => {
    const a = i * angleStep - Math.PI / 2;
    g.append('line').attr('x1', 0).attr('y1', 0)
      .attr('x2', radius * Math.cos(a)).attr('y2', radius * Math.sin(a))
      .attr('stroke', mode === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)');

    const labelR = radius + 14;
    g.append('text')
      .attr('x', labelR * Math.cos(a)).attr('y', labelR * Math.sin(a))
      .attr('text-anchor', 'middle').attr('dy', '0.35em')
      .attr('font-size', '9px').attr('fill', theme.text.secondary)
      .text(axis);
  });

  // Series polygons
  data.series.forEach((series, si) => {
    const pts = series.values.map((v, i) => {
      const a = i * angleStep - Math.PI / 2;
      const r = (v / 100) * radius;
      return `${r * Math.cos(a)},${r * Math.sin(a)}`;
    }).join(' ');

    const polygon = g.append('polygon').attr('points', pts)
      .attr('fill', series.color).attr('fill-opacity', 0.15)
      .attr('stroke', series.color).attr('stroke-width', 2);

    const pn = polygon.node();
    if (pn) track(id, fadeSlideIn(pn as unknown as HTMLElement, 'up', DURATION.normal, si * 100));

    // Dots
    series.values.forEach((v, i) => {
      const a = i * angleStep - Math.PI / 2;
      const r = (v / 100) * radius;
      const dot = g.append('circle')
        .attr('cx', r * Math.cos(a)).attr('cy', r * Math.sin(a))
        .attr('r', 3).attr('fill', series.color);
      const dn = dot.node();
      if (dn) track(id, popIn(dn as unknown as HTMLElement, si * 100 + i * 40, DURATION.fast));
    });
  });
}

// ── Status Indicator ────────────────────────────────────────

export function renderStatus(id: string, data: StatusItem[], mode: ColorMode): void {
  cleanup(id);
  const el = document.getElementById(id);
  if (!el) return;
  const theme = getTheme(mode);
  el.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'display:flex;flex-direction:column;gap:8px;padding:8px;';

  data.forEach((item, i) => {
    let status: 'good' | 'warning' | 'critical' = 'good';
    if (item.value < item.critThreshold) status = 'critical';
    else if (item.value < item.warnThreshold) status = 'warning';

    const colors = { good: '#34D399', warning: '#FBBF24', critical: '#EF4444' };
    const color = colors[status];

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:4px 8px;border-radius:6px;';

    const dot = document.createElement('div');
    dot.style.cssText = `width:14px;height:14px;border-radius:50%;background:${color};flex-shrink:0;`;
    if (status === 'critical') track(id, pulseGlow(dot, color));

    const label = document.createElement('div');
    label.style.cssText = `font-size:11px;font-weight:500;color:${theme.text.primary};`;
    label.textContent = item.label;

    const val = document.createElement('div');
    val.style.cssText = `font-size:11px;color:${theme.text.muted};margin-left:auto;`;
    val.textContent = item.value.toFixed(1);

    row.appendChild(dot);
    row.appendChild(label);
    row.appendChild(val);
    wrapper.appendChild(row);
    track(id, fadeSlideIn(row, 'up', DURATION.fast, i * 60));
  });

  el.appendChild(wrapper);
}

// ── Timeline / Milestone ────────────────────────────────────

export function renderTimeline(id: string, data: MilestoneItem[], mode: ColorMode): void {
  cleanup(id);
  const el = document.getElementById(id);
  if (!el) return;
  const theme = getTheme(mode);
  el.innerHTML = '';

  const w = 500, h = 160;
  const svg = d3.select(el).append('svg').attr('width', w).attr('height', h);
  const pad = 40;
  const cy = h / 2;

  // Spine
  svg.append('line').attr('x1', pad).attr('y1', cy).attr('x2', w - pad).attr('y2', cy)
    .attr('stroke', mode === 'light' ? '#CBD5E1' : '#475569').attr('stroke-width', 2);

  const catColors = new Map<string, string>();
  let colorIdx = 0;

  const n = data.length;
  const step = n > 1 ? (w - 2 * pad) / (n - 1) : 0;

  data.forEach((ms, i) => {
    const cx = n > 1 ? pad + i * step : w / 2;
    const isAbove = i % 2 === 0;

    if (ms.category && !catColors.has(ms.category)) {
      catColors.set(ms.category, getChartColor(colorIdx++));
    }
    const color = ms.category ? (catColors.get(ms.category) ?? '#3B82F6') : '#3B82F6';

    // Connector
    const connLen = 30;
    const y2 = isAbove ? cy - connLen : cy + connLen;
    svg.append('line').attr('x1', cx).attr('y1', cy).attr('x2', cx).attr('y2', y2)
      .attr('stroke', mode === 'light' ? '#CBD5E1' : '#475569').attr('stroke-width', 1).attr('stroke-dasharray', '2,2');

    // Marker
    const marker = svg.append('circle').attr('cx', cx).attr('cy', cy).attr('r', 6)
      .attr('fill', color).attr('stroke', '#fff').attr('stroke-width', 2);
    const mn = marker.node();
    if (mn) track(id, popIn(mn as unknown as HTMLElement, i * 80, DURATION.fast));

    // Label
    const labelY = isAbove ? y2 - 4 : y2 + 12;
    svg.append('text').attr('x', cx).attr('y', labelY).attr('text-anchor', 'middle')
      .attr('font-size', '9px').attr('font-weight', '600').attr('fill', theme.text.primary)
      .text(ms.label.length > 18 ? ms.label.slice(0, 16) + '...' : ms.label);

    // Date
    const dateY = isAbove ? labelY - 12 : labelY + 12;
    const d = new Date(ms.date);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    svg.append('text').attr('x', cx).attr('y', dateY).attr('text-anchor', 'middle')
      .attr('font-size', '8px').attr('fill', theme.text.muted)
      .text(`${months[d.getMonth()]} ${d.getDate()}`);
  });
}

// ── Gantt Chart ─────────────────────────────────────────────

export function renderGantt(id: string, data: GanttTask[], mode: ColorMode): void {
  cleanup(id);
  const el = document.getElementById(id);
  if (!el) return;
  const theme = getTheme(mode);
  el.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'display:flex;flex-direction:column;gap:4px;padding:8px;width:100%;';

  // Date range
  const starts = data.map(t => new Date(t.start).getTime()).filter(t => !isNaN(t));
  const ends = data.map(t => new Date(t.end).getTime()).filter(t => !isNaN(t));
  const minTime = Math.min(...starts);
  const maxTime = Math.max(...ends);
  const range = maxTime - minTime || 1;

  const catColors = new Map<string, string>();
  let colorIdx = 0;

  data.forEach((task, i) => {
    if (task.category && !catColors.has(task.category)) {
      catColors.set(task.category, getChartColor(colorIdx++));
    }

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;';

    const label = document.createElement('div');
    label.style.cssText = `width:90px;font-size:10px;font-weight:500;color:${theme.text.secondary};text-align:right;flex-shrink:0;`;
    label.textContent = task.name;
    row.appendChild(label);

    const trackEl = document.createElement('div');
    trackEl.style.cssText = 'flex:1;height:18px;position:relative;';

    const startPct = ((new Date(task.start).getTime() - minTime) / range) * 100;
    const endPct = ((new Date(task.end).getTime() - minTime) / range) * 100;
    const barWidth = Math.max(2, endPct - startPct);
    const color = task.category ? (catColors.get(task.category) ?? '#3B82F6') : '#3B82F6';

    const bar = document.createElement('div');
    bar.style.cssText = `position:absolute;left:${startPct}%;width:${barWidth}%;height:100%;background:${color};opacity:0.5;border-radius:3px;`;
    trackEl.appendChild(bar);

    // Progress overlay
    if (task.progress > 0) {
      const prog = document.createElement('div');
      prog.style.cssText = `position:absolute;left:${startPct}%;width:${barWidth * (task.progress / 100)}%;height:100%;background:${color};opacity:0.9;border-radius:3px;`;
      trackEl.appendChild(prog);
    }

    row.appendChild(trackEl);
    wrapper.appendChild(row);
    track(id, growBar(bar, i * 60, DURATION.fast, 'horizontal'));
    track(id, fadeSlideIn(row, 'right', DURATION.fast, i * 40));
  });

  el.appendChild(wrapper);
}
