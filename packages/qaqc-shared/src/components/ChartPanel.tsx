import { Maximize2, type LucideIcon } from 'lucide-react'
import type { ReactElement, ReactNode } from 'react'

import { useElementSize, type ElementSize } from '../hooks/useElementSize'

export interface LegendItem {
  label: string
  color: string
  shape: 'bar' | 'dot' | 'line' | 'dashed'
}

/** One legend key. A dashed line is drawn in SVG so its dash pattern matches the chart's (`.qaqc-signoff-baseline` in qaqc.less). */
export function LegendSwatch({ item }: { item: LegendItem }): ReactElement {
  if (item.shape === 'dashed') {
    return (
      <svg className="qaqc-legend-swatch is-dashed" width={16} height={4} aria-hidden="true">
        <line x1={0} x2={16} y1={2} y2={2} stroke={item.color} strokeWidth={1.5} strokeDasharray="5 4" />
      </svg>
    )
  }
  return <span className={`qaqc-legend-swatch is-${item.shape}`} style={{ background: item.color }} />
}

export interface ChartPanelProps {
  title: string
  icon: LucideIcon
  legend: LegendItem[]
  /** When set, shown instead of the chart. */
  emptyMessage: string | null
  className?: string
  /** When set (and the panel is not empty), the title bar shows an expand button. */
  onExpand?: () => void
  sectionRef?: (element: HTMLElement | null) => void
  children: (size: ElementSize) => ReactNode
}

export function ChartPanel({
  title,
  icon: Icon,
  legend,
  emptyMessage,
  className,
  onExpand,
  sectionRef,
  children,
}: ChartPanelProps): ReactElement {
  const [bodyRef, size] = useElementSize<HTMLDivElement>()
  const isMeasured = size.width > 0 && size.height > 0
  // tabIndex -1: focus can return to the section after a collapse when the expand button is gone.
  return (
    <section ref={sectionRef} className={className ? `qaqc-panel ${className}` : 'qaqc-panel'} aria-label={title} tabIndex={-1}>
      <header className="qaqc-panel-title">
        <Icon size={15} aria-hidden="true" />
        <h3>{title}</h3>
        {onExpand && emptyMessage === null && (
          <button type="button" className="qaqc-icon-button qaqc-expand-button" aria-label={`Expand ${title}`} onClick={onExpand}>
            <Maximize2 size={14} aria-hidden="true" />
          </button>
        )}
      </header>
      {legend.length > 0 && (
        <ul className="qaqc-legend">
          {legend.map((item) => (
            <li key={item.label}>
              <LegendSwatch item={item} />
              {item.label}
            </li>
          ))}
        </ul>
      )}
      <div className="qaqc-chart-body" ref={bodyRef}>
        {emptyMessage !== null ? <p className="qaqc-chart-empty">{emptyMessage}</p> : isMeasured ? children(size) : null}
      </div>
    </section>
  )
}
