import { describe, expect, it } from 'vitest'

import type { WeldColumns } from '../types'
import { buildWeldIndex } from '../welds'

const COLUMNS: WeldColumns = {
  weldWeek: 0,
  signature: 1,
  signedWeek: 2,
  issue: 3,
  fluidCode: 4,
  pipeSpec: 5,
  tagNo: 6,
}
const TODAY = new Date(2026, 9, 15) // WW42'2026
const F631 = 'F631M001XX-P001-FW-01'
const BK1 = 'BK1XX101XX-M001-FW-01'

type Cell = string | null
function weld(
  weldWeek: Cell,
  signedWeek: Cell,
  options: { signature?: Cell; issue?: Cell; system?: Cell; spec?: Cell; tag?: Cell } = {},
): Cell[] {
  const signature = options.signature === undefined ? (signedWeek ? 'signed' : null) : options.signature
  return [
    weldWeek,
    signature,
    signedWeek,
    options.issue ?? null,
    options.system === undefined ? 'AW' : options.system,
    options.spec === undefined ? 'PCH' : options.spec,
    options.tag === undefined ? F631 : options.tag,
  ]
}

describe('buildWeldIndex', () => {
  it('holds only the current week when there are no rows', () => {
    const index = buildWeldIndex([], COLUMNS, TODAY)
    expect(index.weeks).toHaveLength(1)
    expect(index.weeks[0].week.label).toBe("WW42'2026")
    expect(index.weeks[0].logged).toBe(0)
    expect(index.cumulativeLogged).toEqual([0])
    expect(index.totalRows).toBe(0)
  })

  it('builds a continuous range from the first weld week to the current week', () => {
    const index = buildWeldIndex([weld("WW40'2026", null), weld("WW41'2026", null)], COLUMNS, TODAY)
    expect(index.weeks.map((item) => item.week.label)).toEqual(["WW40'2026", "WW41'2026", "WW42'2026"])
    expect(index.weeks.map((item) => item.logged)).toEqual([1, 1, 0])
    expect(index.positionByKey.get(202641)).toBe(1)
  })

  it('fills the gaps between weld weeks and across a year boundary', () => {
    const index = buildWeldIndex([weld("WW51'2025", null), weld("WW02'2026", null)], COLUMNS, TODAY)
    expect(index.weeks.slice(0, 5).map((item) => item.week.label)).toEqual([
      "WW51'2025",
      "WW52'2025",
      "WW01'2026",
      "WW02'2026",
      "WW03'2026",
    ])
    expect(index.weeks[1].logged).toBe(0)
  })

  it('skips unreadable weld weeks and counts future ones apart', () => {
    const index = buildWeldIndex(
      [weld("WW41'2026", null), weld('soon', null), weld(null, null), weld("WW50'2026", null)],
      COLUMNS,
      TODAY,
    )
    expect(index.totalRows).toBe(4)
    expect(index.skippedRows).toBe(2)
    expect(index.futureRows).toBe(1)
    expect(index.cumulativeLogged[index.cumulativeLogged.length - 1]).toBe(1)
  })

  it('counts signed welds by weld week and signedInWeek by signed week', () => {
    const index = buildWeldIndex(
      [weld("WW40'2026", "WW42'2026"), weld("WW40'2026", "WW40'2026"), weld("WW41'2026", null)],
      COLUMNS,
      TODAY,
    )
    expect(index.weeks.map((item) => item.signed)).toEqual([2, 0, 0])
    expect(index.weeks.map((item) => item.signedInWeek)).toEqual([1, 0, 1])
    expect(index.cumulativeSigned).toEqual([2, 2, 2])
  })

  it('does not count a signed week without a signature', () => {
    const index = buildWeldIndex([weld("WW41'2026", "WW41'2026", { signature: null })], COLUMNS, TODAY)
    expect(index.weeks[0].signed).toBe(0)
    expect(index.weeks[0].signedInWeek).toBe(0)
  })

  it('keeps a signed weld signed when its signed week is blank or unreadable', () => {
    const index = buildWeldIndex(
      [weld("WW41'2026", null, { signature: 'signed' }), weld("WW41'2026", 'later', { signature: 'signed' })],
      COLUMNS,
      TODAY,
    )
    expect(index.weeks[0].signed).toBe(2)
    expect(index.weeks.every((item) => item.signedInWeek === 0)).toBe(true)
  })

  it('ignores signed weeks that fall in the future or before the range', () => {
    const index = buildWeldIndex(
      [weld("WW41'2026", "WW50'2026"), weld("WW41'2026", "WW10'2026")],
      COLUMNS,
      TODAY,
    )
    expect(index.weeks[0].signed).toBe(2)
    expect(index.weeks.reduce((sum, item) => sum + item.signedInWeek, 0)).toBe(0)
  })

  it('counts an issue on a weld unless it is blank or an explicit no', () => {
    const index = buildWeldIndex(
      [
        weld("WW41'2026", null, { issue: 'BIM 1050' }),
        weld("WW41'2026", null, { issue: 'no' }),
        weld("WW41'2026", null, { issue: 'N/A' }),
        weld("WW41'2026", null),
      ],
      COLUMNS,
      TODAY,
    )
    expect(index.weeks[0].logged).toBe(4)
    expect(index.weeks[0].issues).toBe(1)
    expect(index.cumulativeIssues).toEqual([1, 1])
  })

  it('keeps cumulative totals parallel to the weeks', () => {
    const index = buildWeldIndex(
      [
        weld("WW40'2026", "WW40'2026", { issue: 'BIM 1' }),
        weld("WW40'2026", null),
        weld("WW41'2026", "WW41'2026"),
      ],
      COLUMNS,
      TODAY,
    )
    expect(index.cumulativeLogged).toEqual([2, 3, 3])
    expect(index.cumulativeSigned).toEqual([1, 2, 2])
    expect(index.cumulativeIssues).toEqual([1, 1, 1])
  })

  it('tallies systems and nested pipe specs per week', () => {
    const index = buildWeldIndex(
      [
        weld("WW40'2026", "WW40'2026", { system: 'AW', spec: 'PCH' }),
        weld("WW40'2026", null, { system: 'AW', spec: 'QCH' }),
        weld("WW40'2026", null, { system: 'IW', spec: 'PCH' }),
      ],
      COLUMNS,
      TODAY,
    )
    const systems = index.systemsByWeek[0]
    expect(systems.get('AW')?.total).toBe(2)
    expect(systems.get('AW')?.signed).toBe(1)
    expect(systems.get('AW')?.specs.get('PCH')).toEqual({ total: 1, signed: 1 })
    expect(systems.get('AW')?.specs.get('QCH')).toEqual({ total: 1, signed: 0 })
    expect(systems.get('IW')?.specs.get('PCH')).toEqual({ total: 1, signed: 0 })
    expect(index.systemsByWeek[1].size).toBe(0)
  })

  it('groups system and spec names ignoring case and spacing, showing the first spelling', () => {
    const index = buildWeldIndex(
      [
        weld("WW40'2026", null, { system: 'Chws', spec: 'Pch  A' }),
        weld("WW41'2026", null, { system: ' CHWS ', spec: 'PCH A' }),
        weld("WW41'2026", null, { system: 'chws', spec: 'pch a' }),
      ],
      COLUMNS,
      TODAY,
    )
    expect([...index.systemsByWeek[0].keys()]).toEqual(['Chws'])
    expect([...index.systemsByWeek[1].keys()]).toEqual(['Chws'])
    expect(index.systemsByWeek[1].get('Chws')?.total).toBe(2)
    expect([...(index.systemsByWeek[1].get('Chws')?.specs.keys() ?? [])]).toEqual(['Pch  A'])
  })

  it('labels blank systems and pipe specs Unspecified', () => {
    const index = buildWeldIndex([weld("WW41'2026", null, { system: null, spec: '  ' })], COLUMNS, TODAY)
    expect(index.systemsByWeek[0].get('Unspecified')?.specs.get('Unspecified')).toEqual({ total: 1, signed: 0 })
  })

  it('tallies buildings and issues from the tag number', () => {
    const index = buildWeldIndex(
      [
        weld("WW41'2026", null, { tag: F631 }),
        weld("WW41'2026", null, { tag: F631, issue: 'BIM 7' }),
        weld("WW41'2026", null, { tag: BK1 }),
        weld("WW41'2026", null, { tag: 'BATCH-PLANT-FW-12A' }),
        weld("WW41'2026", null, { tag: null }),
      ],
      COLUMNS,
      TODAY,
    )
    const buildings = index.buildingsByWeek[0]
    expect(buildings.get('F631')).toEqual({ welds: 2, issues: 1 })
    expect(buildings.get('BK1')).toEqual({ welds: 1, issues: 0 })
    expect(buildings.get('Site General')).toEqual({ welds: 2, issues: 0 })
  })

  it('accepts week values given as non-string cells without throwing', () => {
    const rows: unknown[][] = [[new Date(2026, 9, 7), 'signed', new Date(2026, 9, 14), null, 'AW', 'PCH', F631]]
    const index = buildWeldIndex(rows, COLUMNS, TODAY)
    expect(index.weeks[0].week.label).toBe("WW41'2026")
    expect(index.weeks[0].signed).toBe(1)
    expect(index.weeks[1].signedInWeek).toBe(1)
  })
})
