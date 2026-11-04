import type { CombinedSource, CombinedSplit } from './combined'
import type { DeltaTone, Trend } from './format'
import type { CombinedColumns, InspectionIndex, IssueIndex, ViewState, WeldIndex, WorkWeek } from './types'
import type { WeekRange } from './weekRange'
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
import { buildIssueBenchmarks, type IssueBenchmarks } from './issueBenchmarks'
import { buildIssueIndex, closureRateAt, riseIsBad } from './issues'
import { topCauseCreated } from './rootCauses'
import { formatWeekRange } from './weekRange'
import { buildWeldIndex, latestSignoff, overallRateAt } from './welds'
import { enumerateWorkWeeks, previousWorkWeek, workWeekFromKey } from './workWeeks'

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

/** Each discipline indexed with its own builder. A source with no rows holds an empty index (one week, all zero). */
export interface SourceIndexes {
  electrical: InspectionIndex
  mechanical: InspectionIndex
  welding: WeldIndex
  bim: IssueIndex
}

export interface OverviewIndex extends SourceIndexes {
  currentWeek: WorkWeek
  /** The day the index was built for; the issue benchmarks' end of a week is never later. */
  today: Date
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
  /** For an index a field filter rebuilt: the sources it left with no rows, though the table has some. Null with no filter. */
  filteredOut: ReadonlySet<CombinedSource> | null
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
  /** The value's full text as a tooltip, for a value a narrow card may cut short (a root cause name). */
  valueTitle?: string
}

export type OverviewCards = [OverviewCard, OverviewCard, OverviewCard, OverviewCard]

export interface ConnectedOverviewRow {
  connected: true
  cards: OverviewCards
  /** The row's metric for the 30 weeks ending at the selected week (BIM in a date range's totals: at its end), oldest first. */
  sparkline: number[]
  /** The position of the marked week in `sparkline` (its last point). */
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

export type OverviewQualityCards = [OverviewCard, OverviewCard, OverviewCard, OverviewCard, OverviewCard, OverviewCard]

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
  /** CORs, NCRs, Inspection NCR pass rate, Welding NCR pass rate, DWNs, Top root cause. */
  quality: OverviewQualityCards
  /** True when any source has a counted row, or in a date range, activity in it or issues open at its end. */
  hasData: boolean
  /** `WW10'2026 to WW30'2026`; null with no date range. */
  rangeLabel: string | null
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

/**
 * Indexes each source. A source in `reuse` keeps that index and isn't read again; it must have been built over the same
 * rows. Each rebuilt source's axis starts no later than its index in `axisFrom`, so a filtered source keeps its weeks.
 */
export function buildOverviewIndex(
  split: CombinedSplit,
  columns: CombinedColumns,
  today: Date,
  reuse: Partial<SourceIndexes> = {},
  axisFrom?: SourceIndexes,
): OverviewIndex {
  const electrical = reuse.electrical
    ?? buildInspectionIndex(split.electrical, inspectionColumnsOf(columns), today, { axisFromKey: axisFrom?.electrical.weeks[0].week.key })
  const mechanical = reuse.mechanical
    ?? buildInspectionIndex(split.mechanical, inspectionColumnsOf(columns), today, { axisFromKey: axisFrom?.mechanical.weeks[0].week.key })
  const welding = reuse.welding
    ?? buildWeldIndex(split.welding, weldColumnsOf(columns), today, { axisFromKey: axisFrom?.welding.weeks[0].week.key })
  const bim = reuse.bim
    ?? buildIssueIndex(split.bim, issueColumnsOf(columns), today, { axisFromKey: axisFrom?.bim.weeks[0].week.key })
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
    today,
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
    filteredOut: null,
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
const NO_WELDS_IN_RANGE = 'No welds in range'
const NO_ISSUES_YET = 'No issues opened yet'
const GREEN_TAGS_MISSING = 'DWN rate n/a: add Green tags'
const DWN_RATE_NA = 'DWN rate n/a'
const DWN_RATE_FILTERED = 'Not available with filters'
const PAST_WINDOW_LABEL = 'Past normal close window'
const TOP_CAUSE_LABEL = 'Top root cause'
const ROOT_CAUSE_MISSING = 'Add Root Cause'

const neutralTone: CountTone = () => 'neutral'
const amberWhenUp: CountTone = (value, previous) => (value > previous ? 'warn' : 'neutral')
/** This WW: amber when up. To date: red when up, as Total Opened is in the QCx Issues visual. */
const openedTone: CountTone = (value, previous, mode) => (mode === 'toDate' ? riseIsBad(value - previous) : amberWhenUp(value, previous, mode))
/**
 * This WW: green when at least as many closed as the week before, but a week with nothing closed is never green.
 * To date: green when the total rose, as in the QCx Issues visual.
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

/** A card with no value to compare: a placeholder such as `n/a` or `None`, and why. */
function noteCard(label: string, display: string, subLine: string): OverviewCard {
  return { label, value: null, display, delta: null, deltaDisplay: null, trend: 'none', tone: 'neutral', subLine, isValueBad: false }
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

/** A date range's limits by week key, to place in each discipline's own weeks. */
interface RangeKeys {
  beforeStartKey: number
  endKey: number
}

function rangeKeysOf(range: WeekRange | null): RangeKeys | null {
  if (range === null) return null
  return { beforeStartKey: previousWorkWeek(workWeekFromKey(range.fromKey)).key, endKey: range.toKey }
}

/** A discipline's positions for the selected week and the week before; −1 before its first week. */
interface Positions {
  position: number
  previousPosition: number
  /** In a date range, the week before it and its last week. */
  span: { beforeStart: number; end: number } | null
}

function positionsIn(index: { positionByKey: ReadonlyMap<number, number> }, key: number, previousKey: number, range: RangeKeys | null): Positions {
  return {
    position: positionIn(index, key),
    previousPosition: positionIn(index, previousKey),
    span: range === null ? null : { beforeStart: positionIn(index, range.beforeStartKey), end: positionIn(index, range.endKey) },
  }
}

/** A running total through the selected week, or over the date range. */
function totalAt(cumulative: readonly number[], { position, span }: Positions): number {
  return span === null ? valueAt(cumulative, position) : valueAt(cumulative, span.end) - valueAt(cumulative, span.beforeStart)
}

/** A count from a discipline's weekly values and running totals, at the selected week and the week before. In a date range the total is the range's, and the selected week is what it gained. */
function seriesAt(weekly: (position: number) => number, cumulative: readonly number[], positions: Positions): CountSeries {
  const { position, previousPosition, span } = positions
  const week = position < 0 ? 0 : weekly(position)
  const toDate = totalAt(cumulative, positions)
  return {
    week,
    previousWeek: previousPosition < 0 ? 0 : weekly(previousPosition),
    toDate,
    previousToDate: span === null ? valueAt(cumulative, previousPosition) : toDate - week,
  }
}

interface InspectionCounts extends Positions {
  finals: CountSeries
  sors: CountSeries
  ncrs: CountSeries
}

function inspectionCounts(index: InspectionIndex, key: number, previousKey: number, range: RangeKeys | null): InspectionCounts {
  const positions = positionsIn(index, key, previousKey, range)
  return {
    ...positions,
    finals: seriesAt((at) => index.weeks[at].finals, index.cumulativeFinals, positions),
    sors: seriesAt((at) => index.weeks[at].sors, index.cumulativeSors, positions),
    ncrs: seriesAt((at) => index.weeks[at].issuesFound, index.cumulativeIssues, positions),
  }
}

interface WeldCounts extends Positions {
  welds: CountSeries
  ncrs: CountSeries
}

function weldCounts(index: WeldIndex, key: number, previousKey: number, range: RangeKeys | null): WeldCounts {
  const positions = positionsIn(index, key, previousKey, range)
  return {
    ...positions,
    welds: seriesAt((at) => index.weeks[at].logged, index.cumulativeLogged, positions),
    ncrs: seriesAt((at) => index.weeks[at].issues, index.cumulativeIssues, positions),
  }
}

/** A rate over a date range stands alone, as on the discipline visuals: the weeks before it aren't in it to compare. */
function rangeRateCard(label: string, rate: number | null, subLine: string): OverviewCard {
  return { ...rateCard(label, rate, null, subLine, ''), deltaDisplay: null }
}

/** The pass rate and its counts in the selected week (This WW) or through it (To date), and for the week before. */
function passRateCard(label: string, ncrs: CountSeries, totals: CountSeries, mode: CardMode, isInRange: boolean, previousLabel: string, subLineOf: (ncrs: number, total: number) => string): OverviewCard {
  const isWeek = mode === 'week'
  const ncrCount = isWeek ? ncrs.week : ncrs.toDate
  const total = isWeek ? totals.week : totals.toDate
  const rate = passRate(ncrCount, total)
  if (!isWeek && isInRange) return rangeRateCard(label, rate, subLineOf(ncrCount, total))
  const previousRate = isWeek ? passRate(ncrs.previousWeek, totals.previousWeek) : passRate(ncrs.previousToDate, totals.previousToDate)
  return rateCard(label, rate, previousRate, subLineOf(ncrCount, total), previousLabel)
}

function cleanFinalsLine(ncrs: number, finals: number): string {
  return finals === 0 ? '0 Finals' : `${formatCount(finals - ncrs)} / ${formatCount(finals)} Finals`
}

/** A discipline's NCR pass rate: W's finals only in This WW, the Inspection visual's own rate in To date. */
function inspectionPassRateCard(index: InspectionIndex, counts: InspectionCounts, mode: CardMode, previousLabel: string): OverviewCard {
  const isInRange = counts.span !== null
  if (mode === 'week' || isInRange) return passRateCard('NCR pass rate', counts.ncrs, counts.finals, mode, isInRange, previousLabel, cleanFinalsLine)
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
  selectedPosition: number
  previousLabel: string
  range: RangeKeys | null
  /** Union positions of a date range's first and last weeks; null with no range. */
  span: { start: number; end: number } | null
}

/** A source with no rows to show: the table has none, or a filter left none. */
function disconnectedRow(context: RowContext, name: string, source: CombinedSource): DisconnectedOverviewRow {
  const isFilteredOut = context.index.filteredOut?.has(source) === true
  return { connected: false, message: isFilteredOut ? `No ${name} rows match these filters` : `Not connected: no ${name} rows in QCx Combined` }
}

/** `endPosition` is the sparkline's last week: the selected week, unless the row's cards read somewhere else. */
function connectedRow(
  context: RowContext,
  cards: OverviewCards,
  metricAt: (key: number) => number,
  endPosition = context.selectedPosition,
  previousLabel = context.previousLabel,
): ConnectedOverviewRow {
  const { index, span } = context
  const sparkStart = Math.max(recentWindowStart(endPosition), span?.start ?? 0)
  const sparkline: number[] = []
  for (let position = sparkStart; position <= endPosition; position += 1) sparkline.push(metricAt(index.weeks[position].key))
  const previous = endPosition > 0 ? metricAt(index.weeks[endPosition - 1].key) : 0
  return {
    connected: true,
    cards,
    sparkline,
    sparklineSelected: sparkline.length - 1,
    trendText: trendWords(sparkline[sparkline.length - 1] - previous, previousLabel),
  }
}

function inspectionRow(context: RowContext, name: string, source: CombinedSource, index: InspectionIndex, counts: InspectionCounts): OverviewRow {
  if (index.totalRows === 0) return disconnectedRow(context, name, source)
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
  const logged = counts.welds.toDate
  const signed = totalAt(index.cumulativeSigned, counts)
  const signedLine = `${formatCount(signed)} of ${formatCount(logged)} signed`
  if (counts.span !== null) {
    const rangeRate = logged === 0 ? null : (signed / logged) * 100
    const card = rangeRateCard('Sign-off %', rangeRate, logged === 0 ? NO_WELDS_IN_RANGE : signedLine)
    return { ...card, isValueBad: isBelowSignoffBaseline(rangeRate) }
  }
  const rate = overallRateAt(index, counts.position)
  const card = rateCard('Sign-off %', rate, overallRateAt(index, counts.previousPosition), logged === 0 ? NO_WELDS_YET : signedLine, previousLabel)
  return { ...card, isValueBad: isBelowSignoffBaseline(rate) }
}

function signedCard(index: WeldIndex, counts: WeldCounts, mode: CardMode, previousLabel: string): OverviewCard {
  const signedInWeek = (position: number): number => weekAt(index.weeks, position)?.signedInWeek ?? 0
  const thisWeek = signedInWeek(counts.position)
  if (mode === 'week') return weekCountCard('Signed', thisWeek, signedInWeek(counts.previousPosition), previousLabel, 'neutral')
  // Signed to date counts by weld week, as the Welding visual does; the change is the welds signed in the week.
  const signed = totalAt(index.cumulativeSigned, counts)
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
  if (index.totalRows === 0) return disconnectedRow(context, 'Welding', 'welding')
  const { mode, previousLabel } = context
  const cards: OverviewCards = [
    countCard('Welds logged', counts.welds, mode, previousLabel, neutralTone),
    signedCard(index, counts, mode, previousLabel),
    signoffCard(index, counts, mode, previousLabel),
    countCard('NCRs', counts.ncrs, mode, previousLabel, amberWhenUp),
  ]
  return connectedRow(context, cards, (key) => weekAt(index.weeks, positionIn(index, key))?.logged ?? 0)
}

/** Remaining open is always to date, with its change against the week before. In a date range's totals it's as of the range's end. */
function remainingCard(index: IssueIndex, asOf: number, previousAsOf: number, previousLabel: string): OverviewCard {
  const remainingAt = (position: number): number => valueAt(index.cumulativeOpened, position) - valueAt(index.cumulativeClosed, position)
  const remaining = remainingAt(asOf)
  const previous = remainingAt(previousAsOf)
  return weekCountCard('Remaining open', remaining, previous, previousLabel, riseIsBad(remaining - previous))
}

interface CachedBenchmarks {
  weekKey: number
  today: number
  benchmarks: IssueBenchmarks
}

/** The last benchmarks built for each BIM index, so a card mode switch reuses them and only a new week rebuilds them. */
const lastBenchmarks = new WeakMap<IssueIndex, CachedBenchmarks>()

function benchmarksAt(index: IssueIndex, weekKey: number, today: Date): IssueBenchmarks {
  const cached = lastBenchmarks.get(index)
  if (cached !== undefined && cached.weekKey === weekKey && cached.today === today.getTime()) return cached.benchmarks
  const benchmarks = buildIssueBenchmarks(index, weekKey, today)
  lastBenchmarks.set(index, { weekKey, today: today.getTime(), benchmarks })
  return benchmarks
}

/** Open issues as of a week older than the normal close window, like Remaining open: W in both modes, or a date range's end in its totals. */
function pastWindowCard(index: IssueIndex, asOf: number, weekKey: number, today: Date): OverviewCard {
  // Before the first issue the benchmarks would fall back to the current week, so the card says so instead.
  if (valueAt(index.cumulativeOpened, asOf) === 0) return noteCard(PAST_WINDOW_LABEL, 'n/a', NO_ISSUES_YET)
  const { open, window, pastWindow, olderThanAny } = benchmarksAt(index, weekKey, today)
  const openCount = formatCount(open.length)
  if (window === null) return noteCard(PAST_WINDOW_LABEL, 'n/a', `${openCount} open · no closures yet`)
  const closedRate = formatPercent(closureRateAt(index, asOf))
  return {
    label: PAST_WINDOW_LABEL,
    value: pastWindow,
    display: formatCount(pastWindow),
    delta: null,
    deltaDisplay: null,
    trend: 'none',
    tone: pastWindow > 0 ? 'bad' : 'neutral',
    subLine: `of ${openCount} open · ${formatCount(olderThanAny)} older than any closure · ${closedRate} closed`,
    isValueBad: false,
  }
}

function bimRow(context: RowContext, index: IssueIndex, key: number, previousKey: number): OverviewRow {
  if (index.totalRows === 0) return disconnectedRow(context, 'BIM Issues', 'bim')
  const { mode, previousLabel, range, span, selectedPosition } = context
  const positions = positionsIn(index, key, previousKey, range)
  const opened = seriesAt((at) => index.weeks[at].opened, index.cumulativeOpened, positions)
  const closed = seriesAt((at) => index.weeks[at].closed, index.cumulativeClosed, positions)
  // These are counts at a moment, so a range can't restate them: its totals read them at its end, a selected week at that week.
  const rangeEnd = mode === 'toDate' && range !== null && positions.span !== null && span !== null
    ? { position: positions.span.end, unionPosition: span.end, key: range.endKey, previousLabel: previousWorkWeek(workWeekFromKey(range.endKey)).label }
    : null
  const asOf = rangeEnd?.position ?? positions.position
  const previousAsOf = rangeEnd === null ? positions.previousPosition : asOf - 1
  const asOfPreviousLabel = rangeEnd?.previousLabel ?? previousLabel
  const cards: OverviewCards = [
    countCard('Opened', opened, mode, previousLabel, openedTone),
    countCard('Closed', closed, mode, previousLabel, closedTone),
    remainingCard(index, asOf, previousAsOf, asOfPreviousLabel),
    pastWindowCard(index, asOf, rangeEnd?.key ?? key, context.index.today),
  ]
  // Its last point is the Remaining open card, so it ends where that reads.
  return connectedRow(
    context,
    cards,
    (weekKey) => {
      const position = positionIn(index, weekKey)
      return valueAt(index.cumulativeOpened, position) - valueAt(index.cumulativeClosed, position)
    },
    rangeEnd?.unionPosition ?? selectedPosition,
    asOfPreviousLabel,
  )
}

/** The DWN rate is always to date. The index already treats a Green tags value of 0 or below as missing. */
function dwnRateLine(dwnsToDate: number, greenTags: number | null): string {
  if (greenTags === null) return GREEN_TAGS_MISSING
  return `${formatPercent((dwnsToDate / greenTags) * 100)} of green tags (to date)`
}

/** The most common root cause among issues created in W (This WW) or through W (To date); ties go to the first name. */
function topRootCauseCard(index: IssueIndex, weekKey: number, mode: CardMode): OverviewCard {
  if (!index.hasRootCause) return noteCard(TOP_CAUSE_LABEL, 'n/a', ROOT_CAUSE_MISSING)
  const isWeek = mode === 'week'
  const { total, top } = topCauseCreated(index, weekKey, isWeek ? 'week' : 'toDate')

  const totalText = formatCount(total)
  if (total === 0) return noteCard(TOP_CAUSE_LABEL, 'None', isWeek ? 'None opened this WW' : 'No issues to date')
  if (top === null) {
    const scope = isWeek ? `${totalText} opened this WW` : `${totalText} ${pluralize(total, 'issue', 'issues')}`
    return noteCard(TOP_CAUSE_LABEL, 'None', `${scope} · none recorded`)
  }
  const { label, count } = top
  const share = Math.round((count / total) * 100)
  return {
    label: TOP_CAUSE_LABEL,
    value: count,
    display: label,
    delta: null,
    deltaDisplay: null,
    trend: 'none',
    tone: 'neutral',
    subLine: isWeek
      ? `${formatCount(count)} of ${totalText} opened this WW`
      : `${formatCount(count)} of ${totalText} ${pluralize(total, 'issue', 'issues')} · ${share}%`,
    isValueBad: false,
    valueTitle: label,
  }
}

function qualityCards(context: RowContext, electrical: InspectionCounts, mechanical: InspectionCounts, welds: WeldCounts): OverviewQualityCards {
  const { index, mode, selectedPosition, previousLabel, range } = context
  const selectedKey = index.weeks[selectedPosition].key
  const positions = positionsIn(index, selectedKey, previousWorkWeek(index.weeks[selectedPosition]).key, range)
  const cors = seriesAt((at) => index.corsByWeek[at], index.cumulativeCors, positions)
  const dwns = seriesAt((at) => index.dwnsByWeek[at], index.cumulativeDwns, positions)
  const isInRange = range !== null
  const isFiltered = isInRange || index.filteredOut !== null
  const inspectionNcrs = sumSeries([electrical.ncrs, mechanical.ncrs])
  const breakdown = `E ${formatCount(modeValue(electrical.ncrs, mode))} · M ${formatCount(modeValue(mechanical.ncrs, mode))} · W ${formatCount(modeValue(welds.ncrs, mode))}`
  return [
    countCard('CORs', cors, mode, previousLabel, amberWhenUp),
    { ...countCard('NCRs', sumSeries([inspectionNcrs, welds.ncrs]), mode, previousLabel, amberWhenUp), subLine: breakdown },
    passRateCard('Inspection NCR pass rate', inspectionNcrs, sumSeries([electrical.finals, mechanical.finals]), mode, isInRange, previousLabel, ncrsOfLine('final', 'finals')),
    passRateCard('Welding NCR pass rate', welds.ncrs, welds.welds, mode, isInRange, previousLabel, ncrsOfLine('weld', 'welds')),
    isFiltered
      // Green tags is a single unfiltered measure, so a filtered or in-range rate would mislead. Its reason takes the
      // change's line, because together on one they'd be cut short on these narrow cards.
      ? { ...countCard('DWNs', dwns, mode, previousLabel, neutralTone), subLine: DWN_RATE_NA, delta: null, deltaDisplay: DWN_RATE_FILTERED, trend: 'none' }
      : { ...countCard('DWNs', dwns, mode, previousLabel, neutralTone), subLine: dwnRateLine(dwns.toDate, index.greenTags) },
    // To date it's a reading at a moment, like Remaining open, so a range reads it at its end. This WW follows the week.
    topRootCauseCard(index.bim, mode === 'toDate' && range !== null ? range.endKey : selectedKey, mode),
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

/** Whether any week holds rows for each chart: Finals and SORs for the activity chart, Finals and welds for the rates. */
export function overviewChartRows(index: SourceIndexes): { hasActivityRows: boolean; hasRatesRows: boolean } {
  const atEnd = (cumulative: readonly number[]): number => cumulative[cumulative.length - 1]
  const finals = atEnd(index.electrical.cumulativeFinals) + atEnd(index.mechanical.cumulativeFinals)
  const sors = atEnd(index.electrical.cumulativeSors) + atEnd(index.mechanical.cumulativeSors)
  return { hasActivityRows: finals + sors > 0, hasRatesRows: finals + atEnd(index.welding.cumulativeLogged) > 0 }
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

/**
 * Whether a date range has anything to show. A quiet range with issues still open has real numbers: its Remaining open
 * and its Past normal close window.
 */
function hasRangeRows(index: OverviewIndex, range: RangeKeys): boolean {
  const { electrical, mechanical, welding, bim } = index
  const inRange = (source: { positionByKey: ReadonlyMap<number, number> }, cumulative: readonly number[]): number => {
    const beforeStart = positionIn(source, range.beforeStartKey)
    return valueAt(cumulative, positionIn(source, range.endKey)) - valueAt(cumulative, beforeStart)
  }
  const signedInRange = welding.weeks.some(({ week, signedInWeek }) => signedInWeek > 0 && week.key > range.beforeStartKey && week.key <= range.endKey)
  const bimEnd = positionIn(bim, range.endKey)
  return (
    inRange(electrical, electrical.cumulativeFinals) + inRange(electrical, electrical.cumulativeSors) > 0 ||
    inRange(mechanical, mechanical.cumulativeFinals) + inRange(mechanical, mechanical.cumulativeSors) > 0 ||
    inRange(welding, welding.cumulativeLogged) > 0 ||
    signedInRange ||
    inRange(bim, bim.cumulativeOpened) + inRange(bim, bim.cumulativeClosed) > 0 ||
    valueAt(bim.cumulativeOpened, bimEnd) - valueAt(bim.cumulativeClosed, bimEnd) > 0
  )
}

/** The union position of a view's week, or the current week's when the key is not in the data. */
function viewPosition(index: OverviewIndex, key: number): number {
  return index.positionByKey.get(key) ?? index.weeks.length - 1
}

/** The union positions of a date range's weeks. A range past either end of the weeks pulls to its nearest week. */
function unionRange(index: OverviewIndex, range: WeekRange): { start: number; end: number } {
  const first = index.weeks.findIndex((week) => week.key >= range.fromKey)
  const start = first === -1 ? index.weeks.length - 1 : first
  let end = start
  while (end + 1 < index.weeks.length && index.weeks[end + 1].key <= range.toKey) end += 1
  return { start, end }
}

/** The chart series for the view's window, or its date range. Mode switches leave these unchanged, so callers can keep them. */
export function buildOverviewSeries(index: OverviewIndex, view: ViewState): OverviewSeries {
  if (view.dateRange !== null) {
    const { start, end } = unionRange(index, view.dateRange)
    return windowSeries(index, start, end)
  }
  const endPosition = viewPosition(index, view.windowEndKey)
  const startPosition = view.range === 'all' ? 0 : recentWindowStart(endPosition)
  return windowSeries(index, startPosition, endPosition)
}

/** A week's NCRs on the charts: Electrical, Mechanical and Welding. The Overview doesn't count BIM NCRs. */
export function overviewWeekNcrs(index: SourceIndexes, key: number): number {
  const inspectionNcrs = (source: InspectionIndex): number => weekAt(source.weeks, positionIn(source, key))?.issuesFound ?? 0
  const weldNcrs = weekAt(index.welding.weeks, positionIn(index.welding, key))?.issues ?? 0
  return inspectionNcrs(index.electrical) + inspectionNcrs(index.mechanical) + weldNcrs
}

/** The rows and the quality strip for the view's selected week in one card mode. */
export function buildOverviewCards(index: OverviewIndex, view: ViewState, mode: CardMode): OverviewCardsModel {
  const span = view.dateRange === null ? null : unionRange(index, view.dateRange)
  const knownPosition = viewPosition(index, view.selectedKey)
  const selectedPosition = span === null ? knownPosition : Math.min(Math.max(knownPosition, span.start), span.end)
  const range = rangeKeysOf(view.dateRange)
  const selectedWeek = index.weeks[selectedPosition]
  const previousWeek = previousWorkWeek(selectedWeek)
  const key = selectedWeek.key
  const previousKey = previousWeek.key
  const context: RowContext = {
    index,
    mode,
    selectedPosition,
    previousLabel: previousWeek.label,
    range,
    span,
  }

  const electrical = inspectionCounts(index.electrical, key, previousKey, range)
  const mechanical = inspectionCounts(index.mechanical, key, previousKey, range)
  const welds = weldCounts(index.welding, key, previousKey, range)

  return {
    selectedWeek,
    previousWeek,
    weekOptions: (span === null ? [...index.weeks] : index.weeks.slice(span.start, span.end + 1)).reverse(),
    rows: {
      electrical: inspectionRow(context, 'Electrical', 'electrical', index.electrical, electrical),
      mechanical: inspectionRow(context, 'Mechanical', 'mechanical', index.mechanical, mechanical),
      welding: weldingRow(context, index.welding, welds),
      bim: bimRow(context, index.bim, key, previousKey),
    },
    quality: qualityCards(context, electrical, mechanical, welds),
    hasData: range === null ? hasCountedRows(index) : hasRangeRows(index, range),
    rangeLabel: view.dateRange === null ? null : formatWeekRange(view.dateRange),
  }
}

export function buildOverviewModel(index: OverviewIndex, view: ViewState, mode: CardMode): OverviewModel {
  return { ...buildOverviewCards(index, view, mode), ...buildOverviewSeries(index, view) }
}
