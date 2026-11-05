import { Users } from 'lucide-react'
import { act, type ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { splitCombinedRows } from '../combined'
import { PerformanceDashboard, type PerformanceDashboardProps } from '../components/PerformanceDashboard'
import { buildPerformanceIndex, buildPerformanceModel, isNotRecorded, type PerformanceIndex } from '../performance'
import { resolveTheme } from '../theme'
import type { CombinedColumns } from '../types'
import { buttonNamed, checkbox, chipTexts, choose, filterButton, openMenu, showing, toggleSection } from './filterHarness'
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
  rootCause: -1,
  greenTags: -1,
}
const TODAY = new Date(2026, 9, 15) // WW42'2026
const CURRENT = 202642
// Expected values are pinned to the seeded synthetic fixtures from scripts/generate-qaqc-fixtures.mjs.
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
      title="QCx Performance"
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
    expect(view.container.querySelector('h2')?.textContent).toBe('QCx Performance')
    expect(view.container.querySelector('.qaqc-title-icon svg.lucide-users')).not.toBeNull()
  })

  it('puts the group switch before the range toggle and week picker', () => {
    view = draw()
    const controls = view.container.querySelector('.qaqc-controls')
    const order = [...(controls?.children ?? [])].map((node) => node.getAttribute('aria-label') ?? node.className)
    expect(order).toEqual(['People group', 'qaqc-filter-anchor', 'Ranking period', 'qaqc-week-picker'])
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
  it('ranks the 30 WW QCR/FEs lowest NCR Pass Rate first, then NCRs, then name', () => {
    view = draw()
    expect(rankedNames(view.container)).toEqual(['QCR 05', 'QCR 04', 'QCR 03', 'QCR 02', 'QCR 01', 'QCR 06'])
  })

  it('ranks QCR 06 too over All, at a minimum of 6 finals', () => {
    // QCR 06 has 5 finals in 30 WW and 9 in All.
    view = draw({ minimumFinals: 6 })
    expect(rankedNames(view.container)).toEqual(['QCR 05', 'QCR 04', 'QCR 03', 'QCR 02', 'QCR 01'])
    showRange(view.container, 'All')
    expect(rankedNames(view.container)).toEqual(['QCR 05', 'QCR 04', 'QCR 02', 'QCR 03', 'QCR 01', 'QCR 06'])
  })

  it('collapses the nine people below the minimum', () => {
    view = draw()
    expect(disclosure(view.container)?.textContent).toBe('Below minimum (9 people)')
    expect(disclosure(view.container)?.getAttribute('aria-expanded')).toBe('false')
  })

  it('leaves out the people with only SORs', () => {
    // A minimum of 1 ranks everyone with a final; a 400 px tall table renders all fifteen rows.
    stubSize()
    view = draw({ minimumFinals: 1 })
    expect([...rankedNames(view.container)].sort()).toEqual([
      'QCR 01', 'QCR 02', 'QCR 03', 'QCR 04', 'QCR 05', 'QCR 06', 'QCR 07', 'QCR 08', 'QCR 10', 'QCR 11', 'QCR 12', 'QCR 13',
      'QCR 14', 'QCR 15', 'QCR 17',
    ])
    expect(disclosure(view.container)).toBeNull()
  })

  it('ranks the 30 WW welders, Welder 040 first', () => {
    view = draw()
    showGroup(view.container, 'Welders')
    expect(rankedNames(view.container).slice(0, 3)).toEqual(['Welder 040', 'Welder 047', 'Welder 048'])
  })

  it('ranks fewer QCR/FEs with a higher minimum finals', () => {
    view = draw({ minimumFinals: 30 })
    expect(rankedNames(view.container)).toEqual(['QCR 02', 'QCR 01'])
    expect(cardValue(view.container, 'QCR/FE ranked')).toBe('2')
  })

  it('ranks fewer welders with a higher minimum welds', () => {
    const expected = buildPerformanceModel(INDEX, { selectedKey: CURRENT, windowEndKey: CURRENT, range: 'recent', dateRange: null }, 'welders', 100)
    view = draw({ minimumWelds: 100 })
    showGroup(view.container, 'Welders')
    expect(expected.ranked.length).toBeLessThan(61)
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
    expect(cardLabels(view.container)).toEqual(['QCR/FE ranked', 'Finals', 'NCRs', 'NCR Pass Rate'])
  })

  it('labels the welder cards', () => {
    view = draw()
    showGroup(view.container, 'Welders')
    expect(cardLabels(view.container)).toEqual(['Welders ranked', 'Welds', 'NCRs', 'NCR Pass Rate'])
  })

  it('shows the 30 WW QCR/FE totals for the whole group', () => {
    view = draw()
    expect(summaryValues(view.container)).toEqual(['6', '214', '7', '96.73%'])
    expect(summaryHead(view.container)).toEqual(['QCR / FE', "WW13'2026 to WW42'2026"])
  })

  it('shows the All QCR/FE totals', () => {
    view = draw()
    showRange(view.container, 'All')
    expect(summaryValues(view.container)).toEqual(['6', '282', '12', '95.74%'])
    expect(summaryHead(view.container)).toEqual(['QCR / FE', "WW51'2025 to WW42'2026"])
  })

  it('shows the 30 WW welder totals', () => {
    view = draw()
    showGroup(view.container, 'Welders')
    expect(summaryValues(view.container)).toEqual(['61', '1,423', '8', '99.44%'])
    expect(summaryHead(view.container)[0]).toBe('Welders')
  })

  it('shows the All welder totals', () => {
    view = draw()
    showGroup(view.container, 'Welders')
    showRange(view.container, 'All')
    expect(summaryValues(view.container)).toEqual(['61', '1,751', '11', '99.37%'])
  })

  it('names the minimum and the people below it', () => {
    view = draw()
    expect(cardDetail(view.container, 'QCR/FE ranked')).toBe('Minimum 5 finals · 9 below')
    showGroup(view.container, 'Welders')
    expect(cardDetail(view.container, 'Welders ranked')).toBe('Minimum 10 welds · 1 below')
  })

  it('says the totals cover the whole group', () => {
    view = draw()
    expect(cardDetail(view.container, 'Finals')).toBe('Whole group, incl. unranked')
    showGroup(view.container, 'Welders')
    expect(cardDetail(view.container, 'Welds')).toBe('Whole group, incl. unranked')
  })

  it('shows the group NCR Pass Rate with no small print', () => {
    view = draw()
    const qcrCard = card(view.container, 'NCR Pass Rate')
    expect(qcrCard?.querySelector('.qaqc-kpi-value')?.textContent).toBe('96.73%')
    expect(qcrCard?.querySelector('.qaqc-kpi-detail')).toBeNull()
    expect(qcrCard?.getAttribute('aria-label')).toBe('NCR Pass Rate: 96.73%')
    showGroup(view.container, 'Welders')
    const welderCard = card(view.container, 'NCR Pass Rate')
    expect(welderCard?.querySelector('.qaqc-kpi-value')?.textContent).toBe('99.44%')
    expect(welderCard?.querySelector('.qaqc-kpi-detail')).toBeNull()
    expect(welderCard?.getAttribute('aria-label')).toBe('NCR Pass Rate: 99.44%')
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


/** The shading class of the card group with this title: is-week, is-period or is-toDate. */
function groupShading(scope: Element | null | undefined, title: string): string[] {
  const group = [...(scope?.querySelectorAll('section.qaqc-kpi-group') ?? [])].find((node) => node.getAttribute('aria-label') === title)
  if (!group) throw new Error(`${title} group missing`)
  return [...group.classList].filter((name) => name.startsWith('is-'))
}

describe('PerformanceDashboard card shading', () => {
  it('keeps the period summary strip on the lighter card', () => {
    view = draw()
    expect(groupShading(view.container.querySelector('.qaqc-perf-summary'), 'QCR / FE')).toEqual(['is-period'])
  })

  it('draws the person page period on the lighter card and all time on the darker one', () => {
    stubSize()
    view = draw()
    click(nameButton(view.container, 'QCR 02'))
    expect(groupShading(dialog(view.container), 'This period')).toEqual(['is-period'])
    expect(groupShading(dialog(view.container), 'All time')).toEqual(['is-toDate'])
  })
})

describe('PerformanceDashboard person page', () => {
  it('opens a person from their name, titled with the name, group and discipline', () => {
    stubSize()
    view = draw()
    click(nameButton(view.container, 'QCR 05'))
    expect(dialog(view.container)?.getAttribute('aria-label')).toBe('QCR 05 · QCR / FE · Electrical')
    expect(dialog(view.container)?.querySelector('h3')?.textContent).toBe('QCR 05 · QCR / FE · Electrical')
    expect(dialog(view.container)?.querySelector('.qaqc-perf-person')).not.toBeNull()
  })

  it('titles a welder page with the welder group', () => {
    stubSize()
    view = draw()
    showGroup(view.container, 'Welders')
    click(nameButton(view.container, 'Welder 040'))
    expect(dialog(view.container)?.getAttribute('aria-label')).toBe('Welder 040 · Welder')
  })

  it('opens a person from another cell of their row', () => {
    stubSize()
    view = draw()
    click(rowNamed(view.container, 'QCR 01').cells[2])
    expect(dialog(view.container)?.getAttribute('aria-label')).toBe('QCR 01 · QCR / FE · Electrical and Mechanical')
  })

  it('names a Mechanical QCR/FE\'s discipline in the title', () => {
    // QCR 15's one 30 WW final is Mechanical, so QCR 15 is below the minimum.
    stubSize()
    view = draw()
    click(disclosure(view.container))
    click(nameButton(view.container, 'QCR 15'))
    expect(dialog(view.container)?.getAttribute('aria-label')).toBe('QCR 15 · QCR / FE · Mechanical')
  })

  it('falls back to the person\'s all-time disciplines when the period row has none', () => {
    const index = indexOf(COMBINED_ROWS)
    const person = index.qcr.find((candidate) => candidate.name === 'QCR 02')
    if (!person || !person.tagsByWeek) throw new Error('QCR 02 missing')
    person.tagsByWeek.fill(0)
    stubSize()
    view = draw({ index })
    click(nameButton(view.container, 'QCR 02'))
    expect(dialog(view.container)?.getAttribute('aria-label')).toBe('QCR 02 · QCR / FE · Electrical and Mechanical')
  })

  it('shows the person\'s period cards on the page', () => {
    stubSize()
    view = draw()
    click(nameButton(view.container, 'QCR 02'))
    const values = [...(dialog(view.container)?.querySelectorAll('.qaqc-kpi-group.is-period .qaqc-kpi-value') ?? [])].map((node) => node.textContent)
    expect(values).toEqual(['38', '1', '97.37%'])
  })

  it('names the person chart with its weeks when chart summaries are on', () => {
    stubSize()
    view = draw()
    click(nameButton(view.container, 'QCR 02'))
    expect(dialog(view.container)?.querySelector('.qaqc-perf-chart')?.getAttribute('aria-label')).toBe(
      "Finals and NCRs by work week, with the Running NCR Pass Rate, WW13'2026 to WW42'2026",
    )
  })

  it('names the person chart by its title alone when chart summaries are off', () => {
    stubSize()
    view = draw({ describeCharts: false })
    click(nameButton(view.container, 'QCR 02'))
    expect(dialog(view.container)?.querySelector('.qaqc-perf-chart')?.getAttribute('aria-label')).toBe(
      'Finals and NCRs by work week, with the Running NCR Pass Rate',
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
    expect(summaryValues(view.container)).toEqual(['6', '214', '7', '96.73%'])
  })

  it('shows the loading bar', () => {
    view = draw({ loading: true })
    expect(view.container.querySelector('[role="progressbar"]')).not.toBeNull()
  })

  it('says there is no activity in a period with no rows', () => {
    view = draw({ index: indexOf([]) })
    expect(view.container.querySelector('.qaqc-perf-table')).toBeNull()
    expect(view.container.querySelector('.qaqc-perf-empty-state strong')?.textContent).toBe("No finals in WW42'2026")
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
  it('has no QCR/FE note in 30 WW when every final has a QCR/FE', () => {
    // The fixture without its Electrical and Mechanical rows that have no QCR/FE.
    const recorded = COMBINED_ROWS.filter((row) => row[COLUMNS.source] === 'Welding' || row[COLUMNS.source] === 'BIM' || !isNotRecorded(row[COLUMNS.qcr]))
    view = draw({ index: indexOf(recorded) })
    expect(footnotes(view.container)).toEqual([])
  })

  it('notes the 30 WW and All finals with no QCR/FE', () => {
    view = draw()
    expect(footnotes(view.container)).toEqual(['66 finals have no QCR/FE'])
    showRange(view.container, 'All')
    expect(footnotes(view.container)).toEqual(['90 finals have no QCR/FE'])
  })

  it('notes the welds that credit several welders, by period', () => {
    view = draw()
    showGroup(view.container, 'Welders')
    expect(footnotes(view.container)).toEqual(['199 welds list more than one welder; each welder is credited'])
    showRange(view.container, 'All')
    expect(footnotes(view.container)).toEqual(['244 welds list more than one welder; each welder is credited'])
  })

  it('puts the row limit first', () => {
    view = draw({ rowLimitReached: true })
    expect(footnotes(view.container)).toEqual(['Showing the first 2,385 rows (Power BI data limit)', '66 finals have no QCR/FE'])
  })
})

describe('PerformanceDashboard compact strip', () => {
  it('lays the four summary cards out two by two on compact tiles', () => {
    const body = ruleBody('.qaqc-root.is-compact .qaqc-perf-summary .qaqc-kpi-group-body')
    expect(body).toContain('grid-auto-flow: row;')
    expect(body).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));')
  })
})

describe('PerformanceDashboard filters', () => {
  const BASE = COMBINED_COLUMNS.length
  const FILTER_COLUMNS: CombinedColumns = { ...COLUMNS, generalContractor: BASE, discipline: BASE + 1, pipeSpec: BASE + 2, fluidCode: BASE + 3 }
  const TAG_F631 = 'P4-F631XX001-1'
  const TAG_F632 = 'P4-F632XX001-1'

  interface RowValues {
    source?: 'Electrical' | 'Mechanical' | 'Welding'
    week: number
    phase?: string
    issue?: string
    building?: string
    qcr?: string
    welder?: string
    tag?: string
    contractor?: string
    discipline?: string
    pipeSpec?: string
    fluidCode?: string
  }

  function makeRow(values: RowValues): Array<string | null> {
    const row = new Array<string | null>(BASE + 4).fill(null)
    row[COLUMNS.source] = values.source ?? 'Electrical'
    row[COLUMNS.workWeek] = `WW${String(values.week).padStart(2, '0')}'2026`
    row[COLUMNS.phase] = values.phase ?? (values.source === 'Welding' ? null : 'Final')
    row[COLUMNS.issue] = values.issue ?? (values.source === 'Welding' ? 'No' : 'No Issue Found')
    row[COLUMNS.building] = values.building ?? null
    row[COLUMNS.qcr] = values.qcr ?? null
    row[COLUMNS.welder] = values.welder ?? null
    row[COLUMNS.tagNo] = values.tag ?? null
    row[BASE] = values.contractor ?? null
    row[BASE + 1] = values.discipline ?? null
    row[BASE + 2] = values.pipeSpec ?? null
    row[BASE + 3] = values.fluidCode ?? null
    return row
  }

  function repeat(count: number, values: RowValues, issues = 0): Array<Array<string | null>> {
    return Array.from({ length: count }, (_, item) => makeRow(item < issues ? { ...values, issue: values.source === 'Welding' ? `BIM ${item}` : `Defect ${values.week}.${item}` } : values))
  }

  const GREYFOX = { contractor: 'Greyfox', discipline: 'Electrical', building: 'F63.1' }
  const BAYSIDE = { contractor: 'Bayside', discipline: 'Controls', building: 'F63.2' }
  const WELD_F631 = { source: 'Welding', tag: TAG_F631, pipeSpec: 'PCH', fluidCode: 'AW' } as const
  const WELD_F632 = { source: 'Welding', tag: TAG_F632, pipeSpec: 'PEH', fluidCode: 'CWS' } as const

  const ROWS = [
    ...repeat(6, { ...GREYFOX, week: 40, qcr: 'QCR 01' }, 1),
    ...repeat(4, { ...BAYSIDE, week: 41, qcr: 'QCR 01' }, 2),
    ...repeat(6, { ...BAYSIDE, week: 41, qcr: 'QCR 02' }),
    ...repeat(6, { ...GREYFOX, source: 'Mechanical', week: 42, qcr: 'QCR 03' }, 3),
    ...repeat(3, { ...GREYFOX, source: 'Mechanical', week: 42, qcr: 'N/A' }, 1),
    ...repeat(2, { ...BAYSIDE, week: 42, qcr: 'QCR 02', phase: 'SOR' }),
    ...repeat(1, { ...GREYFOX, week: 2, qcr: 'QCR 01' }),
    ...repeat(12, { ...WELD_F631, week: 41, welder: 'Welder 001' }, 2),
    ...repeat(11, { ...WELD_F632, week: 42, welder: 'Welder 002' }, 1),
    ...repeat(2, { ...WELD_F632, week: 42, welder: 'N/A' }),
  ]
  const BOUND_INDEX = buildPerformanceIndex(splitCombinedRows(ROWS, FILTER_COLUMNS.source), FILTER_COLUMNS, TODAY)

  function drawFiltered(overrides: Partial<PerformanceDashboardProps> = {}): HTMLElement {
    stubSize()
    view = draw({ index: BOUND_INDEX, ...overrides })
    return view.container
  }

  function menuFields(container: HTMLElement): string[] {
    return [...container.querySelectorAll('.qaqc-filter-section-toggle span:first-of-type')].map((node) => node.textContent ?? '')
  }

  function tick(container: HTMLElement, section: string, value: string): void {
    const toggle = [...container.querySelectorAll('.qaqc-filter-section-toggle')].find((button) => button.textContent?.startsWith(section))
    if (!toggle) throw new Error(`section ${section} missing`)
    if (toggle.getAttribute('aria-expanded') !== 'true') toggleSection(container, section)
    click(checkbox(container, value))
  }

  function setRange(container: HTMLElement, from: number, to: number): void {
    const [fromSelect, toSelect] = container.querySelectorAll<HTMLSelectElement>('.qaqc-filter-date select')
    choose(fromSelect, from)
    choose(toSelect, to)
  }

  function periodCards(container: HTMLElement): Array<string | null> {
    return [...(dialog(container)?.querySelectorAll('.qaqc-kpi-group.is-period .qaqc-kpi-value') ?? [])].map((node) => node.textContent)
  }

  function allTimeCards(container: HTMLElement): Array<string | null> {
    return [...(dialog(container)?.querySelectorAll('.qaqc-kpi-group.is-toDate .qaqc-kpi-value') ?? [])].map((node) => node.textContent)
  }

  function trendSentence(container: HTMLElement, name: string): string | null {
    return rowNamed(container, name).querySelector('.qaqc-perf-trend-cell .qaqc-visually-hidden')?.textContent ?? null
  }

  function trendBars(container: HTMLElement, name: string): number {
    return rowNamed(container, name).querySelectorAll('.qaqc-perf-trend-bar').length
  }

  it('the QCR / FE group offers Contractor, Building and Discipline', () => {
    const container = drawFiltered()
    openMenu(container)
    expect(menuFields(container)).toEqual(['Contractor', 'Building', 'Discipline'])
    expect(container.querySelector('.qaqc-filter-date')).not.toBeNull()
  })

  it('the Welders group offers Building, Pipe Spec and Fluid Code', () => {
    const container = drawFiltered()
    showGroup(container, 'Welders')
    openMenu(container)
    expect(menuFields(container)).toEqual(['Building', 'Pipe Spec', 'Fluid Code'])
  })

  it('offers Date range and Building with no new slot bound', () => {
    const container = drawFiltered({ index: INDEX })
    openMenu(container)
    expect(menuFields(container)).toEqual(['Building'])
    expect(container.querySelector('.qaqc-filter-date')).not.toBeNull()
  })

  it('counts Showing over the group on screen, keeping unreadable and future rows in Y', () => {
    const rows = [...ROWS, makeRow({ ...GREYFOX, week: 50, qcr: 'QCR 01' }), makeRow({ source: 'Welding', week: 50, tag: TAG_F631, welder: 'Welder 001' })]
    const container = drawFiltered({ index: buildPerformanceIndex(splitCombinedRows(rows, FILTER_COLUMNS.source), FILTER_COLUMNS, TODAY) })
    openMenu(container)
    // Every Electrical and Mechanical row, SORs and the future row included.
    expect(showing(container)).toBe('Showing 29 of 29 rows')
    tick(container, 'Contractor', 'Bayside')
    expect(showing(container)).toBe('Showing 12 of 29 rows')
    click(filterButton(container))
    showGroup(container, 'Welders')
    openMenu(container)
    expect(showing(container)).toBe('Showing 26 of 26 rows')
  })

  it('narrows the ranking, the cards and the table to the matching rows', () => {
    const container = drawFiltered()
    openMenu(container)
    tick(container, 'Contractor', 'Bayside')
    expect(summaryValues(container)).toEqual(['1', '10', '2', '80.00%'])
    expect(rankedNames(container)).toEqual(['QCR 02'])
    expect(cardDetail(container, 'QCR/FE ranked')).toBe('Minimum 5 finals · 1 below')
    expect(chipTexts(container)).toEqual(['Contractor: Bayside'])
  })

  it('switching groups keeps the other group\'s selection without applying it', () => {
    const container = drawFiltered()
    openMenu(container)
    tick(container, 'Contractor', 'Bayside')
    tick(container, 'Discipline', 'Controls')
    click(filterButton(container))
    expect(chipTexts(container)).toEqual(['Contractor: Bayside', 'Discipline: Controls'])

    showGroup(container, 'Welders')
    expect(chipTexts(container)).toEqual([])
    expect(filterButton(container).querySelector('.qaqc-filter-badge')).toBeNull()
    expect(summaryValues(container)).toEqual(['2', '25', '3', '88.00%'])

    openMenu(container)
    tick(container, 'Pipe Spec', 'PCH')
    click(filterButton(container))
    expect(chipTexts(container)).toEqual(['Pipe Spec: PCH'])
    expect(summaryValues(container)).toEqual(['1', '12', '2', '83.33%'])

    showGroup(container, 'QCR / FE')
    expect(chipTexts(container)).toEqual(['Contractor: Bayside', 'Discipline: Controls'])
    expect(summaryValues(container)).toEqual(['1', '10', '2', '80.00%'])

    showGroup(container, 'Welders')
    expect(chipTexts(container)).toEqual(['Pipe Spec: PCH'])
    expect(summaryValues(container)).toEqual(['1', '12', '2', '83.33%'])
  })

  it('applies a Building ticked on one group to the other, spelled as that group spells it', () => {
    const container = drawFiltered()
    openMenu(container)
    tick(container, 'Building', 'F63.1')
    click(filterButton(container))
    expect(chipTexts(container)).toEqual(['Building: F63.1'])
    showGroup(container, 'Welders')
    expect(chipTexts(container)).toEqual(['Building: F631'])
    expect(rankedNames(container)).toEqual(['Welder 001'])
  })

  it('a date range replaces the period: ranks, cards and trend use it, and 30 WW | All is disabled', () => {
    const container = drawFiltered()
    expect(toggleButton(container, 'Ranking period', '30 WW').disabled).toBe(false)
    openMenu(container)
    setRange(container, 202640, 202641)
    click(filterButton(container))

    expect(toggleButton(container, 'Ranking period', '30 WW').disabled).toBe(true)
    expect(toggleButton(container, 'Ranking period', 'All').disabled).toBe(true)
    expect(summaryHead(container)).toEqual(['QCR / FE', "WW40'2026 to WW41'2026"])
    expect(summaryValues(container)).toEqual(['2', '16', '3', '81.25%'])
    expect(rankedNames(container)).toEqual(['QCR 01', 'QCR 02'])
    expect(trendBars(container, 'QCR 01')).toBe(2)
    expect(trendSentence(container, 'QCR 01')).toContain('2 of the last 2 weeks')
    expect([...container.querySelectorAll<HTMLOptionElement>('.qaqc-header select option')].map((node) => node.textContent))
      .toEqual(["WW41'2026", "WW40'2026"])
    expect(chipTexts(container)).toEqual(["Date range: WW40'2026 to WW41'2026"])
  })

  it('draws every week of a range longer than 30 weeks', () => {
    const container = drawFiltered()
    openMenu(container)
    setRange(container, 202603, 202642)
    expect(trendSentence(container, 'QCR 01')).toContain('of the last 40 weeks')
    expect(trendBars(container, 'QCR 01')).toBe(2)
  })

  it('Minimum finals applies inside the filtered period', () => {
    const container = drawFiltered()
    expect(rankedNames(container)).toEqual(['QCR 03', 'QCR 01', 'QCR 02'])
    openMenu(container)
    tick(container, 'Contractor', 'Bayside')
    expect(rankedNames(container)).toEqual(['QCR 02'])
    expect(cardDetail(container, 'QCR/FE ranked')).toBe('Minimum 5 finals · 1 below')
    click(filterButton(container))
    click(disclosure(container))
    expect(rowNamed(container, 'QCR 01').classList.contains('is-below')).toBe(true)
  })

  it('Minimum welds applies inside the filtered period', () => {
    const container = drawFiltered({ minimumWelds: 12 })
    showGroup(container, 'Welders')
    expect(rankedNames(container)).toEqual(['Welder 001'])
    openMenu(container)
    setRange(container, 202642, 202642)
    expect(rankedNames(container)).toEqual([])
    expect(cardDetail(container, 'Welders ranked')).toBe('Minimum 12 welds · 1 below')
  })

  it('restates the Not recorded row and its note', () => {
    const container = drawFiltered()
    expect(footnotes(container)).toContain('3 finals have no QCR/FE')
    openMenu(container)
    tick(container, 'Contractor', 'Bayside')
    expect(container.querySelector('tr.qaqc-perf-row.is-not-recorded')).toBeNull()
    expect(footnotes(container).some((note) => note.includes('no QCR/FE'))).toBe(false)
  })

  it('the person page restates its This period cards and chart, and All time stays all time', () => {
    const container = drawFiltered()
    openMenu(container)
    tick(container, 'Contractor', 'Greyfox')
    setRange(container, 202640, 202641)
    click(filterButton(container))
    click(nameButton(container, 'QCR 01'))

    const heads = [...(dialog(container)?.querySelectorAll('.qaqc-kpi-group-head') ?? [])].map((head) => head.textContent ?? '')
    expect(heads).toEqual(["This periodWW40'2026 to WW41'2026", "All timeWW02'2026 to WW42'2026"])
    expect(periodCards(container)).toEqual(['6', '1', '83.33%'])
    expect(allTimeCards(container)).toEqual(['11', '3', '72.73%'])
    expect(dialog(container)?.querySelector('.qaqc-perf-chart')?.getAttribute('aria-label')).toContain("WW40'2026 to WW41'2026")
    const ncrs = [...(dialog(container)?.querySelectorAll<HTMLTableRowElement>('.qaqc-perf-ncr-table tbody tr[aria-rowindex]') ?? [])]
    expect(ncrs.map((row) => row.cells[3].textContent)).toEqual(['Defect 40.0'])
  })

  it('the person page keeps its rows when a person has no NCRs under the filter', () => {
    const container = drawFiltered()
    openMenu(container)
    tick(container, 'Contractor', 'Bayside')
    click(filterButton(container))
    click(nameButton(container, 'QCR 02'))
    expect(periodCards(container)).toEqual(['6', '0', '100.00%'])
    expect(dialog(container)?.querySelector('.qaqc-perf-person-empty strong')?.textContent).toBe('No NCRs in this period')
  })

  it('shows the shared empty state when a filter matches no rows, and Clear filters brings the data back', () => {
    const container = drawFiltered()
    openMenu(container)
    tick(container, 'Contractor', 'Bayside')
    tick(container, 'Building', 'F63.1')
    click(filterButton(container))
    const empty = container.querySelector('.qaqc-filter-empty')
    expect(empty?.querySelector('p')?.textContent).toContain('There are no finals with this combination')
    expect(container.querySelector('.qaqc-perf-summary')).toBeNull()
    expect(container.querySelector('.qaqc-perf-table, .qaqc-perf-empty-state')).toBeNull()

    click(buttonNamed(container, 'Clear filters'))
    expect(container.querySelector('.qaqc-filter-empty')).toBeNull()
    expect(summaryValues(container)).toEqual(['3', '25', '7', '72.00%'])
    expect(document.activeElement).toBe(filterButton(container))
  })

  it('shows the shared empty state when a date range holds no rows', () => {
    const container = drawFiltered()
    openMenu(container)
    setRange(container, 202610, 202612)
    click(filterButton(container))
    expect(container.querySelector('.qaqc-filter-empty p')?.textContent).toContain('There are no finals in this date range')
    showGroup(container, 'Welders')
    expect(container.querySelector('.qaqc-filter-empty p')?.textContent).toContain('There are no welds in this date range')
  })

  it('says switch to All, not no match, when the matching rows are outside the 30 WW', () => {
    const rows = [...ROWS, ...repeat(2, { contractor: 'Larch', building: 'F63.1', discipline: 'Electrical', week: 2, qcr: 'QCR 09' })]
    const container = drawFiltered({ index: buildPerformanceIndex(splitCombinedRows(rows, FILTER_COLUMNS.source), FILTER_COLUMNS, TODAY) })
    openMenu(container)
    tick(container, 'Contractor', 'Larch')
    click(filterButton(container))
    expect(container.querySelector('.qaqc-filter-empty')).toBeNull()
    expect(container.querySelector('.qaqc-perf-empty-state span')?.textContent).toContain('choose All')
    showRange(container, 'All')
    expect(rankedNames(container)).toEqual([])
    expect(summaryValues(container)).toEqual(['0', '2', '0', '100.00%'])
  })

  it('keeps the shared empty state on a cards-only tile', () => {
    const container = drawFiltered({ viewport: { width: 1340, height: 300 } })
    openMenu(container)
    setRange(container, 202610, 202612)
    click(filterButton(container))
    expect(container.querySelector('.qaqc-filter-empty')).not.toBeNull()
    expect(container.querySelector('.qaqc-perf-summary')).toBeNull()
  })

  it('restates the skipped note to the matching rows and keeps the row limit over every row', () => {
    const unreadable = (contractor: string): Array<string | null> => {
      const row = makeRow({ week: 40, contractor, building: 'F63.1', qcr: 'QCR 01' })
      row[COLUMNS.workWeek] = 'no week'
      return row
    }
    const rows = [...ROWS, unreadable('Greyfox'), unreadable('Bayside'), unreadable('Bayside')]
    const container = drawFiltered({ rowLimitReached: true, index: buildPerformanceIndex(splitCombinedRows(rows, FILTER_COLUMNS.source), FILTER_COLUMNS, TODAY) })
    expect(footnotes(container)[0]).toBe(`Showing the first ${rows.length} rows (Power BI data limit)`)
    expect(footnotes(container)).toContain('3 rows skipped: unreadable work week')
    openMenu(container)
    tick(container, 'Contractor', 'Greyfox')
    expect(footnotes(container)[0]).toBe(`Showing the first ${rows.length} rows (Power BI data limit)`)
    expect(footnotes(container)).toContain('1 row skipped: unreadable work week')
  })

  it('no filter leaves fixtures unchanged', () => {
    const baseline = draw()
    const values = summaryValues(baseline.container)
    const names = rankedNames(baseline.container)
    const notes = footnotes(baseline.container)
    baseline.unmount()

    const boundRows = COMBINED_ROWS.map((row, position) => [...row, position % 2 === 0 ? 'Greyfox' : 'Bayside', 'Electrical', 'PCH', 'AW'])
    const container = drawFiltered({ index: buildPerformanceIndex(splitCombinedRows(boundRows, FILTER_COLUMNS.source), FILTER_COLUMNS, TODAY) })
    expect(summaryValues(container)).toEqual(values)
    expect(rankedNames(container)).toEqual(names)
    expect(footnotes(container)).toEqual(notes)
    expect(chipTexts(container)).toEqual([])
    expect(filterButton(container).querySelector('.qaqc-filter-badge')).toBeNull()
  })

  it('disables the Filter button when interactions are not allowed', () => {
    const container = drawFiltered({ interactive: false })
    expect(filterButton(container).disabled).toBe(true)
  })
})
