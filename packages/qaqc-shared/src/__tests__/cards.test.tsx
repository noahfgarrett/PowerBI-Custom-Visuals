import { ClipboardCheck } from 'lucide-react'
import { afterEach, describe, expect, it } from 'vitest'

import { KpiCard } from '../components/KpiCard'
import { KpiGroup } from '../components/KpiGroup'
import { render, type Rendered } from './render'

let view: Rendered | null = null

afterEach(() => {
  view?.unmount()
  view = null
})

describe('KpiCard', () => {
  it('shows the label, value, and detail with an accessible summary', () => {
    view = render(
      <KpiCard label="Final Inspections" value="3" detail={'−3 vs WW41'} tone="neutral" trend="down" icon={ClipboardCheck} />,
    )
    const card = view.container.querySelector('article')
    expect(card?.getAttribute('aria-label')).toBe('Final Inspections: 3. −3 vs WW41')
    expect(card?.querySelector('.qaqc-kpi-value')?.textContent).toBe('3')
    expect(card?.querySelector('.qaqc-kpi-detail svg')).not.toBeNull()
  })

  it('colors the detail by tone', () => {
    view = render(<KpiCard label="Issues Found" value="2" detail="+2 vs WW41" tone="warn" trend="up" icon={ClipboardCheck} />)
    expect(view.container.querySelector('.qaqc-kpi-detail.is-warn')).not.toBeNull()
  })

  it('omits the trend icon when trend is none', () => {
    view = render(<KpiCard label="Finals to Date" value="238" detail="+3 this WW" tone="neutral" trend="none" icon={ClipboardCheck} />)
    expect(view.container.querySelector('.qaqc-kpi-detail svg')).toBeNull()
  })
})

describe('KpiCard value tone', () => {
  it('colors the value red when it is marked bad', () => {
    view = render(<KpiCard label="Sign-off %" value="5%" detail="1 of 20" tone="neutral" trend="none" icon={ClipboardCheck} isValueBad />)
    expect(view.container.querySelector('.qaqc-kpi-value.is-bad')).not.toBeNull()
  })

  it('leaves the value uncolored by default', () => {
    view = render(<KpiCard label="Sign-off %" value="80%" detail="67 of 84" tone="neutral" trend="none" icon={ClipboardCheck} />)
    expect(view.container.querySelector('.qaqc-kpi-value')?.className).toBe('qaqc-kpi-value')
  })
})

describe('KpiCard status', () => {
  it('draws a status line under the value and names it for screen readers', () => {
    view = render(<KpiCard label="Overall Sign-off %" value="12.0%" detail="+0.4 pts" tone="neutral" trend="up" icon={ClipboardCheck} status="warn" />)
    const card = view.container.querySelector('article')
    const line = card?.querySelector('.qaqc-kpi-status')
    expect(line?.classList.contains('is-warn')).toBe(true)
    expect(line?.previousElementSibling?.classList.contains('qaqc-kpi-value')).toBe(true)
    expect(card?.getAttribute('aria-label')).toBe('Overall Sign-off %: 12.0%. +0.4 pts. Status: watch')
  })

  it('classes the line by status', () => {
    view = render(<KpiCard label="Overall Sign-off %" value="60.2%" detail="No change" tone="neutral" trend="flat" icon={ClipboardCheck} status="good" />)
    expect(view.container.querySelector('.qaqc-kpi-status.is-good')).not.toBeNull()
    expect(view.container.querySelector('article')?.getAttribute('aria-label')).toMatch(/Status: on track$/)
    view.rerender(<KpiCard label="Overall Sign-off %" value="8.0%" detail="No change" tone="neutral" trend="flat" icon={ClipboardCheck} status="bad" />)
    expect(view.container.querySelector('.qaqc-kpi-status.is-bad')).not.toBeNull()
    expect(view.container.querySelector('article')?.getAttribute('aria-label')).toMatch(/Status: below target$/)
  })

  it('draws no status line and adds no status text without a status', () => {
    view = render(<KpiCard label="Total Welds" value="1,751" detail="+0 this WW" tone="neutral" trend="none" icon={ClipboardCheck} />)
    expect(view.container.querySelector('.qaqc-kpi-status')).toBeNull()
    expect(view.container.querySelector('article')?.getAttribute('aria-label')).toBe('Total Welds: 1,751. +0 this WW')
  })
})

describe('KpiGroup', () => {
  it('renders a titled group with an optional subtitle', () => {
    view = render(
      <KpiGroup title="Project to date" subtitle="Through WW42'2026" variant="total">
        <span className="child" />
      </KpiGroup>,
    )
    const group = view.container.querySelector('section.qaqc-kpi-group.is-total')
    expect(group?.querySelector('em')?.textContent).toBe("Through WW42'2026")
    expect(group?.querySelector('.child')).not.toBeNull()
  })
})
