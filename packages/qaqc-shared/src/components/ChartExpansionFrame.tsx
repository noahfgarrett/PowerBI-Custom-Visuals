import type { LucideIcon } from 'lucide-react'
import { useEffect, useImperativeHandle, useRef, useState, type ReactElement, type ReactNode, type Ref } from 'react'

import type { TooltipHandler } from '../chartTypes'
import type { ElementSize } from '../hooks/useElementSize'
import type { LegendItem } from './ChartPanel'
import { ExpandedPanel, type PanelBox, type PanelKind } from './ExpandedPanel'

/** Dashboards narrower than this use the compact layout. */
export const COMPACT_WIDTH = 900
/** Dashboards shorter than this show only the cards. */
export const CARDS_ONLY_HEIGHT = 420

const ZERO_BOX: PanelBox = { top: 0, left: 0, width: 0, height: 0 }

/** What the overlay needs to draw one expandable chart panel, or a page opened from a header button. */
export interface ExpandablePanel {
  title: string
  icon: LucideIcon
  /**
   * Defaults to chart: a grid ChartPanel expands it. A page is opened by a HeaderOverlayButton, closes with a back
   * button, and is drawn on cards-only tiles too.
   */
  kind?: PanelKind
  legend: LegendItem[]
  /** Legend for the expanded panel when it differs from the grid panel's. */
  expandedLegend?: LegendItem[]
  emptyMessage: string | null
  /** Sees Esc before the overlay does; true means it was handled and the overlay stays open. */
  onEscape?: () => boolean
  renderExpanded: (size: ElementSize) => ReactNode
}

/** A chart panel in a dashboard's grid: the overlay's panel plus how the grid draws it. */
export interface GridPanel extends ExpandablePanel {
  className?: string
  renderChart: (size: ElementSize) => ReactNode
}

/** Spread onto a grid ChartPanel to make it expandable, or onto a HeaderOverlayButton to open a page. */
export interface ExpandableProps {
  sectionRef: (element: HTMLElement | null) => void
  onExpand: (() => void) | undefined
}

/**
 * Opens a page from any element, such as a table row: the page grows from `source`, and focus returns to
 * `focusTarget` when it closes (or to the frame when that element is gone by then). Does nothing when interactions
 * are not allowed.
 */
export type OpenPage<Id extends string> = (id: Id, source: HTMLElement, focusTarget: HTMLElement) => void

/** For a chart's week click, which happens outside the `children` call that hands out `openPage`. */
export interface ChartExpansionHandle<Id extends string> {
  /**
   * Opens a page from a grid chart, including from that chart's expanded view: the page grows from the chart's panel,
   * and focus returns to the chart when it closes. Does nothing when interactions are not allowed or the panel is not
   * on the page.
   */
  openPageFromChart: (pageId: Id, chartId: Id) => void
}

export interface ChartExpansionFrameProps<Id extends string> {
  panels: Record<Id, ExpandablePanel>
  handle?: Ref<ChartExpansionHandle<Id>>
  interactive: boolean
  animate: boolean
  isCompact: boolean
  /** Cards-only tiles have no charts, so no chart overlay is drawn; it comes back if the tile grows again. Pages are still drawn. */
  isCardsOnly: boolean
  onHover: TooltipHandler
  /** The dashboard's root content; call `expandable(id)` for each grid ChartPanel, or `openPage` from a row. */
  children: (expandable: (id: Id) => ExpandableProps, openPage: OpenPage<Id>) => ReactNode
}

/** The whole frame. The frame never scrolls, so no scroll offset is involved. */
function frameBox(frame: HTMLElement): PanelBox {
  return { top: 0, left: 0, width: frame.clientWidth, height: frame.clientHeight }
}

/** The grid panel's box relative to the frame (the root may be scrolled inside it); null once it has left the page. */
function originBox(frame: HTMLElement, panel: HTMLElement | null): PanelBox | null {
  if (!panel || !panel.isConnected) return null
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
  handle,
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
  // Set by openPage: the element focus returns to, in place of the panel's expand button.
  const focusTargets = useRef(new Map<Id, HTMLElement>())

  // Return focus once the overlay is gone and the dashboard is no longer inert: to the expand button, or to the
  // panel when the button is gone (the panel became empty or interactions were turned off), or to the frame.
  // A page registers its header button as the "panel", so focus returns to that button. A page opened with openPage
  // returns focus to the element it was given while that element is still on the page.
  useEffect(() => {
    const id = restoreFocusRef.current
    if (expanded !== null || id === null) return
    restoreFocusRef.current = null
    const focusTarget = focusTargets.current.get(id)
    focusTargets.current.delete(id)
    const panel = panelRefs.current.get(id) ?? null
    const target = focusTarget !== undefined
      ? (focusTarget.isConnected ? focusTarget : frameRef.current)
      : panel?.querySelector<HTMLButtonElement>('.qaqc-expand-button') ?? panel ?? frameRef.current
    target?.focus({ preventScroll: true })
  }, [expanded])

  const isOverlayShown = expanded !== null && (!isCardsOnly || panels[expanded].kind === 'page')

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

  function openPage(id: Id, source: HTMLElement, focusTarget: HTMLElement): void {
    if (!interactive) return
    panelRefs.current.set(id, source)
    focusTargets.current.set(id, focusTarget)
    setExpanded(id)
  }

  useImperativeHandle(handle, () => ({
    openPageFromChart: (pageId, chartId) => {
      const panel = panelRefs.current.get(chartId) ?? null
      if (panel === null) return
      openPage(pageId, panel, panel.querySelector<HTMLElement>('svg.qaqc-chart') ?? panel)
    },
  }))

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
        {children(expandable, openPage)}
      </div>

      {isOverlayShown && (
        <ExpandedPanel
          key={expanded}
          title={panels[expanded].title}
          icon={panels[expanded].icon}
          kind={panels[expanded].kind}
          legend={panels[expanded].expandedLegend ?? panels[expanded].legend}
          emptyMessage={panels[expanded].emptyMessage}
          animate={animate}
          className={isCompact ? 'is-compact' : undefined}
          getRootBox={() => (frameRef.current ? frameBox(frameRef.current) : ZERO_BOX)}
          getOriginBox={() => (frameRef.current ? originBox(frameRef.current, panelRefs.current.get(expanded) ?? null) : null)}
          onClosed={() => closeExpanded(expanded)}
          onEscape={panels[expanded].onEscape}
        >
          {panels[expanded].renderExpanded}
        </ExpandedPanel>
      )}
    </div>
  )
}
