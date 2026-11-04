import { describe, expect, it } from 'vitest'

import type { IssueColumns, IssueIndex, ViewState } from '../types'
import type { IssueBenchmarks } from '../issueBenchmarks'
import { ageBuckets, agingProfile, buildIssueBenchmarks, endOfWeek, median, quantile, quarterMedians } from '../issueBenchmarks'
import { buildIssueIndex } from '../issues'
import { makeWorkWeek } from '../workWeeks'

const COLUMNS: IssueColumns = {
  id: 0,
  title: 1,
  status: 2,
  type: 3,
  contractor: 4,
  createdOn: 5,
  updatedOn: 6,
  dueDate: 7,
  createdBy: 8,
  rootCause: 9,
  rootCauseCategory: 10,
}
const TODAY = new Date(2026, 9, 15) // Thursday of WW42'2026
const WW41 = 202641
const WW42 = 202642

type Cell = string | null

/** An included issue. Dates are ISO text; `closedOn` makes it Closed with that Updated On. */
function issue(id: string, createdOn: string, closedOn: Cell = null, status = closedOn === null ? 'Open' : 'Closed'): Cell[] {
  return [id, `Issue ${id}`, status, 'COR', 'Bayside', createdOn, closedOn, null, 'LotusWorks', null, null]
}

function indexOf(rows: Cell[][]): IssueIndex {
  return buildIssueIndex(rows, COLUMNS, TODAY)
}

/** ISO date `days` before 2026-10-15. */
function daysBefore(days: number): string {
  const date = new Date(2026, 9, 15 - days, 12)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

describe('quantile', () => {
  const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

  it('takes the nearest rank', () => {
    expect(quantile(values, 0.9)).toBe(9)
    expect(quantile(values, 0.5)).toBe(5)
    expect(quantile(values, 0.25)).toBe(3)
  })

  it('gives the maximum at p = 1 and the minimum at p = 0', () => {
    expect(quantile(values, 1)).toBe(10)
    expect(quantile(values, 0)).toBe(1)
  })

  it('gives the only value of a single-value list', () => {
    expect(quantile([42], 0.9)).toBe(42)
  })

  it('is null for an empty list', () => {
    expect(quantile([], 0.5)).toBeNull()
  })
})

describe('median', () => {
  it('takes the middle value of an odd-length list', () => {
    expect(median([1, 3, 10])).toBe(3)
  })

  it('averages the two middle values of an even-length list', () => {
    expect(median([10, 13, 14, 20])).toBe(13.5)
  })

  it('is null for an empty list', () => {
    expect(median([])).toBeNull()
  })
})

describe('endOfWeek', () => {
  it('is the Sunday of a past week', () => {
    expect(endOfWeek(makeWorkWeek(2026, 41), TODAY)).toEqual(new Date(2026, 9, 11, 12))
  })

  it('is capped at today for the running week', () => {
    expect(endOfWeek(makeWorkWeek(2026, 42), TODAY)).toEqual(new Date(2026, 9, 15, 12))
  })

  it('crosses the year boundary for week 1 and week 53', () => {
    expect(endOfWeek(makeWorkWeek(2026, 1), TODAY)).toEqual(new Date(2026, 0, 4, 12))
    expect(endOfWeek(makeWorkWeek(2020, 53), TODAY)).toEqual(new Date(2021, 0, 3, 12))
  })
})

describe('buildIssueBenchmarks', () => {
  it('counts an issue closed after W as open as of W, aged to the end of W', () => {
    const index = indexOf([issue('#1', '2026-10-01', '2026-10-13')])
    const benchmarks = buildIssueBenchmarks(index, WW41, TODAY)
    expect(benchmarks.closures).toBe(0)
    expect(benchmarks.open.map((open) => [open.issue.id, open.age])).toEqual([['#1', 10]])
  })

  it('counts a closure on the last day of W', () => {
    const index = indexOf([issue('#1', '2026-10-01', '2026-10-11')])
    expect(buildIssueBenchmarks(index, WW41, TODAY).closures).toBe(1)
  })

  it('leaves out issues created after W', () => {
    const index = indexOf([issue('#1', '2026-10-12'), issue('#2', '2026-10-11')])
    expect(buildIssueBenchmarks(index, WW41, TODAY).open.map((open) => open.issue.id)).toEqual(['#2'])
  })

  it('takes typical, window and slowest from the times to close', () => {
    // Close times 1 to 10 days.
    const rows = Array.from({ length: 10 }, (_, at) => issue(`#${at + 1}`, '2026-09-01', `2026-09-${String(2 + at).padStart(2, '0')}`))
    const benchmarks = buildIssueBenchmarks(indexOf(rows), WW42, TODAY)
    expect(benchmarks.closures).toBe(10)
    expect(benchmarks.typical).toBe(5.5)
    expect(benchmarks.window).toBe(9)
    expect(benchmarks.slowest).toBe(10)
  })

  it('counts a Closed issue without an Updated On as open and leaves it out of close times', () => {
    const index = indexOf([issue('#1', '2026-10-01', null, 'Closed'), issue('#2', '2026-10-01', '2026-10-05')])
    const benchmarks = buildIssueBenchmarks(index, WW42, TODAY)
    expect(benchmarks.closures).toBe(1)
    expect(benchmarks.closedWithoutDate).toBe(1)
    expect(benchmarks.open.map((open) => open.issue.id)).toEqual(['#1'])
  })

  it('counts only issues strictly older than the window as past it', () => {
    // Close times 1 to 10 days: window 9, slowest 10.
    const closed = Array.from({ length: 10 }, (_, at) => issue(`#${at + 1}`, '2026-09-01', `2026-09-${String(2 + at).padStart(2, '0')}`))
    const open = [issue('#20', daysBefore(9)), issue('#21', daysBefore(10)), issue('#22', daysBefore(11))]
    const benchmarks = buildIssueBenchmarks(indexOf([...closed, ...open]), WW42, TODAY)
    expect(benchmarks.pastWindow).toBe(2)
    expect(benchmarks.olderThanAny).toBe(1)
  })

  it('gives each open issue its age as a multiple of the window', () => {
    const rows = [issue('#1', '2026-10-01', '2026-10-11'), issue('#2', daysBefore(25))]
    const [open] = buildIssueBenchmarks(indexOf(rows), WW42, TODAY).open
    expect(open.timesWindow).toBe(2.5)
  })

  it('has no benchmarks and nothing past the window without closures', () => {
    const benchmarks = buildIssueBenchmarks(indexOf([issue('#1', daysBefore(400))]), WW42, TODAY)
    expect(benchmarks).toMatchObject({ closures: 0, typical: null, window: null, slowest: null, pastWindow: 0, olderThanAny: 0 })
    expect(benchmarks.open[0].timesWindow).toBeNull()
  })

  it('ages issues to today, not the Sunday, in the running week', () => {
    const [open] = buildIssueBenchmarks(indexOf([issue('#1', '2026-10-12')]), WW42, TODAY).open
    expect(open.age).toBe(3)
  })

  it('lists open issues oldest first, ties by ID ascending', () => {
    const rows = [issue('#10', '2026-10-05'), issue('#9', '2026-10-05'), issue('#100', '2026-09-01'), issue('#11', '2026-10-10')]
    const benchmarks = buildIssueBenchmarks(indexOf(rows), WW42, TODAY)
    expect(benchmarks.open.map((open) => open.issue.id)).toEqual(['#100', '#9', '#10', '#11'])
  })

  it('takes the median open age', () => {
    const rows = [issue('#1', daysBefore(10)), issue('#2', daysBefore(20)), issue('#3', daysBefore(31)), issue('#4', daysBefore(50))]
    expect(buildIssueBenchmarks(indexOf(rows), WW42, TODAY).medianOpenAge).toBe(25.5)
  })

  it('compares the open count with the week before', () => {
    const rows = [issue('#1', '2026-10-01'), issue('#2', '2026-10-13'), issue('#3', '2026-10-14'), issue('#4', '2026-10-02', '2026-10-13')]
    const benchmarks = buildIssueBenchmarks(indexOf(rows), WW42, TODAY)
    expect(benchmarks.open).toHaveLength(3)
    expect(benchmarks.openDelta).toBe(1)
  })

  it('falls back to the last week for an unknown week key', () => {
    const benchmarks = buildIssueBenchmarks(indexOf([issue('#1', '2026-10-01')]), 190001, TODAY)
    expect(benchmarks.asOf.key).toBe(WW42)
  })

  it('has no open issues and no median age for an empty index', () => {
    const benchmarks = buildIssueBenchmarks(indexOf([]), WW42, TODAY)
    expect(benchmarks.open).toEqual([])
    expect(benchmarks.medianOpenAge).toBeNull()
  })
})

/** Benchmarks with open issues of the given ages and the given window. */
function withAges(ages: number[], window: number | null): IssueBenchmarks {
  const rows = ages.map((age, at) => issue(`#${at + 1}`, daysBefore(age)))
  return { ...buildIssueBenchmarks(indexOf(rows), WW42, TODAY), window }
}

describe('ageBuckets', () => {
  it('adds the window edge to the month buckets', () => {
    const buckets = ageBuckets(withAges([], 77))
    expect(buckets.map((bucket) => bucket.label)).toEqual([
      'Under 1 month',
      '1 month – 77 days',
      '78 days – 3 months',
      '3–6 months',
      '6–12 months',
      '12+ months',
    ])
    expect(buckets.map((bucket) => bucket.range)).toEqual(['0–29 days', '30–77 days', '78–89 days', '90–179 days', '180–364 days', '365+ days'])
    expect(buckets.map((bucket) => bucket.tone)).toEqual(['good', 'good', 'bad', 'bad', 'bad', 'bad'])
  })

  it('puts each age on the right side of every edge', () => {
    const ages = [0, 29, 30, 77, 78, 89, 90, 179, 180, 364, 365, 900]
    expect(ageBuckets(withAges(ages, 77)).map((bucket) => bucket.count)).toEqual([2, 2, 2, 2, 2, 2])
  })

  it('lists each bucket oldest first', () => {
    const buckets = ageBuckets(withAges([200, 300, 250], 77))
    expect(buckets[4].issues.map((open) => open.age)).toEqual([300, 250, 200])
  })

  it('falls back to month buckets for a window of 30 days or less, with the straddling bucket amber', () => {
    const buckets = ageBuckets(withAges([], 20))
    expect(buckets.map((bucket) => bucket.label)).toEqual(['Under 1 month', '1–3 months', '3–6 months', '6–12 months', '12+ months'])
    expect(buckets.map((bucket) => bucket.tone)).toEqual(['warn', 'bad', 'bad', 'bad', 'bad'])
    expect(ageBuckets(withAges([], 30)).map((bucket) => bucket.tone)).toEqual(['good', 'warn', 'bad', 'bad', 'bad'])
  })

  it('falls back to month buckets for a window of 90 days or more', () => {
    expect(ageBuckets(withAges([], 90)).map((bucket) => bucket.tone)).toEqual(['good', 'good', 'warn', 'bad', 'bad'])
    expect(ageBuckets(withAges([], 400)).map((bucket) => bucket.tone)).toEqual(['good', 'good', 'good', 'good', 'warn'])
  })

  it('falls back for a window of 89 days, where the edge bucket would be empty', () => {
    const buckets = ageBuckets(withAges([], 89))
    expect(buckets.map((bucket) => bucket.label)).toEqual(['Under 1 month', '1–3 months', '3–6 months', '6–12 months', '12+ months'])
    expect(buckets.map((bucket) => bucket.tone)).toEqual(['good', 'good', 'bad', 'bad', 'bad'])
  })

  it('keeps the six buckets just inside the fallback edges', () => {
    expect(ageBuckets(withAges([], 31)).map((bucket) => bucket.label)).toContain('1 month – 31 days')
    expect(ageBuckets(withAges([], 88)).map((bucket) => bucket.label)).toContain('89 days – 3 months')
  })

  it('uses neutral month buckets without a window', () => {
    const buckets = ageBuckets(withAges([45], null))
    expect(buckets.map((bucket) => bucket.tone)).toEqual(['neutral', 'neutral', 'neutral', 'neutral', 'neutral'])
    expect(buckets[1].count).toBe(1)
  })

  it('gives every bucket a distinct key', () => {
    const keys = ageBuckets(withAges([], 77)).map((bucket) => bucket.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('agingProfile', () => {
  const rows = [
    issue('#1', '2026-09-01', '2026-09-20'),
    issue('#2', '2026-09-10'),
    issue('#3', '2026-09-15', '2026-10-14'),
    issue('#4', '2026-10-13'),
    issue('#5', '2026-09-03', null, 'Closed'),
  ]
  const index = indexOf(rows)
  const view: ViewState = { selectedKey: WW42, windowEndKey: WW42, range: 'all', dateRange: null }

  it('matches the benchmarks as of every week in the range', () => {
    const profile = agingProfile(index, view, TODAY)
    expect(profile.map((point) => point.week.key)).toEqual(index.weeks.map((counts) => counts.week.key))
    for (const point of profile) {
      const benchmarks = buildIssueBenchmarks(index, point.week.key, TODAY)
      expect(point.open).toBe(benchmarks.open.length)
      expect(point.median).toBe(benchmarks.medianOpenAge)
    }
  })

  it('has no median for a week with no open issues', () => {
    const quiet = indexOf([issue('#1', '2026-09-01', '2026-09-02'), issue('#2', '2026-10-12')])
    const profile = agingProfile(quiet, view, TODAY)
    expect(profile[0]).toMatchObject({ open: 0, median: null })
    expect(profile[profile.length - 1]).toMatchObject({ open: 1, median: 3 })
  })

  it('ends at the window end and keeps the last 30 weeks in the recent range', () => {
    const long = indexOf([issue('#1', '2025-01-06'), issue('#2', '2026-10-12')])
    const profile = agingProfile(long, { selectedKey: WW42, windowEndKey: WW41, range: 'recent', dateRange: null }, TODAY)
    expect(profile).toHaveLength(30)
    expect(profile[29].week.key).toBe(WW41)
  })
})

describe('quarterMedians', () => {
  it('runs from the first quarter with a closure through the quarter of W', () => {
    const rows = [issue('#1', '2026-01-05', '2026-02-04'), issue('#2', '2026-01-05', '2026-02-14'), issue('#3', '2026-05-01', '2026-08-09')]
    const points = quarterMedians(indexOf(rows), WW42, TODAY)
    expect(points.map((point) => point.label)).toEqual(["Q1'26", "Q2'26", "Q3'26", "Q4'26"])
    expect(points[0]).toMatchObject({ closed: 2, median: 35, slowest: 40 })
    expect(points[1]).toMatchObject({ closed: 0, median: null, slowest: null })
    expect(points[2]).toMatchObject({ closed: 1, median: 100, slowest: 100 })
  })

  it('counts only closures as of W', () => {
    const rows = [issue('#1', '2026-07-01', '2026-07-11'), issue('#2', '2026-07-01', '2026-10-13')]
    const points = quarterMedians(indexOf(rows), WW41, TODAY)
    expect(points.map((point) => [point.label, point.closed])).toEqual([
      ["Q3'26", 1],
      ["Q4'26", 0],
    ])
  })

  it('gives every quarter a distinct, ascending key', () => {
    const rows = [issue('#1', '2025-11-03', '2025-12-01'), issue('#2', '2026-01-05', '2026-02-04')]
    const keys = quarterMedians(indexOf(rows), WW42, TODAY).map((point) => point.key)
    expect(keys).toEqual([...keys].sort((a, b) => a - b))
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('is empty without closures', () => {
    expect(quarterMedians(indexOf([issue('#1', '2026-10-01')]), WW42, TODAY)).toEqual([])
  })
})
