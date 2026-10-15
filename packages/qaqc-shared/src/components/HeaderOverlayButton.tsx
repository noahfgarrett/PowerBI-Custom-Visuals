import type { LucideIcon } from 'lucide-react'
import type { ReactElement } from 'react'

import type { ExpandableProps } from './ChartExpansionFrame'

export interface HeaderOverlayButtonProps extends ExpandableProps {
  /** The visible text. */
  label: string
  /** The accessible name; it should start with or contain the visible text. */
  ariaLabel: string
  icon: LucideIcon
}

/**
 * A dashboard header button that opens a `kind: 'page'` panel of the ChartExpansionFrame. Spread `expandable(id)`
 * onto it: the page grows from this button and focus returns here when it closes. Renders nothing when
 * interactions are not allowed.
 */
export function HeaderOverlayButton({ sectionRef, onExpand, label, ariaLabel, icon: Icon }: HeaderOverlayButtonProps): ReactElement | null {
  if (onExpand === undefined) return null
  return (
    <button
      ref={sectionRef}
      type="button"
      className="qaqc-header-button"
      aria-haspopup="dialog"
      aria-label={ariaLabel}
      onClick={onExpand}
    >
      <Icon size={14} aria-hidden="true" />
      <span>{label}</span>
    </button>
  )
}
