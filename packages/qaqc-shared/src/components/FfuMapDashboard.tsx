import { Inbox, Maximize, MapPinOff, Search, ZoomIn, ZoomOut, type LucideIcon } from 'lucide-react'
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
} from 'react'

import type { TooltipHandler } from '../chartTypes'
import { filterOptions, matchMask, NO_FILTERS, searchTags, summarize, type FfuFilters, type FfuSummary, type FilterOptions } from '../ffuFilters'
import { buildHitGrid, fitView, MAX_SCALE_FACTOR, MIN_SCALE_FACTOR, nodeSizeOf, toWorld, zoomAt, type View } from '../ffuGeometry'
import type { Energized, FfuIndex } from '../ffuMap'
import { drawFfuMap, ffuMapColorsFromTheme, LABEL_MIN_NODE_PX, type FfuCanvasContext } from '../ffuMapCanvas'
import { formatCount, formatPercent } from '../format'
import { useElementSize } from '../hooks/useElementSize'
import type { ResolvedTheme } from '../theme'
import {
  energizedLabel,
  FFU_PANEL_INSET_PX,
  FfuDetailPanel,
  ffuPanelLeft,
  linePosition,
  orBlank,
  type FfuPanelTarget,
} from './FfuDetailPanel'
import { LoadingBar } from './LoadingBar'
import { StatusPanel } from './StatusPanel'

export interface FfuMapDashboardProps {
  title: string
  icon: LucideIcon
  theme: ResolvedTheme
  interactive: boolean
  loading: boolean
  index: FfuIndex
  /** Bumps on every data update; resets selection, panel, search and view. */
  dataVersion: number
  /** Node indices; `multi` when Ctrl or Meta was held. */
  onSelect: (nodes: number[], multi: boolean) => void
  onClear: () => void
  onHover: TooltipHandler
}

/** A press that moves no further than this is a click; beyond it, a drag that pans. */
const CLICK_SLOP_PX = 3
const NODE_HIT_PX = 4
const LINE_HIT_PX = 6
const WHEEL_ZOOM_STEP = 1.2
const BUTTON_ZOOM_STEP = 1.5
const WHEEL_PIXELS_PER_NOTCH = 100
const WHEEL_LINES_PER_NOTCH = 3
/** A chosen search result is zoomed until its square is this many CSS pixels wide, so its tag label shows. */
const SEARCH_NODE_PX = LABEL_MIN_NODE_PX * 1.5
/** The canvas backing store never exceeds this many device pixels per side. */
const MAX_BACKING_PX = 4096

/** The renderer's context plus the device-pixel-ratio transform; a real 2D context satisfies it. */
interface MapCanvasContext extends FfuCanvasContext {
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void
}

interface Selection {
  nodes: ReadonlySet<number>
  /** The last clicked line, or -1 after a node click. */
  line: number
  panel: FfuPanelTarget | null
}

const EMPTY_SELECTION: Selection = { nodes: new Set<number>(), line: -1, panel: null }

/** A primary-button press on the canvas, in canvas pixels. */
interface Press {
  startX: number
  startY: number
  lastX: number
  lastY: number
  isDragging: boolean
}

interface SearchState {
  query: string
  isOpen: boolean
  /** Index into the results, or -1 when none is highlighted. */
  active: number
}

const EMPTY_SEARCH: SearchState = { query: '', isOpen: false, active: -1 }

function energizedFilterOf(value: string): Energized | null {
  if (value === 'on' || value === 'off' || value === 'unknown') return value
  return null
}

function keepIfListed(value: string | null, options: readonly string[]): string | null {
  return value !== null && options.includes(value) ? value : null
}

/** Drops a filter value the current data no longer has, so a stale choice cannot hide every node. */
function activeFilters(filters: FfuFilters, options: FilterOptions): FfuFilters {
  return {
    zone: keepIfListed(filters.zone, options.zones),
    group: keepIfListed(filters.group, options.groups),
    rioPanel: keepIfListed(filters.rioPanel, options.rioPanels),
    energized: filters.energized,
  }
}

/** Wheel notches, negative when zooming in; line and page deltas are scaled to notches as well as pixel ones. */
function wheelNotches(event: WheelEvent): number {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return event.deltaY / WHEEL_LINES_PER_NOTCH
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) return event.deltaY
  return event.deltaY / WHEEL_PIXELS_PER_NOTCH
}

/**
 * Where a searched FFU is centred across the map. The map's centre, unless the node panel it opens would cover the
 * node there; then the centre of the strip left of the panel, less the panel's gap.
 */
function searchCentreX(mapWidth: number): number {
  const visibleRight = ffuPanelLeft(mapWidth) - FFU_PANEL_INSET_PX
  if (mapWidth / 2 + SEARCH_NODE_PX / 2 <= visibleRight) return mapWidth / 2
  return Math.max(visibleRight, 0) / 2
}

function backingSize(cssPixels: number, ratio: number): number {
  return Math.max(1, Math.min(Math.round(cssPixels * ratio), MAX_BACKING_PX))
}

function localPoint(element: Element, clientX: number, clientY: number): { x: number; y: number } {
  const rect = element.getBoundingClientRect()
  return { x: clientX - rect.left, y: clientY - rect.top }
}

interface StatItem {
  label: string
  value: string
}

function summaryItems(summary: FfuSummary): StatItem[] {
  const energized =
    summary.percentEnergized === null
      ? formatCount(summary.energized)
      : `${formatCount(summary.energized)} (${formatPercent(summary.percentEnergized, 1)})`
  const items: StatItem[] = [
    { label: 'Total FFUs', value: formatCount(summary.total) },
    { label: 'Energized', value: energized },
    { label: 'De-energized', value: formatCount(summary.deEnergized) },
    { label: 'No tracker row', value: formatCount(summary.noTracker) },
    { label: 'Groups', value: formatCount(summary.groups) },
    { label: 'Group mismatches', value: formatCount(summary.mismatches) },
  ]
  if (summary.notPlaced > 0) items.push({ label: 'Not placed', value: formatCount(summary.notPlaced) })
  return items
}

interface FilterSelectProps {
  label: string
  value: string
  options: readonly { value: string; text: string }[]
  disabled: boolean
  onChange: (value: string) => void
}

function FilterSelect({ label, value, options, disabled, onChange }: FilterSelectProps): ReactElement {
  return (
    <label className="qaqc-ffu-filter">
      <span>{label}</span>
      <select aria-label={label} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        <option value="">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.text}
          </option>
        ))}
      </select>
    </label>
  )
}

function plainOptions(values: readonly string[]): { value: string; text: string }[] {
  return values.map((value) => ({ value, text: value }))
}

const ENERGIZED_OPTIONS: readonly { value: Energized; text: string }[] = [
  { value: 'on', text: energizedLabel('on') },
  { value: 'off', text: energizedLabel('off') },
  { value: 'unknown', text: energizedLabel('unknown') },
]

/**
 * The FFU map: header with search and filters, a summary strip, and the canvas map with its detail panel. With no
 * placed nodes it shows a status panel instead; the map only mounts with nodes, so its size observer attaches.
 */
export function FfuMapDashboard(props: FfuMapDashboardProps): ReactElement {
  const { index, loading } = props
  if (index.nodes.length > 0) return <FfuMapView {...props} />

  const isUnplaceable = index.notPlaced > 0
  const unplacedRows = index.notPlaced === 1 ? '1 row has' : `${formatCount(index.notPlaced)} rows have`
  return (
    <div className="qaqc-root qaqc-ffu-root">
      <LoadingBar active={loading} />
      {isUnplaceable ? (
        <StatusPanel
          icon={MapPinOff}
          title="No FFUs could be placed"
          message="Every row needs an FFU Tag and a numeric X and Y."
          items={[`${unplacedRows} a blank tag or a missing X or Y`]}
        />
      ) : (
        <StatusPanel icon={Inbox} title="No FFUs to show" message="The bound table has no rows." items={[]} />
      )}
    </div>
  )
}

function FfuMapView({
  title,
  icon: Icon,
  theme,
  interactive,
  loading,
  index,
  dataVersion,
  onSelect,
  onClear,
  onHover,
}: FfuMapDashboardProps): ReactElement {
  const [mapRef, size] = useElementSize<HTMLDivElement>()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const pressRef = useRef<Press | null>(null)
  const hoverNodeRef = useRef(-1)
  const listboxId = useId()

  /** null while the map shows the fitted view, which then follows resizes. */
  const [view, setView] = useState<View | null>(null)
  const [selection, setSelection] = useState<Selection>(EMPTY_SELECTION)
  const [hoverLine, setHoverLine] = useState(-1)
  const [filters, setFilters] = useState<FfuFilters>(NO_FILTERS)
  const [search, setSearch] = useState<SearchState>(EMPTY_SEARCH)
  const [seenVersion, setSeenVersion] = useState(dataVersion)

  // A data update starts over: no selection, panel, hover or search, and the fitted view.
  if (seenVersion !== dataVersion) {
    setSeenVersion(dataVersion)
    setView(null)
    setSelection(EMPTY_SELECTION)
    setHoverLine(-1)
    setSearch(EMPTY_SEARCH)
  }

  const nodeSize = useMemo(() => nodeSizeOf(index), [index])
  const hitGrid = useMemo(() => buildHitGrid(index, nodeSize), [index, nodeSize])
  const options = useMemo(() => filterOptions(index), [index])
  const active = useMemo(() => activeFilters(filters, options), [filters, options])
  const mask = useMemo(() => matchMask(index, active), [index, active])
  const summary = useMemo(() => summarize(index, mask), [index, mask])
  const results = useMemo(() => searchTags(index, search.query), [index, search.query])
  const colors = useMemo(() => ffuMapColorsFromTheme(theme), [theme])
  const fitted = useMemo(() => fitView(index.bounds, size), [index.bounds, size])
  const shownView = view ?? fitted

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !(size.width > 0) || !(size.height > 0)) return undefined
    const frame = requestAnimationFrame(() => {
      const context: MapCanvasContext | null = canvas.getContext('2d')
      if (!context) return
      const ratio = window.devicePixelRatio > 0 ? window.devicePixelRatio : 1
      const width = backingSize(size.width, ratio)
      const height = backingSize(size.height, ratio)
      if (canvas.width !== width) canvas.width = width
      if (canvas.height !== height) canvas.height = height
      context.setTransform(width / size.width, 0, 0, height / size.height, 0, 0)
      drawFfuMap(context, index, {
        view: shownView,
        size,
        nodeSize,
        mask,
        hoverLine,
        selected: selection.nodes,
        selectedLine: selection.line,
        colors,
      })
    })
    return () => cancelAnimationFrame(frame)
  }, [index, shownView, size, nodeSize, mask, hoverLine, selection, colors])

  // React's wheel listener is passive, so the page would scroll too; this one can cancel it.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault()
      const notches = wheelNotches(event)
      if (notches === 0 || !Number.isFinite(notches)) return
      const point = localPoint(canvas, event.clientX, event.clientY)
      setView((current) => zoomAt(current ?? fitted, WHEEL_ZOOM_STEP ** -notches, point.x, point.y, fitted.scale))
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [fitted])

  function zoomBy(factor: number): void {
    setView((current) => zoomAt(current ?? fitted, factor, size.width / 2, size.height / 2, fitted.scale))
  }

  function select(nodes: readonly number[], line: number, panel: FfuPanelTarget, isMulti: boolean): void {
    const next = new Set<number>(isMulti ? selection.nodes : [])
    for (const node of nodes) next.add(node)
    setSelection({ nodes: next, line, panel })
    onSelect([...next], isMulti)
  }

  function clear(): void {
    setSelection(EMPTY_SELECTION)
    onClear()
  }

  function clearHover(): void {
    if (hoverNodeRef.current < 0) return
    hoverNodeRef.current = -1
    setHoverLine(-1)
    onHover(null)
  }

  function nodeUnder(x: number, y: number): number {
    const world = toWorld(shownView, x, y)
    return hitGrid.nodeAt(world.x, world.y, NODE_HIT_PX / shownView.scale)
  }

  function clickAt(x: number, y: number, isMulti: boolean): void {
    if (!interactive) return
    const node = nodeUnder(x, y)
    if (node >= 0) {
      select([node], -1, { kind: 'node', node }, isMulti)
      return
    }
    const world = toWorld(shownView, x, y)
    const lineIndex = hitGrid.lineAt(world.x, world.y, LINE_HIT_PX / shownView.scale)
    const line = index.lines[lineIndex]
    if (line) {
      select(line.nodes, lineIndex, { kind: 'line', line: lineIndex }, isMulti)
      return
    }
    clear()
  }

  function hoverAt(x: number, y: number, clientX: number, clientY: number): void {
    const nodeIndex = nodeUnder(x, y)
    const node = index.nodes[nodeIndex]
    if (!node) {
      clearHover()
      return
    }
    hoverNodeRef.current = nodeIndex
    setHoverLine(node.line)
    onHover({
      clientX,
      clientY,
      title: node.tag,
      rows: [
        { label: 'Group', value: orBlank(node.group) },
        { label: 'Energized', value: energizedLabel(node.energized) },
        { label: 'Line position', value: linePosition(index, node) },
      ],
    })
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>): void {
    if (event.button !== 0) return
    const canvas = event.currentTarget
    const point = localPoint(canvas, event.clientX, event.clientY)
    pressRef.current = { startX: point.x, startY: point.y, lastX: point.x, lastY: point.y, isDragging: false }
    // Capture keeps the drag going when the pointer leaves the canvas; jsdom has no pointer capture.
    if (typeof canvas.setPointerCapture === 'function') canvas.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>): void {
    const point = localPoint(event.currentTarget, event.clientX, event.clientY)
    const press = pressRef.current
    if (!press) {
      hoverAt(point.x, point.y, event.clientX, event.clientY)
      return
    }
    if (!press.isDragging && Math.hypot(point.x - press.startX, point.y - press.startY) <= CLICK_SLOP_PX) return
    if (!press.isDragging) {
      press.isDragging = true
      clearHover()
    }
    const dx = point.x - press.lastX
    const dy = point.y - press.lastY
    press.lastX = point.x
    press.lastY = point.y
    setView((current) => {
      const from = current ?? fitted
      return { scale: from.scale, offsetX: from.offsetX + dx, offsetY: from.offsetY + dy }
    })
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLCanvasElement>): void {
    const press = pressRef.current
    pressRef.current = null
    if (!press || press.isDragging) return
    const point = localPoint(event.currentTarget, event.clientX, event.clientY)
    if (Math.hypot(point.x - press.startX, point.y - press.startY) > CLICK_SLOP_PX) return
    clickAt(point.x, point.y, event.ctrlKey || event.metaKey)
  }

  function handlePointerCancel(): void {
    pressRef.current = null
  }

  function handleRootKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    if (event.key !== 'Escape' || !interactive) return
    clear()
  }

  function chooseResult(nodeIndex: number): void {
    const node = index.nodes[nodeIndex]
    if (!node) return
    const scale = Math.min(Math.max(SEARCH_NODE_PX / nodeSize, fitted.scale * MIN_SCALE_FACTOR), fitted.scale * MAX_SCALE_FACTOR)
    setView({ scale, offsetX: searchCentreX(size.width) - node.x * scale, offsetY: size.height / 2 - node.y * scale })
    setSearch({ query: node.tag, isOpen: false, active: -1 })
    select([nodeIndex], -1, { kind: 'node', node: nodeIndex }, false)
  }

  function handleSearchChange(event: ChangeEvent<HTMLInputElement>): void {
    setSearch({ query: event.target.value, isOpen: true, active: -1 })
  }

  function handleSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>): void {
    const isListShown = search.isOpen && results.length > 0
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        if (results.length > 0) setSearch((current) => ({ ...current, isOpen: true, active: (current.active + 1) % results.length }))
        return
      case 'ArrowUp':
        event.preventDefault()
        if (results.length > 0) {
          setSearch((current) => ({ ...current, isOpen: true, active: current.active <= 0 ? results.length - 1 : current.active - 1 }))
        }
        return
      case 'Enter': {
        if (!isListShown) return
        event.preventDefault()
        const chosen = results[search.active >= 0 ? search.active : 0]
        if (chosen !== undefined) chooseResult(chosen)
        return
      }
      case 'Escape':
        if (!isListShown) return
        // Closing the list only; Esc on a closed list falls through to the root and clears the selection.
        event.stopPropagation()
        setSearch((current) => ({ ...current, isOpen: false, active: -1 }))
        return
      default:
        return
    }
  }

  function setFilter(patch: Partial<FfuFilters>): void {
    setFilters((current) => ({ ...current, ...patch }))
  }

  function closePanel(): void {
    setSelection((current) => ({ ...current, panel: null }))
  }

  function pickNode(nodeIndex: number): void {
    select([nodeIndex], -1, { kind: 'node', node: nodeIndex }, false)
  }

  const isListShown = search.isOpen && results.length > 0
  const activeOption = isListShown && search.active >= 0 ? `${listboxId}-${search.active}` : undefined

  return (
    <div className="qaqc-root qaqc-ffu-root" tabIndex={0} onKeyDown={handleRootKeyDown}>
      <LoadingBar active={loading} />
      <div className="qaqc-header qaqc-ffu-header">
        <div className="qaqc-title">
          <span className="qaqc-title-icon">
            <Icon size={16} aria-hidden="true" />
          </span>
          <h2>{title}</h2>
        </div>
        <div className="qaqc-ffu-controls">
          <div className="qaqc-ffu-search">
            <Search size={14} aria-hidden="true" />
            <input
              type="text"
              role="combobox"
              aria-label="Search FFU tags"
              aria-autocomplete="list"
              aria-expanded={isListShown}
              aria-controls={listboxId}
              aria-activedescendant={activeOption}
              placeholder="Search tag"
              spellCheck={false}
              autoComplete="off"
              value={search.query}
              disabled={!interactive}
              onChange={handleSearchChange}
              onKeyDown={handleSearchKeyDown}
              onBlur={() => setSearch((current) => ({ ...current, isOpen: false, active: -1 }))}
            />
            {isListShown && (
              <ul className="qaqc-ffu-listbox" id={listboxId} role="listbox" aria-label="Matching FFU tags">
                {results.map((nodeIndex, at) => (
                  <li
                    key={nodeIndex}
                    id={`${listboxId}-${at}`}
                    role="option"
                    aria-selected={at === search.active}
                    className={at === search.active ? 'is-active' : undefined}
                    // Keeps focus in the box, so its blur does not close the list before the click lands.
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => chooseResult(nodeIndex)}
                  >
                    {index.nodes[nodeIndex]?.tag ?? ''}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <FilterSelect
            label="Zone"
            value={active.zone ?? ''}
            options={plainOptions(options.zones)}
            disabled={!interactive}
            onChange={(value) => setFilter({ zone: value === '' ? null : value })}
          />
          <FilterSelect
            label="Group"
            value={active.group ?? ''}
            options={plainOptions(options.groups)}
            disabled={!interactive}
            onChange={(value) => setFilter({ group: value === '' ? null : value })}
          />
          <FilterSelect
            label="RIO Panel"
            value={active.rioPanel ?? ''}
            options={plainOptions(options.rioPanels)}
            disabled={!interactive}
            onChange={(value) => setFilter({ rioPanel: value === '' ? null : value })}
          />
          <FilterSelect
            label="Energized"
            value={active.energized ?? ''}
            options={ENERGIZED_OPTIONS}
            disabled={!interactive}
            onChange={(value) => setFilter({ energized: energizedFilterOf(value) })}
          />
        </div>
      </div>

      <dl className="qaqc-ffu-summary">
        {summaryItems(summary).map((item) => (
          <div key={item.label} className="qaqc-ffu-stat">
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>

      <div className="qaqc-ffu-body">
        <div ref={mapRef} className="qaqc-ffu-map">
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={`FFU map, ${formatCount(summary.total)} FFUs. Scroll to zoom, drag to pan.`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onPointerLeave={clearHover}
          />
        </div>
        <div className="qaqc-ffu-zoom">
          <button type="button" className="qaqc-ffu-icon-button" aria-label="Zoom in" title="Zoom in" onClick={() => zoomBy(BUTTON_ZOOM_STEP)}>
            <ZoomIn size={14} aria-hidden="true" />
          </button>
          <button type="button" className="qaqc-ffu-icon-button" aria-label="Zoom out" title="Zoom out" onClick={() => zoomBy(1 / BUTTON_ZOOM_STEP)}>
            <ZoomOut size={14} aria-hidden="true" />
          </button>
          <button type="button" className="qaqc-ffu-icon-button" aria-label="Fit to map" title="Fit to map" onClick={() => setView(null)}>
            <Maximize size={14} aria-hidden="true" />
          </button>
        </div>
        {selection.panel !== null && (
          <FfuDetailPanel index={index} target={selection.panel} onClose={closePanel} onPickNode={pickNode} />
        )}
      </div>
    </div>
  )
}
