import { FFU_SLOTS, type FfuRole } from '../../ffuMap'

/** Nodes per line, as on a busy real line. */
const LINE_LENGTH = 47
/** Each line snakes through a block this many cells wide and as many rows as it needs. */
const BLOCK_WIDTH = 8
const BLOCK_HEIGHT = Math.ceil(LINE_LENGTH / BLOCK_WIDTH)
/** Blocks per row of the floor, with one empty cell between neighbouring blocks. */
const BLOCKS_PER_ROW = 16
const CELL = 20
const MARGIN = 50
/** Every this-many-th row has no tracker match, so all its tracker cells are null. */
const NO_TRACKER_EVERY = 50
/** Every this-many-th row carries another line's group, so the table has some mismatches. */
const MISMATCH_EVERY = 97
const ENERGIZED_CYCLE = ['Yes', 'No', 'Yes', 'Yes'] as const
const LINE_COLORS = ['#E8541E', '#1F77B4', '#2CA02C', '#9467BD', '#8C564B', '#17BECF'] as const

export interface SyntheticFfuColumn {
  roles: Record<string, boolean>
  displayName: string
}

export interface SyntheticFfuTable {
  columns: SyntheticFfuColumn[]
  rows: unknown[][]
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0')
}

function bayLetter(blockColumn: number): string {
  return `Z${String.fromCharCode(65 + (blockColumn % 26))}`
}

function groupOf(line: number): string {
  return `GRP-${pad(line + 1, 3)}`
}

function recordOf(row: number, count: number): Record<FfuRole, unknown> {
  const line = Math.floor(row / LINE_LENGTH)
  const position = row % LINE_LENGTH
  const blockColumn = line % BLOCKS_PER_ROW
  const blockRow = Math.floor(line / BLOCKS_PER_ROW)
  const cellRow = Math.floor(position / BLOCK_WIDTH)
  const step = position % BLOCK_WIDTH
  const cellColumn = cellRow % 2 === 0 ? step : BLOCK_WIDTH - 1 - step
  const isLast = position === LINE_LENGTH - 1 || row === count - 1
  const hasTracker = (row + 1) % NO_TRACKER_EVERY !== 0
  const group = (row + 1) % MISMATCH_EVERY === 0 ? groupOf(line + 1) : groupOf(line)

  return {
    tag: `FFU9${pad(row, 5)}-ZZ01-F01-A`,
    x: MARGIN + (blockColumn * (BLOCK_WIDTH + 1) + cellColumn) * CELL,
    y: MARGIN + (blockRow * (BLOCK_HEIGHT + 1) + cellRow) * CELL,
    line: `L${pad(line + 1, 3)}`,
    lineOrder: position + 1,
    lineColor: LINE_COLORS[line % LINE_COLORS.length],
    homeRun: position === 0 ? 'TRUE' : 'FALSE',
    finish: isLast ? 'TRUE' : 'FALSE',
    gridColumn: bayLetter(blockColumn),
    gridRow: pad(blockRow + 1, 2),
    group: hasTracker ? group : null,
    zone: hasTracker ? `SZ-${(line % 6) + 1}` : null,
    rioPanel: hasTracker ? `RIO-${pad((line % 10) + 1, 2)}` : null,
    card: hasTracker ? String((position % 8) + 1) : null,
    channel: hasTracker ? String((position % 16) + 1) : null,
    node: hasTracker ? String(position + 1) : null,
    pwrPanel: hasTracker ? `PP-${pad((line % 12) + 1, 2)}` : null,
    circuit: hasTracker ? String((position % 42) + 1) : null,
    energized: hasTracker ? ENERGIZED_CYCLE[row % ENERGIZED_CYCLE.length] : null,
  }
}

/**
 * A deterministic, made-up FFU table with every slot bound: lines of 47 nodes snaking through blocks on a grid,
 * energized cycling on, off, on, on, and every 50th row without a tracker match. No randomness, so it is safe for
 * timing tests and the dev harness.
 */
export function syntheticFfuTable(count: number): SyntheticFfuTable {
  const columns = FFU_SLOTS.map((slot) => ({ roles: { [slot.role]: true }, displayName: slot.slot }))
  const rows: unknown[][] = []
  for (let row = 0; row < count; row += 1) {
    const record = recordOf(row, count)
    rows.push(FFU_SLOTS.map((slot) => record[slot.role]))
  }
  return { columns, rows }
}
