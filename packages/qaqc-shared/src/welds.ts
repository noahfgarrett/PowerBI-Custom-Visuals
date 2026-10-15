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
  WeldWeekCounts,
  WeldWindowTotals,
  WorkWeek,
} from './types'
import { NAME_COLLATOR } from './format'
import { cellText, RECENT_WEEK_COUNT } from './inspections'
import { enumerateWorkWeeks, parseWorkWeek, previousWorkWeek, toIsoWorkWeek } from './workWeeks'

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

interface WeekBucket {
  logged: number
  signed: number
  issues: number
  systems: Map<string, SystemTally>
  buildings: Map<string, WeldBuildingTally>
}

// Names that differ only by case or spacing share one tally, shown under the first spelling seen.
interface NameGroups {
  /** Exact spelling → display name. Few distinct spellings repeat across all rows, so most lookups end here. */
  bySpelling: Map<string, string>
  /** Case- and whitespace-insensitive key → display name. */
  byKey: Map<string, string>
}

function newNameGroups(): NameGroups {
  return { bySpelling: new Map(), byKey: new Map() }
}

function groupName(spelling: string, groups: NameGroups): string {
  const known = groups.bySpelling.get(spelling)
  if (known !== undefined) return known
  const key = spelling.toLowerCase().replace(/\s+/g, ' ')
  const name = groups.byKey.get(key) ?? spelling
  groups.byKey.set(key, name)
  groups.bySpelling.set(spelling, name)
  return name
}

// Work-week text repeats heavily (a few hundred distinct values across hundreds of thousands of rows),
// so parsing is cached by the raw text.
function readWeek(value: unknown, cache: Map<string, WorkWeek | null>): WorkWeek | null {
  if (typeof value !== 'string' && typeof value !== 'number') return parseWorkWeek(value)
  const text = String(value)
  const cached = cache.get(text)
  if (cached !== undefined) return cached
  const parsed = parseWorkWeek(text)
  cache.set(text, parsed)
  return parsed
}

export function buildWeldIndex(rows: InspectionRows, columns: WeldColumns, today: Date): WeldIndex {
  const currentWeek = toIsoWorkWeek(today)
  const weekCache = new Map<string, WorkWeek | null>()
  const buckets = new Map<number, WeekBucket>()
  // Signed welds counted by the week QAQC signed them. Weeks outside the index range are never read back.
  const signedByWeek = new Map<number, number>()
  const systemNames = newNameGroups()
  const specNames = newNameGroups()
  const buildingNames = newNameGroups()
  let skippedRows = 0
  let futureRows = 0
  let firstWeek: WorkWeek | null = null

  for (const row of rows) {
    const week = readWeek(row[columns.weldWeek], weekCache)
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
      bucket = { logged: 0, signed: 0, issues: 0, systems: new Map(), buildings: new Map() }
      buckets.set(week.key, bucket)
    }

    const isSigned = isWeldSigned(row[columns.signature])
    const system = groupName(normalizeSystem(row[columns.fluidCode]), systemNames)
    const spec = groupName(normalizePipeSpec(row[columns.pipeSpec]), specNames)
    const building = groupName(weldBuilding(row[columns.tagNo]), buildingNames)

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
      buildingTally.issues += 1
    }
    if (isSigned) {
      bucket.signed += 1
      systemTally.signed += 1
      specTally.signed += 1
      // A signed weld whose signed week is unreadable or in the future still counts as signed, just not in a week.
      const signedWeek = readWeek(row[columns.signedWeek], weekCache)
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
  const positionByKey = new Map<number, number>()
  let logged = 0
  let signed = 0
  let issues = 0

  for (const week of enumerateWorkWeeks(firstWeek ?? currentWeek, currentWeek)) {
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
  }

  return {
    currentWeek,
    weeks,
    cumulativeLogged,
    cumulativeSigned,
    cumulativeIssues,
    systemsByWeek,
    buildingsByWeek,
    positionByKey,
    totalRows: rows.length,
    skippedRows,
    futureRows,
  }
}

function deltaMetric(value: number, previous: number): DeltaMetric {
  return { value, delta: value - previous }
}

function overallRateAt(index: WeldIndex, position: number): number | null {
  if (position < 0) return null
  const logged = index.cumulativeLogged[position]
  return logged === 0 ? null : (index.cumulativeSigned[position] / logged) * 100
}

/** Sign-off for the latest weld week at or before the position that has welds. */
function latestSignoff(index: WeldIndex, position: number): SignoffSummary | null {
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
  const selectedPosition = index.positionByKey.get(view.selectedKey) ?? lastPosition
  const endPosition = index.positionByKey.get(view.windowEndKey) ?? lastPosition
  const startPosition = view.range === 'all' ? 0 : Math.max(0, endPosition - RECENT_WEEK_COUNT + 1)
  const selected = index.weeks[selectedPosition]
  const previous = selectedPosition > 0 ? index.weeks[selectedPosition - 1] : null
  const overallRate = overallRateAt(index, selectedPosition)
  const previousRate = overallRateAt(index, selectedPosition - 1)
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

  return {
    selectedWeek: selected.week,
    previousWeek: previousWorkWeek(selected.week),
    weekOptions: index.weeks.map((item) => item.week).reverse(),
    thisWeek: {
      logged: deltaMetric(selected.logged, previous?.logged ?? 0),
      signedThisWeek: deltaMetric(selected.signedInWeek, previous?.signedInWeek ?? 0),
      signoff: latestSignoff(index, selectedPosition),
      issues: deltaMetric(selected.issues, previous?.issues ?? 0),
    },
    toDate: {
      total: index.cumulativeLogged[selectedPosition],
      signed: index.cumulativeSigned[selectedPosition],
      totalThisWeek: selected.logged,
      signedThisWeek: selected.signed,
      overallRate,
      overallRateDeltaPoints: overallRate !== null && previousRate !== null ? overallRate - previousRate : null,
    },
    window,
    systems,
    allSystems,
    otherSystems,
    drill: drillSystem === null ? null : (allSystems.find((system) => system.system === drillSystem) ?? null),
    buildings,
    allBuildings,
    otherBuildings,
    overallIssueRate: windowTotals.welds === 0 ? 0 : (windowTotals.issues / windowTotals.welds) * 100,
    windowTotals,
    hasData: index.cumulativeLogged[lastPosition] > 0,
  }
}
