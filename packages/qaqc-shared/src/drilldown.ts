import { parseDate } from './dates'
import { normalizeBuilding } from './inspections'
import { createIssueDetailReader } from './issues'
import { cellDisplayText, type Row } from './rowFilters'
import type { InspectionColumns, InspectionOptionalColumns, IssueColumns, IssueDetailRow, WeldColumns, WeldOptionalColumns } from './types'
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
  /** Width in px, for a column whose width is already settled. Otherwise it's estimated from the text. */
  width?: number
  /** Sorts on this number, blanks (null) last, instead of the text. For weeks and dates, whose text doesn't sort in time order. */
  sortNumber?: (row: Row) => number | null
  /** The direction of the first click on this header. Defaults to ascending. */
  firstDirection?: 'ascending' | 'descending'
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

/** A week's rows from a per-week list of row positions. `rows` must be the rows that built the list. Only reads that week's rows. */
export function weekRows(
  positionByKey: ReadonlyMap<number, number>,
  rowsByWeek: ReadonlyArray<readonly number[]>,
  rows: ReadonlyArray<Row>,
  key: number,
): Row[] {
  const position = positionByKey.get(key)
  if (position === undefined) return []
  return rowsByWeek[position].map((rowPosition) => rows[rowPosition])
}

/** The rows behind a week's issue count. `rows` must be the rows that built `index`. Only reads that week's rows. */
export function weekIssueRows(index: WeekIssueRowsIndex, rows: ReadonlyArray<Row>, key: number): Row[] {
  return weekRows(index.positionByKey, index.issueRowsByWeek, rows, key)
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

/** Issue Detail's columns and widths, reading each row as the index does. Weeks and dates sort in time order, newest first. */
export function issueDrillColumns(columns: IssueColumns): DrillColumn[] {
  const detailOf = createIssueDetailReader(columns)
  const text = (valueOf: (detail: IssueDetailRow) => string): ((row: Row) => string) => (row) => {
    const detail = detailOf(row)
    return detail === null ? '' : valueOf(detail)
  }
  const byTime = (valueOf: (detail: IssueDetailRow) => number | null): Pick<DrillColumn, 'sortNumber' | 'firstDirection'> => ({
    sortNumber: (row) => {
      const detail = detailOf(row)
      return detail === null ? null : valueOf(detail)
    },
    firstDirection: 'descending',
  })
  return [
    { key: 'id', label: 'ID', width: 78, read: text((detail) => detail.id) },
    { key: 'subtype', label: 'Subtype', width: 110, read: text((detail) => detail.subtype) },
    { key: 'status', label: 'Status', width: 150, read: text((detail) => detail.status) },
    { key: 'title', label: 'Title', read: text((detail) => detail.title), isLong: true },
    { key: 'contractor', label: 'Contractor', width: 140, read: text((detail) => detail.contractor) },
    { key: 'workWeek', label: 'Work Week', width: 104, read: text((detail) => detail.workWeek), ...byTime((detail) => detail.workWeekKey) },
    { key: 'createdOn', label: 'Created On', width: 100, read: text((detail) => detail.createdOn), ...byTime((detail) => detail.createdOnTime) },
    { key: 'workWeekClosed', label: 'Work Week Closed', width: 146, read: text((detail) => detail.workWeekClosed), ...byTime((detail) => detail.workWeekClosedKey) },
    { key: 'dueDate', label: 'Due Date', width: 96, read: text((detail) => detail.dueDate), ...byTime((detail) => detail.dueDateTime) },
  ]
}
