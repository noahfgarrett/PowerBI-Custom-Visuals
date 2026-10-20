import { useMemo, type ReactElement } from 'react'

import type { IssueDetailRow } from '../types'
import { StatusPill, useIssueTableSort, WindowedIssueTable, type IssueTableColumn } from './WindowedIssueTable'

type SortKey = 'id' | 'subtype' | 'status' | 'title' | 'contractor' | 'workWeek' | 'createdOn' | 'workWeekClosed' | 'dueDate'

// The widths live only here: the stylesheet sets the fixed layout, and the table's minimum width is derived from them.
// ID and the text columns start A to Z; week and date columns start newest first. Blank weeks and dates go last.
const COLUMNS: ReadonlyArray<IssueTableColumn<IssueDetailRow, SortKey>> = [
  { key: 'id', label: 'ID', width: 78, isText: true, firstDirection: 'ascending', sortValue: { kind: 'number', valueOf: (row) => row.idRank } },
  { key: 'subtype', label: 'Subtype', width: 110, isText: true, firstDirection: 'ascending', sortValue: { kind: 'text', valueOf: (row) => row.subtype } },
  { key: 'status', label: 'Status', width: 150, isText: true, firstDirection: 'ascending', sortValue: { kind: 'text', valueOf: (row) => row.status } },
  { key: 'title', label: 'Title', width: null, isText: true, firstDirection: 'ascending', sortValue: { kind: 'text', valueOf: (row) => row.title } },
  { key: 'contractor', label: 'Contractor', width: 140, isText: true, firstDirection: 'ascending', sortValue: { kind: 'text', valueOf: (row) => row.contractor } },
  { key: 'workWeek', label: 'Work Week', width: 104, isText: true, firstDirection: 'descending', sortValue: { kind: 'number', valueOf: (row) => row.workWeekKey } },
  { key: 'createdOn', label: 'Created On', width: 100, isText: true, firstDirection: 'descending', sortValue: { kind: 'number', valueOf: (row) => row.createdOnTime } },
  { key: 'workWeekClosed', label: 'Work Week Closed', width: 146, isText: true, firstDirection: 'descending', sortValue: { kind: 'number', valueOf: (row) => row.workWeekClosedKey } },
  { key: 'dueDate', label: 'Due Date', width: 96, isText: true, firstDirection: 'descending', sortValue: { kind: 'number', valueOf: (row) => row.dueDateTime } },
] as const

/** Title never gets narrower than this; narrower overlays scroll the table sideways instead. */
const TITLE_MIN_WIDTH = 260

const DISCUSSION_TITLE = 'Open for discussion'

export interface IssueDetailTableProps {
  /** Issues created or closed in the selected week or the week before, by ID descending. */
  reportRows: IssueDetailRow[]
  /** Every other open issue as of the selected week, by ID descending. Shaded. */
  discussionRows: IssueDetailRow[]
  /** Names the table for screen readers. */
  caption: string
}

/**
 * The Issue Detail table. Until a header is clicked it keeps the model order: report rows, then discussion rows,
 * each by ID descending.
 */
export function IssueDetailTable({ reportRows, discussionRows, caption }: IssueDetailTableProps): ReactElement {
  const rows = useMemo(() => [...reportRows, ...discussionRows], [reportRows, discussionRows])
  const discussionStart = reportRows.length
  const table = useIssueTableSort(rows, COLUMNS, null)
  const isDiscussion = (position: number): boolean => position >= discussionStart

  return (
    <WindowedIssueTable
      rows={rows}
      columns={COLUMNS}
      table={table}
      titleMinWidth={TITLE_MIN_WIDTH}
      wrapClassName="qaqc-issue-detail-wrap"
      tableClassName="qaqc-issue-detail-table"
      caption={caption}
      rowClassName={(_, position) => (isDiscussion(position) ? 'is-discussion' : undefined)}
      rowTitle={(_, position) => (isDiscussion(position) ? DISCUSSION_TITLE : undefined)}
      renderCells={(row, position) => (
        <>
          <th scope="row">
            {row.id}
            {isDiscussion(position) && <span className="qaqc-visually-hidden">, open for discussion</span>}
          </th>
          <td className="is-text" title={row.subtype}>{row.subtype}</td>
          <td className="is-text">
            <StatusPill detail={row} />
          </td>
          <td className="is-text" title={row.title}>{row.title}</td>
          <td className="is-text" title={row.contractor}>{row.contractor}</td>
          <td className="is-text">{row.workWeek}</td>
          <td className="is-text">{row.createdOn}</td>
          <td className="is-text">{row.workWeekClosed}</td>
          <td className="is-text">{row.dueDate}</td>
        </>
      )}
    />
  )
}
