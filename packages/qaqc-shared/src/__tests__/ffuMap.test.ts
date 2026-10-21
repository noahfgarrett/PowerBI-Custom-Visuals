import { describe, expect, it } from 'vitest'

import type { InspectionTableSource } from '../dataView'
import {
  FFU_SLOTS,
  REQUIRED_FFU_ROLES,
  buildFfuIndex,
  parseEnergized,
  readFfuTable,
  type Energized,
  type FfuIndex,
  type FfuRole,
} from '../ffuMap'
import { syntheticFfuTable } from './fixtures/syntheticFfu'

type FfuRecord = Partial<Record<FfuRole, unknown>>

const ALL_ROLES: readonly FfuRole[] = FFU_SLOTS.map((slot) => slot.role)

function source(records: readonly FfuRecord[], roles: readonly FfuRole[] = ALL_ROLES): InspectionTableSource {
  return {
    columns: roles.map((role) => ({ roles: { [role]: true } })),
    rows: records.map((record) => roles.map((role) => record[role] ?? null)),
  }
}

function indexOf(records: readonly FfuRecord[], roles: readonly FfuRole[] = ALL_ROLES): FfuIndex {
  const result = readFfuTable(source(records, roles))
  if (result.kind !== 'ready') throw new Error(`expected a ready table, got ${result.kind}`)
  return buildFfuIndex(result.rows, result.columns)
}

function tags(index: FfuIndex, nodeIndices: readonly number[]): string[] {
  return nodeIndices.map((nodeIndex) => index.nodes[nodeIndex]?.tag ?? '?')
}

describe('FFU slots', () => {
  it('declares all 19 roles with Tag, X and Y required', () => {
    expect(ALL_ROLES).toHaveLength(19)
    expect([...REQUIRED_FFU_ROLES].sort()).toEqual(['tag', 'x', 'y'])
  })
})

describe('readFfuTable', () => {
  it('lists Tag, X and Y as missing when unbound', () => {
    const result = readFfuTable(source([], ['line', 'energized']))
    expect(result.kind).toBe('missing')
    if (result.kind !== 'missing') return
    expect(result.missing.map((slot) => slot.slot)).toEqual(['FFU Tag', 'X', 'Y'])
  })

  it('lists Tag, X and Y as missing when there is no data view', () => {
    const result = readFfuTable(undefined)
    expect(result.kind).toBe('missing')
    if (result.kind !== 'missing') return
    expect(result.missing.map((slot) => slot.role)).toEqual(['tag', 'x', 'y'])
  })

  it('returns ready with -1 for unbound optional roles', () => {
    const result = readFfuTable(source([{ tag: 'FFU900-ZZ01-F01-A', x: 1, y: 2 }], ['y', 'tag', 'x', 'energized']))
    expect(result.kind).toBe('ready')
    if (result.kind !== 'ready') return
    expect(result.columns.y).toBe(0)
    expect(result.columns.tag).toBe(1)
    expect(result.columns.x).toBe(2)
    expect(result.columns.energized).toBe(3)
    expect(result.columns.line).toBe(-1)
    expect(result.columns.group).toBe(-1)
    expect(result.rows).toHaveLength(1)
  })
})

describe('parseEnergized', () => {
  const cases: ReadonlyArray<readonly [unknown, Energized]> = [
    ['TRUE', 'on'],
    ['true', 'on'],
    [true, 'on'],
    ['Yes', 'on'],
    ['Y', 'on'],
    ['1', 'on'],
    [1, 'on'],
    [' yes ', 'on'],
    ['FALSE', 'off'],
    ['false', 'off'],
    [false, 'off'],
    ['No', 'off'],
    ['N', 'off'],
    ['0', 'off'],
    [0, 'off'],
    ['Maybe', 'unknown'],
    [null, 'unknown'],
    [undefined, 'unknown'],
    ['', 'unknown'],
    [2, 'unknown'],
  ]

  it.each(cases)('reads %j as %s', (value, expected) => {
    expect(parseEnergized(value)).toBe(expected)
  })
})

describe('buildFfuIndex placement', () => {
  it('places nodes from numeric strings', () => {
    const index = indexOf([
      { tag: 'FFU900-ZZ01-F01-A', x: '803.03', y: ' 12 ' },
      { tag: 'FFU900-ZZ01-F02-A', x: '', y: 1 },
      { tag: 'FFU900-ZZ01-F03-A', x: 'abc', y: 1 },
      { tag: 'FFU900-ZZ01-F04-A', x: 1, y: Number.NaN },
      { tag: 'FFU900-ZZ01-F05-A', x: Number.POSITIVE_INFINITY, y: 1 },
      { tag: 'FFU900-ZZ01-F06-A', x: 1, y: 'Infinity' },
      { tag: 'FFU900-ZZ01-F07-A', x: null, y: 1 },
    ])
    expect(index.nodes).toHaveLength(1)
    expect(index.nodes[0]?.x).toBe(803.03)
    expect(index.nodes[0]?.y).toBe(12)
    expect(index.nodes[0]?.row).toBe(0)
    expect(index.notPlaced).toBe(6)
  })

  it('blank tag is not placed; duplicate tag keeps the first row', () => {
    const index = indexOf([
      { tag: '  ', x: 1, y: 1 },
      { tag: 'FFU900-ZZ01-F01-A', x: 5, y: 5 },
      { tag: ' FFU900-ZZ01-F01-A ', x: 9, y: 9 },
    ])
    expect(index.nodes.map((node) => [node.tag, node.row, node.x])).toEqual([['FFU900-ZZ01-F01-A', 1, 5]])
    expect(index.notPlaced).toBe(2)
  })

  it('node with all tracker cells null has hasTracker false and energized unknown', () => {
    const index = indexOf([
      { tag: 'FFU900-ZZ01-F01-A', x: 1, y: 1 },
      { tag: 'FFU900-ZZ01-F02-A', x: 2, y: 1, circuit: 7 },
    ])
    expect(index.nodes[0]?.hasTracker).toBe(false)
    expect(index.nodes[0]?.energized).toBe('unknown')
    expect(index.nodes[0]?.group).toBe('')
    expect(index.nodes[1]?.hasTracker).toBe(true)
    expect(index.nodes[1]?.circuit).toBe('7')
  })

  it('bounds is null when nothing is placed', () => {
    expect(indexOf([]).bounds).toBeNull()
    expect(indexOf([{ tag: '', x: 1, y: 1 }]).bounds).toBeNull()
  })

  it('bounds spans every placed node', () => {
    const index = indexOf([
      { tag: 'FFU900-ZZ01-F01-A', x: 4, y: -2 },
      { tag: 'FFU900-ZZ01-F02-A', x: -1, y: 8 },
    ])
    expect(index.bounds).toEqual({ minX: -1, minY: -2, maxX: 4, maxY: 8 })
  })
})

describe('buildFfuIndex lines', () => {
  it('orders line nodes by Line Order, then by row', () => {
    const index = indexOf([
      { tag: 'C', x: 1, y: 1, line: 'L001', lineOrder: 3, homeRun: 'FALSE', finish: 'TRUE' },
      { tag: 'A', x: 1, y: 1, line: 'L001', lineOrder: '1', homeRun: 'TRUE' },
      { tag: 'X', x: 1, y: 1, line: 'L001', lineOrder: 'n/a', finish: 'TRUE' },
      { tag: 'B2', x: 1, y: 1, line: 'L001', lineOrder: 2, homeRun: true },
      { tag: 'B1', x: 1, y: 1, line: ' L001 ', lineOrder: 2 },
      { tag: 'Y', x: 1, y: 1, line: 'L001', lineOrder: null },
    ])
    expect(index.lines).toHaveLength(1)
    const line = index.lines[0]
    expect(tags(index, line?.nodes ?? [])).toEqual(['A', 'B2', 'B1', 'C', 'X', 'Y'])
    expect(index.nodes.map((node) => [node.tag, node.lineOrder])).toEqual([
      ['C', 4],
      ['A', 1],
      ['X', 5],
      ['B2', 2],
      ['B1', 3],
      ['Y', 6],
    ])
    expect(index.nodes[line?.homeRun ?? -1]?.tag).toBe('A')
    expect(index.nodes[line?.finish ?? -1]?.tag).toBe('C')
  })

  it('has no home run or finish when no node is flagged', () => {
    const index = indexOf([{ tag: 'A', x: 1, y: 1, line: 'L001', lineOrder: 1, homeRun: 'FALSE' }])
    expect(index.lines[0]?.homeRun).toBe(-1)
    expect(index.lines[0]?.finish).toBe(-1)
  })

  it('orders lines by id with numeric collation and leaves blank-line nodes off every line', () => {
    const index = indexOf([
      { tag: 'A', x: 1, y: 1, line: 'L10', lineOrder: 1 },
      { tag: 'B', x: 1, y: 1, line: 'L9', lineOrder: 1 },
      { tag: 'C', x: 1, y: 1, line: '', lineOrder: 1 },
    ])
    expect(index.lines.map((line) => line.id)).toEqual(['L9', 'L10'])
    expect(index.nodes.map((node) => [node.tag, node.line, node.lineOrder])).toEqual([
      ['A', 1, 1],
      ['B', 0, 1],
      ['C', -1, 0],
    ])
  })

  it('line group is the most common non-blank group; ties go alphabetically first', () => {
    const index = indexOf([
      { tag: 'A1', x: 1, y: 1, line: 'L001', lineOrder: 1, group: 'GRP-B' },
      { tag: 'A2', x: 1, y: 1, line: 'L001', lineOrder: 2, group: 'GRP-A' },
      { tag: 'A3', x: 1, y: 1, line: 'L001', lineOrder: 3, group: 'GRP-B' },
      { tag: 'A4', x: 1, y: 1, line: 'L001', lineOrder: 4, group: '' },
      { tag: 'A5', x: 1, y: 1, line: 'L001', lineOrder: 5, group: '' },
      { tag: 'A6', x: 1, y: 1, line: 'L001', lineOrder: 6, group: null },
      { tag: 'B1', x: 1, y: 1, line: 'L002', lineOrder: 1, group: 'GRP-D' },
      { tag: 'B2', x: 1, y: 1, line: 'L002', lineOrder: 2, group: 'GRP-C' },
      { tag: 'C1', x: 1, y: 1, line: 'L003', lineOrder: 1 },
    ])
    expect(index.lines.map((line) => [line.id, line.group, line.label])).toEqual([
      ['L001', 'GRP-B', 'GRP-B'],
      ['L002', 'GRP-C', 'GRP-C'],
      ['L003', '', 'L003'],
    ])
  })

  it("flags a mismatch only when a node's non-blank group differs from its line group", () => {
    const index = indexOf([
      { tag: 'A1', x: 1, y: 1, line: 'L001', lineOrder: 1, group: 'GRP-A' },
      { tag: 'A2', x: 1, y: 1, line: 'L001', lineOrder: 2, group: 'GRP-A' },
      { tag: 'A3', x: 1, y: 1, line: 'L001', lineOrder: 3, group: 'GRP-B' },
      { tag: 'A4', x: 1, y: 1, line: 'L001', lineOrder: 4, group: '' },
      { tag: 'Z1', x: 1, y: 1, group: 'GRP-C' },
    ])
    expect(index.nodes.map((node) => [node.tag, node.mismatch])).toEqual([
      ['A1', false],
      ['A2', false],
      ['A3', true],
      ['A4', false],
      ['Z1', false],
    ])
  })

  it('Line bound without Line Order draws no lines but keeps the nodes', () => {
    const records: FfuRecord[] = [
      { tag: 'A', x: 1, y: 1, line: 'L001', lineOrder: 1 },
      { tag: 'B', x: 2, y: 1, line: 'L001', lineOrder: 2 },
    ]
    const withoutOrder = indexOf(records, ['tag', 'x', 'y', 'line'])
    expect(withoutOrder.lines).toEqual([])
    expect(withoutOrder.nodes.map((node) => [node.tag, node.line, node.lineOrder])).toEqual([
      ['A', -1, 0],
      ['B', -1, 0],
    ])

    const withoutLine = indexOf(records, ['tag', 'x', 'y', 'lineOrder'])
    expect(withoutLine.lines).toEqual([])
    expect(withoutLine.nodes).toHaveLength(2)
    expect(withoutLine.nodes.every((node) => node.line === -1 && node.lineOrder === 0)).toBe(true)
  })

  it('invalid Line Colour leaves color empty', () => {
    const index = indexOf([
      { tag: 'A', x: 1, y: 1, line: 'L001', lineOrder: 1, lineColor: ' #ff00ff ' },
      { tag: 'B', x: 1, y: 1, line: 'L002', lineOrder: 1, lineColor: 'magenta' },
      { tag: 'C', x: 1, y: 1, line: 'L003', lineOrder: 1, lineColor: '#F0F' },
      { tag: 'D', x: 1, y: 1, line: 'L004', lineOrder: 1 },
    ])
    expect(index.lines.map((line) => line.color)).toEqual(['#FF00FF', '', '', ''])
  })
})

describe('buildFfuIndex grid', () => {
  it('grid columns sorted by mean X, divider halfway between neighbour extents, label at bay centre', () => {
    const index = indexOf([
      { tag: 'B1', x: 30, y: 0, gridColumn: 'AB', gridRow: '01' },
      { tag: 'A1', x: 0, y: 0, gridColumn: 'AA', gridRow: '01' },
      { tag: 'B2', x: 40, y: 0, gridColumn: 'AB', gridRow: '01' },
      { tag: 'A2', x: 10, y: 0, gridColumn: 'AA', gridRow: '01' },
    ])
    expect(index.gridColumns).toEqual({
      labels: [
        { label: 'AA', at: 5 },
        { label: 'AB', at: 35 },
      ],
      dividers: [20],
    })
  })

  it('grid rows sorted by mean Y', () => {
    const index = indexOf([
      { tag: 'A', x: 0, y: 100, gridRow: '01' },
      { tag: 'B', x: 0, y: 10, gridRow: '02' },
      { tag: 'C', x: 0, y: 20, gridRow: '02' },
    ])
    expect(index.gridRows).toEqual({
      labels: [
        { label: '02', at: 15 },
        { label: '01', at: 100 },
      ],
      dividers: [60],
    })
  })

  it('single grid column has no dividers and one label', () => {
    const index = indexOf([{ tag: 'A', x: 7, y: 3, gridColumn: 'AA', gridRow: '01' }])
    expect(index.gridColumns).toEqual({ labels: [{ label: 'AA', at: 7 }], dividers: [] })
    expect(index.gridRows).toEqual({ labels: [{ label: '01', at: 3 }], dividers: [] })
  })

  it('grid axis is null when its slot is unbound', () => {
    const index = indexOf([{ tag: 'A', x: 7, y: 3, gridColumn: 'AA' }], ['tag', 'x', 'y', 'gridColumn'])
    expect(index.gridColumns).not.toBeNull()
    expect(index.gridRows).toBeNull()
  })
})

describe('syntheticFfuTable', () => {
  it('binds every role and indexes into lines of 47 with every 50th row lacking tracker data', () => {
    const table = syntheticFfuTable(200)
    const result = readFfuTable(table)
    if (result.kind !== 'ready') throw new Error('expected a ready table')
    expect(FFU_SLOTS.every((slot) => result.columns[slot.role] >= 0)).toBe(true)

    const index = buildFfuIndex(result.rows, result.columns)
    expect(index.nodes).toHaveLength(200)
    expect(index.notPlaced).toBe(0)
    expect(index.lines.map((line) => line.nodes.length)).toEqual([47, 47, 47, 47, 12])
    expect(index.nodes.slice(0, 4).map((node) => node.energized)).toEqual(['on', 'off', 'on', 'on'])
    expect(index.nodes.filter((node) => !node.hasTracker).map((node) => node.row)).toEqual([49, 99, 149, 199])
    expect(index.lines.every((line) => line.homeRun >= 0 && line.finish >= 0)).toBe(true)
  })

  it('is deterministic', () => {
    expect(syntheticFfuTable(120)).toEqual(syntheticFfuTable(120))
  })
})
