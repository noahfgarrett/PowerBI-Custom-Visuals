import { describe, expect, it } from 'vitest'

import type { InspectionTableSource } from '../dataView'
import { FFU_SLOTS, buildFfuIndex, readFfuTable, type FfuIndex, type FfuRole } from '../ffuMap'
import {
  NO_FILTERS,
  SEARCH_LIMIT,
  effectiveGroup,
  filterOptions,
  matchMask,
  nodeMatches,
  searchTags,
  summarize,
  type FfuFilters,
} from '../ffuFilters'

type FfuRecord = Partial<Record<FfuRole, unknown>>

const ALL_ROLES: readonly FfuRole[] = FFU_SLOTS.map((slot) => slot.role)

function source(records: readonly FfuRecord[]): InspectionTableSource {
  return {
    columns: ALL_ROLES.map((role) => ({ roles: { [role]: true } })),
    rows: records.map((record) => ALL_ROLES.map((role) => record[role] ?? null)),
  }
}

function indexOf(records: readonly FfuRecord[]): FfuIndex {
  const result = readFfuTable(source(records))
  if (result.kind !== 'ready') throw new Error(`expected a ready table, got ${result.kind}`)
  return buildFfuIndex(result.rows, result.columns)
}

function filters(overrides: Partial<FfuFilters>): FfuFilters {
  return { ...NO_FILTERS, ...overrides }
}

function matchedTags(index: FfuIndex, mask: Uint8Array): string[] {
  return index.nodes.filter((_, nodeIndex) => mask[nodeIndex] === 1).map((node) => node.tag)
}

function tagsOf(index: FfuIndex, nodeIndices: readonly number[]): string[] {
  return nodeIndices.map((nodeIndex) => index.nodes[nodeIndex]?.tag ?? '?')
}

/** Four nodes: A and B on line L1 (group G1), C on line L2 (group G2), D off any line. */
const SAMPLE: readonly FfuRecord[] = [
  { tag: 'FFU900-ZZ01-F01-A', x: 1, y: 1, line: 'L1', lineOrder: 1, group: 'G1', zone: 'Z1', rioPanel: 'R1', energized: 'true' },
  { tag: 'FFU900-ZZ01-F02-A', x: 2, y: 1, line: 'L1', lineOrder: 2, group: 'G1', zone: 'Z2', rioPanel: 'R1', energized: 'false' },
  { tag: 'FFU900-ZZ02-F01-A', x: 3, y: 1, line: 'L2', lineOrder: 1, group: 'G2', zone: 'Z1', rioPanel: 'R2', energized: 'true' },
  { tag: 'FFU900-ZZ03-F01-A', x: 4, y: 1 },
]

describe('matchMask', () => {
  it('matches every node with no filters', () => {
    const index = indexOf(SAMPLE)
    const mask = matchMask(index, NO_FILTERS)
    expect(mask).toHaveLength(index.nodes.length)
    expect(Array.from(mask)).toEqual([1, 1, 1, 1])
  })

  it('combines filters with AND', () => {
    const index = indexOf(SAMPLE)
    const mask = matchMask(index, filters({ zone: 'Z1', energized: 'on', rioPanel: 'R2' }))
    expect(matchedTags(index, mask)).toEqual(['FFU900-ZZ02-F01-A'])
    expect(matchedTags(index, matchMask(index, filters({ zone: 'Z2', energized: 'on' })))).toEqual([])
  })

  it('matches the group filter on the effective group', () => {
    const index = indexOf([
      { tag: 'FFU900-ZZ01-F01-A', x: 1, y: 1, line: 'L1', lineOrder: 1, group: 'G1' },
      { tag: 'FFU900-ZZ01-F02-A', x: 2, y: 1, line: 'L1', lineOrder: 2, group: 'G1' },
      { tag: 'FFU900-ZZ01-F03-A', x: 3, y: 1, line: 'L1', lineOrder: 3 },
      { tag: 'FFU900-ZZ02-F01-A', x: 4, y: 1 },
    ])
    const blankNode = index.nodes[2]
    const loneNode = index.nodes[3]
    if (!blankNode || !loneNode) throw new Error('expected nodes')
    expect(blankNode.group).toBe('')
    expect(effectiveGroup(index, blankNode)).toBe('G1')
    expect(effectiveGroup(index, loneNode)).toBe('')
    expect(nodeMatches(index, blankNode, filters({ group: 'G1' }))).toBe(true)
    expect(matchedTags(index, matchMask(index, filters({ group: 'G1' })))).toEqual([
      'FFU900-ZZ01-F01-A',
      'FFU900-ZZ01-F02-A',
      'FFU900-ZZ01-F03-A',
    ])
  })

  it('prefers the node own group over its line group', () => {
    const index = indexOf([
      { tag: 'FFU900-ZZ01-F01-A', x: 1, y: 1, line: 'L1', lineOrder: 1, group: 'G1' },
      { tag: 'FFU900-ZZ01-F02-A', x: 2, y: 1, line: 'L1', lineOrder: 2, group: 'G1' },
      { tag: 'FFU900-ZZ01-F03-A', x: 3, y: 1, line: 'L1', lineOrder: 3, group: 'G9' },
    ])
    const odd = index.nodes[2]
    if (!odd) throw new Error('expected node')
    expect(effectiveGroup(index, odd)).toBe('G9')
  })
})

describe('summarize', () => {
  it('counts only matching nodes', () => {
    const index = indexOf(SAMPLE)
    const summary = summarize(index, matchMask(index, filters({ group: 'G1' })))
    expect(summary).toEqual({
      total: 2,
      energized: 1,
      deEnergized: 1,
      percentEnergized: 50,
      noTracker: 0,
      groups: 1,
      mismatches: 0,
      notPlaced: 0,
    })
  })

  it('leaves percentEnergized unrounded', () => {
    const index = indexOf([
      { tag: 'FFU900-ZZ01-F01-A', x: 1, y: 1, energized: 'true' },
      { tag: 'FFU900-ZZ01-F02-A', x: 2, y: 1, energized: 'false' },
      { tag: 'FFU900-ZZ01-F03-A', x: 3, y: 1, energized: 'false' },
    ])
    expect(summarize(index, matchMask(index, NO_FILTERS)).percentEnergized).toBeCloseTo(100 / 3, 10)
  })

  it('gives a null percentEnergized when nothing matches', () => {
    const index = indexOf(SAMPLE)
    const summary = summarize(index, matchMask(index, filters({ zone: 'nope' })))
    expect(summary.total).toBe(0)
    expect(summary.percentEnergized).toBeNull()
    expect(summary.groups).toBe(0)
  })

  it('counts distinct lines with at least one match as groups', () => {
    const index = indexOf(SAMPLE)
    expect(summarize(index, matchMask(index, NO_FILTERS)).groups).toBe(2)
    expect(summarize(index, matchMask(index, filters({ zone: 'Z1' }))).groups).toBe(2)
    expect(summarize(index, matchMask(index, filters({ zone: 'Z2' }))).groups).toBe(1)
  })

  it('passes notPlaced through from the index', () => {
    const index = indexOf([...SAMPLE, { tag: 'FFU900-ZZ09-F01-A', x: 'bad', y: 1 }, { tag: '', x: 1, y: 1 }])
    expect(index.notPlaced).toBe(2)
    expect(summarize(index, matchMask(index, filters({ zone: 'Z2' }))).notPlaced).toBe(2)
  })

  it('counts noTracker as matching nodes with hasTracker false', () => {
    const index = indexOf(SAMPLE)
    expect(summarize(index, matchMask(index, NO_FILTERS)).noTracker).toBe(1)
    expect(summarize(index, matchMask(index, filters({ group: 'G1' }))).noTracker).toBe(0)
  })

  it('counts mismatches among matching nodes', () => {
    const index = indexOf([
      { tag: 'FFU900-ZZ01-F01-A', x: 1, y: 1, line: 'L1', lineOrder: 1, group: 'G1', zone: 'Z1' },
      { tag: 'FFU900-ZZ01-F02-A', x: 2, y: 1, line: 'L1', lineOrder: 2, group: 'G1', zone: 'Z1' },
      { tag: 'FFU900-ZZ01-F03-A', x: 3, y: 1, line: 'L1', lineOrder: 3, group: 'G9', zone: 'Z2' },
    ])
    expect(summarize(index, matchMask(index, NO_FILTERS)).mismatches).toBe(1)
    expect(summarize(index, matchMask(index, filters({ zone: 'Z1' }))).mismatches).toBe(0)
  })

  it('does not count unknown energized nodes as either state', () => {
    const index = indexOf(SAMPLE)
    const summary = summarize(index, matchMask(index, NO_FILTERS))
    expect(summary.energized).toBe(2)
    expect(summary.deEnergized).toBe(1)
    expect(summary.total).toBe(4)
  })
})

describe('filterOptions', () => {
  it('sorts naturally and drops blanks', () => {
    const index = indexOf([
      { tag: 'FFU900-ZZ01-F01-A', x: 1, y: 1, group: 'G10', zone: 'Z10', rioPanel: 'R2' },
      { tag: 'FFU900-ZZ01-F02-A', x: 2, y: 1, group: 'G2', zone: 'Z2', rioPanel: 'R10' },
      { tag: 'FFU900-ZZ01-F03-A', x: 3, y: 1, group: 'G2', zone: 'Z2', rioPanel: '' },
      { tag: 'FFU900-ZZ01-F04-A', x: 4, y: 1 },
    ])
    expect(filterOptions(index)).toEqual({
      zones: ['Z2', 'Z10'],
      groups: ['G2', 'G10'],
      rioPanels: ['R2', 'R10'],
    })
  })

  it('includes line groups inherited by blank-group nodes', () => {
    const index = indexOf([
      { tag: 'FFU900-ZZ01-F01-A', x: 1, y: 1, line: 'L1', lineOrder: 1, group: 'G1' },
      { tag: 'FFU900-ZZ01-F02-A', x: 2, y: 1, line: 'L1', lineOrder: 2 },
    ])
    expect(filterOptions(index).groups).toEqual(['G1'])
  })
})

describe('searchTags', () => {
  const searchIndex = indexOf([
    { tag: 'FFU900-ZZ01-F10-A', x: 1, y: 1 },
    { tag: 'XFFU900-ZZ01-F01-A', x: 2, y: 1 },
    { tag: 'FFU900-ZZ01-F02-A', x: 3, y: 1 },
    { tag: 'AFFU900-ZZ01-F01-A', x: 4, y: 1 },
  ])

  it('puts prefix matches first and sorts each bucket naturally', () => {
    expect(tagsOf(searchIndex, searchTags(searchIndex, 'ffu900'))).toEqual([
      'FFU900-ZZ01-F02-A',
      'FFU900-ZZ01-F10-A',
      'AFFU900-ZZ01-F01-A',
      'XFFU900-ZZ01-F01-A',
    ])
  })

  it('caps results at the search limit', () => {
    const many = indexOf(
      Array.from({ length: 20 }, (_, i): FfuRecord => ({ tag: `FFU900-ZZ01-F${String(i + 1).padStart(2, '0')}-A`, x: i, y: 0 })),
    )
    expect(SEARCH_LIMIT).toBe(8)
    expect(searchTags(many, 'FFU900')).toHaveLength(8)
    expect(tagsOf(many, searchTags(many, 'FFU900'))[7]).toBe('FFU900-ZZ01-F08-A')
  })

  it('ignores case and trims', () => {
    expect(tagsOf(searchIndex, searchTags(searchIndex, '  ffu900-zz01-F02  '))).toEqual(['FFU900-ZZ01-F02-A'])
  })

  it('returns nothing for a blank query or no match', () => {
    expect(searchTags(searchIndex, '')).toEqual([])
    expect(searchTags(searchIndex, '   ')).toEqual([])
    expect(searchTags(searchIndex, 'nothing-like-this')).toEqual([])
  })
})
