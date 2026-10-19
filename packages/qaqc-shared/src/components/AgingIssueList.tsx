import { ArrowLeft, ListFilter, X } from 'lucide-react'
import { useEffect, useMemo, useRef, type KeyboardEvent, type ReactElement } from 'react'

import { formatCount } from '../format'
import { directionSign, useTableSort, type SortState } from '../hooks/useTableSort'
import { TABLE_ROW_HEIGHT, useVirtualRows } from '../hooks/useVirtualRows'
import type { OpenIssueAge } from '../issueBenchmarks'
import { compareNullLast, textRanks } from '../tableSort'

type TextKey = 'title' | 'contractor'
type NumberKey = 'id' | 'created' | 'age' | 'versus'
type SortKey = TextKey | NumberKey

interface Column {
  key: SortKey
  label: string
  isText: boolean
  /** Width in px; null for Title, which takes the spare width. */
  width: number | null
}

// Fixed widths (table-layout: fixed) keep the columns still while the windowed rows scroll past.
const COLUMNS: readonly Column[] = [
  { key: 'id', label: 'ID', isText: true, width: 80 },
  { key: 'title', label: 'Title', isText: true, width: null },
  { key: 'contractor', label: 'Contractor', isText: true, width: 220 },
  { key: 'created', label: 'Created On', isText: false, width: 112 },
  { key: 'age', label: 'Age', isText: false, width: 92 },
  { key: 'versus', label: 'vs normal', isText: false, width: 210 },
] as const
const TITLE_MIN_WIDTH = 220
const TABLE_MIN_WIDTH = COLUMNS.reduce((sum, column) => sum + (column.width ?? 0), TITLE_MIN_WIDTH)
/** ID and the text columns start A to Z; the dates and day counts start largest first. */
const ASCENDING_FIRST: readonly SortKey[] = ['id', 'title', 'contractor']
const DEFAULT_SORT: SortState<SortKey> = { key: 'age', direction: 'descending' }

function isTextKey(key: SortKey): key is TextKey {
  return key === 'title' || key === 'contractor'
}

function numberValue(row: OpenIssueAge, key: NumberKey): number | null {
  switch (key) {
    case 'id':
      return row.issue.detail.idRank
    case 'created':
      return row.issue.detail.createdOnTime
    case 'age':
      return row.age
    case 'versus':
      return row.timesWindow
    default: {
      const unreachable: never = key
      return unreachable
    }
  }
}

/**
 * Row positions in display order. The rows arrive oldest first (ties by ID ascending), so ties in any column keep
 * that order. Text columns sort on collator ranks, built only for the column being sorted.
 */
function sortPositions(rows: readonly OpenIssueAge[], sort: SortState<SortKey>): number[] {
  const positions = rows.map((_, position) => position)
  const sign = directionSign(sort.direction)
  const key = sort.key
  if (isTextKey(key)) {
    const ranks = textRanks(rows, (row) => row.issue[key])
    return positions.sort((a, b) => (ranks[a] - ranks[b]) * sign || a - b)
  }
  const values = rows.map((row) => numberValue(row, key))
  return positions.sort((a, b) => compareNullLast(values[a], values[b], sign) || a - b)
}

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
  const { sort, toggleSort } = useTableSort<SortKey>(DEFAULT_SORT, ASCENDING_FIRST)
  const order = useMemo(() => sortPositions(rows, sort), [rows, sort])
  const { containerRef, onScroll, start, end, paddingTop, paddingBottom } = useVirtualRows<HTMLDivElement>(
    order.length,
    TABLE_ROW_HEIGHT,
    `${sort.key}:${sort.direction}`,
  )
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
      {/* The wrap is always drawn: the windowing measures it once, when the list opens. */}
      <div className="qaqc-table-wrap is-flex-fill qaqc-aging-list-wrap" ref={containerRef} onScroll={onScroll}>
        {count === 0 ? (
          <p className="qaqc-chart-empty qaqc-aging-list-empty">No open issues match this filter</p>
        ) : (
          <table className="qaqc-table is-windowed qaqc-aging-list-table" aria-rowcount={count + 1} style={{ minWidth: TABLE_MIN_WIDTH }}>
            <caption className="qaqc-visually-hidden">{`Open issues as of ${asOfLabel}, against the normal close window`}</caption>
            <colgroup>
              {COLUMNS.map((column) => (
                <col key={column.key} style={column.width === null ? undefined : { width: column.width }} />
              ))}
            </colgroup>
            <thead>
              <tr aria-rowindex={1}>
                {COLUMNS.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={column.isText ? 'is-text' : undefined}
                    aria-sort={sort.key === column.key ? sort.direction : undefined}
                  >
                    <button type="button" onClick={() => toggleSort(column.key)}>
                      {column.label}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paddingTop > 0 && (
                <tr className="qaqc-virtual-spacer" aria-hidden="true" style={{ height: paddingTop }}>
                  <td colSpan={COLUMNS.length} />
                </tr>
              )}
              {order.slice(start, end).map((position, offset) => {
                const row = rows[position]
                const isPast = windowDays !== null && row.age > windowDays
                const tone = windowDays === null ? '' : isPast ? ' is-bad' : ' is-good'
                return (
                  <tr key={position} aria-rowindex={start + offset + 2} style={{ height: TABLE_ROW_HEIGHT }}>
                    <th scope="row">{row.issue.id}</th>
                    <td className="is-text" title={row.issue.title}>{row.issue.title}</td>
                    <td className="is-text" title={row.issue.contractor}>{row.issue.contractor}</td>
                    <td>{row.issue.detail.createdOn}</td>
                    <td className={`qaqc-aging-days${isPast ? ' is-bad' : ''}`}>{`${formatCount(row.age)} d`}</td>
                    <td className={`qaqc-aging-days${tone}`}>{versusText(row, windowDays)}</td>
                  </tr>
                )
              })}
              {paddingBottom > 0 && (
                <tr className="qaqc-virtual-spacer" aria-hidden="true" style={{ height: paddingBottom }}>
                  <td colSpan={COLUMNS.length} />
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
