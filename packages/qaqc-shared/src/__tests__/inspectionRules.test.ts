import { describe, expect, it } from 'vitest'

import { cellText, classifyPhase, isIssueFound, normalizeBuilding, UNSPECIFIED_BUILDING } from '../inspections'

describe('cellText', () => {
  it('trims strings and stringifies numbers and booleans', () => {
    expect(cellText('  F63.2 ')).toBe('F63.2')
    expect(cellText(42)).toBe('42')
    expect(cellText(true)).toBe('true')
  })

  it('returns an empty string for blanks and unsupported values', () => {
    expect(cellText(null)).toBe('')
    expect(cellText(undefined)).toBe('')
    expect(cellText({})).toBe('')
  })

  it('treats non-finite numbers as blank', () => {
    expect(cellText(Number.NaN)).toBe('')
    expect(cellText(Number.POSITIVE_INFINITY)).toBe('')
    expect(normalizeBuilding(Number.NaN)).toBe('Unspecified')
  })
})

describe('classifyPhase', () => {
  it('detects Finals regardless of case and spacing', () => {
    for (const value of ['Final', ' FINAL ', 'Final Inspection', 'final walk', 'Electrical final inspection']) {
      expect(classifyPhase(value)).toBe('final')
    }
  })

  it('detects SORs', () => {
    expect(classifyPhase('SOR')).toBe('sor')
    expect(classifyPhase(' sor ')).toBe('sor')
  })

  it('treats every other phase as other', () => {
    for (const value of ['N/A', '', null, 'Pressure Test', 'Finalized', 'Borescope']) {
      expect(classifyPhase(value)).toBe('other')
    }
  })
})

describe('isIssueFound', () => {
  it('counts any filled value except No Issue Found', () => {
    expect(isIssueFound('NCR')).toBe(true)
    expect(isIssueFound('GROUND TAIL NEEDS REMOVED')).toBe(true)
  })

  it('ignores No Issue Found and blanks', () => {
    expect(isIssueFound('No Issue Found')).toBe(false)
    expect(isIssueFound(' no issue found ')).toBe(false)
    expect(isIssueFound('')).toBe(false)
    expect(isIssueFound(null)).toBe(false)
  })
})

describe('normalizeBuilding', () => {
  it('trims names and labels blanks as Unspecified', () => {
    expect(normalizeBuilding(' F63.2 ')).toBe('F63.2')
    expect(normalizeBuilding('')).toBe(UNSPECIFIED_BUILDING)
    expect(normalizeBuilding(null)).toBe('Unspecified')
  })
})
