import { afterEach, describe, expect, it, vi } from 'vitest'

import { AgeBucketsChart, ageBucketsLegend, agingCaption, type AgeBucketsChartProps } from '../components/AgeBucketsChart'
import { ageBuckets, buildIssueBenchmarks, type AgeBucket, type AgeBucketTone, type IssueBenchmarks } from '../issueBenchmarks'
import { AGING_COLORS, agingIndex, all, click, fire, noClosuresIndex, pressKey, textCollisions, texts, WW30, WW42 } from './agingFixture'
import { render, type Rendered } from './render'

const INDEX = agingIndex()
const AT_WW42 = buildIssueBenchmarks(INDEX, WW42, INDEX.today)
const AT_WW30 = buildIssueBenchmarks(INDEX, WW30, INDEX.today)
const NO_CLOSURES_INDEX = noClosuresIndex()
const NO_CLOSURES = buildIssueBenchmarks(NO_CLOSURES_INDEX, WW42, NO_CLOSURES_INDEX.today)

let view: Rendered | null = null

afterEach(() => {
  view?.unmount()
  view = null
})

function draw(benchmarks: IssueBenchmarks, overrides: Partial<AgeBucketsChartProps> = {}): Rendered {
  return render(
    <AgeBucketsChart
      benchmarks={benchmarks}
      buckets={ageBuckets(benchmarks)}
      width={1100}
      height={560}
      colors={AGING_COLORS}
      onHover={vi.fn()}
      onOpenBucket={vi.fn()}
      {...overrides}
    />,
  )
}

function bucketGroup(root: ParentNode, label: string): Element {
  const found = all(root, '.qaqc-aging-bucket').find((node) => node.getAttribute('aria-label')?.startsWith(`${label}:`))
  if (!found) throw new Error(`bucket ${label} missing`)
  return found
}

function barFills(root: ParentNode): string[] {
  return all(root, '.qaqc-aging-bar').map((node) => node.getAttribute('fill') ?? '')
}

function bucket(key: string, count: number, tone: AgeBucketTone): AgeBucket {
  return { key, label: key, range: `${key} days`, count, tone, issues: [] }
}

describe('AgeBucketsChart bars', () => {
  it("draws a bar for each bucket with issues, in bad red past the WW42'2026 window", () => {
    view = draw(AT_WW42)
    expect(barFills(view.container)).toEqual(Array(4).fill(AGING_COLORS.bad))
  })

  it('labels every bucket with its count, including the empty ones', () => {
    view = draw(AT_WW42)
    expect(texts(view.container, '.qaqc-aging-count')).toEqual(['0', '0', '3', '10', '19', '19'])
  })

  it('names each bucket and its day range under the axis', () => {
    view = draw(AT_WW42)
    expect(texts(view.container, '.qaqc-aging-bucket-label')).toEqual([
      'Under 1 month', '1 month – 77 days', '78 days – 3 months', '3–6 months', '6–12 months', '12+ months',
    ])
    expect(texts(view.container, '.qaqc-aging-bucket-range')[1]).toBe('30–77 days')
  })

  it('colors inside buckets good, a straddling bucket warn and past buckets bad', () => {
    view = draw(AT_WW42, { buckets: [bucket('a', 2, 'good'), bucket('b', 3, 'warn'), bucket('c', 4, 'bad')] })
    expect(barFills(view.container)).toEqual([AGING_COLORS.good, AGING_COLORS.warn, AGING_COLORS.bad])
  })

  it('puts the WW30 open issues in 5 / 6 / 0 / 6 / 33 / 0', () => {
    view = draw(AT_WW30)
    expect(texts(view.container, '.qaqc-aging-count')).toEqual(['5', '6', '0', '6', '33', '0'])
  })
})

describe('AgeBucketsChart window', () => {
  it('draws the normal close window band with its label', () => {
    view = draw(AT_WW42)
    expect(view.container.querySelector('.qaqc-aging-band')).not.toBeNull()
    expect(texts(view.container, '.qaqc-aging-band-label')).toEqual(['Normal close window', '90% of issues close within 77 days'])
  })

  it('marks the typical close time', () => {
    view = draw(AT_WW42)
    expect(texts(view.container, '.qaqc-aging-typical-label')).toEqual(['typical: 32 d'])
  })

  it('draws the band from the left of the plot to the window edge, between the 77 and 78 day buckets', () => {
    view = draw(AT_WW42)
    const band = view.container.querySelector('.qaqc-aging-band')
    const ticks = all(view.container, '.qaqc-aging-bucket-label').map((node) => Number(node.getAttribute('x')))
    const right = Number(band?.getAttribute('x')) + Number(band?.getAttribute('width'))
    expect(right).toBeCloseTo((ticks[1] + ticks[2]) / 2, 5)
  })

  it('draws no band and no typical marker without closures, and neutral bars', () => {
    view = draw(NO_CLOSURES)
    expect(view.container.querySelector('.qaqc-aging-band')).toBeNull()
    expect(view.container.querySelector('.qaqc-aging-typical-label')).toBeNull()
    const fills = barFills(view.container)
    expect(fills.length).toBeGreaterThan(0)
    expect(new Set(fills)).toEqual(new Set([AGING_COLORS.series1]))
  })

  it('keys the legend to the window, or to plain open issues without one', () => {
    expect(ageBucketsLegend(AGING_COLORS, true).map((item) => item.label))
      .toEqual(['Inside the normal close window', 'Past the normal close window', 'Typical close time'])
    expect(ageBucketsLegend(AGING_COLORS, false).map((item) => item.label)).toEqual(['Open issues'])
  })
})

describe('AgeBucketsChart caption', () => {
  it('says all open issues are past the window at WW42', () => {
    expect(agingCaption(AT_WW42)).toBe('All 51 open issues are older than the normal close window.')
  })

  it('says how many of the open issues are past the window at WW30', () => {
    expect(agingCaption(AT_WW30)).toBe('39 of 50 open issues are older than the normal close window.')
  })

  it('says there is no window yet without closures', () => {
    expect(agingCaption(NO_CLOSURES)).toBe(`${NO_CLOSURES.open.length} open issues; nothing has closed yet, so there is no normal close window.`)
  })

  it('shows the caption in bad red with a muted click hint', () => {
    view = draw(AT_WW42)
    const caption = view.container.querySelector('.qaqc-aging-caption')
    expect(caption?.classList.contains('is-bad')).toBe(true)
    expect(caption?.textContent).toBe('All 51 open issues are older than the normal close window. Click a bar to see its issues.')
    expect(caption?.querySelector('.qaqc-aging-caption-hint')?.textContent).toBe(' Click a bar to see its issues.')
  })
})

describe('AgeBucketsChart clicks', () => {
  it('opens a bucket when its bar is clicked', () => {
    const onOpenBucket = vi.fn()
    view = draw(AT_WW42, { onOpenBucket })
    click(bucketGroup(view.container, '12+ months'))
    expect(onOpenBucket).toHaveBeenCalledWith('365+')
  })

  it('opens a focused bucket on Enter and on Space', () => {
    const onOpenBucket = vi.fn()
    view = draw(AT_WW42, { onOpenBucket })
    pressKey(bucketGroup(view.container, '3–6 months'), 'Enter')
    pressKey(bucketGroup(view.container, '6–12 months'), ' ')
    expect(onOpenBucket.mock.calls).toEqual([['90-179'], ['180-364']])
  })

  it('makes only buckets with issues buttons in the tab order', () => {
    view = draw(AT_WW42)
    const empty = bucketGroup(view.container, 'Under 1 month')
    expect(empty.getAttribute('role')).not.toBe('button')
    expect(empty.hasAttribute('tabindex')).toBe(false)
    const full = bucketGroup(view.container, '12+ months')
    expect(full.getAttribute('role')).toBe('button')
    expect(full.getAttribute('tabindex')).toBe('0')
    expect(full.getAttribute('aria-label')).toBe('12+ months: 19 open issues. Press Enter to view them.')
  })

  it('does nothing when an empty bucket is clicked or Enter is pressed on it', () => {
    const onOpenBucket = vi.fn()
    view = draw(AT_WW42, { onOpenBucket })
    const empty = bucketGroup(view.container, 'Under 1 month')
    click(empty)
    pressKey(empty, 'Enter')
    expect(onOpenBucket).not.toHaveBeenCalled()
  })

  it('outlines a hovered bucket with issues, but not an empty one', () => {
    view = draw(AT_WW42)
    fire(bucketGroup(view.container, 'Under 1 month'), new MouseEvent('mousemove', { bubbles: true }))
    expect(view.container.querySelector('.qaqc-aging-bar-outline')).toBeNull()
    fire(bucketGroup(view.container, '12+ months'), new MouseEvent('mousemove', { bubbles: true }))
    expect(view.container.querySelectorAll('.qaqc-aging-bar-outline')).toHaveLength(1)
  })

  it('outlines a bucket while it has keyboard focus', () => {
    view = draw(AT_WW42)
    fire(bucketGroup(view.container, '3–6 months'), new FocusEvent('focusin', { bubbles: true }))
    expect(view.container.querySelectorAll('.qaqc-aging-bar-outline')).toHaveLength(1)
  })

  it('names the oldest issues in the tooltip and ends with the click hint', () => {
    const onHover = vi.fn()
    view = draw(AT_WW42, { onHover })
    fire(bucketGroup(view.container, '12+ months'), new MouseEvent('mousemove', { bubbles: true, clientX: 5, clientY: 6 }))
    expect(onHover).toHaveBeenLastCalledWith({
      title: '12+ months (365+ days)',
      rows: [
        { label: 'Open issues', value: '19' },
        { label: 'Oldest', value: '#759, #760 (413 d)' },
        { label: 'Click to view these issues', value: '' },
      ],
      clientX: 5,
      clientY: 6,
    })
  })

  it('gives an empty bucket no click hint', () => {
    const onHover = vi.fn()
    view = draw(AT_WW42, { onHover })
    fire(bucketGroup(view.container, 'Under 1 month'), new MouseEvent('mousemove', { bubbles: true }))
    expect(onHover.mock.lastCall?.[0].rows).toEqual([
      { label: 'Open issues', value: '0' },
      { label: 'Oldest', value: 'none' },
    ])
  })
})

describe('AgeBucketsChart labels', () => {
  for (const [width, height] of [[1100, 560], [740, 420], [520, 320]] as const) {
    it(`draws no overlapping text at ${width} × ${height}`, () => {
      view = draw(AT_WW42, { width, height })
      expect(textCollisions(view.container)).toEqual([])
    })
  }

  it('falls back to the short day ranges when the bucket names do not fit', () => {
    view = draw(AT_WW42, { width: 520, height: 320 })
    expect(texts(view.container, '.qaqc-aging-bucket-label')).toEqual(['0–29 d', '30–77 d', '78–89 d', '90–179 d', '180–364 d', '365+ d'])
    expect(view.container.querySelector('.qaqc-aging-bucket-range')).toBeNull()
  })
})
