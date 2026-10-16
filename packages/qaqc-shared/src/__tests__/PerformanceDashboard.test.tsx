import { Users } from 'lucide-react'
import { act, type ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { splitCombinedRows } from '../combined'
import { PerformanceDashboard, type PerformanceDashboardProps } from '../components/PerformanceDashboard'
import { buildPerformanceIndex, buildPerformanceModel, type PerformanceIndex } from '../performance'
import { resolveTheme } from '../theme'
import type { CombinedColumns } from '../types'
import { COMBINED_COLUMNS, COMBINED_ROWS } from './fixtures/combinedRows'
import { render, type Rendered } from './render'
import { ruleBody } from './stylesheet'

const modelBuilds = vi.hoisted(() => ({ count: 0 }))

// Passes through to the real model builder, counting calls, so tests can show when the ranking is rebuilt.
vi.mock('../performance', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../performance')>()
  return {
    ...actual,
    buildPerformanceModel: (...args: Parameters<typeof actual.buildPerformanceModel>) => {
      modelBuilds.count += 1
      return actual.buildPerformanceModel(...args)
    },
  }
})

type CombinedColumnName = (typeof COMBINED_COLUMNS)[number]

function position(name: CombinedColumnName): number {
  return COMBINED_COLUMNS.indexOf(name)
}

const COLUMNS: CombinedColumns = {
  source: position('Source'),
  workWeek: position('Work Week'),
  phase: position('Inspection Phase'),
  issue: position('Issue'),
  building: position('Building'),
  qcr: position('QCR/FE'),
  welder: position('Welder'),
  tagNo: position('Tag No'),
  signature: -1,
  signedWeek: -1,
  id: -1,
  status: -1,
  type: -1,
  createdOn: -1,
  updatedOn: -1,
  createdBy: -1,
  greenTags: -1,
}
const TODAY = new Date(2026, 9, 15) // WW42'2026
const CURRENT = 202642
const INDEX = buildPerformanceIndex(splitCombinedRows(COMBINED_ROWS, COLUMNS.source), COLUMNS, TODAY)
const THEME = resolveTheme({ preset: 'qaqc', backgroundColor: '', backgroundOpacity: 100, cardOpacity: 100, highContrast: null })

let view: Rendered | null = null

afterEach(() => {
  view?.unmount()
  view = null
  vi.restoreAllMocks()
})

function dashboardElement(overrides: Partial<PerformanceDashboardProps> = {}): ReactElement {
  return (
    <PerformanceDashboard
      title="QAQC Performance"
      icon={Users}
      index={INDEX}
      minimumFinals={5}
      minimumWelds={10}
      theme={THEME}
      interactive
      animate={false}
      describeCharts
      loading={false}
      rowLimitReached={false}
      viewport={{ width: 1340, height: 790 }}
      onHover={vi.fn()}
      {...overrides}
    />
  )
}

function draw(overrides: Partial<PerformanceDashboardProps> = {}): Rendered {
  return render(dashboardElement(overrides))
}

function indexOf(rows: ReadonlyArray<ReadonlyArray<string | number | null>>): PerformanceIndex {
  return buildPerformanceIndex(splitCombinedRows(rows, COLUMNS.source), COLUMNS, TODAY)
}

function click(target: Element | null): void {
  if (!target) throw new Error('click target missing')
  act(() => {
    target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

function pressEscape(target: Element | null): void {
  if (!target) throw new Error('Esc target missing')
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  })
}

function toggleButton(container: HTMLElement, groupLabel: string, label: string): HTMLButtonElement {
  const button = [...container.querySelectorAll<HTMLButtonElement>(`.qaqc-header [aria-label="${groupLabel}"] button`)]
    .find((node) => node.textContent === label)
  if (!button) throw new Error(`${label} button missing`)
  return button
}

function showGroup(container: HTMLElement, label: 'QCR / FE' | 'Welders'): void {
  click(toggleButton(container, 'People group', label))
}

function showRange(container: HTMLElement, label: '30 WW' | 'All'): void {
  click(toggleButton(container, 'Ranking period', label))
}

// Matches labels in code: jsdom's selector engine mishandles "÷" and "%" inside attribute values.
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

function cardLabels(container: HTMLElement): string[] {
  return [...container.querySelectorAll('.qaqc-root article.qaqc-kpi .qaqc-kpi-label')].map((node) => node.textContent ?? '')
}

function summaryValues(container: HTMLElement): Array<string | null> {
  return [...container.querySelectorAll('.qaqc-root .qaqc-perf-summary .qaqc-kpi-value')].map((node) => node.textContent)
}

function summaryHead(container: HTMLElement): [string | null, string | null] {
  const head = container.querySelector('.qaqc-root .qaqc-perf-summary .qaqc-kpi-group-head')
  return [head?.querySelector('span')?.textContent ?? null, head?.querySelector('em')?.textContent ?? null]
}

/** Names of the ranked rows, in display order. */
function rankedNames(container: HTMLElement): string[] {
  return [...container.querySelectorAll('.qaqc-root tr.qaqc-perf-row:not(.is-below):not(.is-not-recorded) .qaqc-perf-name')]
    .map((node) => node.textContent ?? '')
}

function rowNamed(container: HTMLElement, name: string): HTMLTableRowElement {
  const row = [...container.querySelectorAll<HTMLTableRowElement>('.qaqc-root tr.qaqc-perf-row')]
    .find((node) => node.querySelector('.qaqc-perf-name')?.textContent === name)
  if (!row) throw new Error(`row ${name} missing`)
  return row
}

function nameButton(container: HTMLElement, name: string): HTMLButtonElement {
  const button = rowNamed(container, name).querySelector<HTMLButtonElement>('button.qaqc-perf-name')
  if (!button) throw new Error(`name button ${name} missing`)
  return button
}

function disclosure(container: HTMLElement): HTMLButtonElement | null {
  return container.querySelector<HTMLButtonElement>('.qaqc-root .qaqc-perf-disclosure-row button')
}

function dialog(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>('.qaqc-frame > [role="dialog"]')
}

function footnotes(container: HTMLElement): string[] {
  return [...container.querySelectorAll('.qaqc-footnotes li')].map((item) => item.textContent ?? '')
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

describe('PerformanceDashboard header', () => {
  it('shows the title and icon it is given', () => {
    view = draw()
    expect(view.container.querySelector('h2')?.textContent).toBe('QAQC Performance')
    expect(view.container.querySelector('.qaqc-title-icon svg.lucide-users')).not.toBeNull()
  })

  it('puts the group switch before the range toggle and week picker', () => {
    view = draw()
    const controls = view.container.querySelector('.qaqc-controls')
    const order = [...(controls?.children ?? [])].map((node) => node.getAttribute('aria-label') ?? node.className)
    expect(order).toEqual(['People group', 'Ranking period', 'qaqc-week-picker'])
  })

  it('starts on QCR / FE', () => {
    view = draw()
    expect(toggleButton(view.container, 'People group', 'QCR / FE').getAttribute('aria-pressed')).toBe('true')
    expect(toggleButton(view.container, 'People group', 'Welders').getAttribute('aria-pressed')).toBe('false')
  })

  it('switches to Welders', () => {
    view = draw()
    showGroup(view.container, 'Welders')
    expect(toggleButton(view.container, 'People group', 'Welders').getAttribute('aria-pressed')).toBe('true')
    expect(view.container.querySelector('.qaqc-perf-table caption')?.textContent).toBe('Welder NCR performance')
  })

  it('draws the group switch like the range toggle', () => {
    view = draw()
    expect(view.container.querySelector('[aria-label="People group"]')?.classList.contains('qaqc-segmented')).toBe(true)
  })

  it('disables the controls when interactions are not allowed', () => {
    view = draw({ interactive: false })
    expect(toggleButton(view.container, 'People group', 'Welders').disabled).toBe(true)
    expect(view.container.querySelector('select')?.disabled).toBe(true)
  })
})

describe('PerformanceDashboard ranking', () => {
  it('ranks the 30 WW QCR/FEs by NCR rate, then NCRs, then name', () => {
    view = draw()
    expect(rankedNames(view.container)).toEqual(['QCR 02', 'QCR 01', 'QCR 04', 'QCR 05', 'QCR 06', 'QCR 07'])
  })

  it('ranks QCR 03 too over All', () => {
    view = draw()
    showRange(view.container, 'All')
    expect(rankedNames(view.container)).toEqual(['QCR 02', 'QCR 01', 'QCR 03', 'QCR 04', 'QCR 05', 'QCR 06', 'QCR 07'])
  })

  it('collapses the ten people below the minimum', () => {
    view = draw()
    expect(disclosure(view.container)?.textContent).toBe('Below minimum (10 people)')
    expect(disclosure(view.container)?.getAttribute('aria-expanded')).toBe('false')
  })

  it('ranks the 30 WW welders, Welder 024 first', () => {
    view = draw()
    showGroup(view.container, 'Welders')
    expect(rankedNames(view.container).slice(0, 3)).toEqual(['Welder 024', 'Welder 028', 'Welder 043'])
  })

  it('ranks fewer QCR/FEs with a higher minimum finals', () => {
    view = draw({ minimumFinals: 60 })
    expect(rankedNames(view.container)).toEqual(['QCR 02', 'QCR 01'])
    expect(cardValue(view.container, 'QCR/FE ranked')).toBe('2')
  })

  it('ranks fewer welders with a higher minimum welds', () => {
    const expected = buildPerformanceModel(INDEX, { selectedKey: CURRENT, windowEndKey: CURRENT, range: 'recent' }, 'welders', 100)
    view = draw({ minimumWelds: 100 })
    showGroup(view.container, 'Welders')
    expect(expected.ranked.length).toBeLessThan(38)
    expect(cardValue(view.container, 'Welders ranked')).toBe(String(expected.ranked.length))
    expect(rankedNames(view.container)).toEqual(expected.ranked.map((row) => row.name))
  })

  it('keeps the welder minimum out of the QCR/FE ranking', () => {
    view = draw({ minimumWelds: 100 })
    expect(cardValue(view.container, 'QCR/FE ranked')).toBe('6')
  })

  it('collapses the below-minimum group when the group changes', () => {
    // A high welder minimum keeps the welders' disclosure row among the rows jsdom renders.
    view = draw({ minimumWelds: 150 })
    click(disclosure(view.container))
    expect(disclosure(view.container)?.getAttribute('aria-expanded')).toBe('true')
    showGroup(view.container, 'Welders')
    expect(disclosure(view.container)?.getAttribute('aria-expanded')).toBe('false')
    showGroup(view.container, 'QCR / FE')
    expect(disclosure(view.container)?.getAttribute('aria-expanded')).toBe('false')
  })
})

describe('PerformanceDashboard summary strip', () => {
  it('labels the QCR/FE cards', () => {
    view = draw()
    expect(cardLabels(view.container)).toEqual(['QCR/FE ranked', 'Finals', 'NCRs', 'NCR rate'])
  })

  it('labels the welder cards', () => {
    view = draw()
    showGroup(view.container, 'Welders')
    expect(cardLabels(view.container)).toEqual(['Welders ranked', 'Welds', 'NCRs', 'NCR rate'])
  })

  it('shows the 30 WW QCR/FE totals for the whole group', () => {
    view = draw()
    expect(summaryValues(view.container)).toEqual(['6', '221', '2', '0.90%'])
    expect(summaryHead(view.container)).toEqual(['QCR / FE', "WW13'2026 to WW42'2026"])
  })

  it('shows the All QCR/FE totals', () => {
    view = draw()
    showRange(view.container, 'All')
    expect(summaryValues(view.container)).toEqual(['7', '282', '3', '1.06%'])
    expect(summaryHead(view.container)).toEqual(['QCR / FE', "WW51'2025 to WW42'2026"])
  })

  it('shows the 30 WW welder totals', () => {
    view = draw()
    showGroup(view.container, 'Welders')
    expect(summaryValues(view.container)).toEqual(['38', '1,570', '11', '0.70%'])
    expect(summaryHead(view.container)[0]).toBe('Welders')
  })

  it('shows the All welder totals', () => {
    view = draw()
    showGroup(view.container, 'Welders')
    showRange(view.container, 'All')
    expect(summaryValues(view.container)).toEqual(['45', '1,751', '11', '0.63%'])
  })

  it('names the minimum and the people below it', () => {
    view = draw()
    expect(cardDetail(view.container, 'QCR/FE ranked')).toBe('Minimum 5 finals · 10 below')
    showGroup(view.container, 'Welders')
    expect(cardDetail(view.container, 'Welders ranked')).toBe('Minimum 10 welds · 27 below')
  })

  it('says the totals cover the whole group', () => {
    view = draw()
    expect(cardDetail(view.container, 'Finals')).toBe('Whole group, incl. unranked')
    expect(cardDetail(view.container, 'NCR rate')).toBe('NCRs ÷ finals')
    showGroup(view.container, 'Welders')
    expect(cardDetail(view.container, 'Welds')).toBe('Whole group, incl. unranked')
    expect(cardDetail(view.container, 'NCR rate')).toBe('NCRs ÷ welds')
  })

  it('moves the period with the week picker', () => {
    view = draw()
    const select = view.container.querySelector('select')
    if (!select) throw new Error('week picker missing')
    act(() => {
      select.value = '202630'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(summaryHead(view.container)[1]).toBe("WW01'2026 to WW30'2026")
  })
})

describe('PerformanceDashboard person page', () => {
  it('opens a person from their name, titled with the name, group and discipline', () => {
    stubSize()
    view = draw()
    click(nameButton(view.container, 'QCR 02'))
    expect(dialog(view.container)?.getAttribute('aria-label')).toBe('QCR 02 · QCR / FE · Electrical')
    expect(dialog(view.container)?.querySelector('h3')?.textContent).toBe('QCR 02 · QCR / FE · Electrical')
    expect(dialog(view.container)?.querySelector('.qaqc-perf-person')).not.toBeNull()
  })

  it('titles a welder page with the welder group', () => {
    stubSize()
    view = draw()
    showGroup(view.container, 'Welders')
    click(nameButton(view.container, 'Welder 024'))
    expect(dialog(view.container)?.getAttribute('aria-label')).toBe('Welder 024 · Welder')
  })

  it('opens a person from another cell of their row', () => {
    stubSize()
    view = draw()
    click(rowNamed(view.container, 'QCR 01').cells[2])
    expect(dialog(view.container)?.getAttribute('aria-label')).toBe('QCR 01 · QCR / FE · Electrical')
  })

  it('names a Mechanical QCR/FE\'s discipline in the title', () => {
    stubSize()
    view = draw()
    click(nameButton(view.container, 'QCR 05'))
    expect(dialog(view.container)?.getAttribute('aria-label')).toBe('QCR 05 · QCR / FE · Mechanical')
  })

  it('falls back to the person\'s all-time disciplines when the period row has none', () => {
    const index = indexOf(COMBINED_ROWS)
    const person = index.qcr.find((candidate) => candidate.name === 'QCR 02')
    if (!person || !person.tagsByWeek) throw new Error('QCR 02 missing')
    person.tagsByWeek.fill(0)
    stubSize()
    view = draw({ index })
    click(nameButton(view.container, 'QCR 02'))
    expect(dialog(view.container)?.getAttribute('aria-label')).toBe('QCR 02 · QCR / FE · Electrical')
  })

  it('shows the person\'s period cards on the page', () => {
    stubSize()
    view = draw()
    click(nameButton(view.container, 'QCR 02'))
    const values = [...(dialog(view.container)?.querySelectorAll('.qaqc-kpi-group.is-week .qaqc-kpi-value') ?? [])].map((node) => node.textContent)
    expect(values).toEqual(['65', '2', '3.08%'])
  })

  it('names the person chart with its weeks when chart summaries are on', () => {
    stubSize()
    view = draw()
    click(nameButton(view.container, 'QCR 02'))
    expect(dialog(view.container)?.querySelector('.qaqc-perf-chart')?.getAttribute('aria-label')).toBe(
      "Finals and NCRs by work week, with the running NCR rate, WW13'2026 to WW42'2026",
    )
  })

  it('names the person chart by its title alone when chart summaries are off', () => {
    stubSize()
    view = draw({ describeCharts: false })
    click(nameButton(view.container, 'QCR 02'))
    expect(dialog(view.container)?.querySelector('.qaqc-perf-chart')?.getAttribute('aria-label')).toBe(
      'Finals and NCRs by work week, with the running NCR rate',
    )
  })

  it('neither rebuilds nor re-sorts the table when a person opens and closes', () => {
    view = draw()
    click(view.container.querySelector('.qaqc-perf-table thead th:nth-child(2) button'))
    const sortedNames = rankedNames(view.container)
    const row = rowNamed(view.container, 'QCR 04')
    const builds = modelBuilds.count
    click(nameButton(view.container, 'QCR 04'))
    click(dialog(view.container)?.querySelector('button[aria-label="Back to dashboard"]') ?? null)
    expect(modelBuilds.count).toBe(builds)
    expect(rankedNames(view.container)).toEqual(sortedNames)
    expect(view.container.querySelector('.qaqc-perf-table thead th:nth-child(2)')?.getAttribute('aria-sort')).toBe('descending')
    expect(rowNamed(view.container, 'QCR 04')).toBe(row)
  })

  it('makes the dashboard behind the page inert', () => {
    view = draw()
    click(nameButton(view.container, 'QCR 02'))
    expect(view.container.querySelector('.qaqc-root')?.hasAttribute('inert')).toBe(true)
  })

  it('closes with Back and returns focus to the person\'s name', () => {
    view = draw()
    click(nameButton(view.container, 'QCR 04'))
    click(dialog(view.container)?.querySelector('button[aria-label="Back to dashboard"]') ?? null)
    expect(dialog(view.container)).toBeNull()
    expect(document.activeElement).toBe(nameButton(view.container, 'QCR 04'))
  })

  it('closes on Esc and returns focus to the person\'s name', () => {
    view = draw()
    click(rowNamed(view.container, 'QCR 05').cells[1])
    pressEscape(dialog(view.container))
    expect(dialog(view.container)).toBeNull()
    expect(document.activeElement).toBe(nameButton(view.container, 'QCR 05'))
  })

  it('opens a below-minimum person', () => {
    stubSize()
    view = draw()
    click(disclosure(view.container))
    const below = view.container.querySelector('.qaqc-root tr.qaqc-perf-row.is-below .qaqc-perf-name')
    const name = below?.textContent ?? ''
    click(below)
    expect(dialog(view.container)?.getAttribute('aria-label')).toMatch(new RegExp(`^${name} · QCR / FE · (Electrical|Mechanical|Electrical and Mechanical)$`))
  })

  it('opens no page and shows plain names when interactions are not allowed', () => {
    view = draw({ interactive: false })
    const row = rowNamed(view.container, 'QCR 02')
    expect(row.querySelector('button.qaqc-perf-name')).toBeNull()
    click(row.cells[2])
    expect(dialog(view.container)).toBeNull()
  })
})

describe('PerformanceDashboard layout', () => {
  it('shows the summary strip over the ranking table', () => {
    view = draw()
    const root = view.container.querySelector('.qaqc-root')
    expect(root?.querySelector('.qaqc-perf-summary + .qaqc-perf-wrap')).not.toBeNull()
  })

  it('uses the compact layout on narrow tiles, table included', () => {
    view = draw({ viewport: { width: 800, height: 900 } })
    expect(view.container.querySelector('.qaqc-root.is-compact')).not.toBeNull()
    expect(view.container.querySelector('.qaqc-perf-table')).not.toBeNull()
  })

  it('keeps the table usable when a compact tile scrolls', () => {
    expect(ruleBody('.qaqc-root.is-compact .qaqc-perf-wrap')).toMatch(/min-height: \d+px;/)
  })

  it('shows only the four summary cards on a short tile', () => {
    view = draw({ viewport: { width: 1340, height: 400 } })
    expect(view.container.querySelector('.qaqc-root.is-cards-only')).not.toBeNull()
    expect(view.container.querySelector('.qaqc-perf-table')).toBeNull()
    expect(view.container.querySelectorAll('article.qaqc-kpi')).toHaveLength(4)
  })

  it('uses the compact cards-only layout on an 800 × 300 tile', () => {
    view = draw({ viewport: { width: 800, height: 300 } })
    const root = view.container.querySelector('.qaqc-root')
    expect(root?.classList.contains('is-cards-only')).toBe(true)
    expect(root?.classList.contains('is-compact')).toBe(true)
    expect(summaryValues(view.container)).toEqual(['6', '221', '2', '0.90%'])
  })

  it('shows the loading bar', () => {
    view = draw({ loading: true })
    expect(view.container.querySelector('[role="progressbar"]')).not.toBeNull()
  })

  it('says there is no activity in a period with no rows', () => {
    view = draw({ index: indexOf([]) })
    expect(view.container.querySelector('.qaqc-perf-table')).toBeNull()
    expect(view.container.querySelector('.qaqc-perf-empty-state strong')?.textContent).toBe("No finals or SORs in WW42'2026")
    expect(summaryValues(view.container)).toEqual(['0', '0', '0', 'n/a'])
  })

  it('says there are no welds when the welders have no rows in the period', () => {
    view = draw({ index: indexOf(COMBINED_ROWS.filter((row) => row[COLUMNS.source] !== 'Welding')) })
    showGroup(view.container, 'Welders')
    expect(view.container.querySelector('.qaqc-perf-empty-state strong')?.textContent).toBe("No welds in WW13'2026 to WW42'2026")
    expect(view.container.querySelector('.qaqc-perf-table')).toBeNull()
  })
})

describe('PerformanceDashboard footnotes', () => {
  it('notes the 30 WW inspections with no QCR/FE', () => {
    view = draw()
    expect(footnotes(view.container)).toEqual(['70 inspections have no QCR/FE'])
  })

  it('notes the All inspections with no QCR/FE', () => {
    view = draw()
    showRange(view.container, 'All')
    expect(footnotes(view.container)).toEqual(['132 inspections have no QCR/FE'])
  })

  it('notes the welds that credit several welders, by period', () => {
    view = draw()
    showGroup(view.container, 'Welders')
    expect(footnotes(view.container)).toEqual(['89 welds list more than one welder; each welder is credited'])
    showRange(view.container, 'All')
    expect(footnotes(view.container)).toEqual(['131 welds list more than one welder; each welder is credited'])
  })

  it('puts the row limit first', () => {
    view = draw({ rowLimitReached: true })
    expect(footnotes(view.container)).toEqual(['Showing the first 2,385 rows (Power BI data limit)', '70 inspections have no QCR/FE'])
  })
})

describe('PerformanceDashboard compact strip', () => {
  it('lays the four summary cards out two by two on compact tiles', () => {
    const body = ruleBody('.qaqc-root.is-compact .qaqc-perf-summary .qaqc-kpi-group-body')
    expect(body).toContain('grid-auto-flow: row;')
    expect(body).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));')
  })
})
