export interface NiceScale {
  max: number
  ticks: number[]
}

/** The smallest 1, 2 or 5 × 10ⁿ step of at least `rawStep`, and never less than 1. */
function niceStep(rawStep: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const residual = rawStep / magnitude
  const niceResidual = residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 5 ? 5 : 10
  return Math.max(1, niceResidual * magnitude)
}

function ticksTo(max: number, step: number): number[] {
  const ticks: number[] = []
  for (let tick = 0; tick <= max; tick += step) ticks.push(tick)
  return ticks
}

/** Integer-step axis for counts. */
export function niceScale(maxValue: number, tickCount = 4): NiceScale {
  const safeMax = Math.max(1, maxValue)
  const step = niceStep(safeMax / tickCount)
  const max = Math.ceil(safeMax / step) * step
  return { max, ticks: ticksTo(max, step) }
}

/**
 * An integer-step axis with exactly `steps` steps, for a second axis whose ticks must sit on the first axis's
 * gridlines: the smallest nice step that reaches `maxValue` in that many steps.
 */
export function alignedScale(maxValue: number, steps: number): NiceScale {
  const stepCount = Math.max(1, steps)
  const step = niceStep(Math.max(1, maxValue) / stepCount)
  const max = step * stepCount
  return { max, ticks: ticksTo(max, step) }
}

/** Which bar indices get an axis label: evenly spaced from the right, always including the selection. */
export function labelIndices(count: number, plotWidth: number, selectedIndex: number, minLabelWidth = 44): Set<number> {
  const result = new Set<number>()
  if (count <= 0) return result
  const capacity = Math.max(1, Math.floor(plotWidth / minLabelWidth))
  const every = Math.max(1, Math.ceil(count / capacity))
  const hasSelection = selectedIndex >= 0 && selectedIndex < count
  for (let index = count - 1; index >= 0; index -= every) {
    const crowdsSelection = hasSelection && index !== selectedIndex && Math.abs(index - selectedIndex) < every
    if (!crowdsSelection) result.add(index)
  }
  if (hasSelection) result.add(selectedIndex)
  return result
}

/** Baseline of a week tick label, in px below the plot. */
export const WEEK_TICK_OFFSET = 16
/** Baseline of a year marker, in px below the plot: one 9 px line under the 10.5 px tick label. */
export const YEAR_MARKER_OFFSET = 27
/** Room under the plot for a week tick label and a year marker. */
export const WEEK_AXIS_HEIGHT = 31

/** Which labelled indices get a year marker: the first labelled index, plus the first labelled index of each new year. */
export function yearMarkers(labelledIndices: ReadonlySet<number> | readonly number[], weeks: ReadonlyArray<{ year: number }>): Set<number> {
  const result = new Set<number>()
  const sorted = [...labelledIndices].filter((index) => index >= 0 && index < weeks.length).sort((a, b) => a - b)
  let previousYear: number | null = null
  for (const index of sorted) {
    const year = weeks[index].year
    if (year !== previousYear) result.add(index)
    previousYear = year
  }
  return result
}

/** Rounds to hundredths, enough precision for SVG coordinates. */
export function round(value: number): number {
  return Math.round(value * 100) / 100
}

/** Vertical bar with rounded top corners and a square baseline (DESIGN.md mark spec). */
export function roundedTopBarPath(x: number, y: number, width: number, height: number, radius: number): string {
  if (width <= 0 || height <= 0) return ''
  const r = Math.max(0, Math.min(radius, width / 2, height))
  const [x0, y0, x1, y1] = [round(x), round(y), round(x + width), round(y + height)]
  return `M${x0},${y1}V${round(y0 + r)}Q${x0},${y0} ${round(x0 + r)},${y0}H${round(x1 - r)}Q${x1},${y0} ${x1},${round(y0 + r)}V${y1}Z`
}

/** Horizontal bar with a rounded right end. */
export function roundedRightBarPath(x: number, y: number, width: number, height: number, radius: number): string {
  if (width <= 0 || height <= 0) return ''
  const r = Math.max(0, Math.min(radius, width, height / 2))
  const [x0, y0, x1, y1] = [round(x), round(y), round(x + width), round(y + height)]
  return `M${x0},${y0}H${round(x1 - r)}Q${x1},${y0} ${x1},${round(y0 + r)}V${round(y1 - r)}Q${x1},${y1} ${round(x1 - r)},${y1}H${x0}Z`
}

export function passRateDomain(rates: ReadonlyArray<number | null>): { min: number; max: number } {
  const values = rates.filter((rate): rate is number => rate !== null)
  if (values.length === 0) return { min: 0, max: 100 }
  return { min: Math.max(0, Math.floor(Math.min(...values)) - 1), max: 100 }
}

export function truncateLabel(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  return `${text.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`
}

const ORDINAL_MIN_OPACITY = 0.35

/** One step of an ordinal ramp on a single series colour: 0.35 for the first step, rising evenly to 1 for the last. */
export function ordinalOpacity(index: number, count: number): number {
  if (count <= 1) return 1
  return ORDINAL_MIN_OPACITY + ((1 - ORDINAL_MIN_OPACITY) * index) / (count - 1)
}
