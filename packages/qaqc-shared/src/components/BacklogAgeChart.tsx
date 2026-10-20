import { useMemo, useState, type MouseEvent, type ReactElement } from 'react'

import { createLabelPlacer, labelTextWidth } from '../chartLabels'
import { labelIndices, LINE_DASH, niceScale, WEEK_AXIS_HEIGHT, yearMarkers, type PlotPoint } from '../chartMath'
import type { ChartColors, TooltipHandler } from '../chartTypes'
import { formatCount } from '../format'
import { useWeekFocus } from '../hooks/useWeekFocus'
import type { ProfilePoint } from '../issueBenchmarks'
import type { LegendItem } from './ChartPanel'
import { WeekAxisTick } from './WeekAxisTick'

// "Is the backlog getting older?" on the Issue Aging page: the median age of the open issues as of each week, against
// the normal close window as of the selected week.

const MARGIN = { top: 14, right: 40, left: 46 } as const
const TICK_GAP = 7
const DOT_RADIUS = 4
/** The last point's label beside its dot, and the gap between a label and the line it names. */
const LABEL_BESIDE = DOT_RADIUS + 3
const LABEL_BESIDE_BASELINE = 3.5
const LABEL_ABOVE = 8
const LABEL_BELOW = 16
const WINDOW_LABEL_INSET = 4
const WINDOW_LABEL_BELOW = 13
const WINDOW_LABEL_ABOVE = 5
const LABEL_PAD_X = 2

const formatDays = (value: number): string => `${formatCount(Math.round(value))} d`

export function backlogLegend(colors: ChartColors, windowDays: number | null): LegendItem[] {
  const line: LegendItem = { label: 'Median age of open issues', color: colors.series1, shape: 'line' }
  if (windowDays === null) return [line]
  return [line, { label: `Normal close window (${formatCount(windowDays)} d)`, color: colors.good, shape: 'dashed' }]
}

interface PlacedLabel {
  key: 'window' | 'last'
  text: string
  x: number
  y: number
}

interface BacklogLayout {
  plotLeft: number
  plotRight: number
  plotBottom: number
  band: number
  ticks: number[]
  yOf: (value: number) => number
  xOf: (index: number) => number
  /** One straight path per run of weeks with open issues. */
  segments: string[]
  lastIndex: number
  labels: PlacedLabel[]
}

function lastValueIndex(points: readonly ProfilePoint[]): number {
  for (let index = points.length - 1; index >= 0; index -= 1) {
    if (points[index].median !== null) return index
  }
  return -1
}

function layoutBacklog(points: readonly ProfilePoint[], windowDays: number | null, width: number, height: number): BacklogLayout {
  const plotLeft = MARGIN.left
  const plotRight = Math.max(plotLeft, width - MARGIN.right)
  const plotBottom = Math.max(MARGIN.top, height - WEEK_AXIS_HEIGHT)
  const band = points.length > 0 ? (plotRight - plotLeft) / points.length : 0
  const highest = points.reduce((max, point) => Math.max(max, point.median ?? 0), windowDays ?? 0)
  const scale = niceScale(highest, 3)
  const yOf = (value: number): number => plotBottom - (value / scale.max) * (plotBottom - MARGIN.top)
  const xOf = (index: number): number => plotLeft + band * (index + 0.5)

  const segments: string[] = []
  let run: PlotPoint[] = []
  const closeRun = (): void => {
    if (run.length > 1) segments.push(run.map((point, at) => `${at === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(''))
    run = []
  }
  points.forEach((point, index) => {
    if (point.median === null) closeRun()
    else run.push({ x: xOf(index), y: yOf(point.median) })
  })
  closeRun()

  // The window label goes first, under its line at the right (or over it); the last point's label then takes the
  // first spot clear of it: beside the dot, above, below, or to its left.
  const placer = createLabelPlacer({ bounds: { left: plotLeft, right: width, top: 0, bottom: plotBottom }, padX: LABEL_PAD_X })
  const labels: PlacedLabel[] = []
  if (windowDays !== null) {
    const text = `normal close window ${formatCount(windowDays)} d`
    const x = plotRight - WINDOW_LABEL_INSET - labelTextWidth(text) / 2
    const lineY = yOf(windowDays)
    const spot = placer.place(text, [{ x, y: lineY + WINDOW_LABEL_BELOW }, { x, y: lineY - WINDOW_LABEL_ABOVE }])
    if (spot !== null) labels.push({ key: 'window', text, ...spot })
  }
  const lastIndex = lastValueIndex(points)
  const lastMedian = lastIndex >= 0 ? points[lastIndex].median : null
  if (lastMedian !== null) {
    const text = formatDays(lastMedian)
    const x = xOf(lastIndex)
    const y = yOf(lastMedian)
    const beside = labelTextWidth(text) / 2 + LABEL_BESIDE
    const spot = placer.place(text, [
      { x: x + beside, y: y + LABEL_BESIDE_BASELINE },
      { x, y: y - LABEL_ABOVE },
      { x, y: y + LABEL_BELOW },
      { x: x - beside, y: y + LABEL_BESIDE_BASELINE },
    ])
    if (spot !== null) labels.push({ key: 'last', text, ...spot })
  }

  return { plotLeft, plotRight, plotBottom, band, ticks: scale.ticks, yOf, xOf, segments, lastIndex, labels }
}

export interface BacklogAgeChartProps {
  /** The range's weeks, oldest first. */
  points: ProfilePoint[]
  /** The normal close window as of the selected week, or null without closures. */
  windowDays: number | null
  selectedKey: number
  width: number
  height: number
  colors: ChartColors
  onSelectWeek: (key: number) => void
  onHover: TooltipHandler
}

export function BacklogAgeChart({ points, windowDays, selectedKey, width, height, colors, onSelectWeek, onHover }: BacklogAgeChartProps): ReactElement {
  const selectedIndex = useMemo(() => points.findIndex((point) => point.week.key === selectedKey), [points, selectedKey])
  const layout = useMemo(() => layoutBacklog(points, windowDays, width, height), [points, windowDays, width, height])
  const { focus, hasFocus, showFocusRing, svgProps } = useWeekFocus({
    count: points.length,
    selectedIndex,
    interactive: true,
    onSelect: (index) => onSelectWeek(points[index].week.key),
  })
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const { plotLeft, plotRight, plotBottom, band, yOf, xOf } = layout
  const plotHeight = plotBottom - MARGIN.top

  const weekAxis = useMemo(() => {
    const weeks = points.map((point) => point.week)
    const shown = labelIndices(weeks.length, plotRight - plotLeft, selectedIndex)
    const years = yearMarkers(shown, weeks)
    return [...shown].sort((a, b) => a - b).map((index) => (
      <WeekAxisTick
        key={weeks[index].key}
        week={weeks[index]}
        x={xOf(index)}
        plotBottom={plotBottom}
        isSelected={index === selectedIndex}
        hasYear={years.has(index)}
        colors={colors}
      />
    ))
  }, [points, plotLeft, plotRight, plotBottom, xOf, selectedIndex, colors])

  function showTooltip(index: number, event: MouseEvent<SVGRectElement>): void {
    const point = points[index]
    setHoverIndex(index)
    onHover({
      title: point.week.label,
      rows: [
        { label: 'Median age of open issues', value: point.median === null ? 'none open' : formatDays(point.median) },
        { label: 'Open issues', value: formatCount(point.open) },
      ],
      clientX: event.clientX,
      clientY: event.clientY,
    })
  }

  const dotIndices = [layout.lastIndex, selectedIndex, hoverIndex ?? -1].filter((index, at, list) => index >= 0 && list.indexOf(index) === at)
  const focused = points[focus]

  return (
    <>
      <svg
        className="qaqc-chart qaqc-aging-backlog"
        width={width}
        height={height}
        role="group"
        aria-label="Median age of open issues by work week"
        {...svgProps}
      >
        {layout.ticks.map((tick) => (
          <g key={tick}>
            <line className="qaqc-grid-line" x1={plotLeft} x2={plotRight} y1={yOf(tick)} y2={yOf(tick)} stroke={colors.grid} />
            <text className="qaqc-axis-text" x={plotLeft - TICK_GAP} y={yOf(tick) + 3.5} textAnchor="end" fill={colors.axisText}>
              {formatDays(tick)}
            </text>
          </g>
        ))}
        {selectedIndex >= 0 && (
          <rect
            className="qaqc-selected-band"
            x={plotLeft + selectedIndex * band}
            y={MARGIN.top}
            width={band}
            height={plotHeight}
            fill={colors.accent}
          />
        )}
        {windowDays !== null && (
          <line
            className="qaqc-aging-window-line"
            x1={plotLeft}
            x2={plotRight}
            y1={yOf(windowDays)}
            y2={yOf(windowDays)}
            stroke={colors.good}
            strokeWidth={1.5}
            strokeDasharray={LINE_DASH}
          />
        )}
        {layout.segments.map((segment) => (
          <path
            key={segment}
            className="qaqc-aging-backlog-line"
            d={segment}
            fill="none"
            stroke={colors.series1}
            strokeWidth={2.25}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {dotIndices.map((index) => {
          const median = points[index].median
          return median === null ? null : (
            <circle
              key={index}
              className="qaqc-aging-backlog-dot"
              cx={xOf(index)}
              cy={yOf(median)}
              r={DOT_RADIUS}
              fill={colors.series1}
              stroke={colors.card}
              strokeWidth={1.5}
            />
          )
        })}
        {layout.labels.map((label) => (
          <text
            key={label.key}
            className={`qaqc-aging-label is-${label.key}`}
            x={label.x}
            y={label.y}
            textAnchor="middle"
            fill={label.key === 'window' ? colors.good : colors.series1}
          >
            {label.text}
          </text>
        ))}
        {weekAxis}
        {hasFocus && showFocusRing && points.length > 0 && (
          <rect
            className="qaqc-focus-ring"
            x={plotLeft + focus * band + 1}
            y={MARGIN.top - 2}
            width={Math.max(0, band - 2)}
            height={plotHeight + 4}
            rx={3}
            fill="none"
            stroke={colors.accent}
            strokeWidth={1.5}
          />
        )}
        <g
          onMouseLeave={() => {
            setHoverIndex(null)
            onHover(null)
          }}
        >
          {points.map((point, index) => (
            <rect
              key={point.week.key}
              className="qaqc-hit"
              data-week={point.week.key}
              x={plotLeft + index * band}
              y={MARGIN.top}
              width={band}
              height={plotHeight}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onMouseMove={(event) => showTooltip(index, event)}
              onClick={() => onSelectWeek(point.week.key)}
            />
          ))}
        </g>
      </svg>
      <p className="qaqc-visually-hidden" aria-live="polite">
        {hasFocus && focused !== undefined
          ? `${focused.week.label}: median age ${focused.median === null ? 'none open' : formatDays(focused.median)}, ${formatCount(focused.open)} open`
          : ''}
      </p>
    </>
  )
}
