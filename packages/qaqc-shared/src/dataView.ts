import type { InspectionColumns, InspectionRows } from './types'

export interface FieldSlot {
  role: keyof InspectionColumns | 'rowId'
  /** Field slot name in the Power BI Fields pane. */
  slot: string
  /** Smartsheet column the user drags into it. */
  column: string
}

export const REQUIRED_SLOTS: readonly FieldSlot[] = [
  { role: 'workWeek', slot: 'Work Week', column: 'Work Week Observed' },
  { role: 'phase', slot: 'Inspection Phase', column: 'Inspection Phase' },
  { role: 'issue', slot: 'Issue?', column: 'Issue?' },
  { role: 'building', slot: 'Building', column: 'Building' },
  { role: 'rowId', slot: 'Row ID', column: 'Index' },
]

export type TableReadResult =
  | { kind: 'missing'; missing: FieldSlot[] }
  | { kind: 'ready'; rows: InspectionRows; columns: InspectionColumns }

export interface TableColumnLike {
  roles?: { [role: string]: boolean }
}

export interface InspectionTableSource {
  columns: ReadonlyArray<TableColumnLike>
  rows?: InspectionRows
}

export function readInspectionTable(table: InspectionTableSource | undefined): TableReadResult {
  if (!table) return { kind: 'missing', missing: [...REQUIRED_SLOTS] }

  const positionOf = (role: string): number => table.columns.findIndex((column) => column.roles?.[role] === true)
  const workWeek = positionOf('workWeek')
  const phase = positionOf('phase')
  const issue = positionOf('issue')
  const building = positionOf('building')
  const rowId = positionOf('rowId')

  const positions = { workWeek, phase, issue, building, rowId }
  const missing = REQUIRED_SLOTS.filter((slot) => positions[slot.role] < 0)
  if (missing.length > 0) return { kind: 'missing', missing }

  return {
    kind: 'ready',
    rows: table.rows ?? [],
    columns: { workWeek, phase, issue, building },
  }
}
