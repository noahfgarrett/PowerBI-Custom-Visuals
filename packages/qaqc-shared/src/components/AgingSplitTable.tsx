import type { ReactElement } from 'react'

import { formatCount } from '../format'
import type { OverallAgingBucket } from '../types'

export interface AgingSplitTableProps {
  /** In bucket order, youngest first. */
  buckets: OverallAgingBucket[]
}

/** The expanded Overall Issue Aging counts, split into closed and still open per bucket. Bucket order is fixed. */
export function AgingSplitTable({ buckets }: AgingSplitTableProps): ReactElement {
  return (
    <div className="qaqc-table-wrap">
      <table className="qaqc-table qaqc-aging-split-table">
        <caption className="qaqc-visually-hidden">Issue aging, closed and still open</caption>
        <thead>
          <tr>
            <th scope="col">Age</th>
            <th scope="col">Total</th>
            <th scope="col">Closed</th>
            <th scope="col">Still open</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((bucket) => (
            <tr key={bucket.label}>
              <th scope="row">{bucket.label}</th>
              <td>{formatCount(bucket.count)}</td>
              <td>{formatCount(bucket.closed)}</td>
              <td>{formatCount(bucket.open)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
