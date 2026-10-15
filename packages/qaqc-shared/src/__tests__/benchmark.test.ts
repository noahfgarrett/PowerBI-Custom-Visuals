import { describe, expect, it } from 'vitest'

import { buildInspectionIndex, buildInspectionModel, defaultViewState } from '../inspections'
import { buildWeldIndex, buildWeldModel } from '../welds'
import { syntheticInspectionRows, syntheticWeldRows } from './fixtures/syntheticRows'

const COLUMNS = { workWeek: 0, phase: 1, issue: 2, building: 3 }
const WELD_COLUMNS = { weldWeek: 0, signature: 1, signedWeek: 2, issue: 3, fluidCode: 4, pipeSpec: 5, tagNo: 6 }
const TODAY = new Date(2026, 9, 15)

function elapsed(work: () => void): number {
  const start = performance.now()
  work()
  return performance.now() - start
}

describe('performance budgets', () => {
  it('indexes 100,000 rows within budget', () => {
    const rows = syntheticInspectionRows(100_000)
    buildInspectionIndex(rows, COLUMNS, TODAY)
    expect(elapsed(() => buildInspectionIndex(rows, COLUMNS, TODAY))).toBeLessThan(300)
  })

  it('indexes 500,000 rows within budget', () => {
    const rows = syntheticInspectionRows(500_000)
    buildInspectionIndex(rows, COLUMNS, TODAY)
    expect(elapsed(() => buildInspectionIndex(rows, COLUMNS, TODAY))).toBeLessThan(1500)
  })

  it('recomputes the All-range view model from a 500,000-row index within one frame', () => {
    const index = buildInspectionIndex(syntheticInspectionRows(500_000), COLUMNS, TODAY)
    const view = { ...defaultViewState(index), range: 'all' as const }
    buildInspectionModel(index, view)
    expect(elapsed(() => buildInspectionModel(index, view))).toBeLessThan(16)
  })
})

describe('welding performance budgets', () => {
  it('indexes 500,000 weld rows within budget', () => {
    const rows = syntheticWeldRows(500_000)
    buildWeldIndex(rows, WELD_COLUMNS, TODAY)
    expect(elapsed(() => buildWeldIndex(rows, WELD_COLUMNS, TODAY))).toBeLessThan(1500)
  })

  it('recomputes the All-range weld model from a 500,000-row index within one frame', () => {
    const index = buildWeldIndex(syntheticWeldRows(500_000), WELD_COLUMNS, TODAY)
    const view = { ...defaultViewState(index), range: 'all' as const }
    buildWeldModel(index, view, 'AW', 10)
    expect(elapsed(() => buildWeldModel(index, view, 'AW', 10))).toBeLessThan(16)
  })
})
