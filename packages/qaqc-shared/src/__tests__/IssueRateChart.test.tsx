import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ChartColors } from '../chartTypes'
import { IssueRateChart, type IssueRateChartProps } from '../components/IssueRateChart'
import type { BuildingIssueBar } from '../types'
import { render, type Rendered } from './render'

const COLORS: ChartColors = {
  series1: '#2E5AAC', series2: '#86B6EF', series3: '#1A9C7B', good: '#0A7A0A', bad: '#D03B3B', warn: '#B45309', card: '#FDFEFF',
  grid: '#EBEEF3', axisText: '#6A7583', ink: '#1B2530', accent: '#2E5AAC',
}

function bar(building: string, welds: number, issues: number): BuildingIssueBar {
  return { building, welds, issues, rate: (issues / welds) * 100 }
}

// The spec's 30-week window: 1,570 welds and 11 issues, so the overall rate is 0.70%.
const BARS: BuildingIssueBar[] = [
  bar('Site General', 118, 2),
  bar('WR1', 273, 4),
  bar('F631', 698, 4),
  bar('BK1', 439, 1),
  bar('PS1', 40, 0),
]
const OVERALL = (11 / 1570) * 100

let view: Rendered | null = null

afterEach(() => {
  view?.unmount()
  view = null
})

function draw(overrides: Partial<IssueRateChartProps> = {}): Rendered {
  return render(
    <IssueRateChart
      bars={BARS}
      other={{ count: 1, welds: 2, issues: 0 }}
      overallRate={OVERALL}
      width={600}
      height={240}
      colors={COLORS}
      describe
      onHover={vi.fn()}
      {...overrides}
    />,
  )
}

function texts(root: HTMLElement, selector: string): string[] {
  return [...root.querySelectorAll(selector)].map((node) => node.textContent ?? '')
}

describe('IssueRateChart', () => {
  it('draws one row per building plus Other with issues and rate', () => {
    view = draw()
    expect(texts(view.container, '.qaqc-row-label')).toEqual(['Site General', 'WR1', 'F631', 'BK1', 'PS1', 'Other (1 building)'])
    expect(texts(view.container, '.qaqc-value-text')).toEqual([
      '2 issues · 1.7%',
      '4 issues · 1.5%',
      '4 issues · 0.6%',
      '1 issue · 0.2%',
      '0 issues · 0.0%',
      '0 issues · 0.0%',
    ])
  })

  it('labels several grouped buildings in the plural', () => {
    view = draw({ other: { count: 3, welds: 9, issues: 1 } })
    expect(texts(view.container, '.qaqc-row-label')[5]).toBe('Other (3 buildings)')
  })

  it('draws buildings at 2x the overall rate or more in amber and the rest in series 1', () => {
    view = draw()
    const rows = [...view.container.querySelectorAll('.qaqc-bar')]
    expect(rows.map((row) => row.classList.contains('is-hotspot'))).toEqual([true, true, false, false, false, false])
    const fills = rows.slice(0, 4).map((row) => row.querySelector('path')?.getAttribute('fill'))
    expect(fills).toEqual([COLORS.warn, COLORS.warn, COLORS.series1, COLORS.series1])
  })

  it('counts a rate of exactly 2x the overall rate as a hotspot', () => {
    view = draw({ bars: [bar('A', 100, 2), bar('B', 100, 1)], other: null, overallRate: 1 })
    expect([...view.container.querySelectorAll('.qaqc-bar')].map((row) => row.classList.contains('is-hotspot'))).toEqual([true, false])
  })

  it('never marks Other as a hotspot', () => {
    view = draw({ bars: [bar('A', 100, 1)], other: { count: 2, welds: 4, issues: 2 }, overallRate: 2.9 })
    const rows = [...view.container.querySelectorAll('.qaqc-bar')]
    expect(rows[1].classList.contains('is-hotspot')).toBe(false)
    expect(rows[1].querySelector('path')?.getAttribute('fill')).toBe(COLORS.series1)
  })

  it('marks the overall rate with a vertical hairline', () => {
    view = draw({ bars: [bar('A', 100, 2), bar('B', 100, 1)], other: null, overallRate: 1 })
    const line = view.container.querySelector('.qaqc-overall-line')
    if (!line) throw new Error('overall line missing')
    expect(line.getAttribute('x1')).toBe(line.getAttribute('x2'))
    // B sits exactly at the overall rate, so its bar ends on the hairline; value text starts 6 px later.
    const bValueX = Number(view.container.querySelectorAll('.qaqc-value-text')[1].getAttribute('x'))
    expect(Number(line.getAttribute('x1'))).toBeCloseTo(bValueX - 6, 6)
  })

  it('paints end labels over the hairline so it never strikes through them', () => {
    view = draw()
    const line = view.container.querySelector('.qaqc-overall-line')
    const labels = [...view.container.querySelectorAll('.qaqc-value-text')]
    if (!line) throw new Error('overall line missing')
    expect(labels.every((label) => (line.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0)).toBe(true)
  })

  it('keeps the hairline inside the plot when every building is below the overall rate', () => {
    // Other carries the issues, so the overall rate is above every ranked building.
    view = draw({ bars: [bar('A', 100, 1)], other: { count: 2, welds: 4, issues: 2 }, overallRate: 2.9 })
    const x = Number(view.container.querySelector('.qaqc-overall-line')?.getAttribute('x1'))
    expect(x).toBeLessThanOrEqual(600)
  })

  it('says so when the range has no issues', () => {
    view = draw({ bars: [bar('A', 100, 0)], other: { count: 1, welds: 2, issues: 0 }, overallRate: 0 })
    expect(view.container.querySelector('.qaqc-chart-empty')?.textContent).toBe('No issues created in this range')
    expect(view.container.querySelector('svg')).toBeNull()
  })

  it('says so when the range has no buildings at all', () => {
    view = draw({ bars: [], other: null, overallRate: 0 })
    expect(view.container.querySelector('.qaqc-chart-empty')?.textContent).toBe('No issues created in this range')
  })

  it('reports building tooltips and clears them on leave', () => {
    const onHover = vi.fn()
    view = draw({ onHover })
    const hit = view.container.querySelectorAll('.qaqc-hit')[1]
    act(() => {
      hit.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 3, clientY: 4 }))
    })
    expect(onHover).toHaveBeenLastCalledWith({
      title: 'WR1',
      rows: [
        { label: 'Issues', value: '4' },
        { label: 'Welds', value: '273' },
        { label: 'Issue rate', value: '1.5%' },
      ],
      clientX: 3,
      clientY: 4,
    })
    act(() => {
      hit.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }))
    })
    expect(onHover).toHaveBeenLastCalledWith(null)
  })

  it('describes the highest rate and the overall rate', () => {
    view = draw()
    expect(view.container.querySelector('svg')?.getAttribute('aria-label')).toBe(
      'Issue rate by building, overall 0.7%. Highest: Site General, 2 issues, 1.7%',
    )
  })

  it('keeps a short label when chart descriptions are off', () => {
    view = draw({ describe: false })
    expect(view.container.querySelector('svg')?.getAttribute('aria-label')).toBe('Issue rate by building')
  })

  it('drops rows that do not fit at the minimum row height', () => {
    view = draw({ height: 48 })
    expect(view.container.querySelectorAll('.qaqc-row-label')).toHaveLength(4)
  })
})
