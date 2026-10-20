import type { PlotPoint } from './chartMath'

/**
 * Metrics for the 9.5 px bold, tabular digits of the chart value labels (`.qaqc-trend-label`, `.qaqc-overview-label`,
 * `.qaqc-perf-chart-label`): each character is about 5.6 px wide, and the glyphs reach 7 px above the baseline and
 * 2 px below it. The collision boxes and the tests that check them both measure with these.
 */
export const LABEL_METRICS = { charWidth: 5.6, ascent: 7, descent: 2 } as const

/** Placed labels keep at least this much space between them. */
export const LABEL_GAP = 1

/** An axis-aligned box in SVG coordinates. */
export interface LabelBox {
  left: number
  right: number
  top: number
  bottom: number
}

/** The approximate rendered width of a label's text. */
export function labelTextWidth(text: string): number {
  return text.length * LABEL_METRICS.charWidth
}

/** Half the width of a middle-anchored label's collision box: half the text, half the gap, and any side padding. */
export function labelHalfWidth(text: string, padX = 0): number {
  return labelTextWidth(text) / 2 + LABEL_GAP / 2 + padX
}

/** The collision box of a middle-anchored label at (x, y), where y is the baseline. */
export function labelBox(text: string, x: number, y: number, padX = 0): LabelBox {
  const half = labelHalfWidth(text, padX)
  return { left: x - half, right: x + half, top: y - LABEL_METRICS.ascent - LABEL_GAP / 2, bottom: y + LABEL_METRICS.descent + LABEL_GAP / 2 }
}

/** True when the two boxes share any area; boxes that only touch do not overlap. */
export function boxesOverlap(a: LabelBox, b: LabelBox): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
}

export interface LabelPlacerOptions {
  /** Every placed label's box stays inside these bounds. */
  bounds: LabelBox
  /** Boxes no label may overlap, such as axis tick labels. */
  blocked?: readonly LabelBox[]
  /** Extra room on each side of every label, so neighbours on one baseline never run together. */
  padX?: number
}

/**
 * Greedy label placement: each label takes its first candidate position whose box stays inside the bounds and clear
 * of every blocked box and every label already placed. Callers place labels in priority order and choose each
 * label's candidates (above, below, beside), so those rules stay with each chart.
 */
export interface LabelPlacer {
  /** The first clear candidate, now taken; null when none is clear and the label is left out. */
  place: (text: string, candidates: readonly PlotPoint[]) => PlotPoint | null
}

export function createLabelPlacer({ bounds, blocked = [], padX = 0 }: LabelPlacerOptions): LabelPlacer {
  const taken: LabelBox[] = [...blocked]
  const isClear = (box: LabelBox): boolean =>
    box.left >= bounds.left && box.right <= bounds.right && box.top >= bounds.top && box.bottom <= bounds.bottom
    && taken.every((other) => !boxesOverlap(box, other))

  function place(text: string, candidates: readonly PlotPoint[]): PlotPoint | null {
    for (const candidate of candidates) {
      const box = labelBox(text, candidate.x, candidate.y, padX)
      if (isClear(box)) {
        taken.push(box)
        return candidate
      }
    }
    return null
  }

  return { place }
}
