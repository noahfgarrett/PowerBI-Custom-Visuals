import { describe, expect, it } from 'vitest'

import { splitCombinedRows } from '../combined'
import { buildPerformanceIndex, isNotRecorded } from '../performance'
import type { PerformanceIndex, PerformancePerson } from '../performance'
import type { CombinedColumns } from '../types'

const COLUMNS: CombinedColumns = {
  source: 0,
  workWeek: 1,
  phase: 2,
  issue: 3,
  building: 4,
  qcr: 5,
  welder: 6,
  tagNo: 7,
  signature: -1,
  signedWeek: -1,
  id: -1,
  status: -1,
  type: -1,
  createdOn: -1,
  updatedOn: -1,
  createdBy: -1,
  greenTags: -1,
}
const TODAY = new Date(2026, 9, 15) // WW42'2026

type Row = ReadonlyArray<string | null>

function inspection(source: 'Electrical' | 'Mechanical', week: string, phase: string, qcr: string | null, issue = 'No Issue Found'): Row {
  return [source, week, phase, issue, 'F63.1', qcr, null, null]
}

function weld(week: string, welder: string | null, issue = 'No'): Row {
  return ['Welding', week, null, issue, null, null, welder, 'TAG-1']
}

function index(rows: Row[]): PerformanceIndex {
  return buildPerformanceIndex(splitCombinedRows(rows, COLUMNS.source), COLUMNS, TODAY)
}

function total(values: Int32Array): number {
  return values.reduce((sum, value) => sum + value, 0)
}

function person(people: PerformancePerson[], name: string): PerformancePerson {
  const found = people.find((candidate) => candidate.name === name)
  if (!found) throw new Error(`no person named ${name}`)
  return found
}

describe('isNotRecorded', () => {
  it.each([null, undefined, '', '   ', 'n/a', 'N/A', ' NA ', 'none', 'None', '-', ' - '])('treats %j as Not recorded', (value) => {
    expect(isNotRecorded(value)).toBe(true)
  })

  it.each(['QCR 01', 'Welder 001', 'nan', 'no', '--'])('treats %j as a recorded name', (value) => {
    expect(isNotRecorded(value)).toBe(false)
  })
})

describe('buildPerformanceIndex: QCR/FE', () => {
  it('groups names across case and whitespace, keeping the first spelling', () => {
    const built = index([
      inspection('Electrical', "WW40'2026", 'Final', 'Pat  Lee'),
      inspection('Electrical', "WW41'2026", 'Final', ' pat lee '),
      inspection('Mechanical', "WW41'2026", 'SOR', 'PAT LEE'),
    ])
    expect(built.qcr.map((item) => item.name)).toEqual(['Pat  Lee'])
    expect(built.qcr[0].key).toBe('pat lee')
    expect(total(built.qcr[0].weekly.volume)).toBe(2)
    expect(total(built.qcr[0].weekly.sors)).toBe(1)
  })

  it('records E and M for a person with rows in both disciplines', () => {
    const built = index([
      inspection('Electrical', "WW40'2026", 'Final', 'QCR 01'),
      inspection('Mechanical', "WW41'2026", 'Final', 'QCR 01'),
      inspection('Mechanical', "WW41'2026", 'Final', 'QCR 02'),
    ])
    expect(person(built.qcr, 'QCR 01').disciplines).toEqual(['E', 'M'])
    expect(person(built.qcr, 'QCR 02').disciplines).toEqual(['M'])
  })

  it('counts finals as volume, SORs apart, and NCRs only on finals with an issue found', () => {
    const built = index([
      inspection('Electrical', "WW41'2026", 'Final', 'QCR 01', 'Cable damaged'),
      inspection('Electrical', "WW41'2026", 'Final', 'QCR 01'),
      inspection('Electrical', "WW41'2026", 'SOR', 'QCR 01', 'Cable damaged'),
    ])
    const weekly = built.qcr[0].weekly
    expect([total(weekly.volume), total(weekly.sors), total(weekly.ncrs)]).toEqual([2, 1, 1])
  })

  it('skips other phases, unreadable weeks and future weeks', () => {
    const built = index([
      inspection('Electrical', "WW41'2026", 'N/A', 'QCR 01'),
      inspection('Electrical', 'next week', 'Final', 'QCR 01'),
      inspection('Electrical', "WW43'2026", 'Final', 'QCR 01'),
      inspection('Electrical', "WW41'2026", 'Final', 'QCR 02'),
    ])
    expect(built.qcr.map((item) => item.name)).toEqual(['QCR 02'])
    expect(built.footnotes.qcr).toEqual({ totalRows: 4, skippedRows: 1, futureRows: 1 })
  })

  it('puts blank and placeholder QCR/FE values in Not recorded', () => {
    const built = index([
      inspection('Electrical', "WW41'2026", 'SOR', null),
      inspection('Electrical', "WW41'2026", 'SOR', 'N/A'),
      inspection('Mechanical', "WW41'2026", 'Final', 'NA', 'Leak'),
    ])
    expect(built.qcr).toEqual([])
    const notRecorded = built.notRecorded.qcr
    expect([total(notRecorded.volume), total(notRecorded.sors), total(notRecorded.ncrs)]).toEqual([1, 2, 1])
  })

  it('aligns weeks from the earliest counted week to the current week', () => {
    const built = index([inspection('Electrical', "WW40'2026", 'Final', 'QCR 01')])
    expect(built.weeks.map((week) => week.label)).toEqual(["WW40'2026", "WW41'2026", "WW42'2026"])
    expect(Array.from(built.qcr[0].weekly.volume)).toEqual([1, 0, 0])
    expect(built.positionByKey.get(202641)).toBe(1)
  })

  it('keeps the current week alone when there are no rows', () => {
    const built = index([])
    expect(built.weeks.map((week) => week.label)).toEqual(["WW42'2026"])
    expect(built.qcr).toEqual([])
    expect(built.welders).toEqual([])
  })

  it('keeps NCR row references per person for the detail view', () => {
    const built = index([
      inspection('Electrical', "WW41'2026", 'Final', 'QCR 01', 'Cable damaged'),
      inspection('Mechanical', "WW40'2026", 'Final', 'QCR 01'),
      inspection('Mechanical', "WW40'2026", 'Final', 'QCR 01', 'Leak'),
    ])
    expect(built.qcr[0].ncrRows).toEqual([
      { source: 'electrical', row: 0, weekKey: 202641 },
      { source: 'mechanical', row: 1, weekKey: 202640 },
    ])
  })
})

describe('buildPerformanceIndex: welders', () => {
  it('splits the Welder cell on commas and credits each welder with the weld and its NCR', () => {
    const built = index([weld("WW41'2026", 'Welder 001, Welder 002', 'BIM #12')])
    expect(built.welders.map((item) => item.name)).toEqual(['Welder 001', 'Welder 002'])
    for (const welder of built.welders) {
      expect([total(welder.weekly.volume), total(welder.weekly.ncrs)]).toEqual([1, 1])
      expect(welder.ncrRows).toEqual([{ source: 'welding', row: 0, weekKey: 202641 }])
    }
    expect(total(built.totals.welders.volume)).toBe(1)
    expect(total(built.totals.welders.ncrs)).toBe(1)
  })

  it('credits a welder listed twice in one cell once', () => {
    const built = index([weld("WW41'2026", 'Welder 001, welder  001')])
    expect(built.welders).toHaveLength(1)
    expect(total(built.welders[0].weekly.volume)).toBe(1)
    expect(total(built.sharedWelds)).toBe(0)
  })

  it('counts welds that list more than one welder per week', () => {
    const built = index([
      weld("WW40'2026", 'Welder 001, Welder 002'),
      weld("WW41'2026", 'Welder 001,Welder 003'),
      weld("WW41'2026", 'Welder 001'),
    ])
    expect(Array.from(built.sharedWelds)).toEqual([1, 1, 0])
  })

  it('drops a Not recorded part inside a list without making the weld shared', () => {
    const built = index([weld("WW41'2026", 'Welder 001, N/A')])
    expect(built.welders.map((item) => item.name)).toEqual(['Welder 001'])
    expect(total(built.sharedWelds)).toBe(0)
    expect(total(built.notRecorded.welders.volume)).toBe(0)
  })

  it('puts a weld with no recorded part in Not recorded', () => {
    const built = index([weld("WW41'2026", null, 'BIM #3'), weld("WW41'2026", ' - , n/a')])
    expect(built.welders).toEqual([])
    expect(total(built.notRecorded.welders.volume)).toBe(2)
    expect(total(built.notRecorded.welders.ncrs)).toBe(1)
    expect(total(built.totals.welders.volume)).toBe(2)
  })

  it('skips unreadable and future weld weeks', () => {
    const built = index([weld('', 'Welder 001'), weld("WW44'2026", 'Welder 001'), weld("WW41'2026", 'Welder 002')])
    expect(built.welders.map((item) => item.name)).toEqual(['Welder 002'])
    expect(built.footnotes.welders).toEqual({ totalRows: 3, skippedRows: 1, futureRows: 1 })
  })

  it('leaves welders without discipline tags', () => {
    const built = index([weld("WW41'2026", 'Welder 001')])
    expect(built.welders[0].disciplines).toEqual([])
  })
})
