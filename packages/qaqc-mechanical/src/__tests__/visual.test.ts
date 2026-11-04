import type powerbi from 'powerbi-visuals-api'
import { act, createElement, type ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createConstructorOptions } from '../../../core/src/__test-utils__'
import { checkbox, chipTexts, click, openMenu, showing } from '../../../qaqc-shared/src/__tests__/filterHarness'
import { MECHANICAL_ROWS } from '../../../qaqc-shared/src/__tests__/fixtures/mechanicalRows'
import { INSPECTION_OPTIONAL_SLOTS } from '../../../qaqc-shared/src/dataView'
import type { InspectionRows } from '../../../qaqc-shared/src/types'
import capabilities from '../../capabilities.json'
import packageJson from '../../package.json'
import pbiviz from '../../pbiviz.json'
import { QaqcMechanicalVisual } from '../visual'
import { tableDataView } from './tableDataView'

const dashboardControl = vi.hoisted(() => ({ shouldThrow: false }))
const indexBuilds = vi.hoisted((): { rows: unknown[] } => ({ rows: [] }))

// Passes through to the real builder, noting the rows of each build.
vi.mock('../../../qaqc-shared/src/inspections', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../qaqc-shared/src/inspections')>()
  return {
    ...actual,
    buildInspectionIndex: (...args: Parameters<typeof actual.buildInspectionIndex>) => {
      indexBuilds.rows.push(args[0])
      return actual.buildInspectionIndex(...args)
    },
  }
})

// Passes through to the real dashboard; throws during React render when the flag is set.
vi.mock('../../../qaqc-shared/src/components/InspectionDashboard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../qaqc-shared/src/components/InspectionDashboard')>()
  return {
    ...actual,
    InspectionDashboard: (props: ComponentProps<typeof actual.InspectionDashboard>) => {
      if (dashboardControl.shouldThrow) throw new Error('render boom')
      return createElement(actual.InspectionDashboard, props)
    },
  }
})

type ConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions
type UpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions

interface Harness {
  visual: QaqcMechanicalVisual
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
  const visual = new QaqcMechanicalVisual(options as unknown as ConstructorOptions)
  return { visual, element: options.element, host: options.host, events, showContextMenu, tooltip }
}

// powerbi.VisualUpdateType.Resize; Data is 2.
const RESIZE_UPDATE = 4

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
  indexBuilds.rows.length = 0
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
})

describe('QaqcMechanicalVisual name', () => {
  it('heads the dashboard with its QCx title', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(MECHANICAL_ROWS)))
    expect(harness.element.querySelector('.qaqc-header h2')?.textContent).toBe('QCx Mechanical / Process Inspections')
  })

  it('is version 1.1.0 in pbiviz.json and package.json', () => {
    expect(pbiviz.visual.version).toBe('1.1.0.0')
    expect(packageJson.version).toBe('1.1.0')
  })

  it('shows its QCx name in Power BI', () => {
    expect(pbiviz.visual.displayName).toBe('QCx Mechanical / Process Inspections')
    expect(pbiviz.visual.description).not.toContain('QAQC')
  })
})

describe('QaqcMechanicalVisual', () => {
  it('labels the visual for assistive technology', () => {
    harness = createHarness()
    expect(harness.element.getAttribute('aria-label')).toBe('QCx mechanical / process inspections dashboard')
  })

  it('lists the missing field slots before data is bound', () => {
    harness = createHarness()
    apply(harness, update(undefined))
    const items = Array.from(harness.element.querySelectorAll('.qaqc-status li')).map((item) => item.textContent)
    expect(items).toEqual([
      'Work Week Observed → Work Week',
      'Inspection Phase → Inspection Phase',
      'Issue? → Issue?',
      'Building → Building',
      'Index → Row ID',
    ])
  })

  it('renders the dashboard from bound columns', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(MECHANICAL_ROWS)))
    expect(cardValue(harness.element, 'Final Inspections')).toBe('0')
    expect(cardValue(harness.element, 'Finals to Date')).toBe('44')
    expect(totalGroupLabel(harness.element)).toContain("Through WW42'2026")
    expect(cardValue(harness.element, 'NCR Pass Rate')).toBe('97.7%')
    expect(harness.element.querySelector('.qaqc-footnotes')).toBeNull()
  })

  it('applies the preset colors as CSS variables', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(MECHANICAL_ROWS)))
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
    apply(harness, update(tableDataView(MECHANICAL_ROWS)))
    expect(harness.element.style.getPropertyValue('--qaqc-series-1')).toBe('#FFFF00')
  })

  it('requests more segments and shows the loading bar', () => {
    const fetchMoreData = vi.fn(() => true)
    harness = createHarness({ fetchMoreData })
    apply(harness, update(tableDataView(MECHANICAL_ROWS, { segment: true })))
    expect(fetchMoreData).toHaveBeenCalledWith(true)
    expect(harness.element.querySelector('[role="progressbar"]')).not.toBeNull()
  })

  it('renders what it has with a footnote when Power BI refuses more segments', () => {
    harness = createHarness({ fetchMoreData: () => false })
    apply(harness, update(tableDataView(MECHANICAL_ROWS, { segment: true })))
    expect(harness.element.querySelector('.qaqc-footnotes')?.textContent).toContain('Showing the first 138 rows (Power BI data limit)')
  })

  it('shows the setup state until a Row ID is bound', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(MECHANICAL_ROWS, { roles: ['workWeek', 'phase', 'issue', 'building'] })))
    const items = Array.from(harness.element.querySelectorAll('.qaqc-status li')).map((item) => item.textContent)
    expect(items).toEqual(['Index → Row ID'])
  })

  it('reports rendering lifecycle events', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(MECHANICAL_ROWS)))
    expect(harness.events.renderingStarted).toHaveBeenCalledTimes(1)
    expect(harness.events.renderingFinished).toHaveBeenCalledTimes(1)
    expect(harness.events.renderingFailed).not.toHaveBeenCalled()
  })

  it('reports a rendering failure instead of throwing', () => {
    const target = createHarness()
    harness = target
    const broken = tableDataView(MECHANICAL_ROWS)
    Object.defineProperty(broken.table, 'rows', { get: () => { throw new Error('boom') } })
    expect(() => applyOutsideAct(target, update(broken))).not.toThrow()
    expect(target.events.renderingFailed).toHaveBeenCalledWith(expect.anything(), 'boom')
  })

  it('reports a React render error and shows a fallback instead of going blank', () => {
    const target = createHarness()
    harness = target
    dashboardControl.shouldThrow = true
    expect(() => applyOutsideAct(target, update(tableDataView(MECHANICAL_ROWS)))).not.toThrow()
    expect(target.events.renderingFailed).toHaveBeenCalledWith(expect.anything(), 'render boom')
    expect(target.events.renderingFinished).not.toHaveBeenCalled()
    expect(target.element.querySelector('.qaqc-status h2')?.textContent).toBe('Could not draw the QCx Mechanical / Process visual')
  })

  it('recovers on the next update after a render error', () => {
    harness = createHarness()
    dashboardControl.shouldThrow = true
    applyOutsideAct(harness, update(tableDataView(MECHANICAL_ROWS)))
    dashboardControl.shouldThrow = false
    apply(harness, update(tableDataView(MECHANICAL_ROWS)))
    expect(cardValue(harness.element, 'Final Inspections')).toBe('0')
    expect(cardValue(harness.element, 'Finals to Date')).toBe('44')
    expect(totalGroupLabel(harness.element)).toContain("Through WW42'2026")
    expect(harness.events.renderingFinished).toHaveBeenCalledTimes(1)
  })

  it('refreshes the cards when a middle row changes and the row count stays the same', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(MECHANICAL_ROWS)))
    const before = cardValue(harness.element, 'NCR Pass Rate')

    // The first WW08 Final row without an issue sits mid-export, so the first and last rows stay untouched.
    const editedPosition = MECHANICAL_ROWS.findIndex(
      (row) => row[0] === "WW08'2026" && row[1] === 'Final' && row[2] === 'No Issue Found',
    )
    expect(editedPosition).toBeGreaterThan(0)
    const edited = MECHANICAL_ROWS.map((row, position) =>
      position === editedPosition ? [row[0], row[1], 'NCR', row[3]] : row,
    )
    apply(harness, update(tableDataView(edited)))

    expect(before).toBe('97.7%')
    expect(cardValue(harness.element, 'NCR Pass Rate')).toBe('95.5%')
  })

  it('keeps the row-limit footnote across a resize', () => {
    harness = createHarness({ fetchMoreData: () => false })
    apply(harness, update(tableDataView(MECHANICAL_ROWS, { segment: true })))
    apply(harness, update(tableDataView(MECHANICAL_ROWS, { segment: true }), { width: 900, height: 600 }, 0, RESIZE_UPDATE))
    expect(harness.element.querySelector('.qaqc-footnotes')?.textContent).toContain('Showing the first 138 rows')
  })

  it('loads across segments and clears the loading bar on the final append', () => {
    const fetchMoreData = vi.fn(() => true)
    harness = createHarness({ fetchMoreData })
    const partial = MECHANICAL_ROWS.slice(0, 100)
    apply(harness, update(tableDataView(partial, { segment: true }), undefined, 0))
    expect(harness.element.querySelector('[role="progressbar"]')).not.toBeNull()
    expect(cardValue(harness.element, 'Final Inspections')).not.toBeNull()

    apply(harness, update(tableDataView(MECHANICAL_ROWS.slice(0, 120), { segment: true }), undefined, 1))
    expect(harness.element.querySelector('[role="progressbar"]')).not.toBeNull()
    expect(fetchMoreData).toHaveBeenCalledTimes(2)

    apply(harness, update(tableDataView(MECHANICAL_ROWS), undefined, 1))
    expect(harness.element.querySelector('[role="progressbar"]')).toBeNull()
    expect(cardValue(harness.element, 'Final Inspections')).toBe('0')
    expect(cardValue(harness.element, 'NCR Pass Rate')).toBe('97.7%')
    expect(harness.element.querySelector('.qaqc-footnotes')).toBeNull()
  })

  it('clears a reached row limit when a new Create update arrives', () => {
    const fetchMoreData = vi.fn(() => false)
    harness = createHarness({ fetchMoreData })
    apply(harness, update(tableDataView(MECHANICAL_ROWS, { segment: true }), undefined, 0))
    expect(harness.element.querySelector('.qaqc-footnotes')).not.toBeNull()

    fetchMoreData.mockReturnValue(true)
    apply(harness, update(tableDataView(MECHANICAL_ROWS, { segment: true }), undefined, 0))
    expect(fetchMoreData).toHaveBeenCalledTimes(2)
    expect(harness.element.querySelector('.qaqc-footnotes')).toBeNull()
    expect(harness.element.querySelector('[role="progressbar"]')).not.toBeNull()
  })

  it('does not fetch more data on a non-data update', () => {
    const fetchMoreData = vi.fn(() => true)
    harness = createHarness({ fetchMoreData })
    apply(harness, update(tableDataView(MECHANICAL_ROWS), undefined, 0))
    apply(harness, update(tableDataView(MECHANICAL_ROWS, { segment: true }), { width: 900, height: 600 }, 0, RESIZE_UPDATE))
    expect(fetchMoreData).not.toHaveBeenCalled()
  })

  it('opens the host context menu on right-click', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(MECHANICAL_ROWS)))
    harness.element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 50 }))
    expect(harness.showContextMenu).toHaveBeenCalledWith(expect.anything(), { x: 40, y: 50 })
  })

  it('opens the context menu from the keyboard with Shift+F10', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(MECHANICAL_ROWS)))
    harness.element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'F10', shiftKey: true }))
    expect(harness.showContextMenu).toHaveBeenCalledTimes(1)
  })

  it('does not open the context menu when interactions are blocked', () => {
    harness = createHarness({ hostCapabilities: { allowInteractions: false } })
    apply(harness, update(tableDataView(MECHANICAL_ROWS)))
    harness.element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
    expect(harness.showContextMenu).not.toHaveBeenCalled()
  })

  it('returns a Format pane model with four cards', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(MECHANICAL_ROWS)))
    expect(harness.visual.getFormattingModel().cards).toHaveLength(4)
  })
})

describe('QaqcMechanicalVisual filters', () => {
  const DECLARED_SLOTS = INSPECTION_OPTIONAL_SLOTS.filter((slot) => slot.role !== 'inspectionId')

  it('optional roles are declared in capabilities, in order, none required', () => {
    const optionalRoles = DECLARED_SLOTS.map((slot) => slot.role)
    const dataRoles = capabilities.dataRoles.map((role) => role.name)
    expect(dataRoles).toEqual(['workWeek', 'phase', 'issue', 'building', 'rowId', ...optionalRoles])

    const mapping = capabilities.dataViewMappings[0]
    const conditions: Record<string, unknown> = mapping.conditions[0]
    const selected = mapping.table.rows.select.map((item) => item.for.in)
    expect(selected).toEqual(dataRoles)
    for (const role of optionalRoles) {
      expect(conditions[role]).toEqual({ max: 1 })
    }
  })

  it('declares each optional role as a Grouping with its string keys', () => {
    for (const slot of DECLARED_SLOTS) {
      const role = capabilities.dataRoles.find((candidate) => candidate.name === slot.role)
      expect(role?.displayNameKey).toBe(`Qaqc_role_${slot.role}`)
      expect(role?.descriptionKey).toBe(`Qaqc_role_${slot.role}_description`)
      expect(role?.kind).toBe('Grouping')
    }
  })

  it('declares the sheet\'s own QCR / FE spelling, and no Inspection ID', () => {
    const names = capabilities.dataRoles.map((role) => role.name)
    expect(names).not.toContain('inspectionId')
    expect(capabilities.dataRoles.find((role) => role.name === 'qcr')?.displayName).toBe('QCR / FE')
  })

  it('the base index still builds once per data update, not on a filter change', () => {
    const target = createHarness()
    harness = target
    const dataView = tableDataView(MECHANICAL_ROWS)
    apply(target, update(dataView))
    expect(indexBuilds.rows).toEqual([dataView.table?.rows])

    apply(target, update(dataView, { width: 900, height: 600 }, 0, RESIZE_UPDATE))
    expect(indexBuilds.rows).toHaveLength(1)

    openMenu(target.element)
    click(checkbox(target.element, 'F63.1'))
    // The dashboard's own rebuild, over the filtered rows; the base index isn't touched.
    expect(indexBuilds.rows).toHaveLength(2)
    const filtered = indexBuilds.rows[1]
    if (!Array.isArray(filtered)) throw new Error('expected rows')
    expect(filtered.length).toBeLessThan(MECHANICAL_ROWS.length)

    apply(target, update(dataView, { width: 900, height: 600 }, 0, RESIZE_UPDATE))
    expect(indexBuilds.rows).toHaveLength(2)

    click(checkbox(target.element, 'F63.1'))
    expect(indexBuilds.rows).toHaveLength(2)
    expect(chipTexts(target.element)).toEqual([])

    apply(target, update(tableDataView(MECHANICAL_ROWS)))
    expect(indexBuilds.rows).toHaveLength(3)
  })

  it('keeps a filter across a data refresh', () => {
    const target = createHarness()
    harness = target
    apply(target, update(tableDataView(MECHANICAL_ROWS)))
    openMenu(target.element)
    click(checkbox(target.element, 'F63.1'))
    const narrowed = cardValue(target.element, 'Finals to Date')
    apply(target, update(tableDataView(MECHANICAL_ROWS)))
    expect(chipTexts(target.element)).toEqual(['Building: F63.1'])
    expect(cardValue(target.element, 'Finals to Date')).toBe(narrowed)
  })

  it('offers a bound optional column in the menu', () => {
    const target = createHarness()
    harness = target
    const rows: InspectionRows = MECHANICAL_ROWS
    apply(
      target,
      update(tableDataView(MECHANICAL_ROWS, { extraColumns: [{ role: 'generalContractor', value: (rowIndex) => (rowIndex === 0 ? 'Greyfox' : 'Bayside') }] })),
    )
    openMenu(target.element)
    click(checkbox(target.element, 'Greyfox'))
    expect(chipTexts(target.element)).toEqual(['General Contractor: Greyfox'])
    expect(showing(target.element)).toBe(`Showing 1 of ${rows.length} rows`)
  })

  it('disables the Filter button when interactions are blocked', () => {
    harness = createHarness({ hostCapabilities: { allowInteractions: false } })
    apply(harness, update(tableDataView(MECHANICAL_ROWS)))
    expect(harness.element.querySelector<HTMLButtonElement>('.qaqc-filter-button')?.disabled).toBe(true)
  })
})
