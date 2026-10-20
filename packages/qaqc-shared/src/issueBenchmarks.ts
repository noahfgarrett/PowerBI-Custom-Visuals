import type { IssueIndex, IssueRecord, ViewState, WorkWeek } from './types'
import { parseDate } from './dates'
import { recentWindowStart } from './inspections'
import { MS_PER_DAY, previousWorkWeek } from './workWeeks'

// Close-time benchmarks and open-issue ages as of a week W, shared by QCx BIM Issues and QCx Overview so their numbers
// always agree. The rules are ported from the mockup's compute2.py: the end of W is its Sunday but never later than
// today; an issue is open as of W when it was created by then and not closed by then (a Closed issue without an
// Updated On never counts as closed); typical is the median close time and the window its nearest-rank 90th percentile.

export interface OpenIssueAge {
  issue: IssueRecord
  /** Days from Created On to the end of W. */
  age: number
  /** Age ÷ the normal close window, or null without a window (no closures, or a window of 0 days). */
  timesWindow: number | null
}

export interface IssueBenchmarks {
  asOf: WorkWeek
  /** Closed issues with a closed date on or before the end of W. */
  closures: number
  /** Median days to close. Null without closures. */
  typical: number | null
  /** The normal close window: the 90th percentile of days to close. Null without closures. */
  window: number | null
  /** The longest days to close. Null without closures. */
  slowest: number | null
  /** Issues open as of W, oldest first, ties by ID ascending. */
  open: OpenIssueAge[]
  /** Open issues older than the window. */
  pastWindow: number
  /** Open issues older than the slowest close. */
  olderThanAny: number
  medianOpenAge: number | null
  /** Open as of W minus open as of the week before. */
  openDelta: number
  /** Closed issues without an Updated On: left out of close times, and counted as open. */
  closedWithoutDate: number
}

/** `neutral` when there is no window to compare with. */
export type AgeBucketTone = 'good' | 'warn' | 'bad' | 'neutral'

export interface AgeBucket {
  /** Stable for the bucket's day range, such as `30-77` or `365+`. */
  key: string
  /** Such as `1 month – 77 days`. */
  label: string
  /** Such as `30–77 days`. */
  range: string
  count: number
  /** Good inside the window, bad past it, warn when the bucket straddles its edge. */
  tone: AgeBucketTone
  /** Oldest first. */
  issues: OpenIssueAge[]
}

export interface ProfilePoint {
  week: WorkWeek
  /** Median age of the issues open as of the week, or null when none were open. */
  median: number | null
  open: number
}

export interface QuarterPoint {
  /** year × 4 + quarter index, so consecutive quarters have consecutive keys. */
  key: number
  /** Such as `Q3'26`. */
  label: string
  /** Median days to close of the quarter's closures, or null when none closed. */
  median: number | null
  closed: number
  slowest: number | null
}

/** Nearest-rank percentile of an ascending list (compute2.py `nearest_rank`), or null when it is empty. */
export function quantile(sorted: ArrayLike<number>, p: number): number | null {
  if (sorted.length === 0) return null
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)]
}

/** Median of an ascending list, averaging the middle two of an even count (Python `statistics.median`). */
export function median(sorted: ArrayLike<number>): number | null {
  const count = sorted.length
  if (count === 0) return null
  const middle = Math.floor(count / 2)
  return count % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

/** The Sunday of an ISO week at local noon, but never later than today: the current week is still running. */
export function endOfWeek(week: WorkWeek, today: Date): Date {
  const january4 = new Date(week.year, 0, 4, 12)
  const mondayOfWeek1 = 4 - ((january4.getDay() + 6) % 7)
  const sunday = new Date(week.year, 0, mondayOfWeek1 + (week.week - 1) * 7 + 6, 12)
  const todayNoon = parseDate(today) ?? today
  return sunday.getTime() > todayNoon.getTime() ? todayNoon : sunday
}

/** Whole days since 1970-01-01 for the date's calendar day, so day differences match `daysBetween`. */
function dayNumber(date: Date): number {
  return Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MS_PER_DAY)
}

function quarterKeyOfDay(day: number): number {
  const date = new Date(day * MS_PER_DAY)
  return date.getUTCFullYear() * 4 + Math.floor(date.getUTCMonth() / 3)
}

/** Day numbers for every issue, computed once per index so each as-of call is a linear pass. */
interface IssueDays {
  /** Included issues oldest first by Created On, ties by ID ascending. */
  issues: IssueRecord[]
  /** Parallel to `issues`. */
  created: Int32Array
  /** Parallel to `issues`: the closed day, never before the created day, or NOT_CLOSED. */
  closed: Float64Array
  /** Parallel to `issues`: the issue's place in ID order, ascending and numeric-aware. */
  idRank: Int32Array
  /** Parallel to `issues`: the quarter key of the closed day. Only set for closed issues. */
  closedQuarter: Int32Array
  /** Positions in `issues` of the issues with a closed day, by closed day ascending. */
  byClosed: Int32Array
  closedWithoutDate: number
}

/** The closed day of an issue that is not closed, or Closed without an Updated On. */
const NOT_CLOSED = Number.POSITIVE_INFINITY
const issueDaysByIndex = new WeakMap<IssueIndex, IssueDays>()

/**
 * Orders `count` items by an integer day, ties by position, with one native numeric sort. Each sort key is
 * day × count + position, which stays an exact integer far below 2^53 for any real date and row count.
 */
function orderByDay(count: number, dayAt: (position: number) => number): Int32Array {
  const keys = new Float64Array(count)
  for (let position = 0; position < count; position += 1) keys[position] = dayAt(position) * count + position
  keys.sort()
  const order = new Int32Array(count)
  for (let at = 0; at < count; at += 1) {
    const key = keys[at]
    order[at] = key - Math.floor(key / count) * count
  }
  return order
}

function issueDays(index: IssueIndex): IssueDays {
  const cached = issueDaysByIndex.get(index)
  if (cached !== undefined) return cached

  // index.issues is sorted by ID descending; reverse it so ties on the created day keep ID ascending order.
  const byId = index.issues
  const count = byId.length
  const idAscending = (position: number): IssueRecord => byId[count - 1 - position]
  // Dates repeat heavily across issues, so each distinct date's day number and quarter is worked out once.
  const dayByTime = new Map<number, number>()
  const dayOf = (date: Date): number => {
    const time = date.getTime()
    let day = dayByTime.get(time)
    if (day === undefined) {
      day = dayNumber(date)
      dayByTime.set(time, day)
    }
    return day
  }
  const quarterByDay = new Map<number, number>()
  const quarterOf = (day: number): number => {
    let quarter = quarterByDay.get(day)
    if (quarter === undefined) {
      quarter = quarterKeyOfDay(day)
      quarterByDay.set(day, quarter)
    }
    return quarter
  }

  const createdById = new Int32Array(count)
  for (let position = 0; position < count; position += 1) createdById[position] = dayOf(idAscending(position).createdOn)
  const createdOrder = orderByDay(count, (position) => createdById[position])

  const issues: IssueRecord[] = new Array<IssueRecord>(count)
  const created = new Int32Array(count)
  const closed = new Float64Array(count)
  const closedQuarter = new Int32Array(count)
  let closedWithDate = 0
  let closedWithoutDate = 0
  for (let at = 0; at < count; at += 1) {
    const position = createdOrder[at]
    const issue = idAscending(position)
    issues[at] = issue
    created[at] = createdById[position]
    closed[at] = NOT_CLOSED
    if (issue.statusKind !== 'closed') continue
    if (issue.updatedOn === null) {
      closedWithoutDate += 1
      continue
    }
    // An issue cannot close before it opens, so a close time is never negative (as in daysBetween).
    const closedDay = Math.max(created[at], dayOf(issue.updatedOn))
    closed[at] = closedDay
    closedQuarter[at] = quarterOf(closedDay)
    closedWithDate += 1
  }

  const closedPositions = new Int32Array(closedWithDate)
  let next = 0
  for (let at = 0; at < count; at += 1) {
    if (closed[at] !== NOT_CLOSED) closedPositions[next++] = at
  }
  const closedOrder = orderByDay(closedWithDate, (position) => closed[closedPositions[position]])
  const byClosed = new Int32Array(closedWithDate)
  for (let at = 0; at < closedWithDate; at += 1) byClosed[at] = closedPositions[closedOrder[at]]

  const days: IssueDays = { issues, created, closed, idRank: createdOrder, closedQuarter, byClosed, closedWithoutDate }
  issueDaysByIndex.set(index, days)
  return days
}

/** Included issues oldest first by Created On (ties by ID ascending) with their day numbers, computed once per index. */
export interface IssueTimeline {
  issues: readonly IssueRecord[]
  /** Parallel to `issues`: the created day number. */
  created: Int32Array
  /** Parallel to `issues`: the closed day number, or Infinity when not closed or Closed without an Updated On. */
  closed: Float64Array
  /** Parallel to `issues`: the issue's place in ID order, ascending and numeric-aware. */
  idRank: Int32Array
}

export function issueTimeline(index: IssueIndex): IssueTimeline {
  return issueDays(index)
}

/** The day number of the end of the week, never later than today. Comparable with `IssueTimeline` days. */
export function asOfDay(week: WorkWeek, today: Date): number {
  return dayNumber(endOfWeek(week, today))
}

/** Whether the timeline's issue at `position` is open as of `day`: created by then and not closed by then. */
export function isOpenOn(timeline: IssueTimeline, position: number, day: number): boolean {
  return timeline.created[position] <= day && timeline.closed[position] > day
}

/** The week for a key, falling back to the last week like the issue model. */
function weekAt(index: IssueIndex, weekKey: number): WorkWeek {
  const position = index.positionByKey.get(weekKey) ?? index.weeks.length - 1
  return index.weeks[position].week
}

/** How many of `byClosed` closed on or before `day`. */
function closuresThrough(days: IssueDays, day: number): number {
  let count = 0
  while (count < days.byClosed.length && days.closed[days.byClosed[count]] <= day) count += 1
  return count
}

export function buildIssueBenchmarks(index: IssueIndex, weekKey: number, today: Date): IssueBenchmarks {
  const days = issueDays(index)
  const asOf = weekAt(index, weekKey)
  const endDay = asOfDay(asOf, today)
  const previousDay = asOfDay(previousWorkWeek(asOf), today)

  const closures = closuresThrough(days, endDay)
  const times = new Int32Array(closures)
  for (let at = 0; at < closures; at += 1) {
    const position = days.byClosed[at]
    times[at] = days.closed[position] - days.created[position]
  }
  times.sort()
  const typical = median(times)
  const window = quantile(times, 0.9)
  const slowest = closures > 0 ? times[closures - 1] : null

  const open: OpenIssueAge[] = []
  let openPrevious = 0
  let pastWindow = 0
  let olderThanAny = 0
  for (let at = 0; at < days.issues.length; at += 1) {
    const created = days.created[at]
    // Issues are in created order, so every later one was created after W too.
    if (created > endDay) break
    if (isOpenOn(days, at, previousDay)) openPrevious += 1
    if (!isOpenOn(days, at, endDay)) continue
    const age = endDay - created
    if (window !== null && age > window) pastWindow += 1
    if (slowest !== null && age > slowest) olderThanAny += 1
    open.push({ issue: days.issues[at], age, timesWindow: window === null || window === 0 ? null : age / window })
  }

  // `open` is oldest first, so its ages run from oldest to youngest.
  const ages = new Int32Array(open.length)
  for (let at = 0; at < open.length; at += 1) ages[open.length - 1 - at] = open[at].age

  return {
    asOf,
    closures,
    typical,
    window,
    slowest,
    open,
    pastWindow,
    olderThanAny,
    medianOpenAge: median(ages),
    openDelta: open.length - openPrevious,
    closedWithoutDate: days.closedWithoutDate,
  }
}

interface BucketEdges {
  min: number
  /** Inclusive; Infinity for the open-ended last bucket. */
  max: number
  label: string
}

const MONTH_BUCKETS: readonly BucketEdges[] = [
  { min: 0, max: 29, label: 'Under 1 month' },
  { min: 30, max: 89, label: '1–3 months' },
  { min: 90, max: 179, label: '3–6 months' },
  { min: 180, max: 364, label: '6–12 months' },
  { min: 365, max: Number.POSITIVE_INFINITY, label: '12+ months' },
]
// Between these, the window edge splits 1–3 months in two. At 30 or less the first part would be at most one day,
// and at 89 or more the second part would be empty, so the month buckets are used and one of them straddles the edge.
const MIN_SPLIT_WINDOW = 31
const MAX_SPLIT_WINDOW = 88

function bucketEdges(window: number | null): readonly BucketEdges[] {
  if (window === null || window < MIN_SPLIT_WINDOW || window > MAX_SPLIT_WINDOW) return MONTH_BUCKETS
  return [
    MONTH_BUCKETS[0],
    { min: 30, max: window, label: `1 month – ${window} days` },
    { min: window + 1, max: 89, label: `${window + 1} days – 3 months` },
    ...MONTH_BUCKETS.slice(2),
  ]
}

function bucketTone(edges: BucketEdges, window: number | null): AgeBucketTone {
  if (window === null) return 'neutral'
  if (edges.max <= window) return 'good'
  if (edges.min > window) return 'bad'
  return 'warn'
}

/** The open issues as of W in month buckets, with the window's edge added as one more bucket edge when it fits. */
export function ageBuckets(benchmarks: IssueBenchmarks): AgeBucket[] {
  const { window } = benchmarks
  const edgesList = bucketEdges(window)
  const buckets: AgeBucket[] = edgesList.map((edges) => {
    const isOpenEnded = edges.max === Number.POSITIVE_INFINITY
    return {
      key: isOpenEnded ? `${edges.min}+` : `${edges.min}-${edges.max}`,
      label: edges.label,
      range: isOpenEnded ? `${edges.min}+ days` : `${edges.min}–${edges.max} days`,
      count: 0,
      tone: bucketTone(edges, window),
      issues: [],
    }
  })
  for (const open of benchmarks.open) {
    let at = edgesList.length - 1
    while (at > 0 && open.age < edgesList[at].min) at -= 1
    buckets[at].count += 1
    buckets[at].issues.push(open)
  }
  return buckets
}

/** A Fenwick tree of counts over positions, for running order statistics. */
class CountTree {
  private readonly tree: Int32Array
  private readonly topBit: number
  total = 0

  constructor(size: number) {
    this.tree = new Int32Array(size + 1)
    let bit = 1
    while (bit * 2 <= size) bit *= 2
    this.topBit = size === 0 ? 0 : bit
  }

  add(position: number, delta: number): void {
    this.total += delta
    for (let at = position + 1; at < this.tree.length; at += at & -at) this.tree[at] += delta
  }

  /** The position of the k-th counted item, 1-based k. */
  kth(k: number): number {
    let position = 0
    let remaining = k
    for (let bit = this.topBit; bit > 0; bit >>= 1) {
      const next = position + bit
      if (next < this.tree.length && this.tree[next] < remaining) {
        position = next
        remaining -= this.tree[next]
      }
    }
    return position
  }
}

/**
 * The median age of the issues open as of each week in the view's range (the 30 weeks or every week through the
 * window end). One sweep over the weeks in order: issues enter a count tree when created and leave when closed, so
 * the whole profile is O((issues + weeks) log issues).
 */
export function agingProfile(index: IssueIndex, view: ViewState, today: Date): ProfilePoint[] {
  const days = issueDays(index)
  const last = index.weeks.length - 1
  const end = index.positionByKey.get(view.windowEndKey) ?? last
  const start = view.range === 'all' ? 0 : recentWindowStart(end)
  const tree = new CountTree(days.issues.length)
  let nextCreated = 0
  let nextClosed = 0
  const points: ProfilePoint[] = []

  for (let position = start; position <= end; position += 1) {
    const week = index.weeks[position].week
    const endDay = asOfDay(week, today)
    while (nextCreated < days.issues.length && days.created[nextCreated] <= endDay) tree.add(nextCreated++, 1)
    // A closed day is never before its created day, so a closing issue has always been added already.
    while (nextClosed < days.byClosed.length && days.closed[days.byClosed[nextClosed]] <= endDay) {
      tree.add(days.byClosed[nextClosed++], -1)
    }
    const open = tree.total
    let middle: number | null = null
    if (open > 0) {
      // Positions are in created order, so the middle position(s) give the median age.
      const upper = endDay - days.created[tree.kth(Math.floor(open / 2) + 1)]
      const lower = open % 2 === 1 ? upper : endDay - days.created[tree.kth(open / 2)]
      middle = (upper + lower) / 2
    }
    points.push({ week, median: middle, open })
  }
  return points
}

function quarterLabel(key: number): string {
  const year = Math.floor(key / 4)
  return `Q${(key % 4) + 1}'${String(year % 100).padStart(2, '0')}`
}

/**
 * Median days to close per calendar quarter of the closed date, from the first quarter with a closure through the
 * quarter of the end of W. Only closures as of W count. Empty without closures.
 */
export function quarterMedians(index: IssueIndex, weekKey: number, today: Date): QuarterPoint[] {
  const days = issueDays(index)
  const endDay = asOfDay(weekAt(index, weekKey), today)
  const closures = closuresThrough(days, endDay)
  if (closures === 0) return []

  const points: QuarterPoint[] = []
  const lastQuarter = quarterKeyOfDay(endDay)
  let at = 0
  // byClosed is in closed-day order, so each quarter's closures are one consecutive run.
  for (let key = days.closedQuarter[days.byClosed[0]]; key <= lastQuarter; key += 1) {
    const runStart = at
    while (at < closures && days.closedQuarter[days.byClosed[at]] === key) at += 1
    const times = new Int32Array(at - runStart)
    for (let offset = 0; offset < times.length; offset += 1) {
      const position = days.byClosed[runStart + offset]
      times[offset] = days.closed[position] - days.created[position]
    }
    times.sort()
    points.push({
      key,
      label: quarterLabel(key),
      median: median(times),
      closed: times.length,
      slowest: times.length > 0 ? times[times.length - 1] : null,
    })
  }
  return points
}
