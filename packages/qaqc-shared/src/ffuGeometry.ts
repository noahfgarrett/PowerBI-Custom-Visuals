import type { FfuBounds, FfuIndex } from './ffuMap'

/** Screen = world × scale + offset, on both axes. */
export interface View {
  scale: number
  offsetX: number
  offsetY: number
}

export interface Size {
  width: number
  height: number
}

/** Total padding per axis when fitting, in screen pixels: 12 px on each side. */
export const FIT_PADDING_PX = 24
/** The largest scale is the fit scale × 60. */
export const MAX_SCALE_FACTOR = 60
/** The smallest scale is the fit scale × 0.5. */
export const MIN_SCALE_FACTOR = 0.5

/** Node size when there are too few nodes to measure spacing. */
const DEFAULT_NODE_SIZE = 10
const MIN_NODE_SIZE = 1
/** Node size over the median nearest-neighbour distance: small enough that the group lines show between squares. */
export const NODE_SIZE_OF_SPACING = 0.45
/** Caps the hit grid at this many cells per axis, so a tiny node size on a huge drawing cannot exhaust memory. */
const MAX_GRID_CELLS_PER_AXIS = 1024
/**
 * Grids span the 1st to 99th percentile of each axis rather than the full bounds, so a few far-off nodes cannot
 * stretch the cells until most nodes share a handful of them. Nodes outside sit in the edge cells.
 */
const FRAME_QUANTILE = 0.01

/**
 * Fits the bounds into the viewport, less the padding, and centres them. A point or a line with no extent on one axis
 * fits on the other axis; a single point centres at scale 1. No bounds, or a viewport with no area, gives the identity.
 */
export function fitView(bounds: FfuIndex['bounds'], size: Size): View {
  if (!bounds || !(size.width > 0) || !(size.height > 0)) return { scale: 1, offsetX: 0, offsetY: 0 }
  const extentX = bounds.maxX - bounds.minX
  const extentY = bounds.maxY - bounds.minY
  const availableX = Math.max(size.width - FIT_PADDING_PX, 1)
  const availableY = Math.max(size.height - FIT_PADDING_PX, 1)

  let scale = Number.POSITIVE_INFINITY
  if (extentX > 0) scale = Math.min(scale, availableX / extentX)
  if (extentY > 0) scale = Math.min(scale, availableY / extentY)
  if (!Number.isFinite(scale)) scale = 1

  return {
    scale,
    offsetX: size.width / 2 - ((bounds.minX + bounds.maxX) / 2) * scale,
    offsetY: size.height / 2 - ((bounds.minY + bounds.maxY) / 2) * scale,
  }
}

/** Screen point to world point. */
export function toWorld(view: View, sx: number, sy: number): { x: number; y: number } {
  return { x: (sx - view.offsetX) / view.scale, y: (sy - view.offsetY) / view.scale }
}

/**
 * Multiplies the scale by `factor`, clamped to [fit × MIN_SCALE_FACTOR, fit × MAX_SCALE_FACTOR], keeping the world
 * point under (sx, sy) fixed. A factor or fit scale that is not a positive number leaves the view unchanged.
 */
export function zoomAt(view: View, factor: number, sx: number, sy: number, fitScale: number): View {
  if (!(factor > 0) || !Number.isFinite(factor) || !(fitScale > 0) || !Number.isFinite(fitScale)) return view
  const world = toWorld(view, sx, sy)
  const scale = Math.min(Math.max(view.scale * factor, fitScale * MIN_SCALE_FACTOR), fitScale * MAX_SCALE_FACTOR)
  return { scale, offsetX: sx - world.x * scale, offsetY: sy - world.y * scale }
}

/**
 * Uniform square cells, `columns` × `rows`, with cell (0, 0) starting at (minX, minY). A point outside is clamped into
 * the nearest edge cell. Clamping never moves two points further apart on either axis, so two points whose cells are
 * k columns (or rows) apart are still at least (k - 1) × cellSize apart.
 */
interface GridFrame {
  minX: number
  minY: number
  cellSize: number
  columns: number
  rows: number
}

/** The items of cell c are items[starts[c]] up to items[starts[c + 1]]. */
interface Buckets extends GridFrame {
  starts: Int32Array
  items: Int32Array
}

interface CellRange {
  firstColumn: number
  lastColumn: number
  firstRow: number
  lastRow: number
}

function gridFrame(core: FfuBounds, cellSize: number): GridFrame {
  return {
    minX: core.minX,
    minY: core.minY,
    cellSize,
    columns: Math.floor((core.maxX - core.minX) / cellSize) + 1,
    rows: Math.floor((core.maxY - core.minY) / cellSize) + 1,
  }
}

/** The 1st to 99th percentile of the node coordinates on each axis; the full bounds for fewer than about 100 nodes. */
function coreBounds(index: FfuIndex): FfuBounds {
  const count = index.nodes.length
  const xs = new Float64Array(count)
  const ys = new Float64Array(count)
  index.nodes.forEach((node, i) => {
    xs[i] = node.x
    ys[i] = node.y
  })
  xs.sort()
  ys.sort()
  const low = Math.floor(FRAME_QUANTILE * (count - 1))
  const high = Math.ceil((1 - FRAME_QUANTILE) * (count - 1))
  return { minX: xs[low] ?? 0, minY: ys[low] ?? 0, maxX: xs[high] ?? 0, maxY: ys[high] ?? 0 }
}

function clampCell(value: number, count: number): number {
  return Math.min(Math.max(value, 0), count - 1)
}

function columnOf(frame: GridFrame, x: number): number {
  return clampCell(Math.floor((x - frame.minX) / frame.cellSize), frame.columns)
}

function rowOf(frame: GridFrame, y: number): number {
  return clampCell(Math.floor((y - frame.minY) / frame.cellSize), frame.rows)
}

/** The cells a box covers, clamped into the grid. */
function cellRange(frame: GridFrame, minX: number, minY: number, maxX: number, maxY: number): CellRange {
  return {
    firstColumn: columnOf(frame, minX),
    lastColumn: columnOf(frame, maxX),
    firstRow: rowOf(frame, minY),
    lastRow: rowOf(frame, maxY),
  }
}

/**
 * Two passes over the items: count how many land in each cell, then place them. `rangeOf` gives each item's cell
 * range; a point item covers one cell.
 */
function fillBuckets(
  core: FfuBounds,
  cellSize: number,
  itemCount: number,
  rangeOf: (item: number, frame: GridFrame) => CellRange | null,
): Buckets {
  const frame = gridFrame(core, cellSize)
  const { columns, rows } = frame
  const counts = new Int32Array(columns * rows + 1)

  for (let item = 0; item < itemCount; item += 1) {
    const range = rangeOf(item, frame)
    if (!range) continue
    for (let row = range.firstRow; row <= range.lastRow; row += 1) {
      for (let column = range.firstColumn; column <= range.lastColumn; column += 1) {
        const cell = row * columns + column
        counts[cell + 1] = (counts[cell + 1] ?? 0) + 1
      }
    }
  }
  for (let cell = 1; cell < counts.length; cell += 1) counts[cell] = (counts[cell] ?? 0) + (counts[cell - 1] ?? 0)

  const items = new Int32Array(counts[counts.length - 1] ?? 0)
  const next = counts.slice(0, columns * rows)
  for (let item = 0; item < itemCount; item += 1) {
    const range = rangeOf(item, frame)
    if (!range) continue
    for (let row = range.firstRow; row <= range.lastRow; row += 1) {
      for (let column = range.firstColumn; column <= range.lastColumn; column += 1) {
        const cell = row * columns + column
        const at = next[cell] ?? 0
        items[at] = item
        next[cell] = at + 1
      }
    }
  }
  return { ...frame, starts: counts, items }
}

function nodeBuckets(index: FfuIndex, core: FfuBounds, cellSize: number): Buckets {
  return fillBuckets(core, cellSize, index.nodes.length, (item, frame) => {
    const node = index.nodes[item]
    return node ? cellRange(frame, node.x, node.y, node.x, node.y) : null
  })
}

function median(values: Float64Array): number {
  const sorted = values.slice().sort()
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[middle] ?? 0
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
}

/**
 * Distance from node `self` to its nearest other node. Searches rings of cells outward from the node's cell and stops
 * once the best distance found cannot be beaten by the next ring, whose points are at least `ring × cellSize` away.
 */
function nearestDistance(index: FfuIndex, buckets: Buckets, self: number): number {
  const node = index.nodes[self]
  if (!node) return 0
  const column = columnOf(buckets, node.x)
  const row = rowOf(buckets, node.y)
  const maxRing = Math.max(buckets.columns, buckets.rows)
  let best = Number.POSITIVE_INFINITY

  for (let ring = 0; ring <= maxRing; ring += 1) {
    for (let r = row - ring; r <= row + ring; r += 1) {
      if (r < 0 || r >= buckets.rows) continue
      const onEdgeRow = r === row - ring || r === row + ring
      // Inner rows of a ring only have their two end cells on the ring; ring 0 is a single edge row.
      const step = onEdgeRow ? 1 : 2 * ring
      for (let c = column - ring; c <= column + ring; c += step) {
        if (c < 0 || c >= buckets.columns) continue
        const cell = r * buckets.columns + c
        const end = buckets.starts[cell + 1] ?? 0
        for (let at = buckets.starts[cell] ?? 0; at < end; at += 1) {
          const other = buckets.items[at] ?? -1
          const candidate = index.nodes[other]
          if (other === self || !candidate) continue
          best = Math.min(best, Math.hypot(candidate.x - node.x, candidate.y - node.y))
          if (best === 0) return 0
        }
      }
    }
    if (best <= ring * buckets.cellSize) break
  }
  return Number.isFinite(best) ? best : 0
}

/** NODE_SIZE_OF_SPACING × the median nearest-neighbour distance, at least 1; 10 when there are fewer than 2 nodes. */
export function nodeSizeOf(index: FfuIndex): number {
  const count = index.nodes.length
  if (count < 2) return DEFAULT_NODE_SIZE
  const core = coreBounds(index)
  const extentX = core.maxX - core.minX
  const extentY = core.maxY - core.minY
  const longest = Math.max(extentX, extentY)
  // At least 96% of the nodes share one point, so the median nearest-neighbour distance is 0.
  if (!(longest > 0)) return MIN_NODE_SIZE

  // About one node per cell when the nodes spread over an area, and no more than `count` cells along the longest axis
  // when they lie along a line.
  const cellSize = Math.max(Math.sqrt((extentX * extentY) / count), longest / count)
  const buckets = nodeBuckets(index, core, cellSize)
  const distances = new Float64Array(count)
  for (let node = 0; node < count; node += 1) distances[node] = nearestDistance(index, buckets, node)
  return Math.max(NODE_SIZE_OF_SPACING * median(distances), MIN_NODE_SIZE)
}

export interface HitGrid {
  /** World point and world-unit tolerance; the node index, or -1 when none. */
  nodeAt(x: number, y: number, tolerance: number): number
  /** World point and world-unit tolerance; the line index, or -1 when none. */
  lineAt(x: number, y: number, tolerance: number): number
}

const EMPTY_HIT_GRID: HitGrid = {
  nodeAt: () => -1,
  lineAt: () => -1,
}

function toleranceOf(tolerance: number): number {
  return Number.isFinite(tolerance) && tolerance > 0 ? tolerance : 0
}

function squaredDistanceToSegment(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  const lengthSquared = dx * dx + dy * dy
  const along = lengthSquared > 0 ? Math.min(Math.max(((x - ax) * dx + (y - ay) * dy) / lengthSquared, 0), 1) : 0
  const px = ax + along * dx - x
  const py = ay + along * dy - y
  return px * px + py * py
}

/**
 * Uniform buckets with cell size nodeSize × 2 over the core bounds. Each node sits in its own cell; each segment
 * between consecutive line nodes sits in every cell its bounding box touches. Nodes on no line contribute no segments.
 * Queries take world coordinates: a node hits when the point is within nodeSize / 2 + tolerance of its centre on both
 * axes, a line when a segment is within tolerance; the nearest wins, ties to the lower index.
 */
export function buildHitGrid(index: FfuIndex, nodeSize: number): HitGrid {
  if (index.nodes.length === 0) return EMPTY_HIT_GRID
  const size = Number.isFinite(nodeSize) && nodeSize > 0 ? nodeSize : MIN_NODE_SIZE
  const core = coreBounds(index)
  const longest = Math.max(core.maxX - core.minX, core.maxY - core.minY)
  const cellSize = Math.max(size * 2, longest / MAX_GRID_CELLS_PER_AXIS)
  const nodes = nodeBuckets(index, core, cellSize)

  const segmentStarts: number[] = []
  const segmentEnds: number[] = []
  const segmentLines: number[] = []
  index.lines.forEach((line, lineIndex) => {
    for (let i = 1; i < line.nodes.length; i += 1) {
      segmentStarts.push(line.nodes[i - 1] ?? -1)
      segmentEnds.push(line.nodes[i] ?? -1)
      segmentLines.push(lineIndex)
    }
  })
  const segments = fillBuckets(core, cellSize, segmentLines.length, (item, frame) => {
    const a = index.nodes[segmentStarts[item] ?? -1]
    const b = index.nodes[segmentEnds[item] ?? -1]
    if (!a || !b) return null
    return cellRange(frame, Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y))
  })

  return {
    nodeAt(x: number, y: number, tolerance: number): number {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return -1
      const reach = size / 2 + toleranceOf(tolerance)
      const range = cellRange(nodes, x - reach, y - reach, x + reach, y + reach)
      let best = -1
      let bestDistance = Number.POSITIVE_INFINITY
      for (let row = range.firstRow; row <= range.lastRow; row += 1) {
        for (let column = range.firstColumn; column <= range.lastColumn; column += 1) {
          const cell = row * nodes.columns + column
          const end = nodes.starts[cell + 1] ?? 0
          for (let at = nodes.starts[cell] ?? 0; at < end; at += 1) {
            const nodeIndex = nodes.items[at] ?? -1
            const node = index.nodes[nodeIndex]
            if (!node) continue
            const dx = node.x - x
            const dy = node.y - y
            if (Math.abs(dx) > reach || Math.abs(dy) > reach) continue
            const distance = dx * dx + dy * dy
            if (distance < bestDistance || (distance === bestDistance && nodeIndex < best)) {
              best = nodeIndex
              bestDistance = distance
            }
          }
        }
      }
      return best
    },

    lineAt(x: number, y: number, tolerance: number): number {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return -1
      const reach = toleranceOf(tolerance)
      const range = cellRange(segments, x - reach, y - reach, x + reach, y + reach)
      const reachSquared = reach * reach
      let best = -1
      let bestDistance = Number.POSITIVE_INFINITY
      for (let row = range.firstRow; row <= range.lastRow; row += 1) {
        for (let column = range.firstColumn; column <= range.lastColumn; column += 1) {
          const cell = row * segments.columns + column
          const end = segments.starts[cell + 1] ?? 0
          for (let at = segments.starts[cell] ?? 0; at < end; at += 1) {
            const segment = segments.items[at] ?? -1
            const a = index.nodes[segmentStarts[segment] ?? -1]
            const b = index.nodes[segmentEnds[segment] ?? -1]
            const lineIndex = segmentLines[segment] ?? -1
            if (!a || !b || lineIndex < 0) continue
            const distance = squaredDistanceToSegment(x, y, a.x, a.y, b.x, b.y)
            if (distance > reachSquared) continue
            if (distance < bestDistance || (distance === bestDistance && lineIndex < best)) {
              best = lineIndex
              bestDistance = distance
            }
          }
        }
      }
      return best
    },
  }
}
