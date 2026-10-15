import { describe, expect, it } from 'vitest'

import type { IssueColumns, ViewState } from '../types'
import { defaultViewState, RECENT_WEEK_COUNT } from '../inspections'
import { buildIssueIndex, buildIssueModel } from '../issues'

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

type Cell = string | null
function issue(id: string, createdOn: string, status = 'Open', updatedOn: Cell = null): Cell[] {
  return [id, `Issue ${id}`, status, 'COR', 'Bayside', 'Mechanical', createdOn, updatedOn, null, 'LotusWorks']
}

const WW39 = 202639
const WW40 = 202640
const WW41 = 202641
const WW42 = 202642

// Opened: WW39 3, WW40 1, WW41 3, WW42 1. Closed: WW40 1, WW41 2, WW42 1. Remaining: 3, 3, 4, 4.
const ROWS: Cell[][] = [
  issue('#1', '9/22/2026', 'Closed', '9/30/2026'),
  issue('#2', '9/23/2026'),
  issue('#10', '9/24/2026', 'Closed', '10/7/2026'),
  issue('#3', '9/29/2026', 'Closed', '10/6/2026'),
  issue('#4', '10/6/2026', 'Pending'),
  issue('#5', '10/7/2026', 'Not approved'),
  issue('#6', '10/8/2026', 'Closed', '10/13/2026'),
  issue('#7', '10/13/2026'),
]
const index = buildIssueIndex(ROWS, COLUMNS, TODAY)

function viewAt(selectedKey: number, range: ViewState['range'] = 'all', windowEndKey = WW42): ViewState {
  return { selectedKey, windowEndKey, range }
}

describe('buildIssueModel cards', () => {
  it('compares the selected week with the week before', () => {
    const model = buildIssueModel(index, defaultViewState(index))
    expect(model.selectedWeek.label).toBe("WW42'2026")
    expect(model.previousWeek.label).toBe("WW41'2026")
    expect(model.thisWeek.opened).toEqual({ value: 1, delta: -2, tone: 'neutral' })
    expect(model.thisWeek.closed).toEqual({ value: 1, delta: -1, tone: 'neutral' })
  })

  it('warns when more issues opened and is good when at least as many closed', () => {
    const model = buildIssueModel(index, viewAt(WW41))
    expect(model.thisWeek.opened).toEqual({ value: 3, delta: 2, tone: 'warn' })
    expect(model.thisWeek.closed).toEqual({ value: 2, delta: 1, tone: 'good' })
  })

  it('totals through the selected week against through the week before', () => {
    const model = buildIssueModel(index, viewAt(WW41))
    expect(model.toDate.opened).toEqual({ value: 7, delta: 3, tone: 'bad' })
    expect(model.toDate.closed).toEqual({ value: 3, delta: 2, tone: 'good' })
    expect(model.toDate.remaining).toEqual({ value: 4, delta: 1, tone: 'bad' })
    expect(model.toDate.closureRate.value).toBeCloseTo((3 / 7) * 100, 6)
    expect(model.toDate.closureRate.deltaPoints).toBeCloseTo((3 / 7) * 100 - 25, 6)
    expect(model.toDate.closureRate.tone).toBe('good')
  })

  it('is neutral when remaining open holds steady', () => {
    const model = buildIssueModel(index, viewAt(WW40))
    expect(model.toDate.remaining).toEqual({ value: 3, delta: 0, tone: 'neutral' })
  })

  it('is good when remaining open falls and bad when the closure rate falls', () => {
    // WW40: opened 1, closed 1 → 100%. WW41: opened 2, closed 1 → 50%.
    const dropIndex = buildIssueIndex([issue('#1', '9/29/2026', 'Closed', '9/30/2026'), issue('#2', '10/6/2026')], COLUMNS, TODAY)
    const dropping = buildIssueModel(dropIndex, viewAt(WW41))
    expect(dropping.toDate.closureRate.tone).toBe('bad')
    const clearIndex = buildIssueIndex([issue('#1', '9/29/2026', 'Closed', '10/6/2026')], COLUMNS, TODAY)
    const clearing = buildIssueModel(clearIndex, viewAt(WW41))
    expect(clearing.toDate.remaining).toEqual({ value: 0, delta: -1, tone: 'good' })
  })

  it('compares the first week against zero and has no closure rate change', () => {
    const model = buildIssueModel(index, viewAt(WW39))
    expect(model.thisWeek.opened).toEqual({ value: 3, delta: 3, tone: 'warn' })
    expect(model.thisWeek.closed).toEqual({ value: 0, delta: 0, tone: 'good' })
    expect(model.toDate.remaining).toEqual({ value: 3, delta: 3, tone: 'bad' })
    expect(model.toDate.closureRate).toEqual({ value: 0, deltaPoints: null, tone: 'neutral' })
  })

  it('has no closure rate when nothing was opened', () => {
    const empty = buildIssueIndex([], COLUMNS, TODAY)
    const model = buildIssueModel(empty, defaultViewState(empty))
    expect(model.toDate.closureRate).toEqual({ value: null, deltaPoints: null, tone: 'neutral' })
    expect(model.hasData).toBe(false)
  })

  it('falls back to the current week for an unknown selected week', () => {
    const model = buildIssueModel(index, viewAt(201901))
    expect(model.selectedWeek.label).toBe("WW42'2026")
  })
})

describe('buildIssueModel trend and window', () => {
  it('gives opened, closed and remaining open for every week in the window', () => {
    const model = buildIssueModel(index, viewAt(WW42))
    expect(model.trend.map((point) => [point.week.key, point.opened, point.closed, point.remainingOpen])).toEqual([
      [WW39, 3, 0, 3],
      [WW40, 1, 1, 3],
      [WW41, 3, 2, 4],
      [WW42, 1, 1, 4],
    ])
  })

  it('totals the window', () => {
    const model = buildIssueModel(index, viewAt(WW41, 'all', WW41))
    expect(model.trend).toHaveLength(3)
    expect(model.windowTotals.opened).toBe(7)
    expect(model.windowTotals.closed).toBe(3)
    expect(model.windowTotals.remainingChange).toBe(4)
    expect(model.windowTotals.closureRate).toBeCloseTo((3 / 7) * 100, 6)
    expect(model.windowTotals.weeks).toBe(3)
  })

  it('limits the recent window and measures the change in remaining from before it', () => {
    const longIndex = buildIssueIndex(
      [issue('#1', '1/6/2026'), issue('#2', '1/7/2026', 'Closed', '6/2/2026'), ...ROWS],
      COLUMNS,
      TODAY,
    )
    const model = buildIssueModel(longIndex, viewAt(WW42, 'recent'))
    expect(model.trend).toHaveLength(RECENT_WEEK_COUNT)
    expect(model.trend[0].week.label).toBe("WW13'2026")
    expect(model.trend[0].remainingOpen).toBe(2)
    expect(model.windowTotals.opened).toBe(8)
    expect(model.windowTotals.closed).toBe(5)
    // Remaining 2 before the window, 5 at its end.
    expect(model.windowTotals.remainingChange).toBe(3)
    expect(model.windowTotals.closureRate).toBeCloseTo(50, 6)
  })

  it('lists the week options newest first', () => {
    const model = buildIssueModel(index, viewAt(WW42))
    expect(model.weekOptions.map((week) => week.key)).toEqual([WW42, WW41, WW40, WW39])
    expect(model.hasData).toBe(true)
  })

  it('ages issues as of today whatever week is selected', () => {
    const model = buildIssueModel(index, viewAt(WW39))
    expect(model.openAging).toBe(index.openAging)
    expect(model.overallAging).toBe(index.overallAging)
    expect(model.openIssues).toBe(index.openIssues)
  })
})

describe('buildIssueModel detail', () => {
  it('counts issues opened and closed this week and last week', () => {
    const { detail } = buildIssueModel(index, viewAt(WW42))
    expect(detail.openedThisWeek).toBe(1)
    expect(detail.closedThisWeek).toBe(1)
    expect(detail.openedLastWeek).toBe(3)
    expect(detail.closedLastWeek).toBe(2)
  })

  it('reports issues created or closed in either week, by ID descending', () => {
    const { detail } = buildIssueModel(index, viewAt(WW42))
    expect(detail.reportRows.map((row) => row.id)).toEqual(['#10', '#7', '#6', '#5', '#4', '#3'])
    expect(detail.discussionRows.map((row) => row.id)).toEqual(['#2'])
  })

  it('leaves out issues created after the selected week', () => {
    const { detail } = buildIssueModel(index, viewAt(WW41))
    expect(detail.reportRows.map((row) => row.id)).toEqual(['#10', '#6', '#5', '#4', '#3', '#1'])
    expect(detail.discussionRows.map((row) => row.id)).toEqual(['#2'])
  })

  it('has no discussion rows when every open issue is reported', () => {
    const { detail } = buildIssueModel(index, viewAt(WW40))
    expect(detail.reportRows.map((row) => row.id)).toEqual(['#10', '#3', '#2', '#1'])
    expect(detail.discussionRows).toEqual([])
  })

  it('shows a pending issue as Open', () => {
    const { detail } = buildIssueModel(index, viewAt(WW42))
    expect(detail.reportRows.find((row) => row.id === '#4')?.status).toBe('Open')
  })
})
