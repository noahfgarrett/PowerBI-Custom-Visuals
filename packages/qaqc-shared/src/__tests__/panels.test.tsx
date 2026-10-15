import { ChartColumnStacked, ListChecks } from 'lucide-react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ChartPanel } from '../components/ChartPanel'
import { Footnotes } from '../components/Footnotes'
import { LoadingBar } from '../components/LoadingBar'
import { StatusPanel } from '../components/StatusPanel'
import { render, type Rendered } from './render'

let view: Rendered | null = null

afterEach(() => {
  view?.unmount()
  view = null
  vi.restoreAllMocks()
})

describe('ChartPanel', () => {
  it('shows the empty message instead of the chart', () => {
    const chart = vi.fn(() => <svg />)
    view = render(
      <ChartPanel title="Inspections by Building" icon={ChartColumnStacked} legend={[]} emptyMessage="No inspections match the current filters">
        {chart}
      </ChartPanel>,
    )
    expect(view.container.querySelector('.qaqc-chart-empty')?.textContent).toBe('No inspections match the current filters')
    expect(chart).not.toHaveBeenCalled()
  })

  it('renders the chart with the measured body size and a legend', () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, top: 0, left: 0, right: 400, bottom: 200, width: 400, height: 200, toJSON: () => ({}),
    })
    const chart = vi.fn(({ width, height }: { width: number; height: number }) => <svg data-size={`${width}x${height}`} />)
    view = render(
      <ChartPanel
        title="Finals + SORs by Work Week"
        icon={ChartColumnStacked}
        legend={[{ label: 'Finals', color: '#2E5AAC', shape: 'bar' }, { label: 'Issue found', color: '#D03B3B', shape: 'dot' }]}
        emptyMessage={null}
      >
        {chart}
      </ChartPanel>,
    )
    expect(view.container.querySelector('svg[data-size="400x200"]')).not.toBeNull()
    expect(view.container.querySelectorAll('.qaqc-legend li')).toHaveLength(2)
    expect(view.container.querySelector('.qaqc-legend-swatch.is-dot')).not.toBeNull()
  })
})

describe('StatusPanel', () => {
  it('lists the items it is given', () => {
    view = render(<StatusPanel icon={ListChecks} title="Add columns" message="Drag these columns:" items={['Work Week Observed → Work Week']} />)
    expect(view.container.querySelector('[role="status"] h2')?.textContent).toBe('Add columns')
    expect(view.container.querySelectorAll('li')).toHaveLength(1)
  })
})

describe('LoadingBar and Footnotes', () => {
  it('renders a progress bar only while active', () => {
    view = render(<LoadingBar active />)
    expect(view.container.querySelector('[role="progressbar"]')).not.toBeNull()
    view.rerender(<LoadingBar active={false} />)
    expect(view.container.querySelector('[role="progressbar"]')).toBeNull()
  })

  it('renders footnotes only when there are notes', () => {
    view = render(<Footnotes notes={['2 rows skipped: unreadable work week']} />)
    expect(view.container.querySelectorAll('.qaqc-footnotes li')).toHaveLength(1)
    view.rerender(<Footnotes notes={[]} />)
    expect(view.container.querySelector('.qaqc-footnotes')).toBeNull()
  })
})
