import type powerbi from 'powerbi-visuals-api';
import type { ScopeFilters } from '../types';

export interface ViewState {
  version: 1;
  scope: string;
  filters: ScopeFilters;
  camera: { x: number; y: number; k: number };
  viewerTheme: 'light' | 'dark' | null;
  startCollapsed: boolean;
  authorTheme: 'auto' | 'light' | 'dark';
  collapsed: string[];
  expandedParents: string[];
  collapsedParents: string[];
  expandedEquipment: string[];
  collapsedEquipment: string[];
  forcedKeys: string[];
  parentOffsets: [string, number][];
  branchLimits: [string, number][];
  branchOffsets: [string, number][];
  siblingOffsets: [string, number][];
  treeFocus: [string, string][];
  selectedKey: string | null;
  selectedOccurrenceId: string | null;
  drawerOpen: boolean;
  drawerTab: 'overview' | 'dependencies' | 'connections';
  connectionOffset: number;
  dependencyOffset: number;
  dependencyDiscipline: string | null;
  allConnections: boolean;
  quickStates: { sourceKey: string; occurrenceId: string; groupKey: string; direction: 'in' | 'out'; offset: number }[];
  trail: 'parent' | 'dependency' | null;
  highlightFieldKey: string;
  highlightedValues: string[];
  search: string;
  loadingPaused: boolean;
}

const MAX_BYTES = 500 * 1024;
const MAX_ENTRIES = 8192;
const MAX_KEY = 65536;
const MAX_OFFSET = 10000000;
const utf8 = new TextEncoder();
const own = (object: Record<string, unknown>, key: string): boolean => Object.prototype.hasOwnProperty.call(object, key);
const invalid = (): never => { throw new Error('Invalid persisted view state'); };
function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : invalid();
}
function text(value: unknown, max = MAX_KEY): string {
  return typeof value === 'string' && value.length <= max ? value : invalid();
}
function nullableText(values: Record<string, unknown>, key: string): string | null {
  return !own(values, key) || values[key] === null ? null : text(values[key]);
}
function bool(values: Record<string, unknown>, key: string, fallback: boolean): boolean {
  if (!own(values, key)) return fallback;
  return typeof values[key] === 'boolean' ? values[key] as boolean : invalid();
}
function number(values: Record<string, unknown>, key: string, fallback: number, min: number, max: number, integer = false): number {
  if (!own(values, key)) return fallback;
  const value = values[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) return invalid();
  const bounded = Math.max(min, Math.min(max, value));
  return integer ? Math.floor(bounded) : bounded;
}
function choice<T extends string>(values: Record<string, unknown>, key: string, choices: readonly T[], fallback: T): T {
  if (!own(values, key)) return fallback;
  return choices.includes(values[key] as T) ? values[key] as T : invalid();
}
function list(values: Record<string, unknown>, key: string, max = MAX_ENTRIES): unknown[] {
  if (!own(values, key)) return [];
  const items = values[key];
  return Array.isArray(items) && items.length <= max ? items : invalid();
}
function keys(values: Record<string, unknown>, key: string, max = MAX_ENTRIES, stringLimit = MAX_KEY): string[] {
  return [...new Set(list(values, key, max).map(item => text(item, stringLimit)))];
}
function offsets(values: Record<string, unknown>, key: string): [string, number][] {
  const entries = list(values, key).map(item => {
    if (!Array.isArray(item) || item.length !== 2) return invalid();
    return [text(item[0]), number({ value: item[1] }, 'value', 0, 0, MAX_OFFSET, true)] as [string, number];
  });
  return [...new Map(entries)];
}

/** Only explicitly supported UI properties survive parsing; source rows and identities are never copied. */
function normalize(value: unknown, scope: string): ViewState {
  const values = object(value);
  if (values.version !== 1 || text(values.scope, 131072) !== scope) return invalid();
  const filters = own(values, 'filters') ? object(values.filters) : {};
  const camera = own(values, 'camera') ? object(values.camera) : {};
  let projects: string[] | null = own(filters, 'projects') && filters.projects === null ? null : [];
  if (own(filters, 'projects') && filters.projects !== null) projects = keys(filters, 'projects', 1024, 4096);
  let viewerTheme: ViewState['viewerTheme'] = null;
  if (own(values, 'viewerTheme') && values.viewerTheme !== null) viewerTheme = choice(values, 'viewerTheme', ['light', 'dark'] as const, 'light');
  let trail: ViewState['trail'] = null;
  if (own(values, 'trail') && values.trail !== null) trail = choice(values, 'trail', ['parent', 'dependency'] as const, 'parent');
  const treeFocus: [string, string][] = list(values, 'treeFocus').map(item => {
    if (!Array.isArray(item) || item.length !== 2) return invalid();
    return [text(item[0]), text(item[1])];
  });
  const quickStates: ViewState['quickStates'] = list(values, 'quickStates', 8).map(item => {
    const state = object(item);
    return { sourceKey: text(state.sourceKey), occurrenceId: text(state.occurrenceId), groupKey: text(state.groupKey), direction: choice(state, 'direction', ['in', 'out'], 'out'), offset: number(state, 'offset', 0, 0, MAX_OFFSET, true) };
  });
  return {
    version: 1, scope,
    filters: { projects, discipline: nullableText(filters, 'discipline'), l1Key: nullableText(filters, 'l1Key'), l2Key: nullableText(filters, 'l2Key'), includeContext: bool(filters, 'includeContext', true), showParents: bool(filters, 'showParents', true), showDependencies: bool(filters, 'showDependencies', true) },
    camera: { x: number(camera, 'x', 0, -1000000000, 1000000000), y: number(camera, 'y', 0, -1000000000, 1000000000), k: number(camera, 'k', 1, .12, 3) },
    viewerTheme, startCollapsed: bool(values, 'startCollapsed', false), authorTheme: choice(values, 'authorTheme', ['auto', 'light', 'dark'], 'auto'),
    collapsed: keys(values, 'collapsed'), expandedParents: keys(values, 'expandedParents'), collapsedParents: keys(values, 'collapsedParents'), expandedEquipment: keys(values, 'expandedEquipment'), collapsedEquipment: keys(values, 'collapsedEquipment'), forcedKeys: keys(values, 'forcedKeys'),
    parentOffsets: offsets(values, 'parentOffsets'), branchLimits: offsets(values, 'branchLimits'), branchOffsets: offsets(values, 'branchOffsets'), siblingOffsets: offsets(values, 'siblingOffsets'), treeFocus: [...new Map(treeFocus)],
    selectedKey: nullableText(values, 'selectedKey'), selectedOccurrenceId: nullableText(values, 'selectedOccurrenceId'), drawerOpen: bool(values, 'drawerOpen', false), drawerTab: choice(values, 'drawerTab', ['overview', 'dependencies', 'connections'], 'overview'), connectionOffset: number(values, 'connectionOffset', 0, 0, MAX_OFFSET, true), dependencyOffset: number(values, 'dependencyOffset', 0, 0, MAX_OFFSET, true), dependencyDiscipline: nullableText(values, 'dependencyDiscipline'), allConnections: bool(values, 'allConnections', false), quickStates, trail,
    highlightFieldKey: own(values, 'highlightFieldKey') ? text(values.highlightFieldKey) : '', highlightedValues: keys(values, 'highlightedValues'), search: own(values, 'search') ? text(values.search, 4096) : '', loadingPaused: bool(values, 'loadingPaused', false),
  };
}

/** A different bound schema never inherits another schema's exploration state. */
export function parseViewState(raw: unknown, scope: string): ViewState | null {
  if (typeof raw !== 'string' || raw.length > MAX_BYTES || utf8.encode(raw).length > MAX_BYTES) return null;
  try {
    const state = normalize(JSON.parse(raw), scope);
    return utf8.encode(JSON.stringify(state)).length <= MAX_BYTES ? state : null;
  } catch { return null; }
}

/** Revalidation strips accidental source-data extras and refuses oversized state without truncating identities. */
export function serializeViewState(state: ViewState): string | null {
  try {
    const normalized = normalize(state, text(state.scope, 131072));
    const raw = JSON.stringify(normalized);
    return raw.length <= MAX_BYTES && utf8.encode(raw).length <= MAX_BYTES ? raw : null;
  } catch { return null; }
}

/** Binding-only scope: order, row values, loading segments, and author formats cannot invalidate it. */
export function viewStateScope(dataView?: powerbi.DataView): string {
  const columns = dataView?.table?.columns ?? dataView?.metadata?.columns ?? [];
  const bindings = new Map<string, [string, string]>();
  columns.forEach((column, index) => {
    const identity = column.queryName || `${index}:${column.displayName}`;
    for (const [role, bound] of Object.entries(column.roles ?? {})) if (bound) {
      const binding: [string, string] = [role, identity];
      bindings.set(JSON.stringify(binding), binding);
    }
  });
  return JSON.stringify([...bindings].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, binding]) => binding));
}
