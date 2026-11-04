import { useMemo, type ReactElement } from 'react'

import type { DrillColumn, DrillGroup } from '../drilldown'
import { formatCount } from '../format'
import type { Row } from '../rowFilters'
import { useIssueTableSort, WindowedIssueTable, type IssueTableColumn } from './WindowedIssueTable'

/** A long column never gets narrower than this; narrower overlays scroll the table sideways instead. */
const LONG_COLUMN_MIN_WIDTH = 180
/** A short column's text stops widening it here, and truncates with its title. */
const SHORT_COLUMN_MAX_WIDTH = 190
// Estimates at the table's type sizes, so a column's width doesn't need measuring in the page.
const CELL_CHAR_WIDTH = 7
const CODE_CHAR_WIDTH = 8.4
/** A code column stops widening here. Wide enough for the project's longest tag numbers. */
const CODE_COLUMN_MAX_WIDTH = 420
const CELL_PADDING = 24
const HEADER_CHAR_WIDTH = 8
/** Button padding and room for the sort arrow. */
const HEADER_PADDING = 34

/** Wide enough for the column's longest value, and for its label on two lines. */
function shortColumnWidth(column: DrillColumn, rows: ReadonlyArray<Row>): number {
  const longestWord = column.label.split(' ').reduce((longest, word) => Math.max(longest, word.length), 0)
  const labelChars = Math.max(longestWord, Math.ceil(column.label.length / 2))
  const longestValue = rows.reduce((longest, row) => Math.max(longest, column.read(row).length), 0)
  const valueWidth = column.isCode === true
    ? Math.min(longestValue * CODE_CHAR_WIDTH + CELL_PADDING, CODE_COLUMN_MAX_WIDTH)
    : Math.min(longestValue * CELL_CHAR_WIDTH + CELL_PADDING, SHORT_COLUMN_MAX_WIDTH)
  return Math.max(labelChars * HEADER_CHAR_WIDTH + HEADER_PADDING, valueWidth)
}

function tableColumns(group: DrillGroup): Array<IssueTableColumn<Row, string>> {
  return group.columns.map((column) => ({
    key: column.key,
    label: column.label,
    width: column.isLong === true ? null : column.width ?? shortColumnWidth(column, group.rows),
    isText: true,
    firstDirection: column.firstDirection ?? 'ascending',
    sortValue: column.sortNumber === undefined
      ? { kind: 'text', valueOf: column.read }
      : { kind: 'number', valueOf: column.sortNumber },
  }))
}

interface DrillTableProps {
  group: DrillGroup
  caption: string
}

/** One group's sortable, windowed table. It starts sorted by its first column, ties keeping the row order. */
function DrillTable({ group, caption }: DrillTableProps): ReactElement {
  const { columns, rows } = group
  const table = useMemo(() => tableColumns(group), [group])
  const sort = useIssueTableSort(rows, table, columns.length > 0 ? { key: columns[0].key, direction: 'ascending' } : null)
  const longColumnCount = columns.filter((column) => column.isLong === true).length

  return (
    <WindowedIssueTable
      rows={rows}
      columns={table}
      table={sort}
      titleMinWidth={longColumnCount * LONG_COLUMN_MIN_WIDTH}
      wrapClassName="qaqc-week-issues-wrap"
      tableClassName="qaqc-week-issues-table"
      caption={caption}
      renderCells={(row) => columns.map((column, position) => {
        const text = column.read(row)
        return position === 0
          ? <th key={column.key} scope="row" title={text}>{text}</th>
          : <td key={column.key} className="is-text" title={text}>{text}</td>
      })}
    />
  )
}

export interface WeekIssuesPageProps {
  weekLabel: string
  groups: DrillGroup[]
}

/** A week's issue rows, drawn inside a `kind: 'page'` panel titled with the week. */
export function WeekIssuesPage({ weekLabel, groups }: WeekIssuesPageProps): ReactElement {
  // A row in two groups is one issue, such as one opened and closed in the same week. The headings give the split.
  const count = new Set(groups.flatMap((group) => group.rows)).size

  return (
    <div className="qaqc-week-issues">
      <p className="qaqc-week-issues-count">
        <strong>{formatCount(count)}</strong> {count === 1 ? 'issue' : 'issues'} in {weekLabel}
      </p>
      {groups.map((group, position) => (
        <section key={group.title ?? position} className="qaqc-week-issues-group" aria-label={group.title ?? undefined}>
          {group.title !== null && <h4>{group.title} ({formatCount(group.rows.length)})</h4>}
          <DrillTable group={group} caption={`${group.title ?? 'Issues'} in ${weekLabel}`} />
        </section>
      ))}
    </div>
  )
}
