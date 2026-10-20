export interface ChartColors {
  series1: string
  series2: string
  /** The second line of a two-line chart. High contrast gives it the series 1 colour, so it is also dashed there. */
  series3: string
  /** Green for closed and other good outcomes. */
  good: string
  bad: string
  /** Amber for hotspots that need attention but are not failures. */
  warn: string
  /** Solid card color, used for marker rings and badge text. */
  card: string
  grid: string
  axisText: string
  ink: string
  accent: string
}

export interface TooltipRow {
  label: string
  value: string
}

export interface TooltipRequest {
  title: string
  rows: TooltipRow[]
  clientX: number
  clientY: number
}

export type TooltipHandler = (request: TooltipRequest | null) => void
