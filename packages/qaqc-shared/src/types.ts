export interface WorkWeek {
  week: number
  year: number
  /** year * 100 + week. Sorts chronologically. */
  key: number
  /** WW42'2026 */
  label: string
}

export type InspectionPhase = 'final' | 'sor' | 'other'

/** Column positions of each field slot inside a table row. */
export interface InspectionColumns {
  workWeek: number
  phase: number
  issue: number
  building: number
}

export type InspectionRows = ReadonlyArray<ReadonlyArray<unknown>>

export interface WeekCounts {
  week: WorkWeek
  finals: number
  sors: number
  /** Final inspections with an issue found. SORs never count. */
  issuesFound: number
}

export interface BuildingTally {
  finals: number
  sors: number
}

export interface InspectionIndex {
  currentWeek: WorkWeek
  /** Continuous weeks from the first week with data through the current week. Always holds at least one week, the current week. */
  weeks: WeekCounts[]
  /** Parallel to weeks: running totals through each week. */
  cumulativeFinals: number[]
  cumulativeSors: number[]
  cumulativeIssues: number[]
  /** Parallel to weeks: building → tally for that week. */
  buildingsByWeek: Array<Map<string, BuildingTally>>
  positionByKey: Map<number, number>
  totalRows: number
  skippedRows: number
  futureRows: number
}

export type RangeMode = 'recent' | 'all'

export interface ViewState {
  selectedKey: number
  windowEndKey: number
  range: RangeMode
}

export interface DeltaMetric {
  value: number
  delta: number
}

export interface PassRatePoint {
  week: WorkWeek
  /** Percent 0–100, or null when no Finals exist through this week. */
  rate: number | null
  cleanFinals: number
  totalFinals: number
  hadIssue: boolean
  /** Final inspections with an issue found in this week. */
  issuesFound: number
}

export interface BuildingBar {
  building: string
  finals: number
  sors: number
}

export interface OtherBuildings {
  count: number
  finals: number
  sors: number
}

export interface WindowTotals {
  finals: number
  sors: number
  issuesFound: number
  weeks: number
}

export interface InspectionModel {
  selectedWeek: WorkWeek
  previousWeek: WorkWeek
  /** Newest first. */
  weekOptions: WorkWeek[]
  thisWeek: {
    finals: DeltaMetric
    sors: DeltaMetric
    issuesFound: DeltaMetric
  }
  toDate: {
    finals: number
    sors: number
    finalsThisWeek: number
    sorsThisWeek: number
    cleanFinals: number
    passRate: number | null
    passRateDeltaPoints: number | null
  }
  window: WeekCounts[]
  passRateTrend: PassRatePoint[]
  buildings: BuildingBar[]
  /** Every building in the window, ranked. `buildings` is the top slice of this list. */
  allBuildings: BuildingBar[]
  otherBuildings: OtherBuildings | null
  windowTotals: WindowTotals
  hasData: boolean
}
