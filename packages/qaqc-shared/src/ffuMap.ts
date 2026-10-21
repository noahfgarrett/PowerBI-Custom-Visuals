import type { FieldSlot, InspectionTableSource } from './dataView'

export type FfuRole =
  | 'tag'
  | 'x'
  | 'y'
  | 'line'
  | 'lineOrder'
  | 'lineColor'
  | 'homeRun'
  | 'finish'
  | 'gridColumn'
  | 'gridRow'
  | 'group'
  | 'zone'
  | 'rioPanel'
  | 'card'
  | 'channel'
  | 'node'
  | 'pwrPanel'
  | 'circuit'
  | 'energized'

/** Column position of each role in the table, or -1 when the slot is unbound. */
export type FfuColumns = Record<FfuRole, number>

/** Layout slots take the layout CSV headers; tracker slots take the Master FFU Tracker headers. */
export const FFU_SLOTS: readonly FieldSlot<FfuRole>[] = [
  { role: 'tag', slot: 'FFU Tag', column: 'FFU Tag' },
  { role: 'x', slot: 'X', column: 'X' },
  { role: 'y', slot: 'Y', column: 'Y' },
  { role: 'line', slot: 'Line', column: 'Line' },
  { role: 'lineOrder', slot: 'Line Order', column: 'Line Order' },
  { role: 'lineColor', slot: 'Line Colour', column: 'Line Colour' },
  { role: 'homeRun', slot: 'Home Run', column: 'Home Run' },
  { role: 'finish', slot: 'Finish', column: 'Finish' },
  { role: 'gridColumn', slot: 'Grid Column', column: 'Grid Column' },
  { role: 'gridRow', slot: 'Grid Row', column: 'Grid Row' },
  { role: 'group', slot: 'FFU Group', column: 'FFU Group' },
  { role: 'zone', slot: 'FFU Shutdown Zone', column: 'FFU Shutdown Zone' },
  { role: 'rioPanel', slot: 'RIO Panel', column: 'RIO Panel' },
  { role: 'card', slot: 'Card', column: 'Card' },
  { role: 'channel', slot: 'Channel', column: 'Channel' },
  { role: 'node', slot: 'Node', column: 'Node' },
  { role: 'pwrPanel', slot: 'PWR Panel', column: 'PWR Panel' },
  { role: 'circuit', slot: 'Circuit #', column: 'Circuit #' },
  { role: 'energized', slot: 'FFU Energized', column: 'FFU Energized' },
]

export const REQUIRED_FFU_ROLES: ReadonlySet<FfuRole> = new Set<FfuRole>(['tag', 'x', 'y'])

export type FfuTableReadResult =
  | { kind: 'missing'; missing: FieldSlot<FfuRole>[] }
  | { kind: 'ready'; rows: ReadonlyArray<ReadonlyArray<unknown>>; columns: FfuColumns }

/** Cells pass through untouched: the index parses numbers, numeric text and booleans itself. */
export function readFfuTable(table: InspectionTableSource | undefined): FfuTableReadResult {
  const required = FFU_SLOTS.filter((slot) => REQUIRED_FFU_ROLES.has(slot.role))
  if (!table) return { kind: 'missing', missing: required }

  const positionOf = (role: string): number => table.columns.findIndex((column) => column.roles?.[role] === true)
  const columns: FfuColumns = {
    tag: positionOf('tag'),
    x: positionOf('x'),
    y: positionOf('y'),
    line: positionOf('line'),
    lineOrder: positionOf('lineOrder'),
    lineColor: positionOf('lineColor'),
    homeRun: positionOf('homeRun'),
    finish: positionOf('finish'),
    gridColumn: positionOf('gridColumn'),
    gridRow: positionOf('gridRow'),
    group: positionOf('group'),
    zone: positionOf('zone'),
    rioPanel: positionOf('rioPanel'),
    card: positionOf('card'),
    channel: positionOf('channel'),
    node: positionOf('node'),
    pwrPanel: positionOf('pwrPanel'),
    circuit: positionOf('circuit'),
    energized: positionOf('energized'),
  }
  const missing = required.filter((slot) => columns[slot.role] < 0)
  if (missing.length > 0) return { kind: 'missing', missing }

  return { kind: 'ready', rows: table.rows ?? [], columns }
}

export type Energized = 'on' | 'off' | 'unknown'

const ENERGIZED_ON: ReadonlySet<string> = new Set(['true', 'yes', 'y', '1'])
const ENERGIZED_OFF: ReadonlySet<string> = new Set(['false', 'no', 'n', '0'])

/** Trimmed and case-insensitive; anything outside the true and false spellings, or blank, is unknown. */
export function parseEnergized(value: unknown): Energized {
  if (typeof value === 'boolean') return value ? 'on' : 'off'
  if (typeof value === 'number') {
    if (value === 1) return 'on'
    if (value === 0) return 'off'
    return 'unknown'
  }
  if (typeof value !== 'string') return 'unknown'
  const text = value.trim().toLowerCase()
  if (ENERGIZED_ON.has(text)) return 'on'
  if (ENERGIZED_OFF.has(text)) return 'off'
  return 'unknown'
}

export interface FfuNode {
  /** Index into the table rows, used for selection IDs. */
  row: number
  tag: string
  x: number
  y: number
  /** Index into FfuIndex.lines, -1 when on no line. */
  line: number
  /** 1-based position within its line after sorting, 0 when on no line. */
  lineOrder: number
  homeRun: boolean
  finish: boolean
  gridColumn: string
  gridRow: string
  group: string
  zone: string
  rioPanel: string
  card: string
  channel: string
  node: string
  pwrPanel: string
  circuit: string
  energized: Energized
  /** Any tracker cell (group..energized) is non-blank. */
  hasTracker: boolean
  mismatch: boolean
}

export interface FfuLine {
  id: string
  label: string
  group: string
  /** '#RRGGBB', or '' when no valid colour was given. */
  color: string
  /** Node indices in line order. */
  nodes: number[]
  /** Node index, or -1. */
  homeRun: number
  /** Node index, or -1. */
  finish: number
}

export interface GridAxis {
  labels: { label: string; at: number }[]
  dividers: number[]
}

export interface FfuBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface FfuIndex {
  nodes: FfuNode[]
  lines: FfuLine[]
  gridColumns: GridAxis | null
  gridRows: GridAxis | null
  bounds: FfuBounds | null
  notPlaced: number
}

const TRACKER_ROLES: readonly FfuRole[] = [
  'group',
  'zone',
  'rioPanel',
  'card',
  'channel',
  'node',
  'pwrPanel',
  'circuit',
  'energized',
]

const LINE_COLOR = /^#[0-9a-f]{6}$/i

const COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

/** Collator order, falling back to code-point order so ids that differ only in case still sort deterministically. */
function compareText(a: string, b: string): number {
  const collated = COLLATOR.compare(a, b)
  if (collated !== 0) return collated
  if (a === b) return 0
  return a < b ? -1 : 1
}

function cellOf(row: ReadonlyArray<unknown>, column: number): unknown {
  return column < 0 ? null : row[column]
}

function textOf(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

/** Finite numbers, or text that trims to a finite number; anything else is null. */
function numberOf(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed === '') return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function colorOf(value: unknown): string {
  const text = textOf(value)
  return LINE_COLOR.test(text) ? text.toUpperCase() : ''
}

interface LineMember {
  node: number
  /** Line Order from the table, or null when missing or not a number. */
  order: number | null
  color: string
}

function compareMembers(a: LineMember, b: LineMember, nodes: readonly FfuNode[]): number {
  if (a.order !== null && b.order !== null && a.order !== b.order) return a.order - b.order
  if (a.order === null && b.order !== null) return 1
  if (a.order !== null && b.order === null) return -1
  return (nodes[a.node]?.row ?? 0) - (nodes[b.node]?.row ?? 0)
}

/** The most common non-blank group; ties go to the alphabetically first. '' when no node has a group. */
function majorityGroup(nodeIndices: readonly number[], nodes: readonly FfuNode[]): string {
  const counts = new Map<string, number>()
  for (const nodeIndex of nodeIndices) {
    const group = nodes[nodeIndex]?.group ?? ''
    if (group !== '') counts.set(group, (counts.get(group) ?? 0) + 1)
  }
  let best = ''
  let bestCount = 0
  for (const [group, count] of counts) {
    if (count > bestCount || (count === bestCount && compareText(group, best) < 0)) {
      best = group
      bestCount = count
    }
  }
  return best
}

function buildLine(id: string, members: LineMember[], nodes: FfuNode[], lineIndex: number): FfuLine {
  members.sort((a, b) => compareMembers(a, b, nodes))
  const nodeIndices: number[] = []
  let homeRun = -1
  let finish = -1
  let color = ''
  members.forEach((member, position) => {
    const node = nodes[member.node]
    if (!node) return
    node.line = lineIndex
    node.lineOrder = position + 1
    nodeIndices.push(member.node)
    if (homeRun < 0 && node.homeRun) homeRun = member.node
    if (finish < 0 && node.finish) finish = member.node
    if (color === '' && member.color !== '') color = member.color
  })
  const group = majorityGroup(nodeIndices, nodes)
  return { id, label: group !== '' ? group : id, group, color, nodes: nodeIndices, homeRun, finish }
}

interface Bay {
  label: string
  min: number
  max: number
  sum: number
  count: number
}

/** Bays ordered by the mean coordinate of their nodes; dividers sit halfway between neighbouring bay extents. */
function buildGridAxis(
  nodes: readonly FfuNode[],
  labelOf: (node: FfuNode) => string,
  coordinateOf: (node: FfuNode) => number,
): GridAxis | null {
  const bays = new Map<string, Bay>()
  for (const node of nodes) {
    const label = labelOf(node)
    if (label === '') continue
    const at = coordinateOf(node)
    const bay = bays.get(label)
    if (bay) {
      bay.min = Math.min(bay.min, at)
      bay.max = Math.max(bay.max, at)
      bay.sum += at
      bay.count += 1
    } else {
      bays.set(label, { label, min: at, max: at, sum: at, count: 1 })
    }
  }
  if (bays.size === 0) return null

  const ordered = [...bays.values()].sort((a, b) => a.sum / a.count - b.sum / b.count || compareText(a.label, b.label))
  const labels = ordered.map((bay) => ({ label: bay.label, at: (bay.min + bay.max) / 2 }))
  const dividers: number[] = []
  for (let i = 1; i < ordered.length; i += 1) {
    const before = ordered[i - 1]
    const after = ordered[i]
    if (before && after) dividers.push((before.max + after.min) / 2)
  }
  return { labels, dividers }
}

/**
 * One pass places the nodes and buckets them by line, then each line is sorted once.
 * Lines need both Line and Line Order bound; without either the nodes still place but no line is built.
 */
export function buildFfuIndex(rows: ReadonlyArray<ReadonlyArray<unknown>>, columns: FfuColumns): FfuIndex {
  const nodes: FfuNode[] = []
  const seenTags = new Set<string>()
  const members = new Map<string, LineMember[]>()
  const hasLines = columns.line >= 0 && columns.lineOrder >= 0
  let notPlaced = 0
  let bounds: FfuBounds | null = null

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex]
    if (!row) {
      notPlaced += 1
      continue
    }
    const tag = textOf(cellOf(row, columns.tag))
    const x = numberOf(cellOf(row, columns.x))
    const y = numberOf(cellOf(row, columns.y))
    if (tag === '' || x === null || y === null || seenTags.has(tag)) {
      notPlaced += 1
      continue
    }
    seenTags.add(tag)

    const nodeIndex = nodes.length
    nodes.push({
      row: rowIndex,
      tag,
      x,
      y,
      line: -1,
      lineOrder: 0,
      homeRun: parseEnergized(cellOf(row, columns.homeRun)) === 'on',
      finish: parseEnergized(cellOf(row, columns.finish)) === 'on',
      gridColumn: textOf(cellOf(row, columns.gridColumn)),
      gridRow: textOf(cellOf(row, columns.gridRow)),
      group: textOf(cellOf(row, columns.group)),
      zone: textOf(cellOf(row, columns.zone)),
      rioPanel: textOf(cellOf(row, columns.rioPanel)),
      card: textOf(cellOf(row, columns.card)),
      channel: textOf(cellOf(row, columns.channel)),
      node: textOf(cellOf(row, columns.node)),
      pwrPanel: textOf(cellOf(row, columns.pwrPanel)),
      circuit: textOf(cellOf(row, columns.circuit)),
      energized: parseEnergized(cellOf(row, columns.energized)),
      hasTracker: TRACKER_ROLES.some((role) => textOf(cellOf(row, columns[role])) !== ''),
      mismatch: false,
    })

    if (bounds) {
      bounds.minX = Math.min(bounds.minX, x)
      bounds.minY = Math.min(bounds.minY, y)
      bounds.maxX = Math.max(bounds.maxX, x)
      bounds.maxY = Math.max(bounds.maxY, y)
    } else {
      bounds = { minX: x, minY: y, maxX: x, maxY: y }
    }

    if (!hasLines) continue
    const lineId = textOf(cellOf(row, columns.line))
    if (lineId === '') continue
    const member: LineMember = {
      node: nodeIndex,
      order: numberOf(cellOf(row, columns.lineOrder)),
      color: colorOf(cellOf(row, columns.lineColor)),
    }
    const bucket = members.get(lineId)
    if (bucket) bucket.push(member)
    else members.set(lineId, [member])
  }

  const lineIds = [...members.keys()].sort(compareText)
  const lines = lineIds.map((id, lineIndex) => buildLine(id, members.get(id) ?? [], nodes, lineIndex))

  for (const node of nodes) {
    const lineGroup = lines[node.line]?.group ?? ''
    node.mismatch = node.group !== '' && lineGroup !== '' && node.group !== lineGroup
  }

  return {
    nodes,
    lines,
    gridColumns: columns.gridColumn >= 0 ? buildGridAxis(nodes, (node) => node.gridColumn, (node) => node.x) : null,
    gridRows: columns.gridRow >= 0 ? buildGridAxis(nodes, (node) => node.gridRow, (node) => node.y) : null,
    bounds,
    notPlaced,
  }
}
