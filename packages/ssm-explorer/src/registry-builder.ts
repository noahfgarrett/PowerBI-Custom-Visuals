import type powerbi from 'powerbi-visuals-api';
import type { DetailField, EdgeKind, NodeKind, SsmEdge, SsmGraph, SsmNode } from './types';
import { createGraphIndex, indexNode, indexSuppliedRow, unindexNode, indexEdge, unindexEdge } from './graph-index';

type Reference = { id: string; project?: string; ambiguous?: boolean; issue?: string };
type DetailBinding = { field: DetailField; index: number; kinds: NodeKind[] };
type ConnectionGroup = {
  key: string; from: SsmNode; kind: 'parent' | 'dependency'; raw: string; companion: string; systemRoot: boolean;
  rows: number[]; bindings: Map<string, EdgeRecord>; watched: Set<string>; projectWatch: string;
  warnings: Set<string>;
};
type EdgeRecord = { edge: SsmEdge; rows: Set<number>; owners: Set<ConnectionGroup>; staticRows: Set<number> };
const DETAIL_ROLES: Record<string, NodeKind[]> = {
  nodeDetail: ['equipment', 'header'], status: ['equipment', 'header'], milestoneDetail: ['l2'], parentMilestoneDetail: ['l1'],
};
const text = (value: unknown): string => value == null ? '' : String(value).trim();
const largeArraySets = new WeakMap<object, Set<unknown>>();
const addUnique = <T>(values: T[], value: T): void => {
  // Small associations stay compact; unusually wide repeated assignments use
  // a set after a bounded scan, preventing quadratic deduplication.
  if (values.length < 16) { if (!values.includes(value)) values.push(value); return; }
  let seen = largeArraySets.get(values);
  if (!seen) { seen = new Set(values); largeArraySets.set(values, seen); }
  if (!seen.has(value)) { seen.add(value); values.push(value); }
};
const issue = (target: { issues: string[] }, message: string): void => addUnique(target.issues, message);
const CYCLE_ISSUE = 'Connection cycle; traversal stops at already visited nodes.';
export const nodeKey = (kind: NodeKind, project: string, id: string): string => JSON.stringify([kind, project, id]);
const syntheticKey = (kind: NodeKind, project: string, reason: string, scope = ''): string => JSON.stringify([kind, project, null, reason, scope]);
const identityKey = (project: string, id: string): string => JSON.stringify([project, id]);
const fieldKey = (column: powerbi.DataViewMetadataColumn, index: number): string => column.queryName || index + ':' + column.displayName;
const detailKinds = (column: powerbi.DataViewMetadataColumn): NodeKind[] => [...new Set(Object.entries(DETAIL_ROLES).filter(([role]) => column.roles?.[role]).flatMap(([, kinds]) => kinds))];
function valueKey(value: powerbi.PrimitiveValue): string {
  if (value instanceof Date) return 'date:' + value.getTime();
  if (typeof value === 'number' && Object.is(value, -0)) return 'number:-0';
  return typeof value + ':' + String(value);
}
/** Row indexes arrive in ascending order; no linear membership search is needed. */
function appendRow(rows: number[], index: number): void { if (rows[rows.length - 1] !== index) rows.push(index); }
export function schemaKey(columns: powerbi.DataViewMetadataColumn[]): string {
  return JSON.stringify(columns.map((column, index) => [fieldKey(column, index), Object.keys(column.roles || {}).filter(role => column.roles?.[role]).sort()]));
}
function emptyGraph(): SsmGraph {
  return { revision: 0, index: createGraphIndex(), nodes: new Map(), edges: [], fields: [], projects: [], disciplines: [], warnings: [], missingRoles: [], rowCount: 0, partial: false };
}

function splitList(value: string, known?: Set<string>): string[] {
  if (!value) return [];
  if (known?.has(value)) return [value];
  return value.split(/[\r\n;,]+/).map(text).filter(Boolean);
}

function dependencyReferences(value: string, companion: string, ownProject: string, knownProjects: Set<string>, hasTag: (project: string, id: string) => boolean): Reference[] {
  if (!value || /^(?:N\/?A|-)$/i.test(value)) return [];
  const projects = splitList(companion, knownProjects);
  const defaultProject = projects.length === 1 ? projects[0] : ownProject;
  let refs: Reference[];
  // Exact matching comes first: equipment tags can themselves contain delimiters.
  if (projects.length <= 1 && hasTag(defaultProject, value)) refs = [{ id: value }];
  else if (value.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (!Array.isArray(parsed)) throw new Error('not an array');
      refs = parsed.map((entry): Reference => {
        if (typeof entry === 'string' || typeof entry === 'number') return { id: text(entry) };
        if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
          const record = entry as Record<string, unknown>;
          if (typeof record.id === 'string' || typeof record.id === 'number') {
            return { id: text(record.id), project: text(record.project) || undefined };
          }
        }
        return { id: JSON.stringify(entry), ambiguous: true, issue: 'Unsupported dependency reference; supply an ID or an object with id and project.' };
      }).filter(ref => !!ref.id);
    } catch {
      refs = [{ id: value, ambiguous: true, issue: 'Dependency JSON could not be parsed.' }];
    }
  } else refs = splitList(value).map(id => ({ id }));
  return refs.map((ref, index) => {
    if (ref.project || ref.ambiguous) return ref;
    if (!projects.length) return { ...ref, project: ownProject };
    if (projects.length === 1) return { ...ref, project: projects[0] };
    if (projects.length === refs.length) return { ...ref, project: projects[index] };
    return { ...ref, ambiguous: true, issue: 'Dependency projects do not align with dependency IDs; target project is unresolved.' };
  });
}

/** Mutable ingestion state remains local to one visual instance. It never reads old table rows again on append. */
export class RegistryBuilder {
  readonly graph = emptyGraph();
  private columns: powerbi.DataViewMetadataColumn[] = [];
  private roles = new Map<string, number>();
  private bindings: DetailBinding[] = [];
  private identities = new Map<string, Set<string>>();
  private edges = new Map<string, EdgeRecord>();
  private groups = new Map<string, ConnectionGroup>();
  private identityWatchers = new Map<string, Set<ConnectionGroup>>();
  private projectWatchers = new Map<string, Set<ConnectionGroup>>();
  private projects = new Set<string>();
  private disciplines = new Set<string>();
  private labels = new Map<string, string>();
  private metadataSeen = new Map<string, Map<string, Set<string>>>();
  private roleWarnings: string[] = [];
  private invalidRows = 0;
  private warningGroups = new Map<string, Set<ConnectionGroup>>();

  configure(columns: powerbi.DataViewMetadataColumn[]): void {
    this.columns = columns; this.roles.clear(); this.roleWarnings = [];
    const fields = new Map<string, DetailField>();
    for (let index = 0; index < columns.length; index++) {
      const column = columns[index];
      for (const [role, enabled] of Object.entries(column.roles || {})) if (enabled) {
        if (!this.roles.has(role)) this.roles.set(role, index);
        else if (!(role in DETAIL_ROLES)) this.roleWarnings.push('Multiple columns bound to ' + role + '; the first column supplies identity and relationships.');
      }
      const kinds = detailKinds(column); if (!kinds.length) continue;
      const key = fieldKey(column, index), previous = fields.get(key);
      if (previous) {
        kinds.forEach(kind => addUnique(previous.kinds, kind));
        // One query may occupy several wells. Preserve enabled binding roles so
        // explicit Status precedence remains independent of column order.
        const roles = { ...previous.column.roles };
        for (const [role, enabled] of Object.entries(column.roles || {})) if (enabled) roles[role] = true;
        previous.column = { ...previous.column, roles };
      }
      else fields.set(key, { key, label: column.displayName, kinds, column });
    }
    this.graph.fields = [...fields.values()];
    this.bindings = columns.flatMap((column, index) => {
      const field = fields.get(fieldKey(column, index)), kinds = detailKinds(column);
      return field && kinds.length ? [{ field, index, kinds }] : [];
    });
    this.graph.missingRoles = ['project', 'equipmentId'].filter(role => !this.roles.has(role));
  }

  private read(row: powerbi.DataViewTableRow, role: string): string { return text(row[this.roles.get(role) ?? -1]); }
  private ensureNode(kind: NodeKind, project: string, id: string, label = id, key = nodeKey(kind, project, id)): SsmNode {
    let node = this.graph.nodes.get(key);
    if (!node) {
      node = { key, kind, id, label, project, discipline: '', disciplines: [], milestoneKeys: [], parentMilestoneKeys: [], rowIndices: [], metadata: Object.create(null), issues: [] };
      this.graph.nodes.set(key, node); indexNode(this.graph.index!, node);
    }
    return node;
  }
  private mergeDetails(node: SsmNode, row: powerbi.DataViewTableRow): void {
    for (const { field, index, kinds } of this.bindings) {
      if (!kinds.includes(node.kind)) continue;
      const value = row[index]; if (value == null || value === '') continue;
      let fields = this.metadataSeen.get(node.key);
      if (!fields) { fields = new Map(); this.metadataSeen.set(node.key, fields); }
      let seen = fields.get(field.key);
      if (!seen) { seen = new Set(); fields.set(field.key, seen); }
      const key = valueKey(value);
      if (seen.has(key)) continue;
      seen.add(key); const values = node.metadata[field.key] || (node.metadata[field.key] = []); values.push(value);
      if (values.length > 1) issue(node, 'Conflicting values for ' + field.label + '.');
    }
  }
  private ensureEdge(from: SsmNode, to: SsmNode, kind: EdgeKind): EdgeRecord {
    const key = JSON.stringify([kind, from.key, to.key]); let record = this.edges.get(key);
    if (!record) {
      const edge: SsmEdge = { key, from: from.key, to: to.key, kind, rowIndices: [], issues: [] };
      record = { edge, rows: new Set(), owners: new Set(), staticRows: new Set() };
      this.edges.set(key, record); indexEdge(this.graph.index!, edge);
      if (from.key === to.key) { issue(edge, 'Self reference.'); issue(from, 'Self reference.'); }
    }
    return record;
  }
  private appendEdgeRow(record: EdgeRecord, index: number, isStatic = false): void {
    if (isStatic) record.staticRows.add(index);
    if (!record.rows.has(index)) { record.rows.add(index); record.edge.rowIndices.push(index); }
  }
  private cleanupNode(key: string): void {
    const node = this.graph.nodes.get(key), index = this.graph.index!;
    if (!node || node.rowIndices.length || (node.kind !== 'unresolved' && node.kind !== 'header') || index.incoming.get(key)?.size || index.outgoing.get(key)?.size) return;
    this.graph.nodes.delete(key); unindexNode(index, node); this.metadataSeen.delete(key);
  }
  private detach(group: ConnectionGroup, record: EdgeRecord): void {
    record.owners.delete(group);
    if (!record.owners.size && !record.staticRows.size) {
      this.edges.delete(record.edge.key); unindexEdge(this.graph.index!, record.edge);
    } else {
      record.rows = new Set(record.staticRows);
      for (const owner of record.owners) for (const row of owner.rows) record.rows.add(row);
      record.edge.rowIndices = [...record.rows].sort((a, b) => a - b);
    }
  }
  private watch(group: ConnectionGroup, lookup: string): void {
    group.watched.add(lookup); let watchers = this.identityWatchers.get(lookup);
    if (!watchers) { watchers = new Set(); this.identityWatchers.set(lookup, watchers); } watchers.add(group);
  }
  private clearWatches(group: ConnectionGroup): void {
    for (const lookup of group.watched) {
      const watchers = this.identityWatchers.get(lookup); watchers?.delete(group);
      if (!watchers?.size) this.identityWatchers.delete(lookup);
    }
    group.watched.clear();
    if (group.projectWatch) {
      const watchers = this.projectWatchers.get(group.projectWatch); watchers?.delete(group);
      if (!watchers?.size) this.projectWatchers.delete(group.projectWatch);
    }
    group.projectWatch = '';
  }
  private resolve(group: ConnectionGroup, ref: Reference): SsmNode {
    const project = ref.project ?? group.from.project, lookup = identityKey(project, ref.id);
    if (!ref.ambiguous) this.watch(group, lookup);
    const candidates = ref.ambiguous ? undefined : this.identities.get(lookup);
    if (group.systemRoot) {
      const header = candidates && [...candidates].map(key => this.graph.nodes.get(key)!).find(node => node.kind === 'header');
      return header || this.ensureNode('header', project, ref.id, ref.id, syntheticKey('header', project, 'system-root', ref.id));
    }
    if (candidates?.size === 1) return this.graph.nodes.get(candidates.values().next().value!)!;
    const key = ref.ambiguous ? syntheticKey('unresolved', group.from.project, group.kind, JSON.stringify([ref.id, ref.issue || ''])) : nodeKey('unresolved', project, ref.id);
    const target = this.ensureNode('unresolved', ref.ambiguous ? '' : project, ref.id, ref.id, key);
    issue(target, ref.issue || (candidates && candidates.size > 1 ? 'Reference matches conflicting record kinds.' : 'Referenced equipment was not supplied by Power BI.'));
    return target;
  }
  private refreshGroup(group: ConnectionGroup): void {
    this.clearWatches(group);
    for (const warning of group.warnings) {
      const groups = this.warningGroups.get(warning); groups?.delete(group);
      if (!groups || ![...groups].some(other => other.from.key === group.from.key)) group.from.issues = group.from.issues.filter(value => value !== warning);
      if (!groups?.size) this.warningGroups.delete(warning);
    }
    group.warnings.clear();
    let refs: Reference[];
    if (group.kind === 'parent') refs = [{ id: group.raw, project: group.companion || group.from.project }];
    else {
      // Recheck a previously split string if its whole tag becomes known later.
      const projects = splitList(group.companion, this.projects), defaultProject = projects.length === 1 ? projects[0] : group.from.project;
      this.watch(group, identityKey(defaultProject, group.raw));
      if (group.companion) {
        group.projectWatch = group.companion;
        let watchers = this.projectWatchers.get(group.companion);
        if (!watchers) { watchers = new Set(); this.projectWatchers.set(group.companion, watchers); } watchers.add(group);
      }
      refs = dependencyReferences(group.raw, group.companion, group.from.project, this.projects, (project, id) => this.identities.has(identityKey(project, id)));
    }
    const desired = new Map<string, EdgeRecord>();
    for (const ref of refs) {
      const target = this.resolve(group, ref), record = this.ensureEdge(group.from, target, group.kind);
      desired.set(record.edge.key, record);
      if (ref.issue) {
        group.warnings.add(ref.issue); issue(group.from, ref.issue); issue(record.edge, ref.issue);
        let groups = this.warningGroups.get(ref.issue);
        if (!groups) { groups = new Set(); this.warningGroups.set(ref.issue, groups); } groups.add(group);
      }
    }
    const orphanCandidates: string[] = [];
    for (const [key, record] of group.bindings) if (!desired.has(key)) {
      this.detach(group, record); orphanCandidates.push(record.edge.to);
    }
    for (const [key, record] of desired) if (!group.bindings.has(key)) {
      record.owners.add(group); for (const row of group.rows) this.appendEdgeRow(record, row);
    }
    group.bindings = desired;
    for (const key of orphanCandidates) this.cleanupNode(key);
    this.updateParentConflict(group.from);
  }
  private updateParentConflict(node: SsmNode): void {
    const message = 'Multiple closest parents supplied; structural relationship is unresolved.';
    let count = 0;
    for (const edge of this.graph.index!.outgoing.get(node.key) || []) if (edge.kind === 'parent') count++;
    if (count > 1) issue(node, message);
    else node.issues = node.issues.filter(value => value !== message);
  }
  private addGroup(from: SsmNode, kind: 'parent' | 'dependency', raw: string, companion: string, systemRoot: boolean, index: number): void {
    if (!raw || /^(?:N\/?A|-)$/i.test(raw)) return;
    const key = JSON.stringify([kind, from.key, raw, companion, systemRoot]); let group = this.groups.get(key);
    if (!group) {
      group = { key, from, kind, raw, companion, systemRoot, rows: [index], bindings: new Map(), watched: new Set(), projectWatch: '', warnings: new Set() };
      this.groups.set(key, group); this.refreshGroup(group);
    } else {
      appendRow(group.rows, index); for (const record of group.bindings.values()) this.appendEdgeRow(record, index);
    }
  }

  append(rows: powerbi.DataViewTableRow[], start: number, baseIndex: number): void {
    const changedIdentities = new Set<string>(), changedProjects = new Set<string>();
    const supplied: { node: SsmNode; row: powerbi.DataViewTableRow; index: number }[] = [];
    this.graph.rowCount += rows.length - start;
    if (this.graph.missingRoles.length) return;
    for (let offset = start; offset < rows.length; offset++) {
      const row = rows[offset], index = baseIndex + offset - start;
      const project = this.read(row, 'project'), id = this.read(row, 'equipmentId');
      if (!project || !id) { this.invalidRows++; continue; }
      const type = this.read(row, 'nodeType').toLowerCase(), kind: NodeKind = type === 'header' ? 'header' : 'equipment';
      const label = this.read(row, 'equipmentLabel') || id, node = this.ensureNode(kind, project, id, label);
      appendRow(node.rowIndices, index); supplied.push({ node, row, index });
      if (!this.projects.has(project)) { this.projects.add(project); changedProjects.add(project); }
      const lookup = identityKey(project, id); let candidates = this.identities.get(lookup);
      if (!candidates) { candidates = new Set(); this.identities.set(lookup, candidates); }
      if (!candidates.has(node.key)) { candidates.add(node.key); changedIdentities.add(lookup); }
      if (candidates.size > 1) for (const key of candidates) issue(this.graph.nodes.get(key)!, 'Equipment ID has conflicting record kinds within this project.');
      const previousLabel = this.labels.get(node.key);
      if (previousLabel !== undefined && previousLabel !== label) { node.label = id; issue(node, 'Conflicting equipment labels; displaying the equipment ID.'); }
      else if (previousLabel === undefined) this.labels.set(node.key, label);
      if (type && type !== 'header' && type !== 'equipment') issue(node, 'Unrecognized node type ' + type + '; treated as equipment.');
      const discipline = this.read(row, 'discipline');
      if (discipline) {
        addUnique(node.disciplines!, discipline); this.disciplines.add(discipline); node.discipline = node.disciplines!.join(' / ');
        if (node.disciplines!.length > 1) issue(node, 'Conflicting discipline values.');
      }
      this.mergeDetails(node, row);
      const l1Id = this.read(row, 'parentMilestone'), l2Id = this.read(row, 'milestone');
      const l1 = this.ensureNode('l1', project, l1Id, l1Id || 'Unassigned parent milestone', l1Id ? nodeKey('l1', project, l1Id) : syntheticKey('l1', project, 'unassigned'));
      const l2 = this.ensureNode('l2', project, l2Id, l2Id || 'Unassigned milestone', l2Id ? nodeKey('l2', project, l2Id) : syntheticKey('l2', project, 'unassigned', l1.key));
      if (!l1Id) issue(l1, 'No parent milestone supplied.'); if (!l2Id) issue(l2, 'No milestone supplied.');
      appendRow(l1.rowIndices, index); appendRow(l2.rowIndices, index); this.mergeDetails(l1, row); this.mergeDetails(l2, row);
      addUnique(l2.parentMilestoneKeys, l1.key); addUnique(node.milestoneKeys, l2.key); addUnique(node.parentMilestoneKeys, l1.key);
      if (l2.parentMilestoneKeys.length > 1) issue(l2, 'Milestone has conflicting parent milestone assignments.');
      this.appendEdgeRow(this.ensureEdge(l2, l1, 'hierarchy'), index, true);
      this.appendEdgeRow(this.ensureEdge(node, l2, 'membership'), index, true);
      indexSuppliedRow(this.graph.index!, node, discipline, l1.key, l2.key);
    }
    const affected = new Set<ConnectionGroup>();
    for (const lookup of changedIdentities) for (const group of this.identityWatchers.get(lookup) || []) affected.add(group);
    for (const project of changedProjects) for (const group of this.projectWatchers.get(project) || []) affected.add(group);
    for (const group of affected) this.refreshGroup(group);
    for (const { node, row, index } of supplied) {
      const parent = this.read(row, 'closestParent'), parentProject = this.read(row, 'closestParentProject') || node.project;
      this.addGroup(node, 'parent', parent, parentProject, parentProject === node.project && parent === this.read(row, 'systemName'), index);
      this.addGroup(node, 'dependency', this.read(row, 'dependencies'), this.read(row, 'dependencyProject'), false, index);
    }
  }

  finalize(partial: boolean, revision: number, validateCycles = true): void {
    this.graph.partial = partial; this.graph.revision = revision; this.graph.index!.version = revision;
    this.graph.edges = [...this.edges.values()].map(record => record.edge);
    this.graph.projects = [...this.projects].sort((a, b) => a.localeCompare(b));
    this.graph.disciplines = [...this.disciplines].sort((a, b) => a.localeCompare(b));
    this.graph.warnings = [...new Set(this.roleWarnings), ...this.warningGroups.keys()];
    if (partial) this.graph.warnings.unshift('Power BI supplied a partial dataset. Counts and connections cover loaded records only.');
    if (this.invalidRows) this.graph.warnings.push(this.invalidRows + ' row(s) lack a project or equipment ID and cannot be scoped safely.');
    if (validateCycles) {
      for (const node of this.graph.nodes.values()) if (node.issues.includes(CYCLE_ISSUE)) node.issues = node.issues.filter(value => value !== CYCLE_ISSUE);
      annotateCycles(this.graph);
    }
  }
}

function annotateCycles(graph: SsmGraph): void {
  const outgoing = new Map<string, string[]>(), incoming = new Map<string, string[]>();
  for (const key of graph.nodes.keys()) { outgoing.set(key, []); incoming.set(key, []); }
  for (const edge of graph.edges) if (edge.kind === 'parent' || edge.kind === 'dependency') {
    outgoing.get(edge.from)!.push(edge.to); incoming.get(edge.to)!.push(edge.from);
  }
  const seen = new Set<string>(), order: string[] = [];
  for (const start of graph.nodes.keys()) {
    if (seen.has(start)) continue;
    seen.add(start); const stack: { key: string; index: number }[] = [{ key: start, index: 0 }];
    while (stack.length) {
      const frame = stack[stack.length - 1], neighbors = outgoing.get(frame.key)!;
      if (frame.index === neighbors.length) { order.push(frame.key); stack.pop(); continue; }
      const next = neighbors[frame.index++];
      if (!seen.has(next)) { seen.add(next); stack.push({ key: next, index: 0 }); }
    }
  }
  seen.clear(); let count = 0;
  for (let index = order.length - 1; index >= 0; index--) {
    const start = order[index]; if (seen.has(start)) continue;
    const component: string[] = [], stack = [start]; seen.add(start);
    while (stack.length) {
      const key = stack.pop()!; component.push(key);
      for (const next of incoming.get(key)!) if (!seen.has(next)) { seen.add(next); stack.push(next); }
    }
    if (component.length > 1 || outgoing.get(start)!.includes(start)) {
      count++; for (const key of component) issue(graph.nodes.get(key)!, 'Connection cycle; traversal stops at already visited nodes.');
    }
  }
  if (count) graph.warnings.push(`${count} connection cycle(s) remain visible for review.`);
}
