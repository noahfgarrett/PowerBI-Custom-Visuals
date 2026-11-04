import type powerbi from 'powerbi-visuals-api'
import { act, createElement, type ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createConstructorOptions } from '../../../core/src/__test-utils__'
import { ISSUE_SLOTS } from '../../../qaqc-shared/src/dataView'
import { splitCombinedRows } from '../../../qaqc-shared/src/combined'
import { COMBINED_COLUMNS } from '../../../qaqc-shared/src/__tests__/fixtures/combinedRows'
import { ENRICHED_COMBINED_ROWS } from '../../../qaqc-shared/src/__tests__/fixtures/enrichedCombinedRows'
import { buildOverviewIndex, buildOverviewModel } from '../../../qaqc-shared/src/overview'
import type { ViewState } from '../../../qaqc-shared/src/types'
import { ENRICHED_ISSUE_ROWS } from '../../../qaqc-shared/src/__tests__/fixtures/enrichedIssueRows'
import { ISSUE_ROWS } from '../../../qaqc-shared/src/__tests__/fixtures/issueRows'
import capabilities from '../../capabilities.json'
import pbiviz from '../../pbiviz.json'
import { QaqcIssuesVisual } from '../visual'
import { ALL_ROLES, combinedIssueRows, COMBINED_ROLES, ENRICHMENT_ROLES, ROOT_CAUSE_ROLES, tableDataView, type Cell, type SlotRole } from './tableDataView'

const dashboardControl = vi.hoisted(() => ({ shouldThrow: false }))
const inspectionIndexBuilds = vi.hoisted(() => ({ count: 0 }))

// Passes through to the real index builder, counting calls, so tests can show when the visual re-indexes.
vi.mock('../../../qaqc-shared/src/inspections', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../qaqc-shared/src/inspections')>()
  return {
    ...actual,
    buildInspectionIndex: (...args: Parameters<typeof actual.buildInspectionIndex>) => {
      inspectionIndexBuilds.count += 1
      return actual.buildInspectionIndex(...args)
    },
  }
})

// Passes through to the real dashboard; throws during React render when the flag is set.
vi.mock('../../../qaqc-shared/src/components/IssuesDashboard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../qaqc-shared/src/components/IssuesDashboard')>()
  return {
    ...actual,
    IssuesDashboard: (props: ComponentProps<typeof actual.IssuesDashboard>) => {
      if (dashboardControl.shouldThrow) throw new Error('render boom')
      return createElement(actual.IssuesDashboard, props)
    },
  }
})

type ConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions
type UpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions

interface Harness {
  visual: QaqcIssuesVisual
  element: HTMLElement
  host: Record<string, unknown>
  events: { renderingStarted: ReturnType<typeof vi.fn>; renderingFinished: ReturnType<typeof vi.fn>; renderingFailed: ReturnType<typeof vi.fn> }
  showContextMenu: ReturnType<typeof vi.fn>
  tooltip: { show: ReturnType<typeof vi.fn>; move: ReturnType<typeof vi.fn>; hide: ReturnType<typeof vi.fn>; enabled: () => boolean }
}

function createHarness(hostOverrides: Record<string, unknown> = {}): Harness {
  const options = createConstructorOptions()
  const events = { renderingStarted: vi.fn(), renderingFinished: vi.fn(), renderingFailed: vi.fn() }
  const showContextMenu = vi.fn(() => Promise.resolve({}))
  const tooltip = { show: vi.fn(), move: vi.fn(), hide: vi.fn(), enabled: () => true }
  Object.assign(options.host, {
    eventService: events,
    tooltipService: tooltip,
    createSelectionManager: () => ({ showContextMenu, select: vi.fn(), clear: vi.fn(), hasSelection: () => false }),
    ...hostOverrides,
  })
  // The core mock host implements the parts of IVisualHost these tests exercise.
  const visual = new QaqcIssuesVisual(options as unknown as ConstructorOptions)
  return { visual, element: options.element, host: options.host, events, showContextMenu, tooltip }
}

// powerbi.VisualUpdateType.Resize; Data is 2.
const RESIZE_UPDATE = 4

const EXCLUDED_NOTE = '5 issues not created by LotusWorks are excluded'
const ROW_LIMIT_NOTE = 'Showing the first 208 rows (Power BI data limit)'

const CREATED_ON = ALL_ROLES.indexOf('createdOn')
const UPDATED_ON = ALL_ROLES.indexOf('updatedOn')
const DUE_DATE = ALL_ROLES.indexOf('dueDate')
const STATUS = ALL_ROLES.indexOf('status')
const CREATED_BY = ALL_ROLES.indexOf('createdBy')

function update(dataView: powerbi.DataView | undefined, viewport = { width: 1280, height: 720 }, operationKind = 0, type = 2): UpdateOptions {
  return { viewport, dataViews: dataView ? [dataView] : [], type, operationKind }
}

function apply(target: Harness, options: UpdateOptions): void {
  act(() => {
    target.visual.update(options)
  })
}

function totalGroupLabel(element: HTMLElement): string | null {
  return element.querySelector('.qaqc-kpi-group.is-toDate em')?.textContent ?? null
}

function cardValue(element: HTMLElement, label: string): string | null {
  return element.querySelector(`[aria-label^="${label}:"] .qaqc-kpi-value`)?.textContent ?? null
}

function toDateCardValues(element: HTMLElement): Array<string | null> {
  return ['Total Opened', 'Total Closed', 'Remaining Open', 'Closure Rate'].map((label) => cardValue(element, label))
}

function footnotes(element: HTMLElement): string[] {
  return Array.from(element.querySelectorAll('.qaqc-footnotes li')).map((item) => item.textContent ?? '')
}

function setupItems(element: HTMLElement): Array<string | null> {
  return Array.from(element.querySelectorAll('.qaqc-status li')).map((item) => item.textContent)
}

function detailButton(element: HTMLElement): HTMLButtonElement | null {
  return element.querySelector<HTMLButtonElement>('.qaqc-header button[aria-label="Open Issue Detail"]')
}

/** The header button that opens a page, found by its accessible name: `Open the <page> page`. */
function headerButton(element: HTMLElement, label: string): HTMLButtonElement | null {
  return element.querySelector<HTMLButtonElement>(`.qaqc-header button[aria-label="Open the ${label} page"]`)
}

/** Gives every element a measured size, so the page draws in jsdom; the host element sits at the origin. */
function stubElementSize(width = 1280, height = 720): void {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    width,
    height,
    toJSON: () => ({}),
  })
}

/** Opens the Issues by Root Cause Pareto page from the header and returns the page. */
function openPareto(element: HTMLElement): HTMLElement {
  const button = headerButton(element, 'Issues by Root Cause Pareto')
  if (button === null) throw new Error('Pareto button missing')
  stubElementSize()
  act(() => {
    button.click()
  })
  const page = element.querySelector<HTMLElement>('.qaqc-pareto')
  if (page === null) throw new Error('Pareto page missing')
  return page
}

/** Power BI sends date columns as Date objects; the fixture holds M/D/YYYY text. */
function asDate(cell: Cell): Cell {
  if (typeof cell !== 'string') return cell
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(cell)
  return match ? new Date(Number(match[3]), Number(match[1]) - 1, Number(match[2])) : cell
}

/**
 * React diverts render errors to act() while an act scope is open, bypassing onUncaughtError.
 * Power BI never runs inside act, so error-path tests update with the act environment switched off.
 */
function applyOutsideAct(target: Harness, options: UpdateOptions): void {
  globalThis.IS_REACT_ACT_ENVIRONMENT = false
  try {
    target.visual.update(options)
  } finally {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
  }
}

let harness: Harness | null = null

beforeEach(() => {
  dashboardControl.shouldThrow = false
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 15, 12))
})

afterEach(() => {
  act(() => {
    harness?.visual.destroy()
  })
  harness?.element.remove()
  harness = null
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('QaqcIssuesVisual name', () => {
  it('heads the dashboard with its QCx title', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ISSUE_ROWS)))
    expect(harness.element.querySelector('.qaqc-header h2')?.textContent).toBe('QCx Issues')
  })

  it('shows its QCx name in Power BI', () => {
    expect(pbiviz.visual.displayName).toBe('QCx Issues')
    expect(pbiviz.visual.description).not.toContain('QAQC')
  })
})

describe('QaqcIssuesVisual', () => {
  it('labels the visual for assistive technology', () => {
    harness = createHarness()
    expect(harness.element.getAttribute('aria-label')).toBe('QCx Issues dashboard')
  })

  it('names each data role like its field slot', () => {
    const roleNames = Object.fromEntries(capabilities.dataRoles.map((role) => [role.name, role.displayName]))
    expect(roleNames).toEqual(Object.fromEntries(ISSUE_SLOTS.map((slot) => [slot.role, slot.slot])))
  })

  it('lists every field slot before data is bound', () => {
    harness = createHarness()
    apply(harness, update(undefined))
    expect(harness.element.querySelector('.qaqc-status h2')?.textContent).toBe('Add the Issues export columns')
    expect(harness.element.querySelector('.qaqc-status p')?.textContent).toBe(
      'Drag these columns from the Issues sheet of your enriched Autodesk export into the matching field slots.',
    )
    expect(setupItems(harness.element)).toEqual([
      'ID → ID',
      'Title → Title',
      'Status → Status',
      'Type → Type',
      'Contractor → Contractor',
      'Created On → Created On',
      'Updated On → Updated On',
      'Due Date → Due Date',
      'Created By → Created By',
    ])
  })

  it('shows the setup state until every slot is bound', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ISSUE_ROWS, { roles: ALL_ROLES.filter((role) => role !== 'createdBy' && role !== 'dueDate') })))
    expect(setupItems(harness.element)).toEqual(['Due Date → Due Date', 'Created By → Created By'])
    expect(cardValue(harness.element, 'Total Opened')).toBeNull()
  })

  it('renders the QCx Issues header', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ISSUE_ROWS)))
    expect(harness.element.querySelector('.qaqc-header h2')?.textContent).toBe('QCx Issues')
  })

  it('renders the WW42 project-to-date cards from bound columns', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ISSUE_ROWS)))
    expect(totalGroupLabel(harness.element)).toBe("Through WW42'2026")
    expect(toDateCardValues(harness.element)).toEqual(['177', '126', '51', '71.2%'])
  })

  it('reads dates that Power BI delivers as Date objects', () => {
    harness = createHarness()
    const dated = ISSUE_ROWS.map((row) =>
      row.map((cell, position) => (position === CREATED_ON || position === UPDATED_ON || position === DUE_DATE ? asDate(cell) : cell)),
    )
    expect(dated[0][CREATED_ON]).toBeInstanceOf(Date)
    apply(harness, update(tableDataView(dated)))
    expect(toDateCardValues(harness.element)).toEqual(['177', '126', '51', '71.2%'])
  })

  it('footnotes the five issues not created by LotusWorks', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ISSUE_ROWS)))
    expect(footnotes(harness.element)).toEqual([EXCLUDED_NOTE])
  })

  it('drops the footnote when every issue was created by LotusWorks', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ISSUE_ROWS.filter((row) => row[CREATED_BY] === 'LotusWorks'))))
    expect(harness.element.querySelector('.qaqc-footnotes')).toBeNull()
    expect(toDateCardValues(harness.element)).toEqual(['177', '126', '51', '71.2%'])
  })

  it('shows the Issue Detail button when interactions are allowed', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ISSUE_ROWS)))
    expect(detailButton(harness.element)?.textContent).toBe('Issue Detail')
  })

  it('hides the Issue Detail button when interactions are not allowed', () => {
    harness = createHarness({ hostCapabilities: { allowInteractions: false } })
    apply(harness, update(tableDataView(ISSUE_ROWS)))
    expect(cardValue(harness.element, 'Total Opened')).toBe('177')
    expect(detailButton(harness.element)).toBeNull()
  })

  it('hides the Issues by Root Cause Pareto button and keeps Issue Aging when Root Cause is unbound', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ISSUE_ROWS)))
    expect(harness.element.querySelector('.qaqc-status')).toBeNull()
    expect(headerButton(harness.element, 'Issues by Root Cause Pareto')).toBeNull()
    expect(headerButton(harness.element, 'Issue Aging')?.textContent).toBe('Issue Aging')
  })

  it('shows the Issues by Root Cause Pareto button when Root Cause is bound', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ISSUE_ROWS, { roles: [...ALL_ROLES, 'rootCause'] })))
    expect(headerButton(harness.element, 'Issues by Root Cause Pareto')?.textContent).toBe('Issues by Root Cause Pareto')
    expect(toDateCardValues(harness.element)).toEqual(['177', '126', '51', '71.2%'])
  })

  it('opens the Pareto without the category panel when Root Cause Category is unbound', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ISSUE_ROWS, { roles: [...ALL_ROLES, 'rootCause'] })))
    const page = openPareto(harness.element)
    // The page opens on the dashboard's 30 WW window, where Bonding leads.
    expect(page.querySelector('.qaqc-pareto-table h3')?.textContent).toBe('Bonding')
    expect(page.querySelector('section.qaqc-pareto-side')).toBeNull()
    expect(page.querySelector('.qaqc-pareto-readout.is-inline')?.textContent).toContain('Bonding is 5 of 37 (13.5%).')
  })

  it('opens the Pareto with the category panel when both Root Cause slots are bound', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ISSUE_ROWS, { roles: [...ALL_ROLES, ...ROOT_CAUSE_ROLES] })))
    const page = openPareto(harness.element)
    const categories = [...page.querySelectorAll('.qaqc-pareto-categories li span')].map((node) => node.textContent)
    expect(categories[0]).toBe('Quality')
  })

  it('hides the Issues by Root Cause Pareto and Issue Aging buttons when interactions are not allowed', () => {
    harness = createHarness({ hostCapabilities: { allowInteractions: false } })
    apply(harness, update(tableDataView(ISSUE_ROWS, { roles: [...ALL_ROLES, ...ROOT_CAUSE_ROLES] })))
    expect(cardValue(harness.element, 'Total Opened')).toBe('177')
    expect(headerButton(harness.element, 'Issues by Root Cause Pareto')).toBeNull()
    expect(headerButton(harness.element, 'Issue Aging')).toBeNull()
  })

  it('applies the preset colors as CSS variables', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ISSUE_ROWS)))
    expect(harness.element.style.getPropertyValue('--qaqc-series-1')).toBe('#2E5AAC')
  })

  it('uses host colors in high-contrast mode', () => {
    harness = createHarness({
      colorPalette: {
        isHighContrast: true,
        foreground: { value: '#FFFF00' },
        background: { value: '#000000' },
        foregroundSelected: { value: '#00FFFF' },
      },
    })
    apply(harness, update(tableDataView(ISSUE_ROWS)))
    expect(harness.element.style.getPropertyValue('--qaqc-series-1')).toBe('#FFFF00')
  })

  it('requests more segments and shows the loading bar', () => {
    const fetchMoreData = vi.fn(() => true)
    harness = createHarness({ fetchMoreData })
    apply(harness, update(tableDataView(ISSUE_ROWS, { segment: true })))
    expect(fetchMoreData).toHaveBeenCalledWith(true)
    expect(harness.element.querySelector('[role="progressbar"]')).not.toBeNull()
  })

  it('renders what it has with a footnote when Power BI refuses more segments', () => {
    harness = createHarness({ fetchMoreData: () => false })
    apply(harness, update(tableDataView(ISSUE_ROWS, { segment: true })))
    expect(footnotes(harness.element)).toEqual([ROW_LIMIT_NOTE, EXCLUDED_NOTE])
  })

  it('reports rendering lifecycle events', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ISSUE_ROWS)))
    expect(harness.events.renderingStarted).toHaveBeenCalledTimes(1)
    expect(harness.events.renderingFinished).toHaveBeenCalledTimes(1)
    expect(harness.events.renderingFailed).not.toHaveBeenCalled()
  })

  it('reports a rendering failure instead of throwing', () => {
    const target = createHarness()
    harness = target
    const broken = tableDataView(ISSUE_ROWS)
    Object.defineProperty(broken.table, 'rows', { get: () => { throw new Error('boom') } })
    expect(() => applyOutsideAct(target, update(broken))).not.toThrow()
    expect(target.events.renderingFailed).toHaveBeenCalledWith(expect.anything(), 'boom')
  })

  it('reports a React render error and shows a fallback instead of going blank', () => {
    const target = createHarness()
    harness = target
    dashboardControl.shouldThrow = true
    expect(() => applyOutsideAct(target, update(tableDataView(ISSUE_ROWS)))).not.toThrow()
    expect(target.events.renderingFailed).toHaveBeenCalledWith(expect.anything(), 'render boom')
    expect(target.events.renderingFinished).not.toHaveBeenCalled()
    expect(target.element.querySelector('.qaqc-status h2')?.textContent).toBe('Could not draw the QCx Issues visual')
  })

  it('recovers on the next update after a render error', () => {
    harness = createHarness()
    dashboardControl.shouldThrow = true
    applyOutsideAct(harness, update(tableDataView(ISSUE_ROWS)))
    dashboardControl.shouldThrow = false
    apply(harness, update(tableDataView(ISSUE_ROWS)))
    expect(toDateCardValues(harness.element)).toEqual(['177', '126', '51', '71.2%'])
    expect(harness.events.renderingFinished).toHaveBeenCalledTimes(1)
  })

  it('refreshes the cards when a middle row changes and the row count stays the same', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ISSUE_ROWS)))
    const before = cardValue(harness.element, 'Total Closed')

    // The first closed LotusWorks issue sits mid-export, so the first and last rows stay untouched.
    const editedPosition = ISSUE_ROWS.findIndex((row) => row[STATUS] === 'Closed' && row[CREATED_BY] === 'LotusWorks')
    expect(editedPosition).toBeGreaterThan(0)
    expect(editedPosition).toBeLessThan(ISSUE_ROWS.length - 1)
    const edited = ISSUE_ROWS.map((row, position) =>
      position === editedPosition ? row.map((cell, column) => (column === STATUS ? 'Open' : cell)) : row,
    )
    apply(harness, update(tableDataView(edited)))

    expect(before).toBe('126')
    expect(cardValue(harness.element, 'Total Closed')).toBe('125')
    expect(cardValue(harness.element, 'Remaining Open')).toBe('52')
  })

  it('keeps the row-limit footnote across a resize', () => {
    harness = createHarness({ fetchMoreData: () => false })
    apply(harness, update(tableDataView(ISSUE_ROWS, { segment: true })))
    apply(harness, update(tableDataView(ISSUE_ROWS, { segment: true }), { width: 900, height: 600 }, 0, RESIZE_UPDATE))
    expect(footnotes(harness.element)).toContain(ROW_LIMIT_NOTE)
  })

  it('loads across segments and clears the loading bar on the final append', () => {
    const fetchMoreData = vi.fn(() => true)
    harness = createHarness({ fetchMoreData })
    apply(harness, update(tableDataView(ISSUE_ROWS.slice(0, 100), { segment: true }), undefined, 0))
    expect(harness.element.querySelector('[role="progressbar"]')).not.toBeNull()
    expect(cardValue(harness.element, 'Total Opened')).not.toBeNull()

    apply(harness, update(tableDataView(ISSUE_ROWS.slice(0, 150), { segment: true }), undefined, 1))
    expect(harness.element.querySelector('[role="progressbar"]')).not.toBeNull()
    expect(fetchMoreData).toHaveBeenCalledTimes(2)

    apply(harness, update(tableDataView(ISSUE_ROWS), undefined, 1))
    expect(harness.element.querySelector('[role="progressbar"]')).toBeNull()
    expect(toDateCardValues(harness.element)).toEqual(['177', '126', '51', '71.2%'])
    expect(footnotes(harness.element)).toEqual([EXCLUDED_NOTE])
  })

  it('clears a reached row limit when a new Create update arrives', () => {
    const fetchMoreData = vi.fn(() => false)
    harness = createHarness({ fetchMoreData })
    apply(harness, update(tableDataView(ISSUE_ROWS, { segment: true }), undefined, 0))
    expect(footnotes(harness.element)).toContain(ROW_LIMIT_NOTE)

    fetchMoreData.mockReturnValue(true)
    apply(harness, update(tableDataView(ISSUE_ROWS, { segment: true }), undefined, 0))
    expect(fetchMoreData).toHaveBeenCalledTimes(2)
    expect(footnotes(harness.element)).not.toContain(ROW_LIMIT_NOTE)
    expect(harness.element.querySelector('[role="progressbar"]')).not.toBeNull()
  })

  it('does not fetch more data on a non-data update', () => {
    const fetchMoreData = vi.fn(() => true)
    harness = createHarness({ fetchMoreData })
    apply(harness, update(tableDataView(ISSUE_ROWS), undefined, 0))
    apply(harness, update(tableDataView(ISSUE_ROWS, { segment: true }), { width: 900, height: 600 }, 0, RESIZE_UPDATE))
    expect(fetchMoreData).not.toHaveBeenCalled()
  })

  it('opens the host context menu on right-click', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ISSUE_ROWS)))
    harness.element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 50 }))
    expect(harness.showContextMenu).toHaveBeenCalledWith(expect.anything(), { x: 40, y: 50 })
  })

  it('opens the context menu from the keyboard with Shift+F10', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ISSUE_ROWS)))
    harness.element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'F10', shiftKey: true }))
    expect(harness.showContextMenu).toHaveBeenCalledTimes(1)
  })

  it('does not open the context menu when interactions are blocked', () => {
    harness = createHarness({ hostCapabilities: { allowInteractions: false } })
    apply(harness, update(tableDataView(ISSUE_ROWS)))
    harness.element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
    expect(harness.showContextMenu).not.toHaveBeenCalled()
  })

  it('returns a Format pane model with four cards', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ISSUE_ROWS)))
    expect(harness.visual.getFormattingModel().cards).toHaveLength(4)
  })
})

/**
 * The enriched export's rows in the table builder's order: its fixture holds no Root Cause Category column, so a blank
 * one goes in before the enrichment columns.
 */
const ENRICHED_ROWS: Cell[][] = ENRICHED_ISSUE_ROWS.map((cells) => [...cells.slice(0, 10), null, ...cells.slice(10)])
const ENRICHED_ROLES = [...ALL_ROLES, 'rootCause', ...ENRICHMENT_ROLES] as const

describe('QaqcIssuesVisual with the enriched Autodesk export', () => {
  it('shows the WW42 week cards with the enrichment slots bound', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ENRICHED_ROWS, { roles: [...ENRICHED_ROLES] })))
    expect([cardValue(harness.element, 'Issues Opened'), cardValue(harness.element, 'Issues Closed')]).toEqual(['2', '1'])
  })

  it('shows the WW42 project-to-date cards with the enrichment slots bound, counting the migrated issues', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ENRICHED_ROWS, { roles: [...ENRICHED_ROLES] })))
    expect(toDateCardValues(harness.element)).toEqual(['231', '174', '57', '75.3%'])
    expect(footnotes(harness.element)).toEqual(['846 issues not created by LotusWorks are excluded'])
  })

  it('counts only the native Autodesk issues with the enrichment slots unbound, since migrated ones carry the migration account', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ENRICHED_ROWS, { roles: [...ALL_ROLES, 'rootCause'] })))
    expect(toDateCardValues(harness.element)).toEqual(['29', '16', '13', '55.2%'])
    expect(footnotes(harness.element)).toEqual(['1,048 issues not created by LotusWorks are excluded'])
  })
})

describe('QaqcIssuesVisual filters', () => {
  const COMPANY_ROLES = [...ENRICHED_ROLES, 'createdByCompany'] as const
  function openFilterMenu(element: HTMLElement): void {
    act(() => {
      element.querySelector('.qaqc-filter-button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
  }

  it('shows the Filter button, with the company field once its slot is bound', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ENRICHED_ROWS, { roles: [...COMPANY_ROLES] })))
    openFilterMenu(harness.element)
    const sections = [...harness.element.querySelectorAll('.qaqc-filter-section-toggle span:first-of-type')].map((node) => node.textContent)
    expect(sections).toEqual(['Created By (Company)', 'Contractor', 'Status', 'Type', 'Root Cause'])
  })

  it('opens on today\'s visual with the company slot bound', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ENRICHED_ROWS, { roles: [...COMPANY_ROLES] })))
    expect(toDateCardValues(harness.element)).toEqual(['231', '174', '57', '75.3%'])
    expect(footnotes(harness.element)).toEqual(['846 issues not created by LotusWorks are excluded'])
  })

  it('offers no company field with the slot unbound', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ENRICHED_ROWS, { roles: [...ENRICHED_ROLES] })))
    openFilterMenu(harness.element)
    const sections = [...harness.element.querySelectorAll('.qaqc-filter-section-toggle span:first-of-type')].map((node) => node.textContent)
    expect(sections).toEqual(['Contractor', 'Status', 'Type', 'Root Cause'])
  })
})

describe('QaqcIssuesVisual bound to QCx Combined', () => {
  const COMBINED_TABLE = combinedIssueRows()
  const ISSUE_TABLE_ROLES: SlotRole[] = [...ALL_ROLES, 'rootCause', ...ENRICHMENT_ROLES, 'createdByCompany']
  const BOUND_ROLES: SlotRole[] = [...ISSUE_TABLE_ROLES, ...COMBINED_ROLES]
  const WW42 = 202642
  const CARD = 'NCR Pass Rate'
  const CELL_SOURCE = cellOf('source')
  const CELL_WORK_WEEK = cellOf('workWeek')
  const CELL_PHASE = cellOf('phase')
  const CELL_ISSUE = cellOf('issue')
  const CELL_ROW_ID = cellOf('rowId')

  /** A cell's position in `tableDataView`'s row order. */
  function cellOf(role: SlotRole): number {
    return [...ALL_ROLES, ...ROOT_CAUSE_ROLES, ...ENRICHMENT_ROLES, 'createdByCompany', 'discipline', ...COMBINED_ROLES].indexOf(role)
  }

  function combinedView(roles: SlotRole[] = BOUND_ROLES, rows: ReadonlyArray<ReadonlyArray<Cell>> = COMBINED_TABLE): powerbi.DataView {
    return tableDataView(rows, { roles })
  }

  /** The Overview's Inspection NCR pass rate card on the same fixture and today. */
  function overviewPassRate(key: number): string {
    const position = (name: (typeof COMBINED_COLUMNS)[number]): number => COMBINED_COLUMNS.indexOf(name)
    const columns = {
      source: position('Source'),
      workWeek: position('Work Week'),
      phase: position('Inspection Phase'),
      issue: position('Issue'),
      building: position('Building'),
      qcr: position('QCR/FE'),
      welder: position('Welder'),
      tagNo: position('Tag No'),
      signature: position('Signature'),
      signedWeek: position('Work Week Signed'),
      id: position('ID'),
      status: position('Status'),
      type: position('Type'),
      createdOn: position('Created On'),
      updatedOn: position('Updated On'),
      createdBy: position('Created By'),
      rootCause: position('Root Cause'),
      greenTags: -1,
    }
    const index = buildOverviewIndex(splitCombinedRows(ENRICHED_COMBINED_ROWS, columns.source), columns, new Date())
    const view: ViewState = { selectedKey: key, windowEndKey: key, range: 'recent', dateRange: null }
    const card = buildOverviewModel(index, view, 'toDate').quality.find((item) => item.label === 'Inspection NCR pass rate')
    if (card === undefined) throw new Error('Overview card missing')
    return card.display
  }

  function pickWeek(element: HTMLElement, key: number): void {
    const select = element.querySelector<HTMLSelectElement>('.qaqc-week-picker select')
    if (select === null) throw new Error('week picker missing')
    act(() => {
      select.value = String(key)
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
  }

  function openFilterMenu(element: HTMLElement): void {
    act(() => {
      element.querySelector('.qaqc-filter-button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
  }

  /** Power BI groups a table by its bound columns, so rows identical across them arrive as one. */
  function mergedLikePowerBi(rows: ReadonlyArray<ReadonlyArray<Cell>>, cells: readonly number[]): Cell[][] {
    const merged = new Map<string, Cell[]>()
    for (const row of rows) {
      const key = JSON.stringify(cells.map((cell) => row[cell]))
      if (!merged.has(key)) merged.set(key, [...row])
    }
    return [...merged.values()]
  }

  function inspectionRow(rowId: number, week: string, phase: string, issue: string, source = 'Electrical'): Cell[] {
    const cells = new Array<Cell>(COMBINED_TABLE[0].length).fill(null)
    cells[CELL_SOURCE] = source
    cells[CELL_ROW_ID] = rowId
    cells[CELL_WORK_WEEK] = week
    cells[CELL_PHASE] = phase
    cells[CELL_ISSUE] = issue
    return cells
  }

  it('shows the Overview\'s Inspection NCR pass rate through the selected week', () => {
    harness = createHarness()
    apply(harness, update(combinedView()))
    expect(cardValue(harness.element, CARD)).toBe(overviewPassRate(WW42))
    expect(cardValue(harness.element, CARD)).toBe('98.9%')
    pickWeek(harness.element, 202630)
    expect(cardValue(harness.element, CARD)).toBe(overviewPassRate(202630))
    expect(cardValue(harness.element, CARD)).toBe('98.5%')
  })

  it('takes the dashboard\'s issues from the BIM rows alone', () => {
    harness = createHarness()
    apply(harness, update(combinedView()))
    expect(toDateCardValues(harness.element)).toEqual(['231', '174', '57', '75.3%'])
    expect(footnotes(harness.element)).toEqual(['846 issues not created by LotusWorks are excluded'])
    openFilterMenu(harness.element)
    expect(harness.element.querySelector('.qaqc-filter-showing')?.textContent).toBe('Showing 231 of 1,077 rows')
  })

  it('lists only BIM rows in a week\'s drill-down', () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, top: 0, left: 0, right: 1280, bottom: 720, width: 1280, height: 720, toJSON: () => ({}) })
    harness = createHarness()
    apply(harness, update(combinedView()))
    const hit = harness.element.querySelector(`.qaqc-panel-main .qaqc-hit[data-week="${WW42}"]`)
    if (hit === null) throw new Error('week 42 missing')
    act(() => {
      hit.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    const page = [...harness.element.querySelectorAll('[role="dialog"]')].find((node) => node.getAttribute('aria-label')?.startsWith('Issues · '))
    // WW42 on the enriched cards: 2 opened and 1 closed, whatever inspection or welding rows share the week.
    expect([...(page?.querySelectorAll('.qaqc-week-issues-group h4') ?? [])].map((node) => node.textContent)).toEqual(['Opened (2)', 'Closed (1)'])
  })

  it('ignores Welding rows, in the issues and in the card', () => {
    const withoutWelding = COMBINED_TABLE.filter((row) => row[CELL_SOURCE] !== 'Welding')
    harness = createHarness()
    apply(harness, update(combinedView(BOUND_ROLES, withoutWelding)))
    expect(cardValue(harness.element, CARD)).toBe(overviewPassRate(WW42))
    expect(toDateCardValues(harness.element)).toEqual(['231', '174', '57', '75.3%'])
  })

  it('notes rows with an unknown Source and counts them nowhere, as the Overview does', () => {
    const rows = [...COMBINED_TABLE, inspectionRow(90001, "WW42'2026", 'Final', 'NCR', 'Civil'), inspectionRow(90002, "WW42'2026", 'Final', 'NCR', '')]
    harness = createHarness()
    apply(harness, update(combinedView(BOUND_ROLES, rows)))
    expect(cardValue(harness.element, CARD)).toBe(overviewPassRate(WW42))
    expect(footnotes(harness.element)).toEqual(['846 issues not created by LotusWorks are excluded', '2 rows with an unknown Source'])
  })

  it('counts every table row in the row limit note, not only the BIM rows', () => {
    const fetchMoreData = vi.fn(() => false)
    harness = createHarness({ fetchMoreData })
    const dataView = combinedView()
    dataView.metadata.segment = {}
    apply(harness, update(dataView))
    expect(footnotes(harness.element)[0]).toBe(`Showing the first ${COMBINED_TABLE.length.toLocaleString('en-US')} rows (Power BI data limit)`)
  })

  it('with the Source slot unbound, treats every row as an issue, as today, and hides the card', () => {
    const roles = BOUND_ROLES.filter((role) => role !== 'source')
    const rowCount = COMBINED_TABLE.length
    harness = createHarness()
    apply(harness, update(combinedView(roles)))
    expect(cardValue(harness.element, CARD)).toBeNull()
    expect(toDateCardValues(harness.element)).toEqual(['231', '174', '57', '75.3%'])
    // Every inspection row has no creator, so it reads as another company's issue.
    expect(footnotes(harness.element)).toEqual([`${(rowCount - 231).toLocaleString('en-US')} issues not created by LotusWorks are excluded`])
    openFilterMenu(harness.element)
    expect(harness.element.querySelector('.qaqc-filter-showing')?.textContent).toBe(`Showing 231 of ${rowCount.toLocaleString('en-US')} rows`)
  })

  it('with Source bound but an inspection slot not, hides the card, keeps the BIM split and names the missing slots', () => {
    harness = createHarness()
    apply(harness, update(combinedView(BOUND_ROLES.filter((role) => role !== 'workWeek' && role !== 'issue'))))
    expect(cardValue(harness.element, CARD)).toBeNull()
    expect(toDateCardValues(harness.element)).toEqual(['231', '174', '57', '75.3%'])
    expect(footnotes(harness.element)).toEqual([
      '846 issues not created by LotusWorks are excluded',
      'NCR Pass Rate hidden: add Work Week, Issue',
    ])
  })

  it('shows n/a with no Electrical or Mechanical finals', () => {
    const rows = COMBINED_TABLE.filter((row) => row[CELL_SOURCE] === 'BIM')
    harness = createHarness()
    apply(harness, update(combinedView(BOUND_ROLES, rows)))
    expect(cardValue(harness.element, CARD)).toBe('n/a')
  })

  it('declares Row ID as a Grouping role in the table, which is what stops Power BI merging identical rows', () => {
    const role = capabilities.dataRoles.find((item) => item.name === 'rowId')
    expect(role?.kind).toBe('Grouping')
    const selected = capabilities.dataViewMappings[0].table.rows.select.map((item) => item.for.in)
    expect(selected).toEqual(expect.arrayContaining(['source', 'rowId', 'workWeek', 'phase', 'issue']))
  })

  it('identical inspection rows aren\'t merged when Row ID is bound: the finals count matches', () => {
    // Three identical clean finals and one NCR: 75% when all four arrive, 50% if the three merge into one.
    const rows = [
      inspectionRow(1, "WW42'2026", 'Final', 'No Issue Found'),
      inspectionRow(2, "WW42'2026", 'Final', 'No Issue Found'),
      inspectionRow(3, "WW42'2026", 'Final', 'No Issue Found'),
      inspectionRow(4, "WW42'2026", 'Final', 'NCR'),
    ]
    const boundCells = (roles: SlotRole[]): number[] => roles.map(cellOf)

    harness = createHarness()
    apply(harness, update(combinedView(BOUND_ROLES, mergedLikePowerBi(rows, boundCells(BOUND_ROLES)))))
    expect(cardValue(harness.element, CARD)).toBe('75.0%')

    const withoutRowId = BOUND_ROLES.filter((role) => role !== 'rowId')
    apply(harness, update(combinedView(withoutRowId, mergedLikePowerBi(rows, boundCells(withoutRowId)))))
    expect(cardValue(harness.element, CARD)).toBe('50.0%')
  })

  it('builds the inspection index once per data update, not on a resize or a filter change', () => {
    harness = createHarness()
    inspectionIndexBuilds.count = 0
    apply(harness, update(combinedView()))
    expect(inspectionIndexBuilds.count).toBe(1)
    apply(harness, update(combinedView(), { width: 900, height: 700 }, 0, RESIZE_UPDATE))
    expect(inspectionIndexBuilds.count).toBe(1)
    openFilterMenu(harness.element)
    const tick = harness.element.querySelector<HTMLInputElement>('.qaqc-filter-popover input[aria-label^="Greyfox,"]')
    if (tick === null) throw new Error('company checkbox missing')
    act(() => {
      tick.click()
    })
    expect(inspectionIndexBuilds.count).toBe(1)
    apply(harness, update(combinedView()))
    expect(inspectionIndexBuilds.count).toBe(2)
  })

  it('builds no inspection index with the Source slot unbound', () => {
    harness = createHarness()
    inspectionIndexBuilds.count = 0
    apply(harness, update(combinedView(BOUND_ROLES.filter((role) => role !== 'source'))))
    expect(inspectionIndexBuilds.count).toBe(0)
  })
})
