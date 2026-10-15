import { assignmentKey, getGraphIndex } from './graph-index';
import type { SsmGraph, SsmNode } from './types';

export interface DependencyListTarget {
  key: string;
  node: SsmNode;
  project: string;
  discipline: string;
  /** All declared source disciplines; a conflict is never joined into a new category. */
  disciplines: string[];
  requiredBy: SsmNode[];
}

export interface DependencyListResult {
  selectedKey: string;
  targets: DependencyListTarget[];
  disciplineOptions: string[];
  /** Actual milestone members and their structural descendants, never dependency expansion. */
  cohortKeys: Set<string>;
  cohortCount: number;
  equipmentCount: number;
  sourceCount: number;
  dependencyCount: number;
  /** Distinct consumer → prerequisite links, independent of repeated source rows. */
  edgeCount: number;
  partial: boolean;
}

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'variant' });
const ordinal = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const compareNodes = (a: SsmNode, b: SsmNode): number => collator.compare(a.project, b.project) || ordinal(a.project, b.project) || collator.compare(a.id, b.id) || ordinal(a.key, b.key);
const structural = (node: SsmNode): boolean => node.kind === 'equipment' || node.kind === 'header' || node.kind === 'unresolved';

/**
 * Query the complete supplied graph. The canvas's project/discipline filters,
 * collapsed branches and pages do not change this dependency cohort.
 */
export function buildDependencyList(graph: SsmGraph, selectedKey: string): DependencyListResult {
  const selected = graph.nodes.get(selectedKey), cohortKeys = new Set<string>();
  const result: DependencyListResult = { selectedKey, targets: [], disciplineOptions: [], cohortKeys, cohortCount: 0, equipmentCount: 0, sourceCount: 0, dependencyCount: 0, edgeCount: 0, partial: graph.partial };
  if (!selected) return result;
  // Avoid attaching a fallback index to an externally supplied graph fixture.
  const index = graph.index?.version === graph.revision ? graph.index : getGraphIndex({ ...graph });
  const placeholders = new Map<string, SsmNode>();
  const nodeFor = (key: string): SsmNode => {
    const known = graph.nodes.get(key); if (known) return known;
    const previous = placeholders.get(key); if (previous) return previous;
    let project = '', id = key;
    try {
      const tuple: unknown = JSON.parse(key);
      if (Array.isArray(tuple)) {
        if (typeof tuple[1] === 'string') project = tuple[1];
        if (typeof tuple[2] === 'string') id = tuple[2];
      }
    } catch { /* An opaque missing key supplies no additional identity metadata. */ }
    const node: SsmNode = { key, id, label: id, project, kind: 'unresolved', discipline: '', disciplines: [], milestoneKeys: [], parentMilestoneKeys: [], rowIndices: [], metadata: {}, issues: ['Referenced record is unavailable in the supplied graph.'] };
    placeholders.set(key, node); return node;
  };
  const queue: string[] = [];
  const add = (key: string): void => {
    if (!cohortKeys.has(key) && structural(nodeFor(key))) { cohortKeys.add(key); queue.push(key); }
  };
  if (selected.kind === 'l1') {
    // An L2 can have conflicting L1 parents. Only row-evidenced assignments
    // belong to this L1, not the Cartesian union of every shared L2's members.
    for (const milestone of index.milestonesByParent.get(selectedKey) ?? []) {
      for (const member of index.membersByAssignment.get(assignmentKey(selectedKey, milestone)) ?? []) add(member);
    }
  } else if (selected.kind === 'l2') {
    for (const member of index.membersByMilestone.get(selectedKey) ?? []) add(member);
  } else if (structural(selected)) add(selectedKey);

  for (let offset = 0; offset < queue.length; offset++) {
    const parent = queue[offset];
    for (const edge of index.incoming.get(parent) ?? []) if (edge.kind === 'parent' && edge.to === parent) add(edge.from);
  }

  const consumersByTarget = new Map<string, Map<string, SsmNode>>(), sources = new Set<string>();
  for (const key of cohortKeys) {
    const consumer = nodeFor(key);
    if (consumer.kind === 'equipment') result.equipmentCount++;
    for (const edge of index.outgoing.get(key) ?? []) {
      if (edge.kind !== 'dependency' || edge.from !== key) continue;
      let consumers = consumersByTarget.get(edge.to);
      if (!consumers) { consumers = new Map(); consumersByTarget.set(edge.to, consumers); }
      if (!consumers.has(key)) { consumers.set(key, consumer); result.edgeCount++; }
      sources.add(key);
    }
  }
  const disciplines = new Set<string>();
  for (const [key, consumers] of consumersByTarget) {
    const node = nodeFor(key), declared = [...new Set((node.disciplines?.length ? node.disciplines : [node.discipline]).filter(Boolean))];
    const values = declared.length ? declared : [''];
    values.sort((a, b) => collator.compare(a, b) || ordinal(a, b)); values.forEach(value => disciplines.add(value));
    result.targets.push({ key, node, project: node.project, discipline: node.discipline, disciplines: values, requiredBy: [...consumers.values()].sort(compareNodes) });
  }
  result.targets.sort((a, b) => compareNodes(a.node, b.node));
  result.disciplineOptions = [...disciplines].sort((a, b) => collator.compare(a, b) || ordinal(a, b));
  result.cohortCount = cohortKeys.size; result.sourceCount = sources.size; result.dependencyCount = result.targets.length;
  return result;
}
