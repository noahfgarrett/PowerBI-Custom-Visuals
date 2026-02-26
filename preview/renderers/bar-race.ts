/**
 * Bar Race renderer — animated ranking bars with auto-play.
 */
import {
  growBar, fadeSlideIn, countUp, DURATION,
  getChartColor, getTheme, type ColorMode,
} from '@pbi/core';
import type { BarRaceFrame } from '../mock-data';

const activeAnims = new Map<string, Array<() => void>>();
function cleanup(id: string) { activeAnims.get(id)?.forEach(c => c()); activeAnims.delete(id); }
function track(id: string, c: () => void) { const l = activeAnims.get(id) ?? []; l.push(c); activeAnims.set(id, l); }

export function renderBarRace(id: string, frames: BarRaceFrame[], mode: ColorMode): void {
  cleanup(id);
  const el = document.getElementById(id);
  if (!el) return;
  const theme = getTheme(mode);
  el.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'display:flex;flex-direction:column;gap:8px;padding:8px;width:100%;height:100%;';

  // Period label
  const periodLabel = document.createElement('div');
  periodLabel.style.cssText = `font-size:16px;font-weight:700;color:${theme.text.primary};text-align:center;`;
  periodLabel.textContent = frames[0]?.period ?? '';
  wrapper.appendChild(periodLabel);

  // Bars container
  const barsContainer = document.createElement('div');
  barsContainer.style.cssText = 'display:flex;flex-direction:column;gap:6px;flex:1;justify-content:center;';
  wrapper.appendChild(barsContainer);

  // Color map
  const allLabels = [...new Set(frames.flatMap(f => f.items.map(i => i.label)))];
  const colorMap = new Map(allLabels.map((l, i) => [l, getChartColor(i)]));

  let frameIdx = 0;

  function renderFrame(idx: number): void {
    const frame = frames[idx];
    if (!frame) return;

    periodLabel.textContent = frame.period;

    // Sort by value descending
    const sorted = [...frame.items].sort((a, b) => b.value - a.value);
    const maxVal = sorted[0]?.value ?? 1;

    // Clear and rebuild bars
    while (barsContainer.firstChild) barsContainer.removeChild(barsContainer.firstChild);

    sorted.forEach((item, i) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;';

      const label = document.createElement('div');
      label.style.cssText = `width:80px;font-size:10px;font-weight:500;color:${theme.text.secondary};text-align:right;flex-shrink:0;`;
      label.textContent = item.label;
      row.appendChild(label);

      const barTrack = document.createElement('div');
      barTrack.style.cssText = 'flex:1;height:22px;position:relative;';

      const bar = document.createElement('div');
      const pct = (item.value / maxVal) * 100;
      bar.style.cssText = `width:${pct}%;height:100%;background:${colorMap.get(item.label) ?? '#3B82F6'};border-radius:4px;transition:width 0.5s ease;display:flex;align-items:center;justify-content:flex-end;padding-right:6px;`;

      const val = document.createElement('span');
      val.style.cssText = 'font-size:10px;font-weight:600;color:#fff;';
      val.textContent = item.value.toString();
      bar.appendChild(val);

      barTrack.appendChild(bar);
      row.appendChild(barTrack);
      barsContainer.appendChild(row);

      if (idx === 0) {
        track(id, growBar(bar, i * 60, DURATION.fast, 'horizontal'));
        track(id, fadeSlideIn(row, 'right', DURATION.fast, i * 40));
      }
    });
  }

  renderFrame(0);
  el.appendChild(wrapper);

  // Auto-play through frames
  if (frames.length > 1) {
    const interval = setInterval(() => {
      frameIdx = (frameIdx + 1) % frames.length;
      renderFrame(frameIdx);
    }, 1500);

    track(id, () => clearInterval(interval));
  }
}
