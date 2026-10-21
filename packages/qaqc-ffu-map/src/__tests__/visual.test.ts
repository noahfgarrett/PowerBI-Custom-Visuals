import type powerbi from 'powerbi-visuals-api'
import { act, createElement, type ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createConstructorOptions } from '../../../core/src/__test-utils__'
import type { FfuMapDashboardProps } from '../../../qaqc-shared/src/components/FfuMapDashboard'
import { FFU_SLOTS } from '../../../qaqc-shared/src/ffuMap'
import { syntheticFfuTable } from '../../../qaqc-shared/src/__tests__/fixtures/syntheticFfu'
import capabilities from '../../capabilities.json'
import pbiviz from '../../pbiviz.json'
import { QaqcFfuMapVisual } from '../visual'
import { tableDataView } from './tableDataView'

const dashboard = vi.hoisted(() => {
  const props: FfuMapDashboardProps[] = []
  return { shouldThrow: false, props }
})
const indexBuilds = vi.hoisted(() => ({ count: 0 }))

// Passes through to the real index builder, counting calls, so tests can show when the visual re-indexes.
vi.mock('../../../qaqc-shared/src/ffuMap', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../qaqc-shared/src/ffuMap')>()
  return {
    ...actual,
    buildFfuIndex: (...args: Parameters<typeof actual.buildFfuIndex>) => {
      indexBuilds.count += 1
      return actual.buildFfuIndex(...args)
    },
  }
})

// Passes through to the real dashboard, recording each render's props; throws during React render when the flag is set.
vi.mock('../../../qaqc-shared/src/components/FfuMapDashboard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../qaqc-shared/src/components/FfuMapDashboard')>()
  return {
    ...actual,
    FfuMapDashboard: (props: ComponentProps<typeof actual.FfuMapDashboard>) => {
      if (dashboard.shouldThrow) throw new Error('render boom')
      dashboard.props.push(props)
      return createElement(actual.FfuMapDashboard, props)
    },
  }
})

type ConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions
type UpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions

/** What the recording selection ID builder captures from withTable. */
interface TableSelectionId {
  table: powerbi.DataViewTable | null
  row: number
}

interface Harness {
  visual: QaqcFfuMapVisual
  element: HTMLElement
  events: { renderingStarted: ReturnType<typeof vi.fn>; renderingFinished: ReturnType<typeof vi.fn>; renderingFailed: ReturnType<typeof vi.fn> }
  select: ReturnType<typeof vi.fn>
  clear: ReturnType<typeof vi.fn>
  showContextMenu: ReturnType<typeof vi.fn>
  tooltip: { show: ReturnType<typeof vi.fn>; move: ReturnType<typeof vi.fn>; hide: ReturnType<typeof vi.fn>; enabled: () => boolean }
}

/** A builder whose selection IDs record the table and row passed to withTable. */
function recordingIdBuilder(): Record<string, unknown> {
  let recorded: TableSelectionId = { table: null, row: -1 }
  const builder: Record<string, unknown> = {
    withTable: (table: powerbi.DataViewTable, row: number) => {
      recorded = { table, row }
      return builder
    },
    createSelectionId: (): TableSelectionId => recorded,
  }
  return builder
}

function createHarness(hostOverrides: Record<string, unknown> = {}): Harness {
  const options = createConstructorOptions()
  const events = { renderingStarted: vi.fn(), renderingFinished: vi.fn(), renderingFailed: vi.fn() }
  const select = vi.fn(() => Promise.resolve([]))
  const clear = vi.fn(() => Promise.resolve({}))
  const showContextMenu = vi.fn(() => Promise.resolve({}))
  const tooltip = { show: vi.fn(), move: vi.fn(), hide: vi.fn(), enabled: () => true }
  Object.assign(options.host, {
    eventService: events,
    tooltipService: tooltip,
    createSelectionManager: () => ({ showContextMenu, select, clear, hasSelection: () => false }),
    createSelectionIdBuilder: recordingIdBuilder,
    ...hostOverrides,
  })
  // The core mock host implements the parts of IVisualHost these tests exercise.
  const visual = new QaqcFfuMapVisual(options as unknown as ConstructorOptions)
  return { visual, element: options.element, events, select, clear, showContextMenu, tooltip }
}

// powerbi.VisualUpdateType.Resize and Style; Data is 2.
const RESIZE_UPDATE = 4
const STYLE_UPDATE = 16

const SYNTHETIC = syntheticFfuTable(60)
const TAG = FFU_SLOTS.findIndex((slot) => slot.role === 'tag')
/** A row with a blank tag first, so node indices and table row indices differ by one. */
const ROWS: unknown[][] = [SYNTHETIC.rows[0]?.map((cell, column) => (column === TAG ? '' : cell)) ?? [], ...SYNTHETIC.rows]

function update(dataView: powerbi.DataView | undefined, viewport = { width: 1280, height: 720 }, operationKind = 0, type = 2): UpdateOptions {
  return { viewport, dataViews: dataView ? [dataView] : [], type, operationKind }
}

function apply(target: Harness, options: UpdateOptions): void {
  act(() => {
    target.visual.update(options)
  })
}

function latestProps(): FfuMapDashboardProps {
  const props = dashboard.props[dashboard.props.length - 1]
  if (!props) throw new Error('the dashboard has not rendered')
  return props
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
  dashboard.shouldThrow = false
  dashboard.props = []
  indexBuilds.count = 0
})

afterEach(() => {
  act(() => {
    harness?.visual.destroy()
  })
  harness?.element.remove()
  harness = null
  vi.restoreAllMocks()
})

describe('QaqcFfuMapVisual package', () => {
  it('pbiviz name, display name, class and version are qaqcFfuMap, QCx FFU Map, QaqcFfuMapVisual, 1.0.0.0', () => {
    expect(pbiviz.visual.name).toBe('qaqcFfuMap')
    expect(pbiviz.visual.displayName).toBe('QCx FFU Map')
    expect(pbiviz.visual.visualClassName).toBe('QaqcFfuMapVisual')
    expect(pbiviz.visual.version).toBe('1.0.0.0')
    expect(pbiviz.visual.guid).toMatch(/^qaqcFfuMap_[0-9A-F]{12}$/)
    expect(pbiviz.visual.description).not.toContain('QAQC')
  })

  it('capabilities declare the 19 roles in FFU_SLOTS order, a table mapping, and window count 30000', () => {
    expect(capabilities.dataRoles.map((role) => role.name)).toEqual(FFU_SLOTS.map((slot) => slot.role))
    expect(capabilities.dataRoles).toHaveLength(19)
    expect(capabilities.dataRoles.map((role) => role.displayName)).toEqual(FFU_SLOTS.map((slot) => slot.slot))
    expect(capabilities.dataRoles.every((role) => role.kind === 'Grouping')).toBe(true)
    const [mapping] = capabilities.dataViewMappings
    expect(mapping?.table.rows.select.map((item) => item.for.in)).toEqual(FFU_SLOTS.map((slot) => slot.role))
    expect(mapping?.table.rows.dataReductionAlgorithm.window.count).toBe(30000)
    expect(capabilities.privileges).toEqual([])
  })

  it('describes every role with a localized name and description', () => {
    for (const role of capabilities.dataRoles) {
      expect(role.displayNameKey).toBe(`Qaqc_role_${role.name}`)
      expect(role.descriptionKey).toBe(`Qaqc_role_${role.name}_description`)
      expect(role.description.length).toBeGreaterThan(0)
    }
  })

  it('lets every role take one column and requires none in the mapping, so the slots are checked in code', () => {
    const [condition] = capabilities.dataViewMappings[0]?.conditions ?? []
    expect(Object.keys(condition ?? {})).toEqual(FFU_SLOTS.map((slot) => slot.role))
    expect(Object.values(condition ?? {}).every((range) => range.max === 1 && !('min' in range))).toBe(true)
  })

  it('does not ask for highlights, which a table mapping never receives', () => {
    expect('supportsHighlight' in capabilities).toBe(false)
  })
})

describe('QaqcFfuMapVisual', () => {
  it('labels the visual for assistive technology', () => {
    harness = createHarness()
    expect(harness.element.getAttribute('aria-label')).toBe('QCx FFU map')
  })

  it('renders the setup panel listing FFU Tag → FFU Tag, X → X, Y → Y when unbound', () => {
    harness = createHarness()
    apply(harness, update(undefined))
    expect(harness.element.querySelector('.qaqc-status h2')?.textContent).toBe('Add the FFU layout and tracker columns')
    expect(harness.element.querySelector('.qaqc-status p')?.textContent).toBe(
      'Drag the columns into the matching field slots. See QCx_FFU_Map_SETUP.md.',
    )
    expect(setupItems(harness.element)).toEqual(['FFU Tag → FFU Tag', 'X → X', 'Y → Y'])
  })

  it('lists only the required slots still unbound', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ROWS, { roles: ['tag', 'x', 'line'] })))
    expect(setupItems(harness.element)).toEqual(['Y → Y'])
    expect(dashboard.props).toHaveLength(0)
  })

  it('renders the QCx FFU Map header with the map icon', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ROWS)))
    expect(harness.element.querySelector('.qaqc-header h2')?.textContent).toBe('QCx FFU Map')
    expect(harness.element.querySelector('.qaqc-title-icon svg.lucide-map')).not.toBeNull()
  })

  it('passes the indexed rows to the dashboard, skipping the blank-tag row', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ROWS)))
    const props = latestProps()
    expect(props.index.nodes).toHaveLength(SYNTHETIC.rows.length)
    expect(props.index.notPlaced).toBe(1)
    expect(props.interactive).toBe(true)
    expect(props.loading).toBe(false)
  })

  it('onSelect maps node indices to withTable selection IDs of each node\'s row and calls select(ids, false) even when multi is true', () => {
    harness = createHarness()
    const view = tableDataView(ROWS)
    apply(harness, update(view))
    const props = latestProps()
    expect([props.index.nodes[0]?.row, props.index.nodes[5]?.row]).toEqual([1, 6])
    props.onSelect([0, 5], true)
    expect(harness.select).toHaveBeenCalledTimes(1)
    expect(harness.select).toHaveBeenCalledWith([{ table: view.table, row: 1 }, { table: view.table, row: 6 }], false)
  })

  it('clears the host selection when every reported node index is outside the index', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ROWS)))
    latestProps().onSelect([99_999], false)
    expect(harness.select).not.toHaveBeenCalled()
    expect(harness.clear).toHaveBeenCalledTimes(1)
  })

  it('does not select when interactions are not allowed', () => {
    harness = createHarness({ hostCapabilities: { allowInteractions: false } })
    apply(harness, update(tableDataView(ROWS)))
    const props = latestProps()
    expect(props.interactive).toBe(false)
    props.onSelect([0], false)
    expect(harness.select).not.toHaveBeenCalled()
  })

  it('onClear calls selectionManager.clear', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ROWS)))
    latestProps().onClear()
    expect(harness.clear).toHaveBeenCalledTimes(1)
  })

  it('clears the host selection on a data update after a selection', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ROWS)))
    latestProps().onSelect([0], false)
    apply(harness, update(tableDataView(ROWS)))
    expect(harness.clear).toHaveBeenCalledTimes(1)
  })

  it('does not clear the host selection on a data update with nothing selected', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ROWS)))
    latestProps().onSelect([0], false)
    latestProps().onClear()
    apply(harness, update(tableDataView(ROWS)))
    expect(harness.clear).toHaveBeenCalledTimes(1)
  })

  it('keeps the host selection on a resize', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ROWS)))
    latestProps().onSelect([0], false)
    apply(harness, update(tableDataView(ROWS), { width: 900, height: 600 }, 0, RESIZE_UPDATE))
    expect(harness.clear).not.toHaveBeenCalled()
  })

  it('indexes once per data update, not on resize', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ROWS)))
    expect(indexBuilds.count).toBe(1)
    apply(harness, update(tableDataView(ROWS), { width: 900, height: 600 }, 0, RESIZE_UPDATE))
    apply(harness, update(tableDataView(ROWS), undefined, 0, STYLE_UPDATE))
    expect(indexBuilds.count).toBe(1)
    apply(harness, update(tableDataView(ROWS)))
    expect(indexBuilds.count).toBe(2)
  })

  it('a data update bumps dataVersion; a resize or format update does not', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ROWS)))
    const first = latestProps().dataVersion
    apply(harness, update(tableDataView(ROWS), { width: 900, height: 600 }, 0, RESIZE_UPDATE))
    expect(latestProps().dataVersion).toBe(first)
    apply(harness, update(tableDataView(ROWS), undefined, 0, STYLE_UPDATE))
    expect(latestProps().dataVersion).toBe(first)
    apply(harness, update(tableDataView(ROWS)))
    expect(latestProps().dataVersion).toBe(first + 1)
  })

  it('requests more segments and shows the loading bar', () => {
    const fetchMoreData = vi.fn(() => true)
    harness = createHarness({ fetchMoreData })
    apply(harness, update(tableDataView(ROWS, { segment: true })))
    expect(fetchMoreData).toHaveBeenCalledWith(true)
    expect(latestProps().loading).toBe(true)
    expect(harness.element.querySelector('[role="progressbar"]')).not.toBeNull()
  })

  it('rebuilds the selection IDs when a segment append grows the rows', () => {
    harness = createHarness({ fetchMoreData: () => true })
    apply(harness, update(tableDataView(ROWS.slice(0, 10), { segment: true })))
    const appended = tableDataView(ROWS)
    apply(harness, update(appended, undefined, 1))
    const props = latestProps()
    expect(props.loading).toBe(false)
    const last = props.index.nodes.length - 1
    expect(props.index.nodes[last]?.row).toBe(ROWS.length - 1)
    props.onSelect([last], false)
    expect(harness.select).toHaveBeenCalledWith([{ table: appended.table, row: ROWS.length - 1 }], false)
  })

  it('stops fetching and draws what it has when Power BI refuses more segments', () => {
    harness = createHarness({ fetchMoreData: () => false })
    apply(harness, update(tableDataView(ROWS, { segment: true })))
    expect(latestProps().loading).toBe(false)
    expect(latestProps().index.nodes).toHaveLength(SYNTHETIC.rows.length)
  })

  it('does not fetch more data on a non-data update', () => {
    const fetchMoreData = vi.fn(() => true)
    harness = createHarness({ fetchMoreData })
    apply(harness, update(tableDataView(ROWS)))
    apply(harness, update(tableDataView(ROWS, { segment: true }), { width: 900, height: 600 }, 0, RESIZE_UPDATE))
    expect(fetchMoreData).not.toHaveBeenCalled()
  })

  it('shows hover details in the host tooltip and hides it on leave', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ROWS)))
    latestProps().onHover({ clientX: 30, clientY: 40, title: 'FFU-1', rows: [{ label: 'Group', value: 'GRP-001' }] })
    expect(harness.tooltip.show).toHaveBeenCalledWith(expect.objectContaining({
      dataItems: [{ displayName: 'Group', value: 'GRP-001', header: 'FFU-1' }],
    }))
    latestProps().onHover(null)
    expect(harness.tooltip.hide).toHaveBeenCalledTimes(1)
  })

  it('applies the preset colors as CSS variables', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ROWS)))
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
    apply(harness, update(tableDataView(ROWS)))
    expect(harness.element.style.getPropertyValue('--qaqc-series-1')).toBe('#FFFF00')
  })

  it('reports rendering lifecycle events', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ROWS)))
    expect(harness.events.renderingStarted).toHaveBeenCalledTimes(1)
    expect(harness.events.renderingFinished).toHaveBeenCalledTimes(1)
    expect(harness.events.renderingFailed).not.toHaveBeenCalled()
  })

  it('reports a data read failure instead of throwing', () => {
    const target = createHarness()
    harness = target
    const broken = tableDataView(ROWS)
    Object.defineProperty(broken.table, 'rows', { get: () => { throw new Error('boom') } })
    expect(() => applyOutsideAct(target, update(broken))).not.toThrow()
    expect(target.events.renderingFailed).toHaveBeenCalledWith(expect.anything(), 'boom')
    expect(target.element.querySelector('.qaqc-status h2')?.textContent).toBe('Could not draw the QCx FFU Map visual')
  })

  it('render errors report renderingFailed and show the failure panel', () => {
    const target = createHarness()
    harness = target
    dashboard.shouldThrow = true
    expect(() => applyOutsideAct(target, update(tableDataView(ROWS)))).not.toThrow()
    expect(target.events.renderingFailed).toHaveBeenCalledWith(expect.anything(), 'render boom')
    expect(target.events.renderingFinished).not.toHaveBeenCalled()
    expect(target.element.querySelector('.qaqc-status h2')?.textContent).toBe('Could not draw the QCx FFU Map visual')
  })

  it('recovers on the next update after a render error', () => {
    harness = createHarness()
    dashboard.shouldThrow = true
    applyOutsideAct(harness, update(tableDataView(ROWS)))
    dashboard.shouldThrow = false
    apply(harness, update(tableDataView(ROWS)))
    expect(harness.element.querySelector('.qaqc-header h2')?.textContent).toBe('QCx FFU Map')
    expect(harness.events.renderingFinished).toHaveBeenCalledTimes(1)
  })

  it('opens the host context menu on right-click', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ROWS)))
    harness.element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 50 }))
    expect(harness.showContextMenu).toHaveBeenCalledWith(expect.anything(), { x: 40, y: 50 })
  })

  it('opens the context menu from the keyboard with Shift+F10', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ROWS)))
    harness.element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'F10', shiftKey: true }))
    expect(harness.showContextMenu).toHaveBeenCalledTimes(1)
  })

  it('does not open the context menu when interactions are blocked', () => {
    harness = createHarness({ hostCapabilities: { allowInteractions: false } })
    apply(harness, update(tableDataView(ROWS)))
    harness.element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
    expect(harness.showContextMenu).not.toHaveBeenCalled()
  })

  it('returns a Format pane model with the colors and background cards', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ROWS)))
    const cards = harness.visual.getFormattingModel().cards
    expect(cards.map((card) => ('uid' in card ? card.uid : ''))).toEqual(['colors-card', 'cardSettings-card'])
  })
})
