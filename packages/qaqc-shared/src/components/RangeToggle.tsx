import type { ReactElement } from 'react'

import type { RangeMode } from '../types'

export interface RangeToggleProps {
  value: RangeMode
  recentCount: number
  disabled: boolean
  onChange: (mode: RangeMode) => void
}

export function RangeToggle({ value, recentCount, disabled, onChange }: RangeToggleProps): ReactElement {
  const options: Array<{ mode: RangeMode; label: string }> = [
    { mode: 'recent', label: `${recentCount} WW` },
    { mode: 'all', label: 'All' },
  ]
  return (
    <div className="qaqc-range-toggle" role="group" aria-label="Chart range">
      {options.map((option) => (
        <button
          key={option.mode}
          type="button"
          className={value === option.mode ? 'is-active' : undefined}
          aria-pressed={value === option.mode}
          disabled={disabled}
          onClick={() => onChange(option.mode)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
