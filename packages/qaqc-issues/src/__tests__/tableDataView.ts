import type powerbi from 'powerbi-visuals-api'

import { COMBINED_COLUMNS } from '../../../qaqc-shared/src/__tests__/fixtures/combinedRows'
import { ENRICHED_COMBINED_ROWS } from '../../../qaqc-shared/src/__tests__/fixtures/enrichedCombinedRows'
import { ENRICHED_ISSUE_COLUMNS, ENRICHED_ISSUE_ROWS } from '../../../qaqc-shared/src/__tests__/fixtures/enrichedIssueRows'

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
  | 'bim360CreatedBy'
  | 'bim360CreatedOn'
  | 'bim360ClosedOn'
  | 'closedAt'
  | 'createdByCompany'
  | 'discipline'
  | 'source'
  | 'rowId'
  | 'workWeek'
  | 'phase'
  | 'issue'

export type Cell = string | number | Date | null

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

/** The optional enrichment slots of the enriched Autodesk export, which follow the Root Cause slots. */
export const ENRICHMENT_ROLES: SlotRole[] = ['bim360CreatedBy', 'bim360CreatedOn', 'bim360ClosedOn', 'closedAt']

/** The optional Filter menu slots, which follow the enrichment slots. */
export const FILTER_ROLES: SlotRole[] = ['createdByCompany', 'discipline']

/** The optional slots QCx Combined adds, which follow the Filter menu slots. */
export const COMBINED_ROLES: SlotRole[] = ['source', 'rowId', 'workWeek', 'phase', 'issue']

/** Each input row's column order: the required slots, then the optional Root Cause, enrichment, Filter menu and QCx Combined slots. */
const ROW_ORDER: SlotRole[] = [...ALL_ROLES, ...ROOT_CAUSE_ROLES, ...ENRICHMENT_ROLES, ...FILTER_ROLES, ...COMBINED_ROLES]

/**
 * Builds a table data view whose columns carry the given roles, in order. Each input row supplies the slot values in
 * ALL_ROLES order, then Root Cause and Root Cause Category, then the enrichment, Filter menu and QCx Combined slots; a
 * missing or null cell becomes blank text.
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

/** Each slot's QCx Combined column. Title, Contractor, Due date and Created By (Company) aren't in the fixture's columns. */
const COMBINED_COLUMN_OF: ReadonlyArray<readonly [SlotRole, (typeof COMBINED_COLUMNS)[number]]> = [
  ['id', 'ID'],
  ['status', 'Status'],
  ['type', 'Type'],
  ['createdOn', 'Created On'],
  ['updatedOn', 'Updated On'],
  ['createdBy', 'Created By'],
  ['rootCause', 'Root Cause'],
  ['bim360CreatedBy', 'BIM360 Created By'],
  ['bim360CreatedOn', 'BIM360 Created On'],
  ['bim360ClosedOn', 'BIM360 Closed On'],
  ['closedAt', 'Closed At'],
  ['source', 'Source'],
  ['rowId', 'Row ID'],
  ['workWeek', 'Work Week'],
  ['phase', 'Inspection Phase'],
  ['issue', 'Issue'],
]

/** The enriched export's columns QCx Combined gains, which only BIM rows carry. */
const ENRICHED_COLUMN_OF: ReadonlyArray<readonly [SlotRole, (typeof ENRICHED_ISSUE_COLUMNS)[number]]> = [
  ['title', 'Title'],
  ['contractor', 'Contractor'],
  ['dueDate', 'Due date'],
  ['createdByCompany', 'Created By (Company)'],
]

/** The enriched QCx Combined fixture in `tableDataView`'s row order, with the columns the QCx Issues slots need added. */
export function combinedIssueRows(): Cell[][] {
  const bimOffset = ENRICHED_COMBINED_ROWS.length - ENRICHED_ISSUE_ROWS.length
  return ENRICHED_COMBINED_ROWS.map((row, rowPosition) => {
    const cells = new Array<Cell>(ROW_ORDER.length).fill(null)
    for (const [role, column] of COMBINED_COLUMN_OF) cells[ROW_ORDER.indexOf(role)] = row[COMBINED_COLUMNS.indexOf(column)]
    if (rowPosition >= bimOffset) {
      const issue = ENRICHED_ISSUE_ROWS[rowPosition - bimOffset]
      for (const [role, column] of ENRICHED_COLUMN_OF) cells[ROW_ORDER.indexOf(role)] = issue[ENRICHED_ISSUE_COLUMNS.indexOf(column)]
    }
    return cells
  })
}
