/**
 * Radial Gauge renderer.
 * Displays an arc that sweeps to the current value with color zones.
 */

import * as d3 from 'd3';
import {
  formatPercent,
  formatNumber,
  countUp,
  sweepArc,
  fadeSlideIn,
  DURATION,
  getTheme,
  withOpacity,
  type ColorMode,
} from '@pbi/core';
import type { GaugeData } from '../mock-data';

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

/**
 * Converts a value to an angle on the gauge arc.
 * Arc spans from -π/2 (left) to π/2 (right) = half circle.
 */
function valueToAngle(value: number, min: number, max: number): number {
  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min)));
  // Half circle: -135° to 135° in radians
  const startAngle = (-3 * Math.PI) / 4;
  const endAngle = (3 * Math.PI) / 4;
  return startAngle + ratio * (endAngle - startAngle);
}

export function renderRadialGauge(
  containerId: string,
  data: GaugeData,
  mode: ColorMode
): void {
  cleanup(containerId);

  const container = document.getElementById(containerId);
  if (!container) return;

  const theme = getTheme(mode);
  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 4px;
    position: relative;
  `;

  // ── SVG Gauge ───────────────────────────────────────────

  const size = 140;
  const cx = size / 2;
  const cy = size / 2 + 10; // shifted down slightly for the arc
  const outerRadius = 58;
  const innerRadius = 44;

  const svgContainer = document.createElement('div');
  svgContainer.style.cssText = `
    width: ${size}px;
    height: ${size - 10}px;
    position: relative;
  `;

  const svg = d3
    .select(svgContainer)
    .append('svg')
    .attr('width', size)
    .attr('height', size - 10)
    .attr('viewBox', `0 0 ${size} ${size - 10}`);

  const g = svg.append('g').attr('transform', `translate(${cx}, ${cy})`);

  const startAngle = (-3 * Math.PI) / 4;
  const endAngle = (3 * Math.PI) / 4;

  // Background track
  const bgArc = d3
    .arc<unknown>()
    .innerRadius(innerRadius)
    .outerRadius(outerRadius)
    .startAngle(startAngle)
    .endAngle(endAngle)
    .cornerRadius(3);

  g.append('path')
    .attr('d', bgArc({}) as string)
    .attr('fill', mode === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)');

  // Color zone arcs
  let prevAngle = startAngle;
  for (const zone of data.zones) {
    const zoneEndAngle = valueToAngle(zone.threshold, data.min, data.max);
    const zoneArc = d3
      .arc<unknown>()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius)
      .startAngle(prevAngle)
      .endAngle(zoneEndAngle)
      .cornerRadius(1);

    g.append('path')
      .attr('d', zoneArc({}) as string)
      .attr('fill', withOpacity(zone.color, 0.15));

    prevAngle = zoneEndAngle;
  }

  // Value arc (animated)
  const valueArcGenerator = d3
    .arc<unknown>()
    .innerRadius(innerRadius)
    .outerRadius(outerRadius)
    .startAngle(startAngle)
    .cornerRadius(3);

  // Determine value color from zones
  let valueColor = data.zones[data.zones.length - 1].color;
  for (const zone of data.zones) {
    if (data.value <= zone.threshold) {
      valueColor = zone.color;
      break;
    }
  }

  const valueArcPath = g
    .append('path')
    .attr('fill', valueColor)
    .attr(
      'd',
      valueArcGenerator.endAngle(startAngle)({}) as string
    )
    .style('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))');

  // Animate the arc sweep
  const targetAngle = valueToAngle(data.value, data.min, data.max);
  const cancelSweep = sweepArc(
    startAngle,
    targetAngle,
    DURATION.slow,
    (currentAngle) => {
      valueArcPath.attr(
        'd',
        valueArcGenerator.endAngle(currentAngle)({}) as string
      );
    }
  );
  track(containerId, cancelSweep);

  // Target tick
  if (data.target !== undefined) {
    const targetAngleVal = valueToAngle(data.target, data.min, data.max);
    const tickLength = outerRadius + 5;
    const tickInner = innerRadius - 3;

    g.append('line')
      .attr('x1', tickInner * Math.cos(targetAngleVal - Math.PI / 2))
      .attr('y1', tickInner * Math.sin(targetAngleVal - Math.PI / 2))
      .attr('x2', tickLength * Math.cos(targetAngleVal - Math.PI / 2))
      .attr('y2', tickLength * Math.sin(targetAngleVal - Math.PI / 2))
      .attr('stroke', theme.text.secondary)
      .attr('stroke-width', 2)
      .attr('stroke-linecap', 'round')
      .attr('opacity', 0.6);
  }

  // Center value text
  const centerValue = document.createElement('div');
  centerValue.style.cssText = `
    position: absolute;
    top: 55%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    pointer-events: none;
  `;

  const valueFmt = data.format === 'percent' ? formatPercent : formatNumber;
  const mainValueEl = document.createElement('div');
  mainValueEl.style.cssText = `
    font-size: 22px;
    font-weight: 700;
    color: ${valueColor};
    font-family: ${theme.fontFamily};
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
  `;
  mainValueEl.textContent = valueFmt(0);

  // Count-up animation
  const cancelCount = countUp(0, data.value, DURATION.slow, (v) => {
    mainValueEl.textContent = valueFmt(v);
  });
  track(containerId, cancelCount);

  centerValue.appendChild(mainValueEl);
  svgContainer.appendChild(centerValue);

  // Label
  const labelEl = document.createElement('div');
  labelEl.textContent = data.label;
  labelEl.style.cssText = `
    font-size: 10px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: ${theme.text.muted};
    font-family: ${theme.fontFamily};
  `;

  wrapper.appendChild(svgContainer);
  wrapper.appendChild(labelEl);
  container.appendChild(wrapper);

  // Entrance fade
  const cancelFade = fadeSlideIn(wrapper, 'up', DURATION.fast, 100);
  track(containerId, cancelFade);
}
