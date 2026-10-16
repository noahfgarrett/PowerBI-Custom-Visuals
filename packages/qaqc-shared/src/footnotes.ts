import { formatCount, pluralize } from './format'
import type { OverviewIndex, SourceFootnoteCounts } from './overview'
import type { PerformanceGroup, PerformanceIndex, PerformanceModel } from './performance'
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
export function buildIssueFootnotes(index: FootnoteSource & Pick<IssueIndex, 'excludedRows'>, rowLimitReached: boolean): string[] {
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

function prefixed(source: string, notes: string[]): string[] {
  return notes.map((note) => `${source}: ${note}`)
}

/**
 * The QAQC Combined table's notes: the row limit over every combined row, then each source's own notes in the
 * discipline visuals' wording, prefixed with the source, then the rows whose Source matched none of the four.
 */
export function buildOverviewFootnotes(index: Pick<OverviewIndex, 'currentWeek' | 'footnotes'>, rowLimitReached: boolean): string[] {
  const { currentWeek, footnotes } = index
  const sourceOf = (counts: SourceFootnoteCounts): FootnoteSource & Pick<IssueIndex, 'excludedRows'> => ({ ...counts, currentWeek })
  const totalRows =
    footnotes.electrical.totalRows +
    footnotes.mechanical.totalRows +
    footnotes.welding.totalRows +
    footnotes.bim.totalRows +
    footnotes.unknownSource
  const notes: string[] = []
  if (rowLimitReached) notes.push(rowLimitNote(totalRows))
  notes.push(
    ...prefixed('Electrical', buildFootnotes(sourceOf(footnotes.electrical), false)),
    ...prefixed('Mechanical', buildFootnotes(sourceOf(footnotes.mechanical), false)),
    ...prefixed('Welding', buildFootnotes(sourceOf(footnotes.welding), false)),
    ...prefixed('BIM Issues', buildIssueFootnotes(sourceOf(footnotes.bim), false)),
  )
  if (footnotes.unknownSource > 0) {
    notes.push(`${formatCount(footnotes.unknownSource)} ${pluralize(footnotes.unknownSource, 'row', 'rows')} with an unknown Source`)
  }
  return notes
}

/**
 * The Performance view's notes: the row limit over every combined row, then the shown group's skipped and future
 * rows, then its period note (inspections with no QCR/FE, or welds crediting several welders), then the rows whose
 * Source matched none of the four.
 */
export function buildPerformanceFootnotes(
  index: Pick<PerformanceIndex, 'currentWeek' | 'footnotes'>,
  group: PerformanceGroup,
  model: Pick<PerformanceModel, 'notRecorded' | 'sharedWelds'>,
  rowLimitReached: boolean,
): string[] {
  const { currentWeek, footnotes } = index
  const notes: string[] = []
  if (rowLimitReached) notes.push(rowLimitNote(footnotes.combinedRows))
  notes.push(...buildFootnotes({ ...footnotes[group], currentWeek }, false))

  if (group === 'qcr') {
    const inspections = model.notRecorded === null ? 0 : model.notRecorded.volume + model.notRecorded.sors
    if (inspections > 0) {
      notes.push(`${formatCount(inspections)} ${pluralize(inspections, 'inspection has', 'inspections have')} no QCR/FE`)
    }
  } else if (model.sharedWelds > 0) {
    notes.push(
      `${formatCount(model.sharedWelds)} ${pluralize(model.sharedWelds, 'weld lists', 'welds list')} more than one welder; each welder is credited`,
    )
  }

  if (footnotes.unknownSource > 0) {
    notes.push(`${formatCount(footnotes.unknownSource)} ${pluralize(footnotes.unknownSource, 'row', 'rows')} with an unknown Source`)
  }
  return notes
}
