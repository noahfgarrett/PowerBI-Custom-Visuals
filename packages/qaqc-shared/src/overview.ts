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
  SIGNOFF_BAD_BELOW,
  trendOf,
} from './format'
import { buildInspectionIndex, passRateAt, recentWindowStart } from './inspections'
import { buildIssueIndex, closureRateAt, riseIsBad } from './issues'
import { buildWeldIndex, latestSignoff, overallRateAt } from './welds'
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

/** One card. `KpiCard` takes a single `detail`, so the dashboard joins `subLine` and `deltaDisplay` into it. */
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

export interface ConnectedOverviewRow {
  connected: true
  cards: OverviewCards
  /** The row's metric for the 30 weeks ending at the selected week, oldest first. */
  sparkline: number[]
  /** The position of the selected week in `sparkline` (its last point). */
  sparklineSelected: number
  /** The sparkline's change in words for screen readers, such as `up 4 vs WW41'2026`. */
  trendText: string
}

/** A source with no rows in QCx Combined. */
export interface DisconnectedOverviewRow {
  connected: false
  /** Such as `Not connected: no Electrical rows in QCx Combined`. */
  message: string
}

export type OverviewRow = ConnectedOverviewRow | DisconnectedOverviewRow

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

/** Everything that depends on the card mode: the selected week, the rows and the quality strip. */
export interface OverviewCardsModel {
  selectedWeek: WorkWeek
  previousWeek: WorkWeek
  /** Newest first. */
  weekOptions: WorkWeek[]
  rows: OverviewRows
  /** CORs, NCRs, Inspection NCR pass rate, Welding NCR pass rate, DWNs. */
  quality: OverviewQualityCards
  /** True when any source has a counted row. */
  hasData: boolean
}

/** The chart series, which depend on the view but not on the card mode. */
export interface OverviewSeries {
  /** Per window week. */
  activity: ActivityPoint[]
  /** Per window week. */
  rates: QualityRatePoint[]
  windowTotals: OverviewWindowTotals
}

export interface OverviewModel extends OverviewCardsModel, OverviewSeries {}

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

const neutralTone: CountTone = () => 'neutral'
const amberWhenUp: CountTone = (value, previous) => (value > previous ? 'warn' : 'neutral')
/** This WW: amber when up. To date: red when up, as Total Opened is in the BIM Issues visual. */
const openedTone: CountTone = (value, previous, mode) => (mode === 'toDate' ? riseIsBad(value - previous) : amberWhenUp(value, previous, mode))
/**
 * This WW: green when at least as many closed as the week before, but a week with nothing closed is never green.
 * To date: green when the total rose, as in the BIM Issues visual.
 */
const closedTone: CountTone = (value, previous, mode) => {
  if (mode === 'toDate') return value > previous ? 'good' : 'neutral'
  return value > 0 && value >= previous ? 'good' : 'neutral'
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

/** A count in the selected week with its change against the week before. */
function weekCountCard(label: string, value: number, previous: number, previousLabel: string, tone: DeltaTone): OverviewCard {
  const delta = value - previous
  return {
    label,
    value,
    display: formatCount(value),
    delta,
    deltaDisplay: formatDelta(delta, previousLabel),
    trend: trendOf(delta),
    tone,
    subLine: null,
    isValueBad: false,
  }
}

function countCard(label: string, counts: CountSeries, mode: CardMode, previousLabel: string, toneOf: CountTone): OverviewCard {
  if (mode === 'week') {
    return weekCountCard(label, counts.week, counts.previousWeek, previousLabel, toneOf(counts.week, counts.previousWeek, mode))
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

/**
 * Percent of the total without an NCR, or null when the total is 0. For the rates no discipline model has: a single
 * week's, Electrical and Mechanical together, and issue welds. The disciplines' own to-date rates use their helpers.
 */
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

/** A discipline's positions for the selected week and the week before; −1 before its first week. */
interface Positions {
  position: number
  previousPosition: number
}

function positionsIn(index: { positionByKey: ReadonlyMap<number, number> }, key: number, previousKey: number): Positions {
  return { position: positionIn(index, key), previousPosition: positionIn(index, previousKey) }
}

interface InspectionCounts extends Positions {
  finals: CountSeries
  sors: CountSeries
  ncrs: CountSeries
}

function inspectionCounts(index: InspectionIndex, key: number, previousKey: number): InspectionCounts {
  const { position, previousPosition } = positionsIn(index, key, previousKey)
  return {
    position,
    previousPosition,
    finals: seriesAt((at) => index.weeks[at].finals, index.cumulativeFinals, position, previousPosition),
    sors: seriesAt((at) => index.weeks[at].sors, index.cumulativeSors, position, previousPosition),
    ncrs: seriesAt((at) => index.weeks[at].issuesFound, index.cumulativeIssues, position, previousPosition),
  }
}

interface WeldCounts extends Positions {
  welds: CountSeries
  ncrs: CountSeries
}

function weldCounts(index: WeldIndex, key: number, previousKey: number): WeldCounts {
  const { position, previousPosition } = positionsIn(index, key, previousKey)
  return {
    position,
    previousPosition,
    welds: seriesAt((at) => index.weeks[at].logged, index.cumulativeLogged, position, previousPosition),
    ncrs: seriesAt((at) => index.weeks[at].issues, index.cumulativeIssues, position, previousPosition),
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

/** A discipline's NCR pass rate: W's finals only in This WW, the Inspection visual's own rate in To date. */
function inspectionPassRateCard(index: InspectionIndex, counts: InspectionCounts, mode: CardMode, previousLabel: string): OverviewCard {
  if (mode === 'week') return passRateCard('NCR pass rate', counts.ncrs, counts.finals, mode, previousLabel, cleanFinalsLine)
  const subLine = cleanFinalsLine(counts.ncrs.toDate, counts.finals.toDate)
  return rateCard('NCR pass rate', passRateAt(index, counts.position), passRateAt(index, counts.previousPosition), subLine, previousLabel)
}

function ncrsOfLine(unit: string, units: string): (ncrs: number, total: number) => string {
  return (ncrs, total) =>
    total === 0
      ? `0 ${units}`
      : `${formatCount(ncrs)} ${pluralize(ncrs, 'NCR', 'NCRs')} of ${formatCount(total)} ${pluralize(total, unit, units)}`
}

function trendWords(delta: number, previousLabel: string): string {
  if (delta > 0) return `up ${formatCount(delta)} vs ${previousLabel}`
  if (delta < 0) return `down ${formatCount(-delta)} vs ${previousLabel}`
  return `no change vs ${previousLabel}`
}

interface RowContext {
  index: OverviewIndex
  mode: CardMode
  /** Union positions of the sparkline's first week and the selected week. */
  sparkStart: number
  selectedPosition: number
  previousLabel: string
}

function disconnectedRow(name: string): DisconnectedOverviewRow {
  return { connected: false, message: `Not connected: no ${name} rows in QCx Combined` }
}

function connectedRow(context: RowContext, cards: OverviewCards, metricAt: (key: number) => number): ConnectedOverviewRow {
  const { index, sparkStart, selectedPosition, previousLabel } = context
  const sparkline: number[] = []
  for (let position = sparkStart; position <= selectedPosition; position += 1) sparkline.push(metricAt(index.weeks[position].key))
  const previous = selectedPosition > 0 ? metricAt(index.weeks[selectedPosition - 1].key) : 0
  return {
    connected: true,
    cards,
    sparkline,
    sparklineSelected: sparkline.length - 1,
    trendText: trendWords(sparkline[sparkline.length - 1] - previous, previousLabel),
  }
}

function inspectionRow(context: RowContext, name: string, index: InspectionIndex, counts: InspectionCounts): OverviewRow {
  if (index.totalRows === 0) return disconnectedRow(name)
  const { mode, previousLabel } = context
  const cards: OverviewCards = [
    countCard('Finals', counts.finals, mode, previousLabel, neutralTone),
    countCard('SORs', counts.sors, mode, previousLabel, neutralTone),
    countCard('NCRs', counts.ncrs, mode, previousLabel, amberWhenUp),
    inspectionPassRateCard(index, counts, mode, previousLabel),
  ]
  return connectedRow(context, cards, (key) => {
    const week = weekAt(index.weeks, positionIn(index, key))
    return week === null ? 0 : week.finals + week.sors
  })
}

function isBelowSignoffBaseline(rate: number | null): boolean {
  return rate !== null && rate < SIGNOFF_BAD_BELOW
}

function signoffCard(index: WeldIndex, counts: WeldCounts, mode: CardMode, previousLabel: string): OverviewCard {
  if (mode === 'week') {
    const signoff = latestSignoff(index, counts.position)
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
      isValueBad: isBelowSignoffBaseline(rate),
    }
  }
  const rate = overallRateAt(index, counts.position)
  const logged = counts.welds.toDate
  const subLine = logged === 0 ? NO_WELDS_YET : `${formatCount(valueAt(index.cumulativeSigned, counts.position))} of ${formatCount(logged)} signed`
  const card = rateCard('Sign-off %', rate, overallRateAt(index, counts.previousPosition), subLine, previousLabel)
  return { ...card, isValueBad: isBelowSignoffBaseline(rate) }
}

function signedCard(index: WeldIndex, counts: WeldCounts, mode: CardMode, previousLabel: string): OverviewCard {
  const signedInWeek = (position: number): number => weekAt(index.weeks, position)?.signedInWeek ?? 0
  const thisWeek = signedInWeek(counts.position)
  if (mode === 'week') return weekCountCard('Signed', thisWeek, signedInWeek(counts.previousPosition), previousLabel, 'neutral')
  // Signed to date counts by weld week, as the Welding visual does; the change is the welds signed in the week.
  const signed = valueAt(index.cumulativeSigned, counts.position)
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

function weldingRow(context: RowContext, index: WeldIndex, counts: WeldCounts): OverviewRow {
  if (index.totalRows === 0) return disconnectedRow('Welding')
  const { mode, previousLabel } = context
  const cards: OverviewCards = [
    countCard('Welds logged', counts.welds, mode, previousLabel, neutralTone),
    signedCard(index, counts, mode, previousLabel),
    signoffCard(index, counts, mode, previousLabel),
    countCard('NCRs', counts.ncrs, mode, previousLabel, amberWhenUp),
  ]
  return connectedRow(context, cards, (key) => weekAt(index.weeks, positionIn(index, key))?.logged ?? 0)
}

/** Remaining open is always to date, with its change against the week before. */
function remainingCard(opened: CountSeries, closed: CountSeries, previousLabel: string): OverviewCard {
  const remaining = opened.toDate - closed.toDate
  const previous = opened.previousToDate - closed.previousToDate
  return weekCountCard('Remaining open', remaining, previous, previousLabel, riseIsBad(remaining - previous))
}

/** The Closure rate is always to date. */
function closureRateCard(index: IssueIndex, positions: Positions, opened: CountSeries, closed: CountSeries, previousLabel: string): OverviewCard {
  const subLine = opened.toDate === 0 ? NO_ISSUES_YET : `${formatCount(closed.toDate)} of ${formatCount(opened.toDate)} closed`
  return rateCard('Closure rate', closureRateAt(index, positions.position), closureRateAt(index, positions.previousPosition), subLine, previousLabel)
}

function bimRow(context: RowContext, index: IssueIndex, key: number, previousKey: number): OverviewRow {
  if (index.totalRows === 0) return disconnectedRow('BIM Issues')
  const { mode, previousLabel } = context
  const positions = positionsIn(index, key, previousKey)
  const opened = seriesAt((at) => index.weeks[at].opened, index.cumulativeOpened, positions.position, positions.previousPosition)
  const closed = seriesAt((at) => index.weeks[at].closed, index.cumulativeClosed, positions.position, positions.previousPosition)
  const cards: OverviewCards = [
    countCard('Opened', opened, mode, previousLabel, openedTone),
    countCard('Closed', closed, mode, previousLabel, closedTone),
    remainingCard(opened, closed, previousLabel),
    closureRateCard(index, positions, opened, closed, previousLabel),
  ]
  return connectedRow(context, cards, (weekKey) => {
    const position = positionIn(index, weekKey)
    return valueAt(index.cumulativeOpened, position) - valueAt(index.cumulativeClosed, position)
  })
}

/** The DWN rate is always to date. The index already treats a Green tags value of 0 or below as missing. */
function dwnRateLine(dwnsToDate: number, greenTags: number | null): string {
  if (greenTags === null) return GREEN_TAGS_MISSING
  return `${formatPercent((dwnsToDate / greenTags) * 100)} of green tags (to date)`
}

function qualityCards(context: RowContext, electrical: InspectionCounts, mechanical: InspectionCounts, welds: WeldCounts): OverviewQualityCards {
  const { index, mode, selectedPosition, previousLabel } = context
  const cors = seriesAt((at) => index.corsByWeek[at], index.cumulativeCors, selectedPosition, selectedPosition - 1)
  const dwns = seriesAt((at) => index.dwnsByWeek[at], index.cumulativeDwns, selectedPosition, selectedPosition - 1)
  const inspectionNcrs = sumSeries([electrical.ncrs, mechanical.ncrs])
  const breakdown = `E ${formatCount(modeValue(electrical.ncrs, mode))} · M ${formatCount(modeValue(mechanical.ncrs, mode))} · W ${formatCount(modeValue(welds.ncrs, mode))}`
  return [
    countCard('CORs', cors, mode, previousLabel, amberWhenUp),
    { ...countCard('NCRs', sumSeries([inspectionNcrs, welds.ncrs]), mode, previousLabel, amberWhenUp), subLine: breakdown },
    passRateCard('Inspection NCR pass rate', inspectionNcrs, sumSeries([electrical.finals, mechanical.finals]), mode, previousLabel, ncrsOfLine('final', 'finals')),
    passRateCard('Welding NCR pass rate', welds.ncrs, welds.welds, mode, previousLabel, ncrsOfLine('weld', 'welds')),
    { ...countCard('DWNs', dwns, mode, previousLabel, neutralTone), subLine: dwnRateLine(dwns.toDate, index.greenTags) },
  ]
}

/** The chart series and totals for the union weeks from `start` through `end`. */
function windowSeries(index: OverviewIndex, start: number, end: number): OverviewSeries {
  const { electrical, mechanical, welding } = index
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
    weeks: end - start + 1,
  }
  for (let position = start; position <= end; position += 1) {
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
  return { activity, rates, windowTotals }
}

function hasCountedRows(index: OverviewIndex): boolean {
  const { electrical, mechanical, welding, bim } = index
  const inspectionsAtEnd = (inspections: InspectionIndex): number => {
    const last = inspections.weeks.length - 1
    return inspections.cumulativeFinals[last] + inspections.cumulativeSors[last]
  }
  return (
    inspectionsAtEnd(electrical) > 0 ||
    inspectionsAtEnd(mechanical) > 0 ||
    welding.cumulativeLogged[welding.weeks.length - 1] > 0 ||
    bim.cumulativeOpened[bim.weeks.length - 1] > 0
  )
}

/** The union position of a view's week, or the current week's when the key is not in the data. */
function viewPosition(index: OverviewIndex, key: number): number {
  return index.positionByKey.get(key) ?? index.weeks.length - 1
}

/** The chart series for the view's window. Mode switches leave these unchanged, so callers can keep them. */
export function buildOverviewSeries(index: OverviewIndex, view: ViewState): OverviewSeries {
  const endPosition = viewPosition(index, view.windowEndKey)
  const startPosition = view.range === 'all' ? 0 : recentWindowStart(endPosition)
  return windowSeries(index, startPosition, endPosition)
}

/** The rows and the quality strip for the view's selected week in one card mode. */
export function buildOverviewCards(index: OverviewIndex, view: ViewState, mode: CardMode): OverviewCardsModel {
  const selectedPosition = viewPosition(index, view.selectedKey)
  const selectedWeek = index.weeks[selectedPosition]
  const previousWeek = previousWorkWeek(selectedWeek)
  const key = selectedWeek.key
  const previousKey = previousWeek.key
  const context: RowContext = {
    index,
    mode,
    sparkStart: recentWindowStart(selectedPosition),
    selectedPosition,
    previousLabel: previousWeek.label,
  }

  const electrical = inspectionCounts(index.electrical, key, previousKey)
  const mechanical = inspectionCounts(index.mechanical, key, previousKey)
  const welds = weldCounts(index.welding, key, previousKey)

  return {
    selectedWeek,
    previousWeek,
    weekOptions: [...index.weeks].reverse(),
    rows: {
      electrical: inspectionRow(context, 'Electrical', index.electrical, electrical),
      mechanical: inspectionRow(context, 'Mechanical', index.mechanical, mechanical),
      welding: weldingRow(context, index.welding, welds),
      bim: bimRow(context, index.bim, key, previousKey),
    },
    quality: qualityCards(context, electrical, mechanical, welds),
    hasData: hasCountedRows(index),
  }
}

export function buildOverviewModel(index: OverviewIndex, view: ViewState, mode: CardMode): OverviewModel {
  return { ...buildOverviewCards(index, view, mode), ...buildOverviewSeries(index, view) }
}
