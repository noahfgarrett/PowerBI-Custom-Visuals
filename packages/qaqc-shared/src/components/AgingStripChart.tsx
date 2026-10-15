import type { ReactElement } from 'react'

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

/** Matches the HTML app's AgingChart: a 100% stacked strip, then one row per bucket with its share. */
export function AgingStripChart({ buckets, colors, isHighContrast }: AgingStripChartProps): ReactElement {
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0)
  const shareOf = (bucket: AgingBucket): number => (total > 0 ? (bucket.count / total) * 100 : 0)
  const fill = (index: number): { background: string; opacity: number } => ({
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
            <i className="qaqc-aging-swatch" style={fill(index)} />
            {bucket.label}
          </span>
          <div className="qaqc-aging-track">
            <i style={{ ...fill(index), width: `${shareOf(bucket)}%` }} />
          </div>
          <strong>
            <span className="qaqc-aging-count">{formatCount(bucket.count)}</span>
            <em className="qaqc-aging-percent">{`${Math.round(shareOf(bucket))}%`}</em>
          </strong>
        </div>
      ))}
    </div>
  )
}
