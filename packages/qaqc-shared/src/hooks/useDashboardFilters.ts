import { useMemo, useRef, useState } from 'react'

import type { FilterChip, FilterChipsProps } from '../components/FilterChips'
import type { FilterMenuProps } from '../components/FilterMenu'
import {
  activeFieldCount,
  buildFilterCatalog,
  effectiveKeys,
  isFieldActive,
  matchEffectiveRows,
  matchRows,
  NO_SELECTION,
  normalizeSelection,
  type CatalogField,
  type FilterFieldDef,
  type FilterSelection,
  type Row,
} from '../rowFilters'
import { clampRange, type RangeWeek, type WeekRange } from '../weekRange'

/** A chip lists this many values, then "+N"; its title lists them all. */
const CHIP_VALUE_LIMIT = 3

const NO_NOTES: readonly FilterSourceNote[] = []

export interface FilterSourceNote {
  message: string
  /** Field ids: the note shows while any of these fields is active. */
  whenFieldActive: readonly string[]
}

export interface DashboardFiltersOptions {
  rows: ReadonlyArray<Row>
  /** Must keep its identity between renders: a new list rebuilds the value counts over all `rows`. */
  fields: readonly FilterFieldDef[]
  /** The full data's weeks, for From and To. Never the filtered index's weeks. */
  weeks: readonly RangeWeek[]
  currentKey: number
  notes?: readonly FilterSourceNote[]
  /**
   * A row's week key, or null when it has none. With it, "Showing X of Y" counts only rows in the date range, while a
   * range is set. Must keep its identity between renders.
   */
  rowWeekKey?: (row: Row) => number | null
}

export interface DashboardFilters {
  /** The same reference as `rows` when no field is active. */
  filteredRows: ReadonlyArray<Row>
  dateRange: WeekRange | null
  isAnyActive: boolean
  isFieldFilterActive: boolean
  menu: FilterMenuProps
  chips: FilterChipsProps
  clearAll: () => void
}

function weekLabel(weeks: readonly RangeWeek[], key: number): string {
  return weeks.find((week) => week.key === key)?.label ?? String(key)
}

/** The field's ticked values by label, its default values first, then as the menu lists them. */
function tickedLabels(field: CatalogField, selection: FilterSelection): string[] {
  const keys = effectiveKeys(field, selection)
  const defaults = field.def.defaultKeys ?? []
  const ticked = field.options.filter((option) => keys.has(option.key))
  return [
    ...ticked.filter((option) => defaults.includes(option.key)),
    ...ticked.filter((option) => !defaults.includes(option.key)),
  ].map((option) => option.label)
}

function chipText(labels: readonly string[]): string {
  const shown = labels.slice(0, CHIP_VALUE_LIMIT).join(', ')
  return labels.length > CHIP_VALUE_LIMIT ? `${shown} +${labels.length - CHIP_VALUE_LIMIT}` : shown
}

/** A row with no week is in no range. */
function countRowsInRange(rows: ReadonlyArray<Row>, range: WeekRange, rowWeekKey: (row: Row) => number | null): number {
  let count = 0
  for (const row of rows) {
    const key = rowWeekKey(row)
    if (key !== null && key >= range.fromKey && key <= range.toKey) count += 1
  }
  return count
}

/**
 * A dashboard's filter state: the ticked values and date range the menu and chips edit, and the rows they leave.
 * `selection` and `dateRange` are read through the current data on every render and never written back, so during a
 * partial load a ticked value still to arrive isn't lost, and a field a dashboard stops offering keeps its values.
 */
export function useDashboardFilters({ rows, fields, weeks, currentKey, notes = NO_NOTES, rowWeekKey }: DashboardFiltersOptions): DashboardFilters {
  const [ticked, setTicked] = useState<FilterSelection>(NO_SELECTION)
  const [pickedRange, setPickedRange] = useState<WeekRange | null>(null)
  const filterButtonRef = useRef<HTMLButtonElement | null>(null)

  const catalog = useMemo(() => buildFilterCatalog(rows, fields), [rows, fields])
  const selection = useMemo(() => normalizeSelection(ticked, catalog), [ticked, catalog])
  const dateRange = useMemo(() => (pickedRange === null ? null : clampRange(pickedRange, weeks)), [pickedRange, weeks])
  const filteredRows = useMemo(() => matchRows(rows, catalog, selection), [rows, catalog, selection])

  const activeFields = activeFieldCount(catalog, selection)
  const isFieldFilterActive = activeFields > 0
  const isDateRangeActive = dateRange !== null

  // A default limits what the dashboard shows without being a filter, so the count can't read `filteredRows` then.
  const shownRows = useMemo(() => {
    const shown = isFieldFilterActive ? filteredRows : matchEffectiveRows(rows, catalog, selection)
    if (dateRange === null || rowWeekKey === undefined) return shown.length
    return countRowsInRange(shown, dateRange, rowWeekKey)
  }, [isFieldFilterActive, filteredRows, rows, catalog, selection, dateRange, rowWeekKey])

  function setFieldKeys(fieldId: string, keys: ReadonlySet<string>): void {
    setTicked((current) => {
      const next = new Map(current)
      if (keys.size === 0) next.delete(fieldId)
      else next.set(fieldId, keys)
      return next
    })
  }

  function toggleValue(field: CatalogField, key: string, isTicked: boolean): void {
    const keys = new Set(effectiveKeys(field, selection))
    if (isTicked) keys.add(key)
    else keys.delete(key)
    setFieldKeys(field.def.id, keys)
  }

  function selectAll(field: CatalogField): void {
    setFieldKeys(field.def.id, new Set(field.options.map((option) => option.key)))
  }

  // A range covering every week is no range, so it's stored as none: stored, new weeks would turn it into an active one.
  function changeRange(range: WeekRange | null): void {
    setPickedRange(range === null ? null : clampRange(range, weeks))
  }

  function clearAll(): void {
    setTicked(NO_SELECTION)
    setPickedRange(null)
  }

  const chipList: FilterChip[] = []
  if (dateRange !== null) {
    const text = `${weekLabel(weeks, dateRange.fromKey)} to ${weekLabel(weeks, dateRange.toKey)}`
    chipList.push({ id: 'date-range', label: 'Date range', text, fullText: text, onRemove: () => setPickedRange(null) })
  }
  for (const field of catalog.fields) {
    if (!isFieldActive(field, selection.get(field.def.id))) continue
    const labels = tickedLabels(field, selection)
    chipList.push({
      id: field.def.id,
      label: field.def.label,
      text: chipText(labels),
      fullText: labels.join(', '),
      onRemove: () => setFieldKeys(field.def.id, new Set()),
    })
  }

  const isIdActive = (fieldId: string): boolean =>
    catalog.fields.some((field) => field.def.id === fieldId && isFieldActive(field, selection.get(fieldId)))

  return {
    filteredRows,
    dateRange,
    isAnyActive: isFieldFilterActive || isDateRangeActive,
    isFieldFilterActive,
    menu: {
      catalog,
      selection,
      weeks,
      currentKey,
      dateRange,
      activeCount: activeFields + (isDateRangeActive ? 1 : 0),
      shownRows,
      totalRows: catalog.totalRows,
      buttonRef: filterButtonRef,
      onToggleValue: toggleValue,
      onSelectAll: selectAll,
      onRangeChange: changeRange,
      onClearAll: clearAll,
    },
    chips: {
      chips: chipList,
      notes: notes.filter((note) => note.whenFieldActive.some(isIdActive)).map((note) => note.message),
      onClearAll: clearAll,
      onFocusLost: () => filterButtonRef.current?.focus({ preventScroll: true }),
    },
    clearAll,
  }
}
