import type powerbi from 'powerbi-visuals-api';

export type NodeKind = 'l1' | 'l2' | 'equipment' | 'header' | 'unresolved';
export type EdgeKind = 'hierarchy' | 'membership' | 'parent' | 'dependency';

export interface DetailField {
  key: string;
  label: string;
  kinds: NodeKind[];
  column: powerbi.DataViewMetadataColumn;
}

export interface SsmNode {
  key: string;
  id: string;
  label: string;
  project: string;
  kind: NodeKind;
  discipline: string;
  /** Source discipline values; several values indicate a conflict, not a merged category. */
  disciplines?: string[];
  milestoneKeys: string[];
  parentMilestoneKeys: string[];
  rowIndices: number[];
  metadata: Record<string, powerbi.PrimitiveValue[]>;
  issues: string[];
}

export interface SsmEdge {
  key: string;
  from: string;
  to: string;
  kind: EdgeKind;
  rowIndices: number[];
  issues: string[];
}

export interface SsmGraph {
  /** Advances on data changes; formatting and camera changes do not invalidate graph caches. */
  revision: number;
  index?: SsmGraphIndex;
  nodes: Map<string, SsmNode>;
  edges: SsmEdge[];
  fields: DetailField[];
  projects: string[];
  disciplines: string[];
  warnings: string[];
  missingRoles: string[];
  rowCount: number;
  partial: boolean;
}

export interface SsmGraphIndex {
  version: number;
  nodesByProject: Map<string, Set<string>>;
  nodesByKind: Map<NodeKind, Set<string>>;
  suppliedEntityKeys: Set<string>;
  physicalEquipmentKeys: Set<string>;
  equipmentByDiscipline: Map<string, Set<string>>;
  membersByMilestone: Map<string, Set<string>>;
  membersByParentMilestone: Map<string, Set<string>>;
  /** Exact row-declared pairs, keyed by assignmentKey(L1 key, L2 key). */
  membersByAssignment: Map<string, Set<string>>;
  milestonesByParent: Map<string, Set<string>>;
  outgoing: Map<string, Set<SsmEdge>>;
  incoming: Map<string, Set<SsmEdge>>;
}

export interface SsmStoreUpdate {
  graph: SsmGraph;
  table?: powerbi.DataViewTable;
  changed: boolean;
  reset: boolean;
}

export interface ScopeFilters {
  /** null means all supplied projects; [] intentionally means no projects. */
  projects: string[] | null;
  discipline: string | null;
  l1Key: string | null;
  l2Key: string | null;
  includeContext: boolean;
  showParents: boolean;
  showDependencies: boolean;
}

export interface SsmProjection {
  nodes: SsmNode[];
  edges: SsmEdge[];
  primaryKeys: Set<string>;
  contextKeys: Set<string>;
  headerKeys: Set<string>;
  totalEquipment: number;
}

export interface ExplorerOptions {
  /** Author-selected bound column; viewer-selected values stay local UI state. */
  highlightField: string;
  theme: 'auto' | 'light' | 'dark';
  accent: string;
  parentColor: string;
  dependencyColor: string;
  fontSize: number;
  nodeWidth: number;
  drawerWidth: number;
  showLegend: boolean;
  showMinimap: boolean;
  animate: boolean;
  initialExpanded: boolean;
  autoLoad: boolean;
  maxVisibleNodes: number;
  showEmptyDetails: boolean;
  showIdentity: boolean;
  showProject: boolean;
  showDiscipline: boolean;
  showMilestones: boolean;
  showRelations: boolean;
}

export interface DetailPresentation {
  field: DetailField;
  visible: boolean;
  label: string;
  order: number;
  format: 'auto' | 'text' | 'integer' | 'decimal' | 'date';
}
