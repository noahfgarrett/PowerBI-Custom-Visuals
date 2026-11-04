import { useEffect, useMemo, useState, type MouseEvent, type ReactElement } from 'react'

import { boxesOverlap, createLabelPlacer, LABEL_GAP, labelBox, labelHalfWidth, labelTextWidth, type LabelBox } from '../chartLabels'
import {
  labelIndices,
  niceScale,
  percentScale,
  roundedTopBarPath,
  smoothPath,
  WEEK_AXIS_HEIGHT,
  yearMarkers,
  type NiceScale,
  type PlotPoint,
} from '../chartMath'
import type { ChartColors, TooltipHandler } from '../chartTypes'
import { formatCount } from '../format'
import type { PerformanceGroup, PersonWeek } from '../performance'
import type { LegendItem } from './ChartPanel'
import { formatPassRate } from './PerformanceTable'
import { WeekAxisTick } from './WeekAxisTick'

// The IssuesTrendChart layout: a bar pair per week on the left axis, a line on its own right axis.
const MARGIN = { top: 26, right: 48, bottom: WEEK_AXIS_HEIGHT, left: 44 } as const
/** The volume + NCR pair fills this share of its week's band. */
const PAIR_RATIO = 0.7
const PAIR_GAP_RATIO = 0.08
const MAX_PAIR_GAP = 3
/** Bands narrower than this put the two bars edge to edge. */
const MIN_PAIR_GAP_BAND = 10
const MAX_BAR_WIDTH = 16
const MIN_BAR_WIDTH = 1
const CORNER_RADIUS = 2.5
const AXIS_TITLE_INSET = 10
const DOT_RADIUS = 2.5
const HOVERED_DOT_RADIUS = 4
/** Bands narrower than this draw dots only on labelled points. */
const MIN_DOT_BAND = 12
/** Bands narrower than this get no bar labels. */
const MIN_BAR_LABEL_BAND = 18
const OUTSIDE_LABEL_GAP = 4
/** Every third line point is labelled (and the last), thinned so neighbours sit at least this far apart. */
const LINE_LABEL_EVERY = 3
const MIN_LINE_LABEL_SPACING = 40
const LINE_LABEL_ABOVE = 7
const LINE_LABEL_BELOW = 14
/** A line point this close under the top of the plot may lift its label above the plot, clear of the tallest bars. */
const TOP_LABEL_REACH = 28
/** Rate labels keep at least this far from every bar. */
const BAR_LABEL_PAD = 2

const VOLUME_LABELS: Record<PerformanceGroup, string> = { qcr: 'Finals', welders: 'Welds' }
const RUNNING_PASS_RATE_LABEL = 'Running NCR Pass Rate'

export interface PersonWeekChartProps {
  /** Each week of the period, oldest first. */
  weeks: PersonWeek[]
  group: PerformanceGroup
  width: number
  height: number
  colors: ChartColors
  animate: boolean
  /** Screen reader chart summaries (Format pane, Accessibility): the label adds the weeks the chart covers. */
  describe: boolean
  onHover: TooltipHandler
}

type LabelSeries = 'volume' | 'ncr' | 'rate'

interface BarMark {
  key: string
  series: 'volume' | 'ncr'
  path: string
}

interface ChartLabel {
  key: string
  index: number
  series: LabelSeries
  text: string
  x: number
  y: number
}

export interface PersonWeekLayout {
  plotRight: number
  plotWidth: number
  plotHeight: number
  plotBottom: number
  band: number
  countScale: NiceScale
  passRateScale: NiceScale
  bars: BarMark[]
  /** Each week's band centre. */
  centers: number[]
  /** Each week's point on the pass rate line, or null before the period's first volume. */
  linePoints: Array<PlotPoint | null>
  linePath: string
  labels: ChartLabel[]
  dotIndices: number[]
}

export function personWeekLegend(colors: ChartColors, group: PerformanceGroup): LegendItem[] {
  return [
    { label: VOLUME_LABELS[group], color: colors.series1, shape: 'bar' },
    { label: 'NCRs', color: colors.bad, shape: 'bar' },
    { label: RUNNING_PASS_RATE_LABEL, color: colors.warn, shape: 'line' },
  ]
}

/** Every third week and the last, thinned on narrow bands so labels sit at least 40 px apart. */
function lineLabelIndices(count: number, band: number): number[] {
  if (count === 0) return []
  const spacing = band > 0 ? Math.max(1, Math.ceil(MIN_LINE_LABEL_SPACING / band)) : count
  const every = Math.max(LINE_LABEL_EVERY, spacing)
  const indices: number[] = []
  for (let index = count - 1; index >= 0; index -= every) indices.push(index)
  return indices
}

/** All of the chart's geometry and label placement; pure, so it can be memoised. */
export function layoutPersonWeeks(weeks: PersonWeek[], width: number, height: number): PersonWeekLayout {
  const plotRight = width - MARGIN.right
  const plotWidth = Math.max(0, plotRight - MARGIN.left)
  const plotHeight = Math.max(0, height - MARGIN.top - MARGIN.bottom)
  const plotBottom = MARGIN.top + plotHeight
  const band = weeks.length > 0 ? plotWidth / weeks.length : plotWidth
  const pairGap = band >= MIN_PAIR_GAP_BAND ? Math.min(MAX_PAIR_GAP, band * PAIR_GAP_RATIO) : 0
  const barWidth = Math.min(MAX_BAR_WIDTH, Math.max(MIN_BAR_WIDTH, (band * PAIR_RATIO - pairGap) / 2))
  const pairWidth = barWidth * 2 + pairGap
  let maxCount = 0
  for (const week of weeks) maxCount = Math.max(maxCount, week.volume, week.ncrs)
  const countScale = niceScale(maxCount)
  // The right axis always runs 0 to 100%, in the left axis's step count so its labels sit on the left axis's gridlines.
  const passRateScale = percentScale(countScale.ticks.length - 1)
  const countHeight = (value: number): number => (value / countScale.max) * plotHeight
  const bandX = (index: number): number => MARGIN.left + index * band
  const volumeX = (index: number): number => bandX(index) + (band - pairWidth) / 2
  const ncrX = (index: number): number => volumeX(index) + barWidth + pairGap

  const bars: BarMark[] = []
  /** Every bar's rect grown by BAR_LABEL_PAD; rate labels stay off them. */
  const barBoxes: LabelBox[] = []
  const addBar = (key: string, series: BarMark['series'], x: number, count: number): void => {
    const barHeight = countHeight(count)
    const top = plotBottom - barHeight
    bars.push({ key, series, path: roundedTopBarPath(x, top, barWidth, barHeight, CORNER_RADIUS) })
    barBoxes.push({ left: x - BAR_LABEL_PAD, right: x + barWidth + BAR_LABEL_PAD, top: top - BAR_LABEL_PAD, bottom: plotBottom })
  }
  const centers: number[] = []
  const linePoints: Array<PlotPoint | null> = []
  weeks.forEach((week, index) => {
    if (week.volume > 0) addBar(`v${index}`, 'volume', volumeX(index), week.volume)
    if (week.ncrs > 0) addBar(`n${index}`, 'ncr', ncrX(index), week.ncrs)
    const center = bandX(index) + band / 2
    centers.push(center)
    linePoints.push(week.runningPassRate === null ? null : { x: center, y: plotBottom - (week.runningPassRate / passRateScale.max) * plotHeight })
  })

  // Labels go in priority order, each at its first position inside the plot and clear of every label already
  // placed; a label with no such position is left out. The latest rate comes first, then the NCR counts and the
  // volumes (newest week first), then the other rate points.
  // Labels stay between the axes, so they never run into either column of tick labels.
  const placer = createLabelPlacer({ bounds: { left: MARGIN.left, right: plotRight, top: 0, bottom: plotBottom } })
  const placed: ChartLabel[] = []
  function place(label: Omit<ChartLabel, 'x' | 'y'>, candidates: PlotPoint[]): void {
    const spot = placer.place(label.text, candidates)
    if (spot !== null) placed.push({ ...label, x: spot.x, y: spot.y })
  }
  function placePassRateLabel(index: number): void {
    const point = linePoints[index]
    const passRate = weeks[index].runningPassRate
    if (point === null || passRate === null) return
    const text = formatPassRate(passRate)
    // A point within half a label of either axis (the newest week always is, on narrow bands) slides its label
    // inward until it ends at the axis, rather than losing it.
    const half = labelHalfWidth(text)
    const x = Math.min(Math.max(point.x, MARGIN.left + half), plotRight - half)
    const candidates = [{ x, y: point.y - LINE_LABEL_ABOVE }, { x, y: point.y + LINE_LABEL_BELOW }]
    // Pass rates usually run just under 100%, where the tallest bars end; no bar reaches above the plot.
    if (point.y - MARGIN.top <= TOP_LABEL_REACH) candidates.push({ x, y: MARGIN.top - LINE_LABEL_ABOVE })
    // Rate labels stay off the bars (bar counts may sit right on top of theirs, so the bars only block rate labels).
    // The newest rate is the one readers take as current: with every position on a bar, it keeps them anyway.
    const offBars = candidates.filter((candidate) => {
      const box = labelBox(text, candidate.x, candidate.y)
      return barBoxes.every((bar) => !boxesOverlap(box, bar))
    })
    const isNewest = index === weeks.length - 1
    place({ key: `r${index}`, index, series: 'rate', text }, offBars.length === 0 && isNewest ? candidates : offBars)
  }
  function placeBarLabel(index: number, series: 'volume' | 'ncr'): void {
    const count = series === 'volume' ? weeks[index].volume : weeks[index].ncrs
    if (count === 0) return
    const text = formatCount(count)
    const center = (series === 'volume' ? volumeX(index) : ncrX(index)) + barWidth / 2
    const y = plotBottom - countHeight(count) - OUTSIDE_LABEL_GAP
    // When the centred spot is taken, the label slides off its bar's outer edge: volume to the left, NCRs to the right.
    const outward = (series === 'volume' ? -1 : 1) * (labelTextWidth(text) / 2 + LABEL_GAP)
    place({ key: `${series === 'volume' ? 'v' : 'n'}${index}`, index, series, text }, [{ x: center, y }, { x: center + outward, y }])
  }

  const lastIndex = weeks.length - 1
  if (lastIndex >= 0) placePassRateLabel(lastIndex)
  if (band >= MIN_BAR_LABEL_BAND) {
    for (let index = lastIndex; index >= 0; index -= 1) placeBarLabel(index, 'ncr')
    for (let index = lastIndex; index >= 0; index -= 1) placeBarLabel(index, 'volume')
  }
  for (const index of lineLabelIndices(weeks.length, band)) {
    if (index !== lastIndex) placePassRateLabel(index)
  }

  // Bar labels by week, then the rate labels drawn over them.
  const rateRank = (label: ChartLabel): number => (label.series === 'rate' ? 1 : 0)
  const labels = placed.sort((a, b) => rateRank(a) - rateRank(b) || a.index - b.index)
  const pointIndices = linePoints.flatMap((point, index) => (point === null ? [] : [index]))
  const dotIndices = band >= MIN_DOT_BAND
    ? pointIndices
    : labels.filter((label) => label.series === 'rate').map((label) => label.index)

  return {
    plotRight,
    plotWidth,
    plotHeight,
    plotBottom,
    band,
    countScale,
    passRateScale,
    bars,
    centers,
    linePoints,
    linePath: smoothPath(linePoints.filter((point): point is PlotPoint => point !== null)),
    labels,
    dotIndices,
  }
}

function chartTitle(group: PerformanceGroup): string {
  return `${VOLUME_LABELS[group]} and NCRs by work week, with the ${RUNNING_PASS_RATE_LABEL}`
}

/**
 * One person's weeks in the period: their Finals (or welds) with NCRs beside them, and the Running NCR Pass Rate within
 * the period on a right axis. Hover shows each week; there is no week selection.
 */
export function PersonWeekChart({ weeks, group, width, height, colors, animate, describe, onHover }: PersonWeekChartProps): ReactElement {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const layout = useMemo(() => layoutPersonWeeks(weeks, width, height), [weeks, width, height])
  const volumeLabel = VOLUME_LABELS[group]

  useEffect(() => {
    setHoverIndex(null)
  }, [weeks])

  const marks = useMemo(() => {
    const countY = (value: number): number => layout.plotBottom - (value / layout.countScale.max) * layout.plotHeight
    const middle = MARGIN.top + layout.plotHeight / 2
    return (
      <>
        {layout.countScale.ticks.map((tick, step) => (
          <g key={tick}>
            <line className="qaqc-grid-line" x1={MARGIN.left} x2={layout.plotRight} y1={countY(tick)} y2={countY(tick)} stroke={colors.grid} />
            <text className="qaqc-axis-text qaqc-perf-count-axis-text" x={MARGIN.left - 6} y={countY(tick) + 3.5} textAnchor="end" fill={colors.axisText}>
              {formatCount(tick)}
            </text>
            {step < layout.passRateScale.ticks.length && (
              <text className="qaqc-axis-text qaqc-perf-rate-axis-text" x={layout.plotRight + 6} y={countY(tick) + 3.5} fill={colors.warn}>
                {`${formatCount(Math.round(layout.passRateScale.ticks[step]))}%`}
              </text>
            )}
          </g>
        ))}
        {layout.bars.map((bar) => (
          <path
            key={bar.key}
            className={`qaqc-perf-chart-bar is-${bar.series}`}
            d={bar.path}
            fill={bar.series === 'volume' ? colors.series1 : colors.bad}
          />
        ))}
        {layout.linePath !== '' && <path className="qaqc-perf-rate-line" d={layout.linePath} fill="none" stroke={colors.warn} />}
        {layout.dotIndices.map((index) => {
          const point = layout.linePoints[index]
          if (point === null) return null
          return <circle key={index} className="qaqc-perf-rate-dot" cx={point.x} cy={point.y} r={DOT_RADIUS} fill={colors.warn} stroke={colors.card} />
        })}
        <text
          className="qaqc-axis-title"
          x={AXIS_TITLE_INSET}
          y={middle}
          textAnchor="middle"
          transform={`rotate(-90 ${AXIS_TITLE_INSET} ${middle})`}
          fill={colors.axisText}
        >
          {`${volumeLabel} per week`}
        </text>
        <text
          className="qaqc-axis-title"
          x={width - AXIS_TITLE_INSET}
          y={middle}
          textAnchor="middle"
          transform={`rotate(90 ${width - AXIS_TITLE_INSET} ${middle})`}
          fill={colors.warn}
        >
          {RUNNING_PASS_RATE_LABEL}
        </text>
      </>
    )
  }, [layout, colors, width, volumeLabel])

  const labels = useMemo(() => {
    const fillOf = (series: LabelSeries): string => {
      if (series === 'ncr') return colors.bad
      if (series === 'rate') return colors.warn
      return colors.ink
    }
    return layout.labels.map((label) => (
      <text
        key={label.key}
        className={`qaqc-perf-chart-label is-${label.series}`}
        data-week={weeks[label.index]?.week.key}
        x={label.x}
        y={label.y}
        textAnchor="middle"
        fill={fillOf(label.series)}
      >
        {label.text}
      </text>
    ))
  }, [layout, colors, weeks])

  const weekAxis = useMemo(() => {
    const shown = labelIndices(weeks.length, layout.plotWidth, -1)
    const years = yearMarkers(shown, weeks.map((week) => week.week))
    return [...shown].sort((a, b) => a - b).map((index) => (
      <WeekAxisTick
        key={weeks[index].week.key}
        week={weeks[index].week}
        x={layout.centers[index]}
        plotBottom={layout.plotBottom}
        isSelected={false}
        hasYear={years.has(index)}
        colors={colors}
        className="qaqc-week-axis-text"
      />
    ))
  }, [weeks, layout, colors])

  function indexAt(event: MouseEvent<SVGRectElement>): number | null {
    if (weeks.length === 0 || layout.band <= 0) return null
    const left = event.currentTarget.getBoundingClientRect().left
    const index = Math.floor((event.clientX - left) / layout.band)
    return Math.min(weeks.length - 1, Math.max(0, index))
  }

  function showTooltip(event: MouseEvent<SVGRectElement>): void {
    const index = indexAt(event)
    if (index === null) return
    const week = weeks[index]
    setHoverIndex(index)
    onHover({
      title: week.week.label,
      rows: [
        { label: volumeLabel, value: formatCount(week.volume) },
        { label: 'NCRs', value: formatCount(week.ncrs) },
        { label: RUNNING_PASS_RATE_LABEL, value: formatPassRate(week.runningPassRate) },
      ],
      clientX: event.clientX,
      clientY: event.clientY,
    })
  }

  function hideTooltip(): void {
    setHoverIndex(null)
    onHover(null)
  }

  const hoveredPoint = hoverIndex !== null && hoverIndex < layout.linePoints.length ? layout.linePoints[hoverIndex] : null
  const title = chartTitle(group)
  const summary = describe && weeks.length > 0 ? `${title}, ${weeks[0].week.label} to ${weeks[weeks.length - 1].week.label}` : title

  return (
    <svg className={animate ? 'qaqc-chart qaqc-perf-chart qaqc-animate' : 'qaqc-chart qaqc-perf-chart'} width={width} height={height} role="img" aria-label={summary}>
      {hoverIndex !== null && hoverIndex < weeks.length && (
        <rect
          className="qaqc-perf-chart-hover"
          x={MARGIN.left + hoverIndex * layout.band}
          y={MARGIN.top}
          width={layout.band}
          height={layout.plotHeight}
          fill={colors.accent}
        />
      )}
      {marks}
      {hoveredPoint !== null && (
        <circle className="qaqc-perf-rate-dot is-hovered" cx={hoveredPoint.x} cy={hoveredPoint.y} r={HOVERED_DOT_RADIUS} fill={colors.warn} stroke={colors.card} />
      )}
      {labels}
      {weekAxis}
      <rect
        className="qaqc-perf-chart-hit"
        x={MARGIN.left}
        y={MARGIN.top}
        width={layout.plotWidth}
        height={layout.plotHeight}
        fill="transparent"
        onMouseMove={showTooltip}
        onMouseLeave={hideTooltip}
      />
    </svg>
  )
}
