import { Flame } from 'lucide-react'
import { act, type ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { WeldingDashboard, type WeldingDashboardProps } from '../components/WeldingDashboard'
import { resolveTheme } from '../theme'
import type { WeldColumns, WeldIndex } from '../types'
import { buildWeldIndex } from '../welds'
import { parseWorkWeek } from '../workWeeks'
import { WELDING_ROWS } from './fixtures/weldingRows'
import { render, type Rendered } from './render'

const COLUMNS: WeldColumns = { weldWeek: 0, signature: 1, signedWeek: 2, issue: 3, fluidCode: 4, pipeSpec: 5, tagNo: 6 }
const TODAY = new Date(2026, 9, 15) // WW42'2026
const INDEX = buildWeldIndex(WELDING_ROWS, COLUMNS, TODAY)
const THEME = resolveTheme({ preset: 'qaqc', backgroundColor: '', backgroundOpacity: 100, cardOpacity: 100, highContrast: null })
const MAIN_TITLE = 'Signoffs by Work Week'
const SYSTEMS_TITLE = 'Sign-off by System'
const BUILDINGS_TITLE = 'Issues by Building'

let view: Rendered | null = null

afterEach(() => {
  view?.unmount()
  view = null
  vi.restoreAllMocks()
})

function dashboardElement(overrides: Partial<WeldingDashboardProps> = {}): ReactElement {
  return (
    <WeldingDashboard
      title="Welding Signoffs"
      icon={Flame}
      index={INDEX}
      minWelds={10}
      theme={THEME}
      interactive
      animate={false}
      describeCharts
      loading={false}
      footnotes={[]}
      viewport={{ width: 1280, height: 720 }}
      onHover={vi.fn()}
      {...overrides}
    />
  )
}

function draw(overrides: Partial<WeldingDashboardProps> = {}): Rendered {
  return render(dashboardElement(overrides))
}

/** One WW42 week of welds, the first `signed` of them signed that week. */
function weekOfWelds(total: number, signed: number): Array<Array<string | null>> {
  return Array.from({ length: total }, (_, position) => {
    const isSigned = position < signed
    return ["WW42'2026", isSigned ? 'signed' : null, isSigned ? "WW42'2026" : null, null, 'AW', 'PCH', 'F631M008XX-1']
  })
}

function indexOf(rows: ReadonlyArray<ReadonlyArray<string | null>>): WeldIndex {
  return buildWeldIndex(rows, COLUMNS, TODAY)
}

// Matches labels in code: jsdom's selector engine mishandles "+" and "%" inside attribute values.
function card(container: HTMLElement, label: string): HTMLElement | null {
  return [...container.querySelectorAll<HTMLElement>('article.qaqc-kpi')]
    .find((node) => node.getAttribute('aria-label')?.startsWith(`${label}:`)) ?? null
}

function cardValue(container: HTMLElement, label: string): string | null {
  return card(container, label)?.querySelector('.qaqc-kpi-value')?.textContent ?? null
}

function cardDetail(container: HTMLElement, label: string): string | null {
  return card(container, label)?.querySelector('.qaqc-kpi-detail')?.textContent ?? null
}

function weekTitle(container: HTMLElement): string | null {
  return container.querySelector('.qaqc-kpi-group.is-week span')?.textContent ?? null
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
  const button = [...container.querySelectorAll('.qaqc-range-toggle button')].find((item) => item.textContent === label)
  if (!button) throw new Error(`${label} button missing`)
  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

function click(target: Element): void {
  act(() => {
    target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

function panel(container: HTMLElement, title: string): HTMLElement | null {
  return [...container.querySelectorAll<HTMLElement>('section.qaqc-panel')].find((node) => node.getAttribute('aria-label') === title) ?? null
}

function mainHitWeeks(container: HTMLElement): string[] {
  return [...container.querySelectorAll('.qaqc-panel-main .qaqc-hit')].map((rect) => rect.getAttribute('data-week') ?? '')
}

function lastHitWeek(container: HTMLElement): string | undefined {
  const weeks = mainHitWeeks(container)
  return weeks[weeks.length - 1]
}

function clickHit(container: HTMLElement, week: string): void {
  const rect = container.querySelector(`.qaqc-panel-main .qaqc-hit[data-week="${week}"]`)
  if (!rect) throw new Error(`hit rect ${week} missing`)
  click(rect)
}

function systemRow(container: HTMLElement, system: string): SVGElement | null {
  return [...container.querySelectorAll<SVGElement>('.qaqc-drill-row')].find((node) => node.getAttribute('data-system') === system) ?? null
}

function breadcrumb(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>('.qaqc-breadcrumb')
}

function drillInto(container: HTMLElement, system: string): void {
  const row = systemRow(container, system)
  if (!row) throw new Error(`row ${system} missing`)
  click(row)
}

function expandButton(container: HTMLElement, title: string): HTMLButtonElement | null {
  return [...container.querySelectorAll<HTMLButtonElement>('.qaqc-expand-button')]
    .find((node) => node.getAttribute('aria-label') === `Expand ${title}`) ?? null
}

function expandPanel(container: HTMLElement, title: string): HTMLElement {
  const button = expandButton(container, title)
  if (!button) throw new Error(`expand button for ${title} missing`)
  click(button)
  const open = [...container.querySelectorAll<HTMLElement>('[role="dialog"]')].find((node) => node.getAttribute('aria-label') === title)
  if (!open) throw new Error(`dialog for ${title} missing`)
  return open
}

function stubSize(width = 800, height = 400): void {
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

describe('WeldingDashboard cards', () => {
  it('opens on the current week with the four this-week cards', () => {
    view = draw()
    const { container } = view
    expect(weekTitle(container)).toBe("WW42'2026")
    expect(cardValue(container, 'Welds Logged')).toBe('0')
    expect(cardDetail(container, 'Welds Logged')).toBe('−84 vs WW41')
    expect(cardValue(container, 'Signed This Week')).toBe('70')
    expect(cardDetail(container, 'Signed This Week')).toBe('+24 vs WW41')
    expect(cardValue(container, 'Sign-off %')).toBe('80%')
    expect(cardDetail(container, 'Sign-off %')).toBe("67 of 84 · WW41'2026")
    expect(cardValue(container, 'Issues Created')).toBe('0')
    expect(cardDetail(container, 'Issues Created')).toBe('No change vs WW41')
  })

  it('opens with the three project-to-date cards through the current week', () => {
    view = draw()
    const { container } = view
    expect(container.querySelector('.qaqc-kpi-group.is-total em')?.textContent).toBe("Through WW42'2026")
    expect(cardValue(container, 'Total Welds')).toBe('1,751')
    expect(cardDetail(container, 'Total Welds')).toBe('+0 this WW')
    expect(cardValue(container, 'Welds Signed')).toBe('1,054')
    expect(cardDetail(container, 'Welds Signed')).toBe('+70 signed this WW')
    expect(cardValue(container, 'Overall Sign-off %')).toBe('60.2%')
    expect(cardDetail(container, 'Overall Sign-off %')).toBe('No change vs WW41')
  })

  it('marks Overall Sign-off % on track at 60%', () => {
    view = draw()
    const overall = card(view.container, 'Overall Sign-off %')
    expect(overall?.querySelector('.qaqc-kpi-status.is-good')).not.toBeNull()
    expect(overall?.getAttribute('aria-label')).toMatch(/Status: on track$/)
  })

  it('shows the WW41 cards when WW41 is picked', () => {
    view = draw()
    pickWeekInDropdown(view.container, '202641')
    const { container } = view
    expect(weekTitle(container)).toBe("WW41'2026")
    expect(container.querySelector('.qaqc-kpi-group.is-total em')?.textContent).toBe("Through WW41'2026")
    expect(cardValue(container, 'Welds Logged')).toBe('84')
    expect(cardDetail(container, 'Welds Logged')).toBe('−42 vs WW40')
    expect(cardValue(container, 'Signed This Week')).toBe('46')
    expect(cardDetail(container, 'Signed This Week')).toBe('−21 vs WW40')
    expect(cardDetail(container, 'Sign-off %')).toBe("67 of 84 · WW41'2026")
    expect(cardDetail(container, 'Total Welds')).toBe('+84 this WW')
    expect(cardDetail(container, 'Welds Signed')).toBe('+46 signed this WW')
  })

  it('shows the latest weld week sign-off for WW40', () => {
    view = draw()
    pickWeekInDropdown(view.container, '202640')
    expect(cardValue(view.container, 'Welds Logged')).toBe('126')
    expect(cardDetail(view.container, 'Sign-off %')).toBe("46 of 126 · WW40'2026")
    expect(cardValue(view.container, 'Signed This Week')).toBe('67')
  })

  it('colors Overall Sign-off % green when it rises and red when it falls', () => {
    view = draw()
    pickWeekInDropdown(view.container, '202641')
    expect(card(view.container, 'Overall Sign-off %')?.querySelector('.qaqc-kpi-detail.is-good')).not.toBeNull()
    pickWeekInDropdown(view.container, '202640')
    expect(card(view.container, 'Overall Sign-off %')?.querySelector('.qaqc-kpi-detail.is-bad')).not.toBeNull()
  })

  it('warns when Issues Created goes up', () => {
    view = draw()
    pickWeekInDropdown(view.container, '202617')
    expect(cardDetail(view.container, 'Issues Created')).toBe('+2 vs WW16')
    expect(card(view.container, 'Issues Created')?.querySelector('.qaqc-kpi-detail.is-warn')).not.toBeNull()
  })

  it('does not color the Sign-off % value at 80%', () => {
    view = draw()
    expect(card(view.container, 'Sign-off %')?.querySelector('.qaqc-kpi-value.is-bad')).toBeNull()
  })

  it('shows a red, truncated Sign-off % at 24 of 250', () => {
    view = draw({ index: indexOf(weekOfWelds(250, 24)) })
    expect(cardValue(view.container, 'Sign-off %')).toBe('9.6%')
    expect(card(view.container, 'Sign-off %')?.querySelector('.qaqc-kpi-value.is-bad')).not.toBeNull()
    expect(card(view.container, 'Sign-off %')?.getAttribute('aria-label')).toMatch(/Below target$/)
  })

  it('does not color the Sign-off % value at exactly 10%', () => {
    view = draw({ index: indexOf(weekOfWelds(20, 2)) })
    expect(cardValue(view.container, 'Sign-off %')).toBe('10%')
    expect(card(view.container, 'Sign-off %')?.querySelector('.qaqc-kpi-value.is-bad')).toBeNull()
  })

  it('offers every week in the index, newest first', () => {
    view = draw()
    const select = view.container.querySelector('select')
    expect(select?.options).toHaveLength(44)
    expect(select?.options[0].textContent).toBe("WW42'2026")
    expect(select?.options[43].textContent).toBe("WW51'2025")
  })
})

describe('WeldingDashboard layout', () => {
  it('shows the title and icon it is given', () => {
    view = draw()
    expect(view.container.querySelector('h2')?.textContent).toBe('Welding Signoffs')
    expect(view.container.querySelector('.qaqc-title-icon svg.lucide-flame')).not.toBeNull()
  })

  it('toggles the chart range', () => {
    view = draw()
    clickRange(view.container, 'All')
    const all = [...view.container.querySelectorAll('.qaqc-range-toggle button')].find((button) => button.textContent === 'All')
    expect(all?.getAttribute('aria-pressed')).toBe('true')
  })

  it('shows three chart panels in order on a full page and none on a short tile', () => {
    view = draw()
    expect([...view.container.querySelectorAll('.qaqc-panel')].map((node) => node.getAttribute('aria-label')))
      .toEqual([MAIN_TITLE, SYSTEMS_TITLE, BUILDINGS_TITLE])
    view.rerender(dashboardElement({ viewport: { width: 1280, height: 400 } }))
    expect(view.container.querySelectorAll('.qaqc-panel')).toHaveLength(0)
    expect(view.container.querySelector('.qaqc-root.is-cards-only')).not.toBeNull()
    expect(view.container.querySelectorAll('article.qaqc-kpi')).toHaveLength(7)
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
    view = draw({ loading: true, footnotes: ['2 rows skipped: unreadable weld work week'] })
    expect(view.container.querySelector('[role="progressbar"]')).not.toBeNull()
    expect(view.container.querySelector('.qaqc-footnotes')?.textContent).toContain('2 rows skipped')
  })

  it('labels the sign-off chart legend like the app', () => {
    view = draw()
    const items = [...(panel(view.container, MAIN_TITLE)?.querySelectorAll('.qaqc-legend li') ?? [])]
    expect(items.map((item) => item.textContent)).toEqual(['Signed', 'Total welds', 'Sign-off %', 'Issue created', '10% baseline'])
    const shapes = items.map((item) => [...(item.firstElementChild?.classList ?? [])].find((name) => name.startsWith('is-')))
    expect(shapes).toEqual(['is-bar', 'is-bar', 'is-line', 'is-dot', 'is-dashed'])
    expect(items[4].querySelector('line')?.getAttribute('stroke')).toBe(THEME.colors.bad)
  })

  it('draws the Overall rate legend key as a hairline like the chart', () => {
    view = draw()
    const items = [...(panel(view.container, BUILDINGS_TITLE)?.querySelectorAll('.qaqc-legend li') ?? [])]
    expect(items.map((item) => item.textContent)).toEqual(['Issue rate', '2× overall or more', 'Overall rate'])
    expect(items[2].firstElementChild?.classList.contains('is-hairline')).toBe(true)
  })

  it('says there are no welds when the data is empty', () => {
    view = draw({ index: indexOf([]) })
    expect(panel(view.container, MAIN_TITLE)?.textContent).toContain('No welds match the current filters')
    expect(cardValue(view.container, 'Sign-off %')).toBe('n/a')
    expect(cardValue(view.container, 'Overall Sign-off %')).toBe('n/a')
  })
})

describe('WeldingDashboard week and window', () => {
  it('selects a week from a bar click without moving the window', () => {
    stubSize()
    view = draw()
    clickHit(view.container, '202635')
    expect(weekTitle(view.container)).toBe("WW35'2026")
    expect(cardValue(view.container, 'Welds Logged')).toBe('100')
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
    expect(mainHitWeeks(view.container)[0]).toBe('202551')
    clickHit(view.container, '202606')
    clickRange(view.container, '30 WW')
    expect(lastHitWeek(view.container)).toBe('202606')
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
    pickWeekInDropdown(view.container, '202610')
    const trimmed = WELDING_ROWS.filter((row) => (parseWorkWeek(row[0])?.key ?? 0) >= 202611)
    view.rerender(dashboardElement({ index: indexOf(trimmed) }))
    expect(weekTitle(view.container)).toBe("WW42'2026")
    expect(lastHitWeek(view.container)).toBe('202642')
  })
})

describe('WeldingDashboard system drill-down', () => {
  it('drills into a system and returns from the breadcrumb', () => {
    stubSize()
    view = draw()
    drillInto(view.container, 'AW')
    expect(breadcrumb(view.container)?.textContent).toBe('All systems›AW')
    const labels = [...(panel(view.container, SYSTEMS_TITLE)?.querySelectorAll('.qaqc-row-label') ?? [])].map((node) => node.textContent)
    expect(labels).toEqual(['PCH', 'QCH', 'MDW', 'PCHA'])
    const allSystems = breadcrumb(view.container)?.querySelector('button')
    if (!allSystems) throw new Error('All systems button missing')
    click(allSystems)
    expect(breadcrumb(view.container)).toBeNull()
    expect(systemRow(view.container, 'AW')).not.toBeNull()
  })

  it('keeps the drill across week changes while the system is in the window', () => {
    stubSize()
    view = draw()
    drillInto(view.container, 'AW')
    pickWeekInDropdown(view.container, '202641')
    expect(breadcrumb(view.container)?.textContent).toBe('All systems›AW')
  })

  it('returns to all systems when the drilled system leaves the window, and stays there', () => {
    stubSize()
    view = draw()
    drillInto(view.container, 'AW')
    pickWeekInDropdown(view.container, '202610')
    expect(breadcrumb(view.container)).toBeNull()
    pickWeekInDropdown(view.container, '202642')
    expect(breadcrumb(view.container)).toBeNull()
    expect(systemRow(view.container, 'AW')).not.toBeNull()
  })

  it('moves focus to the systems panel when a refresh drops the drilled system while its breadcrumb has focus', () => {
    stubSize()
    view = draw()
    drillInto(view.container, 'AW')
    const allSystems = breadcrumb(view.container)?.querySelector('button')
    act(() => {
      allSystems?.focus()
    })
    expect(document.activeElement).toBe(allSystems)
    const withoutAw = WELDING_ROWS.filter((row) => row[4]?.trim().toUpperCase() !== 'AW')
    view.rerender(dashboardElement({ index: indexOf(withoutAw) }))
    expect(breadcrumb(view.container)).toBeNull()
    expect(document.activeElement).toBe(panel(view.container, SYSTEMS_TITLE))
  })

  it('leaves focus alone when a refresh drops the drilled system while focus is elsewhere', () => {
    stubSize()
    view = draw()
    drillInto(view.container, 'AW')
    const select = view.container.querySelector('select')
    act(() => {
      select?.focus()
    })
    const withoutAw = WELDING_ROWS.filter((row) => row[4]?.trim().toUpperCase() !== 'AW')
    view.rerender(dashboardElement({ index: indexOf(withoutAw) }))
    expect(breadcrumb(view.container)).toBeNull()
    expect(document.activeElement).toBe(select)
  })
})

describe('WeldingDashboard expanded charts', () => {
  it('gives each chart panel an expand button', () => {
    stubSize()
    view = draw()
    expect(view.container.querySelectorAll('.qaqc-panel .qaqc-expand-button')).toHaveLength(3)
  })

  it('has no expand buttons when interactions are not allowed', () => {
    stubSize()
    view = draw({ interactive: false })
    expect(view.container.querySelector('.qaqc-expand-button')).toBeNull()
  })

  it('expands Signoffs by Work Week with a window summary', () => {
    stubSize()
    view = draw()
    const open = expandPanel(view.container, MAIN_TITLE)
    const terms = [...open.querySelectorAll('.qaqc-summary dt')].map((node) => node.textContent)
    const values = [...open.querySelectorAll('.qaqc-summary dd')].map((node) => node.textContent)
    expect(terms).toEqual(['Welds', 'Signed', 'Sign-off %', 'Issues created'])
    expect(values).toEqual(['1,570', '963', '61.3%', '11'])
    expect(view.container.querySelector('.qaqc-root.is-expanded')).not.toBeNull()
  })

  it('labels the sign-off % at every wide-enough week only in the expanded chart', () => {
    stubSize(1200, 400)
    view = draw()
    // The window moves to WW12–WW41, and every one of those 30 weeks has welds.
    pickWeekInDropdown(view.container, '202641')
    const gridLabels = panel(view.container, MAIN_TITLE)?.querySelectorAll('.qaqc-rate-label').length
    const open = expandPanel(view.container, MAIN_TITLE)
    expect(gridLabels).toBe(1)
    expect(open.querySelectorAll('.qaqc-rate-label')).toHaveLength(30)
  })

  it('expands Sign-off by System into a table of every system in the window', () => {
    stubSize()
    view = draw()
    const open = expandPanel(view.container, SYSTEMS_TITLE)
    expect(open.querySelectorAll('table.qaqc-table .qaqc-disclosure')).toHaveLength(56)
    expect(open.querySelector('.qaqc-legend')).toBeNull()
  })

  it('expands Issues by Building into a table of every building in the window', () => {
    stubSize()
    view = draw()
    const open = expandPanel(view.container, BUILDINGS_TITLE)
    const names = [...open.querySelectorAll('table.qaqc-table tbody th')].map((node) => node.textContent)
    expect(names).toHaveLength(6)
    expect(names).toContain('F632')
    expect(open.querySelector('.qaqc-legend')).toBeNull()
  })

  it('collapses on Esc and returns focus to the expand button', () => {
    stubSize()
    view = draw()
    const open = expandPanel(view.container, SYSTEMS_TITLE)
    act(() => {
      open.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(view.container.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(expandButton(view.container, SYSTEMS_TITLE))
  })
})
