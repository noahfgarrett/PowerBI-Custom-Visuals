import { CircleAlert } from 'lucide-react'
import { act, type ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DashboardHeader, type DashboardHeaderProps } from '../components/DashboardHeader'
import { makeWorkWeek } from '../workWeeks'
import { render, type Rendered } from './render'

let view: Rendered | null = null

afterEach(() => {
  view?.unmount()
  view = null
})

const OPTIONS = [makeWorkWeek(2026, 42), makeWorkWeek(2026, 41)]

function header(overrides: Partial<DashboardHeaderProps> = {}): ReactElement {
  return (
    <DashboardHeader
      title="BIM Issues"
      icon={CircleAlert}
      interactive
      range="recent"
      onRangeChange={vi.fn()}
      weekOptions={OPTIONS}
      selectedKey={202642}
      onPickWeek={vi.fn()}
      {...overrides}
    />
  )
}

function click(target: Element): void {
  act(() => {
    target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

describe('DashboardHeader', () => {
  it('shows the title and its icon', () => {
    view = render(header())
    expect(view.container.querySelector('.qaqc-header h2')?.textContent).toBe('BIM Issues')
    expect(view.container.querySelector('.qaqc-title-icon svg.lucide-circle-alert')).not.toBeNull()
  })

  it('puts leading controls before the range toggle and the week picker', () => {
    view = render(header({ children: <button type="button" className="leading">Detail</button> }))
    const order = [...(view.container.querySelector('.qaqc-controls')?.children ?? [])].map((node) => node.className)
    expect(order).toEqual(['leading', 'qaqc-range-toggle', 'qaqc-week-picker'])
  })

  it('shows the range and the selected week', () => {
    view = render(header({ range: 'all', selectedKey: 202641 }))
    const all = [...view.container.querySelectorAll('.qaqc-range-toggle button')].find((button) => button.textContent === 'All')
    expect(all?.getAttribute('aria-pressed')).toBe('true')
    expect(view.container.querySelector('select')?.value).toBe('202641')
  })

  it('reports a range change', () => {
    const onRangeChange = vi.fn()
    view = render(header({ onRangeChange }))
    const all = [...view.container.querySelectorAll('.qaqc-range-toggle button')].find((button) => button.textContent === 'All')
    if (!all) throw new Error('All button missing')
    click(all)
    expect(onRangeChange).toHaveBeenCalledWith('all')
  })

  it('reports a picked week', () => {
    const onPickWeek = vi.fn()
    view = render(header({ onPickWeek }))
    const select = view.container.querySelector('select')
    if (!select) throw new Error('select missing')
    act(() => {
      select.value = '202641'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(onPickWeek).toHaveBeenCalledWith(202641)
  })

  it('disables the range toggle and the week picker when interactions are not allowed', () => {
    view = render(header({ interactive: false }))
    expect(view.container.querySelector('select')?.disabled).toBe(true)
    expect([...view.container.querySelectorAll<HTMLButtonElement>('.qaqc-range-toggle button')].every((button) => button.disabled)).toBe(true)
  })
})
