import { ClipboardCheck } from 'lucide-react'
import { afterEach, describe, expect, it } from 'vitest'

import { KpiCard } from '../components/KpiCard'
import { KpiGroup } from '../components/KpiGroup'
import { render, type Rendered } from './render'
import { ruleBody } from './stylesheet'

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

  it('puts an optional context line above the detail and reads it before the change', () => {
    view = render(
      <KpiCard label="Pass rate" value="98.9%" context="3 NCRs of 282 finals" detail="+0.01 pts" tone="good" trend="up" icon={ClipboardCheck} />,
    )
    const card = view.container.querySelector('article')
    expect(card?.querySelector('.qaqc-kpi-context')?.textContent).toBe('3 NCRs of 282 finals')
    expect(card?.querySelector('.qaqc-kpi-context + .qaqc-kpi-detail')?.textContent).toBe('+0.01 pts')
    expect(card?.getAttribute('aria-label')).toBe('Pass rate: 98.9%. 3 NCRs of 282 finals. +0.01 pts')
  })

  it('renders no detail element when the card has no detail', () => {
    view = render(<KpiCard label="NCR Pass Rate" value="98.00%" tone="neutral" trend="none" icon={ClipboardCheck} />)
    expect(view.container.querySelector('.qaqc-kpi-detail')).toBeNull()
    expect(view.container.querySelector('.qaqc-kpi-value')?.textContent).toBe('98.00%')
  })

  it('ends the accessible summary at the value when the card has no detail', () => {
    view = render(<KpiCard label="NCR Pass Rate" value="98.00%" tone="neutral" trend="none" icon={ClipboardCheck} />)
    expect(view.container.querySelector('article')?.getAttribute('aria-label')).toBe('NCR Pass Rate: 98.00%')
  })

  it('reads the context alone when the card has no detail', () => {
    view = render(<KpiCard label="Pass rate" value="98.9%" context="3 NCRs of 282 finals" tone="neutral" trend="none" icon={ClipboardCheck} />)
    expect(view.container.querySelector('article')?.getAttribute('aria-label')).toBe('Pass rate: 98.9%. 3 NCRs of 282 finals')
  })

  it('keeps the target and status words clean when the card has no detail', () => {
    view = render(<KpiCard label="Sign-off %" value="5%" tone="neutral" trend="none" icon={ClipboardCheck} isValueBad status="bad" />)
    expect(view.container.querySelector('article')?.getAttribute('aria-label')).toBe('Sign-off %: 5%. Below target. Status: below target')
  })

  it('has no context line by default', () => {
    view = render(<KpiCard label="Finals" value="3" detail="+3 this WW" tone="neutral" trend="none" icon={ClipboardCheck} />)
    expect(view.container.querySelector('.qaqc-kpi-context')).toBeNull()
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

  it('names a bad value for screen readers', () => {
    view = render(<KpiCard label="Sign-off %" value="5.0%" detail="1 of 20" tone="neutral" trend="none" icon={ClipboardCheck} isValueBad />)
    expect(view.container.querySelector('article')?.getAttribute('aria-label')).toBe('Sign-off %: 5.0%. 1 of 20. Below target')
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
      <KpiGroup title="Project to date" subtitle="Through WW42'2026" variant="toDate">
        <span className="child" />
      </KpiGroup>,
    )
    const group = view.container.querySelector('section.qaqc-kpi-group.is-toDate')
    expect(group?.querySelector('em')?.textContent).toBe("Through WW42'2026")
    expect(group?.querySelector('.child')).not.toBeNull()
  })
})

describe('KpiGroup shading', () => {
  it.each(['week', 'period', 'toDate'] as const)('marks a %s group with its variant class', (variant) => {
    view = render(
      <KpiGroup title="Group" variant={variant}>
        <span />
      </KpiGroup>,
    )
    expect(view.container.querySelector('section.qaqc-kpi-group')?.className).toBe(`qaqc-kpi-group is-${variant}`)
  })

  it('draws every group on the plain card', () => {
    expect(ruleBody('.qaqc-kpi-group')).toContain('background: var(--qaqc-card);')
  })

  it('gives only project-to-date groups the darker tint', () => {
    expect(ruleBody('.qaqc-kpi-group.is-toDate')).toContain('background: var(--qaqc-to-date-card);')
    expect(() => ruleBody('.qaqc-kpi-group.is-week')).toThrow('missing')
    expect(() => ruleBody('.qaqc-kpi-group.is-period')).toThrow('missing')
  })

  it('keeps the expanded chart totals and the Performance disclosure row on the plain card', () => {
    expect(ruleBody('.qaqc-summary div')).toContain('background: var(--qaqc-card-solid);')
    expect(ruleBody('.qaqc-table tbody .qaqc-perf-disclosure-row > td')).toContain('background: var(--qaqc-card-solid);')
  })
})

/** Class-only selectors: their specificity is the number of classes. */
function classCount(selector: string): number {
  return selector.match(/\.[a-z-]+/g)?.length ?? 0
}

describe('KpiGroup layout', () => {
  it('passes its card count to the stylesheet so the groups share the row in proportion', () => {
    view = render(
      <KpiGroup title="WW42'2026" variant="week">
        <span />
        <span />
        <span />
        <span />
      </KpiGroup>,
    )
    const group = view.container.querySelector<HTMLElement>('section.qaqc-kpi-group')
    expect(group?.style.getPropertyValue('--qaqc-kpi-cards')).toBe('4')
  })

  it('lays the cards out in one row whatever their count', () => {
    const body = ruleBody('.qaqc-kpi-group-body')
    expect(body).toContain('grid-auto-flow: column;')
    expect(body).toContain('grid-auto-columns: minmax(0, 1fr);')
    expect(body).not.toContain('grid-template-columns')
  })

  it('sizes each group by its card count in the row', () => {
    expect(ruleBody('.qaqc-kpi-row')).toContain('display: flex;')
    expect(ruleBody('.qaqc-kpi-group')).toContain('flex: var(--qaqc-kpi-cards) 1 0;')
  })

  it('sizes card values on compact cards-only tiles with a rule that outranks the cards-only size', () => {
    const cardsOnly = '.qaqc-root.is-cards-only .qaqc-kpi-value'
    const compactCardsOnly = '.qaqc-root.is-cards-only.is-compact .qaqc-kpi-value'
    expect(ruleBody(cardsOnly)).toContain('font-size:')
    expect(ruleBody(compactCardsOnly)).toContain('font-size:')
    expect(classCount(compactCardsOnly)).toBeGreaterThan(classCount(cardsOnly))
  })
})
