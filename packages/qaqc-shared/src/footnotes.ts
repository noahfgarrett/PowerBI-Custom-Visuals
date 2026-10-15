import { formatCount, pluralize } from './format'
import type { InspectionIndex, IssueIndex } from './types'

/** The row counts every index type carries, so one footnote builder serves inspection and weld indexes. */
export type FootnoteSource = Pick<InspectionIndex, 'currentWeek' | 'totalRows' | 'skippedRows' | 'futureRows'>

function rowLimitNote(totalRows: number): string {
  return `Showing the first ${formatCount(totalRows)} rows (Power BI data limit)`
}

function issueCount(count: number): string {
  return `${formatCount(count)} ${pluralize(count, 'issue', 'issues')}`
}

export function buildFootnotes(index: FootnoteSource, rowLimitReached: boolean): string[] {
  const notes: string[] = []
  if (rowLimitReached) notes.push(rowLimitNote(index.totalRows))
  if (index.skippedRows > 0) {
    notes.push(`${formatCount(index.skippedRows)} ${pluralize(index.skippedRows, 'row', 'rows')} skipped: unreadable work week`)
  }
  if (index.futureRows > 0) {
    notes.push(
      `${formatCount(index.futureRows)} ${pluralize(index.futureRows, 'row', 'rows')} dated after ${index.currentWeek.label} not counted`,
    )
  }
  return notes
}

/** Issues are dated by Created On, not a work week column, and only LotusWorks-created issues are included. */
export function buildIssueFootnotes(
  index: Pick<IssueIndex, 'currentWeek' | 'totalRows' | 'skippedRows' | 'futureRows' | 'excludedRows'>,
  rowLimitReached: boolean,
): string[] {
  const notes: string[] = []
  if (rowLimitReached) notes.push(rowLimitNote(index.totalRows))
  if (index.excludedRows > 0) {
    notes.push(`${issueCount(index.excludedRows)} not created by LotusWorks ${pluralize(index.excludedRows, 'is', 'are')} excluded`)
  }
  if (index.skippedRows > 0) {
    notes.push(`${issueCount(index.skippedRows)} skipped: blank or unreadable Created On`)
  }
  if (index.futureRows > 0) {
    notes.push(`${issueCount(index.futureRows)} created after ${index.currentWeek.label} not counted`)
  }
  return notes
}
