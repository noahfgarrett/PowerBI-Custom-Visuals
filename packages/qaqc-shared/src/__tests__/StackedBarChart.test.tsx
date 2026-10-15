import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ChartColors } from '../chartTypes'
import { StackedBarChart, type StackedBarChartProps } from '../components/StackedBarChart'
import type { WeekCounts } from '../types'
import { makeWorkWeek } from '../workWeeks'
import { render, type Rendered } from './render'

const COLORS: ChartColors = {
  series1: '#2E5AAC', series2: '#86B6EF', bad: '#D03B3B', card: '#FDFEFF',
  grid: '#EBEEF3', axisText: '#6A7583', ink: '#1B2530', accent: '#2E5AAC',
}

const WEEKS: WeekCounts[] = [
  { week: makeWorkWeek(2026, 40), finals: 4, sors: 1, issuesFound: 0 },
  { week: makeWorkWeek(2026, 41), finals: 6, sors: 3, issuesFound: 2 },
  { week: makeWorkWeek(2026, 42), finals: 3, sors: 3, issuesFound: 0 },
]

let view: Rendered | null = null

afterEach(() => {
  view?.unmount()
  view = null
})

function draw(overrides: Partial<StackedBarChartProps> = {}): Rendered {
  return render(
    <StackedBarChart
      weeks={WEEKS}
      selectedKey={202642}
      width={600}
      height={300}
      colors={COLORS}
      interactive
      animate={false}
      describe
      onSelectWeek={vi.fn()}
      onHover={vi.fn()}
      {...overrides}
    />,
  )
}

function fire(target: Element, event: Event): void {
  act(() => {
    target.dispatchEvent(event)
  })
}

describe('StackedBarChart', () => {
  it('draws one hit area per week and a count badge on issue weeks', () => {
    view = draw()
    expect(view.container.querySelectorAll('.qaqc-hit')).toHaveLength(3)
    const badges = view.container.querySelectorAll('.qaqc-issue-badge')
    expect(badges).toHaveLength(1)
    expect(badges[0].textContent).toBe('2')
  })

  it('labels the selected week in bold', () => {
    view = draw()
    expect(view.container.querySelector('.qaqc-axis-text.is-selected')?.textContent).toBe('WW42')
  })

  it('selects a week on click when interactive', () => {
    const onSelectWeek = vi.fn()
    view = draw({ onSelectWeek })
    const hit = view.container.querySelector('[data-week="202641"]')
    if (!hit) throw new Error('hit area missing')
    fire(hit, new MouseEvent('click', { bubbles: true }))
    expect(onSelectWeek).toHaveBeenCalledWith(202641)
  })

  it('ignores clicks when interactions are off', () => {
    const onSelectWeek = vi.fn()
    view = draw({ onSelectWeek, interactive: false })
    const hit = view.container.querySelector('[data-week="202641"]')
    if (!hit) throw new Error('hit area missing')
    fire(hit, new MouseEvent('click', { bubbles: true }))
    expect(onSelectWeek).not.toHaveBeenCalled()
  })

  it('moves focus with arrow keys and selects with Enter', () => {
    const onSelectWeek = vi.fn()
    view = draw({ onSelectWeek })
    const svg = view.container.querySelector('svg')
    if (!svg) throw new Error('svg missing')
    expect(svg.getAttribute('tabindex')).toBe('0')
    fire(svg, new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    fire(svg, new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(onSelectWeek).toHaveBeenCalledWith(202641)
  })

  it('reports hover details and clears them on leave', () => {
    const onHover = vi.fn()
    view = draw({ onHover })
    const hit = view.container.querySelector('[data-week="202641"]')
    const svg = view.container.querySelector('svg')
    if (!hit || !svg) throw new Error('chart missing')
    fire(hit, new MouseEvent('mousemove', { bubbles: true, clientX: 10, clientY: 20 }))
    expect(onHover).toHaveBeenLastCalledWith({
      title: "WW41'2026",
      rows: [
        { label: 'Finals', value: '6' },
        { label: 'SORs', value: '3' },
        { label: 'Issues found', value: '2' },
      ],
      clientX: 10,
      clientY: 20,
    })
    fire(hit, new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }))
    expect(onHover).toHaveBeenLastCalledWith(null)
  })

  it('announces the focused week through a live region', () => {
    view = draw()
    const svg = view.container.querySelector('svg')
    const live = view.container.querySelector('[aria-live="polite"]')
    if (!svg || !live) throw new Error('chart missing')
    expect(svg.getAttribute('aria-label')).toBe("Finals and SORs by work week, WW40'2026 to WW42'2026")
    fire(svg, new FocusEvent('focusin', { bubbles: true }))
    fire(svg, new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    expect(live.textContent).toBe("WW41'2026: 6 Finals, 3 SORs, 2 issues found")
    expect(svg.getAttribute('aria-label')).toBe("Finals and SORs by work week, WW40'2026 to WW42'2026")
  })

  it('adds the year to axis labels when the window spans years', () => {
    const spanning: WeekCounts[] = [
      { week: makeWorkWeek(2025, 52), finals: 2, sors: 1, issuesFound: 0 },
      { week: makeWorkWeek(2026, 1), finals: 3, sors: 1, issuesFound: 0 },
      { week: makeWorkWeek(2026, 2), finals: 4, sors: 2, issuesFound: 0 },
    ]
    view = draw({ weeks: spanning, selectedKey: spanning[2].week.key })
    expect(view.container.querySelector('.qaqc-axis-text.is-selected')?.textContent).toBe("WW02'26")
  })

  it('skips issue badges when bar slots are too narrow', () => {
    const many: WeekCounts[] = Array.from({ length: 120 }, (_, index) => ({
      week: makeWorkWeek(2024 + Math.floor(index / 52), (index % 52) + 1),
      finals: 2,
      sors: 1,
      issuesFound: index === 60 ? 1 : 0,
    }))
    view = draw({ weeks: many, selectedKey: many[119].week.key })
    expect(view.container.querySelectorAll('.qaqc-issue-badge')).toHaveLength(0)
  })
})
