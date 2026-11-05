import { describe, expect, it } from 'vitest'

import type { IssueColumns, ViewState } from '../types'
import type { ParetoModel } from '../rootCauses'
import { buildRootCausePareto, paretoIssues, readoutText } from '../rootCauses'
import { buildIssueIndex } from '../issues'
import { ISSUE_ROWS } from './fixtures/issueRows'

// Expected values are pinned to the seeded synthetic fixtures from scripts/generate-qaqc-fixtures.mjs.

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
const WW42 = 202642
const ALL: ViewState = { selectedKey: WW42, windowEndKey: WW42, range: 'all', dateRange: null }
const RECENT: ViewState = { selectedKey: WW42, windowEndKey: WW42, range: 'recent', dateRange: null }
// 30 WW ending WW38'2025: a view where the literal Other cause ranks among the top 9 and no cause is blank.
const RECENT_WW38_2025: ViewState = { selectedKey: 202538, windowEndKey: 202538, range: 'recent', dateRange: null }
const index = buildIssueIndex(ISSUE_ROWS, COLUMNS, TODAY)

function barValues(model: ParetoModel): Array<[string, number]> {
  return model.bars.map((bar) => [bar.label, bar.count])
}

function categoryValues(model: ParetoModel): Array<[string, number]> {
  return (model.categories ?? []).map((slice) => [slice.label, slice.count])
}

describe("root cause Pareto, All and All issues, as of WW42'2026", () => {
  const model = buildRootCausePareto(index, ALL, 'all', TODAY)

  it('covers 177 issues with 27 causes', () => {
    expect(model.total).toBe(177)
    expect(model.distinct).toBe(27)
  })

  it('has the top 9 causes and Other (18 causes), then Not recorded 3 outside the cumulative', () => {
    expect(barValues(model)).toEqual([
      ['Installation', 46],
      ['Coordination', 24],
      ['Incomplete Work', 20],
      ['Casting/Pouring/Erection', 17],
      ['Trade Damage', 10],
      ['Housekeeping', 6],
      ['Workmanship', 5],
      ['Bonding', 4],
      ['Code Compliance', 4],
      ['Other (18 causes)', 38],
      ['Not recorded', 3],
    ])
    expect(model.bars[10]).toMatchObject({ kind: 'notRecorded', cumulative: null, vital: false })
    expect(model.bars[9].cumulative).toBe(100)
  })

  it('has the top 9 adding up to 78.2%, so 80% is reached only inside Other', () => {
    expect(model.topNShare?.toFixed(1)).toBe('78.2')
    expect(model.crossIndex).toBe(9)
    expect(model.bars.map((bar) => bar.vital)).toEqual([true, true, true, true, true, true, true, true, true, true, false])
  })

  it('reads out the top 9 share and the top cause', () => {
    expect(readoutText(model.readout)).toBe('The top 9 causes cover 78.2%; 80% is reached only inside Other. Installation is 46 of 177 (26.0%).')
  })

  it('splits the categories Quality 163 (92.1%), Coordination 5, Design 5, Safety 1, Not recorded 3', () => {
    expect(categoryValues(model)).toEqual([
      ['Quality', 163],
      ['Coordination', 5],
      ['Design', 5],
      ['Safety', 1],
      ['Not recorded', 3],
    ])
    expect(model.categories?.[0].share.toFixed(1)).toBe('92.1')
  })

  it('folds 18 causes into Other, Constructability first', () => {
    expect(model.otherCauses).toHaveLength(18)
    expect(model.otherCauses[0]).toEqual({ label: 'Constructability', count: 4 })
    expect(model.otherCauses.reduce((sum, cause) => sum + cause.count, 0)).toBe(38)
  })

  it('drills Installation into 46 issues, 11 open and 35 closed', () => {
    const drill = paretoIssues(index, model.bars[0], ALL, 'all', TODAY)
    expect(drill).toHaveLength(46)
    expect(drill.filter((row) => row.isOpen)).toHaveLength(11)
    expect(drill.filter((row) => !row.isOpen)).toHaveLength(35)
  })

  it('orders the Installation drill-down open oldest first, then closed longest to close first', () => {
    const drill = paretoIssues(index, model.bars[0], ALL, 'all', TODAY)
    expect(drill.map((row) => `${row.issue.id} ${row.isOpen ? 'open' : 'closed'} ${row.days}`)).toEqual([
      '#367 open 700', '#445 open 626', '#506 open 567', '#511 open 563', '#540 open 535', '#542 open 533',
      '#587 open 490', '#590 open 486', '#616 open 462', '#738 open 346', '#864 open 226', '#855 closed 90',
      '#404 closed 89', '#698 closed 88', '#691 closed 85', '#819 closed 82', '#824 closed 81', '#422 closed 80',
      '#395 closed 77', '#781 closed 74', '#498 closed 73', '#931 closed 73', '#500 closed 71', '#673 closed 71',
      '#626 closed 69', '#865 closed 65', '#475 closed 62', '#856 closed 58', '#713 closed 55', '#960 closed 55',
      '#787 closed 42', '#976 closed 40', '#518 closed 36', '#983 closed 33', '#842 closed 30', '#987 closed 29',
      '#955 closed 26', '#489 closed 22', '#801 closed 21', '#1001 closed 15', '#1002 closed 15', '#535 closed 14',
      '#724 closed 12', '#729 closed 11', '#682 closed 9', '#1018 closed 0',
    ])
  })

  it('drills Not recorded into the 3 issues with a blank cause', () => {
    const drill = paretoIssues(index, model.bars[10], ALL, 'all', TODAY)
    expect(drill.map((row) => `${row.issue.id} ${row.isOpen ? 'open' : 'closed'} ${row.days}`)).toEqual([
      '#472 open 601', '#959 open 135', '#907 closed 87',
    ])
  })
})

describe("root cause Pareto, All and Open only, as of WW42'2026", () => {
  const model = buildRootCausePareto(index, ALL, 'open', TODAY)

  it('covers the 51 open issues with 15 causes', () => {
    expect(model.total).toBe(51)
    expect(model.distinct).toBe(15)
  })

  it('crosses 80% at Trade Damage (81.6%)', () => {
    expect(model.crossIndex).toBe(5)
    const crossing = model.bars[5]
    expect(crossing.label).toBe('Trade Damage')
    expect(crossing.cumulative?.toFixed(1)).toBe('81.6')
    expect(model.bars.map((bar) => bar.vital)).toEqual([true, true, true, true, true, true, false, false, false, false, false])
  })

  it('has Installation 11, Other (6 causes) 6 and Not recorded 2', () => {
    expect(model.bars[0]).toMatchObject({ label: 'Installation', count: 11 })
    expect(model.bars[9]).toMatchObject({ label: 'Other (6 causes)', count: 6 })
    expect(model.bars[10]).toMatchObject({ label: 'Not recorded', count: 2, kind: 'notRecorded' })
  })

  it('reads out the top 6 reaching 80%', () => {
    expect(readoutText(model.readout)).toBe('The top 6 causes cover 81.6%. Installation is 11 of 51 (21.6%).')
  })

  it('splits the open categories Quality 47, Coordination 2, Not recorded 2', () => {
    expect(categoryValues(model)).toEqual([
      ['Quality', 47],
      ['Coordination', 2],
      ['Not recorded', 2],
    ])
  })

  it('drills Installation into its 11 open issues', () => {
    const drill = paretoIssues(index, model.bars[0], ALL, 'open', TODAY)
    expect(drill).toHaveLength(11)
    expect(drill.every((row) => row.isOpen)).toBe(true)
  })
})

describe("root cause Pareto, 30 WW (WW13 to WW42'2026) and All issues", () => {
  const model = buildRootCausePareto(index, RECENT, 'all', TODAY)

  it('covers the 37 issues created in the 30 weeks with 13 causes', () => {
    expect(model.firstWeek.key).toBe(202613)
    expect(model.lastWeek.key).toBe(WW42)
    expect(model.total).toBe(37)
    expect(model.distinct).toBe(13)
  })

  it('has the top 9, Other (4 causes) and Not recorded', () => {
    expect(barValues(model)).toEqual([
      ['Installation', 9],
      ['Coordination', 7],
      ['Incomplete Work', 5],
      ['Trade Damage', 3],
      ['Casting/Pouring/Erection', 2],
      ['Housekeeping', 2],
      ['Bonding', 1],
      ['Equipment', 1],
      ['Excavation/Earthworks', 1],
      ['Other (4 causes)', 4],
      ['Not recorded', 2],
    ])
  })

  it('reaches exactly 80.0% at Housekeeping, leaving the bars after it muted', () => {
    expect(model.crossIndex).toBe(5)
    expect(model.bars[5]).toMatchObject({ label: 'Housekeeping', cumulative: 80, vital: true })
    expect(model.bars[6]).toMatchObject({ label: 'Bonding', vital: false })
    expect(model.bars[9]).toMatchObject({ label: 'Other (4 causes)', count: 4, vital: false })
    expect(readoutText(model.readout)).toBe('The top 6 causes cover 80.0%. Installation is 9 of 37 (24.3%).')
  })

  it('folds four single-issue causes into Other, the literal Other cause among them', () => {
    expect(model.otherCauses.map((cause) => cause.label)).toEqual(['Materials', 'Other', 'Quality', 'Rigging'])
    expect(model.otherCauses.every((cause) => cause.count === 1)).toBe(true)
  })

  it('splits the categories Quality 34, Safety 1, Not recorded 2', () => {
    expect(categoryValues(model)).toEqual([
      ['Quality', 34],
      ['Safety', 1],
      ['Not recorded', 2],
    ])
  })

  it('drills Other (4 causes) into its 4 issues, the literal Other cause included', () => {
    const drill = paretoIssues(index, model.bars[9], RECENT, 'all', TODAY)
    expect(drill.map((row) => `${row.issue.id} ${row.issue.rootCause}`)).toEqual([
      '#956 Materials', '#948 Rigging', '#996 Other', '#941 Quality',
    ])
  })
})

describe("root cause Pareto, 30 WW and Open only", () => {
  const model = buildRootCausePareto(index, RECENT, 'open', TODAY)

  it('covers 8 open issues with 4 causes', () => {
    expect(model.total).toBe(8)
    expect(model.distinct).toBe(4)
  })

  it('reaches 80% at Casting/Pouring/Erection (85.7%), leaving Equipment muted, with no Other bar', () => {
    expect(model.crossIndex).toBe(2)
    expect(barValues(model)).toEqual([
      ['Coordination', 3],
      ['Incomplete Work', 2],
      ['Casting/Pouring/Erection', 1],
      ['Equipment', 1],
      ['Not recorded', 1],
    ])
    expect(model.bars[2].cumulative?.toFixed(1)).toBe('85.7')
    expect(model.bars.map((bar) => bar.vital)).toEqual([true, true, true, false, false])
    expect(readoutText(model.readout)).toBe('The top 3 causes cover 85.7%. Coordination is 3 of 8 (37.5%).')
  })
})

describe("root cause Pareto, 30 WW (WW09 to WW38'2025) and Open only", () => {
  const model = buildRootCausePareto(index, RECENT_WW38_2025, 'open', TODAY)

  it('covers 28 issues open at the end of WW38 with 11 causes, with Not recorded hidden at 0', () => {
    expect(model.firstWeek.key).toBe(202509)
    expect(model.lastWeek.key).toBe(202538)
    expect(model.total).toBe(28)
    expect(model.distinct).toBe(11)
    expect(model.bars.some((bar) => bar.kind === 'notRecorded')).toBe(false)
  })

  it('keeps the literal Other cause as a bar beside Other (2 causes)', () => {
    expect(barValues(model)).toEqual([
      ['Installation', 10],
      ['Coordination', 5],
      ['Casting/Pouring/Erection', 3],
      ['Incomplete Work', 3],
      ['Code Compliance', 1],
      ['Documentation Incomplete', 1],
      ['Mechanical Jointing', 1],
      ['Other', 1],
      ['Planning', 1],
      ['Other (2 causes)', 2],
    ])
    expect(model.bars[7].kind).toBe('cause')
    expect(model.bars[9].kind).toBe('other')
    expect(model.bars[7].key).not.toBe(model.bars[9].key)
  })

  it('drills the literal Other cause into its own issue, not the folded ones', () => {
    expect(paretoIssues(index, model.bars[7], RECENT_WW38_2025, 'open', TODAY).map((row) => row.issue.id)).toEqual(['#642'])
    expect(paretoIssues(index, model.bars[9], RECENT_WW38_2025, 'open', TODAY).map((row) => row.issue.id)).toEqual(['#485', '#687'])
  })
})
