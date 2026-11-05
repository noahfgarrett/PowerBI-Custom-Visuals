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
  return { selectedKey: key, windowEndKey: key, range, dateRange: null }
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

// Expected values are pinned to the seeded synthetic fixtures from scripts/generate-qaqc-fixtures.mjs.
const ELECTRICAL: InspectionRowExpectation[] = [
  { finals: [4, -5], sors: [1, 0], ncrs: [0, -1], rate: [100, '4 / 4 Finals', 11.1111] },
  { finals: [238, 4], sors: [48, 1], ncrs: [8, 0], rate: [96.64, '230 / 238 Finals', 0.0575] },
  { finals: [9, 0], sors: [1, 0], ncrs: [1, 1], rate: [88.89, '8 / 9 Finals', -11.1111] },
  { finals: [234, 9], sors: [47, 1], ncrs: [8, 1], rate: [96.58, '226 / 234 Finals', -0.3077] },
]

const MECHANICAL: InspectionRowExpectation[] = [
  { finals: [1, -1], sors: [3, 2], ncrs: [0, 0], rate: [100, '1 / 1 Finals', 0] },
  { finals: [44, 1], sors: [91, 3], ncrs: [4, 0], rate: [90.91, '40 / 44 Finals', 0.2114] },
  { finals: [2, 1], sors: [1, -5], ncrs: [0, 0], rate: [100, '2 / 2 Finals', 0] },
  { finals: [43, 2], sors: [88, 1], ncrs: [4, 0], rate: [90.7, '39 / 43 Finals', 0.4538] },
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
    logged: [65, 1],
    signed: [59, 38],
    signedDisplay: "+38 vs WW41'2026",
    signoff: 32.31,
    signoffSubLine: "21 of 65 · WW42'2026",
    signoffDelta: null,
    ncrs: [1, 0],
  },
  {
    logged: [1751, 65],
    signed: [1105, 59],
    signedDisplay: '+59 signed this WW',
    signoff: 63.11,
    signoffSubLine: '1,105 of 1,751 signed',
    signoffDelta: -1.1874,
    ncrs: [11, 1],
  },
  {
    logged: [64, -3],
    signed: [21, -3],
    signedDisplay: "−3 vs WW40'2026",
    signoff: 32.81,
    signoffSubLine: "21 of 64 · WW41'2026",
    signoffDelta: null,
    ncrs: [1, 1],
  },
  {
    logged: [1686, 64],
    signed: [1084, 21],
    signedDisplay: '+21 signed this WW',
    signoff: 64.29,
    signoffSubLine: '1,084 of 1,686 signed',
    signoffDelta: -1.2422,
    ncrs: [10, 1],
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
    ncrs: [1, -1],
    ncrBreakdown: 'E 0 · M 0 · W 1',
    inspection: [100, '0 NCRs of 5 finals', 9.0909],
    welding: [98.46, '1 NCR of 65 welds', 0.024],
    dwns: [0, 0],
  },
  {
    cors: [171, 0],
    ncrs: [23, 1],
    ncrBreakdown: 'E 8 · M 4 · W 11',
    inspection: [95.74, '12 NCRs of 282 finals', 0.0768],
    welding: [99.37, '11 NCRs of 1,751 welds', -0.0351],
    dwns: [0, 0],
  },
  {
    cors: [0, 0],
    ncrs: [2, 2],
    ncrBreakdown: 'E 1 · M 0 · W 1',
    inspection: [90.91, '1 NCR of 11 finals', -9.0909],
    welding: [98.44, '1 NCR of 64 welds', -1.5625],
    dwns: [0, 0],
  },
  {
    cors: [171, 0],
    ncrs: [22, 2],
    ncrBreakdown: 'E 8 · M 4 · W 10',
    inspection: [95.67, '12 NCRs of 277 finals', -0.1968],
    welding: [99.41, '10 NCRs of 1,686 welds', -0.0382],
    dwns: [0, 0],
  },
]

describe('QAQC Overview on the seeded Combined fixture (today 2026-10-15)', () => {
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

  it.each(['week', 'toDate'] as const)('shows 49 issues past the normal close window as of WW42 (%s)', (mode) => {
    const past = cardsOf(modelAt(WW42, mode), 'bim')[3]
    expect([past.label, past.value, past.display, past.subLine, past.tone])
      .toEqual(['Past normal close window', 49, '49', 'of 51 open · 49 older than any closure · 71.2% closed', 'bad'])
  })

  it('shows Installation as the top root cause through WW42', () => {
    const top = modelAt(WW42, 'toDate').quality[5]
    expect([top.label, top.value, top.display, top.subLine]).toEqual(['Top root cause', 46, 'Installation', '46 of 177 issues · 26%'])
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
      { label: "WW20'2026", activity: [6, 0, 1, 1], inspection: [71.43, 2, 7], welding: [100, 0, 36] },
      { label: "WW26'2026", activity: [7, 0, 1, 1], inspection: [100, 0, 8], welding: [97.87, 1, 47] },
      { label: "WW33'2026", activity: [10, 1, 3, 2], inspection: [84.62, 2, 13], welding: [97.96, 1, 49] },
      { label: "WW42'2026", activity: [4, 1, 1, 3], inspection: [100, 0, 5], welding: [98.46, 1, 65] },
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

    // The fixtures log no inspections over the holiday shutdown, so this week has welds but no inspection rate.
    it("has no inspection rate in WW01'2026, when only welds were logged", () => {
      const activity = model.activity.find((point) => point.week.label === "WW01'2026")
      const rates = model.rates.find((point) => point.week.label === "WW01'2026")
      if (activity === undefined || rates === undefined) throw new Error("WW01'2026 missing from the chart series")
      expect([activity.electricalFinals, activity.electricalSors, activity.mechanicalFinals, activity.mechanicalSors]).toEqual([0, 0, 0, 0])
      expect(rates.inspection.rate).toBeNull()
      expect([rates.inspection.ncrs, rates.inspection.total]).toEqual([0, 0])
      expect(rates.welding.rate).toBeCloseTo(88.89, 2)
      expect([rates.welding.ncrs, rates.welding.total]).toEqual([2, 18])
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
