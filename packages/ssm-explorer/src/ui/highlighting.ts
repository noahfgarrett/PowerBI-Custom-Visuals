import type powerbi from 'powerbi-visuals-api';
import type { DetailField, SsmGraph } from '../types';

export interface HighlightField {
  /** Author setting identity, independent of labels and current column order. */
  key: string;
  label: string;
  source: 'discipline' | 'metadata';
  metadataKey?: string;
}

export interface HighlightValue {
  key: string;
  label: string;
  value: powerbi.PrimitiveValue;
  /** Distinct physical equipment, never repeated registry rows. */
  count: number;
}

export interface HighlightIndex {
  revision: number;
  fieldKey: string;
  values: HighlightValue[];
  keysByValue: Map<string, Set<string>>;
  valueKeysByNode: Map<string, string[]>;
  conflictingNodeKeys: Set<string>;
  missingNodeKeys: Set<string>;
}

export const DISCIPLINE_HIGHLIGHT_KEY = JSON.stringify(['discipline']);
const disciplineField = (): HighlightField => ({ key: DISCIPLINE_HIGHLIGHT_KEY, label: 'Discipline', source: 'discipline' });

/** Drawer visibility never controls whether an author may purposefully use a bound field. */
export function getHighlightFields(fields: readonly DetailField[]): HighlightField[] {
  const choices = new Map<string, HighlightField>();
  for (const field of fields) if (field.kinds.includes('equipment')) {
    const key = JSON.stringify(['metadata', field.key]);
    if (!choices.has(key)) choices.set(key, { key, label: field.label, source: 'metadata', metadataKey: field.key });
  }
  const result = [disciplineField(), ...choices.values()];
  const counts = new Map<string, number>();
  for (const field of result) counts.set(field.label, (counts.get(field.label) ?? 0) + 1);
  for (const field of result) if (field.source === 'metadata' && counts.get(field.label)! > 1) field.label += ` · ${field.metadataKey}`;
  return result;
}

/** A removed or invalid author selection returns to the known Discipline default. */
export function resolveHighlightField(fields: readonly HighlightField[], key?: unknown): HighlightField {
  return fields.find(field => field.key === key) ?? fields.find(field => field.source === 'discipline') ?? disciplineField();
}

/** Typed identities do not conflate 0, false, '0', or a date with its printed text. */
export function highlightValueKey(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? JSON.stringify(['date', value.getTime()]) : null;
  if (typeof value === 'number') return Number.isFinite(value) ? JSON.stringify(['number', value]) : null;
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify([typeof value, value]);
  return null;
}

const cache = new WeakMap<SsmGraph, Map<string, HighlightIndex>>();
const compareLabels = new Intl.Collator('en', { numeric: true, sensitivity: 'variant' });
const valueType = (value: powerbi.PrimitiveValue): string => value instanceof Date ? 'date' : typeof value;

/** Built once per graph revision and field, so camera movement never scans registry metadata. */
export function getHighlightIndex(graph: SsmGraph, field: HighlightField): HighlightIndex {
  let graphCache = cache.get(graph);
  if (!graphCache) { graphCache = new Map(); cache.set(graph, graphCache); }
  const previous = graphCache.get(field.key);
  if (previous?.revision === graph.revision) {
    graphCache.delete(field.key); graphCache.set(field.key, previous);
    return previous;
  }
  // Discard old revisions and keep at most two recently used field indexes.
  for (const [key, index] of graphCache) if (index.revision !== graph.revision) graphCache.delete(key);
  const keysByValue = new Map<string, Set<string>>(), valueKeysByNode = new Map<string, string[]>();
  const conflictingNodeKeys = new Set<string>(), missingNodeKeys = new Set<string>();
  const originalValues = new Map<string, powerbi.PrimitiveValue>();
  for (const node of graph.nodes.values()) {
    if (node.kind !== 'equipment') continue;
    const values: readonly unknown[] = field.source === 'discipline' ? node.disciplines ?? [node.discipline] : node.metadata[field.metadataKey ?? ''] ?? [];
    const nodeKeys = new Set<string>();
    for (const value of values) {
      const key = highlightValueKey(value); if (key === null || nodeKeys.has(key)) continue;
      nodeKeys.add(key);
      if (!originalValues.has(key)) originalValues.set(key, value as powerbi.PrimitiveValue);
      let equipment = keysByValue.get(key);
      if (!equipment) { equipment = new Set(); keysByValue.set(key, equipment); }
      equipment.add(node.key);
    }
    valueKeysByNode.set(node.key, [...nodeKeys]);
    if (nodeKeys.size > 1) conflictingNodeKeys.add(node.key);
    if (!nodeKeys.size) missingNodeKeys.add(node.key);
  }
  const values: HighlightValue[] = [...originalValues].map(([key, value]) => ({
    key, value, label: value instanceof Date ? value.toISOString() : String(value), count: keysByValue.get(key)!.size,
  }));
  const labels = new Map<string, number>();
  for (const value of values) labels.set(value.label, (labels.get(value.label) ?? 0) + 1);
  for (const value of values) if (labels.get(value.label)! > 1) value.label += ` (${valueType(value.value)})`;
  values.sort((a, b) => compareLabels.compare(a.label, b.label) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const index = { revision: graph.revision, fieldKey: field.key, values, keysByValue, valueKeysByNode, conflictingNodeKeys, missingNodeKeys };
  if (graphCache.size >= 2) graphCache.delete(graphCache.keys().next().value!);
  graphCache.set(field.key, index);
  return index;
}

/** Multi-value viewer selection is OR matching against the original source values. */
export function highlightMatches(index: HighlightIndex, nodeKey: string, selected: ReadonlySet<string>): boolean {
  if (!selected.size) return false;
  return (index.valueKeysByNode.get(nodeKey) ?? []).some(key => selected.has(key));
}
