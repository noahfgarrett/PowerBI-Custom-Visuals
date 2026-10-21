import { describe, expect, it } from 'vitest'

import {
  FIT_PADDING_PX,
  MAX_SCALE_FACTOR,
  MIN_SCALE_FACTOR,
  buildHitGrid,
  fitView,
  nodeSizeOf,
  toWorld,
  zoomAt,
  type View,
} from '../ffuGeometry'
import { buildFfuIndex, readFfuTable, type FfuIndex, type FfuRole } from '../ffuMap'

interface PlacedRecord {
  tag: string
  x: number
  y: number
  line?: string
  lineOrder?: number
}

const ROLES: readonly FfuRole[] = ['tag', 'x', 'y', 'line', 'lineOrder']

function indexOf(records: readonly PlacedRecord[]): FfuIndex {
  const result = readFfuTable({
    columns: ROLES.map((role) => ({ roles: { [role]: true } })),
    rows: records.map((record) => [record.tag, record.x, record.y, record.line ?? null, record.lineOrder ?? null]),
  })
  if (result.kind !== 'ready') throw new Error(`expected a ready table, got ${result.kind}`)
  return buildFfuIndex(result.rows, result.columns)
}

/** A row of nodes `spacing` apart along x, with no lines. */
function rowOf(count: number, spacing: number): PlacedRecord[] {
  return Array.from({ length: count }, (_, i) => ({ tag: `N${i}`, x: i * spacing, y: 0 }))
}

/** Nodes in order along one line, tagged `${id}-${position}`. */
function lineOf(id: string, points: readonly (readonly [number, number])[]): PlacedRecord[] {
  return points.map(([x, y], i) => ({ tag: `${id}-${i}`, x, y, line: id, lineOrder: i + 1 }))
}

function hasNoNaN(view: View): boolean {
  return [view.scale, view.offsetX, view.offsetY].every(Number.isFinite)
}

describe('fitView', () => {
  it('centres bounds with padding', () => {
    expect(FIT_PADDING_PX).toBe(24)
    expect(fitView({ minX: 0, minY: 0, maxX: 100, maxY: 50 }, { width: 224, height: 124 })).toEqual({
      scale: 2,
      offsetX: 12,
      offsetY: 12,
    })
  })

  it('fits the tighter axis and centres the other', () => {
    expect(fitView({ minX: 0, minY: 0, maxX: 100, maxY: 10 }, { width: 224, height: 124 })).toEqual({
      scale: 2,
      offsetX: 12,
      offsetY: 52,
    })
  })

  it('handles a single point and an empty index without NaN', () => {
    const point = fitView({ minX: 5, minY: 5, maxX: 5, maxY: 5 }, { width: 200, height: 100 })
    expect(point).toEqual({ scale: 1, offsetX: 95, offsetY: 45 })
    expect(fitView(null, { width: 200, height: 100 })).toEqual({ scale: 1, offsetX: 0, offsetY: 0 })
    expect(hasNoNaN(point)).toBe(true)
  })

  it('fits along the only axis that has extent', () => {
    expect(fitView({ minX: 0, minY: 7, maxX: 100, maxY: 7 }, { width: 224, height: 124 })).toEqual({
      scale: 2,
      offsetX: 12,
      offsetY: 48,
    })
  })

  it('returns the identity view for a zero-size viewport', () => {
    expect(fitView({ minX: 0, minY: 0, maxX: 100, maxY: 50 }, { width: 0, height: 124 })).toEqual({
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    })
  })

  it('keeps a positive scale when the viewport is smaller than the padding', () => {
    const view = fitView({ minX: 0, minY: 0, maxX: 100, maxY: 50 }, { width: 10, height: 10 })
    expect(hasNoNaN(view)).toBe(true)
    expect(view.scale).toBeGreaterThan(0)
  })
})

describe('zoomAt and toWorld', () => {
  const fitted: View = { scale: 2, offsetX: 12, offsetY: 12 }

  it('maps screen points back to world points', () => {
    expect(toWorld(fitted, 12, 12)).toEqual({ x: 0, y: 0 })
    expect(toWorld(fitted, 212, 112)).toEqual({ x: 100, y: 50 })
  })

  it("keeps the cursor's world point fixed", () => {
    const before = toWorld(fitted, 80, 40)
    const zoomed = zoomAt(fitted, 1.5, 80, 40, 2)
    const after = toWorld(zoomed, 80, 40)
    expect(zoomed.scale).toBeCloseTo(3)
    expect(after.x).toBeCloseTo(before.x)
    expect(after.y).toBeCloseTo(before.y)
  })

  it('clamps to fit × 60 and fit × 0.5', () => {
    expect(MAX_SCALE_FACTOR).toBe(60)
    expect(MIN_SCALE_FACTOR).toBe(0.5)
    const zoomedIn = zoomAt(fitted, 1000, 80, 40, 2)
    expect(zoomedIn.scale).toBe(120)
    expect(zoomAt(fitted, 0.001, 80, 40, 2).scale).toBe(1)
    const after = toWorld(zoomedIn, 80, 40)
    const before = toWorld(fitted, 80, 40)
    expect(after.x).toBeCloseTo(before.x)
    expect(after.y).toBeCloseTo(before.y)
  })

  it('ignores a zoom factor that is not a positive number', () => {
    expect(zoomAt(fitted, 0, 80, 40, 2)).toEqual(fitted)
    expect(zoomAt(fitted, Number.NaN, 80, 40, 2)).toEqual(fitted)
  })
})

describe('nodeSizeOf', () => {
  it('is 0.45 × median nearest-neighbour distance', () => {
    expect(nodeSizeOf(indexOf(rowOf(20, 10)))).toBeCloseTo(4.5)
  })

  it('takes the median, so one far outlier does not move it', () => {
    expect(nodeSizeOf(indexOf([...rowOf(4, 10), { tag: 'far', x: 1000, y: 0 }]))).toBeCloseTo(4.5)
  })

  it('finds nearest neighbours in two dimensions', () => {
    const grid: PlacedRecord[] = []
    for (let row = 0; row < 30; row += 1) {
      for (let column = 0; column < 30; column += 1) grid.push({ tag: `G${row}-${column}`, x: column * 20, y: row * 20 })
    }
    expect(nodeSizeOf(indexOf(grid))).toBeCloseTo(9)
  })

  it('is 10 with fewer than 2 nodes', () => {
    expect(nodeSizeOf(indexOf([]))).toBe(10)
    expect(nodeSizeOf(indexOf([{ tag: 'only', x: 3, y: 4 }]))).toBe(10)
  })

  it('is at least 1 when nodes coincide', () => {
    expect(nodeSizeOf(indexOf([{ tag: 'a', x: 3, y: 4 }, { tag: 'b', x: 3, y: 4 }]))).toBe(1)
  })
})

describe('buildHitGrid nodeAt', () => {
  const index = indexOf([
    { tag: 'A', x: 0, y: 0 },
    { tag: 'B', x: 100, y: 0 },
    { tag: 'C', x: 200, y: 0 },
    { tag: 'D', x: 206, y: 0 },
    { tag: 'E', x: 50, y: 300 },
  ])
  const grid = buildHitGrid(index, 10)
  const tagAt = (x: number, y: number, tolerance: number): string => index.nodes[grid.nodeAt(x, y, tolerance)]?.tag ?? 'none'

  it('returns the node whose square contains the point', () => {
    expect(tagAt(4, -4, 0)).toBe('A')
    expect(tagAt(5, 5, 0)).toBe('A')
    expect(tagAt(103, 2, 0)).toBe('B')
    expect(tagAt(50, 300, 0)).toBe('E')
  })

  it('returns -1 just outside half-size + tolerance', () => {
    expect(grid.nodeAt(5.01, 0, 0)).toBe(-1)
    expect(grid.nodeAt(7.01, 0, 2)).toBe(-1)
    expect(tagAt(7, 0, 2)).toBe('A')
    expect(grid.nodeAt(50, 150, 0)).toBe(-1)
  })

  it('lets the nearest centre win where two nodes overlap', () => {
    expect(tagAt(204, 0, 0)).toBe('D')
    expect(tagAt(202, 0, 0)).toBe('C')
  })

  it('reaches nodes from points outside the bounds', () => {
    expect(tagAt(-6, 0, 2)).toBe('A')
    expect(grid.nodeAt(-60, 0, 2)).toBe(-1)
    expect(grid.nodeAt(1e9, -1e9, 2)).toBe(-1)
  })

  it('returns -1 for non-finite points', () => {
    expect(grid.nodeAt(Number.NaN, 0, 2)).toBe(-1)
  })
})

describe('buildHitGrid lineAt', () => {
  const index = indexOf([
    ...lineOf('L1', [
      [0, 0],
      [100, 0],
      [100, 100],
    ]),
    ...lineOf('L2', [
      [0, 20],
      [100, 20],
    ]),
    ...lineOf('L3', [[300, 300]]),
    { tag: 'loose-a', x: 200, y: 200 },
    { tag: 'loose-b', x: 220, y: 200 },
  ])
  const grid = buildHitGrid(index, 10)
  const lineIdAt = (x: number, y: number, tolerance: number): string => index.lines[grid.lineAt(x, y, tolerance)]?.id ?? 'none'

  it('returns the line whose segment passes within tolerance', () => {
    expect(lineIdAt(50, 3, 5)).toBe('L1')
    expect(lineIdAt(103, 50, 5)).toBe('L1')
    expect(lineIdAt(50, 22, 5)).toBe('L2')
  })

  it('returns the nearest line first', () => {
    expect(lineIdAt(50, 9, 15)).toBe('L1')
    expect(lineIdAt(50, 11, 15)).toBe('L2')
  })

  it('returns -1 when no segment is within tolerance', () => {
    expect(grid.lineAt(50, 10, 5)).toBe(-1)
    expect(grid.lineAt(50, 60, 5)).toBe(-1)
    expect(grid.lineAt(-10, 0, 5)).toBe(-1)
  })

  it('measures to the segment, not its endpoints or bounding box', () => {
    expect(grid.lineAt(-6, 0, 5)).toBe(-1)
    expect(lineIdAt(-4, 0, 5)).toBe('L1')
  })

  it('gives nodes off a line, and single-node lines, no segments', () => {
    expect(grid.lineAt(210, 200, 5)).toBe(-1)
    expect(grid.lineAt(300, 300, 5)).toBe(-1)
    expect(index.nodes[grid.nodeAt(210, 200, 0)]).toBeUndefined()
    expect(index.nodes[grid.nodeAt(200, 200, 0)]?.tag).toBe('loose-a')
  })
})

describe('a far outlier', () => {
  const index = indexOf([
    ...lineOf(
      'L1',
      Array.from({ length: 200 }, (_, i): [number, number] => [i * 10, 0]),
    ),
    ...lineOf('L2', [
      [1990, 50],
      [100_000, 50],
    ]),
  ])
  const grid = buildHitGrid(index, nodeSizeOf(index))

  it('does not move the node size', () => {
    expect(nodeSizeOf(index)).toBeCloseTo(4.5)
  })

  it('is still found by nodeAt and lineAt', () => {
    expect(index.nodes[grid.nodeAt(100_001, 50, 0)]?.tag).toBe('L2-1')
    expect(index.lines[grid.lineAt(60_000, 51, 2)]?.id).toBe('L2')
    expect(index.nodes[grid.nodeAt(1000, 1, 0)]?.tag).toBe('L1-100')
    expect(grid.nodeAt(60_000, 51, 2)).toBe(-1)
  })
})

describe('buildHitGrid on an empty index', () => {
  it('finds nothing', () => {
    const grid = buildHitGrid(indexOf([]), 10)
    expect(grid.nodeAt(0, 0, 100)).toBe(-1)
    expect(grid.lineAt(0, 0, 100)).toBe(-1)
  })
})
