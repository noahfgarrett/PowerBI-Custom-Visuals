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
  type LucideIcon,
} from 'lucide-react'
import { useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react'

import type { TooltipHandler } from '../chartTypes'
import type { ElementSize } from '../hooks/useElementSize'
import { BuildingIssueTable } from './BuildingIssueTable'
import { CARDS_ONLY_HEIGHT, ChartExpansionFrame, COMPACT_WIDTH, type ExpandablePanel } from './ChartExpansionFrame'
import { ChartFill } from './ChartFill'
import { ChartPanel, type LegendItem } from './ChartPanel'
import { Footnotes } from './Footnotes'
import { IssueRateChart } from './IssueRateChart'
import { KpiCard } from './KpiCard'
import { KpiGroup } from './KpiGroup'
import { LoadingBar } from './LoadingBar'
import { RangeToggle } from './RangeToggle'
import { SignoffBarChart } from './SignoffBarChart'
import { SystemDrillChart } from './SystemDrillChart'
import { SystemTable } from './SystemTable'
import { WeldWindowSummary } from './WindowSummary'
import { WorkWeekPicker } from './WorkWeekPicker'
import {
  formatCount,
  formatDelta,
  formatPercent,
  formatPointsDelta,
  roundPoints,
  signoffStatus,
  trendOf,
  type DeltaTone,
} from '../format'
import { RECENT_WEEK_COUNT } from '../inspections'
import { chartColorsFromTheme, type ResolvedTheme } from '../theme'
import type { RangeMode, WeldIndex } from '../types'
import { buildWeldModel } from '../welds'
import { shortWeekLabel } from '../workWeeks'

const NO_ROWS_MESSAGE = 'No welds match the current filters'
const EMPTY_RANGE_MESSAGE = 'No welds in this range'
/** A week's sign-off below this percent misses the 10% baseline. */
const SIGNOFF_BASELINE_PERCENT = 10

type PanelId = 'signoff' | 'systems' | 'buildings'

const PANEL_IDS: readonly PanelId[] = ['signoff', 'systems', 'buildings'] as const

interface PanelConfig extends ExpandablePanel {
  className?: string
  renderChart: (size: ElementSize) => ReactNode
}

export interface WeldingDashboardProps {
  title: string
  icon: LucideIcon
  index: WeldIndex
  /** Buildings with fewer welds in the window roll into Other on the issue-rate chart. */
  minWelds: number
  theme: ResolvedTheme
  interactive: boolean
  animate: boolean
  describeCharts: boolean
  loading: boolean
  footnotes: string[]
  viewport: { width: number; height: number }
  onHover: TooltipHandler
}

function pointsTone(delta: number | null): DeltaTone {
  if (delta === null) return 'neutral'
  const rounded = roundPoints(delta)
  if (rounded < 0) return 'bad'
  if (rounded > 0) return 'good'
  return 'neutral'
}

export function WeldingDashboard({
  title,
  icon: Icon,
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
  const [selectedKey, setSelectedKey] = useState(index.currentWeek.key)
  const [windowEndKey, setWindowEndKey] = useState(index.currentWeek.key)
  const [range, setRange] = useState<RangeMode>('recent')
  const [drillSystem, setDrillSystem] = useState<string | null>(null)
  const systemsSectionRef = useRef<HTMLElement | null>(null)

  // Keep the user's week across data refreshes when it still exists; otherwise use the current week.
  const isSelectionInData = index.positionByKey.has(selectedKey)
  const effectiveSelected = isSelectionInData ? selectedKey : index.currentWeek.key
  const effectiveEnd = isSelectionInData && index.positionByKey.has(windowEndKey) ? windowEndKey : index.currentWeek.key
  const model = useMemo(
    () => buildWeldModel(index, { selectedKey: effectiveSelected, windowEndKey: effectiveEnd, range }, drillSystem, minWelds),
    [index, effectiveSelected, effectiveEnd, range, drillSystem, minWelds],
  )

  // The drilled system left the window: return to all systems for good, so it does not re-drill if it comes back.
  if (drillSystem !== null && model.drill === null) setDrillSystem(null)

  const colors = chartColorsFromTheme(theme)
  const { thisWeek, toDate } = model
  const signoff = thisWeek.signoff
  const previousLabel = shortWeekLabel(model.previousWeek)
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
        onSelectWeek={setSelectedKey}
        onHover={onHover}
      />
    )
  }

  const panels: Record<PanelId, PanelConfig> = {
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
        { label: 'Overall rate', color: colors.ink, shape: 'line' },
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

  function changeRange(mode: RangeMode): void {
    setRange(mode)
    if (mode !== 'recent') return
    // Returning to the recent range must not leave the selected week outside the visible window.
    const selectedPosition = index.positionByKey.get(effectiveSelected)
    const endPosition = index.positionByKey.get(effectiveEnd)
    if (selectedPosition === undefined || endPosition === undefined) return
    if (selectedPosition > endPosition || selectedPosition <= endPosition - RECENT_WEEK_COUNT) {
      setWindowEndKey(effectiveSelected)
    }
  }

  function pickWeek(key: number): void {
    setSelectedKey(key)
    setWindowEndKey(key)
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
              <RangeToggle value={range} recentCount={RECENT_WEEK_COUNT} disabled={!interactive} onChange={changeRange} />
              <WorkWeekPicker options={model.weekOptions} valueKey={model.selectedWeek.key} disabled={!interactive} onChange={pickWeek} />
            </div>
          </div>

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
                value={formatPercent(signoff?.rate ?? null, 0)}
                detail={signoffDetail}
                tone="neutral"
                trend="none"
                isValueBad={signoff !== null && signoff.rate < SIGNOFF_BASELINE_PERCENT}
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
                trend={toDate.overallRateDeltaPoints === null ? 'none' : trendOf(roundPoints(toDate.overallRateDeltaPoints))}
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
