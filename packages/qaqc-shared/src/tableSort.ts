import { NAME_COLLATOR } from './format'

/**
 * Each row's rank in NAME_COLLATOR order (numeric-aware, ignoring case) for one text value; values the collator
 * treats as equal share a rank. Only the distinct values go through the collator, so a column with few values
 * (status, contractor) ranks in a handful of comparisons. Sorting tables then compare these numbers.
 */
export function textRanks<Row>(rows: readonly Row[], valueOf: (row: Row) => string): Uint32Array {
  const values = rows.map(valueOf)
  const distinct = [...new Set(values)].sort(NAME_COLLATOR.compare)
  const rankByValue = new Map<string, number>()
  let rank = 0
  distinct.forEach((value, index) => {
    if (index > 0 && NAME_COLLATOR.compare(distinct[index - 1], value) !== 0) rank += 1
    rankByValue.set(value, rank)
  })
  const ranks = new Uint32Array(rows.length)
  values.forEach((value, position) => {
    ranks[position] = rankByValue.get(value) ?? 0
  })
  return ranks
}

/**
 * A lazy per-data-set cache of `textRanks`, one entry per text column: each column is ranked the first time it is
 * sorted, and other sorts never touch the collator. Make a fresh cache whenever the rows change (`useMemo` on them).
 */
export function createRankCache<Key extends string, Row extends Readonly<Record<Key, string>>>(rows: readonly Row[]): (key: Key) => Uint32Array {
  const cache = new Map<Key, Uint32Array>()
  return (key: Key): Uint32Array => {
    let ranks = cache.get(key)
    if (ranks === undefined) {
      ranks = textRanks(rows, (row) => row[key])
      cache.set(key, ranks)
    }
    return ranks
  }
}

/**
 * Compares two sort values in the direction `sign` (+1 ascending, −1 descending), with null last in both directions.
 * Returns 0 for a tie (two equal numbers, or two nulls), so callers chain their tie-breaks with `||`.
 */
export function compareNullLast(a: number | null, b: number | null, sign: 1 | -1): number {
  if (a === null || b === null) {
    if (a === b) return 0
    return a === null ? 1 : -1
  }
  return (a - b) * sign
}
