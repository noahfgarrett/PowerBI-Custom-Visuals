import type { CSSProperties, ReactElement } from 'react'

import { ordinalOpacity } from '../chartMath'
import type { ChartColors } from '../chartTypes'
import { formatCount } from '../format'
import type { AgingBucket } from '../types'

export interface AgingStripChartProps {
  /** Youngest first. */
  buckets: AgingBucket[]
  colors: ChartColors
  /** Draws every bucket in the foreground colour instead of the ramp. */
  isHighContrast: boolean
}

/**
 * Whole percents that add up to 100 (largest remainder): each share is floored, then the shares with the largest
 * remainders gain a point until the total is 100; ties go to the earlier bucket. All zeros when there is no total.
 */
function wholePercents(counts: number[]): number[] {
  const total = counts.reduce((sum, count) => sum + count, 0)
  if (total === 0) return counts.map(() => 0)
  const exact = counts.map((count) => (count / total) * 100)
  const percents = exact.map(Math.floor)
  const shortfall = 100 - percents.reduce((sum, percent) => sum + percent, 0)
  const byRemainder = exact.map((value, index) => index).sort((a, b) => (exact[b] - percents[b]) - (exact[a] - percents[a]) || a - b)
  for (let rank = 0; rank < shortfall; rank += 1) percents[byRemainder[rank]] += 1
  return percents
}

/** Matches the HTML app's AgingChart: a 100% stacked strip, then one row per bucket with its share. */
export function AgingStripChart({ buckets, colors, isHighContrast }: AgingStripChartProps): ReactElement {
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0)
  const shareOf = (bucket: AgingBucket): number => (total > 0 ? (bucket.count / total) * 100 : 0)
  const percents = wholePercents(buckets.map((bucket) => bucket.count))
  const fill = (index: number): CSSProperties => ({
    background: colors.series1,
    opacity: isHighContrast ? 1 : ordinalOpacity(index, buckets.length),
  })

  return (
    <div className={isHighContrast ? 'qaqc-aging is-high-contrast' : 'qaqc-aging'}>
      {/* The rows below carry the same numbers as text, so the strip is decoration for screen readers. */}
      <div className="qaqc-aging-strip" aria-hidden="true">
        {buckets.map((bucket, index) => (
          <i key={bucket.label} style={{ ...fill(index), width: `${shareOf(bucket)}%` }} />
        ))}
      </div>
      {buckets.map((bucket, index) => (
        <div key={bucket.label} className="qaqc-aging-row">
          <span className="qaqc-aging-label">
            <i className="qaqc-aging-swatch" style={fill(index)} aria-hidden="true" />
            {bucket.label}
          </span>
          <div className="qaqc-aging-track">
            <i style={{ ...fill(index), width: `${shareOf(bucket)}%` }} aria-hidden="true" />
          </div>
          <strong>
            <span className="qaqc-aging-count">{formatCount(bucket.count)}</span>
            {/* The gap on screen is a margin, so screen readers need a real space to keep "38 21%" from reading as "3821%". */}
            <span className="qaqc-visually-hidden">{' '}</span>
            <span className="qaqc-aging-percent">{`${percents[index]}%`}</span>
          </strong>
        </div>
      ))}
    </div>
  )
}
