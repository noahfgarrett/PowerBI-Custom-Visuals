import { describe, expect, it } from 'vitest';
import { buildDependencyList } from '../dependency-list';
import { nodeKey, parseDataView, SsmDataStore } from '../model';
import { getNodeStatus } from '../status';
import { tableFixture, type SyntheticRow } from './fixtures';
import type { SsmGraph } from '../types';

const row = (id: string, values: Partial<SyntheticRow> = {}): SyntheticRow => ({ project: 'Alpha', equipmentId: id, nodeType: 'equipment', milestone: 'L2-A', parentMilestone: 'L1-A', ...values });
const eq = (id: string, project = 'Alpha'): string => nodeKey('equipment', project, id);
const graphFor = (rows: SyntheticRow[], partial = false): SsmGraph => parseDataView(tableFixture(rows, undefined, partial));
const targetIds = (graph: SsmGraph, selected: string): string[] => buildDependencyList(graph, selected).targets.map(target => target.node.id);

describe('dependency list over the complete structural cohort', () => {
  it('collects prerequisites of selected equipment and every structural descendant, without following reverse consumers or unrelated prerequisite chains', () => {
    const graph = graphFor([
      row('ROOT', { dependencies: 'DEP-A' }),
      row('CHILD', { closestParent: 'ROOT', milestone: 'L2-Other', dependencies: 'DEP-B;SHARED' }),
      row('DEEP', { closestParent: 'CHILD', dependencies: 'SHARED;MISSING' }),
      row('REVERSE-CONSUMER', { dependencies: 'ROOT' }),
      row('DEP-A', { dependencies: 'DO-NOT-FOLLOW', status: 'Completed' }), row('DEP-B'), row('SHARED', { discipline: 'Electrical' }), row('DO-NOT-FOLLOW'),
      row('OTHER-ROOT'), row('UNRELATED-CHILD', { closestParent: 'OTHER-ROOT', dependencies: 'UNRELATED-PREREQUISITE' }), row('UNRELATED-PREREQUISITE'),
    ]);
    const result = buildDependencyList(graph, eq('ROOT'));
    expect(result.cohortKeys).toEqual(new Set([eq('ROOT'), eq('CHILD'), eq('DEEP')]));
    expect(result.targets.map(target => target.node.id)).toEqual(['DEP-A', 'DEP-B', 'MISSING', 'SHARED']);
    expect(result.targets.find(target => target.node.id === 'SHARED')!.requiredBy.map(node => node.id)).toEqual(['CHILD', 'DEEP']);
    expect(result).toMatchObject({ cohortCount: 3, equipmentCount: 3, sourceCount: 3, dependencyCount: 4, edgeCount: 5, partial: false });
    const completed = result.targets.find(target => target.node.id === 'DEP-A')!;
    expect(getNodeStatus(graph, completed.node).state).toBe('completed');
    expect(result.targets.find(target => target.node.id === 'MISSING')!.node.kind).toBe('unresolved');
    expect(graph.nodes.get(eq('CHILD'))!.milestoneKeys).toEqual([nodeKey('l2', 'Alpha', 'L2-Other')]);
  });

  it('seeds every actual L1 assignment across its L2s without importing another conflicting L1 through a shared L2', () => {
    const graph = graphFor([
      row('A', { milestone: 'Shared', parentMilestone: 'L1-A', dependencies: 'TARGET-A' }),
      row('B', { milestone: 'Shared', parentMilestone: 'L1-B', dependencies: 'TARGET-B' }),
      row('C', { milestone: 'Other', parentMilestone: 'L1-A', dependencies: 'TARGET-C' }),
      ...['A', 'B', 'C'].map(id => row(`TARGET-${id}`, { milestone: 'Targets', parentMilestone: 'L1-Z' })),
    ]);
    const l1 = buildDependencyList(graph, nodeKey('l1', 'Alpha', 'L1-A'));
    expect(l1.cohortKeys).toEqual(new Set([eq('A'), eq('C')])); expect(l1.targets.map(target => target.node.id)).toEqual(['TARGET-A', 'TARGET-C']);
    const l2 = buildDependencyList(graph, nodeKey('l2', 'Alpha', 'Shared'));
    expect(l2.cohortKeys).toEqual(new Set([eq('A'), eq('B')])); expect(l2.targets.map(target => target.node.id)).toEqual(['TARGET-A', 'TARGET-B']);
  });

  it('handles headers and a selected child independently, without adding the selected child\'s ancestors to its cohort', () => {
    const graph = graphFor([
      row('ORG', { nodeType: 'header', dependencies: 'POWER' }), row('CHILD', { closestParent: 'ORG', dependencies: 'CONTROL' }), row('LEAF', { closestParent: 'CHILD', dependencies: 'SENSOR' }),
      row('POWER'), row('CONTROL'), row('SENSOR'),
    ]);
    const header = buildDependencyList(graph, nodeKey('header', 'Alpha', 'ORG'));
    expect(header.targets.map(target => target.node.id)).toEqual(['CONTROL', 'POWER', 'SENSOR']);
    expect(header).toMatchObject({ cohortCount: 3, equipmentCount: 2, sourceCount: 3 });
    expect(targetIds(graph, eq('CHILD'))).toEqual(['CONTROL', 'SENSOR']);
    expect(targetIds(graph, eq('LEAF'))).toEqual(['SENSOR']);
  });

  it('keeps cross-project target identity and source equipment exact, including explicitly cross-project descendants', () => {
    const graph = graphFor([
      row('ROOT', { dependencies: JSON.stringify([{ id: 'SUPPLY', project: 'Beta' }, { id: 'SUPPLY', project: 'Alpha' }, { id: 'UNKNOWN', project: 'Gamma' }]) }),
      row('BETA-CHILD', { project: 'Beta', closestParent: 'ROOT', closestParentProject: 'Alpha', dependencies: 'SUPPLY', dependencyProject: 'Alpha' }),
      row('SUPPLY', { discipline: 'Civil' }), row('SUPPLY', { project: 'Beta', discipline: 'Electrical' }), row('UNKNOWN'),
    ]);
    const result = buildDependencyList(graph, eq('ROOT'));
    expect(result.targets.map(target => [target.project, target.node.id])).toEqual([['Alpha', 'SUPPLY'], ['Beta', 'SUPPLY'], ['Gamma', 'UNKNOWN']]);
    expect(result.targets[0].requiredBy.map(node => [node.project, node.id])).toEqual([['Alpha', 'ROOT'], ['Beta', 'BETA-CHILD']]);
    expect(result.targets[2].node.kind).toBe('unresolved'); expect(result.targets[2].key).not.toBe(eq('UNKNOWN'));
    expect(result.targets[2].disciplines).toEqual(['']); expect(result.disciplineOptions).toEqual(['', 'Civil', 'Electrical']);
    expect(result).toMatchObject({ equipmentCount: 2, dependencyCount: 3, edgeCount: 4 });
  });

  it('deduplicates repeated source rows and target links while keeping every conflicting discipline available for filtering', () => {
    const graph = graphFor([
      row('ROOT', { dependencies: 'SHARED' }), row('ROOT', { dependencies: 'SHARED' }),
      row('CHILD', { closestParent: 'ROOT', dependencies: 'SHARED' }), row('CHILD', { closestParent: 'ROOT', dependencies: 'SHARED', milestone: 'L2-Other' }),
      row('SHARED', { discipline: 'Mechanical' }), row('SHARED', { discipline: 'Controls' }),
    ]);
    const result = buildDependencyList(graph, eq('ROOT'));
    expect(result.dependencyCount).toBe(1); expect(result.edgeCount).toBe(2); expect(result.sourceCount).toBe(2);
    expect(result.targets[0].requiredBy.map(node => node.id)).toEqual(['CHILD', 'ROOT']);
    expect(result.targets[0].disciplines).toEqual(['Controls', 'Mechanical']); expect(result.disciplineOptions).toEqual(['Controls', 'Mechanical']);
  });

  it('collects a prerequisite target\'s dependencies only when that target is also a structural cohort member', () => {
    const graph = graphFor([row('ROOT', { dependencies: 'CHILD' }), row('CHILD', { closestParent: 'ROOT', dependencies: 'PREREQUISITE' }), row('PREREQUISITE', { dependencies: 'DEEPER-PREREQUISITE' }), row('DEEPER-PREREQUISITE')]);
    expect(targetIds(graph, eq('ROOT'))).toEqual(['CHILD', 'PREREQUISITE']);
    expect(buildDependencyList(graph, eq('ROOT')).cohortCount).toBe(2);
  });

  it('terminates self/structural cycles and retains actual reciprocal dependency links', () => {
    const graph = graphFor([row('A', { closestParent: 'B', dependencies: 'B' }), row('B', { closestParent: 'A', dependencies: 'A;B' })]);
    const result = buildDependencyList(graph, eq('A'));
    expect(result.cohortKeys).toEqual(new Set([eq('A'), eq('B')])); expect(result.targets.map(target => target.node.id)).toEqual(['A', 'B']);
    expect(result.targets[1].requiredBy.map(node => node.id)).toEqual(['A', 'B']); expect(result.edgeCount).toBe(3);
  });

  it('walks10,000 nested equipment iteratively without a display-depth or page cutoff', () => {
    const rows = Array.from({ length: 10000 }, (_, index) => row(`EQ-${index}`, { closestParent: index ? `EQ-${index - 1}` : 'EQ-9999', ...(index === 9999 ? { dependencies: 'FINAL' } : {}) }));
    rows.push(row('FINAL', { dependencies: 'NOT-COHORT' }), row('NOT-COHORT'));
    const graph = graphFor(rows), result = buildDependencyList(graph, eq('EQ-0'));
    expect(result.equipmentCount).toBe(10000); expect(result.cohortCount).toBe(10000);
    expect(result.targets.map(target => target.node.id)).toEqual(['FINAL']); expect(result.targets[0].requiredBy[0].id).toBe('EQ-9999');
  });

  it('reports partial coverage and resolves a missing target when its later segment arrives', () => {
    const store = new SsmDataStore(), initial = store.update(tableFixture([row('ROOT', { dependencies: 'LATE' })], undefined, true), 0);
    const first = buildDependencyList(initial.graph, eq('ROOT'));
    expect(first.partial).toBe(true); expect(first.targets[0].node.kind).toBe('unresolved');
    const later = store.update(tableFixture([row('LATE', { discipline: 'Electrical', status: 'In Progress' })], undefined, false, 1), 2);
    const result = buildDependencyList(later.graph, eq('ROOT'));
    expect(result.partial).toBe(false); expect(result.targets[0].key).toBe(eq('LATE')); expect(result.targets[0].disciplines).toEqual(['Electrical']);
    expect(getNodeStatus(later.graph, result.targets[0].node).state).toBe('in-progress');
  });

  it('falls back from missing/stale indexes without mutating the graph and retains dangling references without fabricated metadata', () => {
    const graph = graphFor([row('ROOT', { dependencies: 'TARGET', dependencyProject: 'Beta' }), row('TARGET', { project: 'Beta', discipline: 'Electrical' })]);
    const original = graph.index!, targetKey = eq('TARGET', 'Beta');
    graph.nodes.delete(targetKey); graph.index = undefined;
    const before = JSON.stringify({ nodes: [...graph.nodes.values()], edges: graph.edges, revision: graph.revision });
    const missing = buildDependencyList(graph, eq('ROOT'));
    expect(graph.index).toBeUndefined(); expect(graph.nodes.has(targetKey)).toBe(false);
    expect(missing.targets[0]).toMatchObject({ key: targetKey, project: 'Beta', disciplines: [''], node: { kind: 'unresolved', id: 'TARGET', metadata: {} } });
    graph.index = { ...original, version: graph.revision - 1, incoming: new Map(), outgoing: new Map() };
    const stale = graph.index, restored = buildDependencyList(graph, eq('ROOT'));
    expect(graph.index).toBe(stale); expect(restored.targets.map(target => target.key)).toEqual(missing.targets.map(target => target.key));
    expect(JSON.stringify({ nodes: [...graph.nodes.values()], edges: graph.edges, revision: graph.revision })).toBe(before);
  });

  it('sorts targets and Required by sources deterministically in natural identifier order regardless of ingestion order', () => {
    const rows = [row('ORG', { nodeType: 'header' }), row('SOURCE-10', { closestParent: 'ORG', dependencies: 'DEP-10;DEP-2' }), row('SOURCE-2', { closestParent: 'ORG', dependencies: 'DEP-10;DEP-2' }), row('DEP-10'), row('DEP-2')];
    const query = (records: SyntheticRow[]) => buildDependencyList(graphFor(records), nodeKey('header', 'Alpha', 'ORG')).targets.map(target => ({ key: target.key, requiredBy: target.requiredBy.map(node => node.id) }));
    expect(query(rows)).toEqual(query(rows.slice().reverse())); expect(query(rows).map(target => JSON.parse(target.key)[2])).toEqual(['DEP-2', 'DEP-10']);
    expect(query(rows)[0].requiredBy).toEqual(['SOURCE-2', 'SOURCE-10']);
  });

  it('returns safe empty results for missing selection and setup data without indexing or inventing nodes', () => {
    const graph = parseDataView(), previous = graph.index;
    expect(buildDependencyList(graph, eq('MISSING'))).toMatchObject({ selectedKey: eq('MISSING'), targets: [], disciplineOptions: [], cohortCount: 0, equipmentCount: 0, sourceCount: 0, dependencyCount: 0, edgeCount: 0, partial: false });
    expect(graph.index).toBe(previous); expect(graph.nodes.size).toBe(0);
  });
});
