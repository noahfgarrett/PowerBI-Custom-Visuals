import { act, type ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useWeekFocus, type WeekFocusOptions } from '../hooks/useWeekFocus'
import { render, type Rendered } from './render'

let view: Rendered | null = null

afterEach(() => {
  view?.unmount()
  view = null
})

function Probe(options: WeekFocusOptions): ReactElement {
  const { focus, hasFocus, showFocusRing, svgProps } = useWeekFocus(options)
  return <svg {...svgProps} data-focus={focus} data-has-focus={String(hasFocus)} data-ring={String(showFocusRing)} />
}

function draw(overrides: Partial<WeekFocusOptions> = {}): SVGSVGElement {
  view = render(<Probe count={5} selectedIndex={2} interactive onSelect={vi.fn()} {...overrides} />)
  const svg = view.container.querySelector('svg')
  if (!svg) throw new Error('svg missing')
  return svg
}

function fire(target: Element, event: Event): void {
  act(() => {
    target.dispatchEvent(event)
  })
}

function key(svg: Element, name: string): void {
  fire(svg, new KeyboardEvent('keydown', { key: name, bubbles: true }))
}

describe('useWeekFocus', () => {
  it('makes the chart focusable', () => {
    expect(draw().getAttribute('tabindex')).toBe('0')
  })

  it('starts on the selected week', () => {
    expect(draw().getAttribute('data-focus')).toBe('2')
  })

  it('starts on the last week when nothing is selected', () => {
    expect(draw({ selectedIndex: -1 }).getAttribute('data-focus')).toBe('4')
  })

  it('moves one week with the arrow keys, stopping at the ends', () => {
    const svg = draw({ selectedIndex: 0 })
    key(svg, 'ArrowLeft')
    expect(svg.getAttribute('data-focus')).toBe('0')
    key(svg, 'ArrowRight')
    expect(svg.getAttribute('data-focus')).toBe('1')
  })

  it('jumps to the first and last week with Home and End', () => {
    const svg = draw()
    key(svg, 'Home')
    expect(svg.getAttribute('data-focus')).toBe('0')
    key(svg, 'End')
    expect(svg.getAttribute('data-focus')).toBe('4')
  })

  it('selects the focused week with Enter or Space', () => {
    const onSelect = vi.fn()
    const svg = draw({ onSelect })
    key(svg, 'Enter')
    expect(onSelect).toHaveBeenLastCalledWith(2)
    key(svg, 'ArrowLeft')
    key(svg, ' ')
    expect(onSelect).toHaveBeenLastCalledWith(1)
  })

  it('does not select when interactions are off', () => {
    const onSelect = vi.fn()
    key(draw({ onSelect, interactive: false }), 'Enter')
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('ignores keys when there are no weeks', () => {
    const onSelect = vi.fn()
    const svg = draw({ count: 0, selectedIndex: -1, onSelect })
    key(svg, 'Enter')
    expect(onSelect).not.toHaveBeenCalled()
    expect(svg.getAttribute('data-ring')).toBe('false')
  })

  it('shows the ring only after keyboard use, and hides it on mouse down or blur', () => {
    const svg = draw()
    fire(svg, new FocusEvent('focusin', { bubbles: true }))
    expect([svg.getAttribute('data-has-focus'), svg.getAttribute('data-ring')]).toEqual(['true', 'false'])
    key(svg, 'ArrowLeft')
    expect(svg.getAttribute('data-ring')).toBe('true')
    fire(svg, new MouseEvent('mousedown', { bubbles: true }))
    expect(svg.getAttribute('data-ring')).toBe('false')
    key(svg, 'ArrowLeft')
    fire(svg, new FocusEvent('focusout', { bubbles: true }))
    expect([svg.getAttribute('data-has-focus'), svg.getAttribute('data-ring')]).toEqual(['false', 'false'])
  })

  it('follows a new selection', () => {
    draw()
    view?.rerender(<Probe count={5} selectedIndex={4} interactive onSelect={vi.fn()} />)
    expect(view?.container.querySelector('svg')?.getAttribute('data-focus')).toBe('4')
  })

  it('stays inside the weeks when the count shrinks', () => {
    draw({ selectedIndex: -1 })
    view?.rerender(<Probe count={2} selectedIndex={-1} interactive onSelect={vi.fn()} />)
    expect(view?.container.querySelector('svg')?.getAttribute('data-focus')).toBe('1')
  })
})
