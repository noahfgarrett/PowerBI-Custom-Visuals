import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  badge,
  buttonNamed,
  checkbox,
  click,
  DEFAULTED_FIELDS,
  filterButton,
  FilterHarness,
  openMenu,
  pick,
  popover,
  pressAndClick,
  pressEscape,
  toggleSection,
} from './filterHarness'
import { render, type Rendered } from './render'
import { ruleBody } from './stylesheet'

let view: Rendered | null = null

afterEach(() => {
  view?.unmount()
  view = null
})

function requirePopover(container: Element): HTMLElement {
  const element = popover(container)
  if (element === null) throw new Error('popover missing')
  return element
}

describe('FilterMenu', () => {
  describe('opening and closing', () => {
    it('closes on window blur, since a press outside the Power BI iframe fires no pointerdown', () => {
      view = render(<FilterHarness />)
      openMenu(view.container)
      expect(popover(view.container)).not.toBeNull()
      act(() => {
        window.dispatchEvent(new Event('blur'))
      })
      expect(popover(view.container)).toBeNull()
      expect(filterButton(view.container).getAttribute('aria-expanded')).toBe('false')
    })

    it('stops listening for window blur once closed', () => {
      const removed = vi.spyOn(window, 'removeEventListener')
      view = render(<FilterHarness />)
      openMenu(view.container)
      pressEscape(filterButton(view.container))
      expect(removed.mock.calls.some(([type]) => type === 'blur')).toBe(true)
      removed.mockRestore()
    })

    it('opens on click and moves focus into the popover', () => {
      view = render(<FilterHarness />)
      expect(popover(view.container)).toBeNull()
      openMenu(view.container)
      expect(document.activeElement).toBe(requirePopover(view.container))
    })

    it('closes on Esc, returning focus to the button', () => {
      view = render(<FilterHarness />)
      openMenu(view.container)
      pressEscape(requirePopover(view.container))
      expect(popover(view.container)).toBeNull()
      expect(document.activeElement).toBe(filterButton(view.container))
    })

    it('closes on an outside click, returning focus to the button', () => {
      view = render(<div><FilterHarness /><p className="outside">Elsewhere</p></div>)
      openMenu(view.container)
      pressAndClick(pick(view.container, '.outside', HTMLElement))
      expect(popover(view.container)).toBeNull()
      expect(document.activeElement).toBe(filterButton(view.container))
    })

    it('leaves focus on the control an outside click landed on', () => {
      view = render(<div><FilterHarness /><button type="button" className="outside">Elsewhere</button></div>)
      openMenu(view.container)
      const outside = pick(view.container, '.outside', HTMLButtonElement)
      act(() => {
        outside.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      })
      act(() => outside.focus())
      click(outside)
      expect(popover(view.container)).toBeNull()
      expect(document.activeElement).toBe(outside)
    })

    it('stays open for a click inside the popover', () => {
      view = render(<FilterHarness />)
      openMenu(view.container)
      pressAndClick(requirePopover(view.container))
      expect(popover(view.container)).not.toBeNull()
    })

    it('closes when the button is clicked again', () => {
      view = render(<FilterHarness />)
      openMenu(view.container)
      pressAndClick(filterButton(view.container))
      expect(popover(view.container)).toBeNull()
      expect(document.activeElement).toBe(filterButton(view.container))
    })

    it('closes without moving focus when focus tabs out of the menu', () => {
      view = render(<div><FilterHarness /><button type="button" className="outside">Elsewhere</button></div>)
      openMenu(view.container)
      const outside = pick(view.container, '.outside', HTMLButtonElement)
      act(() => outside.focus())
      expect(popover(view.container)).toBeNull()
      expect(document.activeElement).toBe(outside)
    })

    it('an outside click on a chart week only closes the menu, and does not select the week', () => {
      const onWeek = vi.fn()
      view = render(<div><FilterHarness /><svg><rect className="qaqc-hit" onClick={onWeek} /></svg></div>)
      openMenu(view.container)
      pressAndClick(pick(view.container, '.qaqc-hit', SVGElement))
      expect(popover(view.container)).toBeNull()
      expect(onWeek).not.toHaveBeenCalled()
      pressAndClick(pick(view.container, '.qaqc-hit', SVGElement))
      expect(onWeek).toHaveBeenCalledTimes(1)
    })

    it('a press that closes the menu with no click after it does not swallow the next click on a chart week', () => {
      const onWeek = vi.fn()
      view = render(<div><FilterHarness /><svg><rect className="qaqc-hit" onClick={onWeek} /></svg><p className="outside">Elsewhere</p></div>)
      openMenu(view.container)
      const outside = pick(view.container, '.outside', HTMLElement)
      act(() => {
        outside.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      })
      pressAndClick(pick(view.container, '.qaqc-hit', SVGElement))
      expect(onWeek).toHaveBeenCalledTimes(1)
    })

    it('Esc on the open menu stops propagation, so a parent Esc handler does not fire', () => {
      const onReactKey = vi.fn()
      const onDocumentKey = vi.fn()
      document.addEventListener('keydown', onDocumentKey)
      view = render(<div onKeyDown={onReactKey}><FilterHarness /></div>)
      openMenu(view.container)
      pressEscape(requirePopover(view.container))
      document.removeEventListener('keydown', onDocumentKey)
      expect(onReactKey).not.toHaveBeenCalled()
      expect(onDocumentKey).not.toHaveBeenCalled()
    })

    it('Esc on the closed button reaches the parent', () => {
      const onKey = vi.fn()
      view = render(<div onKeyDown={onKey}><FilterHarness /></div>)
      pressEscape(filterButton(view.container))
      expect(onKey).toHaveBeenCalledTimes(1)
    })

    it('Clear all stays focusable once there is nothing to clear, so Esc still closes the menu', () => {
      view = render(<FilterHarness />)
      openMenu(view.container)
      click(checkbox(view.container, 'F63.1'))
      const clear = buttonNamed(requirePopover(view.container), 'Clear all')
      click(clear)
      expect(clear.disabled).toBe(false)
      expect(clear.getAttribute('aria-disabled')).toBe('true')
    })
  })

  describe('disabled', () => {
    it('the button is disabled when interactive is false', () => {
      view = render(<FilterHarness interactive={false} />)
      expect(filterButton(view.container).disabled).toBe(true)
    })

    it('closes an open menu when interactions are turned off', () => {
      view = render(<FilterHarness />)
      openMenu(view.container)
      view.rerender(<FilterHarness interactive={false} />)
      expect(popover(view.container)).toBeNull()
      view.rerender(<FilterHarness />)
      expect(popover(view.container)).toBeNull()
    })
  })

  describe('sections', () => {
    it('the first field section starts open and the rest closed', () => {
      view = render(<FilterHarness />)
      openMenu(view.container)
      const toggles = [...view.container.querySelectorAll('.qaqc-filter-section-toggle')]
      expect(toggles.map((toggle) => toggle.getAttribute('aria-expanded'))).toEqual(['true', 'false'])
    })

    it('sections collapse independently', () => {
      view = render(<FilterHarness />)
      openMenu(view.container)
      toggleSection(view.container, 'Status')
      toggleSection(view.container, 'Building')
      const toggles = [...view.container.querySelectorAll('.qaqc-filter-section-toggle')]
      expect(toggles.map((toggle) => toggle.getAttribute('aria-expanded'))).toEqual(['false', 'true'])
      expect(() => checkbox(view?.container ?? document.body, 'Open')).not.toThrow()
      expect(() => checkbox(view?.container ?? document.body, 'F63.1')).toThrow()
    })

    it('summarises a section as All, its default label, or a count of ticked values', () => {
      view = render(<FilterHarness fields={DEFAULTED_FIELDS} />)
      openMenu(view.container)
      const summaries = (): (string | null)[] =>
        [...(view?.container.querySelectorAll('.qaqc-filter-section-summary') ?? [])].map((node) => node.textContent)
      expect(summaries()).toEqual(['LotusWorks', 'All', 'All'])
      click(checkbox(view.container, 'Greyfox'))
      expect(summaries()).toEqual(['2 selected', 'All', 'All'])
    })

    it('hints at the default on a field that has one', () => {
      view = render(<FilterHarness fields={DEFAULTED_FIELDS} />)
      openMenu(view.container)
      expect(view.container.querySelector('.qaqc-filter-hint')?.textContent).toContain('Default is LotusWorks')
    })

    it('lists the blank value last under its own label', () => {
      view = render(<FilterHarness />)
      openMenu(view.container)
      const names = [...view.container.querySelectorAll('.qaqc-filter-option-name')].map((node) => node.textContent)
      expect(names).toEqual(['F63.1', 'F63.2', 'Unspecified'])
    })
  })

  describe('button', () => {
    it('shows the icon and the label, with no badge while nothing is active', () => {
      view = render(<FilterHarness />)
      const button = filterButton(view.container)
      expect(button.querySelector('svg.lucide-list-filter')).not.toBeNull()
      expect(button.textContent).toBe('Filter')
      expect(badge(view.container)).toBeNull()
      expect(button.classList.contains('is-active')).toBe(false)
    })

    it('takes the accent state and names its count while filters are active', () => {
      view = render(<FilterHarness />)
      openMenu(view.container)
      click(checkbox(view.container, 'F63.1'))
      const button = filterButton(view.container)
      expect(button.classList.contains('is-active')).toBe(true)
      expect(button.getAttribute('aria-label')).toBe('Filter, 1 active')
    })

    it('sits before the range toggle and after any leading controls', () => {
      view = render(<FilterHarness leading={<button type="button" className="leading">Detail</button>} />)
      const order = [...view.container.querySelectorAll('.qaqc-controls > *')].map((node) => node.className)
      expect(order).toEqual(['leading', 'qaqc-filter-anchor', 'qaqc-segmented', 'qaqc-week-picker'])
    })
  })

  describe('accessibility', () => {
    it('the button has aria-expanded and aria-haspopup', () => {
      view = render(<FilterHarness />)
      const button = filterButton(view.container)
      expect(button.getAttribute('aria-haspopup')).toBe('dialog')
      expect(button.getAttribute('aria-expanded')).toBe('false')
      expect(button.hasAttribute('aria-controls')).toBe(false)
      openMenu(view.container)
      expect(button.getAttribute('aria-expanded')).toBe('true')
      expect(button.getAttribute('aria-controls')).toBe(requirePopover(view.container).id)
    })

    it('the popover has role dialog and a label', () => {
      view = render(<FilterHarness />)
      openMenu(view.container)
      const element = requirePopover(view.container)
      expect(element.getAttribute('role')).toBe('dialog')
      expect(element.getAttribute('aria-label')).toBe('Filter')
    })

    it('each checkbox has a name including its count', () => {
      view = render(<FilterHarness />)
      openMenu(view.container)
      expect(checkbox(view.container, 'F63.1').getAttribute('aria-label')).toBe('F63.1, 3 rows')
      expect(checkbox(view.container, 'Unspecified').getAttribute('aria-label')).toBe('Unspecified, 1 row')
    })

    it('From, To and each search box have names', () => {
      view = render(<FilterHarness />)
      openMenu(view.container)
      const labels = [...view.container.querySelectorAll('.qaqc-filter-date label')].map((label) => label.textContent)
      expect(labels).toEqual(['From', 'To'])
      const from = view.container.querySelector('.qaqc-filter-date label')
      expect(from?.getAttribute('for')).toBe(view.container.querySelector('.qaqc-filter-date select')?.id)
      expect(view.container.querySelector('.qaqc-filter-search input')?.getAttribute('aria-label')).toBe('Search Building values')
    })
  })

  describe('stylesheet', () => {
    it('the popover limits its height and scrolls', () => {
      const body = ruleBody('.qaqc-filter-popover')
      expect(body).toMatch(/max-height:/)
      expect(body).toMatch(/overflow-y: auto/)
    })

    it('the footer stays in view while the popover scrolls', () => {
      const body = ruleBody('.qaqc-filter-footer')
      expect(body).toMatch(/position: sticky/)
      expect(body).toMatch(/bottom: 0/)
    })
  })
})
