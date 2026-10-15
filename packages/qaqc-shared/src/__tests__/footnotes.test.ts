import { describe, expect, it } from 'vitest'

import { buildFootnotes } from '../footnotes'
import { buildInspectionIndex } from '../inspections'

const COLUMNS = { workWeek: 0, phase: 1, issue: 2, building: 3 }
const TODAY = new Date(2026, 9, 15)

describe('buildFootnotes', () => {
  it('is empty for clean data', () => {
    const index = buildInspectionIndex([["WW42'2026", 'Final', '', 'A']], COLUMNS, TODAY)
    expect(buildFootnotes(index, false)).toEqual([])
  })

  it('explains skipped, future, and row-limit rows', () => {
    const index = buildInspectionIndex(
      [['UPW', 'Final', '', 'A'], ['', 'SOR', '', 'A'], ["WW50'2026", 'Final', '', 'A']],
      COLUMNS,
      TODAY,
    )
    expect(buildFootnotes(index, true)).toEqual([
      'Showing the first 3 rows (Power BI data limit)',
      '2 rows skipped: unreadable work week',
      "1 row dated after WW42'2026 not counted",
    ])
  })
})
