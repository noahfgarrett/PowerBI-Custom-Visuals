import { describe, expect, it } from 'vitest'

import { splitCombinedRows } from '../combined'
import { buildPerformanceIndex, buildPerformanceModel } from '../performance'
import type { CombinedColumns } from '../types'
import { COMBINED_COLUMNS } from './fixtures/combinedRows'
import { syntheticCombinedRows } from './fixtures/syntheticCombined'
import { bestOf, elapsed, TIMING_RUNS } from './timing'

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
  signature: -1,
  signedWeek: -1,
  id: -1,
  status: -1,
  type: -1,
  createdOn: -1,
  updatedOn: -1,
  createdBy: -1,
  rootCause: -1,
  greenTags: -1,
}
const TODAY = new Date(2026, 9, 15)
const CURRENT = 202642
// Measured on 500,000 rows (2021 to WW42'2026, about 300 weeks): indexing takes 130 to 170 ms, and ranking
// either group takes under 0.5 ms with 30 QCR/FE and 120 welders, and about 2 ms with 1,000 people in each group.
const INDEX_BUDGET_MS = 600
const RANKING_BUDGET_MS = 300
const FRAME_BUDGET_MS = 16

const PEOPLE_PER_GROUP = 1_000
const FIRST_YEAR = 2021

/** A deterministic 32-bit hash of the row number, so the rows are spread without a random generator. */
function mix(value: number): number {
  const hashed = Math.imul(value ^ (value >>> 16), 0x45d9f3b)
  return (hashed ^ (hashed >>> 16)) >>> 0
}

function weekLabel(serial: number): string {
  const offset = mix(serial) % 300
  const year = FIRST_YEAR + Math.floor(offset / 52)
  const week = 1 + (offset % 52)
  return `WW${String(week).padStart(2, '0')}'${year}`
}

/** Combined rows with 1,000 QCR/FE and 1,000 welders: 30% inspections and 70% welds, 10% of them shared. */
function manyPeopleRows(count: number): unknown[][] {
  const rows: unknown[][] = []
  for (let serial = 0; serial < count; serial += 1) {
    const row = new Array<unknown>(COMBINED_COLUMNS.length).fill(null)
    const hash = mix(serial + 1)
    row[COLUMNS.workWeek] = weekLabel(serial)
    if (hash % 10 < 3) {
      row[COLUMNS.source] = hash % 2 === 0 ? 'Electrical' : 'Mechanical'
      row[COLUMNS.phase] = hash % 5 === 0 ? 'SOR' : 'Final'
      row[COLUMNS.issue] = hash % 40 === 0 ? 'Cable damaged' : 'No Issue Found'
      row[COLUMNS.building] = `B${hash % 20}`
      row[COLUMNS.qcr] = `QCR ${(hash >>> 8) % PEOPLE_PER_GROUP}`
    } else {
      const welder = `Welder ${(hash >>> 8) % PEOPLE_PER_GROUP}`
      row[COLUMNS.source] = 'Welding'
      row[COLUMNS.welder] = hash % 10 === 9 ? `${welder}, Welder ${(hash >>> 20) % PEOPLE_PER_GROUP}` : welder
      row[COLUMNS.issue] = hash % 50 === 0 ? `BIM #${serial}` : 'No'
      row[COLUMNS.tagNo] = `TAG-${serial}`
    }
    rows.push(row)
  }
  return rows
}

describe('performance visual budgets', () => {
  const split = splitCombinedRows(syntheticCombinedRows(500_000, 7), COLUMNS.source)
  const index = buildPerformanceIndex(split, COLUMNS, TODAY)
  const view = { selectedKey: CURRENT, windowEndKey: CURRENT, range: 'all' as const, dateRange: null }

  it('indexes 500,000 combined rows within budget', () => {
    expect(bestOf(TIMING_RUNS, () => elapsed(() => buildPerformanceIndex(split, COLUMNS, TODAY)))).toBeLessThan(INDEX_BUDGET_MS)
  })

  it('ranks both groups over All from a 500,000-row index within budget', () => {
    buildPerformanceModel(index, view, 'qcr', 5)
    expect(bestOf(TIMING_RUNS, () => elapsed(() => {
      buildPerformanceModel(index, view, 'qcr', 5)
      buildPerformanceModel(index, view, 'welders', 10)
    }))).toBeLessThan(RANKING_BUDGET_MS)
  })

  it('re-ranks for a new period within one frame, since ranking reads week buckets rather than rows', () => {
    buildPerformanceModel(index, view, 'welders', 10)
    expect(bestOf(TIMING_RUNS, () => elapsed(() => buildPerformanceModel(index, { ...view, range: 'recent' }, 'welders', 10)))).toBeLessThan(FRAME_BUDGET_MS)
  })
})

describe('performance visual budgets with 2,000 people', () => {
  const split = splitCombinedRows(manyPeopleRows(500_000), COLUMNS.source)
  const index = buildPerformanceIndex(split, COLUMNS, TODAY)
  const view = { selectedKey: CURRENT, windowEndKey: CURRENT, range: 'all' as const, dateRange: null }

  it('holds about 1,000 people in each group', () => {
    expect(index.qcr.length).toBeGreaterThan(990)
    expect(index.welders.length).toBeGreaterThan(990)
  })

  it('indexes 500,000 combined rows within budget', () => {
    expect(bestOf(TIMING_RUNS, () => elapsed(() => buildPerformanceIndex(split, COLUMNS, TODAY)))).toBeLessThan(INDEX_BUDGET_MS)
  })

  it('ranks both groups over All within one frame', () => {
    buildPerformanceModel(index, view, 'qcr', 5)
    expect(bestOf(TIMING_RUNS, () => elapsed(() => {
      buildPerformanceModel(index, view, 'qcr', 5)
      buildPerformanceModel(index, view, 'welders', 10)
    }))).toBeLessThan(FRAME_BUDGET_MS)
  })
})
