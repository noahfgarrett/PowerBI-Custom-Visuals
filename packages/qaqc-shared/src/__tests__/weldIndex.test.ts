import { describe, expect, it } from 'vitest'

import { weekIssueRows } from '../drilldown'
import { buildFilterCatalog, matchRows, type FilterFieldDef } from '../rowFilters'
import type { WeldColumns } from '../types'
import { buildWeldIndex, isWeldIssue, SITE_GENERAL, UNSPECIFIED_WELD_VALUE, weldBuilding, weldFilterFields, weldRowWeekKey } from '../welds'
import { WELDING_ROWS } from './fixtures/weldingRows'
import { UNBOUND_WELD_OPTIONAL } from './weldFilterFixture'

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

describe('buildWeldIndex axisFromKey', () => {
  const LATE = [weld("WW40'2026", null), weld("WW41'2026", null)]

  it('starts the axis at an earlier week, with no welds before the first data week', () => {
    const index = buildWeldIndex(LATE, COLUMNS, TODAY, { axisFromKey: 202638 })
    expect(index.weeks.map((item) => item.week.label)).toEqual(["WW38'2026", "WW39'2026", "WW40'2026", "WW41'2026", "WW42'2026"])
    expect(index.weeks.map((item) => item.logged)).toEqual([0, 0, 1, 1, 0])
    expect(index.cumulativeLogged).toEqual([0, 0, 1, 2, 2])
    expect(index.positionByKey.get(202640)).toBe(2)
    expect(index.systemsByWeek).toHaveLength(5)
    expect(index.buildingsByWeek).toHaveLength(5)
    expect(index.issueRowsByWeek).toHaveLength(5)
  })

  it('crosses a year', () => {
    const index = buildWeldIndex(LATE, COLUMNS, TODAY, { axisFromKey: 202551 })
    expect(index.weeks[0].week.label).toBe("WW51'2025")
    expect(index.positionByKey.get(202601)).toBe(2)
  })

  it('ignores a later week: data before it stays on the axis', () => {
    const index = buildWeldIndex(LATE, COLUMNS, TODAY, { axisFromKey: 202641 })
    expect(index.weeks[0].week.label).toBe("WW40'2026")
  })

  it('keeps the axis with no rows at all', () => {
    const index = buildWeldIndex([], COLUMNS, TODAY, { axisFromKey: 202640 })
    expect(index.weeks.map((item) => item.week.label)).toEqual(["WW40'2026", "WW41'2026", "WW42'2026"])
  })

  it('without the option the output is unchanged', () => {
    expect(buildWeldIndex(LATE, COLUMNS, TODAY)).toEqual(buildWeldIndex(LATE, COLUMNS, TODAY, {}))
    expect(buildWeldIndex(LATE, COLUMNS, TODAY).weeks[0].week.label).toBe("WW40'2026")
  })
})

describe('buildWeldIndex issueRowsByWeek', () => {
  it('holds the row positions behind each week\'s issue count', () => {
    const rows = [
      weld("WW40'2026", null),
      weld("WW40'2026", null, { issue: 'BIM 1' }),
      weld("WW41'2026", null, { issue: 'BIM 2' }),
      weld("WW40'2026", null, { issue: 'Yes 3' }),
    ]
    const index = buildWeldIndex(rows, COLUMNS, TODAY)
    expect(index.issueRowsByWeek).toEqual([[1, 3], [2], []])
    expect(index.weeks.map((item) => item.issues)).toEqual([2, 1, 0])
  })

  it('leaves out an explicit no, an unreadable week and a future week, as the count does', () => {
    const rows = [
      weld("WW40'2026", null, { issue: 'No' }),
      weld("WW40'2026", null, { issue: 'n/a' }),
      weld("WW40'2026", null, { issue: '-' }),
      weld('not a week', null, { issue: 'BIM 1' }),
      weld("WW50'2026", null, { issue: 'BIM 2' }),
      weld("WW40'2026", null, { issue: 'BIM 3' }),
    ]
    const index = buildWeldIndex(rows, COLUMNS, TODAY)
    expect(index.issueRowsByWeek[0]).toEqual([5])
    expect(index.weeks[0].issues).toBe(1)
  })

  it('counts a weld with an issue in its weld week, not its signed week', () => {
    const index = buildWeldIndex([weld("WW40'2026", "WW42'2026", { issue: 'BIM 1' })], COLUMNS, TODAY)
    expect(index.issueRowsByWeek).toEqual([[0], [], []])
  })

  it('every week of the fixture lists exactly the chart\'s issue count, with and without a filter', () => {
    const all = buildWeldIndex(WELDING_ROWS, COLUMNS, TODAY)
    const listed = all.issueRowsByWeek.map((positions) => positions.length)
    expect(listed).toEqual(all.weeks.map((item) => item.issues))
    expect(all.cumulativeIssues[all.cumulativeIssues.length - 1]).toBeGreaterThan(0)
    for (const positions of all.issueRowsByWeek) {
      for (const position of positions) expect(isWeldIssue(WELDING_ROWS[position][COLUMNS.issue])).toBe(true)
    }

    const fields = weldFilterFields(COLUMNS, UNBOUND_WELD_OPTIONAL)
    const issueBuilding = weldBuilding(WELDING_ROWS[all.issueRowsByWeek.flat()[0]][COLUMNS.tagNo])
    const catalog = buildFilterCatalog(WELDING_ROWS, fields)
    const selection = new Map([['building', new Set([issueBuilding.toLowerCase()])]])
    const filtered = matchRows(WELDING_ROWS, catalog, selection)
    expect(filtered.length).toBeLessThan(WELDING_ROWS.length)
    const narrowed = buildWeldIndex(filtered, COLUMNS, TODAY, { axisFromKey: all.weeks[0].week.key })
    expect(narrowed.weeks).toHaveLength(all.weeks.length)
    expect(narrowed.issueRowsByWeek.map((positions) => positions.length)).toEqual(narrowed.weeks.map((item) => item.issues))
    expect(narrowed.cumulativeIssues[narrowed.cumulativeIssues.length - 1]).toBeGreaterThan(0)
    for (const item of narrowed.weeks) {
      const rows = weekIssueRows(narrowed, filtered, item.week.key)
      expect(rows).toHaveLength(item.issues)
      for (const row of rows) expect(weldBuilding(row[COLUMNS.tagNo])).toBe(issueBuilding)
    }
  })
})

describe('weldFilterFields', () => {
  const OPTIONAL = { welder: 7, workPackage: 8 }

  function field(id: string, optional = OPTIONAL): FilterFieldDef {
    const found = weldFilterFields(COLUMNS, optional).find((candidate) => candidate.id === id)
    if (found === undefined) throw new Error(`no field ${id}`)
    return found
  }

  function rowOf(cells: { tag?: Cell; spec?: Cell; system?: Cell; welder?: unknown; workPackage?: unknown }): unknown[] {
    return ["WW40'2026", null, null, null, cells.system ?? 'AW', cells.spec ?? 'PCH', cells.tag ?? F631, cells.welder ?? null, cells.workPackage ?? null]
  }

  function options(id: string, rows: ReadonlyArray<readonly unknown[]>): Array<[string, number]> {
    const catalog = buildFilterCatalog(rows, [field(id)])
    return catalog.fields[0].options.map((option) => [option.label, option.count])
  }

  it('lists the fields in the menu order', () => {
    expect(weldFilterFields(COLUMNS, OPTIONAL).map((item) => item.label)).toEqual(['Building', 'Pipe Spec', 'Fluid Code', 'Welder', 'Work Package'])
  })

  it('leaves out an unbound Welder and Work Package', () => {
    expect(weldFilterFields(COLUMNS, UNBOUND_WELD_OPTIONAL).map((item) => item.label)).toEqual(['Building', 'Pipe Spec', 'Fluid Code'])
  })

  it('Building filters through the Tag No derivation', () => {
    const rows = [rowOf({ tag: F631 }), rowOf({ tag: F631 }), rowOf({ tag: BK1 }), rowOf({ tag: 'no building here' })]
    expect(options('building', rows)).toEqual([['F631', 2], ['BK1', 1], [SITE_GENERAL, 1]])
    const building = field('building')
    expect(building.read(rowOf({ tag: F631 }))).toBe('F631')
    expect(building.read(rowOf({ tag: 'no building here' }))).toBe(SITE_GENERAL)
  })

  it('groups a blank Pipe Spec and Fluid Code as the chart\'s Unspecified, listed last', () => {
    const rows = [rowOf({ spec: '  ', system: '  ' }), rowOf({ spec: 'unspecified', system: 'UNSPECIFIED' }), rowOf({}), rowOf({}), rowOf({})]
    expect(options('pipeSpec', rows)).toEqual([['PCH', 3], [UNSPECIFIED_WELD_VALUE, 2]])
    expect(options('fluidCode', rows)).toEqual([['AW', 3], [UNSPECIFIED_WELD_VALUE, 2]])
  })

  it('keeps an N/A Pipe Spec its own choice, as it is on the chart', () => {
    const rows = [rowOf({ spec: 'N/A' }), rowOf({ spec: null })]
    expect(options('pipeSpec', rows)).toContainEqual(['N/A', 1])
  })

  it('groups Fluid Code spellings the way the chart does', () => {
    const rows = [rowOf({ system: 'AW' }), rowOf({ system: ' aw ' })]
    expect(options('fluidCode', rows)).toEqual([['AW', 2]])
  })

  it('splits Welder on commas, as Performance does', () => {
    expect(field('welder').read(rowOf({ welder: 'P-012, PF-025' }))).toEqual(['P-012', 'PF-025'])
    expect(field('welder').read(rowOf({ welder: ' P-012 ,, N/A , - ' }))).toEqual(['P-012'])
    expect(field('welder').read(rowOf({ welder: 312 }))).toEqual(['312'])
    expect(field('welder').read(rowOf({ welder: null }))).toEqual([])
  })

  it('a weld listing P-012 and PF-025 counts under each, and once for a repeat', () => {
    const rows = [rowOf({ welder: 'P-012, PF-025' }), rowOf({ welder: 'PF-025, pf-025' }), rowOf({ welder: 'N/A' }), rowOf({ welder: '' })]
    expect(options('welder', rows)).toEqual([['PF-025', 2], ['P-012', 1], ['Not recorded', 2]])
  })

  it('reads a row\'s week from Weld Work Week', () => {
    const weekKey = weldRowWeekKey(COLUMNS)
    expect(weekKey(weld("WW40'2026", "WW42'2026"))).toBe(202640)
    expect(weekKey(weld('not a week', "WW42'2026"))).toBeNull()
  })
})
