import { useCallback, useMemo, type ReactElement } from 'react'

import { niceScale } from '../chartMath'
import type { ChartColors, TooltipHandler, TooltipRow } from '../chartTypes'
import { formatCount, pluralize } from '../format'
import type { ActivityPoint } from '../overview'
import type { LegendItem } from './ChartPanel'
import { OverviewLinesChart, type WeekLine, type YScale } from './OverviewLinesChart'

const TITLE = 'Inspection activity by work week'
const AXIS_TITLE = 'Finals + SORs'
const EMPTY_MESSAGE = 'No Electrical or Mechanical inspections in this range'

export interface ActivityLinesChartProps {
  points: ReadonlyArray<ActivityPoint>
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

function describeDiscipline(name: string, finals: number, sors: number): string {
  const finalsText = `${formatCount(finals)} ${pluralize(finals, 'Final', 'Finals')}`
  const sorsText = `${formatCount(sors)} ${pluralize(sors, 'SOR', 'SORs')}`
  return `${name} ${formatCount(finals + sors)} (${finalsText}, ${sorsText})`
}

function disciplineRows(name: string, finals: number, sors: number): TooltipRow[] {
  return [
    { label: `${name} Finals`, value: formatCount(finals) },
    { label: `${name} SORs`, value: formatCount(sors) },
    { label: `${name} total`, value: formatCount(finals + sors) },
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
    { key: 'electrical', color: colors.series1, isDashed: false, values: points.map((point) => point.electricalFinals + point.electricalSors) },
    { key: 'mechanical', color: colors.series3, isDashed: isHighContrast, values: points.map((point) => point.mechanicalFinals + point.mechanicalSors) },
  ], [points, colors, isHighContrast])
  const { scale, hasInspections } = useMemo((): { scale: YScale; hasInspections: boolean } => {
    let max = 0
    for (const point of points) max = Math.max(max, point.electricalFinals + point.electricalSors, point.mechanicalFinals + point.mechanicalSors)
    return { scale: { min: 0, ...niceScale(max) }, hasInspections: max > 0 }
  }, [points])
  const tooltipRows = useCallback(
    (index: number): TooltipRow[] => {
      const point = points[index]
      return [...disciplineRows('Electrical', point.electricalFinals, point.electricalSors), ...disciplineRows('Mechanical', point.mechanicalFinals, point.mechanicalSors)]
    },
    [points],
  )
  const describeWeek = useCallback((index: number): string => {
    const point = points[index]
    const electrical = describeDiscipline('Electrical', point.electricalFinals, point.electricalSors)
    const mechanical = describeDiscipline('Mechanical', point.mechanicalFinals, point.mechanicalSors)
    return `${point.week.label}: ${electrical}, ${mechanical}`
  }, [points])

  if (!hasInspections) return <p className="qaqc-chart-empty" style={{ width, height }}>{EMPTY_MESSAGE}</p>

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
