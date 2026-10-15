import { describe, expect, it } from 'vitest';
import type powerbi from 'powerbi-visuals-api';
import { getGraphIndex, nodeKey, parseDataView, projectGraph, SsmDataStore, walkConnections } from '../model';

/** Opt-in local benchmark: synthetic registry only; excluded from routine fast tests. */
describe.runIf(process.env.SSM_BENCHMARK === '1')('large synthetic registry benchmarks', () => {
  for (const count of [10000, 50000, 100000]) it('indexes and streams ' + count + ' records', () => {
    const roles = ['project', 'equipmentId', 'discipline', 'milestone', 'parentMilestone', 'closestParent'];
    const columns: powerbi.DataViewMetadataColumn[] = roles.map(role => ({ displayName: role, queryName: 'synthetic.' + role, roles: { [role]: true } }));
    const rows: powerbi.DataViewTableRow[] = Array.from({ length: count }, (_, index) => ['Synthetic', 'EQ-' + index, index % 2 ? 'Electrical' : 'Mechanical', 'L2-' + Math.floor(index / 1000), 'L1-' + Math.floor(index / 10000), index % 1000 ? 'EQ-' + (index - 1) : '']);
    const view = (subset: powerbi.DataViewTableRow[], partial: boolean): powerbi.DataView => ({ metadata: { columns, ...(partial ? { segment: {} } : {}) }, table: { columns, rows: subset } });
    const initialStart = performance.now(), parsed = parseDataView(view(rows, false)), initialMs = performance.now() - initialStart;
    expect(getGraphIndex(parsed).suppliedEntityKeys.size).toBe(count);
    const walkStart = performance.now(), walked = walkConnections(parsed, [nodeKey('equipment', 'Synthetic', 'EQ-999')], ['parent']), walkMs = performance.now() - walkStart;
    expect(walked.size).toBe(1000);
    const projectionStart = performance.now(), projected = projectGraph(parsed, { projects: ['Synthetic'], discipline: null, l1Key: null, l2Key: nodeKey('l2', 'Synthetic', 'L2-0'), includeContext: true, showParents: true, showDependencies: true }), projectionMs = performance.now() - projectionStart;
    expect(projected.totalEquipment).toBe(1000);
    const store = new SsmDataStore(), streamStart = performance.now();
    let result = store.update(view(rows.slice(0, 2000), count > 2000), 0);
    for (let offset = 2000; offset < rows.length; offset += 2000) result = store.update(view(rows.slice(offset, offset + 2000), offset + 2000 < count), 2);
    const streamMs = performance.now() - streamStart;
    expect(result.graph.rowCount).toBe(count); expect(result.graph.nodes.size).toBe(parsed.nodes.size);
    expect(result.graph.edges.length).toBe(parsed.edges.length);
    expect(result.graph.nodes.get(nodeKey('l1', 'Synthetic', 'L1-0'))!.rowIndices).toHaveLength(Math.min(10000, count));
    console.log(JSON.stringify({ syntheticRecords: count, parseMs: Math.round(initialMs), stream2000Ms: Math.round(streamMs), walk1000Ms: Math.round(walkMs * 100) / 100, projection1000Ms: Math.round(projectionMs * 100) / 100 }));
  }, 60000);
});
