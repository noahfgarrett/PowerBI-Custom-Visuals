import { CircleAlert } from 'lucide-react'
import { act, type ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { IssuesDashboard, type IssuesDashboardProps } from '../components/IssuesDashboard'
import { agingProfile } from '../issueBenchmarks'
import { resolveTheme } from '../theme'
import type { IssueIndex } from '../types'
import { ISSUE_ROWS } from './fixtures/issueRows'
import { AGING_COLUMNS, AGING_TODAY, agingIndex, all, click, noClosuresIndex, pressKey, stubSize, texts } from './agingFixture'
import { countCompares } from './countCompares'
import { render, type Rendered } from './render'

// The real aging profile, wrapped so a test can see how often the page builds it.
vi.mock('../issueBenchmarks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../issueBenchmarks')>()
  return { ...actual, agingProfile: vi.fn(actual.agingProfile) }
})

const INDEX = agingIndex()
const THEME = resolveTheme({ preset: 'qaqc', backgroundColor: '', backgroundOpacity: 100, cardOpacity: 100, highContrast: null })
const PAGE_TITLE = "Issue Aging · as of WW42'2026"

let view: Rendered | null = null

afterEach(() => {
  view?.unmount()
  view = null
  vi.restoreAllMocks()
})

function dashboard(overrides: Partial<IssuesDashboardProps> = {}): ReactElement {
  return (
    <IssuesDashboard
      title="QCx Issues"
      icon={CircleAlert}
      index={INDEX}
      filterSource={{ rows: ISSUE_ROWS, columns: AGING_COLUMNS, today: AGING_TODAY }}
      theme={THEME}
      interactive
      animate={false}
      describeCharts
      loading={false}
      footnotes={[]}
      viewport={{ width: 1312, height: 752 }}
      onHover={vi.fn()}
      {...overrides}
    />
  )
}

function agingButton(root: ParentNode): HTMLButtonElement | null {
  return root.querySelector<HTMLButtonElement>('.qaqc-header button[aria-label="Open the Issue Aging page"]')
}

function openPage(overrides: Partial<IssuesDashboardProps> = {}): HTMLElement {
  stubSize(1200, 600)
  view = render(dashboard(overrides))
  const button = agingButton(view.container)
  if (!button) throw new Error('Issue Aging button missing')
  button.focus()
  click(button)
  const page = view.container.querySelector<HTMLElement>('.qaqc-expanded[role="dialog"]')
  if (!page) throw new Error('Issue Aging page missing')
  return page
}

function card(root: ParentNode, label: string): HTMLElement {
  const found = all(root, 'article.qaqc-kpi').find((node) => node.getAttribute('aria-label')?.startsWith(`${label}:`))
  if (!(found instanceof HTMLElement)) throw new Error(`${label} card missing`)
  return found
}

function cardText(root: ParentNode, label: string): [string, string] {
  const found = card(root, label)
  return [found.querySelector('.qaqc-kpi-value')?.textContent ?? '', found.querySelector('.qaqc-kpi-detail')?.textContent ?? '']
}

function bucket(root: ParentNode, label: string): Element {
  const found = all(root, '.qaqc-aging-bucket').find((node) => node.getAttribute('aria-label')?.startsWith(`${label}:`))
  if (!found) throw new Error(`bucket ${label} missing`)
  return found
}

function list(root: ParentNode): HTMLElement | null {
  return root.querySelector<HTMLElement>('.qaqc-aging-list')
}

function listTitle(root: ParentNode): string | null {
  return list(root)?.querySelector('h3')?.textContent ?? null
}

function pickWeek(root: ParentNode, key: string): void {
  const select = root.querySelector('select')
  if (!select) throw new Error('week picker missing')
  act(() => {
    select.value = key
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

function pastCardButton(root: ParentNode): HTMLElement {
  const found = root.querySelector<HTMLElement>('.qaqc-aging-card-button')
  if (!found) throw new Error('past window card button missing')
  return found
}

function focusAndClick(target: Element): void {
  if (target instanceof HTMLElement || target instanceof SVGElement) act(() => target.focus())
  click(target)
}

/** A mouse click as a browser does it: focus moves to the nearest focusable ancestor, then the click fires. */
function browserClick(target: Element): void {
  const focusable = target.closest<HTMLElement>('[tabindex], button, a[href], input, select, textarea')
  if (focusable) act(() => focusable.focus())
  click(target)
}

function firstListRow(root: ParentNode): Element {
  const row = list(root)?.querySelector('tbody td.is-text')
  if (!row) throw new Error('list row missing')
  return row
}

describe('Issue Aging header button', () => {
  it('opens the Issue Aging page as of the selected week', () => {
    const page = openPage()
    expect(page.getAttribute('aria-label')).toBe(PAGE_TITLE)
    expect(page.querySelector('.qaqc-aging-page')).not.toBeNull()
  })

  it('is hidden when interactions are not allowed', () => {
    view = render(dashboard({ interactive: false }))
    expect(agingButton(view.container)).toBeNull()
  })

  it('closes on Esc and returns focus to the Issue Aging button', () => {
    const page = openPage()
    pressKey(page, 'Escape')
    expect(view?.container.querySelector('.qaqc-expanded')).toBeNull()
    expect(document.activeElement).toBe(agingButton(view?.container ?? document))
  })
})

describe("Issue Aging cards as of WW42'2026", () => {
  it('heads the cards with the week and the closures to date', () => {
    const page = openPage()
    const group = page.querySelector('.qaqc-kpi-group')
    expect(group?.getAttribute('aria-label')).toBe("As of WW42'2026")
    expect(group?.classList.contains('is-week')).toBe(true)
    expect(group?.querySelector('em')?.textContent).toBe('126 issues closed to date')
  })

  it('shows 51 open issues, unchanged from WW41', () => {
    expect(cardText(openPage(), 'Open issues')).toEqual(['51', "No change vs WW41'2026"])
  })

  it('shows that most issues close within 43 days', () => {
    expect(cardText(openPage(), 'Most issues close within')).toEqual(['43 days', '90% within 81 days · from 126 closed'])
  })

  it('shows 49 past the window in red, all 49 older than any closure', () => {
    const page = openPage()
    expect(cardText(page, 'Past the normal close window')).toEqual(['49', '49 are older than any issue ever closed'])
    expect(card(page, 'Past the normal close window').querySelector('.qaqc-kpi-value')?.classList.contains('is-bad')).toBe(true)
    expect(pastCardButton(page).textContent).toContain('View issues')
  })
})

describe('Issue Aging charts', () => {
  it('draws the three charts', () => {
    const page = openPage()
    expect(texts(page, 'section.qaqc-panel h3')).toEqual([
      'How old are the open issues?',
      'Is the backlog getting older?',
      'Is closing getting faster or slower?',
    ])
  })

  it('puts the WW42 open issues in 0 / 2 / 0 / 4 / 14 / 31', () => {
    expect(texts(openPage(), '.qaqc-aging-count')).toEqual(['0', '2', '0', '4', '14', '31'])
  })

  it('shows the WW42 median open age on the backlog line', () => {
    expect(texts(openPage(), '.qaqc-aging-label.is-last')).toEqual(['462 d'])
  })
})

describe('Issue Aging issue list', () => {
  it('lists the 31 issues of 12+ months when that bar is clicked', () => {
    const page = openPage()
    click(bucket(page, '12+ months'))
    expect(listTitle(page)).toBe('12+ months · 31 open issues')
    expect(list(page)?.querySelector('table')?.getAttribute('aria-rowcount')).toBe('32')
    expect(list(page)?.querySelector('.qaqc-aging-chip')?.textContent).toBe('Showing: 12+ months')
  })

  it('opens a bar from the keyboard', () => {
    const page = openPage()
    pressKey(bucket(page, '3–6 months'), 'Enter')
    expect(listTitle(page)).toBe('3–6 months · 4 open issues')
  })

  it('lists the issues past the window from the red card', () => {
    const page = openPage()
    click(pastCardButton(page))
    expect(listTitle(page)).toBe('Past the normal close window · 49 open issues')
  })

  it('opens the past-window list from the card with Enter', () => {
    const page = openPage()
    pressKey(pastCardButton(page), 'Enter')
    expect(listTitle(page)).toBe('Past the normal close window · 49 open issues')
  })

  it('lists every open issue from the expand button', () => {
    const page = openPage()
    const expand = page.querySelector('.qaqc-expand-button')
    if (!expand) throw new Error('expand button missing')
    click(expand)
    expect(listTitle(page)).toBe('All open issues · 51')
    expect(list(page)?.querySelector('.qaqc-aging-chip')).toBeNull()
  })

  it('shows every open issue once the chip is cleared', () => {
    const page = openPage()
    click(bucket(page, '12+ months'))
    const chip = list(page)?.querySelector('.qaqc-aging-chip')
    if (!chip) throw new Error('chip missing')
    click(chip)
    expect(listTitle(page)).toBe('All open issues · 51')
  })

  it('makes the charts behind the list inert', () => {
    const page = openPage()
    click(bucket(page, '12+ months'))
    expect(page.querySelector('.qaqc-aging-charts')?.hasAttribute('inert')).toBe(true)
  })
})

describe('Issue Aging list closing and focus', () => {
  it('closes the list only on Esc, then the page on a second Esc', () => {
    const page = openPage()
    focusAndClick(bucket(page, '12+ months'))
    pressKey(document.activeElement ?? page, 'Escape')
    expect(list(page)).toBeNull()
    expect(view?.container.querySelector('.qaqc-expanded')).not.toBeNull()
    pressKey(document.activeElement ?? page, 'Escape')
    expect(view?.container.querySelector('.qaqc-expanded')).toBeNull()
  })

  it('returns focus to the bar that opened the list', () => {
    const page = openPage()
    const bar = bucket(page, '12+ months')
    focusAndClick(bar)
    pressKey(document.activeElement ?? page, 'Escape')
    expect(document.activeElement).toBe(bucket(page, '12+ months'))
  })

  it('returns focus to the red card from Back', () => {
    const page = openPage()
    focusAndClick(pastCardButton(page))
    const back = list(page)?.querySelector('.qaqc-back-button')
    if (!back) throw new Error('back missing')
    click(back)
    expect(list(page)).toBeNull()
    expect(document.activeElement).toBe(pastCardButton(page))
  })

  it('returns focus to the expand button', () => {
    const page = openPage()
    const expand = page.querySelector('.qaqc-expand-button')
    if (!expand) throw new Error('expand button missing')
    focusAndClick(expand)
    pressKey(document.activeElement ?? page, 'Escape')
    expect(document.activeElement).toBe(page.querySelector('.qaqc-expand-button'))
  })

  it('closes only the list on Esc while the page dialog itself has focus', () => {
    const page = openPage()
    click(bucket(page, '12+ months'))
    act(() => page.focus())
    pressKey(page, 'Escape')
    expect(list(page)).toBeNull()
    expect(view?.container.querySelector('.qaqc-expanded')).not.toBeNull()
  })

  it('closes the page on a second Esc at the dialog', () => {
    const page = openPage()
    click(bucket(page, '12+ months'))
    act(() => page.focus())
    pressKey(page, 'Escape')
    act(() => page.focus())
    pressKey(page, 'Escape')
    expect(view?.container.querySelector('.qaqc-expanded')).toBeNull()
  })

  it('keeps focus inside the list when a table row is clicked', () => {
    const page = openPage()
    click(bucket(page, '12+ months'))
    browserClick(firstListRow(page))
    expect(list(page)?.contains(document.activeElement)).toBe(true)
  })

  it('keeps focus inside the page when the cards area is clicked', () => {
    const page = openPage()
    browserClick(card(page, 'Open issues'))
    const pageRoot = page.querySelector('.qaqc-aging-page')
    expect(pageRoot?.contains(document.activeElement)).toBe(true)
  })

  it('closes only the list on Esc after a table row is clicked', () => {
    const page = openPage()
    click(bucket(page, '12+ months'))
    browserClick(firstListRow(page))
    pressKey(document.activeElement ?? page, 'Escape')
    expect(list(page)).toBeNull()
    expect(view?.container.querySelector('.qaqc-expanded')).not.toBeNull()
  })

  it('closes the list on Esc from the page controls too', () => {
    const page = openPage()
    click(bucket(page, '12+ months'))
    const select = page.querySelector('select')
    if (!select) throw new Error('picker missing')
    pressKey(select, 'Escape')
    expect(list(page)).toBeNull()
    expect(view?.container.querySelector('.qaqc-expanded')).not.toBeNull()
  })
})

describe('Issue Aging week and range', () => {
  it("shows WW30'2026 from the page's week picker: 62 open and 45 past the window", () => {
    const page = openPage()
    pickWeek(page, '202630')
    expect(page.getAttribute('aria-label')).toBe("Issue Aging · as of WW30'2026")
    expect(cardText(page, 'Open issues')[0]).toBe('62')
    expect(cardText(page, 'Past the normal close window')[0]).toBe('45')
    expect(texts(page, '.qaqc-aging-count')).toEqual(['8', '9', '0', '7', '10', '28'])
  })

  it("moves the dashboard to the page's week", () => {
    const page = openPage()
    pickWeek(page, '202630')
    pressKey(page, 'Escape')
    expect(view?.container.querySelector('.qaqc-kpi-group.is-week em')?.textContent).toBe("WW30'2026")
  })

  it("switches the dashboard's range from the page's toggle", () => {
    const page = openPage()
    const recentPoints = all(page, '.qaqc-aging-backlog .qaqc-hit').length
    const allButton = all(page, '.qaqc-segmented button').find((node) => node.textContent === 'All')
    if (!allButton) throw new Error('All missing')
    click(allButton)
    expect(all(page, '.qaqc-aging-backlog .qaqc-hit').length).toBeGreaterThan(recentPoints)
    pressKey(page, 'Escape')
    const dashboardAll = all(view?.container ?? document, '.qaqc-root .qaqc-segmented button').find((node) => node.textContent === 'All')
    expect(dashboardAll?.getAttribute('aria-pressed')).toBe('true')
  })
})

describe('Issue Aging memoization', () => {
  it('does not re-sort the past-window list when the page re-renders', () => {
    const page = openPage()
    click(pastCardButton(page))
    const titleHeader = all(list(page) ?? page, 'thead th button').find((node) => node.textContent === 'Title')
    if (!titleHeader) throw new Error('Title header missing')
    click(titleHeader)
    const compares = countCompares()
    view?.rerender(dashboard({ onHover: vi.fn() }))
    expect(listTitle(page)).toBe('Past the normal close window · 49 open issues')
    expect(compares()).toBe(0)
  })

  it('keeps the same aging profile when a week is selected inside the window', () => {
    const page = openPage()
    const points = all(page, '.qaqc-aging-backlog .qaqc-hit')
    const before = vi.mocked(agingProfile).mock.calls.length
    click(points[points.length - 2])
    expect(page.getAttribute('aria-label')).toBe("Issue Aging · as of WW41'2026")
    expect(vi.mocked(agingProfile).mock.calls.length).toBe(before)
  })
})

describe('Issue Aging without closures', () => {
  function openWithoutClosures(): HTMLElement {
    return openPage({ index: noClosuresIndex() })
  }

  it('shows n/a for the typical close and the past-window count', () => {
    const page = openWithoutClosures()
    expect(cardText(page, 'Most issues close within')).toEqual(['n/a', 'Nothing closed yet'])
    expect(cardText(page, 'Past the normal close window')).toEqual(['n/a', 'No closures yet, so no window'])
  })

  it('makes the past-window card not clickable', () => {
    const page = openWithoutClosures()
    expect(page.querySelector('.qaqc-aging-card-button')).toBeNull()
  })

  it('draws no window band and neutral bars', () => {
    const page = openWithoutClosures()
    expect(page.querySelector('.qaqc-aging-band')).toBeNull()
    const fills = new Set(all(page, '.qaqc-aging-bar').map((node) => node.getAttribute('fill')))
    expect(fills).toEqual(new Set([THEME.colors.series1]))
  })

  it('says nothing has closed on the quarter chart', () => {
    const page = openWithoutClosures()
    const quarters = all(page, 'section.qaqc-panel').find((node) => node.getAttribute('aria-label') === 'Is closing getting faster or slower?')
    expect(quarters?.querySelector('.qaqc-chart-empty')?.textContent).toBe('Nothing closed yet')
  })
})

describe('Issue Aging footnotes', () => {
  it("repeats the dashboard's footnotes", () => {
    const page = openPage({ footnotes: ['5 issues not created by LotusWorks are excluded'] })
    expect(texts(page, '.qaqc-footnotes li')).toEqual(['5 issues not created by LotusWorks are excluded'])
  })

  it('notes closed issues without an Updated On', () => {
    const rows = ISSUE_ROWS.map((row) => (row[0] === '#1004' ? row.map((cell, at) => (at === 6 ? null : cell)) : row))
    const index: IssueIndex = agingIndex(rows)
    const page = openPage({ index })
    expect(texts(page, '.qaqc-footnotes li')).toEqual(['1 closed issue has no Updated On and is left out of close times'])
  })
})
