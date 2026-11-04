import { describe, expect, it } from 'vitest'

import { clampRange, presetRange } from '../weekRange'
import type { RangeWeek } from '../weekRange'
import { enumerateWorkWeeks, makeWorkWeek } from '../workWeeks'

/** WW45'2025 to WW10'2026: crosses a year boundary (2025 has 52 weeks). */
const WEEKS: RangeWeek[] = enumerateWorkWeeks(makeWorkWeek(2025, 45), makeWorkWeek(2026, 10)).map(({ key, label }) => ({ key, label }))

describe('presetRange', () => {
  it('last4 covers 4 weeks including the current one', () => {
    expect(presetRange('last4', WEEKS, 202610)).toEqual({ fromKey: 202607, toKey: 202610 })
  })

  it('last13 counts back across the year boundary', () => {
    expect(presetRange('last13', WEEKS, 202610)).toEqual({ fromKey: 202550, toKey: 202610 })
  })

  it('thisYear starts at the current year first week', () => {
    expect(presetRange('thisYear', WEEKS, 202606)).toEqual({ fromKey: 202601, toKey: 202606 })
  })

  it("thisYear starts at the data's first week when the data begins after the year does", () => {
    const lateStart = WEEKS.filter((week) => week.key >= 202603)
    expect(presetRange('thisYear', lateStart, 202606)).toEqual({ fromKey: 202603, toKey: 202606 })
  })

  it('stops at the last data week when the current week is past the data', () => {
    expect(presetRange('last4', WEEKS, 202620)).toEqual({ fromKey: 202607, toKey: 202610 })
  })

  it('starts at the first data week when fewer weeks exist than the preset spans', () => {
    expect(presetRange('last13', WEEKS.slice(0, 3), 202547)).toEqual({ fromKey: 202545, toKey: 202547 })
  })
})

describe('clampRange', () => {
  it('pulls limits into the data and returns null when it covers all weeks', () => {
    expect(clampRange({ fromKey: 202501, toKey: 202699 }, WEEKS)).toBeNull()
    expect(clampRange({ fromKey: 202545, toKey: 202610 }, WEEKS)).toBeNull()
    expect(clampRange({ fromKey: 202501, toKey: 202605 }, WEEKS)).toEqual({ fromKey: 202545, toKey: 202605 })
    expect(clampRange({ fromKey: 202603, toKey: 202699 }, WEEKS)).toEqual({ fromKey: 202603, toKey: 202610 })
  })

  it('keeps a range inside the data unchanged', () => {
    expect(clampRange({ fromKey: 202603, toKey: 202607 }, WEEKS)).toEqual({ fromKey: 202603, toKey: 202607 })
  })

  it('returns null when there are no weeks', () => {
    expect(clampRange({ fromKey: 202603, toKey: 202607 }, [])).toBeNull()
  })
})
