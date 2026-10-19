import type { IssueIndex, IssueRecord, ViewState, WorkWeek } from './types'
import { formatPercent, NAME_COLLATOR } from './format'
import { createNameGrouper, groupKey } from './grouping'
import { recentWindowStart } from './inspections'
import type { IssueTimeline } from './issueBenchmarks'
import { asOfDay, isOpenOn, issueTimeline } from './issueBenchmarks'

// The Issues by Root Cause Pareto: issues created from the dashboard window's first week through W, optionally only
// those open as of W, counted by root cause. The top 9 causes get bars, the rest fold into Other, and blank causes
// form a grey Not recorded bar that stays out of the cumulative share.

export type ParetoScope = 'all' | 'open'
export type ParetoBarKind = 'cause' | 'other' | 'notRecorded'

export interface ParetoBar {
  /** Unique within the model: `cause:<grouped name>`, `other` or `notRecorded`. */
  key: string
  /** The cause's first spelling, `Other (n causes)` or `Not recorded`. */
  label: string
  count: number
  /** Percent 0–100 of every issue in scope, Not recorded included. */
  share: number
  /** Running percent 0–100 of the issues with a recorded cause. Null for Not recorded. */
  cumulative: number | null
  /** Up to and including the bar where the cumulative first reaches 80%. */
  vital: boolean
  kind: ParetoBarKind
  /** The cause for a cause bar, the folded causes (largest first) for Other, none for Not recorded. */
  causes: string[]
}

export interface CategorySlice {
  /** `category:<grouped name>`, or `notRecorded` for a blank category. */
  key: string
  label: string
  count: number
  /** Percent 0–100 of every issue in scope. */
  share: number
}

export interface CauseCount {
  label: string
  count: number
}

export interface ParetoModel {
  /** The window's first week and W, for the page title. */
  firstWeek: WorkWeek
  lastWeek: WorkWeek
  /** Top causes, then Other, then Not recorded; empty when no issue is in scope. */
  bars: ParetoBar[]
  /** Issues in scope, Not recorded included. */
  total: number
  /** Distinct recorded causes. */
  distinct: number
  /** The cumulative percent of the top cause bars (up to 9), or null without a recorded cause. */
  topNShare: number | null
  /** The bar where the cumulative first reaches 80%, or null without a recorded cause. */
  crossIndex: number | null
  /** By count, ties by name, Not recorded last. Null when Root Cause Category is unbound. */
  categories: CategorySlice[] | null
  /** The causes folded into Other, largest first, ties by name. */
  otherCauses: CauseCount[]
  /** The read-out line, or '' without a recorded cause. */
  readout: string
}

export interface ParetoIssueRow {
  issue: IssueRecord
  /** Open as of W. */
  isOpen: boolean
  /** Age at the end of W for an open issue, days to close for a closed one. */
  days: number
}

const TOP_CAUSES = 9
const VITAL_PERCENT = 80
const NOT_RECORDED_LABEL = 'Not recorded'
const NOT_RECORDED_KEY = 'notRecorded'
const OTHER_KEY = 'other'
/** The group of a blank cause or category. */
const NOT_RECORDED = -1

interface NameGroups {
  /** Parallel to the timeline: the group of each issue's text, or NOT_RECORDED when blank. */
  groupAt: Int32Array
  /** First spelling of each group. */
  labels: string[]
  idByKey: Map<string, number>
}

/** Cause and category groups for every issue, computed once per index. */
interface CauseIndex {
  timeline: IssueTimeline
  /** Parallel to the timeline: the created week key. */
  createdKey: Int32Array
  causes: NameGroups
  categories: NameGroups
}

const causeIndexByIndex = new WeakMap<IssueIndex, CauseIndex>()

/** Groups text ignoring case and spacing. The timeline is oldest first, so each group keeps its earliest spelling. */
function nameGroups(issues: readonly IssueRecord[], textOf: (issue: IssueRecord) => string): NameGroups {
  const labels: string[] = []
  const idByKey = new Map<string, number>()
  const groupOf = createNameGrouper((key: string, spelling: string): number => {
    const id = labels.length
    labels.push(spelling)
    idByKey.set(key, id)
    return id
  })
  const groupAt = new Int32Array(issues.length)
  for (let position = 0; position < issues.length; position += 1) {
    const text = textOf(issues[position])
    groupAt[position] = text === '' ? NOT_RECORDED : groupOf(text)
  }
  return { groupAt, labels, idByKey }
}

function causeIndex(index: IssueIndex): CauseIndex {
  const cached = causeIndexByIndex.get(index)
  if (cached !== undefined) return cached
  const timeline = issueTimeline(index)
  const createdKey = new Int32Array(timeline.issues.length)
  for (let position = 0; position < timeline.issues.length; position += 1) createdKey[position] = timeline.issues[position].createdWeek.key
  const built: CauseIndex = {
    timeline,
    createdKey,
    causes: nameGroups(timeline.issues, (issue) => issue.rootCause),
    categories: nameGroups(timeline.issues, (issue) => issue.rootCauseCategory),
  }
  causeIndexByIndex.set(index, built)
  return built
}

interface ParetoPeriod {
  firstWeek: WorkWeek
  lastWeek: WorkWeek
  /** End of W as a timeline day number. */
  endDay: number
}

/** From the window's first week (or W, when W is earlier) through W, like the dashboard's 30 WW | All. */
function paretoPeriod(index: IssueIndex, view: ViewState, today: Date): ParetoPeriod {
  const last = index.weeks.length - 1
  const selected = index.positionByKey.get(view.selectedKey) ?? last
  const end = index.positionByKey.get(view.windowEndKey) ?? last
  const start = view.range === 'all' ? 0 : recentWindowStart(end)
  const lastWeek = index.weeks[selected].week
  return { firstWeek: index.weeks[Math.min(start, selected)].week, lastWeek, endDay: asOfDay(lastWeek, today) }
}

/** Calls `visit` with the timeline position of every issue in the period and scope. */
function forEachInScope(causes: CauseIndex, period: ParetoPeriod, scope: ParetoScope, visit: (position: number) => void): void {
  const { createdKey, timeline } = causes
  const firstKey = period.firstWeek.key
  const lastKey = period.lastWeek.key
  for (let position = 0; position < createdKey.length; position += 1) {
    const key = createdKey[position]
    // The timeline is in created order, so every later issue was created after W too.
    if (key > lastKey) break
    if (key < firstKey) continue
    if (scope === 'open' && !isOpenOn(timeline, position, period.endDay)) continue
    visit(position)
  }
}

function byCountThenName(a: CauseCount, b: CauseCount): number {
  return b.count - a.count || NAME_COLLATOR.compare(a.label, b.label)
}

function percentOf(count: number, total: number): number {
  return total === 0 ? 0 : (count / total) * 100
}

function categorySlices(groups: NameGroups, counts: Int32Array, notRecorded: number, total: number): CategorySlice[] {
  const recorded: CategorySlice[] = []
  for (let id = 0; id < counts.length; id += 1) {
    if (counts[id] === 0) continue
    const label = groups.labels[id]
    recorded.push({ key: `category:${groupKey(label)}`, label, count: counts[id], share: percentOf(counts[id], total) })
  }
  recorded.sort(byCountThenName)
  if (notRecorded > 0) {
    recorded.push({ key: NOT_RECORDED_KEY, label: NOT_RECORDED_LABEL, count: notRecorded, share: percentOf(notRecorded, total) })
  }
  return recorded
}

function readoutOf(bars: readonly ParetoBar[], crossIndex: number | null, topNShare: number | null, total: number): string {
  if (crossIndex === null || topNShare === null) return ''
  const top = bars[0]
  const topCause = `${top.label} is ${top.count} of ${total} (${formatPercent(top.share)}).`
  if (bars[crossIndex].kind === 'other') {
    return `The top ${TOP_CAUSES} causes cover ${formatPercent(topNShare)}; 80% is reached only inside Other. ${topCause}`
  }
  const covered = formatPercent(bars[crossIndex].cumulative)
  const lead = crossIndex === 0 ? `The top cause covers ${covered}.` : `The top ${crossIndex + 1} causes cover ${covered}.`
  return `${lead} ${topCause}`
}

export function buildRootCausePareto(index: IssueIndex, view: ViewState, scope: ParetoScope, today: Date): ParetoModel {
  const causes = causeIndex(index)
  const period = paretoPeriod(index, view, today)
  const causeCounts = new Int32Array(causes.causes.labels.length)
  const categoryCounts = new Int32Array(causes.categories.labels.length)
  let total = 0
  let notRecorded = 0
  let categoryNotRecorded = 0
  forEachInScope(causes, period, scope, (position) => {
    total += 1
    const cause = causes.causes.groupAt[position]
    if (cause === NOT_RECORDED) notRecorded += 1
    else causeCounts[cause] += 1
    const category = causes.categories.groupAt[position]
    if (category === NOT_RECORDED) categoryNotRecorded += 1
    else categoryCounts[category] += 1
  })

  const ranked: CauseCount[] = []
  for (let id = 0; id < causeCounts.length; id += 1) {
    if (causeCounts[id] > 0) ranked.push({ label: causes.causes.labels[id], count: causeCounts[id] })
  }
  ranked.sort(byCountThenName)
  const recorded = total - notRecorded
  const otherCauses = ranked.slice(TOP_CAUSES)

  const bars: ParetoBar[] = ranked.slice(0, TOP_CAUSES).map((cause) => ({
    key: `cause:${groupKey(cause.label)}`,
    label: cause.label,
    count: cause.count,
    share: percentOf(cause.count, total),
    cumulative: null,
    vital: false,
    kind: 'cause',
    causes: [cause.label],
  }))
  if (otherCauses.length > 0) {
    const count = otherCauses.reduce((sum, cause) => sum + cause.count, 0)
    bars.push({
      key: OTHER_KEY,
      label: `Other (${otherCauses.length} ${otherCauses.length === 1 ? 'cause' : 'causes'})`,
      count,
      share: percentOf(count, total),
      cumulative: null,
      vital: false,
      kind: 'other',
      causes: otherCauses.map((cause) => cause.label),
    })
  }

  let running = 0
  let crossIndex: number | null = null
  let topNShare: number | null = null
  for (let at = 0; at < bars.length; at += 1) {
    const bar = bars[at]
    running += bar.count
    bar.cumulative = percentOf(running, recorded)
    bar.vital = crossIndex === null
    // Whole counts, so exactly 80% is reached without rounding error.
    if (crossIndex === null && running * 100 >= VITAL_PERCENT * recorded) crossIndex = at
    if (bar.kind === 'cause') topNShare = bar.cumulative
  }
  if (notRecorded > 0) {
    bars.push({
      key: NOT_RECORDED_KEY,
      label: NOT_RECORDED_LABEL,
      count: notRecorded,
      share: percentOf(notRecorded, total),
      cumulative: null,
      vital: false,
      kind: 'notRecorded',
      causes: [],
    })
  }

  return {
    firstWeek: period.firstWeek,
    lastWeek: period.lastWeek,
    bars,
    total,
    distinct: ranked.length,
    topNShare,
    crossIndex,
    categories: index.hasRootCauseCategory ? categorySlices(causes.categories, categoryCounts, categoryNotRecorded, total) : null,
    otherCauses,
    readout: readoutOf(bars, crossIndex, topNShare, total),
  }
}

/** The bar's issues in the period and scope: open issues oldest first, then closed issues longest to close first. */
export function paretoIssues(index: IssueIndex, bar: ParetoBar, view: ViewState, scope: ParetoScope, today: Date): ParetoIssueRow[] {
  const causes = causeIndex(index)
  const period = paretoPeriod(index, view, today)
  const { timeline } = causes
  const groups = new Set<number>()
  for (const label of bar.causes) {
    const id = causes.causes.idByKey.get(groupKey(label))
    if (id !== undefined) groups.add(id)
  }
  const matches = (group: number): boolean => (bar.kind === 'notRecorded' ? group === NOT_RECORDED : groups.has(group))

  const positions: number[] = []
  const openFlags: boolean[] = []
  const daysList: number[] = []
  let maxDays = 0
  forEachInScope(causes, period, scope, (position) => {
    if (!matches(causes.causes.groupAt[position])) return
    // Not closed by the end of W. An issue created later in W than today is open but not yet a day old.
    const created = timeline.created[position]
    const closed = timeline.closed[position]
    const isOpen = closed > period.endDay
    const days = isOpen ? Math.max(0, period.endDay - created) : closed - created
    positions.push(position)
    openFlags.push(isOpen)
    daysList.push(days)
    if (days > maxDays) maxDays = days
  })

  // Open first, most days first, then ID ascending, as one exact integer key per row so a native numeric sort
  // orders them: (closed?, maxDays − days, ID rank). It stays far below 2^53 for any real day span and row count.
  const issueCount = timeline.issues.length
  const daySpan = maxDays + 1
  const keys = new Float64Array(positions.length)
  const matchByRank = new Int32Array(issueCount)
  for (let at = 0; at < positions.length; at += 1) {
    const rank = timeline.idRank[positions[at]]
    matchByRank[rank] = at
    keys[at] = ((openFlags[at] ? 0 : 1) * daySpan + (maxDays - daysList[at])) * issueCount + rank
  }
  keys.sort()
  const rows: ParetoIssueRow[] = new Array<ParetoIssueRow>(keys.length)
  for (let at = 0; at < keys.length; at += 1) {
    const key = keys[at]
    const match = matchByRank[key - Math.floor(key / issueCount) * issueCount]
    rows[at] = { issue: timeline.issues[positions[match]], isOpen: openFlags[match], days: daysList[match] }
  }
  return rows
}
