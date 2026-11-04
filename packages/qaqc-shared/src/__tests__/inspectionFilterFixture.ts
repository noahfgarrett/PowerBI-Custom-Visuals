import type { InspectionFilterSource } from '../inspectionFilters'
import type { InspectionColumns, InspectionOptionalColumns, InspectionRows } from '../types'

export const INSPECTION_COLUMNS: InspectionColumns = { workWeek: 0, phase: 1, issue: 2, building: 3 }

export const UNBOUND_OPTIONAL: InspectionOptionalColumns = {
  generalContractor: -1,
  tradeSupplier: -1,
  discipline: -1,
  inspectionCategory: -1,
  status: -1,
  inspectionId: -1,
  equipmentTag: -1,
  issueId: -1,
  findingType: -1,
  dateObserved: -1,
  qcr: -1,
  notes: -1,
}

/** The columns `withPlaceholderColumns` adds after the four required ones. */
export const PLACEHOLDER_OPTIONAL: InspectionOptionalColumns = {
  generalContractor: 4,
  tradeSupplier: 5,
  discipline: 6,
  inspectionCategory: 7,
  status: 8,
  inspectionId: 9,
  equipmentTag: 10,
  issueId: 11,
  findingType: 12,
  dateObserved: 13,
  qcr: 14,
  notes: 15,
}

const CONTRACTORS = ['Greyfox', 'Bayside', 'Larch']
const SUPPLIERS = ['Supplier A', 'Supplier B', '']
const DISCIPLINES = ['Electrical', 'ELECTRICAL', 'Controls', 'N/A']
const CATEGORIES = ['Cable', 'Conduit', 'Panel', 'Tray', 'Grounding']
const STATUSES = ['Closed', 'Closed', 'Open', 'Pending']
const FINDING_TYPES = ['Workmanship', 'Documentation', 'Damage']
const INSPECTORS = ['QCR A', 'QCR B', 'FE C']
const NOTES = ['', 'Rework booked with the supplier, to be reinspected once the replacement parts have been delivered to site', 'Photo on file']

/** Adds made-up filter columns to fixture rows, repeating by row position so counts stay stable. */
export function withPlaceholderColumns(rows: InspectionRows): InspectionRows {
  return rows.map((row, position) => [
    ...row,
    CONTRACTORS[position % CONTRACTORS.length],
    SUPPLIERS[position % SUPPLIERS.length],
    DISCIPLINES[position % DISCIPLINES.length],
    CATEGORIES[position % CATEGORIES.length],
    STATUSES[position % STATUSES.length],
    `INS-${String(position + 1).padStart(4, '0')}`,
    `TAG-${String(position % 500).padStart(3, '0')}`,
    90000 + position,
    FINDING_TYPES[position % FINDING_TYPES.length],
    new Date(2026, position % 12, (position % 28) + 1),
    INSPECTORS[position % INSPECTORS.length],
    NOTES[position % NOTES.length],
  ])
}

export function filterSourceFor(
  rows: InspectionRows,
  today: Date,
  optional: InspectionOptionalColumns = UNBOUND_OPTIONAL,
): InspectionFilterSource {
  return { rows, columns: INSPECTION_COLUMNS, optional, today }
}
