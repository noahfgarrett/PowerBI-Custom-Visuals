import { Building2, ChartColumnStacked, CircleAlert, CircleCheck, ClipboardCheck, Gauge, TrendingUp, Wrench } from 'lucide-react'
import { useMemo, type ReactElement } from 'react'

import type { ElementSize } from '../hooks/useElementSize'
import { useWeekWindow } from '../hooks/useWeekWindow'
import { BuildingTable } from './BuildingTable'
import { CARDS_ONLY_HEIGHT, ChartExpansionFrame, COMPACT_WIDTH, type GridPanel } from './ChartExpansionFrame'
import { ChartFill } from './ChartFill'
import { ChartPanel, type LegendItem } from './ChartPanel'
import { DashboardHeader, type DashboardChromeProps } from './DashboardHeader'
import { Footnotes } from './Footnotes'
import { HorizontalBarChart } from './HorizontalBarChart'
import { IssueWeekList } from './IssueWeekList'
import { KpiCard } from './KpiCard'
import { KpiGroup } from './KpiGroup'
import { LineChart } from './LineChart'
import { LoadingBar } from './LoadingBar'
import { StackedBarChart } from './StackedBarChart'
import { WindowSummary } from './WindowSummary'
import {
  formatCount,
  formatDelta,
  formatPercent,
  formatPointsDelta,
  pointsTone,
  pointsTrend,
  trendOf,
} from '../format'
import { buildInspectionModel } from '../inspections'
import { chartColorsFromTheme } from '../theme'
import type { InspectionIndex } from '../types'

const NO_ROWS_MESSAGE = 'No inspections match the current filters'
const EMPTY_RANGE_MESSAGE = 'No inspections in this range'

type PanelId = 'trend' | 'passRate' | 'buildings'

const PANEL_IDS: readonly PanelId[] = ['trend', 'passRate', 'buildings'] as const

export interface InspectionDashboardProps extends DashboardChromeProps {
  index: InspectionIndex
}

export function InspectionDashboard({
  title,
  icon,
  index,
  theme,
  interactive,
  animate,
  describeCharts,
  loading,
  footnotes,
  viewport,
  onHover,
}: InspectionDashboardProps): ReactElement {
  const { view, range, selectWeek, pickWeek, changeRange } = useWeekWindow(index)

  const model = useMemo(() => buildInspectionModel(index, view), [index, view])
  // Memoized so the charts' own memos see the same colors object until the theme changes.
  const colors = useMemo(() => chartColorsFromTheme(theme), [theme])
  const { thisWeek, toDate } = model
  const previousLabel = model.previousWeek.label
  const isCompact = viewport.width < COMPACT_WIDTH
  const isCardsOnly = viewport.height < CARDS_ONLY_HEIGHT
  const hasFinalsInWindow = model.passRateTrend.some((point) => point.rate !== null)

  const finalsSorsLegend: LegendItem[] = [
    { label: 'Finals', color: colors.series1, shape: 'bar' },
    { label: 'SORs', color: colors.series2, shape: 'bar' },
  ]
  const passRateDetail = toDate.passRateDeltaPoints === null
    ? `${formatCount(toDate.cleanFinals)} / ${formatCount(toDate.finals)} Finals`
    : `${formatCount(toDate.cleanFinals)} / ${formatCount(toDate.finals)} Finals · ${formatPointsDelta(toDate.passRateDeltaPoints)}`

  function renderTrend(size: ElementSize, showValues: boolean): ReactElement {
    return (
      <StackedBarChart
        weeks={model.window}
        selectedKey={model.selectedWeek.key}
        width={size.width}
        height={size.height}
        colors={colors}
        interactive={interactive}
        animate={animate}
        describe={describeCharts}
        showValues={showValues}
        onSelectWeek={selectWeek}
        onHover={onHover}
      />
    )
  }

  function renderPassRate(size: ElementSize, isExpandedView: boolean): ReactElement {
    return (
      <LineChart
        points={model.passRateTrend}
        selectedKey={model.selectedWeek.key}
        width={size.width}
        height={size.height}
        colors={colors}
        describe={describeCharts}
        labelIssueWeeks={isExpandedView}
        showWeekAxis={isExpandedView}
        onHover={onHover}
      />
    )
  }

  const panels: Record<PanelId, GridPanel> = {
    trend: {
      title: 'Finals + SORs by Work Week',
      icon: ChartColumnStacked,
      legend: [...finalsSorsLegend, { label: 'Issue found', color: colors.bad, shape: 'dot' }],
      emptyMessage: model.hasData ? null : NO_ROWS_MESSAGE,
      className: 'qaqc-panel-main',
      renderChart: (size) => renderTrend(size, false),
      renderExpanded: () => (
        <div className="qaqc-expanded-stack">
          <WindowSummary totals={model.windowTotals} />
          <ChartFill>{(size) => renderTrend(size, true)}</ChartFill>
        </div>
      ),
    },
    passRate: {
      title: 'NCR Pass Rate Trend',
      icon: TrendingUp,
      legend: [
        { label: 'Pass rate', color: colors.series1, shape: 'bar' },
        { label: 'Week with NCR', color: colors.bad, shape: 'dot' },
      ],
      emptyMessage: hasFinalsInWindow ? null : 'No Final inspections in this range',
      renderChart: (size) => renderPassRate(size, false),
      renderExpanded: () => (
        <div className="qaqc-expanded-split">
          <ChartFill>{(size) => renderPassRate(size, true)}</ChartFill>
          <IssueWeekList points={model.passRateTrend} />
        </div>
      ),
    },
    buildings: {
      title: 'Inspections by Building',
      icon: Building2,
      legend: finalsSorsLegend,
      // The expanded table has no Finals/SORs colours to explain.
      expandedLegend: [],
      emptyMessage: model.buildings.length > 0 ? null : model.hasData ? EMPTY_RANGE_MESSAGE : NO_ROWS_MESSAGE,
      renderChart: (size) => (
        <HorizontalBarChart
          bars={model.buildings}
          other={model.otherBuildings}
          width={size.width}
          height={size.height}
          colors={colors}
          describe={describeCharts}
          onHover={onHover}
        />
      ),
      renderExpanded: () => <BuildingTable rows={model.allBuildings} />,
    },
  }

  return (
    <ChartExpansionFrame
      panels={panels}
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
            weekOptions={model.weekOptions}
            selectedKey={model.selectedWeek.key}
            onPickWeek={pickWeek}
          />

          <div className="qaqc-kpi-row">
            <KpiGroup title={model.selectedWeek.label} variant="week">
              <KpiCard
                label="Final Inspections"
                icon={ClipboardCheck}
                value={formatCount(thisWeek.finals.value)}
                detail={formatDelta(thisWeek.finals.delta, previousLabel)}
                tone="neutral"
                trend={trendOf(thisWeek.finals.delta)}
              />
              <KpiCard
                label="SORs"
                icon={Wrench}
                value={formatCount(thisWeek.sors.value)}
                detail={formatDelta(thisWeek.sors.delta, previousLabel)}
                tone="neutral"
                trend={trendOf(thisWeek.sors.delta)}
              />
              <KpiCard
                label="Issues Found"
                icon={CircleAlert}
                value={formatCount(thisWeek.issuesFound.value)}
                detail={formatDelta(thisWeek.issuesFound.delta, previousLabel)}
                tone={thisWeek.issuesFound.delta > 0 ? 'warn' : 'neutral'}
                trend={trendOf(thisWeek.issuesFound.delta)}
              />
            </KpiGroup>
            <KpiGroup title="Project to date" subtitle={`Through ${model.selectedWeek.label}`} variant="toDate">
              <KpiCard
                label="Finals to Date"
                icon={CircleCheck}
                value={formatCount(toDate.finals)}
                detail={`+${formatCount(toDate.finalsThisWeek)} this WW`}
                tone="neutral"
                trend="none"
              />
              <KpiCard
                label="SORs to Date"
                icon={Wrench}
                value={formatCount(toDate.sors)}
                detail={`+${formatCount(toDate.sorsThisWeek)} this WW`}
                tone="neutral"
                trend="none"
              />
              <KpiCard
                label="NCR Pass Rate"
                icon={Gauge}
                value={formatPercent(toDate.passRate)}
                detail={passRateDetail}
                tone={pointsTone(toDate.passRateDeltaPoints)}
                trend={pointsTrend(toDate.passRateDeltaPoints)}
              />
            </KpiGroup>
          </div>

          {!isCardsOnly && (
            <div className="qaqc-charts">
              {PANEL_IDS.map((id) => {
                const panel = panels[id]
                return (
                  <ChartPanel
                    key={id}
                    className={panel.className}
                    title={panel.title}
                    icon={panel.icon}
                    legend={panel.legend}
                    emptyMessage={panel.emptyMessage}
                    {...expandable(id)}
                  >
                    {panel.renderChart}
                  </ChartPanel>
                )
              })}
            </div>
          )}

          <Footnotes notes={footnotes} />
        </>
      )}
    </ChartExpansionFrame>
  )
}
