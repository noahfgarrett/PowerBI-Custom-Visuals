import { describe, expect, it } from 'vitest'

import type { IssueColumns, IssueIndex } from '../types'
import { buildIssueIndex } from '../issues'

// The enriched Autodesk export's migration rules, ported from the HTML app's report.ts
// (legacyIssueValue, shouldIncludeIssue and normalizeIssue).

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
  rootCauseCategory: -1,
  bim360CreatedBy: 10,
  bim360CreatedOn: 11,
  bim360ClosedOn: 12,
  closedAt: 13,
}
const TODAY = new Date(2026, 9, 20) // Tuesday of WW43'2026
const LW = 'LotusWorks'
const OTHER = 'Other'
const MIGRATION_DATE = '7/27/2026'

type Cell = string | Date | null
interface EnrichedOptions {
  status?: Cell
  createdOn?: Cell
  updatedOn?: Cell
  createdBy?: Cell
  legacyCreatedBy?: Cell
  legacyCreatedOn?: Cell
  legacyClosedOn?: Cell
  closedAt?: Cell
}

/** A row in COLUMNS order. By default a native ACC issue: no legacy values, created by LotusWorks. */
function enriched(id: string, options: EnrichedOptions = {}): Cell[] {
  return [
    id,
    `Issue ${id}`,
    options.status ?? 'Open',
    'COR',
    'Bayside',
    options.createdOn ?? '10/13/2026',
    options.updatedOn ?? null,
    null,
    options.createdBy === undefined ? LW : options.createdBy,
    'Installation',
    options.legacyCreatedBy ?? null,
    options.legacyCreatedOn ?? null,
    options.legacyClosedOn ?? null,
    options.closedAt ?? null,
  ]
}

function indexOf(rows: Cell[][], columns: IssueColumns = COLUMNS): IssueIndex {
  return buildIssueIndex(rows, columns, TODAY)
}

function includedIds(rows: Cell[][], columns: IssueColumns = COLUMNS): string[] {
  return indexOf(rows, columns).issues.map((issue) => issue.id).sort()
}

describe('the include rule with legacy data', () => {
  it('counts a migrated issue whose BIM360 creator is LotusWorks, whatever Created by says', () => {
    const rows = [enriched('#1', { createdBy: 'Migration Account / Autodesk', legacyCreatedBy: LW, legacyCreatedOn: '10/15/22 3:45 PM' })]
    expect(includedIds(rows)).toEqual(['#1'])
  })

  it('excludes a migrated issue whose BIM360 creator is not LotusWorks, even when Created by is', () => {
    const index = indexOf([enriched('#1', { createdBy: LW, legacyCreatedBy: OTHER, legacyCreatedOn: '10/15/22 3:45 PM' })])
    expect(index.issues).toEqual([])
    expect(index.excludedRows).toBe(1)
  })

  it('lets the blank BIM360 creator decide when only BIM360_Created On is present', () => {
    const index = indexOf([enriched('#1', { createdBy: LW, legacyCreatedOn: '10/15/22 3:45 PM' })])
    expect(index.issues).toEqual([])
    expect(index.excludedRows).toBe(1)
  })

  it('lets the blank BIM360 creator decide when only BIM360_Closed On is present', () => {
    const index = indexOf([enriched('#1', { createdBy: LW, legacyClosedOn: '11/2/22 9:10 AM' })])
    expect(index.issues).toEqual([])
    expect(index.excludedRows).toBe(1)
  })

  it('counts a BIM360 date sent as a Date object as legacy data', () => {
    const index = indexOf([enriched('#1', { createdBy: LW, legacyCreatedOn: new Date(2022, 9, 15, 15, 45) })])
    expect(index.excludedRows).toBe(1)
  })

  it('treats whitespace-only legacy values as blank', () => {
    expect(includedIds([enriched('#1', { createdBy: LW, legacyCreatedBy: '  ', legacyCreatedOn: ' ', legacyClosedOn: '' })])).toEqual(['#1'])
  })
})

describe('the include rule without legacy data', () => {
  it('counts an issue whose Created by is LotusWorks', () => {
    expect(includedIds([enriched('#1', { createdBy: LW })])).toEqual(['#1'])
  })

  it('excludes an issue whose Created by is not LotusWorks', () => {
    const index = indexOf([enriched('#1', { createdBy: OTHER })])
    expect(index.issues).toEqual([])
    expect(index.excludedRows).toBe(1)
  })

  it('uses Created by when the enrichment slots are absent from the columns', () => {
    const { bim360CreatedBy, bim360CreatedOn, bim360ClosedOn, closedAt, ...standard } = COLUMNS
    expect([bim360CreatedBy, bim360CreatedOn, bim360ClosedOn, closedAt]).toEqual([10, 11, 12, 13])
    const rows = [enriched('#1', { createdBy: LW, legacyCreatedBy: OTHER }), enriched('#2', { createdBy: OTHER, legacyCreatedBy: LW })]
    expect(includedIds(rows, standard)).toEqual(['#1'])
  })
})

describe('the include rule with Created By unbound', () => {
  const unbound: IssueColumns = { ...COLUMNS, createdBy: -1 }

  it('counts every issue without legacy data', () => {
    expect(includedIds([enriched('#1', { createdBy: OTHER }), enriched('#2', { createdBy: null })], unbound)).toEqual(['#1', '#2'])
  })

  it('still lets the BIM360 creator decide for migrated issues', () => {
    const rows = [enriched('#1', { legacyCreatedBy: LW }), enriched('#2', { legacyCreatedBy: OTHER })]
    expect(includedIds(rows, unbound)).toEqual(['#1'])
  })
})

describe('the created date', () => {
  it('takes BIM360_Created On before Created on', () => {
    const [issue] = indexOf([enriched('#1', { createdOn: MIGRATION_DATE, legacyCreatedBy: LW, legacyCreatedOn: '10/15/22 3:45 PM' })]).issues
    expect(issue.createdWeek.label).toBe("WW41'2022")
    expect(issue.detail.createdOn).toBe('10/15/22')
  })

  it('falls back to Created on when BIM360_Created On is blank', () => {
    const [issue] = indexOf([enriched('#1', { createdOn: MIGRATION_DATE, legacyCreatedBy: LW, legacyCreatedOn: '  ' })]).issues
    expect(issue.createdWeek.label).toBe("WW31'2026")
  })

  it('reads a BIM360_Created On sent as a Date object', () => {
    const [issue] = indexOf([enriched('#1', { createdOn: MIGRATION_DATE, legacyCreatedBy: LW, legacyCreatedOn: new Date(2026, 6, 24, 16) })]).issues
    expect(issue.createdWeek.label).toBe("WW30'2026")
  })

  it('skips the issue when BIM360_Created On is present but not a date, as the app does', () => {
    const index = indexOf([enriched('#1', { createdOn: MIGRATION_DATE, legacyCreatedBy: LW, legacyCreatedOn: 'unknown' })])
    expect(index.issues).toEqual([])
    expect(index.skippedRows).toBe(1)
  })
})

describe('the closed date', () => {
  const closed = { status: 'Closed', legacyCreatedBy: LW, legacyCreatedOn: '9/1/22 8:00 AM' }

  it('takes BIM360_Closed On first', () => {
    const [issue] = indexOf([enriched('#1', { ...closed, legacyClosedOn: '11/2/22 9:10 AM', closedAt: '9/30/2026', updatedOn: '10/6/2026' })]).issues
    expect(issue.closedWeek?.label).toBe("WW44'2022")
    expect(issue.detail.workWeekClosed).toBe("WW44'2022")
  })

  it('takes Closed at when BIM360_Closed On is blank', () => {
    const [issue] = indexOf([enriched('#1', { ...closed, legacyClosedOn: ' ', closedAt: '9/30/2026', updatedOn: '10/6/2026' })]).issues
    expect(issue.closedWeek?.label).toBe("WW40'2026")
  })

  it('takes Updated on when BIM360_Closed On and Closed at are blank', () => {
    const [issue] = indexOf([enriched('#1', { ...closed, updatedOn: '10/6/2026' })]).issues
    expect(issue.closedWeek?.label).toBe("WW41'2026")
  })

  it('takes Updated on when the Closed At slot is unbound', () => {
    const [issue] = indexOf([enriched('#1', { ...closed, closedAt: '9/30/2026', updatedOn: '10/6/2026' })], { ...COLUMNS, closedAt: -1 }).issues
    expect(issue.closedWeek?.label).toBe("WW41'2026")
  })

  it('counts the closure in the BIM360 closed week', () => {
    const index = indexOf([enriched('#1', { ...closed, legacyClosedOn: '11/2/22 9:10 AM', updatedOn: MIGRATION_DATE })])
    const closedIn = index.weeks.filter((week) => week.closed > 0).map((week) => [week.week.label, week.closed])
    expect(closedIn).toEqual([["WW44'2022", 1]])
  })

  it('gives an open issue no closed week, even with a BIM360_Closed On', () => {
    const [issue] = indexOf([enriched('#1', { legacyCreatedBy: LW, legacyClosedOn: '11/2/22 9:10 AM' })]).issues
    expect(issue.closedWeek).toBeNull()
  })

  it('ages a closed issue to its BIM360 closed date', () => {
    // Created on → Updated on would be 49 days; BIM360_Created On → BIM360_Closed On is 9.
    const index = indexOf([enriched('#1', { ...closed, createdOn: '9/1/2026', legacyClosedOn: '9/10/22 4:00 PM', updatedOn: '10/20/2026' })])
    expect(index.overallAging.map((bucket) => bucket.closed)).toEqual([1, 0, 0])
  })
})
