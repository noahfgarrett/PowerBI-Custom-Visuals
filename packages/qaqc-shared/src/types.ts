import type { DeltaTone } from './format'
import type { WeekRange } from './weekRange'

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

/** Column positions of the optional inspection slots, or −1 when the slot isn't bound. */
export interface InspectionOptionalColumns {
  generalContractor: number
  tradeSupplier: number
  discipline: number
  inspectionCategory: number
  status: number
  inspectionId: number
  equipmentTag: number
  issueId: number
  findingType: number
  dateObserved: number
  qcr: number
  notes: number
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
  /** Parallel to weeks: the positions, in the rows that built this index, of the rows behind issuesFound. */
  issueRowsByWeek: ReadonlyArray<readonly number[]>
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
  /** Replaces the `range` window while set. */
  dateRange: WeekRange | null
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
  /** `WW10'2026 to WW30'2026` while a date range is set: the to-date cards and the window then cover it. */
  rangeLabel: string | null
  /** Whether any Final or SOR is in the data, or in the date range when one is set. */
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

/** Optional Welding columns, for the filter menu and the drill-down. −1 when unbound. */
export interface WeldOptionalColumns {
  welder: number
  workPackage: number
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
  /** Parallel to weeks: the row positions behind that week's `issues` count, in the rows that built this index. */
  issueRowsByWeek: Array<readonly number[]>
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
  /** `WW10'2026 to WW30'2026` while a date range is set, when `toDate` restates to the range; otherwise null. */
  rangeLabel: string | null
  hasData: boolean
}

/**
 * Column positions of each BIM issue field slot inside a table row. The Root Cause slots are optional: −1 when unbound.
 * The four enrichment slots carry the enriched Autodesk export's migration columns; each is −1, or absent, when unbound.
 */
export interface IssueColumns {
  id: number
  title: number
  status: number
  type: number
  contractor: number
  createdOn: number
  updatedOn: number
  dueDate: number
  createdBy: number
  rootCause: number
  rootCauseCategory: number
  /** BIM360_Created By: the real creator of an issue migrated from BIM 360. */
  bim360CreatedBy?: number
  /** BIM360_Created On: the real created date of a migrated issue. */
  bim360CreatedOn?: number
  /** BIM360_Closed On: the real closed date of a migrated issue. */
  bim360ClosedOn?: number
  /** Closed at: Autodesk's own closed date, used before Updated on. */
  closedAt?: number
  /** Created By (Company): the Filter menu's company value for an issue the include rule doesn't call LotusWorks. */
  createdByCompany?: number
  /** Discipline: a Filter menu field. */
  discipline?: number
  /** Source: bound, the table is QCx Combined, so only BIM rows are issues and Electrical and Mechanical rows feed NCR Pass Rate. */
  source?: number
  /** Row ID: read by nothing, but NCR Pass Rate needs it bound, so Power BI keeps identical inspection rows apart. */
  rowId?: number
  /** Work Week: the inspection rows' week, for NCR Pass Rate. */
  workWeek?: number
  /** Inspection Phase: the inspection rows' phase, for NCR Pass Rate. */
  phase?: number
  /** Issue: the inspection rows' Issue column, for NCR Pass Rate. Not an issue record. */
  issue?: number
}

/**
 * Column positions of each QCx Combined field slot inside a table row, or −1 when the slot isn't bound. The four
 * enrichment columns carry the enriched Autodesk export's BIM360 values and Closed At; each is −1, or absent, when unbound.
 */
export interface CombinedColumns {
  source: number
  workWeek: number
  phase: number
  issue: number
  building: number
  qcr: number
  welder: number
  tagNo: number
  signature: number
  signedWeek: number
  id: number
  status: number
  type: number
  createdOn: number
  updatedOn: number
  createdBy: number
  rootCause: number
  greenTags: number
  bim360CreatedBy?: number
  bim360CreatedOn?: number
  bim360ClosedOn?: number
  closedAt?: number
}

export type IssueStatusKind = 'open' | 'pending' | 'closed' | 'void'

/** Void issues are excluded everywhere, so an indexed issue is never void. */
export type IncludedIssueStatusKind = Exclude<IssueStatusKind, 'void'>

/** One row of the Issue Detail table, formatted once when the index is built. */
export interface IssueDetailRow {
  id: string
  /** The ID's place in numeric-aware ascending order; IDs the collator treats as equal share a rank. Sort on this, not the ID. */
  idRank: number
  subtype: string
  /** The status label; pending displays as Open. */
  status: string
  statusKind: IncludedIssueStatusKind
  title: string
  contractor: string
  /** Created work week label. */
  workWeek: string
  workWeekKey: number
  /** MM/DD/YY */
  createdOn: string
  createdOnTime: number
  /** Closed work week label, `Open` when not closed, blank when closed without a date. */
  workWeekClosed: string
  /** Null when not closed or closed without a date. */
  workWeekClosedKey: number | null
  /** MM/DD/YY, blank when there is no due date. */
  dueDate: string
  dueDateTime: number | null
}

export interface IssueRecord {
  id: string
  title: string
  statusKind: IncludedIssueStatusKind
  subtype: string
  contractor: string
  createdOn: Date
  /** Updated On, or null when blank or unreadable. */
  updatedOn: Date | null
  dueDate: Date | null
  /** Trimmed Root Cause, '' when blank or unbound. */
  rootCause: string
  /** Trimmed Root Cause Category, '' when blank or unbound. */
  rootCauseCategory: string
  createdWeek: WorkWeek
  /** ISO week of Updated On for closed issues that have one, otherwise null. */
  closedWeek: WorkWeek | null
  detail: IssueDetailRow
}

export interface IssueWeekCounts {
  week: WorkWeek
  /** Issues created in this week. */
  opened: number
  /** Closed issues whose closed week is this week. */
  closed: number
}

export interface AgingBucket {
  label: string
  count: number
}

export interface OverallAgingBucket extends AgingBucket {
  closed: number
  open: number
}

/** An open or pending issue in the expanded Open Issue Aging table. */
export interface OpenIssueRow {
  id: string
  /** The ID's place in numeric-aware ascending order; IDs the collator treats as equal share a rank. Sort on this, not the ID. */
  idRank: number
  title: string
  contractor: string
  /** MM/DD/YY */
  createdOn: string
  createdOnTime: number
  ageDays: number
  /** The status label; pending displays as Open. */
  status: string
}

export interface IssueIndex {
  currentWeek: WorkWeek
  /** Noon of the day the index was built for; ages and as-of-week benchmarks are measured to it. */
  today: Date
  /** Included issues created through the current week, sorted by ID descending (numeric-aware). */
  issues: IssueRecord[]
  /** Continuous weeks from the first created or closed week through the current week. Always holds at least one week, the current week. */
  weeks: IssueWeekCounts[]
  /** Parallel to weeks: running totals through each week. */
  cumulativeOpened: number[]
  cumulativeClosed: number[]
  /** Parallel to weeks: issues now closed, by the week they were created, with or without a closed date. */
  closedByCreatedWeek: number[]
  /** Parallel to weeks: the positions, in the rows that built this index, of the rows behind opened. */
  openedRowsByWeek: ReadonlyArray<readonly number[]>
  /** Parallel to weeks: the positions, in the rows that built this index, of the rows behind closed. */
  closedRowsByWeek: ReadonlyArray<readonly number[]>
  positionByKey: Map<number, number>
  /** Open and pending issues by age today. */
  openAging: AgingBucket[]
  /** Every issue by age to its closed date (closed) or today. */
  overallAging: OverallAgingBucket[]
  /** Open and pending issues, oldest first. */
  openIssues: OpenIssueRow[]
  totalRows: number
  /** Included, non-void rows with a blank or unreadable Created On. */
  skippedRows: number
  /** Included, non-void rows created after the current week. */
  futureRows: number
  /** Rows whose Created By is not a LotusWorks creator. */
  excludedRows: number
  /** Whether the optional Root Cause slot is bound. */
  hasRootCause: boolean
  /** Whether the optional Root Cause Category slot is bound. */
  hasRootCauseCategory: boolean
}

export interface IssueCountCard {
  value: number
  delta: number
  tone: DeltaTone
}

export interface ClosureRateCard {
  /** Percent 0–100, or null when no issues were opened through the week. */
  value: number | null
  /** Change in points versus through the previous week, or null when either rate is missing. */
  deltaPoints: number | null
  tone: DeltaTone
}

export interface IssueTrendPoint {
  week: WorkWeek
  opened: number
  closed: number
  /** Cumulative opened minus cumulative closed through this week. */
  remainingOpen: number
}

export interface IssueWindowTotals {
  opened: number
  closed: number
  /** Remaining open at the window end minus remaining open before the window. */
  remainingChange: number
  /**
   * Percent 0–100 through the window end, or null when nothing was opened. In a date range, the share of the issues
   * opened in the range that are now closed.
   */
  closureRate: number | null
  weeks: number
}

/** A date range's Closure Rate, as counts. */
export interface RangeClosure {
  nowClosed: number
  opened: number
}

export interface IssueDetail {
  /** The week the detail is for: the selected week, or the current week when the selected week is not in the data. */
  selectedWeek: WorkWeek
  previousWeek: WorkWeek
  openedThisWeek: number
  closedThisWeek: number
  openedLastWeek: number
  closedLastWeek: number
  /** Issues created or closed in the selected week or the week before, by ID descending. */
  reportRows: IssueDetailRow[]
  /** Every other open or pending issue created through the selected week, by ID descending. */
  discussionRows: IssueDetailRow[]
}

export interface IssueModel {
  selectedWeek: WorkWeek
  previousWeek: WorkWeek
  /** Newest first. */
  weekOptions: WorkWeek[]
  thisWeek: {
    opened: IssueCountCard
    closed: IssueCountCard
  }
  toDate: {
    opened: IssueCountCard
    closed: IssueCountCard
    remaining: IssueCountCard
    closureRate: ClosureRateCard
  }
  trend: IssueTrendPoint[]
  openAging: AgingBucket[]
  overallAging: OverallAgingBucket[]
  openIssues: OpenIssueRow[]
  windowTotals: IssueWindowTotals
  /** Null with no date range. */
  rangeLabel: string | null
  /** Null with no date range. */
  rangeClosure: RangeClosure | null
  hasData: boolean
}
