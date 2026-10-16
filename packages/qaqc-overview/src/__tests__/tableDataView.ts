import type powerbi from 'powerbi-visuals-api'

import { COMBINED_COLUMNS } from '../../../qaqc-shared/src/__tests__/fixtures/combinedRows'

export type SlotRole =
  | 'source'
  | 'rowId'
  | 'workWeek'
  | 'phase'
  | 'issue'
  | 'building'
  | 'signature'
  | 'signedWeek'
  | 'id'
  | 'status'
  | 'type'
  | 'createdOn'
  | 'updatedOn'
  | 'createdBy'

export type Cell = string | number | Date | null

export interface TableOptions {
  roles?: SlotRole[]
  /** Binds the Green tags measure with this value on every row; left out, the measure is unbound. */
  greenTags?: Cell
  segment?: boolean
  /** Format pane values, as Power BI delivers them in metadata.objects. */
  objects?: powerbi.DataViewObjects
}

export const ALL_ROLES: SlotRole[] = [
  'source',
  'rowId',
  'workWeek',
  'phase',
  'issue',
  'building',
  'signature',
  'signedWeek',
  'id',
  'status',
  'type',
  'createdOn',
  'updatedOn',
  'createdBy',
]

/** The QAQC Combined column each role is bound to. */
const COLUMN_OF: Record<SlotRole, (typeof COMBINED_COLUMNS)[number]> = {
  source: 'Source',
  rowId: 'Row ID',
  workWeek: 'Work Week',
  phase: 'Inspection Phase',
  issue: 'Issue',
  building: 'Building',
  signature: 'Signature',
  signedWeek: 'Work Week Signed',
  id: 'ID',
  status: 'Status',
  type: 'Type',
  createdOn: 'Created On',
  updatedOn: 'Updated On',
  createdBy: 'Created By',
}

/**
 * Builds a table data view whose columns carry the given roles, in order, then the Green tags measure when it is
 * bound. Each input row is a QAQC Combined row (`COMBINED_COLUMNS` order); a null cell becomes blank text, as Power
 * BI sends it.
 */
export function tableDataView(rows: ReadonlyArray<ReadonlyArray<Cell>>, options: TableOptions = {}): powerbi.DataView {
  const roles = options.roles ?? ALL_ROLES
  const columns: powerbi.DataViewMetadataColumn[] = roles.map((role, index) => ({
    displayName: COLUMN_OF[role],
    index,
    roles: { [role]: true },
  }))
  const positions = roles.map((role) => COMBINED_COLUMNS.indexOf(COLUMN_OF[role]))
  const hasGreenTags = options.greenTags !== undefined
  if (hasGreenTags) {
    columns.push({ displayName: 'Green tags', index: columns.length, isMeasure: true, roles: { greenTags: true } })
  }
  const greenTags = options.greenTags ?? ''
  const tableRows: powerbi.DataViewTableRow[] = rows.map((row) => {
    const cells: powerbi.PrimitiveValue[] = positions.map((position) => row[position] ?? '')
    if (hasGreenTags) cells.push(greenTags)
    return cells
  })
  const metadata: powerbi.DataViewMetadata = { columns }
  if (options.segment) metadata.segment = {}
  if (options.objects) metadata.objects = options.objects
  return {
    metadata,
    table: { columns, rows: tableRows },
  }
}
