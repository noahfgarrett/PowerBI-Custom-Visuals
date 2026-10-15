import { describe, expect, it } from 'vitest'

import { readInspectionTable, readIssueTable, readWeldTable, type InspectionTableSource } from '../dataView'

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

type IssueRole = 'id' | 'title' | 'status' | 'type' | 'contractor' | 'discipline' | 'createdOn' | 'updatedOn' | 'dueDate' | 'createdBy'
const ALL_ISSUE_ROLES: IssueRole[] = ['id', 'title', 'status', 'type', 'contractor', 'discipline', 'createdOn', 'updatedOn', 'dueDate', 'createdBy']

function issueTable(rows: ReadonlyArray<ReadonlyArray<unknown>>, roles: IssueRole[] = ALL_ISSUE_ROLES): InspectionTableSource {
  return {
    columns: roles.map((role) => ({ roles: { [role]: true } })),
    rows: rows.map((row) => roles.map((role) => row[ALL_ISSUE_ROLES.indexOf(role)])),
  }
}

const ISSUE_ROW = ['#1020', 'WR1 - GF PVC Protection Deficiency', 'Ready to Inspect', 'COR', 'Bayside', 'Mechanical', '7/27/2026', '7/27/2026', '8/14/2026', 'LotusWorks']

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
        'Discipline',
        'Created On',
        'Updated On',
        'Due Date',
        'Created By',
      ])
    }
  })

  it('names only the slots that are still empty', () => {
    const result = readIssueTable(issueTable([ISSUE_ROW], ['id', 'title', 'status', 'type', 'contractor', 'discipline', 'createdOn']))
    expect(result.kind).toBe('missing')
    if (result.kind === 'missing') expect(result.missing.map((slot) => slot.column)).toEqual(['Updated On', 'Due Date', 'Created By'])
  })

  it('requires the Created By slot on its own', () => {
    const result = readIssueTable(issueTable([ISSUE_ROW], ALL_ISSUE_ROLES.filter((role) => role !== 'createdBy')))
    expect(result.kind).toBe('missing')
    if (result.kind === 'missing') expect(result.missing.map((slot) => slot.role)).toEqual(['createdBy'])
  })

  it('finds column positions by role regardless of order', () => {
    const result = readIssueTable(issueTable([ISSUE_ROW], [...ALL_ISSUE_ROLES].reverse()))
    expect(result.kind).toBe('ready')
    if (result.kind === 'ready') {
      expect(result.columns).toEqual({
        id: 9,
        title: 8,
        status: 7,
        type: 6,
        contractor: 5,
        discipline: 4,
        createdOn: 3,
        updatedOn: 2,
        dueDate: 1,
        createdBy: 0,
      })
      expect(result.rows[0][result.columns.id]).toBe('#1020')
    }
  })

  it('passes date cells through unchanged when Power BI delivers Date objects', () => {
    const createdOn = new Date(2026, 6, 27)
    const result = readIssueTable(issueTable([[...ISSUE_ROW.slice(0, 6), createdOn, ...ISSUE_ROW.slice(7)]]))
    expect(result.kind).toBe('ready')
    if (result.kind === 'ready') expect(result.rows[0][result.columns.createdOn]).toBe(createdOn)
  })

  it('treats a table without rows as ready and empty', () => {
    const result = readIssueTable({ columns: ALL_ISSUE_ROLES.map((role) => ({ roles: { [role]: true } })) })
    expect(result.kind).toBe('ready')
    if (result.kind === 'ready') expect(result.rows).toEqual([])
  })
})
