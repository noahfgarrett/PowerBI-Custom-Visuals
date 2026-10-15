import { getGraphIndex } from './graph-index';
import { getNodeStatus, type NodeStatus, type NodeStatusState } from './status';
import type { NodeKind, SsmEdge, SsmGraph, SsmNode } from './types';

export type MilestoneExportReason = 'milestone-equipment' | 'structural-child' | 'dependency' | 'upstream-parent';
export interface MilestoneExportReference {
  nodeKey: string;
  project: string;
  tag: string;
  label: string;
  recordType: NodeKind;
}
export interface MilestoneExportAssignment { l1: MilestoneExportReference; l2: MilestoneExportReference }
export interface MilestoneExportRelationSource {
  reason: MilestoneExportReason;
  from: MilestoneExportReference;
  edgeKey?: string;
  edgeKind?: 'parent' | 'dependency';
}
export interface MilestoneExportRelation {
  edgeKey: string;
  kind: 'parent' | 'dependency';
  from: MilestoneExportReference;
  to: MilestoneExportReference;
}
export interface MilestoneExportRow extends MilestoneExportReference {
  inMilestone: boolean;
  status: NodeStatusState;
  statusLabel: string;
  sourceStatus: string[];
  assignments: MilestoneExportAssignment[];
  reasons: MilestoneExportReason[];
  relationSources: MilestoneExportRelationSource[];
  immediateParents: MilestoneExportReference[];
  dependencies: MilestoneExportReference[];
  notes: string[];
  reviewRequired: boolean;
  reviewFlags: string[];
}
export interface MilestoneExportReport {
  fileName: string;
  milestone: MilestoneExportReference & { parentMilestones: MilestoneExportReference[] };
  rows: MilestoneExportRow[];
  rowCount: number;
  reviewCount: number;
  counts: {
    inMilestone: number;
    external: number;
    notStarted: number;
    inProgress: number;
    completed: number;
    unknown: number;
    conflict: number;
    excludedCompleted: number;
  };
  provenance: {
    sourceRows: number;
    traversedNodes: number;
    allDataReceived: true;
    relations: MilestoneExportRelation[];
  };
}

const exportable = (kind: NodeKind): boolean => kind === 'equipment' || kind === 'header' || kind === 'unresolved';
const text = (value: unknown): string => value instanceof Date ? Number.isFinite(value.getTime()) ? value.toISOString() : String(value) : String(value);
function filenamePart(value: string): string {
  const cleaned = value.normalize('NFKC').replace(/[<>:"/\\|?*\x00-\x1f\x7f.\u202a-\u202e\u2066-\u2069]/g, '_').replace(/\s+/g, ' ').trim().replace(/^[_ ]+|[_ ]+$/g, '');
  return Array.from(cleaned || 'Milestone').slice(0, 60).join('');
}

/** Full-data requirement closure; viewer scope, camera and paging do not participate. */
export function buildMilestoneExport(graph: SsmGraph, l2Key: string): MilestoneExportReport {
  if (graph.partial) throw new Error('Load all available SSM rows before exporting a milestone.');
  if (graph.missingRoles.length) throw new Error(`Required SSM fields are missing: ${graph.missingRoles.join(', ')}.`);
  const milestone = graph.nodes.get(l2Key);
  if (!milestone || milestone.kind !== 'l2') throw new Error('Select a supplied L2 milestone to export.');
  // A shallow carrier allows lazy indexing of external fixtures without modifying the source graph.
  const index = graph.index?.version === graph.revision ? graph.index : getGraphIndex({ ...graph });
  const missing = new Map<string, SsmNode>();
  const nodeFor = (key: string): SsmNode => {
    const supplied = graph.nodes.get(key); if (supplied) return supplied;
    let node = missing.get(key); if (node) return node;
    let project = '', id = key;
    try { const tuple: unknown = JSON.parse(key); if (Array.isArray(tuple) && typeof tuple[1] === 'string' && typeof tuple[2] === 'string') { project = tuple[1]; id = tuple[2]; } } catch { /* Preserve an unresolved key without inventing its project. */ }
    node = { key, project, id, label: id, kind: 'unresolved', discipline: '', milestoneKeys: [], parentMilestoneKeys: [], rowIndices: [], metadata: {}, issues: ['Referenced record is unavailable in the supplied data.'] };
    missing.set(key, node); return node;
  };
  const references = new Map<string, MilestoneExportReference>();
  const reference = (key: string): MilestoneExportReference => {
    let ref = references.get(key); if (ref) return ref;
    const node = nodeFor(key);
    ref = { nodeKey: node.key, project: node.project, tag: node.id, label: node.label, recordType: node.kind };
    references.set(key, ref); return ref;
  };
  const statuses = new Map<string, NodeStatus>();
  const statusFor = (key: string): NodeStatus => {
    let status = statuses.get(key); if (!status) { status = getNodeStatus(graph, nodeFor(key)); statuses.set(key, status); } return status;
  };
  const members = new Set([...(index.membersByMilestone.get(l2Key) ?? [])].filter(key => exportable(nodeFor(key).kind)));
  const reasons = new Map<string, Set<MilestoneExportReason>>();
  const sources = new Map<string, Map<string, MilestoneExportRelationSource>>();
  const traversedRelations = new Map<string, SsmEdge>();
  const record = (target: string, reason: MilestoneExportReason, from: string, edge?: SsmEdge): void => {
    let set = reasons.get(target); if (!set) { set = new Set(); reasons.set(target, set); } set.add(reason);
    let entries = sources.get(target); if (!entries) { entries = new Map(); sources.set(target, entries); }
    const sourceKey = JSON.stringify([reason, from, edge?.key ?? '']);
    entries.set(sourceKey, { reason, from: reference(from), ...(edge ? { edgeKey: edge.key, edgeKind: edge.kind as 'parent' | 'dependency' } : {}) });
    if (edge) traversedRelations.set(edge.key, edge);
  };
  // Requirements descend actual parent links and follow prerequisites. Completed
  // external records are still traversed; their unfinished successors remain reachable.
  const required = new Set(members), queue = [...members];
  for (const member of members) record(member, 'milestone-equipment', l2Key);
  for (let position = 0; position < queue.length; position++) {
    const key = queue[position];
    for (const edge of index.incoming.get(key) ?? []) if (edge.kind === 'parent' && exportable(nodeFor(edge.from).kind)) {
      record(edge.from, 'structural-child', key, edge);
      if (!required.has(edge.from)) { required.add(edge.from); queue.push(edge.from); }
    }
    for (const edge of index.outgoing.get(key) ?? []) if (edge.kind === 'dependency' && exportable(nodeFor(edge.to).kind)) {
      record(edge.to, 'dependency', key, edge);
      if (!required.has(edge.to)) { required.add(edge.to); queue.push(edge.to); }
    }
  }
  // Ancestors use a separate one-way walk. Their other children/dependencies do
  // not become requirements merely because the chain passes through a parent.
  const visited = new Set(required), parents = [...required];
  for (let position = 0; position < parents.length; position++) {
    const key = parents[position];
    for (const edge of index.outgoing.get(key) ?? []) if (edge.kind === 'parent' && exportable(nodeFor(edge.to).kind)) {
      record(edge.to, 'upstream-parent', key, edge);
      if (!visited.has(edge.to)) { visited.add(edge.to); parents.push(edge.to); }
    }
  }
  const included = new Set<string>(); let excludedCompleted = 0;
  for (const key of visited) {
    if (!members.has(key) && statusFor(key).state === 'completed') excludedCompleted++;
    else included.add(key);
  }
  // Invert precise row-evidenced pairs once, storing only output assignments.
  const displayable = (key: string): boolean => !exportable(nodeFor(key).kind) || members.has(key) || statusFor(key).state !== 'completed';
  const assignments = new Map<string, MilestoneExportAssignment[]>();
  for (const [pair, keys] of index.membersByAssignment) {
    let tuple: unknown;
    try { tuple = JSON.parse(pair); } catch { continue; }
    if (!Array.isArray(tuple) || typeof tuple[0] !== 'string' || typeof tuple[1] !== 'string') continue;
    let assignment: MilestoneExportAssignment | undefined;
    for (const key of keys) if (included.has(key)) {
      assignment ??= { l1: reference(tuple[0]), l2: reference(tuple[1]) };
      let pairs = assignments.get(key); if (!pairs) { pairs = []; assignments.set(key, pairs); } pairs.push(assignment);
    }
  }
  const noteFields = graph.fields.filter(field => /\b(?:notes?|comments?)\b/i.test(field.column.displayName));
  const counts = { inMilestone: 0, external: 0, notStarted: 0, inProgress: 0, completed: 0, unknown: 0, conflict: 0, excludedCompleted };
  const rows: MilestoneExportRow[] = [];
  for (const key of included) {
    const node = nodeFor(key), status = statusFor(key), review = new Set(node.issues);
    if (status.state === 'unknown') review.add(status.values.length ? 'Status is not one of Not Started, In Progress or Completed.' : 'No source status is available.');
    if (status.state === 'conflict') review.add('Status values or status bindings conflict; review required.');
    if (node.kind === 'unresolved') review.add('Referenced record is unavailable in the supplied data.');
    if (node.kind === 'header' && !index.suppliedEntityKeys.has(key)) review.add('Header reference has no supplied source record.');
    const immediateParents: MilestoneExportReference[] = [], dependencies: MilestoneExportReference[] = [];
    for (const edge of index.outgoing.get(key) ?? []) {
      if (edge.kind === 'parent' && displayable(edge.to)) immediateParents.push(reference(edge.to));
      if (edge.kind === 'dependency' && displayable(edge.to)) dependencies.push(reference(edge.to));
      if (edge.kind === 'parent' || edge.kind === 'dependency') edge.issues.forEach(issue => review.add(issue));
    }
    const notes = new Set<string>();
    for (const field of noteFields) if (field.kinds.includes(node.kind)) for (const value of node.metadata[field.key] ?? []) if (value !== null && value !== undefined && text(value).trim()) notes.add(text(value));
    const originalSources = [...(sources.get(key)?.values() ?? [])], relationSources = originalSources.filter(source => displayable(source.from.nodeKey));
    if (relationSources.length < originalSources.length || [...(index.outgoing.get(key) ?? [])].some(edge => (edge.kind === 'parent' || edge.kind === 'dependency') && !displayable(edge.to))) notes.add('Completed equipment outside this milestone is omitted from the worklist and reference lists.');
    rows.push({ ...reference(key), inMilestone: members.has(key), status: status.state, statusLabel: status.label, sourceStatus: status.values.slice(), assignments: assignments.get(key) ?? [], reasons: [...(reasons.get(key) ?? [])], relationSources, immediateParents, dependencies, notes: [...notes], reviewRequired: review.size > 0, reviewFlags: [...review] });
    if (members.has(key)) counts.inMilestone++; else counts.external++;
    if (status.state === 'not-started') counts.notStarted++; else if (status.state === 'in-progress') counts.inProgress++; else if (status.state === 'completed') counts.completed++; else counts[status.state]++;
  }
  return {
    fileName: `SSM_${filenamePart(milestone.project)}_${filenamePart(milestone.label || milestone.id)}_requirements.xlsx`,
    milestone: { ...reference(l2Key), parentMilestones: [...(index.outgoing.get(l2Key) ?? [])].filter(edge => edge.kind === 'hierarchy').map(edge => reference(edge.to)) },
    rows, rowCount: rows.length, reviewCount: rows.filter(row => row.reviewRequired).length, counts,
    provenance: { sourceRows: graph.rowCount, traversedNodes: visited.size, allDataReceived: true, relations: [...traversedRelations.values()].filter(edge => displayable(edge.from) && displayable(edge.to)).map(edge => ({ edgeKey: edge.key, kind: edge.kind as 'parent' | 'dependency', from: reference(edge.from), to: reference(edge.to) })) },
  };
}
