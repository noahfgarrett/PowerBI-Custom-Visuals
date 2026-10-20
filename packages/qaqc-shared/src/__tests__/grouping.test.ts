import { describe, expect, it } from 'vitest'

import { createNameGrouper, createWeekReader, firstSpelling, groupKey } from '../grouping'

describe('groupKey', () => {
  it('lower-cases and collapses runs of whitespace', () => {
    expect(groupKey('Pat \t Lee')).toBe('pat lee')
  })
})

describe('createNameGrouper', () => {
  it('shows each group under its first spelling', () => {
    const nameOf = createNameGrouper(firstSpelling)
    expect(['F63.1', 'f63.1', 'F63  .1', 'F63 .1'].map(nameOf)).toEqual(['F63.1', 'F63.1', 'F63  .1', 'F63  .1'])
  })

  it('creates one group per key, passing its key and first spelling', () => {
    const created: string[] = []
    const idOf = createNameGrouper((key, spelling) => {
      created.push(`${key}|${spelling}`)
      return created.length - 1
    })
    expect(['Pat Lee', 'PAT  LEE', 'Sam', 'pat lee'].map(idOf)).toEqual([0, 0, 1, 0])
    expect(created).toEqual(['pat lee|Pat Lee', 'sam|Sam'])
  })
})

describe('createWeekReader', () => {
  it('parses work-week text and numbers', () => {
    const readWeek = createWeekReader()
    expect(readWeek("WW42'2026")?.key).toBe(202642)
    expect(readWeek('WW 3 - 26')?.label).toBe("WW03'2026")
  })

  it('returns null for unreadable values', () => {
    const readWeek = createWeekReader()
    expect([readWeek(''), readWeek('next week'), readWeek(null), readWeek(undefined)]).toEqual([null, null, null, null])
  })

  it('reads dates as their ISO week', () => {
    expect(createWeekReader()(new Date(2026, 9, 15))?.key).toBe(202642)
  })

  it('returns the same week object for repeated text', () => {
    const readWeek = createWeekReader()
    expect(readWeek("WW42'2026")).toBe(readWeek("WW42'2026"))
  })
})
