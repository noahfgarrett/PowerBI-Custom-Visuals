import { useMemo, type ReactElement } from 'react'

import { formatCount, formatPercent } from '../format'
import { directionSign, useTableSort, type SortState } from '../hooks/useTableSort'
import { TABLE_ROW_HEIGHT, useVirtualRows } from '../hooks/useVirtualRows'
import type { ActivityPoint, QualityRatePoint } from '../overview'
import type { WorkWeek } from '../types'

type ActivityKey = 'week' | 'electricalFinals' | 'electricalSors' | 'mechanicalFinals' | 'mechanicalSors'
type RatesKey = 'week' | 'inspectionRate' | 'inspectionCounts' | 'weldingRate' | 'weldingCounts'

interface WeekColumn<Row, Key extends string> {
  key: Key
  label: string
  /** What the column sorts on; null (an n/a rate) sorts last in both directions. */
  sortValue: (row: Row) => number | null
  /** Breaks ties in the sort value, in the same direction. */
  thenBy?: (row: Row) => number
  display: (row: Row) => string
}

const WEEK_KEY = 'week'

function weekColumn<Row extends { week: WorkWeek }>(): WeekColumn<Row, typeof WEEK_KEY> {
  return { key: WEEK_KEY, label: 'Week', sortValue: (row) => row.week.key, display: (row) => row.week.label }
}

function countColumn<Row, Key extends string>(key: Key, label: string, valueOf: (row: Row) => number): WeekColumn<Row, Key> {
  return { key, label, sortValue: valueOf, display: (row) => formatCount(valueOf(row)) }
}

// The spec's full header wording fits the expanded chart's table: the longest, "Mechanical Finals", is about 130 px.
const ACTIVITY_COLUMNS: ReadonlyArray<WeekColumn<ActivityPoint, ActivityKey>> = [
  weekColumn<ActivityPoint>(),
  countColumn<ActivityPoint, ActivityKey>('electricalFinals', 'Electrical Finals', (row) => row.electricalFinals),
  countColumn<ActivityPoint, ActivityKey>('electricalSors', 'Electrical SORs', (row) => row.electricalSors),
  countColumn<ActivityPoint, ActivityKey>('mechanicalFinals', 'Mechanical Finals', (row) => row.mechanicalFinals),
  countColumn<ActivityPoint, ActivityKey>('mechanicalSors', 'Mechanical SORs', (row) => row.mechanicalSors),
]

const RATE_COLUMNS: ReadonlyArray<WeekColumn<QualityRatePoint, RatesKey>> = [
  weekColumn<QualityRatePoint>(),
  { key: 'inspectionRate', label: 'Inspection rate', sortValue: (row) => row.inspection.rate, display: (row) => formatPercent(row.inspection.rate) },
  {
    key: 'inspectionCounts',
    label: 'Inspection NCRs / Finals',
    sortValue: (row) => row.inspection.ncrs,
    thenBy: (row) => row.inspection.total,
    display: (row) => `${formatCount(row.inspection.ncrs)} / ${formatCount(row.inspection.total)}`,
  },
  { key: 'weldingRate', label: 'Welding rate', sortValue: (row) => row.welding.rate, display: (row) => formatPercent(row.welding.rate) },
  {
    key: 'weldingCounts',
    label: 'Welding NCRs / Welds',
    sortValue: (row) => row.welding.ncrs,
    thenBy: (row) => row.welding.total,
    display: (row) => `${formatCount(row.welding.ncrs)} / ${formatCount(row.welding.total)}`,
  },
]

/** Row positions in display order. Ties fall back to newest week first. */
function sortPositions<Row extends { week: WorkWeek }, Key extends string>(
  rows: ReadonlyArray<Row>,
  column: WeekColumn<Row, Key>,
  sort: SortState<Key>,
): number[] {
  const sign = directionSign(sort.direction)
  const values = rows.map(column.sortValue)
  const thenBy = column.thenBy
  return rows.map((_, position) => position).sort((a, b) => {
    const first = values[a]
    const second = values[b]
    if (first === null || second === null) {
      if (first !== second) return first === null ? 1 : -1
    } else if (first !== second) {
      return (first - second) * sign
    }
    const tie = thenBy === undefined ? 0 : (thenBy(rows[a]) - thenBy(rows[b])) * sign
    return tie || rows[b].week.key - rows[a].week.key
  })
}

interface WeekTableProps<Row extends { week: WorkWeek }, Key extends string> {
  caption: string
  columns: ReadonlyArray<WeekColumn<Row, Key>>
  /** Newest week first. */
  initialSort: SortState<Key>
  rows: ReadonlyArray<Row>
}

const NEWEST_FIRST = { key: WEEK_KEY, direction: 'descending' } as const

function WeekTable<Row extends { week: WorkWeek }, Key extends string>({ caption, columns, initialSort, rows }: WeekTableProps<Row, Key>): ReactElement {
  // Every column is a number (the week sorts on its key), so each starts descending: newest or largest first.
  const { sort, toggleSort } = useTableSort<Key>(initialSort, [])
  const column = columns.find((item) => item.key === sort.key) ?? columns[0]
  const order = useMemo(() => sortPositions(rows, column, sort), [rows, column, sort])
  // The All range can hold hundreds of weeks, so only the rows in view are rendered.
  const { containerRef, onScroll, start, end, paddingTop, paddingBottom } = useVirtualRows<HTMLDivElement>(
    order.length,
    TABLE_ROW_HEIGHT,
    `${sort.key}:${sort.direction}`,
  )

  return (
    <div className="qaqc-table-wrap qaqc-overview-table-wrap" ref={containerRef} onScroll={onScroll}>
      <table className="qaqc-table is-windowed qaqc-overview-table" aria-rowcount={rows.length + 1}>
        <caption className="qaqc-visually-hidden">{caption}</caption>
        <thead>
          <tr aria-rowindex={1}>
            {columns.map((item) => (
              <th key={item.key} scope="col" title={item.label} aria-sort={sort.key === item.key ? sort.direction : undefined}>
                <button type="button" onClick={() => toggleSort(item.key)}>
                  {item.label}
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
              <tr key={row.week.key} aria-rowindex={start + offset + 2} style={{ height: TABLE_ROW_HEIGHT }}>
                {columns.map((item, index) => {
                  const text = item.display(row)
                  return index === 0
                    ? <th key={item.key} scope="row" title={text}>{text}</th>
                    : <td key={item.key} title={text}>{text}</td>
                })}
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
    </div>
  )
}

export interface ActivityWeekTableProps {
  variant: 'activity'
  points: ReadonlyArray<ActivityPoint>
}

export interface RatesWeekTableProps {
  variant: 'rates'
  points: ReadonlyArray<QualityRatePoint>
}

export type OverviewWeekTableProps = ActivityWeekTableProps | RatesWeekTableProps

/** The expanded charts' sortable week tables: inspection activity counts, or the weekly quality rates with their counts. */
export function OverviewWeekTable(props: OverviewWeekTableProps): ReactElement {
  switch (props.variant) {
    case 'activity':
      return <WeekTable key="activity" caption="Inspection activity by work week" columns={ACTIVITY_COLUMNS} initialSort={NEWEST_FIRST} rows={props.points} />
    case 'rates':
      return <WeekTable key="rates" caption="Quality rates by work week" columns={RATE_COLUMNS} initialSort={NEWEST_FIRST} rows={props.points} />
    default: {
      const unreachable: never = props
      return unreachable
    }
  }
}
