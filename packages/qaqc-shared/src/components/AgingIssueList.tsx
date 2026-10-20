import { ArrowLeft, ListFilter, X } from 'lucide-react'
import { useEffect, useRef, type KeyboardEvent, type ReactElement } from 'react'

import { formatCount } from '../format'
import type { SortState } from '../hooks/useTableSort'
import type { OpenIssueAge } from '../issueBenchmarks'
import { useIssueTableSort, WindowedIssueTable, type IssueTableColumn } from './WindowedIssueTable'

type SortKey = 'id' | 'title' | 'contractor' | 'created' | 'age' | 'versus'

// ID and the text columns start A to Z; the dates and day counts start largest first.
const COLUMNS: ReadonlyArray<IssueTableColumn<OpenIssueAge, SortKey>> = [
  { key: 'id', label: 'ID', width: 80, isText: true, firstDirection: 'ascending', sortValue: { kind: 'number', valueOf: (row) => row.issue.detail.idRank } },
  { key: 'title', label: 'Title', width: null, isText: true, firstDirection: 'ascending', sortValue: { kind: 'text', valueOf: (row) => row.issue.title } },
  { key: 'contractor', label: 'Contractor', width: 220, isText: true, firstDirection: 'ascending', sortValue: { kind: 'text', valueOf: (row) => row.issue.contractor } },
  { key: 'created', label: 'Created On', width: 112, isText: false, firstDirection: 'descending', sortValue: { kind: 'number', valueOf: (row) => row.issue.detail.createdOnTime } },
  { key: 'age', label: 'Age', width: 92, isText: false, firstDirection: 'descending', sortValue: { kind: 'number', valueOf: (row) => row.age } },
  { key: 'versus', label: 'vs normal', width: 210, isText: false, firstDirection: 'descending', sortValue: { kind: 'number', valueOf: (row) => row.timesWindow } },
] as const
const TITLE_MIN_WIDTH = 220
// The rows arrive oldest first (ties by ID ascending), so ties in any column keep that order.
const DEFAULT_SORT: SortState<SortKey> = { key: 'age', direction: 'descending' }

function versusText(row: OpenIssueAge, windowDays: number | null): string {
  if (row.timesWindow === null || windowDays === null) return 'n/a'
  return `${row.timesWindow.toFixed(1)}× the ${formatCount(windowDays)}-day window`
}

export interface AgingIssueListProps {
  /** The open issues to list, already filtered, oldest first. */
  rows: OpenIssueAge[]
  /** The bucket or filter shown in the title and the chip; null for every open issue. */
  filterLabel: string | null
  windowDays: number | null
  asOfLabel: string
  /** Slides the list up as it opens. */
  animate: boolean
  onClearFilter: () => void
  onClose: () => void
}

/**
 * The open issues behind a bar or a card, sliding up over the Issue Aging charts. Back or Esc closes only the list;
 * the page that opens it returns focus to whatever opened it.
 */
export function AgingIssueList({ rows, filterLabel, windowDays, asOfLabel, animate, onClearFilter, onClose }: AgingIssueListProps): ReactElement {
  const table = useIssueTableSort(rows, COLUMNS, DEFAULT_SORT)
  const backRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    backRef.current?.focus({ preventScroll: true })
  }, [])

  const count = rows.length
  const title = filterLabel === null
    ? `All open issues · ${formatCount(count)}`
    : `${filterLabel} · ${formatCount(count)} open ${count === 1 ? 'issue' : 'issues'}`

  function clearFilter(): void {
    onClearFilter()
    // The chip goes away with the filter, so focus moves to Back rather than being lost.
    backRef.current?.focus({ preventScroll: true })
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>): void {
    if (event.key !== 'Escape') return
    // Closes only the list; the page stays open.
    event.preventDefault()
    event.stopPropagation()
    onClose()
  }

  return (
    <section
      className={animate ? 'qaqc-panel qaqc-aging-list is-animated' : 'qaqc-panel qaqc-aging-list'}
      role="dialog"
      aria-label={title}
      // A click on a row keeps focus inside the list, so Esc reaches it.
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      <header className="qaqc-panel-title">
        <button ref={backRef} type="button" className="qaqc-back-button" aria-label="Back to the charts" onClick={onClose}>
          <ArrowLeft size={14} aria-hidden="true" />
          <span>Back</span>
        </button>
        <ListFilter size={15} aria-hidden="true" />
        <h3>{title}</h3>
        {filterLabel !== null && (
          <button type="button" className="qaqc-aging-chip" aria-label={`Clear the filter ${filterLabel}`} onClick={clearFilter}>
            {`Showing: ${filterLabel}`}
            <X size={12} aria-hidden="true" />
          </button>
        )}
        <span className="qaqc-aging-list-note">
          {`As of ${asOfLabel} · `}
          {windowDays === null ? 'no normal close window yet' : <>normal close window <b>{`${formatCount(windowDays)} days`}</b></>}
        </span>
      </header>
      <WindowedIssueTable
        rows={rows}
        columns={COLUMNS}
        table={table}
        titleMinWidth={TITLE_MIN_WIDTH}
        wrapClassName="qaqc-aging-list-wrap"
        tableClassName="qaqc-aging-list-table"
        caption={`Open issues as of ${asOfLabel}, against the normal close window`}
        empty={<p className="qaqc-chart-empty qaqc-aging-list-empty">No open issues match this filter</p>}
        renderCells={(row) => {
          const isPast = windowDays !== null && row.age > windowDays
          const tone = windowDays === null ? '' : isPast ? ' is-bad' : ' is-good'
          return (
            <>
              <th scope="row">{row.issue.id}</th>
              <td className="is-text" title={row.issue.title}>{row.issue.title}</td>
              <td className="is-text" title={row.issue.contractor}>{row.issue.contractor}</td>
              <td>{row.issue.detail.createdOn}</td>
              <td className={`qaqc-aging-days${isPast ? ' is-bad' : ''}`}>{`${formatCount(row.age)} d`}</td>
              <td className={`qaqc-aging-days${tone}`}>{versusText(row, windowDays)}</td>
            </>
          )
        }}
      />
    </section>
  )
}
