import { describe, expect, it } from 'vitest'

import { formatCount, formatDelta, formatPercent, formatPointsDelta, formatSignoffRate, pluralize, signoffStatus, trendOf } from '../format'

describe('format', () => {
  it('formats counts with thousands separators', () => {
    expect(formatCount(1234567)).toBe('1,234,567')
  })

  it('formats percents and n/a', () => {
    expect(formatPercent(99.1596)).toBe('99.2%')
    expect(formatPercent(null)).toBe('n/a')
  })

  it('formats signed deltas against a week', () => {
    expect(formatDelta(3, 'WW41')).toBe('+3 vs WW41')
    expect(formatDelta(-3, 'WW41')).toBe('−3 vs WW41')
    expect(formatDelta(0, 'WW41')).toBe('No change vs WW41')
  })

  it('formats percentage-point deltas, rounding tiny changes', () => {
    expect(formatPointsDelta(0.0107)).toBe('+0.01 pts')
    expect(formatPointsDelta(-0.826)).toBe('−0.8 pts')
    expect(formatPointsDelta(0.001)).toBe('No change')
  })

  it('maps deltas to trends', () => {
    expect(trendOf(2)).toBe('up')
    expect(trendOf(-1)).toBe('down')
    expect(trendOf(0)).toBe('flat')
  })

  it('pluralizes', () => {
    expect(pluralize(1, 'row', 'rows')).toBe('row')
    expect(pluralize(2, 'row', 'rows')).toBe('rows')
  })
})

describe('signoffStatus', () => {
  it('is bad below 10%', () => {
    expect(signoffStatus(9.99)).toBe('bad')
  })

  it('is warn from 10% to under 15%', () => {
    expect(signoffStatus(10)).toBe('warn')
    expect(signoffStatus(14.99)).toBe('warn')
  })

  it('is good from 15%', () => {
    expect(signoffStatus(15)).toBe('good')
  })

  it('has no status without a rate', () => {
    expect(signoffStatus(null)).toBeUndefined()
  })
})

describe('formatSignoffRate', () => {
  it('truncates a sign-off rate under 10% to one decimal so it never reads 10%', () => {
    expect(formatSignoffRate(9.97)).toBe('9.9%')
    expect(formatSignoffRate(9.6)).toBe('9.6%')
    expect(formatSignoffRate((24 / 250) * 100)).toBe('9.6%')
    expect(formatSignoffRate((29 / 500) * 100)).toBe('5.8%')
  })

  it('shows a sign-off rate of 10% or more as a whole percent', () => {
    expect(formatSignoffRate(10)).toBe('10%')
    expect(formatSignoffRate(79.76)).toBe('80%')
  })

  it('shows n/a for a missing sign-off rate', () => {
    expect(formatSignoffRate(null)).toBe('n/a')
  })
})
