import type { IssueColumns } from '../types'
import { ENRICHED_ISSUE_COLUMNS } from './fixtures/enrichedIssueRows'

function position(name: (typeof ENRICHED_ISSUE_COLUMNS)[number]): number {
  return ENRICHED_ISSUE_COLUMNS.indexOf(name)
}

/** The enriched export in its own column order, with every slot its fixture carries bound. Discipline isn't in the fixture. */
export const ENRICHED_COLUMNS: IssueColumns = {
  id: position('ID'),
  title: position('Title'),
  status: position('Status'),
  type: position('Type'),
  contractor: position('Contractor'),
  createdOn: position('Created on'),
  updatedOn: position('Updated on'),
  dueDate: position('Due date'),
  createdBy: position('Created by'),
  rootCause: position('Root cause'),
  rootCauseCategory: -1,
  bim360CreatedBy: position('BIM360_Created By'),
  bim360CreatedOn: position('BIM360_Created On'),
  bim360ClosedOn: position('BIM360_Closed On'),
  closedAt: position('Closed at'),
  createdByCompany: position('Created By (Company)'),
}
