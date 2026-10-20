import type { WorkWeek } from './types'
import { parseWorkWeek } from './workWeeks'

/** The case- and whitespace-insensitive key that names are grouped by. */
export function groupKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ')
}

/** The group creator for display names: each group shows under the first spelling seen. */
export function firstSpelling(_key: string, spelling: string): string {
  return spelling
}

/**
 * Groups spellings that differ only by case or spacing. `createGroup` runs once per group key, with the
 * first spelling seen. Few distinct spellings repeat across all rows, so most lookups end at the spelling cache.
 */
export function createNameGrouper<Group>(createGroup: (key: string, spelling: string) => Group): (spelling: string) => Group {
  const bySpelling = new Map<string, Group>()
  const byKey = new Map<string, Group>()
  return (spelling: string): Group => {
    const known = bySpelling.get(spelling)
    if (known !== undefined) return known
    const key = groupKey(spelling)
    let group = byKey.get(key)
    if (group === undefined) {
      group = createGroup(key, spelling)
      byKey.set(key, group)
    }
    bySpelling.set(spelling, group)
    return group
  }
}

/**
 * Reads work weeks with `parseWorkWeek`. Week text repeats heavily (a few hundred distinct values across
 * hundreds of thousands of rows), so text and numbers are cached by their text.
 */
export function createWeekReader(): (value: unknown) => WorkWeek | null {
  const cache = new Map<string, WorkWeek | null>()
  return (value: unknown): WorkWeek | null => {
    if (typeof value !== 'string' && typeof value !== 'number') return parseWorkWeek(value)
    const text = String(value)
    const cached = cache.get(text)
    if (cached !== undefined) return cached
    const parsed = parseWorkWeek(text)
    cache.set(text, parsed)
    return parsed
  }
}
