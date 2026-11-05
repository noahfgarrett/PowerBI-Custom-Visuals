import { Flame } from 'lucide-react'
import { act, type ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { WeldingDashboard, type WeldingDashboardProps } from '../components/WeldingDashboard'
import { buildFootnotes } from '../footnotes'
import { resolveTheme } from '../theme'
import type { InspectionRows, WeldColumns, WeldIndex } from '../types'
import { buildWeldIndex, weldBuilding } from '../welds'
import { parseWorkWeek } from '../workWeeks'
import { buttonNamed, checkbox, checkboxLabels, chipTexts, choose, filterButton, openMenu, pick, pressEscape, showing, toggleSection } from './filterHarness'
import { WELDING_ROWS } from './fixtures/weldingRows'
import { render, type Rendered } from './render'
import { PLACEHOLDER_WELD_OPTIONAL, UNBOUND_WELD_OPTIONAL, weldFilterSourceFor, withPlaceholderWeldColumns } from './weldFilterFixture'

const COLUMNS: WeldColumns = { weldWeek: 0, signature: 1, signedWeek: 2, issue: 3, fluidCode: 4, pipeSpec: 5, tagNo: 6 }
const TODAY = new Date(2026, 9, 15) // WW42'2026
const INDEX = buildWeldIndex(WELDING_ROWS, COLUMNS, TODAY)
const FILTER_SOURCE = weldFilterSourceFor(WELDING_ROWS, TODAY)
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
      filterSource={FILTER_SOURCE}
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
  const button = [...container.querySelectorAll('.qaqc-segmented button')].find((item) => item.textContent === label)
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


/** The shading class of the card group with this title: is-week, is-period or is-toDate. */
function groupShading(scope: Element | null | undefined, title: string): string[] {
  const group = [...(scope?.querySelectorAll('section.qaqc-kpi-group') ?? [])].find((node) => node.getAttribute('aria-label') === title)
  if (!group) throw new Error(`${title} group missing`)
  return [...group.classList].filter((name) => name.startsWith('is-'))
}

describe('WeldingDashboard card shading', () => {
  it('draws the week on the lighter card and the project to date on the darker one', () => {
    view = draw()
    expect(groupShading(view.container, "WW42'2026")).toEqual(['is-week'])
    expect(groupShading(view.container, 'Project to date')).toEqual(['is-toDate'])
  })
})

describe('WeldingDashboard cards', () => {
  it('opens on the current week with the four this-week cards', () => {
    view = draw()
    const { container } = view
    expect(weekTitle(container)).toBe("WW42'2026")
    expect(cardValue(container, 'Welds Logged')).toBe('65')
    expect(cardDetail(container, 'Welds Logged')).toBe("+1 vs WW41'2026")
    expect(cardValue(container, 'Signed This Week')).toBe('59')
    expect(cardDetail(container, 'Signed This Week')).toBe("+38 vs WW41'2026")
    expect(cardValue(container, 'Sign-off %')).toBe('32%')
    expect(cardDetail(container, 'Sign-off %')).toBe("21 of 65 · WW42'2026")
    expect(cardValue(container, 'Issues Created')).toBe('1')
    expect(cardDetail(container, 'Issues Created')).toBe("No change vs WW41'2026")
  })

  it('shows the latest weld week sign-off when the current week has no welds', () => {
    // A week later, WW43'2026 has no welds yet.
    const later = buildWeldIndex(WELDING_ROWS, COLUMNS, new Date(2026, 9, 22))
    view = draw({ index: later, filterSource: weldFilterSourceFor(WELDING_ROWS, new Date(2026, 9, 22)) })
    const { container } = view
    expect(weekTitle(container)).toBe("WW43'2026")
    expect(cardValue(container, 'Welds Logged')).toBe('0')
    expect(cardDetail(container, 'Welds Logged')).toBe("−65 vs WW42'2026")
    expect(cardValue(container, 'Sign-off %')).toBe('32%')
    expect(cardDetail(container, 'Sign-off %')).toBe("21 of 65 · WW42'2026")
    expect(cardDetail(container, 'Overall Sign-off %')).toBe("No change vs WW42'2026")
  })

  it('opens with the three project-to-date cards through the current week', () => {
    view = draw()
    const { container } = view
    expect(container.querySelector('.qaqc-kpi-group.is-toDate em')?.textContent).toBe("Through WW42'2026")
    expect(cardValue(container, 'Total Welds')).toBe('1,751')
    expect(cardDetail(container, 'Total Welds')).toBe('+65 this WW')
    expect(cardValue(container, 'Welds Signed')).toBe('1,105')
    expect(cardDetail(container, 'Welds Signed')).toBe('+59 signed this WW')
    expect(cardValue(container, 'Overall Sign-off %')).toBe('63.1%')
    expect(cardDetail(container, 'Overall Sign-off %')).toBe("−1.2 pts vs WW41'2026")
  })

  it('marks Overall Sign-off % on track at 63%', () => {
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
    expect(container.querySelector('.qaqc-kpi-group.is-toDate em')?.textContent).toBe("Through WW41'2026")
    expect(cardValue(container, 'Welds Logged')).toBe('64')
    expect(cardDetail(container, 'Welds Logged')).toBe("−3 vs WW40'2026")
    expect(cardValue(container, 'Signed This Week')).toBe('21')
    expect(cardDetail(container, 'Signed This Week')).toBe("−3 vs WW40'2026")
    expect(cardDetail(container, 'Sign-off %')).toBe("21 of 64 · WW41'2026")
    expect(cardDetail(container, 'Total Welds')).toBe('+64 this WW')
    expect(cardDetail(container, 'Welds Signed')).toBe('+21 signed this WW')
  })

  it('shows the latest weld week sign-off for WW40', () => {
    view = draw()
    pickWeekInDropdown(view.container, '202640')
    expect(cardValue(view.container, 'Welds Logged')).toBe('67')
    expect(cardDetail(view.container, 'Sign-off %')).toBe("24 of 67 · WW40'2026")
    expect(cardValue(view.container, 'Signed This Week')).toBe('24')
  })

  it('colors Overall Sign-off % green when it rises and red when it falls', () => {
    view = draw()
    pickWeekInDropdown(view.container, '202625')
    expect(card(view.container, 'Overall Sign-off %')?.querySelector('.qaqc-kpi-detail.is-good')).not.toBeNull()
    pickWeekInDropdown(view.container, '202626')
    expect(card(view.container, 'Overall Sign-off %')?.querySelector('.qaqc-kpi-detail.is-bad')).not.toBeNull()
  })

  it('warns when Issues Created goes up', () => {
    view = draw()
    pickWeekInDropdown(view.container, '202615')
    expect(cardDetail(view.container, 'Issues Created')).toBe("+1 vs WW14'2026")
    expect(card(view.container, 'Issues Created')?.querySelector('.qaqc-kpi-detail.is-warn')).not.toBeNull()
  })

  it('does not color the Sign-off % value at 32%', () => {
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
    const all = [...view.container.querySelectorAll('.qaqc-segmented button')].find((button) => button.textContent === 'All')
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

  it('uses the compact cards-only layout on a short, narrow tile', () => {
    view = draw({ viewport: { width: 800, height: 300 } })
    const root = view.container.querySelector('.qaqc-root')
    expect(root?.classList.contains('is-cards-only')).toBe(true)
    expect(root?.classList.contains('is-compact')).toBe(true)
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
    expect(cardValue(view.container, 'Welds Logged')).toBe('50')
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
    expect(labels).toEqual([
      'A1A', 'PCH', 'B_MDW', 'J1A', 'PCHA', 'D1A', 'MCF', 'MQW', 'K1A', 'PCHF', 'QCH',
      'K2A', 'O1U', 'B_PAQ', 'M2W', 'M3W', 'MDW', 'B_MQW', 'J1B', 'MCV', 'N1W',
    ])
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
    // The fixtures have AW welds in every week, so drop those through WW10 to leave the WW10 window without AW.
    const lateAw = WELDING_ROWS.filter((row) => !(row[4] === 'AW' && (parseWorkWeek(row[0])?.key ?? 0) <= 202610))
    view = draw({ index: indexOf(lateAw), filterSource: weldFilterSourceFor(lateAw, TODAY) })
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
    expect(values).toEqual(['1,423', '878', '61.7%', '8'])
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
    expect(open.querySelectorAll('table.qaqc-table .qaqc-disclosure')).toHaveLength(57)
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

describe('WeldingDashboard filters', () => {
  const PLACEHOLDER_ROWS = withPlaceholderWeldColumns(WELDING_ROWS)

  function drawFiltered(
    rows: InspectionRows = PLACEHOLDER_ROWS,
    optional: WeldingDashboardProps['filterSource']['optional'] = PLACEHOLDER_WELD_OPTIONAL,
    overrides: Partial<WeldingDashboardProps> = {},
  ): HTMLElement {
    const index = buildWeldIndex(rows, COLUMNS, TODAY)
    view = draw({ index, filterSource: weldFilterSourceFor(rows, TODAY, optional), footnotes: buildFootnotes(index, false), ...overrides })
    return view.container
  }

  function sectionTitles(container: HTMLElement): string[] {
    return [...container.querySelectorAll('.qaqc-filter-section-toggle span:first-of-type')].map((node) => node.textContent ?? '')
  }

  function setRange(container: HTMLElement, fromKey: number, toKey: number): void {
    const [from, to] = container.querySelectorAll<HTMLSelectElement>('.qaqc-filter-date select')
    choose(from, fromKey)
    choose(to, toKey)
  }

  function weekPicker(container: HTMLElement): HTMLSelectElement {
    return pick(container, '.qaqc-week-picker select', HTMLSelectElement)
  }

  function groupSubtitle(container: HTMLElement): string | null {
    return container.querySelector('.qaqc-kpi-group.is-toDate em')?.textContent ?? null
  }

  it('shows the Filter button with only the bound fields', () => {
    const container = drawFiltered(WELDING_ROWS, UNBOUND_WELD_OPTIONAL)
    openMenu(container)
    expect(sectionTitles(container)).toEqual(['Building', 'Pipe Spec', 'Fluid Code'])
  })

  it('lists the fields in the menu order when all are bound', () => {
    const container = drawFiltered()
    openMenu(container)
    expect(sectionTitles(container)).toEqual(['Building', 'Pipe Spec', 'Fluid Code', 'Welder', 'Work Package'])
  })

  it('no filter leaves existing output identical', () => {
    const container = drawFiltered(WELDING_ROWS, UNBOUND_WELD_OPTIONAL)
    expect(cardValue(container, 'Total Welds')).toBe('1,751')
    expect(cardValue(container, 'Overall Sign-off %')).toBe('63.1%')
    expect(chipTexts(container)).toEqual([])
    const before = container.querySelector('.qaqc-kpi-row')?.innerHTML
    openMenu(container)
    click(checkbox(container, 'F632'))
    expect(container.querySelector('.qaqc-kpi-row')?.innerHTML).not.toBe(before)
    click(checkbox(container, 'F632'))
    expect(container.querySelector('.qaqc-kpi-row')?.innerHTML).toBe(before)
    expect(chipTexts(container)).toEqual([])
  })

  it('Building filters through the Tag No derivation, and agrees with the chart', () => {
    stubSize()
    const container = drawFiltered(WELDING_ROWS, UNBOUND_WELD_OPTIONAL, { minWelds: 1 })
    // A building with issues, or the chart has no bars to compare.
    const building = weldBuilding(WELDING_ROWS[INDEX.issueRowsByWeek.flat()[0]][COLUMNS.tagNo])
    const expected = WELDING_ROWS.filter((row) => weldBuilding(row[COLUMNS.tagNo]) === building)
    expect(expected.length).toBeGreaterThan(0)
    expect(expected.length).toBeLessThan(WELDING_ROWS.length)
    openMenu(container)
    click(checkbox(container, building))
    expect(chipTexts(container)).toEqual([`Building: ${building}`])
    expect(cardValue(container, 'Total Welds')).toBe(expected.length.toLocaleString('en-US'))
    click(filterButton(container))
    clickRange(container, 'All')
    const labels = [...(panel(container, BUILDINGS_TITLE)?.querySelectorAll('.qaqc-row-label') ?? [])].map((node) => node.textContent)
    expect(labels).toEqual([building])
  })

  it('offers the chart\'s Site General as a Building, and filters to it', () => {
    const rows: InspectionRows = [
      ["WW40'2026", null, null, null, 'AW', 'PCH', 'BATCH-PLANT-FW-1'],
      ["WW40'2026", null, null, null, 'AW', 'PCH', 'BATCH-PLANT-FW-2'],
      ["WW40'2026", null, null, null, 'AW', 'PCH', 'F631M001XX-P001-FW-01'],
    ]
    const container = drawFiltered(rows, UNBOUND_WELD_OPTIONAL)
    openMenu(container)
    expect(checkboxLabels(container)).toContain('Site General')
    click(checkbox(container, 'Site General'))
    expect(cardValue(container, 'Total Welds')).toBe('2')
    expect(showing(container)).toBe('Showing 2 of 3 rows')
  })

  it('a weld listing P-012 and PF-025 matches either and counts once in Showing X of Y', () => {
    const rows: InspectionRows = [
      ["WW40'2026", null, null, null, 'AW', 'PCH', 'F631M001XX-P001-FW-01', 'P-012, PF-025', 'WP-100'],
      ["WW40'2026", null, null, null, 'AW', 'PCH', 'F631M001XX-P001-FW-02', 'P-012', 'WP-100'],
      ["WW40'2026", null, null, null, 'AW', 'PCH', 'F631M001XX-P001-FW-03', 'PF-025', 'WP-100'],
      ["WW40'2026", null, null, null, 'AW', 'PCH', 'F631M001XX-P001-FW-04', 'P-031', 'WP-100'],
    ]
    const container = drawFiltered(rows)
    openMenu(container)
    toggleSection(container, 'Welder')
    click(checkbox(container, 'PF-025'))
    expect(showing(container)).toBe('Showing 2 of 4 rows')
    expect(cardValue(container, 'Total Welds')).toBe('2')
    click(checkbox(container, 'P-012'))
    expect(showing(container)).toBe('Showing 3 of 4 rows')
    expect(cardValue(container, 'Total Welds')).toBe('3')
    expect(chipTexts(container)).toEqual(['Welder: P-012, PF-025'])
  })

  it('in range, the to-date cards and weekly charts restate', () => {
    stubSize()
    const container = drawFiltered(WELDING_ROWS, UNBOUND_WELD_OPTIONAL)
    openMenu(container)
    setRange(container, 202610, 202630)
    expect(groupShading(container, 'In range')).toEqual(['is-toDate'])
    expect(groupSubtitle(container)).toBe("WW10'2026 to WW30'2026")
    expect(chipTexts(container)).toEqual(["Date range: WW10'2026 to WW30'2026"])

    const inRange = WELDING_ROWS.filter((row) => {
      const key = parseWorkWeek(row[0])?.key ?? 0
      return key >= 202610 && key <= 202630
    })
    const signed = inRange.filter((row) => row[1] !== null)
    expect(cardValue(container, 'Total Welds')).toBe(inRange.length.toLocaleString('en-US'))
    expect(cardValue(container, 'Welds Signed')).toBe(signed.length.toLocaleString('en-US'))
    const rate = `${((signed.length / inRange.length) * 100).toFixed(1)}%`
    expect(cardValue(container, 'Overall Sign-off %')).toBe(rate)
    expect(cardDetail(container, 'Overall Sign-off %')).toBe(`${signed.length} of ${inRange.length}`)

    const weeks = mainHitWeeks(container)
    expect(weeks).toHaveLength(21)
    expect(weeks[0]).toBe('202610')
    expect(weeks[20]).toBe('202630')
  })

  it('reads Issues by Building over the range', () => {
    stubSize()
    const container = drawFiltered(WELDING_ROWS, UNBOUND_WELD_OPTIONAL, { minWelds: 1 })
    const totalIn = (open: HTMLElement): number => [...open.querySelectorAll('table.qaqc-table tbody tr')]
      .reduce((sum, row) => sum + Number((row.querySelectorAll('td')[0]?.textContent ?? '0').replace(/,/g, '')), 0)
    openMenu(container)
    setRange(container, 202610, 202630)
    click(filterButton(container))
    const open = expandPanel(container, BUILDINGS_TITLE)
    const inRange = WELDING_ROWS.filter((row) => {
      const key = parseWorkWeek(row[0])?.key ?? 0
      return key >= 202610 && key <= 202630
    })
    expect(totalIn(open)).toBe(inRange.length)
  })

  it('clamps the selected week into the range, and This WW cards follow it', () => {
    const container = drawFiltered(WELDING_ROWS, UNBOUND_WELD_OPTIONAL)
    openMenu(container)
    setRange(container, 202610, 202630)
    expect(weekTitle(container)).toBe("WW30'2026")
    const logged = WELDING_ROWS.filter((row) => row[0] === "WW30'2026").length
    expect(cardValue(container, 'Welds Logged')).toBe(String(logged))
    expect(cardDetail(container, 'Total Welds')).toBe(`+${logged} this WW`)
  })

  it('the 30 WW | All toggle is disabled during a range', () => {
    const container = drawFiltered(WELDING_ROWS, UNBOUND_WELD_OPTIONAL)
    const toggles = (): HTMLButtonElement[] => [...container.querySelectorAll<HTMLButtonElement>('.qaqc-segmented button')]
    expect(toggles().every((button) => !button.disabled)).toBe(true)
    openMenu(container)
    click(buttonNamed(container, 'Last 4 WW'))
    expect(toggles().every((button) => button.disabled)).toBe(true)
    click(buttonNamed(container, 'Last 4 WW'))
    expect(toggles().every((button) => !button.disabled)).toBe(true)
  })

  it('the week picker lists only the range\'s weeks', () => {
    const container = drawFiltered(WELDING_ROWS, UNBOUND_WELD_OPTIONAL)
    expect(weekPicker(container).options).toHaveLength(44)
    openMenu(container)
    setRange(container, 202610, 202630)
    const options = [...weekPicker(container).options].map((option) => option.value)
    expect(options).toHaveLength(21)
    expect(options[0]).toBe('202630')
    expect(options[20]).toBe('202610')
  })

  it('a filter whose first match is WW20 still shows WW10 to WW30 in a WW10–WW30 range', () => {
    stubSize()
    const rows: InspectionRows = [
      ["WW05'2026", null, null, null, 'AW', 'PCH', 'F631M001XX-P001-FW-01'],
      ["WW20'2026", 'signed', "WW20'2026", 'BIM 1', 'AW', 'PCH', 'BK1XX101XX-M001-FW-01'],
      ["WW25'2026", null, null, null, 'AW', 'PCH', 'BK1XX101XX-M001-FW-02'],
      ["WW42'2026", null, null, null, 'AW', 'PCH', 'F631M001XX-P001-FW-02'],
    ]
    const container = drawFiltered(rows, UNBOUND_WELD_OPTIONAL)
    openMenu(container)
    click(checkbox(container, 'BK1'))
    setRange(container, 202610, 202630)

    const weeks = mainHitWeeks(container)
    expect(weeks).toHaveLength(21)
    expect(weeks[0]).toBe('202610')
    expect(weeks[20]).toBe('202630')
    expect(weekPicker(container).options).toHaveLength(21)
    expect(groupSubtitle(container)).toBe("WW10'2026 to WW30'2026")
    expect(cardValue(container, 'Total Welds')).toBe('2')
    expect(cardValue(container, 'Overall Sign-off %')).toBe('50.0%')

    // A week before the filter's first match can be selected like any other.
    click(filterButton(container))
    clickHit(container, '202612')
    expect(weekTitle(container)).toBe("WW12'2026")
  })

  it('the existing selection and From/To stay valid', () => {
    const rows: InspectionRows = [
      ["WW10'2026", null, null, null, 'AW', 'PCH', 'F631M001XX-P001-FW-01'],
      ["WW38'2026", null, null, null, 'AW', 'PCH', 'BK1XX101XX-M001-FW-01'],
      ["WW42'2026", null, null, null, 'AW', 'PCH', 'F631M001XX-P001-FW-02'],
    ]
    const container = drawFiltered(rows, UNBOUND_WELD_OPTIONAL)
    expect(weekPicker(container).options).toHaveLength(33)
    pickWeekInDropdown(container, '202612')
    openMenu(container)
    click(checkbox(container, 'BK1'))

    // The filter's first match is WW38, and the picked WW12 still exists on the axis.
    expect(weekPicker(container).options).toHaveLength(33)
    expect(weekTitle(container)).toBe("WW12'2026")
    expect(cardValue(container, 'Welds Logged')).toBe('0')
    const [from, to] = container.querySelectorAll<HTMLSelectElement>('.qaqc-filter-date select')
    expect(from.options).toHaveLength(33)
    expect(to.options).toHaveLength(33)

    click(checkbox(container, 'BK1'))
    expect(weekTitle(container)).toBe("WW12'2026")
  })

  it('counts Showing X of Y over the rows in the range', () => {
    const container = drawFiltered(WELDING_ROWS, UNBOUND_WELD_OPTIONAL)
    openMenu(container)
    expect(showing(container)).toBe('Showing 1,751 of 1,751 rows')
    setRange(container, 202610, 202630)
    const inRange = WELDING_ROWS.filter((row) => {
      const key = parseWorkWeek(row[0])?.key ?? 0
      return key >= 202610 && key <= 202630
    })
    expect(showing(container)).toBe(`Showing ${inRange.length.toLocaleString('en-US')} of 1,751 rows`)
  })

  it('no matching rows shows the empty state with Clear filters', () => {
    const rows: InspectionRows = [
      ["WW10'2026", null, null, null, 'AW', 'PCH', 'F631M001XX-P001-FW-01'],
      ["WW30'2026", null, null, null, 'AW', 'PCH', 'BK1XX101XX-M001-FW-01'],
    ]
    const container = drawFiltered(rows, UNBOUND_WELD_OPTIONAL)
    openMenu(container)
    setRange(container, 202611, 202620)
    const empty = container.querySelector('.qaqc-filter-empty')
    expect(empty?.textContent).toContain('There are no welds in this date range')
    expect(container.querySelector('.qaqc-kpi-row')).toBeNull()
    expect(container.querySelector('.qaqc-charts')).toBeNull()
    click(buttonNamed(container, 'Clear filters'))
    expect(container.querySelector('.qaqc-filter-empty')).toBeNull()
    expect(cardValue(container, 'Total Welds')).toBe('2')
    expect(document.activeElement).toBe(filterButton(container))
  })

  it('shows no empty state for an empty report with no filters', () => {
    const container = drawFiltered([], UNBOUND_WELD_OPTIONAL)
    expect(container.querySelector('.qaqc-filter-empty')).toBeNull()
    expect(panel(container, MAIN_TITLE)?.textContent).toContain('No welds match the current filters')
  })

  it('says a filter\'s rows are outside the recent window instead of drawing an empty chart', () => {
    const rows: InspectionRows = [
      ["WW01'2026", null, null, null, 'AW', 'PCH', 'BK1XX101XX-M001-FW-01'],
      ["WW42'2026", null, null, null, 'AW', 'PCH', 'F631M001XX-P001-FW-01'],
    ]
    const container = drawFiltered(rows, UNBOUND_WELD_OPTIONAL)
    openMenu(container)
    click(checkbox(container, 'BK1'))
    expect(panel(container, MAIN_TITLE)?.textContent).toContain('switch to All')
    click(filterButton(container))
    clickRange(container, 'All')
    expect(panel(container, MAIN_TITLE)?.textContent).not.toContain('switch to All')
  })

  it('restates skipped and future footnotes to the filtered rows', () => {
    const rows: InspectionRows = [
      ['not a week', null, null, null, 'AW', 'PCH', 'BK1XX101XX-M001-FW-01'],
      ['not a week', null, null, null, 'AW', 'PCH', 'F631M001XX-P001-FW-01'],
      ["WW42'2026", null, null, null, 'AW', 'PCH', 'F631M001XX-P001-FW-02'],
    ]
    const container = drawFiltered(rows, UNBOUND_WELD_OPTIONAL)
    expect(container.querySelector('.qaqc-footnotes')?.textContent).toContain('2 rows skipped')
    openMenu(container)
    click(checkbox(container, 'BK1'))
    expect(container.querySelector('.qaqc-footnotes')?.textContent).toContain('1 row skipped')
  })

  it('disables the Filter button when interactions are not allowed', () => {
    const container = drawFiltered(WELDING_ROWS, UNBOUND_WELD_OPTIONAL, { interactive: false })
    expect(filterButton(container).disabled).toBe(true)
  })

  it('returns to all systems when a filter removes the drilled system', () => {
    stubSize()
    const rows: InspectionRows = [
      ["WW40'2026", null, null, null, 'AW', 'PCH', 'BK1XX101XX-M001-FW-01'],
      ["WW40'2026", null, null, null, 'CWS', 'PCH', 'F631M001XX-P001-FW-01'],
    ]
    const container = drawFiltered(rows, UNBOUND_WELD_OPTIONAL)
    drillInto(container, 'AW')
    expect(breadcrumb(container)).not.toBeNull()
    openMenu(container)
    click(checkbox(container, 'F631'))
    expect(breadcrumb(container)).toBeNull()
    expect(systemRow(container, 'CWS')).not.toBeNull()
  })
})

describe('WeldingDashboard week drill-down', () => {
  const PLACEHOLDER_ROWS = withPlaceholderWeldColumns(WELDING_ROWS)
  const ISSUE_KEY = 202618
  const ISSUE_TITLE = "Issues · WW18'2026"

  function drawDrill(
    rows: InspectionRows = PLACEHOLDER_ROWS,
    optional: WeldingDashboardProps['filterSource']['optional'] = PLACEHOLDER_WELD_OPTIONAL,
    overrides: Partial<WeldingDashboardProps> = {},
  ): HTMLElement {
    stubSize()
    const index = buildWeldIndex(rows, COLUMNS, TODAY)
    view = draw({ index, filterSource: weldFilterSourceFor(rows, TODAY, optional), ...overrides })
    return view.container
  }

  function page(container: HTMLElement): HTMLElement | null {
    return [...container.querySelectorAll<HTMLElement>('[role="dialog"]')].find((node) => node.getAttribute('aria-label')?.startsWith('Issues · ')) ?? null
  }

  function pageRows(container: HTMLElement): string[][] {
    const rows = page(container)?.querySelectorAll('tbody tr:not(.qaqc-virtual-spacer)') ?? []
    return [...rows].map((row) => [...row.children].map((cell) => cell.textContent ?? ''))
  }

  function pageHeaders(container: HTMLElement): string[] {
    return [...(page(container)?.querySelectorAll('thead th') ?? [])].map((node) => node.textContent ?? '')
  }

  function backButton(container: HTMLElement): HTMLButtonElement {
    const button = page(container)?.querySelector<HTMLButtonElement>('.qaqc-back-button')
    if (!button) throw new Error('back button missing')
    return button
  }

  function chart(container: HTMLElement): Element {
    const svg = panel(container, MAIN_TITLE)?.querySelector('svg.qaqc-chart')
    if (!svg) throw new Error('chart missing')
    return svg
  }

  function hit(container: HTMLElement, key: number): Element {
    const rect = panel(container, MAIN_TITLE)?.querySelector(`.qaqc-hit[data-week="${key}"]`)
    if (!rect) throw new Error(`no week ${key}`)
    return rect
  }

  function pressOn(target: Element, key: string): void {
    act(() => {
      target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
    })
  }

  /** The number the chart itself shows for a week: its tooltip's Issues created. */
  function chartIssues(container: HTMLElement, onHover: ReturnType<typeof vi.fn>, key: number): number {
    act(() => {
      hit(container, key).dispatchEvent(new MouseEvent('mousemove', { bubbles: true }))
    })
    const request: unknown = onHover.mock.lastCall?.[0]
    if (typeof request !== 'object' || request === null || !('rows' in request) || !Array.isArray(request.rows)) throw new Error('no tooltip')
    const row: unknown = request.rows.find((item: { label?: string }) => item.label === 'Issues created')
    if (typeof row !== 'object' || row === null || !('value' in row)) throw new Error('no issue row')
    return Number(row.value)
  }

  it('a click on a week with issues selects it and opens the page titled Issues · WW18\'2026', () => {
    const container = drawDrill()
    click(hit(container, ISSUE_KEY))
    expect(weekTitle(container)).toBe("WW18'2026")
    const open = page(container)
    expect(open?.getAttribute('aria-label')).toBe(ISSUE_TITLE)
    expect(open?.querySelector('h3')?.textContent).toBe(ISSUE_TITLE)
    expect(open?.querySelector('.qaqc-week-issues-count')?.textContent).toBe("1 issue in WW18'2026")
  })

  it('a click on a week with none only selects it', () => {
    const container = drawDrill()
    click(hit(container, 202635))
    expect(weekTitle(container)).toBe("WW35'2026")
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('Enter on the focused week behaves the same', () => {
    const container = drawDrill()
    // The focus follows the selected week; WW40 has no issues.
    pickWeekInDropdown(container, '202640')
    pressOn(chart(container), 'Enter')
    expect(weekTitle(container)).toBe("WW40'2026")
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    pickWeekInDropdown(container, String(ISSUE_KEY))
    pressOn(chart(container), 'Enter')
    expect(page(container)?.getAttribute('aria-label')).toBe(ISSUE_TITLE)
  })

  it('Esc and Back return to the dashboard with focus on the chart', () => {
    const container = drawDrill()
    click(hit(container, ISSUE_KEY))
    expect(document.activeElement).toBe(backButton(container))
    click(backButton(container))
    expect(page(container)).toBeNull()
    expect(document.activeElement).toBe(chart(container))

    click(hit(container, ISSUE_KEY))
    const open = page(container)
    if (!open) throw new Error('page missing')
    pressEscape(open)
    expect(page(container)).toBeNull()
    expect(document.activeElement).toBe(chart(container))
  })

  it('clears the tooltip when the page opens', () => {
    const onHover = vi.fn()
    const container = drawDrill(PLACEHOLDER_ROWS, PLACEHOLDER_WELD_OPTIONAL, { onHover })
    act(() => {
      hit(container, ISSUE_KEY).dispatchEvent(new MouseEvent('mousemove', { bubbles: true }))
    })
    click(hit(container, ISSUE_KEY))
    expect(onHover).toHaveBeenLastCalledWith(null)
  })

  it('opens from the expanded chart, and goes back to the dashboard with focus on the grid chart', () => {
    const container = drawDrill()
    clickRange(container, 'All')
    const open = expandPanel(container, MAIN_TITLE)
    const rect = open.querySelector(`.qaqc-hit[data-week="${ISSUE_KEY}"]`)
    if (!rect) throw new Error('expanded chart has no week')
    click(rect)
    expect(page(container)?.getAttribute('aria-label')).toBe(ISSUE_TITLE)
    click(backButton(container))
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(chart(container))
  })

  it('every week\'s drill list length equals the chart\'s issue count, with and without a filter', () => {
    const onHover = vi.fn()
    const container = drawDrill(PLACEHOLDER_ROWS, PLACEHOLDER_WELD_OPTIONAL, { onHover })
    clickRange(container, 'All')

    function expectListsToMatch(index: WeldIndex): number {
      let opened = 0
      for (const item of index.weeks) {
        const count = chartIssues(container, onHover, item.week.key)
        expect(count).toBe(item.issues)
        click(hit(container, item.week.key))
        expect(weekTitle(container)).toBe(item.week.label)
        if (count === 0) {
          expect(page(container)).toBeNull()
          continue
        }
        opened += 1
        expect(pageRows(container)).toHaveLength(count)
        const noun = count === 1 ? 'issue' : 'issues'
        expect(page(container)?.querySelector('.qaqc-week-issues-count')?.textContent).toBe(`${count} ${noun} in ${item.week.label}`)
        click(backButton(container))
      }
      return opened
    }

    const baseIndex = buildWeldIndex(PLACEHOLDER_ROWS, COLUMNS, TODAY)
    expect(expectListsToMatch(baseIndex)).toBe(baseIndex.weeks.filter((item) => item.issues > 0).length)
    expect(baseIndex.cumulativeIssues[baseIndex.cumulativeIssues.length - 1]).toBeGreaterThan(0)

    // The building of the first issue, so the filtered list still has weeks to open.
    const building = weldBuilding(PLACEHOLDER_ROWS[baseIndex.issueRowsByWeek.flat()[0]][COLUMNS.tagNo])
    openMenu(container)
    click(checkbox(container, building))
    click(filterButton(container))
    const filtered = PLACEHOLDER_ROWS.filter((row) => weldBuilding(row[COLUMNS.tagNo]) === building)
    const filteredIndex = buildWeldIndex(filtered, COLUMNS, TODAY, { axisFromKey: baseIndex.weeks[0].week.key })
    expect(expectListsToMatch(filteredIndex)).toBeGreaterThan(0)
    // Opens the page for every issue week twice, which takes a while on a busy machine.
  }, 30_000)

  it('lists the filtered rows, not the rows at the same positions of the full data', () => {
    const rows: InspectionRows = [
      ["WW40'2026", null, null, 'BIM 1', 'AW', 'PCH', 'BK1XX101XX-M001-FW-01'],
      ["WW40'2026", null, null, 'BIM 2', 'AW', 'PCH', 'BK1XX101XX-M001-FW-02'],
      ["WW40'2026", 'signed', "WW41'2026", 'BIM 3', 'IW', 'QCH', 'F631M001XX-P001-FW-01'],
      ["WW40'2026", null, null, 'No', 'IW', 'QCH', 'F631M001XX-P001-FW-02'],
      ["WW40'2026", null, null, null, 'IW', 'QCH', 'F631M001XX-P001-FW-03'],
    ]
    const container = drawDrill(rows, UNBOUND_WELD_OPTIONAL)
    openMenu(container)
    click(checkbox(container, 'F631'))
    click(filterButton(container))
    click(hit(container, 202640))
    expect(pageHeaders(container)).toEqual(['Tag No', 'Pipe Spec', 'Fluid Code', 'Issue Created', 'Signature'])
    expect(pageRows(container)).toEqual([['F631M001XX-P001-FW-01', 'QCH', 'IW', 'BIM 3', 'signed']])
  })

  it('shows Welder when it is bound', () => {
    const rows: InspectionRows = [
      ["WW40'2026", null, null, 'BIM 1', 'AW', 'PCH', 'BK1XX101XX-M001-FW-01', 'P-012, PF-025', 'WP-100'],
    ]
    const container = drawDrill(rows)
    click(hit(container, 202640))
    expect(pageHeaders(container)).toEqual(['Tag No', 'Welder', 'Pipe Spec', 'Fluid Code', 'Issue Created', 'Signature'])
    expect(pageRows(container)).toEqual([['BK1XX101XX-M001-FW-01', 'P-012, PF-025', 'PCH', 'AW', 'BIM 1', '']])
  })

  it('a filter that leaves a week with no issues only selects it', () => {
    const rows: InspectionRows = [
      ["WW40'2026", null, null, 'BIM 1', 'AW', 'PCH', 'BK1XX101XX-M001-FW-01'],
      ["WW40'2026", null, null, null, 'AW', 'PCH', 'F631M001XX-P001-FW-01'],
    ]
    const container = drawDrill(rows, UNBOUND_WELD_OPTIONAL)
    openMenu(container)
    click(checkbox(container, 'F631'))
    click(filterButton(container))
    click(hit(container, 202640))
    expect(weekTitle(container)).toBe("WW40'2026")
    expect(page(container)).toBeNull()
  })

  it('a date range only limits the weeks on the chart, not a week\'s list', () => {
    const container = drawDrill()
    openMenu(container)
    const [from, to] = container.querySelectorAll<HTMLSelectElement>('.qaqc-filter-date select')
    choose(from, 202615)
    choose(to, 202620)
    click(filterButton(container))
    expect(mainHitWeeks(container)).toHaveLength(6)
    click(hit(container, ISSUE_KEY))
    expect(pageRows(container)).toHaveLength(1)
  })

  it('with interactions off, a click neither selects nor opens', () => {
    const container = drawDrill(PLACEHOLDER_ROWS, PLACEHOLDER_WELD_OPTIONAL, { interactive: false })
    click(hit(container, ISSUE_KEY))
    expect(weekTitle(container)).toBe("WW42'2026")
    expect(page(container)).toBeNull()
  })

  it('the other Welding charts do not open it', () => {
    const container = drawDrill()
    pickWeekInDropdown(container, String(ISSUE_KEY))
    const row = container.querySelector('.qaqc-drill-row')
    if (!row) throw new Error('no system row')
    click(row)
    expect(breadcrumb(container)).not.toBeNull()
    expect(page(container)).toBeNull()
  })
})
