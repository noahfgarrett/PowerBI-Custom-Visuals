import { act, type ReactElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { useWeekWindow, type WeekWindow, type WeekWindowIndex } from '../hooks/useWeekWindow'
import { RECENT_WEEK_COUNT } from '../inspections'
import type { ViewState } from '../types'
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

function Probe({ index }: { index: WeekWindowIndex }): ReactElement {
  const state = useWeekWindow(index)
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
    expect(current().view).toEqual({ selectedKey: 100, windowEndKey: 100, range: 'recent' })
    expect(current().range).toBe('recent')
  })

  it('selects a week without moving the window', () => {
    mount(weeksIndex(100))
    run((state) => state.selectWeek(90))
    expect(current().view).toEqual({ selectedKey: 90, windowEndKey: 100, range: 'recent' })
  })

  it('moves the window to a week picked in the dropdown', () => {
    mount(weeksIndex(100))
    run((state) => state.pickWeek(40))
    expect(current().view).toEqual({ selectedKey: 40, windowEndKey: 40, range: 'recent' })
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
    expect(current().view).toEqual({ selectedKey: 10, windowEndKey: 10, range: 'recent' })
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
    expect(current().view).toEqual({ selectedKey: 100, windowEndKey: 100, range: 'recent' })
  })

  it('moves the window back to the current week when only the window end is removed', () => {
    mount(weeksIndex(100))
    run((state) => state.pickWeek(50))
    run((state) => state.selectWeek(40))
    view?.rerender(<Probe index={sparseIndex([40, 60, 100])} />)
    expect(current().view).toEqual({ selectedKey: 40, windowEndKey: 100, range: 'recent' })
  })

  it('returns to the picked week when a later refresh brings it back', () => {
    mount(weeksIndex(100))
    run((state) => state.pickWeek(10))
    view?.rerender(<Probe index={sparseIndex([50, 100])} />)
    view?.rerender(<Probe index={weeksIndex(100)} />)
    expect(current().view).toEqual({ selectedKey: 10, windowEndKey: 10, range: 'recent' })
  })

  it('keeps the same view object while its keys and range stay the same', () => {
    const index = weeksIndex(100)
    mount(index)
    view?.rerender(<Probe index={index} />)
    expect(seenViews).toHaveLength(2)
    expect(seenViews[1]).toBe(seenViews[0])
  })
})
