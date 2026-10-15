import { describe, it, expect } from 'vitest';
import * as d3 from 'd3';
import { attachCrosshair } from '../crosshair';

function setSvgRect(svg: SVGSVGElement, width: number, height: number): void {
  Object.defineProperty(svg, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      left: 0,
      top: 0,
      right: width,
      bottom: height,
      width,
      height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  });
}

describe('attachCrosshair', () => {
  it('uses explicit x positions instead of inferred midpoints', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const chartGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    svg.appendChild(chartGroup);
    document.body.appendChild(svg);
    setSvgRect(svg, 200, 120);

    const cleanup = attachCrosshair({
      svg,
      chartGroup,
      marginLeft: 0,
      marginTop: 0,
      chartWidth: 200,
      chartHeight: 100,
      categories: ['Start', 'End'],
      xPositions: [0, 200],
      series: [{ name: 'Series', values: [10, 20], color: '#2563EB' }],
      yScale: d3.scaleLinear().domain([0, 20]).range([100, 0]),
      lineColor: '#94A3B8',
      lineWidth: 1,
      lineStyle: 'solid',
      showValues: false,
    });

    svg.dispatchEvent(new MouseEvent('mousemove', { clientX: 5, clientY: 20, bubbles: true }));

    const line = chartGroup.querySelector<SVGLineElement>('.crosshair-line');
    expect(line?.getAttribute('x1')).toBe('0');

    cleanup();
    svg.remove();
  });

  it('uses marker values for position and display values for labels', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const chartGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    svg.appendChild(chartGroup);
    document.body.appendChild(svg);
    setSvgRect(svg, 120, 120);

    const cleanup = attachCrosshair({
      svg,
      chartGroup,
      marginLeft: 0,
      marginTop: 0,
      chartWidth: 120,
      chartHeight: 100,
      categories: ['A'],
      xPositions: [40],
      series: [{
        name: 'Series',
        values: [5],
        markerValues: [15],
        displayValues: [5],
        color: '#DC2626',
      }],
      yScale: d3.scaleLinear().domain([0, 20]).range([100, 0]),
      lineColor: '#94A3B8',
      lineWidth: 1,
      lineStyle: 'dashed',
      showValues: true,
      formatValue: (value) => `${value} units`,
    });

    svg.dispatchEvent(new MouseEvent('mousemove', { clientX: 40, clientY: 20, bubbles: true }));

    const marker = chartGroup.querySelector<SVGCircleElement>('.crosshair-markers circle');
    const label = chartGroup.querySelector<SVGTextElement>('.crosshair-markers text');

    expect(marker?.getAttribute('cy')).toBe('25');
    expect(label?.textContent).toBe('5 units');

    cleanup();
    svg.remove();
  });
});
