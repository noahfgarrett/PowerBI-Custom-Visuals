import { Building2, ChartColumnStacked, CircleAlert, CircleCheck, ClipboardCheck, Gauge, TrendingUp, Wrench, Zap } from 'lucide-react'
import { useMemo, useState, type ReactElement } from 'react'

import type { TooltipHandler } from '../../qaqc-shared/src/chartTypes'
import { ChartPanel, type LegendItem } from '../../qaqc-shared/src/components/ChartPanel'
import { Footnotes } from '../../qaqc-shared/src/components/Footnotes'
import { HorizontalBarChart } from '../../qaqc-shared/src/components/HorizontalBarChart'
import { KpiCard } from '../../qaqc-shared/src/components/KpiCard'
import { KpiGroup } from '../../qaqc-shared/src/components/KpiGroup'
import { LineChart } from '../../qaqc-shared/src/components/LineChart'
import { LoadingBar } from '../../qaqc-shared/src/components/LoadingBar'
import { RangeToggle } from '../../qaqc-shared/src/components/RangeToggle'
import { StackedBarChart } from '../../qaqc-shared/src/components/StackedBarChart'
import { WorkWeekPicker } from '../../qaqc-shared/src/components/WorkWeekPicker'
import {
  formatCount,
  formatDelta,
  formatPercent,
  formatPointsDelta,
  roundPoints,
  trendOf,
  type DeltaTone,
} from '../../qaqc-shared/src/format'
import { buildInspectionModel, RECENT_WEEK_COUNT } from '../../qaqc-shared/src/inspections'
import { chartColorsFromTheme, type ResolvedTheme } from '../../qaqc-shared/src/theme'
import type { InspectionIndex, RangeMode } from '../../qaqc-shared/src/types'
import { shortWeekLabel } from '../../qaqc-shared/src/workWeeks'

export const COMPACT_WIDTH = 900
export const CARDS_ONLY_HEIGHT = 420
const NO_ROWS_MESSAGE = 'No inspections match the current filters'
const EMPTY_RANGE_MESSAGE = 'No inspections in this range'

export interface ElectricalDashboardProps {
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

function pointsTone(delta: number | null): DeltaTone {
  if (delta === null) return 'neutral'
  const rounded = roundPoints(delta)
  if (rounded < 0) return 'bad'
  if (rounded > 0) return 'good'
  return 'neutral'
}

export function ElectricalDashboard({
  index,
  theme,
  interactive,
  animate,
  describeCharts,
  loading,
  footnotes,
  viewport,
  onHover,
}: ElectricalDashboardProps): ReactElement {
  const [selectedKey, setSelectedKey] = useState(index.currentWeek.key)
  const [windowEndKey, setWindowEndKey] = useState(index.currentWeek.key)
  const [range, setRange] = useState<RangeMode>('recent')

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
  const rootClass = ['qaqc-root', isCompact ? 'is-compact' : '', isCardsOnly ? 'is-cards-only' : ''].filter(Boolean).join(' ')
  const hasFinalsInWindow = model.passRateTrend.some((point) => point.rate !== null)

  const finalsSorsLegend: LegendItem[] = [
    { label: 'Finals', color: colors.series1, shape: 'bar' },
    { label: 'SORs', color: colors.series2, shape: 'bar' },
  ]
  const passRateDetail = toDate.passRateDeltaPoints === null
    ? `${formatCount(toDate.cleanFinals)} / ${formatCount(toDate.finals)} Finals`
    : `${formatCount(toDate.cleanFinals)} / ${formatCount(toDate.finals)} Finals · ${formatPointsDelta(toDate.passRateDeltaPoints)}`

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
    <div className={rootClass}>
      <LoadingBar active={loading} />
      <div className="qaqc-header">
        <div className="qaqc-title">
          <span className="qaqc-title-icon">
            <Zap size={16} aria-hidden="true" />
          </span>
          <h2>Electrical Inspections</h2>
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
          <ChartPanel
            className="qaqc-panel-main"
            title="Finals + SORs by Work Week"
            icon={ChartColumnStacked}
            legend={[...finalsSorsLegend, { label: 'Issue found', color: colors.bad, shape: 'dot' }]}
            emptyMessage={model.hasData ? null : NO_ROWS_MESSAGE}
          >
            {(size) => (
              <StackedBarChart
                weeks={model.window}
                selectedKey={model.selectedWeek.key}
                width={size.width}
                height={size.height}
                colors={colors}
                interactive={interactive}
                animate={animate}
                describe={describeCharts}
                onSelectWeek={setSelectedKey}
                onHover={onHover}
              />
            )}
          </ChartPanel>
          <ChartPanel
            title="NCR Pass Rate Trend"
            icon={TrendingUp}
            legend={[
              { label: 'Pass rate', color: colors.series1, shape: 'bar' },
              { label: 'Week with NCR', color: colors.bad, shape: 'dot' },
            ]}
            emptyMessage={hasFinalsInWindow ? null : 'No Final inspections in this range'}
          >
            {(size) => (
              <LineChart
                points={model.passRateTrend}
                selectedKey={model.selectedWeek.key}
                width={size.width}
                height={size.height}
                colors={colors}
                describe={describeCharts}
                onHover={onHover}
              />
            )}
          </ChartPanel>
          <ChartPanel
            title="Inspections by Building"
            icon={Building2}
            legend={finalsSorsLegend}
            emptyMessage={model.buildings.length > 0 ? null : model.hasData ? EMPTY_RANGE_MESSAGE : NO_ROWS_MESSAGE}
          >
            {(size) => (
              <HorizontalBarChart
                bars={model.buildings}
                other={model.otherBuildings}
                width={size.width}
                height={size.height}
                colors={colors}
                describe={describeCharts}
                onHover={onHover}
              />
            )}
          </ChartPanel>
        </div>
      )}

      <Footnotes notes={footnotes} />
    </div>
  )
}
