import { describe, expect, it } from 'vitest'

import { readInspectionTable } from '../dataView'
import { tableDataView } from './tableDataView'

const ROW = ["WW42'2026", 'Final', 'No Issue Found', 'F63.2']

describe('readInspectionTable', () => {
  it('reports every required slot when there is no data view', () => {
    const result = readInspectionTable(undefined)
    expect(result.kind).toBe('missing')
    if (result.kind === 'missing') expect(result.missing.map((slot) => slot.slot)).toEqual(['Work Week', 'Inspection Phase', 'Issue?', 'Building'])
  })

  it('names only the slots that are still empty', () => {
    const result = readInspectionTable(tableDataView([ROW], { roles: ['workWeek', 'phase'] }))
    expect(result.kind).toBe('missing')
    if (result.kind === 'missing') expect(result.missing.map((slot) => slot.column)).toEqual(['Issue?', 'Building'])
  })

  it('finds column positions by role regardless of order', () => {
    const result = readInspectionTable(tableDataView([ROW], { roles: ['building', 'issue', 'rowId', 'phase', 'workWeek'] }))
    expect(result.kind).toBe('ready')
    if (result.kind === 'ready') {
      expect(result.columns).toEqual({ workWeek: 4, phase: 3, issue: 1, building: 0 })
      expect(result.rows[0][result.columns.workWeek]).toBe("WW42'2026")
      expect(result.hasRowId).toBe(true)
    }
  })

  it('notes when the Row ID slot is empty', () => {
    const result = readInspectionTable(tableDataView([ROW], { roles: ['workWeek', 'phase', 'issue', 'building'] }))
    expect(result.kind === 'ready' && result.hasRowId).toBe(false)
  })
})
