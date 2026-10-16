import type { ReactElement } from 'react'

import type { RangeMode } from '../types'

export interface RangeToggleProps {
  value: RangeMode
  recentCount: number
  disabled: boolean
  /** The group's accessible name: what the range sets. Defaults to "Chart range". */
  label?: string
  onChange: (mode: RangeMode) => void
}

interface RangeOption {
  mode: RangeMode
  label: string
}

export function RangeToggle({ value, recentCount, disabled, label = 'Chart range', onChange }: RangeToggleProps): ReactElement {
  const options: RangeOption[] = [
    { mode: 'recent', label: `${recentCount} WW` },
    { mode: 'all', label: 'All' },
  ]
  return (
    <div className="qaqc-range-toggle" role="group" aria-label={label}>
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
