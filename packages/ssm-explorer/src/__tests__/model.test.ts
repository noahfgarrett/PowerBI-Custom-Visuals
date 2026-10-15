import { describe, expect, it } from 'vitest';
import type powerbi from 'powerbi-visuals-api';
import { assignmentKey, getGraphIndex, nodeKey, parseDataView, projectGraph, SsmDataStore, walkConnections } from '../model';
import type { ScopeFilters } from '../types';

const ROLES = ['project', 'equipmentId', 'equipmentLabel', 'nodeType', 'discipline', 'milestone', 'parentMilestone', 'closestParent', 'closestParentProject', 'dependencies', 'dependencyProject', 'systemName'];
// Host table cells can be blank even though the SDK's PrimitiveValue excludes null.
type Row = Record<string, powerbi.PrimitiveValue | null>;
function data(rows: Row[], details: { key: string; role: string; label?: string }[] = [], partial = false): powerbi.DataView {
  const columns = [...ROLES.map(role => ({ displayName: role, queryName: `registry.${role}`, roles: { [role]: true } })), ...details.map(field => ({ displayName: field.label || field.key, queryName: field.key, roles: { [field.role]: true } }))];
  return {
    metadata: { columns, ...(partial ? { segment: {} } : {}) },
    table: { columns, rows: rows.map(row => [...ROLES.map(role => row[role] ?? null), ...details.map(field => row[field.key] ?? null)]) },
  } as powerbi.DataView;
}
const row = (id: string, values: Row = {}): Row => ({ project: 'Alpha', equipmentId: id, discipline: 'Mechanical', milestone: 'L2-A', parentMilestone: 'L1-A', ...values });
const scope = (values: Partial<ScopeFilters> = {}): ScopeFilters => ({ projects: null, discipline: null, l1Key: null, l2Key: null, includeContext: true, showParents: true, showDependencies: true, ...values });

describe('SSM registry graph', () => {
  it('returns safe setup states and identifies partial host data without mutating input', () => {
    expect(parseDataView().missingRoles).toEqual(['project', 'equipmentId']);
    const view = data([row('EQ-1')], [], true), before = JSON.stringify(view);
    const graph = parseDataView(view);
    expect(graph.partial).toBe(true);
    expect(graph.warnings.join(' ')).toMatch(/partial dataset/);
    expect(JSON.stringify(view)).toBe(before);
  });

  it('keeps matching tags and milestone labels separate between projects', () => {
    const graph = parseDataView(data([row('EQ-1', { closestParent: 'EQ-2' }), row('EQ-2'), row('EQ-1', { project: 'Beta', closestParent: 'EQ-2' }), row('EQ-2', { project: 'Beta' })]));
    expect(graph.nodes.has(nodeKey('equipment', 'Alpha', 'EQ-1'))).toBe(true);
    expect(graph.nodes.has(nodeKey('equipment', 'Beta', 'EQ-1'))).toBe(true);
    const parents = graph.edges.filter(edge => edge.kind === 'parent');
    expect(parents).toHaveLength(2);
    expect(parents.every(edge => graph.nodes.get(edge.from)!.project === graph.nodes.get(edge.to)!.project)).toBe(true);
    expect(projectGraph(graph, scope({ projects: ['Alpha'] })).totalEquipment).toBe(2);
    expect(projectGraph(graph, scope({ projects: [] })).nodes).toHaveLength(0);
  });

  it('preserves repeated memberships and scalar detail conflicts without transferring attributes', () => {
    const details = [{ key: 'equipment.capacity', role: 'nodeDetail', label: 'Capacity' }, { key: 'milestone.date', role: 'milestoneDetail' }, { key: 'phase.owner', role: 'parentMilestoneDetail' }];
    const graph = parseDataView(data([
      row('EQ-1', { 'equipment.capacity': 10, 'milestone.date': '2030-01-01', 'phase.owner': 'Owner A', equipmentLabel: 'Label one' }),
      row('EQ-1', { 'equipment.capacity': 20, 'milestone.date': '2030-01-01', 'phase.owner': 'Owner A', equipmentLabel: 'Label two', milestone: 'L2-B', discipline: 'Electrical' }),
      row('EQ-1', { 'equipment.capacity': 10, 'milestone.date': '2030-01-01', 'phase.owner': 'Owner A' }),
    ], details));
    const equipment = graph.nodes.get(nodeKey('equipment', 'Alpha', 'EQ-1'))!;
    expect(equipment.metadata['equipment.capacity']).toEqual([10, 20]);
    expect(equipment.metadata['milestone.date']).toBeUndefined();
    expect(equipment.milestoneKeys).toHaveLength(2);
    expect(equipment.rowIndices).toEqual([0, 1, 2]);
    expect(equipment.issues.join(' ')).toMatch(/Conflicting.*Capacity/);
    expect(equipment.issues.join(' ')).toMatch(/Conflicting equipment labels/);
    expect(equipment.label).toBe('EQ-1');
    const l2 = graph.nodes.get(nodeKey('l2', 'Alpha', 'L2-A'))!;
    expect(l2.metadata['milestone.date']).toEqual(['2030-01-01']);
    expect(l2.metadata['equipment.capacity']).toBeUndefined();
    expect(graph.nodes.get(nodeKey('l1', 'Alpha', 'L1-A'))!.metadata['phase.owner']).toEqual(['Owner A']);
    expect(projectGraph(graph, scope()).totalEquipment).toBe(1);
    expect(projectGraph(graph, scope({ discipline: 'Electrical' })).totalEquipment).toBe(1);
  });

  it('follows chains beyond eight levels and terminates cycles while preserving only actual cycle members', () => {
    const chain = Array.from({ length: 12 }, (_, index) => row(`EQ-${index}`, { closestParent: index < 11 ? `EQ-${index + 1}` : null }));
    chain.push(row('CYCLE-A', { dependencies: 'CYCLE-B' }), row('CYCLE-B', { dependencies: 'CYCLE-A' }), row('OUTSIDE', { dependencies: 'CYCLE-A' }));
    const graph = parseDataView(data(chain));
    expect(walkConnections(graph, [nodeKey('equipment', 'Alpha', 'EQ-0')], ['parent']).size).toBe(12);
    expect(walkConnections(graph, [nodeKey('equipment', 'Alpha', 'CYCLE-A')], ['dependency']).size).toBe(2);
    expect(graph.nodes.get(nodeKey('equipment', 'Alpha', 'CYCLE-A'))!.issues.join(' ')).toMatch(/cycle/);
    expect(graph.nodes.get(nodeKey('equipment', 'Alpha', 'OUTSIDE'))!.issues.join(' ')).not.toMatch(/cycle/);
    expect(walkConnections(graph, [nodeKey('equipment', 'Alpha', 'EQ-11')], ['parent'], 'in').size).toBe(12);
  });

  it('keeps repeated query-name columns associated with their own node detail roles', () => {
    const view = data([row('EQ-1')]);
    const columns = view.table!.columns;
    columns.push(
      { displayName: 'Owner', queryName: 'registry.owner', roles: { nodeDetail: true } },
      { displayName: 'Owner', queryName: 'registry.owner', roles: { milestoneDetail: true } },
      { displayName: 'Owner', queryName: 'registry.owner', roles: { nodeDetail: true } },
    );
    view.table!.rows![0].push('Equipment owner', 'Milestone owner', 'Alternate equipment owner');
    const graph = parseDataView(view);
    expect(graph.fields).toHaveLength(1);
    expect(graph.nodes.get(nodeKey('equipment', 'Alpha', 'EQ-1'))!.metadata['registry.owner']).toEqual(['Equipment owner', 'Alternate equipment owner']);
    expect(graph.nodes.get(nodeKey('l2', 'Alpha', 'L2-A'))!.metadata['registry.owner']).toEqual(['Milestone owner']);
  });

  it('retains cross-project prerequisites and their original memberships as separately counted context', () => {
    const graph = parseDataView(data([
      row('CONSUMER', { dependencies: 'SUPPORT', dependencyProject: 'Beta' }),
      row('SUPPORT', { project: 'Beta', discipline: 'Electrical', milestone: 'L2-B', parentMilestone: 'L1-B', closestParent: 'FEED' }),
      row('FEED', { project: 'Beta', discipline: 'Electrical', milestone: 'L2-B', parentMilestone: 'L1-B' }),
    ]));
    const projection = projectGraph(graph, scope({ projects: ['Alpha'], discipline: 'Mechanical' }));
    expect(projection.totalEquipment).toBe(1);
    expect(projection.contextKeys.has(nodeKey('equipment', 'Beta', 'SUPPORT'))).toBe(true);
    expect(projection.contextKeys.has(nodeKey('equipment', 'Beta', 'FEED'))).toBe(true);
    expect(projection.nodes.some(node => node.key === nodeKey('l2', 'Beta', 'L2-B'))).toBe(true);
    expect(graph.nodes.get(nodeKey('equipment', 'Beta', 'SUPPORT'))!.milestoneKeys).toEqual([nodeKey('l2', 'Beta', 'L2-B')]);
    expect(projectGraph(graph, scope({ projects: ['Alpha'], includeContext: false })).contextKeys.size).toBe(0);
  });

  it('keeps unresolved external references and does not search another project without explicit scope', () => {
    const graph = parseDataView(data([
      row('EQ-1', { dependencies: 'ONLY-BETA;MISSING', dependencyProject: null, closestParent: 'OUTSIDE', closestParentProject: 'Gamma' }),
      row('ONLY-BETA', { project: 'Beta' }),
    ]));
    expect(graph.nodes.get(nodeKey('unresolved', 'Alpha', 'ONLY-BETA'))?.kind).toBe('unresolved');
    expect(graph.nodes.get(nodeKey('unresolved', 'Gamma', 'OUTSIDE'))?.project).toBe('Gamma');
    expect(graph.edges.find(edge => edge.kind === 'dependency' && edge.to === nodeKey('equipment', 'Beta', 'ONLY-BETA'))).toBeUndefined();
    expect(graph.projects).toEqual(['Alpha', 'Beta']);
  });

  it('resolves exact delimiter-containing tags before splitting and supports explicit JSON references', () => {
    const graph = parseDataView(data([
      row('COMMA', { dependencies: 'EQ, SPECIAL' }), row('EQ, SPECIAL'),
      row('JSON', { dependencies: '[{"id":"EQ-1","project":"Beta"},"EQ-2"]' }),
      row('EQ-1', { project: 'Beta' }), row('EQ-2'),
    ]));
    expect(graph.edges.filter(edge => edge.kind === 'dependency' && edge.from === nodeKey('equipment', 'Alpha', 'COMMA')).map(edge => edge.to)).toEqual([nodeKey('equipment', 'Alpha', 'EQ, SPECIAL')]);
    const jsonTargets = graph.edges.filter(edge => edge.kind === 'dependency' && edge.from === nodeKey('equipment', 'Alpha', 'JSON')).map(edge => edge.to);
    expect(jsonTargets).toEqual([nodeKey('equipment', 'Beta', 'EQ-1'), nodeKey('equipment', 'Alpha', 'EQ-2')]);
  });

  it('aligns project lists only when unambiguous and retains malformed references', () => {
    const graph = parseDataView(data([
      row('ALIGNED', { dependencies: 'SUP-A;SUP-B', dependencyProject: 'Alpha;Beta' }),
      row('AMBIGUOUS', { dependencies: 'SUP-A;SUP-B;SUP-C', dependencyProject: 'Alpha;Beta' }),
      row('BAD-JSON', { dependencies: '[broken' }), row('SUP-A'), row('SUP-B', { project: 'Beta' }),
    ]));
    const aligned = graph.edges.filter(edge => edge.kind === 'dependency' && edge.from === nodeKey('equipment', 'Alpha', 'ALIGNED'));
    expect(aligned.map(edge => graph.nodes.get(edge.to)!.project)).toEqual(['Alpha', 'Beta']);
    const ambiguous = graph.edges.filter(edge => edge.kind === 'dependency' && edge.from === nodeKey('equipment', 'Alpha', 'AMBIGUOUS'));
    expect(ambiguous).toHaveLength(3);
    expect(ambiguous.every(edge => graph.nodes.get(edge.to)!.kind === 'unresolved' && graph.nodes.get(edge.to)!.project === '')).toBe(true);
    expect(graph.warnings.join(' ')).toMatch(/do not align/);
    expect(graph.nodes.get(nodeKey('equipment', 'Alpha', 'BAD-JSON'))!.issues.join(' ')).toMatch(/JSON/);
  });

  it('preserves unassigned membership, conflicting parents, system roots, and header count semantics', () => {
    const graph = parseDataView(data([
      row('EQ-1', { milestone: null, parentMilestone: null, closestParent: 'ROOT', systemName: 'ROOT' }),
      row('EQ-2', { closestParent: 'EQ-1' }), row('EQ-2', { closestParent: 'HEADER', parentMilestone: 'L1-B' }),
      row('HEADER', { nodeType: 'header' }),
    ]));
    expect(graph.nodes.get(nodeKey('equipment', 'Alpha', 'EQ-1'))!.milestoneKeys).toHaveLength(1);
    expect([...graph.nodes.values()].some(node => node.kind === 'l2' && node.label === 'Unassigned milestone')).toBe(true);
    expect([...graph.nodes.values()].find(node => node.id === 'ROOT')?.kind).toBe('header');
    expect(graph.nodes.get(nodeKey('equipment', 'Alpha', 'EQ-2'))!.issues.join(' ')).toMatch(/Multiple closest parents/);
    expect(graph.nodes.get(nodeKey('l2', 'Alpha', 'L2-A'))!.issues.join(' ')).toMatch(/conflicting parent milestone/);
    const projection = projectGraph(graph, scope());
    expect(projection.totalEquipment).toBe(2);
    expect(projection.headerKeys.size).toBe(2);
  });

  it('uses tuple identities without delimiter collisions and leaves record-kind conflicts unresolved', () => {
    expect(nodeKey('equipment', 'A|B', 'C')).not.toBe(nodeKey('equipment', 'A', 'B|C'));
    const graph = parseDataView(data([row('DUP'), row('DUP', { nodeType: 'header' }), row('CHILD', { closestParent: 'DUP' })]));
    expect(graph.nodes.get(nodeKey('equipment', 'Alpha', 'DUP'))!.issues.join(' ')).toMatch(/conflicting record kinds/);
    const parent = graph.edges.find(edge => edge.from === nodeKey('equipment', 'Alpha', 'CHILD') && edge.kind === 'parent')!;
    expect(graph.nodes.get(parent.to)?.kind).toBe('unresolved');
  });

  it('preserves exact L1/L2 pairs when a milestone has conflicting parents', () => {
    const graph = parseDataView(data([
      row('EQ-1', { milestone: 'X', parentMilestone: 'A' }),
      row('EQ-1', { milestone: 'Y', parentMilestone: 'B' }),
      row('EQ-2', { milestone: 'X', parentMilestone: 'B' }),
      row('HEADER', { nodeType: 'header', milestone: 'X', parentMilestone: 'B' }),
    ]));
    const a = nodeKey('l1', 'Alpha', 'A'), b = nodeKey('l1', 'Alpha', 'B'), x = nodeKey('l2', 'Alpha', 'X'), y = nodeKey('l2', 'Alpha', 'Y');
    const index = getGraphIndex(graph);
    expect([...index.membersByAssignment.get(assignmentKey(a, x))!]).toEqual([nodeKey('equipment', 'Alpha', 'EQ-1')]);
    expect(index.membersByAssignment.get(assignmentKey(a, y))).toBeUndefined();
    expect(index.membersByAssignment.get(assignmentKey(b, x))!.has(nodeKey('equipment', 'Alpha', 'EQ-1'))).toBe(false);
    const projected = projectGraph(graph, scope({ l1Key: b, l2Key: x }));
    expect(projected.totalEquipment).toBe(1);
    expect(projected.primaryKeys.has(nodeKey('equipment', 'Alpha', 'EQ-1'))).toBe(false);
    expect(projected.primaryKeys.has(nodeKey('header', 'Alpha', 'HEADER'))).toBe(true);
    graph.index = undefined;
    const rebuilt = getGraphIndex(graph);
    expect([...rebuilt.membersByAssignment.get(assignmentKey(b, x))!].sort()).toEqual([...index.membersByAssignment.get(assignmentKey(b, x))!].sort());
    expect(rebuilt.membersByAssignment.get(assignmentKey(a, y))).toBeUndefined();
  });

  it('enforces paired membership even when a narrower discipline is the candidate cohort', () => {
    const graph = parseDataView(data([
      row('CROSS', { milestone: 'X', parentMilestone: 'A' }),
      row('CROSS', { milestone: 'Y', parentMilestone: 'B' }),
      row('DIRECT-1', { milestone: 'X', parentMilestone: 'B', discipline: 'Electrical' }),
      row('DIRECT-2', { milestone: 'X', parentMilestone: 'B', discipline: 'Electrical' }),
    ]));
    const projected = projectGraph(graph, scope({ discipline: 'Mechanical', l1Key: nodeKey('l1', 'Alpha', 'B'), l2Key: nodeKey('l2', 'Alpha', 'X') }));
    expect(projected.totalEquipment).toBe(0);
    expect(projected.primaryKeys.has(nodeKey('equipment', 'Alpha', 'CROSS'))).toBe(false);
  });

  it('requires the same L2 and source row when rebuilding paired indexes', () => {
    const graph = parseDataView(data([row('EQ-X', { milestone: 'X', parentMilestone: 'A' }), row('EQ-Y', { milestone: 'Y', parentMilestone: 'B' })]));
    const hierarchyY = graph.edges.find(edge => edge.kind === 'hierarchy' && edge.from === nodeKey('l2', 'Alpha', 'Y'))!;
    // An external graph fixture can reuse row numbers in another milestone.
    hierarchyY.rowIndices = [0]; graph.index = undefined;
    expect(getGraphIndex(graph).membersByAssignment.has(assignmentKey(nodeKey('l1', 'Alpha', 'B'), nodeKey('l2', 'Alpha', 'X')))).toBe(false);
  });
});

describe('streaming registry store', () => {
  it('merges incremental segments, skips host overlap, and retains original selection identities', () => {
    const store = new SsmDataStore(), first = data([row('EQ-1', { closestParent: 'EQ-2' }), row('EQ-2')], [], true);
    const firstIdentity = {} as powerbi.visuals.CustomVisualOpaqueIdentity;
    const secondIdentity = {} as powerbi.visuals.CustomVisualOpaqueIdentity;
    first.table!.identity = [firstIdentity, secondIdentity];
    const created = store.update(first, 0), graph = created.graph, revision = graph.revision, originalNode = graph.nodes.get(nodeKey('equipment', 'Alpha', 'EQ-1'));
    const second = data([row('EQ-2'), row('EQ-3', { closestParent: 'EQ-1' })]);
    const thirdIdentity = {} as powerbi.visuals.CustomVisualOpaqueIdentity;
    second.table!.identity = [secondIdentity, thirdIdentity];
    (second.table as powerbi.DataViewTable & { lastMergeIndex: number }).lastMergeIndex = 0;
    const appended = store.update(second, 2);
    expect(appended.reset).toBe(false); expect(appended.changed).toBe(true);
    expect(appended.graph).toBe(graph); expect(appended.graph.nodes.get(nodeKey('equipment', 'Alpha', 'EQ-1'))).toBe(originalNode);
    expect(appended.graph.rowCount).toBe(3); expect(appended.table!.rows).toHaveLength(3);
    expect(appended.table!.identity).toEqual([firstIdentity, secondIdentity, thirdIdentity]);
    expect(appended.table!.identity![2]).toBe(thirdIdentity);
    expect(appended.graph.nodes.get(nodeKey('equipment', 'Alpha', 'EQ-3'))!.rowIndices).toEqual([2]);
    expect(appended.graph.revision).toBeGreaterThan(revision);
    expect(getGraphIndex(graph).version).toBe(graph.revision);
    expect(store.update(second, 2).changed).toBe(false);
    expect(store.update(second, 2).graph.rowCount).toBe(3);
  });

  it('ingests only the tail of an aggregate Append and reuses same snapshots for formatting', () => {
    const store = new SsmDataStore(), a = row('EQ-1'), b = row('EQ-2');
    const created = store.update(data([a], [], true), 0), revision = created.graph.revision;
    const aggregate = data([a, b]);
    const appended = store.update(aggregate, 1);
    expect(appended.graph.rowCount).toBe(2); expect(appended.graph.revision).toBeGreaterThan(revision);
    expect(appended.graph.nodes.get(nodeKey('l1', 'Alpha', 'L1-A'))!.rowIndices).toEqual([0, 1]);
    expect(store.update(aggregate).changed).toBe(false);
    expect(store.update(aggregate).table!.rows).toHaveLength(2);
    const next = store.update(data([row('OTHER', { project: 'Beta' })]), 0);
    expect(next.reset).toBe(true); expect(next.graph.projects).toEqual(['Beta']);
    expect(next.graph.nodes.has(nodeKey('equipment', 'Alpha', 'EQ-1'))).toBe(false);
  });

  it('rebinds unavailable targets and exact delimiter-containing tags when later chunks supply them', () => {
    const store = new SsmDataStore();
    store.update(data([row('CONSUMER', { dependencies: 'EQ, SPECIAL', closestParent: 'PARENT', closestParentProject: 'Beta' })], [], true), 0);
    const result = store.update(data([row('EQ, SPECIAL'), row('PARENT', { project: 'Beta' })]), 2);
    const edges = getGraphIndex(result.graph).outgoing.get(nodeKey('equipment', 'Alpha', 'CONSUMER'))!;
    expect([...edges].filter(edge => edge.kind === 'dependency').map(edge => edge.to)).toEqual([nodeKey('equipment', 'Alpha', 'EQ, SPECIAL')]);
    expect([...edges].find(edge => edge.kind === 'parent')!.to).toBe(nodeKey('equipment', 'Beta', 'PARENT'));
    expect(result.graph.nodes.has(nodeKey('unresolved', 'Alpha', 'EQ'))).toBe(false);
    expect(result.graph.nodes.has(nodeKey('unresolved', 'Alpha', 'SPECIAL'))).toBe(false);
    expect(result.graph.nodes.has(nodeKey('unresolved', 'Beta', 'PARENT'))).toBe(false);
  });

  it('updates formerly resolved references when late record-kind conflicts arrive and detects late cycles', () => {
    const store = new SsmDataStore();
    store.update(data([row('A', { dependencies: 'B' }), row('B', { dependencies: 'A' }), row('C', { closestParent: 'B' })], [], true), 0);
    const result = store.update(data([row('B', { nodeType: 'header' })]), 2);
    const parent = [...getGraphIndex(result.graph).outgoing.get(nodeKey('equipment', 'Alpha', 'C'))!].find(edge => edge.kind === 'parent')!;
    expect(result.graph.nodes.get(parent.to)!.kind).toBe('unresolved');
    expect(result.graph.nodes.get(nodeKey('equipment', 'Alpha', 'A'))!.issues.join(' ')).not.toMatch(/Connection cycle/);
    const late = new SsmDataStore();
    late.update(data([row('A', { dependencies: 'B' })], [], true), 0);
    const cycle = late.update(data([row('B', { dependencies: 'A' })]), 2).graph;
    expect(cycle.nodes.get(nodeKey('equipment', 'Alpha', 'A'))!.issues.join(' ')).toMatch(/Connection cycle/);
    expect(walkConnections(cycle, [nodeKey('equipment', 'Alpha', 'A')], ['dependency']).size).toBe(2);
  });

  it('merges repeated assignments and metadata conflicts across segments without rebuilding old nodes', () => {
    const details = [{ key: 'registry.value', role: 'nodeDetail' }], store = new SsmDataStore();
    const first = store.update(data([row('EQ-1', { 'registry.value': 10 })], details, true), 0);
    const node = first.graph.nodes.get(nodeKey('equipment', 'Alpha', 'EQ-1'))!;
    const result = store.update(data([row('EQ-1', { 'registry.value': 20, milestone: 'L2-B' })], details), 2);
    expect(result.graph.nodes.get(node.key)).toBe(node);
    expect(node.metadata['registry.value']).toEqual([10, 20]); expect(node.rowIndices).toEqual([0, 1]);
    expect(node.milestoneKeys).toHaveLength(2); expect(projectGraph(result.graph, scope()).totalEquipment).toBe(1);
    expect(getGraphIndex(result.graph).membersByMilestone.get(nodeKey('l2', 'Alpha', 'L2-B'))!.has(node.key)).toBe(true);
  });

  it('resets schema changes and clear, preserving project isolation of all index cohorts', () => {
    const store = new SsmDataStore();
    store.update(data([row('EQ-1'), row('EQ-1', { project: 'Beta' })]), 0);
    const changed = data([row('NEW')]); changed.table!.columns[0] = { displayName: 'Renamed', queryName: 'new.project', roles: { project: true } };
    const result = store.update(changed, 2);
    expect(result.reset).toBe(true); expect(result.graph.rowCount).toBe(1);
    expect(getGraphIndex(result.graph).nodesByProject.has('Beta')).toBe(false);
    store.clear(); const empty = store.update();
    expect(empty.graph.rowCount).toBe(0); expect(empty.graph.missingRoles).toEqual(['project', 'equipmentId']);
  });

  it('updates a companion project that becomes an exact known project label in a later chunk', () => {
    const store = new SsmDataStore();
    store.update(data([row('CONSUMER', { dependencies: 'X;Y;Z', dependencyProject: 'Beta, East' })], [], true), 0);
    const graph = store.update(data([row('X', { project: 'Beta, East' })]), 2).graph;
    expect(graph.nodes.get(nodeKey('equipment', 'Alpha', 'CONSUMER'))!.issues.join(' ')).not.toMatch(/do not align/);
    const targets = [...getGraphIndex(graph).outgoing.get(nodeKey('equipment', 'Alpha', 'CONSUMER'))!].filter(edge => edge.kind === 'dependency').map(edge => graph.nodes.get(edge.to)!);
    expect(targets).toHaveLength(3); expect(targets.every(node => node.project === 'Beta, East')).toBe(true);
  });

  it('treats explicit Create as replacement even if a host reuses and mutates row objects', () => {
    const store = new SsmDataStore(), view = data([row('OLD')]);
    const initial = store.update(view, 0), revision = initial.graph.revision;
    view.table!.rows![0][1] = 'NEW';
    const result = store.update(view, 0);
    expect(result.reset).toBe(true); expect(result.changed).toBe(true);
    expect(result.graph.revision).toBeGreaterThan(revision);
    expect(result.graph.nodes.has(nodeKey('equipment', 'Alpha', 'OLD'))).toBe(false);
    expect(result.graph.nodes.has(nodeKey('equipment', 'Alpha', 'NEW'))).toBe(true);
    expect(result.table!.rows).toHaveLength(1);
  });

  it('updates paired cohorts incrementally without inferring pairings from repeated equipment arrays', () => {
    const store = new SsmDataStore();
    store.update(data([row('EQ-1', { milestone: 'X', parentMilestone: 'A' }), row('EQ-1', { milestone: 'Y', parentMilestone: 'B' })], [], true), 0);
    const graph = store.update(data([row('EQ-2', { milestone: 'X', parentMilestone: 'B' }), row('EQ-1', { project: 'Beta', milestone: 'X', parentMilestone: 'B' })]), 2).graph;
    const pair = assignmentKey(nodeKey('l1', 'Alpha', 'B'), nodeKey('l2', 'Alpha', 'X'));
    expect([...getGraphIndex(graph).membersByAssignment.get(pair)!]).toEqual([nodeKey('equipment', 'Alpha', 'EQ-2')]);
    expect(projectGraph(graph, scope({ l1Key: nodeKey('l1', 'Alpha', 'B'), l2Key: nodeKey('l2', 'Alpha', 'X') })).totalEquipment).toBe(1);
  });
});
