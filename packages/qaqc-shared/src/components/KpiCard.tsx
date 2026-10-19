import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from 'lucide-react'
import type { ReactElement } from 'react'

import type { DeltaTone, KpiStatus, Trend } from '../format'

const STATUS_WORDS: Record<KpiStatus, string> = {
  good: 'on track',
  warn: 'watch',
  bad: 'below target',
}

/** The arrow each trend draws; exported so denser value layouts draw the same arrows. */
export const TREND_ICONS: Record<Exclude<Trend, 'none'>, LucideIcon> = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  flat: Minus,
}

export interface KpiCardProps {
  label: string
  value: string
  /** A muted line above the detail, such as the counts behind a rate; the detail then holds only the change. */
  context?: string
  detail: string
  tone: DeltaTone
  trend: Trend
  icon: LucideIcon
  /** Draws a colored status line under the value. */
  status?: KpiStatus
  /** Colors the value bad red, for a value that misses its target on its own. */
  isValueBad?: boolean
  /** The value's full text as a tooltip, for a long value the card cuts short. */
  valueTitle?: string
}

export function KpiCard({ label, value, context, detail, tone, trend, icon: Icon, status, isValueBad = false, valueTitle }: KpiCardProps): ReactElement {
  const TrendIcon = trend === 'none' ? null : TREND_ICONS[trend]
  const text = context === undefined ? detail : `${context}. ${detail}`
  const summary = isValueBad ? `${label}: ${value}. ${text}. Below target` : `${label}: ${value}. ${text}`
  return (
    <article className="qaqc-kpi" aria-label={status === undefined ? summary : `${summary}. Status: ${STATUS_WORDS[status]}`}>
      <div className="qaqc-kpi-head">
        <span className="qaqc-kpi-icon">
          <Icon size={13} aria-hidden="true" />
        </span>
        <span className="qaqc-kpi-label">{label}</span>
      </div>
      <strong className={isValueBad ? 'qaqc-kpi-value is-bad' : 'qaqc-kpi-value'} title={valueTitle}>
        {value}
      </strong>
      {status !== undefined && <span className={`qaqc-kpi-status is-${status}`} aria-hidden="true" />}
      {context !== undefined && <span className="qaqc-kpi-context">{context}</span>}
      <span className={`qaqc-kpi-detail is-${tone}`}>
        {TrendIcon && <TrendIcon size={12} aria-hidden="true" />}
        {detail}
      </span>
    </article>
  )
}
