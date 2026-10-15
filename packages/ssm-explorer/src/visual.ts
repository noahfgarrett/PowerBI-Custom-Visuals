import powerbi from 'powerbi-visuals-api';
import { valueFormatter } from 'powerbi-visuals-utils-formattingutils';
import { allowInteractions, getHostHighContrastColors, notifyRenderingStarted, notifyRenderingFinished, notifyRenderingFailed, prefersReducedMotion } from '../../core/src';
import { ExplorerSettings } from './settings';
import { assignmentKey, getGraphIndex, parseDataView, projectGraph, SsmDataStore, walkConnections } from './model';
import { SegmentLoader } from './loading';
import { getNodeStatus, hasStatusBinding } from './status';
import { buildMilestoneExport } from './milestone-export';
import { createMilestoneWorkbook } from './milestone-workbook';
import { SceneIndex } from './ui/scene';
import { LoadingIndicator } from './ui/loading-indicator';
import { ControlTooltip } from './ui/control-tooltip';
import { parseViewState, serializeViewState, viewStateScope, type ViewState } from './ui/view-state';
import { SceneMotion } from './ui/scene-motion';
import { getHighlightIndex, highlightMatches, type HighlightIndex } from './ui/highlighting';
import { buildEquipmentTree, type EquipmentTree, type EquipmentTreeRow } from './ui/equipment-tree';
import type { SsmGraph, SsmNode, SsmEdge, SsmProjection, ScopeFilters, DetailPresentation } from './types';
import '../style/visual.less';

type Host = powerbi.extensibility.visual.IVisualHost;
type Update = powerbi.extensibility.visual.VisualUpdateOptions;
type SelectionId = powerbi.visuals.ISelectionId;
type Camera = { x: number; y: number; k: number };
type EchoTable = { columns: string; identity: string; partial: boolean; rows: powerbi.DataViewTableRow[] };
type Occurrence = { id: string; node: SsmNode; x: number; y: number; width: number; height: number; branch: string | null; parentKey: string | null; role: 'normal' | 'member' | 'ancestor' | 'dependency' | 'related'; groupKey: string | null; depth: number; structuralParentKey: string | null; structuralEdgeKey: string | null; treeIssues: string[]; origin: string | null; structuralParentOccurrenceId: string | null };
type QuickState = { sourceKey: string; occurrenceId: string; groupKey: string; direction: 'out' | 'in'; offset: number };
type EquipmentAction = { sourceId: string; count: number; expanded: boolean; x: number; y: number; width: number };
type SiblingPage = { key: string; sourceId: string | null; count: number; offset: number; shown: number; x: number; y: number; width: number };
type BranchAction = { key: string; x: number; y: number; width: number; count: number; shown: number; collapsed: boolean; action: 'branch' | 'branch-next' | 'branch-prev' | 'parent' | 'parent-next' | 'parent-prev'; offset: number };

const escapeHtml = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const kindLabel = (node: SsmNode): string => ({ l1: 'Parent milestone', l2: 'Milestone', equipment: node.discipline || 'Equipment', header: 'Header', unresolved: 'Unavailable' }[node.kind]);
const nodeTypeLabel = (node: SsmNode): string => ({ l1: 'Parent milestone', l2: 'Milestone', equipment: 'Equipment', header: 'Header', unresolved: 'Unavailable reference' }[node.kind]);
const relationLabel = (edge: SsmEdge, outgoing: boolean): string => ({ hierarchy: outgoing ? 'Parent milestone' : 'Child milestone', membership: outgoing ? 'Assigned milestone' : 'Assigned equipment', parent: outgoing ? 'Closest parent' : 'Structural child', dependency: outgoing ? 'Dependency' : 'Required by' }[edge.kind]);
let visualInstance = 0;
/** Reviewed UI markup boundary: all source text and attributes use escapeHtml;
 * SVG positions are computed numbers and tokens/actions are fixed literals.
 * Never pass raw source strings or external HTML to this function. */
function setTrustedMarkup(element: Element, markup: string, append = false): void {
  // eslint-disable-next-line powerbi-visuals/no-inner-outer-html
  element.innerHTML = append ? element.innerHTML + markup : markup;
}

export class SsmExplorerVisual implements powerbi.extensibility.visual.IVisual {
  private readonly host: Host;
  private readonly container: HTMLElement;
  private readonly selectionManager: powerbi.extensibility.ISelectionManager;
  private readonly abort = new AbortController();
  private readonly uid = `ssm-${++visualInstance}`;
  private settings = new ExplorerSettings();
  private startCollapsed = false;
  private viewerTheme: 'light' | 'dark' | null = null;
  private exporting = false;
  private viewScope = '';
  private stateInitialized = false;
  private observedState: string | undefined;
  private lastWrittenState: string | undefined;
  private readonly pendingWrites = new Set<string>();
  private pendingRestore: ViewState | null = null;
  private stateDirty = false;
  private applyingHostUpdate = false;
  private handlingUserInteraction = false;
  private persistTimer: ReturnType<typeof setTimeout> | undefined;
  private initialDataView: EchoTable | undefined;
  private latestDataView: EchoTable | undefined;
  private dataFilterSignature = '';

  private readonly dataStore = new SsmDataStore();
  private readonly loader: SegmentLoader;
  private graph: SsmGraph = parseDataView();
  private projection: SsmProjection = projectGraph(this.graph, { projects: null, discipline: null, l1Key: null, l2Key: null, includeContext: true, showParents: true, showDependencies: true });
  private filters: ScopeFilters = { projects: [], discipline: null, l1Key: null, l2Key: null, includeContext: true, showParents: true, showDependencies: true };
  private readonly camera: Camera = { x: 12, y: 12, k: 1 };
  private readonly collapsed = new Set<string>();
  private readonly expandedParents = new Set<string>();
  private readonly collapsedParents = new Set<string>();
  private readonly parentOffsets = new Map<string, number>();
  private readonly parentChildren = new Map<string, SsmNode[]>();
  private readonly motion = new SceneMotion();
  private motionAnchor: { id: string; key: string; parentKey: string | null; x: number; y: number } | null = null;
  private readonly treeCache = new Map<string, EquipmentTree>();
  private treeCacheScope = '';
  private readonly dependencyCache = new Map<string, { outgoing: SsmEdge[]; incoming: SsmEdge[] }>();
  private dependencyCacheRevision = -1;
  private quickDependencies: QuickState | null = null;
  private quickTrail: QuickState[] = [];
  private readonly expandedEquipment = new Set<string>();
  private readonly collapsedEquipment = new Set<string>();
  private readonly siblingOffsets = new Map<string, number>();
  private readonly treeFocus = new Map<string, string>();
  private equipmentActions: EquipmentAction[] = [];
  private siblingPages: SiblingPage[] = [];
  private childCache = new Map<string, { key: string; edge: string }[]>();
  private childCacheRevision = -1;
  private highlightIndex: HighlightIndex | null = null;
  private highlightFieldKey = '';
  private readonly highlightedValues = new Set<string>();
  private highlightPopupOpen = false;
  private highlightQuery = '';
  private highlightOffset = 0;
  private dependencyPanels: { sourceId: string; x: number; y: number; width: number; direction: 'out' | 'in'; outgoing: number; incoming: number; offset: number; shown: number; total: number; pagingY: number }[] = [];
  private readonly limitedTreeContext = new Map<string, string>();
  private readonly limitedTreeNoticeY = new Map<string, number>();
  private selectedOccurrenceId: string | null = null;
  private readonly branchLimits = new Map<string, number>();
  private readonly branchOffsets = new Map<string, number>();
  private readonly nodeElements = new Map<string, HTMLButtonElement>();
  private readonly rowsToSelection = new Map<string, SelectionId[]>();
  private readonly reportSelectedNodeKeys = new Set<string>();
  private occurrences: Occurrence[] = [];
  private branches: BranchAction[] = [];
  private projectLabels: { label: string; x: number; y: number; width: number }[] = [];
  private readonly sceneIndex = new SceneIndex<Occurrence>();
  private readonly occurrencesByKey = new Map<string, Occurrence[]>();
  private readonly branchMembers = new Map<string, SsmNode[]>();
  private readonly branchCounts = new Map<string, number>();
  private readonly linkCache = new Map<string, string>();
  private layoutToken = '';
  private projectionToken = '';
  private viewportToken = '';
  private activeKeys: Set<string> | null = null;
  private activeFocusToken = '';
  private viewportRaf = 0;
  private minimapDirty = true;
  private minimapSelectedKey: string | null = null;
  private renderedCount = 0;
  private connectionOffset = 0;
  private searchTimer: ReturnType<typeof setTimeout> | undefined;
  private selectedKey: string | null = null;
  private drawerOpen = false;
  private drawerTab: 'overview' | 'connections' = 'overview';
  private allConnections = false;
  private forcedKeys = new Set<string>();
  private graphSignature = '';
  private table: powerbi.DataViewTable | undefined;
  private interactions = true;
  private destroyed = false;
  private worldWidth = 1;
  private worldHeight = 1;
  private viewportWidth = 1;
  private viewportHeight = 1;
  private rootWidth = 1;
  private truncated = false;
  private notice = '';
  private trail: string | null = null;
  private projectPopupOpen = false;
  private filtersOpen = false;
  private suppressClickUntil = 0;
  private drag: { pointer: number; x: number; y: number; startX: number; startY: number; moved: boolean } | null = null;
  private raf = 0;
  private readonly root: HTMLDivElement;
  private readonly world: HTMLDivElement;
  private readonly viewport: HTMLDivElement;
  private readonly controlTooltip: ControlTooltip;
  private readonly loadingIndicator: LoadingIndicator;

  constructor(options?: powerbi.extensibility.visual.VisualConstructorOptions) {
    if (!options) throw new Error('SSM Explorer requires a Power BI visual host.');
    this.host = options.host;
    this.container = options.element;
    this.selectionManager = this.host.createSelectionManager();
    this.root = document.createElement('div');
    this.root.className = 'ssm-root';
    setTrustedMarkup(this.root, this.shell());
    this.container.appendChild(this.root);
    this.world = this.q<HTMLDivElement>('[data-world]');
    this.viewport = this.q<HTMLDivElement>('[data-viewport]');
    this.controlTooltip = new ControlTooltip(this.root, element => {
      const node = this.graph.nodes.get(element.dataset.node ?? '');
      if (!node) return '';
      return [node.label, node.id !== node.label ? node.id : '', [nodeTypeLabel(node), node.discipline, node.project].filter(Boolean).join(' · ')].filter(Boolean).map(text => text.slice(0, 180)).join('\n');
    });
    this.host.tooltipService?.hide({ immediately: true, isTouchEvent: false });
    this.loadingIndicator = new LoadingIndicator(this.q('[data-delivery]'), this.uid);
    this.loader = new SegmentLoader(() => this.host.fetchMoreData?.(false) ?? false, () => this.renderStatus());
    this.bindEvents();
  }

  private q<T extends HTMLElement = HTMLElement>(selector: string): T { return this.root.querySelector<T>(selector)!; }

  private shell(): string {
    return `<header class="ssm-header"><div class="ssm-header-top"><div class="ssm-nav">
      <div class="ssm-project-wrap"><button type="button" class="ssm-project-button" data-action="projects" aria-haspopup="dialog" aria-expanded="false">All projects <span aria-hidden="true">⌄</span></button><div class="ssm-project-popup" data-project-popup role="dialog" aria-label="Choose projects" hidden><input type="search" data-project-search aria-label="Find a project" placeholder="Find project"><div class="ssm-project-actions"><button type="button" data-action="projects-all">All</button><button type="button" data-action="projects-none">None</button></div><div class="ssm-project-list" data-project-list></div></div></div>
      <div class="ssm-search-wrap"><input type="search" data-search placeholder="Search tags or milestones" aria-label="Find a node" aria-controls="${this.uid}-results" autocomplete="off"><div class="ssm-search-results" data-search-results id="${this.uid}-results" hidden></div></div>
      <div class="ssm-highlight-wrap"><button type="button" data-action="highlight" aria-haspopup="dialog" aria-expanded="false" title="Emphasize matches without hiding surrounding equipment." aria-describedby="${this.uid}-highlight-hint">Highlight</button><div class="ssm-highlight-popup" data-highlight-popup role="dialog" aria-label="Highlight values" hidden><div class="ssm-highlight-header"><strong data-highlight-field></strong><button type="button" data-action="highlight-clear">Clear</button><button type="button" data-action="highlight-close" aria-label="Close highlight values">×</button></div><input type="search" data-highlight-search aria-label="Find a highlight value" placeholder="Find value"><div class="ssm-highlight-values" data-highlight-values></div><div class="ssm-highlight-paging" data-highlight-paging></div></div></div>
      <button type="button" class="ssm-theme-toggle" data-action="theme" aria-label="Switch to dark mode" aria-describedby="${this.uid}-theme-hint"><svg class="ssm-theme-moon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20.9 13.3A9 9 0 0 1 10.7 3.1 9 9 0 1 0 20.9 13.3Z"/></svg><svg class="ssm-theme-sun" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg></button><span class="ssm-sr-only" data-tooltip-description id="${this.uid}-theme-hint">Switch to dark mode. Your view stays in place.</span>
      <button type="button" class="ssm-filters-button" data-action="filters" aria-expanded="false">Filters</button></div><div class="ssm-delivery" data-delivery hidden></div></div><div class="ssm-filter-popup" data-filter-popup><div class="ssm-scope-controls"><label class="ssm-field"><span>Parent</span><select data-filter="l1" aria-label="Parent milestone"><option value="">All parent milestones</option></select></label>
      <label class="ssm-field"><span>Milestone</span><select data-filter="l2" aria-label="Milestone"><option value="">All milestones</option></select></label>
      <label class="ssm-field"><span>Discipline</span><select data-filter="discipline" aria-label="Discipline"><option value="">All disciplines</option></select></label>
    </div><div class="ssm-layers"><label class="ssm-layer" title="Show links from equipment to its direct structural parent."><input type="checkbox" aria-describedby="${this.uid}-parent-hint" data-layer="parent" checked>Closest parent</label><label class="ssm-layer" title="Show prerequisite links between equipment."><input type="checkbox" aria-describedby="${this.uid}-dependency-hint" data-layer="dependency" checked>Dependencies</label><label class="ssm-layer" title="Include linked parents and dependencies outside the current filters, keeping their original milestone assignments."><input type="checkbox" aria-describedby="${this.uid}-context-hint" data-layer="context" checked>Related equipment</label><label class="ssm-layer" title="Show additional connections between displayed equipment, including alternate parent links."><input type="checkbox" aria-describedby="${this.uid}-all-hint" data-layer="all">All connections</label><button type="button" data-action="clear-filters">Clear filters</button></div></div></header>
    <div class="ssm-status" data-status hidden></div><div class="ssm-notice" data-notice role="status" hidden></div>
    <div class="ssm-workspace"><section class="ssm-canvas-pane" aria-label="SSM hierarchy"><div class="ssm-canvas-tools"><button type="button" data-action="zoom-out" aria-label="Zoom out">−</button><span class="ssm-zoom-label" data-zoom aria-live="polite">100%</span><button type="button" data-action="zoom-in" aria-label="Zoom in">+</button><button type="button" data-action="fit">Fit all</button><button type="button" data-action="focus">Focus selected</button><button type="button" data-action="reset" aria-describedby="${this.uid}-restart-hint">Start over</button><button type="button" data-action="help" aria-label="Graph navigation help" aria-expanded="false">?</button><span class="ssm-highlight-count" data-highlight-count hidden></span><span class="ssm-counts" data-counts aria-live="polite"></span></div>
    <div class="ssm-notice" data-help hidden>Drag empty canvas to pan. Scroll or pinch to zoom. Use arrow keys on the canvas to pan, +/− to zoom, Home to fit, and Escape to clear selection.</div>
    <div class="ssm-legend" data-legend aria-label="Relationship legend"><span><i class="ssm-line"></i>Milestone hierarchy</span><span><i class="ssm-line membership"></i>Equipment → milestone</span><span><i class="ssm-line parent"></i>Equipment → parent</span><span><i class="ssm-line dependency"></i>Dependency</span></div>
    <div class="ssm-viewport" data-viewport tabindex="0" role="group" aria-label="Graph canvas. Arrow keys pan, plus and minus zoom, Home fits all."><div class="ssm-world" data-world></div><div class="ssm-empty" data-empty hidden></div><button type="button" class="ssm-minimap" data-action="minimap" aria-label="Overview map. Click to recenter." hidden><svg aria-hidden="true"></svg></button></div></section>
    <aside class="ssm-drawer" data-drawer aria-label="Node details" hidden></aside></div><span class="ssm-sr-only" data-tooltip-description id="${this.uid}-parent-hint">Show links from equipment to its direct structural parent.</span><span class="ssm-sr-only" data-tooltip-description id="${this.uid}-dependency-hint">Show prerequisite links between equipment.</span><span class="ssm-sr-only" data-tooltip-description id="${this.uid}-context-hint">Include linked parents and dependencies outside the current filters, keeping their original milestone assignments.</span><span class="ssm-sr-only" data-tooltip-description id="${this.uid}-all-hint">Show additional connections between displayed equipment, including alternate parent links.</span><span class="ssm-sr-only" data-tooltip-description id="${this.uid}-children-hint">Show or hide direct structural children beneath this equipment.</span><span class="ssm-sr-only" data-tooltip-description id="${this.uid}-highlight-hint">Emphasize matching equipment without hiding the surrounding equipment.</span><span class="ssm-sr-only" data-tooltip-description id="${this.uid}-quick-dependency-hint">Show direct prerequisites or equipment that requires this item in a side lane.</span><span class="ssm-sr-only" data-tooltip-description id="${this.uid}-restart-hint">Clear project selection, filters, highlights, expanded branches, dependency lanes, and node selection. Choose a project to begin again. Your theme and loading preference stay the same.</span><div class="ssm-sr-only" data-announcement aria-live="polite"></div>`;
  }

  public update(options: Update): void {
    if (this.destroyed) return;
    notifyRenderingStarted(this.host, options);
    this.applyingHostUpdate = true;
    try {
      const dataView = options.dataViews?.[0];
      const previousSignature = this.graphSignature;
      const raw = dataView?.metadata?.objects?.viewState?.snapshot;
      const snapshot = typeof raw === 'string' ? raw : undefined;
      const scope = dataView ? viewStateScope(dataView) : this.viewScope;
      const hostFilters = JSON.stringify(options.jsonFilters ?? []);
      const ownEcho = !!snapshot && (this.pendingWrites.has(snapshot) || snapshot === this.lastWrittenState);
      // A property-save echo can resend the first table window. Keep accumulated
      // segments and native row identities when that payload is unchanged.
      const echo = !!snapshot && this.pendingWrites.has(snapshot) && scope === this.viewScope && hostFilters === this.dataFilterSignature
        && (this.sameTable(dataView, this.initialDataView) || this.sameTable(dataView, this.latestDataView));
      const received = !echo && (!!(options.type & 2) || (!previousSignature && !!dataView));
      const result = received ? this.dataStore.update(dataView, options.operationKind) : undefined;
      if (dataView || received) {
        const settings = new ExplorerSettings(dataView);
        if (settings.options.theme !== this.settings.options.theme) this.viewerTheme = null;
        this.settings = settings;
      }
      this.interactions = allowInteractions(this.host);
      if (result) {
        this.table = result.table; this.graph = result.graph;
        this.graphSignature = this.graph.nodes.size ? String(this.graph.revision) : '';
        const echoTable = this.copyEchoTable(dataView);
        if (result.reset) this.initialDataView = echoTable;
        this.latestDataView = echoTable; this.dataFilterSignature = hostFilters;
        if (result.changed || result.reset) { this.rowsToSelection.clear(); this.motion.finish(); this.motionAnchor = null; }
        if (result.reset) {
          this.layoutToken = ''; this.projectionToken = ''; this.activeFocusToken = ''; this.treeCacheScope = '';
          this.dependencyCacheRevision = -1; this.childCacheRevision = -1;
        }
      }
      let restoreCamera = false;
      if (dataView && !this.graph.missingRoles.length) {
        const first = !this.stateInitialized || scope !== this.viewScope;
        if (first) {
          if (this.stateInitialized) this.restoreView(parseViewState(JSON.stringify({ version: 1, scope }), scope)!);
          this.viewScope = scope; this.stateInitialized = true;
          this.pendingWrites.clear(); this.lastWrittenState = snapshot; this.observedState = snapshot;
          this.pendingRestore = parseViewState(snapshot, scope);
        } else if (dataView.metadata.objects !== undefined && snapshot !== this.observedState) {
          this.observedState = snapshot;
          if (!ownEcho) {
            this.pendingRestore = snapshot === undefined
              ? parseViewState(JSON.stringify({ version: 1, scope }), scope)
              : parseViewState(snapshot, scope);
            this.lastWrittenState = snapshot;
          }
        }
        if (snapshot) this.pendingWrites.delete(snapshot);
        if (this.pendingRestore) { this.restoreView(this.pendingRestore); restoreCamera = true; }
      }
      if (this.selectedKey && !this.graph.nodes.has(this.selectedKey)) {
        this.selectedKey = null; this.selectedOccurrenceId = null; this.drawerOpen = false;
      }
      if (this.filters.projects) this.filters.projects = this.filters.projects.filter(project => this.graph.projects.includes(project));
      if (this.filters.l1Key && !this.graph.nodes.has(this.filters.l1Key)) this.filters.l1Key = null;
      if (this.filters.l2Key && !this.graph.nodes.has(this.filters.l2Key)) this.filters.l2Key = null;
      if (this.filters.discipline && !this.graph.disciplines.includes(this.filters.discipline)) this.filters.discipline = null;
      this.rootWidth = Math.max(0, options.viewport.width);
      this.root.style.width = `${Math.max(0, options.viewport.width)}px`;
      this.root.style.height = `${Math.max(0, options.viewport.height)}px`;
      this.root.classList.toggle('ssm-narrow', options.viewport.width < 700);
      this.root.classList.toggle('ssm-compact', options.viewport.height < 360 || options.viewport.width < 420);
      this.applyTheme();
      this.loader.update(this.graph.partial && !this.graph.missingRoles.length, this.graph.rowCount, result?.reset ?? false, this.settings.options.autoLoad && this.hasProjectScope(), received);
      if (this.pendingRestore?.loadingPaused) this.loader.pause();
      this.render();
      if (this.pendingRestore && !this.graph.partial && !this.graph.missingRoles.length) this.pendingRestore = null;
      this.schedule(() => { this.measureViewport(); if (!previousSignature && !restoreCamera && this.occurrences.length) this.fitAll(); else this.applyCamera(); });
      notifyRenderingFinished(this.host, options);
    } catch (error) {
      this.showEmpty('Unable to render SSM', error instanceof Error ? error.message : 'Check the supplied fields.');
      notifyRenderingFailed(this.host, options, error instanceof Error ? error.message : String(error));
    } finally { this.applyingHostUpdate = false; }
  }

  private copyEchoTable(data?: powerbi.DataView): EchoTable | undefined {
    if (!data?.table) return undefined;
    try {
      return { columns: JSON.stringify(data.table.columns), identity: JSON.stringify([data.table.identity, data.table.identityFields, (data.table as powerbi.DataViewTable & { lastMergeIndex?: number }).lastMergeIndex]), partial: !!data.metadata.segment,
        rows: (data.table.rows ?? []).map(row => row.map(value => value instanceof Date ? new Date(value.getTime()) : value)) };
    } catch { return undefined; }
  }

  private sameTable(a?: powerbi.DataView, b?: EchoTable): boolean {
    if (!a?.table || !b || !!a.metadata.segment !== b.partial) return false;
    const left = a.table.rows ?? [], right = b.rows;
    if (left.length !== right.length) return false;
    try {
      if (JSON.stringify(a.table.columns) !== b.columns || JSON.stringify([a.table.identity, a.table.identityFields, (a.table as powerbi.DataViewTable & { lastMergeIndex?: number }).lastMergeIndex]) !== b.identity) return false;
      return left.every((row, index) => row.length === right[index].length && row.every((value, column) => {
        const other = right[index][column];
        return value instanceof Date && other instanceof Date ? value.getTime() === other.getTime() : value === other;
      }));
    } catch { return false; }
  }

  private captureView(): ViewState {
    return {
      version: 1, scope: this.viewScope, filters: { ...this.filters }, camera: { ...this.camera }, viewerTheme: this.viewerTheme, startCollapsed: this.startCollapsed, authorTheme: this.settings.options.theme,
      collapsed: [...this.collapsed], expandedParents: [...this.expandedParents], collapsedParents: [...this.collapsedParents], expandedEquipment: [...this.expandedEquipment], collapsedEquipment: [...this.collapsedEquipment], forcedKeys: [...this.forcedKeys],
      parentOffsets: [...this.parentOffsets], branchLimits: [...this.branchLimits], branchOffsets: [...this.branchOffsets], siblingOffsets: [...this.siblingOffsets], treeFocus: [...this.treeFocus],
      selectedKey: this.selectedKey, selectedOccurrenceId: this.selectedOccurrenceId, drawerOpen: this.drawerOpen, drawerTab: this.drawerTab, connectionOffset: this.connectionOffset,
      allConnections: this.allConnections, quickStates: this.quickStates().map(state => ({ ...state })), trail: this.trail as ViewState['trail'],
      highlightFieldKey: this.highlightFieldKey, highlightedValues: [...this.highlightedValues], search: this.q<HTMLInputElement>('[data-search]').value, loadingPaused: this.loader.state.paused,
    };
  }

  private restoreView(state: ViewState): void {
    this.motion.finish(); this.motionAnchor = null;
    this.filters = { ...state.filters, projects: state.filters.projects?.slice() ?? null };
    Object.assign(this.camera, state.camera);
    this.startCollapsed = state.startCollapsed;
    this.viewerTheme = state.authorTheme === this.settings.options.theme ? state.viewerTheme : null;
    const sets: [Set<string>, string[]][] = [[this.collapsed, state.collapsed], [this.expandedParents, state.expandedParents], [this.collapsedParents, state.collapsedParents], [this.expandedEquipment, state.expandedEquipment], [this.collapsedEquipment, state.collapsedEquipment], [this.forcedKeys, state.forcedKeys], [this.highlightedValues, state.highlightedValues]];
    for (const [target, values] of sets) { target.clear(); values.forEach(value => target.add(value)); }
    const maps: [Map<string, number>, [string, number][]][] = [[this.parentOffsets, state.parentOffsets], [this.branchLimits, state.branchLimits], [this.branchOffsets, state.branchOffsets], [this.siblingOffsets, state.siblingOffsets]];
    for (const [target, values] of maps) { target.clear(); values.forEach(([key, value]) => target.set(key, value)); }
    this.treeFocus.clear(); state.treeFocus.forEach(([key, value]) => this.treeFocus.set(key, value));
    this.selectedKey = state.selectedKey; this.selectedOccurrenceId = state.selectedOccurrenceId; this.drawerOpen = state.drawerOpen; this.drawerTab = state.drawerTab; this.connectionOffset = state.connectionOffset;
    this.allConnections = state.allConnections; this.quickDependencies = state.quickStates[0] ? { ...state.quickStates[0] } : null; this.quickTrail = state.quickStates.slice(1).map(value => ({ ...value })); this.trail = state.trail;
    this.highlightFieldKey = state.highlightFieldKey; this.q<HTMLInputElement>('[data-search]').value = state.search;
    this.layoutToken = ''; this.projectionToken = ''; this.viewportToken = ''; this.linkCache.clear(); this.notice = '';
    this.stateDirty = false; clearTimeout(this.persistTimer); this.persistTimer = undefined;
  }

  private rememberView(immediate = true, preservePending = false): void {
    if (this.destroyed || this.applyingHostUpdate || !this.stateInitialized || !this.interactions) return;
    if (preservePending && this.pendingRestore) this.pendingRestore.loadingPaused = this.loader.state.paused;
    else this.pendingRestore = null;
    this.stateDirty = true;
    clearTimeout(this.persistTimer);
    if (immediate) this.flushView();
    else this.persistTimer = setTimeout(() => this.flushView(), 180);
  }

  private flushView(): void {
    clearTimeout(this.persistTimer); this.persistTimer = undefined;
    if (!this.stateDirty || !this.stateInitialized) return;
    const snapshot = serializeViewState(this.pendingRestore ?? this.captureView());
    if (!snapshot || snapshot === this.lastWrittenState) { this.stateDirty = false; return; }
    this.pendingWrites.add(snapshot);
    while (this.pendingWrites.size > 32) this.pendingWrites.delete(this.pendingWrites.values().next().value!);
    const previous = this.lastWrittenState; this.lastWrittenState = snapshot; this.stateDirty = false;
    try { this.host.persistProperties({ merge: [{ objectName: 'viewState', selector: null as unknown as powerbi.data.Selector, properties: { snapshot } }] }); }
    catch { this.pendingWrites.delete(snapshot); this.lastWrittenState = previous; this.stateDirty = true; }
  }

  private userAction(action: () => void, immediate = true, preservePending = false): void {
    if (this.destroyed) return;
    const pendingBefore = this.pendingRestore && !preservePending ? JSON.stringify(this.captureView()) : undefined;
    this.handlingUserInteraction = true;
    try { action(); } finally {
      this.handlingUserInteraction = false;
      // Opening a popup or focusing a control must not discard nodes still loading.
      const unchanged = this.pendingRestore !== null && pendingBefore !== undefined && pendingBefore === JSON.stringify(this.captureView());
      if (!unchanged) this.rememberView(immediate, preservePending);
    }
  }

  private isDarkTheme(): boolean {
    const theme = this.viewerTheme ?? this.settings.options.theme;
    return theme === 'dark' || (theme === 'auto' && typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches);
  }

  private applyTheme(): void {
    const options = this.settings.options;
    const highContrast = getHostHighContrastColors(this.host);
    const dark = this.isDarkTheme();
    const colors: Record<string, string> = highContrast.enabled ? {
      bg: highContrast.background, panel: highContrast.background, fg: highContrast.foreground, muted: highContrast.foreground,
      border: highContrast.foreground, accent: highContrast.hyperlink, 'accent-soft': highContrast.background,
      parent: highContrast.foreground, dependency: highContrast.hyperlink, selected: highContrast.foreground, 'selected-fg': highContrast.background,
    } : {
      bg: dark ? '#1b2026' : '#ffffff', panel: dark ? '#252c34' : '#f5f7f8', fg: dark ? '#e6edf3' : '#24313c',
      muted: dark ? '#b0bdc8' : '#5f6b75', border: dark ? '#46515e' : '#dce3e7', accent: options.accent,
      'accent-soft': dark ? '#203b3a' : '#edf7f5', parent: options.parentColor, dependency: options.dependencyColor, selected: dark ? '#d6e7eb' : '#243d49', 'selected-fg': dark ? '#1b2026' : '#ffffff',
    };
    Object.entries(colors).forEach(([key, value]) => this.root.style.setProperty(`--ssm-${key}`, value));
    this.root.dataset.theme = highContrast.enabled ? 'high-contrast' : dark ? 'dark' : 'light';
    this.root.style.colorScheme = highContrast.enabled ? 'normal' : dark ? 'dark' : 'light';
    const themeButton = this.q('[data-action="theme"]');
    themeButton.setAttribute('aria-label', highContrast.enabled ? 'Theme follows high contrast' : `Switch to ${dark ? 'light' : 'dark'} mode`);
    themeButton.setAttribute('aria-disabled', String(highContrast.enabled));
    this.q(`#${this.uid}-theme-hint`).textContent = highContrast.enabled
      ? 'Theme follows Power BI high contrast settings.'
      : `Switch to ${dark ? 'light' : 'dark'} mode. Your view stays in place.`;
    this.root.style.fontSize = `${Math.max(10, Math.min(20, options.fontSize))}px`;
    this.root.classList.toggle('ssm-high-contrast', highContrast.enabled);
    this.root.classList.toggle('ssm-reduced-motion', !options.animate || prefersReducedMotion());
    if (!options.animate || prefersReducedMotion()) this.motion.finish();
    this.q('[data-legend]').hidden = !options.showLegend;
    this.q('[data-drawer]').style.flexBasis = `${options.drawerWidth}px`;
    this.q('[data-drawer]').style.width = `${Math.min(options.drawerWidth, Math.max(220, this.rootWidth * .86))}px`;
  }

  private render(): void {
    this.controlTooltip.hide();
    this.normalizeFilters();
    this.syncHighlights();
    const index = getGraphIndex(this.graph);
    const token = JSON.stringify([index.version, this.filters, [...this.expandedParents], [...this.collapsedParents], [...this.parentOffsets], [...this.collapsed], [...this.branchLimits], [...this.branchOffsets], [...this.forcedKeys], this.trail, this.quickDependencies, this.quickTrail, [...this.expandedEquipment], [...this.collapsedEquipment], [...this.siblingOffsets], [...this.treeFocus], this.rootWidth, this.settings.options.nodeWidth, this.settings.options.initialExpanded, this.startCollapsed, this.settings.options.maxVisibleNodes, this.settings.options.showRelations]);
    const projectionToken = JSON.stringify([index.version, this.filters, [...this.forcedKeys], this.trail]);
    const geometryChanged = token !== this.layoutToken;
    if (geometryChanged) {
    this.layoutToken = token;
    if (projectionToken !== this.projectionToken) {
    this.projectionToken = projectionToken;
    this.projection = projectGraph(this.graph, this.filters);
    if (this.forcedKeys.size) {
      const additional = [...this.forcedKeys].map(key => this.graph.nodes.get(key)).filter((node): node is SsmNode => !!node);
      const included = new Set(this.projection.nodes.map(node => node.key));
      const added: string[] = [];
      additional.forEach(node => { if (!included.has(node.key)) { this.projection.nodes.push(node); this.projection.contextKeys.add(node.key); included.add(node.key); added.push(node.key); } });
      if (added.length) {
        const edges = new Map(this.projection.edges.map(edge => [edge.key, edge]));
        for (const key of added) for (const edge of index.outgoing.get(key) ?? []) if (included.has(edge.to) && (edge.kind !== 'parent' || this.filters.showParents) && (edge.kind !== 'dependency' || this.filters.showDependencies)) edges.set(edge.key, edge);
        for (const key of added) for (const edge of index.incoming.get(key) ?? []) if (included.has(edge.from) && (edge.kind !== 'parent' || this.filters.showParents) && (edge.kind !== 'dependency' || this.filters.showDependencies)) edges.set(edge.key, edge);
        this.projection.edges = [...edges.values()];
      }
    }
    }
    this.layout();
    this.renderWorld();
    }
    this.renderNavigation();
    this.renderStatus();
    this.renderDrawer();
    this.applySelectionFocus();
    this.measureViewport();
    this.motionAnchor = null;
    this.applyCamera();
    const empty = this.q('[data-empty]');
    if (this.graph.missingRoles.length) this.showEmpty('Add the SSM fields', `Add ${this.graph.missingRoles.map(role => role === 'project' ? 'Project' : 'Equipment ID').join(' and ')} in Build visual.`);
    else if (!this.graph.rowCount) this.showEmpty('No source records', 'The report has not supplied any SSM rows.');
    else if (this.filters.projects?.length === 0) this.showEmpty('Choose a project', '', 'projects', 'Browse projects');
    else if (!this.projection.primaryKeys.size && !this.occurrences.length) this.showEmpty('No matching nodes', '', 'clear-filters', 'Clear filters');
    else empty.hidden = true;
    if (this.notice) { this.q('[data-notice]').textContent = this.notice; this.q('[data-notice]').hidden = false; }
    else this.q('[data-notice]').hidden = true;
  }

  private normalizeFilters(): void {
    const matchesProject = (node: SsmNode) => this.filters.projects === null || this.filters.projects.includes(node.project);
    if (this.filters.l1Key) { const node = this.graph.nodes.get(this.filters.l1Key); if (!node || !matchesProject(node)) { this.filters.l1Key = null; this.filters.l2Key = null; } }
    if (this.filters.l2Key) {
      const node = this.graph.nodes.get(this.filters.l2Key);
      if (!node || !matchesProject(node) || (this.filters.l1Key && !node.parentMilestoneKeys.includes(this.filters.l1Key))) this.filters.l2Key = null;
    }
  }

  private renderNavigation(): void {
    const activeProjects = this.filters.projects;
    const projectLabel = activeProjects === null ? 'All projects' : activeProjects.length === 0 ? 'Choose projects' : activeProjects.length === 1 ? activeProjects[0] : `${activeProjects.length} projects`;
    setTrustedMarkup(this.q('[data-action="projects"]'), `${escapeHtml(projectLabel)} <span aria-hidden="true">⌄</span>`);
    this.q('[data-action="projects"]').setAttribute('aria-expanded', String(this.projectPopupOpen));
    this.q('[data-project-popup]').hidden = !this.projectPopupOpen;
    this.renderProjects();
    this.renderHighlights();
    const projectMatches = (node: SsmNode) => activeProjects === null || activeProjects.includes(node.project);
    const index = getGraphIndex(this.graph);
    const l1s = [...(index.nodesByKind.get('l1') ?? [])].map(key => this.graph.nodes.get(key)!).filter(projectMatches);
    const l2s = [...(index.nodesByKind.get('l2') ?? [])].map(key => this.graph.nodes.get(key)!).filter(node => projectMatches(node) && (!this.filters.l1Key || node.parentMilestoneKeys.includes(this.filters.l1Key)));
    if (this.filters.l1Key && !l1s.some(node => node.key === this.filters.l1Key)) this.filters.l1Key = null;
    if (this.filters.l2Key && !l2s.some(node => node.key === this.filters.l2Key)) this.filters.l2Key = null;
    const options = (nodes: SsmNode[], selected: string | null, placeholder: string) => `<option value="">${placeholder}</option>` + nodes.sort((a, b) => a.label.localeCompare(b.label)).map(node => `<option value="${escapeHtml(node.key)}"${selected === node.key ? ' selected' : ''}>${escapeHtml(node.label)} · ${escapeHtml(node.project)}</option>`).join('');
    setTrustedMarkup(this.q<HTMLSelectElement>('[data-filter="l1"]'), options(l1s, this.filters.l1Key, 'All parent milestones'));
    setTrustedMarkup(this.q<HTMLSelectElement>('[data-filter="l2"]'), options(l2s, this.filters.l2Key, 'All milestones'));
    setTrustedMarkup(this.q<HTMLSelectElement>('[data-filter="discipline"]'), '<option value="">All disciplines</option>' + this.graph.disciplines.map(value => `<option value="${escapeHtml(value)}"${this.filters.discipline === value ? ' selected' : ''}>${escapeHtml(value)}</option>`).join(''));
    this.q<HTMLInputElement>('[data-layer="parent"]').checked = this.filters.showParents;
    this.q<HTMLInputElement>('[data-layer="dependency"]').checked = this.filters.showDependencies;
    this.q<HTMLInputElement>('[data-layer="context"]').checked = this.filters.includeContext;
    this.q<HTMLInputElement>('[data-layer="all"]').checked = this.allConnections;
    this.q<HTMLButtonElement>('[data-action="focus"]').disabled = !this.selectedKey || !this.occurrences.some(occurrence => occurrence.node.key === this.selectedKey);
  }

  private renderProjects(): void {
    const term = this.q<HTMLInputElement>('[data-project-search]').value.trim().toLowerCase();
    setTrustedMarkup(this.q('[data-project-list]'), this.graph.projects.filter(project => project.toLowerCase().includes(term)).map(project => `<label><input type="checkbox" data-project="${escapeHtml(project)}"${this.filters.projects === null || this.filters.projects.includes(project) ? ' checked' : ''}>${escapeHtml(project)}</label>`).join('') || '<span>No matching projects</span>');
  }

  private hasProjectScope(): boolean {
    const projects = this.pendingRestore ? this.pendingRestore.filters.projects : this.filters.projects;
    return projects === null || projects.length > 0;
  }

  private syncLoadingScope(): void {
    this.loader.update(this.graph.partial && !this.graph.missingRoles.length, this.graph.rowCount, false,
      this.settings.options.autoLoad && this.hasProjectScope(), false);
  }

  private renderStatus(): void {
    this.loadingIndicator.update(this.loader.state, !this.graph.missingRoles.length, this.interactions, this.hasProjectScope());
    const status = this.q('[data-status]');
    status.hidden = !this.graph.warnings.length;
    setTrustedMarkup(status, this.graph.warnings.length ? `${this.graph.warnings.length} data ${this.graph.warnings.length === 1 ? 'issue' : 'issues'}<button type="button" data-action="issues">View issues</button>` : '');
  }

  private layout(): void {
    this.occurrences = []; this.equipmentActions = []; this.siblingPages = []; this.branches = []; this.projectLabels = []; this.dependencyPanels = []; this.limitedTreeContext.clear(); this.limitedTreeNoticeY.clear(); this.branchMembers.clear(); this.branchCounts.clear(); this.parentChildren.clear(); this.occurrencesByKey.clear(); this.linkCache.clear();
    const index = getGraphIndex(this.graph), included = new Set(this.projection.nodes.map(node => node.key));
    const nodesByProject = new Map<string, SsmNode[]>(), rootCandidates = new Map<string, SsmNode[]>();
    for (const node of this.projection.nodes) { const bucket = nodesByProject.get(node.project); if (bucket) bucket.push(node); else nodesByProject.set(node.project, [node]); }
    const width = this.settings.options.nodeWidth, gap = 24, inset = 26;
    this.worldWidth = Math.max(width + inset * 2, Math.min(1040, this.rootWidth || 800));
    const columns = Math.max(1, Math.min(3, Math.floor((this.worldWidth - inset * 2 + gap) / (width + gap))));
    const mainSpan = columns * width + (columns - 1) * gap + 6;
    const sideStates = [this.quickDependencies, ...this.quickTrail].filter((item): item is QuickState => !!item);
    const equipmentPageSize = this.equipmentPageSize();
    let cursorY = 12;
    const add = (node: SsmNode, x: number, y: number, branch: string | null, parentKey: string | null, extra: Partial<Occurrence> = {}): Occurrence => {
      const occurrence: Occurrence = { id: JSON.stringify([node.key, parentKey ?? 'root', branch ?? 'self']), node, x, y, width, height: 64, branch, parentKey, role: 'normal', groupKey: null, depth: 0, structuralParentKey: null, structuralEdgeKey: null, treeIssues: [], origin: null, structuralParentOccurrenceId: null, ...extra };
      this.occurrences.push(occurrence);
      const bucket = this.occurrencesByKey.get(node.key); if (bucket) bucket.push(occurrence); else this.occurrencesByKey.set(node.key, [occurrence]);
      return occurrence;
    };
    for (const [project, projectNodes] of [...nodesByProject].sort(([a], [b]) => a.localeCompare(b))) {
      const parents = projectNodes.filter(node => node.kind === 'l1').sort((a, b) => a.label.localeCompare(b.label));
      rootCandidates.set(project, projectNodes.filter(node => node.kind === 'header' || node.kind === 'unresolved'));
      if (!parents.length) continue;
      this.projectLabels.push({ label: this.filters.projects !== null && !this.filters.projects.includes(project) ? `${project} · related equipment` : project, x: inset, y: cursorY, width: mainSpan });
      cursorY += 32;
      let rootColumn = 0, rootRowY = cursorY;
      for (const parent of parents) {
        const children = [...(index.milestonesByParent.get(parent.key) ?? [])].filter(key => included.has(key) && (!this.trail || this.forcedKeys.has(key))).map(key => this.graph.nodes.get(key)!).sort((a, b) => a.label.localeCompare(b.label));
        this.parentChildren.set(parent.key, children);
        const expanded = this.isParentExpanded(parent.key);
        if (expanded && rootColumn) { rootRowY += 106; rootColumn = 0; }
        const parentX = inset + rootColumn * (width + gap);
        add(parent, parentX, rootRowY, null, null);
        this.branches.push({ key: parent.key, x: parentX, y: rootRowY + 68, width, count: children.length, shown: 0, collapsed: !expanded, action: 'parent', offset: this.parentOffsets.get(parent.key) ?? 0 });
        if (!expanded) { rootColumn++; if (rootColumn === columns) { rootColumn = 0; rootRowY += 106; } continue; }
        const offset = Math.min(this.parentOffsets.get(parent.key) ?? 0, Math.max(0, children.length - 1));
        const page = children.slice(offset, offset + 12);
        let rowY = rootRowY + 108, column = 0, rowHeight = 112;
        for (const milestone of page) {
          const collapsed = this.isCollapsed(assignmentKey(parent.key, milestone.key));
          // An open milestone owns the whole equipment group; closed cards can share a row.
          if (!collapsed && column) { rowY += rowHeight + 16; column = 0; rowHeight = 112; }
          const x = inset + column * (width + gap), cohortKey = assignmentKey(parent.key, milestone.key);
          add(milestone, x, rowY, milestone.key, parent.key);
          const cohort = index.membersByAssignment.get(cohortKey) ?? new Set<string>();
          const tree = collapsed ? null : this.cohortTree(cohortKey, included);
          const matches = tree ? tree.memberRows.map(row => this.graph.nodes.get(row.nodeKey)!) : [];
          const count = collapsed ? [...cohort].filter(key => included.has(key) && this.graph.nodes.get(key)?.kind === 'equipment').length : matches.filter(node => node.kind === 'equipment').length;
          this.branchMembers.set(cohortKey, matches); this.branchCounts.set(cohortKey, count);
          this.branches.push({ key: cohortKey, x, y: rowY + 68, width, count, shown: 0, collapsed, action: 'branch', offset: 0 });
          let nextY = rowY + 106;
          type Entry = { key: string; related: boolean; edge: string | null; id?: string };
          type Description = { node: SsmNode; id: string; extra: Partial<Occurrence>; children: Entry[]; listKey: string };
          type Frame = { page: Entry[]; index: number; count: number; offset: number; listKey: string; parentId: string | null; parentFrame: Frame | null; depth: number; path: ReadonlySet<string>; x: number; y: number; areaWidth: number; column: number; rowHeight: number; paged: boolean };
          const place = (description: Description, atX: number, atY: number, cardWidth: number): Occurrence => {
            const { node, id, extra, children } = description;
            const occurrence = add(node, atX, atY, extra.role === 'member' ? milestone.key : null, extra.role === 'member' || extra.role === 'ancestor' ? parent.key : null, { id, groupKey: cohortKey, ...extra, width: cardWidth });
            const direct = node.kind === 'equipment' && this.settings.options.showRelations ? this.dependencyInfo(node.key) : null;
            if (children.length) this.equipmentActions.push({ sourceId: id, count: children.length, expanded: this.isEquipmentExpanded(id), x: atX, y: atY + 67, width: cardWidth });
            occurrence.height = 64 + (children.length ? 24 : 0) + (direct && (direct.outgoing.length || direct.incoming.length) ? 24 : 0);
            return occurrence;
          };
          // Iterative frames reserve an expanded subtree's entire bounds before its next sibling.
          // Leaf/closed siblings pack into rows without recursion, even for a very deep chain.
          const grid = (entries: Entry[], atX: number, atY: number, areaWidth: number, listKey: string, budget: number, describe: (entry: Entry, depth: number, parentId: string | null, path: ReadonlySet<string>) => Description | null, side = false): { bottom: number; limited: string | null } => {
            const frameFor = (all: Entry[], fx: number, fy: number, fw: number, key: string, parentId: string | null, depth: number, path: ReadonlySet<string>, parentFrame: Frame | null, paged = true): Frame => {
              const available = all.filter(entry => !path.has(entry.key));
              const offset = paged ? Math.min(this.siblingOffsets.get(key) ?? 0, Math.max(0, available.length - 1)) : 0;
              return { page: paged ? available.slice(offset, offset + equipmentPageSize) : available, index: 0, count: available.length, offset, listKey: key, parentId, parentFrame, depth, path, x: fx, y: fy, areaWidth: fw, column: 0, rowHeight: 0, paged };
            };
            const frames = [frameFor(entries, atX, atY, areaWidth, listKey, null, 0, new Set(), null, !side)];
            const flush = (frame: Frame): void => { if (frame.column) { frame.y += frame.rowHeight + 12; frame.column = 0; frame.rowHeight = 0; } };
            let placed = 0, bottom = atY, limited: string | null = null;
            while (frames.length) {
              const frame = frames[frames.length - 1];
              if (frame.index >= frame.page.length || placed >= budget) {
                if (frame.index < frame.page.length) limited ??= frame.page[frame.index].key;
                flush(frame);
                if (frame.paged && frame.index >= frame.page.length && frame.count > equipmentPageSize) {
                  this.siblingPages.push({ key: frame.listKey, sourceId: frame.parentId, count: frame.count, offset: frame.offset, shown: frame.page.length, x: frame.x, y: frame.y, width: frame.areaWidth }); frame.y += 34;
                }
                bottom = Math.max(bottom, frame.y); frames.pop();
                if (frame.parentFrame) frame.parentFrame.y = Math.max(frame.parentFrame.y, frame.y + 16);
                continue;
              }
              const entry = frame.page[frame.index++], path = new Set([...frame.path, entry.key]);
              const description = describe(entry, frame.depth, frame.parentId, path); if (!description) continue;
              const indent = Math.min(frame.depth * (side ? 12 : 14), Math.max(0, width - 150)), cardWidth = width - indent;
              const columnCount = side && frame.depth === 0 ? 1 : Math.max(1, Math.min(columns, Math.floor((frame.areaWidth + gap) / (cardWidth + gap))));
              const open = description.children.length > 0 && this.isEquipmentExpanded(description.id);
              if (open) flush(frame);
              const occurrence = place(description, frame.x + frame.column * (cardWidth + gap), frame.y, cardWidth); placed++;
              if (open) {
                frame.y += occurrence.height + 12;
                const nextIndent = Math.min((frame.depth + 1) * (side ? 12 : 14), Math.max(0, width - 150)), shift = nextIndent - indent;
                frames.push(frameFor(description.children, frame.x + shift, frame.y, Math.max(width - nextIndent, frame.areaWidth - shift), description.listKey, occurrence.id, frame.depth + 1, path, frame));
              } else {
                frame.rowHeight = Math.max(frame.rowHeight, occurrence.height); frame.column++;
                if (frame.column === columnCount) flush(frame);
              }
            }
            return { bottom, limited };
          };
          if (tree) {
            const focused = this.treeFocus.get(cohortKey), roots = focused && tree.rowByKey.has(focused) ? [focused] : tree.roots;
            const main = grid(roots.map(key => ({ key, related: false, edge: null })), x + 6, nextY, mainSpan - 6, this.siblingListKey(cohortKey, null), Math.max(5, this.settings.options.maxVisibleNodes - 4), (entry, depth, parentId, path) => {
              const row = tree.rowByKey.get(entry.key), node = this.graph.nodes.get(entry.key); if (!node) return null;
              const id = entry.id ?? this.treeOccurrenceId(cohortKey, node.key), canonical = entry.related ? [] : tree.childrenByKey.get(node.key) ?? [], canonicalKeys = new Set(canonical);
              const children: Entry[] = [...canonical.map(key => ({ key, related: false, edge: null })), ...this.scopedChildren(node.key, tree, entry.related).filter(child => !canonicalKeys.has(child.key)).map(child => ({ key: child.key, related: true, edge: child.edge, id: `related:${id.length}:${id}:${child.key}` }))].filter(child => !path.has(child.key));
              return { node, id, children, listKey: this.siblingListKey(entry.related ? id : cohortKey, node.key), extra: { role: entry.related ? 'related' : row?.context ? 'ancestor' : 'member', depth: row?.depth ?? depth, structuralParentKey: entry.related ? this.occurrences.find(item => item.id === parentId)?.node.key ?? null : row?.structuralParentKey ?? null, structuralEdgeKey: entry.related ? entry.edge : row?.structuralEdgeKey ?? null, structuralParentOccurrenceId: parentId, treeIssues: row?.issues ?? [] } };
            });
            nextY = main.bottom;
            if (main.limited) this.limitedTreeContext.set(cohortKey, main.limited);
            if (focused) { const row = tree.rowByKey.get(focused); if (row?.structuralParentKey) this.limitedTreeContext.set(cohortKey, row.structuralParentKey); }
            if (this.limitedTreeContext.has(cohortKey)) { this.limitedTreeNoticeY.set(cohortKey, nextY); nextY += 28; }
          }
          let sideBottom = nextY, laneX = x + mainSpan + 54;
          for (const state of sideStates) {
            if (state.groupKey !== cohortKey || !this.settings.options.showRelations) continue;
            const source = this.occurrences.find(item => item.id === state.occurrenceId); if (!source) continue;
            const info = this.dependencyInfo(state.sourceKey), edges = state.direction === 'out' ? info.outgoing : info.incoming;
            const offset = Math.min(state.offset, Math.max(0, edges.length - 1)), targets = edges.slice(offset, offset + 5), panelY = source.y;
            const directEntries: Entry[] = targets.map(edge => { const key = state.direction === 'out' ? edge.to : edge.from; return { key, related: false, edge: null, id: `dep:${source.id.length}:${source.id}:${state.direction}:${key}` }; });
            const expandedChildren = directEntries.some(entry => this.isEquipmentExpanded(entry.id!) && this.scopedChildren(entry.key, undefined, true).some(child => child.key !== source.node.key && child.key !== entry.key));
            const laneSpan = expandedChildren ? mainSpan - 6 : width;
            const panel = { sourceId: source.id, x: laneX, y: panelY, width, direction: state.direction, outgoing: info.outgoing.length, incoming: info.incoming.length, offset, shown: targets.length, total: edges.length, pagingY: panelY + 62 };
            this.dependencyPanels.push(panel);
            const related = grid(directEntries, laneX, panelY + 62, laneSpan, '', Math.min(60, this.settings.options.maxVisibleNodes), (entry, depth, parentId, path) => {
              const node = this.graph.nodes.get(entry.key); if (!node) return null;
              const id = entry.id!;
              const children = this.scopedChildren(node.key, undefined, true).filter(child => !path.has(child.key) && child.key !== source.node.key).map(child => ({ key: child.key, related: true, edge: child.edge, id: `child:${id.length}:${id}:${child.key}` }));
              return { node, id, children, listKey: this.siblingListKey(id, node.key), extra: { role: parentId ? 'related' : 'dependency', origin: source.id, depth, structuralParentKey: parentId ? this.occurrences.find(item => item.id === parentId)?.node.key ?? null : null, structuralEdgeKey: entry.edge, structuralParentOccurrenceId: parentId } };
            }, true);
            panel.pagingY = related.bottom;
            const laneBottom = related.bottom + (!targets.length ? 24 : 0) + (edges.length > 5 ? 34 : 0);
            sideBottom = Math.max(sideBottom, laneBottom + 12);
            this.worldWidth = Math.max(this.worldWidth, laneX + laneSpan + inset); laneX += laneSpan + 54;
          }
          if (collapsed) {
            rowHeight = Math.max(rowHeight, 112); column++;
            if (column === columns) { rowY += rowHeight + 16; column = 0; rowHeight = 112; }
          } else { rowY = Math.max(rowY + 112, sideBottom + 8) + 24; column = 0; rowHeight = 112; }
        }
        if (column) rowY += rowHeight + 16;
        if (!page.length) rowY += 20;
        if (children.length > 12) {
          this.branches.push({ key: parent.key, x: inset, y: rowY, width: width / 2 - 4, count: children.length, shown: offset + page.length, collapsed: false, action: 'parent-prev', offset });
          this.branches.push({ key: parent.key, x: inset + width / 2 + 4, y: rowY, width: width / 2 - 4, count: children.length, shown: offset + page.length, collapsed: false, action: 'parent-next', offset }); rowY += 36;
        }
        rootRowY = rowY + 24; rootColumn = 0;
      }
      cursorY = rootRowY + (rootColumn ? 106 : 0) + 28;
    }
    const relevantRoots = new Set<string>();
    for (const occurrence of this.occurrences) if (occurrence.node.kind === 'equipment') for (const edge of index.outgoing.get(occurrence.node.key) ?? []) {
      const target = this.graph.nodes.get(edge.to);
      if (target && (target.kind === 'header' || target.kind === 'unresolved')) relevantRoots.add(target.key);
    }
    for (const [project, candidates] of rootCandidates) {
      const roots = candidates.filter(node => !this.occurrencesByKey.has(node.key) && (relevantRoots.has(node.key) || this.forcedKeys.has(node.key))).sort((a, b) => a.id.localeCompare(b.id)).slice(0, equipmentPageSize);
      if (!roots.length) continue;
      this.projectLabels.push({ label: `${project} · related equipment`, x: inset, y: cursorY, width: mainSpan }); cursorY += 30;
      let rowHeight = 0;
      roots.forEach((node, position) => { const item = add(node, inset + (position % columns) * (width + gap), cursorY, null, null); rowHeight = Math.max(rowHeight, item.height); if ((position + 1) % columns === 0) { cursorY += rowHeight + 14; rowHeight = 0; } });
      if (roots.length % columns) cursorY += rowHeight + 14;
      cursorY += 24;
    }
    const invalidLane = this.settings.options.showRelations ? sideStates.findIndex(state => !this.dependencyPanels.some(panel => panel.sourceId === state.occurrenceId)) : -1;
    if (invalidLane >= 0) { const valid = sideStates.slice(0, invalidLane); this.quickDependencies = valid[0] ?? null; this.quickTrail = valid.slice(1); this.layoutToken = ''; this.layout(); return; }
    this.worldHeight = Math.max(180, cursorY + 20);
    this.sceneIndex.rebuild(this.occurrences); this.minimapDirty = true; this.viewportToken = '';
  }

  private isCollapsed(key: string): boolean { return this.collapsed.has(key) || ((this.startCollapsed || !this.settings.options.initialExpanded) && !this.branchLimits.has(key)); }
  private isParentExpanded(key: string): boolean { return this.expandedParents.has(key) || !this.startCollapsed && this.settings.options.initialExpanded && !this.collapsedParents.has(key); }

  private treeOccurrenceId(cohort: string, key: string): string { return JSON.stringify([cohort, key, 'tree']); }
  private siblingListKey(cohort: string, parent: string | null): string { return JSON.stringify([cohort, parent, 'siblings']); }
  private isEquipmentExpanded(id: string): boolean { return !this.collapsedEquipment.has(id) && (this.expandedEquipment.has(id) || !this.startCollapsed && this.settings.options.initialExpanded); }
  private directChildren(key: string): { key: string; edge: string }[] {
    const index = getGraphIndex(this.graph);
    if (this.childCacheRevision !== index.version) { this.childCache.clear(); this.childCacheRevision = index.version; }
    let children = this.childCache.get(key);
    if (!children) {
      const seen = new Set<string>();
      children = [...(index.incoming.get(key) ?? [])].filter(edge => edge.kind === 'parent' && edge.from !== key && !seen.has(edge.from) && (seen.add(edge.from), true)).map(edge => ({ key: edge.from, edge: edge.key })).sort((a, b) => (this.graph.nodes.get(a.key)?.id ?? a.key).localeCompare(this.graph.nodes.get(b.key)?.id ?? b.key, 'en', { numeric: true }));
      this.childCache.set(key, children);
    }
    return children;
  }
  private scopedChildren(key: string, tree?: EquipmentTree | null, related = false): { key: string; edge: string }[] {
    const children = this.directChildren(key);
    return this.filters.includeContext ? children : children.filter(child => this.projection.primaryKeys.has(child.key) && (related || tree?.rowByKey.get(child.key)?.context === false));
  }
  private quickStates(): QuickState[] { return [this.quickDependencies, ...this.quickTrail].filter((item): item is QuickState => !!item); }
  private toggleEquipment(id: string): void {
    const occurrence = this.occurrences.find(item => item.id === id); if (!occurrence) return;
    this.beginMotion(occurrence);
    if (this.isEquipmentExpanded(id)) { this.expandedEquipment.delete(id); this.collapsedEquipment.add(id); }
    else { this.collapsedEquipment.delete(id); this.expandedEquipment.add(id); }
    this.render();
    this.schedule(() => { const button = [...this.root.querySelectorAll<HTMLButtonElement>('[data-action="equipment-children"]')].find(item => item.dataset.source === id); button?.focus({ preventScroll: true }); });
  }

  private equipmentPageSize(): number { return Math.max(5, Math.min(30, this.settings.options.maxVisibleNodes - 12)); }

  private cohortTree(cohortKey: string, included: ReadonlySet<string>, scope = this.projectionToken): EquipmentTree {
    if (this.treeCacheScope !== scope) { this.treeCache.clear(); this.treeCacheScope = scope; }
    const cached = this.treeCache.get(cohortKey); if (cached) return cached;
    const index = getGraphIndex(this.graph);
    const members = [...(index.membersByAssignment.get(cohortKey) ?? [])].filter(key => included.has(key) && (!this.trail || this.forcedKeys.has(key))).map(key => this.graph.nodes.get(key)!).filter(node => node.kind === 'equipment' || node.kind === 'header');
    const tree = buildEquipmentTree(this.graph, members, { includedKeys: included, includeContext: this.filters.includeContext });
    this.treeCache.set(cohortKey, tree); return tree;
  }

  private treePage(tree: EquipmentTree, offset: number): { rows: EquipmentTreeRow[]; limited: boolean; limitedKey: string | null } {
    const members = tree.memberRows.slice(offset, offset + this.equipmentPageSize());
    const selected = new Set(members.map(row => row.nodeKey)), carry = new Set<string>();
    const budget = Math.min(48, Math.max(0, this.settings.options.maxVisibleNodes - members.length));
    let limited = false, limitedKey: string | null = null;
    for (const member of members) {
      let parent = member.structuralParentKey, depth = 0;
      while (parent && depth++ < 12) {
        if (!selected.has(parent) && !carry.has(parent)) { if (carry.size < budget) carry.add(parent); else { limited = true; limitedKey ??= member.nodeKey; } }
        parent = tree.rowByKey.get(parent)?.structuralParentKey ?? null;
      }
      if (parent) { limited = true; limitedKey ??= member.nodeKey; }
    }
    const rows = [...members, ...[...carry].map(key => tree.rowByKey.get(key)!)];
    rows.sort((a, b) => (tree.indexByKey.get(a.nodeKey) ?? 0) - (tree.indexByKey.get(b.nodeKey) ?? 0));
    return { rows, limited, limitedKey };
  }

  private dependencyInfo(key: string): { outgoing: SsmEdge[]; incoming: SsmEdge[] } {
    const index = getGraphIndex(this.graph);
    if (this.dependencyCacheRevision !== index.version) { this.dependencyCache.clear(); this.dependencyCacheRevision = index.version; }
    const cached = this.dependencyCache.get(key); if (cached) return cached;
    const outgoing = [...(index.outgoing.get(key) ?? [])].filter(edge => edge.kind === 'dependency');
    const incoming = [...(index.incoming.get(key) ?? [])].filter(edge => edge.kind === 'dependency');
    const value = { outgoing, incoming }; this.dependencyCache.set(key, value); return value;
  }

  private renderWorld(): void {
    this.world.style.width = `${this.worldWidth}px`;
    this.world.style.height = `${this.worldHeight}px`;
    const svg = this.world.querySelector('.ssm-links');
    if (!svg) setTrustedMarkup(this.world, `<svg class="ssm-links" width="${this.worldWidth}" height="${this.worldHeight}" viewBox="0 0 ${this.worldWidth} ${this.worldHeight}" aria-hidden="true"></svg><div data-scene-labels></div><div data-scene-actions></div>`);
    else { svg.setAttribute('width', String(this.worldWidth)); svg.setAttribute('height', String(this.worldHeight)); svg.setAttribute('viewBox', `0 0 ${this.worldWidth} ${this.worldHeight}`); }
    this.measureViewport(); this.renderViewport(true);
  }

  private renderViewport(force = false): void {
    const padding = 70 / this.camera.k;
    const bounds = { x: -this.camera.x / this.camera.k - padding, y: -this.camera.y / this.camera.k - padding, width: this.viewportWidth / this.camera.k + padding * 2, height: this.viewportHeight / this.camera.k + padding * 2 };
    const inBounds = (item: { x: number; y: number; width: number; height?: number }) => item.x + item.width >= bounds.x && item.x <= bounds.x + bounds.width && item.y + (item.height ?? 25) >= bounds.y && item.y <= bounds.y + bounds.height;
    const candidates = this.sceneIndex.query(bounds);
    const cap = Math.max(25, this.settings.options.maxVisibleNodes);
    const centerX = bounds.x + bounds.width / 2, centerY = bounds.y + bounds.height / 2;
    const priority = (item: Occurrence) => item.node.key === this.selectedKey ? -3 : item.node.kind === 'l1' || item.node.kind === 'l2' ? -2 : this.activeKeys?.has(item.node.key) ? -1 : 0;
    if (candidates.length > cap) candidates.sort((a, b) => priority(a) - priority(b) || Math.hypot(a.x - centerX, a.y - centerY) - Math.hypot(b.x - centerX, b.y - centerY));
    const visible = candidates.slice(0, cap);
    const controls = [
      ...this.branches.filter(inBounds).slice(0, cap).map(item => `${item.action}:${item.key}`),
      ...this.siblingPages.filter(inBounds).slice(0, cap).map(item => item.key),
      ...this.dependencyPanels.filter(item => inBounds({ ...item, height: item.pagingY - item.y + 40 })).map(item => item.sourceId),
      ...this.projectLabels.filter(inBounds).slice(0, cap).map(item => item.label),
      ...[...this.limitedTreeContext].filter(([key]) => { const action = this.branches.find(item => item.key === key && item.action === 'branch'); return action && inBounds({ ...action, y: this.limitedTreeNoticeY.get(key) ?? action.y + 24 }); }).map(([key]) => key),
    ];
    const token = JSON.stringify([visible.map(item => item.id), controls]);
    this.truncated = candidates.length > cap;
    if (!force && token === this.viewportToken) { this.motion.play(this.nodeElements.values(), this.camera.k, this.world.querySelector<SVGSVGElement>('.ssm-links')); return; }
    this.viewportToken = token;
    const ids = new Set(visible.map(item => item.id));
    for (const [id, element] of this.nodeElements) if (!ids.has(id)) { element.remove(); this.nodeElements.delete(id); }
    for (const occurrence of visible) {
      let element = this.nodeElements.get(occurrence.id);
      if (!element) { element = document.createElement('button'); element.type = 'button'; this.nodeElements.set(occurrence.id, element); this.world.appendChild(element); }
      const node = occurrence.node, matched = !!this.highlightIndex && highlightMatches(this.highlightIndex, occurrence.node.key, this.highlightedValues), context = occurrence.role === 'ancestor' || occurrence.role === 'dependency' || occurrence.role === 'related' || this.projection.contextKeys.has(node.key);
      element.className = `ssm-node ${node.kind}${context ? ' is-context' : ''}${occurrence.role === 'dependency' ? ' is-dependency-row' : ''}${occurrence.role === 'ancestor' ? ' is-ancestor' : ''}${occurrence.role === 'related' ? ' is-related-row' : ''}${node.key === this.selectedKey ? ' is-selected' : ''}${this.reportSelectedNodeKeys.has(node.key) ? ' is-report-selected' : ''}${this.activeKeys && !this.activeKeys.has(node.key) ? ' is-dimmed' : ''}${matched ? ' is-highlight-match' : this.highlightedValues.size && node.kind === 'equipment' ? ' is-highlight-muted' : ''}`;
      element.dataset.node = node.key; element.dataset.occurrence = occurrence.id;
      element.dataset.role = occurrence.role;
      const status = (node.kind === 'equipment' || node.kind === 'header') && hasStatusBinding(this.graph) ? getNodeStatus(this.graph, node) : null;
      if (status) element.dataset.status = status.state; else delete element.dataset.status;
      if (occurrence.parentKey && (occurrence.role !== 'ancestor' || occurrence.branch)) element.dataset.parent = occurrence.parentKey; else delete element.dataset.parent;
      if (occurrence.role === 'ancestor' && !occurrence.branch && occurrence.parentKey) element.dataset.contextParent = occurrence.parentKey; else delete element.dataset.contextParent;
      if (occurrence.branch) element.dataset.branch = occurrence.branch; else delete element.dataset.branch;
      if (occurrence.origin) element.dataset.sourceOccurrence = occurrence.origin; else delete element.dataset.sourceOccurrence;
      element.setAttribute('aria-label', `${node.label}, ${node.id}, ${nodeTypeLabel(node)}, ${node.project}${status ? `, ${status.label}` : ''}${context ? ', related equipment' : ''}${matched ? ', highlight match' : ''}`);
      element.setAttribute('aria-pressed', String(node.key === this.selectedKey));
      if (node.kind === 'l2') element.setAttribute('aria-expanded', String(!this.isCollapsed(assignmentKey(occurrence.parentKey ?? '', node.key))));
      if (node.kind === 'l1') element.setAttribute('aria-expanded', String(this.isParentExpanded(node.key)));
      element.style.left = `${occurrence.x}px`; element.style.top = `${occurrence.y}px`; element.style.width = `${occurrence.width}px`;
      const contextLabel = occurrence.role === 'ancestor' || occurrence.role === 'dependency' || occurrence.role === 'related' ? `${node.project}${node.milestoneKeys.length ? ` · ${node.milestoneKeys.map(key => this.graph.nodes.get(key)?.label ?? '').join(', ')}` : ''}` : context ? `${node.project} · related equipment` : node.id === node.label ? '' : node.id;
      const milestoneCount = this.parentChildren.get(node.key)?.length ?? 0;
      const summary = node.kind === 'l2' ? `${this.branchCounts.get(assignmentKey(occurrence.parentKey ?? '', node.key)) ?? 0} equipment` : node.kind === 'l1' ? `${milestoneCount} ${milestoneCount === 1 ? 'milestone' : 'milestones'}` : '';
      const typeLabel = occurrence.role === 'related' ? 'Related child' : occurrence.role === 'ancestor' ? 'Parent chain' : occurrence.role === 'dependency' ? this.quickStates().find(state => state.occurrenceId === occurrence.origin)?.direction === 'in' ? 'Required by' : 'Dependency' : kindLabel(node);
      setTrustedMarkup(element, `<span class="ssm-node-type"><i class="ssm-mark" aria-hidden="true"></i><span class="ssm-node-kind">${escapeHtml(typeLabel)}${occurrence.treeIssues.length ? ' · parent issue' : ''}${occurrence.depth > 4 ? ` · depth ${occurrence.depth}` : ''}${node.kind === 'l2' && node.parentMilestoneKeys.length > 1 ? ' · parent conflict' : ''}</span>${status ? `<span class="ssm-status-badge">${escapeHtml(status.label)}</span>` : ''}${matched ? '<span class="ssm-highlight-badge">Match</span>' : ''}</span><span class="ssm-node-label">${escapeHtml(node.label)}</span>${summary ? `<span class="ssm-node-summary">${escapeHtml(summary)}</span>` : contextLabel ? `<span class="ssm-node-id">${escapeHtml(contextLabel)}</span>` : ''}`);
    }
    setTrustedMarkup(this.q('[data-scene-labels]'), this.projectLabels.filter(inBounds).slice(0, cap).map(label => `<div class="ssm-project-label" style="left:${label.x}px;top:${label.y}px;width:${label.width}px">${escapeHtml(label.label)}</div>`).join(''));
    setTrustedMarkup(this.q('[data-scene-actions]'), this.branches.filter(inBounds).slice(0, cap).map(branch => {
      const toggle = branch.action === 'branch' || branch.action === 'parent', previous = branch.action.endsWith('prev');
      return `<button type="button" class="${toggle ? 'ssm-branch-toggle' : 'ssm-load-branch'}" data-action="${branch.action}" data-branch="${escapeHtml(branch.key)}"${toggle ? ` aria-expanded="${!branch.collapsed}"` : ''}${!toggle && (previous && branch.offset === 0 || !previous && branch.shown >= branch.count) ? ' disabled' : ''} style="left:${branch.x}px;top:${branch.y}px;width:${branch.width}px">${toggle ? `${branch.collapsed ? '▸ Expand' : '▾ Collapse'} · ${branch.count}` : previous ? `‹ Previous` : `Next › ${branch.shown}/${branch.count}`}</button>`;
    }).join(''));
    const visibleIds = new Set(visible.map(item => item.id));
    const childActions = this.equipmentActions.filter(item => visibleIds.has(item.sourceId)).map(item => `<button type="button" class="ssm-children-action" data-action="equipment-children" data-source="${escapeHtml(item.sourceId)}" aria-expanded="${item.expanded}" title="Show or hide direct structural children beneath this equipment." aria-describedby="${this.uid}-children-hint" style="left:${item.x}px;top:${item.y}px;width:${item.width}px">${item.expanded ? '▾' : '▸'} Children ${item.count}</button>`).join('');
    const siblingPages = this.siblingPages.filter(item => inBounds(item)).map(item => `<div class="ssm-sibling-paging" data-sibling-list="${escapeHtml(item.key)}" style="left:${item.x}px;top:${item.y}px;width:${item.width}px"><button type="button" data-action="equipment-prev" data-list="${escapeHtml(item.key)}" data-source="${escapeHtml(item.sourceId ?? '')}"${!item.offset ? ' disabled' : ''}>‹ Previous</button><span>${item.offset + 1}–${item.offset + item.shown}/${item.count}</span><button type="button" data-action="equipment-next" data-list="${escapeHtml(item.key)}" data-source="${escapeHtml(item.sourceId ?? '')}"${item.offset + item.shown >= item.count ? ' disabled' : ''}>Next ›</button></div>`).join('');
    setTrustedMarkup(this.q('[data-scene-actions]'), childActions + siblingPages, true);
    if (this.settings.options.showRelations) {
      const quick = visible.filter(item => item.node.kind === 'equipment' && item.groupKey).map(item => {
        const info = this.dependencyInfo(item.node.key);
        if (!info.outgoing.length && !info.incoming.length) return '';
        const direction = info.outgoing.length ? 'out' : 'in', count = direction === 'out' ? info.outgoing.length : info.incoming.length;
        return `<button type="button" class="ssm-dependency-action" data-action="quick-dependencies" data-target="${escapeHtml(item.node.key)}" data-source="${escapeHtml(item.id)}" data-group="${escapeHtml(item.groupKey)}" data-direction="${direction}" aria-expanded="${this.quickStates().some(state => state.occurrenceId === item.id)}" aria-label="${escapeHtml(item.node.label)}: ${count} ${direction === 'out' ? 'dependencies' : 'consumers'}" title="Show direct prerequisites or equipment that requires this item in a side lane." aria-describedby="${this.uid}-quick-dependency-hint" style="left:${item.x}px;top:${item.y + 67 + (this.equipmentActions.some(action => action.sourceId === item.id) ? 24 : 0)}px;width:${item.width}px">${direction === 'out' ? 'Dependencies' : 'Required by'} · ${count}</button>`;
      }).join('');
      const panels = this.dependencyPanels.filter(panel => inBounds({ ...panel, height: panel.pagingY - panel.y + 40 })).map(panel => {
        const pagingY = panel.pagingY;
        return `<section class="ssm-inline-dependencies" data-dependency-panel data-source="${escapeHtml(panel.sourceId)}" aria-label="Direct equipment connections" style="left:${panel.x}px;top:${panel.y}px;width:${panel.width}px"><div class="ssm-inline-direction"><button type="button" data-action="dependencies-out" data-source="${escapeHtml(panel.sourceId)}" aria-pressed="${panel.direction === 'out'}">Dependencies ${panel.outgoing}</button><button type="button" data-action="dependencies-in" data-source="${escapeHtml(panel.sourceId)}" aria-pressed="${panel.direction === 'in'}">Required by ${panel.incoming}</button><button type="button" data-action="dependencies-close" data-source="${escapeHtml(panel.sourceId)}" class="ssm-inline-close" aria-label="Close dependencies">×</button></div>${panel.total ? '' : `<span class="ssm-inline-empty">None supplied.</span>`}</section>${panel.total > 5 ? `<div class="ssm-inline-paging" style="left:${panel.x}px;top:${pagingY}px;width:${panel.width}px"><button type="button" data-action="dependencies-prev" data-source="${escapeHtml(panel.sourceId)}"${panel.offset === 0 ? ' disabled' : ''}>Previous</button><span>${panel.offset + 1}–${panel.offset + panel.shown}/${panel.total}</span><button type="button" data-action="dependencies-next" data-source="${escapeHtml(panel.sourceId)}"${panel.offset + panel.shown >= panel.total ? ' disabled' : ''}>Next</button></div>` : ''}`;
      }).join('');
      setTrustedMarkup(this.q('[data-scene-actions]'), quick + panels, true);
    }
    const limited = [...this.limitedTreeContext].map(([key, target]) => { const action = this.branches.find(branch => branch.key === key && branch.action === 'branch'); return action && inBounds({ ...action, y: this.limitedTreeNoticeY.get(key) ?? action.y + 24 }) ? `<button type="button" class="ssm-tree-context-notice" data-action="follow-tree" data-target="${escapeHtml(target)}" data-branch="${escapeHtml(key)}" style="left:${action.x}px;top:${this.limitedTreeNoticeY.get(key) ?? action.y + 24}px;width:${action.width}px">More parent context · follow chain</button>` : ''; }).join('');
    setTrustedMarkup(this.q('[data-scene-actions]'), limited, true);
    this.renderLinks();
    const displayed = new Set(visible.map(item => item.node.key));
    const directKeys = new Set(visible.filter(item => item.node.kind === 'equipment' && item.role !== 'ancestor' && item.role !== 'dependency' && item.role !== 'related' && this.projection.primaryKeys.has(item.node.key)).map(item => item.node.key));
    const direct = directKeys.size;
    const context = [...displayed].filter(key => !directKeys.has(key) && this.graph.nodes.get(key)?.kind === 'equipment').length;
    const matchedShown = this.highlightIndex ? [...displayed].filter(key => highlightMatches(this.highlightIndex!, key, this.highlightedValues)).length : 0;
    this.q('[data-highlight-count]').hidden = !this.highlightedValues.size;
    this.q('[data-highlight-count]').textContent = `${matchedShown} matches shown`;
    this.renderedCount = visible.length;
    this.q('[data-counts]').textContent = `${direct} direct · ${context} related · ${displayed.size}/${this.graph.nodes.size} nodes${this.truncated ? ' · zoom to explore' : ''}`;
    this.root.dataset.renderState = 'ready'; this.root.dataset.renderCount = String(visible.length);
    if (!force) this.motion.play(this.nodeElements.values(), this.camera.k, this.world.querySelector<SVGSVGElement>('.ssm-links'));
  }

  private renderLinks(): void {
    const svg = this.world.querySelector<SVGSVGElement>('.ssm-links');
    if (!svg) return;
    const marker = (id: string, color: string) => `<marker id="${this.uid}-${id}" viewBox="0 0 8 6" refX="7" refY="3" markerWidth="6" markerHeight="6" orient="auto"><polygon points="0,0 8,3 0,6" fill="${color}"/></marker>`;
    const paths: string[] = [];
    const index = getGraphIndex(this.graph), edges = new Map<string, SsmEdge>();
    const cap = this.settings.options.maxVisibleNodes * 4;
    // Preview arrows take precedence over unrelated high-degree adjacency scans.
    for (const quick of this.quickStates()) if (this.filters.showDependencies) {
      const info = this.dependencyInfo(quick.sourceKey);
      const direct = quick.direction === 'out' ? info.outgoing : info.incoming;
      const shown = new Set(this.occurrences.filter(item => item.role === 'dependency' && item.origin === quick.occurrenceId).map(item => item.node.key));
      const offset = this.dependencyPanels.find(panel => panel.sourceId === quick.occurrenceId)?.offset ?? quick.offset;
      for (const edge of direct.slice(offset, offset + 5)) {
        if (shown.has(quick.direction === 'out' ? edge.to : edge.from)) edges.set(edge.key, edge);
      }
    }
    let inspected = 0;
    const visibleKeys = new Set([...this.nodeElements.values()].map(element => element.dataset.node!));
    for (const direction of ['outgoing', 'incoming'] as const) for (const key of visibleKeys) {
      for (const edge of index[direction].get(key) ?? []) {
        if (++inspected > cap * 8 || edges.size >= cap) break;
        if (edge.kind === 'parent' && !this.filters.showParents || edge.kind === 'dependency' && !this.filters.showDependencies) continue;
        if (this.occurrencesByKey.has(edge.from) && this.occurrencesByKey.has(edge.to)) edges.set(edge.key, edge);
      }
      if (inspected > cap * 8 || edges.size >= cap) break;
    }
    for (const edge of edges.values()) {
      const cached = this.linkCache.get(edge.key);
      if (cached) { paths.push(cached); continue; }
      const froms = this.occurrencesByKey.get(edge.from) ?? [];
      const tos = this.occurrencesByKey.get(edge.to) ?? [];
      if (!froms.length || !tos.length) continue;
      const edgePaths: string[] = [];
      let pairs: [Occurrence, Occurrence][] = [];
      if (edge.kind === 'membership') pairs = froms.flatMap(from => { const to = tos.find(candidate => candidate.node.key === from.branch && candidate.parentKey === from.parentKey); return to ? [[from, to] as [Occurrence, Occurrence]] : []; });
      else if (edge.kind === 'hierarchy') pairs = froms.filter(from => from.parentKey === edge.to).map(from => [from, tos[0]]);
      else if (edge.kind === 'parent') {
        // A forest occurrence connects only to its actual chosen parent in the same assignment.
        pairs = froms.flatMap(from => {
          if (from.structuralEdgeKey !== edge.key) return [];
          const to = from.structuralParentOccurrenceId ? tos.find(candidate => candidate.id === from.structuralParentOccurrenceId) : tos.find(candidate => candidate.groupKey === from.groupKey && candidate.role !== 'dependency' && candidate.node.key === from.structuralParentKey);
          return to ? [[from, to] as [Occurrence, Occurrence]] : [];
        });
        if ((!pairs.length && !froms.some(from => from.groupKey)) || this.allConnections) {
          const ordinaryFrom = froms.filter(from => from.role !== 'dependency'), ordinaryTo = tos.filter(to => to.role !== 'dependency');
          let best: [Occurrence, Occurrence] | null = null, distance = Infinity;
          for (const from of ordinaryFrom) for (const to of ordinaryTo) {
            if (!this.allConnections && from.groupKey && to.groupKey && from.groupKey !== to.groupKey) continue;
            const d = Math.hypot(from.x - to.x, from.y - to.y);
            if (d < distance) { best = [from, to]; distance = d; }
          }
          if (best && !pairs.some(pair => pair[0].id === best![0].id && pair[1].id === best![1].id)) pairs.push(best);
        }
      } else {
        // Inline previews have their own occurrence identity; never route to another copy of a tag.
        for (const quick of this.quickStates()) {
          const source = this.occurrences.find(item => item.id === quick.occurrenceId);
          if (source && quick.direction === 'out' && edge.from === quick.sourceKey) {
            const target = tos.find(item => item.role === 'dependency' && item.origin === source.id && item.structuralParentOccurrenceId === null);
            if (target) pairs.push([source, target]);
          } else if (source && quick.direction === 'in' && edge.to === quick.sourceKey) {
            const target = froms.find(item => item.role === 'dependency' && item.origin === source.id && item.structuralParentOccurrenceId === null);
            if (target) pairs.push([target, source]);
          }
        }
        if (!pairs.length) {
          let best: [Occurrence, Occurrence] | null = null, distance = Infinity;
          for (const from of froms) for (const to of tos) {
            if (from.role === 'dependency' || to.role === 'dependency') continue;
            const d = Math.hypot(from.x - to.x, from.y - to.y);
            if (d < distance) { best = [from, to]; distance = d; }
          }
          if (best) pairs = [best];
        }
      }
      for (const [from, to] of pairs) {
        let path: string;
        if (edge.kind === 'membership') {
          const rail = to.x - 12;
          path = `M${from.x + from.width / 2},${from.y} V${from.y - 8} H${rail} V${to.y + 64} H${to.x + 8}`;
        } else if (edge.kind === 'hierarchy') {
          const ax = from.x + from.width / 2, ay = from.y, bx = to.x + to.width / 2, by = to.y + 64;
          const rail = to.x - 14;
          path = `M${ax},${ay} V${ay - 16} H${rail} V${by} H${bx}`;
        } else if (edge.kind === 'parent' && from.structuralEdgeKey === edge.key && from.groupKey === to.groupKey) {
          const milestone = (this.occurrencesByKey.get(from.branch ?? to.branch ?? '') ?? []).find(item => item.parentKey === from.parentKey);
          const rail = from.role === 'dependency' ? Math.min(from.x, to.x) - 12 : (milestone?.x ?? Math.min(from.x, to.x)) - 20;
          path = `M${from.x + from.width / 2},${from.y} V${from.y - 8} H${rail} V${to.y + 32} H${to.x}`;
        } else if (edge.kind === 'dependency' && (to.origin === from.id || from.origin === to.id)) {
          const forward = to.origin === from.id, source = forward ? from : to, target = forward ? to : from;
          const exit = source.x + source.width + 8, rail = target.x - 18, rowGap = source.y - 8;
          path = forward
            ? `M${source.x + source.width},${source.y + 32} H${exit} V${rowGap} H${rail} V${target.y + 32} H${target.x}`
            : `M${target.x},${target.y + 32} H${rail} V${rowGap} H${exit} V${source.y + 32} H${source.x + source.width}`;
        } else if (Math.abs(from.x - to.x) < 30) {
          const ax = from.x + from.width, ay = from.y + 32, bx = to.x + to.width, by = to.y + 32, rail = Math.max(ax, bx) + (edge.kind === 'parent' ? 12 : 21);
          path = `M${ax},${ay} C${rail},${ay} ${rail},${by} ${bx},${by}`;
        } else {
          const right = to.x > from.x;
          const ax = right ? from.x + from.width : from.x, ay = from.y + 32;
          const bx = right ? to.x : to.x + to.width, by = to.y + 32;
          path = `M${ax},${ay} C${(ax + bx) / 2},${ay} ${(ax + bx) / 2},${by} ${bx},${by}`;
        }
        const arrow = edge.kind === 'parent' || edge.kind === 'dependency' ? ` marker-end="url(#${this.uid}-${edge.kind})"` : '';
        edgePaths.push(`<path class="${edge.kind}" data-from="${escapeHtml(edge.from)}" data-to="${escapeHtml(edge.to)}" data-from-occurrence="${escapeHtml(from.id)}" data-to-occurrence="${escapeHtml(to.id)}" d="${path}"${arrow}/>`);
      }
      const markup = edgePaths.join(''); this.linkCache.set(edge.key, markup); paths.push(markup);
    }
    setTrustedMarkup(svg, `<defs>${marker('parent', 'var(--ssm-parent)')}${marker('dependency', 'var(--ssm-dependency)')}</defs>${paths.join('')}`);
    svg.querySelectorAll<SVGPathElement>('path[data-from]').forEach(path => path.classList.toggle('is-dimmed', !!this.activeKeys && !(this.activeKeys.has(path.dataset.from!) && this.activeKeys.has(path.dataset.to!))));
  }

  private applySelectionFocus(): void {
    const focusToken = JSON.stringify([this.graph.revision, this.selectedKey, this.allConnections, this.filters.showParents, this.filters.showDependencies]);
    if (focusToken !== this.activeFocusToken) {
    this.activeFocusToken = focusToken;
    const active = this.selectedKey && !this.allConnections ? walkConnections(this.graph, [this.selectedKey], [this.filters.showParents ? 'parent' : null, this.filters.showDependencies ? 'dependency' : null].filter((kind): kind is 'parent' | 'dependency' => !!kind), 'out') : null;
    if (active && this.selectedKey) {
      active.add(this.selectedKey);
      const selected = this.graph.nodes.get(this.selectedKey);
      if (selected?.kind === 'l1' || selected?.kind === 'l2') walkConnections(this.graph, [selected.key], ['hierarchy', 'membership'], 'in').forEach(key => active.add(key));
      const index = getGraphIndex(this.graph);
      const connected = [...(index.outgoing.get(this.selectedKey) ?? []), ...(index.incoming.get(this.selectedKey) ?? [])];
      connected.forEach(edge => { if ((edge.kind !== 'parent' || this.filters.showParents) && (edge.kind !== 'dependency' || this.filters.showDependencies)) { active.add(edge.from); active.add(edge.to); } });
      for (const key of [...active]) {
        const node = this.graph.nodes.get(key);
        node?.milestoneKeys.forEach(milestone => { active.add(milestone); this.graph.nodes.get(milestone)?.parentMilestoneKeys.forEach(parent => active.add(parent)); });
        node?.parentMilestoneKeys.forEach(parent => active.add(parent));
      }
    }
    this.activeKeys = active;
    }
    const active = this.activeKeys;
    this.viewportToken = '';
    this.nodeElements.forEach(element => {
      const key = element.dataset.node!;
      element.classList.toggle('is-selected', key === this.selectedKey);
      element.classList.toggle('is-dimmed', !!active && !active.has(key));
      element.setAttribute('aria-pressed', String(key === this.selectedKey));
    });
    this.world.querySelectorAll<SVGPathElement>('path[data-from]').forEach(path => path.classList.toggle('is-dimmed', !!active && !(active.has(path.dataset.from!) && active.has(path.dataset.to!))));
    this.renderMinimap();
    this.q<HTMLButtonElement>('[data-action="focus"]').disabled = !this.selectedKey || !this.occurrences.some(occurrence => occurrence.node.key === this.selectedKey);
  }

  private renderDrawer(): void {
    const drawer = this.q('[data-drawer]');
    const node = this.selectedKey ? this.graph.nodes.get(this.selectedKey) : undefined;
    drawer.hidden = !this.drawerOpen || !node;
    if (!node) { drawer.replaceChildren(); return; }
    if (!this.drawerOpen) return;
    if (!this.settings.options.showRelations) this.drawerTab = 'overview';
    const breadcrumbs = [node.project, ...node.parentMilestoneKeys.map(key => this.graph.nodes.get(key)?.label).filter(Boolean), ...node.milestoneKeys.map(key => this.graph.nodes.get(key)?.label).filter(Boolean)].join(' › ');
    const tabs = this.settings.options.showRelations ? `<div class="ssm-drawer-tabs" role="tablist" aria-label="Node detail sections"><button type="button" role="tab" data-action="tab-overview" aria-selected="${this.drawerTab === 'overview'}">Overview</button><button type="button" role="tab" data-action="tab-connections" aria-selected="${this.drawerTab === 'connections'}">Connections</button></div>` : '';
    setTrustedMarkup(drawer, `<div class="ssm-drawer-header"><strong>${escapeHtml(node.label)}</strong><button type="button" class="ssm-close" data-action="close" aria-label="Close node details">×</button></div><div class="ssm-breadcrumb">${escapeHtml(breadcrumbs)}</div>${tabs}<div data-drawer-content>${this.drawerTab === 'overview' ? this.renderOverview(node) : this.renderConnections(node)}</div>`);
    this.measureViewport();
  }

  private renderOverview(node: SsmNode): string {
    const options = this.settings.options;
    const rows: [string, string][] = [];
    if (options.showIdentity) rows.push(['Tag', node.id], ['Type', nodeTypeLabel(node)]);
    if (options.showProject) rows.push(['Project', node.project]);
    if (options.showDiscipline && node.discipline) rows.push(['Discipline', node.discipline]);
    if (options.showMilestones) {
      if (node.milestoneKeys.length) rows.push(['Milestone', node.milestoneKeys.map(key => this.graph.nodes.get(key)?.label ?? key).join(', ')]);
      if (node.parentMilestoneKeys.length) rows.push(['Parent milestone', node.parentMilestoneKeys.map(key => this.graph.nodes.get(key)?.label ?? key).join(', ')]);
    }
    const fields = this.settings.detailsFor(node.kind).filter(field => field.visible).sort((a, b) => a.order - b.order);
    for (const presentation of fields) {
      const values = node.metadata[presentation.field.key] ?? [];
      const present = values.filter(value => value !== null && value !== undefined && value !== '');
      if (!present.length && !options.showEmptyDetails) continue;
      const formatted = present.length ? present.map(value => this.formatDetail(value, presentation)).join(' · ') : '—';
      rows.push([presentation.label, `${present.length > 1 ? 'Conflicting values: ' : ''}${formatted}`]);
    }
    const ids = this.selectionIds(node);
    const reportSelected = this.selectionManager.hasSelection();
    const actions = `<div class="ssm-drawer-actions">${ids.length ? '<button type="button" data-action="select-report">Select in report</button>' : ''}${reportSelected ? '<button type="button" data-action="clear-report">Clear report selection</button>' : ''}${node.kind === 'equipment' ? `<button type="button" data-action="follow-parent">Follow parent chain</button>${options.showRelations ? '<button type="button" data-action="show-dependencies">Follow dependency chain</button>' : ''}` : ''}<button type="button" data-action="focus">Focus</button>${this.trail ? '<button type="button" data-action="full-ssm">Full SSM</button>' : ''}</div>`;
    const occurrence = this.occurrences.find(item => item.id === this.selectedOccurrenceId && item.node.key === node.key) ?? this.occurrencesByKey.get(node.key)?.[0];
    const issues = [...new Set([...node.issues, ...(occurrence?.treeIssues ?? [])])];
    const exportSection = node.kind === 'l2' ? `<section class="ssm-export"><strong>Milestone completion</strong><button type="button" data-action="export-milestone"${this.exporting || this.graph.partial ? ' disabled' : ''}>${this.exporting ? 'Preparing workbook…' : 'Export workbook'}</button><small>${this.graph.partial ? 'Finish loading all batches before exporting.' : 'Assigned equipment and unfinished related equipment, including the full parent chain.'}</small></section>` : '';
    return `<dl>${rows.map(([label, value]) => `<div class="ssm-detail-row"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>${exportSection}${issues.map(issue => `<div class="ssm-issue">${escapeHtml(issue)}</div>`).join('')}${node.kind === 'unresolved' ? '<div class="ssm-issue">Referenced record unavailable in the supplied data.</div>' : ''}${actions}`;
  }

  private async exportMilestone(): Promise<void> {
    const key = this.selectedKey, graph = this.graph, revision = graph.revision;
    if (this.exporting || !key || graph.nodes.get(key)?.kind !== 'l2') return;
    const exportButton = this.root.querySelector<HTMLButtonElement>('[data-action="export-milestone"]');
    const hadFocus = this.root.ownerDocument.activeElement === exportButton;
    this.exporting = true;
    if (exportButton) { exportButton.disabled = true; exportButton.textContent = 'Preparing workbook…'; }
    try {
      if (graph.partial) throw new Error('Finish loading all batches before exporting.');
      const service = this.host.downloadService;
      if (!service?.exportStatus || (!service.exportVisualsContentExtended && !service.exportVisualsContent)) throw new Error('Workbook downloads are unavailable in this host. Open the report in Power BI Desktop or Service.');
      const permission = await service.exportStatus();
      if (this.destroyed) return;
      // SDK PrivilegeStatus is a type-only const enum (Allowed=0, DisabledByAdmin=3).
      if (permission !== 0) throw new Error(permission === 3
        ? 'Your Power BI administrator has disabled custom visual downloads.' : 'Workbook downloads are unavailable in this Power BI host.');
      if (this.graph !== graph || graph.revision !== revision) throw new Error('The data changed. Export again to use the latest rows.');
      const report = buildMilestoneExport(graph, key);
      const content = await createMilestoneWorkbook(report);
      if (this.destroyed) return;
      if (this.graph !== graph || graph.revision !== revision) throw new Error('The data changed. Export again to use the latest rows.');
      // The host's XLSX contract accepts base64 and applies tenant policy and user consent.
      const result = service.exportVisualsContentExtended
        ? await service.exportVisualsContentExtended(content, report.fileName, 'base64', 'Milestone completion workbook')
        : { downloadCompleted: await service.exportVisualsContent(content, report.fileName, 'base64', 'Milestone completion workbook') };
      if (!this.destroyed) this.notice = result.downloadCompleted ? `Workbook exported: ${report.milestone.label}.` : 'Download cancelled or not completed. You can try again.';
    } catch (error) {
      if (!this.destroyed) this.notice = error instanceof Error ? error.message : 'The workbook could not be exported. Try again.';
    } finally {
      this.exporting = false;
      if (!this.destroyed) {
        const active = this.root.ownerDocument.activeElement;
        const restoreFocus = hadFocus && this.selectedKey === key && this.drawerOpen && (active === exportButton || active === this.root.ownerDocument.body);
        this.render(); this.announce(this.notice);
        if (restoreFocus) this.root.querySelector<HTMLButtonElement>('[data-action="export-milestone"]')?.focus({ preventScroll: true });
      }
    }
  }

  private formatDetail(value: powerbi.PrimitiveValue, presentation: DetailPresentation): string {
    const locale = this.host.locale || 'en-US';
    if (presentation.format === 'text') return String(value);
    const isDate = presentation.format === 'date' || (presentation.format === 'auto' && !!presentation.field.column.type?.dateTime);
    if (isDate) {
      const text = String(value), dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
      const date = value instanceof Date ? value : dateOnly ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])) : new Date(text);
      if (Number.isNaN(date.getTime())) return text;
      if (presentation.format === 'auto' && presentation.field.column.format) return valueFormatter.create({ format: presentation.field.column.format, cultureSelector: locale }).format(date);
      return new Intl.DateTimeFormat(locale).format(date);
    }
    if (presentation.format === 'auto' && presentation.field.column.format) return valueFormatter.create({ format: presentation.field.column.format, cultureSelector: locale }).format(value);
    if (typeof value === 'number') {
      if (presentation.format === 'integer') return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
      if (presentation.format === 'decimal') return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
      return new Intl.NumberFormat(locale, { maximumFractionDigits: 8 }).format(value);
    }
    return String(value);
  }

  private renderConnections(node: SsmNode): string {
    const index = getGraphIndex(this.graph), outgoing = index.outgoing.get(node.key) ?? new Set<SsmEdge>(), incoming = index.incoming.get(node.key) ?? new Set<SsmEdge>();
    let selfEdges = 0;
    for (const edge of outgoing) if (edge.from === node.key && edge.to === node.key) selfEdges++;
    const count = outgoing.size + incoming.size - selfEdges;
    if (!count) return '<div class="ssm-issue">No connections in the supplied data.</div>';
    this.connectionOffset = Math.min(this.connectionOffset, Math.floor((count - 1) / 30) * 30);
    const connections: SsmEdge[] = [], seen = new Set<string>(); let position = 0;
    const incident = function* () { yield* outgoing; yield* incoming; };
    for (const edge of incident()) { if (seen.has(edge.key)) continue; seen.add(edge.key); if (position++ < this.connectionOffset) continue; connections.push(edge); if (connections.length >= 30) break; }
    const navigation = count > 30 ? `<div class="ssm-connection-paging"><button type="button" data-action="connections-prev"${this.connectionOffset === 0 ? ' disabled' : ''}>Previous</button><span>${this.connectionOffset + 1}–${this.connectionOffset + connections.length} / ${count}</span><button type="button" data-action="connections-next"${this.connectionOffset + connections.length >= count ? ' disabled' : ''}>Next</button></div>` : '';
    return navigation + connections.map(edge => {
      const outgoing = edge.from === node.key;
      const target = this.graph.nodes.get(outgoing ? edge.to : edge.from);
      return `<div class="ssm-connection"><span class="ssm-connection-kind">${relationLabel(edge, outgoing)}</span>${target ? `<button type="button" data-action="connection" data-target="${escapeHtml(target.key)}">${escapeHtml(target.label)}</button><small>${escapeHtml(target.id)} · ${escapeHtml(target.project)}${target.milestoneKeys.length ? ` · ${escapeHtml(target.milestoneKeys.map(key => this.graph.nodes.get(key)?.label ?? key).join(', '))}` : ''}${target.kind === 'unresolved' ? ' · unavailable' : ''}</small>` : '<span>Unavailable reference</span>'}${edge.issues.map(issue => `<small>${escapeHtml(issue)}</small>`).join('')}</div>`;
    }).join('');
  }

  private selectionIds(node: SsmNode): SelectionId[] {
    if (!this.table || (node.kind !== 'equipment' && node.kind !== 'header')) return [];
    const cached = this.rowsToSelection.get(node.key);
    if (cached) return cached;
    const ids: SelectionId[] = [];
    const seen = new Set<string>();
    for (const row of node.rowIndices) {
      if (!this.table.identity?.[row]) continue;
      const id = this.host.createSelectionIdBuilder().withTable(this.table, row).createSelectionId();
      if (!seen.has(id.getKey())) { ids.push(id); seen.add(id.getKey()); }
    }
    this.rowsToSelection.set(node.key, ids);
    return ids;
  }

  private renderSearch(): void {
    const input = this.q<HTMLInputElement>('[data-search]');
    const results = this.q('[data-search-results]');
    const term = input.value.trim().toLowerCase();
    results.hidden = !term;
    if (!term) { results.replaceChildren(); return; }
    const matches = [...this.graph.nodes.values()].filter(node => `${node.id} ${node.label} ${node.project}`.toLowerCase().includes(term)).slice(0, 30);
    setTrustedMarkup(results, matches.length ? matches.map(node => {
      const outside = this.filters.projects !== null && !this.filters.projects.includes(node.project);
      const clearDiscipline = !!this.filters.discipline && !!node.discipline && this.filters.discipline !== node.discipline;
      return `<button type="button" class="ssm-search-result" data-action="search-result" data-target="${escapeHtml(node.key)}"><span>${escapeHtml(node.label)}${node.id !== node.label ? ` · ${escapeHtml(node.id)}` : ''}</span><small>${escapeHtml(node.project)} · ${escapeHtml(nodeTypeLabel(node))}${node.milestoneKeys.length ? ` · ${escapeHtml(node.milestoneKeys.map(key => this.graph.nodes.get(key)?.label ?? '').join(', '))}` : ''}</small><small>${outside ? `Add ${escapeHtml(node.project)} and open` : 'Locate node'}${clearDiscipline ? ' · clears discipline filter' : ''}</small></button>`;
    }).join('') : '<div class="ssm-search-empty">No matching nodes in the supplied data.<button type="button" data-action="clear-search">Clear search</button></div>');
  }

  private revealNode(key: string, explicitProjectChange: boolean): void {
    const node = this.graph.nodes.get(key);
    if (!node) return;
    if (explicitProjectChange) { this.trail = null; this.notice = ''; this.forcedKeys.clear(); }
    else this.forcedKeys.add(key);
    if (explicitProjectChange && this.filters.discipline && node.discipline && !(node.disciplines ?? [node.discipline]).includes(this.filters.discipline)) this.filters.discipline = null;
    if (this.filters.projects !== null && !this.filters.projects.includes(node.project)) {
      if (explicitProjectChange) this.filters.projects = [...this.filters.projects, node.project];
      else this.forcedKeys.add(key);
    }
    if (node.milestoneKeys.length) {
      if (this.filters.l2Key && !node.milestoneKeys.includes(this.filters.l2Key)) this.filters.l2Key = null;
      if (this.filters.l1Key && !node.parentMilestoneKeys.includes(this.filters.l1Key)) this.filters.l1Key = null;
    }
    if (node.kind === 'l1') { if (this.filters.l1Key && this.filters.l1Key !== key) this.filters.l1Key = null; this.filters.l2Key = null; }
    if (node.kind === 'l2') { if (this.filters.l2Key && this.filters.l2Key !== key) this.filters.l2Key = null; if (this.filters.l1Key && !node.parentMilestoneKeys.includes(this.filters.l1Key)) this.filters.l1Key = null; }
    if (!explicitProjectChange) {
      this.forcedKeys.add(key);
      node.milestoneKeys.forEach(milestone => this.forcedKeys.add(milestone));
      node.parentMilestoneKeys.forEach(parent => this.forcedKeys.add(parent));
    }
    // Locate the supplied identity and its declared hierarchy even when local
    // discipline or a combined milestone scope excludes its primary cohort.
    this.forcedKeys.add(key);
    node.parentMilestoneKeys.forEach(parent => this.forcedKeys.add(parent));
    node.milestoneKeys.forEach(milestone => { this.forcedKeys.add(milestone); this.graph.nodes.get(milestone)?.parentMilestoneKeys.forEach(parent => this.forcedKeys.add(parent)); });
    if (explicitProjectChange) { this.pendingRestore = null; this.syncLoadingScope(); }
    this.openNodeAncestors(node);
    this.selectedKey = key; this.drawerOpen = true; this.connectionOffset = 0;
    this.q<HTMLInputElement>('[data-search]').value = '';
    this.q('[data-search-results]').hidden = true;
    this.render();
    if (!this.occurrencesByKey.has(key)) { this.forcedKeys.add(key); this.render(); }
    this.schedule(() => this.focusSelected());
    this.announce(`${node.label}, ${node.project}, selected.`);
  }

  private openNodeAncestors(node: SsmNode): void {
    const index = getGraphIndex(this.graph), pageSize = this.equipmentPageSize();
    if (node.kind === 'l1') { this.expandedParents.add(node.key); this.collapsedParents.delete(node.key); return; }
    const included = new Set(projectGraph(this.graph, this.filters).nodes.map(item => item.key));
    this.forcedKeys.forEach(key => included.add(key));
    const touched = new Set<string>();
    const milestones = node.kind === 'l2' ? [node.key] : node.milestoneKeys;
    for (const milestoneKey of milestones) {
      const milestone = this.graph.nodes.get(milestoneKey); if (!milestone) continue;
      for (const parent of milestone.parentMilestoneKeys) {
        const cohortKey = assignmentKey(parent, milestoneKey), cohort = index.membersByAssignment.get(cohortKey) ?? new Set<string>();
        if (node.kind !== 'l2' && !cohort.has(node.key)) continue;
        this.expandedParents.add(parent); this.collapsedParents.delete(parent);
        if (!touched.has(parent)) {
          const children = [...(index.milestonesByParent.get(parent) ?? [])].filter(key => included.has(key) && (!this.trail || this.forcedKeys.has(key))).map(key => this.graph.nodes.get(key)!).sort((a, b) => a.label.localeCompare(b.label));
          const position = Math.max(0, children.findIndex(child => child.key === milestoneKey));
          this.parentOffsets.set(parent, Math.floor(position / 12) * 12); touched.add(parent);
        }
        this.collapsed.delete(cohortKey); this.branchLimits.set(cohortKey, pageSize);
        const scope = JSON.stringify([index.version, this.filters, [...this.forcedKeys], this.trail]);
        const tree = this.cohortTree(cohortKey, included, scope);
        const path = tree.ancestorPath(node.key);
        this.treeFocus.delete(cohortKey);
        const start = Math.max(0, path.length - Math.max(5, Math.min(40, this.settings.options.maxVisibleNodes - 6)));
        if (start) this.treeFocus.set(cohortKey, path[start]);
        for (let level = start; level < path.length; level++) {
          const key = path[level], parentKey = level > start ? path[level - 1] : null;
          const siblings = parentKey ? tree.childrenByKey.get(parentKey) ?? [] : start ? [key] : tree.roots;
          const position = Math.max(0, siblings.indexOf(key));
          this.siblingOffsets.set(this.siblingListKey(cohortKey, parentKey), Math.floor(position / pageSize) * pageSize);
          if (level < path.length - 1) { const id = this.treeOccurrenceId(cohortKey, key); this.expandedEquipment.add(id); this.collapsedEquipment.delete(id); }
        }
      }
    }
  }

  private beginMotion(occurrence?: Occurrence): void {
    this.motion.capture(this.nodeElements.values(), this.settings.options.animate && !prefersReducedMotion());
    this.motionAnchor = occurrence ? { id: occurrence.id, key: occurrence.node.key, parentKey: occurrence.parentKey, x: occurrence.x, y: occurrence.y } : null;
  }

  private branchOccurrence(key: string): Occurrence | undefined {
    const parent = this.occurrencesByKey.get(key)?.find(item => item.node.kind === 'l1');
    if (parent) return parent;
    return this.occurrences.find(item => item.node.kind === 'l2' && assignmentKey(item.parentKey ?? '', item.node.key) === key);
  }

  private openQuickDependencies(occurrenceId: string, direction: 'out' | 'in'): void {
    const occurrence = this.occurrences.find(item => item.id === occurrenceId);
    if (!occurrence?.groupKey || !this.settings.options.showRelations) return;
    this.beginMotion(occurrence);
    const states = this.quickStates(), existing = states.findIndex(state => state.occurrenceId === occurrenceId);
    if (existing >= 0) { states.splice(existing); }
    else {
      const cycle = states.find(state => state.sourceKey === occurrence.node.key);
      if (cycle) { this.selectedKey = cycle.sourceKey; this.selectedOccurrenceId = cycle.occurrenceId; this.render(); this.announce('This dependency is already open.'); return; }
      if (!occurrence.origin) states.length = 0;
      if (states.length >= 8) { this.notice = 'Eight lanes open. Close a lane or use Follow dependency chain in details to continue.'; this.drawerOpen = true; this.render(); return; }
      states.push({ sourceKey: occurrence.node.key, occurrenceId, groupKey: occurrence.groupKey, direction, offset: 0 });
    }
    this.quickDependencies = states[0] ?? null; this.quickTrail = states.slice(1);
    this.selectedKey = occurrence.node.key; this.selectedOccurrenceId = occurrence.id;
    this.filters.showDependencies = true;
    this.render();
    this.schedule(() => this.focusQuickAction(occurrenceId));
  }

  private ensureQuickDependenciesVisible(id?: string): void {
    const state = this.quickStates().find(item => item.occurrenceId === id) ?? this.quickStates()[this.quickStates().length - 1]; if (!state) return;
    const source = this.occurrences.find(item => item.id === state.occurrenceId), panel = this.dependencyPanels.find(item => item.sourceId === state.occurrenceId);
    if (!source || !panel) return;
    this.measureViewport();
    const right = (panel.x + panel.width) * this.camera.k + this.camera.x;
    if (right > this.viewportWidth - 12) this.camera.x -= right - this.viewportWidth + 12;
    const previewHeight = 62 + Math.min(2, panel.shown || 1) * 92;
    const screenTop = source.y * this.camera.k + this.camera.y;
    if (screenTop < 12) this.camera.y += 12 - screenTop;
    else if (screenTop + previewHeight * this.camera.k > this.viewportHeight - 12) this.camera.y -= Math.min(screenTop - 12, screenTop + previewHeight * this.camera.k - this.viewportHeight + 12);
    this.applyCamera();
  }

  private focusQuickAction(id: string): void { this.root.querySelectorAll<HTMLButtonElement>('[data-action="quick-dependencies"]').forEach(button => { if (button.dataset.source === id) button.focus({ preventScroll: true }); }); }

  private changeQuickDependencies(direction?: 'out' | 'in', offsetDelta = 0, close = false, sourceId?: string): void {
    const states = this.quickStates(), position = sourceId ? states.findIndex(state => state.occurrenceId === sourceId) : states.length - 1;
    const state = states[position]; if (!state) return;
    this.beginMotion(this.occurrences.find(item => item.id === state.occurrenceId));
    const id = state.occurrenceId;
    states.splice(position + (close ? 0 : 1));
    if (!close) { if (direction) { state.direction = direction; state.offset = 0; } else state.offset = Math.max(0, state.offset + offsetDelta); }
    this.quickDependencies = states[0] ?? null; this.quickTrail = states.slice(1);
    this.render();
    this.schedule(() => { if (close) this.focusQuickAction(id); else { const action = direction ? direction === 'out' ? 'dependencies-out' : 'dependencies-in' : offsetDelta < 0 ? 'dependencies-prev' : 'dependencies-next'; [...this.root.querySelectorAll<HTMLButtonElement>(`[data-action="${action}"]`)].find(button => button.dataset.source === id)?.focus({ preventScroll: true }); } });
  }

  private syncHighlights(): void {
    const field = this.settings.selectedHighlightField;
    if (this.highlightFieldKey !== field.key) { this.highlightFieldKey = field.key; this.highlightedValues.clear(); this.highlightQuery = ''; this.highlightOffset = 0; this.q<HTMLInputElement>('[data-highlight-search]').value = ''; }
    this.highlightIndex = getHighlightIndex(this.graph, field);
    for (const key of this.highlightedValues) if (!this.highlightIndex.keysByValue.has(key)) this.highlightedValues.delete(key);
  }
  private renderHighlights(): void {
    const field = this.settings.selectedHighlightField;
    this.q('[data-action="highlight"]').textContent = this.highlightedValues.size ? `Highlight · ${this.highlightedValues.size}` : 'Highlight';
    this.q('[data-action="highlight"]').setAttribute('aria-expanded', String(this.highlightPopupOpen));
    this.q('[data-highlight-popup]').hidden = !this.highlightPopupOpen;
    this.q('[data-highlight-field]').textContent = field.label;
    if (!this.highlightPopupOpen) return;
    const query = this.highlightQuery.trim().toLocaleLowerCase(), values = (this.highlightIndex?.values ?? []).filter(value => !query || value.label.toLocaleLowerCase().includes(query));
    const offset = this.highlightOffset = Math.min(this.highlightOffset, Math.max(0, Math.floor((values.length - 1) / 40) * 40));
    setTrustedMarkup(this.q('[data-highlight-values]'), values.slice(offset, offset + 40).map(value => `<label><input type="checkbox" data-highlight-value="${escapeHtml(value.key)}"${this.highlightedValues.has(value.key) ? ' checked' : ''}>${escapeHtml(value.label)}</label>`).join('') || '<span class="ssm-muted">No matching values.</span>');
    setTrustedMarkup(this.q('[data-highlight-paging]'), values.length > 40 ? `<button type="button" data-action="highlight-prev"${!offset ? ' disabled' : ''}>Previous</button><span>${offset + 1}–${Math.min(offset + 40, values.length)}/${values.length}</span><button type="button" data-action="highlight-next"${offset + 40 >= values.length ? ' disabled' : ''}>Next</button>` : '');
  }

  private filterChanged(fit: boolean): void {
    this.pendingRestore = null;
    this.syncLoadingScope();
    this.forcedKeys.clear(); this.trail = null; this.notice = ''; this.quickDependencies = null; this.quickTrail = []; this.treeFocus.clear();
    this.projection = projectGraph(this.graph, this.filters);
    if (this.selectedKey && !this.projection.nodes.some(node => node.key === this.selectedKey)) {
      this.selectedKey = null; this.drawerOpen = false; this.notice = 'Selection cleared because it is outside this scope.';
    }
    this.render();
    if (fit) this.schedule(() => this.fitAll());
  }

  private showEmpty(title: string, message: string, action?: string, buttonLabel?: string): void {
    const empty = this.q('[data-empty]');
    empty.hidden = false;
    setTrustedMarkup(empty, `<strong>${escapeHtml(title)}</strong>${message ? `<span>${escapeHtml(message)}</span>` : ''}${action ? `<button type="button" data-action="${escapeHtml(action)}">${escapeHtml(buttonLabel)}</button>` : ''}`);
  }

  private measureViewport(): void { this.viewportWidth = Math.max(1, this.viewport.clientWidth); this.viewportHeight = Math.max(1, this.viewport.clientHeight); }
  private applyCamera(): void {
    this.controlTooltip.hide();
    if (this.drag?.moved) this.rememberView(false);
    this.world.style.transform = `translate(${this.camera.x}px,${this.camera.y}px) scale(${this.camera.k})`;
    this.world.style.setProperty('--ssm-label-scale', String(Math.min(1, this.camera.k)));
    this.world.style.setProperty('--ssm-font-size', `${this.settings.options.fontSize}px`);
    this.world.classList.toggle('is-overview', this.camera.k < .65);
    this.q('[data-zoom]').textContent = `${Math.round(this.camera.k * 100)}%`;
    this.q<HTMLButtonElement>('[data-action="zoom-out"]').disabled = this.camera.k <= .121;
    this.q<HTMLButtonElement>('[data-action="zoom-in"]').disabled = this.camera.k >= 2.999;
    this.renderMinimap();
    this.root.dataset.renderState = 'pending';
    if (!this.viewportRaf) this.viewportRaf = requestAnimationFrame(() => { this.viewportRaf = 0; if (!this.destroyed) { this.renderViewport(); this.root.dataset.renderState = 'ready'; } });
  }

  private zoom(next: number, x = this.viewportWidth / 2, y = this.viewportHeight / 2): void {
    this.motion.finish();
    const k = Math.max(.12, Math.min(3, next));
    const ratio = k / this.camera.k;
    this.camera.x = x - (x - this.camera.x) * ratio;
    this.camera.y = y - (y - this.camera.y) * ratio;
    this.camera.k = k; this.applyCamera();
  }

  private fitAll(): void {
    this.motion.finish();
    this.measureViewport();
    this.camera.k = Math.max(.12, Math.min(1, (this.viewportWidth - 30) / this.worldWidth, (this.viewportHeight - 30) / this.worldHeight));
    this.camera.x = (this.viewportWidth - this.worldWidth * this.camera.k) / 2;
    this.camera.y = (this.viewportHeight - this.worldHeight * this.camera.k) / 2;
    this.applyCamera();
  }

  private focusSelected(): void {
    const occurrence = this.occurrences.find(item => item.node.key === this.selectedKey);
    if (!occurrence) return;
    this.measureViewport();
    this.camera.k = Math.min(1.15, Math.max(.6, (this.viewportWidth - 30) / occurrence.width));
    this.camera.x = this.viewportWidth / 2 - (occurrence.x + occurrence.width / 2) * this.camera.k;
    this.camera.y = this.viewportHeight / 2 - (occurrence.y + occurrence.height / 2) * this.camera.k;
    this.applyCamera();
  }

  private renderMinimap(): void {
    const minimap = this.q<HTMLButtonElement>('.ssm-minimap');
    const extendsView = this.worldWidth * this.camera.k > this.viewportWidth || this.worldHeight * this.camera.k > this.viewportHeight;
    minimap.hidden = !this.settings.options.showMinimap || !extendsView || !this.occurrences.length;
    if (minimap.hidden) return;
    const svg = minimap.querySelector<SVGSVGElement>('svg')!;
    svg.setAttribute('viewBox', `0 0 ${this.worldWidth} ${this.worldHeight}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    if (this.minimapDirty) {
      const stride = Math.max(1, Math.ceil(this.occurrences.length / 600));
      setTrustedMarkup(svg, this.occurrences.filter((_item, position) => position % stride === 0).map(occurrence => `<rect class="node${occurrence.node.key === this.selectedKey ? ' active' : ''}" data-map-node="${escapeHtml(occurrence.node.key)}" x="${occurrence.x}" y="${occurrence.y}" width="${occurrence.width}" height="${occurrence.height}"/>`).join('') + '<rect class="camera"/>');
      this.minimapDirty = false;
      this.minimapSelectedKey = this.selectedKey;
    }
    if (this.minimapSelectedKey !== this.selectedKey) {
      svg.querySelectorAll<SVGRectElement>('[data-map-node]').forEach(rect => rect.classList.toggle('active', rect.dataset.mapNode === this.selectedKey));
      this.minimapSelectedKey = this.selectedKey;
    }
    const camera = svg.querySelector('.camera');
    if (camera) { camera.setAttribute('x', String(-this.camera.x / this.camera.k)); camera.setAttribute('y', String(-this.camera.y / this.camera.k)); camera.setAttribute('width', String(this.viewportWidth / this.camera.k)); camera.setAttribute('height', String(this.viewportHeight / this.camera.k)); }
  }

  private schedule(action: () => void): void { const remember = this.handlingUserInteraction; cancelAnimationFrame(this.raf); this.raf = requestAnimationFrame(() => { this.raf = 0; if (!this.destroyed) { action(); if (remember) this.rememberView(); } }); }
  private announce(message: string): void { this.q('[data-announcement]').textContent = message; }

  private bindEvents(): void {
    const signal = this.abort.signal;
    if (typeof matchMedia === 'function') matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', event => {
      this.root.classList.toggle('ssm-reduced-motion', event.matches || !this.settings.options.animate);
      if (event.matches) this.motion.finish();
    }, { signal });
    if (typeof matchMedia === 'function') matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (!this.viewerTheme && this.settings.options.theme === 'auto') { this.controlTooltip.hide(); this.applyTheme(); }
    }, { signal });
    this.root.addEventListener('click', event => this.userAction(() => this.onClick(event), true, ['pause-loading', 'resume-loading', 'load-more'].includes((event.target as Element).closest<HTMLElement>('[data-action]')?.dataset.action ?? '')), { signal });
    this.root.addEventListener('change', event => this.userAction(() => this.onChange(event)), { signal });
    this.root.addEventListener('input', event => {
      if (event.target === this.q('[data-search]')) { clearTimeout(this.searchTimer); this.searchTimer = setTimeout(() => this.renderSearch(), 120); this.rememberView(false); }
      else if (event.target === this.q('[data-project-search]')) this.renderProjects();
      else if (event.target === this.q('[data-highlight-search]')) { this.highlightQuery = (event.target as HTMLInputElement).value; this.highlightOffset = 0; clearTimeout(this.searchTimer); this.searchTimer = setTimeout(() => this.renderHighlights(), 120); }
    }, { signal });
    this.root.addEventListener('keydown', event => {
      const changesView = event.key === 'Escape'
        || (event.target === this.viewport && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', 'Home'].includes(event.key))
        || (event.target === this.q('[data-search]') && event.key === 'Enter');
      if (changesView) this.userAction(() => this.onKeyDown(event)); else this.onKeyDown(event);
    }, { signal });
    this.root.ownerDocument.addEventListener('visibilitychange', () => { if (this.root.ownerDocument.hidden) { this.controlTooltip.hide(); this.flushView(); } }, { signal });
    this.root.ownerDocument.defaultView?.addEventListener('pagehide', () => { this.controlTooltip.hide(); this.flushView(); }, { signal });
    this.root.addEventListener('contextmenu', event => {
      if (!this.interactions) return;
      const button = (event.target as Element).closest<HTMLButtonElement>('[data-node]');
      const node = button?.dataset.node ? this.graph.nodes.get(button.dataset.node) : undefined;
      const ids = node ? this.selectionIds(node) : [];
      if (ids.length) { event.preventDefault(); event.stopPropagation(); void this.selectionManager.showContextMenu(ids[0], { x: event.clientX, y: event.clientY }); }
      else if (!button) { event.preventDefault(); void this.selectionManager.showContextMenu(this.host.createSelectionIdBuilder().createSelectionId(), { x: event.clientX, y: event.clientY }); }
    }, { signal });
    this.viewport.addEventListener('pointerdown', event => {
      if (!this.interactions || event.button !== 0 || (event.target as Element).closest('button,input,select')) return;
      this.motion.finish();
      this.drag = { pointer: event.pointerId, x: this.camera.x, y: this.camera.y, startX: event.clientX, startY: event.clientY, moved: false };
      this.viewport.setPointerCapture(event.pointerId);
    }, { signal });
    this.viewport.addEventListener('pointermove', event => {
      if (!this.drag || event.pointerId !== this.drag.pointer) return;
      const dx = event.clientX - this.drag.startX, dy = event.clientY - this.drag.startY;
      if (Math.hypot(dx, dy) > 5) this.drag.moved = true;
      if (this.drag.moved) { this.camera.x = this.drag.x + dx; this.camera.y = this.drag.y + dy; this.viewport.classList.add('is-panning'); this.applyCamera(); }
    }, { signal });
    const release = (event: PointerEvent) => {
      if (!this.drag || event.pointerId !== this.drag.pointer) return;
      if (this.drag.moved) { this.suppressClickUntil = performance.now() + 250; this.rememberView(); }
      this.drag = null; this.viewport.classList.remove('is-panning');
      if (this.viewport.hasPointerCapture(event.pointerId)) this.viewport.releasePointerCapture(event.pointerId);
    };
    this.viewport.addEventListener('pointerup', release, { signal });
    this.viewport.addEventListener('pointercancel', release, { signal });
    this.viewport.addEventListener('wheel', event => {
      if (!this.interactions || (event.target as Element).closest('.ssm-minimap')) return;
      event.preventDefault();
      this.motion.finish();
      const rect = this.viewport.getBoundingClientRect();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.viewportHeight : 1);
      this.zoom(this.camera.k * Math.exp(-Math.max(-300, Math.min(300, delta)) * .002), event.clientX - rect.left, event.clientY - rect.top); this.rememberView(false);
    }, { signal, passive: false });
    this.world.addEventListener('focusin', event => {
      const button = (event.target as Element).closest<HTMLButtonElement>('[data-occurrence]');
      if (!button || !button.matches(':focus-visible')) return;
      const occurrence = this.occurrences.find(item => item.id === button.dataset.occurrence);
      if (!occurrence) return;
      const x = occurrence.x * this.camera.k + this.camera.x, y = occurrence.y * this.camera.k + this.camera.y;
      if (x < 0 || x + occurrence.width * this.camera.k > this.viewportWidth || y < 0 || y + occurrence.height * this.camera.k > this.viewportHeight) {
        this.camera.x = this.viewportWidth / 2 - (occurrence.x + occurrence.width / 2) * this.camera.k;
        this.camera.y = this.viewportHeight / 2 - (occurrence.y + occurrence.height / 2) * this.camera.k;
        this.applyCamera();
      }
    }, { signal });
  }

  private onClick(event: MouseEvent): void {
    const target = event.target as Element;
    if (performance.now() < this.suppressClickUntil && target.closest('[data-viewport]')) { event.preventDefault(); event.stopPropagation(); return; }
    const actionButton = target.closest<HTMLElement>('[data-action]');
    const nodeButton = target.closest<HTMLButtonElement>('[data-node]');
    if (!this.interactions) return;
    const action = actionButton?.dataset.action;
    if (action) {
      switch (action) {
        case 'theme': {
          if (getHostHighContrastColors(this.host).enabled) break;
          this.viewerTheme = this.isDarkTheme() ? 'light' : 'dark';
          this.controlTooltip.hide(); this.applyTheme();
          this.announce(`${this.viewerTheme === 'dark' ? 'Dark' : 'Light'} mode.`); break;
        }
        case 'filters': this.filtersOpen = !this.filtersOpen; this.root.classList.toggle('is-filters-open', this.filtersOpen); actionButton!.setAttribute('aria-expanded', String(this.filtersOpen)); break;
        case 'projects': this.projectPopupOpen = !this.projectPopupOpen; this.renderNavigation(); if (this.projectPopupOpen) this.q<HTMLInputElement>('[data-project-search]').focus(); break;
        case 'projects-all': this.filters.projects = null; this.projectPopupOpen = false; this.filterChanged(true); break;
        case 'projects-none': this.filters.projects = []; this.filterChanged(true); break;
        case 'clear-filters': this.filters = { projects: null, discipline: null, l1Key: null, l2Key: null, includeContext: true, showParents: true, showDependencies: true }; this.filterChanged(true); break;
        case 'zoom-in': this.zoom(this.camera.k * 1.2); break;
        case 'zoom-out': this.zoom(this.camera.k / 1.2); break;
        case 'fit': this.fitAll(); break;
        case 'focus': this.focusSelected(); break;
        case 'reset': this.startOver(); break;
        case 'help': { const help = this.q('[data-help]'); help.hidden = !help.hidden; actionButton!.setAttribute('aria-expanded', String(!help.hidden)); this.measureViewport(); this.applyCamera(); break; }
        case 'close': this.closeDrawer(); break;
        case 'export-milestone': void this.exportMilestone(); break;
        case 'tab-overview': this.drawerTab = 'overview'; this.renderDrawer(); break;
        case 'tab-connections': this.drawerTab = 'connections'; this.renderDrawer(); break;
        case 'connections-prev': this.connectionOffset = Math.max(0, this.connectionOffset - 30); this.renderDrawer(); break;
        case 'connections-next': this.connectionOffset += 30; this.renderDrawer(); break;
        case 'search-result': if (actionButton?.dataset.target) this.revealNode(actionButton.dataset.target, true); break;
        case 'connection': if (actionButton?.dataset.target) this.revealNode(actionButton.dataset.target, false); break;
        case 'clear-search': this.q<HTMLInputElement>('[data-search]').value = ''; this.renderSearch(); break;
        case 'branch': {
          const key = actionButton!.dataset.branch!;
          this.beginMotion(this.branchOccurrence(key));
          if (this.collapsed.has(key) || ((this.startCollapsed || !this.settings.options.initialExpanded) && !this.branchLimits.has(key))) { this.collapsed.delete(key); this.branchLimits.set(key, this.branchLimits.get(key) ?? 30); }
          else this.collapsed.add(key);
          this.render(); break;
        }
        case 'branch-next': case 'branch-prev': {
          const key = actionButton!.dataset.branch!, step = this.equipmentPageSize();
          this.beginMotion(this.branchOccurrence(key));
          this.branchOffsets.set(key, Math.max(0, (this.branchOffsets.get(key) ?? 0) + (action === 'branch-next' ? step : -step))); this.render(); break;
        }
        case 'parent': {
          const key = actionButton!.dataset.branch!;
          this.beginMotion(this.branchOccurrence(key)); this.toggleParent(key); this.render(); break;
        }
        case 'parent-next': case 'parent-prev': {
          const key = actionButton!.dataset.branch!;
          this.beginMotion(this.branchOccurrence(key));
          this.parentOffsets.set(key, Math.max(0, (this.parentOffsets.get(key) ?? 0) + (action === 'parent-next' ? 12 : -12))); this.render(); break;
        }
        case 'equipment-children': if (actionButton?.dataset.source) this.toggleEquipment(actionButton.dataset.source); break;
        case 'equipment-prev': case 'equipment-next': {
          const key = actionButton!.dataset.list!, source = actionButton!.dataset.source;
          this.beginMotion(this.occurrences.find(item => item.id === source));
          this.siblingOffsets.set(key, Math.max(0, (this.siblingOffsets.get(key) ?? 0) + (action === 'equipment-next' ? this.equipmentPageSize() : -this.equipmentPageSize()))); this.render(); break;
        }
        case 'highlight': this.highlightPopupOpen = !this.highlightPopupOpen; this.renderHighlights(); if (this.highlightPopupOpen) this.q<HTMLInputElement>('[data-highlight-search]').focus(); break;
        case 'highlight-close': this.highlightPopupOpen = false; this.renderHighlights(); this.q('[data-action="highlight"]').focus(); break;
        case 'highlight-clear': this.highlightedValues.clear(); this.viewportToken = ''; this.render(); break;
        case 'highlight-prev': case 'highlight-next': this.highlightOffset = Math.max(0, this.highlightOffset + (action === 'highlight-next' ? 40 : -40)); this.renderHighlights(); break;
        case 'quick-dependencies': if (actionButton?.dataset.source) this.openQuickDependencies(actionButton.dataset.source, actionButton.dataset.direction === 'in' ? 'in' : 'out'); break;
        case 'dependencies-out': this.changeQuickDependencies('out', 0, false, actionButton?.dataset.source); break;
        case 'dependencies-in': this.changeQuickDependencies('in', 0, false, actionButton?.dataset.source); break;
        case 'dependencies-prev': this.changeQuickDependencies(undefined, -5, false, actionButton?.dataset.source); break;
        case 'dependencies-next': this.changeQuickDependencies(undefined, 5, false, actionButton?.dataset.source); break;
        case 'dependencies-close': this.changeQuickDependencies(undefined, 0, true, actionButton?.dataset.source); break;
        case 'follow-tree': {
          const target = actionButton!.dataset.target ?? this.limitedTreeContext.get(actionButton!.dataset.branch!);
          const node = target ? this.graph.nodes.get(target) : undefined;
          if (node) { this.selectedKey = node.key; this.followConnections('parent'); } break;
        }
        case 'select-report': { const node = this.selectedKey ? this.graph.nodes.get(this.selectedKey) : undefined; const ids = node ? this.selectionIds(node) : []; if (ids.length) void this.selectionManager.select(ids, event.ctrlKey || event.metaKey).then(() => { if (!this.destroyed) { this.markReportSelection(); this.renderDrawer(); } }); break; }
        case 'clear-report': void this.selectionManager.clear().then(() => { if (!this.destroyed) { this.markReportSelection(); this.renderDrawer(); } }); break;
        case 'follow-parent': this.followConnections('parent'); break;
        case 'show-dependencies': this.followConnections('dependency'); break;
        case 'full-ssm': this.forcedKeys.clear(); this.trail = null; this.notice = ''; this.filters.l1Key = null; this.filters.l2Key = null; this.render(); this.fitAll(); break;
        case 'pause-loading': this.loader.pause(); break;
        case 'resume-loading': if (this.hasProjectScope()) this.loader.resume(); break;
        case 'load-more': if (this.hasProjectScope()) this.loader.request(); break;
        case 'issues': this.notice = this.graph.warnings.slice(0, 5).join(' · '); this.render(); break;
        case 'minimap': {
          const rect = actionButton!.getBoundingClientRect();
          const x = event.clientX ? (event.clientX - rect.left) / rect.width * this.worldWidth : this.worldWidth / 2;
          const y = event.clientY ? (event.clientY - rect.top) / rect.height * this.worldHeight : this.worldHeight / 2;
          this.camera.x = this.viewportWidth / 2 - x * this.camera.k; this.camera.y = this.viewportHeight / 2 - y * this.camera.k; this.applyCamera(); break;
        }
      }
      return;
    }
    if (nodeButton?.dataset.node) {
      this.selectedKey = nodeButton.dataset.node; this.selectedOccurrenceId = nodeButton.dataset.occurrence ?? null; this.drawerOpen = true; this.notice = ''; this.connectionOffset = 0;
      const node = this.graph.nodes.get(this.selectedKey);
      const occurrence = this.occurrences.find(item => item.id === nodeButton.dataset.occurrence);
      if (node?.kind === 'l2') { this.beginMotion(occurrence); this.toggleBranches([assignmentKey(occurrence?.parentKey ?? '', node.key)]); this.render(); }
      else if (node?.kind === 'l1') { this.beginMotion(occurrence); this.toggleParent(node.key); this.render(); }
      this.renderDrawer(); this.applySelectionFocus(); this.measureViewport(); this.applyCamera();
      this.announce(`${this.graph.nodes.get(this.selectedKey)?.label ?? 'Node'} selected.`);
      return;
    }
    if (target.closest('[data-viewport]') && !target.closest('button,input,select')) this.closeDrawer();
    if (!target.closest('.ssm-highlight-wrap') && this.highlightPopupOpen) { this.highlightPopupOpen = false; this.renderHighlights(); }
    if (!target.closest('.ssm-project-wrap') && this.projectPopupOpen) { this.projectPopupOpen = false; this.renderNavigation(); }
    if (!target.closest('.ssm-search-wrap')) this.q('[data-search-results]').hidden = true;
  }

  private onChange(event: Event): void {
    if (!this.interactions) return;
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    if (target.dataset.highlightValue) { if ((target as HTMLInputElement).checked) this.highlightedValues.add(target.dataset.highlightValue); else this.highlightedValues.delete(target.dataset.highlightValue); this.viewportToken = ''; this.render(); const key = target.dataset.highlightValue; this.schedule(() => [...this.root.querySelectorAll<HTMLInputElement>('[data-highlight-value]')].find(input => input.dataset.highlightValue === key)?.focus({ preventScroll: true })); }
    else if (target.dataset.project) {
      const projects = new Set(this.filters.projects ?? this.graph.projects);
      if ((target as HTMLInputElement).checked) projects.add(target.dataset.project); else projects.delete(target.dataset.project);
      this.filters.projects = projects.size === this.graph.projects.length ? null : [...projects]; this.filterChanged(true);
    } else if (target.dataset.filter) {
      if (target.dataset.filter === 'l1') { this.filters.l1Key = target.value || null; this.filters.l2Key = null; }
      if (target.dataset.filter === 'l2') this.filters.l2Key = target.value || null;
      if (target.dataset.filter === 'discipline') this.filters.discipline = target.value || null;
      if (target.dataset.filter === 'l2' && target.value) { const node = this.graph.nodes.get(target.value); if (node) this.openNodeAncestors(node); }
      this.filterChanged(true);
    } else if (target.dataset.layer) {
      const checked = (target as HTMLInputElement).checked;
      if (target.dataset.layer === 'parent') this.filters.showParents = checked;
      if (target.dataset.layer === 'dependency') this.filters.showDependencies = checked;
      if (target.dataset.layer === 'context') this.filters.includeContext = checked;
      if (target.dataset.layer === 'all') { this.allConnections = checked; this.linkCache.clear(); this.viewportToken = ''; }
      this.render();
    }
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') { this.highlightPopupOpen = false; this.renderHighlights(); this.projectPopupOpen = false; this.filtersOpen = false; this.root.classList.remove('is-filters-open'); this.q('[data-action="filters"]').setAttribute('aria-expanded', 'false'); this.q('[data-project-popup]').hidden = true; this.q('[data-search-results]').hidden = true; if (this.selectedKey || this.drawerOpen) this.closeDrawer(); return; }
    if (!this.interactions) return;
    if (event.target === this.q('[data-search]') && event.key === 'Enter') { const first = this.q('[data-search-results]').querySelector<HTMLElement>('[data-target]'); if (first?.dataset.target) { event.preventDefault(); this.revealNode(first.dataset.target, true); } return; }
    if (event.target !== this.viewport) return;
    const movement: Record<string, [number, number]> = { ArrowLeft: [40, 0], ArrowRight: [-40, 0], ArrowUp: [0, 40], ArrowDown: [0, -40] };
    if (movement[event.key]) { event.preventDefault(); this.camera.x += movement[event.key][0]; this.camera.y += movement[event.key][1]; this.applyCamera(); }
    else if (event.key === '+' || event.key === '=') { event.preventDefault(); this.zoom(this.camera.k * 1.2); }
    else if (event.key === '-') { event.preventDefault(); this.zoom(this.camera.k / 1.2); }
    else if (event.key === 'Home') { event.preventDefault(); this.fitAll(); }
  }

  private startOver(): void {
    clearTimeout(this.searchTimer); this.searchTimer = undefined;
    cancelAnimationFrame(this.raf); this.raf = 0;
    this.pendingRestore = null;
    const fresh = parseViewState(JSON.stringify({ version: 1, scope: this.viewScope, startCollapsed: true,
      viewerTheme: this.viewerTheme, authorTheme: this.settings.options.theme, loadingPaused: this.loader.state.paused }), this.viewScope)!;
    this.restoreView(fresh);
    this.highlightPopupOpen = false; this.highlightQuery = ''; this.highlightOffset = 0;
    this.projectPopupOpen = false; this.filtersOpen = false;
    this.q<HTMLInputElement>('[data-project-search]').value = '';
    this.q<HTMLInputElement>('[data-highlight-search]').value = '';
    this.q('[data-search-results]').hidden = true; this.q('[data-help]').hidden = true;
    this.root.classList.remove('is-filters-open');
    this.q('[data-action="filters"]').setAttribute('aria-expanded', 'false');
    this.q('[data-action="help"]').setAttribute('aria-expanded', 'false');
    this.syncLoadingScope(); this.render(); this.fitAll();
    this.q('[data-action="reset"]').focus({ preventScroll: true });
    this.announce('View reset. Choose a project to begin.');
  }

  private closeDrawer(): void {
    const camera = { ...this.camera }, key = this.selectedKey;
    this.selectedKey = null; this.selectedOccurrenceId = null; this.drawerOpen = false; this.connectionOffset = 0;
    this.q('[data-drawer]').hidden = true; this.controlTooltip.hide(); this.applySelectionFocus();
    const element = [...this.nodeElements.values()].find(node => node.dataset.node === key);
    if (element) element.focus({ preventScroll: true }); else this.viewport.focus({ preventScroll: true });
    Object.assign(this.camera, camera); this.measureViewport(); this.applyCamera();
    this.announce('Selection cleared.');
  }

  private followConnections(kind: 'parent' | 'dependency'): void {
    if (!this.selectedKey) return;
    this.forcedKeys = walkConnections(this.graph, [this.selectedKey], [kind], 'out');
    for (const key of [...this.forcedKeys]) { const node = this.graph.nodes.get(key); node?.milestoneKeys.forEach(m => this.forcedKeys.add(m)); node?.parentMilestoneKeys.forEach(m => this.forcedKeys.add(m)); }
    if (kind === 'parent') this.filters.showParents = true; else this.filters.showDependencies = true;
    this.filters.includeContext = true;
    this.trail = kind;
    this.notice = `${kind === 'parent' ? 'Parent chain' : 'Dependencies'} · ${this.graph.nodes.get(this.selectedKey)?.id ?? ''} · ${this.forcedKeys.size} related nodes`;
    const index = getGraphIndex(this.graph);
    for (const key of this.forcedKeys) {
      const node = this.graph.nodes.get(key); if (!node) continue;
      for (const milestoneKey of node.milestoneKeys) for (const parent of this.graph.nodes.get(milestoneKey)?.parentMilestoneKeys ?? []) {
        const cohortKey = assignmentKey(parent, milestoneKey); if (!index.membersByAssignment.get(cohortKey)?.has(key)) continue;
        this.expandedParents.add(parent); this.collapsedParents.delete(parent); this.parentOffsets.set(parent, 0);
        this.collapsed.delete(cohortKey); this.branchLimits.set(cohortKey, 30); this.branchOffsets.set(cohortKey, 0);
      }
    }
    const included = new Set(projectGraph(this.graph, this.filters).nodes.map(node => node.key)); this.forcedKeys.forEach(key => included.add(key));
    const scope = JSON.stringify([index.version, this.filters, [...this.forcedKeys], this.trail]), cohorts = new Set<string>();
    for (const key of this.forcedKeys) for (const milestone of this.graph.nodes.get(key)?.milestoneKeys ?? []) for (const parent of this.graph.nodes.get(milestone)?.parentMilestoneKeys ?? []) {
      const cohort = assignmentKey(parent, milestone); if (index.membersByAssignment.get(cohort)?.has(key)) cohorts.add(cohort);
    }
    for (const cohort of cohorts) for (const row of this.cohortTree(cohort, included, scope).rows) if (row.hasChildren) { const id = this.treeOccurrenceId(cohort, row.nodeKey); this.expandedEquipment.add(id); this.collapsedEquipment.delete(id); }
    const selected = this.graph.nodes.get(this.selectedKey); if (selected) this.openNodeAncestors(selected);
    this.render(); this.fitKeys(this.forcedKeys);
    this.announce(`${kind === 'parent' ? 'Parent chain' : 'Dependencies'} revealed.`);
  }

  private toggleBranches(keys: string[]): void {
    const expand = keys.some(key => this.isCollapsed(key));
    for (const key of keys) { if (expand) { this.collapsed.delete(key); this.branchLimits.set(key, 30); } else this.collapsed.add(key); }
  }

  private toggleParent(key: string): void {
    if (this.isParentExpanded(key)) { this.expandedParents.delete(key); this.collapsedParents.add(key); }
    else { this.expandedParents.add(key); this.collapsedParents.delete(key); }
  }

  private fitKeys(keys: Set<string>): void {
    const occurrences = this.occurrences.filter(occurrence => keys.has(occurrence.node.key));
    if (!occurrences.length) return;
    this.measureViewport();
    const x = Math.min(...occurrences.map(node => node.x)), y = Math.min(...occurrences.map(node => node.y));
    const width = Math.max(...occurrences.map(node => node.x + node.width)) - x, height = Math.max(...occurrences.map(node => node.y + node.height)) - y;
    this.camera.k = Math.max(.12, Math.min(1, (this.viewportWidth - 30) / width, (this.viewportHeight - 30) / height));
    this.camera.x = this.viewportWidth / 2 - (x + width / 2) * this.camera.k;
    this.camera.y = this.viewportHeight / 2 - (y + height / 2) * this.camera.k;
    this.applyCamera();
  }

  private markReportSelection(): void {
    const keys = new Set((this.selectionManager.getSelectionIds() as SelectionId[]).map(id => id.getKey()));
    this.reportSelectedNodeKeys.clear();
    this.rowsToSelection.forEach((ids, key) => { if (ids.some(id => keys.has(id.getKey()))) this.reportSelectedNodeKeys.add(key); });
    this.nodeElements.forEach(element => element.classList.toggle('is-report-selected', this.reportSelectedNodeKeys.has(element.dataset.node!)));
  }

  public getFormattingModel(): powerbi.visuals.FormattingModel { return this.settings.getFormattingModel(); }
  public destroy(): void { this.flushView(); this.destroyed = true; this.controlTooltip.dispose(); this.motion.dispose(); this.loader.dispose(); this.dataStore.clear(); this.abort.abort(); cancelAnimationFrame(this.raf); cancelAnimationFrame(this.viewportRaf); clearTimeout(this.searchTimer); this.host.tooltipService?.hide({ immediately: true, isTouchEvent: false }); this.root.remove(); }
}
