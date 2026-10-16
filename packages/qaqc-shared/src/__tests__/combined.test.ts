import { describe, expect, it } from 'vitest'

import type { CombinedColumns } from '../types'
import { inspectionColumnsOf, issueColumnsOf, splitCombinedRows, weldColumnsOf } from '../combined'
import { buildIssueIndex, DEFAULT_CONTRACTOR, DEFAULT_TITLE } from '../issues'
import { buildWeldIndex, UNSPECIFIED_WELD_VALUE } from '../welds'

const COLUMNS: CombinedColumns = {
  source: 0,
  workWeek: 1,
  phase: 2,
  issue: 3,
  building: 4,
  qcr: 5,
  welder: 6,
  tagNo: 7,
  signature: 8,
  signedWeek: 9,
  id: 10,
  status: 11,
  type: 12,
  createdOn: 13,
  updatedOn: 14,
  createdBy: 15,
  greenTags: 16,
}
const TODAY = new Date(2026, 9, 15) // WW42'2026

describe('splitCombinedRows', () => {
  it('matches Source trimmed and case-insensitively', () => {
    const rows = [['Electrical'], [' MECHANICAL '], ['welding'], ['Bim'], ['\tElectrical\n']]
    const split = splitCombinedRows(rows, 0)
    expect(split.electrical).toEqual([rows[0], rows[4]])
    expect(split.mechanical).toEqual([rows[1]])
    expect(split.welding).toEqual([rows[2]])
    expect(split.bim).toEqual([rows[3]])
    expect(split.unknownSource).toBe(0)
  })

  it('counts an unrecognised Source as unknown and drops the row', () => {
    const rows = [['Civil'], ['Electrical'], ['BIM Issues']]
    const split = splitCombinedRows(rows, 0)
    expect(split.unknownSource).toBe(2)
    expect(split.electrical).toEqual([rows[1]])
    expect([...split.mechanical, ...split.welding, ...split.bim]).toEqual([])
  })

  it('counts blank and missing Source values as unknown', () => {
    const split = splitCombinedRows([[null], [''], ['   '], [undefined], []], 0)
    expect(split.unknownSource).toBe(5)
    expect([...split.electrical, ...split.mechanical, ...split.welding, ...split.bim]).toEqual([])
  })

  it('shares rows by reference instead of copying them', () => {
    const row = ['x', 'Welding']
    const split = splitCombinedRows([row], 1)
    expect(split.welding[0]).toBe(row)
  })

  it('returns empty splits for no rows', () => {
    const split = splitCombinedRows([], 0)
    expect(split).toEqual({ electrical: [], mechanical: [], welding: [], bim: [], unknownSource: 0 })
  })
})

describe('column mapping helpers', () => {
  it('maps the inspection columns', () => {
    expect(inspectionColumnsOf(COLUMNS)).toEqual({ workWeek: 1, phase: 2, issue: 3, building: 4 })
  })

  it('maps the weld columns, with Fluid Code and Pipe Spec absent', () => {
    expect(weldColumnsOf(COLUMNS)).toEqual({
      weldWeek: 1,
      signature: 8,
      signedWeek: 9,
      issue: 3,
      fluidCode: -1,
      pipeSpec: -1,
      tagNo: 7,
    })
  })

  it('maps the issue columns, with Title, Contractor and Due Date absent', () => {
    expect(issueColumnsOf(COLUMNS)).toEqual({
      id: 10,
      title: -1,
      status: 11,
      type: 12,
      contractor: -1,
      createdOn: 13,
      updatedOn: 14,
      dueDate: -1,
      createdBy: 15,
    })
  })
})

const ROLES: ReadonlyArray<keyof CombinedColumns> = [
  'source',
  'workWeek',
  'phase',
  'issue',
  'building',
  'qcr',
  'welder',
  'tagNo',
  'signature',
  'signedWeek',
  'id',
  'status',
  'type',
  'createdOn',
  'updatedOn',
  'createdBy',
  'greenTags',
]

function combinedRow(values: Partial<Record<keyof CombinedColumns, string>>): Array<string | null> {
  const row = new Array<string | null>(ROLES.length).fill(null)
  for (const role of ROLES) {
    const value = values[role]
    if (value !== undefined) row[COLUMNS[role]] = value
  }
  return row
}

describe('builders read absent columns (−1) as blank cells', () => {
  it('indexes Welding rows with every weld under the Unspecified system and spec', () => {
    const rows = [
      combinedRow({ source: 'Welding', workWeek: "WW41'2026", tagNo: 'BK1XX103XX-M008-B1.114006-200-0501-FW-01', signature: 'signed', signedWeek: "WW42'2026" }),
      combinedRow({ source: 'Welding', workWeek: "WW42'2026", issue: 'BIM #1019', tagNo: 'F631M008XX-P118-FW-01' }),
    ]
    const index = buildWeldIndex(rows, weldColumnsOf(COLUMNS), TODAY)
    expect(index.skippedRows).toBe(0)
    expect(index.cumulativeLogged[index.weeks.length - 1]).toBe(2)
    expect(index.cumulativeSigned[index.weeks.length - 1]).toBe(1)
    expect(index.cumulativeIssues[index.weeks.length - 1]).toBe(1)
    const systems = index.systemsByWeek.flatMap((byWeek) => [...byWeek.entries()])
    expect(systems.map(([system]) => system)).toEqual([UNSPECIFIED_WELD_VALUE, UNSPECIFIED_WELD_VALUE])
    expect(systems.flatMap(([, tally]) => [...tally.specs.keys()])).toEqual([UNSPECIFIED_WELD_VALUE, UNSPECIFIED_WELD_VALUE])
    const buildings = index.buildingsByWeek.flatMap((byWeek) => [...byWeek.keys()])
    expect(buildings).toEqual(['BK1', 'F631'])
  })

  it('indexes BIM rows with the default title and contractor and no due date', () => {
    const rows = [
      combinedRow({ source: 'BIM', id: '#1019', status: 'Open', type: 'NCR', createdOn: '7/27/2026', updatedOn: '7/27/2026', createdBy: 'LotusWorks' }),
      combinedRow({ source: 'BIM', id: '#1021', status: 'Open', type: 'COR', createdOn: '7/30/2026', createdBy: 'LotusWorks' }),
    ]
    const index = buildIssueIndex(rows, issueColumnsOf(COLUMNS), TODAY)
    expect(index.issues).toHaveLength(2)
    expect(index.issues.map((issue) => issue.title)).toEqual([DEFAULT_TITLE, DEFAULT_TITLE])
    expect(index.issues.map((issue) => issue.contractor).sort()).toEqual(['Bayside', DEFAULT_CONTRACTOR].sort())
    expect(index.issues.map((issue) => issue.dueDate)).toEqual([null, null])
    expect(index.issues.map((issue) => issue.subtype).sort()).toEqual(['COR', 'NCR'])
  })
})
