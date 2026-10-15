import { describe, expect, it } from 'vitest';
import type powerbi from 'powerbi-visuals-api';
import { parseViewState, serializeViewState, viewStateScope, type ViewState } from '../ui/view-state';

const scope = '[["equipmentId","Registry.Id"],["project","Registry.Project"]]';
const minimal = (values: Record<string, unknown> = {}): string => JSON.stringify({ version: 1, scope, ...values });
const base = (): ViewState => parseViewState(minimal(), scope)!;

describe('persisted exploration view state', () => {
  it('roundtrips all navigation state with exact scoped identities and typed highlight value keys', () => {
    const key = JSON.stringify(['equipment', 'Alpha', 'EQ-1']), occurrence = JSON.stringify([JSON.stringify(['L1', 'L2']), key, 'tree']);
    const state: ViewState = {
      ...base(), filters: { projects: ['Alpha', 'Beta'], discipline: 'Mechanical', l1Key: 'L1', l2Key: 'L2', includeContext: false, showParents: false, showDependencies: true },
      camera: { x: -100.25, y: 321.75, k: .8 }, viewerTheme: 'dark', authorTheme: 'auto',
      collapsed: ['branch'], expandedParents: ['L1'], collapsedParents: ['L1-B'], expandedEquipment: [occurrence], collapsedEquipment: ['other-occurrence'], forcedKeys: [key],
      parentOffsets: [['L1', 12]], branchLimits: [['branch', 30]], branchOffsets: [['branch', 30]], siblingOffsets: [['siblings', 60]], treeFocus: [['branch', key]],
      selectedKey: key, selectedOccurrenceId: occurrence, drawerOpen: true, drawerTab: 'connections', connectionOffset: 40, allConnections: true,
      quickStates: [{ sourceKey: key, occurrenceId: occurrence, groupKey: 'branch', direction: 'in', offset: 5 }], trail: 'dependency',
      highlightFieldKey: JSON.stringify(['metadata', 'Registry.Status']), highlightedValues: [JSON.stringify(['number', 0]), JSON.stringify(['string', '0']), JSON.stringify(['boolean', false])], search: '設備', loadingPaused: true,
    };
    const before = JSON.stringify(state), serialized = serializeViewState(state)!;
    expect(parseViewState(serialized, scope)).toEqual(state);
    expect(JSON.stringify(state)).toBe(before);
    expect(serialized).not.toContain('rowIndices'); expect(serialized).not.toContain('SelectionId');
  });

  it('defaults absent optional fields safely while preserving intentionally empty project scope', () => {
    const state = base();
    expect(state).toMatchObject({ version: 1, scope, filters: { projects: [], discipline: null, l1Key: null, l2Key: null, includeContext: true, showParents: true, showDependencies: true }, camera: { x: 0, y: 0, k: 1 }, viewerTheme: null, authorTheme: 'auto', drawerOpen: false, drawerTab: 'overview', trail: null, loadingPaused: false });
    expect(state.quickStates).toEqual([]); expect(state.expandedEquipment).toEqual([]);
    expect(parseViewState(minimal({ filters: { projects: [] } }), scope)!.filters.projects).toEqual([]);
  });

  it.each([
    undefined, null, {}, '', 'not json', '[]', 'null', '"text"',
    minimal({ version: 2 }), minimal({ version: '1' }), minimal({ scope: 'another-binding' }),
    minimal({ filters: [] }), minimal({ filters: { projects: 'Alpha' } }), minimal({ filters: { showParents: 'yes' } }),
    minimal({ camera: null }), minimal({ camera: { k: '1' } }), minimal({ camera: { x: null } }),
    minimal({ viewerTheme: 'auto' }), minimal({ authorTheme: 'unknown' }), minimal({ drawerTab: 'data' }), minimal({ trail: 'all' }),
    minimal({ expandedEquipment: [3] }), minimal({ forcedKeys: {} }), minimal({ parentOffsets: [['branch']] }), minimal({ treeFocus: [['branch', false]] }),
    minimal({ quickStates: [{ sourceKey: 'one', occurrenceId: 'occurrence', groupKey: 'branch', direction: 'both' }] }),
    minimal({ quickStates: Array.from({ length: 9 }, () => ({ sourceKey: 'one', occurrenceId: 'occurrence', groupKey: 'branch' })) }),
  ])('rejects malformed supplied schema, unsupported version, or another scope (%#)', raw => {
    expect(parseViewState(raw, scope)).toBeNull();
  });

  it('clamps finite cameras and offsets but rejects non-finite serializer values', () => {
    const state = parseViewState(minimal({ camera: { x: 1e12, y: -1e12, k: 0 }, siblingOffsets: [['list', -20], ['second', 12.9]], connectionOffset: 1e12 }), scope)!;
    expect(state.camera).toEqual({ x: 1e9, y: -1e9, k: .12 });
    expect(state.siblingOffsets).toEqual([['list', 0], ['second', 12]]); expect(state.connectionOffset).toBe(10000000);
    expect(parseViewState(minimal({ camera: { k: 50 } }), scope)!.camera.k).toBe(3);
    expect(serializeViewState({ ...base(), camera: { x: Number.POSITIVE_INFINITY, y: 0, k: 1 } })).toBeNull();
    expect(serializeViewState({ ...base(), connectionOffset: Number.NaN })).toBeNull();
  });

  it('drops unsupported source payloads and cannot copy prototype pollution into restored state', () => {
    const raw = minimal({ metadata: { secret: 'excluded' }, rows: ['excluded'], SelectionIds: ['excluded'], '__proto__': { polluted: true } });
    const state = parseViewState(raw, scope)!;
    expect(state).not.toHaveProperty('metadata'); expect(state).not.toHaveProperty('rows'); expect(state).not.toHaveProperty('polluted');
    const serialized = serializeViewState(Object.assign(state, { metadata: { secret: 'excluded' } }))!;
    expect(serialized).not.toContain('excluded');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    const hostile = `{"version":1,"scope":${JSON.stringify(scope)},"__proto__":{"polluted":true},"collapsed":["__proto__"]}`;
    expect(parseViewState(hostile, scope)!.collapsed).toEqual(['__proto__']);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('rejects oversized UTF-8/identifiers/collections instead of truncating a key or silently changing its identity', () => {
    const longOccurrence = 'dep:'.repeat(12000);
    expect(parseViewState(minimal({ selectedOccurrenceId: longOccurrence }), scope)!.selectedOccurrenceId).toBe(longOccurrence);
    expect(parseViewState(minimal({ selectedKey: 'x'.repeat(65537) }), scope)).toBeNull();
    expect(parseViewState(minimal({ search: 'x'.repeat(4097) }), scope)).toBeNull();
    expect(parseViewState(minimal({ collapsed: Array(8193).fill('key') }), scope)).toBeNull();
    const unicode = Array.from({ length: 10 }, (_, index) => `${index}:${'界'.repeat(20000)}`);
    const raw = minimal({ expandedEquipment: unicode });
    expect(raw.length).toBeLessThan(500 * 1024);
    expect(new TextEncoder().encode(raw).length).toBeGreaterThan(500 * 1024);
    expect(parseViewState(raw, scope)).toBeNull(); expect(serializeViewState({ ...base(), expandedEquipment: unicode })).toBeNull();
  });

  it('deduplicates repeated keys/maps without sorting or mutating original input', () => {
    const state = base(); state.forcedKeys = ['B', 'A', 'B']; state.siblingOffsets = [['list', 1], ['list', 2]];
    const result = parseViewState(serializeViewState(state), scope)!;
    expect(result.forcedKeys).toEqual(['B', 'A']); expect(result.siblingOffsets).toEqual([['list', 2]]);
    expect(state.forcedKeys).toEqual(['B', 'A', 'B']); expect(state.siblingOffsets).toHaveLength(2);
  });
});

describe('binding-only view scope', () => {
  const columns: powerbi.DataViewMetadataColumn[] = [
    { displayName: 'Project', queryName: 'Registry.Project', roles: { project: true } },
    { displayName: 'Equipment ID', queryName: 'Registry.Id', roles: { equipmentId: true } },
    { displayName: 'Status', queryName: 'Registry.Status', roles: { nodeDetail: true } },
  ];
  const dataView = (items = columns): powerbi.DataView => ({ metadata: { columns: items }, table: { columns: items, rows: [] } });

  it('survives role/column reorder, duplicate bindings, label and formatting changes, and data segments', () => {
    const before = viewStateScope(dataView());
    const after = dataView([...columns].reverse().map(column => ({ ...column, displayName: 'New label', objects: { detailEquipment: { visible: false } } })));
    after.table!.columns.push(columns[0]); after.table!.rows = [['Different rows']];
    after.metadata.segment = {}; after.metadata.objects = { appearance: { theme: 'dark' } };
    expect(viewStateScope(after)).toBe(before);
    expect(viewStateScope({ metadata: { columns } })).toBe(before);
    expect(viewStateScope()).toBe('[]');
  });

  it('changes when a true role/query binding changes while ignoring unbound metadata', () => {
    const before = viewStateScope(dataView());
    expect(viewStateScope(dataView(columns.map(column => column.queryName === 'Registry.Status' ? { ...column, queryName: 'Registry.Other' } : column)))).not.toBe(before);
    expect(viewStateScope(dataView(columns.map(column => column.queryName === 'Registry.Status' ? { ...column, roles: { milestoneDetail: true } } : column)))).not.toBe(before);
    expect(viewStateScope(dataView([...columns, { displayName: 'Unbound', queryName: 'Registry.Unbound', roles: { nodeDetail: false } }]))).toBe(before);
    expect(viewStateScope(dataView(columns.slice(0, 2)))).not.toBe(before);
  });

  it('uses the same index-and-displayName fallback as metadata parsing when queryName is unavailable', () => {
    const column = { displayName: 'Status', roles: { nodeDetail: true } };
    expect(viewStateScope(dataView([column]))).toBe(JSON.stringify([['nodeDetail', '0:Status']]));
  });
});
