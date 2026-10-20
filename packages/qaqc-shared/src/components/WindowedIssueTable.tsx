import { useMemo, useState, type ReactElement, type ReactNode } from 'react'

import { directionSign, type SortDirection, type SortState } from '../hooks/useTableSort'
import { TABLE_ROW_HEIGHT, useVirtualRows } from '../hooks/useVirtualRows'
import { compareNullLast, textRanks } from '../tableSort'
import type { IssueDetailRow } from '../types'

/** What a column sorts on: text in collator order, or a precomputed number with blanks (null) last. */
export type ColumnSortValue<Row> =
  | { kind: 'text'; valueOf: (row: Row) => string }
  | { kind: 'number'; valueOf: (row: Row) => number | null }

export interface IssueTableColumn<Row, Key extends string> {
  key: Key
  label: string
  /** Width in px; null for Title, which takes the spare width. */
  width: number | null
  /** Left-aligns the header cell. */
  isText: boolean
  /** The direction of the first click on this header. */
  firstDirection: SortDirection
  sortValue: ColumnSortValue<Row>
}

export interface IssueTableSort<Key extends string> {
  /** Null while the rows keep the order they were given in. */
  sort: SortState<Key> | null
  /** Flips the direction of the sorted column, or sorts another column in its first direction. */
  toggleSort: (key: Key) => void
  /** Row positions in display order. */
  order: number[]
}

type RankCache<Key extends string> = Map<Key, Uint32Array>

/**
 * Row positions in display order. With no sort, the given order; ties in any column keep it. Text columns sort on
 * collator ranks, built the first time each column is sorted for these rows.
 */
function sortPositions<Row, Key extends string>(
  rows: readonly Row[],
  columns: ReadonlyArray<IssueTableColumn<Row, Key>>,
  sort: SortState<Key> | null,
  ranks: RankCache<Key>,
): number[] {
  const positions = rows.map((_, position) => position)
  if (sort === null) return positions
  const column = columns.find((item) => item.key === sort.key)
  if (column === undefined) return positions
  const sign = directionSign(sort.direction)
  const { sortValue } = column
  switch (sortValue.kind) {
    case 'text': {
      let columnRanks = ranks.get(column.key)
      if (columnRanks === undefined) {
        columnRanks = textRanks(rows, sortValue.valueOf)
        ranks.set(column.key, columnRanks)
      }
      const rankOf = columnRanks
      return positions.sort((a, b) => (rankOf[a] - rankOf[b]) * sign || a - b)
    }
    case 'number': {
      const values = rows.map(sortValue.valueOf)
      return positions.sort((a, b) => compareNullLast(values[a], values[b], sign) || a - b)
    }
    default: {
      const unreachable: never = sortValue
      return unreachable
    }
  }
}

/** Sort state and display order for a WindowedIssueTable. `initial` null keeps the rows' own order until a header is clicked. */
export function useIssueTableSort<Row, Key extends string>(
  rows: readonly Row[],
  columns: ReadonlyArray<IssueTableColumn<Row, Key>>,
  initial: SortState<Key> | null,
): IssueTableSort<Key> {
  const [sort, setSort] = useState<SortState<Key> | null>(initial)
  // A fresh cache per data set.
  const ranks = useMemo((): RankCache<Key> => new Map(), [rows])
  const order = useMemo(() => sortPositions(rows, columns, sort, ranks), [rows, columns, sort, ranks])

  function toggleSort(key: Key): void {
    setSort((current) => {
      if (current !== null && current.key === key) {
        return { key, direction: current.direction === 'ascending' ? 'descending' : 'ascending' }
      }
      const column = columns.find((item) => item.key === key)
      return { key, direction: column?.firstDirection ?? 'ascending' }
    })
  }

  return { sort, toggleSort, order }
}

export interface WindowedIssueTableProps<Row, Key extends string> {
  rows: readonly Row[]
  columns: ReadonlyArray<IssueTableColumn<Row, Key>>
  /** From useIssueTableSort on the same rows and columns. */
  table: IssueTableSort<Key>
  /** Title never gets narrower than this; narrower panels scroll the table sideways instead. */
  titleMinWidth: number
  /** Added to the scroll container's classes. */
  wrapClassName: string
  /** Added to the table's classes. */
  tableClassName: string
  /** Names the table for screen readers. */
  caption: string
  /** Drawn in the scroll container in place of the table when there are no rows; without it an empty table is drawn. */
  empty?: ReactNode
  rowClassName?: (row: Row, position: number) => string | undefined
  rowTitle?: (row: Row, position: number) => string | undefined
  /** The row's cells: a `th scope="row"` first, then one `td` per remaining column. */
  renderCells: (row: Row, position: number) => ReactNode
}

/**
 * A sortable issue table whose rows are windowed: only the rows in view are drawn. Fixed column widths
 * (table-layout: fixed) keep the columns still while the rows scroll past.
 */
export function WindowedIssueTable<Row, Key extends string>({
  rows,
  columns,
  table,
  titleMinWidth,
  wrapClassName,
  tableClassName,
  caption,
  empty,
  rowClassName,
  rowTitle,
  renderCells,
}: WindowedIssueTableProps<Row, Key>): ReactElement {
  const { sort, toggleSort, order } = table
  // The sort is the reset key: a new order scrolls back to the first row.
  const { containerRef, onScroll, start, end, paddingTop, paddingBottom } = useVirtualRows<HTMLDivElement>(
    order.length,
    TABLE_ROW_HEIGHT,
    sort === null ? '' : `${sort.key}:${sort.direction}`,
  )
  const minWidth = columns.reduce((sum, column) => sum + (column.width ?? 0), titleMinWidth)
  const isEmpty = rows.length === 0 && empty !== undefined

  return (
    // The container is always drawn: the windowing measures it once, when the table mounts.
    <div className={`qaqc-table-wrap is-flex-fill ${wrapClassName}`} ref={containerRef} onScroll={onScroll}>
      {isEmpty ? empty : (
        <table className={`qaqc-table is-windowed ${tableClassName}`} aria-rowcount={rows.length + 1} style={{ minWidth }}>
          <caption className="qaqc-visually-hidden">{caption}</caption>
          <colgroup>
            {columns.map((column) => (
              <col key={column.key} style={column.width === null ? undefined : { width: column.width }} />
            ))}
          </colgroup>
          <thead>
            <tr aria-rowindex={1}>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={column.isText ? 'is-text' : undefined}
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
                <td colSpan={columns.length} />
              </tr>
            )}
            {order.slice(start, end).map((position, offset) => {
              const row = rows[position]
              return (
                // The position is the key: a blank or repeated ID must not collide.
                <tr
                  key={position}
                  aria-rowindex={start + offset + 2}
                  className={rowClassName?.(row, position)}
                  title={rowTitle?.(row, position)}
                  style={{ height: TABLE_ROW_HEIGHT }}
                >
                  {renderCells(row, position)}
                </tr>
              )
            })}
            {paddingBottom > 0 && (
              <tr className="qaqc-virtual-spacer" aria-hidden="true" style={{ height: paddingBottom }}>
                <td colSpan={columns.length} />
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}

type StatusPillKind = 'closed' | 'open' | 'other'

function statusPillKind(detail: IssueDetailRow): StatusPillKind {
  if (detail.statusKind === 'closed') return 'closed'
  return detail.status.trim().toLowerCase() === 'open' ? 'open' : 'other'
}

export interface StatusPillProps {
  detail: IssueDetailRow
}

/** An issue's status as a pill: closed, Open, or any other open status such as Ready to Inspect. */
export function StatusPill({ detail }: StatusPillProps): ReactElement {
  return <span className={`qaqc-status-pill is-${statusPillKind(detail)}`} title={detail.status}>{detail.status}</span>
}
