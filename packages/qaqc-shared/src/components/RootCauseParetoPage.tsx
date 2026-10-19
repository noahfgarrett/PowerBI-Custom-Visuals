import { ChartColumnDecreasing, ListFilter } from 'lucide-react'
import { useMemo, useState, type ReactElement } from 'react'

import type { ChartColors, TooltipHandler } from '../chartTypes'
import { formatCount, pluralize } from '../format'
import { directionSign, type SortState } from '../hooks/useTableSort'
import { TABLE_ROW_HEIGHT, useVirtualRows } from '../hooks/useVirtualRows'
import { RECENT_WEEK_COUNT } from '../inspections'
import { buildRootCausePareto, paretoIssues, paretoPeriod, type ParetoBar, type ParetoIssueRow, type ParetoScope } from '../rootCauses'
import { compareNullLast, textRanks } from '../tableSort'
import type { IssueIndex, RangeMode, ViewState, WorkWeek } from '../types'
import { ChartFill } from './ChartFill'
import { LegendSwatch, type LegendItem } from './ChartPanel'
import { ParetoChart, paretoGrey } from './ParetoChart'
import { RangeToggle } from './RangeToggle'
import { ParetoReadout, RootCauseCategoryPanel } from './RootCauseCategoryPanel'
import { SegmentedToggle, type SegmentedOption } from './SegmentedToggle'
import { WorkWeekPicker } from './WorkWeekPicker'

const PAGE_TITLE = 'Issues by Root Cause Pareto'
const CHART_TITLE = 'Issues by Root Cause'

const SCOPE_OPTIONS: ReadonlyArray<SegmentedOption<ParetoScope>> = [
  { value: 'all', text: 'All issues' },
  { value: 'open', text: 'Open only' },
] as const

/** The page overlay's title: the period follows the dashboard's 30 WW | All and its selected week. */
export function paretoTitle(index: IssueIndex, view: ViewState): string {
  const period = paretoPeriod(index, view, index.today)
  return `${PAGE_TITLE} · ${period.firstWeek.label} to ${period.lastWeek.label}`
}

function paretoLegend(colors: ChartColors, isHighContrast: boolean, hasNotRecorded: boolean): LegendItem[] {
  const items: LegendItem[] = [
    { label: 'Issues up to 80%', color: colors.series1, shape: 'bar' },
    { label: 'Beyond 80%', color: colors.series2, shape: 'bar' },
  ]
  if (hasNotRecorded) items.push({ label: 'Not recorded', color: paretoGrey(colors, isHighContrast), shape: 'bar' })
  items.push({ label: 'Cumulative %', color: colors.warn, shape: 'line' }, { label: '80% line', color: colors.ink, shape: 'dashed' })
  return items
}

// ---------------------------------------------------------------- drill-down table

type TextKey = 'title' | 'status' | 'contractor'
type NumberKey = 'id' | 'created' | 'days'
type SortKey = TextKey | NumberKey

interface Column {
  key: SortKey
  label: string
  isText: boolean
  /** Width in px; null for Title, which takes the spare width. */
  width: number | null
}

// Fixed widths (table-layout: fixed) keep the columns still while the windowed rows scroll past.
const COLUMNS: readonly Column[] = [
  { key: 'id', label: 'ID', isText: true, width: 72 },
  { key: 'title', label: 'Title', isText: true, width: null },
  { key: 'status', label: 'Status', isText: true, width: 136 },
  { key: 'contractor', label: 'Contractor', isText: true, width: 196 },
  { key: 'created', label: 'Created On', isText: false, width: 108 },
  { key: 'days', label: 'Age / To close', isText: false, width: 124 },
] as const
const TITLE_MIN_WIDTH = 180
const TABLE_MIN_WIDTH = COLUMNS.reduce((sum, column) => sum + (column.width ?? 0), TITLE_MIN_WIDTH)

type StatusPillKind = 'closed' | 'open' | 'other'

function isTextKey(key: SortKey): key is TextKey {
  return key === 'title' || key === 'status' || key === 'contractor'
}

/** ID and the text columns start A to Z; the date and day counts start largest first. */
function firstDirection(key: SortKey): SortState<SortKey>['direction'] {
  return key === 'id' || isTextKey(key) ? 'ascending' : 'descending'
}

function numberValue(row: ParetoIssueRow, key: NumberKey): number | null {
  switch (key) {
    case 'id':
      return row.issue.detail.idRank
    case 'created':
      return row.issue.detail.createdOnTime
    case 'days':
      return row.days
    default: {
      const unreachable: never = key
      return unreachable
    }
  }
}

/** Row positions in display order. With no sort, the model's order: open oldest first, then closed. Ties keep it. */
function sortPositions(rows: readonly ParetoIssueRow[], sort: SortState<SortKey> | null): number[] {
  const positions = rows.map((_, position) => position)
  if (sort === null) return positions
  const sign = directionSign(sort.direction)
  const key = sort.key
  if (isTextKey(key)) {
    const ranks = textRanks(rows, (row) => row.issue.detail[key])
    return positions.sort((a, b) => (ranks[a] - ranks[b]) * sign || a - b)
  }
  const values = rows.map((row) => numberValue(row, key))
  return positions.sort((a, b) => compareNullLast(values[a], values[b], sign) || a - b)
}

function statusPillKind(row: ParetoIssueRow): StatusPillKind {
  const { detail } = row.issue
  if (detail.statusKind === 'closed') return 'closed'
  return detail.status.trim().toLowerCase() === 'open' ? 'open' : 'other'
}

function daysText(row: ParetoIssueRow): string {
  return row.isOpen ? `${formatCount(row.days)} d old` : `${formatCount(row.days)} d to close`
}

interface ParetoIssueTableProps {
  bar: ParetoBar
  rows: ParetoIssueRow[]
  period: string
}

function ParetoIssueTable({ bar, rows, period }: ParetoIssueTableProps): ReactElement {
  // Null until a header is clicked: the model order is not any one column's order.
  const [sort, setSort] = useState<SortState<SortKey> | null>(null)
  const order = useMemo(() => sortPositions(rows, sort), [rows, sort])
  const { containerRef, onScroll, start, end, paddingTop, paddingBottom } = useVirtualRows<HTMLDivElement>(
    order.length,
    TABLE_ROW_HEIGHT,
    sort === null ? '' : `${sort.key}:${sort.direction}`,
  )
  const openCount = useMemo(() => rows.reduce((sum, row) => sum + (row.isOpen ? 1 : 0), 0), [rows])
  const sortedLabel = sort === null ? null : COLUMNS.find((column) => column.key === sort.key)?.label ?? null

  function toggleSort(key: SortKey): void {
    setSort((current) => {
      if (current !== null && current.key === key) {
        return { key, direction: current.direction === 'ascending' ? 'descending' : 'ascending' }
      }
      return { key, direction: firstDirection(key) }
    })
  }

  return (
    <section className="qaqc-panel qaqc-pareto-table" aria-label={`${bar.label} issues`}>
      <header className="qaqc-panel-title">
        <ListFilter size={15} aria-hidden="true" />
        <h3 title={bar.label}>{bar.label}</h3>
        <span className="qaqc-pareto-chip">{`${formatCount(rows.length)} ${pluralize(rows.length, 'issue', 'issues')}`}</span>
        <span className="qaqc-pareto-table-note">
          {`${formatCount(openCount)} open · ${formatCount(rows.length - openCount)} closed · ${
            sortedLabel === null ? 'open first, oldest first' : `sorted by ${sortedLabel}`
          } · click a bar to switch`}
        </span>
      </header>
      <div className="qaqc-table-wrap is-flex-fill qaqc-pareto-table-wrap" ref={containerRef} onScroll={onScroll}>
        <table className="qaqc-table is-windowed qaqc-pareto-drill-table" aria-rowcount={rows.length + 1} style={{ minWidth: TABLE_MIN_WIDTH }}>
          <caption className="qaqc-visually-hidden">{`${bar.label}: issues created ${period}`}</caption>
          <colgroup>
            {COLUMNS.map((column) => (
              <col key={column.key} style={column.width === null ? undefined : { width: column.width }} />
            ))}
          </colgroup>
          <thead>
            <tr aria-rowindex={1}>
              {COLUMNS.map((column) => (
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
                <td colSpan={COLUMNS.length} />
              </tr>
            )}
            {order.slice(start, end).map((position, offset) => {
              const row = rows[position]
              const { detail } = row.issue
              return (
                // The position is the key: a blank or repeated ID must not collide.
                <tr key={position} aria-rowindex={start + offset + 2} style={{ height: TABLE_ROW_HEIGHT }}>
                  <th scope="row">{detail.id}</th>
                  <td className="is-text" title={detail.title}>{detail.title}</td>
                  <td className="is-text">
                    <span className={`qaqc-status-pill is-${statusPillKind(row)}`} title={detail.status}>{detail.status}</span>
                  </td>
                  <td className="is-text" title={detail.contractor}>{detail.contractor}</td>
                  <td>{detail.createdOn}</td>
                  <td className={row.isOpen ? 'qaqc-pareto-days' : 'qaqc-pareto-days is-closed'}>{daysText(row)}</td>
                </tr>
              )
            })}
            {paddingBottom > 0 && (
              <tr className="qaqc-virtual-spacer" aria-hidden="true" style={{ height: paddingBottom }}>
                <td colSpan={COLUMNS.length} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- page

export interface RootCauseParetoPageProps {
  index: IssueIndex
  /** The dashboard's week window: the page's period, which its range toggle and week picker change. */
  view: ViewState
  /** Newest first. */
  weekOptions: WorkWeek[]
  colors: ChartColors
  isHighContrast: boolean
  onPickWeek: (key: number) => void
  onRangeChange: (mode: RangeMode) => void
  onHover: TooltipHandler
}

/**
 * The Issues by Root Cause Pareto page opened from the BIM Issues header: issues created in the dashboard's period
 * by root cause, with the category split, the read-out, and the selected bar's issues. Mount it only while the page
 * is open; it builds the Pareto for the period and scope.
 */
export function RootCauseParetoPage({
  index,
  view,
  weekOptions,
  colors,
  isHighContrast,
  onPickWeek,
  onRangeChange,
  onHover,
}: RootCauseParetoPageProps): ReactElement {
  const [scope, setScope] = useState<ParetoScope>('all')
  // Null selects the top bar.
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const model = useMemo(() => buildRootCausePareto(index, view, scope, index.today), [index, view, scope])
  const { bars, total } = model

  // A new scope or period can drop the selected cause from the bars; the top bar takes over. Adjusted during
  // render, so the old cause's issues are never drawn under the new chart.
  const isSelectionGone = selectedKey !== null && !bars.some((bar) => bar.key === selectedKey)
  if (isSelectionGone) setSelectedKey(null)
  const selected = (isSelectionGone ? undefined : bars.find((bar) => bar.key === selectedKey)) ?? bars[0] ?? null

  const rows = useMemo(() => (selected === null ? [] : paretoIssues(index, selected, view, scope, index.today)), [index, selected, view, scope])
  const period = `${model.firstWeek.label} to ${model.lastWeek.label}`
  const hasNotRecorded = bars.some((bar) => bar.kind === 'notRecorded')
  const legend = paretoLegend(colors, isHighContrast, hasNotRecorded)
  const topCause = bars.length > 0 && bars[0].kind === 'cause' ? bars[0].label : null
  const otherBar = bars.find((bar) => bar.kind === 'other') ?? null
  const hasSide = model.categories !== null
  const counted = scope === 'open' ? `open as of ${model.lastWeek.label}` : pluralize(total, 'issue', 'issues')

  return (
    <div className={hasSide ? 'qaqc-pareto has-side' : 'qaqc-pareto'}>
      <section className="qaqc-panel qaqc-pareto-chart-panel" aria-label={CHART_TITLE}>
        <header className="qaqc-panel-title">
          <ChartColumnDecreasing size={15} aria-hidden="true" />
          <h3>{CHART_TITLE}</h3>
          <span className="qaqc-pareto-chart-note">
            <b>{formatCount(total)}</b>
            {` ${counted} · `}
            <b>{formatCount(model.distinct)}</b>
            {` distinct ${pluralize(model.distinct, 'cause', 'causes')}`}
          </span>
          <div className="qaqc-pareto-controls">
            <SegmentedToggle label="Issues counted" options={SCOPE_OPTIONS} value={scope} disabled={false} onChange={setScope} />
            <RangeToggle value={view.range} recentCount={RECENT_WEEK_COUNT} disabled={false} onChange={onRangeChange} />
            <WorkWeekPicker options={weekOptions} valueKey={model.lastWeek.key} disabled={false} onChange={onPickWeek} />
          </div>
        </header>
        <ul className="qaqc-legend">
          {legend.map((item) => (
            <li key={item.label}>
              <LegendSwatch item={item} />
              {item.label}
            </li>
          ))}
        </ul>
        <div className="qaqc-chart-body">
          {total === 0 || selected === null ? (
            <p className="qaqc-chart-empty">{scope === 'open' ? 'No open issues in this period' : 'No issues in this period'}</p>
          ) : (
            <ChartFill>
              {(size) => (
                <ParetoChart
                  bars={bars}
                  crossIndex={model.crossIndex}
                  selectedKey={selected.key}
                  width={size.width}
                  height={size.height}
                  colors={colors}
                  isHighContrast={isHighContrast}
                  onSelect={setSelectedKey}
                  onHover={onHover}
                />
              )}
            </ChartFill>
          )}
        </div>
        {!hasSide && model.readout !== '' && (
          <div className="qaqc-pareto-readout is-inline">
            <ParetoReadout readout={model.readout} topCause={topCause} />
          </div>
        )}
      </section>
      {model.categories !== null && (
        <RootCauseCategoryPanel
          categories={model.categories}
          otherLabel={otherBar === null ? null : otherBar.label}
          otherCauses={model.otherCauses}
          summary={`${formatCount(total)} ${scope === 'open' ? 'open ' : ''}${pluralize(total, 'issue', 'issues')} · ${period}`}
          readout={model.readout}
          topCause={topCause}
          colors={colors}
          isHighContrast={isHighContrast}
        />
      )}
      {selected !== null && total > 0 && (
        <ParetoIssueTable
          key={`${scope}:${view.range}:${view.windowEndKey}:${view.selectedKey}:${selected.key}`}
          bar={selected}
          rows={rows}
          period={period}
        />
      )}
    </div>
  )
}
