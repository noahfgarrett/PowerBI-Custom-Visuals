import {
  Building2,
  ChartColumnBig,
  CircleAlert,
  CircleCheck,
  Gauge,
  Layers,
  ListTree,
  Percent,
  Signature,
} from 'lucide-react'
import { useMemo, useRef, useState, type ReactElement } from 'react'

import { useDashboardFilters } from '../hooks/useDashboardFilters'
import type { ElementSize } from '../hooks/useElementSize'
import { useWeekWindow } from '../hooks/useWeekWindow'
import { BuildingIssueTable } from './BuildingIssueTable'
import { CARDS_ONLY_HEIGHT, ChartExpansionFrame, COMPACT_WIDTH, type ChartExpansionHandle, type ExpandablePanel, type GridPanel } from './ChartExpansionFrame'
import { ChartFill } from './ChartFill'
import { ChartPanel, type LegendItem } from './ChartPanel'
import { DashboardHeader, type DashboardChromeProps } from './DashboardHeader'
import { FilterChips } from './FilterChips'
import { FilterEmptyState } from './FilterEmptyState'
import { Footnotes } from './Footnotes'
import { IssueRateChart } from './IssueRateChart'
import { KpiCard } from './KpiCard'
import { KpiGroup } from './KpiGroup'
import { LoadingBar } from './LoadingBar'
import { SignoffBarChart } from './SignoffBarChart'
import { SystemDrillChart } from './SystemDrillChart'
import { SystemTable } from './SystemTable'
import { WeekIssuesPage } from './WeekIssuesPage'
import { WeldWindowSummary } from './WindowSummary'
import { weekIssueRows, weldDrillColumns, type DrillGroup } from '../drilldown'
import {
  formatCount,
  formatDelta,
  formatPercent,
  formatPointsDelta,
  formatSignoffRate,
  pointsTone,
  pointsTrend,
  SIGNOFF_BAD_BELOW,
  signoffStatus,
  trendOf,
} from '../format'
import { restateFootnotes } from '../footnotes'
import { RECENT_WEEK_COUNT } from '../inspections'
import { chartColorsFromTheme } from '../theme'
import type { WeldIndex } from '../types'
import { buildWeldIndex, buildWeldModel, weldFilterFields, weldRowWeekKey, type WeldFilterSource } from '../welds'

const NO_ROWS_MESSAGE = 'No welds match the current filters'
const EMPTY_RANGE_MESSAGE = 'No welds in this range'
const OUTSIDE_WINDOW_MESSAGE = `Nothing in this window. These rows fall outside the last ${RECENT_WEEK_COUNT} WW: switch to All to see them.`

type ChartId = 'signoff' | 'systems' | 'buildings'
type PanelId = ChartId | 'drill'

const CHART_IDS: readonly ChartId[] = ['signoff', 'systems', 'buildings'] as const

export interface WeldingDashboardProps extends DashboardChromeProps {
  /** Built over all of `filterSource.rows`, once per data update. */
  index: WeldIndex
  filterSource: WeldFilterSource
  /** Buildings with fewer welds in the window roll into Other on the issue-rate chart. */
  minWelds: number
}

export function WeldingDashboard({
  title,
  icon,
  index: baseIndex,
  filterSource,
  minWelds,
  theme,
  interactive,
  animate,
  describeCharts,
  loading,
  footnotes,
  viewport,
  onHover,
}: WeldingDashboardProps): ReactElement {
  const { rows, columns, optional, today } = filterSource
  const fields = useMemo(() => weldFilterFields(columns, optional), [columns, optional])
  const rowWeekKey = useMemo(() => weldRowWeekKey(columns), [columns])
  const dataWeeks = useMemo(() => baseIndex.weeks.map((item) => item.week), [baseIndex])
  const filters = useDashboardFilters({ rows, fields, weeks: dataWeeks, currentKey: baseIndex.currentWeek.key, rowWeekKey })
  const { filteredRows, isFieldFilterActive, dateRange } = filters
  const index = useMemo(
    () => (
      isFieldFilterActive
        ? buildWeldIndex(filteredRows, columns, today, { axisFromKey: baseIndex.weeks[0].week.key })
        : baseIndex
    ),
    [isFieldFilterActive, filteredRows, columns, today, baseIndex],
  )
  // The drill list's positions index the rows that built `index`.
  const indexRows = isFieldFilterActive ? filteredRows : rows
  const { view, range, selectWeek, pickWeek, changeRange } = useWeekWindow(index, dateRange)
  const [drillSystem, setDrillSystem] = useState<string | null>(null)
  const systemsSectionRef = useRef<HTMLElement | null>(null)
  const frame = useRef<ChartExpansionHandle<PanelId> | null>(null)

  const model = useMemo(
    () => buildWeldModel(index, view, drillSystem, minWelds),
    [index, view, drillSystem, minWelds],
  )

  const selectedKey = model.selectedWeek.key
  const drillColumns = useMemo(() => weldDrillColumns(columns, optional), [columns, optional])
  const drillGroups = useMemo(
    (): DrillGroup[] => [{ title: null, columns: drillColumns, rows: weekIssueRows(index, indexRows, selectedKey) }],
    [drillColumns, index, indexRows, selectedKey],
  )

  // The drilled system left the window: return to all systems for good, so it does not re-drill if it comes back.
  if (drillSystem !== null && model.drill === null) setDrillSystem(null)

  // Memoized so the charts' own memos see the same colors object until the theme changes.
  const colors = useMemo(() => chartColorsFromTheme(theme), [theme])
  const { thisWeek, toDate } = model
  const signoff = thisWeek.signoff
  const previousLabel = model.previousWeek.label
  const isCompact = viewport.width < COMPACT_WIDTH
  const isCardsOnly = viewport.height < CARDS_ONLY_HEIGHT
  const rangeMessage = model.hasData ? EMPTY_RANGE_MESSAGE : NO_ROWS_MESSAGE
  const isInRange = model.rangeLabel !== null
  const hasNoMatch = filters.isAnyActive && !model.hasData
  const areRowsOutsideWindow = isFieldFilterActive && range === 'recent' && model.windowTotals.welds === 0
  const notes = isFieldFilterActive ? restateFootnotes(footnotes, baseIndex, index) : footnotes

  const signoffDetail = signoff === null
    ? 'No welds logged yet'
    : `${formatCount(signoff.signed)} of ${formatCount(signoff.total)} · ${signoff.week.label}`
  const overallDetail = isInRange
    ? (toDate.total === 0 ? 'No welds in range' : `${formatCount(toDate.signed)} of ${formatCount(toDate.total)}`)
    : toDate.overallRateDeltaPoints === null
      ? 'n/a'
      : `${formatPointsDelta(toDate.overallRateDeltaPoints)} vs ${previousLabel}`

  const signedTotalLegend: LegendItem[] = [
    { label: 'Signed', color: colors.series1, shape: 'bar' },
    { label: 'Total welds', color: colors.series2, shape: 'bar' },
  ]

  /** A week click or Enter on the chart: selects the week, and opens its list when it has issues. */
  function selectChartWeek(key: number): void {
    selectWeek(key)
    const position = index.positionByKey.get(key)
    if (position !== undefined && index.weeks[position].issues > 0) frame.current?.openPageFromChart('drill', 'signoff')
  }

  function renderSignoffs(size: ElementSize, showValues: boolean): ReactElement {
    return (
      <SignoffBarChart
        weeks={model.window}
        selectedKey={model.selectedWeek.key}
        width={size.width}
        height={size.height}
        colors={colors}
        interactive={interactive}
        animate={animate}
        describe={describeCharts}
        showValues={showValues}
        onSelectWeek={selectChartWeek}
        onHover={onHover}
      />
    )
  }

  const charts: Record<ChartId, GridPanel> = {
    signoff: {
      title: 'Signoffs by Work Week',
      icon: ChartColumnBig,
      legend: [
        ...signedTotalLegend,
        { label: 'Sign-off %', color: colors.warn, shape: 'line' },
        { label: 'Issue created', color: colors.bad, shape: 'dot' },
        { label: '10% baseline', color: colors.bad, shape: 'dashed' },
      ],
      emptyMessage: !model.hasData ? NO_ROWS_MESSAGE : areRowsOutsideWindow ? OUTSIDE_WINDOW_MESSAGE : null,
      className: 'qaqc-panel-main',
      renderChart: (size) => renderSignoffs(size, false),
      renderExpanded: () => (
        <div className="qaqc-expanded-stack">
          <WeldWindowSummary totals={model.windowTotals} />
          <ChartFill>{(size) => renderSignoffs(size, true)}</ChartFill>
        </div>
      ),
    },
    systems: {
      title: 'Sign-off by System',
      icon: ListTree,
      legend: signedTotalLegend,
      // The expanded table has no bar colours to explain.
      expandedLegend: [],
      emptyMessage: model.allSystems.length > 0 ? null : rangeMessage,
      renderChart: (size) => (
        <SystemDrillChart
          systems={model.systems}
          other={model.otherSystems}
          drill={model.drill}
          width={size.width}
          height={size.height}
          colors={colors}
          interactive={interactive}
          describe={describeCharts}
          onDrill={setDrillSystem}
          onFocusLost={() => systemsSectionRef.current?.focus({ preventScroll: true })}
          onHover={onHover}
        />
      ),
      renderExpanded: () => <SystemTable rows={model.allSystems} />,
    },
    buildings: {
      title: 'Issues by Building',
      icon: Building2,
      legend: [
        { label: 'Issue rate', color: colors.series1, shape: 'bar' },
        { label: '2× overall or more', color: colors.warn, shape: 'bar' },
        { label: 'Overall rate', color: colors.ink, shape: 'hairline' },
      ],
      expandedLegend: [],
      emptyMessage: model.allBuildings.length > 0 ? null : rangeMessage,
      renderChart: (size) => (
        <IssueRateChart
          bars={model.buildings}
          other={model.otherBuildings}
          overallRate={model.overallIssueRate}
          width={size.width}
          height={size.height}
          colors={colors}
          describe={describeCharts}
          onHover={onHover}
        />
      ),
      renderExpanded: () => <BuildingIssueTable rows={model.allBuildings} />,
    },
  }

  const panels: Record<PanelId, ExpandablePanel> = {
    ...charts,
    drill: {
      title: `Issues · ${model.selectedWeek.label}`,
      icon: CircleAlert,
      kind: 'page',
      legend: [],
      // Only a data refresh can leave the open week with no issues.
      emptyMessage: drillGroups[0].rows.length > 0 ? null : 'No issues in this week',
      renderExpanded: () => <WeekIssuesPage weekLabel={model.selectedWeek.label} groups={drillGroups} />,
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
            weekOptions={model.weekOptions}
            selectedKey={model.selectedWeek.key}
            onPickWeek={pickWeek}
          />

          <FilterChips {...filters.chips} disabled={!interactive} />

          {hasNoMatch ? (
            <FilterEmptyState
              rowsName="welds"
              isInRange={isInRange}
              disabled={!interactive}
              onClear={() => {
                filters.clearAll()
                filters.chips.onFocusLost()
              }}
            />
          ) : (
            <>
              <div className="qaqc-kpi-row">
                <KpiGroup title={model.selectedWeek.label} variant="week">
                  <KpiCard
                    label="Welds Logged"
                    icon={Layers}
                    value={formatCount(thisWeek.logged.value)}
                    detail={formatDelta(thisWeek.logged.delta, previousLabel)}
                    tone="neutral"
                    trend={trendOf(thisWeek.logged.delta)}
                  />
                  <KpiCard
                    label="Signed This Week"
                    icon={Signature}
                    value={formatCount(thisWeek.signedInWeek.value)}
                    detail={formatDelta(thisWeek.signedInWeek.delta, previousLabel)}
                    tone="neutral"
                    trend={trendOf(thisWeek.signedInWeek.delta)}
                  />
                  <KpiCard
                    label="Sign-off %"
                    icon={Percent}
                    value={formatSignoffRate(signoff?.rate ?? null)}
                    detail={signoffDetail}
                    tone="neutral"
                    trend="none"
                    isValueBad={signoff !== null && signoff.rate < SIGNOFF_BAD_BELOW}
                  />
                  <KpiCard
                    label="Issues Created"
                    icon={CircleAlert}
                    value={formatCount(thisWeek.issues.value)}
                    detail={formatDelta(thisWeek.issues.delta, previousLabel)}
                    tone={thisWeek.issues.delta > 0 ? 'warn' : 'neutral'}
                    trend={trendOf(thisWeek.issues.delta)}
                  />
                </KpiGroup>
                <KpiGroup
                  title={isInRange ? 'In range' : 'Project to date'}
                  subtitle={model.rangeLabel ?? `Through ${model.selectedWeek.label}`}
                  variant="toDate"
                >
                  <KpiCard
                    label="Total Welds"
                    icon={Layers}
                    value={formatCount(toDate.total)}
                    detail={`+${formatCount(toDate.totalThisWeek)} this WW`}
                    tone="neutral"
                    trend="none"
                  />
                  <KpiCard
                    label="Welds Signed"
                    icon={CircleCheck}
                    value={formatCount(toDate.signed)}
                    detail={`+${formatCount(thisWeek.signedInWeek.value)} signed this WW`}
                    tone="neutral"
                    trend="none"
                  />
                  <KpiCard
                    label="Overall Sign-off %"
                    icon={Gauge}
                    value={formatPercent(toDate.overallRate)}
                    detail={overallDetail}
                    tone={pointsTone(toDate.overallRateDeltaPoints)}
                    trend={pointsTrend(toDate.overallRateDeltaPoints)}
                    status={signoffStatus(toDate.overallRate)}
                  />
                </KpiGroup>
              </div>

              {!isCardsOnly && (
                <div className="qaqc-charts">
                  {CHART_IDS.map((id) => {
                    const panel = charts[id]
                    const { sectionRef, onExpand } = expandable(id)
                    return (
                      <ChartPanel
                        key={id}
                        className={panel.className}
                        title={panel.title}
                        icon={panel.icon}
                        legend={panel.legend}
                        emptyMessage={panel.emptyMessage}
                        onExpand={onExpand}
                        sectionRef={(element) => {
                          sectionRef(element)
                          if (id === 'systems') systemsSectionRef.current = element
                        }}
                      >
                        {panel.renderChart}
                      </ChartPanel>
                    )
                  })}
                </div>
              )}
            </>
          )}

          <Footnotes notes={notes} />
        </>
      )}
    </ChartExpansionFrame>
  )
}
