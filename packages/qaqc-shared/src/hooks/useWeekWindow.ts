import { useMemo, useState } from 'react'

import { recentWindowStart } from '../inspections'
import type { RangeMode, ViewState } from '../types'

/** The parts of a dashboard index the week and window state reads. */
export interface WeekWindowIndex {
  currentWeek: { key: number }
  positionByKey: ReadonlyMap<number, number>
}

export interface WeekWindow {
  /** The selected week, the window's last week, and the range, for the dashboard's model. */
  view: ViewState
  range: RangeMode
  /** A bar click or chart keyboard selection: selects the week and leaves the window where it is. */
  selectWeek: (key: number) => void
  /** The week picker: selects the week and moves the window to end on it. */
  pickWeek: (key: number) => void
  changeRange: (mode: RangeMode) => void
}

/** The selected week, the window end and the range that every QAQC dashboard keeps. */
export function useWeekWindow(index: WeekWindowIndex): WeekWindow {
  const [selectedKey, setSelectedKey] = useState(index.currentWeek.key)
  const [windowEndKey, setWindowEndKey] = useState(index.currentWeek.key)
  const [range, setRange] = useState<RangeMode>('recent')

  // Keep the user's week across data refreshes when it still exists; otherwise use the current week.
  const isSelectionInData = index.positionByKey.has(selectedKey)
  const effectiveSelected = isSelectionInData ? selectedKey : index.currentWeek.key
  const effectiveEnd = isSelectionInData && index.positionByKey.has(windowEndKey) ? windowEndKey : index.currentWeek.key
  const view = useMemo(
    () => ({ selectedKey: effectiveSelected, windowEndKey: effectiveEnd, range }),
    [effectiveSelected, effectiveEnd, range],
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

  function pickWeek(key: number): void {
    setSelectedKey(key)
    setWindowEndKey(key)
  }

  return { view, range, selectWeek: setSelectedKey, pickWeek, changeRange }
}
