import type {
  AgingBucket,
  ClosureRateCard,
  IncludedIssueStatusKind,
  InspectionRows,
  IssueColumns,
  IssueCountCard,
  IssueDetail,
  IssueDetailRow,
  IssueIndex,
  IssueModel,
  IssueRecord,
  IssueStatusKind,
  IssueWeekCounts,
  IssueWindowTotals,
  OpenIssueRow,
  OverallAgingBucket,
  RangeClosure,
  ViewState,
  WorkWeek,
} from './types'
import type { DeltaTone } from './format'
import { daysBetween, formatDate, parseDate } from './dates'
import { NAME_COLLATOR, pointsTone } from './format'
import { groupKey as chartGroupKey } from './grouping'
import { cellText, rangePositions, recentWindowStart } from './inspections'
import { cellDisplayText, groupKey, optionalField, type FilterFieldDef, type Row } from './rowFilters'
import { formatWeekRange } from './weekRange'
import { enumerateWorkWeeks, previousWorkWeek, toIsoWorkWeek, workWeekFromKey } from './workWeeks'

export const DEFAULT_CONTRACTOR = 'Unassigned'
export const DEFAULT_SUBTYPE = 'Uncategorized'
export const DEFAULT_TITLE = 'Untitled issue'
export const LOTUSWORKS_COMPANY = 'LotusWorks'

// ACC replaces the company name with "Removed" when these LotusWorks accounts are deactivated.
const REMOVED_LOTUSWORKS_CREATORS: readonly string[] = ['samuel leach', 'aaron harwood']
const TRAILING_DIGITS = /\d+$/
const PREFIX_AND_NUMBER = /^(.*?)(\d+)$/
// Longer digit runs could lose precision as numbers, so they are left to the collator.
const MAX_SORT_DIGITS = 15

function normalizedCreator(value: unknown): string {
  return cellText(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export function isLotusWorksIssueCreator(value: unknown): boolean {
  const creator = normalizedCreator(value)
  if (creator.includes('lotusworks')) return true
  if (!creator.includes('removed')) return false
  return REMOVED_LOTUSWORKS_CREATORS.some((name) => creator.includes(name))
}

export function issueStatusKind(value: unknown): IssueStatusKind {
  const status = cellText(value).toLowerCase()
  if (status === 'void') return 'void'
  if (status === 'closed') return 'closed'
  if (status === 'pending') return 'pending'
  return 'open'
}

const UNASSIGNED_KEY = groupKey(DEFAULT_CONTRACTOR)

/** Unassigned reads as '', the blank value, so blank cells and an Unassigned cell are one value, listed last. */
export function contractorFilterValue(name: string): string {
  return groupKey(name) === UNASSIGNED_KEY ? '' : name
}

/**
 * Contractors for issues whose Contractor cell is blank, keyed by the issue number (the ID's trailing digits). Empty
 * by default, so a blank contractor reads as Unassigned. Pass entries when an export is known to have dropped the
 * contractor on particular issues.
 */
export const NO_CONTRACTOR_OVERRIDES: ReadonlyMap<string, string> = new Map()

export function issueContractor(
  id: unknown,
  contractor: unknown,
  overrides: ReadonlyMap<string, string> = NO_CONTRACTOR_OVERRIDES,
): string {
  const populated = cellText(contractor)
  if (populated) return populated
  if (overrides.size === 0) return DEFAULT_CONTRACTOR
  const number = TRAILING_DIGITS.exec(cellText(id))?.[0]
  return (number === undefined ? undefined : overrides.get(number)) ?? DEFAULT_CONTRACTOR
}

export function issueSubtype(value: unknown): string {
  return cellText(value) || DEFAULT_SUBTYPE
}

export function issueTitle(value: unknown): string {
  return cellText(value) || DEFAULT_TITLE
}

interface ReadDate {
  date: Date
  week: WorkWeek
}

interface DateCaches {
  /** Raw date text → parsed date. Dates repeat heavily across rows. */
  byText: Map<string, ReadDate | null>
  /** Local-noon time → ISO week. */
  weekByTime: Map<number, WorkWeek>
}

function weekOf(date: Date, caches: DateCaches): WorkWeek {
  const time = date.getTime()
  const cached = caches.weekByTime.get(time)
  if (cached !== undefined) return cached
  const week = toIsoWorkWeek(date)
  caches.weekByTime.set(time, week)
  return week
}

function readDate(value: unknown, caches: DateCaches): ReadDate | null {
  if (typeof value !== 'string') {
    const date = parseDate(value)
    return date === null ? null : { date, week: weekOf(date, caches) }
  }
  const cached = caches.byText.get(value)
  if (cached !== undefined) return cached
  const date = parseDate(value)
  const parsed = date === null ? null : { date, week: weekOf(date, caches) }
  caches.byText.set(value, parsed)
  return parsed
}

function isIncludedCreator(value: unknown, cache: Map<string, boolean>): boolean {
  if (typeof value !== 'string') return isLotusWorksIssueCreator(value)
  const cached = cache.get(value)
  if (cached !== undefined) return cached
  const isIncluded = isLotusWorksIssueCreator(value)
  cache.set(value, isIncluded)
  return isIncluded
}

/** A cell the HTML app would read as non-blank text: a Date always is, other values when their text is not blank. */
function isPresent(value: unknown): boolean {
  return value instanceof Date || cellText(value) !== ''
}

/** The enrichment slots' positions, −1 when a slot is unbound or the columns don't carry it. */
interface EnrichmentColumns {
  bim360CreatedBy: number
  bim360CreatedOn: number
  bim360ClosedOn: number
  closedAt: number
}

function enrichmentColumns(columns: IssueColumns): EnrichmentColumns {
  return {
    bim360CreatedBy: columns.bim360CreatedBy ?? -1,
    bim360CreatedOn: columns.bim360CreatedOn ?? -1,
    bim360ClosedOn: columns.bim360ClosedOn ?? -1,
    closedAt: columns.closedAt ?? -1,
  }
}

/**
 * The HTML app's shouldIncludeIssue. An issue migrated from BIM 360 has legacy data (any BIM360 value present), and its
 * BIM360 creator decides. Otherwise Created By decides, and every issue counts when the Created By slot is unbound.
 */
function isIncludedIssue(
  row: ReadonlyArray<unknown>,
  columns: IssueColumns,
  enrichment: EnrichmentColumns,
  cache: Map<string, boolean>,
): boolean {
  const legacyCreatedBy = row[enrichment.bim360CreatedBy]
  const hasLegacyData = isPresent(legacyCreatedBy)
    || isPresent(row[enrichment.bim360CreatedOn])
    || isPresent(row[enrichment.bim360ClosedOn])
  if (hasLegacyData) return isIncludedCreator(legacyCreatedBy, cache)
  if (columns.createdBy < 0) return true
  return isIncludedCreator(row[columns.createdBy], cache)
}

/**
 * Which date opens an issue: the first present of BIM360_Created On and Created On. A present BIM360 value wins even
 * when it doesn't parse, as in the app: the issue is then skipped, not dated.
 */
function createdCell(row: Row, columns: IssueColumns, enrichment: EnrichmentColumns): unknown {
  const legacyCreatedOn = row[enrichment.bim360CreatedOn]
  return isPresent(legacyCreatedOn) ? legacyCreatedOn : row[columns.createdOn]
}

/** Which date closes an issue: the first present of BIM360_Closed On, Closed At and Updated On. */
function closedCell(row: Row, columns: IssueColumns, enrichment: EnrichmentColumns): unknown {
  const legacyClosedOn = row[enrichment.bim360ClosedOn]
  const closedAt = row[enrichment.closedAt]
  return isPresent(legacyClosedOn) ? legacyClosedOn : isPresent(closedAt) ? closedAt : row[columns.updatedOn]
}

function companyOf(row: Row, columns: IssueColumns, enrichment: EnrichmentColumns, cache: Map<string, boolean>): string {
  if (isIncludedIssue(row, columns, enrichment, cache)) return LOTUSWORKS_COMPANY
  return cellText(row[columns.createdByCompany ?? -1])
}

/** The Created By (Company) value: LotusWorks when the include rule says so, else the trimmed company, '' when blank. */
export function issueCompanyOf(row: Row, columns: IssueColumns): string {
  return companyOf(row, columns, enrichmentColumns(columns), new Map())
}

/** What a dashboard needs to rebuild its index when a field filter changes the rows. */
export interface IssueFilterSource {
  rows: InspectionRows
  columns: IssueColumns
  today: Date
}

function hasCompanySlot(columns: IssueColumns): boolean {
  return (columns.createdByCompany ?? -1) >= 0
}

/**
 * A field the dashboard already labels, with its value and key, so the two can't disagree: `N/A` is a value of its
 * own, as it is in the tables. What they show under `blankLabel` reads as '', the blank value, so it's listed last.
 */
function labelledField(id: string, label: string, read: (row: Row) => string, blankLabel: string): FilterFieldDef {
  const blankKey = chartGroupKey(blankLabel)
  return {
    id,
    label,
    read: (row) => {
      const name = read(row)
      return chartGroupKey(name) === blankKey ? '' : name
    },
    groupBy: chartGroupKey,
    blankLabel,
  }
}

function companyField(columns: IssueColumns): FilterFieldDef {
  const enrichment = enrichmentColumns(columns)
  const cache = new Map<string, boolean>()
  return {
    id: 'company',
    label: 'Created By (Company)',
    read: (row) => companyOf(row, columns, enrichment, cache),
    defaultKeys: [groupKey(LOTUSWORKS_COMPANY)],
    hasSelectAll: true,
  }
}

/** The menu's fields, in menu order. Only bound slots appear. Without the company slot the index stays LotusWorks-only. */
export function issueFilterFields(columns: IssueColumns): FilterFieldDef[] {
  const rootCause: FilterFieldDef[] = columns.rootCause < 0
    ? []
    // The Pareto's value and key: blank is its Not recorded bar, and `N/A` is a cause of its own.
    : [{ id: 'rootCause', label: 'Root Cause', read: (row) => cellText(row[columns.rootCause]), groupBy: chartGroupKey }]
  return [
    ...(hasCompanySlot(columns) ? [companyField(columns)] : []),
    labelledField('contractor', 'Contractor', (row) => issueContractor(row[columns.id], row[columns.contractor]), DEFAULT_CONTRACTOR),
    // The sheet's values, so Pending can be picked apart from Open though both count as open on the cards.
    { id: 'status', label: 'Status', read: (row) => cellDisplayText(row[columns.status]) },
    labelledField('type', 'Type', (row) => issueSubtype(row[columns.type]), DEFAULT_SUBTYPE),
    ...optionalField('discipline', 'Discipline', columns.discipline ?? -1),
    ...rootCause,
  ]
}

/**
 * The rows the Filter menu counts and matches. With the company slot bound that's every row, the default keeping the
 * dashboard to LotusWorks. Without it the LotusWorks limit can't be unticked, so only those rows are offered, and the
 * menu's counts agree with what the dashboard shows.
 */
export function issueFilterRows(rows: InspectionRows, columns: IssueColumns): InspectionRows {
  if (hasCompanySlot(columns)) return rows
  const enrichment = enrichmentColumns(columns)
  const cache = new Map<string, boolean>()
  return rows.filter((row) => isIncludedIssue(row, columns, enrichment, cache))
}

/** Reads a row's created week the way the index does, for counting rows in a date range. */
export function issueRowWeekKey(columns: IssueColumns): (row: Row) => number | null {
  const enrichment = enrichmentColumns(columns)
  const caches: DateCaches = { byText: new Map(), weekByTime: new Map() }
  return (row) => readDate(createdCell(row, columns, enrichment), caches)?.week.key ?? null
}

/**
 * The full data's weeks for the menu's From and To: from the first created or closed week of any creator, by the
 * index's own rules, through the current week. Only dates are read, so it's far cheaper than building an index.
 */
export function issueDataWeeks(rows: InspectionRows, columns: IssueColumns, today: Date): WorkWeek[] {
  const currentWeek = toIsoWorkWeek(parseDate(today) ?? today)
  const enrichment = enrichmentColumns(columns)
  const caches: DateCaches = { byText: new Map(), weekByTime: new Map() }
  let first = currentWeek
  for (const row of rows) {
    const statusKind = issueStatusKind(row[columns.status])
    if (statusKind === 'void') continue
    const created = readDate(createdCell(row, columns, enrichment), caches)?.week ?? null
    if (created === null || created.key > currentWeek.key) continue
    if (created.key < first.key) first = created
    if (statusKind !== 'closed') continue
    const closed = readDate(closedCell(row, columns, enrichment), caches)?.week ?? null
    if (closed !== null && closed.key < first.key) first = closed
  }
  return enumerateWorkWeeks(first, currentWeek)
}

interface SortableIssue {
  issue: IssueRecord
  /** The ID before its trailing digits. */
  prefix: string
  /** The ID's trailing digits as a number, or null when it has none (or too many to hold exactly). */
  number: number | null
}

function sortableIssue(issue: IssueRecord): SortableIssue {
  const match = PREFIX_AND_NUMBER.exec(issue.id)
  if (match === null || match[2].length > MAX_SORT_DIGITS) return { issue, prefix: issue.id, number: null }
  return { issue, prefix: match[1], number: Number(match[2]) }
}

/**
 * ID descending, numeric-aware. IDs that share a prefix and differ in their trailing number compare as numbers,
 * which is what the collator would conclude; everything else goes to the collator.
 */
function byIdDescending(a: SortableIssue, b: SortableIssue): number {
  if (a.number !== null && b.number !== null && a.number !== b.number && a.prefix === b.prefix) {
    return b.number - a.number
  }
  return NAME_COLLATOR.compare(b.issue.id, a.issue.id)
}

/**
 * Numbers the detail rows by ID ascending, so tables sort IDs as numbers instead of calling the collator per
 * comparison. Walks the ID-descending list from its end; neighbours the collator treats as equal share a rank.
 */
function assignIdRanks(sorted: SortableIssue[]): void {
  let rank = 0
  for (let position = sorted.length - 1; position >= 0; position -= 1) {
    const current = sorted[position]
    const previous = position < sorted.length - 1 ? sorted[position + 1] : null
    if (previous !== null && current.issue.id !== previous.issue.id && byIdDescending(previous, current) !== 0) rank += 1
    current.issue.detail.idRank = rank
  }
}

function buildOpenAging(issues: IssueRecord[], today: Date): AgingBucket[] {
  const buckets: AgingBucket[] = [
    { label: '0-1', count: 0 },
    { label: '1-2', count: 0 },
    { label: '2-3', count: 0 },
    { label: '3-4', count: 0 },
    { label: '4+', count: 0 },
  ]
  for (const issue of issues) {
    if (issue.statusKind === 'closed') continue
    // One bucket per whole week of age, the last one open-ended.
    const weeksOld = Math.floor(daysBetween(issue.createdOn, today) / 7)
    buckets[Math.min(weeksOld, buckets.length - 1)].count += 1
  }
  return buckets
}

function buildOverallAging(issues: IssueRecord[], today: Date): OverallAgingBucket[] {
  const buckets: OverallAgingBucket[] = [
    { label: '0-14 Days', count: 0, closed: 0, open: 0 },
    { label: '14-28 Days', count: 0, closed: 0, open: 0 },
    { label: '28+ Days', count: 0, closed: 0, open: 0 },
  ]
  for (const issue of issues) {
    const isClosed = issue.statusKind === 'closed'
    const end = isClosed && issue.updatedOn !== null ? issue.updatedOn : today
    const age = daysBetween(issue.createdOn, end)
    const bucket = age < 14 ? buckets[0] : age < 28 ? buckets[1] : buckets[2]
    bucket.count += 1
    if (isClosed) bucket.closed += 1
    else bucket.open += 1
  }
  return buckets
}

/** Open and pending issues, oldest first, ties by ID ascending. `issues` is sorted by ID descending. */
function buildOpenIssues(issues: IssueRecord[], today: Date): OpenIssueRow[] {
  const rows: OpenIssueRow[] = []
  for (let position = issues.length - 1; position >= 0; position -= 1) {
    const issue = issues[position]
    if (issue.statusKind === 'closed') continue
    rows.push({
      id: issue.id,
      idRank: issue.detail.idRank,
      title: issue.title,
      contractor: issue.contractor,
      createdOn: issue.detail.createdOn,
      createdOnTime: issue.detail.createdOnTime,
      ageDays: daysBetween(issue.createdOn, today),
      status: issue.detail.status,
    })
  }
  // Array sort is stable, so equal dates keep ID ascending order.
  return rows.sort((a, b) => a.createdOnTime - b.createdOnTime)
}

/** One issue, read once by the index and again for a week's list, so the two can't disagree. */
function readIssueRecord(
  row: Row,
  columns: IssueColumns,
  statusKind: IncludedIssueStatusKind,
  created: ReadDate,
  updated: ReadDate | null,
  caches: DateCaches,
): IssueRecord {
  const closedWeek = statusKind === 'closed' && updated !== null ? updated.week : null
  const id = cellText(row[columns.id])
  const title = issueTitle(row[columns.title])
  const subtype = issueSubtype(row[columns.type])
  const contractor = issueContractor(id, row[columns.contractor])
  const dueDate = readDate(row[columns.dueDate], caches)?.date ?? null
  const detail: IssueDetailRow = {
    id,
    // Set once every issue is sorted by ID.
    idRank: 0,
    subtype,
    // Pending displays as Open, and so does a blank status.
    status: statusKind === 'pending' ? 'Open' : cellText(row[columns.status]) || 'Open',
    statusKind,
    title,
    contractor,
    workWeek: created.week.label,
    workWeekKey: created.week.key,
    createdOn: formatDate(created.date),
    createdOnTime: created.date.getTime(),
    workWeekClosed: statusKind === 'closed' ? (closedWeek?.label ?? '') : 'Open',
    workWeekClosedKey: closedWeek?.key ?? null,
    dueDate: formatDate(dueDate),
    dueDateTime: dueDate?.getTime() ?? null,
  }
  return {
    id,
    title,
    statusKind,
    subtype,
    contractor,
    createdOn: created.date,
    updatedOn: updated?.date ?? null,
    dueDate,
    // An unbound slot is −1, and row[-1] is undefined, which reads as ''.
    rootCause: cellText(row[columns.rootCause]),
    rootCauseCategory: cellText(row[columns.rootCauseCategory]),
    createdWeek: created.week,
    closedWeek,
    detail,
  }
}

/**
 * Reads a row as Issue Detail shows it, for a week's list; null for a row the index leaves out (void or undated).
 * `idRank` isn't set: the list sorts IDs in collator order. A row is read once however many cells ask for it.
 */
export function createIssueDetailReader(columns: IssueColumns): (row: Row) => IssueDetailRow | null {
  const enrichment = enrichmentColumns(columns)
  const caches: DateCaches = { byText: new Map(), weekByTime: new Map() }
  const details = new WeakMap<Row, IssueDetailRow | null>()
  function read(row: Row): IssueDetailRow | null {
    const statusKind = issueStatusKind(row[columns.status])
    if (statusKind === 'void') return null
    const created = readDate(createdCell(row, columns, enrichment), caches)
    if (created === null) return null
    const updated = readDate(closedCell(row, columns, enrichment), caches)
    return readIssueRecord(row, columns, statusKind, created, updated, caches).detail
  }
  return (row) => {
    const known = details.get(row)
    if (known !== undefined) return known
    const detail = read(row)
    details.set(row, detail)
    return detail
  }
}

export interface BuildIssueIndexOptions {
  /** Counts every creator instead of only LotusWorks-created issues. Void and undated exclusions are unchanged. */
  includeAllCreators?: boolean
  /** The axis starts here when that is before the first data week, so a filtered index never shortens the axis. */
  axisFromKey?: number
}

interface IssueWeekBucket extends IssueWeekCounts {
  openedRows: number[]
  closedRows: number[]
  /** Issues created this week that are closed now. */
  nowClosed: number
}

const NO_ROWS: readonly number[] = []

export function buildIssueIndex(
  rows: InspectionRows,
  columns: IssueColumns,
  today: Date,
  options: BuildIssueIndexOptions = {},
): IssueIndex {
  const { includeAllCreators = false, axisFromKey } = options
  const todayNoon = parseDate(today) ?? today
  const currentWeek = toIsoWorkWeek(todayNoon)
  const caches: DateCaches = { byText: new Map(), weekByTime: new Map() }
  const creatorCache = new Map<string, boolean>()
  const enrichment = enrichmentColumns(columns)
  const buckets = new Map<number, IssueWeekBucket>()
  const issues: IssueRecord[] = []
  let excludedRows = 0
  let skippedRows = 0
  let futureRows = 0
  let firstWeek: WorkWeek | null = null

  const bucketFor = (week: WorkWeek): IssueWeekBucket => {
    let bucket = buckets.get(week.key)
    if (!bucket) {
      bucket = { week, opened: 0, closed: 0, openedRows: [], closedRows: [], nowClosed: 0 }
      buckets.set(week.key, bucket)
    }
    return bucket
  }

  for (let rowPosition = 0; rowPosition < rows.length; rowPosition += 1) {
    const row = rows[rowPosition]
    if (!includeAllCreators && !isIncludedIssue(row, columns, enrichment, creatorCache)) {
      excludedRows += 1
      continue
    }
    const statusKind = issueStatusKind(row[columns.status])
    if (statusKind === 'void') continue

    const created = readDate(createdCell(row, columns, enrichment), caches)
    if (created === null) {
      skippedRows += 1
      continue
    }
    if (created.week.key > currentWeek.key) {
      futureRows += 1
      continue
    }
    if (!firstWeek || created.week.key < firstWeek.key) firstWeek = created.week

    const updated = readDate(closedCell(row, columns, enrichment), caches)
    const record = readIssueRecord(row, columns, statusKind, created, updated, caches)
    const { closedWeek } = record
    // A closed week after the current week is not counted in any week.
    const countedClosedWeek = closedWeek !== null && closedWeek.key <= currentWeek.key ? closedWeek : null
    if (countedClosedWeek !== null && countedClosedWeek.key < firstWeek.key) firstWeek = countedClosedWeek
    issues.push(record)

    const createdBucket = bucketFor(created.week)
    createdBucket.opened += 1
    createdBucket.openedRows.push(rowPosition)
    if (statusKind === 'closed') createdBucket.nowClosed += 1
    if (countedClosedWeek !== null) {
      const closedBucket = bucketFor(countedClosedWeek)
      closedBucket.closed += 1
      closedBucket.closedRows.push(rowPosition)
    }
  }

  const sorted = issues.map(sortableIssue).sort(byIdDescending)
  for (let position = 0; position < sorted.length; position += 1) issues[position] = sorted[position].issue
  assignIdRanks(sorted)

  const weeks: IssueWeekCounts[] = []
  const cumulativeOpened: number[] = []
  const cumulativeClosed: number[] = []
  const closedByCreatedWeek: number[] = []
  const openedRowsByWeek: Array<readonly number[]> = []
  const closedRowsByWeek: Array<readonly number[]> = []
  const positionByKey = new Map<number, number>()
  let opened = 0
  let closed = 0

  const dataStart = firstWeek ?? currentWeek
  const axisStart = axisFromKey !== undefined && axisFromKey < dataStart.key ? workWeekFromKey(axisFromKey) : dataStart

  for (const week of enumerateWorkWeeks(axisStart, currentWeek)) {
    const bucket = buckets.get(week.key)
    const counts: IssueWeekCounts = { week, opened: bucket?.opened ?? 0, closed: bucket?.closed ?? 0 }
    opened += counts.opened
    closed += counts.closed
    positionByKey.set(week.key, weeks.length)
    weeks.push(counts)
    cumulativeOpened.push(opened)
    cumulativeClosed.push(closed)
    closedByCreatedWeek.push(bucket?.nowClosed ?? 0)
    openedRowsByWeek.push(bucket?.openedRows ?? NO_ROWS)
    closedRowsByWeek.push(bucket?.closedRows ?? NO_ROWS)
  }

  return {
    currentWeek,
    today: todayNoon,
    issues,
    weeks,
    cumulativeOpened,
    cumulativeClosed,
    closedByCreatedWeek,
    openedRowsByWeek,
    closedRowsByWeek,
    positionByKey,
    openAging: buildOpenAging(issues, todayNoon),
    overallAging: buildOverallAging(issues, todayNoon),
    openIssues: buildOpenIssues(issues, todayNoon),
    totalRows: rows.length,
    skippedRows,
    futureRows,
    excludedRows,
    hasRootCause: columns.rootCause >= 0,
    hasRootCauseCategory: columns.rootCauseCategory >= 0,
  }
}

/** Bad when the count rises, good when it falls. */
export function riseIsBad(delta: number): DeltaTone {
  if (delta > 0) return 'bad'
  if (delta < 0) return 'good'
  return 'neutral'
}

function countCard(value: number, previous: number, tone: DeltaTone): IssueCountCard {
  return { value, delta: value - previous, tone }
}

export function closureRateAt(index: IssueIndex, position: number): number | null {
  if (position < 0) return null
  const opened = index.cumulativeOpened[position]
  return opened === 0 ? null : (index.cumulativeClosed[position] / opened) * 100
}

function closureRateCard(index: IssueIndex, position: number): ClosureRateCard {
  const value = closureRateAt(index, position)
  const previous = closureRateAt(index, position - 1)
  const deltaPoints = value !== null && previous !== null ? value - previous : null
  return { value, deltaPoints, tone: pointsTone(deltaPoints) }
}

function cumulativeAt(cumulative: number[], position: number): number {
  return position < 0 ? 0 : cumulative[position]
}

/** The Issue Detail overlay for the selected week. Built only while the overlay is open: it walks every issue. */
export function buildIssueDetail(index: IssueIndex, selectedKey: number): IssueDetail {
  const selectedPosition = index.positionByKey.get(selectedKey) ?? index.weeks.length - 1
  const selected = index.weeks[selectedPosition]
  const previous = selectedPosition > 0 ? index.weeks[selectedPosition - 1] : null
  const weekKey = selected.week.key
  const previousWeek = previousWorkWeek(selected.week)
  const previousKey = previousWeek.key
  const reportRows: IssueDetailRow[] = []
  const discussionRows: IssueDetailRow[] = []
  // index.issues is sorted by ID descending, so both blocks come out in that order.
  for (const issue of index.issues) {
    const createdKey = issue.createdWeek.key
    // The detail is as of the selected week, so issues created after it are left out.
    if (createdKey > weekKey) continue
    const closedKey = issue.closedWeek?.key
    const isReport = createdKey === weekKey || createdKey === previousKey || closedKey === weekKey || closedKey === previousKey
    if (isReport) reportRows.push(issue.detail)
    else if (issue.statusKind !== 'closed') discussionRows.push(issue.detail)
  }
  return {
    selectedWeek: selected.week,
    previousWeek,
    openedThisWeek: selected.opened,
    closedThisWeek: selected.closed,
    openedLastWeek: previous?.opened ?? 0,
    closedLastWeek: previous?.closed ?? 0,
    reportRows,
    discussionRows,
  }
}

function rangeClosureOf(index: IssueIndex, start: number, end: number, opened: number): RangeClosure {
  let nowClosed = 0
  for (let position = start; position <= end; position += 1) nowClosed += index.closedByCreatedWeek[position]
  return { nowClosed, opened }
}

export function buildIssueModel(index: IssueIndex, view: ViewState): IssueModel {
  const lastPosition = index.weeks.length - 1
  // In a date range the window is the range's weeks.
  const span = view.dateRange === null ? null : rangePositions(index, view.dateRange)
  const endPosition = span?.end ?? index.positionByKey.get(view.windowEndKey) ?? lastPosition
  const startPosition = span?.start ?? (view.range === 'all' ? 0 : recentWindowStart(endPosition))
  const knownSelected = index.positionByKey.get(view.selectedKey) ?? lastPosition
  const selectedPosition = span === null ? knownSelected : Math.min(Math.max(knownSelected, span.start), span.end)
  const selected = index.weeks[selectedPosition]
  const previous = selectedPosition > 0 ? index.weeks[selectedPosition - 1] : null
  const { cumulativeOpened, cumulativeClosed } = index
  const remainingAt = (position: number): number =>
    cumulativeAt(cumulativeOpened, position) - cumulativeAt(cumulativeClosed, position)

  const openedInWeek = selected.opened
  const closedInWeek = selected.closed
  const openedInPreviousWeek = previous?.opened ?? 0
  const closedInPreviousWeek = previous?.closed ?? 0
  const remainingChangeInWeek = remainingAt(selectedPosition) - remainingAt(selectedPosition - 1)

  const openedInWindow = cumulativeOpened[endPosition] - cumulativeAt(cumulativeOpened, startPosition - 1)
  const closedInWindow = cumulativeClosed[endPosition] - cumulativeAt(cumulativeClosed, startPosition - 1)
  const rangeClosure = span === null ? null : rangeClosureOf(index, span.start, span.end, openedInWindow)
  // Closed ÷ opened over a range could pass 100%, so a range reads the share of its own opened issues now closed.
  const rangeRate = rangeClosure === null || rangeClosure.opened === 0 ? null : (rangeClosure.nowClosed / rangeClosure.opened) * 100

  const windowTotals: IssueWindowTotals = {
    opened: openedInWindow,
    closed: closedInWindow,
    remainingChange: remainingAt(endPosition) - remainingAt(startPosition - 1),
    closureRate: span === null ? closureRateAt(index, endPosition) : rangeRate,
    weeks: endPosition - startPosition + 1,
  }

  const opened = span === null ? cumulativeOpened[selectedPosition] : openedInWindow
  const closed = span === null ? cumulativeClosed[selectedPosition] : closedInWindow
  // The open count at the range's end. It isn't restated to the range, because that could go negative.
  const remaining = remainingAt(span === null ? selectedPosition : endPosition)
  const previousOpened = opened - openedInWeek
  const previousClosed = closed - closedInWeek
  const previousRemaining = remaining - remainingChangeInWeek

  return {
    selectedWeek: selected.week,
    previousWeek: previousWorkWeek(selected.week),
    weekOptions: (span === null ? index.weeks : index.weeks.slice(span.start, span.end + 1)).map((item) => item.week).reverse(),
    thisWeek: {
      opened: countCard(openedInWeek, openedInPreviousWeek, openedInWeek > openedInPreviousWeek ? 'warn' : 'neutral'),
      // Good when at least as many closed as the week before, but a week with nothing closed is never good.
      closed: countCard(closedInWeek, closedInPreviousWeek, closedInWeek > 0 && closedInWeek >= closedInPreviousWeek ? 'good' : 'neutral'),
    },
    toDate: {
      opened: countCard(opened, previousOpened, riseIsBad(opened - previousOpened)),
      closed: countCard(closed, previousClosed, closed > previousClosed ? 'good' : 'neutral'),
      remaining: countCard(remaining, previousRemaining, riseIsBad(remaining - previousRemaining)),
      closureRate: span === null ? closureRateCard(index, selectedPosition) : { value: rangeRate, deltaPoints: null, tone: pointsTone(null) },
    },
    trend: index.weeks.slice(startPosition, endPosition + 1).map((counts, offset) => ({
      week: counts.week,
      opened: counts.opened,
      closed: counts.closed,
      remainingOpen: remainingAt(startPosition + offset),
    })),
    openAging: index.openAging,
    overallAging: index.overallAging,
    openIssues: index.openIssues,
    windowTotals,
    rangeLabel: view.dateRange === null ? null : formatWeekRange(view.dateRange),
    rangeClosure,
    // A quiet range with issues still open has real numbers: its Remaining Open and the Aging charts.
    hasData: span === null ? cumulativeOpened[lastPosition] > 0 : openedInWindow + closedInWindow > 0 || remainingAt(endPosition) > 0,
  }
}
