import { describe, expect, it } from 'vitest';
import type powerbi from 'powerbi-visuals-api';
import { nodeKey, parseDataView } from '../model';
import type { DetailField, SsmGraph } from '../types';
import { DISCIPLINE_HIGHLIGHT_KEY, getHighlightFields, getHighlightIndex, highlightMatches, highlightValueKey, resolveHighlightField } from '../ui/highlighting';

const columns: powerbi.DataViewMetadataColumn[] = [
  { displayName: 'Project', queryName: 'R.Project', roles: { project: true } },
  { displayName: 'Equipment', queryName: 'R.Id', roles: { equipmentId: true } },
  { displayName: 'Discipline', queryName: 'R.Discipline', roles: { discipline: true } },
  { displayName: 'Status', queryName: 'R.Status', roles: { nodeDetail: true } },
  { displayName: 'Rating', queryName: 'R.Rating', roles: { nodeDetail: true } },
  { displayName: 'Date', queryName: 'R.Date', roles: { nodeDetail: true } },
  { displayName: 'Plan', queryName: 'R.Plan', roles: { milestoneDetail: true } },
];
const graphFor = (rows: unknown[][]): SsmGraph => parseDataView({ metadata: { columns }, table: { columns, rows: rows as powerbi.DataViewTableRow[] } });
const eq = (id: string, project = 'Alpha'): string => nodeKey('equipment', project, id);
const custom = (graph: SsmGraph, key: string) => getHighlightFields(graph.fields).find(field => field.metadataKey === key)!;

describe('source-backed equipment highlighting', () => {
  it('offers only equipment metadata and preserves stable field identity despite labels/order/visibility', () => {
    const field = (key: string, kinds: DetailField['kinds']): DetailField => ({ key, label: 'Status', kinds, column: { displayName: 'Status', queryName: key, objects: { detailEquipment: { visible: false } } } });
    const fields = [field('R.Hidden', ['equipment', 'header']), field('R.Other', ['equipment']), field('R.Plan', ['l2'])];
    const choices = getHighlightFields(fields);
    expect(choices.map(choice => choice.source)).toEqual(['discipline', 'metadata', 'metadata']);
    expect(choices.find(choice => choice.metadataKey === 'R.Hidden')?.label).toBe('Status · R.Hidden');
    const selected = choices.find(choice => choice.metadataKey === 'R.Hidden')!;
    expect(resolveHighlightField(getHighlightFields(fields.slice().reverse()), selected.key).metadataKey).toBe('R.Hidden');
    expect(resolveHighlightField(choices, 'removed').key).toBe(DISCIPLINE_HIGHLIGHT_KEY);
    expect(resolveHighlightField([]).source).toBe('discipline');
  });

  it('matches every declared discipline conflict with multi-value OR, without joining or changing the source', () => {
    const graph = graphFor([
      ['Alpha', 'ONE', 'Mechanical'], ['Alpha', 'ONE', 'Electrical'],
      ['Alpha', 'TWO', 'Mechanical'], ['Beta', 'ONE', 'Civil'], ['Alpha', 'MISSING', ''],
    ]);
    const discipline = resolveHighlightField(getHighlightFields(graph.fields));
    const index = getHighlightIndex(graph, discipline);
    const mechanical = highlightValueKey('Mechanical')!, electrical = highlightValueKey('Electrical')!;
    expect(index.values.find(value => value.key === mechanical)?.count).toBe(2);
    expect(index.conflictingNodeKeys.has(eq('ONE'))).toBe(true);
    expect(highlightMatches(index, eq('ONE'), new Set([electrical]))).toBe(true);
    expect(highlightMatches(index, eq('TWO'), new Set([electrical, mechanical]))).toBe(true);
    expect(highlightMatches(index, eq('ONE', 'Beta'), new Set([mechanical]))).toBe(false);
    expect(highlightMatches(index, eq('MISSING'), new Set([mechanical]))).toBe(false);
    expect(highlightMatches(index, eq('ONE'), new Set())).toBe(false);
    expect(index.missingNodeKeys.has(eq('MISSING'))).toBe(true);
    expect(graph.nodes.get(eq('ONE'))?.disciplines).toEqual(['Mechanical', 'Electrical']);
  });

  it('keeps typed metadata conflicts distinct, original dates intact, and missing values unclassified', () => {
    const date = new Date('2026-10-09T12:00:00Z');
    const graph = graphFor([
      ['Alpha', 'ONE', '', 'Ready', 0, date],
      ['Alpha', 'ONE', '', 'Blocked', false, new Date(date)],
      ['Alpha', 'TWO', '', 'Ready', '0', date.toISOString()],
      ['Alpha', 'MISSING', '', null, undefined, null],
    ]);
    const status = getHighlightIndex(graph, custom(graph, 'R.Status'));
    expect(status.conflictingNodeKeys.has(eq('ONE'))).toBe(true);
    expect(status.values.find(value => value.value === 'Ready')?.count).toBe(2);
    expect(highlightMatches(status, eq('ONE'), new Set([highlightValueKey('Blocked')!]))).toBe(true);
    expect(status.values.some(value => value.value === null || value.value === '')).toBe(false);
    const rating = getHighlightIndex(graph, custom(graph, 'R.Rating'));
    expect(new Set(rating.values.map(value => value.key)).size).toBe(3);
    expect(rating.values.find(value => value.value === 0)?.label).toBe('0 (number)');
    expect(rating.values.find(value => value.value === '0')?.label).toBe('0 (string)');
    expect(rating.values.find(value => value.value === false)?.value).toBe(false);
    const dates = getHighlightIndex(graph, custom(graph, 'R.Date'));
    expect(dates.values).toHaveLength(2);
    expect(dates.values.find(value => value.value instanceof Date)?.value).toBe(date);
    expect(highlightValueKey(date)).not.toBe(highlightValueKey(date.toISOString()));
    expect(highlightValueKey(null)).toBeNull(); expect(highlightValueKey(undefined)).toBeNull();
    expect(highlightValueKey('')).toBeNull(); expect(highlightValueKey(new Date('invalid'))).toBeNull();
    expect(highlightValueKey(Number.NaN)).toBeNull();
  });

  it('never classifies milestones, headers, or unresolved references as physical equipment', () => {
    const graph = graphFor([['Alpha', 'ONE', 'Mechanical', 'Ready'], ['Alpha', 'HEADER', 'Civil', 'Ready']]);
    graph.nodes.get(eq('HEADER'))!.kind = 'header';
    const index = getHighlightIndex(graph, custom(graph, 'R.Status'));
    expect(index.keysByValue.get(highlightValueKey('Ready')!)).toEqual(new Set([eq('ONE')]));
    expect(index.valueKeysByNode.has(eq('HEADER'))).toBe(false);
    expect(getHighlightFields(graph.fields).some(field => field.metadataKey === 'R.Plan')).toBe(false);
  });

  it('reuses same-revision indexes, bounds field caches, and refreshes late source values on revision changes', () => {
    const graph = graphFor([['Alpha', 'ONE', 'Mechanical', 'Ready', 10, new Date('2026-10-09')]]);
    const status = custom(graph, 'R.Status'), rating = custom(graph, 'R.Rating'), date = custom(graph, 'R.Date');
    const first = getHighlightIndex(graph, status);
    expect(getHighlightIndex(graph, status)).toBe(first);
    getHighlightIndex(graph, rating); getHighlightIndex(graph, date);
    expect(getHighlightIndex(graph, status)).not.toBe(first);
    graph.nodes.get(eq('ONE'))!.metadata['R.Status'].push('Blocked'); graph.revision++;
    const refreshed = getHighlightIndex(graph, status);
    expect(refreshed.revision).toBe(graph.revision);
    expect(refreshed.values.some(value => value.value === 'Blocked')).toBe(true);
    expect(first.values.some(value => value.value === 'Blocked')).toBe(false);
  });

  it('provides searchable late high-cardinality values without imposing a silent dropdown cutoff', () => {
    const graph = graphFor(Array.from({ length: 10000 }, (_, index) => ['Alpha', `EQ-${index}`, 'Mechanical', `Status-${index}`]));
    const index = getHighlightIndex(graph, custom(graph, 'R.Status'));
    expect(index.values).toHaveLength(10000);
    const selected = new Set([highlightValueKey('Status-9999')!]);
    expect(highlightMatches(index, eq('EQ-9999'), selected)).toBe(true);
    expect(highlightMatches(index, eq('EQ-1'), selected)).toBe(false);
    expect(getHighlightIndex(graph, custom(graph, 'R.Status'))).toBe(index);
  });
});
