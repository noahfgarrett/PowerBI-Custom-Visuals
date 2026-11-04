import { describe, expect, it } from 'vitest'

import { inspectionFilterFields } from '../inspectionFilters'
import { buildFilterCatalog, type Row } from '../rowFilters'
import { INSPECTION_COLUMNS, PLACEHOLDER_OPTIONAL, UNBOUND_OPTIONAL } from './inspectionFilterFixture'

function contractorRow(contractor: unknown): Row {
  return ["WW40'2026", 'Final', 'No Issue Found', 'F63.1', contractor]
}

function generalContractorOptions(rows: readonly Row[]): Array<[string, number, boolean]> {
  const { fields } = buildFilterCatalog(rows, inspectionFilterFields(INSPECTION_COLUMNS, PLACEHOLDER_OPTIONAL))
  const field = fields.find((candidate) => candidate.def.id === 'generalContractor')
  return (field?.options ?? []).map((option) => [option.label, option.count, option.isBlank])
}

describe('the General Contractor field', () => {
  it('reads a blank as Unassigned, listed last, as the Overview and Performance do', () => {
    const rows = [contractorRow('Greyfox'), contractorRow(''), contractorRow(null), contractorRow('Greyfox'), contractorRow('Bayside')]
    expect(generalContractorOptions(rows)).toEqual([['Greyfox', 2, false], ['Bayside', 1, false], ['Unassigned', 2, true]])
  })

  it('merges N/A and a cell saying Unassigned into that one choice', () => {
    const rows = [contractorRow('N/A'), contractorRow(' unassigned '), contractorRow(''), contractorRow('-')]
    expect(generalContractorOptions(rows)).toEqual([['Unassigned', 4, true]])
  })

  it('is left out when its slot is unbound', () => {
    const ids = inspectionFilterFields(INSPECTION_COLUMNS, UNBOUND_OPTIONAL).map((field) => field.id)
    expect(ids).toEqual(['building'])
  })
})
