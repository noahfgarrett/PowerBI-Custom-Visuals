import type { SsmGraph, SsmGraphIndex, SsmNode, SsmEdge } from './types';

export const assignmentKey = (l1Key: string, l2Key: string): string => JSON.stringify([l1Key, l2Key]);

function add<T>(map: Map<string, Set<T>>, key: string, value: T): void {
  let values = map.get(key);
  if (!values) { values = new Set<T>(); map.set(key, values); }
  values.add(value);
}

function remove<T>(map: Map<string, Set<T>>, key: string, value: T): void {
  const values = map.get(key);
  values?.delete(value);
  if (!values?.size) map.delete(key);
}

export function createGraphIndex(): SsmGraphIndex {
  return {
    version: 0, nodesByProject: new Map(), nodesByKind: new Map(), suppliedEntityKeys: new Set(), physicalEquipmentKeys: new Set(),
    equipmentByDiscipline: new Map(), membersByMilestone: new Map(), membersByParentMilestone: new Map(), membersByAssignment: new Map(),
    milestonesByParent: new Map(), outgoing: new Map(), incoming: new Map(),
  };
}

export function indexNode(index: SsmGraphIndex, node: SsmNode): void {
  add(index.nodesByProject, node.project, node.key);
  add(index.nodesByKind, node.kind, node.key);
  if ((node.kind === 'equipment' || node.kind === 'header') && node.rowIndices.length) {
    index.suppliedEntityKeys.add(node.key);
    if (node.kind === 'equipment') index.physicalEquipmentKeys.add(node.key);
    for (const discipline of node.disciplines || [node.discipline]) if (discipline) add(index.equipmentByDiscipline, discipline, node.key);
    for (const parent of node.parentMilestoneKeys) add(index.membersByParentMilestone, parent, node.key);
  }
}

/** Append the current row's attributes without revisiting its earlier assignments. */
export function indexSuppliedRow(index: SsmGraphIndex, node: SsmNode, discipline: string, parentMilestone: string, milestone: string): void {
  index.suppliedEntityKeys.add(node.key);
  if (node.kind === 'equipment') index.physicalEquipmentKeys.add(node.key);
  if (discipline) add(index.equipmentByDiscipline, discipline, node.key);
  add(index.membersByParentMilestone, parentMilestone, node.key);
  add(index.membersByAssignment, assignmentKey(parentMilestone, milestone), node.key);
}

export function unindexNode(index: SsmGraphIndex, node: SsmNode): void {
  remove(index.nodesByProject, node.project, node.key); remove(index.nodesByKind, node.kind, node.key);
  index.suppliedEntityKeys.delete(node.key);
  index.physicalEquipmentKeys.delete(node.key);
  for (const discipline of node.disciplines || [node.discipline]) remove(index.equipmentByDiscipline, discipline, node.key);
  for (const parent of node.parentMilestoneKeys) remove(index.membersByParentMilestone, parent, node.key);
  index.outgoing.delete(node.key); index.incoming.delete(node.key);
}

export function indexEdge(index: SsmGraphIndex, edge: SsmEdge): void {
  add(index.outgoing, edge.from, edge); add(index.incoming, edge.to, edge);
  if (edge.kind === 'membership') add(index.membersByMilestone, edge.to, edge.from);
  if (edge.kind === 'hierarchy') add(index.milestonesByParent, edge.to, edge.from);
}

export function unindexEdge(index: SsmGraphIndex, edge: SsmEdge): void {
  remove(index.outgoing, edge.from, edge); remove(index.incoming, edge.to, edge);
  if (edge.kind === 'membership') remove(index.membersByMilestone, edge.to, edge.from);
  if (edge.kind === 'hierarchy') remove(index.milestonesByParent, edge.to, edge.from);
}

/** Indexes are maintained during ingestion; external graph fixtures receive a lazy index. */
export function getGraphIndex(graph: SsmGraph): SsmGraphIndex {
  if (!graph.index || graph.index.version !== graph.revision) {
    const index = createGraphIndex();
    for (const node of graph.nodes.values()) indexNode(index, node);
    for (const edge of graph.edges) indexEdge(index, edge);
    // A pair is evidenced by the same source row on membership and hierarchy
    // edges. Independent node arrays would invent Cartesian assignments when
    // one L2 has several conflicting L1 parents.
    const rowParentsByMilestone = new Map<string, Map<number, string | Set<string>>>();
    for (const edge of graph.edges) if (edge.kind === 'hierarchy') {
      let rows = rowParentsByMilestone.get(edge.from);
      if (!rows) { rows = new Map(); rowParentsByMilestone.set(edge.from, rows); }
      for (const row of edge.rowIndices) {
        const current = rows.get(row);
        if (current === undefined) rows.set(row, edge.to);
        else if (typeof current === 'string' && current !== edge.to) rows.set(row, new Set([current, edge.to]));
        else if (current instanceof Set) current.add(edge.to);
      }
    }
    for (const edge of graph.edges) if (edge.kind === 'membership') {
      const rows = rowParentsByMilestone.get(edge.to);
      if (!rows) continue;
      for (const row of edge.rowIndices) {
        const parents = rows.get(row);
        if (typeof parents === 'string') add(index.membersByAssignment, assignmentKey(parents, edge.to), edge.from);
        else if (parents) for (const parent of parents) add(index.membersByAssignment, assignmentKey(parent, edge.to), edge.from);
      }
    }
    index.version = graph.revision; graph.index = index;
  }
  return graph.index;
}
