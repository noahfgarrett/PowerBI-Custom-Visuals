import { Cog, Zap } from 'lucide-react'
import { act, type ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { InspectionDashboard, type InspectionDashboardProps } from '../components/InspectionDashboard'
import { buildInspectionIndex } from '../inspections'
import { resolveTheme } from '../theme'
import { parseWorkWeek } from '../workWeeks'
import { ELECTRICAL_ROWS } from './fixtures/electricalRows'
import { render, type Rendered } from './render'

const INDEX = buildInspectionIndex(ELECTRICAL_ROWS, { workWeek: 0, phase: 1, issue: 2, building: 3 }, new Date(2026, 9, 15))
const THEME = resolveTheme({ preset: 'qaqc', backgroundColor: '', backgroundOpacity: 100, cardOpacity: 100, highContrast: null })

let view: Rendered | null = null

afterEach(() => {
  view?.unmount()
  view = null
})

function draw(overrides: Partial<InspectionDashboardProps> = {}): Rendered {
  return render(
    <InspectionDashboard
      title="Electrical Inspections"
      icon={Zap}
      index={INDEX}
      theme={THEME}
      interactive
      animate={false}
      describeCharts
      loading={false}
      footnotes={[]}
      viewport={{ width: 1280, height: 720 }}
      onHover={vi.fn()}
      {...overrides}
    />,
  )
}

function cardValue(container: HTMLElement, label: string): string | null {
  return container.querySelector(`[aria-label^="${label}:"] .qaqc-kpi-value`)?.textContent ?? null
}

describe('InspectionDashboard', () => {
  it('opens on the current week with the six cards', () => {
    view = draw()
    const { container } = view
    expect(container.querySelector('h2')?.textContent).toBe('Electrical Inspections')
    expect(container.querySelector('.qaqc-kpi-group.is-week span')?.textContent).toBe("WW42'2026")
    expect(cardValue(container, 'Final Inspections')).toBe('3')
    expect(cardValue(container, 'SORs')).toBe('3')
    expect(cardValue(container, 'Issues Found')).toBe('0')
    expect(cardValue(container, 'Finals to Date')).toBe('238')
    expect(cardValue(container, 'SORs to Date')).toBe('48')
    expect(cardValue(container, 'NCR Pass Rate')).toBe('99.2%')
  })

  it('shows the title and icon it is given', () => {
    view = draw({ title: 'Mechanical / Process Inspections', icon: Cog })
    expect(view.container.querySelector('h2')?.textContent).toBe('Mechanical / Process Inspections')
    expect(view.container.querySelector('.qaqc-title-icon svg.lucide-cog')).not.toBeNull()
  })

  it('switches cards and the to-date label when another week is picked', () => {
    view = draw()
    const select = view.container.querySelector('select')
    if (!select) throw new Error('week picker missing')
    expect(select.options).toHaveLength(44)
    act(() => {
      select.value = '202641'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(cardValue(view.container, 'Final Inspections')).toBe('6')
    expect(view.container.querySelector('.qaqc-kpi-group.is-total em')?.textContent).toBe("Through WW41'2026")
  })

  it('toggles the chart range', () => {
    view = draw()
    const all = Array.from(view.container.querySelectorAll('.qaqc-range-toggle button')).find((button) => button.textContent === 'All')
    if (!all) throw new Error('All button missing')
    act(() => {
      all.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(all.getAttribute('aria-pressed')).toBe('true')
  })

  it('shows three chart panels on a full page and none on a short tile', () => {
    view = draw()
    expect(view.container.querySelectorAll('.qaqc-panel')).toHaveLength(3)
    view.rerender(
      <InspectionDashboard
        title="Electrical Inspections"
        icon={Zap}
        index={INDEX}
        theme={THEME}
        interactive
        animate={false}
        describeCharts
        loading={false}
        footnotes={[]}
        viewport={{ width: 1280, height: 400 }}
        onHover={vi.fn()}
      />,
    )
    expect(view.container.querySelectorAll('.qaqc-panel')).toHaveLength(0)
  })

  it('uses the compact layout on narrow tiles', () => {
    view = draw({ viewport: { width: 800, height: 900 } })
    expect(view.container.querySelector('.qaqc-root.is-compact')).not.toBeNull()
  })

  it('disables controls when interactions are not allowed', () => {
    view = draw({ interactive: false })
    expect(view.container.querySelector('select')?.disabled).toBe(true)
  })

  it('shows the loading bar and footnotes it is given', () => {
    view = draw({ loading: true, footnotes: ['2 rows skipped: unreadable work week'] })
    expect(view.container.querySelector('[role="progressbar"]')).not.toBeNull()
    expect(view.container.querySelector('.qaqc-footnotes')?.textContent).toContain('2 rows skipped')
  })
})

function mainHitWeeks(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('.qaqc-panel-main .qaqc-hit')).map((rect) => rect.getAttribute('data-week') ?? '')
}

function lastHitWeek(container: HTMLElement): string | undefined {
  const weeks = mainHitWeeks(container)
  return weeks[weeks.length - 1]
}

function weekTitle(container: HTMLElement): string | null {
  return container.querySelector('.qaqc-kpi-group.is-week span')?.textContent ?? null
}

function clickHit(container: HTMLElement, week: string): void {
  const rect = container.querySelector(`.qaqc-panel-main .qaqc-hit[data-week="${week}"]`)
  if (!rect) throw new Error(`hit rect ${week} missing`)
  act(() => {
    rect.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

function pickWeekInDropdown(container: HTMLElement, key: string): void {
  const select = container.querySelector('select')
  if (!select) throw new Error('week picker missing')
  act(() => {
    select.value = key
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

function clickRange(container: HTMLElement, label: string): void {
  const button = Array.from(container.querySelectorAll('.qaqc-range-toggle button')).find((item) => item.textContent === label)
  if (!button) throw new Error(`${label} button missing`)
  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

// Matches labels in code: jsdom's selector engine mishandles "+" inside attribute values.
function byLabel<T extends Element>(nodes: NodeListOf<T>, label: string): T | null {
  return Array.from(nodes).find((node) => node.getAttribute('aria-label') === label) ?? null
}

function expandButton(container: HTMLElement, title: string): HTMLButtonElement | null {
  return byLabel(container.querySelectorAll<HTMLButtonElement>('.qaqc-expand-button'), `Expand ${title}`)
}

function dialog(container: HTMLElement, title: string): HTMLElement | null {
  return byLabel(container.querySelectorAll<HTMLElement>('[role="dialog"]'), title)
}

function expandPanel(container: HTMLElement, title: string): void {
  const button = expandButton(container, title)
  if (!button) throw new Error(`expand button for ${title} missing`)
  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

function dashboardElement(
  index: InspectionDashboardProps['index'],
  viewport: InspectionDashboardProps['viewport'] = { width: 1280, height: 720 },
): ReactElement {
  return (
    <InspectionDashboard
      title="Electrical Inspections"
      icon={Zap}
      index={index}
      theme={THEME}
      interactive
      animate={false}
      describeCharts
      loading={false}
      footnotes={[]}
      viewport={viewport}
      onHover={vi.fn()}
    />
  )
}

describe('InspectionDashboard with measured charts', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function stubSize(): void {
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

  it('selects a week from a bar click without moving the window', () => {
    stubSize()
    view = draw()
    expect(cardValue(view.container, 'Final Inspections')).toBe('3')
    clickHit(view.container, '202635')
    expect(weekTitle(view.container)).toBe("WW35'2026")
    expect(cardValue(view.container, 'Final Inspections')).toBe('9')
    expect(lastHitWeek(view.container)).toBe('202642')
  })

  it('moves the window to the week picked in the dropdown', () => {
    stubSize()
    view = draw()
    pickWeekInDropdown(view.container, '202630')
    expect(lastHitWeek(view.container)).toBe('202630')
  })

  it('keeps a bar-selected week visible when switching back to the recent range', () => {
    stubSize()
    view = draw()
    clickRange(view.container, 'All')
    clickHit(view.container, '202605')
    clickRange(view.container, '30 WW')
    const weeks = mainHitWeeks(view.container)
    expect(weeks).toContain('202605')
    expect(weeks[weeks.length - 1]).toBe('202605')
  })

  it('leaves the window alone when switching to recent with the selection already visible', () => {
    stubSize()
    view = draw()
    clickRange(view.container, 'All')
    clickHit(view.container, '202640')
    clickRange(view.container, '30 WW')
    expect(lastHitWeek(view.container)).toBe('202642')
  })

  it('falls back to the current week when a refresh removes the picked week', () => {
    stubSize()
    view = draw()
    pickWeekInDropdown(view.container, '202630')
    const trimmed = ELECTRICAL_ROWS.filter((row) => (parseWorkWeek(row[0])?.key ?? 0) >= 202631)
    const trimmedIndex = buildInspectionIndex(trimmed, { workWeek: 0, phase: 1, issue: 2, building: 3 }, new Date(2026, 9, 15))
    view.rerender(dashboardElement(trimmedIndex))
    expect(weekTitle(view.container)).toBe("WW42'2026")
    expect(lastHitWeek(view.container)).toBe('202642')
  })

  it('moves the window back to the current week when only the bar-selected week is removed', () => {
    stubSize()
    view = draw()
    pickWeekInDropdown(view.container, '202630')
    clickRange(view.container, 'All')
    clickHit(view.container, '202610')
    const trimmed = ELECTRICAL_ROWS.filter((row) => (parseWorkWeek(row[0])?.key ?? 0) >= 202611)
    const trimmedIndex = buildInspectionIndex(trimmed, { workWeek: 0, phase: 1, issue: 2, building: 3 }, new Date(2026, 9, 15))
    view.rerender(dashboardElement(trimmedIndex))
    expect(weekTitle(view.container)).toBe("WW42'2026")
    expect(lastHitWeek(view.container)).toBe('202642')
  })

  it('gives each chart panel an expand button', () => {
    stubSize()
    view = draw()
    expect(view.container.querySelectorAll('.qaqc-panel .qaqc-expand-button')).toHaveLength(3)
  })

  it('expands Inspections by Building into a table of every building in the window', () => {
    stubSize()
    view = draw()
    expandPanel(view.container, 'Inspections by Building')
    const table = dialog(view.container, 'Inspections by Building')?.querySelector('table.qaqc-table')
    expect(table?.querySelectorAll('tbody tr')).toHaveLength(19)
    expect(view.container.querySelector('.qaqc-root.is-expanded')).not.toBeNull()
  })

  it('collapses on Esc and returns focus to the expand button', () => {
    stubSize()
    view = draw()
    expandPanel(view.container, 'Inspections by Building')
    const open = dialog(view.container, 'Inspections by Building')
    if (!open) throw new Error('dialog missing')
    act(() => {
      open.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(view.container.querySelector('[role="dialog"]')).toBeNull()
    expect(view.container.querySelector('.qaqc-root.is-expanded')).toBeNull()
    expect(document.activeElement).toBe(expandButton(view.container, 'Inspections by Building'))
  })

  it('expands Finals + SORs with a window summary and bar value labels', () => {
    stubSize()
    view = draw()
    expandPanel(view.container, 'Finals + SORs by Work Week')
    const expandedTrend = dialog(view.container, 'Finals + SORs by Work Week')
    expect(expandedTrend?.querySelector('.qaqc-summary')).not.toBeNull()
    expect(expandedTrend?.querySelectorAll('.qaqc-bar-value').length).toBeGreaterThan(0)
  })

  it('expands NCR Pass Rate Trend with the NCR weeks listed newest first', () => {
    stubSize()
    view = draw()
    expandPanel(view.container, 'NCR Pass Rate Trend')
    const items = view.container.querySelectorAll('[role="dialog"] .qaqc-issue-list > li')
    expect(items).toHaveLength(2)
    expect(items[0].querySelector('strong')?.textContent).toBe("WW23'2026")
  })

  it('has no expand buttons when interactions are not allowed', () => {
    stubSize()
    view = draw({ interactive: false })
    expect(view.container.querySelector('.qaqc-expand-button')).toBeNull()
  })

  it('keeps the expanded chart open while the week changes', () => {
    stubSize()
    view = draw()
    expandPanel(view.container, 'Finals + SORs by Work Week')
    pickWeekInDropdown(view.container, '202641')
    expect(dialog(view.container, 'Finals + SORs by Work Week')).not.toBeNull()
    expect(cardValue(view.container, 'Final Inspections')).toBe('6')
  })

  it('hides the expanded chart on a short tile and brings it back when the tile grows', () => {
    stubSize()
    view = draw()
    expandPanel(view.container, 'NCR Pass Rate Trend')
    view.rerender(dashboardElement(INDEX, { width: 1280, height: 400 }))
    expect(view.container.querySelector('[role="dialog"]')).toBeNull()
    view.rerender(dashboardElement(INDEX))
    expect(dialog(view.container, 'NCR Pass Rate Trend')).not.toBeNull()
  })
})

describe('InspectionDashboard empty states and landmarks', () => {
  it('says the range is empty when data exists but the window has no inspections', () => {
    const oldRowsOnly = buildInspectionIndex(
      ELECTRICAL_ROWS.filter((row) => row[0] === "WW51'2025"),
      { workWeek: 0, phase: 1, issue: 2, building: 3 },
      new Date(2026, 9, 15),
    )
    view = draw({ index: oldRowsOnly })
    const panel = view.container.querySelector('.qaqc-panel[aria-label="Inspections by Building"]')
    expect(panel?.textContent).toContain('No inspections in this range')
  })

  it('does not render the top bar as a banner landmark', () => {
    view = draw()
    expect(view.container.querySelector('.qaqc-header')?.tagName).toBe('DIV')
  })
})
