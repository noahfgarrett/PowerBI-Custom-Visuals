/**
 * Shared annotation/callout rendering for chart data points.
 * Renders labeled callout markers with connector lines pointing to specific positions.
 */

import * as d3 from 'd3';

export interface AnnotationItem {
  /** The category/label this annotation targets. */
  category: string;
  /** The annotation text to display. */
  text: string;
  /** Position of the callout relative to the data point. */
  position: 'above' | 'below' | 'left' | 'right';
}

export interface AnnotationConfig {
  /** Up to 3 annotation items. */
  annotations: AnnotationItem[];
  /** Font size for annotation text. */
  fontSize: number;
  /** Font color for annotation text. */
  fontColor: string;
  /** Connector line color. */
  connectorColor: string;
  /** Resolves a category name to an (x, y) coordinate on the chart. */
  resolvePosition: (category: string) => { x: number; y: number } | null;
}

/** Offset distance from the data point to the callout box. */
const CALLOUT_OFFSET = 24;
/** Padding inside the callout box. */
const CALLOUT_PADDING = 4;

/**
 * Renders annotation callouts on a chart SVG group.
 * Each annotation shows a text label with a connector line to its target data point.
 */
export function renderAnnotations(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  config: AnnotationConfig,
): void {
  const { annotations, fontSize, fontColor, connectorColor, resolvePosition } = config;

  if (annotations.length === 0) return;

  const group = g.append('g').attr('class', 'annotations-group');

  for (const ann of annotations) {
    if (!ann.category || !ann.text) continue;

    const pos = resolvePosition(ann.category);
    if (!pos) continue;

    const annGroup = group.append('g').attr('class', 'annotation-item');

    // Calculate callout position based on direction
    let textX = pos.x;
    let textY = pos.y;
    let anchor: string = 'middle';

    switch (ann.position) {
      case 'above':
        textY = pos.y - CALLOUT_OFFSET;
        break;
      case 'below':
        textY = pos.y + CALLOUT_OFFSET + fontSize;
        break;
      case 'left':
        textX = pos.x - CALLOUT_OFFSET;
        anchor = 'end';
        break;
      case 'right':
        textX = pos.x + CALLOUT_OFFSET;
        anchor = 'start';
        break;
    }

    // Connector line
    annGroup
      .append('line')
      .attr('class', 'annotation-connector')
      .attr('x1', pos.x)
      .attr('y1', pos.y)
      .attr('x2', textX)
      .attr('y2', ann.position === 'above' ? textY + fontSize / 2 : ann.position === 'below' ? textY - fontSize : textY)
      .attr('stroke', connectorColor)
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3 2');

    // Data point marker dot
    annGroup
      .append('circle')
      .attr('class', 'annotation-dot')
      .attr('cx', pos.x)
      .attr('cy', pos.y)
      .attr('r', 3)
      .attr('fill', connectorColor);

    // Background rect for readability
    const textEl = annGroup
      .append('text')
      .attr('class', 'annotation-text')
      .attr('x', textX)
      .attr('y', textY)
      .attr('text-anchor', anchor)
      .attr('font-size', `${fontSize}px`)
      .attr('fill', fontColor)
      .attr('font-weight', '500')
      .text(ann.text);

    // Insert background rect behind text
    const bbox = (textEl.node() as SVGTextElement)?.getBBox?.();
    if (bbox) {
      annGroup
        .insert('rect', '.annotation-text')
        .attr('x', bbox.x - CALLOUT_PADDING)
        .attr('y', bbox.y - CALLOUT_PADDING / 2)
        .attr('width', bbox.width + CALLOUT_PADDING * 2)
        .attr('height', bbox.height + CALLOUT_PADDING)
        .attr('fill', 'rgba(255, 255, 255, 0.85)')
        .attr('rx', 3);
    }
  }
}

/**
 * Builds an AnnotationConfig from formatting card values.
 * Extracts up to 3 annotation slots from the card settings.
 */
export function buildAnnotationConfig(
  show: boolean,
  slots: Array<{ category: string; text: string; position: string }>,
  fontSize: number,
  fontColor: string,
  connectorColor: string,
  resolvePosition: (category: string) => { x: number; y: number } | null,
): AnnotationConfig | null {
  if (!show) return null;

  const annotations: AnnotationItem[] = slots
    .filter((s) => s.category && s.text)
    .map((s) => ({
      category: s.category,
      text: s.text,
      position: (['above', 'below', 'left', 'right'].includes(s.position) ? s.position : 'above') as AnnotationItem['position'],
    }));

  if (annotations.length === 0) return null;

  return {
    annotations,
    fontSize: fontSize || 11,
    fontColor: fontColor || '#475569',
    connectorColor: connectorColor || '#94A3B8',
    resolvePosition,
  };
}
