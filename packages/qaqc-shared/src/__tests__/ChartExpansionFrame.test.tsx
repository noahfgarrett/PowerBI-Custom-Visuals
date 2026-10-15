import { Building2, TrendingUp } from 'lucide-react'
import { act, type ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { TooltipHandler } from '../chartTypes'
import { ChartExpansionFrame, type ExpandablePanel } from '../components/ChartExpansionFrame'
import { ChartPanel } from '../components/ChartPanel'
import { render, type Rendered } from './render'

type TestPanelId = 'alpha' | 'beta'

const PANEL_IDS: readonly TestPanelId[] = ['alpha', 'beta'] as const

const PANELS: Record<TestPanelId, ExpandablePanel> = {
  alpha: {
    title: 'Alpha Chart',
    icon: TrendingUp,
    legend: [{ label: 'Alpha series', color: '#2E5AAC', shape: 'bar' }],
    emptyMessage: null,
    renderExpanded: ({ width, height }) => <p className="alpha-detail">{`${width}x${height}`}</p>,
  },
  beta: {
    title: 'Beta Chart',
    icon: Building2,
    legend: [{ label: 'Beta series', color: '#86B6EF', shape: 'bar' }],
    expandedLegend: [],
    emptyMessage: null,
    renderExpanded: () => <p className="beta-detail">beta</p>,
  },
}

interface TestDashboardProps {
  interactive?: boolean
  isCardsOnly?: boolean
  /** A panel left out of the grid, as when a dashboard stops drawing it. */
  hiddenPanel?: TestPanelId | null
  onHover?: TooltipHandler
}

/** A minimal two-panel dashboard built the way real dashboards use the host. */
function TestDashboard({
  interactive = true,
  isCardsOnly = false,
  hiddenPanel = null,
  onHover = vi.fn(),
}: TestDashboardProps): ReactElement {
  return (
    <ChartExpansionFrame
      panels={PANELS}
      interactive={interactive}
      animate={false}
      isCompact={false}
      isCardsOnly={isCardsOnly}
      onHover={onHover}
    >
      {(expandable) => (
        <>
          <p className="test-cards">cards</p>
          {!isCardsOnly && PANEL_IDS.filter((id) => id !== hiddenPanel).map((id) => (
            <ChartPanel
              key={id}
              title={PANELS[id].title}
              icon={PANELS[id].icon}
              legend={PANELS[id].legend}
              emptyMessage={PANELS[id].emptyMessage}
              {...expandable(id)}
            >
              {() => <svg />}
            </ChartPanel>
          ))}
        </>
      )}
    </ChartExpansionFrame>
  )
}

let view: Rendered | null = null

afterEach(() => {
  view?.unmount()
  view = null
  vi.restoreAllMocks()
})

function stubSize(): void {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 0, top: 0, left: 0, right: 600, bottom: 300, width: 600, height: 300, toJSON: () => ({}),
  })
}

function expandButton(container: HTMLElement, title: string): HTMLButtonElement | null {
  return container.querySelector<HTMLButtonElement>(`button[aria-label="Expand ${title}"]`)
}

function click(element: Element | null): void {
  if (!element) throw new Error('element missing')
  act(() => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

function pressEscape(element: Element | null): void {
  if (!element) throw new Error('element missing')
  act(() => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  })
}

function root(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>('.qaqc-frame > .qaqc-root')
}

describe('ChartExpansionFrame', () => {
  it('wraps the dashboard root in a focusable, non-scrolling frame', () => {
    view = render(<TestDashboard />)
    const frame = view.container.querySelector('.qaqc-frame')
    expect(frame?.getAttribute('tabindex')).toBe('-1')
    expect(root(view.container)?.querySelector('.test-cards')).not.toBeNull()
  })

  it('gives every registered panel an expand button', () => {
    view = render(<TestDashboard />)
    expect(expandButton(view.container, 'Alpha Chart')).not.toBeNull()
    expect(expandButton(view.container, 'Beta Chart')).not.toBeNull()
  })

  it('expands a panel into a dialog with its expanded content, outside the inert root', () => {
    stubSize()
    view = render(<TestDashboard />)
    click(expandButton(view.container, 'Alpha Chart'))
    const dialog = view.container.querySelector('.qaqc-frame > [role="dialog"]')
    expect(dialog?.getAttribute('aria-label')).toBe('Alpha Chart')
    expect(dialog?.querySelector('.alpha-detail')?.textContent).toBe('600x300')
    expect(root(view.container)?.classList.contains('is-expanded')).toBe(true)
    expect(root(view.container)?.hasAttribute('inert')).toBe(true)
  })

  it('uses the expanded legend when a panel provides one', () => {
    view = render(<TestDashboard />)
    click(expandButton(view.container, 'Beta Chart'))
    expect(view.container.querySelector('[role="dialog"] .qaqc-legend')).toBeNull()
  })

  it('collapses on Esc and releases the root', () => {
    view = render(<TestDashboard />)
    click(expandButton(view.container, 'Alpha Chart'))
    pressEscape(view.container.querySelector('[role="dialog"]'))
    expect(view.container.querySelector('[role="dialog"]')).toBeNull()
    expect(root(view.container)?.classList.contains('is-expanded')).toBe(false)
    expect(root(view.container)?.hasAttribute('inert')).toBe(false)
  })

  it('returns focus to the expand button after collapsing', () => {
    view = render(<TestDashboard />)
    click(expandButton(view.container, 'Beta Chart'))
    pressEscape(view.container.querySelector('[role="dialog"]'))
    expect(document.activeElement).toBe(expandButton(view.container, 'Beta Chart'))
  })

  it('returns focus to the panel when its expand button is gone', () => {
    view = render(<TestDashboard />)
    click(expandButton(view.container, 'Alpha Chart'))
    view.rerender(<TestDashboard interactive={false} />)
    pressEscape(view.container.querySelector('[role="dialog"]'))
    expect(document.activeElement).toBe(view.container.querySelector('section[aria-label="Alpha Chart"]'))
  })

  it('returns focus to the frame when the panel is gone', () => {
    view = render(<TestDashboard />)
    click(expandButton(view.container, 'Alpha Chart'))
    view.rerender(<TestDashboard hiddenPanel="alpha" />)
    pressEscape(view.container.querySelector('[role="dialog"]'))
    expect(view.container.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(view.container.querySelector('.qaqc-frame'))
  })

  it('clears the tooltip when the overlay goes away', () => {
    const onHover = vi.fn()
    view = render(<TestDashboard onHover={onHover} />)
    click(expandButton(view.container, 'Alpha Chart'))
    pressEscape(view.container.querySelector('[role="dialog"]'))
    expect(onHover).toHaveBeenLastCalledWith(null)
  })

  it('offers no expand buttons when interactions are not allowed', () => {
    view = render(<TestDashboard interactive={false} />)
    expect(view.container.querySelector('.qaqc-expand-button')).toBeNull()
  })

  it('renders no overlay in cards-only mode and keeps the root interactive', () => {
    view = render(<TestDashboard />)
    click(expandButton(view.container, 'Alpha Chart'))
    view.rerender(<TestDashboard isCardsOnly />)
    expect(view.container.querySelector('[role="dialog"]')).toBeNull()
    expect(root(view.container)?.classList.contains('is-cards-only')).toBe(true)
    expect(root(view.container)?.classList.contains('is-expanded')).toBe(false)
    expect(root(view.container)?.hasAttribute('inert')).toBe(false)
  })
})
