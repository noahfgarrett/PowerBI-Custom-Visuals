import type { CombinedSplit } from '../combined'
import { splitCombinedRows } from '../combined'
import { buildOverviewIndex, type OverviewFilterSource, type OverviewIndex } from '../overview'
import type { CombinedColumns, InspectionRows } from '../types'
import { COMBINED_COLUMNS } from './fixtures/combinedRows'
import { COLUMNS, TODAY } from './overviewRows'

/** The compact layout of `overviewRows`, with the new QCx Combined columns after it. */
export const FILTER_COLUMNS: CombinedColumns = {
  ...COLUMNS,
  qcr: 16,
  welder: 17,
  generalContractor: 18,
  contractor: 19,
  discipline: 20,
  inspectionId: 21,
  equipmentTag: 22,
  issueId: 23,
  findingType: 24,
  dateObserved: 25,
  notes: 26,
  pipeSpec: 27,
  fluidCode: 28,
}

export interface FilterValues {
  generalContractor?: string
  contractor?: string
  discipline?: string
  building?: string
  tagNo?: string
  pipeSpec?: string
  fluidCode?: string
}

/** Sets the filter columns on a row from `overviewRows`, widening it first. */
export function withValues(row: unknown[], values: FilterValues): unknown[] {
  const wide = [...row, ...new Array<unknown>(13).fill(null)]
  if (values.generalContractor !== undefined) wide[FILTER_COLUMNS.generalContractor ?? -1] = values.generalContractor
  if (values.contractor !== undefined) wide[FILTER_COLUMNS.contractor ?? -1] = values.contractor
  if (values.discipline !== undefined) wide[FILTER_COLUMNS.discipline ?? -1] = values.discipline
  if (values.building !== undefined) wide[FILTER_COLUMNS.building] = values.building
  if (values.tagNo !== undefined) wide[FILTER_COLUMNS.tagNo] = values.tagNo
  if (values.pipeSpec !== undefined) wide[FILTER_COLUMNS.pipeSpec ?? -1] = values.pipeSpec
  if (values.fluidCode !== undefined) wide[FILTER_COLUMNS.fluidCode ?? -1] = values.fluidCode
  return wide
}

export interface FilterSetup {
  rows: InspectionRows
  split: CombinedSplit
  index: OverviewIndex
  filterSource: OverviewFilterSource
}

/** The index and filter source a visual would hand the dashboard. */
export function filterSetup(rows: InspectionRows, columns: CombinedColumns = FILTER_COLUMNS): FilterSetup {
  const split = splitCombinedRows(rows, columns.source)
  return { rows, split, index: buildOverviewIndex(split, columns, TODAY), filterSource: { split, columns } }
}

// Made-up companies, tags and notes; the Combined fixture's other cells are already pseudonyms.
const CONTRACTORS = ['Greyfox', 'Bayside', 'Larch', '']
const BIM_CONTRACTORS = ['Bayside', 'BAYSIDE', 'Tasman', '']
const DISCIPLINES = ['Electrical', 'ELECTRICAL', 'Controls', 'N/A']
const STATUSES = ['Closed', 'Open', 'Pending']
const FINDING_TYPES = ['Workmanship', 'Documentation', 'Damage']
const NOTES = ['', 'Rework booked with the supplier, to be reinspected once the replacement parts have been delivered to site', 'Photo on file']
const PIPE_SPECS = ['PCH', 'PEH', 'SS1', '']
const FLUID_CODES = ['AW', 'CWS', 'LN2', '']

const SOURCE = COMBINED_COLUMNS.indexOf('Source')
const STATUS = COMBINED_COLUMNS.indexOf('Status')
const BASE_WIDTH = COMBINED_COLUMNS.length

/** The fixture's columns with every new one the Overview can bind, after the QCx Combined fixture's own. */
export const COMBINED_FILTER_POSITIONS = {
  generalContractor: BASE_WIDTH,
  contractor: BASE_WIDTH + 1,
  discipline: BASE_WIDTH + 2,
  inspectionId: BASE_WIDTH + 3,
  equipmentTag: BASE_WIDTH + 4,
  issueId: BASE_WIDTH + 5,
  findingType: BASE_WIDTH + 6,
  dateObserved: BASE_WIDTH + 7,
  notes: BASE_WIDTH + 8,
  pipeSpec: BASE_WIDTH + 9,
  fluidCode: BASE_WIDTH + 10,
} as const

/** Adds made-up values for the new columns to QCx Combined fixture rows, repeating by row position so counts stay stable. */
export function withPlaceholderCombinedColumns(rows: InspectionRows): InspectionRows {
  return rows.map((row, position) => {
    const source = row[SOURCE]
    const isInspection = source === 'Electrical' || source === 'Mechanical'
    const isWeld = source === 'Welding'
    const isBim = source === 'BIM'
    const copy = [...row]
    if (isInspection) copy[STATUS] = STATUSES[position % STATUSES.length]
    return [
      ...copy,
      isInspection ? CONTRACTORS[position % CONTRACTORS.length] : null,
      isBim ? BIM_CONTRACTORS[position % BIM_CONTRACTORS.length] : null,
      isInspection || isBim ? DISCIPLINES[position % DISCIPLINES.length] : null,
      source === 'Electrical' ? `INS-${String(position + 1).padStart(4, '0')}` : null,
      isInspection ? `TAG-${String(position % 500).padStart(3, '0')}` : null,
      isInspection ? 90000 + position : null,
      isInspection ? FINDING_TYPES[position % FINDING_TYPES.length] : null,
      isInspection ? new Date(2026, position % 12, (position % 28) + 1) : null,
      isInspection ? NOTES[position % NOTES.length] : null,
      isWeld ? PIPE_SPECS[position % PIPE_SPECS.length] : null,
      isWeld ? FLUID_CODES[position % FLUID_CODES.length] : null,
    ]
  })
}
