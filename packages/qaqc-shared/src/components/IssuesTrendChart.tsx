import { useEffect, useId, useMemo, useState, type MouseEvent, type ReactElement } from 'react'

import { createLabelPlacer, LABEL_GAP, labelTextWidth } from '../chartLabels'
import {
  alignedScale,
  labelIndices,
  niceScale,
  round,
  roundedTopBarPath,
  smoothPath,
  WEEK_AXIS_HEIGHT,
  yearMarkers,
  type NiceScale,
  type PlotPoint,
} from '../chartMath'
import type { ChartColors, TooltipHandler } from '../chartTypes'
import { formatCount } from '../format'
import { useWeekFocus } from '../hooks/useWeekFocus'
import type { IssueTrendPoint } from '../types'
import type { LegendItem } from './ChartPanel'
import { WeekAxisTick } from './WeekAxisTick'

// Matches the HTML app's RangeChart: Opened and Closed bars on the left axis, Remaining Open as a smooth line with
// an area fill on its own right axis.
const MARGIN = { top: 26, right: 48, bottom: WEEK_AXIS_HEIGHT, left: 44 } as const
/** The Opened + Closed pair fills this share of its week's band. */
const PAIR_RATIO = 0.7
const PAIR_GAP_RATIO = 0.08
const MAX_PAIR_GAP = 3
/** Bands narrower than this put the two bars edge to edge. */
const MIN_PAIR_GAP_BAND = 10
const MAX_BAR_WIDTH = 16
const MIN_BAR_WIDTH = 1
const CORNER_RADIUS = 2.5
const AXIS_TITLE_INSET = 10
const DOT_RADIUS = 3
const HOVERED_DOT_RADIUS = 4.5
/** Bands narrower than this draw dots only on labelled points. */
const MIN_DOT_BAND = 12
/** Bands narrower than this get no bar labels. */
const MIN_BAR_LABEL_BAND = 18
/** A bar at least this tall, and at least as wide as its label, carries the label inside its foot. */
const MIN_INSIDE_LABEL_HEIGHT = 14
const INSIDE_LABEL_INSET = 4
const OUTSIDE_LABEL_GAP = 4
/** The app labels every third point of the line (and the last). */
const LINE_LABEL_EVERY = 3
/** Line labels are thinned so neighbours sit at least this far apart. */
const MIN_LINE_LABEL_SPACING = 28
const LINE_LABEL_ABOVE = 7
const LINE_LABEL_BELOW = 14
const TITLE = 'Issues opened and closed by work week'

export interface IssuesTrendChartProps {
  points: IssueTrendPoint[]
  selectedKey: number
  width: number
  height: number
  colors: ChartColors
  interactive: boolean
  animate: boolean
  describe: boolean
  /** Labels every line point that fits, not only every third and the last. */
  showValues?: boolean
  onSelectWeek: (key: number) => void
  onHover: TooltipHandler
}

type Series = 'opened' | 'closed' | 'remaining'

interface BarMark {
  key: string
  series: 'opened' | 'closed'
  path: string
}

interface TrendLabel {
  key: string
  /** The week this label belongs to. */
  index: number
  series: Series
  text: string
  x: number
  y: number
  isInside: boolean
}

export interface Layout {
  plotRight: number
  plotWidth: number
  plotHeight: number
  plotBottom: number
  band: number
  countScale: NiceScale
  remainingScale: NiceScale
  bars: BarMark[]
  linePoints: PlotPoint[]
  linePath: string
  areaPath: string
  /** In week order. */
  labels: TrendLabel[]
  /** Weeks whose dot is drawn. */
  dotIndices: number[]
}

export function issueTrendLegend(colors: ChartColors): LegendItem[] {
  return [
    { label: 'Remaining Open', color: colors.warn, shape: 'line' },
    { label: 'Opened', color: colors.bad, shape: 'bar' },
    { label: 'Closed', color: colors.good, shape: 'bar' },
  ]
}

function areaPath(points: PlotPoint[], baseline: number): string {
  if (points.length === 0) return ''
  const first = points[0]
  const last = points[points.length - 1]
  return `${smoothPath(points)} L${round(last.x)},${round(baseline)} L${round(first.x)},${round(baseline)} Z`
}

/**
 * Every third point and the last, thinned further on narrow bands so labels sit at least 28 px apart. With
 * showValues, every point that fits.
 */
function lineLabelIndices(count: number, band: number, showValues: boolean): number[] {
  if (count === 0) return []
  const spacing = band > 0 ? Math.max(1, Math.ceil(MIN_LINE_LABEL_SPACING / band)) : count
  const every = showValues ? spacing : Math.max(LINE_LABEL_EVERY, spacing)
  const indices: number[] = []
  for (let index = 0; index < count; index += every) indices.push(index)
  const last = count - 1
  const lastRegular = indices[indices.length - 1]
  if (lastRegular === last) return indices
  // The last point is always labelled; it replaces a regular label that would sit closer than the minimum spacing.
  if (indices.length > 1 && (last - lastRegular) * band < MIN_LINE_LABEL_SPACING) indices.pop()
  indices.push(last)
  return indices
}

/** All of the chart's geometry and label placement; pure, so it can be benchmarked and memoised. */
export function layoutChart(points: IssueTrendPoint[], width: number, height: number, showValues: boolean): Layout {
  const plotRight = width - MARGIN.right
  const plotWidth = Math.max(0, plotRight - MARGIN.left)
  const plotHeight = Math.max(0, height - MARGIN.top - MARGIN.bottom)
  const plotBottom = MARGIN.top + plotHeight
  const band = points.length > 0 ? plotWidth / points.length : plotWidth
  const pairGap = band >= MIN_PAIR_GAP_BAND ? Math.min(MAX_PAIR_GAP, band * PAIR_GAP_RATIO) : 0
  const barWidth = Math.min(MAX_BAR_WIDTH, Math.max(MIN_BAR_WIDTH, (band * PAIR_RATIO - pairGap) / 2))
  const pairWidth = barWidth * 2 + pairGap
  let maxCount = 0
  let maxRemaining = 0
  for (const point of points) {
    maxCount = Math.max(maxCount, point.opened, point.closed)
    maxRemaining = Math.max(maxRemaining, point.remainingOpen)
  }
  const countScale = niceScale(maxCount)
  // The right axis takes the left axis's step count, so its labels sit on the left axis's gridlines.
  const remainingScale = alignedScale(maxRemaining, countScale.ticks.length - 1)
  const countHeight = (value: number): number => (value / countScale.max) * plotHeight
  const bandX = (index: number): number => MARGIN.left + index * band
  const openedX = (index: number): number => bandX(index) + (band - pairWidth) / 2
  const closedX = (index: number): number => openedX(index) + barWidth + pairGap

  const bars: BarMark[] = []
  const linePoints: PlotPoint[] = []
  points.forEach((point, index) => {
    if (point.opened > 0) {
      const barHeight = countHeight(point.opened)
      bars.push({ key: `o${index}`, series: 'opened', path: roundedTopBarPath(openedX(index), plotBottom - barHeight, barWidth, barHeight, CORNER_RADIUS) })
    }
    if (point.closed > 0) {
      const barHeight = countHeight(point.closed)
      bars.push({ key: `c${index}`, series: 'closed', path: roundedTopBarPath(closedX(index), plotBottom - barHeight, barWidth, barHeight, CORNER_RADIUS) })
    }
    linePoints.push({ x: bandX(index) + band / 2, y: plotBottom - (point.remainingOpen / remainingScale.max) * plotHeight })
  })

  // Labels are placed in priority order, each at its first position that stays inside the plot and clear of every
  // label already placed; a label with no such position is left out. The last line point comes first, so only a
  // plot too small to hold it can drop it; then the bar counts (newest week first), then the other line points.
  const placer = createLabelPlacer({ bounds: { left: 0, right: width, top: 0, bottom: plotBottom } })
  const placed: TrendLabel[] = []
  function place(label: Omit<TrendLabel, 'x' | 'y'>, candidates: PlotPoint[]): void {
    const spot = placer.place(label.text, candidates)
    if (spot !== null) placed.push({ ...label, x: spot.x, y: spot.y })
  }
  function lineCandidates(index: number): PlotPoint[] {
    const { x, y } = linePoints[index]
    return [{ x, y: y - LINE_LABEL_ABOVE }, { x, y: y + LINE_LABEL_BELOW }]
  }
  function placeLineLabel(index: number): void {
    const label = { key: `r${index}`, index, series: 'remaining' as const, text: formatCount(points[index].remainingOpen), isInside: false }
    place(label, lineCandidates(index))
  }
  function placeBarLabel(index: number, series: 'opened' | 'closed'): void {
    const count = series === 'opened' ? points[index].opened : points[index].closed
    if (count === 0) return
    const text = formatCount(count)
    const center = (series === 'opened' ? openedX(index) : closedX(index)) + barWidth / 2
    const barHeight = countHeight(count)
    const isInside = barHeight >= MIN_INSIDE_LABEL_HEIGHT && labelTextWidth(text) <= barWidth
    const label = { key: `${series === 'opened' ? 'o' : 'c'}${index}`, index, series, text, isInside }
    if (isInside) {
      place(label, [{ x: center, y: plotBottom - INSIDE_LABEL_INSET }])
      return
    }
    // When the centred spot is taken, the label slides off its bar's outer edge: Opened to the left, Closed to the right.
    const y = plotBottom - barHeight - OUTSIDE_LABEL_GAP
    const outward = (series === 'opened' ? -1 : 1) * (labelTextWidth(text) / 2 + LABEL_GAP)
    place(label, [{ x: center, y }, { x: center + outward, y }])
  }

  const lineIndices = lineLabelIndices(points.length, band, showValues)
  const lastIndex = points.length - 1
  if (lastIndex >= 0) placeLineLabel(lastIndex)
  if (band >= MIN_BAR_LABEL_BAND) {
    for (let index = lastIndex; index >= 0; index -= 1) {
      placeBarLabel(index, 'opened')
      placeBarLabel(index, 'closed')
    }
  }
  for (let position = lineIndices.length - 1; position >= 0; position -= 1) {
    if (lineIndices[position] !== lastIndex) placeLineLabel(lineIndices[position])
  }

  // Bar labels by week (Opened before Closed), then the line labels by week, drawn over them.
  const lineRank = (label: TrendLabel): number => (label.series === 'remaining' ? 1 : 0)
  const closedRank = (label: TrendLabel): number => (label.series === 'closed' ? 1 : 0)
  const labels = placed.sort((a, b) => lineRank(a) - lineRank(b) || a.index - b.index || closedRank(a) - closedRank(b))
  const dotIndices = band >= MIN_DOT_BAND
    ? points.map((_, index) => index)
    : labels.filter((label) => label.series === 'remaining').map((label) => label.index)

  return {
    plotRight,
    plotWidth,
    plotHeight,
    plotBottom,
    band,
    countScale,
    remainingScale,
    bars,
    linePoints,
    linePath: smoothPath(linePoints),
    areaPath: areaPath(linePoints, plotBottom),
    labels,
    dotIndices,
  }
}

function describeWeek(point: IssueTrendPoint): string {
  return `${point.week.label}: ${formatCount(point.opened)} opened, ${formatCount(point.closed)} closed, ${formatCount(point.remainingOpen)} remaining open`
}

export function IssuesTrendChart({
  points,
  selectedKey,
  width,
  height,
  colors,
  interactive,
  animate,
  describe,
  showValues = false,
  onSelectWeek,
  onHover,
}: IssuesTrendChartProps): ReactElement {
  const selectedIndex = points.findIndex((point) => point.week.key === selectedKey)
  const { focus, hasFocus, showFocusRing, svgProps } = useWeekFocus({
    count: points.length,
    selectedIndex,
    interactive,
    onSelect: (index) => onSelectWeek(points[index].week.key),
  })
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const gradientId = `qaqc-remaining-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`

  useEffect(() => {
    setHoverIndex(null)
  }, [points])

  const layout = useMemo(() => layoutChart(points, width, height, showValues), [points, width, height, showValues])
  const { plotHeight, band } = layout
  const top = MARGIN.top
  const bandX = (index: number): number => MARGIN.left + index * band
  const hovered = hoverIndex !== null && hoverIndex < layout.linePoints.length ? layout.linePoints[hoverIndex] : null

  // Hover and focus re-render the chart often, so every layer that does not depend on them is built once per layout.
  const marks = useMemo(() => {
    const countY = (value: number): number => layout.plotBottom - (value / layout.countScale.max) * layout.plotHeight
    const remainingY = (value: number): number => layout.plotBottom - (value / layout.remainingScale.max) * layout.plotHeight
    const middle = MARGIN.top + layout.plotHeight / 2
    return (
      <>
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={colors.warn} stopOpacity={0.16} />
            <stop offset="100%" stopColor={colors.warn} stopOpacity={0} />
          </linearGradient>
        </defs>
        {layout.countScale.ticks.map((tick) => (
          <g key={tick}>
            <line className="qaqc-grid-line" x1={MARGIN.left} x2={layout.plotRight} y1={countY(tick)} y2={countY(tick)} stroke={colors.grid} />
            <text className="qaqc-axis-text qaqc-count-axis-text" x={MARGIN.left - 6} y={countY(tick) + 3.5} textAnchor="end" fill={colors.axisText}>
              {formatCount(tick)}
            </text>
          </g>
        ))}
        {layout.remainingScale.ticks.map((tick) => (
          <text key={tick} className="qaqc-axis-text qaqc-remaining-axis-text" x={layout.plotRight + 6} y={remainingY(tick) + 3.5} fill={colors.warn}>
            {formatCount(tick)}
          </text>
        ))}
        {layout.bars.map((bar) => (
          <path
            key={bar.key}
            className={`qaqc-trend-bar is-${bar.series}`}
            d={bar.path}
            fill={bar.series === 'opened' ? colors.bad : colors.good}
          />
        ))}
        <path className="qaqc-remaining-area" d={layout.areaPath} fill={`url(#${gradientId})`} />
        <path className="qaqc-remaining-line" d={layout.linePath} fill="none" stroke={colors.warn} />
        {layout.dotIndices.map((index) => (
          <circle
            key={index}
            className="qaqc-remaining-dot"
            cx={layout.linePoints[index].x}
            cy={layout.linePoints[index].y}
            r={DOT_RADIUS}
            fill={colors.warn}
            stroke={colors.card}
          />
        ))}
        <text
          className="qaqc-axis-title"
          x={AXIS_TITLE_INSET}
          y={middle}
          textAnchor="middle"
          transform={`rotate(-90 ${AXIS_TITLE_INSET} ${middle})`}
          fill={colors.axisText}
        >
          Issues per week
        </text>
        <text
          className="qaqc-axis-title"
          x={width - AXIS_TITLE_INSET}
          y={middle}
          textAnchor="middle"
          transform={`rotate(90 ${width - AXIS_TITLE_INSET} ${middle})`}
          fill={colors.warn}
        >
          Remaining open
        </text>
      </>
    )
  }, [layout, colors, gradientId, width])

  const labels = useMemo(() => {
    const fillOf = (label: TrendLabel): string => {
      if (label.isInside) return colors.card
      if (label.series === 'opened') return colors.bad
      if (label.series === 'closed') return colors.good
      return colors.warn
    }
    return layout.labels.map((label) => (
      <text
        key={label.key}
        className={`qaqc-trend-label ${label.series === 'remaining' ? 'qaqc-remaining-label' : 'qaqc-bar-label'}${label.isInside ? ' is-inside' : ''}`}
        x={label.x}
        y={label.y}
        textAnchor="middle"
        fill={fillOf(label)}
      >
        {label.text}
      </text>
    ))
  }, [layout, colors])

  const weekAxis = useMemo(() => {
    const shown = labelIndices(points.length, layout.plotWidth, selectedIndex)
    const years = yearMarkers(shown, points.map((point) => point.week))
    return [...shown].sort((a, b) => a - b).map((index) => (
      <WeekAxisTick
        key={points[index].week.key}
        week={points[index].week}
        x={layout.linePoints[index].x}
        plotBottom={layout.plotBottom}
        isSelected={index === selectedIndex}
        hasYear={years.has(index)}
        colors={colors}
        className="qaqc-week-axis-text"
      />
    ))
  }, [points, layout, selectedIndex, colors])

  const hitAreas = useMemo(() => {
    function showTooltip(index: number, event: MouseEvent<SVGRectElement>): void {
      const point = points[index]
      setHoverIndex(index)
      onHover({
        title: point.week.label,
        rows: [
          { label: 'Remaining', value: formatCount(point.remainingOpen) },
          { label: 'Opened', value: formatCount(point.opened) },
          { label: 'Closed', value: formatCount(point.closed) },
        ],
        clientX: event.clientX,
        clientY: event.clientY,
      })
    }
    function hideTooltip(): void {
      setHoverIndex(null)
      onHover(null)
    }
    return (
      <g onMouseLeave={hideTooltip}>
        {points.map((point, index) => (
          <rect
            key={point.week.key}
            className="qaqc-hit"
            data-week={point.week.key}
            x={MARGIN.left + index * layout.band}
            y={MARGIN.top}
            width={layout.band}
            height={layout.plotHeight}
            fill="transparent"
            style={{ cursor: interactive ? 'pointer' : 'default' }}
            onMouseMove={(event) => showTooltip(index, event)}
            onClick={interactive ? () => onSelectWeek(point.week.key) : undefined}
          />
        ))}
      </g>
    )
  }, [points, layout, interactive, onSelectWeek, onHover])

  const summary = describe && points.length > 0
    ? `${TITLE}, ${points[0].week.label} to ${points[points.length - 1].week.label}`
    : TITLE

  return (
    <>
      <svg
        className={animate ? 'qaqc-chart qaqc-animate' : 'qaqc-chart'}
        width={width}
        height={height}
        role="group"
        aria-label={summary}
        {...svgProps}
      >
        {selectedIndex >= 0 && (
          <rect
            className="qaqc-selected-band"
            x={0}
            y={top}
            width={band}
            height={plotHeight}
            fill={colors.accent}
            style={{ transform: `translateX(${bandX(selectedIndex)}px)` }}
          />
        )}
        {marks}
        {hovered !== null && (
          <circle
            className="qaqc-remaining-dot is-hovered"
            cx={hovered.x}
            cy={hovered.y}
            r={HOVERED_DOT_RADIUS}
            fill={colors.warn}
            stroke={colors.card}
          />
        )}
        {labels}
        {weekAxis}
        {hasFocus && showFocusRing && points.length > 0 && (
          <rect
            className="qaqc-focus-ring"
            x={bandX(focus) + 1}
            y={top - 2}
            width={Math.max(0, band - 2)}
            height={plotHeight + 4}
            rx={3}
            fill="none"
            stroke={colors.accent}
            strokeWidth={1.5}
          />
        )}
        {hitAreas}
      </svg>
      <p className="qaqc-visually-hidden" aria-live="polite">
        {hasFocus && points.length > 0 ? describeWeek(points[focus]) : ''}
      </p>
    </>
  )
}
