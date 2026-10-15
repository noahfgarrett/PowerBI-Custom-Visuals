import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { IssueDetail } from '../components/IssueDetail'
import { IssueDetailTable } from '../components/IssueDetailTable'
import { TABLE_ROW_HEIGHT } from '../hooks/useVirtualRows'
import { buildIssueIndex } from '../issues'
import type { IssueColumns, IssueDetailRow, IssueIndex } from '../types'
import { makeWorkWeek } from '../workWeeks'
import { countCompares } from './countCompares'
import { render, type Rendered } from './render'

let view: Rendered | null = null

afterEach(() => {
  view?.unmount()
  view = null
  vi.restoreAllMocks()
})

function texts(nodes: Iterable<Element>): string[] {
  return [...nodes].map((node) => node.textContent ?? '')
}

function dataRows(root: HTMLElement): HTMLTableRowElement[] {
  return [...root.querySelectorAll<HTMLTableRowElement>('tbody tr[aria-rowindex]')]
}

/** The visible ID of each rendered row (screen-reader-only text left out). */
function rowIds(root: HTMLElement): string[] {
  return dataRows(root).map((row) => row.querySelector('th')?.firstChild?.textContent ?? '')
}

function discussionIds(root: HTMLElement): string[] {
  return dataRows(root)
    .filter((row) => row.classList.contains('is-discussion'))
    .map((row) => row.querySelector('th')?.firstChild?.textContent ?? '')
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

const DAY = 86_400_000
const BASE_TIME = new Date(2026, 0, 2, 12).getTime()

/** IDs are '#' plus a number here, so the number is a valid ID rank. */
function detailRow(id: string, overrides: Partial<IssueDetailRow> = {}): IssueDetailRow {
  return {
    id,
    idRank: Number(id.slice(1)),
    subtype: 'COR',
    status: 'Open',
    statusKind: 'open',
    title: `Issue ${id}`,
    contractor: 'Bayside',
    workWeek: "WW42'2026",
    workWeekKey: 202642,
    createdOn: '10/13/26',
    createdOnTime: BASE_TIME,
    workWeekClosed: 'Open',
    workWeekClosedKey: null,
    dueDate: '',
    dueDateTime: null,
    ...overrides,
  }
}

// Report rows and discussion rows, each by ID descending as the model gives them. Labels are chosen so a text
// sort would put them in the wrong order.
const REPORT: IssueDetailRow[] = [
  detailRow('#1020', {
    status: 'Closed',
    statusKind: 'closed',
    createdOn: '01/02/26',
    createdOnTime: BASE_TIME,
    workWeek: "WW01'2027",
    workWeekKey: 202701,
    workWeekClosed: "WW02'2027",
    workWeekClosedKey: 202702,
    dueDate: '01/09/26',
    dueDateTime: BASE_TIME + 7 * DAY,
  }),
  detailRow('#98', {
    status: 'Not approved',
    createdOn: '12/30/25',
    createdOnTime: BASE_TIME - 3 * DAY,
    workWeek: "WW52'2026",
    workWeekKey: 202652,
  }),
]
const DISCUSSION: IssueDetailRow[] = [
  detailRow('#999', {
    createdOn: '06/01/26',
    createdOnTime: BASE_TIME + 150 * DAY,
    workWeek: "WW23'2026",
    workWeekKey: 202623,
    dueDate: '12/01/26',
    dueDateTime: BASE_TIME + 330 * DAY,
  }),
  detailRow('#9', {
    status: 'Ready to Inspect',
    createdOn: '03/01/26',
    createdOnTime: BASE_TIME + 60 * DAY,
    workWeek: "WW09'2026",
    workWeekKey: 202609,
  }),
]

const CAPTION = "BIM issues as of WW42'2026"

function drawTable(report = REPORT, discussion = DISCUSSION): Rendered {
  return render(<IssueDetailTable reportRows={report} discussionRows={discussion} caption={CAPTION} />)
}

describe('IssueDetailTable', () => {
  it('shows the nine detail columns in order', () => {
    view = drawTable()
    expect(texts(view.container.querySelectorAll('thead th'))).toEqual([
      'ID',
      'Subtype',
      'Status',
      'Title',
      'Contractor',
      'Work Week',
      'Created On',
      'Work Week Closed',
      'Due Date',
    ])
  })

  it('shows each issue field in its column', () => {
    view = drawTable()
    const first = dataRows(view.container)[0]
    expect(first.querySelector('th')?.textContent).toBe('#1020')
    expect(texts(first.querySelectorAll('td'))).toEqual([
      'COR',
      'Closed',
      'Issue #1020',
      'Bayside',
      "WW01'2027",
      '01/02/26',
      "WW02'2027",
      '01/09/26',
    ])
  })

  it('lists report rows first, then discussion rows, in the model order', () => {
    view = drawTable()
    expect(rowIds(view.container)).toEqual(['#1020', '#98', '#999', '#9'])
  })

  it('shades only the discussion rows and titles them Open for discussion', () => {
    view = drawTable()
    expect(discussionIds(view.container)).toEqual(['#999', '#9'])
    const titles = dataRows(view.container).map((row) => row.getAttribute('title'))
    expect(titles).toEqual([null, null, 'Open for discussion', 'Open for discussion'])
  })

  it('tells screen readers which rows are open for discussion', () => {
    view = drawTable()
    const idCells = dataRows(view.container).map((row) => row.querySelector('th')?.textContent)
    expect(idCells).toEqual(['#1020', '#98', '#999, open for discussion', '#9, open for discussion'])
  })

  it('draws the status as a pill styled by kind', () => {
    view = drawTable()
    const pills = [...view.container.querySelectorAll('tbody .qaqc-status-pill')].map((pill) => [pill.textContent, pill.className])
    expect(pills).toEqual([
      ['Closed', 'qaqc-status-pill is-closed'],
      ['Not approved', 'qaqc-status-pill is-other'],
      ['Open', 'qaqc-status-pill is-open'],
      ['Ready to Inspect', 'qaqc-status-pill is-other'],
    ])
  })

  it('keeps the full title in a tooltip so a long title can end in an ellipsis', () => {
    const long = 'Pipe support at grid line C-14 conflicts with the cable tray route shown on the latest revision'
    view = drawTable([detailRow('#1', { title: long })], [])
    const cell = dataRows(view.container)[0].querySelector('.qaqc-issue-title')
    expect(cell?.getAttribute('title')).toBe(long)
  })

  it('marks no column as sorted in the default order', () => {
    view = drawTable()
    expect(view.container.querySelector('thead th[aria-sort]')).toBeNull()
  })

  it('sorts the whole table by ID, numeric-aware, ascending first', () => {
    view = drawTable()
    sortBy(view.container, 'ID')
    expect(rowIds(view.container)).toEqual(['#9', '#98', '#999', '#1020'])
    expect(header(view.container, 'ID').getAttribute('aria-sort')).toBe('ascending')
  })

  it('reverses the order on a second click', () => {
    view = drawTable()
    sortBy(view.container, 'ID')
    sortBy(view.container, 'ID')
    expect(rowIds(view.container)).toEqual(['#1020', '#999', '#98', '#9'])
    expect(header(view.container, 'ID').getAttribute('aria-sort')).toBe('descending')
  })

  it('keeps the discussion shading on its rows after sorting', () => {
    view = drawTable()
    sortBy(view.container, 'ID')
    expect(discussionIds(view.container)).toEqual(['#9', '#999'])
  })

  it('moves aria-sort to the newly sorted column', () => {
    view = drawTable()
    sortBy(view.container, 'ID')
    sortBy(view.container, 'Status')
    expect(header(view.container, 'ID').hasAttribute('aria-sort')).toBe(false)
    expect(header(view.container, 'Status').getAttribute('aria-sort')).toBe('ascending')
    expect(rowIds(view.container)).toEqual(['#1020', '#98', '#999', '#9'])
  })

  it('sorts Created On by date, not by its MM/DD/YY label, newest first', () => {
    view = drawTable()
    sortBy(view.container, 'Created On')
    expect(rowIds(view.container)).toEqual(['#999', '#9', '#1020', '#98'])
    expect(header(view.container, 'Created On').getAttribute('aria-sort')).toBe('descending')
  })

  it('sorts Work Week by week, not by its label, newest first', () => {
    view = drawTable()
    sortBy(view.container, 'Work Week')
    expect(rowIds(view.container)).toEqual(['#1020', '#98', '#999', '#9'])
  })

  it('puts blank due dates last in either direction', () => {
    view = drawTable()
    sortBy(view.container, 'Due Date')
    expect(rowIds(view.container)).toEqual(['#999', '#1020', '#98', '#9'])
    sortBy(view.container, 'Due Date')
    expect(rowIds(view.container)).toEqual(['#1020', '#999', '#98', '#9'])
  })

  it('puts issues without a closed week last when sorting Work Week Closed', () => {
    view = drawTable()
    sortBy(view.container, 'Work Week Closed')
    expect(rowIds(view.container)[0]).toBe('#1020')
    sortBy(view.container, 'Work Week Closed')
    expect(rowIds(view.container)[0]).toBe('#1020')
  })

  it('sorts contractors A to Z, ignoring case', () => {
    view = drawTable(
      [detailRow('#3', { contractor: 'kenton' }), detailRow('#2', { contractor: 'Bayside' })],
      [detailRow('#1', { contractor: 'Allied' })],
    )
    sortBy(view.container, 'Contractor')
    expect(rowIds(view.container)).toEqual(['#1', '#2', '#3'])
  })

  it('names the table for screen readers', () => {
    view = drawTable()
    expect(view.container.querySelector('caption')?.textContent).toBe(CAPTION)
  })

  it('sorts IDs by their precomputed rank, without the collator', () => {
    const calls = countCompares()
    view = drawTable()
    sortBy(view.container, 'ID')
    expect(calls()).toBe(0)
  })

  it('reuses a text column\'s ranks across direction flips and later sorts', () => {
    const calls = countCompares()
    view = drawTable()
    sortBy(view.container, 'Title')
    const afterFirstSort = calls()
    sortBy(view.container, 'Title')
    sortBy(view.container, 'Status')
    const afterStatus = calls()
    sortBy(view.container, 'Title')
    sortBy(view.container, 'Title')
    expect(afterFirstSort).toBeGreaterThan(0)
    expect(afterStatus).toBeGreaterThan(afterFirstSort)
    expect(calls()).toBe(afterStatus)
  })

  it('lists rows that share a blank ID without a key clash', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    view = drawTable([detailRow('')], [detailRow('')])
    expect(dataRows(view.container)).toHaveLength(2)
    expect(errors).not.toHaveBeenCalled()
  })
})

// 5,000 rows: 1,000 report rows (#5000 down to #4001), then 4,000 discussion rows (#4000 down to #1).
const MANY_REPORT: IssueDetailRow[] = Array.from({ length: 1000 }, (_, index) => detailRow(`#${5000 - index}`))
const MANY_DISCUSSION: IssueDetailRow[] = Array.from({ length: 4000 }, (_, index) => detailRow(`#${4000 - index}`))
const VIEWPORT_HEIGHT = 320

function wrap(root: HTMLElement): HTMLElement {
  const element = root.querySelector('.qaqc-table-wrap')
  if (!(element instanceof HTMLElement)) throw new Error('table wrap missing')
  return element
}

function scrollTo(root: HTMLElement, top: number): void {
  const element = wrap(root)
  element.scrollTop = top
  act(() => {
    element.dispatchEvent(new Event('scroll'))
  })
}

describe('IssueDetailTable with many rows', () => {
  function drawMany(): Rendered {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1000, VIEWPORT_HEIGHT))
    return drawTable(MANY_REPORT, MANY_DISCUSSION)
  }

  const MAX_RENDERED = Math.ceil(VIEWPORT_HEIGHT / TABLE_ROW_HEIGHT) + 20

  it('renders only the rows near the viewport', () => {
    view = drawMany()
    expect(dataRows(view.container).length).toBeLessThanOrEqual(MAX_RENDERED)
    expect(rowIds(view.container)[0]).toBe('#5000')
  })

  it('tells screen readers the full row count and each row position', () => {
    view = drawMany()
    expect(view.container.querySelector('table')?.getAttribute('aria-rowcount')).toBe('5001')
    expect(dataRows(view.container)[0].getAttribute('aria-rowindex')).toBe('2')
  })

  it('gives every row the fixed height the window assumes', () => {
    view = drawMany()
    expect(dataRows(view.container).every((item) => item.style.height === `${TABLE_ROW_HEIGHT}px`)).toBe(true)
  })

  it('ends on the last discussion row at the bottom, with no space below it', () => {
    view = drawMany()
    scrollTo(view.container, 5000 * TABLE_ROW_HEIGHT - VIEWPORT_HEIGHT)
    const rows = dataRows(view.container)
    const last = rows[rows.length - 1]
    expect(last.querySelector('th')?.firstChild?.textContent).toBe('#1')
    expect(last.getAttribute('aria-rowindex')).toBe('5001')
    expect(last.classList.contains('is-discussion')).toBe(true)
    expect(view.container.querySelector('tbody tr.qaqc-virtual-spacer:last-child')).toBeNull()
  })

  it('pads the rows above the window to their exact height', () => {
    view = drawMany()
    scrollTo(view.container, 2500 * TABLE_ROW_HEIGHT)
    const spacer = view.container.querySelector<HTMLTableRowElement>('tbody tr.qaqc-virtual-spacer:first-child')
    const firstIndex = Number(dataRows(view.container)[0].getAttribute('aria-rowindex')) - 2
    expect(spacer?.style.height).toBe(`${firstIndex * TABLE_ROW_HEIGHT}px`)
  })

  it('sorts the whole set and returns to the first row', () => {
    view = drawMany()
    scrollTo(view.container, 2500 * TABLE_ROW_HEIGHT)
    sortBy(view.container, 'ID')
    expect(wrap(view.container).scrollTop).toBe(0)
    expect(rowIds(view.container)[0]).toBe('#1')
    expect(discussionIds(view.container)[0]).toBe('#1')
  })
})

const COLUMNS: IssueColumns = {
  id: 0,
  title: 1,
  status: 2,
  type: 3,
  contractor: 4,
  discipline: 5,
  createdOn: 6,
  updatedOn: 7,
  dueDate: 8,
  createdBy: 9,
}
const TODAY = new Date(2026, 9, 15) // WW42'2026
const WW41 = makeWorkWeek(2026, 41)
const WW42 = makeWorkWeek(2026, 42)

type Cell = string | null
function issue(id: string, createdOn: string, status = 'Open', updatedOn: Cell = null): Cell[] {
  return [id, `Issue ${id}`, status, 'COR', 'Bayside', 'Mechanical', createdOn, updatedOn, null, 'LotusWorks']
}

// The issue model's test data. At WW42: opened 1, closed 1; WW41: opened 3, closed 2.
// Report rows #10 #7 #6 #5 #4 #3; discussion row #2.
const ROWS: Cell[][] = [
  issue('#1', '9/22/2026', 'Closed', '9/30/2026'),
  issue('#2', '9/23/2026'),
  issue('#10', '9/24/2026', 'Closed', '10/7/2026'),
  issue('#3', '9/29/2026', 'Closed', '10/6/2026'),
  issue('#4', '10/6/2026', 'Pending'),
  issue('#5', '10/7/2026', 'Not approved'),
  issue('#6', '10/8/2026', 'Closed', '10/13/2026'),
  issue('#7', '10/13/2026'),
]

/** The same index, counting how often a detail is built (each build reads `issues` once). */
function countingIndex(): { index: IssueIndex; builds: () => number } {
  const index = buildIssueIndex(ROWS, COLUMNS, TODAY)
  const issues = index.issues
  let reads = 0
  Object.defineProperty(index, 'issues', {
    get: () => {
      reads += 1
      return issues
    },
  })
  return { index, builds: () => reads }
}

function cardLabels(root: HTMLElement): string[] {
  return [...root.querySelectorAll('article.qaqc-kpi')].map((card) => card.getAttribute('aria-label') ?? '')
}

describe('IssueDetail', () => {
  it('shows the opened and closed counts for the selected week and the week before', () => {
    view = render(<IssueDetail index={buildIssueIndex(ROWS, COLUMNS, TODAY)} selectedWeek={WW42} />)
    expect(cardLabels(view.container)).toEqual([
      "Opened This Week: 1. Created in WW42'2026",
      "Closed This Week: 1. Closed in WW42'2026",
      "Opened Last Week: 3. Created in WW41'2026",
      "Closed Last Week: 2. Closed in WW41'2026",
    ])
  })

  it('heads the card groups with the selected week and the week before', () => {
    view = render(<IssueDetail index={buildIssueIndex(ROWS, COLUMNS, TODAY)} selectedWeek={WW42} />)
    const groups = [...view.container.querySelectorAll('.qaqc-kpi-group-head')].map((head) => head.textContent)
    expect(groups).toEqual(["This weekWW42'2026", "Last weekWW41'2026"])
  })

  it('lists the report rows, then the discussion rows, each by ID descending', () => {
    view = render(<IssueDetail index={buildIssueIndex(ROWS, COLUMNS, TODAY)} selectedWeek={WW42} />)
    expect(rowIds(view.container)).toEqual(['#10', '#7', '#6', '#5', '#4', '#3', '#2'])
    expect(discussionIds(view.container)).toEqual(['#2'])
  })

  it('counts each kind of row in the legend', () => {
    view = render(<IssueDetail index={buildIssueIndex(ROWS, COLUMNS, TODAY)} selectedWeek={WW42} />)
    expect(texts(view.container.querySelectorAll('.qaqc-detail-legend li'))).toEqual([
      'Reporting week6',
      'Open for discussion1',
    ])
  })

  it('names the table with the selected week', () => {
    view = render(<IssueDetail index={buildIssueIndex(ROWS, COLUMNS, TODAY)} selectedWeek={WW42} />)
    expect(view.container.querySelector('caption')?.textContent).toBe(
      "BIM issues as of WW42'2026: reporting-week issues, then issues open for discussion",
    )
  })

  it('builds the detail once while the selected week stays the same', () => {
    const { index, builds } = countingIndex()
    view = render(<IssueDetail index={index} selectedWeek={WW42} />)
    view.rerender(<IssueDetail index={index} selectedWeek={makeWorkWeek(2026, 42)} />)
    expect(builds()).toBe(1)
  })

  it('rebuilds the detail when the selected week changes', () => {
    const { index, builds } = countingIndex()
    view = render(<IssueDetail index={index} selectedWeek={WW42} />)
    view.rerender(<IssueDetail index={index} selectedWeek={WW41} />)
    expect(builds()).toBe(2)
    expect(rowIds(view.container)).toEqual(['#10', '#6', '#5', '#4', '#3', '#1', '#2'])
  })

  it('shows a friendly message instead of the table when there is nothing to list', () => {
    const quiet = buildIssueIndex([issue('#1', '9/1/2026', 'Closed', '9/8/2026')], COLUMNS, TODAY)
    view = render(<IssueDetail index={quiet} selectedWeek={WW42} />)
    expect(view.container.querySelector('table')).toBeNull()
    expect(view.container.querySelector('.qaqc-detail-empty')?.textContent).toBe(
      "No issues to review as of WW42'2026Nothing was opened or closed in WW41'2026 or WW42'2026, and no issues are open.",
    )
  })

  it('still shows the cards when there is nothing to list', () => {
    const quiet = buildIssueIndex([issue('#1', '9/1/2026', 'Closed', '9/8/2026')], COLUMNS, TODAY)
    view = render(<IssueDetail index={quiet} selectedWeek={WW42} />)
    expect(cardLabels(view.container)).toHaveLength(4)
  })
})
