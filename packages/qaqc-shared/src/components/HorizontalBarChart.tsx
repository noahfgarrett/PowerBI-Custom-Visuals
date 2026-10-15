import type { MouseEvent, ReactElement } from 'react'

import { roundedRightBarPath, truncateLabel } from '../chartMath'
import type { ChartColors, TooltipHandler } from '../chartTypes'
import { formatCount } from '../format'
import type { BuildingBar, OtherBuildings } from '../types'

const LABEL_RATIO = 0.36
const MAX_LABEL_WIDTH = 132
const VALUE_SPACE = 34
const MAX_ROW_HEIGHT = 24
const MAX_BAR_THICKNESS = 14
const MIN_ROW_HEIGHT = 12
const CHAR_WIDTH = 6.4

export interface HorizontalBarChartProps {
  bars: BuildingBar[]
  other: OtherBuildings | null
  width: number
  height: number
  colors: ChartColors
  describe: boolean
  onHover: TooltipHandler
}

interface Row {
  label: string
  finals: number
  sors: number
}

export function HorizontalBarChart({ bars, other, width, height, colors, describe, onHover }: HorizontalBarChartProps): ReactElement {
  const allRows: Row[] = [
    ...bars.map((bar) => ({ label: bar.building, finals: bar.finals, sors: bar.sors })),
    ...(other ? [{ label: `Other (${other.count} buildings)`, finals: other.finals, sors: other.sors }] : []),
  ]
  const rows = allRows.slice(0, Math.max(1, Math.floor(height / MIN_ROW_HEIGHT)))
  const widestTotalChars = rows.reduce((max, row) => Math.max(max, formatCount(row.finals + row.sors).length), 0)
  const valueSpace = Math.max(VALUE_SPACE, Math.ceil(widestTotalChars * CHAR_WIDTH) + 8)
  const labelWidth = Math.min(MAX_LABEL_WIDTH, width * LABEL_RATIO)
  const plotWidth = Math.max(0, width - labelWidth - valueSpace)
  const rowHeight = rows.length > 0 ? Math.min(MAX_ROW_HEIGHT, height / rows.length) : 0
  const thickness = Math.min(MAX_BAR_THICKNESS, rowHeight * 0.64)
  const maxTotal = rows.reduce((max, row) => Math.max(max, row.finals + row.sors), 1)
  const scale = plotWidth / maxTotal
  const maxChars = Math.max(1, Math.floor((labelWidth - 8) / CHAR_WIDTH))
  const summary = describe && rows.length > 0
    ? `Inspections by building. Most: ${rows[0].label}, ${formatCount(rows[0].finals + rows[0].sors)}`
    : 'Inspections by building'

  function showTooltip(row: Row, event: MouseEvent<SVGRectElement>): void {
    onHover({
      title: row.label,
      rows: [
        { label: 'Finals', value: formatCount(row.finals) },
        { label: 'SORs', value: formatCount(row.sors) },
        { label: 'Total', value: formatCount(row.finals + row.sors) },
      ],
      clientX: event.clientX,
      clientY: event.clientY,
    })
  }

  return (
    <svg className="qaqc-chart" width={width} height={height} role="img" aria-label={summary}>
      {rows.map((row, index) => {
        const top = index * rowHeight
        const barY = top + (rowHeight - thickness) / 2
        const finalsWidth = row.finals * scale
        const sorsWidth = row.sors * scale
        const total = row.finals + row.sors
        return (
          <g key={row.label}>
            <text className="qaqc-axis-text qaqc-row-label" x={labelWidth - 8} y={barY + thickness / 2 + 3.5} textAnchor="end" fill={colors.ink}>
              {truncateLabel(row.label, maxChars)}
            </text>
            {row.sors > 0
              ? (
                <>
                  <rect x={labelWidth} y={barY} width={finalsWidth} height={thickness} fill={colors.series1} />
                  <path d={roundedRightBarPath(labelWidth + finalsWidth, barY, sorsWidth, thickness, 4)} fill={colors.series2} />
                </>
              )
              : <path d={roundedRightBarPath(labelWidth, barY, finalsWidth, thickness, 4)} fill={colors.series1} />}
            <text className="qaqc-value-text" x={labelWidth + total * scale + 6} y={barY + thickness / 2 + 3.5} fill={colors.axisText}>
              {formatCount(total)}
            </text>
          </g>
        )
      })}
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
