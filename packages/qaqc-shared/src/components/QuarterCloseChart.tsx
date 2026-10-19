import { useMemo, useState, type MouseEvent, type ReactElement } from 'react'

import { createLabelPlacer } from '../chartLabels'
import { labelIndices, LINE_DASH, niceScale, roundedTopBarPath } from '../chartMath'
import type { ChartColors, TooltipHandler, TooltipRow } from '../chartTypes'
import { formatCount } from '../format'
import type { QuarterPoint } from '../issueBenchmarks'
import type { LegendItem } from './ChartPanel'

// "Is closing getting faster or slower?" on the Issue Aging page: the median days to close of each calendar quarter's
// closures, against the typical close time as of the selected week.

const MARGIN = { top: 18, right: 8, bottom: 36, left: 48 } as const
const TICK_GAP = 7
const BAR_RATIO = 0.6
const MAX_BAR_WIDTH = 30
const CORNER_RADIUS = 4
const MEDIAN_GAP = 5
const QUARTER_LABEL_OFFSET = 14
const CLOSED_OFFSET = 27
/** Quarter names are thinned so each keeps about this much width. */
const MIN_QUARTER_LABEL_WIDTH = 34
const EMPTY_SLOT_HEIGHT = 34
const EMPTY_SLOT_MAX_WIDTH = 46
/** Narrower empty slots drop their "no closures" words and keep the dashed outline; wider ones let the words run a little past it. */
const EMPTY_TEXT_MIN_SLOT = 34
/** An axis tick this close to the typical line gives its place to the "typical" label. */
const TYPICAL_TICK_CLEARANCE = 11
const LABEL_PAD_X = 1.5

/** Whole days as `59 d`, half days as `22.5 d`. */
export function formatQuarterDays(value: number): string {
  return `${Number.isInteger(value) ? formatCount(value) : value.toFixed(1)} d`
}

export function quarterLegend(colors: ChartColors, typical: number | null): LegendItem[] {
  return [
    { label: 'At or under typical', color: colors.good, shape: 'bar' },
    { label: 'Slower than typical', color: colors.warn, shape: 'bar' },
    { label: typical === null ? 'Typical' : `Typical ${formatQuarterDays(typical)}`, color: colors.ink, shape: 'dashed' },
  ]
}

/** How the median compares with typical, in days either way. */
function versusTypical(median: number, typical: number | null): string {
  if (typical === null) return 'n/a'
  if (median === typical) return 'same as typical'
  return median < typical
    ? `${formatQuarterDays(typical - median)} faster than typical`
    : `${formatQuarterDays(median - typical)} slower than typical`
}

function tooltipRows(point: QuarterPoint, typical: number | null): TooltipRow[] {
  if (point.median === null) return [{ label: 'Closed', value: formatCount(point.closed) }]
  const versus = versusTypical(point.median, typical)
  return [
    { label: 'Closed', value: formatCount(point.closed) },
    { label: 'Median days to close', value: formatQuarterDays(point.median) },
    { label: 'Slowest', value: point.slowest === null ? 'n/a' : formatQuarterDays(point.slowest) },
    { label: 'vs typical', value: versus },
  ]
}

/** The chart for screen readers: typical, then each quarter's median and closed count. */
function quarterDescription(points: readonly QuarterPoint[], typical: number | null): string {
  const heading = typical === null ? 'Median days to close by calendar quarter' : `Median days to close by calendar quarter, typical ${formatQuarterDays(typical)}`
  const quarters = points.map((point) => (point.median === null
    ? `${point.label}: no closures`
    : `${point.label}: ${formatQuarterDays(point.median)}, ${formatCount(point.closed)} closed`))
  return quarters.length === 0 ? `${heading}.` : `${heading}. ${quarters.join('; ')}.`
}

interface QuarterLayout {
  plotLeft: number
  plotRight: number
  plotTop: number
  plotBottom: number
  slot: number
  barWidth: number
  ticks: number[]
  y: (value: number) => number
  /** Quarters whose name and closed count are drawn. */
  labelled: Set<number>
  /** Median label positions by quarter; a quarter whose label would collide has none. */
  medianLabels: Map<number, { x: number; y: number }>
}

function layoutQuarters(points: readonly QuarterPoint[], typical: number | null, width: number, height: number): QuarterLayout {
  const plotLeft = MARGIN.left
  const plotRight = Math.max(plotLeft, width - MARGIN.right)
  const plotTop = MARGIN.top
  const plotBottom = Math.max(plotTop, height - MARGIN.bottom)
  const slot = points.length > 0 ? (plotRight - plotLeft) / points.length : 0
  const barWidth = Math.min(MAX_BAR_WIDTH, slot * BAR_RATIO)
  const highest = points.reduce((max, point) => Math.max(max, point.median ?? 0), typical ?? 0)
  const scale = niceScale(highest, 3)
  const y = (value: number): number => plotBottom - (value / scale.max) * (plotBottom - plotTop)
  const labelled = labelIndices(points.length, plotRight - plotLeft, points.length - 1, MIN_QUARTER_LABEL_WIDTH)

  // The newest quarter is labelled first, then the older ones; a label that would collide is left out.
  const placer = createLabelPlacer({ bounds: { left: plotLeft, right: plotRight, top: 0, bottom: plotBottom }, padX: LABEL_PAD_X })
  const medianLabels = new Map<number, { x: number; y: number }>()
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const median = points[index].median
    if (median === null) continue
    const x = plotLeft + slot * (index + 0.5)
    const spot = placer.place(formatQuarterDays(median), [{ x, y: y(median) - MEDIAN_GAP }])
    if (spot !== null) medianLabels.set(index, spot)
  }

  const typicalY = typical === null ? null : y(typical)
  const ticks = scale.ticks.filter((tick) => typicalY === null || Math.abs(y(tick) - typicalY) >= TYPICAL_TICK_CLEARANCE)
  return { plotLeft, plotRight, plotTop, plotBottom, slot, barWidth, ticks, y, labelled, medianLabels }
}

export interface QuarterCloseChartProps {
  /** Oldest first, from `quarterMedians`. */
  points: QuarterPoint[]
  typical: number | null
  width: number
  height: number
  colors: ChartColors
  onHover: TooltipHandler
}

export function QuarterCloseChart({ points, typical, width, height, colors, onHover }: QuarterCloseChartProps): ReactElement {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const layout = useMemo(() => layoutQuarters(points, typical, width, height), [points, typical, width, height])
  const { plotLeft, plotRight, plotTop, plotBottom, slot, barWidth, y } = layout
  const description = useMemo(() => quarterDescription(points, typical), [points, typical])

  function showTooltip(index: number, event: MouseEvent<SVGRectElement>): void {
    setHoverIndex(index)
    const point = points[index]
    onHover({ title: point.label, rows: tooltipRows(point, typical), clientX: event.clientX, clientY: event.clientY })
  }

  const emptyWidth = Math.max(0, Math.min(slot - 6, EMPTY_SLOT_MAX_WIDTH))

  return (
    <svg className="qaqc-chart qaqc-aging-quarters" width={width} height={height} role="img" aria-label={description}>
      {layout.ticks.map((tick) => (
        <g key={tick}>
          <line className="qaqc-grid-line" x1={plotLeft} x2={plotRight} y1={y(tick)} y2={y(tick)} stroke={colors.grid} />
          <text className="qaqc-axis-text" x={plotLeft - TICK_GAP} y={y(tick) + 3.5} textAnchor="end" fill={colors.axisText}>
            {formatQuarterDays(tick)}
          </text>
        </g>
      ))}
      {hoverIndex !== null && (
        <rect
          x={plotLeft + hoverIndex * slot}
          y={plotTop - MARGIN.top}
          width={slot}
          height={plotBottom - plotTop + MARGIN.top}
          rx={5}
          fill={colors.accent}
          fillOpacity={0.06}
        />
      )}
      <text className="qaqc-axis-year qaqc-aging-closed" x={plotLeft - TICK_GAP} y={plotBottom + CLOSED_OFFSET} textAnchor="end" fill={colors.axisText}>
        closed
      </text>
      {points.map((point, index) => {
        const center = plotLeft + slot * (index + 0.5)
        const isLabelled = layout.labelled.has(index)
        const axisLabels = isLabelled && (
          <>
            <text className="qaqc-axis-text qaqc-aging-quarter" x={center} y={plotBottom + QUARTER_LABEL_OFFSET} textAnchor="middle" fill={point.median === null ? colors.axisText : colors.ink}>
              {point.label}
            </text>
            <text className="qaqc-axis-year qaqc-aging-closed" x={center} y={plotBottom + CLOSED_OFFSET} textAnchor="middle" fill={point.median === null ? colors.axisText : colors.ink}>
              {formatCount(point.closed)}
            </text>
          </>
        )
        if (point.median === null) {
          return (
            <g key={point.key}>
              <g className="qaqc-aging-empty-quarter">
                <rect
                  x={center - emptyWidth / 2}
                  y={plotBottom - EMPTY_SLOT_HEIGHT}
                  width={emptyWidth}
                  height={EMPTY_SLOT_HEIGHT}
                  rx={4}
                  fill="none"
                  stroke={colors.axisText}
                  strokeOpacity={0.45}
                  strokeDasharray="3 3"
                />
                {slot >= EMPTY_TEXT_MIN_SLOT && (
                  <>
                    <text className="qaqc-axis-year" x={center} y={plotBottom - 20} textAnchor="middle" fill={colors.axisText}>no</text>
                    <text className="qaqc-axis-year" x={center} y={plotBottom - 9} textAnchor="middle" fill={colors.axisText}>closures</text>
                  </>
                )}
              </g>
              {axisLabels}
            </g>
          )
        }
        const top = y(point.median)
        const isSlow = typical !== null && point.median > typical
        const fill = isSlow ? colors.warn : colors.good
        const label = layout.medianLabels.get(index)
        return (
          <g key={point.key}>
            <path className="qaqc-aging-quarter-bar" d={roundedTopBarPath(center - barWidth / 2, top, barWidth, plotBottom - top, CORNER_RADIUS)} fill={fill} />
            {label !== undefined && (
              <text className="qaqc-aging-label is-median" x={label.x} y={label.y} textAnchor="middle" fill={fill}>
                {formatQuarterDays(point.median)}
              </text>
            )}
            {axisLabels}
          </g>
        )
      })}
      {typical !== null && (
        <g pointerEvents="none">
          <line
            className="qaqc-aging-typical-line"
            x1={plotLeft}
            x2={plotRight}
            y1={y(typical)}
            y2={y(typical)}
            stroke={colors.ink}
            strokeOpacity={0.6}
            strokeWidth={1.25}
            strokeDasharray={LINE_DASH}
          />
          <text className="qaqc-axis-text qaqc-aging-typical-tick" x={plotLeft - TICK_GAP} y={y(typical) + 3.5} textAnchor="end" fill={colors.ink}>
            typical
          </text>
        </g>
      )}
      <line x1={plotLeft} x2={plotRight} y1={plotBottom} y2={plotBottom} stroke={colors.ink} strokeOpacity={0.3} />
      <g
        onMouseLeave={() => {
          setHoverIndex(null)
          onHover(null)
        }}
      >
        {points.map((point, index) => (
          <rect
            key={point.key}
            className="qaqc-hit"
            data-quarter={point.label}
            x={plotLeft + index * slot}
            y={plotTop - MARGIN.top}
            width={slot}
            height={plotBottom - plotTop + MARGIN.top + MARGIN.bottom}
            fill="transparent"
            onMouseMove={(event) => showTooltip(index, event)}
          />
        ))}
      </g>
    </svg>
  )
}
