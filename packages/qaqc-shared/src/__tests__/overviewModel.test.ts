import { describe, expect, it } from 'vitest'

import type { CardMode, OverviewIndex, OverviewModel } from '../overview'
import type { RangeMode, ViewState } from '../types'
import { buildOverviewModel } from '../overview'
import { parseWorkWeek } from '../workWeeks'
import { bim, inspection, overviewIndexOf, times, weld } from './overviewRows'

function viewAt(label: string, range: RangeMode = 'recent'): ViewState {
  const week = parseWorkWeek(label)
  if (week === null) throw new Error(`bad week ${label}`)
  return { selectedKey: week.key, windowEndKey: week.key, range }
}

function modelAt(index: OverviewIndex, label: string, mode: CardMode, range: RangeMode = 'recent'): OverviewModel {
  return buildOverviewModel(index, viewAt(label, range), mode)
}

const WW40 = "WW40'2026"
const WW41 = "WW41'2026"
const WW42 = "WW42'2026"

describe('Electrical and Mechanical rows', () => {
  const index = overviewIndexOf([
    ...times(2, () => inspection('Electrical', WW41, 'Final')),
    ...times(2, () => inspection('Electrical', WW41, 'SOR')),
    ...times(3, () => inspection('Electrical', WW42, 'Final')),
    inspection('Electrical', WW42, 'Final', 'Cable damaged'),
    inspection('Electrical', WW42, 'SOR'),
  ])

  it("shows W's Finals, SORs and NCRs with the change against W−1 in This WW", () => {
    const [finals, sors, ncrs] = modelAt(index, WW42, 'week').rows.electrical.cards
    expect([finals.label, finals.value, finals.delta, finals.deltaDisplay, finals.trend]).toEqual(['Finals', 4, 2, "+2 vs WW41'2026", 'up'])
    expect([sors.label, sors.value, sors.deltaDisplay, sors.trend]).toEqual(['SORs', 1, "−1 vs WW41'2026", 'down'])
    expect([ncrs.label, ncrs.value, ncrs.deltaDisplay]).toEqual(['NCRs', 1, "+1 vs WW41'2026"])
  })

  it('shows the totals through W with +n this WW in To date', () => {
    const [finals, sors, ncrs] = modelAt(index, WW42, 'toDate').rows.electrical.cards
    expect([finals.value, finals.delta, finals.deltaDisplay, finals.trend]).toEqual([6, 4, '+4 this WW', 'none'])
    expect([sors.value, sors.deltaDisplay]).toEqual([3, '+1 this WW'])
    expect([ncrs.value, ncrs.deltaDisplay]).toEqual([1, '+1 this WW'])
  })

  it("rates W's finals only in This WW, with the change in points against W−1", () => {
    const rate = modelAt(index, WW42, 'week').rows.electrical.cards[3]
    expect(rate.label).toBe('NCR pass rate')
    expect(rate.value).toBe(75)
    expect(rate.display).toBe('75.0%')
    expect(rate.subLine).toBe('3 / 4 Finals')
    expect(rate.delta).toBe(-25)
    expect(rate.deltaDisplay).toBe("−25.0 pts vs WW41'2026")
  })

  it('rates the finals through W in To date, with the change against through W−1', () => {
    const rate = modelAt(index, WW42, 'toDate').rows.electrical.cards[3]
    expect(rate.value).toBeCloseTo(83.3333, 4)
    expect(rate.subLine).toBe('5 / 6 Finals')
    expect(rate.delta).toBeCloseTo(-16.6667, 4)
  })

  it('shows Finals and SORs in neutral', () => {
    const [finals, sors] = modelAt(index, WW42, 'week').rows.electrical.cards
    expect([finals.tone, sors.tone]).toEqual(['neutral', 'neutral'])
  })

  it('shows the NCR pass rate as n/a with the change n/a when W has no finals', () => {
    const sorsOnly = overviewIndexOf([inspection('Mechanical', WW41, 'Final'), inspection('Mechanical', WW42, 'SOR')])
    const rate = modelAt(sorsOnly, WW42, 'week').rows.mechanical.cards[3]
    expect([rate.value, rate.display, rate.subLine]).toEqual([null, 'n/a', '0 Finals'])
    expect([rate.delta, rate.deltaDisplay, rate.tone, rate.trend]).toEqual([null, 'Change n/a', 'neutral', 'none'])
  })

  it('shows the NCR pass rate change as n/a when W−1 has no finals', () => {
    const rate = modelAt(overviewIndexOf([inspection('Mechanical', WW42, 'Final')]), WW42, 'week').rows.mechanical.cards[3]
    expect([rate.value, rate.delta, rate.deltaDisplay]).toEqual([100, null, 'Change n/a'])
  })
})

describe('Electrical and Mechanical tones', () => {
  it('shows NCRs in amber when they go up', () => {
    const index = overviewIndexOf([inspection('Electrical', WW41, 'Final'), inspection('Electrical', WW42, 'Final', 'NCR')])
    expect(modelAt(index, WW42, 'week').rows.electrical.cards[2].tone).toBe('warn')
  })

  it('shows NCRs in neutral when they go down', () => {
    const index = overviewIndexOf([inspection('Electrical', WW41, 'Final', 'NCR'), inspection('Electrical', WW42, 'Final')])
    expect(modelAt(index, WW42, 'week').rows.electrical.cards[2].tone).toBe('neutral')
  })

  it('shows NCRs to date in amber when W added one', () => {
    const index = overviewIndexOf([inspection('Mechanical', WW41, 'Final', 'NCR'), inspection('Mechanical', WW42, 'Final', 'NCR')])
    expect(modelAt(index, WW42, 'toDate').rows.mechanical.cards[2].tone).toBe('warn')
  })

  it('shows NCRs to date in neutral when W added none', () => {
    const index = overviewIndexOf([inspection('Mechanical', WW41, 'Final', 'NCR'), inspection('Mechanical', WW42, 'Final')])
    expect(modelAt(index, WW42, 'toDate').rows.mechanical.cards[2].tone).toBe('neutral')
  })

  it('shows the NCR pass rate in green when it goes up', () => {
    const index = overviewIndexOf([
      inspection('Electrical', WW41, 'Final', 'NCR'),
      inspection('Electrical', WW41, 'Final'),
      inspection('Electrical', WW42, 'Final'),
    ])
    const rate = modelAt(index, WW42, 'week').rows.electrical.cards[3]
    expect([rate.tone, rate.trend, rate.deltaDisplay]).toEqual(['good', 'up', "+50.0 pts vs WW41'2026"])
  })

  it('shows the NCR pass rate in red when it goes down', () => {
    const index = overviewIndexOf([inspection('Electrical', WW41, 'Final'), inspection('Electrical', WW42, 'Final', 'NCR')])
    const rate = modelAt(index, WW42, 'toDate').rows.electrical.cards[3]
    expect([rate.tone, rate.trend]).toEqual(['bad', 'down'])
  })
})

describe('Welding row', () => {
  const index = overviewIndexOf([
    weld(WW40, { signedWeek: WW41 }),
    weld(WW40, { signedWeek: WW42 }),
    weld(WW40),
    weld(WW40),
    weld(WW41, { signedWeek: WW42, issue: 'BIM #12' }),
  ])

  it('counts Welds logged by weld week and Signed by signed week in This WW', () => {
    const [logged, signed, , ncrs] = modelAt(index, WW42, 'week').rows.welding.cards
    expect([logged.label, logged.value, logged.deltaDisplay]).toEqual(['Welds logged', 0, "−1 vs WW41'2026"])
    expect([signed.label, signed.value, signed.deltaDisplay]).toEqual(['Signed', 2, "+1 vs WW41'2026"])
    expect([ncrs.label, ncrs.value, ncrs.deltaDisplay]).toEqual(['NCRs', 0, "−1 vs WW41'2026"])
  })

  it('counts signed welds through W with the welds signed in W underneath in To date', () => {
    const [logged, signed, , ncrs] = modelAt(index, WW42, 'toDate').rows.welding.cards
    expect([logged.value, logged.deltaDisplay]).toEqual([5, '+0 this WW'])
    expect([signed.value, signed.delta, signed.deltaDisplay]).toEqual([3, 2, '+2 signed this WW'])
    expect([ncrs.value, ncrs.deltaDisplay]).toEqual([1, '+0 this WW'])
  })

  it('shows Sign-off % for the latest weld week up to W that has welds in This WW', () => {
    const signoff = modelAt(overviewIndexOf([weld(WW40, { signedWeek: WW41 }), weld(WW40)]), WW42, 'week').rows.welding.cards[2]
    expect([signoff.label, signoff.value, signoff.display, signoff.subLine]).toEqual(['Sign-off %', 50, '50%', "1 of 2 · WW40'2026"])
    expect([signoff.delta, signoff.deltaDisplay, signoff.trend, signoff.tone]).toEqual([null, null, 'none', 'neutral'])
  })

  it('shows the overall Sign-off % with its change in points in To date', () => {
    const signoff = modelAt(index, WW41, 'toDate').rows.welding.cards[2]
    expect(signoff.value).toBe(60)
    expect(signoff.display).toBe('60.0%')
    expect(signoff.subLine).toBe('3 of 5 signed')
    expect(signoff.delta).toBeCloseTo(60 - 50, 6)
    expect([signoff.tone, signoff.trend, signoff.deltaDisplay]).toEqual(['good', 'up', "+10.0 pts vs WW40'2026"])
  })

  it('flags Sign-off % below 10% as bad', () => {
    const low = overviewIndexOf([weld(WW42, { signedWeek: WW42 }), ...times(19, () => weld(WW42))])
    expect(modelAt(low, WW42, 'week').rows.welding.cards[2]).toMatchObject({ value: 5, display: '5.0%', isValueBad: true })
    expect(modelAt(low, WW42, 'toDate').rows.welding.cards[2].isValueBad).toBe(true)
  })

  it('does not flag Sign-off % of 10% or more', () => {
    const fine = overviewIndexOf([weld(WW42, { signedWeek: WW42 }), ...times(9, () => weld(WW42))])
    expect(modelAt(fine, WW42, 'week').rows.welding.cards[2].isValueBad).toBe(false)
  })

  it('shows NCRs in amber when they go up', () => {
    expect(modelAt(index, WW41, 'week').rows.welding.cards[3].tone).toBe('warn')
  })

  it('shows Welds logged and Signed in neutral', () => {
    const [logged, signed] = modelAt(index, WW41, 'week').rows.welding.cards
    expect([logged.tone, signed.tone]).toEqual(['neutral', 'neutral'])
  })
})

describe('BIM Issues row', () => {
  const index = overviewIndexOf([
    bim('#1', '9/29/2026'), // WW40
    bim('#2', '10/6/2026', { status: 'Closed', updatedOn: '10/8/2026' }), // opened and closed WW41
    bim('#3', '10/6/2026'), // WW41
    bim('#4', '10/13/2026', { status: 'Closed', updatedOn: '10/14/2026' }), // opened and closed WW42
    bim('#5', '10/13/2026'),
    bim('#6', '10/13/2026'),
  ])

  it("shows W's Opened and Closed with the change against W−1 in This WW", () => {
    const [opened, closed] = modelAt(index, WW42, 'week').rows.bim.cards
    expect([opened.label, opened.value, opened.deltaDisplay]).toEqual(['Opened', 3, "+1 vs WW41'2026"])
    expect([closed.label, closed.value, closed.deltaDisplay]).toEqual(['Closed', 1, "No change vs WW41'2026"])
  })

  it('shows Opened and Closed through W in To date', () => {
    const [opened, closed] = modelAt(index, WW42, 'toDate').rows.bim.cards
    expect([opened.value, opened.deltaDisplay]).toEqual([6, '+3 this WW'])
    expect([closed.value, closed.deltaDisplay]).toEqual([2, '+1 this WW'])
  })

  it('shows Remaining open to date with the change against W−1 in both modes', () => {
    for (const mode of ['week', 'toDate'] as const) {
      const remaining = modelAt(index, WW42, mode).rows.bim.cards[2]
      expect([remaining.label, remaining.value, remaining.delta, remaining.deltaDisplay]).toEqual(['Remaining open', 4, 2, "+2 vs WW41'2026"])
    }
  })

  it('shows the to-date Closure rate in both modes', () => {
    const week = modelAt(index, WW42, 'week').rows.bim.cards[3]
    const toDate = modelAt(index, WW42, 'toDate').rows.bim.cards[3]
    expect(week).toEqual(toDate)
    expect(week.label).toBe('Closure rate')
    expect(week.value).toBeCloseTo((2 / 6) * 100, 6)
    expect(week.delta).toBeCloseTo((2 / 6 - 1 / 3) * 100, 6)
    expect(week.subLine).toBe('2 of 6 closed')
  })

  it('shows Opened in amber when it goes up', () => {
    expect(modelAt(index, WW42, 'week').rows.bim.cards[0].tone).toBe('warn')
  })

  it('shows Opened in neutral when it goes down', () => {
    const fewer = overviewIndexOf([bim('#1', '10/6/2026'), bim('#2', '10/6/2026'), bim('#3', '10/13/2026')])
    expect(modelAt(fewer, WW42, 'week').rows.bim.cards[0].tone).toBe('neutral')
  })

  it('shows Closed in green when it is at least the previous value and above 0', () => {
    expect(modelAt(index, WW42, 'week').rows.bim.cards[1].tone).toBe('good')
  })

  it('shows Closed in neutral when nothing closed in either week', () => {
    const none = overviewIndexOf([bim('#1', '10/6/2026'), bim('#2', '10/13/2026')])
    expect(modelAt(none, WW42, 'week').rows.bim.cards[1].tone).toBe('neutral')
  })

  it('shows Closed in neutral when fewer closed than the week before', () => {
    const fewer = overviewIndexOf([
      bim('#1', '10/6/2026', { status: 'Closed', updatedOn: '10/7/2026' }),
      bim('#2', '10/6/2026', { status: 'Closed', updatedOn: '10/7/2026' }),
      bim('#3', '10/6/2026', { status: 'Closed', updatedOn: '10/13/2026' }),
    ])
    expect(modelAt(fewer, WW42, 'week').rows.bim.cards[1].tone).toBe('neutral')
  })

  it('shows Remaining open in red when it goes up and green when it goes down', () => {
    const closing = overviewIndexOf([
      bim('#1', '10/6/2026'),
      bim('#2', '10/6/2026', { status: 'Closed', updatedOn: '10/13/2026' }),
    ])
    expect(modelAt(index, WW42, 'week').rows.bim.cards[2].tone).toBe('bad')
    expect(modelAt(closing, WW42, 'week').rows.bim.cards[2].tone).toBe('good')
  })

  it('shows the Closure rate in green when it goes up and red when it goes down', () => {
    const closing = overviewIndexOf([
      bim('#1', '10/6/2026'),
      bim('#2', '10/6/2026', { status: 'Closed', updatedOn: '10/13/2026' }),
    ])
    expect(modelAt(closing, WW42, 'week').rows.bim.cards[3].tone).toBe('good')
    const opening = overviewIndexOf([
      bim('#1', '10/6/2026', { status: 'Closed', updatedOn: '10/7/2026' }),
      bim('#2', '10/13/2026'),
    ])
    expect(modelAt(opening, WW42, 'week').rows.bim.cards[3].tone).toBe('bad')
  })
})

describe('missing and early disciplines', () => {
  it('marks a source with no rows as not connected and says so', () => {
    const model = modelAt(overviewIndexOf([inspection('Electrical', WW42, 'Final')]), WW42, 'week')
    expect(model.rows.electrical.connected).toBe(true)
    expect(model.rows.mechanical.connected).toBe(false)
    expect(model.rows.mechanical.trendText).toBe('Not connected: no Mechanical rows in QAQC Combined')
    expect(model.rows.welding.trendText).toBe('Not connected: no Welding rows in QAQC Combined')
    expect(model.rows.bim.trendText).toBe('Not connected: no BIM Issues rows in QAQC Combined')
  })

  it('counts a week before a discipline\'s first week as zero', () => {
    const index = overviewIndexOf([
      inspection('Electrical', WW40, 'Final'),
      inspection('Mechanical', WW42, 'Final'),
      weld(WW42, { signedWeek: WW42 }),
      bim('#1', '10/13/2026'),
    ])
    const week = modelAt(index, WW41, 'week')
    const toDate = modelAt(index, WW41, 'toDate')
    expect(week.rows.mechanical.cards.map((card) => card.value)).toEqual([0, 0, 0, null])
    expect(toDate.rows.mechanical.cards.map((card) => card.value)).toEqual([0, 0, 0, null])
    expect(week.rows.welding.cards.map((card) => card.value)).toEqual([0, 0, null, 0])
    expect(week.rows.welding.cards[2].subLine).toBe('No welds logged yet')
    expect(toDate.rows.welding.cards[2].value).toBeNull()
    expect(week.rows.bim.cards.map((card) => card.value)).toEqual([0, 0, 0, null])
    expect(week.quality.map((card) => card.value)).toEqual([0, 0, null, null, 0])
  })

  it('has no data when no source has a counted row', () => {
    expect(modelAt(overviewIndexOf([]), WW42, 'week').hasData).toBe(false)
    expect(modelAt(overviewIndexOf([bim('#1', '10/13/2026')]), WW42, 'week').hasData).toBe(true)
  })
})

describe('sparklines', () => {
  const index = overviewIndexOf([
    inspection('Electrical', "WW01'2026", 'Final'),
    ...times(2, () => inspection('Electrical', WW41, 'Final')),
    ...times(4, () => inspection('Electrical', WW42, 'Final')),
    ...times(2, () => inspection('Electrical', WW42, 'SOR')),
    weld(WW41),
    weld(WW41),
    weld(WW42),
    bim('#1', '10/6/2026'),
    bim('#2', '10/13/2026', { status: 'Closed', updatedOn: '10/13/2026' }),
  ])

  it('covers the 30 weeks ending at W with W as the last point', () => {
    const row = modelAt(index, WW42, 'week').rows.electrical
    expect(row.sparkline).toHaveLength(30)
    expect(row.sparkline.slice(-2)).toEqual([2, 6])
    expect(row.sparklineSelected).toBe(29)
  })

  it('ends at the selected week', () => {
    const row = modelAt(index, WW41, 'week').rows.electrical
    expect(row.sparkline[row.sparkline.length - 1]).toBe(2)
    expect(row.sparklineSelected).toBe(29)
  })

  it('is shorter when fewer than 30 weeks lead up to W', () => {
    const row = modelAt(index, "WW03'2026", 'week').rows.electrical
    expect(row.sparkline).toEqual([1, 0, 0])
    expect(row.sparklineSelected).toBe(2)
  })

  it('states the change at W in words', () => {
    const model = modelAt(index, WW42, 'week')
    expect(model.rows.electrical.trendText).toBe("up 4 vs WW41'2026")
    expect(model.rows.welding.trendText).toBe("down 1 vs WW41'2026")
    expect(model.rows.bim.trendText).toBe("no change vs WW41'2026")
  })

  it('plots Welds logged for Welding and Remaining open for BIM', () => {
    const model = modelAt(index, WW42, 'week')
    expect(model.rows.welding.sparkline.slice(-2)).toEqual([2, 1])
    expect(model.rows.bim.sparkline.slice(-3)).toEqual([0, 1, 1])
  })
})

describe('quality strip', () => {
  const index = overviewIndexOf([
    inspection('Electrical', WW41, 'Final'),
    inspection('Electrical', WW42, 'Final', 'NCR'),
    inspection('Electrical', WW42, 'Final'),
    inspection('Mechanical', WW42, 'Final'),
    inspection('Mechanical', WW42, 'Final'),
    weld(WW41, { issue: 'BIM #4' }),
    weld(WW41),
    weld(WW42, { issue: 'BIM #5' }),
    weld(WW42),
    weld(WW42),
    weld(WW42),
    bim('#1', '10/6/2026', { type: 'COR' }),
    bim('#2', '10/13/2026', { type: 'cor' }),
    bim('#3', '10/13/2026', { type: ' COR ' }),
    bim('#4', '10/13/2026', { type: 'COR', status: 'Void' }),
    bim('#5', '10/13/2026', { type: 'NCR' }),
    bim('#6', '10/13/2026', { type: 'DWN' }),
    bim('#7', '10/6/2026', { type: 'dwn' }),
  ])

  it("counts W's CORs with the change against W−1 in This WW, in amber when up", () => {
    const cors = modelAt(index, WW42, 'week').quality[0]
    expect([cors.label, cors.value, cors.deltaDisplay, cors.tone]).toEqual(['CORs', 2, "+1 vs WW41'2026", 'warn'])
  })

  it('counts CORs through W in To date, leaving out void issues', () => {
    const cors = modelAt(index, WW42, 'toDate').quality[0]
    expect([cors.value, cors.deltaDisplay, cors.tone]).toEqual([3, '+2 this WW', 'warn'])
  })

  it('counts NCRs from final walks only, with the source breakdown', () => {
    const week = modelAt(index, WW42, 'week').quality[1]
    expect([week.label, week.value, week.deltaDisplay, week.subLine]).toEqual(['NCRs', 2, "+1 vs WW41'2026", 'E 1 · M 0 · W 1'])
    expect(week.tone).toBe('warn')
    const toDate = modelAt(index, WW42, 'toDate').quality[1]
    expect([toDate.value, toDate.deltaDisplay, toDate.subLine]).toEqual([3, '+2 this WW', 'E 1 · M 0 · W 2'])
  })

  it('rates Electrical and Mechanical finals together', () => {
    const week = modelAt(index, WW42, 'week').quality[2]
    expect(week.label).toBe('Inspection NCR pass rate')
    expect(week.value).toBe(75)
    expect(week.subLine).toBe('1 NCR of 4 finals')
    expect([week.delta, week.tone]).toEqual([-25, 'bad'])
    const toDate = modelAt(index, WW42, 'toDate').quality[2]
    expect(toDate.value).toBe(80)
    expect(toDate.subLine).toBe('1 NCR of 5 finals')
  })

  it('rates welds by issue welds', () => {
    const week = modelAt(index, WW42, 'week').quality[3]
    expect(week.label).toBe('Welding NCR pass rate')
    expect(week.value).toBe(75)
    expect(week.subLine).toBe('1 NCR of 4 welds')
    expect([week.delta, week.tone, week.trend]).toEqual([25, 'good', 'up'])
    expect(modelAt(index, WW42, 'toDate').quality[3].subLine).toBe('2 NCRs of 6 welds')
  })

  it('shows a pass rate as n/a with the change n/a when the denominator is 0', () => {
    const empty = overviewIndexOf([weld(WW41), inspection('Electrical', WW41, 'Final')])
    const [, , inspectionRate, weldingRate] = modelAt(empty, WW42, 'week').quality
    expect([inspectionRate.value, inspectionRate.display, inspectionRate.subLine, inspectionRate.deltaDisplay]).toEqual([
      null,
      'n/a',
      '0 finals',
      'Change n/a',
    ])
    expect([weldingRate.value, weldingRate.subLine, weldingRate.delta, weldingRate.tone]).toEqual([null, '0 welds', null, 'neutral'])
  })

  it('counts DWNs in neutral', () => {
    const week = modelAt(index, WW42, 'week').quality[4]
    expect([week.label, week.value, week.deltaDisplay, week.tone]).toEqual(['DWNs', 1, "No change vs WW41'2026", 'neutral'])
    const toDate = modelAt(index, WW42, 'toDate').quality[4]
    expect([toDate.value, toDate.deltaDisplay, toDate.tone]).toEqual([2, '+1 this WW', 'neutral'])
  })

  it('shows the to-date DWN rate of green tags in both modes', () => {
    const withTags = overviewIndexOf([bim('#1', '10/6/2026', { type: 'DWN' }), bim('#2', '10/13/2026', { type: 'DWN' })], 40)
    expect(modelAt(withTags, WW42, 'week').quality[4].subLine).toBe('5.0% of green tags (to date)')
    expect(modelAt(withTags, WW42, 'toDate').quality[4].subLine).toBe('5.0% of green tags (to date)')
    expect(modelAt(withTags, WW41, 'week').quality[4].subLine).toBe('2.5% of green tags (to date)')
  })

  it('asks for Green tags when the measure is missing', () => {
    expect(modelAt(index, WW42, 'week').quality[4].subLine).toBe('DWN rate n/a: add Green tags')
  })

  it('asks for Green tags when the measure is 0', () => {
    const zero = overviewIndexOf([bim('#1', '10/13/2026', { type: 'DWN' })], 0)
    expect(modelAt(zero, WW42, 'toDate').quality[4].subLine).toBe('DWN rate n/a: add Green tags')
  })
})

describe('chart series and week state', () => {
  const index = overviewIndexOf([
    inspection('Electrical', "WW01'2026", 'Final'),
    inspection('Electrical', WW41, 'Final', 'NCR'),
    inspection('Electrical', WW41, 'SOR'),
    inspection('Mechanical', WW41, 'Final'),
    inspection('Mechanical', WW42, 'SOR'),
    weld(WW41),
  ])

  it('lists Electrical and Mechanical Finals and SORs per window week', () => {
    const { activity } = modelAt(index, WW42, 'week')
    expect(activity).toHaveLength(30)
    expect(activity.slice(-2)).toEqual([
      { week: expect.objectContaining({ label: WW41 }), electricalFinals: 1, electricalSors: 1, mechanicalFinals: 1, mechanicalSors: 0 },
      { week: expect.objectContaining({ label: WW42 }), electricalFinals: 0, electricalSors: 0, mechanicalFinals: 0, mechanicalSors: 1 },
    ])
  })

  it('spans every week in All', () => {
    const model = modelAt(index, WW42, 'week', 'all')
    expect(model.activity).toHaveLength(42)
    expect(model.rates).toHaveLength(42)
    expect(model.activity[0].electricalFinals).toBe(1)
  })

  it('rates each window week, with no rate where the week has no finals or welds', () => {
    const { rates } = modelAt(index, WW42, 'week')
    expect(rates[rates.length - 2]).toEqual({
      week: expect.objectContaining({ label: WW41 }),
      inspection: { rate: 50, ncrs: 1, total: 2 },
      welding: { rate: 100, ncrs: 0, total: 1 },
    })
    expect(rates[rates.length - 1]).toEqual({
      week: expect.objectContaining({ label: WW42 }),
      inspection: { rate: null, ncrs: 0, total: 0 },
      welding: { rate: null, ncrs: 0, total: 0 },
    })
  })

  it('totals the window', () => {
    expect(modelAt(index, WW42, 'week', 'all').windowTotals).toEqual({
      electricalFinals: 2,
      electricalSors: 1,
      mechanicalFinals: 1,
      mechanicalSors: 1,
      inspectionNcrs: 1,
      welds: 1,
      weldNcrs: 0,
      weeks: 42,
    })
  })

  it('lists the week options newest first with the selected and previous weeks', () => {
    const model = modelAt(index, WW41, 'week')
    expect(model.weekOptions[0].label).toBe(WW42)
    expect(model.weekOptions[model.weekOptions.length - 1].label).toBe("WW01'2026")
    expect([model.selectedWeek.label, model.previousWeek.label]).toEqual([WW41, WW40])
  })

  it('falls back to the current week when the selected week is not in the data', () => {
    const model = modelAt(index, "WW30'2024", 'week')
    expect(model.selectedWeek.label).toBe(WW42)
  })

  it('reads the previous week across a year boundary', () => {
    const model = modelAt(index, "WW01'2026", 'week')
    expect(model.previousWeek.label).toBe("WW52'2025")
    expect(model.rows.electrical.cards[0].deltaDisplay).toBe("+1 vs WW52'2025")
  })
})
