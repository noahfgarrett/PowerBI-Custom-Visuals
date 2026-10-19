import { afterEach, describe, expect, it, vi } from 'vitest'

import { AgingIssueList, type AgingIssueListProps } from '../components/AgingIssueList'
import { ageBuckets, buildIssueBenchmarks } from '../issueBenchmarks'
import { syntheticIssueRows } from './fixtures/syntheticRows'
import { agingIndex, all, click, pressKey, stubSize, texts, WW42 } from './agingFixture'
import { render, type Rendered } from './render'

const INDEX = agingIndex()
const BENCHMARKS = buildIssueBenchmarks(INDEX, WW42, INDEX.today)
const OLDEST = ageBuckets(BENCHMARKS).find((bucket) => bucket.key === '365+')?.issues ?? []

let view: Rendered | null = null

afterEach(() => {
  view?.unmount()
  view = null
  vi.restoreAllMocks()
})

function draw(overrides: Partial<AgingIssueListProps> = {}): Rendered {
  return render(
    <AgingIssueList
      rows={OLDEST}
      filterLabel="12+ months"
      windowDays={77}
      asOfLabel="WW42'2026"
      animate={false}
      onClearFilter={vi.fn()}
      onClose={vi.fn()}
      {...overrides}
    />,
  )
}

function bodyRows(root: ParentNode): string[][] {
  return all(root, 'tbody tr[aria-rowindex]').map((row) => [...row.children].map((cell) => cell.textContent ?? ''))
}

function header(root: ParentNode, label: string): HTMLButtonElement {
  const found = all(root, 'thead th button').find((node) => node.textContent === label)
  if (!(found instanceof HTMLButtonElement)) throw new Error(`${label} header missing`)
  return found
}

describe('AgingIssueList', () => {
  it('names the filter and its count in the title', () => {
    view = draw()
    expect(view.container.querySelector('h3')?.textContent).toBe('12+ months · 19 open issues')
    expect(view.container.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('12+ months · 19 open issues')
  })

  it('titles the unfiltered list as all open issues, with no chip', () => {
    view = draw({ rows: BENCHMARKS.open, filterLabel: null })
    expect(view.container.querySelector('h3')?.textContent).toBe('All open issues · 51')
    expect(view.container.querySelector('.qaqc-aging-chip')).toBeNull()
  })

  it('clears the filter from its chip', () => {
    const onClearFilter = vi.fn()
    view = draw({ onClearFilter })
    const chip = view.container.querySelector('.qaqc-aging-chip')
    expect(chip?.textContent).toBe('Showing: 12+ months')
    expect(chip?.getAttribute('aria-label')).toBe('Clear the filter 12+ months')
    if (!chip) throw new Error('chip missing')
    click(chip)
    expect(onClearFilter).toHaveBeenCalledTimes(1)
  })

  it('notes the week and the normal close window', () => {
    view = draw()
    expect(view.container.querySelector('.qaqc-aging-list-note')?.textContent).toBe("As of WW42'2026 · normal close window 77 days")
  })

  it('lists the oldest issues first, against the window', () => {
    stubSize(1200, 600)
    view = draw()
    const rows = bodyRows(view.container)
    expect(rows[0]).toEqual(['#759', 'Basin 1 Spillway Matting Deficiency', 'To Be Transferred to Bayside', '08/28/25', '413 d', '5.4× the 77-day window'])
    expect(rows.slice(0, 3).map((row) => row[0])).toEqual(['#759', '#760', '#764'])
    expect(view.container.querySelector('thead th[aria-sort="descending"]')?.textContent).toBe('Age')
  })

  it('colors ages past the window bad', () => {
    stubSize(1200, 600)
    view = draw()
    expect(view.container.querySelector('tbody tr[aria-rowindex="2"] td.qaqc-aging-days')?.classList.contains('is-bad')).toBe(true)
  })

  it('sorts by age youngest first on a second click', () => {
    stubSize(1200, 600)
    view = draw()
    click(header(view.container, 'Age'))
    const youngest = Math.min(...OLDEST.map((row) => row.age))
    expect(bodyRows(view.container)[0][4]).toBe(`${youngest} d`)
    expect(view.container.querySelector('thead th[aria-sort="ascending"]')?.textContent).toBe('Age')
  })

  it('sorts by ID in numeric order', () => {
    stubSize(1200, 600)
    view = draw()
    click(header(view.container, 'ID'))
    const ids = bodyRows(view.container).map((row) => Number(row[0].slice(1)))
    expect(ids).toEqual([...ids].sort((a, b) => a - b))
  })

  it('sorts by title A to Z', () => {
    stubSize(1200, 600)
    view = draw()
    click(header(view.container, 'Title'))
    const titles = bodyRows(view.container).map((row) => row[1])
    expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })))
  })

  it('shows n/a against the window when there is none', () => {
    stubSize(1200, 600)
    view = draw({ windowDays: null })
    expect(bodyRows(view.container)[0][5]).toBe('n/a')
    expect(view.container.querySelector('.qaqc-aging-list-note')?.textContent).toBe("As of WW42'2026 · no normal close window yet")
  })

  it('says when no open issue matches the filter', () => {
    view = draw({ rows: [] })
    expect(view.container.querySelector('.qaqc-aging-list-empty')?.textContent).toBe('No open issues match this filter')
  })

  it('renders only the rows in view of a long list', () => {
    stubSize(1200, 320)
    const big = agingIndex(syntheticIssueRows(2_000))
    const open = buildIssueBenchmarks(big, big.currentWeek.key, big.today).open
    view = draw({ rows: open, filterLabel: null })
    expect(open.length).toBeGreaterThan(200)
    expect(view.container.querySelector('table')?.getAttribute('aria-rowcount')).toBe(String(open.length + 1))
    expect(all(view.container, 'tbody tr[aria-rowindex]').length).toBeLessThan(40)
  })

  it('moves focus to Back when it opens', () => {
    view = draw()
    expect(document.activeElement?.textContent).toBe('Back')
  })

  it('closes from Back', () => {
    const onClose = vi.fn()
    view = draw({ onClose })
    const back = view.container.querySelector('.qaqc-back-button')
    if (!back) throw new Error('back missing')
    click(back)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on Esc without letting the Esc reach the page', () => {
    const onClose = vi.fn()
    const onPageKey = vi.fn()
    view = render(
      <div onKeyDown={onPageKey}>
        <AgingIssueList rows={OLDEST} filterLabel={null} windowDays={77} asOfLabel="WW42'2026" animate={false} onClearFilter={vi.fn()} onClose={onClose} />
      </div>,
    )
    const back = view.container.querySelector('.qaqc-back-button')
    if (!back) throw new Error('back missing')
    pressKey(back, 'Escape')
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onPageKey).not.toHaveBeenCalled()
  })

  it('labels every column', () => {
    view = draw()
    expect(texts(view.container, 'thead th')).toEqual(['ID', 'Title', 'Contractor', 'Created On', 'Age', 'vs normal'])
  })
})

describe('AgingIssueList motion', () => {
  it('slides up only when animation is on', () => {
    view = draw({ animate: true })
    expect(view.container.querySelector('.qaqc-aging-list')?.classList.contains('is-animated')).toBe(true)
    view.unmount()
    view = draw({ animate: false })
    expect(view.container.querySelector('.qaqc-aging-list')?.classList.contains('is-animated')).toBe(false)
  })
})

describe('AgingIssueList chip focus', () => {
  it('moves focus to Back when the chip is cleared, since the chip goes away', () => {
    view = draw()
    const chip = view.container.querySelector<HTMLButtonElement>('.qaqc-aging-chip')
    if (!chip) throw new Error('chip missing')
    chip.focus()
    click(chip)
    expect(document.activeElement?.textContent).toBe('Back')
  })
})
