import { describe, expect, it } from 'vitest'

import { buildInspectionIndex, buildInspectionModel, defaultViewState, passRateAt, RECENT_WEEK_COUNT, recentWindowStart } from '../inspections'
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

  it('ranks tied buildings in natural order', () => {
    const rows = ['F63.10', 'F63.2'].map((name) => ["WW42'2026", 'Final', '', name])
    const index = buildInspectionIndex(rows, COLUMNS, TODAY)
    const model = buildInspectionModel(index, defaultViewState(index))
    expect(model.allBuildings.map((bar) => bar.building)).toEqual(['F63.2', 'F63.10'])
  })

  it('totals a window that does not start at the first week', () => {
    const index = syntheticIndex()
    const model = buildInspectionModel(index, view(index, { selectedKey: 202620, windowEndKey: 202620 }))
    expect(model.windowTotals.weeks).toBe(20)
    expect(model.windowTotals.finals).toBe(model.window.reduce((sum, item) => sum + item.finals, 0))
    const later = buildInspectionModel(index, view(index, { selectedKey: 202635, windowEndKey: 202635 }))
    expect(later.windowTotals).toEqual({
      finals: later.window.reduce((sum, item) => sum + item.finals, 0),
      sors: later.window.reduce((sum, item) => sum + item.sors, 0),
      issuesFound: later.window.reduce((sum, item) => sum + item.issuesFound, 0),
      weeks: 30,
    })
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

describe('recentWindowStart', () => {
  it('starts the recent window so it ends on the given week and holds RECENT_WEEK_COUNT weeks', () => {
    expect(recentWindowStart(100)).toBe(100 - RECENT_WEEK_COUNT + 1)
  })

  it('starts at the first week when there are fewer weeks than the window', () => {
    expect(recentWindowStart(RECENT_WEEK_COUNT - 2)).toBe(0)
    expect(recentWindowStart(RECENT_WEEK_COUNT - 1)).toBe(0)
  })
})

describe('buildInspectionModel in a date range', () => {
  const RANGE = { fromKey: 202610, toKey: 202620 }

  function inRange(index: InspectionIndex, overrides: Partial<ViewState> = {}): ViewState {
    return view(index, { dateRange: RANGE, selectedKey: 202615, windowEndKey: 202615, ...overrides })
  }

  /** Sums a week count over the range's weeks, which is what a restated total must equal. */
  function rangeTotal(index: InspectionIndex, read: (week: InspectionIndex['weeks'][number]) => number): number {
    return index.weeks
      .filter((item) => item.week.key >= RANGE.fromKey && item.week.key <= RANGE.toKey)
      .reduce((sum, item) => sum + read(item), 0)
  }

  it('in range, the trend shows only the range\'s weeks', () => {
    const model = buildInspectionModel(syntheticIndex(), inRange(syntheticIndex()))
    expect(model.window.map((item) => item.week.key)).toEqual([202610, 202611, 202612, 202613, 202614, 202615, 202616, 202617, 202618, 202619, 202620])
    expect(model.passRateTrend.map((point) => point.week.key)).toEqual(model.window.map((item) => item.week.key))
    expect(model.windowTotals.weeks).toBe(11)
  })

  it('ignores the 30 WW and All choice while a range is set', () => {
    const index = syntheticIndex()
    expect(buildInspectionModel(index, inRange(index, { range: 'all' })).window).toEqual(buildInspectionModel(index, inRange(index)).window)
  })

  it('to-date totals restate to the range', () => {
    const index = syntheticIndex()
    const model = buildInspectionModel(index, inRange(index))
    const finals = rangeTotal(index, (item) => item.finals)
    const issues = rangeTotal(index, (item) => item.issuesFound)
    expect(model.toDate.finals).toBe(finals)
    expect(model.toDate.sors).toBe(rangeTotal(index, (item) => item.sors))
    expect(model.toDate.cleanFinals).toBe(finals - issues)
    expect(model.toDate.passRate).toBeCloseTo(((finals - issues) / finals) * 100, 10)
    expect(model.toDate.passRateDeltaPoints).toBeNull()
    expect(model.rangeLabel).toBe("WW10'2026 to WW20'2026")
  })

  it('keeps the This WW cards on the selected week, compared with the week before it', () => {
    const index = syntheticIndex()
    const model = buildInspectionModel(index, inRange(index, { selectedKey: 202610, windowEndKey: 202610 }))
    expect(model.selectedWeek.key).toBe(202610)
    expect(model.thisWeek.finals).toEqual({ value: 1, delta: 1 - 5 })
    expect(model.toDate.finalsThisWeek).toBe(1)
  })

  it('the pass rate trend restarts at From, and its last point equals the In Range card', () => {
    const index = syntheticIndex()
    const model = buildInspectionModel(index, inRange(index))
    const first = model.passRateTrend[0]
    // Week 10 has one Final and it has the NCR, whatever came before.
    expect(first.totalFinals).toBe(1)
    expect(first.cleanFinals).toBe(0)
    expect(first.rate).toBe(0)
    const last = model.passRateTrend[model.passRateTrend.length - 1]
    expect(last.rate).toBe(model.toDate.passRate)
    expect(last.totalFinals).toBe(model.toDate.finals)
    expect(last.cleanFinals).toBe(model.toDate.cleanFinals)
  })

  it('reads buildings from the range', () => {
    const index = buildInspectionIndex(
      [
        ["WW05'2026", 'Final', 'No Issue Found', 'Outside'],
        ["WW12'2026", 'Final', 'No Issue Found', 'Inside'],
        ["WW30'2026", 'SOR', '', 'Outside'],
      ],
      COLUMNS,
      TODAY,
    )
    const model = buildInspectionModel(index, inRange(index))
    expect(model.allBuildings.map((bar) => bar.building)).toEqual(['Inside'])
  })

  it('lists only the range\'s weeks in the week picker, newest first', () => {
    const index = syntheticIndex()
    const options = buildInspectionModel(index, inRange(index)).weekOptions
    expect(options[0].key).toBe(202620)
    expect(options[options.length - 1].key).toBe(202610)
    expect(options).toHaveLength(11)
  })

  it('has no data when the range holds no Finals or SORs, though other weeks do', () => {
    const index = buildInspectionIndex(
      [["WW05'2026", 'Final', 'No Issue Found', 'A'], ["WW30'2026", 'Final', 'No Issue Found', 'A']],
      COLUMNS,
      TODAY,
    )
    const model = buildInspectionModel(index, inRange(index))
    expect(model.hasData).toBe(false)
    expect(model.toDate.passRate).toBeNull()
    expect(model.passRateTrend.every((point) => point.rate === null)).toBe(true)
  })

  it('stays usable when a filtered axis has no week in the range', () => {
    const index = buildInspectionIndex([["WW30'2026", 'Final', 'No Issue Found', 'A']], COLUMNS, TODAY)
    const model = buildInspectionModel(index, view(index, { dateRange: RANGE }))
    expect(model.hasData).toBe(false)
    expect(model.window).toEqual([])
    expect(model.toDate.finals).toBe(0)
    expect(model.buildings).toEqual([])
    expect(model.weekOptions).toEqual([model.selectedWeek])
    expect(model.selectedWeek.key).toBe(202642)
  })

  it('shows the part of the range on a filtered axis that starts inside it', () => {
    const index = buildInspectionIndex([["WW15'2026", 'Final', 'NCR', 'A']], COLUMNS, TODAY)
    const model = buildInspectionModel(index, view(index, { dateRange: RANGE, selectedKey: 202615 }))
    expect(model.window[0].week.key).toBe(202615)
    expect(model.window[model.window.length - 1].week.key).toBe(202620)
    expect(model.toDate.finals).toBe(1)
    expect(model.rangeLabel).toBe("WW10'2026 to WW20'2026")
  })

  it('no range equals the existing output exactly', () => {
    const index = syntheticIndex()
    const selected = index.positionByKey.get(202640) ?? -1
    const model = buildInspectionModel(index, view(index, { selectedKey: 202640, windowEndKey: 202642, range: 'all' }))
    expect(model.rangeLabel).toBeNull()
    expect(model.weekOptions).toEqual(index.weeks.map((item) => item.week).reverse())
    expect(model.window).toEqual(index.weeks)
    expect(model.toDate).toEqual({
      finals: index.cumulativeFinals[selected],
      sors: index.cumulativeSors[selected],
      finalsThisWeek: index.weeks[selected].finals,
      sorsThisWeek: index.weeks[selected].sors,
      cleanFinals: index.cumulativeFinals[selected] - index.cumulativeIssues[selected],
      passRate: passRateAt(index, selected),
      passRateDeltaPoints: (passRateAt(index, selected) ?? 0) - (passRateAt(index, selected - 1) ?? 0),
    })
    model.passRateTrend.forEach((point, position) => {
      expect(point).toEqual({
        week: index.weeks[position].week,
        rate: passRateAt(index, position),
        cleanFinals: index.cumulativeFinals[position] - index.cumulativeIssues[position],
        totalFinals: index.cumulativeFinals[position],
        hadIssue: index.weeks[position].issuesFound > 0,
        issuesFound: index.weeks[position].issuesFound,
      })
    })
    expect(model.hasData).toBe(true)
  })
})
