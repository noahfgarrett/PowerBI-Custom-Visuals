import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ELECTRICAL_ROWS } from '../../../qaqc-shared/src/__tests__/fixtures/electricalRows'
import { render, type Rendered } from '../../../qaqc-shared/src/__tests__/render'
import { buildInspectionIndex } from '../../../qaqc-shared/src/inspections'
import { resolveTheme } from '../../../qaqc-shared/src/theme'
import { ElectricalDashboard, type ElectricalDashboardProps } from '../ElectricalDashboard'

const INDEX = buildInspectionIndex(ELECTRICAL_ROWS, { workWeek: 0, phase: 1, issue: 2, building: 3 }, new Date(2026, 9, 15))
const THEME = resolveTheme({ preset: 'qaqc', backgroundColor: '', backgroundOpacity: 100, cardOpacity: 100, highContrast: null })

let view: Rendered | null = null

afterEach(() => {
  view?.unmount()
  view = null
})

function draw(overrides: Partial<ElectricalDashboardProps> = {}): Rendered {
  return render(
    <ElectricalDashboard
      index={INDEX}
      theme={THEME}
      interactive
      animate={false}
      describeCharts
      loading={false}
      footnotes={[]}
      viewport={{ width: 1280, height: 720 }}
      onHover={vi.fn()}
      {...overrides}
    />,
  )
}

function cardValue(container: HTMLElement, label: string): string | null {
  return container.querySelector(`[aria-label^="${label}:"] .qaqc-kpi-value`)?.textContent ?? null
}

describe('ElectricalDashboard', () => {
  it('opens on the current week with the six cards', () => {
    view = draw()
    const { container } = view
    expect(container.querySelector('h2')?.textContent).toBe('Electrical Inspections')
    expect(container.querySelector('.qaqc-kpi-group.is-week span')?.textContent).toBe("WW42'2026")
    expect(cardValue(container, 'Final Inspections')).toBe('3')
    expect(cardValue(container, 'SORs')).toBe('3')
    expect(cardValue(container, 'Issues Found')).toBe('0')
    expect(cardValue(container, 'Finals to Date')).toBe('238')
    expect(cardValue(container, 'SORs to Date')).toBe('48')
    expect(cardValue(container, 'NCR Pass Rate')).toBe('99.2%')
  })

  it('switches cards and the to-date label when another week is picked', () => {
    view = draw()
    const select = view.container.querySelector('select')
    if (!select) throw new Error('week picker missing')
    expect(select.options).toHaveLength(44)
    act(() => {
      select.value = '202641'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(cardValue(view.container, 'Final Inspections')).toBe('6')
    expect(view.container.querySelector('.qaqc-kpi-group.is-total em')?.textContent).toBe("Through WW41'2026")
  })

  it('toggles the chart range', () => {
    view = draw()
    const all = Array.from(view.container.querySelectorAll('.qaqc-range-toggle button')).find((button) => button.textContent === 'All')
    if (!all) throw new Error('All button missing')
    act(() => {
      all.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(all.getAttribute('aria-pressed')).toBe('true')
  })

  it('shows three chart panels on a full page and none on a short tile', () => {
    view = draw()
    expect(view.container.querySelectorAll('.qaqc-panel')).toHaveLength(3)
    view.rerender(
      <ElectricalDashboard
        index={INDEX}
        theme={THEME}
        interactive
        animate={false}
        describeCharts
        loading={false}
        footnotes={[]}
        viewport={{ width: 1280, height: 400 }}
        onHover={vi.fn()}
      />,
    )
    expect(view.container.querySelectorAll('.qaqc-panel')).toHaveLength(0)
  })

  it('uses the compact layout on narrow tiles', () => {
    view = draw({ viewport: { width: 800, height: 900 } })
    expect(view.container.querySelector('.qaqc-root.is-compact')).not.toBeNull()
  })

  it('disables controls when interactions are not allowed', () => {
    view = draw({ interactive: false })
    expect(view.container.querySelector('select')?.disabled).toBe(true)
  })

  it('shows the loading bar and footnotes it is given', () => {
    view = draw({ loading: true, footnotes: ['2 rows skipped: unreadable work week'] })
    expect(view.container.querySelector('[role="progressbar"]')).not.toBeNull()
    expect(view.container.querySelector('.qaqc-footnotes')?.textContent).toContain('2 rows skipped')
  })
})
