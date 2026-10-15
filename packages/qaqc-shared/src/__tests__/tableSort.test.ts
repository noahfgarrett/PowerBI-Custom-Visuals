import { afterEach, describe, expect, it, vi } from 'vitest'

import { textRanks } from '../tableSort'
import { countCompares } from './countCompares'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('textRanks', () => {
  it('ranks values in collator order: numeric-aware and ignoring case', () => {
    const values = ['Valve 10', 'anchor', 'Valve 9', 'Bolt']
    expect([...textRanks(values, (value) => value)]).toEqual([3, 0, 2, 1])
  })

  it('gives values the collator treats as equal the same rank', () => {
    const values = ['Bayside', 'kenton', 'bayside', 'Kenton', 'Bayside']
    expect([...textRanks(values, (value) => value)]).toEqual([0, 1, 0, 1, 0])
  })

  it('reads each value through the accessor', () => {
    const rows = [{ name: 'b' }, { name: 'a' }]
    expect([...textRanks(rows, (row) => row.name)]).toEqual([1, 0])
  })

  it('compares only the distinct values, not every row', () => {
    const calls = countCompares()
    const values = Array.from({ length: 10_000 }, (_, position) => ['Open', 'Closed', 'Not approved'][position % 3])
    textRanks(values, (value) => value)
    expect(calls()).toBeLessThan(10)
  })

  it('ranks no rows', () => {
    expect(textRanks([], (value: string) => value)).toHaveLength(0)
  })
})
