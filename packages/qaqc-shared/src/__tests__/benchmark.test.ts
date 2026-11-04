import { act, createElement } from 'react'
import { describe, expect, it } from 'vitest'

import { IssueDetailTable } from '../components/IssueDetailTable'
import { layoutChart } from '../components/IssuesTrendChart'
import { layoutWeekLines, type WeekLine } from '../components/OverviewLinesChart'
import { splitCombinedRows } from '../combined'
import { buildInspectionIndex, buildInspectionModel, defaultViewState } from '../inspections'
import { agingProfile, buildIssueBenchmarks, quarterMedians } from '../issueBenchmarks'
import { buildIssueDetail, buildIssueIndex, buildIssueModel, issueDataWeeks } from '../issues'
import type { OverviewIndex } from '../overview'
import { buildOverviewIndex, buildOverviewModel } from '../overview'
import { buildRootCausePareto, paretoIssues } from '../rootCauses'
import type { CombinedColumns, IssueDetailRow, IssueTrendPoint, ViewState } from '../types'
import { buildWeldIndex, buildWeldModel } from '../welds'
import { makeWorkWeek } from '../workWeeks'
import { COMBINED_COLUMNS } from './fixtures/combinedRows'
import { syntheticCombinedRows } from './fixtures/syntheticCombined'
import { syntheticInspectionRows, syntheticIssueRows, syntheticWeldRows } from './fixtures/syntheticRows'
import { render } from './render'
import { bestOf, elapsed, TIMING_RUNS } from './timing'

const COLUMNS = { workWeek: 0, phase: 1, issue: 2, building: 3 }
const WELD_COLUMNS = { weldWeek: 0, signature: 1, signedWeek: 2, issue: 3, fluidCode: 4, pipeSpec: 5, tagNo: 6 }
const ISSUE_COLUMNS = {
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
const TODAY = new Date(2026, 9, 15)

describe('performance budgets', () => {
  it('indexes 100,000 rows within budget', () => {
    const rows = syntheticInspectionRows(100_000)
    buildInspectionIndex(rows, COLUMNS, TODAY)
    expect(bestOf(TIMING_RUNS, () => elapsed(() => buildInspectionIndex(rows, COLUMNS, TODAY)))).toBeLessThan(300)
  })

  it('building the index with issueRowsByWeek stays inside the existing 100k budget', () => {
    const rows = syntheticInspectionRows(100_000)
    const index = buildInspectionIndex(rows, COLUMNS, TODAY)
    const listed = index.issueRowsByWeek.reduce((sum, positions) => sum + positions.length, 0)
    expect(listed).toBe(index.cumulativeIssues[index.cumulativeIssues.length - 1])
    expect(listed).toBeGreaterThan(0)
    expect(bestOf(TIMING_RUNS, () => elapsed(() => buildInspectionIndex(rows, COLUMNS, TODAY)))).toBeLessThan(300)
  })

  it('indexes 500,000 rows within budget', () => {
    const rows = syntheticInspectionRows(500_000)
    buildInspectionIndex(rows, COLUMNS, TODAY)
    expect(bestOf(TIMING_RUNS, () => elapsed(() => buildInspectionIndex(rows, COLUMNS, TODAY)))).toBeLessThan(1500)
  })

  it('recomputes the All-range view model from a 500,000-row index within one frame', () => {
    const index = buildInspectionIndex(syntheticInspectionRows(500_000), COLUMNS, TODAY)
    const view = { ...defaultViewState(index), range: 'all' as const }
    buildInspectionModel(index, view)
    expect(bestOf(TIMING_RUNS, () => elapsed(() => buildInspectionModel(index, view)))).toBeLessThan(16)
  })
})

describe('welding performance budgets', () => {
  it('building the weld index with issueRowsByWeek stays inside the 100k budget', () => {
    const rows = syntheticWeldRows(100_000)
    const index = buildWeldIndex(rows, WELD_COLUMNS, TODAY)
    const listed = index.issueRowsByWeek.reduce((sum, positions) => sum + positions.length, 0)
    expect(listed).toBe(index.cumulativeIssues[index.cumulativeIssues.length - 1])
    expect(listed).toBeGreaterThan(0)
    expect(bestOf(TIMING_RUNS, () => elapsed(() => buildWeldIndex(rows, WELD_COLUMNS, TODAY, { axisFromKey: index.weeks[0].week.key })))).toBeLessThan(300)
  })

  it('indexes 500,000 weld rows within budget', () => {
    const rows = syntheticWeldRows(500_000)
    buildWeldIndex(rows, WELD_COLUMNS, TODAY)
    expect(bestOf(TIMING_RUNS, () => elapsed(() => buildWeldIndex(rows, WELD_COLUMNS, TODAY)))).toBeLessThan(1500)
  })

  it('recomputes the All-range weld model from a 500,000-row index within one frame', () => {
    const index = buildWeldIndex(syntheticWeldRows(500_000), WELD_COLUMNS, TODAY)
    const view = { ...defaultViewState(index), range: 'all' as const }
    buildWeldModel(index, view, 'AW', 10)
    expect(bestOf(TIMING_RUNS, () => elapsed(() => buildWeldModel(index, view, 'AW', 10)))).toBeLessThan(16)
  })
})

describe('issues performance budgets', () => {
  it('indexes 200,000 issue rows within budget', () => {
    const rows = syntheticIssueRows(200_000)
    buildIssueIndex(rows, ISSUE_COLUMNS, TODAY)
    expect(bestOf(TIMING_RUNS, () => elapsed(() => buildIssueIndex(rows, ISSUE_COLUMNS, TODAY)))).toBeLessThan(1500)
  })

  it('rebuilds a filtered index of 100,000 issue rows within the 300 ms index budget, with row positions and the axis', () => {
    const rows = syntheticIssueRows(100_000)
    const options = { includeAllCreators: true, axisFromKey: 202001 }
    buildIssueIndex(rows, ISSUE_COLUMNS, TODAY, options)
    expect(bestOf(TIMING_RUNS, () => elapsed(() => buildIssueIndex(rows, ISSUE_COLUMNS, TODAY, options)))).toBeLessThan(300)
  })

  it('reads the full data\'s weeks from 100,000 issue rows well under a rebuild', () => {
    const rows = syntheticIssueRows(100_000)
    expect(issueDataWeeks(rows, ISSUE_COLUMNS, TODAY).length).toBeGreaterThan(1)
    expect(bestOf(TIMING_RUNS, () => elapsed(() => issueDataWeeks(rows, ISSUE_COLUMNS, TODAY)))).toBeLessThan(100)
  })

  it('recomputes the All-range issue model from a 200,000-row index within one frame', () => {
    const index = buildIssueIndex(syntheticIssueRows(200_000), ISSUE_COLUMNS, TODAY)
    expect(index.issues.length).toBeGreaterThan(150_000)
    const view = { ...defaultViewState(index), range: 'all' as const }
    buildIssueModel(index, view)
    expect(bestOf(TIMING_RUNS, () => elapsed(() => buildIssueModel(index, view)))).toBeLessThan(16)
  })

  it('builds the Issue Detail for a 200,000-row index within budget', () => {
    const index = buildIssueIndex(syntheticIssueRows(200_000), ISSUE_COLUMNS, TODAY)
    buildIssueDetail(index, index.currentWeek.key)
    expect(bestOf(TIMING_RUNS, () => elapsed(() => buildIssueDetail(index, index.currentWeek.key)))).toBeLessThan(30)
  })
})

describe('issue benchmark performance budgets', () => {
  const index = buildIssueIndex(syntheticIssueRows(200_000), ISSUE_COLUMNS, TODAY)
  const lastKey = index.currentWeek.key
  const earlierKey = index.weeks[index.weeks.length - 20].week.key
  // The first call computes each issue's day numbers once for the index.
  buildIssueBenchmarks(index, lastKey, TODAY)

  it('builds the first benchmarks after indexing 200,000 rows, day numbers included, within budget', () => {
    const rows = syntheticIssueRows(200_000)
    // A fresh index for every run, so each one is a first call that computes the day numbers.
    const firstCallTime = (): number => {
      const fresh = buildIssueIndex(rows, ISSUE_COLUMNS, TODAY)
      return elapsed(() => buildIssueBenchmarks(fresh, fresh.currentWeek.key, TODAY))
    }
    expect(bestOf(TIMING_RUNS, firstCallTime)).toBeLessThanOrEqual(50)
  })

  it('builds the benchmarks for a new week from a 200,000-row index within budget', () => {
    expect(index.issues.length).toBeGreaterThan(150_000)
    expect(bestOf(TIMING_RUNS, () => elapsed(() => buildIssueBenchmarks(index, earlierKey, TODAY)))).toBeLessThanOrEqual(50)
  })

  it('builds the 30-week aging profile from a 200,000-row index within budget', () => {
    const view = { ...defaultViewState(index), range: 'recent' as const }
    expect(bestOf(TIMING_RUNS, () => elapsed(() => agingProfile(index, view, TODAY)))).toBeLessThanOrEqual(50)
  })

  it('builds the All-range aging profile from a 200,000-row index within budget', () => {
    expect(index.weeks.length).toBeGreaterThan(250)
    const view = { ...defaultViewState(index), range: 'all' as const }
    expect(bestOf(TIMING_RUNS, () => elapsed(() => agingProfile(index, view, TODAY)))).toBeLessThanOrEqual(50)
  })

  it('builds the quarterly medians from a 200,000-row index within budget', () => {
    expect(bestOf(TIMING_RUNS, () => elapsed(() => quarterMedians(index, lastKey, TODAY)))).toBeLessThanOrEqual(50)
  })
})

describe('root cause Pareto performance budgets', () => {
  const CATEGORIES = ['Quality', 'Design', 'Safety', 'Coordination', null]
  // 40 causes, every seventh blank and some in other spellings, so grouping, Other and Not recorded all do work.
  const rows = syntheticIssueRows(200_000).map((row, at) => {
    const cause = at % 7 === 0 ? null : `Cause ${(at * 13) % 40}`
    return [...row, cause !== null && at % 5 === 0 ? ` ${cause.toUpperCase()} ` : cause, CATEGORIES[at % CATEGORIES.length]]
  })
  const index = buildIssueIndex(rows, ISSUE_COLUMNS, TODAY)
  const all = { ...defaultViewState(index), range: 'all' as const }
  const earlier = { ...all, selectedKey: index.weeks[index.weeks.length - 20].week.key }
  // The first call groups every issue's cause and category once for the index.
  buildRootCausePareto(index, all, 'all', TODAY)

  it('builds the All-range All issues Pareto for a new week from a 200,000-row index within budget', () => {
    expect(index.issues.length).toBeGreaterThan(150_000)
    const model = buildRootCausePareto(index, earlier, 'all', TODAY)
    expect(model.distinct).toBe(40)
    expect(bestOf(TIMING_RUNS, () => elapsed(() => buildRootCausePareto(index, earlier, 'all', TODAY)))).toBeLessThanOrEqual(30)
  })

  it('builds the All-range Open only Pareto from a 200,000-row index within budget', () => {
    expect(buildRootCausePareto(index, earlier, 'open', TODAY).total).toBeGreaterThan(0)
    expect(bestOf(TIMING_RUNS, () => elapsed(() => buildRootCausePareto(index, earlier, 'open', TODAY)))).toBeLessThanOrEqual(30)
  })

  it('lists the Other bar issues from a 200,000-row index within budget', () => {
    const other = buildRootCausePareto(index, all, 'all', TODAY).bars.find((bar) => bar.kind === 'other')
    if (other === undefined) throw new Error('no Other bar')
    expect(bestOf(TIMING_RUNS, () => elapsed(() => paretoIssues(index, other, all, 'all', TODAY)))).toBeLessThanOrEqual(30)
  })
})

describe('overview performance budgets', () => {
  const position = (name: (typeof COMBINED_COLUMNS)[number]): number => COMBINED_COLUMNS.indexOf(name)
  const COMBINED: CombinedColumns = {
    source: position('Source'),
    workWeek: position('Work Week'),
    phase: position('Inspection Phase'),
    issue: position('Issue'),
    building: position('Building'),
    qcr: position('QCR/FE'),
    welder: position('Welder'),
    tagNo: position('Tag No'),
    signature: position('Signature'),
    signedWeek: position('Work Week Signed'),
    id: position('ID'),
    status: position('Status'),
    type: position('Type'),
    createdOn: position('Created On'),
    updatedOn: position('Updated On'),
    createdBy: position('Created By'),
    rootCause: position('Root Cause'),
    greenTags: -1,
  }

  /** One data update: split the combined rows by Source, then index every discipline. */
  function indexCombined(rows: unknown[][], columns: CombinedColumns = COMBINED): OverviewIndex {
    return buildOverviewIndex(splitCombinedRows(rows, columns.source), columns, TODAY)
  }

  const rows = syntheticCombinedRows(500_000)
  const index = indexCombined(rows)

  it('splits and indexes 500,000 combined rows within budget', () => {
    expect(bestOf(TIMING_RUNS, () => elapsed(() => indexCombined(rows)))).toBeLessThan(1500)
  })

  it('splits and indexes 500,000 combined rows with Green tags bound to a blank column within budget', () => {
    // A position past the last column reads as a blank cell in every row, so the Green tags scan visits them all.
    const columns: CombinedColumns = { ...COMBINED, greenTags: COMBINED_COLUMNS.length }
    expect(indexCombined(rows, columns).greenTags).toBeNull()
    expect(bestOf(TIMING_RUNS, () => elapsed(() => indexCombined(rows, columns)))).toBeLessThan(1500)
  })

  it.each(['week', 'toDate'] as const)('builds the All-range overview model (%s) from a 500,000-row index within one frame', (mode) => {
    expect(index.weeks.length).toBeGreaterThan(250)
    const view = { ...defaultViewState(index), range: 'all' as const }
    buildOverviewModel(index, view, mode)
    expect(bestOf(TIMING_RUNS, () => elapsed(() => buildOverviewModel(index, view, mode)))).toBeLessThan(16)
  })

  it.each(['week', 'toDate'] as const)('builds the overview model (%s) for a new week, benchmarks not yet built for it, within one frame', (mode) => {
    // Every run selects a week no earlier call has selected, so the issue benchmarks are built for it from scratch.
    const keys = index.weeks.slice(-2 - TIMING_RUNS).map((week) => week.key)
    const viewAt = (key: number): ViewState => ({ ...defaultViewState(index), range: 'all', selectedKey: key, windowEndKey: key })
    // The day numbers are worked out once per index, on the first build; this is a week change after that.
    buildOverviewModel(index, viewAt(keys[0]), mode)
    let next = 1
    const coldWeekTime = (): number => {
      const view = viewAt(keys[next])
      next += 1
      return elapsed(() => buildOverviewModel(index, view, mode))
    }
    expect(bestOf(TIMING_RUNS, coldWeekTime)).toBeLessThan(16)
  })
})

describe('issue table performance budgets', () => {
  const DETAIL_ROWS = 70_000

  const TITLE_WORDS = ['Pipe', 'support', 'grid', 'cable', 'tray', 'valve', 'Anchor', 'bolt', 'PS1', 'Corroded', 'HDPE', 'grout']

  /** Issue-like titles in no particular order: 4 to 9 words from a seeded generator, plus a number. */
  function titleFor(position: number): string {
    let seed = position + 1
    const words: string[] = []
    for (let word = 0; word < 4 + (position % 6); word += 1) {
      seed = (seed * 16_807) % 2_147_483_647
      words.push(TITLE_WORDS[seed % TITLE_WORDS.length])
    }
    return `${words.join(' ')} ${position}`
  }

  function detailRows(): IssueDetailRow[] {
    const index = buildIssueIndex(syntheticIssueRows(200_000), ISSUE_COLUMNS, TODAY)
    // Detail rows by ID descending like the model; the table does not care which block a row is in.
    return index.issues.slice(0, DETAIL_ROWS).map((issue, position) => ({ ...issue.detail, title: titleFor(position) }))
  }

  /** The time of the first click on a header, on a fresh table: building that column's ranks and sorting every row. */
  function firstSortTime(rows: IssueDetailRow[], column: string): number {
    const view = render(createElement(IssueDetailTable, { reportRows: [], discussionRows: rows, caption: 'Issues' }))
    const button = [...view.container.querySelectorAll('thead th button')].find((item) => item.textContent === column)
    if (!(button instanceof HTMLButtonElement)) throw new Error(`header ${column} missing`)
    const time = elapsed(() => {
      act(() => {
        button.click()
      })
    })
    view.unmount()
    return time
  }

  it('sorts 70,000 detail rows by Title on the first click within budget', () => {
    const rows = detailRows()
    expect(rows).toHaveLength(DETAIL_ROWS)
    expect(bestOf(TIMING_RUNS, () => firstSortTime(rows, 'Title'))).toBeLessThan(300)
  })

  it('sorts 70,000 detail rows by ID on the first click within budget', () => {
    const rows = detailRows()
    expect(bestOf(TIMING_RUNS, () => firstSortTime(rows, 'ID'))).toBeLessThan(150)
  })
})

describe('issue chart performance budgets', () => {
  // Ten years of weeks with busy counts, so every bar and label path is exercised.
  const points: IssueTrendPoint[] = Array.from({ length: 520 }, (_, index) => ({
    week: makeWorkWeek(2016 + Math.floor(index / 52), (index % 52) + 1),
    opened: (index * 7) % 13,
    closed: (index * 5) % 11,
    remainingOpen: 200 + ((index * 17) % 90),
  }))

  it('lays out the 520-week trend chart within one frame', () => {
    layoutChart(points, 1200, 520, false)
    expect(bestOf(TIMING_RUNS, () => elapsed(() => layoutChart(points, 1200, 520, false)))).toBeLessThan(16)
  })

  it('lays out the 520-week trend chart with every value shown within one frame', () => {
    layoutChart(points, 2400, 900, true)
    expect(bestOf(TIMING_RUNS, () => elapsed(() => layoutChart(points, 2400, 900, true)))).toBeLessThan(16)
  })
})

describe('overview chart performance budgets', () => {
  // Ten years of weeks: a busy count line, and a rate line with a gap every seventh week.
  const lines: WeekLine[] = [
    { key: 'inspection', color: '#2E5AAC', isDashed: false, values: Array.from({ length: 520 }, (_, index) => 80 + ((index * 7) % 21)) },
    { key: 'welding', color: '#1A9C7B', isDashed: true, values: Array.from({ length: 520 }, (_, index) => (index % 7 === 3 ? null : 85 + ((index * 5) % 16))) },
  ]
  const scale = { min: 79, max: 100, ticks: [79, 89.5, 100] }
  const formatValue = (value: number): string => `${value.toFixed(1)}%`

  it('lays out the 520-week overview lines within one frame', () => {
    layoutWeekLines(lines, 520, scale, 1200, 520, false, 260, false, formatValue)
    expect(bestOf(TIMING_RUNS, () => elapsed(() => layoutWeekLines(lines, 520, scale, 1200, 520, false, 260, false, formatValue)))).toBeLessThanOrEqual(16)
  })

  it('lays out the 520-week overview lines with every value shown within one frame', () => {
    layoutWeekLines(lines, 520, scale, 2400, 900, false, 260, true, formatValue)
    expect(bestOf(TIMING_RUNS, () => elapsed(() => layoutWeekLines(lines, 520, scale, 2400, 900, false, 260, true, formatValue)))).toBeLessThanOrEqual(16)
  })
})
