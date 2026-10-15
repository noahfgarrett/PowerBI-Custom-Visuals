import { useMemo, useState, type ReactElement } from 'react'

import { formatCount } from '../format'
import type { BuildingBar } from '../types'

type SortKey = 'building' | 'finals' | 'sors' | 'total'
type SortDirection = 'ascending' | 'descending'

interface SortState {
  key: SortKey
  direction: SortDirection
}

const COLUMNS: ReadonlyArray<{ key: SortKey; label: string }> = [
  { key: 'building', label: 'Building' },
  { key: 'finals', label: 'Finals' },
  { key: 'sors', label: 'SORs' },
  { key: 'total', label: 'Total' },
]

function totalOf(row: BuildingBar): number {
  return row.finals + row.sors
}

function compareRows(a: BuildingBar, b: BuildingBar, sort: SortState): number {
  const sign = sort.direction === 'ascending' ? 1 : -1
  let difference = 0
  switch (sort.key) {
    case 'building':
      difference = a.building.localeCompare(b.building)
      break
    case 'finals':
      difference = a.finals - b.finals
      break
    case 'sors':
      difference = a.sors - b.sors
      break
    case 'total':
      difference = totalOf(a) - totalOf(b)
      break
    default: {
      const unreachable: never = sort.key
      return unreachable
    }
  }
  return difference * sign || a.building.localeCompare(b.building)
}

export interface BuildingTableProps {
  rows: BuildingBar[]
}

export function BuildingTable({ rows }: BuildingTableProps): ReactElement {
  const [sort, setSort] = useState<SortState>({ key: 'total', direction: 'descending' })
  const sorted = useMemo(() => [...rows].sort((a, b) => compareRows(a, b, sort)), [rows, sort])
  const maxTotal = rows.reduce((max, row) => Math.max(max, totalOf(row)), 1)

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
          {sorted.map((row) => {
            const total = totalOf(row)
            const percent = Math.round((total / maxTotal) * 100)
            return (
              <tr key={row.building}>
                <th scope="row">{row.building}</th>
                <td>{formatCount(row.finals)}</td>
                <td>{formatCount(row.sors)}</td>
                <td>
                  {formatCount(total)}
                  <span className="qaqc-share-bar" style={{ width: `${percent}%` }} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
