import type { DetailField, SsmGraph, SsmNode } from './types';

export type NodeStatusState = 'not-started' | 'in-progress' | 'completed' | 'unknown' | 'conflict';
export interface NodeStatus {
  state: NodeStatusState;
  label: string;
  /** Distinct original nonblank source values, never a derived completion claim. */
  values: string[];
}
interface StatusBinding { keys: string[]; ambiguous: boolean; explicit: boolean }
interface BindingCache { revision: number; fields: DetailField[]; binding: StatusBinding }
const cache = new WeakMap<SsmGraph, BindingCache>();
const normalized = (value: string): string => value.trim().replace(/\s+/g, ' ').toLowerCase();
const labels: Record<string, { state: NodeStatusState; label: string }> = {
  'not started': { state: 'not-started', label: 'Not Started' },
  'in progress': { state: 'in-progress', label: 'In Progress' },
  completed: { state: 'completed', label: 'Completed' },
};

function statusBinding(graph: SsmGraph): StatusBinding {
  const previous = cache.get(graph);
  const fields = graph.fields;
  if (previous?.revision === graph.revision && previous.fields === fields) return previous.binding;
  const explicit = new Set<string>(), fallback = new Set<string>();
  for (const field of fields) {
    if (!field.kinds.includes('equipment') && !field.kinds.includes('header')) continue;
    if (field.column.roles?.status) explicit.add(field.key);
    else if (field.column.roles?.nodeDetail && normalized(field.column.displayName) === 'status') fallback.add(field.key);
  }
  const keys = [...(explicit.size ? explicit : fallback)];
  const binding = { keys, ambiguous: keys.length > 1, explicit: explicit.size > 0 };
  cache.set(graph, { revision: graph.revision, fields, binding });
  return binding;
}

/** A missing or ambiguous legacy field must not silently enable status coloring. */
export function hasStatusBinding(graph: SsmGraph): boolean {
  const binding = statusBinding(graph);
  return binding.keys.length > 0 && (binding.explicit || !binding.ambiguous);
}

/** Status colors and exports reflect equipment source metadata, never milestone rollups. */
export function getNodeStatus(graph: SsmGraph, node: SsmNode): NodeStatus {
  if (node.kind !== 'equipment' && node.kind !== 'header') return { state: 'unknown', label: 'Unknown status', values: [] };
  const binding = statusBinding(graph), values: string[] = [], seen = new Set<string>();
  for (const key of binding.keys) for (const value of node.metadata[key] ?? []) {
    if (value === null || value === undefined) continue;
    const original = value instanceof Date && Number.isFinite(value.getTime()) ? value.toISOString() : String(value);
    if (!normalized(original) || seen.has(original)) continue;
    seen.add(original); values.push(original);
  }
  const distinct = new Set(values.map(normalized));
  if (binding.ambiguous) return { state: 'conflict', label: 'Conflict', values };
  if (distinct.size > 1) return { state: 'conflict', label: 'Conflict', values };
  const value = distinct.values().next().value as string | undefined;
  // Only the three exact normalized labels are recognized. Prototype names and
  // arbitrary source strings cannot become status definitions.
  const status = value !== undefined && Object.prototype.hasOwnProperty.call(labels, value) ? labels[value] : undefined;
  return status ? { ...status, values } : { state: 'unknown', label: values.length ? 'Unknown status' : 'No status', values };
}
