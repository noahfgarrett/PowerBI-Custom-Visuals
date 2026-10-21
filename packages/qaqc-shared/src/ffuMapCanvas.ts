import type { FfuIndex, FfuNode, GridAxis } from './ffuMap'
import type { Size, View } from './ffuGeometry'
import { compositeOver, contrastRatio, type ResolvedTheme } from './theme'

export interface FfuMapColors {
  good: string
  bad: string
  unknown: string
  dim: string
  ink: string
  muted: string
  accent: string
  grid: string
  card: string
  palette: readonly string[]
}

/** Line colours below this contrast against the card are darkened until they reach it. */
export const LINE_MIN_CONTRAST = 2.5
/** Tag labels are drawn when nodeSize × scale reaches this many CSS pixels. */
export const LABEL_MIN_NODE_PX = 36

/** Twelve mid-saturation hues for lines with no Line Colour, each at contrast ≥ LINE_MIN_CONTRAST on white. */
export const LINE_PALETTE: readonly string[] = [
  '#2F6FB3',
  '#D9731A',
  '#3A9A5B',
  '#B3478F',
  '#7A5CC0',
  '#1C8C99',
  '#B8862B',
  '#C2504A',
  '#5A7D2E',
  '#3E58C6',
  '#9C6644',
  '#7C7F8A',
]

/**
 * The structural subset of CanvasRenderingContext2D the renderer uses, so tests can pass a recording fake. A real
 * 2D context satisfies it.
 */
export interface FfuCanvasContext
  extends Pick<
    CanvasRenderingContext2D,
    | 'fillStyle'
    | 'strokeStyle'
    | 'lineWidth'
    | 'lineCap'
    | 'lineJoin'
    | 'font'
    | 'textAlign'
    | 'textBaseline'
    | 'clearRect'
    | 'beginPath'
    | 'moveTo'
    | 'lineTo'
    | 'rect'
    | 'fill'
    | 'stroke'
    | 'fillText'
  > {
  measureText(text: string): { width: number }
}

export interface DrawState {
  /** Screen = world × scale + offset, in CSS pixels; the caller sets the device-pixel-ratio transform. */
  view: View
  size: Size
  /** World units. */
  nodeSize: number
  /** One byte per node; 0 dims the node. A node beyond the end of the mask counts as matching. */
  mask: Uint8Array
  /** Line index, or -1 when none. */
  hoverLine: number
  /** Node indices. */
  selected: ReadonlySet<number>
  /** Line index, or -1 when none. */
  selectedLine: number
  colors: FfuMapColors
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i
const BLACK = '#000000'
const DARKEN_STEPS = 10

const LINE_WIDTH_PX = 1.5
const EMPHASIS_LINE_WIDTH_PX = LINE_WIDTH_PX * 2
const DIVIDER_WIDTH_PX = 1
const MARKER_SIZE_OF_NODE = 1.6
const MARKER_WIDTH_PX = 1.5
const RING_WIDTH_PX = 2
/** The ring's stroke sits this far outside the node square, so it never covers the status fill. */
const RING_GAP_PX = RING_WIDTH_PX / 2
/** Width of the card-coloured halo just outside the ring's stroke. */
const RING_HALO_PX = 1.5
/** Squares never shrink below one CSS pixel, so a fitted drawing of tens of thousands of nodes stays visible. */
const MIN_NODE_PX = 1

const FONT_FAMILY = 'Inter, "Segoe UI", system-ui, -apple-system, sans-serif'
const TAG_FONT_MIN_PX = 9
const TAG_FONT_MAX_PX = 12
const TAG_GAP_PX = 2
/** Side padding of the card backing behind a selected node's tag. */
const TAG_BACKING_PAD_PX = 2
/** Cell size of the screen grid that keeps tag labels apart. */
const LABEL_CELL_PX = 64
/** Cells per row in the label grid's keys; far more than any canvas is wide. */
const LABEL_CELL_KEY_SPAN = 1 << 16
/** Node pitch over node size: nodeSizeOf takes 0.7 × the median nearest-neighbour distance. */
const NODE_PITCH_OF_SIZE = 1 / 0.7
/** A rough average glyph width, in ems, for sizing tags to the node pitch without measuring each one. */
const CHAR_WIDTH_EM = 0.6

const GRID_FONT_PX = 11
const GRID_LABEL_INSET_PX = 2
const GRID_LABEL_PAD_X_PX = 3
const GRID_LABEL_PAD_Y_PX = 2
const GRID_LABEL_HEIGHT_PX = GRID_FONT_PX + GRID_LABEL_PAD_Y_PX * 2

export function ffuMapColorsFromTheme(theme: ResolvedTheme): FfuMapColors {
  const { colors } = theme
  return {
    good: colors.good,
    bad: colors.bad,
    unknown: colors.faint,
    dim: colors.border,
    ink: colors.ink,
    muted: colors.muted,
    accent: colors.accent,
    grid: colors.hairline,
    card: colors.card,
    palette: LINE_PALETTE,
  }
}

/**
 * Mixes `color` toward black in 10% steps until it reaches LINE_MIN_CONTRAST against `background`, at most 10 steps.
 * A colour that already reaches it, or a colour or background that is not #RRGGBB, is returned unchanged.
 */
export function readableLineColor(color: string, background: string): string {
  if (!HEX_COLOR.test(color) || !HEX_COLOR.test(background)) return color
  if (contrastRatio(color, background) >= LINE_MIN_CONTRAST) return color
  let mixed = color
  for (let step = 1; step <= DARKEN_STEPS; step += 1) {
    mixed = compositeOver(color, 1 - step / DARKEN_STEPS, BLACK)
    if (contrastRatio(mixed, background) >= LINE_MIN_CONTRAST) return mixed
  }
  return mixed
}

/** The readable form of the line's colour against the card, or palette[line % palette length] when it has none. */
export function lineColorOf(index: FfuIndex, line: number, colors: FfuMapColors): string {
  const color = index.lines[line]?.color ?? ''
  if (color !== '') return readableLineColor(color, colors.card)
  const { palette } = colors
  if (palette.length === 0) return colors.muted
  return palette[Math.abs(line) % palette.length] ?? colors.muted
}

/** The screen box nodes and segments must touch to be drawn: the viewport plus a one-node margin. */
interface Viewport {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

function isMatch(mask: Uint8Array, node: number): boolean {
  return mask[node] !== 0
}

function screenX(view: View, x: number): number {
  return x * view.scale + view.offsetX
}

function screenY(view: View, y: number): number {
  return y * view.scale + view.offsetY
}

function isPointVisible(viewport: Viewport, sx: number, sy: number): boolean {
  return sx >= viewport.minX && sx <= viewport.maxX && sy >= viewport.minY && sy <= viewport.maxY
}

function isSegmentVisible(viewport: Viewport, ax: number, ay: number, bx: number, by: number): boolean {
  return (
    Math.max(ax, bx) >= viewport.minX &&
    Math.min(ax, bx) <= viewport.maxX &&
    Math.max(ay, by) >= viewport.minY &&
    Math.min(ay, by) <= viewport.maxY
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Half a CSS pixel off the integer grid, so a 1 px hairline covers one pixel column instead of two half pixels. */
function crisp(value: number): number {
  return Math.round(value) + 0.5
}

function drawDividers(ctx: FfuCanvasContext, state: DrawState, columns: GridAxis | null, rows: GridAxis | null): void {
  const { view, size } = state
  ctx.beginPath()
  let count = 0
  for (const divider of columns?.dividers ?? []) {
    const sx = screenX(view, divider)
    if (sx < 0 || sx > size.width) continue
    ctx.moveTo(crisp(sx), 0)
    ctx.lineTo(crisp(sx), size.height)
    count += 1
  }
  for (const divider of rows?.dividers ?? []) {
    const sy = screenY(view, divider)
    if (sy < 0 || sy > size.height) continue
    ctx.moveTo(0, crisp(sy))
    ctx.lineTo(size.width, crisp(sy))
    count += 1
  }
  if (count === 0) return
  ctx.strokeStyle = state.colors.grid
  ctx.lineWidth = DIVIDER_WIDTH_PX
  ctx.stroke()
}

/** Adds the visible segments of each line to the current path; true when any was added. */
function traceLines(ctx: FfuCanvasContext, index: FfuIndex, view: View, viewport: Viewport, lines: readonly number[]): boolean {
  let traced = false
  for (const lineIndex of lines) {
    const line = index.lines[lineIndex]
    if (!line) continue
    let isPenDown = false
    for (let at = 1; at < line.nodes.length; at += 1) {
      const a = index.nodes[line.nodes[at - 1] ?? -1]
      const b = index.nodes[line.nodes[at] ?? -1]
      if (!a || !b) {
        isPenDown = false
        continue
      }
      const ax = screenX(view, a.x)
      const ay = screenY(view, a.y)
      const bx = screenX(view, b.x)
      const by = screenY(view, b.y)
      if (!isSegmentVisible(viewport, ax, ay, bx, by)) {
        isPenDown = false
        continue
      }
      if (!isPenDown) ctx.moveTo(ax, ay)
      ctx.lineTo(bx, by)
      isPenDown = true
      traced = true
    }
  }
  return traced
}

function strokeLines(
  ctx: FfuCanvasContext,
  index: FfuIndex,
  view: View,
  viewport: Viewport,
  lines: readonly number[],
  color: string,
  width: number,
): void {
  if (lines.length === 0) return
  ctx.beginPath()
  if (!traceLines(ctx, index, view, viewport, lines)) return
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.stroke()
}

function isLineMatched(index: FfuIndex, line: number, mask: Uint8Array): boolean {
  return index.lines[line]?.nodes.some((node) => isMatch(mask, node)) ?? false
}

/** -1 (no line, or nothing hovered or selected) never counts. */
function isEmphasized(state: DrawState, line: number): boolean {
  return line >= 0 && (line === state.hoverLine || line === state.selectedLine)
}

/** Dimmed lines, then lines in colour batched by colour. The hovered and selected lines are left for drawEmphasis. */
function drawLines(ctx: FfuCanvasContext, index: FfuIndex, state: DrawState, viewport: Viewport): void {
  const { view, mask, colors } = state

  const dimmed: number[] = []
  const byColor = new Map<string, number[]>()
  for (let line = 0; line < index.lines.length; line += 1) {
    if (isEmphasized(state, line)) continue
    if (!isLineMatched(index, line, mask)) {
      dimmed.push(line)
      continue
    }
    const color = lineColorOf(index, line, colors)
    const bucket = byColor.get(color)
    if (bucket) bucket.push(line)
    else byColor.set(color, [line])
  }

  strokeLines(ctx, index, view, viewport, dimmed, colors.dim, LINE_WIDTH_PX)
  for (const [color, lines] of byColor) strokeLines(ctx, index, view, viewport, lines, color, LINE_WIDTH_PX)
}

/** The selected and hovered lines, in their colour (or dim when no node on them matches), at `width`. */
function drawEmphasis(ctx: FfuCanvasContext, index: FfuIndex, state: DrawState, viewport: Viewport, width: number): void {
  const { view, mask, colors } = state
  const emphasized = [state.selectedLine, state.hoverLine].filter(
    (line, at, all) => line >= 0 && line < index.lines.length && all.indexOf(line) === at,
  )
  for (const line of emphasized) {
    const color = isLineMatched(index, line, mask) ? lineColorOf(index, line, colors) : colors.dim
    strokeLines(ctx, index, view, viewport, [line], color, width)
  }
}

function nodeFillOf(node: FfuNode, isMatched: boolean, colors: FfuMapColors): string {
  if (!isMatched) return colors.dim
  switch (node.energized) {
    case 'on':
      return colors.good
    case 'off':
      return colors.bad
    case 'unknown':
      return colors.unknown
    default: {
      const unreachable: never = node.energized
      return unreachable
    }
  }
}

/** Node indices whose centres fall inside the viewport. */
function visibleNodes(index: FfuIndex, view: View, viewport: Viewport): number[] {
  const visible: number[] = []
  index.nodes.forEach((node, at) => {
    if (isPointVisible(viewport, screenX(view, node.x), screenY(view, node.y))) visible.push(at)
  })
  return visible
}

/** One path and one fill per fill colour. */
function drawNodes(ctx: FfuCanvasContext, index: FfuIndex, state: DrawState, visible: readonly number[], nodePx: number): void {
  const { view, mask, colors } = state
  const half = nodePx / 2
  const byColor = new Map<string, number[]>()
  for (const at of visible) {
    const node = index.nodes[at]
    if (!node) continue
    const color = nodeFillOf(node, isMatch(mask, at), colors)
    const bucket = byColor.get(color)
    if (bucket) bucket.push(at)
    else byColor.set(color, [at])
  }
  for (const [color, nodes] of byColor) {
    ctx.beginPath()
    for (const at of nodes) {
      const node = index.nodes[at]
      if (!node) continue
      ctx.rect(screenX(view, node.x) - half, screenY(view, node.y) - half, nodePx, nodePx)
    }
    ctx.fillStyle = color
    ctx.fill()
  }
}

/** Strokes a square of `sidePx` centred on each node, as one path. */
function strokeSquares(
  ctx: FfuCanvasContext,
  index: FfuIndex,
  view: View,
  nodes: readonly number[],
  sidePx: number,
  color: string,
  width: number,
): void {
  if (nodes.length === 0) return
  const half = sidePx / 2
  ctx.beginPath()
  for (const at of nodes) {
    const node = index.nodes[at]
    if (!node) continue
    ctx.rect(screenX(view, node.x) - half, screenY(view, node.y) - half, sidePx, sidePx)
  }
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.stroke()
}

interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

/** Screen boxes bucketed into square cells, so a label checks only the boxes near it. */
class BoxGrid {
  private readonly cells = new Map<number, Box[]>()

  private keysOf(box: Box): number[] {
    const keys: number[] = []
    const fromX = Math.floor(box.left / LABEL_CELL_PX)
    const toX = Math.floor(box.right / LABEL_CELL_PX)
    const fromY = Math.floor(box.top / LABEL_CELL_PX)
    const toY = Math.floor(box.bottom / LABEL_CELL_PX)
    for (let cy = fromY; cy <= toY; cy += 1) {
      for (let cx = fromX; cx <= toX; cx += 1) keys.push(cy * LABEL_CELL_KEY_SPAN + cx)
    }
    return keys
  }

  add(box: Box): void {
    for (const key of this.keysOf(box)) {
      const cell = this.cells.get(key)
      if (cell) cell.push(box)
      else this.cells.set(key, [box])
    }
  }

  overlaps(box: Box): boolean {
    for (const key of this.keysOf(box)) {
      for (const other of this.cells.get(key) ?? []) {
        if (box.left < other.right && other.left < box.right && box.top < other.bottom && other.top < box.bottom) return true
      }
    }
    return false
  }
}

/**
 * Tags centred under their nodes, never overprinting one another or the pinned grid labels. Selected nodes are
 * labelled first, on a card backing, wherever they clear the labels already placed; every other label also has to
 * clear the visible squares and end markers.
 */
function drawTags(
  ctx: FfuCanvasContext,
  index: FfuIndex,
  state: DrawState,
  visible: readonly number[],
  nodePx: number,
  pinned: readonly Box[],
): void {
  if (visible.length === 0) return
  const { view, colors } = state
  let longest = 1
  for (const at of visible) longest = Math.max(longest, index.nodes[at]?.tag.length ?? 0)
  const fontPx = Math.round(clamp((nodePx * NODE_PITCH_OF_SIZE) / (CHAR_WIDTH_EM * longest), TAG_FONT_MIN_PX, TAG_FONT_MAX_PX))
  const below = nodePx / 2 + TAG_GAP_PX
  ctx.font = `${fontPx}px ${FONT_FAMILY}`

  // A home-run or finish node is as big as its marker.
  const squares = new BoxGrid()
  for (const at of visible) {
    const node = index.nodes[at]
    if (!node) continue
    const sx = screenX(view, node.x)
    const sy = screenY(view, node.y)
    const half = ((node.homeRun || node.finish ? MARKER_SIZE_OF_NODE : 1) * nodePx) / 2
    squares.add({ left: sx - half, top: sy - half, right: sx + half, bottom: sy + half })
  }
  // The pinned grid labels are drawn last, over everything, so no tag starts under one.
  const labels = new BoxGrid()
  for (const box of pinned) labels.add(box)

  const boxOf = (sx: number, sy: number, tag: string): Box => {
    const width = ctx.measureText(tag).width
    return { left: sx - width / 2, top: sy + below, right: sx + width / 2, bottom: sy + below + fontPx }
  }
  const priority = visible.filter((at) => state.selected.has(at))
  const placed: { tag: string; x: number; y: number }[] = []
  const backings: Box[] = []
  for (const at of priority) {
    const node = index.nodes[at]
    if (!node) continue
    const sx = screenX(view, node.x)
    const sy = screenY(view, node.y)
    const box = boxOf(sx, sy, node.tag)
    if (labels.overlaps(box)) continue
    backings.push(box)
    labels.add(box)
    placed.push({ tag: node.tag, x: sx, y: sy + below })
  }
  for (const at of visible) {
    const node = index.nodes[at]
    if (!node || state.selected.has(at)) continue
    const sx = screenX(view, node.x)
    const sy = screenY(view, node.y)
    const box = boxOf(sx, sy, node.tag)
    if (labels.overlaps(box) || squares.overlaps(box)) continue
    labels.add(box)
    placed.push({ tag: node.tag, x: sx, y: sy + below })
  }

  if (backings.length > 0) {
    ctx.beginPath()
    for (const box of backings) {
      ctx.rect(box.left - TAG_BACKING_PAD_PX, box.top, box.right - box.left + TAG_BACKING_PAD_PX * 2, box.bottom - box.top)
    }
    ctx.fillStyle = colors.card
    ctx.fill()
  }
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillStyle = colors.ink
  for (const label of placed) ctx.fillText(label.tag, label.x, label.y)
}

interface GridLabel {
  text: string
  /** Where the text is anchored: centre-top for a column, left-middle for a row. */
  x: number
  y: number
  /** The card backing. */
  left: number
  top: number
  width: number
}

function columnLabels(ctx: FfuCanvasContext, axis: GridAxis | null, state: DrawState): GridLabel[] {
  const labels: GridLabel[] = []
  for (const { label, at } of axis?.labels ?? []) {
    const sx = screenX(state.view, at)
    const width = ctx.measureText(label).width + GRID_LABEL_PAD_X_PX * 2
    if (sx + width / 2 < 0 || sx - width / 2 > state.size.width) continue
    labels.push({
      text: label,
      x: sx,
      y: GRID_LABEL_INSET_PX + GRID_LABEL_PAD_Y_PX,
      left: sx - width / 2,
      top: GRID_LABEL_INSET_PX,
      width,
    })
  }
  return labels
}

/** Row labels under the column-label band are skipped, so the two edges never overlap in the corner. */
function rowLabels(ctx: FfuCanvasContext, axis: GridAxis | null, state: DrawState, topBand: number): GridLabel[] {
  const labels: GridLabel[] = []
  for (const { label, at } of axis?.labels ?? []) {
    const sy = screenY(state.view, at)
    const top = sy - GRID_LABEL_HEIGHT_PX / 2
    if (top < topBand || top > state.size.height) continue
    const width = ctx.measureText(label).width + GRID_LABEL_PAD_X_PX * 2
    labels.push({ text: label, x: GRID_LABEL_INSET_PX + GRID_LABEL_PAD_X_PX, y: sy, left: GRID_LABEL_INSET_PX, top, width })
  }
  return labels
}

function fillLabels(ctx: FfuCanvasContext, labels: readonly GridLabel[], colors: FfuMapColors): void {
  ctx.beginPath()
  for (const label of labels) ctx.rect(label.left, label.top, label.width, GRID_LABEL_HEIGHT_PX)
  ctx.fillStyle = colors.card
  ctx.fill()
  ctx.fillStyle = colors.muted
  for (const label of labels) ctx.fillText(label.text, label.x, label.y)
}

interface GridLabels {
  columns: GridLabel[]
  rows: GridLabel[]
}

/** Lays out the pinned grid labels; measuring sets the grid font. */
function layoutGridLabels(ctx: FfuCanvasContext, index: FfuIndex, state: DrawState): GridLabels {
  ctx.font = `600 ${GRID_FONT_PX}px ${FONT_FAMILY}`
  const columns = columnLabels(ctx, index.gridColumns, state)
  const topBand = columns.length > 0 ? GRID_LABEL_INSET_PX + GRID_LABEL_HEIGHT_PX : 0
  return { columns, rows: rowLabels(ctx, index.gridRows, state, topBand) }
}

function gridLabelBoxes(labels: GridLabels): Box[] {
  return [...labels.columns, ...labels.rows].map((label) => ({
    left: label.left,
    top: label.top,
    right: label.left + label.width,
    bottom: label.top + GRID_LABEL_HEIGHT_PX,
  }))
}

function drawGridLabels(ctx: FfuCanvasContext, labels: GridLabels, colors: FfuMapColors): void {
  ctx.font = `600 ${GRID_FONT_PX}px ${FONT_FAMILY}`
  if (labels.columns.length > 0) {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    fillLabels(ctx, labels.columns, colors)
  }
  if (labels.rows.length > 0) {
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    fillLabels(ctx, labels.rows, colors)
  }
}

/**
 * Clears and draws the whole map in CSS pixels: grid dividers, lines, nodes, the hovered and selected lines over them,
 * home-run and finish markers, selection rings, tag labels when zoomed in, and the pinned grid labels. Nodes and
 * segments outside the viewport plus a one-node margin are skipped. A viewport with no area or a view that is not
 * finite draws nothing.
 */
export function drawFfuMap(ctx: FfuCanvasContext, index: FfuIndex, state: DrawState): void {
  const { view, size, colors } = state
  if (!(size.width > 0) || !(size.height > 0)) return
  ctx.clearRect(0, 0, size.width, size.height)
  const isViewFinite = Number.isFinite(view.scale) && Number.isFinite(view.offsetX) && Number.isFinite(view.offsetY)
  if (!isViewFinite || !(view.scale > 0)) return

  const scaledNodePx = Number.isFinite(state.nodeSize) && state.nodeSize > 0 ? state.nodeSize * view.scale : 0
  const nodePx = Math.max(scaledNodePx, MIN_NODE_PX)
  const viewport: Viewport = { minX: -nodePx, minY: -nodePx, maxX: size.width + nodePx, maxY: size.height + nodePx }
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  drawDividers(ctx, state, index.gridColumns, index.gridRows)
  drawLines(ctx, index, state, viewport)

  const visible = visibleNodes(index, view, viewport)
  drawNodes(ctx, index, state, visible, nodePx)
  // The hovered and selected lines go over the nodes at twice the width, so the route stays traceable where squares
  // sit close enough to cover a line beneath them. Their own squares then go back on top, so their status still
  // reads, and the line is drawn once more at the base width through their centres.
  drawEmphasis(ctx, index, state, viewport, EMPHASIS_LINE_WIDTH_PX)
  drawNodes(ctx, index, state, visible.filter((at) => isEmphasized(state, index.nodes[at]?.line ?? -1)), nodePx)
  drawEmphasis(ctx, index, state, viewport, LINE_WIDTH_PX)

  // Ends outside the in-visual filters dim with their nodes.
  const ends = visible.filter((at) => index.nodes[at]?.homeRun === true || index.nodes[at]?.finish === true)
  const markerPx = nodePx * MARKER_SIZE_OF_NODE
  strokeSquares(ctx, index, view, ends.filter((at) => isMatch(state.mask, at)), markerPx, colors.ink, MARKER_WIDTH_PX)
  strokeSquares(ctx, index, view, ends.filter((at) => !isMatch(state.mask, at)), markerPx, colors.dim, MARKER_WIDTH_PX)

  const rings: number[] = []
  for (const at of state.selected) {
    const node = index.nodes[at]
    if (node && isPointVisible(viewport, screenX(view, node.x), screenY(view, node.y))) rings.push(at)
  }
  // A card-coloured halo just outside the accent ring keeps it apart from a green or red square beside it, without
  // covering the selected node's own fill.
  const ringPx = nodePx + RING_GAP_PX * 2
  strokeSquares(ctx, index, view, rings, ringPx + RING_WIDTH_PX + RING_HALO_PX, colors.card, RING_HALO_PX)
  strokeSquares(ctx, index, view, rings, ringPx, colors.accent, RING_WIDTH_PX)

  const gridLabels = layoutGridLabels(ctx, index, state)
  if (scaledNodePx >= LABEL_MIN_NODE_PX) drawTags(ctx, index, state, visible, nodePx, gridLabelBoxes(gridLabels))
  drawGridLabels(ctx, gridLabels, colors)
}
