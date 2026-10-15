import type { MouseEvent, ReactElement } from 'react'

import { passRateDomain } from '../chartMath'
import type { ChartColors, TooltipHandler } from '../chartTypes'
import { formatCount, formatPercent } from '../format'
import type { PassRatePoint } from '../types'

const MARGIN = { top: 14, right: 42, bottom: 10, left: 40 } as const
const DOT_RADIUS = 4
const ISSUE_LABEL_OFFSET = 10
const ISSUE_LABEL_BELOW_OFFSET = 16
const MIN_ISSUE_LABEL_SPACING = 34

export interface LineChartProps {
  points: PassRatePoint[]
  selectedKey: number
  width: number
  height: number
  colors: ChartColors
  describe: boolean
  /** Writes the pass rate beside the dot of NCR weeks. Skips the last point (the end label shows it) and any week closer than 34 px to the previous label. */
  labelIssueWeeks?: boolean
  onHover: TooltipHandler
}

export function LineChart({
  points,
  selectedKey,
  width,
  height,
  colors,
  describe,
  labelIssueWeeks = false,
  onHover,
}: LineChartProps): ReactElement {
  const plotWidth = Math.max(0, width - MARGIN.left - MARGIN.right)
  const plotHeight = Math.max(0, height - MARGIN.top - MARGIN.bottom)
  const domain = passRateDomain(points.map((item) => item.rate))
  const step = points.length > 1 ? plotWidth / (points.length - 1) : 0
  const x = (index: number): number => (points.length > 1 ? MARGIN.left + index * step : MARGIN.left + plotWidth / 2)
  const y = (rate: number): number => MARGIN.top + plotHeight - ((rate - domain.min) / (domain.max - domain.min)) * plotHeight

  let line = ''
  let previousWasNull = true
  points.forEach((item, index) => {
    if (item.rate === null) {
      previousWasNull = true
      return
    }
    line += `${previousWasNull ? 'M' : 'L'}${x(index).toFixed(2)},${y(item.rate).toFixed(2)}`
    previousWasNull = false
  })

  const hitWidth = points.length > 1 ? step : plotWidth
  const lastIndex = points.reduce((found, item, index) => (item.rate !== null ? index : found), -1)
  const selectedIndex = points.findIndex((item) => item.week.key === selectedKey)
  const ticks = [domain.min, (domain.min + domain.max) / 2, domain.max]
  const lastRate = lastIndex >= 0 ? points[lastIndex].rate : null
  const summary = describe && lastRate !== null ? `NCR pass rate trend, ending at ${formatPercent(lastRate)}` : 'NCR pass rate trend'

  const rateLabelIndices: number[] = []
  if (labelIssueWeeks) {
    let previousX = Number.NEGATIVE_INFINITY
    points.forEach((item, index) => {
      if (!item.hadIssue || item.rate === null || index === lastIndex) return
      if (x(index) - previousX < MIN_ISSUE_LABEL_SPACING) return
      rateLabelIndices.push(index)
      previousX = x(index)
    })
  }

  function showTooltip(item: PassRatePoint, event: MouseEvent<SVGRectElement>): void {
    onHover({
      title: item.week.label,
      rows: [
        { label: 'NCR pass rate', value: formatPercent(item.rate) },
        { label: 'Clean Finals', value: `${formatCount(item.cleanFinals)} / ${formatCount(item.totalFinals)}` },
      ],
      clientX: event.clientX,
      clientY: event.clientY,
    })
  }

  return (
    <svg className="qaqc-chart" width={width} height={height} role="img" aria-label={summary}>
      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(tick)} y2={y(tick)} stroke={colors.grid} />
          <text className="qaqc-axis-text" x={MARGIN.left - 6} y={y(tick) + 3.5} textAnchor="end" fill={colors.axisText}>
            {formatPercent(tick, Number.isInteger(tick) ? 0 : 1)}
          </text>
        </g>
      ))}
      {selectedIndex >= 0 && (
        <line x1={x(selectedIndex)} x2={x(selectedIndex)} y1={MARGIN.top} y2={MARGIN.top + plotHeight} stroke={colors.accent} strokeOpacity={0.35} />
      )}
      <path className="qaqc-line" d={line} fill="none" stroke={colors.series1} strokeWidth={2} strokeLinejoin="round" />
      {lastRate !== null && (
        <circle
          className="qaqc-end-dot"
          cx={x(lastIndex)}
          cy={y(lastRate)}
          r={3}
          fill={colors.series1}
          stroke={colors.card}
          strokeWidth={2}
        />
      )}
      {points.map((item, index) =>
        item.hadIssue && item.rate !== null ? (
          <circle
            key={`issue-${item.week.key}`}
            className="qaqc-issue-dot"
            cx={x(index)}
            cy={y(item.rate)}
            r={DOT_RADIUS}
            fill={colors.bad}
            stroke={colors.card}
            strokeWidth={2}
          />
        ) : null,
      )}
      {rateLabelIndices.map((index) => {
        const item = points[index]
        if (item.rate === null) return null
        const dotY = y(item.rate)
        // Near the top edge there is no room above the dot, so the label goes below it.
        const hasRoomAbove = dotY - ISSUE_LABEL_OFFSET >= MARGIN.top + ISSUE_LABEL_OFFSET
        return (
          <text
            key={`issue-rate-${item.week.key}`}
            className="qaqc-value-text qaqc-issue-rate"
            x={x(index)}
            y={hasRoomAbove ? dotY - ISSUE_LABEL_OFFSET : dotY + ISSUE_LABEL_BELOW_OFFSET}
            textAnchor="middle"
            fill={colors.ink}
          >
            {formatPercent(item.rate)}
          </text>
        )
      })}
      {lastRate !== null && (
        <text className="qaqc-value-text qaqc-end-label" x={x(lastIndex) + 6} y={y(lastRate) + 3.5} fill={colors.ink}>
          {formatPercent(lastRate)}
        </text>
      )}
      <g onMouseLeave={() => onHover(null)}>
        {points.map((item, index) => (
          <rect
            key={`hit-${item.week.key}`}
            className="qaqc-hit"
            data-week={item.week.key}
            x={x(index) - hitWidth / 2}
            y={MARGIN.top}
            width={hitWidth}
            height={plotHeight}
            fill="transparent"
            onMouseMove={(event) => showTooltip(item, event)}
          />
        ))}
      </g>
    </svg>
  )
}
