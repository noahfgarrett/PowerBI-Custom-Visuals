import type powerbi from 'powerbi-visuals-api'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createConstructorOptions } from '../../../core/src/__test-utils__'
import { ELECTRICAL_ROWS } from '../../../qaqc-shared/src/__tests__/fixtures/electricalRows'
import { QaqcElectricalVisual } from '../visual'
import { tableDataView } from './tableDataView'

type ConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions
type UpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions

interface Harness {
  visual: QaqcElectricalVisual
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
  const visual = new QaqcElectricalVisual(options as unknown as ConstructorOptions)
  return { visual, element: options.element, host: options.host, events, showContextMenu, tooltip }
}

function update(dataView: powerbi.DataView | undefined, viewport = { width: 1280, height: 720 }, operationKind = 0): UpdateOptions {
  return { viewport, dataViews: dataView ? [dataView] : [], type: 2, operationKind }
}

function apply(target: Harness, options: UpdateOptions): void {
  act(() => {
    target.visual.update(options)
  })
}

function cardValue(element: HTMLElement, label: string): string | null {
  return element.querySelector(`[aria-label^="${label}:"] .qaqc-kpi-value`)?.textContent ?? null
}

let harness: Harness | null = null

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 15, 12))
})

afterEach(() => {
  harness?.visual.destroy()
  harness?.element.remove()
  harness = null
  vi.useRealTimers()
})

describe('QaqcElectricalVisual', () => {
  it('labels the visual for assistive technology', () => {
    harness = createHarness()
    expect(harness.element.getAttribute('aria-label')).toBe('Electrical inspections dashboard')
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
    apply(harness, update(tableDataView(ELECTRICAL_ROWS)))
    expect(cardValue(harness.element, 'Final Inspections')).toBe('3')
    expect(cardValue(harness.element, 'NCR Pass Rate')).toBe('99.2%')
    expect(harness.element.querySelector('.qaqc-footnotes')).toBeNull()
  })

  it('applies the preset colors as CSS variables', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ELECTRICAL_ROWS)))
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
    apply(harness, update(tableDataView(ELECTRICAL_ROWS)))
    expect(harness.element.style.getPropertyValue('--qaqc-series-1')).toBe('#FFFF00')
  })

  it('requests more segments and shows the loading bar', () => {
    const fetchMoreData = vi.fn(() => true)
    harness = createHarness({ fetchMoreData })
    apply(harness, update(tableDataView(ELECTRICAL_ROWS, { segment: true })))
    expect(fetchMoreData).toHaveBeenCalledWith(true)
    expect(harness.element.querySelector('[role="progressbar"]')).not.toBeNull()
  })

  it('renders what it has with a footnote when Power BI refuses more segments', () => {
    harness = createHarness({ fetchMoreData: () => false })
    apply(harness, update(tableDataView(ELECTRICAL_ROWS, { segment: true })))
    expect(harness.element.querySelector('.qaqc-footnotes')?.textContent).toContain('Showing the first 288 rows (Power BI data limit)')
  })

  it('shows the setup state until a Row ID is bound', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ELECTRICAL_ROWS, { roles: ['workWeek', 'phase', 'issue', 'building'] })))
    const items = Array.from(harness.element.querySelectorAll('.qaqc-status li')).map((item) => item.textContent)
    expect(items).toEqual(['Index → Row ID'])
  })

  it('reports rendering lifecycle events', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ELECTRICAL_ROWS)))
    expect(harness.events.renderingStarted).toHaveBeenCalledTimes(1)
    expect(harness.events.renderingFinished).toHaveBeenCalledTimes(1)
    expect(harness.events.renderingFailed).not.toHaveBeenCalled()
  })

  it('reports a rendering failure instead of throwing', () => {
    harness = createHarness()
    const broken = tableDataView(ELECTRICAL_ROWS)
    Object.defineProperty(broken.table, 'rows', { get: () => { throw new Error('boom') } })
    expect(() => harness?.visual.update(update(broken))).not.toThrow()
    expect(harness.events.renderingFailed).toHaveBeenCalledWith(expect.anything(), 'boom')
  })

  it('opens the host context menu on right-click', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ELECTRICAL_ROWS)))
    harness.element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 50 }))
    expect(harness.showContextMenu).toHaveBeenCalledWith(expect.anything(), { x: 40, y: 50 })
  })

  it('opens the context menu from the keyboard with Shift+F10', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ELECTRICAL_ROWS)))
    harness.element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'F10', shiftKey: true }))
    expect(harness.showContextMenu).toHaveBeenCalledTimes(1)
  })

  it('does not open the context menu when interactions are blocked', () => {
    harness = createHarness({ hostCapabilities: { allowInteractions: false } })
    apply(harness, update(tableDataView(ELECTRICAL_ROWS)))
    harness.element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
    expect(harness.showContextMenu).not.toHaveBeenCalled()
  })

  it('returns a Format pane model with four cards', () => {
    harness = createHarness()
    apply(harness, update(tableDataView(ELECTRICAL_ROWS)))
    expect(harness.visual.getFormattingModel().cards).toHaveLength(4)
  })
})
