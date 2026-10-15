import { describe, expect, it } from 'vitest'

import { buildInspectionIndex } from '../inspections'

const COLUMNS = { workWeek: 0, phase: 1, issue: 2, building: 3 }
const TODAY = new Date(2026, 9, 15) // WW42'2026

const ROWS = [
  ["WW40'2026", 'Final', 'No Issue Found', 'F63.2'],
  ["WW40'2026", 'SOR', 'COR', 'F63.2'],
  ["WW42'2026", 'Final', 'NCR', 'F63.1'],
  ["WW42'2026", 'N/A', '', 'F63.1'],
  ['UPW', 'Final', '', 'F63.2'],
  ["WW44'2026", 'Final', '', 'F63.2'],
  [null, 'SOR', '', ''],
]

describe('buildInspectionIndex', () => {
  it('builds continuous weeks from the first data week through the current week', () => {
    const index = buildInspectionIndex(ROWS, COLUMNS, TODAY)
    expect(index.currentWeek.label).toBe("WW42'2026")
    expect(index.weeks.map((item) => item.week.label)).toEqual(["WW40'2026", "WW41'2026", "WW42'2026"])
  })

  it('counts Finals, SORs, and issues on Finals only', () => {
    const index = buildInspectionIndex(ROWS, COLUMNS, TODAY)
    expect(index.weeks.map(({ finals, sors, issuesFound }) => [finals, sors, issuesFound])).toEqual([
      [1, 1, 0],
      [0, 0, 0],
      [1, 0, 1],
    ])
  })

  it('keeps running totals parallel to the weeks', () => {
    const index = buildInspectionIndex(ROWS, COLUMNS, TODAY)
    expect(index.cumulativeFinals).toEqual([1, 1, 2])
    expect(index.cumulativeSors).toEqual([1, 1, 1])
    expect(index.cumulativeIssues).toEqual([0, 0, 1])
    expect(index.positionByKey.get(202641)).toBe(1)
  })

  it('tallies buildings per week for Finals and SORs', () => {
    const index = buildInspectionIndex(ROWS, COLUMNS, TODAY)
    expect(index.buildingsByWeek[0].get('F63.2')).toEqual({ finals: 1, sors: 1 })
    expect(index.buildingsByWeek[2].get('F63.1')).toEqual({ finals: 1, sors: 0 })
  })

  it('counts skipped and future rows separately', () => {
    const index = buildInspectionIndex(ROWS, COLUMNS, TODAY)
    expect(index.totalRows).toBe(7)
    expect(index.skippedRows).toBe(2)
    expect(index.futureRows).toBe(1)
  })

  it('ignores rows with an unrecognised phase without counting them as skipped', () => {
    const index = buildInspectionIndex([['', 'N/A', '', ''], ["WW42'2026", 'Final', '', 'F63.2']], COLUMNS, TODAY)
    expect(index.skippedRows).toBe(0)
    expect(index.futureRows).toBe(0)
  })

  it('reads Date cells as ISO weeks', () => {
    const index = buildInspectionIndex([[new Date(2026, 9, 13), 'Final', '', 'OAC']], COLUMNS, TODAY)
    expect(index.weeks.map((item) => item.finals)).toEqual([1])
  })

  it('returns only the current week, all zeros, when there are no rows', () => {
    const index = buildInspectionIndex([], COLUMNS, TODAY)
    expect(index.weeks).toHaveLength(1)
    expect(index.weeks[0]).toMatchObject({ finals: 0, sors: 0, issuesFound: 0 })
    expect(index.cumulativeFinals).toEqual([0])
  })

  it('derives the week range from Final and SOR rows only', () => {
    const rows = [
      ["WW01'2026", 'Pressure Test', '', 'A'],
      ["WW42'2026", 'Final', '', 'A'],
    ]
    const index = buildInspectionIndex(rows, COLUMNS, TODAY)
    expect(index.weeks.map((item) => item.week.label)).toEqual(["WW42'2026"])
  })
})
