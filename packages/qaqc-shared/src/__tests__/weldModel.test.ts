import { describe, expect, it } from 'vitest'

import type { ViewState, WeldColumns } from '../types'
import { defaultViewState } from '../inspections'
import { buildWeldIndex, buildWeldModel, TOP_SYSTEM_COUNT } from '../welds'

const COLUMNS: WeldColumns = {
  weldWeek: 0,
  signature: 1,
  signedWeek: 2,
  issue: 3,
  fluidCode: 4,
  pipeSpec: 5,
  tagNo: 6,
}
const TODAY = new Date(2026, 9, 15) // WW42'2026
const F631 = 'F631M001XX-P001-FW-01'
const BK1 = 'BK1XX101XX-M001-FW-01'

type Cell = string | null
function weld(
  weldWeek: string,
  signedWeek: Cell,
  system: string,
  spec: string,
  tag: string,
  issue: Cell = null,
): Cell[] {
  return [weldWeek, signedWeek ? 'signed' : null, signedWeek, issue, system, spec, tag]
}

const WW40 = "WW40'2026"
const WW41 = "WW41'2026"
const WW42 = "WW42'2026"

// WW40: 4 welds, WW41: 3 welds, WW42: none. 7 welds, 4 signed, 2 issues.
const ROWS: Cell[][] = [
  weld(WW40, WW40, 'AW', 'PCH', F631),
  weld(WW40, WW41, 'AW', 'PCH', F631, 'BIM 1'),
  weld(WW40, null, 'IW', 'PCH', BK1),
  weld(WW40, null, ' aw ', 'QCH', F631),
  weld(WW41, WW42, 'AW', 'PCH', F631),
  weld(WW41, WW41, 'IW', 'MDW', BK1),
  weld(WW41, null, 'IW', 'MDW', BK1, 'Yes 5'),
]
const index = buildWeldIndex(ROWS, COLUMNS, TODAY)

function viewAt(key: number): ViewState {
  return { selectedKey: key, windowEndKey: key, range: 'recent', dateRange: null }
}

describe('buildWeldModel cards', () => {
  it('compares the current week with the one before', () => {
    const model = buildWeldModel(index, defaultViewState(index), null, 1)
    expect(model.selectedWeek.label).toBe(WW42)
    expect(model.previousWeek.label).toBe(WW41)
    expect(model.thisWeek.logged).toEqual({ value: 0, delta: -3 })
    expect(model.thisWeek.signedInWeek).toEqual({ value: 1, delta: -1 })
    expect(model.thisWeek.issues).toEqual({ value: 0, delta: -1 })
  })

  it('reports sign-off for the latest weld week up to the selection that has welds', () => {
    const signoff = buildWeldModel(index, defaultViewState(index), null, 1).thisWeek.signoff
    expect(signoff?.week.label).toBe(WW41)
    expect(signoff?.signed).toBe(2)
    expect(signoff?.total).toBe(3)
    expect(signoff?.rate).toBeCloseTo(66.667, 3)
  })

  it('reports sign-off for the selected week itself when it has welds', () => {
    const model = buildWeldModel(index, viewAt(202640), null, 1)
    expect(model.thisWeek.signoff).toMatchObject({ signed: 2, total: 4, rate: 50 })
    expect(model.thisWeek.signoff?.week.label).toBe(WW40)
  })

  it('counts Signed This Week by signed week, not weld week', () => {
    const model = buildWeldModel(index, viewAt(202641), null, 1)
    expect(model.thisWeek.logged).toEqual({ value: 3, delta: -1 })
    expect(model.thisWeek.signedInWeek).toEqual({ value: 2, delta: 1 })
    expect(model.thisWeek.issues).toEqual({ value: 1, delta: 0 })
  })

  it('computes to-date totals and the change in points versus the previous week', () => {
    const model = buildWeldModel(index, viewAt(202641), null, 1)
    expect(model.toDate.total).toBe(7)
    expect(model.toDate.signed).toBe(4)
    expect(model.toDate.totalThisWeek).toBe(3)
    expect(model.toDate).not.toHaveProperty('signedThisWeek')
    expect(model.toDate.overallRate).toBeCloseTo(57.143, 3)
    expect(model.toDate.overallRateDeltaPoints).toBeCloseTo(7.143, 3)
  })

  it('reports no change in points when nothing was logged this week', () => {
    const model = buildWeldModel(index, defaultViewState(index), null, 1)
    expect(model.toDate.overallRateDeltaPoints).toBe(0)
  })

  it('has no previous week at the start of the range, so deltas are against zero', () => {
    const model = buildWeldModel(index, viewAt(202640), null, 1)
    expect(model.thisWeek.logged).toEqual({ value: 4, delta: 4 })
    expect(model.thisWeek.signedInWeek).toEqual({ value: 1, delta: 1 })
    expect(model.toDate.overallRate).toBe(50)
    expect(model.toDate.overallRateDeltaPoints).toBeNull()
  })

  it('lists week options newest first', () => {
    const model = buildWeldModel(index, defaultViewState(index), null, 1)
    expect(model.weekOptions.map((week) => week.label)).toEqual([WW42, WW41, WW40])
  })

  it('falls back to the current week for unknown view keys', () => {
    const model = buildWeldModel(index, { selectedKey: 199901, windowEndKey: 199901, range: 'recent', dateRange: null }, null, 1)
    expect(model.selectedWeek.label).toBe(WW42)
  })

  it('has no sign-off and no rates before any weld exists', () => {
    const empty = buildWeldIndex([], COLUMNS, TODAY)
    const model = buildWeldModel(empty, defaultViewState(empty), null, 10)
    expect(model.hasData).toBe(false)
    expect(model.thisWeek.signoff).toBeNull()
    expect(model.toDate.overallRate).toBeNull()
    expect(model.toDate.overallRateDeltaPoints).toBeNull()
    expect(model.systems).toEqual([])
    expect(model.buildings).toEqual([])
    expect(model.otherBuildings).toBeNull()
    expect(model.overallIssueRate).toBe(0)
    expect(model.windowTotals).toEqual({ welds: 0, signed: 0, issues: 0, weeks: 1 })
  })
})

describe('buildWeldModel window', () => {
  const longRows: Cell[][] = [
    weld("WW05'2026", "WW05'2026", 'AW', 'PCH', F631, 'BIM 9'),
    weld("WW20'2026", null, 'IW', 'PCH', BK1),
    weld("WW42'2026", "WW42'2026", 'IW', 'PCH', BK1),
  ]
  const longIndex = buildWeldIndex(longRows, COLUMNS, TODAY)

  it('shows the 30 weeks ending at the window end for the recent range', () => {
    const model = buildWeldModel(longIndex, defaultViewState(longIndex), null, 1)
    expect(model.window).toHaveLength(30)
    expect(model.window[0].week.label).toBe("WW13'2026")
    expect(model.window[29].week.label).toBe(WW42)
    expect(model.windowTotals).toEqual({ welds: 2, signed: 1, issues: 0, weeks: 30 })
    expect(model.allSystems.map((system) => system.system)).toEqual(['IW'])
  })

  it('shows every week for the all range', () => {
    const model = buildWeldModel(longIndex, { ...defaultViewState(longIndex), range: 'all' }, null, 1)
    expect(model.window).toHaveLength(38)
    expect(model.windowTotals).toEqual({ welds: 3, signed: 2, issues: 1, weeks: 38 })
    expect(model.allSystems.map((system) => system.system)).toEqual(['IW', 'AW'])
  })

  it('moves the window with the window end while the selection stays', () => {
    const model = buildWeldModel(
      longIndex,
      { selectedKey: 202642, windowEndKey: 202625, range: 'recent', dateRange: null },
      null,
      1,
    )
    expect(model.selectedWeek.label).toBe(WW42)
    expect(model.window).toHaveLength(21)
    expect(model.window[20].week.label).toBe("WW25'2026")
    expect(model.windowTotals).toEqual({ welds: 2, signed: 1, issues: 1, weeks: 21 })
  })
})

describe('buildWeldModel systems', () => {
  it('ranks systems by total and groups case and spacing variants', () => {
    const model = buildWeldModel(index, defaultViewState(index), null, 1)
    expect(model.systems).toEqual([
      { system: 'AW', total: 4, signed: 3 },
      { system: 'IW', total: 3, signed: 1 },
    ])
    expect(model.otherSystems).toBeNull()
  })

  it('nests ranked pipe specs under every system', () => {
    const { allSystems } = buildWeldModel(index, defaultViewState(index), null, 1)
    expect(allSystems[0].specs).toEqual([
      { spec: 'PCH', total: 3, signed: 3 },
      { spec: 'QCH', total: 1, signed: 0 },
    ])
    expect(allSystems[1].specs).toEqual([
      { spec: 'MDW', total: 2, signed: 1 },
      { spec: 'PCH', total: 1, signed: 0 },
    ])
  })

  it('breaks ties by name using the natural collator', () => {
    const rows = ['S10', 'S2', 'S1'].map((system) => weld(WW41, null, system, 'PCH', F631))
    const tied = buildWeldIndex(rows, COLUMNS, TODAY)
    const model = buildWeldModel(tied, defaultViewState(tied), null, 1)
    expect(model.systems.map((system) => system.system)).toEqual(['S1', 'S2', 'S10'])
  })

  it('keeps the top systems and rolls the rest into Other', () => {
    const rows: Cell[][] = []
    for (let system = 1; system <= 11; system += 1) {
      // System n has 12 - n welds, and the first of them is signed.
      for (let count = 0; count < 12 - system; count += 1) {
        rows.push(weld(WW41, count === 0 ? WW41 : null, `S${String(system).padStart(2, '0')}`, 'PCH', F631))
      }
    }
    const many = buildWeldIndex(rows, COLUMNS, TODAY)
    const model = buildWeldModel(many, defaultViewState(many), null, 1)
    expect(TOP_SYSTEM_COUNT).toBe(8)
    expect(model.systems).toHaveLength(8)
    expect(model.systems[0]).toEqual({ system: 'S01', total: 11, signed: 1 })
    expect(model.allSystems).toHaveLength(11)
    // S09, S10, S11 have 3, 2, 1 welds, one signed each.
    expect(model.otherSystems).toEqual({ count: 3, total: 6, signed: 3 })
  })

  it('returns the drilled system with its pipe specs', () => {
    const model = buildWeldModel(index, defaultViewState(index), 'AW', 1)
    expect(model.drill).toEqual({
      system: 'AW',
      total: 4,
      signed: 3,
      specs: [
        { spec: 'PCH', total: 3, signed: 3 },
        { spec: 'QCH', total: 1, signed: 0 },
      ],
    })
  })

  it('has no drill when nothing is drilled or the system is not in the window', () => {
    expect(buildWeldModel(index, defaultViewState(index), null, 1).drill).toBeNull()
    expect(buildWeldModel(index, defaultViewState(index), 'ZZ', 1).drill).toBeNull()
  })

  it('keeps the drill when a refresh changes the system name spelling shown', () => {
    const respelled = buildWeldIndex(ROWS.map((row) => (row[4] === 'AW' ? [...row.slice(0, 4), ' aw ', ...row.slice(5)] : row)), COLUMNS, TODAY)
    const model = buildWeldModel(respelled, defaultViewState(respelled), 'AW', 1)
    expect(model.drill?.system).toBe('aw')
    expect(model.drill?.total).toBe(4)
  })

  it('drops the drill when the system has no welds in the window', () => {
    const rows = [weld("WW05'2026", null, 'AW', 'PCH', F631), weld(WW41, null, 'IW', 'PCH', F631)]
    const long = buildWeldIndex(rows, COLUMNS, TODAY)
    expect(buildWeldModel(long, defaultViewState(long), 'AW', 1).drill).toBeNull()
    expect(buildWeldModel(long, { ...defaultViewState(long), range: 'all' }, 'AW', 1).drill?.total).toBe(1)
  })
})

describe('buildWeldModel buildings', () => {
  it('ranks buildings by issue rate, then issues, then name', () => {
    const model = buildWeldModel(index, defaultViewState(index), null, 1)
    expect(model.buildings).toEqual([
      { building: 'BK1', welds: 3, issues: 1, rate: expect.closeTo(33.333, 3) },
      { building: 'F631', welds: 4, issues: 1, rate: 25 },
    ])
    expect(model.overallIssueRate).toBeCloseTo(28.571, 3)
  })

  it('breaks ties on rate and issues by name', () => {
    const rows = [F631, BK1, 'F632M001XX-1', 'PS1XX101XX-1'].map((tag) => weld(WW41, null, 'AW', 'PCH', tag))
    const clean = buildWeldIndex(rows, COLUMNS, TODAY)
    const model = buildWeldModel(clean, defaultViewState(clean), null, 1)
    expect(model.buildings.map((bar) => bar.building)).toEqual(['BK1', 'F631', 'F632', 'PS1'])
    expect(model.buildings.every((bar) => bar.rate === 0)).toBe(true)
  })

  it('ranks only buildings with the minimum welds and rolls the rest into Other', () => {
    const model = buildWeldModel(index, defaultViewState(index), null, 4)
    expect(model.buildings.map((bar) => bar.building)).toEqual(['F631'])
    expect(model.otherBuildings).toEqual({ count: 1, welds: 3, issues: 1 })
  })

  it('lists every building in allBuildings regardless of the minimum', () => {
    const model = buildWeldModel(index, defaultViewState(index), null, 100)
    expect(model.buildings).toEqual([])
    expect(model.allBuildings.map((bar) => bar.building)).toEqual(['BK1', 'F631'])
    expect(model.otherBuildings).toEqual({ count: 2, welds: 7, issues: 2 })
  })

  it('has no Other when every building meets the minimum', () => {
    expect(buildWeldModel(index, defaultViewState(index), null, 1).otherBuildings).toBeNull()
  })
})

describe('buildWeldModel in a date range', () => {
  // WW38: 2 welds, 1 signed, 1 issue. WW39: none. WW40: 3 welds, 2 signed, 1 issue. WW41: 1 weld, signed. WW42: none.
  const RANGE_ROWS: Cell[][] = [
    weld("WW38'2026", "WW38'2026", 'AW', 'PCH', F631),
    weld("WW38'2026", null, 'CWS', 'PCH', BK1, 'BIM 1'),
    weld("WW40'2026", "WW41'2026", 'AW', 'PCH', F631, 'BIM 2'),
    weld("WW40'2026", "WW40'2026", 'IW', 'QCH', F631),
    weld("WW40'2026", null, 'IW', 'QCH', BK1),
    weld("WW41'2026", "WW42'2026", 'AW', 'PCH', F631),
  ]
  const rangeIndex = buildWeldIndex(RANGE_ROWS, COLUMNS, TODAY)

  function inRange(fromKey: number, toKey: number, selectedKey = toKey): ViewState {
    return { selectedKey, windowEndKey: toKey, range: 'recent', dateRange: { fromKey, toKey } }
  }

  it('in range, the to-date cards and weekly charts restate', () => {
    const model = buildWeldModel(rangeIndex, inRange(202640, 202641), null, 1)
    expect(model.rangeLabel).toBe("WW40'2026 to WW41'2026")
    expect(model.window.map((item) => item.week.label)).toEqual([WW40, WW41])
    expect(model.toDate.total).toBe(4)
    expect(model.toDate.signed).toBe(3)
    expect(model.toDate.overallRate).toBe(75)
    expect(model.toDate.overallRateDeltaPoints).toBeNull()
    expect(model.windowTotals).toEqual({ welds: 4, signed: 3, issues: 1, weeks: 2 })
  })

  it('reads Issue Rate by Building over the range', () => {
    const whole = buildWeldModel(rangeIndex, { ...defaultViewState(rangeIndex), range: 'all' }, null, 1)
    expect(whole.allBuildings.find((bar) => bar.building === 'BK1')).toMatchObject({ welds: 2, issues: 1, rate: 50 })

    const model = buildWeldModel(rangeIndex, inRange(202640, 202641), null, 1)
    expect(model.allBuildings).toEqual([
      { building: 'F631', welds: 3, issues: 1, rate: expect.closeTo(33.333, 3) },
      { building: 'BK1', welds: 1, issues: 0, rate: 0 },
    ])
    expect(model.overallIssueRate).toBe(25)
  })

  it('reads the systems over the range', () => {
    const model = buildWeldModel(rangeIndex, inRange(202640, 202641), null, 1)
    expect(model.allSystems.map((system) => [system.system, system.total, system.signed])).toEqual([['AW', 2, 2], ['IW', 2, 1]])
    expect(buildWeldModel(rangeIndex, inRange(202640, 202641), 'CWS', 1).drill).toBeNull()
  })

  it('limits the week options to the range, newest first', () => {
    const model = buildWeldModel(rangeIndex, inRange(202639, 202641), null, 1)
    expect(model.weekOptions.map((week) => week.label)).toEqual([WW41, WW40, "WW39'2026"])
  })

  it('clamps the selected week into the range, and This WW cards follow it', () => {
    const model = buildWeldModel(rangeIndex, inRange(202638, 202640, 202642), null, 1)
    expect(model.selectedWeek.label).toBe(WW40)
    expect(model.thisWeek.logged).toEqual({ value: 3, delta: 3 })
    expect(model.toDate.totalThisWeek).toBe(3)
    expect(buildWeldModel(rangeIndex, inRange(202640, 202641, 202638), null, 1).selectedWeek.label).toBe(WW40)
  })

  it('has no rate and no data in a range with no welds', () => {
    const model = buildWeldModel(rangeIndex, inRange(202639, 202639), null, 1)
    expect(model.hasData).toBe(false)
    expect(model.toDate.total).toBe(0)
    expect(model.toDate.overallRate).toBeNull()
    expect(model.overallIssueRate).toBe(0)
  })

  it('shows every week of the range on a filtered index that keeps the full axis', () => {
    const filtered = buildWeldIndex(RANGE_ROWS.slice(5), COLUMNS, TODAY, { axisFromKey: rangeIndex.weeks[0].week.key })
    const model = buildWeldModel(filtered, inRange(202638, 202641), null, 1)
    expect(model.window.map((item) => item.week.key)).toEqual([202638, 202639, 202640, 202641])
    expect(model.window.map((item) => item.logged)).toEqual([0, 0, 0, 1])
    expect(model.weekOptions).toHaveLength(4)
    expect(model.hasData).toBe(true)
  })

  it('pulls a range past the axis to its nearest week rather than throwing', () => {
    const model = buildWeldModel(rangeIndex, inRange(203001, 203002), null, 1)
    expect(model.selectedWeek.label).toBe(WW42)
    expect(model.window.map((item) => item.week.label)).toEqual([WW42])
  })

  it('no range leaves the output as it was', () => {
    const model = buildWeldModel(rangeIndex, defaultViewState(rangeIndex), null, 1)
    expect(model.rangeLabel).toBeNull()
    expect(model.toDate.total).toBe(6)
    expect(model.toDate.signed).toBe(4)
    expect(model.weekOptions).toHaveLength(5)
    expect(model.hasData).toBe(true)
  })
})
