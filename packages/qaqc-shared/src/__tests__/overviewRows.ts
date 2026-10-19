import type { CombinedColumns } from '../types'
import type { ConnectedOverviewRow, OverviewCards, OverviewIndex, OverviewModel, OverviewRows } from '../overview'
import { splitCombinedRows } from '../combined'
import { buildOverviewIndex } from '../overview'

/** A compact combined layout for hand-built rows. */
export const COLUMNS: CombinedColumns = {
  source: 0,
  workWeek: 1,
  phase: 2,
  issue: 3,
  building: 4,
  qcr: -1,
  welder: -1,
  tagNo: 5,
  signature: 6,
  signedWeek: 7,
  id: 8,
  status: 9,
  type: 10,
  createdOn: 11,
  updatedOn: 12,
  createdBy: 13,
  rootCause: -1,
  greenTags: 14,
}
const WIDTH = 15

export const TODAY = new Date(2026, 9, 15) // WW42'2026

function blankRow(source: string): unknown[] {
  const row: unknown[] = new Array<unknown>(WIDTH).fill(null)
  row[COLUMNS.source] = source
  return row
}

export function inspection(source: 'Electrical' | 'Mechanical', week: string, phase: 'Final' | 'SOR', issue = 'No Issue Found'): unknown[] {
  const row = blankRow(source)
  row[COLUMNS.workWeek] = week
  row[COLUMNS.phase] = phase
  row[COLUMNS.issue] = issue
  row[COLUMNS.building] = 'F63.1'
  return row
}

export interface WeldOptions {
  /** Signs the weld in this week. */
  signedWeek?: string
  issue?: string
}

export function weld(week: string, options: WeldOptions = {}): unknown[] {
  const row = blankRow('Welding')
  row[COLUMNS.workWeek] = week
  row[COLUMNS.tagNo] = 'BK1XX104XX-M006-FW-1'
  row[COLUMNS.signature] = options.signedWeek === undefined ? null : 'signed'
  row[COLUMNS.signedWeek] = options.signedWeek ?? null
  row[COLUMNS.issue] = options.issue ?? 'No'
  return row
}

export interface BimOptions {
  status?: string
  type?: string
  updatedOn?: string
  createdBy?: string
}

export function bim(id: string, createdOn: string | null, options: BimOptions = {}): unknown[] {
  const row = blankRow('BIM')
  row[COLUMNS.id] = id
  row[COLUMNS.status] = options.status ?? 'Open'
  row[COLUMNS.type] = options.type ?? 'COR'
  row[COLUMNS.createdOn] = createdOn
  row[COLUMNS.updatedOn] = options.updatedOn ?? null
  row[COLUMNS.createdBy] = options.createdBy ?? 'LotusWorks'
  return row
}

export function times(count: number, make: () => unknown[]): unknown[][] {
  return Array.from({ length: count }, make)
}

/** Indexes hand-built rows, with the Green tags measure (when given) on every row as Power BI repeats it. */
export function overviewIndexOf(rows: unknown[][], greenTags?: unknown): OverviewIndex {
  if (greenTags !== undefined) {
    for (const row of rows) row[COLUMNS.greenTags] = greenTags
  }
  return buildOverviewIndex(splitCombinedRows(rows, COLUMNS.source), COLUMNS, TODAY)
}

/** A row the test expects to be connected; fails the test with the row's message when it isn't. */
export function rowOf(model: OverviewModel, name: keyof OverviewRows): ConnectedOverviewRow {
  const row = model.rows[name]
  if (!row.connected) throw new Error(`${name} row is not connected: ${row.message}`)
  return row
}

export function cardsOf(model: OverviewModel, name: keyof OverviewRows): OverviewCards {
  return rowOf(model, name).cards
}
