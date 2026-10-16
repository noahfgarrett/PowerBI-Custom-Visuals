import { useMemo, useState, type ReactElement } from 'react'

import { directionSign, type SortState } from '../hooks/useTableSort'
import { TABLE_ROW_HEIGHT, useVirtualRows } from '../hooks/useVirtualRows'
import { textRanks } from '../tableSort'
import type { IssueDetailRow } from '../types'

type TextKey = 'subtype' | 'status' | 'title' | 'contractor'
/** Columns sorted on a precomputed number: the ID's rank, and the week and date keys. */
type NumberKey = 'id' | 'workWeek' | 'createdOn' | 'workWeekClosed' | 'dueDate'
type SortKey = TextKey | NumberKey

interface Column {
  key: SortKey
  label: string
  /** The column width in px; null for Title, which takes the spare width. */
  width: number | null
}

// Fixed widths (table-layout: fixed) keep the columns still while the windowed rows scroll past. The widths live
// only here: the stylesheet sets the fixed layout, and the table's minimum width is derived below.
const COLUMNS: readonly Column[] = [
  { key: 'id', label: 'ID', width: 78 },
  { key: 'subtype', label: 'Subtype', width: 110 },
  { key: 'status', label: 'Status', width: 150 },
  { key: 'title', label: 'Title', width: null },
  { key: 'contractor', label: 'Contractor', width: 140 },
  { key: 'workWeek', label: 'Work Week', width: 104 },
  { key: 'createdOn', label: 'Created On', width: 100 },
  { key: 'workWeekClosed', label: 'Work Week Closed', width: 146 },
  { key: 'dueDate', label: 'Due Date', width: 96 },
] as const

/** Title never gets narrower than this; narrower overlays scroll the table sideways instead. */
const TITLE_MIN_WIDTH = 260
const TABLE_MIN_WIDTH = COLUMNS.reduce((sum, column) => sum + (column.width ?? 0), TITLE_MIN_WIDTH)

const DISCUSSION_TITLE = 'Open for discussion'

type StatusPillKind = 'closed' | 'open' | 'other'

function isTextKey(key: SortKey): key is TextKey {
  return key === 'subtype' || key === 'status' || key === 'title' || key === 'contractor'
}

/** ID and the text columns start A to Z; week and date columns start newest first. */
function firstDirection(key: SortKey): SortState<SortKey>['direction'] {
  return key === 'id' || isTextKey(key) ? 'ascending' : 'descending'
}

/** The precomputed sort key of a number column; null when the issue has no such week or date. */
function numberValue(row: IssueDetailRow, key: NumberKey): number | null {
  switch (key) {
    case 'id':
      return row.idRank
    case 'workWeek':
      return row.workWeekKey
    case 'createdOn':
      return row.createdOnTime
    case 'workWeekClosed':
      return row.workWeekClosedKey
    case 'dueDate':
      return row.dueDateTime
    default: {
      const unreachable: never = key
      return unreachable
    }
  }
}

function statusPillKind(row: IssueDetailRow): StatusPillKind {
  if (row.statusKind === 'closed') return 'closed'
  return row.status.trim().toLowerCase() === 'open' ? 'open' : 'other'
}

/**
 * Row positions in display order. With no sort, the model order: report rows, then discussion rows, each by ID
 * descending. Ties keep that order. Blank weeks and dates go last in either direction.
 */
function sortPositions(rows: IssueDetailRow[], sort: SortState<SortKey> | null, ranksFor: (key: TextKey) => Uint32Array): number[] {
  const positions = rows.map((_, position) => position)
  if (sort === null) return positions
  const sign = directionSign(sort.direction)
  const key = sort.key
  if (isTextKey(key)) {
    const ranks = ranksFor(key)
    return positions.sort((a, b) => (ranks[a] - ranks[b]) * sign || a - b)
  }
  const values = rows.map((row) => numberValue(row, key))
  return positions.sort((a, b) => {
    const first = values[a]
    const second = values[b]
    if (first === null || second === null) {
      if (first === second) return a - b
      return first === null ? 1 : -1
    }
    return (first - second) * sign || a - b
  })
}

export interface IssueDetailTableProps {
  /** Issues created or closed in the selected week or the week before, by ID descending. */
  reportRows: IssueDetailRow[]
  /** Every other open issue as of the selected week, by ID descending. Shaded. */
  discussionRows: IssueDetailRow[]
  /** Names the table for screen readers. */
  caption: string
}

export function IssueDetailTable({ reportRows, discussionRows, caption }: IssueDetailTableProps): ReactElement {
  // Null until a header is clicked: the model order is not any one column's order.
  const [sort, setSort] = useState<SortState<SortKey> | null>(null)
  const rows = useMemo(() => [...reportRows, ...discussionRows], [reportRows, discussionRows])
  const discussionStart = reportRows.length
  // A fresh cache per data set; each text column's ranks are built the first time it is sorted.
  const ranksFor = useMemo(() => {
    const cache = new Map<TextKey, Uint32Array>()
    return (key: TextKey): Uint32Array => {
      let ranks = cache.get(key)
      if (ranks === undefined) {
        ranks = textRanks(rows, (row) => row[key])
        cache.set(key, ranks)
      }
      return ranks
    }
  }, [rows])
  const order = useMemo(() => sortPositions(rows, sort, ranksFor), [rows, sort, ranksFor])
  const { containerRef, onScroll, start, end, paddingTop, paddingBottom } = useVirtualRows<HTMLDivElement>(
    order.length,
    TABLE_ROW_HEIGHT,
    sort === null ? '' : `${sort.key}:${sort.direction}`,
  )

  function toggleSort(key: SortKey): void {
    setSort((current) => {
      if (current !== null && current.key === key) {
        return { key, direction: current.direction === 'ascending' ? 'descending' : 'ascending' }
      }
      return { key, direction: firstDirection(key) }
    })
  }

  return (
    <div className="qaqc-table-wrap is-flex-fill qaqc-issue-detail-wrap" ref={containerRef} onScroll={onScroll}>
      <table
        className="qaqc-table is-windowed qaqc-issue-detail-table"
        aria-rowcount={rows.length + 1}
        style={{ minWidth: TABLE_MIN_WIDTH }}
      >
        <caption className="qaqc-visually-hidden">{caption}</caption>
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
                className="is-text"
                aria-sort={sort !== null && sort.key === column.key ? sort.direction : undefined}
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
            const isDiscussion = position >= discussionStart
            const pill = statusPillKind(row)
            return (
              // The joined position is the key: a blank or repeated ID must not collide.
              <tr
                key={position}
                aria-rowindex={start + offset + 2}
                className={isDiscussion ? 'is-discussion' : undefined}
                title={isDiscussion ? DISCUSSION_TITLE : undefined}
                style={{ height: TABLE_ROW_HEIGHT }}
              >
                <th scope="row">
                  {row.id}
                  {isDiscussion && <span className="qaqc-visually-hidden">, open for discussion</span>}
                </th>
                <td className="is-text" title={row.subtype}>{row.subtype}</td>
                <td className="is-text">
                  <span className={`qaqc-status-pill is-${pill}`} title={row.status}>{row.status}</span>
                </td>
                <td className="is-text" title={row.title}>{row.title}</td>
                <td className="is-text" title={row.contractor}>{row.contractor}</td>
                <td className="is-text">{row.workWeek}</td>
                <td className="is-text">{row.createdOn}</td>
                <td className="is-text">{row.workWeekClosed}</td>
                <td className="is-text">{row.dueDate}</td>
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
    </div>
  )
}
