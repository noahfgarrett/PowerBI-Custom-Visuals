import { Children, type CSSProperties, type ReactElement, type ReactNode } from 'react'

export interface KpiGroupProps {
  title: string
  subtitle?: string
  /** Week and period groups sit on the lighter card, project-to-date groups on the slightly darker tint. */
  variant: 'week' | 'period' | 'toDate'
  /**
   * Lets the cards wrap onto another row rather than cut off their text, for a group with too many cards to share a
   * narrow row. The group keeps the width share of this many cards, so the groups beside it don't narrow.
   */
  wrapShare?: number
  children: ReactNode
}

/** The stylesheet grows each group by its card count, so groups in a row share the width in proportion. */
type KpiGroupStyle = CSSProperties & Record<'--qaqc-kpi-cards', number>

export function KpiGroup({ title, subtitle, variant, wrapShare, children }: KpiGroupProps): ReactElement {
  const style: KpiGroupStyle = { '--qaqc-kpi-cards': wrapShare ?? Children.toArray(children).length }
  return (
    <section className={`qaqc-kpi-group is-${variant}${wrapShare === undefined ? '' : ' can-wrap'}`} aria-label={title} style={style}>
      <header className="qaqc-kpi-group-head">
        <span>{title}</span>
        {subtitle && <em>{subtitle}</em>}
      </header>
      <div className="qaqc-kpi-group-body">{children}</div>
    </section>
  )
}
