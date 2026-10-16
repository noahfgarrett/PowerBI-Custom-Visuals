import { ChevronRight } from 'lucide-react'
import { Fragment, useId, useMemo, useState, type ReactElement } from 'react'

import { formatCount, formatPercent, NAME_COLLATOR } from '../format'
import { directionSign, useTableSort, type SortState } from '../hooks/useTableSort'
import type { SystemDetail } from '../types'

type SortKey = 'name' | 'total' | 'signed' | 'rate'

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

function compareRows(a: TallyRow, b: TallyRow, sort: SortState<SortKey>): number {
  const sign = directionSign(sort.direction)
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

function sortRows<T extends TallyRow>(rows: T[], sort: SortState<SortKey>): T[] {
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
  const { sort, toggleSort } = useTableSort<SortKey>({ key: 'total', direction: 'descending' }, ['name'])
  const [openSystems, setOpenSystems] = useState<ReadonlySet<string>>(() => new Set())
  const idPrefix = useId()
  // Each system keeps its input position so its spec-row ids stay stable across sorts.
  const sorted = useMemo(
    () => sortRows(rows.map((row, position) => ({ ...row, name: row.system, position })), sort),
    [rows, sort],
  )

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
            // Spec rows stay in the DOM while collapsed (hidden) so aria-controls always points at real rows.
            const specs = sortRows(row.specs.map((spec, position) => ({ ...spec, name: spec.spec, position })), sort)
            const specId = (position: number): string => `${idPrefix}-system-${row.position}-spec-${position}`
            const controls = specs.length > 0 ? specs.map((spec) => specId(spec.position)).join(' ') : undefined
            return (
              <Fragment key={row.system}>
                <tr>
                  <th scope="row">
                    <button
                      type="button"
                      className="qaqc-disclosure"
                      aria-expanded={isOpen}
                      aria-controls={controls}
                      onClick={() => toggleOpen(row.system)}
                    >
                      <ChevronRight size={14} aria-hidden="true" />
                      {row.system}
                    </button>
                  </th>
                  <TallyCells row={row} />
                </tr>
                {specs.map((spec) => (
                  <tr key={spec.spec} id={specId(spec.position)} className="qaqc-spec-row" hidden={!isOpen}>
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
