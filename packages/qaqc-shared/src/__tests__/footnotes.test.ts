import { describe, expect, it } from 'vitest'

import { splitCombinedRows } from '../combined'
import { buildCombinedIssueFootnotes, buildFootnotes, buildIssueFootnotes, buildOverviewFootnotes, buildPerformanceFootnotes } from '../footnotes'
import { buildInspectionIndex } from '../inspections'
import { buildIssueIndex } from '../issues'
import { buildPerformanceIndex, buildPerformanceModel, type PerformanceGroup, type PerformanceIndex } from '../performance'
import type { CombinedColumns, IssueColumns } from '../types'
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
  rootCause: 9,
  rootCauseCategory: 10,
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

const PERFORMANCE_COLUMNS: CombinedColumns = {
  source: 0,
  workWeek: 1,
  phase: 2,
  issue: 3,
  building: 4,
  qcr: 5,
  welder: 6,
  tagNo: 7,
  signature: -1,
  signedWeek: -1,
  id: -1,
  status: -1,
  type: -1,
  createdOn: -1,
  updatedOn: -1,
  createdBy: -1,
  rootCause: -1,
  greenTags: -1,
}

type PerformanceRow = ReadonlyArray<string | null>

function qcrRow(week: string, phase: string, qcr: string | null): PerformanceRow {
  return ['Electrical', week, phase, 'No Issue Found', 'F63.1', qcr, null, null]
}

function weldRow(week: string, welder: string | null): PerformanceRow {
  return ['Welding', week, null, 'No', null, null, welder, 'TAG-1']
}

function performanceIndexOf(rows: PerformanceRow[]): PerformanceIndex {
  return buildPerformanceIndex(splitCombinedRows(rows, PERFORMANCE_COLUMNS.source), PERFORMANCE_COLUMNS, TODAY)
}

function performanceNotes(rows: PerformanceRow[], group: PerformanceGroup, rowLimitReached = false, range: 'recent' | 'all' = 'recent'): string[] {
  const index = performanceIndexOf(rows)
  const key = index.currentWeek.key
  const model = buildPerformanceModel(index, { selectedKey: key, windowEndKey: key, range, dateRange: null }, group, 1)
  return buildPerformanceFootnotes(index, group, model, rowLimitReached)
}

describe('buildPerformanceFootnotes', () => {
  it('is empty for clean data', () => {
    expect(performanceNotes([qcrRow("WW42'2026", 'Final', 'QCR 01'), weldRow("WW42'2026", 'Welder 001')], 'qcr')).toEqual([])
    expect(performanceNotes([qcrRow("WW42'2026", 'Final', 'QCR 01'), weldRow("WW42'2026", 'Welder 001')], 'welders')).toEqual([])
  })

  it('counts the period\'s finals with no QCR/FE in the QCR/FE view', () => {
    const rows = [qcrRow("WW42'2026", 'Final', null), qcrRow("WW41'2026", 'Final', 'N/A'), qcrRow("WW42'2026", 'Final', 'QCR 01')]
    expect(performanceNotes(rows, 'qcr')).toEqual(['2 finals have no QCR/FE'])
  })

  it('uses the singular for one final with no QCR/FE', () => {
    expect(performanceNotes([qcrRow("WW42'2026", 'Final', '')], 'qcr')).toEqual(['1 final has no QCR/FE'])
  })

  it('leaves SORs with no QCR/FE out of the count', () => {
    const rows = [qcrRow("WW42'2026", 'SOR', null), qcrRow("WW42'2026", 'SOR', 'N/A'), qcrRow("WW42'2026", 'Final', null)]
    expect(performanceNotes(rows, 'qcr')).toEqual(['1 final has no QCR/FE'])
  })

  it('hides the note when the only rows with no QCR/FE are SORs', () => {
    const rows = [qcrRow("WW42'2026", 'SOR', null), qcrRow("WW42'2026", 'Final', 'QCR 01')]
    expect(performanceNotes(rows, 'qcr')).toEqual([])
  })

  it('counts only the period\'s finals with no QCR/FE', () => {
    const rows = [qcrRow("WW42'2026", 'Final', null), qcrRow("WW02'2025", 'Final', null)]
    expect(performanceNotes(rows, 'qcr', false, 'recent')).toEqual(['1 final has no QCR/FE'])
    expect(performanceNotes(rows, 'qcr', false, 'all')).toEqual(['2 finals have no QCR/FE'])
  })

  it('counts the period\'s welds that list more than one welder in the welders view', () => {
    const rows = [weldRow("WW42'2026", 'Welder 001, Welder 002'), weldRow("WW41'2026", 'Welder 001,Welder 003'), weldRow("WW42'2026", 'Welder 001')]
    expect(performanceNotes(rows, 'welders')).toEqual(['2 welds list more than one welder; each welder is credited'])
  })

  it('uses the singular for one weld that lists more than one welder', () => {
    expect(performanceNotes([weldRow("WW42'2026", 'Welder 001, Welder 002')], 'welders')).toEqual([
      '1 weld lists more than one welder; each welder is credited',
    ])
  })

  it('keeps each group\'s note to its own view', () => {
    const rows = [qcrRow("WW42'2026", 'Final', null), weldRow("WW42'2026", 'Welder 001, Welder 002')]
    expect(performanceNotes(rows, 'qcr')).toEqual(['1 final has no QCR/FE'])
    expect(performanceNotes(rows, 'welders')).toEqual(['1 weld lists more than one welder; each welder is credited'])
  })

  it('explains the view\'s skipped and future rows', () => {
    const rows = [
      qcrRow('UPW', 'Final', 'QCR 01'),
      qcrRow("WW50'2026", 'Final', 'QCR 01'),
      weldRow('not a week', 'Welder 001'),
      weldRow('', 'Welder 001'),
    ]
    expect(performanceNotes(rows, 'qcr')).toEqual(['1 row skipped: unreadable work week', "1 row dated after WW42'2026 not counted"])
    expect(performanceNotes(rows, 'welders')).toEqual(['2 rows skipped: unreadable work week'])
  })

  it('does not count SORs as skipped or future rows in the QCR/FE view', () => {
    const rows = [qcrRow('UPW', 'SOR', 'QCR 01'), qcrRow("WW50'2026", 'SOR', 'QCR 01'), qcrRow("WW42'2026", 'Final', 'QCR 01')]
    expect(performanceNotes(rows, 'qcr')).toEqual([])
  })

  it('counts the rows with an unknown Source last', () => {
    const civil: PerformanceRow = ['Civil', "WW42'2026", 'Final', null, null, 'QCR 01', null, null]
    const blank: PerformanceRow = ['', "WW42'2026", 'Final', null, null, 'QCR 01', null, null]
    expect(performanceNotes([qcrRow("WW42'2026", 'Final', null), civil, blank], 'qcr')).toEqual([
      '1 final has no QCR/FE',
      '2 rows with an unknown Source',
    ])
    expect(performanceNotes([civil], 'welders')).toEqual(['1 row with an unknown Source'])
  })

  it('puts the row limit first, counting every combined row', () => {
    const bimRow: PerformanceRow = ['BIM', null, null, null, null, null, null, null]
    const rows = [qcrRow("WW42'2026", 'Final', 'QCR 01'), weldRow("WW42'2026", 'Welder 001'), bimRow, bimRow]
    expect(performanceNotes(rows, 'qcr', true)).toEqual(['Showing the first 4 rows (Power BI data limit)'])
    expect(performanceNotes(rows, 'welders', true)).toEqual(['Showing the first 4 rows (Power BI data limit)'])
  })
})

describe('buildCombinedIssueFootnotes', () => {
  it('has nothing to say with every Source known and every slot bound', () => {
    expect(buildCombinedIssueFootnotes(0, [])).toEqual([])
  })

  it('notes rows with an unknown Source, in the Overview\'s wording, then the slots NCR Pass Rate needs', () => {
    expect(buildCombinedIssueFootnotes(1, ['Inspection Phase'])).toEqual(['1 row with an unknown Source', 'NCR Pass Rate hidden: add Inspection Phase'])
    expect(buildCombinedIssueFootnotes(1_200, ['Work Week', 'Issue'])).toEqual(['1,200 rows with an unknown Source', 'NCR Pass Rate hidden: add Work Week, Issue'])
  })
})
