import { createWeekReader } from './grouping'
import { normalizeBuilding, UNSPECIFIED_BUILDING } from './inspections'
import { cellDisplayText, type FilterFieldDef, type Row } from './rowFilters'
import type { InspectionColumns, InspectionOptionalColumns, InspectionRows } from './types'

/** What a dashboard needs to rebuild its index when a field filter changes the rows. */
export interface InspectionFilterSource {
  rows: InspectionRows
  columns: InspectionColumns
  optional: InspectionOptionalColumns
  today: Date
}

/** A field for an optional slot: none when it isn't bound. */
function optionalField(id: string, label: string, position: number): FilterFieldDef[] {
  if (position < 0) return []
  return [{ id, label, read: (row) => cellDisplayText(row[position]) }]
}

/** The menu's fields, in menu order. Only bound slots appear; Building is required, so it always does. */
export function inspectionFilterFields(columns: InspectionColumns, optional: InspectionOptionalColumns): FilterFieldDef[] {
  const building: FilterFieldDef = {
    id: 'building',
    label: 'Building',
    // The charts' value. A blank reads as '' so it groups as the blank value: labelled Unspecified and listed last.
    read: (row) => {
      const name = normalizeBuilding(row[columns.building])
      return name === UNSPECIFIED_BUILDING ? '' : name
    },
    blankLabel: UNSPECIFIED_BUILDING,
  }
  return [
    ...optionalField('generalContractor', 'General Contractor', optional.generalContractor),
    ...optionalField('tradeSupplier', 'Trade Supplier', optional.tradeSupplier),
    building,
    ...optionalField('discipline', 'Discipline', optional.discipline),
    ...optionalField('inspectionCategory', 'Inspection Category', optional.inspectionCategory),
    ...optionalField('status', 'Status', optional.status),
  ]
}

/** Reads a row's Work Week the way the index does, for counting rows in a date range. */
export function inspectionRowWeekKey(columns: InspectionColumns): (row: Row) => number | null {
  const readWeek = createWeekReader()
  return (row) => readWeek(row[columns.workWeek])?.key ?? null
}
