import { CalendarDays, ChevronDown, ChevronRight, ListFilter, Search } from 'lucide-react'
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type RefObject,
} from 'react'

import { formatCount } from '../format'
import { effectiveKeys, isFieldActive, type CatalogField, type FilterCatalog, type FilterSelection } from '../rowFilters'
import { clampRange, presetRange, type RangePreset, type RangeWeek, type WeekRange } from '../weekRange'

/** `.qaqc-filter-popover`'s width in qaqc.less. */
const POPOVER_WIDTH = 348
const POPOVER_GAP = 6
const TILE_MARGIN = 10
/** However short the tile, the popover stays tall enough to scroll through. */
const POPOVER_MIN_HEIGHT = 120

const NO_SEARCHES: ReadonlyMap<string, string> = new Map()
const NO_FIELD_IDS: ReadonlySet<string> = new Set()

const PRESETS: ReadonlyArray<{ preset: RangePreset; text: string }> = [
  { preset: 'last4', text: 'Last 4 WW' },
  { preset: 'last13', text: 'Last 13 WW' },
  { preset: 'thisYear', text: 'This year' },
]

export interface FilterMenuProps {
  catalog: FilterCatalog
  selection: FilterSelection
  /** The full data's weeks, oldest first. */
  weeks: readonly RangeWeek[]
  currentKey: number
  dateRange: WeekRange | null
  /** Active filter groups: each active field, and the date range as one. */
  activeCount: number
  shownRows: number
  totalRows: number
  buttonRef: RefObject<HTMLButtonElement | null>
  disabled?: boolean
  onToggleValue: (field: CatalogField, key: string, isTicked: boolean) => void
  onSelectAll: (field: CatalogField) => void
  onRangeChange: (range: WeekRange | null) => void
  onClearAll: () => void
}

interface PopoverPlacement {
  maxHeight: number
  maxWidth: number
  right: number
}

/**
 * Fits the popover inside the tile: it hangs from the button, right-aligned, moving sideways only if that would pass
 * the tile's edge (a compact header can wrap the button to the left). Null with no layout to measure.
 */
function measurePlacement(anchor: HTMLElement): PopoverPlacement | null {
  const root = anchor.closest('.qaqc-root')
  if (root === null) return null
  const tile = root.getBoundingClientRect()
  if (tile.width === 0 || tile.height === 0) return null
  const button = anchor.getBoundingClientRect()
  const maxWidth = tile.width - 2 * TILE_MARGIN
  const width = Math.min(POPOVER_WIDTH, maxWidth)
  const lowest = tile.left + TILE_MARGIN
  const highest = tile.right - TILE_MARGIN - width
  const left = Math.max(lowest, Math.min(highest, button.right - width))
  return {
    maxHeight: Math.max(POPOVER_MIN_HEIGHT, tile.bottom - button.bottom - POPOVER_GAP - TILE_MARGIN),
    maxWidth,
    right: button.right - (left + width),
  }
}

/**
 * Finishes an outside press that closed the menu, once its click arrives: the click dismissed the menu, so it doesn't
 * also select a chart's week, and focus goes back to the button unless the press landed on something focusable. A
 * press with no click after it, such as one that opened a native dropdown, ends at the next press.
 */
function settleDismissingClick(button: HTMLElement | null): void {
  function stopWaiting(): void {
    document.removeEventListener('click', settle, true)
    document.removeEventListener('pointerdown', stopWaiting, true)
  }
  function settle(event: MouseEvent): void {
    stopWaiting()
    if (event.target instanceof Element && event.target.closest('.qaqc-hit') !== null) event.stopPropagation()
    if (document.activeElement === null || document.activeElement === document.body) button?.focus({ preventScroll: true })
  }
  document.addEventListener('click', settle, true)
  document.addEventListener('pointerdown', stopWaiting, true)
}

function isSameRange(a: WeekRange | null, b: WeekRange | null): boolean {
  return a !== null && b !== null && a.fromKey === b.fromKey && a.toKey === b.toKey
}

interface WeekSelectProps {
  label: string
  weeks: readonly RangeWeek[]
  value: number | undefined
  /** The limit this dropdown marks, and the word it marks it with. */
  limitKey: number | undefined
  limitWord: string
  isSet: boolean
  isOffered: (key: number) => boolean
  onChange: (key: number) => void
}

function WeekSelect({ label, weeks, value, limitKey, limitWord, isSet, isOffered, onChange }: WeekSelectProps): ReactElement {
  const id = useId()
  return (
    <div>
      <label className="qaqc-filter-field-label" htmlFor={id}>
        {label}
      </label>
      <div className={`qaqc-filter-select${isSet ? ' is-set' : ''}`}>
        <select
          id={id}
          value={value === undefined ? '' : String(value)}
          disabled={weeks.length === 0}
          onChange={(event) => onChange(Number(event.target.value))}
        >
          {[...weeks].reverse().map((week) => (
            <option key={week.key} value={String(week.key)} disabled={!isOffered(week.key)}>
              {week.key === limitKey ? `${week.label} (${limitWord})` : week.label}
            </option>
          ))}
        </select>
        <ChevronDown size={13} aria-hidden="true" />
      </div>
    </div>
  )
}

type DateRangeSectionProps = Pick<FilterMenuProps, 'weeks' | 'currentKey' | 'dateRange' | 'onRangeChange'>

function DateRangeSection({ weeks, currentKey, dateRange, onRangeChange }: DateRangeSectionProps): ReactElement {
  const titleId = useId()
  const firstKey = weeks.length > 0 ? weeks[0].key : undefined
  const lastKey = weeks.length > 0 ? weeks[weeks.length - 1].key : undefined
  const fromKey = dateRange?.fromKey ?? firstKey
  const toKey = dateRange?.toKey ?? lastKey

  function presetFor(preset: RangePreset): WeekRange | null {
    return clampRange(presetRange(preset, weeks, currentKey), weeks)
  }

  return (
    <div className="qaqc-filter-date" role="group" aria-labelledby={titleId}>
      <h3 id={titleId}>
        <CalendarDays size={14} aria-hidden="true" />
        Date range
      </h3>
      <div className="qaqc-filter-date-row">
        <WeekSelect
          label="From"
          weeks={weeks}
          value={fromKey}
          limitKey={firstKey}
          limitWord="start"
          isSet={dateRange !== null && dateRange.fromKey !== firstKey}
          isOffered={(key) => toKey === undefined || key <= toKey}
          onChange={(key) => onRangeChange({ fromKey: key, toKey: toKey ?? key })}
        />
        <WeekSelect
          label="To"
          weeks={weeks}
          value={toKey}
          limitKey={lastKey}
          limitWord="now"
          isSet={dateRange !== null && dateRange.toKey !== lastKey}
          isOffered={(key) => fromKey === undefined || key >= fromKey}
          onChange={(key) => onRangeChange({ fromKey: fromKey ?? key, toKey: key })}
        />
      </div>
      <div className="qaqc-filter-presets" role="group" aria-label="Date range presets">
        {PRESETS.map(({ preset, text }) => {
          const isPressed = isSameRange(dateRange, presetFor(preset))
          return (
            <button
              key={preset}
              type="button"
              className="qaqc-filter-preset"
              aria-pressed={isPressed}
              disabled={weeks.length === 0}
              onClick={() => onRangeChange(isPressed ? null : presetFor(preset))}
            >
              {text}
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface FilterFieldSectionProps {
  field: CatalogField
  selection: FilterSelection
  isOpen: boolean
  search: string
  onToggleOpen: () => void
  onSearchChange: (text: string) => void
  onToggleValue: FilterMenuProps['onToggleValue']
  onSelectAll: FilterMenuProps['onSelectAll']
}

function FilterFieldSection({
  field,
  selection,
  isOpen,
  search,
  onToggleOpen,
  onSearchChange,
  onToggleValue,
  onSelectAll,
}: FilterFieldSectionProps): ReactElement {
  const baseId = useId()
  const toggleId = `${baseId}-toggle`
  const bodyId = `${baseId}-body`
  const { def, options } = field
  const keys = effectiveKeys(field, selection)
  const isActive = isFieldActive(field, selection.get(def.id))
  const defaultLabels = options.filter((option) => def.defaultKeys?.includes(option.key)).map((option) => option.label).join(', ')
  const summary = isActive ? `${keys.size} selected` : defaultLabels === '' ? 'All' : defaultLabels
  const query = search.trim().toLowerCase()
  const listed = query === '' ? options : options.filter((option) => option.label.toLowerCase().includes(query))

  return (
    <section className="qaqc-filter-section">
      <h3>
        <button
          id={toggleId}
          type="button"
          className="qaqc-filter-section-toggle"
          aria-expanded={isOpen}
          aria-controls={isOpen ? bodyId : undefined}
          onClick={onToggleOpen}
        >
          <ChevronRight size={14} aria-hidden="true" />
          <span>{def.label}</span>
          <span className={`qaqc-filter-section-summary${isActive ? ' is-set' : ''}`}>{summary}</span>
        </button>
      </h3>
      {isOpen && (
        <div id={bodyId} className="qaqc-filter-section-body">
          <div className="qaqc-filter-search-row">
            <div className="qaqc-filter-search">
              <Search size={13} aria-hidden="true" />
              <input
                type="search"
                value={search}
                placeholder={`Search ${def.label}`}
                aria-label={`Search ${def.label} values`}
                onChange={(event) => onSearchChange(event.target.value)}
              />
            </div>
            {def.hasSelectAll === true && (
              <button type="button" className="qaqc-filter-link" onClick={() => onSelectAll(field)}>
                Select all
              </button>
            )}
          </div>
          {defaultLabels !== '' && (
            <p className="qaqc-filter-hint">Default is {defaultLabels}, the same issues the visual shows today.</p>
          )}
          <ul className="qaqc-filter-options" role="group" aria-labelledby={toggleId}>
            {listed.map((option) => (
              <li key={option.key} className={option.isBlank ? 'is-blank' : undefined}>
                <label className="qaqc-filter-option" title={option.label}>
                  <input
                    type="checkbox"
                    checked={keys.has(option.key)}
                    aria-label={`${option.label}, ${formatCount(option.count)} ${option.count === 1 ? 'row' : 'rows'}`}
                    onChange={(event) => onToggleValue(field, option.key, event.target.checked)}
                  />
                  <span className="qaqc-filter-option-name">{option.label}</span>
                  <span className="qaqc-filter-option-count">{formatCount(option.count)}</span>
                </label>
              </li>
            ))}
          </ul>
          {listed.length === 0 && <p className="qaqc-filter-no-match">No matching values</p>}
        </div>
      )}
    </section>
  )
}

/** The header's Filter button and its popover: the date range, a section per field, and the live row count. */
export function FilterMenu({
  catalog,
  selection,
  weeks,
  currentKey,
  dateRange,
  activeCount,
  shownRows,
  totalRows,
  buttonRef,
  disabled = false,
  onToggleValue,
  onSelectAll,
  onRangeChange,
  onClearAll,
}: FilterMenuProps): ReactElement {
  const [isOpen, setIsOpen] = useState(false)
  // Sections whose open state differs from their starting one: the first field starts open, the rest closed.
  const [toggledIds, setToggledIds] = useState<ReadonlySet<string>>(NO_FIELD_IDS)
  const [searches, setSearches] = useState<ReadonlyMap<string, string>>(NO_SEARCHES)
  const [placement, setPlacement] = useState<PopoverPlacement | null>(null)
  const anchorRef = useRef<HTMLDivElement | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const popoverId = useId()

  if (disabled && isOpen) setIsOpen(false)

  function closeMenu(shouldReturnFocus: boolean): void {
    setIsOpen(false)
    setSearches(NO_SEARCHES)
    if (shouldReturnFocus) buttonRef.current?.focus({ preventScroll: true })
  }

  useLayoutEffect(() => {
    if (!isOpen) return undefined
    function place(): void {
      if (anchorRef.current !== null) setPlacement(measurePlacement(anchorRef.current))
    }
    place()
    popoverRef.current?.focus({ preventScroll: true })
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return undefined
    function isInside(target: EventTarget | null): boolean {
      return target instanceof Node && anchorRef.current?.contains(target) === true
    }
    function handlePointerDown(event: Event): void {
      if (isInside(event.target)) return
      closeMenu(false)
      settleDismissingClick(buttonRef.current)
    }
    function handleFocusIn(event: Event): void {
      if (!isInside(event.target)) closeMenu(false)
    }
    // A press outside the visual's iframe fires no pointerdown here, only this. So can a select's native popup, which
    // must not close the menu it belongs to.
    function handleWindowBlur(): void {
      const active = document.activeElement
      if (active instanceof HTMLSelectElement && isInside(active)) return
      closeMenu(false)
    }
    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('focusin', handleFocusIn)
    window.addEventListener('blur', handleWindowBlur)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('focusin', handleFocusIn)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [isOpen])

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key !== 'Escape' || !isOpen) return
    // Esc closes the menu first; anything under it, such as an open page, waits for the next press.
    event.stopPropagation()
    closeMenu(true)
  }

  function toggleSection(fieldId: string): void {
    setToggledIds((current) => {
      const next = new Set(current)
      if (!next.delete(fieldId)) next.add(fieldId)
      return next
    })
  }

  function clearAll(): void {
    if (activeCount === 0) return
    onClearAll()
    setSearches(NO_SEARCHES)
  }

  const firstFieldId = catalog.fields.length > 0 ? catalog.fields[0].def.id : null

  return (
    <div ref={anchorRef} className="qaqc-filter-anchor" onKeyDown={handleKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        className={`qaqc-header-button qaqc-filter-button${activeCount > 0 ? ' is-active' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? popoverId : undefined}
        aria-label={activeCount > 0 ? `Filter, ${activeCount} active` : undefined}
        disabled={disabled}
        onClick={() => (isOpen ? closeMenu(true) : setIsOpen(true))}
      >
        <ListFilter size={14} aria-hidden="true" />
        <span>Filter</span>
        {activeCount > 0 && <span className="qaqc-filter-badge">{activeCount}</span>}
      </button>
      {isOpen && (
        <div
          ref={popoverRef}
          id={popoverId}
          className="qaqc-filter-popover"
          role="dialog"
          aria-label="Filter"
          tabIndex={-1}
          style={placement ?? undefined}
        >
          <DateRangeSection weeks={weeks} currentKey={currentKey} dateRange={dateRange} onRangeChange={onRangeChange} />
          {catalog.fields.map((field) => (
            <FilterFieldSection
              key={field.def.id}
              field={field}
              selection={selection}
              isOpen={(field.def.id === firstFieldId) !== toggledIds.has(field.def.id)}
              search={searches.get(field.def.id) ?? ''}
              onToggleOpen={() => toggleSection(field.def.id)}
              onSearchChange={(text) => setSearches((current) => new Map(current).set(field.def.id, text))}
              onToggleValue={onToggleValue}
              onSelectAll={onSelectAll}
            />
          ))}
          <div className="qaqc-filter-footer">
            <button type="button" className="qaqc-filter-link" aria-disabled={activeCount === 0} onClick={clearAll}>
              Clear all
            </button>
            <output className="qaqc-filter-showing" aria-live="polite">
              Showing {formatCount(shownRows)} of {formatCount(totalRows)} rows
            </output>
          </div>
        </div>
      )}
    </div>
  )
}
