import { Building2, TableProperties, TrendingUp } from 'lucide-react'
import { act, type ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { TooltipHandler } from '../chartTypes'
import { ChartExpansionFrame, type ExpandablePanel } from '../components/ChartExpansionFrame'
import { ChartPanel } from '../components/ChartPanel'
import { HeaderOverlayButton } from '../components/HeaderOverlayButton'
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

type PageTestId = TestPanelId | 'detail'

const PAGE_PANELS: Record<PageTestId, ExpandablePanel> = {
  ...PANELS,
  detail: {
    title: 'Detail Page',
    icon: TableProperties,
    kind: 'page',
    legend: [],
    emptyMessage: null,
    renderExpanded: () => <p className="detail-page">detail</p>,
  },
}

interface PageDashboardProps {
  interactive?: boolean
  isCardsOnly?: boolean
  animate?: boolean
}

/** A dashboard with a header button that opens a page, beside one expandable chart. */
function PageDashboard({ interactive = true, isCardsOnly = false, animate = false }: PageDashboardProps): ReactElement {
  return (
    <ChartExpansionFrame
      panels={PAGE_PANELS}
      interactive={interactive}
      animate={animate}
      isCompact={false}
      isCardsOnly={isCardsOnly}
      onHover={vi.fn()}
    >
      {(expandable) => (
        <>
          <div className="test-header">
            <HeaderOverlayButton {...expandable('detail')} label="Detail" ariaLabel="Open Detail Page" icon={TableProperties} />
          </div>
          {!isCardsOnly && (
            <ChartPanel
              title={PANELS.alpha.title}
              icon={PANELS.alpha.icon}
              legend={PANELS.alpha.legend}
              emptyMessage={null}
              {...expandable('alpha')}
            >
              {() => <svg />}
            </ChartPanel>
          )}
        </>
      )}
    </ChartExpansionFrame>
  )
}

function pageButton(container: HTMLElement): HTMLButtonElement | null {
  return container.querySelector<HTMLButtonElement>('button[aria-label="Open Detail Page"]')
}

function dialog(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>('.qaqc-frame > [role="dialog"]')
}

describe('ChartExpansionFrame header-button pages', () => {
  it('labels the header button and announces that it opens a dialog', () => {
    view = render(<PageDashboard />)
    const button = pageButton(view.container)
    expect(button?.textContent).toBe('Detail')
    expect(button?.getAttribute('aria-haspopup')).toBe('dialog')
  })

  it('opens the page as a dialog with its content', () => {
    stubSize()
    view = render(<PageDashboard />)
    click(pageButton(view.container))
    expect(dialog(view.container)?.getAttribute('aria-label')).toBe('Detail Page')
    expect(dialog(view.container)?.querySelector('.detail-page')).not.toBeNull()
  })

  it('marks the page dialog as modal', () => {
    view = render(<PageDashboard />)
    click(pageButton(view.container))
    expect(dialog(view.container)?.getAttribute('aria-modal')).toBe('true')
  })

  it('makes the dashboard behind the page inert', () => {
    view = render(<PageDashboard />)
    click(pageButton(view.container))
    expect(root(view.container)?.hasAttribute('inert')).toBe(true)
    expect(dialog(view.container)?.closest('[inert]')).toBeNull()
  })

  it('closes the page on Esc and releases the dashboard', () => {
    view = render(<PageDashboard />)
    click(pageButton(view.container))
    pressEscape(dialog(view.container))
    expect(dialog(view.container)).toBeNull()
    expect(root(view.container)?.hasAttribute('inert')).toBe(false)
  })

  it('returns focus to the header button after Esc', () => {
    view = render(<PageDashboard />)
    click(pageButton(view.container))
    pressEscape(dialog(view.container))
    expect(document.activeElement).toBe(pageButton(view.container))
  })

  it('offers a back button instead of a collapse button', () => {
    view = render(<PageDashboard />)
    click(pageButton(view.container))
    const back = dialog(view.container)?.querySelector('button[aria-label="Back to dashboard"]')
    expect(back?.textContent).toBe('Back')
    expect(dialog(view.container)?.querySelector('button[aria-label^="Collapse"]')).toBeNull()
  })

  it('focuses the back button when the page opens', () => {
    view = render(<PageDashboard />)
    click(pageButton(view.container))
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Back to dashboard')
  })

  it('closes with the back button and returns focus to the header button', () => {
    view = render(<PageDashboard />)
    click(pageButton(view.container))
    click(dialog(view.container)?.querySelector('button[aria-label="Back to dashboard"]') ?? null)
    expect(dialog(view.container)).toBeNull()
    expect(document.activeElement).toBe(pageButton(view.container))
  })

  it('hides the header button when interactions are not allowed', () => {
    view = render(<PageDashboard interactive={false} />)
    expect(pageButton(view.container)).toBeNull()
  })

  it('draws the page on a cards-only tile, which has no charts to expand', () => {
    view = render(<PageDashboard isCardsOnly />)
    click(pageButton(view.container))
    expect(dialog(view.container)?.getAttribute('aria-label')).toBe('Detail Page')
    expect(root(view.container)?.hasAttribute('inert')).toBe(true)
  })

  it('still expands charts the usual way beside a page', () => {
    view = render(<PageDashboard />)
    click(expandButton(view.container, 'Alpha Chart'))
    expect(dialog(view.container)?.querySelector('button[aria-label="Collapse Alpha Chart"]')).not.toBeNull()
  })

  it('grows the page from the header button', () => {
    const keyframes: Keyframe[][] = []
    const animate = vi.fn((frames: Keyframe[]) => {
      keyframes.push(frames)
      return { finished: new Promise<void>(() => undefined), cancel: vi.fn(), playState: 'running' }
    })
    Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true, writable: true })
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function rect(this: Element): DOMRect {
      return this.matches('button[aria-label="Open Detail Page"]') ? new DOMRect(880, 12, 110, 28) : new DOMRect(0, 0, 1000, 600)
    })
    try {
      view = render(<PageDashboard animate />)
      click(pageButton(view.container))
      expect(keyframes[0][0]).toEqual({ top: '12px', left: '880px', width: '110px', height: '28px' })
    } finally {
      Reflect.deleteProperty(HTMLElement.prototype, 'animate')
    }
  })
})

interface RowPageDashboardProps {
  interactive?: boolean
  animate?: boolean
  /** Leaves the row out, as when a data update drops it while the page is open. */
  isRowHidden?: boolean
}

/** A dashboard that opens the page from a table row, the way the Performance table opens a person. */
function RowPageDashboard({ interactive = true, animate = false, isRowHidden = false }: RowPageDashboardProps): ReactElement {
  return (
    <ChartExpansionFrame
      panels={PAGE_PANELS}
      interactive={interactive}
      animate={animate}
      isCompact={false}
      isCardsOnly={false}
      onHover={vi.fn()}
    >
      {(_expandable, openPage) => (
        <table>
          <tbody>
            {!isRowHidden && (
              <tr
                className="test-row"
                onClick={(event) => {
                  const name = event.currentTarget.querySelector<HTMLElement>('.test-name')
                  if (name) openPage('detail', event.currentTarget, name)
                }}
              >
                <th>
                  <button type="button" className="test-name">Name</button>
                </th>
                <td>value</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </ChartExpansionFrame>
  )
}

function rowCell(container: HTMLElement): Element | null {
  return container.querySelector('.test-row td')
}

describe('ChartExpansionFrame pages opened from any element', () => {
  it('opens the page from a table row', () => {
    view = render(<RowPageDashboard />)
    click(rowCell(view.container))
    expect(dialog(view.container)?.getAttribute('aria-label')).toBe('Detail Page')
    expect(root(view.container)?.hasAttribute('inert')).toBe(true)
  })

  it('grows the page from the row it was opened from', () => {
    const keyframes: Keyframe[][] = []
    const animate = vi.fn((frames: Keyframe[]) => {
      keyframes.push(frames)
      return { finished: new Promise<void>(() => undefined), cancel: vi.fn(), playState: 'running' }
    })
    Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true, writable: true })
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function rect(this: Element): DOMRect {
      return this.matches('.test-row') ? new DOMRect(14, 220, 960, 32) : new DOMRect(0, 0, 1000, 600)
    })
    try {
      view = render(<RowPageDashboard animate />)
      click(rowCell(view.container))
      expect(keyframes[0][0]).toEqual({ top: '220px', left: '14px', width: '960px', height: '32px' })
    } finally {
      Reflect.deleteProperty(HTMLElement.prototype, 'animate')
    }
  })

  it('returns focus to the given element after Back', () => {
    view = render(<RowPageDashboard />)
    click(rowCell(view.container))
    click(dialog(view.container)?.querySelector('button[aria-label="Back to dashboard"]') ?? null)
    expect(dialog(view.container)).toBeNull()
    expect(document.activeElement).toBe(view.container.querySelector('.test-name'))
  })

  it('returns focus to the given element after Esc', () => {
    view = render(<RowPageDashboard />)
    click(rowCell(view.container))
    pressEscape(dialog(view.container))
    expect(document.activeElement).toBe(view.container.querySelector('.test-name'))
  })

  it('returns focus to the frame when the row is gone', () => {
    view = render(<RowPageDashboard />)
    click(rowCell(view.container))
    view.rerender(<RowPageDashboard isRowHidden />)
    pressEscape(dialog(view.container))
    expect(dialog(view.container)).toBeNull()
    expect(document.activeElement).toBe(view.container.querySelector('.qaqc-frame'))
  })

  it('opens nothing when interactions are not allowed', () => {
    view = render(<RowPageDashboard interactive={false} />)
    click(rowCell(view.container))
    expect(dialog(view.container)).toBeNull()
  })
})
