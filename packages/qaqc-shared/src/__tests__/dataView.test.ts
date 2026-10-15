import { describe, expect, it } from 'vitest'

import { readInspectionTable, type InspectionTableSource } from '../dataView'

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
