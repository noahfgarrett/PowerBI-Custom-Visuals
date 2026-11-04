import { FunnelX } from 'lucide-react'
import type { ReactElement } from 'react'

export interface FilterEmptyStateProps {
  /** What the dashboard counts, as in "There are no Finals or SORs". */
  rowsName: string
  isInRange: boolean
  disabled: boolean
  onClear: () => void
}

/** Replaces the cards and charts when the filters leave nothing, because zeros there would read as real results. */
export function FilterEmptyState({ rowsName, isInRange, disabled, onClear }: FilterEmptyStateProps): ReactElement {
  return (
    <div className="qaqc-filter-empty" role="status">
      <span className="qaqc-filter-empty-icon">
        <FunnelX size={22} aria-hidden="true" />
      </span>
      <h3>No rows match these filters</h3>
      <p>
        There are no {rowsName}
        {isInRange ? ' in this date range' : ''} with this combination. The cards and charts are hidden because zeros
        here would look like real results. Remove a filter above, or clear them all.
      </p>
      <button type="button" disabled={disabled} onClick={onClear}>
        Clear filters
      </button>
    </div>
  )
}
