import type powerbi from 'powerbi-visuals-api'
import { act, createElement, type ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createConstructorOptions } from '../../../core/src/__test-utils__'
import { OVERVIEW_SLOTS } from '../../../qaqc-shared/src/dataView'
import { COMBINED_COLUMNS, COMBINED_ROWS } from '../../../qaqc-shared/src/__tests__/fixtures/combinedRows'
import { ENRICHED_COMBINED_ROWS } from '../../../qaqc-shared/src/__tests__/fixtures/enrichedCombinedRows'
import capabilities from '../../capabilities.json'
import pbiviz from '../../pbiviz.json'
import { QaqcOverviewVisual } from '../visual'
import { ALL_ROLES, ENRICHMENT_ROLES, tableDataView } from './tableDataView'

const dashboardControl = vi.hoisted(() => ({ shouldThrow: false }))
const indexBuilds = vi.hoisted(() => ({ count: 0 }))

// Passes through to the real index builder, counting calls, so tests can show when the visual re-indexes.
vi.mock('../../../qaqc-shared/src/overview', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../qaqc-shared/src/overview')>()
  return {
    ...actual,
    buildOverviewIndex: (...args: Parameters<typeof actual.buildOverviewIndex>) => {
      indexBuilds.count += 1
      return actual.buildOverviewIndex(...args)
    },
  }
})

// Passes through to the real dashboard; throws during React render when the flag is set.
vi.mock('../../../qaqc-shared/src/components/OverviewDashboard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../qaqc-shared/src/components/OverviewDashboard')>()
  return {
    ...actual,
    OverviewDashboard: (props: ComponentProps<typeof actual.OverviewDashboard>) => {
      if (dashboardControl.shouldThrow) throw new Error('render boom')
      return createElement(actual.OverviewDashboard, props)
    },
  }
})

type ConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions
type UpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions

interface Harness {
  visual: QaqcOverviewVisual
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
  const visual = new QaqcOverviewVisual(options as unknown as ConstructorOptions)
  return { visual, element: options.element, host: options.host, events, showContextMenu, tooltip }
}

// powerbi.VisualUpdateType.Resize and Style; Data is 2.
const RESIZE_UPDATE = 4
const STYLE_UPDATE = 16

const BIM_EXCLUDED_NOTE = 'BIM Issues: 5 issues not created by LotusWorks are excluded'
const ROW_LIMIT_NOTE = 'Showing the first 2,385 rows (Power BI data limit)'
const NO_GREEN_TAGS = 'DWN rate n/a: add Green tags'
const SOURCE = COMBINED_COLUMNS.indexOf('Source')
const STATUS = COMBINED_COLUMNS.indexOf('Status')
const TYPE = COMBINED_COLUMNS.indexOf('Type')
const CREATED_BY = COMBINED_COLUMNS.indexOf('Created By')

/**
 * The fixture with its first `count` open, LotusWorks-created CORs retyped as DWNs, so they count toward the DWN
 * rate. The October exports have no DWNs.
 */
function rowsWithDwns(count: number): Array<ReadonlyArray<string | number | null>> {
  let retyped = 0
  return COMBINED_ROWS.map((cells) => {
    const isOpenCor = cells[SOURCE] === 'BIM' && cells[TYPE] === 'COR' && cells[STATUS] === 'Open' && cells[CREATED_BY] === 'LotusWorks'
    if (!isOpenCor || retyped >= count) return cells
    retyped += 1
    return cells.map((cell, column) => (column === TYPE ? 'DWN' : cell))
  })
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

function row(element: HTMLElement, name: string): HTMLElement {
  const found = [...element.querySelectorAll<HTMLElement>('.qaqc-overview-row[role="group"]')]
    .find((node) => node.getAttribute('aria-label')?.startsWith(`${name}:`) || node.getAttribute('aria-label') === name)
  if (!found) throw new Error(`${name} row missing`)
  return found
}

function quality(element: HTMLElement): HTMLElement {
  const found = element.querySelector<HTMLElement>('.qaqc-overview-quality section[aria-label="Quality"]')
  if (!found) throw new Error('quality strip missing')
  return found
}

// Matches labels in code: jsdom's selector engine mishandles "+" and "%" inside attribute values.
function card(scope: HTMLElement, label: string): HTMLElement | null {
  return [...scope.querySelectorAll<HTMLElement>('article.qaqc-kpi')].find((node) => node.getAttribute('aria-label')?.startsWith(`${label}:`)) ?? null
}

function cardValue(scope: HTMLElement, label: string): string | null {
  return card(scope, label)?.querySelector('.qaqc-kpi-value')?.textContent ?? null
}

/** The DWNs card's counts line, which carries the DWN rate. */
function dwnRateLine(element: HTMLElement): string | null {
  return card(quality(element), 'DWNs')?.querySelector('.qaqc-kpi-context')?.textContent ?? null
}

/** Gives every element a measured size, so the charts draw in jsdom; the host element sits at the origin. */
function stubElementSize(width = 800, height = 400): void {
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

function activityHit(element: HTMLElement, week: string): Element {
  const panel = [...element.querySelectorAll('section.qaqc-panel')].find((node) => node.getAttribute('aria-label') === 'Inspection activity by Work Week')
  const hit = panel?.querySelector(`.qaqc-hit[data-week="${week}"]`)
  if (!hit) throw new Error(`activity hit ${week} missing`)
  return hit
}

function hover(target: Element, clientX: number, clientY: number): void {
  act(() => {
    target.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX, clientY }))
  })
}

function modeButton(element: HTMLElement, label: string): HTMLButtonElement | null {
  return [...element.querySelectorAll<HTMLButtonElement>('.qaqc-segmented button')].find((node) => node.textContent === label) ?? null
}

function footnotes(element: HTMLElement): string[] {
  return Array.from(element.querySelectorAll('.qaqc-footnotes li')).map((item) => item.textContent ?? '')
}

function setupItems(element: HTMLElement): Array<string | null> {
  return Array.from(element.querySelectorAll('.qaqc-status li')).map((item) => item.textContent)
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

describe('QaqcOverviewVisual name', () => {
  it('heads the dashboard with its QCx title', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(COMBINED_ROWS)))
    expect(harness.element.querySelector('.qaqc-header h2')?.textContent).toBe('QCx Overview')
  })

  it('shows its QCx name in Power BI', () => {
    expect(pbiviz.visual.displayName).toBe('QCx Overview')
    expect(pbiviz.visual.description).not.toContain('QAQC')
  })
})

describe('QaqcOverviewVisual capabilities', () => {
  it('names each data role like its field slot', () => {
    const roleNames = Object.fromEntries(capabilities.dataRoles.map((role) => [role.name, role.displayName]))
    expect(roleNames).toEqual(Object.fromEntries(OVERVIEW_SLOTS.map((slot) => [slot.role, slot.slot])))
  })

  it('declares Green tags as the only measure role', () => {
    const measures = capabilities.dataRoles.filter((role) => role.kind === 'Measure').map((role) => role.name)
    expect(measures).toEqual(['greenTags'])
    expect(capabilities.dataRoles.filter((role) => role.kind !== 'Measure').every((role) => role.kind === 'Grouping')).toBe(true)
  })

  it('lets every role take one column and requires none in the mapping, so the slots are checked in code', () => {
    const [condition] = capabilities.dataViewMappings[0].conditions
    expect(Object.keys(condition)).toEqual(OVERVIEW_SLOTS.map((slot) => slot.role))
    expect(Object.values(condition).every((range) => range.max === 1 && !('min' in range))).toBe(true)
  })

  it('selects every role, Green tags included, in the table mapping', () => {
    const selected = capabilities.dataViewMappings[0].table.rows.select.map((item) => item.for.in)
    expect(selected).toEqual(OVERVIEW_SLOTS.map((slot) => slot.role))
  })

  it('tells the author to wrap Green tags in COALESCE, since a blank measure drops every row', () => {
    const greenTags = capabilities.dataRoles.find((role) => role.name === 'greenTags')
    expect(greenTags?.description).toContain('COALESCE(…, 0)')
  })
})

describe('QaqcOverviewVisual setup state', () => {
  it('labels the visual for assistive technology', () => {
    harness = createHarness()
    expect(harness.element.getAttribute('aria-label')).toBe('QCx overview dashboard')
  })

  it('lists every required field slot before data is bound, without the optional Green tags', () => {
    harness = createHarness()
    apply(harness, update(undefined))
    expect(harness.element.querySelector('.qaqc-status h2')?.textContent).toBe('Add the QCx Combined columns')
    expect(setupItems(harness.element)).toEqual([
      'Source → Source',
      'Row ID → Row ID',
      'Work Week → Work Week',
      'Inspection Phase → Inspection Phase',
      'Issue → Issue',
      'Building → Building',
      'Signature → Signature',
      'Work Week Signed → Work Week Signed',
      'ID → ID',
      'Status → Status',
      'Type → Type',
      'Created On → Created On',
      'Updated On → Updated On',
      'Created By → Created By',
    ])
  })

  it('names the QCx setup guide in the setup message', () => {
    harness = createHarness()
    apply(harness, update(undefined))
    expect(harness.element.querySelector('.qaqc-status p')?.textContent).toBe(
      'Drag these columns from the QCx Combined table into the matching field slots. See QCx_Overview_SETUP.md.',
    )
  })

  it('shows the setup state until every required slot is bound', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(COMBINED_ROWS, { roles: ALL_ROLES.filter((role) => role !== 'signature' && role !== 'createdBy') })))
    expect(setupItems(harness.element)).toEqual(['Signature → Signature', 'Created By → Created By'])
    expect(harness.element.querySelector('.qaqc-overview-row')).toBeNull()
  })

  it('draws the dashboard with Green tags left unbound', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(COMBINED_ROWS)))
    expect(harness.element.querySelector('.qaqc-status')).toBeNull()
    expect(dwnRateLine(harness.element)).toBe(NO_GREEN_TAGS)
  })
})

describe('QaqcOverviewVisual dashboard', () => {
  it('renders the QCx Overview header with the dashboard icon', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(COMBINED_ROWS)))
    expect(harness.element.querySelector('.qaqc-header h2')?.textContent).toBe('QCx Overview')
    expect(harness.element.querySelector('.qaqc-title-icon svg.lucide-layout-dashboard')).not.toBeNull()
  })

  it('renders the WW42 This WW cards from bound columns', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(COMBINED_ROWS)))
    const { element } = harness
    expect(cardValue(row(element, 'Electrical'), 'Finals')).toBe('3')
    expect(cardValue(row(element, 'Mechanical'), 'SORs')).toBe('0')
    expect(cardValue(row(element, 'Welding'), 'Signed')).toBe('70')
    expect(cardValue(row(element, 'BIM Issues'), 'Remaining open')).toBe('51')
    expect(cardValue(quality(element), 'Inspection NCR pass rate')).toBe('100.0%')
  })

  it('renders the WW42 To date cards', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(COMBINED_ROWS)))
    click(modeButton(harness.element, 'To date'))
    const { element } = harness
    expect(cardValue(row(element, 'Electrical'), 'Finals')).toBe('238')
    expect(cardValue(row(element, 'Welding'), 'Welds logged')).toBe('1,751')
    expect(cardValue(row(element, 'BIM Issues'), 'Opened')).toBe('177')
    expect(cardValue(quality(element), 'CORs')).toBe('171')
    expect(cardValue(quality(element), 'NCRs')).toBe('14')
  })

  it('shows Add Root Cause in the Top root cause card when Root Cause is unbound', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(COMBINED_ROWS)))
    const topCause = card(quality(harness.element), 'Top root cause')
    expect(topCause?.querySelector('.qaqc-kpi-value')?.textContent).toBe('n/a')
    expect(topCause?.querySelector('.qaqc-kpi-detail')?.textContent).toBe('Add Root Cause')
  })

  it('names the top root cause to date when Root Cause is bound', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(COMBINED_ROWS, { roles: [...ALL_ROLES, 'rootCause'] })))
    click(modeButton(harness.element, 'To date'))
    const topCause = card(quality(harness.element), 'Top root cause')
    expect(topCause?.querySelector('.qaqc-kpi-value')?.textContent).toBe('Installation')
    expect(topCause?.querySelector('.qaqc-kpi-detail')?.textContent).toBe('48 of 177 issues · 27%')
  })

  it('shows None opened this WW in the Top root cause card for WW42 when Root Cause is bound', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(COMBINED_ROWS, { roles: [...ALL_ROLES, 'rootCause'] })))
    const topCause = card(quality(harness.element), 'Top root cause')
    expect(topCause?.querySelector('.qaqc-kpi-value')?.textContent).toBe('None')
    expect(topCause?.querySelector('.qaqc-kpi-detail')?.textContent).toBe('None opened this WW')
  })

  it('shows the BIM issues past the normal close window in both modes', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(COMBINED_ROWS)))
    expect(cardValue(row(harness.element, 'BIM Issues'), 'Past normal close window')).toBe('51')
    click(modeButton(harness.element, 'To date'))
    expect(cardValue(row(harness.element, 'BIM Issues'), 'Past normal close window')).toBe('51')
  })

  it('divides the DWNs to date by a bound Green tags value', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(rowsWithDwns(2), { greenTags: 400 })))
    expect(dwnRateLine(harness.element)).toBe('0.5% of green tags (to date)')
    click(modeButton(harness.element, 'To date'))
    expect(cardValue(quality(harness.element), 'DWNs')).toBe('2')
    expect(cardValue(quality(harness.element), 'CORs')).toBe('169')
  })

  it('reads a Green tags value sent as numeric text', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(rowsWithDwns(2), { greenTags: '400' })))
    expect(dwnRateLine(harness.element)).toBe('0.5% of green tags (to date)')
  })

  it('shows the DWN rate as n/a when the bound Green tags value is blank', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(COMBINED_ROWS, { greenTags: null })))
    expect(dwnRateLine(harness.element)).toBe(NO_GREEN_TAGS)
  })

  it('footnotes the BIM issues from excluded creators', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(COMBINED_ROWS)))
    expect(footnotes(harness.element)).toEqual([BIM_EXCLUDED_NOTE])
  })

  it('footnotes the rows with an unknown Source', () => {
    harness = createHarness()
    const rows = COMBINED_ROWS.map((cells, position) => (position < 3 ? cells.map((cell, column) => (column === SOURCE ? 'Civil' : cell)) : cells))
    apply(harness, update(tableDataView(rows)))
    expect(footnotes(harness.element)).toContain('3 rows with an unknown Source')
  })

  it('indexes the rows once per data update, not on a settings or resize update', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(COMBINED_ROWS)))
    expect(indexBuilds.count).toBe(1)
    apply(harness, update(tableDataView(COMBINED_ROWS, { objects: { colors: { preset: 'blue' } } }), undefined, 0, STYLE_UPDATE))
    apply(harness, update(tableDataView(COMBINED_ROWS), { width: 900, height: 600 }, 0, RESIZE_UPDATE))
    expect(indexBuilds.count).toBe(1)
    apply(harness, update(tableDataView(COMBINED_ROWS)))
    expect(indexBuilds.count).toBe(2)
  })

  it('applies a Format pane preset without re-indexing', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(COMBINED_ROWS)))
    expect(indexBuilds.count).toBe(1)
    apply(harness, update(tableDataView(COMBINED_ROWS, { objects: { colors: { preset: 'grayscale' } } }), undefined, 0, STYLE_UPDATE))
    expect(harness.element.style.getPropertyValue('--qaqc-series-1')).toBe('#3A3A3A')
    expect(indexBuilds.count).toBe(1)
    expect(cardValue(row(harness.element, 'Electrical'), 'Finals')).toBe('3')
  })

  it('shows the cards with disabled controls when interactions are not allowed', () => {
    harness = createHarness({ hostCapabilities: { allowInteractions: false } })
    apply(harness, update(tableDataView(COMBINED_ROWS)))
    expect(cardValue(row(harness.element, 'Electrical'), 'Finals')).toBe('3')
    expect(modeButton(harness.element, 'To date')?.disabled).toBe(true)
    expect(harness.element.querySelector('select')?.disabled).toBe(true)
  })

  it('applies the preset colors as CSS variables', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(COMBINED_ROWS)))
    expect(harness.element.style.getPropertyValue('--qaqc-series-1')).toBe('#2E5AAC')
  })

  it('uses host colors in high-contrast mode, with a dashed Mechanical line', () => {
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
    expect(harness.element.querySelector('.qaqc-legend-swatch.is-dashed')).not.toBeNull()
  })
})

describe('QaqcOverviewVisual data loading', () => {
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
    expect(footnotes(harness.element)).toEqual([ROW_LIMIT_NOTE, BIM_EXCLUDED_NOTE])
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
    expect(cardValue(row(harness.element, 'Electrical'), 'Finals')).toBe('3')
  })

  it('does not fetch more data on a non-data update', () => {
    const fetchMoreData = vi.fn(() => true)
    harness = createHarness({ fetchMoreData })
    apply(harness, update(tableDataView(COMBINED_ROWS), undefined, 0))
    apply(harness, update(tableDataView(COMBINED_ROWS, { segment: true }), { width: 900, height: 600 }, 0, RESIZE_UPDATE))
    expect(fetchMoreData).not.toHaveBeenCalled()
  })
})

describe('QaqcOverviewVisual host integration', () => {
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
    expect(target.element.querySelector('.qaqc-status h2')?.textContent).toBe('Could not draw the QCx Overview visual')
  })

  it('reports a React render error and shows a fallback instead of going blank', () => {
    const target = createHarness()
    harness = target
    dashboardControl.shouldThrow = true
    expect(() => applyOutsideAct(target, update(tableDataView(COMBINED_ROWS)))).not.toThrow()
    expect(target.events.renderingFailed).toHaveBeenCalledWith(expect.anything(), 'render boom')
    expect(target.events.renderingFinished).not.toHaveBeenCalled()
    expect(target.element.querySelector('.qaqc-status h2')?.textContent).toBe('Could not draw the QCx Overview visual')
  })

  it('recovers on the next update after a render error', () => {
    harness = createHarness()
    dashboardControl.shouldThrow = true
    applyOutsideAct(harness, update(tableDataView(COMBINED_ROWS)))
    dashboardControl.shouldThrow = false
    apply(harness, update(tableDataView(COMBINED_ROWS)))
    expect(cardValue(row(harness.element, 'Electrical'), 'Finals')).toBe('3')
    expect(harness.events.renderingFinished).toHaveBeenCalledTimes(1)
  })

  it('forwards a chart hover to the host tooltip service', () => {
    stubElementSize()
    harness = createHarness()
    apply(harness, update(tableDataView(COMBINED_ROWS)))
    hover(activityHit(harness.element, '202642'), 100, 120)
    expect(harness.tooltip.show).toHaveBeenCalledWith(expect.objectContaining({
      coordinates: [100, 120],
      isTouchEvent: false,
      identities: [],
    }))
    const [shown] = harness.tooltip.show.mock.lastCall ?? []
    expect(shown?.dataItems?.[0]).toEqual(expect.objectContaining({ header: "WW42'2026" }))
  })

  it('hides the host tooltip when the pointer leaves the chart', () => {
    stubElementSize()
    harness = createHarness()
    apply(harness, update(tableDataView(COMBINED_ROWS)))
    const hit = activityHit(harness.element, '202642')
    hover(hit, 100, 120)
    act(() => {
      hit.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }))
    })
    expect(harness.tooltip.hide).toHaveBeenCalledWith({ immediately: true, isTouchEvent: false })
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

  it('returns a Format pane model with four cards and no Ranking', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(COMBINED_ROWS)))
    const cards = harness.visual.getFormattingModel().cards
    expect(cards.map((item) => ('uid' in item ? item.uid : ''))).toEqual([
      'colors-card',
      'cardSettings-card',
      'animationSettings-card',
      'accessibility-card',
    ])
  })
})

describe('QaqcOverviewVisual with the enriched Autodesk export as the BIM source', () => {
  const enrichedRoles = [...ALL_ROLES, 'rootCause', ...ENRICHMENT_ROLES] as const

  it('shows the WW42 This WW BIM cards with the enrichment slots bound', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ENRICHED_COMBINED_ROWS, { roles: [...enrichedRoles] })))
    const bim = row(harness.element, 'BIM Issues')
    expect(['Opened', 'Closed', 'Remaining open'].map((label) => cardValue(bim, label))).toEqual(['2', '1', '57'])
    expect(footnotes(harness.element)).toEqual(['BIM Issues: 846 issues not created by LotusWorks are excluded'])
  })

  it('shows the WW42 To date BIM cards and top root cause with the enrichment slots bound', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ENRICHED_COMBINED_ROWS, { roles: [...enrichedRoles] })))
    click(modeButton(harness.element, 'To date'))
    const bim = row(harness.element, 'BIM Issues')
    expect([cardValue(bim, 'Opened'), cardValue(bim, 'Closed')]).toEqual(['231', '174'])
    const topCause = card(quality(harness.element), 'Top root cause')
    expect(topCause?.querySelector('.qaqc-kpi-value')?.textContent).toBe('Installation')
    expect(topCause?.querySelector('.qaqc-kpi-detail')?.textContent).toBe('54 of 231 issues · 23%')
  })

  it('counts only the native Autodesk issues with the enrichment slots unbound', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ENRICHED_COMBINED_ROWS, { roles: [...ALL_ROLES, 'rootCause'] })))
    click(modeButton(harness.element, 'To date'))
    const bim = row(harness.element, 'BIM Issues')
    expect([cardValue(bim, 'Opened'), cardValue(bim, 'Closed'), cardValue(bim, 'Remaining open')]).toEqual(['29', '16', '13'])
    expect(footnotes(harness.element)).toEqual(['BIM Issues: 1,048 issues not created by LotusWorks are excluded'])
  })
})
