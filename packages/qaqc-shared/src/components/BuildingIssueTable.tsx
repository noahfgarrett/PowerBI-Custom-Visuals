import { useMemo, useState, type ReactElement } from 'react'

import { formatCount, formatPercent, NAME_COLLATOR } from '../format'
import type { BuildingIssueBar } from '../types'

type SortKey = 'building' | 'welds' | 'issues' | 'rate'
type SortDirection = 'ascending' | 'descending'

interface SortState {
  key: SortKey
  direction: SortDirection
}

const COLUMNS: ReadonlyArray<{ key: SortKey; label: string }> = [
  { key: 'building', label: 'Building' },
  { key: 'welds', label: 'Welds' },
  { key: 'issues', label: 'Issues' },
  { key: 'rate', label: 'Issue rate' },
]

function compareRows(a: BuildingIssueBar, b: BuildingIssueBar, sort: SortState): number {
  const sign = sort.direction === 'ascending' ? 1 : -1
  let difference = 0
  switch (sort.key) {
    case 'building':
      difference = NAME_COLLATOR.compare(a.building, b.building)
      break
    case 'welds':
      difference = a.welds - b.welds
      break
    case 'issues':
      difference = a.issues - b.issues
      break
    case 'rate':
      difference = a.rate - b.rate
      break
    default: {
      const unreachable: never = sort.key
      return unreachable
    }
  }
  return difference * sign || NAME_COLLATOR.compare(a.building, b.building)
}

export interface BuildingIssueTableProps {
  /** Every building in the window, ignoring the minimum welds. */
  rows: BuildingIssueBar[]
}

export function BuildingIssueTable({ rows }: BuildingIssueTableProps): ReactElement {
  const [sort, setSort] = useState<SortState>({ key: 'rate', direction: 'descending' })
  const sorted = useMemo(() => [...rows].sort((a, b) => compareRows(a, b, sort)), [rows, sort])

  function toggleSort(key: SortKey): void {
    setSort((current) => {
      if (current.key === key) {
        return { key, direction: current.direction === 'ascending' ? 'descending' : 'ascending' }
      }
      return { key, direction: key === 'building' ? 'ascending' : 'descending' }
    })
  }

  return (
    <div className="qaqc-table-wrap">
      <table className="qaqc-table">
        <caption className="qaqc-visually-hidden">Issues by building</caption>
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <th key={column.key} scope="col" aria-sort={sort.key === column.key ? sort.direction : undefined}>
                <button type="button" onClick={() => toggleSort(column.key)}>
                  {column.label}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.building}>
              <th scope="row">{row.building}</th>
              <td>{formatCount(row.welds)}</td>
              <td>{formatCount(row.issues)}</td>
              <td>{formatPercent(row.rate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
