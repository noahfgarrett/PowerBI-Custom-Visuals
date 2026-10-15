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
  /** Font family for annotation text. */
  fontFamily?: string;
  /** Font weight for annotation text. */
  fontWeight?: string;
  /** Offset from the target point to the callout. */
  offset?: number;
  /** Padding inside the callout badge. */
  padding?: number;
  /** Background color for the badge. */
  backgroundColor?: string;
  /** Background opacity for the badge fill. */
  backgroundOpacity?: number;
  /** Corner radius for the badge. */
  cornerRadius?: number;
  /** Resolves a category name to an (x, y) coordinate on the chart. */
  resolvePosition: (category: string) => { x: number; y: number } | null;
}

/** Offset distance from the data point to the callout box. */
const CALLOUT_OFFSET = 24;
/** Padding inside the callout box. */
const CALLOUT_PADDING = 4;

function withOpacity(color: string, opacity: number): string {
  const clamped = Math.max(0, Math.min(1, opacity));
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const normalized = hex.length === 3
      ? hex.split('').map((c) => c + c).join('')
      : hex;
    if (normalized.length === 6) {
      const r = parseInt(normalized.slice(0, 2), 16);
      const g = parseInt(normalized.slice(2, 4), 16);
      const b = parseInt(normalized.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${clamped})`;
    }
  }
  if (color.startsWith('rgb(')) {
    return color.replace(/^rgb\((.+)\)$/u, `rgba($1, ${clamped})`);
  }
  return color;
}

/**
 * Renders annotation callouts on a chart SVG group.
 * Each annotation shows a text label with a connector line to its target data point.
 */
export function renderAnnotations(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  config: AnnotationConfig,
): void {
  const {
    annotations,
    fontSize,
    fontColor,
    connectorColor,
    fontFamily,
    fontWeight,
    offset = CALLOUT_OFFSET,
    padding = CALLOUT_PADDING,
    backgroundColor = '#FFFFFF',
    backgroundOpacity = 0.85,
    cornerRadius = 3,
    resolvePosition,
  } = config;

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
        textY = pos.y - offset;
        break;
      case 'below':
        textY = pos.y + offset + fontSize;
        break;
      case 'left':
        textX = pos.x - offset;
        anchor = 'end';
        break;
      case 'right':
        textX = pos.x + offset;
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
      .attr('font-weight', fontWeight || '500')
      .text(ann.text);
    if (fontFamily) {
      textEl.attr('font-family', fontFamily);
    }

    // Insert background rect behind text
    const bbox = (textEl.node() as SVGTextElement)?.getBBox?.();
    if (bbox) {
      annGroup
        .insert('rect', '.annotation-text')
        .attr('x', bbox.x - padding)
        .attr('y', bbox.y - padding / 2)
        .attr('width', bbox.width + padding * 2)
        .attr('height', bbox.height + padding)
        .attr('fill', withOpacity(backgroundColor, backgroundOpacity))
        .attr('rx', cornerRadius);
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
  style?: {
    fontFamily?: string;
    fontWeight?: string;
    offset?: number;
    padding?: number;
    backgroundColor?: string;
    backgroundOpacity?: number;
    cornerRadius?: number;
  },
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
    fontFamily: style?.fontFamily,
    fontWeight: style?.fontWeight,
    offset: style?.offset,
    padding: style?.padding,
    backgroundColor: style?.backgroundColor,
    backgroundOpacity: style?.backgroundOpacity,
    cornerRadius: style?.cornerRadius,
    resolvePosition,
  };
}
