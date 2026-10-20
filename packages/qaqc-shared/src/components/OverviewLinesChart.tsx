import { useEffect, useMemo, useState, type MouseEvent, type ReactElement } from 'react'

import { createLabelPlacer, LABEL_GAP, labelTextWidth } from '../chartLabels'
import { labelIndices, LINE_DASH, smoothPath, WEEK_AXIS_HEIGHT, yearMarkers, type PlotPoint } from '../chartMath'
import type { ChartColors, TooltipHandler, TooltipRow } from '../chartTypes'
import { useWeekFocus } from '../hooks/useWeekFocus'
import type { WorkWeek } from '../types'
import { WeekAxisTick } from './WeekAxisTick'

// The two Overview line charts (inspection activity and quality rates) share this frame: up to two lines over week
// bands, a selected-week band, keyboard focus, hover, and value labels placed without collisions.
const MARGIN_TOP = 18
/** Room right of the plot for the label of the last point. */
const MARGIN_RIGHT = 22
const MARGIN_LEFT = 40
/** A rotated axis title needs a little more room left of the tick labels. */
const MARGIN_LEFT_TITLED = 50
const AXIS_TITLE_INSET = 10
const TICK_GAP = 6
const DOT_RADIUS = 4
const HOVERED_DOT_RADIUS = 5.5
/** Bands narrower than this draw dots only on labelled points, the selected week and lone points. */
const MIN_DOT_BAND = 14
/** With showValues, each line's labels are thinned so neighbours sit at least this far apart. */
const MIN_LABEL_SPACING = 30
/** Baseline offsets from the point: above clears the dot and its ring, below clears them plus the ascent. */
const LABEL_ABOVE = 8
const LABEL_BELOW = 16
/** A label beside its dot sits this far from the point to the label's near edge. */
const LABEL_BESIDE = DOT_RADIUS + 4
/** Puts a label's digits level with the point when it sits beside the dot. */
const LABEL_BESIDE_BASELINE = 3.5
/** Labels side by side keep twice this much more, so neighbouring numbers never run together. */
const LABEL_PAD_X = 2.5

export interface WeekLine {
  /** CSS modifier and label key: `is-electrical`. */
  key: string
  color: string
  isDashed: boolean
  /** One value per week; null leaves a gap in the line. */
  values: ReadonlyArray<number | null>
}

export interface YScale {
  min: number
  max: number
  ticks: ReadonlyArray<number>
}

interface PlacedLabel {
  key: string
  line: number
  index: number
  text: string
  x: number
  y: number
}

interface LineLayout {
  key: string
  /** One smooth path per run of two or more points. */
  segments: string[]
  /** Per week; null where the value is null. */
  points: Array<PlotPoint | null>
  dotIndices: number[]
}

export interface WeekLinesLayout {
  plotLeft: number
  plotRight: number
  plotWidth: number
  plotHeight: number
  plotBottom: number
  band: number
  yOf: (value: number) => number
  lines: LineLayout[]
  /** By line, then week. */
  labels: PlacedLabel[]
}

function lastValueIndex(values: ReadonlyArray<number | null>): number {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (values[index] !== null) return index
  }
  return -1
}

function isLonePoint(values: ReadonlyArray<number | null>, index: number): boolean {
  return values[index] !== null && (values[index - 1] ?? null) === null && (values[index + 1] ?? null) === null
}

/** All of the chart's geometry and label placement; pure, so it can be memoised. */
export function layoutWeekLines(
  lines: ReadonlyArray<WeekLine>,
  count: number,
  scale: YScale,
  width: number,
  height: number,
  hasAxisTitle: boolean,
  selectedIndex: number,
  showValues: boolean,
  formatValue: (value: number) => string,
): WeekLinesLayout {
  const plotLeft = hasAxisTitle ? MARGIN_LEFT_TITLED : MARGIN_LEFT
  const plotRight = Math.max(plotLeft, width - MARGIN_RIGHT)
  const plotWidth = plotRight - plotLeft
  const plotHeight = Math.max(0, height - MARGIN_TOP - WEEK_AXIS_HEIGHT)
  const plotBottom = MARGIN_TOP + plotHeight
  const band = count > 0 ? plotWidth / count : plotWidth
  const span = scale.max > scale.min ? scale.max - scale.min : 1
  const yOf = (value: number): number => plotBottom - ((Math.min(Math.max(value, scale.min), scale.max) - scale.min) / span) * plotHeight
  const xOf = (index: number): number => plotLeft + (index + 0.5) * band

  const pointsByLine = lines.map((line) => line.values.slice(0, count).map((value, index) => (value === null ? null : { x: xOf(index), y: yOf(value) })))

  // Labels are placed in priority order, each at its first position that stays inside the plot and clear of every
  // label already placed; a label with no such position is left out. Each line's last point comes first, then the
  // selected week, then (with showValues) the rest, newest first.
  const placer = createLabelPlacer({ bounds: { left: plotLeft, right: width, top: 0, bottom: plotBottom }, padX: LABEL_PAD_X })
  const placed: PlacedLabel[] = []
  const labelled = lines.map(() => new Set<number>())

  function place(lineIndex: number, index: number, canSlide: boolean): void {
    const value = lines[lineIndex].values[index] ?? null
    const point = pointsByLine[lineIndex][index] ?? null
    if (value === null || point === null || labelled[lineIndex].has(index)) return
    // Where both lines meet on one value their dots coincide, so one label serves both.
    const shared = lines.some((other, otherIndex) => otherIndex !== lineIndex && other.values[index] === value && labelled[otherIndex].has(index))
    if (shared) {
      labelled[lineIndex].add(index)
      return
    }
    const text = formatValue(value)
    // The higher line's label goes above its dot and the lower line's below, so two close lines keep their labels apart.
    // A shared value carries one label, so a tie goes above.
    const isHigher = lines.every((other, otherIndex) => {
      const otherValue = other.values[index] ?? null
      return otherIndex === lineIndex || otherValue === null || value >= otherValue
    })
    const above = { x: point.x, y: point.y - LABEL_ABOVE }
    const below = { x: point.x, y: point.y + LABEL_BELOW }
    const candidates = isHigher ? [above, below] : [below, above]
    if (canSlide) {
      const beside = labelTextWidth(text) / 2 + LABEL_BESIDE
      candidates.push({ x: point.x + beside, y: point.y + LABEL_BESIDE_BASELINE }, { x: point.x - beside, y: point.y + LABEL_BESIDE_BASELINE })
    }
    const spot = placer.place(text, candidates)
    if (spot === null) return
    labelled[lineIndex].add(index)
    placed.push({ key: `${lines[lineIndex].key}-${index}`, line: lineIndex, index, text, x: spot.x, y: spot.y })
  }

  if (count > 0) {
    lines.forEach((line, lineIndex) => place(lineIndex, Math.min(lastValueIndex(line.values), count - 1), true))
    if (selectedIndex >= 0 && selectedIndex < count) lines.forEach((_, lineIndex) => place(lineIndex, selectedIndex, true))
    if (showValues) {
      const spacing = Math.max(MIN_LABEL_SPACING, labelTextWidth(formatValue(scale.max)) + LABEL_PAD_X * 2 + LABEL_GAP)
      const every = band > 0 ? Math.max(1, Math.ceil(spacing / band)) : count
      const lastTried = lines.map((line) => Math.min(lastValueIndex(line.values), count - 1))
      for (let index = count - 1; index >= 0; index -= 1) {
        lines.forEach((line, lineIndex) => {
          if ((line.values[index] ?? null) === null || lastTried[lineIndex] - index < every) return
          lastTried[lineIndex] = index
          place(lineIndex, index, false)
        })
      }
    }
  }

  const labels = placed.sort((a, b) => a.line - b.line || a.index - b.index)
  const layouts = lines.map((line, lineIndex): LineLayout => {
    const points = pointsByLine[lineIndex]
    const segments: string[] = []
    let run: PlotPoint[] = []
    const closeRun = (): void => {
      if (run.length > 1) segments.push(smoothPath(run))
      run = []
    }
    points.forEach((point) => {
      if (point === null) closeRun()
      else run.push(point)
    })
    closeRun()
    const dotIndices = points.flatMap((point, index) => {
      if (point === null) return []
      const isShown = band >= MIN_DOT_BAND || labelled[lineIndex].has(index) || index === selectedIndex || isLonePoint(line.values, index)
      return isShown ? [index] : []
    })
    return { key: line.key, segments, points, dotIndices }
  })

  return { plotLeft, plotRight, plotWidth, plotHeight, plotBottom, band, yOf, lines: layouts, labels }
}

export interface OverviewLinesChartProps {
  /** The static aria-label; with `describe`, the week range follows it. */
  title: string
  /** Rotated beside the left axis; null for none. */
  axisTitle: string | null
  weeks: ReadonlyArray<WorkWeek>
  lines: ReadonlyArray<WeekLine>
  scale: YScale
  formatTick: (value: number) => string
  formatValue: (value: number) => string
  tooltipRows: (index: number) => TooltipRow[]
  /** The live region's text for the focused week. */
  describeWeek: (index: number) => string
  selectedKey: number
  width: number
  height: number
  colors: ChartColors
  interactive: boolean
  animate: boolean
  describe: boolean
  showValues: boolean
  onSelectWeek: (key: number) => void
  onHover: TooltipHandler
}

export function OverviewLinesChart({
  title,
  axisTitle,
  weeks,
  lines,
  scale,
  formatTick,
  formatValue,
  tooltipRows,
  describeWeek,
  selectedKey,
  width,
  height,
  colors,
  interactive,
  animate,
  describe,
  showValues,
  onSelectWeek,
  onHover,
}: OverviewLinesChartProps): ReactElement {
  // Memoised: hover re-renders the chart on every pointer move, and this is a scan of every week.
  const selectedIndex = useMemo(() => weeks.findIndex((week) => week.key === selectedKey), [weeks, selectedKey])
  const { focus, hasFocus, showFocusRing, svgProps } = useWeekFocus({
    count: weeks.length,
    selectedIndex,
    interactive,
    onSelect: (index) => onSelectWeek(weeks[index].key),
  })
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  useEffect(() => {
    setHoverIndex(null)
  }, [weeks])

  const layout = useMemo(
    () => layoutWeekLines(lines, weeks.length, scale, width, height, axisTitle !== null, selectedIndex, showValues, formatValue),
    [lines, weeks.length, scale, width, height, axisTitle, selectedIndex, showValues, formatValue],
  )
  const { plotLeft, plotHeight, plotBottom, band } = layout
  const bandX = (index: number): number => plotLeft + index * band

  // Hover and focus re-render the chart often, so every layer that does not depend on them is built once per layout.
  const marks = useMemo(() => {
    const middle = MARGIN_TOP + layout.plotHeight / 2
    return (
      <>
        {scale.ticks.map((tick) => (
          <g key={tick}>
            <line className="qaqc-grid-line" x1={layout.plotLeft} x2={layout.plotRight} y1={layout.yOf(tick)} y2={layout.yOf(tick)} stroke={colors.grid} />
            <text
              className="qaqc-axis-text qaqc-overview-axis-text"
              x={layout.plotLeft - TICK_GAP}
              y={layout.yOf(tick) + 3.5}
              textAnchor="end"
              fill={colors.axisText}
            >
              {formatTick(tick)}
            </text>
          </g>
        ))}
        {axisTitle !== null && (
          <text
            className="qaqc-axis-title"
            x={AXIS_TITLE_INSET}
            y={middle}
            textAnchor="middle"
            transform={`rotate(-90 ${AXIS_TITLE_INSET} ${middle})`}
            fill={colors.axisText}
          >
            {axisTitle}
          </text>
        )}
        {layout.lines.map((line, lineIndex) => line.segments.map((segment, segmentIndex) => (
          <path
            key={`${line.key}-${segmentIndex}`}
            className={`qaqc-overview-line is-${line.key}`}
            d={segment}
            fill="none"
            stroke={lines[lineIndex].color}
            strokeDasharray={lines[lineIndex].isDashed ? LINE_DASH : undefined}
          />
        )))}
        {layout.lines.map((line, lineIndex) => line.dotIndices.map((index) => {
          const point = line.points[index]
          return point === null ? null : (
            <circle
              key={`${line.key}-${index}`}
              className={`qaqc-overview-dot is-${line.key}`}
              data-week={weeks[index].key}
              cx={point.x}
              cy={point.y}
              r={DOT_RADIUS}
              fill={lines[lineIndex].color}
              stroke={colors.card}
            />
          )
        }))}
      </>
    )
  }, [layout, lines, scale, weeks, colors, axisTitle, formatTick])

  const labels = useMemo(() => layout.labels.map((label) => (
    <text
      key={label.key}
      className={`qaqc-overview-label is-${layout.lines[label.line].key}`}
      data-week={weeks[label.index].key}
      x={label.x}
      y={label.y}
      textAnchor="middle"
      fill={colors.ink}
    >
      {label.text}
    </text>
  )), [layout, weeks, colors])

  const weekAxis = useMemo(() => {
    const shown = labelIndices(weeks.length, layout.plotWidth, selectedIndex)
    const years = yearMarkers(shown, weeks)
    return [...shown].sort((a, b) => a - b).map((index) => (
      <WeekAxisTick
        key={weeks[index].key}
        week={weeks[index]}
        x={layout.plotLeft + (index + 0.5) * layout.band}
        plotBottom={layout.plotBottom}
        isSelected={index === selectedIndex}
        hasYear={years.has(index)}
        colors={colors}
        className="qaqc-week-axis-text"
      />
    ))
  }, [weeks, layout, selectedIndex, colors])

  const hitAreas = useMemo(() => {
    function showTooltip(index: number, event: MouseEvent<SVGRectElement>): void {
      setHoverIndex(index)
      onHover({ title: weeks[index].label, rows: tooltipRows(index), clientX: event.clientX, clientY: event.clientY })
    }
    function hideTooltip(): void {
      setHoverIndex(null)
      onHover(null)
    }
    return (
      <g onMouseLeave={hideTooltip}>
        {weeks.map((week, index) => (
          <rect
            key={week.key}
            className="qaqc-hit"
            data-week={week.key}
            x={layout.plotLeft + index * layout.band}
            y={MARGIN_TOP}
            width={layout.band}
            height={layout.plotHeight}
            fill="transparent"
            style={{ cursor: interactive ? 'pointer' : 'default' }}
            onMouseMove={(event) => showTooltip(index, event)}
            onClick={interactive ? () => onSelectWeek(week.key) : undefined}
          />
        ))}
      </g>
    )
  }, [weeks, layout, interactive, onSelectWeek, onHover, tooltipRows])

  const hovered = hoverIndex !== null && hoverIndex < weeks.length ? hoverIndex : null
  const summary = describe && weeks.length > 0 ? `${title}, ${weeks[0].label} to ${weeks[weeks.length - 1].label}` : title

  return (
    <>
      <svg
        className={animate ? 'qaqc-chart qaqc-overview-chart qaqc-animate' : 'qaqc-chart qaqc-overview-chart'}
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
            y={MARGIN_TOP}
            width={band}
            height={plotHeight}
            fill={colors.accent}
            style={{ transform: `translateX(${bandX(selectedIndex)}px)` }}
          />
        )}
        {marks}
        {hovered !== null && (
          <>
            <line
              className="qaqc-overview-hover-guide"
              x1={bandX(hovered) + band / 2}
              x2={bandX(hovered) + band / 2}
              y1={MARGIN_TOP}
              y2={plotBottom}
              stroke={colors.axisText}
            />
            {layout.lines.map((line, lineIndex) => {
              const point = line.points[hovered]
              return point === null ? null : (
                <circle
                  key={line.key}
                  className={`qaqc-overview-dot is-${line.key} is-hovered`}
                  cx={point.x}
                  cy={point.y}
                  r={HOVERED_DOT_RADIUS}
                  fill={lines[lineIndex].color}
                  stroke={colors.card}
                />
              )
            })}
          </>
        )}
        {labels}
        {weekAxis}
        {hasFocus && showFocusRing && weeks.length > 0 && (
          <rect
            className="qaqc-focus-ring"
            x={bandX(focus) + 1}
            y={MARGIN_TOP - 2}
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
        {hasFocus && weeks.length > 0 ? describeWeek(focus) : ''}
      </p>
    </>
  )
}
