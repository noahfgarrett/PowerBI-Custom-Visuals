import type { ReactElement } from 'react'

export function LoadingBar({ active }: { active: boolean }): ReactElement | null {
  if (!active) return null
  return (
    <div className="qaqc-loading" role="progressbar" aria-label="Loading more rows">
      <span />
    </div>
  )
}
