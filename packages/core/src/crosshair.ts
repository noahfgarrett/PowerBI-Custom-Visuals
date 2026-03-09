/**
 * Shared crosshair interaction for line/area/bump/stream charts.
 * Attaches mousemove/mouseleave handlers to an SVG element and renders
 * a vertical crosshair line with optional value markers.
 */

import * as d3 from 'd3';

export interface CrosshairConfig {
  /** The SVG element to attach mouse handlers to. */
  svg: SVGSVGElement;
  /** The chart area group (for rendering crosshair elements). */
  chartGroup: SVGGElement;
  /** Left margin offset (chart area x offset within SVG). */
  marginLeft: number;
  /** Top margin offset (chart area y offset within SVG). */
  marginTop: number;
  /** Chart area width (excluding margins). */
  chartWidth: number;
  /** Chart area height (excluding margins). */
  chartHeight: number;
  /** Category labels (X axis). */
  categories: string[];
  /** Series data: array of { name, values[] } where values align with categories. */
  series: Array<{ name: string; values: number[]; color: string }>;
  /** Y-scale for positioning value markers. */
  yScale: d3.ScaleLinear<number, number>;
  /** Crosshair line color. */
  lineColor: string;
  /** Crosshair line width (px). */
  lineWidth: number;
  /** Crosshair line style. */
  lineStyle: 'solid' | 'dashed' | 'dotted';
  /** Whether to show value markers at series intersection points. */
  showValues: boolean;
  /** Optional format function for value labels. */
  formatValue?: (value: number) => string;
  /** Optional callback when crosshair snaps to a category. */
  onSnap?: (categoryIndex: number, category: string) => void;
}

interface CrosshairState {
  group: d3.Selection<SVGGElement, unknown, null, undefined>;
  line: d3.Selection<SVGLineElement, unknown, null, undefined>;
  markers: d3.Selection<SVGGElement, unknown, null, undefined>;
  cleanup: () => void;
}

function toDashArray(style: string): string {
  switch (style) {
    case 'dashed': return '4 3';
    case 'dotted': return '2 2';
    default: return 'none';
  }
}

/**
 * Attaches a crosshair interaction to a chart.
 * Returns a cleanup function that removes all handlers and elements.
 */
export function attachCrosshair(config: CrosshairConfig): () => void {
  const {
    svg,
    chartGroup,
    marginLeft,
    marginTop,
    chartWidth,
    chartHeight,
    categories,
    series,
    yScale,
    lineColor,
    lineWidth,
    lineStyle,
    showValues,
    formatValue,
    onSnap,
  } = config;

  if (categories.length === 0) return () => {};

  const d3Svg = d3.select(svg);
  const d3Group = d3.select(chartGroup);

  // Build category x-positions (evenly spaced, band center)
  const step = chartWidth / categories.length;
  const categoryXs = categories.map((_, i) => i * step + step / 2);

  // Create crosshair group (hidden initially)
  const crosshairGroup = d3Group
    .append('g')
    .attr('class', 'crosshair-group')
    .style('display', 'none')
    .style('pointer-events', 'none');

  // Vertical line
  const crosshairLine = crosshairGroup
    .append('line')
    .attr('class', 'crosshair-line')
    .attr('y1', 0)
    .attr('y2', chartHeight)
    .attr('stroke', lineColor)
    .attr('stroke-width', lineWidth)
    .attr('stroke-dasharray', toDashArray(lineStyle))
    .attr('opacity', 0.7);

  // Value markers container
  const markersGroup = crosshairGroup
    .append('g')
    .attr('class', 'crosshair-markers');

  let lastSnapIndex = -1;

  function handleMouseMove(event: MouseEvent): void {
    const rect = svg.getBoundingClientRect();
    const mouseX = event.clientX - rect.left - marginLeft;

    if (mouseX < 0 || mouseX > chartWidth) {
      crosshairGroup.style('display', 'none');
      return;
    }

    // Snap to nearest category
    let closestIndex = 0;
    let closestDist = Infinity;
    for (let i = 0; i < categoryXs.length; i++) {
      const dist = Math.abs(mouseX - categoryXs[i]);
      if (dist < closestDist) {
        closestDist = dist;
        closestIndex = i;
      }
    }

    const snapX = categoryXs[closestIndex];
    crosshairGroup.style('display', null);
    crosshairLine.attr('x1', snapX).attr('x2', snapX);

    // Value markers
    markersGroup.selectAll('*').remove();

    if (showValues) {
      for (const s of series) {
        const val = s.values[closestIndex];
        if (val == null || !isFinite(val)) continue;

        const y = yScale(val);
        if (!isFinite(y) || y < 0 || y > chartHeight) continue;

        // Dot
        markersGroup
          .append('circle')
          .attr('cx', snapX)
          .attr('cy', y)
          .attr('r', 4)
          .attr('fill', s.color)
          .attr('stroke', '#fff')
          .attr('stroke-width', 1.5);

        // Value label
        const formatted = formatValue ? formatValue(val) : val.toLocaleString();
        markersGroup
          .append('text')
          .attr('x', snapX + 8)
          .attr('y', y + 4)
          .attr('font-size', '10px')
          .attr('fill', s.color)
          .attr('font-weight', '600')
          .text(formatted);
      }
    }

    if (closestIndex !== lastSnapIndex) {
      lastSnapIndex = closestIndex;
      onSnap?.(closestIndex, categories[closestIndex]);
    }
  }

  function handleMouseLeave(): void {
    crosshairGroup.style('display', 'none');
    lastSnapIndex = -1;
  }

  svg.addEventListener('mousemove', handleMouseMove);
  svg.addEventListener('mouseleave', handleMouseLeave);

  return () => {
    svg.removeEventListener('mousemove', handleMouseMove);
    svg.removeEventListener('mouseleave', handleMouseLeave);
    crosshairGroup.remove();
  };
}

/**
 * Builds a CrosshairConfig from formatting card values and chart state.
 * Convenience helper to reduce boilerplate in visuals.
 */
export function buildCrosshairConfig(
  partial: Omit<CrosshairConfig, 'lineColor' | 'lineWidth' | 'lineStyle' | 'showValues'> & {
    lineColor?: string;
    lineWidth?: number;
    lineStyle?: string;
    showValues?: boolean;
  },
): CrosshairConfig {
  return {
    ...partial,
    lineColor: partial.lineColor || '#94A3B8',
    lineWidth: partial.lineWidth ?? 1,
    lineStyle: (partial.lineStyle as CrosshairConfig['lineStyle']) || 'dashed',
    showValues: partial.showValues ?? true,
  };
}
