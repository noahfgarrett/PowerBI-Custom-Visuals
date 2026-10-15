import { describe, expect, it } from 'vitest'

import { daysBetween, formatDate, parseDate } from '../dates'

function parts(date: Date | null): [number, number, number, number] | null {
  return date === null ? null : [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours()]
}

describe('parseDate', () => {
  it('moves a Date object to local noon on the same day', () => {
    expect(parts(parseDate(new Date(2026, 9, 14, 23, 45)))).toEqual([2026, 10, 14, 12])
  })

  it('rejects an invalid Date object', () => {
    expect(parseDate(new Date('nope'))).toBeNull()
  })

  it('reads an ISO date-only string as that local day', () => {
    expect(parts(parseDate('2026-10-14'))).toEqual([2026, 10, 14, 12])
  })

  it('reads an ISO date-time string in local time', () => {
    expect(parts(parseDate('2026-10-14T08:30:00'))).toEqual([2026, 10, 14, 12])
  })

  it('reads the Smartsheet M/D/YYYY format', () => {
    expect(parts(parseDate('7/27/2026'))).toEqual([2026, 7, 27, 12])
    expect(parts(parseDate(' 10/14/2026 '))).toEqual([2026, 10, 14, 12])
  })

  it('reads two-digit years as 20xx', () => {
    expect(parts(parseDate('1/5/26'))).toEqual([2026, 1, 5, 12])
    expect(parts(parseDate('12-31-24'))).toEqual([2024, 12, 31, 12])
  })

  it('reads Excel serial numbers, as numbers or numeric text', () => {
    // 46309 is 2026-10-14 in the 1900 date system.
    expect(parts(parseDate(46309))).toEqual([2026, 10, 14, 12])
    expect(parts(parseDate(46309.75))).toEqual([2026, 10, 14, 12])
    expect(parts(parseDate('46309'))).toEqual([2026, 10, 14, 12])
  })

  it('reads large numbers as epoch milliseconds', () => {
    const epoch = new Date(2026, 9, 14, 9).getTime()
    expect(parts(parseDate(epoch))).toEqual([2026, 10, 14, 12])
  })

  it('returns null for blanks, junk and non-date types', () => {
    expect(parseDate(null)).toBeNull()
    expect(parseDate(undefined)).toBeNull()
    expect(parseDate('')).toBeNull()
    expect(parseDate('   ')).toBeNull()
    expect(parseDate('soon')).toBeNull()
    expect(parseDate(true)).toBeNull()
    expect(parseDate(Number.NaN)).toBeNull()
  })
})

describe('formatDate', () => {
  it('formats as MM/DD/YY', () => {
    expect(formatDate(new Date(2026, 6, 4))).toBe('07/04/26')
    expect(formatDate(new Date(2024, 11, 31))).toBe('12/31/24')
  })

  it('formats null as blank', () => {
    expect(formatDate(null)).toBe('')
  })
})

describe('daysBetween', () => {
  it('counts whole calendar days whatever the times of day', () => {
    expect(daysBetween(new Date(2026, 9, 1, 23), new Date(2026, 9, 15, 1))).toBe(14)
  })

  it('counts across a daylight saving change', () => {
    expect(daysBetween(new Date(2026, 2, 1), new Date(2026, 3, 1))).toBe(31)
  })

  it('never goes below zero', () => {
    expect(daysBetween(new Date(2026, 9, 15), new Date(2026, 9, 1))).toBe(0)
  })
})
