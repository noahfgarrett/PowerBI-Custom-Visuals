import { act, type ReactElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { useWeekWindow, type WeekWindow, type WeekWindowIndex } from '../hooks/useWeekWindow'
import { RECENT_WEEK_COUNT, recentWindowStart } from '../inspections'
import type { ViewState } from '../types'
import type { WeekRange } from '../weekRange'
import { render, type Rendered } from './render'

let view: Rendered | null = null
let latest: WeekWindow | null = null
const seenViews: ViewState[] = []

afterEach(() => {
  view?.unmount()
  view = null
  latest = null
  seenViews.length = 0
})

/** Weeks 1..count as keys 1..count; the current week is the last. */
function weeksIndex(count: number, currentKey = count): WeekWindowIndex {
  const positionByKey = new Map<number, number>()
  for (let key = 1; key <= count; key += 1) positionByKey.set(key, key - 1)
  return { currentWeek: { key: currentKey }, positionByKey }
}

/** Only these keys exist (positions in the order given); the current week is the last. */
function sparseIndex(keys: number[]): WeekWindowIndex {
  return { currentWeek: { key: keys[keys.length - 1] }, positionByKey: new Map(keys.map((key, position) => [key, position])) }
}

function Probe({ index, dateRange }: { index: WeekWindowIndex; dateRange?: WeekRange | null }): ReactElement {
  const state = useWeekWindow(index, dateRange)
  latest = state
  seenViews.push(state.view)
  return <span />
}

function mount(index: WeekWindowIndex): void {
  view = render(<Probe index={index} />)
}

function current(): WeekWindow {
  if (latest === null) throw new Error('hook not rendered')
  return latest
}

function run(action: (state: WeekWindow) => void): void {
  act(() => {
    action(current())
  })
}

describe('useWeekWindow', () => {
  it('opens on the current week with the recent range ending there', () => {
    mount(weeksIndex(100))
    expect(current().view).toEqual({ selectedKey: 100, windowEndKey: 100, range: 'recent', dateRange: null })
    expect(current().range).toBe('recent')
  })

  it('selects a week without moving the window', () => {
    mount(weeksIndex(100))
    run((state) => state.selectWeek(90))
    expect(current().view).toEqual({ selectedKey: 90, windowEndKey: 100, range: 'recent', dateRange: null })
  })

  it('moves the window to a week picked in the dropdown', () => {
    mount(weeksIndex(100))
    run((state) => state.pickWeek(40))
    expect(current().view).toEqual({ selectedKey: 40, windowEndKey: 40, range: 'recent', dateRange: null })
  })

  it('switches the range', () => {
    mount(weeksIndex(100))
    run((state) => state.changeRange('all'))
    expect(current().range).toBe('all')
    expect(current().view.range).toBe('all')
  })

  it('moves the window to a selected week before it when switching back to the recent range', () => {
    mount(weeksIndex(100))
    run((state) => state.changeRange('all'))
    run((state) => state.selectWeek(10))
    run((state) => state.changeRange('recent'))
    expect(current().view).toEqual({ selectedKey: 10, windowEndKey: 10, range: 'recent', dateRange: null })
  })

  it('moves the window to a selected week after it when switching back to the recent range', () => {
    mount(weeksIndex(100))
    run((state) => state.pickWeek(50))
    run((state) => state.changeRange('all'))
    run((state) => state.selectWeek(80))
    run((state) => state.changeRange('recent'))
    expect(current().view.windowEndKey).toBe(80)
  })

  it('leaves the window alone when the selection is already in the recent window', () => {
    mount(weeksIndex(100))
    run((state) => state.changeRange('all'))
    run((state) => state.selectWeek(100 - RECENT_WEEK_COUNT + 1))
    run((state) => state.changeRange('recent'))
    expect(current().view.windowEndKey).toBe(100)
  })

  it('moves the window when the selection is one week before the recent window', () => {
    mount(weeksIndex(100))
    run((state) => state.changeRange('all'))
    run((state) => state.selectWeek(100 - RECENT_WEEK_COUNT))
    run((state) => state.changeRange('recent'))
    expect(current().view.windowEndKey).toBe(100 - RECENT_WEEK_COUNT)
  })

  it('falls back to the current week for both keys when a refresh removes the selected week', () => {
    mount(weeksIndex(100))
    run((state) => state.pickWeek(10))
    view?.rerender(<Probe index={sparseIndex([50, 60, 100])} />)
    expect(current().view).toEqual({ selectedKey: 100, windowEndKey: 100, range: 'recent', dateRange: null })
  })

  it('moves the window back to the current week when only the window end is removed', () => {
    mount(weeksIndex(100))
    run((state) => state.pickWeek(50))
    run((state) => state.selectWeek(40))
    view?.rerender(<Probe index={sparseIndex([40, 60, 100])} />)
    expect(current().view).toEqual({ selectedKey: 40, windowEndKey: 100, range: 'recent', dateRange: null })
  })

  it('returns to the picked week when a later refresh brings it back', () => {
    mount(weeksIndex(100))
    run((state) => state.pickWeek(10))
    view?.rerender(<Probe index={sparseIndex([50, 100])} />)
    view?.rerender(<Probe index={weeksIndex(100)} />)
    expect(current().view).toEqual({ selectedKey: 10, windowEndKey: 10, range: 'recent', dateRange: null })
  })

  it('keeps the same view object while its keys and range stay the same', () => {
    const index = weeksIndex(100)
    mount(index)
    view?.rerender(<Probe index={index} />)
    expect(seenViews).toHaveLength(2)
    expect(seenViews[1]).toBe(seenViews[0])
  })

  it('a date range clamps the selected week and window into it, and clearing it restores the prior selection when still valid', () => {
    const index = weeksIndex(100)
    const range: WeekRange = { fromKey: 40, toKey: 60 }
    mount(index)
    run((state) => state.pickWeek(90))
    run((state) => state.selectWeek(80))

    view?.rerender(<Probe index={index} dateRange={range} />)
    expect(current().view).toEqual({ selectedKey: 60, windowEndKey: 60, range: 'recent', dateRange: range })

    view?.rerender(<Probe index={index} dateRange={{ fromKey: 95, toKey: 99 }} />)
    expect(current().view.selectedKey).toBe(95)

    view?.rerender(<Probe index={index} dateRange={null} />)
    expect(current().view).toEqual({ selectedKey: 80, windowEndKey: 90, range: 'recent', dateRange: null })
  })

  it('keeps a selection already inside the date range, and lets a pick move it within the range', () => {
    const index = weeksIndex(100)
    const range: WeekRange = { fromKey: 40, toKey: 60 }
    mount(index)
    run((state) => state.pickWeek(50))
    view?.rerender(<Probe index={index} dateRange={range} />)
    expect(current().view.selectedKey).toBe(50)
    run((state) => state.pickWeek(45))
    expect(current().view).toEqual({ selectedKey: 45, windowEndKey: 45, range: 'recent', dateRange: range })
  })

  it('a selected week missing from a filtered index falls back without throwing', () => {
    mount(weeksIndex(100))
    run((state) => state.pickWeek(10))
    view?.rerender(<Probe index={sparseIndex([50, 60, 100])} />)
    expect(current().view.selectedKey).toBe(100)
  })

  it('a bar click inside a date range moves the window with it, so clearing the range leaves the week in the window', () => {
    const index = weeksIndex(100)
    mount(index)
    view?.rerender(<Probe index={index} dateRange={{ fromKey: 40, toKey: 60 }} />)
    run((state) => state.selectWeek(50))
    expect(current().view.selectedKey).toBe(50)

    view?.rerender(<Probe index={index} dateRange={null} />)
    const { selectedKey, windowEndKey } = current().view
    expect(selectedKey).toBe(50)
    expect(selectedKey).toBeLessThanOrEqual(windowEndKey)
    expect(selectedKey).toBeGreaterThanOrEqual(recentWindowStart(windowEndKey))
  })

  it('leaves the window end alone when a bar is clicked with no date range', () => {
    const index = weeksIndex(100)
    mount(index)
    view?.rerender(<Probe index={index} dateRange={{ fromKey: 40, toKey: 60 }} />)
    view?.rerender(<Probe index={index} dateRange={null} />)
    run((state) => state.selectWeek(90))
    expect(current().view).toEqual({ selectedKey: 90, windowEndKey: 100, range: 'recent', dateRange: null })
  })

  it('keeps selectWeek the same function between renders while the date range stays the same', () => {
    const index = weeksIndex(100)
    mount(index)
    const before = current().selectWeek
    view?.rerender(<Probe index={index} />)
    expect(current().selectWeek).toBe(before)
  })

  it('keeps the same view object while the date range stays the same', () => {
    const index = weeksIndex(100)
    const range: WeekRange = { fromKey: 40, toKey: 60 }
    mount(index)
    view?.rerender(<Probe index={index} dateRange={range} />)
    const before = current().view
    view?.rerender(<Probe index={index} dateRange={range} />)
    expect(current().view).toBe(before)
  })
})

describe('useWeekWindow unrangedView', () => {
  it('is the view itself with no date range', () => {
    mount(weeksIndex(100))
    expect(current().unrangedView).toBe(current().view)
  })

  it('reads the stored weeks in a date range, while the view clamps', () => {
    const index = weeksIndex(100)
    const range = { fromKey: 40, toKey: 60 }
    view = render(<Probe index={index} />)
    view.rerender(<Probe index={index} dateRange={range} />)
    expect(current().view).toMatchObject({ selectedKey: 60, windowEndKey: 60, dateRange: range })
    expect(current().unrangedView).toEqual({ selectedKey: 100, windowEndKey: 100, range: 'recent', dateRange: null })
  })

  it('a week picked on a page outside the range is what the page reads, and the view still clamps', () => {
    const index = weeksIndex(100)
    const range = { fromKey: 40, toKey: 60 }
    view = render(<Probe index={index} />)
    view.rerender(<Probe index={index} dateRange={range} />)
    run((state) => state.pickWeek(10))
    expect(current().unrangedView).toMatchObject({ selectedKey: 10, windowEndKey: 10 })
    expect(current().view).toMatchObject({ selectedKey: 40, windowEndKey: 40 })
  })

  it('switching to 30 WW on a page keeps the stored week inside the page\'s window', () => {
    const index = weeksIndex(100)
    const range = { fromKey: 40, toKey: 60 }
    view = render(<Probe index={index} />)
    view.rerender(<Probe index={index} dateRange={range} />)
    run((state) => state.changeRange('all'))
    run((state) => state.selectWeek(5))
    run((state) => state.changeRange('recent'))
    const { selectedKey, windowEndKey } = current().unrangedView
    expect(selectedKey).toBe(5)
    expect(windowEndKey).toBe(5)
  })
})
