import { afterEach, describe, expect, it } from 'vitest'

import type { ChartColors } from '../chartTypes'
import { ParetoReadout, RootCauseCategoryPanel, type RootCauseCategoryPanelProps } from '../components/RootCauseCategoryPanel'
import type { CategorySlice, CauseCount, ReadoutLine } from '../rootCauses'
import { render, type Rendered } from './render'

const COLORS: ChartColors = {
  series1: '#2E5AAC',
  series2: '#86B6EF',
  series3: '#1A9C7B',
  good: '#0A7A0A',
  bad: '#D03B3B',
  warn: '#B45309',
  card: '#FDFEFF',
  grid: '#EBEEF3',
  axisText: '#636E7C',
  ink: '#1B2530',
  accent: '#2E5AAC',
}

function slice(label: string, count: number, total: number): CategorySlice {
  return { key: `category:${label.toLowerCase()}`, label, count, share: (count / total) * 100 }
}

const CATEGORIES: CategorySlice[] = [slice('Quality', 162, 177), slice('Design', 10, 177), slice('Coordination', 4, 177), slice('Safety', 1, 177)]

function causes(count: number): CauseCount[] {
  return Array.from({ length: count }, (_, at) => ({ label: `Cause ${at + 1}`, count: count - at }))
}

const FIXTURE_READOUT: ReadoutLine[] = [
  { lead: 'The top 9 causes', rest: ' cover 79.1%; 80% is reached only inside Other.' },
  { lead: 'Installation', rest: ' is 48 of 177 (27.1%).' },
]

let view: Rendered | null = null

afterEach(() => {
  view?.unmount()
  view = null
})

function draw(overrides: Partial<RootCauseCategoryPanelProps> = {}): Rendered {
  return render(
    <RootCauseCategoryPanel
      categories={CATEGORIES}
      otherLabel="Other (18 causes)"
      otherCauses={causes(18)}
      summary="177 issues · WW46'2024 to WW42'2026"
      readout={FIXTURE_READOUT}
      colors={COLORS}
      isHighContrast={false}
      {...overrides}
    />,
  )
}

function rowTexts(container: HTMLElement, selector: string): string[][] {
  return [...container.querySelectorAll(`${selector} li`)].map((row) => [...row.children].map((cell) => cell.textContent ?? ''))
}

describe('RootCauseCategoryPanel', () => {
  it('is a labelled section with the issue count and period', () => {
    view = draw()
    const panel = view.container.querySelector('section.qaqc-panel')
    expect(panel?.getAttribute('aria-label')).toBe('Root Cause Category')
    expect(panel?.querySelector('h3')?.textContent).toBe('Root Cause Category')
    expect(panel?.querySelector('.qaqc-pareto-side-note')?.textContent).toBe("177 issues · WW46'2024 to WW42'2026")
  })

  it('lists each category with its swatch, count and percent', () => {
    view = draw()
    expect(rowTexts(view.container, '.qaqc-pareto-categories')).toEqual([
      ['', 'Quality', '162', '91.5%'],
      ['', 'Design', '10', '5.6%'],
      ['', 'Coordination', '4', '2.3%'],
      ['', 'Safety', '1', '0.6%'],
    ])
  })

  it('draws a 100% strip with one segment per category, sized by count', () => {
    view = draw()
    const segments = [...view.container.querySelectorAll<HTMLElement>('.qaqc-pareto-strip i')]
    expect(segments.map((segment) => segment.style.flexGrow)).toEqual(['162', '10', '4', '1'])
    expect(segments[0].style.background).toBe('rgb(46, 90, 172)')
  })

  it('gives each row the same colour as its strip segment', () => {
    view = draw()
    const strip = [...view.container.querySelectorAll<HTMLElement>('.qaqc-pareto-strip i')].map((segment) => segment.style.background)
    const swatches = [...view.container.querySelectorAll<HTMLElement>('.qaqc-pareto-categories li i')].map((swatch) => swatch.style.background)
    expect(swatches).toEqual(strip)
  })

  it('keeps the full category name in a title when it is cut short', () => {
    const long = 'Construction Means and Methods Including Temporary Works'
    view = draw({ categories: [slice(long, 3, 3)] })
    expect(view.container.querySelector('.qaqc-pareto-categories li span')?.getAttribute('title')).toBe(long)
  })

  it('lists the first 10 causes inside Other, then how many more there are and their issues', () => {
    view = draw()
    const block = view.container.querySelector('.qaqc-pareto-other')
    expect(block?.querySelector('h4')?.textContent).toBe('Inside Other (18 causes)')
    const rows = rowTexts(view.container, '.qaqc-pareto-other')
    expect(rows).toHaveLength(11)
    expect(rows[0]).toEqual(['Cause 1', '18'])
    expect(rows[9]).toEqual(['Cause 10', '9'])
    // Causes 11 to 18 hold 8 + 7 + … + 1 = 36 issues.
    expect(rows[10]).toEqual(['8 more causes', '36'])
  })

  it('lists every cause inside Other when there are 10 or fewer', () => {
    view = draw({ otherLabel: 'Other (3 causes)', otherCauses: causes(3) })
    expect(rowTexts(view.container, '.qaqc-pareto-other')).toEqual([['Cause 1', '3'], ['Cause 2', '2'], ['Cause 3', '1']])
  })

  it('has no Inside Other list without an Other bar', () => {
    view = draw({ otherLabel: null, otherCauses: [] })
    expect(view.container.querySelector('.qaqc-pareto-other')).toBeNull()
  })

  it('shows the read-out at the foot of the panel', () => {
    view = draw()
    expect(view.container.querySelector('.qaqc-pareto-readout h4')?.textContent).toBe('Read-out')
  })
})

describe('ParetoReadout', () => {
  it('draws one line per read-out line, each with its subject in bold', () => {
    view = render(<ParetoReadout lines={FIXTURE_READOUT} />)
    const lines = [...view.container.querySelectorAll('p')]
    expect(lines.map((line) => line.textContent)).toEqual([
      'The top 9 causes cover 79.1%; 80% is reached only inside Other.',
      'Installation is 48 of 177 (27.1%).',
    ])
    expect(lines.map((line) => line.querySelector('b')?.textContent)).toEqual(['The top 9 causes', 'Installation'])
  })

  it('bolds a single top cause', () => {
    const lines: ReadoutLine[] = [
      { lead: 'The top cause', rest: ' covers 85.0%.' },
      { lead: 'Bonding', rest: ' is 17 of 20 (85.0%).' },
    ]
    view = render(<ParetoReadout lines={lines} />)
    expect([...view.container.querySelectorAll('b')].map((node) => node.textContent)).toEqual(['The top cause', 'Bonding'])
  })

  it('renders nothing for an empty read-out', () => {
    view = render(<ParetoReadout lines={[]} />)
    expect(view.container.innerHTML).toBe('')
  })
})
