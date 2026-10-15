import { useState, type RefObject, type UIEvent } from 'react'

import { useElementSize } from './useElementSize'

/**
 * The height of one `.qaqc-table` body row in a windowed table, in px. Windowed tables set it inline on every row
 * (`style={{ height: TABLE_ROW_HEIGHT }}`) and `.qaqc-table.is-windowed` in qaqc.less keeps cells on one line, so
 * the rendered rows are exactly this tall and the spacer heights stay true. Change it here, not in the CSS.
 */
export const TABLE_ROW_HEIGHT = 32

/** Rows rendered beyond each edge of the viewport, so fast scrolling does not flash empty space. */
const OVERSCAN = 10

export interface VirtualRows<T extends HTMLElement> {
  /** Attach to the scroll container. */
  containerRef: RefObject<T | null>
  /** Attach to the scroll container's `onScroll`. */
  onScroll: (event: UIEvent<T>) => void
  /** First rendered row index. */
  start: number
  /** One past the last rendered row index. */
  end: number
  /** Height of the spacer standing in for the rows above `start`. */
  paddingTop: number
  /** Height of the spacer standing in for the rows from `end` on. */
  paddingBottom: number
}

/**
 * Windows a long list of fixed-height rows inside a scroll container: only the rows in view, plus overscan, are
 * rendered. A sticky header inside the container takes some of the viewport; the overscan covers it.
 */
export function useVirtualRows<T extends HTMLElement>(count: number, rowHeight: number): VirtualRows<T> {
  const [containerRef, size] = useElementSize<T>()
  // The first row in view. Kept as a row index, so scrolling within a row does not re-render.
  const [firstInView, setFirstInView] = useState(0)

  function onScroll(event: UIEvent<T>): void {
    const next = Math.max(0, Math.floor(event.currentTarget.scrollTop / rowHeight))
    setFirstInView((current) => (current === next ? current : next))
  }

  const visible = Math.ceil(size.height / rowHeight)
  const first = Math.min(firstInView, count)
  const start = Math.max(0, first - OVERSCAN)
  const end = Math.min(count, first + visible + OVERSCAN)

  return {
    containerRef,
    onScroll,
    start,
    end,
    paddingTop: start * rowHeight,
    paddingBottom: (count - end) * rowHeight,
  }
}
