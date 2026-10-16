import { describe, expect, it } from 'vitest'

import { buildFootnotes, buildIssueFootnotes, buildOverviewFootnotes } from '../footnotes'
import { buildInspectionIndex } from '../inspections'
import { buildIssueIndex } from '../issues'
import type { IssueColumns } from '../types'
import { bim, inspection, overviewIndexOf, weld } from './overviewRows'

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

describe('buildOverviewFootnotes', () => {
  it('is empty for clean data', () => {
    const index = overviewIndexOf([inspection('Electrical', "WW42'2026", 'Final'), weld("WW42'2026"), bim('#1', '10/13/2026')])
    expect(buildOverviewFootnotes(index, false)).toEqual([])
  })

  it('prefixes each source\'s skipped and future rows with the source', () => {
    const index = overviewIndexOf([
      inspection('Electrical', 'soon', 'Final'),
      inspection('Mechanical', "WW44'2026", 'SOR'),
      weld('not a week'),
      weld('UPW'),
      weld("WW50'2026"),
    ])
    expect(buildOverviewFootnotes(index, false)).toEqual([
      'Electrical: 1 row skipped: unreadable work week',
      "Mechanical: 1 row dated after WW42'2026 not counted",
      'Welding: 2 rows skipped: unreadable work week',
      "Welding: 1 row dated after WW42'2026 not counted",
    ])
  })

  it('words the BIM rows as issues: excluded creators, no Created On, and future issues', () => {
    const index = overviewIndexOf([
      bim('#1', null),
      bim('#2', '10/13/2026', { createdBy: 'Someone Else' }),
      bim('#3', '10/14/2026', { createdBy: 'Another Person' }),
      bim('#4', '12/1/2026'),
    ])
    expect(buildOverviewFootnotes(index, false)).toEqual([
      'BIM Issues: 2 issues not created by LotusWorks are excluded',
      'BIM Issues: 1 issue skipped: blank or unreadable Created On',
      "BIM Issues: 1 issue created after WW42'2026 not counted",
    ])
  })

  it('counts the rows with an unknown Source', () => {
    const civil = inspection('Electrical', "WW42'2026", 'Final')
    civil[0] = 'Civil'
    const blank = inspection('Electrical', "WW42'2026", 'Final')
    blank[0] = ''
    const index = overviewIndexOf([inspection('Electrical', "WW42'2026", 'Final'), civil, blank])
    expect(buildOverviewFootnotes(index, false)).toEqual(['2 rows with an unknown Source'])
  })

  it('uses the singular for one unknown Source row', () => {
    const civil = inspection('Electrical', "WW42'2026", 'Final')
    civil[0] = 'Civil'
    expect(buildOverviewFootnotes(overviewIndexOf([civil]), false)).toEqual(['1 row with an unknown Source'])
  })

  it('puts the row limit first, counting every combined row', () => {
    const civil = inspection('Electrical', "WW42'2026", 'Final')
    civil[0] = 'Civil'
    const index = overviewIndexOf([inspection('Electrical', "WW42'2026", 'Final'), weld('not a week'), bim('#1', '10/13/2026'), civil])
    expect(buildOverviewFootnotes(index, true)).toEqual([
      'Showing the first 4 rows (Power BI data limit)',
      'Welding: 1 row skipped: unreadable work week',
      '1 row with an unknown Source',
    ])
  })
})
