import type { InspectionRows, WeldColumns, WeldOptionalColumns } from '../types'
import type { WeldFilterSource } from '../welds'

export const WELD_COLUMNS: WeldColumns = { weldWeek: 0, signature: 1, signedWeek: 2, issue: 3, fluidCode: 4, pipeSpec: 5, tagNo: 6 }

export const UNBOUND_WELD_OPTIONAL: WeldOptionalColumns = { welder: -1, workPackage: -1 }

/** The columns `withPlaceholderWeldColumns` adds after the seven required ones. */
export const PLACEHOLDER_WELD_OPTIONAL: WeldOptionalColumns = { welder: 7, workPackage: 8 }

// Made-up welder IDs and work packages.
const WELDERS = ['P-012', 'PF-025', 'P-012, PF-025', 'P-031', '', 'P-044']
const WORK_PACKAGES = ['WP-100', 'WP-200', 'wp-200', 'WP-300', '']

/** Adds made-up Welder and Work Package columns to fixture rows, repeating by row position so counts stay stable. */
export function withPlaceholderWeldColumns(rows: InspectionRows): InspectionRows {
  return rows.map((row, position) => [
    ...row,
    WELDERS[position % WELDERS.length],
    WORK_PACKAGES[position % WORK_PACKAGES.length],
  ])
}

export function weldFilterSourceFor(
  rows: InspectionRows,
  today: Date,
  optional: WeldOptionalColumns = UNBOUND_WELD_OPTIONAL,
): WeldFilterSource {
  return { rows, columns: WELD_COLUMNS, optional, today }
}
