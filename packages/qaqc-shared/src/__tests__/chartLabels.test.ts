import { describe, expect, it } from 'vitest'

import { boxesOverlap, createLabelPlacer, LABEL_METRICS, labelBox } from '../chartLabels'

const BOUNDS = { left: 0, right: 200, top: 0, bottom: 100 }

describe('labelBox', () => {
  it('measures a middle-anchored label from its baseline, with half the gap on every side', () => {
    expect(labelBox('12', 50, 40)).toEqual({
      left: 50 - LABEL_METRICS.charWidth - 0.5,
      right: 50 + LABEL_METRICS.charWidth + 0.5,
      top: 40 - LABEL_METRICS.ascent - 0.5,
      bottom: 40 + LABEL_METRICS.descent + 0.5,
    })
  })

  it('widens the box by the side padding', () => {
    const plain = labelBox('7', 50, 40)
    const padded = labelBox('7', 50, 40, 2.5)
    expect(padded.left).toBeCloseTo(plain.left - 2.5, 9)
    expect(padded.right).toBeCloseTo(plain.right + 2.5, 9)
  })
})

describe('boxesOverlap', () => {
  it('does not count boxes that only touch', () => {
    expect(boxesOverlap({ left: 0, right: 10, top: 0, bottom: 10 }, { left: 10, right: 20, top: 0, bottom: 10 })).toBe(false)
  })
})

describe('createLabelPlacer', () => {
  it('takes the first clear candidate', () => {
    const placer = createLabelPlacer({ bounds: BOUNDS })
    expect(placer.place('5', [{ x: 50, y: 50 }])).toEqual({ x: 50, y: 50 })
    expect(placer.place('5', [{ x: 50, y: 50 }, { x: 50, y: 70 }])).toEqual({ x: 50, y: 70 })
  })

  it('leaves out a label with no clear candidate', () => {
    const placer = createLabelPlacer({ bounds: BOUNDS })
    placer.place('5', [{ x: 50, y: 50 }])
    expect(placer.place('5', [{ x: 50, y: 50 }])).toBeNull()
  })

  it('keeps labels inside the bounds', () => {
    const placer = createLabelPlacer({ bounds: BOUNDS })
    expect(placer.place('5', [{ x: 1, y: 50 }, { x: 50, y: 3 }, { x: 50, y: 99 }])).toBeNull()
  })

  it('keeps labels off the blocked boxes', () => {
    const placer = createLabelPlacer({ bounds: BOUNDS, blocked: [{ left: 40, right: 60, top: 40, bottom: 60 }] })
    expect(placer.place('5', [{ x: 50, y: 50 }, { x: 100, y: 50 }])).toEqual({ x: 100, y: 50 })
  })

  it('keeps padded neighbours on one baseline apart', () => {
    const plain = createLabelPlacer({ bounds: BOUNDS })
    const padded = createLabelPlacer({ bounds: BOUNDS, padX: 2.5 })
    plain.place('5', [{ x: 50, y: 50 }])
    padded.place('5', [{ x: 50, y: 50 }])
    expect(plain.place('5', [{ x: 57, y: 50 }])).not.toBeNull()
    expect(padded.place('5', [{ x: 57, y: 50 }])).toBeNull()
  })
})
