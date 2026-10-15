import { useMemo, type ReactElement } from 'react'

import { formatCount, NAME_COLLATOR } from '../format'
import { directionSign, useTableSort, type SortState } from '../hooks/useTableSort'
import type { OpenIssueRow } from '../types'

type SortKey = 'id' | 'title' | 'contractor' | 'createdOn' | 'age' | 'status'

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

/** Compares the row sort keys, never the formatted labels. Ties keep the model's oldest-first order (the sort is stable). */
function compareRows(a: OpenIssueRow, b: OpenIssueRow, sort: SortState<SortKey>): number {
  const sign = directionSign(sort.direction)
  switch (sort.key) {
    case 'id':
      return NAME_COLLATOR.compare(a.id, b.id) * sign
    case 'title':
      return NAME_COLLATOR.compare(a.title, b.title) * sign
    case 'contractor':
      return NAME_COLLATOR.compare(a.contractor, b.contractor) * sign
    case 'createdOn':
      return (a.createdOnTime - b.createdOnTime) * sign
    case 'age':
      return (a.ageDays - b.ageDays) * sign
    case 'status':
      return NAME_COLLATOR.compare(a.status, b.status) * sign
    default: {
      const unreachable: never = sort.key
      return unreachable
    }
  }
}

export interface OpenIssuesTableProps {
  /** Open and pending issues, oldest first. */
  rows: OpenIssueRow[]
}

export function OpenIssuesTable({ rows }: OpenIssuesTableProps): ReactElement {
  const { sort, toggleSort } = useTableSort<SortKey>({ key: 'age', direction: 'descending' }, ASCENDING_FIRST)
  // Each row keeps its model position as its key: a blank or repeated ID must not collide.
  const sorted = useMemo(
    () => rows.map((row, position) => ({ row, position })).sort((a, b) => compareRows(a.row, b.row, sort)),
    [rows, sort],
  )

  return (
    <div className="qaqc-table-wrap">
      <table className="qaqc-table qaqc-open-issues-table">
        <caption className="qaqc-visually-hidden">Open issues by age</caption>
        <thead>
          <tr>
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
          {sorted.map(({ row, position }) => (
            <tr key={position}>
              <th scope="row" className="qaqc-issue-id">{row.id}</th>
              <td className="is-text qaqc-issue-title">{row.title}</td>
              <td className="is-text">{row.contractor}</td>
              <td>{row.createdOn}</td>
              <td>{formatCount(row.ageDays)}</td>
              <td className="is-text">{row.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
