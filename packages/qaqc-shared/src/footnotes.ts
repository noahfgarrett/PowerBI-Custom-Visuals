import { formatCount, pluralize } from './format'
import type { InspectionIndex } from './types'

export function buildFootnotes(index: InspectionIndex, hasRowId: boolean, rowLimitReached: boolean): string[] {
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
  if (!hasRowId) {
    notes.push('Add an Index column to the Row ID slot so Power BI keeps identical rows separate')
  }
  return notes
}
