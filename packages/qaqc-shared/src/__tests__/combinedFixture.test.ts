import { describe, expect, it } from 'vitest'

import type { CombinedColumns } from '../types'
import { inspectionColumnsOf, issueColumnsOf, splitCombinedRows, weldColumnsOf } from '../combined'
import { buildInspectionIndex, buildInspectionModel, defaultViewState } from '../inspections'
import { buildIssueIndex, buildIssueModel } from '../issues'
import { isNotRecorded } from '../performance'
import { buildWeldIndex } from '../welds'
import { COMBINED_COLUMNS, COMBINED_ROWS } from './fixtures/combinedRows'
import { ELECTRICAL_ROWS } from './fixtures/electricalRows'
import { ISSUE_ROWS } from './fixtures/issueRows'
import { MECHANICAL_ROWS } from './fixtures/mechanicalRows'
import { WELDING_ROWS } from './fixtures/weldingRows'

type CombinedColumnName = (typeof COMBINED_COLUMNS)[number]

function position(name: CombinedColumnName): number {
  return COMBINED_COLUMNS.indexOf(name)
}

const COLUMNS: CombinedColumns = {
  source: position('Source'),
  workWeek: position('Work Week'),
  phase: position('Inspection Phase'),
  issue: position('Issue'),
  building: position('Building'),
  qcr: position('QCR/FE'),
  welder: position('Welder'),
  tagNo: position('Tag No'),
  signature: position('Signature'),
  signedWeek: position('Work Week Signed'),
  id: position('ID'),
  status: position('Status'),
  type: position('Type'),
  createdOn: position('Created On'),
  updatedOn: position('Updated On'),
  createdBy: position('Created By'),
  rootCause: position('Root Cause'),
  greenTags: -1,
}
const TODAY = new Date(2026, 9, 15) // WW42'2026
const split = splitCombinedRows(COMBINED_ROWS, COLUMNS.source)

function pick(rows: ReadonlyArray<ReadonlyArray<unknown>>, columns: number[]): unknown[][] {
  return rows.map((row) => columns.map((column) => row[column]))
}

describe('QAQC Combined fixture (2026-10-14 exports)', () => {
  it('holds 2,385 rows with 1-based Row IDs in append order', () => {
    expect(COMBINED_ROWS).toHaveLength(2385)
    expect(COMBINED_ROWS.map((row) => row[position('Row ID')])).toEqual(COMBINED_ROWS.map((_, rowIndex) => rowIndex + 1))
  })

  it('splits into 288 Electrical, 138 Mechanical, 1,751 Welding and 208 BIM rows with no unknown Source', () => {
    expect(split.electrical).toHaveLength(288)
    expect(split.mechanical).toHaveLength(138)
    expect(split.welding).toHaveLength(1751)
    expect(split.bim).toHaveLength(208)
    expect(split.unknownSource).toBe(0)
  })

  it('carries the same cells as the discipline fixtures', () => {
    const inspection = [COLUMNS.workWeek, COLUMNS.phase, COLUMNS.issue, COLUMNS.building]
    expect(pick(split.electrical, inspection)).toEqual(ELECTRICAL_ROWS)
    expect(pick(split.mechanical, inspection)).toEqual(MECHANICAL_ROWS)
    expect(pick(split.welding, [COLUMNS.workWeek, COLUMNS.signature, COLUMNS.signedWeek, COLUMNS.issue, COLUMNS.tagNo])).toEqual(
      pick(WELDING_ROWS, [0, 1, 2, 3, 6]),
    )
    expect(pick(split.bim, [COLUMNS.id, COLUMNS.status, COLUMNS.type, COLUMNS.createdOn, COLUMNS.updatedOn, COLUMNS.createdBy])).toEqual(
      pick(ISSUE_ROWS, [0, 2, 3, 5, 6, 8]),
    )
  })

  it('appends Root Cause as the last column, carrying the BIM Root Cause', () => {
    expect(COMBINED_COLUMNS[COMBINED_COLUMNS.length - 1]).toBe('Root Cause')
    expect(COMBINED_ROWS.every((row) => row.length === COMBINED_COLUMNS.length)).toBe(true)
    expect(pick(split.bim, [COLUMNS.rootCause])).toEqual(pick(ISSUE_ROWS, [9]))
  })

  it('holds only pseudonyms or Not recorded values in QCR/FE', () => {
    const values = [...split.electrical, ...split.mechanical].map((row) => row[COLUMNS.qcr])
    const named = values.filter((value) => typeof value === 'string' && !isNotRecorded(value))
    expect(values.every((value) => value === null || typeof value === 'string')).toBe(true)
    expect(named.length).toBeGreaterThan(0)
    expect(named.every((value) => typeof value === 'string' && /^QCR \d{2}$/.test(value))).toBe(true)
  })

  it('holds only pseudonyms in every Welder part, keeping the comma lists', () => {
    const cells = split.welding.map((row) => row[COLUMNS.welder]).filter((value) => typeof value === 'string')
    const parts = cells.flatMap((cell) => cell.split(','))
    expect(cells.some((cell) => cell.includes(','))).toBe(true)
    expect(parts.every((part) => isNotRecorded(part) || /^Welder \d{3}$/.test(part.trim()))).toBe(true)
  })

  it('leaves the columns of other sources null', () => {
    const welderOutsideWelding = [...split.electrical, ...split.mechanical, ...split.bim].filter((row) => row[COLUMNS.welder] !== null)
    const qcrOutsideInspections = [...split.welding, ...split.bim].filter((row) => row[COLUMNS.qcr] !== null)
    const idOutsideBim = [...split.electrical, ...split.mechanical, ...split.welding].filter((row) => row[COLUMNS.id] !== null)
    const rootCauseOutsideBim = [...split.electrical, ...split.mechanical, ...split.welding].filter(
      (row) => row[COLUMNS.rootCause] !== null,
    )
    expect([...welderOutsideWelding, ...qcrOutsideInspections, ...idOutsideBim, ...rootCauseOutsideBim]).toEqual([])
  })

  it('reproduces the Electrical to-date totals through WW42', () => {
    const index = buildInspectionIndex(split.electrical, inspectionColumnsOf(COLUMNS), TODAY)
    const model = buildInspectionModel(index, defaultViewState(index))
    expect(model.toDate.finals).toBe(238)
    expect(model.toDate.sors).toBe(48)
  })

  it('reproduces the Mechanical to-date totals through WW42', () => {
    const index = buildInspectionIndex(split.mechanical, inspectionColumnsOf(COLUMNS), TODAY)
    const model = buildInspectionModel(index, defaultViewState(index))
    expect(model.toDate.finals).toBe(44)
    expect(model.toDate.sors).toBe(91)
  })

  it('reproduces the Welding totals', () => {
    const index = buildWeldIndex(split.welding, weldColumnsOf(COLUMNS), TODAY)
    const last = index.weeks.length - 1
    expect(index.cumulativeLogged[last]).toBe(1751)
    expect(index.cumulativeSigned[last]).toBe(1054)
  })

  it('reproduces the BIM opened, closed and remaining cards', () => {
    const index = buildIssueIndex(split.bim, issueColumnsOf(COLUMNS), TODAY)
    const model = buildIssueModel(index, defaultViewState(index))
    expect(model.toDate.opened.value).toBe(177)
    expect(model.toDate.closed.value).toBe(126)
    expect(model.toDate.remaining.value).toBe(51)
  })

  it('reproduces the 48 Installation issues through the combined Root Cause column', () => {
    const index = buildIssueIndex(split.bim, issueColumnsOf(COLUMNS), TODAY)
    expect(index.hasRootCause).toBe(true)
    expect(index.issues.filter((issue) => issue.rootCause === 'Installation')).toHaveLength(48)
  })
})
