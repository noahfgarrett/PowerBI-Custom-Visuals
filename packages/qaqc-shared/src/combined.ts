import type { CombinedColumns, InspectionColumns, InspectionOptionalColumns, InspectionRows, IssueColumns, WeldColumns, WeldOptionalColumns } from './types'
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

export type CombinedSource = 'electrical' | 'mechanical' | 'welding' | 'bim'

function sourceFromText(text: string): CombinedSource | null {
  switch (text) {
    case 'electrical':
    case 'mechanical':
    case 'welding':
    case 'bim':
      return text
    default:
      return null
  }
}

/** Reads a row's Source as `splitCombinedRows` does, remembered by the cell: a table has four or so spellings of it. */
export function createSourceReader(sourceColumn: number): (row: ReadonlyArray<unknown>) => CombinedSource | null {
  const cache = new Map<unknown, CombinedSource | null>()
  return (row) => {
    const cell = row[sourceColumn]
    const cached = cache.get(cell)
    if (cached !== undefined) return cached
    const source = sourceFromText(cellText(cell).toLowerCase())
    cache.set(cell, source)
    return source
  }
}

export function inspectionColumnsOf(columns: CombinedColumns): InspectionColumns {
  return {
    workWeek: columns.workWeek,
    phase: columns.phase,
    issue: columns.issue,
    building: columns.building,
  }
}

/** Fluid Code and Pipe Spec stay −1 while their slots are unbound, so every weld falls under the Unspecified system and spec. */
export function weldColumnsOf(columns: CombinedColumns): WeldColumns {
  return {
    weldWeek: columns.workWeek,
    signature: columns.signature,
    signedWeek: columns.signedWeek,
    issue: columns.issue,
    fluidCode: columns.fluidCode ?? ABSENT_COLUMN,
    pipeSpec: columns.pipeSpec ?? ABSENT_COLUMN,
    tagNo: columns.tagNo,
  }
}

/** The drill-down's Welder and the filter's Work Package; −1 while unbound. */
export function weldOptionalColumnsOf(columns: CombinedColumns): WeldOptionalColumns {
  return {
    welder: columns.welder,
    workPackage: columns.workPackage ?? ABSENT_COLUMN,
  }
}

/** The inspection rows' filter and drill-down columns; −1 while unbound. */
export function inspectionOptionalColumnsOf(columns: CombinedColumns): InspectionOptionalColumns {
  return {
    generalContractor: columns.generalContractor ?? ABSENT_COLUMN,
    tradeSupplier: columns.tradeSupplier ?? ABSENT_COLUMN,
    discipline: columns.discipline ?? ABSENT_COLUMN,
    inspectionCategory: columns.inspectionCategory ?? ABSENT_COLUMN,
    status: columns.status,
    inspectionId: columns.inspectionId ?? ABSENT_COLUMN,
    equipmentTag: columns.equipmentTag ?? ABSENT_COLUMN,
    issueId: columns.issueId ?? ABSENT_COLUMN,
    findingType: columns.findingType ?? ABSENT_COLUMN,
    dateObserved: columns.dateObserved ?? ABSENT_COLUMN,
    qcr: columns.qcr,
    notes: columns.notes ?? ABSENT_COLUMN,
  }
}

/**
 * The index builds from the Overview's bound columns, and it shows no issue's Title, Contractor or Due Date, so issues
 * take the builder's defaults for those. The table has no Root Cause Category. Root Cause and the enrichment columns
 * stay −1 when the visual has no slot bound for them.
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
