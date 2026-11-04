import type {
  BuildingIssueBar,
  DeltaMetric,
  InspectionRows,
  OtherIssueBuildings,
  OtherSystems,
  SignoffSummary,
  SpecBar,
  SpecTally,
  SystemBar,
  SystemDetail,
  SystemTally,
  ViewState,
  WeldBuildingTally,
  WeldColumns,
  WeldIndex,
  WeldModel,
  WeldOptionalColumns,
  WeldWeekCounts,
  WeldWindowTotals,
  WorkWeek,
} from './types'
import { NAME_COLLATOR } from './format'
import { createNameGrouper, createWeekReader, firstSpelling, groupKey } from './grouping'
import { cellText, rangePositions, recentWindowStart } from './inspections'
import { groupKey as filterGroupKey, optionalField, type FilterFieldDef, type Row } from './rowFilters'
import { formatWeekRange } from './weekRange'
import { enumerateWorkWeeks, previousWorkWeek, toIsoWorkWeek, workWeekFromKey } from './workWeeks'

export const SITE_GENERAL = 'Site General'
export const UNSPECIFIED_WELD_VALUE = 'Unspecified'
export const TOP_SYSTEM_COUNT = 8

// ISSUE CREATED? holds a BIM number when an issue exists, so these explicit "no" answers are the only fills that don't count.
const NO_ISSUE_VALUES: ReadonlySet<string> = new Set(['no', 'n/a', 'na', 'none', '-'])
// Case-sensitive on purpose: a lower-case tag is not one of the project's building tags.
const BUILDING_PATTERN = /(?:^|-)(?:P\d-)?([A-Z]{1,2}\d{1,3})(?=XX|[A-Z]\d{3})/

export function isWeldSigned(value: unknown): boolean {
  return cellText(value) !== ''
}

export function isWeldIssue(value: unknown): boolean {
  const text = cellText(value).toLowerCase()
  return text !== '' && !NO_ISSUE_VALUES.has(text)
}

export function normalizeSystem(value: unknown): string {
  return cellText(value) || UNSPECIFIED_WELD_VALUE
}

export function normalizePipeSpec(value: unknown): string {
  return cellText(value) || UNSPECIFIED_WELD_VALUE
}

export function weldBuilding(tag: unknown): string {
  const match = BUILDING_PATTERN.exec(cellText(tag))
  return match ? match[1] : SITE_GENERAL
}

/** What a dashboard needs to rebuild its index when a field filter changes the rows. */
export interface WeldFilterSource {
  rows: InspectionRows
  columns: WeldColumns
  optional: WeldOptionalColumns
  today: Date
}

const UNSPECIFIED_KEY = groupKey(UNSPECIFIED_WELD_VALUE)

/**
 * A field the charts already label, with the chart's value and key, so the two can't disagree: `N/A` is a value of its
 * own, as it is on the chart. What the chart shows as Unspecified reads as '', the blank value, so it's listed last.
 */
export function chartLabelledField(id: string, label: string, normalize: (value: unknown) => string, position: number): FilterFieldDef {
  return {
    id,
    label,
    read: (row) => {
      const name = normalize(row[position])
      return groupKey(name) === UNSPECIFIED_KEY ? '' : name
    },
    groupBy: groupKey,
    blankLabel: UNSPECIFIED_WELD_VALUE,
  }
}

/** The recorded welders a Welder cell lists, split as Performance splits them, remembered by cell text. */
function createWelderReader(position: number): (row: Row) => readonly string[] {
  const cache = new Map<string, readonly string[]>()
  return (row) => {
    const text = cellText(row[position])
    const cached = cache.get(text)
    if (cached !== undefined) return cached
    const welders = text.split(',').map((part) => part.trim()).filter((part) => filterGroupKey(part) !== '')
    cache.set(text, welders)
    return welders
  }
}

/** The menu's fields, in menu order. Only bound slots appear; the required ones always do. */
export function weldFilterFields(columns: WeldColumns, optional: WeldOptionalColumns): FilterFieldDef[] {
  const welder: FilterFieldDef[] = optional.welder < 0
    ? []
    : [{ id: 'welder', label: 'Welder', read: createWelderReader(optional.welder) }]
  return [
    // The chart's value and key, derived from Tag No. Every weld has one, so there's no blank value to label.
    { id: 'building', label: 'Building', read: (row) => weldBuilding(row[columns.tagNo]), groupBy: groupKey },
    chartLabelledField('pipeSpec', 'Pipe Spec', normalizePipeSpec, columns.pipeSpec),
    chartLabelledField('fluidCode', 'Fluid Code', normalizeSystem, columns.fluidCode),
    ...welder,
    ...optionalField('workPackage', 'Work Package', optional.workPackage),
  ]
}

/** Reads a row's Weld Work Week the way the index does, for counting rows in a date range. */
export function weldRowWeekKey(columns: WeldColumns): (row: Row) => number | null {
  const readWeek = createWeekReader()
  return (row) => readWeek(row[columns.weldWeek])?.key ?? null
}

interface WeekBucket {
  logged: number
  signed: number
  issues: number
  issueRows: number[]
  systems: Map<string, SystemTally>
  buildings: Map<string, WeldBuildingTally>
}

const NO_ROWS: readonly number[] = []

export interface WeldIndexOptions {
  /** The axis starts here when that is before the first data week, so a filtered index keeps the full data's weeks. */
  axisFromKey?: number
}

export function buildWeldIndex(
  rows: InspectionRows,
  columns: WeldColumns,
  today: Date,
  options: WeldIndexOptions = {},
): WeldIndex {
  const currentWeek = toIsoWorkWeek(today)
  const readWeek = createWeekReader()
  const buckets = new Map<number, WeekBucket>()
  // Signed welds counted by the week QAQC signed them. Weeks outside the index range are never read back.
  const signedByWeek = new Map<number, number>()
  // Names that differ only by case or spacing share one tally, shown under the first spelling seen.
  const systemName = createNameGrouper(firstSpelling)
  const specName = createNameGrouper(firstSpelling)
  const buildingName = createNameGrouper(firstSpelling)
  let skippedRows = 0
  let futureRows = 0
  let firstWeek: WorkWeek | null = null

  for (let rowPosition = 0; rowPosition < rows.length; rowPosition += 1) {
    const row = rows[rowPosition]
    const week = readWeek(row[columns.weldWeek])
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
      bucket = { logged: 0, signed: 0, issues: 0, issueRows: [], systems: new Map(), buildings: new Map() }
      buckets.set(week.key, bucket)
    }

    const isSigned = isWeldSigned(row[columns.signature])
    const system = systemName(normalizeSystem(row[columns.fluidCode]))
    const spec = specName(normalizePipeSpec(row[columns.pipeSpec]))
    const building = buildingName(weldBuilding(row[columns.tagNo]))

    let systemTally = bucket.systems.get(system)
    if (!systemTally) {
      systemTally = { total: 0, signed: 0, specs: new Map() }
      bucket.systems.set(system, systemTally)
    }
    let specTally = systemTally.specs.get(spec)
    if (!specTally) {
      specTally = { total: 0, signed: 0 }
      systemTally.specs.set(spec, specTally)
    }
    let buildingTally = bucket.buildings.get(building)
    if (!buildingTally) {
      buildingTally = { welds: 0, issues: 0 }
      bucket.buildings.set(building, buildingTally)
    }

    bucket.logged += 1
    systemTally.total += 1
    specTally.total += 1
    buildingTally.welds += 1
    if (isWeldIssue(row[columns.issue])) {
      bucket.issues += 1
      bucket.issueRows.push(rowPosition)
      buildingTally.issues += 1
    }
    if (isSigned) {
      bucket.signed += 1
      systemTally.signed += 1
      specTally.signed += 1
      // A signed weld whose signed week is unreadable or in the future still counts as signed, just not in a week.
      const signedWeek = readWeek(row[columns.signedWeek])
      if (signedWeek && signedWeek.key <= currentWeek.key) {
        signedByWeek.set(signedWeek.key, (signedByWeek.get(signedWeek.key) ?? 0) + 1)
      }
    }
  }

  const weeks: WeldWeekCounts[] = []
  const cumulativeLogged: number[] = []
  const cumulativeSigned: number[] = []
  const cumulativeIssues: number[] = []
  const systemsByWeek: Array<Map<string, SystemTally>> = []
  const buildingsByWeek: Array<Map<string, WeldBuildingTally>> = []
  const issueRowsByWeek: Array<readonly number[]> = []
  const positionByKey = new Map<number, number>()
  let logged = 0
  let signed = 0
  let issues = 0

  const dataStart = firstWeek ?? currentWeek
  const { axisFromKey } = options
  const axisStart = axisFromKey !== undefined && axisFromKey < dataStart.key ? workWeekFromKey(axisFromKey) : dataStart

  for (const week of enumerateWorkWeeks(axisStart, currentWeek)) {
    const bucket = buckets.get(week.key)
    const counts: WeldWeekCounts = {
      week,
      logged: bucket?.logged ?? 0,
      signed: bucket?.signed ?? 0,
      issues: bucket?.issues ?? 0,
      signedInWeek: signedByWeek.get(week.key) ?? 0,
    }
    logged += counts.logged
    signed += counts.signed
    issues += counts.issues
    positionByKey.set(week.key, weeks.length)
    weeks.push(counts)
    cumulativeLogged.push(logged)
    cumulativeSigned.push(signed)
    cumulativeIssues.push(issues)
    systemsByWeek.push(bucket?.systems ?? new Map())
    buildingsByWeek.push(bucket?.buildings ?? new Map())
    issueRowsByWeek.push(bucket?.issueRows ?? NO_ROWS)
  }

  return {
    currentWeek,
    weeks,
    cumulativeLogged,
    cumulativeSigned,
    cumulativeIssues,
    systemsByWeek,
    buildingsByWeek,
    issueRowsByWeek,
    positionByKey,
    totalRows: rows.length,
    skippedRows,
    futureRows,
  }
}

function deltaMetric(value: number, previous: number): DeltaMetric {
  return { value, delta: value - previous }
}

export function overallRateAt(index: WeldIndex, position: number): number | null {
  if (position < 0) return null
  const logged = index.cumulativeLogged[position]
  return logged === 0 ? null : (index.cumulativeSigned[position] / logged) * 100
}

/** Sign-off for the latest weld week at or before the position that has welds, or null when none does (or the position is −1). */
export function latestSignoff(index: WeldIndex, position: number): SignoffSummary | null {
  for (let cursor = position; cursor >= 0; cursor -= 1) {
    const counts = index.weeks[cursor]
    if (counts.logged > 0) {
      return { signed: counts.signed, total: counts.logged, week: counts.week, rate: (counts.signed / counts.logged) * 100 }
    }
  }
  return null
}

function byTotalThenName<T extends { total: number }>(name: (item: T) => string): (a: T, b: T) => number {
  return (a, b) => b.total - a.total || NAME_COLLATOR.compare(name(a), name(b))
}

function summarizeSystems(index: WeldIndex, start: number, end: number): SystemDetail[] {
  const totals = new Map<string, SystemTally>()
  for (let position = start; position <= end; position += 1) {
    for (const [system, tally] of index.systemsByWeek[position]) {
      let total = totals.get(system)
      if (!total) {
        total = { total: 0, signed: 0, specs: new Map() }
        totals.set(system, total)
      }
      total.total += tally.total
      total.signed += tally.signed
      for (const [spec, specTally] of tally.specs) {
        const specTotal: SpecTally = total.specs.get(spec) ?? { total: 0, signed: 0 }
        specTotal.total += specTally.total
        specTotal.signed += specTally.signed
        total.specs.set(spec, specTotal)
      }
    }
  }
  return [...totals.entries()]
    .map(([system, tally]): SystemDetail => {
      const specs: SpecBar[] = [...tally.specs.entries()]
        .map(([spec, specTally]) => ({ spec, total: specTally.total, signed: specTally.signed }))
        .sort(byTotalThenName((bar) => bar.spec))
      return { system, total: tally.total, signed: tally.signed, specs }
    })
    .sort(byTotalThenName((detail) => detail.system))
}

function summarizeBuildings(index: WeldIndex, start: number, end: number): BuildingIssueBar[] {
  const totals = new Map<string, WeldBuildingTally>()
  for (let position = start; position <= end; position += 1) {
    for (const [building, tally] of index.buildingsByWeek[position]) {
      const total = totals.get(building) ?? { welds: 0, issues: 0 }
      total.welds += tally.welds
      total.issues += tally.issues
      totals.set(building, total)
    }
  }
  return [...totals.entries()]
    .map(([building, tally]): BuildingIssueBar => ({
      building,
      welds: tally.welds,
      issues: tally.issues,
      rate: (tally.issues / tally.welds) * 100,
    }))
    .sort((a, b) => b.rate - a.rate || b.issues - a.issues || NAME_COLLATOR.compare(a.building, b.building))
}

export function buildWeldModel(
  index: WeldIndex,
  view: ViewState,
  drillSystem: string | null,
  minWelds: number,
): WeldModel {
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

  const allSystems = summarizeSystems(index, startPosition, endPosition)
  const restSystems = allSystems.slice(TOP_SYSTEM_COUNT)
  const otherSystems: OtherSystems | null = restSystems.length === 0
    ? null
    : {
        count: restSystems.length,
        total: restSystems.reduce((sum, system) => sum + system.total, 0),
        signed: restSystems.reduce((sum, system) => sum + system.signed, 0),
      }
  const systems: SystemBar[] = allSystems
    .slice(0, TOP_SYSTEM_COUNT)
    .map((system) => ({ system: system.system, total: system.total, signed: system.signed }))

  const allBuildings = summarizeBuildings(index, startPosition, endPosition)
  const buildings = allBuildings.filter((bar) => bar.welds >= minWelds)
  const smallBuildings = allBuildings.filter((bar) => bar.welds < minWelds)
  const otherBuildings: OtherIssueBuildings | null = smallBuildings.length === 0
    ? null
    : {
        count: smallBuildings.length,
        welds: smallBuildings.reduce((sum, bar) => sum + bar.welds, 0),
        issues: smallBuildings.reduce((sum, bar) => sum + bar.issues, 0),
      }

  const before = (cumulative: number[]): number => (startPosition > 0 ? cumulative[startPosition - 1] : 0)
  const windowTotals: WeldWindowTotals = {
    welds: index.cumulativeLogged[endPosition] - before(index.cumulativeLogged),
    signed: index.cumulativeSigned[endPosition] - before(index.cumulativeSigned),
    issues: index.cumulativeIssues[endPosition] - before(index.cumulativeIssues),
    weeks: window.length,
  }

  const inRangeRate = windowTotals.welds === 0 ? null : (windowTotals.signed / windowTotals.welds) * 100
  const overallRate = isInRange ? inRangeRate : overallRateAt(index, selectedPosition)
  const previousRate = isInRange ? null : overallRateAt(index, selectedPosition - 1)

  return {
    selectedWeek: selected.week,
    previousWeek: previousWorkWeek(selected.week),
    weekOptions: (isInRange ? window : index.weeks).map((item) => item.week).reverse(),
    thisWeek: {
      logged: deltaMetric(selected.logged, previous?.logged ?? 0),
      signedInWeek: deltaMetric(selected.signedInWeek, previous?.signedInWeek ?? 0),
      signoff: latestSignoff(index, selectedPosition),
      issues: deltaMetric(selected.issues, previous?.issues ?? 0),
    },
    toDate: {
      total: isInRange ? windowTotals.welds : index.cumulativeLogged[selectedPosition],
      signed: isInRange ? windowTotals.signed : index.cumulativeSigned[selectedPosition],
      totalThisWeek: selected.logged,
      overallRate,
      overallRateDeltaPoints: overallRate !== null && previousRate !== null ? overallRate - previousRate : null,
    },
    window,
    systems,
    allSystems,
    otherSystems,
    // Matched by grouping key: a refresh can change which spelling a system is shown under.
    drill: drillSystem === null ? null : (allSystems.find((system) => groupKey(system.system) === groupKey(drillSystem)) ?? null),
    buildings,
    allBuildings,
    otherBuildings,
    overallIssueRate: windowTotals.welds === 0 ? 0 : (windowTotals.issues / windowTotals.welds) * 100,
    windowTotals,
    rangeLabel: view.dateRange === null ? null : formatWeekRange(view.dateRange),
    hasData: isInRange ? windowTotals.welds > 0 : index.cumulativeLogged[lastPosition] > 0,
  }
}
