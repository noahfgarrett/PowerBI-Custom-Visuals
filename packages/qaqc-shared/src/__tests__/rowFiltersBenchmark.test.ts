import { describe, expect, it } from 'vitest'

import { buildFilterCatalog, cellDisplayText, matchRows } from '../rowFilters'
import type { FilterFieldDef, FilterSelection, Row } from '../rowFilters'
import { weldFilterFields } from '../welds'
import { bestOf, elapsed, TIMING_RUNS } from './timing'

const ROW_COUNT = 100_000
const FIELD_COUNT = 6
// Measured on 100,000 rows with 6 fields (about 20 values each, 1,000 welders): matching takes about 5 ms and
// building the catalog about 50 ms.
const MATCH_BUDGET_MS = 50
const CATALOG_BUDGET_MS = 300

const FIELDS: FilterFieldDef[] = Array.from({ length: FIELD_COUNT }, (_, column) => ({
  id: `field${column}`,
  label: `Field ${column}`,
  read: (row: Row): string => cellDisplayText(row[column]),
}))

/** A deterministic 32-bit hash of the row number, so the rows are spread without a random generator. */
function mix(value: number): number {
  const hashed = Math.imul(value ^ (value >>> 16), 0x45d9f3b)
  return (hashed ^ (hashed >>> 16)) >>> 0
}

function makeRows(): Row[] {
  const rows: Row[] = []
  for (let serial = 0; serial < ROW_COUNT; serial += 1) {
    const hash = mix(serial + 1)
    rows.push(Array.from({ length: FIELD_COUNT }, (_, column) => {
      const value = mix(hash + column) % (column === 5 ? 1_000 : 20)
      return value === 0 ? '' : `Value ${value}`
    }))
  }
  return rows
}

describe('row filter budgets', () => {
  const rows = makeRows()
  const catalog = buildFilterCatalog(rows, FIELDS)
  const selection: FilterSelection = new Map([
    ['field0', new Set(['value 1', 'value 2', 'value 3'])],
    ['field2', new Set(['value 4', 'value 5'])],
    ['field5', new Set(Array.from({ length: 500 }, (_, index) => `value ${index + 1}`))],
  ])

  it('matchRows under 50 ms', () => {
    matchRows(rows, catalog, selection)
    expect(bestOf(TIMING_RUNS, () => elapsed(() => matchRows(rows, catalog, selection)))).toBeLessThan(MATCH_BUDGET_MS)
  })

  it('matches a non-empty subset, so the budget measures real work', () => {
    const matched = matchRows(rows, catalog, selection)
    expect(matched.length).toBeGreaterThan(0)
    expect(matched.length).toBeLessThan(rows.length)
  })

  it('buildFilterCatalog under 300 ms', () => {
    expect(bestOf(TIMING_RUNS, () => elapsed(() => buildFilterCatalog(rows, FIELDS)))).toBeLessThan(CATALOG_BUDGET_MS)
  })
})

describe('weld filter budgets', () => {
  const COLUMNS = { weldWeek: 0, signature: 1, signedWeek: 2, issue: 3, fluidCode: 4, pipeSpec: 5, tagNo: 6 }
  const rows: Row[] = Array.from({ length: ROW_COUNT }, (_, serial) => {
    const hash = mix(serial + 1)
    return [
      "WW40'2026", null, null, null, `S${hash % 56}`, `Spec ${hash % 20}`, `F631M001XX-P001-FW-${serial}`,
      `P-${hash % 1_000}, PF-${hash % 700}`, `WP-${hash % 50}`,
    ]
  })
  const fields = weldFilterFields(COLUMNS, { welder: 7, workPackage: 8 })
  const catalog = buildFilterCatalog(rows, fields)
  const selection: FilterSelection = new Map([
    ['building', new Set(['f631'])],
    ['pipeSpec', new Set(['spec 1', 'spec 2', 'spec 3'])],
    ['welder', new Set(Array.from({ length: 500 }, (_, index) => `p-${index}`))],
  ])

  it('matches Building, Pipe Spec and a comma-separated Welder under 50 ms', () => {
    expect(matchRows(rows, catalog, selection).length).toBeGreaterThan(0)
    expect(bestOf(TIMING_RUNS, () => elapsed(() => matchRows(rows, catalog, selection)))).toBeLessThan(MATCH_BUDGET_MS)
  })
})
