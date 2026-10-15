import type powerbi from 'powerbi-visuals-api';
import type { EdgeKind, ScopeFilters, SsmGraph, SsmProjection } from './types';
import { assignmentKey, getGraphIndex } from './graph-index';
import { SsmDataStore } from './data-store';

export { nodeKey } from './registry-builder';
export { assignmentKey, getGraphIndex } from './graph-index';
export { SsmDataStore } from './data-store';

/** Compatibility parser for a complete host snapshot. Streaming callers keep a SsmDataStore instance. */
export function parseDataView(dataView?: powerbi.DataView): SsmGraph { return new SsmDataStore().update(dataView, 0).graph; }

/** Traverse indexed adjacency without constructing a second adjacency graph. */
export function walkConnections(graph: SsmGraph, startKeys: string[], kinds: EdgeKind[], direction: 'out' | 'in' | 'both' = 'out'): Set<string> {
  const index = getGraphIndex(graph), allowed = new Set(kinds);
  const visited = new Set(startKeys.filter(key => graph.nodes.has(key))), queue = [...visited];
  for (let offset = 0; offset < queue.length; offset++) {
    const key = queue[offset];
    const visit = (edges?: Set<import('./types').SsmEdge>, incoming = false): void => {
      if (!edges) return;
      for (const edge of edges) {
        if (!allowed.has(edge.kind)) continue;
        const next = incoming ? edge.from : edge.to;
        if (!visited.has(next) && graph.nodes.has(next)) { visited.add(next); queue.push(next); }
      }
    };
    if (direction !== 'in') visit(index.outgoing.get(key));
    if (direction !== 'out') visit(index.incoming.get(key), true);
  }
  return visited;
}

/** Scope changes visibility, never ownership. Use the smallest available indexed cohort. */
export function projectGraph(graph: SsmGraph, filters: ScopeFilters): SsmProjection {
  const index = getGraphIndex(graph), selectedProjects = filters.projects === null ? null : new Set(filters.projects);
  if (filters.projects === null && !filters.discipline && !filters.l1Key && !filters.l2Key && filters.includeContext && filters.showParents && filters.showDependencies) {
    // All supplied equipment is already in scope. No traversal or edge scan is
    // needed to rediscover a graph whose references were built from these rows.
    const primaryKeys = new Set(index.suppliedEntityKeys), contextKeys = new Set<string>();
    const headerKeys = new Set(index.nodesByKind.get('header') || []);
    for (const key of headerKeys) if (!primaryKeys.has(key)) contextKeys.add(key);
    for (const key of index.nodesByKind.get('unresolved') || []) contextKeys.add(key);
    return { nodes: [...graph.nodes.values()], edges: graph.edges, primaryKeys, contextKeys, headerKeys, totalEquipment: index.physicalEquipmentKeys.size };
  }
  const pairMembers = filters.l1Key && filters.l2Key ? index.membersByAssignment.get(assignmentKey(filters.l1Key, filters.l2Key)) || new Set<string>() : null;
  const candidates: Set<string>[] = [index.suppliedEntityKeys];
  if (pairMembers) candidates.push(pairMembers);
  if (filters.discipline) candidates.push(index.equipmentByDiscipline.get(filters.discipline) || new Set());
  if (filters.l1Key) candidates.push(index.membersByParentMilestone.get(filters.l1Key) || new Set());
  if (filters.l2Key) candidates.push(index.membersByMilestone.get(filters.l2Key) || new Set());
  if (selectedProjects?.size === 1) candidates.push(index.nodesByProject.get(selectedProjects.values().next().value!) || new Set());
  if (selectedProjects?.size === 0) candidates.push(new Set());
  const smallest = candidates.reduce((a, b) => a.size <= b.size ? a : b), primaryKeys = new Set<string>();
  let totalEquipment = 0;
  for (const key of smallest) {
    const node = graph.nodes.get(key)!;
    if (!index.suppliedEntityKeys.has(key)) continue;
    if (pairMembers && !pairMembers.has(key)) continue;
    if (selectedProjects && !selectedProjects.has(node.project)) continue;
    if (filters.discipline && !(node.disciplines || [node.discipline]).includes(filters.discipline)) continue;
    if (filters.l1Key && !node.parentMilestoneKeys.includes(filters.l1Key)) continue;
    if (filters.l2Key && !node.milestoneKeys.includes(filters.l2Key)) continue;
    primaryKeys.add(key); if (node.kind === 'equipment') totalEquipment++;
  }
  const kinds: EdgeKind[] = [];
  if (filters.showParents) kinds.push('parent'); if (filters.showDependencies) kinds.push('dependency');
  const connected = filters.includeContext ? walkConnections(graph, [...primaryKeys], kinds) : new Set(primaryKeys);
  const included = walkConnections(graph, [...connected], ['membership', 'hierarchy']);
  const contextKeys = new Set<string>(), headerKeys = new Set<string>();
  for (const key of connected) if (!primaryKeys.has(key)) contextKeys.add(key);
  const nodes = [...included].map(key => graph.nodes.get(key)!);
  for (const node of nodes) if (node.kind === 'header') headerKeys.add(node.key);
  const allowed = new Set<EdgeKind>(['hierarchy', 'membership', ...kinds]), edges: import('./types').SsmEdge[] = [];
  for (const key of included) for (const edge of index.outgoing.get(key) || []) if (allowed.has(edge.kind) && included.has(edge.to)) edges.push(edge);
  return { nodes, edges, primaryKeys, contextKeys, headerKeys, totalEquipment };
}
