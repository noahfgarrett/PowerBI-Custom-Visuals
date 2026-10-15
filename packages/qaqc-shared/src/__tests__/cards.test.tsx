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
