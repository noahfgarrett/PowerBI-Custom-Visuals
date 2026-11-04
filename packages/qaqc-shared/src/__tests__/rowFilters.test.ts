import { describe, expect, it } from 'vitest'

import {
  activeFieldCount,
  buildFilterCatalog,
  cellDisplayText,
  groupKey,
  isFieldActive,
  matchRows,
  NO_SELECTION,
  normalizeSelection,
  NOT_RECORDED_LABEL,
} from '../rowFilters'
import type { FilterCatalog, FilterFieldDef, FilterSelection, Row } from '../rowFilters'

/** A row with a discipline in column 0, a building in column 1 and a welder list in column 2. */
const DISCIPLINE: FilterFieldDef = { id: 'discipline', label: 'Discipline', read: (row) => cellDisplayText(row[0]) }
const BUILDING: FilterFieldDef = { id: 'building', label: 'Building', read: (row) => cellDisplayText(row[1]) }

function selectionOf(entries: Record<string, readonly string[]>): FilterSelection {
  return new Map(Object.entries(entries).map(([id, keys]) => [id, new Set(keys)]))
}

function optionsOf(catalog: FilterCatalog, fieldId: string): { label: string; count: number }[] {
  const field = catalog.fields.find((candidate) => candidate.def.id === fieldId)
  if (field === undefined) throw new Error(`no field ${fieldId}`)
  return field.options.map(({ label, count }) => ({ label, count }))
}

describe('buildFilterCatalog', () => {
  it('groups values trimmed and ignoring case, showing the most common spelling', () => {
    const rows: Row[] = [
      ...Array.from({ length: 2 }, () => ['ELECTRICAL', 'F63.1']),
      ...Array.from({ length: 5 }, () => ['Electrical', 'F63.1']),
      ['  electrical ', 'F63.2'],
    ]
    const catalog = buildFilterCatalog(rows, [DISCIPLINE])
    expect(optionsOf(catalog, 'discipline')).toEqual([{ label: 'Electrical', count: 8 }])
    expect(catalog.fields[0].options[0].key).toBe('electrical')
  })

  it('groups blank, N/A, n/a, NA, None and - into Not recorded, listed last', () => {
    const rows: Row[] = [['Zinc'], [''], ['N/A'], ['n/a'], ['NA'], ['None'], ['-'], [null], ['  ']]
    const options = buildFilterCatalog(rows, [DISCIPLINE]).fields[0].options
    expect(options.map(({ label, count, isBlank }) => ({ label, count, isBlank }))).toEqual([
      { label: 'Zinc', count: 1, isBlank: false },
      { label: NOT_RECORDED_LABEL, count: 8, isBlank: true },
    ])
  })

  it('uses blankLabel in place of Not recorded when set', () => {
    const building: FilterFieldDef = { ...BUILDING, blankLabel: 'Unspecified' }
    const options = buildFilterCatalog([['E', ''], ['E', 'F63.1']], [building]).fields[0].options
    expect(options.map(({ label }) => label)).toEqual(['F63.1', 'Unspecified'])
  })

  it('sorts options by count descending, Not recorded last', () => {
    const rows: Row[] = [['b'], [''], [''], [''], ['a'], ['c'], ['c']]
    expect(optionsOf(buildFilterCatalog(rows, [DISCIPLINE]), 'discipline')).toEqual([
      { label: 'c', count: 2 },
      { label: 'a', count: 1 },
      { label: 'b', count: 1 },
      { label: NOT_RECORDED_LABEL, count: 3 },
    ])
  })

  it('leaves Not recorded out when no row is blank', () => {
    expect(optionsOf(buildFilterCatalog([['a']], [DISCIPLINE]), 'discipline')).toEqual([{ label: 'a', count: 1 }])
  })

  it('shows a Date cell as yyyy-mm-dd and a number as its text', () => {
    expect(cellDisplayText(new Date(2026, 2, 7))).toBe('2026-03-07')
    expect(cellDisplayText(42)).toBe('42')
    expect(cellDisplayText(null)).toBe('')
    expect(cellDisplayText(undefined)).toBe('')
    expect(cellDisplayText(new Date(Number.NaN))).toBe('')
    const rows: Row[] = [[new Date(2026, 2, 7)], [new Date(2026, 2, 7)], [7]]
    expect(optionsOf(buildFilterCatalog(rows, [DISCIPLINE]), 'discipline')).toEqual([
      { label: '2026-03-07', count: 2 },
      { label: '7', count: 1 },
    ])
  })

  it('counts a multi-value row once per value in options', () => {
    const welder: FilterFieldDef = {
      id: 'welder',
      label: 'Welder',
      read: (row) => cellDisplayText(row[2]).split(',').map((part) => part.trim()),
    }
    const rows: Row[] = [['', '', 'P-012, PF-025'], ['', '', 'P-012'], ['', '', 'P-012, p-012']]
    const catalog = buildFilterCatalog(rows, [welder])
    expect(optionsOf(catalog, 'welder')).toEqual([
      { label: 'P-012', count: 3 },
      { label: 'PF-025', count: 1 },
    ])
    expect(catalog.totalRows).toBe(3)
  })

  it('counts nothing for a row where appliesTo is false', () => {
    const building: FilterFieldDef = { ...BUILDING, appliesTo: (row) => row[0] === 'Weld' }
    const rows: Row[] = [['Weld', 'F63.1'], ['Insp', 'F63.2'], ['Insp', '']]
    expect(optionsOf(buildFilterCatalog(rows, [building]), 'building')).toEqual([{ label: 'F63.1', count: 1 }])
  })

  it('lists no options for an empty row set', () => {
    const catalog = buildFilterCatalog([], [DISCIPLINE])
    expect(catalog.fields[0].options).toEqual([])
    expect(catalog.totalRows).toBe(0)
  })
})

describe('groupKey', () => {
  it('trims and lower-cases, and sends the not-recorded spellings to one key', () => {
    expect(groupKey('  F63.1 ')).toBe('f63.1')
    const keys = new Set(['', ' ', 'N/A', 'n/a', 'NA', 'None', '-'].map(groupKey))
    expect(keys.size).toBe(1)
    expect(groupKey('Nancy')).toBe('nancy')
  })
})

describe('matchRows', () => {
  const rows: Row[] = [
    ['Electrical', 'F63.1'],
    ['ELECTRICAL', 'F63.2'],
    ['Mechanical', 'F63.1'],
    ['Mechanical', 'F63.2'],
    ['', 'F63.3'],
  ]
  const catalog = buildFilterCatalog(rows, [DISCIPLINE, BUILDING])

  it('matches OR within a field and AND across fields', () => {
    expect(matchRows(rows, catalog, selectionOf({ discipline: ['electrical', 'mechanical'] }))).toEqual(rows.slice(0, 4))
    expect(matchRows(rows, catalog, selectionOf({ discipline: ['electrical', 'mechanical'], building: ['f63.1'] }))).toEqual([rows[0], rows[2]])
  })

  it('matches every spelling of a ticked value', () => {
    expect(matchRows(rows, catalog, selectionOf({ discipline: ['electrical'] }))).toEqual([rows[0], rows[1]])
  })

  it('matches the Not recorded group by its blank key', () => {
    const blankKey = catalog.fields[0].options.find((option) => option.isBlank)?.key ?? 'missing'
    expect(matchRows(rows, catalog, selectionOf({ discipline: [blankKey] }))).toEqual([rows[4]])
  })

  it('returns the same rows array when nothing is active', () => {
    expect(matchRows(rows, catalog, NO_SELECTION)).toBe(rows)
    expect(matchRows(rows, catalog, selectionOf({ discipline: [] }))).toBe(rows)
  })

  it('returns no rows when the ticked values match none', () => {
    expect(matchRows(rows, catalog, selectionOf({ discipline: ['civil'] }))).toEqual([])
  })

  it('a multi-value read matches a row if any value is ticked, and counts the row once in matchRows', () => {
    const welder: FilterFieldDef = {
      id: 'welder',
      label: 'Welder',
      read: (row) => cellDisplayText(row[2]).split(',').map((part) => part.trim()),
    }
    const welds: Row[] = [['', '', 'P-012, PF-025'], ['', '', 'PF-025'], ['', '', 'P-099']]
    const weldCatalog = buildFilterCatalog(welds, [welder])
    expect(matchRows(welds, weldCatalog, selectionOf({ welder: ['p-012', 'pf-025'] }))).toEqual([welds[0], welds[1]])
  })

  it('appliesTo false leaves the row in the result and out of the field counts', () => {
    const building: FilterFieldDef = { ...BUILDING, appliesTo: (row) => row[0] === 'Weld' }
    const mixed: Row[] = [['Weld', 'F63.1'], ['Weld', 'F63.2'], ['Insp', 'F63.2']]
    const mixedCatalog = buildFilterCatalog(mixed, [building])
    expect(optionsOf(mixedCatalog, 'building')).toEqual([{ label: 'F63.1', count: 1 }, { label: 'F63.2', count: 1 }])
    expect(matchRows(mixed, mixedCatalog, selectionOf({ building: ['f63.1'] }))).toEqual([mixed[0], mixed[2]])
  })
})

describe('defaultKeys', () => {
  const company: FilterFieldDef = { id: 'company', label: 'Company', read: (row) => cellDisplayText(row[0]), defaultKeys: ['lotusworks'] }
  const rows: Row[] = [['LotusWorks'], ['Acme'], ['Acme']]
  const catalog = buildFilterCatalog(rows, [company])
  const field = catalog.fields[0]

  it("a selection equal to defaultKeys isn't active, and an empty selection on a field with defaultKeys falls back to the default", () => {
    expect(isFieldActive(field, new Set(['lotusworks']))).toBe(false)
    expect(isFieldActive(field, new Set())).toBe(false)
    expect(isFieldActive(field, undefined)).toBe(false)
    expect(isFieldActive(field, new Set(['acme']))).toBe(true)
    expect(isFieldActive(field, new Set(['lotusworks', 'acme']))).toBe(true)
    expect(activeFieldCount(catalog, selectionOf({ company: ['lotusworks'] }))).toBe(0)
    expect(matchRows(rows, catalog, selectionOf({ company: ['lotusworks'] }))).toBe(rows)
    expect(matchRows(rows, catalog, selectionOf({ company: [] }))).toBe(rows)
  })

  it('treats a field without defaultKeys as active for any ticked key', () => {
    const plain = buildFilterCatalog(rows, [DISCIPLINE]).fields[0]
    expect(isFieldActive(plain, new Set(['acme']))).toBe(true)
    expect(isFieldActive(plain, new Set())).toBe(false)
  })
})

describe('activeFieldCount', () => {
  it('counts the fields with an active selection', () => {
    const catalog = buildFilterCatalog([['a', 'b']], [DISCIPLINE, BUILDING])
    expect(activeFieldCount(catalog, NO_SELECTION)).toBe(0)
    expect(activeFieldCount(catalog, selectionOf({ discipline: ['a'], building: ['b'] }))).toBe(2)
  })
})

describe('normalizeSelection', () => {
  const catalog = buildFilterCatalog([['Electrical', 'F63.1'], ['Mechanical', 'F63.2']], [DISCIPLINE, BUILDING])

  it('drops keys no longer in the catalog and removes emptied fields', () => {
    const normalized = normalizeSelection(
      selectionOf({ discipline: ['electrical', 'civil'], building: ['f99'], vanished: ['x'] }),
      catalog,
    )
    expect([...normalized.keys()]).toEqual(['discipline'])
    expect([...(normalized.get('discipline') ?? [])]).toEqual(['electrical'])
  })

  it('returns the same selection when nothing changes', () => {
    const selection = selectionOf({ discipline: ['electrical'] })
    expect(normalizeSelection(selection, catalog)).toBe(selection)
  })
})
