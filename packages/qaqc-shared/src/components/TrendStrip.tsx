import { memo, type ReactElement } from 'react'

import type { ChartColors } from '../chartTypes'
import { RECENT_WEEK_COUNT } from '../inspections'
import type { PerformanceTrendWeek } from '../performance'

// One 2 px bar per week on a 3 px pitch, so 30 weeks fit in 89 px. The top 4 px hold the NCR flags.
const BAR_WIDTH = 2
const PITCH = 3
export const TREND_STRIP_WIDTH = RECENT_WEEK_COUNT * PITCH - (PITCH - BAR_WIDTH)
export const TREND_STRIP_HEIGHT = 18
const FLAG_HEIGHT = 2
const FLAG_GAP = 2
const BASELINE_HEIGHT = 1
const BASELINE_Y = TREND_STRIP_HEIGHT - BASELINE_HEIGHT
const MAX_BAR_HEIGHT = BASELINE_Y - FLAG_HEIGHT - FLAG_GAP
/** Any week with volume stays visible, however small next to the busiest week. */
const MIN_BAR_HEIGHT = 2
/** A date range too long for the strip's slots still draws every week, each at least this wide. */
const MIN_BAR_WIDTH = 1

export interface TrendStripProps {
  /** Oldest first. A trend shorter than 30 weeks is drawn against the right edge; a longer one shares the strip's width. */
  trend: PerformanceTrendWeek[]
  colors: ChartColors
  isHighContrast: boolean
}

function barHeight(volume: number, maxVolume: number): number {
  if (maxVolume <= 0) return 0
  return MIN_BAR_HEIGHT + (volume / maxVolume) * (MAX_BAR_HEIGHT - MIN_BAR_HEIGHT)
}

/** Where the bars go: the fixed 30 slots, or `count` bars filling the strip's width. */
function stripLayout(count: number): { firstSlot: number; pitch: number; barWidth: number } {
  if (count <= RECENT_WEEK_COUNT) return { firstSlot: RECENT_WEEK_COUNT - count, pitch: PITCH, barWidth: BAR_WIDTH }
  const barWidth = Math.max(MIN_BAR_WIDTH, TREND_STRIP_WIDTH / count - 1)
  return { firstSlot: 0, pitch: (TREND_STRIP_WIDTH - barWidth) / (count - 1), barWidth }
}

/**
 * A row's 30-week strip: one tiny bar per week for its Finals (or welds), with NCR weeks in the bad colour and a
 * flag above them, so colour is not the only signal (high contrast draws the volume bars in the foreground colour).
 * Decorative: the row's text carries the NCR week count.
 */
function TrendStripView({ trend, colors, isHighContrast }: TrendStripProps): ReactElement {
  const { firstSlot, pitch, barWidth } = stripLayout(trend.length)
  let maxVolume = 0
  for (const week of trend) maxVolume = Math.max(maxVolume, week.volume)
  const volumeFill = isHighContrast ? colors.ink : colors.series2
  // High contrast maps bad to the host's selected foreground, so NCR weeks still stand out from the volume bars.
  const ncrFill = colors.bad

  return (
    <svg
      className="qaqc-perf-trend"
      width={TREND_STRIP_WIDTH}
      height={TREND_STRIP_HEIGHT}
      aria-hidden="true"
      focusable="false"
    >
      <rect className="qaqc-perf-trend-baseline" x={0} y={BASELINE_Y} width={TREND_STRIP_WIDTH} height={BASELINE_HEIGHT} fill={colors.grid} />
      {trend.map((week, index) => {
        if (week.volume <= 0) return null
        const x = (firstSlot + index) * pitch
        const height = barHeight(week.volume, maxVolume)
        return (
          <g key={index}>
            <rect
              className={week.hasNcr ? 'qaqc-perf-trend-bar is-ncr' : 'qaqc-perf-trend-bar'}
              x={x}
              y={BASELINE_Y - height}
              width={barWidth}
              height={height}
              fill={week.hasNcr ? ncrFill : volumeFill}
            />
            {week.hasNcr && <rect className="qaqc-perf-trend-flag" x={x} y={0} width={barWidth} height={FLAG_HEIGHT} fill={ncrFill} />}
          </g>
        )
      })}
    </svg>
  )
}

export const TrendStrip = memo(TrendStripView)
