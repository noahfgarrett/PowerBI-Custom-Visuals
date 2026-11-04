import { CircleAlert } from 'lucide-react'
import { act, type ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { IssuesDashboard, type IssuesDashboardProps } from '../components/IssuesDashboard'
import { buildIssueIndex } from '../issues'
import { resolveTheme } from '../theme'
import type { IssueColumns, IssueIndex } from '../types'
import { ISSUE_ROWS } from './fixtures/issueRows'
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

  it('shows the WW31 activity when WW31 is picked', () => {
    view = draw()
    pickWeekInDropdown(view.container, '202631')
    const { container } = view
    expect(weekSubtitle(container)).toBe("WW31'2026")
    expect(cardValue(container, 'Issues Opened')).toBe('2')
    expect(cardDetail(container, 'Issues Opened')).toBe("+1 vs WW30'2026")
    expect(cardValue(container, 'Issues Closed')).toBe('1')
    expect(cardDetail(container, 'Issues Closed')).toBe("No change vs WW30'2026")
  })

  it('shows the project-to-date change in the picked week', () => {
    view = draw()
    pickWeekInDropdown(view.container, '202631')
    const { container } = view
    expect(cardDetail(container, 'Total Opened')).toBe('+2 this WW')
    expect(cardDetail(container, 'Total Closed')).toBe('+1 this WW')
    expect(cardDetail(container, 'Remaining Open')).toBe('+1 this WW')
    expect(cardDetail(container, 'Closure Rate')).toBe("−0.2 pts vs WW30'2026")
  })

  it('colors each card with the model tone', () => {
    view = draw()
    pickWeekInDropdown(view.container, '202631')
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
    expect(order).toEqual(['qaqc-header-button', 'qaqc-header-button', 'qaqc-header-button', 'qaqc-segmented', 'qaqc-week-picker'])
    expect([...(controls?.querySelectorAll('.qaqc-header-button') ?? [])].map((node) => node.textContent)).toEqual([
      'Issue Detail',
      'Issues by Root Cause Pareto',
      'Issue Aging',
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
    expect(cardValue(view.container, 'Issues Opened')).toBe('2')
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
    expect(values).toEqual(['37', '27', '+10', '71.2%'])
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
      ['0-14 Days', '38', '38', '0'],
      ['14-28 Days', '19', '19', '0'],
      ['28+ Days', '120', '69', '51'],
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
    expect(detailRowIds(open).slice(0, 4)).toEqual(['#1020', '#1019', '#1004', '#1018'])
    expect(open.querySelector('tbody tr[aria-rowindex="4"]')?.classList.contains('is-discussion')).toBe(false)
    expect(open.querySelector('tbody tr[aria-rowindex="5"]')?.classList.contains('is-discussion')).toBe(true)
    const legend = [...open.querySelectorAll('.qaqc-issue-detail-legend li')].map((item) => item.textContent)
    expect(legend).toEqual(['Reporting week3', 'Open for discussion49'])
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

  it('shows Installation 48 and the read-out over every week', () => {
    stubSize()
    view = draw()
    clickRange(view.container, 'All')
    const open = openPareto(view.container, PARETO_ALL_TITLE)
    const counts = [...open.querySelectorAll('.qaqc-pareto-value.qaqc-bar-value')].map((node) => node.textContent)
    expect(counts[0]).toBe('48')
    expect(open.querySelector('.qaqc-pareto-table h3')?.textContent).toBe('Installation')
    expect(open.querySelector('.qaqc-pareto-readout')?.textContent).toContain('Installation is 48 of 177 (27.1%).')
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
