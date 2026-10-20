import { useMemo, type ReactElement } from 'react'

import { formatCount } from '../format'
import { directionSign, useTableSort, type SortState } from '../hooks/useTableSort'
import { TABLE_ROW_HEIGHT, useVirtualRows } from '../hooks/useVirtualRows'
import { createRankCache } from '../tableSort'
import type { OpenIssueRow } from '../types'

type TextKey = 'title' | 'contractor' | 'status'
/** ID sorts on its precomputed rank, not the collator. */
type SortKey = TextKey | 'id' | 'createdOn' | 'age'

interface Column {
  key: SortKey
  label: string
  isText: boolean
}

const COLUMNS: readonly Column[] = [
  { key: 'id', label: 'ID', isText: true },
  { key: 'title', label: 'Title', isText: true },
  { key: 'contractor', label: 'Contractor', isText: true },
  { key: 'createdOn', label: 'Created On', isText: false },
  { key: 'age', label: 'Age (days)', isText: false },
  { key: 'status', label: 'Status', isText: true },
] as const

/** Text columns, and Created On so its first click is oldest first like the default. */
const ASCENDING_FIRST: readonly SortKey[] = ['id', 'title', 'contractor', 'createdOn', 'status'] as const

function isTextKey(key: SortKey): key is TextKey {
  return key === 'title' || key === 'contractor' || key === 'status'
}

/** Row positions in display order. Ties keep the model's oldest-first order. */
function sortPositions(rows: OpenIssueRow[], sort: SortState<SortKey>, ranksFor: (key: TextKey) => Uint32Array): number[] {
  const sign = directionSign(sort.direction)
  const key = sort.key
  let keyOf: (position: number) => number
  if (isTextKey(key)) {
    const ranks = ranksFor(key)
    keyOf = (position) => ranks[position]
  } else if (key === 'id') {
    keyOf = (position) => rows[position].idRank
  } else if (key === 'createdOn') {
    keyOf = (position) => rows[position].createdOnTime
  } else {
    keyOf = (position) => rows[position].ageDays
  }
  return rows.map((_, position) => position).sort((a, b) => (keyOf(a) - keyOf(b)) * sign || a - b)
}

export interface OpenIssuesTableProps {
  /** Open and pending issues, oldest first. */
  rows: OpenIssueRow[]
}

export function OpenIssuesTable({ rows }: OpenIssuesTableProps): ReactElement {
  const { sort, toggleSort } = useTableSort<SortKey>({ key: 'age', direction: 'descending' }, ASCENDING_FIRST)
  // A fresh cache per data set; each text column's ranks are built the first time it is sorted.
  const ranksFor = useMemo(() => createRankCache<TextKey, OpenIssueRow>(rows), [rows])
  const order = useMemo(() => sortPositions(rows, sort, ranksFor), [rows, sort, ranksFor])
  const { containerRef, onScroll, start, end, paddingTop, paddingBottom } = useVirtualRows<HTMLDivElement>(
    order.length,
    TABLE_ROW_HEIGHT,
    `${sort.key}:${sort.direction}`,
  )

  return (
    <div className="qaqc-table-wrap" ref={containerRef} onScroll={onScroll}>
      <table className="qaqc-table is-windowed qaqc-open-issues-table" aria-rowcount={rows.length + 1}>
        <caption className="qaqc-visually-hidden">Open issues by age</caption>
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
            return (
              // The model position is the key: a blank or repeated ID must not collide.
              <tr key={position} aria-rowindex={start + offset + 2} style={{ height: TABLE_ROW_HEIGHT }}>
                <th scope="row" className="qaqc-issue-id">{row.id}</th>
                <td className="is-text qaqc-issue-title" title={row.title}>{row.title}</td>
                <td className="is-text" title={row.contractor}>{row.contractor}</td>
                <td>{row.createdOn}</td>
                <td>{formatCount(row.ageDays)}</td>
                <td className="is-text">{row.status}</td>
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
