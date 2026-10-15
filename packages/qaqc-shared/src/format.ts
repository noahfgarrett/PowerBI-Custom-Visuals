const COUNT_FORMAT = new Intl.NumberFormat('en-US')
const MINUS = '−'

/** Orders names so F63.2 comes before F63.10, ignoring case. */
export const NAME_COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

export type DeltaTone = 'neutral' | 'good' | 'warn' | 'bad'
export type Trend = 'up' | 'down' | 'flat' | 'none'
export type KpiStatus = 'good' | 'warn' | 'bad'

/** Overall sign-off below this percent is bad. */
const SIGNOFF_BAD_BELOW = 10
/** Overall sign-off below this percent (and at or above the bad line) is a warning. */
const SIGNOFF_WARN_BELOW = 15

export function formatCount(value: number): string {
  return COUNT_FORMAT.format(value)
}

export function formatPercent(value: number | null, digits = 1): string {
  return value === null ? 'n/a' : `${value.toFixed(digits)}%`
}

/**
 * A sign-off rate as the cards and chart show it. Under the 10% baseline it keeps one decimal, truncated so a
 * missed baseline never reads as 10%; from 10% up it is a whole percent.
 */
export function formatSignoffRate(rate: number | null): string {
  if (rate === null) return 'n/a'
  if (rate >= SIGNOFF_BAD_BELOW) return `${rate.toFixed(0)}%`
  // The epsilon absorbs float error (29 / 500 * 100 is 5.7999…) before truncating.
  return `${(Math.floor(rate * 10 + 1e-9) / 10).toFixed(1)}%`
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

export function signoffStatus(rate: number | null): KpiStatus | undefined {
  if (rate === null) return undefined
  if (rate < SIGNOFF_BAD_BELOW) return 'bad'
  if (rate < SIGNOFF_WARN_BELOW) return 'warn'
  return 'good'
}
