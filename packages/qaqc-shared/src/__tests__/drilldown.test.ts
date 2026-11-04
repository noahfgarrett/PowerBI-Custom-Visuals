import { describe, expect, it } from 'vitest'

import { splitCombinedRows } from '../combined'
import { inspectionDrillColumns, issueDrillColumns, overviewDrillGroups, weekIssueRows, weekRows, weldDrillColumns, type DrillColumn, type DrillGroup } from '../drilldown'
import { buildInspectionIndex } from '../inspections'
import { buildIssueIndex } from '../issues'
import { buildOverviewIndex, buildOverviewSeries, filterOverviewIndex, overviewFilterFields, overviewFilterRows, overviewWeekNcrs, type OverviewFilterSource } from '../overview'
import { buildFilterCatalog, matchRows } from '../rowFilters'
import type { InspectionOptionalColumns, IssueColumns } from '../types'
import { INSPECTION_COLUMNS, PLACEHOLDER_OPTIONAL, UNBOUND_OPTIONAL } from './inspectionFilterFixture'
import { FILTER_COLUMNS, withValues } from './overviewFilterFixture'
import { bim, COLUMNS, inspection, TODAY, weld } from './overviewRows'
import { PLACEHOLDER_WELD_OPTIONAL, UNBOUND_WELD_OPTIONAL, WELD_COLUMNS } from './weldFilterFixture'

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

describe('weldDrillColumns', () => {
  const WELD_ROW = ["WW40'2026", 'signed', "WW41'2026", 'BIM 1234', ' AW ', 'PCH', 'F631M001XX-P001-FW-01', 'P-012, PF-025', 'WP-100']

  it('lists the columns in the spec\'s order', () => {
    expect(labels(weldDrillColumns(WELD_COLUMNS, PLACEHOLDER_WELD_OPTIONAL))).toEqual([
      'Tag No', 'Welder', 'Pipe Spec', 'Fluid Code', 'Issue Created', 'Signature',
    ])
  })

  it('hides Welder when it is unbound', () => {
    expect(labels(weldDrillColumns(WELD_COLUMNS, UNBOUND_WELD_OPTIONAL))).toEqual([
      'Tag No', 'Pipe Spec', 'Fluid Code', 'Issue Created', 'Signature',
    ])
  })

  it('reads every column from its slot', () => {
    const columns = weldDrillColumns(WELD_COLUMNS, PLACEHOLDER_WELD_OPTIONAL)
    expect(columns.map((column) => column.read(WELD_ROW))).toEqual([
      'F631M001XX-P001-FW-01', 'P-012, PF-025', 'PCH', 'AW', 'BIM 1234', 'signed',
    ])
  })

  it('labels a blank Pipe Spec and Fluid Code as the charts do', () => {
    const columns = weldDrillColumns(WELD_COLUMNS, UNBOUND_WELD_OPTIONAL)
    const row = ["WW40'2026", null, null, 'BIM 1', null, '', 'F631M001XX-P001-FW-01']
    expect(cell(columns, 'Pipe Spec', row)).toBe('Unspecified')
    expect(cell(columns, 'Fluid Code', row)).toBe('Unspecified')
    expect(cell(columns, 'Signature', row)).toBe('')
  })

  it('lets only Issue Created flex, so the short columns are not stretched', () => {
    const columns = weldDrillColumns(WELD_COLUMNS, PLACEHOLDER_WELD_OPTIONAL)
    expect(columns.filter((column) => column.isLong === true).map((column) => column.label)).toEqual(['Issue Created'])
  })
})

describe('weldDrillColumns widths', () => {
  it('marks the code columns, so a tag number shows in full when there is room', () => {
    const columns = weldDrillColumns(WELD_COLUMNS, PLACEHOLDER_WELD_OPTIONAL)
    expect(columns.filter((column) => column.isCode === true).map((column) => column.label)).toEqual(['Tag No', 'Welder', 'Pipe Spec', 'Fluid Code'])
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

describe('issueDrillColumns', () => {
  const COLUMNS: IssueColumns = {
    id: 0, title: 1, status: 2, type: 3, contractor: 4, createdOn: 5, updatedOn: 6, dueDate: 7, createdBy: 8, rootCause: -1, rootCauseCategory: -1,
  }
  const TODAY = new Date(2026, 9, 15)
  const columns = issueDrillColumns(COLUMNS)
  const OPEN = ['#1021', 'Grout', 'Pending', null, null, '10/5/2026', null, '10/20/2026', 'LotusWorks']
  const CLOSED = ['#7', 'Bolts', 'Closed', 'NCR', 'Greyfox', '9/30/2026', '10/6/2026', null, 'LotusWorks']

  it('lists Issue Detail\'s columns in its order, and only Title flexes', () => {
    expect(labels(columns)).toEqual(['ID', 'Subtype', 'Status', 'Title', 'Contractor', 'Work Week', 'Created On', 'Work Week Closed', 'Due Date'])
    expect(labels(columns.filter((column) => column.isLong === true))).toEqual(['Title'])
  })

  it('a row reads exactly as its Issue Detail row does', () => {
    const index = buildIssueIndex([OPEN, CLOSED], COLUMNS, TODAY)
    for (const row of [OPEN, CLOSED]) {
      const detail = index.issues.find((issue) => issue.id === row[0])?.detail
      if (detail === undefined) throw new Error('no issue')
      expect(columns.map((column) => column.read(row))).toEqual([
        detail.id, detail.subtype, detail.status, detail.title, detail.contractor, detail.workWeek, detail.createdOn, detail.workWeekClosed, detail.dueDate,
      ])
    }
  })

  it('shows Pending as Open, a blank Type as Uncategorized and the ID 1021 contractor default, as Issue Detail does', () => {
    expect(cell(columns, 'Status', OPEN)).toBe('Open')
    expect(cell(columns, 'Subtype', OPEN)).toBe('Uncategorized')
    expect(cell(columns, 'Contractor', OPEN)).toBe('Bayside')
  })

  it('sorts weeks and dates by time, newest first, and a blank last', () => {
    const closedWeek = columns.find((column) => column.key === 'workWeekClosed')
    expect(closedWeek?.firstDirection).toBe('descending')
    expect(closedWeek?.sortNumber?.(CLOSED)).toBe(202641)
    expect(closedWeek?.sortNumber?.(OPEN)).toBeNull()
  })

  it('reads a void or undated row as blank instead of throwing', () => {
    const voided = ['#2', 'Gone', 'Void', 'COR', 'Bayside', '10/5/2026', null, null, 'LotusWorks']
    const undated = ['#3', 'Soon', 'Open', 'COR', 'Bayside', null, null, null, 'LotusWorks']
    expect(cell(columns, 'ID', voided)).toBe('')
    expect(cell(columns, 'ID', undated)).toBe('')
  })
})

describe('weekRows', () => {
  it('reads only that week\'s positions, and nothing for a week not on the axis', () => {
    const rows = [['a'], ['b'], ['c']]
    const positions = new Map([[202641, 0], [202642, 1]])
    expect(weekRows(positions, [[2, 0], []], rows, 202641)).toEqual([['c'], ['a']])
    expect(weekRows(positions, [[2, 0], []], rows, 202642)).toEqual([])
    expect(weekRows(positions, [[2, 0], []], rows, 202650)).toEqual([])
  })
})

describe('overviewDrillGroups', () => {
  const WW40 = "WW40'2026"
  const KEY = 202640
  const TAG = 'F631M008XX-1'
  const ROWS: unknown[][] = [
    withValues(inspection('Electrical', WW40, 'Final', 'Cable damaged'), { generalContractor: 'Greyfox', building: 'F63.1' }),
    withValues(inspection('Electrical', WW40, 'Final', 'Tray bent'), { generalContractor: 'Bayside', building: 'F63.1' }),
    withValues(inspection('Electrical', WW40, 'Final'), { generalContractor: 'Bayside', building: 'F63.1' }),
    withValues(inspection('Mechanical', WW40, 'Final', 'Valve leak'), { generalContractor: 'Bayside', building: 'F63.2' }),
    withValues(weld(WW40, { issue: 'BIM 12' }), { tagNo: TAG }),
    withValues(weld(WW40), { tagNo: TAG }),
    withValues(bim('#1', '9/29/2026', { type: 'NCR' }), { contractor: 'Bayside' }),
  ]

  function listed(groups: readonly DrillGroup[]): Array<[string | null, number]> {
    return groups.map((group) => [group.title, group.rows.length])
  }

  function chartNcrs(index: ReturnType<typeof buildOverviewIndex>): number {
    const view = { selectedKey: KEY, windowEndKey: KEY, range: 'all', dateRange: null } as const
    const point = buildOverviewSeries(index, view).rates.find((item) => item.week.key === KEY)
    if (point === undefined) throw new Error('no chart point')
    return point.inspection.ncrs + point.welding.ncrs
  }

  it('a week\'s list equals that week\'s Electrical, Mechanical and Welding NCR counts, labelled by source; BIM rows aren\'t listed', () => {
    const split = splitCombinedRows(ROWS, FILTER_COLUMNS.source)
    const index = buildOverviewIndex(split, FILTER_COLUMNS, TODAY)
    const groups = overviewDrillGroups(index, split, FILTER_COLUMNS, KEY)
    expect(listed(groups)).toEqual([['Electrical', 2], ['Mechanical', 1], ['Welding', 1]])
    expect(groups.flatMap((group) => group.rows).some((row) => row[FILTER_COLUMNS.source] === 'BIM')).toBe(false)
    expect(chartNcrs(index)).toBe(4)
    expect(overviewWeekNcrs(index, KEY)).toBe(4)
  })

  it('the same under filters', () => {
    const split = splitCombinedRows(ROWS, FILTER_COLUMNS.source)
    const base = buildOverviewIndex(split, FILTER_COLUMNS, TODAY)
    const filterRows = overviewFilterRows(split, FILTER_COLUMNS)
    const catalog = buildFilterCatalog(filterRows, overviewFilterFields(FILTER_COLUMNS))
    const selection = new Map([['contractor', new Set(['greyfox'])]])
    const { index, split: filteredSplit } = filterOverviewIndex(base, split, matchRows(filterRows, catalog, selection), FILTER_COLUMNS)
    const groups = overviewDrillGroups(index, filteredSplit, FILTER_COLUMNS, KEY)
    // Welding isn't filtered by Contractor, so its row stays, read from the index that was reused.
    expect(listed(groups)).toEqual([['Electrical', 1], ['Welding', 1]])
    expect(groups[0].rows[0][FILTER_COLUMNS.issue]).toBe('Cable damaged')
    expect(groups[1].rows[0][FILTER_COLUMNS.issue]).toBe('BIM 12')
    expect(chartNcrs(index)).toBe(2)
    expect(overviewWeekNcrs(index, KEY)).toBe(2)
  })

  it('omits an empty group, and has none in a week with no NCRs', () => {
    const rows = [inspection('Mechanical', WW40, 'Final', 'Valve leak'), inspection('Mechanical', "WW41'2026", 'Final')]
    const split = splitCombinedRows(rows, COLUMNS.source)
    const index = buildOverviewIndex(split, COLUMNS, TODAY)
    expect(listed(overviewDrillGroups(index, split, COLUMNS, KEY))).toEqual([['Mechanical', 1]])
    expect(overviewDrillGroups(index, split, COLUMNS, 202641)).toEqual([])
    expect(overviewWeekNcrs(index, 202641)).toBe(0)
  })

  it('has no rows for a week before a source starts', () => {
    const rows = [inspection('Mechanical', WW40, 'Final', 'Valve leak')]
    const split = splitCombinedRows(rows, COLUMNS.source)
    const index = buildOverviewIndex(split, COLUMNS, TODAY)
    expect(overviewDrillGroups(index, split, COLUMNS, 202601)).toEqual([])
    expect(overviewWeekNcrs(index, 202601)).toBe(0)
  })

  it('hides each column whose slot is unbound', () => {
    const split = splitCombinedRows(ROWS, COLUMNS.source)
    const index = buildOverviewIndex(split, COLUMNS, TODAY)
    const unbound: OverviewFilterSource['columns'] = { ...COLUMNS, tagNo: -1 }
    const groups = overviewDrillGroups(index, split, unbound, KEY)
    expect(labels(groups[0].columns)).toEqual(['Building', 'Phase', 'Issue', 'Status'])
    expect(labels(groups[2].columns)).toEqual(['Issue Created', 'Signature'])
  })

  it('lists the bound columns for each source', () => {
    const split = splitCombinedRows(ROWS, FILTER_COLUMNS.source)
    const index = buildOverviewIndex(split, FILTER_COLUMNS, TODAY)
    const groups = overviewDrillGroups(index, split, FILTER_COLUMNS, KEY)
    expect(labels(groups[0].columns)).toEqual(['Building', 'Phase', 'Issue', 'Inspection ID', 'Equipment ID / Tag Number', 'Issue ID', 'Finding Type', 'Status', 'Date Observed', 'QCR/FE', 'Notes'])
    expect(labels(groups[2].columns)).toEqual(['Tag No', 'Welder', 'Pipe Spec', 'Fluid Code', 'Issue Created', 'Signature'])
  })
})
