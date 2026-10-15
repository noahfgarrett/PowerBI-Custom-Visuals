import { describe, expect, it } from 'vitest'

import { buildInspectionIndex, buildInspectionModel, defaultViewState } from '../inspections'
import { ELECTRICAL_ROWS } from './fixtures/electricalRows'

const COLUMNS = { workWeek: 0, phase: 1, issue: 2, building: 3 }
const TODAY = new Date(2026, 9, 15) // WW42'2026
const index = buildInspectionIndex(ELECTRICAL_ROWS, COLUMNS, TODAY)

describe('Electrical export (2026-10-14)', () => {
  it('reads every row with no skipped or future weeks', () => {
    expect(index.totalRows).toBe(288)
    expect(index.skippedRows).toBe(0)
    expect(index.futureRows).toBe(0)
  })

  it('spans WW51\'2025 through WW42\'2026', () => {
    expect(index.weeks[0].week.label).toBe("WW51'2025")
    expect(index.weeks[index.weeks.length - 1].week.label).toBe("WW42'2026")
    expect(index.weeks).toHaveLength(44)
  })

  it('matches the WW42 cards', () => {
    const model = buildInspectionModel(index, defaultViewState(index))
    expect(model.thisWeek.finals).toEqual({ value: 3, delta: -3 })
    expect(model.thisWeek.sors).toEqual({ value: 3, delta: 0 })
    expect(model.thisWeek.issuesFound).toEqual({ value: 0, delta: 0 })
    expect(model.toDate.finals).toBe(238)
    expect(model.toDate.sors).toBe(48)
    expect(model.toDate.cleanFinals).toBe(236)
    expect(model.toDate.passRate).toBeCloseTo(99.16, 2)
    expect(model.toDate.passRateDeltaPoints).toBeCloseTo(0.0107, 4)
  })

  it('matches WW41 when it is selected', () => {
    const model = buildInspectionModel(index, { ...defaultViewState(index), selectedKey: 202641 })
    expect(model.thisWeek.finals.value).toBe(6)
    expect(model.thisWeek.sors.value).toBe(3)
    expect(model.toDate.finals).toBe(235)
  })

  it('uses WW13 through WW42 for the 30-week window and flags the two NCR weeks', () => {
    const model = buildInspectionModel(index, defaultViewState(index))
    expect(model.window[0].week.label).toBe("WW13'2026")
    expect(model.passRateTrend.filter((point) => point.hadIssue).map((point) => point.week.label)).toEqual([
      "WW22'2026",
      "WW23'2026",
    ])
  })

  it('lists all 19 buildings and totals the 30-week window', () => {
    const model = buildInspectionModel(index, defaultViewState(index))
    expect(model.windowTotals.weeks).toBe(30)
    expect(model.allBuildings).toHaveLength(19)
    expect(model.allBuildings[0]).toEqual({ building: 'F63.2', finals: 138, sors: 15 })
  })

  it('ranks F63.2 first and groups 11 smaller buildings as Other', () => {
    const model = buildInspectionModel(index, defaultViewState(index))
    expect(model.buildings[0]).toEqual({ building: 'F63.2', finals: 138, sors: 15 })
    expect(model.buildings).toHaveLength(8)
    expect(model.otherBuildings?.count).toBe(11)
    expect((model.otherBuildings?.finals ?? 0) + (model.otherBuildings?.sors ?? 0)).toBe(12)
  })
})
