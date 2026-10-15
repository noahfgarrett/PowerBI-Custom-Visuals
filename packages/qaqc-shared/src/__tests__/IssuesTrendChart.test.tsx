import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ChartColors } from '../chartTypes'
import { IssuesTrendChart, issueTrendLegend, type IssuesTrendChartProps } from '../components/IssuesTrendChart'
import type { IssueTrendPoint } from '../types'
import { makeWorkWeek } from '../workWeeks'
import { render, type Rendered } from './render'

const COLORS: ChartColors = {
  series1: '#2E5AAC', series2: '#86B6EF', good: '#0A7A0A', bad: '#D03B3B', warn: '#B45309', card: '#FDFEFF',
  grid: '#EBEEF3', axisText: '#6A7583', ink: '#1B2530', accent: '#2E5AAC',
}

// Geometry at 632 × 300: the plot spans x 44–584 (540 px) and y 26–276 (250 px tall).
// Three weeks get 180 px bands centred at x 134, 314 and 494. Each band holds a 35 px pair: a 16 px Opened bar,
// a 3 px gap, and a 16 px Closed bar, so the first band's bars start at x 116.5 and 135.5.
const WIDTH = 632
const HEIGHT = 300
const PLOT_TOP = 26
const PLOT_BOTTOM = 276
const PLOT_HEIGHT = 250

// Label metrics shared with the chart: 9.5 px bold digits are about 5.6 px wide, 7 px above the baseline and 2 below.
const CHAR_WIDTH = 5.6
const ASCENT = 7
const DESCENT = 2

function point(week: number, opened: number, closed: number, remainingOpen: number, year = 2026): IssueTrendPoint {
  return { week: makeWorkWeek(year, week), opened, closed, remainingOpen }
}

// Opened 3, 1, 3 and Closed 0, 1, 2 on a 0–3 axis. Remaining 3, 3, 4 on a 0–6 axis: the right axis takes the left
// axis's three steps, and 2 is the smallest nice step that reaches 4 in three.
const POINTS: IssueTrendPoint[] = [point(40, 3, 0, 3), point(41, 1, 1, 3), point(42, 3, 2, 4)]

let view: Rendered | null = null

afterEach(() => {
  view?.unmount()
  view = null
})

function draw(overrides: Partial<IssuesTrendChartProps> = {}): Rendered {
  return render(
    <IssuesTrendChart
      points={POINTS}
      selectedKey={202642}
      width={WIDTH}
      height={HEIGHT}
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

function element(root: ParentNode, selector: string): Element {
  const found = root.querySelector(selector)
  if (!found) throw new Error(`${selector} missing`)
  return found
}

function pressKeys(target: Element, keys: string[]): void {
  for (const key of keys) fire(target, new KeyboardEvent('keydown', { key, bubbles: true }))
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

function remainingY(value: number, max: number): number {
  return PLOT_BOTTOM - (value / max) * PLOT_HEIGHT
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
  return { text, left: x - width / 2, right: x + width / 2, top: y - ASCENT, bottom: y + DESCENT }
}

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
}

function collisions(root: ParentNode): Array<[string, string]> {
  const boxes = all(root, '.qaqc-trend-label').map(labelBox)
  const found: Array<[string, string]> = []
  boxes.forEach((a, i) => {
    boxes.slice(i + 1).forEach((b) => {
      if (overlaps(a, b)) found.push([a.text, b.text])
    })
  })
  return found
}

/** A seeded generator, so the random weeks are the same on every run. */
function seeded(seed: number): (limit: number) => number {
  let state = seed
  return (limit: number): number => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state % limit
  }
}

function randomPoints(count: number, maxPerWeek: number, seed: number): IssueTrendPoint[] {
  const next = seeded(seed)
  let remaining = next(40)
  return Array.from({ length: count }, (_, index) => {
    const opened = next(maxPerWeek + 1)
    const closed = Math.min(remaining + opened, next(maxPerWeek + 1))
    remaining += opened - closed
    return { week: makeWorkWeek(2020 + Math.floor(index / 52), (index % 52) + 1), opened, closed, remainingOpen: remaining }
  })
}

function steadyPoints(count: number): IssueTrendPoint[] {
  return Array.from({ length: count }, (_, index) => ({
    week: makeWorkWeek(2020 + Math.floor(index / 52), (index % 52) + 1),
    opened: 2,
    closed: 1,
    remainingOpen: 10 + index,
  }))
}

describe('IssuesTrendChart bars', () => {
  it('draws Opened in red and Closed in green side by side in each week, skipping zero counts', () => {
    view = draw()
    const bars = all(view.container, '.qaqc-trend-bar')
    expect(bars.map((bar) => bar.getAttribute('fill'))).toEqual([COLORS.bad, COLORS.bad, COLORS.good, COLORS.bad, COLORS.good])
    expect(all(view.container, '.qaqc-trend-bar.is-opened')).toHaveLength(3)
    expect(all(view.container, '.qaqc-trend-bar.is-closed')).toHaveLength(2)
  })

  it('puts the Opened bar left of the Closed bar, centred as a pair in the week', () => {
    view = draw({ points: [point(42, 2, 2, 4)] })
    // One week: a 540 px band, so the 35 px pair starts at 44 + (540 − 35) / 2 = 296.5.
    const [opened, closed] = all(view.container, '.qaqc-trend-bar').map((bar) => bar.getAttribute('d') ?? '')
    expect(opened).toMatch(/^M296\.5,276V/)
    expect(closed).toMatch(/^M315\.5,276V/)
  })

  it('draws bars on a nice count axis on the left, with gridlines', () => {
    view = draw()
    expect(texts(view.container, '.qaqc-count-axis-text')).toEqual(['0', '1', '2', '3'])
    expect(all(view.container, '.qaqc-grid-line')).toHaveLength(4)
  })

  it('labels every bar whose count is above 0', () => {
    view = draw()
    expect(texts(view.container, '.qaqc-bar-label')).toEqual(['3', '1', '1', '3', '2'])
  })

  it('puts a label inside the foot of a bar that is tall and wide enough, in card colour', () => {
    view = draw()
    const labels = all(view.container, '.qaqc-bar-label')
    expect(labels.every((label) => label.classList.contains('is-inside'))).toBe(true)
    expect(labels.every((label) => numberAttr(label, 'y') === PLOT_BOTTOM - 4)).toBe(true)
    expect(labels.every((label) => label.getAttribute('fill') === COLORS.card)).toBe(true)
  })

  it('puts the label above a bar too short to hold it, in the bar colour', () => {
    // 1 of 40 is a 6.25 px bar.
    view = draw({ points: [point(41, 40, 0, 4), point(42, 1, 0, 4)] })
    const label = all(view.container, '.qaqc-bar-label')[1]
    expect(label.classList.contains('is-inside')).toBe(false)
    expect(numberAttr(label, 'y')).toBeCloseTo(PLOT_BOTTOM - 6.25 - 4, 6)
    expect(label.getAttribute('fill')).toBe(COLORS.bad)
  })

  it('puts the label above a bar too narrow for its digits', () => {
    // "100" is about 16.8 px wide; the bar is 16 px.
    view = draw({ points: [point(42, 100, 10, 4)] })
    const [opened, closed] = all(view.container, '.qaqc-bar-label')
    expect(opened.classList.contains('is-inside')).toBe(false)
    expect(closed.classList.contains('is-inside')).toBe(true)
  })

  it('nudges the Closed label right when it would overlap an Opened label at the same height', () => {
    // 30 weeks give 18 px bands and 5.58 px bars 7.02 px apart, so two "12" labels (11.2 px) would overlap.
    const points = Array.from({ length: 30 }, (_, index) => point(index + 1, index === 29 ? 12 : 0, index === 29 ? 12 : 0, 5))
    view = draw({ points, selectedKey: points[29].week.key })
    const labels = all(view.container, '.qaqc-bar-label')
    expect(texts(view.container, '.qaqc-bar-label')).toEqual(['12', '12'])
    expect(overlaps(labelBox(labels[0]), labelBox(labels[1]))).toBe(false)
  })

  it('hides bar labels when bands are narrower than 18 px', () => {
    const points = steadyPoints(31)
    view = draw({ points, selectedKey: points[30].week.key })
    expect(all(view.container, '.qaqc-bar-label')).toHaveLength(0)
  })
})

describe('IssuesTrendChart remaining open line', () => {
  it('draws a smooth amber line through each week centre on its own right axis', () => {
    view = draw()
    const line = element(view.container, '.qaqc-remaining-line')
    expect(line.getAttribute('stroke')).toBe(COLORS.warn)
    // Remaining 3, 3, 4 on a 0–6 axis: y 151, 151, 109.33.
    expect(line.getAttribute('d')).toBe('M134,151 C194,151 254,151 314,151 C374,151 434,109.33 494,109.33')
  })

  it('fills a light area under the line down to the baseline', () => {
    view = draw()
    const area = element(view.container, '.qaqc-remaining-area')
    expect(area.getAttribute('d')).toBe('M134,151 C194,151 254,151 314,151 C374,151 434,109.33 494,109.33 L494,276 L134,276 Z')
    const fill = area.getAttribute('fill') ?? ''
    const gradient = view.container.querySelector(`linearGradient[id="${fill.slice(5, -1)}"]`)
    expect(gradient).not.toBeNull()
    expect(all(gradient ?? view.container, 'stop').map((stop) => stop.getAttribute('stop-color'))).toEqual([COLORS.warn, COLORS.warn])
  })

  it('gives each chart its own area gradient', () => {
    view = render(
      <>
        <IssuesTrendChart points={POINTS} selectedKey={202642} width={WIDTH} height={HEIGHT} colors={COLORS} interactive animate={false} describe onSelectWeek={vi.fn()} onHover={vi.fn()} />
        <IssuesTrendChart points={POINTS} selectedKey={202642} width={WIDTH} height={HEIGHT} colors={COLORS} interactive animate={false} describe showValues onSelectWeek={vi.fn()} onHover={vi.fn()} />
      </>,
    )
    const ids = all(view.container, 'linearGradient').map((gradient) => gradient.id)
    expect(new Set(ids).size).toBe(2)
  })

  it('labels the right axis in amber on a nice scale with as many steps as the left axis', () => {
    view = draw()
    const ticks = all(view.container, '.qaqc-remaining-axis-text')
    expect(ticks.map((tick) => tick.textContent)).toEqual(['0', '2', '4', '6'])
    expect(ticks.every((tick) => tick.getAttribute('fill') === COLORS.warn)).toBe(true)
  })

  it('puts every right axis label on a left axis gridline', () => {
    for (const points of [POINTS, randomPoints(30, 12, 3), randomPoints(52, 40, 4), [point(42, 0, 0, 0)]]) {
      view = draw({ points, selectedKey: points[points.length - 1].week.key })
      const gridYs = all(view.container, '.qaqc-grid-line').map((line) => numberAttr(line, 'y1'))
      const labelYs = all(view.container, '.qaqc-remaining-axis-text').map((tick) => numberAttr(tick, 'y') - 3.5)
      expect(labelYs).toHaveLength(gridYs.length)
      labelYs.forEach((y, index) => expect(y).toBeCloseTo(gridYs[index], 6))
      view.unmount()
      view = null
    }
  })

  it('titles both axes', () => {
    view = draw()
    expect(texts(view.container, '.qaqc-axis-title')).toEqual(['Issues per week', 'Remaining open'])
  })

  it('draws dots only on labelled points when bands are narrower than 12 px', () => {
    // 50 weeks give 10.8 px bands.
    const points = steadyPoints(50)
    view = draw({ points, selectedKey: points[49].week.key })
    expect(all(view.container, '.qaqc-remaining-dot')).toHaveLength(all(view.container, '.qaqc-remaining-label').length)
  })

  it('draws a dot at every week centre when bands are at least 12 px', () => {
    // 45 weeks give 12 px bands, centred at 44 + 6, 44 + 18, …
    const points = steadyPoints(45)
    view = draw({ points, selectedKey: points[44].week.key })
    const xs = all(view.container, '.qaqc-remaining-dot').map((dot) => numberAttr(dot, 'cx'))
    expect(xs).toEqual(points.map((_, index) => 44 + 12 * index + 6))
  })

  it('labels every third point and the last point', () => {
    const points = Array.from({ length: 11 }, (_, index) => point(index + 1, 0, 0, index + 1))
    view = draw({ points, selectedKey: points[10].week.key })
    expect(texts(view.container, '.qaqc-remaining-label')).toEqual(['1', '4', '7', '10', '11'])
  })

  it('puts a line label above its dot', () => {
    view = draw()
    const lineLabels = all(view.container, '.qaqc-remaining-label')
    const last = lineLabels[lineLabels.length - 1]
    expect(last.textContent).toBe('4')
    expect(numberAttr(last, 'y')).toBeCloseTo(remainingY(4, 6) - 7, 6)
  })

  it('moves a line label below its dot when above would hit a bar label', () => {
    // Four 135 px bands. Week 1's "100" sits above its full-height Opened bar at y 22, right where the "4" above
    // the week's dot (y 26) would go.
    const points = [point(1, 100, 0, 4), point(2, 0, 0, 0), point(3, 0, 0, 0), point(4, 0, 0, 1)]
    view = draw({ points, selectedKey: points[3].week.key })
    const first = all(view.container, '.qaqc-remaining-label')[0]
    expect(first.textContent).toBe('4')
    expect(numberAttr(first, 'y')).toBeCloseTo(remainingY(4, 4) + 14, 6)
    expect(texts(view.container, '.qaqc-bar-label')).toEqual(['100'])
    expect(collisions(view.container)).toEqual([])
  })

  it('always labels the last point', () => {
    const points = randomPoints(30, 12, 7)
    view = draw({ points, selectedKey: points[29].week.key })
    const lineLabels = all(view.container, '.qaqc-remaining-label')
    const last = lineLabels[lineLabels.length - 1]
    expect(last.textContent).toBe(String(points[29].remainingOpen))
    expect(numberAttr(last, 'x')).toBeCloseTo(44 + 29.5 * 18, 6)
  })

  it('labels every point that fits when showValues is on', () => {
    view = draw({ showValues: true })
    expect(texts(view.container, '.qaqc-remaining-label')).toEqual(['3', '3', '4'])
  })

  it('thins the showValues labels so they keep their spacing when bands are narrow', () => {
    // 60 weeks give 9 px bands, so only every 4th point (36 px apart) can carry a label.
    const points = steadyPoints(60)
    view = draw({ points, selectedKey: points[59].week.key, showValues: true })
    const xs = all(view.container, '.qaqc-remaining-label').map((label) => numberAttr(label, 'x'))
    expect(xs.length).toBeGreaterThan(10)
    // The last point is always labelled, so only the pair before it may sit closer.
    expect(xs.slice(1, -1).every((x, index) => x - xs[index] >= 26.9)).toBe(true)
  })
})

describe('IssuesTrendChart label collisions', () => {
  const shapes: Array<[string, number, number, number]> = [
    ['a few weeks', 3, 5, 11],
    ['the 30-week range', 30, 6, 12],
    ['the 30-week range with large counts', 30, 120, 13],
    ['a year', 52, 9, 14],
    ['the All range', 320, 15, 15],
    ['ten years', 520, 15, 16],
  ]
  const sizes: Array<[number, number]> = [[632, 300], [420, 180], [1200, 520]]
  const cases = shapes.flatMap(([name, count, maxPerWeek, seed]) => sizes.flatMap(([width, height]) =>
    [false, true].map((showValues) => ({ name, count, maxPerWeek, seed, width, height, showValues }))))

  it.each(cases)(
    'keeps every label clear of the others for $name at $width × $height (showValues $showValues)',
    ({ count, maxPerWeek, seed, width, height, showValues }) => {
      const points = randomPoints(count, maxPerWeek, seed + width)
      view = draw({ points, selectedKey: points[count - 1].week.key, width, height, showValues })
      expect(collisions(view.container)).toEqual([])
    },
  )

  it('keeps every label inside the plot and the chart', () => {
    for (const seed of [21, 22, 23]) {
      const points = randomPoints(30, 9, seed)
      view = draw({ points, selectedKey: points[29].week.key, showValues: true })
      const boxes = all(view.container, '.qaqc-trend-label').map(labelBox)
      expect(boxes.every((box) => box.left >= 0 && box.right <= WIDTH && box.top >= 0 && box.bottom <= PLOT_BOTTOM)).toBe(true)
      view.unmount()
      view = null
    }
  })
})

describe('IssuesTrendChart at the All range', () => {
  const points = steadyPoints(320)

  it('still draws both bars for every week', () => {
    view = draw({ points, selectedKey: points[319].week.key })
    expect(all(view.container, '.qaqc-trend-bar')).toHaveLength(640)
  })

  it('thins the line labels to stay readable', () => {
    view = draw({ points, selectedKey: points[319].week.key })
    const xs = all(view.container, '.qaqc-remaining-label').map((label) => numberAttr(label, 'x'))
    expect(xs.length).toBeLessThanOrEqual(Math.ceil(540 / 28) + 1)
    expect(xs.slice(1, -1).every((x, index) => x - xs[index] >= 26.9)).toBe(true)
  })

  it('draws dots only on labelled points', () => {
    view = draw({ points, selectedKey: points[319].week.key })
    expect(all(view.container, '.qaqc-remaining-dot')).toHaveLength(all(view.container, '.qaqc-remaining-label').length)
  })

  it('thins the week axis labels', () => {
    view = draw({ points, selectedKey: points[319].week.key })
    expect(all(view.container, '.qaqc-week-axis-text').length).toBeLessThanOrEqual(Math.floor(540 / 54) + 1)
  })
})

describe('IssuesTrendChart at 520 weeks', () => {
  // Ten years of weeks at the test size: 540 px of plot gives 1.04 px bands.
  const points = randomPoints(520, 15, 99)

  it('keeps the line labels at least 28 px apart', () => {
    view = draw({ points, selectedKey: points[519].week.key })
    expect(all(view.container, '.qaqc-remaining-label').length).toBeLessThanOrEqual(540 / 28 + 1)
  })

  it('draws no bar labels', () => {
    view = draw({ points, selectedKey: points[519].week.key, showValues: true })
    expect(all(view.container, '.qaqc-bar-label')).toHaveLength(0)
  })

  it('keeps the node count to about three per week', () => {
    // Two bars and one hit area per week, plus a bounded set of labels, ticks and axis text.
    view = draw({ points, selectedKey: points[519].week.key })
    expect(all(view.container, 'svg *').length).toBeLessThanOrEqual(3 * 520 + 150)
  })
})

describe('IssuesTrendChart selection and interaction', () => {
  it('shades the selected band at its week', () => {
    view = draw({ selectedKey: 202641 })
    expect(view.container.querySelector<SVGElement>('.qaqc-selected-band')?.style.transform).toBe('translateX(224px)')
  })

  it('labels the selected week in bold', () => {
    view = draw()
    expect(view.container.querySelector('.qaqc-week-axis-text.is-selected')?.textContent).toBe('WW42')
  })

  it('adds the year to week labels when the window spans years', () => {
    const points = [point(52, 1, 0, 1, 2025), point(1, 1, 0, 2), point(2, 1, 0, 3)]
    view = draw({ points, selectedKey: points[2].week.key })
    expect(view.container.querySelector('.qaqc-week-axis-text.is-selected')?.textContent).toBe("WW02'26")
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

  it('can take keyboard focus', () => {
    view = draw()
    expect(element(view.container, 'svg').getAttribute('tabindex')).toBe('0')
  })

  it('selects the week before the selected one with ArrowLeft then Enter', () => {
    const onSelectWeek = vi.fn()
    view = draw({ onSelectWeek })
    pressKeys(element(view.container, 'svg'), ['ArrowLeft', 'Enter'])
    expect(onSelectWeek).toHaveBeenLastCalledWith(202641)
  })

  it('selects the first week with Home then Space', () => {
    const onSelectWeek = vi.fn()
    view = draw({ onSelectWeek })
    pressKeys(element(view.container, 'svg'), ['Home', ' '])
    expect(onSelectWeek).toHaveBeenLastCalledWith(202640)
  })

  it('selects the last week with End then Enter', () => {
    const onSelectWeek = vi.fn()
    view = draw({ onSelectWeek, selectedKey: 202640 })
    pressKeys(element(view.container, 'svg'), ['End', 'Enter'])
    expect(onSelectWeek).toHaveBeenLastCalledWith(202642)
  })

  it('does not select with the keyboard when interactions are off', () => {
    const onSelectWeek = vi.fn()
    view = draw({ onSelectWeek, interactive: false })
    fire(element(view.container, 'svg'), new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(onSelectWeek).not.toHaveBeenCalled()
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

  it('reports the week, remaining, opened, and closed on hover and clears them on leave', () => {
    const onHover = vi.fn()
    view = draw({ onHover })
    const hit = element(view.container, '[data-week="202641"]')
    fire(hit, new MouseEvent('mousemove', { bubbles: true, clientX: 10, clientY: 20 }))
    expect(onHover).toHaveBeenLastCalledWith({
      title: "WW41'2026",
      rows: [
        { label: 'Remaining', value: '3' },
        { label: 'Opened', value: '1' },
        { label: 'Closed', value: '1' },
      ],
      clientX: 10,
      clientY: 20,
    })
    fire(hit, new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }))
    expect(onHover).toHaveBeenLastCalledWith(null)
  })

  it('enlarges the hovered week dot', () => {
    view = draw()
    fire(element(view.container, '[data-week="202641"]'), new MouseEvent('mousemove', { bubbles: true }))
    const hovered = element(view.container, '.qaqc-remaining-dot.is-hovered')
    expect([numberAttr(hovered, 'cx'), numberAttr(hovered, 'r')]).toEqual([314, 4.5])
  })

  it('announces the focused week through a live region and keeps a static label', () => {
    view = draw()
    const svg = element(view.container, 'svg')
    const live = element(view.container, '[aria-live="polite"]')
    expect(svg.getAttribute('aria-label')).toBe("Issues opened and closed by work week, WW40'2026 to WW42'2026")
    fire(svg, new FocusEvent('focusin', { bubbles: true }))
    fire(svg, new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    expect(live.textContent).toBe("WW41'2026: 1 opened, 1 closed, 3 remaining open")
    expect(svg.getAttribute('aria-label')).toBe("Issues opened and closed by work week, WW40'2026 to WW42'2026")
  })

  it('keeps a short label when not describing charts', () => {
    view = draw({ describe: false })
    expect(element(view.container, 'svg').getAttribute('aria-label')).toBe('Issues opened and closed by work week')
  })

  it('draws without errors or NaN when the chart is narrower and shorter than its margins', () => {
    view = draw({ width: 40, height: 30 })
    const html = view.container.innerHTML
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('Infinity')
    expect(all(view.container, '.qaqc-trend-label')).toHaveLength(0)
  })

  it('draws an empty plot without a line, labels, or hit areas when there are no weeks', () => {
    view = draw({ points: [] })
    expect(element(view.container, '.qaqc-remaining-line').getAttribute('d')).toBe('')
    expect(all(view.container, '.qaqc-trend-bar, .qaqc-remaining-dot, .qaqc-trend-label, .qaqc-hit')).toHaveLength(0)
  })
})

describe('issueTrendLegend', () => {
  it('keys Remaining Open as the amber line and Opened and Closed as red and green bars', () => {
    expect(issueTrendLegend(COLORS)).toEqual([
      { label: 'Remaining Open', color: COLORS.warn, shape: 'line' },
      { label: 'Opened', color: COLORS.bad, shape: 'bar' },
      { label: 'Closed', color: COLORS.good, shape: 'bar' },
    ])
  })
})
