import type { ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ChartColors } from '../chartTypes'
import { IssuesTrendChart } from '../components/IssuesTrendChart'
import { LineChart } from '../components/LineChart'
import { SignoffBarChart } from '../components/SignoffBarChart'
import { StackedBarChart } from '../components/StackedBarChart'
import { chartColorsFromTheme, resolveTheme } from '../theme'
import type { WorkWeek } from '../types'
import { enumerateWorkWeeks, makeWorkWeek } from '../workWeeks'
import { render, type Rendered } from './render'
import { ruleBody } from './stylesheet'

const COLORS: ChartColors = {
  series1: '#2E5AAC', series2: '#86B6EF', series3: '#1A9C7B', good: '#0A7A0A', bad: '#D03B3B', warn: '#B45309', card: '#FDFEFF',
  grid: '#EBEEF3', axisText: '#6A7583', ink: '#1B2530', accent: '#2E5AAC',
}

const HIGH_CONTRAST_COLORS = chartColorsFromTheme(resolveTheme({
  preset: 'qaqc',
  backgroundColor: '',
  backgroundOpacity: 100,
  cardOpacity: 100,
  highContrast: { foreground: '#FFFF00', background: '#000000', foregroundSelected: '#00FFFF' },
}))

// Text boxes from the stylesheet's font sizes: ascent 0.75 em, descent 0.25 em, and generous character widths.
const ASCENT = 0.75
const DESCENT = 0.25
const TICK_CHAR_EM = 0.75
const YEAR_CHAR_EM = 0.62

interface Box {
  left: number
  right: number
  top: number
  bottom: number
}

interface ChartCase {
  name: string
  draw: (weeks: WorkWeek[], width: number, height: number, colors: ChartColors) => ReactElement
}

const CHARTS: ChartCase[] = [
  {
    name: 'StackedBarChart',
    draw: (weeks, width, height, colors) => (
      <StackedBarChart
        weeks={weeks.map((week, index) => ({ week, finals: 2 + (index % 5), sors: index % 3, issuesFound: index % 7 === 0 ? 1 : 0 }))}
        selectedKey={weeks[weeks.length - 1].key}
        width={width}
        height={height}
        colors={colors}
        interactive
        animate={false}
        describe
        onSelectWeek={vi.fn()}
        onHover={vi.fn()}
      />
    ),
  },
  {
    name: 'SignoffBarChart',
    draw: (weeks, width, height, colors) => (
      <SignoffBarChart
        weeks={weeks.map((week, index) => ({ week, logged: 10 + (index % 9), signed: 5 + (index % 4), issues: index % 6 === 0 ? 1 : 0, signedInWeek: 3 }))}
        selectedKey={weeks[weeks.length - 1].key}
        width={width}
        height={height}
        colors={colors}
        interactive
        animate={false}
        describe
        onSelectWeek={vi.fn()}
        onHover={vi.fn()}
      />
    ),
  },
  {
    name: 'IssuesTrendChart',
    draw: (weeks, width, height, colors) => (
      <IssuesTrendChart
        points={weeks.map((week, index) => ({ week, opened: index % 4, closed: index % 3, remainingOpen: 10 + (index % 11) }))}
        selectedKey={weeks[weeks.length - 1].key}
        width={width}
        height={height}
        colors={colors}
        interactive
        animate={false}
        describe
        onSelectWeek={vi.fn()}
        onHover={vi.fn()}
      />
    ),
  },
  {
    name: 'LineChart',
    draw: (weeks, width, height, colors) => (
      <LineChart
        points={weeks.map((week, index) => ({ week, rate: 98 + (index % 3) / 2, cleanFinals: 9, totalFinals: 10, hadIssue: index % 8 === 0, issuesFound: 0 }))}
        selectedKey={weeks[weeks.length - 1].key}
        width={width}
        height={height}
        colors={colors}
        describe
        showWeekAxis
        onHover={vi.fn()}
      />
    ),
  },
]

let view: Rendered | null = null

afterEach(() => {
  view?.unmount()
  view = null
})

function fontSize(selector: string): number {
  const match = ruleBody(selector).match(/font-size:\s*([\d.]+)px/)
  if (!match) throw new Error(`${selector} has no font-size`)
  return Number(match[1])
}

function numberAttribute(node: Element, name: string): number {
  const value = node.getAttribute(name)
  if (value === null) throw new Error(`${name} missing`)
  return Number(value)
}

function ticks(container: HTMLElement): Element[] {
  return [...container.querySelectorAll('.qaqc-axis-text')]
    .filter((node) => node.textContent?.startsWith('WW') ?? false)
    .sort((a, b) => numberAttribute(a, 'x') - numberAttribute(b, 'x'))
}

function markers(container: HTMLElement): Element[] {
  return [...container.querySelectorAll('.qaqc-axis-year')].sort((a, b) => numberAttribute(a, 'x') - numberAttribute(b, 'x'))
}

function textBox(node: Element, size: number, charEm: number): Box {
  const x = numberAttribute(node, 'x')
  const y = numberAttribute(node, 'y')
  const halfWidth = ((node.textContent ?? '').length * size * charEm) / 2
  return { left: x - halfWidth, right: x + halfWidth, top: y - size * ASCENT, bottom: y + size * DESCENT }
}

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
}

describe('the year marker style', () => {
  it('is smaller than the week tick labels', () => {
    expect(fontSize('.qaqc-axis-year')).toBeLessThan(fontSize('.qaqc-axis-text'))
  })
})

describe.each(CHARTS)('$name year markers', ({ draw }) => {
  it('shows one 2026 marker for a 30-week window inside 2026', () => {
    view = render(draw(enumerateWorkWeeks(makeWorkWeek(2026, 10), makeWorkWeek(2026, 39)), 600, 300, COLORS))
    const found = markers(view.container)
    expect(found.map((node) => node.textContent)).toEqual(['2026'])
    expect(numberAttribute(found[0], 'x')).toBe(numberAttribute(ticks(view.container)[0], 'x'))
  })

  it('marks 2025 under the first tick and 2026 under the first 2026 tick across a year boundary', () => {
    view = render(draw(enumerateWorkWeeks(makeWorkWeek(2025, 40), makeWorkWeek(2026, 10)), 600, 300, COLORS))
    const shown = ticks(view.container)
    // Ticks from WW40 to WW52 are 2025, WW01 to WW10 are 2026.
    const first2026 = shown.find((node) => Number((node.textContent ?? '').slice(2)) <= 10)
    if (!first2026) throw new Error('no 2026 tick')
    const found = markers(view.container)
    expect(found.map((node) => node.textContent)).toEqual(['2025', '2026'])
    expect(found.map((node) => numberAttribute(node, 'x'))).toEqual([numberAttribute(shown[0], 'x'), numberAttribute(first2026, 'x')])
  })

  it('sits each marker below its tick label', () => {
    view = render(draw(enumerateWorkWeeks(makeWorkWeek(2025, 40), makeWorkWeek(2026, 10)), 600, 300, COLORS))
    const tickBottom = Math.max(...ticks(view.container).map((node) => textBox(node, fontSize('.qaqc-axis-text'), TICK_CHAR_EM).bottom))
    const found = markers(view.container)
    expect(found).toHaveLength(2)
    for (const marker of found) {
      expect(textBox(marker, fontSize('.qaqc-axis-year'), YEAR_CHAR_EM).top).toBeGreaterThan(tickBottom)
    }
  })

  it.each([
    ['a grid tile', 600, 300],
    ['an expanded chart', 1200, 420],
  ])('keeps the 520-week markers clear of each other and the ticks, and inside the chart, on %s', (_size, width, height) => {
    view = render(draw(enumerateWorkWeeks(makeWorkWeek(2016, 43), makeWorkWeek(2026, 42)), width, height, COLORS))
    const shownTicks = ticks(view.container)
    const tickBoxes = shownTicks.map((node) => textBox(node, fontSize('.qaqc-axis-text'), TICK_CHAR_EM))
    const found = markers(view.container)
    const markerBoxes = found.map((node) => textBox(node, fontSize('.qaqc-axis-year'), YEAR_CHAR_EM))
    expect(markerBoxes.length).toBeGreaterThanOrEqual(2)
    markerBoxes.forEach((box, index) => {
      expect(tickBoxes.some((tick) => overlaps(box, tick))).toBe(false)
      markerBoxes.slice(index + 1).forEach((other) => expect(overlaps(box, other)).toBe(false))
      expect(box.left).toBeGreaterThanOrEqual(0)
      expect(box.right).toBeLessThanOrEqual(width)
      expect(box.bottom).toBeLessThanOrEqual(height)
    })
  })

  it.each([
    ['a grid tile', 600, 300],
    ['an expanded chart', 1200, 420],
  ])('keeps a year marker on the rightmost tick inside the chart on %s', (_size, width, height) => {
    // Two years ending in WW02: the last tick is the first labelled tick of 2026.
    view = render(draw(enumerateWorkWeeks(makeWorkWeek(2024, 1), makeWorkWeek(2026, 2)), width, height, COLORS))
    const shownTicks = ticks(view.container)
    const lastTick = shownTicks[shownTicks.length - 1]
    const found = markers(view.container)
    const lastMarker = found[found.length - 1]
    expect(lastMarker.textContent).toBe('2026')
    expect(lastMarker.getAttribute('x')).toBe(lastTick.getAttribute('x'))
    const markerBox = textBox(lastMarker, fontSize('.qaqc-axis-year'), YEAR_CHAR_EM)
    expect(markerBox.left).toBeGreaterThanOrEqual(0)
    expect(markerBox.right).toBeLessThanOrEqual(width)
    const tickBox = textBox(lastTick, fontSize('.qaqc-axis-text'), TICK_CHAR_EM)
    expect(tickBox.right).toBeLessThanOrEqual(width)
  })

  it('draws markers in the muted axis colour', () => {
    view = render(draw(enumerateWorkWeeks(makeWorkWeek(2026, 10), makeWorkWeek(2026, 39)), 600, 300, COLORS))
    expect(markers(view.container)[0].getAttribute('fill')).toBe(COLORS.axisText)
  })

  it('draws markers in the foreground colour in high contrast', () => {
    view = render(draw(enumerateWorkWeeks(makeWorkWeek(2026, 10), makeWorkWeek(2026, 39)), 600, 300, HIGH_CONTRAST_COLORS))
    expect(markers(view.container)[0].getAttribute('fill')).toBe('#FFFF00')
  })
})
