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

import type { ElementSize } from '../hooks/useElementSize'
import { useWeekWindow } from '../hooks/useWeekWindow'
import { BuildingIssueTable } from './BuildingIssueTable'
import { CARDS_ONLY_HEIGHT, ChartExpansionFrame, COMPACT_WIDTH, type GridPanel } from './ChartExpansionFrame'
import { ChartFill } from './ChartFill'
import { ChartPanel, type LegendItem } from './ChartPanel'
import { DashboardHeader, type DashboardChromeProps } from './DashboardHeader'
import { Footnotes } from './Footnotes'
import { IssueRateChart } from './IssueRateChart'
import { KpiCard } from './KpiCard'
import { KpiGroup } from './KpiGroup'
import { LoadingBar } from './LoadingBar'
import { SignoffBarChart } from './SignoffBarChart'
import { SystemDrillChart } from './SystemDrillChart'
import { SystemTable } from './SystemTable'
import { WeldWindowSummary } from './WindowSummary'
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
import { chartColorsFromTheme } from '../theme'
import type { WeldIndex } from '../types'
import { buildWeldModel } from '../welds'

const NO_ROWS_MESSAGE = 'No welds match the current filters'
const EMPTY_RANGE_MESSAGE = 'No welds in this range'

type PanelId = 'signoff' | 'systems' | 'buildings'

const PANEL_IDS: readonly PanelId[] = ['signoff', 'systems', 'buildings'] as const

export interface WeldingDashboardProps extends DashboardChromeProps {
  index: WeldIndex
  /** Buildings with fewer welds in the window roll into Other on the issue-rate chart. */
  minWelds: number
}

export function WeldingDashboard({
  title,
  icon,
  index,
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
  const { view, range, selectWeek, pickWeek, changeRange } = useWeekWindow(index)
  const [drillSystem, setDrillSystem] = useState<string | null>(null)
  const systemsSectionRef = useRef<HTMLElement | null>(null)

  const model = useMemo(
    () => buildWeldModel(index, view, drillSystem, minWelds),
    [index, view, drillSystem, minWelds],
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

  const signoffDetail = signoff === null
    ? 'No welds logged yet'
    : `${formatCount(signoff.signed)} of ${formatCount(signoff.total)} · ${signoff.week.label}`
  const overallDetail = toDate.overallRateDeltaPoints === null
    ? 'n/a'
    : `${formatPointsDelta(toDate.overallRateDeltaPoints)} vs ${previousLabel}`

  const signedTotalLegend: LegendItem[] = [
    { label: 'Signed', color: colors.series1, shape: 'bar' },
    { label: 'Total welds', color: colors.series2, shape: 'bar' },
  ]

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
        onSelectWeek={selectWeek}
        onHover={onHover}
      />
    )
  }

  const panels: Record<PanelId, GridPanel> = {
    signoff: {
      title: 'Signoffs by Work Week',
      icon: ChartColumnBig,
      legend: [
        ...signedTotalLegend,
        { label: 'Sign-off %', color: colors.warn, shape: 'line' },
        { label: 'Issue created', color: colors.bad, shape: 'dot' },
        { label: '10% baseline', color: colors.bad, shape: 'dashed' },
      ],
      emptyMessage: model.hasData ? null : NO_ROWS_MESSAGE,
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
            <KpiGroup title="Project to date" subtitle={`Through ${model.selectedWeek.label}`} variant="total">
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
              {PANEL_IDS.map((id) => {
                const panel = panels[id]
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

          <Footnotes notes={footnotes} />
        </>
      )}
    </ChartExpansionFrame>
  )
}
