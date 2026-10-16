import type { CombinedSplit } from './combined'
import type { DeltaTone, Trend } from './format'
import type { CombinedColumns, InspectionIndex, IssueIndex, ViewState, WeldIndex, WorkWeek } from './types'
import { inspectionColumnsOf, issueColumnsOf, weldColumnsOf } from './combined'
import { readGreenTags } from './dataView'
import {
  formatCount,
  formatDelta,
  formatPercent,
  formatPointsDelta,
  formatSignedCount,
  formatSignoffRate,
  pluralize,
  pointsTone,
  pointsTrend,
  trendOf,
} from './format'
import { buildInspectionIndex, recentWindowStart } from './inspections'
import { buildIssueIndex } from './issues'
import { buildWeldIndex, latestSignoff } from './welds'
import { enumerateWorkWeeks, previousWorkWeek } from './workWeeks'

/** The Overview's cards show the selected week (`week`) or the project to date through it (`toDate`). */
export type CardMode = 'week' | 'toDate'

/** Rows the index left out of a source, for the footnotes. */
export interface SourceFootnoteCounts {
  totalRows: number
  /** Unreadable work week, or no Created On for BIM. */
  skippedRows: number
  /** A week after the current week. */
  futureRows: number
  /** BIM rows from a creator other than LotusWorks; always 0 for the other sources. */
  excludedRows: number
}

export interface OverviewFootnoteCounts {
  electrical: SourceFootnoteCounts
  mechanical: SourceFootnoteCounts
  welding: SourceFootnoteCounts
  bim: SourceFootnoteCounts
  /** Rows whose Source is blank or not one of the four sources. */
  unknownSource: number
}

export interface OverviewIndex {
  currentWeek: WorkWeek
  /** Each discipline indexed with its own builder. A source with no rows holds an empty index (one week, all zero). */
  electrical: InspectionIndex
  mechanical: InspectionIndex
  welding: WeldIndex
  bim: IssueIndex
  /** Continuous weeks from the earliest first week of the four indexes through the current week. */
  weeks: WorkWeek[]
  positionByKey: Map<number, number>
  /** The Green tags measure, or null when it is missing, blank, not a number, or not above 0. */
  greenTags: number | null
  /** Parallel to weeks: included, non-void BIM issues typed COR (trimmed, any case) created in each week. */
  corsByWeek: number[]
  cumulativeCors: number[]
  /** Parallel to weeks: included, non-void BIM issues typed DWN (trimmed, any case) created in each week. */
  dwnsByWeek: number[]
  cumulativeDwns: number[]
  footnotes: OverviewFootnoteCounts
}

/** One card, in the shape `KpiCard` draws. */
export interface OverviewCard {
  label: string
  /** A count, or a percent 0–100 for rates; null when a rate has no denominator. */
  value: number | null
  /** The value as the card shows it. */
  display: string
  /** The count change, or the rate change in points; null when the card shows no change or either rate is n/a. */
  delta: number | null
  /** The change line, such as `−3 vs WW41'2026`, `+3 this WW` or `+0.01 pts vs WW41'2026`; null when the card shows none. */
  deltaDisplay: string | null
  trend: Trend
  tone: DeltaTone
  /** A second line with the counts behind the value, such as `3 / 3 Finals`; null when there is none. */
  subLine: string | null
  /** The value misses its target on its own (Sign-off % below 10%). */
  isValueBad: boolean
}

export type OverviewCards = [OverviewCard, OverviewCard, OverviewCard, OverviewCard]

export interface OverviewRow {
  /** False when the source has no rows in QAQC Combined. */
  connected: boolean
  cards: OverviewCards
  /** The row's metric for the 30 weeks ending at the selected week, oldest first. */
  sparkline: number[]
  /** The position of the selected week in `sparkline` (its last point). */
  sparklineSelected: number
  /** The sparkline's change in words for screen readers, such as `up 4 vs WW41'2026`, or the Not connected message. */
  trendText: string
}

export interface OverviewRows {
  electrical: OverviewRow
  mechanical: OverviewRow
  welding: OverviewRow
  bim: OverviewRow
}

export type OverviewQualityCards = [OverviewCard, OverviewCard, OverviewCard, OverviewCard, OverviewCard]

export interface ActivityPoint {
  week: WorkWeek
  electricalFinals: number
  electricalSors: number
  mechanicalFinals: number
  mechanicalSors: number
}

export interface WeekRate {
  /** Percent 0–100, or null when the week has no finals (or welds). */
  rate: number | null
  ncrs: number
  /** Finals for inspections, welds for welding. */
  total: number
}

export interface QualityRatePoint {
  week: WorkWeek
  /** Electrical + Mechanical: 1 − NCRs ÷ finals in the week. */
  inspection: WeekRate
  /** 1 − issue welds ÷ welds in the week. */
  welding: WeekRate
}

export interface OverviewWindowTotals {
  electricalFinals: number
  electricalSors: number
  mechanicalFinals: number
  mechanicalSors: number
  /** Electrical + Mechanical NCRs. */
  inspectionNcrs: number
  welds: number
  weldNcrs: number
  weeks: number
}

export interface OverviewModel {
  selectedWeek: WorkWeek
  previousWeek: WorkWeek
  /** Newest first. */
  weekOptions: WorkWeek[]
  rows: OverviewRows
  /** CORs, NCRs, Inspection NCR pass rate, Welding NCR pass rate, DWNs. */
  quality: OverviewQualityCards
  /** Per window week. */
  activity: ActivityPoint[]
  /** Per window week. */
  rates: QualityRatePoint[]
  windowTotals: OverviewWindowTotals
  /** True when any source has a counted row. */
  hasData: boolean
}

const COR_TYPE = 'cor'
const DWN_TYPE = 'dwn'

function footnoteCounts(index: InspectionIndex | WeldIndex): SourceFootnoteCounts {
  return { totalRows: index.totalRows, skippedRows: index.skippedRows, futureRows: index.futureRows, excludedRows: 0 }
}

/** The Green tags measure repeats on every row, so the first readable value in any source is the total. */
function readSplitGreenTags(split: CombinedSplit, column: number): number | null {
  for (const rows of [split.electrical, split.mechanical, split.welding, split.bim]) {
    const value = readGreenTags(rows, column)
    if (value !== null) return value > 0 ? value : null
  }
  return null
}

function runningTotals(values: number[]): number[] {
  const totals: number[] = []
  let total = 0
  for (const value of values) {
    total += value
    totals.push(total)
  }
  return totals
}

export function buildOverviewIndex(split: CombinedSplit, columns: CombinedColumns, today: Date): OverviewIndex {
  const electrical = buildInspectionIndex(split.electrical, inspectionColumnsOf(columns), today)
  const mechanical = buildInspectionIndex(split.mechanical, inspectionColumnsOf(columns), today)
  const welding = buildWeldIndex(split.welding, weldColumnsOf(columns), today)
  const bim = buildIssueIndex(split.bim, issueColumnsOf(columns), today)
  const currentWeek = electrical.currentWeek

  // Every index runs continuously to the current week, so the union starts at the earliest first week.
  let firstWeek = currentWeek
  for (const first of [electrical.weeks[0].week, mechanical.weeks[0].week, welding.weeks[0].week, bim.weeks[0].week]) {
    if (first.key < firstWeek.key) firstWeek = first
  }
  const weeks = enumerateWorkWeeks(firstWeek, currentWeek)
  const positionByKey = new Map<number, number>()
  weeks.forEach((week, position) => positionByKey.set(week.key, position))

  const corsByWeek: number[] = new Array<number>(weeks.length).fill(0)
  const dwnsByWeek: number[] = new Array<number>(weeks.length).fill(0)
  // The BIM index holds only included, non-void issues created through the current week; its subtype is Type, trimmed.
  for (const issue of bim.issues) {
    const type = issue.subtype.toLowerCase()
    if (type !== COR_TYPE && type !== DWN_TYPE) continue
    const position = positionByKey.get(issue.createdWeek.key)
    if (position === undefined) continue
    if (type === COR_TYPE) corsByWeek[position] += 1
    else dwnsByWeek[position] += 1
  }

  return {
    currentWeek,
    electrical,
    mechanical,
    welding,
    bim,
    weeks,
    positionByKey,
    greenTags: readSplitGreenTags(split, columns.greenTags),
    corsByWeek,
    cumulativeCors: runningTotals(corsByWeek),
    dwnsByWeek,
    cumulativeDwns: runningTotals(dwnsByWeek),
    footnotes: {
      electrical: footnoteCounts(electrical),
      mechanical: footnoteCounts(mechanical),
      welding: footnoteCounts(welding),
      bim: { totalRows: bim.totalRows, skippedRows: bim.skippedRows, futureRows: bim.futureRows, excludedRows: bim.excludedRows },
      unknownSource: split.unknownSource,
    },
  }
}

/** A count in the selected week and the week before, and through each of them. */
interface CountSeries {
  week: number
  previousWeek: number
  toDate: number
  previousToDate: number
}

type CountTone = (value: number, previous: number, mode: CardMode) => DeltaTone

const CHANGE_NA = 'Change n/a'
const NO_WELDS_YET = 'No welds logged yet'
const NO_ISSUES_YET = 'No issues opened yet'
const GREEN_TAGS_MISSING = 'DWN rate n/a: add Green tags'
const SIGNOFF_BAD_BELOW_PERCENT = 10

const neutralTone: CountTone = () => 'neutral'
const amberWhenUp: CountTone = (value, previous) => (value > previous ? 'warn' : 'neutral')
/**
 * This WW: green when at least as many closed as the week before, but a week with nothing closed is never green.
 * To date the total never falls, so it is green when it rose, as in the BIM Issues visual.
 */
const closedTone: CountTone = (value, previous, mode) => {
  if (mode === 'toDate') return value > previous ? 'good' : 'neutral'
  return value > 0 && value >= previous ? 'good' : 'neutral'
}

function riseIsBad(delta: number): DeltaTone {
  if (delta > 0) return 'bad'
  if (delta < 0) return 'good'
  return 'neutral'
}

/** The position of a week in a discipline index, or −1 when the week is before that discipline's first week. */
function positionIn(index: { positionByKey: ReadonlyMap<number, number> }, key: number): number {
  return index.positionByKey.get(key) ?? -1
}

/** A discipline's week at a position from `positionIn`, or null before its first week. */
function weekAt<T>(weeks: readonly T[], position: number): T | null {
  return position < 0 ? null : weeks[position]
}

function valueAt(values: readonly number[], position: number): number {
  return position < 0 ? 0 : values[position]
}

function thisWeekChange(delta: number, noun = 'this WW'): string {
  return `${delta === 0 ? '+0' : formatSignedCount(delta)} ${noun}`
}

function countCard(label: string, counts: CountSeries, mode: CardMode, previousLabel: string, toneOf: CountTone): OverviewCard {
  if (mode === 'week') {
    const delta = counts.week - counts.previousWeek
    return {
      label,
      value: counts.week,
      display: formatCount(counts.week),
      delta,
      deltaDisplay: formatDelta(delta, previousLabel),
      trend: trendOf(delta),
      tone: toneOf(counts.week, counts.previousWeek, mode),
      subLine: null,
      isValueBad: false,
    }
  }
  const delta = counts.toDate - counts.previousToDate
  return {
    label,
    value: counts.toDate,
    display: formatCount(counts.toDate),
    delta,
    deltaDisplay: thisWeekChange(delta),
    trend: 'none',
    tone: toneOf(counts.toDate, counts.previousToDate, mode),
    subLine: null,
    isValueBad: false,
  }
}

function rateCard(label: string, rate: number | null, previousRate: number | null, subLine: string, previousLabel: string): OverviewCard {
  const delta = rate !== null && previousRate !== null ? rate - previousRate : null
  return {
    label,
    value: rate,
    display: formatPercent(rate),
    delta,
    deltaDisplay: delta === null ? CHANGE_NA : `${formatPointsDelta(delta)} vs ${previousLabel}`,
    trend: pointsTrend(delta),
    tone: pointsTone(delta),
    subLine,
    isValueBad: false,
  }
}

/** Percent of the total without an NCR, or null when the total is 0. */
function passRate(ncrs: number, total: number): number | null {
  return total === 0 ? null : ((total - ncrs) / total) * 100
}

function modeValue(counts: CountSeries, mode: CardMode): number {
  return mode === 'week' ? counts.week : counts.toDate
}

function sumSeries(series: CountSeries[]): CountSeries {
  const total: CountSeries = { week: 0, previousWeek: 0, toDate: 0, previousToDate: 0 }
  for (const item of series) {
    total.week += item.week
    total.previousWeek += item.previousWeek
    total.toDate += item.toDate
    total.previousToDate += item.previousToDate
  }
  return total
}

/** A count from a discipline's weekly values and running totals, at the selected week and the week before. */
function seriesAt(weekly: (position: number) => number, cumulative: readonly number[], position: number, previousPosition: number): CountSeries {
  return {
    week: position < 0 ? 0 : weekly(position),
    previousWeek: previousPosition < 0 ? 0 : weekly(previousPosition),
    toDate: valueAt(cumulative, position),
    previousToDate: valueAt(cumulative, previousPosition),
  }
}

interface InspectionCounts {
  finals: CountSeries
  sors: CountSeries
  ncrs: CountSeries
}

function inspectionCounts(index: InspectionIndex, key: number, previousKey: number): InspectionCounts {
  const position = positionIn(index, key)
  const previousPosition = positionIn(index, previousKey)
  return {
    finals: seriesAt((at) => index.weeks[at].finals, index.cumulativeFinals, position, previousPosition),
    sors: seriesAt((at) => index.weeks[at].sors, index.cumulativeSors, position, previousPosition),
    ncrs: seriesAt((at) => index.weeks[at].issuesFound, index.cumulativeIssues, position, previousPosition),
  }
}

/** The pass rate and its counts in the selected week (This WW) or through it (To date), and for the week before. */
function passRateCard(label: string, ncrs: CountSeries, totals: CountSeries, mode: CardMode, previousLabel: string, subLineOf: (ncrs: number, total: number) => string): OverviewCard {
  const isWeek = mode === 'week'
  const ncrCount = isWeek ? ncrs.week : ncrs.toDate
  const total = isWeek ? totals.week : totals.toDate
  const rate = passRate(ncrCount, total)
  const previousRate = isWeek ? passRate(ncrs.previousWeek, totals.previousWeek) : passRate(ncrs.previousToDate, totals.previousToDate)
  return rateCard(label, rate, previousRate, subLineOf(ncrCount, total), previousLabel)
}

function cleanFinalsLine(ncrs: number, finals: number): string {
  return finals === 0 ? '0 Finals' : `${formatCount(finals - ncrs)} / ${formatCount(finals)} Finals`
}

function ncrsOfLine(unit: string, units: string): (ncrs: number, total: number) => string {
  return (ncrs, total) =>
    total === 0
      ? `0 ${units}`
      : `${formatCount(ncrs)} ${pluralize(ncrs, 'NCR', 'NCRs')} of ${formatCount(total)} ${pluralize(total, unit, units)}`
}

function notConnectedText(name: string): string {
  return `Not connected: no ${name} rows in QAQC Combined`
}

function trendWords(delta: number, previousLabel: string): string {
  if (delta > 0) return `up ${formatCount(delta)} vs ${previousLabel}`
  if (delta < 0) return `down ${formatCount(-delta)} vs ${previousLabel}`
  return `no change vs ${previousLabel}`
}

interface RowContext {
  index: OverviewIndex
  /** Union positions of the sparkline's first week and the selected week. */
  sparkStart: number
  selectedPosition: number
  previousLabel: string
}

function buildRow(context: RowContext, name: string, connected: boolean, cards: OverviewCards, metricAt: (key: number) => number): OverviewRow {
  const { index, sparkStart, selectedPosition, previousLabel } = context
  const sparkline: number[] = []
  for (let position = sparkStart; position <= selectedPosition; position += 1) sparkline.push(metricAt(index.weeks[position].key))
  const previous = selectedPosition > 0 ? metricAt(index.weeks[selectedPosition - 1].key) : 0
  return {
    connected,
    cards,
    sparkline,
    sparklineSelected: sparkline.length - 1,
    trendText: connected ? trendWords(sparkline[sparkline.length - 1] - previous, previousLabel) : notConnectedText(name),
  }
}

function inspectionRow(context: RowContext, name: string, index: InspectionIndex, counts: InspectionCounts, mode: CardMode): OverviewRow {
  const { previousLabel } = context
  const cards: OverviewCards = [
    countCard('Finals', counts.finals, mode, previousLabel, neutralTone),
    countCard('SORs', counts.sors, mode, previousLabel, neutralTone),
    countCard('NCRs', counts.ncrs, mode, previousLabel, amberWhenUp),
    passRateCard('NCR pass rate', counts.ncrs, counts.finals, mode, previousLabel, cleanFinalsLine),
  ]
  return buildRow(context, name, index.totalRows > 0, cards, (key) => {
    const position = positionIn(index, key)
    return position < 0 ? 0 : index.weeks[position].finals + index.weeks[position].sors
  })
}

function signoffCard(index: WeldIndex, position: number, previousPosition: number, mode: CardMode, previousLabel: string): OverviewCard {
  if (mode === 'week') {
    const signoff = latestSignoff(index, position)
    const rate = signoff?.rate ?? null
    return {
      label: 'Sign-off %',
      value: rate,
      display: formatSignoffRate(rate),
      delta: null,
      deltaDisplay: null,
      trend: 'none',
      tone: 'neutral',
      subLine: signoff === null ? NO_WELDS_YET : `${formatCount(signoff.signed)} of ${formatCount(signoff.total)} · ${signoff.week.label}`,
      isValueBad: rate !== null && rate < SIGNOFF_BAD_BELOW_PERCENT,
    }
  }
  const logged = valueAt(index.cumulativeLogged, position)
  const signed = valueAt(index.cumulativeSigned, position)
  const previousLogged = valueAt(index.cumulativeLogged, previousPosition)
  const rate = logged === 0 ? null : (signed / logged) * 100
  const previousRate = previousLogged === 0 ? null : (valueAt(index.cumulativeSigned, previousPosition) / previousLogged) * 100
  const subLine = logged === 0 ? NO_WELDS_YET : `${formatCount(signed)} of ${formatCount(logged)} signed`
  return { ...rateCard('Sign-off %', rate, previousRate, subLine, previousLabel), isValueBad: rate !== null && rate < SIGNOFF_BAD_BELOW_PERCENT }
}

function signedCard(index: WeldIndex, position: number, previousPosition: number, mode: CardMode, previousLabel: string): OverviewCard {
  const signedInWeek = (at: number): number => (at < 0 ? 0 : index.weeks[at].signedInWeek)
  const thisWeek = signedInWeek(position)
  if (mode === 'week') {
    const counts: CountSeries = { week: thisWeek, previousWeek: signedInWeek(previousPosition), toDate: 0, previousToDate: 0 }
    return countCard('Signed', counts, mode, previousLabel, neutralTone)
  }
  // Signed to date counts by weld week, as the Welding visual does; the change is the welds signed in the week.
  const signed = valueAt(index.cumulativeSigned, position)
  return {
    label: 'Signed',
    value: signed,
    display: formatCount(signed),
    delta: thisWeek,
    deltaDisplay: thisWeekChange(thisWeek, 'signed this WW'),
    trend: 'none',
    tone: 'neutral',
    subLine: null,
    isValueBad: false,
  }
}

function remainingCard(opened: CountSeries, closed: CountSeries, previousLabel: string): OverviewCard {
  const remaining = opened.toDate - closed.toDate
  const delta = remaining - (opened.previousToDate - closed.previousToDate)
  return {
    label: 'Remaining open',
    value: remaining,
    display: formatCount(remaining),
    delta,
    deltaDisplay: formatDelta(delta, previousLabel),
    trend: trendOf(delta),
    tone: riseIsBad(delta),
    subLine: null,
    isValueBad: false,
  }
}

function closureRateCard(opened: CountSeries, closed: CountSeries, previousLabel: string): OverviewCard {
  const rate = opened.toDate === 0 ? null : (closed.toDate / opened.toDate) * 100
  const previousRate = opened.previousToDate === 0 ? null : (closed.previousToDate / opened.previousToDate) * 100
  const subLine = opened.toDate === 0 ? NO_ISSUES_YET : `${formatCount(closed.toDate)} of ${formatCount(opened.toDate)} closed`
  return rateCard('Closure rate', rate, previousRate, subLine, previousLabel)
}

function dwnRateLine(dwnsToDate: number, greenTags: number | null): string {
  if (greenTags === null || greenTags <= 0) return GREEN_TAGS_MISSING
  return `${formatPercent((dwnsToDate / greenTags) * 100)} of green tags (to date)`
}

export function buildOverviewModel(index: OverviewIndex, view: ViewState, mode: CardMode): OverviewModel {
  const lastPosition = index.weeks.length - 1
  const selectedPosition = index.positionByKey.get(view.selectedKey) ?? lastPosition
  const endPosition = index.positionByKey.get(view.windowEndKey) ?? lastPosition
  const startPosition = view.range === 'all' ? 0 : recentWindowStart(endPosition)
  const selectedWeek = index.weeks[selectedPosition]
  const previousWeek = previousWorkWeek(selectedWeek)
  const previousLabel = previousWeek.label
  const key = selectedWeek.key
  const previousKey = previousWeek.key
  const context: RowContext = { index, sparkStart: recentWindowStart(selectedPosition), selectedPosition, previousLabel }
  const { electrical, mechanical, welding, bim } = index

  const electricalCounts = inspectionCounts(electrical, key, previousKey)
  const mechanicalCounts = inspectionCounts(mechanical, key, previousKey)

  const weldPosition = positionIn(welding, key)
  const weldPreviousPosition = positionIn(welding, previousKey)
  const welds = seriesAt((at) => welding.weeks[at].logged, welding.cumulativeLogged, weldPosition, weldPreviousPosition)
  const weldNcrs = seriesAt((at) => welding.weeks[at].issues, welding.cumulativeIssues, weldPosition, weldPreviousPosition)
  const weldingRow = buildRow(
    context,
    'Welding',
    welding.totalRows > 0,
    [
      countCard('Welds logged', welds, mode, previousLabel, neutralTone),
      signedCard(welding, weldPosition, weldPreviousPosition, mode, previousLabel),
      signoffCard(welding, weldPosition, weldPreviousPosition, mode, previousLabel),
      countCard('NCRs', weldNcrs, mode, previousLabel, amberWhenUp),
    ],
    (weekKey) => {
      const position = positionIn(welding, weekKey)
      return position < 0 ? 0 : welding.weeks[position].logged
    },
  )

  const bimPosition = positionIn(bim, key)
  const bimPreviousPosition = positionIn(bim, previousKey)
  const opened = seriesAt((at) => bim.weeks[at].opened, bim.cumulativeOpened, bimPosition, bimPreviousPosition)
  const closed = seriesAt((at) => bim.weeks[at].closed, bim.cumulativeClosed, bimPosition, bimPreviousPosition)
  const bimRow = buildRow(
    context,
    'BIM Issues',
    bim.totalRows > 0,
    [
      countCard('Opened', opened, mode, previousLabel, amberWhenUp),
      countCard('Closed', closed, mode, previousLabel, closedTone),
      remainingCard(opened, closed, previousLabel),
      closureRateCard(opened, closed, previousLabel),
    ],
    (weekKey) => {
      const position = positionIn(bim, weekKey)
      return position < 0 ? 0 : bim.cumulativeOpened[position] - bim.cumulativeClosed[position]
    },
  )

  const cors = seriesAt((at) => index.corsByWeek[at], index.cumulativeCors, selectedPosition, selectedPosition - 1)
  const dwns = seriesAt((at) => index.dwnsByWeek[at], index.cumulativeDwns, selectedPosition, selectedPosition - 1)
  const ncrs = sumSeries([electricalCounts.ncrs, mechanicalCounts.ncrs, weldNcrs])
  const inspectionNcrs = sumSeries([electricalCounts.ncrs, mechanicalCounts.ncrs])
  const inspectionFinals = sumSeries([electricalCounts.finals, mechanicalCounts.finals])
  const breakdown = `E ${formatCount(modeValue(electricalCounts.ncrs, mode))} · M ${formatCount(modeValue(mechanicalCounts.ncrs, mode))} · W ${formatCount(modeValue(weldNcrs, mode))}`
  const quality: OverviewQualityCards = [
    countCard('CORs', cors, mode, previousLabel, amberWhenUp),
    { ...countCard('NCRs', ncrs, mode, previousLabel, amberWhenUp), subLine: breakdown },
    passRateCard('Inspection NCR pass rate', inspectionNcrs, inspectionFinals, mode, previousLabel, ncrsOfLine('final', 'finals')),
    passRateCard('Welding NCR pass rate', weldNcrs, welds, mode, previousLabel, ncrsOfLine('weld', 'welds')),
    { ...countCard('DWNs', dwns, mode, previousLabel, neutralTone), subLine: dwnRateLine(dwns.toDate, index.greenTags) },
  ]

  const activity: ActivityPoint[] = []
  const rates: QualityRatePoint[] = []
  const windowTotals: OverviewWindowTotals = {
    electricalFinals: 0,
    electricalSors: 0,
    mechanicalFinals: 0,
    mechanicalSors: 0,
    inspectionNcrs: 0,
    welds: 0,
    weldNcrs: 0,
    weeks: endPosition - startPosition + 1,
  }
  for (let position = startPosition; position <= endPosition; position += 1) {
    const week = index.weeks[position]
    const electricalWeek = weekAt(electrical.weeks, positionIn(electrical, week.key))
    const mechanicalWeek = weekAt(mechanical.weeks, positionIn(mechanical, week.key))
    const weldWeek = weekAt(welding.weeks, positionIn(welding, week.key))
    const point: ActivityPoint = {
      week,
      electricalFinals: electricalWeek?.finals ?? 0,
      electricalSors: electricalWeek?.sors ?? 0,
      mechanicalFinals: mechanicalWeek?.finals ?? 0,
      mechanicalSors: mechanicalWeek?.sors ?? 0,
    }
    const finals = point.electricalFinals + point.mechanicalFinals
    const finalNcrs = (electricalWeek?.issuesFound ?? 0) + (mechanicalWeek?.issuesFound ?? 0)
    const logged = weldWeek?.logged ?? 0
    const issues = weldWeek?.issues ?? 0
    activity.push(point)
    rates.push({
      week,
      inspection: { rate: passRate(finalNcrs, finals), ncrs: finalNcrs, total: finals },
      welding: { rate: passRate(issues, logged), ncrs: issues, total: logged },
    })
    windowTotals.electricalFinals += point.electricalFinals
    windowTotals.electricalSors += point.electricalSors
    windowTotals.mechanicalFinals += point.mechanicalFinals
    windowTotals.mechanicalSors += point.mechanicalSors
    windowTotals.inspectionNcrs += finalNcrs
    windowTotals.welds += logged
    windowTotals.weldNcrs += issues
  }

  const inspectionLast = (inspections: InspectionIndex): number => {
    const last = inspections.weeks.length - 1
    return inspections.cumulativeFinals[last] + inspections.cumulativeSors[last]
  }
  const hasData =
    inspectionLast(electrical) > 0 ||
    inspectionLast(mechanical) > 0 ||
    welding.cumulativeLogged[welding.weeks.length - 1] > 0 ||
    bim.cumulativeOpened[bim.weeks.length - 1] > 0

  return {
    selectedWeek,
    previousWeek,
    weekOptions: [...index.weeks].reverse(),
    rows: {
      electrical: inspectionRow(context, 'Electrical', electrical, electricalCounts, mode),
      mechanical: inspectionRow(context, 'Mechanical', mechanical, mechanicalCounts, mode),
      welding: weldingRow,
      bim: bimRow,
    },
    quality,
    activity,
    rates,
    windowTotals,
    hasData,
  }
}
