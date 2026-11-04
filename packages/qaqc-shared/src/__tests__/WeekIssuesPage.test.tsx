import { afterEach, describe, expect, it } from 'vitest'

import { WeekIssuesPage } from '../components/WeekIssuesPage'
import type { DrillColumn, DrillGroup } from '../drilldown'
import { cellDisplayText, type Row } from '../rowFilters'
import { click, pick } from './filterHarness'
import { render, type Rendered } from './render'
import { ruleBody } from './stylesheet'

function column(key: string, label: string, position: number, isLong?: boolean): DrillColumn {
  return { key, label, read: (row) => cellDisplayText(row[position]), isLong }
}

const COLUMNS: DrillColumn[] = [column('building', 'Building', 0), column('issue', 'Issue', 1, true), column('id', 'Issue ID', 2), column('notes', 'Notes', 3, true)]
const LONG_TEXT = 'Cable tray bracket is bent and needs to be replaced before the next inspection walk with the supplier'
const ROWS: Row[] = [
  ['F63.2', 'Second', 3, ''],
  ['F63.1', LONG_TEXT, 10, 'See photo'],
  ['F63.1', 'First', 2, ''],
]
const GROUP: DrillGroup = { title: null, columns: COLUMNS, rows: ROWS }

let view: Rendered | null = null

afterEach(() => {
  view?.unmount()
  view = null
})

function draw(groups: DrillGroup[] = [GROUP]): HTMLElement {
  view = render(<WeekIssuesPage weekLabel="WW23'2026" groups={groups} />)
  return view.container
}

function bodyRows(container: Element): string[][] {
  return [...container.querySelectorAll('tbody tr:not(.qaqc-virtual-spacer)')].map((row) => [...row.children].map((cell) => cell.textContent ?? ''))
}

function header(container: Element, label: string): HTMLButtonElement {
  const button = [...container.querySelectorAll('thead button')].find((item) => item.textContent === label)
  if (!(button instanceof HTMLButtonElement)) throw new Error(`no header ${label}`)
  return button
}

describe('WeekIssuesPage', () => {
  it('shows the count and the week', () => {
    const container = draw()
    expect(container.querySelector('.qaqc-week-issues-count')?.textContent).toBe("3 issues in WW23'2026")
  })

  it('says one issue, not one issues', () => {
    const container = draw([{ ...GROUP, rows: [ROWS[0]] }])
    expect(container.querySelector('.qaqc-week-issues-count')?.textContent).toBe("1 issue in WW23'2026")
  })

  it('draws the columns in the order given', () => {
    const container = draw()
    expect([...container.querySelectorAll('thead th')].map((cell) => cell.textContent)).toEqual(['Building', 'Issue', 'Issue ID', 'Notes'])
  })

  it('sorts by the first column ascending, then row order', () => {
    const container = draw()
    expect(bodyRows(container).map((row) => row[0])).toEqual(['F63.1', 'F63.1', 'F63.2'])
    expect(bodyRows(container).map((row) => row[1])).toEqual([LONG_TEXT, 'First', 'Second'])
    expect(header(container, 'Building').closest('th')?.getAttribute('aria-sort')).toBe('ascending')
  })

  it('the table sorts by a clicked header', () => {
    const container = draw()
    click(header(container, 'Issue ID'))
    expect(bodyRows(container).map((row) => row[2])).toEqual(['2', '3', '10'])
    expect(header(container, 'Issue ID').closest('th')?.getAttribute('aria-sort')).toBe('ascending')
    click(header(container, 'Issue ID'))
    expect(bodyRows(container).map((row) => row[2])).toEqual(['10', '3', '2'])
    expect(header(container, 'Issue ID').closest('th')?.getAttribute('aria-sort')).toBe('descending')
  })

  it('long text truncates with the full value as a title', () => {
    const container = draw()
    const cell = [...container.querySelectorAll('tbody td')].find((item) => item.textContent === LONG_TEXT)
    expect(cell?.getAttribute('title')).toBe(LONG_TEXT)
    expect(container.querySelector('table')?.classList.contains('is-windowed')).toBe(true)
    expect(ruleBody('.qaqc-table.is-windowed tbody th')).toContain('text-overflow: ellipsis')
  })

  it('only long columns flex: the others get a fixed width', () => {
    const container = draw()
    const widths = [...container.querySelectorAll('col')].map((col) => (col instanceof HTMLElement ? col.style.width : null))
    expect(widths[0]).toMatch(/px$/)
    expect(widths[1]).toBe('')
    expect(widths[2]).toMatch(/px$/)
    expect(widths[3]).toBe('')
  })

  it('never narrows a tile\'s columns: the table keeps a minimum width and its wrap scrolls sideways', () => {
    const container = draw()
    const table = pick(container, 'table', HTMLTableElement)
    expect(Number.parseInt(table.style.minWidth, 10)).toBeGreaterThan(400)
    expect(ruleBody('.qaqc-week-issues-wrap')).toContain('overflow: auto')
    expect(ruleBody('.qaqc-week-issues-table')).toContain('table-layout: fixed')
  })

  it('gives a text-wide column room for its text, and caps it', () => {
    const widthOfIssueId = (groups: DrillGroup[]): number => {
      const container = draw(groups)
      const col = container.querySelectorAll('col')[2]
      const width = col instanceof HTMLElement ? Number.parseInt(col.style.width, 10) : 0
      view?.unmount()
      view = null
      return width
    }
    const narrow = widthOfIssueId([GROUP])
    const wide = widthOfIssueId([{ ...GROUP, rows: [['F63.1', '', 'W'.repeat(400), '']] }])
    expect(wide).toBeGreaterThan(narrow)
    expect(wide).toBeLessThan(300)
  })

  it('labels each titled group and counts them together', () => {
    const container = draw([{ ...GROUP, title: 'Opened' }, { ...GROUP, title: 'Closed', rows: [ROWS[0]] }])
    expect(container.querySelector('.qaqc-week-issues-count')?.textContent).toBe("4 issues in WW23'2026")
    expect([...container.querySelectorAll('.qaqc-week-issues-group h4')].map((node) => node.textContent)).toEqual(['Opened (3)', 'Closed (1)'])
    expect(container.querySelectorAll('table')).toHaveLength(2)
  })

  it('draws no heading for an untitled group', () => {
    expect(draw().querySelector('.qaqc-week-issues-group h4')).toBeNull()
  })
})
