import type { ReactElement } from 'react'

import { formatCount, formatPercent, formatSignedCount } from '../format'
import type { IssueWindowTotals, WeldWindowTotals, WindowTotals } from '../types'

interface SummaryItem {
  label: string
  value: string
}

/** The strip of window totals above an expanded chart. */
function SummaryStrip({ items }: { items: SummaryItem[] }): ReactElement {
  return (
    <dl className="qaqc-summary">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export interface WindowSummaryProps {
  totals: WindowTotals
}

export function WindowSummary({ totals }: WindowSummaryProps): ReactElement {
  const average = totals.weeks > 0 ? ((totals.finals + totals.sors) / totals.weeks).toFixed(1) : 'n/a'
  return (
    <SummaryStrip
      items={[
        { label: 'Finals', value: formatCount(totals.finals) },
        { label: 'SORs', value: formatCount(totals.sors) },
        { label: 'Issues found', value: formatCount(totals.issuesFound) },
        { label: 'Avg per week', value: average },
      ]}
    />
  )
}

export interface WeldWindowSummaryProps {
  totals: WeldWindowTotals
}

export function WeldWindowSummary({ totals }: WeldWindowSummaryProps): ReactElement {
  const rate = totals.welds > 0 ? (totals.signed / totals.welds) * 100 : null
  return (
    <SummaryStrip
      items={[
        { label: 'Welds', value: formatCount(totals.welds) },
        { label: 'Signed', value: formatCount(totals.signed) },
        { label: 'Sign-off %', value: formatPercent(rate) },
        { label: 'Issues created', value: formatCount(totals.issues) },
      ]}
    />
  )
}

export interface IssueWindowSummaryProps {
  totals: IssueWindowTotals
}

export function IssueWindowSummary({ totals }: IssueWindowSummaryProps): ReactElement {
  return (
    <SummaryStrip
      items={[
        { label: 'Opened', value: formatCount(totals.opened) },
        { label: 'Closed', value: formatCount(totals.closed) },
        { label: 'Change in remaining', value: formatSignedCount(totals.remainingChange) },
        { label: 'Closure rate', value: formatPercent(totals.closureRate) },
      ]}
    />
  )
}
