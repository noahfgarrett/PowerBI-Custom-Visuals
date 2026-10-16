import { describe, expect, it } from 'vitest'

import { alignedScale, labelIndices, niceScale, ordinalOpacity, round, passRateDomain, roundedRightBarPath, roundedTopBarPath, truncateLabel, yearMarkers } from '../chartMath'

describe('niceScale', () => {
  it('rounds the max up to a nice step with integer ticks', () => {
    expect(niceScale(14)).toEqual({ max: 15, ticks: [0, 5, 10, 15] })
    expect(niceScale(0)).toEqual({ max: 1, ticks: [0, 1] })
  })
})

describe('labelIndices', () => {
  it('labels every bar when there is room', () => {
    expect(labelIndices(30, 1320, 29).size).toBe(30)
  })

  it('thins labels from the right and always keeps the selected bar', () => {
    expect([...labelIndices(30, 440, 28)].sort((a, b) => a - b)).toEqual([2, 5, 8, 11, 14, 17, 20, 23, 28])
  })

  it('ignores a selection past the end', () => {
    expect([...labelIndices(10, 440, 15)].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('returns nothing for an empty chart', () => {
    expect(labelIndices(0, 400, -1).size).toBe(0)
  })
})

describe('bar paths', () => {
  it('rounds the top corners and squares the baseline', () => {
    expect(roundedTopBarPath(0, 10, 20, 50, 4)).toBe('M0,60V14Q0,10 4,10H16Q20,10 20,14V60Z')
  })

  it('rounds the right end of horizontal bars', () => {
    expect(roundedRightBarPath(0, 0, 40, 10, 4)).toBe('M0,0H36Q40,0 40,4V6Q40,10 36,10H0Z')
  })

  it('returns an empty path for zero-size bars', () => {
    expect(roundedTopBarPath(0, 10, 20, 0, 4)).toBe('')
    expect(roundedRightBarPath(0, 0, 0, 10, 4)).toBe('')
  })
})

describe('passRateDomain', () => {
  it('zooms to one point below the lowest rate', () => {
    expect(passRateDomain([99.1, null, 100])).toEqual({ min: 98, max: 100 })
    expect(passRateDomain([100, 100])).toEqual({ min: 99, max: 100 })
  })

  it('uses the full range when there are no rates', () => {
    expect(passRateDomain([null])).toEqual({ min: 0, max: 100 })
  })
})

describe('truncateLabel', () => {
  it('keeps short labels and ellipsizes long ones', () => {
    expect(truncateLabel('F63.2', 10)).toBe('F63.2')
    expect(truncateLabel('IWW Pump Station', 8)).toBe('IWW Pum…')
    expect(truncateLabel('Other (2 buildings)', 7)).toBe('Other…')
  })
})

describe('ordinalOpacity', () => {
  it('ramps evenly from 0.35 for the first step to 1 for the last', () => {
    expect([0, 1, 2, 3, 4].map((index) => ordinalOpacity(index, 5))).toEqual([0.35, 0.5125, 0.675, 0.8375, 1])
    expect([0, 1, 2].map((index) => ordinalOpacity(index, 3))).toEqual([0.35, 0.675, 1])
  })

  it('is fully opaque for a single step', () => {
    expect(ordinalOpacity(0, 1)).toBe(1)
  })
})

describe('round', () => {
  it('rounds to hundredths for SVG coordinates', () => {
    expect(round(88.4999)).toBe(88.5)
    expect(round(1 / 3)).toBe(0.33)
    expect(round(-2.005)).toBe(-2)
  })
})

describe('alignedScale', () => {
  it('takes the given number of steps with the smallest nice step that reaches the maximum', () => {
    expect(alignedScale(4, 3)).toEqual({ max: 6, ticks: [0, 2, 4, 6] })
    expect(alignedScale(51, 4)).toEqual({ max: 80, ticks: [0, 20, 40, 60, 80] })
    expect(alignedScale(300, 3)).toEqual({ max: 300, ticks: [0, 100, 200, 300] })
  })

  it('never steps by less than 1', () => {
    expect(alignedScale(2, 4)).toEqual({ max: 4, ticks: [0, 1, 2, 3, 4] })
  })

  it('treats a maximum of 0 as 1', () => {
    expect(alignedScale(0, 1)).toEqual({ max: 1, ticks: [0, 1] })
  })

  it('takes at least one step', () => {
    expect(alignedScale(5, 0)).toEqual({ max: 5, ticks: [0, 5] })
  })
})

describe('yearMarkers', () => {
  const years = (...list: number[]): Array<{ year: number }> => list.map((year) => ({ year }))

  it('marks only the first labelled index inside one year', () => {
    expect([...yearMarkers(new Set([1, 3, 5]), years(2026, 2026, 2026, 2026, 2026, 2026))]).toEqual([1])
  })

  it('marks the first labelled index of each new year', () => {
    expect([...yearMarkers([0, 2, 4, 6], years(2025, 2025, 2025, 2026, 2026, 2026, 2026))].sort()).toEqual([0, 4])
  })

  it('accepts labelled indices in any order', () => {
    expect([...yearMarkers(new Set([6, 0, 4, 2]), years(2025, 2025, 2025, 2026, 2026, 2026, 2026))].sort()).toEqual([0, 4])
  })

  it('skips a year that has no labelled index', () => {
    expect([...yearMarkers([0, 5], years(2024, 2024, 2025, 2025, 2026, 2026))].sort()).toEqual([0, 5])
  })

  it('is empty when nothing is labelled', () => {
    expect(yearMarkers([], years(2026, 2026)).size).toBe(0)
  })

  it('ignores labelled indices outside the weeks', () => {
    expect([...yearMarkers([-1, 1, 9], years(2026, 2026))]).toEqual([1])
  })
})
