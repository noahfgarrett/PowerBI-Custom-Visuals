import { describe, expect, it } from 'vitest'

import type { WeldColumns } from '../types'
import { defaultViewState } from '../inspections'
import { buildWeldIndex, buildWeldModel } from '../welds'
import { WELDING_ROWS } from './fixtures/weldingRows'

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
const MIN_WELDS = 10
const index = buildWeldIndex(WELDING_ROWS, COLUMNS, TODAY)
// A week later, WW43'2026 has no welds yet, so its cards fall back to the latest weld week.
const laterIndex = buildWeldIndex(WELDING_ROWS, COLUMNS, new Date(2026, 9, 22))
// F632 has exactly 10 welds in the default window; without its WW13 weld it has 9, under the minimum.
const droppedRow = WELDING_ROWS.findIndex((row) => row[0] === "WW13'2026" && String(row[6]).startsWith('F632'))
const fewerIndex = buildWeldIndex(WELDING_ROWS.filter((_, i) => i !== droppedRow), COLUMNS, TODAY)

function viewAt(key: number): { selectedKey: number; windowEndKey: number; range: 'recent', dateRange: null } {
  return { selectedKey: key, windowEndKey: 202642, range: 'recent', dateRange: null }
}

// Expected values are pinned to the seeded synthetic fixtures from scripts/generate-qaqc-fixtures.mjs.
describe('Welding fixture', () => {
  it('reads every row with no skipped or future weeks', () => {
    expect(WELDING_ROWS).toHaveLength(1751)
    expect(index.totalRows).toBe(1751)
    expect(index.skippedRows).toBe(0)
    expect(index.futureRows).toBe(0)
  })

  it('holds no inspector names, only the signed marker', () => {
    const signatures = new Set(WELDING_ROWS.map((row) => row[1]))
    expect(signatures).toEqual(new Set([null, 'signed']))
  })

  it("has welds from WW51'2025 through WW42'2026 and an index through the current week", () => {
    const withWelds = index.weeks.filter((counts) => counts.logged > 0)
    expect(withWelds[0].week.label).toBe("WW51'2025")
    expect(withWelds[withWelds.length - 1].week.label).toBe("WW42'2026")
    expect(index.weeks[0].week.label).toBe("WW51'2025")
    expect(index.weeks[index.weeks.length - 1].week.label).toBe("WW42'2026")
    expect(index.weeks).toHaveLength(44)
    expect(laterIndex.weeks[laterIndex.weeks.length - 1].week.label).toBe("WW43'2026")
    expect(laterIndex.weeks).toHaveLength(45)
  })

  it('counts 1,751 welds, 1,105 signed and 11 issues, leaving the explicit no out', () => {
    const last = index.weeks.length - 1
    expect(index.cumulativeLogged[last]).toBe(1751)
    expect(index.cumulativeSigned[last]).toBe(1105)
    expect(index.cumulativeIssues[last]).toBe(11)
  })

  it('matches the WW42 cards, using the latest weld week for sign-off', () => {
    const model = buildWeldModel(index, defaultViewState(index), null, MIN_WELDS)
    expect(model.thisWeek.logged).toEqual({ value: 65, delta: 1 })
    expect(model.thisWeek.signedInWeek).toEqual({ value: 59, delta: 38 })
    expect(model.thisWeek.issues).toEqual({ value: 1, delta: 0 })
    expect(model.thisWeek.signoff?.week.label).toBe("WW42'2026")
    expect(model.thisWeek.signoff?.signed).toBe(21)
    expect(model.thisWeek.signoff?.total).toBe(65)
    expect(Math.round(model.thisWeek.signoff?.rate ?? 0)).toBe(32)

    // WW43 has no welds: its sign-off card shows WW42, the latest week with welds.
    const later = buildWeldModel(laterIndex, defaultViewState(laterIndex), null, MIN_WELDS)
    expect(later.thisWeek.logged).toEqual({ value: 0, delta: -65 })
    expect(later.thisWeek.signedInWeek).toEqual({ value: 0, delta: -59 })
    expect(later.thisWeek.signoff?.week.label).toBe("WW42'2026")
    expect(later.thisWeek.signoff).toMatchObject({ signed: 21, total: 65 })
  })

  it('matches the WW41 and WW40 cards', () => {
    const ww41 = buildWeldModel(index, viewAt(202641), null, MIN_WELDS)
    expect(ww41.thisWeek.logged.value).toBe(64)
    expect(ww41.thisWeek.signedInWeek.value).toBe(21)
    const ww40 = buildWeldModel(index, viewAt(202640), null, MIN_WELDS)
    expect(ww40.thisWeek.logged.value).toBe(67)
    expect(ww40.thisWeek.signoff).toMatchObject({ signed: 24, total: 67 })
    expect(ww40.thisWeek.signedInWeek.value).toBe(24)
  })

  it('matches the to-date totals through WW42', () => {
    const model = buildWeldModel(index, defaultViewState(index), null, MIN_WELDS)
    expect(model.toDate.total).toBe(1751)
    expect(model.toDate.signed).toBe(1105)
    expect(model.toDate.overallRate).toBeCloseTo(63.11, 2)
    expect(model.toDate.overallRateDeltaPoints).toBeCloseTo(-1.1874, 4)
    // No welds in WW43, so the overall rate holds still.
    const later = buildWeldModel(laterIndex, defaultViewState(laterIndex), null, MIN_WELDS)
    expect(later.toDate.overallRateDeltaPoints).toBe(0)
  })

  it('totals 1,423 welds and 8 issues over the 30-week window WW13 to WW42', () => {
    const model = buildWeldModel(index, defaultViewState(index), null, MIN_WELDS)
    expect(model.window[0].week.label).toBe("WW13'2026")
    expect(model.window).toHaveLength(30)
    expect(model.windowTotals.welds).toBe(1423)
    expect(model.windowTotals.issues).toBe(8)
  })

  it('ranks window buildings by issue rate and rolls F632 into Other below the minimum', () => {
    const model = buildWeldModel(index, defaultViewState(index), null, MIN_WELDS)
    const byName = new Map(model.allBuildings.map((bar) => [bar.building, bar]))
    expect(byName.get('BK1')).toMatchObject({ welds: 382, issues: 5 })
    expect(byName.get('F631')).toMatchObject({ welds: 637, issues: 3 })
    expect(byName.get('WR1')).toMatchObject({ welds: 244, issues: 0 })
    expect(byName.get('Site General')).toMatchObject({ welds: 115, issues: 0 })
    expect(byName.get('PS1')).toMatchObject({ welds: 35, issues: 0 })
    expect(byName.get('F632')).toMatchObject({ welds: 10, issues: 0 })
    expect(model.allBuildings).toHaveLength(6)
    // F632 has exactly the minimum of 10 welds in the window, so it keeps its own row.
    expect(model.buildings.map((bar) => bar.building)).toEqual(['BK1', 'F631', 'F632', 'PS1', 'Site General', 'WR1'])
    expect(model.otherBuildings).toBeNull()

    // Without its WW13 weld, F632 has 9 welds in the window and rolls into Other.
    const below = buildWeldModel(fewerIndex, defaultViewState(fewerIndex), null, MIN_WELDS)
    expect(below.buildings.map((bar) => bar.building)).toEqual(['BK1', 'F631', 'PS1', 'Site General', 'WR1'])
    expect(below.otherBuildings).toEqual({ count: 1, welds: 9, issues: 0 })
  })

  it('shows the F632 building when the minimum is lowered', () => {
    const model = buildWeldModel(fewerIndex, defaultViewState(fewerIndex), null, 1)
    expect(model.buildings.map((bar) => bar.building)).toContain('F632')
    expect(model.otherBuildings).toBeNull()
  })

  it('has 57 systems led by AW, IW and FL', () => {
    const model = buildWeldModel(index, defaultViewState(index), null, MIN_WELDS)
    expect(model.allSystems).toHaveLength(57)
    expect(model.systems.slice(0, 3)).toEqual([
      { system: 'AW', total: 221, signed: 129 },
      { system: 'IW', total: 116, signed: 72 },
      { system: 'FL', total: 80, signed: 45 },
    ])
    expect(model.systems).toHaveLength(8)
    expect(model.otherSystems?.count).toBe(49)
  })

  it('drills into the AW pipe specs', () => {
    const model = buildWeldModel(index, defaultViewState(index), 'AW', MIN_WELDS)
    expect(model.drill?.specs).toEqual([
      { spec: 'A1A', total: 72, signed: 44 },
      { spec: 'PCH', total: 45, signed: 30 },
      { spec: 'B_MDW', total: 18, signed: 9 },
      { spec: 'J1A', total: 16, signed: 10 },
      { spec: 'PCHA', total: 13, signed: 6 },
      { spec: 'D1A', total: 9, signed: 5 },
      { spec: 'MCF', total: 9, signed: 4 },
      { spec: 'MQW', total: 8, signed: 1 },
      { spec: 'K1A', total: 5, signed: 4 },
      { spec: 'PCHF', total: 4, signed: 2 },
      { spec: 'QCH', total: 4, signed: 1 },
      { spec: 'K2A', total: 3, signed: 2 },
      { spec: 'O1U', total: 3, signed: 1 },
      { spec: 'B_PAQ', total: 2, signed: 2 },
      { spec: 'M2W', total: 2, signed: 1 },
      { spec: 'M3W', total: 2, signed: 2 },
      { spec: 'MDW', total: 2, signed: 2 },
      { spec: 'B_MQW', total: 1, signed: 1 },
      { spec: 'J1B', total: 1, signed: 1 },
      { spec: 'MCV', total: 1, signed: 1 },
      { spec: 'N1W', total: 1, signed: 0 },
    ])
  })

  it('counts all buildings over all time', () => {
    const model = buildWeldModel(index, { ...defaultViewState(index), range: 'all' }, null, 1)
    const welds = Object.fromEntries(model.allBuildings.map((bar) => [bar.building, bar.welds]))
    expect(welds).toEqual({ F631: 793, BK1: 467, WR1: 301, 'Site General': 136, PS1: 40, F632: 14 })
    expect(model.windowTotals.welds).toBe(1751)
  })
})
