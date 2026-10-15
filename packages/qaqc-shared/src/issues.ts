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
  ViewState,
  WorkWeek,
} from './types'
import type { DeltaTone } from './format'
import { daysBetween, formatDate, parseDate } from './dates'
import { NAME_COLLATOR, roundPoints } from './format'
import { cellText, RECENT_WEEK_COUNT } from './inspections'
import { enumerateWorkWeeks, previousWorkWeek, toIsoWorkWeek } from './workWeeks'

export const DEFAULT_CONTRACTOR = 'Unassigned'
export const ISSUE_1021_CONTRACTOR = 'Bayside'
export const DEFAULT_SUBTYPE = 'Uncategorized'
export const DEFAULT_DISCIPLINE = 'Unassigned'
export const DEFAULT_TITLE = 'Untitled issue'

// ACC replaces the company name with "Removed" when these LotusWorks accounts are deactivated.
const REMOVED_LOTUSWORKS_CREATORS: readonly string[] = ['samuel leach', 'aaron harwood']
const TRAILING_DIGITS = /\d+$/

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

export function issueStatusLabel(value: unknown): string {
  const status = cellText(value)
  if (!status) return 'Open'
  return issueStatusKind(status) === 'pending' ? 'Pending' : status
}

export function issueContractor(id: unknown, contractor: unknown): string {
  const populated = cellText(contractor)
  if (populated) return populated
  return TRAILING_DIGITS.exec(cellText(id))?.[0] === '1021' ? ISSUE_1021_CONTRACTOR : DEFAULT_CONTRACTOR
}

export function issueSubtype(value: unknown): string {
  return cellText(value) || DEFAULT_SUBTYPE
}

export function issueDiscipline(value: unknown): string {
  return cellText(value) || DEFAULT_DISCIPLINE
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

function displayStatus(status: string, kind: IncludedIssueStatusKind): string {
  return kind === 'pending' ? 'Open' : status
}

function detailRow(record: Omit<IssueRecord, 'detail'>): IssueDetailRow {
  let workWeekClosed = 'Open'
  if (record.statusKind === 'closed') workWeekClosed = record.closedWeek?.label ?? ''
  return {
    id: record.id,
    subtype: record.subtype,
    status: displayStatus(record.status, record.statusKind),
    statusKind: record.statusKind,
    title: record.title,
    contractor: record.contractor,
    workWeek: record.createdWeek.label,
    workWeekKey: record.createdWeek.key,
    createdOn: formatDate(record.createdOn),
    createdOnTime: record.createdOn.getTime(),
    workWeekClosed,
    workWeekClosedKey: record.closedWeek?.key ?? null,
    dueDate: formatDate(record.dueDate),
    dueDateTime: record.dueDate?.getTime() ?? null,
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

export function buildIssueIndex(rows: InspectionRows, columns: IssueColumns, today: Date): IssueIndex {
  const todayNoon = parseDate(today) ?? today
  const currentWeek = toIsoWorkWeek(todayNoon)
  const caches: DateCaches = { byText: new Map(), weekByTime: new Map() }
  const creatorCache = new Map<string, boolean>()
  const buckets = new Map<number, IssueWeekCounts>()
  const issues: IssueRecord[] = []
  let excludedRows = 0
  let skippedRows = 0
  let futureRows = 0
  let firstWeek: WorkWeek | null = null

  const bucketFor = (week: WorkWeek): IssueWeekCounts => {
    let bucket = buckets.get(week.key)
    if (!bucket) {
      bucket = { week, opened: 0, closed: 0 }
      buckets.set(week.key, bucket)
    }
    return bucket
  }

  for (const row of rows) {
    if (!isIncludedCreator(row[columns.createdBy], creatorCache)) {
      excludedRows += 1
      continue
    }
    const statusKind = issueStatusKind(row[columns.status])
    if (statusKind === 'void') continue

    const created = readDate(row[columns.createdOn], caches)
    if (created === null) {
      skippedRows += 1
      continue
    }
    if (created.week.key > currentWeek.key) {
      futureRows += 1
      continue
    }
    if (!firstWeek || created.week.key < firstWeek.key) firstWeek = created.week

    const updated = readDate(row[columns.updatedOn], caches)
    const closedWeek = statusKind === 'closed' && updated !== null ? updated.week : null

    const id = cellText(row[columns.id])
    const record: Omit<IssueRecord, 'detail'> = {
      id,
      title: issueTitle(row[columns.title]),
      status: issueStatusLabel(row[columns.status]),
      statusKind,
      subtype: issueSubtype(row[columns.type]),
      contractor: issueContractor(id, row[columns.contractor]),
      discipline: issueDiscipline(row[columns.discipline]),
      createdOn: created.date,
      updatedOn: updated?.date ?? null,
      dueDate: readDate(row[columns.dueDate], caches)?.date ?? null,
      createdWeek: created.week,
      closedWeek,
    }
    issues.push({ ...record, detail: detailRow(record) })

    bucketFor(created.week).opened += 1
    // A closed week after the current week is not counted in any week.
    if (closedWeek !== null && closedWeek.key <= currentWeek.key) bucketFor(closedWeek).closed += 1
  }

  issues.sort((a, b) => NAME_COLLATOR.compare(b.id, a.id))

  const weeks: IssueWeekCounts[] = []
  const cumulativeOpened: number[] = []
  const cumulativeClosed: number[] = []
  const positionByKey = new Map<number, number>()
  let opened = 0
  let closed = 0

  for (const week of enumerateWorkWeeks(firstWeek ?? currentWeek, currentWeek)) {
    const bucket = buckets.get(week.key)
    const counts: IssueWeekCounts = { week, opened: bucket?.opened ?? 0, closed: bucket?.closed ?? 0 }
    opened += counts.opened
    closed += counts.closed
    positionByKey.set(week.key, weeks.length)
    weeks.push(counts)
    cumulativeOpened.push(opened)
    cumulativeClosed.push(closed)
  }

  return {
    currentWeek,
    issues,
    weeks,
    cumulativeOpened,
    cumulativeClosed,
    positionByKey,
    openAging: buildOpenAging(issues, todayNoon),
    overallAging: buildOverallAging(issues, todayNoon),
    openIssues: buildOpenIssues(issues, todayNoon),
    totalRows: rows.length,
    skippedRows,
    futureRows,
    excludedRows,
  }
}

/** Bad when the count rises, good when it falls. */
function riseIsBad(delta: number): DeltaTone {
  if (delta > 0) return 'bad'
  if (delta < 0) return 'good'
  return 'neutral'
}

function countCard(value: number, previous: number, tone: DeltaTone): IssueCountCard {
  return { value, delta: value - previous, tone }
}

function closureRateAt(index: IssueIndex, position: number): number | null {
  if (position < 0) return null
  const opened = index.cumulativeOpened[position]
  return opened === 0 ? null : (index.cumulativeClosed[position] / opened) * 100
}

function closureRateCard(index: IssueIndex, position: number): ClosureRateCard {
  const value = closureRateAt(index, position)
  const previous = closureRateAt(index, position - 1)
  const deltaPoints = value !== null && previous !== null ? value - previous : null
  let tone: DeltaTone = 'neutral'
  if (deltaPoints !== null && roundPoints(deltaPoints) > 0) tone = 'good'
  if (deltaPoints !== null && roundPoints(deltaPoints) < 0) tone = 'bad'
  return { value, deltaPoints, tone }
}

function cumulativeAt(cumulative: number[], position: number): number {
  return position < 0 ? 0 : cumulative[position]
}

function buildDetail(index: IssueIndex, selected: IssueWeekCounts, previous: IssueWeekCounts | null): IssueDetail {
  const weekKey = selected.week.key
  const previousKey = previousWorkWeek(selected.week).key
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
    openedThisWeek: selected.opened,
    closedThisWeek: selected.closed,
    openedLastWeek: previous?.opened ?? 0,
    closedLastWeek: previous?.closed ?? 0,
    reportRows,
    discussionRows,
  }
}

export function buildIssueModel(index: IssueIndex, view: ViewState): IssueModel {
  const lastPosition = index.weeks.length - 1
  const selectedPosition = index.positionByKey.get(view.selectedKey) ?? lastPosition
  const endPosition = index.positionByKey.get(view.windowEndKey) ?? lastPosition
  const startPosition = view.range === 'all' ? 0 : Math.max(0, endPosition - RECENT_WEEK_COUNT + 1)
  const selected = index.weeks[selectedPosition]
  const previous = selectedPosition > 0 ? index.weeks[selectedPosition - 1] : null
  const { cumulativeOpened, cumulativeClosed } = index

  const opened = cumulativeOpened[selectedPosition]
  const closed = cumulativeClosed[selectedPosition]
  const previousOpened = cumulativeAt(cumulativeOpened, selectedPosition - 1)
  const previousClosed = cumulativeAt(cumulativeClosed, selectedPosition - 1)
  const remaining = opened - closed
  const previousRemaining = previousOpened - previousClosed
  const openedInWeek = selected.opened
  const closedInWeek = selected.closed
  const openedInPreviousWeek = previous?.opened ?? 0
  const closedInPreviousWeek = previous?.closed ?? 0

  const remainingAt = (position: number): number =>
    cumulativeAt(cumulativeOpened, position) - cumulativeAt(cumulativeClosed, position)
  const windowTotals: IssueWindowTotals = {
    opened: cumulativeOpened[endPosition] - cumulativeAt(cumulativeOpened, startPosition - 1),
    closed: cumulativeClosed[endPosition] - cumulativeAt(cumulativeClosed, startPosition - 1),
    remainingChange: remainingAt(endPosition) - remainingAt(startPosition - 1),
    closureRate: closureRateAt(index, endPosition),
    weeks: endPosition - startPosition + 1,
  }

  return {
    selectedWeek: selected.week,
    previousWeek: previousWorkWeek(selected.week),
    weekOptions: index.weeks.map((item) => item.week).reverse(),
    thisWeek: {
      opened: countCard(openedInWeek, openedInPreviousWeek, openedInWeek > openedInPreviousWeek ? 'warn' : 'neutral'),
      closed: countCard(closedInWeek, closedInPreviousWeek, closedInWeek >= closedInPreviousWeek ? 'good' : 'neutral'),
    },
    toDate: {
      opened: countCard(opened, previousOpened, riseIsBad(opened - previousOpened)),
      closed: countCard(closed, previousClosed, 'good'),
      remaining: countCard(remaining, previousRemaining, riseIsBad(remaining - previousRemaining)),
      closureRate: closureRateCard(index, selectedPosition),
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
    detail: buildDetail(index, selected, previous),
    windowTotals,
    hasData: cumulativeOpened[lastPosition] > 0,
  }
}
