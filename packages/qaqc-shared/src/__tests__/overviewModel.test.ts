import { describe, expect, it } from 'vitest'

import type { CardMode, OverviewIndex, OverviewModel } from '../overview'
import type { RangeMode, ViewState } from '../types'
import { buildOverviewCards, buildOverviewModel, buildOverviewSeries } from '../overview'
import { parseWorkWeek } from '../workWeeks'
import { bim, cardsOf, inspection, overviewIndexOf, rowOf, times, UNBOUND_ROOT_CAUSE_COLUMNS, weld } from './overviewRows'

function viewAt(label: string, range: RangeMode = 'recent'): ViewState {
  const week = parseWorkWeek(label)
  if (week === null) throw new Error(`bad week ${label}`)
  return { selectedKey: week.key, windowEndKey: week.key, range, dateRange: null }
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
    const [finals, sors, ncrs] = cardsOf(modelAt(index, WW42, 'week'), 'electrical')
    expect([finals.label, finals.value, finals.delta, finals.deltaDisplay, finals.trend]).toEqual(['Finals', 4, 2, "+2 vs WW41'2026", 'up'])
    expect([sors.label, sors.value, sors.deltaDisplay, sors.trend]).toEqual(['SORs', 1, "−1 vs WW41'2026", 'down'])
    expect([ncrs.label, ncrs.value, ncrs.deltaDisplay]).toEqual(['NCRs', 1, "+1 vs WW41'2026"])
  })

  it('shows the totals through W with +n this WW in To date', () => {
    const [finals, sors, ncrs] = cardsOf(modelAt(index, WW42, 'toDate'), 'electrical')
    expect([finals.value, finals.delta, finals.deltaDisplay, finals.trend]).toEqual([6, 4, '+4 this WW', 'none'])
    expect([sors.value, sors.deltaDisplay]).toEqual([3, '+1 this WW'])
    expect([ncrs.value, ncrs.deltaDisplay]).toEqual([1, '+1 this WW'])
  })

  it("rates W's finals only in This WW, with the change in points against W−1", () => {
    const rate = cardsOf(modelAt(index, WW42, 'week'), 'electrical')[3]
    expect(rate.label).toBe('NCR pass rate')
    expect(rate.value).toBe(75)
    expect(rate.display).toBe('75.0%')
    expect(rate.subLine).toBe('3 / 4 Finals')
    expect(rate.delta).toBe(-25)
    expect(rate.deltaDisplay).toBe("−25.0 pts vs WW41'2026")
  })

  it('rates the finals through W in To date, with the change against through W−1', () => {
    const rate = cardsOf(modelAt(index, WW42, 'toDate'), 'electrical')[3]
    expect(rate.value).toBeCloseTo(83.3333, 4)
    expect(rate.subLine).toBe('5 / 6 Finals')
    expect(rate.delta).toBeCloseTo(-16.6667, 4)
  })

  it('shows Finals and SORs in neutral', () => {
    const [finals, sors] = cardsOf(modelAt(index, WW42, 'week'), 'electrical')
    expect([finals.tone, sors.tone]).toEqual(['neutral', 'neutral'])
  })

  it('shows the NCR pass rate as n/a with the change n/a when W has no finals', () => {
    const sorsOnly = overviewIndexOf([inspection('Mechanical', WW41, 'Final'), inspection('Mechanical', WW42, 'SOR')])
    const rate = cardsOf(modelAt(sorsOnly, WW42, 'week'), 'mechanical')[3]
    expect([rate.value, rate.display, rate.subLine]).toEqual([null, 'n/a', '0 Finals'])
    expect([rate.delta, rate.deltaDisplay, rate.tone, rate.trend]).toEqual([null, 'Change n/a', 'neutral', 'none'])
  })

  it('shows the NCR pass rate change as n/a when W−1 has no finals', () => {
    const rate = cardsOf(modelAt(overviewIndexOf([inspection('Mechanical', WW42, 'Final')]), WW42, 'week'), 'mechanical')[3]
    expect([rate.value, rate.delta, rate.deltaDisplay]).toEqual([100, null, 'Change n/a'])
  })
})

describe('Electrical and Mechanical tones', () => {
  it('shows NCRs in amber when they go up', () => {
    const index = overviewIndexOf([inspection('Electrical', WW41, 'Final'), inspection('Electrical', WW42, 'Final', 'NCR')])
    expect(cardsOf(modelAt(index, WW42, 'week'), 'electrical')[2].tone).toBe('warn')
  })

  it('shows NCRs in neutral when they go down', () => {
    const index = overviewIndexOf([inspection('Electrical', WW41, 'Final', 'NCR'), inspection('Electrical', WW42, 'Final')])
    expect(cardsOf(modelAt(index, WW42, 'week'), 'electrical')[2].tone).toBe('neutral')
  })

  it('shows NCRs to date in amber when W added one', () => {
    const index = overviewIndexOf([inspection('Mechanical', WW41, 'Final', 'NCR'), inspection('Mechanical', WW42, 'Final', 'NCR')])
    expect(cardsOf(modelAt(index, WW42, 'toDate'), 'mechanical')[2].tone).toBe('warn')
  })

  it('shows NCRs to date in neutral when W added none', () => {
    const index = overviewIndexOf([inspection('Mechanical', WW41, 'Final', 'NCR'), inspection('Mechanical', WW42, 'Final')])
    expect(cardsOf(modelAt(index, WW42, 'toDate'), 'mechanical')[2].tone).toBe('neutral')
  })

  it('shows the NCR pass rate in green when it goes up', () => {
    const index = overviewIndexOf([
      inspection('Electrical', WW41, 'Final', 'NCR'),
      inspection('Electrical', WW41, 'Final'),
      inspection('Electrical', WW42, 'Final'),
    ])
    const rate = cardsOf(modelAt(index, WW42, 'week'), 'electrical')[3]
    expect([rate.tone, rate.trend, rate.deltaDisplay]).toEqual(['good', 'up', "+50.0 pts vs WW41'2026"])
  })

  it('shows the NCR pass rate in red when it goes down', () => {
    const index = overviewIndexOf([inspection('Electrical', WW41, 'Final'), inspection('Electrical', WW42, 'Final', 'NCR')])
    const rate = cardsOf(modelAt(index, WW42, 'toDate'), 'electrical')[3]
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
    const [logged, signed, , ncrs] = cardsOf(modelAt(index, WW42, 'week'), 'welding')
    expect([logged.label, logged.value, logged.deltaDisplay]).toEqual(['Welds logged', 0, "−1 vs WW41'2026"])
    expect([signed.label, signed.value, signed.deltaDisplay]).toEqual(['Signed', 2, "+1 vs WW41'2026"])
    expect([ncrs.label, ncrs.value, ncrs.deltaDisplay]).toEqual(['NCRs', 0, "−1 vs WW41'2026"])
  })

  it('counts signed welds through W with the welds signed in W underneath in To date', () => {
    const [logged, signed, , ncrs] = cardsOf(modelAt(index, WW42, 'toDate'), 'welding')
    expect([logged.value, logged.deltaDisplay]).toEqual([5, '+0 this WW'])
    expect([signed.value, signed.delta, signed.deltaDisplay]).toEqual([3, 2, '+2 signed this WW'])
    expect([ncrs.value, ncrs.deltaDisplay]).toEqual([1, '+0 this WW'])
  })

  it('shows Sign-off % for the latest weld week up to W that has welds in This WW', () => {
    const signoff = cardsOf(modelAt(overviewIndexOf([weld(WW40, { signedWeek: WW41 }), weld(WW40)]), WW42, 'week'), 'welding')[2]
    expect([signoff.label, signoff.value, signoff.display, signoff.subLine]).toEqual(['Sign-off %', 50, '50%', "1 of 2 · WW40'2026"])
    expect([signoff.delta, signoff.deltaDisplay, signoff.trend, signoff.tone]).toEqual([null, null, 'none', 'neutral'])
  })

  it('shows the overall Sign-off % with its change in points in To date', () => {
    const signoff = cardsOf(modelAt(index, WW41, 'toDate'), 'welding')[2]
    expect(signoff.value).toBe(60)
    expect(signoff.display).toBe('60.0%')
    expect(signoff.subLine).toBe('3 of 5 signed')
    expect(signoff.delta).toBeCloseTo(60 - 50, 6)
    expect([signoff.tone, signoff.trend, signoff.deltaDisplay]).toEqual(['good', 'up', "+10.0 pts vs WW40'2026"])
  })

  it('flags Sign-off % below 10% as bad', () => {
    const low = overviewIndexOf([weld(WW42, { signedWeek: WW42 }), ...times(19, () => weld(WW42))])
    expect(cardsOf(modelAt(low, WW42, 'week'), 'welding')[2]).toMatchObject({ value: 5, display: '5.0%', isValueBad: true })
    expect(cardsOf(modelAt(low, WW42, 'toDate'), 'welding')[2].isValueBad).toBe(true)
  })

  it('does not flag Sign-off % of 10% or more', () => {
    const fine = overviewIndexOf([weld(WW42, { signedWeek: WW42 }), ...times(9, () => weld(WW42))])
    expect(cardsOf(modelAt(fine, WW42, 'week'), 'welding')[2].isValueBad).toBe(false)
  })

  it('shows NCRs in amber when they go up', () => {
    expect(cardsOf(modelAt(index, WW41, 'week'), 'welding')[3].tone).toBe('warn')
  })

  it('shows Welds logged and Signed in neutral', () => {
    const [logged, signed] = cardsOf(modelAt(index, WW41, 'week'), 'welding')
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
    const [opened, closed] = cardsOf(modelAt(index, WW42, 'week'), 'bim')
    expect([opened.label, opened.value, opened.deltaDisplay]).toEqual(['Opened', 3, "+1 vs WW41'2026"])
    expect([closed.label, closed.value, closed.deltaDisplay]).toEqual(['Closed', 1, "No change vs WW41'2026"])
  })

  it('shows Opened and Closed through W in To date', () => {
    const [opened, closed] = cardsOf(modelAt(index, WW42, 'toDate'), 'bim')
    expect([opened.value, opened.deltaDisplay]).toEqual([6, '+3 this WW'])
    expect([closed.value, closed.deltaDisplay]).toEqual([2, '+1 this WW'])
  })

  it('shows Remaining open to date with the change against W−1 in both modes', () => {
    for (const mode of ['week', 'toDate'] as const) {
      const remaining = cardsOf(modelAt(index, WW42, mode), 'bim')[2]
      expect([remaining.label, remaining.value, remaining.delta, remaining.deltaDisplay]).toEqual(['Remaining open', 4, 2, "+2 vs WW41'2026"])
    }
  })

  it('shows Opened in amber when it goes up', () => {
    expect(cardsOf(modelAt(index, WW42, 'week'), 'bim')[0].tone).toBe('warn')
  })

  it('shows Opened in neutral when it goes down', () => {
    const fewer = overviewIndexOf([bim('#1', '10/6/2026'), bim('#2', '10/6/2026'), bim('#3', '10/13/2026')])
    expect(cardsOf(modelAt(fewer, WW42, 'week'), 'bim')[0].tone).toBe('neutral')
  })

  it('shows Closed in green when it is at least the previous value and above 0', () => {
    expect(cardsOf(modelAt(index, WW42, 'week'), 'bim')[1].tone).toBe('good')
  })

  it('shows Closed in neutral when nothing closed in either week', () => {
    const none = overviewIndexOf([bim('#1', '10/6/2026'), bim('#2', '10/13/2026')])
    expect(cardsOf(modelAt(none, WW42, 'week'), 'bim')[1].tone).toBe('neutral')
  })

  it('shows Closed in neutral when fewer closed than the week before', () => {
    const fewer = overviewIndexOf([
      bim('#1', '10/6/2026', { status: 'Closed', updatedOn: '10/7/2026' }),
      bim('#2', '10/6/2026', { status: 'Closed', updatedOn: '10/7/2026' }),
      bim('#3', '10/6/2026', { status: 'Closed', updatedOn: '10/13/2026' }),
    ])
    expect(cardsOf(modelAt(fewer, WW42, 'week'), 'bim')[1].tone).toBe('neutral')
  })

  /** One issue opened in WW41 and another opened in WW41 and closed in WW42, so Remaining open falls in WW42. */
  const closing = overviewIndexOf([
    bim('#1', '10/6/2026'),
    bim('#2', '10/6/2026', { status: 'Closed', updatedOn: '10/13/2026' }),
  ])
  /** One issue opened and closed in WW41 and another opened in WW42, so Remaining open rises in WW42. */
  const opening = overviewIndexOf([
    bim('#1', '10/6/2026', { status: 'Closed', updatedOn: '10/7/2026' }),
    bim('#2', '10/13/2026'),
  ])

  it('shows Remaining open in red when it goes up', () => {
    expect(cardsOf(modelAt(index, WW42, 'week'), 'bim')[2].tone).toBe('bad')
  })

  it('shows Remaining open in green when it goes down', () => {
    expect(cardsOf(modelAt(closing, WW42, 'week'), 'bim')[2].tone).toBe('good')
  })

  it('shows Opened to date in red when it goes up, as Total Opened does in BIM Issues', () => {
    expect(cardsOf(modelAt(index, WW42, 'toDate'), 'bim')[0].tone).toBe('bad')
  })

  it('shows Opened to date in neutral when nothing opened in W', () => {
    expect(cardsOf(modelAt(closing, WW42, 'toDate'), 'bim')[0].tone).toBe('neutral')
  })

  it('shows Closed to date in green when something closed in W', () => {
    expect(cardsOf(modelAt(closing, WW42, 'toDate'), 'bim')[1].tone).toBe('good')
  })

  it('shows Closed to date in neutral when nothing closed in W', () => {
    expect(cardsOf(modelAt(opening, WW42, 'toDate'), 'bim')[1].tone).toBe('neutral')
  })

  it('shows Remaining open to date in red when it goes up', () => {
    expect(cardsOf(modelAt(opening, WW42, 'toDate'), 'bim')[2].tone).toBe('bad')
  })

  it('shows Remaining open to date in green when it goes down', () => {
    expect(cardsOf(modelAt(closing, WW42, 'toDate'), 'bim')[2].tone).toBe('good')
  })
})

/** `count` issues created on 9/1/2026 and closed `days` later in September or October. */
function closedIssues(prefix: string, count: number, updatedOn: string): unknown[][] {
  return Array.from({ length: count }, (_, at) => bim(`${prefix}${at}`, '9/1/2026', { status: 'Closed', updatedOn }))
}

describe('BIM Issues past normal close window', () => {
  // Nine issues close in 10 days and one in 30, so the window (90th percentile) is 10 days and the slowest is 30.
  const CLOSURES = [...closedIssues('#c', 9, '9/11/2026'), ...closedIssues('#s', 1, '10/1/2026')]
  // As of WW42 (capped at today, 10/15): 5, 14 and 45 days old.
  const index = overviewIndexOf([...CLOSURES, bim('#o1', '10/10/2026'), bim('#o2', '10/1/2026'), bim('#o3', '8/31/2026')])

  it('counts the open issues older than the window, with the open, older-than-any and closed counts', () => {
    const past = cardsOf(modelAt(index, WW42, 'week'), 'bim')[3]
    expect([past.label, past.value, past.display, past.subLine]).toEqual([
      'Past normal close window',
      2,
      '2',
      'of 3 open · 1 older than any closure · 76.9% closed',
    ])
    expect([past.delta, past.deltaDisplay, past.trend]).toEqual([null, null, 'none'])
  })

  it('shows the same card as of W in both modes', () => {
    expect(cardsOf(modelAt(index, WW42, 'toDate'), 'bim')[3]).toEqual(cardsOf(modelAt(index, WW42, 'week'), 'bim')[3])
  })

  it('counts as of the selected week', () => {
    // As of WW41 (10/11): 1, 10 and 41 days old, and an age equal to the window is not past it.
    expect(cardsOf(modelAt(index, WW41, 'week'), 'bim')[3].subLine).toBe('of 3 open · 1 older than any closure · 76.9% closed')
    expect(cardsOf(modelAt(index, WW41, 'week'), 'bim')[3].value).toBe(1)
  })

  it('shows the card in red when any issue is past the window', () => {
    expect(cardsOf(modelAt(index, WW42, 'week'), 'bim')[3].tone).toBe('bad')
  })

  it('shows the card in neutral when no issue is past the window', () => {
    const recent = overviewIndexOf([...CLOSURES, bim('#o1', '10/10/2026')])
    const past = cardsOf(modelAt(recent, WW42, 'week'), 'bim')[3]
    expect([past.value, past.display, past.tone]).toEqual([0, '0', 'neutral'])
  })

  it('shows n/a without closures as of W', () => {
    const unclosed = overviewIndexOf([bim('#o1', '10/10/2026'), bim('#o2', '10/1/2026')])
    const past = cardsOf(modelAt(unclosed, WW42, 'week'), 'bim')[3]
    expect([past.value, past.display, past.subLine, past.tone]).toEqual([null, 'n/a', '2 open · no closures yet', 'neutral'])
  })

  it('says no issues were opened yet before the first issue', () => {
    const later = overviewIndexOf([bim('#1', '10/13/2026'), inspection('Electrical', WW40, 'Final')])
    const past = cardsOf(modelAt(later, WW40, 'week'), 'bim')[3]
    expect([past.value, past.display, past.subLine]).toEqual([null, 'n/a', 'No issues opened yet'])
  })
})

describe('Top root cause', () => {
  const index = overviewIndexOf([
    bim('#1', '10/6/2026', { rootCause: 'Installation' }), // WW41
    bim('#2', '10/5/2026', { rootCause: ' installation ' }), // WW41, the earliest spelling
    bim('#3', '10/6/2026', { rootCause: 'Coordination' }), // WW41
    bim('#4', '10/13/2026', { rootCause: 'Trade Damage' }), // WW42
    bim('#5', '10/14/2026', { rootCause: 'Bonding' }), // WW42
    bim('#6', '10/13/2026'), // WW42, not recorded
    inspection('Electrical', WW40, 'Final'), // so WW40 is in the data
  ])

  function topAt(at: OverviewIndex, label: string, mode: CardMode): OverviewModel['quality'][5] {
    return modelAt(at, label, mode).quality[5]
  }

  it('is the sixth quality card', () => {
    expect(modelAt(index, WW42, 'week').quality.map((card) => card.label))
      .toEqual(['CORs', 'NCRs', 'Inspection NCR pass rate', 'Welding NCR pass rate', 'DWNs', 'Top root cause'])
  })

  it('shows the most common cause through W in To date, grouped by case and spacing under the earliest spelling', () => {
    const top = topAt(index, WW42, 'toDate')
    expect([top.value, top.display, top.subLine]).toEqual([2, 'installation', '2 of 6 issues · 33%'])
  })

  it('shows the most common cause among issues created in W in This WW, ties by name', () => {
    const top = topAt(index, WW42, 'week')
    expect([top.value, top.display, top.subLine]).toEqual([1, 'Bonding', '1 of 3 opened this WW'])
  })

  it('shows None when no issue was opened in W', () => {
    const top = topAt(index, WW40, 'week')
    expect([top.value, top.display, top.subLine]).toEqual([null, 'None', 'None opened this WW'])
  })

  it('shows None when no issue was opened through W', () => {
    const top = topAt(index, WW40, 'toDate')
    expect([top.value, top.display, top.subLine]).toEqual([null, 'None', 'No issues to date'])
  })

  it('shows None when no issue in scope has a cause recorded', () => {
    const blank = overviewIndexOf([bim('#1', '10/13/2026'), bim('#2', '10/14/2026')])
    expect([topAt(blank, WW42, 'week').display, topAt(blank, WW42, 'week').subLine]).toEqual(['None', '2 opened this WW · none recorded'])
    expect([topAt(blank, WW42, 'toDate').display, topAt(blank, WW42, 'toDate').subLine]).toEqual(['None', '2 issues · none recorded'])
  })

  it('asks for Root Cause in both modes when the slot is unbound', () => {
    const unbound = overviewIndexOf([bim('#1', '10/13/2026', { rootCause: 'Installation' })], undefined, UNBOUND_ROOT_CAUSE_COLUMNS)
    for (const mode of ['week', 'toDate'] as const) {
      const top = topAt(unbound, WW42, mode)
      expect([top.value, top.display, top.subLine]).toEqual([null, 'n/a', 'Add Root Cause'])
    }
  })

  it('shows no change line and a neutral tone', () => {
    for (const mode of ['week', 'toDate'] as const) {
      const top = topAt(index, WW42, mode)
      expect([top.delta, top.deltaDisplay, top.trend, top.tone]).toEqual([null, null, 'none', 'neutral'])
    }
  })

  it('gives a cause name its full text as a tooltip, since a long name is cut short', () => {
    expect(topAt(index, WW42, 'toDate').valueTitle).toBe('installation')
    expect(topAt(index, WW40, 'week').valueTitle).toBeUndefined()
  })
})

describe('missing and early disciplines', () => {
  it('marks a source with no rows as not connected and says so', () => {
    const model = modelAt(overviewIndexOf([inspection('Electrical', WW42, 'Final')]), WW42, 'week')
    expect(model.rows.electrical.connected).toBe(true)
    expect(model.rows.mechanical).toEqual({ connected: false, message: 'Not connected: no Mechanical rows in QCx Combined' })
    expect(model.rows.welding).toEqual({ connected: false, message: 'Not connected: no Welding rows in QCx Combined' })
    expect(model.rows.bim).toEqual({ connected: false, message: 'Not connected: no BIM Issues rows in QCx Combined' })
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
    expect(cardsOf(week, 'mechanical').map((card) => card.value)).toEqual([0, 0, 0, null])
    expect(cardsOf(toDate, 'mechanical').map((card) => card.value)).toEqual([0, 0, 0, null])
    expect(cardsOf(week, 'welding').map((card) => card.value)).toEqual([0, 0, null, 0])
    expect(cardsOf(week, 'welding')[2].subLine).toBe('No welds logged yet')
    expect(cardsOf(toDate, 'welding')[2].value).toBeNull()
    expect(cardsOf(week, 'bim').map((card) => card.value)).toEqual([0, 0, 0, null])
    expect(week.quality.map((card) => card.value)).toEqual([0, 0, null, null, 0, null])
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
    const row = rowOf(modelAt(index, WW42, 'week'), 'electrical')
    expect(row.sparkline).toHaveLength(30)
    expect(row.sparkline.slice(-2)).toEqual([2, 6])
    expect(row.sparklineSelected).toBe(29)
  })

  it('ends at the selected week', () => {
    const row = rowOf(modelAt(index, WW41, 'week'), 'electrical')
    expect(row.sparkline[row.sparkline.length - 1]).toBe(2)
    expect(row.sparklineSelected).toBe(29)
  })

  it('is shorter when fewer than 30 weeks lead up to W', () => {
    const row = rowOf(modelAt(index, "WW03'2026", 'week'), 'electrical')
    expect(row.sparkline).toEqual([1, 0, 0])
    expect(row.sparklineSelected).toBe(2)
  })

  it('states the change at W in words', () => {
    const model = modelAt(index, WW42, 'week')
    expect(rowOf(model, 'electrical').trendText).toBe("up 4 vs WW41'2026")
    expect(rowOf(model, 'welding').trendText).toBe("down 1 vs WW41'2026")
    expect(rowOf(model, 'bim').trendText).toBe("no change vs WW41'2026")
  })

  it('plots Welds logged for Welding and Remaining open for BIM', () => {
    const model = modelAt(index, WW42, 'week')
    expect(rowOf(model, 'welding').sparkline.slice(-2)).toEqual([2, 1])
    expect(rowOf(model, 'bim').sparkline.slice(-3)).toEqual([0, 1, 1])
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
    expect(cardsOf(model, 'electrical')[0].deltaDisplay).toBe("+1 vs WW52'2025")
  })
})

describe('cards and series built apart', () => {
  const index = overviewIndexOf([
    inspection('Electrical', WW41, 'Final'),
    inspection('Mechanical', WW42, 'SOR'),
    weld(WW42, { signedWeek: WW42 }),
    bim('#1', '10/13/2026'),
  ])

  it('builds the chart series from the view alone, matching the model', () => {
    const model = modelAt(index, WW42, 'week')
    const series = buildOverviewSeries(index, viewAt(WW42))
    expect(series.activity).toEqual(model.activity)
    expect(series.rates).toEqual(model.rates)
    expect(series.windowTotals).toEqual(model.windowTotals)
  })

  it('builds the cards for a mode, matching the model', () => {
    const model = modelAt(index, WW42, 'toDate')
    const cards = buildOverviewCards(index, viewAt(WW42), 'toDate')
    expect(cards.rows).toEqual(model.rows)
    expect(cards.quality).toEqual(model.quality)
    expect(cards.selectedWeek).toEqual(model.selectedWeek)
    expect(cards.hasData).toBe(true)
    expect('activity' in cards).toBe(false)
  })
})
