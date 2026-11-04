import { Cog, Zap } from 'lucide-react'
import { act, type ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { InspectionDashboard, type InspectionDashboardProps } from '../components/InspectionDashboard'
import { buildFootnotes } from '../footnotes'
import { buildInspectionIndex, buildInspectionModel, defaultViewState } from '../inspections'
import { resolveTheme } from '../theme'
import type { InspectionRows } from '../types'
import { parseWorkWeek } from '../workWeeks'
import { buttonNamed, checkbox, checkboxLabels, chipTexts, choose, click, filterButton, openMenu, pick, showing, toggleSection } from './filterHarness'
import { ELECTRICAL_ROWS } from './fixtures/electricalRows'
import { filterSourceFor, PLACEHOLDER_OPTIONAL, UNBOUND_OPTIONAL, withPlaceholderColumns } from './inspectionFilterFixture'
import { render, type Rendered } from './render'

const INDEX = buildInspectionIndex(ELECTRICAL_ROWS, { workWeek: 0, phase: 1, issue: 2, building: 3 }, new Date(2026, 9, 15))
const TODAY = new Date(2026, 9, 15)
const FILTER_SOURCE = filterSourceFor(ELECTRICAL_ROWS, TODAY)
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
      filterSource={FILTER_SOURCE}
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

function cardDetail(container: HTMLElement, label: string): string | null {
  return container.querySelector(`[aria-label^="${label}:"] .qaqc-kpi-detail`)?.textContent ?? null
}


/** The shading class of the card group with this title: is-week, is-period or is-toDate. */
function groupShading(scope: Element | null | undefined, title: string): string[] {
  const group = [...(scope?.querySelectorAll('section.qaqc-kpi-group') ?? [])].find((node) => node.getAttribute('aria-label') === title)
  if (!group) throw new Error(`${title} group missing`)
  return [...group.classList].filter((name) => name.startsWith('is-'))
}

describe('InspectionDashboard card shading', () => {
  it('draws the week on the lighter card and the project to date on the darker one', () => {
    view = draw()
    expect(groupShading(view.container, "WW42'2026")).toEqual(['is-week'])
    expect(groupShading(view.container, 'Project to date')).toEqual(['is-toDate'])
  })

  it('shades Mechanical the same way', () => {
    view = draw({ title: 'Mechanical / Process Inspections', icon: Cog })
    expect(groupShading(view.container, "WW42'2026")).toEqual(['is-week'])
    expect(groupShading(view.container, 'Project to date')).toEqual(['is-toDate'])
  })
})

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

  it('compares the week cards against the previous week by its full label', () => {
    view = draw()
    const { container } = view
    expect(cardDetail(container, 'Final Inspections')).toBe("−3 vs WW41'2026")
    expect(cardDetail(container, 'SORs')).toMatch(/ vs WW41'2026$/)
    expect(cardDetail(container, 'Issues Found')).toMatch(/ vs WW41'2026$/)
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
    expect(view.container.querySelector('.qaqc-kpi-group.is-toDate em')?.textContent).toBe("Through WW41'2026")
  })

  it('toggles the chart range', () => {
    view = draw()
    const all = Array.from(view.container.querySelectorAll('.qaqc-segmented button')).find((button) => button.textContent === 'All')
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
        filterSource={FILTER_SOURCE}
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
  const button = Array.from(container.querySelectorAll('.qaqc-segmented button')).find((item) => item.textContent === label)
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
  interactive = true,
): ReactElement {
  return (
    <InspectionDashboard
      title="Electrical Inspections"
      icon={Zap}
      index={index}
      filterSource={FILTER_SOURCE}
      theme={THEME}
      interactive={interactive}
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

  it('shows no Finals/SORs legend in the expanded building table', () => {
    stubSize()
    view = draw()
    expandPanel(view.container, 'Inspections by Building')
    expect(dialog(view.container, 'Inspections by Building')?.querySelector('.qaqc-legend')).toBeNull()
  })

  it('keeps the Finals/SORs legend on the grid building panel', () => {
    stubSize()
    view = draw()
    const gridPanel = [...view.container.querySelectorAll('.qaqc-panel')].find((node) => node.textContent?.includes('Inspections by Building'))
    expect(gridPanel?.querySelector('.qaqc-legend')).not.toBeNull()
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

  it('draws a week axis on the expanded pass-rate chart only', () => {
    stubSize()
    view = draw()
    const axisWeeks = (root: ParentNode | null | undefined): number =>
      [...(root?.querySelectorAll('.qaqc-axis-text') ?? [])].filter((node) => node.textContent?.startsWith('WW')).length
    const gridPanel = [...view.container.querySelectorAll('.qaqc-panel')].find((node) => node.textContent?.includes('NCR Pass Rate Trend'))
    const gridLabelsBefore = axisWeeks(gridPanel?.querySelector('svg[aria-label^="NCR pass rate"]'))
    expandPanel(view.container, 'NCR Pass Rate Trend')
    const open = dialog(view.container, 'NCR Pass Rate Trend')
    expect(gridLabelsBefore).toBe(0)
    expect(axisWeeks(open)).toBeGreaterThan(0)
    expect(open?.querySelector('.qaqc-axis-text.is-selected')?.textContent).toMatch(/^WW\d{2}/)
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

  it('draws the expanded chart outside the scrolling root, inside the frame', () => {
    stubSize()
    view = draw()
    expandPanel(view.container, 'NCR Pass Rate Trend')
    const open = dialog(view.container, 'NCR Pass Rate Trend')
    expect(open?.closest('.qaqc-root')).toBeNull()
    expect(open?.parentElement?.classList.contains('qaqc-frame')).toBe(true)
    expect(view.container.querySelector('.qaqc-root')?.hasAttribute('inert')).toBe(true)
  })

  it('marks the expanded chart compact on narrow tiles', () => {
    stubSize()
    view = draw({ viewport: { width: 800, height: 900 } })
    expandPanel(view.container, 'NCR Pass Rate Trend')
    expect(dialog(view.container, 'NCR Pass Rate Trend')?.classList.contains('is-compact')).toBe(true)
  })

  it('does not mark the expanded chart compact on wide tiles', () => {
    stubSize()
    view = draw()
    expandPanel(view.container, 'NCR Pass Rate Trend')
    expect(dialog(view.container, 'NCR Pass Rate Trend')?.classList.contains('is-compact')).toBe(false)
  })

  it('animates from the panel box to the frame box, both relative to the frame', () => {
    const keyframes: Keyframe[][] = []
    const animate = vi.fn((frames: Keyframe[]) => {
      keyframes.push(frames)
      return { finished: new Promise<void>(() => undefined), cancel: (): void => undefined, playState: 'running' }
    })
    Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true, writable: true })
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1280)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(720)
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element): DOMRect {
      const box = this.classList.contains('qaqc-frame')
        ? { top: 50, left: 100, width: 1280, height: 720 }
        : this.matches('section.qaqc-panel')
          ? { top: 300, left: 400, width: 380, height: 260 }
          : { top: 0, left: 0, width: 800, height: 400 }
      return { ...box, x: box.left, y: box.top, right: box.left + box.width, bottom: box.top + box.height, toJSON: () => ({}) }
    })
    try {
      view = render(
        <InspectionDashboard
          title="Electrical Inspections"
          icon={Zap}
          index={INDEX}
          filterSource={FILTER_SOURCE}
          theme={THEME}
          interactive
          animate
          describeCharts
          loading={false}
          footnotes={[]}
          viewport={{ width: 1280, height: 720 }}
          onHover={vi.fn()}
        />,
      )
      expandPanel(view.container, 'Inspections by Building')
      expect(keyframes[0]).toEqual([
        { top: '250px', left: '300px', width: '380px', height: '260px' },
        { top: '0px', left: '0px', width: '1280px', height: '720px' },
      ])
    } finally {
      view?.unmount()
      view = null
      Reflect.deleteProperty(HTMLElement.prototype, 'animate')
    }
  })

  it('clears the Power BI tooltip when the expanded chart closes', () => {
    stubSize()
    const onHover = vi.fn()
    view = draw({ onHover })
    expandPanel(view.container, 'Inspections by Building')
    const open = dialog(view.container, 'Inspections by Building')
    act(() => {
      open?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(onHover).toHaveBeenLastCalledWith(null)
  })

  it('returns focus to the panel when its expand button is gone', () => {
    stubSize()
    view = draw()
    expandPanel(view.container, 'Inspections by Building')
    view.rerender(dashboardElement(INDEX, { width: 1280, height: 720 }, false))
    const open = dialog(view.container, 'Inspections by Building')
    act(() => {
      open?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(document.activeElement).toBe(view.container.querySelector('section[aria-label="Inspections by Building"]'))
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

describe('InspectionDashboard filters', () => {
  const PLACEHOLDER_ROWS = withPlaceholderColumns(ELECTRICAL_ROWS)

  function drawFiltered(
    rows: InspectionRows = PLACEHOLDER_ROWS,
    optional: InspectionDashboardProps['filterSource']['optional'] = PLACEHOLDER_OPTIONAL,
    overrides: Partial<InspectionDashboardProps> = {},
  ): HTMLElement {
    const index = buildInspectionIndex(rows, { workWeek: 0, phase: 1, issue: 2, building: 3 }, TODAY)
    view = draw({ index, filterSource: filterSourceFor(rows, TODAY, optional), footnotes: buildFootnotes(index, false), ...overrides })
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

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the Filter button with only the bound fields', () => {
    const container = drawFiltered(ELECTRICAL_ROWS, UNBOUND_OPTIONAL)
    expect(filterButton(container).textContent).toBe('Filter')
    openMenu(container)
    expect(sectionTitles(container)).toEqual(['Building'])
    expect(container.querySelector('.qaqc-filter-date')).not.toBeNull()
  })

  it('lists the bound fields in the menu order, with Building between them', () => {
    const container = drawFiltered()
    openMenu(container)
    expect(sectionTitles(container)).toEqual(['General Contractor', 'Trade Supplier', 'Building', 'Discipline', 'Inspection Category', 'Status'])
  })

  it('lists a blank Building last as Unspecified, and matches the chart\'s count', () => {
    const container = drawFiltered(ELECTRICAL_ROWS, UNBOUND_OPTIONAL)
    openMenu(container)
    const labels = checkboxLabels(container)
    expect(labels[labels.length - 1]).toBe('Unspecified')
    expect(labels).not.toContain('Not recorded')
    click(checkbox(container, 'Unspecified'))
    const blank = ELECTRICAL_ROWS.filter((row) => row[3] === null)
    expect(showing(container)).toBe(`Showing ${blank.length} of ${ELECTRICAL_ROWS.length} rows`)
  })

  it('a field filter recalculates cards and charts', () => {
    stubChartSize()
    const container = drawFiltered(ELECTRICAL_ROWS, UNBOUND_OPTIONAL)
    openMenu(container)
    click(checkbox(container, 'BK1'))

    const rows = ELECTRICAL_ROWS.filter((row) => row[3] === 'BK1')
    const index = buildInspectionIndex(rows, { workWeek: 0, phase: 1, issue: 2, building: 3 }, TODAY)
    const model = buildInspectionModel(index, defaultViewState(index))
    expect(model.toDate.finals).toBeLessThan(238)
    expect(cardValue(container, 'Finals to Date')).toBe(String(model.toDate.finals))
    expect(cardValue(container, 'SORs to Date')).toBe(String(model.toDate.sors))
    expect(chipTexts(container)).toEqual(['Building: BK1'])

    expandPanel(container, 'Inspections by Building')
    expect(dialog(container, 'Inspections by Building')?.querySelectorAll('tbody tr')).toHaveLength(1)
  })

  it('shows the visual\'s own notes and the base cards while no field is active', () => {
    const index = buildInspectionIndex(ELECTRICAL_ROWS, { workWeek: 0, phase: 1, issue: 2, building: 3 }, TODAY)
    const footnotes = ['from the visual']
    const container = drawFiltered(ELECTRICAL_ROWS, UNBOUND_OPTIONAL, { index, footnotes })
    expect(container.querySelector('.qaqc-footnotes')?.textContent).toContain('from the visual')
    expect(cardValue(container, 'Finals to Date')).toBe('238')
    expect(container.querySelector('.qaqc-filter-chips')).toBeNull()
  })

  it('In range retitles the group, with "WW.. to WW.." and "Finals in Range"', () => {
    const container = drawFiltered(ELECTRICAL_ROWS, UNBOUND_OPTIONAL)
    openMenu(container)
    setRange(container, 202610, 202630)
    expect(groupShading(container, 'In range')).toEqual(['is-toDate'])
    expect(groupSubtitle(container)).toBe("WW10'2026 to WW30'2026")
    expect(cardValue(container, 'Finals in Range')).toBe('117')
    expect(cardValue(container, 'SORs in Range')).toBe('12')
    expect(cardValue(container, 'NCR Pass Rate')).toBe('98.3%')
    expect(cardDetail(container, 'NCR Pass Rate')).toBe('115 / 117 Finals')
    expect(cardValue(container, 'Finals to Date')).toBeNull()
    expect(chipTexts(container)).toEqual(["Date range: WW10'2026 to WW30'2026"])
  })

  it('clamps the selected week into the range, and This WW cards follow it', () => {
    const container = drawFiltered(ELECTRICAL_ROWS, UNBOUND_OPTIONAL)
    openMenu(container)
    setRange(container, 202610, 202630)
    expect(weekTitle(container)).toBe("WW30'2026")
    expect(cardValue(container, 'Final Inspections')).toBe('7')
    expect(cardDetail(container, 'Finals in Range')).toBe('+7 this WW')
  })

  it('the 30 WW | All toggle is disabled during a range', () => {
    const container = drawFiltered(ELECTRICAL_ROWS, UNBOUND_OPTIONAL)
    const toggles = (): HTMLButtonElement[] => [...container.querySelectorAll<HTMLButtonElement>('.qaqc-segmented button')]
    expect(toggles().every((button) => !button.disabled)).toBe(true)
    openMenu(container)
    click(buttonNamed(container, 'Last 4 WW'))
    expect(toggles().every((button) => button.disabled)).toBe(true)
    expect(toggles().map((button) => button.getAttribute('aria-pressed'))).toEqual(['false', 'false'])
    click(buttonNamed(container, 'Last 4 WW'))
    expect(toggles().every((button) => !button.disabled)).toBe(true)
    expect(toggles().map((button) => button.getAttribute('aria-pressed'))).toEqual(['true', 'false'])
  })

  it('the week picker lists only the range\'s weeks', () => {
    const container = drawFiltered(ELECTRICAL_ROWS, UNBOUND_OPTIONAL)
    expect(weekPicker(container).options).toHaveLength(44)
    openMenu(container)
    setRange(container, 202610, 202630)
    const options = [...weekPicker(container).options].map((option) => option.value)
    expect(options).toHaveLength(21)
    expect(options[0]).toBe('202630')
    expect(options[20]).toBe('202610')
  })

  it('no matching rows shows the empty state with Clear filters', () => {
    const rows: InspectionRows = [
      ["WW40'2026", 'Final', 'No Issue Found', 'F63.1', 'Greyfox'],
      ["WW41'2026", 'Final', 'No Issue Found', 'F63.2', 'Bayside'],
    ]
    const container = drawFiltered(rows, { ...UNBOUND_OPTIONAL, generalContractor: 4 })
    openMenu(container)
    click(checkbox(container, 'Greyfox'))
    toggleSection(container, 'Building')
    click(checkbox(container, 'F63.2'))

    expect(container.querySelector('.qaqc-filter-empty h3')?.textContent).toBe('No rows match these filters')
    expect(container.querySelector('.qaqc-filter-empty')?.getAttribute('role')).toBe('status')
    expect(container.querySelector('.qaqc-kpi-row')).toBeNull()
    expect(container.querySelector('.qaqc-charts')).toBeNull()
    expect(filterButton(container)).not.toBeNull()
    expect(container.querySelector('.qaqc-filter-chips')).not.toBeNull()

    const clear = buttonNamed(container, 'Clear filters')
    clear.focus()
    click(clear)
    expect(container.querySelector('.qaqc-filter-empty')).toBeNull()
    expect(cardValue(container, 'Finals to Date')).toBe('2')
    expect(document.activeElement).toBe(filterButton(container))
  })

  it('says the date range is part of it when a range holds no rows', () => {
    const rows: InspectionRows = [["WW30'2026", 'Final', 'No Issue Found', 'A'], ["WW40'2026", 'Final', 'No Issue Found', 'A']]
    const container = drawFiltered(rows, UNBOUND_OPTIONAL)
    openMenu(container)
    setRange(container, 202632, 202635)
    expect(container.querySelector('.qaqc-filter-empty p')?.textContent).toContain('no Finals or SORs in this date range')
    expect(container.querySelector('.qaqc-kpi-row')).toBeNull()
  })

  it('shows no empty state for an empty report with no filters', () => {
    const container = drawFiltered([], UNBOUND_OPTIONAL)
    expect(container.querySelector('.qaqc-filter-empty')).toBeNull()
    expect(cardValue(container, 'Finals to Date')).toBe('0')
  })

  it('disables Clear filters when interactions are not allowed', () => {
    const rows: InspectionRows = [["WW40'2026", 'Final', 'No Issue Found', 'A'], ["WW30'2026", 'SOR', '', 'B']]
    const index = buildInspectionIndex(rows, { workWeek: 0, phase: 1, issue: 2, building: 3 }, TODAY)
    const container = drawFiltered(rows, UNBOUND_OPTIONAL, { index })
    openMenu(container)
    setRange(container, 202632, 202635)
    view?.rerender(
      <InspectionDashboard
        title="Electrical Inspections"
        icon={Zap}
        index={index}
        filterSource={filterSourceFor(rows, TODAY)}
        theme={THEME}
        interactive={false}
        animate={false}
        describeCharts
        loading={false}
        footnotes={[]}
        viewport={{ width: 1280, height: 720 }}
        onHover={vi.fn()}
      />,
    )
    expect(buttonNamed(container, 'Clear filters').disabled).toBe(true)
    expect(filterButton(container).disabled).toBe(true)
  })

  it('says a filter\'s rows are outside the recent window instead of drawing an empty chart', () => {
    const rows: InspectionRows = [["WW01'2026", 'Final', 'No Issue Found', 'Old'], ["WW42'2026", 'Final', 'No Issue Found', 'New']]
    const container = drawFiltered(rows, UNBOUND_OPTIONAL)
    openMenu(container)
    click(checkbox(container, 'Old'))
    const trend = container.querySelector('.qaqc-panel-main')
    expect(trend?.textContent).toContain('outside the last 30 WW')
    expect(cardValue(container, 'Finals to Date')).toBe('1')
    clickRange(container, 'All')
    expect(container.querySelector('.qaqc-panel-main')?.textContent).not.toContain('outside the last 30 WW')
  })

  it('the existing selection and From/To stay valid', () => {
    const rows: InspectionRows = [
      ["WW10'2026", 'Final', 'No Issue Found', 'Early'],
      ["WW38'2026", 'Final', 'No Issue Found', 'Late'],
      ["WW42'2026", 'Final', 'No Issue Found', 'Early'],
    ]
    const container = drawFiltered(rows, UNBOUND_OPTIONAL)
    expect(weekPicker(container).options).toHaveLength(33)
    pickWeekInDropdown(container, '202612')
    openMenu(container)
    click(checkbox(container, 'Late'))

    // The filter's first match is WW38, and the picked WW12 still exists on the axis.
    expect(weekPicker(container).options).toHaveLength(33)
    expect(weekTitle(container)).toBe("WW12'2026")
    expect(cardValue(container, 'Final Inspections')).toBe('0')
    const [from, to] = container.querySelectorAll<HTMLSelectElement>('.qaqc-filter-date select')
    expect(from.options).toHaveLength(33)
    expect(to.options).toHaveLength(33)

    click(checkbox(container, 'Late'))
    expect(weekTitle(container)).toBe("WW12'2026")
  })

  it('a filter whose first match is WW20 still shows WW10 to WW30 in a WW10–WW30 range', () => {
    stubChartSize()
    const rows: InspectionRows = [
      ["WW05'2026", 'Final', 'No Issue Found', 'Early'],
      ["WW20'2026", 'Final', 'NCR', 'Late'],
      ["WW25'2026", 'Final', 'No Issue Found', 'Late'],
      ["WW42'2026", 'Final', 'No Issue Found', 'Early'],
    ]
    const container = drawFiltered(rows, UNBOUND_OPTIONAL)
    openMenu(container)
    click(checkbox(container, 'Late'))
    setRange(container, 202610, 202630)

    const weeks = mainHitWeeks(container)
    expect(weeks).toHaveLength(21)
    expect(weeks[0]).toBe('202610')
    expect(weeks[20]).toBe('202630')
    expect(weekPicker(container).options).toHaveLength(21)
    expect(groupSubtitle(container)).toBe("WW10'2026 to WW30'2026")
    expect(cardValue(container, 'Finals in Range')).toBe('2')
    expect(cardValue(container, 'NCR Pass Rate')).toBe('50.0%')

    // A week before the filter's first match can be selected like any other.
    clickHit(container, '202612')
    expect(weekTitle(container)).toBe("WW12'2026")
  })

  it('empties the dashboard, keeping the range\'s weeks in the picker, when the range holds none of the filter\'s rows', () => {
    const rows: InspectionRows = [
      ["WW10'2026", 'Final', 'No Issue Found', 'Early'],
      ["WW38'2026", 'Final', 'NCR', 'Late'],
      ["WW42'2026", 'Final', 'No Issue Found', 'Early'],
    ]
    const container = drawFiltered(rows, UNBOUND_OPTIONAL)
    openMenu(container)
    click(checkbox(container, 'Late'))
    setRange(container, 202630, 202635)
    expect(container.querySelector('.qaqc-filter-empty')).not.toBeNull()
    const options = [...weekPicker(container).options].map((option) => option.value)
    expect(options).toEqual(['202635', '202634', '202633', '202632', '202631', '202630'])
    expect(weekPicker(container).value).toBe('202635')
  })

  it('keeps a bar-selected week in view after the date range is removed', () => {
    stubChartSize()
    const container = drawFiltered(ELECTRICAL_ROWS, UNBOUND_OPTIONAL)
    openMenu(container)
    // WW08 is outside the 30 WW window that ends on the current week.
    setRange(container, 202605, 202612)
    clickHit(container, '202608')
    click(buttonNamed(container, 'Clear all'))
    expect(weekTitle(container)).toBe("WW08'2026")
    expect(mainHitWeeks(container)).toContain('202608')
  })

  it('does not point to All when All is already showing', () => {
    const rows: InspectionRows = [
      ["WW01'2026", 'Final', 'No Issue Found', 'Early'],
      ["WW20'2026", 'Final', 'No Issue Found', 'Late'],
      ["WW42'2026", 'Final', 'No Issue Found', 'Early'],
    ]
    const container = drawFiltered(rows, UNBOUND_OPTIONAL)
    clickRange(container, 'All')
    pickWeekInDropdown(container, '202605')
    openMenu(container)
    click(checkbox(container, 'Late'))
    expect(container.querySelector('.qaqc-panel-main')?.textContent).not.toContain('switch to All')
  })

  it('keeps an N/A building its own choice, as it is on the chart', () => {
    const rows: InspectionRows = [
      ["WW40'2026", 'Final', 'No Issue Found', 'N/A'],
      ["WW40'2026", 'Final', 'No Issue Found', 'N/A'],
      ["WW40'2026", 'Final', 'No Issue Found', null],
      ["WW40'2026", 'Final', 'No Issue Found', 'A'],
    ]
    const container = drawFiltered(rows, UNBOUND_OPTIONAL)
    openMenu(container)
    expect(checkboxLabels(container)).toEqual(['N/A', 'A', 'Unspecified'])
    click(checkbox(container, 'N/A'))
    expect(showing(container)).toBe('Showing 2 of 4 rows')
    expect(cardValue(container, 'Finals to Date')).toBe('2')
    click(checkbox(container, 'N/A'))
    click(checkbox(container, 'Unspecified'))
    expect(showing(container)).toBe('Showing 1 of 4 rows')
  })

  it('groups Building spellings the way the chart does: case and interior spaces, with blank as Unspecified', () => {
    const rows: InspectionRows = [
      ["WW40'2026", 'Final', 'No Issue Found', 'Pump  House'],
      ["WW40'2026", 'Final', 'No Issue Found', 'pump house'],
      ["WW40'2026", 'Final', 'No Issue Found', 'Pump House'],
      ["WW40'2026", 'Final', 'No Issue Found', 'UNSPECIFIED'],
      ["WW40'2026", 'Final', 'No Issue Found', '  '],
    ]
    const container = drawFiltered(rows, UNBOUND_OPTIONAL)
    openMenu(container)
    expect(checkboxLabels(container)).toHaveLength(2)
    expect(checkboxLabels(container)[1]).toBe('Unspecified')
    const counts = [...container.querySelectorAll('.qaqc-filter-option-count')].map((node) => node.textContent)
    expect(counts).toEqual(['3', '2'])
    click(checkbox(container, 'Unspecified'))
    expect(cardValue(container, 'Finals to Date')).toBe('2')
  })

  it('skipped and future footnotes describe the filtered rows, and Showing X of Y counts every bound row consistently', () => {
    const rows: InspectionRows = [
      ["WW40'2026", 'Final', 'No Issue Found', 'A'],
      ['not a week', 'Final', 'No Issue Found', 'A'],
      ["WW50'2026", 'Final', 'No Issue Found', 'A'],
      ["WW41'2026", 'Other phase', '', 'A'],
      ["WW41'2026", 'Final', 'No Issue Found', 'B'],
      ['also not a week', 'Final', 'No Issue Found', 'B'],
      ['still not a week', 'SOR', '', 'B'],
    ]
    const container = drawFiltered(rows, UNBOUND_OPTIONAL)
    const notes = (): string => container.querySelector('.qaqc-footnotes')?.textContent ?? ''
    expect(notes()).toContain('3 rows skipped: unreadable work week')
    expect(notes()).toContain("1 row dated after WW42'2026 not counted")

    openMenu(container)
    expect(showing(container)).toBe('Showing 7 of 7 rows')

    click(checkbox(container, 'B'))
    expect(showing(container)).toBe('Showing 3 of 7 rows')
    expect(notes()).toContain('2 rows skipped: unreadable work week')
    expect(notes()).not.toContain('dated after')

    click(checkbox(container, 'B'))
    click(checkbox(container, 'A'))
    expect(showing(container)).toBe('Showing 4 of 7 rows')
    expect(notes()).toContain('1 row skipped: unreadable work week')
    expect(notes()).toContain("1 row dated after WW42'2026 not counted")

    // A range keeps only rows with a readable week inside it; the notes still describe the filtered rows.
    setRange(container, 202641, 202642)
    expect(showing(container)).toBe('Showing 1 of 7 rows')
    expect(notes()).toContain('1 row skipped: unreadable work week')
  })

  it('keeps the row-limit note while a filter restates the other notes', () => {
    const rows: InspectionRows = [["WW40'2026", 'Final', 'No Issue Found', 'A'], ['not a week', 'Final', 'No Issue Found', 'B']]
    const index = buildInspectionIndex(rows, { workWeek: 0, phase: 1, issue: 2, building: 3 }, TODAY)
    const container = drawFiltered(rows, UNBOUND_OPTIONAL, { index, footnotes: buildFootnotes(index, true) })
    openMenu(container)
    click(checkbox(container, 'A'))
    const notes = container.querySelector('.qaqc-footnotes')?.textContent ?? ''
    expect(notes).toContain('Showing the first 2 rows (Power BI data limit)')
    expect(notes).not.toContain('skipped')
  })

  it('counts a Showing total of rows in the range with no field filter', () => {
    const rows: InspectionRows = [
      ["WW40'2026", 'Final', 'No Issue Found', 'A'],
      ["WW41'2026", 'Other phase', '', 'A'],
      ['not a week', 'Final', 'No Issue Found', 'A'],
      ["WW30'2026", 'SOR', '', 'B'],
    ]
    const container = drawFiltered(rows, UNBOUND_OPTIONAL)
    openMenu(container)
    setRange(container, 202640, 202641)
    expect(showing(container)).toBe('Showing 2 of 4 rows')
  })

  it('disables the chips with the rest of the controls when interactions are not allowed', () => {
    const index = buildInspectionIndex(ELECTRICAL_ROWS, { workWeek: 0, phase: 1, issue: 2, building: 3 }, TODAY)
    const container = drawFiltered(ELECTRICAL_ROWS, UNBOUND_OPTIONAL, { index })
    openMenu(container)
    click(checkbox(container, 'BK1'))
    view?.rerender(dashboardElement(index, { width: 1280, height: 720 }, false))
    const buttons = [...container.querySelectorAll<HTMLButtonElement>('.qaqc-filter-chips button')]
    expect(buttons.length).toBeGreaterThan(1)
    expect(buttons.every((button) => button.disabled)).toBe(true)
  })
})
