import { formatCount, pluralize } from './format'
import type { InspectionIndex } from './types'

/** The row counts every index type carries, so one footnote builder serves inspection and weld indexes. */
export type FootnoteSource = Pick<InspectionIndex, 'currentWeek' | 'totalRows' | 'skippedRows' | 'futureRows'>

export function buildFootnotes(index: FootnoteSource, rowLimitReached: boolean): string[] {
  const notes: string[] = []
  if (rowLimitReached) {
    notes.push(`Showing the first ${formatCount(index.totalRows)} rows (Power BI data limit)`)
  }
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
