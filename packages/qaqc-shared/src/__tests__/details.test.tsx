import { act } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { BuildingTable } from '../components/BuildingTable'
import { IssueWeekList } from '../components/IssueWeekList'
import { WeldWindowSummary, WindowSummary } from '../components/WindowSummary'
import type { BuildingBar, PassRatePoint } from '../types'
import { makeWorkWeek } from '../workWeeks'
import { render, type Rendered } from './render'

let view: Rendered | null = null

afterEach(() => {
  view?.unmount()
  view = null
})

function texts(nodes: Iterable<Element>): string[] {
  return [...nodes].map((node) => node.textContent ?? '')
}

function summaryPairs(root: HTMLElement): Array<[string, string]> {
  return [...root.querySelectorAll('.qaqc-summary > div')].map((item) => [
    item.querySelector('dt')?.textContent ?? '',
    item.querySelector('dd')?.textContent ?? '',
  ])
}

describe('WindowSummary', () => {
  it('shows Finals, SORs, issues found, and the weekly average', () => {
    view = render(<WindowSummary totals={{ finals: 238, sors: 48, issuesFound: 2, weeks: 30 }} />)
    expect(summaryPairs(view.container)).toEqual([
      ['Finals', '238'],
      ['SORs', '48'],
      ['Issues found', '2'],
      ['Avg per week', '9.5'],
    ])
  })

  it('reads n/a for the average when the window has no weeks', () => {
    view = render(<WindowSummary totals={{ finals: 0, sors: 0, issuesFound: 0, weeks: 0 }} />)
    expect(summaryPairs(view.container)[3]).toEqual(['Avg per week', 'n/a'])
  })
})

describe('WeldWindowSummary', () => {
  it('shows welds, signed, sign-off %, and issues created for the window', () => {
    view = render(<WeldWindowSummary totals={{ welds: 1570, signed: 963, issues: 11, weeks: 30 }} />)
    expect(summaryPairs(view.container)).toEqual([
      ['Welds', '1,570'],
      ['Signed', '963'],
      ['Sign-off %', '61.3%'],
      ['Issues created', '11'],
    ])
  })

  it('reads n/a for sign-off % when the window has no welds', () => {
    view = render(<WeldWindowSummary totals={{ welds: 0, signed: 0, issues: 0, weeks: 30 }} />)
    expect(summaryPairs(view.container)[2]).toEqual(['Sign-off %', 'n/a'])
  })
})

function point(week: number, rate: number | null, issuesFound: number): PassRatePoint {
  return { week: makeWorkWeek(2026, week), rate, cleanFinals: 100, totalFinals: 101, hadIssue: issuesFound > 0, issuesFound }
}

function listRows(root: HTMLElement): string[][] {
  return [...root.querySelectorAll('.qaqc-issue-list > li')].map((item) => texts(item.children))
}

describe('IssueWeekList', () => {
  it('lists NCR weeks newest first with issue counts and pass rates', () => {
    view = render(<IssueWeekList points={[point(22, 99.2, 1), point(23, 98.8, 1), point(24, 98.8, 0)]} />)
    expect(listRows(view.container)).toEqual([
      ["WW23'2026", '1 issue', '98.8%'],
      ["WW22'2026", '1 issue', '99.2%'],
    ])
  })

  it('pluralizes the issue count', () => {
    view = render(<IssueWeekList points={[point(22, 99.2, 3)]} />)
    expect(listRows(view.container)[0][1]).toBe('3 issues')
  })

  it('labels the list for screen readers', () => {
    view = render(<IssueWeekList points={[point(22, 99.2, 1)]} />)
    expect(view.container.querySelector('ol')?.getAttribute('aria-label')).toBe('NCR weeks')
  })

  it('says so when no week has an issue', () => {
    view = render(<IssueWeekList points={[point(22, 100, 0)]} />)
    expect(view.container.querySelector('.qaqc-chart-empty')?.textContent).toBe('No NCR weeks in this range')
    expect(view.container.querySelector('ol')).toBeNull()
  })
})

const BUILDINGS: BuildingBar[] = [
  { building: 'B', finals: 1, sors: 5 },
  { building: 'A', finals: 4, sors: 0 },
  { building: 'C', finals: 2, sors: 2 },
]

function buildingOrder(root: HTMLElement): string[] {
  return [...root.querySelectorAll('tbody tr')].map((row) => row.querySelector('th, td')?.textContent ?? '')
}

function header(root: HTMLElement, name: string): HTMLTableCellElement {
  const cell = [...root.querySelectorAll('thead th')].find((item) => item.textContent === name)
  if (!(cell instanceof HTMLTableCellElement)) throw new Error(`header ${name} missing`)
  return cell
}

function sortBy(root: HTMLElement, name: string): void {
  const button = header(root, name).querySelector('button')
  if (!button) throw new Error(`button ${name} missing`)
  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

describe('BuildingTable', () => {
  it('sorts by total descending by default, breaking ties by name', () => {
    view = render(<BuildingTable rows={BUILDINGS} />)
    expect(buildingOrder(view.container)).toEqual(['B', 'A', 'C'])
    expect(header(view.container, 'Total').getAttribute('aria-sort')).toBe('descending')
    expect(header(view.container, 'Building').hasAttribute('aria-sort')).toBe(false)
  })

  it('sorts a new text column ascending first, then toggles', () => {
    view = render(<BuildingTable rows={BUILDINGS} />)
    sortBy(view.container, 'Building')
    expect(buildingOrder(view.container)).toEqual(['A', 'B', 'C'])
    expect(header(view.container, 'Building').getAttribute('aria-sort')).toBe('ascending')
    expect(header(view.container, 'Total').hasAttribute('aria-sort')).toBe(false)
    sortBy(view.container, 'Building')
    expect(buildingOrder(view.container)).toEqual(['C', 'B', 'A'])
    expect(header(view.container, 'Building').getAttribute('aria-sort')).toBe('descending')
  })

  it('sorts a new numeric column descending first', () => {
    view = render(<BuildingTable rows={BUILDINGS} />)
    sortBy(view.container, 'Finals')
    expect(buildingOrder(view.container)).toEqual(['A', 'C', 'B'])
    expect(header(view.container, 'Finals').getAttribute('aria-sort')).toBe('descending')
    sortBy(view.container, 'Finals')
    expect(buildingOrder(view.container)).toEqual(['B', 'C', 'A'])
  })

  it('sorts building names naturally so F63.2 comes before F63.10', () => {
    view = render(<BuildingTable rows={[{ building: 'F63.10', finals: 1, sors: 0 }, { building: 'F63.2', finals: 1, sors: 0 }]} />)
    sortBy(view.container, 'Building')
    expect(buildingOrder(view.container)).toEqual(['F63.2', 'F63.10'])
  })

  it('names the table for screen readers', () => {
    view = render(<BuildingTable rows={BUILDINGS} />)
    expect(view.container.querySelector('caption')?.textContent).toBe('Inspections by building')
  })

  it('sizes each share bar against the largest total', () => {
    view = render(<BuildingTable rows={BUILDINGS} />)
    const widths = [...view.container.querySelectorAll<HTMLElement>('.qaqc-share-bar')].map((bar) => bar.style.width)
    expect(widths).toEqual(['100%', '67%', '67%'])
  })

  it('shows each row total next to its bar', () => {
    view = render(<BuildingTable rows={BUILDINGS} />)
    const firstRow = view.container.querySelector('tbody tr')
    expect(texts(firstRow?.querySelectorAll('td') ?? [])).toEqual(['1', '5', '6'])
  })

  it('avoids dividing by zero when every total is 0', () => {
    view = render(<BuildingTable rows={[{ building: 'Z', finals: 0, sors: 0 }]} />)
    expect(view.container.querySelector<HTMLElement>('.qaqc-share-bar')?.style.width).toBe('0%')
  })
})
