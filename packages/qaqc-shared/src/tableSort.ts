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
