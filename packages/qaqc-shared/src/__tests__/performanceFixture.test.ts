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
  return buildPerformanceModel(index, { selectedKey: CURRENT, windowEndKey: CURRENT, range }, group, minimum)
}

function percent(value: number | null): string {
  return value === null ? 'n/a' : `${value.toFixed(2)}%`
}

function qcrTable(rows: PerformanceRow[]): Array<[string, string, number, number, string]> {
  return rows.map((row) => [row.name, row.tags.join('/'), row.volume, row.ncrs, percent(row.rate)])
}

function welderTable(rows: PerformanceRow[]): Array<[string, number, number, string]> {
  return rows.map((row) => [row.name, row.volume, row.ncrs, percent(row.rate)])
}

function sums(rows: PerformanceRow[]): { people: number; volume: number; ncrs: number } {
  return {
    people: rows.length,
    volume: rows.reduce((sum, row) => sum + row.volume, 0),
    ncrs: rows.reduce((sum, row) => sum + row.ncrs, 0),
  }
}

function rankedOnlyRate(rows: PerformanceRow[]): string {
  const { volume, ncrs } = sums(rows)
  return percent((ncrs / volume) * 100)
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

describe('QAQC Performance fixture: pseudonyms', () => {
  it('holds 17 QCR/FE groups, numbered QCR 01 to QCR 17', () => {
    const names = pseudonyms([...split.electrical, ...split.mechanical], COLUMNS.qcr)
    expect([...names].sort()).toEqual(Array.from({ length: 17 }, (_, item) => `QCR ${String(item + 1).padStart(2, '0')}`))
  })

  it('indexes the 11 QCR/FE groups with finals, leaving out the 6 with only SORs', () => {
    const indexed = index.qcr.map((person) => person.name).sort()
    expect(indexed).toEqual(['QCR 01', 'QCR 02', 'QCR 03', 'QCR 04', 'QCR 05', 'QCR 06', 'QCR 07', 'QCR 08', 'QCR 10', 'QCR 11', 'QCR 15'])
  })

  it('holds 74 welder groups, numbered Welder 001 to Welder 074', () => {
    const names = pseudonyms(split.welding, COLUMNS.welder)
    expect([...names].sort()).toEqual(Array.from({ length: 74 }, (_, item) => `Welder ${String(item + 1).padStart(3, '0')}`))
    expect(index.welders).toHaveLength(74)
  })

  it('has no Not recorded part inside a welder list', () => {
    const parts = split.welding
      .map((row) => row[COLUMNS.welder])
      .filter((cell): cell is string => typeof cell === 'string' && cell.includes(','))
      .flatMap((cell) => cell.split(','))
    expect(parts.length).toBeGreaterThan(0)
    expect(parts.filter((part) => isNotRecorded(part))).toEqual([])
  })

  it('logs the WW08 2026 Not recorded NCR as Mechanical, under NA', () => {
    const notRecordedNcrs = [...split.electrical, ...split.mechanical].filter(
      (row) => classifyPhase(row[COLUMNS.phase]) === 'final' && isIssueFound(row[COLUMNS.issue]) && isNotRecorded(row[COLUMNS.qcr]),
    )
    expect(notRecordedNcrs.map((row) => [row[COLUMNS.source], row[COLUMNS.workWeek], row[COLUMNS.qcr]])).toEqual([
      ['Mechanical', "WW08'2026", 'NA'],
    ])
  })
})

describe('QAQC Performance fixture: QCR / FE, minimum finals 5', () => {
  const recent = model('qcr', 'recent')
  const all = model('qcr', 'all')

  it('ranks the 30 WW period WW13 to WW42', () => {
    expect([recent.window.first.label, recent.window.last.label]).toEqual(["WW13'2026", "WW42'2026"])
    expect(qcrTable(recent.ranked)).toEqual([
      ['QCR 02', 'E', 65, 2, '3.08%'],
      ['QCR 01', 'E', 94, 0, '0.00%'],
      ['QCR 04', 'E', 22, 0, '0.00%'],
      ['QCR 05', 'M', 12, 0, '0.00%'],
      ['QCR 06', 'M', 13, 0, '0.00%'],
      ['QCR 07', 'M', 5, 0, '0.00%'],
    ])
  })

  it('puts 4 people below the minimum in 30 WW', () => {
    expect(recent.belowMinimum.map((row) => row.name).sort()).toEqual(['QCR 08', 'QCR 10', 'QCR 11', 'QCR 15'])
    expect(sums(recent.belowMinimum)).toEqual({ people: 4, volume: 10, ncrs: 0 })
  })

  it('has no Not recorded row in 30 WW', () => {
    expect(recent.notRecorded).toBeNull()
  })

  it('ranks the All period from WW51 2025', () => {
    expect([all.window.first.label, all.window.last.label]).toEqual(["WW51'2025", "WW42'2026"])
    expect(qcrTable(all.ranked)).toEqual([
      ['QCR 02', 'E', 70, 2, '2.86%'],
      ['QCR 01', 'E', 94, 0, '0.00%'],
      ['QCR 03', 'E', 39, 0, '0.00%'],
      ['QCR 04', 'E', 31, 0, '0.00%'],
      ['QCR 05', 'M', 12, 0, '0.00%'],
      ['QCR 06', 'M', 14, 0, '0.00%'],
      ['QCR 07', 'M', 5, 0, '0.00%'],
    ])
  })

  it('puts 4 people below the minimum in All', () => {
    expect(all.belowMinimum.map((row) => row.name).sort()).toEqual(['QCR 08', 'QCR 10', 'QCR 11', 'QCR 15'])
    expect(sums(all.belowMinimum)).toEqual({ people: 4, volume: 10, ncrs: 0 })
  })

  it('has 7 Not recorded finals in All, with 1 NCR', () => {
    expect(all.notRecorded).toMatchObject({ volume: 7, ncrs: 1 })
  })

  it('logs the one Not recorded NCR in WW08 2026', () => {
    const week = index.positionByKey.get(202608) ?? -1
    expect(index.notRecorded.qcr.ncrs[week]).toBe(1)
  })

  it('splits the Not recorded finals as the spec does', () => {
    const qcrOf = (rows: Array<ReadonlyArray<unknown>>): unknown[] => rows.map((row) => row[COLUMNS.qcr])
    expect(qcrOf(notRecordedFinals(split.electrical))).toEqual(['N/A'])
    expect(qcrOf(notRecordedFinals(split.mechanical))).toEqual(['NA', 'NA', 'NA', 'NA', 'NA', 'NA'])
  })

  it('tags nobody with both disciplines', () => {
    expect(index.qcr.filter((person) => person.disciplines.length === 2)).toEqual([])
    expect([...all.ranked, ...all.belowMinimum].filter((row) => row.tags.length === 2)).toEqual([])
  })

  it('totals the summary strip over the whole group', () => {
    expect([recent.summary.peopleRanked, recent.summary.volume, recent.summary.ncrs, percent(recent.summary.rate)]).toEqual([6, 221, 2, '0.90%'])
    expect([all.summary.peopleRanked, all.summary.volume, all.summary.ncrs, percent(all.summary.rate)]).toEqual([7, 282, 3, '1.06%'])
  })

  it('matches the bracketed ranked-only sums', () => {
    expect([sums(recent.ranked).volume, sums(recent.ranked).ncrs, rankedOnlyRate(recent.ranked)]).toEqual([211, 2, '0.95%'])
    expect([sums(all.ranked).volume, sums(all.ranked).ncrs, rankedOnlyRate(all.ranked)]).toEqual([265, 2, '0.75%'])
  })
})

describe('QAQC Performance fixture: welders, minimum welds 10', () => {
  const recent = model('welders', 'recent')
  const all = model('welders', 'all')

  it('ranks the 30 WW top 10', () => {
    expect(welderTable(recent.ranked.slice(0, 10))).toEqual([
      ['Welder 024', 22, 3, '13.64%'],
      ['Welder 028', 22, 2, '9.09%'],
      ['Welder 043', 12, 1, '8.33%'],
      ['Welder 016', 41, 2, '4.88%'],
      ['Welder 020', 29, 1, '3.45%'],
      ['Welder 019', 30, 1, '3.33%'],
      ['Welder 006', 72, 1, '1.39%'],
      ['Welder 001', 165, 0, '0.00%'],
      ['Welder 002', 111, 0, '0.00%'],
      ['Welder 003', 102, 0, '0.00%'],
    ])
  })

  it('ranks the All top 10', () => {
    expect(welderTable(all.ranked.slice(0, 10))).toEqual([
      ['Welder 024', 27, 3, '11.11%'],
      ['Welder 028', 22, 2, '9.09%'],
      ['Welder 043', 12, 1, '8.33%'],
      ['Welder 016', 41, 2, '4.88%'],
      ['Welder 020', 29, 1, '3.45%'],
      ['Welder 019', 30, 1, '3.33%'],
      ['Welder 006', 72, 1, '1.39%'],
      ['Welder 001', 179, 0, '0.00%'],
      ['Welder 002', 111, 0, '0.00%'],
      ['Welder 003', 102, 0, '0.00%'],
    ])
  })

  it('ranks 38 and 45 welders, with 27 and 29 below the minimum', () => {
    expect([recent.ranked.length, recent.belowMinimum.length]).toEqual([38, 27])
    expect([all.ranked.length, all.belowMinimum.length]).toEqual([45, 29])
  })

  it('has one Not recorded weld in each period, with a blank Welder', () => {
    expect(recent.notRecorded?.volume).toBe(1)
    expect(all.notRecorded?.volume).toBe(1)
    const blankWelds = split.welding.filter((row) => isNotRecorded(row[COLUMNS.welder]))
    expect(blankWelds.map((row) => row[COLUMNS.welder] ?? '')).toEqual([''])
  })

  it('counts 89 and 131 welds listing more than one welder', () => {
    expect([recent.sharedWelds, all.sharedWelds]).toEqual([89, 131])
  })

  it('credits the 11 issue welds once each, since none lists more than one welder', () => {
    for (const period of [recent, all]) {
      const credited = sums([...period.ranked, ...period.belowMinimum]).ncrs + (period.notRecorded?.ncrs ?? 0)
      expect(credited).toBe(11)
    }
  })

  it('totals the summary strip over distinct welds', () => {
    expect([recent.summary.peopleRanked, recent.summary.volume, recent.summary.ncrs, percent(recent.summary.rate)]).toEqual([38, 1570, 11, '0.70%'])
    expect([all.summary.peopleRanked, all.summary.volume, all.summary.ncrs, percent(all.summary.rate)]).toEqual([45, 1751, 11, '0.63%'])
  })

  it('matches the bracketed ranked-only credited sums', () => {
    expect([sums(recent.ranked).volume, sums(recent.ranked).ncrs, rankedOnlyRate(recent.ranked)]).toEqual([1542, 11, '0.71%'])
    expect([sums(all.ranked).volume, sums(all.ranked).ncrs, rankedOnlyRate(all.ranked)]).toEqual([1762, 11, '0.62%'])
  })
})
