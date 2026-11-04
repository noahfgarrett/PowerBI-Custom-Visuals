import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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
  rootCause: 16,
  greenTags: 17,
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

  it('maps the issue columns, with Title, Contractor, Due Date and Root Cause Category absent', () => {
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
      rootCause: 16,
      rootCauseCategory: -1,
      bim360CreatedBy: -1,
      bim360CreatedOn: -1,
      bim360ClosedOn: -1,
      closedAt: -1,
    })
  })

  it('maps the enrichment columns when the Overview binds them', () => {
    const columns = issueColumnsOf({ ...COLUMNS, bim360CreatedBy: 18, bim360CreatedOn: 19, bim360ClosedOn: 20, closedAt: 21 })
    expect([columns.bim360CreatedBy, columns.bim360CreatedOn, columns.bim360ClosedOn, columns.closedAt]).toEqual([18, 19, 20, 21])
  })

  it('leaves Root Cause unbound when the Overview has no Root Cause slot', () => {
    expect(issueColumnsOf({ ...COLUMNS, rootCause: -1 }).rootCause).toBe(-1)
  })
})

/** The combined columns every row carries; the optional enrichment columns are left out. */
type CombinedRole = Exclude<keyof CombinedColumns, 'bim360CreatedBy' | 'bim360CreatedOn' | 'bim360ClosedOn' | 'closedAt'>

const ROLES: ReadonlyArray<CombinedRole> = [
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
  'rootCause',
  'greenTags',
]

function combinedRow(values: Partial<Record<CombinedRole, string>>): Array<string | null> {
  const row = new Array<string | null>(ROLES.length).fill(null)
  for (const role of ROLES) {
    const value = values[role]
    if (value !== undefined) row[COLUMNS[role] ?? -1] = value
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

  it('indexes BIM rows with their Root Cause and no Root Cause Category', () => {
    const rows = [
      combinedRow({ source: 'BIM', id: '#1019', status: 'Open', createdOn: '7/27/2026', createdBy: 'LotusWorks', rootCause: ' Installation ' }),
      combinedRow({ source: 'BIM', id: '#1018', status: 'Open', createdOn: '7/24/2026', createdBy: 'LotusWorks' }),
    ]
    const index = buildIssueIndex(rows, issueColumnsOf(COLUMNS), TODAY)
    expect(index.hasRootCause).toBe(true)
    expect(index.hasRootCauseCategory).toBe(false)
    expect(index.issues.map((issue) => [issue.id, issue.rootCause, issue.rootCauseCategory])).toEqual([
      ['#1019', 'Installation', ''],
      ['#1018', '', ''],
    ])
  })
})

describe('BIM rows from the enriched Autodesk export', () => {
  // The combined columns with the four enrichment columns appended after Green tags.
  const BIM360_CREATED_BY = 18
  const BIM360_CREATED_ON = 19
  const BIM360_CLOSED_ON = 20
  const CLOSED_AT = 21
  const ENRICHED: CombinedColumns = {
    ...COLUMNS,
    bim360CreatedBy: BIM360_CREATED_BY,
    bim360CreatedOn: BIM360_CREATED_ON,
    bim360ClosedOn: BIM360_CLOSED_ON,
    closedAt: CLOSED_AT,
  }

  interface Legacy {
    createdBy: string
    createdOn: string
    closedOn: string
  }

  function bimRow(id: string, status: string, createdBy: string, legacy: Legacy | null, closedAt: string | null): Array<string | null> {
    const row = new Array<string | null>(CLOSED_AT + 1).fill(null)
    row[ENRICHED.source] = 'BIM'
    row[ENRICHED.id] = id
    row[ENRICHED.status] = status
    row[ENRICHED.type] = 'COR'
    // Autodesk's migration date on every migrated issue.
    row[ENRICHED.createdOn] = '7/27/2026'
    row[ENRICHED.updatedOn] = '7/27/2026'
    row[ENRICHED.createdBy] = createdBy
    row[BIM360_CREATED_BY] = legacy?.createdBy ?? null
    row[BIM360_CREATED_ON] = legacy?.createdOn ?? null
    row[BIM360_CLOSED_ON] = legacy?.closedOn ?? null
    row[CLOSED_AT] = closedAt
    return row
  }

  const rows = [
    bimRow('#1', 'Closed', 'Migration / Autodesk', { createdBy: 'LotusWorks', createdOn: '10/15/22 3:45 PM', closedOn: '11/2/22 9:10 AM' }, '7/27/2026'),
    bimRow('#2', 'Closed', 'Migration / Autodesk', { createdBy: 'Other', createdOn: '10/20/22 8:00 AM', closedOn: '11/3/22 1:00 PM' }, '7/27/2026'),
    bimRow('#3', 'Closed', 'LotusWorks', null, '10/6/2026'),
    bimRow('#4', 'Open', 'Other', null, null),
  ]
  const split = splitCombinedRows(rows, ENRICHED.source)
  const index = buildIssueIndex(split.bim, issueColumnsOf(ENRICHED), TODAY)

  it('includes migrated issues by their BIM360 creator and native ones by Created By', () => {
    expect(index.issues.map((issue) => issue.id).sort()).toEqual(['#1', '#3'])
    expect(index.excludedRows).toBe(2)
  })

  it('dates a migrated issue by its BIM360 dates, not the migration date', () => {
    const migrated = index.issues.find((issue) => issue.id === '#1')
    expect([migrated?.createdWeek.label, migrated?.closedWeek?.label]).toEqual(["WW41'2022", "WW44'2022"])
  })

  it('closes a native issue on its Closed At date', () => {
    expect(index.issues.find((issue) => issue.id === '#3')?.closedWeek?.label).toBe("WW41'2026")
  })
})

describe('weldColumnsOf with the new columns bound', () => {
  it('reads Pipe Spec and Fluid Code when they are bound', () => {
    const columns = weldColumnsOf({ ...COLUMNS, pipeSpec: 20, fluidCode: 21 })
    expect(columns.pipeSpec).toBe(20)
    expect(columns.fluidCode).toBe(21)
  })
})

describe('the QCx Combined script', () => {
  const REPO_ROOT = join(__dirname, '..', '..', '..', '..')
  const ORIGINAL_COLUMNS = [
    'Source',
    'Row ID',
    'Work Week',
    'Inspection Phase',
    'Issue',
    'Building',
    'QCR/FE',
    'Welder',
    'Tag No',
    'Signature',
    'Work Week Signed',
    'ID',
    'Status',
    'Type',
    'Created On',
    'Updated On',
    'Created By',
    'Root Cause',
    'BIM360 Created By',
    'BIM360 Created On',
    'BIM360 Closed On',
    'Closed At',
  ]
  const NEW_COLUMNS = [
    'General Contractor',
    'Contractor',
    'Trade Supplier',
    'Discipline',
    'Inspection Category',
    'Inspection ID',
    'Equipment ID / Tag Number',
    'Issue ID',
    'Finding Type',
    'Date Observed',
    'Notes',
    'Pipe Spec',
    'Fluid Code',
    'Work Package',
    'Title',
    'Due Date',
    'Created By (Company)',
  ]

  function readRepoFile(...parts: string[]): string {
    return readFileSync(join(REPO_ROOT, ...parts), 'utf8')
  }

  const script = readRepoFile('LotusWorks_Package', 'QCx_Combined.pq')

  function block(name: string): string {
    const start = script.indexOf(`    ${name} = `)
    if (start < 0) throw new Error(`step ${name} missing`)
    const nextStep = /\n    [A-Za-z]+ = |\nin\n/.exec(script.slice(start + 1))
    return nextStep === null ? script.slice(start) : script.slice(start, start + 1 + nextStep.index)
  }

  function resultColumns(): string[] {
    return [...block('Result').matchAll(/"([^"]+)"/g)].map((match) => match[1])
  }

  function setupGuideScript(folder: string): string {
    const guide = readRepoFile(folder, 'QCx_Combined_SETUP.md')
    const match = /```powerquery\n([\s\S]*?)```/.exec(guide)
    if (match === null) throw new Error(`${folder} guide has no script`)
    return match[1]
  }

  it('the first 22 Result columns are unchanged in order', () => {
    expect(resultColumns().slice(0, 22)).toEqual(ORIGINAL_COLUMNS)
  })

  it('each new column is listed after them, in Result and with a type', () => {
    expect(resultColumns().slice(22)).toEqual(NEW_COLUMNS)
    for (const column of NEW_COLUMNS) {
      expect(block('Typed')).toMatch(new RegExp(`\\{"${column.replace(/[()/]/g, '\\$&')}", type (text|date)\\}`))
    }
    expect(block('Typed')).toContain('{"Date Observed", type date}')
  })

  it('selects the new columns with MissingField.UseNull', () => {
    for (const step of ['ElectricalSelected', 'MechanicalSelected', 'WeldingSelected', 'BimSelected']) {
      expect(block(step)).toContain('MissingField.UseNull')
    }
    for (const column of ['General Contractor', 'Trade Supplier', 'Discipline', 'Inspection Category', 'Status', 'Equipment ID / Tag Number', 'Issue ID', 'Finding Type', 'Date Observed', 'Notes']) {
      expect(block('ElectricalSelected')).toContain(`"${column}"`)
      expect(block('MechanicalSelected')).toContain(`"${column}"`)
    }
    expect(block('ElectricalSelected')).toContain('"Inspection ID"')
    expect(block('MechanicalSelected')).not.toContain('"Inspection ID"')
    for (const column of ['Title', 'Contractor', 'Due date', 'Discipline', 'Created By (Company)']) {
      expect(block('BimSelected')).toContain(`"${column}"`)
    }
  })

  it('renames the Welding and export headers', () => {
    for (const [from, to] of [['PIPE SPEC', 'Pipe Spec'], ['FLUID CODE', 'Fluid Code'], ['WORK PKG', 'Work Package']]) {
      expect(block('WeldingSelected')).toContain(`"${from}"`)
      expect(block('WeldingRenamed')).toContain(`{"${from}", "${to}"}`)
    }
    expect(block('BimRenamed')).toContain('{"Due date", "Due Date"}')
  })

  it('all four copies are identical', () => {
    expect(readRepoFile('Business_Package', 'QCx_Combined.pq')).toBe(script)
    expect(setupGuideScript('LotusWorks_Package')).toBe(script)
    expect(setupGuideScript('Business_Package')).toBe(script)
  })

  it('both guides state the new column count', () => {
    for (const folder of ['LotusWorks_Package', 'Business_Package']) {
      expect(readRepoFile(folder, 'QCx_Combined_SETUP.md')).toContain('It should show 39 columns')
    }
  })
})
