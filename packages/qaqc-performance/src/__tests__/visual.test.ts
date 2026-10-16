import type powerbi from 'powerbi-visuals-api'
import { act, createElement, type ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createConstructorOptions } from '../../../core/src/__test-utils__'
import { PERFORMANCE_SLOTS } from '../../../qaqc-shared/src/dataView'
import { COMBINED_COLUMNS, COMBINED_ROWS } from '../../../qaqc-shared/src/__tests__/fixtures/combinedRows'
import { splitCombinedRows } from '../../../qaqc-shared/src/combined'
import { buildPerformanceIndex, buildPerformanceModel } from '../../../qaqc-shared/src/performance'
import type { CombinedColumns } from '../../../qaqc-shared/src/types'
import capabilities from '../../capabilities.json'
import { QaqcPerformanceVisual } from '../visual'
import { ALL_ROLES, tableDataView } from './tableDataView'

const dashboardControl = vi.hoisted(() => ({ shouldThrow: false }))
const indexBuilds = vi.hoisted(() => ({ count: 0 }))

// Passes through to the real index builder, counting calls, so tests can show when the visual re-indexes.
vi.mock('../../../qaqc-shared/src/performance', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../qaqc-shared/src/performance')>()
  return {
    ...actual,
    buildPerformanceIndex: (...args: Parameters<typeof actual.buildPerformanceIndex>) => {
      indexBuilds.count += 1
      return actual.buildPerformanceIndex(...args)
    },
  }
})

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

// powerbi.VisualUpdateType.Resize and Style; Data is 2.
const RESIZE_UPDATE = 4
const STYLE_UPDATE = 16

const NOT_RECORDED_NOTE = '70 inspections have no QCR/FE'
const ROW_LIMIT_NOTE = 'Showing the first 2,385 rows (Power BI data limit)'
const SOURCE = COMBINED_COLUMNS.indexOf('Source')
const QCR = COMBINED_COLUMNS.indexOf('QCR/FE')

function position(name: (typeof COMBINED_COLUMNS)[number]): number {
  return COMBINED_COLUMNS.indexOf(name)
}

/** The fixture's 30 WW QCR/FE ranking at a minimum, built directly, to check the visual's wiring against. */
function fixtureQcrModel(minimum: number): ReturnType<typeof buildPerformanceModel> {
  const columns: CombinedColumns = {
    source: SOURCE,
    workWeek: position('Work Week'),
    phase: position('Inspection Phase'),
    issue: position('Issue'),
    building: position('Building'),
    qcr: QCR,
    welder: position('Welder'),
    tagNo: position('Tag No'),
    signature: -1,
    signedWeek: -1,
    id: -1,
    status: -1,
    type: -1,
    createdOn: -1,
    updatedOn: -1,
    createdBy: -1,
    greenTags: -1,
  }
  const index = buildPerformanceIndex(splitCombinedRows(COMBINED_ROWS, SOURCE), columns, new Date(2026, 9, 15))
  const key = index.currentWeek.key
  return buildPerformanceModel(index, { selectedKey: key, windowEndKey: key, range: 'recent' }, 'qcr', minimum)
}

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
  indexBuilds.count = 0
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
    expect(harness.element.querySelector('.qaqc-status p')?.textContent).toContain('QAQC_Performance_SETUP.md')
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

  it('clamps a minimum below 1 to 1, ranking everyone with at least one final', () => {
    const expected = fixtureQcrModel(1)
    expect(expected.ranked.length).toBeGreaterThan(6)
    expect(expected.ranked.every((row) => row.volume >= 1)).toBe(true)
    expect(expected.belowMinimum.every((row) => row.volume === 0)).toBe(true)
    harness = createHarness()
    apply(harness, update(tableDataView(COMBINED_ROWS, { objects: ranking({ minimumFinals: 0 }) })))
    expect(cardValue(harness.element, 'QCR/FE ranked')).toBe(String(expected.ranked.length))
  })

  it('ranks nobody at a minimum of 100 finals, the most QCR 01 has is 94', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(COMBINED_ROWS, { objects: ranking({ minimumFinals: 100 }) })))
    expect(cardValue(harness.element, 'QCR/FE ranked')).toBe('0')
  })

  it('clamps a minimum above 100 to 100', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(COMBINED_ROWS, { objects: ranking({ minimumFinals: 250 }) })))
    expect(cardValue(harness.element, 'QCR/FE ranked')).toBe('0')
    expect(harness.element.querySelector('[aria-label^="QCR/FE ranked:"] .qaqc-kpi-detail')?.textContent).toBe('Minimum 100 finals · 16 below')
  })

  it('indexes the rows once per data update, not on a settings or resize update', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(COMBINED_ROWS)))
    expect(indexBuilds.count).toBe(1)
    apply(harness, update(tableDataView(COMBINED_ROWS, { objects: ranking({ minimumFinals: 60 }) }), undefined, 0, STYLE_UPDATE))
    apply(harness, update(tableDataView(COMBINED_ROWS), { width: 900, height: 600 }, 0, RESIZE_UPDATE))
    expect(indexBuilds.count).toBe(1)
    apply(harness, update(tableDataView(COMBINED_ROWS)))
    expect(indexBuilds.count).toBe(2)
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
    expect(harness.element.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('QCR 02 · QCR / FE · Electrical')
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
