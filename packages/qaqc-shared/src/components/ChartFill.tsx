import type { ReactElement, ReactNode } from 'react'

import { useElementSize, type ElementSize } from '../hooks/useElementSize'

export interface ChartFillProps {
  children: (size: ElementSize) => ReactNode
}

/** A flexible chart area inside an expanded panel; the chart gets this area's size, not the whole body's. */
export function ChartFill({ children }: ChartFillProps): ReactElement {
  const [ref, size] = useElementSize<HTMLDivElement>()
  return (
    <div ref={ref} className="qaqc-chart-fill">
      {size.width > 0 && size.height > 0 ? children(size) : null}
    </div>
  )
}
