import { useCallback, useMemo, useState } from 'react'

import { recentWindowStart } from '../inspections'
import type { RangeMode, ViewState } from '../types'
import type { WeekRange } from '../weekRange'

/** The parts of a dashboard index the week and window state reads. */
export interface WeekWindowIndex {
  currentWeek: { key: number }
  positionByKey: ReadonlyMap<number, number>
}

export interface WeekWindow {
  /** The selected week, the window's last week, and the range, for the dashboard's model. */
  view: ViewState
  range: RangeMode
  /**
   * A bar click or chart keyboard selection: selects the week and leaves the window where it is. In a date range the
   * window ends on the week too, so the week is still inside the window once the range is cleared.
   */
  selectWeek: (key: number) => void
  /** The week picker: selects the week and moves the window to end on it. */
  pickWeek: (key: number) => void
  changeRange: (mode: RangeMode) => void
}

/**
 * The selected week, the window end and the range that every QAQC dashboard keeps. A date range only limits what they
 * read as: the stored weeks stay as they were, so clearing the range returns to them.
 */
export function useWeekWindow(index: WeekWindowIndex, dateRange: WeekRange | null = null): WeekWindow {
  const [selectedKey, setSelectedKey] = useState(index.currentWeek.key)
  const [windowEndKey, setWindowEndKey] = useState(index.currentWeek.key)
  const [range, setRange] = useState<RangeMode>('recent')

  // Keep the user's week across data refreshes when it still exists; otherwise use the current week.
  const isSelectionInData = index.positionByKey.has(selectedKey)
  const availableSelected = isSelectionInData ? selectedKey : index.currentWeek.key
  const availableEnd = isSelectionInData && index.positionByKey.has(windowEndKey) ? windowEndKey : index.currentWeek.key
  // The axis has every week of a range, filtered or not, so either limit is a week the index has.
  function intoRange(key: number): number {
    return dateRange === null ? key : Math.min(Math.max(key, dateRange.fromKey), dateRange.toKey)
  }
  const effectiveSelected = intoRange(availableSelected)
  const effectiveEnd = intoRange(availableEnd)
  const view = useMemo(
    () => ({ selectedKey: effectiveSelected, windowEndKey: effectiveEnd, range, dateRange }),
    [effectiveSelected, effectiveEnd, range, dateRange],
  )

  function changeRange(mode: RangeMode): void {
    setRange(mode)
    if (mode !== 'recent') return
    // Returning to the recent range must not leave the selected week outside the visible window.
    const selectedPosition = index.positionByKey.get(effectiveSelected)
    const endPosition = index.positionByKey.get(effectiveEnd)
    if (selectedPosition === undefined || endPosition === undefined) return
    if (selectedPosition > endPosition || selectedPosition < recentWindowStart(endPosition)) {
      setWindowEndKey(effectiveSelected)
    }
  }

  const isInRange = dateRange !== null
  const selectWeek = useCallback(
    (key: number): void => {
      setSelectedKey(key)
      if (isInRange) setWindowEndKey(key)
    },
    [isInRange],
  )

  function pickWeek(key: number): void {
    setSelectedKey(key)
    setWindowEndKey(key)
  }

  return { view, range, selectWeek, pickWeek, changeRange }
}
