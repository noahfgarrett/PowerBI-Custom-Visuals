import { FFU_PANEL_INSET_PX, ffuPanelLeft } from '../../qaqc-shared/src/components/FfuDetailPanel'
import { NO_FILTERS, matchMask } from '../../qaqc-shared/src/ffuFilters'
import { buildHitGrid, fitView, MAX_SCALE_FACTOR, nodeSizeOf, type Size, type View } from '../../qaqc-shared/src/ffuGeometry'
import type { FfuIndex } from '../../qaqc-shared/src/ffuMap'
import { drawFfuMap, ffuMapColorsFromTheme, LABEL_MIN_NODE_PX } from '../../qaqc-shared/src/ffuMapCanvas'
import type { ResolvedTheme } from '../../qaqc-shared/src/theme'

/**
 * Dev only. `?state=` replays one interaction after load, through the same DOM events a person would cause, so a
 * headless screenshot can show it; `?debug=1` times drawFfuMap on the fitted view. Nothing here is bundled.
 */

export type ScriptedState = 'fit' | 'zoom' | 'hover' | 'node' | 'line' | 'zone' | 'search' | 'searchpick'

const STATES: readonly ScriptedState[] = ['fit', 'zoom', 'hover', 'node', 'line', 'zone', 'search', 'searchpick']

export function scriptedStateOf(value: string | null): ScriptedState {
  return STATES.find((state) => state === value) ?? 'fit'
}

const WHEEL_STEP = 1.2
const WHEEL_DELTA_PX = -100
/** The zoom and hover states zoom until a node square is this many times the label threshold. */
const LABEL_MARGIN = 1.15
const HOVER_NODE_PX = 18
/** Long enough to narrow the list to one bay of a synthetic tag, for example `FFU900-ZZ01-`. */
const SEARCH_PREFIX_LENGTH = 12
const ZONE_VALUE = 'SZ-3'
const TIMING_WARMUP = 3
const TIMING_RUNS = 30
const NODE_HIT_PX = 4
const LINE_HIT_PX = 6

interface Harness {
  canvas: HTMLCanvasElement
  size: Size
  fitted: View
  nodeSize: number
}

const FRAME_MS = 16

/** A timer, not requestAnimationFrame: headless Chrome's virtual time advances timers but may not run frames. */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, FRAME_MS))
}

async function settle(): Promise<void> {
  await nextFrame()
  await nextFrame()
}

async function harnessOf(index: FfuIndex): Promise<Harness> {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const map = document.querySelector('.qaqc-ffu-map')
    const canvas = map?.querySelector('canvas')
    if (map && canvas) {
      const rect = map.getBoundingClientRect()
      const size = { width: Math.floor(rect.width), height: Math.floor(rect.height) }
      if (size.width > 0 && size.height > 0) {
        return { canvas, size, fitted: fitView(index.bounds, size), nodeSize: nodeSizeOf(index) }
      }
    }
    await nextFrame()
  }
  throw new Error('the map never laid out')
}

/** The placed node nearest the middle of the drawing that sits on a line of at least 10 FFUs. */
function centralNode(index: FfuIndex): number {
  const bounds = index.bounds
  if (!bounds) return -1
  const midX = (bounds.minX + bounds.maxX) / 2
  const midY = (bounds.minY + bounds.maxY) / 2
  let best = -1
  let bestDistance = Number.POSITIVE_INFINITY
  index.nodes.forEach((node, at) => {
    if ((index.lines[node.line]?.nodes.length ?? 0) < 10) return
    const distance = Math.hypot(node.x - midX, node.y - midY)
    if (distance < bestDistance) {
      best = at
      bestDistance = distance
    }
  })
  return best
}

function clientPoint(canvas: HTMLCanvasElement, view: View, x: number, y: number): { clientX: number; clientY: number } {
  const rect = canvas.getBoundingClientRect()
  return { clientX: rect.left + x * view.scale + view.offsetX, clientY: rect.top + y * view.scale + view.offsetY }
}

/** Wheel notches that take the fitted view to at least `targetScale`, capped at the visual's zoom limit. */
function notchesTo(harness: Harness, targetScale: number): number {
  const factor = Math.min(targetScale, harness.fitted.scale * MAX_SCALE_FACTOR) / harness.fitted.scale
  return factor > 1 ? Math.ceil(Math.log(factor) / Math.log(WHEEL_STEP)) : 0
}

/** Zooms with the wheel about a node's fitted position; the node stays under that point. */
async function wheelZoomAt(harness: Harness, index: FfuIndex, nodeIndex: number, notches: number): Promise<{ clientX: number; clientY: number }> {
  const node = index.nodes[nodeIndex]
  if (!node) throw new Error('no target node')
  const point = clientPoint(harness.canvas, harness.fitted, node.x, node.y)
  for (let step = 0; step < notches; step += 1) {
    harness.canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: WHEEL_DELTA_PX, deltaMode: 0, bubbles: true, cancelable: true, ...point }))
  }
  await settle()
  return point
}

function pointer(type: string, point: { clientX: number; clientY: number }): PointerEvent {
  return new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', button: 0, buttons: type === 'pointerup' ? 0 : 1, ...point })
}

async function click(canvas: HTMLCanvasElement, point: { clientX: number; clientY: number }): Promise<void> {
  canvas.dispatchEvent(pointer('pointerdown', point))
  canvas.dispatchEvent(pointer('pointerup', point))
  await settle()
}

/** Sets a React-controlled field the way typing or choosing would, through the native setter. */
function setFieldValue(field: HTMLInputElement | HTMLSelectElement, value: string, eventType: string): void {
  const prototype = field instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLSelectElement.prototype
  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(field, value)
  field.dispatchEvent(new Event(eventType, { bubbles: true }))
}

/** The midpoint of the longest fitted segment left of the panel that hits its own line and no node, or null. */
function lineClickPoint(harness: Harness, index: FfuIndex): { x: number; y: number; line: number } | null {
  const grid = buildHitGrid(index, harness.nodeSize)
  const { scale, offsetX } = harness.fitted
  const panelLeft = ffuPanelLeft(harness.size.width) - FFU_PANEL_INSET_PX
  let best: { x: number; y: number; line: number } | null = null
  let bestLength = 0
  index.lines.forEach((line, lineIndex) => {
    for (let at = 1; at < line.nodes.length; at += 1) {
      const a = index.nodes[line.nodes[at - 1] ?? -1]
      const b = index.nodes[line.nodes[at] ?? -1]
      if (!a || !b) continue
      const length = Math.hypot(b.x - a.x, b.y - a.y)
      if (length <= bestLength) continue
      const x = (a.x + b.x) / 2
      const y = (a.y + b.y) / 2
      if (Math.max(a.x, b.x) * scale + offsetX >= panelLeft) continue
      if (grid.nodeAt(x, y, NODE_HIT_PX / scale) >= 0 || grid.lineAt(x, y, LINE_HIT_PX / scale) !== lineIndex) continue
      best = { x, y, line: lineIndex }
      bestLength = length
    }
  })
  return best
}

export async function runScriptedState(state: ScriptedState, index: FfuIndex): Promise<void> {
  const harness = await harnessOf(index)
  await settle()
  const target = centralNode(index)
  const targetNode = index.nodes[target]
  const labelScale = (LABEL_MIN_NODE_PX * LABEL_MARGIN) / harness.nodeSize
  const hoverScale = HOVER_NODE_PX / harness.nodeSize

  switch (state) {
    case 'fit':
      return
    case 'zoom':
      await wheelZoomAt(harness, index, target, notchesTo(harness, labelScale))
      return
    case 'hover': {
      const point = await wheelZoomAt(harness, index, target, notchesTo(harness, hoverScale))
      harness.canvas.dispatchEvent(pointer('pointermove', point))
      await settle()
      return
    }
    case 'node': {
      const point = await wheelZoomAt(harness, index, target, notchesTo(harness, hoverScale))
      await click(harness.canvas, point)
      return
    }
    case 'line': {
      const spot = lineClickPoint(harness, index)
      if (spot) await click(harness.canvas, clientPoint(harness.canvas, harness.fitted, spot.x, spot.y))
      return
    }
    case 'zone': {
      const select = document.querySelector<HTMLSelectElement>('select[aria-label="Zone"]')
      if (select) setFieldValue(select, ZONE_VALUE, 'change')
      await settle()
      return
    }
    case 'search':
    case 'searchpick': {
      const input = document.querySelector<HTMLInputElement>('input[aria-label="Search FFU tags"]')
      if (!input || !targetNode) return
      input.focus()
      setFieldValue(input, state === 'search' ? targetNode.tag.slice(0, SEARCH_PREFIX_LENGTH) : targetNode.tag, 'input')
      await settle()
      if (state === 'searchpick') {
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
        await settle()
      }
      return
    }
    default: {
      const unreachable: never = state
      return unreachable
    }
  }
}

interface Timing {
  median: number
  max: number
}

function timingOf(samples: number[]): Timing {
  const sorted = [...samples].sort((a, b) => a - b)
  return { median: sorted[Math.floor(sorted.length / 2)] ?? 0, max: sorted[sorted.length - 1] ?? 0 }
}

/**
 * Times drawFfuMap on an offscreen canvas the size of the map's backing store, at the fitted view and at the label
 * zoom about the central node: the call alone, and the call plus a one-pixel read that waits for the raster.
 * `ratioOverride` stands in for the device pixel ratio (`?ratio=2`), since headless Chrome's virtual time, which the
 * screenshots need, freezes performance.now(), and a real-time browser may run at 1x.
 */
export async function measureDraw(index: FfuIndex, theme: ResolvedTheme, ratioOverride: number | null): Promise<string> {
  const harness = await harnessOf(index)
  const deviceRatio = window.devicePixelRatio > 0 ? window.devicePixelRatio : 1
  const ratio = ratioOverride !== null && ratioOverride > 0 ? ratioOverride : deviceRatio
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(harness.size.width * ratio)
  canvas.height = Math.round(harness.size.height * ratio)
  const context = canvas.getContext('2d')
  if (!context) return 'no 2D context'
  context.setTransform(ratio, 0, 0, ratio, 0, 0)

  const target = index.nodes[centralNode(index)]
  const labelScale = (LABEL_MIN_NODE_PX * LABEL_MARGIN) / harness.nodeSize
  const zoomed: View = target
    ? {
        scale: labelScale,
        offsetX: harness.size.width / 2 - target.x * labelScale,
        offsetY: harness.size.height / 2 - target.y * labelScale,
      }
    : harness.fitted
  const base = {
    size: harness.size,
    nodeSize: harness.nodeSize,
    mask: matchMask(index, NO_FILTERS),
    hoverLine: -1,
    selected: new Set<number>(),
    selectedLine: -1,
    colors: ffuMapColorsFromTheme(theme),
  }

  const run = (view: View, isFlushed: boolean): Timing => {
    const samples: number[] = []
    for (let at = 0; at < TIMING_WARMUP + TIMING_RUNS; at += 1) {
      const started = performance.now()
      drawFfuMap(context, index, { ...base, view })
      if (isFlushed) context.getImageData(0, 0, 1, 1)
      if (at >= TIMING_WARMUP) samples.push(performance.now() - started)
    }
    return timingOf(samples)
  }
  const format = (timing: Timing): string => `median ${timing.median.toFixed(2)} ms, max ${timing.max.toFixed(2)} ms`

  const fit = run(harness.fitted, false)
  const fitFlushed = run(harness.fitted, true)
  const labels = run(zoomed, false)
  const labelsFlushed = run(zoomed, true)
  return [
    `${index.nodes.length} nodes, ${index.lines.length} lines, ${harness.size.width}×${harness.size.height} @${ratio}x, ${TIMING_RUNS} runs`,
    `fit: draw ${format(fit)} | draw+raster ${format(fitFlushed)}`,
    `labels: draw ${format(labels)} | draw+raster ${format(labelsFlushed)}`,
  ].join(' · ')
}
