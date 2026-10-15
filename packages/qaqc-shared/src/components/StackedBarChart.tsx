import { useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent, type ReactElement } from 'react'

import { labelIndices, niceScale, roundedTopBarPath } from '../chartMath'
import type { ChartColors, TooltipHandler } from '../chartTypes'
import { formatCount } from '../format'
import type { WeekCounts } from '../types'
import { shortWeekLabel, shortWeekLabelWithYear } from '../workWeeks'

const MARGIN = { top: 22, right: 8, bottom: 24, left: 34 } as const
const MAX_BAR_WIDTH = 24
const MIN_BAR_WIDTH = 2
const BADGE_RADIUS = 8
const CORNER_RADIUS = 4
const YEAR_LABEL_WIDTH = 54
const MIN_VALUE_LABEL_BAND = 18
const VALUE_LABEL_GAP = 4
const BADGE_LABEL_GAP = 3

export interface StackedBarChartProps {
  weeks: WeekCounts[]
  selectedKey: number
  width: number
  height: number
  colors: ChartColors
  interactive: boolean
  animate: boolean
  describe: boolean
  /** Writes each week's Finals + SORs total above its bar. Skipped when bars are narrower than 18 px. */
  showValues?: boolean
  onSelectWeek: (key: number) => void
  onHover: TooltipHandler
}

function describeWeek(item: WeekCounts): string {
  return `${item.week.label}: ${formatCount(item.finals)} Finals, ${formatCount(item.sors)} SORs, ${formatCount(item.issuesFound)} issues found`
}

export function StackedBarChart({
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
}: StackedBarChartProps): ReactElement {
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

  const plotWidth = Math.max(0, width - MARGIN.left - MARGIN.right)
  const plotHeight = Math.max(0, height - MARGIN.top - MARGIN.bottom)
  const band = weeks.length > 0 ? plotWidth / weeks.length : plotWidth
  const barWidth = Math.min(MAX_BAR_WIDTH, Math.max(MIN_BAR_WIDTH, band * 0.68))
  const scale = useMemo(() => niceScale(weeks.reduce((max, item) => Math.max(max, item.finals + item.sors), 0)), [weeks])
  const spansYears = weeks.length > 0 && weeks[0].week.year !== weeks[weeks.length - 1].week.year
  const labels = useMemo(
    () => (spansYears
      ? labelIndices(weeks.length, plotWidth, selectedIndex, YEAR_LABEL_WIDTH)
      : labelIndices(weeks.length, plotWidth, selectedIndex)),
    [weeks.length, plotWidth, selectedIndex, spansYears],
  )
  const focus = Math.min(Math.max(focusIndex, 0), weeks.length - 1)
  const y = (value: number): number => MARGIN.top + plotHeight - (value / scale.max) * plotHeight
  const bandX = (index: number): number => MARGIN.left + index * band

  function showTooltip(index: number, event: MouseEvent<SVGRectElement>): void {
    const item = weeks[index]
    setHoverIndex(index)
    onHover({
      title: item.week.label,
      rows: [
        { label: 'Finals', value: formatCount(item.finals) },
        { label: 'SORs', value: formatCount(item.sors) },
        { label: 'Issues found', value: formatCount(item.issuesFound) },
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
    ? `Finals and SORs by work week, ${weeks[0].week.label} to ${weeks[weeks.length - 1].week.label}`
    : 'Finals and SORs by work week'
  const canShowBadges = band >= BADGE_RADIUS * 2 - 2
  const canShowValues = showValues && band >= MIN_VALUE_LABEL_BAND

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
            y={MARGIN.top}
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
          const finalsTop = y(item.finals)
          const totalTop = y(item.finals + item.sors)
          const isSelected = index === selectedIndex
          const total = item.finals + item.sors
          const hasBadge = canShowBadges && item.issuesFound > 0
          const badgeCenterY = Math.max(BADGE_RADIUS + 1, totalTop - BADGE_RADIUS - 4)
          const valueY = hasBadge ? badgeCenterY - BADGE_RADIUS - BADGE_LABEL_GAP : totalTop - VALUE_LABEL_GAP
          return (
            <g key={item.week.key} className={hoverIndex !== null && hoverIndex !== index ? 'qaqc-bar is-dimmed' : 'qaqc-bar'}>
              {item.sors > 0 && (
                <path d={roundedTopBarPath(x, totalTop, barWidth, finalsTop - totalTop, CORNER_RADIUS)} fill={colors.series2} />
              )}
              {item.finals > 0 && (item.sors > 0
                ? <rect x={x} y={finalsTop} width={barWidth} height={y(0) - finalsTop} fill={colors.series1} />
                : <path d={roundedTopBarPath(x, finalsTop, barWidth, y(0) - finalsTop, CORNER_RADIUS)} fill={colors.series1} />)}
              {hasBadge && (
                <g className="qaqc-issue-badge" transform={`translate(${x + barWidth / 2} ${badgeCenterY})`}>
                  <circle r={BADGE_RADIUS} fill={colors.bad} stroke={colors.card} strokeWidth={2} />
                  <text y={3.5} textAnchor="middle" fill={colors.card}>
                    {item.issuesFound}
                  </text>
                </g>
              )}
              {canShowValues && total > 0 && (
                <text
                  className="qaqc-value-text qaqc-bar-value"
                  x={bandX(index) + band / 2}
                  y={valueY}
                  textAnchor="middle"
                  fill={colors.ink}
                >
                  {formatCount(total)}
                </text>
              )}
              {labels.has(index) && (
                <text
                  className={isSelected ? 'qaqc-axis-text is-selected' : 'qaqc-axis-text'}
                  x={bandX(index) + band / 2}
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
            x={bandX(focus) + 1}
            y={MARGIN.top - 2}
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
              y={MARGIN.top}
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
