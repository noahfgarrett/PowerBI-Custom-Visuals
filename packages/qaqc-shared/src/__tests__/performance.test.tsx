import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ChartColors } from '../chartTypes'
import { splitCombinedRows } from '../combined'
import { formatNcrRate, PerformanceTable, type PerformanceTableProps } from '../components/PerformanceTable'
import { PersonDetail, type PersonDetailProps } from '../components/PersonDetail'
import { PersonWeekChart, type PersonWeekChartProps } from '../components/PersonWeekChart'
import { TrendStrip } from '../components/TrendStrip'
import { TABLE_ROW_HEIGHT } from '../hooks/useVirtualRows'
import { buildPerformanceIndex } from '../performance'
import type { PerformanceIndex, PerformanceRow, PerformanceTrendWeek, PersonWeek } from '../performance'
import type { CombinedColumns, RangeMode, ViewState } from '../types'
import { enumerateWorkWeeks, makeWorkWeek } from '../workWeeks'
import { countCompares } from './countCompares'
import { COMBINED_COLUMNS, COMBINED_ROWS } from './fixtures/combinedRows'
import { render, type Rendered } from './render'
import { ruleBody } from './stylesheet'

const COLORS: ChartColors = {
  series1: '#2E5AAC', series2: '#86B6EF', series3: '#1A9C7B', good: '#0A7A0A', bad: '#D03B3B', warn: '#B45309', card: '#FDFEFF',
  grid: '#EBEEF3', axisText: '#6A7583', ink: '#1B2530', accent: '#2E5AAC',
}
/** Power BI's high-contrast colours as resolveTheme maps them: everything is the foreground except bad and accent. */
const HIGH_CONTRAST: ChartColors = {
  series1: '#FFFFFF', series2: '#FFFF00', series3: '#FFFFFF', good: '#FFFFFF', bad: '#FFFF00', warn: '#FFFFFF', card: '#000000',
  grid: '#FFFFFF', axisText: '#FFFFFF', ink: '#FFFFFF', accent: '#FFFF00',
}

let view: Rendered | null = null

afterEach(() => {
  view?.unmount()
  view = null
  vi.restoreAllMocks()
})

function all(root: ParentNode, selector: string): Element[] {
  return [...root.querySelectorAll(selector)]
}

function numberAttr(node: Element, name: string): number {
  return Number(node.getAttribute(name))
}

/** Every numeric attribute in the subtree, to check none is NaN. */
function numericAttributes(root: Element): string[] {
  const values: string[] = []
  for (const node of [root, ...root.querySelectorAll('*')]) {
    for (const name of ['x', 'y', 'width', 'height']) {
      const value = node.getAttribute(name)
      if (value !== null) values.push(value)
    }
  }
  return values
}

function trendOf(volumes: number[], ncrWeeks: number[] = []): PerformanceTrendWeek[] {
  return volumes.map((volume, index) => ({ volume, hasNcr: ncrWeeks.includes(index) }))
}

describe('TrendStrip', () => {
  const thirty = trendOf(Array.from({ length: 30 }, (_, index) => (index % 5) + 1), [3, 29])

  it('is hidden from assistive technology', () => {
    view = render(<TrendStrip trend={thirty} colors={COLORS} isHighContrast={false} />)
    expect(view.container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('draws one bar per week with volume', () => {
    view = render(<TrendStrip trend={thirty} colors={COLORS} isHighContrast={false} />)
    expect(all(view.container, '.qaqc-perf-trend-bar')).toHaveLength(30)
  })

  it('draws weeks with an NCR in the bad colour', () => {
    view = render(<TrendStrip trend={thirty} colors={COLORS} isHighContrast={false} />)
    const ncrBars = all(view.container, '.qaqc-perf-trend-bar.is-ncr')
    expect(ncrBars).toHaveLength(2)
    expect(ncrBars.every((bar) => bar.getAttribute('fill') === COLORS.bad)).toBe(true)
    const others = all(view.container, '.qaqc-perf-trend-bar:not(.is-ncr)')
    expect(others.every((bar) => bar.getAttribute('fill') !== COLORS.bad)).toBe(true)
  })

  it('scales the tallest week to the full bar height', () => {
    view = render(<TrendStrip trend={trendOf([1, 4, 2])} colors={COLORS} isHighContrast={false} />)
    const heights = all(view.container, '.qaqc-perf-trend-bar').map((bar) => numberAttr(bar, 'height'))
    expect(heights[1]).toBeGreaterThan(heights[2])
    expect(heights[2]).toBeGreaterThan(heights[0])
    expect(heights[1]).toBe(Math.max(...heights))
  })

  it('right-aligns a trend shorter than 30 weeks, so the latest week sits at the right edge', () => {
    view = render(<TrendStrip trend={trendOf([2, 3, 4])} colors={COLORS} isHighContrast={false} />)
    const svgWidth = numberAttr(view.container.querySelector('svg') ?? document.createElement('svg'), 'width')
    const bars = all(view.container, '.qaqc-perf-trend-bar')
    const last = bars[bars.length - 1]
    expect(numberAttr(last, 'x') + numberAttr(last, 'width')).toBeCloseTo(svgWidth, 5)
    // The full 30-week strip: the three bars occupy the last three slots, not the first three.
    const fullBars = (() => {
      const full = render(<TrendStrip trend={thirty} colors={COLORS} isHighContrast={false} />)
      const xs = all(full.container, '.qaqc-perf-trend-bar').map((bar) => numberAttr(bar, 'x'))
      full.unmount()
      return xs
    })()
    expect(bars.map((bar) => numberAttr(bar, 'x'))).toEqual(fullBars.slice(27))
  })

  it('skips weeks with no volume and keeps their slots', () => {
    view = render(<TrendStrip trend={trendOf([2, 0, 4])} colors={COLORS} isHighContrast={false} />)
    expect(all(view.container, '.qaqc-perf-trend-bar')).toHaveLength(2)
  })

  it('draws an all-zero trend as a bare baseline without NaN', () => {
    view = render(<TrendStrip trend={trendOf([0, 0, 0, 0])} colors={COLORS} isHighContrast={false} />)
    const svg = view.container.querySelector('svg')
    if (!svg) throw new Error('svg missing')
    expect(all(svg, '.qaqc-perf-trend-bar')).toHaveLength(0)
    expect(svg.querySelector('.qaqc-perf-trend-baseline')).not.toBeNull()
    expect(numericAttributes(svg).some((value) => value === 'NaN')).toBe(false)
  })

  it('draws an empty trend as a bare baseline without NaN', () => {
    view = render(<TrendStrip trend={[]} colors={COLORS} isHighContrast={false} />)
    const svg = view.container.querySelector('svg')
    if (!svg) throw new Error('svg missing')
    expect(all(svg, '.qaqc-perf-trend-bar')).toHaveLength(0)
    expect(numericAttributes(svg).some((value) => value === 'NaN')).toBe(false)
  })

  it('draws the volume bars in the foreground colour in high contrast', () => {
    view = render(<TrendStrip trend={thirty} colors={HIGH_CONTRAST} isHighContrast />)
    const fills = new Set(all(view.container, '.qaqc-perf-trend-bar:not(.is-ncr)').map((bar) => bar.getAttribute('fill')))
    expect([...fills]).toEqual([HIGH_CONTRAST.ink])
  })

  it('draws NCR weeks in the high-contrast selected colour, the theme bad colour there', () => {
    view = render(<TrendStrip trend={thirty} colors={HIGH_CONTRAST} isHighContrast />)
    const marks = all(view.container, '.qaqc-perf-trend-bar.is-ncr, .qaqc-perf-trend-flag')
    expect(marks).toHaveLength(4)
    expect(marks.every((mark) => mark.getAttribute('fill') === HIGH_CONTRAST.bad)).toBe(true)
  })

  it.each([
    ['the normal theme', COLORS, false],
    ['high contrast', HIGH_CONTRAST, true],
  ] as const)('marks NCR weeks with a flag above the bar in %s, so colour is not the only signal', (_, colors, isHighContrast) => {
    view = render(<TrendStrip trend={thirty} colors={colors} isHighContrast={isHighContrast} />)
    const flags = all(view.container, '.qaqc-perf-trend-flag')
    expect(flags).toHaveLength(2)
    expect(flags.every((flag) => flag.getAttribute('fill') === colors.bad)).toBe(true)
    const ncrBars = all(view.container, '.qaqc-perf-trend-bar.is-ncr')
    expect(flags.map((flag) => numberAttr(flag, 'x'))).toEqual(ncrBars.map((bar) => numberAttr(bar, 'x')))
    expect(flags.every((flag) => numberAttr(flag, 'y') + numberAttr(flag, 'height') <= Math.min(...ncrBars.map((bar) => numberAttr(bar, 'y'))))).toBe(true)
  })
})

function personRow(name: string, overrides: Partial<PerformanceRow> = {}): PerformanceRow {
  return {
    key: name.toLowerCase(),
    name,
    tags: ['E'],
    volume: 10,
    sors: 0,
    ncrs: 0,
    rate: 0,
    trend: trendOf(Array.from({ length: 30 }, () => 1)),
    ncrWeeks: 0,
    ...overrides,
  }
}

// Model order: ranked by rate, then NCRs, then name. Values are chosen so every column orders the rows differently.
const RANKED: PerformanceRow[] = [
  personRow('QCR 10', { volume: 20, sors: 1, ncrs: 4, rate: 20, ncrWeeks: 3 }),
  personRow('QCR 2', { volume: 50, sors: 3, ncrs: 5, rate: 10, ncrWeeks: 5, tags: ['E', 'M'] }),
  personRow('QCR 01', { volume: 40, sors: 0, ncrs: 2, rate: 5, ncrWeeks: 1, tags: ['M'] }),
  personRow('QCR 3', { volume: 30, sors: 2, ncrs: 0, rate: 0, ncrWeeks: 0 }),
]
const BELOW: PerformanceRow[] = [
  personRow('QCR 21', { volume: 4, sors: 0, ncrs: 1, rate: 25, ncrWeeks: 1 }),
  personRow('QCR 20', { volume: 3, sors: 5, ncrs: 0, rate: 0, ncrWeeks: 0 }),
  personRow('QCR 22', { volume: 0, sors: 2, ncrs: 0, rate: null, ncrWeeks: 0 }),
]
const NOT_RECORDED: PerformanceRow = personRow('Not recorded', { key: '', tags: [], volume: 7, sors: 120, ncrs: 1, rate: 100 / 7, ncrWeeks: 1 })

function drawTable(overrides: Partial<PerformanceTableProps> = {}): Rendered {
  return render(
    <PerformanceTable
      group="qcr"
      ranked={RANKED}
      belowMinimum={BELOW}
      notRecorded={NOT_RECORDED}
      colors={COLORS}
      isHighContrast={false}
      onOpenPerson={vi.fn()}
      {...overrides}
    />,
  )
}

function fire(target: Element, event: Event): void {
  act(() => {
    target.dispatchEvent(event)
  })
}

function bodyRows(root: HTMLElement): HTMLTableRowElement[] {
  return [...root.querySelectorAll<HTMLTableRowElement>('tbody tr[aria-rowindex]')]
}

/** Each rendered row's block and name: `ranked:QCR 10`, `disclosure`, `below:QCR 21`, `not-recorded`. */
function layout(root: HTMLElement): string[] {
  return bodyRows(root).map((row) => {
    if (row.classList.contains('qaqc-perf-disclosure-row')) return 'disclosure'
    if (row.classList.contains('is-not-recorded')) return 'not-recorded'
    const name = row.querySelector('.qaqc-perf-name')?.textContent ?? ''
    return `${row.classList.contains('is-below') ? 'below' : 'ranked'}:${name}`
  })
}

function blocks(root: HTMLElement): string[] {
  return layout(root).map((entry) => entry.split(':')[0])
}

function names(root: HTMLElement, block: 'ranked' | 'below'): string[] {
  return layout(root).filter((entry) => entry.startsWith(`${block}:`)).map((entry) => entry.slice(block.length + 1))
}

function headerCell(root: HTMLElement, name: string): HTMLTableCellElement {
  const cell = [...root.querySelectorAll('thead th')].find((item) => item.textContent === name)
  if (!(cell instanceof HTMLTableCellElement)) throw new Error(`header ${name} missing`)
  return cell
}

function sortBy(root: HTMLElement, name: string): void {
  const button = headerCell(root, name).querySelector('button')
  if (!button) throw new Error(`button ${name} missing`)
  fire(button, new MouseEvent('click', { bubbles: true }))
}

function disclosure(root: HTMLElement): HTMLButtonElement {
  const button = root.querySelector<HTMLButtonElement>('.qaqc-perf-disclosure-row button')
  if (!button) throw new Error('disclosure missing')
  return button
}

function expand(root: HTMLElement): void {
  fire(disclosure(root), new MouseEvent('click', { bubbles: true }))
}

function rowNamed(root: HTMLElement, name: string): HTMLTableRowElement {
  const row = bodyRows(root).find((item) => item.querySelector('.qaqc-perf-name')?.textContent === name)
  if (!row) throw new Error(`row ${name} missing`)
  return row
}

function notRecordedRow(root: HTMLElement): HTMLTableRowElement {
  const row = root.querySelector<HTMLTableRowElement>('tbody tr.is-not-recorded')
  if (!row) throw new Error('Not recorded row missing')
  return row
}

function cellTexts(row: HTMLTableRowElement): string[] {
  return [...row.cells].map((cell) => cell.textContent ?? '')
}

describe('PerformanceTable columns', () => {
  it('heads the QCR / FE table with Name, Finals, SORs, NCRs, NCR rate and Trend', () => {
    view = drawTable()
    expect([...view.container.querySelectorAll('thead th')].map((cell) => cell.textContent)).toEqual(['Name', 'Finals', 'SORs', 'NCRs', 'NCR rate', 'Trend'])
  })

  it('heads the welders table with Welder, Welds, NCRs, NCR rate and Trend', () => {
    view = drawTable({ group: 'welders' })
    expect([...view.container.querySelectorAll('thead th')].map((cell) => cell.textContent)).toEqual(['Welder', 'Welds', 'NCRs', 'NCR rate', 'Trend'])
  })

  it('shows the counts and the NCR rate to two decimals', () => {
    view = drawTable({ ranked: [personRow('QCR 02', { volume: 65, sors: 0, ncrs: 2, rate: (2 / 65) * 100 })] })
    expect(cellTexts(rowNamed(view.container, 'QCR 02')).slice(1, 5)).toEqual(['65', '0', '2', '3.08%'])
  })

  it('shows n/a for a person with no finals', () => {
    view = drawTable()
    expand(view.container)
    expect(cellTexts(rowNamed(view.container, 'QCR 22'))[4]).toBe('n/a')
  })

  it('quiets a zero NCR rate next to one with NCRs', () => {
    view = drawTable()
    expect(rowNamed(view.container, 'QCR 3').querySelector('.qaqc-perf-rate')?.classList.contains('is-zero')).toBe(true)
    expect(rowNamed(view.container, 'QCR 10').querySelector('.qaqc-perf-rate')?.classList.contains('is-zero')).toBe(false)
  })

  it('tags QCR / FE names with their disciplines', () => {
    view = drawTable()
    const tags = (name: string): string[] => [...rowNamed(view?.container ?? document.body, name).querySelectorAll('.qaqc-perf-tag')].map((tag) => tag.textContent ?? '')
    expect(tags('QCR 2')).toEqual(['E', 'M'])
    expect(tags('QCR 01')).toEqual(['M'])
  })

  it('spells out each tag for screen readers', () => {
    view = drawTable()
    expect(rowNamed(view.container, 'QCR 2').querySelector('th')?.textContent).toContain('Electrical')
    expect(rowNamed(view.container, 'QCR 2').querySelector('th')?.textContent).toContain('Mechanical')
  })

  it('draws no tags for welders', () => {
    view = drawTable({ group: 'welders', ranked: [personRow('Welder 001', { tags: [] })] })
    expect(view.container.querySelectorAll('.qaqc-perf-tag')).toHaveLength(0)
  })

  it('draws a trend strip in every row', () => {
    view = drawTable()
    expect(rowNamed(view.container, 'QCR 10').querySelector('.qaqc-perf-trend')).not.toBeNull()
    expect(notRecordedRow(view.container).querySelector('.qaqc-perf-trend')).not.toBeNull()
  })

  it('tells screen readers how many of the last 30 weeks had an NCR', () => {
    view = drawTable()
    expect(rowNamed(view.container, 'QCR 2').textContent).toContain('NCRs in 5 of the last 30 weeks')
  })

  it('counts against the trend length when the data has fewer than 30 weeks', () => {
    view = drawTable({ ranked: [personRow('QCR 1', { trend: trendOf([1, 2, 3, 4], [2]), ncrWeeks: 1 })] })
    expect(rowNamed(view.container, 'QCR 1').textContent).toContain('NCRs in 1 of the last 4 weeks')
  })

  it('says one NCR week in the singular', () => {
    view = drawTable({ ranked: [personRow('QCR 1', { ncrWeeks: 1 })] })
    expect(rowNamed(view.container, 'QCR 1').textContent).toContain('NCRs in 1 of the last 30 weeks')
  })

  it('words a one-week trend without an NCR as a plain sentence', () => {
    view = drawTable({ ranked: [personRow('QCR 1', { trend: trendOf([3]), ncrWeeks: 0 })] })
    const text = rowNamed(view.container, 'QCR 1').textContent ?? ''
    expect(text).toContain('No NCRs in the last week')
    expect(text).not.toContain('of the last 1')
  })

  it('words a one-week trend with an NCR as a plain sentence', () => {
    view = drawTable({ ranked: [personRow('QCR 1', { trend: trendOf([3], [0]), ncrWeeks: 1 })] })
    expect(rowNamed(view.container, 'QCR 1').textContent).toContain('NCRs in the last week')
  })

  it('names the table for screen readers by group', () => {
    view = drawTable()
    expect(view.container.querySelector('caption')?.textContent).toBe('QCR / FE NCR performance')
    view.unmount()
    view = drawTable({ group: 'welders' })
    expect(view.container.querySelector('caption')?.textContent).toBe('Welder NCR performance')
  })
})

describe('PerformanceTable stylesheet', () => {
  it('indents below-minimum names outside the name button, so the focus ring hugs the name', () => {
    expect(ruleBody('.qaqc-perf-row.is-below .qaqc-perf-name-cell')).toContain('padding-left: 18px')
    expect(ruleBody('.qaqc-perf-row.is-below .qaqc-perf-name')).not.toContain('padding-left')
  })
})

describe('PerformanceTable blocks', () => {
  it('lists the ranked people in model order, then the collapsed below-minimum group, then Not recorded', () => {
    view = drawTable()
    expect(layout(view.container)).toEqual(['ranked:QCR 10', 'ranked:QCR 2', 'ranked:QCR 01', 'ranked:QCR 3', 'disclosure', 'not-recorded'])
  })

  it('labels the disclosure with the number of people below the minimum', () => {
    view = drawTable()
    expect(disclosure(view.container).textContent).toBe('Below minimum (3 people)')
    expect(disclosure(view.container).getAttribute('aria-expanded')).toBe('false')
  })

  it('says person for one person below the minimum', () => {
    view = drawTable({ belowMinimum: [BELOW[0]] })
    expect(disclosure(view.container).textContent).toBe('Below minimum (1 person)')
  })

  it('expands the below-minimum group between the disclosure and Not recorded', () => {
    view = drawTable()
    expand(view.container)
    expect(disclosure(view.container).getAttribute('aria-expanded')).toBe('true')
    expect(layout(view.container).slice(4)).toEqual(['disclosure', 'below:QCR 21', 'below:QCR 20', 'below:QCR 22', 'not-recorded'])
  })

  it('collapses the group again', () => {
    view = drawTable()
    expand(view.container)
    expand(view.container)
    expect(disclosure(view.container).getAttribute('aria-expanded')).toBe('false')
    expect(blocks(view.container)).not.toContain('below')
  })

  it('leaves out the disclosure when nobody is below the minimum', () => {
    view = drawTable({ belowMinimum: [] })
    expect(blocks(view.container)).toEqual(['ranked', 'ranked', 'ranked', 'ranked', 'not-recorded'])
  })

  it('leaves out Not recorded when every row has a name', () => {
    view = drawTable({ notRecorded: null })
    expect(blocks(view.container)).not.toContain('not-recorded')
  })

  it('shows a message when the period has no rows', () => {
    view = drawTable({ ranked: [], belowMinimum: [], notRecorded: null })
    expect(view.container.querySelector('.qaqc-perf-empty')?.textContent).toBe('No finals or SORs in this period')
  })

  it('tells screen readers the full row count', () => {
    view = drawTable()
    // Header, 4 ranked rows, the disclosure and Not recorded.
    expect(view.container.querySelector('table')?.getAttribute('aria-rowcount')).toBe('7')
  })
})

describe('PerformanceTable sorting', () => {
  it('starts in model order with no sorted column', () => {
    view = drawTable()
    expect(view.container.querySelectorAll('thead th[aria-sort]')).toHaveLength(0)
  })

  it.each(['Name', 'Finals', 'SORs', 'NCRs', 'NCR rate', 'Trend'])('keeps the blocks in order when sorting by %s, both ways', (column) => {
    view = drawTable()
    expand(view.container)
    const expected = ['ranked', 'ranked', 'ranked', 'ranked', 'disclosure', 'below', 'below', 'below', 'not-recorded']
    sortBy(view.container, column)
    expect(blocks(view.container)).toEqual(expected)
    sortBy(view.container, column)
    expect(blocks(view.container)).toEqual(expected)
  })

  it('marks the sorted header with aria-sort', () => {
    view = drawTable()
    sortBy(view.container, 'NCRs')
    expect(headerCell(view.container, 'NCRs').getAttribute('aria-sort')).toBe('descending')
    expect(headerCell(view.container, 'Name').hasAttribute('aria-sort')).toBe(false)
    sortBy(view.container, 'NCRs')
    expect(headerCell(view.container, 'NCRs').getAttribute('aria-sort')).toBe('ascending')
  })

  it('sorts names A to Z first, numeric-aware', () => {
    view = drawTable()
    expand(view.container)
    sortBy(view.container, 'Name')
    expect(headerCell(view.container, 'Name').getAttribute('aria-sort')).toBe('ascending')
    expect(names(view.container, 'ranked')).toEqual(['QCR 01', 'QCR 2', 'QCR 3', 'QCR 10'])
    expect(names(view.container, 'below')).toEqual(['QCR 20', 'QCR 21', 'QCR 22'])
  })

  it('sorts counts largest first', () => {
    view = drawTable()
    expand(view.container)
    sortBy(view.container, 'SORs')
    expect(names(view.container, 'ranked')).toEqual(['QCR 2', 'QCR 3', 'QCR 10', 'QCR 01'])
    expect(names(view.container, 'below')).toEqual(['QCR 20', 'QCR 22', 'QCR 21'])
  })

  it('sorts the NCR rate highest first, with n/a last', () => {
    view = drawTable()
    expand(view.container)
    sortBy(view.container, 'NCR rate')
    expect(names(view.container, 'below')).toEqual(['QCR 21', 'QCR 20', 'QCR 22'])
  })

  it('keeps n/a last when the NCR rate sorts lowest first', () => {
    view = drawTable()
    expand(view.container)
    sortBy(view.container, 'NCR rate')
    sortBy(view.container, 'NCR rate')
    expect(names(view.container, 'below')).toEqual(['QCR 20', 'QCR 21', 'QCR 22'])
  })

  it('sorts the trend by the number of NCR weeks', () => {
    view = drawTable()
    sortBy(view.container, 'Trend')
    expect(names(view.container, 'ranked')).toEqual(['QCR 2', 'QCR 10', 'QCR 01', 'QCR 3'])
  })

  it('sorts number columns without the collator', () => {
    const calls = countCompares()
    view = drawTable()
    expand(view.container)
    sortBy(view.container, 'NCRs')
    sortBy(view.container, 'NCR rate')
    expect(calls()).toBe(0)
  })

  it('ranks the names once per data set, however often the name sort comes back', () => {
    view = drawTable()
    expand(view.container)
    const calls = countCompares()
    sortBy(view.container, 'Name')
    const first = calls()
    expect(first).toBeGreaterThan(0)
    sortBy(view.container, 'NCRs')
    sortBy(view.container, 'Name')
    sortBy(view.container, 'Name')
    expect(calls()).toBe(first)
  })

  it('keeps model order among ties', () => {
    view = drawTable({ ranked: [personRow('B', { ncrs: 1 }), personRow('A', { ncrs: 1 }), personRow('C', { ncrs: 2 })] })
    sortBy(view.container, 'NCRs')
    expect(names(view.container, 'ranked')).toEqual(['C', 'B', 'A'])
  })
})

describe('PerformanceTable opening a person', () => {
  function nameButton(row: HTMLTableRowElement): HTMLButtonElement {
    const button = row.querySelector<HTMLButtonElement>('button.qaqc-perf-name')
    if (!button) throw new Error('name button missing')
    return button
  }

  it('makes the name button the one tab stop in each row', () => {
    view = drawTable()
    const row = rowNamed(view.container, 'QCR 2')
    expect(row.hasAttribute('tabindex')).toBe(false)
    expect(nameButton(row).tabIndex).toBe(0)
    expect([...row.querySelectorAll('[tabindex]')].filter((node) => node instanceof HTMLElement && node.tabIndex >= 0)).toHaveLength(0)
    nameButton(row).focus()
    expect(document.activeElement).toBe(nameButton(row))
  })

  it('opens a person once when their name is clicked, passing the row', () => {
    const onOpenPerson = vi.fn()
    view = drawTable({ onOpenPerson })
    const row = rowNamed(view.container, 'QCR 2')
    fire(nameButton(row), new MouseEvent('click', { bubbles: true }))
    expect(onOpenPerson).toHaveBeenCalledTimes(1)
    expect(onOpenPerson).toHaveBeenCalledWith('qcr 2', row)
  })

  it('opens a person from the keyboard through the native name button', () => {
    // Enter and Space on a focused <button type="button"> dispatch its click; jsdom does not synthesise that.
    const onOpenPerson = vi.fn()
    view = drawTable({ onOpenPerson })
    const row = rowNamed(view.container, 'QCR 01')
    const button = nameButton(row)
    expect(button.getAttribute('type')).toBe('button')
    button.focus()
    act(() => {
      button.click()
    })
    expect(onOpenPerson).toHaveBeenCalledTimes(1)
    expect(onOpenPerson).toHaveBeenCalledWith('qcr 01', row)
  })

  it('opens a person once when another cell of their row is clicked', () => {
    const onOpenPerson = vi.fn()
    view = drawTable({ onOpenPerson })
    const row = rowNamed(view.container, 'QCR 3')
    fire(row.cells[3], new MouseEvent('click', { bubbles: true }))
    expect(onOpenPerson).toHaveBeenCalledTimes(1)
    expect(onOpenPerson).toHaveBeenCalledWith('qcr 3', row)
  })

  /** The text of every element the button's aria-describedby names, in order. */
  function description(button: HTMLButtonElement): string[] {
    const ids = (button.getAttribute('aria-describedby') ?? '').split(' ').filter((id) => id !== '')
    return ids.map((id) => document.getElementById(id)?.textContent ?? `missing ${id}`)
  }

  it('describes the name button with the disciplines and the row trend text', () => {
    view = drawTable()
    expect(description(nameButton(rowNamed(view.container, 'QCR 2')))).toEqual([', Electrical and Mechanical', 'NCRs in 5 of the last 30 weeks'])
  })

  it('describes a welder name with the trend text alone', () => {
    view = drawTable({ group: 'welders', ranked: [personRow('Welder 001', { tags: [], ncrWeeks: 2 })] })
    expect(description(nameButton(rowNamed(view.container, 'Welder 001')))).toEqual(['NCRs in 2 of the last 30 weeks'])
  })

  it('gives every rendered row its own description', () => {
    view = drawTable()
    expand(view.container)
    const ids = bodyRows(view.container)
      .map((row) => row.querySelector('button.qaqc-perf-name')?.getAttribute('aria-describedby'))
      .filter((id): id is string => typeof id === 'string')
    expect(ids).toHaveLength(7)
    expect(new Set(ids).size).toBe(7)
  })

  it('opens a below-minimum person', () => {
    const onOpenPerson = vi.fn()
    view = drawTable({ onOpenPerson })
    expand(view.container)
    const row = rowNamed(view.container, 'QCR 20')
    fire(nameButton(row), new MouseEvent('click', { bubbles: true }))
    expect(onOpenPerson).toHaveBeenCalledWith('qcr 20', row)
  })

  it('cannot open Not recorded by click', () => {
    const onOpenPerson = vi.fn()
    view = drawTable({ onOpenPerson })
    const row = notRecordedRow(view.container)
    expect(row.hasAttribute('tabindex')).toBe(false)
    expect(row.querySelector('button')).toBeNull()
    fire(row.cells[0], new MouseEvent('click', { bubbles: true }))
    fire(row.cells[2], new MouseEvent('click', { bubbles: true }))
    expect(onOpenPerson).not.toHaveBeenCalled()
  })

  it('does not open anyone from the disclosure', () => {
    const onOpenPerson = vi.fn()
    view = drawTable({ onOpenPerson })
    expand(view.container)
    expect(onOpenPerson).not.toHaveBeenCalled()
  })
})

describe('PerformanceTable with many rows', () => {
  const MANY_RANKED = Array.from({ length: 5000 }, (_, index) => personRow(`Welder ${String(index + 1).padStart(4, '0')}`, { tags: [] }))
  const VIEWPORT_HEIGHT = 320

  function drawMany(): Rendered {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 900, VIEWPORT_HEIGHT))
    return drawTable({ group: 'welders', ranked: MANY_RANKED })
  }

  function scrollTo(root: HTMLElement, top: number): void {
    const wrap = root.querySelector('.qaqc-table-wrap')
    if (!(wrap instanceof HTMLElement)) throw new Error('wrap missing')
    wrap.scrollTop = top
    fire(wrap, new Event('scroll'))
  }

  it('renders only the rows near the viewport', () => {
    view = drawMany()
    expect(bodyRows(view.container).length).toBeLessThanOrEqual(Math.ceil(VIEWPORT_HEIGHT / TABLE_ROW_HEIGHT) + 20)
  })

  it('keeps every row at the fixed height the window assumes', () => {
    view = drawMany()
    expect(bodyRows(view.container).every((row) => row.style.height === `${TABLE_ROW_HEIGHT}px`)).toBe(true)
  })

  it('windows the disclosure and Not recorded rows with the people', () => {
    view = drawMany()
    expect(blocks(view.container)).not.toContain('disclosure')
    scrollTo(view.container, 5002 * TABLE_ROW_HEIGHT)
    expect(blocks(view.container).slice(-2)).toEqual(['disclosure', 'not-recorded'])
    expect(bodyRows(view.container).length).toBeLessThanOrEqual(Math.ceil(VIEWPORT_HEIGHT / TABLE_ROW_HEIGHT) + 20)
  })

  it('sorts the whole block, not only the rendered rows', () => {
    view = drawMany()
    sortBy(view.container, 'Welder')
    sortBy(view.container, 'Welder')
    expect(names(view.container, 'ranked')[0]).toBe('Welder 5000')
  })
})

/** Running NCR rate from the first week, as buildPersonDetail computes it. */
function personWeeks(counts: Array<[number, number]>, lastYear = 2026, lastWeek = 42): PersonWeek[] {
  const all = enumerateWorkWeeks(makeWorkWeek(lastYear - 12, 1), makeWorkWeek(lastYear, lastWeek))
  const weeks = all.slice(all.length - counts.length)
  let volume = 0
  let ncrs = 0
  return counts.map(([weekVolume, weekNcrs], index) => {
    volume += weekVolume
    ncrs += weekNcrs
    return { week: weeks[index], volume: weekVolume, ncrs: weekNcrs, runningRate: volume > 0 ? (ncrs / volume) * 100 : null }
  })
}

/** Deterministic weekly counts: the first `quiet` weeks have no volume, then 0–12 a week with an NCR now and then. */
function randomCounts(count: number, quiet: number, seed: number): Array<[number, number]> {
  let state = seed
  const next = (): number => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state / 2147483648
  }
  return Array.from({ length: count }, (_, index): [number, number] => {
    if (index < quiet) return [0, 0]
    const volume = Math.floor(next() * 13)
    const ncrs = volume > 0 && next() < 0.25 ? 1 + Math.floor(next() * Math.min(3, volume)) : 0
    return [volume, ncrs]
  })
}

const CHART_WEEKS = personWeeks([[0, 0], [0, 0], [4, 1], [6, 0], [3, 2], [0, 0], [5, 0]])

function drawChart(overrides: Partial<PersonWeekChartProps> = {}): Rendered {
  return render(
    <PersonWeekChart
      weeks={CHART_WEEKS}
      group="qcr"
      width={632}
      height={300}
      colors={COLORS}
      animate={false}
      onHover={vi.fn()}
      {...overrides}
    />,
  )
}

// Label metrics shared with the chart: 9.5 px bold digits are about 5.6 px wide, 7 px above the baseline and 2 below.
interface LabelBox {
  text: string
  left: number
  right: number
  top: number
  bottom: number
}

function chartLabelBox(node: Element): LabelBox {
  const text = node.textContent ?? ''
  const half = (text.length * 5.6) / 2
  const x = numberAttr(node, 'x')
  const y = numberAttr(node, 'y')
  return { text, left: x - half, right: x + half, top: y - 7, bottom: y + 2 }
}

function labelCollisions(root: ParentNode): Array<[string, string]> {
  const boxes = all(root, '.qaqc-perf-chart-label').map(chartLabelBox)
  const found: Array<[string, string]> = []
  boxes.forEach((a, i) => {
    boxes.slice(i + 1).forEach((b) => {
      if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) found.push([a.text, b.text])
    })
  })
  return found
}

// Axis tick text: 10.5 px digits are at most about 6.2 px wide, 8 px above the baseline and 3 below.
const AXIS_CHAR_WIDTH = 6.2

/** The box of an axis tick label, from its anchor: the count axis is end-anchored, the rate axis start-anchored. */
function axisTickBox(node: Element): LabelBox {
  const text = node.textContent ?? ''
  const width = text.length * AXIS_CHAR_WIDTH
  const x = numberAttr(node, 'x')
  const y = numberAttr(node, 'y')
  const isEndAnchored = node.getAttribute('text-anchor') === 'end'
  return { text, left: isEndAnchored ? x - width : x, right: isEndAnchored ? x : x + width, top: y - 8, bottom: y + 3 }
}

/** Point labels that overlap a left or right axis tick label. */
function axisCollisions(root: ParentNode): Array<[string, string]> {
  const ticks = all(root, '.qaqc-perf-count-axis-text, .qaqc-perf-rate-axis-text').map(axisTickBox)
  const found: Array<[string, string]> = []
  for (const label of all(root, '.qaqc-perf-chart-label').map(chartLabelBox)) {
    for (const tick of ticks) {
      if (label.left < tick.right && tick.left < label.right && label.top < tick.bottom && tick.top < label.bottom) found.push([label.text, tick.text])
    }
  }
  return found
}

/** The x of the path's start and of each curve's end point, in order. */
function pathXs(path: string): number[] {
  if (path === '') return []
  return path.split('C').map((segment) => {
    const pairs = segment.replace('M', '').trim().split(' ')
    return Number(pairs[pairs.length - 1].split(',')[0])
  })
}

describe('PersonWeekChart', () => {
  it('draws a Finals bar for each week with finals', () => {
    view = drawChart()
    expect(all(view.container, '.qaqc-perf-chart-bar.is-volume')).toHaveLength(4)
  })

  it('draws an NCR bar beside the Finals bar in the bad colour', () => {
    view = drawChart()
    const ncrBars = all(view.container, '.qaqc-perf-chart-bar.is-ncr')
    expect(ncrBars).toHaveLength(2)
    expect(ncrBars.every((bar) => bar.getAttribute('fill') === COLORS.bad)).toBe(true)
  })

  it('aligns the rate axis ticks with the count axis gridlines', () => {
    view = drawChart()
    const counts = all(view.container, '.qaqc-perf-count-axis-text').map((tick) => numberAttr(tick, 'y'))
    const rates = all(view.container, '.qaqc-perf-rate-axis-text').map((tick) => numberAttr(tick, 'y'))
    expect(rates).toEqual(counts)
  })

  it('labels the rate axis in percent', () => {
    view = drawChart()
    const rates = all(view.container, '.qaqc-perf-rate-axis-text').map((tick) => tick.textContent ?? '')
    expect(rates[0]).toBe('0%')
    expect(rates.every((text) => text.endsWith('%'))).toBe(true)
  })

  it('starts the running rate line at the first week with finals', () => {
    view = drawChart()
    const path = view.container.querySelector('.qaqc-perf-rate-line')?.getAttribute('d') ?? ''
    const firstX = pathXs(path)[0]
    // 7 weeks over the 540 px plot (x 44 to 584): the third week (the first with finals) is centred at 44 + 2.5 × 540 / 7.
    expect(firstX).toBeCloseTo(44 + (2.5 * 540) / 7, 1)
    expect(pathXs(path)).toHaveLength(5)
  })

  it('draws no rate line when the period has no finals', () => {
    view = drawChart({ weeks: personWeeks([[0, 0], [0, 0], [0, 0]]) })
    expect(view.container.querySelector('.qaqc-perf-rate-line')).toBeNull()
    expect(numericAttributes(view.container.querySelector('svg') ?? document.createElement('svg')).some((value) => value === 'NaN')).toBe(false)
  })

  it('draws an empty period without NaN', () => {
    view = drawChart({ weeks: [] })
    const svg = view.container.querySelector('svg')
    if (!svg) throw new Error('svg missing')
    expect(numericAttributes(svg).some((value) => value === 'NaN')).toBe(false)
  })

  it('names the chart with a static label', () => {
    view = drawChart()
    expect(view.container.querySelector('svg')?.getAttribute('aria-label')).toBe(
      "Finals and NCRs by work week, with the running NCR rate, WW36'2026 to WW42'2026",
    )
  })

  it('names the welder chart by welds', () => {
    view = drawChart({ group: 'welders' })
    expect(view.container.querySelector('svg')?.getAttribute('aria-label')).toMatch(/^Welds and NCRs by work week/)
  })

  it('draws the week axis with a year marker', () => {
    view = drawChart({ weeks: personWeeks([[1, 0], [2, 0], [3, 0]], 2027, 1) })
    expect(all(view.container, '.qaqc-week-axis-text').map((tick) => tick.textContent)).toEqual(['WW52', 'WW53', 'WW01'])
    expect(all(view.container, '.qaqc-axis-year').map((tick) => tick.textContent)).toEqual(['2026', '2027'])
  })

  it('shows the week, finals, NCRs and running rate in the tooltip', () => {
    const onHover = vi.fn()
    view = drawChart({ onHover })
    const hit = view.container.querySelector('.qaqc-perf-chart-hit')
    if (!hit) throw new Error('hit area missing')
    // jsdom puts the hit area at x 0, so the fifth week's band (index 4) starts at 4 × 540 / 7.
    fire(hit, new MouseEvent('mousemove', { bubbles: true, clientX: (4.5 * 540) / 7, clientY: 100 }))
    expect(onHover).toHaveBeenLastCalledWith({
      title: "WW40'2026",
      rows: [
        { label: 'Finals', value: '3' },
        { label: 'NCRs', value: '2' },
        { label: 'Running NCR rate', value: '23.08%' },
      ],
      clientX: (4.5 * 540) / 7,
      clientY: 100,
    })
  })

  it('shows n/a for the running rate before the first finals', () => {
    const onHover = vi.fn()
    view = drawChart({ onHover, group: 'welders' })
    const hit = view.container.querySelector('.qaqc-perf-chart-hit')
    if (!hit) throw new Error('hit area missing')
    fire(hit, new MouseEvent('mousemove', { bubbles: true, clientX: 10, clientY: 100 }))
    expect(onHover).toHaveBeenLastCalledWith(expect.objectContaining({
      rows: [
        { label: 'Welds', value: '0' },
        { label: 'NCRs', value: '0' },
        { label: 'Running NCR rate', value: 'n/a' },
      ],
    }))
  })

  it('hides the tooltip when the pointer leaves', () => {
    const onHover = vi.fn()
    view = drawChart({ onHover })
    const hit = view.container.querySelector('.qaqc-perf-chart-hit')
    if (!hit) throw new Error('hit area missing')
    fire(hit, new MouseEvent('mousemove', { bubbles: true, clientX: 10, clientY: 100 }))
    fire(hit, new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }))
    expect(onHover).toHaveBeenLastCalledWith(null)
  })

  it('offers no week selection', () => {
    view = drawChart()
    expect(view.container.querySelector('svg')?.hasAttribute('tabindex')).toBe(false)
    expect(view.container.querySelector('.qaqc-selected-band')).toBeNull()
  })

  const SIZES: Array<[number, number]> = [[480, 220], [900, 280], [1240, 340]]
  describe.each([30, 520])('at %i weeks', (count) => {
    const weeks = personWeeks(randomCounts(count, 3, count))

    it.each(SIZES)('places labels without collisions at %i × %i', (width, height) => {
      view = drawChart({ weeks, width, height })
      expect(labelCollisions(view.container)).toEqual([])
    })

    it.each(SIZES)('keeps labels clear of the axis tick labels at %i × %i', (width, height) => {
      view = drawChart({ weeks, width, height })
      expect(axisCollisions(view.container)).toEqual([])
    })

    it.each(SIZES)('keeps every label inside the chart at %i × %i', (width, height) => {
      view = drawChart({ weeks, width, height })
      const boxes = all(view.container, '.qaqc-perf-chart-label').map(chartLabelBox)
      expect(boxes.every((box) => box.left >= 0 && box.right <= width && box.top >= 0)).toBe(true)
    })

    it.each(SIZES)('labels the latest running rate at %i × %i', (width, height) => {
      view = drawChart({ weeks, width, height })
      const latest = weeks[weeks.length - 1]
      const label = view.container.querySelector(`.qaqc-perf-chart-label.is-rate[data-week="${latest.week.key}"]`)
      expect(label?.textContent).toBe(formatNcrRate(latest.runningRate))
    })
  })

  it('labels the bars when the bands are wide enough', () => {
    view = drawChart({ weeks: personWeeks(randomCounts(30, 3, 30)), width: 1240, height: 340 })
    expect(all(view.container, '.qaqc-perf-chart-label.is-volume').length).toBeGreaterThan(10)
    expect(all(view.container, '.qaqc-perf-chart-label.is-ncr').length).toBeGreaterThan(0)
  })

  it('draws no bar labels on narrow bands', () => {
    view = drawChart({ weeks: personWeeks(randomCounts(520, 3, 520)), width: 1240, height: 340 })
    expect(all(view.container, '.qaqc-perf-chart-label.is-volume')).toHaveLength(0)
  })

  it('keeps the node count to about two per week at 520 weeks', () => {
    view = drawChart({ weeks: personWeeks(randomCounts(520, 3, 7)) })
    expect(all(view.container, 'svg *').length).toBeLessThanOrEqual(2 * 520 + 150)
  })
})

type CombinedColumnName = (typeof COMBINED_COLUMNS)[number]

function position(name: CombinedColumnName): number {
  return COMBINED_COLUMNS.indexOf(name)
}

const FIXTURE_COLUMNS: CombinedColumns = {
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
  greenTags: -1,
}
const FIXTURE_TODAY = new Date(2026, 9, 15) // WW42'2026
const FIXTURE_WEEK = 202642

function fixtureIndex(): PerformanceIndex {
  return buildPerformanceIndex(splitCombinedRows(COMBINED_ROWS, FIXTURE_COLUMNS.source), FIXTURE_COLUMNS, FIXTURE_TODAY)
}

const FIXTURE_INDEX = fixtureIndex()

function fixtureView(range: RangeMode): ViewState {
  return { selectedKey: FIXTURE_WEEK, windowEndKey: FIXTURE_WEEK, range }
}

function drawDetail(overrides: Partial<PersonDetailProps> = {}): Rendered {
  return render(
    <PersonDetail
      index={FIXTURE_INDEX}
      group="qcr"
      personKey="qcr 02"
      view={fixtureView('recent')}
      colors={COLORS}
      animate={false}
      onHover={vi.fn()}
      {...overrides}
    />,
  )
}

function cardLabels(root: HTMLElement): string[] {
  return [...root.querySelectorAll('article.qaqc-kpi')].map((card) => card.getAttribute('aria-label') ?? '')
}

function groupHeads(root: HTMLElement): string[] {
  return [...root.querySelectorAll('.qaqc-kpi-group-head')].map((head) => head.textContent ?? '')
}

function ncrRows(root: HTMLElement): HTMLTableRowElement[] {
  return [...root.querySelectorAll<HTMLTableRowElement>('.qaqc-perf-ncr-table tbody tr[aria-rowindex]')]
}

function hoverChartWeek(root: HTMLElement): void {
  const hit = root.querySelector('.qaqc-perf-chart-hit')
  if (!hit) throw new Error('hit area missing')
  fire(hit, new MouseEvent('mousemove', { bubbles: true, clientX: 40, clientY: 100 }))
}

describe('PersonDetail', () => {
  it('shows a subtitle line with the group and the discipline tags', () => {
    view = drawDetail()
    const head = view.container.querySelector('.qaqc-perf-person-head')
    expect(head?.querySelector('.qaqc-perf-person-group')?.textContent).toBe('QCR / FE')
    expect([...(head?.querySelectorAll('.qaqc-perf-tag') ?? [])].map((tag) => tag.textContent)).toEqual(['E'])
  })

  it('leaves the name and its heading to the overlay title', () => {
    view = drawDetail()
    expect(view.container.querySelector('h1, h2, h3, h4')?.textContent).not.toBe('QCR 02')
    expect(view.container.querySelector('.qaqc-perf-person-head')?.textContent).not.toContain('QCR 02')
  })

  it('shows the period and all-time cards for a ranked QCR / FE (spec: QCR 02 65 / 2 / 3.08%, all 70 / 2 / 2.86%)', () => {
    view = drawDetail()
    expect(cardLabels(view.container)).toEqual([
      'Finals: 65. Final inspections',
      'NCRs: 2. Finals with an issue found',
      'NCR rate: 3.08%. NCRs ÷ finals',
      'Finals: 70. Final inspections',
      'NCRs: 2. Finals with an issue found',
      'NCR rate: 2.86%. NCRs ÷ finals',
    ])
  })

  it('heads the card groups with the period and the whole history', () => {
    view = drawDetail()
    expect(groupHeads(view.container)).toEqual(["This periodWW13'2026 to WW42'2026", "All timeWW51'2025 to WW42'2026"])
  })

  it('shows the period and all-time cards for a ranked welder (spec: Welder 024 22 / 3 / 13.64%, all 27 / 3 / 11.11%)', () => {
    view = drawDetail({ group: 'welders', personKey: 'welder 024' })
    expect(cardLabels(view.container)).toEqual([
      'Welds: 22. Welds credited',
      'NCRs: 3. Welds with an issue',
      'NCR rate: 13.64%. NCRs ÷ welds',
      'Welds: 27. Welds credited',
      'NCRs: 3. Welds with an issue',
      'NCR rate: 11.11%. NCRs ÷ welds',
    ])
    expect(view.container.querySelector('.qaqc-perf-person-group')?.textContent).toBe('Welder')
    expect(view.container.querySelectorAll('.qaqc-perf-person-head .qaqc-perf-tag')).toHaveLength(0)
  })

  it('uses the whole history as the period in All', () => {
    view = drawDetail({ group: 'welders', personKey: 'welder 024', view: fixtureView('all') })
    expect(cardLabels(view.container).slice(0, 3)).toEqual([
      'Welds: 27. Welds credited',
      'NCRs: 3. Welds with an issue',
      'NCR rate: 11.11%. NCRs ÷ welds',
    ])
  })

  it('lists one NCR row per NCR in the period, newest first', () => {
    view = drawDetail({ group: 'welders', personKey: 'welder 024' })
    const rows = ncrRows(view.container)
    expect(rows).toHaveLength(3)
    const header = view.container.querySelector('.qaqc-perf-ncr-table thead th[aria-sort]')
    expect(header?.textContent).toBe('Work Week')
    expect(header?.getAttribute('aria-sort')).toBe('descending')
    expect(rows.every((row) => row.cells[1].textContent === 'Welding')).toBe(true)
  })

  it('heads the NCR table with Work Week, Source, Building and Issue for QCR / FE', () => {
    view = drawDetail()
    expect([...view.container.querySelectorAll('.qaqc-perf-ncr-table thead th')].map((cell) => cell.textContent)).toEqual(['Work Week', 'Source', 'Building', 'Issue'])
  })

  it('heads the place column Tag No for welders', () => {
    view = drawDetail({ group: 'welders', personKey: 'welder 024' })
    expect([...view.container.querySelectorAll('.qaqc-perf-ncr-table thead th')].map((cell) => cell.textContent)).toEqual(['Work Week', 'Source', 'Tag No', 'Issue'])
  })

  it('shows the full Issue text in a title, so a long one can be ellipsized', () => {
    view = drawDetail()
    const issue = ncrRows(view.container)[0].cells[3]
    expect(issue.getAttribute('title')).toBe(issue.textContent)
    expect(issue.classList.contains('qaqc-perf-ncr-issue')).toBe(true)
  })

  it('names the NCR table with its sort', () => {
    view = drawDetail()
    const caption = (): string => view?.container.querySelector('.qaqc-perf-ncr-table caption')?.textContent ?? ''
    expect(caption()).toBe("NCRs for QCR 02, WW13'2026 to WW42'2026, by Work Week, newest first")
    const button = (name: string): Element => {
      const found = [...(view?.container.querySelectorAll('.qaqc-perf-ncr-table thead th button') ?? [])].find((item) => item.textContent === name)
      if (!found) throw new Error(`${name} button missing`)
      return found
    }
    fire(button('Work Week'), new MouseEvent('click', { bubbles: true }))
    expect(caption()).toBe("NCRs for QCR 02, WW13'2026 to WW42'2026, by Work Week, oldest first")
    fire(button('Source'), new MouseEvent('click', { bubbles: true }))
    expect(caption()).toBe("NCRs for QCR 02, WW13'2026 to WW42'2026, by Source, A to Z")
    fire(button('Source'), new MouseEvent('click', { bubbles: true }))
    expect(caption()).toBe("NCRs for QCR 02, WW13'2026 to WW42'2026, by Source, Z to A")
  })

  it('sorts the NCR table by Work Week oldest first on a second click', () => {
    view = drawDetail({ group: 'welders', personKey: 'welder 024' })
    const before = ncrRows(view.container).map((row) => row.cells[0].textContent)
    const button = [...view.container.querySelectorAll('.qaqc-perf-ncr-table thead th button')].find((item) => item.textContent === 'Work Week')
    if (!button) throw new Error('Work Week button missing')
    fire(button, new MouseEvent('click', { bubbles: true }))
    const after = ncrRows(view.container).map((row) => row.cells[0].textContent)
    expect(after[0]).toBe(before[before.length - 1])
    expect(after[after.length - 1]).toBe(before[0])
  })

  it('shows an empty state when the period has no NCRs', () => {
    view = drawDetail({ personKey: 'qcr 01' })
    expect(view.container.querySelector('.qaqc-perf-ncr-table')).toBeNull()
    expect(view.container.querySelector('.qaqc-perf-person-empty strong')?.textContent).toBe('No NCRs in this period')
    expect(cardLabels(view.container)[0]).toBe('Finals: 94. Final inspections')
  })

  it('says how many finals the period had when none had an NCR', () => {
    view = drawDetail({ personKey: 'qcr 01' })
    expect(view.container.querySelector('.qaqc-perf-person-empty span')?.textContent).toBe("94 finals in WW13'2026 to WW42'2026, none with an NCR.")
  })

  it('shows a message instead of the chart and says so when the period has only SORs', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 900, 260))
    view = drawDetail({ personKey: 'qcr 09' })
    expect(view.container.querySelector('.qaqc-perf-person-chart .qaqc-chart-empty')?.textContent).toBe('No finals in this period')
    expect(view.container.querySelector('.qaqc-perf-person-empty span')?.textContent).toBe("No finals in WW13'2026 to WW42'2026.")
  })

  it('shows a message for a key that is not in the group', () => {
    view = drawDetail({ personKey: 'nobody' })
    expect(view.container.querySelector('.qaqc-perf-person-missing')?.textContent).toBe('This person has no rows in the data')
    expect(cardLabels(view.container)).toHaveLength(0)
  })

  it('draws the week chart for the period', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 900, 260))
    view = drawDetail()
    expect(view.container.querySelector('.qaqc-perf-chart')?.getAttribute('aria-label')).toBe(
      "Finals and NCRs by work week, with the running NCR rate, WW13'2026 to WW42'2026",
    )
  })

  // A rebuilt detail hands the chart new weeks, and the chart drops its hovered week when its weeks change; so a
  // hover that survives a re-render shows the detail was not rebuilt.
  it('keeps the detail across unrelated re-renders, so the hovered chart week survives', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 900, 260))
    const props: PersonDetailProps = { index: FIXTURE_INDEX, group: 'qcr', personKey: 'qcr 02', view: fixtureView('recent'), colors: COLORS, animate: false, onHover: vi.fn() }
    view = render(<PersonDetail {...props} />)
    hoverChartWeek(view.container)
    expect(view.container.querySelector('.qaqc-perf-chart-hover')).not.toBeNull()
    // A new view object with the same values and a new hover handler, as a dashboard re-render gives.
    view.rerender(<PersonDetail {...props} view={fixtureView('recent')} onHover={vi.fn()} />)
    expect(view.container.querySelector('.qaqc-perf-chart-hover')).not.toBeNull()
  })

  it('rebuilds the detail when the period changes', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 900, 260))
    const props: PersonDetailProps = { index: FIXTURE_INDEX, group: 'qcr', personKey: 'qcr 02', view: fixtureView('recent'), colors: COLORS, animate: false, onHover: vi.fn() }
    view = render(<PersonDetail {...props} />)
    hoverChartWeek(view.container)
    view.rerender(<PersonDetail {...props} view={fixtureView('all')} />)
    expect(view.container.querySelector('.qaqc-perf-chart-hover')).toBeNull()
    expect(cardLabels(view.container)[0]).toBe('Finals: 70. Final inspections')
  })
})
