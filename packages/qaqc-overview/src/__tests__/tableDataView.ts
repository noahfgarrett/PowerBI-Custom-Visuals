import type powerbi from 'powerbi-visuals-api'

import { COMBINED_COLUMNS } from '../../../qaqc-shared/src/__tests__/fixtures/combinedRows'
import { OVERVIEW_SLOTS, requiredCombinedSlots, type CombinedSlotRole } from '../../../qaqc-shared/src/dataView'

/**
 * The Overview's column roles: the required ones, the optional Root Cause, the optional enrichment columns and the
 * optional columns the fixture has. Green tags is a measure, bound with `TableOptions.greenTags` instead.
 */
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
  | 'rootCause'
  | 'bim360CreatedBy'
  | 'bim360CreatedOn'
  | 'bim360ClosedOn'
  | 'closedAt'
  | 'tagNo'
  | 'welder'
  | 'qcr'

export type Cell = string | number | Date | null

export interface TableOptions {
  roles?: SlotRole[]
  /** Binds the Green tags measure with this value on every row; null is a BLANK measure. Left out, it is unbound. */
  greenTags?: number | string | null
  segment?: boolean
  /** Format pane values, as Power BI delivers them in metadata.objects. */
  objects?: powerbi.DataViewObjects
}

/** The QCx Combined column each role is bound to. */
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
  rootCause: 'Root Cause',
  bim360CreatedBy: 'BIM360 Created By',
  bim360CreatedOn: 'BIM360 Created On',
  bim360ClosedOn: 'BIM360 Closed On',
  closedAt: 'Closed At',
  tagNo: 'Tag No',
  welder: 'Welder',
  qcr: 'QCR/FE',
}

/** The optional enrichment roles, for binding the enriched Autodesk export's BIM360 and Closed At columns. */
export const ENRICHMENT_ROLES: SlotRole[] = ['bim360CreatedBy', 'bim360CreatedOn', 'bim360ClosedOn', 'closedAt']

function isSlotRole(role: CombinedSlotRole): role is SlotRole {
  return role in COLUMN_OF
}

/** Every required Overview slot, in OVERVIEW_SLOTS order. */
export const ALL_ROLES: SlotRole[] = requiredCombinedSlots(OVERVIEW_SLOTS)
  .map((slot) => slot.role)
  .filter(isSlotRole)

/**
 * Builds a table data view whose columns carry the given roles, in order, then the Green tags measure when it is
 * bound. Each input row is a QCx Combined row (`COMBINED_COLUMNS` order); a null cell becomes blank text, as Power
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
  const greenTags = options.greenTags
  if (greenTags !== undefined) {
    columns.push({ displayName: 'Green tags', index: columns.length, isMeasure: true, roles: { greenTags: true } })
  }
  const tableRows: powerbi.DataViewTableRow[] = rows.map((row) => {
    const cells: powerbi.PrimitiveValue[] = positions.map((position) => row[position] ?? '')
    // Power BI sends a BLANK measure as null, which the API's PrimitiveValue type leaves out, so set the cell directly.
    if (greenTags !== undefined) Reflect.set(cells, cells.length, greenTags)
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
