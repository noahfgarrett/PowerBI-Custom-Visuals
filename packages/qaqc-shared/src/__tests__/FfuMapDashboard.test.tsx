import { LayoutGrid } from 'lucide-react'
import { act, type ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { TooltipRequest } from '../chartTypes'
import { FfuMapDashboard, type FfuMapDashboardProps } from '../components/FfuMapDashboard'
import { buildFfuIndex, readFfuTable, type FfuColumns, type FfuIndex, type FfuNode } from '../ffuMap'
import { fitView, nodeSizeOf, zoomAt, type View } from '../ffuGeometry'
import type { DrawState, FfuCanvasContext } from '../ffuMapCanvas'
import { LABEL_MIN_NODE_PX } from '../ffuMapCanvas'
import { resolveTheme } from '../theme'
import { syntheticFfuTable } from './fixtures/syntheticFfu'
import { render, type Rendered } from './render'
import { ruleBody } from './stylesheet'

const draws = vi.hoisted(() => {
  const states: DrawState[] = []
  const indexes: FfuIndex[] = []
  return { states, indexes }
})

// Passes through to the real renderer, recording each frame's index and state.
vi.mock('../ffuMapCanvas', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../ffuMapCanvas')>()
  return {
    ...actual,
    drawFfuMap: (...args: Parameters<typeof actual.drawFfuMap>): void => {
      draws.indexes.push(args[1])
      draws.states.push(args[2])
      actual.drawFfuMap(...args)
    },
  }
})

const WIDTH = 800
const HEIGHT = 600
const THEME = resolveTheme({ preset: 'qaqc', backgroundColor: '', backgroundOpacity: 100, cardOpacity: 100, highContrast: null })

function readyTable(count: number): { rows: ReadonlyArray<ReadonlyArray<unknown>>; columns: FfuColumns } {
  const result = readFfuTable(syntheticFfuTable(count))
  if (result.kind !== 'ready') throw new Error(`expected a ready table, got ${result.kind}`)
  return result
}

function indexOf(count: number): FfuIndex {
  const { rows, columns } = readyTable(count)
  return buildFfuIndex(rows, columns)
}

const INDEX = indexOf(200)
const FITTED = fitView(INDEX.bounds, { width: WIDTH, height: HEIGHT })

/** Satisfies the renderer and the dashboard's device-pixel-ratio transform; draws nothing. */
class FakeContext implements FfuCanvasContext {
  fillStyle: string | CanvasGradient | CanvasPattern = ''
  strokeStyle: string | CanvasGradient | CanvasPattern = ''
  lineWidth = 1
  lineCap: CanvasLineCap = 'butt'
  lineJoin: CanvasLineJoin = 'miter'
  font = ''
  textAlign: CanvasTextAlign = 'start'
  textBaseline: CanvasTextBaseline = 'alphabetic'
  setTransform(): void {}
  clearRect(): void {}
  beginPath(): void {}
  moveTo(): void {}
  lineTo(): void {}
  rect(): void {}
  fill(): void {}
  stroke(): void {}
  fillText(): void {}
  measureText(text: string): { width: number } {
    return { width: text.length * 6 }
  }
}

const ORIGINAL_GET_CONTEXT = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'getContext')

let view: Rendered | null = null

beforeEach(() => {
  draws.states.length = 0
  draws.indexes.length = 0
  // jsdom has no 2D context; every canvas gets a fake one.
  const context = new FakeContext()
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, writable: true, value: () => context })
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, WIDTH, HEIGHT))
})

afterEach(() => {
  view?.unmount()
  view = null
  vi.restoreAllMocks()
  if (ORIGINAL_GET_CONTEXT) Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', ORIGINAL_GET_CONTEXT)
})

interface Handlers {
  onSelect: ReturnType<typeof vi.fn<(nodes: number[], multi: boolean) => void>>
  onClear: ReturnType<typeof vi.fn<() => void>>
  onHover: ReturnType<typeof vi.fn<(request: TooltipRequest | null) => void>>
}

function handlers(): Handlers {
  return {
    onSelect: vi.fn<(nodes: number[], multi: boolean) => void>(),
    onClear: vi.fn<() => void>(),
    onHover: vi.fn<(request: TooltipRequest | null) => void>(),
  }
}

function dashboard(spies: Handlers, overrides: Partial<FfuMapDashboardProps> = {}): ReactElement {
  return (
    <FfuMapDashboard
      title="QCx FFU Map"
      icon={LayoutGrid}
      theme={THEME}
      interactive
      loading={false}
      index={INDEX}
      dataVersion={1}
      onSelect={spies.onSelect}
      onClear={spies.onClear}
      onHover={spies.onHover}
      {...overrides}
    />
  )
}

function mount(spies: Handlers, overrides: Partial<FfuMapDashboardProps> = {}): Rendered {
  view = render(dashboard(spies, overrides))
  return view
}

function canvasOf(rendered: Rendered): HTMLCanvasElement {
  const canvas = rendered.container.querySelector('canvas')
  if (!canvas) throw new Error('canvas missing')
  return canvas
}

function nodeAt(index: FfuIndex, nodeIndex: number): FfuNode {
  const node = index.nodes[nodeIndex]
  if (!node) throw new Error(`node ${nodeIndex} missing`)
  return node
}

function screenOf(at: View, x: number, y: number): { x: number; y: number } {
  return { x: x * at.scale + at.offsetX, y: y * at.scale + at.offsetY }
}

interface PointerInit {
  ctrlKey?: boolean
  metaKey?: boolean
}

function pointer(target: Element, type: string, x: number, y: number, init: PointerInit = {}): void {
  act(() => {
    target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, ...init }))
  })
}

function clickAt(target: Element, x: number, y: number, init: PointerInit = {}): void {
  pointer(target, 'pointerdown', x, y, init)
  pointer(target, 'pointerup', x, y, init)
}

function clickNode(rendered: Rendered, nodeIndex: number, init: PointerInit = {}): void {
  const node = nodeAt(INDEX, nodeIndex)
  const point = screenOf(FITTED, node.x, node.y)
  clickAt(canvasOf(rendered), point.x, point.y, init)
}

function press(target: Element): void {
  act(() => {
    target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

function buttonNamed(rendered: Rendered, name: string): HTMLButtonElement {
  const button = [...rendered.container.querySelectorAll('button')].find(
    (candidate) => candidate.getAttribute('aria-label') === name || candidate.textContent === name,
  )
  if (!button) throw new Error(`button ${name} missing`)
  return button
}

function selectNamed(rendered: Rendered, label: string): HTMLSelectElement {
  const select = [...rendered.container.querySelectorAll('select')].find((candidate) => candidate.getAttribute('aria-label') === label)
  if (!select) throw new Error(`select ${label} missing`)
  return select
}

function choose(select: HTMLSelectElement, value: string): void {
  act(() => {
    select.value = value
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

function stat(rendered: Rendered, label: string): string | null {
  const item = [...rendered.container.querySelectorAll('.qaqc-ffu-stat')].find((candidate) => candidate.querySelector('dt')?.textContent === label)
  return item?.querySelector('dd')?.textContent ?? null
}

function panelOf(rendered: Rendered): HTMLElement | null {
  return rendered.container.querySelector('aside')
}

function panelValue(rendered: Rendered, label: string): string | null {
  const panel = panelOf(rendered)
  if (!panel) return null
  const term = [...panel.querySelectorAll('dt')].find((candidate) => candidate.textContent === label)
  return term?.nextElementSibling?.textContent ?? null
}

function lastState(): DrawState {
  const state = draws.states[draws.states.length - 1]
  if (!state) throw new Error('nothing drawn')
  return state
}

function typeInto(input: HTMLInputElement, text: string): void {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, text)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function searchBox(rendered: Rendered): HTMLInputElement {
  const input = rendered.container.querySelector('input[role="combobox"]')
  if (!(input instanceof HTMLInputElement)) throw new Error('search box missing')
  return input
}

describe('FfuMapDashboard', () => {
  it('summary strip shows totals for the unfiltered index', () => {
    const rendered = mount(handlers())
    expect(stat(rendered, 'Total FFUs')).toBe('200')
    expect(stat(rendered, 'Energized')).toBe('148 (74.0%)')
    expect(stat(rendered, 'De-energized')).toBe('48')
    expect(stat(rendered, 'No tracker row')).toBe('4')
    expect(stat(rendered, 'Groups')).toBe('5')
    expect(stat(rendered, 'Group mismatches')).toBe('2')
    expect(stat(rendered, 'Not placed')).toBeNull()
  })

  it('shows Not placed only when some rows could not be placed', () => {
    const { rows, columns } = readyTable(10)
    const withBlankTag = rows.map((row, rowIndex) => (rowIndex === 3 ? row.map((cell, column) => (column === columns.tag ? '' : cell)) : row))
    const rendered = mount(handlers(), { index: buildFfuIndex(withBlankTag, columns) })
    expect(stat(rendered, 'Not placed')).toBe('1')
  })

  it('choosing a zone filter updates the summary but keeps every node drawn', () => {
    const rendered = mount(handlers())
    choose(selectNamed(rendered, 'Zone'), 'SZ-1')

    expect(stat(rendered, 'Total FFUs')).toBe('47')
    const state = lastState()
    expect(draws.indexes[draws.indexes.length - 1]?.nodes).toHaveLength(200)
    expect(state.mask).toHaveLength(200)
    expect(state.mask.filter((value) => value === 1)).toHaveLength(47)
  })

  it('lists All first in every filter, with the energized states by name', () => {
    const rendered = mount(handlers())
    for (const label of ['Zone', 'Group', 'RIO Panel', 'Energized']) {
      expect(selectNamed(rendered, label).options[0]?.textContent).toBe('All')
    }
    expect([...selectNamed(rendered, 'Energized').options].map((option) => option.textContent)).toEqual([
      'All',
      'Energized',
      'De-energized',
      'Unknown',
    ])
  })

  it('draws fitted to the map with the device-pixel-ratio backing size', () => {
    const rendered = mount(handlers())
    const state = lastState()
    expect(state.view).toEqual(FITTED)
    expect(state.size).toEqual({ width: WIDTH, height: HEIGHT })
    expect(state.nodeSize).toBe(nodeSizeOf(INDEX))
    expect(canvasOf(rendered).width).toBe(Math.min(Math.round(WIDTH * window.devicePixelRatio), 4096))
  })

  it('clicking a node calls onSelect with that node and opens its panel', () => {
    const spies = handlers()
    const rendered = mount(spies)
    clickNode(rendered, 5)

    expect(spies.onSelect).toHaveBeenLastCalledWith([5], false)
    expect(panelValue(rendered, 'Tag')).toBe(nodeAt(INDEX, 5).tag)
    expect(panelValue(rendered, 'Line position')).toBe('#6 of 47')
    expect(panelValue(rendered, 'Home run tag')).toBe(nodeAt(INDEX, 0).tag)
    expect([...lastState().selected]).toEqual([5])
    expect(lastState().selectedLine).toBe(-1)
  })

  it('ctrl-click adds to the selection (multi true)', () => {
    const spies = handlers()
    const rendered = mount(spies)
    clickNode(rendered, 5)
    clickNode(rendered, 60, { ctrlKey: true })

    expect(spies.onSelect).toHaveBeenLastCalledWith([5, 60], true)
    expect([...lastState().selected].sort((a, b) => a - b)).toEqual([5, 60])
    expect(panelValue(rendered, 'Tag')).toBe(nodeAt(INDEX, 60).tag)
  })

  it('clicking a line between nodes selects the whole line and opens the group panel', () => {
    const spies = handlers()
    const rendered = mount(spies)
    // Zoomed in, the gap between neighbouring nodes is wider than the node hit box.
    let zoomed = FITTED
    for (let step = 0; step < 4; step += 1) {
      press(buttonNamed(rendered, 'Zoom in'))
      zoomed = zoomAt(zoomed, 1.5, WIDTH / 2, HEIGHT / 2, FITTED.scale)
    }
    expect(lastState().view).toEqual(zoomed)

    const line = INDEX.lines[2]
    if (!line) throw new Error('line 2 missing')
    const a = nodeAt(INDEX, line.nodes[16] ?? -1)
    const b = nodeAt(INDEX, line.nodes[17] ?? -1)
    const point = screenOf(zoomed, (a.x + b.x) / 2, (a.y + b.y) / 2)
    clickAt(canvasOf(rendered), point.x, point.y)

    expect(spies.onSelect).toHaveBeenLastCalledWith(line.nodes, false)
    expect(lastState().selectedLine).toBe(2)
    const panel = panelOf(rendered)
    expect(panel?.querySelector('h3')?.textContent).toBe(line.label)
    const energized = line.nodes.filter((nodeIndex) => nodeAt(INDEX, nodeIndex).energized === 'on').length
    expect(panelValue(rendered, 'Energized')).toBe(`${energized} / ${line.nodes.length}`)
    expect(panelValue(rendered, 'Group mismatches')).toBe('1')
  })

  it('clicking empty space and pressing Esc both call onClear and close the panel', () => {
    const spies = handlers()
    const rendered = mount(spies)
    clickNode(rendered, 5)
    expect(panelOf(rendered)).not.toBeNull()

    clickAt(canvasOf(rendered), 5, 5)
    expect(spies.onClear).toHaveBeenCalledTimes(1)
    expect(panelOf(rendered)).toBeNull()
    expect(lastState().selected.size).toBe(0)

    clickNode(rendered, 5)
    act(() => {
      canvasOf(rendered).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(spies.onClear).toHaveBeenCalledTimes(2)
    expect(panelOf(rendered)).toBeNull()
  })

  it('the close button closes the panel', () => {
    const rendered = mount(handlers())
    clickNode(rendered, 5)
    press(buttonNamed(rendered, 'Close panel'))
    expect(panelOf(rendered)).toBeNull()
  })

  it('a de-energized tag in the group panel opens that node\'s panel', () => {
    const spies = handlers()
    const rendered = mount(spies)
    for (let step = 0; step < 4; step += 1) press(buttonNamed(rendered, 'Zoom in'))
    let zoomed = FITTED
    for (let step = 0; step < 4; step += 1) zoomed = zoomAt(zoomed, 1.5, WIDTH / 2, HEIGHT / 2, FITTED.scale)
    const line = INDEX.lines[2]
    if (!line) throw new Error('line 2 missing')
    const a = nodeAt(INDEX, line.nodes[16] ?? -1)
    const b = nodeAt(INDEX, line.nodes[17] ?? -1)
    const point = screenOf(zoomed, (a.x + b.x) / 2, (a.y + b.y) / 2)
    clickAt(canvasOf(rendered), point.x, point.y)

    const off = line.nodes.find((nodeIndex) => nodeAt(INDEX, nodeIndex).energized === 'off')
    if (off === undefined) throw new Error('no de-energized node on line 2')
    const tags = [...(panelOf(rendered)?.querySelectorAll('li button') ?? [])].map((button) => button.textContent)
    expect(tags).toEqual(line.nodes.filter((nodeIndex) => nodeAt(INDEX, nodeIndex).energized === 'off').map((nodeIndex) => nodeAt(INDEX, nodeIndex).tag))

    press(buttonNamed(rendered, nodeAt(INDEX, off).tag))
    expect(spies.onSelect).toHaveBeenLastCalledWith([off], false)
    expect(panelValue(rendered, 'Tag')).toBe(nodeAt(INDEX, off).tag)
    expect(panelValue(rendered, 'Energized')).toBe('De-energized')
  })

  it('search lists up to 8 matches and choosing one selects it', () => {
    const spies = handlers()
    const rendered = mount(spies)
    const input = searchBox(rendered)
    typeInto(input, 'ffu9')

    const options = [...rendered.container.querySelectorAll('[role="option"]')]
    expect(options).toHaveLength(8)
    expect(input.getAttribute('aria-expanded')).toBe('true')

    const target = INDEX.nodes.findIndex((node) => node.tag === options[3]?.textContent)
    press(options[3] ?? document.body)

    expect(spies.onSelect).toHaveBeenLastCalledWith([target], false)
    expect(panelValue(rendered, 'Tag')).toBe(nodeAt(INDEX, target).tag)
    expect(rendered.container.querySelectorAll('[role="option"]')).toHaveLength(0)

    const state = lastState()
    expect(state.nodeSize * state.view.scale).toBeCloseTo(LABEL_MIN_NODE_PX * 1.5)
    const node = nodeAt(INDEX, target)
    const centre = screenOf(state.view, node.x, node.y)
    expect(centre.x).toBeCloseTo(WIDTH / 2)
    expect(centre.y).toBeCloseTo(HEIGHT / 2)
  })

  it('search picks a match with the arrow keys and Enter', () => {
    const spies = handlers()
    const rendered = mount(spies)
    const input = searchBox(rendered)
    typeInto(input, 'ffu9')
    const second = rendered.container.querySelectorAll('[role="option"]')[1]?.textContent
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    })
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    expect(panelValue(rendered, 'Tag')).toBe(second)
  })

  it('hovering a node shows its tooltip and highlights its line; leaving clears both', () => {
    const spies = handlers()
    const rendered = mount(spies)
    const node = nodeAt(INDEX, 5)
    const point = screenOf(FITTED, node.x, node.y)
    pointer(canvasOf(rendered), 'pointermove', point.x, point.y)

    expect(spies.onHover).toHaveBeenLastCalledWith({
      clientX: point.x,
      clientY: point.y,
      title: node.tag,
      rows: [
        { label: 'Group', value: node.group },
        { label: 'Energized', value: 'De-energized' },
        { label: 'Line position', value: '#6 of 47' },
      ],
    })
    expect(lastState().hoverLine).toBe(0)

    act(() => {
      canvasOf(rendered).dispatchEvent(new MouseEvent('pointerout', { bubbles: true, relatedTarget: document.body }))
    })
    expect(spies.onHover).toHaveBeenLastCalledWith(null)
    expect(lastState().hoverLine).toBe(-1)
  })

  it('dragging pans the map without selecting', () => {
    const spies = handlers()
    const rendered = mount(spies)
    const canvas = canvasOf(rendered)
    const node = nodeAt(INDEX, 5)
    const start = screenOf(FITTED, node.x, node.y)
    pointer(canvas, 'pointerdown', start.x, start.y)
    pointer(canvas, 'pointermove', start.x + 30, start.y + 10)
    pointer(canvas, 'pointerup', start.x + 30, start.y + 10)

    expect(spies.onSelect).not.toHaveBeenCalled()
    expect(spies.onClear).not.toHaveBeenCalled()
    const panned = lastState().view
    expect(panned.scale).toBe(FITTED.scale)
    expect(panned.offsetX).toBeCloseTo(FITTED.offsetX + 30)
    expect(panned.offsetY).toBeCloseTo(FITTED.offsetY + 10)
  })

  it('the mouse wheel zooms about the cursor, and Fit restores the fitted view', () => {
    const rendered = mount(handlers())
    act(() => {
      canvasOf(rendered).dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -100, clientX: 200, clientY: 150 }))
    })
    expect(lastState().view).toEqual(zoomAt(FITTED, 1.2, 200, 150, FITTED.scale))

    press(buttonNamed(rendered, 'Fit to map'))
    expect(lastState().view).toEqual(FITTED)
  })

  it('a dataVersion change clears the selection and closes the panel', () => {
    const spies = handlers()
    const rendered = mount(spies)
    clickNode(rendered, 5)
    press(buttonNamed(rendered, 'Zoom in'))
    typeInto(searchBox(rendered), 'ffu9')

    rendered.rerender(dashboard(spies, { dataVersion: 2 }))

    expect(panelOf(rendered)).toBeNull()
    expect(lastState().selected.size).toBe(0)
    expect(lastState().selectedLine).toBe(-1)
    expect(lastState().view).toEqual(FITTED)
    expect(searchBox(rendered).value).toBe('')
  })

  it('non-interactive mode disables selection', () => {
    const spies = handlers()
    const rendered = mount(spies, { interactive: false })
    clickNode(rendered, 5)

    expect(spies.onSelect).not.toHaveBeenCalled()
    expect(panelOf(rendered)).toBeNull()
    for (const label of ['Zone', 'Group', 'RIO Panel', 'Energized']) expect(selectNamed(rendered, label).disabled).toBe(true)
    expect(searchBox(rendered).disabled).toBe(true)

    press(buttonNamed(rendered, 'Zoom in'))
    expect(lastState().view).toEqual(zoomAt(FITTED, 1.5, WIDTH / 2, HEIGHT / 2, FITTED.scale))
  })

  it('empty and unplaceable states render their status panels', () => {
    const { rows, columns } = readyTable(3)
    const empty = mount(handlers(), { index: buildFfuIndex([], columns) })
    expect(empty.container.querySelector('[role="status"] h2')?.textContent).toBe('No FFUs to show')
    expect(empty.container.querySelector('canvas')).toBeNull()
    empty.unmount()

    const blankTags = rows.map((row) => row.map((cell, column) => (column === columns.tag ? '' : cell)))
    const unplaceable = mount(handlers(), { index: buildFfuIndex(blankTags, columns) })
    expect(unplaceable.container.querySelector('[role="status"] h2')?.textContent).toBe('No FFUs could be placed')
    expect([...unplaceable.container.querySelectorAll('[role="status"] li')].map((item) => item.textContent)).toEqual([
      '3 rows have a blank tag or a missing X or Y',
    ])
  })
})

describe('FfuMapDashboard stylesheet', () => {
  // jsdom cannot lay out the stylesheet, so these read the rules that keep small tiles usable.
  it('wraps the header controls on narrow tiles', () => {
    expect(ruleBody('.qaqc-ffu-header')).toContain('flex-wrap: wrap;')
    expect(ruleBody('.qaqc-ffu-controls')).toContain('flex-wrap: wrap;')
  })

  it('keeps the panel at most 300 px wide and clear of the bottom-left zoom controls', () => {
    const panel = ruleBody('.qaqc-ffu-panel')
    expect(panel).toContain('right: 8px;')
    expect(panel).toContain('width: 300px;')
    expect(panel).toContain('max-width: calc(100% - 124px);')
    const zoom = ruleBody('.qaqc-ffu-zoom')
    expect(zoom).toContain('left: 8px;')
    expect(zoom).toContain('bottom: 8px;')
    expect(ruleBody('.qaqc-ffu-icon-button')).toContain('width: 28px;')
  })
})
