import { ChartColumnDecreasing, ListFilter } from 'lucide-react'
import { useMemo, useState, type ReactElement } from 'react'

import type { ChartColors, TooltipHandler } from '../chartTypes'
import { formatCount, pluralize } from '../format'
import { RECENT_WEEK_COUNT } from '../inspections'
import { buildRootCausePareto, paretoIssues, paretoPeriod, type ParetoBar, type ParetoIssueRow, type ParetoScope } from '../rootCauses'
import type { IssueIndex, RangeMode, ViewState, WorkWeek } from '../types'
import { ChartFill } from './ChartFill'
import { LegendSwatch, type LegendItem } from './ChartPanel'
import { ParetoChart, paretoGrey } from './ParetoChart'
import { RangeToggle } from './RangeToggle'
import { ParetoReadout, RootCauseCategoryPanel } from './RootCauseCategoryPanel'
import { SegmentedToggle, type SegmentedOption } from './SegmentedToggle'
import { StatusPill, useIssueTableSort, WindowedIssueTable, type IssueTableColumn } from './WindowedIssueTable'
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

type SortKey = 'id' | 'title' | 'status' | 'contractor' | 'created' | 'days'

// ID and the text columns start A to Z; the date and day counts start largest first.
const COLUMNS: ReadonlyArray<IssueTableColumn<ParetoIssueRow, SortKey>> = [
  { key: 'id', label: 'ID', width: 72, isText: true, firstDirection: 'ascending', sortValue: { kind: 'number', valueOf: (row) => row.issue.detail.idRank } },
  { key: 'title', label: 'Title', width: null, isText: true, firstDirection: 'ascending', sortValue: { kind: 'text', valueOf: (row) => row.issue.detail.title } },
  { key: 'status', label: 'Status', width: 136, isText: true, firstDirection: 'ascending', sortValue: { kind: 'text', valueOf: (row) => row.issue.detail.status } },
  { key: 'contractor', label: 'Contractor', width: 196, isText: true, firstDirection: 'ascending', sortValue: { kind: 'text', valueOf: (row) => row.issue.detail.contractor } },
  { key: 'created', label: 'Created On', width: 108, isText: false, firstDirection: 'descending', sortValue: { kind: 'number', valueOf: (row) => row.issue.detail.createdOnTime } },
  { key: 'days', label: 'Age / To close', width: 124, isText: false, firstDirection: 'descending', sortValue: { kind: 'number', valueOf: (row) => row.days } },
] as const
const TITLE_MIN_WIDTH = 180

function daysText(row: ParetoIssueRow): string {
  return row.isOpen ? `${formatCount(row.days)} d old` : `${formatCount(row.days)} d to close`
}

interface ParetoIssueTableProps {
  bar: ParetoBar
  rows: ParetoIssueRow[]
  period: string
}

/** The selected bar's issues. Until a header is clicked they keep the model order: open oldest first, then closed. */
function ParetoIssueTable({ bar, rows, period }: ParetoIssueTableProps): ReactElement {
  const table = useIssueTableSort(rows, COLUMNS, null)
  const { sort } = table
  const openCount = useMemo(() => rows.reduce((sum, row) => sum + (row.isOpen ? 1 : 0), 0), [rows])
  const sortedLabel = sort === null ? null : COLUMNS.find((column) => column.key === sort.key)?.label ?? null

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
      <WindowedIssueTable
        rows={rows}
        columns={COLUMNS}
        table={table}
        titleMinWidth={TITLE_MIN_WIDTH}
        wrapClassName="qaqc-pareto-table-wrap"
        tableClassName="qaqc-pareto-drill-table"
        caption={`${bar.label}: issues created ${period}`}
        renderCells={(row) => {
          const { detail } = row.issue
          return (
            <>
              <th scope="row">{detail.id}</th>
              <td className="is-text" title={detail.title}>{detail.title}</td>
              <td className="is-text">
                <StatusPill detail={detail} />
              </td>
              <td className="is-text" title={detail.contractor}>{detail.contractor}</td>
              <td>{detail.createdOn}</td>
              <td className={row.isOpen ? 'qaqc-pareto-days' : 'qaqc-pareto-days is-closed'}>{daysText(row)}</td>
            </>
          )
        }}
      />
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
        {!hasSide && model.readout.length > 0 && (
          <div className="qaqc-pareto-readout is-inline">
            <ParetoReadout lines={model.readout} />
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
