/**
 * Treemap Pro — Power BI IVisual implementation.
 * Hierarchical treemap with 2 grouping levels, drill-down click,
 * glassmorphic styling, and staggered scale entrance animations.
 */

import powerbi from 'powerbi-visuals-api';
import * as d3 from 'd3';
import { FormattingSettingsService } from 'powerbi-visuals-utils-formattingmodel';
import { TreemapProSettings } from './settings';
import {
  animate,
  cubicOut,
  springScale,
  fadeSlideIn,
  DURATION,
  formatWithSettings,
  applyCardStyle,
  type CardStyleMode,
  getHostChartColor,
  withOpacity,
  renderChartTitle,
  renderLegend,
  applyDataLabelFormatting,
  applyChartAria,
  attachKeyboardNav,
  ensureFocusRingStyles,
  resolveColorTheme,
  buildConditionalConfig,
  resolveConditionalColor,
  resolveDropdown,
  getDateFilterIndices,
  isDateColumn,
  type DateFilterConfig,
} from '../../core/src';
import type { LegendItem, ColorThemeName } from '../../core/src';

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import DataView = powerbi.DataView;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;
import ISelectionId = powerbi.visuals.ISelectionId;

import '../style/visual.less';

// -- Types --------------------------------------------------------------------

type TilingMode = 'squarify' | 'binary' | 'slice' | 'dice';

interface TreeNode {
  name: string;
  value?: number;
  children?: TreeNode[];
  /** Color index for palette lookups */
  colorIndex?: number;
  selectionId?: ISelectionId;
  highlighted?: boolean;
}

interface TreemapData {
  root: TreeNode;
  isEmpty: boolean;
  hasLevel2: boolean;
  /** Whether cross-highlight data is present from another visual/slicer */
  hasHighlights: boolean;
}

// -- Constants ----------------------------------------------------------------

const LABEL_MIN_WIDTH = 40;
const LABEL_MIN_HEIGHT = 24;
const VALUE_MIN_HEIGHT = 36;
const STAGGER_DELAY = 40;

// -- Tiling map ---------------------------------------------------------------

/** Tiling function signature used by d3.treemap().tile() */
type TilingFn = (
  node: d3.HierarchyRectangularNode<TreeNode>,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
) => void;

const TILING_MAP: Record<TilingMode, TilingFn> = {
  squarify: d3.treemapSquarify,
  binary: d3.treemapBinary,
  slice: d3.treemapSlice,
  dice: d3.treemapDice,
};

// -- Visual -------------------------------------------------------------------

export class TreemapProVisual implements IVisual {
  private host: IVisualHost;
  private selectionManager: powerbi.extensibility.ISelectionManager;
  private container: HTMLElement;
  private settings: TreemapProSettings;
  private formattingSettingsService: FormattingSettingsService;
  private cancelAnimations: Array<() => void> = [];

  /** Chain of category values the user has drilled into */
  private drillPath: string[] = [];
  /** Full extracted data, kept for drill-down without re-parsing */
  private currentData: TreemapData | null = null;
  /** Last known viewport for re-renders on drill navigation */
  private currentViewport: powerbi.IViewport = { width: 300, height: 300 };

  constructor(options: VisualConstructorOptions) {
    this.host = options.host;
    this.selectionManager = options.host.createSelectionManager();
    this.container = options.element;
    this.settings = new TreemapProSettings();
    this.formattingSettingsService = new FormattingSettingsService();
    this.container.classList.add('treemap-container');
  }

  public update(options: VisualUpdateOptions): void {
    // Cancel running animations before re-render
    for (const cancel of this.cancelAnimations) cancel();
    this.cancelAnimations = [];

    // Parse settings from dataView
    const dataView = options.dataViews?.[0];
    if (dataView) {
      this.settings = this.formattingSettingsService.populateFormattingSettingsModel(
        TreemapProSettings,
        dataView,
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

    // Conditional visibility: hide heat color sub-settings when heat mode is off
    const heatOn = this.settings.tileAppearanceSettings.heatEnabled.value;

    // Date filter: hide start/end when disabled
    this.settings.dateFilterFormattingCard.startDate.visible = this.settings.dateFilterFormattingCard.enableDateFilter.value;
    this.settings.dateFilterFormattingCard.endAtCurrentDate.visible = this.settings.dateFilterFormattingCard.enableDateFilter.value;
    this.settings.dateFilterFormattingCard.endDate.visible = this.settings.dateFilterFormattingCard.enableDateFilter.value && !this.settings.dateFilterFormattingCard.endAtCurrentDate.value;
    this.settings.tileAppearanceSettings.startColor.visible = heatOn;
    this.settings.tileAppearanceSettings.endColor.visible = heatOn;

    // Hide drill breadcrumb sub-settings when drill is off
    const drillOn = this.settings.drillDownSettings.enabled.value;
    this.settings.drillDownSettings.showBreadcrumb.visible = drillOn;
    this.settings.drillDownSettings.breadcrumbFontSize.visible = drillOn && this.settings.drillDownSettings.showBreadcrumb.value;
    this.settings.drillDownSettings.breadcrumbColor.visible = drillOn && this.settings.drillDownSettings.showBreadcrumb.value;

    // Hide tile label font controls when showLabels is off
    const showLabelsProp = this.settings.treemapSettings.showLabels.value;
    this.settings.treemapSettings.fontSize.visible = showLabelsProp;
    this.settings.treemapSettings.fontColor.visible = showLabelsProp;
    this.settings.treemapSettings.fontFamily.visible = showLabelsProp;
    this.settings.treemapSettings.fontWeight.visible = showLabelsProp;

    // Hide breadcrumb font controls when breadcrumb is off
    this.settings.drillDownSettings.breadcrumbFontFamily.visible = drillOn && this.settings.drillDownSettings.showBreadcrumb.value;
    this.settings.drillDownSettings.breadcrumbFontWeight.visible = drillOn && this.settings.drillDownSettings.showBreadcrumb.value;

    // Hide percentOf when showPercentage is off
    this.settings.treemapDisplaySettings.percentOf.visible = this.settings.treemapDisplaySettings.showPercentage.value;

    // Hide animation duration when animations are disabled
    this.settings.animationSettings.duration.visible = this.settings.animationSettings.enabled.value;

    // Hide shared showDataLabels — local treemapSettings.showLabels is the functional toggle
    this.settings.dataLabelFormattingCard.showDataLabels.visible = false;
    // Hide data label position — position is determined by chart geometry
    this.settings.dataLabelFormattingCard.dataLabelPosition.visible = false;

    // Extract data
    const data = this.extractData(dataView);
    this.currentData = data;
    this.currentViewport = options.viewport;

    // Apply card style — visibility toggles (must happen before render for formatting pane)
    const cardMode = (resolveDropdown(this.settings.cardSettings.cardStyleMode) ?? 'glass') as CardStyleMode;
    this.settings.cardSettings.backgroundOpacity.visible = cardMode !== 'none';
    this.settings.cardSettings.backgroundColor.visible = cardMode !== 'none';

    // Reset drill if data changed structurally
    if (data.isEmpty || !data.hasLevel2) {
      this.drillPath = [];
    }

    // Render
    if (data.isEmpty) {
      this.renderEmpty();
    } else {
      this.renderTreemap(data, options.viewport);
    }

    // Apply card styling AFTER render — render clears the container, which would destroy the glass backdrop div.
    this.applyCardStyling();
  }

  // -- Data Extraction --------------------------------------------------------

  private extractData(dataView: DataView | undefined): TreemapData {
    const empty: TreemapData = {
      root: { name: 'root', children: [] },
      isEmpty: true,
      hasLevel2: false,
      hasHighlights: false,
    };

    if (!dataView?.categorical) return empty;

    const categorical = dataView.categorical;
    const categories = categorical.categories;
    const valuesColumn = categorical.values?.[0];

    if (!categories || categories.length === 0 || !valuesColumn) return empty;

    const level1Column = categories[0];
    const level2Column = categories.length > 1 ? categories[1] : null;
    const hasLevel2 = level2Column !== null;

    // Build nested map: level1 -> Map(level2 -> summed value + selection + highlighted)
    const grouped = new Map<string, Map<string, { value: number; selectionId: ISelectionId; highlighted: boolean }>>();
    let colorIndex = 0;
    const colorMap = new Map<string, number>();
    const level1SelectionMap = new Map<string, ISelectionId>();

    // Cross-highlight detection: read highlights from the values column
    const hlRaw = valuesColumn.highlights as unknown[] | undefined;
    let hasHighlights = false;
    if (hlRaw) {
      for (const h of hlRaw) {
        if (h !== null && h !== undefined) {
          hasHighlights = true;
          break;
        }
      }
    }

    const dateConfig: DateFilterConfig = {
      enabled: this.settings.dateFilterFormattingCard.enableDateFilter.value,
      startDate: this.settings.dateFilterFormattingCard.startDate.value,
      endAtCurrentDate: this.settings.dateFilterFormattingCard.endAtCurrentDate.value,
      endDate: this.settings.dateFilterFormattingCard.endDate.value,
    };
    const dateIndices = isDateColumn(level1Column.source) ? getDateFilterIndices(level1Column.values, dateConfig) : null;

    for (let i = 0; i < level1Column.values.length; i++) {
      if (dateIndices && !dateIndices.has(i)) continue;

      const l1Raw = level1Column.values[i];
      const l1 = l1Raw !== null && l1Raw !== undefined ? String(l1Raw) : '';

      const l2Raw = level2Column?.values[i];
      const l2 = l2Raw !== null && l2Raw !== undefined ? String(l2Raw) : l1;

      const val = valuesColumn.values[i];
      const numVal = typeof val === 'number' && !Number.isNaN(val) ? val : 0;

      // Determine if this row is highlighted
      const rowHighlighted = hasHighlights ? (hlRaw !== undefined && hlRaw[i] !== null && hlRaw[i] !== undefined) : false;

      if (!grouped.has(l1)) {
        grouped.set(l1, new Map<string, { value: number; selectionId: ISelectionId; highlighted: boolean }>());
      }

      if (!colorMap.has(l1)) {
        colorMap.set(l1, colorIndex++);
      }
      if (!level1SelectionMap.has(l1)) {
        level1SelectionMap.set(
          l1,
          this.host.createSelectionIdBuilder()
            .withCategory(level1Column, i)
            .createSelectionId(),
        );
      }

      const children = grouped.get(l1)!;
      const existing = children.get(l2);
      if (existing) {
        existing.value += numVal;
        // If any row contributing to this group is highlighted, mark it highlighted
        if (rowHighlighted) existing.highlighted = true;
      } else {
        const builder = this.host.createSelectionIdBuilder().withCategory(level1Column, i);
        if (level2Column) {
          builder.withCategory(level2Column, i);
        }
        children.set(l2, {
          value: numVal,
          selectionId: builder.createSelectionId(),
          highlighted: rowHighlighted,
        });
      }
    }

    if (grouped.size === 0) return empty;

    // Convert to hierarchy-compatible tree
    const rootChildren: TreeNode[] = [];

    for (const [l1Name, childMap] of grouped) {
      const ci = colorMap.get(l1Name) ?? 0;

      if (hasLevel2) {
        const nodeChildren: TreeNode[] = [];
        let anyChildHighlighted = false;
        for (const [l2Name, entry] of childMap) {
          if (entry.value > 0) {
            nodeChildren.push({
              name: l2Name,
              value: entry.value,
              colorIndex: ci,
              selectionId: entry.selectionId,
              highlighted: entry.highlighted,
            });
            if (entry.highlighted) anyChildHighlighted = true;
          }
        }
        if (nodeChildren.length > 0) {
          rootChildren.push({
            name: l1Name,
            children: nodeChildren,
            colorIndex: ci,
            selectionId: level1SelectionMap.get(l1Name),
            highlighted: anyChildHighlighted,
          });
        }
      } else {
        // Single level: aggregate all values for this l1
        let total = 0;
        let groupHighlighted = false;
        for (const entry of childMap.values()) {
          total += entry.value;
          if (entry.highlighted) groupHighlighted = true;
        }
        if (total > 0) {
          rootChildren.push({
            name: l1Name,
            value: total,
            colorIndex: ci,
            selectionId: level1SelectionMap.get(l1Name),
            highlighted: groupHighlighted,
          });
        }
      }
    }

    if (rootChildren.length === 0) return empty;

    return {
      root: { name: 'root', children: rootChildren },
      isEmpty: false,
      hasLevel2,
      hasHighlights,
    };
  }

  // -- Card Style -------------------------------------------------------------

  private applyCardStyling(): void {
    const s = this.settings.cardSettings;
    const cardMode = (resolveDropdown(s.cardStyleMode) ?? 'glass') as CardStyleMode;
    applyCardStyle(this.container, {
      mode: cardMode,
      opacity: s.backgroundOpacity.value / 100,
      backgroundColor: s.backgroundColor.value?.value,
      borderRadius: s.borderRadius.value,
    });
    if (cardMode === 'none') {
      this.container.style.borderRadius = `${s.borderRadius.value}px`;
    }
  }

  // -- Empty State ------------------------------------------------------------

  private renderEmpty(): void {
    this.clearContainer();
    const emptyEl = document.createElement('div');
    emptyEl.className = 'treemap-empty';
    emptyEl.textContent = 'Add at least one grouping level and a measure to get started.';
    this.container.appendChild(emptyEl);
  }

  // -- Main Treemap Render ----------------------------------------------------

  private renderTreemap(data: TreemapData, viewport: powerbi.IViewport): void {
    const themeName = resolveColorTheme(this.settings.colorThemeFormattingCard);
    this.clearContainer();
    renderChartTitle(this.container, this.settings.titleFormattingCard);

    const padding = 8;
    const width = Math.max(0, viewport.width - padding * 2);
    const height = Math.max(0, viewport.height - padding * 2);

    if (width <= 0 || height <= 0) {
      this.renderEmpty();
      return;
    }

    // Determine which sub-tree to render (drill-down support)
    const drillEnabled = this.settings.drillDownSettings.enabled.value;
    let renderRoot: TreeNode;

    if (drillEnabled && this.drillPath.length > 0 && data.hasLevel2 && data.root.children) {
      // Walk the drill path to find the target sub-tree
      let current: TreeNode = data.root;
      let pathValid = true;
      for (const segment of this.drillPath) {
        const found = current.children?.find((c) => c.name === segment);
        if (found && found.children && found.children.length > 0) {
          current = found;
        } else {
          pathValid = false;
          break;
        }
      }
      if (pathValid && current !== data.root) {
        renderRoot = { name: current.name, children: current.children ?? [] };
      } else {
        this.drillPath = [];
        renderRoot = data.root;
      }
    } else {
      renderRoot = data.root;
    }

    // Breadcrumb trail for drill-up navigation
    if (drillEnabled && this.drillPath.length > 0 && this.settings.drillDownSettings.showBreadcrumb.value) {
      this.renderBreadcrumb(data, viewport);
    }

    // Build d3 hierarchy
    const hierarchy = d3.hierarchy<TreeNode>(renderRoot)
      .sum((d) => d.value ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    // Tiling function
    const tilingMode = this.getTilingMode();
    const tilingFn = TILING_MAP[tilingMode];

    const tilePadding = this.settings.treemapSettings.tilePadding.value;
    const treemapLayout = d3.treemap<TreeNode>()
      .size([width, height])
      .tile(tilingFn)
      .paddingInner(tilePadding)
      .round(true);

    treemapLayout(hierarchy);

    // Create SVG
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'treemap-svg');
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    // After treemapLayout(), nodes have x0/y0/x1/y1 from HierarchyRectangularNode
    const leaves = hierarchy.leaves() as d3.HierarchyRectangularNode<TreeNode>[];
    // Consolidate: local showLabels AND shared showDataLabels both must be true
    const showLabels = this.settings.treemapSettings.showLabels.value && this.settings.dataLabelFormattingCard.showDataLabels.value;
    const showValues = this.settings.treemapSettings.showValues.value;
    const showDataLabels = this.settings.dataLabelFormattingCard.showDataLabels.value;
    const tileStrokeColor = this.settings.tileAppearanceSettings.tileStrokeColor.value?.value || '';
    const tileStrokeWidth = this.settings.tileAppearanceSettings.tileStrokeWidth.value;
    const useChartPalette = this.settings.tileAppearanceSettings.useChartPalette.value;
    const animEnabled = this.settings.animationSettings.enabled.value;
    const animDuration = this.settings.animationSettings.duration.value;

    // Display settings
    const showPercentage = this.settings.treemapDisplaySettings.showPercentage.value;
    const percentOfRaw = this.settings.treemapDisplaySettings.percentOf.value;
    const percentOf: string = (typeof percentOfRaw === 'string'
      ? percentOfRaw
      : (percentOfRaw as { value?: string } | undefined)?.value) ?? 'total';
    const labelOverflowRaw = this.settings.treemapDisplaySettings.labelOverflow.value;
    const labelOverflow: string = (typeof labelOverflowRaw === 'string'
      ? labelOverflowRaw
      : (labelOverflowRaw as { value?: string } | undefined)?.value) ?? 'truncate';
    const colorByDepth = this.settings.tileAppearanceSettings.colorByDepth.value;

    // Compute total for percentage
    const totalValue = hierarchy.value ?? 1;

    // Precompute leaf value range for heat coloring (O(N) once, not O(N²))
    const allLeafValues = leaves.map((l) => l.value ?? 0);
    const minLeafVal = Math.min(...allLeafValues);
    const maxLeafVal = Math.max(...allLeafValues);

    leaves.forEach((leaf, idx) => {
      const x0 = leaf.x0 ?? 0;
      const y0 = leaf.y0 ?? 0;
      const x1 = leaf.x1 ?? 0;
      const y1 = leaf.y1 ?? 0;
      const cellW = x1 - x0;
      const cellH = y1 - y0;

      if (cellW <= 0 || cellH <= 0) return;

      // Group for the cell
      const g = document.createElementNS(svgNS, 'g');
      g.setAttribute('class', 'treemap-cell');
      g.setAttribute('transform', `translate(${x0},${y0})`);

      // Color
      const colorIdx = leaf.data.colorIndex ?? (leaf.parent?.data.colorIndex ?? idx);
      const conditionalColor = this.getConditionalColor(leaf.value ?? 0);
      let baseFillColor = conditionalColor ?? (useChartPalette
        ? getHostChartColor(this.host.colorPalette, colorIdx, themeName)
        : getHostChartColor(this.host.colorPalette, idx, themeName));

      // Color variation by depth: lighten deeper tiles
      if (colorByDepth && leaf.depth > 1) {
        const depthFactor = Math.min(0.4, (leaf.depth - 1) * 0.15);
        baseFillColor = this.lightenColor(baseFillColor, depthFactor);
      }
      const fillColor = baseFillColor;

      // Heat coloring override (if enabled)
      const heatColor = this.getHeatColor(leaf.value ?? 0, minLeafVal, maxLeafVal);
      const effectiveFillColor = heatColor ?? fillColor;

      // Rectangle — slightly translucent for depth perception
      const rect = document.createElementNS(svgNS, 'rect');
      rect.setAttribute('width', String(cellW));
      rect.setAttribute('height', String(cellH));
      const tileCornerRadius = this.settings.tileAppearanceSettings.tileCornerRadius.value;
      rect.setAttribute('rx', String(tileCornerRadius));
      rect.setAttribute('ry', String(tileCornerRadius));
      const tileOpacityVal = Math.max(0, Math.min(100, this.settings.tileAppearanceSettings.tileOpacity.value)) / 100;
      rect.setAttribute('fill', withOpacity(effectiveFillColor, 0.92 * tileOpacityVal));
      if (tileStrokeColor) {
        rect.setAttribute('stroke', tileStrokeColor);
        rect.setAttribute('stroke-width', String(tileStrokeWidth));
      }

      g.appendChild(rect);

      // Label overflow: 'hide' skips labels that don't fit, 'truncate' truncates to fit
      const fitsLabel = cellW >= LABEL_MIN_WIDTH && cellH >= LABEL_MIN_HEIGHT;
      const textFitsCell = leaf.data.name.length * 7 <= cellW - 12;
      const shouldShowLabel = labelOverflow === 'hide' ? (fitsLabel && textFitsCell) : fitsLabel;

      // Label (category name)
      if (showLabels && shouldShowLabel) {
        const label = document.createElementNS(svgNS, 'text');
        label.setAttribute('class', 'treemap-label');
        label.setAttribute('x', '6');
        label.setAttribute('y', '16');
        const tileFontSize = this.settings.treemapSettings.fontSize.value;
        const tileFontColor = this.settings.treemapSettings.fontColor.value?.value;
        const tileFontFamily = resolveDropdown(this.settings.treemapSettings.fontFamily);
        const tileFontWeight = resolveDropdown(this.settings.treemapSettings.fontWeight);
        label.setAttribute('font-size', `${tileFontSize}px`);
        if (tileFontColor) label.setAttribute('fill', tileFontColor);
        if (tileFontFamily) label.style.fontFamily = tileFontFamily;
        label.style.fontWeight = tileFontWeight || 'normal';
        label.textContent = labelOverflow === 'truncate'
          ? this.truncateLabel(leaf.data.name, cellW - 12)
          : leaf.data.name;
        if (label.textContent) {
          g.appendChild(label);
        }
      }

      // Value
      let valueYOffset = 30;
      if (showValues && showDataLabels && cellW >= LABEL_MIN_WIDTH && cellH >= VALUE_MIN_HEIGHT) {
        const valueText = document.createElementNS(svgNS, 'text');
        valueText.setAttribute('class', 'treemap-value');
        valueText.setAttribute('x', '6');
        valueText.setAttribute('y', String(valueYOffset));
        const tileFontColor2 = this.settings.treemapSettings.fontColor.value?.value;
        const tileFontFamily2 = resolveDropdown(this.settings.treemapSettings.fontFamily);
        const tileFontWeight2 = resolveDropdown(this.settings.treemapSettings.fontWeight);
        if (tileFontColor2) valueText.setAttribute('fill', tileFontColor2);
        if (tileFontFamily2) valueText.style.fontFamily = tileFontFamily2;
        valueText.style.fontWeight = tileFontWeight2 || 'normal';
        valueText.textContent = formatWithSettings(leaf.value ?? 0, this.settings.numberFormattingCard);
        g.appendChild(valueText);
        valueYOffset += 14;
      }

      // Percentage display
      if (showPercentage && cellW >= LABEL_MIN_WIDTH && cellH >= VALUE_MIN_HEIGHT) {
        let base: number;
        if (percentOf === 'parent' && leaf.parent) {
          base = leaf.parent.value ?? totalValue;
        } else {
          base = totalValue;
        }
        const pctText = this.formatPercentage(leaf.value ?? 0, base);
        const pctEl = document.createElementNS(svgNS, 'text');
        pctEl.setAttribute('class', 'treemap-value');
        pctEl.setAttribute('x', '6');
        pctEl.setAttribute('y', String(valueYOffset));
        pctEl.setAttribute('font-size', '10');
        pctEl.setAttribute('opacity', '0.7');
        pctEl.textContent = pctText;
        g.appendChild(pctEl);
      }

      // Hover tooltip
      const leafName = leaf.data.name;
      const leafValue = leaf.value ?? 0;
      const parentName = leaf.parent?.data.name ?? '';
      this.attachCellTooltip(g, parentName, leafName, leafValue, totalValue);

      const selectionId = leaf.data.selectionId;
      const canDrill = drillEnabled && data.hasLevel2 && leaf.parent !== null;
      const drillTarget = canDrill ? leaf.parent?.data.name : null;
      // Determine if the drill target has children (i.e., can we drill deeper?)
      const drillTargetHasChildren = canDrill && drillTarget && drillTarget !== 'root' && (() => {
        const parentNode = data.root.children?.find((c) => c.name === drillTarget);
        return parentNode !== undefined && parentNode.children !== undefined && parentNode.children.length > 0;
      })();
      if ((selectionId !== undefined) || drillTargetHasChildren) {
        g.style.cursor = 'pointer';
        g.addEventListener('click', (event: MouseEvent) => {
          event.stopPropagation();

          if (drillTargetHasChildren && drillTarget && !event.ctrlKey && !event.metaKey) {
            // Only drill if this category isn't already in the path
            if (!this.drillPath.includes(drillTarget)) {
              this.drillPath.push(drillTarget);
            }
            if (this.currentData) {
              for (const cancel of this.cancelAnimations) cancel();
              this.cancelAnimations = [];
              this.renderTreemap(this.currentData, this.currentViewport);
            }
            return;
          }

          if (selectionId) {
            void this.selectionManager.select(selectionId, event.ctrlKey || event.metaKey);
          }
        });
      }
      if (selectionId) {
        g.addEventListener('contextmenu', (event: MouseEvent) => {
          event.preventDefault();
          event.stopPropagation();
          void this.selectionManager.showContextMenu(selectionId, {
            x: event.clientX,
            y: event.clientY,
          });
        });
      }

      svg.appendChild(g);

      // Cross-highlight dimming: dim non-highlighted tiles
      if (data.hasHighlights && !leaf.data.highlighted) {
        g.style.opacity = '0.3';
      }

      // Entrance animation: scale from center
      if (animEnabled) {
        const cx = cellW / 2;
        const cy = cellH / 2;
        g.style.transformOrigin = `${x0 + cx}px ${y0 + cy}px`;

        const cancel = springScale(
          g as unknown as SVGElement,
          idx * STAGGER_DELAY,
          animDuration,
          0,
          1,
        );
        this.cancelAnimations.push(cancel);
      }
    });

    this.container.appendChild(svg);

    // Fade in the entire SVG container for a polished entrance
    if (animEnabled) {
      svg.style.opacity = '0';
      const cancelFade = animate(animDuration, cubicOut, (progress) => {
        svg.style.opacity = String(progress);
      });
      this.cancelAnimations.push(cancelFade);
    }

    // Apply shared formatting settings
    applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.treemap-label');
    applyDataLabelFormatting(this.container, this.settings.dataLabelFormattingCard, '.treemap-value');

    // Legend
    this.renderLegend(data, themeName);

    this.applyAccessibility(this.container);
    this.container.addEventListener('click', this.handleBackgroundClick);
  }

  // -- Legend -----------------------------------------------------------------

  private renderLegend(data: TreemapData, themeName: ColorThemeName): void {
    const legendFmtCard = this.settings.legendFormattingCard;
    const rawFontColor = legendFmtCard.legendFontColor.value?.value;
    const legendPos = resolveDropdown(legendFmtCard.legendPosition) ?? 'bottom';
    const useChartPalette = this.settings.tileAppearanceSettings.useChartPalette.value;

    // Build legend items from top-level categories
    const topLevel = data.root.children ?? [];
    const items: LegendItem[] = topLevel.map((node, i) => {
      const colorIdx = node.colorIndex ?? i;
      const color = useChartPalette
        ? getHostChartColor(this.host.colorPalette, colorIdx, themeName)
        : getHostChartColor(this.host.colorPalette, i, themeName);
      return { label: node.name, color };
    });

    const rawFontFamily = resolveDropdown(legendFmtCard.legendFontFamily) || undefined;
    renderLegend(this.container, {
      items,
      position: legendPos as 'top' | 'bottom' | 'left' | 'right',
      fontSize: legendFmtCard.legendFontSize.value,
      fontColor: rawFontColor && rawFontColor.length > 0 ? rawFontColor : '#64748B',
      fontFamily: rawFontFamily,
      aliases: legendFmtCard.legendAliases.value,
    });
  }

  // -- Breadcrumb -------------------------------------------------------------

  private renderBreadcrumb(_data: TreemapData, _viewport: powerbi.IViewport): void {
    const ds = this.settings.drillDownSettings;
    const fontSize = ds.breadcrumbFontSize.value;
    const color = ds.breadcrumbColor.value?.value || '#64748B';

    const breadcrumb = document.createElement('div');
    breadcrumb.className = 'treemap-breadcrumb';
    breadcrumb.style.display = 'flex';
    breadcrumb.style.alignItems = 'center';
    breadcrumb.style.gap = '4px';
    breadcrumb.style.padding = '4px 8px';
    breadcrumb.style.fontSize = `${fontSize}px`;
    breadcrumb.style.color = color;
    breadcrumb.style.flexWrap = 'wrap';
    const bcFontFamily = resolveDropdown(ds.breadcrumbFontFamily);
    if (bcFontFamily) breadcrumb.style.fontFamily = bcFontFamily;
    const bcFontWeight = resolveDropdown(ds.breadcrumbFontWeight);
    breadcrumb.style.fontWeight = bcFontWeight || 'normal';

    // "All" root segment
    const allSpan = document.createElement('span');
    allSpan.textContent = 'All';
    allSpan.style.cursor = 'pointer';
    allSpan.style.textDecoration = 'underline';
    allSpan.style.color = color;
    allSpan.addEventListener('click', (event: MouseEvent) => {
      event.stopPropagation();
      this.drillPath = [];
      if (this.currentData) {
        for (const cancel of this.cancelAnimations) cancel();
        this.cancelAnimations = [];
        this.renderTreemap(this.currentData, this.currentViewport);
      }
    });
    breadcrumb.appendChild(allSpan);

    // Each segment in the drill path
    for (let i = 0; i < this.drillPath.length; i++) {
      const sep = document.createElement('span');
      sep.textContent = ' > ';
      sep.style.color = color;
      breadcrumb.appendChild(sep);

      const segment = document.createElement('span');
      segment.textContent = this.drillPath[i];
      segment.style.color = color;

      // All segments except the last one are clickable to navigate back
      if (i < this.drillPath.length - 1) {
        segment.style.cursor = 'pointer';
        segment.style.textDecoration = 'underline';
        const targetIndex = i;
        segment.addEventListener('click', (event: MouseEvent) => {
          event.stopPropagation();
          this.drillPath = this.drillPath.slice(0, targetIndex + 1);
          if (this.currentData) {
            for (const cancel of this.cancelAnimations) cancel();
            this.cancelAnimations = [];
            this.renderTreemap(this.currentData, this.currentViewport);
          }
        });
      } else {
        segment.style.fontWeight = '600';
      }

      breadcrumb.appendChild(segment);
    }

    this.container.appendChild(breadcrumb);

    // Animate breadcrumb entrance
    if (this.settings.animationSettings.enabled.value) {
      const cancelBtn = fadeSlideIn(breadcrumb, 'left', DURATION.fast);
      this.cancelAnimations.push(cancelBtn);
    }
  }

  // -- Tooltip ----------------------------------------------------------------

  private attachCellTooltip(
    element: SVGGElement,
    parentCategory: string,
    name: string,
    value: number,
    totalValue: number,
  ): void {
    const host = this.host;

    element.addEventListener('mouseenter', (event: MouseEvent) => {
      const tooltipData: VisualTooltipDataItem[] = [];
      if (parentCategory && parentCategory !== 'root') {
        tooltipData.push({ displayName: 'Category', value: parentCategory });
      }
      tooltipData.push({ displayName: 'Name', value: name });
      tooltipData.push({
        displayName: 'Value',
        value: formatWithSettings(value, this.settings.numberFormattingCard),
      });

      if (totalValue > 0) {
        const pctOfTotal = (value / totalValue) * 100;
        tooltipData.push({ displayName: '% of Total', value: `${pctOfTotal.toFixed(1)}%` });
      }

      host.tooltipService.show({
        dataItems: tooltipData,
        identities: [],
        coordinates: [event.clientX, event.clientY],
        isTouchEvent: false,
      });
    });

    element.addEventListener('mousemove', (event: MouseEvent) => {
      host.tooltipService.move({
        dataItems: [],
        identities: [],
        coordinates: [event.clientX, event.clientY],
        isTouchEvent: false,
      });
    });

    element.addEventListener('mouseout', () => {
      host.tooltipService.hide({ immediately: true, isTouchEvent: false });
    });
  }

  // -- Helpers ----------------------------------------------------------------

  private getTilingMode(): TilingMode {
    const val = this.settings.treemapSettings.tiling.value?.value;
    const valid: TilingMode[] = ['squarify', 'binary', 'slice', 'dice'];
    if (typeof val === 'string' && valid.includes(val as TilingMode)) {
      return val as TilingMode;
    }
    return 'squarify';
  }

  /**
   * Truncates a label string to fit within the given pixel width.
   * Approximation: ~7px per character at 11px font-size.
   */
  private truncateLabel(text: string, maxWidth: number): string {
    const charWidth = 7;
    const maxChars = Math.max(1, Math.floor(maxWidth / charWidth));
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars - 1) + '\u2026';
  }

  private clearContainer(): void {
    this.container.removeEventListener('click', this.handleBackgroundClick);
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
  }

  private handleBackgroundClick = (): void => {
    void this.selectionManager.clear();
  };

  // -- Conditional Formatting -------------------------------------------------

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

  // -- Heat Coloring ----------------------------------------------------------

  /**
   * Computes a heat color for a value given the configured start/end gradient.
   * Returns the interpolated color string, or null if heat coloring is disabled.
   */
  private getHeatColor(value: number, minVal: number, maxVal: number): string | null {
    const ta = this.settings.tileAppearanceSettings;
    if (!ta.heatEnabled.value) return null;

    const startColor = ta.startColor.value?.value ?? '#E2E8F0';
    const endColor = ta.endColor.value?.value ?? '#EF4444';
    const range = maxVal - minVal;
    const t = range > 0 ? Math.max(0, Math.min(1, (value - minVal) / range)) : 0.5;

    return this.interpolateHexColor(startColor, endColor, t);
  }

  /**
   * Normalises any CSS color string (`#RRGGBB`, `#RGB`, `rgb(r,g,b)`,
   * `rgba(r,g,b,a)`) to `#RRGGBB` hex so that `parseInt(..., 16)` never
   * returns NaN.
   */
  private normalizeToHex(color: string): string {
    const trimmed = color.trim();

    // Handle rgb(...) and rgba(...) — extract numeric components
    const rgbMatch = trimmed.match(
      /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*[\d.]+\s*)?\)$/,
    );
    if (rgbMatch) {
      const toHex = (n: string): string => parseInt(n, 10).toString(16).padStart(2, '0');
      return `#${toHex(rgbMatch[1])}${toHex(rgbMatch[2])}${toHex(rgbMatch[3])}`;
    }

    // Handle shorthand hex: #RGB → #RRGGBB
    const shortHexMatch = trimmed.match(/^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/);
    if (shortHexMatch) {
      return `#${shortHexMatch[1]}${shortHexMatch[1]}${shortHexMatch[2]}${shortHexMatch[2]}${shortHexMatch[3]}${shortHexMatch[3]}`;
    }

    // Already #RRGGBB (or close enough) — return as-is
    return trimmed;
  }

  private interpolateHexColor(color1: string, color2: string, t: number): string {
    const hex1 = this.normalizeToHex(color1);
    const hex2 = this.normalizeToHex(color2);
    const parse = (hex: string): [number, number, number] => {
      const clean = hex.replace('#', '');
      return [
        parseInt(clean.slice(0, 2), 16),
        parseInt(clean.slice(2, 4), 16),
        parseInt(clean.slice(4, 6), 16),
      ];
    };
    const [r1, g1, b1] = parse(hex1);
    const [r2, g2, b2] = parse(hex2);
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return `rgb(${r},${g},${b})`;
  }

  // -- Percentage Display -----------------------------------------------------

  private formatPercentage(value: number, total: number): string {
    if (total <= 0) return '0%';
    const pct = (value / total) * 100;
    return `${pct.toFixed(1)}%`;
  }

  // -- Depth Color Variation --------------------------------------------------

  private lightenColor(color: string, amount: number): string {
    // Simple lightening by blending with white
    return this.interpolateHexColor(color, '#FFFFFF', Math.min(1, Math.max(0, amount)));
  }

  // -- Accessibility ----------------------------------------------------------

  private applyAccessibility(container: HTMLElement): void {
    const a11y = this.settings.accessibilityFormattingCard;
    if (a11y.enableKeyboardNav.value) {
      ensureFocusRingStyles();
      const focusableElements = container.querySelectorAll('.treemap-cell');
      if (focusableElements.length > 0) {
        attachKeyboardNav({
          container,
          itemSelector: '.treemap-cell',
          onActivate: (_el: Element, index: number) => {
            const cells = container.querySelectorAll('.treemap-cell');
            if (index < cells.length) {
              (cells[index] as HTMLElement).click();
            }
          },
        });
      }
    }
    applyChartAria(container, {
      chartType: 'treemap',
      dataPointCount: container.querySelectorAll('.treemap-cell').length,
    });
  }

  // -- Formatting Model -------------------------------------------------------

  public getFormattingModel(): powerbi.visuals.FormattingModel {
    return this.formattingSettingsService.buildFormattingModel(this.settings);
  }

  // -- Cleanup ----------------------------------------------------------------

  public destroy(): void {
    for (const cancel of this.cancelAnimations) cancel();
    this.cancelAnimations = [];
    this.clearContainer();
  }
}
