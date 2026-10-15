import { CalendarDays, ChevronDown } from 'lucide-react'
import type { ReactElement } from 'react'

import type { WorkWeek } from '../types'

export interface WorkWeekPickerProps {
  /** Newest first. */
  options: WorkWeek[]
  valueKey: number
  disabled: boolean
  onChange: (key: number) => void
}

export function WorkWeekPicker({ options, valueKey, disabled, onChange }: WorkWeekPickerProps): ReactElement {
  return (
    <label className="qaqc-week-picker">
      <CalendarDays size={14} aria-hidden="true" />
      <span className="qaqc-visually-hidden">Work week</span>
      <select value={String(valueKey)} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))}>
        {options.map((option) => (
          <option key={option.key} value={String(option.key)}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown size={14} aria-hidden="true" className="qaqc-week-picker-chevron" />
    </label>
  )
}
