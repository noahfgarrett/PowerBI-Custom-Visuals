import { useEffect, useMemo, useState, type MouseEvent, type ReactElement } from 'react'

import { labelIndices, niceScale, round, roundedTopBarPath, WEEK_AXIS_HEIGHT, WEEK_TICK_OFFSET, YEAR_MARKER_OFFSET, yearMarkers } from '../chartMath'
import type { ChartColors, TooltipHandler } from '../chartTypes'
import { formatCount, formatSignoffRate, pluralize } from '../format'
import { useWeekFocus } from '../hooks/useWeekFocus'
import type { WeldWeekCounts } from '../types'
import { shortWeekLabel } from '../workWeeks'

// Matches the HTML app's Welding chart: counts on the left axis, sign-off % on a fixed 0–100% right axis.
const MARGIN = { top: 34, right: 48, bottom: WEEK_AXIS_HEIGHT, left: 44 } as const
const BAR_RATIO = 0.56
const MAX_BAR_WIDTH = 24
const MIN_BAR_WIDTH = 2
const BADGE_RADIUS = 8
const CORNER_RADIUS = 3
const RATE_TICKS = [0, 25, 50, 75, 100] as const
/** Sign-off below this percent misses the baseline. */
const BASELINE_PERCENT = 10
const RATE_DOT_RADIUS = 3.5
/** Bands narrower than this get no total or signed labels. */
const MIN_BAR_LABEL_BAND = 18
/** Bands narrower than this get no rate label in the expanded view. */
const MIN_RATE_LABEL_BAND = 28
/** A signed bar at least this tall carries its label inside. */
const MIN_INSIDE_LABEL_HEIGHT = 16
const TEXT_HEIGHT = 9
const TOTAL_LABEL_GAP = 5
const SIGNED_LABEL_INSET = 12
const SIGNED_LABEL_GAP = 4
const BADGE_GAP = 2
// A rate label must sit at least this far from the total label, badge, and baseline label.
const RATE_LABEL_CLEARANCE = 15
const RATE_LABEL_ABOVE = 10
const RATE_LABEL_BELOW = 17
const AXIS_TITLE_INSET = 10
const BASELINE_LABEL = '10% baseline'
const BASELINE_LABEL_GAP = 5
/** Approximate width of one 9.5 px bold label character. */
const LABEL_CHAR_WIDTH = 5.6
/** Half the width of a rate label such as "100%". */
const RATE_LABEL_HALF_WIDTH = 12

export interface SignoffBarChartProps {
  weeks: WeldWeekCounts[]
  selectedKey: number
  width: number
  height: number
  colors: ChartColors
  interactive: boolean
  animate: boolean
  describe: boolean
  /** Labels the sign-off % at every week whose band is wide enough, not only the selected week. */
  showValues?: boolean
  onSelectWeek: (key: number) => void
  onHover: TooltipHandler
}

interface RatePoint {
  index: number
  x: number
  y: number
  rate: number
}

function signoffRate(item: WeldWeekCounts): number | null {
  return item.logged === 0 ? null : (item.signed / item.logged) * 100
}

function signedOfTotal(item: WeldWeekCounts): string {
  return `${formatCount(item.signed)} of ${formatCount(item.logged)}`
}

function describeWeek(item: WeldWeekCounts): string {
  const issues = `${formatCount(item.issues)} ${pluralize(item.issues, 'issue', 'issues')} created`
  return `${item.week.label}: ${signedOfTotal(item)} welds signed (${formatSignoffRate(signoffRate(item))}), ${issues}`
}

/** The app's smooth line: each segment's control points sit a third of the way along, level with its ends. */
function smoothPath(points: RatePoint[]): string {
  return points
    .map((point, index) => {
      if (index === 0) return `M${round(point.x)},${round(point.y)}`
      const previous = points[index - 1]
      const control = (point.x - previous.x) / 3
      return `C${round(previous.x + control)},${round(previous.y)} ${round(point.x - control)},${round(point.y)} ${round(point.x)},${round(point.y)}`
    })
    .join(' ')
}

export function SignoffBarChart({
  weeks,
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
}: SignoffBarChartProps): ReactElement {
  const selectedIndex = weeks.findIndex((item) => item.week.key === selectedKey)
  const { focus, hasFocus, showFocusRing, svgProps } = useWeekFocus({
    count: weeks.length,
    selectedIndex,
    interactive,
    onSelect: (index) => onSelectWeek(weeks[index].week.key),
  })
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  useEffect(() => {
    setHoverIndex(null)
  }, [weeks])

  const top = MARGIN.top
  const plotRight = width - MARGIN.right
  const plotWidth = Math.max(0, plotRight - MARGIN.left)
  const plotHeight = Math.max(0, height - top - MARGIN.bottom)
  const plotBottom = top + plotHeight
  const band = weeks.length > 0 ? plotWidth / weeks.length : plotWidth
  const barWidth = Math.min(MAX_BAR_WIDTH, Math.max(MIN_BAR_WIDTH, band * BAR_RATIO))
  const scale = useMemo(() => niceScale(weeks.reduce((max, item) => Math.max(max, item.logged), 0)), [weeks])
  const labels = useMemo(() => labelIndices(weeks.length, plotWidth, selectedIndex), [weeks.length, plotWidth, selectedIndex])
  const years = useMemo(() => yearMarkers(labels, weeks.map((item) => item.week)), [labels, weeks])
  const y = (value: number): number => plotBottom - (value / scale.max) * plotHeight
  const rateY = (rate: number): number => plotBottom - (rate / 100) * plotHeight
  const bandX = (index: number): number => MARGIN.left + index * band
  const centerX = (index: number): number => bandX(index) + band / 2

  const baselineY = rateY(BASELINE_PERCENT)
  const baselineLabelY = baselineY - BASELINE_LABEL_GAP
  const canShowBadges = band >= BADGE_RADIUS * 2 - 2
  const canShowBarLabels = band >= MIN_BAR_LABEL_BAND
  const totalLabelY = (item: WeldWeekCounts): number => y(item.logged) - TOTAL_LABEL_GAP
  // The badge sits above the total label when there is one, otherwise just above the bar.
  const badgeCenterY = (item: WeldWeekCounts): number => (canShowBarLabels
    ? totalLabelY(item) - TEXT_HEIGHT - BADGE_GAP - BADGE_RADIUS
    : y(item.logged) - BADGE_GAP - BADGE_RADIUS)

  const ratePoints: RatePoint[] = []
  weeks.forEach((item, index) => {
    const rate = signoffRate(item)
    if (rate !== null) ratePoints.push({ index, x: centerX(index), y: rateY(rate), rate })
  })
  const labelledPoints = ratePoints.filter((point) => point.index === selectedIndex
    || (showValues && band >= MIN_RATE_LABEL_BAND))

  /** The y of every label already drawn near this week's dot. */
  function reservedYs(point: RatePoint): number[] {
    const item = weeks[point.index]
    const reserved: number[] = []
    if (canShowBarLabels) reserved.push(totalLabelY(item))
    if (canShowBadges && item.issues > 0) reserved.push(badgeCenterY(item))
    const baselineLabelLeft = plotRight - BASELINE_LABEL.length * LABEL_CHAR_WIDTH
    if (point.x + RATE_LABEL_HALF_WIDTH >= baselineLabelLeft) reserved.push(baselineLabelY)
    return reserved
  }

  /**
   * The app's avoid-overlap rule, checked against every nearby label: above the dot when that is clear, otherwise
   * below it, and when both are crowded, whichever side has more room.
   */
  function rateLabelY(point: RatePoint): number {
    const reserved = reservedYs(point)
    const room = (candidate: number): number => reserved.reduce((min, y) => Math.min(min, Math.abs(candidate - y)), Infinity)
    const above = Math.max(top + RATE_LABEL_ABOVE, point.y - RATE_LABEL_ABOVE)
    const below = Math.min(plotBottom - 5, point.y + RATE_LABEL_BELOW)
    if (room(above) >= RATE_LABEL_CLEARANCE) return above
    if (room(below) >= RATE_LABEL_CLEARANCE) return below
    return room(above) >= room(below) ? above : below
  }

  function showTooltip(index: number, event: MouseEvent<SVGRectElement>): void {
    const item = weeks[index]
    setHoverIndex(index)
    onHover({
      title: item.week.label,
      rows: [
        { label: 'Signed', value: signedOfTotal(item) },
        { label: 'Sign-off %', value: formatSignoffRate(signoffRate(item)) },
        { label: 'Issues created', value: formatCount(item.issues) },
      ],
      clientX: event.clientX,
      clientY: event.clientY,
    })
  }

  function hideTooltip(): void {
    setHoverIndex(null)
    onHover(null)
  }

  const summary = describe && weeks.length > 0
    ? `Weld sign-offs by work week, ${weeks[0].week.label} to ${weeks[weeks.length - 1].week.label}`
    : 'Weld sign-offs by work week'
  const plotMiddle = top + plotHeight / 2

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
        {scale.ticks.map((tick) => (
          <g key={tick}>
            <line x1={MARGIN.left} x2={plotRight} y1={y(tick)} y2={y(tick)} stroke={colors.grid} />
            <text className="qaqc-axis-text" x={MARGIN.left - 6} y={y(tick) + 3.5} textAnchor="end" fill={colors.axisText}>
              {formatCount(tick)}
            </text>
          </g>
        ))}
        {RATE_TICKS.map((tick) => (
          <text key={tick} className="qaqc-axis-text qaqc-rate-axis-text" x={plotRight + 6} y={rateY(tick) + 3.5} fill={colors.warn}>
            {`${tick}%`}
          </text>
        ))}
        {weeks.map((item, index) => {
          const x = bandX(index) + (band - barWidth) / 2
          const center = centerX(index)
          const totalTop = y(item.logged)
          const signedTop = y(item.signed)
          const signedHeight = plotBottom - signedTop
          const isSelected = index === selectedIndex
          const hasLabels = canShowBarLabels && item.logged > 0
          const isSignedInside = signedHeight >= MIN_INSIDE_LABEL_HEIGHT
          const signedLabelY = isSignedInside ? signedTop + SIGNED_LABEL_INSET : signedTop - SIGNED_LABEL_GAP
          // A short signed bar near the top of its total bar has no room for a label of its own.
          const hasSignedLabel = hasLabels && item.signed > 0
            && (isSignedInside || Math.abs(signedLabelY - totalLabelY(item)) >= TEXT_HEIGHT)
          return (
            <g key={item.week.key} className={hoverIndex !== null && hoverIndex !== index ? 'qaqc-bar is-dimmed' : 'qaqc-bar'}>
              {item.logged > 0 && (
                <path d={roundedTopBarPath(x, totalTop, barWidth, plotBottom - totalTop, CORNER_RADIUS)} fill={colors.series2} />
              )}
              {item.signed > 0 && (
                <path d={roundedTopBarPath(x, signedTop, barWidth, signedHeight, CORNER_RADIUS)} fill={colors.series1} />
              )}
              {hasLabels && (
                <text className="qaqc-weld-label qaqc-total-label" x={center} y={totalLabelY(item)} textAnchor="middle" fill={colors.ink}>
                  {formatCount(item.logged)}
                </text>
              )}
              {hasSignedLabel && (
                <text
                  className={isSignedInside ? 'qaqc-weld-label qaqc-signed-label is-inside' : 'qaqc-weld-label qaqc-signed-label'}
                  x={center}
                  y={signedLabelY}
                  textAnchor="middle"
                  fill={isSignedInside ? colors.card : colors.series1}
                >
                  {formatCount(item.signed)}
                </text>
              )}
              {labels.has(index) && (
                <text
                  className={isSelected ? 'qaqc-axis-text is-selected' : 'qaqc-axis-text'}
                  x={center}
                  y={plotBottom + WEEK_TICK_OFFSET}
                  textAnchor="middle"
                  fill={isSelected ? colors.ink : colors.axisText}
                >
                  {shortWeekLabel(item.week)}
                </text>
              )}
              {years.has(index) && (
                <text className="qaqc-axis-year" x={center} y={plotBottom + YEAR_MARKER_OFFSET} textAnchor="middle" fill={colors.axisText}>
                  {item.week.year}
                </text>
              )}
            </g>
          )
        })}
        <line
          className="qaqc-signoff-baseline"
          x1={MARGIN.left}
          x2={plotRight}
          y1={baselineY}
          y2={baselineY}
          stroke={colors.bad}
        />
        <path className="qaqc-rate-line" d={smoothPath(ratePoints)} fill="none" stroke={colors.warn} />
        {ratePoints.map((point) => (
          <circle
            key={`rate-${weeks[point.index].week.key}`}
            className="qaqc-rate-dot"
            cx={point.x}
            cy={point.y}
            r={RATE_DOT_RADIUS}
            fill={colors.warn}
            stroke={colors.card}
          />
        ))}
        {labelledPoints.map((point) => (
          <text
            key={`rate-label-${weeks[point.index].week.key}`}
            className="qaqc-weld-label qaqc-rate-label"
            x={point.x}
            y={rateLabelY(point)}
            textAnchor="middle"
            fill={colors.warn}
          >
            {formatSignoffRate(point.rate)}
          </text>
        ))}
        {canShowBadges && weeks.map((item, index) => (item.issues > 0
          ? (
            <g key={`issue-${item.week.key}`} className="qaqc-issue-badge" transform={`translate(${centerX(index)} ${badgeCenterY(item)})`}>
              <circle r={BADGE_RADIUS} fill={colors.bad} stroke={colors.card} strokeWidth={2} />
              <text y={3.5} textAnchor="middle" fill={colors.card}>
                {item.issues}
              </text>
            </g>
          )
          : null))}
        <text className="qaqc-baseline-label" x={plotRight} y={baselineLabelY} textAnchor="end" fill={colors.bad}>
          {BASELINE_LABEL}
        </text>
        <text
          className="qaqc-axis-title"
          x={AXIS_TITLE_INSET}
          y={plotMiddle}
          textAnchor="middle"
          transform={`rotate(-90 ${AXIS_TITLE_INSET} ${plotMiddle})`}
          fill={colors.axisText}
        >
          Weld count
        </text>
        <text
          className="qaqc-axis-title"
          x={width - AXIS_TITLE_INSET}
          y={plotMiddle}
          textAnchor="middle"
          transform={`rotate(90 ${width - AXIS_TITLE_INSET} ${plotMiddle})`}
          fill={colors.warn}
        >
          Sign-off rate
        </text>
        {hasFocus && showFocusRing && weeks.length > 0 && (
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
        <g onMouseLeave={hideTooltip}>
          {weeks.map((item, index) => (
            <rect
              key={`hit-${item.week.key}`}
              className="qaqc-hit"
              data-week={item.week.key}
              x={bandX(index)}
              y={top}
              width={band}
              height={plotHeight}
              fill="transparent"
              style={{ cursor: interactive ? 'pointer' : 'default' }}
              onMouseMove={(event) => showTooltip(index, event)}
              onClick={interactive ? () => onSelectWeek(item.week.key) : undefined}
            />
          ))}
        </g>
      </svg>
      <p className="qaqc-visually-hidden" aria-live="polite">
        {hasFocus && weeks.length > 0 ? describeWeek(weeks[focus]) : ''}
      </p>
    </>
  )
}
