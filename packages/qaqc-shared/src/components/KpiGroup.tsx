import { Children, type CSSProperties, type ReactElement, type ReactNode } from 'react'

export interface KpiGroupProps {
  title: string
  subtitle?: string
  variant: 'week' | 'total'
  children: ReactNode
}

/** The stylesheet grows each group by its card count, so groups in a row share the width in proportion. */
type KpiGroupStyle = CSSProperties & Record<'--qaqc-kpi-cards', number>

export function KpiGroup({ title, subtitle, variant, children }: KpiGroupProps): ReactElement {
  const style: KpiGroupStyle = { '--qaqc-kpi-cards': Children.count(children) }
  return (
    <section className={`qaqc-kpi-group is-${variant}`} aria-label={title} style={style}>
      <header className="qaqc-kpi-group-head">
        <span>{title}</span>
        {subtitle && <em>{subtitle}</em>}
      </header>
      <div className="qaqc-kpi-group-body">{children}</div>
    </section>
  )
}
