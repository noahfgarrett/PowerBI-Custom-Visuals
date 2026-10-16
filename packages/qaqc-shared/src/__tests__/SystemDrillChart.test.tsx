import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ChartColors } from '../chartTypes'
import { SystemDrillChart, type SystemDrillChartProps } from '../components/SystemDrillChart'
import type { OtherSystems, SystemBar, SystemDetail } from '../types'
import { render, type Rendered } from './render'

const COLORS: ChartColors = {
  series1: '#2E5AAC', series2: '#86B6EF', series3: '#1A9C7B', good: '#0A7A0A', bad: '#D03B3B', warn: '#B45309', card: '#FDFEFF',
  grid: '#EBEEF3', axisText: '#6A7583', ink: '#1B2530', accent: '#2E5AAC',
}

const SYSTEMS: SystemBar[] = [
  { system: 'AW', total: 274, signed: 159 },
  { system: 'IW', total: 122, signed: 90 },
  { system: 'FL', total: 82, signed: 59 },
]

const OTHER: OtherSystems = { count: 53, total: 1092, signed: 600 }

const AW: SystemDetail = {
  system: 'AW',
  total: 274,
  signed: 159,
  specs: [
    { spec: 'PCH', total: 208, signed: 142 },
    { spec: 'QCH', total: 31, signed: 11 },
    { spec: 'MDW', total: 28, signed: 6 },
    { spec: 'PCHA', total: 7, signed: 0 },
  ],
}

let view: Rendered | null = null

afterEach(() => {
  view?.unmount()
  view = null
})

function props(overrides: Partial<SystemDrillChartProps> = {}): SystemDrillChartProps {
  return {
    systems: SYSTEMS,
    other: OTHER,
    drill: null,
    width: 600,
    height: 240,
    colors: COLORS,
    interactive: true,
    describe: true,
    onDrill: vi.fn(),
    onHover: vi.fn(),
    ...overrides,
  }
}

function draw(overrides: Partial<SystemDrillChartProps> = {}): Rendered {
  return render(<SystemDrillChart {...props(overrides)} />)
}

function fire(target: Element, event: Event): void {
  act(() => {
    target.dispatchEvent(event)
  })
}

function texts(root: HTMLElement, selector: string): string[] {
  return [...root.querySelectorAll(selector)].map((node) => node.textContent ?? '')
}

function rowButton(root: HTMLElement, system: string): SVGElement {
  const found = [...root.querySelectorAll<SVGElement>('[role="button"]')].find((node) => node.getAttribute('data-system') === system)
  if (!found) throw new Error(`row ${system} missing`)
  return found
}

function allSystemsButton(root: HTMLElement): HTMLButtonElement {
  const button = root.querySelector<HTMLButtonElement>('.qaqc-breadcrumb button')
  if (!button) throw new Error('breadcrumb button missing')
  return button
}

describe('SystemDrillChart', () => {
  it('draws one row per system plus Other with signed / total and rate', () => {
    view = draw()
    expect(texts(view.container, '.qaqc-row-label')).toEqual(['AW', 'IW', 'FL', 'Other (53 systems)'])
    expect(texts(view.container, '.qaqc-value-text')).toEqual([
      '159 / 274 · 58%',
      '90 / 122 · 74%',
      '59 / 82 · 72%',
      '600 / 1,092 · 55%',
    ])
  })

  it('labels a single grouped system in the singular', () => {
    view = draw({ other: { count: 1, total: 4, signed: 1 } })
    expect(texts(view.container, '.qaqc-row-label')[3]).toBe('Other (1 system)')
  })

  it('draws the signed portion inside each total bar', () => {
    view = draw({ systems: [SYSTEMS[0]], other: null })
    const fills = [...view.container.querySelectorAll('.qaqc-bar path, .qaqc-bar rect')].map((node) => node.getAttribute('fill'))
    expect(fills).toEqual([COLORS.series1, COLORS.series2])
  })

  it('makes every system row a drill button except Other', () => {
    view = draw()
    const buttons = [...view.container.querySelectorAll('[role="button"]')]
    expect(buttons.map((node) => node.getAttribute('data-system'))).toEqual(['AW', 'IW', 'FL'])
    expect(buttons.every((node) => node.getAttribute('tabindex') === '0')).toBe(true)
    expect(buttons[0].getAttribute('aria-label')).toBe('AW: 159 of 274 signed, 58%. Show pipe specs')
  })

  it('drills into a system on click', () => {
    const onDrill = vi.fn()
    view = draw({ onDrill })
    fire(rowButton(view.container, 'IW'), new MouseEvent('click', { bubbles: true }))
    expect(onDrill).toHaveBeenCalledWith('IW')
  })

  it('drills into a system with Enter or Space', () => {
    const onDrill = vi.fn()
    view = draw({ onDrill })
    fire(rowButton(view.container, 'AW'), new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(onDrill).toHaveBeenLastCalledWith('AW')
    fire(rowButton(view.container, 'FL'), new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    expect(onDrill).toHaveBeenLastCalledWith('FL')
  })

  it('does not drill from Other', () => {
    const onDrill = vi.fn()
    view = draw({ onDrill })
    const hits = view.container.querySelectorAll('.qaqc-hit')
    fire(hits[3], new MouseEvent('click', { bubbles: true }))
    expect(onDrill).not.toHaveBeenCalled()
    expect(hits[3].hasAttribute('role')).toBe(false)
  })

  it('offers no drill buttons when interactions are off', () => {
    const onDrill = vi.fn()
    view = draw({ onDrill, interactive: false })
    expect(view.container.querySelectorAll('[role="button"]')).toHaveLength(0)
    fire(view.container.querySelectorAll('.qaqc-hit')[0], new MouseEvent('click', { bubbles: true }))
    expect(onDrill).not.toHaveBeenCalled()
  })

  it('shows no breadcrumb at the top level', () => {
    view = draw()
    expect(view.container.querySelector('.qaqc-breadcrumb')).toBeNull()
  })

  it('shows the drilled system pipe specs under an All systems breadcrumb', () => {
    view = draw({ drill: AW })
    expect(texts(view.container, '.qaqc-row-label')).toEqual(['PCH', 'QCH', 'MDW', 'PCHA'])
    expect(texts(view.container, '.qaqc-value-text')).toEqual(['142 / 208 · 68%', '11 / 31 · 35%', '6 / 28 · 21%', '0 / 7 · 0%'])
    expect(allSystemsButton(view.container).textContent).toBe('All systems')
    expect(view.container.querySelector('.qaqc-breadcrumb [aria-current="page"]')?.textContent).toBe('AW')
    expect(view.container.querySelectorAll('[role="button"]')).toHaveLength(0)
  })

  it('returns to all systems from the breadcrumb', () => {
    const onDrill = vi.fn()
    view = draw({ drill: AW, onDrill })
    fire(allSystemsButton(view.container), new MouseEvent('click', { bubbles: true }))
    expect(onDrill).toHaveBeenCalledWith(null)
  })

  it('disables the breadcrumb when interactions are off', () => {
    view = draw({ drill: AW, interactive: false })
    expect(allSystemsButton(view.container).disabled).toBe(true)
  })

  it('leaves room for the breadcrumb when drilled', () => {
    view = draw({ drill: AW })
    expect(view.container.querySelector('svg')?.getAttribute('height')).toBe('216')
  })

  it('moves focus to the breadcrumb after a drill and back to the row after returning', () => {
    const onDrill = vi.fn()
    view = draw({ onDrill })
    const aw = rowButton(view.container, 'AW')
    act(() => {
      aw.focus()
    })
    fire(aw, new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    view.rerender(<SystemDrillChart {...props({ onDrill, drill: AW })} />)
    expect(document.activeElement).toBe(allSystemsButton(view.container))
    fire(allSystemsButton(view.container), new MouseEvent('click', { bubbles: true }))
    view.rerender(<SystemDrillChart {...props({ onDrill })} />)
    expect(document.activeElement).toBe(rowButton(view.container, 'AW'))
  })

  it('reports lost focus when the drill resets from outside while the breadcrumb has focus', () => {
    const onFocusLost = vi.fn()
    view = draw({ drill: AW, onFocusLost })
    act(() => {
      allSystemsButton(view?.container ?? document.body).focus()
    })
    view.rerender(<SystemDrillChart {...props({ onFocusLost })} />)
    expect(onFocusLost).toHaveBeenCalledTimes(1)
  })

  it('does not report lost focus when the drill resets while focus is elsewhere', () => {
    const onFocusLost = vi.fn()
    view = draw({ drill: AW, onFocusLost })
    view.rerender(<SystemDrillChart {...props({ onFocusLost })} />)
    expect(onFocusLost).not.toHaveBeenCalled()
  })

  it('does not report lost focus when the breadcrumb returns to all systems', () => {
    const onFocusLost = vi.fn()
    const onDrill = vi.fn()
    view = draw({ drill: AW, onDrill, onFocusLost })
    const button = allSystemsButton(view.container)
    act(() => {
      button.focus()
    })
    fire(button, new MouseEvent('click', { bubbles: true }))
    view.rerender(<SystemDrillChart {...props({ onDrill, onFocusLost })} />)
    expect(onFocusLost).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(rowButton(view.container, 'AW'))
  })

  it('reports lost focus when All systems finds no row to return to', () => {
    const onFocusLost = vi.fn()
    const onDrill = vi.fn()
    view = draw({ drill: AW, onDrill, onFocusLost })
    const button = allSystemsButton(view.container)
    act(() => {
      button.focus()
    })
    fire(button, new MouseEvent('click', { bubbles: true }))
    // AW has dropped into Other, so it has no row of its own.
    view.rerender(<SystemDrillChart {...props({ onDrill, onFocusLost, systems: SYSTEMS.slice(1) })} />)
    expect(onFocusLost).toHaveBeenCalledTimes(1)
  })

  it('shows the row focus ring only after keyboard use', () => {
    view = draw()
    const aw = rowButton(view.container, 'AW')
    fire(aw, new MouseEvent('mousedown', { bubbles: true }))
    act(() => {
      aw.focus()
    })
    expect(view.container.querySelector('.qaqc-focus-ring')).toBeNull()
    fire(aw, new MouseEvent('mouseup', { bubbles: true }))
    const iw = rowButton(view.container, 'IW')
    act(() => {
      iw.focus()
    })
    expect(view.container.querySelector('.qaqc-focus-ring')).not.toBeNull()
    act(() => {
      iw.blur()
    })
    expect(view.container.querySelector('.qaqc-focus-ring')).toBeNull()
  })

  it('reports row tooltips and clears them on leave', () => {
    const onHover = vi.fn()
    view = draw({ onHover })
    const hit = view.container.querySelectorAll('.qaqc-hit')[0]
    fire(hit, new MouseEvent('mousemove', { bubbles: true, clientX: 1, clientY: 2 }))
    expect(onHover).toHaveBeenLastCalledWith({
      title: 'AW',
      rows: [
        { label: 'Signed', value: '159 of 274' },
        { label: 'Sign-off %', value: '58.0%' },
      ],
      clientX: 1,
      clientY: 2,
    })
    fire(hit, new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }))
    expect(onHover).toHaveBeenLastCalledWith(null)
  })

  it('describes the top level and the drilled level', () => {
    view = draw()
    expect(view.container.querySelector('svg')?.getAttribute('aria-label')).toBe('Sign-off by system. Most welds: AW, 159 of 274 signed')
    view.rerender(<SystemDrillChart {...props({ drill: AW })} />)
    expect(view.container.querySelector('svg')?.getAttribute('aria-label')).toBe('Sign-off by pipe spec in AW. Most welds: PCH, 142 of 208 signed')
  })

  it('keeps a short label when chart descriptions are off', () => {
    view = draw({ describe: false })
    expect(view.container.querySelector('svg')?.getAttribute('aria-label')).toBe('Sign-off by system')
  })

  it('drops rows that do not fit at the minimum row height', () => {
    view = draw({ height: 36 })
    expect(view.container.querySelectorAll('.qaqc-row-label')).toHaveLength(3)
  })
})
