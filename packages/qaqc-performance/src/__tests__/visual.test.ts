import type powerbi from 'powerbi-visuals-api'
import { act, createElement, type ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createConstructorOptions } from '../../../core/src/__test-utils__'
import { PERFORMANCE_SLOTS } from '../../../qaqc-shared/src/dataView'
import { COMBINED_COLUMNS, COMBINED_ROWS } from '../../../qaqc-shared/src/__tests__/fixtures/combinedRows'
import capabilities from '../../capabilities.json'
import { QaqcPerformanceVisual } from '../visual'
import { ALL_ROLES, tableDataView } from './tableDataView'

const dashboardControl = vi.hoisted(() => ({ shouldThrow: false }))

// Passes through to the real dashboard; throws during React render when the flag is set.
vi.mock('../../../qaqc-shared/src/components/PerformanceDashboard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../qaqc-shared/src/components/PerformanceDashboard')>()
  return {
    ...actual,
    PerformanceDashboard: (props: ComponentProps<typeof actual.PerformanceDashboard>) => {
      if (dashboardControl.shouldThrow) throw new Error('render boom')
      return createElement(actual.PerformanceDashboard, props)
    },
  }
})

type ConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions
type UpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions

interface Harness {
  visual: QaqcPerformanceVisual
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
  const visual = new QaqcPerformanceVisual(options as unknown as ConstructorOptions)
  return { visual, element: options.element, host: options.host, events, showContextMenu, tooltip }
}

// powerbi.VisualUpdateType.Resize; Data is 2.
const RESIZE_UPDATE = 4

const NOT_RECORDED_NOTE = '70 inspections have no QCR/FE'
const ROW_LIMIT_NOTE = 'Showing the first 2,385 rows (Power BI data limit)'
const SOURCE = COMBINED_COLUMNS.indexOf('Source')
const QCR = COMBINED_COLUMNS.indexOf('QCR/FE')

function update(dataView: powerbi.DataView | undefined, viewport = { width: 1280, height: 720 }, operationKind = 0, type = 2): UpdateOptions {
  return { viewport, dataViews: dataView ? [dataView] : [], type, operationKind }
}

function apply(target: Harness, options: UpdateOptions): void {
  act(() => {
    target.visual.update(options)
  })
}

function click(target: Element | null | undefined): void {
  if (!target) throw new Error('click target missing')
  act(() => {
    target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

// Matches labels in code: jsdom's selector engine mishandles "%" inside attribute values.
function cardValue(element: HTMLElement, label: string): string | null {
  const card = [...element.querySelectorAll('article.qaqc-kpi')].find((node) => node.getAttribute('aria-label')?.startsWith(`${label}:`))
  return card?.querySelector('.qaqc-kpi-value')?.textContent ?? null
}

function summaryValues(element: HTMLElement): Array<string | null> {
  return [...element.querySelectorAll('.qaqc-perf-summary .qaqc-kpi-value')].map((node) => node.textContent)
}

function footnotes(element: HTMLElement): string[] {
  return Array.from(element.querySelectorAll('.qaqc-footnotes li')).map((item) => item.textContent ?? '')
}

function setupItems(element: HTMLElement): Array<string | null> {
  return Array.from(element.querySelectorAll('.qaqc-status li')).map((item) => item.textContent)
}

function groupButton(element: HTMLElement, label: string): HTMLButtonElement | null {
  return [...element.querySelectorAll<HTMLButtonElement>('[aria-label="People group"] button')].find((node) => node.textContent === label) ?? null
}

function nameButton(element: HTMLElement, name: string): HTMLButtonElement | null {
  return [...element.querySelectorAll<HTMLButtonElement>('button.qaqc-perf-name')].find((node) => node.textContent === name) ?? null
}

function ranking(objects: Record<string, number>): powerbi.DataViewObjects {
  return { ranking: objects }
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

describe('QaqcPerformanceVisual', () => {
  it('labels the visual for assistive technology', () => {
    harness = createHarness()
    expect(harness.element.getAttribute('aria-label')).toBe('QAQC performance dashboard')
  })

  it('names each data role like its field slot', () => {
    const roleNames = Object.fromEntries(capabilities.dataRoles.map((role) => [role.name, role.displayName]))
    expect(roleNames).toEqual(Object.fromEntries(PERFORMANCE_SLOTS.map((slot) => [slot.role, slot.slot])))
  })

  it('lets every role take one column and requires none in the mapping, so the slots are checked in code', () => {
    const [condition] = capabilities.dataViewMappings[0].conditions
    expect(Object.keys(condition)).toEqual(PERFORMANCE_SLOTS.map((slot) => slot.role))
    expect(Object.values(condition).every((range) => range.max === 1 && !('min' in range))).toBe(true)
  })

  it('lists every field slot before data is bound', () => {
    harness = createHarness()
    apply(harness, update(undefined))
    expect(harness.element.querySelector('.qaqc-status h2')?.textContent).toBe('Add the QAQC Combined columns')
    expect(setupItems(harness.element)).toEqual([
      'Source → Source',
      'Row ID → Row ID',
      'Work Week → Work Week',
      'Inspection Phase → Inspection Phase',
      'Issue → Issue',
      'Building → Building',
      'QCR/FE → QCR/FE',
      'Welder → Welder',
      'Tag No → Tag No',
    ])
  })

  it('shows the setup state until every slot is bound', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(COMBINED_ROWS, { roles: ALL_ROLES.filter((role) => role !== 'welder' && role !== 'rowId') })))
    expect(setupItems(harness.element)).toEqual(['Row ID → Row ID', 'Welder → Welder'])
    expect(cardValue(harness.element, 'QCR/FE ranked')).toBeNull()
  })

  it('renders the QAQC Performance header with the people icon', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(COMBINED_ROWS)))
    expect(harness.element.querySelector('.qaqc-header h2')?.textContent).toBe('QAQC Performance')
    expect(harness.element.querySelector('.qaqc-title-icon svg.lucide-users')).not.toBeNull()
  })

  it('renders the WW42 30 WW QCR/FE summary strip from bound columns', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(COMBINED_ROWS)))
    expect(harness.element.querySelector('.qaqc-perf-summary .qaqc-kpi-group-head em')?.textContent).toBe("WW13'2026 to WW42'2026")
    expect(summaryValues(harness.element)).toEqual(['6', '221', '2', '0.90%'])
  })

  it('renders the WW42 welder summary strip', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(COMBINED_ROWS)))
    click(groupButton(harness.element, 'Welders'))
    expect(summaryValues(harness.element)).toEqual(['38', '1,570', '11', '0.70%'])
  })

  it('ranks with the Format pane minimum finals', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(COMBINED_ROWS, { objects: ranking({ minimumFinals: 60 }) })))
    expect(cardValue(harness.element, 'QCR/FE ranked')).toBe('2')
  })

  it('ranks with the Format pane minimum welds', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(COMBINED_ROWS, { objects: ranking({ minimumWelds: 100 }) })))
    click(groupButton(harness.element, 'Welders'))
    expect(Number(cardValue(harness.element, 'Welders ranked'))).toBeLessThan(38)
    expect(cardValue(harness.element, 'Welders ranked')).not.toBe('0')
  })

  it('clamps a minimum outside 1 to 100', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(COMBINED_ROWS, { objects: ranking({ minimumFinals: 0 }) })))
    // A minimum of 1 ranks every QCR/FE with a final: the six ranked at 5, plus the ten below it that have finals.
    expect(Number(cardValue(harness.element, 'QCR/FE ranked'))).toBeGreaterThan(6)
  })

  it('re-ranks when only the Format pane changes', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(COMBINED_ROWS)))
    apply(harness, update(tableDataView(COMBINED_ROWS, { objects: ranking({ minimumFinals: 60 }) }), undefined, 0, RESIZE_UPDATE))
    expect(cardValue(harness.element, 'QCR/FE ranked')).toBe('2')
  })

  it('footnotes the inspections with no QCR/FE', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(COMBINED_ROWS)))
    expect(footnotes(harness.element)).toEqual([NOT_RECORDED_NOTE])
  })

  it('footnotes the rows with an unknown Source', () => {
    harness = createHarness()
    const rows = COMBINED_ROWS.map((row, position) => (position < 3 ? row.map((cell, column) => (column === SOURCE ? 'Civil' : cell)) : row))
    apply(harness, update(tableDataView(rows)))
    expect(footnotes(harness.element)).toContain('3 rows with an unknown Source')
  })

  it('opens a person page from the table', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(COMBINED_ROWS)))
    click(nameButton(harness.element, 'QCR 02'))
    expect(harness.element.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('QCR 02 · QCR / FE')
  })

  it('shows plain names and disabled controls when interactions are not allowed', () => {
    harness = createHarness({ hostCapabilities: { allowInteractions: false } })
    apply(harness, update(tableDataView(COMBINED_ROWS)))
    expect(summaryValues(harness.element)).toEqual(['6', '221', '2', '0.90%'])
    expect(nameButton(harness.element, 'QCR 02')).toBeNull()
    expect(groupButton(harness.element, 'Welders')?.disabled).toBe(true)
    expect(harness.element.querySelector('select')?.disabled).toBe(true)
  })

  it('applies the preset colors as CSS variables', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(COMBINED_ROWS)))
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
    apply(harness, update(tableDataView(COMBINED_ROWS)))
    expect(harness.element.style.getPropertyValue('--qaqc-series-1')).toBe('#FFFF00')
    expect(harness.element.querySelector('.qaqc-perf-trend-bar.is-ncr')?.getAttribute('fill')).toBe('#00FFFF')
  })

  it('requests more segments and shows the loading bar', () => {
    const fetchMoreData = vi.fn(() => true)
    harness = createHarness({ fetchMoreData })
    apply(harness, update(tableDataView(COMBINED_ROWS, { segment: true })))
    expect(fetchMoreData).toHaveBeenCalledWith(true)
    expect(harness.element.querySelector('[role="progressbar"]')).not.toBeNull()
  })

  it('renders what it has with a footnote when Power BI refuses more segments', () => {
    harness = createHarness({ fetchMoreData: () => false })
    apply(harness, update(tableDataView(COMBINED_ROWS, { segment: true })))
    expect(footnotes(harness.element)).toEqual([ROW_LIMIT_NOTE, NOT_RECORDED_NOTE])
  })

  it('keeps the row-limit footnote across a resize', () => {
    harness = createHarness({ fetchMoreData: () => false })
    apply(harness, update(tableDataView(COMBINED_ROWS, { segment: true })))
    apply(harness, update(tableDataView(COMBINED_ROWS, { segment: true }), { width: 900, height: 600 }, 0, RESIZE_UPDATE))
    expect(footnotes(harness.element)).toContain(ROW_LIMIT_NOTE)
  })

  it('loads across segments and clears the loading bar on the final append', () => {
    const fetchMoreData = vi.fn(() => true)
    harness = createHarness({ fetchMoreData })
    apply(harness, update(tableDataView(COMBINED_ROWS.slice(0, 1000), { segment: true }), undefined, 0))
    expect(harness.element.querySelector('[role="progressbar"]')).not.toBeNull()
    apply(harness, update(tableDataView(COMBINED_ROWS), undefined, 1))
    expect(harness.element.querySelector('[role="progressbar"]')).toBeNull()
    expect(summaryValues(harness.element)).toEqual(['6', '221', '2', '0.90%'])
  })

  it('refreshes the ranking when a row changes and the row count stays the same', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(COMBINED_ROWS)))
    // Moving every QCR 02 row to QCR 01 removes QCR 02 from the ranking.
    const edited = COMBINED_ROWS.map((row) => (row[QCR] === 'QCR 02' ? row.map((cell, column) => (column === QCR ? 'QCR 01' : cell)) : row))
    apply(harness, update(tableDataView(edited)))
    expect(cardValue(harness.element, 'QCR/FE ranked')).toBe('5')
    expect(nameButton(harness.element, 'QCR 02')).toBeNull()
  })

  it('does not fetch more data on a non-data update', () => {
    const fetchMoreData = vi.fn(() => true)
    harness = createHarness({ fetchMoreData })
    apply(harness, update(tableDataView(COMBINED_ROWS), undefined, 0))
    apply(harness, update(tableDataView(COMBINED_ROWS, { segment: true }), { width: 900, height: 600 }, 0, RESIZE_UPDATE))
    expect(fetchMoreData).not.toHaveBeenCalled()
  })

  it('reports rendering lifecycle events', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(COMBINED_ROWS)))
    expect(harness.events.renderingStarted).toHaveBeenCalledTimes(1)
    expect(harness.events.renderingFinished).toHaveBeenCalledTimes(1)
    expect(harness.events.renderingFailed).not.toHaveBeenCalled()
  })

  it('reports a rendering failure instead of throwing', () => {
    const target = createHarness()
    harness = target
    const broken = tableDataView(COMBINED_ROWS)
    Object.defineProperty(broken.table, 'rows', { get: () => { throw new Error('boom') } })
    expect(() => applyOutsideAct(target, update(broken))).not.toThrow()
    expect(target.events.renderingFailed).toHaveBeenCalledWith(expect.anything(), 'boom')
    expect(target.element.querySelector('.qaqc-status h2')?.textContent).toBe('Could not draw the QAQC Performance visual')
  })

  it('reports a React render error and shows a fallback instead of going blank', () => {
    const target = createHarness()
    harness = target
    dashboardControl.shouldThrow = true
    expect(() => applyOutsideAct(target, update(tableDataView(COMBINED_ROWS)))).not.toThrow()
    expect(target.events.renderingFailed).toHaveBeenCalledWith(expect.anything(), 'render boom')
    expect(target.events.renderingFinished).not.toHaveBeenCalled()
    expect(target.element.querySelector('.qaqc-status h2')?.textContent).toBe('Could not draw the QAQC Performance visual')
  })

  it('recovers on the next update after a render error', () => {
    harness = createHarness()
    dashboardControl.shouldThrow = true
    applyOutsideAct(harness, update(tableDataView(COMBINED_ROWS)))
    dashboardControl.shouldThrow = false
    apply(harness, update(tableDataView(COMBINED_ROWS)))
    expect(summaryValues(harness.element)).toEqual(['6', '221', '2', '0.90%'])
    expect(harness.events.renderingFinished).toHaveBeenCalledTimes(1)
  })

  it('opens the host context menu on right-click', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(COMBINED_ROWS)))
    harness.element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 50 }))
    expect(harness.showContextMenu).toHaveBeenCalledWith(expect.anything(), { x: 40, y: 50 })
  })

  it('opens the context menu from the keyboard with Shift+F10', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(COMBINED_ROWS)))
    harness.element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'F10', shiftKey: true }))
    expect(harness.showContextMenu).toHaveBeenCalledTimes(1)
  })

  it('does not open the context menu when interactions are blocked', () => {
    harness = createHarness({ hostCapabilities: { allowInteractions: false } })
    apply(harness, update(tableDataView(COMBINED_ROWS)))
    harness.element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
    expect(harness.showContextMenu).not.toHaveBeenCalled()
  })

  it('returns a Format pane model with five cards, Ranking last', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(COMBINED_ROWS)))
    const cards = harness.visual.getFormattingModel().cards
    expect(cards).toHaveLength(5)
    expect(cards.map((card) => ('uid' in card ? card.uid : ''))).toContain('ranking-card')
  })
})
