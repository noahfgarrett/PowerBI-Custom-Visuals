import type powerbi from 'powerbi-visuals-api'
import { act, createElement, type ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createConstructorOptions } from '../../../core/src/__test-utils__'
import { WELD_SLOTS } from '../../../qaqc-shared/src/dataView'
import { WELDING_ROWS } from '../../../qaqc-shared/src/__tests__/fixtures/weldingRows'
import capabilities from '../../capabilities.json'
import { QaqcWeldingVisual } from '../visual'
import { tableDataView } from './tableDataView'

const dashboardControl = vi.hoisted(() => ({ shouldThrow: false }))

// Passes through to the real dashboard; throws during React render when the flag is set.
vi.mock('../../../qaqc-shared/src/components/WeldingDashboard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../qaqc-shared/src/components/WeldingDashboard')>()
  return {
    ...actual,
    WeldingDashboard: (props: ComponentProps<typeof actual.WeldingDashboard>) => {
      if (dashboardControl.shouldThrow) throw new Error('render boom')
      return createElement(actual.WeldingDashboard, props)
    },
  }
})

type ConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions
type UpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions

interface Harness {
  visual: QaqcWeldingVisual
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
  const visual = new QaqcWeldingVisual(options as unknown as ConstructorOptions)
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

function buildingRowLabels(element: HTMLElement): string[] {
  const panel = Array.from(element.querySelectorAll('section.qaqc-panel')).find(
    (node) => node.getAttribute('aria-label') === 'Issues by Building',
  )
  return Array.from(panel?.querySelectorAll('.qaqc-row-label') ?? []).map((label) => label.textContent ?? '')
}

function stubChartSize(): void {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 800,
    bottom: 400,
    width: 800,
    height: 400,
    toJSON: () => ({}),
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

describe('QaqcWeldingVisual', () => {
  it('labels the visual for assistive technology', () => {
    harness = createHarness()
    expect(harness.element.getAttribute('aria-label')).toBe('Welding signoffs dashboard')
  })

  it('names each data role like its field slot', () => {
    const roleNames = Object.fromEntries(capabilities.dataRoles.map((role) => [role.name, role.displayName]))
    expect(roleNames).toEqual(Object.fromEntries(WELD_SLOTS.map((slot) => [slot.role, slot.slot])))
  })

  it('lists the missing field slots before data is bound', () => {
    harness = createHarness()
    apply(harness, update(undefined))
    const items = Array.from(harness.element.querySelectorAll('.qaqc-status li')).map((item) => item.textContent)
    expect(items).toEqual([
      'WELD WORK WEEK → Weld Work Week',
      'SIGNATURE → Signature',
      'WORK WEEK SIGNED → Work Week Signed',
      'ISSUE CREATED? (Put BIM # If Yes) → Issue Created',
      'FLUID CODE → Fluid Code',
      'PIPE SPEC → Pipe Spec',
      'TAG NO → Tag No',
      'Index → Row ID',
    ])
  })

  it('renders the dashboard from bound columns', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(WELDING_ROWS)))
    expect(cardValue(harness.element, 'Signed This Week')).toBe('70')
    expect(cardValue(harness.element, 'Total Welds')).toBe('1,751')
    expect(totalGroupLabel(harness.element)).toContain("Through WW42'2026")
    expect(harness.element.querySelector('.qaqc-footnotes')).toBeNull()
  })

  it('applies the preset colors as CSS variables', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(WELDING_ROWS)))
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
    apply(harness, update(tableDataView(WELDING_ROWS)))
    expect(harness.element.style.getPropertyValue('--qaqc-series-1')).toBe('#FFFF00')
  })

  it('requests more segments and shows the loading bar', () => {
    const fetchMoreData = vi.fn(() => true)
    harness = createHarness({ fetchMoreData })
    apply(harness, update(tableDataView(WELDING_ROWS, { segment: true })))
    expect(fetchMoreData).toHaveBeenCalledWith(true)
    expect(harness.element.querySelector('[role="progressbar"]')).not.toBeNull()
  })

  it('renders what it has with a footnote when Power BI refuses more segments', () => {
    harness = createHarness({ fetchMoreData: () => false })
    apply(harness, update(tableDataView(WELDING_ROWS, { segment: true })))
    expect(harness.element.querySelector('.qaqc-footnotes')?.textContent).toContain('Showing the first 1,751 rows (Power BI data limit)')
  })

  it('shows the setup state until a Row ID is bound', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(WELDING_ROWS, { roles: ['weldWeek', 'signature', 'signedWeek', 'issue', 'fluidCode', 'pipeSpec', 'tagNo'] })))
    const items = Array.from(harness.element.querySelectorAll('.qaqc-status li')).map((item) => item.textContent)
    expect(items).toEqual(['Index → Row ID'])
  })

  it('reports rendering lifecycle events', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(WELDING_ROWS)))
    expect(harness.events.renderingStarted).toHaveBeenCalledTimes(1)
    expect(harness.events.renderingFinished).toHaveBeenCalledTimes(1)
    expect(harness.events.renderingFailed).not.toHaveBeenCalled()
  })

  it('reports a rendering failure instead of throwing', () => {
    const target = createHarness()
    harness = target
    const broken = tableDataView(WELDING_ROWS)
    Object.defineProperty(broken.table, 'rows', { get: () => { throw new Error('boom') } })
    expect(() => applyOutsideAct(target, update(broken))).not.toThrow()
    expect(target.events.renderingFailed).toHaveBeenCalledWith(expect.anything(), 'boom')
  })

  it('reports a React render error and shows a fallback instead of going blank', () => {
    const target = createHarness()
    harness = target
    dashboardControl.shouldThrow = true
    expect(() => applyOutsideAct(target, update(tableDataView(WELDING_ROWS)))).not.toThrow()
    expect(target.events.renderingFailed).toHaveBeenCalledWith(expect.anything(), 'render boom')
    expect(target.events.renderingFinished).not.toHaveBeenCalled()
    expect(target.element.querySelector('.qaqc-status h2')?.textContent).toBe('Could not draw the Welding visual')
  })

  it('recovers on the next update after a render error', () => {
    harness = createHarness()
    dashboardControl.shouldThrow = true
    applyOutsideAct(harness, update(tableDataView(WELDING_ROWS)))
    dashboardControl.shouldThrow = false
    apply(harness, update(tableDataView(WELDING_ROWS)))
    expect(cardValue(harness.element, 'Signed This Week')).toBe('70')
    expect(cardValue(harness.element, 'Total Welds')).toBe('1,751')
    expect(totalGroupLabel(harness.element)).toContain("Through WW42'2026")
    expect(harness.events.renderingFinished).toHaveBeenCalledTimes(1)
  })

  it('refreshes the cards when a middle row changes and the row count stays the same', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(WELDING_ROWS)))
    const before = cardValue(harness.element, 'Signed This Week')

    // The first row signed in WW42 sits mid-export, so the first and last rows stay untouched.
    const editedPosition = WELDING_ROWS.findIndex((row) => row[1] !== null && row[2] === "WW42'2026")
    expect(editedPosition).toBeGreaterThan(0)
    expect(editedPosition).toBeLessThan(WELDING_ROWS.length - 1)
    const edited = WELDING_ROWS.map((row, position) =>
      position === editedPosition ? [row[0], null, ...row.slice(2)] : row,
    )
    apply(harness, update(tableDataView(edited)))

    expect(before).toBe('70')
    expect(cardValue(harness.element, 'Signed This Week')).toBe('69')
  })

  it('keeps the row-limit footnote across a resize', () => {
    harness = createHarness({ fetchMoreData: () => false })
    apply(harness, update(tableDataView(WELDING_ROWS, { segment: true })))
    apply(harness, update(tableDataView(WELDING_ROWS, { segment: true }), { width: 900, height: 600 }, 0, RESIZE_UPDATE))
    expect(harness.element.querySelector('.qaqc-footnotes')?.textContent).toContain('Showing the first 1,751 rows')
  })

  it('loads across segments and clears the loading bar on the final append', () => {
    const fetchMoreData = vi.fn(() => true)
    harness = createHarness({ fetchMoreData })
    const partial = WELDING_ROWS.slice(0, 100)
    apply(harness, update(tableDataView(partial, { segment: true }), undefined, 0))
    expect(harness.element.querySelector('[role="progressbar"]')).not.toBeNull()
    expect(cardValue(harness.element, 'Signed This Week')).not.toBeNull()

    apply(harness, update(tableDataView(WELDING_ROWS.slice(0, 120), { segment: true }), undefined, 1))
    expect(harness.element.querySelector('[role="progressbar"]')).not.toBeNull()
    expect(fetchMoreData).toHaveBeenCalledTimes(2)

    apply(harness, update(tableDataView(WELDING_ROWS), undefined, 1))
    expect(harness.element.querySelector('[role="progressbar"]')).toBeNull()
    expect(cardValue(harness.element, 'Signed This Week')).toBe('70')
    expect(cardValue(harness.element, 'Total Welds')).toBe('1,751')
    expect(harness.element.querySelector('.qaqc-footnotes')).toBeNull()
  })

  it('clears a reached row limit when a new Create update arrives', () => {
    const fetchMoreData = vi.fn(() => false)
    harness = createHarness({ fetchMoreData })
    apply(harness, update(tableDataView(WELDING_ROWS, { segment: true }), undefined, 0))
    expect(harness.element.querySelector('.qaqc-footnotes')).not.toBeNull()

    fetchMoreData.mockReturnValue(true)
    apply(harness, update(tableDataView(WELDING_ROWS, { segment: true }), undefined, 0))
    expect(fetchMoreData).toHaveBeenCalledTimes(2)
    expect(harness.element.querySelector('.qaqc-footnotes')).toBeNull()
    expect(harness.element.querySelector('[role="progressbar"]')).not.toBeNull()
  })

  it('does not fetch more data on a non-data update', () => {
    const fetchMoreData = vi.fn(() => true)
    harness = createHarness({ fetchMoreData })
    apply(harness, update(tableDataView(WELDING_ROWS), undefined, 0))
    apply(harness, update(tableDataView(WELDING_ROWS, { segment: true }), { width: 900, height: 600 }, 0, RESIZE_UPDATE))
    expect(fetchMoreData).not.toHaveBeenCalled()
  })

  it('opens the host context menu on right-click', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(WELDING_ROWS)))
    harness.element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 50 }))
    expect(harness.showContextMenu).toHaveBeenCalledWith(expect.anything(), { x: 40, y: 50 })
  })

  it('opens the context menu from the keyboard with Shift+F10', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(WELDING_ROWS)))
    harness.element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'F10', shiftKey: true }))
    expect(harness.showContextMenu).toHaveBeenCalledTimes(1)
  })

  it('does not open the context menu when interactions are blocked', () => {
    harness = createHarness({ hostCapabilities: { allowInteractions: false } })
    apply(harness, update(tableDataView(WELDING_ROWS)))
    harness.element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
    expect(harness.showContextMenu).not.toHaveBeenCalled()
  })

  it('returns a Format pane model with five cards', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(WELDING_ROWS)))
    expect(harness.visual.getFormattingModel().cards).toHaveLength(5)
  })

  it('rolls buildings under the default minimum of 10 welds into Other', () => {
    stubChartSize()
    harness = createHarness()
    apply(harness, update(tableDataView(WELDING_ROWS)))
    const labels = buildingRowLabels(harness.element)
    expect(labels).not.toContain('F632')
    expect(labels.some((label) => label.startsWith('Other'))).toBe(true)
  })

  it('passes the Hotspots minimum welds setting to the dashboard', () => {
    stubChartSize()
    harness = createHarness()
    apply(harness, update(tableDataView(WELDING_ROWS, { objects: { hotspots: { minWelds: 1 } } })))
    const labels = buildingRowLabels(harness.element)
    expect(labels).toContain('F632')
    expect(labels.some((label) => label.startsWith('Other'))).toBe(false)
  })
})
