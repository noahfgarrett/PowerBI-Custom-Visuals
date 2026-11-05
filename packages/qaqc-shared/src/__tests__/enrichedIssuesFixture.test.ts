import { describe, expect, it } from 'vitest'

import type { IssueColumns, ViewState } from '../types'
import { buildIssueBenchmarks } from '../issueBenchmarks'
import { buildIssueIndex, buildIssueModel } from '../issues'
import { buildRootCausePareto } from '../rootCauses'
import { ENRICHED_ISSUE_COLUMNS, ENRICHED_ISSUE_ROWS } from './fixtures/enrichedIssueRows'

// Expected values are pinned to the seeded synthetic fixtures from scripts/generate-qaqc-fixtures.mjs, with
// today = 2026-10-20 and W = WW43'2026.

function position(name: (typeof ENRICHED_ISSUE_COLUMNS)[number]): number {
  return ENRICHED_ISSUE_COLUMNS.indexOf(name)
}

const COLUMNS: IssueColumns = {
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
  // The enriched export has no Root Cause Category column.
  rootCauseCategory: -1,
  bim360CreatedBy: position('BIM360_Created By'),
  bim360CreatedOn: position('BIM360_Created On'),
  bim360ClosedOn: position('BIM360_Closed On'),
  closedAt: position('Closed at'),
}
const TODAY = new Date(2026, 9, 20) // WW43'2026
const WW43 = 202643
const WW42 = 202642
const index = buildIssueIndex(ENRICHED_ISSUE_ROWS, COLUMNS, TODAY)

function viewAt(key: number, range: ViewState['range'] = 'recent'): ViewState {
  return { selectedKey: key, windowEndKey: key, range, dateRange: null }
}

/** Opened and closed per week, WW30–WW43'2026. */
const PER_WEEK: ReadonlyArray<[string, number, number]> = [
  ["WW30'2026", 0, 13],
  ["WW31'2026", 2, 2],
  ["WW32'2026", 0, 1],
  ["WW33'2026", 4, 1],
  ["WW34'2026", 2, 0],
  ["WW35'2026", 1, 3],
  ["WW36'2026", 1, 3],
  ["WW37'2026", 2, 3],
  ["WW38'2026", 5, 2],
  ["WW39'2026", 0, 1],
  ["WW40'2026", 1, 1],
  ["WW41'2026", 3, 1],
  ["WW42'2026", 3, 3],
  ["WW43'2026", 0, 2],
]

describe('the enriched fixture', () => {
  it('holds only the LotusWorks and Other creator markers, or blank', () => {
    const creators = new Set(ENRICHED_ISSUE_ROWS.map((row) => row[COLUMNS.createdBy]))
    const legacyCreators = new Set(ENRICHED_ISSUE_ROWS.map((row) => row[position('BIM360_Created By')]))
    expect(creators).toEqual(new Set(['LotusWorks', 'Other']))
    expect(legacyCreators).toEqual(new Set(['LotusWorks', 'Other', null]))
  })

  it('keeps the BIM360 dates as M/D/YY h:mm AM/PM text', () => {
    const isExportText = (cell: string | null): boolean => cell !== null && /^\d{1,2}\/\d{1,2}\/\d{2} \d{1,2}:\d{2} [AP]M$/.test(cell)
    expect(ENRICHED_ISSUE_ROWS.filter((row) => isExportText(row[position('BIM360_Created On')]))).toHaveLength(1018)
    expect(ENRICHED_ISSUE_ROWS.filter((row) => isExportText(row[position('BIM360_Closed On')]))).toHaveLength(957)
  })
})

describe("enriched issue fixture, as of WW43'2026", () => {
  it('reads 1,077 rows and keeps 231 included issues', () => {
    expect(index.totalRows).toBe(1077)
    expect(index.issues).toHaveLength(231)
    expect(index.excludedRows).toBe(846)
    expect(index.skippedRows).toBe(0)
    expect(index.futureRows).toBe(0)
  })

  it("starts at WW13'2022 and runs through WW43'2026", () => {
    expect(index.weeks[0].week.label).toBe("WW13'2022")
    expect(index.weeks[index.weeks.length - 1].week.label).toBe("WW43'2026")
  })

  it('opens and closes the expected issues each week from WW30 to WW43', () => {
    const position30 = index.positionByKey.get(202630) ?? -1
    const weeks = index.weeks.slice(position30, position30 + PER_WEEK.length)
    expect(weeks.map((item) => [item.week.label, item.opened, item.closed])).toEqual(PER_WEEK)
  })

  it('shows opened or closed activity in every week from WW31 to WW42', () => {
    const quiet = index.weeks
      .filter((item) => item.week.key >= 202631 && item.week.key <= WW42 && item.opened + item.closed === 0)
      .map((item) => item.week.label)
    expect(quiet).toEqual([])
  })

  it('does not lump the migrated issues into WW30', () => {
    // 207 included issues have a Created on of 7/24/2026, the migration day. The 13 closures are BIM 360 closed dates
    // in that week, not the Closed at the migration wrote.
    const ww30 = index.weeks[index.positionByKey.get(202630) ?? -1]
    expect([ww30.opened, ww30.closed]).toEqual([0, 13])
  })

  it('matches the project-to-date cards through WW43', () => {
    const model = buildIssueModel(index, viewAt(WW43))
    expect(model.toDate.opened.value).toBe(231)
    expect(model.toDate.closed.value).toBe(175)
    expect(model.toDate.remaining.value).toBe(56)
    expect(model.toDate.closureRate.value).toBeCloseTo(75.76, 2)
  })

  it('matches the WW42 week and project-to-date cards', () => {
    const model = buildIssueModel(index, viewAt(WW42))
    expect([model.thisWeek.opened.value, model.thisWeek.closed.value]).toEqual([3, 3])
    expect(model.toDate.opened.value).toBe(231)
    expect(model.toDate.closed.value).toBe(173)
    expect(model.toDate.remaining.value).toBe(58)
    expect(model.toDate.closureRate.value).toBeCloseTo(74.89, 2)
  })
})

describe("enriched issue benchmarks as of WW43'2026", () => {
  const benchmarks = buildIssueBenchmarks(index, WW43, TODAY)

  it('counts 175 closures, all with a closed date', () => {
    expect(benchmarks.closures).toBe(175)
    expect(benchmarks.closedWithoutDate).toBe(0)
  })

  it('closes typically in 75 days, 90% within 147 days, the slowest in 1,388 days', () => {
    expect(benchmarks.typical).toBe(75)
    expect(benchmarks.window).toBe(147)
    expect(benchmarks.slowest).toBe(1388)
  })

  it('has 56 open issues, 42 past the window and 2 older than any closure, with a median age of 466.5 days', () => {
    expect(benchmarks.open).toHaveLength(56)
    expect(benchmarks.pastWindow).toBe(42)
    expect(benchmarks.olderThanAny).toBe(2)
    expect(benchmarks.medianOpenAge).toBe(466.5)
  })

  it("closes typically in 76 days as of WW42'2026", () => {
    expect(buildIssueBenchmarks(index, WW42, TODAY).typical).toBe(76)
  })
})

describe("enriched root cause Pareto, All and All issues, as of WW43'2026", () => {
  const model = buildRootCausePareto(index, viewAt(WW43, 'all'), 'all', TODAY)

  it('covers 231 issues with 31 recorded causes', () => {
    expect(model.total).toBe(231)
    expect(model.distinct).toBe(31)
  })

  it('has the top 9 causes, Other (22 causes) and 6 Not recorded', () => {
    // 'Other' is also a recorded cause in the fixture, ranked by its own count ahead of the Other bar.
    expect(model.bars.map((bar) => [bar.label, bar.count])).toEqual([
      ['Quality', 65],
      ['Installation', 49],
      ['Casting/Pouring/Erection', 18],
      ['Incomplete Work', 17],
      ['Coordination', 14],
      ['Materials', 12],
      ['Housekeeping', 4],
      ['Other', 4],
      ['Code Compliance', 3],
      ['Other (22 causes)', 39],
      ['Not recorded', 6],
    ])
  })

  it('has no category panel, since the export has no Root Cause Category', () => {
    expect(index.hasRootCauseCategory).toBe(false)
    expect(model.categories).toBeNull()
  })
})
