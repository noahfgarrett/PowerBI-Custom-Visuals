import type powerbi from 'powerbi-visuals-api'

import type { InspectionColumns, InspectionRows } from '../../qaqc-shared/src/types'

export interface FieldSlot {
  role: keyof InspectionColumns
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
]

const ROW_ID_ROLE = 'rowId'

export type TableReadResult =
  | { kind: 'missing'; missing: FieldSlot[] }
  | { kind: 'ready'; rows: InspectionRows; columns: InspectionColumns; hasRowId: boolean }

export function readInspectionTable(dataView: powerbi.DataView | undefined): TableReadResult {
  const table = dataView?.table
  if (!table) return { kind: 'missing', missing: [...REQUIRED_SLOTS] }

  const positionOf = (role: string): number => table.columns.findIndex((column) => column.roles?.[role] === true)
  const missing = REQUIRED_SLOTS.filter((slot) => positionOf(slot.role) < 0)
  if (missing.length > 0) return { kind: 'missing', missing }

  return {
    kind: 'ready',
    rows: table.rows ?? [],
    columns: {
      workWeek: positionOf('workWeek'),
      phase: positionOf('phase'),
      issue: positionOf('issue'),
      building: positionOf('building'),
    },
    hasRowId: positionOf(ROW_ID_ROLE) >= 0,
  }
}
