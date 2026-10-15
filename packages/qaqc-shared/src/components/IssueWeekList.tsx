import type { ReactElement } from 'react'

import { formatCount, formatPercent, pluralize } from '../format'
import type { PassRatePoint } from '../types'

export interface IssueWeekListProps {
  points: PassRatePoint[]
}

export function IssueWeekList({ points }: IssueWeekListProps): ReactElement {
  const issueWeeks = points.filter((point) => point.hadIssue).reverse()
  if (issueWeeks.length === 0) return <p className="qaqc-chart-empty">No NCR weeks in this range</p>
  return (
    <ol className="qaqc-issue-list" aria-label="NCR weeks">
      {issueWeeks.map((point) => (
        <li key={point.week.key}>
          <strong>{point.week.label}</strong>
          <span>{`${formatCount(point.issuesFound)} ${pluralize(point.issuesFound, 'issue', 'issues')}`}</span>
          <span>{formatPercent(point.rate)}</span>
        </li>
      ))}
    </ol>
  )
}
