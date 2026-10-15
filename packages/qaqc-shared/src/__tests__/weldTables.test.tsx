import { act } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { BuildingIssueTable } from '../components/BuildingIssueTable'
import { SystemTable } from '../components/SystemTable'
import type { BuildingIssueBar, SystemDetail } from '../types'
import { render, type Rendered } from './render'

let view: Rendered | null = null

afterEach(() => {
  view?.unmount()
  view = null
})

function texts(nodes: Iterable<Element>): string[] {
  return [...nodes].map((node) => node.textContent ?? '')
}

function rowNames(root: HTMLElement): string[] {
  return [...root.querySelectorAll('tbody tr')].map((row) => row.querySelector('th')?.textContent ?? '')
}

function header(root: HTMLElement, name: string): HTMLTableCellElement {
  const cell = [...root.querySelectorAll('thead th')].find((item) => item.textContent === name)
  if (!(cell instanceof HTMLTableCellElement)) throw new Error(`header ${name} missing`)
  return cell
}

function click(target: Element): void {
  act(() => {
    target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

function sortBy(root: HTMLElement, name: string): void {
  const button = header(root, name).querySelector('button')
  if (!button) throw new Error(`button ${name} missing`)
  click(button)
}

const SYSTEMS: SystemDetail[] = [
  {
    system: 'AW',
    total: 274,
    signed: 159,
    specs: [
      { spec: 'PCH', total: 208, signed: 142 },
      { spec: 'QCH', total: 31, signed: 11 },
      { spec: 'MDW', total: 28, signed: 6 },
      { spec: 'PCHA', total: 7, signed: 0 },
    ],
  },
  { system: 'IW', total: 122, signed: 90, specs: [{ spec: 'X', total: 100, signed: 80 }, { spec: 'Y', total: 22, signed: 10 }] },
  { system: 'FL', total: 82, signed: 59, specs: [{ spec: 'Unspecified', total: 82, signed: 59 }] },
]

function disclosure(root: HTMLElement, system: string): HTMLButtonElement {
  const button = [...root.querySelectorAll<HTMLButtonElement>('.qaqc-disclosure')].find((item) => item.textContent === system)
  if (!button) throw new Error(`disclosure ${system} missing`)
  return button
}

describe('SystemTable', () => {
  it('sorts by total descending by default', () => {
    view = render(<SystemTable rows={SYSTEMS} />)
    expect(rowNames(view.container)).toEqual(['AW', 'IW', 'FL'])
    expect(header(view.container, 'Total').getAttribute('aria-sort')).toBe('descending')
    expect(header(view.container, 'System').hasAttribute('aria-sort')).toBe(false)
  })

  it('shows total, signed, and sign-off % for each system', () => {
    view = render(<SystemTable rows={SYSTEMS} />)
    expect(texts(view.container.querySelector('tbody tr')?.querySelectorAll('td') ?? [])).toEqual(['274', '159', '58.0%'])
  })

  it('sorts the system name ascending first, then toggles', () => {
    view = render(<SystemTable rows={SYSTEMS} />)
    sortBy(view.container, 'System')
    expect(rowNames(view.container)).toEqual(['AW', 'FL', 'IW'])
    expect(header(view.container, 'System').getAttribute('aria-sort')).toBe('ascending')
    expect(header(view.container, 'Total').hasAttribute('aria-sort')).toBe(false)
    sortBy(view.container, 'System')
    expect(rowNames(view.container)).toEqual(['IW', 'FL', 'AW'])
    expect(header(view.container, 'System').getAttribute('aria-sort')).toBe('descending')
  })

  it('sorts numeric columns descending first', () => {
    view = render(<SystemTable rows={SYSTEMS} />)
    sortBy(view.container, 'Sign-off %')
    expect(rowNames(view.container)).toEqual(['IW', 'FL', 'AW'])
    expect(header(view.container, 'Sign-off %').getAttribute('aria-sort')).toBe('descending')
    sortBy(view.container, 'Signed')
    expect(rowNames(view.container)).toEqual(['AW', 'IW', 'FL'])
    sortBy(view.container, 'Signed')
    expect(rowNames(view.container)).toEqual(['FL', 'IW', 'AW'])
  })

  it('starts with every system collapsed', () => {
    view = render(<SystemTable rows={SYSTEMS} />)
    const buttons = [...view.container.querySelectorAll('.qaqc-disclosure')]
    expect(buttons.map((button) => button.getAttribute('aria-expanded'))).toEqual(['false', 'false', 'false'])
    expect(view.container.querySelectorAll('.qaqc-spec-row')).toHaveLength(0)
  })

  it('reveals pipe-spec rows under a system and hides them again', () => {
    view = render(<SystemTable rows={SYSTEMS} />)
    click(disclosure(view.container, 'AW'))
    expect(disclosure(view.container, 'AW').getAttribute('aria-expanded')).toBe('true')
    expect(rowNames(view.container)).toEqual(['AW', 'PCH', 'QCH', 'MDW', 'PCHA', 'IW', 'FL'])
    const specRow = view.container.querySelector('.qaqc-spec-row')
    expect(specRow?.querySelector('th')?.getAttribute('scope')).toBe('row')
    expect(texts(specRow?.querySelectorAll('td') ?? [])).toEqual(['208', '142', '68.3%'])
    click(disclosure(view.container, 'AW'))
    expect(disclosure(view.container, 'AW').getAttribute('aria-expanded')).toBe('false')
    expect(view.container.querySelectorAll('.qaqc-spec-row')).toHaveLength(0)
  })

  it('keeps systems open across sorts and sorts their specs the same way', () => {
    view = render(<SystemTable rows={SYSTEMS} />)
    click(disclosure(view.container, 'AW'))
    sortBy(view.container, 'Sign-off %')
    expect(rowNames(view.container)).toEqual(['IW', 'FL', 'AW', 'PCH', 'QCH', 'MDW', 'PCHA'])
    sortBy(view.container, 'System')
    expect(rowNames(view.container)).toEqual(['AW', 'MDW', 'PCH', 'PCHA', 'QCH', 'FL', 'IW'])
  })

  it('opens several systems at once', () => {
    view = render(<SystemTable rows={SYSTEMS} />)
    click(disclosure(view.container, 'IW'))
    click(disclosure(view.container, 'FL'))
    expect(rowNames(view.container)).toEqual(['AW', 'IW', 'X', 'Y', 'FL', 'Unspecified'])
  })

  it('names the table for screen readers', () => {
    view = render(<SystemTable rows={SYSTEMS} />)
    expect(view.container.querySelector('caption')?.textContent).toBe('Sign-off by system')
  })

  it('reads n/a for a system with no welds', () => {
    view = render(<SystemTable rows={[{ system: 'Z', total: 0, signed: 0, specs: [] }]} />)
    expect(texts(view.container.querySelectorAll('tbody td'))).toEqual(['0', '0', 'n/a'])
  })

  it('renders only headers when there are no systems', () => {
    view = render(<SystemTable rows={[]} />)
    expect(view.container.querySelectorAll('thead th')).toHaveLength(4)
    expect(view.container.querySelectorAll('tbody tr')).toHaveLength(0)
  })
})

function bar(building: string, welds: number, issues: number): BuildingIssueBar {
  return { building, welds, issues, rate: (issues / welds) * 100 }
}

const BUILDINGS: BuildingIssueBar[] = [
  bar('Site General', 118, 2),
  bar('WR1', 273, 4),
  bar('F631', 698, 4),
  bar('BK1', 439, 1),
  bar('PS1', 40, 0),
  bar('F632', 2, 0),
]

describe('BuildingIssueTable', () => {
  it('sorts by issue rate descending by default, breaking ties by name', () => {
    view = render(<BuildingIssueTable rows={BUILDINGS} />)
    expect(rowNames(view.container)).toEqual(['Site General', 'WR1', 'F631', 'BK1', 'F632', 'PS1'])
    expect(header(view.container, 'Issue rate').getAttribute('aria-sort')).toBe('descending')
    expect(header(view.container, 'Building').hasAttribute('aria-sort')).toBe(false)
  })

  it('shows welds, issues, and issue rate for each building', () => {
    view = render(<BuildingIssueTable rows={BUILDINGS} />)
    expect(texts(view.container.querySelector('tbody tr')?.querySelectorAll('td') ?? [])).toEqual(['118', '2', '1.7%'])
  })

  it('sorts the building name ascending first, then toggles', () => {
    view = render(<BuildingIssueTable rows={BUILDINGS} />)
    sortBy(view.container, 'Building')
    expect(rowNames(view.container)).toEqual(['BK1', 'F631', 'F632', 'PS1', 'Site General', 'WR1'])
    expect(header(view.container, 'Building').getAttribute('aria-sort')).toBe('ascending')
    sortBy(view.container, 'Building')
    expect(rowNames(view.container)).toEqual(['WR1', 'Site General', 'PS1', 'F632', 'F631', 'BK1'])
    expect(header(view.container, 'Building').getAttribute('aria-sort')).toBe('descending')
  })

  it('sorts numeric columns descending first', () => {
    view = render(<BuildingIssueTable rows={BUILDINGS} />)
    sortBy(view.container, 'Welds')
    expect(rowNames(view.container)).toEqual(['F631', 'BK1', 'WR1', 'Site General', 'PS1', 'F632'])
    expect(header(view.container, 'Welds').getAttribute('aria-sort')).toBe('descending')
    sortBy(view.container, 'Issues')
    expect(rowNames(view.container)).toEqual(['F631', 'WR1', 'Site General', 'BK1', 'F632', 'PS1'])
    sortBy(view.container, 'Issues')
    expect(rowNames(view.container)).toEqual(['F632', 'PS1', 'BK1', 'Site General', 'F631', 'WR1'])
    expect(header(view.container, 'Issues').getAttribute('aria-sort')).toBe('ascending')
  })

  it('names the table for screen readers', () => {
    view = render(<BuildingIssueTable rows={BUILDINGS} />)
    expect(view.container.querySelector('caption')?.textContent).toBe('Issues by building')
  })

  it('renders only headers when there are no buildings', () => {
    view = render(<BuildingIssueTable rows={[]} />)
    expect(view.container.querySelectorAll('thead th')).toHaveLength(4)
    expect(view.container.querySelectorAll('tbody tr')).toHaveLength(0)
  })
})
