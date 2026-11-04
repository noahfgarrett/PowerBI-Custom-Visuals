import { X } from 'lucide-react'
import { useEffect, useRef, type ReactElement } from 'react'

export interface FilterChip {
  id: string
  label: string
  /** The values as the chip shows them, shortened when there are many. */
  text: string
  /** Every value, for the chip's title. */
  fullText: string
  onRemove: () => void
}

export interface FilterChipsProps {
  chips: readonly FilterChip[]
  /** Notes about sources the active filters don't reach. */
  notes: readonly string[]
  onClearAll: () => void
  /** Called when the control that held focus is gone, so focus can go to the Filter button rather than `body`. */
  onFocusLost: () => void
}

/** The active filters under a dashboard's header: one removable chip per group, Clear all, and any notes. */
export function FilterChips({ chips, notes, onClearAll, onFocusLost }: FilterChipsProps): ReactElement | null {
  const containerRef = useRef<HTMLDivElement | null>(null)
  // Set by a remove button: the position focus moves to once the chip has gone.
  const pendingFocusRef = useRef<number | null>(null)

  useEffect(() => {
    const position = pendingFocusRef.current
    if (position === null) return
    pendingFocusRef.current = null
    const buttons = containerRef.current?.querySelectorAll<HTMLButtonElement>('.qaqc-filter-chip button') ?? []
    if (buttons.length === 0) onFocusLost()
    else buttons[Math.min(position, buttons.length - 1)].focus({ preventScroll: true })
  })

  if (chips.length === 0) return null

  function clearAll(): void {
    onClearAll()
    onFocusLost()
  }

  return (
    <div ref={containerRef} className="qaqc-filter-chips" role="group" aria-label="Active filters">
      {chips.map((chip, position) => (
        <span key={chip.id} className="qaqc-filter-chip" title={`${chip.label}: ${chip.fullText}`}>
          <span className="qaqc-filter-chip-text">
            <b>{chip.label}:</b> <span>{chip.text}</span>
          </span>
          <button
            type="button"
            aria-label={`Remove ${chip.label} filter`}
            onClick={() => {
              pendingFocusRef.current = position
              chip.onRemove()
            }}
          >
            <X size={12} aria-hidden="true" />
          </button>
        </span>
      ))}
      <button type="button" className="qaqc-filter-link" onClick={clearAll}>
        Clear all
      </button>
      {notes.map((note) => (
        <span key={note} className="qaqc-filter-note">
          {note}
        </span>
      ))}
    </div>
  )
}
