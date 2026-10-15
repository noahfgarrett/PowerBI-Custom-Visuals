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
  WorkWeek,
} from './types'
import { enumerateWorkWeeks, parseWorkWeek, previousWorkWeek, toIsoWorkWeek } from './workWeeks'

export const UNSPECIFIED_BUILDING = 'Unspecified'
const NO_ISSUE = 'no issue found'

export const RECENT_WEEK_COUNT = 30
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
  buildings: Map<string, BuildingTally>
}

// Work-week and phase text repeat heavily (a few hundred distinct values across
// hundreds of thousands of rows), so parsing is cached by the raw text.
function readWeek(value: unknown, cache: Map<string, WorkWeek | null>): WorkWeek | null {
  if (typeof value !== 'string' && typeof value !== 'number') return parseWorkWeek(value)
  const text = String(value)
  const cached = cache.get(text)
  if (cached !== undefined) return cached
  const parsed = parseWorkWeek(text)
  cache.set(text, parsed)
  return parsed
}

function readPhase(value: unknown, cache: Map<string, InspectionPhase>): InspectionPhase {
  if (typeof value !== 'string') return classifyPhase(value)
  const cached = cache.get(value)
  if (cached !== undefined) return cached
  const phase = classifyPhase(value)
  cache.set(value, phase)
  return phase
}

export function buildInspectionIndex(
  rows: InspectionRows,
  columns: InspectionColumns,
  today: Date,
): InspectionIndex {
  const currentWeek = toIsoWorkWeek(today)
  const weekCache = new Map<string, WorkWeek | null>()
  const phaseCache = new Map<string, InspectionPhase>()
  const buckets = new Map<number, WeekBucket>()
  let skippedRows = 0
  let futureRows = 0
  let firstWeek: WorkWeek | null = null

  for (const row of rows) {
    const week = readWeek(row[columns.workWeek], weekCache)
    if (!week) {
      skippedRows += 1
      continue
    }
    if (week.key > currentWeek.key) {
      futureRows += 1
      continue
    }
    if (!firstWeek || week.key < firstWeek.key) firstWeek = week

    const phase = readPhase(row[columns.phase], phaseCache)
    if (phase === 'other') continue

    let bucket = buckets.get(week.key)
    if (!bucket) {
      bucket = { finals: 0, sors: 0, issuesFound: 0, buildings: new Map() }
      buckets.set(week.key, bucket)
    }
    const building = normalizeBuilding(row[columns.building])
    let tally = bucket.buildings.get(building)
    if (!tally) {
      tally = { finals: 0, sors: 0 }
      bucket.buildings.set(building, tally)
    }
    if (phase === 'final') {
      bucket.finals += 1
      tally.finals += 1
      if (isIssueFound(row[columns.issue])) bucket.issuesFound += 1
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
  const positionByKey = new Map<number, number>()
  let finals = 0
  let sors = 0
  let issues = 0

  for (const week of enumerateWorkWeeks(firstWeek ?? currentWeek, currentWeek)) {
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
  }

  return {
    currentWeek,
    weeks,
    cumulativeFinals,
    cumulativeSors,
    cumulativeIssues,
    buildingsByWeek,
    positionByKey,
    totalRows: rows.length,
    skippedRows,
    futureRows,
  }
}

export function defaultViewState(index: InspectionIndex): ViewState {
  return { selectedKey: index.currentWeek.key, windowEndKey: index.currentWeek.key, range: 'recent' }
}

function deltaMetric(value: number, previous: number): DeltaMetric {
  return { value, delta: value - previous }
}

function passRateAt(index: InspectionIndex, position: number): number | null {
  if (position < 0) return null
  const finals = index.cumulativeFinals[position]
  if (finals === 0) return null
  return ((finals - index.cumulativeIssues[position]) / finals) * 100
}

function summarizeBuildings(
  index: InspectionIndex,
  start: number,
  end: number,
): { buildings: BuildingBar[]; otherBuildings: OtherBuildings | null } {
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
    .sort((a, b) => b.finals + b.sors - (a.finals + a.sors) || a.building.localeCompare(b.building))
  const rest = ranked.slice(TOP_BUILDING_COUNT)
  return {
    buildings: ranked.slice(0, TOP_BUILDING_COUNT),
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
  const selectedPosition = index.positionByKey.get(view.selectedKey) ?? lastPosition
  const endPosition = index.positionByKey.get(view.windowEndKey) ?? lastPosition
  const startPosition = view.range === 'all' ? 0 : Math.max(0, endPosition - RECENT_WEEK_COUNT + 1)
  const selected = index.weeks[selectedPosition]
  const previous = selectedPosition > 0 ? index.weeks[selectedPosition - 1] : null
  const finalsToDate = index.cumulativeFinals[selectedPosition]
  const passRate = passRateAt(index, selectedPosition)
  const previousPassRate = passRateAt(index, selectedPosition - 1)
  const window = index.weeks.slice(startPosition, endPosition + 1)
  const { buildings, otherBuildings } = summarizeBuildings(index, startPosition, endPosition)

  return {
    selectedWeek: selected.week,
    previousWeek: previousWorkWeek(selected.week),
    weekOptions: index.weeks.map((item) => item.week).reverse(),
    thisWeek: {
      finals: deltaMetric(selected.finals, previous?.finals ?? 0),
      sors: deltaMetric(selected.sors, previous?.sors ?? 0),
      issuesFound: deltaMetric(selected.issuesFound, previous?.issuesFound ?? 0),
    },
    toDate: {
      finals: finalsToDate,
      sors: index.cumulativeSors[selectedPosition],
      finalsThisWeek: selected.finals,
      sorsThisWeek: selected.sors,
      cleanFinals: finalsToDate - index.cumulativeIssues[selectedPosition],
      passRate,
      passRateDeltaPoints: passRate !== null && previousPassRate !== null ? passRate - previousPassRate : null,
    },
    window,
    passRateTrend: window.map((item, offset) => {
      const position = startPosition + offset
      const totalFinals = index.cumulativeFinals[position]
      return {
        week: item.week,
        rate: passRateAt(index, position),
        cleanFinals: totalFinals - index.cumulativeIssues[position],
        totalFinals,
        hadIssue: item.issuesFound > 0,
      }
    }),
    buildings,
    otherBuildings,
    hasData: index.totalRows - index.skippedRows - index.futureRows > 0,
  }
}
