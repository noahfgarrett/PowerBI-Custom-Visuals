import { describe, expect, it } from 'vitest'

import type { InspectionTableSource } from '../dataView'
import { FFU_SLOTS, buildFfuIndex, readFfuTable, type FfuIndex, type FfuRole } from '../ffuMap'
import {
  LABEL_MIN_NODE_PX,
  LINE_MIN_CONTRAST,
  LINE_PALETTE,
  drawFfuMap,
  ffuMapColorsFromTheme,
  lineColorOf,
  lineWidthsOf,
  readableLineColor,
  type DrawState,
  type FfuCanvasContext,
  type FfuMapColors,
} from '../ffuMapCanvas'
import { contrastRatio, resolveTheme } from '../theme'

type FfuRecord = Partial<Record<FfuRole, unknown>>

const ALL_ROLES: readonly FfuRole[] = FFU_SLOTS.map((slot) => slot.role)

function source(records: readonly FfuRecord[]): InspectionTableSource {
  return {
    columns: ALL_ROLES.map((role) => ({ roles: { [role]: true } })),
    rows: records.map((record) => ALL_ROLES.map((role) => record[role] ?? null)),
  }
}

function indexOf(records: readonly FfuRecord[]): FfuIndex {
  const result = readFfuTable(source(records))
  if (result.kind !== 'ready') throw new Error(`expected a ready table, got ${result.kind}`)
  return buildFfuIndex(result.rows, result.columns)
}

/** Distinct, valid colours so every assertion can tell the roles apart. */
const COLORS: FfuMapColors = {
  good: '#00AA00',
  bad: '#CC0000',
  unknown: '#888888',
  dim: '#DDDDDD',
  ink: '#111111',
  muted: '#555555',
  accent: '#0044FF',
  grid: '#EEEEEE',
  card: '#FFFFFF',
  palette: LINE_PALETTE,
}

interface RecordedRect {
  x: number
  y: number
  width: number
  height: number
  style: string
}

interface RecordedStroke {
  style: string
  width: number
  rects: number
  segments: number
}

interface RecordedText {
  text: string
  x: number
  y: number
  style: string
}

function styleOf(style: string | CanvasGradient | CanvasPattern): string {
  return typeof style === 'string' ? style : ''
}

/** Records the rects of each filled path with its fill colour, each stroked path, and each fillText. */
class RecordingContext implements FfuCanvasContext {
  fillStyle: string | CanvasGradient | CanvasPattern = ''
  strokeStyle: string | CanvasGradient | CanvasPattern = ''
  lineWidth = 1
  lineCap: CanvasLineCap = 'butt'
  lineJoin: CanvasLineJoin = 'miter'
  font = ''
  textAlign: CanvasTextAlign = 'start'
  textBaseline: CanvasTextBaseline = 'alphabetic'

  readonly filledRects: RecordedRect[] = []
  readonly strokes: RecordedStroke[] = []
  readonly texts: RecordedText[] = []
  /** Every fill and stroke in call order, as `fill <style>` or `stroke <style>`. */
  readonly order: string[] = []
  private pathRects: Omit<RecordedRect, 'style'>[] = []
  private pathSegments = 0

  clearRect(): void {}

  beginPath(): void {
    this.pathRects = []
    this.pathSegments = 0
  }

  moveTo(): void {}

  lineTo(): void {
    this.pathSegments += 1
  }

  rect(x: number, y: number, width: number, height: number): void {
    this.pathRects.push({ x, y, width, height })
  }

  fill(): void {
    const style = styleOf(this.fillStyle)
    for (const rect of this.pathRects) this.filledRects.push({ ...rect, style })
    this.order.push(`fill ${style}`)
  }

  stroke(): void {
    this.strokes.push({
      style: styleOf(this.strokeStyle),
      width: this.lineWidth,
      rects: this.pathRects.length,
      segments: this.pathSegments,
    })
    this.order.push(`stroke ${styleOf(this.strokeStyle)}`)
  }

  fillText(text: string, x: number, y: number): void {
    this.texts.push({ text, x, y, style: styleOf(this.fillStyle) })
  }

  measureText(text: string): { width: number } {
    return { width: text.length * 6 }
  }
}

function stateOf(index: FfuIndex, overrides: Partial<DrawState>): DrawState {
  return {
    view: { scale: 10, offsetX: 5, offsetY: 5 },
    size: { width: 400, height: 300 },
    nodeSize: 1,
    mask: new Uint8Array(index.nodes.length).fill(1),
    hoverLine: -1,
    selected: new Set<number>(),
    selectedLine: -1,
    colors: COLORS,
    ...overrides,
  }
}

function draw(index: FfuIndex, overrides: Partial<DrawState>): RecordingContext {
  const ctx = new RecordingContext()
  drawFfuMap(ctx, index, stateOf(index, overrides))
  return ctx
}

/** Stroked line paths, with widths rounded to 0.01 px so products like 0.18 × 10 compare exactly. */
function lineStrokesOf(ctx: RecordingContext): RecordedStroke[] {
  return ctx.strokes
    .filter((stroke) => stroke.segments > 0)
    .map((stroke) => ({ ...stroke, width: Math.round(stroke.width * 100) / 100 }))
}

/** Rects filled at the node size: the node squares. */
function nodeFills(ctx: RecordingContext, nodePx: number): RecordedRect[] {
  return ctx.filledRects.filter((rect) => rect.width === nodePx && rect.height === nodePx)
}

describe('readableLineColor', () => {
  it('darkens a lime line on white to contrast ≥ 2.5 and leaves a dark line unchanged', () => {
    const lime = '#BFFF00'
    const darkened = readableLineColor(lime, '#FFFFFF')
    expect(darkened).not.toBe(lime)
    expect(contrastRatio(darkened, '#FFFFFF')).toBeGreaterThanOrEqual(LINE_MIN_CONTRAST)
    expect(readableLineColor('#1F3A93', '#FFFFFF')).toBe('#1F3A93')
  })

  it('returns an invalid colour unchanged', () => {
    expect(readableLineColor('lime', '#FFFFFF')).toBe('lime')
  })
})

describe('LINE_PALETTE', () => {
  it('has 12 distinct hues that each reach the line contrast against white', () => {
    expect(new Set(LINE_PALETTE).size).toBe(12)
    for (const color of LINE_PALETTE) expect(contrastRatio(color, '#FFFFFF')).toBeGreaterThanOrEqual(LINE_MIN_CONTRAST)
  })
})

describe('ffuMapColorsFromTheme', () => {
  it('maps unknown to faint, dim to border and grid to hairline, with the fixed palette', () => {
    const theme = resolveTheme({ preset: 'qaqc', backgroundColor: '', backgroundOpacity: 100, cardOpacity: 100, highContrast: null })
    const colors = ffuMapColorsFromTheme(theme)
    expect(colors).toEqual({
      good: theme.colors.good,
      bad: theme.colors.bad,
      unknown: theme.colors.faint,
      dim: theme.colors.border,
      ink: theme.colors.ink,
      muted: theme.colors.muted,
      accent: theme.colors.accent,
      grid: theme.colors.hairline,
      card: theme.colors.card,
      palette: LINE_PALETTE,
    })
  })
})

describe('lineColorOf', () => {
  it('falls back to the palette when the colour is empty', () => {
    const index = indexOf([
      { tag: 'FFU900-ZZ01-F01-A', x: 0, y: 0, line: 'L1', lineOrder: 1 },
      { tag: 'FFU900-ZZ01-F02-A', x: 1, y: 0, line: 'L1', lineOrder: 2 },
      { tag: 'FFU900-ZZ02-F01-A', x: 0, y: 1, line: 'L2', lineOrder: 1 },
      { tag: 'FFU900-ZZ02-F02-A', x: 1, y: 1, line: 'L2', lineOrder: 2 },
    ])
    expect(lineColorOf(index, 0, COLORS)).toBe(LINE_PALETTE[0])
    expect(lineColorOf(index, 1, COLORS)).toBe(LINE_PALETTE[1])
  })

  it('uses the readable form of the line colour when there is one', () => {
    const index = indexOf([
      { tag: 'FFU900-ZZ01-F01-A', x: 0, y: 0, line: 'L1', lineOrder: 1, lineColor: '#BFFF00' },
      { tag: 'FFU900-ZZ01-F02-A', x: 1, y: 0, line: 'L1', lineOrder: 2, lineColor: '#BFFF00' },
    ])
    expect(lineColorOf(index, 0, COLORS)).toBe(readableLineColor('#BFFF00', COLORS.card))
  })
})

describe('lineWidthsOf', () => {
  it('is 0.18 × the node square, at least 1.5 px, with emphasis at twice that', () => {
    expect(lineWidthsOf(2)).toEqual({ base: 1.5, emphasis: 3 })
    expect(lineWidthsOf(0)).toEqual({ base: 1.5, emphasis: 3 })
    expect(lineWidthsOf(Number.NaN)).toEqual({ base: 1.5, emphasis: 3 })
    expect(lineWidthsOf(10).base).toBeCloseTo(1.8)
    expect(lineWidthsOf(10).emphasis).toBeCloseTo(3.6)
  })

  it('caps the base at 4 px and the emphasis at 6 px', () => {
    expect(lineWidthsOf(20).base).toBeCloseTo(3.6)
    expect(lineWidthsOf(20).emphasis).toBe(6)
    expect(lineWidthsOf(100)).toEqual({ base: 4, emphasis: 6 })
  })
})

describe('drawFfuMap', () => {
  it('fills masked-out nodes with the dim colour and matching nodes with good, bad or unknown', () => {
    const index = indexOf([
      { tag: 'FFU900-ZZ01-F01-A', x: 0, y: 0, group: 'G1', energized: 'true' },
      { tag: 'FFU900-ZZ01-F02-A', x: 1, y: 0, group: 'G1', energized: 'false' },
      { tag: 'FFU900-ZZ01-F03-A', x: 2, y: 0 },
      { tag: 'FFU900-ZZ01-F04-A', x: 3, y: 0, group: 'G1', energized: 'true' },
    ])
    const ctx = draw(index, { mask: Uint8Array.from([1, 1, 1, 0]) })
    const fills = nodeFills(ctx, 10).sort((a, b) => a.x - b.x)
    expect(fills.map((rect) => rect.style)).toEqual([COLORS.good, COLORS.bad, COLORS.unknown, COLORS.dim])
  })

  it('does not draw nodes outside the viewport plus a one-node margin', () => {
    // Screen x = 10 * x - 30, so x = 2 sits on the -10 margin and x = 9 on the 60 margin; 0, 1, 10 and 11 are out.
    const records = Array.from({ length: 12 }, (_, x) => ({ tag: `FFU900-ZZ01-F${String(x).padStart(2, '0')}-A`, x, y: 2 }))
    const index = indexOf(records)
    const ctx = draw(index, { view: { scale: 10, offsetX: -30, offsetY: 0 }, size: { width: 50, height: 50 } })
    expect(nodeFills(ctx, 10)).toHaveLength(8)
  })

  it('draws tag labels only at or above LABEL_MIN_NODE_PX', () => {
    const index = indexOf([
      { tag: 'FFU900-ZZ01-F01-A', x: 0, y: 0 },
      { tag: 'FFU900-ZZ01-F02-A', x: 4, y: 0 },
    ])
    const tags = new Set(index.nodes.map((node) => node.tag))
    const labelsAt = (scale: number): number =>
      draw(index, { view: { scale, offsetX: 50, offsetY: 50 }, size: { width: 400, height: 300 } }).texts.filter((text) =>
        tags.has(text.text),
      ).length

    expect(labelsAt(LABEL_MIN_NODE_PX - 0.1)).toBe(0)
    expect(labelsAt(LABEL_MIN_NODE_PX)).toBe(2)
  })

  it('drops a tag label that would overprint a placed label', () => {
    // At scale 36 the nodes are 72 px apart and each 17-character tag is 102 px wide.
    const index = indexOf([
      { tag: 'FFU900-ZZ01-F01-A', x: 0, y: 0 },
      { tag: 'FFU900-ZZ01-F02-A', x: 2, y: 0 },
    ])
    const ctx = draw(index, { view: { scale: LABEL_MIN_NODE_PX, offsetX: 50, offsetY: 50 } })
    expect(ctx.texts.map((text) => text.text)).toEqual(['FFU900-ZZ01-F01-A'])
  })

  it('keeps clear space between neighbouring tag labels', () => {
    // Tags are 102 px wide; centres 105 px apart leave 3 px, under the 4 px kept on each side.
    const index = indexOf([
      { tag: 'FFU900-ZZ01-F01-A', x: 0, y: 0 },
      { tag: 'FFU900-ZZ01-F02-A', x: 105 / LABEL_MIN_NODE_PX, y: 0 },
    ])
    const ctx = draw(index, { view: { scale: LABEL_MIN_NODE_PX, offsetX: 60, offsetY: 50 } })
    expect(ctx.texts.map((text) => text.text)).toEqual(['FFU900-ZZ01-F01-A'])
  })

  it('drops a tag label that would cover another node square', () => {
    const index = indexOf([
      { tag: 'FFU900-ZZ01-F01-A', x: 0, y: 0 },
      { tag: 'FFU900-ZZ01-F02-A', x: 0, y: 1.2 },
    ])
    const ctx = draw(index, { view: { scale: LABEL_MIN_NODE_PX, offsetX: 100, offsetY: 50 } })
    expect(ctx.texts.map((text) => text.text)).toEqual(['FFU900-ZZ01-F02-A'])
  })

  it('drops a tag label that would start under a pinned grid label', () => {
    // The tag's top sits at -10 + 18 + 2 = 10 px, inside the 17 px column-label band.
    const index = indexOf([{ tag: 'FFU900-ZZ01-F01-A', x: 0, y: 0, gridColumn: 'C1' }])
    const ctx = draw(index, { view: { scale: LABEL_MIN_NODE_PX, offsetX: 100, offsetY: -10 } })
    expect(ctx.texts.map((text) => text.text)).toEqual(['C1'])
  })

  it('labels a selected node first, on a card backing', () => {
    const index = indexOf([
      { tag: 'FFU900-ZZ01-F01-A', x: 0, y: 0 },
      { tag: 'FFU900-ZZ01-F02-A', x: 2, y: 0 },
    ])
    const ctx = draw(index, { view: { scale: LABEL_MIN_NODE_PX, offsetX: 50, offsetY: 50 }, selected: new Set([1]) })
    expect(ctx.texts.map((text) => text.text)).toEqual(['FFU900-ZZ01-F02-A'])
    expect(ctx.filledRects.filter((rect) => rect.style === COLORS.card)).toHaveLength(1)
  })

  it('strokes the hovered line over other lines\' squares, refills its own squares, then threads it through them', () => {
    const index = indexOf([
      { tag: 'FFU900-ZZ01-F01-A', x: 0, y: 0, line: 'L1', lineOrder: 1, lineColor: '#1F3A93', energized: 'true' },
      { tag: 'FFU900-ZZ01-F02-A', x: 1, y: 0, line: 'L1', lineOrder: 2, lineColor: '#1F3A93', energized: 'true' },
      { tag: 'FFU900-ZZ01-F03-A', x: 0, y: 1, line: 'L2', lineOrder: 1, lineColor: '#7A1F93', energized: 'false' },
      { tag: 'FFU900-ZZ01-F04-A', x: 1, y: 1, line: 'L2', lineOrder: 2, lineColor: '#7A1F93', energized: 'false' },
    ])
    const ctx = draw(index, { hoverLine: 0 })
    const hovered = ctx.order.indexOf('stroke #1F3A93')
    expect(hovered).toBeGreaterThan(ctx.order.indexOf(`fill ${COLORS.bad}`))
    expect(ctx.order.lastIndexOf(`fill ${COLORS.good}`)).toBeGreaterThan(hovered)
    expect(ctx.order.lastIndexOf(`fill ${COLORS.bad}`)).toBeLessThan(hovered)
    expect(ctx.order.lastIndexOf('stroke #1F3A93')).toBeGreaterThan(ctx.order.lastIndexOf(`fill ${COLORS.good}`))
  })

  it('strokes a line with no matching node in the dim colour', () => {
    const index = indexOf([
      { tag: 'FFU900-ZZ01-F01-A', x: 0, y: 0, line: 'L1', lineOrder: 1, lineColor: '#1F3A93' },
      { tag: 'FFU900-ZZ01-F02-A', x: 1, y: 0, line: 'L1', lineOrder: 2, lineColor: '#1F3A93' },
    ])
    const ctx = draw(index, { mask: Uint8Array.from([0, 0]) })
    const lineStrokes = lineStrokesOf(ctx)
    expect(lineStrokes).toEqual([{ style: COLORS.dim, width: 1.8, rects: 0, segments: 1 }])
  })

  it('colours a segment only when both of its nodes match and dims the rest of the line', () => {
    const index = indexOf([
      { tag: 'FFU900-ZZ01-F01-A', x: 0, y: 0, line: 'L1', lineOrder: 1, lineColor: '#1F3A93' },
      { tag: 'FFU900-ZZ01-F02-A', x: 1, y: 0, line: 'L1', lineOrder: 2, lineColor: '#1F3A93' },
      { tag: 'FFU900-ZZ01-F03-A', x: 2, y: 0, line: 'L1', lineOrder: 3, lineColor: '#1F3A93' },
      { tag: 'FFU900-ZZ01-F04-A', x: 3, y: 0, line: 'L1', lineOrder: 4, lineColor: '#1F3A93' },
    ])
    const ctx = draw(index, { mask: Uint8Array.from([1, 1, 0, 0]) })
    const lineStrokes = lineStrokesOf(ctx)
    expect(lineStrokes).toEqual([
      { style: COLORS.dim, width: 1.8, rects: 0, segments: 2 },
      { style: '#1F3A93', width: 1.8, rects: 0, segments: 1 },
    ])
  })

  it('emphasizes the whole hovered line, dimming its filtered-out segments', () => {
    const index = indexOf([
      { tag: 'FFU900-ZZ01-F01-A', x: 0, y: 0, line: 'L1', lineOrder: 1, lineColor: '#1F3A93' },
      { tag: 'FFU900-ZZ01-F02-A', x: 1, y: 0, line: 'L1', lineOrder: 2, lineColor: '#1F3A93' },
      { tag: 'FFU900-ZZ01-F03-A', x: 2, y: 0, line: 'L1', lineOrder: 3, lineColor: '#1F3A93' },
    ])
    const ctx = draw(index, { hoverLine: 0, mask: Uint8Array.from([1, 1, 0]) })
    const wide = lineStrokesOf(ctx).filter((stroke) => stroke.width === 3.6)
    expect(wide).toEqual([
      { style: COLORS.dim, width: 3.6, rects: 0, segments: 1 },
      { style: '#1F3A93', width: 3.6, rects: 0, segments: 1 },
    ])
  })

  it('scales line widths with the node size on screen', () => {
    // nodeSize 1 at scale 15 is a 15 px square: base 0.18 × 15 = 2.7, emphasis 5.4.
    const index = indexOf([
      { tag: 'FFU900-ZZ01-F01-A', x: 0, y: 0, line: 'L1', lineOrder: 1, lineColor: '#1F3A93' },
      { tag: 'FFU900-ZZ01-F02-A', x: 1, y: 0, line: 'L1', lineOrder: 2, lineColor: '#1F3A93' },
    ])
    const widthsAt = (scale: number, hoverLine: number): number[] =>
      lineStrokesOf(draw(index, { view: { scale, offsetX: 5, offsetY: 5 }, hoverLine })).map((stroke) => stroke.width)
    expect(widthsAt(15, -1)).toEqual([2.7])
    expect(widthsAt(15, 0)).toEqual([5.4, 2.7])
  })

  it('strokes the hovered line in its colour at twice the base width, then at the base width over its squares', () => {
    const index = indexOf([
      { tag: 'FFU900-ZZ01-F01-A', x: 0, y: 0, line: 'L1', lineOrder: 1, lineColor: '#1F3A93' },
      { tag: 'FFU900-ZZ01-F02-A', x: 1, y: 0, line: 'L1', lineOrder: 2, lineColor: '#1F3A93' },
      { tag: 'FFU900-ZZ01-F03-A', x: 2, y: 0, line: 'L1', lineOrder: 3, lineColor: '#1F3A93' },
    ])
    const ctx = draw(index, { hoverLine: 0 })
    const lineStrokes = lineStrokesOf(ctx)
    expect(lineStrokes).toEqual([
      { style: '#1F3A93', width: 3.6, rects: 0, segments: 2 },
      { style: '#1F3A93', width: 1.8, rects: 0, segments: 2 },
    ])
  })

  it('outlines home-run and finish nodes in ink and rings selected nodes in accent on a card halo', () => {
    const index = indexOf([
      { tag: 'FFU900-ZZ01-F01-A', x: 0, y: 0, line: 'L1', lineOrder: 1, homeRun: 'TRUE' },
      { tag: 'FFU900-ZZ01-F02-A', x: 1, y: 0, line: 'L1', lineOrder: 2 },
      { tag: 'FFU900-ZZ01-F03-A', x: 2, y: 0, line: 'L1', lineOrder: 3, finish: 'TRUE' },
    ])
    const ctx = draw(index, { selected: new Set([1]) })
    const rectStrokes = ctx.strokes.filter((stroke) => stroke.rects > 0)
    expect(rectStrokes).toEqual([
      { style: COLORS.ink, width: 1.5, rects: 2, segments: 0 },
      { style: COLORS.card, width: 1.5, rects: 1, segments: 0 },
      { style: COLORS.accent, width: 2, rects: 1, segments: 0 },
    ])
  })

  it('outlines the home run of a filtered-out node in the dim colour', () => {
    const index = indexOf([
      { tag: 'FFU900-ZZ01-F01-A', x: 0, y: 0, line: 'L1', lineOrder: 1, homeRun: 'TRUE' },
      { tag: 'FFU900-ZZ01-F02-A', x: 1, y: 0, line: 'L1', lineOrder: 2, finish: 'TRUE' },
    ])
    const ctx = draw(index, { mask: Uint8Array.from([0, 1]) })
    const rectStrokes = ctx.strokes.filter((stroke) => stroke.rects > 0)
    expect(rectStrokes).toEqual([
      { style: COLORS.ink, width: 1.5, rects: 1, segments: 0 },
      { style: COLORS.dim, width: 1.5, rects: 1, segments: 0 },
    ])
  })

  it('pins grid labels to the top and left edges on a card backing', () => {
    const index = indexOf([
      { tag: 'FFU900-ZZ01-F01-A', x: 0, y: 4, gridColumn: 'C1', gridRow: 'R1' },
      { tag: 'FFU900-ZZ01-F02-A', x: 10, y: 4, gridColumn: 'C2', gridRow: 'R1' },
      { tag: 'FFU900-ZZ01-F03-A', x: 0, y: 14, gridColumn: 'C1', gridRow: 'R2' },
    ])
    const ctx = draw(index, {})
    const columnLabels = ctx.texts.filter((text) => text.text.startsWith('C'))
    const rowLabels = ctx.texts.filter((text) => text.text.startsWith('R'))
    expect(columnLabels.map((text) => [text.text, text.x])).toEqual([
      ['C1', 5],
      ['C2', 105],
    ])
    expect(new Set(columnLabels.map((text) => text.y)).size).toBe(1)
    expect(rowLabels.map((text) => [text.text, text.y])).toEqual([
      ['R1', 45],
      ['R2', 145],
    ])
    expect(ctx.filledRects.filter((rect) => rect.style === COLORS.card)).toHaveLength(4)
  })

  it('skips a grid axis that is null', () => {
    const index = indexOf([
      { tag: 'FFU900-ZZ01-F01-A', x: 0, y: 4 },
      { tag: 'FFU900-ZZ01-F02-A', x: 10, y: 4 },
    ])
    expect(index.gridColumns).toBeNull()
    const ctx = draw(index, {})
    expect(ctx.texts).toHaveLength(0)
    expect(ctx.filledRects.filter((rect) => rect.style === COLORS.card)).toHaveLength(0)
  })

  it('treats a node beyond a short mask as matching', () => {
    const index = indexOf([
      { tag: 'FFU900-ZZ01-F01-A', x: 0, y: 0, group: 'G1', energized: 'true' },
      { tag: 'FFU900-ZZ01-F02-A', x: 1, y: 0, group: 'G1', energized: 'true' },
    ])
    const ctx = draw(index, { mask: Uint8Array.from([0]) })
    const fills = nodeFills(ctx, 10).sort((a, b) => a.x - b.x)
    expect(fills.map((rect) => rect.style)).toEqual([COLORS.dim, COLORS.good])
  })
})
