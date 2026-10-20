import { describe, expect, it } from 'vitest'

import type { CardMode, OverviewCard, OverviewModel } from '../overview'
import type { CombinedColumns, ViewState } from '../types'
import { inspectionColumnsOf, issueColumnsOf, splitCombinedRows, weldColumnsOf } from '../combined'
import { buildInspectionIndex, buildInspectionModel } from '../inspections'
import { buildIssueBenchmarks } from '../issueBenchmarks'
import { buildIssueIndex, buildIssueModel } from '../issues'
import { buildOverviewIndex, buildOverviewModel } from '../overview'
import { buildWeldIndex, buildWeldModel } from '../welds'
import { COMBINED_COLUMNS, COMBINED_ROWS } from './fixtures/combinedRows'
import { cardsOf } from './overviewRows'

type CombinedColumnName = (typeof COMBINED_COLUMNS)[number]

function position(name: CombinedColumnName): number {
  return COMBINED_COLUMNS.indexOf(name)
}

const COLUMNS: CombinedColumns = {
  source: position('Source'),
  workWeek: position('Work Week'),
  phase: position('Inspection Phase'),
  issue: position('Issue'),
  building: position('Building'),
  qcr: position('QCR/FE'),
  welder: position('Welder'),
  tagNo: position('Tag No'),
  signature: position('Signature'),
  signedWeek: position('Work Week Signed'),
  id: position('ID'),
  status: position('Status'),
  type: position('Type'),
  createdOn: position('Created On'),
  updatedOn: position('Updated On'),
  createdBy: position('Created By'),
  rootCause: position('Root Cause'),
  greenTags: -1,
}
const TODAY = new Date(2026, 9, 15) // WW42'2026
const WW41 = 202641
const WW42 = 202642

const split = splitCombinedRows(COMBINED_ROWS, COLUMNS.source)
const index = buildOverviewIndex(split, COLUMNS, TODAY)

function viewAt(key: number, range: ViewState['range'] = 'recent'): ViewState {
  return { selectedKey: key, windowEndKey: key, range }
}

function modelAt(key: number, mode: CardMode): OverviewModel {
  return buildOverviewModel(index, viewAt(key), mode)
}

/** A count card's value and its change: `(±n)` against W−1 in This WW, `+n this WW` in To date. */
type CountExpectation = readonly [value: number, delta: number]

/** A rate card's percent (2 decimals), sub-line, and change in points (4 decimals) or null when n/a. */
type RateExpectation = readonly [value: number | null, subLine: string, delta: number | null]

function expectCount(card: OverviewCard, [value, delta]: CountExpectation): void {
  expect([card.value, card.delta]).toEqual([value, delta])
}

function expectRate(card: OverviewCard, [value, subLine, delta]: RateExpectation): void {
  if (value === null) expect(card.value).toBeNull()
  else expect(card.value).toBeCloseTo(value, 2)
  expect(card.subLine).toBe(subLine)
  if (delta === null) {
    expect(card.delta).toBeNull()
    expect(card.deltaDisplay).toBe('Change n/a')
  } else {
    expect(card.delta).toBeCloseTo(delta, 4)
  }
}

interface Case {
  name: string
  key: number
  mode: CardMode
}

const CASES: Case[] = [
  { name: "WW42'2026 This WW", key: WW42, mode: 'week' },
  { name: "WW42'2026 To date", key: WW42, mode: 'toDate' },
  { name: "WW41'2026 This WW", key: WW41, mode: 'week' },
  { name: "WW41'2026 To date", key: WW41, mode: 'toDate' },
]

interface InspectionRowExpectation {
  finals: CountExpectation
  sors: CountExpectation
  ncrs: CountExpectation
  rate: RateExpectation
}

const ELECTRICAL: InspectionRowExpectation[] = [
  { finals: [3, -3], sors: [3, 0], ncrs: [0, 0], rate: [100, '3 / 3 Finals', 0] },
  { finals: [238, 3], sors: [48, 3], ncrs: [2, 0], rate: [99.16, '236 / 238 Finals', 0.0107] },
  { finals: [6, 2], sors: [3, 2], ncrs: [0, 0], rate: [100, '6 / 6 Finals', 0] },
  { finals: [235, 6], sors: [45, 3], ncrs: [2, 0], rate: [99.15, '233 / 235 Finals', 0.0223] },
]

const MECHANICAL: InspectionRowExpectation[] = [
  { finals: [0, 0], sors: [0, -2], ncrs: [0, 0], rate: [null, '0 Finals', null] },
  { finals: [44, 0], sors: [91, 0], ncrs: [1, 0], rate: [97.73, '43 / 44 Finals', 0] },
  { finals: [0, -1], sors: [2, 2], ncrs: [0, 0], rate: [null, '0 Finals', null] },
  { finals: [44, 0], sors: [91, 2], ncrs: [1, 0], rate: [97.73, '43 / 44 Finals', 0] },
]

interface WeldingRowExpectation {
  logged: CountExpectation
  signed: CountExpectation
  signedDisplay: string
  signoff: number
  signoffSubLine: string
  signoffDelta: number | null
  ncrs: CountExpectation
}

const WELDING: WeldingRowExpectation[] = [
  {
    logged: [0, -84],
    signed: [70, 24],
    signedDisplay: "+24 vs WW41'2026",
    signoff: 79.76,
    signoffSubLine: "67 of 84 · WW41'2026",
    signoffDelta: null,
    ncrs: [0, 0],
  },
  {
    logged: [1751, 0],
    signed: [1054, 70],
    signedDisplay: '+70 signed this WW',
    signoff: 60.19,
    signoffSubLine: '1,054 of 1,751 signed',
    signoffDelta: 0,
    ncrs: [11, 0],
  },
  {
    logged: [84, -42],
    signed: [46, -21],
    signedDisplay: "−21 vs WW40'2026",
    signoff: 79.76,
    signoffSubLine: "67 of 84 · WW41'2026",
    signoffDelta: null,
    ncrs: [0, 0],
  },
  {
    logged: [1751, 84],
    signed: [1054, 46],
    signedDisplay: '+46 signed this WW',
    signoff: 60.19,
    signoffSubLine: '1,054 of 1,751 signed',
    signoffDelta: 0.986,
    ncrs: [11, 0],
  },
]

interface BimRowExpectation {
  opened: CountExpectation
  closed: CountExpectation
}

const BIM: BimRowExpectation[] = [
  { opened: [0, 0], closed: [0, 0] },
  { opened: [177, 0], closed: [126, 0] },
  { opened: [0, 0], closed: [0, 0] },
  { opened: [177, 0], closed: [126, 0] },
]

interface QualityExpectation {
  cors: CountExpectation
  ncrs: CountExpectation
  ncrBreakdown: string
  inspection: RateExpectation
  welding: RateExpectation
  dwns: CountExpectation
}

const QUALITY: QualityExpectation[] = [
  {
    cors: [0, 0],
    ncrs: [0, 0],
    ncrBreakdown: 'E 0 · M 0 · W 0',
    inspection: [100, '0 NCRs of 3 finals', 0],
    welding: [null, '0 welds', null],
    dwns: [0, 0],
  },
  {
    cors: [171, 0],
    ncrs: [14, 0],
    ncrBreakdown: 'E 2 · M 1 · W 11',
    inspection: [98.94, '3 NCRs of 282 finals', 0.0114],
    welding: [99.37, '11 NCRs of 1,751 welds', 0],
    dwns: [0, 0],
  },
  {
    cors: [0, 0],
    ncrs: [0, 0],
    ncrBreakdown: 'E 0 · M 0 · W 0',
    inspection: [100, '0 NCRs of 6 finals', 0],
    welding: [100, '0 NCRs of 84 welds', 0],
    dwns: [0, 0],
  },
  {
    cors: [171, 0],
    ncrs: [14, 0],
    ncrBreakdown: 'E 2 · M 1 · W 11',
    inspection: [98.92, '3 NCRs of 279 finals', 0.0236],
    welding: [99.37, '11 NCRs of 1,751 welds', 0.0317],
    dwns: [0, 0],
  },
]

describe('QAQC Overview on the October exports (today 2026-10-15)', () => {
  it('connects all four sources with no unknown Source rows', () => {
    const { rows } = modelAt(WW42, 'week')
    expect([rows.electrical.connected, rows.mechanical.connected, rows.welding.connected, rows.bim.connected]).toEqual([true, true, true, true])
    expect(index.footnotes.unknownSource).toBe(0)
    expect(index.currentWeek.label).toBe("WW42'2026")
  })

  it.each(CASES.map((item, caseIndex) => [item.name, item, caseIndex] as const))('Electrical row, %s', (_, item, caseIndex) => {
    const [finals, sors, ncrs, rate] = cardsOf(modelAt(item.key, item.mode), 'electrical')
    const expected = ELECTRICAL[caseIndex]
    expectCount(finals, expected.finals)
    expectCount(sors, expected.sors)
    expectCount(ncrs, expected.ncrs)
    expectRate(rate, expected.rate)
  })

  it.each(CASES.map((item, caseIndex) => [item.name, item, caseIndex] as const))('Mechanical row, %s', (_, item, caseIndex) => {
    const [finals, sors, ncrs, rate] = cardsOf(modelAt(item.key, item.mode), 'mechanical')
    const expected = MECHANICAL[caseIndex]
    expectCount(finals, expected.finals)
    expectCount(sors, expected.sors)
    expectCount(ncrs, expected.ncrs)
    expectRate(rate, expected.rate)
  })

  it.each(CASES.map((item, caseIndex) => [item.name, item, caseIndex] as const))('Welding row, %s', (_, item, caseIndex) => {
    const [logged, signed, signoff, ncrs] = cardsOf(modelAt(item.key, item.mode), 'welding')
    const expected = WELDING[caseIndex]
    expectCount(logged, expected.logged)
    expectCount(signed, expected.signed)
    expect(signed.deltaDisplay).toBe(expected.signedDisplay)
    expect(signoff.value).toBeCloseTo(expected.signoff, 2)
    expect(signoff.subLine).toBe(expected.signoffSubLine)
    if (expected.signoffDelta === null) expect(signoff.delta).toBeNull()
    else expect(signoff.delta).toBeCloseTo(expected.signoffDelta, 4)
    expectCount(ncrs, expected.ncrs)
  })

  it.each(CASES.map((item, caseIndex) => [item.name, item, caseIndex] as const))('BIM Issues row, %s', (_, item, caseIndex) => {
    const [opened, closed, remaining] = cardsOf(modelAt(item.key, item.mode), 'bim')
    const expected = BIM[caseIndex]
    expectCount(opened, expected.opened)
    expectCount(closed, expected.closed)
    expectCount(remaining, [51, 0])
  })

  it.each(['week', 'toDate'] as const)('shows 51 issues past the normal close window as of WW42 (%s)', (mode) => {
    const past = cardsOf(modelAt(WW42, mode), 'bim')[3]
    expect([past.label, past.value, past.display, past.subLine, past.tone])
      .toEqual(['Past normal close window', 51, '51', 'of 51 open · 28 older than any closure · 71.2% closed', 'bad'])
  })

  it('shows Installation as the top root cause through WW42', () => {
    const top = modelAt(WW42, 'toDate').quality[5]
    expect([top.label, top.value, top.display, top.subLine]).toEqual(['Top root cause', 48, 'Installation', '48 of 177 issues · 27%'])
  })

  it('shows no top root cause in WW42, when no issue was opened', () => {
    const top = modelAt(WW42, 'week').quality[5]
    expect([top.label, top.value, top.display, top.subLine]).toEqual(['Top root cause', null, 'None', 'None opened this WW'])
  })

  it.each(CASES.map((item, caseIndex) => [item.name, item, caseIndex] as const))('quality strip, %s', (_, item, caseIndex) => {
    const [cors, ncrs, inspection, welding, dwns] = modelAt(item.key, item.mode).quality
    const expected = QUALITY[caseIndex]
    expectCount(cors, expected.cors)
    expectCount(ncrs, expected.ncrs)
    expect(ncrs.subLine).toBe(expected.ncrBreakdown)
    expectRate(inspection, expected.inspection)
    expectRate(welding, expected.welding)
    expectCount(dwns, expected.dwns)
  })

  it('asks for Green tags on the DWN card without the measure', () => {
    expect(index.greenTags).toBeNull()
    expect(modelAt(WW42, 'toDate').quality[4].subLine).toBe('DWN rate n/a: add Green tags')
  })

  it('shows a 0.0% DWN rate with a Green tags value', () => {
    const model = buildOverviewModel({ ...index, greenTags: 1200 }, viewAt(WW42), 'week')
    expect(model.quality[4].subLine).toBe('0.0% of green tags (to date)')
  })

  it('includes COR 171, NCR 5 and Inspection 1 among the BIM types', () => {
    const types = new Map<string, number>()
    for (const issue of index.bim.issues) types.set(issue.subtype, (types.get(issue.subtype) ?? 0) + 1)
    expect(Object.fromEntries(types)).toEqual({ COR: 171, NCR: 5, Inspection: 1 })
  })

  it('counts 171 included CORs and no DWNs through WW42', () => {
    const last = index.weeks.length - 1
    expect(index.cumulativeCors[last]).toBe(171)
    expect(index.cumulativeDwns[last]).toBe(0)
  })

  describe('chart spot checks', () => {
    const model = buildOverviewModel(index, viewAt(WW42, 'all'), 'week')
    const SPOT_CHECKS = [
      { label: "WW19'2026", activity: [6, 1, 0, 3], inspection: [100, 0, 6], welding: [94.34, 3, 53] },
      { label: "WW22'2026", activity: [6, 0, 1, 0], inspection: [85.71, 1, 7], welding: [100, 0, 29] },
      { label: "WW23'2026", activity: [5, 0, 2, 3], inspection: [85.71, 1, 7], welding: [97.67, 2, 86] },
      { label: "WW42'2026", activity: [3, 3, 0, 0], inspection: [100, 0, 3], welding: [null, 0, 0] },
    ] as const

    it.each(SPOT_CHECKS)('$label', (check) => {
      const activity = model.activity.find((point) => point.week.label === check.label)
      const rates = model.rates.find((point) => point.week.label === check.label)
      if (activity === undefined || rates === undefined) throw new Error(`${check.label} missing from the chart series`)
      expect([activity.electricalFinals, activity.electricalSors, activity.mechanicalFinals, activity.mechanicalSors]).toEqual(check.activity)
      const [inspectionRate, inspectionNcrs, finals] = check.inspection
      expect(rates.inspection.rate).toBeCloseTo(inspectionRate, 2)
      expect([rates.inspection.ncrs, rates.inspection.total]).toEqual([inspectionNcrs, finals])
      const [weldingRate, weldNcrs, welds] = check.welding
      if (weldingRate === null) expect(rates.welding.rate).toBeNull()
      else expect(rates.welding.rate).toBeCloseTo(weldingRate, 2)
      expect([rates.welding.ncrs, rates.welding.total]).toEqual([weldNcrs, welds])
    })

    it('includes the spot-check weeks in the 30 WW window ending at WW42', () => {
      const recent = buildOverviewModel(index, viewAt(WW42), 'week')
      expect(recent.activity[0].week.label).toBe("WW13'2026")
      expect(recent.activity).toHaveLength(30)
    })
  })

  describe.each([
    ["WW42'2026", WW42],
    ["WW41'2026", WW41],
  ] as const)('matches the discipline visuals at %s', (_, key) => {
    const view = viewAt(key)
    const week = modelAt(key, 'week')
    const toDate = modelAt(key, 'toDate')

    it.each([
      ['Electrical', 'electrical', split.electrical],
      ['Mechanical', 'mechanical', split.mechanical],
    ] as const)('matches the %s visual', (_name, row, rows) => {
      const inspections = buildInspectionModel(buildInspectionIndex(rows, inspectionColumnsOf(COLUMNS), TODAY), view)
      expect(cardsOf(week, row).slice(0, 3).map((card) => card.value)).toEqual([
        inspections.thisWeek.finals.value,
        inspections.thisWeek.sors.value,
        inspections.thisWeek.issuesFound.value,
      ])
      expect(cardsOf(toDate, row).slice(0, 2).map((card) => card.value)).toEqual([inspections.toDate.finals, inspections.toDate.sors])
      expect(cardsOf(toDate, row)[3].value).toBe(inspections.toDate.passRate)
    })

    it('matches the Welding visual', () => {
      const welding = buildWeldModel(buildWeldIndex(split.welding, weldColumnsOf(COLUMNS), TODAY), view, null, 10)
      expect(cardsOf(week, 'welding').map((card) => card.value)).toEqual([
        welding.thisWeek.logged.value,
        welding.thisWeek.signedInWeek.value,
        welding.thisWeek.signoff?.rate ?? null,
        welding.thisWeek.issues.value,
      ])
      expect(cardsOf(toDate, 'welding').slice(0, 3).map((card) => card.value)).toEqual([
        welding.toDate.total,
        welding.toDate.signed,
        welding.toDate.overallRate,
      ])
    })

    it('matches the BIM Issues visual', () => {
      const issueIndex = buildIssueIndex(split.bim, issueColumnsOf(COLUMNS), TODAY)
      const issues = buildIssueModel(issueIndex, view)
      expect(cardsOf(week, 'bim').slice(0, 2).map((card) => card.value)).toEqual([issues.thisWeek.opened.value, issues.thisWeek.closed.value])
      expect(cardsOf(toDate, 'bim').map((card) => card.value)).toEqual([
        issues.toDate.opened.value,
        issues.toDate.closed.value,
        issues.toDate.remaining.value,
        buildIssueBenchmarks(issueIndex, view.selectedKey, TODAY).pastWindow,
      ])
    })
  })
})
