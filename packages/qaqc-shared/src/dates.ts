import { MS_PER_DAY } from './workWeeks'

// Date parsing ported from the HTML app (src/utils/workWeeks.ts). Every date is moved to local noon so
// day arithmetic and ISO weeks never slip a day across daylight saving or time-of-day differences.

// Excel serial day 0 in the 1900 date system.
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30)
// Numbers below this are Excel serial days; larger numbers are epoch milliseconds.
const MAX_EXCEL_SERIAL = 1_000_000
const NUMERIC_TEXT = /^\d+(?:\.\d+)?$/
const ISO_DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/
// M/D/YY or M/D/YYYY, optionally followed by a 12-hour time (`3:45 PM`, `4:00:00 PM`), as in the enriched
// Autodesk export's BIM360 columns. The time of day is ignored.
const MONTH_DAY_YEAR = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:\s+(?:0?[1-9]|1[0-2]):[0-5]\d(?::[0-5]\d)?\s*[AP]M)?$/i

function localNoon(year: number, monthIndex: number, day: number): Date | null {
  const date = new Date(year, monthIndex, day, 12, 0, 0, 0)
  return Number.isNaN(date.getTime()) ? null : date
}

function toLocalNoon(date: Date): Date | null {
  return Number.isNaN(date.getTime()) ? null : localNoon(date.getFullYear(), date.getMonth(), date.getDate())
}

function isExcelSerial(value: number): boolean {
  return value > 0 && value < MAX_EXCEL_SERIAL
}

function fromNumber(value: number): Date | null {
  if (!Number.isFinite(value)) return null
  if (isExcelSerial(value)) {
    const utc = new Date(EXCEL_EPOCH_UTC + Math.floor(value) * MS_PER_DAY)
    return localNoon(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate())
  }
  return toLocalNoon(new Date(value))
}

/**
 * Reads a Date, an Excel serial, epoch milliseconds, an ISO string, or M/D/YYYY text with an optional 12-hour time,
 * as a local-noon date.
 */
export function parseDate(value: unknown): Date | null {
  if (value instanceof Date) return toLocalNoon(value)
  if (typeof value === 'number') return fromNumber(value)
  if (typeof value !== 'string') return null

  const text = value.trim()
  if (!text) return null

  if (NUMERIC_TEXT.test(text)) {
    const numeric = Number(text)
    if (isExcelSerial(numeric)) return fromNumber(numeric)
  }

  const isoDate = ISO_DATE_ONLY.exec(text)
  if (isoDate) return localNoon(Number(isoDate[1]), Number(isoDate[2]) - 1, Number(isoDate[3]))

  const monthDayYear = MONTH_DAY_YEAR.exec(text)
  if (monthDayYear) {
    const rawYear = Number(monthDayYear[3])
    // Two-digit years follow the app's Date parsing: 00–49 are 20xx, 50–99 are 19xx.
    let year = rawYear
    if (rawYear < 50) year = 2000 + rawYear
    else if (rawYear < 100) year = 1900 + rawYear
    return localNoon(year, Number(monthDayYear[1]) - 1, Number(monthDayYear[2]))
  }

  return toLocalNoon(new Date(text))
}

/** MM/DD/YY, or blank for no date. */
export function formatDate(date: Date | null): string {
  if (date === null) return ''
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const year = String(date.getFullYear() % 100).padStart(2, '0')
  return `${month}/${day}/${year}`
}

/** Whole calendar days from start to end, never negative. */
export function daysBetween(start: Date, end: Date): number {
  const from = localNoon(start.getFullYear(), start.getMonth(), start.getDate())
  const to = localNoon(end.getFullYear(), end.getMonth(), end.getDate())
  if (from === null || to === null) return 0
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / MS_PER_DAY))
}
