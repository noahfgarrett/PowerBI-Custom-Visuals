import { useEffect, useState, type KeyboardEvent } from 'react'

export interface WeekFocusOptions {
  /** Number of weeks in the chart. */
  count: number
  /** Index of the selected week, or −1 when it is not in the chart. */
  selectedIndex: number
  /** Enter and Space select the focused week only when interactions are allowed. */
  interactive: boolean
  onSelect: (index: number) => void
}

export interface WeekFocusSvgProps {
  tabIndex: number
  onKeyDown: (event: KeyboardEvent<SVGSVGElement>) => void
  onFocus: () => void
  onBlur: () => void
  onMouseDown: () => void
}

export interface WeekFocus {
  /** The focused week index, inside 0…count − 1 (−1 when there are no weeks). */
  focus: number
  hasFocus: boolean
  /** True only after keyboard use while focused, so mouse users never see the ring. */
  showFocusRing: boolean
  /** Spread onto the chart's `<svg>`. */
  svgProps: WeekFocusSvgProps
}

const STEP_KEYS: Readonly<Record<string, (focus: number, count: number) => number>> = {
  ArrowLeft: (focus) => focus - 1,
  ArrowRight: (focus) => focus + 1,
  Home: () => 0,
  End: (_, count) => count - 1,
}

/** Keyboard week focus for a week chart: arrows, Home and End move; Enter and Space select. */
export function useWeekFocus({ count, selectedIndex, interactive, onSelect }: WeekFocusOptions): WeekFocus {
  const [focusIndex, setFocusIndex] = useState(selectedIndex >= 0 ? selectedIndex : count - 1)
  const [hasFocus, setHasFocus] = useState(false)
  const [showFocusRing, setShowFocusRing] = useState(false)

  useEffect(() => {
    if (selectedIndex >= 0) setFocusIndex(selectedIndex)
  }, [selectedIndex])

  const focus = Math.min(Math.max(focusIndex, 0), count - 1)

  function onKeyDown(event: KeyboardEvent<SVGSVGElement>): void {
    if (count === 0) return
    const step = STEP_KEYS[event.key]
    if (step !== undefined) {
      event.preventDefault()
      setShowFocusRing(true)
      setFocusIndex(Math.min(Math.max(step(focus, count), 0), count - 1))
      return
    }
    if ((event.key === 'Enter' || event.key === ' ') && interactive) {
      event.preventDefault()
      setShowFocusRing(true)
      onSelect(focus)
    }
  }

  return {
    focus,
    hasFocus,
    showFocusRing,
    svgProps: {
      tabIndex: 0,
      onKeyDown,
      onFocus: () => setHasFocus(true),
      onBlur: () => {
        setHasFocus(false)
        setShowFocusRing(false)
      },
      onMouseDown: () => setShowFocusRing(false),
    },
  }
}
