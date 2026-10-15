import { describe, expect, it } from 'vitest'

import { buildInspectionIndex, buildInspectionModel, defaultViewState } from '../inspections'
import { MECHANICAL_ROWS } from './fixtures/mechanicalRows'

const COLUMNS = { workWeek: 0, phase: 1, issue: 2, building: 3 }
const TODAY = new Date(2026, 9, 15) // WW42'2026
const index = buildInspectionIndex(MECHANICAL_ROWS, COLUMNS, TODAY)

describe('Mechanical export (2026-10-14)', () => {
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
    expect(model.thisWeek.finals).toEqual({ value: 0, delta: 0 })
    expect(model.thisWeek.sors).toEqual({ value: 0, delta: -2 })
    expect(model.thisWeek.issuesFound).toEqual({ value: 0, delta: 0 })
    expect(model.toDate.finals).toBe(44)
    expect(model.toDate.sors).toBe(91)
    expect(model.toDate.cleanFinals).toBe(43)
    expect(model.toDate.passRate).toBeCloseTo(97.727, 3)
    expect(model.toDate.passRateDeltaPoints).toBe(0)
  })

  it('flags only WW08 as an NCR week, outside the default window', () => {
    const recent = buildInspectionModel(index, defaultViewState(index))
    expect(recent.passRateTrend.some((point) => point.hadIssue)).toBe(false)
    const all = buildInspectionModel(index, { ...defaultViewState(index), range: 'all' })
    expect(all.passRateTrend.filter((point) => point.hadIssue).map((point) => point.week.label)).toEqual(["WW08'2026"])
  })

  it('lists all 19 buildings and finds no issues in the default window', () => {
    const model = buildInspectionModel(index, defaultViewState(index))
    expect(model.allBuildings).toHaveLength(19)
    expect(model.windowTotals.issuesFound).toBe(0)
  })

  it('ranks F63.2 first and groups 11 smaller buildings as Other', () => {
    const model = buildInspectionModel(index, defaultViewState(index))
    expect(model.buildings[0]).toEqual({ building: 'F63.2', finals: 14, sors: 2 })
    expect(model.buildings).toHaveLength(8)
    expect(model.otherBuildings?.count).toBe(11)
    expect((model.otherBuildings?.finals ?? 0) + (model.otherBuildings?.sors ?? 0)).toBe(14)
  })
})
