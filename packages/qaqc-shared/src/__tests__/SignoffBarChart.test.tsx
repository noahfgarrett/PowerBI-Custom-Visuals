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

// Geometry at 602 × 300: the plot spans x 44–554 and y 34–276 (242 px tall), so three weeks get 170 px bands
// centred at x 129, 299, and 469. The count axis runs 0–150 and the rate axis 0–100%.
const PLOT_BOTTOM = 276
const PLOT_HEIGHT = 242

function rateY(rate: number): number {
  return PLOT_BOTTOM - (rate / 100) * PLOT_HEIGHT
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
      width={602}
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

function texts(root: HTMLElement, selector: string): string[] {
  return [...root.querySelectorAll(selector)].map((node) => node.textContent ?? '')
}

function numberAttr(node: Element, name: string): number {
  return Number(node.getAttribute(name))
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

  it('draws the signed bar over the total bar', () => {
    view = draw({ weeks: [week(42, 20, 10)] })
    const fills = [...view.container.querySelectorAll('.qaqc-bar path')].map((node) => node.getAttribute('fill'))
    expect(fills).toEqual([COLORS.series2, COLORS.series1])
  })

  it('labels each bar with its total above it', () => {
    view = draw()
    expect(texts(view.container, '.qaqc-total-label')).toEqual(['126', '84', '20'])
  })

  it('labels the signed count inside a tall signed bar and above a short one', () => {
    view = draw()
    const labels = [...view.container.querySelectorAll('.qaqc-signed-label')]
    expect(labels.map((node) => node.textContent)).toEqual(['46', '67', '1'])
    expect(labels.map((node) => node.classList.contains('is-inside'))).toEqual([true, true, false])
    expect(labels.map((node) => node.getAttribute('fill'))).toEqual([COLORS.card, COLORS.card, COLORS.series1])
  })

  it('drops an outside signed label that would collide with the total label', () => {
    view = draw({ weeks: [week(41, 150, 15), week(42, 3, 3)] })
    expect(texts(view.container, '.qaqc-signed-label')).toEqual(['15'])
    expect(texts(view.container, '.qaqc-total-label')).toEqual(['150', '3'])
  })

  it('hides bar labels when bands are narrower than 18 px', () => {
    // 510 px of plot across 30 weeks gives 17 px bands.
    const weeks = manyWeeks(30)
    view = draw({ weeks, selectedKey: weeks[29].week.key })
    expect(view.container.querySelectorAll('.qaqc-total-label, .qaqc-signed-label')).toHaveLength(0)
  })

  it('draws a right axis from 0% to 100% in steps of 25', () => {
    view = draw()
    const ticks = [...view.container.querySelectorAll('.qaqc-rate-axis-text')]
    expect(ticks.map((node) => node.textContent)).toEqual(['0%', '25%', '50%', '75%', '100%'])
    expect(numberAttr(ticks[4], 'y')).toBeCloseTo(rateY(100) + 3.5, 6)
    expect(ticks.every((node) => node.getAttribute('fill') === COLORS.warn)).toBe(true)
  })

  it('titles both axes', () => {
    view = draw()
    expect(texts(view.container, '.qaqc-axis-title')).toEqual(['Weld count', 'Sign-off rate'])
  })

  it('draws the sign-off % as a smooth amber line through each week with welds', () => {
    view = draw()
    const line = element(view.container, '.qaqc-rate-line')
    expect(line.getAttribute('stroke')).toBe(COLORS.warn)
    expect(line.getAttribute('d')).toBe(
      'M129,187.65 C185.67,187.65 242.33,82.98 299,82.98 C355.67,82.98 412.33,263.9 469,263.9',
    )
  })

  it('draws one rate dot per week that has welds', () => {
    view = draw({ weeks: [week(40, 126, 46), week(41, 0, 0), week(42, 20, 1)] })
    const dots = [...view.container.querySelectorAll('.qaqc-rate-dot')]
    expect(dots.map((node) => numberAttr(node, 'cx'))).toEqual([129, 469])
    expect(view.container.querySelector('.qaqc-rate-line')?.getAttribute('d')?.match(/C/g)).toHaveLength(1)
  })

  it('draws a dashed red 10% baseline across the plot with a label', () => {
    view = draw()
    const baseline = element(view.container, '.qaqc-signoff-baseline')
    expect(numberAttr(baseline, 'y1')).toBeCloseTo(rateY(10), 6)
    expect(baseline.getAttribute('y2')).toBe(baseline.getAttribute('y1'))
    expect([numberAttr(baseline, 'x1'), numberAttr(baseline, 'x2')]).toEqual([44, 554])
    expect(baseline.getAttribute('stroke')).toBe(COLORS.bad)
    expect(element(view.container, '.qaqc-baseline-label').textContent).toBe('10% baseline')
  })

  it('no longer draws per-bar 10% ticks', () => {
    view = draw()
    expect(view.container.querySelectorAll('.qaqc-baseline-tick')).toHaveLength(0)
  })

  it('labels only the selected week rate by default', () => {
    view = draw()
    const labels = [...view.container.querySelectorAll('.qaqc-rate-label')]
    expect(labels.map((node) => node.textContent)).toEqual(['5%'])
    expect(numberAttr(labels[0], 'x')).toBe(469)
  })

  it('puts the selected rate label above its dot when that is clear', () => {
    view = draw({ selectedKey: 202641 })
    const label = element(view.container, '.qaqc-rate-label')
    expect(label.textContent).toBe('80%')
    expect(numberAttr(label, 'y')).toBeCloseTo(rateY((67 / 84) * 100) - 10, 6)
  })

  it('moves the selected rate label below its dot when above would hit the total label', () => {
    // WW41's 120 welds put its total label at y 77.4, and its 80% dot sits at y 82.4.
    view = draw({ weeks: [week(40, 150, 15), week(41, 120, 96)], selectedKey: 202641 })
    expect(numberAttr(element(view.container, '.qaqc-rate-label'), 'y')).toBeCloseTo(rateY(80) + 17, 6)
  })

  it('moves the rate label below its dot when above would hit the total label on a badged week', () => {
    // WW41's 100 welds put its total label at y 109.67 and its badge centre at 90.67; above its 64% dot the label would sit at 111.12.
    view = draw({ weeks: [week(40, 126, 46), week(41, 100, 64, 1)], selectedKey: 202641 })
    const labelY = numberAttr(element(view.container, '.qaqc-rate-label'), 'y')
    expect(labelY).toBeCloseTo(rateY(64) + 17, 6)
    const totalY = numberAttr(view.container.querySelectorAll('.qaqc-total-label')[1], 'y')
    expect(Math.abs(labelY - totalY)).toBeGreaterThanOrEqual(15)
  })

  it('moves the rate label below its dot when above would hit the 10% baseline label', () => {
    // Eight 63.75 px bands put the last dot at x 522, under the right-aligned "10% baseline" label.
    const weeks = [...Array.from({ length: 7 }, (_, index) => week(34 + index, 100, 50)), week(41, 100, 10)]
    view = draw({ weeks, selectedKey: 202641 })
    expect(numberAttr(element(view.container, '.qaqc-rate-label'), 'y')).toBeCloseTo(rateY(10) + 17, 6)
  })

  it('keeps a 10% rate label above its dot when the dot is clear of the baseline label', () => {
    const weeks = [week(34, 100, 10), ...Array.from({ length: 7 }, (_, index) => week(35 + index, 100, 50))]
    view = draw({ weeks, selectedKey: 202634 })
    expect(numberAttr(element(view.container, '.qaqc-rate-label'), 'y')).toBeCloseTo(rateY(10) - 10, 6)
  })

  it('does not dodge a total label that narrow bands leave undrawn', () => {
    // 17 px bands draw no total labels, so WW80's 80% label stays above its dot even though it sits at its bar top.
    const weeks: WeldWeekCounts[] = Array.from({ length: 30 }, (_, index) => ({
      week: makeWorkWeek(2026, index + 1),
      logged: index === 0 ? 150 : 120,
      signed: index === 0 ? 15 : 96,
      issues: 0,
      signedInWeek: 0,
    }))
    view = draw({ weeks, selectedKey: weeks[29].week.key })
    expect(numberAttr(element(view.container, '.qaqc-rate-label'), 'y')).toBeCloseTo(rateY(80) - 10, 6)
  })

  it('uses the side with more room when the label is crowded both above and below', () => {
    // WW41's 76% dot is at y 92.08. Above (82.08) is 8.6 px from its badge (90.67); below (109.08) is 0.6 px
    // from its total label (109.67). Above has more room.
    view = draw({ weeks: [week(40, 150, 15), week(41, 100, 76, 1)], selectedKey: 202641 })
    expect(numberAttr(element(view.container, '.qaqc-rate-label'), 'y')).toBeCloseTo(rateY(76) - 10, 6)
  })

  it('draws no rate label when the selected week has no welds', () => {
    view = draw({ weeks: [week(41, 84, 67), week(42, 0, 0)] })
    expect(view.container.querySelectorAll('.qaqc-rate-label')).toHaveLength(0)
  })

  it('labels every rate that fits its band when showValues is on', () => {
    view = draw({ showValues: true })
    expect(texts(view.container, '.qaqc-rate-label')).toEqual(['37%', '80%', '5%'])
  })

  it('keeps only the selected rate label when bands are too narrow, even with showValues', () => {
    const weeks = manyWeeks(30)
    view = draw({ weeks, selectedKey: weeks[29].week.key, showValues: true })
    expect(texts(view.container, '.qaqc-rate-label')).toEqual(['50%'])
  })

  it('stacks the issue badge above the total label', () => {
    view = draw({ weeks: [week(41, 84, 67, 2)], selectedKey: 202641 })
    const badgeY = Number(element(view.container, '.qaqc-issue-badge').getAttribute('transform')?.match(/translate\([\d.]+ ([\d.]+)\)/)?.[1])
    const totalY = numberAttr(element(view.container, '.qaqc-total-label'), 'y')
    expect(badgeY + 8).toBeLessThanOrEqual(totalY - 9)
  })

  it('keeps the badge and total label inside the chart on the tallest bar', () => {
    view = draw({ weeks: [week(41, 150, 20, 1), week(42, 3, 1)], selectedKey: 202641 })
    const badgeY = Number(element(view.container, '.qaqc-issue-badge').getAttribute('transform')?.match(/translate\([\d.]+ ([\d.]+)\)/)?.[1])
    expect(badgeY - 8).toBeGreaterThanOrEqual(0)
    expect(numberAttr(element(view.container, '.qaqc-total-label'), 'y')).toBeGreaterThanOrEqual(10)
  })

  it('labels the selected week in bold', () => {
    view = draw()
    expect(view.container.querySelector('.qaqc-axis-text.is-selected')?.textContent).toBe('WW42')
  })

  it('shades the selected band at its week', () => {
    view = draw()
    expect(view.container.querySelector<SVGElement>('.qaqc-selected-band')?.style.transform).toBe('translateX(384px)')
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
        { label: 'Issues created', value: '2' },
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
    expect(live.textContent).toBe("WW41'2026: 67 of 84 welds signed (79.8%), 2 issues created")
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

  it('draws an empty plot without a line or labels when there are no weeks', () => {
    view = draw({ weeks: [], selectedKey: 202642 })
    expect(view.container.querySelector('.qaqc-rate-line')?.getAttribute('d')).toBe('')
    expect(view.container.querySelectorAll('.qaqc-rate-dot, .qaqc-rate-label, .qaqc-hit')).toHaveLength(0)
  })
})
