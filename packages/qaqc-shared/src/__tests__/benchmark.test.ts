import { act, createElement } from 'react'
import { describe, expect, it } from 'vitest'

import { IssueDetailTable } from '../components/IssueDetailTable'
import { layoutChart } from '../components/IssuesTrendChart'
import { layoutWeekLines, type WeekLine } from '../components/OverviewLinesChart'
import { splitCombinedRows } from '../combined'
import { buildInspectionIndex, buildInspectionModel, defaultViewState } from '../inspections'
import { buildIssueDetail, buildIssueIndex, buildIssueModel } from '../issues'
import type { OverviewIndex } from '../overview'
import { buildOverviewIndex, buildOverviewModel } from '../overview'
import type { CombinedColumns, IssueDetailRow, IssueTrendPoint } from '../types'
import { buildWeldIndex, buildWeldModel } from '../welds'
import { makeWorkWeek } from '../workWeeks'
import { COMBINED_COLUMNS } from './fixtures/combinedRows'
import { syntheticCombinedRows } from './fixtures/syntheticCombined'
import { syntheticInspectionRows, syntheticIssueRows, syntheticWeldRows } from './fixtures/syntheticRows'
import { render } from './render'

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

function elapsed(work: () => void): number {
  const start = performance.now()
  work()
  return performance.now() - start
}

describe('performance budgets', () => {
  it('indexes 100,000 rows within budget', () => {
    const rows = syntheticInspectionRows(100_000)
    buildInspectionIndex(rows, COLUMNS, TODAY)
    expect(elapsed(() => buildInspectionIndex(rows, COLUMNS, TODAY))).toBeLessThan(300)
  })

  it('indexes 500,000 rows within budget', () => {
    const rows = syntheticInspectionRows(500_000)
    buildInspectionIndex(rows, COLUMNS, TODAY)
    expect(elapsed(() => buildInspectionIndex(rows, COLUMNS, TODAY))).toBeLessThan(1500)
  })

  it('recomputes the All-range view model from a 500,000-row index within one frame', () => {
    const index = buildInspectionIndex(syntheticInspectionRows(500_000), COLUMNS, TODAY)
    const view = { ...defaultViewState(index), range: 'all' as const }
    buildInspectionModel(index, view)
    expect(elapsed(() => buildInspectionModel(index, view))).toBeLessThan(16)
  })
})

describe('welding performance budgets', () => {
  it('indexes 500,000 weld rows within budget', () => {
    const rows = syntheticWeldRows(500_000)
    buildWeldIndex(rows, WELD_COLUMNS, TODAY)
    expect(elapsed(() => buildWeldIndex(rows, WELD_COLUMNS, TODAY))).toBeLessThan(1500)
  })

  it('recomputes the All-range weld model from a 500,000-row index within one frame', () => {
    const index = buildWeldIndex(syntheticWeldRows(500_000), WELD_COLUMNS, TODAY)
    const view = { ...defaultViewState(index), range: 'all' as const }
    buildWeldModel(index, view, 'AW', 10)
    expect(elapsed(() => buildWeldModel(index, view, 'AW', 10))).toBeLessThan(16)
  })
})

describe('issues performance budgets', () => {
  it('indexes 200,000 issue rows within budget', () => {
    const rows = syntheticIssueRows(200_000)
    buildIssueIndex(rows, ISSUE_COLUMNS, TODAY)
    expect(elapsed(() => buildIssueIndex(rows, ISSUE_COLUMNS, TODAY))).toBeLessThan(1500)
  })

  it('recomputes the All-range issue model from a 200,000-row index within one frame', () => {
    const index = buildIssueIndex(syntheticIssueRows(200_000), ISSUE_COLUMNS, TODAY)
    expect(index.issues.length).toBeGreaterThan(150_000)
    const view = { ...defaultViewState(index), range: 'all' as const }
    buildIssueModel(index, view)
    expect(elapsed(() => buildIssueModel(index, view))).toBeLessThan(16)
  })

  it('builds the Issue Detail for a 200,000-row index within budget', () => {
    const index = buildIssueIndex(syntheticIssueRows(200_000), ISSUE_COLUMNS, TODAY)
    buildIssueDetail(index, index.currentWeek.key)
    expect(elapsed(() => buildIssueDetail(index, index.currentWeek.key))).toBeLessThan(30)
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
    expect(elapsed(() => indexCombined(rows))).toBeLessThan(1500)
  })

  it('splits and indexes 500,000 combined rows with Green tags bound to a blank column within budget', () => {
    // A position past the last column reads as a blank cell in every row, so the Green tags scan visits them all.
    const columns: CombinedColumns = { ...COMBINED, greenTags: COMBINED_COLUMNS.length }
    expect(indexCombined(rows, columns).greenTags).toBeNull()
    expect(elapsed(() => indexCombined(rows, columns))).toBeLessThan(1500)
  })

  it.each(['week', 'toDate'] as const)('builds the All-range overview model (%s) from a 500,000-row index within one frame', (mode) => {
    expect(index.weeks.length).toBeGreaterThan(250)
    const view = { ...defaultViewState(index), range: 'all' as const }
    buildOverviewModel(index, view, mode)
    expect(elapsed(() => buildOverviewModel(index, view, mode))).toBeLessThan(16)
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

  /** The time of the first click on a header: building that column's ranks and sorting every row. */
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

  // Best of three: the full suite runs files in parallel, so a single run can be slowed by CPU contention. The fastest
  // run still catches a real regression (a return to sorting with the collator would take seconds).
  function bestFirstSortTime(rows: IssueDetailRow[], column: string): number {
    return Math.min(firstSortTime(rows, column), firstSortTime(rows, column), firstSortTime(rows, column))
  }

  it('sorts 70,000 detail rows by Title on the first click within budget', () => {
    const rows = detailRows()
    expect(rows).toHaveLength(DETAIL_ROWS)
    expect(bestFirstSortTime(rows, 'Title')).toBeLessThan(300)
  })

  it('sorts 70,000 detail rows by ID on the first click within budget', () => {
    const rows = detailRows()
    expect(bestFirstSortTime(rows, 'ID')).toBeLessThan(150)
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
    expect(elapsed(() => layoutChart(points, 1200, 520, false))).toBeLessThan(16)
  })

  it('lays out the 520-week trend chart with every value shown within one frame', () => {
    layoutChart(points, 2400, 900, true)
    expect(elapsed(() => layoutChart(points, 2400, 900, true))).toBeLessThan(16)
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
    expect(elapsed(() => layoutWeekLines(lines, 520, scale, 1200, 520, false, 260, false, formatValue))).toBeLessThanOrEqual(16)
  })

  it('lays out the 520-week overview lines with every value shown within one frame', () => {
    layoutWeekLines(lines, 520, scale, 2400, 900, false, 260, true, formatValue)
    expect(elapsed(() => layoutWeekLines(lines, 520, scale, 2400, 900, false, 260, true, formatValue))).toBeLessThanOrEqual(16)
  })
})
