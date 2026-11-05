import { describe, expect, it } from 'vitest'

import { splitCombinedRows } from '../combined'
import { classifyPhase, isIssueFound } from '../inspections'
import { buildPerformanceIndex, buildPerformanceModel, isNotRecorded } from '../performance'
import type { PerformanceModel, PerformanceRow } from '../performance'
import type { CombinedColumns, RangeMode } from '../types'
import { COMBINED_COLUMNS, COMBINED_ROWS } from './fixtures/combinedRows'

type CombinedColumnName = (typeof COMBINED_COLUMNS)[number]

function position(name: CombinedColumnName): number {
  return COMBINED_COLUMNS.indexOf(name)
}

const COLUMNS: CombinedColumns = {
  source: position('Source'),
  workWeek: position('Work Week'),
  phase: position('Inspection Phase'),
  issue: position('Issue'),
  building: position('Building'),
  qcr: position('QCR/FE'),
  welder: position('Welder'),
  tagNo: position('Tag No'),
  signature: position('Signature'),
  signedWeek: position('Work Week Signed'),
  id: position('ID'),
  status: position('Status'),
  type: position('Type'),
  createdOn: position('Created On'),
  updatedOn: position('Updated On'),
  createdBy: position('Created By'),
  rootCause: position('Root Cause'),
  greenTags: -1,
}
const TODAY = new Date(2026, 9, 15) // WW42'2026
const CURRENT = 202642
const QCR_MINIMUM = 5
const WELDER_MINIMUM = 10

const split = splitCombinedRows(COMBINED_ROWS, COLUMNS.source)
const index = buildPerformanceIndex(split, COLUMNS, TODAY)

function model(group: 'qcr' | 'welders', range: RangeMode): PerformanceModel {
  const minimum = group === 'qcr' ? QCR_MINIMUM : WELDER_MINIMUM
  return buildPerformanceModel(index, { selectedKey: CURRENT, windowEndKey: CURRENT, range, dateRange: null }, group, minimum)
}

function percent(value: number | null): string {
  return value === null ? 'n/a' : `${value.toFixed(2)}%`
}

function qcrTable(rows: PerformanceRow[]): Array<[string, string, number, number, string]> {
  return rows.map((row) => [row.name, row.tags.join('/'), row.volume, row.ncrs, percent(row.passRate)])
}

function welderTable(rows: PerformanceRow[]): Array<[string, number, number, string]> {
  return rows.map((row) => [row.name, row.volume, row.ncrs, percent(row.passRate)])
}

function sums(rows: PerformanceRow[]): { people: number; volume: number; ncrs: number } {
  return {
    people: rows.length,
    volume: rows.reduce((sum, row) => sum + row.volume, 0),
    ncrs: rows.reduce((sum, row) => sum + row.ncrs, 0),
  }
}

function rankedOnlyPassRate(rows: PerformanceRow[]): string {
  const { volume, ncrs } = sums(rows)
  return percent(((volume - ncrs) / volume) * 100)
}

/** Final rows of one source whose QCR/FE is Not recorded. */
function notRecordedFinals(rows: ReadonlyArray<ReadonlyArray<unknown>>): Array<ReadonlyArray<unknown>> {
  return rows.filter((row) => classifyPhase(row[COLUMNS.phase]) === 'final' && isNotRecorded(row[COLUMNS.qcr]))
}

/** The distinct pseudonyms in a column, over every row whatever its phase or week. */
function pseudonyms(rows: ReadonlyArray<ReadonlyArray<unknown>>, column: number): Set<string> {
  const names = new Set<string>()
  for (const row of rows) {
    for (const part of String(row[column] ?? '').split(',')) {
      if (!isNotRecorded(part)) names.add(part.trim())
    }
  }
  return names
}

/** How many times each spelling appears. */
function tally(values: unknown[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const value of values) {
    const spelling = String(value ?? '')
    counts[spelling] = (counts[spelling] ?? 0) + 1
  }
  return counts
}

// Expected values are pinned to the seeded synthetic fixtures from scripts/generate-qaqc-fixtures.mjs.
describe('QAQC Performance fixture: pseudonyms', () => {
  it('holds 17 QCR/FE groups, numbered QCR 01 to QCR 17', () => {
    const names = pseudonyms([...split.electrical, ...split.mechanical], COLUMNS.qcr)
    expect([...names].sort()).toEqual(Array.from({ length: 17 }, (_, item) => `QCR ${String(item + 1).padStart(2, '0')}`))
  })

  it('indexes the 15 QCR/FE groups with finals, leaving out the 2 with only SORs', () => {
    const indexed = index.qcr.map((person) => person.name).sort()
    expect(indexed).toEqual([
      'QCR 01', 'QCR 02', 'QCR 03', 'QCR 04', 'QCR 05', 'QCR 06', 'QCR 07', 'QCR 08', 'QCR 10', 'QCR 11', 'QCR 12', 'QCR 13',
      'QCR 14', 'QCR 15', 'QCR 17',
    ])
  })

  it('holds 62 welder groups, numbered Welder 001 to Welder 062', () => {
    const names = pseudonyms(split.welding, COLUMNS.welder)
    expect([...names].sort()).toEqual(Array.from({ length: 62 }, (_, item) => `Welder ${String(item + 1).padStart(3, '0')}`))
    expect(index.welders).toHaveLength(62)
  })

  it('has no Not recorded part inside a welder list', () => {
    const parts = split.welding
      .map((row) => row[COLUMNS.welder])
      .filter((cell): cell is string => typeof cell === 'string' && cell.includes(','))
      .flatMap((cell) => cell.split(','))
    expect(parts.length).toBeGreaterThan(0)
    expect(parts.filter((part) => isNotRecorded(part))).toEqual([])
  })

  it('logs five Not recorded NCRs: four blank Electrical, one Mechanical under NA', () => {
    const notRecordedNcrs = [...split.electrical, ...split.mechanical].filter(
      (row) => classifyPhase(row[COLUMNS.phase]) === 'final' && isIssueFound(row[COLUMNS.issue]) && isNotRecorded(row[COLUMNS.qcr]),
    )
    expect(notRecordedNcrs.map((row) => [row[COLUMNS.source], row[COLUMNS.workWeek], row[COLUMNS.qcr]])).toEqual([
      ['Electrical', "WW07'2026", null],
      ['Electrical', "WW10'2026", null],
      ['Electrical', "WW28'2026", null],
      ['Electrical', "WW41'2026", null],
      ['Mechanical', "WW06'2026", 'NA'],
    ])
  })
})

describe('QAQC Performance fixture: QCR / FE, minimum finals 5', () => {
  const recent = model('qcr', 'recent')
  const all = model('qcr', 'all')
  const belowMinimum = ['QCR 07', 'QCR 08', 'QCR 10', 'QCR 11', 'QCR 12', 'QCR 13', 'QCR 14', 'QCR 15', 'QCR 17']

  it('ranks the 30 WW period WW13 to WW42', () => {
    expect([recent.window.first.label, recent.window.last.label]).toEqual(["WW13'2026", "WW42'2026"])
    expect(qcrTable(recent.ranked)).toEqual([
      ['QCR 05', 'E', 6, 1, '83.33%'],
      ['QCR 04', 'E/M', 15, 1, '93.33%'],
      ['QCR 03', 'E/M', 24, 1, '95.83%'],
      ['QCR 02', 'E/M', 38, 1, '97.37%'],
      ['QCR 01', 'E/M', 46, 0, '100.00%'],
      ['QCR 06', 'E/M', 5, 0, '100.00%'],
    ])
  })

  it('puts 9 people below the minimum in 30 WW', () => {
    expect(recent.belowMinimum.map((row) => row.name).sort()).toEqual(belowMinimum)
    expect(sums(recent.belowMinimum)).toEqual({ people: 9, volume: 14, ncrs: 1 })
  })

  it('has 66 Not recorded finals in 30 WW, with 2 NCRs', () => {
    expect(recent.notRecorded).toMatchObject({ volume: 66, ncrs: 2 })
  })

  it('ranks the All period from WW51 2025', () => {
    expect([all.window.first.label, all.window.last.label]).toEqual(["WW51'2025", "WW42'2026"])
    expect(qcrTable(all.ranked)).toEqual([
      ['QCR 05', 'E/M', 8, 1, '87.50%'],
      ['QCR 04', 'E/M', 19, 1, '94.74%'],
      ['QCR 02', 'E/M', 47, 2, '95.74%'],
      ['QCR 03', 'E/M', 30, 1, '96.67%'],
      ['QCR 01', 'E/M', 63, 1, '98.41%'],
      ['QCR 06', 'E/M', 9, 0, '100.00%'],
    ])
  })

  it('puts 9 people below the minimum in All', () => {
    expect(all.belowMinimum.map((row) => row.name).sort()).toEqual(belowMinimum)
    expect(sums(all.belowMinimum)).toEqual({ people: 9, volume: 16, ncrs: 1 })
  })

  it('has 90 Not recorded finals in All, with 5 NCRs', () => {
    expect(all.notRecorded).toMatchObject({ volume: 90, ncrs: 5 })
  })

  it('logs the Not recorded NCRs in WW06, WW07, WW10, WW28 and WW41 2026', () => {
    const ncrWeeks = index.weeks.filter((_, position) => index.notRecorded.qcr.ncrs[position] > 0).map((week) => week.label)
    expect(ncrWeeks).toEqual(["WW06'2026", "WW07'2026", "WW10'2026", "WW28'2026", "WW41'2026"])
    for (const key of [202606, 202607, 202610, 202628, 202641]) {
      expect(index.notRecorded.qcr.ncrs[index.positionByKey.get(key) ?? -1]).toBe(1)
    }
  })

  it('splits the Not recorded finals as the spec does', () => {
    const qcrOf = (rows: Array<ReadonlyArray<unknown>>): unknown[] => rows.map((row) => row[COLUMNS.qcr])
    expect(tally(qcrOf(notRecordedFinals(split.electrical)))).toEqual({ '': 39, 'N/A': 17, NA: 17 })
    expect(tally(qcrOf(notRecordedFinals(split.mechanical)))).toEqual({ '': 11, 'N/A': 4, NA: 2 })
  })

  it('tags the 8 QCR/FE groups with finals in both disciplines', () => {
    const both = ['QCR 01', 'QCR 02', 'QCR 03', 'QCR 04', 'QCR 05', 'QCR 06', 'QCR 08', 'QCR 12']
    expect(index.qcr.filter((person) => person.disciplines.length === 2).map((person) => person.name).sort()).toEqual(both)
    expect([...all.ranked, ...all.belowMinimum].filter((row) => row.tags.length === 2).map((row) => row.name).sort()).toEqual(both)
  })

  it('totals the summary strip over the whole group', () => {
    expect([recent.summary.peopleRanked, recent.summary.volume, recent.summary.ncrs, percent(recent.summary.passRate)]).toEqual([6, 214, 7, '96.73%'])
    expect([all.summary.peopleRanked, all.summary.volume, all.summary.ncrs, percent(all.summary.passRate)]).toEqual([6, 282, 12, '95.74%'])
  })

  it('matches the bracketed ranked-only sums', () => {
    expect([sums(recent.ranked).volume, sums(recent.ranked).ncrs, rankedOnlyPassRate(recent.ranked)]).toEqual([134, 4, '97.01%'])
    expect([sums(all.ranked).volume, sums(all.ranked).ncrs, rankedOnlyPassRate(all.ranked)]).toEqual([176, 6, '96.59%'])
  })
})

describe('QAQC Performance fixture: welders, minimum welds 10', () => {
  const recent = model('welders', 'recent')
  const all = model('welders', 'all')

  it('ranks the 30 WW top 10, breaking the Welder 047 / Welder 048 tie by name', () => {
    expect(welderTable(recent.ranked.slice(0, 10))).toEqual([
      ['Welder 040', 19, 2, '89.47%'],
      ['Welder 047', 20, 1, '95.00%'],
      ['Welder 048', 20, 1, '95.00%'],
      ['Welder 033', 26, 1, '96.15%'],
      ['Welder 004', 61, 2, '96.72%'],
      ['Welder 027', 36, 1, '97.22%'],
      ['Welder 005', 49, 1, '97.96%'],
      ['Welder 001', 147, 1, '99.32%'],
      ['Welder 002', 75, 0, '100.00%'],
      ['Welder 003', 43, 0, '100.00%'],
    ])
  })

  it('ranks the All top 10', () => {
    expect(welderTable(all.ranked.slice(0, 10))).toEqual([
      ['Welder 040', 22, 3, '86.36%'],
      ['Welder 045', 15, 1, '93.33%'],
      ['Welder 027', 42, 2, '95.24%'],
      ['Welder 048', 24, 1, '95.83%'],
      ['Welder 047', 25, 1, '96.00%'],
      ['Welder 022', 27, 1, '96.30%'],
      ['Welder 033', 32, 1, '96.88%'],
      ['Welder 004', 72, 2, '97.22%'],
      ['Welder 005', 59, 1, '98.31%'],
      ['Welder 001', 173, 1, '99.42%'],
    ])
  })

  it('ranks 61 welders in each period, with Welder 054 below the minimum', () => {
    expect([recent.ranked.length, recent.belowMinimum.length]).toEqual([61, 1])
    expect([all.ranked.length, all.belowMinimum.length]).toEqual([61, 1])
    expect([welderTable(recent.belowMinimum), welderTable(all.belowMinimum)]).toEqual([
      [['Welder 054', 6, 0, '100.00%']],
      [['Welder 054', 7, 0, '100.00%']],
    ])
  })

  it('has five Not recorded welds in each period, four N/A and one blank', () => {
    expect(recent.notRecorded?.volume).toBe(5)
    expect(all.notRecorded?.volume).toBe(5)
    const blankWelds = split.welding.filter((row) => isNotRecorded(row[COLUMNS.welder]))
    expect(blankWelds.map((row) => row[COLUMNS.welder] ?? '')).toEqual(['N/A', '', 'N/A', 'N/A', 'N/A'])
  })

  it('counts 199 and 244 welds listing more than one welder', () => {
    expect([recent.sharedWelds, all.sharedWelds]).toEqual([199, 244])
  })

  it('credits each welder on a shared issue weld: 8 and 11 issue welds, 2 and 3 of them with two welders', () => {
    const credited = (period: PerformanceModel): number => sums([...period.ranked, ...period.belowMinimum]).ncrs + (period.notRecorded?.ncrs ?? 0)
    expect([recent.summary.ncrs, credited(recent)]).toEqual([8, 10])
    expect([all.summary.ncrs, credited(all)]).toEqual([11, 14])
  })

  it('totals the summary strip over distinct welds', () => {
    expect([recent.summary.peopleRanked, recent.summary.volume, recent.summary.ncrs, percent(recent.summary.passRate)]).toEqual([61, 1423, 8, '99.44%'])
    expect([all.summary.peopleRanked, all.summary.volume, all.summary.ncrs, percent(all.summary.passRate)]).toEqual([61, 1751, 11, '99.37%'])
  })

  it('matches the bracketed ranked-only credited sums', () => {
    expect([sums(recent.ranked).volume, sums(recent.ranked).ncrs, rankedOnlyPassRate(recent.ranked)]).toEqual([1615, 10, '99.38%'])
    expect([sums(all.ranked).volume, sums(all.ranked).ncrs, rankedOnlyPassRate(all.ranked)]).toEqual([1989, 14, '99.30%'])
  })
})
