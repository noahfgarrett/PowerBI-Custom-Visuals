/**
 * KPI Card renderer.
 * Displays a main value with count-up animation, trend arrow, and sparkline.
 */

import * as d3 from 'd3';
import {
  formatNumber,
  formatPercent,
  formatCurrency,
  countUp,
  drawPath,
  fadeSlideIn,
  DURATION,
  getDeltaColor,
  getTheme,
  type ColorMode,
} from '@pbi/core';
import type { KpiData } from '../mock-data';

/** Track active animations per container for cleanup. */
const activeAnimations = new Map<string, Array<() => void>>();

function cleanup(containerId: string): void {
  const cancellers = activeAnimations.get(containerId);
  if (cancellers) {
    cancellers.forEach((cancel) => cancel());
    activeAnimations.delete(containerId);
  }
}

function trackAnimation(containerId: string, cancel: () => void): void {
  const list = activeAnimations.get(containerId) ?? [];
  list.push(cancel);
  activeAnimations.set(containerId, list);
}

export function renderKpiCard(
  containerId: string,
  data: KpiData,
  mode: ColorMode
): void {
  cleanup(containerId);

  const container = document.getElementById(containerId);
  if (!container) return;

  const theme = getTheme(mode);

  // Clear existing content
  container.innerHTML = '';

  // Format function based on data type
  const fmt = (v: number | null | undefined): string => {
    if (data.format === 'currency') return formatCurrency(v);
    if (data.format === 'percent') return formatPercent(v);
    return formatNumber(v, { abbreviate: true });
  };

  // ── Layout ──────────────────────────────────────────────

  const wrapper = document.createElement('div');
  wrapper.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 6px;
    height: 100%;
    justify-content: center;
  `;

  // Label
  const label = document.createElement('div');
  label.textContent = data.label;
  label.style.cssText = `
    font-size: 11px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: ${theme.text.muted};
    font-family: ${theme.fontFamily};
  `;

  // Value row (value + trend arrow)
  const valueRow = document.createElement('div');
  valueRow.style.cssText = `
    display: flex;
    align-items: baseline;
    gap: 8px;
  `;

  const valueEl = document.createElement('div');
  valueEl.style.cssText = `
    font-size: 32px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: ${theme.text.primary};
    font-family: ${theme.fontFamily};
    font-variant-numeric: tabular-nums;
  `;
  valueEl.textContent = fmt(0);

  // Count-up animation
  if (data.value !== null && data.value !== undefined) {
    const cancel = countUp(0, data.value, DURATION.normal, (v) => {
      valueEl.textContent = fmt(v);
    });
    trackAnimation(containerId, cancel);
  } else {
    valueEl.textContent = '--';
  }

  valueRow.appendChild(valueEl);

  // Trend arrow
  if (data.previousValue !== null && data.previousValue !== undefined && data.value !== null) {
    const delta = data.value - data.previousValue;
    const deltaColor = getDeltaColor(delta);
    const arrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '—';

    const trendEl = document.createElement('div');
    trendEl.style.cssText = `
      display: flex;
      align-items: center;
      gap: 3px;
      font-size: 12px;
      font-weight: 600;
      color: ${deltaColor};
      font-family: ${theme.fontFamily};
    `;
    trendEl.innerHTML = `
      <span style="font-size: 10px">${arrow}</span>
      <span>${formatNumber(Math.abs(delta), { abbreviate: false })}</span>
    `;
    valueRow.appendChild(trendEl);
  }

  wrapper.appendChild(label);
  wrapper.appendChild(valueRow);

  // ── Sparkline ───────────────────────────────────────────

  if (data.trend && data.trend.length > 1) {
    const sparkContainer = document.createElement('div');
    sparkContainer.style.cssText = `
      width: 100%;
      height: 32px;
      margin-top: 4px;
    `;

    const svg = d3
      .select(sparkContainer)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 200 32`)
      .attr('preserveAspectRatio', 'none');

    const x = d3
      .scaleLinear()
      .domain([0, data.trend.length - 1])
      .range([0, 200]);

    const yMin = d3.min(data.trend) ?? 0;
    const yMax = d3.max(data.trend) ?? 1;
    const yPad = (yMax - yMin) * 0.15 || 1;

    const y = d3
      .scaleLinear()
      .domain([yMin - yPad, yMax + yPad])
      .range([30, 2]);

    // Area fill
    const area = d3
      .area<number>()
      .x((_, i) => x(i))
      .y0(32)
      .y1((d) => y(d))
      .curve(d3.curveMonotoneX);

    const gradientId = `spark-grad-${containerId}`;
    const defs = svg.append('defs');
    const gradient = defs
      .append('linearGradient')
      .attr('id', gradientId)
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    gradient
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', theme.brand.blue)
      .attr('stop-opacity', 0.45);
    gradient
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', theme.brand.blue)
      .attr('stop-opacity', 0.05);

    svg
      .append('path')
      .datum(data.trend)
      .attr('d', area)
      .attr('fill', `url(#${gradientId})`);

    // Line
    const line = d3
      .line<number>()
      .x((_, i) => x(i))
      .y((d) => y(d))
      .curve(d3.curveMonotoneX);

    const pathEl = svg
      .append('path')
      .datum(data.trend)
      .attr('d', line)
      .attr('fill', 'none')
      .attr('stroke', theme.brand.blue)
      .attr('stroke-width', 2)
      .attr('stroke-linecap', 'round');

    // End dot
    const lastIdx = data.trend.length - 1;
    svg
      .append('circle')
      .attr('cx', x(lastIdx))
      .attr('cy', y(data.trend[lastIdx]))
      .attr('r', 3)
      .attr('fill', theme.brand.blue);

    wrapper.appendChild(sparkContainer);

    // Draw animation on the line path
    requestAnimationFrame(() => {
      const svgPath = pathEl.node();
      if (svgPath) {
        const cancel = drawPath(svgPath, DURATION.slow, 200);
        trackAnimation(containerId, cancel);
      }
    });
  }

  container.appendChild(wrapper);

  // Entrance animation
  const cancel = fadeSlideIn(wrapper, 'up', DURATION.fast, 50);
  trackAnimation(containerId, cancel);
}
