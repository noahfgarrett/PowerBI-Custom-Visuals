import type { CombinedColumns, InspectionColumns, InspectionOptionalColumns, InspectionRows, IssueColumns, WeldColumns, WeldOptionalColumns } from './types'

export interface FieldSlot<Role extends string = keyof InspectionColumns | 'rowId'> {
  role: Role
  /** Field slot name in the Power BI Fields pane. */
  slot: string
  /** Smartsheet column the user drags into it. */
  column: string
  /** Optional on this visual, though another visual reading the same table may require the role. */
  isOptional?: boolean
}

export const REQUIRED_SLOTS: readonly FieldSlot[] = [
  { role: 'workWeek', slot: 'Work Week', column: 'Work Week Observed' },
  { role: 'phase', slot: 'Inspection Phase', column: 'Inspection Phase' },
  { role: 'issue', slot: 'Issue?', column: 'Issue?' },
  { role: 'building', slot: 'Building', column: 'Building' },
  { role: 'rowId', slot: 'Row ID', column: 'Index' },
]

/**
 * The filter menu's fields and the drill-down's columns. A report without them keeps working. A visual declares the
 * ones its sheet has, in this order, under the sheet's spelling: Mechanical has no Inspection ID, and writes `QCR / FE`.
 */
export const INSPECTION_OPTIONAL_SLOTS: readonly FieldSlot<keyof InspectionOptionalColumns>[] = [
  { role: 'generalContractor', slot: 'General Contractor', column: 'General Contractor' },
  { role: 'tradeSupplier', slot: 'Trade Supplier', column: 'Trade Supplier' },
  { role: 'discipline', slot: 'Discipline', column: 'Discipline' },
  { role: 'inspectionCategory', slot: 'Inspection Category', column: 'Inspection Category' },
  { role: 'status', slot: 'Status', column: 'Status' },
  { role: 'inspectionId', slot: 'Inspection ID', column: 'Inspection ID' },
  { role: 'equipmentTag', slot: 'Equipment ID / Tag Number', column: 'Equipment ID / Tag Number' },
  { role: 'issueId', slot: 'Issue ID', column: 'Issue ID' },
  { role: 'findingType', slot: 'Finding Type', column: 'Finding Type' },
  { role: 'dateObserved', slot: 'Date Observed', column: 'Date Observed' },
  { role: 'qcr', slot: 'QCR/FE', column: 'QCR/FE' },
  { role: 'notes', slot: 'Notes', column: 'Notes' },
]

export type TableReadResult =
  | { kind: 'missing'; missing: FieldSlot[] }
  | { kind: 'ready'; rows: InspectionRows; columns: InspectionColumns; optional: InspectionOptionalColumns }

export interface TableColumnLike {
  roles?: { [role: string]: boolean }
}

export interface InspectionTableSource {
  columns: ReadonlyArray<TableColumnLike>
  rows?: InspectionRows
}

export function readInspectionTable(table: InspectionTableSource | undefined): TableReadResult {
  if (!table) return { kind: 'missing', missing: [...REQUIRED_SLOTS] }

  const positionOf = (role: string): number => table.columns.findIndex((column) => column.roles?.[role] === true)
  const workWeek = positionOf('workWeek')
  const phase = positionOf('phase')
  const issue = positionOf('issue')
  const building = positionOf('building')
  const rowId = positionOf('rowId')

  const positions = { workWeek, phase, issue, building, rowId }
  const missing = REQUIRED_SLOTS.filter((slot) => positions[slot.role] < 0)
  if (missing.length > 0) return { kind: 'missing', missing }

  return {
    kind: 'ready',
    rows: table.rows ?? [],
    columns: { workWeek, phase, issue, building },
    optional: {
      generalContractor: positionOf('generalContractor'),
      tradeSupplier: positionOf('tradeSupplier'),
      discipline: positionOf('discipline'),
      inspectionCategory: positionOf('inspectionCategory'),
      status: positionOf('status'),
      inspectionId: positionOf('inspectionId'),
      equipmentTag: positionOf('equipmentTag'),
      issueId: positionOf('issueId'),
      findingType: positionOf('findingType'),
      dateObserved: positionOf('dateObserved'),
      qcr: positionOf('qcr'),
      notes: positionOf('notes'),
    },
  }
}

export type WeldSlotRole = keyof WeldColumns | 'rowId'
export type WeldFieldSlot = FieldSlot<WeldSlotRole>

export const WELD_SLOTS: readonly WeldFieldSlot[] = [
  { role: 'weldWeek', slot: 'Weld Work Week', column: 'WELD WORK WEEK' },
  { role: 'signature', slot: 'Signature', column: 'SIGNATURE' },
  { role: 'signedWeek', slot: 'Work Week Signed', column: 'WORK WEEK SIGNED' },
  { role: 'issue', slot: 'Issue Created', column: 'ISSUE CREATED? (Put BIM # If Yes)' },
  { role: 'fluidCode', slot: 'Fluid Code', column: 'FLUID CODE' },
  { role: 'pipeSpec', slot: 'Pipe Spec', column: 'PIPE SPEC' },
  { role: 'tagNo', slot: 'Tag No', column: 'TAG NO' },
  { role: 'rowId', slot: 'Row ID', column: 'Index' },
]

/** The filter menu's extra fields, and the drill-down's Welder. A report without them keeps working. */
export const WELD_OPTIONAL_SLOTS: readonly FieldSlot<keyof WeldOptionalColumns>[] = [
  { role: 'welder', slot: 'Welder', column: 'WELDER' },
  { role: 'workPackage', slot: 'Work Package', column: 'WORK PKG' },
]

export type WeldTableReadResult =
  | { kind: 'missing'; missing: WeldFieldSlot[] }
  | { kind: 'ready'; rows: InspectionRows; columns: WeldColumns; optional: WeldOptionalColumns }

export function readWeldTable(table: InspectionTableSource | undefined): WeldTableReadResult {
  if (!table) return { kind: 'missing', missing: [...WELD_SLOTS] }

  const positionOf = (role: string): number => table.columns.findIndex((column) => column.roles?.[role] === true)
  const positions: Record<WeldSlotRole, number> = {
    weldWeek: positionOf('weldWeek'),
    signature: positionOf('signature'),
    signedWeek: positionOf('signedWeek'),
    issue: positionOf('issue'),
    fluidCode: positionOf('fluidCode'),
    pipeSpec: positionOf('pipeSpec'),
    tagNo: positionOf('tagNo'),
    rowId: positionOf('rowId'),
  }
  const missing = WELD_SLOTS.filter((slot) => positions[slot.role] < 0)
  if (missing.length > 0) return { kind: 'missing', missing }

  return {
    kind: 'ready',
    rows: table.rows ?? [],
    columns: {
      weldWeek: positions.weldWeek,
      signature: positions.signature,
      signedWeek: positions.signedWeek,
      issue: positions.issue,
      fluidCode: positions.fluidCode,
      pipeSpec: positions.pipeSpec,
      tagNo: positions.tagNo,
    },
    optional: {
      welder: positionOf('welder'),
      workPackage: positionOf('workPackage'),
    },
  }
}

export type IssueSlotRole = keyof IssueColumns
export type IssueFieldSlot = FieldSlot<IssueSlotRole>

/** Issue IDs are unique, so Power BI never merges two issues and no Row ID slot is needed. */
export const ISSUE_SLOTS: readonly IssueFieldSlot[] = [
  { role: 'id', slot: 'ID', column: 'ID' },
  { role: 'title', slot: 'Title', column: 'Title' },
  { role: 'status', slot: 'Status', column: 'Status' },
  { role: 'type', slot: 'Type', column: 'Type' },
  { role: 'contractor', slot: 'Contractor', column: 'Contractor' },
  { role: 'createdOn', slot: 'Created On', column: 'Created On' },
  { role: 'updatedOn', slot: 'Updated On', column: 'Updated On' },
  { role: 'dueDate', slot: 'Due Date', column: 'Due Date' },
  { role: 'createdBy', slot: 'Created By', column: 'Created By' },
  { role: 'rootCause', slot: 'Root Cause', column: 'Root Cause' },
  { role: 'rootCauseCategory', slot: 'Root Cause Category', column: 'Root Cause Category' },
  { role: 'bim360CreatedBy', slot: 'BIM360 Created By', column: 'BIM360_Created By' },
  { role: 'bim360CreatedOn', slot: 'BIM360 Created On', column: 'BIM360_Created On' },
  { role: 'bim360ClosedOn', slot: 'BIM360 Closed On', column: 'BIM360_Closed On' },
  { role: 'closedAt', slot: 'Closed At', column: 'Closed at' },
  { role: 'createdByCompany', slot: 'Created By (Company)', column: 'Created By (Company)' },
  { role: 'discipline', slot: 'Discipline', column: 'Discipline' },
  { role: 'source', slot: 'Source', column: 'Source' },
  { role: 'rowId', slot: 'Row ID', column: 'Row ID' },
  { role: 'workWeek', slot: 'Work Week', column: 'Work Week' },
  { role: 'phase', slot: 'Inspection Phase', column: 'Inspection Phase' },
  { role: 'issue', slot: 'Issue', column: 'Issue' },
]

/**
 * Root Cause and its category only feed the Pareto, so reports without them keep working. The enrichment slots only
 * exist in the enriched Autodesk export; without them every issue reads its standard Created By and dates. Created By
 * (Company) and Discipline only add Filter menu fields. Source and the slots after it only matter when the visual is
 * bound to QCx Combined.
 */
export const OPTIONAL_ISSUE_ROLES: ReadonlySet<IssueSlotRole> = new Set<IssueSlotRole>([
  'rootCause',
  'rootCauseCategory',
  'bim360CreatedBy',
  'bim360CreatedOn',
  'bim360ClosedOn',
  'closedAt',
  'createdByCompany',
  'discipline',
  'source',
  'rowId',
  'workWeek',
  'phase',
  'issue',
])

export type IssueTableReadResult =
  | { kind: 'missing'; missing: IssueFieldSlot[] }
  | { kind: 'ready'; rows: InspectionRows; columns: IssueColumns }

/** Cells pass through untouched: the issue index parses strings, numbers and the Date objects Power BI may send. */
export function readIssueTable(table: InspectionTableSource | undefined): IssueTableReadResult {
  const required = ISSUE_SLOTS.filter((slot) => !OPTIONAL_ISSUE_ROLES.has(slot.role))
  if (!table) return { kind: 'missing', missing: required }

  const positionOf = (role: string): number => table.columns.findIndex((column) => column.roles?.[role] === true)
  const columns: Required<IssueColumns> = {
    id: positionOf('id'),
    title: positionOf('title'),
    status: positionOf('status'),
    type: positionOf('type'),
    contractor: positionOf('contractor'),
    createdOn: positionOf('createdOn'),
    updatedOn: positionOf('updatedOn'),
    dueDate: positionOf('dueDate'),
    createdBy: positionOf('createdBy'),
    rootCause: positionOf('rootCause'),
    rootCauseCategory: positionOf('rootCauseCategory'),
    bim360CreatedBy: positionOf('bim360CreatedBy'),
    bim360CreatedOn: positionOf('bim360CreatedOn'),
    bim360ClosedOn: positionOf('bim360ClosedOn'),
    closedAt: positionOf('closedAt'),
    createdByCompany: positionOf('createdByCompany'),
    discipline: positionOf('discipline'),
    source: positionOf('source'),
    rowId: positionOf('rowId'),
    workWeek: positionOf('workWeek'),
    phase: positionOf('phase'),
    issue: positionOf('issue'),
  }
  const missing = required.filter((slot) => columns[slot.role] < 0)
  if (missing.length > 0) return { kind: 'missing', missing }

  return { kind: 'ready', rows: table.rows ?? [], columns }
}

/** Row ID is read by nothing, but without it Power BI merges identical inspection rows and the rate is wrong. */
const INSPECTION_CARD_ROLES: readonly IssueSlotRole[] = ['rowId', 'workWeek', 'phase', 'issue']

export type IssueInspectionColumnsResult =
  | { kind: 'missing'; missing: IssueFieldSlot[] }
  | { kind: 'ready'; columns: InspectionColumns }

/**
 * The inspection columns NCR Pass Rate reads from an issues table bound to QCx Combined. The card has no use for
 * Building and the visual has no slot for it: `row[-1]` is undefined, which the index reads as a blank cell.
 */
export function readIssueInspectionColumns(columns: IssueColumns): IssueInspectionColumnsResult {
  const missing = ISSUE_SLOTS.filter((slot) => INSPECTION_CARD_ROLES.includes(slot.role) && (columns[slot.role] ?? -1) < 0)
  if (missing.length > 0) return { kind: 'missing', missing }
  return {
    kind: 'ready',
    columns: { workWeek: columns.workWeek ?? -1, phase: columns.phase ?? -1, issue: columns.issue ?? -1, building: -1 },
  }
}

export type CombinedSlotRole = keyof CombinedColumns | 'rowId'
export type CombinedFieldSlot = FieldSlot<CombinedSlotRole>

// The two visuals bind the same QCx Combined table but declare only the slots they use.
export const OVERVIEW_SLOTS: readonly CombinedFieldSlot[] = [
  { role: 'source', slot: 'Source', column: 'Source' },
  { role: 'rowId', slot: 'Row ID', column: 'Row ID' },
  { role: 'workWeek', slot: 'Work Week', column: 'Work Week' },
  { role: 'phase', slot: 'Inspection Phase', column: 'Inspection Phase' },
  { role: 'issue', slot: 'Issue', column: 'Issue' },
  { role: 'building', slot: 'Building', column: 'Building' },
  { role: 'signature', slot: 'Signature', column: 'Signature' },
  { role: 'signedWeek', slot: 'Work Week Signed', column: 'Work Week Signed' },
  { role: 'id', slot: 'ID', column: 'ID' },
  { role: 'status', slot: 'Status', column: 'Status' },
  { role: 'type', slot: 'Type', column: 'Type' },
  { role: 'createdOn', slot: 'Created On', column: 'Created On' },
  { role: 'updatedOn', slot: 'Updated On', column: 'Updated On' },
  { role: 'createdBy', slot: 'Created By', column: 'Created By' },
  { role: 'rootCause', slot: 'Root Cause', column: 'Root Cause' },
  { role: 'bim360CreatedBy', slot: 'BIM360 Created By', column: 'BIM360 Created By' },
  { role: 'bim360CreatedOn', slot: 'BIM360 Created On', column: 'BIM360 Created On' },
  { role: 'bim360ClosedOn', slot: 'BIM360 Closed On', column: 'BIM360 Closed On' },
  { role: 'closedAt', slot: 'Closed At', column: 'Closed At' },
  { role: 'generalContractor', slot: 'General Contractor', column: 'General Contractor' },
  { role: 'contractor', slot: 'Contractor', column: 'Contractor' },
  { role: 'discipline', slot: 'Discipline', column: 'Discipline' },
  { role: 'tagNo', slot: 'Tag No', column: 'Tag No', isOptional: true },
  { role: 'welder', slot: 'Welder', column: 'Welder', isOptional: true },
  { role: 'pipeSpec', slot: 'Pipe Spec', column: 'Pipe Spec' },
  { role: 'fluidCode', slot: 'Fluid Code', column: 'Fluid Code' },
  { role: 'inspectionId', slot: 'Inspection ID', column: 'Inspection ID' },
  { role: 'equipmentTag', slot: 'Equipment ID / Tag Number', column: 'Equipment ID / Tag Number' },
  { role: 'issueId', slot: 'Issue ID', column: 'Issue ID' },
  { role: 'findingType', slot: 'Finding Type', column: 'Finding Type' },
  { role: 'dateObserved', slot: 'Date Observed', column: 'Date Observed' },
  { role: 'qcr', slot: 'QCR/FE', column: 'QCR/FE', isOptional: true },
  { role: 'notes', slot: 'Notes', column: 'Notes' },
  { role: 'greenTags', slot: 'Green tags', column: 'Green tags measure' },
]

export const PERFORMANCE_SLOTS: readonly CombinedFieldSlot[] = [
  { role: 'source', slot: 'Source', column: 'Source' },
  { role: 'rowId', slot: 'Row ID', column: 'Row ID' },
  { role: 'workWeek', slot: 'Work Week', column: 'Work Week' },
  { role: 'phase', slot: 'Inspection Phase', column: 'Inspection Phase' },
  { role: 'issue', slot: 'Issue', column: 'Issue' },
  { role: 'building', slot: 'Building', column: 'Building' },
  { role: 'qcr', slot: 'QCR/FE', column: 'QCR/FE' },
  { role: 'welder', slot: 'Welder', column: 'Welder' },
  { role: 'tagNo', slot: 'Tag No', column: 'Tag No' },
]

/**
 * Green tags is a measure the user may leave out; without it the DWN rate shows n/a.
 * Root Cause only feeds the Top root cause card, which asks for it when unbound.
 * The enrichment columns only matter for issues migrated from BIM 360; without them every issue reads its standard
 * Created By and dates.
 * The rest only add Filter menu fields and drill-down columns, so reports without them keep working.
 */
export const OPTIONAL_COMBINED_ROLES: ReadonlySet<CombinedSlotRole> = new Set<CombinedSlotRole>([
  'rootCause',
  'bim360CreatedBy',
  'bim360CreatedOn',
  'bim360ClosedOn',
  'closedAt',
  'greenTags',
  'generalContractor',
  'contractor',
  'tradeSupplier',
  'discipline',
  'inspectionCategory',
  'inspectionId',
  'equipmentTag',
  'issueId',
  'findingType',
  'dateObserved',
  'notes',
  'pipeSpec',
  'fluidCode',
  'workPackage',
  'title',
  'dueDate',
  'createdByCompany',
])

/** The slots a visual can't draw without. */
export function requiredCombinedSlots(slots: readonly CombinedFieldSlot[]): CombinedFieldSlot[] {
  return slots.filter((slot) => slot.isOptional !== true && !OPTIONAL_COMBINED_ROLES.has(slot.role))
}

export type CombinedTableReadResult =
  | { kind: 'missing'; missing: CombinedFieldSlot[] }
  | { kind: 'ready'; rows: InspectionRows; columns: CombinedColumns }

/** Roles outside the visual's slot list are never bound, so their positions come back as −1. */
export function readCombinedTable(
  table: InspectionTableSource | undefined,
  slots: readonly CombinedFieldSlot[],
): CombinedTableReadResult {
  const required = requiredCombinedSlots(slots)
  if (!table) return { kind: 'missing', missing: required }

  const positionOf = (role: string): number => table.columns.findIndex((column) => column.roles?.[role] === true)
  const columns: Required<CombinedColumns> = {
    source: positionOf('source'),
    workWeek: positionOf('workWeek'),
    phase: positionOf('phase'),
    issue: positionOf('issue'),
    building: positionOf('building'),
    qcr: positionOf('qcr'),
    welder: positionOf('welder'),
    tagNo: positionOf('tagNo'),
    signature: positionOf('signature'),
    signedWeek: positionOf('signedWeek'),
    id: positionOf('id'),
    status: positionOf('status'),
    type: positionOf('type'),
    createdOn: positionOf('createdOn'),
    updatedOn: positionOf('updatedOn'),
    createdBy: positionOf('createdBy'),
    rootCause: positionOf('rootCause'),
    greenTags: positionOf('greenTags'),
    bim360CreatedBy: positionOf('bim360CreatedBy'),
    bim360CreatedOn: positionOf('bim360CreatedOn'),
    bim360ClosedOn: positionOf('bim360ClosedOn'),
    closedAt: positionOf('closedAt'),
    generalContractor: positionOf('generalContractor'),
    contractor: positionOf('contractor'),
    tradeSupplier: positionOf('tradeSupplier'),
    discipline: positionOf('discipline'),
    inspectionCategory: positionOf('inspectionCategory'),
    inspectionId: positionOf('inspectionId'),
    equipmentTag: positionOf('equipmentTag'),
    issueId: positionOf('issueId'),
    findingType: positionOf('findingType'),
    dateObserved: positionOf('dateObserved'),
    notes: positionOf('notes'),
    pipeSpec: positionOf('pipeSpec'),
    fluidCode: positionOf('fluidCode'),
    workPackage: positionOf('workPackage'),
    title: positionOf('title'),
    dueDate: positionOf('dueDate'),
    createdByCompany: positionOf('createdByCompany'),
  }
  const positions: Record<CombinedSlotRole, number> = { ...columns, rowId: positionOf('rowId') }
  const missing = required.filter((slot) => positions[slot.role] < 0)
  if (missing.length > 0) return { kind: 'missing', missing }

  return { kind: 'ready', rows: table.rows ?? [], columns }
}

/**
 * The Green tags measure isn't related to the combined table, so it repeats the same total on every row.
 * Returns the first finite number in the column (numbers or numeric text), or null when there is none.
 */
export function readGreenTags(rows: InspectionRows, column: number): number | null {
  if (column < 0) return null
  for (const row of rows) {
    const value = row[column]
    if (typeof value === 'number') {
      if (Number.isFinite(value)) return value
      continue
    }
    if (typeof value !== 'string') continue
    const text = value.trim()
    if (!text) continue
    const parsed = Number(text)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}
