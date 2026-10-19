import {
  ChartBarStacked,
  ChartColumnBig,
  ChartColumnDecreasing,
  CheckCheck,
  CircleCheck,
  CircleDot,
  CirclePlus,
  Gauge,
  Hourglass,
  Layers,
  TableProperties,
} from 'lucide-react'
import { useCallback, useMemo, useRef, type ReactElement } from 'react'

import type { ElementSize } from '../hooks/useElementSize'
import { useWeekWindow } from '../hooks/useWeekWindow'
import { AgingSplitTable } from './AgingSplitTable'
import { AgingStripChart } from './AgingStripChart'
import { CARDS_ONLY_HEIGHT, ChartExpansionFrame, COMPACT_WIDTH, type ExpandablePanel, type GridPanel } from './ChartExpansionFrame'
import { ChartFill } from './ChartFill'
import { ChartPanel } from './ChartPanel'
import { DashboardHeader, type DashboardChromeProps } from './DashboardHeader'
import { Footnotes } from './Footnotes'
import { HeaderOverlayButton } from './HeaderOverlayButton'
import { IssueAgingPage, issueAgingTitle } from './IssueAgingPage'
import { IssueDetail } from './IssueDetail'
import { issueTrendLegend, IssuesTrendChart } from './IssuesTrendChart'
import { KpiCard } from './KpiCard'
import { KpiGroup } from './KpiGroup'
import { LoadingBar } from './LoadingBar'
import { OpenAgingChart } from './OpenAgingChart'
import { OpenIssuesTable } from './OpenIssuesTable'
import { paretoTitle, RootCauseParetoPage } from './RootCauseParetoPage'
import { IssueWindowSummary } from './WindowSummary'
import { formatCount, formatDelta, formatPercent, formatPointsDelta, formatSignedCount, pointsTrend, trendOf } from '../format'
import { buildIssueModel } from '../issues'
import { chartColorsFromTheme } from '../theme'
import type { ClosureRateCard, IssueIndex } from '../types'

const NO_ROWS_MESSAGE = 'No issues match the current filters'
const NO_OPEN_MESSAGE = 'No open issues'

type ChartId = 'trend' | 'openAging' | 'overallAging'
type PanelId = ChartId | 'detail' | 'pareto' | 'aging'

const CHART_IDS: readonly ChartId[] = ['trend', 'openAging', 'overallAging'] as const

export interface IssuesDashboardProps extends DashboardChromeProps {
  index: IssueIndex
}

/** A project-to-date count's change in the selected week, in the other dashboards' "+N this WW" style. */
function thisWeekChange(delta: number): string {
  return `${delta === 0 ? '+0' : formatSignedCount(delta)} this WW`
}

function closureRateDetail(card: ClosureRateCard, previousLabel: string): string {
  if (card.value === null) return 'No issues opened yet'
  if (card.deltaPoints === null) return 'First issues opened this WW'
  return `${formatPointsDelta(card.deltaPoints)} vs ${previousLabel}`
}

export function IssuesDashboard({
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
}: IssuesDashboardProps): ReactElement {
  const { view, range, selectWeek, pickWeek, changeRange } = useWeekWindow(index)
  // The Issue Aging page's Esc handler: it closes the page's issue list before Esc closes the page.
  const agingEscapeRef = useRef<(() => boolean) | null>(null)
  const registerAgingEscape = useCallback((handler: (() => boolean) | null): void => {
    agingEscapeRef.current = handler
  }, [])

  const model = useMemo(() => buildIssueModel(index, view), [index, view])
  // Memoized so the charts' own memos see the same colors object until the theme changes.
  const colors = useMemo(() => chartColorsFromTheme(theme), [theme])
  const { thisWeek, toDate } = model
  const previousLabel = model.previousWeek.label
  const isCompact = viewport.width < COMPACT_WIDTH
  const isCardsOnly = viewport.height < CARDS_ONLY_HEIGHT
  const openCount = model.openAging.reduce((sum, bucket) => sum + bucket.count, 0)
  const closureRate = toDate.closureRate

  function renderTrend(size: ElementSize, showValues: boolean): ReactElement {
    return (
      <IssuesTrendChart
        points={model.trend}
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

  function renderOverallAging(): ReactElement {
    return <AgingStripChart buckets={model.overallAging} colors={colors} isHighContrast={theme.isHighContrast} />
  }

  const charts: Record<ChartId, GridPanel> = {
    trend: {
      title: 'Issues by Work Week',
      icon: ChartColumnBig,
      legend: issueTrendLegend(colors),
      emptyMessage: model.hasData ? null : NO_ROWS_MESSAGE,
      className: 'qaqc-panel-main',
      renderChart: (size) => renderTrend(size, false),
      renderExpanded: () => (
        <div className="qaqc-expanded-stack">
          <IssueWindowSummary totals={model.windowTotals} />
          <ChartFill>{(size) => renderTrend(size, true)}</ChartFill>
        </div>
      ),
    },
    openAging: {
      title: 'Open Issue Aging',
      icon: Hourglass,
      legend: [{ label: 'Open issues by weeks open', color: colors.series1, shape: 'bar' }],
      // The expanded table has no bar colours to explain.
      expandedLegend: [],
      emptyMessage: !model.hasData ? NO_ROWS_MESSAGE : openCount > 0 ? null : NO_OPEN_MESSAGE,
      renderChart: (size) => (
        <OpenAgingChart
          buckets={model.openAging}
          width={size.width}
          height={size.height}
          colors={colors}
          isHighContrast={theme.isHighContrast}
          describe={describeCharts}
          onHover={onHover}
        />
      ),
      renderExpanded: () => <OpenIssuesTable rows={model.openIssues} />,
    },
    overallAging: {
      title: 'Overall Issue Aging',
      icon: ChartBarStacked,
      // Each bucket row carries its own swatch and label.
      legend: [],
      emptyMessage: model.hasData ? null : NO_ROWS_MESSAGE,
      renderChart: renderOverallAging,
      renderExpanded: () => (
        <div className="qaqc-aging-expanded">
          {renderOverallAging()}
          <AgingSplitTable buckets={model.overallAging} />
        </div>
      ),
    },
  }

  const panels: Record<PanelId, ExpandablePanel> = {
    ...charts,
    detail: {
      title: 'QCx BIM Issues Detail',
      icon: TableProperties,
      kind: 'page',
      legend: [],
      emptyMessage: null,
      // Mounted only while the page is open, so the detail is built only then.
      renderExpanded: () => <IssueDetail index={index} selectedKey={model.selectedWeek.key} />,
    },
    pareto: {
      title: paretoTitle(index, view),
      icon: ChartColumnDecreasing,
      kind: 'page',
      legend: [],
      emptyMessage: null,
      // Mounted only while the page is open, so the Pareto is built only then. It shares the dashboard's week
      // window, so its own range toggle and week picker move the dashboard too.
      renderExpanded: () => (
        <RootCauseParetoPage
          index={index}
          view={view}
          weekOptions={model.weekOptions}
          colors={colors}
          isHighContrast={theme.isHighContrast}
          onPickWeek={pickWeek}
          onRangeChange={changeRange}
          onHover={onHover}
        />
      ),
    },
    aging: {
      title: issueAgingTitle(model.selectedWeek),
      icon: Hourglass,
      kind: 'page',
      legend: [],
      emptyMessage: null,
      onEscape: () => agingEscapeRef.current?.() ?? false,
      // Mounted only while the page is open, so the benchmarks are built only then. It shares the dashboard's week
      // window, so its own range toggle and week picker move the dashboard too.
      renderExpanded: () => (
        <IssueAgingPage
          index={index}
          view={view}
          weekOptions={model.weekOptions}
          colors={colors}
          animate={animate}
          footnotes={footnotes}
          onSelectWeek={selectWeek}
          onPickWeek={pickWeek}
          onRangeChange={changeRange}
          onHover={onHover}
          registerEscape={registerAgingEscape}
        />
      ),
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
          >
            <HeaderOverlayButton {...expandable('detail')} label="Issue Detail" ariaLabel="Open Issue Detail" icon={TableProperties} />
            {index.hasRootCause && (
              <HeaderOverlayButton
                {...expandable('pareto')}
                label="Issues by Root Cause Pareto"
                ariaLabel="Open the Issues by Root Cause Pareto page"
                icon={ChartColumnDecreasing}
              />
            )}
            <HeaderOverlayButton {...expandable('aging')} label="Issue Aging" ariaLabel="Open the Issue Aging page" icon={Hourglass} />
          </DashboardHeader>

          <div className="qaqc-kpi-row">
            <KpiGroup title="This WW" subtitle={model.selectedWeek.label} variant="week">
              <KpiCard
                label="Issues Opened"
                icon={CirclePlus}
                value={formatCount(thisWeek.opened.value)}
                detail={formatDelta(thisWeek.opened.delta, previousLabel)}
                tone={thisWeek.opened.tone}
                trend={trendOf(thisWeek.opened.delta)}
              />
              <KpiCard
                label="Issues Closed"
                icon={CircleCheck}
                value={formatCount(thisWeek.closed.value)}
                detail={formatDelta(thisWeek.closed.delta, previousLabel)}
                tone={thisWeek.closed.tone}
                trend={trendOf(thisWeek.closed.delta)}
              />
            </KpiGroup>
            <KpiGroup title="Project to date" subtitle={`Through ${model.selectedWeek.label}`} variant="toDate">
              <KpiCard
                label="Total Opened"
                icon={Layers}
                value={formatCount(toDate.opened.value)}
                detail={thisWeekChange(toDate.opened.delta)}
                tone={toDate.opened.tone}
                trend="none"
              />
              <KpiCard
                label="Total Closed"
                icon={CheckCheck}
                value={formatCount(toDate.closed.value)}
                detail={thisWeekChange(toDate.closed.delta)}
                tone={toDate.closed.tone}
                trend="none"
              />
              <KpiCard
                label="Remaining Open"
                icon={CircleDot}
                value={formatCount(toDate.remaining.value)}
                detail={thisWeekChange(toDate.remaining.delta)}
                tone={toDate.remaining.tone}
                trend="none"
              />
              <KpiCard
                label="Closure Rate"
                icon={Gauge}
                value={formatPercent(closureRate.value)}
                detail={closureRateDetail(closureRate, previousLabel)}
                tone={closureRate.tone}
                trend={pointsTrend(closureRate.deltaPoints)}
              />
            </KpiGroup>
          </div>

          {!isCardsOnly && (
            <div className="qaqc-charts">
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

          <Footnotes notes={footnotes} />
        </>
      )}
    </ChartExpansionFrame>
  )
}
