import { describe, expect, it } from 'vitest'

import {
  ISSUE_SLOTS,
  OVERVIEW_SLOTS,
  PERFORMANCE_SLOTS,
  readCombinedTable,
  readGreenTags,
  readInspectionTable,
  readIssueTable,
  readWeldTable,
  type InspectionTableSource,
} from '../dataView'

type SlotRole = 'workWeek' | 'phase' | 'issue' | 'building' | 'rowId'
const ALL_ROLES: SlotRole[] = ['workWeek', 'phase', 'issue', 'building', 'rowId']

function table(rows: ReadonlyArray<ReadonlyArray<string | null>>, roles: SlotRole[] = ALL_ROLES): InspectionTableSource {
  return {
    columns: roles.map((role) => ({ roles: { [role]: true } })),
    rows: rows.map((row, rowIndex) => roles.map((role) => (role === 'rowId' ? rowIndex + 1 : row[ALL_ROLES.indexOf(role)] ?? ''))),
  }
}

const ROW = ["WW42'2026", 'Final', 'No Issue Found', 'F63.2']

describe('readInspectionTable', () => {
  it('reports every required slot when there is no data view', () => {
    const result = readInspectionTable(undefined)
    expect(result.kind).toBe('missing')
    if (result.kind === 'missing') expect(result.missing.map((slot) => slot.slot)).toEqual(['Work Week', 'Inspection Phase', 'Issue?', 'Building', 'Row ID'])
  })

  it('names only the slots that are still empty', () => {
    const result = readInspectionTable(table([ROW], ['workWeek', 'phase']))
    expect(result.kind).toBe('missing')
    if (result.kind === 'missing') expect(result.missing.map((slot) => slot.column)).toEqual(['Issue?', 'Building', 'Index'])
  })

  it('finds column positions by role regardless of order', () => {
    const result = readInspectionTable(table([ROW], ['building', 'issue', 'rowId', 'phase', 'workWeek']))
    expect(result.kind).toBe('ready')
    if (result.kind === 'ready') {
      expect(result.columns).toEqual({ workWeek: 4, phase: 3, issue: 1, building: 0 })
      expect(result.rows[0][result.columns.workWeek]).toBe("WW42'2026")
    }
  })

  it('requires the Row ID slot', () => {
    const result = readInspectionTable(table([ROW], ['workWeek', 'phase', 'issue', 'building']))
    expect(result.kind).toBe('missing')
    if (result.kind === 'missing') expect(result.missing.map((slot) => slot.column)).toEqual(['Index'])
  })
})

type WeldRole = 'weldWeek' | 'signature' | 'signedWeek' | 'issue' | 'fluidCode' | 'pipeSpec' | 'tagNo' | 'rowId'
const ALL_WELD_ROLES: WeldRole[] = ['weldWeek', 'signature', 'signedWeek', 'issue', 'fluidCode', 'pipeSpec', 'tagNo', 'rowId']

function weldTable(rows: ReadonlyArray<ReadonlyArray<string | null>>, roles: WeldRole[] = ALL_WELD_ROLES): InspectionTableSource {
  return {
    columns: roles.map((role) => ({ roles: { [role]: true } })),
    rows: rows.map((row, rowIndex) => roles.map((role) => (role === 'rowId' ? rowIndex + 1 : row[ALL_WELD_ROLES.indexOf(role)] ?? ''))),
  }
}

const WELD_ROW = ["WW41'2026", 'signed', "WW42'2026", null, 'AW', 'PCH', 'BK1XX103XX-M008-B1.114006-200-0501-FW-01']

describe('readWeldTable', () => {
  it('reports every required slot when there is no data view', () => {
    const result = readWeldTable(undefined)
    expect(result.kind).toBe('missing')
    if (result.kind === 'missing') {
      expect(result.missing.map((slot) => slot.slot)).toEqual([
        'Weld Work Week',
        'Signature',
        'Work Week Signed',
        'Issue Created',
        'Fluid Code',
        'Pipe Spec',
        'Tag No',
        'Row ID',
      ])
    }
  })

  it('names only the slots that are still empty', () => {
    const result = readWeldTable(weldTable([WELD_ROW], ['weldWeek', 'signature', 'signedWeek', 'issue']))
    expect(result.kind).toBe('missing')
    if (result.kind === 'missing') expect(result.missing.map((slot) => slot.column)).toEqual(['FLUID CODE', 'PIPE SPEC', 'TAG NO', 'Index'])
  })

  it('finds column positions by role regardless of order', () => {
    const result = readWeldTable(weldTable([WELD_ROW], ['tagNo', 'rowId', 'pipeSpec', 'fluidCode', 'issue', 'signedWeek', 'signature', 'weldWeek']))
    expect(result.kind).toBe('ready')
    if (result.kind === 'ready') {
      expect(result.columns).toEqual({ weldWeek: 7, signature: 6, signedWeek: 5, issue: 4, fluidCode: 3, pipeSpec: 2, tagNo: 0 })
      expect(result.rows[0][result.columns.tagNo]).toBe(WELD_ROW[6])
    }
  })

  it('requires the Row ID slot', () => {
    const result = readWeldTable(weldTable([WELD_ROW], ALL_WELD_ROLES.filter((role) => role !== 'rowId')))
    expect(result.kind).toBe('missing')
    if (result.kind === 'missing') expect(result.missing.map((slot) => slot.column)).toEqual(['Index'])
  })

  it('treats a table without rows as ready and empty', () => {
    const result = readWeldTable({ columns: ALL_WELD_ROLES.map((role) => ({ roles: { [role]: true } })) })
    expect(result.kind).toBe('ready')
    if (result.kind === 'ready') expect(result.rows).toEqual([])
  })
})

type IssueRole =
  | 'id'
  | 'title'
  | 'status'
  | 'type'
  | 'contractor'
  | 'createdOn'
  | 'updatedOn'
  | 'dueDate'
  | 'createdBy'
  | 'rootCause'
  | 'rootCauseCategory'
  | 'bim360CreatedBy'
  | 'bim360CreatedOn'
  | 'bim360ClosedOn'
  | 'closedAt'
const REQUIRED_ISSUE_ROLES: IssueRole[] = ['id', 'title', 'status', 'type', 'contractor', 'createdOn', 'updatedOn', 'dueDate', 'createdBy']
const ALL_ISSUE_ROLES: IssueRole[] = [...REQUIRED_ISSUE_ROLES, 'rootCause', 'rootCauseCategory']
const ENRICHMENT_ISSUE_ROLES: IssueRole[] = ['bim360CreatedBy', 'bim360CreatedOn', 'bim360ClosedOn', 'closedAt']
/** Each ISSUE_ROW cell's role. */
const ISSUE_ROW_ROLES: IssueRole[] = [...ALL_ISSUE_ROLES, ...ENRICHMENT_ISSUE_ROLES]

function issueTable(rows: ReadonlyArray<ReadonlyArray<unknown>>, roles: IssueRole[] = ALL_ISSUE_ROLES): InspectionTableSource {
  return {
    columns: roles.map((role) => ({ roles: { [role]: true } })),
    rows: rows.map((row) => roles.map((role) => row[ISSUE_ROW_ROLES.indexOf(role)])),
  }
}

const ISSUE_ROW = [
  '#1020',
  'WR1 - GF PVC Protection Deficiency',
  'Ready to Inspect',
  'COR',
  'Bayside',
  '7/27/2026',
  '7/27/2026',
  '8/14/2026',
  'LotusWorks',
  'Installation',
  'Quality',
  'LotusWorks',
  '7/24/26 4:27 PM',
  '7/27/26 5:10 PM',
  null,
]

describe('ISSUE_SLOTS', () => {
  it('follows the required slots with the optional Root Cause slots, then the optional enrichment slots', () => {
    expect(ISSUE_SLOTS.map((slot) => [slot.role, slot.slot, slot.column])).toEqual([
      ['id', 'ID', 'ID'],
      ['title', 'Title', 'Title'],
      ['status', 'Status', 'Status'],
      ['type', 'Type', 'Type'],
      ['contractor', 'Contractor', 'Contractor'],
      ['createdOn', 'Created On', 'Created On'],
      ['updatedOn', 'Updated On', 'Updated On'],
      ['dueDate', 'Due Date', 'Due Date'],
      ['createdBy', 'Created By', 'Created By'],
      ['rootCause', 'Root Cause', 'Root Cause'],
      ['rootCauseCategory', 'Root Cause Category', 'Root Cause Category'],
      ['bim360CreatedBy', 'BIM360 Created By', 'BIM360_Created By'],
      ['bim360CreatedOn', 'BIM360 Created On', 'BIM360_Created On'],
      ['bim360ClosedOn', 'BIM360 Closed On', 'BIM360_Closed On'],
      ['closedAt', 'Closed At', 'Closed at'],
    ])
  })
})

describe('readIssueTable', () => {
  it('reports every required slot when there is no data view', () => {
    const result = readIssueTable(undefined)
    expect(result.kind).toBe('missing')
    if (result.kind === 'missing') {
      expect(result.missing.map((slot) => slot.slot)).toEqual([
        'ID',
        'Title',
        'Status',
        'Type',
        'Contractor',
        'Created On',
        'Updated On',
        'Due Date',
        'Created By',
      ])
    }
  })

  it('names only the slots that are still empty', () => {
    const result = readIssueTable(issueTable([ISSUE_ROW], ['id', 'title', 'status', 'type', 'contractor', 'createdOn']))
    expect(result.kind).toBe('missing')
    if (result.kind === 'missing') expect(result.missing.map((slot) => slot.column)).toEqual(['Updated On', 'Due Date', 'Created By'])
  })

  it('requires the Created By slot on its own', () => {
    const result = readIssueTable(issueTable([ISSUE_ROW], REQUIRED_ISSUE_ROLES.filter((role) => role !== 'createdBy')))
    expect(result.kind).toBe('missing')
    if (result.kind === 'missing') expect(result.missing.map((slot) => slot.role)).toEqual(['createdBy'])
  })

  it('finds column positions by role regardless of order', () => {
    const result = readIssueTable(issueTable([ISSUE_ROW], [...ALL_ISSUE_ROLES].reverse()))
    expect(result.kind).toBe('ready')
    if (result.kind === 'ready') {
      expect(result.columns).toEqual({
        id: 10,
        title: 9,
        status: 8,
        type: 7,
        contractor: 6,
        createdOn: 5,
        updatedOn: 4,
        dueDate: 3,
        createdBy: 2,
        rootCause: 1,
        rootCauseCategory: 0,
        bim360CreatedBy: -1,
        bim360CreatedOn: -1,
        bim360ClosedOn: -1,
        closedAt: -1,
      })
      expect(result.rows[0][result.columns.id]).toBe('#1020')
      expect(result.rows[0][result.columns.rootCause]).toBe('Installation')
    }
  })

  it('is ready without the optional Root Cause slots and reports them at −1', () => {
    const result = readIssueTable(issueTable([ISSUE_ROW], REQUIRED_ISSUE_ROLES))
    expect(result.kind).toBe('ready')
    if (result.kind === 'ready') {
      expect(result.columns.rootCause).toBe(-1)
      expect(result.columns.rootCauseCategory).toBe(-1)
    }
  })

  it('never names the optional Root Cause slots as missing', () => {
    const result = readIssueTable(issueTable([ISSUE_ROW], ['id', 'title']))
    expect(result.kind).toBe('missing')
    if (result.kind === 'missing') {
      expect(result.missing.map((slot) => slot.role)).toEqual(['status', 'type', 'contractor', 'createdOn', 'updatedOn', 'dueDate', 'createdBy'])
    }
  })

  it('reads the enrichment slots when they are bound', () => {
    const result = readIssueTable(issueTable([ISSUE_ROW], [...REQUIRED_ISSUE_ROLES, ...ENRICHMENT_ISSUE_ROLES]))
    expect(result.kind).toBe('ready')
    if (result.kind === 'ready') {
      expect([result.columns.bim360CreatedBy, result.columns.bim360CreatedOn, result.columns.bim360ClosedOn, result.columns.closedAt])
        .toEqual([9, 10, 11, 12])
      expect(result.rows[0][result.columns.bim360CreatedOn ?? -1]).toBe('7/24/26 4:27 PM')
    }
  })

  it('never names the enrichment slots as missing', () => {
    const result = readIssueTable(issueTable([ISSUE_ROW], REQUIRED_ISSUE_ROLES.filter((role) => role !== 'id')))
    expect(result.kind).toBe('missing')
    if (result.kind === 'missing') expect(result.missing.map((slot) => slot.role)).toEqual(['id'])
  })

  it('reads Root Cause without Root Cause Category', () => {
    const result = readIssueTable(issueTable([ISSUE_ROW], [...REQUIRED_ISSUE_ROLES, 'rootCause']))
    expect(result.kind).toBe('ready')
    if (result.kind === 'ready') {
      expect(result.columns.rootCause).toBe(9)
      expect(result.columns.rootCauseCategory).toBe(-1)
    }
  })

  it('passes date cells through unchanged when Power BI delivers Date objects', () => {
    const createdOn = new Date(2026, 6, 27)
    const result = readIssueTable(issueTable([[...ISSUE_ROW.slice(0, 5), createdOn, ...ISSUE_ROW.slice(6)]]))
    expect(result.kind).toBe('ready')
    if (result.kind === 'ready') expect(result.rows[0][result.columns.createdOn]).toBe(createdOn)
  })

  it('treats a table without rows as ready and empty', () => {
    const result = readIssueTable({ columns: ALL_ISSUE_ROLES.map((role) => ({ roles: { [role]: true } })) })
    expect(result.kind).toBe('ready')
    if (result.kind === 'ready') expect(result.rows).toEqual([])
  })
})

type CombinedRole =
  | 'source'
  | 'rowId'
  | 'workWeek'
  | 'phase'
  | 'issue'
  | 'building'
  | 'qcr'
  | 'welder'
  | 'tagNo'
  | 'signature'
  | 'signedWeek'
  | 'id'
  | 'status'
  | 'type'
  | 'createdOn'
  | 'updatedOn'
  | 'createdBy'
  | 'rootCause'
  | 'bim360CreatedBy'
  | 'bim360CreatedOn'
  | 'bim360ClosedOn'
  | 'closedAt'
  | 'greenTags'

const OVERVIEW_ROLES: CombinedRole[] = [
  'source',
  'rowId',
  'workWeek',
  'phase',
  'issue',
  'building',
  'signature',
  'signedWeek',
  'id',
  'status',
  'type',
  'createdOn',
  'updatedOn',
  'createdBy',
  'rootCause',
  'bim360CreatedBy',
  'bim360CreatedOn',
  'bim360ClosedOn',
  'closedAt',
  'greenTags',
]
const OPTIONAL_OVERVIEW_ROLES: CombinedRole[] = ['rootCause', 'bim360CreatedBy', 'bim360CreatedOn', 'bim360ClosedOn', 'closedAt', 'greenTags']
const PERFORMANCE_ROLES: CombinedRole[] = ['source', 'rowId', 'workWeek', 'phase', 'issue', 'building', 'qcr', 'welder', 'tagNo']

function combinedTable(roles: CombinedRole[]): InspectionTableSource {
  return {
    columns: roles.map((role) => ({ roles: { [role]: true } })),
    rows: [roles.map((role) => role)],
  }
}

describe('OVERVIEW_SLOTS and PERFORMANCE_SLOTS', () => {
  it('lists the Overview slots from the spec in order, with their Smartsheet columns', () => {
    expect(OVERVIEW_SLOTS.map((slot) => [slot.role, slot.slot, slot.column])).toEqual([
      ['source', 'Source', 'Source'],
      ['rowId', 'Row ID', 'Row ID'],
      ['workWeek', 'Work Week', 'Work Week'],
      ['phase', 'Inspection Phase', 'Inspection Phase'],
      ['issue', 'Issue', 'Issue'],
      ['building', 'Building', 'Building'],
      ['signature', 'Signature', 'Signature'],
      ['signedWeek', 'Work Week Signed', 'Work Week Signed'],
      ['id', 'ID', 'ID'],
      ['status', 'Status', 'Status'],
      ['type', 'Type', 'Type'],
      ['createdOn', 'Created On', 'Created On'],
      ['updatedOn', 'Updated On', 'Updated On'],
      ['createdBy', 'Created By', 'Created By'],
      ['rootCause', 'Root Cause', 'Root Cause'],
      ['bim360CreatedBy', 'BIM360 Created By', 'BIM360 Created By'],
      ['bim360CreatedOn', 'BIM360 Created On', 'BIM360 Created On'],
      ['bim360ClosedOn', 'BIM360 Closed On', 'BIM360 Closed On'],
      ['closedAt', 'Closed At', 'Closed At'],
      ['greenTags', 'Green tags', 'Green tags measure'],
    ])
  })

  it('lists the Performance slots from the spec in order, with their Smartsheet columns', () => {
    expect(PERFORMANCE_SLOTS.map((slot) => [slot.role, slot.slot, slot.column])).toEqual([
      ['source', 'Source', 'Source'],
      ['rowId', 'Row ID', 'Row ID'],
      ['workWeek', 'Work Week', 'Work Week'],
      ['phase', 'Inspection Phase', 'Inspection Phase'],
      ['issue', 'Issue', 'Issue'],
      ['building', 'Building', 'Building'],
      ['qcr', 'QCR/FE', 'QCR/FE'],
      ['welder', 'Welder', 'Welder'],
      ['tagNo', 'Tag No', 'Tag No'],
    ])
  })
})

describe('readCombinedTable', () => {
  it('reports every required Overview slot, but not Root Cause, the enrichment slots or Green tags, when there is no data view', () => {
    const result = readCombinedTable(undefined, OVERVIEW_SLOTS)
    expect(result.kind).toBe('missing')
    if (result.kind === 'missing') {
      expect(result.missing.map((slot) => slot.role)).toEqual(OVERVIEW_ROLES.filter((role) => !OPTIONAL_OVERVIEW_ROLES.includes(role)))
    }
  })

  it('reports every Performance slot when there is no data view', () => {
    const result = readCombinedTable(undefined, PERFORMANCE_SLOTS)
    expect(result.kind).toBe('missing')
    if (result.kind === 'missing') expect(result.missing.map((slot) => slot.role)).toEqual(PERFORMANCE_ROLES)
  })

  it('names only the Overview slots that are still empty', () => {
    const result = readCombinedTable(combinedTable(['source', 'rowId', 'workWeek', 'phase', 'issue', 'building', 'id']), OVERVIEW_SLOTS)
    expect(result.kind).toBe('missing')
    if (result.kind === 'missing') {
      expect(result.missing.map((slot) => slot.column)).toEqual([
        'Signature',
        'Work Week Signed',
        'Status',
        'Type',
        'Created On',
        'Updated On',
        'Created By',
      ])
    }
  })

  it('names only the Performance slots that are still empty', () => {
    const result = readCombinedTable(combinedTable(['source', 'workWeek', 'phase', 'issue', 'building', 'qcr']), PERFORMANCE_SLOTS)
    expect(result.kind).toBe('missing')
    if (result.kind === 'missing') expect(result.missing.map((slot) => slot.column)).toEqual(['Row ID', 'Welder', 'Tag No'])
  })

  it('reads every Overview position when all slots are bound, leaving the Performance roles at −1', () => {
    const result = readCombinedTable(combinedTable([...OVERVIEW_ROLES].reverse()), OVERVIEW_SLOTS)
    expect(result.kind).toBe('ready')
    if (result.kind === 'ready') {
      expect(result.columns).toEqual({
        source: 19,
        workWeek: 17,
        phase: 16,
        issue: 15,
        building: 14,
        qcr: -1,
        welder: -1,
        tagNo: -1,
        signature: 13,
        signedWeek: 12,
        id: 11,
        status: 10,
        type: 9,
        createdOn: 8,
        updatedOn: 7,
        createdBy: 6,
        rootCause: 5,
        bim360CreatedBy: 4,
        bim360CreatedOn: 3,
        bim360ClosedOn: 2,
        closedAt: 1,
        greenTags: 0,
      })
      expect(result.rows[0][result.columns.source]).toBe('source')
    }
  })

  it('reads every Performance position when all slots are bound, leaving the Overview roles at −1', () => {
    const result = readCombinedTable(combinedTable(PERFORMANCE_ROLES), PERFORMANCE_SLOTS)
    expect(result.kind).toBe('ready')
    if (result.kind === 'ready') {
      expect(result.columns).toEqual({
        source: 0,
        workWeek: 2,
        phase: 3,
        issue: 4,
        building: 5,
        qcr: 6,
        welder: 7,
        tagNo: 8,
        signature: -1,
        signedWeek: -1,
        id: -1,
        status: -1,
        type: -1,
        createdOn: -1,
        updatedOn: -1,
        createdBy: -1,
        rootCause: -1,
        bim360CreatedBy: -1,
        bim360CreatedOn: -1,
        bim360ClosedOn: -1,
        closedAt: -1,
        greenTags: -1,
      })
    }
  })

  it('is ready without the optional Root Cause slot and reports it at −1', () => {
    const result = readCombinedTable(combinedTable(OVERVIEW_ROLES.filter((role) => role !== 'rootCause')), OVERVIEW_SLOTS)
    expect(result.kind).toBe('ready')
    if (result.kind === 'ready') expect(result.columns.rootCause).toBe(-1)
  })

  it('is ready without the optional enrichment slots and reports them at −1', () => {
    const enrichment: CombinedRole[] = ['bim360CreatedBy', 'bim360CreatedOn', 'bim360ClosedOn', 'closedAt']
    const result = readCombinedTable(combinedTable(OVERVIEW_ROLES.filter((role) => !enrichment.includes(role))), OVERVIEW_SLOTS)
    expect(result.kind).toBe('ready')
    if (result.kind === 'ready') {
      const { bim360CreatedBy, bim360CreatedOn, bim360ClosedOn, closedAt } = result.columns
      expect([bim360CreatedBy, bim360CreatedOn, bim360ClosedOn, closedAt]).toEqual([-1, -1, -1, -1])
    }
  })

  it('is ready without the optional Green tags slot and reports it at −1', () => {
    const result = readCombinedTable(combinedTable(OVERVIEW_ROLES.filter((role) => role !== 'greenTags')), OVERVIEW_SLOTS)
    expect(result.kind).toBe('ready')
    if (result.kind === 'ready') expect(result.columns.greenTags).toBe(-1)
  })

  it('treats a table without rows as ready and empty', () => {
    const result = readCombinedTable({ columns: PERFORMANCE_ROLES.map((role) => ({ roles: { [role]: true } })) }, PERFORMANCE_SLOTS)
    expect(result.kind).toBe('ready')
    if (result.kind === 'ready') expect(result.rows).toEqual([])
  })
})

describe('readGreenTags', () => {
  it('reads the first finite number in the column', () => {
    expect(readGreenTags([['Electrical', 412], ['Welding', 412]], 1)).toBe(412)
  })

  it('reads a numeric string', () => {
    expect(readGreenTags([['Electrical', ' 37.5 ']], 1)).toBe(37.5)
  })

  it('skips blank and non-numeric cells before the first number', () => {
    expect(readGreenTags([['Electrical', null], ['Mechanical', ''], ['Welding', 'n/a'], ['BIM', 9]], 1)).toBe(9)
  })

  it('returns null when every cell is blank', () => {
    expect(readGreenTags([['Electrical', null], ['Mechanical', '  '], ['Welding', undefined]], 1)).toBeNull()
  })

  it('returns null for NaN, infinities and non-numbers', () => {
    expect(readGreenTags([[Number.NaN], [Number.POSITIVE_INFINITY], ['twelve'], [true], [new Date(2026, 9, 15)]], 0)).toBeNull()
  })

  it('returns null when the slot is unbound', () => {
    expect(readGreenTags([['Electrical', 412]], -1)).toBeNull()
  })

  it('returns null when there are no rows', () => {
    expect(readGreenTags([], 1)).toBeNull()
  })
})
