import type { ReactElement } from 'react'

import type { RangeMode } from '../types'
import { SegmentedToggle } from './SegmentedToggle'

export interface RangeToggleProps {
  /** Null when neither option applies: a date range has replaced the window. */
  value: RangeMode | null
  recentCount: number
  disabled: boolean
  /** The group's accessible name: what the range sets. Defaults to "Chart range". */
  label?: string
  onChange: (mode: RangeMode) => void
}

/** The `30 WW | All` switch: a segmented toggle whose recent option names the window length. */
export function RangeToggle({ value, recentCount, disabled, label = 'Chart range', onChange }: RangeToggleProps): ReactElement {
  const options = [
    { value: 'recent', text: `${recentCount} WW` },
    { value: 'all', text: 'All' },
  ] as const
  return <SegmentedToggle label={label} options={options} value={value} disabled={disabled} onChange={onChange} />
}
