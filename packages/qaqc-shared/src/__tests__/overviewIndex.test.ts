import { describe, expect, it } from 'vitest'

import { bim, inspection, overviewIndexOf, weld } from './overviewRows'

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
