import type { MouseEvent, ReactElement } from 'react'

import { roundedRightBarPath, truncateLabel } from '../chartMath'
import type { ChartColors, TooltipHandler } from '../chartTypes'
import { formatCount, formatPercent, pluralize } from '../format'
import type { BuildingIssueBar, OtherIssueBuildings } from '../types'

const LABEL_RATIO = 0.36
const MAX_LABEL_WIDTH = 132
const MIN_VALUE_SPACE = 34
const MAX_ROW_HEIGHT = 24
const MAX_BAR_THICKNESS = 14
const MIN_ROW_HEIGHT = 12
const CHAR_WIDTH = 6.4
/** A building at this multiple of the overall rate or more is a hotspot. */
const HOTSPOT_MULTIPLE = 2
const NO_ISSUES_MESSAGE = 'No issues created in this range'

export interface IssueRateChartProps {
  /** Buildings with at least the minimum welds, ranked by issue rate. */
  bars: BuildingIssueBar[]
  other: OtherIssueBuildings | null
  /** Window issues ÷ window welds as a percent. */
  overallRate: number
  width: number
  height: number
  colors: ChartColors
  describe: boolean
  onHover: TooltipHandler
}

interface Row {
  label: string
  welds: number
  issues: number
  rate: number
  isHotspot: boolean
}

function issueCount(issues: number): string {
  return `${formatCount(issues)} ${pluralize(issues, 'issue', 'issues')}`
}

function endLabel(row: Row): string {
  return `${issueCount(row.issues)} · ${formatPercent(row.rate)}`
}

function buildRows(bars: BuildingIssueBar[], other: OtherIssueBuildings | null, overallRate: number): Row[] {
  const rows: Row[] = bars.map((bar) => ({
    label: bar.building,
    welds: bar.welds,
    issues: bar.issues,
    rate: bar.rate,
    isHotspot: bar.rate > 0 && bar.rate >= overallRate * HOTSPOT_MULTIPLE,
  }))
  if (other !== null) {
    // Other pools small buildings, so it is never called out as a hotspot.
    rows.push({
      label: `Other (${other.count} ${pluralize(other.count, 'building', 'buildings')})`,
      welds: other.welds,
      issues: other.issues,
      rate: other.welds === 0 ? 0 : (other.issues / other.welds) * 100,
      isHotspot: false,
    })
  }
  return rows
}

export function IssueRateChart({ bars, other, overallRate, width, height, colors, describe, onHover }: IssueRateChartProps): ReactElement {
  const allRows = buildRows(bars, other, overallRate)
  if (allRows.every((row) => row.issues === 0)) return <p className="qaqc-chart-empty">{NO_ISSUES_MESSAGE}</p>

  const rows = allRows.slice(0, Math.max(1, Math.floor(height / MIN_ROW_HEIGHT)))
  const widestLabelChars = rows.reduce((max, row) => Math.max(max, endLabel(row).length), 0)
  const valueSpace = Math.max(MIN_VALUE_SPACE, Math.ceil(widestLabelChars * CHAR_WIDTH) + 8)
  const labelWidth = Math.min(MAX_LABEL_WIDTH, width * LABEL_RATIO)
  const plotWidth = Math.max(0, width - labelWidth - valueSpace)
  const rowHeight = rows.length > 0 ? Math.min(MAX_ROW_HEIGHT, height / rows.length) : 0
  const thickness = Math.min(MAX_BAR_THICKNESS, rowHeight * 0.64)
  // The overall rate joins the domain so its hairline always lands inside the plot.
  const maxRate = rows.reduce((max, row) => Math.max(max, row.rate), overallRate)
  const scale = maxRate > 0 ? plotWidth / maxRate : 0
  const maxChars = Math.max(1, Math.floor((labelWidth - 8) / CHAR_WIDTH))
  const overallX = labelWidth + overallRate * scale
  const barY = (index: number): number => index * rowHeight + (rowHeight - thickness) / 2
  const textY = (index: number): number => barY(index) + thickness / 2 + 3.5
  const highest = rows[0]
  const summary = describe
    ? `Issue rate by building, overall ${formatPercent(overallRate)}. Highest: ${highest.label}, ${issueCount(highest.issues)}, ${formatPercent(highest.rate)}`
    : 'Issue rate by building'

  function showTooltip(row: Row, event: MouseEvent<SVGRectElement>): void {
    onHover({
      title: row.label,
      rows: [
        { label: 'Issues', value: formatCount(row.issues) },
        { label: 'Welds', value: formatCount(row.welds) },
        { label: 'Issue rate', value: formatPercent(row.rate) },
      ],
      clientX: event.clientX,
      clientY: event.clientY,
    })
  }

  return (
    <svg className="qaqc-chart" width={width} height={height} role="img" aria-label={summary}>
      {rows.map((row, index) => (
        <g key={row.label} className={row.isHotspot ? 'qaqc-bar is-hotspot' : 'qaqc-bar'}>
          <text className="qaqc-axis-text qaqc-row-label" x={labelWidth - 8} y={textY(index)} textAnchor="end" fill={colors.ink}>
            {truncateLabel(row.label, maxChars)}
          </text>
          <path d={roundedRightBarPath(labelWidth, barY(index), row.rate * scale, thickness, 4)} fill={row.isHotspot ? colors.warn : colors.series1} />
        </g>
      ))}
      <line
        className="qaqc-overall-line"
        x1={overallX}
        x2={overallX}
        y1={0}
        y2={rows.length * rowHeight}
        stroke={colors.ink}
      />
      {/* Drawn after the hairline so the card halo keeps each label readable where they cross. */}
      {rows.map((row, index) => (
        <text key={row.label} className="qaqc-value-text qaqc-rate-value" x={labelWidth + row.rate * scale + 6} y={textY(index)} fill={colors.axisText}>
          {endLabel(row)}
        </text>
      ))}
      <g onMouseLeave={() => onHover(null)}>
        {rows.map((row, index) => (
          <rect
            key={row.label}
            className="qaqc-hit"
            x={0}
            y={index * rowHeight}
            width={width}
            height={rowHeight}
            fill="transparent"
            onMouseMove={(event) => showTooltip(row, event)}
          />
        ))}
      </g>
    </svg>
  )
}
