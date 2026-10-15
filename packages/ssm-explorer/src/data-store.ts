import type powerbi from 'powerbi-visuals-api';
import type { SsmStoreUpdate } from './types';
import { RegistryBuilder, schemaKey } from './registry-builder';

// SDK VisualDataChangeOperationKind: Create=0, Append=1, Segment=2.
// Incremental table segments can overlap through lastMergeIndex (inclusive).
type SegmentedTable = powerbi.DataViewTable & { lastMergeIndex?: number };

/** Accumulates row scope identities while indexing only newly supplied rows. */
export class SsmDataStore {
  private builder = new RegistryBuilder();
  private table?: powerbi.DataViewTable;
  private lastRows?: powerbi.DataViewTableRow[];
  private lastLength = -1;
  private schema = '';
  private revision = 0;
  private initialized = false;

  clear(): void {
    this.builder = new RegistryBuilder(); this.builder.configure([]);
    this.table = undefined; this.lastRows = undefined; this.lastLength = -1;
    this.schema = ''; this.initialized = false;
    this.builder.finalize(false, ++this.revision, false);
  }

  update(dataView?: powerbi.DataView, operationKind?: number): SsmStoreUpdate {
    const source = dataView?.table as SegmentedTable | undefined;
    const rows = source?.rows || [], columns = source?.columns || [];
    const schema = schemaKey(columns), partial = !!dataView?.metadata?.segment;
    const samePayload = this.initialized && rows === this.lastRows && rows.length === this.lastLength && schema === this.schema;
    // An explicit Create denotes a replacement query, including hosts that
    // reuse the table/row objects and mutate cells in place.
    let reset = !this.initialized || schema !== this.schema || operationKind === 0;
    if (!samePayload && !reset) {
      if (operationKind === 1) reset = rows.length < this.builder.graph.rowCount;
      else if (operationKind !== 2) reset = true;
    }
    if (reset) {
      this.builder = new RegistryBuilder();
      this.table = source ? { columns, rows: [], identityFields: source.identityFields } : undefined;
    }
    this.builder.configure(columns);
    let start = 0;
    if (!reset) {
      if (samePayload) start = rows.length;
      else if (operationKind === 1) start = this.builder.graph.rowCount;
      else if (operationKind === 2) {
        const overlap = source?.lastMergeIndex;
        if (typeof overlap === 'number' && Number.isFinite(overlap)) start = Math.min(rows.length, Math.max(0, Math.floor(overlap) + 1));
      }
    }
    const count = rows.length - start;
    const changed = reset || count > 0 || this.builder.graph.partial !== partial;
    if (this.table && source) {
      this.table.columns = columns; this.table.identityFields = source.identityFields;
      if (source.identity && !this.table.identity) this.table.identity = [];
      const loaded = this.table.rows!;
      for (let index = start; index < rows.length; index++) {
        const destination = loaded.length; loaded.push(rows[index]);
        const identity = source.identity?.[index];
        if (identity) this.table.identity![destination] = identity;
      }
      if (source.totals) this.table.totals = source.totals;
    }
    if (count) this.builder.append(rows, start, this.builder.graph.rowCount);
    if (changed) this.builder.finalize(partial, ++this.revision);
    this.schema = schema; this.lastRows = rows; this.lastLength = rows.length; this.initialized = true;
    return { graph: this.builder.graph, table: this.table, changed, reset };
  }
}
