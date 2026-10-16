import type powerbi from 'powerbi-visuals-api'

import { COMBINED_COLUMNS } from '../../../qaqc-shared/src/__tests__/fixtures/combinedRows'

export type SlotRole = 'source' | 'rowId' | 'workWeek' | 'phase' | 'issue' | 'building' | 'qcr' | 'welder' | 'tagNo'

export type Cell = string | number | Date | null

export interface TableOptions {
  roles?: SlotRole[]
  segment?: boolean
  /** Format pane values, as Power BI delivers them in metadata.objects. */
  objects?: powerbi.DataViewObjects
}

export const ALL_ROLES: SlotRole[] = ['source', 'rowId', 'workWeek', 'phase', 'issue', 'building', 'qcr', 'welder', 'tagNo']

/** The QCx Combined column each role is bound to. */
const COLUMN_OF: Record<SlotRole, (typeof COMBINED_COLUMNS)[number]> = {
  source: 'Source',
  rowId: 'Row ID',
  workWeek: 'Work Week',
  phase: 'Inspection Phase',
  issue: 'Issue',
  building: 'Building',
  qcr: 'QCR/FE',
  welder: 'Welder',
  tagNo: 'Tag No',
}

/**
 * Builds a table data view whose columns carry the given roles, in order. Each input row is a QCx Combined row
 * (`COMBINED_COLUMNS` order); a null cell becomes blank text, as Power BI sends it.
 */
export function tableDataView(rows: ReadonlyArray<ReadonlyArray<Cell>>, options: TableOptions = {}): powerbi.DataView {
  const roles = options.roles ?? ALL_ROLES
  const columns: powerbi.DataViewMetadataColumn[] = roles.map((role, index) => ({
    displayName: COLUMN_OF[role],
    index,
    roles: { [role]: true },
  }))
  const positions = roles.map((role) => COMBINED_COLUMNS.indexOf(COLUMN_OF[role]))
  const tableRows: powerbi.DataViewTableRow[] = rows.map((row) => positions.map((position) => row[position] ?? ''))
  const metadata: powerbi.DataViewMetadata = { columns }
  if (options.segment) metadata.segment = {}
  if (options.objects) metadata.objects = options.objects
  return {
    metadata,
    table: { columns, rows: tableRows },
  }
}
