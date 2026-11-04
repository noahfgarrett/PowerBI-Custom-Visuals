import type powerbi from 'powerbi-visuals-api'
import { act, createElement, type ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createConstructorOptions } from '../../../core/src/__test-utils__'
import { ISSUE_SLOTS } from '../../../qaqc-shared/src/dataView'
import { ENRICHED_ISSUE_ROWS } from '../../../qaqc-shared/src/__tests__/fixtures/enrichedIssueRows'
import { ISSUE_ROWS } from '../../../qaqc-shared/src/__tests__/fixtures/issueRows'
import capabilities from '../../capabilities.json'
import pbiviz from '../../pbiviz.json'
import { QaqcIssuesVisual } from '../visual'
import { ALL_ROLES, ENRICHMENT_ROLES, ROOT_CAUSE_ROLES, tableDataView, type Cell } from './tableDataView'

const dashboardControl = vi.hoisted(() => ({ shouldThrow: false }))

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
