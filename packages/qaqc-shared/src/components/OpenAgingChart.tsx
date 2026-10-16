import type { MouseEvent, ReactElement } from 'react'

import { niceScale, ordinalOpacity, roundedTopBarPath } from '../chartMath'
import type { ChartColors, TooltipHandler } from '../chartTypes'
import { formatCount } from '../format'
import { compositeOver, contrastRatio } from '../theme'
import type { AgingBucket } from '../types'

// Matches the HTML app's OpenAgingChart.
const MARGIN = { top: 22, right: 18, bottom: 38, left: 48 } as const
const BAR_RATIO = 0.56
const MAX_BAR_WIDTH = 72
const CORNER_RADIUS = 5
/** A bucket with any issues is drawn at least this tall. */
const MIN_BAR_HEIGHT = 2
/** A bar at least this tall carries its label inside. */
const MIN_INSIDE_LABEL_HEIGHT = 24
const INSIDE_LABEL_INSET = 17
const ABOVE_LABEL_GAP = 7
const MIN_LABEL_Y = 14
const BUCKET_LABEL_RISE = 20
const X_TITLE_RISE = 4
const Y_TITLE_X = 13
const TITLE = 'Open issue aging by weeks'

export interface OpenAgingChartProps {
  /** `0-1` to `4+` weeks, youngest first. */
  buckets: AgingBucket[]
  width: number
  height: number
  colors: ChartColors
  /** Draws every bucket in the foreground colour instead of the ramp. */
  isHighContrast: boolean
  describe: boolean
  onHover: TooltipHandler
}

export function OpenAgingChart({ buckets, width, height, colors, isHighContrast, describe, onHover }: OpenAgingChartProps): ReactElement {
  const plotRight = width - MARGIN.right
  const plotWidth = Math.max(0, plotRight - MARGIN.left)
  const plotHeight = Math.max(0, height - MARGIN.top - MARGIN.bottom)
  const plotBottom = MARGIN.top + plotHeight
  const band = buckets.length > 0 ? plotWidth / buckets.length : plotWidth
  const barWidth = Math.min(MAX_BAR_WIDTH, band * BAR_RATIO)
  const scale = niceScale(buckets.reduce((max, bucket) => Math.max(max, bucket.count), 0))
  const y = (value: number): number => plotBottom - (value / scale.max) * plotHeight
  const plotMiddle = MARGIN.top + plotHeight / 2
  const summary = describe
    ? `${TITLE}: ${buckets.map((bucket) => `${bucket.label} weeks ${formatCount(bucket.count)}`).join(', ')}`
    : TITLE

  function showTooltip(bucket: AgingBucket, event: MouseEvent<SVGRectElement>): void {
    onHover({
      title: `${bucket.label} weeks`,
      rows: [{ label: 'Open issues', value: formatCount(bucket.count) }],
      clientX: event.clientX,
      clientY: event.clientY,
    })
  }

  return (
    <svg className="qaqc-chart" width={width} height={height} role="img" aria-label={summary}>
      {scale.ticks.map((tick) => (
        <g key={tick}>
          <line className="qaqc-grid-line" x1={MARGIN.left} x2={plotRight} y1={y(tick)} y2={y(tick)} stroke={colors.grid} />
          <text className="qaqc-axis-text" x={MARGIN.left - 8} y={y(tick) + 3.5} textAnchor="end" fill={colors.axisText}>
            {formatCount(tick)}
          </text>
        </g>
      ))}
      {buckets.map((bucket, index) => {
        const x = MARGIN.left + index * band + (band - barWidth) / 2
        const center = x + barWidth / 2
        const barHeight = bucket.count > 0 ? Math.max(MIN_BAR_HEIGHT, (bucket.count / scale.max) * plotHeight) : 0
        const top = plotBottom - barHeight
        const opacity = isHighContrast ? 1 : ordinalOpacity(index, buckets.length)
        const isInside = barHeight >= MIN_INSIDE_LABEL_HEIGHT
        // A label inside the bar takes whichever of ink or card reads better on the bar as drawn over the card. The
        // composite is over the solid card colour: a see-through card (Format pane cardOpacity) is not accounted for.
        const barColor = compositeOver(colors.series1, opacity, colors.card)
        const insideFill = contrastRatio(colors.ink, barColor) > contrastRatio(colors.card, barColor) ? colors.ink : colors.card
        return (
          <g key={bucket.label}>
            {barHeight > 0 && (
              <path
                className="qaqc-open-aging-bar"
                d={roundedTopBarPath(x, top, barWidth, barHeight, CORNER_RADIUS)}
                fill={colors.series1}
                fillOpacity={opacity}
              />
            )}
            <text
              className={isInside ? 'qaqc-open-aging-value is-inside' : 'qaqc-open-aging-value'}
              x={center}
              y={isInside ? top + INSIDE_LABEL_INSET : Math.max(MIN_LABEL_Y, top - ABOVE_LABEL_GAP)}
              textAnchor="middle"
              fill={isInside ? insideFill : colors.ink}
            >
              {formatCount(bucket.count)}
            </text>
            <text className="qaqc-open-aging-bucket" x={center} y={height - BUCKET_LABEL_RISE} textAnchor="middle" fill={colors.ink}>
              {bucket.label}
            </text>
          </g>
        )
      })}
      <text
        className="qaqc-axis-title"
        x={Y_TITLE_X}
        y={plotMiddle}
        textAnchor="middle"
        transform={`rotate(-90 ${Y_TITLE_X} ${plotMiddle})`}
        fill={colors.axisText}
      >
        Open issues
      </text>
      <text className="qaqc-axis-title" x={MARGIN.left + plotWidth / 2} y={height - X_TITLE_RISE} textAnchor="middle" fill={colors.axisText}>
        Weeks
      </text>
      <g onMouseLeave={() => onHover(null)}>
        {buckets.map((bucket, index) => (
          <rect
            key={bucket.label}
            className="qaqc-hit"
            x={MARGIN.left + index * band}
            y={MARGIN.top}
            width={band}
            height={plotHeight}
            fill="transparent"
            onMouseMove={(event) => showTooltip(bucket, event)}
          />
        ))}
      </g>
    </svg>
  )
}
