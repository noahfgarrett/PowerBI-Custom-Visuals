import type { ReactElement } from 'react'

export interface SegmentedOption<T extends string> {
  value: T
  text: string
}

export interface SegmentedToggleProps<T extends string> {
  /** The group's accessible name: what the switch sets. */
  label: string
  options: ReadonlyArray<SegmentedOption<T>>
  /** Null when none of the options applies right now. */
  value: T | null
  disabled: boolean
  onChange: (value: T) => void
}

/** A row of pressed/unpressed buttons that picks one value: the range, card mode and people group switches. */
export function SegmentedToggle<T extends string>({ label, options, value, disabled, onChange }: SegmentedToggleProps<T>): ReactElement {
  return (
    <div className="qaqc-segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={value === option.value ? 'is-active' : undefined}
          aria-pressed={value === option.value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
        >
          {option.text}
        </button>
      ))}
    </div>
  )
}
