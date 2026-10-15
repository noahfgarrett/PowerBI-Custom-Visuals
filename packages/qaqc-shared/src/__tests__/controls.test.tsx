import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RangeToggle } from '../components/RangeToggle'
import { WorkWeekPicker } from '../components/WorkWeekPicker'
import { makeWorkWeek } from '../workWeeks'
import { render, type Rendered } from './render'

let view: Rendered | null = null

afterEach(() => {
  view?.unmount()
  view = null
})

const OPTIONS = [makeWorkWeek(2026, 42), makeWorkWeek(2026, 41), makeWorkWeek(2026, 40)]

describe('WorkWeekPicker', () => {
  it('lists weeks and reports the chosen key as a number', () => {
    const onChange = vi.fn()
    view = render(<WorkWeekPicker options={OPTIONS} valueKey={202642} disabled={false} onChange={onChange} />)
    const select = view.container.querySelector('select')
    if (!select) throw new Error('select missing')
    expect(select.options).toHaveLength(3)
    expect(select.value).toBe('202642')
    act(() => {
      select.value = '202641'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(onChange).toHaveBeenCalledWith(202641)
  })

  it('can be disabled', () => {
    view = render(<WorkWeekPicker options={OPTIONS} valueKey={202642} disabled onChange={vi.fn()} />)
    expect(view.container.querySelector('select')?.disabled).toBe(true)
  })
})

describe('RangeToggle', () => {
  it('marks the active range and switches on click', () => {
    const onChange = vi.fn()
    view = render(<RangeToggle value="recent" recentCount={30} disabled={false} onChange={onChange} />)
    const [recent, all] = Array.from(view.container.querySelectorAll('button'))
    expect(recent.textContent).toBe('30 WW')
    expect(recent.getAttribute('aria-pressed')).toBe('true')
    expect(all.getAttribute('aria-pressed')).toBe('false')
    act(() => {
      all.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(onChange).toHaveBeenCalledWith('all')
  })
})
