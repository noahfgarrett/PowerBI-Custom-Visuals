import type powerbi from 'powerbi-visuals-api'

export type SlotRole =
  | 'id'
  | 'title'
  | 'status'
  | 'type'
  | 'contractor'
  | 'createdOn'
  | 'updatedOn'
  | 'dueDate'
  | 'createdBy'
  | 'rootCause'
  | 'rootCauseCategory'

export type Cell = string | Date | null

export interface TableOptions {
  roles?: SlotRole[]
  segment?: boolean
  /** Format pane values, as Power BI delivers them in metadata.objects. */
  objects?: powerbi.DataViewObjects
}

/** The nine required slots, in field-slot order. */
export const ALL_ROLES: SlotRole[] = [
  'id',
  'title',
  'status',
  'type',
  'contractor',
  'createdOn',
  'updatedOn',
  'dueDate',
  'createdBy',
]

/** The optional Root Cause slots, which follow the required ones in each fixture row. */
export const ROOT_CAUSE_ROLES: SlotRole[] = ['rootCause', 'rootCauseCategory']

/** Each input row's column order: the required slots, then the optional Root Cause slots. */
const ROW_ORDER: SlotRole[] = [...ALL_ROLES, ...ROOT_CAUSE_ROLES]

/**
 * Builds a table data view whose columns carry the given roles, in order. Each input row
 * supplies the slot values in ALL_ROLES order, then Root Cause and Root Cause Category; a null cell becomes blank text.
 */
export function tableDataView(rows: ReadonlyArray<ReadonlyArray<Cell>>, options: TableOptions = {}): powerbi.DataView {
  const roles = options.roles ?? ALL_ROLES
  const columns: powerbi.DataViewMetadataColumn[] = roles.map((role, index) => ({
    displayName: role,
    index,
    roles: { [role]: true },
  }))
  const tableRows: powerbi.DataViewTableRow[] = rows.map((row) => roles.map((role) => row[ROW_ORDER.indexOf(role)] ?? ''))
  const metadata: powerbi.DataViewMetadata = { columns }
  if (options.segment) metadata.segment = {}
  if (options.objects) metadata.objects = options.objects
  return {
    metadata,
    table: { columns, rows: tableRows },
  }
}
