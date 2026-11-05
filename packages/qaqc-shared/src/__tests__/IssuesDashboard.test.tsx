import { CircleAlert } from 'lucide-react'
import { act, type ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { IssuesDashboard, type IssuesDashboardProps } from '../components/IssuesDashboard'
import { inspectionColumnsOf, splitCombinedRows } from '../combined'
import { buildIssueFootnotes } from '../footnotes'
import { buildInspectionIndex } from '../inspections'
import { buildIssueIndex, issueRowWeekKey } from '../issues'
import { buildOverviewIndex, buildOverviewModel } from '../overview'
import { resolveTheme } from '../theme'
import type { CombinedColumns, IssueColumns, IssueIndex } from '../types'
import { badge, buttonNamed, checkbox, chipTexts, choose, filterButton, openMenu, pick, pressEscape, showing, toggleSection } from './filterHarness'
import { COMBINED_COLUMNS } from './fixtures/combinedRows'
import { ENRICHED_COMBINED_ROWS } from './fixtures/enrichedCombinedRows'
import { ENRICHED_ISSUE_ROWS } from './fixtures/enrichedIssueRows'
import { ISSUE_ROWS } from './fixtures/issueRows'
import { ENRICHED_COLUMNS } from './issueFilterFixture'
import { render, type Rendered } from './render'
import { ruleBody } from './stylesheet'

const COLUMNS: IssueColumns = {
  id: 0,
  title: 1,
  status: 2,
  type: 3,
  contractor: 4,
  createdOn: 5,
  updatedOn: 6,
  dueDate: 7,
  createdBy: 8,
  rootCause: 9,
  rootCauseCategory: 10,
}
const TODAY = new Date(2026, 9, 15) // WW42'2026
const INDEX = buildIssueIndex(ISSUE_ROWS, COLUMNS, TODAY)
const THEME = resolveTheme({ preset: 'qaqc', backgroundColor: '', backgroundOpacity: 100, cardOpacity: 100, highContrast: null })
const TREND_TITLE = 'Issues by Work Week'
const OPEN_AGING_TITLE = 'Open Issue Aging'
const OVERALL_AGING_TITLE = 'Overall Issue Aging'
const DETAIL_TITLE = 'QCx Issues Detail'

let view: Rendered | null = null

afterEach(() => {
  view?.unmount()
  view = null
  vi.restoreAllMocks()
})

function dashboardElement(overrides: Partial<IssuesDashboardProps> = {}): ReactElement {
  return (
    <IssuesDashboard
      title="QCx Issues"
      icon={CircleAlert}
      index={INDEX}
      filterSource={{ rows: ISSUE_ROWS, columns: COLUMNS, today: TODAY }}
      theme={THEME}
      interactive
      animate={false}
      describeCharts
      loading={false}
      footnotes={[]}
      viewport={{ width: 1340, height: 790 }}
      onHover={vi.fn()}
      {...overrides}
    />
  )
}

function draw(overrides: Partial<IssuesDashboardProps> = {}): Rendered {
  return render(dashboardElement(overrides))
}

function indexOf(rows: ReadonlyArray<ReadonlyArray<string | null>>): IssueIndex {
  return buildIssueIndex(rows, COLUMNS, TODAY)
}

/** An index that counts how often the issue list is walked, which only building the Issue Detail does. */
function countingIndex(): { index: IssueIndex; walks: () => number } {
  const index = indexOf(ISSUE_ROWS)
  const issues = index.issues
  let reads = 0
  Object.defineProperty(index, 'issues', {
    get: () => {
      reads += 1
      return issues
    },
  })
  return { index, walks: () => reads }
}

// Matches labels in code: jsdom's selector engine mishandles "+" and "%" inside attribute values.
function card(container: HTMLElement, label: string): HTMLElement | null {
  return [...container.querySelectorAll<HTMLElement>('.qaqc-root article.qaqc-kpi')]
    .find((node) => node.getAttribute('aria-label')?.startsWith(`${label}:`)) ?? null
}

function cardValue(container: HTMLElement, label: string): string | null {
  return card(container, label)?.querySelector('.qaqc-kpi-value')?.textContent ?? null
}

function cardDetail(container: HTMLElement, label: string): string | null {
  return card(container, label)?.querySelector('.qaqc-kpi-detail')?.textContent ?? null
}

function cardTone(container: HTMLElement, label: string): string | null {
  const detail = card(container, label)?.querySelector('.qaqc-kpi-detail')
  return [...(detail?.classList ?? [])].find((name) => name.startsWith('is-')) ?? null
}

function weekSubtitle(container: HTMLElement): string | null {
  return container.querySelector('.qaqc-root .qaqc-kpi-group.is-week em')?.textContent ?? null
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
  click(button)
}

function click(target: Element): void {
  act(() => {
    target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

function pressKeys(target: Element, keys: string[]): void {
  for (const key of keys) {
    act(() => {
      target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
    })
  }
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

function expandButton(container: HTMLElement, title: string): HTMLButtonElement | null {
  return [...container.querySelectorAll<HTMLButtonElement>('.qaqc-expand-button')]
    .find((node) => node.getAttribute('aria-label') === `Expand ${title}`) ?? null
}

function dialog(container: HTMLElement, title: string): HTMLElement | null {
  return [...container.querySelectorAll<HTMLElement>('[role="dialog"]')].find((node) => node.getAttribute('aria-label') === title) ?? null
}

function expandPanel(container: HTMLElement, title: string): HTMLElement {
  const button = expandButton(container, title)
  if (!button) throw new Error(`expand button for ${title} missing`)
  click(button)
  const open = dialog(container, title)
  if (!open) throw new Error(`dialog for ${title} missing`)
  return open
}

function detailButton(container: HTMLElement): HTMLButtonElement | null {
  return container.querySelector<HTMLButtonElement>('.qaqc-header button[aria-label="Open Issue Detail"]')
}

function openDetail(container: HTMLElement): HTMLElement {
  const button = detailButton(container)
  if (!button) throw new Error('Issue Detail button missing')
  click(button)
  const open = dialog(container, DETAIL_TITLE)
  if (!open) throw new Error('Issue Detail dialog missing')
  return open
}

/** The visible ID of each rendered detail row (screen-reader-only text left out). */
function detailRowIds(root: HTMLElement): string[] {
  return [...root.querySelectorAll('tbody tr[aria-rowindex]')].map((row) => row.querySelector('th')?.firstChild?.textContent ?? '')
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

describe('IssuesDashboard card shading', () => {
  it('draws This WW on the lighter card and the project to date on the darker one', () => {
    view = draw()
    expect(groupShading(view.container, 'This WW')).toEqual(['is-week'])
    expect(groupShading(view.container, 'Project to date')).toEqual(['is-toDate'])
  })
})

describe('IssuesDashboard cards', () => {
  it('opens on the current week with the two this-week cards', () => {
    view = draw()
    const { container } = view
    expect(container.querySelector('.qaqc-kpi-group.is-week span')?.textContent).toBe('This WW')
    expect(weekSubtitle(container)).toBe("WW42'2026")
    expect(cardValue(container, 'Issues Opened')).toBe('0')
    expect(cardDetail(container, 'Issues Opened')).toBe("No change vs WW41'2026")
    expect(cardValue(container, 'Issues Closed')).toBe('0')
    expect(cardDetail(container, 'Issues Closed')).toBe("No change vs WW41'2026")
  })

  it('opens with the four project-to-date cards through the current week', () => {
    view = draw()
    const { container } = view
    expect(container.querySelector('.qaqc-kpi-group.is-toDate em')?.textContent).toBe("Through WW42'2026")
    expect(cardValue(container, 'Total Opened')).toBe('177')
    expect(cardDetail(container, 'Total Opened')).toBe('+0 this WW')
    expect(cardValue(container, 'Total Closed')).toBe('126')
    expect(cardDetail(container, 'Total Closed')).toBe('+0 this WW')
    expect(cardValue(container, 'Remaining Open')).toBe('51')
    expect(cardDetail(container, 'Remaining Open')).toBe('+0 this WW')
    expect(cardValue(container, 'Closure Rate')).toBe('71.2%')
    expect(cardDetail(container, 'Closure Rate')).toBe("No change vs WW41'2026")
  })

  // WW01'2026: 3 opened (2 the week before), 1 closed (1 the week before), so Remaining Open rises and the rate falls.
  it('shows the WW01 activity when WW01 is picked', () => {
    view = draw()
    pickWeekInDropdown(view.container, '202601')
    const { container } = view
    expect(weekSubtitle(container)).toBe("WW01'2026")
    expect(cardValue(container, 'Issues Opened')).toBe('3')
    expect(cardDetail(container, 'Issues Opened')).toBe("+1 vs WW52'2025")
    expect(cardValue(container, 'Issues Closed')).toBe('1')
    expect(cardDetail(container, 'Issues Closed')).toBe("No change vs WW52'2025")
  })

  it('shows the project-to-date change in the picked week', () => {
    view = draw()
    pickWeekInDropdown(view.container, '202601')
    const { container } = view
    expect(cardDetail(container, 'Total Opened')).toBe('+3 this WW')
    expect(cardDetail(container, 'Total Closed')).toBe('+1 this WW')
    expect(cardDetail(container, 'Remaining Open')).toBe('+2 this WW')
    expect(cardDetail(container, 'Closure Rate')).toBe("−0.7 pts vs WW52'2025")
  })

  it('colors each card with the model tone', () => {
    view = draw()
    pickWeekInDropdown(view.container, '202601')
    const { container } = view
    expect(cardTone(container, 'Issues Opened')).toBe('is-warn')
    expect(cardTone(container, 'Issues Closed')).toBe('is-good')
    expect(cardTone(container, 'Total Opened')).toBe('is-bad')
    expect(cardTone(container, 'Total Closed')).toBe('is-good')
    expect(cardTone(container, 'Remaining Open')).toBe('is-bad')
    expect(cardTone(container, 'Closure Rate')).toBe('is-bad')
  })

  it('keeps the closed cards neutral in a week with nothing closed', () => {
    view = draw()
    expect(cardTone(view.container, 'Issues Closed')).toBe('is-neutral')
    expect(cardTone(view.container, 'Total Closed')).toBe('is-neutral')
  })

  it('shows a falling Remaining Open as a good minus', () => {
    view = draw()
    pickWeekInDropdown(view.container, '202628')
    expect(cardDetail(view.container, 'Remaining Open')).toBe('−1 this WW')
    expect(cardTone(view.container, 'Remaining Open')).toBe('is-good')
  })

  it('gives the project-to-date counts no trend arrow, like the other dashboards\' totals', () => {
    view = draw()
    pickWeekInDropdown(view.container, '202628')
    for (const label of ['Total Opened', 'Total Closed', 'Remaining Open']) {
      expect(card(view.container, label)?.querySelector('.qaqc-kpi-detail svg')).toBeNull()
    }
  })

  it('shows n/a for the closure rate when nothing has been opened', () => {
    view = draw({ index: indexOf([]) })
    expect(cardValue(view.container, 'Closure Rate')).toBe('n/a')
    expect(cardDetail(view.container, 'Closure Rate')).toBe('No issues opened yet')
  })

  it('offers every week from the first created week, newest first', () => {
    view = draw()
    const select = view.container.querySelector('select')
    expect(select?.options).toHaveLength(101)
    expect(select?.options[0].textContent).toBe("WW42'2026")
    expect(select?.options[100].textContent).toBe("WW46'2024")
  })
})

describe('IssuesDashboard layout', () => {
  it('shows the title and icon it is given', () => {
    view = draw()
    expect(view.container.querySelector('h2')?.textContent).toBe('QCx Issues')
    expect(view.container.querySelector('.qaqc-title-icon svg.lucide-circle-alert')).not.toBeNull()
  })

  it('puts Issue Detail, Issues by Root Cause Pareto and Issue Aging before the range toggle and week picker', () => {
    view = draw()
    const controls = view.container.querySelector('.qaqc-controls')
    const order = [...(controls?.children ?? [])].map((node) => node.className)
    expect(order).toEqual(['qaqc-header-button', 'qaqc-header-button', 'qaqc-header-button', 'qaqc-filter-anchor', 'qaqc-segmented', 'qaqc-week-picker'])
    expect([...(controls?.querySelectorAll('.qaqc-header-button') ?? [])].map((node) => node.textContent)).toEqual([
      'Issue Detail',
      'Issues by Root Cause Pareto',
      'Issue Aging',
      'Filter',
    ])
  })

  it('toggles the chart range', () => {
    view = draw()
    clickRange(view.container, 'All')
    const all = [...view.container.querySelectorAll('.qaqc-segmented button')].find((button) => button.textContent === 'All')
    expect(all?.getAttribute('aria-pressed')).toBe('true')
  })

  it('shows the trend chart large and the two aging charts beside it', () => {
    view = draw()
    expect([...view.container.querySelectorAll('.qaqc-panel')].map((node) => node.getAttribute('aria-label')))
      .toEqual([TREND_TITLE, OPEN_AGING_TITLE, OVERALL_AGING_TITLE])
    expect(panel(view.container, TREND_TITLE)?.classList.contains('qaqc-panel-main')).toBe(true)
  })

  it('shows only the six cards on a short tile', () => {
    view = draw({ viewport: { width: 1340, height: 400 } })
    expect(view.container.querySelectorAll('.qaqc-panel')).toHaveLength(0)
    expect(view.container.querySelector('.qaqc-root.is-cards-only')).not.toBeNull()
    expect(view.container.querySelectorAll('article.qaqc-kpi')).toHaveLength(6)
  })

  it('uses the compact cards-only layout on a short, narrow tile', () => {
    view = draw({ viewport: { width: 800, height: 300 } })
    const root = view.container.querySelector('.qaqc-root')
    expect(root?.classList.contains('is-cards-only')).toBe(true)
    expect(root?.classList.contains('is-compact')).toBe(true)
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
    view = draw({ loading: true, footnotes: ['5 issues not created by LotusWorks are excluded'] })
    expect(view.container.querySelector('[role="progressbar"]')).not.toBeNull()
    expect(view.container.querySelector('.qaqc-footnotes')?.textContent).toContain('5 issues not created by LotusWorks')
  })

  it('labels the trend chart legend like the app', () => {
    view = draw()
    const items = [...(panel(view.container, TREND_TITLE)?.querySelectorAll('.qaqc-legend li') ?? [])]
    expect(items.map((item) => item.textContent)).toEqual(['Remaining Open', 'Opened', 'Closed'])
    const shapes = items.map((item) => [...(item.firstElementChild?.classList ?? [])].find((name) => name.startsWith('is-')))
    expect(shapes).toEqual(['is-line', 'is-bar', 'is-bar'])
  })

  it('says there are no issues when the data is empty', () => {
    view = draw({ index: indexOf([]) })
    for (const title of [TREND_TITLE, OPEN_AGING_TITLE, OVERALL_AGING_TITLE]) {
      expect(panel(view.container, title)?.querySelector('.qaqc-chart-empty')?.textContent).toBe('No issues match the current filters')
    }
  })

  it('says no issues are open when every issue is closed', () => {
    const closedOnly = ISSUE_ROWS.filter((row) => row[2] === 'Closed')
    view = draw({ index: indexOf(closedOnly) })
    expect(panel(view.container, OPEN_AGING_TITLE)?.querySelector('.qaqc-chart-empty')?.textContent).toBe('No open issues')
    expect(panel(view.container, OVERALL_AGING_TITLE)?.querySelector('.qaqc-chart-empty')).toBeNull()
  })
})

// The week, window and range rules are covered in useWeekWindow.test.tsx; these check the dashboard's wiring.
describe('IssuesDashboard week and window', () => {
  it('selects a week from a bar click without moving the window', () => {
    stubSize()
    view = draw()
    clickHit(view.container, '202631')
    expect(weekSubtitle(view.container)).toBe("WW31'2026")
    expect(cardValue(view.container, 'Issues Opened')).toBe('3')
    expect(lastHitWeek(view.container)).toBe('202642')
  })

  it('selects a week from the keyboard on the trend chart', () => {
    stubSize()
    view = draw()
    const chart = panel(view.container, TREND_TITLE)?.querySelector('svg.qaqc-chart')
    if (!chart) throw new Error('trend chart missing')
    pressKeys(chart, ['ArrowLeft', 'Enter'])
    expect(weekSubtitle(view.container)).toBe("WW41'2026")
  })
})

describe('IssuesDashboard expanded charts', () => {
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

  it('expands Issues by Work Week with a window summary', () => {
    stubSize()
    view = draw()
    const open = expandPanel(view.container, TREND_TITLE)
    const terms = [...open.querySelectorAll('.qaqc-summary dt')].map((node) => node.textContent)
    const values = [...open.querySelectorAll('.qaqc-summary dd')].map((node) => node.textContent)
    expect(terms).toEqual(['Opened', 'Closed', 'Change in remaining', 'Closure rate'])
    expect(values).toEqual(['37', '41', '−4', '71.2%'])
    expect(view.container.querySelector('.qaqc-root.is-expanded')).not.toBeNull()
  })

  it('labels more Remaining Open points in the expanded trend chart', () => {
    stubSize(1200, 400)
    view = draw()
    const gridLabels = panel(view.container, TREND_TITLE)?.querySelectorAll('.qaqc-remaining-label').length ?? 0
    const open = expandPanel(view.container, TREND_TITLE)
    expect(open.querySelectorAll('.qaqc-remaining-label').length).toBeGreaterThan(gridLabels)
  })

  it('expands Open Issue Aging into a table of every open issue', () => {
    stubSize()
    view = draw()
    const open = expandPanel(view.container, OPEN_AGING_TITLE)
    expect(open.querySelector('table.qaqc-open-issues-table')?.getAttribute('aria-rowcount')).toBe('52')
    expect(open.querySelector('.qaqc-legend')).toBeNull()
  })

  it('expands Overall Issue Aging into the strip and the closed and open split', () => {
    stubSize()
    view = draw()
    const open = expandPanel(view.container, OVERALL_AGING_TITLE)
    expect(open.querySelectorAll('.qaqc-aging-row')).toHaveLength(3)
    const rows = [...open.querySelectorAll('table.qaqc-table tbody tr')].map((row) => [...row.children].map((cell) => cell.textContent))
    expect(rows).toEqual([
      ['0-14 Days', '21', '21', '0'],
      ['14-28 Days', '14', '14', '0'],
      ['28+ Days', '142', '91', '51'],
    ])
  })

  it('collapses on Esc and returns focus to the expand button', () => {
    stubSize()
    view = draw()
    const open = expandPanel(view.container, OPEN_AGING_TITLE)
    act(() => {
      open.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(view.container.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(expandButton(view.container, OPEN_AGING_TITLE))
  })
})

describe('IssuesDashboard Issue Detail', () => {
  it('opens the Issue Detail page from the header', () => {
    stubSize()
    view = draw()
    const open = openDetail(view.container)
    expect(open.querySelector('h3')?.textContent).toBe(DETAIL_TITLE)
    expect(open.querySelector('.qaqc-issue-detail')).not.toBeNull()
    expect(view.container.querySelector('.qaqc-root')?.hasAttribute('inert')).toBe(true)
  })

  it('lists the WW32 reporting rows first, then the 49 discussion rows', () => {
    stubSize()
    view = draw()
    pickWeekInDropdown(view.container, '202632')
    const open = openDetail(view.container)
    expect(detailRowIds(open).slice(0, 4)).toEqual(['#1020', '#1018', '#1016', '#1011'])
    expect(open.querySelector('tbody tr[aria-rowindex="17"]')?.classList.contains('is-discussion')).toBe(false)
    expect(open.querySelector('tbody tr[aria-rowindex="18"]')?.classList.contains('is-discussion')).toBe(true)
    const legend = [...open.querySelectorAll('.qaqc-issue-detail-legend li')].map((item) => item.textContent)
    expect(legend).toEqual(['Reporting week16', 'Open for discussion49'])
  })

  it('builds the detail only while the page is open', () => {
    stubSize()
    const { index, walks } = countingIndex()
    view = draw({ index })
    pickWeekInDropdown(view.container, '202632')
    expect(walks()).toBe(0)
    openDetail(view.container)
    expect(walks()).toBeGreaterThan(0)
  })

  it('closes with the back button and returns focus to the Issue Detail button', () => {
    stubSize()
    view = draw()
    const open = openDetail(view.container)
    const back = open.querySelector('.qaqc-back-button')
    if (!back) throw new Error('back button missing')
    click(back)
    expect(dialog(view.container, DETAIL_TITLE)).toBeNull()
    expect(document.activeElement).toBe(detailButton(view.container))
  })

  it('closes on Esc and returns focus to the Issue Detail button', () => {
    stubSize()
    view = draw()
    const open = openDetail(view.container)
    act(() => {
      open.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(dialog(view.container, DETAIL_TITLE)).toBeNull()
    expect(document.activeElement).toBe(detailButton(view.container))
  })

  it('hides the Issue Detail button when interactions are not allowed', () => {
    view = draw({ interactive: false })
    expect(detailButton(view.container)).toBeNull()
  })

  it('opens the Issue Detail page on a short cards-only tile', () => {
    stubSize()
    view = draw({ viewport: { width: 760, height: 300 } })
    const open = openDetail(view.container)
    expect(open.querySelector('.qaqc-issue-detail-table')).not.toBeNull()
  })

  it('keeps several table rows in view on a short tile by scrolling the page instead of squeezing the table', () => {
    expect(ruleBody('.qaqc-issue-detail')).toContain('overflow-y: auto;')
    expect(ruleBody('.qaqc-issue-detail .qaqc-table-wrap.qaqc-issue-detail-wrap')).toMatch(/min-height: \d+px;/)
  })
})

const PARETO_ALL_TITLE = "Issues by Root Cause Pareto · WW46'2024 to WW42'2026"
const PARETO_RECENT_TITLE = "Issues by Root Cause Pareto · WW13'2026 to WW42'2026"

function paretoButton(container: HTMLElement): HTMLButtonElement | null {
  return container.querySelector<HTMLButtonElement>('.qaqc-header button[aria-label="Open the Issues by Root Cause Pareto page"]')
}

function openPareto(container: HTMLElement, title = PARETO_RECENT_TITLE): HTMLElement {
  const button = paretoButton(container)
  if (!button) throw new Error('Pareto button missing')
  click(button)
  const open = dialog(container, title)
  if (!open) throw new Error('Pareto dialog missing')
  return open
}

describe('IssuesDashboard Issues by Root Cause Pareto', () => {
  it('names the page buttons apart from every chart panel', () => {
    stubSize()
    view = draw()
    const names = [...view.container.querySelectorAll('[aria-label]')].map((node) => node.getAttribute('aria-label'))
    for (const name of ['Open the Issue Aging page', 'Open the Issues by Root Cause Pareto page', OPEN_AGING_TITLE]) {
      expect(names.filter((candidate) => candidate === name)).toHaveLength(1)
    }
  })

  it('shows the Pareto button with the decreasing column chart icon', () => {
    view = draw()
    const button = paretoButton(view.container)
    expect(button?.textContent).toBe('Issues by Root Cause Pareto')
    expect(button?.querySelector('svg.lucide-chart-column-decreasing') ?? null).not.toBeNull()
  })

  it('opens the Pareto page over the 30 WW window to the selected week', () => {
    stubSize()
    view = draw()
    const open = openPareto(view.container)
    expect(open.querySelector('h3')?.textContent).toBe(PARETO_RECENT_TITLE)
    expect(open.querySelector('.qaqc-pareto')).not.toBeNull()
    expect(view.container.querySelector('.qaqc-root')?.hasAttribute('inert')).toBe(true)
  })

  it('shows Installation 46 and the read-out over every week', () => {
    stubSize()
    view = draw()
    clickRange(view.container, 'All')
    const open = openPareto(view.container, PARETO_ALL_TITLE)
    const counts = [...open.querySelectorAll('.qaqc-pareto-value.qaqc-bar-value')].map((node) => node.textContent)
    expect(counts[0]).toBe('46')
    expect(open.querySelector('.qaqc-pareto-table h3')?.textContent).toBe('Installation')
    expect(open.querySelector('.qaqc-pareto-readout')?.textContent).toContain('Installation is 46 of 177 (26.0%).')
  })

  it("changes the dashboard's range from the page, and the title follows", () => {
    stubSize()
    view = draw()
    const open = openPareto(view.container)
    const all = [...open.querySelectorAll('.qaqc-segmented button')].find((button) => button.textContent === 'All')
    if (!all) throw new Error('All button missing')
    click(all)
    expect(dialog(view.container, PARETO_ALL_TITLE)).not.toBeNull()
  })

  it('builds the Pareto only while the page is open', () => {
    stubSize()
    const { index, walks } = countingIndex()
    view = draw({ index })
    expect(walks()).toBe(0)
    openPareto(view.container)
    expect(walks()).toBeGreaterThan(0)
  })

  it('closes with the back button and returns focus to the Pareto button', () => {
    stubSize()
    view = draw()
    const open = openPareto(view.container)
    const back = open.querySelector('.qaqc-back-button')
    if (!back) throw new Error('back button missing')
    click(back)
    expect(dialog(view.container, PARETO_RECENT_TITLE)).toBeNull()
    expect(document.activeElement).toBe(paretoButton(view.container))
  })

  it('closes on Esc and returns focus to the Pareto button', () => {
    stubSize()
    view = draw()
    const open = openPareto(view.container)
    act(() => {
      open.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(dialog(view.container, PARETO_RECENT_TITLE)).toBeNull()
    expect(document.activeElement).toBe(paretoButton(view.container))
  })

  it('hides the Pareto button when Root Cause is not bound', () => {
    view = draw({ index: buildIssueIndex(ISSUE_ROWS, { ...COLUMNS, rootCause: -1, rootCauseCategory: -1 }, TODAY) })
    expect(paretoButton(view.container)).toBeNull()
    expect(view.container.querySelector('.qaqc-header button[aria-label="Open Issue Detail"]')).not.toBeNull()
  })

  it('hides the Pareto button when interactions are not allowed', () => {
    view = draw({ interactive: false })
    expect(paretoButton(view.container)).toBeNull()
  })
})

describe('IssuesDashboard filters', () => {
  const FILTER_TODAY = new Date(2026, 10, 4) // WW45'2026, after the fixture's last update (19 Oct)
  const BASE = buildIssueIndex(ENRICHED_ISSUE_ROWS, ENRICHED_COLUMNS, FILTER_TODAY)
  const NOTES = buildIssueFootnotes(BASE, false)
  const UNBOUND_COMPANY: IssueColumns = { ...ENRICHED_COLUMNS, createdByCompany: -1 }

  function drawEnriched(columns: IssueColumns = ENRICHED_COLUMNS, overrides: Partial<IssuesDashboardProps> = {}): HTMLElement {
    stubSize()
    const index = buildIssueIndex(ENRICHED_ISSUE_ROWS, columns, FILTER_TODAY)
    view = draw({
      index,
      filterSource: { rows: ENRICHED_ISSUE_ROWS, columns, today: FILTER_TODAY },
      footnotes: buildIssueFootnotes(index, false),
      ...overrides,
    })
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

  function toDateValues(container: HTMLElement): Array<string | null> {
    return ['Total Opened', 'Total Closed', 'Remaining Open', 'Closure Rate'].map((label) => cardValue(container, label))
  }

  function groupTitle(container: HTMLElement): string | null {
    return container.querySelector('.qaqc-kpi-group.is-toDate span')?.textContent ?? null
  }

  function groupSubtitle(container: HTMLElement): string | null {
    return container.querySelector('.qaqc-kpi-group.is-toDate em')?.textContent ?? null
  }

  function notes(container: HTMLElement): string[] {
    return [...container.querySelectorAll('.qaqc-footnotes li, .qaqc-footnote')].map((node) => node.textContent ?? '')
  }

  function tickCompanies(container: HTMLElement, ...names: string[]): void {
    for (const name of names) click(checkbox(container, name))
  }

  function weekPickerKeys(container: HTMLElement): string[] {
    const select = pick(container, '.qaqc-week-picker select', HTMLSelectElement)
    return [...select.options].map((option) => option.value)
  }

  it('the default view is today\'s visual: no badge, no chips, only LotusWorks ticked', () => {
    const container = drawEnriched()
    expect(toDateValues(container)).toEqual(['231', '175', '56', '75.8%'])
    expect(badge(container)).toBeNull()
    expect(chipTexts(container)).toEqual([])
    openMenu(container)
    expect(checkbox(container, 'LotusWorks').checked).toBe(true)
    expect(checkbox(container, 'Greyfox').checked).toBe(false)
    expect(notes(container)).toEqual(['846 issues not created by LotusWorks are excluded'])
  })

  it('lists the bound fields in the menu order', () => {
    const container = drawEnriched({ ...ENRICHED_COLUMNS, discipline: ENRICHED_COLUMNS.type })
    openMenu(container)
    expect(sectionTitles(container)).toEqual(['Created By (Company)', 'Contractor', 'Status', 'Type', 'Discipline', 'Root Cause'])
  })

  it('Showing X of Y counts every issue row', () => {
    const container = drawEnriched()
    openMenu(container)
    expect(showing(container)).toBe('Showing 231 of 1,077 rows')
    tickCompanies(container, 'Greyfox', 'Bayside')
    expect(showing(container)).toBe('Showing 269 of 1,077 rows')
  })

  it('selecting companies recalculates the cards, with a chip and a badge', () => {
    const container = drawEnriched()
    openMenu(container)
    tickCompanies(container, 'Greyfox', 'Bayside')
    expect(toDateValues(container)).toEqual(['269', '213', '56', '79.2%'])
    expect(chipTexts(container)).toEqual(['Created By (Company): LotusWorks, Bayside, Greyfox'])
    expect(badge(container)).toBe('1')
  })

  it('the excluded footnote follows the selection', () => {
    const container = drawEnriched()
    openMenu(container)
    tickCompanies(container, 'Greyfox', 'Bayside')
    expect(notes(container)).toEqual(['808 issues from other companies are excluded'])
    click(buttonNamed(container, 'Select all'))
    expect(notes(container)).toEqual([])
  })

  it('the excluded footnote stays while another field filters the default', () => {
    const container = drawEnriched()
    openMenu(container)
    toggleSection(container, 'Status')
    click(checkbox(container, 'Pending'))
    expect(notes(container)).toEqual(['846 issues not created by LotusWorks are excluded'])
  })

  it('unticking every company falls back to the default', () => {
    const container = drawEnriched()
    openMenu(container)
    click(checkbox(container, 'LotusWorks'))
    expect(checkbox(container, 'LotusWorks').checked).toBe(true)
    expect(badge(container)).toBeNull()
    expect(toDateValues(container)).toEqual(['231', '175', '56', '75.8%'])
  })

  it('Select all ticks every company, and Clear all restores the default', () => {
    const container = drawEnriched()
    openMenu(container)
    click(buttonNamed(container, 'Select all'))
    expect(showing(container)).toBe('Showing 1,077 of 1,077 rows')
    expect(cardValue(container, 'Total Opened')).toBe('1,077')
    click(buttonNamed(container, 'Clear all'))
    expect(showing(container)).toBe('Showing 231 of 1,077 rows')
    expect(toDateValues(container)).toEqual(['231', '175', '56', '75.8%'])
  })

  it('a company that was never LotusWorks alone leaves LotusWorks out once it is unticked', () => {
    const container = drawEnriched()
    openMenu(container)
    tickCompanies(container, 'Larch')
    click(checkbox(container, 'LotusWorks'))
    expect(cardValue(container, 'Total Opened')).toBe('4')
    expect(chipTexts(container)).toEqual(['Created By (Company): Larch'])
  })

  it('Status filters by the sheet\'s value, Pending apart from Open, within the default company', () => {
    const container = drawEnriched()
    openMenu(container)
    toggleSection(container, 'Status')
    click(checkbox(container, 'Pending'))
    const expected = BASE.issues.filter((issue) => issue.statusKind === 'pending').length
    expect(cardValue(container, 'Total Opened')).toBe(String(expected))
    expect(expected).toBeLessThan(56)
    expect(chipTexts(container)).toEqual(['Status: Pending'])
  })

  it('Contractor agrees with what the tables show', () => {
    const container = drawEnriched()
    openMenu(container)
    toggleSection(container, 'Created By (Company)')
    toggleSection(container, 'Contractor')
    click(checkbox(container, 'Greyfox'))
    const expected = BASE.issues.filter((issue) => issue.contractor === 'Greyfox').length
    expect(cardValue(container, 'Total Opened')).toBe(String(expected))
  })

  it('Root Cause agrees with the Pareto', () => {
    const container = drawEnriched()
    openMenu(container)
    toggleSection(container, 'Root Cause')
    click(checkbox(container, 'Installation'))
    const expected = BASE.issues.filter((issue) => issue.rootCause === 'Installation').length
    expect(cardValue(container, 'Total Opened')).toBe(String(expected))
  })

  it('with the company slot unbound, there is no company field and a filter keeps the LotusWorks limit', () => {
    const container = drawEnriched(UNBOUND_COMPANY)
    expect(toDateValues(container)).toEqual(['231', '175', '56', '75.8%'])
    openMenu(container)
    expect(sectionTitles(container)).toEqual(['Contractor', 'Status', 'Type', 'Root Cause'])
    expect(showing(container)).toBe('Showing 231 of 231 rows')
    toggleSection(container, 'Status')
    click(checkbox(container, 'Closed'))
    expect(toDateValues(container)).toEqual(['175', '175', '0', '100.0%'])
    expect(showing(container)).toBe('Showing 175 of 231 rows')
    expect(notes(container)).toEqual(['846 issues not created by LotusWorks are excluded'])
  })

  it('a filter never shortens the axis', () => {
    const container = drawEnriched()
    clickRange(container, 'All')
    expect(mainHitWeeks(container)[0]).toBe('202213')
    openMenu(container)
    toggleSection(container, 'Status')
    click(checkbox(container, 'Pending'))
    const firstPending = Math.min(...BASE.issues.filter((issue) => issue.statusKind === 'pending').map((issue) => issue.createdWeek.key))
    expect(firstPending).toBeGreaterThan(202213)
    expect(mainHitWeeks(container)[0]).toBe('202213')
  })

  it('a company with earlier issues widens the axis to them', () => {
    const container = drawEnriched()
    clickRange(container, 'All')
    openMenu(container)
    tickCompanies(container, 'Ivory - Ops')
    expect(mainHitWeeks(container)[0]).toBe('202209')
  })

  it('the Pareto and Issue Aging follow a field filter', () => {
    const container = drawEnriched()
    openMenu(container)
    tickCompanies(container, 'Greyfox', 'Bayside')
    pressEscape(pick(container, '.qaqc-filter-popover', HTMLElement))
    clickRange(container, 'All')
    click(pick(container, 'button[aria-label="Open the Issues by Root Cause Pareto page"]', HTMLButtonElement))
    expect(container.querySelector('[role="dialog"] .qaqc-pareto-chart-note')?.textContent).toContain('269')
  })

  it('the menu\'s From reaches the first week of any company', () => {
    const container = drawEnriched()
    openMenu(container)
    const [from] = container.querySelectorAll<HTMLSelectElement>('.qaqc-filter-date select')
    expect([...from.options].map((option) => option.value)).toContain('202209')
    expect([...from.options].find((option) => option.value === '202209')?.textContent).toContain('(start)')
  })

  it('reaches a range before the default view\'s first week: charts show the range\'s weeks', () => {
    const container = drawEnriched()
    openMenu(container)
    setRange(container, 202209, 202220)
    const weeks = mainHitWeeks(container)
    expect(weeks[0]).toBe('202209')
    expect(weeks[weeks.length - 1]).toBe('202220')
    expect(groupSubtitle(container)).toBe("WW09'2022 to WW20'2022")
  })

  it('a current-week range keeps the real Remaining Open and the Aging charts', () => {
    const container = drawEnriched()
    const agingBefore = panel(container, OPEN_AGING_TITLE)?.textContent
    openMenu(container)
    setRange(container, 202645, 202645)
    expect(container.querySelector('.qaqc-filter-empty')).toBeNull()
    expect(toDateValues(container)).toEqual(['0', '0', '56', 'n/a'])
    expect(cardDetail(container, 'Closure Rate')).toBe('No issues opened in range')
    expect(panel(container, OPEN_AGING_TITLE)?.textContent).toBe(agingBefore)
    expect(BASE.openAging.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(56)
    expect(panel(container, OPEN_AGING_TITLE)?.querySelector('svg')).not.toBeNull()
    expect(mainHitWeeks(container)).toEqual(['202645'])
  })

  it('a quiet range under a field filter draws the chart, with no word about 30 WW', () => {
    const container = drawEnriched()
    openMenu(container)
    click(checkbox(container, 'Greyfox'))
    setRange(container, 202645, 202645)
    expect(container.querySelector('.qaqc-filter-empty')).toBeNull()
    expect(panel(container, TREND_TITLE)?.textContent).not.toContain('switch to All')
    expect(mainHitWeeks(container)).toEqual(['202645'])
  })

  it('a range before any issue shows the empty state, and Clear filters returns', () => {
    const container = drawEnriched()
    openMenu(container)
    // The default (LotusWorks) view's first issue is in WW13'2022; other companies' start in WW09.
    setRange(container, 202209, 202212)
    expect(container.querySelector('.qaqc-filter-empty')?.textContent).toContain('There are no issues in this date range')
    expect(container.querySelector('.qaqc-kpi-row')).toBeNull()
    click(buttonNamed(container, 'Clear filters'))
    expect(toDateValues(container)).toEqual(['231', '175', '56', '75.8%'])
    expect(document.activeElement).toBe(filterButton(container))
  })

  it('a filter leaving no issues shows the empty state', () => {
    const rows = [['#1', 'One', 'Void', 'COR', 'Bayside', '10/5/2026', null, null, 'LotusWorks']]
    const index = buildIssueIndex(rows, COLUMNS, TODAY)
    view = draw({ index, filterSource: { rows, columns: COLUMNS, today: TODAY } })
    const { container } = view
    openMenu(container)
    expect(container.querySelector('.qaqc-filter-empty')).toBeNull()
    toggleSection(container, 'Status')
    click(checkbox(container, 'Void'))
    expect(container.querySelector('.qaqc-filter-empty')?.textContent).toContain('There are no issues')
    expect(showing(container)).toBe('Showing 1 of 1 rows')
  })

  it('in range, the group restates, the toggle is disabled and the week picker lists only the range', () => {
    const container = drawEnriched()
    openMenu(container)
    setRange(container, 202630, 202640)
    expect(groupTitle(container)).toBe('In range')
    expect(groupSubtitle(container)).toBe("WW30'2026 to WW40'2026")
    expect(chipTexts(container)).toEqual(["Date range: WW30'2026 to WW40'2026"])
    expect(badge(container)).toBe('1')

    const span = BASE.weeks.filter((item) => item.week.key >= 202630 && item.week.key <= 202640)
    const opened = span.reduce((sum, item) => sum + item.opened, 0)
    const closed = span.reduce((sum, item) => sum + item.closed, 0)
    const nowClosed = BASE.issues.filter((issue) => issue.statusKind === 'closed' && issue.createdWeek.key >= 202630 && issue.createdWeek.key <= 202640).length
    const position = BASE.positionByKey.get(202640) ?? -1
    const remaining = BASE.cumulativeOpened[position] - BASE.cumulativeClosed[position]
    expect(toDateValues(container)).toEqual([String(opened), String(closed), String(remaining), `${((nowClosed / opened) * 100).toFixed(1)}%`])
    expect(cardDetail(container, 'Closure Rate')).toBe(`${nowClosed} of ${opened} closed`)

    const weeks = mainHitWeeks(container)
    expect(weeks).toHaveLength(11)
    expect(container.querySelector<HTMLButtonElement>('.qaqc-header .qaqc-segmented button')?.disabled).toBe(true)
    expect(weekPickerKeys(container)).toHaveLength(11)
    expect(weekPickerKeys(container)[0]).toBe('202640')
  })

  it('Showing X of Y counts the rows created in the range', () => {
    const container = drawEnriched()
    openMenu(container)
    setRange(container, 202630, 202640)
    const readWeek = issueRowWeekKey(ENRICHED_COLUMNS)
    const everyCompany = ENRICHED_ISSUE_ROWS.filter((row) => {
      const key = readWeek(row)
      return key !== null && key >= 202630 && key <= 202640
    })
    const lotusWorks = BASE.issues.filter((issue) => issue.createdWeek.key >= 202630 && issue.createdWeek.key <= 202640)
    expect(everyCompany.length).toBeGreaterThan(lotusWorks.length)
    expect(showing(container)).toBe(`Showing ${lotusWorks.length} of 1,077 rows`)
  })

  it('Aging and Pareto aren\'t restated by the range, and their own controls keep working', () => {
    const container = drawEnriched()
    clickRange(container, 'All')
    click(pick(container, 'button[aria-label="Open the Issues by Root Cause Pareto page"]', HTMLButtonElement))
    const readout = (): string | null | undefined => container.querySelector('[role="dialog"] .qaqc-pareto-chart-note')?.textContent
    const title = (): string | null | undefined => container.querySelector('[role="dialog"] h3')?.textContent
    const before = readout()
    const titleBefore = title()
    click(pick(container, '.qaqc-back-button', HTMLButtonElement))

    openMenu(container)
    setRange(container, 202630, 202640)
    pressEscape(pick(container, '.qaqc-filter-popover', HTMLElement))
    click(pick(container, 'button[aria-label="Open the Issues by Root Cause Pareto page"]', HTMLButtonElement))
    expect(readout()).toBe(before)
    expect(title()).toBe(titleBefore)

    const page = pick(container, '[role="dialog"]', HTMLElement)
    const toggle = [...page.querySelectorAll<HTMLButtonElement>('.qaqc-segmented button')].find((button) => button.textContent === '30 WW')
    if (toggle === undefined) throw new Error('page toggle missing')
    expect(toggle.disabled).toBe(false)
    click(toggle)
    expect(title()).not.toBe(titleBefore)
    const picker = pick(page, '.qaqc-week-picker select', HTMLSelectElement)
    expect(picker.options[picker.options.length - 1].value).toBe(String(BASE.weeks[0].week.key))
    choose(picker, 202610)
    expect(picker.value).toBe('202610')
  })

  it('Open Issue Aging doesn\'t change with the range', () => {
    const container = drawEnriched()
    const before = panel(container, OPEN_AGING_TITLE)?.textContent
    openMenu(container)
    setRange(container, 202630, 202640)
    expect(panel(container, OPEN_AGING_TITLE)?.textContent).toBe(before)
  })

  it('says a filter\'s rows are outside the recent window instead of drawing an empty chart', () => {
    const rows = [
      ['#1', 'Old', 'Closed', 'COR', 'Bayside', '1/5/2024', '1/8/2024', null, 'LotusWorks'],
      ['#2', 'New', 'Open', 'COR', 'Bayside', '10/5/2026', null, null, 'LotusWorks'],
    ]
    const index = buildIssueIndex(rows, COLUMNS, TODAY)
    view = draw({ index, filterSource: { rows, columns: COLUMNS, today: TODAY } })
    const { container } = view
    expect(panel(container, TREND_TITLE)?.textContent).not.toContain('Nothing in this window')
    openMenu(container)
    toggleSection(container, 'Status')
    click(checkbox(container, 'Closed'))
    expect(panel(container, TREND_TITLE)?.textContent).toContain('switch to All to see them')
  })

  it('disables the Filter button when interactions are not allowed', () => {
    const container = drawEnriched(ENRICHED_COLUMNS, { interactive: false })
    expect(filterButton(container).disabled).toBe(true)
  })

  it('keeps the footnotes it is given with no filter set', () => {
    const container = drawEnriched()
    expect(notes(container)).toEqual(NOTES)
  })
})

describe('IssuesDashboard week drill-down', () => {
  const FILTER_TODAY = new Date(2026, 10, 4)
  const BASE = buildIssueIndex(ENRICHED_ISSUE_ROWS, ENRICHED_COLUMNS, FILTER_TODAY)
  // WW42: 3 opened, 3 closed. WW44: nothing, after the fixture's last update.
  const BUSY_KEY = 202642
  const QUIET_KEY = 202644
  const BUSY_TITLE = "Issues · WW42'2026"

  function drawDrill(overrides: Partial<IssuesDashboardProps> = {}): HTMLElement {
    stubSize()
    view = draw({ index: BASE, filterSource: { rows: ENRICHED_ISSUE_ROWS, columns: ENRICHED_COLUMNS, today: FILTER_TODAY }, ...overrides })
    return view.container
  }

  function page(container: HTMLElement): HTMLElement | null {
    return [...container.querySelectorAll<HTMLElement>('[role="dialog"]')].find((node) => node.getAttribute('aria-label')?.startsWith('Issues · ')) ?? null
  }

  function hit(container: HTMLElement, key: number): Element {
    const rect = panel(container, TREND_TITLE)?.querySelector(`.qaqc-hit[data-week="${key}"]`)
    if (!rect) throw new Error(`no week ${key}`)
    return rect
  }

  function chart(container: HTMLElement): Element {
    const svg = panel(container, TREND_TITLE)?.querySelector('svg.qaqc-chart')
    if (!svg) throw new Error('chart missing')
    return svg
  }

  function backButton(container: HTMLElement): HTMLButtonElement {
    const button = page(container)?.querySelector<HTMLButtonElement>('.qaqc-back-button')
    if (!button) throw new Error('back button missing')
    return button
  }

  /** The group headings, as "Opened (2)". */
  function groupHeadings(container: HTMLElement): string[] {
    return [...(page(container)?.querySelectorAll('.qaqc-week-issues-group h4') ?? [])].map((node) => node.textContent ?? '')
  }

  /** The number the chart itself shows for a week, from its tooltip. */
  function chartCounts(container: HTMLElement, onHover: ReturnType<typeof vi.fn>, key: number): { opened: number; closed: number } {
    act(() => {
      hit(container, key).dispatchEvent(new MouseEvent('mousemove', { bubbles: true }))
    })
    const request: unknown = onHover.mock.lastCall?.[0]
    if (typeof request !== 'object' || request === null || !('rows' in request) || !Array.isArray(request.rows)) throw new Error('no tooltip')
    const value = (label: string): number => {
      const row: unknown = Array.isArray(request.rows) ? request.rows.find((item: { label?: string }) => item.label === label) : undefined
      if (typeof row !== 'object' || row === null || !('value' in row)) throw new Error(`no ${label}`)
      return Number(row.value)
    }
    return { opened: value('Opened'), closed: value('Closed') }
  }

  function expectGroupsToMatchChart(container: HTMLElement, onHover: ReturnType<typeof vi.fn>): number {
    let opens = 0
    for (const key of mainHitWeeks(container).map(Number)) {
      const { opened, closed } = chartCounts(container, onHover, key)
      click(hit(container, key))
      if (opened + closed === 0) {
        expect(page(container)).toBeNull()
        continue
      }
      opens += 1
      const expected = [
        ...(opened > 0 ? [`Opened (${opened})`] : []),
        ...(closed > 0 ? [`Closed (${closed})`] : []),
      ]
      expect(groupHeadings(container)).toEqual(expected)
      click(backButton(container))
    }
    return opens
  }

  it('a click on a week with activity selects it and opens the page', () => {
    const container = drawDrill()
    click(hit(container, BUSY_KEY))
    expect(weekSubtitle(container)).toBe("WW42'2026")
    const open = page(container)
    expect(open?.getAttribute('aria-label')).toBe(BUSY_TITLE)
    expect(open?.querySelector('h3')?.textContent).toBe(BUSY_TITLE)
    expect(groupHeadings(container)).toEqual(['Opened (3)', 'Closed (3)'])
    expect(open?.querySelector('.qaqc-week-issues-count')?.textContent).toBe("6 issues in WW42'2026")
  })

  it('counts an issue opened and closed in the same week once, with the split in the headings', () => {
    const container = drawDrill()
    openMenu(container)
    click(checkbox(container, 'Greyfox'))
    click(checkbox(container, 'Bayside'))
    pressEscape(pick(container, '.qaqc-filter-popover', HTMLElement))
    click(hit(container, 202641))
    expect(groupHeadings(container)).toEqual(['Opened (4)', 'Closed (3)'])
    expect(page(container)?.querySelector('.qaqc-week-issues-count')?.textContent).toBe("6 issues in WW41'2026")
  })

  it('a click on a week with no activity only selects it', () => {
    const container = drawDrill()
    click(hit(container, QUIET_KEY))
    expect(weekSubtitle(container)).toBe("WW44'2026")
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('Enter on the focused week behaves the same', () => {
    const container = drawDrill()
    pickWeekInDropdown(container, String(QUIET_KEY))
    pressKeys(chart(container), ['Enter'])
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    pickWeekInDropdown(container, String(BUSY_KEY))
    pressKeys(chart(container), ['Enter'])
    expect(page(container)?.getAttribute('aria-label')).toBe(BUSY_TITLE)
  })

  it('lists Issue Detail\'s columns', () => {
    const container = drawDrill()
    click(hit(container, BUSY_KEY))
    const first = page(container)?.querySelector('.qaqc-week-issues-group')
    expect([...(first?.querySelectorAll('thead th') ?? [])].map((node) => node.textContent)).toEqual([
      'ID', 'Subtype', 'Status', 'Title', 'Contractor', 'Work Week', 'Created On', 'Work Week Closed', 'Due Date',
    ])
  })

  it('a row reads as it does in Issue Detail', () => {
    const container = drawDrill()
    click(hit(container, BUSY_KEY))
    const detail = BASE.issues.find((issue) => issue.createdWeek.key === BUSY_KEY)?.detail
    if (detail === undefined) throw new Error('no issue that week')
    const rows = [...(page(container)?.querySelectorAll('.qaqc-week-issues-group:first-of-type tbody tr:not(.qaqc-virtual-spacer)') ?? [])]
    const row = rows.find((item) => item.children[0].textContent === detail.id)
    expect([...(row?.children ?? [])].map((cell) => cell.textContent)).toEqual([
      detail.id, detail.subtype, detail.status, detail.title, detail.contractor, detail.workWeek, detail.createdOn, detail.workWeekClosed, detail.dueDate,
    ])
  })

  it('omits a group with no rows', () => {
    const week = BASE.weeks.find((item) => item.opened > 0 && item.closed === 0)
    if (week === undefined) throw new Error('no such week')
    const container = drawDrill()
    clickRange(container, 'All')
    click(hit(container, week.week.key))
    expect(groupHeadings(container)).toEqual([`Opened (${week.opened})`])
  })

  it('every week\'s groups equal the chart\'s opened and closed, with and without filters', () => {
    const onHover = vi.fn()
    const container = drawDrill({ onHover })
    clickRange(container, 'All')
    expect(expectGroupsToMatchChart(container, onHover)).toBeGreaterThan(10)

    openMenu(container)
    click(checkbox(container, 'Greyfox'))
    click(checkbox(container, 'Bayside'))
    pressEscape(pick(container, '.qaqc-filter-popover', HTMLElement))
    expect(expectGroupsToMatchChart(container, onHover)).toBeGreaterThan(10)
    // Draws the page for every week of two long axes (about 240 weeks each, from WW13'2022), which takes a while on
    // a busy machine.
  }, 120_000)

  it('a closed row shows the week it closed, in the Closed group', () => {
    const container = drawDrill()
    click(hit(container, BUSY_KEY))
    const groups = page(container)?.querySelectorAll('.qaqc-week-issues-group') ?? []
    const closedRow = groups[1]?.querySelector('tbody tr:not(.qaqc-virtual-spacer)')
    expect(closedRow?.children[7].textContent).toBe("WW42'2026")
  })

  it('Esc and Back return to the dashboard with focus on the chart', () => {
    const container = drawDrill()
    click(hit(container, BUSY_KEY))
    expect(document.activeElement).toBe(backButton(container))
    click(backButton(container))
    expect(page(container)).toBeNull()
    expect(document.activeElement).toBe(chart(container))

    click(hit(container, BUSY_KEY))
    const open = page(container)
    if (!open) throw new Error('page missing')
    pressEscape(open)
    expect(page(container)).toBeNull()
    expect(document.activeElement).toBe(chart(container))
  })

  it('clears the tooltip when the page opens', () => {
    const onHover = vi.fn()
    const container = drawDrill({ onHover })
    act(() => {
      hit(container, BUSY_KEY).dispatchEvent(new MouseEvent('mousemove', { bubbles: true }))
    })
    click(hit(container, BUSY_KEY))
    expect(onHover).toHaveBeenLastCalledWith(null)
  })

  it('opens from the expanded chart', () => {
    const container = drawDrill()
    const open = expandPanel(container, TREND_TITLE)
    const rect = open.querySelector(`.qaqc-hit[data-week="${BUSY_KEY}"]`)
    if (!rect) throw new Error('expanded chart has no week')
    click(rect)
    expect(page(container)?.getAttribute('aria-label')).toBe(BUSY_TITLE)
    click(backButton(container))
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('in a range, a click selects inside the range and opens that week', () => {
    const container = drawDrill()
    openMenu(container)
    const [from, to] = container.querySelectorAll<HTMLSelectElement>('.qaqc-filter-date select')
    choose(from, 202640)
    choose(to, 202643)
    click(hit(container, BUSY_KEY))
    expect(page(container)?.getAttribute('aria-label')).toBe(BUSY_TITLE)
  })

  it('Issue Detail keeps working, and follows a filter', () => {
    const container = drawDrill()
    const open = openDetail(container)
    expect(open.querySelector('.qaqc-issue-detail-legend')?.textContent).toContain('56')
    click(pick(open, '.qaqc-back-button', HTMLButtonElement))
    openMenu(container)
    // Greyfox and Bayside have no open issues, so Ivory - Ops (6 open) shows the count following the filter.
    click(checkbox(container, 'Ivory - Ops'))
    pressEscape(pick(container, '.qaqc-filter-popover', HTMLElement))
    expect(openDetail(container).querySelector('.qaqc-issue-detail-legend')?.textContent).toContain('62')
  })

  it('the Issue Aging page\'s Esc still closes its list before the page', () => {
    const container = drawDrill()
    click(pick(container, 'button[aria-label="Open the Issue Aging page"]', HTMLButtonElement))
    const open = pick(container, '[role="dialog"]', HTMLElement)
    click(pick(open, '.qaqc-expand-button', HTMLButtonElement))
    expect(open.querySelector('.qaqc-aging-list')).not.toBeNull()
    pressEscape(open)
    expect(container.querySelector('[role="dialog"]')).not.toBeNull()
    expect(open.querySelector('.qaqc-aging-list')).toBeNull()
    pressEscape(open)
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })
})

describe('IssuesDashboard NCR Pass Rate', () => {
  const CARD = 'NCR Pass Rate'
  const CARD_TODAY = new Date(2026, 10, 4) // WW45'2026, after the fixture's last update (19 Oct)
  const position = (name: (typeof COMBINED_COLUMNS)[number]): number => COMBINED_COLUMNS.indexOf(name)
  const COMBINED: CombinedColumns = {
    source: position('Source'),
    workWeek: position('Work Week'),
    phase: position('Inspection Phase'),
    issue: position('Issue'),
    building: position('Building'),
    qcr: position('QCR/FE'),
    welder: position('Welder'),
    tagNo: position('Tag No'),
    signature: position('Signature'),
    signedWeek: position('Work Week Signed'),
    id: position('ID'),
    status: position('Status'),
    type: position('Type'),
    createdOn: position('Created On'),
    updatedOn: position('Updated On'),
    createdBy: position('Created By'),
    rootCause: position('Root Cause'),
    greenTags: -1,
  }
  const SPLIT = splitCombinedRows(ENRICHED_COMBINED_ROWS, COMBINED.source)
  const INSPECTION_ROWS = [...SPLIT.electrical, ...SPLIT.mechanical]
  const INSPECTIONS = buildInspectionIndex(INSPECTION_ROWS, inspectionColumnsOf(COMBINED), CARD_TODAY)
  const OVERVIEW = buildOverviewIndex(SPLIT, COMBINED, CARD_TODAY)
  const WW45 = 202645
  const WW30 = 202630

  function drawCard(overrides: Partial<IssuesDashboardProps> = {}): HTMLElement {
    stubSize()
    const index = buildIssueIndex(ENRICHED_ISSUE_ROWS, ENRICHED_COLUMNS, CARD_TODAY)
    view = draw({
      index,
      filterSource: { rows: ENRICHED_ISSUE_ROWS, columns: ENRICHED_COLUMNS, today: CARD_TODAY },
      inspections: { index: INSPECTIONS },
      ...overrides,
    })
    return view.container
  }

  function overviewCard(key: number): string {
    const model = buildOverviewModel(OVERVIEW, { selectedKey: key, windowEndKey: key, range: 'recent', dateRange: null }, 'toDate')
    const found = model.quality.find((item) => item.label === 'Inspection NCR pass rate')
    if (found === undefined) throw new Error('Overview card missing')
    return found.display
  }

  /** 100% − (NCRs ÷ Finals), counted straight from the fixture's rows through the index's weeks. */
  function countedRate(fromKey: number, toKey: number): string {
    let finals = 0
    let ncrs = 0
    for (const week of INSPECTIONS.weeks) {
      if (week.week.key < fromKey || week.week.key > toKey) continue
      finals += week.finals
      ncrs += week.issuesFound
    }
    return `${(((finals - ncrs) / finals) * 100).toFixed(1)}%`
  }

  function setRange(container: HTMLElement, fromKey: number, toKey: number): void {
    const [from, to] = container.querySelectorAll<HTMLSelectElement>('.qaqc-filter-date select')
    choose(from, fromKey)
    choose(to, toKey)
  }

  /** The rendered markup, with React's generated ids, which differ between mounts, blanked. */
  function markupOf(container: HTMLElement): string {
    return container.innerHTML.replace(/«r[^»]*»|:r[^:]*:|_r_[^_"]*_/g, 'id')
  }

  function noteOf(container: HTMLElement): string | null {
    return card(container, CARD)?.querySelector('.qaqc-kpi-context')?.textContent ?? null
  }

  it('matches the Overview\'s Inspection NCR pass rate through the selected week', () => {
    const container = drawCard()
    expect(cardValue(container, CARD)).toBe(overviewCard(WW45))
    expect(cardValue(container, CARD)).toBe(countedRate(0, WW45))
    pickWeekInDropdown(container, String(WW30))
    expect(cardValue(container, CARD)).toBe(overviewCard(WW30))
    expect(cardValue(container, CARD)).not.toBe(overviewCard(WW45))
  })

  it('sits after Closure Rate in the Project to date group', () => {
    const container = drawCard()
    const group = container.querySelector('.qaqc-kpi-group.is-toDate')
    expect(group?.querySelector('span')?.textContent).toBe('Project to date')
    const labels = [...(group?.querySelectorAll('.qaqc-kpi-label') ?? [])].map((node) => node.textContent)
    expect(labels).toEqual(['Total Opened', 'Total Closed', 'Remaining Open', 'Closure Rate', CARD])
  })

  it('in range the card restates to the range', () => {
    const container = drawCard()
    openMenu(container)
    setRange(container, 202620, 202630)
    expect(container.querySelector('.qaqc-kpi-group.is-toDate span')?.textContent).toBe('In range')
    expect(cardValue(container, CARD)).toBe(countedRate(202620, 202630))
    // The whole range, wherever the selected week is inside it.
    choose(pick(container, '.qaqc-week-picker select', HTMLSelectElement), 202625)
    expect(weekSubtitle(container)).toBe("WW25'2026")
    expect(cardValue(container, CARD)).toBe(countedRate(202620, 202630))
  })

  it('unbound, the card is hidden and output is identical', () => {
    const container = drawCard({ inspections: undefined })
    expect(cardValue(container, CARD)).toBeNull()
    expect(container.querySelector<HTMLElement>('.qaqc-kpi-group.is-toDate')?.style.getPropertyValue('--qaqc-kpi-cards')).toBe('4')
    const unbound = markupOf(container)
    view?.unmount()
    expect(markupOf(drawCard({ inspections: { index: null } }))).toBe(unbound)
  })

  it('lets the five cards wrap, keeping the four-card share so This WW doesn\'t narrow', () => {
    const group = drawCard().querySelector<HTMLElement>('.qaqc-kpi-group.is-toDate')
    expect(group?.classList.contains('can-wrap')).toBe(true)
    expect(group?.style.getPropertyValue('--qaqc-kpi-cards')).toBe('4')
    expect(ruleBody('.qaqc-kpi-group.can-wrap .qaqc-kpi-group-body')).toMatch(/grid-template-columns: repeat\(auto-fit, minmax\(\d+px, 1fr\)\);/)
  })

  it('stays the four-card layout with the card hidden', () => {
    const group = drawCard({ inspections: { index: null } }).querySelector<HTMLElement>('.qaqc-kpi-group.is-toDate')
    expect(group?.className).toBe('qaqc-kpi-group is-toDate')
  })

  it('a card has no small print', () => {
    const element = card(drawCard(), CARD)
    expect(element?.querySelector('.qaqc-kpi-label')?.textContent).toBe(CARD)
    expect(element?.querySelector('.qaqc-kpi-detail')).toBeNull()
    expect(element?.querySelector('.qaqc-kpi-context')).toBeNull()
  })

  it('shows n/a with no finals', () => {
    const empty = buildInspectionIndex([], inspectionColumnsOf(COMBINED), CARD_TODAY)
    expect(cardValue(drawCard({ inspections: { index: empty } }), CARD)).toBe('n/a')
  })

  it('an issue field filter leaves the card unfiltered and shows the note All inspections', () => {
    const container = drawCard()
    const value = cardValue(container, CARD)
    expect(noteOf(container)).toBeNull()
    openMenu(container)
    toggleSection(container, 'Status')
    click(checkbox(container, 'Closed'))
    expect(toDateCardValuesOf(container)).not.toEqual(['231', '175', '56', '75.8%'])
    expect(cardValue(container, CARD)).toBe(value)
    expect(noteOf(container)).toBe('All inspections')
    click(checkbox(container, 'Closed'))
    expect(noteOf(container)).toBeNull()
  })

  it('a non-default company counts as an issue field filter, and the default company doesn\'t', () => {
    const container = drawCard()
    const value = cardValue(container, CARD)
    openMenu(container)
    expect(checkbox(container, 'LotusWorks').checked).toBe(true)
    expect(noteOf(container)).toBeNull()
    click(checkbox(container, 'Greyfox'))
    expect(cardValue(container, CARD)).toBe(value)
    expect(noteOf(container)).toBe('All inspections')
  })

  it('a date range alone shows no note', () => {
    const container = drawCard()
    openMenu(container)
    setRange(container, 202620, 202630)
    expect(noteOf(container)).toBeNull()
  })

  function toDateCardValuesOf(container: HTMLElement): Array<string | null> {
    return ['Total Opened', 'Total Closed', 'Remaining Open', 'Closure Rate'].map((label) => cardValue(container, label))
  }
})
