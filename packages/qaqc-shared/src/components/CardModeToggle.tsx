import type { ReactElement } from 'react'

import type { CardMode } from '../overview'

export interface CardModeToggleProps {
  value: CardMode
  disabled: boolean
  onChange: (mode: CardMode) => void
}

interface ModeOption {
  mode: CardMode
  label: string
}

const OPTIONS: readonly ModeOption[] = [
  { mode: 'week', label: 'This WW' },
  { mode: 'toDate', label: 'To date' },
] as const

/** The Overview's `This WW | To date` switch for its cards, drawn like the range toggle. */
export function CardModeToggle({ value, disabled, onChange }: CardModeToggleProps): ReactElement {
  return (
    <div className="qaqc-range-toggle qaqc-mode-toggle" role="group" aria-label="Card values">
      {OPTIONS.map((option) => (
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
