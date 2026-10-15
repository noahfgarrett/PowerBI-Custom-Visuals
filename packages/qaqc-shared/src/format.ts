const COUNT_FORMAT = new Intl.NumberFormat('en-US')
const MINUS = '−'

/** Orders names so F63.2 comes before F63.10, ignoring case. */
export const NAME_COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

export type DeltaTone = 'neutral' | 'good' | 'warn' | 'bad'
export type Trend = 'up' | 'down' | 'flat' | 'none'

export function formatCount(value: number): string {
  return COUNT_FORMAT.format(value)
}

export function formatPercent(value: number | null, digits = 1): string {
  return value === null ? 'n/a' : `${value.toFixed(digits)}%`
}

export function formatDelta(delta: number, comparedTo: string): string {
  if (delta === 0) return `No change vs ${comparedTo}`
  return `${delta > 0 ? '+' : MINUS}${formatCount(Math.abs(delta))} vs ${comparedTo}`
}

/** Rounds to hundredths so tiny float noise reads as no change. */
export function roundPoints(delta: number): number {
  return Math.round(delta * 100) / 100
}

export function formatPointsDelta(delta: number): string {
  const rounded = roundPoints(delta)
  if (rounded === 0) return 'No change'
  const size = Math.abs(rounded)
  return `${rounded > 0 ? '+' : MINUS}${size.toFixed(size < 0.1 ? 2 : 1)} pts`
}

export function trendOf(delta: number): Trend {
  if (delta > 0) return 'up'
  if (delta < 0) return 'down'
  return 'flat'
}

export function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural
}
