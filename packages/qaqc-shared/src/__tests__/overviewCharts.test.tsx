import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { LABEL_METRICS } from '../chartLabels'
import type { ChartColors } from '../chartTypes'
import {
  ActivityLinesChart,
  activityLegend,
  type ActivityLinesChartProps,
} from '../components/ActivityLinesChart'
import { LegendSwatch } from '../components/ChartPanel'
import { OverviewLinesChart, type WeekLine } from '../components/OverviewLinesChart'
import { OverviewWeekTable } from '../components/OverviewWeekTable'
import {
  QualityRatesChart,
  qualityRatesLegend,
  type QualityRatesChartProps,
} from '../components/QualityRatesChart'
import { Sparkline, type SparklineProps } from '../components/Sparkline'
import type { ActivityPoint, QualityRatePoint } from '../overview'
import { makeWorkWeek } from '../workWeeks'
import { render, type Rendered } from './render'

const COLORS: ChartColors = {
  series1: '#2E5AAC', series2: '#86B6EF', series3: '#1A9C7B', good: '#0A7A0A', bad: '#D03B3B', warn: '#B45309', card: '#FDFEFF',
  grid: '#EBEEF3', axisText: '#6A7583', ink: '#1B2530', accent: '#2E5AAC',
}

const WIDTH = 800
const HEIGHT = 420

const { charWidth: CHAR_WIDTH, ascent: ASCENT, descent: DESCENT } = LABEL_METRICS
/** Labels on one baseline keep at least twice this much space between them, so neighbours never read as one. */
const SIDE_GAP = 2

let view: Rendered | null = null

afterEach(() => {
  view?.unmount()
  view = null
})

function activity(week: number, electricalFinals: number, electricalSors: number, mechanicalFinals: number, mechanicalSors: number, year = 2026): ActivityPoint {
  return { week: makeWorkWeek(year, week), electricalFinals, electricalSors, mechanicalFinals, mechanicalSors }
}

function rates(week: number, inspection: [number, number] | null, welding: [number, number] | null, year = 2026): QualityRatePoint {
  // Each pair is [NCRs, total]; null means no finals (or welds) that week.
  const rateOf = (pair: [number, number] | null): number | null => (pair === null || pair[1] === 0 ? null : ((pair[1] - pair[0]) / pair[1]) * 100)
  return {
    week: makeWorkWeek(year, week),
    inspection: { rate: rateOf(inspection), ncrs: inspection?.[0] ?? 0, total: inspection?.[1] ?? 0 },
    welding: { rate: rateOf(welding), ncrs: welding?.[0] ?? 0, total: welding?.[1] ?? 0 },
  }
}

// The spec's chart spot checks: WW19 is Electrical 7 and Mechanical 3, WW22 is 6 and 1, WW23 is 5 and 5.
const ACTIVITY: ActivityPoint[] = [activity(19, 6, 1, 0, 3), activity(22, 6, 0, 1, 0), activity(23, 5, 0, 2, 3)]
const RATES: QualityRatePoint[] = [rates(19, [0, 6], [3, 53]), rates(22, [1, 7], [0, 29]), rates(23, [1, 7], [2, 86]), rates(42, [0, 3], null)]

function drawActivity(overrides: Partial<ActivityLinesChartProps> = {}): Rendered {
  return render(
    <ActivityLinesChart
      points={ACTIVITY}
      selectedKey={202623}
      width={WIDTH}
      height={HEIGHT}
      colors={COLORS}
      isHighContrast={false}
      interactive
      animate={false}
      describe
      onSelectWeek={vi.fn()}
      onHover={vi.fn()}
      {...overrides}
    />,
  )
}

function drawRates(overrides: Partial<QualityRatesChartProps> = {}): Rendered {
  return render(
    <QualityRatesChart
      points={RATES}
      selectedKey={202642}
      width={WIDTH}
      height={HEIGHT}
      colors={COLORS}
      isHighContrast={false}
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

function pressKeys(target: Element, keys: string[]): void {
  for (const key of keys) fire(target, new KeyboardEvent('keydown', { key, bubbles: true }))
}

function element(root: ParentNode, selector: string): Element {
  const found = root.querySelector(selector)
  if (!found) throw new Error(`${selector} missing`)
  return found
}

function all(root: ParentNode, selector: string): Element[] {
  return [...root.querySelectorAll(selector)]
}

function texts(root: ParentNode, selector: string): string[] {
  return all(root, selector).map((node) => node.textContent ?? '')
}

function numberAttr(node: Element, name: string): number {
  return Number(node.getAttribute(name))
}

interface Box {
  text: string
  left: number
  right: number
  top: number
  bottom: number
}

function labelBox(node: Element): Box {
  const text = node.textContent ?? ''
  const width = text.length * CHAR_WIDTH
  const x = numberAttr(node, 'x')
  const y = numberAttr(node, 'y')
  return { text, left: x - width / 2 - SIDE_GAP, right: x + width / 2 + SIDE_GAP, top: y - ASCENT, bottom: y + DESCENT }
}

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
}

function collisions(root: ParentNode): Array<[string, string]> {
  const boxes = all(root, '.qaqc-overview-label').map(labelBox)
  const found: Array<[string, string]> = []
  boxes.forEach((a, i) => {
    boxes.slice(i + 1).forEach((b) => {
      if (overlaps(a, b)) found.push([a.text, b.text])
    })
  })
  return found
}

/** The plot's edges, read from its gridlines: the lowest gridline is the baseline. */
function plotEdges(root: ParentNode): { left: number; bottom: number } {
  const lines = all(root, '.qaqc-grid-line')
  return { left: numberAttr(lines[0], 'x1'), bottom: Math.max(...lines.map((line) => numberAttr(line, 'y1'))) }
}

function labelsOutsidePlot(root: ParentNode, width: number): string[] {
  const { left, bottom } = plotEdges(root)
  return all(root, '.qaqc-overview-label')
    .map(labelBox)
    .filter((box) => box.left + SIDE_GAP < left || box.right - SIDE_GAP > width || box.top < 0 || box.bottom > bottom)
    .map((box) => box.text)
}

/** A seeded generator, so the random weeks are the same on every run. */
function seeded(seed: number): (limit: number) => number {
  let state = seed
  return (limit: number): number => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state % limit
  }
}

function weekAt(index: number): { year: number; week: number } {
  return { year: 2016 + Math.floor(index / 52), week: (index % 52) + 1 }
}

function randomActivity(count: number, maxPerWeek: number, seed: number): ActivityPoint[] {
  const next = seeded(seed)
  return Array.from({ length: count }, (_, index) => {
    const { year, week } = weekAt(index)
    return activity(week, next(maxPerWeek + 1), next(maxPerWeek + 1), next(maxPerWeek + 1), next(maxPerWeek + 1), year)
  })
}

/** Both lines on the same values, the worst case for their labels. */
function tiedActivity(count: number): ActivityPoint[] {
  return Array.from({ length: count }, (_, index) => {
    const { year, week } = weekAt(index)
    return activity(week, 4 + (index % 3), 0, 4 + (index % 3), 0, year)
  })
}

function randomRates(count: number, seed: number): QualityRatePoint[] {
  const next = seeded(seed)
  return Array.from({ length: count }, (_, index) => {
    const { year, week } = weekAt(index)
    const finals = next(5) === 0 ? 0 : next(30) + 1
    const welds = next(4) === 0 ? 0 : next(80) + 1
    return rates(week, [Math.min(finals, next(3)), finals], [Math.min(welds, next(4)), welds], year)
  })
}

function lineD(root: ParentNode, series: string): string[] {
  return all(root, `.qaqc-overview-line.is-${series}`).map((path) => path.getAttribute('d') ?? '')
}

/** The x of each point on a path: its move and every curve's end point. */
function pathXs(d: string): number[] {
  const xs: number[] = []
  const move = d.match(/^M([\d.-]+),/)
  if (move) xs.push(Number(move[1]))
  for (const curve of d.matchAll(/C[\d.,\s-]+? [\d.,-]+ ([\d.-]+),[\d.-]+/g)) xs.push(Number(curve[1]))
  return xs
}

function hitX(root: ParentNode, key: number): number {
  const hit = element(root, `.qaqc-hit[data-week="${key}"]`)
  return numberAttr(hit, 'x') + numberAttr(hit, 'width') / 2
}

/** Path coordinates are rounded to hundredths. */
function expectXs(actual: number[], expected: number[]): void {
  expect(actual).toHaveLength(expected.length)
  actual.forEach((x, index) => expect(x).toBeCloseTo(expected[index], 1))
}

const LABEL_SIZES: Array<[number, number]> = [[800, 420], [480, 240], [1300, 700]]

describe('ActivityLinesChart lines', () => {
  it('draws Electrical in series 1 and Mechanical in series 3', () => {
    view = drawActivity()
    expect(element(view.container, '.qaqc-overview-line.is-electrical').getAttribute('stroke')).toBe(COLORS.series1)
    expect(element(view.container, '.qaqc-overview-line.is-mechanical').getAttribute('stroke')).toBe(COLORS.series3)
  })

  it('draws each line as one smooth curve through its week centres', () => {
    view = drawActivity()
    for (const series of ['electrical', 'mechanical']) {
      const [d] = lineD(view.container, series)
      expect(lineD(view.container, series)).toHaveLength(1)
      expect(d.match(/C/g)).toHaveLength(2)
      expectXs(pathXs(d), [202619, 202622, 202623].map((key) => hitX(view?.container ?? document, key)))
    }
  })

  it('plots each discipline’s Finals + SORs', () => {
    view = drawActivity({ showValues: true })
    expect(texts(view.container, '.qaqc-overview-label.is-electrical')).toEqual(['7', '6', '5'])
    // WW23 is 5 on both lines, so its one label serves both.
    expect(texts(view.container, '.qaqc-overview-label.is-mechanical')).toEqual(['3', '1'])
  })

  it('draws a week with no inspections as a 0 point, not a break', () => {
    view = drawActivity({ points: [activity(40, 3, 1, 2, 0), activity(41, 0, 0, 0, 0), activity(42, 2, 2, 1, 1)], selectedKey: 202642 })
    const baseline = plotEdges(view.container).bottom
    for (const series of ['electrical', 'mechanical']) {
      expect(lineD(view.container, series)).toHaveLength(1)
      const zeroDot = element(view.container, `.qaqc-overview-dot.is-${series}[data-week="202641"]`)
      expect(numberAttr(zeroDot, 'cy')).toBeCloseTo(baseline, 6)
    }
  })

  it('draws solid lines outside high contrast', () => {
    view = drawActivity()
    expect(all(view.container, '.qaqc-overview-line[stroke-dasharray]')).toHaveLength(0)
  })

  it('dashes the Mechanical line in high contrast', () => {
    view = drawActivity({ isHighContrast: true })
    expect(element(view.container, '.qaqc-overview-line.is-mechanical').getAttribute('stroke-dasharray')).toBe('5 4')
    expect(element(view.container, '.qaqc-overview-line.is-electrical').hasAttribute('stroke-dasharray')).toBe(false)
  })

  it('dashes the legend key the same way as the line', () => {
    view = render(<LegendSwatch item={activityLegend(COLORS, true)[1]} />)
    expect(element(view.container, 'line').getAttribute('stroke-dasharray')).toBe('5 4')
  })

  it('draws a nice left axis with a gridline per tick', () => {
    // The highest total is 7, so the axis runs 0–8 in steps of 2.
    view = drawActivity()
    expect(texts(view.container, '.qaqc-overview-axis-text')).toEqual(['0', '2', '4', '6', '8'])
    expect(all(view.container, '.qaqc-grid-line')).toHaveLength(5)
  })

  it('titles the axis', () => {
    view = drawActivity()
    expect(texts(view.container, '.qaqc-axis-title')).toEqual(['Finals + SORs'])
  })

  it('draws a dot on every point when weeks are wide', () => {
    view = drawActivity()
    expect(all(view.container, '.qaqc-overview-dot:not(.is-hovered)')).toHaveLength(6)
  })

  it('draws dots only on labelled points and the selected week when weeks are narrow', () => {
    const points = randomActivity(520, 20, 5)
    view = drawActivity({ points, selectedKey: points[519].week.key })
    for (const series of ['electrical', 'mechanical']) {
      // A point both lines share carries one label, so any label marks the week.
      const labelled = new Set(all(view.container, '.qaqc-overview-label').map((label) => label.getAttribute('data-week')))
      labelled.add(String(points[519].week.key))
      const dots = all(view.container, `.qaqc-overview-dot.is-${series}:not(.is-hovered)`).map((dot) => dot.getAttribute('data-week'))
      expect(dots.length).toBeGreaterThan(0)
      expect(dots.every((week) => labelled.has(week))).toBe(true)
    }
  })
})

describe('ActivityLinesChart labels', () => {
  // Electrical 20 + index and Mechanical 2 or 3, far enough apart that no label is crowded out.
  const points = Array.from({ length: 10 }, (_, index) => activity(index + 30, 20 + index, 0, 2 + (index % 2), 0))

  it('labels the last point and the selected point on both lines', () => {
    view = drawActivity({ points, selectedKey: points[4].week.key })
    expect(texts(view.container, '.qaqc-overview-label.is-electrical')).toEqual(['24', '29'])
    expect(texts(view.container, '.qaqc-overview-label.is-mechanical')).toEqual(['2', '3'])
  })

  it('labels only the last point when it is selected', () => {
    view = drawActivity({ points, selectedKey: points[9].week.key })
    expect(texts(view.container, '.qaqc-overview-label')).toEqual(['29', '3'])
  })

  it('writes labels in ink, beside a dot in the line colour', () => {
    view = drawActivity({ points, selectedKey: points[9].week.key })
    expect(all(view.container, '.qaqc-overview-label').every((label) => label.getAttribute('fill') === COLORS.ink)).toBe(true)
  })

  it('labels every point that fits when showValues is on', () => {
    view = drawActivity({ points, selectedKey: points[9].week.key, showValues: true })
    expect(all(view.container, '.qaqc-overview-label.is-electrical')).toHaveLength(10)
  })

  it('thins the showValues labels on narrow weeks', () => {
    const many = randomActivity(200, 20, 8)
    view = drawActivity({ points: many, selectedKey: many[199].week.key, showValues: true })
    // Each line's labels keep at least 30 px between neighbours (the last label may sit closer to the one before it),
    // so a line carries at most one label per 30 px of plot, plus the last.
    const grid = element(view.container, '.qaqc-grid-line')
    const plotWidth = numberAttr(grid, 'x2') - numberAttr(grid, 'x1')
    const xs = all(view.container, '.qaqc-overview-label.is-electrical').map((label) => numberAttr(label, 'x')).sort((a, b) => a - b)
    expect(xs.length).toBeLessThanOrEqual(Math.floor(plotWidth / 30) + 1)
    expect(xs.length).toBeGreaterThanOrEqual(Math.floor(plotWidth / 90))
    expect(xs.slice(1, -1).every((x, index) => x - xs[index] >= 29.9)).toBe(true)
  })

  it('labels a point both lines share once', () => {
    view = drawActivity({ points: [activity(41, 3, 0, 3, 0), activity(42, 4, 0, 4, 0)], selectedKey: 202642 })
    expect(texts(view.container, '.qaqc-overview-label')).toEqual(['4'])
  })

  it('separates the two labels when both lines end close together', () => {
    view = drawActivity({ points: [activity(41, 3, 0, 3, 0), activity(42, 5, 0, 4, 0)], selectedKey: 202642 })
    expect(texts(view.container, '.qaqc-overview-label')).toEqual(['5', '4'])
    expect(collisions(view.container)).toEqual([])
  })

  const cases = [30, 520].flatMap((count) => LABEL_SIZES.flatMap(([width, height]) =>
    [false, true].flatMap((showValues) => ['random', 'tied'].map((data) => ({ count, width, height, showValues, data })))))

  it.each(cases)(
    'keeps $data labels clear of each other and inside the plot for $count weeks at $width × $height (showValues $showValues)',
    ({ count, width, height, showValues, data }) => {
      const series = data === 'tied' ? tiedActivity(count) : randomActivity(count, 25, count + width)
      // Select a week mid-range, so both the selected and the last labels are in play.
      view = drawActivity({ points: series, selectedKey: series[Math.floor(count / 2)].week.key, width, height, showValues })
      expect(all(view.container, '.qaqc-overview-label').length).toBeGreaterThanOrEqual(2)
      expect(collisions(view.container)).toEqual([])
      expect(labelsOutsidePlot(view.container, width)).toEqual([])
    },
  )
})

describe('ActivityLinesChart selection and interaction', () => {
  it('shades the selected week', () => {
    view = drawActivity({ selectedKey: 202622 })
    const band = element(view.container, '.qaqc-selected-band')
    const hit = element(view.container, '.qaqc-hit[data-week="202622"]')
    expect(band instanceof SVGElement ? band.style.transform : '').toBe(`translateX(${numberAttr(hit, 'x')}px)`)
  })

  it('draws no band when the selected week is not in the chart', () => {
    view = drawActivity({ selectedKey: 202650 })
    expect(view.container.querySelector('.qaqc-selected-band')).toBeNull()
  })

  it('selects a week on click when interactive', () => {
    const onSelectWeek = vi.fn()
    view = drawActivity({ onSelectWeek })
    fire(element(view.container, '[data-week="202622"].qaqc-hit'), new MouseEvent('click', { bubbles: true }))
    expect(onSelectWeek).toHaveBeenCalledWith(202622)
  })

  it('ignores clicks when interactions are off', () => {
    const onSelectWeek = vi.fn()
    view = drawActivity({ onSelectWeek, interactive: false })
    fire(element(view.container, '[data-week="202622"].qaqc-hit'), new MouseEvent('click', { bubbles: true }))
    expect(onSelectWeek).not.toHaveBeenCalled()
  })

  it('selects the week before with ArrowLeft then Enter', () => {
    const onSelectWeek = vi.fn()
    view = drawActivity({ onSelectWeek })
    pressKeys(element(view.container, 'svg'), ['ArrowLeft', 'Enter'])
    expect(onSelectWeek).toHaveBeenLastCalledWith(202622)
  })

  it('selects the first week with Home then Space, and the last with End then Enter', () => {
    const onSelectWeek = vi.fn()
    view = drawActivity({ onSelectWeek })
    const svg = element(view.container, 'svg')
    pressKeys(svg, ['Home', ' '])
    expect(onSelectWeek).toHaveBeenLastCalledWith(202619)
    pressKeys(svg, ['End', 'Enter'])
    expect(onSelectWeek).toHaveBeenLastCalledWith(202623)
  })

  it('does not select with the keyboard when interactions are off', () => {
    const onSelectWeek = vi.fn()
    view = drawActivity({ onSelectWeek, interactive: false })
    pressKeys(element(view.container, 'svg'), ['ArrowLeft', 'Enter'])
    expect(onSelectWeek).not.toHaveBeenCalled()
  })

  it('shows the focus ring only after keyboard use', () => {
    view = drawActivity()
    const svg = element(view.container, 'svg')
    fire(svg, new FocusEvent('focusin', { bubbles: true }))
    expect(view.container.querySelector('.qaqc-focus-ring')).toBeNull()
    fire(svg, new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    expect(view.container.querySelector('.qaqc-focus-ring')).not.toBeNull()
    fire(svg, new MouseEvent('mousedown', { bubbles: true }))
    expect(view.container.querySelector('.qaqc-focus-ring')).toBeNull()
  })

  it('reports the week, then each discipline’s Finals, SORs and total on hover, and clears them on leave', () => {
    const onHover = vi.fn()
    view = drawActivity({ onHover })
    const hit = element(view.container, '.qaqc-hit[data-week="202619"]')
    fire(hit, new MouseEvent('mousemove', { bubbles: true, clientX: 10, clientY: 20 }))
    expect(onHover).toHaveBeenLastCalledWith({
      title: "WW19'2026",
      rows: [
        { label: 'Electrical Finals', value: '6' },
        { label: 'Electrical SORs', value: '1' },
        { label: 'Electrical total', value: '7' },
        { label: 'Mechanical Finals', value: '0' },
        { label: 'Mechanical SORs', value: '3' },
        { label: 'Mechanical total', value: '3' },
      ],
      clientX: 10,
      clientY: 20,
    })
    fire(hit, new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }))
    expect(onHover).toHaveBeenLastCalledWith(null)
  })

  it('enlarges both dots of the hovered week', () => {
    view = drawActivity()
    fire(element(view.container, '.qaqc-hit[data-week="202622"]'), new MouseEvent('mousemove', { bubbles: true }))
    const hovered = all(view.container, '.qaqc-overview-dot.is-hovered')
    expect(hovered).toHaveLength(2)
    expectXs(hovered.map((dot) => numberAttr(dot, 'cx')), [202622, 202622].map((key) => hitX(view?.container ?? document, key)))
  })

  it('announces the focused week through a live region and keeps a static label', () => {
    view = drawActivity()
    const svg = element(view.container, 'svg')
    const live = element(view.container, '[aria-live="polite"]')
    const label = "Inspection activity by work week, WW19'2026 to WW23'2026"
    expect(svg.getAttribute('aria-label')).toBe(label)
    fire(svg, new FocusEvent('focusin', { bubbles: true }))
    fire(svg, new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
    expect(live.textContent).toBe("WW19'2026: Electrical 7 (6 Finals, 1 SOR), Mechanical 3 (0 Finals, 3 SORs)")
    expect(svg.getAttribute('aria-label')).toBe(label)
  })

  it('keeps a short label when not describing charts', () => {
    view = drawActivity({ describe: false })
    expect(element(view.container, 'svg').getAttribute('aria-label')).toBe('Inspection activity by work week')
  })

  it('bolds the selected week tick and marks the year under the first tick', () => {
    view = drawActivity()
    expect(element(view.container, '.qaqc-week-axis-text.is-selected').textContent).toBe('WW23')
    expect(texts(view.container, '.qaqc-axis-year')).toEqual(['2026'])
  })

  it('marks each new year on the week axis', () => {
    view = drawActivity({ points: [activity(51, 1, 0, 1, 0, 2025), activity(52, 1, 0, 1, 0, 2025), activity(1, 2, 0, 1, 0)], selectedKey: 202601 })
    expect(texts(view.container, '.qaqc-axis-year')).toEqual(['2025', '2026'])
  })

  it('shows an empty message when neither discipline has inspections in the range', () => {
    view = drawActivity({ points: [activity(41, 0, 0, 0, 0), activity(42, 0, 0, 0, 0)], selectedKey: 202642 })
    expect(view.container.querySelector('svg')).toBeNull()
    expect(element(view.container, '.qaqc-chart-empty').textContent).toBe('No Electrical or Mechanical inspections in this range')
  })

  it('shows the empty message when there are no weeks', () => {
    view = drawActivity({ points: [] })
    expect(view.container.innerHTML).not.toContain('NaN')
    expect(element(view.container, '.qaqc-chart-empty').textContent).toBe('No Electrical or Mechanical inspections in this range')
  })

  it('still draws a range where only one discipline has inspections', () => {
    view = drawActivity({ points: [activity(41, 0, 0, 0, 0), activity(42, 0, 0, 1, 0)], selectedKey: 202642 })
    expect(all(view.container, '.qaqc-overview-line')).toHaveLength(2)
  })

  it('draws without NaN or labels when the chart is smaller than its margins', () => {
    view = drawActivity({ width: 40, height: 30 })
    expect(view.container.innerHTML).not.toContain('NaN')
    expect(view.container.innerHTML).not.toContain('Infinity')
    expect(all(view.container, '.qaqc-overview-label')).toHaveLength(0)
  })

  it('keeps the node count to about one per week at 520 weeks', () => {
    const points = randomActivity(520, 20, 3)
    view = drawActivity({ points, selectedKey: points[519].week.key })
    expect(all(view.container, 'svg *').length).toBeLessThanOrEqual(520 + 160)
  })
})

describe('OverviewLinesChart hover', () => {
  function drawFrame(weeks: ReturnType<typeof makeWorkWeek>[], formatValue: (value: number) => string, formatTick: (value: number) => string): Rendered {
    const lines: WeekLine[] = [{ key: 'electrical', color: COLORS.series1, isDashed: false, values: weeks.map((_, index) => index + 1) }]
    return render(
      <OverviewLinesChart
        title="Test chart"
        axisTitle={null}
        weeks={weeks}
        lines={lines}
        scale={{ min: 0, max: 10, ticks: [0, 5, 10] }}
        formatTick={formatTick}
        formatValue={formatValue}
        tooltipRows={() => []}
        describeWeek={() => ''}
        selectedKey={weeks[weeks.length - 1].key}
        width={WIDTH}
        height={HEIGHT}
        colors={COLORS}
        interactive
        animate={false}
        describe
        showValues
        onSelectWeek={vi.fn()}
        onHover={vi.fn()}
      />,
    )
  }

  function hoverWeeks(root: ParentNode, keys: number[]): void {
    for (const key of keys) fire(element(root, `.qaqc-hit[data-week="${key}"]`), new MouseEvent('mousemove', { bubbles: true }))
  }

  it('does not rebuild the layout, the axis or the marks while the pointer moves', () => {
    const weeks = [40, 41, 42].map((week) => makeWorkWeek(2026, week))
    const formatValue = vi.fn((value: number) => String(value))
    const formatTick = vi.fn((value: number) => String(value))
    view = drawFrame(weeks, formatValue, formatTick)
    const [valueCalls, tickCalls] = [formatValue.mock.calls.length, formatTick.mock.calls.length]
    hoverWeeks(view.container, [202640, 202641, 202642])
    expect(all(view.container, '.qaqc-overview-dot.is-hovered')).toHaveLength(1)
    expect([formatValue.mock.calls.length, formatTick.mock.calls.length]).toEqual([valueCalls, tickCalls])
  })

  it('does not search the weeks for the selection while the pointer moves', () => {
    const weeks = [40, 41, 42].map((week) => makeWorkWeek(2026, week))
    const findIndex = vi.spyOn(weeks, 'findIndex')
    view = drawFrame(weeks, String, String)
    const calls = findIndex.mock.calls.length
    hoverWeeks(view.container, [202640, 202641, 202642])
    expect(findIndex.mock.calls.length).toBe(calls)
  })
})

describe('activityLegend', () => {
  it('keys Electrical and Mechanical as lines', () => {
    expect(activityLegend(COLORS, false)).toEqual([
      { label: 'Electrical', color: COLORS.series1, shape: 'line' },
      { label: 'Mechanical', color: COLORS.series3, shape: 'line' },
    ])
  })

  it('keys Mechanical as a dashed line in high contrast', () => {
    expect(activityLegend(COLORS, true)[1]).toEqual({ label: 'Mechanical', color: COLORS.series3, shape: 'dashed' })
  })
})

describe('QualityRatesChart lines', () => {
  it('draws the inspection rate in series 1 and the welding rate in series 3', () => {
    view = drawRates()
    expect(element(view.container, '.qaqc-overview-line.is-inspection').getAttribute('stroke')).toBe(COLORS.series1)
    expect(element(view.container, '.qaqc-overview-line.is-welding').getAttribute('stroke')).toBe(COLORS.series3)
  })

  it('breaks a line where its rate is null, as separate paths that never cross the gap', () => {
    const points = [rates(1, [0, 5], [0, 5]), rates(2, [1, 10], [0, 5]), rates(3, null, [0, 5]), rates(4, [0, 8], [0, 5]), rates(5, [1, 9], [0, 5])]
    view = drawRates({ points, selectedKey: points[4].week.key })
    const segments = lineD(view.container, 'inspection')
    const x = (index: number): number => hitX(view?.container ?? document, points[index].week.key)
    expect(segments).toHaveLength(2)
    expectXs(pathXs(segments[0]), [x(0), x(1)])
    expectXs(pathXs(segments[1]), [x(3), x(4)])
    expect(lineD(view.container, 'welding')).toHaveLength(1)
  })

  it('draws a dot for a point with no neighbours, so it does not vanish', () => {
    const points = Array.from({ length: 200 }, (_, index) => rates((index % 52) + 1, index === 100 ? [0, 4] : null, [0, 5], 2020 + Math.floor(index / 52)))
    view = drawRates({ points, selectedKey: points[199].week.key })
    expect(lineD(view.container, 'inspection').filter((d) => d.includes('C'))).toHaveLength(0)
    expect(all(view.container, `.qaqc-overview-dot.is-inspection[data-week="${points[100].week.key}"]`)).toHaveLength(1)
  })

  it('zooms the axis to the data instead of starting at 0%', () => {
    // Inspection 92.86–100%, welding 94.34–100%: one point below the lowest rate is 91%.
    const points = [rates(1, [1, 14], [3, 53]), rates(2, [0, 6], [0, 29])]
    view = drawRates({ points, selectedKey: points[1].week.key })
    expect(texts(view.container, '.qaqc-overview-axis-text')).toEqual(['91%', '95.5%', '100%'])
  })

  it('zooms over both rates', () => {
    const points = [rates(1, [0, 10], [10, 100]), rates(2, [0, 6], [0, 29])]
    view = drawRates({ points, selectedKey: points[1].week.key })
    expect(texts(view.container, '.qaqc-overview-axis-text')[0]).toBe('89%')
  })

  it('shows an empty message when every rate is null', () => {
    const points = [rates(1, null, null), rates(2, [0, 0], [0, 0])]
    view = drawRates({ points, selectedKey: points[1].week.key })
    expect(view.container.querySelector('svg')).toBeNull()
    expect(element(view.container, '.qaqc-chart-empty').textContent).toBe('No finals or welds in this range')
  })

  it('dashes the welding line in high contrast', () => {
    view = drawRates({ isHighContrast: true })
    expect(element(view.container, '.qaqc-overview-line.is-welding').getAttribute('stroke-dasharray')).toBe('5 4')
    expect(element(view.container, '.qaqc-overview-line.is-inspection').hasAttribute('stroke-dasharray')).toBe(false)
  })
})

describe('QualityRatesChart labels', () => {
  it('labels the last point of each line, the welding line ending before its gap week', () => {
    view = drawRates()
    expect(texts(view.container, '.qaqc-overview-label.is-inspection')).toEqual(['100%'])
    expect(texts(view.container, '.qaqc-overview-label.is-welding')).toEqual(['97.7%'])
  })

  it('labels the selected point too', () => {
    view = drawRates({ selectedKey: 202619 })
    expect(texts(view.container, '.qaqc-overview-label.is-welding')).toEqual(['94.3%', '97.7%'])
  })

  it('labels every point that fits when showValues is on', () => {
    view = drawRates({ showValues: true })
    // WW22 is 100% on the welding line only; WW19 and WW42 are 100% on the inspection line only.
    expect(texts(view.container, '.qaqc-overview-label.is-inspection')).toEqual(['100%', '85.7%', '85.7%', '100%'])
    expect(texts(view.container, '.qaqc-overview-label.is-welding')).toEqual(['94.3%', '100%', '97.7%'])
  })

  it('writes 100% without a decimal, so a run of perfect weeks stays short', () => {
    view = drawRates({ points: [rates(1, [0, 4], [0, 9]), rates(2, [0, 5], [1, 9])], selectedKey: 202602 })
    expect(texts(view.container, '.qaqc-overview-label')).toEqual(['100%', '88.9%'])
  })

  const cases = [30, 520].flatMap((count) => LABEL_SIZES.flatMap(([width, height]) =>
    [false, true].map((showValues) => ({ count, width, height, showValues }))))

  it.each(cases)(
    'keeps labels clear of each other and inside the plot for $count weeks at $width × $height (showValues $showValues)',
    ({ count, width, height, showValues }) => {
      const points = randomRates(count, count + width)
      view = drawRates({ points, selectedKey: points[Math.floor(count / 2)].week.key, width, height, showValues })
      expect(all(view.container, '.qaqc-overview-label').length).toBeGreaterThanOrEqual(2)
      expect(collisions(view.container)).toEqual([])
      expect(labelsOutsidePlot(view.container, width)).toEqual([])
    },
  )
})

describe('QualityRatesChart selection and interaction', () => {
  it('reports each rate with its counts on hover', () => {
    const onHover = vi.fn()
    view = drawRates({ onHover })
    fire(element(view.container, '.qaqc-hit[data-week="202623"]'), new MouseEvent('mousemove', { bubbles: true, clientX: 1, clientY: 2 }))
    expect(onHover).toHaveBeenLastCalledWith({
      title: "WW23'2026",
      rows: [
        { label: 'Inspection NCR pass rate', value: '85.7%' },
        { label: 'Inspection NCRs', value: '1 NCR of 7 finals' },
        { label: 'Welding NCR pass rate', value: '97.7%' },
        { label: 'Welding NCRs', value: '2 NCRs of 86 welds' },
      ],
      clientX: 1,
      clientY: 2,
    })
  })

  it('reports n/a for a week without welds', () => {
    const onHover = vi.fn()
    view = drawRates({ onHover })
    fire(element(view.container, '.qaqc-hit[data-week="202642"]'), new MouseEvent('mousemove', { bubbles: true }))
    const rows: unknown = onHover.mock.lastCall?.[0]?.rows
    expect(rows).toEqual([
      { label: 'Inspection NCR pass rate', value: '100.0%' },
      { label: 'Inspection NCRs', value: '0 NCRs of 3 finals' },
      { label: 'Welding NCR pass rate', value: 'n/a' },
      { label: 'Welding NCRs', value: 'No welds' },
    ])
  })

  it('selects with the keyboard and by click', () => {
    const onSelectWeek = vi.fn()
    view = drawRates({ onSelectWeek })
    pressKeys(element(view.container, 'svg'), ['ArrowLeft', 'Enter'])
    expect(onSelectWeek).toHaveBeenLastCalledWith(202623)
    fire(element(view.container, '.qaqc-hit[data-week="202619"]'), new MouseEvent('click', { bubbles: true }))
    expect(onSelectWeek).toHaveBeenLastCalledWith(202619)
  })

  it('shades the selected week', () => {
    view = drawRates({ selectedKey: 202622 })
    const band = element(view.container, '.qaqc-selected-band')
    const hit = element(view.container, '.qaqc-hit[data-week="202622"]')
    expect(band instanceof SVGElement ? band.style.transform : '').toBe(`translateX(${numberAttr(hit, 'x')}px)`)
  })

  it('announces the focused week through a live region and keeps a static label', () => {
    view = drawRates()
    const svg = element(view.container, 'svg')
    expect(svg.getAttribute('aria-label')).toBe("Quality rates by work week, WW19'2026 to WW42'2026")
    fire(svg, new FocusEvent('focusin', { bubbles: true }))
    fire(svg, new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
    expect(element(view.container, '[aria-live="polite"]').textContent).toBe(
      "WW42'2026: inspection NCR pass rate 100.0% (0 NCRs of 3 finals), welding NCR pass rate n/a (no welds)",
    )
  })
})

describe('qualityRatesLegend', () => {
  it('keys both rates as lines, dashing welding in high contrast', () => {
    expect(qualityRatesLegend(COLORS, false)).toEqual([
      { label: 'Inspection NCR pass rate', color: COLORS.series1, shape: 'line' },
      { label: 'Welding NCR pass rate', color: COLORS.series3, shape: 'line' },
    ])
    expect(qualityRatesLegend(COLORS, true)[1].shape).toBe('dashed')
  })
})

describe('Sparkline', () => {
  function drawSparkline(overrides: Partial<SparklineProps> = {}): Rendered {
    return render(<Sparkline values={[2, 5, 3, 8]} markIndex={3} width={120} height={28} color={COLORS.series1} ringColor={COLORS.card} {...overrides} />)
  }

  function polylinePoints(root: ParentNode): Array<[number, number]> {
    const line = root.querySelector('.qaqc-sparkline polyline')
    if (!line) return []
    return (line.getAttribute('points') ?? '').trim().split(/\s+/).map((pair): [number, number] => {
      const [x, y] = pair.split(',').map(Number)
      return [x, y]
    })
  }

  it('is a decorative SVG of the given size', () => {
    view = drawSparkline()
    const svg = element(view.container, 'svg.qaqc-sparkline')
    expect(svg.getAttribute('aria-hidden')).toBe('true')
    expect(svg.getAttribute('focusable')).toBe('false')
    expect([svg.getAttribute('width'), svg.getAttribute('height')]).toEqual(['120', '28'])
  })

  it('draws one polyline point per value, left to right, higher values nearer the top', () => {
    view = drawSparkline()
    const points = polylinePoints(view.container)
    expect(points).toHaveLength(4)
    expect(points.every(([x, y]) => x >= 0 && x <= 120 && y >= 0 && y <= 28)).toBe(true)
    expect(points.map(([x]) => x)).toEqual([...points.map(([x]) => x)].sort((a, b) => a - b))
    const ys = points.map(([, y]) => y)
    expect(Math.min(...ys)).toBe(ys[3])
    expect(Math.max(...ys)).toBe(ys[0])
  })

  it('marks the selected point', () => {
    view = drawSparkline({ markIndex: 1 })
    const mark = element(view.container, '.qaqc-sparkline-mark')
    const [x, y] = polylinePoints(view.container)[1]
    expect([numberAttr(mark, 'cx'), numberAttr(mark, 'cy')]).toEqual([x, y])
    expect(mark.getAttribute('fill')).toBe(COLORS.series1)
  })

  it('draws an all-zero series as a flat line along the bottom, without NaN', () => {
    view = drawSparkline({ values: [0, 0, 0] })
    expect(view.container.innerHTML).not.toContain('NaN')
    const ys = polylinePoints(view.container).map(([, y]) => y)
    expect(new Set(ys).size).toBe(1)
    expect(ys[0]).toBeGreaterThan(14)
  })

  it('draws a flat non-zero series across the middle', () => {
    view = drawSparkline({ values: [4, 4] })
    expect(polylinePoints(view.container).map(([, y]) => y)).toEqual([14, 14])
  })

  it('draws a single point as a centred mark, without NaN', () => {
    view = drawSparkline({ values: [5], markIndex: 0 })
    expect(view.container.innerHTML).not.toContain('NaN')
    expect(numberAttr(element(view.container, '.qaqc-sparkline-mark'), 'cx')).toBe(60)
  })

  it('draws nothing inside for an empty series, without NaN', () => {
    view = drawSparkline({ values: [], markIndex: -1 })
    expect(view.container.innerHTML).not.toContain('NaN')
    expect(all(view.container, '.qaqc-sparkline polyline, .qaqc-sparkline-mark')).toHaveLength(0)
  })

  it('leaves the mark off when the selected point is not in the series', () => {
    view = drawSparkline({ markIndex: 9 })
    expect(view.container.querySelector('.qaqc-sparkline-mark')).toBeNull()
  })
})

describe('OverviewWeekTable', () => {
  function headerCell(root: ParentNode, name: string): Element {
    const cell = all(root, 'thead th').find((item) => item.textContent === name)
    if (!cell) throw new Error(`header ${name} missing`)
    return cell
  }

  function sortBy(root: ParentNode, name: string): void {
    fire(element(headerCell(root, name), 'button'), new MouseEvent('click', { bubbles: true }))
  }

  function column(root: ParentNode, index: number): string[] {
    return all(root, 'tbody tr[aria-rowindex]').map((row) => row.children[index]?.textContent ?? '')
  }

  const activityRows = [activity(50, 9, 1, 0, 2, 2025), activity(51, 100, 0, 3, 0, 2025), activity(1, 10, 2, 1, 1), activity(2, 1200, 4, 0, 0)]

  it('shows the activity columns', () => {
    view = render(<OverviewWeekTable variant="activity" points={activityRows} />)
    expect(texts(view.container, 'thead th')).toEqual(['Week', 'Electrical Finals', 'Electrical SORs', 'Mechanical Finals', 'Mechanical SORs'])
  })

  it('lists the newest week first by default, by week and not by label text', () => {
    view = render(<OverviewWeekTable variant="activity" points={activityRows} />)
    expect(column(view.container, 0)).toEqual(["WW02'2026", "WW01'2026", "WW51'2025", "WW50'2025"])
    expect(headerCell(view.container, 'Week').getAttribute('aria-sort')).toBe('descending')
  })

  it('sorts a count column by value, largest first, then flips', () => {
    view = render(<OverviewWeekTable variant="activity" points={activityRows} />)
    sortBy(view.container, 'Electrical Finals')
    expect(column(view.container, 1)).toEqual(['1,200', '100', '10', '9'])
    sortBy(view.container, 'Electrical Finals')
    expect(column(view.container, 1)).toEqual(['9', '10', '100', '1,200'])
  })

  it('marks only the sorted column with aria-sort', () => {
    view = render(<OverviewWeekTable variant="activity" points={activityRows} />)
    sortBy(view.container, 'Mechanical SORs')
    expect(headerCell(view.container, 'Mechanical SORs').getAttribute('aria-sort')).toBe('descending')
    expect(headerCell(view.container, 'Week').hasAttribute('aria-sort')).toBe(false)
    sortBy(view.container, 'Mechanical SORs')
    expect(headerCell(view.container, 'Mechanical SORs').getAttribute('aria-sort')).toBe('ascending')
  })

  const rateRows = [rates(1, [1, 7], [2, 86]), rates(2, null, [0, 29]), rates(3, [0, 6], null), rates(4, [3, 14], [3, 53])]

  it('titles every header and cell with its full text, since windowed cells truncate', () => {
    view = render(<OverviewWeekTable variant="rates" points={rateRows} />)
    const cells = all(view.container, 'thead th, tbody tr[aria-rowindex] > *')
    expect(cells.length).toBeGreaterThan(5)
    expect(cells.every((cell) => cell.getAttribute('title') === cell.textContent)).toBe(true)
  })

  it('shows the rates columns, with counts as NCRs / total', () => {
    view = render(<OverviewWeekTable variant="rates" points={rateRows} />)
    expect(texts(view.container, 'thead th')).toEqual(['Week', 'Inspection rate', 'Inspection NCRs / Finals', 'Welding rate', 'Welding NCRs / Welds'])
    expect(all(view.container, 'tbody tr[aria-rowindex]')[0].textContent).toBe("WW04'202678.6%3 / 1494.3%3 / 53")
  })

  it('sorts n/a rates last in both directions', () => {
    view = render(<OverviewWeekTable variant="rates" points={rateRows} />)
    sortBy(view.container, 'Inspection rate')
    expect(column(view.container, 1)).toEqual(['100.0%', '85.7%', '78.6%', 'n/a'])
    sortBy(view.container, 'Inspection rate')
    expect(column(view.container, 1)).toEqual(['78.6%', '85.7%', '100.0%', 'n/a'])
  })

  it('sorts the counts column by NCRs, then by total', () => {
    view = render(<OverviewWeekTable variant="rates" points={rateRows} />)
    sortBy(view.container, 'Welding NCRs / Welds')
    expect(column(view.container, 4)).toEqual(['3 / 53', '2 / 86', '0 / 29', '0 / 0'])
  })

  it('renders only the rows near the viewport for a long range', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 800, 320))
    try {
      const many = randomActivity(320, 9, 2)
      view = render(<OverviewWeekTable variant="activity" points={many} />)
      expect(element(view.container, 'table').getAttribute('aria-rowcount')).toBe('321')
      expect(all(view.container, 'tbody tr[aria-rowindex]').length).toBeLessThan(60)
      expect(column(view.container, 0)[0]).toBe(many[319].week.label)
    } finally {
      vi.restoreAllMocks()
    }
  })
})
