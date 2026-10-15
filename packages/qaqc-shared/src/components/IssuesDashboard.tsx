import {
  ChartBarStacked,
  ChartColumnBig,
  CheckCheck,
  CircleCheck,
  CircleDot,
  CirclePlus,
  Gauge,
  Hourglass,
  Layers,
  TableProperties,
  type LucideIcon,
} from 'lucide-react'
import { useMemo, type ReactElement, type ReactNode } from 'react'

import type { TooltipHandler } from '../chartTypes'
import type { ElementSize } from '../hooks/useElementSize'
import { useWeekWindow } from '../hooks/useWeekWindow'
import { AgingSplitTable } from './AgingSplitTable'
import { AgingStripChart } from './AgingStripChart'
import { CARDS_ONLY_HEIGHT, ChartExpansionFrame, COMPACT_WIDTH, type ExpandablePanel } from './ChartExpansionFrame'
import { ChartFill } from './ChartFill'
import { ChartPanel } from './ChartPanel'
import { Footnotes } from './Footnotes'
import { HeaderOverlayButton } from './HeaderOverlayButton'
import { IssueDetail } from './IssueDetail'
import { issueTrendLegend, IssuesTrendChart } from './IssuesTrendChart'
import { KpiCard } from './KpiCard'
import { KpiGroup } from './KpiGroup'
import { LoadingBar } from './LoadingBar'
import { OpenAgingChart } from './OpenAgingChart'
import { OpenIssuesTable } from './OpenIssuesTable'
import { RangeToggle } from './RangeToggle'
import { IssueWindowSummary } from './WindowSummary'
import { WorkWeekPicker } from './WorkWeekPicker'
import { formatCount, formatDelta, formatPercent, formatPointsDelta, formatSignedCount, pointsTrend, trendOf } from '../format'
import { RECENT_WEEK_COUNT } from '../inspections'
import { buildIssueModel } from '../issues'
import { chartColorsFromTheme, type ResolvedTheme } from '../theme'
import type { ClosureRateCard, IssueIndex } from '../types'
import { shortWeekLabel } from '../workWeeks'

const NO_ROWS_MESSAGE = 'No issues match the current filters'
const NO_OPEN_MESSAGE = 'No open issues'

type ChartId = 'trend' | 'openAging' | 'overallAging'
type PanelId = ChartId | 'detail'

const CHART_IDS: readonly ChartId[] = ['trend', 'openAging', 'overallAging'] as const

interface ChartConfig extends ExpandablePanel {
  className?: string
  renderChart: (size: ElementSize) => ReactNode
}

export interface IssuesDashboardProps {
  title: string
  icon: LucideIcon
  index: IssueIndex
  theme: ResolvedTheme
  interactive: boolean
  animate: boolean
  describeCharts: boolean
  loading: boolean
  footnotes: string[]
  viewport: { width: number; height: number }
  onHover: TooltipHandler
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
  icon: Icon,
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

  const model = useMemo(() => buildIssueModel(index, view), [index, view])
  // Memoized so the charts' own memos see the same colors object until the theme changes.
  const colors = useMemo(() => chartColorsFromTheme(theme), [theme])
  const { thisWeek, toDate } = model
  const previousLabel = shortWeekLabel(model.previousWeek)
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

  const charts: Record<ChartId, ChartConfig> = {
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
      title: 'BIM Issues Detail',
      icon: TableProperties,
      kind: 'page',
      legend: [],
      emptyMessage: null,
      // Mounted only while the page is open, so the detail is built only then.
      renderExpanded: () => <IssueDetail index={index} selectedKey={model.selectedWeek.key} />,
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
          <div className="qaqc-header">
            <div className="qaqc-title">
              <span className="qaqc-title-icon">
                <Icon size={16} aria-hidden="true" />
              </span>
              <h2>{title}</h2>
            </div>
            <div className="qaqc-controls">
              <HeaderOverlayButton {...expandable('detail')} label="Issue Detail" ariaLabel="Open Issue Detail" icon={TableProperties} />
              <RangeToggle value={range} recentCount={RECENT_WEEK_COUNT} disabled={!interactive} onChange={changeRange} />
              <WorkWeekPicker options={model.weekOptions} valueKey={model.selectedWeek.key} disabled={!interactive} onChange={pickWeek} />
            </div>
          </div>

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
            <KpiGroup title="Project to date" subtitle={`Through ${model.selectedWeek.label}`} variant="total">
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
