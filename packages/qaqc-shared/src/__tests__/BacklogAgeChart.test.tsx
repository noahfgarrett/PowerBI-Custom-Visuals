import { afterEach, describe, expect, it, vi } from 'vitest'

import { BacklogAgeChart, backlogLegend, type BacklogAgeChartProps } from '../components/BacklogAgeChart'
import { agingProfile, type ProfilePoint } from '../issueBenchmarks'
import { makeWorkWeek } from '../workWeeks'
import { AGING_COLORS, agingIndex, all, click, fire, pressKey, textCollisions, texts, WW42 } from './agingFixture'
import { render, type Rendered } from './render'

const INDEX = agingIndex()
const RECENT = agingProfile(INDEX, { selectedKey: WW42, windowEndKey: WW42, range: 'recent', dateRange: null }, INDEX.today)

let view: Rendered | null = null

afterEach(() => {
  view?.unmount()
  view = null
})

function draw(overrides: Partial<BacklogAgeChartProps> = {}): Rendered {
  return render(
    <BacklogAgeChart
      points={RECENT}
      windowDays={81}
      selectedKey={WW42}
      width={600}
      height={280}
      colors={AGING_COLORS}
      onSelectWeek={vi.fn()}
      onHover={vi.fn()}
      {...overrides}
    />,
  )
}

/** Weeks from WW1'2017 on, a seeded rising median, and a few weeks with nothing open. */
function syntheticProfile(count: number): ProfilePoint[] {
  let state = 7
  return Array.from({ length: count }, (_, index) => {
    state = (state * 1103515245 + 12345) % 2147483648
    const week = makeWorkWeek(2017 + Math.floor(index / 52), (index % 52) + 1)
    if (index % 97 === 13) return { week, median: null, open: 0 }
    return { week, median: 20 + index * 0.7 + (state % 40), open: 10 + (state % 30) }
  })
}

function svg(root: ParentNode): SVGSVGElement {
  const found = root.querySelector<SVGSVGElement>('svg.qaqc-chart')
  if (!found) throw new Error('chart missing')
  return found
}

describe('BacklogAgeChart', () => {
  it('draws the median age as one line across the 30 weeks', () => {
    view = draw()
    expect(RECENT).toHaveLength(30)
    expect(all(view.container, '.qaqc-aging-backlog-line')).toHaveLength(1)
  })

  it('leaves a gap at weeks with no open issues', () => {
    const points = RECENT.map((point, index) => (index === 10 ? { ...point, median: null, open: 0 } : point))
    view = draw({ points })
    expect(all(view.container, '.qaqc-aging-backlog-line')).toHaveLength(2)
  })

  it('labels the last point with its median age', () => {
    view = draw()
    expect(texts(view.container, '.qaqc-aging-label.is-last')).toEqual(['462 d'])
  })

  it('draws the dashed normal close window line with its label', () => {
    view = draw()
    expect(view.container.querySelector('.qaqc-aging-window-line')?.getAttribute('stroke-dasharray')).toBe('5 4')
    expect(texts(view.container, '.qaqc-aging-label.is-window')).toEqual(['normal close window 81 d'])
  })

  it('draws no window line without a window', () => {
    view = draw({ windowDays: null })
    expect(view.container.querySelector('.qaqc-aging-window-line')).toBeNull()
    expect(view.container.querySelector('.qaqc-aging-label.is-window')).toBeNull()
  })

  it('marks the selected week on the week axis', () => {
    view = draw()
    expect(texts(view.container, '.qaqc-axis-text.is-selected')).toEqual(['WW42'])
  })

  it('shows the week, median age and open count in the tooltip', () => {
    const onHover = vi.fn()
    view = draw({ onHover })
    const hit = view.container.querySelector(`.qaqc-hit[data-week="${WW42}"]`)
    if (!hit) throw new Error('hit missing')
    fire(hit, new MouseEvent('mousemove', { bubbles: true, clientX: 1, clientY: 2 }))
    expect(onHover).toHaveBeenLastCalledWith({
      title: "WW42'2026",
      rows: [
        { label: 'Median age of open issues', value: '462 d' },
        { label: 'Open issues', value: '51' },
      ],
      clientX: 1,
      clientY: 2,
    })
  })

  it('selects a week on click', () => {
    const onSelectWeek = vi.fn()
    view = draw({ onSelectWeek })
    const hit = view.container.querySelector('.qaqc-hit[data-week="202640"]')
    if (!hit) throw new Error('hit missing')
    click(hit)
    expect(onSelectWeek).toHaveBeenCalledWith(202640)
  })

  it('selects the week before from the keyboard', () => {
    const onSelectWeek = vi.fn()
    view = draw({ onSelectWeek })
    pressKey(svg(view.container), 'ArrowLeft')
    pressKey(svg(view.container), 'Enter')
    expect(onSelectWeek).toHaveBeenCalledWith(202641)
  })

  it('keys the legend to the window', () => {
    expect(backlogLegend(AGING_COLORS, 81).map((item) => item.label)).toEqual(['Median age of open issues', 'Normal close window (81 d)'])
    expect(backlogLegend(AGING_COLORS, null).map((item) => item.label)).toEqual(['Median age of open issues'])
  })

  for (const count of [30, 520]) {
    for (const [width, height] of [[600, 280], [380, 220]] as const) {
      it(`draws no overlapping text with ${count} weeks at ${width} × ${height}`, () => {
        const points = syntheticProfile(count)
        view = draw({ points, selectedKey: points[count - 1].week.key, width, height })
        expect(textCollisions(view.container)).toEqual([])
        expect(texts(view.container, '.qaqc-aging-label.is-last')).toHaveLength(1)
      })
    }
  }

  it('moves the last label clear of the window label when the median sits on the window', () => {
    const points = RECENT.map((point) => ({ ...point, median: 81 }))
    view = draw({ points })
    expect(textCollisions(view.container)).toEqual([])
    expect(texts(view.container, '.qaqc-aging-label')).toEqual(['normal close window 81 d', '81 d'])
  })
})
