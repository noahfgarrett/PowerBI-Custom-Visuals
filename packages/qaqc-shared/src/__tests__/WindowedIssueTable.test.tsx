import { act, type ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  StatusPill,
  useIssueTableSort,
  WindowedIssueTable,
  type IssueTableColumn,
} from '../components/WindowedIssueTable'
import type { SortState } from '../hooks/useTableSort'
import type { IssueDetailRow } from '../types'
import { render, type Rendered } from './render'

interface Row {
  id: string
  idRank: number
  name: string
  days: number | null
}

type Key = 'id' | 'name' | 'days'

const COLUMNS: ReadonlyArray<IssueTableColumn<Row, Key>> = [
  { key: 'id', label: 'ID', width: 60, isText: true, firstDirection: 'ascending', sortValue: { kind: 'number', valueOf: (row) => row.idRank } },
  { key: 'name', label: 'Name', width: null, isText: true, firstDirection: 'ascending', sortValue: { kind: 'text', valueOf: (row) => row.name } },
  { key: 'days', label: 'Days', width: 80, isText: false, firstDirection: 'descending', sortValue: { kind: 'number', valueOf: (row) => row.days } },
] as const

const ROWS: Row[] = [
  { id: '#3', idRank: 2, name: 'bravo', days: 4 },
  { id: '#1', idRank: 0, name: 'Alpha', days: null },
  { id: '#2', idRank: 1, name: 'charlie', days: 9 },
]

let view: Rendered | null = null

afterEach(() => {
  view?.unmount()
  view = null
  vi.restoreAllMocks()
})

interface HarnessProps {
  rows: Row[]
  initial: SortState<Key> | null
}

function Harness({ rows, initial }: HarnessProps): ReactElement {
  const table = useIssueTableSort(rows, COLUMNS, initial)
  return (
    <WindowedIssueTable
      rows={rows}
      columns={COLUMNS}
      table={table}
      titleMinWidth={100}
      wrapClassName="test-wrap"
      tableClassName="test-table"
      caption="Test rows"
      empty={<p className="test-empty">Nothing here</p>}
      rowClassName={(row) => (row.days === null ? 'is-blank' : undefined)}
      renderCells={(row) => (
        <>
          <th scope="row">{row.id}</th>
          <td className="is-text">{row.name}</td>
          <td>{row.days ?? ''}</td>
        </>
      )}
    />
  )
}

function ids(root: HTMLElement): string[] {
  return [...root.querySelectorAll('tbody tr[aria-rowindex] th')].map((cell) => cell.textContent ?? '')
}

function header(root: HTMLElement, label: string): HTMLTableCellElement {
  const cell = [...root.querySelectorAll('thead th')].find((item) => item.textContent === label)
  if (!(cell instanceof HTMLTableCellElement)) throw new Error(`header ${label} missing`)
  return cell
}

function sortBy(root: HTMLElement, label: string): void {
  const button = header(root, label).querySelector('button')
  if (!button) throw new Error(`button ${label} missing`)
  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

describe('WindowedIssueTable', () => {
  it('keeps the given row order until a header is clicked', () => {
    view = render(<Harness rows={ROWS} initial={null} />)
    expect(ids(view.container)).toEqual(['#3', '#1', '#2'])
    expect(view.container.querySelector('th[aria-sort]')).toBeNull()
  })

  it('sorts a text column A to Z first, ignoring case', () => {
    view = render(<Harness rows={ROWS} initial={null} />)
    sortBy(view.container, 'Name')
    expect(ids(view.container)).toEqual(['#1', '#3', '#2'])
    expect(header(view.container, 'Name').getAttribute('aria-sort')).toBe('ascending')
  })

  it('sorts a number column largest first, with blanks last', () => {
    view = render(<Harness rows={ROWS} initial={null} />)
    sortBy(view.container, 'Days')
    expect(ids(view.container)).toEqual(['#2', '#3', '#1'])
  })

  it('flips the direction on a second click, blanks still last', () => {
    view = render(<Harness rows={ROWS} initial={null} />)
    sortBy(view.container, 'Days')
    sortBy(view.container, 'Days')
    expect(ids(view.container)).toEqual(['#3', '#2', '#1'])
    expect(header(view.container, 'Days').getAttribute('aria-sort')).toBe('ascending')
  })

  it('starts from an initial sort', () => {
    view = render(<Harness rows={ROWS} initial={{ key: 'id', direction: 'ascending' }} />)
    expect(ids(view.container)).toEqual(['#1', '#2', '#3'])
    expect(header(view.container, 'ID').getAttribute('aria-sort')).toBe('ascending')
  })

  it('counts the header in aria-rowcount and numbers the rows after it', () => {
    view = render(<Harness rows={ROWS} initial={null} />)
    expect(view.container.querySelector('table')?.getAttribute('aria-rowcount')).toBe('4')
    const indexes = [...view.container.querySelectorAll('tbody tr[aria-rowindex]')].map((row) => row.getAttribute('aria-rowindex'))
    expect(indexes).toEqual(['2', '3', '4'])
  })

  it('left-aligns only the text headers and sizes the table from the column widths', () => {
    view = render(<Harness rows={ROWS} initial={null} />)
    expect(header(view.container, 'Days').className).toBe('')
    expect(header(view.container, 'Name').className).toBe('is-text')
    expect(view.container.querySelector<HTMLTableElement>('table.qaqc-table.is-windowed.test-table')?.style.minWidth).toBe('240px')
  })

  it('applies the row class', () => {
    view = render(<Harness rows={ROWS} initial={null} />)
    const blank = [...view.container.querySelectorAll('tbody tr.is-blank th')].map((cell) => cell.textContent)
    expect(blank).toEqual(['#1'])
  })

  it('draws the empty content inside the scroll container when there are no rows', () => {
    view = render(<Harness rows={[]} initial={null} />)
    expect(view.container.querySelector('.qaqc-table-wrap.is-flex-fill.test-wrap .test-empty')?.textContent).toBe('Nothing here')
    expect(view.container.querySelector('table')).toBeNull()
  })
})

describe('StatusPill', () => {
  function detail(status: string, statusKind: IssueDetailRow['statusKind']): IssueDetailRow {
    return {
      id: '#1', idRank: 0, subtype: '', status, statusKind, title: '', contractor: '', workWeek: '', workWeekKey: 0,
      createdOn: '', createdOnTime: 0, workWeekClosed: '', workWeekClosedKey: null, dueDate: '', dueDateTime: null,
    }
  }

  it('marks closed, open and other statuses', () => {
    view = render(
      <>
        <StatusPill detail={detail('Closed', 'closed')} />
        <StatusPill detail={detail(' open ', 'open')} />
        <StatusPill detail={detail('Ready to Inspect', 'open')} />
      </>,
    )
    const pills = [...view.container.querySelectorAll('.qaqc-status-pill')].map((pill) => [pill.className, pill.getAttribute('title')])
    expect(pills).toEqual([
      ['qaqc-status-pill is-closed', 'Closed'],
      ['qaqc-status-pill is-open', ' open '],
      ['qaqc-status-pill is-other', 'Ready to Inspect'],
    ])
  })
})
