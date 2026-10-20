import { describe, expect, it } from 'vitest'

import { splitCombinedRows } from '../combined'
import { buildPerformanceIndex, buildPerformanceModel, buildPersonDetail } from '../performance'
import type { PerformanceIndex, PerformanceRow } from '../performance'
import type { CombinedColumns, RangeMode, ViewState } from '../types'

const COLUMNS: CombinedColumns = {
  source: 0,
  workWeek: 1,
  phase: 2,
  issue: 3,
  building: 4,
  qcr: 5,
  welder: 6,
  tagNo: 7,
  signature: -1,
  signedWeek: -1,
  id: -1,
  status: -1,
  type: -1,
  createdOn: -1,
  updatedOn: -1,
  createdBy: -1,
  rootCause: -1,
  greenTags: -1,
}
const TODAY = new Date(2026, 9, 15) // WW42'2026
const CURRENT = 202642

type Row = ReadonlyArray<string | null>

function week(number: number): string {
  return `WW${String(number).padStart(2, '0')}'2026`
}

function finals(qcr: string, weekNumber: number, count: number, ncrs = 0, source: 'Electrical' | 'Mechanical' = 'Electrical'): Row[] {
  return Array.from({ length: count }, (_, item) => [
    source,
    week(weekNumber),
    'Final',
    item < ncrs ? `Defect ${weekNumber}.${item}` : 'No Issue Found',
    `B${weekNumber}`,
    qcr,
    null,
    null,
  ])
}

function sors(qcr: string | null, weekNumber: number, count: number, source: 'Electrical' | 'Mechanical' = 'Electrical'): Row[] {
  return Array.from({ length: count }, () => [source, week(weekNumber), 'SOR', 'No Issue Found', 'B1', qcr, null, null])
}

function welds(welder: string | null, weekNumber: number, count: number, ncrs = 0): Row[] {
  return Array.from({ length: count }, (_, item) => [
    'Welding',
    week(weekNumber),
    null,
    item < ncrs ? `BIM #${weekNumber}${item}` : 'No',
    null,
    null,
    welder,
    `TAG-${weekNumber}-${item}`,
  ])
}

function index(rows: Row[]): PerformanceIndex {
  return buildPerformanceIndex(splitCombinedRows(rows, COLUMNS.source), COLUMNS, TODAY)
}

function view(range: RangeMode, endKey = CURRENT): ViewState {
  return { selectedKey: endKey, windowEndKey: endKey, range }
}

function names(rows: PerformanceRow[]): string[] {
  return rows.map((row) => row.name)
}

describe('buildPerformanceModel: ranking', () => {
  it('ranks by NCR rate, then NCRs, then name', () => {
    const built = index([
      ...finals('QCR 9', 42, 5),
      ...finals('QCR 10', 42, 5),
      ...finals('Low', 42, 5, 1),
      ...finals('High', 42, 10, 2),
      ...finals('Top', 42, 5, 2),
    ])
    const model = buildPerformanceModel(built, view('recent'), 'qcr', 5)
    expect(names(model.ranked)).toEqual(['Top', 'High', 'Low', 'QCR 9', 'QCR 10'])
    expect(model.ranked.map((row) => row.rate)).toEqual([40, 20, 20, 0, 0])
  })

  it('ranks a person whose volume equals the minimum and puts one below it under Below minimum', () => {
    const built = index([...finals('At', 42, 5), ...finals('Under', 42, 4)])
    const model = buildPerformanceModel(built, view('recent'), 'qcr', 5)
    expect(names(model.ranked)).toEqual(['At'])
    expect(names(model.belowMinimum)).toEqual(['Under'])
  })

  it('sorts Below minimum by volume descending', () => {
    const built = index([...finals('Two', 42, 2), ...finals('Three', 42, 3)])
    const model = buildPerformanceModel(built, view('recent'), 'qcr', 5)
    expect(names(model.belowMinimum)).toEqual(['Three', 'Two'])
  })

  it('leaves out a person whose rows in the period are all SORs', () => {
    const built = index([...finals('Two', 42, 2), ...sors('Sor only', 42, 4), ...finals('Mixed', 10, 1), ...sors('Mixed', 42, 3)])
    const recent = buildPerformanceModel(built, view('recent'), 'qcr', 5)
    expect(names(recent.belowMinimum)).toEqual(['Two'])
    expect(recent.ranked).toEqual([])
    const all = buildPerformanceModel(built, view('all'), 'qcr', 5)
    expect(names(all.belowMinimum)).toEqual(['Two', 'Mixed'])
    expect(all.belowMinimum[1]).toMatchObject({ volume: 1, ncrs: 0, rate: 0 })
  })

  it('tags a person with the disciplines of their finals in the period only', () => {
    const built = index([...finals('QCR 01', 42, 5), ...sors('QCR 01', 42, 2, 'Mechanical')])
    expect(buildPerformanceModel(built, view('recent'), 'qcr', 5).ranked[0].tags).toEqual(['E'])
  })

  it('treats a minimum below 1 as 1', () => {
    const built = index(finals('One', 42, 1))
    expect(names(buildPerformanceModel(built, view('recent'), 'qcr', 0).ranked)).toEqual(['One'])
    expect(names(buildPerformanceModel(built, view('recent'), 'qcr', Number.NaN).ranked)).toEqual(['One'])
  })

  it('breaks a name tie under the collator by group key', () => {
    const built = index([...finals('José', 42, 5), ...finals('Jose', 42, 5)])
    expect(names(buildPerformanceModel(built, view('recent'), 'qcr', 5).ranked)).toEqual(['Jose', 'José'])
    expect(names(buildPerformanceModel(built, view('recent'), 'qcr', 6).belowMinimum)).toEqual(['Jose', 'José'])
  })

  it('leaves out people with no rows in the period', () => {
    const built = index([...finals('Old', 5, 6), ...finals('New', 42, 6)])
    const model = buildPerformanceModel(built, view('recent'), 'qcr', 5)
    expect(names(model.ranked)).toEqual(['New'])
    expect(model.belowMinimum).toEqual([])
  })
})

describe('buildPerformanceModel: period', () => {
  const built = index([
    ...finals('QCR 01', 12, 3, 1),
    ...finals('QCR 01', 13, 2, 1, 'Mechanical'),
    ...finals('QCR 01', 42, 4, 0, 'Mechanical'),
  ])

  it('sums the 30 weeks ending at the picked week in 30 WW', () => {
    const model = buildPerformanceModel(built, view('recent'), 'qcr', 1)
    expect(model.ranked[0]).toMatchObject({ volume: 6, ncrs: 1, tags: ['M'] })
    expect(model.window).toMatchObject({ first: { label: "WW13'2026" }, last: { label: "WW42'2026" }, weekCount: 30 })
  })

  it('sums every week through the picked week in All', () => {
    const model = buildPerformanceModel(built, view('all'), 'qcr', 1)
    expect(model.ranked[0]).toMatchObject({ volume: 9, ncrs: 2, tags: ['E', 'M'] })
    expect(model.window).toMatchObject({ first: { label: "WW12'2026" }, weekCount: 31 })
  })

  it('ends the period at the picked week, not the current week', () => {
    const model = buildPerformanceModel(built, view('all', 202641), 'qcr', 1)
    expect(model.ranked[0]).toMatchObject({ volume: 5, ncrs: 2 })
    expect(model.selectedWeek.label).toBe("WW41'2026")
  })

  it('ends the period at the last week when the picked week is not in the index', () => {
    const model = buildPerformanceModel(built, view('all', 203001), 'qcr', 1)
    expect(model.window.last.label).toBe("WW42'2026")
    expect(model.selectedWeek.label).toBe("WW42'2026")
    expect(model.ranked[0]).toMatchObject({ volume: 9, ncrs: 2 })
  })

  it('lists the weeks newest first', () => {
    const model = buildPerformanceModel(built, view('recent'), 'qcr', 1)
    expect(model.weekOptions[0].label).toBe("WW42'2026")
    expect(model.weekOptions[model.weekOptions.length - 1].label).toBe("WW12'2026")
  })
})

describe('buildPerformanceModel: trend', () => {
  it('covers the 30 weeks ending at the picked week, whatever the range', () => {
    const built = index([...finals('QCR 01', 1, 1), ...finals('QCR 01', 13, 2, 1), ...finals('QCR 01', 42, 3)])
    const model = buildPerformanceModel(built, view('all'), 'qcr', 1)
    const trend = model.ranked[0].trend
    expect(trend).toHaveLength(30)
    expect(trend[0]).toEqual({ volume: 2, hasNcr: true })
    expect(trend[29]).toEqual({ volume: 3, hasNcr: false })
    expect(model.ranked[0].ncrWeeks).toBe(1)
  })

  it('is shorter when there are fewer than 30 weeks', () => {
    const built = index(finals('QCR 01', 40, 1))
    expect(buildPerformanceModel(built, view('recent'), 'qcr', 1).ranked[0].trend).toHaveLength(3)
  })
})

describe('buildPerformanceModel: Not recorded and summary', () => {
  it('gathers Not recorded rows into one row and counts them in the summary', () => {
    const built = index([...finals('QCR 01', 42, 5, 1), ...sors(null, 42, 3), ...finals('N/A', 42, 2, 1)])
    const model = buildPerformanceModel(built, view('recent'), 'qcr', 5)
    expect(model.notRecorded).toMatchObject({ name: 'Not recorded', volume: 2, ncrs: 1, rate: 50 })
    expect(model.summary).toEqual({ peopleRanked: 1, volume: 7, ncrs: 2, rate: (2 / 7) * 100 })
  })

  it('has no Not recorded row when the only rows with no QCR/FE are SORs', () => {
    const built = index([...finals('QCR 01', 42, 5), ...sors(null, 42, 3), ...sors('N/A', 42, 2)])
    expect(buildPerformanceModel(built, view('recent'), 'qcr', 5).notRecorded).toBeNull()
  })

  it('has no Not recorded row when every row names someone', () => {
    const model = buildPerformanceModel(index(finals('QCR 01', 42, 5)), view('recent'), 'qcr', 5)
    expect(model.notRecorded).toBeNull()
  })

  it('counts a shared weld once in the summary and credits it to each welder', () => {
    const built = index([...welds('Welder 001, Welder 002', 42, 10, 1), ...welds('Welder 001', 42, 2)])
    const model = buildPerformanceModel(built, view('recent'), 'welders', 10)
    expect(model.ranked.map((row) => [row.name, row.volume, row.ncrs])).toEqual([
      ['Welder 002', 10, 1],
      ['Welder 001', 12, 1],
    ])
    expect(model.summary).toEqual({ peopleRanked: 2, volume: 12, ncrs: 1, rate: (1 / 12) * 100 })
    expect(model.sharedWelds).toBe(10)
  })

  it('reports a null rate and no rows when the period has only SORs', () => {
    const model = buildPerformanceModel(index(sors('QCR 01', 42, 2)), view('recent'), 'qcr', 5)
    expect(model.summary).toEqual({ peopleRanked: 0, volume: 0, ncrs: 0, rate: null })
    expect([model.ranked, model.belowMinimum, model.notRecorded]).toEqual([[], [], null])
  })

  it('keeps the groups apart', () => {
    const built = index([...finals('QCR 01', 42, 5), ...welds('Welder 001', 42, 10)])
    expect(names(buildPerformanceModel(built, view('recent'), 'qcr', 1).ranked)).toEqual(['QCR 01'])
    expect(names(buildPerformanceModel(built, view('recent'), 'welders', 1).ranked)).toEqual(['Welder 001'])
  })
})

describe('buildPersonDetail', () => {
  const built = index([
    ...finals('QCR 01', 10, 2, 2),
    ...finals('QCR 01', 40, 2, 1),
    ...finals('QCR 01', 42, 2, 0, 'Mechanical'),
    ...finals('QCR 01', 42, 1, 1, 'Mechanical'),
    ...welds('Welder 001, Welder 002', 41, 2, 1),
  ])

  it('runs the NCR rate cumulatively within the period', () => {
    const detail = buildPersonDetail(built, 'qcr', 'qcr 01', view('recent'))
    const weeks = detail?.weeks.slice(-3).map((item) => [item.week.label, item.volume, item.ncrs, item.runningRate])
    expect(weeks).toEqual([
      ["WW40'2026", 2, 1, 50],
      ["WW41'2026", 0, 0, 50],
      ["WW42'2026", 3, 1, 40],
    ])
    expect(detail?.weeks[0]).toMatchObject({ volume: 0, runningRate: null })
    expect(detail?.weeks).toHaveLength(30)
  })

  it('gives period and all-time cards', () => {
    const detail = buildPersonDetail(built, 'qcr', 'qcr 01', view('recent'))
    expect(detail?.period).toEqual({ volume: 5, ncrs: 2, rate: 40 })
    expect(detail?.allTime).toEqual({ volume: 7, ncrs: 4, rate: (4 / 7) * 100 })
    expect(detail?.tags).toEqual(['E', 'M'])
  })

  it('lists the period NCR rows newest first with Building and Issue', () => {
    const detail = buildPersonDetail(built, 'qcr', 'qcr 01', view('recent'))
    expect(detail?.ncrRows).toEqual([
      { weekKey: 202642, weekLabel: "WW42'2026", source: 'Mechanical', place: 'B42', issue: 'Defect 42.0' },
      { weekKey: 202640, weekLabel: "WW40'2026", source: 'Electrical', place: 'B40', issue: 'Defect 40.0' },
    ])
  })

  it('lists weld NCRs with Tag No for each credited welder', () => {
    const detail = buildPersonDetail(built, 'welders', 'welder 002', view('all'))
    expect(detail?.name).toBe('Welder 002')
    expect(detail?.ncrRows).toEqual([
      { weekKey: 202641, weekLabel: "WW41'2026", source: 'Welding', place: 'TAG-41-0', issue: 'BIM #410' },
    ])
    expect(detail?.tags).toEqual([])
  })

  it('returns null for an unknown person', () => {
    expect(buildPersonDetail(built, 'qcr', 'nobody', view('recent'))).toBeNull()
  })
})
