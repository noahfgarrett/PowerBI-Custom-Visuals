import type { WorkWeek } from './types'

export const MS_PER_DAY = 86_400_000
// Smartsheet exports vary: WW42'2026, WW 42 - 2026, Week 42 2026, two-digit years.
const WORK_WEEK_PATTERN = /^(?:WW|WK|WEEK)?\s*(\d{1,2})\s*(?:['’/_,.\-]|\s)\s*(\d{4}|\d{2})$/i
// Years outside this range are treated as typos.
const MIN_YEAR = 2000
const MAX_YEAR = 2099
const weeksPerYear = new Map<number, number>()

export function makeWorkWeek(year: number, week: number): WorkWeek {
  return {
    year,
    week,
    key: year * 100 + week,
    label: `WW${String(week).padStart(2, '0')}'${year}`,
  }
}

export function toIsoWorkWeek(date: Date): WorkWeek {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = utc.getUTCDay() || 7
  utc.setUTCDate(utc.getUTCDate() + 4 - day)
  const yearStart = Date.UTC(utc.getUTCFullYear(), 0, 1)
  const week = Math.ceil(((utc.getTime() - yearStart) / MS_PER_DAY + 1) / 7)
  return makeWorkWeek(utc.getUTCFullYear(), week)
}

export function weeksInIsoYear(year: number): number {
  const cached = weeksPerYear.get(year)
  if (cached !== undefined) return cached
  // December 28 always falls in the last ISO week of its year.
  const count = toIsoWorkWeek(new Date(year, 11, 28)).week
  weeksPerYear.set(year, count)
  return count
}

export function parseWorkWeek(value: unknown): WorkWeek | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : toIsoWorkWeek(value)
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const match = String(value).trim().match(WORK_WEEK_PATTERN)
  if (!match) return null
  const week = Number(match[1])
  const rawYear = Number(match[2])
  const year = rawYear < 100 ? 2000 + rawYear : rawYear
  if (year < MIN_YEAR || year > MAX_YEAR) return null
  if (week < 1 || week > weeksInIsoYear(year)) return null
  return makeWorkWeek(year, week)
}

export function nextWorkWeek(week: WorkWeek): WorkWeek {
  return week.week < weeksInIsoYear(week.year)
    ? makeWorkWeek(week.year, week.week + 1)
    : makeWorkWeek(week.year + 1, 1)
}

export function previousWorkWeek(week: WorkWeek): WorkWeek {
  return week.week > 1
    ? makeWorkWeek(week.year, week.week - 1)
    : makeWorkWeek(week.year - 1, weeksInIsoYear(week.year - 1))
}

export function enumerateWorkWeeks(start: WorkWeek, end: WorkWeek): WorkWeek[] {
  const weeks: WorkWeek[] = []
  let cursor = start
  while (cursor.key <= end.key) {
    weeks.push(cursor)
    cursor = nextWorkWeek(cursor)
  }
  return weeks
}

export function shortWeekLabel(week: WorkWeek): string {
  return `WW${String(week.week).padStart(2, '0')}`
}
