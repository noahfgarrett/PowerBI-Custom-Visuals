import { ChevronRight } from 'lucide-react'
import { Fragment, useMemo, useState, type ReactElement } from 'react'

import { formatCount, formatPercent, NAME_COLLATOR } from '../format'
import type { SystemDetail } from '../types'

type SortKey = 'name' | 'total' | 'signed' | 'rate'
type SortDirection = 'ascending' | 'descending'

interface SortState {
  key: SortKey
  direction: SortDirection
}

/** A system or pipe-spec row, so both levels sort with one comparator. */
interface TallyRow {
  name: string
  total: number
  signed: number
}

const COLUMNS: ReadonlyArray<{ key: SortKey; label: string }> = [
  { key: 'name', label: 'System' },
  { key: 'total', label: 'Total' },
  { key: 'signed', label: 'Signed' },
  { key: 'rate', label: 'Sign-off %' },
]

function rateOf(row: TallyRow): number | null {
  return row.total === 0 ? null : (row.signed / row.total) * 100
}

function compareRows(a: TallyRow, b: TallyRow, sort: SortState): number {
  const sign = sort.direction === 'ascending' ? 1 : -1
  let difference = 0
  switch (sort.key) {
    case 'name':
      difference = NAME_COLLATOR.compare(a.name, b.name)
      break
    case 'total':
      difference = a.total - b.total
      break
    case 'signed':
      difference = a.signed - b.signed
      break
    case 'rate':
      // A row with no welds has no rate and sorts below 0%.
      difference = (rateOf(a) ?? -1) - (rateOf(b) ?? -1)
      break
    default: {
      const unreachable: never = sort.key
      return unreachable
    }
  }
  return difference * sign || NAME_COLLATOR.compare(a.name, b.name)
}

function sortRows<T extends TallyRow>(rows: T[], sort: SortState): T[] {
  return [...rows].sort((a, b) => compareRows(a, b, sort))
}

function TallyCells({ row }: { row: TallyRow }): ReactElement {
  return (
    <>
      <td>{formatCount(row.total)}</td>
      <td>{formatCount(row.signed)}</td>
      <td>{formatPercent(rateOf(row))}</td>
    </>
  )
}

export interface SystemTableProps {
  /** Every system in the window, with its pipe specs. */
  rows: SystemDetail[]
}

export function SystemTable({ rows }: SystemTableProps): ReactElement {
  const [sort, setSort] = useState<SortState>({ key: 'total', direction: 'descending' })
  const [openSystems, setOpenSystems] = useState<ReadonlySet<string>>(() => new Set())
  const sorted = useMemo(
    () => sortRows(rows.map((row) => ({ ...row, name: row.system })), sort),
    [rows, sort],
  )

  function toggleSort(key: SortKey): void {
    setSort((current) => {
      if (current.key === key) {
        return { key, direction: current.direction === 'ascending' ? 'descending' : 'ascending' }
      }
      return { key, direction: key === 'name' ? 'ascending' : 'descending' }
    })
  }

  function toggleOpen(system: string): void {
    setOpenSystems((current) => {
      const next = new Set(current)
      if (next.has(system)) next.delete(system)
      else next.add(system)
      return next
    })
  }

  return (
    <div className="qaqc-table-wrap">
      <table className="qaqc-table">
        <caption className="qaqc-visually-hidden">Sign-off by system</caption>
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
            const isOpen = openSystems.has(row.system)
            return (
              <Fragment key={row.system}>
                <tr>
                  <th scope="row">
                    <button type="button" className="qaqc-disclosure" aria-expanded={isOpen} onClick={() => toggleOpen(row.system)}>
                      <ChevronRight size={14} aria-hidden="true" />
                      {row.system}
                    </button>
                  </th>
                  <TallyCells row={row} />
                </tr>
                {isOpen && sortRows(row.specs.map((spec) => ({ ...spec, name: spec.spec })), sort).map((spec) => (
                  <tr key={spec.spec} className="qaqc-spec-row">
                    <th scope="row">{spec.spec}</th>
                    <TallyCells row={spec} />
                  </tr>
                ))}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
