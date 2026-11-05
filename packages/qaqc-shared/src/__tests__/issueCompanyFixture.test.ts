import { describe, expect, it } from 'vitest'

import { issueDrillColumns, weekRows } from '../drilldown'
import { buildIssueBenchmarks } from '../issueBenchmarks'
import {
  buildIssueDetail,
  buildIssueIndex,
  buildIssueModel,
  issueDataWeeks,
  issueFilterFields,
  LOTUSWORKS_COMPANY,
} from '../issues'
import { buildFilterCatalog, groupKey, matchEffectiveRows, matchRows, type FilterSelection } from '../rowFilters'
import { buildRootCausePareto } from '../rootCauses'
import type { IssueIndex, ViewState } from '../types'
import { ENRICHED_ISSUE_ROWS } from './fixtures/enrichedIssueRows'
import { ENRICHED_COLUMNS as COLUMNS } from './issueFilterFixture'

const TODAY = new Date(2026, 10, 4) // WW45'2026, after the fixture's last update on 19 Oct

const CATALOG = buildFilterCatalog(ENRICHED_ISSUE_ROWS, issueFilterFields(COLUMNS))
const BASE = buildIssueIndex(ENRICHED_ISSUE_ROWS, COLUMNS, TODAY)
const AXIS_FROM = BASE.weeks[0].week.key

function companies(...names: readonly string[]): FilterSelection {
  return new Map([['company', new Set(names.map(groupKey))]])
}

function indexFor(selection: FilterSelection): IssueIndex {
  return buildIssueIndex(matchRows(ENRICHED_ISSUE_ROWS, CATALOG, selection), COLUMNS, TODAY, { includeAllCreators: true, axisFromKey: AXIS_FROM })
}

function allWeeksView(index: IssueIndex): ViewState {
  return { selectedKey: index.currentWeek.key, windowEndKey: index.currentWeek.key, range: 'all', dateRange: null }
}

// Expected values are pinned to the seeded synthetic fixtures from scripts/generate-qaqc-fixtures.mjs.
const THREE = companies(LOTUSWORKS_COMPANY, 'Greyfox', 'Bayside')
// Every Greyfox and Bayside issue in the fixture is closed, so Ivory - Ops adds the open issues the open-issue views
// need to show a difference.
const WITH_OPEN = companies(LOTUSWORKS_COMPANY, 'Greyfox', 'Bayside', 'Ivory - Ops')

describe('Created By (Company) on the enriched fixture', () => {
  it('company distribution is LotusWorks 231, Ivory - QA 392, Ivory - Ops 213, Ivory 189, Greyfox 19, Bayside 19, Larch 4, Not recorded 10, total 1,077', () => {
    const field = CATALOG.fields[0]
    expect(field.def.id).toBe('company')
    expect(field.options.map((option) => [option.label, option.count])).toEqual([
      ['Ivory - QA', 392],
      ['LotusWorks', 231],
      ['Ivory - Ops', 213],
      ['Ivory', 189],
      ['Bayside', 19],
      ['Greyfox', 19],
      ['Larch', 4],
      ['Not recorded', 10],
    ])
    expect(CATALOG.totalRows).toBe(1077)
  })

  it('LotusWorks + Greyfox + Bayside gives 269 opened, 213 closed, 56 remaining, 79.2%', () => {
    const { toDate } = buildIssueModel(indexFor(THREE), allWeeksView(BASE))
    expect(toDate.opened.value).toBe(269)
    expect(toDate.closed.value).toBe(213)
    expect(toDate.remaining.value).toBe(56)
    expect(toDate.closureRate.value?.toFixed(1)).toBe('79.2')
  })

  it('the default view equals today\'s visual exactly', () => {
    const { toDate } = buildIssueModel(BASE, allWeeksView(BASE))
    expect([toDate.opened.value, toDate.closed.value, toDate.remaining.value]).toEqual([231, 175, 56])
    const rebuilt = buildIssueIndex(matchEffectiveRows(ENRICHED_ISSUE_ROWS, CATALOG, companies(LOTUSWORKS_COMPANY)), COLUMNS, TODAY, { includeAllCreators: true })
    expect(rebuilt.weeks).toEqual(BASE.weeks)
    expect(rebuilt.issues.map((issue) => issue.id)).toEqual(BASE.issues.map((issue) => issue.id))
  })

  it('Showing X of Y counts every issue row', () => {
    expect(matchEffectiveRows(ENRICHED_ISSUE_ROWS, CATALOG, new Map())).toHaveLength(231)
    expect(matchRows(ENRICHED_ISSUE_ROWS, CATALOG, THREE)).toHaveLength(269)
    expect(CATALOG.totalRows).toBe(1077)
  })

  it('the menu\'s weeks reach back to the first week of any company, though the default view starts later', () => {
    expect(issueDataWeeks(ENRICHED_ISSUE_ROWS, COLUMNS, TODAY)[0].label).toBe("WW09'2022")
    expect(BASE.weeks[0].week.label).toBe("WW13'2022")
  })

  it('issue Detail, the Pareto and Issue Aging recalculate for selected companies', () => {
    const selected = indexFor(WITH_OPEN)
    const view = allWeeksView(selected)

    expect(selected.openAging.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(62)
    expect(selected.overallAging.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(482)

    const detail = buildIssueDetail(selected, selected.currentWeek.key)
    const baseDetail = buildIssueDetail(BASE, BASE.currentWeek.key)
    expect(detail.discussionRows).toHaveLength(62)
    expect(baseDetail.discussionRows).toHaveLength(56)

    expect(buildRootCausePareto(selected, view, 'all', TODAY).total).toBe(482)
    expect(buildRootCausePareto(BASE, view, 'all', TODAY).total).toBe(231)

    const benchmarks = buildIssueBenchmarks(selected, selected.currentWeek.key, TODAY)
    const baseBenchmarks = buildIssueBenchmarks(BASE, BASE.currentWeek.key, TODAY)
    expect(benchmarks.open).toHaveLength(62)
    expect(baseBenchmarks.open).toHaveLength(56)
  })

  it('a week\'s opened and closed groups equal the chart\'s numbers, with and without filters', () => {
    const three = indexFor(THREE)
    const threeRows = matchRows(ENRICHED_ISSUE_ROWS, CATALOG, THREE)
    const cases: ReadonlyArray<[IssueIndex, ReadonlyArray<ReadonlyArray<unknown>>]> = [[BASE, ENRICHED_ISSUE_ROWS], [three, threeRows]]
    const columns = issueDrillColumns(COLUMNS)
    const read = (label: string): ((row: ReadonlyArray<unknown>) => string) => {
      const column = columns.find((item) => item.label === label)
      if (column === undefined) throw new Error(`no column ${label}`)
      return column.read
    }
    for (const [index, rows] of cases) {
      index.weeks.forEach((counts) => {
        const key = counts.week.key
        const opened = weekRows(index.positionByKey, index.openedRowsByWeek, rows, key)
        const closed = weekRows(index.positionByKey, index.closedRowsByWeek, rows, key)
        expect(opened).toHaveLength(counts.opened)
        expect(closed).toHaveLength(counts.closed)
        for (const row of opened) expect(read('Work Week')(row)).toBe(counts.week.label)
        for (const row of closed) expect(read('Work Week Closed')(row)).toBe(counts.week.label)
      })
    }
  })
})
