import { describe, expect, it } from 'vitest'

import { inspectionDrillColumns, weekIssueRows, type DrillColumn } from '../drilldown'
import { buildInspectionIndex } from '../inspections'
import type { InspectionOptionalColumns } from '../types'
import { INSPECTION_COLUMNS, PLACEHOLDER_OPTIONAL, UNBOUND_OPTIONAL } from './inspectionFilterFixture'

const FULL_ROW = [
  "WW23'2026", 'Final', 'Cable tray damaged', 'F63.1',
  'Greyfox', 'Supplier A', 'Electrical', 'Cable', 'Open',
  'INS-0007', 'TAG-100', 90123, 'Damage', new Date(2026, 5, 4), 'QCR A', 'Reinspect',
]

function labels(columns: readonly DrillColumn[]): string[] {
  return columns.map((column) => column.label)
}

function cell(columns: readonly DrillColumn[], label: string, row: readonly unknown[]): string {
  const column = columns.find((item) => item.label === label)
  if (column === undefined) throw new Error(`no column ${label}`)
  return column.read(row)
}

describe('inspectionDrillColumns', () => {
  it('lists the columns in the spec\'s order', () => {
    expect(labels(inspectionDrillColumns(INSPECTION_COLUMNS, PLACEHOLDER_OPTIONAL))).toEqual([
      'Building', 'Phase', 'Issue', 'Inspection ID', 'Equipment ID / Tag Number', 'Issue ID', 'Finding Type', 'Status', 'Date Observed', 'QCR/FE', 'Notes',
    ])
  })

  it('unbound columns are hidden; required slots alone still list Building, Phase and Issue', () => {
    expect(labels(inspectionDrillColumns(INSPECTION_COLUMNS, UNBOUND_OPTIONAL))).toEqual(['Building', 'Phase', 'Issue'])
    const onlyNotes: InspectionOptionalColumns = { ...UNBOUND_OPTIONAL, notes: 15 }
    expect(labels(inspectionDrillColumns(INSPECTION_COLUMNS, onlyNotes))).toEqual(['Building', 'Phase', 'Issue', 'Notes'])
  })

  it('marks only Issue and Notes as long', () => {
    const long = inspectionDrillColumns(INSPECTION_COLUMNS, PLACEHOLDER_OPTIONAL).filter((column) => column.isLong === true)
    expect(labels(long)).toEqual(['Issue', 'Notes'])
  })

  it('a Date Observed cell shows yyyy-mm-dd and a numeric Issue ID shows as text', () => {
    const columns = inspectionDrillColumns(INSPECTION_COLUMNS, PLACEHOLDER_OPTIONAL)
    expect(cell(columns, 'Date Observed', FULL_ROW)).toBe('2026-06-04')
    expect(cell(columns, 'Issue ID', FULL_ROW)).toBe('90123')
  })

  it('reads a Date Observed that arrives as a timestamp or a serial as yyyy-mm-dd, and blank or other text as it is', () => {
    const columns = inspectionDrillColumns(INSPECTION_COLUMNS, PLACEHOLDER_OPTIONAL)
    const withDate = (value: unknown): unknown[] => FULL_ROW.map((item, position) => (position === PLACEHOLDER_OPTIONAL.dateObserved ? value : item))
    expect(cell(columns, 'Date Observed', withDate('2026-06-04T12:00:00'))).toBe('2026-06-04')
    expect(cell(columns, 'Date Observed', withDate(46177))).toBe('2026-06-04')
    expect(cell(columns, 'Date Observed', withDate(null))).toBe('')
    expect(cell(columns, 'Date Observed', withDate('not yet'))).toBe('not yet')
  })

  it('shows a blank Building as the chart does', () => {
    const columns = inspectionDrillColumns(INSPECTION_COLUMNS, UNBOUND_OPTIONAL)
    expect(cell(columns, 'Building', ["WW23'2026", 'Final', 'NCR', null])).toBe('Unspecified')
  })

  it('shows the issue\'s cell text, and an unusable cell as blank', () => {
    const columns = inspectionDrillColumns(INSPECTION_COLUMNS, UNBOUND_OPTIONAL)
    expect(cell(columns, 'Issue', ["WW23'2026", 'Final', '  Cable tray damaged ', 'A'])).toBe('Cable tray damaged')
    expect(cell(columns, 'Issue', ["WW23'2026", 'Final', { nested: true }, 'A'])).toBe('')
  })
})

describe('weekIssueRows', () => {
  const ROWS = [
    ["WW40'2026", 'Final', 'NCR', 'A'],
    ["WW40'2026", 'Final', 'No Issue Found', 'B'],
    ["WW41'2026", 'Final', 'No Issue Found', 'C'],
    ["WW40'2026", 'Final', 'NCR', 'D'],
  ]
  const INDEX = buildInspectionIndex(ROWS, INSPECTION_COLUMNS, new Date(2026, 9, 15))

  it('reads the week\'s rows from the rows that built the index', () => {
    expect(weekIssueRows(INDEX, ROWS, 202640)).toEqual([ROWS[0], ROWS[3]])
  })

  it('is empty for a week with no issues and for a week the index does not have', () => {
    expect(weekIssueRows(INDEX, ROWS, 202641)).toEqual([])
    expect(weekIssueRows(INDEX, ROWS, 201001)).toEqual([])
  })
})
