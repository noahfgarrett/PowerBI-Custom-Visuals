import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AgingSplitTable } from '../components/AgingSplitTable'
import { OpenIssuesTable } from '../components/OpenIssuesTable'
import type { OpenIssueRow, OverallAgingBucket } from '../types'
import { render, type Rendered } from './render'

let view: Rendered | null = null

afterEach(() => {
  view?.unmount()
  view = null
})

function texts(nodes: Iterable<Element>): string[] {
  return [...nodes].map((node) => node.textContent ?? '')
}

function rowIds(root: HTMLElement): string[] {
  return [...root.querySelectorAll('tbody tr')].map((row) => row.querySelector('th')?.textContent ?? '')
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

function row(id: string, createdOn: string, createdOnTime: number, ageDays: number, overrides: Partial<OpenIssueRow> = {}): OpenIssueRow {
  return { id, title: `Issue ${id}`, contractor: 'Bayside', createdOn, createdOnTime, ageDays, status: 'Open', ...overrides }
}

const DAY = 86_400_000
const TODAY = new Date(2026, 9, 15, 12).getTime()

// Oldest first, as the model gives them. The labels are chosen so a text sort would put them in the wrong order.
const ROWS: OpenIssueRow[] = [
  row('#999', '12/30/25', TODAY - 289 * DAY, 289, { title: 'pipe support', contractor: 'Kenton' }),
  row('#1004', '01/02/26', TODAY - 286 * DAY, 286, { title: 'Anchor bolt', contractor: 'bayside', status: 'Not approved' }),
  row('#98', '09/24/26', TODAY - 21 * DAY, 21, { title: 'Cable tray', contractor: 'Unassigned', status: 'Ready to Inspect' }),
  row('#1020', '10/06/26', TODAY - 9 * DAY, 9, { title: 'Valve tag', contractor: 'Bayside' }),
]

describe('OpenIssuesTable', () => {
  it('lists the open issues oldest first by default', () => {
    view = render(<OpenIssuesTable rows={ROWS} />)
    expect(rowIds(view.container)).toEqual(['#999', '#1004', '#98', '#1020'])
    expect(header(view.container, 'Age (days)').getAttribute('aria-sort')).toBe('descending')
    expect(header(view.container, 'ID').hasAttribute('aria-sort')).toBe(false)
  })

  it('shows the ID, title, contractor, created date, age in days, and status', () => {
    view = render(<OpenIssuesTable rows={ROWS} />)
    expect(texts(view.container.querySelectorAll('thead th'))).toEqual(['ID', 'Title', 'Contractor', 'Created On', 'Age (days)', 'Status'])
    const first = view.container.querySelector('tbody tr')
    expect(first?.querySelector('th')?.textContent).toBe('#999')
    expect(texts(first?.querySelectorAll('td') ?? [])).toEqual(['pipe support', 'Kenton', '12/30/25', '289', 'Open'])
  })

  it('formats a large age with a thousands separator', () => {
    view = render(<OpenIssuesTable rows={[row('#1', '01/02/23', TODAY - 1381 * DAY, 1381)]} />)
    expect(view.container.querySelectorAll('tbody td')[3].textContent).toBe('1,381')
  })

  it('sorts age as a number, not as text', () => {
    view = render(<OpenIssuesTable rows={ROWS} />)
    sortBy(view.container, 'Age (days)')
    expect(rowIds(view.container)).toEqual(['#1020', '#98', '#1004', '#999'])
    expect(header(view.container, 'Age (days)').getAttribute('aria-sort')).toBe('ascending')
  })

  it('sorts the created date by date, not by its MM/DD/YY label, oldest first', () => {
    view = render(<OpenIssuesTable rows={ROWS} />)
    sortBy(view.container, 'Created On')
    expect(rowIds(view.container)).toEqual(['#999', '#1004', '#98', '#1020'])
    expect(header(view.container, 'Created On').getAttribute('aria-sort')).toBe('ascending')
    sortBy(view.container, 'Created On')
    expect(rowIds(view.container)).toEqual(['#1020', '#98', '#1004', '#999'])
  })

  it('sorts IDs numeric-aware, ascending first', () => {
    view = render(<OpenIssuesTable rows={ROWS} />)
    sortBy(view.container, 'ID')
    expect(rowIds(view.container)).toEqual(['#98', '#999', '#1004', '#1020'])
    expect(header(view.container, 'ID').getAttribute('aria-sort')).toBe('ascending')
    sortBy(view.container, 'ID')
    expect(rowIds(view.container)).toEqual(['#1020', '#1004', '#999', '#98'])
  })

  it('sorts the text columns A to Z first, ignoring case', () => {
    view = render(<OpenIssuesTable rows={ROWS} />)
    sortBy(view.container, 'Title')
    expect(rowIds(view.container)).toEqual(['#1004', '#98', '#999', '#1020'])
    expect(header(view.container, 'Title').getAttribute('aria-sort')).toBe('ascending')
    sortBy(view.container, 'Contractor')
    expect(rowIds(view.container)).toEqual(['#1004', '#1020', '#999', '#98'])
    sortBy(view.container, 'Status')
    expect(rowIds(view.container)).toEqual(['#1004', '#999', '#1020', '#98'])
  })

  it('keeps the oldest-first order among rows that tie on the sorted column', () => {
    view = render(<OpenIssuesTable rows={ROWS} />)
    sortBy(view.container, 'Status')
    // #999 and #1020 are both Open; #999 is older.
    expect(rowIds(view.container).filter((id) => id === '#999' || id === '#1020')).toEqual(['#999', '#1020'])
  })

  it('lists rows that share a blank ID without a key clash', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    view = render(<OpenIssuesTable rows={[row('', '10/06/26', TODAY - 9 * DAY, 9), row('', '10/07/26', TODAY - 8 * DAY, 8)]} />)
    expect(view.container.querySelectorAll('tbody tr')).toHaveLength(2)
    expect(errors).not.toHaveBeenCalled()
    errors.mockRestore()
  })

  it('names the table for screen readers', () => {
    view = render(<OpenIssuesTable rows={ROWS} />)
    expect(view.container.querySelector('caption')?.textContent).toBe('Open issues by age')
  })

  it('renders only headers when there are no open issues', () => {
    view = render(<OpenIssuesTable rows={[]} />)
    expect(view.container.querySelectorAll('thead th')).toHaveLength(6)
    expect(view.container.querySelectorAll('tbody tr')).toHaveLength(0)
  })
})

const BUCKETS: OverallAgingBucket[] = [
  { label: '0-14 Days', count: 38, closed: 30, open: 8 },
  { label: '14-28 Days', count: 19, closed: 15, open: 4 },
  { label: '28+ Days', count: 1120, closed: 1081, open: 39 },
]

describe('AgingSplitTable', () => {
  it('shows the total, closed, and still-open count for each bucket in bucket order', () => {
    view = render(<AgingSplitTable buckets={BUCKETS} />)
    expect(texts(view.container.querySelectorAll('thead th'))).toEqual(['Age', 'Total', 'Closed', 'Still open'])
    const rows = [...view.container.querySelectorAll('tbody tr')].map((item) => [
      item.querySelector('th')?.textContent ?? '',
      ...texts(item.querySelectorAll('td')),
    ])
    expect(rows).toEqual([
      ['0-14 Days', '38', '30', '8'],
      ['14-28 Days', '19', '15', '4'],
      ['28+ Days', '1,120', '1,081', '39'],
    ])
  })

  it('names the table for screen readers', () => {
    view = render(<AgingSplitTable buckets={BUCKETS} />)
    expect(view.container.querySelector('caption')?.textContent).toBe('Issue aging, closed and still open')
  })
})
