import { describe, expect, it } from 'vitest'

import type { IssueColumns } from '../types'
import { buildIssueIndex } from '../issues'

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
const TODAY = new Date(2026, 9, 15) // Thursday of WW42'2026
const LW = 'LotusWorks'

type Cell = string | number | Date | null
interface IssueOptions {
  status?: Cell
  updatedOn?: Cell
  createdBy?: Cell
  contractor?: Cell
  type?: Cell
  discipline?: Cell
  title?: Cell
  dueDate?: Cell
}

function issue(id: string, createdOn: Cell, options: IssueOptions = {}): Cell[] {
  return [
    id,
    options.title === undefined ? `Issue ${id}` : options.title,
    options.status === undefined ? 'Open' : options.status,
    options.type === undefined ? 'COR' : options.type,
    options.contractor === undefined ? 'Bayside' : options.contractor,
    options.discipline === undefined ? 'Mechanical' : options.discipline,
    createdOn,
    options.updatedOn ?? null,
    options.dueDate ?? null,
    options.createdBy === undefined ? LW : options.createdBy,
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

  it('never closes an issue before the week it was created', () => {
    const index = buildIssueIndex(
      [issue('#1', '10/6/2026', { status: 'Closed', updatedOn: '9/29/2026' })],
      COLUMNS,
      TODAY,
    )
    expect(index.issues[0].closedWeek?.label).toBe("WW41'2026")
    expect(index.weeks.map((item) => item.closed)).toEqual([1, 0])
    expect(index.cumulativeOpened.map((opened, i) => opened - index.cumulativeClosed[i])).toEqual([0, 0])
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

  it('normalizes each issue with the app defaults', () => {
    const index = buildIssueIndex(
      [
        issue('#1021', '10/5/2026', { contractor: '', type: '', discipline: null, title: '  ', status: 'pending' }),
        issue('#7', '10/5/2026', { contractor: null, status: '' }),
      ],
      COLUMNS,
      TODAY,
    )
    const [first, second] = index.issues
    expect(first).toMatchObject({
      id: '#1021',
      contractor: 'Bayside',
      subtype: 'Uncategorized',
      discipline: 'Unassigned',
      title: 'Untitled issue',
      status: 'Pending',
      statusKind: 'pending',
    })
    expect(second).toMatchObject({ id: '#7', contractor: 'Unassigned', status: 'Open', statusKind: 'open' })
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
      title: 'Issue #9',
      contractor: 'Unassigned',
      createdOn: '09/01/26',
      createdOnTime: new Date(2026, 8, 1, 12).getTime(),
      ageDays: 44,
      status: 'Open',
    })
  })
})
