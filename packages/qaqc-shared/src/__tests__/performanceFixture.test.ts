import { describe, expect, it } from 'vitest'

import { splitCombinedRows } from '../combined'
import { classifyPhase } from '../inspections'
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

function qcrTable(rows: PerformanceRow[]): Array<[string, string, number, number, number, string]> {
  return rows.map((row) => [row.name, row.tags.join('/'), row.volume, row.sors, row.ncrs, percent(row.rate)])
}

function welderTable(rows: PerformanceRow[]): Array<[string, number, number, string]> {
  return rows.map((row) => [row.name, row.volume, row.ncrs, percent(row.rate)])
}

function sums(rows: PerformanceRow[]): { people: number; volume: number; sors: number; ncrs: number } {
  return {
    people: rows.length,
    volume: rows.reduce((sum, row) => sum + row.volume, 0),
    sors: rows.reduce((sum, row) => sum + row.sors, 0),
    ncrs: rows.reduce((sum, row) => sum + row.ncrs, 0),
  }
}

function rankedOnlyRate(rows: PerformanceRow[]): string {
  const { volume, ncrs } = sums(rows)
  return percent((ncrs / volume) * 100)
}

/** Final and SOR rows of one source whose QCR/FE is Not recorded. */
function notRecordedInspections(rows: ReadonlyArray<ReadonlyArray<unknown>>): Array<ReadonlyArray<unknown>> {
  return rows.filter((row) => classifyPhase(row[COLUMNS.phase]) !== 'other' && isNotRecorded(row[COLUMNS.qcr]))
}

describe('QAQC Performance fixture: QCR / FE, minimum finals 5', () => {
  const recent = model('qcr', 'recent')
  const all = model('qcr', 'all')

  it('ranks the 30 WW period WW13 to WW42', () => {
    expect([recent.window.first.label, recent.window.last.label]).toEqual(["WW13'2026", "WW42'2026"])
    expect(qcrTable(recent.ranked)).toEqual([
      ['QCR 02', 'E', 65, 0, 2, '3.08%'],
      ['QCR 01', 'E', 94, 0, 0, '0.00%'],
      ['QCR 04', 'E', 22, 0, 0, '0.00%'],
      ['QCR 05', 'M', 12, 2, 0, '0.00%'],
      ['QCR 06', 'M', 13, 1, 0, '0.00%'],
      ['QCR 07', 'M', 5, 0, 0, '0.00%'],
    ])
  })

  it('puts 10 people below the minimum in 30 WW', () => {
    expect(sums(recent.belowMinimum)).toEqual({ people: 10, volume: 10, sors: 11, ncrs: 0 })
  })

  it('has 70 Not recorded inspections in 30 WW, all SORs', () => {
    expect(recent.notRecorded).toMatchObject({ volume: 0, sors: 70, ncrs: 0 })
  })

  it('ranks the All period from WW51 2025', () => {
    expect([all.window.first.label, all.window.last.label]).toEqual(["WW51'2025", "WW42'2026"])
    expect(qcrTable(all.ranked)).toEqual([
      ['QCR 02', 'E', 70, 0, 2, '2.86%'],
      ['QCR 01', 'E', 94, 0, 0, '0.00%'],
      ['QCR 03', 'E', 39, 0, 0, '0.00%'],
      ['QCR 04', 'E', 31, 0, 0, '0.00%'],
      ['QCR 05', 'M', 12, 2, 0, '0.00%'],
      ['QCR 06', 'M', 14, 1, 0, '0.00%'],
      ['QCR 07', 'M', 5, 0, 0, '0.00%'],
    ])
  })

  it('puts 10 people below the minimum in All', () => {
    expect(sums(all.belowMinimum)).toEqual({ people: 10, volume: 10, sors: 11, ncrs: 0 })
  })

  it('has 132 Not recorded inspections in All: 7 finals, 125 SORs and 1 NCR', () => {
    expect(all.notRecorded).toMatchObject({ volume: 7, sors: 125, ncrs: 1 })
  })

  it('logs the one Not recorded NCR in WW08 2026', () => {
    const week = index.positionByKey.get(202608) ?? -1
    expect(index.notRecorded.qcr.ncrs[week]).toBe(1)
  })

  it('splits the Not recorded inspections as the spec does', () => {
    const electrical = notRecordedInspections(split.electrical)
    const mechanical = notRecordedInspections(split.mechanical)
    expect([electrical.length, mechanical.length]).toEqual([48, 84])
    const recentWeeks = new Set(recent.weekOptions.slice(0, 30).map((week) => week.label))
    const recentBlanks = [...electrical, ...mechanical].filter((row) => recentWeeks.has(String(row[COLUMNS.workWeek])))
    const blank = recentBlanks.filter((row) => row[COLUMNS.qcr] === null || String(row[COLUMNS.qcr]).trim() === '')
    expect([blank.length, recentBlanks.length - blank.length]).toEqual([57, 13])
  })

  it('tags only QCR 09 with both disciplines, below the minimum', () => {
    expect(index.qcr.filter((person) => person.disciplines.length === 2).map((person) => person.name)).toEqual(['QCR 09'])
    expect(all.belowMinimum.find((row) => row.name === 'QCR 09')?.tags).toEqual(['E', 'M'])
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
