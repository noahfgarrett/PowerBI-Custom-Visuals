import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ordinalOpacity } from '../chartMath'
import type { ChartColors } from '../chartTypes'
import { AgingStripChart } from '../components/AgingStripChart'
import { OpenAgingChart, type OpenAgingChartProps } from '../components/OpenAgingChart'
import { chartColorsFromTheme, compositeOver, contrastRatio, isPresetName, PRESETS, resolveTheme, type ThemeOptions } from '../theme'
import type { AgingBucket, OverallAgingBucket } from '../types'
import { render, type Rendered } from './render'

const COLORS: ChartColors = {
  series1: '#2E5AAC', series2: '#86B6EF', good: '#0A7A0A', bad: '#D03B3B', warn: '#B45309', card: '#FDFEFF',
  grid: '#EBEEF3', axisText: '#6A7583', ink: '#1B2530', accent: '#2E5AAC',
}

const THEME_BASE: ThemeOptions = { preset: 'qaqc', backgroundColor: '', backgroundOpacity: 100, cardOpacity: 100, highContrast: null }

let view: Rendered | null = null

afterEach(() => {
  view?.unmount()
  view = null
})

function texts(root: ParentNode, selector: string): string[] {
  return [...root.querySelectorAll(selector)].map((node) => node.textContent ?? '')
}

function numberAttr(node: Element, name: string): number {
  return Number(node.getAttribute(name))
}

function buckets(counts: number[]): AgingBucket[] {
  const labels = ['0-1', '1-2', '2-3', '3-4', '4+']
  return counts.map((count, index) => ({ label: labels[index], count }))
}

// Geometry at 400 × 200: the plot spans y 22–162 (140 px tall). Counts up to 51 give a 0–60 axis, so one issue is
// 2.33 px tall: 10 issues make a 23.3 px bar (label above) and 11 make a 25.7 px bar (label inside).
const PLOT_BOTTOM = 162
const PLOT_HEIGHT = 140
const COUNTS = [0, 10, 11, 3, 51]

function draw(overrides: Partial<OpenAgingChartProps> = {}): Rendered {
  return render(
    <OpenAgingChart
      buckets={buckets(COUNTS)}
      width={400}
      height={200}
      colors={COLORS}
      isHighContrast={false}
      describe
      onHover={vi.fn()}
      {...overrides}
    />,
  )
}

function barTop(count: number): number {
  return PLOT_BOTTOM - (count / 60) * PLOT_HEIGHT
}

describe('OpenAgingChart', () => {
  it('draws a bar for every bucket with issues, in series 1', () => {
    view = draw()
    const bars = [...view.container.querySelectorAll('.qaqc-open-aging-bar')]
    expect(bars).toHaveLength(4)
    expect(bars.every((bar) => bar.getAttribute('fill') === COLORS.series1)).toBe(true)
  })

  it('shades the buckets on an ordinal ramp from 0.35 to full opacity', () => {
    view = draw({ buckets: buckets([1, 1, 1, 1, 1]) })
    const opacities = [...view.container.querySelectorAll('.qaqc-open-aging-bar')].map((bar) => numberAttr(bar, 'fill-opacity'))
    expect(opacities).toEqual([0.35, 0.5125, 0.675, 0.8375, 1])
  })

  it('draws every bucket at full opacity in high contrast', () => {
    view = draw({ buckets: buckets([1, 1, 1, 1, 1]), isHighContrast: true })
    const opacities = [...view.container.querySelectorAll('.qaqc-open-aging-bar')].map((bar) => numberAttr(bar, 'fill-opacity'))
    expect(opacities).toEqual([1, 1, 1, 1, 1])
  })

  it('labels every bucket with its count, including empty ones', () => {
    view = draw()
    expect(texts(view.container, '.qaqc-open-aging-value')).toEqual(['0', '10', '11', '3', '51'])
  })

  it('puts the label inside a bar at least 24 px tall and above a shorter one', () => {
    view = draw()
    const labels = [...view.container.querySelectorAll('.qaqc-open-aging-value')]
    expect(labels.map((label) => label.classList.contains('is-inside'))).toEqual([false, false, true, false, true])
    expect(numberAttr(labels[1], 'y')).toBeCloseTo(barTop(10) - 7, 6)
    expect(numberAttr(labels[2], 'y')).toBeCloseTo(barTop(11) + 17, 6)
  })

  it('gives every inside label whichever of ink or card contrasts more with its bar, on every preset', () => {
    for (const preset of Object.keys(PRESETS)) {
      if (!isPresetName(preset)) throw new Error(`bad preset ${preset}`)
      const colors = chartColorsFromTheme(resolveTheme({ ...THEME_BASE, preset }))
      view = draw({ buckets: buckets([50, 50, 50, 50, 50]), colors })
      const labels = [...view.container.querySelectorAll('.qaqc-open-aging-value')]
      labels.forEach((label, index) => {
        const bar = compositeOver(colors.series1, ordinalOpacity(index, 5), colors.card)
        const best = Math.max(contrastRatio(colors.ink, bar), contrastRatio(colors.card, bar))
        expect(contrastRatio(label.getAttribute('fill') ?? '', bar), `${preset} bucket ${index}`).toBeCloseTo(best, 9)
      })
      view.unmount()
      view = null
    }
  })

  it('uses card text on the LotusWorks 2-3 bucket, where ink would be too faint', () => {
    const colors = chartColorsFromTheme(resolveTheme({ ...THEME_BASE, preset: 'lotusworks' }))
    view = draw({ buckets: buckets([50, 50, 50, 50, 50]), colors })
    expect(view.container.querySelectorAll('.qaqc-open-aging-value')[2].getAttribute('fill')).toBe(colors.card)
  })

  it('uses dark text on the lightest qaqc bucket', () => {
    view = draw({ buckets: buckets([50, 50, 50, 50, 50]) })
    expect(view.container.querySelector('.qaqc-open-aging-value')?.getAttribute('fill')).toBe(COLORS.ink)
  })

  it('uses card text on the solid foreground bars in high contrast', () => {
    const highContrast = { foreground: '#FFFF00', background: '#000000', foregroundSelected: '#00FFFF' }
    const colors = chartColorsFromTheme(resolveTheme({ ...THEME_BASE, highContrast }))
    view = draw({ buckets: buckets([50, 50, 50, 50, 50]), colors, isHighContrast: true })
    const fills = [...view.container.querySelectorAll('.qaqc-open-aging-value')].map((label) => label.getAttribute('fill'))
    expect(fills).toEqual(Array(5).fill('#000000'))
  })

  it('keeps a bucket with very few issues visible at 2 px', () => {
    view = draw({ buckets: buckets([1, 0, 0, 0, 1000]) })
    const first = view.container.querySelector('.qaqc-open-aging-bar')
    // The path starts at the baseline (M x,bottom) and its first curve reaches the top (Q x,top).
    const box = first?.getAttribute('d')?.match(/^M[\d.]+,([\d.]+)V[\d.]+Q[\d.]+,([\d.]+)/)
    expect(Number(box?.[1]) - Number(box?.[2])).toBeCloseTo(2, 1)
  })

  it('labels the buckets and titles both axes like the app', () => {
    view = draw()
    expect(texts(view.container, '.qaqc-open-aging-bucket')).toEqual(['0-1', '1-2', '2-3', '3-4', '4+'])
    expect(texts(view.container, '.qaqc-axis-title')).toEqual(['Open issues', 'Weeks'])
  })

  it('draws a count axis with gridlines on a nice scale', () => {
    view = draw()
    expect(texts(view.container, '.qaqc-axis-text')).toEqual(['0', '20', '40', '60'])
    expect(view.container.querySelectorAll('.qaqc-grid-line')).toHaveLength(4)
  })

  it('reports hover details and clears them on leave', () => {
    const onHover = vi.fn()
    view = draw({ onHover })
    const hit = view.container.querySelectorAll('.qaqc-hit')[4]
    act(() => {
      hit.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 5, clientY: 6 }))
    })
    expect(onHover).toHaveBeenLastCalledWith({ title: '4+ weeks', rows: [{ label: 'Open issues', value: '51' }], clientX: 5, clientY: 6 })
    act(() => {
      hit.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }))
    })
    expect(onHover).toHaveBeenLastCalledWith(null)
  })

  it('describes the counts in its label when describing charts', () => {
    view = draw()
    expect(view.container.querySelector('svg')?.getAttribute('aria-label')).toBe(
      'Open issue aging by weeks: 0-1 weeks 0, 1-2 weeks 10, 2-3 weeks 11, 3-4 weeks 3, 4+ weeks 51',
    )
  })

  it('keeps a short label when not describing charts', () => {
    view = draw({ describe: false })
    expect(view.container.querySelector('svg')?.getAttribute('aria-label')).toBe('Open issue aging by weeks')
  })

  it('draws no bars when no issue is open', () => {
    view = draw({ buckets: buckets([0, 0, 0, 0, 0]) })
    expect(view.container.querySelectorAll('.qaqc-open-aging-bar')).toHaveLength(0)
    expect(texts(view.container, '.qaqc-open-aging-value')).toEqual(['0', '0', '0', '0', '0'])
  })
})

const OVERALL: OverallAgingBucket[] = [
  { label: '0-14 Days', count: 38, closed: 30, open: 8 },
  { label: '14-28 Days', count: 19, closed: 15, open: 4 },
  { label: '28+ Days', count: 120, closed: 81, open: 39 },
]

function widths(root: ParentNode, selector: string): number[] {
  return [...root.querySelectorAll<HTMLElement>(selector)].map((node) => parseFloat(node.style.width))
}

function opacities(root: ParentNode, selector: string): number[] {
  return [...root.querySelectorAll<HTMLElement>(selector)].map((node) => Number(node.style.opacity))
}

describe('AgingStripChart', () => {
  it('splits a 100% strip by each bucket share', () => {
    view = render(<AgingStripChart buckets={OVERALL} colors={COLORS} isHighContrast={false} />)
    const shares = widths(view.container, '.qaqc-aging-strip > i')
    expect(shares[0]).toBeCloseTo((38 / 177) * 100, 6)
    expect(shares[1]).toBeCloseTo((19 / 177) * 100, 6)
    expect(shares[2]).toBeCloseTo((120 / 177) * 100, 6)
  })

  it('lists one row per bucket with its label, count, and whole percent', () => {
    view = render(<AgingStripChart buckets={OVERALL} colors={COLORS} isHighContrast={false} />)
    const rows = [...view.container.querySelectorAll('.qaqc-aging-row')].map((row) => [
      row.querySelector('.qaqc-aging-label')?.textContent ?? '',
      row.querySelector('.qaqc-aging-count')?.textContent ?? '',
      row.querySelector('.qaqc-aging-percent')?.textContent ?? '',
    ])
    expect(rows).toEqual([
      ['0-14 Days', '38', '21%'],
      ['14-28 Days', '19', '11%'],
      ['28+ Days', '120', '68%'],
    ])
  })

  it('draws each row bar at its bucket share', () => {
    view = render(<AgingStripChart buckets={OVERALL} colors={COLORS} isHighContrast={false} />)
    expect(widths(view.container, '.qaqc-aging-track > i')[2]).toBeCloseTo((120 / 177) * 100, 6)
  })

  it('shades the strip, swatches, and row bars on the series 1 ramp', () => {
    view = render(<AgingStripChart buckets={OVERALL} colors={COLORS} isHighContrast={false} />)
    expect(opacities(view.container, '.qaqc-aging-strip > i')).toEqual([0.35, 0.675, 1])
    expect(opacities(view.container, '.qaqc-aging-swatch')).toEqual([0.35, 0.675, 1])
    expect(opacities(view.container, '.qaqc-aging-track > i')).toEqual([0.35, 0.675, 1])
  })

  it('draws every bucket at full opacity in high contrast', () => {
    view = render(<AgingStripChart buckets={OVERALL} colors={COLORS} isHighContrast />)
    expect(opacities(view.container, '.qaqc-aging-strip > i')).toEqual([1, 1, 1])
    expect(opacities(view.container, '.qaqc-aging-swatch')).toEqual([1, 1, 1])
  })

  it('marks itself high contrast so the CSS outlines the strip and tracks', () => {
    view = render(<AgingStripChart buckets={OVERALL} colors={COLORS} isHighContrast />)
    expect(view.container.querySelector('.qaqc-aging')?.classList.contains('is-high-contrast')).toBe(true)
  })

  it('keeps filled tracks outside high contrast', () => {
    view = render(<AgingStripChart buckets={OVERALL} colors={COLORS} isHighContrast={false} />)
    expect(view.container.querySelector('.qaqc-aging')?.classList.contains('is-high-contrast')).toBe(false)
  })

  it('rounds the percents so they add up to 100', () => {
    const thirds = OVERALL.map((bucket) => ({ ...bucket, count: 1 }))
    view = render(<AgingStripChart buckets={thirds} colors={COLORS} isHighContrast={false} />)
    expect(texts(view.container, '.qaqc-aging-percent')).toEqual(['34%', '33%', '33%'])
  })

  it('gives the extra point to the largest remainder', () => {
    // 2 / 7, 2 / 7 and 3 / 7 are 28.57%, 28.57% and 42.86%. Plain rounding gives 29 + 29 + 43 = 101; the floors sum
    // to 98, so the two largest remainders (.86, then the first .57) gain a point each.
    const counts = [2, 2, 3]
    view = render(<AgingStripChart buckets={OVERALL.map((bucket, index) => ({ ...bucket, count: counts[index] }))} colors={COLORS} isHighContrast={false} />)
    expect(texts(view.container, '.qaqc-aging-percent')).toEqual(['29%', '28%', '43%'])
  })

  it('shows each percent as plain text, not emphasis', () => {
    view = render(<AgingStripChart buckets={OVERALL} colors={COLORS} isHighContrast={false} />)
    expect(view.container.querySelectorAll('em')).toHaveLength(0)
    expect(view.container.querySelector('.qaqc-aging-percent')?.tagName).toBe('SPAN')
  })

  it('hides the decorative swatches and bars from screen readers', () => {
    view = render(<AgingStripChart buckets={OVERALL} colors={COLORS} isHighContrast={false} />)
    const decorations = [...view.container.querySelectorAll('.qaqc-aging-row i')]
    expect(decorations).toHaveLength(6)
    expect(decorations.every((node) => node.getAttribute('aria-hidden') === 'true')).toBe(true)
  })

  it('formats large counts with a thousands separator', () => {
    view = render(<AgingStripChart buckets={[{ ...OVERALL[0], count: 1204 }]} colors={COLORS} isHighContrast={false} />)
    expect(view.container.querySelector('.qaqc-aging-count')?.textContent).toBe('1,204')
  })

  it('shows empty bars and 0% when there are no issues', () => {
    const empty = OVERALL.map((bucket) => ({ ...bucket, count: 0, closed: 0, open: 0 }))
    view = render(<AgingStripChart buckets={empty} colors={COLORS} isHighContrast={false} />)
    expect(widths(view.container, '.qaqc-aging-strip > i')).toEqual([0, 0, 0])
    expect(texts(view.container, '.qaqc-aging-percent')).toEqual(['0%', '0%', '0%'])
  })

  it('hides the strip from screen readers, which read the rows instead', () => {
    view = render(<AgingStripChart buckets={OVERALL} colors={COLORS} isHighContrast={false} />)
    expect(view.container.querySelector('.qaqc-aging-strip')?.getAttribute('aria-hidden')).toBe('true')
  })
})
