import type { LucideIcon } from 'lucide-react'
import type { ReactElement, ReactNode } from 'react'

import { useElementSize, type ElementSize } from '../hooks/useElementSize'

export interface LegendItem {
  label: string
  color: string
  shape: 'bar' | 'dot'
}

export interface ChartPanelProps {
  title: string
  icon: LucideIcon
  legend: LegendItem[]
  /** When set, shown instead of the chart. */
  emptyMessage: string | null
  className?: string
  children: (size: ElementSize) => ReactNode
}

export function ChartPanel({ title, icon: Icon, legend, emptyMessage, className, children }: ChartPanelProps): ReactElement {
  const [bodyRef, size] = useElementSize<HTMLDivElement>()
  const isMeasured = size.width > 0 && size.height > 0
  return (
    <section className={className ? `qaqc-panel ${className}` : 'qaqc-panel'} aria-label={title}>
      <header className="qaqc-panel-title">
        <Icon size={15} aria-hidden="true" />
        <h3>{title}</h3>
      </header>
      {legend.length > 0 && (
        <ul className="qaqc-legend">
          {legend.map((item) => (
            <li key={item.label}>
              <span className={`qaqc-legend-swatch is-${item.shape}`} style={{ background: item.color }} />
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
