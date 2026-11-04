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

describe('buildInspectionIndex axisFromKey', () => {
  const WEEK_40 = [["WW40'2026", 'Final', 'NCR', 'A']]

  it('starts the axis at axisFromKey when it is before the first data week, with those weeks at zero', () => {
    const index = buildInspectionIndex(WEEK_40, COLUMNS, TODAY, { axisFromKey: 202638 })
    expect(index.weeks.map((item) => item.week.key)).toEqual([202638, 202639, 202640, 202641, 202642])
    expect(index.weeks[0]).toMatchObject({ finals: 0, sors: 0, issuesFound: 0 })
    expect(index.cumulativeFinals).toEqual([0, 0, 1, 1, 1])
    expect(index.cumulativeIssues).toEqual([0, 0, 1, 1, 1])
    expect(index.buildingsByWeek[0].size).toBe(0)
    expect(index.positionByKey.get(202638)).toBe(0)
  })

  it('starts at the first data week when axisFromKey is later', () => {
    const index = buildInspectionIndex(WEEK_40, COLUMNS, TODAY, { axisFromKey: 202641 })
    expect(index.weeks[0].week.key).toBe(202640)
  })

  it('crosses a year on the way to the first data week', () => {
    const index = buildInspectionIndex([["WW02'2026", 'SOR', '', 'A']], COLUMNS, new Date(2026, 0, 15), { axisFromKey: 202552 })
    expect(index.weeks.map((item) => item.week.label)).toEqual(["WW52'2025", "WW01'2026", "WW02'2026", "WW03'2026"])
  })

  it('holds the axis with no rows at all', () => {
    const index = buildInspectionIndex([], COLUMNS, TODAY, { axisFromKey: 202640 })
    expect(index.weeks.map((item) => item.week.key)).toEqual([202640, 202641, 202642])
  })

  it('never starts after the current week', () => {
    const index = buildInspectionIndex([], COLUMNS, TODAY, { axisFromKey: 202650 })
    expect(index.weeks.map((item) => item.week.key)).toEqual([202642])
  })

  it('without the option the output is unchanged', () => {
    expect(buildInspectionIndex(ROWS, COLUMNS, TODAY, {})).toEqual(buildInspectionIndex(ROWS, COLUMNS, TODAY))
    expect(buildInspectionIndex(ROWS, COLUMNS, TODAY).weeks[0].week.key).toBe(202640)
  })
})

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

  it('groups buildings that differ only by case or spacing under the first spelling seen', () => {
    const rows = [
      ["WW42'2026", 'Final', '', 'Off-site Warehouse'],
      ["WW42'2026", 'SOR', '', 'off-site  WAREHOUSE'],
    ]
    const index = buildInspectionIndex(rows, COLUMNS, TODAY)
    expect([...index.buildingsByWeek[0].keys()]).toEqual(['Off-site Warehouse'])
    expect(index.buildingsByWeek[0].get('Off-site Warehouse')).toEqual({ finals: 1, sors: 1 })
  })

  it('uses one display name for a building across weeks', () => {
    const rows = [
      ["WW41'2026", 'Final', '', 'Fire water pump house'],
      ["WW42'2026", 'Final', '', 'Fire water Pump House'],
    ]
    const index = buildInspectionIndex(rows, COLUMNS, TODAY)
    expect([...index.buildingsByWeek[1].keys()]).toEqual(['Fire water pump house'])
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
