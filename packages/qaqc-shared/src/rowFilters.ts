import { NAME_COLLATOR } from './format'
import { cellText } from './inspections'

export const NOT_RECORDED_LABEL = 'Not recorded'

/** The key every blank spelling groups under. */
const BLANK_KEY = ''
const BLANK_SPELLINGS: ReadonlySet<string> = new Set(['n/a', 'na', 'none', '-'])

export type Row = ReadonlyArray<unknown>

export interface FilterFieldDef {
  id: string
  label: string
  /** The row's value or values, as the dashboard shows them; '' means blank. */
  read: (row: Row) => string | readonly string[]
  /** Replaces "Not recorded" for fields a chart already labels ('Unspecified', 'Unassigned'). */
  blankLabel?: string
  /** A row this returns false for is not filtered by this field, and adds nothing to its counts. */
  appliesTo?: (row: Row) => boolean
  /** Group keys ticked when nothing else is. A selection equal to this isn't an active filter. */
  defaultKeys?: readonly string[]
  hasSelectAll?: boolean
}

export interface FilterOption {
  key: string
  label: string
  count: number
  isBlank: boolean
}

export interface CatalogField {
  def: FilterFieldDef
  options: FilterOption[]
}

export interface FilterCatalog {
  fields: CatalogField[]
  totalRows: number
}

/** Field id → the group keys ticked in it. */
export type FilterSelection = ReadonlyMap<string, ReadonlySet<string>>

export const NO_SELECTION: FilterSelection = new Map()

interface OptionTally {
  count: number
  /** Rows per trimmed spelling, in the order the spellings were first seen. */
  spellings: Map<string, number>
}

/** The key a value is filtered and counted under: trimmed and lower-cased, with the blank spellings merged. */
export function groupKey(text: string): string {
  const key = text.trim().toLowerCase()
  return BLANK_SPELLINGS.has(key) ? BLANK_KEY : key
}

/** A cell as the dashboard would show it: a Date as yyyy-mm-dd, other values as their text, null as ''. */
export function cellDisplayText(value: unknown): string {
  if (!(value instanceof Date)) return cellText(value)
  if (Number.isNaN(value.getTime())) return ''
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${value.getFullYear()}-${month}-${day}`
}

/** `groupKey` remembered by raw text: a column repeats a few dozen values across all of its rows. */
function createKeyReader(): (text: string) => string {
  const cache = new Map<string, string>()
  return (text: string): string => {
    const cached = cache.get(text)
    if (cached !== undefined) return cached
    const key = groupKey(text)
    cache.set(text, key)
    return key
  }
}

function tallyValue(tallies: Map<string, OptionTally>, key: string, text: string): void {
  const spelling = text.trim()
  let tally = tallies.get(key)
  if (tally === undefined) {
    tally = { count: 0, spellings: new Map() }
    tallies.set(key, tally)
  }
  tally.count += 1
  tally.spellings.set(spelling, (tally.spellings.get(spelling) ?? 0) + 1)
}

/** The most common spelling; the first seen wins a tie. */
function commonSpelling(tally: OptionTally): string {
  let best = ''
  let bestCount = 0
  for (const [spelling, count] of tally.spellings) {
    if (count > bestCount) {
      best = spelling
      bestCount = count
    }
  }
  return best
}

function byCountThenName(a: FilterOption, b: FilterOption): number {
  if (a.isBlank !== b.isBlank) return a.isBlank ? 1 : -1
  return b.count - a.count || NAME_COLLATOR.compare(a.label, b.label)
}

function optionsFrom(tallies: Map<string, OptionTally>, blankLabel: string): FilterOption[] {
  const options: FilterOption[] = []
  for (const [key, tally] of tallies) {
    const isBlank = key === BLANK_KEY
    options.push({ key, label: isBlank ? blankLabel : commonSpelling(tally), count: tally.count, isBlank })
  }
  return options.sort(byCountThenName)
}

/** Every value a read returns, with an empty list counting as one blank value. */
function valuesOf(read: string | readonly string[]): readonly string[] {
  if (typeof read === 'string') return [read]
  return read.length === 0 ? [''] : read
}

/**
 * Each field's values over all `rows`, grouped as `groupKey` does and listed by count descending with the
 * Not recorded group last. A row with several values counts once under each distinct group.
 */
export function buildFilterCatalog(rows: ReadonlyArray<Row>, fields: readonly FilterFieldDef[]): FilterCatalog {
  const keyOf = createKeyReader()
  const catalogFields = fields.map((def): CatalogField => {
    const tallies = new Map<string, OptionTally>()
    for (const row of rows) {
      if (def.appliesTo !== undefined && !def.appliesTo(row)) continue
      const read = def.read(row)
      if (typeof read === 'string') {
        tallyValue(tallies, keyOf(read), read)
        continue
      }
      const seen: string[] = []
      for (const text of valuesOf(read)) {
        const key = keyOf(text)
        if (seen.includes(key)) continue
        seen.push(key)
        tallyValue(tallies, key, text)
      }
    }
    return { def, options: optionsFrom(tallies, def.blankLabel ?? NOT_RECORDED_LABEL) }
  })
  return { fields: catalogFields, totalRows: rows.length }
}

/** The selection with keys the catalog no longer lists removed, and fields left empty (or gone) removed. */
export function normalizeSelection(selection: FilterSelection, catalog: FilterCatalog): FilterSelection {
  let isChanged = false
  const normalized = new Map<string, ReadonlySet<string>>()
  for (const [fieldId, keys] of selection) {
    const field = catalog.fields.find((candidate) => candidate.def.id === fieldId)
    const listed = new Set(field?.options.map((option) => option.key))
    const kept = new Set([...keys].filter((key) => listed.has(key)))
    if (kept.size !== keys.size) isChanged = true
    if (kept.size > 0) normalized.set(fieldId, kept)
    else isChanged = true
  }
  return isChanged ? normalized : selection
}

function isSameSet(a: ReadonlySet<string>, b: readonly string[]): boolean {
  return a.size === b.length && b.every((key) => a.has(key))
}

/** Whether `keys` filters the field. Nothing ticked, or exactly the field's default, is no filter. */
export function isFieldActive(field: CatalogField, keys: ReadonlySet<string> | undefined): boolean {
  if (keys === undefined || keys.size === 0) return false
  const { defaultKeys } = field.def
  return defaultKeys === undefined || !isSameSet(keys, defaultKeys)
}

export function activeFieldCount(catalog: FilterCatalog, selection: FilterSelection): number {
  return catalog.fields.filter((field) => isFieldActive(field, selection.get(field.def.id))).length
}

interface ActiveFilter {
  def: FilterFieldDef
  keys: ReadonlySet<string>
}

function matchesFilter(row: Row, filter: ActiveFilter, keyOf: (text: string) => string): boolean {
  const { def, keys } = filter
  if (def.appliesTo !== undefined && !def.appliesTo(row)) return true
  const read = def.read(row)
  if (typeof read === 'string') return keys.has(keyOf(read))
  return valuesOf(read).some((text) => keys.has(keyOf(text)))
}

/** The keys a field filters by: the ticked ones, or the field's `defaultKeys` when none are ticked. */
export function effectiveKeys(field: CatalogField, selection: FilterSelection): ReadonlySet<string> {
  const keys = selection.get(field.def.id)
  if (keys !== undefined && keys.size > 0) return keys
  return new Set(field.def.defaultKeys)
}

/**
 * The rows every filtered field accepts: a row passes a field when any of its values is in the field's effective
 * keys, and must pass all of them. A field's default limits it here whether or not anything is active, so this is
 * what a dashboard shows with only its defaults set. `rows` itself when no field has any keys.
 */
export function matchEffectiveRows(rows: ReadonlyArray<Row>, catalog: FilterCatalog, selection: FilterSelection): ReadonlyArray<Row> {
  const filters: ActiveFilter[] = []
  for (const field of catalog.fields) {
    const keys = effectiveKeys(field, selection)
    if (keys.size > 0) filters.push({ def: field.def, keys })
  }
  if (filters.length === 0) return rows
  const keyOf = createKeyReader()
  return rows.filter((row) => filters.every((filter) => matchesFilter(row, filter, keyOf)))
}

/**
 * `matchEffectiveRows` once any field is active, so the default limit holds while other fields are filtered.
 *
 * When no field is active this returns `rows` itself, all of them: a dashboard must keep its default-limited
 * base index in that case rather than use the result.
 */
export function matchRows(rows: ReadonlyArray<Row>, catalog: FilterCatalog, selection: FilterSelection): ReadonlyArray<Row> {
  if (activeFieldCount(catalog, selection) === 0) return rows
  return matchEffectiveRows(rows, catalog, selection)
}
