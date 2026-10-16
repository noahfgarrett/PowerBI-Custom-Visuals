import type { CombinedSplit } from './combined'
import type { CombinedColumns, InspectionPhase, InspectionRows, ViewState, WorkWeek } from './types'
import { NAME_COLLATOR } from './format'
import { createNameGrouper, createWeekReader } from './grouping'
import { cellText, isIssueFound, readPhase, recentWindowStart } from './inspections'
import { isWeldIssue } from './welds'
import { enumerateWorkWeeks, makeWorkWeek, toIsoWorkWeek } from './workWeeks'

export type PerformanceGroup = 'qcr' | 'welders'

/** The discipline a QCR/FE's rows came from. */
export type DisciplineTag = 'E' | 'M'

/** The combined-table sources Performance reads. */
export type PerformanceSource = 'electrical' | 'mechanical' | 'welding'

/**
 * Weekly counts aligned to `PerformanceIndex.weeks` (dense arrays measured faster than per-person Maps,
 * both to fill and to sum a window).
 */
export interface WeeklyBuckets {
  /** Finals for QCR/FE, credited welds for welders. */
  readonly volume: Int32Array
  /** SOR rows. Always zero for welders. */
  readonly sors: Int32Array
  /** Finals with an issue found, or credited welds with an issue. */
  readonly ncrs: Int32Array
}

/** Where an NCR row sits, for the person detail table. */
export interface NcrRowRef {
  source: PerformanceSource
  /** The row's position in its source's rows (`PerformanceIndex.sources[source]`). */
  row: number
  weekKey: number
}

export interface PerformancePerson {
  /** Trimmed, lower-cased and whitespace-collapsed name. */
  key: string
  /** The first spelling seen. */
  name: string
  /** QCR/FE only: every discipline the person has rows in. Empty for welders. */
  disciplines: DisciplineTag[]
  weekly: WeeklyBuckets
  /** QCR/FE only: per week, `TAG_BITS` of the disciplines the week's rows came from. All zero for welders. */
  tagsByWeek: Uint8Array
  /** In source row order, Electrical before Mechanical. */
  ncrRows: NcrRowRef[]
}

/** Whole-group counts per week: distinct finals or welds (not credited sums) and those with an NCR. */
export interface GroupTotals {
  readonly volume: Int32Array
  readonly ncrs: Int32Array
}

/** The row counts the footnotes read, in the shape `buildFootnotes` takes. */
export interface GroupRowCounts {
  totalRows: number
  /** Counted rows (Final or SOR for QCR/FE, every weld) whose week can't be read. */
  skippedRows: number
  /** Counted rows dated after the current week. */
  futureRows: number
}

export interface PerformanceFootnotes {
  qcr: GroupRowCounts
  welders: GroupRowCounts
  unknownSource: number
}

export interface PerformanceIndex {
  currentWeek: WorkWeek
  /** From the earliest counted week of either group to the current week, with no gaps. */
  weeks: WorkWeek[]
  positionByKey: Map<number, number>
  qcr: PerformancePerson[]
  welders: PerformancePerson[]
  notRecorded: Record<PerformanceGroup, WeeklyBuckets>
  totals: Record<PerformanceGroup, GroupTotals>
  /** Welds per week that list more than one welder. */
  sharedWelds: Int32Array
  footnotes: PerformanceFootnotes
  /** The rows `NcrRowRef.row` points into. Shared with the split, never copied. */
  sources: Record<PerformanceSource, InspectionRows>
  columns: CombinedColumns
}

export interface PerformanceTrendWeek {
  volume: number
  hasNcr: boolean
}

export interface PerformanceRow {
  key: string
  name: string
  /** QCR/FE only: the disciplines of the person's rows in the period. */
  tags: DisciplineTag[]
  volume: number
  sors: number
  ncrs: number
  /** NCRs ÷ volume as a percentage, or null with no volume. */
  rate: number | null
  /** The 30 weeks ending at the period's last week, whatever the range. */
  trend: PerformanceTrendWeek[]
  /** Weeks in `trend` with an NCR. */
  ncrWeeks: number
}

export interface PerformanceSummary {
  peopleRanked: number
  /** Distinct finals or welds in the period for the whole group, including below minimum and Not recorded. */
  volume: number
  ncrs: number
  rate: number | null
}

export interface PerformanceWindow {
  first: WorkWeek
  last: WorkWeek
  weekCount: number
}

export interface PerformanceModel {
  group: PerformanceGroup
  summary: PerformanceSummary
  /** Volume at or above the minimum: NCR rate descending, then NCRs descending, then name. */
  ranked: PerformanceRow[]
  /** Everyone else with rows in the period: volume descending, then name. */
  belowMinimum: PerformanceRow[]
  /** Rows with no recorded QCR/FE or welder in the period, or null when there are none. */
  notRecorded: PerformanceRow | null
  /** Welds in the period that list more than one welder. Zero for QCR/FE. */
  sharedWelds: number
  /** Newest first. */
  weekOptions: WorkWeek[]
  selectedWeek: WorkWeek
  window: PerformanceWindow
}

export interface PerformanceTotals {
  volume: number
  ncrs: number
  rate: number | null
}

export interface PersonWeek {
  week: WorkWeek
  volume: number
  ncrs: number
  /** NCRs ÷ volume from the period's first week through this week, or null before any volume. */
  runningRate: number | null
}

export type PersonNcrSource = 'Electrical' | 'Mechanical' | 'Welding'

export interface PersonNcrRow {
  weekKey: number
  weekLabel: string
  source: PersonNcrSource
  /** Building for inspections, Tag No for welds. */
  place: string
  /** The Issue cell text. */
  issue: string
}

export interface PersonDetail {
  key: string
  name: string
  group: PerformanceGroup
  tags: DisciplineTag[]
  period: PerformanceTotals
  allTime: PerformanceTotals
  /** Each week of the period, oldest first. */
  weeks: PersonWeek[]
  /** The period's NCR rows, newest first. */
  ncrRows: PersonNcrRow[]
}

/** Discipline bits in `PerformancePerson.tagsByWeek`. */
export const TAG_BITS = { E: 1, M: 2 } as const

/** The no-name values, matching the welding no-issue set plus blank. */
const NOT_RECORDED_VALUES: ReadonlySet<string> = new Set(['', 'n/a', 'na', 'none', '-'])
const NOT_RECORDED_PERSON = -1
// Per counted inspection: its phase, whether it is an NCR, and its discipline (as TAG_BITS shifted left by 2).
const FLAG_FINAL = 1
const FLAG_NCR = 2
const TAG_SHIFT = 2

/** Blank, or `n/a`, `na`, `none` or `-`, trimmed and ignoring case. */
export function isNotRecorded(value: unknown): boolean {
  return NOT_RECORDED_VALUES.has(cellText(value).toLowerCase())
}

interface PersonDraft {
  key: string
  name: string
  tagBits: number
  ncrRows: NcrRowRef[]
}

interface People {
  drafts: PersonDraft[]
  /** Trimmed spelling → person id, or NOT_RECORDED_PERSON. */
  idOf: (spelling: string) => number
}

function newPeople(): People {
  const drafts: PersonDraft[] = []
  const idOf = createNameGrouper((key, spelling): number => {
    if (isNotRecorded(spelling)) return NOT_RECORDED_PERSON
    drafts.push({ key, name: spelling, tagBits: 0, ncrRows: [] })
    return drafts.length - 1
  })
  return { drafts, idOf }
}

/** The distinct recorded welders a Welder cell lists, cached by cell text. Empty when none is recorded. */
function welderIds(value: unknown, people: People, cache: Map<string, readonly number[]>): readonly number[] {
  const text = cellText(value)
  const cached = cache.get(text)
  if (cached !== undefined) return cached
  const ids: number[] = []
  for (const part of text.split(',')) {
    const id = people.idOf(part.trim())
    if (id !== NOT_RECORDED_PERSON && !ids.includes(id)) ids.push(id)
  }
  cache.set(text, ids)
  return ids
}

function emptyBuckets(weekCount: number): WeeklyBuckets {
  return { volume: new Int32Array(weekCount), sors: new Int32Array(weekCount), ncrs: new Int32Array(weekCount) }
}

function disciplinesOf(tagBits: number): DisciplineTag[] {
  const tags: DisciplineTag[] = []
  if (tagBits & TAG_BITS.E) tags.push('E')
  if (tagBits & TAG_BITS.M) tags.push('M')
  return tags
}

function toPerson(draft: PersonDraft, weekCount: number): PerformancePerson {
  return {
    key: draft.key,
    name: draft.name,
    disciplines: disciplinesOf(draft.tagBits),
    weekly: emptyBuckets(weekCount),
    tagsByWeek: new Uint8Array(weekCount),
    ncrRows: draft.ncrRows,
  }
}

/** Reads each row's week once, tracking the earliest counted week. */
interface WeekScan {
  readWeek: (value: unknown) => WorkWeek | null
  currentKey: number
  firstWeek: WorkWeek
}

/** The counted week, or null after counting the row as skipped (unreadable) or future. */
function countedWeek(value: unknown, scan: WeekScan, counts: GroupRowCounts): WorkWeek | null {
  const week = scan.readWeek(value)
  if (!week) {
    counts.skippedRows += 1
    return null
  }
  if (week.key > scan.currentKey) {
    counts.futureRows += 1
    return null
  }
  if (week.key < scan.firstWeek.key) scan.firstWeek = week
  return week
}

/** Counted inspections, one entry each, in parallel arrays. */
interface InspectionEntries {
  weekKey: number[]
  person: number[]
  flags: number[]
}

/** Counted welds, one entry each, in parallel arrays. */
interface WeldEntries {
  weekKey: number[]
  welders: Array<readonly number[]>
  isIssue: boolean[]
}

function scanInspections(
  rows: InspectionRows,
  source: 'electrical' | 'mechanical',
  columns: CombinedColumns,
  scan: WeekScan,
  people: People,
  entries: InspectionEntries,
  counts: GroupRowCounts,
): void {
  const phaseCache = new Map<string, InspectionPhase>()
  const tag = source === 'electrical' ? TAG_BITS.E : TAG_BITS.M
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex]
    const phase = readPhase(row[columns.phase], phaseCache)
    if (phase === 'other') continue
    const week = countedWeek(row[columns.workWeek], scan, counts)
    if (!week) continue

    const isNcr = phase === 'final' && isIssueFound(row[columns.issue])
    const id = people.idOf(cellText(row[columns.qcr]))
    if (id !== NOT_RECORDED_PERSON) {
      const draft = people.drafts[id]
      draft.tagBits |= tag
      if (isNcr) draft.ncrRows.push({ source, row: rowIndex, weekKey: week.key })
    }
    entries.weekKey.push(week.key)
    entries.person.push(id)
    entries.flags.push((phase === 'final' ? FLAG_FINAL : 0) | (isNcr ? FLAG_NCR : 0) | (tag << TAG_SHIFT))
  }
}

function scanWelds(
  rows: InspectionRows,
  columns: CombinedColumns,
  scan: WeekScan,
  people: People,
  entries: WeldEntries,
  counts: GroupRowCounts,
): void {
  const cellCache = new Map<string, readonly number[]>()
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex]
    const week = countedWeek(row[columns.workWeek], scan, counts)
    if (!week) continue

    const isIssue = isWeldIssue(row[columns.issue])
    const welders = welderIds(row[columns.welder], people, cellCache)
    if (isIssue) {
      for (const id of welders) people.drafts[id].ncrRows.push({ source: 'welding', row: rowIndex, weekKey: week.key })
    }
    entries.weekKey.push(week.key)
    entries.welders.push(welders)
    entries.isIssue.push(isIssue)
  }
}

/**
 * Per-person week buckets for both groups, built once per data update so the model can rank any period in
 * O(people × weeks). QCR/FE counts Electrical and Mechanical Final and SOR rows; welders count every weld.
 * Both skip unreadable and future weeks.
 */
export function buildPerformanceIndex(split: CombinedSplit, columns: CombinedColumns, today: Date): PerformanceIndex {
  const currentWeek = toIsoWorkWeek(today)
  const scan: WeekScan = { readWeek: createWeekReader(), currentKey: currentWeek.key, firstWeek: currentWeek }
  const qcrPeople = newPeople()
  const welderPeople = newPeople()
  const inspections: InspectionEntries = { weekKey: [], person: [], flags: [] }
  const welds: WeldEntries = { weekKey: [], welders: [], isIssue: [] }
  const qcrCounts: GroupRowCounts = { totalRows: split.electrical.length + split.mechanical.length, skippedRows: 0, futureRows: 0 }
  const welderCounts: GroupRowCounts = { totalRows: split.welding.length, skippedRows: 0, futureRows: 0 }

  scanInspections(split.electrical, 'electrical', columns, scan, qcrPeople, inspections, qcrCounts)
  scanInspections(split.mechanical, 'mechanical', columns, scan, qcrPeople, inspections, qcrCounts)
  scanWelds(split.welding, columns, scan, welderPeople, welds, welderCounts)

  const weeks = enumerateWorkWeeks(scan.firstWeek, currentWeek)
  const positionByKey = new Map<number, number>()
  weeks.forEach((week, position) => positionByKey.set(week.key, position))
  // Every counted week lies between the first counted week and the current week, so the lookups always hit.
  const positionOf = (weekKey: number): number => positionByKey.get(weekKey) ?? 0
  const weekCount = weeks.length

  const qcr = qcrPeople.drafts.map((draft) => toPerson(draft, weekCount))
  const qcrNotRecorded = emptyBuckets(weekCount)
  const qcrTotals: GroupTotals = { volume: new Int32Array(weekCount), ncrs: new Int32Array(weekCount) }
  for (let entry = 0; entry < inspections.weekKey.length; entry += 1) {
    const position = positionOf(inspections.weekKey[entry])
    const flags = inspections.flags[entry]
    const id = inspections.person[entry]
    const isFinal = (flags & FLAG_FINAL) !== 0
    const ncr = (flags & FLAG_NCR) !== 0 ? 1 : 0
    if (isFinal) {
      qcrTotals.volume[position] += 1
      qcrTotals.ncrs[position] += ncr
    }
    let buckets = qcrNotRecorded
    if (id !== NOT_RECORDED_PERSON) {
      const person = qcr[id]
      person.tagsByWeek[position] |= flags >> TAG_SHIFT
      buckets = person.weekly
    }
    if (isFinal) {
      buckets.volume[position] += 1
      buckets.ncrs[position] += ncr
    } else {
      buckets.sors[position] += 1
    }
  }

  const welders = welderPeople.drafts.map((draft) => toPerson(draft, weekCount))
  const welderNotRecorded = emptyBuckets(weekCount)
  const welderTotals: GroupTotals = { volume: new Int32Array(weekCount), ncrs: new Int32Array(weekCount) }
  const sharedWelds = new Int32Array(weekCount)
  for (let entry = 0; entry < welds.weekKey.length; entry += 1) {
    const position = positionOf(welds.weekKey[entry])
    const ncr = welds.isIssue[entry] ? 1 : 0
    const ids = welds.welders[entry]
    welderTotals.volume[position] += 1
    welderTotals.ncrs[position] += ncr
    if (ids.length === 0) {
      welderNotRecorded.volume[position] += 1
      welderNotRecorded.ncrs[position] += ncr
      continue
    }
    if (ids.length > 1) sharedWelds[position] += 1
    for (const id of ids) {
      const weekly = welders[id].weekly
      weekly.volume[position] += 1
      weekly.ncrs[position] += ncr
    }
  }

  return {
    currentWeek,
    weeks,
    positionByKey,
    qcr,
    welders,
    notRecorded: { qcr: qcrNotRecorded, welders: welderNotRecorded },
    totals: { qcr: qcrTotals, welders: welderTotals },
    sharedWelds,
    footnotes: { qcr: qcrCounts, welders: welderCounts, unknownSource: split.unknownSource },
    sources: { electrical: split.electrical, mechanical: split.mechanical, welding: split.welding },
    columns,
  }
}

/** The Not recorded row's key. No person can have it, since a blank name is Not recorded. */
export const NOT_RECORDED_KEY = ''
const NOT_RECORDED_NAME = 'Not recorded'

const SOURCE_LABELS: Record<PerformanceSource, PersonNcrSource> = {
  electrical: 'Electrical',
  mechanical: 'Mechanical',
  welding: 'Welding',
}

/** Week positions of the period (the range ending at the picked week) and of the 30-week trend ending there. */
interface Period {
  start: number
  end: number
  trendStart: number
}

function periodOf(index: PerformanceIndex, view: ViewState): Period {
  const end = index.positionByKey.get(view.windowEndKey) ?? index.weeks.length - 1
  const trendStart = recentWindowStart(end)
  return { start: view.range === 'all' ? 0 : trendStart, end, trendStart }
}

function sumRange(values: Int32Array, start: number, end: number): number {
  let sum = 0
  for (let position = start; position <= end; position += 1) sum += values[position]
  return sum
}

function rateOf(ncrs: number, volume: number): number | null {
  return volume > 0 ? (ncrs / volume) * 100 : null
}

function tagsInRange(tagsByWeek: Uint8Array, start: number, end: number): DisciplineTag[] {
  let tagBits = 0
  for (let position = start; position <= end; position += 1) tagBits |= tagsByWeek[position]
  return disciplinesOf(tagBits)
}

/** The row for the period, or null when the period has no rows for it. */
function rowOf(key: string, name: string, weekly: WeeklyBuckets, tagsByWeek: Uint8Array | null, period: Period): PerformanceRow | null {
  const volume = sumRange(weekly.volume, period.start, period.end)
  const sors = sumRange(weekly.sors, period.start, period.end)
  if (volume === 0 && sors === 0) return null
  const ncrs = sumRange(weekly.ncrs, period.start, period.end)

  const trend: PerformanceTrendWeek[] = []
  let ncrWeeks = 0
  for (let position = period.trendStart; position <= period.end; position += 1) {
    const hasNcr = weekly.ncrs[position] > 0
    if (hasNcr) ncrWeeks += 1
    trend.push({ volume: weekly.volume[position], hasNcr })
  }

  return {
    key,
    name,
    tags: tagsByWeek ? tagsInRange(tagsByWeek, period.start, period.end) : [],
    volume,
    sors,
    ncrs,
    rate: rateOf(ncrs, volume),
    trend,
    ncrWeeks,
  }
}

/** NCR rate descending (compared exactly, as fractions), then NCRs descending, then name. */
function compareRanked(a: PerformanceRow, b: PerformanceRow): number {
  return b.ncrs * a.volume - a.ncrs * b.volume || b.ncrs - a.ncrs || NAME_COLLATOR.compare(a.name, b.name)
}

function compareBelowMinimum(a: PerformanceRow, b: PerformanceRow): number {
  return b.volume - a.volume || NAME_COLLATOR.compare(a.name, b.name)
}

/**
 * Ranks one group for the period from the index's week buckets in O(people × weeks).
 * People need at least `minimum` finals (or welds) to be ranked; a minimum under 1 counts as 1.
 */
export function buildPerformanceModel(
  index: PerformanceIndex,
  view: ViewState,
  group: PerformanceGroup,
  minimum: number,
): PerformanceModel {
  const period = periodOf(index, view)
  const threshold = Number.isFinite(minimum) ? Math.max(1, minimum) : 1
  const ranked: PerformanceRow[] = []
  const belowMinimum: PerformanceRow[] = []
  for (const person of index[group]) {
    const row = rowOf(person.key, person.name, person.weekly, person.tagsByWeek, period)
    if (!row) continue
    if (row.volume >= threshold) ranked.push(row)
    else belowMinimum.push(row)
  }
  ranked.sort(compareRanked)
  belowMinimum.sort(compareBelowMinimum)

  const totals = index.totals[group]
  const volume = sumRange(totals.volume, period.start, period.end)
  const ncrs = sumRange(totals.ncrs, period.start, period.end)

  return {
    group,
    summary: { peopleRanked: ranked.length, volume, ncrs, rate: rateOf(ncrs, volume) },
    ranked,
    belowMinimum,
    notRecorded: rowOf(NOT_RECORDED_KEY, NOT_RECORDED_NAME, index.notRecorded[group], null, period),
    sharedWelds: group === 'welders' ? sumRange(index.sharedWelds, period.start, period.end) : 0,
    weekOptions: [...index.weeks].reverse(),
    selectedWeek: index.weeks[index.positionByKey.get(view.selectedKey) ?? period.end],
    window: { first: index.weeks[period.start], last: index.weeks[period.end], weekCount: period.end - period.start + 1 },
  }
}

function ncrRowOf(index: PerformanceIndex, ref: NcrRowRef): PersonNcrRow {
  const row = index.sources[ref.source][ref.row]
  const placeColumn = ref.source === 'welding' ? index.columns.tagNo : index.columns.building
  return {
    weekKey: ref.weekKey,
    weekLabel: makeWorkWeek(Math.floor(ref.weekKey / 100), ref.weekKey % 100).label,
    source: SOURCE_LABELS[ref.source],
    place: cellText(row[placeColumn]),
    issue: cellText(row[index.columns.issue]),
  }
}

/** One person's cards, weekly series and NCR rows for the period, or null when the key isn't in the group. */
export function buildPersonDetail(
  index: PerformanceIndex,
  group: PerformanceGroup,
  key: string,
  view: ViewState,
): PersonDetail | null {
  const person = index[group].find((candidate) => candidate.key === key)
  if (!person) return null

  const period = periodOf(index, view)
  const { volume, ncrs } = person.weekly
  const weeks: PersonWeek[] = []
  let runningVolume = 0
  let runningNcrs = 0
  for (let position = period.start; position <= period.end; position += 1) {
    runningVolume += volume[position]
    runningNcrs += ncrs[position]
    weeks.push({ week: index.weeks[position], volume: volume[position], ncrs: ncrs[position], runningRate: rateOf(runningNcrs, runningVolume) })
  }

  const last = index.weeks.length - 1
  const allTimeVolume = sumRange(volume, 0, last)
  const allTimeNcrs = sumRange(ncrs, 0, last)
  const firstKey = index.weeks[period.start].key
  const lastKey = index.weeks[period.end].key

  return {
    key: person.key,
    name: person.name,
    group,
    tags: tagsInRange(person.tagsByWeek, period.start, period.end),
    period: { volume: runningVolume, ncrs: runningNcrs, rate: rateOf(runningNcrs, runningVolume) },
    allTime: { volume: allTimeVolume, ncrs: allTimeNcrs, rate: rateOf(allTimeNcrs, allTimeVolume) },
    weeks,
    ncrRows: person.ncrRows
      .filter((ref) => ref.weekKey >= firstKey && ref.weekKey <= lastKey)
      .map((ref) => ncrRowOf(index, ref))
      .sort((a, b) => b.weekKey - a.weekKey),
  }
}
