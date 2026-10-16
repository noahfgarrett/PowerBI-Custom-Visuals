import type { LucideIcon } from 'lucide-react'
import type { ReactElement, ReactNode } from 'react'

import type { TooltipHandler } from '../chartTypes'
import { RangeToggle } from './RangeToggle'
import { WorkWeekPicker } from './WorkWeekPicker'
import { RECENT_WEEK_COUNT } from '../inspections'
import type { ResolvedTheme } from '../theme'
import type { RangeMode, WorkWeek } from '../types'

/** The props every QAQC dashboard takes from its visual, besides its index and its own settings. */
export interface DashboardChromeProps {
  title: string
  icon: LucideIcon
  theme: ResolvedTheme
  interactive: boolean
  animate: boolean
  describeCharts: boolean
  loading: boolean
  footnotes: string[]
  viewport: { width: number; height: number }
  onHover: TooltipHandler
}

export interface DashboardHeaderProps {
  title: string
  icon: LucideIcon
  interactive: boolean
  range: RangeMode
  onRangeChange: (mode: RangeMode) => void
  /** The range toggle's accessible name; RangeToggle's default ("Chart range") when left out. */
  rangeLabel?: string
  /** Newest first. */
  weekOptions: WorkWeek[]
  selectedKey: number
  onPickWeek: (key: number) => void
  /** Controls placed before the range toggle, such as a HeaderOverlayButton. */
  children?: ReactNode
}

/** A dashboard's title row: its icon and title, then any leading controls, the range toggle and the week picker. */
export function DashboardHeader({
  title,
  icon: Icon,
  interactive,
  range,
  onRangeChange,
  rangeLabel,
  weekOptions,
  selectedKey,
  onPickWeek,
  children,
}: DashboardHeaderProps): ReactElement {
  return (
    <div className="qaqc-header">
      <div className="qaqc-title">
        <span className="qaqc-title-icon">
          <Icon size={16} aria-hidden="true" />
        </span>
        <h2>{title}</h2>
      </div>
      <div className="qaqc-controls">
        {children}
        <RangeToggle value={range} recentCount={RECENT_WEEK_COUNT} disabled={!interactive} label={rangeLabel} onChange={onRangeChange} />
        <WorkWeekPicker options={weekOptions} valueKey={selectedKey} disabled={!interactive} onChange={onPickWeek} />
      </div>
    </div>
  )
}
