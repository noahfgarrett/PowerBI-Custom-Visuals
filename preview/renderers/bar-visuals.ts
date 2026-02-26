/**
 * Bar-based visual renderers: Progress Bar, Bullet, Funnel, Waffle.
 */
import * as d3 from 'd3';
import {
  growBar, fadeSlideIn, countUp, rippleFill, DURATION,
  getChartColor, getTheme, type ColorMode,
} from '@pbi/core';
import type { ProgressItem, BulletItem, FunnelStage, WaffleData } from '../mock-data';

const activeAnims = new Map<string, Array<() => void>>();
function cleanup(id: string) { activeAnims.get(id)?.forEach(c => c()); activeAnims.delete(id); }
function track(id: string, c: () => void) { const l = activeAnims.get(id) ?? []; l.push(c); activeAnims.set(id, l); }

// ── Progress Bar Stack ──────────────────────────────────────

export function renderProgressBars(id: string, data: ProgressItem[], mode: ColorMode): void {
  cleanup(id);
  const el = document.getElementById(id);
  if (!el) return;
  const theme = getTheme(mode);
  el.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'display:flex;flex-direction:column;gap:12px;padding:8px;width:100%;';

  data.forEach((item, i) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;flex-direction:column;gap:4px;';

    const header = document.createElement('div');
    header.style.cssText = `display:flex;justify-content:space-between;font-size:11px;color:${theme.text.secondary};`;
    const lbl = document.createElement('span');
    lbl.textContent = item.label;
    lbl.style.fontWeight = '500';
    const val = document.createElement('span');
    val.textContent = '0%';
    header.appendChild(lbl);
    header.appendChild(val);
    row.appendChild(header);

    const barTrack = document.createElement('div');
    barTrack.style.cssText = `width:100%;height:10px;background:${mode === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'};border-radius:5px;overflow:hidden;`;

    const barFill = document.createElement('div');
    barFill.style.cssText = `width:${item.value}%;height:100%;background:${item.color ?? getChartColor(i)};border-radius:5px;`;
    barTrack.appendChild(barFill);
    row.appendChild(barTrack);

    wrapper.appendChild(row);
    track(id, growBar(barFill, i * 80, DURATION.normal, 'horizontal'));
    track(id, countUp(0, item.value, DURATION.normal, v => { val.textContent = `${Math.round(v)}%`; }));
    track(id, fadeSlideIn(row, 'right', DURATION.fast, i * 60));
  });

  el.appendChild(wrapper);
}

// ── Bullet Chart ────────────────────────────────────────────

export function renderBullet(id: string, data: BulletItem[], mode: ColorMode): void {
  cleanup(id);
  const el = document.getElementById(id);
  if (!el) return;
  const theme = getTheme(mode);
  el.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'display:flex;flex-direction:column;gap:14px;padding:8px;width:100%;';

  data.forEach((item, i) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;flex-direction:column;gap:4px;';

    const lbl = document.createElement('div');
    lbl.style.cssText = `font-size:11px;font-weight:500;color:${theme.text.secondary};`;
    lbl.textContent = item.label;
    row.appendChild(lbl);

    const maxRange = Math.max(...item.ranges, item.value, item.target);
    const barTrack = document.createElement('div');
    barTrack.style.cssText = `position:relative;width:100%;height:20px;border-radius:3px;overflow:visible;`;

    // Range backgrounds
    const rangeColors = [
      mode === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)',
      mode === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
      mode === 'light' ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)',
    ];
    item.ranges.forEach((r, ri) => {
      const range = document.createElement('div');
      range.style.cssText = `position:absolute;top:0;left:0;height:100%;width:${(r / maxRange) * 100}%;background:${rangeColors[ri]};border-radius:3px;`;
      barTrack.appendChild(range);
    });

    // Value bar
    const valBar = document.createElement('div');
    valBar.style.cssText = `position:absolute;top:4px;left:0;height:12px;width:${(item.value / maxRange) * 100}%;background:${getChartColor(i)};border-radius:2px;`;
    barTrack.appendChild(valBar);

    // Target marker
    const target = document.createElement('div');
    target.style.cssText = `position:absolute;top:-2px;left:${(item.target / maxRange) * 100}%;width:2px;height:24px;background:${theme.text.primary};border-radius:1px;`;
    barTrack.appendChild(target);

    row.appendChild(barTrack);
    wrapper.appendChild(row);
    track(id, growBar(valBar, i * 80, DURATION.normal, 'horizontal'));
    track(id, fadeSlideIn(row, 'right', DURATION.fast, i * 60));
  });

  el.appendChild(wrapper);
}

// ── Funnel ──────────────────────────────────────────────────

export function renderFunnel(id: string, data: FunnelStage[], mode: ColorMode): void {
  cleanup(id);
  const el = document.getElementById(id);
  if (!el) return;
  const theme = getTheme(mode);
  el.innerHTML = '';

  const maxVal = data[0].value;
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px;width:100%;';

  data.forEach((stage, i) => {
    const pct = stage.value / maxVal;
    const row = document.createElement('div');
    row.style.cssText = `display:flex;align-items:center;gap:8px;width:100%;`;

    const bar = document.createElement('div');
    const w = 30 + pct * 70;
    bar.style.cssText = `width:${w}%;height:28px;background:${getChartColor(i)};border-radius:4px;opacity:0.85;margin:0 auto;display:flex;align-items:center;justify-content:center;`;

    const text = document.createElement('span');
    text.style.cssText = `font-size:10px;font-weight:600;color:#fff;`;
    text.textContent = `${stage.label} (${stage.value})`;
    bar.appendChild(text);
    row.appendChild(bar);

    wrapper.appendChild(row);
    track(id, growBar(bar, i * 80, DURATION.normal, 'horizontal'));
    track(id, fadeSlideIn(row, 'up', DURATION.fast, i * 60));
  });

  el.appendChild(wrapper);
}

// ── Waffle Chart ────────────────────────────────────────────

export function renderWaffle(id: string, data: WaffleData, mode: ColorMode): void {
  cleanup(id);
  const el = document.getElementById(id);
  if (!el) return;
  const theme = getTheme(mode);
  el.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;width:100%;height:100%;';

  const rows = 10, cols = 10, gap = 3, cellSize = 14;
  const grid = document.createElement('div');
  grid.style.cssText = `display:grid;grid-template-columns:repeat(${cols},${cellSize}px);gap:${gap}px;`;

  const pct = Math.min(100, Math.max(0, (data.value / data.max) * 100));
  const filledCount = Math.round((pct / 100) * rows * cols);
  const allCells: HTMLElement[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const fillIdx = (rows - 1 - r) * cols + c;
      const filled = fillIdx < filledCount;
      const cell = document.createElement('div');
      cell.style.cssText = `width:${cellSize}px;height:${cellSize}px;border-radius:2px;background:${filled ? '#3B82F6' : (mode === 'light' ? '#E2E8F0' : 'rgba(255,255,255,0.08)')};`;
      grid.appendChild(cell);
      allCells.push(cell);
    }
  }

  wrapper.appendChild(grid);

  const valEl = document.createElement('div');
  valEl.style.cssText = `font-size:20px;font-weight:700;color:${theme.text.primary};`;
  valEl.textContent = '0%';
  wrapper.appendChild(valEl);
  track(id, countUp(0, pct, DURATION.normal, v => { valEl.textContent = `${Math.round(v)}%`; }));

  const lbl = document.createElement('div');
  lbl.style.cssText = `font-size:10px;color:${theme.text.muted};`;
  lbl.textContent = data.label;
  wrapper.appendChild(lbl);

  el.appendChild(wrapper);
  track(id, rippleFill(allCells, cols, DURATION.normal, 20, 'bottom-left'));
}
