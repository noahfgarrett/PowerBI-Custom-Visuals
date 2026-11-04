import { createSourceReader, inspectionColumnsOf, issueColumnsOf, splitCombinedRows, weldColumnsOf, type CombinedSource, type CombinedSplit } from './combined'
import type { FilterSourceNote } from './hooks/useDashboardFilters'
import { inspectionBuildingField, inspectionRowWeekKey } from './inspectionFilters'
import { DEFAULT_CONTRACTOR, issueContractor, issueFilterRows, issueRowWeekKey } from './issues'
import { buildOverviewIndex, type OverviewIndex } from './overview'
import { cellDisplayText, crossSourceBuildingKey, groupKey, optionalField, type FilterFieldDef, type Row } from './rowFilters'
import type { CombinedColumns, InspectionRows } from './types'
import { weldBuilding, weldRowWeekKey } from './welds'

/** What the dashboard needs to filter the Overview: the rows that built its index, split by Source. */
export interface OverviewFilterSource {
  split: CombinedSplit
  columns: CombinedColumns
}

/** An index a field filter rebuilt, and the rows its drill-down positions index. */
export interface FilteredOverview {
  index: OverviewIndex
  split: CombinedSplit
}

/**
 * The rows the Filter menu counts and matches: the ones the Overview can count. The LotusWorks limit on BIM issues has
 * no Created By (Company) field here to untick, and an unknown Source is never counted.
 */
export function overviewFilterRows(split: CombinedSplit, columns: CombinedColumns): InspectionRows {
  return [...split.electrical, ...split.mechanical, ...split.welding, ...issueFilterRows(split.bim, issueColumnsOf(columns))]
}

/**
 * The index for the rows a field filter left of `overviewFilterRows`. Filtering only removes rows, so a source with
 * as many rows as before has the same rows in the same order: its index is reused, positions and all.
 */
export function filterOverviewIndex(base: OverviewIndex, baseSplit: CombinedSplit, rows: InspectionRows, columns: CombinedColumns): FilteredOverview {
  const split: CombinedSplit = { ...splitCombinedRows(rows, columns.source), unknownSource: baseSplit.unknownSource }
  const countedBimRows = issueFilterRows(baseSplit.bim, issueColumnsOf(columns)).length
  const index = buildOverviewIndex(
    split,
    columns,
    base.today,
    {
      electrical: split.electrical.length === baseSplit.electrical.length ? base.electrical : undefined,
      mechanical: split.mechanical.length === baseSplit.mechanical.length ? base.mechanical : undefined,
      welding: split.welding.length === baseSplit.welding.length ? base.welding : undefined,
      bim: split.bim.length === countedBimRows ? base.bim : undefined,
    },
    base,
  )
  const filteredOut = new Set<CombinedSource>()
  for (const source of ['electrical', 'mechanical', 'welding', 'bim'] as const) {
    if (index[source].totalRows === 0 && base[source].totalRows > 0) filteredOut.add(source)
  }
  return {
    split,
    index: {
      ...index,
      filteredOut,
      // The rows that note counts never reach the filter.
      footnotes: { ...index.footnotes, bim: { ...index.footnotes.bim, excludedRows: base.footnotes.bim.excludedRows } },
    },
  }
}

const UNASSIGNED_KEY = groupKey(DEFAULT_CONTRACTOR)

/** Unassigned reads as '', the blank value, so inspections' blanks and BIM's defaulted issues are one value, listed last. */
function contractorValue(name: string): string {
  return groupKey(name) === UNASSIGNED_KEY ? '' : name
}

/** The menu's fields, in menu order. Only bound slots appear. Each reads only the sources that have it. */
export function overviewFilterFields(columns: CombinedColumns): FilterFieldDef[] {
  const sourceOf = createSourceReader(columns.source)
  const isInspection = (row: Row): boolean => {
    const source = sourceOf(row)
    return source === 'electrical' || source === 'mechanical'
  }
  const generalContractor = columns.generalContractor ?? -1
  const contractor = columns.contractor ?? -1
  const contractorFields: FilterFieldDef[] = generalContractor < 0 && contractor < 0
    ? []
    : [{
        id: 'contractor',
        label: 'Contractor',
        read: (row) => contractorValue(
          sourceOf(row) === 'bim' ? issueContractor(row[columns.id], row[contractor]) : cellDisplayText(row[generalContractor]),
        ),
        blankLabel: DEFAULT_CONTRACTOR,
        appliesTo: (row) => (sourceOf(row) === 'bim' ? contractor >= 0 : generalContractor >= 0 && isInspection(row)),
      }]
  const inspectionBuilding = inspectionBuildingField(columns.building)
  const building: FilterFieldDef = {
    ...inspectionBuilding,
    groupBy: crossSourceBuildingKey,
    read: (row) => (sourceOf(row) === 'welding' ? weldBuilding(row[columns.tagNo]) : inspectionBuilding.read(row)),
    appliesTo: (row) => (sourceOf(row) === 'welding' ? columns.tagNo >= 0 : isInspection(row)),
  }
  const disciplineFields = optionalField('discipline', 'Discipline', columns.discipline ?? -1)
    .map((field): FilterFieldDef => ({ ...field, appliesTo: (row) => sourceOf(row) === 'bim' || isInspection(row) }))
  return [...contractorFields, building, ...disciplineFields]
}

/** What each field leaves unfiltered, for the notes under the chips. */
export function overviewFilterNotes(columns: CombinedColumns): FilterSourceNote[] {
  const notes: FilterSourceNote[] = [
    { message: "Welding isn't filtered by Contractor", whenFieldActive: ['contractor'] },
    { message: "Welding isn't filtered by Discipline", whenFieldActive: ['discipline'] },
    { message: "BIM issues aren't filtered by Building", whenFieldActive: ['building'] },
  ]
  if (columns.tagNo < 0) notes.push({ message: "Welding isn't filtered by Building", whenFieldActive: ['building'] })
  if ((columns.contractor ?? -1) < 0) notes.push({ message: "BIM issues aren't filtered by Contractor", whenFieldActive: ['contractor'] })
  if ((columns.generalContractor ?? -1) < 0) notes.push({ message: "Inspections aren't filtered by Contractor", whenFieldActive: ['contractor'] })
  return notes
}

/** Reads a row's week the way its source's index does, for counting rows in a date range. Null with an unknown Source. */
export function overviewRowWeekKey(columns: CombinedColumns): (row: Row) => number | null {
  const sourceOf = createSourceReader(columns.source)
  const inspectionWeek = inspectionRowWeekKey(inspectionColumnsOf(columns))
  const weldWeek = weldRowWeekKey(weldColumnsOf(columns))
  const issueWeek = issueRowWeekKey(issueColumnsOf(columns))
  return (row) => {
    const source = sourceOf(row)
    switch (source) {
      case null:
        return null
      case 'electrical':
      case 'mechanical':
        return inspectionWeek(row)
      case 'welding':
        return weldWeek(row)
      case 'bim':
        return issueWeek(row)
      default: {
        const unreachable: never = source
        return unreachable
      }
    }
  }
}
