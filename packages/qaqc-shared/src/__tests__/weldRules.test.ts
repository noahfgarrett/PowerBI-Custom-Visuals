import { describe, expect, it } from 'vitest'

import {
  isWeldIssue,
  isWeldSigned,
  normalizePipeSpec,
  normalizeSystem,
  SITE_GENERAL,
  UNSPECIFIED_WELD_VALUE,
  weldBuilding,
} from '../welds'

describe('weldBuilding', () => {
  it.each([
    ['BK1XX104XX-M006-B1.114006-200-0501-FW-01', 'BK1'],
    ['F631M008XX-P118-1803-FW-02', 'F631'],
    ['P4-WR1XX003-1-IW-0101-FW-04', 'WR1'],
    ['PS1XX102XX-M001-B1.114006-200-0501-FW-01', 'PS1'],
    ['P4-F632L002-1-SAN-0101-FW-03', 'F632'],
    ['PHT-F631M008XX-1803', 'F631'],
    ['P4-YARD1001-7-DW-0101-FW-01', SITE_GENERAL],
    ['BATCH-PLANT-FW-12A', SITE_GENERAL],
  ])('reads %s as %s', (tag, building) => {
    expect(weldBuilding(tag)).toBe(building)
  })

  it('trims the tag before matching', () => {
    expect(weldBuilding('  BK1XX104XX-M006-FW-01  ')).toBe('BK1')
  })

  it('is case-sensitive, so a lower-case tag is Site General', () => {
    expect(weldBuilding('bk1xx104xx-m006-fw-01')).toBe(SITE_GENERAL)
  })

  it('labels blank and non-text tags Site General', () => {
    expect(weldBuilding('')).toBe(SITE_GENERAL)
    expect(weldBuilding('   ')).toBe(SITE_GENERAL)
    expect(weldBuilding(null)).toBe(SITE_GENERAL)
    expect(weldBuilding(undefined)).toBe(SITE_GENERAL)
  })
})

describe('isWeldIssue', () => {
  it('counts any filled value, including a BIM number', () => {
    for (const value of ['BIM 1050', 'Yes 1050', 'yes', '#1006', 'Failed Cor #987', 'EF 2nd burn']) {
      expect(isWeldIssue(value)).toBe(true)
    }
  })

  it('ignores blanks and the explicit no values, in any case and spacing', () => {
    for (const value of ['no', 'No', ' NO ', 'n/a', 'N/A', 'na', 'NA', 'none', 'None', '-', '', '   ', null, undefined]) {
      expect(isWeldIssue(value)).toBe(false)
    }
  })

  it('does not treat words that merely contain no as no', () => {
    expect(isWeldIssue('Not welded')).toBe(true)
    expect(isWeldIssue('none found')).toBe(true)
  })
})

describe('isWeldSigned', () => {
  it('is true for any non-blank signature', () => {
    expect(isWeldSigned('signed')).toBe(true)
    expect(isWeldSigned(' A. Inspector ')).toBe(true)
  })

  it('is false for blanks', () => {
    expect(isWeldSigned('')).toBe(false)
    expect(isWeldSigned('   ')).toBe(false)
    expect(isWeldSigned(null)).toBe(false)
    expect(isWeldSigned(undefined)).toBe(false)
  })
})

describe('normalizeSystem and normalizePipeSpec', () => {
  it('trim and label blanks Unspecified', () => {
    expect(normalizeSystem(' AW ')).toBe('AW')
    expect(normalizeSystem('')).toBe(UNSPECIFIED_WELD_VALUE)
    expect(normalizeSystem(null)).toBe('Unspecified')
    expect(normalizePipeSpec(' PCH ')).toBe('PCH')
    expect(normalizePipeSpec('  ')).toBe('Unspecified')
    expect(normalizePipeSpec(undefined)).toBe('Unspecified')
  })
})
