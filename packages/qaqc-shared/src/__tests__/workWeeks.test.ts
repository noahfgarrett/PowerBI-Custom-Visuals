import { describe, expect, it } from 'vitest'

import {
  enumerateWorkWeeks,
  makeWorkWeek,
  nextWorkWeek,
  parseWorkWeek,
  previousWorkWeek,
  shortWeekLabel,
  toIsoWorkWeek,
  weeksInIsoYear,
} from '../workWeeks'

describe('parseWorkWeek', () => {
  it('parses the Smartsheet label format', () => {
    expect(parseWorkWeek("WW42'2026")).toEqual(makeWorkWeek(2026, 42))
  })

  it('accepts spacing, dashes, word prefixes, curly quotes, and two-digit years', () => {
    expect(parseWorkWeek('WW 7 - 2026')?.label).toBe("WW07'2026")
    expect(parseWorkWeek('Week 42 2026')?.label).toBe("WW42'2026")
    expect(parseWorkWeek("ww42'26")?.label).toBe("WW42'2026")
    expect(parseWorkWeek('  WW42’2026  ')?.label).toBe("WW42'2026")
  })

  it('accepts week 53 only in 53-week ISO years', () => {
    expect(parseWorkWeek("WW53'2026")?.key).toBe(202653)
    expect(parseWorkWeek("WW53'2025")).toBeNull()
  })

  it('rejects unreadable values', () => {
    for (const value of ['', 'UPW', 'WW102025', "WW00'2026", null, undefined, 42, {}]) {
      expect(parseWorkWeek(value)).toBeNull()
    }
  })

  it('converts Date values to their ISO week', () => {
    expect(parseWorkWeek(new Date(2026, 9, 15))?.label).toBe("WW42'2026")
  })
})

describe('ISO week math', () => {
  it('finds the ISO week of a date, including year edges', () => {
    expect(toIsoWorkWeek(new Date(2026, 9, 15)).label).toBe("WW42'2026")
    expect(toIsoWorkWeek(new Date(2027, 0, 1)).label).toBe("WW53'2026")
    expect(toIsoWorkWeek(new Date(2025, 11, 29)).label).toBe("WW01'2026")
  })

  it('knows which years have 53 weeks', () => {
    expect(weeksInIsoYear(2025)).toBe(52)
    expect(weeksInIsoYear(2026)).toBe(53)
  })

  it('steps across the 53-week year boundary', () => {
    expect(nextWorkWeek(makeWorkWeek(2026, 52)).label).toBe("WW53'2026")
    expect(nextWorkWeek(makeWorkWeek(2026, 53)).label).toBe("WW01'2027")
    expect(previousWorkWeek(makeWorkWeek(2027, 1)).label).toBe("WW53'2026")
    expect(previousWorkWeek(makeWorkWeek(2026, 1)).label).toBe("WW52'2025")
  })

  it('enumerates a continuous inclusive range', () => {
    const weeks = enumerateWorkWeeks(makeWorkWeek(2025, 51), makeWorkWeek(2026, 2))
    expect(weeks.map((week) => week.label)).toEqual(["WW51'2025", "WW52'2025", "WW01'2026", "WW02'2026"])
  })

  it('returns an empty range when start is after end', () => {
    expect(enumerateWorkWeeks(makeWorkWeek(2026, 3), makeWorkWeek(2026, 2))).toEqual([])
  })

  it('formats a short axis label', () => {
    expect(shortWeekLabel(makeWorkWeek(2026, 7))).toBe('WW07')
  })
})
