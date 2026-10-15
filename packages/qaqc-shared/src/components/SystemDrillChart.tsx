import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactElement } from 'react'

import { roundedRightBarPath, truncateLabel } from '../chartMath'
import type { ChartColors, TooltipHandler } from '../chartTypes'
import { formatCount, formatPercent, pluralize } from '../format'
import type { OtherSystems, SystemBar, SystemDetail } from '../types'

const LABEL_RATIO = 0.36
const MAX_LABEL_WIDTH = 132
const MIN_VALUE_SPACE = 34
const MAX_ROW_HEIGHT = 24
const MAX_BAR_THICKNESS = 14
const MIN_ROW_HEIGHT = 12
const CHAR_WIDTH = 6.4
const BREADCRUMB_HEIGHT = 24

export interface SystemDrillChartProps {
  /** Top systems in the window, ranked by total. */
  systems: SystemBar[]
  other: OtherSystems | null
  /** The drilled system, or null at the top level. */
  drill: SystemDetail | null
  width: number
  height: number
  colors: ChartColors
  /** Drilling in and out needs interactions. */
  interactive: boolean
  describe: boolean
  /** A system name drills in; null returns to all systems. */
  onDrill: (system: string | null) => void
  /**
   * Called when focus would fall to the body: the drill reset without the breadcrumb (the drilled system left the
   * window) while the breadcrumb had focus, or All systems found no row to return focus to.
   */
  onFocusLost?: () => void
  onHover: TooltipHandler
}

interface Row {
  label: string
  total: number
  signed: number
  /** The system this row drills into, or null when the row cannot drill. */
  drillTarget: string | null
}

/** Where focus goes once the parent applies a drill change. */
type PendingFocus = { kind: 'breadcrumb' } | { kind: 'row'; system: string }

function rateOf(row: Row): number | null {
  return row.total === 0 ? null : (row.signed / row.total) * 100
}

function signedOfTotal(row: Row): string {
  return `${formatCount(row.signed)} of ${formatCount(row.total)}`
}

function endLabel(row: Row): string {
  return `${formatCount(row.signed)} / ${formatCount(row.total)} · ${formatPercent(rateOf(row), 0)}`
}

function buildRows(systems: SystemBar[], other: OtherSystems | null, drill: SystemDetail | null, interactive: boolean): Row[] {
  if (drill !== null) {
    return drill.specs.map((spec) => ({ label: spec.spec, total: spec.total, signed: spec.signed, drillTarget: null }))
  }
  const rows: Row[] = systems.map((bar) => ({
    label: bar.system,
    total: bar.total,
    signed: bar.signed,
    drillTarget: interactive ? bar.system : null,
  }))
  if (other !== null) {
    rows.push({
      label: `Other (${other.count} ${pluralize(other.count, 'system', 'systems')})`,
      total: other.total,
      signed: other.signed,
      drillTarget: null,
    })
  }
  return rows
}

export function SystemDrillChart({
  systems,
  other,
  drill,
  width,
  height,
  colors,
  interactive,
  describe,
  onDrill,
  onFocusLost,
  onHover,
}: SystemDrillChartProps): ReactElement {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null)
  const [showFocusRing, setShowFocusRing] = useState(false)
  // Mirrors :focus-visible (which jsdom cannot model): no ring when a click moved focus.
  const usedPointerRef = useRef(false)
  const pendingFocusRef = useRef<PendingFocus | null>(null)
  const breadcrumbRef = useRef<HTMLButtonElement | null>(null)
  // Whether the breadcrumb held focus when it was removed. Focus is gone by the time effects run, so this is
  // recorded by the ref cleanup, which React runs before it removes the button.
  const breadcrumbHadFocusRef = useRef(false)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const drilledSystem = drill?.system ?? null

  const attachBreadcrumb = useCallback((node: HTMLButtonElement | null): (() => void) => {
    breadcrumbRef.current = node
    return () => {
      breadcrumbHadFocusRef.current = node !== null && node.ownerDocument.activeElement === node
      breadcrumbRef.current = null
    }
  }, [])

  useEffect(() => {
    const breadcrumbHadFocus = breadcrumbHadFocusRef.current
    breadcrumbHadFocusRef.current = false
    const pending = pendingFocusRef.current
    if (pending === null) {
      if (breadcrumbHadFocus && drilledSystem === null) onFocusLost?.()
      return
    }
    pendingFocusRef.current = null
    if (pending.kind === 'breadcrumb') {
      if (drilledSystem !== null) breadcrumbRef.current?.focus()
      return
    }
    if (drilledSystem !== null) return
    const rows = svgRef.current?.querySelectorAll<SVGElement>('[data-system]') ?? []
    const target = [...rows].find((node) => node.getAttribute('data-system') === pending.system)
    // The system may have no row of its own now (it fell into Other or below the height limit).
    if (target === undefined) onFocusLost?.()
    else target.focus()
  }, [drilledSystem])

  const svgHeight = Math.max(0, height - (drill !== null ? BREADCRUMB_HEIGHT : 0))
  const allRows = buildRows(systems, other, drill, interactive)
  const rows = allRows.slice(0, Math.max(1, Math.floor(svgHeight / MIN_ROW_HEIGHT)))
  const widestLabelChars = rows.reduce((max, row) => Math.max(max, endLabel(row).length), 0)
  const valueSpace = Math.max(MIN_VALUE_SPACE, Math.ceil(widestLabelChars * CHAR_WIDTH) + 8)
  const labelWidth = Math.min(MAX_LABEL_WIDTH, width * LABEL_RATIO)
  const plotWidth = Math.max(0, width - labelWidth - valueSpace)
  const rowHeight = rows.length > 0 ? Math.min(MAX_ROW_HEIGHT, svgHeight / rows.length) : 0
  const thickness = Math.min(MAX_BAR_THICKNESS, rowHeight * 0.64)
  const maxTotal = rows.reduce((max, row) => Math.max(max, row.total), 1)
  const scale = plotWidth / maxTotal
  const maxChars = Math.max(1, Math.floor((labelWidth - 8) / CHAR_WIDTH))
  const subject = drill !== null ? `Sign-off by pipe spec in ${drill.system}` : 'Sign-off by system'
  const summary = describe && rows.length > 0
    ? `${subject}. Most welds: ${rows[0].label}, ${formatCount(rows[0].signed)} of ${formatCount(rows[0].total)} signed`
    : subject

  function showTooltip(row: Row, event: MouseEvent<SVGRectElement>): void {
    onHover({
      title: row.label,
      rows: [
        { label: 'Signed', value: signedOfTotal(row) },
        { label: 'Sign-off %', value: formatPercent(rateOf(row)) },
      ],
      clientX: event.clientX,
      clientY: event.clientY,
    })
  }

  function drillInto(system: string): void {
    pendingFocusRef.current = { kind: 'breadcrumb' }
    onDrill(system)
  }

  function returnToAll(): void {
    if (drill !== null) pendingFocusRef.current = { kind: 'row', system: drill.system }
    onDrill(null)
  }

  function handleRowKeyDown(system: string, event: KeyboardEvent<SVGRectElement>): void {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    drillInto(system)
  }

  return (
    <div
      className="qaqc-drill-chart"
      // Focus from a click lands between mousedown and mouseup.
      onMouseDown={() => {
        usedPointerRef.current = true
      }}
      onMouseUp={() => {
        usedPointerRef.current = false
      }}
    >
      {drill !== null && (
        <nav className="qaqc-breadcrumb" aria-label="System drill-down">
          <button ref={attachBreadcrumb} type="button" disabled={!interactive} onClick={returnToAll}>
            All systems
          </button>
          <span className="qaqc-breadcrumb-separator" aria-hidden="true">›</span>
          <span className="qaqc-breadcrumb-current" aria-current="page">{drill.system}</span>
        </nav>
      )}
      <svg ref={svgRef} className="qaqc-chart" width={width} height={svgHeight} role="group" aria-label={summary}>
        {rows.map((row, index) => {
          const top = index * rowHeight
          const barY = top + (rowHeight - thickness) / 2
          const signedWidth = row.signed * scale
          const unsignedWidth = (row.total - row.signed) * scale
          return (
            <g key={row.label} className="qaqc-bar">
              <text className="qaqc-axis-text qaqc-row-label" x={labelWidth - 8} y={barY + thickness / 2 + 3.5} textAnchor="end" fill={colors.ink}>
                {truncateLabel(row.label, maxChars)}
              </text>
              {row.total > row.signed
                ? (
                  <>
                    {row.signed > 0 && <rect x={labelWidth} y={barY} width={signedWidth} height={thickness} fill={colors.series1} />}
                    <path d={roundedRightBarPath(labelWidth + signedWidth, barY, unsignedWidth, thickness, 4)} fill={colors.series2} />
                  </>
                )
                : <path d={roundedRightBarPath(labelWidth, barY, signedWidth, thickness, 4)} fill={colors.series1} />}
              <text className="qaqc-value-text" x={labelWidth + row.total * scale + 6} y={barY + thickness / 2 + 3.5} fill={colors.axisText}>
                {endLabel(row)}
              </text>
            </g>
          )
        })}
        {showFocusRing && focusedIndex !== null && focusedIndex < rows.length && (
          <rect
            className="qaqc-focus-ring"
            x={1}
            y={focusedIndex * rowHeight + 1}
            width={Math.max(0, width - 2)}
            height={Math.max(0, rowHeight - 2)}
            rx={3}
            fill="none"
            stroke={colors.accent}
            strokeWidth={1.5}
          />
        )}
        <g onMouseLeave={() => onHover(null)}>
          {rows.map((row, index) => {
            const target = row.drillTarget
            const hitProps = {
              className: 'qaqc-hit',
              x: 0,
              y: index * rowHeight,
              width,
              height: rowHeight,
              fill: 'transparent',
              onMouseMove: (event: MouseEvent<SVGRectElement>) => showTooltip(row, event),
            }
            if (target === null) return <rect key={row.label} {...hitProps} />
            const rate = formatPercent(rateOf(row), 0)
            return (
              <rect
                key={row.label}
                {...hitProps}
                className="qaqc-hit qaqc-drill-row"
                data-system={target}
                role="button"
                tabIndex={0}
                aria-label={`${row.label}: ${signedOfTotal(row)} signed, ${rate}. Show pipe specs`}
                onClick={() => drillInto(target)}
                onKeyDown={(event) => handleRowKeyDown(target, event)}
                onFocus={() => {
                  setFocusedIndex(index)
                  setShowFocusRing(!usedPointerRef.current)
                }}
                onBlur={() => setFocusedIndex(null)}
              />
            )
          })}
        </g>
      </svg>
    </div>
  )
}
