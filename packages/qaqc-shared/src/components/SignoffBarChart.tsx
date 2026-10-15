import { useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent, type ReactElement } from 'react'

import { labelIndices, niceScale, roundedTopBarPath } from '../chartMath'
import type { ChartColors, TooltipHandler } from '../chartTypes'
import { formatCount, formatPercent, pluralize } from '../format'
import type { WeldWeekCounts } from '../types'
import { shortWeekLabel, shortWeekLabelWithYear } from '../workWeeks'

const MARGIN = { right: 8, bottom: 24, left: 34 } as const
const MAX_BAR_WIDTH = 24
const MIN_BAR_WIDTH = 2
const BADGE_RADIUS = 8
const CORNER_RADIUS = 4
const YEAR_LABEL_WIDTH = 54
/** Sign-off below this percent is flagged red. */
const BASELINE_PERCENT = 10
const MIN_RATE_LABEL_BAND = 26
// Each label stacks above the one below it: rate label, then badge, then value label.
const RATE_LABEL_GAP = 4
const TEXT_HEIGHT = 10
const BADGE_GAP = 2
const VALUE_LABEL_GAP = 3
const RATE_LABEL_SPACE = RATE_LABEL_GAP + TEXT_HEIGHT
const BADGE_SPACE = BADGE_GAP + BADGE_RADIUS * 2
const VALUE_LABEL_SPACE = VALUE_LABEL_GAP + TEXT_HEIGHT + 1
const TOP = RATE_LABEL_SPACE + BADGE_SPACE + 2
const TOP_WITH_VALUES = TOP + VALUE_LABEL_SPACE
/** Approximate width of one 10.5 px value-label character. */
const CHAR_WIDTH = 6.4

export interface SignoffBarChartProps {
  weeks: WeldWeekCounts[]
  selectedKey: number
  width: number
  height: number
  colors: ChartColors
  interactive: boolean
  animate: boolean
  describe: boolean
  /** Writes each week's signed / total above its bar when the band is wide enough for the text. */
  showValues?: boolean
  onSelectWeek: (key: number) => void
  onHover: TooltipHandler
}

function signoffRate(item: WeldWeekCounts): number | null {
  return item.logged === 0 ? null : (item.signed / item.logged) * 100
}

/** Whole percent, with one decimal under 10% so a red label never rounds up to read 10%. */
function rateLabel(rate: number): string {
  return formatPercent(rate, rate < BASELINE_PERCENT && rate > 0 ? 1 : 0)
}

function signedOfTotal(item: WeldWeekCounts): string {
  return `${formatCount(item.signed)} of ${formatCount(item.logged)}`
}

function describeWeek(item: WeldWeekCounts): string {
  const issues = `${formatCount(item.issues)} ${pluralize(item.issues, 'issue', 'issues')}`
  return `${item.week.label}: ${signedOfTotal(item)} welds signed (${formatPercent(signoffRate(item))}), ${issues}`
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
  const [focusIndex, setFocusIndex] = useState(selectedIndex >= 0 ? selectedIndex : weeks.length - 1)
  const [hasFocus, setHasFocus] = useState(false)
  const [showFocusRing, setShowFocusRing] = useState(false)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  useEffect(() => {
    if (selectedIndex >= 0) setFocusIndex(selectedIndex)
  }, [selectedIndex])

  useEffect(() => {
    setHoverIndex(null)
  }, [weeks])

  const top = showValues ? TOP_WITH_VALUES : TOP
  const plotWidth = Math.max(0, width - MARGIN.left - MARGIN.right)
  const plotHeight = Math.max(0, height - top - MARGIN.bottom)
  const band = weeks.length > 0 ? plotWidth / weeks.length : plotWidth
  const barWidth = Math.min(MAX_BAR_WIDTH, Math.max(MIN_BAR_WIDTH, band * 0.68))
  const scale = useMemo(() => niceScale(weeks.reduce((max, item) => Math.max(max, item.logged), 0)), [weeks])
  const spansYears = weeks.length > 0 && weeks[0].week.year !== weeks[weeks.length - 1].week.year
  const labels = useMemo(
    () => (spansYears
      ? labelIndices(weeks.length, plotWidth, selectedIndex, YEAR_LABEL_WIDTH)
      : labelIndices(weeks.length, plotWidth, selectedIndex)),
    [weeks.length, plotWidth, selectedIndex, spansYears],
  )
  const focus = Math.min(Math.max(focusIndex, 0), weeks.length - 1)
  const y = (value: number): number => top + plotHeight - (value / scale.max) * plotHeight
  const bandX = (index: number): number => MARGIN.left + index * band

  function showTooltip(index: number, event: MouseEvent<SVGRectElement>): void {
    const item = weeks[index]
    setHoverIndex(index)
    onHover({
      title: item.week.label,
      rows: [
        { label: 'Signed', value: signedOfTotal(item) },
        { label: 'Sign-off %', value: formatPercent(signoffRate(item)) },
        { label: 'Issues', value: formatCount(item.issues) },
      ],
      clientX: event.clientX,
      clientY: event.clientY,
    })
  }

  function hideTooltip(): void {
    setHoverIndex(null)
    onHover(null)
  }

  function handleKeyDown(event: KeyboardEvent<SVGSVGElement>): void {
    if (weeks.length === 0) return
    const targets: Record<string, number> = {
      ArrowLeft: focus - 1,
      ArrowRight: focus + 1,
      Home: 0,
      End: weeks.length - 1,
    }
    const target = targets[event.key]
    if (target !== undefined) {
      event.preventDefault()
      setShowFocusRing(true)
      setFocusIndex(Math.min(Math.max(target, 0), weeks.length - 1))
      return
    }
    if ((event.key === 'Enter' || event.key === ' ') && interactive) {
      event.preventDefault()
      setShowFocusRing(true)
      onSelectWeek(weeks[focus].week.key)
    }
  }

  const summary = describe && weeks.length > 0
    ? `Weld sign-offs by work week, ${weeks[0].week.label} to ${weeks[weeks.length - 1].week.label}`
    : 'Weld sign-offs by work week'
  const canShowBadges = band >= BADGE_RADIUS * 2 - 2
  const canShowRates = band >= MIN_RATE_LABEL_BAND

  return (
    <>
      <svg
        className={animate ? 'qaqc-chart qaqc-animate' : 'qaqc-chart'}
        width={width}
        height={height}
        role="group"
        aria-label={summary}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onFocus={() => setHasFocus(true)}
        onBlur={() => {
          setHasFocus(false)
          setShowFocusRing(false)
        }}
        onMouseDown={() => setShowFocusRing(false)}
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
            <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(tick)} y2={y(tick)} stroke={colors.grid} />
            <text className="qaqc-axis-text" x={MARGIN.left - 6} y={y(tick) + 3.5} textAnchor="end" fill={colors.axisText}>
              {formatCount(tick)}
            </text>
          </g>
        ))}
        {weeks.map((item, index) => {
          const x = bandX(index) + (band - barWidth) / 2
          const center = bandX(index) + band / 2
          const signedTop = y(item.signed)
          const totalTop = y(item.logged)
          const isSelected = index === selectedIndex
          const rate = signoffRate(item)
          const isLow = rate !== null && rate < BASELINE_PERCENT
          const tickValue = item.logged * (BASELINE_PERCENT / 100)
          const valueText = `${formatCount(item.signed)} / ${formatCount(item.logged)}`
          const hasRate = canShowRates && rate !== null
          const hasBadge = canShowBadges && item.issues > 0
          const hasValue = showValues && item.logged > 0 && valueText.length * CHAR_WIDTH <= band - 2
          // Walk upward from the bar top, placing each label above the previous one.
          let cursor = totalTop
          const rateY = cursor - RATE_LABEL_GAP
          if (hasRate) cursor = rateY - TEXT_HEIGHT
          const badgeCenterY = cursor - BADGE_GAP - BADGE_RADIUS
          if (hasBadge) cursor = badgeCenterY - BADGE_RADIUS
          const valueY = cursor - VALUE_LABEL_GAP
          return (
            <g key={item.week.key} className={hoverIndex !== null && hoverIndex !== index ? 'qaqc-bar is-dimmed' : 'qaqc-bar'}>
              {item.logged > item.signed && (
                <path d={roundedTopBarPath(x, totalTop, barWidth, signedTop - totalTop, CORNER_RADIUS)} fill={colors.series2} />
              )}
              {item.signed > 0 && (item.logged > item.signed
                ? <rect x={x} y={signedTop} width={barWidth} height={y(0) - signedTop} fill={colors.series1} />
                : <path d={roundedTopBarPath(x, signedTop, barWidth, y(0) - signedTop, CORNER_RADIUS)} fill={colors.series1} />)}
              {item.logged > 0 && (
                <line
                  className="qaqc-baseline-tick"
                  x1={x}
                  x2={x + barWidth}
                  y1={y(tickValue)}
                  y2={y(tickValue)}
                  // The tick sits on the dark signed fill unless sign-off is under 10%.
                  stroke={item.signed >= tickValue ? colors.card : colors.ink}
                />
              )}
              {hasRate && (
                <text
                  className={isLow ? 'qaqc-value-text qaqc-rate-label is-low' : 'qaqc-value-text qaqc-rate-label'}
                  x={center}
                  y={rateY}
                  textAnchor="middle"
                  fill={isLow ? colors.bad : colors.ink}
                >
                  {rateLabel(rate)}
                </text>
              )}
              {hasBadge && (
                <g className="qaqc-issue-badge" transform={`translate(${x + barWidth / 2} ${badgeCenterY})`}>
                  <circle r={BADGE_RADIUS} fill={colors.bad} stroke={colors.card} strokeWidth={2} />
                  <text y={3.5} textAnchor="middle" fill={colors.card}>
                    {item.issues}
                  </text>
                </g>
              )}
              {hasValue && (
                <text className="qaqc-value-text qaqc-bar-value" x={center} y={valueY} textAnchor="middle" fill={colors.ink}>
                  {valueText}
                </text>
              )}
              {labels.has(index) && (
                <text
                  className={isSelected ? 'qaqc-axis-text is-selected' : 'qaqc-axis-text'}
                  x={center}
                  y={height - 8}
                  textAnchor="middle"
                  fill={isSelected ? colors.ink : colors.axisText}
                >
                  {spansYears ? shortWeekLabelWithYear(item.week) : shortWeekLabel(item.week)}
                </text>
              )}
            </g>
          )
        })}
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
