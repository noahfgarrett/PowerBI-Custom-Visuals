import { describe, expect, it } from 'vitest'

import type { IssueColumns, ViewState } from '../types'
import { defaultViewState } from '../inspections'
import { buildIssueDetail, buildIssueIndex, buildIssueModel } from '../issues'
import { ISSUE_ROWS } from './fixtures/issueRows'

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
const TODAY = new Date(2026, 9, 15) // WW42'2026
const index = buildIssueIndex(ISSUE_ROWS, COLUMNS, TODAY)

function viewAt(key: number): ViewState {
  return { selectedKey: key, windowEndKey: 202642, range: 'recent', dateRange: null }
}

// Expected values are pinned to the seeded synthetic fixtures from scripts/generate-qaqc-fixtures.mjs.
describe('BIM Issues Log fixture', () => {
  it('reads 208 rows and keeps 177 included issues', () => {
    expect(index.totalRows).toBe(208)
    expect(index.issues).toHaveLength(177)
    expect(index.skippedRows).toBe(0)
    expect(index.futureRows).toBe(0)
  })

  it('holds no creator names, only the LotusWorks marker or blank', () => {
    expect(new Set(ISSUE_ROWS.map((row) => row[COLUMNS.createdBy]))).toEqual(new Set(['LotusWorks', '']))
  })

  it('excludes #1021–#1024 for a blank creator and #920 for a non-LotusWorks creator', () => {
    expect(index.excludedRows).toBe(5)
    const excluded = ISSUE_ROWS.filter((row) => row[COLUMNS.createdBy] !== 'LotusWorks').map((row) => row[0])
    expect(excluded).toEqual(['#1024', '#1023', '#1022', '#1021', '#920'])
  })

  it('drops the 26 void issues among the 203 LotusWorks rows', () => {
    const lotusWorks = ISSUE_ROWS.filter((row) => row[COLUMNS.createdBy] === 'LotusWorks')
    expect(lotusWorks).toHaveLength(203)
    const voids = lotusWorks.filter((row) => (row[2] ?? '').trim().toLowerCase() === 'void')
    expect(voids).toHaveLength(26)
    expect(lotusWorks.length - voids.length).toBe(index.issues.length)
  })

  it("starts at WW46'2024 and runs through WW42'2026", () => {
    expect(index.weeks[0].week.label).toBe("WW46'2024")
    expect(index.weeks[index.weeks.length - 1].week.label).toBe("WW42'2026")
  })

  it('matches the project-to-date cards through WW42', () => {
    const model = buildIssueModel(index, defaultViewState(index))
    expect(model.toDate.opened.value).toBe(177)
    expect(model.toDate.closed.value).toBe(126)
    expect(model.toDate.remaining.value).toBe(51)
    expect(model.toDate.closureRate.value).toBeCloseTo(71.19, 2)
  })

  it('has no activity in WW42 or WW41', () => {
    const ww42 = buildIssueModel(index, viewAt(202642))
    expect(ww42.thisWeek.opened.value).toBe(0)
    expect(ww42.thisWeek.closed.value).toBe(0)
    const ww41 = buildIssueModel(index, viewAt(202641))
    expect(ww41.thisWeek.opened.value).toBe(0)
    expect(ww41.thisWeek.closed.value).toBe(0)
  })

  it('matches the WW31, WW30 and WW28 week cards', () => {
    const ww31 = buildIssueModel(index, viewAt(202631))
    expect([ww31.thisWeek.opened.value, ww31.thisWeek.closed.value]).toEqual([3, 14])
    const ww30 = buildIssueModel(index, viewAt(202630))
    expect([ww30.thisWeek.opened.value, ww30.thisWeek.closed.value]).toEqual([1, 0])
    const ww28 = buildIssueModel(index, viewAt(202628))
    expect([ww28.thisWeek.opened.value, ww28.thisWeek.closed.value]).toEqual([3, 4])
  })

  it('puts all 51 open issues in the 4+ weeks aging bucket', () => {
    expect(index.openAging.map((bucket) => bucket.count)).toEqual([0, 0, 0, 0, 51])
    expect(index.openIssues).toHaveLength(51)
  })

  it('matches the overall aging buckets', () => {
    expect(index.overallAging.map((bucket) => [bucket.label, bucket.count])).toEqual([
      ['0-14 Days', 21],
      ['14-28 Days', 14],
      ['28+ Days', 142],
    ])
    expect(index.overallAging.map((bucket) => bucket.closed + bucket.open)).toEqual([21, 14, 142])
  })

  it('counts the WW31 Issue Detail this-week cards: 3 opened, 14 closed', () => {
    const detail = buildIssueDetail(index, 202631)
    expect([detail.openedThisWeek, detail.closedThisWeek]).toEqual([3, 14])
  })

  it('counts the WW32 Issue Detail last-week cards from WW31', () => {
    const detail = buildIssueDetail(index, 202632)
    expect([detail.openedLastWeek, detail.closedLastWeek]).toEqual([3, 14])
  })

  it('has only discussion rows in the WW42 Issue Detail', () => {
    const detail = buildIssueDetail(index, 202642)
    expect(detail.reportRows).toHaveLength(0)
    expect(detail.discussionRows).toHaveLength(51)
  })

  it('reports the 16 issues created or closed in WW31 in the WW32 Issue Detail', () => {
    const detail = buildIssueDetail(index, 202632)
    expect(detail.reportRows.map((row) => row.id)).toEqual([
      '#1020', '#1018', '#1016', '#1011', '#1004', '#1002', '#1001', '#998',
      '#996', '#995', '#987', '#983', '#981', '#976', '#968', '#960',
    ])
    expect(detail.discussionRows).toHaveLength(49)
  })

  it('keeps the status labels as given', () => {
    const counts = new Map<string, number>()
    for (const { detail } of index.issues) counts.set(detail.status, (counts.get(detail.status) ?? 0) + 1)
    expect(Object.fromEntries(counts)).toEqual({
      Closed: 126,
      Open: 43,
      'Not approved': 6,
      'Ready to Inspect': 1,
      'Ready to inspect': 1,
    })
  })

  it('records a Root Cause and a Root Cause Category for every included issue but #959, #907 and #472', () => {
    expect(index.hasRootCause).toBe(true)
    expect(index.hasRootCauseCategory).toBe(true)
    const blank = index.issues.filter((issue) => issue.rootCause === '' || issue.rootCauseCategory === '')
    expect(blank.map((issue) => [issue.id, issue.rootCause, issue.rootCauseCategory])).toEqual([
      ['#959', '', ''],
      ['#907', '', ''],
      ['#472', '', ''],
    ])
  })

  it('counts 46 Installation issues across 27 root causes, plus 3 blank, among the 177 included issues', () => {
    const causes = tally(index.issues.map((issue) => issue.rootCause))
    expect(causes.get('Installation')).toBe(46)
    expect(causes.get('')).toBe(3)
    expect(causes.size).toBe(28)
  })

  it('splits the included issues by Root Cause Category', () => {
    expect(Object.fromEntries(tally(index.issues.map((issue) => issue.rootCauseCategory)))).toEqual({
      Quality: 163,
      Design: 5,
      Coordination: 5,
      Safety: 1,
      '': 3,
    })
  })
})

function tally(values: string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return counts
}
