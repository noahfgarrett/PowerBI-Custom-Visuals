export interface NiceScale {
  max: number
  ticks: number[]
}

/** Integer-step axis for counts. */
export function niceScale(maxValue: number, tickCount = 4): NiceScale {
  const safeMax = Math.max(1, maxValue)
  const rawStep = safeMax / tickCount
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const residual = rawStep / magnitude
  const niceResidual = residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 5 ? 5 : 10
  const step = Math.max(1, niceResidual * magnitude)
  const max = Math.ceil(safeMax / step) * step
  const ticks: number[] = []
  for (let tick = 0; tick <= max; tick += step) ticks.push(tick)
  return { max, ticks }
}

/** Which bar indices get an axis label: evenly spaced from the right, always including the selection. */
export function labelIndices(count: number, plotWidth: number, selectedIndex: number, minLabelWidth = 44): Set<number> {
  const result = new Set<number>()
  if (count <= 0) return result
  const capacity = Math.max(1, Math.floor(plotWidth / minLabelWidth))
  const every = Math.max(1, Math.ceil(count / capacity))
  const guard = Math.ceil(every / 2)
  for (let index = count - 1; index >= 0; index -= every) {
    const crowdsSelection = selectedIndex >= 0 && index !== selectedIndex && Math.abs(index - selectedIndex) < guard
    if (!crowdsSelection) result.add(index)
  }
  if (selectedIndex >= 0 && selectedIndex < count) result.add(selectedIndex)
  return result
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

/** Vertical bar with rounded top corners and a square baseline (DESIGN.md mark spec). */
export function roundedTopBarPath(x: number, y: number, width: number, height: number, radius: number): string {
  if (width <= 0 || height <= 0) return ''
  const r = Math.min(radius, width / 2, height)
  const [x0, y0, x1, y1] = [round(x), round(y), round(x + width), round(y + height)]
  return `M${x0},${y1}V${round(y0 + r)}Q${x0},${y0} ${round(x0 + r)},${y0}H${round(x1 - r)}Q${x1},${y0} ${x1},${round(y0 + r)}V${y1}Z`
}

/** Horizontal bar with a rounded right end. */
export function roundedRightBarPath(x: number, y: number, width: number, height: number, radius: number): string {
  if (width <= 0 || height <= 0) return ''
  const r = Math.min(radius, width, height / 2)
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
  return `${text.slice(0, Math.max(1, maxChars - 1))}…`
}
