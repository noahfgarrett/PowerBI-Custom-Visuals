import { describe, expect, it } from 'vitest'

import {
  isLotusWorksIssueCreator,
  issueContractor,
  issueDiscipline,
  issueStatusKind,
  issueStatusLabel,
  issueSubtype,
  issueTitle,
} from '../issues'

describe('isLotusWorksIssueCreator', () => {
  it('includes any creator naming LotusWorks, ignoring case and punctuation', () => {
    expect(isLotusWorksIssueCreator('Jane Doe (LotusWorks)')).toBe(true)
    expect(isLotusWorksIssueCreator('LOTUSWORKS')).toBe(true)
    expect(isLotusWorksIssueCreator('lotusworks-inc')).toBe(true)
  })

  it('includes removed accounts of the two known LotusWorks creators', () => {
    expect(isLotusWorksIssueCreator('Samuel Leach (Removed)')).toBe(true)
    expect(isLotusWorksIssueCreator('removed: aaron   HARWOOD')).toBe(true)
  })

  it('excludes other removed accounts and the known names without Removed', () => {
    expect(isLotusWorksIssueCreator('Someone Else (Removed)')).toBe(false)
    expect(isLotusWorksIssueCreator('Samuel Leach (Bayside)')).toBe(false)
  })

  it('excludes blank and non-text creators', () => {
    expect(isLotusWorksIssueCreator('')).toBe(false)
    expect(isLotusWorksIssueCreator('   ')).toBe(false)
    expect(isLotusWorksIssueCreator(null)).toBe(false)
    expect(isLotusWorksIssueCreator(undefined)).toBe(false)
    expect(isLotusWorksIssueCreator('No')).toBe(false)
  })
})

describe('issueStatusKind', () => {
  it('reads void, closed and pending ignoring case and spacing', () => {
    expect(issueStatusKind(' Void ')).toBe('void')
    expect(issueStatusKind('CLOSED')).toBe('closed')
    expect(issueStatusKind('pending')).toBe('pending')
  })

  it('reads anything else, including blank, as open', () => {
    expect(issueStatusKind('Open')).toBe('open')
    expect(issueStatusKind('Not approved')).toBe('open')
    expect(issueStatusKind('Ready to Inspect')).toBe('open')
    expect(issueStatusKind('')).toBe('open')
    expect(issueStatusKind(null)).toBe('open')
  })
})

describe('issueStatusLabel', () => {
  it('keeps the trimmed status text as given', () => {
    expect(issueStatusLabel(' Ready to inspect ')).toBe('Ready to inspect')
    expect(issueStatusLabel('Closed')).toBe('Closed')
  })

  it('labels a blank status Open and any pending spelling Pending', () => {
    expect(issueStatusLabel('')).toBe('Open')
    expect(issueStatusLabel(null)).toBe('Open')
    expect(issueStatusLabel('PENDING')).toBe('Pending')
  })
})

describe('issueContractor', () => {
  it('keeps a populated contractor, trimmed', () => {
    expect(issueContractor('#1021', ' Bayside Corp ')).toBe('Bayside Corp')
  })

  it('defaults a blank contractor to Bayside when the ID ends in exactly 1021', () => {
    expect(issueContractor('#1021', '')).toBe('Bayside')
    expect(issueContractor('BIM-1021', null)).toBe('Bayside')
  })

  it('defaults other blank contractors to Unassigned', () => {
    expect(issueContractor('#11021', '')).toBe('Unassigned')
    expect(issueContractor('#1022', '  ')).toBe('Unassigned')
    expect(issueContractor('#1021a', '')).toBe('Unassigned')
    expect(issueContractor('', '')).toBe('Unassigned')
  })
})

describe('issue text defaults', () => {
  it('defaults a blank Type to Uncategorized', () => {
    expect(issueSubtype('COR')).toBe('COR')
    expect(issueSubtype('  ')).toBe('Uncategorized')
  })

  it('defaults a blank Discipline to Unassigned', () => {
    expect(issueDiscipline('Mechanical')).toBe('Mechanical')
    expect(issueDiscipline(null)).toBe('Unassigned')
  })

  it('defaults a blank Title to Untitled issue', () => {
    expect(issueTitle(' Leak at valve ')).toBe('Leak at valve')
    expect(issueTitle('')).toBe('Untitled issue')
  })
})
