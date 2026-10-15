import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from 'lucide-react'
import type { ReactElement } from 'react'

import type { DeltaTone, KpiStatus, Trend } from '../format'

const STATUS_WORDS: Record<KpiStatus, string> = {
  good: 'on track',
  warn: 'watch',
  bad: 'below target',
}

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
  /** Draws a colored status line under the value. */
  status?: KpiStatus
  /** Colors the value bad red, for a value that misses its target on its own. */
  isValueBad?: boolean
}

export function KpiCard({ label, value, detail, tone, trend, icon: Icon, status, isValueBad = false }: KpiCardProps): ReactElement {
  const TrendIcon = trend === 'none' ? null : TREND_ICONS[trend]
  const summary = `${label}: ${value}. ${detail}`
  return (
    <article className="qaqc-kpi" aria-label={status === undefined ? summary : `${summary}. Status: ${STATUS_WORDS[status]}`}>
      <div className="qaqc-kpi-head">
        <span className="qaqc-kpi-icon">
          <Icon size={13} aria-hidden="true" />
        </span>
        <span className="qaqc-kpi-label">{label}</span>
      </div>
      <strong className={isValueBad ? 'qaqc-kpi-value is-bad' : 'qaqc-kpi-value'}>{value}</strong>
      {status !== undefined && <span className={`qaqc-kpi-status is-${status}`} aria-hidden="true" />}
      <span className={`qaqc-kpi-detail is-${tone}`}>
        {TrendIcon && <TrendIcon size={12} aria-hidden="true" />}
        {detail}
      </span>
    </article>
  )
}
