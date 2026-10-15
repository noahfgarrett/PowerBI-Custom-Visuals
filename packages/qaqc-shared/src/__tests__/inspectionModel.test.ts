import { describe, expect, it } from 'vitest'

import { buildInspectionIndex, buildInspectionModel, defaultViewState } from '../inspections'
import type { InspectionIndex, ViewState } from '../types'

const COLUMNS = { workWeek: 0, phase: 1, issue: 2, building: 3 }
const TODAY = new Date(2026, 9, 15) // WW42'2026

/** Weeks 1–42 of 2026: finals = week % 5 + 1, sors = week % 3, NCR on the first Final in weeks 10 and 40. */
function syntheticIndex(): InspectionIndex {
  const rows: string[][] = []
  for (let week = 1; week <= 42; week += 1) {
    const label = `WW${String(week).padStart(2, '0')}'2026`
    for (let i = 0; i < (week % 5) + 1; i += 1) {
      rows.push([label, 'Final', i === 0 && (week === 10 || week === 40) ? 'NCR' : 'No Issue Found', 'F63.2'])
    }
    for (let i = 0; i < week % 3; i += 1) rows.push([label, 'SOR', '', 'F63.1'])
  }
  return buildInspectionIndex(rows, COLUMNS, TODAY)
}

function view(index: InspectionIndex, overrides: Partial<ViewState>): ViewState {
  return { ...defaultViewState(index), ...overrides }
}

describe('buildInspectionModel', () => {
  it('defaults to the current week and a 30-week window', () => {
    const index = syntheticIndex()
    const model = buildInspectionModel(index, defaultViewState(index))
    expect(model.selectedWeek.label).toBe("WW42'2026")
    expect(model.window).toHaveLength(30)
    expect(model.window[0].week.label).toBe("WW13'2026")
  })

  it('shows every week in All mode', () => {
    const index = syntheticIndex()
    expect(buildInspectionModel(index, view(index, { range: 'all' })).window).toHaveLength(42)
  })

  it('starts the window at the first data week when history is short', () => {
    const index = syntheticIndex()
    const model = buildInspectionModel(index, view(index, { selectedKey: 202620, windowEndKey: 202620 }))
    expect(model.window.map((item) => item.week.label)).toHaveLength(20)
    expect(model.window[0].week.label).toBe("WW01'2026")
  })

  it('computes this-week values and deltas vs the previous week', () => {
    const index = syntheticIndex()
    const model = buildInspectionModel(index, view(index, { selectedKey: 202640 }))
    expect(model.thisWeek.finals).toEqual({ value: 1, delta: -4 })
    expect(model.thisWeek.sors).toEqual({ value: 1, delta: 1 })
    expect(model.thisWeek.issuesFound).toEqual({ value: 1, delta: 1 })
    expect(model.previousWeek.label).toBe("WW39'2026")
  })

  it('computes to-date totals and the NCR pass rate through the selected week', () => {
    const index = syntheticIndex()
    const model = buildInspectionModel(index, view(index, { selectedKey: 202640 }))
    expect(model.toDate.finals).toBe(120)
    expect(model.toDate.sors).toBe(40)
    expect(model.toDate.cleanFinals).toBe(118)
    expect(model.toDate.passRate).toBeCloseTo(98.333, 3)
    expect(model.toDate.passRateDeltaPoints).toBeCloseTo(-0.826, 3)
  })

  it('treats the week before the first data week as zero', () => {
    const index = syntheticIndex()
    const model = buildInspectionModel(index, view(index, { selectedKey: 202601 }))
    expect(model.thisWeek.finals).toEqual({ value: 2, delta: 2 })
    expect(model.toDate.passRateDeltaPoints).toBeNull()
  })

  it('falls back to the current week for an unknown selection', () => {
    const index = syntheticIndex()
    expect(buildInspectionModel(index, view(index, { selectedKey: 209901 })).selectedWeek.label).toBe("WW42'2026")
  })

  it('lists week options newest first', () => {
    const index = syntheticIndex()
    const options = buildInspectionModel(index, defaultViewState(index)).weekOptions
    expect(options[0].label).toBe("WW42'2026")
    expect(options[options.length - 1].label).toBe("WW01'2026")
  })

  it('builds a cumulative pass-rate trend that flags NCR weeks', () => {
    const index = syntheticIndex()
    const trend = buildInspectionModel(index, defaultViewState(index)).passRateTrend
    const ww40 = trend.find((point) => point.week.key === 202640)
    expect(ww40?.hadIssue).toBe(true)
    expect(ww40?.totalFinals).toBe(120)
    expect(trend.filter((point) => point.hadIssue)).toHaveLength(1)
    expect(ww40?.issuesFound).toBe(1)
  })

  it('totals Finals, SORs, issues, and weeks over the window', () => {
    const index = syntheticIndex()
    const model = buildInspectionModel(index, defaultViewState(index))
    expect(model.windowTotals).toEqual({
      finals: model.window.reduce((sum, item) => sum + item.finals, 0),
      sors: model.window.reduce((sum, item) => sum + item.sors, 0),
      issuesFound: model.window.reduce((sum, item) => sum + item.issuesFound, 0),
      weeks: 30,
    })
  })

  it('ranks the top 8 buildings and groups the rest as Other', () => {
    const names = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliet']
    const counts = [5, 4, 3, 3, 2, 2, 1, 1, 1, 1]
    const rows = names.flatMap((name, i) => Array.from({ length: counts[i] }, () => ["WW42'2026", 'Final', '', name]))
    const index = buildInspectionIndex(rows, COLUMNS, TODAY)
    const model = buildInspectionModel(index, defaultViewState(index))
    expect(model.buildings.map((bar) => bar.building)).toEqual(names.slice(0, 8))
    expect(model.otherBuildings).toEqual({ count: 2, finals: 2, sors: 0 })
    expect(model.allBuildings.map((bar) => bar.building)).toEqual(names)
  })

  it('reports no data for an empty index', () => {
    const index = buildInspectionIndex([], COLUMNS, TODAY)
    const model = buildInspectionModel(index, defaultViewState(index))
    expect(model.hasData).toBe(false)
    expect(model.toDate.passRate).toBeNull()
    expect(model.otherBuildings).toBeNull()
  })

  it('reports no data when only other-phase rows exist', () => {
    const index = buildInspectionIndex([["WW42'2026", 'N/A', '', 'A']], COLUMNS, TODAY)
    expect(buildInspectionModel(index, defaultViewState(index)).hasData).toBe(false)
  })

  it('keeps the window end when a bar selects an earlier week', () => {
    const index = syntheticIndex()
    const model = buildInspectionModel(index, view(index, { selectedKey: 202630, windowEndKey: 202642 }))
    expect(model.window).toHaveLength(30)
    expect(model.window[model.window.length - 1].week.label).toBe("WW42'2026")
    expect(model.selectedWeek.label).toBe("WW30'2026")
    expect(model.thisWeek.finals.value).toBe(1)
  })

  it('excludes buildings that only appear before the window', () => {
    const rows = [
      ["WW01'2026", 'Final', '', 'Old'],
      ["WW42'2026", 'Final', '', 'New'],
    ]
    const index = buildInspectionIndex(rows, COLUMNS, TODAY)
    const model = buildInspectionModel(index, defaultViewState(index))
    expect(model.buildings.map((bar) => bar.building)).toEqual(['New'])
  })
})
