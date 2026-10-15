import type powerbi from 'powerbi-visuals-api'

export type SlotRole = 'weldWeek' | 'signature' | 'signedWeek' | 'issue' | 'fluidCode' | 'pipeSpec' | 'tagNo' | 'rowId'

export interface TableOptions {
  roles?: SlotRole[]
  segment?: boolean
  /** Format pane values, as Power BI delivers them in metadata.objects. */
  objects?: powerbi.DataViewObjects
}

const ALL_ROLES: SlotRole[] = ['weldWeek', 'signature', 'signedWeek', 'issue', 'fluidCode', 'pipeSpec', 'tagNo', 'rowId']

/**
 * Builds a table data view whose columns carry the given roles, in order. Each input row
 * supplies the first seven slot values; the Row ID column (if present) is numbered from 1.
 */
export function tableDataView(rows: ReadonlyArray<ReadonlyArray<string | null>>, options: TableOptions = {}): powerbi.DataView {
  const roles = options.roles ?? ALL_ROLES
  const columns: powerbi.DataViewMetadataColumn[] = roles.map((role, index) => ({
    displayName: role,
    index,
    roles: { [role]: true },
  }))
  const tableRows: powerbi.DataViewTableRow[] = rows.map((row, rowIndex) =>
    roles.map((role) => (role === 'rowId' ? rowIndex + 1 : row[ALL_ROLES.indexOf(role)] ?? '')),
  )
  const metadata: powerbi.DataViewMetadata = { columns }
  if (options.segment) metadata.segment = {}
  if (options.objects) metadata.objects = options.objects
  return {
    metadata,
    table: { columns, rows: tableRows },
  }
}
