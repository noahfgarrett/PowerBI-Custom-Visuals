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

/** Column positions of each welding field slot inside a table row. */
export interface WeldColumns {
  weldWeek: number
  signature: number
  signedWeek: number
  issue: number
  fluidCode: number
  pipeSpec: number
  tagNo: number
}

export interface WeldWeekCounts {
  week: WorkWeek
  /** Welds with this weld week. */
  logged: number
  /** Signed welds with this weld week. */
  signed: number
  /** Welds with this weld week that have an issue created. */
  issues: number
  /** Signed welds whose signed week is this week, whatever their weld week. */
  signedInWeek: number
}

export interface SpecTally {
  total: number
  signed: number
}

export interface SystemTally {
  total: number
  signed: number
  specs: Map<string, SpecTally>
}

export interface WeldBuildingTally {
  welds: number
  issues: number
}

export interface WeldIndex {
  currentWeek: WorkWeek
  /** Continuous weeks from the first week with welds through the current week. Always holds at least one week, the current week. */
  weeks: WeldWeekCounts[]
  /** Parallel to weeks: running totals by weld week through each week. */
  cumulativeLogged: number[]
  cumulativeSigned: number[]
  cumulativeIssues: number[]
  /** Parallel to weeks: system → tally for that weld week. */
  systemsByWeek: Array<Map<string, SystemTally>>
  /** Parallel to weeks: building → tally for that weld week. */
  buildingsByWeek: Array<Map<string, WeldBuildingTally>>
  positionByKey: Map<number, number>
  totalRows: number
  skippedRows: number
  futureRows: number
}

/** Sign-off for one weld week: signed welds out of the welds logged that week. */
export interface SignoffSummary {
  signed: number
  total: number
  week: WorkWeek
  /** Percent 0–100. */
  rate: number
}

export interface SpecBar {
  spec: string
  total: number
  signed: number
}

export interface SystemBar {
  system: string
  total: number
  signed: number
}

export interface SystemDetail extends SystemBar {
  /** Ranked by total, then name. */
  specs: SpecBar[]
}

export interface OtherSystems {
  count: number
  total: number
  signed: number
}

export interface BuildingIssueBar {
  building: string
  welds: number
  issues: number
  /** Issues ÷ welds as a percent 0–100. */
  rate: number
}

export interface OtherIssueBuildings {
  count: number
  welds: number
  issues: number
}

export interface WeldWindowTotals {
  welds: number
  signed: number
  issues: number
  weeks: number
}

export interface WeldModel {
  selectedWeek: WorkWeek
  previousWeek: WorkWeek
  /** Newest first. */
  weekOptions: WorkWeek[]
  thisWeek: {
    logged: DeltaMetric
    /** Signed welds whose signed week is the selected week. */
    signedInWeek: DeltaMetric
    /** Sign-off for the latest weld week up to the selected week that has welds, or null when none exist. */
    signoff: SignoffSummary | null
    issues: DeltaMetric
  }
  toDate: {
    total: number
    signed: number
    /** Welds logged in the selected week. */
    totalThisWeek: number
    /** Percent 0–100, or null when no welds exist through the selected week. */
    overallRate: number | null
    /** Change in points versus through the previous week, or null when either rate is missing. */
    overallRateDeltaPoints: number | null
  }
  window: WeldWeekCounts[]
  /** Top systems in the window, ranked by total. */
  systems: SystemBar[]
  /** Every system in the window, ranked, with its pipe specs. `systems` is the top slice of this list. */
  allSystems: SystemDetail[]
  otherSystems: OtherSystems | null
  /** The drilled system's window tally, or null when nothing is drilled or it has no welds in the window. */
  drill: SystemDetail | null
  /** Buildings with at least the minimum welds, ranked by issue rate, then issues, then name. */
  buildings: BuildingIssueBar[]
  /** Every building in the window, ignoring the minimum, in the same order. */
  allBuildings: BuildingIssueBar[]
  otherBuildings: OtherIssueBuildings | null
  /** Window issues ÷ window welds as a percent, 0 when the window has no welds. */
  overallIssueRate: number
  windowTotals: WeldWindowTotals
  hasData: boolean
}
