import type { InspectionTableSource } from '../../qaqc-shared/src/dataView'
import { FFU_SLOTS, type FfuRole } from '../../qaqc-shared/src/ffuMap'

/**
 * Dev only. Turns a layout CSV (from scripts/ffu-layout) into a table with every slot bound. The layout has no tracker
 * columns, so they are made up per tag, deterministically: about 2% of tags have no tracker row and about 85% of the
 * rest are energized. Nothing here is bundled into the visual.
 */

const NO_TRACKER_PERCENT = 2
const ENERGIZED_PERCENT = 85
/** About one FFU in this many carries a neighbouring line's group, so the map has some mismatches. */
const MISMATCH_ONE_IN = 120
const ZONE_BANDS = 6

/** Splits CSV text into rows of cells: commas, double-quoted cells with "" escapes, and CRLF or LF line ends. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let isQuoted = false
  for (let at = 0; at < text.length; at += 1) {
    const char = text[at]
    if (isQuoted) {
      if (char === '"' && text[at + 1] === '"') {
        cell += '"'
        at += 1
      } else if (char === '"') {
        isQuoted = false
      } else {
        cell += char
      }
      continue
    }
    if (char === '"') {
      isQuoted = true
    } else if (char === ',') {
      row.push(cell)
      cell = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[at + 1] === '\n') at += 1
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += char
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((cells) => cells.some((value) => value !== ''))
}

/** FNV-1a, so the made-up tracker fields are the same for a tag on every load. */
function hashOf(text: string): number {
  let hash = 0x811c9dc5
  for (let at = 0; at < text.length; at += 1) {
    hash ^= text.charCodeAt(at)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0')
}

function lineNumberOf(line: string): number {
  const digits = line.replace(/\D/g, '')
  return digits === '' ? 0 : Number(digits)
}

interface LayoutRow {
  tag: string
  x: number
  line: string
  lineOrder: number
}

function trackerOf(row: LayoutRow, zoneOf: (x: number) => number): Partial<Record<FfuRole, string | null>> {
  const hash = hashOf(row.tag)
  if (hash % 100 < NO_TRACKER_PERCENT) return {}
  const lineNumber = lineNumberOf(row.line)
  const isMismatch = row.line !== '' && Math.floor(hash / 100) % MISMATCH_ONE_IN === 0
  const groupNumber = row.line === '' ? (hash % 40) + 1 : lineNumber + (isMismatch ? 1 : 0)
  return {
    group: `GRP-${pad(groupNumber, 3)}`,
    zone: `SZ-${zoneOf(row.x)}`,
    rioPanel: `RIO-${pad((lineNumber % 10) + 1, 2)}`,
    card: String((row.lineOrder % 8) + 1),
    channel: String((row.lineOrder % 16) + 1),
    node: String(row.lineOrder),
    pwrPanel: `PP-${pad((lineNumber % 12) + 1, 2)}`,
    circuit: String((row.lineOrder % 42) + 1),
    energized: Math.floor(hash / 7) % 100 < ENERGIZED_PERCENT ? 'Yes' : 'No',
  }
}

/** Layout columns come from the CSV header by the slot's column name; tracker columns are made up per tag. */
export function layoutTableOf(text: string): InspectionTableSource {
  const [header, ...body] = parseCsv(text)
  if (!header) throw new Error('the layout CSV is empty')
  const positionOf = (column: string): number => header.findIndex((name) => name.trim() === column)
  const cellOf = (cells: readonly string[], role: FfuRole): string => {
    const slot = FFU_SLOTS.find((candidate) => candidate.role === role)
    const position = slot ? positionOf(slot.column) : -1
    return position < 0 ? '' : (cells[position] ?? '')
  }

  const layout = body.map((cells) => ({
    cells,
    row: {
      tag: cellOf(cells, 'tag'),
      x: Number(cellOf(cells, 'x')),
      line: cellOf(cells, 'line'),
      lineOrder: Number(cellOf(cells, 'lineOrder')) || 0,
    },
  }))
  const xs = layout.map(({ row }) => row.x).filter((x) => Number.isFinite(x))
  const minX = xs.length > 0 ? Math.min(...xs) : 0
  const spanX = xs.length > 0 ? Math.max(...xs) - minX : 0
  const zoneOf = (x: number): number =>
    spanX > 0 && Number.isFinite(x) ? Math.min(Math.floor(((x - minX) / spanX) * ZONE_BANDS), ZONE_BANDS - 1) + 1 : 1

  const rows = layout.map(({ cells, row }) => {
    const tracker = trackerOf(row, zoneOf)
    return FFU_SLOTS.map((slot): string | null => {
      if (slot.role in tracker) return tracker[slot.role] ?? null
      if (positionOf(slot.column) < 0) return null
      return cellOf(cells, slot.role)
    })
  })
  const columns = FFU_SLOTS.map((slot) => ({ roles: { [slot.role]: true } }))
  return { columns, rows }
}
