import type { ReactElement } from 'react'

import { formatCount } from '../format'
import type { WindowTotals } from '../types'

export interface WindowSummaryProps {
  totals: WindowTotals
}

export function WindowSummary({ totals }: WindowSummaryProps): ReactElement {
  const average = totals.weeks > 0 ? ((totals.finals + totals.sors) / totals.weeks).toFixed(1) : 'n/a'
  const items: Array<{ label: string; value: string }> = [
    { label: 'Finals', value: formatCount(totals.finals) },
    { label: 'SORs', value: formatCount(totals.sors) },
    { label: 'Issues found', value: formatCount(totals.issuesFound) },
    { label: 'Avg per week', value: average },
  ]
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
