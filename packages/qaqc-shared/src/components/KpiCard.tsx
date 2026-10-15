import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from 'lucide-react'
import type { ReactElement } from 'react'

import type { DeltaTone, Trend } from '../format'

const TREND_ICONS: Record<Exclude<Trend, 'none'>, LucideIcon> = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  flat: Minus,
}

export interface KpiCardProps {
  label: string
  value: string
  detail: string
  tone: DeltaTone
  trend: Trend
  icon: LucideIcon
}

export function KpiCard({ label, value, detail, tone, trend, icon: Icon }: KpiCardProps): ReactElement {
  const TrendIcon = trend === 'none' ? null : TREND_ICONS[trend]
  return (
    <article className="qaqc-kpi" aria-label={`${label}: ${value}. ${detail}`}>
      <div className="qaqc-kpi-head">
        <span className="qaqc-kpi-icon">
          <Icon size={13} aria-hidden="true" />
        </span>
        <span className="qaqc-kpi-label">{label}</span>
      </div>
      <strong className="qaqc-kpi-value">{value}</strong>
      <span className={`qaqc-kpi-detail is-${tone}`}>
        {TrendIcon && <TrendIcon size={12} aria-hidden="true" />}
        {detail}
      </span>
    </article>
  )
}
