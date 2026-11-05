import { describe, expect, it } from 'vitest'

import { buildInspectionIndex, buildInspectionModel, defaultViewState } from '../inspections'
import { MECHANICAL_ROWS } from './fixtures/mechanicalRows'

const COLUMNS = { workWeek: 0, phase: 1, issue: 2, building: 3 }
const TODAY = new Date(2026, 9, 15) // WW42'2026
const index = buildInspectionIndex(MECHANICAL_ROWS, COLUMNS, TODAY)

// Expected values are pinned to the seeded synthetic fixtures from scripts/generate-qaqc-fixtures.mjs.
describe('Mechanical fixture', () => {
  it('reads every row with no skipped or future weeks', () => {
    expect(index.totalRows).toBe(138)
    expect(index.skippedRows).toBe(0)
    expect(index.futureRows).toBe(0)
  })

  it("spans WW02'2026 through WW42'2026", () => {
    expect(index.weeks[0].week.label).toBe("WW02'2026")
    expect(index.weeks[index.weeks.length - 1].week.label).toBe("WW42'2026")
    expect(index.weeks).toHaveLength(41)
  })

  it('matches the WW42 cards and to-date totals', () => {
    const model = buildInspectionModel(index, defaultViewState(index))
    expect(model.thisWeek.finals).toEqual({ value: 1, delta: -1 })
    expect(model.thisWeek.sors).toEqual({ value: 3, delta: 2 })
    expect(model.thisWeek.issuesFound).toEqual({ value: 0, delta: 0 })
    expect(model.toDate.finals).toBe(44)
    expect(model.toDate.sors).toBe(91)
    expect(model.toDate.cleanFinals).toBe(40)
    expect(model.toDate.passRate).toBeCloseTo(90.909, 3)
    expect(model.toDate.passRateDeltaPoints).toBeCloseTo(0.2114, 4)
  })

  it('flags WW20 and WW33 in the default window, and WW06 and WW12 before it', () => {
    const recent = buildInspectionModel(index, defaultViewState(index))
    expect(recent.passRateTrend.filter((point) => point.hadIssue).map((point) => point.week.label)).toEqual(["WW20'2026", "WW33'2026"])
    const all = buildInspectionModel(index, { ...defaultViewState(index), range: 'all' })
    expect(all.passRateTrend.filter((point) => point.hadIssue).map((point) => point.week.label)).toEqual([
      "WW06'2026",
      "WW12'2026",
      "WW20'2026",
      "WW33'2026",
    ])
  })

  it('lists all 20 buildings and finds two issues in the default window', () => {
    const model = buildInspectionModel(index, defaultViewState(index))
    expect(model.allBuildings).toHaveLength(20)
    expect(model.windowTotals.issuesFound).toBe(2)
  })

  it('ranks F63.2 first and groups 12 smaller buildings as Other', () => {
    const model = buildInspectionModel(index, defaultViewState(index))
    expect(model.buildings[0]).toEqual({ building: 'F63.2', finals: 8, sors: 11 })
    expect(model.buildings).toHaveLength(8)
    expect(model.otherBuildings?.count).toBe(12)
    expect((model.otherBuildings?.finals ?? 0) + (model.otherBuildings?.sors ?? 0)).toBe(15)
  })
})
