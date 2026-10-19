import { describe, expect, it } from 'vitest'

import type { IssueColumns, ViewState } from '../types'
import type { ParetoModel } from '../rootCauses'
import { buildRootCausePareto, paretoIssues, readoutText } from '../rootCauses'
import { buildIssueIndex } from '../issues'
import { ISSUE_ROWS } from './fixtures/issueRows'

// The spec's Expected numbers → Pareto, plus the 30 WW views, derived by the mockup's compute2.py.

const COLUMNS: IssueColumns = {
  id: 0,
  title: 1,
  status: 2,
  type: 3,
  contractor: 4,
  createdOn: 5,
  updatedOn: 6,
  dueDate: 7,
  createdBy: 8,
  rootCause: 9,
  rootCauseCategory: 10,
}
const TODAY = new Date(2026, 9, 15) // WW42'2026
const WW42 = 202642
const ALL: ViewState = { selectedKey: WW42, windowEndKey: WW42, range: 'all' }
const RECENT: ViewState = { selectedKey: WW42, windowEndKey: WW42, range: 'recent' }
const index = buildIssueIndex(ISSUE_ROWS, COLUMNS, TODAY)

function barValues(model: ParetoModel): Array<[string, number]> {
  return model.bars.map((bar) => [bar.label, bar.count])
}

function categoryValues(model: ParetoModel): Array<[string, number]> {
  return (model.categories ?? []).map((slice) => [slice.label, slice.count])
}

describe("root cause Pareto, All and All issues, as of WW42'2026 (October export)", () => {
  const model = buildRootCausePareto(index, ALL, 'all', TODAY)

  it('covers 177 issues with 27 causes', () => {
    expect(model.total).toBe(177)
    expect(model.distinct).toBe(27)
  })

  it('has the top 9 causes and Other (18 causes), with Not recorded hidden at 0', () => {
    expect(barValues(model)).toEqual([
      ['Installation', 48],
      ['Coordination', 21],
      ['Casting/Pouring/Erection', 19],
      ['Incomplete Work', 18],
      ['Trade Damage', 10],
      ['Housekeeping', 9],
      ['Bonding', 5],
      ['Documentation Incomplete', 5],
      ['Quality', 5],
      ['Other (18 causes)', 37],
    ])
    expect(model.bars.some((bar) => bar.kind === 'notRecorded')).toBe(false)
  })

  it('has the top 9 adding up to 79.1%, so 80% is reached only inside Other', () => {
    expect(model.topNShare?.toFixed(1)).toBe('79.1')
    expect(model.crossIndex).toBe(9)
    expect(model.bars.every((bar) => bar.vital)).toBe(true)
  })

  it('reads out the top 9 share and the top cause', () => {
    expect(readoutText(model.readout)).toBe('The top 9 causes cover 79.1%; 80% is reached only inside Other. Installation is 48 of 177 (27.1%).')
  })

  it('splits the categories Quality 162 (91.5%), Design 10, Coordination 4, Safety 1', () => {
    expect(categoryValues(model)).toEqual([
      ['Quality', 162],
      ['Design', 10],
      ['Coordination', 4],
      ['Safety', 1],
    ])
    expect(model.categories?.[0].share.toFixed(1)).toBe('91.5')
  })

  it('folds 18 causes into Other, Workmanship first', () => {
    expect(model.otherCauses).toHaveLength(18)
    expect(model.otherCauses[0]).toEqual({ label: 'Workmanship', count: 5 })
    expect(model.otherCauses.reduce((sum, cause) => sum + cause.count, 0)).toBe(37)
  })

  it('drills Installation into 48 issues, 18 open and 30 closed', () => {
    const drill = paretoIssues(index, model.bars[0], ALL, 'all', TODAY)
    expect(drill).toHaveLength(48)
    expect(drill.filter((row) => row.isOpen)).toHaveLength(18)
    expect(drill.filter((row) => !row.isOpen)).toHaveLength(30)
  })

  it('orders the Installation drill-down open oldest first, then closed longest to close first', () => {
    const drill = paretoIssues(index, model.bars[0], ALL, 'all', TODAY)
    expect(drill.map((row) => `${row.issue.id} ${row.isOpen ? 'open' : 'closed'} ${row.days}`)).toEqual([
      '#815 open 380', '#816 open 380', '#817 open 380', '#818 open 380', '#819 open 380', '#821 open 380',
      '#847 open 377', '#861 open 366', '#865 open 358', '#866 open 358', '#869 open 357', '#872 open 356',
      '#879 open 351', '#880 open 351', '#890 open 351', '#900 open 344', '#901 open 344', '#989 open 129',
      '#623 closed 245', '#896 closed 126', '#897 closed 126', '#501 closed 121', '#591 closed 98', '#691 closed 67',
      '#695 closed 67', '#697 closed 67', '#698 closed 67', '#472 closed 60', '#693 closed 57', '#820 closed 50',
      '#626 closed 49', '#589 closed 46', '#867 closed 40', '#868 closed 40', '#616 closed 34', '#981 closed 27',
      '#761 closed 25', '#622 closed 13', '#763 closed 12', '#762 closed 11', '#630 closed 9', '#602 closed 8',
      '#614 closed 7', '#613 closed 6', '#766 closed 5', '#615 closed 4', '#551 closed 3', '#925 closed 2',
    ])
  })
})

describe("root cause Pareto, All and Open only, as of WW42'2026", () => {
  const model = buildRootCausePareto(index, ALL, 'open', TODAY)

  it('covers the 51 open issues with 18 causes', () => {
    expect(model.total).toBe(51)
    expect(model.distinct).toBe(18)
  })

  it('crosses 80% at Incomplete Work (82.4%)', () => {
    expect(model.crossIndex).toBe(8)
    const crossing = model.bars[8]
    expect(crossing.label).toBe('Incomplete Work')
    expect(crossing.cumulative?.toFixed(1)).toBe('82.4')
    expect(model.bars.map((bar) => bar.vital)).toEqual([true, true, true, true, true, true, true, true, true, false])
  })

  it('has Installation 18 and Other (9 causes) 9', () => {
    expect(model.bars[0]).toMatchObject({ label: 'Installation', count: 18 })
    expect(model.bars[9]).toMatchObject({ label: 'Other (9 causes)', count: 9 })
  })

  it('reads out the top 9 reaching 80%', () => {
    expect(readoutText(model.readout)).toBe('The top 9 causes cover 82.4%. Installation is 18 of 51 (35.3%).')
  })

  it('splits the open categories Quality 46, Design 3, Coordination 2', () => {
    expect(categoryValues(model)).toEqual([
      ['Quality', 46],
      ['Design', 3],
      ['Coordination', 2],
    ])
  })

  it('drills Installation into its 18 open issues', () => {
    const drill = paretoIssues(index, model.bars[0], ALL, 'open', TODAY)
    expect(drill).toHaveLength(18)
    expect(drill.every((row) => row.isOpen)).toBe(true)
  })
})

describe("root cause Pareto, 30 WW (WW13 to WW42'2026) and All issues", () => {
  const model = buildRootCausePareto(index, RECENT, 'all', TODAY)

  it('covers the 37 issues created in the 30 weeks with 19 causes', () => {
    expect(model.firstWeek.key).toBe(202613)
    expect(model.lastWeek.key).toBe(WW42)
    expect(model.total).toBe(37)
    expect(model.distinct).toBe(19)
  })

  it('keeps the literal Other cause as a bar beside Other (10 causes)', () => {
    expect(barValues(model)).toEqual([
      ['Bonding', 5],
      ['Trade Damage', 5],
      ['Housekeeping', 4],
      ['Casting/Pouring/Erection', 3],
      ['Excavation/Earthworks', 2],
      ['Fusion', 2],
      ['Installation', 2],
      ['Materials', 2],
      ['Other', 2],
      ['Other (10 causes)', 10],
    ])
    expect(model.bars[8].kind).toBe('cause')
    expect(model.bars[9].kind).toBe('other')
    expect(model.bars[8].key).not.toBe(model.bars[9].key)
  })

  it('has the top 9 adding up to 73.0%, so 80% is reached only inside Other', () => {
    expect(model.topNShare?.toFixed(1)).toBe('73.0')
    expect(model.crossIndex).toBe(9)
    expect(readoutText(model.readout)).toBe('The top 9 causes cover 73.0%; 80% is reached only inside Other. Bonding is 5 of 37 (13.5%).')
  })

  it('folds ten single-issue causes into Other', () => {
    expect(model.otherCauses.map((cause) => cause.label)).toEqual([
      'Coordination',
      'Equipment',
      'Manufacturer Defect',
      'Material - Material component failure',
      'Observation',
      'Planning',
      'Quality',
      'Rigging',
      'Weather',
      'Workmanship',
    ])
    expect(model.otherCauses.every((cause) => cause.count === 1)).toBe(true)
  })

  it('splits the categories Quality 36, Safety 1', () => {
    expect(categoryValues(model)).toEqual([
      ['Quality', 36],
      ['Safety', 1],
    ])
  })

  it('drills the literal Other cause into its own 2 issues, not the folded ones', () => {
    expect(paretoIssues(index, model.bars[8], RECENT, 'all', TODAY)).toHaveLength(2)
    expect(paretoIssues(index, model.bars[9], RECENT, 'all', TODAY)).toHaveLength(10)
  })
})

describe("root cause Pareto, 30 WW and Open only", () => {
  const model = buildRootCausePareto(index, RECENT, 'open', TODAY)

  it('covers 15 open issues with 12 causes', () => {
    expect(model.total).toBe(15)
    expect(model.distinct).toBe(12)
  })

  it('reaches exactly 80.0% at Planning, leaving Other (3 causes) muted', () => {
    expect(model.crossIndex).toBe(8)
    expect(model.bars[8]).toMatchObject({ label: 'Planning', cumulative: 80, vital: true })
    expect(model.bars[9]).toMatchObject({ label: 'Other (3 causes)', count: 3, vital: false })
    expect(readoutText(model.readout)).toBe('The top 9 causes cover 80.0%. Bonding is 2 of 15 (13.3%).')
  })
})
