import { ChevronRight } from 'lucide-react'
import { useMemo, useState, type KeyboardEvent, type MouseEvent, type ReactElement } from 'react'

import type { ChartColors } from '../chartTypes'
import { formatCount, formatPercent, pluralize } from '../format'
import { directionSign, type SortDirection, type SortState } from '../hooks/useTableSort'
import { TABLE_ROW_HEIGHT, useVirtualRows } from '../hooks/useVirtualRows'
import { RECENT_WEEK_COUNT } from '../inspections'
import type { DisciplineTag, PerformanceGroup, PerformanceRow } from '../performance'
import { textRanks } from '../tableSort'
import { TREND_STRIP_WIDTH, TrendStrip } from './TrendStrip'

type SortKey = 'name' | 'volume' | 'sors' | 'ncrs' | 'rate' | 'trend'

interface Column {
  key: SortKey
  label: string
  /** The column width in px; null for the name, which takes the spare width. */
  width: number | null
}

const NUMBER_WIDTH = 84
const TREND_WIDTH = TREND_STRIP_WIDTH + 24
/** The name never gets narrower than this; narrower tiles scroll the table sideways instead. */
const NAME_MIN_WIDTH = 200

// Fixed widths (table-layout: fixed) keep the columns still while the windowed rows scroll past.
const COLUMNS: Record<PerformanceGroup, readonly Column[]> = {
  qcr: [
    { key: 'name', label: 'Name', width: null },
    { key: 'volume', label: 'Finals', width: NUMBER_WIDTH },
    { key: 'sors', label: 'SORs', width: NUMBER_WIDTH },
    { key: 'ncrs', label: 'NCRs', width: NUMBER_WIDTH },
    { key: 'rate', label: 'NCR rate', width: NUMBER_WIDTH + 8 },
    { key: 'trend', label: 'Trend', width: TREND_WIDTH },
  ],
  welders: [
    { key: 'name', label: 'Welder', width: null },
    { key: 'volume', label: 'Welds', width: NUMBER_WIDTH },
    { key: 'ncrs', label: 'NCRs', width: NUMBER_WIDTH },
    { key: 'rate', label: 'NCR rate', width: NUMBER_WIDTH + 8 },
    { key: 'trend', label: 'Trend', width: TREND_WIDTH },
  ],
} as const

const CAPTIONS: Record<PerformanceGroup, string> = {
  qcr: 'QCR / FE NCR performance',
  welders: 'Welder NCR performance',
}

const EMPTY_MESSAGES: Record<PerformanceGroup, string> = {
  qcr: 'No finals or SORs in this period',
  welders: 'No welds in this period',
}

const NOT_RECORDED_TITLES: Record<PerformanceGroup, string> = {
  qcr: 'Inspections with no QCR/FE recorded. Never ranked.',
  welders: 'Welds with no welder recorded. Never ranked.',
}

const TAG_NAMES: Record<DisciplineTag, string> = {
  E: 'Electrical',
  M: 'Mechanical',
}

/** The NCR rate as the table, the person detail and its chart tooltip show it. */
export function formatNcrRate(rate: number | null): string {
  return formatPercent(rate, 2)
}

const EMPTY_RANKS = new Uint32Array(0)

type Block = 'ranked' | 'below'

/** One windowed row: a person, the below-minimum disclosure, or the Not recorded row. */
type TableItem =
  | { kind: 'person'; block: Block; row: PerformanceRow }
  | { kind: 'disclosure'; count: number }
  | { kind: 'notRecorded'; row: PerformanceRow }

/** Names start A to Z; every number column starts largest first. */
function firstDirection(key: SortKey): SortDirection {
  return key === 'name' ? 'ascending' : 'descending'
}

/** The number a row sorts on; null (an NCR rate with no volume) sorts last either way. */
function numberValue(row: PerformanceRow, key: Exclude<SortKey, 'name'>): number | null {
  switch (key) {
    case 'volume':
      return row.volume
    case 'sors':
      return row.sors
    case 'ncrs':
      return row.ncrs
    case 'rate':
      return row.rate
    case 'trend':
      return row.ncrWeeks
    default: {
      const unreachable: never = key
      return unreachable
    }
  }
}

/** One block's rows in display order: the model's order with no sort, and ties keep it. */
function sortBlock(rows: PerformanceRow[], sort: SortState<SortKey> | null, nameRanks: Uint32Array, rankOffset: number): PerformanceRow[] {
  if (sort === null) return rows
  const sign = directionSign(sort.direction)
  const positions = rows.map((_, position) => position)
  const key = sort.key
  if (key === 'name') {
    positions.sort((a, b) => (nameRanks[rankOffset + a] - nameRanks[rankOffset + b]) * sign || a - b)
  } else {
    const values = rows.map((row) => numberValue(row, key))
    positions.sort((a, b) => {
      const first = values[a]
      const second = values[b]
      if (first === null || second === null) {
        if (first === second) return a - b
        return first === null ? 1 : -1
      }
      return (first - second) * sign || a - b
    })
  }
  return positions.map((position) => rows[position])
}

/** A zero rate is quieter than a rate with NCRs, and n/a quieter still. */
function rateClass(rate: number | null): string {
  if (rate === null) return 'qaqc-perf-rate is-empty'
  return rate === 0 ? 'qaqc-perf-rate is-zero' : 'qaqc-perf-rate'
}

function trendText(row: PerformanceRow): string {
  const weeks = Math.min(RECENT_WEEK_COUNT, row.trend.length)
  return `NCRs in ${formatCount(row.ncrWeeks)} of the last ${formatCount(weeks)} ${pluralize(weeks, 'week', 'weeks')}`
}

export interface PerformanceTableProps {
  group: PerformanceGroup
  /** In model order: NCR rate descending, then NCRs, then name. */
  ranked: PerformanceRow[]
  /** In model order: volume descending, then name. */
  belowMinimum: PerformanceRow[]
  notRecorded: PerformanceRow | null
  colors: ChartColors
  isHighContrast: boolean
  /** Called with the person's key and their row, so the overlay can grow from it and return focus to it. */
  onOpenPerson: (key: string, row: HTMLTableRowElement) => void
}

interface CellsProps {
  group: PerformanceGroup
  row: PerformanceRow
  colors: ChartColors
  isHighContrast: boolean
}

/** Every cell after the name. */
function NumberCells({ group, row, colors, isHighContrast }: CellsProps): ReactElement {
  return (
    <>
      <td>{formatCount(row.volume)}</td>
      {group === 'qcr' && <td>{formatCount(row.sors)}</td>}
      <td className={row.ncrs > 0 ? 'qaqc-perf-ncrs is-nonzero' : 'qaqc-perf-ncrs'}>{formatCount(row.ncrs)}</td>
      <td className={rateClass(row.rate)}>{formatNcrRate(row.rate)}</td>
      <td className="qaqc-perf-trend-cell">
        <TrendStrip trend={row.trend} colors={colors} isHighContrast={isHighContrast} />
        <span className="qaqc-visually-hidden">{trendText(row)}</span>
      </td>
    </>
  )
}

/** E and M chips, with the discipline names for screen readers. */
export function PerformanceTags({ tags }: { tags: DisciplineTag[] }): ReactElement | null {
  if (tags.length === 0) return null
  return (
    <span className="qaqc-perf-tags">
      {tags.map((tag) => (
        <span key={tag} className={`qaqc-perf-tag is-${tag.toLowerCase()}`} title={TAG_NAMES[tag]} aria-hidden="true">
          {tag}
        </span>
      ))}
      <span className="qaqc-visually-hidden">{`, ${tags.map((tag) => TAG_NAMES[tag]).join(' and ')}`}</span>
    </span>
  )
}

/**
 * The ranked people, then a disclosure for everyone below the minimum, then Not recorded. Every column sorts
 * within each block and the blocks never mix. Rows are windowed (`useVirtualRows`) under a sticky header.
 */
export function PerformanceTable({
  group,
  ranked,
  belowMinimum,
  notRecorded,
  colors,
  isHighContrast,
  onOpenPerson,
}: PerformanceTableProps): ReactElement {
  // Null until a header is clicked: the model order is not any one column's order.
  const [sort, setSort] = useState<SortState<SortKey> | null>(null)
  const [isBelowOpen, setIsBelowOpen] = useState(false)
  const columns = COLUMNS[group]
  const tableMinWidth = columns.reduce((sum, column) => sum + (column.width ?? 0), NAME_MIN_WIDTH)

  // Names ranked once per data set while the name column is sorted, across both blocks: ranked positions first,
  // then below-minimum positions. Other sorts and the model order never touch the collator.
  const isNameSort = sort !== null && sort.key === 'name'
  const nameRanks = useMemo(
    () => (isNameSort ? textRanks([...ranked, ...belowMinimum], (row) => row.name) : EMPTY_RANKS),
    [isNameSort, ranked, belowMinimum],
  )
  const sortedRanked = useMemo(() => sortBlock(ranked, sort, nameRanks, 0), [ranked, sort, nameRanks])
  const sortedBelow = useMemo(
    () => sortBlock(belowMinimum, sort, nameRanks, ranked.length),
    [belowMinimum, sort, nameRanks, ranked.length],
  )
  const items = useMemo(() => {
    const list: TableItem[] = sortedRanked.map((row) => ({ kind: 'person', block: 'ranked', row }))
    if (sortedBelow.length > 0) {
      list.push({ kind: 'disclosure', count: sortedBelow.length })
      if (isBelowOpen) for (const row of sortedBelow) list.push({ kind: 'person', block: 'below', row })
    }
    if (notRecorded !== null) list.push({ kind: 'notRecorded', row: notRecorded })
    return list
  }, [sortedRanked, sortedBelow, isBelowOpen, notRecorded])

  const { containerRef, onScroll, start, end, paddingTop, paddingBottom } = useVirtualRows<HTMLDivElement>(
    items.length,
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

  function openOnClick(key: string, event: MouseEvent<HTMLTableRowElement>): void {
    onOpenPerson(key, event.currentTarget)
  }

  function openOnKey(key: string, event: KeyboardEvent<HTMLTableRowElement>): void {
    // Keys on the name button reach the row too; the button's own click already opens the person.
    if (event.target !== event.currentTarget) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onOpenPerson(key, event.currentTarget)
  }

  function renderItem(item: TableItem, rowIndex: number): ReactElement {
    switch (item.kind) {
      case 'person': {
        const { row } = item
        return (
          <tr
            key={`${item.block}:${row.key}`}
            aria-rowindex={rowIndex}
            className={item.block === 'below' ? 'qaqc-perf-row is-below' : 'qaqc-perf-row'}
            tabIndex={0}
            style={{ height: TABLE_ROW_HEIGHT }}
            onClick={(event) => openOnClick(row.key, event)}
            onKeyDown={(event) => openOnKey(row.key, event)}
          >
            <th scope="row" className="is-text">
              <span className="qaqc-perf-name-cell">
                {/* Not a tab stop: the row is. The click bubbles to the row, which opens the person. */}
                <button type="button" className="qaqc-perf-name" tabIndex={-1} title={row.name}>
                  {row.name}
                </button>
                <PerformanceTags tags={row.tags} />
              </span>
            </th>
            <NumberCells group={group} row={row} colors={colors} isHighContrast={isHighContrast} />
          </tr>
        )
      }
      case 'disclosure':
        return (
          <tr key="disclosure" aria-rowindex={rowIndex} className="qaqc-perf-disclosure-row" style={{ height: TABLE_ROW_HEIGHT }}>
            <td colSpan={columns.length} className="is-text">
              <button type="button" className="qaqc-disclosure" aria-expanded={isBelowOpen} onClick={() => setIsBelowOpen((open) => !open)}>
                <ChevronRight size={14} aria-hidden="true" />
                {`Below minimum (${formatCount(item.count)} ${pluralize(item.count, 'person', 'people')})`}
              </button>
            </td>
          </tr>
        )
      case 'notRecorded':
        return (
          <tr key="not-recorded" aria-rowindex={rowIndex} className="qaqc-perf-row is-not-recorded" style={{ height: TABLE_ROW_HEIGHT }}>
            <th scope="row" className="is-text" title={NOT_RECORDED_TITLES[group]}>
              <span className="qaqc-perf-name-cell">
                <span className="qaqc-perf-not-recorded-name">{item.row.name}</span>
              </span>
            </th>
            <NumberCells group={group} row={item.row} colors={colors} isHighContrast={isHighContrast} />
          </tr>
        )
      default: {
        const unreachable: never = item
        return unreachable
      }
    }
  }

  return (
    <div className="qaqc-table-wrap is-flex-fill qaqc-perf-wrap" ref={containerRef} onScroll={onScroll}>
      <table className="qaqc-table is-windowed qaqc-perf-table" aria-rowcount={items.length + 1} style={{ minWidth: tableMinWidth }}>
        <caption className="qaqc-visually-hidden">{CAPTIONS[group]}</caption>
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
                className={column.key === 'name' ? 'is-text' : column.key === 'trend' ? 'qaqc-perf-trend-head' : undefined}
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
          {items.length === 0 && (
            <tr className="qaqc-perf-empty-row">
              <td colSpan={columns.length} className="qaqc-perf-empty">{EMPTY_MESSAGES[group]}</td>
            </tr>
          )}
          {paddingTop > 0 && (
            <tr className="qaqc-virtual-spacer" aria-hidden="true" style={{ height: paddingTop }}>
              <td colSpan={columns.length} />
            </tr>
          )}
          {items.slice(start, end).map((item, offset) => renderItem(item, start + offset + 2))}
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
