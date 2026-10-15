import { describe, expect, it } from 'vitest';
import type powerbi from 'powerbi-visuals-api';
import { nodeKey, parseDataView } from '../model';
import { buildEquipmentTree } from '../ui/equipment-tree';
import type { SsmGraph, SsmNode } from '../types';

const roles = ['project', 'equipmentId', 'nodeType', 'milestone', 'parentMilestone', 'closestParent', 'closestParentProject', 'dependencies'];
type SourceRow = Record<string, string>;
const source = (id: string, values: SourceRow = {}): SourceRow => ({ project: 'Alpha', equipmentId: id, milestone: 'L2-A', parentMilestone: 'L1-A', ...values });
function graphFor(records: SourceRow[]): SsmGraph {
  const columns: powerbi.DataViewMetadataColumn[] = roles.map(role => ({ displayName: role, queryName: role, roles: { [role]: true } }));
  return parseDataView({ metadata: { columns }, table: { columns, rows: records.map(record => roles.map(role => record[role] || '')) } });
}
const node = (graph: SsmGraph, id: string, project = 'Alpha'): SsmNode => graph.nodes.get(nodeKey('equipment', project, id))!;
const allKeys = (graph: SsmGraph): Set<string> => new Set(graph.nodes.keys());

describe('equipment structural forest', () => {
  it('puts a non-lexical parent before its children and never indents dependencies', () => {
    const graph = graphFor([source('A-CHILD', { closestParent: 'Z-ROOT', dependencies: 'B-DEPENDENCY' }), source('Z-ROOT'), source('B-DEPENDENCY')]);
    const tree = buildEquipmentTree(graph, [node(graph, 'A-CHILD'), node(graph, 'Z-ROOT'), node(graph, 'B-DEPENDENCY')]);
    expect(tree.indexByKey.get(node(graph, 'Z-ROOT').key)).toBeLessThan(tree.indexByKey.get(node(graph, 'A-CHILD').key)!);
    expect(tree.rowByKey.get(node(graph, 'A-CHILD').key)!.depth).toBe(1);
    expect(tree.rowByKey.get(node(graph, 'A-CHILD').key)!.structuralParentKey).toBe(node(graph, 'Z-ROOT').key);
    expect(tree.rowByKey.get(node(graph, 'B-DEPENDENCY').key)!.structuralParentKey).toBeNull();
    expect(tree.ancestorPath(node(graph, 'A-CHILD').key)).toEqual([node(graph, 'Z-ROOT').key, node(graph, 'A-CHILD').key]);
    expect(tree.roots).toEqual([node(graph, 'B-DEPENDENCY').key, node(graph, 'Z-ROOT').key]);
    expect(tree.childrenByKey.get(node(graph, 'Z-ROOT').key)).toEqual([node(graph, 'A-CHILD').key]);
    expect(tree.childrenByKey.has(node(graph, 'B-DEPENDENCY').key)).toBe(false);
    expect(tree.rowByKey.get(node(graph, 'A-CHILD').key)!.actualParentEdgeKeys).toHaveLength(1);
  });

  it('adds a permitted organizational header before children without counting it as a member', () => {
    const graph = graphFor([source('A-CHILD', { closestParent: 'ORGANIZATION' }), source('ORGANIZATION', { nodeType: 'header' })]);
    const tree = buildEquipmentTree(graph, [node(graph, 'A-CHILD')], { includeContext: true, includedKeys: allKeys(graph) });
    expect(tree.rows.map(row => row.nodeKey)).toEqual([nodeKey('header', 'Alpha', 'ORGANIZATION'), node(graph, 'A-CHILD').key]);
    expect(tree.rows[0].context).toBe(true); expect(tree.rows[0].hasChildren).toBe(true);
    expect(tree.roots).toEqual([nodeKey('header', 'Alpha', 'ORGANIZATION')]);
    expect(tree.childrenByKey.get(tree.roots[0])).toEqual([node(graph, 'A-CHILD').key]);
    expect(tree.memberRows).toHaveLength(1); expect(tree.memberIndexByKey.get(node(graph, 'A-CHILD').key)).toBe(0);
    expect(tree.indexByKey.get(node(graph, 'A-CHILD').key)).toBe(1);
  });

  it('allows only scoped context and retains outside/missing actual parent references', () => {
    const graph = graphFor([source('CHILD', { closestParent: 'PARENT' }), source('PARENT', { milestone: 'L2-B' }), source('OTHER')]);
    const before = graph.nodes.get(node(graph, 'CHILD').key)!.milestoneKeys.slice();
    const noContext = buildEquipmentTree(graph, [node(graph, 'CHILD')], { includeContext: false, includedKeys: allKeys(graph) });
    expect(noContext.rows).toHaveLength(1); expect(noContext.rows[0].structuralParentKey).toBeNull();
    expect(noContext.rows[0].candidateParentKeys).toEqual([node(graph, 'PARENT').key]);
    const denied = buildEquipmentTree(graph, [node(graph, 'CHILD')], { includeContext: true, includedKeys: new Set([node(graph, 'CHILD').key]) });
    expect(denied.rows).toHaveLength(1);
    const allowed = buildEquipmentTree(graph, [node(graph, 'CHILD')], { includeContext: true, includedKeys: allKeys(graph) });
    expect(allowed.rows[0].nodeKey).toBe(node(graph, 'PARENT').key); expect(allowed.rows[0].context).toBe(true);
    expect(graph.nodes.get(node(graph, 'CHILD').key)!.milestoneKeys).toEqual(before);
    const filtered = buildEquipmentTree(graph, [node(graph, 'CHILD'), node(graph, 'OTHER')], { includedKeys: new Set([node(graph, 'CHILD').key]) });
    expect(filtered.memberRows).toHaveLength(1);
  });

  it('keeps unavailable references inspectable without inventing parent nodes or edges', () => {
    const graph = graphFor([source('CHILD', { closestParent: 'UNAVAILABLE' })]);
    const unresolved = nodeKey('unresolved', 'Alpha', 'UNAVAILABLE');
    const context = buildEquipmentTree(graph, [node(graph, 'CHILD')], { includeContext: true, includedKeys: allKeys(graph) });
    expect(context.rows[0].nodeKey).toBe(unresolved); expect(context.rows[0].context).toBe(true);
    expect(context.roots).toEqual([unresolved]);
    expect(context.childrenByKey.get(unresolved)).toEqual([node(graph, 'CHILD').key]);
    expect(context.rows[1].depth).toBe(1);
    graph.nodes.delete(unresolved); const beforeNodes = graph.nodes.size, beforeEdges = graph.edges.length;
    const missing = buildEquipmentTree(graph, [node(graph, 'CHILD')], { includeContext: true });
    expect(missing.rows).toHaveLength(1); expect(missing.rows[0].issues.join(' ')).toMatch(/unavailable/);
    expect(missing.rows[0].structuralEdgeKey).toBeNull(); expect(missing.rows[0].actualParentEdgeKeys).toHaveLength(1);
    expect(graph.nodes.size).toBe(beforeNodes); expect(graph.edges.length).toBe(beforeEdges);
  });

  it('retains exact cross-project parent identity without matching a same-named local tag', () => {
    const graph = graphFor([source('CHILD', { closestParent: 'MATCH', closestParentProject: 'Beta' }), source('MATCH'), source('MATCH', { project: 'Beta' })]);
    const tree = buildEquipmentTree(graph, [node(graph, 'CHILD')], { includeContext: true, includedKeys: allKeys(graph) });
    expect(tree.rows.map(row => row.nodeKey)).toEqual([node(graph, 'MATCH', 'Beta').key, node(graph, 'CHILD').key]);
    expect(tree.rowByKey.has(node(graph, 'MATCH').key)).toBe(false);
  });

  it('chooses deterministic placement for conflicting parents while retaining both actual edges', () => {
    const graph = graphFor([source('CHILD', { closestParent: 'P-Z' }), source('CHILD', { closestParent: 'P-A' }), source('P-Z'), source('P-A')]);
    const members = [node(graph, 'CHILD'), node(graph, 'P-Z')];
    const first = buildEquipmentTree(graph, members, { includeContext: true, includedKeys: allKeys(graph) });
    const second = buildEquipmentTree(graph, members.slice().reverse(), { includeContext: true, includedKeys: allKeys(graph) });
    const child = first.rowByKey.get(node(graph, 'CHILD').key)!;
    expect(child.structuralParentKey).toBe(node(graph, 'P-Z').key); // A real parent in the original cohort takes display precedence.
    expect(child.actualParentEdgeKeys).toHaveLength(2); expect(child.candidateParentKeys).toHaveLength(2);
    expect(child.issues.join(' ')).toMatch(/Multiple closest parents/);
    expect(graph.edges.find(edge => edge.key === child.structuralEdgeKey)?.to).toBe(child.structuralParentKey);
    expect(first.rows.map(row => row.nodeKey)).toEqual(second.rows.map(row => row.nodeKey));
  });

  it('cuts multi-node and self cycles only in the display forest, emitting each member once', () => {
    const graph = graphFor([source('A', { closestParent: 'B' }), source('B', { closestParent: 'A' }), source('SELF', { closestParent: 'SELF' })]);
    const edgeKeys = graph.edges.map(edge => edge.key), members = [node(graph, 'B'), node(graph, 'A'), node(graph, 'SELF')];
    const tree = buildEquipmentTree(graph, members);
    expect(tree.rows).toHaveLength(3); expect(new Set(tree.rows.map(row => row.nodeKey)).size).toBe(3);
    const root = tree.rowByKey.get(node(graph, 'A').key)!;
    expect(root.cycleBreak).toBe(true); expect(root.structuralParentKey).toBeNull(); expect(root.structuralEdgeKey).toBeNull();
    expect(root.actualParentEdgeKeys).toHaveLength(1); expect(root.candidateParentKeys).toEqual([node(graph, 'B').key]);
    expect(tree.rowByKey.get(node(graph, 'SELF').key)!.cycleBreak).toBe(true);
    expect(tree.roots).toEqual([node(graph, 'A').key, node(graph, 'SELF').key]);
    expect(tree.childrenByKey.get(node(graph, 'A').key)).toEqual([node(graph, 'B').key]);
    expect(tree.childrenByKey.has(node(graph, 'B').key)).toBe(false);
    expect(tree.childrenByKey.has(node(graph, 'SELF').key)).toBe(false);
    expect(tree.ancestorPath(node(graph, 'B').key)).toEqual([node(graph, 'A').key, node(graph, 'B').key]);
    expect(graph.edges.map(edge => edge.key)).toEqual(edgeKeys);
  });

  it('carries previous-page parents as context and gives member-order search positions', () => {
    const graph = graphFor([source('Z-ROOT'), ...Array.from({ length: 80 }, (_, index) => source('A-CHILD-' + index, { closestParent: 'Z-ROOT' }))]);
    const members = [...graph.nodes.values()].filter(node => node.kind === 'equipment'), complete = buildEquipmentTree(graph, members);
    expect(complete.memberRows[0].nodeKey).toBe(node(graph, 'Z-ROOT').key);
    const selected = node(graph, 'A-CHILD-35').key, position = complete.memberIndexByKey.get(selected)!;
    expect(complete.childrenByKey.get(node(graph, 'Z-ROOT').key)!.indexOf(selected)).toBe(35);
    const page = complete.memberRows.slice(Math.floor(position / 30) * 30, Math.floor(position / 30) * 30 + 30).map(row => graph.nodes.get(row.nodeKey)!);
    const paged = buildEquipmentTree(graph, page, { includeContext: true, includedKeys: allKeys(graph) });
    expect(paged.rows[0].nodeKey).toBe(node(graph, 'Z-ROOT').key); expect(paged.rows[0].context).toBe(true);
    expect(paged.memberRows).toHaveLength(30); expect(paged.rowByKey.has(selected)).toBe(true);
    expect(paged.ancestorPath(selected)).toEqual([node(graph, 'Z-ROOT').key, selected]);
  });

  it('handles a 10,000-level chain iteratively without storing ancestor arrays per node', () => {
    const records = Array.from({ length: 10000 }, (_, index) => source('EQ-' + index, { closestParent: index < 9999 ? 'EQ-' + (index + 1) : '' }));
    const graph = graphFor(records), members = [...graph.nodes.values()].filter(node => node.kind === 'equipment');
    const tree = buildEquipmentTree(graph, members);
    expect(tree.rows).toHaveLength(10000); expect(tree.rows[0].nodeKey).toBe(node(graph, 'EQ-9999').key);
    expect(tree.rowByKey.get(node(graph, 'EQ-0').key)!.depth).toBe(9999);
    expect(tree.ancestorPath(node(graph, 'EQ-0').key)).toHaveLength(10000);
    expect(tree.memberIndexByKey.get(node(graph, 'EQ-0').key)).toBe(9999);
    expect(tree.rowByKey.get(node(graph, 'EQ-0').key)).not.toHaveProperty('ancestorPath');
    const stack = tree.roots.slice().reverse(), traversed: string[] = [];
    while (stack.length) { const key = stack.pop()!; traversed.push(key); for (const child of (tree.childrenByKey.get(key) ?? []).slice().reverse()) stack.push(child); }
    expect(traversed).toEqual(tree.rows.map(row => row.nodeKey));
  });

  it('uses missing or stale indexes only through a local fallback and does not mutate graph state', () => {
    const graph = graphFor([source('CHILD', { closestParent: 'ROOT' }), source('ROOT')]);
    const members = [node(graph, 'CHILD'), node(graph, 'ROOT')], initial = graph.index!;
    const before = JSON.stringify({ nodes: [...graph.nodes.values()], edges: graph.edges });
    graph.index = undefined; const missing = buildEquipmentTree(graph, members);
    expect(graph.index).toBeUndefined(); expect(missing.ancestorPath(node(graph, 'CHILD').key)).toEqual([node(graph, 'ROOT').key, node(graph, 'CHILD').key]);
    graph.index = { ...initial, version: graph.revision - 1, outgoing: new Map() };
    const stale = graph.index, restored = buildEquipmentTree(graph, members);
    expect(graph.index).toBe(stale); expect(graph.index.version).toBe(graph.revision - 1);
    expect(restored.rows.map(row => row.nodeKey)).toEqual(missing.rows.map(row => row.nodeKey));
    expect(JSON.stringify({ nodes: [...graph.nodes.values()], edges: graph.edges })).toBe(before);
  });
});
