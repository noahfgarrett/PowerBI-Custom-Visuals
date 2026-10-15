import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ChartColors } from '../chartTypes'
import { HorizontalBarChart } from '../components/HorizontalBarChart'
import { LineChart } from '../components/LineChart'
import type { PassRatePoint } from '../types'
import { makeWorkWeek } from '../workWeeks'
import { render, type Rendered } from './render'

const COLORS: ChartColors = {
  series1: '#2E5AAC', series2: '#86B6EF', bad: '#D03B3B', warn: '#B45309', card: '#FDFEFF',
  grid: '#EBEEF3', axisText: '#6A7583', ink: '#1B2530', accent: '#2E5AAC',
}

function point(week: number, rate: number | null, hadIssue = false): PassRatePoint {
  return { week: makeWorkWeek(2026, week), rate, cleanFinals: 236, totalFinals: 238, hadIssue, issuesFound: hadIssue ? 1 : 0 }
}

let view: Rendered | null = null

afterEach(() => {
  view?.unmount()
  view = null
})

describe('LineChart', () => {
  it('draws the line, issue dots, and an end label', () => {
    view = render(
      <LineChart
        points={[point(40, 99.5), point(41, 99.1, true), point(42, 99.16)]}
        selectedKey={202642}
        width={300}
        height={160}
        colors={COLORS}
        describe
        onHover={vi.fn()}
      />,
    )
    expect(view.container.querySelector('.qaqc-line')?.getAttribute('d')).toMatch(/^M/)
    expect(view.container.querySelectorAll('.qaqc-issue-dot')).toHaveLength(1)
    expect(view.container.querySelector('.qaqc-end-label')?.textContent).toBe('99.2%')
  })

  it('labels NCR-week rates when labelIssueWeeks is on', () => {
    view = render(
      <LineChart
        points={[point(40, 99.5), point(41, 99.1, true), point(42, 99.16)]}
        selectedKey={202642}
        width={300}
        height={160}
        colors={COLORS}
        describe
        labelIssueWeeks
        onHover={vi.fn()}
      />,
    )
    const labels = view.container.querySelectorAll('.qaqc-issue-rate')
    expect(labels).toHaveLength(1)
    expect(labels[0].textContent).toBe('99.1%')
  })

  it('does not label NCR-week rates by default', () => {
    view = render(
      <LineChart points={[point(40, 99.5), point(41, 99.1, true), point(42, 99.16)]} selectedKey={202642} width={300} height={160} colors={COLORS} describe onHover={vi.fn()} />,
    )
    expect(view.container.querySelectorAll('.qaqc-issue-rate')).toHaveLength(0)
  })

  it('puts the NCR-week label below the dot when there is no room above it', () => {
    view = render(
      <LineChart points={[point(41, 100, true), point(42, 99.1)]} selectedKey={202642} width={300} height={160} colors={COLORS} describe labelIssueWeeks onHover={vi.fn()} />,
    )
    const dotY = Number(view.container.querySelector('.qaqc-issue-dot')?.getAttribute('cy'))
    const labelY = Number(view.container.querySelector('.qaqc-issue-rate')?.getAttribute('y'))
    expect(labelY - dotY).toBe(16)
  })

  it('keeps the NCR-week label above the dot when there is room', () => {
    view = render(
      <LineChart points={[point(41, 99.1, true), point(42, 99.16)]} selectedKey={202642} width={300} height={160} colors={COLORS} describe labelIssueWeeks onHover={vi.fn()} />,
    )
    const dotY = Number(view.container.querySelector('.qaqc-issue-dot')?.getAttribute('cy'))
    const labelY = Number(view.container.querySelector('.qaqc-issue-rate')?.getAttribute('y'))
    expect(labelY).toBeLessThan(dotY)
  })

  it('skips the NCR-week label on the last point because the end label shows it', () => {
    view = render(
      <LineChart points={[point(41, 99.5), point(42, 99.1, true)]} selectedKey={202642} width={300} height={160} colors={COLORS} describe labelIssueWeeks onHover={vi.fn()} />,
    )
    expect(view.container.querySelectorAll('.qaqc-issue-rate')).toHaveLength(0)
    expect(view.container.querySelector('.qaqc-end-label')?.textContent).toBe('99.1%')
  })

  it('skips an NCR-week label that would crowd the previous one', () => {
    // 7 points across 60 px of plot give 10 px between neighbours; both NCR weeks are well clear of the end label.
    view = render(
      <LineChart
        points={[point(36, 99.5), point(37, 99.2, true), point(38, 99.1, true), point(39, 99.3), point(40, 99.3), point(41, 99.3), point(42, 99.3)]}
        selectedKey={202642}
        width={142}
        height={160}
        colors={COLORS}
        describe
        labelIssueWeeks
        onHover={vi.fn()}
      />,
    )
    const labels = view.container.querySelectorAll('.qaqc-issue-rate')
    expect(labels).toHaveLength(1)
    expect(labels[0].textContent).toBe('99.2%')
  })

  it('skips a mid-chart NCR-week label that would collide with the end label', () => {
    // 4 points across 81 px of plot give 27 px between neighbours: week 41 sits 33 px before the end label, which starts 6 px after the last point.
    view = render(
      <LineChart
        points={[point(39, 99.5, true), point(40, 99.2), point(41, 99.1, true), point(42, 99.3)]}
        selectedKey={202642}
        width={163}
        height={160}
        colors={COLORS}
        describe
        labelIssueWeeks
        onHover={vi.fn()}
      />,
    )
    const labels = view.container.querySelectorAll('.qaqc-issue-rate')
    expect(labels).toHaveLength(1)
    expect(labels[0].textContent).toBe('99.5%')
  })

  it('draws no week axis by default', () => {
    view = render(
      <LineChart points={[point(41, 99.1), point(42, 99.16)]} selectedKey={202642} width={300} height={160} colors={COLORS} describe onHover={vi.fn()} />,
    )
    const weekLabels = [...view.container.querySelectorAll('.qaqc-axis-text')].filter((node) => node.textContent?.startsWith('WW'))
    expect(weekLabels).toHaveLength(0)
  })

  it('draws week labels with the selected week in bold when showWeekAxis is set', () => {
    view = render(
      <LineChart points={[point(41, 99.1), point(42, 99.16)]} selectedKey={202642} width={300} height={160} colors={COLORS} describe showWeekAxis onHover={vi.fn()} />,
    )
    const weekLabels = [...view.container.querySelectorAll('.qaqc-axis-text')].filter((node) => node.textContent?.startsWith('WW'))
    expect(weekLabels.map((node) => node.textContent)).toEqual(['WW41', 'WW42'])
    expect(weekLabels.map((node) => node.classList.contains('is-selected'))).toEqual([false, true])
  })

  it('adds the year to week labels when the window spans two years', () => {
    view = render(
      <LineChart
        points={[{ ...point(52, 99.1), week: makeWorkWeek(2025, 52) }, point(1, 99.16)]}
        selectedKey={202601}
        width={300}
        height={160}
        colors={COLORS}
        describe
        showWeekAxis
        onHover={vi.fn()}
      />,
    )
    const weekLabels = [...view.container.querySelectorAll('.qaqc-axis-text')].filter((node) => node.textContent?.startsWith('WW'))
    expect(weekLabels.map((node) => node.textContent)).toEqual(["WW52'25", "WW01'26"])
  })

  it('thins week labels so they do not collide', () => {
    const many = Array.from({ length: 30 }, (_, index) => point(10 + index, 99.1))
    view = render(
      <LineChart points={many} selectedKey={202639} width={300} height={160} colors={COLORS} describe showWeekAxis onHover={vi.fn()} />,
    )
    const weekLabels = [...view.container.querySelectorAll('.qaqc-axis-text')].filter((node) => node.textContent?.startsWith('WW'))
    expect(weekLabels.length).toBeGreaterThan(0)
    expect(weekLabels.length).toBeLessThan(30)
    expect(weekLabels.some((node) => node.classList.contains('is-selected'))).toBe(true)
  })

  it('skips weeks without Finals instead of drawing through them', () => {
    view = render(
      <LineChart points={[point(40, null), point(41, 100), point(42, 100)]} selectedKey={202642} width={300} height={160} colors={COLORS} describe onHover={vi.fn()} />,
    )
    expect(view.container.querySelector('.qaqc-line')?.getAttribute('d')?.match(/M/g)).toHaveLength(1)
  })

  it('reports pass-rate tooltips', () => {
    const onHover = vi.fn()
    view = render(
      <LineChart points={[point(41, 99.1), point(42, 99.16)]} selectedKey={202642} width={300} height={160} colors={COLORS} describe onHover={onHover} />,
    )
    const hit = view.container.querySelector('[data-week="202642"]')
    if (!hit) throw new Error('hit missing')
    act(() => {
      hit.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 5, clientY: 6 }))
    })
    expect(onHover).toHaveBeenLastCalledWith({
      title: "WW42'2026",
      rows: [
        { label: 'NCR pass rate', value: '99.2%' },
        { label: 'Clean Finals', value: '236 / 238' },
      ],
      clientX: 5,
      clientY: 6,
    })
  })

  it('marks a lone point with an end dot', () => {
    view = render(
      <LineChart points={[point(42, 100)]} selectedKey={202642} width={300} height={160} colors={COLORS} describe onHover={vi.fn()} />,
    )
    expect(view.container.querySelectorAll('.qaqc-end-dot')).toHaveLength(1)
  })

  it('hides the tooltip when the pointer leaves a hit area', () => {
    const onHover = vi.fn()
    view = render(
      <LineChart points={[point(41, 99.1), point(42, 99.16)]} selectedKey={202642} width={300} height={160} colors={COLORS} describe onHover={onHover} />,
    )
    const hit = view.container.querySelector('[data-week="202642"]')
    if (!hit) throw new Error('hit missing')
    act(() => {
      hit.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }))
    })
    expect(onHover).toHaveBeenLastCalledWith(null)
  })
})

describe('HorizontalBarChart', () => {
  it('draws one row per building plus Other', () => {
    view = render(
      <HorizontalBarChart
        bars={[{ building: 'F63.2', finals: 138, sors: 15 }, { building: 'IWW Pump Station Annex', finals: 6, sors: 1 }]}
        other={{ count: 2, finals: 2, sors: 0 }}
        width={160}
        height={200}
        colors={COLORS}
        describe
        onHover={vi.fn()}
      />,
    )
    const labels = Array.from(view.container.querySelectorAll('.qaqc-row-label')).map((node) => node.textContent ?? '')
    expect(labels).toHaveLength(3)
    // Label column is min(132, 160 x 0.36) = 57.6px, so labels keep floor((57.6 - 8) / 6.4) = 7 characters.
    expect(labels[0]).toBe('F63.2')
    expect(labels[1]).toBe('IWW Pu…')
    expect(labels[2]).toBe('Other…')
    expect(Array.from(view.container.querySelectorAll('.qaqc-value-text')).map((node) => node.textContent)).toEqual(['153', '7', '2'])
  })

  it('labels a single grouped building in the singular', () => {
    view = render(
      <HorizontalBarChart
        bars={[{ building: 'F63.2', finals: 138, sors: 15 }]}
        other={{ count: 1, finals: 1, sors: 0 }}
        width={600}
        height={200}
        colors={COLORS}
        describe
        onHover={vi.fn()}
      />,
    )
    const labels = Array.from(view.container.querySelectorAll('.qaqc-row-label')).map((node) => node.textContent ?? '')
    expect(labels[1]).toContain('Other (1 building)')
  })

  it('reports building tooltips', () => {
    const onHover = vi.fn()
    view = render(
      <HorizontalBarChart bars={[{ building: 'F63.2', finals: 138, sors: 15 }]} other={null} width={300} height={120} colors={COLORS} describe onHover={onHover} />,
    )
    const hit = view.container.querySelector('.qaqc-hit')
    if (!hit) throw new Error('hit missing')
    act(() => {
      hit.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 1, clientY: 2 }))
    })
    expect(onHover).toHaveBeenLastCalledWith({
      title: 'F63.2',
      rows: [
        { label: 'Finals', value: '138' },
        { label: 'SORs', value: '15' },
        { label: 'Total', value: '153' },
      ],
      clientX: 1,
      clientY: 2,
    })
  })

  it('keeps value labels inside the chart for large totals', () => {
    view = render(
      <HorizontalBarChart bars={[{ building: 'F63.2', finals: 123456, sors: 0 }]} other={null} width={300} height={120} colors={COLORS} describe onHover={vi.fn()} />,
    )
    const value = view.container.querySelector('.qaqc-value-text')
    if (!value) throw new Error('value text missing')
    expect(value.textContent).toBe('123,456')
    expect(Number(value.getAttribute('x')) + 7 * 6.4).toBeLessThanOrEqual(300)
  })

  it('drops rows that do not fit at the minimum row height', () => {
    const bars = Array.from({ length: 9 }, (_, index) => ({ building: `B${index}`, finals: 10, sors: 1 }))
    view = render(
      <HorizontalBarChart bars={bars} other={null} width={300} height={60} colors={COLORS} describe onHover={vi.fn()} />,
    )
    expect(view.container.querySelectorAll('.qaqc-row-label')).toHaveLength(5)
  })

  it('hides the tooltip when the pointer leaves a hit area', () => {
    const onHover = vi.fn()
    view = render(
      <HorizontalBarChart bars={[{ building: 'F63.2', finals: 138, sors: 15 }]} other={null} width={300} height={120} colors={COLORS} describe onHover={onHover} />,
    )
    const hit = view.container.querySelector('.qaqc-hit')
    if (!hit) throw new Error('hit missing')
    act(() => {
      hit.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }))
    })
    expect(onHover).toHaveBeenLastCalledWith(null)
  })
})
