import { Building2 } from 'lucide-react'
import { act, type ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ChartPanel } from '../components/ChartPanel'
import { ExpandedPanel, type ExpandedPanelProps, type PanelBox } from '../components/ExpandedPanel'
import { render, type Rendered } from './render'

const TITLE = 'Inspections by Building'
const ROOT_BOX: PanelBox = { top: 0, left: 0, width: 1200, height: 700 }
const ORIGIN_BOX: PanelBox = { top: 420, left: 800, width: 380, height: 260 }

let view: Rendered | null = null

afterEach(() => {
  view?.unmount()
  view = null
  vi.restoreAllMocks()
  vi.useRealTimers()
  Reflect.deleteProperty(HTMLElement.prototype, 'animate')
})

function stubSize(): void {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 0, top: 0, left: 0, right: 600, bottom: 300, width: 600, height: 300, toJSON: () => ({}),
  })
}

interface StubAnimation {
  keyframes: Keyframe[]
  options: KeyframeAnimationOptions
  finish: () => void
  cancel: ReturnType<typeof vi.fn>
}

/** Installs a fake Element.animate whose animations finish only when the test says so. */
function stubAnimate(): StubAnimation[] {
  const calls: StubAnimation[] = []
  const animate = vi.fn((keyframes: Keyframe[], options: KeyframeAnimationOptions) => {
    let resolveFinished: () => void = () => undefined
    let rejectFinished: (reason: unknown) => void = () => undefined
    const finished = new Promise<void>((resolve, reject) => {
      resolveFinished = resolve
      rejectFinished = reject
    })
    let playState = 'running'
    const cancel = vi.fn(() => {
      if (playState !== 'running') return
      playState = 'idle'
      rejectFinished(new Error('AbortError'))
    })
    calls.push({
      keyframes,
      options,
      cancel,
      finish: () => {
        playState = 'finished'
        resolveFinished()
      },
    })
    return { finished, cancel, get playState(): string { return playState } }
  })
  Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true, writable: true })
  return calls
}

async function flushPromises(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
  })
}

function panel(overrides: Partial<ExpandedPanelProps> = {}): ReactElement {
  return (
    <ExpandedPanel
      title={TITLE}
      icon={Building2}
      legend={[{ label: 'Finals', color: '#2E5AAC', shape: 'bar' }]}
      emptyMessage={null}
      animate
      getRootBox={() => ROOT_BOX}
      getOriginBox={() => ORIGIN_BOX}
      onClosed={vi.fn()}
      {...overrides}
    >
      {({ width, height }) => <svg data-size={`${width}x${height}`} />}
    </ExpandedPanel>
  )
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

function collapseButton(container: HTMLElement): HTMLButtonElement | null {
  return container.querySelector(`button[aria-label="Collapse ${TITLE}"]`)
}

describe('ChartPanel expand button', () => {
  it('calls onExpand from a labelled button', () => {
    const onExpand = vi.fn()
    view = render(
      <ChartPanel title={TITLE} icon={Building2} legend={[]} emptyMessage={null} onExpand={onExpand}>
        {() => <svg />}
      </ChartPanel>,
    )
    click(view.container.querySelector(`button[aria-label="Expand ${TITLE}"]`))
    expect(onExpand).toHaveBeenCalledTimes(1)
  })

  it('has no expand button without onExpand', () => {
    view = render(
      <ChartPanel title={TITLE} icon={Building2} legend={[]} emptyMessage={null}>
        {() => <svg />}
      </ChartPanel>,
    )
    expect(view.container.querySelector('button')).toBeNull()
  })

  it('has no expand button while it shows an empty message', () => {
    view = render(
      <ChartPanel title={TITLE} icon={Building2} legend={[]} emptyMessage="No inspections in this range" onExpand={vi.fn()}>
        {() => <svg />}
      </ChartPanel>,
    )
    expect(view.container.querySelector('button')).toBeNull()
  })

  it('passes its section element to sectionRef', () => {
    const sectionRef = vi.fn()
    view = render(
      <ChartPanel title={TITLE} icon={Building2} legend={[]} emptyMessage={null} sectionRef={sectionRef}>
        {() => <svg />}
      </ChartPanel>,
    )
    expect(sectionRef).toHaveBeenCalledWith(view.container.querySelector('section'))
  })
})

describe('ExpandedPanel without the Web Animations API', () => {
  it('is a modal dialog labelled with the chart title', () => {
    view = render(panel())
    const dialog = view.container.querySelector('[role="dialog"]')
    expect(dialog?.getAttribute('aria-modal')).toBe('true')
    expect(dialog?.getAttribute('aria-label')).toBe(TITLE)
  })

  it('opens immediately and draws the chart at the measured body size', () => {
    stubSize()
    view = render(panel())
    expect(view.container.querySelector('.qaqc-expanded-body')?.classList.contains('is-revealed')).toBe(true)
    expect(view.container.querySelector('svg[data-size="600x300"]')).not.toBeNull()
  })

  it('shows the empty message instead of the chart', () => {
    stubSize()
    view = render(panel({ emptyMessage: 'No inspections in this range' }))
    expect(view.container.querySelector('.qaqc-chart-empty')?.textContent).toBe('No inspections in this range')
    expect(view.container.querySelector('svg[data-size]')).toBeNull()
  })

  it('moves focus to the collapse button', () => {
    view = render(panel())
    expect(document.activeElement).toBe(collapseButton(view.container))
  })

  it('calls onClosed once when the collapse button is clicked', () => {
    const onClosed = vi.fn()
    view = render(panel({ onClosed }))
    click(collapseButton(view.container))
    click(collapseButton(view.container))
    expect(onClosed).toHaveBeenCalledTimes(1)
  })

  it('calls onClosed once when Esc is pressed', () => {
    const onClosed = vi.fn()
    view = render(panel({ onClosed }))
    pressEscape(collapseButton(view.container))
    expect(onClosed).toHaveBeenCalledTimes(1)
  })

  it('closes instantly when animation is off', () => {
    const calls = stubAnimate()
    const onClosed = vi.fn()
    view = render(panel({ animate: false, onClosed }))
    click(collapseButton(view.container))
    expect(onClosed).toHaveBeenCalledTimes(1)
    expect(calls).toHaveLength(0)
  })
})

describe('ExpandedPanel with the Web Animations API', () => {
  it('grows from the grid panel box to the root box', () => {
    const calls = stubAnimate()
    view = render(panel())
    expect(calls).toHaveLength(1)
    expect(calls[0].keyframes[0].width).toBe(`${ORIGIN_BOX.width}px`)
    expect(calls[0].keyframes[1].width).toBe(`${ROOT_BOX.width}px`)
    expect(calls[0].options.duration).toBe(250)
  })

  it('shows only the title bar until the box arrives', async () => {
    stubSize()
    const calls = stubAnimate()
    view = render(panel())
    expect(view.container.querySelector('svg[data-size]')).toBeNull()
    expect(view.container.querySelector('.qaqc-expanded-body')?.classList.contains('is-revealed')).toBe(false)
    calls[0].finish()
    await flushPromises()
    expect(view.container.querySelector('svg[data-size="600x300"]')).not.toBeNull()
    expect(view.container.querySelector('.qaqc-expanded-body')?.classList.contains('is-revealed')).toBe(true)
  })

  it('does not measure the body while the box is growing', async () => {
    const calls = stubAnimate()
    const measure = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, top: 0, left: 0, right: 600, bottom: 300, width: 600, height: 300, toJSON: () => ({}),
    })
    view = render(panel())
    expect(measure).not.toHaveBeenCalled()
    calls[0].finish()
    await flushPromises()
    expect(measure).toHaveBeenCalled()
    expect(view.container.querySelector('svg[data-size="600x300"]')).not.toBeNull()
  })

  it('fades the content out, shrinks to the grid panel, then calls onClosed once', async () => {
    vi.useFakeTimers()
    stubSize()
    const calls = stubAnimate()
    const onClosed = vi.fn()
    view = render(panel({ onClosed }))
    calls[0].finish()
    await flushPromises()

    click(collapseButton(view.container))
    expect(view.container.querySelector('.qaqc-expanded-body')?.classList.contains('is-revealed')).toBe(false)
    expect(view.container.querySelector('svg[data-size]')).not.toBeNull()
    expect(calls).toHaveLength(1)

    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(calls).toHaveLength(2)
    expect(calls[1].keyframes[1].width).toBe(`${ORIGIN_BOX.width}px`)
    expect(onClosed).not.toHaveBeenCalled()

    calls[1].finish()
    await flushPromises()
    expect(onClosed).toHaveBeenCalledTimes(1)
  })

  it('reverses from mid-growth without reopening when collapsed during the open animation', async () => {
    stubSize()
    const calls = stubAnimate()
    const onClosed = vi.fn()
    view = render(panel({ onClosed }))
    click(collapseButton(view.container))
    expect(calls[0].cancel).toHaveBeenCalled()
    expect(calls).toHaveLength(2)
    await flushPromises()
    expect(view.container.querySelector('.qaqc-expanded-body')?.classList.contains('is-revealed')).toBe(false)
    calls[1].finish()
    await flushPromises()
    expect(onClosed).toHaveBeenCalledTimes(1)
  })

  it('calls onClosed once when it unmounts mid-collapse', async () => {
    vi.useFakeTimers()
    const calls = stubAnimate()
    const onClosed = vi.fn()
    view = render(panel({ onClosed }))
    calls[0].finish()
    await flushPromises()
    click(collapseButton(view.container))
    view.unmount()
    view = null
    act(() => {
      vi.advanceTimersByTime(500)
    })
    await flushPromises()
    expect(onClosed).toHaveBeenCalledTimes(1)
    expect(calls).toHaveLength(1)
  })
})

describe('ExpandedPanel legend shapes', () => {
  it('draws a dashed-line swatch like the panel legend', () => {
    stubSize()
    view = render(panel({ animate: false, legend: [{ label: '10% baseline', color: '#D03B3B', shape: 'dashed' }] }))
    expect(view.container.querySelector('.qaqc-legend-swatch.is-dashed line')?.getAttribute('stroke')).toBe('#D03B3B')
  })
})
