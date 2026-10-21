import type { Energized, FfuIndex, FfuNode } from './ffuMap'

export interface FfuFilters {
  zone: string | null
  group: string | null
  rioPanel: string | null
  energized: Energized | null
}

export const NO_FILTERS: FfuFilters = { zone: null, group: null, rioPanel: null, energized: null }

const COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

/** The node's own group, else the group of its line, else ''. */
export function effectiveGroup(index: FfuIndex, node: FfuNode): string {
  if (node.group !== '') return node.group
  return index.lines[node.line]?.group ?? ''
}

export function nodeMatches(index: FfuIndex, node: FfuNode, filters: FfuFilters): boolean {
  if (filters.zone !== null && node.zone !== filters.zone) return false
  if (filters.rioPanel !== null && node.rioPanel !== filters.rioPanel) return false
  if (filters.energized !== null && node.energized !== filters.energized) return false
  if (filters.group !== null && effectiveGroup(index, node) !== filters.group) return false
  return true
}

/** One byte per node, 1 when the node passes every active filter. */
export function matchMask(index: FfuIndex, filters: FfuFilters): Uint8Array {
  const mask = new Uint8Array(index.nodes.length)
  index.nodes.forEach((node, nodeIndex) => {
    mask[nodeIndex] = nodeMatches(index, node, filters) ? 1 : 0
  })
  return mask
}

export interface FfuSummary {
  total: number
  energized: number
  deEnergized: number
  /** Unrounded, null when no node matches. */
  percentEnergized: number | null
  noTracker: number
  /** Distinct lines with at least one matching node. */
  groups: number
  mismatches: number
  notPlaced: number
}

export function summarize(index: FfuIndex, mask: Uint8Array): FfuSummary {
  let total = 0
  let energized = 0
  let deEnergized = 0
  let noTracker = 0
  let mismatches = 0
  const lines = new Set<number>()

  index.nodes.forEach((node, nodeIndex) => {
    if (mask[nodeIndex] !== 1) return
    total += 1
    if (node.energized === 'on') energized += 1
    if (node.energized === 'off') deEnergized += 1
    if (!node.hasTracker) noTracker += 1
    if (node.mismatch) mismatches += 1
    if (node.line >= 0) lines.add(node.line)
  })

  return {
    total,
    energized,
    deEnergized,
    percentEnergized: total === 0 ? null : (energized / total) * 100,
    noTracker,
    groups: lines.size,
    mismatches,
    notPlaced: index.notPlaced,
  }
}

export interface FilterOptions {
  zones: string[]
  groups: string[]
  rioPanels: string[]
}

function distinctSorted(values: Iterable<string>): string[] {
  const distinct = new Set<string>()
  for (const value of values) {
    if (value !== '') distinct.add(value)
  }
  return [...distinct].sort((a, b) => COLLATOR.compare(a, b))
}

/** Distinct non-blank values in natural order, so 'G2' sorts before 'G10'. */
export function filterOptions(index: FfuIndex): FilterOptions {
  return {
    zones: distinctSorted(index.nodes.map((node) => node.zone)),
    groups: distinctSorted(index.nodes.map((node) => effectiveGroup(index, node))),
    rioPanels: distinctSorted(index.nodes.map((node) => node.rioPanel)),
  }
}

export const SEARCH_LIMIT = 8

/** Node indices whose tag contains the trimmed query, ignoring case. Prefix matches come first, each bucket in natural order. */
export function searchTags(index: FfuIndex, query: string): number[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') return []

  const prefix: number[] = []
  const inside: number[] = []
  index.nodes.forEach((node, nodeIndex) => {
    const position = node.tag.toLowerCase().indexOf(needle)
    if (position === 0) prefix.push(nodeIndex)
    else if (position > 0) inside.push(nodeIndex)
  })

  const byTag = (a: number, b: number): number => COLLATOR.compare(index.nodes[a]?.tag ?? '', index.nodes[b]?.tag ?? '')
  prefix.sort(byTag)
  inside.sort(byTag)
  return [...prefix, ...inside].slice(0, SEARCH_LIMIT)
}
