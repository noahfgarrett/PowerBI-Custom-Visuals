import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ChartColors } from '../chartTypes'
import { paretoTitle, RootCauseParetoPage, type RootCauseParetoPageProps } from '../components/RootCauseParetoPage'
import { buildIssueIndex } from '../issues'
import type { IssueColumns, IssueIndex, ViewState } from '../types'
import { ISSUE_ROWS } from './fixtures/issueRows'
import { render, type Rendered } from './render'

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
const WW42 = 202642
const ALL: ViewState = { selectedKey: WW42, windowEndKey: WW42, range: 'all' }
const RECENT: ViewState = { selectedKey: WW42, windowEndKey: WW42, range: 'recent' }
const INDEX = buildIssueIndex(ISSUE_ROWS, COLUMNS, TODAY)

const COLORS: ChartColors = {
  series1: '#2E5AAC',
  series2: '#86B6EF',
  series3: '#1A9C7B',
  good: '#0A7A0A',
  bad: '#D03B3B',
  warn: '#B45309',
  card: '#FDFEFF',
  grid: '#EBEEF3',
  axisText: '#636E7C',
  ink: '#1B2530',
  accent: '#2E5AAC',
}

let view: Rendered | null = null

afterEach(() => {
  view?.unmount()
  view = null
  vi.restoreAllMocks()
})

function stubSize(width = 900, height = 330): void {
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

function draw(overrides: Partial<RootCauseParetoPageProps> = {}): Rendered {
  stubSize()
  return render(
    <RootCauseParetoPage
      index={INDEX}
      view={ALL}
      weekOptions={INDEX.weeks.map((week) => week.week).reverse()}
      colors={COLORS}
      isHighContrast={false}
      onPickWeek={vi.fn()}
      onRangeChange={vi.fn()}
      onHover={vi.fn()}
      {...overrides}
    />,
  )
}

function click(target: Element): void {
  act(() => {
    target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

function press(target: Element, key: string): void {
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  })
}

function button(container: HTMLElement, text: string): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')].find((item) => item.textContent === text)
  if (!(found instanceof HTMLButtonElement)) throw new Error(`button ${text} missing`)
  return found
}

/** Each bar's axis label, its lines joined with spaces. */
function axisLabels(container: HTMLElement): string[] {
  const byX = new Map<string, string[]>()
  for (const node of container.querySelectorAll('.qaqc-pareto-axis-label')) {
    const x = node.getAttribute('x') ?? ''
    byX.set(x, [...(byX.get(x) ?? []), node.textContent ?? ''])
  }
  return [...byX.values()].map((lines) => lines.join(' '))
}

function clickBar(container: HTMLElement, label: string): void {
  const at = axisLabels(container).findIndex((text) => text.replace(/\/ /g, '/') === label)
  const hit = container.querySelectorAll('.qaqc-pareto-chart .qaqc-hit')[at]
  if (!hit) throw new Error(`bar ${label} missing`)
  click(hit)
}

function drill(container: HTMLElement): HTMLElement {
  const section = container.querySelector<HTMLElement>('section.qaqc-pareto-table')
  if (!section) throw new Error('drill-down table missing')
  return section
}

function drillHeading(container: HTMLElement): string[] {
  const section = drill(container)
  return [
    section.querySelector('h3')?.textContent ?? '',
    section.querySelector('.qaqc-pareto-chip')?.textContent ?? '',
    section.querySelector('.qaqc-pareto-table-note')?.textContent ?? '',
  ]
}

function drillRows(container: HTMLElement): string[][] {
  return [...drill(container).querySelectorAll('tbody tr[aria-rowindex]')].map((row) => [...row.children].map((cell) => cell.textContent ?? ''))
}

function sortBy(container: HTMLElement, name: string): void {
  const header = [...drill(container).querySelectorAll('thead th')].find((cell) => cell.textContent === name)
  const sortButton = header?.querySelector('button')
  if (!sortButton) throw new Error(`header ${name} missing`)
  click(sortButton)
}

function chartNote(container: HTMLElement): string {
  return container.querySelector('.qaqc-pareto-chart-note')?.textContent ?? ''
}

describe('paretoTitle', () => {
  it("names the period from the window's first week to the selected week", () => {
    expect(paretoTitle(INDEX, ALL)).toBe("Issues by Root Cause Pareto · WW46'2024 to WW42'2026")
  })

  it('follows the 30 WW window', () => {
    expect(paretoTitle(INDEX, RECENT)).toBe("Issues by Root Cause Pareto · WW13'2026 to WW42'2026")
  })
})

describe('RootCauseParetoPage, All issues', () => {
  it('counts the issues and distinct causes in the chart title bar', () => {
    view = draw()
    expect(chartNote(view.container)).toBe('177 issues · 27 distinct causes')
  })

  it('draws the top 9 causes and Other, Installation first at 48', () => {
    view = draw()
    expect(axisLabels(view.container)[0]).toBe('Installation')
    expect(axisLabels(view.container)).toHaveLength(10)
    const counts = [...view.container.querySelectorAll('.qaqc-pareto-value.qaqc-bar-value')].map((node) => node.textContent)
    expect(counts[0]).toBe('48')
  })

  it('selects the top bar by default and lists its issues, open first', () => {
    view = draw()
    expect(view.container.querySelector('.qaqc-pareto-bar.is-selected')?.getAttribute('data-key')).toBe(
      view.container.querySelector('.qaqc-pareto-bar')?.getAttribute('data-key'),
    )
    expect(drillHeading(view.container)).toEqual(['Installation', '48 issues', '18 open · 30 closed · open first, oldest first · click a bar to switch'])
  })

  it('shows the read-out', () => {
    view = draw()
    const readout = view.container.querySelector('.qaqc-pareto-readout')
    expect([...(readout?.querySelectorAll('p') ?? [])].map((line) => line.textContent)).toEqual([
      'The top 9 causes cover 79.1%; 80% is reached only inside Other.',
      'Installation is 48 of 177 (27.1%).',
    ])
  })

  it('shows the Root Cause Category panel with the category split', () => {
    view = draw()
    const panel = view.container.querySelector('section.qaqc-pareto-side')
    expect(panel?.querySelector('.qaqc-pareto-side-note')?.textContent).toBe("177 issues · WW46'2024 to WW42'2026")
    expect([...(panel?.querySelectorAll('.qaqc-pareto-categories li span') ?? [])].map((node) => node.textContent)).toEqual([
      'Quality',
      'Design',
      'Coordination',
      'Safety',
    ])
    expect(panel?.querySelector('.qaqc-pareto-other h4')?.textContent).toBe('Inside Other (18 causes)')
  })
})

describe('RootCauseParetoPage, Open only', () => {
  it('recounts the open issues as of the selected week', () => {
    view = draw()
    click(button(view.container, 'Open only'))
    expect(chartNote(view.container)).toBe("51 open as of WW42'2026 · 18 distinct causes")
    expect(view.container.querySelector('.qaqc-pareto-side-note')?.textContent).toBe("51 open issues · WW46'2024 to WW42'2026")
  })

  it('reaches 80% at Incomplete Work, so the bars after it are muted', () => {
    view = draw()
    click(button(view.container, 'Open only'))
    const vital = view.container.querySelectorAll('.qaqc-pareto-bar.is-vital')
    expect(vital).toHaveLength(9)
    expect(axisLabels(view.container)[8]).toBe('Incomplete Work')
    expect(view.container.querySelectorAll('.qaqc-pareto-bar.is-beyond')).toHaveLength(1)
    const lineLabels = [...view.container.querySelectorAll('.qaqc-pareto-value.qaqc-end-label')].map((node) => node.textContent)
    expect(lineLabels).toEqual(['82.4% · 80% reached', '100.0%'])
  })

  it('marks Open only as the pressed scope', () => {
    view = draw()
    click(button(view.container, 'Open only'))
    expect(button(view.container, 'Open only').getAttribute('aria-pressed')).toBe('true')
    expect(button(view.container, 'All issues').getAttribute('aria-pressed')).toBe('false')
  })
})

describe('RootCauseParetoPage selection', () => {
  it('follows a bar click in the drill-down table', () => {
    view = draw()
    clickBar(view.container, 'Coordination')
    expect(drillHeading(view.container).slice(0, 2)).toEqual(['Coordination', '21 issues'])
    expect(axisLabels(view.container)[1]).toBe('Coordination')
    expect(view.container.querySelectorAll('.qaqc-pareto-axis-label.is-selected')[0]?.textContent).toBe('Coordination')
  })

  it('follows the keyboard: arrows move, Enter selects', () => {
    view = draw()
    const chart = view.container.querySelector('svg.qaqc-pareto-chart')
    if (!chart) throw new Error('chart missing')
    act(() => {
      if (chart instanceof SVGElement) chart.focus()
    })
    press(chart, 'ArrowRight')
    press(chart, 'ArrowRight')
    press(chart, 'Enter')
    expect(drillHeading(view.container)[0]).toBe('Casting/Pouring/Erection')
  })

  it('keeps the selected cause when it is still a bar after the scope changes', () => {
    view = draw()
    clickBar(view.container, 'Coordination')
    click(button(view.container, 'Open only'))
    expect(drillHeading(view.container).slice(0, 2)).toEqual(['Coordination', '6 issues'])
  })

  it('goes back to the top bar when the selected cause folds into Other', () => {
    view = draw()
    clickBar(view.container, 'Documentation Incomplete')
    expect(drillHeading(view.container)[0]).toBe('Documentation Incomplete')
    click(button(view.container, 'Open only'))
    expect(drillHeading(view.container).slice(0, 2)).toEqual(['Installation', '18 issues'])
  })

  it('goes back to the top bar when the period changes and the cause is gone', () => {
    view = draw()
    clickBar(view.container, 'Documentation Incomplete')
    const element = (
      <RootCauseParetoPage
        index={INDEX}
        view={{ selectedKey: 202530, windowEndKey: 202530, range: 'recent' }}
        weekOptions={[]}
        colors={COLORS}
        isHighContrast={false}
        onPickWeek={vi.fn()}
        onRangeChange={vi.fn()}
        onHover={vi.fn()}
      />
    )
    view.rerender(element)
    const first = axisLabels(view.container)[0]
    expect(drillHeading(view.container)[0]).toBe(first)
    expect(axisLabels(view.container)).not.toContain('Documentation Incomplete')
  })
})

describe('RootCauseParetoPage drill-down table', () => {
  it('has the six columns', () => {
    view = draw()
    expect([...drill(view.container).querySelectorAll('thead th')].map((cell) => cell.textContent)).toEqual([
      'ID',
      'Title',
      'Status',
      'Contractor',
      'Created On',
      'Age / To close',
    ])
  })

  it('lists open issues oldest first with their age, and closed issues with their time to close', () => {
    view = draw()
    const rows = drillRows(view.container)
    expect(rows[0][0]).toBe('#815')
    expect(rows[0][5]).toBe('380 d old')
    expect(rows[0][4]).toMatch(/^\d\d\/\d\d\/\d\d$/)
    expect(drill(view.container).querySelector('tbody .qaqc-status-pill')).not.toBeNull()
  })

  it('windows the rows', () => {
    view = draw()
    const table = drill(view.container).querySelector('table')
    expect(table?.getAttribute('aria-rowcount')).toBe('49')
    expect(drillRows(view.container).length).toBeLessThan(48)
  })

  it('sorts by any column, starting the day counts largest first', () => {
    view = draw()
    sortBy(view.container, 'Age / To close')
    sortBy(view.container, 'Age / To close')
    expect(drillRows(view.container)[0].slice(0, 1)).toEqual(['#925'])
    expect(drillRows(view.container)[0][5]).toBe('2 d to close')
    expect(drill(view.container).querySelector('.qaqc-pareto-table-note')?.textContent).toContain('sorted by Age / To close')
  })

  it('sorts IDs numerically', () => {
    view = draw()
    sortBy(view.container, 'ID')
    expect(drillRows(view.container)[0][0]).toBe('#472')
  })

  it('starts unsorted again for another bar', () => {
    view = draw()
    sortBy(view.container, 'ID')
    clickBar(view.container, 'Coordination')
    expect(drill(view.container).querySelector('thead th[aria-sort]')).toBeNull()
  })
})

describe('RootCauseParetoPage without categories or issues', () => {
  function indexWithout(column: 'rootCauseCategory'): IssueIndex {
    return buildIssueIndex(ISSUE_ROWS, { ...COLUMNS, [column]: -1 }, TODAY)
  }

  it('hides the category panel and shows the read-out under the chart when Root Cause Category is unbound', () => {
    view = draw({ index: indexWithout('rootCauseCategory') })
    expect(view.container.querySelector('section.qaqc-pareto-side')).toBeNull()
    expect(view.container.querySelector('.qaqc-pareto-chart-panel .qaqc-pareto-readout')?.textContent).toContain('Installation is 48 of 177')
  })

  it('says so when no issue is open in the period', () => {
    const closedOnly = buildIssueIndex(
      [['#1', 'Closed issue', 'Closed', 'COR', 'Bayside', '2026-09-01', '2026-09-10', null, 'LotusWorks', 'Bonding', 'Quality']],
      COLUMNS,
      TODAY,
    )
    view = draw({ index: closedOnly, view: { selectedKey: WW42, windowEndKey: WW42, range: 'recent' } })
    click(button(view.container, 'Open only'))
    expect(view.container.querySelector('.qaqc-pareto-chart-panel .qaqc-chart-empty')?.textContent).toBe('No open issues in this period')
    expect(view.container.querySelector('section.qaqc-pareto-table')).toBeNull()
    expect(view.container.querySelector('.qaqc-pareto-readout')).toBeNull()
  })
})
