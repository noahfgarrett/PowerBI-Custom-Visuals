import { describe, expect, it } from 'vitest'

import { splitCombinedRows } from '../combined'
import {
  buildPerformanceIndex,
  buildPerformanceModel,
  buildPersonDetail,
  filterPerformanceIndex,
  performanceFilterFields,
  performanceFilterRows,
  performanceRowWeekKey,
} from '../performance'
import type { PerformanceIndex, PerformanceRow } from '../performance'
import { buildFilterCatalog, matchRows } from '../rowFilters'
import type { CombinedColumns, InspectionRows, RangeMode, ViewState } from '../types'

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
  return { selectedKey: endKey, windowEndKey: endKey, range, dateRange: null }
}

function names(rows: PerformanceRow[]): string[] {
  return rows.map((row) => row.name)
}

describe('buildPerformanceModel: ranking', () => {
  it('ranks lowest NCR Pass Rate first, then NCRs, then name', () => {
    const built = index([
      ...finals('QCR 9', 42, 5),
      ...finals('QCR 10', 42, 5),
      ...finals('Low', 42, 5, 1),
      ...finals('High', 42, 10, 2),
      ...finals('Top', 42, 5, 2),
    ])
    const model = buildPerformanceModel(built, view('recent'), 'qcr', 5)
    expect(names(model.ranked)).toEqual(['Top', 'High', 'Low', 'QCR 9', 'QCR 10'])
    expect(model.ranked.map((row) => row.passRate)).toEqual([60, 80, 80, 100, 100])
  })

  it('shows 100 finals with 2 NCRs as a 98% pass rate', () => {
    const model = buildPerformanceModel(index(finals('QCR 01', 42, 100, 2)), view('recent'), 'qcr', 5)
    expect(model.ranked[0].passRate).toBe(98)
  })

  it('shows 100 welds with 2 NCRs as a 98% pass rate', () => {
    const model = buildPerformanceModel(index(welds('Welder 001', 42, 100, 2)), view('recent'), 'welders', 10)
    expect(model.ranked[0].passRate).toBe(98)
  })

  it('reads 0% for a person whose every final has an NCR', () => {
    const model = buildPerformanceModel(index(finals('QCR 01', 42, 5, 5)), view('recent'), 'qcr', 5)
    expect(model.ranked[0].passRate).toBe(0)
  })

  it('treats equal fractions as a tie, whatever their volumes, and breaks it on NCRs', () => {
    const built = index([...finals('QCR 01', 42, 7, 1), ...finals('QCR 02', 42, 21, 3), ...finals('QCR 03', 42, 49, 7)])
    const model = buildPerformanceModel(built, view('recent'), 'qcr', 5)
    expect(names(model.ranked)).toEqual(['QCR 03', 'QCR 02', 'QCR 01'])
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
    expect(all.belowMinimum[1]).toMatchObject({ volume: 1, ncrs: 0, passRate: 100 })
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
    expect(model.notRecorded).toMatchObject({ name: 'Not recorded', volume: 2, ncrs: 1, passRate: 50 })
    expect(model.summary).toEqual({ peopleRanked: 1, volume: 7, ncrs: 2, passRate: (5 / 7) * 100 })
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
    expect(model.summary).toEqual({ peopleRanked: 2, volume: 12, ncrs: 1, passRate: (11 / 12) * 100 })
    expect(model.sharedWelds).toBe(10)
  })

  it('reports a null pass rate and no rows when the period has only SORs', () => {
    const model = buildPerformanceModel(index(sors('QCR 01', 42, 2)), view('recent'), 'qcr', 5)
    expect(model.summary).toEqual({ peopleRanked: 0, volume: 0, ncrs: 0, passRate: null })
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

  it('runs the NCR Pass Rate cumulatively within the period', () => {
    const detail = buildPersonDetail(built, 'qcr', 'qcr 01', view('recent'))
    const weeks = detail?.weeks.slice(-3).map((item) => [item.week.label, item.volume, item.ncrs, item.runningPassRate])
    expect(weeks).toEqual([
      ["WW40'2026", 2, 1, 50],
      ["WW41'2026", 0, 0, 50],
      ["WW42'2026", 3, 1, 60],
    ])
    expect(detail?.weeks[0]).toMatchObject({ volume: 0, runningPassRate: null })
    expect(detail?.weeks).toHaveLength(30)
  })

  it('gives period and all-time cards', () => {
    const detail = buildPersonDetail(built, 'qcr', 'qcr 01', view('recent'))
    expect(detail?.period).toEqual({ volume: 5, ncrs: 2, passRate: 60 })
    expect(detail?.allTime).toEqual({ volume: 7, ncrs: 4, passRate: (3 / 7) * 100 })
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

describe('performance filter fields', () => {
  const COLUMNS_BOUND: CombinedColumns = { ...COLUMNS, generalContractor: 8, discipline: 9, pipeSpec: 10, fluidCode: 11 }

  function labels(columns: CombinedColumns, group: 'qcr' | 'welders'): string[] {
    return performanceFilterFields(columns, group).map((field) => field.label)
  }

  it('the QCR / FE group offers Contractor, Building and Discipline', () => {
    expect(labels(COLUMNS_BOUND, 'qcr')).toEqual(['Contractor', 'Building', 'Discipline'])
  })

  it('the Welders group offers Building, Pipe Spec and Fluid Code', () => {
    expect(labels(COLUMNS_BOUND, 'welders')).toEqual(['Building', 'Pipe Spec', 'Fluid Code'])
  })

  it('leaves out the fields whose slots are not bound', () => {
    expect(labels(COLUMNS, 'qcr')).toEqual(['Building'])
    expect(labels(COLUMNS, 'welders')).toEqual(['Building'])
    expect(labels({ ...COLUMNS, generalContractor: -1, discipline: 9, pipeSpec: -1, fluidCode: 11 }, 'qcr')).toEqual(['Building', 'Discipline'])
    expect(labels({ ...COLUMNS, generalContractor: -1, discipline: 9, pipeSpec: -1, fluidCode: 11 }, 'welders')).toEqual(['Building', 'Fluid Code'])
  })

  it('gives both groups one Building field, grouping F63.1 and the welds\' derived F631 alike', () => {
    const [inspectionBuilding] = performanceFilterFields(COLUMNS_BOUND, 'qcr').filter((field) => field.id === 'building')
    const [weldBuilding] = performanceFilterFields(COLUMNS_BOUND, 'welders').filter((field) => field.id === 'building')
    const inspection = ['Electrical', week(42), 'Final', 'No Issue Found', 'F63.1', 'QCR 01', null, null]
    const weld = ['Welding', week(42), null, 'No', null, null, 'Welder 001', 'P4-F631XX001-1']
    expect(inspectionBuilding.read(inspection)).toBe('F63.1')
    expect(weldBuilding.read(weld)).toBe('F631')
    expect(inspectionBuilding.groupBy?.('F63.1')).toBe(weldBuilding.groupBy?.('F631'))
  })

  it('labels a blank Contractor and a blank Building as the charts do', () => {
    const rows: Row[] = [
      ['Electrical', week(42), 'Final', 'No Issue Found', '', 'QCR 01', null, null, '', null, null, null],
      ['Electrical', week(42), 'Final', 'No Issue Found', 'F63.1', 'QCR 01', null, null, 'Greyfox', null, null, null],
    ]
    const catalog = buildFilterCatalog(rows, performanceFilterFields(COLUMNS_BOUND, 'qcr'))
    const optionLabels = (id: string): string[] =>
      catalog.fields.find((field) => field.def.id === id)?.options.map((option) => option.label) ?? []
    expect(optionLabels('contractor')).toEqual(['Greyfox', 'Unassigned'])
    expect(optionLabels('building')).toEqual(['F63.1', 'Unspecified'])
  })

  it('makes blank and N/A and an Unassigned cell one Contractor value, listed last', () => {
    const rows: Row[] = ['Greyfox', '', 'N/A', 'Unassigned'].map((name) => ['Electrical', week(42), 'Final', 'No Issue Found', 'F63.1', 'QCR 01', null, null, name, null, null, null])
    const [contractorField] = buildFilterCatalog(rows, performanceFilterFields(COLUMNS_BOUND, 'qcr')).fields
    expect(contractorField.options.map((option) => [option.label, option.count])).toEqual([['Greyfox', 1], ['Unassigned', 3]])
  })

  it('labels a blank Pipe Spec and Fluid Code as the Welding charts do', () => {
    const rows: Row[] = [
      ['Welding', week(42), null, 'No', null, null, 'Welder 001', 'P4-F631XX001-1', null, null, 'PCH', 'AW'],
      ['Welding', week(42), null, 'No', null, null, 'Welder 001', 'P4-F631XX001-1', null, null, null, null],
    ]
    const catalog = buildFilterCatalog(rows, performanceFilterFields(COLUMNS_BOUND, 'welders'))
    const optionLabels = (id: string): string[] =>
      catalog.fields.find((field) => field.def.id === id)?.options.map((option) => option.label) ?? []
    expect(optionLabels('pipeSpec')).toEqual(['PCH', 'Unspecified'])
    expect(optionLabels('fluidCode')).toEqual(['AW', 'Unspecified'])
  })

  it('offers each group its own rows: Electrical and Mechanical, or Welding', () => {
    const built = index([...finals('QCR 01', 42, 2), ...sors('QCR 01', 42, 1, 'Mechanical'), ...welds('Welder 001', 42, 3)])
    expect(performanceFilterRows(built, 'qcr')).toHaveLength(3)
    expect(performanceFilterRows(built, 'welders')).toHaveLength(3)
    expect(performanceFilterRows(built, 'qcr').every((row) => row[0] !== 'Welding')).toBe(true)
    expect(performanceFilterRows(built, 'welders').every((row) => row[0] === 'Welding')).toBe(true)
  })

  it('reads a row\'s week from Work Week, and null when it can\'t be read', () => {
    const weekKey = performanceRowWeekKey(COLUMNS)
    expect(weekKey(finals('QCR 01', 42, 1)[0])).toBe(202642)
    expect(weekKey(['Electrical', 'not a week', 'Final', 'No Issue Found', 'B1', 'QCR 01', null, null])).toBeNull()
  })
})

describe('filterPerformanceIndex', () => {
  const bim: Row = ['BIM', week(42), null, null, null, null, null, null]
  const civil: Row = ['Civil', week(42), null, null, null, null, null, null]
  const built = index([
    ...finals('QCR 01', 2, 2),
    ...finals('QCR 01', 42, 3, 1),
    ...finals('QCR 02', 42, 2),
    ['Electrical', 'not a week', 'Final', 'No Issue Found', 'B1', 'QCR 01', null, null],
    ['Electrical', 'not a week', 'Final', 'No Issue Found', 'B2', 'QCR 02', null, null],
    ...welds('Welder 001', 40, 2),
    bim,
    civil,
  ])

  function matching(qcr: string): InspectionRows {
    return performanceFilterRows(built, 'qcr').filter((row) => row[5] === qcr)
  }

  it('keeps the full week axis when the matching rows start later', () => {
    const filtered = filterPerformanceIndex(built, matching('QCR 02'))
    expect(filtered.weeks).toEqual(built.weeks)
    expect(filtered.positionByKey.get(202642)).toBe(built.positionByKey.get(202642))
  })

  it('counts only the matching rows', () => {
    const filtered = filterPerformanceIndex(built, matching('QCR 02'))
    const model = buildPerformanceModel(filtered, view('all'), 'qcr', 1)
    expect(names(model.ranked)).toEqual(['QCR 02'])
    expect(model.summary).toMatchObject({ volume: 2, ncrs: 0 })
  })

  it('points the NCR rows at the rows that built it', () => {
    const filtered = filterPerformanceIndex(built, performanceFilterRows(built, 'qcr').filter((row) => row[1] === week(42)))
    expect(buildPersonDetail(filtered, 'qcr', 'qcr 01', view('all'))?.ncrRows.map((row) => row.issue)).toEqual(['Defect 42.0'])
  })

  it('restates the skipped rows, and keeps the row limit and unknown Source counts of every row', () => {
    const filtered = filterPerformanceIndex(built, matching('QCR 02'))
    expect(built.footnotes.qcr.skippedRows).toBe(2)
    expect(filtered.footnotes.qcr.skippedRows).toBe(1)
    expect(filtered.footnotes.combinedRows).toBe(built.footnotes.combinedRows)
    expect(filtered.footnotes.unknownSource).toBe(1)
  })
})

describe('buildPerformanceModel: date range', () => {
  const built = index([
    ...finals('QCR 01', 3, 5, 5),
    ...finals('QCR 01', 20, 5, 1),
    ...finals('QCR 02', 20, 4),
    ...finals('QCR 02', 25, 2, 1),
    ...finals('QCR 03', 25, 1),
    ...finals('', 22, 2, 1),
    ...finals('QCR 04', 40, 9),
  ])
  const range = (fromWeek: number, toWeek: number): ViewState => ({
    selectedKey: CURRENT,
    windowEndKey: CURRENT,
    range: 'recent',
    dateRange: { fromKey: 202600 + fromWeek, toKey: 202600 + toWeek },
  })

  it('ranks over the range\'s weeks, whatever the 30 WW | All period says', () => {
    const recent = buildPerformanceModel(built, { ...range(20, 25), range: 'recent' }, 'qcr', 5)
    const all = buildPerformanceModel(built, { ...range(20, 25), range: 'all' }, 'qcr', 5)
    expect(recent).toEqual(all)
    expect(recent.ranked.map((row) => [row.name, row.volume, row.ncrs])).toEqual([['QCR 01', 5, 1], ['QCR 02', 6, 1]])
    expect(recent.belowMinimum.map((row) => row.name)).toEqual(['QCR 03'])
  })

  it('restates the summary and the Not recorded row to the range', () => {
    const model = buildPerformanceModel(built, range(20, 25), 'qcr', 5)
    expect(model.summary).toEqual({ peopleRanked: 2, volume: 14, ncrs: 3, passRate: (11 / 14) * 100 })
    expect(model.notRecorded).toMatchObject({ volume: 2, ncrs: 1 })
    expect(buildPerformanceModel(built, range(23, 25), 'qcr', 1).notRecorded).toBeNull()
  })

  it('names the range as its window', () => {
    const { window } = buildPerformanceModel(built, range(20, 25), 'qcr', 5)
    expect([window.first.label, window.last.label, window.weekCount]).toEqual([week(20), week(25), 6])
  })

  it('gives the trend exactly the range\'s weeks', () => {
    const short = buildPerformanceModel(built, range(20, 25), 'qcr', 5)
    expect(short.ranked[0].trend).toHaveLength(6)
    const long = buildPerformanceModel(built, range(3, 40), 'qcr', 5)
    const qcr01 = long.ranked.find((row) => row.name === 'QCR 01')
    expect(qcr01?.trend).toHaveLength(38)
    expect(qcr01?.trend[0]).toEqual({ volume: 5, hasNcr: true })
    expect(qcr01?.ncrWeeks).toBe(2)
  })

  it('limits the week picker to the range and clamps the selected week into it', () => {
    const model = buildPerformanceModel(built, range(20, 25), 'qcr', 5)
    expect(model.weekOptions.map((item) => item.label)).toEqual([25, 24, 23, 22, 21, 20].map(week))
    expect(model.selectedWeek.label).toBe(week(25))
  })

  it('keeps the range as the period when a week inside it is picked', () => {
    const atWeek22: ViewState = { ...range(20, 25), selectedKey: 202622, windowEndKey: 202622 }
    const model = buildPerformanceModel(built, atWeek22, 'qcr', 5)
    expect(model.selectedWeek.label).toBe(week(22))
    expect(model.window.weekCount).toBe(6)
    expect(model.summary).toEqual(buildPerformanceModel(built, range(20, 25), 'qcr', 5).summary)
  })

  it('applies the minimum inside the range', () => {
    expect(names(buildPerformanceModel(built, range(20, 25), 'qcr', 6).ranked)).toEqual(['QCR 02'])
    expect(names(buildPerformanceModel(built, range(25, 25), 'qcr', 5).ranked)).toEqual([])
    expect(buildPerformanceModel(built, range(25, 25), 'qcr', 5).belowMinimum.map((row) => row.name)).toEqual(['QCR 02', 'QCR 03'])
  })

  it('shows a person\'s range as their period, restarting the running rate at From', () => {
    const detail = buildPersonDetail(built, 'qcr', 'qcr 01', range(20, 25))
    expect(detail?.period).toEqual({ volume: 5, ncrs: 1, passRate: 80 })
    expect(detail?.weeks.map((item) => item.week.label)).toEqual([20, 21, 22, 23, 24, 25].map(week))
    expect(detail?.weeks[0].runningPassRate).toBe(80)
    expect(detail?.ncrRows.map((row) => row.issue)).toEqual(['Defect 20.0'])
    expect(detail?.allTime).toEqual({ volume: 10, ncrs: 6, passRate: 40 })
  })
})

describe('the filtered period', () => {
  const COLUMNS_BOUND: CombinedColumns = { ...COLUMNS, generalContractor: 8, discipline: 9, pipeSpec: 10, fluidCode: 11 }

  function contractor(name: string, rows: Row[]): Row[] {
    return rows.map((row) => [...row, name, null, null, null])
  }

  const rows = [
    ...contractor('Greyfox', finals('QCR 01', 40, 6, 1)),
    ...contractor('Bayside', finals('QCR 01', 41, 4, 2)),
    ...contractor('Bayside', finals('QCR 02', 41, 2)),
    ...contractor('Greyfox', finals('', 41, 3, 1)),
    ...contractor('Bayside', finals('N/A', 41, 1)),
  ]
  const built = buildPerformanceIndex(splitCombinedRows(rows, COLUMNS_BOUND.source), COLUMNS_BOUND, TODAY)

  function filteredBy(name: string): PerformanceIndex {
    const fields = performanceFilterFields(COLUMNS_BOUND, 'qcr')
    const groupRows = performanceFilterRows(built, 'qcr')
    const catalog = buildFilterCatalog(groupRows, fields)
    return filterPerformanceIndex(built, matchRows(groupRows, catalog, new Map([['contractor', new Set([name.toLowerCase()])]])))
  }

  it('applies the minimum to the matching rows, moving a person below it', () => {
    expect(names(buildPerformanceModel(built, view('recent'), 'qcr', 5).ranked)).toEqual(['QCR 01'])
    const filtered = buildPerformanceModel(filteredBy('Bayside'), view('recent'), 'qcr', 5)
    expect(filtered.ranked).toEqual([])
    expect(filtered.belowMinimum.map((row) => [row.name, row.volume, row.ncrs])).toEqual([['QCR 01', 4, 2], ['QCR 02', 2, 0]])
    expect(filtered.summary).toEqual({ peopleRanked: 0, volume: 7, ncrs: 2, passRate: (5 / 7) * 100 })
  })

  it('restates the Not recorded row', () => {
    expect(buildPerformanceModel(built, view('recent'), 'qcr', 5).notRecorded).toMatchObject({ volume: 4, ncrs: 1 })
    expect(buildPerformanceModel(filteredBy('Greyfox'), view('recent'), 'qcr', 5).notRecorded).toMatchObject({ volume: 3, ncrs: 1 })
    expect(buildPerformanceModel(filteredBy('Bayside'), view('recent'), 'qcr', 5).notRecorded).toMatchObject({ volume: 1, ncrs: 0 })
  })

  it('reads a person\'s period from the matching rows and All time from the rows it is given', () => {
    const detail = buildPersonDetail(filteredBy('Bayside'), 'qcr', 'qcr 01', view('recent'), built)
    expect(detail?.period).toEqual({ volume: 4, ncrs: 2, passRate: 50 })
    expect(detail?.allTime).toEqual({ volume: 10, ncrs: 3, passRate: 70 })
    expect(detail?.weeks.find((item) => item.week.label === week(40))?.volume).toBe(0)
    expect(detail?.ncrRows.map((row) => row.weekLabel)).toEqual([week(41), week(41)])
  })

  it('no filter leaves fixtures unchanged: binding the new slots moves no number, and neither does matching every row', () => {
    const unbound = index(rows.map((row) => row.slice(0, 8)))
    const everyRow = filterPerformanceIndex(built, performanceFilterRows(built, 'qcr'))
    for (const candidate of [built, everyRow]) {
      for (const range of ['recent', 'all'] as const) {
        expect(buildPerformanceModel(candidate, view(range), 'qcr', 5)).toEqual(buildPerformanceModel(unbound, view(range), 'qcr', 5))
      }
    }
  })
})
