import { describe, it, expect, beforeAll } from 'vitest';
import * as d3 from 'd3';
import { buildAnnotationConfig, renderAnnotations } from '../annotation';

beforeAll(() => {
  if (!('getBBox' in SVGElement.prototype)) {
    Object.defineProperty(SVGElement.prototype, 'getBBox', {
      configurable: true,
      value() {
        const text = (this.textContent ?? '').length;
        return {
          x: 0,
          y: 0,
          width: Math.max(12, text * 7),
          height: 14,
        };
      },
    });
  }
});

describe('annotation helpers', () => {
  it('passes shared style options through buildAnnotationConfig', () => {
    const config = buildAnnotationConfig(
      true,
      [{ category: 'A', text: 'Callout', position: 'above' }],
      12,
      '#111827',
      '#94A3B8',
      () => ({ x: 10, y: 20 }),
      {
        fontFamily: 'Georgia',
        fontWeight: '600',
        offset: 30,
        padding: 6,
        backgroundColor: '#F8FAFC',
        backgroundOpacity: 0.7,
        cornerRadius: 5,
      },
    );

    expect(config).not.toBeNull();
    expect(config?.fontFamily).toBe('Georgia');
    expect(config?.fontWeight).toBe('600');
    expect(config?.offset).toBe(30);
    expect(config?.padding).toBe(6);
    expect(config?.backgroundColor).toBe('#F8FAFC');
    expect(config?.backgroundOpacity).toBe(0.7);
    expect(config?.cornerRadius).toBe(5);
  });

  it('renders styled annotation badges with custom font and background settings', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const g = d3.select(svg).append('g');

    renderAnnotations(g, {
      annotations: [{ category: 'A', text: 'Styled Note', position: 'right' }],
      fontSize: 13,
      fontColor: '#0F172A',
      fontFamily: 'Verdana',
      fontWeight: 'bold',
      connectorColor: '#2563EB',
      offset: 32,
      padding: 8,
      backgroundColor: '#F97316',
      backgroundOpacity: 0.5,
      cornerRadius: 7,
      resolvePosition: () => ({ x: 20, y: 40 }),
    });

    const text = svg.querySelector<SVGTextElement>('.annotation-text');
    const rect = svg.querySelector<SVGRectElement>('rect');
    const line = svg.querySelector<SVGLineElement>('.annotation-connector');

    expect(text?.getAttribute('font-family')).toBe('Verdana');
    expect(text?.getAttribute('font-weight')).toBe('bold');
    expect(text?.getAttribute('x')).toBe('52');
    expect(rect?.getAttribute('fill')).toBe('rgba(249, 115, 22, 0.5)');
    expect(rect?.getAttribute('rx')).toBe('7');
    expect(line?.getAttribute('stroke')).toBe('#2563EB');
  });
});
