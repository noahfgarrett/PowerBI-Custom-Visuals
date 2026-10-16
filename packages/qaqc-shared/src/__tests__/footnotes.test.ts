import { describe, expect, it } from 'vitest'

import { buildFootnotes, buildIssueFootnotes } from '../footnotes'
import { buildInspectionIndex } from '../inspections'
import { buildIssueIndex } from '../issues'
import type { IssueColumns } from '../types'

const COLUMNS = { workWeek: 0, phase: 1, issue: 2, building: 3 }
const TODAY = new Date(2026, 9, 15)

describe('buildFootnotes', () => {
  it('is empty for clean data', () => {
    const index = buildInspectionIndex([["WW42'2026", 'Final', '', 'A']], COLUMNS, TODAY)
    expect(buildFootnotes(index, false)).toEqual([])
  })

  it('explains skipped, future, and row-limit rows', () => {
    const index = buildInspectionIndex(
      [['UPW', 'Final', '', 'A'], ['', 'SOR', '', 'A'], ["WW50'2026", 'Final', '', 'A']],
      COLUMNS,
      TODAY,
    )
    expect(buildFootnotes(index, true)).toEqual([
      'Showing the first 3 rows (Power BI data limit)',
      '2 rows skipped: unreadable work week',
      "1 row dated after WW42'2026 not counted",
    ])
  })
})

const ISSUE_COLUMNS: IssueColumns = {
  id: 0,
  title: 1,
  status: 2,
  type: 3,
  contractor: 4,
  createdOn: 5,
  updatedOn: 6,
  dueDate: 7,
  createdBy: 8,
}

function issueRow(id: string, createdOn: string | null, createdBy = 'LotusWorks'): Array<string | null> {
  return [id, 'Title', 'Open', 'COR', 'Bayside', createdOn, null, null, createdBy]
}

describe('buildIssueFootnotes', () => {
  it('is empty for clean data', () => {
    const index = buildIssueIndex([issueRow('#1', '10/13/2026')], ISSUE_COLUMNS, TODAY)
    expect(buildIssueFootnotes(index, false)).toEqual([])
  })

  it('says how many rows the Power BI data limit cut off', () => {
    const index = buildIssueIndex([issueRow('#1', '10/13/2026')], ISSUE_COLUMNS, TODAY)
    expect(buildIssueFootnotes(index, true)).toEqual(['Showing the first 1 rows (Power BI data limit)'])
  })

  it('counts issues not created by LotusWorks as excluded', () => {
    const index = buildIssueIndex(
      [issueRow('#1', '10/13/2026', ''), issueRow('#2', '10/13/2026', 'No'), issueRow('#3', '10/13/2026')],
      ISSUE_COLUMNS,
      TODAY,
    )
    expect(buildIssueFootnotes(index, false)).toEqual(['2 issues not created by LotusWorks are excluded'])
  })

  it('words a blank or unreadable Created On as a Created On problem, not a work week', () => {
    const index = buildIssueIndex([issueRow('#1', null), issueRow('#2', 'soon'), issueRow('#3', '10/13/2026')], ISSUE_COLUMNS, TODAY)
    expect(buildIssueFootnotes(index, false)).toEqual(['2 issues skipped: blank or unreadable Created On'])
  })

  it('says how many issues were created after the current week', () => {
    const index = buildIssueIndex([issueRow('#1', '12/1/2026'), issueRow('#2', '10/13/2026')], ISSUE_COLUMNS, TODAY)
    expect(buildIssueFootnotes(index, false)).toEqual(["1 issue created after WW42'2026 not counted"])
  })

  it('uses the singular for one excluded issue', () => {
    const index = buildIssueIndex([issueRow('#1', '10/13/2026', '')], ISSUE_COLUMNS, TODAY)
    expect(buildIssueFootnotes(index, false)).toEqual(['1 issue not created by LotusWorks is excluded'])
  })
})
