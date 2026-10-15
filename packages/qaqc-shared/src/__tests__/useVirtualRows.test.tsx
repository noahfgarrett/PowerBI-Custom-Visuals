import { act, type ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useVirtualRows } from '../hooks/useVirtualRows'
import { render, type Rendered } from './render'

const ROW_HEIGHT = 20
const VIEWPORT_HEIGHT = 200

let view: Rendered | null = null

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 400, VIEWPORT_HEIGHT))
})

afterEach(() => {
  view?.unmount()
  view = null
  vi.restoreAllMocks()
})

function Probe({ count }: { count: number }): ReactElement {
  const { containerRef, onScroll, start, end, paddingTop, paddingBottom } = useVirtualRows<HTMLDivElement>(count, ROW_HEIGHT)
  return (
    <div ref={containerRef} onScroll={onScroll} data-window={[start, end, paddingTop, paddingBottom].join(',')} />
  )
}

function windowOf(): number[] {
  return (view?.container.firstElementChild?.getAttribute('data-window') ?? '').split(',').map(Number)
}

function scrollTo(top: number): void {
  const element = view?.container.firstElementChild
  if (!(element instanceof HTMLElement)) throw new Error('container missing')
  element.scrollTop = top
  act(() => {
    element.dispatchEvent(new Event('scroll'))
  })
}

describe('useVirtualRows', () => {
  it('renders the rows that fit the viewport plus 10 rows of overscan below', () => {
    view = render(<Probe count={1000} />)
    // 200 px holds 10 rows of 20 px.
    expect(windowOf()).toEqual([0, 20, 0, 980 * ROW_HEIGHT])
  })

  it('renders every row when they all fit', () => {
    view = render(<Probe count={4} />)
    expect(windowOf()).toEqual([0, 4, 0, 0])
  })

  it('moves the window with the scroll position, keeping 10 rows of overscan above', () => {
    view = render(<Probe count={1000} />)
    scrollTo(500 * ROW_HEIGHT + 5)
    expect(windowOf()).toEqual([490, 520, 490 * ROW_HEIGHT, 480 * ROW_HEIGHT])
  })

  it('stops at the last row when scrolled to the bottom', () => {
    view = render(<Probe count={1000} />)
    scrollTo(1000 * ROW_HEIGHT)
    expect(windowOf()).toEqual([990, 1000, 990 * ROW_HEIGHT, 0])
  })

  it('pulls the window back inside when the row count shrinks', () => {
    view = render(<Probe count={1000} />)
    scrollTo(900 * ROW_HEIGHT)
    view.rerender(<Probe count={50} />)
    expect(windowOf()).toEqual([40, 50, 40 * ROW_HEIGHT, 0])
  })

  it('renders nothing for no rows', () => {
    view = render(<Probe count={0} />)
    expect(windowOf()).toEqual([0, 0, 0, 0])
  })
})
