import { describe, expect, it } from 'vitest'

import { buildHitGrid, fitView, nodeSizeOf, type HitGrid } from '../ffuGeometry'
import { buildFfuIndex, readFfuTable, type FfuIndex } from '../ffuMap'
import { syntheticFfuTable, type SyntheticFfuTable } from './fixtures/syntheticFfu'
import { bestOf, elapsed, TIMING_RUNS } from './timing'

const NODE_COUNT = 30_000
const BUILD_BUDGET_MS = 250
const QUERY_BUDGET_MS = 50
const QUERY_COUNT = 10_000
/** Pointer tolerance in screen pixels, converted to world units at the fitted scale, where it is widest. */
const POINTER_TOLERANCE_PX = 4
const VIEWPORT = { width: 1600, height: 900 }

/** The synthetic table with its first node moved far off the floor, as a mis-entered coordinate would be. */
function withOutlier(table: SyntheticFfuTable): SyntheticFfuTable {
  const xColumn = table.columns.findIndex((column) => column.roles['x'] === true)
  const rows = table.rows.map((row, rowIndex) => (rowIndex === 0 ? row.map((cell, i) => (i === xColumn ? 1_000_000 : cell)) : row))
  return { columns: table.columns, rows }
}

function indexOf(table: SyntheticFfuTable): FfuIndex {
  const result = readFfuTable(table)
  if (result.kind !== 'ready') throw new Error(`expected a ready table, got ${result.kind}`)
  return buildFfuIndex(result.rows, result.columns)
}

/** Deterministic query points spread over the bounds; at the fitted tolerance nearly all of them hit a node and a line. */
function queryPoints(index: FfuIndex): Float64Array {
  const bounds = index.bounds
  if (!bounds) throw new Error('expected placed nodes')
  const points = new Float64Array(QUERY_COUNT * 2)
  for (let i = 0; i < QUERY_COUNT; i += 1) {
    points[i * 2] = bounds.minX + ((i * 7919) % 10_007) / 10_007 * (bounds.maxX - bounds.minX)
    points[i * 2 + 1] = bounds.minY + ((i * 104_729) % 10_009) / 10_009 * (bounds.maxY - bounds.minY)
  }
  return points
}

function runQueries(grid: HitGrid, points: Float64Array, tolerance: number): number {
  let hits = 0
  for (let i = 0; i < QUERY_COUNT; i += 1) {
    const x = points[i * 2] ?? 0
    const y = points[i * 2 + 1] ?? 0
    if (grid.nodeAt(x, y, tolerance) >= 0) hits += 1
    if (grid.lineAt(x, y, tolerance) >= 0) hits += 1
  }
  return hits
}

function buildAll(table: SyntheticFfuTable): void {
  const built = indexOf(table)
  buildHitGrid(built, nodeSizeOf(built))
}

describe('FFU map budgets', () => {
  const table = syntheticFfuTable(NODE_COUNT)
  const index = indexOf(table)
  const nodeSize = nodeSizeOf(index)
  const grid = buildHitGrid(index, nodeSize)
  const tolerance = POINTER_TOLERANCE_PX / fitView(index.bounds, VIEWPORT).scale
  const points = queryPoints(index)

  it('places all 30,000 synthetic nodes', () => {
    expect(index.nodes).toHaveLength(NODE_COUNT)
    expect(runQueries(grid, points, tolerance)).toBeGreaterThan(0)
  })

  it('reads, indexes, sizes and grids 30,000 nodes within budget', () => {
    expect(bestOf(TIMING_RUNS, () => elapsed(() => buildAll(table)))).toBeLessThan(BUILD_BUDGET_MS)
  })

  it('answers 10,000 nodeAt and 10,000 lineAt calls within budget', () => {
    expect(bestOf(TIMING_RUNS, () => elapsed(() => runQueries(grid, points, tolerance)))).toBeLessThan(QUERY_BUDGET_MS)
  })
})

describe('FFU map budgets with one far outlier', () => {
  const table = withOutlier(syntheticFfuTable(NODE_COUNT))

  it('sizes and grids 30,000 nodes within budget when one node is far off the floor', () => {
    expect(bestOf(TIMING_RUNS, () => elapsed(() => buildAll(table)))).toBeLessThan(BUILD_BUDGET_MS)
  })
})
