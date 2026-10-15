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

function viewAt(key: number): { selectedKey: number; windowEndKey: number; range: 'recent' } {
  return { selectedKey: key, windowEndKey: 202642, range: 'recent' }
}

describe('Welding export (2026-10-14)', () => {
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

  it("has welds from WW51'2025 through WW41'2026 and an index through WW42'2026", () => {
    const withWelds = index.weeks.filter((counts) => counts.logged > 0)
    expect(withWelds[0].week.label).toBe("WW51'2025")
    expect(withWelds[withWelds.length - 1].week.label).toBe("WW41'2026")
    expect(index.weeks[0].week.label).toBe("WW51'2025")
    expect(index.weeks[index.weeks.length - 1].week.label).toBe("WW42'2026")
    expect(index.weeks).toHaveLength(44)
  })

  it('counts 1,751 welds, 1,054 signed and 11 issues, leaving the explicit no out', () => {
    const last = index.weeks.length - 1
    expect(index.cumulativeLogged[last]).toBe(1751)
    expect(index.cumulativeSigned[last]).toBe(1054)
    expect(index.cumulativeIssues[last]).toBe(11)
  })

  it('matches the WW42 cards, using the latest weld week for sign-off', () => {
    const model = buildWeldModel(index, defaultViewState(index), null, MIN_WELDS)
    expect(model.thisWeek.logged).toEqual({ value: 0, delta: -84 })
    expect(model.thisWeek.signedThisWeek).toEqual({ value: 70, delta: 24 })
    expect(model.thisWeek.issues).toEqual({ value: 0, delta: 0 })
    expect(model.thisWeek.signoff?.week.label).toBe("WW41'2026")
    expect(model.thisWeek.signoff?.signed).toBe(67)
    expect(model.thisWeek.signoff?.total).toBe(84)
    expect(Math.round(model.thisWeek.signoff?.rate ?? 0)).toBe(80)
  })

  it('matches the WW41 and WW40 cards', () => {
    const ww41 = buildWeldModel(index, viewAt(202641), null, MIN_WELDS)
    expect(ww41.thisWeek.logged.value).toBe(84)
    expect(ww41.thisWeek.signedThisWeek.value).toBe(46)
    const ww40 = buildWeldModel(index, viewAt(202640), null, MIN_WELDS)
    expect(ww40.thisWeek.logged.value).toBe(126)
    expect(ww40.thisWeek.signoff).toMatchObject({ signed: 46, total: 126 })
    expect(ww40.thisWeek.signedThisWeek.value).toBe(67)
  })

  it('matches the to-date totals through WW42', () => {
    const model = buildWeldModel(index, defaultViewState(index), null, MIN_WELDS)
    expect(model.toDate.total).toBe(1751)
    expect(model.toDate.signed).toBe(1054)
    expect(model.toDate.overallRate).toBeCloseTo(60.19, 2)
    expect(model.toDate.overallRateDeltaPoints).toBe(0)
  })

  it('totals 1,570 welds and 11 issues over the 30-week window WW13 to WW42', () => {
    const model = buildWeldModel(index, defaultViewState(index), null, MIN_WELDS)
    expect(model.window[0].week.label).toBe("WW13'2026")
    expect(model.window).toHaveLength(30)
    expect(model.windowTotals.welds).toBe(1570)
    expect(model.windowTotals.issues).toBe(11)
  })

  it('ranks window buildings by issue rate and rolls F632 into Other below the minimum', () => {
    const model = buildWeldModel(index, defaultViewState(index), null, MIN_WELDS)
    const byName = new Map(model.allBuildings.map((bar) => [bar.building, bar]))
    expect(byName.get('F631')).toMatchObject({ welds: 698, issues: 4 })
    expect(byName.get('WR1')).toMatchObject({ welds: 273, issues: 4 })
    expect(byName.get('Site General')).toMatchObject({ welds: 118, issues: 2 })
    expect(byName.get('BK1')).toMatchObject({ welds: 439, issues: 1 })
    expect(byName.get('PS1')).toMatchObject({ welds: 40, issues: 0 })
    expect(byName.get('F632')).toMatchObject({ welds: 2, issues: 0 })
    expect(model.allBuildings).toHaveLength(6)
    expect(model.buildings.map((bar) => bar.building)).toEqual(['Site General', 'WR1', 'F631', 'BK1', 'PS1'])
    expect(model.otherBuildings).toEqual({ count: 1, welds: 2, issues: 0 })
  })

  it('shows the F632 building when the minimum is lowered', () => {
    const model = buildWeldModel(index, defaultViewState(index), null, 1)
    expect(model.buildings.map((bar) => bar.building)).toContain('F632')
    expect(model.otherBuildings).toBeNull()
  })

  it('has 56 systems led by AW, IW and FL', () => {
    const model = buildWeldModel(index, defaultViewState(index), null, MIN_WELDS)
    expect(model.allSystems).toHaveLength(56)
    expect(model.systems.slice(0, 3)).toEqual([
      { system: 'AW', total: 274, signed: 159 },
      { system: 'IW', total: 122, signed: 90 },
      { system: 'FL', total: 82, signed: 59 },
    ])
    expect(model.systems).toHaveLength(8)
    expect(model.otherSystems?.count).toBe(48)
  })

  it('drills into the AW pipe specs', () => {
    const model = buildWeldModel(index, defaultViewState(index), 'AW', MIN_WELDS)
    expect(model.drill?.specs).toEqual([
      { spec: 'PCH', total: 208, signed: 142 },
      { spec: 'QCH', total: 31, signed: 11 },
      { spec: 'MDW', total: 28, signed: 6 },
      { spec: 'PCHA', total: 7, signed: 0 },
    ])
  })

  it('counts all buildings over all time', () => {
    const model = buildWeldModel(index, { ...defaultViewState(index), range: 'all' }, null, 1)
    const welds = Object.fromEntries(model.allBuildings.map((bar) => [bar.building, bar.welds]))
    expect(welds).toEqual({ F631: 765, BK1: 483, WR1: 313, 'Site General': 136, PS1: 40, F632: 14 })
    expect(model.windowTotals.welds).toBe(1751)
  })
})
