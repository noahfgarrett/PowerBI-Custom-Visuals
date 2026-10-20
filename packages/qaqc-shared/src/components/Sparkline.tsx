import type { ReactElement } from 'react'

import { round } from '../chartMath'

const MARK_RADIUS = 2.5
const MARK_RING = 1.5
/** Keeps the mark and its ring inside the box at every edge. */
const PAD = MARK_RADIUS + MARK_RING

export interface SparklineProps {
  values: ReadonlyArray<number>
  /** The point to mark (the selected week); outside the series, no mark. */
  markIndex: number
  width: number
  height: number
  color: string
  /** The ring around the mark, usually the card colour. */
  ringColor: string
}

/**
 * A decorative trend line scaled to its own minimum and maximum, with one point marked. Rows that show one say the
 * trend in text, so the SVG is hidden from screen readers.
 */
export function Sparkline({ values, markIndex, width, height, color, ringColor }: SparklineProps): ReactElement {
  const innerWidth = Math.max(0, width - PAD * 2)
  const innerHeight = Math.max(0, height - PAD * 2)
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const value of values) {
    min = Math.min(min, value)
    max = Math.max(max, value)
  }
  const span = max - min
  const xOf = (index: number): number => (values.length > 1 ? PAD + (index / (values.length - 1)) * innerWidth : width / 2)
  // A flat series has no range to scale: zeros lie along the bottom, any other level across the middle.
  const yOf = (value: number): number => {
    if (span > 0) return PAD + innerHeight - ((value - min) / span) * innerHeight
    return value === 0 ? PAD + innerHeight : height / 2
  }
  const points = values.map((value, index) => `${round(xOf(index))},${round(yOf(value))}`).join(' ')
  const hasMark = markIndex >= 0 && markIndex < values.length

  return (
    <svg className="qaqc-sparkline" width={width} height={height} aria-hidden="true" focusable="false">
      {values.length > 1 && <polyline points={points} fill="none" stroke={color} />}
      {hasMark && (
        <circle
          className="qaqc-sparkline-mark"
          cx={round(xOf(markIndex))}
          cy={round(yOf(values[markIndex]))}
          r={MARK_RADIUS}
          fill={color}
          stroke={ringColor}
          strokeWidth={MARK_RING}
        />
      )}
    </svg>
  )
}
