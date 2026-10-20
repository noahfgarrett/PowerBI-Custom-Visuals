import { Layers } from 'lucide-react'
import type { ReactElement } from 'react'

import type { ChartColors } from '../chartTypes'
import { formatCount, formatPercent } from '../format'
import type { CategorySlice, CauseCount, ReadoutLine } from '../rootCauses'
import { paretoGrey } from './ParetoChart'

/** Causes listed inside Other before the rest are summed into one "n more causes" row. */
const OTHER_ROWS = 10

export interface ParetoReadoutProps {
  /** The model's read-out; empty when no issue has a recorded cause. */
  lines: readonly ReadoutLine[]
}

/** The read-out, one paragraph per line (the coverage, then the top cause), each with its subject in bold. */
export function ParetoReadout({ lines }: ParetoReadoutProps): ReactElement | null {
  if (lines.length === 0) return null
  return (
    <>
      {lines.map((line) => (
        <p key={line.lead}>
          <b>{line.lead}</b>
          {line.rest}
        </p>
      ))}
    </>
  )
}

/** Series 1 to 3 for the three largest categories, then the Pareto's grey, which Not recorded always takes. */
function swatchColor(at: number, slice: CategorySlice, colors: ChartColors, isHighContrast: boolean): string {
  if (slice.key === 'notRecorded' || at >= 3) return paretoGrey(colors, isHighContrast)
  return [colors.series1, colors.series2, colors.series3][at]
}

export interface RootCauseCategoryPanelProps {
  /** Largest first, Not recorded last. */
  categories: CategorySlice[]
  /** The Other bar's label, or null when every cause has its own bar. */
  otherLabel: string | null
  /** The causes folded into Other, largest first. */
  otherCauses: CauseCount[]
  /** The issue count and period under the title. */
  summary: string
  readout: ReadoutLine[]
  colors: ChartColors
  isHighContrast: boolean
}

/** The Pareto page's side panel: the category split, the causes inside Other, and the read-out. */
export function RootCauseCategoryPanel({
  categories,
  otherLabel,
  otherCauses,
  summary,
  readout,
  colors,
  isHighContrast,
}: RootCauseCategoryPanelProps): ReactElement {
  const shown = otherCauses.slice(0, OTHER_ROWS)
  const rest = otherCauses.slice(OTHER_ROWS)
  const restCount = rest.reduce((sum, cause) => sum + cause.count, 0)
  const swatchStyle = (at: number, slice: CategorySlice): { background: string } => ({ background: swatchColor(at, slice, colors, isHighContrast) })

  return (
    <section className="qaqc-panel qaqc-pareto-side" aria-label="Root Cause Category">
      <header className="qaqc-panel-title">
        <Layers size={15} aria-hidden="true" />
        <h3>Root Cause Category</h3>
      </header>
      <p className="qaqc-pareto-side-note">{summary}</p>
      <div className="qaqc-pareto-strip" aria-hidden="true">
        {categories.map((slice, at) => (
          <i key={slice.key} style={{ flexGrow: slice.count, ...swatchStyle(at, slice) }} />
        ))}
      </div>
      <ul className="qaqc-pareto-categories">
        {categories.map((slice, at) => (
          <li key={slice.key}>
            <i aria-hidden="true" style={swatchStyle(at, slice)} />
            <span title={slice.label}>{slice.label}</span>
            <strong>{formatCount(slice.count)}</strong>
            <em>{formatPercent(slice.share)}</em>
          </li>
        ))}
      </ul>
      {otherLabel !== null && otherCauses.length > 0 && (
        <div className="qaqc-pareto-other">
          <h4>{`Inside ${otherLabel}`}</h4>
          <ul>
            {shown.map((cause) => (
              <li key={cause.label}>
                <span title={cause.label}>{cause.label}</span>
                <strong>{formatCount(cause.count)}</strong>
              </li>
            ))}
            {rest.length > 0 && (
              <li className="is-more">
                <span>{`${formatCount(rest.length)} more ${rest.length === 1 ? 'cause' : 'causes'}`}</span>
                <strong>{formatCount(restCount)}</strong>
              </li>
            )}
          </ul>
        </div>
      )}
      {readout.length > 0 && (
        <div className="qaqc-pareto-readout">
          <h4>Read-out</h4>
          <ParetoReadout lines={readout} />
        </div>
      )}
    </section>
  )
}
