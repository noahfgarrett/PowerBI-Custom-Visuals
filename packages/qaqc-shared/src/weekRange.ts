export interface WeekRange {
  fromKey: number
  toKey: number
}

export interface RangeWeek {
  key: number
  label: string
}

export type RangePreset = 'last4' | 'last13' | 'thisYear'

const PRESET_WEEK_COUNTS = { last4: 4, last13: 13 } as const

/** The position of the last week at or before `currentKey`, or 0 when every week is later. */
function currentPosition(weeks: readonly RangeWeek[], currentKey: number): number {
  let position = 0
  for (let index = 0; index < weeks.length && weeks[index].key <= currentKey; index += 1) position = index
  return position
}

/**
 * The range a preset names, ending at the current work week (or the last data week before it).
 * `weeks` are the data's work weeks, oldest first; a preset reaching before the first of them starts there.
 */
export function presetRange(preset: RangePreset, weeks: readonly RangeWeek[], currentKey: number): WeekRange {
  if (weeks.length === 0) return { fromKey: currentKey, toKey: currentKey }
  const end = currentPosition(weeks, currentKey)
  const toKey = weeks[end].key
  switch (preset) {
    case 'last4':
    case 'last13':
      return { fromKey: weeks[Math.max(0, end - PRESET_WEEK_COUNTS[preset] + 1)].key, toKey }
    case 'thisYear': {
      const yearStartKey = Math.floor(currentKey / 100) * 100 + 1
      const first = weeks.findIndex((week) => week.key >= yearStartKey)
      return { fromKey: weeks[first === -1 || first > end ? end : first].key, toKey }
    }
    default: {
      const unreachable: never = preset
      return unreachable
    }
  }
}

/**
 * Pulls a range's limits to the nearest weeks that exist: From moves later to the first week at or after it, To
 * moves earlier to the last week at or before it. Null when the result covers all of `weeks` (no range), or when
 * there are no weeks.
 */
export function clampRange(range: WeekRange, weeks: readonly RangeWeek[]): WeekRange | null {
  if (weeks.length === 0) return null
  const firstKey = weeks[0].key
  const lastKey = weeks[weeks.length - 1].key
  const from = weeks.find((week) => week.key >= range.fromKey)
  let to = weeks[0]
  for (const week of weeks) {
    if (week.key > range.toKey) break
    to = week
  }
  const fromKey = from === undefined ? lastKey : from.key
  // A range that fell entirely into a gap in the data collapses to its From week.
  const toKey = Math.max(fromKey, to.key)
  if (fromKey === firstKey && toKey === lastKey) return null
  return { fromKey, toKey }
}
