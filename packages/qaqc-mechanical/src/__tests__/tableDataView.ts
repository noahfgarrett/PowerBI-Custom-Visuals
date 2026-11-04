import type powerbi from 'powerbi-visuals-api'

export type SlotRole = 'workWeek' | 'phase' | 'issue' | 'building' | 'rowId'

export interface ExtraColumn {
  role: string
  value: (rowIndex: number) => powerbi.PrimitiveValue
}

export interface TableOptions {
  roles?: SlotRole[]
  segment?: boolean
  /** Optional slots, after the roles: their values come from the row's position, not the input row. */
  extraColumns?: ExtraColumn[]
}

const ALL_ROLES: SlotRole[] = ['workWeek', 'phase', 'issue', 'building', 'rowId']

/**
 * Builds a table data view whose columns carry the given roles, in order. Each input row
 * supplies the first four slot values; the Row ID column (if present) is numbered from 1.
 */
export function tableDataView(rows: ReadonlyArray<ReadonlyArray<string | null>>, options: TableOptions = {}): powerbi.DataView {
  const roles = options.roles ?? ALL_ROLES
  const extraColumns = options.extraColumns ?? []
  const columns: powerbi.DataViewMetadataColumn[] = [...roles, ...extraColumns.map((extra) => extra.role)].map((role, index) => ({
    displayName: role,
    index,
    roles: { [role]: true },
  }))
  const tableRows: powerbi.DataViewTableRow[] = rows.map((row, rowIndex) => [
    ...roles.map((role) => (role === 'rowId' ? rowIndex + 1 : row[ALL_ROLES.indexOf(role)] ?? '')),
    ...extraColumns.map((extra) => extra.value(rowIndex)),
  ])
  return {
    metadata: options.segment ? { columns, segment: {} } : { columns },
    table: { columns, rows: tableRows },
  }
}
