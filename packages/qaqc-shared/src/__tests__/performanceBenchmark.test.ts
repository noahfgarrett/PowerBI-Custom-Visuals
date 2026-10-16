import { describe, expect, it } from 'vitest'

import { splitCombinedRows } from '../combined'
import { buildPerformanceIndex, buildPerformanceModel } from '../performance'
import type { CombinedColumns } from '../types'
import { COMBINED_COLUMNS } from './fixtures/combinedRows'
import { syntheticCombinedRows } from './fixtures/syntheticCombined'

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
  greenTags: -1,
}
const TODAY = new Date(2026, 9, 15)
const CURRENT = 202642
// Measured on 500,000 synthetic rows (2021 to WW42'2026): about 145 ms to index, under 1 ms to rank either group.
const INDEX_BUDGET_MS = 600
const RANKING_BUDGET_MS = 300
const FRAME_BUDGET_MS = 16

function elapsed(work: () => void): number {
  const start = performance.now()
  work()
  return performance.now() - start
}

describe('performance visual budgets', () => {
  const split = splitCombinedRows(syntheticCombinedRows(500_000, 7), COLUMNS.source)
  const index = buildPerformanceIndex(split, COLUMNS, TODAY)
  const view = { selectedKey: CURRENT, windowEndKey: CURRENT, range: 'all' as const }

  it('indexes 500,000 combined rows within budget', () => {
    expect(elapsed(() => buildPerformanceIndex(split, COLUMNS, TODAY))).toBeLessThan(INDEX_BUDGET_MS)
  })

  it('ranks both groups over All from a 500,000-row index within budget', () => {
    buildPerformanceModel(index, view, 'qcr', 5)
    expect(elapsed(() => {
      buildPerformanceModel(index, view, 'qcr', 5)
      buildPerformanceModel(index, view, 'welders', 10)
    })).toBeLessThan(RANKING_BUDGET_MS)
  })

  it('re-ranks for a new period within one frame, since ranking reads week buckets rather than rows', () => {
    buildPerformanceModel(index, view, 'welders', 10)
    expect(elapsed(() => buildPerformanceModel(index, { ...view, range: 'recent' }, 'welders', 10))).toBeLessThan(FRAME_BUDGET_MS)
  })
})
