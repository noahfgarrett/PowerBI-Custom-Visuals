import { parseDate } from './dates'
import { normalizeBuilding } from './inspections'
import { cellDisplayText, type Row } from './rowFilters'
import type { InspectionColumns, InspectionOptionalColumns, WeldColumns, WeldOptionalColumns } from './types'
import { normalizePipeSpec, normalizeSystem } from './welds'

/** One column of a week's list. */
export interface DrillColumn {
  key: string
  label: string
  read: (row: Row) => string
  /** Free text: truncates with a title, and is the only kind of column that flexes to fill the width. */
  isLong?: boolean
  /** A code in capitals, such as a tag number: its letters run wider, and it's worth showing in full when there's room. */
  isCode?: boolean
}

/** One table of a week's list. A title labels it when a list has several, such as opened and closed. */
export interface DrillGroup {
  title: string | null
  columns: DrillColumn[]
  rows: ReadonlyArray<Row>
}

/** The parts of a dashboard index that list a week's rows. */
export interface WeekIssueRowsIndex {
  positionByKey: ReadonlyMap<number, number>
  issueRowsByWeek: ReadonlyArray<readonly number[]>
}

/** The rows behind a week's issue count. `rows` must be the rows that built `index`. Only reads that week's rows. */
export function weekIssueRows(index: WeekIssueRowsIndex, rows: ReadonlyArray<Row>, key: number): Row[] {
  const position = index.positionByKey.get(key)
  if (position === undefined) return []
  return index.issueRowsByWeek[position].map((rowPosition) => rows[rowPosition])
}

/** A column for an optional slot: none when it isn't bound. */
function optionalColumn(key: string, label: string, position: number, isLong?: boolean): DrillColumn[] {
  if (position < 0) return []
  return [{ key, label, read: (row) => cellDisplayText(row[position]), isLong }]
}

/** Dates can arrive as Date values, timestamps or serials; anything that isn't a date shows as it is. */
function dateColumn(key: string, label: string, position: number): DrillColumn[] {
  if (position < 0) return []
  return [{ key, label, read: (row) => cellDisplayText(parseDate(row[position]) ?? row[position]) }]
}

/** Electrical and Mechanical's list, in the spec's order. Unbound slots are hidden; the required ones always show. */
export function inspectionDrillColumns(columns: InspectionColumns, optional: InspectionOptionalColumns): DrillColumn[] {
  return [
    { key: 'building', label: 'Building', read: (row) => normalizeBuilding(row[columns.building]) },
    { key: 'phase', label: 'Phase', read: (row) => cellDisplayText(row[columns.phase]) },
    { key: 'issue', label: 'Issue', read: (row) => cellDisplayText(row[columns.issue]), isLong: true },
    ...optionalColumn('inspectionId', 'Inspection ID', optional.inspectionId),
    ...optionalColumn('equipmentTag', 'Equipment ID / Tag Number', optional.equipmentTag),
    ...optionalColumn('issueId', 'Issue ID', optional.issueId),
    ...optionalColumn('findingType', 'Finding Type', optional.findingType),
    ...optionalColumn('status', 'Status', optional.status),
    ...dateColumn('dateObserved', 'Date Observed', optional.dateObserved),
    ...optionalColumn('qcr', 'QCR/FE', optional.qcr),
    ...optionalColumn('notes', 'Notes', optional.notes, true),
  ]
}

/**
 * Welding's list, in the spec's order. An unbound Welder is hidden. No column here is free text, but a table with no
 * long column would stretch every fixed one, so Issue Created is the one that flexes: its text can run long.
 */
export function weldDrillColumns(columns: WeldColumns, optional: WeldOptionalColumns): DrillColumn[] {
  return [
    { key: 'tagNo', label: 'Tag No', read: (row) => cellDisplayText(row[columns.tagNo]), isCode: true },
    ...optionalColumn('welder', 'Welder', optional.welder).map((column) => ({ ...column, isCode: true })),
    { key: 'pipeSpec', label: 'Pipe Spec', read: (row) => normalizePipeSpec(row[columns.pipeSpec]), isCode: true },
    { key: 'fluidCode', label: 'Fluid Code', read: (row) => normalizeSystem(row[columns.fluidCode]), isCode: true },
    { key: 'issue', label: 'Issue Created', read: (row) => cellDisplayText(row[columns.issue]), isLong: true },
    { key: 'signature', label: 'Signature', read: (row) => cellDisplayText(row[columns.signature]) },
  ]
}
