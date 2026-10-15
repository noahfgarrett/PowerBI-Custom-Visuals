import type { SsmEdge, SsmGraph, SsmNode } from '../types';

export interface EquipmentTreeOptions {
  /** Constrains both supplied members and any additional ancestors. */
  includedKeys?: ReadonlySet<string>;
  /** Extra parents are display context, never added milestone assignments. */
  includeContext?: boolean;
}

export interface EquipmentTreeRow {
  nodeKey: string;
  /** A source parent edge used for this display placement; null at a root/cycle cut. */
  structuralParentKey: string | null;
  structuralEdgeKey: string | null;
  candidateParentKeys: string[];
  actualParentEdgeKeys: string[];
  depth: number;
  hasChildren: boolean;
  context: boolean;
  cycleBreak: boolean;
  issues: string[];
}

export interface EquipmentTree {
  /** Deterministic canonical display roots, including permitted ancestor context. */
  roots: string[];
  /** Direct display children only; source relationships remain on each row. */
  childrenByKey: Map<string, string[]>;
  rows: EquipmentTreeRow[];
  rowByKey: Map<string, EquipmentTreeRow>;
  indexByKey: Map<string, number>;
  /** Member-only preorder supports paging without counting ancestor context. */
  memberRows: EquipmentTreeRow[];
  memberIndexByKey: Map<string, number>;
  /** Root through selected node, computed on demand to avoid quadratic storage. */
  ancestorPath(nodeKey: string): string[];
}

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'variant' });
const ordinal = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const equipmentKind = (node: SsmNode): boolean => node.kind === 'equipment' || node.kind === 'header' || node.kind === 'unresolved';

/** Pure deterministic forest. A display choice never resolves or replaces source graph relationships. */
export function buildEquipmentTree(graph: SsmGraph, members: readonly SsmNode[], options: EquipmentTreeOptions = {}): EquipmentTree {
  const nodes = new Map<string, SsmNode>(), memberKeys = new Set<string>();
  for (const node of members) {
    if (!graph.nodes.has(node.key) || !equipmentKind(node) || options.includedKeys && !options.includedKeys.has(node.key)) continue;
    nodes.set(node.key, node); memberKeys.add(node.key);
  }
  const compare = (a: string, b: string): number => collator.compare(nodes.get(a)?.id || a, nodes.get(b)?.id || b) || ordinal(a, b);
  // Read an existing index only. Building a local fallback preserves purity for external graph fixtures.
  const outgoing = graph.index && graph.index.version === graph.revision ? graph.index.outgoing : undefined;
  const fallback = new Map<string, SsmEdge[]>();
  if (!outgoing) for (const edge of graph.edges) if (edge.kind === 'parent') {
    const bucket = fallback.get(edge.from); if (bucket) bucket.push(edge); else fallback.set(edge.from, [edge]);
  }
  const parentEdges = new Map<string, SsmEdge[]>();
  const edgesFor = (key: string): SsmEdge[] => {
    let edges = parentEdges.get(key);
    if (!edges) {
      edges = [...(outgoing?.get(key) || fallback.get(key) || [])].filter(edge => edge.kind === 'parent');
      parentEdges.set(key, edges);
    }
    return edges;
  };
  const queue = [...nodes.keys()];
  if (options.includeContext) for (let offset = 0; offset < queue.length; offset++) for (const edge of edgesFor(queue[offset])) {
    if (nodes.has(edge.to) || options.includedKeys && !options.includedKeys.has(edge.to)) continue;
    const parent = graph.nodes.get(edge.to);
    if (!parent || !equipmentKind(parent)) continue;
    nodes.set(parent.key, parent); queue.push(parent.key);
  }
  const ordered = [...nodes.keys()].sort(compare);
  const placement = new Map<string, string | null>(), selectedEdges = new Map<string, string | null>();
  const rowByKey = new Map<string, EquipmentTreeRow>();
  for (const key of ordered) {
    const edges = edgesFor(key), candidates = [...new Set(edges.map(edge => edge.to))].sort((a, b) => ordinal(a, b));
    const available = candidates.filter(candidate => nodes.has(candidate)).sort((a, b) => {
      // Prefer an actual parent within the supplied cohort; this is only stable
      // display placement when source parent claims conflict.
      const scope = Number(memberKeys.has(b)) - Number(memberKeys.has(a));
      return scope || compare(a, b);
    });
    const parent = available[0] || null;
    placement.set(key, parent);
    const edge = parent ? edges.filter(candidate => candidate.to === parent).sort((a, b) => ordinal(a.key, b.key))[0] : undefined;
    selectedEdges.set(key, edge?.key || null);
    const issues: string[] = [];
    if (candidates.length > 1) issues.push('Multiple closest parents; one stable display placement is shown and all source edges are retained.');
    if (candidates.some(candidate => !graph.nodes.has(candidate))) issues.push('A closest-parent record is unavailable in the supplied data.');
    if (candidates.some(candidate => graph.nodes.has(candidate) && !nodes.has(candidate))) issues.push('A closest parent is outside the displayed scope.');
    rowByKey.set(key, {
      nodeKey: key, structuralParentKey: parent, structuralEdgeKey: edge?.key || null,
      candidateParentKeys: candidates, actualParentEdgeKeys: edges.map(candidate => candidate.key).sort(ordinal),
      depth: 0, hasChildren: false, context: !memberKeys.has(key), cycleBreak: false, issues,
    });
  }
  // Functional parent links allow iterative cycle cuts, even for very deep chains.
  const done = new Set<string>();
  for (const start of ordered) {
    if (done.has(start)) continue;
    const path: string[] = [], positions = new Map<string, number>();
    let current: string | null = start;
    while (current !== null && !done.has(current)) {
      const position = positions.get(current);
      if (position !== undefined) {
        const cycle = path.slice(position), root = [...cycle].sort(compare)[0];
        placement.set(root, null); selectedEdges.set(root, null);
        rowByKey.get(root)!.cycleBreak = true;
        for (const key of cycle) rowByKey.get(key)!.issues.push('Structural parent cycle; one display link is cut while source edges remain inspectable.');
        break;
      }
      positions.set(current, path.length); path.push(current);
      current = placement.get(current) ?? null;
    }
    for (const key of path) done.add(key);
  }
  const children = new Map<string, string[]>(), roots: string[] = [];
  for (const key of ordered) {
    const parent = placement.get(key) ?? null, row = rowByKey.get(key)!;
    row.structuralParentKey = parent; row.structuralEdgeKey = selectedEdges.get(key) ?? null;
    if (parent === null) roots.push(key);
    else { const bucket = children.get(parent); if (bucket) bucket.push(key); else children.set(parent, [key]); }
  }
  for (const bucket of children.values()) bucket.sort(compare);
  roots.sort(compare);
  const rows: EquipmentTreeRow[] = [], stack = roots.slice().reverse().map(key => ({ key, depth: 0 }));
  while (stack.length) {
    const { key, depth } = stack.pop()!, row = rowByKey.get(key)!, descendants = children.get(key) || [];
    row.depth = depth; row.hasChildren = descendants.length > 0; rows.push(row);
    for (let offset = descendants.length - 1; offset >= 0; offset--) stack.push({ key: descendants[offset], depth: depth + 1 });
  }
  const indexByKey = new Map(rows.map((row, index) => [row.nodeKey, index]));
  const memberRows = rows.filter(row => !row.context);
  const memberIndexByKey = new Map(memberRows.map((row, index) => [row.nodeKey, index]));
  return {
    roots, childrenByKey: children, rows, rowByKey, indexByKey, memberRows, memberIndexByKey,
    ancestorPath(key: string): string[] {
      const path: string[] = [], visited = new Set<string>();
      let current: string | null = key;
      while (current !== null && rowByKey.has(current) && !visited.has(current)) {
        visited.add(current); path.push(current); current = rowByKey.get(current)!.structuralParentKey;
      }
      return path.reverse();
    },
  };
}
