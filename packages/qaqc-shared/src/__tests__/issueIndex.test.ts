import { describe, expect, it } from 'vitest'

import type { IssueColumns } from '../types'
import { NAME_COLLATOR } from '../format'
import {
  buildIssueIndex,
  issueCompanyOf,
  issueDataWeeks,
  issueFilterFields,
  issueFilterRows,
  issueRowWeekKey,
  LOTUSWORKS_COMPANY,
} from '../issues'
import { buildFilterCatalog, matchRows } from '../rowFilters'

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
const TODAY = new Date(2026, 9, 15) // Thursday of WW42'2026
const LW = 'LotusWorks'

type Cell = string | number | Date | null
interface IssueOptions {
  status?: Cell
  updatedOn?: Cell
  createdBy?: Cell
  contractor?: Cell
  type?: Cell
  title?: Cell
  dueDate?: Cell
  rootCause?: Cell
  rootCauseCategory?: Cell
}

function issue(id: string, createdOn: Cell, options: IssueOptions = {}): Cell[] {
  return [
    id,
    options.title === undefined ? `Issue ${id}` : options.title,
    options.status === undefined ? 'Open' : options.status,
    options.type === undefined ? 'COR' : options.type,
    options.contractor === undefined ? 'Bayside' : options.contractor,
    createdOn,
    options.updatedOn ?? null,
    options.dueDate ?? null,
    options.createdBy === undefined ? LW : options.createdBy,
    options.rootCause ?? null,
    options.rootCauseCategory ?? null,
  ]
}

describe('buildIssueIndex', () => {
  it('holds only the current week when there are no rows', () => {
    const index = buildIssueIndex([], COLUMNS, TODAY)
    expect(index.weeks).toHaveLength(1)
    expect(index.weeks[0]).toMatchObject({ opened: 0, closed: 0 })
    expect(index.weeks[0].week.label).toBe("WW42'2026")
    expect(index.cumulativeOpened).toEqual([0])
    expect(index.issues).toEqual([])
    expect(index.totalRows).toBe(0)
  })

  it('builds continuous weeks from the first created week to the current week', () => {
    const index = buildIssueIndex([issue('#2', '9/30/2026'), issue('#1', '10/5/2026')], COLUMNS, TODAY)
    expect(index.weeks.map((item) => item.week.label)).toEqual(["WW40'2026", "WW41'2026", "WW42'2026"])
    expect(index.weeks.map((item) => item.opened)).toEqual([1, 1, 0])
    expect(index.positionByKey.get(202641)).toBe(1)
  })

  it('fills gaps across a year boundary', () => {
    const index = buildIssueIndex([issue('#1', '12/16/2025'), issue('#2', '1/6/2026')], COLUMNS, TODAY)
    expect(index.weeks.slice(0, 4).map((item) => item.week.label)).toEqual([
      "WW51'2025",
      "WW52'2025",
      "WW01'2026",
      "WW02'2026",
    ])
    expect(index.weeks[1].opened).toBe(0)
  })

  it('counts rows excluded by creator before anything else', () => {
    const index = buildIssueIndex(
      [
        issue('#1', '10/5/2026', { createdBy: '' }),
        issue('#2', '10/5/2026', { createdBy: 'No' }),
        issue('#3', '10/5/2026', { createdBy: 'Other', status: 'Void' }),
        issue('#4', null, { createdBy: null }),
        issue('#5', '10/5/2026'),
      ],
      COLUMNS,
      TODAY,
    )
    expect(index.excludedRows).toBe(4)
    expect(index.skippedRows).toBe(0)
    expect(index.issues.map((record) => record.id)).toEqual(['#5'])
  })

  it('leaves void issues out of every count', () => {
    const index = buildIssueIndex(
      [issue('#1', '10/5/2026', { status: ' void ' }), issue('#2', null, { status: 'Void' })],
      COLUMNS,
      TODAY,
    )
    expect(index.issues).toEqual([])
    expect(index.skippedRows).toBe(0)
    expect(index.excludedRows).toBe(0)
    expect(index.cumulativeOpened[index.cumulativeOpened.length - 1]).toBe(0)
  })

  it('skips blank or unreadable Created On and counts future created weeks apart', () => {
    const index = buildIssueIndex(
      [issue('#1', '10/5/2026'), issue('#2', null), issue('#3', 'soon'), issue('#4', '10/20/2026')],
      COLUMNS,
      TODAY,
    )
    expect(index.totalRows).toBe(4)
    expect(index.skippedRows).toBe(2)
    expect(index.futureRows).toBe(1)
    expect(index.issues.map((record) => record.id)).toEqual(['#1'])
  })

  it('counts a closed issue in the ISO week of its Updated On', () => {
    const index = buildIssueIndex(
      [issue('#1', '9/30/2026', { status: 'Closed', updatedOn: '10/14/2026' })],
      COLUMNS,
      TODAY,
    )
    expect(index.weeks.map((item) => item.closed)).toEqual([0, 0, 1])
    expect(index.issues[0].closedWeek?.label).toBe("WW42'2026")
  })

  it('never closes an open, pending or undated closed issue', () => {
    const index = buildIssueIndex(
      [
        issue('#1', '9/30/2026', { status: 'Open', updatedOn: '10/6/2026' }),
        issue('#2', '9/30/2026', { status: 'Pending', updatedOn: '10/6/2026' }),
        issue('#3', '9/30/2026', { status: 'Closed' }),
        issue('#4', '9/30/2026', { status: 'Closed', updatedOn: 'later' }),
      ],
      COLUMNS,
      TODAY,
    )
    expect(index.cumulativeClosed).toEqual([0, 0, 0])
    expect(index.issues.every((record) => record.closedWeek === null)).toBe(true)
  })

  it('does not count a closed week after the current week', () => {
    const index = buildIssueIndex(
      [issue('#1', '9/30/2026', { status: 'Closed', updatedOn: '11/2/2026' })],
      COLUMNS,
      TODAY,
    )
    expect(index.cumulativeClosed).toEqual([0, 0, 0])
    expect(index.futureRows).toBe(0)
  })

  it('counts a closed issue in its Updated On week even when that is before its created week, like the app', () => {
    const index = buildIssueIndex(
      [issue('#1', '10/6/2026', { status: 'Closed', updatedOn: '9/29/2026' }), issue('#2', '9/28/2026')],
      COLUMNS,
      TODAY,
    )
    const closedIssue = index.issues.find((record) => record.id === '#1')
    expect(closedIssue?.closedWeek?.label).toBe("WW40'2026")
    expect(index.weeks.map((item) => item.week.key)).toEqual([202640, 202641, 202642])
    expect(index.weeks.map((item) => item.closed)).toEqual([1, 0, 0])
  })

  it('starts the weeks at a closed week before the first created week', () => {
    const index = buildIssueIndex(
      [issue('#1', '10/6/2026', { status: 'Closed', updatedOn: '9/29/2026' })],
      COLUMNS,
      TODAY,
    )
    expect(index.weeks[0].week.label).toBe("WW40'2026")
    expect(index.cumulativeClosed[index.cumulativeClosed.length - 1]).toBe(1)
  })

  it('keeps cumulative totals parallel to the weeks', () => {
    const index = buildIssueIndex(
      [
        issue('#1', '9/28/2026', { status: 'Closed', updatedOn: '10/6/2026' }),
        issue('#2', '9/29/2026'),
        issue('#3', '10/7/2026', { status: 'Closed', updatedOn: '10/8/2026' }),
      ],
      COLUMNS,
      TODAY,
    )
    expect(index.cumulativeOpened).toEqual([2, 3, 3])
    expect(index.cumulativeClosed).toEqual([0, 2, 2])
  })

  it('sorts issues by ID descending, numeric-aware', () => {
    const index = buildIssueIndex(
      [issue('#999', '10/5/2026'), issue('#1004', '10/5/2026'), issue('#1020', '10/5/2026'), issue('#98', '10/5/2026')],
      COLUMNS,
      TODAY,
    )
    expect(index.issues.map((record) => record.id)).toEqual(['#1020', '#1004', '#999', '#98'])
  })

  it('sorts IDs with different prefixes or no digits like a numeric-aware collator', () => {
    const index = buildIssueIndex(
      [
        issue('A-5', '10/5/2026'),
        issue('B-3', '10/5/2026'),
        issue('#A9', '10/5/2026'),
        issue('#a10', '10/5/2026'),
        issue('abc', '10/5/2026'),
        issue('ABD', '10/5/2026'),
        issue('#007', '10/5/2026'),
        issue('#8', '10/5/2026'),
      ],
      COLUMNS,
      TODAY,
    )
    expect(index.issues.map((record) => record.id)).toEqual(['B-3', 'ABD', 'abc', 'A-5', '#a10', '#A9', '#8', '#007'])
  })

  it('orders any mix of IDs exactly as a numeric-aware collator would, descending', () => {
    const handPicked = [
      '#1020', '#999', '#98', '#007', '#7', '#07', 'A-5', 'a-10', 'B-3', 'b-03', 'abc', 'ABC', 'ABD', '#A9', '#a10',
      'no digits', 'NO DIGITS', '12', '012', 'x9y', 'x9y10', '#123456789012345', '#123456789012346',
      '#1234567890123456', '#1234567890123457', '#99999999999999999999', '#5',
    ]
    // A seeded generator, so the mix is the same on every run.
    let seed = 20261015
    const next = (limit: number): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed % limit
    }
    const prefixes = ['#', '#A', '#a', 'B-', 'b-', 'ISS-', '']
    const generated = Array.from({ length: 400 }, () => {
      const prefix = prefixes[next(prefixes.length)]
      const zeros = '0'.repeat(next(3))
      const digitCount = next(5) === 0 ? 16 + next(6) : 1 + next(4)
      const digits = Array.from({ length: digitCount }, () => String(next(10))).join('')
      return next(12) === 0 ? `${prefix}none` : `${prefix}${zeros}${digits}`
    })
    const ids = [...handPicked, ...generated]
    const index = buildIssueIndex(ids.map((id) => issue(id, '10/5/2026')), COLUMNS, TODAY)
    expect(index.issues.map((record) => record.id)).toEqual(ids.slice().sort((a, b) => NAME_COLLATOR.compare(b, a)))
  })

  it('normalizes each issue with the app defaults', () => {
    const index = buildIssueIndex(
      [
        issue('#1021', '10/5/2026', { contractor: '', type: '', title: '  ', status: 'pending' }),
        issue('#7', '10/5/2026', { contractor: null, status: '' }),
      ],
      COLUMNS,
      TODAY,
    )
    const [first, second] = index.issues
    expect(first).toMatchObject({
      id: '#1021',
      contractor: 'Unassigned',
      subtype: 'Uncategorized',
      title: 'Untitled issue',
      statusKind: 'pending',
    })
    expect(first.detail.status).toBe('Open')
    expect(second).toMatchObject({ id: '#7', contractor: 'Unassigned', statusKind: 'open' })
    expect(second.detail.status).toBe('Open')
  })

  it('trims Root Cause and Root Cause Category, keeping blanks empty', () => {
    const index = buildIssueIndex(
      [
        issue('#3', '10/5/2026', { rootCause: '  Installation ', rootCauseCategory: ' Quality\t' }),
        issue('#2', '10/5/2026', { rootCause: '   ', rootCauseCategory: '' }),
        issue('#1', '10/5/2026'),
      ],
      COLUMNS,
      TODAY,
    )
    expect(index.issues.map((record) => [record.id, record.rootCause, record.rootCauseCategory])).toEqual([
      ['#3', 'Installation', 'Quality'],
      ['#2', '', ''],
      ['#1', '', ''],
    ])
  })

  it('flags Root Cause and Root Cause Category as bound when their slots are, even if every value is blank', () => {
    const index = buildIssueIndex([issue('#1', '10/5/2026')], COLUMNS, TODAY)
    expect(index.hasRootCause).toBe(true)
    expect(index.hasRootCauseCategory).toBe(true)
  })

  it('reads empty root causes and flags both unbound when the slots are −1', () => {
    const index = buildIssueIndex(
      [issue('#1', '10/5/2026', { rootCause: 'Installation', rootCauseCategory: 'Quality' })],
      { ...COLUMNS, rootCause: -1, rootCauseCategory: -1 },
      TODAY,
    )
    expect(index.hasRootCause).toBe(false)
    expect(index.hasRootCauseCategory).toBe(false)
    expect(index.issues[0]).toMatchObject({ rootCause: '', rootCauseCategory: '' })
  })

  it('accepts Date objects and Excel serials as dates', () => {
    const index = buildIssueIndex(
      [issue('#1', new Date(2026, 9, 5, 0, 0), { status: 'Closed', updatedOn: 46309 })],
      COLUMNS,
      TODAY,
    )
    expect(index.issues[0].createdWeek.label).toBe("WW41'2026")
    expect(index.issues[0].closedWeek?.label).toBe("WW42'2026")
  })

  it('formats each detail row once', () => {
    const index = buildIssueIndex(
      [
        issue('#3', '10/5/2026', { status: 'Closed', updatedOn: '10/14/2026', dueDate: '10/9/2026' }),
        issue('#2', '10/5/2026', { status: 'Closed' }),
        issue('#1', '10/5/2026', { status: 'Pending' }),
      ],
      COLUMNS,
      TODAY,
    )
    const [closed, undated, pending] = index.issues.map((record) => record.detail)
    expect(closed).toMatchObject({
      id: '#3',
      subtype: 'COR',
      status: 'Closed',
      statusKind: 'closed',
      title: 'Issue #3',
      contractor: 'Bayside',
      workWeek: "WW41'2026",
      workWeekKey: 202641,
      createdOn: '10/05/26',
      workWeekClosed: "WW42'2026",
      workWeekClosedKey: 202642,
      dueDate: '10/09/26',
    })
    expect(closed.createdOnTime).toBe(new Date(2026, 9, 5, 12).getTime())
    expect(closed.dueDateTime).toBe(new Date(2026, 9, 9, 12).getTime())
    expect(undated).toMatchObject({ workWeekClosed: '', workWeekClosedKey: null, dueDate: '', dueDateTime: null })
    expect(pending).toMatchObject({ status: 'Open', statusKind: 'pending', workWeekClosed: 'Open' })
  })

  it('buckets open and pending issues by age in weeks as of today', () => {
    const index = buildIssueIndex(
      [
        issue('#1', '10/15/2026'), // 0 days
        issue('#2', '10/9/2026'), // 6
        issue('#3', '10/8/2026', { status: 'Pending' }), // 7
        issue('#4', '10/1/2026'), // 14
        issue('#5', '9/24/2026'), // 21
        issue('#6', '9/18/2026'), // 27
        issue('#7', '9/17/2026'), // 28
        issue('#8', '9/1/2026', { status: 'Closed', updatedOn: '9/2/2026' }),
      ],
      COLUMNS,
      TODAY,
    )
    expect(index.openAging).toEqual([
      { label: '0-1', count: 2 },
      { label: '1-2', count: 1 },
      { label: '2-3', count: 1 },
      { label: '3-4', count: 2 },
      { label: '4+', count: 1 },
    ])
  })

  it('ages closed issues to their closed date and the rest to today, split by state', () => {
    const index = buildIssueIndex(
      [
        issue('#1', '9/1/2026', { status: 'Closed', updatedOn: '9/14/2026' }), // 13, closed
        issue('#2', '9/1/2026', { status: 'Closed', updatedOn: '9/15/2026' }), // 14, closed
        issue('#3', '9/1/2026', { status: 'Closed', updatedOn: '9/29/2026' }), // 28, closed
        issue('#4', '9/1/2026', { status: 'Closed' }), // undated: 44 to today, closed
        issue('#5', '10/2/2026'), // 13, open
        issue('#6', '10/1/2026', { status: 'Pending' }), // 14, open
      ],
      COLUMNS,
      TODAY,
    )
    expect(index.overallAging).toEqual([
      { label: '0-14 Days', count: 2, closed: 1, open: 1 },
      { label: '14-28 Days', count: 2, closed: 1, open: 1 },
      { label: '28+ Days', count: 2, closed: 2, open: 0 },
    ])
  })

  it('lists open and pending issues oldest first, then by ID', () => {
    const index = buildIssueIndex(
      [
        issue('#10', '10/1/2026'),
        issue('#9', '9/1/2026', { status: 'Pending', contractor: '' }),
        issue('#11', '9/1/2026'),
        issue('#12', '8/1/2026', { status: 'Closed', updatedOn: '8/2/2026' }),
      ],
      COLUMNS,
      TODAY,
    )
    expect(index.openIssues.map((row) => row.id)).toEqual(['#9', '#11', '#10'])
    expect(index.openIssues[0]).toEqual({
      id: '#9',
      // The lowest of #9–#12.
      idRank: 0,
      title: 'Issue #9',
      contractor: 'Unassigned',
      createdOn: '09/01/26',
      createdOnTime: new Date(2026, 8, 1, 12).getTime(),
      ageDays: 44,
      status: 'Open',
    })
  })
})

describe('buildIssueIndex today', () => {
  it('keeps the noon of the day it was built for, so as-of-week ages use the same today', () => {
    const index = buildIssueIndex([issue('#1', '10/5/2026')], COLUMNS, new Date(2026, 9, 15, 8, 30))
    expect(index.today).toEqual(new Date(2026, 9, 15, 12))
  })
})

describe('buildIssueIndex over every creator', () => {
  const ROWS = [
    issue('#1', '10/5/2026', { createdBy: 'Other' }),
    issue('#2', '10/6/2026'),
    issue('#3', '10/7/2026', { createdBy: 'Other', status: 'Void' }),
    issue('#4', 'not a date', { createdBy: 'Other' }),
    issue('#5', '12/1/2026', { createdBy: 'Other' }),
  ]

  it('keeps the LotusWorks rule by default', () => {
    const index = buildIssueIndex(ROWS, COLUMNS, TODAY)
    expect(index.issues.map((item) => item.id)).toEqual(['#2'])
    expect(index.excludedRows).toBe(4)
  })

  it('counts every creator with includeAllCreators, leaving the void, undated and future rules as they are', () => {
    const index = buildIssueIndex(ROWS, COLUMNS, TODAY, { includeAllCreators: true })
    expect(index.issues.map((item) => item.id)).toEqual(['#2', '#1'])
    expect(index.excludedRows).toBe(0)
    expect(index.skippedRows).toBe(1)
    expect(index.futureRows).toBe(1)
  })
})

describe('buildIssueIndex axisFromKey', () => {
  it('starts the axis at axisFromKey when that is before the first data week', () => {
    const index = buildIssueIndex([issue('#1', '10/5/2026')], COLUMNS, TODAY, { axisFromKey: 202638 })
    expect(index.weeks[0].week.label).toBe("WW38'2026")
    expect(index.positionByKey.get(202641)).toBe(3)
    expect(index.cumulativeOpened).toEqual([0, 0, 0, 1, 1])
  })

  it('never shortens the axis when a row is earlier than axisFromKey', () => {
    const index = buildIssueIndex([issue('#1', '9/30/2026')], COLUMNS, TODAY, { axisFromKey: 202641 })
    expect(index.weeks[0].week.label).toBe("WW40'2026")
  })

  it('holds the axis with no rows at all', () => {
    const index = buildIssueIndex([], COLUMNS, TODAY, { axisFromKey: 202640 })
    expect(index.weeks.map((item) => item.opened)).toEqual([0, 0, 0])
  })
})

describe('the weeks behind each count', () => {
  const ROWS = [
    issue('#1', '10/5/2026', { status: 'Closed', updatedOn: '10/6/2026' }), // opened and closed WW41
    issue('#2', '9/30/2026', { status: 'Closed', updatedOn: '10/14/2026' }), // opened WW40, closed WW42
    issue('#3', '9/30/2026', { status: 'Closed' }), // opened WW40, closed with no date
    issue('#4', '9/30/2026'), // opened WW40, still open
    issue('#5', '10/5/2026', { status: 'Void' }),
    issue('#6', '10/5/2026', { createdBy: 'Other', status: 'Closed', updatedOn: '10/5/2026' }),
    issue('#7', '10/5/2026', { status: 'Closed', updatedOn: '12/1/2026' }), // opened WW41, closed after the current week
  ]
  const index = buildIssueIndex(ROWS, COLUMNS, TODAY)

  it('lists the positions of the rows behind opened and closed, per week', () => {
    expect(index.weeks.map((item) => item.week.key)).toEqual([202640, 202641, 202642])
    expect(index.openedRowsByWeek).toEqual([[1, 2, 3], [0, 6], []])
    expect(index.closedRowsByWeek).toEqual([[], [0], [1]])
  })

  it('every week\'s lists are as long as its counts', () => {
    index.weeks.forEach((counts, position) => {
      expect(index.openedRowsByWeek[position]).toHaveLength(counts.opened)
      expect(index.closedRowsByWeek[position]).toHaveLength(counts.closed)
    })
  })

  it('counts issues now closed by the week they were created, dated or not', () => {
    expect(index.closedByCreatedWeek).toEqual([2, 2, 0])
  })

  it('positions index the rows the index was built from', () => {
    const subset = [ROWS[3], ROWS[0]]
    expect(buildIssueIndex(subset, COLUMNS, TODAY).openedRowsByWeek).toEqual([[0], [1], []])
  })
})

const COMPANY_COLUMNS: IssueColumns = { ...COLUMNS, createdByCompany: 11, discipline: 12 }

function companyRow(id: string, createdBy: string, company: string | null, options: IssueOptions = {}): Cell[] {
  const row = issue(id, '10/5/2026', { createdBy, ...options })
  return [...row, company, 'Electrical']
}

describe('issueCompanyOf', () => {
  it('reads LotusWorks when the include rule says so, whatever the company column holds', () => {
    expect(issueCompanyOf(companyRow('#1', LW, 'Ivory'), COMPANY_COLUMNS)).toBe(LOTUSWORKS_COMPANY)
  })

  it('reads the trimmed company otherwise', () => {
    expect(issueCompanyOf(companyRow('#1', 'Other', '  Greyfox '), COMPANY_COLUMNS)).toBe('Greyfox')
  })

  it('reads blank as empty', () => {
    expect(issueCompanyOf(companyRow('#1', 'Other', null), COMPANY_COLUMNS)).toBe('')
  })

  it('decides by the BIM360 creator on a migrated issue', () => {
    const columns: IssueColumns = { ...COMPANY_COLUMNS, bim360CreatedBy: 13 }
    expect(issueCompanyOf([...companyRow('#1', LW, 'Ivory'), 'Other'], columns)).toBe('Ivory')
    expect(issueCompanyOf([...companyRow('#1', 'Other', 'Ivory'), LW], columns)).toBe(LOTUSWORKS_COMPANY)
  })
})

describe('issueFilterFields', () => {
  it('lists the fields in the menu order when all are bound', () => {
    expect(issueFilterFields(COMPANY_COLUMNS).map((field) => field.label)).toEqual([
      'Created By (Company)',
      'Contractor',
      'Status',
      'Type',
      'Discipline',
      'Root Cause',
    ])
  })

  it('defaults Created By (Company) to LotusWorks, with Select all', () => {
    const company = issueFilterFields(COMPANY_COLUMNS)[0]
    expect(company.defaultKeys).toEqual(['lotusworks'])
    expect(company.hasSelectAll).toBe(true)
  })

  it('offers no company field when the slot is unbound, and no slots that are unbound', () => {
    const columns: IssueColumns = { ...COLUMNS, rootCause: -1 }
    expect(issueFilterFields(columns).map((field) => field.id)).toEqual(['contractor', 'status', 'type'])
    expect(issueFilterFields({ ...columns, createdByCompany: -1, discipline: -1 }).map((field) => field.id)).toEqual(['contractor', 'status', 'type'])
  })

  function optionsOf(id: string, rows: Cell[][]): Array<[string, number]> {
    const catalog = buildFilterCatalog(rows, issueFilterFields(COMPANY_COLUMNS))
    const field = catalog.fields.find((item) => item.def.id === id)
    return field?.options.map((option) => [option.label, option.count]) ?? []
  }

  it('Contractor reads as the charts do: blank is Unassigned and listed last', () => {
    const rows = [
      companyRow('#1', LW, null, { contractor: 'Greyfox' }),
      companyRow('#2', LW, null, { contractor: 'greyfox ' }),
      companyRow('#3', LW, null, { contractor: null }),
      companyRow('#1021', LW, null, { contractor: null }),
      companyRow('#4', LW, null, { contractor: 'Unassigned' }),
      companyRow('#5', LW, null, { contractor: 'N/A' }),
    ]
    expect(optionsOf('contractor', rows)).toEqual([['Greyfox', 2], ['N/A', 1], ['Unassigned', 3]])
  })

  it('Status lists the sheet\'s values, with Pending apart from Open and Void as a value of its own', () => {
    const rows = ['Open', 'OPEN', 'Pending', 'Void', 'Closed'].map((status, position) => companyRow(`#${position}`, LW, null, { status }))
    expect(optionsOf('status', rows)).toEqual([['Open', 2], ['Closed', 1], ['Pending', 1], ['Void', 1]])
  })

  it('Type reads as Issue Detail does: blank is Uncategorized', () => {
    const rows = [companyRow('#1', LW, null, { type: 'COR' }), companyRow('#2', LW, null, { type: null })]
    expect(optionsOf('type', rows)).toEqual([['COR', 1], ['Uncategorized', 1]])
  })

  it('Root Cause groups as the Pareto does: interior spacing merges, N/A stays a cause, blank is Not recorded', () => {
    const rows = [
      companyRow('#1', LW, null, { rootCause: 'Trade  Damage' }),
      companyRow('#2', LW, null, { rootCause: 'trade damage' }),
      companyRow('#3', LW, null, { rootCause: 'N/A' }),
      companyRow('#4', LW, null, { rootCause: null }),
    ]
    expect(optionsOf('rootCause', rows)).toEqual([['Trade  Damage', 2], ['N/A', 1], ['Not recorded', 1]])
  })

  it('a filter on another field keeps the company default', () => {
    const rows = [
      companyRow('#1', LW, null, { status: 'Open' }),
      companyRow('#2', 'Other', 'Greyfox', { status: 'Open' }),
      companyRow('#3', LW, null, { status: 'Closed', updatedOn: '10/6/2026' }),
    ]
    const catalog = buildFilterCatalog(rows, issueFilterFields(COMPANY_COLUMNS))
    const matched = matchRows(rows, catalog, new Map([['status', new Set(['open'])]]))
    expect(buildIssueIndex(matched, COMPANY_COLUMNS, TODAY, { includeAllCreators: true }).issues.map((item) => item.id)).toEqual(['#1'])
  })

  it('a void row is listed and counted, and its value alone leaves no issues', () => {
    const rows = [companyRow('#1', LW, null, { status: 'Void' }), companyRow('#2', LW, null)]
    const catalog = buildFilterCatalog(rows, issueFilterFields(COMPANY_COLUMNS))
    const matched = matchRows(rows, catalog, new Map([['status', new Set(['void'])]]))
    expect(matched).toHaveLength(1)
    expect(buildIssueIndex(matched, COMPANY_COLUMNS, TODAY, { includeAllCreators: true }).issues).toEqual([])
  })
})

describe('issueFilterRows', () => {
  const ROWS = [issue('#1', '10/5/2026'), issue('#2', '10/5/2026', { createdBy: 'Other' })]

  it('offers every row when the company slot is bound', () => {
    expect(issueFilterRows(ROWS, { ...COLUMNS, createdByCompany: 11 })).toBe(ROWS)
  })

  it('offers only LotusWorks issues when the company slot is unbound, so the menu agrees with the visual', () => {
    expect(issueFilterRows(ROWS, COLUMNS)).toEqual([ROWS[0]])
    expect(issueFilterRows(ROWS, { ...COLUMNS, createdByCompany: -1 })).toEqual([ROWS[0]])
  })
})

describe('issueRowWeekKey', () => {
  it('reads the created week, with a BIM360 created date first', () => {
    const columns: IssueColumns = { ...COLUMNS, bim360CreatedOn: 11 }
    const readWeek = issueRowWeekKey(columns)
    expect(readWeek(issue('#1', '10/5/2026'))).toBe(202641)
    expect(readWeek([...issue('#1', '10/5/2026'), '9/30/2026'])).toBe(202640)
  })

  it('reads null when the date is blank or unreadable', () => {
    const readWeek = issueRowWeekKey(COLUMNS)
    expect(readWeek(issue('#1', null))).toBeNull()
    expect(readWeek(issue('#1', 'soon'))).toBeNull()
  })
})

describe('issueDataWeeks', () => {
  it('runs from the first created or closed week of any creator through the current week, leaving void rows out', () => {
    const rows = [
      issue('#1', '10/5/2026'),
      issue('#2', '9/30/2026', { createdBy: 'Other' }),
      issue('#3', '10/5/2026', { createdBy: 'Other', status: 'Closed', updatedOn: '9/23/2026' }),
      issue('#4', '1/5/2026', { status: 'Void' }),
      issue('#5', '12/1/2026'),
    ]
    expect(issueDataWeeks(rows, COLUMNS, TODAY).map((week) => week.label)).toEqual(["WW39'2026", "WW40'2026", "WW41'2026", "WW42'2026"])
  })

  it('is the current week alone with no rows', () => {
    expect(issueDataWeeks([], COLUMNS, TODAY).map((week) => week.label)).toEqual(["WW42'2026"])
  })
})
