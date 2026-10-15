import { useState } from 'react'

export type SortDirection = 'ascending' | 'descending'

export interface SortState<Key extends string> {
  key: Key
  direction: SortDirection
}

export interface TableSort<Key extends string> {
  sort: SortState<Key>
  /** Flips the direction of the current column, or switches to another column in its default direction. */
  toggleSort: (key: Key) => void
}

/** +1 for ascending, −1 for descending, to multiply a comparison by. */
export function directionSign(direction: SortDirection): number {
  return direction === 'ascending' ? 1 : -1
}

/**
 * Sort state for a table with sortable column headers. The name column starts ascending (A to Z);
 * every number column starts descending (largest first).
 */
export function useTableSort<Key extends string>(initial: SortState<Key>, nameKey: Key): TableSort<Key> {
  const [sort, setSort] = useState<SortState<Key>>(initial)

  function toggleSort(key: Key): void {
    setSort((current) => {
      if (current.key === key) {
        return { key, direction: current.direction === 'ascending' ? 'descending' : 'ascending' }
      }
      return { key, direction: key === nameKey ? 'ascending' : 'descending' }
    })
  }

  return { sort, toggleSort }
}
