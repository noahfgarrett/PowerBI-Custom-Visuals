import type powerbi from 'powerbi-visuals-api'

import { FFU_SLOTS, type FfuRole } from '../../../qaqc-shared/src/ffuMap'

export interface TableOptions {
  roles?: FfuRole[]
  segment?: boolean
  /** Format pane values, as Power BI delivers them in metadata.objects. */
  objects?: powerbi.DataViewObjects
}

export const ALL_ROLES: FfuRole[] = FFU_SLOTS.map((slot) => slot.role)

/** A null or non-primitive cell becomes blank text, as Power BI sends it. */
function primitiveOf(cell: unknown): powerbi.PrimitiveValue {
  if (typeof cell === 'string' || typeof cell === 'number' || typeof cell === 'boolean' || cell instanceof Date) return cell
  return ''
}

/**
 * Builds a table data view whose columns carry the given roles, in order. Each input row is in `FFU_SLOTS` order,
 * as `syntheticFfuTable` builds it; each column's display name is its slot's column header.
 */
export function tableDataView(rows: ReadonlyArray<ReadonlyArray<unknown>>, options: TableOptions = {}): powerbi.DataView {
  const roles = options.roles ?? ALL_ROLES
  const slots = roles.map((role) => {
    const position = FFU_SLOTS.findIndex((slot) => slot.role === role)
    const slot = FFU_SLOTS[position]
    if (!slot) throw new Error(`unknown role ${role}`)
    return { slot, position }
  })
  const columns: powerbi.DataViewMetadataColumn[] = slots.map(({ slot }, index) => ({
    displayName: slot.column,
    index,
    roles: { [slot.role]: true },
  }))
  const tableRows: powerbi.DataViewTableRow[] = rows.map((row) => slots.map(({ position }) => primitiveOf(row[position])))
  const metadata: powerbi.DataViewMetadata = { columns }
  if (options.segment) metadata.segment = {}
  if (options.objects) metadata.objects = options.objects
  return {
    metadata,
    table: { columns, rows: tableRows },
  }
}
