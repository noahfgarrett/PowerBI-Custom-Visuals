import { CircleAlert } from 'lucide-react'
import { act, type ReactElement, type ReactNode } from 'react'
import { vi } from 'vitest'

import { DashboardHeader } from '../components/DashboardHeader'
import { FilterChips } from '../components/FilterChips'
import { useDashboardFilters, type DashboardFilters, type DashboardFiltersOptions } from '../hooks/useDashboardFilters'
import { cellDisplayText, type FilterFieldDef, type Row } from '../rowFilters'
import type { RangeWeek } from '../weekRange'
import { makeWorkWeek } from '../workWeeks'

/** Company, building, status. */
export const ROWS: readonly Row[] = [
  ['LotusWorks', 'F63.1', 'Open'],
  ['LotusWorks', 'F63.2', 'Closed'],
  ['LotusWorks', 'F63.2', 'Open'],
  ['Greyfox', 'F63.1', 'Open'],
  ['Bayside', '', 'Closed'],
  ['', 'F63.1', 'Closed'],
]

export const COMPANY_FIELD: FilterFieldDef = {
  id: 'company',
  label: 'Created By (Company)',
  read: (row) => cellDisplayText(row[0]),
  defaultKeys: ['lotusworks'],
  hasSelectAll: true,
}
export const BUILDING_FIELD: FilterFieldDef = {
  id: 'building',
  label: 'Building',
  read: (row) => cellDisplayText(row[1]),
  blankLabel: 'Unspecified',
}
export const STATUS_FIELD: FilterFieldDef = { id: 'status', label: 'Status', read: (row) => cellDisplayText(row[2]) }

export const PLAIN_FIELDS: readonly FilterFieldDef[] = [BUILDING_FIELD, STATUS_FIELD]
export const DEFAULTED_FIELDS: readonly FilterFieldDef[] = [COMPANY_FIELD, BUILDING_FIELD, STATUS_FIELD]

/** WW30 to WW45 of 2026, the data's weeks, oldest first. */
export const WEEKS: readonly RangeWeek[] = Array.from({ length: 16 }, (_, index) => makeWorkWeek(2026, 30 + index))
export const CURRENT_KEY = 202645

export interface HarnessProps extends Partial<DashboardFiltersOptions> {
  interactive?: boolean
  isRangeDisabled?: boolean
  leading?: ReactNode
  onFilters?: (filters: DashboardFilters) => void
}

/** A dashboard's use of the filters: the hook, the header's menu and the chips under it. */
export function FilterHarness({ interactive = true, isRangeDisabled, leading, onFilters, ...options }: HarnessProps): ReactElement {
  const filters = useDashboardFilters({
    rows: ROWS,
    fields: PLAIN_FIELDS,
    weeks: WEEKS,
    currentKey: CURRENT_KEY,
    ...options,
  })
  onFilters?.(filters)
  return (
    <div className="qaqc-root">
      <DashboardHeader
        title="QCx Issues"
        icon={CircleAlert}
        interactive={interactive}
        range="recent"
        onRangeChange={vi.fn()}
        isRangeDisabled={isRangeDisabled}
        weekOptions={[makeWorkWeek(2026, 45)]}
        selectedKey={CURRENT_KEY}
        onPickWeek={vi.fn()}
        filterMenu={filters.menu}
      >
        {leading}
      </DashboardHeader>
      <FilterChips {...filters.chips} disabled={!interactive} />
    </div>
  )
}

export function click(target: Element): void {
  act(() => {
    target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

export function pick<T extends Element>(container: Element, selector: string, type: new () => T): T {
  const found = container.querySelector(selector)
  if (!(found instanceof type)) throw new Error(`${selector} missing`)
  return found
}

export function filterButton(container: Element): HTMLButtonElement {
  return pick(container, '.qaqc-filter-button', HTMLButtonElement)
}

export function openMenu(container: Element): void {
  click(filterButton(container))
}

export function popover(container: Element): HTMLElement | null {
  return container.querySelector<HTMLElement>('.qaqc-filter-popover')
}

export function checkbox(container: Element, label: string): HTMLInputElement {
  const box = [...container.querySelectorAll<HTMLInputElement>('.qaqc-filter-popover input[type="checkbox"]')]
    .find((input) => input.getAttribute('aria-label')?.startsWith(`${label},`))
  if (box === undefined) throw new Error(`no checkbox ${label}`)
  return box
}

export function checkboxLabels(container: Element): string[] {
  return [...container.querySelectorAll('.qaqc-filter-option-name')].map((node) => node.textContent ?? '')
}

export function toggleSection(container: Element, label: string): void {
  const toggle = [...container.querySelectorAll('.qaqc-filter-section-toggle')]
    .find((button) => button.textContent?.startsWith(label))
  if (toggle === undefined) throw new Error(`no section ${label}`)
  click(toggle)
}

export function buttonNamed(container: Element, text: string): HTMLButtonElement {
  const button = [...container.querySelectorAll('button')].find((candidate) => candidate.textContent === text)
  if (button === undefined) throw new Error(`no button ${text}`)
  return button
}

export function showing(container: Element): string {
  return container.querySelector('.qaqc-filter-showing')?.textContent ?? ''
}

export function badge(container: Element): string | null {
  return container.querySelector('.qaqc-filter-badge')?.textContent ?? null
}

export function chipTexts(container: Element): string[] {
  return [...container.querySelectorAll('.qaqc-filter-chip-text')].map((node) => node.textContent ?? '')
}

export function pressEscape(target: Element): void {
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  })
}

/** A real press: pointerdown, then the click that follows it. */
export function pressAndClick(target: Element): void {
  act(() => {
    target.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
  })
  click(target)
}

export function typeInto(input: HTMLInputElement, text: string): void {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, text)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

export function choose(select: HTMLSelectElement, value: number): void {
  act(() => {
    select.value = String(value)
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
}
