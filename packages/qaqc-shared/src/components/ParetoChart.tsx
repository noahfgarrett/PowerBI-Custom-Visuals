import { useMemo, type MouseEvent, type ReactElement } from 'react'

import { boxesOverlap, LABEL_GAP, LABEL_METRICS, type LabelBox } from '../chartLabels'
import { LINE_DASH, niceScale, round, roundedTopBarPath, truncateLabel, type NiceScale, type PlotPoint } from '../chartMath'
import type { ChartColors, TooltipHandler, TooltipRow } from '../chartTypes'
import { formatCount, formatPercent, pluralize } from '../format'
import { useWeekFocus } from '../hooks/useWeekFocus'
import type { ParetoBar } from '../rootCauses'
import { compositeOver } from '../theme'

// The Issues by Root Cause Pareto chart: one bar per cause, largest first, on a left count axis, with the cumulative
// percent as a line on a right 0–100% axis and a dashed 80% line. Not recorded sits last, after a gap, and stays out
// of the line.

const MARGIN = { top: 24, right: 46, bottom: 46, left: 40 } as const
const BAR_RATIO = 0.62
const MAX_BAR_WIDTH = 58
const CORNER_RADIUS = 4
/** Not recorded sits this many bands further right, past a dotted divider. */
const NOT_RECORDED_GAP = 0.45
const VITAL_PERCENT = 80
const PERCENT_TICKS = [0, 20, 40, 60, 80, 100] as const
const AXIS_TITLE_INSET = 10
/** The selected band and the hit areas reach this far above the plot, over the tallest bar's count label. */
const BAND_OVERHANG = 14

/** Axis labels: 10 px, shrinking together to 8 px when a single word is too wide for its bar. */
const AXIS_FONT = 10
const MIN_AXIS_FONT = 8
/**
 * Average glyph width per px of font size: Segoe UI (Power BI's font) measures about 0.47 regular and 0.51 bold,
 * the macOS system font about 0.50 regular and 0.54 bold.
 */
const AXIS_CHAR_EM = 0.52
const AXIS_MAX_LINES = 3
const AXIS_LINE_HEIGHT = 12
const AXIS_FIRST_BASELINE = 15
/** Space kept between neighbouring axis labels. */
const AXIS_LABEL_GAP = 8

/** Value labels are the 10.5 px `.qaqc-value-text`; LABEL_METRICS measures 9.5 px, so scale it. */
const VALUE_SCALE = 10.5 / 9.5
const VALUE_CHAR_WIDTH = LABEL_METRICS.charWidth * VALUE_SCALE
const VALUE_ASCENT = LABEL_METRICS.ascent * VALUE_SCALE
const VALUE_DESCENT = LABEL_METRICS.descent * VALUE_SCALE
const COUNT_LABEL_GAP = 6
/** A line label beside its dot clears the dot and a count label centred on the same bar. */
const LINE_LABEL_SIDE = 8
/** Line labels keep this much more room on each side, so they never read as one word with a count label. */
const LINE_LABEL_PAD = 4
const LINE_LABEL_ABOVE = 9
const LINE_LABEL_BELOW = 17
const DOT_RADIUS = 3
const LABELLED_DOT_RADIUS = 4
/** Not recorded's grey: the muted axis colour at this opacity over the card, so it reads as no series colour. */
const GREY_OPACITY = 0.45

const CHART_NAME = 'Issues by root cause, largest first, with the cumulative percent'

export interface ParetoColumn {
  key: string
  /** Centre of the bar's band. */
  x: number
  /** Top of the bar; equals the plot bottom for an empty bar. */
  top: number
  path: string
}

export interface ParetoValueLabel {
  key: string
  kind: 'count' | 'line'
  text: string
  /** Middle-anchored at x, baseline at y. */
  x: number
  y: number
}

export interface ParetoAxisLabel {
  key: string
  x: number
  lines: string[]
}

export interface ParetoLinePoint extends PlotPoint {
  /** The bar's index. */
  index: number
  isLabelled: boolean
}

export interface ParetoLayout {
  plotRight: number
  plotBottom: number
  plotHeight: number
  band: number
  barWidth: number
  countScale: NiceScale
  columns: ParetoColumn[]
  linePoints: ParetoLinePoint[]
  /** Count labels in bar order, then line labels left to right. */
  valueLabels: ParetoValueLabel[]
  axisLabels: ParetoAxisLabel[]
  axisFontSize: number
  /** The dotted line before Not recorded, or null when there is no Not recorded bar. */
  dividerX: number | null
}

/** The collision box of a middle-anchored value label. */
export function valueLabelBox(label: Pick<ParetoValueLabel, 'text' | 'x' | 'y'>): LabelBox {
  const half = (label.text.length * VALUE_CHAR_WIDTH) / 2 + LABEL_GAP / 2
  return {
    left: label.x - half,
    right: label.x + half,
    top: label.y - VALUE_ASCENT - LABEL_GAP / 2,
    bottom: label.y + VALUE_DESCENT + LABEL_GAP / 2,
  }
}

function axisCharWidth(fontSize: number): number {
  return fontSize * AXIS_CHAR_EM
}

function axisBaseline(plotBottom: number, row: number): number {
  return plotBottom + AXIS_FIRST_BASELINE + row * AXIS_LINE_HEIGHT
}

/** One box per axis label line. */
export function axisLabelBoxes(layout: ParetoLayout): LabelBox[] {
  const charWidth = axisCharWidth(layout.axisFontSize)
  return layout.axisLabels.flatMap((label) =>
    label.lines.map((line, row) => {
      const y = axisBaseline(layout.plotBottom, row)
      const half = (line.length * charWidth) / 2
      return { left: label.x - half, right: label.x + half, top: y - layout.axisFontSize * 0.75, bottom: y + layout.axisFontSize * 0.25 }
    }),
  )
}

/** Words of a cause name; a slash ends a word, so Casting/Pouring/Erection can break after each slash. */
function axisWords(text: string): string[] {
  return text.replace(/\//g, '/ ').split(/\s+/).filter((word) => word !== '')
}

function withEllipsis(line: string, maxChars: number): string {
  if (line.endsWith('…')) return line
  return line.length + 1 <= maxChars ? `${line}…` : `${line.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`
}

/**
 * Wraps a cause name to lines of at most `maxWidth` px at `fontSize`, breaking at spaces and after slashes. A word
 * wider than a line ends in an ellipsis; past three lines the third line ends in one.
 */
export function wrapAxisLabel(text: string, maxWidth: number, fontSize: number): string[] {
  const maxChars = Math.max(1, Math.floor(maxWidth / axisCharWidth(fontSize)))
  const lines: string[] = []
  for (const word of axisWords(text)) {
    const fitted = truncateLabel(word, maxChars)
    const last = lines[lines.length - 1]
    const joined = last === undefined ? null : `${last}${last.endsWith('/') ? '' : ' '}${fitted}`
    if (joined !== null && joined.length <= maxChars) lines[lines.length - 1] = joined
    else lines.push(fitted)
  }
  if (lines.length <= AXIS_MAX_LINES) return lines
  return [...lines.slice(0, AXIS_MAX_LINES - 1), withEllipsis(lines[AXIS_MAX_LINES - 1], maxChars)]
}

/** The one size every axis label uses: 10 px, or smaller so the longest single word fits its bar. */
function axisFontSize(bars: readonly ParetoBar[], maxWidth: number): number {
  let size = AXIS_FONT
  for (const bar of bars) {
    for (const word of axisWords(bar.label)) {
      const fits = maxWidth / (word.length * AXIS_CHAR_EM)
      if (fits < size) size = fits
    }
  }
  return Math.max(MIN_AXIS_FONT, Math.floor(size * 2) / 2)
}

/** Places labels in priority order: each takes its first candidate that stays in bounds and clear of those before. */
function createPlacer(
  bounds: LabelBox,
  blocked: readonly LabelBox[],
): (text: string, candidates: readonly PlotPoint[], padX: number) => PlotPoint | null {
  const taken: LabelBox[] = [...blocked]
  return (text, candidates, padX) => {
    for (const candidate of candidates) {
      const tight = valueLabelBox({ text, x: candidate.x, y: candidate.y })
      const box = { ...tight, left: tight.left - padX, right: tight.right + padX }
      const isInside = box.left >= bounds.left && box.right <= bounds.right && box.top >= bounds.top && box.bottom <= bounds.bottom
      if (isInside && taken.every((other) => !boxesOverlap(box, other))) {
        taken.push(box)
        return candidate
      }
    }
    return null
  }
}

interface LineLabelPlan {
  index: number
  /** Preferred text first; a shorter fallback may follow. */
  texts: string[]
  isEnd: boolean
}

/** The end of the line, and where it reaches 80%; when that is the end, the point before it too. */
function lineLabelPlans(bars: readonly ParetoBar[], lineCount: number, crossIndex: number | null): LineLabelPlan[] {
  if (lineCount === 0) return []
  const last = lineCount - 1
  const plans: LineLabelPlan[] = [{ index: last, texts: [formatPercent(bars[last].cumulative)], isEnd: true }]
  if (crossIndex === null || crossIndex > last) return plans
  if (crossIndex < last) {
    const text = formatPercent(bars[crossIndex].cumulative)
    plans.push({ index: crossIndex, texts: [`${text} · ${VITAL_PERCENT}% reached`, text], isEnd: false })
  } else if (last > 0) {
    plans.push({ index: last - 1, texts: [formatPercent(bars[last - 1].cumulative)], isEnd: false })
  }
  return plans
}

function lineCandidates(point: PlotPoint, text: string, isEnd: boolean): PlotPoint[] {
  const side = (text.length * VALUE_CHAR_WIDTH) / 2 + LINE_LABEL_SIDE
  const above = { x: point.x, y: point.y - LINE_LABEL_ABOVE - 1 }
  const aboveLeft = { x: point.x - side, y: point.y - LINE_LABEL_ABOVE }
  // Clear of a count label centred under the dot, when the line ends on top of the tallest bar.
  const farLeft = { x: point.x - side - 2 * LINE_LABEL_SIDE, y: point.y - LINE_LABEL_ABOVE }
  const aboveRight = { x: point.x + side, y: point.y - LINE_LABEL_ABOVE }
  const belowLeft = { x: point.x - side, y: point.y + LINE_LABEL_BELOW }
  const belowRight = { x: point.x + side, y: point.y + LINE_LABEL_BELOW }
  return isEnd ? [above, aboveLeft, farLeft, belowLeft, belowRight] : [aboveLeft, above, aboveRight, belowRight, belowLeft]
}

/** All of the chart's geometry and label placement; pure, so the tests can check it at any size. */
export function layoutPareto(bars: readonly ParetoBar[], crossIndex: number | null, width: number, height: number): ParetoLayout {
  const plotRight = width - MARGIN.right
  const plotWidth = Math.max(0, plotRight - MARGIN.left)
  const plotBottom = Math.max(MARGIN.top, height - MARGIN.bottom)
  const plotHeight = plotBottom - MARGIN.top
  const hasNotRecorded = bars.some((bar) => bar.kind === 'notRecorded')
  const band = bars.length === 0 ? plotWidth : plotWidth / (bars.length + (hasNotRecorded ? NOT_RECORDED_GAP : 0))
  const barWidth = Math.min(MAX_BAR_WIDTH, band * BAR_RATIO)
  const countScale = niceScale(bars.reduce((max, bar) => Math.max(max, bar.count), 0), 5)
  const xOf = (at: number): number => MARGIN.left + band * (at + (bars[at].kind === 'notRecorded' ? NOT_RECORDED_GAP : 0)) + band / 2
  const countY = (count: number): number => plotBottom - (count / countScale.max) * plotHeight
  const percentY = (percent: number): number => plotBottom - (percent / 100) * plotHeight

  const columns: ParetoColumn[] = bars.map((bar, at) => {
    const x = xOf(at)
    const top = countY(bar.count)
    return { key: bar.key, x, top, path: roundedTopBarPath(x - barWidth / 2, top, barWidth, plotBottom - top, CORNER_RADIUS) }
  })

  // The model puts every bar with a cumulative share before Not recorded.
  const lineCount = bars.filter((bar) => bar.cumulative !== null).length
  const plans = lineLabelPlans(bars, lineCount, crossIndex)
  const labelledIndices = new Set(plans.map((plan) => plan.index))
  const linePoints: ParetoLinePoint[] = bars.slice(0, lineCount).map((bar, at) => ({
    x: xOf(at),
    y: percentY(bar.cumulative ?? 0),
    index: at,
    isLabelled: labelledIndices.has(at),
  }))

  // Count labels first, so every bar keeps its count; then the line's end, then where it reaches 80%. No label sits
  // on a bar.
  const barBoxes = columns.map((column) => ({ left: column.x - barWidth / 2, right: column.x + barWidth / 2, top: column.top, bottom: plotBottom }))
  const place = createPlacer({ left: MARGIN.left, right: plotRight, top: 0, bottom: plotBottom }, barBoxes)
  const countLabels: ParetoValueLabel[] = []
  bars.forEach((bar, at) => {
    const text = formatCount(bar.count)
    const spot = place(text, [{ x: columns[at].x, y: columns[at].top - COUNT_LABEL_GAP }], 0)
    if (spot !== null) countLabels.push({ key: `count:${bar.key}`, kind: 'count', text, x: spot.x, y: spot.y })
  })
  const lineLabels: ParetoValueLabel[] = []
  for (const plan of plans) {
    const point = linePoints[plan.index]
    for (const text of plan.texts) {
      const spot = place(text, lineCandidates(point, text, plan.isEnd), LINE_LABEL_PAD)
      if (spot !== null) {
        lineLabels.push({ key: `line:${bars[plan.index].key}`, kind: 'line', text, x: round(spot.x), y: round(spot.y) })
        break
      }
    }
  }
  lineLabels.sort((a, b) => a.x - b.x)

  const axisWidth = Math.max(1, band - AXIS_LABEL_GAP)
  const fontSize = axisFontSize(bars, axisWidth)
  const axisLabels = bars.map((bar, at) => ({ key: bar.key, x: columns[at].x, lines: wrapAxisLabel(bar.label, axisWidth, fontSize) }))

  return {
    plotRight,
    plotBottom,
    plotHeight,
    band,
    barWidth,
    countScale,
    columns,
    linePoints,
    valueLabels: [...countLabels, ...lineLabels],
    axisLabels,
    axisFontSize: fontSize,
    dividerX: hasNotRecorded ? MARGIN.left + band * (bars.length - 1 + NOT_RECORDED_GAP / 2) : null,
  }
}

/**
 * The grey of Not recorded and of the smaller categories, as a solid colour so bars, legend keys and swatches match.
 * High contrast keeps the host's muted (foreground) colour.
 */
export function paretoGrey(colors: ChartColors, isHighContrast: boolean): string {
  return isHighContrast ? colors.axisText : compositeOver(colors.axisText, GREY_OPACITY, colors.card)
}

function describeBar(bar: ParetoBar): string {
  const parts = [`${bar.label}: ${formatCount(bar.count)} ${pluralize(bar.count, 'issue', 'issues')}`, `${formatPercent(bar.share)} of issues`]
  parts.push(bar.cumulative === null ? 'not in the cumulative percent' : `${formatPercent(bar.cumulative)} cumulative`)
  return parts.join(', ')
}

function tooltipRows(bar: ParetoBar): TooltipRow[] {
  const rows: TooltipRow[] = [
    { label: 'Issues', value: formatCount(bar.count) },
    { label: 'Share', value: formatPercent(bar.share) },
  ]
  if (bar.cumulative !== null) rows.push({ label: 'Cumulative', value: formatPercent(bar.cumulative) })
  if (bar.kind === 'other') rows.push({ label: 'Largest', value: bar.causes.slice(0, 3).join(', ') })
  if (bar.kind === 'notRecorded') rows.push({ label: 'Note', value: 'Blank Root Cause; not in the cumulative %' })
  return rows
}

export interface ParetoChartProps {
  bars: ParetoBar[]
  crossIndex: number | null
  selectedKey: string
  width: number
  height: number
  colors: ChartColors
  isHighContrast: boolean
  onSelect: (key: string) => void
  onHover: TooltipHandler
}

export function ParetoChart({
  bars,
  crossIndex,
  selectedKey,
  width,
  height,
  colors,
  isHighContrast,
  onSelect,
  onHover,
}: ParetoChartProps): ReactElement {
  const selectedIndex = bars.findIndex((bar) => bar.key === selectedKey)
  const { focus, hasFocus, showFocusRing, svgProps } = useWeekFocus({
    count: bars.length,
    selectedIndex,
    interactive: true,
    onSelect: (index) => onSelect(bars[index].key),
  })
  const layout = useMemo(() => layoutPareto(bars, crossIndex, width, height), [bars, crossIndex, width, height])
  const { plotRight, plotBottom, plotHeight, band, barWidth } = layout
  const bandTop = MARGIN.top - BAND_OVERHANG
  const bandHeight = plotHeight + BAND_OVERHANG + MARGIN.bottom - 4

  // Selection and focus re-render the chart; the axes, line and labels depend only on the layout.
  const frame = useMemo(() => {
    const countY = (count: number): number => plotBottom - (count / layout.countScale.max) * plotHeight
    const percentY = (percent: number): number => plotBottom - (percent / 100) * plotHeight
    const middle = MARGIN.top + plotHeight / 2
    return (
      <>
        {layout.countScale.ticks.map((tick) => (
          <g key={tick}>
            <line className="qaqc-grid-line" x1={MARGIN.left} x2={plotRight} y1={countY(tick)} y2={countY(tick)} stroke={colors.grid} />
            <text className="qaqc-axis-text" x={MARGIN.left - 8} y={countY(tick) + 3.5} textAnchor="end" fill={colors.axisText}>
              {formatCount(tick)}
            </text>
          </g>
        ))}
        {PERCENT_TICKS.map((percent) => (
          <text
            key={percent}
            className={percent === VITAL_PERCENT ? 'qaqc-axis-text is-selected' : 'qaqc-axis-text'}
            x={plotRight + 8}
            y={percentY(percent) + 3.5}
            fill={colors.warn}
          >
            {`${percent}%`}
          </text>
        ))}
        <text
          className="qaqc-axis-title"
          x={AXIS_TITLE_INSET}
          y={middle}
          textAnchor="middle"
          transform={`rotate(-90 ${AXIS_TITLE_INSET} ${middle})`}
          fill={colors.axisText}
        >
          Issues
        </text>
        <text
          className="qaqc-axis-title"
          x={width - AXIS_TITLE_INSET}
          y={middle}
          textAnchor="middle"
          transform={`rotate(90 ${width - AXIS_TITLE_INSET} ${middle})`}
          fill={colors.warn}
        >
          Cumulative %
        </text>
        {layout.dividerX !== null && (
          <line
            className="qaqc-pareto-divider"
            x1={layout.dividerX}
            x2={layout.dividerX}
            y1={MARGIN.top}
            y2={plotBottom + 4}
            stroke={colors.grid}
            strokeWidth={1.5}
            strokeDasharray="2 3"
          />
        )}
      </>
    )
  }, [layout, colors, plotBottom, plotHeight, plotRight, width])

  const overlay = useMemo(() => {
    const percentY = plotBottom - (VITAL_PERCENT / 100) * plotHeight
    const path = layout.linePoints.map((point, at) => `${at === 0 ? 'M' : 'L'}${round(point.x)},${round(point.y)}`).join('')
    return (
      <>
        <line
          className="qaqc-pareto-target"
          x1={MARGIN.left}
          x2={plotRight}
          y1={percentY}
          y2={percentY}
          stroke={colors.ink}
          strokeOpacity={isHighContrast ? 1 : 0.55}
          strokeWidth={1.25}
          strokeDasharray={LINE_DASH}
        />
        {isHighContrast && (
          // The line and the bars share the host's foreground colour, so a card-coloured casing keeps the line apart.
          <path className="qaqc-pareto-line-casing" d={path} fill="none" stroke={colors.card} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />
        )}
        <path className="qaqc-pareto-line" d={path} fill="none" stroke={colors.warn} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {layout.linePoints.map((point) => (
          <circle
            key={point.index}
            className="qaqc-pareto-dot"
            cx={point.x}
            cy={point.y}
            r={point.isLabelled ? LABELLED_DOT_RADIUS : DOT_RADIUS}
            fill={colors.warn}
            stroke={colors.card}
            strokeWidth={1.5}
          />
        ))}
      </>
    )
  }, [layout, colors, isHighContrast, plotBottom, plotHeight, plotRight])

  const grey = paretoGrey(colors, isHighContrast)
  const fillOf = (bar: ParetoBar): string => {
    if (bar.kind === 'notRecorded') return grey
    return bar.vital ? colors.series1 : colors.series2
  }
  const countFillOf = (bar: ParetoBar): string => {
    if (bar.kind === 'notRecorded') return colors.axisText
    return bar.vital ? colors.series1 : colors.ink
  }

  function showTooltip(bar: ParetoBar, event: MouseEvent<SVGRectElement>): void {
    onHover({ title: bar.label, rows: tooltipRows(bar), clientX: event.clientX, clientY: event.clientY })
  }

  const selected = selectedIndex >= 0 ? layout.columns[selectedIndex] : null
  const focused = bars.length > 0 ? layout.columns[focus] : null

  return (
    <>
      <svg className="qaqc-chart qaqc-pareto-chart" width={width} height={height} role="group" aria-label={CHART_NAME} {...svgProps}>
        {selected !== null && (
          <rect
            className="qaqc-selected-band"
            x={selected.x - band / 2}
            y={bandTop}
            width={band}
            height={bandHeight}
            rx={8}
            fill={colors.accent}
          />
        )}
        {frame}
        {bars.map((bar, at) => {
          const column = layout.columns[at]
          const isSelected = at === selectedIndex
          return (
            <path
              key={bar.key}
              className={`qaqc-pareto-bar is-${bar.kind === 'notRecorded' ? 'not-recorded' : bar.vital ? 'vital' : 'beyond'}${isSelected ? ' is-selected' : ''}`}
              data-key={bar.key}
              d={column.path}
              fill={fillOf(bar)}
            />
          )
        })}
        {selected !== null && selected.top < plotBottom && (
          <path
            className="qaqc-pareto-outline"
            d={roundedTopBarPath(selected.x - barWidth / 2 - 2.5, selected.top - 2.5, barWidth + 5, plotBottom - selected.top + 2.5, CORNER_RADIUS + 2)}
            fill="none"
            stroke={colors.ink}
            strokeWidth={1.5}
          />
        )}
        {overlay}
        {layout.valueLabels.map((label) => {
          const bar = label.kind === 'count' ? bars.find((candidate) => `count:${candidate.key}` === label.key) : undefined
          return (
            <text
              key={label.key}
              className={`qaqc-value-text qaqc-pareto-value ${label.kind === 'count' ? 'qaqc-bar-value' : 'qaqc-end-label'}`}
              x={label.x}
              y={label.y}
              textAnchor="middle"
              fill={bar === undefined ? colors.warn : countFillOf(bar)}
            >
              {label.text}
            </text>
          )
        })}
        {layout.axisLabels.map((label, at) =>
          label.lines.map((line, row) => (
            <text
              key={`${label.key}:${row}`}
              className={`qaqc-axis-text qaqc-pareto-axis-label${at === selectedIndex ? ' is-selected' : ''}`}
              x={label.x}
              y={axisBaseline(plotBottom, row)}
              textAnchor="middle"
              fill={at === selectedIndex || bars[at].kind !== 'notRecorded' ? colors.ink : colors.axisText}
              style={{ fontSize: layout.axisFontSize }}
            >
              {line}
            </text>
          )),
        )}
        {hasFocus && showFocusRing && focused !== null && (
          <rect
            className="qaqc-focus-ring"
            x={focused.x - band / 2 + 1}
            y={bandTop + 1}
            width={Math.max(0, band - 2)}
            height={bandHeight - 2}
            rx={7}
            fill="none"
            stroke={colors.accent}
            strokeWidth={1.5}
          />
        )}
        <g onMouseLeave={() => onHover(null)}>
          {bars.map((bar, at) => (
            <rect
              key={bar.key}
              className="qaqc-hit"
              data-key={bar.key}
              x={layout.columns[at].x - band / 2}
              y={bandTop}
              width={band}
              height={bandHeight}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onMouseMove={(event) => showTooltip(bar, event)}
              onClick={() => onSelect(bar.key)}
            />
          ))}
        </g>
      </svg>
      <p className="qaqc-visually-hidden" aria-live="polite">
        {hasFocus && bars.length > 0 ? describeBar(bars[focus]) : ''}
      </p>
    </>
  )
}
