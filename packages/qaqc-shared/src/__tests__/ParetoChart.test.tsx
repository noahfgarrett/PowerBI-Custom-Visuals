import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { boxesOverlap, type LabelBox } from '../chartLabels'
import type { ChartColors } from '../chartTypes'
import { axisLabelBoxes, layoutPareto, ParetoChart, valueLabelBox, wrapAxisLabel } from '../components/ParetoChart'
import { buildIssueIndex } from '../issues'
import type { ParetoBar } from '../rootCauses'
import { buildRootCausePareto } from '../rootCauses'
import { compositeOver } from '../theme'
import type { IssueColumns, ViewState } from '../types'
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
const ALL: ViewState = { selectedKey: 202642, windowEndKey: 202642, range: 'all' }
const INDEX = buildIssueIndex(ISSUE_ROWS, COLUMNS, TODAY)
const ALL_ISSUES = buildRootCausePareto(INDEX, ALL, 'all', TODAY)
const OPEN_ONLY = buildRootCausePareto(INDEX, ALL, 'open', TODAY)
// 30 WW to WW42: Other is the tallest bar, so the line ends right above its count label.
const RECENT = buildRootCausePareto(INDEX, { ...ALL, range: 'recent' }, 'all', TODAY)

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

/** Long names, a Not recorded bar and counts of every width, so the layout has to wrap, shrink and dodge. */
function crowdedBars(): ParetoBar[] {
  const names = [
    'Installation of temporary electrical distribution equipment',
    'Casting/Pouring/Erection',
    'Coordination',
    'Supercalifragilisticexpialidocious',
    'Incomplete Work',
    'Trade Damage',
    'Housekeeping',
    'Bonding',
    'Documentation Incomplete',
  ]
  const counts = [1240, 610, 402, 398, 120, 64, 12, 9, 2]
  const total = counts.reduce((sum, count) => sum + count, 0) + 300 + 41
  let running = 0
  const bars: ParetoBar[] = names.map((label, at) => {
    running += counts[at]
    return {
      key: `cause:${label.toLowerCase()}`,
      label,
      count: counts[at],
      share: (counts[at] / total) * 100,
      cumulative: (running / (total - 41)) * 100,
      vital: at <= 3,
      kind: 'cause',
      causes: [label],
    }
  })
  bars.push({ key: 'other', label: 'Other (31 causes)', count: 300, share: (300 / total) * 100, cumulative: 100, vital: false, kind: 'other', causes: ['A', 'B'] })
  bars.push({ key: 'notRecorded', label: 'Not recorded', count: 41, share: (41 / total) * 100, cumulative: null, vital: false, kind: 'notRecorded', causes: [] })
  return bars
}

const SIZES: ReadonlyArray<readonly [number, number]> = [
  [460, 240],
  [900, 330],
  [1400, 520],
]

function overlapsOf(boxes: ReadonlyArray<{ name: string; box: LabelBox }>): string[] {
  const found: string[] = []
  for (let a = 0; a < boxes.length; a += 1) {
    for (let b = a + 1; b < boxes.length; b += 1) {
      if (boxesOverlap(boxes[a].box, boxes[b].box)) found.push(`${boxes[a].name} × ${boxes[b].name}`)
    }
  }
  return found
}

let view: Rendered | null = null

afterEach(() => {
  view?.unmount()
  view = null
  vi.restoreAllMocks()
})

function draw(bars: ParetoBar[], crossIndex: number | null, selectedKey: string, onSelect = vi.fn(), onHover = vi.fn()): Rendered {
  return render(
    <ParetoChart
      bars={bars}
      crossIndex={crossIndex}
      selectedKey={selectedKey}
      width={900}
      height={330}
      colors={COLORS}
      isHighContrast={false}
      onSelect={onSelect}
      onHover={onHover}
    />,
  )
}

function svg(container: HTMLElement): SVGSVGElement {
  const element = container.querySelector('svg.qaqc-chart')
  if (!(element instanceof SVGSVGElement)) throw new Error('chart missing')
  return element
}

function press(target: Element, key: string): void {
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  })
}

function click(target: Element): void {
  act(() => {
    target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

describe('wrapAxisLabel', () => {
  it('keeps a short name on one line', () => {
    expect(wrapAxisLabel('Bonding', 80, 10)).toEqual(['Bonding'])
  })

  it('breaks after a slash as well as at spaces', () => {
    expect(wrapAxisLabel('Casting/Pouring/Erection', 60, 10)).toEqual(['Casting/', 'Pouring/', 'Erection'])
  })

  it('wraps a long name to at most three lines, ending the last in an ellipsis', () => {
    const lines = wrapAxisLabel('Installation of temporary electrical distribution equipment', 70, 10)
    expect(lines).toHaveLength(3)
    expect(lines[2].endsWith('…')).toBe(true)
  })
})

describe('layoutPareto', () => {
  for (const [width, height] of SIZES) {
    for (const [name, bars, crossIndex] of [
      ['All issues', ALL_ISSUES.bars, ALL_ISSUES.crossIndex],
      ['Open only', OPEN_ONLY.bars, OPEN_ONLY.crossIndex],
      ['30 WW', RECENT.bars, RECENT.crossIndex],
      ['crowded', crowdedBars(), 2],
    ] as const) {
      it(`places the ${name} labels without collisions or covering a bar at ${width} × ${height}`, () => {
        const layout = layoutPareto(bars, crossIndex, width, height)
        const boxes = [
          ...layout.valueLabels.map((label) => ({ name: `${label.key} ${label.text}`, box: valueLabelBox(label) })),
          ...axisLabelBoxes(layout).map((box, at) => ({ name: `axis ${at}`, box })),
        ]
        expect(overlapsOf(boxes)).toEqual([])
        const barBoxes = layout.columns.map((column) => ({
          left: column.x - layout.barWidth / 2,
          right: column.x + layout.barWidth / 2,
          top: column.top,
          bottom: layout.plotBottom,
        }))
        const onBars = layout.valueLabels
          .filter((label) => barBoxes.some((bar) => boxesOverlap(valueLabelBox(label), bar)))
          .map((label) => label.text)
        expect(onBars).toEqual([])
        for (const { name: label, box } of boxes) {
          expect({ label, inside: box.left >= 0 && box.right <= width && box.top >= 0 && box.bottom <= height }).toEqual({ label, inside: true })
        }
      })
    }
  }

  it('keeps the end label when the line ends over the tallest bar', () => {
    const layout = layoutPareto(RECENT.bars, RECENT.crossIndex, 1440, 330)
    expect(layout.valueLabels.filter((label) => label.kind === 'line').map((label) => label.text)).toContain('100.0%')
  })

  it('labels every bar with its count', () => {
    const layout = layoutPareto(ALL_ISSUES.bars, ALL_ISSUES.crossIndex, 900, 330)
    const counts = layout.valueLabels.filter((label) => label.kind === 'count').map((label) => label.text)
    expect(counts).toEqual(['48', '21', '19', '18', '10', '9', '5', '5', '5', '37'])
  })

  it('labels the line where it reaches 80% and at the end', () => {
    const layout = layoutPareto(OPEN_ONLY.bars, OPEN_ONLY.crossIndex, 900, 330)
    const lineLabels = layout.valueLabels.filter((label) => label.kind === 'line').map((label) => label.text)
    expect(lineLabels).toEqual(['82.4% · 80% reached', '100.0%'])
  })

  it('also labels the point before the crossing when 80% is reached only at the last bar', () => {
    const layout = layoutPareto(ALL_ISSUES.bars, ALL_ISSUES.crossIndex, 900, 330)
    const lineLabels = layout.valueLabels.filter((label) => label.kind === 'line').map((label) => label.text)
    expect(lineLabels).toEqual(['79.1%', '100.0%'])
  })

  it('shrinks every axis label together when one word is too wide for its bar', () => {
    const roomy = layoutPareto(ALL_ISSUES.bars, ALL_ISSUES.crossIndex, 1200, 330)
    const crowded = layoutPareto(crowdedBars(), 2, 460, 240)
    expect(roomy.axisFontSize).toBe(10)
    expect(crowded.axisFontSize).toBeLessThan(10)
    expect(crowded.axisFontSize).toBeGreaterThanOrEqual(8)
  })

  it('wraps long cause names onto at most three axis lines', () => {
    const layout = layoutPareto(crowdedBars(), 2, 900, 330)
    const longest = layout.axisLabels[0]
    expect(longest.lines.length).toBeGreaterThan(1)
    expect(longest.lines.length).toBeLessThanOrEqual(3)
    expect(layout.axisLabels.every((label) => label.lines.length <= 3)).toBe(true)
  })

  it('keeps Not recorded out of the cumulative line, after a gap', () => {
    const bars = crowdedBars()
    const layout = layoutPareto(bars, 2, 900, 330)
    expect(layout.linePoints).toHaveLength(bars.length - 1)
    expect(layout.dividerX).not.toBeNull()
    const last = layout.columns[layout.columns.length - 1]
    const before = layout.columns[layout.columns.length - 2]
    expect(last.x - before.x).toBeGreaterThan(layout.band)
  })
})

describe('ParetoChart', () => {
  it('draws vital bars in series 1, the rest in series 2 and Not recorded in grey', () => {
    view = draw(crowdedBars(), 2, 'other')
    const fills = [...view.container.querySelectorAll('.qaqc-pareto-bar')].map((bar) => bar.getAttribute('fill'))
    expect(fills.slice(0, 4)).toEqual([COLORS.series1, COLORS.series1, COLORS.series1, COLORS.series1])
    expect(fills[4]).toBe(COLORS.series2)
    expect(fills[fills.length - 1]).toBe(compositeOver(COLORS.axisText, 0.45, COLORS.card))
  })

  it('highlights the selected bar and its axis label', () => {
    view = draw(ALL_ISSUES.bars, ALL_ISSUES.crossIndex, ALL_ISSUES.bars[2].key)
    const selected = view.container.querySelectorAll('.qaqc-pareto-bar.is-selected')
    expect(selected).toHaveLength(1)
    expect(selected[0].getAttribute('data-key')).toBe(ALL_ISSUES.bars[2].key)
    expect(view.container.querySelector('.qaqc-pareto-outline')).not.toBeNull()
    const boldLabels = [...view.container.querySelectorAll('.qaqc-pareto-axis-label.is-selected')].map((node) => node.textContent)
    expect(boldLabels.join(' ')).toBe('Casting/ Pouring/ Erection')
  })

  it('selects a bar on click', () => {
    const onSelect = vi.fn()
    view = draw(ALL_ISSUES.bars, ALL_ISSUES.crossIndex, ALL_ISSUES.bars[0].key, onSelect)
    const hit = view.container.querySelector(`.qaqc-hit[data-key="${ALL_ISSUES.bars[3].key}"]`)
    if (!hit) throw new Error('hit area missing')
    click(hit)
    expect(onSelect).toHaveBeenCalledWith(ALL_ISSUES.bars[3].key)
  })

  it('moves between bars with the arrow keys and selects with Enter', () => {
    const onSelect = vi.fn()
    view = draw(ALL_ISSUES.bars, ALL_ISSUES.crossIndex, ALL_ISSUES.bars[0].key, onSelect)
    const chart = svg(view.container)
    act(() => chart.focus())
    press(chart, 'ArrowRight')
    press(chart, 'ArrowRight')
    press(chart, 'ArrowLeft')
    expect(onSelect).not.toHaveBeenCalled()
    press(chart, 'Enter')
    expect(onSelect).toHaveBeenCalledWith(ALL_ISSUES.bars[1].key)
  })

  it('jumps to the last bar with End', () => {
    const onSelect = vi.fn()
    view = draw(ALL_ISSUES.bars, ALL_ISSUES.crossIndex, ALL_ISSUES.bars[0].key, onSelect)
    const chart = svg(view.container)
    act(() => chart.focus())
    press(chart, 'End')
    press(chart, ' ')
    expect(onSelect).toHaveBeenCalledWith('other')
  })

  it('announces the focused bar in a live region', () => {
    view = draw(ALL_ISSUES.bars, ALL_ISSUES.crossIndex, ALL_ISSUES.bars[0].key)
    const chart = svg(view.container)
    act(() => chart.focus())
    press(chart, 'ArrowRight')
    expect(view.container.querySelector('[aria-live="polite"]')?.textContent).toBe('Coordination: 21 issues, 11.9% of issues, 39.0% cumulative')
  })

  it('keeps a static name on the chart', () => {
    view = draw(ALL_ISSUES.bars, ALL_ISSUES.crossIndex, ALL_ISSUES.bars[0].key)
    expect(svg(view.container).getAttribute('aria-label')).toBe('Issues by root cause, largest first, with the cumulative percent')
  })

  it('shows the cause, count, share and cumulative percent in the tooltip', () => {
    const onHover = vi.fn()
    view = draw(ALL_ISSUES.bars, ALL_ISSUES.crossIndex, ALL_ISSUES.bars[0].key, vi.fn(), onHover)
    const hit = view.container.querySelector(`.qaqc-hit[data-key="${ALL_ISSUES.bars[0].key}"]`)
    if (!hit) throw new Error('hit area missing')
    act(() => {
      hit.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 10, clientY: 20 }))
    })
    expect(onHover).toHaveBeenLastCalledWith({
      title: 'Installation',
      rows: [
        { label: 'Issues', value: '48' },
        { label: 'Share', value: '27.1%' },
        { label: 'Cumulative', value: '27.1%' },
      ],
      clientX: 10,
      clientY: 20,
    })
  })
})
