import { Minimize2, type LucideIcon } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactElement, type ReactNode } from 'react'

import { useElementSize, type ElementSize } from '../hooks/useElementSize'
import { LegendSwatch, type LegendItem } from './ChartPanel'

const OPEN_MS = 250
const CLOSE_MS = 220
const FADE_OUT_MS = 100
const EASING = 'cubic-bezier(0.2, 0.8, 0.2, 1)'

/** A box in the overlay's coordinate space: relative to the non-scrolling frame that holds the dashboard and the overlay. */
export interface PanelBox {
  top: number
  left: number
  width: number
  height: number
}

/**
 * opening: the box grows from the grid panel; only the title bar shows.
 * open: the detail content is shown.
 * closing: the detail content fades out.
 * shrinking: the box shrinks back to the grid panel; only the title bar shows.
 */
type Phase = 'opening' | 'open' | 'closing' | 'shrinking'

export interface ExpandedPanelProps {
  title: string
  icon: LucideIcon
  legend: LegendItem[]
  emptyMessage: string | null
  animate: boolean
  /** Extra class for the dialog, e.g. is-compact on narrow tiles. */
  className?: string
  /** The whole frame (the box to expand into). */
  getRootBox: () => PanelBox
  /** The grid panel's current box; null when it is not on screen. */
  getOriginBox: () => PanelBox | null
  /** Called exactly once, when the collapse has finished. */
  onClosed: () => void
  children: (size: ElementSize) => ReactNode
}

function boxFrame(box: PanelBox): Keyframe {
  return { top: `${box.top}px`, left: `${box.left}px`, width: `${box.width}px`, height: `${box.height}px` }
}

/** The box where it is drawn right now, including any running animation. */
function currentFrame(element: HTMLElement): Keyframe {
  const style = window.getComputedStyle(element)
  return { top: style.top, left: style.left, width: style.width, height: style.height }
}

interface MeasuredBodyProps {
  children: (size: ElementSize) => ReactNode
}

/** Mounted only once the box has arrived, so the growing and shrinking box is never measured. */
function MeasuredBody({ children }: MeasuredBodyProps): ReactElement {
  const [ref, size] = useElementSize<HTMLDivElement>()
  return (
    <div ref={ref} className="qaqc-expanded-fill">
      {size.width > 0 && size.height > 0 ? children(size) : null}
    </div>
  )
}

function canAnimate(element: HTMLElement): boolean {
  return typeof element.animate === 'function'
}

export function ExpandedPanel({
  title,
  icon: Icon,
  legend,
  emptyMessage,
  animate,
  className,
  getRootBox,
  getOriginBox,
  onClosed,
  children,
}: ExpandedPanelProps): ReactElement {
  const boxRef = useRef<HTMLDivElement | null>(null)
  const collapseRef = useRef<HTMLButtonElement | null>(null)
  const openAnimationRef = useRef<Animation | null>(null)
  const shrinkAnimationRef = useRef<Animation | null>(null)
  const fadeTimerRef = useRef<number | null>(null)
  const isClosingRef = useRef(false)
  const hasClosedRef = useRef(false)
  const onClosedRef = useRef(onClosed)
  const [phase, setPhase] = useState<Phase>('opening')

  useLayoutEffect(() => {
    onClosedRef.current = onClosed
  })

  useLayoutEffect(() => {
    const element = boxRef.current
    const origin = getOriginBox()
    if (!element || !animate || !origin || !canAnimate(element)) {
      setPhase('open')
      return undefined
    }
    const animation = element.animate([boxFrame(origin), boxFrame(getRootBox())], { duration: OPEN_MS, easing: EASING })
    openAnimationRef.current = animation
    animation.finished.then(
      () => setPhase((current) => (current === 'opening' ? 'open' : current)),
      () => undefined,
    )
    return () => {
      openAnimationRef.current = null
      animation.cancel()
    }
    // Runs once on mount: the opening animation.
  }, [])

  useEffect(() => {
    // preventScroll: during the open animation the button sits inside the growing box, possibly off screen.
    collapseRef.current?.focus({ preventScroll: true })
    return () => {
      if (fadeTimerRef.current !== null) window.clearTimeout(fadeTimerRef.current)
      fadeTimerRef.current = null
      shrinkAnimationRef.current?.cancel()
      // Unmounted mid-collapse: the user still asked to close.
      if (isClosingRef.current) finishClosing()
    }
    // Runs once: initial focus, and cleanup of a collapse in progress.
  }, [])

  function finishClosing(): void {
    if (hasClosedRef.current) return
    hasClosedRef.current = true
    onClosedRef.current()
  }

  function shrink(element: HTMLElement, from: Keyframe): void {
    const origin = getOriginBox()
    if (!origin) {
      finishClosing()
      return
    }
    setPhase('shrinking')
    const animation = element.animate([from, boxFrame(origin)], { duration: CLOSE_MS, easing: EASING, fill: 'forwards' })
    shrinkAnimationRef.current = animation
    animation.finished.then(finishClosing, finishClosing)
  }

  function collapse(): void {
    if (isClosingRef.current) return
    isClosingRef.current = true
    const element = boxRef.current
    if (!element || !animate || !getOriginBox() || !canAnimate(element)) {
      finishClosing()
      return
    }
    const opening = openAnimationRef.current
    if (opening !== null && opening.playState === 'running') {
      // Collapsed mid-growth: nothing is revealed yet, so reverse from where the box is now.
      const from = currentFrame(element)
      opening.cancel()
      shrink(element, from)
      return
    }
    setPhase('closing')
    fadeTimerRef.current = window.setTimeout(() => {
      fadeTimerRef.current = null
      shrink(element, boxFrame(getRootBox()))
    }, FADE_OUT_MS)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      collapse()
    }
  }

  // The open box fills the frame (top/left 0, 100% size); px keyframes apply only while animating, so resizes are followed.
  const isRevealed = phase === 'open'
  const hasContent = phase === 'open' || phase === 'closing'
  const revealClass = animate ? ' qaqc-reveal' : ''
  const stateClass = isRevealed ? ' is-revealed' : ''
  return (
    <div
      ref={boxRef}
      className={className ? `qaqc-expanded ${className}` : 'qaqc-expanded'}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabIndex={-1}
      style={{ top: 0, left: 0, width: '100%', height: '100%' }}
      onKeyDown={handleKeyDown}
    >
      <header className="qaqc-panel-title">
        <Icon size={15} aria-hidden="true" />
        <h3>{title}</h3>
        <button ref={collapseRef} type="button" className="qaqc-icon-button" aria-label={`Collapse ${title}`} onClick={collapse}>
          <Minimize2 size={14} aria-hidden="true" />
        </button>
      </header>
      {legend.length > 0 && (
        <ul className={`qaqc-legend${revealClass}${stateClass}`}>
          {legend.map((item) => (
            <li key={item.label}>
              <LegendSwatch item={item} />
              {item.label}
            </li>
          ))}
        </ul>
      )}
      <div className={`qaqc-expanded-body${revealClass}${stateClass}`}>
        {hasContent && (emptyMessage !== null
          ? <p className="qaqc-chart-empty">{emptyMessage}</p>
          : <MeasuredBody>{children}</MeasuredBody>)}
      </div>
    </div>
  )
}
