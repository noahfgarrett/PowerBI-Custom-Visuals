import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ChartColors } from '../chartTypes'
import { SignoffBarChart, type SignoffBarChartProps } from '../components/SignoffBarChart'
import type { WeldWeekCounts } from '../types'
import { makeWorkWeek } from '../workWeeks'
import { render, type Rendered } from './render'

const COLORS: ChartColors = {
  series1: '#2E5AAC', series2: '#86B6EF', bad: '#D03B3B', warn: '#B45309', card: '#FDFEFF',
  grid: '#EBEEF3', axisText: '#6A7583', ink: '#1B2530', accent: '#2E5AAC',
}

function week(number: number, logged: number, signed: number, issues = 0): WeldWeekCounts {
  return { week: makeWorkWeek(2026, number), logged, signed, issues, signedInWeek: 0 }
}

const WEEKS: WeldWeekCounts[] = [week(40, 126, 46), week(41, 84, 67, 2), week(42, 20, 1)]

let view: Rendered | null = null

afterEach(() => {
  view?.unmount()
  view = null
})

function draw(overrides: Partial<SignoffBarChartProps> = {}): Rendered {
  return render(
    <SignoffBarChart
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

function element(root: HTMLElement, selector: string): Element {
  const found = root.querySelector(selector)
  if (!found) throw new Error(`${selector} missing`)
  return found
}

function manyWeeks(count: number, issueAt = -1): WeldWeekCounts[] {
  return Array.from({ length: count }, (_, index) => ({
    week: makeWorkWeek(2024 + Math.floor(index / 52), (index % 52) + 1),
    logged: 20,
    signed: 10,
    issues: index === issueAt ? 1 : 0,
    signedInWeek: 0,
  }))
}

describe('SignoffBarChart', () => {
  it('draws one hit area per week and a count badge on issue weeks', () => {
    view = draw()
    expect(view.container.querySelectorAll('.qaqc-hit')).toHaveLength(3)
    const badges = view.container.querySelectorAll('.qaqc-issue-badge')
    expect(badges).toHaveLength(1)
    expect(badges[0].textContent).toBe('2')
  })

  it('labels each week with its sign-off rate, using a decimal under 10%', () => {
    view = draw()
    const labels = [...view.container.querySelectorAll('.qaqc-rate-label')].map((node) => node.textContent)
    expect(labels).toEqual(['37%', '80%', '5.0%'])
  })

  it('colors rates under 10% red and the rest ink', () => {
    view = draw()
    const labels = [...view.container.querySelectorAll('.qaqc-rate-label')]
    expect(labels.map((node) => node.classList.contains('is-low'))).toEqual([false, false, true])
    expect(labels.map((node) => node.getAttribute('fill'))).toEqual([COLORS.ink, COLORS.ink, COLORS.bad])
  })

  it('keeps a 9.6% rate red and reads it as under 10%', () => {
    view = draw({ weeks: [week(41, 1000, 96)], selectedKey: 202641 })
    const label = element(view.container, '.qaqc-rate-label')
    expect(label.textContent).toBe('9.6%')
    expect(label.classList.contains('is-low')).toBe(true)
  })

  it('treats exactly 10% as meeting the baseline', () => {
    view = draw({ weeks: [week(41, 50, 5)], selectedKey: 202641 })
    const label = element(view.container, '.qaqc-rate-label')
    expect(label.textContent).toBe('10%')
    expect(label.classList.contains('is-low')).toBe(false)
  })

  it('draws a 10% tick inside each bar at a tenth of its total height', () => {
    view = draw()
    const ticks = [...view.container.querySelectorAll('.qaqc-baseline-tick')]
    expect(ticks).toHaveLength(3)
    // Plot runs from y 34 to 276 with a 0–150 scale, so WW40's 126 welds put the tick at 276 − 12.6 / 150 × 242.
    expect(Number(ticks[0].getAttribute('y1'))).toBeCloseTo(255.67, 2)
    expect(ticks[0].getAttribute('y1')).toBe(ticks[0].getAttribute('y2'))
  })

  it('draws the tick in card color over signed welds and in ink over unsigned ones', () => {
    view = draw()
    const strokes = [...view.container.querySelectorAll('.qaqc-baseline-tick')].map((node) => node.getAttribute('stroke'))
    expect(strokes).toEqual([COLORS.card, COLORS.card, COLORS.ink])
  })

  it('skips the rate label and tick for weeks with no welds', () => {
    view = draw({ weeks: [week(41, 84, 67), week(42, 0, 0)] })
    expect(view.container.querySelectorAll('.qaqc-rate-label')).toHaveLength(1)
    expect(view.container.querySelectorAll('.qaqc-baseline-tick')).toHaveLength(1)
  })

  it('hides rate labels when bands are narrower than 26 px', () => {
    // 558 px of plot across 30 weeks gives 18.6 px bands.
    const weeks = manyWeeks(30)
    view = draw({ weeks, selectedKey: weeks[29].week.key })
    expect(view.container.querySelectorAll('.qaqc-rate-label')).toHaveLength(0)
  })

  it('draws the signed portion inside the total bar', () => {
    view = draw({ weeks: [week(42, 20, 10)] })
    const fills = [...view.container.querySelectorAll('.qaqc-bar path, .qaqc-bar rect')].map((node) => node.getAttribute('fill'))
    expect(fills).toEqual([COLORS.series2, COLORS.series1])
  })

  it('draws a fully signed week as one rounded signed bar', () => {
    view = draw({ weeks: [week(42, 20, 20)] })
    const marks = [...view.container.querySelectorAll('.qaqc-bar path, .qaqc-bar rect')]
    expect(marks).toHaveLength(1)
    expect(marks[0].tagName.toLowerCase()).toBe('path')
    expect(marks[0].getAttribute('fill')).toBe(COLORS.series1)
  })

  it('labels the selected week in bold', () => {
    view = draw()
    expect(view.container.querySelector('.qaqc-axis-text.is-selected')?.textContent).toBe('WW42')
  })

  it('shades the selected band at its week', () => {
    view = draw()
    // Bands are (600 − 34 − 8) / 3 = 186 px wide, so WW42 starts at 34 + 2 × 186.
    expect(view.container.querySelector<SVGElement>('.qaqc-selected-band')?.style.transform).toBe('translateX(406px)')
  })

  it('selects a week on click when interactive', () => {
    const onSelectWeek = vi.fn()
    view = draw({ onSelectWeek })
    fire(element(view.container, '[data-week="202641"]'), new MouseEvent('click', { bubbles: true }))
    expect(onSelectWeek).toHaveBeenCalledWith(202641)
  })

  it('ignores clicks when interactions are off', () => {
    const onSelectWeek = vi.fn()
    view = draw({ onSelectWeek, interactive: false })
    fire(element(view.container, '[data-week="202641"]'), new MouseEvent('click', { bubbles: true }))
    expect(onSelectWeek).not.toHaveBeenCalled()
  })

  it('moves focus with arrow keys and selects with Enter or Space', () => {
    const onSelectWeek = vi.fn()
    view = draw({ onSelectWeek })
    const svg = element(view.container, 'svg')
    expect(svg.getAttribute('tabindex')).toBe('0')
    fire(svg, new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    fire(svg, new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(onSelectWeek).toHaveBeenLastCalledWith(202641)
    fire(svg, new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
    fire(svg, new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    expect(onSelectWeek).toHaveBeenLastCalledWith(202640)
  })

  it('shows the focus ring only after keyboard use', () => {
    view = draw()
    const svg = element(view.container, 'svg')
    fire(svg, new FocusEvent('focusin', { bubbles: true }))
    expect(view.container.querySelector('.qaqc-focus-ring')).toBeNull()
    fire(svg, new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    expect(view.container.querySelector('.qaqc-focus-ring')).not.toBeNull()
    fire(svg, new MouseEvent('mousedown', { bubbles: true }))
    expect(view.container.querySelector('.qaqc-focus-ring')).toBeNull()
  })

  it('reports hover details and clears them on leave', () => {
    const onHover = vi.fn()
    view = draw({ onHover })
    const hit = element(view.container, '[data-week="202641"]')
    fire(hit, new MouseEvent('mousemove', { bubbles: true, clientX: 10, clientY: 20 }))
    expect(onHover).toHaveBeenLastCalledWith({
      title: "WW41'2026",
      rows: [
        { label: 'Signed', value: '67 of 84' },
        { label: 'Sign-off %', value: '79.8%' },
        { label: 'Issues', value: '2' },
      ],
      clientX: 10,
      clientY: 20,
    })
    fire(hit, new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }))
    expect(onHover).toHaveBeenLastCalledWith(null)
  })

  it('reads n/a in the tooltip for a week with no welds', () => {
    const onHover = vi.fn()
    view = draw({ weeks: [week(42, 0, 0)], onHover })
    fire(element(view.container, '[data-week="202642"]'), new MouseEvent('mousemove', { bubbles: true }))
    expect(onHover.mock.lastCall?.[0]?.rows[1]).toEqual({ label: 'Sign-off %', value: 'n/a' })
  })

  it('announces the focused week through a live region and keeps a static label', () => {
    view = draw()
    const svg = element(view.container, 'svg')
    const live = element(view.container, '[aria-live="polite"]')
    expect(svg.getAttribute('aria-label')).toBe("Weld sign-offs by work week, WW40'2026 to WW42'2026")
    fire(svg, new FocusEvent('focusin', { bubbles: true }))
    fire(svg, new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    expect(live.textContent).toBe("WW41'2026: 67 of 84 welds signed (79.8%), 2 issues")
    expect(svg.getAttribute('aria-label')).toBe("Weld sign-offs by work week, WW40'2026 to WW42'2026")
  })

  it('adds the year to axis labels when the window spans years', () => {
    const spanning: WeldWeekCounts[] = [
      { ...week(52, 4, 1), week: makeWorkWeek(2025, 52) },
      week(1, 4, 1),
      week(2, 4, 1),
    ]
    view = draw({ weeks: spanning, selectedKey: spanning[2].week.key })
    expect(view.container.querySelector('.qaqc-axis-text.is-selected')?.textContent).toBe("WW02'26")
  })

  it('skips issue badges when bands are too narrow', () => {
    const weeks = manyWeeks(120, 60)
    view = draw({ weeks, selectedKey: weeks[119].week.key })
    expect(view.container.querySelectorAll('.qaqc-issue-badge')).toHaveLength(0)
  })

  it('labels each bar with signed / total when showValues is on', () => {
    view = draw({ showValues: true })
    const values = [...view.container.querySelectorAll('.qaqc-bar-value')].map((node) => node.textContent)
    expect(values).toEqual(['46 / 126', '67 / 84', '1 / 20'])
  })

  it('draws no value labels by default', () => {
    view = draw()
    expect(view.container.querySelectorAll('.qaqc-bar-value')).toHaveLength(0)
  })

  it('skips value labels that would not fit their band', () => {
    // 18.6 px bands cannot hold "10 / 20".
    const weeks = manyWeeks(30)
    view = draw({ weeks, selectedKey: weeks[29].week.key, showValues: true })
    expect(view.container.querySelectorAll('.qaqc-bar-value')).toHaveLength(0)
  })

  it('skips value labels for weeks with no welds', () => {
    view = draw({ weeks: [week(41, 0, 0), week(42, 4, 1)], showValues: true })
    expect([...view.container.querySelectorAll('.qaqc-bar-value')].map((node) => node.textContent)).toEqual(['1 / 4'])
  })

  it('stacks the rate label, badge, and value label above the bar without overlap', () => {
    view = draw({ weeks: [week(41, 84, 67, 2)], selectedKey: 202641, showValues: true })
    const rateY = Number(element(view.container, '.qaqc-rate-label').getAttribute('y'))
    const badgeY = Number(element(view.container, '.qaqc-issue-badge').getAttribute('transform')?.match(/translate\([\d.]+ ([\d.]+)\)/)?.[1])
    const valueY = Number(element(view.container, '.qaqc-bar-value').getAttribute('y'))
    expect(badgeY + 8).toBeLessThan(rateY - 8)
    expect(valueY).toBeLessThan(badgeY - 8)
  })

  it('keeps labels inside the chart when the tallest bar carries every label', () => {
    view = draw({ weeks: [week(41, 150, 20, 1), week(42, 3, 1)], selectedKey: 202641, showValues: true })
    const ys = [...view.container.querySelectorAll('.qaqc-rate-label, .qaqc-bar-value')].map((node) => Number(node.getAttribute('y')))
    for (const y of ys) expect(y).toBeGreaterThanOrEqual(10)
  })
})
