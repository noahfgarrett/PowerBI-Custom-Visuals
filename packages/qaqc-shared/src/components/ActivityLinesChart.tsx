import { useCallback, useMemo, type ReactElement } from 'react'

import { niceScale } from '../chartMath'
import type { ChartColors, TooltipHandler, TooltipRow } from '../chartTypes'
import { formatCount, pluralize } from '../format'
import type { WorkWeek } from '../types'
import type { LegendItem } from './ChartPanel'
import { OverviewLinesChart, type WeekLine, type YScale } from './OverviewLinesChart'

const TITLE = 'Inspection activity by work week'
const AXIS_TITLE = 'Finals + SORs'

export interface DisciplineActivity {
  finals: number
  sors: number
}

export interface ActivityWeek {
  week: WorkWeek
  electrical: DisciplineActivity
  mechanical: DisciplineActivity
}

export interface ActivityLinesChartProps {
  points: ReadonlyArray<ActivityWeek>
  selectedKey: number
  width: number
  height: number
  colors: ChartColors
  /** Dashes the Mechanical line, since high contrast draws both lines in the foreground colour. */
  isHighContrast: boolean
  interactive: boolean
  animate: boolean
  describe: boolean
  /** Labels every point that fits, not only the last and the selected week. */
  showValues?: boolean
  onSelectWeek: (key: number) => void
  onHover: TooltipHandler
}

function totalOf(activity: DisciplineActivity): number {
  return activity.finals + activity.sors
}

function describeDiscipline(name: string, activity: DisciplineActivity): string {
  const finals = `${formatCount(activity.finals)} ${pluralize(activity.finals, 'Final', 'Finals')}`
  const sors = `${formatCount(activity.sors)} ${pluralize(activity.sors, 'SOR', 'SORs')}`
  return `${name} ${formatCount(totalOf(activity))} (${finals}, ${sors})`
}

function disciplineRows(name: string, activity: DisciplineActivity): TooltipRow[] {
  return [
    { label: `${name} Finals`, value: formatCount(activity.finals) },
    { label: `${name} SORs`, value: formatCount(activity.sors) },
    { label: `${name} total`, value: formatCount(totalOf(activity)) },
  ]
}

export function activityLegend(colors: ChartColors, isHighContrast: boolean): LegendItem[] {
  return [
    { label: 'Electrical', color: colors.series1, shape: 'line' },
    { label: 'Mechanical', color: colors.series3, shape: isHighContrast ? 'dashed' : 'line' },
  ]
}

/** Electrical and Mechanical Finals + SORs per week, as two smooth lines on one count axis. */
export function ActivityLinesChart({
  points,
  selectedKey,
  width,
  height,
  colors,
  isHighContrast,
  interactive,
  animate,
  describe,
  showValues = false,
  onSelectWeek,
  onHover,
}: ActivityLinesChartProps): ReactElement {
  const weeks = useMemo(() => points.map((point) => point.week), [points])
  const lines = useMemo((): WeekLine[] => [
    { key: 'electrical', color: colors.series1, isDashed: false, values: points.map((point) => totalOf(point.electrical)) },
    { key: 'mechanical', color: colors.series3, isDashed: isHighContrast, values: points.map((point) => totalOf(point.mechanical)) },
  ], [points, colors, isHighContrast])
  const scale = useMemo((): YScale => {
    let max = 0
    for (const point of points) max = Math.max(max, totalOf(point.electrical), totalOf(point.mechanical))
    return { min: 0, ...niceScale(max) }
  }, [points])
  const tooltipRows = useCallback(
    (index: number): TooltipRow[] => [...disciplineRows('Electrical', points[index].electrical), ...disciplineRows('Mechanical', points[index].mechanical)],
    [points],
  )
  const describeWeek = useCallback((index: number): string => {
    const point = points[index]
    return `${point.week.label}: ${describeDiscipline('Electrical', point.electrical)}, ${describeDiscipline('Mechanical', point.mechanical)}`
  }, [points])

  return (
    <OverviewLinesChart
      title={TITLE}
      axisTitle={AXIS_TITLE}
      weeks={weeks}
      lines={lines}
      scale={scale}
      formatTick={formatCount}
      formatValue={formatCount}
      tooltipRows={tooltipRows}
      describeWeek={describeWeek}
      selectedKey={selectedKey}
      width={width}
      height={height}
      colors={colors}
      interactive={interactive}
      animate={animate}
      describe={describe}
      showValues={showValues}
      onSelectWeek={onSelectWeek}
      onHover={onHover}
    />
  )
}
