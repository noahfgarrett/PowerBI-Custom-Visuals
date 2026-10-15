import { act, type ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ELECTRICAL_ROWS } from '../../../qaqc-shared/src/__tests__/fixtures/electricalRows'
import { render, type Rendered } from '../../../qaqc-shared/src/__tests__/render'
import { buildInspectionIndex } from '../../../qaqc-shared/src/inspections'
import { resolveTheme } from '../../../qaqc-shared/src/theme'
import { parseWorkWeek } from '../../../qaqc-shared/src/workWeeks'
import { ElectricalDashboard, type ElectricalDashboardProps } from '../ElectricalDashboard'

const INDEX = buildInspectionIndex(ELECTRICAL_ROWS, { workWeek: 0, phase: 1, issue: 2, building: 3 }, new Date(2026, 9, 15))
const THEME = resolveTheme({ preset: 'qaqc', backgroundColor: '', backgroundOpacity: 100, cardOpacity: 100, highContrast: null })

let view: Rendered | null = null

afterEach(() => {
  view?.unmount()
  view = null
})

function draw(overrides: Partial<ElectricalDashboardProps> = {}): Rendered {
  return render(
    <ElectricalDashboard
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

describe('ElectricalDashboard', () => {
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
      <ElectricalDashboard
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

function dashboardElement(index: ElectricalDashboardProps['index']): ReactElement {
  return (
    <ElectricalDashboard
      index={index}
      theme={THEME}
      interactive
      animate={false}
      describeCharts
      loading={false}
      footnotes={[]}
      viewport={{ width: 1280, height: 720 }}
      onHover={vi.fn()}
    />
  )
}

describe('ElectricalDashboard with measured charts', () => {
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
})

describe('ElectricalDashboard empty states and landmarks', () => {
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
