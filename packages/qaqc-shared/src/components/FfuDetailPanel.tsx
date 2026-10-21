import { X } from 'lucide-react'
import type { ReactElement } from 'react'

import type { Energized, FfuIndex, FfuLine, FfuNode } from '../ffuMap'
import { formatCount } from '../format'

/** What the panel shows: one FFU, or one line and its group. */
export type FfuPanelTarget = { kind: 'node'; node: number } | { kind: 'line'; line: number }

export interface FfuDetailPanelProps {
  index: FfuIndex
  target: FfuPanelTarget
  onClose: () => void
  /** A de-energized tag in the group panel was chosen. */
  onPickNode: (node: number) => void
}

/**
 * The panel's box over the map, mirroring the `.qaqc-ffu-panel` rule in qaqc.less (`right`, `width` and
 * `max-width: calc(100% - …)`); a stylesheet test keeps the two in step. The clearance keeps the panel off the
 * bottom-left zoom row: its 8 px inset, 3 × 28 px buttons with two 4 px gaps, a 16 px gap and the panel's own inset.
 */
export const FFU_PANEL_INSET_PX = 8
export const FFU_PANEL_WIDTH_PX = 300
export const FFU_PANEL_MAP_CLEARANCE_PX = 124

/** The panel's left edge, in map pixels, for a map this wide. */
export function ffuPanelLeft(mapWidth: number): number {
  const width = Math.min(FFU_PANEL_WIDTH_PX, Math.max(mapWidth - FFU_PANEL_MAP_CLEARANCE_PX, 0))
  return mapWidth - FFU_PANEL_INSET_PX - width
}

/** Shown for a blank field. */
export const BLANK_VALUE = '—'

export function energizedLabel(energized: Energized): string {
  switch (energized) {
    case 'on':
      return 'Energized'
    case 'off':
      return 'De-energized'
    case 'unknown':
      return 'Unknown'
    default: {
      const unreachable: never = energized
      return unreachable
    }
  }
}

/** "#31 of 48", or a dash when the node is on no line. */
export function linePosition(index: FfuIndex, node: FfuNode): string {
  const line = index.lines[node.line]
  if (!line || node.lineOrder <= 0) return BLANK_VALUE
  return `#${node.lineOrder} of ${line.nodes.length}`
}

export function orBlank(value: string): string {
  return value === '' ? BLANK_VALUE : value
}

function tagOf(index: FfuIndex, node: number): string {
  return index.nodes[node]?.tag ?? BLANK_VALUE
}

interface Field {
  label: string
  value: string
}

interface PanelHeadProps {
  kicker: string
  title: string
  onClose: () => void
}

function PanelHead({ kicker, title, onClose }: PanelHeadProps): ReactElement {
  return (
    <header className="qaqc-ffu-panel-head">
      <div className="qaqc-ffu-panel-title">
        <span>{kicker}</span>
        <h3>{title}</h3>
      </div>
      <button type="button" className="qaqc-ffu-icon-button" aria-label="Close panel" title="Close" onClick={onClose}>
        <X size={14} aria-hidden="true" />
      </button>
    </header>
  )
}

interface FieldListProps {
  fields: readonly Field[]
}

function FieldList({ fields }: FieldListProps): ReactElement {
  return (
    <dl className="qaqc-ffu-fields">
      {fields.map((field) => (
        <div key={field.label}>
          <dt>{field.label}</dt>
          <dd>{field.value}</dd>
        </div>
      ))}
    </dl>
  )
}

interface NodePanelProps {
  index: FfuIndex
  node: FfuNode
  onClose: () => void
}

function NodePanel({ index, node, onClose }: NodePanelProps): ReactElement {
  const line = index.lines[node.line]
  const fields: Field[] = [
    { label: 'Tag', value: node.tag },
    { label: 'FFU Group', value: orBlank(node.group) },
    { label: 'Shutdown Zone', value: orBlank(node.zone) },
    { label: 'RIO Panel', value: orBlank(node.rioPanel) },
    { label: 'Card', value: orBlank(node.card) },
    { label: 'Channel', value: orBlank(node.channel) },
    { label: 'Node', value: orBlank(node.node) },
    { label: 'PWR Panel', value: orBlank(node.pwrPanel) },
    { label: 'Circuit #', value: orBlank(node.circuit) },
    { label: 'Energized', value: energizedLabel(node.energized) },
    { label: 'Line position', value: linePosition(index, node) },
    { label: 'Home run tag', value: line && line.homeRun >= 0 ? tagOf(index, line.homeRun) : BLANK_VALUE },
    { label: 'Finish tag', value: line && line.finish >= 0 ? tagOf(index, line.finish) : BLANK_VALUE },
  ]
  return (
    <>
      <PanelHead kicker="FFU" title={node.tag} onClose={onClose} />
      <div className="qaqc-ffu-panel-body">
        {!node.hasTracker && <p className="qaqc-ffu-note">No tracker row</p>}
        {node.mismatch && line && <p className="qaqc-ffu-note is-warn">{`Group differs from its line (${line.group})`}</p>}
        <FieldList fields={fields} />
      </div>
    </>
  )
}

interface LinePanelProps {
  index: FfuIndex
  line: FfuLine
  onClose: () => void
  onPickNode: (node: number) => void
}

function LinePanel({ index, line, onClose, onPickNode }: LinePanelProps): ReactElement {
  let energized = 0
  let mismatches = 0
  const deEnergized: number[] = []
  for (const nodeIndex of line.nodes) {
    const node = index.nodes[nodeIndex]
    if (!node) continue
    if (node.energized === 'on') energized += 1
    if (node.energized === 'off') deEnergized.push(nodeIndex)
    if (node.mismatch) mismatches += 1
  }
  const fields: Field[] = [
    { label: 'Energized', value: `${formatCount(energized)} / ${formatCount(line.nodes.length)}` },
    { label: 'Group mismatches', value: formatCount(mismatches) },
  ]
  return (
    <>
      <PanelHead kicker="Group" title={line.label} onClose={onClose} />
      <div className="qaqc-ffu-panel-body">
        <FieldList fields={fields} />
        <h4 className="qaqc-ffu-list-title">{`De-energized (${formatCount(deEnergized.length)})`}</h4>
        {deEnergized.length === 0 ? (
          <p className="qaqc-ffu-note">No de-energized FFUs on this line</p>
        ) : (
          <ul className="qaqc-ffu-tag-list">
            {deEnergized.map((nodeIndex) => (
              <li key={nodeIndex}>
                <button type="button" onClick={() => onPickNode(nodeIndex)}>
                  {tagOf(index, nodeIndex)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

/** The panel beside the map: one FFU's tracker fields, or a line's group summary. Renders nothing for a stale target. */
export function FfuDetailPanel({ index, target, onClose, onPickNode }: FfuDetailPanelProps): ReactElement | null {
  switch (target.kind) {
    case 'node': {
      const node = index.nodes[target.node]
      if (!node) return null
      return (
        <aside className="qaqc-ffu-panel" aria-label={`FFU ${node.tag}`}>
          <NodePanel index={index} node={node} onClose={onClose} />
        </aside>
      )
    }
    case 'line': {
      const line = index.lines[target.line]
      if (!line) return null
      return (
        <aside className="qaqc-ffu-panel" aria-label={`Group ${line.label}`}>
          <LinePanel index={index} line={line} onClose={onClose} onPickNode={onPickNode} />
        </aside>
      )
    }
    default: {
      const unreachable: never = target
      return unreachable
    }
  }
}
