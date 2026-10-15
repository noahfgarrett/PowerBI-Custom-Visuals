import { describe, expect, it } from 'vitest'

import type { IssueColumns, ViewState } from '../types'
import { defaultViewState } from '../inspections'
import { buildIssueIndex, buildIssueModel } from '../issues'
import { ISSUE_ROWS } from './fixtures/issueRows'

const COLUMNS: IssueColumns = {
  id: 0,
  title: 1,
  status: 2,
  type: 3,
  contractor: 4,
  discipline: 5,
  createdOn: 6,
  updatedOn: 7,
  dueDate: 8,
  createdBy: 9,
}
const TODAY = new Date(2026, 9, 15) // WW42'2026
const index = buildIssueIndex(ISSUE_ROWS, COLUMNS, TODAY)

function viewAt(key: number): ViewState {
  return { selectedKey: key, windowEndKey: 202642, range: 'recent' }
}

describe('BIM Issues Log export (2026-10-14)', () => {
  it('reads 208 rows and keeps 177 included issues', () => {
    expect(ISSUE_ROWS).toHaveLength(208)
    expect(index.totalRows).toBe(208)
    expect(index.issues).toHaveLength(177)
    expect(index.skippedRows).toBe(0)
    expect(index.futureRows).toBe(0)
  })

  it('holds no creator names, only the LotusWorks marker or blank', () => {
    expect(new Set(ISSUE_ROWS.map((row) => row[9]))).toEqual(new Set(['LotusWorks', '']))
  })

  it('excludes #1021–#1024 for a blank creator and #920 for a non-LotusWorks creator', () => {
    expect(index.excludedRows).toBe(5)
    const excluded = ISSUE_ROWS.filter((row) => row[9] !== 'LotusWorks').map((row) => row[0])
    expect(excluded).toEqual(['#1024', '#1023', '#1022', '#1021', '#920'])
  })

  it('drops the 26 void issues among the 203 LotusWorks rows', () => {
    const lotusWorks = ISSUE_ROWS.filter((row) => row[9] === 'LotusWorks')
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
    expect([ww31.thisWeek.opened.value, ww31.thisWeek.closed.value]).toEqual([2, 1])
    const ww30 = buildIssueModel(index, viewAt(202630))
    expect([ww30.thisWeek.opened.value, ww30.thisWeek.closed.value]).toEqual([1, 1])
    const ww28 = buildIssueModel(index, viewAt(202628))
    expect([ww28.thisWeek.opened.value, ww28.thisWeek.closed.value]).toEqual([3, 4])
  })

  it('puts all 51 open issues in the 4+ weeks aging bucket', () => {
    expect(index.openAging.map((bucket) => bucket.count)).toEqual([0, 0, 0, 0, 51])
    expect(index.openIssues).toHaveLength(51)
  })

  it('matches the overall aging buckets', () => {
    expect(index.overallAging.map((bucket) => [bucket.label, bucket.count])).toEqual([
      ['0-14 Days', 38],
      ['14-28 Days', 19],
      ['28+ Days', 120],
    ])
    expect(index.overallAging.map((bucket) => bucket.closed + bucket.open)).toEqual([38, 19, 120])
  })

  it('has only discussion rows in the WW42 Issue Detail', () => {
    const { detail } = buildIssueModel(index, viewAt(202642))
    expect(detail.reportRows).toHaveLength(0)
    expect(detail.discussionRows).toHaveLength(51)
  })

  it('reports #1020, #1019 and #1004 in the WW32 Issue Detail', () => {
    const { detail } = buildIssueModel(index, viewAt(202632))
    expect(detail.reportRows.map((row) => row.id)).toEqual(['#1020', '#1019', '#1004'])
    expect(detail.discussionRows).toHaveLength(49)
  })

  it('keeps the status labels as given', () => {
    const counts = new Map<string, number>()
    for (const issue of index.issues) counts.set(issue.status, (counts.get(issue.status) ?? 0) + 1)
    expect(Object.fromEntries(counts)).toEqual({
      Closed: 126,
      Open: 43,
      'Not approved': 6,
      'Ready to Inspect': 1,
      'Ready to inspect': 1,
    })
  })
})
