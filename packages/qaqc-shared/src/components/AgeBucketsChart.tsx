import { useMemo, useState, type KeyboardEvent, type MouseEvent, type ReactElement } from 'react'

import { createLabelPlacer, labelBox, labelTextWidth, type LabelBox } from '../chartLabels'
import { LINE_DASH, niceScale, roundedTopBarPath } from '../chartMath'
import type { ChartColors, TooltipHandler, TooltipRow } from '../chartTypes'
import { formatCount } from '../format'
import type { AgeBucket, AgeBucketTone, IssueBenchmarks } from '../issueBenchmarks'
import type { LegendItem } from './ChartPanel'

// "How old are the open issues?" on the Issue Aging page: the open issues as of W in age buckets, over a band for the
// normal close window and a marker at the typical close time. A bucket with issues is a button that opens its list.

/** Room under the chart for the one-line caption. */
const CAPTION_HEIGHT = 24
/** The band's two-line label sits above the plot; the tallest bar's count label clears it. */
const MARGIN = { top: 56, right: 12, bottom: 42, left: 38 } as const
const BAND_TOP = 6
const BAND_TITLE_Y = 20
const BAND_TEXT_Y = 35
const BAND_TEXT_INSET = 10
const BAR_RATIO = 0.5
const MAX_BAR_WIDTH = 64
const CORNER_RADIUS = 5
const COUNT_GAP = 7
const BUCKET_LABEL_OFFSET = 16
const BUCKET_RANGE_OFFSET = 30
const Y_TITLE_X = 12
/** Font sizes of the count labels and bucket names, against the 9.5 px LABEL_METRICS digits. */
const COUNT_FONT_SCALE = 12 / 9.5
const BUCKET_FONT_SCALE = 11 / 9.5
/** Space kept between neighbouring bucket names. */
const BUCKET_LABEL_GAP = 6
/** The open-ended last bucket is drawn as a year wide when placing a day inside it. */
const OPEN_ENDED_SPAN = 365
const TYPICAL_LABEL_GAP = 5
const HOVER_INSET = 2

export function ageBucketsLegend(colors: ChartColors, hasWindow: boolean): LegendItem[] {
  if (!hasWindow) return [{ label: 'Open issues', color: colors.series1, shape: 'bar' }]
  return [
    { label: 'Inside the normal close window', color: colors.good, shape: 'bar' },
    { label: 'Past the normal close window', color: colors.bad, shape: 'bar' },
    { label: 'Typical close time', color: colors.ink, shape: 'dashed' },
  ]
}

/** The sentence under the chart. */
export function agingCaption(benchmarks: IssueBenchmarks): string {
  const open = benchmarks.open.length
  if (open === 0) return 'No issues are open.'
  if (benchmarks.window === null) return `${formatCount(open)} open issues; nothing has closed yet, so there is no normal close window.`
  if (benchmarks.pastWindow === open) return `All ${formatCount(open)} open issues are older than the normal close window.`
  if (benchmarks.pastWindow === 0) return `All ${formatCount(open)} open issues are still inside the normal close window.`
  return `${formatCount(benchmarks.pastWindow)} of ${formatCount(open)} open issues are older than the normal close window.`
}

function toneColor(tone: AgeBucketTone, colors: ChartColors): string {
  switch (tone) {
    case 'good':
      return colors.good
    case 'warn':
      return colors.warn
    case 'bad':
      return colors.bad
    case 'neutral':
      return colors.series1
    default: {
      const unreachable: never = tone
      return unreachable
    }
  }
}

const days = (value: number): string => `${Number.isInteger(value) ? value : value.toFixed(1)} d`

/** A bucket's day range in its short form, such as `30–77 d`. */
function shortRange(bucket: AgeBucket): string {
  return bucket.range.replace(/ days$/, ' d')
}

function bucketBounds(bucket: AgeBucket): { min: number; span: number } {
  const [minText, maxText] = bucket.key.replace('+', '').split('-')
  const min = Number(minText)
  return { min, span: maxText === undefined ? OPEN_ENDED_SPAN : Number(maxText) - min + 1 }
}

function oldestText(bucket: AgeBucket): string {
  if (bucket.issues.length === 0) return 'none'
  const oldestAge = bucket.issues[0].age
  const oldest = bucket.issues.filter((open) => open.age === oldestAge).map((open) => open.issue.id)
  const shown = oldest.slice(0, 3).join(', ')
  return `${shown}${oldest.length > 3 ? ` +${oldest.length - 3}` : ''} (${days(oldestAge)})`
}

export interface AgeBucketsChartProps {
  benchmarks: IssueBenchmarks
  /** From `ageBuckets(benchmarks)`. */
  buckets: AgeBucket[]
  width: number
  height: number
  colors: ChartColors
  onHover: TooltipHandler
  /** Opens the issue list for a bucket key. Buckets with no issues never call it. */
  onOpenBucket: (key: string) => void
}

interface BucketsLayout {
  plotLeft: number
  plotRight: number
  plotTop: number
  plotBottom: number
  slot: number
  barWidth: number
  scaleTicks: number[]
  y: (count: number) => number
  /** The x of the start of a day (or a fractional day) inside its bucket's slot. */
  xOfDay: (day: number) => number
  /** Bucket names under the axis: the full names with their ranges, or the short ranges when the names do not fit. */
  isShort: boolean
  typicalLabel: { x: number; y: number } | null
}

function layoutBuckets(benchmarks: IssueBenchmarks, buckets: AgeBucket[], width: number, chartHeight: number): BucketsLayout {
  const plotLeft = MARGIN.left
  const plotRight = Math.max(plotLeft, width - MARGIN.right)
  const plotTop = MARGIN.top
  const plotBottom = Math.max(plotTop, chartHeight - MARGIN.bottom)
  const slot = buckets.length > 0 ? (plotRight - plotLeft) / buckets.length : 0
  const barWidth = Math.min(MAX_BAR_WIDTH, slot * BAR_RATIO)
  const scale = niceScale(buckets.reduce((max, bucket) => Math.max(max, bucket.count), 0), 4)
  const y = (count: number): number => plotBottom - (count / scale.max) * (plotBottom - plotTop)
  const bounds = buckets.map(bucketBounds)

  function xOfDay(day: number): number {
    let at = buckets.length - 1
    while (at > 0 && day < bounds[at].min) at -= 1
    const { min, span } = bounds[at]
    return plotLeft + slot * (at + Math.min(1, Math.max(0, (day - min) / span)))
  }

  const fits = (text: string, fontScale: number): boolean => labelTextWidth(text) * fontScale + BUCKET_LABEL_GAP <= slot
  const isShort = !buckets.every((bucket) => fits(bucket.label, BUCKET_FONT_SCALE) && fits(bucket.range, 1))

  // The typical label takes the first spot clear of the count labels and the band's label.
  let typicalLabel: { x: number; y: number } | null = null
  if (benchmarks.typical !== null && benchmarks.window !== null) {
    const text = `typical: ${days(benchmarks.typical)}`
    const markerX = xOfDay(benchmarks.typical)
    const half = labelTextWidth(text) / 2
    const blocked: LabelBox[] = buckets.map((bucket, at) => {
      const box = labelBox(formatCount(bucket.count), plotLeft + slot * (at + 0.5), y(bucket.count) - COUNT_GAP)
      const grow = (box.right - box.left) * (COUNT_FONT_SCALE - 1) / 2
      return { ...box, left: box.left - grow, right: box.right + grow, top: box.top - 3 }
    })
    const placer = createLabelPlacer({ bounds: { left: plotLeft, right: plotRight, top: plotTop - 4, bottom: plotBottom }, blocked })
    const rows = [plotTop + 6, plotTop + 22, plotTop + 38]
    const candidates = rows.flatMap((row) => [
      { x: markerX + TYPICAL_LABEL_GAP + half, y: row },
      { x: markerX - TYPICAL_LABEL_GAP - half, y: row },
    ])
    typicalLabel = placer.place(text, candidates)
  }

  return { plotLeft, plotRight, plotTop, plotBottom, slot, barWidth, scaleTicks: scale.ticks, y, xOfDay, isShort, typicalLabel }
}

export function AgeBucketsChart({ benchmarks, buckets, width, height, colors, onHover, onOpenBucket }: AgeBucketsChartProps): ReactElement {
  const [hoverKey, setHoverKey] = useState<string | null>(null)
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const chartHeight = Math.max(0, height - CAPTION_HEIGHT)
  const layout = useMemo(() => layoutBuckets(benchmarks, buckets, width, chartHeight), [benchmarks, buckets, width, chartHeight])
  const { plotLeft, plotRight, plotTop, plotBottom, slot, barWidth, y } = layout
  const { window, typical } = benchmarks
  const caption = agingCaption(benchmarks)
  const hasWindow = window !== null
  const bandRight = window === null ? plotLeft : layout.xOfDay(window + 1)
  const plotMiddle = (plotTop + plotBottom) / 2

  function showTooltip(bucket: AgeBucket, event: MouseEvent<SVGGElement>): void {
    setHoverKey(bucket.key)
    const rows: TooltipRow[] = [
      { label: 'Open issues', value: formatCount(bucket.count) },
      { label: 'Oldest', value: oldestText(bucket) },
    ]
    if (bucket.count > 0) rows.push({ label: 'Click to view these issues', value: '' })
    onHover({ title: `${bucket.label} (${bucket.range})`, rows, clientX: event.clientX, clientY: event.clientY })
  }

  function onKeyDown(event: KeyboardEvent<SVGGElement>, bucket: AgeBucket): void {
    if ((event.key !== 'Enter' && event.key !== ' ') || bucket.count === 0) return
    event.preventDefault()
    onOpenBucket(bucket.key)
  }

  return (
    <>
      <svg
        className="qaqc-chart qaqc-aging-buckets"
        width={width}
        height={chartHeight}
        role="group"
        aria-label={`How old are the open issues, as of ${benchmarks.asOf.label}. ${caption}`}
      >
        {hasWindow && bandRight > plotLeft && (
          <g pointerEvents="none">
            <rect
              className="qaqc-aging-band"
              x={plotLeft}
              y={BAND_TOP}
              width={bandRight - plotLeft}
              height={plotBottom - BAND_TOP}
              rx={6}
              fill={colors.good}
              fillOpacity={0.08}
            />
            <line x1={bandRight} x2={bandRight} y1={BAND_TOP} y2={plotBottom} stroke={colors.good} strokeWidth={1.5} strokeDasharray={LINE_DASH} />
            <text className="qaqc-aging-band-label is-title" x={plotLeft + BAND_TEXT_INSET} y={BAND_TITLE_Y} fill={colors.good}>
              Normal close window
            </text>
            <text className="qaqc-aging-band-label" x={plotLeft + BAND_TEXT_INSET} y={BAND_TEXT_Y} fill={colors.ink}>
              {`90% of issues close within ${formatCount(window)} days`}
            </text>
          </g>
        )}
        {layout.scaleTicks.map((tick) => (
          <g key={tick} pointerEvents="none">
            <line className="qaqc-grid-line" x1={plotLeft} x2={plotRight} y1={y(tick)} y2={y(tick)} stroke={colors.grid} />
            <text className="qaqc-axis-text" x={plotLeft - 8} y={y(tick) + 3.5} textAnchor="end" fill={colors.axisText}>
              {formatCount(tick)}
            </text>
          </g>
        ))}
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
        <line x1={plotLeft} x2={plotRight} y1={plotBottom} y2={plotBottom} stroke={colors.ink} strokeOpacity={0.3} />
        {typical !== null && layout.typicalLabel !== null && (
          <g pointerEvents="none">
            <line
              x1={layout.xOfDay(typical)}
              x2={layout.xOfDay(typical)}
              y1={plotTop - 4}
              y2={plotBottom}
              stroke={colors.ink}
              strokeOpacity={0.7}
              strokeWidth={1.25}
              strokeDasharray="3 3"
            />
            <text
              className="qaqc-aging-label qaqc-aging-typical-label"
              x={layout.typicalLabel.x}
              y={layout.typicalLabel.y}
              textAnchor="middle"
              fill={colors.ink}
            >
              {`typical: ${days(typical)}`}
            </text>
          </g>
        )}
        <g
          onMouseLeave={() => {
            setHoverKey(null)
            onHover(null)
          }}
        >
          {buckets.map((bucket, at) => {
            const center = plotLeft + slot * (at + 0.5)
            const top = y(bucket.count)
            const fill = toneColor(bucket.tone, colors)
            const isClickable = bucket.count > 0
            const isActive = isClickable && (hoverKey === bucket.key || focusKey === bucket.key)
            const barLeft = center - barWidth / 2
            return (
              <g
                key={bucket.key}
                className={isClickable ? 'qaqc-aging-bucket is-clickable' : 'qaqc-aging-bucket'}
                role={isClickable ? 'button' : 'img'}
                tabIndex={isClickable ? 0 : undefined}
                aria-label={isClickable
                  ? `${bucket.label}: ${formatCount(bucket.count)} open issues. Press Enter to view them.`
                  : `${bucket.label}: no open issues`}
                onClick={isClickable ? () => onOpenBucket(bucket.key) : undefined}
                onKeyDown={(event) => onKeyDown(event, bucket)}
                onFocus={() => setFocusKey(bucket.key)}
                onBlur={() => setFocusKey(null)}
                onMouseMove={(event) => showTooltip(bucket, event)}
              >
                <rect
                  className="qaqc-aging-bucket-hit"
                  x={plotLeft + at * slot + HOVER_INSET}
                  y={plotTop - 8}
                  width={Math.max(0, slot - HOVER_INSET * 2)}
                  height={plotBottom - plotTop + MARGIN.bottom}
                  rx={8}
                  fill={isActive ? colors.accent : 'transparent'}
                  fillOpacity={isActive ? 0.06 : 1}
                />
                {isClickable && (
                  <path className="qaqc-aging-bar" d={roundedTopBarPath(barLeft, top, barWidth, plotBottom - top, CORNER_RADIUS)} fill={fill} />
                )}
                {isActive && (
                  <path
                    className="qaqc-aging-bar-outline"
                    d={roundedTopBarPath(barLeft - 3, top - 3, barWidth + 6, plotBottom - top + 3, CORNER_RADIUS + 2)}
                    fill="none"
                    stroke={colors.ink}
                    strokeWidth={1.75}
                  />
                )}
                <text
                  className="qaqc-aging-count"
                  x={center}
                  y={top - (isActive ? COUNT_GAP + 3 : COUNT_GAP)}
                  textAnchor="middle"
                  fill={isClickable ? fill : colors.axisText}
                >
                  {formatCount(bucket.count)}
                </text>
                <text className="qaqc-aging-bucket-label" x={center} y={plotBottom + BUCKET_LABEL_OFFSET} textAnchor="middle" fill={colors.ink}>
                  {layout.isShort ? shortRange(bucket) : bucket.label}
                </text>
                {!layout.isShort && (
                  <text className="qaqc-aging-bucket-range" x={center} y={plotBottom + BUCKET_RANGE_OFFSET} textAnchor="middle" fill={colors.axisText}>
                    {bucket.range}
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </svg>
      <p className={benchmarks.pastWindow > 0 ? 'qaqc-aging-caption is-bad' : 'qaqc-aging-caption'}>
        {caption}
        {benchmarks.open.length > 0 && <span className="qaqc-aging-caption-hint"> Click a bar to see its issues.</span>}
      </p>
    </>
  )
}
