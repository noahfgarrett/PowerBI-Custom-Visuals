import { afterEach, describe, expect, it, vi } from 'vitest'

import { splitCombinedRows } from '../combined'
import { buildFilterCatalog, matchRows } from '../rowFilters'
import * as inspections from '../inspections'
import * as issues from '../issues'
import { buildOverviewIndex, type OverviewIndex } from '../overview'
import { filterOverviewIndex, overviewFilterFields, overviewFilterNotes, overviewFilterRows, overviewRowWeekKey } from '../overviewFilters'
import type { CombinedColumns, InspectionRows } from '../types'
import * as welds from '../welds'
import { FILTER_COLUMNS, withValues } from './overviewFilterFixture'
import { bim, COLUMNS, inspection, overviewIndexOf, TODAY, weld } from './overviewRows'

describe('buildOverviewIndex', () => {
  it('spans the union of the discipline weeks from the earliest first week through the current week', () => {
    const index = overviewIndexOf([
      inspection('Electrical', "WW40'2026", 'Final'),
      weld("WW41'2026"),
      bim('#1', '9/22/2026'), // WW39'2026
    ])
    expect(index.weeks.map((week) => week.label)).toEqual(["WW39'2026", "WW40'2026", "WW41'2026", "WW42'2026"])
    expect(index.positionByKey.get(202640)).toBe(1)
    expect(index.currentWeek.label).toBe("WW42'2026")
  })

  it('holds only the current week when there are no rows', () => {
    const index = overviewIndexOf([])
    expect(index.weeks.map((week) => week.label)).toEqual(["WW42'2026"])
    expect(index.electrical.totalRows).toBe(0)
    expect(index.bim.totalRows).toBe(0)
  })

  it('crosses a year boundary', () => {
    const index = overviewIndexOf([inspection('Mechanical', "WW52'2025", 'SOR'), inspection('Mechanical', "WW42'2026", 'SOR')])
    expect(index.weeks[0].label).toBe("WW52'2025")
    expect(index.weeks[1].label).toBe("WW01'2026")
    expect(index.weeks).toHaveLength(43)
  })

  it('counts CORs per created week, matching Type trimmed and in any case', () => {
    const index = overviewIndexOf([
      bim('#1', '10/6/2026', { type: 'cor' }), // WW41
      bim('#2', '10/7/2026', { type: ' COR ' }), // WW41
      bim('#3', '10/13/2026', { type: 'COR' }), // WW42
    ])
    expect(index.corsByWeek).toEqual([2, 1])
    expect(index.cumulativeCors).toEqual([2, 3])
  })

  it('counts DWNs per created week, matching Type trimmed and in any case', () => {
    const index = overviewIndexOf([bim('#1', '10/6/2026', { type: 'DWN' }), bim('#2', '10/13/2026', { type: ' dwn' })])
    expect(index.dwnsByWeek).toEqual([1, 1])
    expect(index.cumulativeDwns).toEqual([1, 2])
  })

  it('does not count a BIM issue typed NCR as a COR or DWN', () => {
    const index = overviewIndexOf([bim('#1', '10/13/2026', { type: 'NCR' })])
    expect(index.cumulativeCors).toEqual([0])
    expect(index.cumulativeDwns).toEqual([0])
  })

  it('does not count a void COR', () => {
    const index = overviewIndexOf([bim('#1', '10/13/2026', { type: 'COR', status: 'Void' })])
    expect(index.corsByWeek).toEqual([0])
  })

  it('does not count a COR from an excluded creator', () => {
    const index = overviewIndexOf([bim('#1', '10/13/2026', { type: 'COR', createdBy: 'Bayside Engineer' })])
    expect(index.corsByWeek).toEqual([0])
  })

  it('aligns COR weeks to the union weeks when BIM starts later than another source', () => {
    const index = overviewIndexOf([inspection('Electrical', "WW40'2026", 'Final'), bim('#1', '10/13/2026', { type: 'COR' })])
    expect(index.corsByWeek).toEqual([0, 0, 1])
    expect(index.cumulativeCors).toEqual([0, 0, 1])
  })

  it('reads the Green tags measure from the rows', () => {
    expect(overviewIndexOf([inspection('Electrical', "WW42'2026", 'Final')], 120).greenTags).toBe(120)
    expect(overviewIndexOf([weld("WW42'2026")], ' 48 ').greenTags).toBe(48)
  })

  it('has no Green tags value when the measure is missing or blank', () => {
    expect(overviewIndexOf([inspection('Electrical', "WW42'2026", 'Final')]).greenTags).toBeNull()
    expect(overviewIndexOf([inspection('Electrical', "WW42'2026", 'Final')], '').greenTags).toBeNull()
  })

  it('treats a Green tags value of 0 or below as missing', () => {
    expect(overviewIndexOf([inspection('Electrical', "WW42'2026", 'Final')], 0).greenTags).toBeNull()
    expect(overviewIndexOf([inspection('Electrical', "WW42'2026", 'Final')], -5).greenTags).toBeNull()
  })

  it('counts the footnote rows per source and the unknown Source rows', () => {
    const unknown = inspection('Electrical', "WW42'2026", 'Final')
    unknown[0] = 'Civil'
    const index = overviewIndexOf([
      inspection('Electrical', 'soon', 'Final'),
      inspection('Mechanical', "WW44'2026", 'SOR'),
      weld('not a week'),
      weld("WW50'2026"),
      bim('#1', null),
      bim('#2', '10/13/2026', { createdBy: 'Someone Else' }),
      unknown,
    ])
    expect(index.footnotes).toEqual({
      electrical: { totalRows: 1, skippedRows: 1, futureRows: 0, excludedRows: 0 },
      mechanical: { totalRows: 1, skippedRows: 0, futureRows: 1, excludedRows: 0 },
      welding: { totalRows: 2, skippedRows: 1, futureRows: 1, excludedRows: 0 },
      bim: { totalRows: 2, skippedRows: 1, futureRows: 0, excludedRows: 1 },
      unknownSource: 1,
    })
  })
})

const TAG_BK1 = 'BK1XX104XX-M006-FW-1'
const TAG_WR1 = 'WR1XX104XX-M006-FW-1'

const MIXED_ROWS: unknown[][] = [
  withValues(inspection('Electrical', "WW40'2026", 'Final', 'Bad cable'), { generalContractor: 'Greyfox', discipline: 'Electrical', building: 'BK1' }),
  withValues(inspection('Electrical', "WW41'2026", 'Final'), { generalContractor: 'Bayside', discipline: 'Controls', building: 'WR1' }),
  withValues(inspection('Mechanical', "WW41'2026", 'Final', 'Bad weld prep'), { generalContractor: 'bayside', discipline: 'Piping', building: 'BK1' }),
  withValues(inspection('Mechanical', "WW38'2026", 'SOR'), { generalContractor: '', discipline: 'N/A', building: '' }),
  withValues(weld("WW41'2026", { issue: 'BIM 12' }), { tagNo: TAG_BK1 }),
  withValues(weld("WW39'2026"), { tagNo: TAG_WR1 }),
  withValues(bim('#1', '10/6/2026'), { contractor: 'BAYSIDE', discipline: 'ELECTRICAL' }),
  withValues(bim('#2', '10/7/2026'), { contractor: '', discipline: 'Piping' }),
  withValues(bim('#3', '10/7/2026', { createdBy: 'Other Company' }), { contractor: 'Ivory', discipline: 'Controls' }),
]

function filtered(rows: InspectionRows, ticks: Record<string, string[]>, columns: CombinedColumns = FILTER_COLUMNS): { base: OverviewIndex; index: OverviewIndex } {
  const split = splitCombinedRows(rows, columns.source)
  const base = buildOverviewIndex(split, columns, TODAY)
  const filterRows = overviewFilterRows(split, columns)
  const catalog = buildFilterCatalog(filterRows, overviewFilterFields(columns))
  const selection = new Map(Object.entries(ticks).map(([id, keys]) => [id, new Set(keys)]))
  return { base, index: filterOverviewIndex(base, split, matchRows(filterRows, catalog, selection), columns).index }
}

function catalogOf(rows: InspectionRows, columns: CombinedColumns = FILTER_COLUMNS): ReturnType<typeof buildFilterCatalog> {
  const split = splitCombinedRows(rows, columns.source)
  return buildFilterCatalog(overviewFilterRows(split, columns), overviewFilterFields(columns))
}

function optionsOf(catalog: ReturnType<typeof buildFilterCatalog>, id: string): Array<[string, number]> {
  const field = catalog.fields.find((item) => item.def.id === id)
  if (field === undefined) throw new Error(`no field ${id}`)
  return field.options.map((option) => [option.label, option.count])
}

function fieldIds(columns: CombinedColumns): string[] {
  return overviewFilterFields(columns).map((field) => field.id)
}

describe('overviewFilterFields', () => {
  it('lists Contractor, Building and Discipline when every slot is bound', () => {
    expect(fieldIds(FILTER_COLUMNS)).toEqual(['contractor', 'building', 'discipline'])
    expect(overviewFilterFields(FILTER_COLUMNS).map((field) => field.label)).toEqual(['Contractor', 'Building', 'Discipline'])
  })

  it('offers only Building with the new slots unbound', () => {
    expect(fieldIds(COLUMNS)).toEqual(['building'])
  })

  it('Contractor merges General Contractor and BIM Contractor into one list', () => {
    // Bayside: Electrical, Mechanical and BIM's, whatever the case. Blank on both sources is Unassigned, listed last.
    // The Other Company issue isn't counted by the Overview, so its Ivory isn't offered.
    expect(optionsOf(catalogOf(MIXED_ROWS), 'contractor')).toEqual([
      ['Bayside', 3],
      ['Greyfox', 1],
      ['Unassigned', 2],
    ])
  })

  it('still offers Contractor with one of its two slots bound', () => {
    const inspectionsOnly = catalogOf(MIXED_ROWS, { ...FILTER_COLUMNS, contractor: -1 })
    expect(optionsOf(inspectionsOnly, 'contractor')).toEqual([['Bayside', 2], ['Greyfox', 1], ['Unassigned', 1]])
    const bimOnly = catalogOf(MIXED_ROWS, { ...FILTER_COLUMNS, generalContractor: -1 })
    expect(optionsOf(bimOnly, 'contractor')).toEqual([['BAYSIDE', 1], ['Unassigned', 1]])
  })

  it('Building lists the inspections\' and the welds\' derived buildings, merged, and no BIM rows', () => {
    expect(optionsOf(catalogOf(MIXED_ROWS), 'building')).toEqual([
      ['BK1', 3],
      ['WR1', 2],
      ['Unspecified', 1],
    ])
  })

  it('keeps a building spelled differently on the two sources as two values', () => {
    const rows = [
      withValues(inspection('Electrical', "WW40'2026", 'Final'), { building: 'F63.1' }),
      withValues(weld("WW40'2026"), { tagNo: 'F631M008XX-1' }),
    ]
    expect(optionsOf(catalogOf(rows), 'building')).toEqual([['F63.1', 1], ['F631', 1]])
  })

  it('Discipline reads the inspection and BIM rows, not the welds', () => {
    expect(optionsOf(catalogOf(MIXED_ROWS), 'discipline')).toEqual([
      ['Electrical', 2],
      ['Piping', 2],
      ['Controls', 1],
      ['Not recorded', 1],
    ])
  })
})

describe('overviewFilterNotes', () => {
  function notesFor(columns: CombinedColumns, fieldId: string): string[] {
    return overviewFilterNotes(columns).filter((note) => note.whenFieldActive.includes(fieldId)).map((note) => note.message)
  }

  it('says which source each filter leaves alone', () => {
    expect(notesFor(FILTER_COLUMNS, 'contractor')).toEqual(["Welding isn't filtered by Contractor"])
    expect(notesFor(FILTER_COLUMNS, 'discipline')).toEqual(["Welding isn't filtered by Discipline"])
    expect(notesFor(FILTER_COLUMNS, 'building')).toEqual(["BIM issues aren't filtered by Building"])
  })

  it('adds Welding to Building\'s note while Tag No is unbound', () => {
    expect(notesFor({ ...FILTER_COLUMNS, tagNo: -1 }, 'building')).toEqual(["BIM issues aren't filtered by Building", "Welding isn't filtered by Building"])
  })

  it('says so when one of Contractor\'s two slots is unbound', () => {
    expect(notesFor({ ...FILTER_COLUMNS, contractor: -1 }, 'contractor')).toContain("BIM issues aren't filtered by Contractor")
    expect(notesFor({ ...FILTER_COLUMNS, generalContractor: -1 }, 'contractor')).toContain("Inspections aren't filtered by Contractor")
  })
})

describe('overviewFilterRows', () => {
  it('leaves out BIM issues the Overview never counts and rows with an unknown Source', () => {
    const rows = [...MIXED_ROWS, withValues(bim('#9', '10/7/2026'), {}).map((cell, at) => (at === FILTER_COLUMNS.source ? 'Civil' : cell))]
    const split = splitCombinedRows(rows, FILTER_COLUMNS.source)
    expect(overviewFilterRows(split, FILTER_COLUMNS)).toHaveLength(MIXED_ROWS.length - 1)
  })
})

describe('overviewRowWeekKey', () => {
  it('reads each source\'s own week', () => {
    const keyOf = overviewRowWeekKey(FILTER_COLUMNS)
    expect(keyOf(MIXED_ROWS[0])).toBe(202640)
    expect(keyOf(MIXED_ROWS[5])).toBe(202639)
    expect(keyOf(MIXED_ROWS[6])).toBe(202641)
  })

  it('has no week for an unknown Source', () => {
    expect(overviewRowWeekKey(FILTER_COLUMNS)(['Civil', "WW40'2026"])).toBeNull()
  })
})

describe('filterOverviewIndex', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('welding is unaffected by Contractor and Discipline', () => {
    const byContractor = filtered(MIXED_ROWS, { contractor: ['greyfox'] })
    expect(byContractor.index.welding).toBe(byContractor.base.welding)
    expect(byContractor.index.electrical.totalRows).toBe(1)
    const byDiscipline = filtered(MIXED_ROWS, { discipline: ['piping'] })
    expect(byDiscipline.index.welding).toBe(byDiscipline.base.welding)
    expect(byDiscipline.index.mechanical.totalRows).toBe(1)
  })

  it('BIM is unaffected by Building', () => {
    const { base, index } = filtered(MIXED_ROWS, { building: ['bk1'] })
    expect(index.bim).toBe(base.bim)
    expect(index.electrical.totalRows).toBe(1)
  })

  it('Building filters welding through the Tag No derivation', () => {
    const { index } = filtered(MIXED_ROWS, { building: ['bk1'] })
    expect(index.welding.totalRows).toBe(1)
    expect(index.welding.cumulativeLogged[index.welding.weeks.length - 1]).toBe(1)
  })

  it('Building leaves welding unfiltered with Tag No unbound', () => {
    const { base, index } = filtered(MIXED_ROWS, { building: ['bk1'] }, { ...FILTER_COLUMNS, tagNo: -1 })
    expect(index.welding).toBe(base.welding)
    expect(index.welding.totalRows).toBe(2)
  })

  it('Contractor filters inspections and BIM, merged', () => {
    const { index } = filtered(MIXED_ROWS, { contractor: ['bayside'] })
    expect(index.electrical.totalRows).toBe(1)
    expect(index.mechanical.totalRows).toBe(1)
    expect(index.bim.totalRows).toBe(1)
  })

  it('a rebuild reuses the indexes of untouched sources', () => {
    const split = splitCombinedRows(MIXED_ROWS, FILTER_COLUMNS.source)
    const base = buildOverviewIndex(split, FILTER_COLUMNS, TODAY)
    const filterRows = overviewFilterRows(split, FILTER_COLUMNS)
    const catalog = buildFilterCatalog(filterRows, overviewFilterFields(FILTER_COLUMNS))
    const inspectionBuilds = vi.spyOn(inspections, 'buildInspectionIndex')
    const weldBuilds = vi.spyOn(welds, 'buildWeldIndex')
    const issueBuilds = vi.spyOn(issues, 'buildIssueIndex')

    filterOverviewIndex(base, split, matchRows(filterRows, catalog, new Map([['building', new Set(['bk1'])]])), FILTER_COLUMNS)
    expect(inspectionBuilds).toHaveBeenCalledTimes(2)
    expect(weldBuilds).toHaveBeenCalledTimes(1)
    expect(issueBuilds).not.toHaveBeenCalled()

    vi.clearAllMocks()
    filterOverviewIndex(base, split, matchRows(filterRows, catalog, new Map([['contractor', new Set(['bayside'])]])), FILTER_COLUMNS)
    expect(inspectionBuilds).toHaveBeenCalledTimes(2)
    expect(weldBuilds).not.toHaveBeenCalled()
    expect(issueBuilds).toHaveBeenCalledTimes(1)
  })

  it('reuses a source a filter leaves whole', () => {
    // Everything in Electrical is Greyfox, so ticking its only value changes none of its rows.
    const rows = [
      withValues(inspection('Electrical', "WW40'2026", 'Final'), { generalContractor: 'Greyfox' }),
      withValues(inspection('Mechanical', "WW41'2026", 'Final'), { generalContractor: 'Bayside' }),
      withValues(bim('#1', '10/6/2026'), { contractor: 'Bayside' }),
    ]
    const { base, index } = filtered(rows, { contractor: ['greyfox'] })
    expect(index.electrical).toBe(base.electrical)
    expect(index.mechanical).not.toBe(base.mechanical)
  })

  it('keeps each rebuilt source on its own first week', () => {
    const { base, index } = filtered(MIXED_ROWS, { contractor: ['bayside'] })
    expect(index.electrical.weeks[0].week.key).toBe(base.electrical.weeks[0].week.key)
    expect(index.mechanical.weeks[0].week.key).toBe(base.mechanical.weeks[0].week.key)
    expect(index.bim.weeks[0].week.key).toBe(base.bim.weeks[0].week.key)
    expect(index.weeks.map((week) => week.key)).toEqual(base.weeks.map((week) => week.key))
  })

  it('marks an index it rebuilt, and which sources it left with no rows', () => {
    const { base, index } = filtered(MIXED_ROWS, { contractor: ['greyfox'] })
    expect(base.filteredOut).toBeNull()
    expect(index.filteredOut).toEqual(new Set(['mechanical', 'bim']))
  })

  it('never reports a source the table has no rows of as filtered out', () => {
    const rows = MIXED_ROWS.filter((row) => row[FILTER_COLUMNS.source] !== 'Mechanical')
    expect(filtered(rows, { contractor: ['greyfox'] }).index.filteredOut).toEqual(new Set(['bim']))
  })

  it('keeps the rows no filter reaches in the footnote counts', () => {
    const { base, index } = filtered(MIXED_ROWS, { contractor: ['bayside'] })
    expect(base.footnotes.bim.excludedRows).toBe(1)
    expect(index.footnotes.bim.excludedRows).toBe(1)
    const withUnknown = [...MIXED_ROWS, ['Civil']]
    expect(filtered(withUnknown, { contractor: ['bayside'] }).index.footnotes.unknownSource).toBe(1)
  })

  it('counts only the rows left for CORs and DWNs', () => {
    const rows = [
      withValues(bim('#1', '10/6/2026', { type: 'COR' }), { contractor: 'Bayside' }),
      withValues(bim('#2', '10/6/2026', { type: 'COR' }), { contractor: 'Greyfox' }),
      withValues(bim('#3', '10/13/2026', { type: 'DWN' }), { contractor: 'Greyfox' }),
    ]
    const { index } = filtered(rows, { contractor: ['greyfox'] })
    expect(index.cumulativeCors[index.cumulativeCors.length - 1]).toBe(1)
    expect(index.cumulativeDwns[index.cumulativeDwns.length - 1]).toBe(1)
  })
})
