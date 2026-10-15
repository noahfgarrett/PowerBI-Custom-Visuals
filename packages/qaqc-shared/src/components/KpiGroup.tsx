import type { ReactElement, ReactNode } from 'react'

export interface KpiGroupProps {
  title: string
  subtitle?: string
  variant: 'week' | 'total'
  children: ReactNode
}

export function KpiGroup({ title, subtitle, variant, children }: KpiGroupProps): ReactElement {
  return (
    <section className={`qaqc-kpi-group is-${variant}`} aria-label={title}>
      <header className="qaqc-kpi-group-head">
        <span>{title}</span>
        {subtitle && <em>{subtitle}</em>}
      </header>
      <div className="qaqc-kpi-group-body">{children}</div>
    </section>
  )
}
