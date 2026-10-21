import { afterEach, describe, expect, it, vi } from 'vitest'

import { labelBox } from '../chartLabels'
import { QuarterCloseChart, quarterLegend, type QuarterCloseChartProps } from '../components/QuarterCloseChart'
import { buildIssueBenchmarks, quarterMedians, type QuarterPoint } from '../issueBenchmarks'
import { buildIssueIndex } from '../issues'
import type { IssueColumns } from '../types'
import { AGING_COLORS, AGING_TODAY, agingIndex, all, fire, textBox, textCollisions, texts, WW42 } from './agingFixture'
import { ENRICHED_ISSUE_COLUMNS, ENRICHED_ISSUE_ROWS } from './fixtures/enrichedIssueRows'
import { render, type Rendered } from './render'

const INDEX = agingIndex()
const QUARTERS = quarterMedians(INDEX, WW42, INDEX.today)

let view: Rendered | null = null

afterEach(() => {
  view?.unmount()
  view = null
})

function draw(overrides: Partial<QuarterCloseChartProps> = {}): Rendered {
  return render(
    <QuarterCloseChart points={QUARTERS} typical={32} width={600} height={280} colors={AGING_COLORS} onHover={vi.fn()} {...overrides} />,
  )
}

/** Quarters from Q1'2017, seeded medians, and an empty quarter now and then. */
function syntheticQuarters(count: number): QuarterPoint[] {
  let state = 11
  return Array.from({ length: count }, (_, index) => {
    state = (state * 1103515245 + 12345) % 2147483648
    const key = 2017 * 4 + index
    const label = `Q${(key % 4) + 1}'${String(Math.floor(key / 4) % 100).padStart(2, '0')}`
    if (index % 9 === 4) return { key, label, median: null, closed: 0, slowest: null }
    const median = 5 + (state % 80) + (index % 2 === 0 ? 0.5 : 0)
    return { key, label, median, closed: 1 + (state % 120), slowest: median + (state % 50) }
  })
}

function quarterHit(root: ParentNode, label: string): Element {
  const found = all(root, '.qaqc-hit').find((node) => node.getAttribute('data-quarter') === label)
  if (!found) throw new Error(`${label} hit missing`)
  return found
}

describe('QuarterCloseChart', () => {
  it("labels each quarter's median days to close", () => {
    view = draw()
    expect(texts(view.container, '.qaqc-aging-label.is-median')).toEqual(['30 d', '19 d', '14 d', '22.5 d', '59 d', '13.5 d', '16 d', '32 d'])
  })

  it("keeps the newest quarter's median label inside the right edge of a narrow chart", () => {
    // The 382 px side panel at 1280 × 720: the newest bar's centred "41.5 d" would run past the plot's right edge.
    const width = 382
    const points = QUARTERS.map((point, index) => (index === QUARTERS.length - 1 ? { ...point, median: 41.5, closed: 6, slowest: 70 } : point))
    view = draw({ points, typical: 28.5, width, height: 190 })
    const labels = all(view.container, '.qaqc-aging-label.is-median')
    const newest = labels[labels.length - 1]
    expect(newest?.textContent).toBe('41.5 d')
    const box = labelBox('41.5 d', Number(newest?.getAttribute('x')), Number(newest?.getAttribute('y')))
    expect(box.right).toBeLessThanOrEqual(width - 8)
    expect(textCollisions(view.container)).toEqual([])
  })

  it('names every quarter under the axis, with its closed count', () => {
    view = draw()
    expect(texts(view.container, '.qaqc-aging-quarter')).toEqual(["Q4'24", "Q1'25", "Q2'25", "Q3'25", "Q4'25", "Q1'26", "Q2'26", "Q3'26", "Q4'26"])
    expect(texts(view.container, '.qaqc-aging-closed')).toEqual(['closed', '2', '3', '8', '32', '45', '10', '17', '9', '0'])
  })

  it('names all nine quarters and their closed counts in the 370 px side panel', () => {
    view = draw({ width: 370, height: 290 })
    expect(texts(view.container, '.qaqc-aging-quarter')).toHaveLength(9)
    expect(texts(view.container, '.qaqc-aging-empty-quarter text')).toEqual(['no', 'closures'])
    expect(textCollisions(view.container)).toEqual([])
  })

  it('colors quarters above typical warn and the rest good', () => {
    view = draw()
    const fills = all(view.container, '.qaqc-aging-quarter-bar').map((node) => node.getAttribute('fill'))
    const good = AGING_COLORS.good
    expect(fills).toEqual([good, good, good, good, AGING_COLORS.warn, good, good, good])
  })

  it('draws an empty dashed slot for a quarter with no closures', () => {
    view = draw()
    expect(all(view.container, '.qaqc-aging-empty-quarter')).toHaveLength(1)
    expect(texts(view.container, '.qaqc-aging-empty-quarter text')).toEqual(['no', 'closures'])
  })

  it('draws the typical line, labelled on the axis', () => {
    view = draw()
    expect(view.container.querySelector('.qaqc-aging-typical-line')).not.toBeNull()
    expect(texts(view.container, '.qaqc-aging-typical-tick')).toEqual(['typical'])
  })

  it('draws no typical line without a typical close time', () => {
    view = draw({ typical: null })
    expect(view.container.querySelector('.qaqc-aging-typical-line')).toBeNull()
  })

  it('drops the axis tick that the typical label would cover', () => {
    view = draw({ typical: 40 })
    expect(texts(view.container, '.qaqc-axis-text')).not.toContain('40 d')
    expect(textCollisions(view.container)).toEqual([])
  })

  it('shows the closed count, median, slowest and difference from typical in the tooltip', () => {
    const onHover = vi.fn()
    view = draw({ onHover })
    fire(quarterHit(view.container, "Q4'25"), new MouseEvent('mousemove', { bubbles: true, clientX: 3, clientY: 4 }))
    expect(onHover).toHaveBeenLastCalledWith({
      title: "Q4'25",
      rows: [
        { label: 'Closed', value: '45' },
        { label: 'Median days to close', value: '59 d' },
        { label: 'Slowest', value: `${QUARTERS[4].slowest} d` },
        { label: 'vs typical', value: '27 d slower than typical' },
      ],
      clientX: 3,
      clientY: 4,
    })
  })

  it('says how much faster than typical a quarter under typical closed', () => {
    const onHover = vi.fn()
    view = draw({ onHover })
    fire(quarterHit(view.container, "Q2'26"), new MouseEvent('mousemove', { bubbles: true }))
    expect(onHover.mock.lastCall?.[0].rows[3]).toEqual({ label: 'vs typical', value: '16 d faster than typical' })
  })

  it('keeps half days in the difference from typical', () => {
    const onHover = vi.fn()
    view = draw({ onHover })
    fire(quarterHit(view.container, "Q3'25"), new MouseEvent('mousemove', { bubbles: true }))
    expect(onHover.mock.lastCall?.[0].rows[3]).toEqual({ label: 'vs typical', value: '9.5 d faster than typical' })
  })

  it('says a quarter at typical is the same as typical', () => {
    const onHover = vi.fn()
    view = draw({ onHover })
    fire(quarterHit(view.container, "Q3'26"), new MouseEvent('mousemove', { bubbles: true }))
    expect(onHover.mock.lastCall?.[0].rows[3]).toEqual({ label: 'vs typical', value: 'same as typical' })
  })

  it('reads out each quarter, its median and its closed count to screen readers', () => {
    view = draw()
    expect(view.container.querySelector('svg')?.getAttribute('aria-label')).toBe(
      "Median days to close by calendar quarter, typical 32 d. Q4'24: 30 d, 2 closed; Q1'25: 19 d, 3 closed; "
        + "Q2'25: 14 d, 8 closed; Q3'25: 22.5 d, 32 closed; Q4'25: 59 d, 45 closed; Q1'26: 13.5 d, 10 closed; "
        + "Q2'26: 16 d, 17 closed; Q3'26: 32 d, 9 closed; Q4'26: no closures.",
    )
  })

  it('reads out only the heading without quarters', () => {
    view = draw({ points: [], typical: null })
    expect(view.container.querySelector('svg')?.getAttribute('aria-label')).toBe('Median days to close by calendar quarter.')
  })

  it('reads out the quarters without a typical close time', () => {
    view = draw({ points: QUARTERS.slice(0, 1), typical: null })
    expect(view.container.querySelector('svg')?.getAttribute('aria-label')).toBe("Median days to close by calendar quarter. Q4'24: 30 d, 2 closed.")
  })

  it('shows only the closed count for a quarter with no closures', () => {
    const onHover = vi.fn()
    view = draw({ onHover })
    fire(quarterHit(view.container, "Q4'26"), new MouseEvent('mousemove', { bubbles: true }))
    expect(onHover.mock.lastCall?.[0].rows).toEqual([{ label: 'Closed', value: '0' }])
  })

  it('keys the legend to typical', () => {
    expect(quarterLegend(AGING_COLORS, 32).map((item) => item.label)).toEqual(['At or under typical', 'Slower than typical', 'Typical 32 d'])
    expect(quarterLegend(AGING_COLORS, 22.5).map((item) => item.label)[2]).toBe('Typical 22.5 d')
  })

  describe('with the enriched export, whose newest quarter is tall and sits at the right edge', () => {
    const position = (name: (typeof ENRICHED_ISSUE_COLUMNS)[number]): number => ENRICHED_ISSUE_COLUMNS.indexOf(name)
    const columns: IssueColumns = {
      id: position('ID'),
      title: position('Title'),
      status: position('Status'),
      type: position('Type'),
      contractor: position('Contractor'),
      createdOn: position('Created on'),
      updatedOn: position('Updated on'),
      dueDate: position('Due date'),
      createdBy: position('Created by'),
      rootCause: position('Root cause'),
      rootCauseCategory: -1,
      bim360CreatedBy: position('BIM360_Created By'),
      bim360CreatedOn: position('BIM360_Created On'),
      bim360ClosedOn: position('BIM360_Closed On'),
      closedAt: position('Closed at'),
    }
    const index = buildIssueIndex(ENRICHED_ISSUE_ROWS, columns, AGING_TODAY)
    const points = quarterMedians(index, WW42, AGING_TODAY)
    const typical = buildIssueBenchmarks(index, WW42, AGING_TODAY).typical

    // The newest label, 41.5 d, is wider than its slot below about 394 px; from about 349 px every neighbouring pair of
    // labels fits side by side, so between them each bar can keep its label. The sizes: a narrower panel, the 370 px
    // side panel, and the chart as drawn on the 1280 × 720 dashboard's Issue Aging page.
    for (const [width, height] of [[355, 220], [370, 290], [382, 190]] as const) {
      it(`labels every bar, the newest included, inside the plot at ${width} × ${height}`, () => {
        view = draw({ points, typical, width, height })
        const grid = view.container.querySelector('.qaqc-grid-line')
        const plotLeft = Number(grid?.getAttribute('x1'))
        const plotRight = Number(grid?.getAttribute('x2'))
        const labels = all(view.container, '.qaqc-aging-label.is-median').map(textBox)
        expect(labels).toHaveLength(points.filter((point) => point.median !== null).length)
        const outside = labels.filter((box) => box.left < plotLeft || box.right > plotRight).map((box) => box.text)
        expect(outside).toEqual([])
        expect(textCollisions(view.container)).toEqual([])
      })
    }
  })

  // 30 weeks span 8 or 9 quarters; 520 weeks span 40.
  for (const count of [9, 40]) {
    for (const [width, height] of [[600, 280], [380, 220]] as const) {
      it(`draws no overlapping text with ${count} quarters at ${width} × ${height}`, () => {
        view = draw({ points: syntheticQuarters(count), width, height })
        expect(textCollisions(view.container)).toEqual([])
        const names = texts(view.container, '.qaqc-aging-quarter')
        expect(names[names.length - 1]).toBe(syntheticQuarters(count)[count - 1].label)
      })
    }
  }
})
