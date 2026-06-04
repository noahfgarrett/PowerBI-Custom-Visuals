/**
 * Network Graph — Power BI IVisual implementation.
 * Force-directed network graph using d3-force simulation with spring
 * animations, drag interaction, and glassmorphic styling.
 */

import powerbi from 'powerbi-visuals-api';
import * as d3 from 'd3';
import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel';
import { NetworkGraphSettings } from './settings';
import {
  popIn,
  fadeSlideIn,
  animate,
  cubicOut,
  DURATION,
  applyCardStyle,
  type CardStyleMode,
  getHostChartColor,
  getChartColor,
  withOpacity,
  renderChartTitle,
  applyDataLabelFormatting,
  applyChartAria,
  applyDataPointAria,
  attachKeyboardNav,
  ensureFocusRingStyles,
  resolveColorTheme,
  type ColorThemeName,
  buildConditionalConfig,
  resolveConditionalColor,
  resolveDropdown,
  syncLegendFormattingVisibility,
  syncTitleFormattingVisibility,
  renderLegend,
  type LegendItem,
  getDateFilterIndices,
  isDateColumn,
  type DateFilterConfig,
  formatWithSettings,
  attachEmptySpaceContextMenu,
  getVisualEmptyStateMode,
  getLocalizedString,
} from '../../core/src';

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataView = powerbi.DataView;
import ISelectionId = powerbi.visuals.ISelectionId;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

import '../style/visual.less';

// ── Internal Types ───────────────────────────────────────────────

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  displayLabel: string;
  group: number;
  role: NodeRole;
  highlighted: boolean;
  selectionId: ISelectionId;
  detailValues: Record<string, number>;
  detailFields: Record<string, string[]>;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  sourceLabel: string;
  targetLabel: string;
  weight: number;
  detailValues: Record<string, number>;
}

/** Extracted data from the PBI dataView. */
interface NetworkData {
  nodes: GraphNode[];
  links: GraphLink[];
  /** Whether cross-highlight data is present from another visual/slicer. */
  hasHighlights: boolean;
  /** Source role display name from the bound field. */
  sourceLabel: string;
  /** Target role display name from the bound field. */
  targetLabel: string;
  /** Weight role display name from the bound measure. */
  weightLabel: string;
  /** Optional image URL or data URI bound from the data well. */
  backgroundImageSource: string;
  /** Extra measure names used for source badges and richer tooltips. */
  detailMeasureLabels: string[];
  /** Extra category/text field names used in the click inspector. */
  detailFieldLabels: string[];
}

type NodeRole = 'source' | 'target' | 'both';
type TargetSizeMode = 'fixed' | 'count' | 'weight';
type NodeLabelPosition = 'right' | 'inside' | 'left' | 'above' | 'below';
type NetworkLayoutMode = 'sourceTarget' | 'force' | 'mapCanvas';
type TargetRailPosition = 'right' | 'left' | 'top' | 'bottom';
type MapCanvasTargetLayoutPreset = 'orbit' | 'cluster' | 'hybrid' | 'rail';
type PersistedSourcePositions = Record<string, { x: number; y: number }>;
type DetailFilterKind = 'field' | 'measure' | 'target';
type DetailFilterOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte';

interface DetailFilterFieldOption {
  key: string;
  kind: DetailFilterKind;
  label: string;
}

interface DetailFilterValueOption {
  value: string;
  label: string;
}

interface DetailFilterRule {
  id: number;
  kind: DetailFilterKind;
  label: string;
  operator: DetailFilterOperator;
  value: string;
  numericValue?: number;
}

// ── Constants ────────────────────────────────────────────────────

const MARGIN = { top: 8, right: 8, bottom: 8, left: 8 };
const EMPTY_STATE_TEXT = 'Add Source and Target fields to build the network graph.';
const ARROW_SIZE = 8;
const ESTIMATED_CHARACTER_WIDTH = 0.58;
const DEFAULT_LINK_COLOR = '#64748B';
const MAP_CANVAS_MIN_PADDING = 24;
const SELECTED_NODE_OPACITY = '1';
const SELECTION_CONTEXT_OPACITY = '0.45';
const CROSS_HIGHLIGHT_CONTEXT_OPACITY = '0.3';

// ── Visual ───────────────────────────────────────────────────────

export class NetworkGraphVisual implements IVisual {
  private host: IVisualHost;
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private container: HTMLElement;
  private settings: NetworkGraphSettings;
  private formattingSettingsService: FormattingSettingsService;
  private cancelAnimations: Array<() => void> = [];
  private currentData: NetworkData | null = null;
  private emptyStateMode: 'unconfigured' | 'noData' = 'unconfigured';
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
  private simulation: d3.Simulation<GraphNode, GraphLink> | null = null;
  private adjacency = new Map<string, Set<string>>();
  private hoveredNodeId: string | null = null;
  private currentZoomScale = 1;
  private currentViewport: powerbi.IViewport = { width: 300, height: 300 };
  private searchOpen = false;
  private searchQuery = '';
  private detailFilterOpen = false;
  private detailFilterRules: DetailFilterRule[] = [];
  private pendingDetailFilterField = '';
  private pendingDetailFilterOperator: DetailFilterOperator = 'eq';
  private pendingDetailFilterValue = '';
  private detailFilterMoreOpen = false;
  private nextDetailFilterRuleId = 1;

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new NetworkGraphSettings();
    this.formattingSettingsService = new FormattingSettingsService(options.host.createLocalizationManager());
    this.container.classList.add('network-container');
    attachEmptySpaceContextMenu(this.container, this.selectionManager, () =>
      this.host.createSelectionIdBuilder().createSelectionId(),
    );
  }

  public update(options: VisualUpdateOptions): void {
    // Cancel running animations
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];

    // Stop previous simulation
    if (this.simulation) {
      this.simulation.stop();
      this.simulation = null;
    }

    // Parse settings from dataView
    const dataView = options.dataViews?.[0];
    this.emptyStateMode = getVisualEmptyStateMode(dataView);
    if (dataView) {
      this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
        NetworkGraphSettings,
        dataView
      );
    }

    // Migrate legacy enableGlass -> cardStyleMode (backward compat)
    const legacyCardObj = dataView?.metadata?.objects?.['cardSettings'];
    if (legacyCardObj) {
      const legacyGlass = legacyCardObj['enableGlass'];
      if (legacyGlass === false) {
        this.settings.cardSettings.cardStyleMode.value = { value: 'none', displayName: 'None' };
      }
    }

    syncTitleFormattingVisibility(this.settings.titleFormattingCard);
    syncLegendFormattingVisibility(this.settings.legendFormattingCard);

    // Date filter: hide start/end when disabled
    this.settings.dateFilterFormattingCard.startDate.visible = this.settings.dateFilterFormattingCard.enableDateFilter.value;
    this.settings.dateFilterFormattingCard.endAtCurrentDate.visible = this.settings.dateFilterFormattingCard.enableDateFilter.value;
    this.settings.dateFilterFormattingCard.endDate.visible = this.settings.dateFilterFormattingCard.enableDateFilter.value && !this.settings.dateFilterFormattingCard.endAtCurrentDate.value;

    this.settings.dataLabelFormattingCard.showDataLabels.visible = false;
    this.settings.dataLabelFormattingCard.dataLabelFontSize.visible = false;
    const targetSizeMode = this.getTargetSizeMode();
    const showDynamicRadiusBounds = this.settings.nodeSettings.sizeByDegree.value || targetSizeMode !== 'fixed';
    this.settings.nodeSettings.minRadius.visible = showDynamicRadiusBounds;
    this.settings.nodeSettings.maxRadius.visible = showDynamicRadiusBounds;

    // Hide node label font controls when showLabels is off
    const showNodeLabels = this.settings.nodeSettings.showLabels.value;
    this.settings.nodeSettings.fontSize.visible = showNodeLabels;
    this.settings.nodeSettings.useRoleLabelFontSizes.visible = showNodeLabels;
    const useRoleLabelFontSizes = showNodeLabels && this.settings.nodeSettings.useRoleLabelFontSizes.value;
    this.settings.nodeSettings.sourceLabelFontSize.visible = useRoleLabelFontSizes;
    this.settings.nodeSettings.targetLabelFontSize.visible = useRoleLabelFontSizes;
    this.settings.nodeSettings.fontColor.visible = showNodeLabels;
    this.settings.nodeSettings.fontFamily.visible = showNodeLabels;
    this.settings.nodeSettings.fontWeight.visible = showNodeLabels;
    this.settings.nodeSettings.labelVisibility.visible = showNodeLabels;
    this.settings.nodeSettings.labelPosition.visible = showNodeLabels;
    const nodeLabelVisibilityMode = resolveDropdown(this.settings.nodeSettings.labelVisibility) ?? 'smart';
    this.settings.nodeSettings.adaptiveZoomThreshold.visible = showNodeLabels
      && (nodeLabelVisibilityMode === 'adaptive' || nodeLabelVisibilityMode === 'smart');
    this.settings.nodeSettings.labelOffset.visible = showNodeLabels
      && (resolveDropdown(this.settings.nodeSettings.labelPosition) ?? 'right') !== 'inside';
    this.settings.nodeSettings.maxLabelCharacters.visible = showNodeLabels;
    this.settings.nodeSettings.labelHalo.visible = showNodeLabels;
    this.settings.nodeSettings.labelHaloColor.visible = showNodeLabels && this.settings.nodeSettings.labelHalo.value;
    this.settings.nodeSettings.labelHaloWidth.visible = showNodeLabels && this.settings.nodeSettings.labelHalo.value;

    // Conditional visibility: hide link min/max width when widthByWeight is off
    this.settings.linkSettings.minWidth.visible = this.settings.linkSettings.widthByWeight.value;
    this.settings.linkSettings.maxWidth.visible = this.settings.linkSettings.widthByWeight.value;
    this.settings.linkSettings.weightLabelFontSize.visible = this.settings.linkSettings.showWeightLabels.value;
    this.settings.linkSettings.weightLabelFontColor.visible = this.settings.linkSettings.showWeightLabels.value;
    this.settings.linkSettings.weightLabelBackgroundColor.visible = this.settings.linkSettings.showWeightLabels.value;
    this.settings.linkSettings.weightLabelBackgroundOpacity.visible = this.settings.linkSettings.showWeightLabels.value;
    this.settings.linkSettings.minWeightLabel.visible = this.settings.linkSettings.showWeightLabels.value;

    // Conditional visibility: hide zoom sub-settings when zoom is off
    this.settings.interactionSettings.pinDraggedNodes.visible = this.settings.interactionSettings.enableDrag.value;
    this.settings.interactionSettings.minZoom.visible = this.settings.interactionSettings.enableZoom.value;
    this.settings.interactionSettings.maxZoom.visible = this.settings.interactionSettings.enableZoom.value;
    this.settings.interactionSettings.zoomWheelSensitivity.visible = this.settings.interactionSettings.enableZoom.value;

    const layoutMode = this.getLayoutMode();
    const sourceTargetLayout = layoutMode === 'sourceTarget';
    const mapCanvasLayout = layoutMode === 'mapCanvas';
    this.settings.physicsAndLayoutSettings.roleSeparation.visible = sourceTargetLayout;
    this.settings.physicsAndLayoutSettings.roleSpread.visible = sourceTargetLayout;
    this.settings.physicsAndLayoutSettings.roleForceStrength.visible = sourceTargetLayout;
    this.settings.physicsAndLayoutSettings.fitPadding.visible =
      this.settings.physicsAndLayoutSettings.autoCenter.value || this.settings.physicsAndLayoutSettings.fitOnLoad.value;
    this.settings.mapCanvasSettings.showUploadControl.visible = mapCanvasLayout;
    this.settings.mapCanvasSettings.imageSource.visible = mapCanvasLayout;
    this.settings.mapCanvasSettings.imageFit.visible = mapCanvasLayout;
    this.settings.mapCanvasSettings.horizontalAlign.visible = mapCanvasLayout;
    this.settings.mapCanvasSettings.verticalAlign.visible = mapCanvasLayout;
    this.settings.mapCanvasSettings.imageOpacity.visible = mapCanvasLayout;
    this.settings.mapCanvasSettings.dimOverlayOpacity.visible = mapCanvasLayout;
    const mapTargetLayoutPreset = this.getMapTargetLayoutPreset();
    this.settings.mapCanvasSettings.targetLayoutPreset.visible = mapCanvasLayout;
    if (this.settings.mapCanvasSettings.targetOrbitRadius) {
      this.settings.mapCanvasSettings.targetOrbitRadius.visible = mapCanvasLayout && mapTargetLayoutPreset !== 'rail';
    }
    this.settings.mapCanvasSettings.targetRailPosition.visible = mapCanvasLayout && mapTargetLayoutPreset === 'rail';
    this.settings.mapCanvasSettings.persistedSourcePositions.visible = mapCanvasLayout;
    this.settings.mapCanvasSettings.resetPositions.visible = mapCanvasLayout;
    this.settings.measureBadgeSettings.badgeMeasureName.visible = this.settings.measureBadgeSettings.showBadges.value;
    this.settings.measureBadgeSettings.badgeDisplayMode.visible = this.settings.measureBadgeSettings.showBadges.value;
    this.settings.measureBadgeSettings.badgeFontSize.visible = this.settings.measureBadgeSettings.showBadges.value;
    this.settings.measureBadgeSettings.badgeColor.visible = this.settings.measureBadgeSettings.showBadges.value;
    this.settings.measureBadgeSettings.badgeBackgroundColor.visible = this.settings.measureBadgeSettings.showBadges.value;
    this.settings.measureBadgeSettings.badgeBackgroundOpacity.visible = this.settings.measureBadgeSettings.showBadges.value;
    this.settings.measureBadgeSettings.badgeOffset.visible = this.settings.measureBadgeSettings.showBadges.value;
    const inspectorEnabled = this.settings.nodeInspectorSettings.enabled.value;
    this.settings.nodeInspectorSettings.position.visible = inspectorEnabled;
    this.settings.nodeInspectorSettings.showCoreMetrics.visible = inspectorEnabled;
    this.settings.nodeInspectorSettings.showDetailMeasures.visible = inspectorEnabled;
    this.settings.nodeInspectorSettings.showDetailColumns.visible = inspectorEnabled;
    this.settings.nodeInspectorSettings.maxDetailValues.visible = inspectorEnabled && this.settings.nodeInspectorSettings.showDetailColumns.value;
    this.settings.nodeInspectorSettings.focusOnClick.visible = inspectorEnabled;
    this.settings.nodeInspectorSettings.focusZoomScale.visible = inspectorEnabled && this.settings.nodeInspectorSettings.focusOnClick.value;

    const colorByNodeRole = this.settings.colorsAndThemeSettings.colorByNodeRole.value;
    this.settings.colorsAndThemeSettings.sourceNodeColor.visible = colorByNodeRole;
    this.settings.colorsAndThemeSettings.targetNodeColor.visible = colorByNodeRole;
    this.settings.colorsAndThemeSettings.bothRoleNodeColor.visible = colorByNodeRole;
    this.settings.colorsAndThemeSettings.useChartPalette.visible = !colorByNodeRole;

    const enableClustering = this.settings.colorsAndThemeSettings.enableClustering.value;
    const canShowLegend = enableClustering || colorByNodeRole;
    this.settings.legendFormattingCard.showLegend.visible = canShowLegend;
    this.settings.legendFormattingCard.legendPosition.visible = canShowLegend;
    this.settings.legendFormattingCard.legendFontSize.visible = canShowLegend;
    this.settings.legendFormattingCard.legendFontColor.visible = canShowLegend;
    this.settings.legendFormattingCard.legendFontFamily.visible = canShowLegend;
    this.settings.legendFormattingCard.legendFontWeight.visible = canShowLegend;
    this.settings.legendFormattingCard.legendAliases.visible = canShowLegend;
    this.settings.legendFormattingCard.showInlineLabels.visible = enableClustering;
    this.settings.legendFormattingCard.inlineLabelFontSize.visible = enableClustering;
    this.settings.legendFormattingCard.inlineLabelOffset.visible = enableClustering;

    // Extract data
    const rawData = this.extractData(dataView);
    this.currentData = rawData;
    this.currentViewport = options.viewport;
    const data = this.getLinkedInteractionData(rawData);

    // Render
    this.render(data, options.viewport);
  }

  // ── Data Extraction ──────────────────────────────────────────

  private extractData(dataView: DataView | undefined): NetworkData | null {
    if (!dataView?.categorical) return null;

    const categorical = dataView.categorical;
    const categories = categorical.categories;

    if (!categories || categories.length < 2) return null;

    // Find source and target columns by role
    let sourceColumn: powerbi.DataViewCategoryColumn | undefined;
    const targetColumns: powerbi.DataViewCategoryColumn[] = [];
    let imageUrlColumn: powerbi.DataViewCategoryColumn | undefined;
    let weightColumn: powerbi.DataViewValueColumn | undefined;
    const detailFieldColumns: powerbi.DataViewCategoryColumn[] = [];
    const detailMeasureColumns: powerbi.DataViewValueColumn[] = [];

    for (const cat of categories) {
      const roles = cat.source.roles;
      if (!roles) continue;
      if (roles['source']) sourceColumn = cat;
      if (roles['target']) targetColumns.push(cat);
      if (roles['imageUrl']) imageUrlColumn = cat;
      if (roles['nodeDetail']) detailFieldColumns.push(cat);
    }

    // Weight is optional
    const values = categorical.values;
    if (values) {
      for (const val of values) {
        const roles = val.source.roles;
        if (!roles) continue;
        if (roles['weight']) weightColumn = val;
        if (roles['detailMeasure']) detailMeasureColumns.push(val);
      }
    }

    if (!sourceColumn || targetColumns.length === 0) return null;

    const rowCount = sourceColumn.values.length;
    if (rowCount === 0) return null;

    const sourceLabel = sourceColumn.source.displayName || 'Source';
    const targetLabel = targetColumns.length === 1
      ? targetColumns[0].source.displayName || 'Target'
      : 'Target';
    const weightLabel = weightColumn?.source.displayName || 'Weight';
    const detailFieldLabels = detailFieldColumns.map((column) => column.source.displayName || 'Detail');
    const detailMeasureLabels = detailMeasureColumns.map((column) => column.source.displayName || 'Measure');
    const backgroundImageSource = this.getFirstTextValue(imageUrlColumn?.values);
    const repeatTargetsPerSource = this.getLayoutMode() === 'mapCanvas';

    // Build unique node list and assign groups
    const nodeMap = new Map<string, GraphNode>();
    const nodes: GraphNode[] = [];
    let groupCounter = 0;

    // Read cross-highlight data from weight column (or first value column)
    const highlightSourceCol = weightColumn ?? (values ? values[0] : undefined);
    const rowHighlights = highlightSourceCol
      ? (highlightSourceCol.highlights as unknown[] | undefined)
      : undefined;

    const getOrCreateNode = (
      id: string,
      displayLabel: string,
      selectionId: ISelectionId,
      isHighlighted: boolean,
      role: Exclude<NodeRole, 'both'>,
    ): GraphNode => {
      const existing = nodeMap.get(id);
      if (existing) {
        // If already created, upgrade highlighted status if this row is highlighted
        if (isHighlighted) existing.highlighted = true;
        if (existing.role !== role) existing.role = 'both';
        return existing;
      }
      const group = groupCounter++;
      const node: GraphNode = {
        id,
        displayLabel,
        group,
        role,
        highlighted: isHighlighted,
        selectionId,
        detailValues: {},
        detailFields: {},
      };
      nodeMap.set(id, node);
      nodes.push(node);
      return node;
    };

    // Build links
    const links: GraphLink[] = [];

    const dateConfig: DateFilterConfig = {
      enabled: this.settings.dateFilterFormattingCard.enableDateFilter.value,
      startDate: this.settings.dateFilterFormattingCard.startDate.value,
      endAtCurrentDate: this.settings.dateFilterFormattingCard.endAtCurrentDate.value,
      endDate: this.settings.dateFilterFormattingCard.endDate.value,
    };
    const dateIndices = isDateColumn(sourceColumn.source) ? getDateFilterIndices(sourceColumn.values, dateConfig) : null;

    for (let i = 0; i < rowCount; i++) {
      if (dateIndices && !dateIndices.has(i)) continue;

      const sourceVal = sourceColumn.values[i];

      if (sourceVal == null) continue;

      const sourceName = String(sourceVal);
      const sourceNodeId = sourceName;
      const sourceSelectionId = this.host.createSelectionIdBuilder()
        .withCategory(sourceColumn, i)
        .createSelectionId();
      const rowHighlighted = rowHighlights ? rowHighlights[i] !== null : false;
      const sourceNode = getOrCreateNode(sourceNodeId, sourceName, sourceSelectionId, rowHighlighted, 'source');

      // Weight defaults to 1 when not provided
      let weight = 1;
      if (weightColumn) {
        const weightVal = weightColumn.values[i];
        if (weightVal != null) {
          const parsed = typeof weightVal === 'number' ? weightVal : Number(weightVal);
          if (Number.isFinite(parsed) && parsed > 0) {
            weight = parsed;
          }
        }
      }

      const rowDetailValues: Record<string, number> = {};
      detailMeasureColumns.forEach((detailColumn, detailIndex) => {
        const rawDetailValue = detailColumn.values[i];
        const parsed = rawDetailValue == null
          ? 0
          : typeof rawDetailValue === 'number'
            ? rawDetailValue
            : Number(rawDetailValue);
        if (!Number.isFinite(parsed)) return;
        const label = detailMeasureLabels[detailIndex] || `Measure ${detailIndex + 1}`;
        rowDetailValues[label] = parsed;
        sourceNode.detailValues[label] = (sourceNode.detailValues[label] ?? 0) + parsed;
      });

      const rowDetailFields: Array<{ label: string; text: string }> = [];
      detailFieldColumns.forEach((detailColumn, detailIndex) => {
        const rawDetailValue = detailColumn.values[i];
        if (rawDetailValue == null) return;
        const text = String(rawDetailValue).trim();
        if (text.length === 0) return;
        const label = detailFieldLabels[detailIndex] || `Detail ${detailIndex + 1}`;
        this.addNodeDetailFieldValue(sourceNode, label, text);
        rowDetailFields.push({ label, text });
      });

      for (const targetColumn of targetColumns) {
        const targetVal = targetColumn.values[i];
        if (targetVal == null) continue;

        const targetName = String(targetVal).trim();
        if (targetName.length === 0 || sourceName === targetName) continue;
        const targetNodeId = repeatTargetsPerSource
          ? `${sourceName}::${targetName}`
          : targetName;

        const targetSelectionBuilder = this.host.createSelectionIdBuilder();
        if (repeatTargetsPerSource) {
          targetSelectionBuilder.withCategory(sourceColumn, i);
        }
        const targetSelectionId = targetSelectionBuilder
          .withCategory(targetColumn, i)
          .createSelectionId();

        const targetNode = getOrCreateNode(targetNodeId, targetName, targetSelectionId, rowHighlighted, 'target');
        for (const [label, value] of Object.entries(rowDetailValues)) {
          targetNode.detailValues[label] = (targetNode.detailValues[label] ?? 0) + value;
        }
        for (const detailField of rowDetailFields) {
          this.addNodeDetailFieldValue(targetNode, detailField.label, detailField.text);
        }

        links.push({
          source: sourceNodeId,
          target: targetNodeId,
          sourceLabel: sourceName,
          targetLabel: targetName,
          weight,
          detailValues: { ...rowDetailValues },
        });
      }
    }

    if (nodes.length === 0) return null;

    for (const node of nodes) {
      for (const label of detailMeasureLabels) {
        if (!Number.isFinite(node.detailValues[label])) {
          node.detailValues[label] = 0;
        }
      }
    }
    for (const link of links) {
      for (const label of detailMeasureLabels) {
        if (!Number.isFinite(link.detailValues[label])) {
          link.detailValues[label] = 0;
        }
      }
    }

    const hasHighlights = nodes.some(n => n.highlighted);

    return {
      nodes,
      links,
      hasHighlights,
      sourceLabel,
      targetLabel,
      weightLabel,
      backgroundImageSource,
      detailMeasureLabels,
      detailFieldLabels,
    };
  }

  // ── Rendering ────────────────────────────────────────────────

  private render(data: NetworkData | null, viewport: powerbi.IViewport): void {
    const themeName = resolveColorTheme(this.settings.colorThemeFormattingCard);
    // Clear previous content
    this.container.removeEventListener('click', this.handleBackgroundClick);
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    renderChartTitle(this.container, this.settings.titleFormattingCard);
    this.svg = null;

    const s = this.settings;

    // Apply card style
    const cardMode = (resolveDropdown(s.cardSettings.cardStyleMode) ?? 'glass') as CardStyleMode;
    applyCardStyle(
      this.container,
      {
        mode: cardMode,
        opacity: s.cardSettings.backgroundOpacity.value / 100,
        backgroundColor: s.cardSettings.backgroundColor.value?.value,
        borderRadius: s.cardSettings.borderRadius.value,
      },
    );
    const contentPadding = Math.max(0, s.cardSettings.contentPadding.value);
    this.container.style.boxSizing = 'border-box';
    this.container.style.padding = `${contentPadding}px`;
    if (cardMode === 'none') {
      this.container.style.borderRadius = `${s.cardSettings.borderRadius.value}px`;
    }

    // Handle empty/null data
    if (!data) {
      this.renderEmptyState();
      return;
    }

    // Search/detail controls for filtering/highlighting nodes
    if (s.interactionSettings.enableSearch.value || this.hasDetailFilters(data)) {
      this.renderSearchInput(data);
    } else {
      this.searchOpen = false;
      this.searchQuery = '';
      this.detailFilterOpen = false;
      this.resetDetailFilters();
    }
    this.renderMapImageUploadControls(data);

    const width = Math.max(0, viewport.width - (contentPadding * 2));
    const height = Math.max(0, viewport.height - (contentPadding * 2));
    const innerWidth = width - MARGIN.left - MARGIN.right;
    const innerHeight = height - MARGIN.top - MARGIN.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) return;

    // Create SVG
    const svg = d3.select(this.container)
      .append('svg')
      .attr('class', 'network-svg')
      .attr('width', width)
      .attr('height', height);

    this.svg = svg;

    // Arrow marker definition for directed links
    const resolvedArrowColor = s.linkSettings.linkColor.value?.value || DEFAULT_LINK_COLOR;
    if (s.linkSettings.showArrows.value) {
      const defs = svg.append('defs');
      defs.append('marker')
        .attr('id', 'network-arrowhead')
        .attr('viewBox', `0 0 ${ARROW_SIZE} ${ARROW_SIZE}`)
        .attr('refX', ARROW_SIZE)
        .attr('refY', ARROW_SIZE / 2)
        .attr('markerWidth', ARROW_SIZE)
        .attr('markerHeight', ARROW_SIZE)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', `M0,0 L${ARROW_SIZE},${ARROW_SIZE / 2} L0,${ARROW_SIZE} Z`)
        .attr('fill', resolvedArrowColor);
    }

    // ── Glow filter for node hover effect ────────────────────────
    const glowDefs = svg.select('defs').size() > 0
      ? svg.select<SVGDefsElement>('defs')
      : svg.append('defs');
    const glowFilter = glowDefs.append('filter')
      .attr('id', 'node-glow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%');
    glowFilter.append('feGaussianBlur')
      .attr('in', 'SourceGraphic')
      .attr('stdDeviation', '3')
      .attr('result', 'blur');
    const glowMerge = glowFilter.append('feMerge');
    glowMerge.append('feMergeNode').attr('in', 'blur');
    glowMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    const g = svg.append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    const centerX = innerWidth / 2;
    const centerY = innerHeight / 2;

    // Deep-copy nodes and links for simulation (d3 mutates them)
    const simNodes: GraphNode[] = data.nodes.map((n) => ({
      ...n,
      detailValues: { ...n.detailValues },
      detailFields: this.cloneDetailFields(n.detailFields),
    }));
    const simLinks: GraphLink[] = data.links.map((l) => ({
      source: l.source,
      target: l.target,
      sourceLabel: l.sourceLabel,
      targetLabel: l.targetLabel,
      weight: l.weight,
      detailValues: { ...l.detailValues },
    }));

    // Compute max weight for link width scaling
    const maxWeight = Math.max(1, ...simLinks.map((l) => l.weight));

    // Compute degree (number of connections) per node for size-by-degree
    const degreeMap = new Map<string, number>();
    for (const link of simLinks) {
      const srcId = typeof link.source === 'string' ? link.source : (link.source as GraphNode).id;
      const tgtId = typeof link.target === 'string' ? link.target : (link.target as GraphNode).id;
      degreeMap.set(srcId, (degreeMap.get(srcId) ?? 0) + 1);
      degreeMap.set(tgtId, (degreeMap.get(tgtId) ?? 0) + 1);
    }
    const maxDegree = Math.max(1, ...Array.from(degreeMap.values()));
    const totalWeightMap = new Map<string, number>();
    for (const link of simLinks) {
      const srcId = typeof link.source === 'string' ? link.source : (link.source as GraphNode).id;
      const tgtId = typeof link.target === 'string' ? link.target : (link.target as GraphNode).id;
      totalWeightMap.set(srcId, (totalWeightMap.get(srcId) ?? 0) + link.weight);
      totalWeightMap.set(tgtId, (totalWeightMap.get(tgtId) ?? 0) + link.weight);
    }
    const targetLikeNodes = simNodes.filter((node) => node.role === 'target' || node.role === 'both');
    const maxTargetDegree = Math.max(1, ...targetLikeNodes.map((node) => degreeMap.get(node.id) ?? 0));
    const maxTargetWeight = Math.max(1, ...targetLikeNodes.map((node) => totalWeightMap.get(node.id) ?? 0));

    // Cluster detection: simple label propagation
    const clusterMap = new Map<string, number>();
    if (s.colorsAndThemeSettings.enableClustering.value) {
      // Initialize each node as its own cluster
      simNodes.forEach((n, i) => clusterMap.set(n.id, i));

      // Build adjacency for clustering
      const clusterAdj = new Map<string, string[]>();
      for (const link of simLinks) {
        const srcId = typeof link.source === 'string' ? link.source : (link.source as GraphNode).id;
        const tgtId = typeof link.target === 'string' ? link.target : (link.target as GraphNode).id;
        if (!clusterAdj.has(srcId)) clusterAdj.set(srcId, []);
        if (!clusterAdj.has(tgtId)) clusterAdj.set(tgtId, []);
        clusterAdj.get(srcId)!.push(tgtId);
        clusterAdj.get(tgtId)!.push(srcId);
      }

      // Run label propagation for a few iterations
      for (let iter = 0; iter < 10; iter++) {
        let changed = false;
        for (const node of simNodes) {
          const neighbors = clusterAdj.get(node.id) ?? [];
          if (neighbors.length === 0) continue;
          // Find most common cluster among neighbors
          const freq = new Map<number, number>();
          for (const nbr of neighbors) {
            const c = clusterMap.get(nbr) ?? 0;
            freq.set(c, (freq.get(c) ?? 0) + 1);
          }
          let bestCluster = clusterMap.get(node.id) ?? 0;
          let bestCount = 0;
          for (const [c, count] of freq) {
            if (count > bestCount) {
              bestCount = count;
              bestCluster = c;
            }
          }
          if (bestCluster !== clusterMap.get(node.id)) {
            clusterMap.set(node.id, bestCluster);
            changed = true;
          }
        }
        if (!changed) break;
      }
    }

    const mapBackgroundLayer = g.append('g').attr('class', 'network-map-background');
    this.renderMapBackground(mapBackgroundLayer, data, innerWidth, innerHeight);

    // Create link elements
    const linkGroup = g.append('g').attr('class', 'network-links');
    const linkOpacity = Math.max(0, Math.min(1, s.linkSettings.opacity.value / 100));

    const resolvedLinkColor = s.linkSettings.linkColor.value?.value || DEFAULT_LINK_COLOR;
    const resolvedLinkWidth = Math.max(0.5, s.linkSettings.linkWidth.value);

    // Link width by weight feature (now in merged linkSettings)
    const widthByWeight = s.linkSettings.widthByWeight.value;
    const linkMinWidth = Math.max(0.5, s.linkSettings.minWidth.value);
    const linkMaxWidth = Math.max(linkMinWidth, s.linkSettings.maxWidth.value);

    const edgeBundling = s.physicsAndLayoutSettings.edgeBundling.value;

    const getLinkWidth = (d: GraphLink): number => {
      if (widthByWeight) {
        const normalized = d.weight / maxWeight;
        return linkMinWidth + normalized * (linkMaxWidth - linkMinWidth);
      }
      return resolvedLinkWidth;
    };

    // When edge bundling is enabled, use <path> elements with curved lines;
    // otherwise use straight <line> elements.
    let linkElements: d3.Selection<SVGLineElement, GraphLink, SVGGElement, unknown>;
    let bundledLinkElements: d3.Selection<SVGPathElement, GraphLink, SVGGElement, unknown> | null = null;

    if (edgeBundling) {
      bundledLinkElements = linkGroup.selectAll<SVGPathElement, GraphLink>('.network-link')
        .data(simLinks)
        .join('path')
        .attr('class', 'network-link')
        .attr('data-source', (d) => String(typeof d.source === 'string' ? d.source : (d.source as GraphNode).id))
        .attr('data-target', (d) => String(typeof d.target === 'string' ? d.target : (d.target as GraphNode).id))
        .attr('stroke', resolvedLinkColor)
        .attr('stroke-opacity', linkOpacity)
        .attr('stroke-width', (d) => getLinkWidth(d))
        .attr('stroke-linecap', 'round')
        .attr('stroke-linejoin', 'round')
        .attr('vector-effect', 'non-scaling-stroke')
        .attr('fill', 'none')
        .style('transition', 'opacity 0.15s ease, filter 0.15s ease');

      if (s.linkSettings.showArrows.value) {
        bundledLinkElements.attr('marker-end', 'url(#network-arrowhead)');
      }

      // Create a dummy line selection for type compatibility (empty)
      linkElements = linkGroup.selectAll<SVGLineElement, GraphLink>('.network-link-dummy')
        .data([] as GraphLink[])
        .join('line');
    } else {
      linkElements = linkGroup.selectAll<SVGLineElement, GraphLink>('.network-link')
        .data(simLinks)
        .join('line')
        .attr('class', 'network-link')
        .attr('data-source', (d) => String(typeof d.source === 'string' ? d.source : (d.source as GraphNode).id))
        .attr('data-target', (d) => String(typeof d.target === 'string' ? d.target : (d.target as GraphNode).id))
        .attr('stroke', resolvedLinkColor)
        .attr('stroke-opacity', linkOpacity)
        .attr('stroke-width', (d) => getLinkWidth(d))
        .attr('stroke-linecap', 'round')
        .attr('vector-effect', 'non-scaling-stroke')
        .style('transition', 'opacity 0.15s ease, filter 0.15s ease');

      if (s.linkSettings.showArrows.value) {
        linkElements.attr('marker-end', 'url(#network-arrowhead)');
      }
    }

    // Unified reference for all link elements (for hover/animation/conditional)
    const allLinkElements = (edgeBundling ? bundledLinkElements! : linkElements) as unknown as d3.Selection<SVGElement, GraphLink, SVGGElement, unknown>;

    // Apply conditional formatting to links
    allLinkElements.each((d: GraphLink, i: number, elements: ArrayLike<SVGElement>) => {
      const condColor = this.getConditionalColor(d.weight);
      const element = elements[i];
      if (condColor && element) {
        d3.select(element).attr('stroke', condColor);
      }
    });

    allLinkElements
      .on('mouseover', (event: MouseEvent, d: GraphLink) => {
        const tooltipItems: VisualTooltipDataItem[] = [
          { displayName: data.sourceLabel, value: d.sourceLabel || this.getNodeDisplayLabel(d.source) },
          { displayName: data.targetLabel, value: d.targetLabel || this.getNodeDisplayLabel(d.target) },
          { displayName: data.weightLabel, value: formatWithSettings(d.weight, this.settings.numberFormattingCard) },
        ];
        for (const label of data.detailMeasureLabels) {
          const detailValue = d.detailValues[label];
          if (Number.isFinite(detailValue)) {
            tooltipItems.push({
              displayName: label,
              value: formatWithSettings(detailValue, this.settings.numberFormattingCard),
            });
          }
        }
        this.host.tooltipService.show({
          dataItems: tooltipItems,
          identities: [],
          coordinates: [event.clientX, event.clientY],
          isTouchEvent: false,
        });
      })
      .on('mousemove', (event: MouseEvent) => {
        this.host.tooltipService.move({
          dataItems: [],
          identities: [],
          coordinates: [event.clientX, event.clientY],
          isTouchEvent: false,
        });
      })
      .on('mouseout', () => {
        this.host.tooltipService.hide({ immediately: true, isTouchEvent: false });
      });

    const showWeightLabels = s.linkSettings.showWeightLabels.value;
    const minWeightLabel = Math.max(0, s.linkSettings.minWeightLabel.value);
    const weightLabelFontSize = Math.max(6, s.linkSettings.weightLabelFontSize.value);
    const weightLabelFill = s.linkSettings.weightLabelFontColor.value?.value || '#0F172A';
    const weightLabelBackground = s.linkSettings.weightLabelBackgroundColor.value?.value || '#ffffff';
    const weightLabelBackgroundOpacity = Math.max(0, Math.min(1, s.linkSettings.weightLabelBackgroundOpacity.value / 100));
    const labelableLinks = showWeightLabels
      ? simLinks.filter((link) => link.weight >= minWeightLabel)
      : [];
    const linkLabelLayer = g.append('g').attr('class', 'network-link-labels');
    const linkLabelGroups = linkLabelLayer.selectAll<SVGGElement, GraphLink>('.network-link-label')
      .data(labelableLinks)
      .join('g')
      .attr('class', 'network-link-label')
      .attr('data-source', (d) => this.getNodeId(d.source))
      .attr('data-target', (d) => this.getNodeId(d.target))
      .style('pointer-events', 'none');

    linkLabelGroups.append('rect')
      .attr('class', 'network-link-label-bg')
      .attr('rx', 5)
      .attr('ry', 5)
      .attr('fill', weightLabelBackground)
      .attr('fill-opacity', weightLabelBackgroundOpacity);

    linkLabelGroups.append('text')
      .attr('class', 'network-link-label-text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .style('font-size', `${weightLabelFontSize}px`)
      .style('font-weight', '600')
      .style('font-family', "'Segoe UI', sans-serif")
      .style('fill', weightLabelFill)
      .text((d) => formatWithSettings(d.weight, this.settings.numberFormattingCard));

    // Create node elements
    const rawNodeRadius = Number(s.nodeSettings.radius.value);
    const nodeRadius = this.clamp(Number.isFinite(rawNodeRadius) ? rawNodeRadius : 8, 1, 120);
    const rawMinDegreeRadius = Number(s.nodeSettings.minRadius.value);
    const minDegreeRadius = this.clamp(
      Number.isFinite(rawMinDegreeRadius) ? rawMinDegreeRadius : nodeRadius * 0.5,
      1,
      120,
    );
    const rawMaxDegreeRadius = Number(s.nodeSettings.maxRadius.value);
    const maxDegreeRadius = Math.max(
      minDegreeRadius,
      this.clamp(Number.isFinite(rawMaxDegreeRadius) ? rawMaxDegreeRadius : nodeRadius * 2.5, 1, 160),
    );
    const usePalette = s.colorsAndThemeSettings.useChartPalette.value;
    const sizeByDegree = s.nodeSettings.sizeByDegree.value;
    const targetNodeSizeMode = this.getTargetSizeMode();
    const enableClustering = s.colorsAndThemeSettings.enableClustering.value;
    const nodeGroup = g.append('g').attr('class', 'network-nodes');

    const getNodeRadius = (d: GraphNode): number => {
      if ((d.role === 'target' || d.role === 'both') && targetNodeSizeMode !== 'fixed') {
        const value = targetNodeSizeMode === 'weight'
          ? totalWeightMap.get(d.id) ?? 0
          : degreeMap.get(d.id) ?? 0;
        const maxValue = targetNodeSizeMode === 'weight' ? maxTargetWeight : maxTargetDegree;
        return this.getScaledRadius(value, maxValue, minDegreeRadius, maxDegreeRadius);
      }
      if (targetNodeSizeMode === 'fixed' && sizeByDegree) {
        return this.getScaledRadius(degreeMap.get(d.id) ?? 1, maxDegree, minDegreeRadius, maxDegreeRadius);
      }
      return nodeRadius;
    };

    const getNodeColor = (d: GraphNode, i: number): string => {
      if (s.colorsAndThemeSettings.colorByNodeRole.value) {
        switch (d.role) {
          case 'source':
            return s.colorsAndThemeSettings.sourceNodeColor.value?.value || '#2563EB';
          case 'target':
            return s.colorsAndThemeSettings.targetNodeColor.value?.value || '#DC2626';
          case 'both':
          default:
            return s.colorsAndThemeSettings.bothRoleNodeColor.value?.value || '#D97706';
        }
      }
      if (enableClustering) {
        const cluster = clusterMap.get(d.id) ?? 0;
        return usePalette
          ? getHostChartColor(this.host.colorPalette, cluster, themeName)
          : getChartColor(cluster, themeName);
      }
      return usePalette
        ? getHostChartColor(this.host.colorPalette, i, themeName)
        : getChartColor(i, themeName);
    };

    let focusNodeOnClick: ((node: GraphNode) => void) | null = null;

    const nodeElements = nodeGroup.selectAll<SVGCircleElement, GraphNode>('.network-node')
      .data(simNodes)
      .join('circle')
      .attr('class', 'network-node')
      .attr('data-node', (d) => d.id)
      .attr('data-label', (d) => d.displayLabel)
      .attr('data-role', (d) => d.role)
      .attr('data-selection-key', (d) => d.selectionId.getKey())
      .attr('r', (d) => getNodeRadius(d))
      .attr('fill', (d, i) => getNodeColor(d, i))
      .attr('stroke', s.nodeSettings.nodeBorderColor.value?.value || '#ffffff')
      .attr('stroke-width', s.nodeSettings.nodeBorderWidth.value)
      .style('cursor', 'pointer')
      .style('transition', 'opacity 0.15s ease, filter 0.15s ease, transform 0.15s ease')
      .on('click', (event: MouseEvent, d) => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        this.renderNodeInspector(d, data, degreeMap, totalWeightMap);
        focusNodeOnClick?.(d);
        void this.selectionManager.select(d.selectionId, event.ctrlKey || event.metaKey).then(() => {
          if (this.hasActiveInteractiveFilter()) {
            this.applyInteractiveFilters(data);
            return;
          }
          this.applyCrossHighlight();
        });
      })
      .on('contextmenu', (event: MouseEvent, d) => {
        event.preventDefault();
        event.stopPropagation();
        void this.selectionManager.showContextMenu(d.selectionId, {
          x: event.clientX,
          y: event.clientY,
        });
      });

    nodeElements
      .on('mouseenter.labelVisibility', (_event, d) => {
        this.hoveredNodeId = d.id;
        this.applyLabelVisibility();
      })
      .on('mouseleave.labelVisibility', () => {
        this.hoveredNodeId = null;
        this.applyLabelVisibility();
      });

    // Node tooltips via tooltipService
    const tooltipHost = this.host;
    nodeElements
      .on('mouseover', (event: MouseEvent, d: GraphNode) => {
        const degree = degreeMap.get(d.id) ?? 0;
        const totalWeight = totalWeightMap.get(d.id) ?? 0;
        const tooltipItems: VisualTooltipDataItem[] = [
          { displayName: 'Node', value: d.displayLabel },
          { displayName: 'Connections', value: formatWithSettings(degree, this.settings.numberFormattingCard) },
          { displayName: `Total ${data.weightLabel}`, value: formatWithSettings(totalWeight, this.settings.numberFormattingCard) },
        ];
        for (const label of data.detailMeasureLabels) {
          const detailValue = d.detailValues[label];
          if (Number.isFinite(detailValue)) {
            tooltipItems.push({
              displayName: label,
              value: formatWithSettings(detailValue, this.settings.numberFormattingCard),
            });
          }
        }
        tooltipHost.tooltipService.show({
          dataItems: tooltipItems,
          identities: [],
          coordinates: [event.clientX, event.clientY],
          isTouchEvent: false,
        });
      })
      .on('mousemove', (event: MouseEvent) => {
        tooltipHost.tooltipService.move({
          dataItems: [],
          identities: [],
          coordinates: [event.clientX, event.clientY],
          isTouchEvent: false,
        });
      })
      .on('mouseout', () => {
        tooltipHost.tooltipService.hide({ immediately: true, isTouchEvent: false });
      });

    // Cross-highlight dimming: dim non-highlighted nodes and links
    if (data.hasHighlights && this.getCrossHighlightMode() === 'dim') {
      const highlightedNodeIds = new Set<string>();
      for (const node of simNodes) {
        if (node.highlighted) highlightedNodeIds.add(node.id);
      }

      nodeElements.style('opacity', (d) => d.highlighted ? '1' : '0.3');

      allLinkElements.style('opacity', (d) => {
        const srcId = typeof d.source === 'string' ? d.source : (d.source as GraphNode).id;
        const tgtId = typeof d.target === 'string' ? d.target : (d.target as GraphNode).id;
        return (highlightedNodeIds.has(srcId) || highlightedNodeIds.has(tgtId)) ? '' : '0.3';
      });

      linkLabelGroups.style('opacity', (d) => {
        const srcId = this.getNodeId(d.source);
        const tgtId = this.getNodeId(d.target);
        return (highlightedNodeIds.has(srcId) || highlightedNodeIds.has(tgtId)) ? '' : '0.3';
      });
    }

    // Create label elements
    let labelElements: d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown> | null = null;
    if (s.nodeSettings.showLabels.value) {
      const labelGroup = g.append('g').attr('class', 'network-labels');
      const nodeFontColor = s.nodeSettings.fontColor.value?.value;
      const nodeFontFamily = resolveDropdown(s.nodeSettings.fontFamily);
      const nodeFontWeight = resolveDropdown(s.nodeSettings.fontWeight);
      const labelPosition = this.getNodeLabelPosition();
      const labelOffset = Math.max(0, s.nodeSettings.labelOffset.value);
      const maxLabelCharacters = Math.max(4, Math.round(s.nodeSettings.maxLabelCharacters.value));
      const sharedLabelFontFamily = resolveDropdown(s.dataLabelFormattingCard.dataLabelFontFamily) || undefined;
      const sharedLabelFontWeight = resolveDropdown(s.dataLabelFormattingCard.dataLabelFontWeight) || undefined;
      labelElements = labelGroup.selectAll<SVGTextElement, GraphNode>('.network-label')
        .data(simNodes)
        .join('text')
        .attr('class', 'network-label')
        .attr('data-node', (d) => d.id)
        .attr('data-label', (d) => d.displayLabel)
        .attr('data-role', (d) => d.role)
        .attr('data-label-offset', `${labelOffset}`)
        .attr('text-anchor', this.getLabelTextAnchor(labelPosition))
        .attr('dominant-baseline', 'middle')
        .attr('dy', '0')
        .style('font-size', (d) => `${this.getNodeLabelFontSize(d)}px`)
        .style('pointer-events', 'none')
        .style('transition', 'opacity 0.15s ease')
        .text((d) => this.truncateLabel(d.displayLabel, maxLabelCharacters));
      // Apply shared data-label formatting first (sets color, size, weight, font via inline style).
      applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.network-label');

      // Node-specific overrides: only apply when the user has explicitly set a value.
      // Use .style() (not .attr()) so the inline style properly overrides applyDataLabelFormatting.
      labelElements.style('font-size', (d) => `${this.getNodeLabelFontSize(d)}px`);
      if (nodeFontColor) labelElements.style('fill', nodeFontColor);
      if (nodeFontFamily) labelElements.style('font-family', nodeFontFamily);
      if (nodeFontWeight && nodeFontWeight !== 'normal') {
        labelElements.style('font-weight', nodeFontWeight);
      } else if (sharedLabelFontWeight) {
        labelElements.style('font-weight', sharedLabelFontWeight);
      }
      if (sharedLabelFontFamily) labelElements.style('font-family', sharedLabelFontFamily);
      if (s.nodeSettings.labelHalo.value) {
        labelElements
          .attr('paint-order', 'stroke')
          .attr('stroke', s.nodeSettings.labelHaloColor.value?.value || '#ffffff')
          .attr('stroke-width', Math.max(0, s.nodeSettings.labelHaloWidth.value))
          .style('paint-order', 'stroke')
          .style('stroke', s.nodeSettings.labelHaloColor.value?.value || '#ffffff')
          .style('stroke-width', `${Math.max(0, s.nodeSettings.labelHaloWidth.value)}px`)
          .style('stroke-linejoin', 'round');
      } else {
        labelElements
          .attr('paint-order', null)
          .attr('stroke', 'none')
          .attr('stroke-width', 0)
          .style('paint-order', '')
          .style('stroke', 'none')
          .style('stroke-width', '0');
      }
    }

    const badgeMeasureLabel = this.getBadgeMeasureLabel(data);
    const badgeFontSize = Math.max(6, s.measureBadgeSettings.badgeFontSize.value);
    const badgeFill = s.measureBadgeSettings.badgeColor.value?.value || '#0F172A';
    const badgeBackgroundFill = s.measureBadgeSettings.badgeBackgroundColor.value?.value || '#FFFFFF';
    const badgeBackgroundOpacity = Math.max(0, Math.min(1, s.measureBadgeSettings.badgeBackgroundOpacity.value / 100));
    const badgeOffset = Math.max(0, s.measureBadgeSettings.badgeOffset.value);
    let measureBadgeGroups: d3.Selection<SVGGElement, GraphNode, SVGGElement, unknown> | null = null;
    if (s.measureBadgeSettings.showBadges.value && badgeMeasureLabel) {
      const badgeNodes = simNodes.filter((node) => node.role !== 'target' && Number.isFinite(node.detailValues[badgeMeasureLabel]));
      const badgeLayer = g.append('g').attr('class', 'network-measure-badges');
      measureBadgeGroups = badgeLayer.selectAll<SVGGElement, GraphNode>('.network-measure-badge')
        .data(badgeNodes)
        .join('g')
        .attr('class', 'network-measure-badge')
        .attr('data-node', (d) => d.id)
        .style('pointer-events', 'none');

      measureBadgeGroups.append('rect')
        .attr('class', 'network-measure-badge-bg')
        .attr('rx', 8)
        .attr('ry', 8)
        .attr('fill', badgeBackgroundFill)
        .attr('fill-opacity', badgeBackgroundOpacity);

      measureBadgeGroups.append('text')
        .attr('class', 'network-measure-badge-text')
        .attr('data-node', (d) => d.id)
        .attr('data-measure', badgeMeasureLabel)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .style('font-size', `${badgeFontSize}px`)
        .style('font-weight', '700')
        .style('font-family', "'Segoe UI', sans-serif")
        .style('fill', badgeFill)
        .text((d) => this.getBadgeText(badgeMeasureLabel, d.detailValues[badgeMeasureLabel]));
    }

    const layoutMode = this.getLayoutMode();
    const roleLayoutTargets = layoutMode === 'mapCanvas'
      ? this.createMapCanvasLayoutTargets(simNodes, simLinks, innerWidth, innerHeight, centerX, centerY)
      : layoutMode === 'sourceTarget'
        ? this.createSourceTargetLayoutTargets(simNodes, innerWidth, innerHeight, centerX, centerY)
        : new Map<string, { x: number; y: number }>();
    if (layoutMode === 'sourceTarget' || layoutMode === 'mapCanvas') {
      this.seedSourceTargetLayout(simNodes, roleLayoutTargets);
      if (layoutMode === 'mapCanvas') {
        this.lockMapCanvasLayout(simNodes, roleLayoutTargets);
      }
    }

    const linkDistance = Math.max(1, s.physicsAndLayoutSettings.linkDistance.value);
    const linkStrength = Math.max(0, Math.min(1, s.physicsAndLayoutSettings.strength.value));

    // Set up d3-force simulation
    const simulation = d3.forceSimulation<GraphNode>(simNodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(simLinks)
        .id((d) => d.id)
        .distance(linkDistance)
        .strength(linkStrength)
      )
      .force('charge', d3.forceManyBody<GraphNode>()
        .strength(s.physicsAndLayoutSettings.chargeStrength.value)
      )
      .force('center', d3.forceCenter<GraphNode>(centerX, centerY));

    if (layoutMode === 'sourceTarget' || layoutMode === 'mapCanvas') {
      const roleForceStrength = layoutMode === 'mapCanvas'
        ? 0.9
        : Math.max(0, Math.min(1, s.physicsAndLayoutSettings.roleForceStrength.value));
      simulation
        .force('roleX', d3.forceX<GraphNode>((d) => roleLayoutTargets.get(d.id)?.x ?? centerX).strength(roleForceStrength))
        .force('roleY', d3.forceY<GraphNode>((d) => roleLayoutTargets.get(d.id)?.y ?? centerY).strength(roleForceStrength * 0.85));
    }

    // Collision prevention (configurable)
    if (s.physicsAndLayoutSettings.enableCollision.value) {
      const collisionPadding = layoutMode === 'force' ? 2 : 10;
      simulation.force('collide', d3.forceCollide<GraphNode>((d) => getNodeRadius(d) + collisionPadding));
    }

    const updatePositions = (): void => {
      if (edgeBundling && bundledLinkElements) {
        // Edge bundling: route edges through curved paths bending toward center
        bundledLinkElements.attr('d', (d) => {
          const src = d.source as GraphNode;
          const tgt = d.target as GraphNode;
          const sx = src.x ?? 0;
          const sy = src.y ?? 0;
          const tx = tgt.x ?? 0;
          const ty = tgt.y ?? 0;
          // Control point: midpoint between the two nodes pulled toward center
          const mx = (sx + tx) / 2;
          const my = (sy + ty) / 2;
          const bundleFactor = 0.3; // How strongly to pull toward center
          const cx = mx + (centerX - mx) * bundleFactor;
          const cy = my + (centerY - my) * bundleFactor;
          return `M${sx},${sy} Q${cx},${cy} ${tx},${ty}`;
        });
      } else {
        linkElements
          .attr('x1', (d) => {
            const src = d.source as GraphNode;
            return src.x ?? 0;
          })
          .attr('y1', (d) => {
            const src = d.source as GraphNode;
            return src.y ?? 0;
          })
          .attr('x2', (d) => {
            const tgt = d.target as GraphNode;
            return tgt.x ?? 0;
          })
          .attr('y2', (d) => {
            const tgt = d.target as GraphNode;
            return tgt.y ?? 0;
        });
      }

      if (linkLabelGroups.size() > 0) {
        linkLabelGroups
          .attr('transform', (d) => {
            const point = this.getLinkLabelPoint(d, centerX, centerY, edgeBundling);
            return `translate(${point.x},${point.y})`;
          });

        linkLabelGroups.select<SVGRectElement>('rect.network-link-label-bg')
          .attr('x', (d) => {
            const text = formatWithSettings(d.weight, this.settings.numberFormattingCard);
            return -this.estimateTextWidth(text, weightLabelFontSize) / 2 - 4;
          })
          .attr('y', -((weightLabelFontSize + 6) / 2))
          .attr('width', (d) => {
            const text = formatWithSettings(d.weight, this.settings.numberFormattingCard);
            return this.estimateTextWidth(text, weightLabelFontSize) + 8;
          })
          .attr('height', weightLabelFontSize + 6);
      }

      nodeElements
        .attr('cx', (d) => d.x ?? 0)
        .attr('cy', (d) => d.y ?? 0);

      if (labelElements) {
        labelElements
          .attr('text-anchor', this.getLabelTextAnchor(this.getNodeLabelPosition()))
          .attr('x', (d) => this.getNodeLabelCoordinates(d, getNodeRadius(d)).x)
          .attr('y', (d) => this.getNodeLabelCoordinates(d, getNodeRadius(d)).y);
      }

      if (measureBadgeGroups && badgeMeasureLabel) {
        measureBadgeGroups
          .attr('transform', (d) => {
            const radius = getNodeRadius(d);
            const x = d.x ?? 0;
            const y = (d.y ?? 0) - radius - badgeOffset;
            return `translate(${x},${y})`;
          });

        measureBadgeGroups.select<SVGRectElement>('rect.network-measure-badge-bg')
          .attr('x', (d) => {
            const text = this.getBadgeText(badgeMeasureLabel, d.detailValues[badgeMeasureLabel]);
            return -this.estimateTextWidth(text, badgeFontSize) / 2 - 7;
          })
          .attr('y', -((badgeFontSize + 7) / 2))
          .attr('width', (d) => {
            const text = this.getBadgeText(badgeMeasureLabel, d.detailValues[badgeMeasureLabel]);
            return this.estimateTextWidth(text, badgeFontSize) + 14;
          })
          .attr('height', badgeFontSize + 7);
      }
    };

    this.simulation = simulation;
    this.settleInitialLayout(
      simulation,
      simNodes,
      innerWidth,
      innerHeight,
      centerX,
      centerY,
      getNodeRadius,
    );
    if (layoutMode === 'mapCanvas') {
      this.seedSourceTargetLayout(simNodes, roleLayoutTargets);
      this.lockMapCanvasLayout(simNodes, roleLayoutTargets);
    }
    updatePositions();

    // Keep the tick handler available for drag restarts, but start from a stable first frame.
    simulation.on('tick', updatePositions);

    // Drag behavior (configurable)
    if (s.interactionSettings.enableDrag.value) {
      const dragBehavior = d3.drag<SVGCircleElement, GraphNode>()
        .on('start', (event: d3.D3DragEvent<SVGCircleElement, GraphNode, GraphNode>, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event: d3.D3DragEvent<SVGCircleElement, GraphNode, GraphNode>, d) => {
          if (layoutMode === 'mapCanvas' && d.role === 'target') {
            const target = roleLayoutTargets.get(d.id);
            if (target) {
              d.fx = target.x;
              d.fy = target.y;
            }
            return;
          }
          d.fx = event.x;
          d.fy = event.y;
          if (layoutMode === 'mapCanvas' && d.role !== 'target') {
            d.x = event.x;
            d.y = event.y;
            roleLayoutTargets.set(d.id, { x: event.x, y: event.y });
            this.reflowMapCanvasTargetNodes(simNodes, simLinks, roleLayoutTargets, innerWidth, innerHeight);
            updatePositions();
          }
        })
        .on('end', (event: d3.D3DragEvent<SVGCircleElement, GraphNode, GraphNode>, d) => {
          if (!event.active) simulation.alphaTarget(0);
          if (layoutMode === 'mapCanvas' && d.role === 'target') {
            const target = roleLayoutTargets.get(d.id);
            if (target) {
              d.fx = target.x;
              d.fy = target.y;
            }
            return;
          }
          if (layoutMode === 'mapCanvas' && d.role !== 'target') {
            d.fx = event.x;
            d.fy = event.y;
            d.x = event.x;
            d.y = event.y;
            roleLayoutTargets.set(d.id, { x: event.x, y: event.y });
            this.reflowMapCanvasTargetNodes(simNodes, simLinks, roleLayoutTargets, innerWidth, innerHeight);
            updatePositions();
            this.persistSourceNodePosition(d.id, event.x, event.y, innerWidth, innerHeight);
            return;
          }
          if (s.interactionSettings.pinDraggedNodes.value) {
            d.fx = event.x;
            d.fy = event.y;
          } else {
            d.fx = null;
            d.fy = null;
          }
        });

      nodeElements.call(dragBehavior);
    }

    // ── Zoom & Pan ───────────────────────────────────────────────

    if (s.interactionSettings.enableZoom.value) {
      const minZoom = s.interactionSettings.minZoom.value;
      const maxZoom = s.interactionSettings.maxZoom.value;

	      const zoom = d3.zoom<SVGSVGElement, unknown>()
	        .scaleExtent([minZoom, maxZoom])
	        .extent([[0, 0], [width, height]])
	        .wheelDelta((event: WheelEvent) => this.getZoomWheelDelta(event))
        .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
          g.attr('transform', `translate(${MARGIN.left},${MARGIN.top}) ${event.transform.toString()}`);
          this.currentZoomScale = event.transform.k;
          this.applyLabelVisibility();
        });

      svg.call(zoom);
      focusNodeOnClick = (node: GraphNode) => {
        if (!this.settings.nodeInspectorSettings.enabled.value || !this.settings.nodeInspectorSettings.focusOnClick.value) return;
        const scale = this.clamp(this.settings.nodeInspectorSettings.focusZoomScale.value, minZoom, maxZoom);
        const nodeX = node.x ?? centerX;
        const nodeY = node.y ?? centerY;
        const transform = d3.zoomIdentity
          .translate(centerX - nodeX * scale, centerY - nodeY * scale)
          .scale(scale);
        svg.call(zoom.transform, transform);
      };

      // Disable default double-click zoom, add custom reset behavior
      svg.on('dblclick.zoom', null);
      svg.on('dblclick', () => {
        svg.transition()
          .duration(300)
          .call(zoom.transform, d3.zoomIdentity);
      });
    }

    // ── Node Hover Highlight/Dim ─────────────────────────────────

    if (!s.interactionSettings.highlightNeighbors.value) {
      // Skip neighbor highlighting when disabled
      // Entrance animations
      if (s.animationSettings.enabled.value) {
        this.animateEntrance(nodeElements, allLinkElements as unknown as d3.Selection<SVGElement, GraphLink, SVGGElement, unknown>, labelElements, s.animationSettings.duration.value);
      }

      // Accessibility
      if (s.accessibilityFormattingCard.enableKeyboardNav.value) {
        ensureFocusRingStyles();
        applyChartAria(this.container, {
          chartType: 'network-graph',
          dataPointCount: simNodes.length,
        });
        nodeElements.each(function (d, i) {
          applyDataPointAria(
            this,
            d.id,
            String(degreeMap.get(d.id) ?? 0),
            i,
            simNodes.length,
          );
        });
        attachKeyboardNav({
          container: this.container,
          itemSelector: '.network-node',
          onActivate: (el) => {
            (el as HTMLElement).click();
          },
        });
      }

      // Legend — cluster colors when clustering is enabled
      this.renderNetworkLegend(data, simNodes, enableClustering, clusterMap, usePalette, themeName);

      this.applyLabelVisibility();
      this.applyInteractiveFilters(data);
      this.container.addEventListener('click', this.handleBackgroundClick);
      return;
    }

    // Build adjacency set for fast lookup: nodeId -> Set of connected nodeIds
    const adjacency = new Map<string, Set<string>>();
    for (const link of simLinks) {
      const srcId = typeof link.source === 'string' ? link.source : (link.source as GraphNode).id;
      const tgtId = typeof link.target === 'string' ? link.target : (link.target as GraphNode).id;
      if (!adjacency.has(srcId)) adjacency.set(srcId, new Set());
      if (!adjacency.has(tgtId)) adjacency.set(tgtId, new Set());
      adjacency.get(srcId)!.add(tgtId);
      adjacency.get(tgtId)!.add(srcId);
    }
    this.adjacency = adjacency;
    this.hoveredNodeId = null;
    this.currentZoomScale = 1;

    const svgNode = svg.node();
    if (svgNode) {
      const allNodes = svgNode.querySelectorAll('[data-node]');
      const allLinks = svgNode.querySelectorAll('.network-link');
      const allLinkLabels = svgNode.querySelectorAll('.network-link-label');

      allNodes.forEach((el) => {
        el.addEventListener('mouseenter', () => {
          const hoveredId = el.getAttribute('data-node');
          if (!hoveredId) return;
          const neighbors = adjacency.get(hoveredId) ?? new Set<string>();
          const interactiveFilterActive = this.searchQuery.trim().length > 0 || this.isDetailFilterActive();
          const matchedIds = interactiveFilterActive ? this.getMatchedNodeIds(data) : null;

          // Dim/highlight nodes and labels — apply glow to hovered node
          allNodes.forEach((other) => {
            const otherId = other.getAttribute('data-node');
            const isHovered = otherId === hoveredId;
            const isHighlighted = isHovered || neighbors.has(otherId ?? '');
            const isNodeCircle = other.classList.contains('network-node');
            const passesInteractiveFilter = matchedIds === null || matchedIds.has(otherId ?? '');
            (other as SVGElement).style.opacity = isHighlighted && passesInteractiveFilter ? '1' : '0.15';
            // Apply glow + scale to the hovered node
            if (isHovered && isNodeCircle) {
              (other as SVGElement).style.filter = 'url(#node-glow)';
              (other as SVGElement).style.transform = 'scale(1.15)';
              (other as SVGElement).style.transformOrigin = 'center';
            } else if (isNodeCircle) {
              (other as SVGElement).style.filter = '';
              (other as SVGElement).style.transform = '';
            }
          });

          // Dim/highlight links — brighten connected links
          allLinks.forEach((link) => {
            const srcId = link.getAttribute('data-source');
            const tgtId = link.getAttribute('data-target');
            const isConnected = srcId === hoveredId || tgtId === hoveredId;
            const passesInteractiveFilter = matchedIds === null
              || (matchedIds.has(srcId ?? '') && matchedIds.has(tgtId ?? ''));
            const isVisible = isConnected && passesInteractiveFilter;
            (link as SVGElement).style.opacity = isVisible ? '1' : '0.08';
            if (isVisible) {
              (link as SVGElement).style.filter = 'brightness(1.3)';
            } else {
              (link as SVGElement).style.filter = '';
            }
          });
          allLinkLabels.forEach((label) => {
            const srcId = label.getAttribute('data-source');
            const tgtId = label.getAttribute('data-target');
            const isConnected = srcId === hoveredId || tgtId === hoveredId;
            const passesInteractiveFilter = matchedIds === null
              || (matchedIds.has(srcId ?? '') && matchedIds.has(tgtId ?? ''));
            (label as SVGElement).style.opacity = isConnected && passesInteractiveFilter ? '1' : '0.08';
          });
          this.applyLabelVisibility();
        });

        el.addEventListener('mouseleave', () => {
          allNodes.forEach((other) => {
            if (other.classList.contains('network-node')) {
              (other as SVGElement).style.filter = '';
              (other as SVGElement).style.transform = '';
            }
          });
          allLinks.forEach((link) => {
            (link as SVGElement).style.filter = '';
          });
          this.reapplyInteractiveState();
        });
      });
    }

    // Entrance animations
    if (s.animationSettings.enabled.value) {
      this.animateEntrance(nodeElements, allLinkElements as unknown as d3.Selection<SVGElement, GraphLink, SVGGElement, unknown>, labelElements, s.animationSettings.duration.value);
    }

    // Accessibility
    if (s.accessibilityFormattingCard.enableKeyboardNav.value) {
      ensureFocusRingStyles();
      applyChartAria(this.container, {
        chartType: 'network-graph',
        dataPointCount: simNodes.length,
      });
      nodeElements.each(function (d, i) {
        applyDataPointAria(
          this,
          d.id,
          String(degreeMap.get(d.id) ?? 0),
          i,
          simNodes.length,
        );
      });
      attachKeyboardNav({
        container: this.container,
        itemSelector: '.network-node',
        onActivate: (el) => {
          (el as HTMLElement).click();
        },
      });
    }

    // Legend — cluster colors when clustering is enabled
    this.renderNetworkLegend(data, simNodes, enableClustering, clusterMap, usePalette, themeName);

    this.applyLabelVisibility();
    this.applyInteractiveFilters(data);
    this.container.addEventListener('click', this.handleBackgroundClick);
  }

  private getLayoutMode(): NetworkLayoutMode {
    const layoutMode = resolveDropdown(this.settings.physicsAndLayoutSettings.layoutMode);
    if (this.settings.mapCanvasSettings.enabled.value || layoutMode === 'mapCanvas') {
      return 'mapCanvas';
    }
    return layoutMode === 'force' ? 'force' : 'sourceTarget';
  }

  private getFirstTextValue(values: powerbi.PrimitiveValue[] | undefined): string {
    if (!values) return '';
    for (const value of values) {
      if (value == null) continue;
      const text = String(value).trim();
      if (text.length > 0) return text;
    }
    return '';
  }

  private addNodeDetailFieldValue(node: GraphNode, label: string, value: string): void {
    if (!node.detailFields[label]) {
      node.detailFields[label] = [];
    }
    if (!node.detailFields[label].includes(value)) {
      node.detailFields[label].push(value);
    }
  }

  private cloneDetailFields(fields: Record<string, string[]>): Record<string, string[]> {
    return Object.fromEntries(Object.entries(fields).map(([key, values]) => [key, [...values]]));
  }

  private getMapImageSource(data: NetworkData): string {
    const settingsSource = this.settings.mapCanvasSettings.imageSource.value?.trim() ?? '';
    return settingsSource.length > 0 ? settingsSource : data.backgroundImageSource;
  }

  private renderMapBackground(
    layer: d3.Selection<SVGGElement, unknown, null, undefined>,
    data: NetworkData,
    innerWidth: number,
    innerHeight: number,
  ): void {
    if (this.getLayoutMode() !== 'mapCanvas') return;

    const imageSource = this.getMapImageSource(data);
    if (imageSource.length === 0) return;

    const imageOpacity = Math.max(0, Math.min(1, this.settings.mapCanvasSettings.imageOpacity.value / 100));
    const dimOpacity = Math.max(0, Math.min(1, this.settings.mapCanvasSettings.dimOverlayOpacity.value / 100));

    layer.append('image')
      .attr('class', 'network-map-image')
      .attr('href', imageSource)
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('preserveAspectRatio', this.getMapPreserveAspectRatio())
      .attr('opacity', imageOpacity)
      .style('pointer-events', 'none');

    if (dimOpacity > 0) {
      layer.append('rect')
        .attr('class', 'network-map-dim')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', innerWidth)
        .attr('height', innerHeight)
        .attr('fill', '#0F172A')
        .attr('fill-opacity', dimOpacity)
        .style('pointer-events', 'none');
    }
  }

  private getMapPreserveAspectRatio(): string {
    const fit = resolveDropdown(this.settings.mapCanvasSettings.imageFit) ?? 'contain';
    if (fit === 'stretch') return 'none';

    const horizontalAlign = resolveDropdown(this.settings.mapCanvasSettings.horizontalAlign) ?? 'center';
    const verticalAlign = resolveDropdown(this.settings.mapCanvasSettings.verticalAlign) ?? 'middle';
    const x = horizontalAlign === 'left' ? 'xMin' : horizontalAlign === 'right' ? 'xMax' : 'xMid';
    const y = verticalAlign === 'top' ? 'YMin' : verticalAlign === 'bottom' ? 'YMax' : 'YMid';
    const meetOrSlice = fit === 'cover' ? 'slice' : 'meet';
    return `${x}${y} ${meetOrSlice}`;
  }

  private createMapCanvasLayoutTargets(
    nodes: GraphNode[],
    links: GraphLink[],
    innerWidth: number,
    innerHeight: number,
    centerX: number,
    centerY: number,
  ): Map<string, { x: number; y: number }> {
    const targets = new Map<string, { x: number; y: number }>();
    const persistedPositions = this.parsePersistedSourcePositions();
    const sourceNodes = nodes.filter((node) => node.role !== 'target');
    const targetNodes = nodes.filter((node) => node.role === 'target');

    this.assignMapSourceTargets(sourceNodes, innerWidth, innerHeight, centerX, centerY, persistedPositions, targets);
    this.reflowMapCanvasTargetTargets(targetNodes, links, innerWidth, innerHeight, centerX, centerY, targets);

    return targets;
  }

  private assignMapSourceTargets(
    nodes: GraphNode[],
    innerWidth: number,
    innerHeight: number,
    centerX: number,
    centerY: number,
    persistedPositions: PersistedSourcePositions,
    targets: Map<string, { x: number; y: number }>,
  ): void {
    if (nodes.length === 0) return;

    const rail = this.getMapTargetLayoutPreset() === 'rail' ? this.getTargetRailPosition() : 'none';
    const padding = Math.max(MAP_CANVAS_MIN_PADDING, this.settings.physicsAndLayoutSettings.fitPadding.value);
    const horizontalRailReserve = rail === 'left' || rail === 'right' ? Math.min(120, innerWidth * 0.22) : 0;
    const verticalRailReserve = rail === 'top' || rail === 'bottom' ? Math.min(90, innerHeight * 0.22) : 0;
    const left = rail === 'left' ? padding + horizontalRailReserve : padding;
    const right = rail === 'right' ? innerWidth - padding - horizontalRailReserve : innerWidth - padding;
    const top = rail === 'top' ? padding + verticalRailReserve : padding;
    const bottom = rail === 'bottom' ? innerHeight - padding - verticalRailReserve : innerHeight - padding;
    const columns = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
    const rows = Math.max(1, Math.ceil(nodes.length / columns));
    const availableWidth = Math.max(1, right - left);
    const availableHeight = Math.max(1, bottom - top);

    nodes.forEach((node, index) => {
      const persisted = persistedPositions[node.id];
      if (persisted) {
        targets.set(node.id, {
          x: this.clamp(persisted.x, 0, 1) * innerWidth,
          y: this.clamp(persisted.y, 0, 1) * innerHeight,
        });
        return;
      }

      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = columns <= 1 ? centerX : left + (availableWidth * column) / (columns - 1);
      const y = rows <= 1 ? centerY : top + (availableHeight * row) / (rows - 1);
      const jitter = nodes.length <= 1 ? 0 : (index % 2 === 0 ? 8 : -8);
      targets.set(node.id, {
        x: this.clamp(x + jitter, padding, innerWidth - padding),
        y: this.clamp(y - jitter, padding, innerHeight - padding),
      });
    });
  }

  private reflowMapCanvasTargetTargets(
    targetNodes: GraphNode[],
    links: GraphLink[],
    innerWidth: number,
    innerHeight: number,
    centerX: number,
    centerY: number,
    targets: Map<string, { x: number; y: number }>,
  ): void {
    if (targetNodes.length === 0) return;

    const preset = this.getMapTargetLayoutPreset();
    if (preset === 'rail') {
      this.assignMapTargetRailTargets(targetNodes, innerWidth, innerHeight, centerX, centerY, targets);
      return;
    }

    this.assignMapTargetAroundSourceTargets(targetNodes, links, innerWidth, innerHeight, centerX, centerY, targets, preset);
  }

  private assignMapTargetAroundSourceTargets(
    targetNodes: GraphNode[],
    links: GraphLink[],
    innerWidth: number,
    innerHeight: number,
    centerX: number,
    centerY: number,
    targets: Map<string, { x: number; y: number }>,
    preset: Exclude<MapCanvasTargetLayoutPreset, 'rail'>,
  ): void {
    const targetById = new Map(targetNodes.map((node) => [node.id, node]));
    const groupedTargets = new Map<string, GraphNode[]>();
    const assignedTargets = new Set<string>();

    for (const link of links) {
      const sourceId = this.getNodeId(link.source);
      const targetId = this.getNodeId(link.target);
      const targetNode = targetById.get(targetId);
      if (!targetNode) continue;

      const group = groupedTargets.get(sourceId) ?? [];
      if (!group.some((node) => node.id === targetNode.id)) {
        group.push(targetNode);
        assignedTargets.add(targetNode.id);
      }
      groupedTargets.set(sourceId, group);
    }

    const fallbackTargets = targetNodes.filter((node) => !assignedTargets.has(node.id));
    if (fallbackTargets.length > 0) {
      groupedTargets.set('__fallback__', fallbackTargets);
      targets.set('__fallback__', { x: centerX, y: centerY });
    }

    const padding = Math.max(MAP_CANVAS_MIN_PADDING, this.settings.physicsAndLayoutSettings.fitPadding.value);
    const orbitRadius = this.getTargetOrbitRadius();
    const clampX = (x: number) => this.clamp(x, padding, Math.max(padding, innerWidth - padding));
    const clampY = (y: number) => this.clamp(y, padding, Math.max(padding, innerHeight - padding));

    for (const [sourceId, group] of groupedTargets) {
      const sourceTarget = targets.get(sourceId) ?? { x: centerX, y: centerY };
      group.forEach((node, index) => {
        const point = preset === 'cluster'
          ? this.getClusterTargetPoint(sourceTarget, index, group.length, orbitRadius)
          : this.getRadialTargetPoint(sourceTarget, index, group.length, orbitRadius, preset);
        targets.set(node.id, {
          x: clampX(point.x),
          y: clampY(point.y),
        });
      });
    }
  }

  private getRadialTargetPoint(
    source: { x: number; y: number },
    index: number,
    count: number,
    baseRadius: number,
    preset: Exclude<MapCanvasTargetLayoutPreset, 'cluster' | 'rail'>,
  ): { x: number; y: number } {
    if (count <= 1) {
      const angle = -Math.PI / 4;
      return {
        x: source.x + Math.cos(angle) * baseRadius,
        y: source.y + Math.sin(angle) * baseRadius,
      };
    }

    if (preset === 'hybrid' && count > 8) {
      const goldenAngle = Math.PI * (3 - Math.sqrt(5));
      const distance = baseRadius * (0.75 + Math.sqrt(index + 1) * 0.42);
      const angle = -Math.PI / 2 + index * goldenAngle;
      return {
        x: source.x + Math.cos(angle) * distance,
        y: source.y + Math.sin(angle) * distance,
      };
    }

    const ringCapacity = 8;
    const ring = Math.floor(index / ringCapacity);
    const ringIndex = index % ringCapacity;
    const ringCount = Math.min(ringCapacity, count - (ring * ringCapacity));
    const angle = -Math.PI / 2 + ((Math.PI * 2) * ringIndex) / Math.max(1, ringCount);
    const distance = baseRadius + (ring * baseRadius * 0.72);

    return {
      x: source.x + Math.cos(angle) * distance,
      y: source.y + Math.sin(angle) * distance,
    };
  }

  private getClusterTargetPoint(
    source: { x: number; y: number },
    index: number,
    count: number,
    baseRadius: number,
  ): { x: number; y: number } {
    if (count <= 1) {
      return { x: source.x + baseRadius, y: source.y };
    }

    const spacing = Math.max(10, baseRadius * 0.72);
    const columns = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / columns);
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = source.x + (column - ((columns - 1) / 2)) * spacing;
    const y = source.y + (row - ((rows - 1) / 2)) * spacing;
    const diagonalNudge = (index % 2 === 0 ? -1 : 1) * Math.min(10, spacing * 0.18);

    return { x: x + diagonalNudge, y: y - diagonalNudge };
  }

  private reflowMapCanvasTargetNodes(
    nodes: GraphNode[],
    links: GraphLink[],
    targets: Map<string, { x: number; y: number }>,
    innerWidth: number,
    innerHeight: number,
  ): void {
    const centerX = innerWidth / 2;
    const centerY = innerHeight / 2;
    const targetNodes = nodes.filter((node) => node.role === 'target');
    this.reflowMapCanvasTargetTargets(targetNodes, links, innerWidth, innerHeight, centerX, centerY, targets);
    this.lockMapCanvasLayout(nodes, targets);
  }

  private lockMapCanvasLayout(
    nodes: GraphNode[],
    targets: Map<string, { x: number; y: number }>,
  ): void {
    for (const node of nodes) {
      const target = targets.get(node.id);
      if (!target) continue;
      node.x = target.x;
      node.y = target.y;
      node.fx = target.x;
      node.fy = target.y;
    }
  }

  private assignMapTargetRailTargets(
    nodes: GraphNode[],
    innerWidth: number,
    innerHeight: number,
    centerX: number,
    centerY: number,
    targets: Map<string, { x: number; y: number }>,
  ): void {
    if (nodes.length === 0) return;

    const rail = this.getTargetRailPosition();
    const padding = Math.max(MAP_CANVAS_MIN_PADDING, this.settings.physicsAndLayoutSettings.fitPadding.value);
    const assignSpread = (index: number, count: number, start: number, end: number): number => {
      if (count <= 1) return (start + end) / 2;
      return start + ((end - start) * index) / (count - 1);
    };

    nodes.forEach((node, index) => {
      const laneOffset = nodes.length <= 1 ? 0 : (index % 2 === 0 ? -10 : 10);
      switch (rail) {
        case 'left':
          targets.set(node.id, {
            x: padding,
            y: assignSpread(index, nodes.length, padding, innerHeight - padding),
          });
          break;
        case 'top':
          targets.set(node.id, {
            x: assignSpread(index, nodes.length, padding, innerWidth - padding),
            y: padding,
          });
          break;
        case 'bottom':
          targets.set(node.id, {
            x: assignSpread(index, nodes.length, padding, innerWidth - padding),
            y: innerHeight - padding,
          });
          break;
        case 'right':
        default:
          targets.set(node.id, {
            x: innerWidth - padding + laneOffset,
            y: assignSpread(index, nodes.length, padding, innerHeight - padding),
          });
          break;
      }
    });
  }

  private getTargetRailPosition(): TargetRailPosition {
    const position = resolveDropdown(this.settings.mapCanvasSettings.targetRailPosition) ?? 'right';
    return ['left', 'top', 'bottom'].includes(position) ? position as TargetRailPosition : 'right';
  }

  private getMapTargetLayoutPreset(): MapCanvasTargetLayoutPreset {
    const preset = resolveDropdown(this.settings.mapCanvasSettings.targetLayoutPreset) ?? 'orbit';
    return ['cluster', 'hybrid', 'rail'].includes(preset)
      ? preset as MapCanvasTargetLayoutPreset
      : 'orbit';
  }

  private getTargetOrbitRadius(): number {
    const rawRadius = Number(this.settings.mapCanvasSettings.targetOrbitRadius?.value ?? 40);
    return this.clamp(Number.isFinite(rawRadius) ? rawRadius : 40, 6, 260);
  }

  private parsePersistedSourcePositions(): PersistedSourcePositions {
    if (this.settings.mapCanvasSettings.resetPositions.value) return {};

    const rawValue = this.settings.mapCanvasSettings.persistedSourcePositions.value;
    if (!rawValue || rawValue.trim().length === 0) return {};

    try {
      const parsed = JSON.parse(rawValue) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      const positions: PersistedSourcePositions = {};
      for (const [nodeId, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (!value || typeof value !== 'object') continue;
        const position = value as Record<string, unknown>;
        const x = Number(position.x);
        const y = Number(position.y);
        if (Number.isFinite(x) && Number.isFinite(y)) {
          positions[nodeId] = {
            x: this.clamp(x, 0, 1),
            y: this.clamp(y, 0, 1),
          };
        }
      }
      return positions;
    } catch {
      return {};
    }
  }

  private persistSourceNodePosition(
    nodeId: string,
    x: number,
    y: number,
    innerWidth: number,
    innerHeight: number,
  ): void {
    const positions = this.parsePersistedSourcePositions();
    positions[nodeId] = {
      x: this.clamp(x / Math.max(1, innerWidth), 0, 1),
      y: this.clamp(y / Math.max(1, innerHeight), 0, 1),
    };
    const serializedPositions = JSON.stringify(positions);
    this.settings.mapCanvasSettings.persistedSourcePositions.value = serializedPositions;
    this.settings.mapCanvasSettings.resetPositions.value = false;

    this.host.persistProperties({
      merge: [{
        objectName: 'mapCanvasSettings',
        selector: undefined as unknown as powerbi.data.Selector,
        properties: {
          persistedSourcePositions: serializedPositions,
          resetPositions: false,
        },
      }],
    });
  }

  private snapshotCurrentMapCanvasSourcePositions(): PersistedSourcePositions {
    const positions = this.parsePersistedSourcePositions();
    if (this.getLayoutMode() !== 'mapCanvas') return positions;

    const svg = this.container.querySelector<SVGSVGElement>('svg.network-svg');
    const width = Number(svg?.getAttribute('width'));
    const height = Number(svg?.getAttribute('height'));
    if (!Number.isFinite(width) || !Number.isFinite(height)) return positions;

    const innerWidth = Math.max(1, width - MARGIN.left - MARGIN.right);
    const innerHeight = Math.max(1, height - MARGIN.top - MARGIN.bottom);
    this.container.querySelectorAll<SVGCircleElement>('.network-node').forEach((node) => {
      if (node.getAttribute('data-role') === 'target') return;
      const nodeId = node.getAttribute('data-node');
      const x = Number(node.getAttribute('cx'));
      const y = Number(node.getAttribute('cy'));
      if (!nodeId || !Number.isFinite(x) || !Number.isFinite(y)) return;
      positions[nodeId] = {
        x: this.clamp(x / innerWidth, 0, 1),
        y: this.clamp(y / innerHeight, 0, 1),
      };
    });

    return positions;
  }

  private getBadgeMeasureLabel(data: NetworkData): string {
    if (data.detailMeasureLabels.length === 0) return '';
    const requestedLabel = this.settings.measureBadgeSettings.badgeMeasureName.value?.trim() ?? '';
    if (requestedLabel.length === 0) return data.detailMeasureLabels[0];
    const exact = data.detailMeasureLabels.find((label) => label === requestedLabel);
    if (exact) return exact;
    const caseInsensitive = data.detailMeasureLabels.find((label) => label.toLowerCase() === requestedLabel.toLowerCase());
    return caseInsensitive ?? data.detailMeasureLabels[0];
  }

  private getBadgeText(label: string, value: number): string {
    const formattedValue = formatWithSettings(value, this.settings.numberFormattingCard);
    const mode = resolveDropdown(this.settings.measureBadgeSettings.badgeDisplayMode) ?? 'value';
    if (mode === 'name') return label;
    if (mode === 'nameValue') return `${label}: ${formattedValue}`;
    return formattedValue;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  private createSourceTargetLayoutTargets(
    nodes: GraphNode[],
    innerWidth: number,
    innerHeight: number,
    centerX: number,
    centerY: number,
  ): Map<string, { x: number; y: number }> {
    const targets = new Map<string, { x: number; y: number }>();
    const padding = Math.max(16, this.settings.physicsAndLayoutSettings.fitPadding.value);
    const requestedSeparation = Math.max(80, this.settings.physicsAndLayoutSettings.roleSeparation.value);
    const maxSeparation = Math.max(80, innerWidth - padding * 2 - 48);
    const separation = Math.min(requestedSeparation, maxSeparation);
    const requestedSpread = Math.max(0, this.settings.physicsAndLayoutSettings.roleSpread.value);
    const maxSpread = Math.max(0, innerHeight - padding * 2 - 32);
    const spread = Math.min(requestedSpread, maxSpread);

    const groups: Record<NodeRole, GraphNode[]> = {
      source: [],
      target: [],
      both: [],
    };
    for (const node of nodes) {
      groups[node.role].push(node);
    }

    const sourceX = centerX - separation / 2;
    const targetX = centerX + separation / 2;
    const bothX = centerX;
    const jitter = Math.min(14, separation * 0.04);

    this.assignLaneTargets(groups.source, sourceX, centerY, spread, targets, jitter);
    this.assignLaneTargets(groups.target, targetX, centerY, spread, targets, -jitter);
    this.assignLaneTargets(groups.both, bothX, centerY, spread * 0.75, targets, 0);

    return targets;
  }

  private assignLaneTargets(
    nodes: GraphNode[],
    laneX: number,
    centerY: number,
    spread: number,
    targets: Map<string, { x: number; y: number }>,
    jitter: number,
  ): void {
    nodes.forEach((node, index) => {
      const y = nodes.length <= 1
        ? centerY
        : centerY - spread / 2 + (spread * index) / (nodes.length - 1);
      const xOffset = nodes.length <= 1 ? 0 : (index % 2 === 0 ? jitter : -jitter);
      targets.set(node.id, { x: laneX + xOffset, y });
    });
  }

  private seedSourceTargetLayout(nodes: GraphNode[], targets: Map<string, { x: number; y: number }>): void {
    for (const node of nodes) {
      const target = targets.get(node.id);
      if (!target) continue;
      node.x = target.x;
      node.y = target.y;
      node.vx = 0;
      node.vy = 0;
    }
  }

  private settleInitialLayout(
    simulation: d3.Simulation<GraphNode, GraphLink>,
    nodes: GraphNode[],
    innerWidth: number,
    innerHeight: number,
    centerX: number,
    centerY: number,
    getNodeRadius: (node: GraphNode) => number,
  ): void {
    simulation.stop();

    const settleTicks = Math.max(0, Math.min(500, Math.round(this.settings.physicsAndLayoutSettings.settleTicks.value)));
    for (let i = 0; i < settleTicks; i++) {
      simulation.tick();
    }

    if (!this.settings.physicsAndLayoutSettings.autoCenter.value && !this.settings.physicsAndLayoutSettings.fitOnLoad.value) {
      return;
    }

    const bounds = this.getLayoutBounds(nodes, getNodeRadius, false);
    if (!bounds) return;

    const padding = Math.max(0, this.settings.physicsAndLayoutSettings.fitPadding.value);
    const availableWidth = Math.max(1, innerWidth - padding * 2);
    const availableHeight = Math.max(1, innerHeight - padding * 2);
    const boundsWidth = Math.max(1, bounds.maxX - bounds.minX);
    const boundsHeight = Math.max(1, bounds.maxY - bounds.minY);
    const fitScale = this.settings.physicsAndLayoutSettings.fitOnLoad.value
      ? Math.min(1, availableWidth / boundsWidth, availableHeight / boundsHeight)
      : 1;
    const boundsCenterX = (bounds.minX + bounds.maxX) / 2;
    const boundsCenterY = (bounds.minY + bounds.maxY) / 2;

    for (const node of nodes) {
      const x = node.x ?? centerX;
      const y = node.y ?? centerY;
      node.x = centerX + (x - boundsCenterX) * fitScale;
      node.y = centerY + (y - boundsCenterY) * fitScale;
    }

    this.clampNodesToViewport(nodes, innerWidth, innerHeight, padding, getNodeRadius);
  }

  private getLayoutBounds(
    nodes: GraphNode[],
    getNodeRadius: (node: GraphNode) => number,
    includeLabels = true,
  ): { minX: number; maxX: number; minY: number; maxY: number } | null {
    if (nodes.length === 0) return null;

    const shouldIncludeLabels = includeLabels && this.settings.nodeSettings.showLabels.value;
    const labelOffset = Math.max(0, this.settings.nodeSettings.labelOffset.value);
    const maxLabelCharacters = Math.max(4, Math.round(this.settings.nodeSettings.maxLabelCharacters.value));
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const node of nodes) {
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const radius = getNodeRadius(node);
      minX = Math.min(minX, x - radius);
      maxX = Math.max(maxX, x + radius);
      minY = Math.min(minY, y - radius);
      maxY = Math.max(maxY, y + radius);

      if (shouldIncludeLabels) {
        const labelFontSize = Math.max(6, this.getNodeLabelFontSize(node));
        const label = this.truncateLabel(node.displayLabel, maxLabelCharacters);
        const labelWidth = this.estimateTextWidth(label, labelFontSize);
        minY = Math.min(minY, y - labelFontSize * 0.7);
        maxY = Math.max(maxY, y + labelFontSize * 0.7);
        maxX = Math.max(maxX, x + radius + labelOffset + labelWidth);
      }
    }

    return { minX, maxX, minY, maxY };
  }

  private clampNodesToViewport(
    nodes: GraphNode[],
    innerWidth: number,
    innerHeight: number,
    padding: number,
    getNodeRadius: (node: GraphNode) => number,
  ): void {
    for (const node of nodes) {
      const radius = getNodeRadius(node);
      const minX = padding + radius;
      const maxX = innerWidth - padding - radius;
      const minY = padding + radius;
      const maxY = innerHeight - padding - radius;
      if (maxX >= minX) {
        node.x = Math.min(maxX, Math.max(minX, node.x ?? minX));
      }
      if (maxY >= minY) {
        node.y = Math.min(maxY, Math.max(minY, node.y ?? minY));
      }
    }
  }

  private getNodeLabelPosition(): NodeLabelPosition {
    const rawPosition = resolveDropdown(this.settings.nodeSettings.labelPosition) ?? 'right';
    return ['inside', 'left', 'above', 'below'].includes(rawPosition)
      ? rawPosition as NodeLabelPosition
      : 'right';
  }

  private getNodeLabelFontSize(node: Pick<GraphNode, 'role'>): number {
    const readFontSize = (value: unknown, fallback: number): number => {
      const numeric = Number(value);
      return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
    };
    const baseFontSize = readFontSize(this.settings.nodeSettings.fontSize.value, 11);
    if (!this.settings.nodeSettings.useRoleLabelFontSizes.value) return baseFontSize;
    if (node.role === 'source') {
      return readFontSize(this.settings.nodeSettings.sourceLabelFontSize.value, baseFontSize);
    }
    if (node.role === 'target') {
      return readFontSize(this.settings.nodeSettings.targetLabelFontSize.value, baseFontSize);
    }
    return baseFontSize;
  }

  private getLabelTextAnchor(position: NodeLabelPosition): 'start' | 'middle' | 'end' {
    switch (position) {
      case 'left':
        return 'end';
      case 'inside':
      case 'above':
      case 'below':
        return 'middle';
      case 'right':
      default:
        return 'start';
    }
  }

  private getNodeLabelCoordinates(node: GraphNode, nodeRadius: number): { x: number; y: number } {
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    const offset = Math.max(0, this.settings.nodeSettings.labelOffset.value);

    switch (this.getNodeLabelPosition()) {
      case 'inside':
        return { x, y };
      case 'left':
        return { x: x - nodeRadius - offset, y };
      case 'above':
        return { x, y: y - nodeRadius - offset };
      case 'below':
        return { x, y: y + nodeRadius + offset };
      case 'right':
      default:
        return { x: x + nodeRadius + offset, y };
    }
  }

  private getLinkLabelPoint(
    link: GraphLink,
    centerX: number,
    centerY: number,
    edgeBundling: boolean,
  ): { x: number; y: number } {
    const src = link.source as GraphNode;
    const tgt = link.target as GraphNode;
    const sx = src.x ?? 0;
    const sy = src.y ?? 0;
    const tx = tgt.x ?? 0;
    const ty = tgt.y ?? 0;
    const mx = (sx + tx) / 2;
    const my = (sy + ty) / 2;

    if (!edgeBundling) {
      return { x: mx, y: my };
    }

    const cx = mx + (centerX - mx) * 0.3;
    const cy = my + (centerY - my) * 0.3;
    return {
      x: (sx * 0.25) + (cx * 0.5) + (tx * 0.25),
      y: (sy * 0.25) + (cy * 0.5) + (ty * 0.25),
    };
  }

  private estimateTextWidth(text: string, fontSize: number): number {
    return text.length * fontSize * ESTIMATED_CHARACTER_WIDTH;
  }

  private truncateLabel(label: string, maxCharacters: number): string {
    if (label.length <= maxCharacters) return label;
    return `${label.slice(0, Math.max(1, maxCharacters - 1))}…`;
  }

  private renderNetworkLegend(
    data: NetworkData,
    nodes: GraphNode[],
    enableClustering: boolean,
    clusterMap: Map<string, number>,
    usePalette: boolean,
    themeName: ColorThemeName,
  ): void {
    const legendCard = this.settings.legendFormattingCard;
    if (!legendCard.showLegend.value) return;

    const legendPos = resolveDropdown(legendCard.legendPosition) ?? 'bottom';
    const rawFontColor = legendCard.legendFontColor.value?.value;
    const roleColoring = this.settings.colorsAndThemeSettings.colorByNodeRole.value;

    if (roleColoring) {
      const roles = new Set(nodes.map((node) => node.role));
      const roleItems: LegendItem[] = [];
      if (roles.has('source')) {
        roleItems.push({
          label: data.sourceLabel,
          color: this.settings.colorsAndThemeSettings.sourceNodeColor.value?.value || '#2563EB',
        });
      }
      if (roles.has('target')) {
        roleItems.push({
          label: data.targetLabel,
          color: this.settings.colorsAndThemeSettings.targetNodeColor.value?.value || '#DC2626',
        });
      }
      if (roles.has('both')) {
        roleItems.push({
          label: `${data.sourceLabel} + ${data.targetLabel}`,
          color: this.settings.colorsAndThemeSettings.bothRoleNodeColor.value?.value || '#D97706',
        });
      }

      if (roleItems.length > 0) {
        renderLegend(this.container, {
          items: roleItems,
          position: legendPos as 'top' | 'bottom' | 'left' | 'right',
          fontSize: legendCard.legendFontSize.value,
          fontColor: rawFontColor && rawFontColor.length > 0 ? rawFontColor : '#64748B',
          fontFamily: resolveDropdown(legendCard.legendFontFamily) || undefined,
          fontWeight: resolveDropdown(legendCard.legendFontWeight) || 'normal',
          aliases: legendCard.legendAliases.value,
        });
      }
      return;
    }

    if (!enableClustering) return;

    // Collect unique cluster IDs and their colors
    const uniqueClusters = new Set<number>();
    for (const c of clusterMap.values()) uniqueClusters.add(c);
    const sortedClusters = Array.from(uniqueClusters).sort((a, b) => a - b);

    const legendItems: LegendItem[] = sortedClusters.map((clusterId) => ({
      label: `Cluster ${clusterId + 1}`,
      color: usePalette
        ? getHostChartColor(this.host.colorPalette, clusterId, themeName)
        : getChartColor(clusterId, themeName),
    }));

    if (legendItems.length > 0) {
      renderLegend(this.container, {
        items: legendItems,
        position: legendPos as 'top' | 'bottom' | 'left' | 'right',
        fontSize: legendCard.legendFontSize.value,
        fontColor: rawFontColor && rawFontColor.length > 0 ? rawFontColor : '#64748B',
        fontFamily: resolveDropdown(legendCard.legendFontFamily) || undefined,
        fontWeight: resolveDropdown(legendCard.legendFontWeight) || 'normal',
        aliases: legendCard.legendAliases.value,
      });
    }
  }

  private getConditionalColor(value: number): string | undefined {
    const cc = this.settings.conditionalFormattingCard;
    if (!cc.enableConditional.value) return undefined;
    const config = buildConditionalConfig(
      true,
      resolveDropdown(cc.conditionalDirection),
      cc.threshold1.value,
      cc.threshold2.value,
      cc.conditionalColor1.value?.value,
      cc.conditionalColor2.value?.value,
      cc.conditionalColor3.value?.value,
    );
    return resolveConditionalColor(value, config);
  }

  // ── Search Input ────────────────────────────────────────────

  private renderSearchInput(data: NetworkData): void {
    this.container.querySelector('.network-search-controls')?.remove();
    const showSearch = this.settings.interactionSettings.enableSearch.value;
    const detailFields = this.getDetailFilterFields(data);
    this.pruneDetailFilterRules(data, detailFields);
    const showDetailFilter = detailFields.length > 0;
    if (!showSearch && !showDetailFilter) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'network-search-controls';

    if (showSearch) {
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'network-search-toggle';
      toggle.setAttribute('aria-label', this.searchOpen ? 'Hide network search' : 'Show network search');
      toggle.setAttribute('aria-expanded', this.searchOpen ? 'true' : 'false');
      toggle.appendChild(this.createControlIcon('search'));
      toggle.addEventListener('click', (event) => {
        event.stopPropagation();
        this.searchOpen = !this.searchOpen;
        if (!this.searchOpen) {
          this.searchQuery = '';
          this.applySearchQuery('', data);
        }
        this.renderSearchInput(data);
      });
      wrapper.appendChild(toggle);
    }

    if (showDetailFilter) {
      const filterToggle = document.createElement('button');
      filterToggle.type = 'button';
      filterToggle.className = 'network-search-toggle network-detail-filter-toggle';
      const activeFilterCount = this.detailFilterRules.length;
      const toggleLabel = this.detailFilterOpen ? 'Hide detail filter' : 'Show detail filter';
      filterToggle.setAttribute(
        'aria-label',
        activeFilterCount > 0
          ? `${toggleLabel}, ${activeFilterCount} active ${activeFilterCount === 1 ? 'filter' : 'filters'}`
          : toggleLabel,
      );
      filterToggle.setAttribute('aria-expanded', this.detailFilterOpen ? 'true' : 'false');
      filterToggle.appendChild(this.createControlIcon('filter'));
      if (activeFilterCount > 0) {
        const count = document.createElement('span');
        count.className = 'network-detail-filter-count';
        count.textContent = String(activeFilterCount);
        filterToggle.appendChild(count);
      }
      filterToggle.addEventListener('click', (event) => {
        event.stopPropagation();
        this.detailFilterOpen = !this.detailFilterOpen;
        this.renderSearchInput(data);
      });
      wrapper.appendChild(filterToggle);
    } else {
      this.detailFilterOpen = false;
      this.resetDetailFilters();
    }

    let focusElement: HTMLElement | null = null;

    if (showSearch && this.searchOpen) {
      const panel = document.createElement('div');
      panel.className = 'network-search-panel';
      panel.addEventListener('click', (event) => event.stopPropagation());

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'network-search-input';
      input.placeholder = 'Search nodes...';
      input.value = this.searchQuery;

      input.addEventListener('input', () => {
        this.searchQuery = input.value;
        this.applySearchQuery(input.value, data);
      });

      panel.appendChild(input);
      wrapper.appendChild(panel);
      focusElement = input;
    }

    if (showDetailFilter && this.detailFilterOpen) {
      const panel = this.createDetailFilterPanel(data, detailFields);
      wrapper.appendChild(panel);
      focusElement ??= panel.querySelector<HTMLElement>('.network-detail-filter-field');
    }

    this.container.appendChild(wrapper);
    if (focusElement) {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => focusElement?.focus());
      } else {
        focusElement.focus();
      }
    }
    this.applyInteractiveFilters(data);
  }

  private createDetailFilterPanel(data: NetworkData, detailFields: DetailFilterFieldOption[]): HTMLDivElement {
    const panel = document.createElement('div');
    panel.className = 'network-detail-filter-panel';
    panel.addEventListener('click', (event) => event.stopPropagation());

    const selectedFieldIsValid = detailFields.some((field) => field.key === this.pendingDetailFilterField);
    if (!selectedFieldIsValid) {
      this.pendingDetailFilterField = '';
      this.pendingDetailFilterOperator = 'eq';
      this.pendingDetailFilterValue = '';
    }

    const header = document.createElement('div');
    header.className = 'network-detail-filter-header';
    const title = document.createElement('div');
    title.className = 'network-detail-filter-title';
    title.textContent = 'Filters';
    const matchCount = document.createElement('div');
    matchCount.className = 'network-detail-filter-match-count';
    matchCount.textContent = `${this.getMatchedNodeIds(data).size} of ${data.nodes.length} nodes`;
    header.appendChild(title);
    header.appendChild(matchCount);

    const chips = document.createElement('div');
    chips.className = 'network-detail-filter-chips';
    for (const rule of this.detailFilterRules) {
      const chip = document.createElement('span');
      chip.className = 'network-detail-filter-chip';
      chip.textContent = this.getDetailFilterRuleDisplay(rule);

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'network-detail-filter-chip-remove';
      remove.setAttribute('aria-label', `Remove ${this.getDetailFilterRuleDisplay(rule)}`);
      remove.textContent = 'x';
      remove.addEventListener('click', (event) => {
        event.stopPropagation();
        this.detailFilterRules = this.detailFilterRules.filter((existing) => existing.id !== rule.id);
        this.renderSearchInput(data);
        this.applyInteractiveFilters(data);
      });

      chip.appendChild(remove);
      chips.appendChild(chip);
    }

    const builder = document.createElement('div');
    builder.className = 'network-detail-filter-builder';

    const fieldSelect = document.createElement('select');
    fieldSelect.className = 'network-detail-filter-field';
    fieldSelect.setAttribute('aria-label', 'Detail filter field');
    fieldSelect.appendChild(this.createOption('', 'Detail'));
    for (const field of detailFields) {
      fieldSelect.appendChild(this.createOption(field.key, field.label));
    }
    fieldSelect.value = this.pendingDetailFilterField;
    this.applyDetailFilterSelectSizing(fieldSelect, 'Detail', 10, 26);
    fieldSelect.addEventListener('change', () => {
      this.pendingDetailFilterField = fieldSelect.value;
      this.pendingDetailFilterOperator = 'eq';
      this.pendingDetailFilterValue = '';
      this.renderSearchInput(data);
      this.applyInteractiveFilters(data);
    });

    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'network-detail-filter-add';
    add.setAttribute('aria-label', 'Add detail filter');
    add.textContent = 'Add';
    add.disabled = !this.canAddPendingDetailFilter();
    add.addEventListener('click', (event) => {
      event.stopPropagation();
      this.addPendingDetailFilterRule(data);
    });

    builder.appendChild(fieldSelect);
    const parsedPendingField = this.parseDetailFilterKey(this.pendingDetailFilterField);
    if (parsedPendingField?.kind === 'measure') {
      const operatorSelect = this.createMeasureOperatorSelect(data);
      const valueInput = this.createMeasureValueInput();
      valueInput.addEventListener('input', () => {
        add.disabled = !this.canAddPendingDetailFilter();
      });
      builder.appendChild(operatorSelect);
      builder.appendChild(valueInput);
      builder.appendChild(this.createZeroHelperRow(data));
    } else {
      const valueSelect = document.createElement('select');
      valueSelect.className = 'network-detail-filter-value';
      valueSelect.setAttribute('aria-label', 'Detail filter value');
      valueSelect.appendChild(this.createOption('', 'Value'));
      const valueOptions = this.getDetailFilterValueOptions(data, this.pendingDetailFilterField);
      const selectedValueIsValid = valueOptions.some((option) => option.value === this.pendingDetailFilterValue);
      if (!selectedValueIsValid) {
        this.pendingDetailFilterValue = '';
      }
      for (const filterValue of valueOptions) {
        valueSelect.appendChild(this.createOption(filterValue.value, filterValue.label));
      }
      valueSelect.value = this.pendingDetailFilterValue;
      valueSelect.disabled = this.pendingDetailFilterField.length === 0 || valueOptions.length === 0;
      this.applyDetailFilterSelectSizing(valueSelect, 'Value', 8, 22);
      valueSelect.addEventListener('change', () => {
        this.pendingDetailFilterValue = valueSelect.value;
        this.pendingDetailFilterOperator = this.getPendingDetailFilterOperator();
        this.renderSearchInput(data);
        this.applyInteractiveFilters(data);
      });
      builder.appendChild(valueSelect);
    }
    builder.appendChild(add);

    const footer = document.createElement('div');
    footer.className = 'network-detail-filter-footer';

    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'network-detail-filter-clear';
    clear.setAttribute('aria-label', 'Clear detail filters');
    clear.textContent = 'Clear';
    clear.disabled = !this.isDetailFilterActive() && !this.hasPendingDetailFilter();
    clear.addEventListener('click', (event) => {
      event.stopPropagation();
      this.resetDetailFilters();
      this.renderSearchInput(data);
      this.applyInteractiveFilters(data);
    });

    const done = document.createElement('button');
    done.type = 'button';
    done.className = 'network-detail-filter-done';
    done.setAttribute('aria-label', 'Close detail filter tray');
    done.textContent = 'Done';
    done.addEventListener('click', (event) => {
      event.stopPropagation();
      this.detailFilterOpen = false;
      this.renderSearchInput(data);
      this.applyInteractiveFilters(data);
    });

    footer.appendChild(clear);
    footer.appendChild(done);

    panel.appendChild(header);
    panel.appendChild(chips);
    panel.appendChild(builder);
    panel.appendChild(this.createDetailFilterMoreRow(data));
    panel.appendChild(footer);
    return panel;
  }

  private createOption(value: string, label: string): HTMLOptionElement {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    return option;
  }

  private createMeasureOperatorSelect(data: NetworkData): HTMLSelectElement {
    const operatorSelect = document.createElement('select');
    operatorSelect.className = 'network-detail-filter-operator';
    operatorSelect.setAttribute('aria-label', 'Detail filter operator');
    for (const [value, label] of this.getDetailFilterOperatorOptions()) {
      operatorSelect.appendChild(this.createOption(value, label));
    }
    operatorSelect.value = this.pendingDetailFilterOperator;
    operatorSelect.addEventListener('change', () => {
      if (this.isDetailFilterOperator(operatorSelect.value)) {
        this.pendingDetailFilterOperator = operatorSelect.value;
      }
      this.renderSearchInput(data);
      this.applyInteractiveFilters(data);
    });
    return operatorSelect;
  }

  private createMeasureValueInput(): HTMLInputElement {
    const valueInput = document.createElement('input');
    valueInput.type = 'number';
    valueInput.step = 'any';
    valueInput.className = 'network-detail-filter-number';
    valueInput.setAttribute('aria-label', 'Detail filter number');
    valueInput.placeholder = 'Value';
    valueInput.value = this.pendingDetailFilterValue;
    valueInput.addEventListener('input', () => {
      this.pendingDetailFilterValue = valueInput.value;
    });
    return valueInput;
  }

  private createZeroHelperRow(data: NetworkData): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'network-detail-filter-zero-row';

    const zero = document.createElement('button');
    zero.type = 'button';
    zero.className = 'network-detail-filter-zero';
    zero.textContent = '= 0';
    zero.addEventListener('click', (event) => {
      event.stopPropagation();
      this.addMeasureHelperRule(data, 'eq', 0);
    });

    const positive = document.createElement('button');
    positive.type = 'button';
    positive.className = 'network-detail-filter-positive';
    positive.textContent = '> 0';
    positive.addEventListener('click', (event) => {
      event.stopPropagation();
      this.addMeasureHelperRule(data, 'gt', 0);
    });

    row.appendChild(zero);
    row.appendChild(positive);
    return row;
  }

  private createDetailFilterMoreRow(data: NetworkData): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'network-detail-filter-more-row';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'network-detail-filter-more-toggle';
    toggle.setAttribute('aria-expanded', this.detailFilterMoreOpen ? 'true' : 'false');
    toggle.textContent = this.detailFilterMoreOpen ? 'Hide results' : 'More';
    toggle.addEventListener('click', (event) => {
      event.stopPropagation();
      this.detailFilterMoreOpen = !this.detailFilterMoreOpen;
      this.renderSearchInput(data);
      this.applyInteractiveFilters(data);
    });
    row.appendChild(toggle);

    if (!this.detailFilterMoreOpen) {
      return row;
    }

    const focusMatched = document.createElement('button');
    focusMatched.type = 'button';
    focusMatched.className = 'network-detail-filter-focus-matched';
    focusMatched.textContent = 'Focus Matched';
    focusMatched.addEventListener('click', (event) => {
      event.stopPropagation();
      this.focusMatchedNodes(data);
    });
    row.appendChild(focusMatched);

    const results = document.createElement('div');
    results.className = 'network-detail-filter-results';
    const matchedIds = this.getMatchedNodeIds(data);
    const matchedNodes = data.nodes
      .filter((node) => matchedIds.has(node.id))
      .slice(0, 8);

    if (matchedNodes.length === 0) {
      const empty = document.createElement('button');
      empty.type = 'button';
      empty.className = 'network-detail-filter-result';
      empty.textContent = 'No matches';
      empty.disabled = true;
      results.appendChild(empty);
    } else {
      for (const node of matchedNodes) {
        const result = document.createElement('button');
        result.type = 'button';
        result.className = 'network-detail-filter-result';
        result.textContent = `${node.displayLabel} (${this.getNodeRoleLabel(node.role, data)})`;
        result.addEventListener('click', (event) => {
          event.stopPropagation();
          this.focusNodeById(node.id);
        });
        results.appendChild(result);
      }
    }

    row.appendChild(results);
    return row;
  }

  private focusNodeById(nodeId: string): void {
    const nodes = this.container.querySelectorAll<SVGCircleElement>('.network-node');
    for (const node of Array.from(nodes)) {
      if (node.getAttribute('data-node') !== nodeId) continue;
      node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      return;
    }
  }

  private focusMatchedNodes(data: NetworkData): void {
    const matchedIds = this.getMatchedNodeIds(data);
    this.container.querySelectorAll<SVGCircleElement>('.network-node').forEach((node) => {
      const nodeId = node.getAttribute('data-node') ?? '';
      node.style.filter = matchedIds.has(nodeId) ? 'url(#node-glow)' : '';
    });
    this.applyInteractiveFilters(data);
  }

  private resetDetailFilters(): void {
    this.detailFilterRules = [];
    this.pendingDetailFilterField = '';
    this.pendingDetailFilterOperator = 'eq';
    this.pendingDetailFilterValue = '';
    this.detailFilterMoreOpen = false;
  }

  private addPendingDetailFilterRule(data: NetworkData): void {
    if (!this.canAddPendingDetailFilter()) return;
    const parsed = this.parseDetailFilterKey(this.pendingDetailFilterField);
    if (!parsed) return;

    this.pendingDetailFilterOperator = this.getPendingDetailFilterOperator();
    if (parsed.kind === 'measure') {
      const numericValue = Number(this.pendingDetailFilterValue.trim());
      if (!Number.isFinite(numericValue)) return;
      this.addDetailFilterRule(
        parsed.kind,
        parsed.label,
        this.pendingDetailFilterOperator,
        this.pendingDetailFilterValue,
        numericValue,
      );
    } else {
      this.addDetailFilterRule(parsed.kind, parsed.label, this.pendingDetailFilterOperator, this.pendingDetailFilterValue);
    }
    this.pendingDetailFilterValue = '';
    this.renderSearchInput(data);
    this.applyInteractiveFilters(data);
  }

  private addMeasureHelperRule(data: NetworkData, operator: DetailFilterOperator, value: number): void {
    const parsed = this.parseDetailFilterKey(this.pendingDetailFilterField);
    if (parsed?.kind !== 'measure') return;

    this.addDetailFilterRule(parsed.kind, parsed.label, operator, String(value), value);
    this.pendingDetailFilterOperator = operator;
    this.pendingDetailFilterValue = '';
    this.renderSearchInput(data);
    this.applyInteractiveFilters(data);
  }

  private addDetailFilterRule(
    kind: DetailFilterKind,
    label: string,
    operator: DetailFilterOperator,
    value: string,
    numericValue?: number,
  ): void {
    const candidateNumericValue = kind === 'measure'
      ? numericValue ?? Number(value)
      : undefined;
    const duplicate = this.detailFilterRules.some((rule) =>
      rule.kind === kind
      && rule.label === label
      && rule.operator === operator
      && (kind === 'measure'
        ? rule.numericValue === candidateNumericValue
        : rule.value === value),
    );
    if (duplicate) return;

    this.detailFilterRules = [
      ...this.detailFilterRules,
      {
        id: this.nextDetailFilterRuleId++,
        kind,
        label,
        operator,
        value,
        ...(candidateNumericValue !== undefined ? { numericValue: candidateNumericValue } : {}),
      },
    ];
  }

  private canAddPendingDetailFilter(): boolean {
    const parsed = this.parseDetailFilterKey(this.pendingDetailFilterField);
    if (!parsed || this.pendingDetailFilterValue.length === 0) return false;
    const pendingOperator = this.getPendingDetailFilterOperator();
    const pendingNumericValue = Number(this.pendingDetailFilterValue.trim());
    if (parsed.kind === 'measure' && (this.pendingDetailFilterValue.trim().length === 0 || !Number.isFinite(pendingNumericValue))) {
      return false;
    }
    return !this.detailFilterRules.some((rule) =>
      rule.kind === parsed.kind
      && rule.label === parsed.label
      && rule.operator === pendingOperator
      && (parsed.kind === 'measure'
        ? rule.numericValue === pendingNumericValue
        : rule.value === this.pendingDetailFilterValue),
    );
  }

  private hasPendingDetailFilter(): boolean {
    return this.pendingDetailFilterField.length > 0 || this.pendingDetailFilterValue.length > 0;
  }

  private getPendingDetailFilterOperator(): DetailFilterOperator {
    const parsed = this.parseDetailFilterKey(this.pendingDetailFilterField);
    return parsed?.kind === 'measure' ? this.pendingDetailFilterOperator : 'eq';
  }

  private getDetailFilterRuleDisplay(rule: DetailFilterRule): string {
    return `${rule.label} ${this.getDetailFilterOperatorLabel(rule.operator)} ${rule.value}`;
  }

  private getDetailFilterOperatorOptions(): Array<[DetailFilterOperator, string]> {
    return [
      ['eq', '='],
      ['ne', '!='],
      ['gt', '>'],
      ['gte', '>='],
      ['lt', '<'],
      ['lte', '<='],
    ];
  }

  private getDetailFilterOperatorLabel(operator: DetailFilterOperator): string {
    return this.getDetailFilterOperatorOptions()
      .find(([value]) => value === operator)?.[1] ?? '=';
  }

  private isDetailFilterOperator(value: string): value is DetailFilterOperator {
    return this.getDetailFilterOperatorOptions()
      .some(([operator]) => operator === value);
  }

  private createControlIcon(icon: 'search' | 'filter'): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', `network-control-icon network-${icon === 'search' ? 'search' : 'detail-filter'}-icon`);
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');

    if (icon === 'search') {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', '11');
      circle.setAttribute('cy', '11');
      circle.setAttribute('r', '7');
      svg.appendChild(circle);

      const handle = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      handle.setAttribute('d', 'M20 20l-4.2-4.2');
      svg.appendChild(handle);
      return svg;
    }

    const funnel = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    funnel.setAttribute('d', 'M4 5h16l-6.2 7.2v5.1L10.2 19v-6.8L4 5z');
    svg.appendChild(funnel);
    return svg;
  }

  private applyDetailFilterSelectSizing(
    select: HTMLSelectElement,
    fallbackLabel: string,
    minCh: number,
    maxCh: number,
  ): void {
    const selectedLabel = select.selectedOptions[0]?.textContent?.trim() || fallbackLabel;
    const widthCh = Math.min(maxCh, Math.max(minCh, Math.ceil(selectedLabel.length * 0.72) + 4));
    select.style.width = `${widthCh}ch`;
    select.style.maxWidth = `${maxCh}ch`;
    select.title = selectedLabel;
  }

  private applySearchQuery(rawQuery: string, data: NetworkData): void {
    this.searchQuery = rawQuery;
    this.applyInteractiveFilters(data);
  }

  private hasActiveInteractiveFilter(): boolean {
    return this.searchQuery.trim().length > 0 || this.isDetailFilterActive();
  }

  private reapplyInteractiveState(): void {
    const data = this.currentData;
    if (!data) return;
    if (this.hasActiveInteractiveFilter()) {
      this.applyInteractiveFilters(data);
      return;
    }
    this.applyCrossHighlight();
    this.applyLabelVisibility();
  }

  private applyInteractiveFilters(data: NetworkData): void {
    const query = this.searchQuery.toLowerCase().trim();
    const svgEl = this.container.querySelector('svg.network-svg');
    if (!svgEl) return;

    const allNodes = svgEl.querySelectorAll('.network-node');
    const allLabels = svgEl.querySelectorAll('.network-label');
    const allBadges = svgEl.querySelectorAll('.network-measure-badge');
    const allLinks = svgEl.querySelectorAll('.network-link');
    const allLinkLabels = svgEl.querySelectorAll('.network-link-label');
    const detailFilterActive = this.isDetailFilterActive();

    if (query.length === 0 && !detailFilterActive) {
      allNodes.forEach((el) => { (el as SVGElement).style.opacity = ''; });
      allLabels.forEach((el) => { (el as SVGElement).style.opacity = ''; });
      allBadges.forEach((el) => { (el as SVGElement).style.opacity = ''; });
      allLinks.forEach((el) => { (el as SVGElement).style.opacity = ''; });
      allLinkLabels.forEach((el) => { (el as SVGElement).style.opacity = ''; });
      this.applyCrossHighlight();
      this.applyLabelVisibility();
      return;
    }

    const matchedIds = this.getMatchedNodeIds(data);

    allNodes.forEach((el) => {
      const nodeId = el.getAttribute('data-node') ?? '';
      (el as SVGElement).style.opacity = matchedIds.has(nodeId) ? '1' : '0.15';
    });

    allLabels.forEach((el) => {
      const nodeId = el.getAttribute('data-node') ?? '';
      (el as SVGElement).style.opacity = matchedIds.has(nodeId) ? '1' : '0.15';
    });

    allBadges.forEach((el) => {
      const nodeId = el.getAttribute('data-node') ?? '';
      (el as SVGElement).style.opacity = matchedIds.has(nodeId) ? '1' : '0.15';
    });

    allLinks.forEach((el) => {
      const srcId = el.getAttribute('data-source') ?? '';
      const tgtId = el.getAttribute('data-target') ?? '';
      const connected = matchedIds.has(srcId) || matchedIds.has(tgtId);
      (el as SVGElement).style.opacity = connected ? '1' : '0.08';
    });

    allLinkLabels.forEach((el) => {
      const srcId = el.getAttribute('data-source') ?? '';
      const tgtId = el.getAttribute('data-target') ?? '';
      const connected = matchedIds.has(srcId) || matchedIds.has(tgtId);
      (el as SVGElement).style.opacity = connected ? '1' : '0.08';
    });
  }

  private hasDetailFilters(data: NetworkData): boolean {
    return data.nodes.some((node) => node.role === 'target' || node.role === 'both')
      || data.detailFieldLabels.length > 0
      || data.detailMeasureLabels.length > 0;
  }

  private getDetailFilterFields(data: NetworkData): DetailFilterFieldOption[] {
    return [
      ...(data.nodes.some((node) => node.role === 'target' || node.role === 'both')
        ? [{
            key: this.createDetailFilterKey('target', 'Target'),
            kind: 'target' as DetailFilterKind,
            label: 'Target',
          }]
        : []),
      ...data.detailFieldLabels.map((label) => ({
        key: this.createDetailFilterKey('field', label),
        kind: 'field' as DetailFilterKind,
        label,
      })),
      ...data.detailMeasureLabels.map((label) => ({
        key: this.createDetailFilterKey('measure', label),
        kind: 'measure' as DetailFilterKind,
        label,
      })),
    ];
  }

  private getDetailFilterValueOptions(data: NetworkData, fieldKey: string): DetailFilterValueOption[] {
    const parsed = this.parseDetailFilterKey(fieldKey);
    if (!parsed) return [];
    if (parsed.kind === 'target') {
      const targets = new Set<string>();
      for (const node of data.nodes) {
        if (node.role === 'target' || node.role === 'both') {
          targets.add(node.displayLabel);
        }
      }
      return Array.from(targets)
        .sort((a, b) => a.localeCompare(b))
        .map((value) => ({ value, label: value }));
    }
    if (parsed.kind === 'measure') return [];

    const values = new Set<string>();
    for (const node of data.nodes) {
      for (const value of node.detailFields[parsed.label] ?? []) {
        values.add(value);
      }
    }
    return Array.from(values)
      .sort((a, b) => a.localeCompare(b))
      .map((value) => ({ value, label: value }));
  }

  private pruneDetailFilterRules(data: NetworkData, detailFields: DetailFilterFieldOption[]): void {
    if (this.detailFilterRules.length === 0) return;

    const validFieldKeys = new Set(detailFields.map((field) => field.key));
    this.detailFilterRules = this.detailFilterRules.filter((rule) => {
      const key = this.createDetailFilterKey(rule.kind, rule.label);
      if (!validFieldKeys.has(key)) return false;

      if (rule.kind === 'measure') {
        return Number.isFinite(rule.numericValue ?? Number(rule.value));
      }

      return this.getDetailFilterValueOptions(data, key)
        .some((option) => option.value === rule.value);
    });
  }

  private isDetailFilterActive(): boolean {
    return this.detailFilterRules.length > 0;
  }

  private hasTargetDetailFilterRule(): boolean {
    return this.detailFilterRules.some((rule) => rule.kind === 'target');
  }

  private getMatchedNodeIds(data: NetworkData): Set<string> {
    const query = this.searchQuery.toLowerCase().trim();
    const detailFilterActive = this.isDetailFilterActive();
    const matchedIds = new Set<string>();
    if (query.length === 0 && !detailFilterActive) {
      for (const node of data.nodes) {
        matchedIds.add(node.id);
      }
      return matchedIds;
    }

    for (const node of data.nodes) {
      const matchesSearch = query.length === 0
        || node.id.toLowerCase().includes(query)
        || node.displayLabel.toLowerCase().includes(query);
      if (matchesSearch && (!detailFilterActive || this.nodeMatchesDetailFilterRules(node))) {
        matchedIds.add(node.id);
      }
    }

    if (detailFilterActive && this.hasTargetDetailFilterRule()) {
      const connectedSourceIds = this.getConnectedSourceIdsForMatchedTargets(data, matchedIds);
      for (const sourceId of connectedSourceIds) {
        matchedIds.add(sourceId);
      }
    }

    return matchedIds;
  }

  private nodeMatchesDetailFilterRules(node: GraphNode): boolean {
    if (!this.isDetailFilterActive()) return true;

    const groups = new Map<string, DetailFilterRule[]>();
    for (const rule of this.detailFilterRules) {
      const key = this.createDetailFilterKey(rule.kind, rule.label);
      groups.set(key, [...(groups.get(key) ?? []), rule]);
    }

    for (const rules of groups.values()) {
      if (!rules.some((rule) => this.nodeMatchesDetailFilterRule(node, rule))) {
        return false;
      }
    }
    return true;
  }

  private nodeMatchesDetailFilterRule(node: GraphNode, rule: DetailFilterRule): boolean {
    if (rule.kind === 'target') {
      return (node.role === 'target' || node.role === 'both')
        && node.displayLabel === rule.value;
    }
    if (rule.kind === 'field') {
      return (node.detailFields[rule.label] ?? []).includes(rule.value);
    }

    const rawValue = node.detailValues[rule.label] ?? 0;
    const value = Number.isFinite(rawValue) ? rawValue : 0;
    const numericValue = rule.numericValue ?? Number(rule.value);
    if (!Number.isFinite(numericValue)) return false;

    switch (rule.operator) {
      case 'ne':
        return value !== numericValue;
      case 'gt':
        return value > numericValue;
      case 'gte':
        return value >= numericValue;
      case 'lt':
        return value < numericValue;
      case 'lte':
        return value <= numericValue;
      case 'eq':
      default:
        return value === numericValue;
    }
  }

  private getConnectedSourceIdsForMatchedTargets(data: NetworkData, matchedTargetIds: Set<string>): Set<string> {
    const sourceIds = new Set<string>();
    if (matchedTargetIds.size === 0) return sourceIds;

    for (const link of data.links) {
      const sourceId = this.getNodeId(link.source);
      const targetId = this.getNodeId(link.target);
      if (matchedTargetIds.has(targetId)) {
        sourceIds.add(sourceId);
      }
    }
    return sourceIds;
  }

  private createDetailFilterKey(kind: DetailFilterKind, label: string): string {
    return `${kind}:${label}`;
  }

  private parseDetailFilterKey(key: string): DetailFilterFieldOption | null {
    const separatorIndex = key.indexOf(':');
    if (separatorIndex <= 0) return null;
    const kind = key.slice(0, separatorIndex);
    const label = key.slice(separatorIndex + 1);
    if ((kind !== 'field' && kind !== 'measure' && kind !== 'target') || label.length === 0) return null;
    return { key, kind: kind as DetailFilterKind, label };
  }

  // ── Map Image Authoring ──────────────────────────────────────

  private renderMapImageUploadControls(data: NetworkData): void {
    if (this.getLayoutMode() !== 'mapCanvas' || !this.settings.mapCanvasSettings.showUploadControl.value) return;

    const storedImageSource = this.settings.mapCanvasSettings.imageSource.value?.trim() ?? '';
    const currentImageSource = this.getMapImageSource(data);
    const controls = document.createElement('div');
    controls.className = 'network-map-upload-controls';
    if (this.settings.interactionSettings.enableSearch.value) {
      controls.classList.add('network-map-upload-controls-with-search');
    }
    controls.addEventListener('click', (event) => event.stopPropagation());

    const fileInput = document.createElement('input');
    fileInput.className = 'network-map-upload-input';
    fileInput.type = 'file';
    fileInput.accept = 'image/png,image/jpeg,image/webp,image/svg+xml';
    fileInput.addEventListener('change', (event) => {
      event.stopPropagation();
      const file = fileInput.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== 'string' || reader.result.length === 0) return;
        this.persistMapImageSource(reader.result);
      };
      reader.readAsDataURL(file);
    });

    const uploadButton = document.createElement('button');
    uploadButton.type = 'button';
    uploadButton.className = 'network-map-upload-button';
    uploadButton.textContent = currentImageSource.length > 0 ? 'Replace Map' : 'Upload Map';
    uploadButton.addEventListener('click', (event) => {
      event.stopPropagation();
      fileInput.click();
    });

    controls.appendChild(fileInput);
    controls.appendChild(uploadButton);

    if (storedImageSource.length > 0) {
      const clearButton = document.createElement('button');
      clearButton.type = 'button';
      clearButton.className = 'network-map-upload-clear';
      clearButton.textContent = 'Clear';
      clearButton.addEventListener('click', (event) => {
        event.stopPropagation();
        this.persistMapImageSource('');
      });
      controls.appendChild(clearButton);
    }

    this.container.appendChild(controls);
  }

  private persistMapImageSource(imageSource: string): void {
    const sourcePositions = this.snapshotCurrentMapCanvasSourcePositions();
    const serializedPositions = JSON.stringify(sourcePositions);
    this.settings.mapCanvasSettings.imageSource.value = imageSource;
    this.settings.mapCanvasSettings.showUploadControl.value = false;
    this.settings.mapCanvasSettings.persistedSourcePositions.value = serializedPositions;
    this.settings.mapCanvasSettings.resetPositions.value = false;
    this.host.persistProperties({
      merge: [{
        objectName: 'mapCanvasSettings',
        selector: undefined as unknown as powerbi.data.Selector,
        properties: {
          imageSource,
          showUploadControl: false,
          persistedSourcePositions: serializedPositions,
          resetPositions: false,
        },
      }],
    });

    const data = this.getLinkedInteractionData(this.currentData);
    if (data) {
      this.render(data, this.currentViewport);
    }
  }

  // ── Empty State ──────────────────────────────────────────────

  private renderEmptyState(): void {
    const empty = document.createElement('div');
    empty.className = 'network-empty';
    empty.textContent = this.emptyStateMode === 'noData'
      ? getLocalizedString(this.host, 'NetworkGraph_NoDataState', 'No data for the current selection.')
      : EMPTY_STATE_TEXT;
    this.container.appendChild(empty);
  }

  // ── Entrance Animation ───────────────────────────────────────

  private animateEntrance(
    nodeElements: d3.Selection<SVGCircleElement, GraphNode, SVGGElement, unknown>,
    linkElements: d3.Selection<SVGElement, GraphLink, SVGGElement, unknown>,
    labelElements: d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown> | null,
    duration: number,
  ): void {
    const stagger = DURATION.stagger;

    // Nodes: pop in with stagger
    nodeElements.each((_d, i, elements) => {
      const el = elements[i];
      if (!el) return;
      const cancel = popIn(el, i * stagger, duration);
      this.cancelAnimations.push(cancel);
    });

    // Links: fade in after nodes start appearing
    const linkBaseDelay = (nodeElements.size() * stagger) / 2;

    linkElements.each((_d, i, elements) => {
      const el = elements[i];
      if (!el) return;

      const currentOpacity = el.getAttribute('stroke-opacity') ?? '0.4';
      const targetOpacity = parseFloat(currentOpacity);
      el.setAttribute('stroke-opacity', '0');

      const delay = linkBaseDelay + i * (stagger / 2);
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      let animCancel: (() => void) | null = null;

      timeoutId = setTimeout(() => {
        animCancel = animate(
          duration,
          cubicOut,
          (progress) => {
            el.setAttribute('stroke-opacity', `${targetOpacity * progress}`);
          },
        );
      }, delay);

      this.cancelAnimations.push(() => {
        if (timeoutId !== null) clearTimeout(timeoutId);
        animCancel?.();
        el.setAttribute('stroke-opacity', `${targetOpacity}`);
      });
    });

    // Labels: fade in alongside their nodes
    if (labelElements) {
      labelElements.each((_d, i, elements) => {
        const el = elements[i] as unknown as HTMLElement;
        if (!el) return;
        const cancel = fadeSlideIn(el, 'up', duration, i * stagger);
        this.cancelAnimations.push(cancel);
      });
    }
  }

  // ── Node Inspector ───────────────────────────────────────────────

  private renderNodeInspector(
    node: GraphNode,
    data: NetworkData,
    degreeMap: Map<string, number>,
    totalWeightMap: Map<string, number>,
  ): void {
    this.clearNodeInspector();
    if (!this.settings.nodeInspectorSettings.enabled.value) return;

    const inspector = document.createElement('div');
    inspector.className = `network-node-inspector network-node-inspector-${this.getNodeInspectorPosition()}`;
    inspector.setAttribute('data-node', node.id);

    const header = document.createElement('div');
    header.className = 'network-node-inspector-header';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'network-node-inspector-title-wrap';
    const title = document.createElement('div');
    title.className = 'network-node-inspector-title';
    title.textContent = node.displayLabel;
    const subtitle = document.createElement('div');
    subtitle.className = 'network-node-inspector-subtitle';
    subtitle.textContent = this.getNodeRoleLabel(node.role, data);
    titleWrap.appendChild(title);
    titleWrap.appendChild(subtitle);

    const close = document.createElement('button');
    close.className = 'network-node-inspector-close';
    close.type = 'button';
    close.textContent = 'Close';
    close.addEventListener('click', (event) => {
      event.stopPropagation();
      this.clearNodeInspector();
    });

    header.appendChild(titleWrap);
    header.appendChild(close);
    inspector.appendChild(header);

    const rows = document.createElement('div');
    rows.className = 'network-node-inspector-rows';

    if (this.settings.nodeInspectorSettings.showCoreMetrics.value) {
      this.appendInspectorRow(rows, 'Connections', formatWithSettings(degreeMap.get(node.id) ?? 0, this.settings.numberFormattingCard));
      this.appendInspectorRow(rows, `Total ${data.weightLabel}`, formatWithSettings(totalWeightMap.get(node.id) ?? 0, this.settings.numberFormattingCard));
    }

    if (this.settings.nodeInspectorSettings.showDetailMeasures.value) {
      for (const label of data.detailMeasureLabels) {
        const value = node.detailValues[label];
        if (Number.isFinite(value)) {
          this.appendInspectorRow(rows, label, formatWithSettings(value, this.settings.numberFormattingCard));
        }
      }
    }

    if (this.settings.nodeInspectorSettings.showDetailColumns.value) {
      const maxValues = Math.max(1, Math.round(this.settings.nodeInspectorSettings.maxDetailValues.value));
      for (const label of data.detailFieldLabels) {
        const values = node.detailFields[label] ?? [];
        if (values.length > 0) {
          this.appendInspectorRow(rows, label, this.formatDetailFieldValues(values, maxValues));
        }
      }
    }

    if (rows.childElementCount === 0) {
      const empty = document.createElement('div');
      empty.className = 'network-node-inspector-empty';
      empty.textContent = 'No detail fields are enabled for this node.';
      rows.appendChild(empty);
    }

    inspector.appendChild(rows);
    this.container.appendChild(inspector);
  }

  private clearNodeInspector(): void {
    this.container.querySelector('.network-node-inspector')?.remove();
  }

  private appendInspectorRow(container: HTMLElement, label: string, value: string): void {
    const row = document.createElement('div');
    row.className = 'network-node-inspector-row';

    const labelEl = document.createElement('span');
    labelEl.className = 'network-node-inspector-row-label';
    labelEl.textContent = label;

    const valueEl = document.createElement('span');
    valueEl.className = 'network-node-inspector-row-value';
    valueEl.textContent = value;

    row.appendChild(labelEl);
    row.appendChild(valueEl);
    container.appendChild(row);
  }

  private getNodeInspectorPosition(): 'right' | 'left' | 'bottom' {
    const position = resolveDropdown(this.settings.nodeInspectorSettings.position) ?? 'right';
    return ['left', 'bottom'].includes(position) ? position as 'left' | 'bottom' : 'right';
  }

  private getNodeRoleLabel(role: NodeRole, data: NetworkData): string {
    switch (role) {
      case 'source':
        return data.sourceLabel;
      case 'target':
        return data.targetLabel;
      case 'both':
      default:
        return `${data.sourceLabel} + ${data.targetLabel}`;
    }
  }

  private formatDetailFieldValues(values: string[], maxValues: number): string {
    const visibleValues = values.slice(0, maxValues);
    const extraCount = values.length - visibleValues.length;
    return extraCount > 0
      ? `${visibleValues.join(', ')} +${extraCount} more`
      : visibleValues.join(', ');
  }

  // ── Formatting Pane ──────────────────────────────────────────

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    const s = this.settings;
    const cardMode = (resolveDropdown(s.cardSettings.cardStyleMode) ?? 'glass') as CardStyleMode;
    s.cardSettings.backgroundOpacity.visible = cardMode !== 'none';
    s.cardSettings.backgroundColor.visible = cardMode !== 'none';
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  private handleBackgroundClick = (event?: MouseEvent): void => {
    const target = event?.target as Element | null;
    if (target?.closest?.('.network-node, .network-node-inspector, .network-search-controls')) return;

    this.clearNodeInspector();
    const clearPromise = this.selectionManager.clear();
    this.reapplyInteractiveState();
    void clearPromise.then(() => {
      this.reapplyInteractiveState();
    });
  };

  private applyCrossHighlight(): void {
    const data = this.currentData;
    if (!data) return;
    const hasSelection = this.selectionManager.hasSelection();
    const useHighlightDimming = data.hasHighlights && this.getCrossHighlightMode() === 'dim';
    const shouldDim = hasSelection || useHighlightDimming;

    const nodes = this.container.querySelectorAll<SVGGElement>('.network-node');
    const links = this.container.querySelectorAll<SVGLineElement>('.network-link');
    const linkLabels = this.container.querySelectorAll<SVGGElement>('.network-link-label');
    const badges = this.container.querySelectorAll<SVGGElement>('.network-measure-badge');

    if (!shouldDim) {
      if (this.hasActiveInteractiveFilter()) {
        this.applyInteractiveFilters(data);
        return;
      }
      for (const el of Array.from(nodes)) el.style.opacity = '';
      for (const el of Array.from(links)) el.style.opacity = '';
      for (const el of Array.from(linkLabels)) el.style.opacity = '';
      for (const el of Array.from(badges)) el.style.opacity = '';
      return;
    }

    const selectedIds = this.selectionManager.getSelectionIds() as powerbi.visuals.ISelectionId[];
    const selectedKeys = new Set(selectedIds.map((id) => id.getKey()));
    const selectedNodeIds = new Set(
      data.nodes
        .filter((node) => selectedKeys.has(node.selectionId.getKey()))
        .map((node) => node.id),
    );
    const highlightedNodeIds = new Set<string>();
    if (useHighlightDimming) {
      for (const node of data.nodes) {
        if (node.highlighted) highlightedNodeIds.add(node.id);
      }
    }

    for (const el of Array.from(nodes)) {
      const nodeId = el.getAttribute('data-node');
      const selectionKey = el.getAttribute('data-selection-key');
      const isSelected = hasSelection && selectionKey !== null && selectedKeys.has(selectionKey);
      const isHighlighted = useHighlightDimming && nodeId !== null && highlightedNodeIds.has(nodeId);
      el.style.opacity = (isSelected || isHighlighted)
        ? SELECTED_NODE_OPACITY
        : hasSelection
          ? SELECTION_CONTEXT_OPACITY
          : CROSS_HIGHLIGHT_CONTEXT_OPACITY;
    }

    for (const el of Array.from(links)) {
      const srcId = el.getAttribute('data-source');
      const tgtId = el.getAttribute('data-target');
      const srcSelected = srcId !== null && selectedNodeIds.has(srcId);
      const tgtSelected = tgtId !== null && selectedNodeIds.has(tgtId);
      const srcOk = useHighlightDimming && srcId !== null && highlightedNodeIds.has(srcId);
      const tgtOk = useHighlightDimming && tgtId !== null && highlightedNodeIds.has(tgtId);
      el.style.opacity = (srcSelected || tgtSelected || srcOk || tgtOk)
        ? SELECTED_NODE_OPACITY
        : hasSelection
          ? SELECTION_CONTEXT_OPACITY
          : CROSS_HIGHLIGHT_CONTEXT_OPACITY;
    }

    for (const el of Array.from(linkLabels)) {
      const srcId = el.getAttribute('data-source');
      const tgtId = el.getAttribute('data-target');
      const srcSelected = srcId !== null && selectedNodeIds.has(srcId);
      const tgtSelected = tgtId !== null && selectedNodeIds.has(tgtId);
      const srcOk = useHighlightDimming && srcId !== null && highlightedNodeIds.has(srcId);
      const tgtOk = useHighlightDimming && tgtId !== null && highlightedNodeIds.has(tgtId);
      el.style.opacity = (srcSelected || tgtSelected || srcOk || tgtOk)
        ? SELECTED_NODE_OPACITY
        : hasSelection
          ? SELECTION_CONTEXT_OPACITY
          : CROSS_HIGHLIGHT_CONTEXT_OPACITY;
    }

    for (const el of Array.from(badges)) {
      const nodeId = el.getAttribute('data-node');
      const isSelected = nodeId !== null && selectedNodeIds.has(nodeId);
      const isHighlighted = useHighlightDimming && nodeId !== null && highlightedNodeIds.has(nodeId);
      el.style.opacity = (isSelected || isHighlighted)
        ? SELECTED_NODE_OPACITY
        : hasSelection
          ? SELECTION_CONTEXT_OPACITY
          : CROSS_HIGHLIGHT_CONTEXT_OPACITY;
    }

    this.applyLabelVisibility();
  }

  private getCrossHighlightMode(): 'focus' | 'dim' {
    return resolveDropdown(this.settings.interactionSettings.crossHighlightMode) === 'dim' ? 'dim' : 'focus';
  }

  private getTargetSizeMode(): TargetSizeMode {
    const mode = resolveDropdown(this.settings.nodeSettings.targetSizeMode);
    return mode === 'count' || mode === 'weight' ? mode : 'fixed';
  }

  private getScaledRadius(value: number, maxValue: number, minRadius: number, maxRadius: number): number {
    const safeValue = Number.isFinite(value) ? value : 0;
    const safeMax = Math.max(1, Number.isFinite(maxValue) ? maxValue : 1);
    const ratio = this.clamp(safeValue / safeMax, 0, 1);
    return minRadius + ratio * (maxRadius - minRadius);
  }

  private getZoomWheelDelta(event: WheelEvent | { deltaY: number; deltaMode: number }): number {
    const sensitivity = this.clamp(this.settings.interactionSettings.zoomWheelSensitivity.value, 5, 200) / 100;
    const modeMultiplier = event.deltaMode === 1
      ? 0.05
      : event.deltaMode === 2
        ? 1
        : 0.002;
    return -event.deltaY * modeMultiplier * sensitivity;
  }

  private getLinkedInteractionData(data: NetworkData | null): NetworkData | null {
    if (!data || !data.hasHighlights || this.getCrossHighlightMode() !== 'focus') {
      return data;
    }

    const focusedLinks = data.links.filter((link) => {
      const srcId = this.getNodeId(link.source);
      const tgtId = this.getNodeId(link.target);
      const srcHighlighted = data.nodes.some((node) => node.id === srcId && node.highlighted);
      const tgtHighlighted = data.nodes.some((node) => node.id === tgtId && node.highlighted);
      return srcHighlighted || tgtHighlighted;
    });

    const nodeIds = new Set<string>();
    for (const link of focusedLinks) {
      nodeIds.add(this.getNodeId(link.source));
      nodeIds.add(this.getNodeId(link.target));
    }

    if (nodeIds.size === 0) {
      return data;
    }

    return {
      nodes: data.nodes.filter((node) => nodeIds.has(node.id)),
      links: focusedLinks,
      hasHighlights: data.hasHighlights,
      sourceLabel: data.sourceLabel,
      targetLabel: data.targetLabel,
      weightLabel: data.weightLabel,
      backgroundImageSource: data.backgroundImageSource,
      detailMeasureLabels: data.detailMeasureLabels,
      detailFieldLabels: data.detailFieldLabels,
    };
  }

  private getNodeId(node: string | GraphNode): string {
    return typeof node === 'string' ? node : node.id;
  }

  private getNodeDisplayLabel(node: string | GraphNode): string {
    return typeof node === 'string' ? node : node.displayLabel;
  }

  private applyLabelVisibility(): void {
    const data = this.currentData;
    if (!data) return;

    const labels = this.container.querySelectorAll<SVGTextElement>('.network-label');
    if (labels.length === 0) return;

    const mode = resolveDropdown(this.settings.nodeSettings.labelVisibility) ?? 'smart';
    const adaptiveThreshold = Math.max(0.5, this.settings.nodeSettings.adaptiveZoomThreshold.value);
    const smartDensityActive = mode === 'smart'
      && this.currentZoomScale < adaptiveThreshold;
    const selectedKeys = new Set(
      (this.selectionManager.getSelectionIds() as ISelectionId[]).map((id) => id.getKey()),
    );
    const highlightedNodeIds = new Set(
      data.nodes.filter((node) => node.highlighted).map((node) => node.id),
    );
    const selectedNodeIds = new Set(
      data.nodes.filter((node) => selectedKeys.has(node.selectionId.getKey())).map((node) => node.id),
    );
    const hoveredId = this.hoveredNodeId;
    const hoveredNeighbors = hoveredId ? (this.adjacency.get(hoveredId) ?? new Set<string>()) : new Set<string>();

    labels.forEach((label) => {
      const nodeId = label.getAttribute('data-node') ?? '';
      const isSelected = selectedNodeIds.has(nodeId);
      const isHighlighted = highlightedNodeIds.has(nodeId);
      const isHovered = hoveredId === nodeId;
      const isNeighbor = hoveredNeighbors.has(nodeId);
      const role = label.getAttribute('data-role') as NodeRole | null;

      let visible = true;
      switch (mode) {
        case 'smart':
          visible = !smartDensityActive
            || role !== 'target'
            || isSelected
            || isHighlighted
            || (hoveredId !== null && (isHovered || isNeighbor));
          break;
        case 'hover':
          visible = hoveredId ? (isHovered || isNeighbor) : false;
          break;
        case 'selected':
          visible = selectedKeys.size > 0 ? (isSelected || isHighlighted) : true;
          break;
        case 'adaptive':
          visible = this.currentZoomScale >= adaptiveThreshold
            || isSelected
            || isHighlighted
            || (hoveredId !== null && (isHovered || isNeighbor));
          break;
        case 'always':
        default:
          visible = true;
          break;
      }

      if (data.hasHighlights && !isHighlighted && !isSelected) {
        label.style.opacity = visible ? '0.25' : '0';
      } else {
        label.style.opacity = visible ? '1' : '0';
      }
    });
  }

  // ── Lifecycle ────────────────────────────────────────────────

  public destroy(): void {
    this.container.removeEventListener('click', this.handleBackgroundClick);
    this.cancelAnimations.forEach((cancel) => cancel());
    this.cancelAnimations = [];

    if (this.simulation) {
      this.simulation.stop();
      this.simulation = null;
    }

    this.svg = null;
  }
}
