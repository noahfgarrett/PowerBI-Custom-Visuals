import { describe, expect, it } from 'vitest'

import type { IssueColumns, ViewState } from '../types'
import { defaultViewState, RECENT_WEEK_COUNT } from '../inspections'
import { buildIssueDetail, buildIssueIndex, buildIssueModel } from '../issues'

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

type Cell = string | null
function issue(id: string, createdOn: string, status = 'Open', updatedOn: Cell = null): Cell[] {
  return [id, `Issue ${id}`, status, 'COR', 'Bayside', createdOn, updatedOn, null, 'LotusWorks']
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
  return { selectedKey, windowEndKey, range, dateRange: null }
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

  it('is bad when the closure rate falls', () => {
    // WW40: opened 1, closed 1 → 100%. WW41: opened 2, closed 1 → 50%.
    const dropIndex = buildIssueIndex([issue('#1', '9/29/2026', 'Closed', '9/30/2026'), issue('#2', '10/6/2026')], COLUMNS, TODAY)
    const model = buildIssueModel(dropIndex, viewAt(WW41))
    expect(model.toDate.closureRate.tone).toBe('bad')
  })

  it('is good when remaining open falls', () => {
    const clearIndex = buildIssueIndex([issue('#1', '9/29/2026', 'Closed', '10/6/2026')], COLUMNS, TODAY)
    const model = buildIssueModel(clearIndex, viewAt(WW41))
    expect(model.toDate.remaining).toEqual({ value: 0, delta: -1, tone: 'good' })
  })

  it('is neutral on every to-date card when nothing changed', () => {
    // One open issue from WW40, nothing in WW41.
    const quietIndex = buildIssueIndex([issue('#1', '9/29/2026')], COLUMNS, TODAY)
    const model = buildIssueModel(quietIndex, viewAt(WW41))
    expect(model.toDate.opened).toEqual({ value: 1, delta: 0, tone: 'neutral' })
    expect(model.toDate.closed).toEqual({ value: 0, delta: 0, tone: 'neutral' })
    expect(model.toDate.remaining).toEqual({ value: 1, delta: 0, tone: 'neutral' })
    expect(model.toDate.closureRate).toEqual({ value: 0, deltaPoints: 0, tone: 'neutral' })
  })

  it('is neutral on Issues Closed when nothing closed in either week', () => {
    const quietIndex = buildIssueIndex([issue('#1', '9/29/2026')], COLUMNS, TODAY)
    const model = buildIssueModel(quietIndex, viewAt(WW41))
    expect(model.thisWeek.closed).toEqual({ value: 0, delta: 0, tone: 'neutral' })
  })

  it('is good on Issues Closed when as many closed as the week before', () => {
    const steadyIndex = buildIssueIndex(
      [issue('#1', '9/29/2026', 'Closed', '10/6/2026'), issue('#2', '9/29/2026', 'Closed', '10/13/2026')],
      COLUMNS,
      TODAY,
    )
    const model = buildIssueModel(steadyIndex, viewAt(WW42))
    expect(model.thisWeek.closed).toEqual({ value: 1, delta: 0, tone: 'good' })
  })

  it('is neutral on Issues Closed when fewer closed than the week before', () => {
    // WW41 closed 2, WW42 closed 1.
    const model = buildIssueModel(index, viewAt(WW42))
    expect(model.thisWeek.closed).toEqual({ value: 1, delta: -1, tone: 'neutral' })
  })

  it('is good on Total Closed when it rises', () => {
    const model = buildIssueModel(index, viewAt(WW42))
    expect(model.toDate.closed).toEqual({ value: 4, delta: 1, tone: 'good' })
  })

  it('compares the first week against zero and has no closure rate change', () => {
    const model = buildIssueModel(index, viewAt(WW39))
    expect(model.thisWeek.opened).toEqual({ value: 3, delta: 3, tone: 'warn' })
    expect(model.thisWeek.closed).toEqual({ value: 0, delta: 0, tone: 'neutral' })
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
      [issue('#20', '1/6/2026'), issue('#21', '1/7/2026', 'Closed', '6/2/2026'), ...ROWS],
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

  it('keeps the cards on the selected week when the window ends before it', () => {
    const model = buildIssueModel(index, viewAt(WW42, 'all', WW40))
    expect(model.trend.map((point) => point.week.key)).toEqual([WW39, WW40])
    expect(model.windowTotals).toMatchObject({ opened: 4, closed: 1, remainingChange: 3, weeks: 2 })
    expect(model.windowTotals.closureRate).toBeCloseTo(25, 6)
    expect(model.selectedWeek.key).toBe(WW42)
    expect(model.toDate.opened.value).toBe(8)
  })

  it('lists the week options newest first', () => {
    const model = buildIssueModel(index, viewAt(WW42))
    expect(model.weekOptions.map((week) => week.key)).toEqual([WW42, WW41, WW40, WW39])
    expect(model.hasData).toBe(true)
  })

  it('ages issues as of today whatever week is selected', () => {
    const early = buildIssueModel(index, viewAt(WW39))
    const late = buildIssueModel(index, viewAt(WW42))
    expect(early.openAging).toEqual(late.openAging)
    expect(early.overallAging).toEqual(late.overallAging)
    expect(early.openIssues).toEqual(late.openIssues)
    expect(early.openIssues.map((row) => row.id)).toEqual(['#2', '#4', '#5', '#7'])
  })
})

describe('issue ID ranks', () => {
  it('ranks every detail row by ID ascending, numeric-aware', () => {
    const byRank = index.issues.map((item) => item.detail).sort((a, b) => a.idRank - b.idRank)
    expect(byRank.map((row) => row.id)).toEqual(['#1', '#2', '#3', '#4', '#5', '#6', '#7', '#10'])
  })

  it('gives IDs the collator treats as equal the same rank', () => {
    const twins = buildIssueIndex([issue('#a1', '9/22/2026'), issue('#A1', '9/23/2026'), issue('', '9/24/2026'), issue('', '9/25/2026')], COLUMNS, TODAY)
    const rankOf = (id: string): number[] => twins.issues.filter((item) => item.id === id).map((item) => item.detail.idRank)
    expect(rankOf('#a1')).toEqual(rankOf('#A1'))
    expect(new Set(rankOf('')).size).toBe(1)
  })

  it('gives each open issue row the rank of its detail row', () => {
    const detailRank = new Map(index.issues.map((item) => [item.id, item.detail.idRank]))
    expect(index.openIssues.every((row) => row.idRank === detailRank.get(row.id))).toBe(true)
  })
})

describe('buildIssueDetail', () => {
  it('counts issues opened and closed in the week before the selected week', () => {
    const detail = buildIssueDetail(index, WW42)
    expect(detail.openedLastWeek).toBe(3)
    expect(detail.closedLastWeek).toBe(2)
  })

  it('counts nothing in the week before the first week', () => {
    const detail = buildIssueDetail(index, WW39)
    expect(detail.openedLastWeek).toBe(0)
    expect(detail.closedLastWeek).toBe(0)
  })

  it('names the week it used and the week before', () => {
    const detail = buildIssueDetail(index, WW41)
    expect([detail.selectedWeek.label, detail.previousWeek.label]).toEqual(["WW41'2026", "WW40'2026"])
  })

  it('names the current week when the selected week is unknown', () => {
    expect(buildIssueDetail(index, 201901).selectedWeek.label).toBe("WW42'2026")
  })

  it('falls back to the current week for an unknown selected week', () => {
    expect(buildIssueDetail(index, 201901)).toEqual(buildIssueDetail(index, WW42))
  })

  it('reports issues created or closed in either week, by ID descending', () => {
    const detail = buildIssueDetail(index, WW42)
    expect(detail.reportRows.map((row) => row.id)).toEqual(['#10', '#7', '#6', '#5', '#4', '#3'])
    expect(detail.discussionRows.map((row) => row.id)).toEqual(['#2'])
  })

  it('leaves out issues created after the selected week', () => {
    const detail = buildIssueDetail(index, WW41)
    expect(detail.reportRows.map((row) => row.id)).toEqual(['#10', '#6', '#5', '#4', '#3', '#1'])
    expect(detail.discussionRows.map((row) => row.id)).toEqual(['#2'])
  })

  it('has no discussion rows when every open issue is reported', () => {
    const detail = buildIssueDetail(index, WW40)
    expect(detail.reportRows.map((row) => row.id)).toEqual(['#10', '#3', '#2', '#1'])
    expect(detail.discussionRows).toEqual([])
  })

  it('leaves an open issue created after a past selected week out of the discussion rows', () => {
    // #5 (Not approved) and #7 (Open) are open today but were created in WW41 and WW42.
    const detail = buildIssueDetail(index, WW39)
    const ids = [...detail.reportRows, ...detail.discussionRows].map((row) => row.id)
    expect(ids).not.toContain('#5')
    expect(ids).not.toContain('#7')
    expect(detail.discussionRows).toEqual([])
  })

  it('shows a pending issue as Open', () => {
    const detail = buildIssueDetail(index, WW42)
    expect(detail.reportRows.find((row) => row.id === '#4')?.status).toBe('Open')
  })
})

describe('buildIssueModel in a date range', () => {
  const inRange = (fromKey: number, toKey: number, selectedKey = toKey): ViewState => ({
    selectedKey,
    windowEndKey: toKey,
    range: 'recent',
    dateRange: { fromKey, toKey },
  })
  // Opened: WW39 3, WW40 1, WW41 3, WW42 1. Closed: WW40 1, WW41 2, WW42 1. Remaining: 3, 3, 4, 4.
  const index = buildIssueIndex(ROWS, COLUMNS, TODAY)

  it('Total Opened and Total Closed count within the range', () => {
    const { toDate } = buildIssueModel(index, inRange(WW40, WW41))
    expect(toDate.opened.value).toBe(4)
    expect(toDate.closed.value).toBe(3)
  })

  it('Remaining Open is the open count at range end, and equals the Remaining Open line\'s last point', () => {
    const model = buildIssueModel(index, inRange(WW40, WW41))
    expect(model.toDate.remaining.value).toBe(4)
    expect(model.trend[model.trend.length - 1].remainingOpen).toBe(4)
  })

  it('stays the count at range end with an earlier week selected', () => {
    const model = buildIssueModel(index, inRange(WW39, WW41, WW40))
    expect(model.toDate.remaining.value).toBe(4)
    expect(model.selectedWeek.key).toBe(WW40)
  })

  it('the Remaining Open line stays the true open count each week', () => {
    expect(buildIssueModel(index, inRange(WW40, WW42)).trend.map((point) => point.remainingOpen)).toEqual([3, 4, 4])
  })

  it('Closure Rate is the share opened in range now closed, never above 100%', () => {
    // WW40 and WW41 opened #3, #4, #5, #6: #3 and #6 are now closed. Closed ÷ opened would read 75%.
    const { toDate, rangeClosure } = buildIssueModel(index, inRange(WW40, WW41))
    expect(toDate.closureRate.value).toBe(50)
    expect(toDate.closureRate.deltaPoints).toBeNull()
    expect(rangeClosure).toEqual({ nowClosed: 2, opened: 4 })

    // WW42 alone closed two older issues and opened one that is still open: the closes don't count towards it.
    const closesOnly = buildIssueIndex([issue('#1', '9/22/2026', 'Closed', '10/14/2026'), issue('#2', '9/22/2026', 'Closed', '10/14/2026'), issue('#3', '10/14/2026')], COLUMNS, TODAY)
    const last = buildIssueModel(closesOnly, inRange(WW42, WW42))
    expect(last.toDate.closed.value).toBe(2)
    expect(last.toDate.opened.value).toBe(1)
    expect(last.toDate.closureRate.value).toBe(0)
  })

  it('a range with nothing opened has no Closure Rate', () => {
    const quiet = buildIssueIndex([issue('#1', '9/22/2026', 'Closed', '10/14/2026')], COLUMNS, TODAY)
    expect(buildIssueModel(quiet, inRange(WW42, WW42)).toDate.closureRate.value).toBeNull()
    expect(buildIssueModel(quiet, inRange(WW42, WW42)).windowTotals.closureRate).toBeNull()
  })

  it('the window summary reads the card\'s Closure Rate', () => {
    expect(buildIssueModel(index, inRange(WW40, WW41)).windowTotals.closureRate).toBe(50)
  })

  it('the to-date cards still carry the selected week\'s change', () => {
    const { toDate } = buildIssueModel(index, inRange(WW39, WW41, WW40))
    expect(toDate.opened.delta).toBe(1)
    expect(toDate.closed.delta).toBe(1)
    expect(toDate.remaining.delta).toBe(0)
  })

  it('charts show exactly the range\'s weeks, whatever the 30 WW | All toggle says', () => {
    expect(buildIssueModel(index, inRange(WW40, WW41)).trend.map((point) => point.week.key)).toEqual([WW40, WW41])
    expect(buildIssueModel(index, { ...inRange(WW40, WW41), range: 'all' }).trend.map((point) => point.week.key)).toEqual([WW40, WW41])
  })

  it('the week options are the range\'s, and the selection clamps into it', () => {
    const model = buildIssueModel(index, inRange(WW40, WW41, WW42))
    expect(model.weekOptions.map((week) => week.key)).toEqual([WW41, WW40])
    expect(model.selectedWeek.key).toBe(WW41)
    expect(model.thisWeek.opened.value).toBe(3)
  })

  it('names the range', () => {
    expect(buildIssueModel(index, inRange(WW40, WW41)).rangeLabel).toBe("WW40'2026 to WW41'2026")
    expect(buildIssueModel(index, defaultViewState(index)).rangeLabel).toBeNull()
  })

  it('a quiet range with issues still open has data, and reads the true count', () => {
    const quiet = buildIssueIndex([issue('#1', '9/22/2026')], COLUMNS, TODAY)
    const model = buildIssueModel(quiet, inRange(WW41, WW42))
    expect(model.hasData).toBe(true)
    expect(model.toDate.opened.value).toBe(0)
    expect(model.toDate.closed.value).toBe(0)
    expect(model.toDate.remaining.value).toBe(1)
    expect(model.toDate.closureRate.value).toBeNull()
    expect(buildIssueModel(quiet, inRange(WW39, WW42)).hasData).toBe(true)
  })

  it('a quiet range with everything closed has no data', () => {
    const closed = buildIssueIndex([issue('#1', '9/22/2026', 'Closed', '9/30/2026')], COLUMNS, TODAY)
    expect(buildIssueModel(closed, inRange(WW41, WW42)).hasData).toBe(false)
  })

  it('a range before any issue has no data', () => {
    const later = buildIssueIndex([issue('#1', '10/13/2026')], COLUMNS, TODAY, { axisFromKey: WW39 })
    expect(buildIssueModel(later, inRange(WW39, WW40)).hasData).toBe(false)
  })

  it('Aging and Pareto aren\'t restated by the range', () => {
    const model = buildIssueModel(index, inRange(WW40, WW40))
    expect(model.openAging).toBe(index.openAging)
    expect(model.overallAging).toBe(index.overallAging)
    expect(model.openIssues).toBe(index.openIssues)
  })

  it('no range leaves the output as it was', () => {
    const model = buildIssueModel(index, defaultViewState(index))
    expect(model.toDate.opened.value).toBe(8)
    expect(model.toDate.closed.value).toBe(4)
    expect(model.toDate.remaining.value).toBe(4)
    expect(model.toDate.closureRate.value).toBe(50)
    expect(model.rangeClosure).toBeNull()
  })
})
