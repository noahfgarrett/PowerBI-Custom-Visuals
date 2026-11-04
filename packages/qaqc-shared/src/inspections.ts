import type {
  BuildingBar,
  BuildingTally,
  DeltaMetric,
  InspectionColumns,
  InspectionIndex,
  InspectionModel,
  InspectionPhase,
  InspectionRows,
  OtherBuildings,
  ViewState,
  WeekCounts,
  WindowTotals,
  WorkWeek,
} from './types'
import { NAME_COLLATOR } from './format'
import { createNameGrouper, createWeekReader, firstSpelling } from './grouping'
import { formatWeekRange, type WeekRange } from './weekRange'
import { enumerateWorkWeeks, previousWorkWeek, toIsoWorkWeek, workWeekFromKey } from './workWeeks'

export const UNSPECIFIED_BUILDING = 'Unspecified'
const NO_ISSUE = 'no issue found'

export const RECENT_WEEK_COUNT = 30

/** The position of the first week in the recent window that ends at `endPosition`. */
export function recentWindowStart(endPosition: number): number {
  return Math.max(0, endPosition - RECENT_WEEK_COUNT + 1)
}
export const TOP_BUILDING_COUNT = 8

export function cellText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  if (typeof value === 'boolean') return String(value)
  return ''
}

export function classifyPhase(value: unknown): InspectionPhase {
  const text = cellText(value).toLowerCase()
  if (!text) return 'other'
  if (text === 'final' || text.startsWith('final ') || text.includes('final inspection')) return 'final'
  if (text.includes('sor')) return 'sor'
  return 'other'
}

export function isIssueFound(value: unknown): boolean {
  const text = cellText(value).toLowerCase()
  return text !== '' && text !== NO_ISSUE
}

export function normalizeBuilding(value: unknown): string {
  return cellText(value) || UNSPECIFIED_BUILDING
}

interface WeekBucket {
  finals: number
  sors: number
  issuesFound: number
  issueRows: number[]
  buildings: Map<string, BuildingTally>
}

const NO_ROWS: readonly number[] = []

/** `classifyPhase`, cached by the raw text: phase text repeats heavily across hundreds of thousands of rows. */
export function readPhase(value: unknown, cache: Map<string, InspectionPhase>): InspectionPhase {
  if (typeof value !== 'string') return classifyPhase(value)
  const cached = cache.get(value)
  if (cached !== undefined) return cached
  const phase = classifyPhase(value)
  cache.set(value, phase)
  return phase
}

export interface InspectionIndexOptions {
  /** The axis starts here when that is before the first data week, so a filtered index keeps the full data's weeks. */
  axisFromKey?: number
}

export function buildInspectionIndex(
  rows: InspectionRows,
  columns: InspectionColumns,
  today: Date,
  options: InspectionIndexOptions = {},
): InspectionIndex {
  const currentWeek = toIsoWorkWeek(today)
  const readWeek = createWeekReader()
  const phaseCache = new Map<string, InspectionPhase>()
  const buckets = new Map<number, WeekBucket>()
  // Buildings that differ only by case or spacing share one tally, shown under the first spelling seen.
  const buildingName = createNameGrouper(firstSpelling)
  let skippedRows = 0
  let futureRows = 0
  let firstWeek: WorkWeek | null = null

  for (let rowPosition = 0; rowPosition < rows.length; rowPosition += 1) {
    const row = rows[rowPosition]
    const phase = readPhase(row[columns.phase], phaseCache)
    if (phase === 'other') continue

    const week = readWeek(row[columns.workWeek])
    if (!week) {
      skippedRows += 1
      continue
    }
    if (week.key > currentWeek.key) {
      futureRows += 1
      continue
    }

    if (!firstWeek || week.key < firstWeek.key) firstWeek = week

    let bucket = buckets.get(week.key)
    if (!bucket) {
      bucket = { finals: 0, sors: 0, issuesFound: 0, issueRows: [], buildings: new Map() }
      buckets.set(week.key, bucket)
    }
    const building = buildingName(normalizeBuilding(row[columns.building]))
    let tally = bucket.buildings.get(building)
    if (!tally) {
      tally = { finals: 0, sors: 0 }
      bucket.buildings.set(building, tally)
    }
    if (phase === 'final') {
      bucket.finals += 1
      tally.finals += 1
      if (isIssueFound(row[columns.issue])) {
        bucket.issuesFound += 1
        bucket.issueRows.push(rowPosition)
      }
    } else {
      bucket.sors += 1
      tally.sors += 1
    }
  }

  const weeks: WeekCounts[] = []
  const cumulativeFinals: number[] = []
  const cumulativeSors: number[] = []
  const cumulativeIssues: number[] = []
  const buildingsByWeek: Array<Map<string, BuildingTally>> = []
  const issueRowsByWeek: Array<readonly number[]> = []
  const positionByKey = new Map<number, number>()
  let finals = 0
  let sors = 0
  let issues = 0

  const dataStart = firstWeek ?? currentWeek
  const { axisFromKey } = options
  const axisStart = axisFromKey !== undefined && axisFromKey < dataStart.key ? workWeekFromKey(axisFromKey) : dataStart

  for (const week of enumerateWorkWeeks(axisStart, currentWeek)) {
    const bucket = buckets.get(week.key)
    const counts: WeekCounts = {
      week,
      finals: bucket?.finals ?? 0,
      sors: bucket?.sors ?? 0,
      issuesFound: bucket?.issuesFound ?? 0,
    }
    finals += counts.finals
    sors += counts.sors
    issues += counts.issuesFound
    positionByKey.set(week.key, weeks.length)
    weeks.push(counts)
    cumulativeFinals.push(finals)
    cumulativeSors.push(sors)
    cumulativeIssues.push(issues)
    buildingsByWeek.push(bucket?.buildings ?? new Map())
    issueRowsByWeek.push(bucket?.issueRows ?? NO_ROWS)
  }

  return {
    currentWeek,
    weeks,
    cumulativeFinals,
    cumulativeSors,
    cumulativeIssues,
    buildingsByWeek,
    issueRowsByWeek,
    positionByKey,
    totalRows: rows.length,
    skippedRows,
    futureRows,
  }
}

export function defaultViewState(index: { currentWeek: WorkWeek }): ViewState {
  return { selectedKey: index.currentWeek.key, windowEndKey: index.currentWeek.key, range: 'recent', dateRange: null }
}

function deltaMetric(value: number, previous: number): DeltaMetric {
  return { value, delta: value - previous }
}

/** Percent 0–100 of Finals with no issue found, or null with no Finals. */
function passRateOf(finals: number, issues: number): number | null {
  if (finals === 0) return null
  return ((finals - issues) / finals) * 100
}

export function passRateAt(index: InspectionIndex, position: number): number | null {
  if (position < 0) return null
  return passRateOf(index.cumulativeFinals[position], index.cumulativeIssues[position])
}

/**
 * The pass rate over a span of work weeks, from `fromKey` (the first week, when null) through `toKey`, for a dashboard
 * whose own weeks aren't this index's. A week outside this index holds no finals; null with no finals in the span.
 */
export function passRateInWeeks(index: InspectionIndex, fromKey: number | null, toKey: number): number | null {
  let finals = 0
  let issues = 0
  for (const { week, finals: weekFinals, issuesFound } of index.weeks) {
    if (week.key > toKey) break
    if (fromKey !== null && week.key < fromKey) continue
    finals += weekFinals
    issues += issuesFound
  }
  return passRateOf(finals, issues)
}

/** A running total's growth over positions `start` to `end`. */
function totalBetween(cumulative: number[], start: number, end: number): number {
  return cumulative[end] - (start > 0 ? cumulative[start - 1] : 0)
}

/**
 * The first and last positions of a date range's weeks. The axis has them all, filtered or not; a range past either
 * end of an axis pulls to its nearest week.
 */
export function rangePositions(
  index: { weeks: ReadonlyArray<{ week: { key: number } }> },
  range: WeekRange,
): { start: number; end: number } {
  const first = index.weeks.findIndex((item) => item.week.key >= range.fromKey)
  const start = first === -1 ? index.weeks.length - 1 : first
  let end = start
  while (end + 1 < index.weeks.length && index.weeks[end + 1].week.key <= range.toKey) end += 1
  return { start, end }
}

function summarizeBuildings(
  index: InspectionIndex,
  start: number,
  end: number,
): { buildings: BuildingBar[]; allBuildings: BuildingBar[]; otherBuildings: OtherBuildings | null } {
  const totals = new Map<string, BuildingTally>()
  for (let position = start; position <= end; position += 1) {
    for (const [building, tally] of index.buildingsByWeek[position]) {
      const total = totals.get(building) ?? { finals: 0, sors: 0 }
      total.finals += tally.finals
      total.sors += tally.sors
      totals.set(building, total)
    }
  }
  const ranked: BuildingBar[] = [...totals.entries()]
    .map(([building, tally]) => ({ building, finals: tally.finals, sors: tally.sors }))
    .sort((a, b) => b.finals + b.sors - (a.finals + a.sors) || NAME_COLLATOR.compare(a.building, b.building))
  const rest = ranked.slice(TOP_BUILDING_COUNT)
  return {
    buildings: ranked.slice(0, TOP_BUILDING_COUNT),
    allBuildings: ranked,
    otherBuildings: rest.length === 0
      ? null
      : {
          count: rest.length,
          finals: rest.reduce((sum, bar) => sum + bar.finals, 0),
          sors: rest.reduce((sum, bar) => sum + bar.sors, 0),
        },
  }
}

export function buildInspectionModel(index: InspectionIndex, view: ViewState): InspectionModel {
  const lastPosition = index.weeks.length - 1
  // In a date range the window is the range's weeks.
  const span = view.dateRange === null ? null : rangePositions(index, view.dateRange)
  const isInRange = span !== null
  const endPosition = span?.end ?? index.positionByKey.get(view.windowEndKey) ?? lastPosition
  const startPosition = span?.start ?? (view.range === 'all' ? 0 : recentWindowStart(endPosition))
  const knownSelected = index.positionByKey.get(view.selectedKey) ?? lastPosition
  const selectedPosition = span === null ? knownSelected : Math.min(Math.max(knownSelected, span.start), span.end)
  const selected = index.weeks[selectedPosition]
  const previous = selectedPosition > 0 ? index.weeks[selectedPosition - 1] : null
  const window = index.weeks.slice(startPosition, endPosition + 1)
  const { buildings, allBuildings, otherBuildings } = summarizeBuildings(index, startPosition, endPosition)

  const windowTotals: WindowTotals = {
    finals: totalBetween(index.cumulativeFinals, startPosition, endPosition),
    sors: totalBetween(index.cumulativeSors, startPosition, endPosition),
    issuesFound: totalBetween(index.cumulativeIssues, startPosition, endPosition),
    weeks: window.length,
  }

  const finalsToDate = isInRange ? windowTotals.finals : index.cumulativeFinals[selectedPosition]
  const issuesToDate = isInRange ? windowTotals.issuesFound : index.cumulativeIssues[selectedPosition]
  const passRate = passRateOf(finalsToDate, issuesToDate)
  const previousPassRate = isInRange ? null : passRateAt(index, selectedPosition - 1)
  // Cumulative rates restart at From, so the trend's last point in a range equals the In range card.
  const trendStart = isInRange ? startPosition : 0

  return {
    selectedWeek: selected.week,
    previousWeek: previousWorkWeek(selected.week),
    weekOptions: (isInRange ? window : index.weeks).map((item) => item.week).reverse(),
    thisWeek: {
      finals: deltaMetric(selected.finals, previous?.finals ?? 0),
      sors: deltaMetric(selected.sors, previous?.sors ?? 0),
      issuesFound: deltaMetric(selected.issuesFound, previous?.issuesFound ?? 0),
    },
    toDate: {
      finals: finalsToDate,
      sors: isInRange ? windowTotals.sors : index.cumulativeSors[selectedPosition],
      finalsThisWeek: selected.finals,
      sorsThisWeek: selected.sors,
      cleanFinals: finalsToDate - issuesToDate,
      passRate,
      passRateDeltaPoints: passRate !== null && previousPassRate !== null ? passRate - previousPassRate : null,
    },
    window,
    passRateTrend: window.map((item, offset) => {
      const position = startPosition + offset
      const totalFinals = totalBetween(index.cumulativeFinals, trendStart, position)
      const totalIssues = totalBetween(index.cumulativeIssues, trendStart, position)
      return {
        week: item.week,
        rate: passRateOf(totalFinals, totalIssues),
        cleanFinals: totalFinals - totalIssues,
        totalFinals,
        hadIssue: item.issuesFound > 0,
        issuesFound: item.issuesFound,
      }
    }),
    buildings,
    allBuildings,
    otherBuildings,
    windowTotals,
    rangeLabel: view.dateRange === null ? null : formatWeekRange(view.dateRange),
    hasData: isInRange
      ? windowTotals.finals + windowTotals.sors > 0
      : index.cumulativeFinals[lastPosition] + index.cumulativeSors[lastPosition] > 0,
  }
}
