import { ChartColumn, ClipboardCheck, Flame, Inbox, Percent, TriangleAlert, type LucideIcon } from 'lucide-react'
import { useMemo, type ReactElement } from 'react'

import type { ChartColors, TooltipHandler } from '../chartTypes'
import { formatCount, pluralize } from '../format'
import { directionSign, useTableSort, type SortState } from '../hooks/useTableSort'
import { TABLE_ROW_HEIGHT, useVirtualRows } from '../hooks/useVirtualRows'
import { buildPersonDetail } from '../performance'
import type { PerformanceGroup, PerformanceIndex, PerformanceTotals, PersonNcrRow } from '../performance'
import { createRankCache } from '../tableSort'
import type { ViewState } from '../types'
import { ChartPanel } from './ChartPanel'
import { KpiCard } from './KpiCard'
import { KpiGroup } from './KpiGroup'
import { formatNcrRate } from './PerformanceTable'
import { PersonWeekChart, personWeekLegend } from './PersonWeekChart'

interface CardWords {
  volumeLabel: string
  /** The volume card's icon, matching the dashboard's summary strip. */
  volumeIcon: LucideIcon
  volumeDetail: string
  ncrDetail: string
  rateDetail: string
  /** Lower case, for running text. */
  volumeNoun: [string, string]
}

const CARD_WORDS: Record<PerformanceGroup, CardWords> = {
  qcr: {
    volumeLabel: 'Finals',
    volumeIcon: ClipboardCheck,
    volumeDetail: 'Final inspections',
    ncrDetail: 'Finals with an issue found',
    rateDetail: 'NCRs ÷ finals',
    volumeNoun: ['final', 'finals'],
  },
  welders: {
    volumeLabel: 'Welds',
    volumeIcon: Flame,
    volumeDetail: 'Welds credited',
    ncrDetail: 'Welds with an issue',
    rateDetail: 'NCRs ÷ welds',
    volumeNoun: ['weld', 'welds'],
  },
}

type TextKey = 'source' | 'place' | 'issue'
type SortKey = TextKey | 'workWeek'

interface NcrColumn {
  key: SortKey
  label: string
  /** The column width in px; null for a column that takes (a share of) the spare width. */
  width: number | null
}

/** Each flexible column keeps at least this width; narrower overlays scroll the table sideways. */
const FLEX_MIN_WIDTH = 260

function ncrColumns(group: PerformanceGroup): NcrColumn[] {
  return [
    { key: 'workWeek', label: 'Work Week', width: 120 },
    { key: 'source', label: 'Source', width: 120 },
    // Tag numbers run long (P4-WR1XX001-1-SWIRL-…), so for welds Tag No shares the spare width with Issue.
    { key: 'place', label: group === 'welders' ? 'Tag No' : 'Building', width: group === 'welders' ? null : 150 },
    { key: 'issue', label: 'Issue', width: null },
  ]
}

/** Text columns start A to Z. */
const ASCENDING_FIRST: readonly SortKey[] = ['source', 'place', 'issue'] as const

/** Row positions in display order; ties keep the detail's newest-first order. */
function sortPositions(rows: PersonNcrRow[], sort: SortState<SortKey>, ranksFor: (key: TextKey) => Uint32Array): number[] {
  const sign = directionSign(sort.direction)
  const key = sort.key
  const positions = rows.map((_, position) => position)
  if (key === 'workWeek') return positions.sort((a, b) => (rows[a].weekKey - rows[b].weekKey) * sign || a - b)
  const ranks = ranksFor(key)
  return positions.sort((a, b) => (ranks[a] - ranks[b]) * sign || a - b)
}

/** How the active sort reads in the caption: newest or oldest first for weeks, A to Z or Z to A for text. */
function sortWords(sort: SortState<SortKey>): string {
  if (sort.key === 'workWeek') return sort.direction === 'descending' ? 'newest first' : 'oldest first'
  return sort.direction === 'ascending' ? 'A to Z' : 'Z to A'
}

interface NcrTableProps {
  group: PerformanceGroup
  /** Newest first. */
  rows: PersonNcrRow[]
  /** Names the rows; the active sort is added to it. */
  caption: string
}

function NcrTable({ group, rows, caption }: NcrTableProps): ReactElement {
  const columns = ncrColumns(group)
  const tableMinWidth = columns.reduce((sum, column) => sum + (column.width ?? FLEX_MIN_WIDTH), 0)
  // The detail is newest first, so this initial sort matches it.
  const { sort, toggleSort } = useTableSort<SortKey>({ key: 'workWeek', direction: 'descending' }, ASCENDING_FIRST)
  // A fresh cache per data set; each text column's ranks are built the first time it is sorted.
  const ranksFor = useMemo(() => createRankCache<TextKey, PersonNcrRow>(rows), [rows])
  const order = useMemo(() => sortPositions(rows, sort, ranksFor), [rows, sort, ranksFor])
  const { containerRef, onScroll, start, end, paddingTop, paddingBottom } = useVirtualRows<HTMLDivElement>(
    order.length,
    TABLE_ROW_HEIGHT,
    `${sort.key}:${sort.direction}`,
  )

  return (
    <div className="qaqc-table-wrap is-flex-fill qaqc-perf-ncr-wrap" ref={containerRef} onScroll={onScroll}>
      <table className="qaqc-table is-windowed qaqc-perf-ncr-table" aria-rowcount={rows.length + 1} style={{ minWidth: tableMinWidth }}>
        <caption className="qaqc-visually-hidden">
          {`${caption}, by ${columns.find((column) => column.key === sort.key)?.label ?? ''}, ${sortWords(sort)}`}
        </caption>
        <colgroup>
          {columns.map((column) => (
            <col key={column.key} style={column.width === null ? undefined : { width: column.width }} />
          ))}
        </colgroup>
        <thead>
          <tr aria-rowindex={1}>
            {columns.map((column) => (
              <th key={column.key} scope="col" className="is-text" aria-sort={sort.key === column.key ? sort.direction : undefined}>
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
              <tr key={position} aria-rowindex={start + offset + 2} style={{ height: TABLE_ROW_HEIGHT }}>
                <td className="is-text">{row.weekLabel}</td>
                <td className="is-text">
                  <span className="qaqc-perf-source">{row.source}</span>
                </td>
                <td className="is-text" title={row.place}>{row.place}</td>
                <td className="is-text qaqc-perf-ncr-issue" title={row.issue}>{row.issue}</td>
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

interface TotalsCardsProps {
  title: string
  subtitle: string
  variant: 'week' | 'total'
  totals: PerformanceTotals
  words: CardWords
}

function TotalsCards({ title, subtitle, variant, totals, words }: TotalsCardsProps): ReactElement {
  return (
    <KpiGroup title={title} subtitle={subtitle} variant={variant}>
      <KpiCard label={words.volumeLabel} icon={words.volumeIcon} value={formatCount(totals.volume)} detail={words.volumeDetail} tone="neutral" trend="none" />
      <KpiCard label="NCRs" icon={TriangleAlert} value={formatCount(totals.ncrs)} detail={words.ncrDetail} tone="neutral" trend="none" />
      <KpiCard label="NCR rate" icon={Percent} value={formatNcrRate(totals.rate)} detail={words.rateDetail} tone="neutral" trend="none" />
    </KpiGroup>
  )
}

export interface PersonDetailProps {
  index: PerformanceIndex
  group: PerformanceGroup
  personKey: string
  /** The dashboard's period: the range ending at the picked week. */
  view: ViewState
  colors: ChartColors
  animate: boolean
  /** Screen reader chart summaries (Format pane, Accessibility), passed to the week chart. */
  describe: boolean
  onHover: TooltipHandler
}

/**
 * The person overlay's content: period and all-time cards, the week-by-week chart and the period's NCRs.
 * Mount it only while the overlay is open: the detail is built from the index on mount.
 */
export function PersonDetail({ index, group, personKey, view, colors, animate, describe, onHover }: PersonDetailProps): ReactElement {
  const { selectedKey, windowEndKey, range } = view
  // Keyed on the view's values, not its object, so a dashboard re-render with an equal view does not rebuild.
  const detail = useMemo(
    () => buildPersonDetail(index, group, personKey, { selectedKey, windowEndKey, range }),
    [index, group, personKey, selectedKey, windowEndKey, range],
  )
  const words = CARD_WORDS[group]

  if (detail === null) {
    return (
      <div className="qaqc-perf-person">
        <p className="qaqc-perf-person-missing">This person has no rows in the data</p>
      </div>
    )
  }

  const firstWeek = detail.weeks[0]?.week ?? null
  const lastWeek = detail.weeks[detail.weeks.length - 1]?.week ?? null
  const periodLabel = firstWeek !== null && lastWeek !== null ? `${firstWeek.label} to ${lastWeek.label}` : ''
  const allTimeLabel = index.weeks.length > 0 ? `${index.weeks[0].label} to ${index.weeks[index.weeks.length - 1].label}` : ''
  const volumeNoun = pluralize(detail.period.volume, words.volumeNoun[0], words.volumeNoun[1])
  const inPeriod = periodLabel === '' ? '' : ` in ${periodLabel}`
  const emptyDetail = detail.period.volume === 0
    ? `No ${words.volumeNoun[1]}${inPeriod}.`
    : `${formatCount(detail.period.volume)} ${volumeNoun}${inPeriod}, none with an NCR.`

  return (
    <div className="qaqc-perf-person">
      {/* No heading or subtitle: the overlay title carries the name, the group and the disciplines. */}
      <div className="qaqc-kpi-row qaqc-perf-person-cards">
        <TotalsCards title="This period" subtitle={periodLabel} variant="week" totals={detail.period} words={words} />
        <TotalsCards title="All time" subtitle={allTimeLabel} variant="total" totals={detail.allTime} words={words} />
      </div>

      <ChartPanel
        title="Week by week"
        icon={ChartColumn}
        legend={personWeekLegend(colors, group)}
        emptyMessage={detail.period.volume === 0 ? `No ${words.volumeNoun[1]} in this period` : null}
        className="qaqc-perf-person-chart"
      >
        {(size) => (
          <PersonWeekChart
            weeks={detail.weeks}
            group={group}
            width={size.width}
            height={size.height}
            colors={colors}
            animate={animate}
            describe={describe}
            onHover={onHover}
          />
        )}
      </ChartPanel>

      {detail.ncrRows.length > 0 ? (
        <NcrTable
          group={group}
          rows={detail.ncrRows}
          caption={`NCRs for ${detail.name}${periodLabel === '' ? '' : `, ${periodLabel}`}`}
        />
      ) : (
        <p className="qaqc-issue-detail-empty qaqc-perf-person-empty">
          <Inbox size={22} aria-hidden="true" />
          <strong>No NCRs in this period</strong>
          <span>{emptyDetail}</span>
        </p>
      )}
    </div>
  )
}
