import { Building2, ChartColumnStacked, CircleAlert, CircleCheck, ClipboardCheck, Gauge, TrendingUp, Wrench, type LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react'

import type { TooltipHandler } from '../chartTypes'
import { useElementSize, type ElementSize } from '../hooks/useElementSize'
import { BuildingTable } from './BuildingTable'
import { ChartPanel, type LegendItem } from './ChartPanel'
import { ExpandedPanel, type PanelBox } from './ExpandedPanel'
import { Footnotes } from './Footnotes'
import { HorizontalBarChart } from './HorizontalBarChart'
import { IssueWeekList } from './IssueWeekList'
import { KpiCard } from './KpiCard'
import { KpiGroup } from './KpiGroup'
import { LineChart } from './LineChart'
import { LoadingBar } from './LoadingBar'
import { RangeToggle } from './RangeToggle'
import { StackedBarChart } from './StackedBarChart'
import { WindowSummary } from './WindowSummary'
import { WorkWeekPicker } from './WorkWeekPicker'
import {
  formatCount,
  formatDelta,
  formatPercent,
  formatPointsDelta,
  roundPoints,
  trendOf,
  type DeltaTone,
} from '../format'
import { buildInspectionModel, RECENT_WEEK_COUNT } from '../inspections'
import { chartColorsFromTheme, type ResolvedTheme } from '../theme'
import type { InspectionIndex, RangeMode } from '../types'
import { shortWeekLabel } from '../workWeeks'

export const COMPACT_WIDTH = 900
export const CARDS_ONLY_HEIGHT = 420
const NO_ROWS_MESSAGE = 'No inspections match the current filters'
const EMPTY_RANGE_MESSAGE = 'No inspections in this range'
const ZERO_BOX: PanelBox = { top: 0, left: 0, width: 0, height: 0 }

type PanelId = 'trend' | 'passRate' | 'buildings'

const PANEL_IDS: readonly PanelId[] = ['trend', 'passRate', 'buildings'] as const

interface PanelConfig {
  title: string
  icon: LucideIcon
  legend: LegendItem[]
  emptyMessage: string | null
  className?: string
  renderChart: (size: ElementSize) => ReactNode
  renderExpanded: (size: ElementSize) => ReactNode
}

export interface InspectionDashboardProps {
  title: string
  icon: LucideIcon
  index: InspectionIndex
  theme: ResolvedTheme
  interactive: boolean
  animate: boolean
  describeCharts: boolean
  loading: boolean
  footnotes: string[]
  viewport: { width: number; height: number }
  onHover: TooltipHandler
}

/** The whole frame. The frame never scrolls, so no scroll offset is involved. */
function frameBox(frame: HTMLElement): PanelBox {
  return { top: 0, left: 0, width: frame.clientWidth, height: frame.clientHeight }
}

/** The grid panel's box relative to the frame (the root may be scrolled inside it). */
function originBox(frame: HTMLElement, panel: HTMLElement | null): PanelBox | null {
  if (!panel) return null
  const frameRect = frame.getBoundingClientRect()
  const rect = panel.getBoundingClientRect()
  return { top: rect.top - frameRect.top, left: rect.left - frameRect.left, width: rect.width, height: rect.height }
}

interface ChartFillProps {
  children: (size: ElementSize) => ReactNode
}

/** A flexible chart area inside an expanded panel; the chart gets this area's size, not the whole body's. */
function ChartFill({ children }: ChartFillProps): ReactElement {
  const [ref, size] = useElementSize<HTMLDivElement>()
  return (
    <div ref={ref} className="qaqc-chart-fill">
      {size.width > 0 && size.height > 0 ? children(size) : null}
    </div>
  )
}

function pointsTone(delta: number | null): DeltaTone {
  if (delta === null) return 'neutral'
  const rounded = roundPoints(delta)
  if (rounded < 0) return 'bad'
  if (rounded > 0) return 'good'
  return 'neutral'
}

export function InspectionDashboard({
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
}: InspectionDashboardProps): ReactElement {
  const [selectedKey, setSelectedKey] = useState(index.currentWeek.key)
  const [windowEndKey, setWindowEndKey] = useState(index.currentWeek.key)
  const [range, setRange] = useState<RangeMode>('recent')
  const [expanded, setExpanded] = useState<PanelId | null>(null)
  const frameRef = useRef<HTMLDivElement | null>(null)
  const panelRefs = useRef<Record<PanelId, HTMLElement | null>>({ trend: null, passRate: null, buildings: null })
  const restoreFocusRef = useRef<PanelId | null>(null)

  // Return focus once the overlay is gone and the dashboard is no longer inert: to the expand button, or to the
  // panel when the button is gone (the panel became empty or interactions were turned off), or to the frame.
  useEffect(() => {
    const id = restoreFocusRef.current
    if (expanded !== null || id === null) return
    restoreFocusRef.current = null
    const panel = panelRefs.current[id]
    const target = panel?.querySelector<HTMLButtonElement>('.qaqc-expand-button') ?? panel ?? frameRef.current
    target?.focus({ preventScroll: true })
  }, [expanded])

  // Keep the user's week across data refreshes when it still exists; otherwise use the current week.
  const isSelectionInData = index.positionByKey.has(selectedKey)
  const effectiveSelected = isSelectionInData ? selectedKey : index.currentWeek.key
  const effectiveEnd = isSelectionInData && index.positionByKey.has(windowEndKey) ? windowEndKey : index.currentWeek.key
  const model = useMemo(
    () => buildInspectionModel(index, { selectedKey: effectiveSelected, windowEndKey: effectiveEnd, range }),
    [index, effectiveSelected, effectiveEnd, range],
  )
  const colors = chartColorsFromTheme(theme)
  const { thisWeek, toDate } = model
  const previousLabel = shortWeekLabel(model.previousWeek)
  const isCompact = viewport.width < COMPACT_WIDTH
  const isCardsOnly = viewport.height < CARDS_ONLY_HEIGHT
  // Cards-only tiles have no charts; the expanded panel comes back if the tile grows again.
  const isOverlayShown = expanded !== null && !isCardsOnly
  const rootClass = [
    'qaqc-root',
    isCompact ? 'is-compact' : '',
    isCardsOnly ? 'is-cards-only' : '',
    isOverlayShown ? 'is-expanded' : '',
  ].filter(Boolean).join(' ')
  const hasFinalsInWindow = model.passRateTrend.some((point) => point.rate !== null)

  // The expanded charts unmount without a mouseleave, so clear any Power BI tooltip when the overlay goes away.
  useEffect(() => {
    if (!isOverlayShown) return undefined
    return () => onHover(null)
  }, [isOverlayShown, onHover])

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
        onSelectWeek={setSelectedKey}
        onHover={onHover}
      />
    )
  }

  function renderPassRate(size: ElementSize, labelIssueWeeks: boolean): ReactElement {
    return (
      <LineChart
        points={model.passRateTrend}
        selectedKey={model.selectedWeek.key}
        width={size.width}
        height={size.height}
        colors={colors}
        describe={describeCharts}
        labelIssueWeeks={labelIssueWeeks}
        onHover={onHover}
      />
    )
  }

  const panels: Record<PanelId, PanelConfig> = {
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

  function closeExpanded(id: PanelId): void {
    restoreFocusRef.current = id
    setExpanded(null)
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
    <div ref={frameRef} className="qaqc-frame" tabIndex={-1}>
      <div className={rootClass} inert={isOverlayShown}>
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
          <KpiGroup title="Project to date" subtitle={`Through ${model.selectedWeek.label}`} variant="total">
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
              trend={toDate.passRateDeltaPoints === null ? 'none' : trendOf(roundPoints(toDate.passRateDeltaPoints))}
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
                  sectionRef={(element) => {
                    panelRefs.current[id] = element
                  }}
                  onExpand={interactive ? () => setExpanded(id) : undefined}
                >
                  {panel.renderChart}
                </ChartPanel>
              )
            })}
          </div>
        )}

        <Footnotes notes={footnotes} />
      </div>

      {isOverlayShown && (
        <ExpandedPanel
          key={expanded}
          title={panels[expanded].title}
          icon={panels[expanded].icon}
          legend={panels[expanded].legend}
          emptyMessage={panels[expanded].emptyMessage}
          animate={animate}
          getRootBox={() => (frameRef.current ? frameBox(frameRef.current) : ZERO_BOX)}
          getOriginBox={() => (frameRef.current ? originBox(frameRef.current, panelRefs.current[expanded]) : null)}
          onClosed={() => closeExpanded(expanded)}
        >
          {panels[expanded].renderExpanded}
        </ExpandedPanel>
      )}
    </div>
  )
}
