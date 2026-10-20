import { describe, expect, it } from 'vitest'

import type { IssueColumns, IssueIndex, ViewState } from '../types'
import type { ParetoBar, ParetoModel } from '../rootCauses'
import { buildRootCausePareto, paretoIssues, readoutText, topCauseCreated } from '../rootCauses'
import { buildIssueIndex } from '../issues'

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
const TODAY = new Date(2026, 9, 15) // Thursday of WW42'2026
const WW42 = 202642
const ALL_TO_WW42: ViewState = { selectedKey: WW42, windowEndKey: WW42, range: 'all' }

type Cell = string | null

interface IssueOptions {
  closedOn?: string
  category?: string
}

/** An included issue created on an ISO date. `closedOn` makes it Closed with that Updated On. */
function issue(id: string, createdOn: string, cause: Cell, options: IssueOptions = {}): Cell[] {
  const closedOn = options.closedOn ?? null
  return [id, `Issue ${id}`, closedOn === null ? 'Open' : 'Closed', 'COR', 'Bayside', createdOn, closedOn, null, 'LotusWorks', cause, options.category ?? null]
}

function indexOf(rows: Cell[][], columns: IssueColumns = COLUMNS): IssueIndex {
  return buildIssueIndex(rows, columns, TODAY)
}

/** `count` issues with the same cause, created on consecutive September days from `firstDay`. */
function many(prefix: string, count: number, cause: Cell, firstDay = 1): Cell[][] {
  return Array.from({ length: count }, (_, at) => issue(`${prefix}${at}`, `2026-09-${String(firstDay + (at % 20)).padStart(2, '0')}`, cause))
}

function pareto(rows: Cell[][], scope: 'all' | 'open' = 'all', view: ViewState = ALL_TO_WW42): ParetoModel {
  return buildRootCausePareto(indexOf(rows), view, scope, TODAY)
}

function labels(model: ParetoModel): string[] {
  return model.bars.map((bar) => bar.label)
}

function barLabelled(model: ParetoModel, label: string): ParetoBar {
  const bar = model.bars.find((candidate) => candidate.label === label)
  if (bar === undefined) throw new Error(`no bar ${label}`)
  return bar
}

/** Ten causes C1…C10 with 10, 9, … 1 issues. */
function tenCauses(): Cell[][] {
  return Array.from({ length: 10 }, (_, at) => many(`C${at + 1}-`, 10 - at, `Cause ${at + 1}`)).flat()
}

describe('buildRootCausePareto grouping', () => {
  it('groups causes that differ only by case or spacing under the earliest-created spelling', () => {
    const model = pareto([
      issue('#3', '2026-09-03', 'INSTALLATION  error'),
      issue('#1', '2026-09-01', 'Installation Error'),
      issue('#2', '2026-09-02', '  installation error '),
    ])
    expect(model.bars).toHaveLength(1)
    expect(model.bars[0].label).toBe('Installation Error')
    expect(model.bars[0].count).toBe(3)
    expect(model.distinct).toBe(1)
  })

  it('sorts bars by count, most first', () => {
    const model = pareto([...many('A', 1, 'Alpha'), ...many('B', 3, 'Beta'), ...many('G', 2, 'Gamma')])
    expect(labels(model)).toEqual(['Beta', 'Gamma', 'Alpha'])
  })

  it('breaks count ties by name, numbers in order', () => {
    const model = pareto([...many('T', 2, 'Item 10'), ...many('S', 2, 'item 2'), ...many('R', 2, 'Beta')])
    expect(labels(model)).toEqual(['Beta', 'item 2', 'Item 10'])
  })

  it('counts every issue in scope as the total and shares each bar of it', () => {
    const model = pareto([...many('A', 3, 'Alpha'), ...many('B', 1, 'Beta')])
    expect(model.total).toBe(4)
    expect(model.bars.map((bar) => bar.share)).toEqual([75, 25])
  })
})

describe('buildRootCausePareto Other', () => {
  it('keeps the top 9 causes and folds the rest into Other (n causes)', () => {
    const model = pareto([...tenCauses(), ...many('X', 1, 'Cause 11')])
    expect(labels(model)).toEqual([...Array.from({ length: 9 }, (_, at) => `Cause ${at + 1}`), 'Other (2 causes)'])
    const other = model.bars[9]
    expect(other.kind).toBe('other')
    expect(other.count).toBe(2)
    expect(other.causes).toEqual(['Cause 10', 'Cause 11'])
  })

  it('names a single folded cause in the singular', () => {
    const model = pareto(tenCauses())
    expect(model.bars[model.bars.length - 1].label).toBe('Other (1 cause)')
  })

  it('has no Other bar with 9 causes or fewer', () => {
    const model = pareto(Array.from({ length: 9 }, (_, at) => many(`C${at}-`, 1, `Cause ${at}`)).flat())
    expect(model.bars).toHaveLength(9)
    expect(model.bars.every((bar) => bar.kind === 'cause')).toBe(true)
    expect(model.otherCauses).toEqual([])
  })

  it('lists the causes inside Other largest first, ties by name', () => {
    const model = pareto([
      ...Array.from({ length: 9 }, (_, at) => many(`C${at}-`, 5, `Cause ${at}`)).flat(),
      ...many('Z', 1, 'Zulu'),
      ...many('Y', 2, 'Yankee'),
      ...many('X', 1, 'Xray'),
    ])
    expect(model.otherCauses).toEqual([
      { label: 'Yankee', count: 2 },
      { label: 'Xray', count: 1 },
      { label: 'Zulu', count: 1 },
    ])
  })

  it('keeps a cause literally named Other apart from the Other bar', () => {
    const model = pareto([...tenCauses(), ...many('O', 20, 'Other')])
    expect(model.bars[0]).toMatchObject({ label: 'Other', kind: 'cause', count: 20 })
    const keys = model.bars.map((bar) => bar.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('buildRootCausePareto Not recorded', () => {
  const model = pareto([...many('A', 6, 'Alpha'), ...many('B', 2, 'Beta'), ...many('N', 2, null), issue('#E', '2026-09-30', '   ')])

  it('adds a grey Not recorded bar last for blank causes', () => {
    expect(labels(model)).toEqual(['Alpha', 'Beta', 'Not recorded'])
    expect(model.bars[2]).toMatchObject({ kind: 'notRecorded', count: 3, causes: [] })
  })

  it('keeps Not recorded out of the cumulative and the vital bars', () => {
    expect(model.bars.map((bar) => bar.cumulative)).toEqual([75, 100, null])
    expect(model.bars[2].vital).toBe(false)
  })

  it('shares Not recorded of every issue in scope', () => {
    expect(model.total).toBe(11)
    expect(model.bars[2].share).toBeCloseTo((3 / 11) * 100, 10)
  })

  it('does not count Not recorded as a distinct cause', () => {
    expect(model.distinct).toBe(2)
  })

  it('hides Not recorded when every cause is recorded', () => {
    expect(labels(pareto(many('A', 2, 'Alpha')))).toEqual(['Alpha'])
  })
})

describe('buildRootCausePareto 80% split', () => {
  it('marks bars vital up to and including the one where the cumulative first reaches 80%', () => {
    // 50, 70, 85, 95, 100
    const model = pareto([...many('A', 10, 'A'), ...many('B', 4, 'B'), ...many('C', 3, 'C'), ...many('D', 2, 'D'), ...many('E', 1, 'E')])
    expect(model.bars.map((bar) => bar.vital)).toEqual([true, true, true, false, false])
    expect(model.crossIndex).toBe(2)
  })

  it('counts exactly 80% as reached', () => {
    const model = pareto([...many('A', 4, 'A'), ...many('B', 1, 'B')])
    expect(model.bars[0].cumulative).toBe(80)
    expect(model.bars.map((bar) => bar.vital)).toEqual([true, false])
    expect(model.crossIndex).toBe(0)
  })

  it('makes Other vital when 80% is reached only inside it', () => {
    const model = pareto(Array.from({ length: 12 }, (_, at) => many(`C${at}-`, 1, `Cause ${at}`)).flat())
    expect(model.crossIndex).toBe(9)
    expect(model.bars.every((bar) => bar.vital)).toBe(true)
    expect(model.topNShare).toBe(75)
  })

  it('gives the top causes their running share of the recorded causes', () => {
    const model = pareto([...many('A', 6, 'A'), ...many('B', 3, 'B'), ...many('C', 1, 'C')])
    expect(model.topNShare).toBe(100)
    expect(model.bars.map((bar) => bar.cumulative)).toEqual([60, 90, 100])
  })
})

describe('buildRootCausePareto period and scope', () => {
  it('includes only issues created from the window start through W', () => {
    const rows = [
      issue('#old', '2025-01-06', 'Old'),
      issue('#in', '2026-08-03', 'Recent'),
      issue('#late', '2026-10-13', 'Late'),
    ]
    const ww40: ViewState = { selectedKey: 202640, windowEndKey: WW42, range: 'recent' }
    expect(labels(pareto(rows, 'all', ww40))).toEqual(['Recent'])
    expect(labels(pareto(rows, 'all', { ...ww40, range: 'all' }))).toEqual(['Old', 'Recent'])
  })

  it('keeps only issues open as of W for Open only', () => {
    const model = pareto(
      [
        issue('#open', '2026-08-03', 'Open cause'),
        issue('#closed', '2026-08-03', 'Closed cause', { closedOn: '2026-08-20' }),
        issue('#later', '2026-08-03', 'Closed later', { closedOn: '2026-10-14' }),
      ],
      'open',
      { selectedKey: 202640, windowEndKey: WW42, range: 'all' },
    )
    expect(labels(model).sort()).toEqual(['Closed later', 'Open cause'])
    expect(model.total).toBe(2)
  })

  it('is empty without issues in the period', () => {
    const model = pareto([issue('#old', '2024-01-08', 'Old')], 'all', { selectedKey: WW42, windowEndKey: WW42, range: 'recent' })
    expect(model.bars).toEqual([])
    expect(model.total).toBe(0)
    expect(model.distinct).toBe(0)
    expect(model.topNShare).toBeNull()
    expect(model.crossIndex).toBeNull()
    expect(model.readout).toEqual([])
  })

  it('has no cumulative crossing when every cause is Not recorded', () => {
    const model = pareto(many('N', 3, null))
    expect(labels(model)).toEqual(['Not recorded'])
    expect(model.crossIndex).toBeNull()
    expect(model.topNShare).toBeNull()
    expect(model.readout).toEqual([])
  })
})

describe('buildRootCausePareto categories', () => {
  it('is null when Root Cause Category is unbound', () => {
    const index = indexOf([issue('#1', '2026-09-01', 'Alpha', { category: 'Quality' })], { ...COLUMNS, rootCauseCategory: -1 })
    expect(buildRootCausePareto(index, ALL_TO_WW42, 'all', TODAY).categories).toBeNull()
  })

  it('groups categories by count, ties by name, with Not recorded last', () => {
    const model = pareto([
      issue('#1', '2026-09-01', 'A', { category: 'Quality' }),
      issue('#2', '2026-09-02', 'A', { category: 'quality ' }),
      issue('#3', '2026-09-03', 'A'),
      issue('#4', '2026-09-04', 'A'),
      issue('#5', '2026-09-05', 'A'),
      issue('#6', '2026-09-06', 'A', { category: 'Safety' }),
      issue('#7', '2026-09-07', 'A', { category: 'Design' }),
    ])
    expect(model.categories?.map((slice) => [slice.label, slice.count])).toEqual([
      ['Quality', 2],
      ['Design', 1],
      ['Safety', 1],
      ['Not recorded', 3],
    ])
    expect(model.categories?.[0].share).toBeCloseTo((2 / 7) * 100, 10)
  })
})

describe('buildRootCausePareto read-out', () => {
  it('gives each line its subject apart from the rest of the sentence', () => {
    const model = pareto([...many('A', 10, 'Alpha'), ...many('B', 4, 'Beta'), ...many('C', 3, 'Gamma'), ...many('D', 3, 'Delta')])
    expect(model.readout).toEqual([
      { lead: 'The top 3 causes', rest: ' cover 85.0%.' },
      { lead: 'Alpha', rest: ' is 10 of 20 (50.0%).' },
    ])
  })

  it('gives the Other line its subject too', () => {
    const model = pareto(Array.from({ length: 12 }, (_, at) => many(`C${at}-`, 1, `Cause ${at}`)).flat())
    expect(model.readout[0]).toEqual({ lead: 'The top 9 causes', rest: ' cover 75.0%; 80% is reached only inside Other.' })
  })

  it('names how many top causes cover 80% when it is reached inside the top 9', () => {
    const model = pareto([...many('A', 10, 'Alpha'), ...many('B', 4, 'Beta'), ...many('C', 3, 'Gamma'), ...many('D', 3, 'Delta')])
    expect(readoutText(model.readout)).toBe('The top 3 causes cover 85.0%. Alpha is 10 of 20 (50.0%).')
  })

  it('reads the single top cause in the singular', () => {
    expect(readoutText(pareto([...many('A', 9, 'Alpha'), ...many('B', 1, 'Beta')]).readout)).toBe('The top cause covers 90.0%. Alpha is 9 of 10 (90.0%).')
  })

  it('says 80% is reached only inside Other when the top 9 fall short', () => {
    const model = pareto(Array.from({ length: 12 }, (_, at) => many(`C${at}-`, 1, `Cause ${at}`)).flat())
    expect(readoutText(model.readout)).toBe('The top 9 causes cover 75.0%; 80% is reached only inside Other. Cause 0 is 1 of 12 (8.3%).')
  })

  it('groups the thousands in the top cause counts', () => {
    const model = pareto([...many('A', 1200, 'Alpha'), ...many('B', 300, 'Beta')])
    expect(model.readout[1]).toEqual({ lead: 'Alpha', rest: ' is 1,200 of 1,500 (80.0%).' })
  })

  it('counts Not recorded issues in the top cause share', () => {
    expect(readoutText(pareto([...many('A', 3, 'Alpha'), ...many('N', 1, null)]).readout)).toBe('The top cause covers 100.0%. Alpha is 3 of 4 (75.0%).')
  })
})

describe('paretoIssues', () => {
  const rows = [
    issue('#1', '2026-08-03', 'Alpha', { closedOn: '2026-08-13' }),
    issue('#2', '2026-07-01', 'Alpha'),
    issue('#3', '2026-09-01', 'alpha'),
    issue('#4', '2026-06-01', 'Alpha', { closedOn: '2026-08-01' }),
    issue('#5', '2026-08-01', 'Alpha', { closedOn: '2026-10-14' }),
    issue('#6', '2026-09-01', 'Beta'),
    issue('#7', '2026-09-01', null),
  ]
  const index = indexOf(rows)
  const model = buildRootCausePareto(index, { selectedKey: 202641, windowEndKey: WW42, range: 'all' }, 'all', TODAY)
  const view: ViewState = { selectedKey: 202641, windowEndKey: WW42, range: 'all' }

  it('lists open issues oldest first, then closed issues longest to close first', () => {
    const drill = paretoIssues(index, barLabelled(model, 'Alpha'), view, 'all', TODAY)
    expect(drill.map((row) => row.issue.id)).toEqual(['#2', '#5', '#3', '#4', '#1'])
    expect(drill.map((row) => row.isOpen)).toEqual([true, true, true, false, false])
  })

  it('gives open issues their age at the end of W and closed issues their days to close', () => {
    // WW41'2026 ends on Sunday 2026-10-11.
    const drill = paretoIssues(index, barLabelled(model, 'Alpha'), view, 'all', TODAY)
    expect(drill.map((row) => row.days)).toEqual([102, 71, 40, 61, 10])
  })

  it('keeps only open issues for Open only', () => {
    const openModel = buildRootCausePareto(index, view, 'open', TODAY)
    const drill = paretoIssues(index, barLabelled(openModel, 'Alpha'), view, 'open', TODAY)
    expect(drill.map((row) => row.issue.id)).toEqual(['#2', '#5', '#3'])
  })

  it('lists the Not recorded issues for the Not recorded bar', () => {
    const drill = paretoIssues(index, barLabelled(model, 'Not recorded'), view, 'all', TODAY)
    expect(drill.map((row) => row.issue.id)).toEqual(['#7'])
  })

  it('lists an issue created later in W than today as open and 0 days old', () => {
    // Saturday 2026-10-17 is in WW42, after today, so the end of W is today.
    const futureIndex = indexOf([issue('#sat', '2026-10-17', 'Alpha'), issue('#mon', '2026-10-12', 'Alpha')])
    const futureModel = buildRootCausePareto(futureIndex, ALL_TO_WW42, 'all', TODAY)
    const drill = paretoIssues(futureIndex, futureModel.bars[0], ALL_TO_WW42, 'all', TODAY)
    expect(drill.map((row) => [row.issue.id, row.isOpen, row.days])).toEqual([
      ['#mon', true, 3],
      ['#sat', true, 0],
    ])
  })

  it('lists every folded cause for the Other bar', () => {
    const foldedRows = [...tenCauses(), ...many('X', 2, 'Cause 11', 21)]
    const foldedIndex = indexOf(foldedRows)
    const folded = buildRootCausePareto(foldedIndex, ALL_TO_WW42, 'all', TODAY)
    const other = folded.bars[9]
    const drill = paretoIssues(foldedIndex, other, ALL_TO_WW42, 'all', TODAY)
    expect(drill).toHaveLength(3)
    expect(new Set(drill.map((row) => row.issue.rootCause))).toEqual(new Set(['Cause 10', 'Cause 11']))
  })
})

describe('topCauseCreated', () => {
  const WW41 = 202641

  it('counts issues created through W with their most common cause', () => {
    const rows = [...many('A', 3, 'Alpha'), ...many('B', 2, 'Beta'), ...many('N', 1, null)]
    expect(topCauseCreated(indexOf(rows), WW42, 'toDate')).toEqual({ total: 6, top: { label: 'Alpha', count: 3 } })
  })

  it('counts only the issues created in W for the week', () => {
    const rows = [
      issue('#1', '2026-10-06', 'Alpha'),
      issue('#2', '2026-10-12', 'Beta'),
      issue('#3', '2026-10-13', 'Beta'),
      issue('#4', '2026-10-13', null),
    ]
    expect(topCauseCreated(indexOf(rows), WW42, 'week')).toEqual({ total: 3, top: { label: 'Beta', count: 2 } })
    expect(topCauseCreated(indexOf(rows), WW41, 'week')).toEqual({ total: 1, top: { label: 'Alpha', count: 1 } })
  })

  it('leaves out issues created after W', () => {
    const rows = [issue('#1', '2026-10-06', 'Alpha'), issue('#2', '2026-10-12', 'Beta'), issue('#3', '2026-10-13', 'Beta')]
    expect(topCauseCreated(indexOf(rows), WW41, 'toDate')).toEqual({ total: 1, top: { label: 'Alpha', count: 1 } })
  })

  it('breaks a tie by name', () => {
    const rows = [...many('Z', 2, 'Zeta'), ...many('B', 2, 'beta')]
    expect(topCauseCreated(indexOf(rows), WW42, 'toDate').top).toEqual({ label: 'beta', count: 2 })
  })

  it('groups spellings under the earliest-created one, like the Pareto', () => {
    const rows = [issue('#2', '2026-09-02', 'INSTALLATION'), issue('#1', '2026-09-01', 'Installation')]
    expect(topCauseCreated(indexOf(rows), WW42, 'toDate').top).toEqual({ label: 'Installation', count: 2 })
  })

  it('has no top cause when none is recorded', () => {
    expect(topCauseCreated(indexOf(many('N', 2, null)), WW42, 'toDate')).toEqual({ total: 2, top: null })
  })
})
