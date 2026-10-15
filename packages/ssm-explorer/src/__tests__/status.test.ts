import { describe, expect, it, vi } from 'vitest';
import type powerbi from 'powerbi-visuals-api';
import capabilities from '../../capabilities.json';
import { nodeKey, parseDataView, SsmDataStore } from '../model';
import { ExplorerSettings } from '../settings';
import { getNodeStatus, hasStatusBinding } from '../status';

const base: powerbi.DataViewMetadataColumn[] = ['project', 'equipmentId', 'nodeType', 'milestone', 'parentMilestone', 'dependencies'].map(role => ({ displayName: role, queryName: `R.${role}`, roles: { [role]: true } }));
const field = (key = 'R.Status', role = 'status', displayName = 'Status'): powerbi.DataViewMetadataColumn => ({ displayName, queryName: key, roles: { [role]: true } });
const row = (id: string, ...values: unknown[]): unknown[] => ['Alpha', id, 'equipment', 'L2-A', 'L1-A', '', ...values];
function view(rows: unknown[][], fields = [field()], partial = false): powerbi.DataView {
  const columns = [...base, ...fields];
  return { metadata: { columns, ...(partial ? { segment: {} } : {}) }, table: { columns, rows: rows as powerbi.DataViewTableRow[] } };
}
const key = (id = 'EQ-1', kind: 'equipment' | 'header' | 'l1' | 'l2' | 'unresolved' = 'equipment', project = 'Alpha') => nodeKey(kind, project, id);

describe('explicit source status semantics', () => {
  it.each([
    ['Not Started', 'not-started', 'Not Started'], ['  NOT   STARTED\n', 'not-started', 'Not Started'],
    ['In Progress', 'in-progress', 'In Progress'], ['in\tprogress', 'in-progress', 'In Progress'],
    ['Completed', 'completed', 'Completed'], [' completed ', 'completed', 'Completed'],
  ])('recognizes only exact case/whitespace normalized %s', (value, state, label) => {
    const graph = parseDataView(view([row('EQ-1', value)]));
    expect(getNodeStatus(graph, graph.nodes.get(key())!)).toEqual({ state, label, values: [value] });
    expect(hasStatusBinding(graph)).toBe(true);
  });

  it('retains explicit status as role-specific metadata and author-configurable equipment/header details', () => {
    const records = [row('EQ-1', 'Completed'), ['Alpha', 'HEADER', 'header', 'L2-A', 'L1-A', '', 'In Progress']];
    const data = view(records), graph = parseDataView(data), settings = new ExplorerSettings(data);
    expect(graph.nodes.get(key())!.metadata['R.Status']).toEqual(['Completed']);
    expect(getNodeStatus(graph, graph.nodes.get(key('HEADER', 'header'))!).state).toBe('in-progress');
    expect(graph.fields[0].kinds).toEqual(['equipment', 'header']);
    expect(settings.detailsFor('equipment').some(item => item.field.key === 'R.Status')).toBe(true);
    expect(settings.detailsFor('header').some(item => item.field.key === 'R.Status')).toBe(true);
    expect(graph.nodes.get(key('L2-A', 'l2'))!.metadata['R.Status']).toBeUndefined();
  });

  it.each(['Complete', 'NotStarted', 'in-progress', 'Ready', 'Awaiting power', '__proto__', 'constructor', 1, false])('keeps unknown status %s explicit without inferring completion', value => {
    const graph = parseDataView(view([row('EQ-1', value)]));
    expect(getNodeStatus(graph, graph.nodes.get(key())!)).toEqual({ state: 'unknown', label: 'Unknown status', values: [String(value)] });
  });

  it('does not invent a category for missing, blank, or unavailable records', () => {
    const graph = parseDataView(view([row('EQ-1', null), row('EQ-2', ' \t ')]));
    for (const id of ['EQ-1', 'EQ-2']) expect(getNodeStatus(graph, graph.nodes.get(key(id))!)).toEqual({ state: 'unknown', label: 'No status', values: [] });
    expect(hasStatusBinding(graph)).toBe(true);
    const absent = parseDataView(view([row('EQ-1')], []));
    expect(hasStatusBinding(absent)).toBe(false);
    expect(getNodeStatus(absent, absent.nodes.get(key())!).state).toBe('unknown');
  });

  it('deduplicates repeated rows, recognizes formatting-only duplicates and preserves actual status conflicts', () => {
    const graph = parseDataView(view([row('EQ-1', 'Completed'), row('EQ-1', 'Completed'), row('EQ-1', ' completed '), row('EQ-2', 'Completed'), row('EQ-2', 'In Progress')]));
    expect(getNodeStatus(graph, graph.nodes.get(key())!)).toEqual({ state: 'completed', label: 'Completed', values: ['Completed', ' completed '] });
    expect(getNodeStatus(graph, graph.nodes.get(key('EQ-2'))!)).toEqual({ state: 'conflict', label: 'Conflict', values: ['Completed', 'In Progress'] });
    expect(graph.nodes.get(key('EQ-2'))!.issues.join(' ')).toContain('Conflicting values');
  });

  it('prefers explicit role regardless of its label, including a blank value, over a compatible legacy column', () => {
    const fields = [field('R.Legacy', 'nodeDetail'), field('R.Explicit', 'status', 'Commissioning state')];
    const graph = parseDataView(view([row('EQ-1', 'Completed', 'In Progress'), row('EQ-2', 'Completed', null)], fields));
    expect(getNodeStatus(graph, graph.nodes.get(key())!).state).toBe('in-progress');
    expect(getNodeStatus(graph, graph.nodes.get(key('EQ-2'))!)).toEqual({ state: 'unknown', label: 'No status', values: [] });
  });

  it('uses only one unambiguous legacy equipment-detail Status column and rejects competing columns', () => {
    const single = parseDataView(view([row('EQ-1', 'Completed')], [field('R.Legacy', 'nodeDetail', ' status ')]));
    expect(hasStatusBinding(single)).toBe(true); expect(getNodeStatus(single, single.nodes.get(key())!).state).toBe('completed');
    const ambiguous = parseDataView(view([row('EQ-1', 'Completed', 'Completed')], [field('R.First', 'nodeDetail'), field('R.Second', 'nodeDetail')]));
    expect(hasStatusBinding(ambiguous)).toBe(false); expect(getNodeStatus(ambiguous, ambiguous.nodes.get(key())!).state).toBe('conflict');
    const malformed = parseDataView(view([row('EQ-1', 'Completed', 'Not Started')], [field('R.First'), field('R.Second')]));
    expect(hasStatusBinding(malformed)).toBe(true); expect(getNodeStatus(malformed, malformed.nodes.get(key())!).state).toBe('conflict');
  });

  it('preserves explicit precedence across repeated query-name role wells in either column order', () => {
    for (const fields of [[field('R.Shared', 'nodeDetail', 'Owner'), field('R.Shared')], [field('R.Shared'), field('R.Shared', 'nodeDetail', 'Owner')]]) {
      const graph = parseDataView(view([row('EQ-1', 'Completed', 'Completed')], fields));
      expect(graph.fields).toHaveLength(1); expect(graph.fields[0].column.roles?.status).toBe(true);
      expect(hasStatusBinding(graph)).toBe(true); expect(getNodeStatus(graph, graph.nodes.get(key())!).state).toBe('completed');
    }
  });

  it('never colors milestones or unavailable references from equipment association', () => {
    const graph = parseDataView(view([['Alpha', 'EQ-1', 'equipment', 'L2-A', 'L1-A', 'MISSING', 'Completed']]));
    for (const node of graph.nodes.values()) if (node.kind === 'l1' || node.kind === 'l2' || node.kind === 'unresolved') expect(getNodeStatus(graph, node).state).toBe('unknown');
    const schedule = parseDataView(view([row('EQ-1', 'Completed')], [field('R.Plan', 'milestoneDetail')]));
    expect(hasStatusBinding(schedule)).toBe(false);
    expect(getNodeStatus(schedule, schedule.nodes.get(key('L2-A', 'l2'))!).state).toBe('unknown');
  });

  it('keeps duplicate tags isolated by project and refreshes incremental metadata conflicts', () => {
    const store = new SsmDataStore(), first = store.update(view([row('EQ-1', 'Completed')], undefined, true), 0), revision = first.graph.revision;
    expect(getNodeStatus(first.graph, first.graph.nodes.get(key())!).state).toBe('completed');
    const second = store.update(view([row('EQ-1', 'In Progress'), ['Beta', 'EQ-1', 'equipment', 'L2-A', 'L1-A', '', 'Completed']]), 2);
    expect(second.graph).toBe(first.graph); expect(second.graph.revision).toBeGreaterThan(revision);
    expect(getNodeStatus(second.graph, second.graph.nodes.get(key())!).state).toBe('conflict');
    expect(getNodeStatus(second.graph, second.graph.nodes.get(key('EQ-1', 'equipment', 'Beta'))!).state).toBe('completed');
  });

  it('resolves field identity once per graph revision instead of scanning fields for each card/export row', () => {
    const graph = parseDataView(view([row('EQ-1', 'Completed'), row('EQ-2', 'Not Started')])), fields = graph.fields;
    const scans = vi.spyOn(fields, Symbol.iterator);
    for (let count = 0; count < 100; count++) { getNodeStatus(graph, graph.nodes.get(key())!); getNodeStatus(graph, graph.nodes.get(key('EQ-2'))!); hasStatusBinding(graph); }
    expect(scans).toHaveBeenCalledTimes(1);
    graph.revision++; hasStatusBinding(graph); expect(scans).toHaveBeenCalledTimes(2);
  });

  it('refreshes a replaced field descriptor list even when graph data revision stays unchanged', () => {
    const graph = parseDataView(view([row('EQ-1', 'Completed')], [field('R.Legacy', 'nodeDetail')])), revision = graph.revision;
    expect(hasStatusBinding(graph)).toBe(true);
    graph.fields = graph.fields.map(item => ({ ...item, label: 'Other', column: { ...item.column, displayName: 'Other' } }));
    expect(graph.revision).toBe(revision); expect(hasStatusBinding(graph)).toBe(false);
    expect(getNodeStatus(graph, graph.nodes.get(key())!).state).toBe('unknown');
  });

  it('adds only an optional scalar Status role and optional ExportContent privilege to the host contract', () => {
    expect(capabilities.dataRoles.find(role => role.name === 'status')?.kind).toBe('Grouping');
    expect(capabilities.dataViewMappings[0].conditions[0].status).toEqual({ max: 1 });
    expect(capabilities.dataViewMappings[0].table.rows.select.some(selection => selection.for.in === 'status')).toBe(true);
    expect(capabilities.privileges).toEqual([{ name: 'ExportContent', essential: false }]);
  });
});
