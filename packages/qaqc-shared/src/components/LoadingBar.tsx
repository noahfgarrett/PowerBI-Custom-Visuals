import type { ReactElement } from 'react'

export interface LoadingBarProps {
  active: boolean
}

export function LoadingBar({ active }: LoadingBarProps): ReactElement | null {
  if (!active) return null
  return (
    <div className="qaqc-loading" role="progressbar" aria-label="Loading more rows">
      <span />
    </div>
  )
}
