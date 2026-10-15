import type { LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'

import type { TooltipHandler } from '../chartTypes'
import type { ElementSize } from '../hooks/useElementSize'
import type { LegendItem } from './ChartPanel'
import { ExpandedPanel, type PanelBox } from './ExpandedPanel'

/** Dashboards narrower than this use the compact layout. */
export const COMPACT_WIDTH = 900
/** Dashboards shorter than this show only the cards. */
export const CARDS_ONLY_HEIGHT = 420

const ZERO_BOX: PanelBox = { top: 0, left: 0, width: 0, height: 0 }

/** What the overlay needs to draw one expandable chart panel. */
export interface ExpandablePanel {
  title: string
  icon: LucideIcon
  legend: LegendItem[]
  /** Legend for the expanded panel when it differs from the grid panel's. */
  expandedLegend?: LegendItem[]
  emptyMessage: string | null
  renderExpanded: (size: ElementSize) => ReactNode
}

/** Spread onto a grid ChartPanel to make it expandable. */
export interface ExpandableProps {
  sectionRef: (element: HTMLElement | null) => void
  onExpand: (() => void) | undefined
}

export interface ChartExpansionFrameProps<Id extends string> {
  panels: Record<Id, ExpandablePanel>
  interactive: boolean
  animate: boolean
  isCompact: boolean
  /** Cards-only tiles have no charts, so no overlay is drawn; it comes back if the tile grows again. */
  isCardsOnly: boolean
  onHover: TooltipHandler
  /** The dashboard's root content; call `expandable(id)` for each grid ChartPanel. */
  children: (expandable: (id: Id) => ExpandableProps) => ReactNode
}

/** The whole frame. The frame never scrolls, so no scroll offset is involved. */
function frameBox(frame: HTMLElement): PanelBox {
  return { top: 0, left: 0, width: frame.clientWidth, height: frame.clientHeight }
}

/** The grid panel's box relative to the frame (the root may be scrolled inside it). */
function originBox(frame: HTMLElement, panel: HTMLElement | null): PanelBox | null {
  if (!panel) return null
  const frameRect = frame.getBoundingClientRect()
  const rect = panel.getBoundingClientRect()
  return { top: rect.top - frameRect.top, left: rect.left - frameRect.left, width: rect.width, height: rect.height }
}

/**
 * The non-scrolling frame that holds a dashboard's `.qaqc-root` and, while a chart is expanded, its overlay.
 * Owns which panel is expanded, the root's inert state, focus return, and tooltip cleanup.
 */
export function ChartExpansionFrame<Id extends string>({
  panels,
  interactive,
  animate,
  isCompact,
  isCardsOnly,
  onHover,
  children,
}: ChartExpansionFrameProps<Id>): ReactElement {
  const [expanded, setExpanded] = useState<Id | null>(null)
  const frameRef = useRef<HTMLDivElement | null>(null)
  const panelRefs = useRef(new Map<Id, HTMLElement | null>())
  const restoreFocusRef = useRef<Id | null>(null)

  // Return focus once the overlay is gone and the dashboard is no longer inert: to the expand button, or to the
  // panel when the button is gone (the panel became empty or interactions were turned off), or to the frame.
  useEffect(() => {
    const id = restoreFocusRef.current
    if (expanded !== null || id === null) return
    restoreFocusRef.current = null
    const panel = panelRefs.current.get(id) ?? null
    const target = panel?.querySelector<HTMLButtonElement>('.qaqc-expand-button') ?? panel ?? frameRef.current
    target?.focus({ preventScroll: true })
  }, [expanded])

  const isOverlayShown = expanded !== null && !isCardsOnly

  // The expanded charts unmount without a mouseleave, so clear any Power BI tooltip when the overlay goes away.
  useEffect(() => {
    if (!isOverlayShown) return undefined
    return () => onHover(null)
  }, [isOverlayShown, onHover])

  function expandable(id: Id): ExpandableProps {
    return {
      sectionRef: (element) => {
        panelRefs.current.set(id, element)
      },
      onExpand: interactive ? () => setExpanded(id) : undefined,
    }
  }

  function closeExpanded(id: Id): void {
    restoreFocusRef.current = id
    setExpanded(null)
  }

  const rootClass = [
    'qaqc-root',
    isCompact ? 'is-compact' : '',
    isCardsOnly ? 'is-cards-only' : '',
    isOverlayShown ? 'is-expanded' : '',
  ].filter(Boolean).join(' ')

  return (
    <div ref={frameRef} className="qaqc-frame" tabIndex={-1}>
      <div className={rootClass} inert={isOverlayShown}>
        {children(expandable)}
      </div>

      {isOverlayShown && (
        <ExpandedPanel
          key={expanded}
          title={panels[expanded].title}
          icon={panels[expanded].icon}
          legend={panels[expanded].expandedLegend ?? panels[expanded].legend}
          emptyMessage={panels[expanded].emptyMessage}
          animate={animate}
          className={isCompact ? 'is-compact' : undefined}
          getRootBox={() => (frameRef.current ? frameBox(frameRef.current) : ZERO_BOX)}
          getOriginBox={() => (frameRef.current ? originBox(frameRef.current, panelRefs.current.get(expanded) ?? null) : null)}
          onClosed={() => closeExpanded(expanded)}
        >
          {panels[expanded].renderExpanded}
        </ExpandedPanel>
      )}
    </div>
  )
}
