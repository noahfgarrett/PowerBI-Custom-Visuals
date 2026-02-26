/**
 * Bar Chart Pro renderer.
 * Supports grouped, stacked, and combo (bar + line) modes.
 */

import * as d3 from 'd3';
import {
  formatNumber,
  animate,
  drawPath,
  cubicOut,
  DURATION,
  getTheme,
  getChartColor,
  withOpacity,
  type ColorMode,
} from '@pbi/core';
import type { BarChartData } from '../mock-data';

export type BarChartMode = 'grouped' | 'stacked' | 'combo';

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

export function renderBarChart(
  containerId: string,
  data: BarChartData,
  mode: BarChartMode,
  colorMode: ColorMode
): void {
  cleanup(containerId);

  const container = document.getElementById(containerId);
  if (!container) return;

  const theme = getTheme(colorMode);
  container.innerHTML = '';

  // ── Layout ──────────────────────────────────────────────

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

  // Legend
  const legendEl = document.createElement('div');
  legendEl.style.cssText = `
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    padding-top: 8px;
    justify-content: center;
  `;
  container.appendChild(legendEl);

  // ── Dimensions ──────────────────────────────────────────

  const margin = { top: 12, right: 40, bottom: 28, left: 40 };
  const rect = chartDiv.getBoundingClientRect();
  const width = Math.max(rect.width || 300, 200);
  const height = Math.max(rect.height || 200, 140);
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

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

  // ── Scales ──────────────────────────────────────────────

  const barSeries = data.series.filter((s) => s.type === 'bar');
  const lineSeries = data.series.filter((s) => s.type === 'line');

  const x0 = d3
    .scaleBand()
    .domain(data.categories)
    .range([0, innerW])
    .padding(0.25);

  // Compute y-domain based on mode
  let yMax: number;
  if (mode === 'stacked') {
    // Stacked: sum of all bar series per category
    yMax = d3.max(data.categories, (_, i) =>
      barSeries.reduce((sum, s) => sum + s.values[i], 0)
    ) ?? 10;
  } else {
    yMax = d3.max(barSeries, (s) => d3.max(s.values) ?? 0) ?? 10;
  }
  yMax *= 1.15; // headroom

  const y = d3.scaleLinear().domain([0, yMax]).range([innerH, 0]).nice();

  // Secondary y-axis for line series (combo or stacked with lines)
  let yLine: d3.ScaleLinear<number, number> | undefined;
  if ((mode === 'combo' || mode === 'stacked') && lineSeries.length > 0) {
    const lineMax =
      (d3.max(lineSeries, (s) => d3.max(s.values) ?? 0) ?? 10) * 1.15;
    yLine = d3.scaleLinear().domain([0, lineMax]).range([innerH, 0]).nice();
  }

  // Sub-band for grouped bars
  const x1 = d3
    .scaleBand()
    .domain(barSeries.map((s) => s.name))
    .range([0, x0.bandwidth()])
    .padding(0.08);

  // ── Axes ────────────────────────────────────────────────

  // X axis
  g.append('g')
    .attr('transform', `translate(0, ${innerH})`)
    .call(d3.axisBottom(x0).tickSize(0))
    .call((axis) => axis.select('.domain').remove())
    .selectAll('text')
    .attr('fill', theme.text.secondary)
    .attr('font-size', '10px')
    .attr('font-family', theme.fontFamily);

  // Y axis left
  g.append('g')
    .call(
      d3
        .axisLeft(y)
        .ticks(5)
        .tickSize(-innerW)
        .tickFormat((d) => formatNumber(d as number, { abbreviate: true, decimals: 0 }))
    )
    .call((axis) => {
      axis.select('.domain').remove();
      axis
        .selectAll('.tick line')
        .attr('stroke', theme.text.muted)
        .attr('stroke-opacity', 0.12)
        .attr('stroke-dasharray', '2,3');
      axis
        .selectAll('.tick text')
        .attr('fill', theme.text.secondary)
        .attr('font-size', '10px')
        .attr('font-family', theme.fontFamily);
    });

  // Y axis right (for line series)
  if (yLine) {
    // Auto-detect if line data looks like percentages (max > 1 and name contains %)
    const looksLikePercent = lineSeries.some(
      (s) => s.name.toLowerCase().includes('%') || s.name.toLowerCase().includes('percent')
    );
    const rightSuffix = looksLikePercent ? '%' : '';

    g.append('g')
      .attr('transform', `translate(${innerW}, 0)`)
      .call(
        d3
          .axisRight(yLine)
          .ticks(5)
          .tickSize(0)
          .tickFormat((d) => formatNumber(d as number, { abbreviate: true, suffix: rightSuffix, decimals: 0 }))
      )
      .call((axis) => {
        axis.select('.domain').remove();
        axis
          .selectAll('.tick text')
          .attr('fill', theme.text.secondary)
          .attr('font-size', '10px')
          .attr('font-family', theme.fontFamily);
      });
  }

  // ── Bars ────────────────────────────────────────────────

  if (mode === 'stacked') {
    // Stacked bars
    let cumulativeByCategory = data.categories.map(() => 0);

    barSeries.forEach((series, seriesIdx) => {
      const color = series.color ?? getChartColor(seriesIdx);

      data.categories.forEach((cat, catIdx) => {
        const barValue = series.values[catIdx];
        const y0Pos = y(cumulativeByCategory[catIdx]);
        const y1Pos = y(cumulativeByCategory[catIdx] + barValue);

        const rect = g
          .append('rect')
          .attr('x', x0(cat) ?? 0)
          .attr('y', y0Pos)
          .attr('width', x0.bandwidth())
          .attr('height', 0)
          .attr('fill', color)
          .attr('rx', seriesIdx === barSeries.length - 1 ? 3 : 0)
          .style('cursor', 'pointer');

        // Hover effect
        rect
          .on('mouseenter', function () {
            d3.select(this).attr('fill', withOpacity(color, 0.85));
          })
          .on('mouseleave', function () {
            d3.select(this).attr('fill', color);
          });

        // Animate bar growth
        const targetHeight = Math.max(0, y0Pos - y1Pos);
        const delay = catIdx * DURATION.stagger;
        const cancelAnim = animate(
          DURATION.normal,
          cubicOut,
          (progress) => {
            rect
              .attr('y', y0Pos - targetHeight * progress)
              .attr('height', targetHeight * progress);
          }
        );

        // Delay the animation
        const timeoutId = setTimeout(() => {
          track(containerId, cancelAnim);
        }, delay);
        track(containerId, () => clearTimeout(timeoutId));

        cumulativeByCategory[catIdx] += barValue;
      });
    });
  } else {
    // Grouped bars (grouped & combo modes)
    barSeries.forEach((series, seriesIdx) => {
      const color = series.color ?? getChartColor(seriesIdx);

      data.categories.forEach((cat, catIdx) => {
        const barValue = series.values[catIdx];
        const barX = (x0(cat) ?? 0) + (x1(series.name) ?? 0);
        const barY = y(barValue);
        const barH = innerH - barY;

        const rect = g
          .append('rect')
          .attr('x', barX)
          .attr('y', innerH)
          .attr('width', x1.bandwidth())
          .attr('height', 0)
          .attr('fill', color)
          .attr('rx', 3)
          .attr('ry', 3)
          .style('cursor', 'pointer');

        rect
          .on('mouseenter', function () {
            d3.select(this).attr('fill', withOpacity(color, 0.8));
          })
          .on('mouseleave', function () {
            d3.select(this).attr('fill', color);
          });

        // Staggered entrance animation
        const delay = catIdx * DURATION.stagger + seriesIdx * 25;
        const tid = setTimeout(() => {
          const cancelAnim = animate(DURATION.normal, cubicOut, (progress) => {
            rect
              .attr('y', innerH - barH * progress)
              .attr('height', barH * progress);
          });
          track(containerId, cancelAnim);
        }, delay);
        track(containerId, () => clearTimeout(tid));
      });
    });
  }

  // ── Lines (combo mode) ─────────────────────────────────

  if ((mode === 'combo' || mode === 'stacked') && lineSeries.length > 0) {
    const lineScale = yLine ?? y;

    lineSeries.forEach((series, seriesIdx) => {
      const color = series.color ?? getChartColor(barSeries.length + seriesIdx);

      const lineGen = d3
        .line<number>()
        .x((_, i) => (x0(data.categories[i]) ?? 0) + x0.bandwidth() / 2)
        .y((d) => lineScale(d))
        .curve(d3.curveMonotoneX);

      const path = g
        .append('path')
        .datum(series.values)
        .attr('d', lineGen)
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', 2.5)
        .attr('stroke-linecap', 'round');

      // Dots
      series.values.forEach((val, i) => {
        g.append('circle')
          .attr('cx', (x0(data.categories[i]) ?? 0) + x0.bandwidth() / 2)
          .attr('cy', lineScale(val))
          .attr('r', 3.5)
          .attr('fill', '#fff')
          .attr('stroke', color)
          .attr('stroke-width', 2);
      });

      // Draw animation
      requestAnimationFrame(() => {
        const pathNode = path.node();
        if (pathNode) {
          const cancel = drawPath(pathNode, DURATION.slow, 300);
          track(containerId, cancel);
        }
      });
    });
  }

  // ── Reference Line ──────────────────────────────────────

  if (data.referenceLine) {
    const refY = y(data.referenceLine.value);

    g.append('line')
      .attr('x1', 0)
      .attr('y1', refY)
      .attr('x2', innerW)
      .attr('y2', refY)
      .attr('stroke', theme.text.muted)
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', data.referenceLine.style === 'dashed' ? '6,4' : 'none')
      .attr('opacity', 0.5);

    g.append('text')
      .attr('x', innerW + 4)
      .attr('y', refY + 3)
      .attr('font-size', '9px')
      .attr('fill', theme.text.secondary)
      .attr('font-family', theme.fontFamily)
      .text(data.referenceLine.label);
  }

  // ── Legend ──────────────────────────────────────────────

  data.series.forEach((series, idx) => {
    const color = series.color ?? getChartColor(idx);

    const item = document.createElement('div');
    item.style.cssText = `
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 10px;
      color: ${theme.text.secondary};
      font-family: ${theme.fontFamily};
    `;

    const dot = document.createElement('span');
    if (series.type === 'line') {
      dot.style.cssText = `
        width: 14px;
        height: 2px;
        background: ${color};
        border-radius: 1px;
        flex-shrink: 0;
      `;
    } else {
      dot.style.cssText = `
        width: 8px;
        height: 8px;
        background: ${color};
        border-radius: 2px;
        flex-shrink: 0;
      `;
    }

    const text = document.createElement('span');
    text.textContent = series.name;

    item.appendChild(dot);
    item.appendChild(text);
    legendEl.appendChild(item);
  });
}
