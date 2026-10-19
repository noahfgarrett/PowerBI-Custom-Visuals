import { LayoutDashboard } from 'lucide-react'
import { act, type ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { OVERVIEW_CARDS_ONLY_HEIGHT, OVERVIEW_DENSE_HEIGHT, OverviewDashboard, type OverviewDashboardProps } from '../components/OverviewDashboard'
import { splitCombinedRows } from '../combined'
import { buildOverviewFootnotes } from '../footnotes'
import { buildOverviewIndex } from '../overview'
import { resolveTheme } from '../theme'
import type { CombinedColumns } from '../types'
import { COMBINED_COLUMNS, COMBINED_ROWS } from './fixtures/combinedRows'
import { inspection, overviewIndexOf } from './overviewRows'
import { render, type Rendered } from './render'
import { ruleBody } from './stylesheet'

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
const TODAY = new Date(2026, 9, 15) // WW42'2026
const INDEX = buildOverviewIndex(splitCombinedRows(COMBINED_ROWS, COLUMNS.source), COLUMNS, TODAY)
const THEME = resolveTheme({ preset: 'qaqc', backgroundColor: '', backgroundOpacity: 100, cardOpacity: 100, highContrast: null })
const ACTIVITY_TITLE = 'Inspection activity by Work Week'
const RATES_TITLE = 'Quality rates by Work Week'
const ROW_NAMES = ['Electrical', 'Mechanical', 'Welding', 'BIM Issues'] as const

type RowName = (typeof ROW_NAMES)[number]

let view: Rendered | null = null

afterEach(() => {
  view?.unmount()
  view = null
  vi.restoreAllMocks()
})

function dashboardElement(overrides: Partial<OverviewDashboardProps> = {}): ReactElement {
  return (
    <OverviewDashboard
      title="QCx Overview"
      icon={LayoutDashboard}
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

function draw(overrides: Partial<OverviewDashboardProps> = {}): Rendered {
  return render(dashboardElement(overrides))
}

function row(container: HTMLElement, name: RowName): HTMLElement {
  const found = [...container.querySelectorAll<HTMLElement>('.qaqc-root .qaqc-overview-row[role="group"]')]
    .find((node) => node.getAttribute('aria-label')?.startsWith(`${name}:`) || node.getAttribute('aria-label') === name)
  if (!found) throw new Error(`${name} row missing`)
  return found
}

function quality(container: HTMLElement): HTMLElement {
  const found = container.querySelector<HTMLElement>('.qaqc-root .qaqc-overview-quality section[aria-label="Quality"]')
  if (!found) throw new Error('quality strip missing')
  return found
}

// Matches labels in code: jsdom's selector engine mishandles "+" and "%" inside attribute values.
function card(scope: HTMLElement, label: string): HTMLElement {
  const found = [...scope.querySelectorAll<HTMLElement>('article.qaqc-kpi')]
    .find((node) => node.getAttribute('aria-label')?.startsWith(`${label}:`))
  if (!found) throw new Error(`${label} card missing`)
  return found
}

/** A card's value and its single detail line. */
function shown(scope: HTMLElement, label: string): [string | null, string | null] {
  const node = card(scope, label)
  return [node.querySelector('.qaqc-kpi-value')?.textContent ?? null, node.querySelector('.qaqc-kpi-detail')?.textContent ?? null]
}

/** A strip card's value, its counts line (null when it has none) and its change line. */
function shownLines(scope: HTMLElement, label: string): [string | null, string | null, string | null] {
  const node = card(scope, label)
  return [
    node.querySelector('.qaqc-kpi-value')?.textContent ?? null,
    node.querySelector('.qaqc-kpi-context')?.textContent ?? null,
    node.querySelector('.qaqc-kpi-detail')?.textContent ?? null,
  ]
}

/** A dense cards-only value, found by its label like the cards. */
function denseValue(scope: HTMLElement, label: string): HTMLElement {
  const found = [...scope.querySelectorAll<HTMLElement>('article.qaqc-overview-value')]
    .find((node) => node.getAttribute('aria-label')?.startsWith(`${label}:`))
  if (!found) throw new Error(`${label} value missing`)
  return found
}

function denseTone(scope: HTMLElement, label: string): string | null {
  const trend = denseValue(scope, label).querySelector('.qaqc-overview-value-trend')
  return [...(trend?.classList ?? [])].find((name) => name.startsWith('is-')) ?? null
}

function tone(scope: HTMLElement, label: string): string | null {
  const detail = card(scope, label).querySelector('.qaqc-kpi-detail')
  return [...(detail?.classList ?? [])].find((name) => name.startsWith('is-')) ?? null
}

function rowsSubtitle(container: HTMLElement): string | null {
  return container.querySelector('.qaqc-root .qaqc-overview-rows-head em')?.textContent ?? null
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

function modeButton(container: HTMLElement, label: string): HTMLButtonElement {
  const button = [...container.querySelectorAll<HTMLButtonElement>('.qaqc-segmented button')].find((item) => item.textContent === label)
  if (!button) throw new Error(`${label} button missing`)
  return button
}

function showToDate(container: HTMLElement): void {
  click(modeButton(container, 'To date'))
}

function pickWeekInDropdown(container: HTMLElement, key: string): void {
  const select = container.querySelector('select')
  if (!select) throw new Error('week picker missing')
  act(() => {
    select.value = key
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

function panel(container: HTMLElement, title: string): HTMLElement | null {
  return [...container.querySelectorAll<HTMLElement>('section.qaqc-panel')].find((node) => node.getAttribute('aria-label') === title) ?? null
}

function clickHit(container: HTMLElement, title: string, week: string): void {
  const rect = panel(container, title)?.querySelector(`.qaqc-hit[data-week="${week}"]`)
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

describe('OverviewDashboard discipline rows, This WW', () => {
  it('opens on the current week in This WW mode', () => {
    view = draw()
    expect(modeButton(view.container, 'This WW').getAttribute('aria-pressed')).toBe('true')
    expect(rowsSubtitle(view.container)).toBe("WW42'2026")
  })

  it('shows the WW42 Electrical cards with their change against WW41', () => {
    view = draw()
    const electrical = row(view.container, 'Electrical')
    expect(shown(electrical, 'Finals')).toEqual(['3', "−3 vs WW41'2026"])
    expect(shown(electrical, 'SORs')).toEqual(['3', "No change vs WW41'2026"])
    expect(shown(electrical, 'NCRs')).toEqual(['0', "No change vs WW41'2026"])
    expect(shown(electrical, 'NCR pass rate')).toEqual(['100.0%', "3 / 3 Finals · No change vs WW41'2026"])
  })

  it('shows Mechanical\'s WW42 pass rate as n/a with no finals', () => {
    view = draw()
    const mechanical = row(view.container, 'Mechanical')
    expect(shown(mechanical, 'SORs')).toEqual(['0', "−2 vs WW41'2026"])
    expect(shown(mechanical, 'NCR pass rate')).toEqual(['n/a', '0 Finals · Change n/a'])
  })

  it('shows the WW42 Welding cards, with Sign-off % from the latest weld week', () => {
    view = draw()
    const welding = row(view.container, 'Welding')
    expect(shown(welding, 'Welds logged')).toEqual(['0', "−84 vs WW41'2026"])
    expect(shown(welding, 'Signed')).toEqual(['70', "+24 vs WW41'2026"])
    expect(shown(welding, 'Sign-off %')).toEqual(['80%', "67 of 84 · WW41'2026"])
    expect(shown(welding, 'NCRs')).toEqual(['0', "No change vs WW41'2026"])
  })

  it('shows the WW42 BIM cards, with Remaining open and Closure rate to date', () => {
    view = draw()
    const issues = row(view.container, 'BIM Issues')
    expect(shown(issues, 'Opened')).toEqual(['0', "No change vs WW41'2026"])
    expect(shown(issues, 'Remaining open')).toEqual(['51', "No change vs WW41'2026"])
    expect(shown(issues, 'Closure rate')).toEqual(['71.2%', "126 of 177 closed · No change vs WW41'2026"])
  })

  it('colors the cards with the model tones', () => {
    view = draw()
    pickWeekInDropdown(view.container, '202622')
    const electrical = row(view.container, 'Electrical')
    expect(tone(electrical, 'Finals')).toBe('is-neutral')
    expect(tone(electrical, 'NCRs')).toBe('is-warn')
    expect(tone(electrical, 'NCR pass rate')).toBe('is-bad')
  })

  it('draws four cards and a decorative sparkline in each row', () => {
    view = draw()
    for (const name of ROW_NAMES) {
      const discipline = row(view.container, name)
      expect(discipline.querySelectorAll('article.qaqc-kpi')).toHaveLength(4)
      const sparkline = discipline.querySelector('svg.qaqc-sparkline')
      expect(sparkline?.getAttribute('aria-hidden')).toBe('true')
      expect(sparkline?.querySelector('polyline')?.getAttribute('points')?.split(' ')).toHaveLength(30)
    }
  })

  it('labels each row with its icon and name', () => {
    view = draw()
    const { container } = view
    const icons = ['lucide-zap', 'lucide-wrench', 'lucide-flame', 'lucide-circle-alert']
    ROW_NAMES.forEach((name, at) => {
      const label = row(container, name).querySelector('.qaqc-overview-row-label')
      expect(label?.textContent).toBe(name)
      expect(label?.querySelector(`svg.${icons[at]}`)).not.toBeNull()
    })
  })

  it('states each row\'s trend in its group label', () => {
    view = draw()
    expect(row(view.container, 'Electrical').getAttribute('aria-label')).toBe("Electrical: Finals + SORs down 3 vs WW41'2026")
    expect(row(view.container, 'Welding').getAttribute('aria-label')).toBe("Welding: Welds logged down 84 vs WW41'2026")
    expect(row(view.container, 'BIM Issues').getAttribute('aria-label')).toBe("BIM Issues: Remaining open no change vs WW41'2026")
  })
})

describe('OverviewDashboard discipline rows, To date', () => {
  it('switches the cards to the project to date', () => {
    view = draw()
    showToDate(view.container)
    expect(modeButton(view.container, 'To date').getAttribute('aria-pressed')).toBe('true')
    expect(modeButton(view.container, 'This WW').getAttribute('aria-pressed')).toBe('false')
    expect(rowsSubtitle(view.container)).toBe("Through WW42'2026")
  })

  it('shows the Electrical totals through WW42', () => {
    view = draw()
    showToDate(view.container)
    const electrical = row(view.container, 'Electrical')
    expect(shown(electrical, 'Finals')).toEqual(['238', '+3 this WW'])
    expect(shown(electrical, 'SORs')).toEqual(['48', '+3 this WW'])
    expect(shown(electrical, 'NCR pass rate')).toEqual(['99.2%', "236 / 238 Finals · +0.01 pts vs WW41'2026"])
  })

  it('shows the Mechanical totals through WW42', () => {
    view = draw()
    showToDate(view.container)
    const mechanical = row(view.container, 'Mechanical')
    expect(shown(mechanical, 'Finals')).toEqual(['44', '+0 this WW'])
    expect(shown(mechanical, 'NCR pass rate')).toEqual(['97.7%', "43 / 44 Finals · No change vs WW41'2026"])
  })

  it('shows the Welding totals through WW42, with Signed this WW by signing week', () => {
    view = draw()
    showToDate(view.container)
    const welding = row(view.container, 'Welding')
    expect(shown(welding, 'Welds logged')).toEqual(['1,751', '+0 this WW'])
    expect(shown(welding, 'Signed')).toEqual(['1,054', '+70 signed this WW'])
    expect(shown(welding, 'Sign-off %')).toEqual(['60.2%', "1,054 of 1,751 signed · No change vs WW41'2026"])
    expect(shown(welding, 'NCRs')).toEqual(['11', '+0 this WW'])
  })

  it('shows the BIM totals through WW42', () => {
    view = draw()
    showToDate(view.container)
    const issues = row(view.container, 'BIM Issues')
    expect(shown(issues, 'Opened')).toEqual(['177', '+0 this WW'])
    expect(shown(issues, 'Closed')).toEqual(['126', '+0 this WW'])
    expect(shown(issues, 'Remaining open')).toEqual(['51', "No change vs WW41'2026"])
  })

  it('keeps the mode when another week is picked', () => {
    view = draw()
    showToDate(view.container)
    pickWeekInDropdown(view.container, '202641')
    expect(shown(row(view.container, 'Electrical'), 'Finals')).toEqual(['235', '+6 this WW'])
  })

  it('switches back to This WW', () => {
    view = draw()
    showToDate(view.container)
    click(modeButton(view.container, 'This WW'))
    expect(shown(row(view.container, 'Electrical'), 'Finals')).toEqual(['3', "−3 vs WW41'2026"])
  })

  it('disables the mode toggle when interactions are not allowed', () => {
    view = draw({ interactive: false })
    expect(modeButton(view.container, 'To date').disabled).toBe(true)
  })
})

describe('OverviewDashboard quality strip', () => {
  it('shows five cards in a group titled Quality', () => {
    view = draw()
    const strip = quality(view.container)
    expect(strip.querySelector('.qaqc-kpi-group-head span')?.textContent).toBe('Quality')
    expect([...strip.querySelectorAll('.qaqc-kpi-label')].map((node) => node.textContent))
      .toEqual(['CORs', 'NCRs', 'Inspection NCR pass rate', 'Welding NCR pass rate', 'DWNs'])
  })

  it('shows the WW42 quality cards', () => {
    view = draw()
    const strip = quality(view.container)
    expect(shownLines(strip, 'CORs')).toEqual(['0', null, "No change vs WW41'2026"])
    expect(shownLines(strip, 'NCRs')).toEqual(['0', 'E 0 · M 0 · W 0', "No change vs WW41'2026"])
    expect(shownLines(strip, 'Inspection NCR pass rate')).toEqual(['100.0%', '0 NCRs of 3 finals', "No change vs WW41'2026"])
    expect(shownLines(strip, 'Welding NCR pass rate')).toEqual(['n/a', '0 welds', 'Change n/a'])
    expect(shownLines(strip, 'DWNs')).toEqual(['0', 'DWN rate n/a: add Green tags', "No change vs WW41'2026"])
  })

  it('shows the quality cards through WW42 in To date', () => {
    view = draw()
    showToDate(view.container)
    const strip = quality(view.container)
    expect(shownLines(strip, 'CORs')).toEqual(['171', null, '+0 this WW'])
    expect(shownLines(strip, 'NCRs')).toEqual(['14', 'E 2 · M 1 · W 11', '+0 this WW'])
    expect(shownLines(strip, 'Inspection NCR pass rate')).toEqual(['98.9%', '3 NCRs of 282 finals', "+0.01 pts vs WW41'2026"])
    expect(shownLines(strip, 'Welding NCR pass rate')).toEqual(['99.4%', '11 NCRs of 1,751 welds', "No change vs WW41'2026"])
  })

  it('subtitles the strip with the cards\' week or range', () => {
    view = draw()
    expect(quality(view.container).querySelector('.qaqc-kpi-group-head em')?.textContent).toBe("WW42'2026")
    showToDate(view.container)
    expect(quality(view.container).querySelector('.qaqc-kpi-group-head em')?.textContent).toBe("Through WW42'2026")
  })
})

describe('OverviewDashboard layout', () => {
  it('shows the title and icon it is given', () => {
    view = draw()
    expect(view.container.querySelector('h2')?.textContent).toBe('QCx Overview')
    expect(view.container.querySelector('.qaqc-title-icon svg.lucide-layout-dashboard')).not.toBeNull()
  })

  it('puts the card mode toggle before the range toggle and week picker', () => {
    view = draw()
    const controls = view.container.querySelector('.qaqc-controls')
    // Each control by what it is to a screen reader: the two toggles are named groups, the picker is a select.
    const order = [...(controls?.children ?? [])].map((node) =>
      node.getAttribute('role') === 'group' ? node.getAttribute('aria-label') : node.querySelector('select') ? 'week picker' : null,
    )
    expect(order).toEqual(['Card values', 'Chart range', 'week picker'])
  })

  it('stacks the rows, then the quality strip, then the charts', () => {
    view = draw()
    const sections = [...view.container.querySelectorAll('.qaqc-root section[aria-label]')].map((node) => node.getAttribute('aria-label'))
    expect(sections).toEqual(['Disciplines', 'Quality', ACTIVITY_TITLE, RATES_TITLE])
  })

  it('shows Activity large on the left and Quality rates on the right', () => {
    view = draw()
    expect([...view.container.querySelectorAll('.qaqc-panel')].map((node) => node.getAttribute('aria-label')))
      .toEqual([ACTIVITY_TITLE, RATES_TITLE])
    expect(panel(view.container, ACTIVITY_TITLE)?.classList.contains('qaqc-panel-main')).toBe(true)
  })

  it('labels the chart legends', () => {
    view = draw()
    const { container } = view
    const legend = (title: string): Array<string | null> =>
      [...(panel(container, title)?.querySelectorAll('.qaqc-legend li') ?? [])].map((item) => item.textContent)
    expect(legend(ACTIVITY_TITLE)).toEqual(['Electrical', 'Mechanical'])
    expect(legend(RATES_TITLE)).toEqual(['Inspection NCR pass rate', 'Welding NCR pass rate'])
  })

  it('stacks everything in the compact layout on narrow tiles', () => {
    view = draw({ viewport: { width: 640, height: 700 } })
    expect(view.container.querySelector('.qaqc-root.is-compact')).not.toBeNull()
    expect(view.container.querySelectorAll('.qaqc-panel')).toHaveLength(2)
    expect(view.container.querySelectorAll('.qaqc-overview-row')).toHaveLength(4)
  })

  it('keeps the charts on Power BI\'s default 1280 × 720 page', () => {
    view = draw({ viewport: { width: 1280, height: 720 } })
    expect(view.container.querySelector('.qaqc-root.is-cards-only')).toBeNull()
    expect(view.container.querySelectorAll('.qaqc-panel')).toHaveLength(2)
    // The rows and the strip keep their natural height; only the charts flex into what is left.
    expect(ruleBody('.qaqc-overview-rows')).toContain('flex: 0 0 auto;')
    expect(ruleBody('.qaqc-overview-quality')).toContain('flex: 0 0 auto;')
    expect(ruleBody('.qaqc-overview-row')).toContain('min-height: 54px;')
  })

  it('says no rows match in both charts when the data is empty', () => {
    view = draw({ index: overviewIndexOf([]) })
    for (const title of [ACTIVITY_TITLE, RATES_TITLE]) {
      expect(panel(view.container, title)?.querySelector('.qaqc-chart-empty')?.textContent).toBe('No QCx Combined rows match the current filters')
    }
    expect(panel(view.container, ACTIVITY_TITLE)?.querySelector('.qaqc-expand-button')).toBeNull()
  })

  it('keeps the charts at its own cards-only threshold', () => {
    view = draw({ viewport: { width: 1340, height: OVERVIEW_CARDS_ONLY_HEIGHT } })
    expect(view.container.querySelectorAll('.qaqc-panel')).toHaveLength(2)
  })

  it('drops the charts but keeps the full cards on tiles with room for the cards alone', () => {
    view = draw({ viewport: { width: 1340, height: 600 } })
    expect(view.container.querySelector('.qaqc-root.is-cards-only')).not.toBeNull()
    expect(view.container.querySelectorAll('.qaqc-panel')).toHaveLength(0)
    expect(view.container.querySelectorAll('.qaqc-overview-row.is-dense')).toHaveLength(0)
    expect(view.container.querySelectorAll('article.qaqc-kpi')).toHaveLength(21)
  })

  it('switches to the dense layout below the height the full cards need', () => {
    view = draw({ viewport: { width: 1340, height: OVERVIEW_DENSE_HEIGHT - 1 } })
    expect(view.container.querySelectorAll('.qaqc-overview-row.is-dense')).toHaveLength(4)
    view.unmount()
    view = draw({ viewport: { width: 1340, height: OVERVIEW_DENSE_HEIGHT } })
    expect(view.container.querySelectorAll('.qaqc-overview-row.is-dense')).toHaveLength(0)
  })

  it('uses the dense layout on narrow cards-only tiles, where full cards would stack two by two', () => {
    view = draw({ viewport: { width: 800, height: 600 } })
    expect(view.container.querySelectorAll('.qaqc-overview-row.is-dense')).toHaveLength(4)
  })

  it('sizes its threshold from the stylesheet\'s chart minimum, and scrolls rather than paint over the footnotes', () => {
    expect(OVERVIEW_CARDS_ONLY_HEIGHT).toBe(660)
    expect(OVERVIEW_DENSE_HEIGHT).toBe(480)
    expect(ruleBody('.qaqc-overview-charts')).toContain('min-height: 180px;')
    expect(ruleBody('.qaqc-overview-body')).toContain('overflow-y: auto;')
  })

  it('shows the rows and the strip as dense values on a short tile', () => {
    view = draw({ viewport: { width: 1340, height: 400 } })
    expect(view.container.querySelector('.qaqc-root.is-cards-only')).not.toBeNull()
    expect(view.container.querySelectorAll('.qaqc-panel')).toHaveLength(0)
    expect(view.container.querySelectorAll('.qaqc-overview-row.is-dense')).toHaveLength(4)
    expect(view.container.querySelectorAll('article.qaqc-kpi')).toHaveLength(0)
    expect(view.container.querySelectorAll('article.qaqc-overview-value')).toHaveLength(21)
    expect(view.container.querySelector('.qaqc-overview-value .qaqc-kpi-detail')).toBeNull()
  })

  it('keeps each dense value\'s full detail in its label and tooltip', () => {
    view = draw({ viewport: { width: 800, height: 300 } })
    const finals = denseValue(row(view.container, 'Electrical'), 'Finals')
    expect(finals.getAttribute('aria-label')).toBe("Finals: 3. −3 vs WW41'2026")
    expect(finals.getAttribute('title')).toBe("Finals: 3. −3 vs WW41'2026")
    expect(finals.querySelector('.qaqc-overview-value-label')?.textContent).toBe('Finals')
    expect(finals.querySelector('.qaqc-overview-value-number')?.textContent).toBe('3')
    expect(finals.querySelector('.qaqc-overview-value-trend svg.lucide-arrow-down-right')).not.toBeNull()
    const rate = denseValue(row(view.container, 'Electrical'), 'NCR pass rate')
    expect(rate.getAttribute('aria-label')).toBe("NCR pass rate: 100.0%. 3 / 3 Finals · No change vs WW41'2026")
  })

  it('colours each dense trend arrow with the card tone', () => {
    view = draw({ viewport: { width: 800, height: 300 } })
    pickWeekInDropdown(view.container, '202622')
    const electrical = row(view.container, 'Electrical')
    expect(denseTone(electrical, 'NCRs')).toBe('is-warn')
    expect(denseTone(electrical, 'NCR pass rate')).toBe('is-bad')
  })

  it('keeps the sparkline in each dense row', () => {
    view = draw({ viewport: { width: 800, height: 300 } })
    for (const name of ROW_NAMES) expect(row(view.container, name).querySelector('svg.qaqc-sparkline')).not.toBeNull()
  })

  it('shows the quality strip as one line of five dense values', () => {
    view = draw({ viewport: { width: 800, height: 300 } })
    const strip = quality(view.container)
    expect([...strip.querySelectorAll('.qaqc-overview-value-label')].map((node) => node.textContent))
      .toEqual(['CORs', 'NCRs', 'Inspection NCR pass rate', 'Welding NCR pass rate', 'DWNs'])
    expect(denseValue(strip, 'DWNs').getAttribute('title')).toBe("DWNs: 0. DWN rate n/a: add Green tags · No change vs WW41'2026")
  })

  it('fits an 800 × 300 tile with 34 px dense rows', () => {
    view = draw({ viewport: { width: 800, height: 300 } })
    const root = view.container.querySelector('.qaqc-root')
    expect(root?.classList.contains('is-cards-only')).toBe(true)
    expect(root?.classList.contains('is-compact')).toBe(true)
    expect(view.container.querySelectorAll('.qaqc-panel')).toHaveLength(0)
    expect(ruleBody('.qaqc-overview-row.is-dense')).toContain('min-height: 34px;')
    expect(ruleBody('.qaqc-overview-quality-dense')).toContain('min-height: 34px;')
    // Dense labels and values stay on one line; the full text is in the title.
    expect(ruleBody('.qaqc-overview-value-label')).toContain('white-space: nowrap;')
    expect(ruleBody('.qaqc-overview-value-number')).toContain('white-space: nowrap;')
  })

  it('shows a disconnected source\'s message in a dense row', () => {
    view = draw({
      index: overviewIndexOf([inspection('Electrical', "WW42'2026", 'Final')]),
      viewport: { width: 800, height: 300 },
    })
    expect(row(view.container, 'Welding').querySelector('.qaqc-overview-row-message')?.textContent)
      .toBe('Not connected: no Welding rows in QCx Combined')
  })

  it('shows the loading bar it is given', () => {
    view = draw({ loading: true })
    expect(view.container.querySelector('[role="progressbar"]')).not.toBeNull()
  })

  it('shows the combined table\'s footnotes', () => {
    view = draw({ footnotes: buildOverviewFootnotes(INDEX, false) })
    expect(view.container.querySelector('.qaqc-footnotes')?.textContent).toBe('BIM Issues: 5 issues not created by LotusWorks are excluded')
  })
})

describe('OverviewDashboard card shading', () => {
  function rowsSection(container: HTMLElement): HTMLElement {
    const found = container.querySelector<HTMLElement>('.qaqc-root section.qaqc-overview-rows')
    if (!found) throw new Error('rows section missing')
    return found
  }

  function shading(section: HTMLElement): string[] {
    return ['is-week', 'is-toDate'].filter((name) => section.classList.contains(name))
  }

  it('draws the rows and the quality strip on the lighter card in This WW', () => {
    view = draw()
    expect(shading(rowsSection(view.container))).toEqual(['is-week'])
    expect(shading(quality(view.container))).toEqual(['is-week'])
  })

  it('draws the rows and the quality strip on the darker to-date card in To date', () => {
    view = draw()
    showToDate(view.container)
    expect(shading(rowsSection(view.container))).toEqual(['is-toDate'])
    expect(shading(quality(view.container))).toEqual(['is-toDate'])
  })

  it('follows the card mode in the dense layout', () => {
    view = draw({ viewport: { width: 1340, height: 400 } })
    expect(shading(rowsSection(view.container))).toEqual(['is-week'])
    expect(shading(quality(view.container))).toEqual(['is-week'])
    showToDate(view.container)
    expect(shading(rowsSection(view.container))).toEqual(['is-toDate'])
    expect(shading(quality(view.container))).toEqual(['is-toDate'])
  })
})

describe('OverviewDashboard disconnected sources', () => {
  const ELECTRICAL_ONLY = overviewIndexOf([inspection('Electrical', "WW41'2026", 'Final'), inspection('Electrical', "WW42'2026", 'SOR')])

  it('shows the Not connected message in place of the cards and sparkline', () => {
    view = draw({ index: ELECTRICAL_ONLY })
    const mechanical = row(view.container, 'Mechanical')
    expect(mechanical.querySelector('.qaqc-overview-row-message')?.textContent).toBe('Not connected: no Mechanical rows in QCx Combined')
    expect(mechanical.querySelector('article.qaqc-kpi')).toBeNull()
    expect(mechanical.querySelector('svg.qaqc-sparkline')).toBeNull()
    expect(mechanical.classList.contains('is-disconnected')).toBe(true)
  })

  it('labels a disconnected row by its name and keeps the connected rows', () => {
    view = draw({ index: ELECTRICAL_ONLY })
    expect(row(view.container, 'Welding').getAttribute('aria-label')).toBe('Welding')
    expect(row(view.container, 'BIM Issues').textContent).toContain('Not connected: no BIM Issues rows in QCx Combined')
    expect(shown(row(view.container, 'Electrical'), 'SORs')).toEqual(['1', "+1 vs WW41'2026"])
  })
})

// The week, window and range rules are covered in useWeekWindow.test.tsx; these check the dashboard's wiring.
describe('OverviewDashboard week selection', () => {
  it('selects a week from a click on the activity chart', () => {
    stubSize()
    view = draw()
    clickHit(view.container, ACTIVITY_TITLE, '202619')
    expect(rowsSubtitle(view.container)).toBe("WW19'2026")
    expect(shown(row(view.container, 'Electrical'), 'Finals')[0]).toBe('6')
    expect(shown(row(view.container, 'Electrical'), 'SORs')[0]).toBe('1')
  })

  it('selects a week from a click on the quality rates chart', () => {
    stubSize()
    view = draw()
    clickHit(view.container, RATES_TITLE, '202623')
    expect(rowsSubtitle(view.container)).toBe("WW23'2026")
    expect(shown(row(view.container, 'Mechanical'), 'Finals')[0]).toBe('2')
  })

  it('selects a week from the keyboard on the activity chart', () => {
    stubSize()
    view = draw()
    const chart = panel(view.container, ACTIVITY_TITLE)?.querySelector('svg.qaqc-chart')
    if (!chart) throw new Error('activity chart missing')
    pressKeys(chart, ['ArrowLeft', 'Enter'])
    expect(rowsSubtitle(view.container)).toBe("WW41'2026")
    expect(shown(row(view.container, 'Electrical'), 'Finals')).toEqual(['6', "+2 vs WW40'2026"])
  })

  it('selects a week from the keyboard on the quality rates chart', () => {
    stubSize()
    view = draw()
    const chart = panel(view.container, RATES_TITLE)?.querySelector('svg.qaqc-chart')
    if (!chart) throw new Error('rates chart missing')
    pressKeys(chart, ['ArrowLeft', 'ArrowLeft', 'Enter'])
    expect(rowsSubtitle(view.container)).toBe("WW40'2026")
  })

  it('moves the sparklines to end on the selected week', () => {
    stubSize()
    view = draw()
    clickHit(view.container, ACTIVITY_TITLE, '202619')
    expect(row(view.container, 'Electrical').getAttribute('aria-label')).toBe("Electrical: Finals + SORs up 3 vs WW18'2026")
  })
})

describe('OverviewDashboard expanded charts', () => {
  it('gives both chart panels an expand button', () => {
    stubSize()
    view = draw()
    expect(view.container.querySelectorAll('.qaqc-panel .qaqc-expand-button')).toHaveLength(2)
  })

  it('has no expand buttons when interactions are not allowed', () => {
    stubSize()
    view = draw({ interactive: false })
    expect(view.container.querySelector('.qaqc-expand-button')).toBeNull()
  })

  it('expands the activity chart with every value and the activity week table', () => {
    stubSize(1200, 400)
    view = draw()
    const gridLabels = panel(view.container, ACTIVITY_TITLE)?.querySelectorAll('.qaqc-overview-label').length ?? 0
    const open = expandPanel(view.container, ACTIVITY_TITLE)
    expect(open.querySelectorAll('.qaqc-overview-label').length).toBeGreaterThan(gridLabels)
    const table = open.querySelector('table.qaqc-overview-table')
    expect(table?.getAttribute('aria-rowcount')).toBe('31')
    expect([...(table?.querySelectorAll('thead th') ?? [])].map((cell) => cell.textContent))
      .toEqual(['Week', 'Electrical Finals', 'Electrical SORs', 'Mechanical Finals', 'Mechanical SORs'])
    expect(view.container.querySelector('.qaqc-root.is-expanded')).not.toBeNull()
  })

  it('expands the quality rates chart with every value and the rates week table', () => {
    stubSize(1200, 400)
    view = draw()
    const gridLabels = panel(view.container, RATES_TITLE)?.querySelectorAll('.qaqc-overview-label').length ?? 0
    const open = expandPanel(view.container, RATES_TITLE)
    expect(open.querySelectorAll('.qaqc-overview-label').length).toBeGreaterThan(gridLabels)
    expect(open.querySelector('table.qaqc-overview-table caption')?.textContent).toBe('Quality rates by work week')
  })

  it('collapses on Esc and returns focus to the expand button', () => {
    stubSize()
    view = draw()
    for (const title of [ACTIVITY_TITLE, RATES_TITLE]) {
      const open = expandPanel(view.container, title)
      act(() => {
        open.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      })
      expect(view.container.querySelector('[role="dialog"]')).toBeNull()
      expect(document.activeElement).toBe(expandButton(view.container, title))
    }
  })
})
