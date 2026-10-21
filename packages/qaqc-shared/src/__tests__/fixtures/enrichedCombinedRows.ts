import { COMBINED_COLUMNS, COMBINED_ROWS } from './combinedRows'
import { ENRICHED_ISSUE_COLUMNS, ENRICHED_ISSUE_ROWS } from './enrichedIssueRows'

type CombinedColumn = (typeof COMBINED_COLUMNS)[number]
type EnrichedColumn = (typeof ENRICHED_ISSUE_COLUMNS)[number]
type CombinedCell = string | number | null

/** The enriched export column each QCx Combined BIM column comes from, as QCx_Combined.pq selects and renames it. */
const BIM_SOURCE: ReadonlyArray<[CombinedColumn, EnrichedColumn]> = [
  ['ID', 'ID'],
  ['Status', 'Status'],
  ['Type', 'Type'],
  ['Created On', 'Created on'],
  ['Updated On', 'Updated on'],
  ['Created By', 'Created by'],
  ['Root Cause', 'Root cause'],
  ['BIM360 Created By', 'BIM360_Created By'],
  ['BIM360 Created On', 'BIM360_Created On'],
  ['BIM360 Closed On', 'BIM360_Closed On'],
  ['Closed At', 'Closed at'],
]

function bimRow(cells: ReadonlyArray<string | null>, rowId: number): CombinedCell[] {
  const row = new Array<CombinedCell>(COMBINED_COLUMNS.length).fill(null)
  row[COMBINED_COLUMNS.indexOf('Source')] = 'BIM'
  row[COMBINED_COLUMNS.indexOf('Row ID')] = rowId
  for (const [combined, enriched] of BIM_SOURCE) row[COMBINED_COLUMNS.indexOf(combined)] = cells[ENRICHED_ISSUE_COLUMNS.indexOf(enriched)]
  return row
}

const SOURCE = COMBINED_COLUMNS.indexOf('Source')
const inspectionRows = COMBINED_ROWS.filter((row) => row[SOURCE] !== 'BIM')

/**
 * The QCx Combined fixture with its Smartsheet BIM rows replaced by the enriched Autodesk export's 1,077 issues. The
 * Electrical, Mechanical and Welding rows come first and keep their Row IDs; the BIM rows are numbered after them.
 */
export const ENRICHED_COMBINED_ROWS: ReadonlyArray<ReadonlyArray<CombinedCell>> = [
  ...inspectionRows,
  ...ENRICHED_ISSUE_ROWS.map((cells, offset) => bimRow(cells, inspectionRows.length + offset + 1)),
]
