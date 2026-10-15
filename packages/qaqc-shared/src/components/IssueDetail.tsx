import { CircleCheck, CirclePlus, Inbox } from 'lucide-react'
import { useMemo, type ReactElement } from 'react'

import { formatCount } from '../format'
import { buildIssueDetail } from '../issues'
import type { IssueIndex, WorkWeek } from '../types'
import { previousWorkWeek } from '../workWeeks'
import { IssueDetailTable } from './IssueDetailTable'
import { KpiCard } from './KpiCard'
import { KpiGroup } from './KpiGroup'

export interface IssueDetailProps {
  index: IssueIndex
  /** The week the dashboard shows; the detail is as of this week. */
  selectedWeek: WorkWeek
}

/**
 * The Issue Detail overlay's content: this week's and last week's opened and closed counts, then every issue to
 * review. Mount it only while the overlay is open: building the detail walks every issue.
 */
export function IssueDetail({ index, selectedWeek }: IssueDetailProps): ReactElement {
  const selectedKey = selectedWeek.key
  // Keyed on the week, not the week object, so a re-render with an equal week does not rebuild.
  const detail = useMemo(() => buildIssueDetail(index, selectedKey), [index, selectedKey])
  const previousWeek = previousWorkWeek(selectedWeek)
  const hasRows = detail.reportRows.length + detail.discussionRows.length > 0

  return (
    <div className="qaqc-issue-detail">
      <div className="qaqc-kpi-row qaqc-issue-detail-cards">
        <KpiGroup title="This week" subtitle={selectedWeek.label} variant="week">
          <KpiCard
            label="Opened This Week"
            icon={CirclePlus}
            value={formatCount(detail.openedThisWeek)}
            detail={`Created in ${selectedWeek.label}`}
            tone="neutral"
            trend="none"
          />
          <KpiCard
            label="Closed This Week"
            icon={CircleCheck}
            value={formatCount(detail.closedThisWeek)}
            detail={`Closed in ${selectedWeek.label}`}
            tone="neutral"
            trend="none"
          />
        </KpiGroup>
        <KpiGroup title="Last week" subtitle={previousWeek.label} variant="total">
          <KpiCard
            label="Opened Last Week"
            icon={CirclePlus}
            value={formatCount(detail.openedLastWeek)}
            detail={`Created in ${previousWeek.label}`}
            tone="neutral"
            trend="none"
          />
          <KpiCard
            label="Closed Last Week"
            icon={CircleCheck}
            value={formatCount(detail.closedLastWeek)}
            detail={`Closed in ${previousWeek.label}`}
            tone="neutral"
            trend="none"
          />
        </KpiGroup>
      </div>

      {hasRows ? (
        <>
          <ul className="qaqc-detail-legend" aria-label="Row groups">
            <li>
              <i className="qaqc-detail-swatch is-report" aria-hidden="true" />
              Reporting week
              <strong>{formatCount(detail.reportRows.length)}</strong>
            </li>
            <li>
              <i className="qaqc-detail-swatch is-discussion" aria-hidden="true" />
              Open for discussion
              <strong>{formatCount(detail.discussionRows.length)}</strong>
            </li>
          </ul>
          <IssueDetailTable
            reportRows={detail.reportRows}
            discussionRows={detail.discussionRows}
            caption={`BIM issues as of ${selectedWeek.label}: reporting-week issues, then issues open for discussion`}
          />
        </>
      ) : (
        <div className="qaqc-detail-empty" role="status">
          <Inbox size={22} aria-hidden="true" />
          <strong>{`No issues to review as of ${selectedWeek.label}`}</strong>
          <span>{`Nothing was opened or closed in ${previousWeek.label} or ${selectedWeek.label}, and no issues are open.`}</span>
        </div>
      )}
    </div>
  )
}
