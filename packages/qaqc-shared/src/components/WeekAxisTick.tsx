import type { ReactElement } from 'react'

import { WEEK_TICK_OFFSET, YEAR_MARKER_OFFSET } from '../chartMath'
import type { ChartColors } from '../chartTypes'
import type { WorkWeek } from '../types'
import { shortWeekLabel } from '../workWeeks'

export interface WeekAxisTickProps {
  week: WorkWeek
  /** Centre of the tick. */
  x: number
  /** The y of the plot's baseline; the tick and year marker sit below it. */
  plotBottom: number
  isSelected: boolean
  /** Draws the week's year under the tick. */
  hasYear: boolean
  colors: ChartColors
  /** Extra classes for the tick label. */
  className?: string
}

/** One week axis tick label (`WW41`), with the year under it when `hasYear` is set. */
export function WeekAxisTick({ week, x, plotBottom, isSelected, hasYear, colors, className }: WeekAxisTickProps): ReactElement {
  const classes = ['qaqc-axis-text', className, isSelected ? 'is-selected' : undefined].filter((name) => name !== undefined && name !== '').join(' ')
  return (
    <>
      <text
        className={classes}
        x={x}
        y={plotBottom + WEEK_TICK_OFFSET}
        textAnchor="middle"
        fill={isSelected ? colors.ink : colors.axisText}
      >
        {shortWeekLabel(week)}
      </text>
      {hasYear && (
        <text className="qaqc-axis-year" x={x} y={plotBottom + YEAR_MARKER_OFFSET} textAnchor="middle" fill={colors.axisText}>
          {week.year}
        </text>
      )}
    </>
  )
}
