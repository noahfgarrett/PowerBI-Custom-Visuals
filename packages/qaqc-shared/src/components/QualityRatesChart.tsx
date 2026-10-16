import { useCallback, useMemo, type ReactElement } from 'react'

import { passRateDomain } from '../chartMath'
import type { ChartColors, TooltipHandler, TooltipRow } from '../chartTypes'
import { formatCount, formatPercent, pluralize } from '../format'
import type { WorkWeek } from '../types'
import type { LegendItem } from './ChartPanel'
import { OverviewLinesChart, type WeekLine, type YScale } from './OverviewLinesChart'

const TITLE = 'Quality rates by work week'
const EMPTY_MESSAGE = 'No finals or welds in this range'

export interface InspectionRate {
  /** Percent 0–100, as LineChart takes it; null when the week has no finals. */
  rate: number | null
  ncrs: number
  finals: number
}

export interface WeldingRate {
  /** Percent 0–100; null when the week has no welds. */
  rate: number | null
  ncrs: number
  welds: number
}

export interface QualityRateWeek {
  week: WorkWeek
  inspection: InspectionRate
  welding: WeldingRate
}

export interface QualityRatesChartProps {
  points: ReadonlyArray<QualityRateWeek>
  selectedKey: number
  width: number
  height: number
  colors: ChartColors
  /** Dashes the welding line, since high contrast draws both lines in the foreground colour. */
  isHighContrast: boolean
  interactive: boolean
  animate: boolean
  describe: boolean
  /** Labels every point that fits, not only the last and the selected week. */
  showValues?: boolean
  onSelectWeek: (key: number) => void
  onHover: TooltipHandler
}

/** "2 NCRs of 14 finals", or "No finals" ("no finals" mid-sentence) when the week has none. */
function ncrsOf(ncrs: number, total: number, unit: 'final' | 'weld', isMidSentence = false): string {
  if (total === 0) return `${isMidSentence ? 'no' : 'No'} ${unit}s`
  return `${formatCount(ncrs)} ${pluralize(ncrs, 'NCR', 'NCRs')} of ${formatCount(total)} ${pluralize(total, unit, `${unit}s`)}`
}

function formatTick(value: number): string {
  return formatPercent(value, Number.isInteger(value) ? 0 : 1)
}

/** Point labels write a perfect week as 100%, so runs of them stay short; every other rate keeps one decimal. */
function formatRate(value: number): string {
  return value === 100 ? '100%' : formatPercent(value)
}

export function qualityRatesLegend(colors: ChartColors, isHighContrast: boolean): LegendItem[] {
  return [
    { label: 'Inspection NCR pass rate', color: colors.series1, shape: 'line' },
    { label: 'Welding NCR pass rate', color: colors.series3, shape: isHighContrast ? 'dashed' : 'line' },
  ]
}

/** The inspection and welding NCR pass rates per week, zoomed to the data; each line breaks where its week has no finals or welds. */
export function QualityRatesChart({
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
}: QualityRatesChartProps): ReactElement {
  const weeks = useMemo(() => points.map((point) => point.week), [points])
  const lines = useMemo((): WeekLine[] => [
    { key: 'inspection', color: colors.series1, isDashed: false, values: points.map((point) => point.inspection.rate) },
    { key: 'welding', color: colors.series3, isDashed: isHighContrast, values: points.map((point) => point.welding.rate) },
  ], [points, colors, isHighContrast])
  const hasRates = lines.some((line) => line.values.some((value) => value !== null))
  const scale = useMemo((): YScale => {
    const domain = passRateDomain(lines.flatMap((line) => line.values))
    return { ...domain, ticks: [domain.min, (domain.min + domain.max) / 2, domain.max] }
  }, [lines])
  const tooltipRows = useCallback((index: number): TooltipRow[] => {
    const { inspection, welding } = points[index]
    return [
      { label: 'Inspection NCR pass rate', value: formatPercent(inspection.rate) },
      { label: 'Inspection NCRs', value: ncrsOf(inspection.ncrs, inspection.finals, 'final') },
      { label: 'Welding NCR pass rate', value: formatPercent(welding.rate) },
      { label: 'Welding NCRs', value: ncrsOf(welding.ncrs, welding.welds, 'weld') },
    ]
  }, [points])
  const describeWeek = useCallback((index: number): string => {
    const { week, inspection, welding } = points[index]
    const inspectionText = `inspection NCR pass rate ${formatPercent(inspection.rate)} (${ncrsOf(inspection.ncrs, inspection.finals, 'final', true)})`
    const weldingText = `welding NCR pass rate ${formatPercent(welding.rate)} (${ncrsOf(welding.ncrs, welding.welds, 'weld', true)})`
    return `${week.label}: ${inspectionText}, ${weldingText}`
  }, [points])

  if (!hasRates) return <p className="qaqc-chart-empty" style={{ width, height }}>{EMPTY_MESSAGE}</p>

  return (
    <OverviewLinesChart
      title={TITLE}
      axisTitle={null}
      weeks={weeks}
      lines={lines}
      scale={scale}
      formatTick={formatTick}
      formatValue={formatRate}
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
