import {
  Activity,
  ChartColumnDecreasing,
  CircleAlert,
  CircleCheck,
  CircleDot,
  CirclePlus,
  ClipboardCheck,
  FilePen,
  FileText,
  Flame,
  Gauge,
  Hourglass,
  Layers,
  Percent,
  ShieldCheck,
  Signature,
  TrendingUp,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { useMemo, useRef, useState, type ReactElement } from 'react'

import { useDashboardFilters } from '../hooks/useDashboardFilters'
import type { ElementSize } from '../hooks/useElementSize'
import { useOverviewModel } from '../hooks/useOverviewModel'
import { useWeekWindow } from '../hooks/useWeekWindow'
import { activityLegend, ActivityLinesChart } from './ActivityLinesChart'
import { ChartExpansionFrame, COMPACT_WIDTH, type ChartExpansionHandle, type ExpandablePanel, type GridPanel } from './ChartExpansionFrame'
import { ChartFill } from './ChartFill'
import { ChartPanel } from './ChartPanel'
import { DashboardHeader, type DashboardChromeProps } from './DashboardHeader'
import { FilterChips } from './FilterChips'
import { FilterEmptyState } from './FilterEmptyState'
import { Footnotes } from './Footnotes'
import { KpiGroup } from './KpiGroup'
import { LoadingBar } from './LoadingBar'
import { OverviewDenseValue, OverviewDisciplineRow, OverviewKpiCard, OverviewRowLabel, type OverviewCardIcons } from './OverviewDisciplineRow'
import { OverviewWeekTable } from './OverviewWeekTable'
import { QualityRatesChart, qualityRatesLegend } from './QualityRatesChart'
import { SegmentedToggle, type SegmentedOption } from './SegmentedToggle'
import { WeekIssuesPage } from './WeekIssuesPage'
import { overviewDrillGroups } from '../drilldown'
import { restateOverviewFootnotes } from '../footnotes'
import { RECENT_WEEK_COUNT } from '../inspections'
import { overviewChartRows, overviewWeekNcrs, type CardMode, type OverviewIndex, type OverviewRows } from '../overview'
import {
  filterOverviewIndex,
  overviewFilterFields,
  overviewFilterNotes,
  overviewFilterRows,
  overviewRowWeekKey,
  type FilteredOverview,
  type OverviewFilterSource,
} from '../overviewFilters'
import { chartColorsFromTheme } from '../theme'

const NO_ROWS_MESSAGE = 'No QCx Combined rows match the current filters'
const NO_ACTIVITY_IN_RANGE_MESSAGE = 'No inspections in this range'
const NO_RATES_IN_RANGE_MESSAGE = 'No Finals or welds in this range'
const NO_ACTIVITY_MATCH_MESSAGE = 'No inspections match the current filters'
const NO_RATES_MATCH_MESSAGE = 'No Finals or welds match the current filters'
const OUTSIDE_WINDOW_MESSAGE = `Nothing in this window. These rows fall outside the last ${RECENT_WEEK_COUNT} WW: switch to All to see them.`

/**
 * Tiles shorter than this show the cards only, without the charts. The Overview stacks far more than the other
 * dashboards, so the shared CARDS_ONLY_HEIGHT (420) would leave the charts no room. Measured from the stylesheet: the
 * root's 12 + 10 px padding, the 30 px header, the root's two 10 px gaps (header, footnotes), the 267 px discipline rows
 * (a 15 px head and four 61 px rows of cards inside 8 px padding and the border), the body's two 8 px gaps, the 110 px
 * two-line quality strip, the 180 px chart minimum (`.qaqc-overview-charts`) and a 12 px footnote line:
 * 22 + 30 + 20 + 267 + 16 + 110 + 180 + 12 = 657, rounded up to 660. A chip row's 27 px comes out of the chart minimum,
 * so filtering a tile at this height doesn't take its charts away.
 */
export const OVERVIEW_CARDS_ONLY_HEIGHT = 660

/**
 * Cards-only tiles shorter than this use the dense one-line layout: the full cards alone need the same parts without
 * the charts and the body gap above them, 22 + 30 + 20 + 267 + 8 + 110 + 12 = 469, rounded up to 480. Narrow
 * cards-only tiles are always dense, since their full cards stack two by two.
 */
export const OVERVIEW_DENSE_HEIGHT = 480

/** Dense tiles narrower than this drop the sparklines, so a value such as 100.0% isn't cut short to 1… */
export const OVERVIEW_TIGHT_WIDTH = 640

/** The `This WW | To date` switch for the cards. */
const CARD_MODE_OPTIONS: ReadonlyArray<SegmentedOption<CardMode>> = [
  { value: 'week', text: 'This WW' },
  { value: 'toDate', text: 'To date' },
]

/** The same switch in a date range, whose totals are the range's. */
const IN_RANGE_MODE_OPTIONS: ReadonlyArray<SegmentedOption<CardMode>> = [
  { value: 'week', text: 'This WW' },
  { value: 'toDate', text: 'In range' },
]

type ChartId = 'activity' | 'rates'
type PanelId = ChartId | 'drill'

const CHART_IDS: readonly ChartId[] = ['activity', 'rates'] as const

interface DisciplineConfig {
  key: keyof OverviewRows
  name: string
  icon: LucideIcon
  /** What the row's sparkline plots. */
  metric: string
  cardIcons: OverviewCardIcons
}

const INSPECTION_CARD_ICONS: OverviewCardIcons = [ClipboardCheck, Wrench, CircleAlert, Gauge] as const

const DISCIPLINES: readonly DisciplineConfig[] = [
  { key: 'electrical', name: 'Electrical', icon: Zap, metric: 'Finals + SORs', cardIcons: INSPECTION_CARD_ICONS },
  { key: 'mechanical', name: 'Mechanical', icon: Wrench, metric: 'Finals + SORs', cardIcons: INSPECTION_CARD_ICONS },
  { key: 'welding', name: 'Welding', icon: Flame, metric: 'Welds logged', cardIcons: [Layers, Signature, Percent, CircleAlert] },
  { key: 'bim', name: 'BIM Issues', icon: CircleAlert, metric: 'Remaining open', cardIcons: [CirclePlus, CircleCheck, CircleDot, Hourglass] },
] as const

/** One icon per quality card, in the strip's order. */
type QualityIcons = readonly [LucideIcon, LucideIcon, LucideIcon, LucideIcon, LucideIcon, LucideIcon]

/** CORs, NCRs, Inspection NCR pass rate, Welding NCR pass rate, DWNs, Top root cause. */
const QUALITY_ICONS: QualityIcons = [FilePen, CircleAlert, ClipboardCheck, Flame, FileText, ChartColumnDecreasing] as const

export interface OverviewDashboardProps extends DashboardChromeProps {
  /** Built over all of `filterSource.split`, once per data update. */
  index: OverviewIndex
  filterSource: OverviewFilterSource
}

/** The QCx Overview: every discipline's cards for one week or to date, the quality strip, and two charts. */
export function OverviewDashboard({
  title,
  icon,
  index: baseIndex,
  filterSource,
  theme,
  interactive,
  animate,
  describeCharts,
  loading,
  footnotes,
  viewport,
  onHover,
}: OverviewDashboardProps): ReactElement {
  const { split: baseSplit, columns } = filterSource
  const fields = useMemo(() => overviewFilterFields(columns), [columns])
  const filterNotes = useMemo(() => overviewFilterNotes(columns), [columns])
  const rowWeekKey = useMemo(() => overviewRowWeekKey(columns), [columns])
  const filterRows = useMemo(() => overviewFilterRows(baseSplit, columns), [baseSplit, columns])
  const filters = useDashboardFilters({ rows: filterRows, fields, weeks: baseIndex.weeks, currentKey: baseIndex.currentWeek.key, notes: filterNotes, rowWeekKey })
  const { filteredRows, isFieldFilterActive, dateRange } = filters
  // Only the sources a filter changes are read again. The drill list's positions index `split`, the rows behind `index`.
  const { index, split } = useMemo(
    (): FilteredOverview => (
      isFieldFilterActive
        ? filterOverviewIndex(baseIndex, baseSplit, filteredRows, columns)
        : { index: baseIndex, split: baseSplit }
    ),
    [isFieldFilterActive, baseIndex, baseSplit, filteredRows, columns],
  )
  const { view, range, selectWeek, pickWeek, changeRange } = useWeekWindow(index, dateRange)
  const [mode, setMode] = useState<CardMode>('week')
  const frame = useRef<ChartExpansionHandle<PanelId> | null>(null)

  // The series are memoised on the view alone, so a card mode switch never rebuilds the charts' data.
  const { cards, series } = useOverviewModel(index, view, mode)
  const selectedKey = cards.selectedWeek.key
  const drillGroups = useMemo(() => overviewDrillGroups(index, split, columns, selectedKey), [index, split, columns, selectedKey])
  // Memoized so the charts' own memos see the same colors object until the theme changes.
  const colors = useMemo(() => chartColorsFromTheme(theme), [theme])
  const isCompact = viewport.width < COMPACT_WIDTH
  const isCardsOnly = viewport.height < OVERVIEW_CARDS_ONLY_HEIGHT
  const isDense = isCardsOnly && (isCompact || viewport.height < OVERVIEW_DENSE_HEIGHT)
  const isWeekMode = mode === 'week'
  const isInRange = cards.rangeLabel !== null
  const cardsSubtitle = isWeekMode ? cards.selectedWeek.label : cards.rangeLabel ?? `Through ${cards.selectedWeek.label}`
  const totals = series.windowTotals
  const hasActivity = totals.electricalFinals + totals.electricalSors + totals.mechanicalFinals + totals.mechanicalSors > 0
  const hasRates = totals.electricalFinals + totals.mechanicalFinals + totals.welds > 0
  const hasNoMatch = filters.isAnyActive && !cards.hasData
  const notes = isFieldFilterActive ? restateOverviewFootnotes(footnotes, baseIndex, index) : footnotes
  const { hasActivityRows, hasRatesRows } = overviewChartRows(index)
  /** Why a chart with no points of its own is empty, when another source's rows keep the dashboard up; null when it has some. */
  function chartEmptyMessage(hasPoints: boolean, hasRows: boolean, inRangeMessage: string, noMatchMessage: string): string | null {
    if (!cards.hasData) return NO_ROWS_MESSAGE
    if (hasPoints) return null
    if (isInRange) return inRangeMessage
    if (!isFieldFilterActive) return null
    if (!hasRows) return noMatchMessage
    return range === 'recent' ? OUTSIDE_WINDOW_MESSAGE : null
  }
  const groupClass = `qaqc-kpi-group is-${mode}`
  const tightClass = viewport.width < OVERVIEW_TIGHT_WIDTH ? ' is-tight' : ''
  const rowsClass = isDense ? `${groupClass} qaqc-overview-rows is-dense${tightClass}` : `${groupClass} qaqc-overview-rows`

  /** A week click or Enter on a chart: selects the week, and opens its list when it has NCRs. */
  function selectChartWeek(chart: ChartId, key: number): void {
    selectWeek(key)
    if (overviewWeekNcrs(index, key) > 0) frame.current?.openPageFromChart('drill', chart)
  }

  function renderActivity(size: ElementSize, showValues: boolean): ReactElement {
    return (
      <ActivityLinesChart
        points={series.activity}
        selectedKey={cards.selectedWeek.key}
        width={size.width}
        height={size.height}
        colors={colors}
        isHighContrast={theme.isHighContrast}
        interactive={interactive}
        animate={animate}
        describe={describeCharts}
        showValues={showValues}
        onSelectWeek={(key) => selectChartWeek('activity', key)}
        onHover={onHover}
      />
    )
  }

  function renderRates(size: ElementSize, showValues: boolean): ReactElement {
    return (
      <QualityRatesChart
        points={series.rates}
        selectedKey={cards.selectedWeek.key}
        width={size.width}
        height={size.height}
        colors={colors}
        isHighContrast={theme.isHighContrast}
        interactive={interactive}
        animate={animate}
        describe={describeCharts}
        showValues={showValues}
        onSelectWeek={(key) => selectChartWeek('rates', key)}
        onHover={onHover}
      />
    )
  }

  const charts: Record<ChartId, GridPanel> = {
    activity: {
      title: 'Inspection activity by Work Week',
      icon: Activity,
      legend: activityLegend(colors, theme.isHighContrast),
      emptyMessage: chartEmptyMessage(hasActivity, hasActivityRows, NO_ACTIVITY_IN_RANGE_MESSAGE, NO_ACTIVITY_MATCH_MESSAGE),
      className: 'qaqc-panel-main',
      renderChart: (size) => renderActivity(size, false),
      renderExpanded: () => (
        <div className="qaqc-overview-expanded">
          <ChartFill>{(size) => renderActivity(size, true)}</ChartFill>
          <OverviewWeekTable variant="activity" points={series.activity} />
        </div>
      ),
    },
    rates: {
      title: 'Quality rates by Work Week',
      icon: TrendingUp,
      legend: qualityRatesLegend(colors, theme.isHighContrast),
      emptyMessage: chartEmptyMessage(hasRates, hasRatesRows, NO_RATES_IN_RANGE_MESSAGE, NO_RATES_MATCH_MESSAGE),
      renderChart: (size) => renderRates(size, false),
      renderExpanded: () => (
        <div className="qaqc-overview-expanded">
          <ChartFill>{(size) => renderRates(size, true)}</ChartFill>
          <OverviewWeekTable variant="rates" points={series.rates} />
        </div>
      ),
    },
  }

  const panels: Record<PanelId, ExpandablePanel> = {
    ...charts,
    drill: {
      title: `Issues · ${cards.selectedWeek.label}`,
      icon: CircleAlert,
      kind: 'page',
      legend: [],
      // Only a data refresh can leave the open week with no NCRs.
      emptyMessage: drillGroups.length > 0 ? null : 'No issues in this week',
      renderExpanded: () => <WeekIssuesPage weekLabel={cards.selectedWeek.label} groups={drillGroups} />,
    },
  }

  return (
    <ChartExpansionFrame
      panels={panels}
      handle={frame}
      interactive={interactive}
      animate={animate}
      isCompact={isCompact}
      isCardsOnly={isCardsOnly}
      onHover={onHover}
    >
      {(expandable) => (
        <>
          <LoadingBar active={loading} />
          <DashboardHeader
            title={title}
            icon={icon}
            interactive={interactive}
            range={range}
            onRangeChange={changeRange}
            isRangeDisabled={dateRange !== null}
            filterMenu={filters.menu}
            weekOptions={cards.weekOptions}
            selectedKey={cards.selectedWeek.key}
            onPickWeek={pickWeek}
          >
            <SegmentedToggle label="Card values" options={isInRange ? IN_RANGE_MODE_OPTIONS : CARD_MODE_OPTIONS} value={mode} disabled={!interactive} onChange={setMode} />
          </DashboardHeader>
          <FilterChips {...filters.chips} disabled={!interactive} />

          {hasNoMatch ? (
            <FilterEmptyState
              rowsName="inspections, welds or BIM issues"
              isInRange={isInRange}
              disabled={!interactive}
              onClear={() => {
                filters.clearAll()
                filters.chips.onFocusLost()
              }}
            />
          ) : (
            <div className="qaqc-overview-body">
              <section className={rowsClass} aria-label="Disciplines">
                <header className="qaqc-kpi-group-head qaqc-overview-rows-head">
                  <span>Disciplines</span>
                  <em>{cardsSubtitle}</em>
                </header>
                {DISCIPLINES.map((discipline) => (
                  <OverviewDisciplineRow
                    key={discipline.key}
                    name={discipline.name}
                    icon={discipline.icon}
                    metric={discipline.metric}
                    cardIcons={discipline.cardIcons}
                    row={cards.rows[discipline.key]}
                    isDense={isDense}
                    sparklineColor={colors.accent}
                    ringColor={colors.card}
                  />
                ))}
              </section>

              <div className="qaqc-overview-quality">
                {isDense ? (
                  <section className={`${groupClass} qaqc-overview-quality-dense${tightClass}`} aria-label="Quality">
                    <OverviewRowLabel name="Quality" icon={ShieldCheck} />
                    {cards.quality.map((card) => (
                      <OverviewDenseValue key={card.label} card={card} />
                    ))}
                  </section>
                ) : (
                  <KpiGroup title="Quality" subtitle={cardsSubtitle} variant={mode}>
                    {cards.quality.map((card, at) => (
                      <OverviewKpiCard key={card.label} card={card} icon={QUALITY_ICONS[at]} isTwoLine />
                    ))}
                  </KpiGroup>
                )}
              </div>

              {!isCardsOnly && (
                <div className="qaqc-charts qaqc-overview-charts">
                  {CHART_IDS.map((id) => {
                    const chart = charts[id]
                    return (
                      <ChartPanel
                        key={id}
                        className={chart.className}
                        title={chart.title}
                        icon={chart.icon}
                        legend={chart.legend}
                        emptyMessage={chart.emptyMessage}
                        {...expandable(id)}
                      >
                        {chart.renderChart}
                      </ChartPanel>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <Footnotes notes={notes} />
        </>
      )}
    </ChartExpansionFrame>
  )
}
