import { afterEach, describe, expect, it, vi } from 'vitest'

import { compareNullLast, createRankCache, textRanks } from '../tableSort'
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

describe('compareNullLast', () => {
  it('orders numbers in the given direction', () => {
    expect([3, 1, 2].sort((a, b) => compareNullLast(a, b, 1))).toEqual([1, 2, 3])
    expect([3, 1, 2].sort((a, b) => compareNullLast(a, b, -1))).toEqual([3, 2, 1])
  })

  it('puts null last in both directions', () => {
    expect([null, 2, 1].sort((a, b) => compareNullLast(a, b, 1))).toEqual([1, 2, null])
    expect([null, 1, 2].sort((a, b) => compareNullLast(a, b, -1))).toEqual([2, 1, null])
  })

  it('returns zero for ties so callers can chain a tie-break', () => {
    expect(compareNullLast(4, 4, -1) || 0).toBe(0)
    expect(compareNullLast(null, null, 1)).toBe(0)
  })
})

describe('createRankCache', () => {
  it('ranks a column the first time it is asked for and reuses it after', () => {
    const rows = [{ name: 'b', status: 'Open' }, { name: 'a', status: 'Closed' }]
    const ranksFor = createRankCache<'name' | 'status', { name: string; status: string }>(rows)
    const calls = countCompares()
    const first = ranksFor('name')
    const afterFirst = calls()
    expect([...first]).toEqual([1, 0])
    expect(ranksFor('name')).toBe(first)
    expect(calls()).toBe(afterFirst)
    expect([...ranksFor('status')]).toEqual([1, 0])
  })

  it('never touches the collator until a column is asked for', () => {
    const calls = countCompares()
    createRankCache<'name', { name: string }>([{ name: 'b' }, { name: 'a' }])
    expect(calls()).toBe(0)
  })
})
