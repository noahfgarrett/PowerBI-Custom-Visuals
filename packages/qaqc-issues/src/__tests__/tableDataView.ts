import type powerbi from 'powerbi-visuals-api'

export type SlotRole =
  | 'id'
  | 'title'
  | 'status'
  | 'type'
  | 'contractor'
  | 'discipline'
  | 'createdOn'
  | 'updatedOn'
  | 'dueDate'
  | 'createdBy'

export type Cell = string | Date | null

export interface TableOptions {
  roles?: SlotRole[]
  segment?: boolean
  /** Format pane values, as Power BI delivers them in metadata.objects. */
  objects?: powerbi.DataViewObjects
}

export const ALL_ROLES: SlotRole[] = [
  'id',
  'title',
  'status',
  'type',
  'contractor',
  'discipline',
  'createdOn',
  'updatedOn',
  'dueDate',
  'createdBy',
]

/**
 * Builds a table data view whose columns carry the given roles, in order. Each input row
 * supplies the ten slot values in ALL_ROLES order; a null cell becomes blank text.
 */
export function tableDataView(rows: ReadonlyArray<ReadonlyArray<Cell>>, options: TableOptions = {}): powerbi.DataView {
  const roles = options.roles ?? ALL_ROLES
  const columns: powerbi.DataViewMetadataColumn[] = roles.map((role, index) => ({
    displayName: role,
    index,
    roles: { [role]: true },
  }))
  const tableRows: powerbi.DataViewTableRow[] = rows.map((row) => roles.map((role) => row[ALL_ROLES.indexOf(role)] ?? ''))
  const metadata: powerbi.DataViewMetadata = { columns }
  if (options.segment) metadata.segment = {}
  if (options.objects) metadata.objects = options.objects
  return {
    metadata,
    table: { columns, rows: tableRows },
  }
}
