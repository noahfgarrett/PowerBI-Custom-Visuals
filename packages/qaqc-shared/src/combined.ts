import type { CombinedColumns, InspectionColumns, InspectionRows, IssueColumns, WeldColumns } from './types'
import { cellText } from './inspections'

/** A column the QCx Combined table doesn't carry. `row[-1]` is undefined, which every builder reads as a blank cell. */
const ABSENT_COLUMN = -1

/** The combined rows by Source. Rows are the table's own row arrays, never copies. */
export interface CombinedSplit {
  electrical: InspectionRows
  mechanical: InspectionRows
  welding: InspectionRows
  bim: InspectionRows
  /** Rows whose Source is blank or not one of the four sources. */
  unknownSource: number
}

export function splitCombinedRows(rows: InspectionRows, sourceColumn: number): CombinedSplit {
  const electrical: Array<ReadonlyArray<unknown>> = []
  const mechanical: Array<ReadonlyArray<unknown>> = []
  const welding: Array<ReadonlyArray<unknown>> = []
  const bim: Array<ReadonlyArray<unknown>> = []
  let unknownSource = 0

  for (const row of rows) {
    switch (cellText(row[sourceColumn]).toLowerCase()) {
      case 'electrical':
        electrical.push(row)
        break
      case 'mechanical':
        mechanical.push(row)
        break
      case 'welding':
        welding.push(row)
        break
      case 'bim':
        bim.push(row)
        break
      default:
        unknownSource += 1
    }
  }

  return { electrical, mechanical, welding, bim, unknownSource }
}

export function inspectionColumnsOf(columns: CombinedColumns): InspectionColumns {
  return {
    workWeek: columns.workWeek,
    phase: columns.phase,
    issue: columns.issue,
    building: columns.building,
  }
}

/** The combined table has no Fluid Code or Pipe Spec, so every weld falls under the Unspecified system and spec. */
export function weldColumnsOf(columns: CombinedColumns): WeldColumns {
  return {
    weldWeek: columns.workWeek,
    signature: columns.signature,
    signedWeek: columns.signedWeek,
    issue: columns.issue,
    fluidCode: ABSENT_COLUMN,
    pipeSpec: ABSENT_COLUMN,
    tagNo: columns.tagNo,
  }
}

/**
 * The combined table has no Title, Contractor, Due Date or Root Cause Category, so issues take the builder's defaults
 * for those. Root Cause and the enrichment columns stay −1 when the visual has no slot bound for them.
 */
export function issueColumnsOf(columns: CombinedColumns): IssueColumns {
  return {
    id: columns.id,
    title: ABSENT_COLUMN,
    status: columns.status,
    type: columns.type,
    contractor: ABSENT_COLUMN,
    createdOn: columns.createdOn,
    updatedOn: columns.updatedOn,
    dueDate: ABSENT_COLUMN,
    createdBy: columns.createdBy,
    rootCause: columns.rootCause,
    rootCauseCategory: ABSENT_COLUMN,
    bim360CreatedBy: columns.bim360CreatedBy ?? ABSENT_COLUMN,
    bim360CreatedOn: columns.bim360CreatedOn ?? ABSENT_COLUMN,
    bim360ClosedOn: columns.bim360ClosedOn ?? ABSENT_COLUMN,
    closedAt: columns.closedAt ?? ABSENT_COLUMN,
  }
}
