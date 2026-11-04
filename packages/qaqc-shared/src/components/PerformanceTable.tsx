import { ChevronRight } from 'lucide-react'
import { useId, useMemo, useState, type MouseEvent, type ReactElement } from 'react'

import type { ChartColors } from '../chartTypes'
import { formatCount, formatPercent, pluralize } from '../format'
import { directionSign, type SortDirection, type SortState } from '../hooks/useTableSort'
import { TABLE_ROW_HEIGHT, useVirtualRows } from '../hooks/useVirtualRows'
import type { DisciplineTag, PerformanceGroup, PerformanceRow } from '../performance'
import { createRankCache } from '../tableSort'
import { TREND_STRIP_WIDTH, TrendStrip } from './TrendStrip'

type SortKey = 'name' | 'volume' | 'ncrs' | 'passRate' | 'trend'

interface Column {
  key: SortKey
  label: string
  /** The column width in px; null for the name, which takes the spare width. */
  width: number | null
}

const NUMBER_WIDTH = 84
/** Fits the NCR PASS RATE header on one line with room for its sort arrow. */
const PASS_RATE_WIDTH = 132
const TREND_WIDTH = TREND_STRIP_WIDTH + 24
/** The name never gets narrower than this; narrower tiles scroll the table sideways instead. */
const NAME_MIN_WIDTH = 200

// Fixed widths (table-layout: fixed) keep the columns still while the windowed rows scroll past.
const COLUMNS: Record<PerformanceGroup, readonly Column[]> = {
  qcr: [
    { key: 'name', label: 'Name', width: null },
    { key: 'volume', label: 'Finals', width: NUMBER_WIDTH },
    { key: 'ncrs', label: 'NCRs', width: NUMBER_WIDTH },
    { key: 'passRate', label: 'NCR Pass Rate', width: PASS_RATE_WIDTH },
    { key: 'trend', label: 'Trend', width: TREND_WIDTH },
  ],
  welders: [
    { key: 'name', label: 'Welder', width: null },
    { key: 'volume', label: 'Welds', width: NUMBER_WIDTH },
    { key: 'ncrs', label: 'NCRs', width: NUMBER_WIDTH },
    { key: 'passRate', label: 'NCR Pass Rate', width: PASS_RATE_WIDTH },
    { key: 'trend', label: 'Trend', width: TREND_WIDTH },
  ],
}

const CAPTIONS: Record<PerformanceGroup, string> = {
  qcr: 'QCR / FE NCR performance',
  welders: 'Welder NCR performance',
}

const EMPTY_MESSAGES: Record<PerformanceGroup, string> = {
  qcr: 'No finals in this period',
  welders: 'No welds in this period',
}

const NOT_RECORDED_TITLES: Record<PerformanceGroup, string> = {
  qcr: 'Finals with no QCR/FE recorded. Never ranked.',
  welders: 'Welds with no welder recorded. Never ranked.',
}

const TAG_NAMES: Record<DisciplineTag, string> = {
  E: 'Electrical',
  M: 'Mechanical',
}

/** The NCR Pass Rate as the table, the person detail and its chart tooltip show it. */
export function formatPassRate(passRate: number | null): string {
  return formatPercent(passRate, 2)
}

type Block = 'ranked' | 'below'

/** One windowed row: a person, the below-minimum disclosure, or the Not recorded row. */
type TableItem =
  | { kind: 'person'; block: Block; row: PerformanceRow }
  | { kind: 'disclosure'; count: number }
  | { kind: 'notRecorded'; row: PerformanceRow }

/** Names start A to Z and the NCR Pass Rate lowest first, as the ranking does; other number columns start largest first. */
function firstDirection(key: SortKey): SortDirection {
  return key === 'name' || key === 'passRate' ? 'ascending' : 'descending'
}

/** The number a row sorts on. */
function numberValue(row: PerformanceRow, key: Exclude<SortKey, 'name'>): number {
  switch (key) {
    case 'volume':
      return row.volume
    case 'ncrs':
      return row.ncrs
    case 'passRate':
      return row.passRate
    case 'trend':
      return row.ncrWeeks
    default: {
      const unreachable: never = key
      return unreachable
    }
  }
}

/** One block's rows in display order: the model's order with no sort, and ties keep it. */
function sortBlock(
  rows: PerformanceRow[],
  sort: SortState<SortKey> | null,
  ranksFor: (key: 'name') => Uint32Array,
  rankOffset: number,
): PerformanceRow[] {
  if (sort === null) return rows
  const sign = directionSign(sort.direction)
  const positions = rows.map((_, position) => position)
  const key = sort.key
  if (key === 'name') {
    const nameRanks = ranksFor('name')
    positions.sort((a, b) => (nameRanks[rankOffset + a] - nameRanks[rankOffset + b]) * sign || a - b)
  } else {
    const values = rows.map((row) => numberValue(row, key))
    positions.sort((a, b) => (values[a] - values[b]) * sign || a - b)
  }
  return positions.map((position) => rows[position])
}

/** A 100% pass rate is quieter than a pass rate with NCRs. */
function passRateClass(passRate: number): string {
  return passRate === 100 ? 'qaqc-perf-rate is-perfect' : 'qaqc-perf-rate'
}

/** "NCRs in 2 of the last 30 weeks"; a one-week trend (the data's first week, or a range of one) reads as a plain sentence. */
function trendText(row: PerformanceRow): string {
  const weeks = row.trend.length
  if (weeks === 1) return row.ncrWeeks > 0 ? 'NCRs in the last week' : 'No NCRs in the last week'
  return `NCRs in ${formatCount(row.ncrWeeks)} of the last ${formatCount(weeks)} weeks`
}

export interface PerformanceTableProps {
  group: PerformanceGroup
  /** In model order: lowest NCR Pass Rate first, then NCRs, then name. */
  ranked: PerformanceRow[]
  /** In model order: volume descending, then name. */
  belowMinimum: PerformanceRow[]
  notRecorded: PerformanceRow | null
  colors: ChartColors
  isHighContrast: boolean
  /**
   * Called with the person's key and their row, so the overlay can grow from it and return focus to it. Null when
   * interactions are not allowed: names are plain text and rows open nothing.
   */
  onOpenPerson: ((key: string, row: HTMLTableRowElement) => void) | null
}

interface CellsProps {
  row: PerformanceRow
  colors: ChartColors
  isHighContrast: boolean
  /** The id of the hidden trend text, which the name button points at with aria-describedby. */
  trendTextId: string
}

/** Every cell after the name. */
function NumberCells({ row, colors, isHighContrast, trendTextId }: CellsProps): ReactElement {
  return (
    <>
      <td>{formatCount(row.volume)}</td>
      <td className={row.ncrs > 0 ? 'qaqc-perf-ncrs is-nonzero' : 'qaqc-perf-ncrs'}>{formatCount(row.ncrs)}</td>
      <td className={passRateClass(row.passRate)}>{formatPassRate(row.passRate)}</td>
      <td className="qaqc-perf-trend-cell">
        <TrendStrip trend={row.trend} colors={colors} isHighContrast={isHighContrast} />
        <span id={trendTextId} className="qaqc-visually-hidden">{trendText(row)}</span>
      </td>
    </>
  )
}

/** "Electrical", "Mechanical" or "Electrical and Mechanical": the disciplines in words, for titles and screen readers. */
export function disciplineNames(tags: DisciplineTag[]): string {
  return tags.map((tag) => TAG_NAMES[tag]).join(' and ')
}

/** E and M chips, with the discipline names for screen readers (`namesId` lets a button be described by them). */
export function PerformanceTags({ tags, namesId }: { tags: DisciplineTag[]; namesId?: string }): ReactElement | null {
  if (tags.length === 0) return null
  return (
    <span className="qaqc-perf-tags">
      {tags.map((tag) => (
        <span key={tag} className={`qaqc-perf-tag is-${tag.toLowerCase()}`} title={TAG_NAMES[tag]} aria-hidden="true">
          {tag}
        </span>
      ))}
      <span id={namesId} className="qaqc-visually-hidden">{`, ${disciplineNames(tags)}`}</span>
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
  const idPrefix = `qaqc-perf-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const columns = COLUMNS[group]
  const tableMinWidth = columns.reduce((sum, column) => sum + (column.width ?? 0), NAME_MIN_WIDTH)

  // A fresh cache per data set: the names are ranked the first time the name column is sorted, across both
  // blocks (ranked positions first, then below-minimum positions). Other sorts never touch the collator.
  const ranksFor = useMemo(() => createRankCache<'name', PerformanceRow>([...ranked, ...belowMinimum]), [ranked, belowMinimum])
  const sortedRanked = useMemo(() => sortBlock(ranked, sort, ranksFor, 0), [ranked, sort, ranksFor])
  const sortedBelow = useMemo(
    () => sortBlock(belowMinimum, sort, ranksFor, ranked.length),
    [belowMinimum, sort, ranksFor, ranked.length],
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

  /** The name button: the row's one tab stop, so Enter and Space come from the button itself. */
  function openFromName(key: string, event: MouseEvent<HTMLButtonElement>): void {
    const row = event.currentTarget.closest('tr')
    if (row instanceof HTMLTableRowElement) onOpenPerson?.(key, row)
  }

  /** The rest of the row, for mouse users; a click on the name button already opened the person. */
  function openFromRow(key: string, event: MouseEvent<HTMLTableRowElement>): void {
    if (event.target instanceof Element && event.target.closest('button') !== null) return
    onOpenPerson?.(key, event.currentTarget)
  }

  function renderItem(item: TableItem, rowIndex: number): ReactElement {
    switch (item.kind) {
      case 'person': {
        const { row } = item
        // The row's position is unique among the rendered rows, and unlike a name it never holds a space.
        const trendTextId = `${idPrefix}-trend-${rowIndex}`
        // The button's description names the disciplines too, so tabbing to a name announces them.
        const tagsTextId = `${idPrefix}-tags-${rowIndex}`
        const describedBy = row.tags.length > 0 ? `${tagsTextId} ${trendTextId}` : trendTextId
        const rowClass = ['qaqc-perf-row', item.block === 'below' ? 'is-below' : '', onOpenPerson === null ? 'is-static' : '']
          .filter(Boolean)
          .join(' ')
        return (
          <tr
            key={`${item.block}:${row.key}`}
            aria-rowindex={rowIndex}
            className={rowClass}
            style={{ height: TABLE_ROW_HEIGHT }}
            onClick={onOpenPerson === null ? undefined : (event) => openFromRow(row.key, event)}
          >
            <th scope="row" className="is-text">
              <span className="qaqc-perf-name-cell">
                {onOpenPerson === null ? (
                  <span className="qaqc-perf-name" title={row.name} aria-describedby={describedBy}>
                    {row.name}
                  </span>
                ) : (
                  <button
                    type="button"
                    className="qaqc-perf-name"
                    title={row.name}
                    aria-describedby={describedBy}
                    onClick={(event) => openFromName(row.key, event)}
                  >
                    {row.name}
                  </button>
                )}
                <PerformanceTags tags={row.tags} namesId={tagsTextId} />
              </span>
            </th>
            <NumberCells row={row} colors={colors} isHighContrast={isHighContrast} trendTextId={trendTextId} />
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
            <NumberCells row={item.row} colors={colors} isHighContrast={isHighContrast} trendTextId={`${idPrefix}-trend-${rowIndex}`} />
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
